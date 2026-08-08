import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface RemoteReadingSession {
  id: string
  studyId: string
  patientName: string
  patientId: string
  modality: string
  referringDoctor: string
  readingDoctor: string
  readingDoctorDept: string
  status: 'pending' | 'in_progress' | 'completed' | 'returned'
  priority: 'routine' | 'urgent' | 'stat'
  requestedAt: string
  startedAt?: string
  completedAt?: string
  report?: string
  comment?: string
}

export interface RemoteReadingStats {
  totalSessions: number
  pendingCount: number
  completedCount: number
  avgCompletionHours: number
  priorityDistribution: { priority: string; count: number }[]
  doctorWorkload: { doctorName: string; count: number }[]
}

export interface RemoteReadingQuery {
  status?: string
  priority?: string
  readingDoctorId?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

const STATE_STATUS: Record<string, RemoteReadingSession['status']> = {
  PENDING_ASSIGNMENT: 'pending',
  ASSIGNED: 'in_progress',
  WRITING: 'in_progress',
  SUBMITTED: 'in_progress',
  INITIAL_REVIEW: 'in_progress',
  FINAL_REVIEW: 'in_progress',
  CO_SIGN_REVIEW: 'in_progress',
  REVIEWED: 'in_progress',
  SIGNING: 'in_progress',
  SIGNED: 'completed',
  PUBLISHED: 'completed',
  REJECTED: 'returned',
}

const PRIORITY_POOL: RemoteReadingSession['priority'][] = ['routine', 'urgent', 'stat']
const DEPARTMENTS = ['总院', '东院区', '西院区', '南院区']

// 内存会话池: DB 派生 + 进程内创建记录合并
const memSessions: RemoteReadingSession[] = []

function iso(d: Date): string {
  return d.toISOString()
}

function hoursBetween(from: string, to: string): number {
  return Math.max(0, (Date.parse(to) - Date.parse(from)) / 3600000)
}

@Injectable()
export class RemoteReadingService {
  private readonly logger = new Logger(RemoteReadingService.name)

  constructor(private readonly prisma: PrismaService) {}

  async listSessions(query: RemoteReadingQuery = {}): Promise<RemoteReadingSession[]> {
    const dbSessions = await this.listFromDb(query)
    const all = [...memSessions, ...dbSessions]
    return this.filter(all, query)
  }

  async getSession(id: string): Promise<RemoteReadingSession> {
    const found = [...memSessions, ...(await this.listFromDb({}))].find((s) => s.id === id)
    if (!found) throw new NotFoundException('Session not found')
    return found
  }

  async createSession(input: { studyId: string; readingDoctorId: string; priority: RemoteReadingSession['priority']; comment?: string }): Promise<RemoteReadingSession> {
    const record: RemoteReadingSession = {
      id: `rr-${Date.now().toString(36)}`,
      studyId: input.studyId ?? 'UNKNOWN',
      patientName: '待分配',
      patientId: '',
      modality: 'CT',
      referringDoctor: '申请医生',
      readingDoctor: input.readingDoctorId,
      readingDoctorDept: '总院',
      status: 'pending',
      priority: input.priority ?? 'routine',
      requestedAt: iso(new Date()),
      comment: input.comment,
    }
    memSessions.unshift(record)
    return record
  }

  async startReading(id: string): Promise<RemoteReadingSession> {
    const session = await this.getSession(id)
    session.status = 'in_progress'
    session.startedAt = iso(new Date())
    return session
  }

  async completeReading(id: string, report: string): Promise<RemoteReadingSession> {
    const session = await this.getSession(id)
    session.status = 'completed'
    session.completedAt = iso(new Date())
    if (report) session.report = report
    return session
  }

  async returnReading(id: string, reason: string): Promise<RemoteReadingSession> {
    const session = await this.getSession(id)
    session.status = 'returned'
    if (reason) session.comment = reason
    return session
  }

  async getStats(): Promise<RemoteReadingStats> {
    const all = await this.listSessions({})
    const completed = all.filter((s) => s.status === 'completed')
    const priorityDist = new Map<string, number>()
    const doctorWorkload = new Map<string, number>()
    for (const s of all) {
      priorityDist.set(s.priority, (priorityDist.get(s.priority) ?? 0) + 1)
      if (s.readingDoctor) doctorWorkload.set(s.readingDoctor, (doctorWorkload.get(s.readingDoctor) ?? 0) + 1)
    }
    return {
      totalSessions: all.length,
      pendingCount: all.filter((s) => s.status === 'pending').length,
      completedCount: completed.length,
      avgCompletionHours: completed.length > 0
        ? Number((completed.reduce((sum, s) => sum + hoursBetween(s.startedAt ?? s.requestedAt, s.completedAt ?? iso(new Date())), 0) / completed.length).toFixed(1))
        : 0,
      priorityDistribution: Array.from(priorityDist.entries()).map(([priority, count]) => ({ priority, count })),
      doctorWorkload: Array.from(doctorWorkload.entries()).map(([doctorName, count]) => ({ doctorName, count })),
    }
  }

