import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

// ============================================================
// [G005 Wave1A] Consultations — 会诊模块 (Report 状态派生 + 医生关系 + 进程内存)
// 覆盖: list/create/detail/update/pending/by-patient/by-doctor/
//       comments/replies/invite/start/complete/cancel/stats
// 状态值保持与前端 ConsultationPage 过滤一致: 待回复/已回复/已完成/已拒绝
// ============================================================

export interface ConsultationComment {
  id: string
  consultationId: string
  author: string
  content: string
  createdAt: string
  parentId?: string
}

export interface ConsultationDto {
  id: string
  consultationId?: string
  examId: string
  patientId?: string
  patientName: string
  modality: string
  bodyPart: string
  status: string
  type: string
  consultationType?: string
  isRemote?: boolean
  requestingDepartment?: string
  consultedDepartment?: string
  consultedDoctorName?: string
  scheduledAt: string
  requestTime?: string
  requestedBy?: string
  consultant?: string
  consultants?: string[]
  notes?: string
  requestReason?: string
  priority?: string
  urgency?: string
  duration?: string
  participants?: string[]
}

export interface ConsultationStats {
  total: number
  pendingCount: number
  repliedCount: number
  completedCount: number
  cancelledCount: number
  byType: Record<string, number>
  byDepartment: Record<string, number>
}

const STATUS_BY_STATE: Record<string, string> = {
  PENDING_ASSIGNMENT: '待回复',
  ASSIGNED: '待回复',
  WRITING: '已回复',
  SUBMITTED: '已回复',
  INITIAL_REVIEW: '已回复',
  FINAL_REVIEW: '已回复',
  CO_SIGN_REVIEW: '已回复',
  REVIEWED: '已回复',
  SIGNED: '已完成',
  PUBLISHED: '已完成',
  REJECTED: '已拒绝',
  WITHDRAWN: '已拒绝',
}

const CONSULT_TYPES = ['疑难病例', '远程会诊', '急诊会诊']
const DEPARTMENTS = ['放射科', '心内科', '神经科', '肿瘤科']
const DOCTOR_POOL = ['张主任', '李主任', '王主任', '刘主任', '陈医生', '赵医生']

interface MemConsultation extends ConsultationDto {
  _originalStatus?: string
}

const memConsultations: MemConsultation[] = []
const memComments: ConsultationComment[] = []

function iso(d: Date): string {
  return d.toISOString()
}

function createComment(consultationId: string, author: string, content: string, parentId?: string): ConsultationComment {
  const comment: ConsultationComment = {
    id: `CMT-${Date.now().toString(36)}-${memComments.length + 1}`,
    consultationId,
    author,
    content,
    createdAt: iso(new Date()),
    parentId,
  }
  memComments.push(comment)
  return comment
}

@Injectable()
export class ConsultationsService {
  private readonly logger = new Logger(ConsultationsService.name)

  constructor(private readonly prisma: PrismaService) {}

  // GET /consultations — Report 状态派生 (需会诊的进行中报告) + 内存创建记录
  async list(query: { status?: string; priority?: string } = {}): Promise<ConsultationDto[]> {
    const db = await this.listFromDb()
    const all = [...memConsultations, ...db]
    let filtered = all
    if (query.status) filtered = filtered.filter((c) => c.status === query.status)
    if (query.priority) filtered = filtered.filter((c) => c.priority === query.priority || c.urgency === query.priority)
    return filtered.map((c) => {
      const { _originalStatus, ...rest } = c as MemConsultation
      void _originalStatus
      return rest
    })
  }

  // GET /consultations/pending
  async getPending(): Promise<ConsultationDto[]> {
    const all = await this.list({})
    return all.filter((c) => c.status === '待回复' || c.status === '已回复')
  }

  // GET /consultations/by-patient/:patientId
  async getByPatient(patientId: string): Promise<ConsultationDto[]> {
    const all = await this.list({})
    return all.filter((c) => c.patientId === patientId)
  }

  // GET /consultations/by-doctor/:doctorId
  async getByDoctor(doctorId: string): Promise<ConsultationDto[]> {
    const all = await this.list({})
    return all.filter((c) => c.consultant === doctorId || (c.consultants ?? []).includes(doctorId) || c.requestedBy === doctorId)
  }

  // GET /consultations/:id
  async getById(id: string): Promise<ConsultationDto> {
    const found = (await this.list({})).find((c) => c.id === id)
    if (!found) throw new NotFoundException(`会诊 ${id} 不存在`)
    return found
  }

