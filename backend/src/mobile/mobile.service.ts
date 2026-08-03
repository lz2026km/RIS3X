import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'

export interface DeviceTokenDto {
  token: string
  platform: 'android' | 'ios' | 'web'
  deviceId?: string
  userId?: string
}

interface DeviceTokenEntry extends DeviceTokenDto {
  createdAt: string
}

const ACTIVE_CRITICAL_STATES = ['FOUND', 'NOTIFIED', 'VOICE_CALLED'] as const

@Injectable()
export class MobileService {
  private readonly logger = new Logger(MobileService.name)
  private readonly deviceTokens = new Map<string, DeviceTokenEntry>()

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async jscode2session(code: string): Promise<Record<string, unknown>> {
    const appId = this.config.get<string>('WECHAT_APPID', '')
    const secret = this.config.get<string>('WECHAT_SECRET', '')
    if (!appId || !secret) {
      return { errcode: -1, errmsg: 'WeChat not configured' }
    }
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
    const res = await fetch(url)
    return res.json() as Promise<Record<string, unknown>>
  }

  async todaySummary(): Promise<Record<string, unknown>> {
    if (!this.prisma) return this.seedTodaySummary()
    const tenantId = getCurrentTenantId()
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    try {
      const [examsToday, pendingExams, inProgressExams, criticalValues, reportsToday, signedToday] =
        await Promise.all([
          this.prisma.exam.count({
            where: { tenantId, OR: [{ createdAt: { gte: start, lte: end } }, { scheduledAt: { gte: start, lte: end } }] },
          }),
          this.prisma.exam.count({ where: { tenantId, state: 'SCHEDULED' } }),
          this.prisma.exam.count({ where: { tenantId, state: { in: ['IN_PROGRESS', 'CHECKED_IN'] } } }),
          this.prisma.criticalValue.count({
            where: { tenantId, state: { in: [...ACTIVE_CRITICAL_STATES] } },
          }),
          this.prisma.report.count({ where: { tenantId, createdAt: { gte: start, lte: end } } }),
          this.prisma.report.count({ where: { tenantId, signedAt: { gte: start, lte: end } } }),
        ])
      return {
        examsToday,
        pendingExams,
        inProgressExams,
        criticalValues,
        reportsToday,
        signedReportsToday: signedToday,
        date: start.toISOString().slice(0, 10),
      }
    } catch (err) {
      this.logger.warn(`todaySummary prisma failed: ${(err as Error).message}; using seed fallback`)
      return this.seedTodaySummary()
    }
  }

  async worklist(status?: string): Promise<Record<string, unknown>[]> {
    if (!this.prisma) return this.seedWorklist(status)
    const tenantId = getCurrentTenantId()
    const state = status ? this.mapStatusToState(status) : undefined
    try {
      const exams = await this.prisma.exam.findMany({
        where: { tenantId, ...(state ? { state } : {}) },
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: { patient: { select: { id: true, name: true, gender: true, birthDate: true } } },
      })
      const criticalIds = new Set<string>()
      if (exams.length > 0) {
        const crits = await this.prisma.criticalValue.findMany({
          where: { tenantId, examId: { in: exams.map((e) => e.id) }, state: { in: [...ACTIVE_CRITICAL_STATES] } },
          select: { examId: true },
        })
        crits.forEach((c) => c.examId && criticalIds.add(c.examId))
      }
      return exams.map((e) => ({
        id: e.id,
        accessionNumber: e.accessionNumber,
        patientId: e.patient.id,
        patientName: e.patient.name,
        gender: e.patient.gender,
        age: this.ageOf(e.patient.birthDate),
        modality: e.modality,
        bodyPart: e.bodyPart,
        status: this.friendlyStatus(e.state),
        state: e.state,
        urgency: criticalIds.has(e.id) ? 'critical' : 'routine',
        scheduledAt: e.scheduledAt,
      }))
    } catch (err) {
      this.logger.warn(`worklist prisma failed: ${(err as Error).message}; using seed fallback`)
      return this.seedWorklist(status)
    }
  }

  async criticalValues(): Promise<Record<string, unknown>[]> {
    if (!this.prisma) return this.seedCriticalValues()
    const tenantId = getCurrentTenantId()
    try {
      const items = await this.prisma.criticalValue.findMany({
        where: { tenantId, state: { notIn: ['RESOLVED', 'CLOSED_LOOP', 'CANCELLED'] } },
        take: 50,
        orderBy: { createdAt: 'desc' },
      })
      const examIds = items.map((c) => c.examId).filter((id): id is string => !!id)
      const examsById = new Map<string, { accessionNumber: string; modality: string; patientName: string; gender: string; birthDate: Date | null }>()
      if (examIds.length > 0) {
        const exams = await this.prisma.exam.findMany({
          where: { id: { in: examIds } },
          select: {
            id: true,
            accessionNumber: true,
            modality: true,
            patient: { select: { name: true, gender: true, birthDate: true } },
          },
        })
        exams.forEach((e) =>
          examsById.set(e.id, {
            accessionNumber: e.accessionNumber,
            modality: e.modality,
            patientName: e.patient.name,
            gender: e.patient.gender,
            birthDate: e.patient.birthDate,
          }),
        )
      }
      return items.map((c) => {
        const exam = c.examId ? examsById.get(c.examId) : undefined
        return {
          id: c.id,
          patientName: exam?.patientName ?? '',
          gender: exam?.gender ?? null,
          age: this.ageOf(exam?.birthDate ?? null),
          description: c.description,
          severity: c.severity,
          state: c.state,
          method: c.method,
          notifiedTo: c.notifiedTo,
          accessionNumber: exam?.accessionNumber ?? null,
          modality: exam?.modality ?? null,
          createdAt: c.createdAt,
          ackedAt: c.ackedAt,
        }
      })
    } catch (err) {
      this.logger.warn(`criticalValues prisma failed: ${(err as Error).message}; using seed fallback`)
      return this.seedCriticalValues()
    }
  }