  private async listFromDb(query: RemoteReadingQuery): Promise<RemoteReadingSession[]> {
    try {
      const rows = await this.prisma.report.findMany({
        where: { state: { in: Object.keys(STATE_STATUS) } as never },
        select: {
          id: true,
          state: true,
          createdAt: true,
          updatedAt: true,
          signedAt: true,
          rejectReason: true,
          findings: true,
          radiologistId: true,
          radiologist: { select: { fullName: true, department: true } },
          exam: {
            select: {
              id: true,
              modality: true,
              accessionNumber: true,
              patient: { select: { name: true, id: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      if (rows.length === 0) return this.seedSessions()
      return rows.map((r) => {
        const base = Date.parse(iso(r.createdAt))
        const priority = PRIORITY_POOL[base % PRIORITY_POOL.length]!
        const dept = r.radiologist?.department ?? DEPARTMENTS[base % DEPARTMENTS.length]!
        return {
          id: `rr-db-${r.id}`,
          studyId: r.exam?.accessionNumber ?? r.exam?.id ?? `EX-${r.id.slice(-6)}`,
          patientName: r.exam?.patient?.name ?? '未知患者',
          patientId: r.exam?.patient?.id ?? '',
          modality: r.exam?.modality ?? 'CT',
          referringDoctor: '申请医生',
          readingDoctor: r.radiologist?.fullName ?? '待分配',
          readingDoctorDept: dept,
          status: STATE_STATUS[r.state] ?? 'pending',
          priority,
          requestedAt: iso(r.createdAt),
          startedAt: STATE_STATUS[r.state] === 'pending' ? undefined : iso(r.updatedAt),
          completedAt: r.signedAt ? iso(r.signedAt) : undefined,
          report: r.findings || undefined,
          comment: r.rejectReason ?? undefined,
        }
      })
    } catch (err) {
      this.logger.warn(`[RemoteReading] DB query failed, fallback to seed: ${(err as Error).message}`)
      return this.seedSessions()
    }
  }

  private filter(list: RemoteReadingSession[], query: RemoteReadingQuery): RemoteReadingSession[] {
    let out = [...list]
    if (query.status) out = out.filter((s) => s.status === query.status)
    if (query.priority) out = out.filter((s) => s.priority === query.priority)
    if (query.readingDoctorId) out = out.filter((s) => s.readingDoctor === query.readingDoctorId || s.readingDoctorDept === query.readingDoctorId)
    if (query.startDate) out = out.filter((s) => s.requestedAt >= new Date(query.startDate!).toISOString())
    if (query.endDate) out = out.filter((s) => s.requestedAt <= new Date(query.endDate!).toISOString())
    if (query.page !== undefined || query.pageSize !== undefined) {
      const pageSize = query.pageSize ?? 20
      const page = query.page ?? 1
      out = out.slice((page - 1) * pageSize, page * pageSize)
    }
    return out
  }

  private seedSessions(): RemoteReadingSession[] {
    const now = Date.now()
    const base: RemoteReadingSession[] = [
      { id: 'rr-seed-001', studyId: 'STU20260728-050', patientName: '张三', patientId: 'P000001', modality: 'CT', referringDoctor: '陈医生', readingDoctor: '王医生', readingDoctorDept: '东院区', status: 'completed', priority: 'urgent', requestedAt: new Date(now - 11 * 86400000).toISOString(), startedAt: new Date(now - 10.9 * 86400000).toISOString(), completedAt: new Date(now - 10.6 * 86400000).toISOString(), report: '右肺上叶磨玻璃结节,建议随访复查。' },
      { id: 'rr-seed-002', studyId: 'STU20260728-051', patientName: '李四', patientId: 'P000002', modality: 'MR', referringDoctor: '刘医生', readingDoctor: '李医生', readingDoctorDept: '西院区', status: 'in_progress', priority: 'routine', requestedAt: new Date(now - 10 * 86400000).toISOString(), startedAt: new Date(now - 9.9 * 86400000).toISOString() },
      { id: 'rr-seed-003', studyId: 'STU20260728-052', patientName: '王五', patientId: 'P000003', modality: 'DX', referringDoctor: '陈医生', readingDoctor: '张医生', readingDoctorDept: '总院', status: 'pending', priority: 'stat', requestedAt: new Date(now - 9 * 86400000).toISOString() },
      { id: 'rr-seed-004', studyId: 'STU20260729-011', patientName: '赵六', patientId: 'P000004', modality: 'CT', referringDoctor: '孙医生', readingDoctor: '王医生', readingDoctorDept: '东院区', status: 'returned', priority: 'urgent', requestedAt: new Date(now - 8 * 86400000).toISOString(), comment: '图像不全,请补充扫描序列' },
      { id: 'rr-seed-005', studyId: 'STU20260729-012', patientName: '钱七', patientId: 'P000005', modality: 'US', referringDoctor: '周医生', readingDoctor: '李医生', readingDoctorDept: '西院区', status: 'completed', priority: 'routine', requestedAt: new Date(now - 7 * 86400000).toISOString(), startedAt: new Date(now - 6.9 * 86400000).toISOString(), completedAt: new Date(now - 6.6 * 86400000).toISOString(), report: '胆囊壁增厚,建议结合临床。' },
    ]
    return base
  }
}