  // POST /consultations — 创建会诊
  create(input: Partial<ConsultationDto>): ConsultationDto {
    const now = iso(new Date())
    const record: MemConsultation = {
      id: input.id ?? `C-${Date.now().toString(36)}`,
      consultationId: input.consultationId ?? `CST${Date.now().toString(36).toUpperCase()}`,
      examId: input.examId ?? 'UNKNOWN',
      patientId: input.patientId,
      patientName: input.patientName ?? '待定患者',
      modality: input.modality ?? 'CT',
      bodyPart: input.bodyPart ?? '—',
      status: input.status ?? '待回复',
      type: input.type ?? input.consultationType ?? '疑难病例',
      consultationType: input.consultationType ?? input.type ?? '疑难病例',
      isRemote: input.isRemote ?? false,
      requestingDepartment: input.requestingDepartment ?? '放射科',
      consultedDepartment: input.consultedDepartment ?? '心内科',
      consultedDoctorName: input.consultedDoctorName,
      scheduledAt: input.scheduledAt ?? now,
      requestTime: input.requestTime ?? now,
      requestedBy: input.requestedBy ?? 'system',
      consultant: input.consultant,
      consultants: input.consultants,
      notes: input.notes,
      requestReason: input.requestReason,
      priority: input.priority,
      urgency: input.urgency,
      duration: input.duration ?? '00:30:00',
      participants: input.participants,
      _originalStatus: input.status,
    }
    memConsultations.unshift(record)
    return record
  }

  // PUT /consultations/:id
  update(id: string, data: Partial<ConsultationDto>): ConsultationDto {
    const found = memConsultations.find((c) => c.id === id)
    if (!found) throw new NotFoundException(`会诊 ${id} 不存在`)
    Object.assign(found, data)
    return found
  }

  // POST /consultations/:id/cancel
  cancel(id: string): ConsultationDto {
    const found = memConsultations.find((c) => c.id === id)
    if (!found) throw new NotFoundException(`会诊 ${id} 不存在`)
    found.status = '已拒绝'
    return found
  }

  // POST /consultations/:id/start — 开始会诊
  start(id: string): ConsultationDto {
    const found = memConsultations.find((c) => c.id === id)
    if (!found) throw new NotFoundException(`会诊 ${id} 不存在`)
    found.status = '已回复'
    return found
  }

  // POST /consultations/:id/complete
  complete(id: string, notes?: string): ConsultationDto {
    const found = memConsultations.find((c) => c.id === id)
    if (!found) throw new NotFoundException(`会诊 ${id} 不存在`)
    found.status = '已完成'
    if (notes) found.notes = notes
    return found
  }

  // POST /consultations/:id/invite — 邀请会诊专家
  invite(id: string, doctorIds: string[]): ConsultationDto {
    const found = memConsultations.find((c) => c.id === id)
    if (!found) throw new NotFoundException(`会诊 ${id} 不存在`)
    const current = found.consultants ?? []
    found.consultants = Array.from(new Set([...current, ...doctorIds]))
    found.consultant = found.consultants[0]
    found.status = found.status === '待回复' ? '待回复' : '已回复'
    return found
  }

  // GET/POST comments & replies
  listComments(id: string): ConsultationComment[] {
    return memComments.filter((c) => c.consultationId === id)
  }

  addComment(id: string, author: string, content: string): ConsultationComment {
    if (!memConsultations.some((c) => c.id === id)) throw new NotFoundException(`会诊 ${id} 不存在`)
    return createComment(id, author, content)
  }

  replyComment(id: string, commentId: string, author: string, content: string): ConsultationComment {
    if (!memConsultations.some((c) => c.id === id)) throw new NotFoundException(`会诊 ${id} 不存在`)
    const parent = memComments.find((c) => c.id === commentId && c.consultationId === id)
    if (!parent) throw new NotFoundException(`评论 ${commentId} 不存在`)
    return createComment(id, author, content, parent.id)
  }

  // GET /consultations/stats
  async getStats(): Promise<ConsultationStats> {
    const all = await this.list({})
    const byType: Record<string, number> = {}
    const byDepartment: Record<string, number> = {}
    for (const c of all) {
      byType[c.type] = (byType[c.type] ?? 0) + 1
      byDepartment[c.consultedDepartment ?? '未知'] = (byDepartment[c.consultedDepartment ?? '未知'] ?? 0) + 1
    }
    return {
      total: all.length,
      pendingCount: all.filter((c) => c.status === '待回复').length,
      repliedCount: all.filter((c) => c.status === '已回复').length,
      completedCount: all.filter((c) => c.status === '已完成').length,
      cancelledCount: all.filter((c) => c.status === '已拒绝').length,
      byType,
      byDepartment,
    }
  }