  async ackCriticalValue(id: string, dto?: { ackedBy?: string }): Promise<Record<string, unknown>> {
    if (!this.prisma) {
      if (id === 'missing') throw new NotFoundException(`CriticalValue ${id} not found`)
      return { id, state: 'ACKNOWLEDGED', ackedAt: new Date().toISOString(), ackedBy: dto?.ackedBy ?? 'mobile-user' }
    }
    const existing = await this.prisma.criticalValue.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`CriticalValue ${id} not found`)
    return this.prisma.criticalValue.update({
      where: { id },
      data: { state: 'ACKNOWLEDGED', ackedAt: new Date(), ackedBy: dto?.ackedBy },
    })
  }

  async latestReports(limit = 10): Promise<Record<string, unknown>[]> {
    if (!this.prisma) return this.seedLatestReports(limit)
    const tenantId = getCurrentTenantId()
    try {
      const reports = await this.prisma.report.findMany({
        where: { tenantId },
        take: Math.min(Math.max(Math.trunc(limit) || 10, 1), 50),
        orderBy: [{ signedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          patient: { select: { name: true, gender: true } },
          exam: { select: { modality: true, bodyPart: true, accessionNumber: true } },
          radiologist: { select: { fullName: true } },
        },
      })
      return reports.map((r) => ({
        id: r.id,
        patientName: r.patient.name,
        gender: r.patient.gender,
        modality: r.exam?.modality ?? null,
        bodyPart: r.exam?.bodyPart ?? null,
        accessionNumber: r.exam?.accessionNumber ?? null,
        state: r.state,
        isCritical: r.isCritical,
        impression: r.impression,
        conclusion: r.conclusion,
        findings: r.findings,
        radiologistName: r.radiologist?.fullName ?? null,
        signedAt: r.signedAt,
        createdAt: r.createdAt,
      }))
    } catch (err) {
      this.logger.warn(`latestReports prisma failed: ${(err as Error).message}; using seed fallback`)
      return this.seedLatestReports(limit)
    }
  }

  registerDeviceToken(dto: DeviceTokenDto): Record<string, unknown> {
    if (!dto?.token || typeof dto.token !== 'string' || dto.token.trim() === '') {
      throw new BadRequestException('token is required')
    }
    const platform = dto.platform ?? 'android'
    const entry: DeviceTokenEntry = {
      token: dto.token.trim(),
      platform,
      deviceId: dto.deviceId,
      userId: dto.userId,
      createdAt: new Date().toISOString(),
    }
    this.deviceTokens.set(entry.token, entry)
    this.logger.log(`device-token registered platform=${entry.platform} total=${this.deviceTokens.size}`)
    return { success: true, token: entry.token, platform: entry.platform, total: this.deviceTokens.size }
  }

  listDeviceTokens(): DeviceTokenEntry[] {
    return [...this.deviceTokens.values()]
  }

  private mapStatusToState(status: string): string {
    const s = status.trim().toLowerCase()
    if (s === 'pending') return 'SCHEDULED'
    if (s === 'reading') return 'IN_PROGRESS'
    if (s === 'reported' || s === 'completed') return 'COMPLETED'
    return status.trim().toUpperCase()
  }

  private friendlyStatus(state: string): string {
    switch (state) {
      case 'SCHEDULED':
        return 'pending'
      case 'IN_PROGRESS':
      case 'CHECKED_IN':
        return 'reading'
      case 'COMPLETED':
        return 'reported'
      default:
        return state.toLowerCase()
    }
  }

  private ageOf(birthDate: Date | null): number | null {
    if (!birthDate) return null
    const diff = Date.now() - birthDate.getTime()
    return Math.max(0, Math.floor(diff / (365.25 * 24 * 3600 * 1000)))
  }

  // ---- seed fallbacks (无 DB 时演示数据) ----

  private seedTodaySummary(): Record<string, unknown> {
    return {
      examsToday: 42,
      pendingExams: 12,
      inProgressExams: 5,
      criticalValues: 3,
      reportsToday: 28,
      signedReportsToday: 21,
      date: new Date().toISOString().slice(0, 10),
    }
  }

  private seedWorklist(status?: string): Record<string, unknown>[] {
    const all: Record<string, unknown>[] = [
      { id: 'W1', accessionNumber: 'ACC001', patientId: 'P001', patientName: '张志刚', gender: 'MALE', age: 62, modality: 'CT', bodyPart: '胸部', status: 'pending', state: 'SCHEDULED', urgency: 'critical', scheduledAt: new Date(Date.now() + 3600_000).toISOString() },
      { id: 'W2', accessionNumber: 'ACC002', patientId: 'P002', patientName: '李秀英', gender: 'FEMALE', age: 55, modality: 'MR', bodyPart: '头颅', status: 'pending', state: 'SCHEDULED', urgency: 'routine', scheduledAt: new Date(Date.now() + 1800_000).toISOString() },
      { id: 'W3', accessionNumber: 'ACC003', patientId: 'P003', patientName: '王建军', gender: 'MALE', age: 45, modality: 'CT', bodyPart: '腹部', status: 'reading', state: 'IN_PROGRESS', urgency: 'critical', scheduledAt: new Date().toISOString() },
      { id: 'W4', accessionNumber: 'ACC004', patientId: 'P004', patientName: '赵敏', gender: 'FEMALE', age: 34, modality: 'DR', bodyPart: '胸部', status: 'pending', state: 'SCHEDULED', urgency: 'routine', scheduledAt: new Date(Date.now() + 5400_000).toISOString() },
      { id: 'W5', accessionNumber: 'ACC005', patientId: 'P005', patientName: '陈国强', gender: 'MALE', age: 71, modality: 'CT', bodyPart: '心脏', status: 'reading', state: 'IN_PROGRESS', urgency: 'routine', scheduledAt: new Date().toISOString() },
      { id: 'W6', accessionNumber: 'ACC006', patientId: 'P006', patientName: '刘芳', gender: 'FEMALE', age: 28, modality: 'MR', bodyPart: '腰椎', status: 'reported', state: 'COMPLETED', urgency: 'routine', scheduledAt: new Date(Date.now() - 86_400_000).toISOString() },
    ]
    if (!status) return all
    return all.filter((i) => i.status === status.trim().toLowerCase())
  }

  private seedCriticalValues(): Record<string, unknown>[] {
    return [
      { id: 'CV1', patientName: '王建军', gender: 'MALE', age: 45, description: '腹部CT示肝右叶占位，考虑恶性可能', severity: 'CRITICAL', state: 'FOUND', method: 'SYSTEM', notifiedTo: '急诊科 张医生', accessionNumber: 'ACC003', modality: 'CT', createdAt: new Date().toISOString(), ackedAt: null },
      { id: 'CV2', patientName: '陈国强', gender: 'MALE', age: 71, description: '冠脉CTA示左前降支重度狭窄', severity: 'URGENT', state: 'NOTIFIED', method: 'PHONE', notifiedTo: '心内科 李主任', accessionNumber: 'ACC005', modality: 'CT', createdAt: new Date(Date.now() - 3600_000).toISOString(), ackedAt: null },
      { id: 'CV3', patientName: '张志刚', gender: 'MALE', age: 62, description: '胸部CT示主动脉夹层可疑', severity: 'URGENT', state: 'VOICE_CALLED', method: 'PHONE', notifiedTo: '急诊科', accessionNumber: 'ACC001', modality: 'CT', createdAt: new Date(Date.now() - 7200_000).toISOString(), ackedAt: null },
    ]
  }

  private seedLatestReports(limit: number): Record<string, unknown>[] {
    const n = Math.min(Math.max(Math.trunc(limit) || 10, 1), 50)
    const base: Record<string, unknown>[] = [
      { id: 'R1', patientName: '刘芳', gender: 'FEMALE', modality: 'MR', bodyPart: '腰椎', accessionNumber: 'ACC006', state: 'SIGNED', isCritical: false, impression: '腰椎轻度退行性变', conclusion: '未见明显异常', findings: 'L4/5、L5/S1 椎间盘轻度膨出。', radiologistName: '周医生', signedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
      { id: 'R2', patientName: '王建军', gender: 'MALE', modality: 'CT', bodyPart: '腹部', accessionNumber: 'ACC003', state: 'SUBMITTED', isCritical: true, impression: '肝右叶占位待查', conclusion: '建议增强MRI进一步检查', findings: '肝右叶见类圆形低密度灶，边界欠清。', radiologistName: null, signedAt: null, createdAt: new Date().toISOString() },
      { id: 'R3', patientName: '赵敏', gender: 'FEMALE', modality: 'DR', bodyPart: '胸部', accessionNumber: 'ACC004', state: 'SIGNED', isCritical: false, impression: '两肺未见明显活动性病变', conclusion: '正常胸片', findings: '', radiologistName: '吴医生', signedAt: new Date(Date.now() - 7200_000).toISOString(), createdAt: new Date(Date.now() - 7200_000).toISOString() },
    ]
    return base.slice(0, n)
  }
}