  // ===== DB 派生 =====
  private async listFromDb(): Promise<ConsultationDto[]> {
    try {
      const rows = await this.prisma.report.findMany({
        where: { state: { in: Object.keys(STATUS_BY_STATE) } as never },
        select: {
          id: true,
          state: true,
          createdAt: true,
          radiologistId: true,
          radiologist: { select: { fullName: true, department: true } },
          exam: {
            select: {
              id: true,
              modality: true,
              bodyPart: true,
              patient: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      if (rows.length === 0) return this.seedConsultations()
      return rows.map((r, i) => {
        const base = Date.parse(iso(r.createdAt))
        const idx = base % CONSULT_TYPES.length
        const deptIdx = (base >> 3) % DEPARTMENTS.length
        return {
          id: `C-${r.id}`,
          consultationId: `CST${r.id.slice(-8).toUpperCase()}`,
          examId: r.exam?.id ?? r.id,
          patientId: r.exam?.patient?.id,
          patientName: r.exam?.patient?.name ?? '未知患者',
          modality: r.exam?.modality ?? 'CT',
          bodyPart: r.exam?.bodyPart ?? '—',
          status: STATUS_BY_STATE[r.state] ?? '待回复',
          type: CONSULT_TYPES[idx],
          consultationType: CONSULT_TYPES[idx],
          isRemote: idx % 2 === 0,
          requestingDepartment: DEPARTMENTS[deptIdx],
          consultedDepartment: DEPARTMENTS[(deptIdx + 1) % DEPARTMENTS.length],
          consultedDoctorName: r.radiologist?.fullName ?? undefined,
          scheduledAt: iso(r.createdAt),
          requestTime: iso(r.createdAt),
          requestedBy: r.radiologistId ?? undefined,
          consultant: r.radiologist?.fullName ?? undefined,
          consultants: r.radiologist?.fullName ? [r.radiologist.fullName] : undefined,
          requestReason: '需要多科室会诊确认诊断',
          urgency: idx === 2 ? '紧急' : '普通',
          duration: '00:30:00',
          participants: r.radiologist?.fullName ? [r.radiologist.fullName] : [],
        }
      })
    } catch (err) {
      this.logger.warn(`[Consultations] DB query failed, fallback to seed: ${(err as Error).message}`)
      return this.seedConsultations()
    }
  }

  private seedConsultations(): ConsultationDto[] {
    const now = Date.now()
    return [
      {
        id: 'C-SEED-001', consultationId: 'CSTSEED001', examId: 'RPT-SEED-001', patientId: 'P000001', patientName: '张三',
        modality: 'CT', bodyPart: '胸部', status: '待回复', type: '疑难病例', consultationType: '疑难病例', isRemote: true,
        requestingDepartment: '放射科', consultedDepartment: '心内科', scheduledAt: new Date(now - 3 * 3600000).toISOString(),
        requestTime: new Date(now - 3 * 3600000).toISOString(), requestedBy: '张主任', consultant: '李主任', consultants: ['李主任'],
        requestReason: '肺动脉主干增宽, 需心内科协助评估', urgency: '普通', duration: '00:30:00', participants: ['张主任', '李主任'],
      },
      {
        id: 'C-SEED-002', consultationId: 'CSTSEED002', examId: 'RPT-SEED-002', patientId: 'P000002', patientName: '李四',
        modality: 'MR', bodyPart: '头颅', status: '已回复', type: '远程会诊', consultationType: '远程会诊', isRemote: true,
        requestingDepartment: '神经科', consultedDepartment: '放射科', scheduledAt: new Date(now - 5 * 3600000).toISOString(),
        requestTime: new Date(now - 5 * 3600000).toISOString(), requestedBy: '王主任', consultant: '陈医生', consultants: ['陈医生'],
        requestReason: '基底节区异常信号, 远程会诊协助定性', urgency: '普通', duration: '00:45:00', participants: ['王主任', '陈医生'],
      },
      {
        id: 'C-SEED-003', consultationId: 'CSTSEED003', examId: 'RPT-SEED-003', patientId: 'P000003', patientName: '王五',
        modality: 'CT', bodyPart: '头颅', status: '已完成', type: '急诊会诊', consultationType: '急诊会诊', isRemote: false,
        requestingDepartment: '急诊科', consultedDepartment: '神经外科', scheduledAt: new Date(now - 26 * 3600000).toISOString(),
        requestTime: new Date(now - 26 * 3600000).toISOString(), requestedBy: '赵医生', consultant: '刘主任', consultants: ['刘主任'],
        requestReason: '急性脑出血, 急诊会诊确定手术方案', urgency: '紧急', duration: '00:20:00', participants: ['赵医生', '刘主任'],
      },
      {
        id: 'C-SEED-004', consultationId: 'CSTSEED004', examId: 'RPT-SEED-004', patientId: 'P000004', patientName: '陈丽',
        modality: 'US', bodyPart: '腹部', status: '已拒绝', type: '疑难病例', consultationType: '疑难病例', isRemote: false,
        requestingDepartment: '普外科', consultedDepartment: '肿瘤科', scheduledAt: new Date(now - 48 * 3600000).toISOString(),
        requestTime: new Date(now - 48 * 3600000).toISOString(), requestedBy: '孙医生', consultant: undefined,
        requestReason: '肝占位性质待定', urgency: '普通', duration: '00:30:00', participants: ['孙医生'],
      },
    ]
  }
}
