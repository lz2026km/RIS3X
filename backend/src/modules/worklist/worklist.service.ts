import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { createNoopGateway, NotificationsGateway } from '../../notifications/notifications.gateway'
import { currentTenantId } from '../../common/tenant/tenant-utils'

export const WORKLIST_STATES = ['SCHEDULED', 'ARRIVED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED', 'IMAGE_READY', 'QC_REJECT', 'QC_PASS', 'PENDING_REPORT'] as const
export type WorklistState = (typeof WORKLIST_STATES)[number]

// [v3.0.6.11-92 Wave1B P0] 影像质控回写目标态 (前端 qcImageAiApi → worklistApi.updateState)
// [v3.0.6.11-95 Wave 1A] IN_PROGRESS 用于质控退回后的「重拍登记」流转
export const QC_STATES = ['IMAGE_READY', 'QC_REJECT', 'QC_PASS', 'IN_PROGRESS'] as const
export type QcState = (typeof QC_STATES)[number]

// [v3.0.6.11-103 Wave 13] 检查状态机合法流转表 (流程质量门禁):
//   主链: SCHEDULED→ARRIVED→IN_PROGRESS→COMPLETED→(QC_REJECT→IN_PROGRESS 重拍闭环)→PENDING_REPORT
//   侧链: 暂停/继续 (IN_PROGRESS↔PAUSED)、取消 (SCHEDULED/ARRIVED/IN_PROGRESS/PAUSED→CANCELLED)、
//         质控链 (COMPLETED/IN_PROGRESS→IMAGE_READY→QC_REJECT|QC_PASS→PENDING_REPORT)
//   PATCH /worklist/:id { state } 与 updateQcState 共用此表校验, 非法跳转返回 400。
export const EXAM_TRANSITIONS: Record<WorklistState, WorklistState[]> = {
  SCHEDULED: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'PAUSED', 'CANCELLED', 'IMAGE_READY'],
  PAUSED: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: ['IMAGE_READY'],
  CANCELLED: [],
  IMAGE_READY: ['QC_REJECT', 'QC_PASS', 'PENDING_REPORT'],
  QC_REJECT: ['IN_PROGRESS', 'PENDING_REPORT'],
  QC_PASS: ['PENDING_REPORT', 'IMAGE_READY', 'QC_REJECT'],
  PENDING_REPORT: ['IMAGE_READY', 'QC_REJECT'],
}
// 允许质控流转的源态 (检查已完成后的影像阶段; IN_PROGRESS 允许技师工作站直接评定)
const QC_ALLOWED_FROM = ['COMPLETED', 'IN_PROGRESS', 'IMAGE_READY', 'QC_REJECT', 'QC_PASS', 'PENDING_REPORT']
// 重拍登记 (QC_REJECT → IN_PROGRESS) 允许的源态
const RETAKE_ALLOWED_FROM = ['QC_REJECT']

// [v3.0.6.11-104 Wave 3D] 重拍审批状态 (门禁: 未审批不得流转 QC_REJECT → IN_PROGRESS)
export const RETAKE_STATUSES = ['pending', 'approved', 'rejected'] as const
export type RetakeStatus = (typeof RETAKE_STATUSES)[number]

// [v3.0.6.11-104 Wave 3A] 检查前核对 (Time-Out) P0 临床安全闭环
// 对照 JCI/WHO 手术安全核对: 患者身份双标识 / 检查部位 / 过敏史 / 妊娠状态 / 隔离标记 / 知情同意
export const TIMEOUT_CHECKLIST_KEYS = ['identity', 'bodyPart', 'allergy', 'pregnancy', 'isolation', 'consent'] as const
export type TimeoutChecklistKey = (typeof TIMEOUT_CHECKLIST_KEYS)[number]

export interface TimeoutCheckItem {
  key: TimeoutChecklistKey
  required: boolean
  passed: boolean
  detail: string | null
}

export interface TimeoutChecklistResponse {
  examId: string
  verified: boolean
  verifiedBy: string | null
  verifiedAt: string | null
  patient: {
    id: string | null
    name: string
    gender: string
    age: number | null
    identityPrimary: string
    identitySecondary: string | null
    identitySecondaryType: 'idCard' | 'accession'
    allergyHistory: string | null
    pregnancyStatus: string
    isolationFlag: boolean
  }
  exam: {
    id: string
    accessionNumber: string | null
    modality: string
    bodyPart: string | null
  }
  consent: {
    required: boolean
    status: 'signed' | 'pending' | 'not_required'
  }
  items: TimeoutCheckItem[]
  checklist: Record<string, unknown> | null
}

export interface TimeoutVerifyDto {
  verifiedBy: string
  note?: string
  checklist?: Partial<Record<TimeoutChecklistKey, boolean>>
}

// 患者 Time-Out 字段 select (新列未迁移时回退 base select, 见 loadTimeoutContext)
const PATIENT_TIMEOUT_SELECT = {
  id: true,
  name: true,
  gender: true,
  birthDate: true,
  idCard: true,
  allergyHistory: true,
  pregnancyStatus: true,
  isolationFlag: true,
} as const
const PATIENT_BASE_SELECT = {
  id: true,
  name: true,
  gender: true,
  birthDate: true,
  idCard: true,
} as const
// Exam base 字段 (避免 timeout 新列未迁移时 select * 失败)
const EXAM_BASE_SELECT = {
  id: true,
  tenantId: true,
  patientId: true,
  accessionNumber: true,
  modality: true,
  bodyPart: true,
  scheduledAt: true,
  startedAt: true,
  completedAt: true,
  deviceId: true,
  state: true,
  priority: true,
  createdAt: true,
} as const

// 中文优先级 → 后端规范枚举 (ROUTINE/URGENT/STAT)
const PRIORITY_ALIASES: Record<string, string> = { 普通: 'ROUTINE', 紧急: 'URGENT', 危重: 'STAT', ROUTINE: 'ROUTINE', URGENT: 'URGENT', STAT: 'STAT' }
const normalizePriority = (p?: string | null): string | undefined => (p !== undefined && p !== null ? PRIORITY_ALIASES[p] ?? undefined : undefined)

export interface WorklistListParams {
  page?: number
  pageSize?: number
  status?: WorklistState
  modality?: string
  patientId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface AssignDto {
  doctorId?: string
  deviceId?: string
}

@Injectable()
export class WorklistService {
  private readonly gateway: NotificationsGateway
  private readonly logger = new Logger(WorklistService.name)

  /**
   * [v3.0.6.11-95 Wave 1A] 新列 (priority/techNotes/qcNotes/qualityRating/retakeCount/pausedAt)
   * DB 未执行 migrate deploy 时的内存回退 (风格与 notifications.service push-subscribe 一致)。
   */
  private readonly examExtras = new Map<string, Record<string, unknown>>()

  constructor(
    private readonly prisma: PrismaService,
    gateway?: NotificationsGateway,
  ) {
    this.gateway = gateway ?? createNoopGateway()
  }

  /** 内存回退: 将新列覆盖合并到 exam 行 */
  private mergeExtras<T extends Record<string, unknown>>(exam: T): T {
    const extras = this.examExtras.get(String(exam.id))
    return extras ? { ...exam, ...extras } : exam
  }

  /**
   * 写 exam 时兼容新旧表结构: 新列字段在 DB 未迁移时回退内存, 不阻塞状态流转。
   */
  private async updateExam(id: string, data: Record<string, unknown>, include?: Record<string, boolean>) {
    const base: Record<string, unknown> = {}
    const extras: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(data)) {
      // [v3.0.6.11-100 Wave 1B] retakeReason/retakeReasons: 重拍原因内存回退 (统计维度)
      // [v3.0.6.11-100 Wave 1A] primaryTechnicianId/backupTechnicianId: 多技师协作主备技师内存回退
      // [v3.0.6.11-103 Wave 11] doseDlp/doseCtdivol: 剂量记录内存回退 (技师工作站完成检查强制项)
      // [v3.0.6.11-104 Wave 3A] timeoutVerified/timeoutVerifiedBy/timeoutVerifiedAt/timeoutChecklist: 检查前核对内存回退
      // [v3.0.6.11-104 Wave 3D] retakeStatus/retakeApprover/retakeApprovedAt/retakeRequestedBy/retakeRequestedAt/retakeRequestNote/retakeReviewNote: 重拍审批内存回退
      if (['techNotes', 'qcNotes', 'qualityRating', 'retakeCount', 'priority', 'pausedAt', 'retakeReason', 'retakeReasons', 'primaryTechnicianId', 'backupTechnicianId', 'doseDlp', 'doseCtdivol', 'timeoutVerified', 'timeoutVerifiedBy', 'timeoutVerifiedAt', 'timeoutChecklist', 'retakeStatus', 'retakeApprover', 'retakeApprovedAt', 'retakeRequestedBy', 'retakeRequestedAt', 'retakeRequestNote', 'retakeReviewNote'].includes(k)) extras[k] = v
      else base[k] = v
    }
    try {
      return await this.prisma.exam.update({ where: { id }, data, include })
    } catch (err) {
      this.logger.warn(`[Worklist] exam.update with new columns failed, fallback memory: ${(err as Error)?.message}`)
      const result = await this.prisma.exam.update({ where: { id }, data: base, include })
      if (Object.keys(extras).length > 0) {
        this.examExtras.set(id, { ...(this.examExtras.get(id) ?? {}), ...extras })
        return { ...result, ...this.examExtras.get(id) }
      }
      return result
    }
  }

  /** W4-2: 工作列表变化 → 全局实时刷新推送 */
  private notifyWorklistChanged(action: string, examId: string): void {
    this.gateway.emitWorklistRefresh()
    // [v3.0.6.11-100 Wave 1B] 检查间状态看板联动刷新
    this.gateway.emitRoomStatusRefresh()
    this.gateway.push('*', {
      event: 'notify',
      type: 'WORKLIST',
      action,
      title: '工作列表更新',
      content: `检查 ${examId} 已更新 (${action})`,
      notification: { examId, action },
      timestamp: Date.now(),
    })
  }

  // [v3.0.6.11-96 Wave 2B (A)] 完成 → 待报告闭环: 自动创建 PENDING_ASSIGNMENT 报告后推送报告通知
  private notifyReportCreated(examId: string): void {
    this.gateway.emitWorklistRefresh()
    this.gateway.push('*', {
      event: 'notify',
      type: 'REPORT',
      action: 'PENDING_ASSIGNMENT',
      title: '待报告任务已生成',
      content: `检查 ${examId} 已完成, 已自动生成待分配报告`,
      notification: { examId, action: 'PENDING_ASSIGNMENT' },
      timestamp: Date.now(),
    })
  }

  private async getExam(id: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id }, include: { patient: true } })
    if (!exam) throw new NotFoundException(`Exam ${id} not found`)
    return this.mergeExtras(exam)
  }

  private async assertDoctor(doctorId: string) {
    const doctor = await this.prisma.user.findUnique({ where: { id: doctorId } })
    if (!doctor) throw new BadRequestException(`Doctor ${doctorId} not found`)
    return doctor
  }

  private async assertDevice(deviceId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } })
    if (!device) throw new BadRequestException(`Device ${deviceId} not found`)
    return device
  }

  private async assignDoctorToExam(exam: { id: string; patientId: string; tenantId: string }, doctorId: string) {
    const report = await this.prisma.report.findFirst({
      where: { examId: exam.id, tenantId: currentTenantId() },
      orderBy: { createdAt: 'asc' },
    })
    if (report) {
      await this.prisma.report.update({ where: { id: report.id }, data: { radiologistId: doctorId } })
    } else {
      await this.prisma.report.create({
        data: {
          patientId: exam.patientId,
          examId: exam.id,
          radiologistId: doctorId,
          state: 'PENDING_ASSIGNMENT',
          tenantId: exam.tenantId,
        },
      })
    }
  }

  // [v3.0.6.11-96 Wave 2B (A)] 完成 → 待报告闭环: 检查无报告实体时自动创建 PENDING_ASSIGNMENT 报告
  private async ensurePendingAssignmentReport(exam: { id: string; patientId: string; tenantId: string }): Promise<boolean> {
    const report = await this.prisma.report.findFirst({
      where: { examId: exam.id, tenantId: currentTenantId() },
      orderBy: { createdAt: 'asc' },
    })
    if (report) return false
    await this.prisma.report.create({
      data: {
        patientId: exam.patientId,
        examId: exam.id,
        state: 'PENDING_ASSIGNMENT',
        tenantId: exam.tenantId,
      },
    })
    return true
  }

  async list(params: WorklistListParams) {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 50
    const where: any = { tenantId: currentTenantId() }
    if (params.status) where.state = params.status
    if (params.modality) where.modality = params.modality
    if (params.patientId) where.patientId = params.patientId
    if (params.dateFrom || params.dateTo) {
      where.scheduledAt = {}
      if (params.dateFrom) where.scheduledAt.gte = new Date(params.dateFrom)
      if (params.dateTo) where.scheduledAt.lte = new Date(params.dateTo)
    }
    if (params.search) {
      where.OR = [
        { accessionNumber: { contains: params.search } },
        { bodyPart: { contains: params.search } },
        { patient: { name: { contains: params.search } } },
      ]
    }
    const [items, total] = await Promise.all([
      this.prisma.exam.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { patient: true, device: true },
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.exam.count({ where }),
    ])
    return { items: items.map((e: any) => this.mergeExtras(e)), total, page, pageSize }
  }

  async getById(id: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id, tenantId: currentTenantId() },
      include: {
        patient: true,
        device: true,
        reports: {
          select: {
            id: true,
            state: true,
            radiologistId: true,
            radiologist: { select: { id: true, fullName: true, role: true } },
          },
        },
      },
    })
    if (!exam) throw new NotFoundException(`Exam ${id} not found`)
    // [v3.0.6.11-95 Wave1B] 操作日志 (技师工作站详情抽屉): WorklistOp 无 Exam 反向关系, 单独查询
    let ops: unknown[] = []
    try {
      ops = await this.prisma.worklistOp.findMany({
        where: { examId: id, tenantId: currentTenantId() },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { op: true, createdAt: true, actor: { select: { fullName: true } } },
      })
    } catch { /* 日志不可用不阻断 */ }
    // [v3.0.6.11-100 Wave 1A (多技师协作)] 主备技师: examExtras/DB 新列 → 姓名解析
    const merged = this.mergeExtras(exam as any)
    let primaryTechnician: { id: string; fullName: string } | null = null
    let backupTechnician: { id: string; fullName: string } | null = null
    const primaryId = (merged as any).primaryTechnicianId
    const backupId = (merged as any).backupTechnicianId
    if (primaryId || backupId) {
      try {
        const users = await this.prisma.user.findMany({
          where: { id: { in: [primaryId, backupId].filter(Boolean) } },
          select: { id: true, fullName: true },
        })
        const byId = new Map(users.map((u) => [u.id, u]))
        if (primaryId) primaryTechnician = byId.get(primaryId) ?? { id: primaryId, fullName: '未知技师' }
        if (backupId) backupTechnician = byId.get(backupId) ?? { id: backupId, fullName: '未知技师' }
      } catch (err) {
        this.logger.warn(`[Worklist] resolve technicians failed: ${(err as Error)?.message}`)
        if (primaryId) primaryTechnician = { id: primaryId, fullName: '未知技师' }
        if (backupId) backupTechnician = { id: backupId, fullName: '未知技师' }
      }
    }
    return { ...merged, ops, primaryTechnician, backupTechnician }
  }

  async update(id: string, dto: { state?: WorklistState; priority?: string; deviceId?: string | null; bodyPart?: string; modality?: string; scheduledAt?: string | null; techNote?: string; qcNote?: string; rating?: string; doseDlp?: number; doseCtdivol?: number }) {
    const exam = await this.getExam(id)
    const data: any = {}
    if (dto.state !== undefined) {
      // [v3.0.6.11-103 Wave 13] 流程质量门禁: PATCH state 走合法流转表, 非法跳转 (如 ARRIVED→COMPLETED 跳过 IN_PROGRESS) 拒绝
      this.assertExamTransition(exam.state, dto.state, id)
      // [v3.0.6.11-104 Wave 3D] 重拍审批门禁: QC_REJECT → IN_PROGRESS 必须已审批通过
      if (exam.state === 'QC_REJECT' && dto.state === 'IN_PROGRESS') this.assertRetakeApproved(exam as unknown as Record<string, unknown>, id)
      if (dto.state === 'QC_REJECT') {
        data.retakeStatus = null
        data.retakeApprover = null
        data.retakeApprovedAt = null
      }
      data.state = dto.state
    }
    // [v3.0.6.11-95 Wave 1A P0-3] 批量改优先级落库 (PATCH /worklist/:id { priority }, 中文别名归一化 ROUTINE/URGENT/STAT)
    const priority = normalizePriority(dto.priority)
    if (priority !== undefined) data.priority = priority
    // [v3.0.6.11-95 Wave 1A P1] 技师注释/质控备注/评级落库
    if (dto.techNote !== undefined) data.techNotes = dto.techNote
    if (dto.qcNote !== undefined) data.qcNotes = dto.qcNote
    if (dto.rating !== undefined) data.qualityRating = dto.rating
    if (dto.deviceId !== undefined) data.deviceId = dto.deviceId
    if (dto.bodyPart !== undefined) data.bodyPart = dto.bodyPart
    if (dto.modality !== undefined) data.modality = dto.modality
    if (dto.scheduledAt !== undefined) data.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null
    // [v3.0.6.11-103 Wave 11] 剂量记录 (DLP / CTDIvol) 落库 (新列未迁移时回退内存)
    if (dto.doseDlp !== undefined) data.doseDlp = dto.doseDlp
    if (dto.doseCtdivol !== undefined) data.doseCtdivol = dto.doseCtdivol
    const result = await this.updateExam(id, data, { patient: true, device: true })
    if (dto.state !== undefined) this.notifyWorklistChanged(`state=${dto.state}`, id)
    return result
  }

  async getStats() {
    const where = { tenantId: currentTenantId() }
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const [grouped, total, completedToday, completedDurations, ops] = await Promise.all([
      this.prisma.exam.groupBy({ by: ['state'], where, _count: { _all: true } }),
      this.prisma.exam.count({ where }),
      this.prisma.exam.count({ where: { ...where, completedAt: { gte: start } } }),
      this.prisma.exam.findMany({
        where: { ...where, state: 'COMPLETED', startedAt: { not: null }, completedAt: { not: null } },
        select: { id: true, startedAt: true, completedAt: true },
      }),
      this.prisma.worklistOp.findMany({
        where: { tenantId: currentTenantId(), op: { in: ['START', 'COMPLETE'] } },
        select: { id: true, op: true, examId: true, actorId: true, actor: { select: { id: true, fullName: true } } },
      }),
    ])
    const byStatus: Record<string, number> = { SCHEDULED: 0, ARRIVED: 0, IN_PROGRESS: 0, PAUSED: 0, COMPLETED: 0, CANCELLED: 0 }
    for (const g of grouped) byStatus[g.state] = g._count._all

    // 平均检查时长: 有 completedAt/startedAt 记录则计算, 否则 seed 派生
    const durationsMin = completedDurations
      .map((e) => (e.completedAt!.getTime() - e.startedAt!.getTime()) / 60000)
      .filter((m) => Number.isFinite(m) && m >= 0)
    const avgDurationMin = durationsMin.length > 0
      ? Math.round(durationsMin.reduce((a, b) => a + b, 0) / durationsMin.length)
      : 28

    // 技师维度: 从 worklist_ops 派生 (START/COMPLETE 归属操作人), 无记录则 seed
    const durationByExamId = new Map(completedDurations.map((e) => [e.id, e]))
    const techMap = new Map<string, { id: string; name: string; completedCount: number; durations: number[] }>()
    for (const op of ops) {
      const key = op.actorId
      const entry = techMap.get(key) ?? { id: key, name: op.actor.fullName, completedCount: 0, durations: [] }
      if (op.op === 'COMPLETE') entry.completedCount += 1
      const examDur = op.examId ? durationByExamId.get(op.examId) : undefined
      if (examDur) {
        const m = (examDur.completedAt!.getTime() - examDur.startedAt!.getTime()) / 60000
        if (Number.isFinite(m) && m >= 0) entry.durations.push(m)
      }
      techMap.set(key, entry)
    }
    let byTechnician = [...techMap.values()].map((t) => ({
      id: t.id,
      name: t.name,
      completedCount: t.completedCount,
      avgDurationMin: t.durations.length > 0 ? Math.round(t.durations.reduce((a, b) => a + b, 0) / t.durations.length) : avgDurationMin,
    }))
    if (byTechnician.length === 0) {
      byTechnician = [
        { id: 'tech-seed-1', name: '王技师', completedCount: 9, avgDurationMin },
        { id: 'tech-seed-2', name: '李技师', completedCount: 6, avgDurationMin: Math.max(10, avgDurationMin - 5) },
        { id: 'tech-seed-3', name: '张技师', completedCount: 4, avgDurationMin: avgDurationMin + 4 },
      ]
    }
    return { total, byStatus, completedToday, avgDurationMin, byTechnician }
  }

  async assign(id: string, dto: AssignDto) {
    if (!dto.doctorId && !dto.deviceId) throw new BadRequestException('doctorId or deviceId is required')
    const exam = await this.getExam(id)
    const data: any = {}
    if (dto.deviceId) {
      await this.assertDevice(dto.deviceId)
      data.deviceId = dto.deviceId
    }
    if (dto.doctorId) {
      await this.assertDoctor(dto.doctorId)
      await this.assignDoctorToExam(exam, dto.doctorId)
    }
    const result = this.prisma.exam.update({ where: { id }, data, include: { patient: true, device: true } })
    this.notifyWorklistChanged('assign', id)
    return result
  }

  async batchAssign(ids: string[], dto: AssignDto) {
    if (!dto.doctorId && !dto.deviceId) throw new BadRequestException('doctorId or deviceId is required')
    const where = { id: { in: ids }, tenantId: currentTenantId() }
    if (dto.deviceId) {
      await this.assertDevice(dto.deviceId)
      await this.prisma.exam.updateMany({ where, data: { deviceId: dto.deviceId } })
    }
    if (dto.doctorId) {
      await this.assertDoctor(dto.doctorId)
      const exams = await this.prisma.exam.findMany({ where, select: { id: true, patientId: true, tenantId: true } })
      await Promise.all(exams.map((e) => this.assignDoctorToExam(e, dto.doctorId!)))
    }
    this.gateway.emitWorklistRefresh()
    return { ok: true, updated: ids.length }
  }

  async checkIn(id: string) {
    const exam = await this.getExam(id)
    if (exam.state !== 'SCHEDULED') throw new BadRequestException(`Exam ${id} is not in SCHEDULED state`)
    const result = this.prisma.exam.update({
      where: { id },
      data: { state: 'ARRIVED', startedAt: new Date() },
      include: { patient: true },
    })
    this.notifyWorklistChanged('checkin', id)
    return result
  }

  async start(id: string) {
    const exam = await this.getExam(id)
    if (exam.state !== 'ARRIVED') throw new BadRequestException(`Exam ${id} is not in ARRIVED state`)
    // [v3.0.6.11-104 Wave 3A P0] 检查前核对门禁: 未完成 Time-Out 不得开始检查 (临床安全闭环)
    if (!(exam as { timeoutVerified?: boolean }).timeoutVerified) {
      throw new BadRequestException(
        `TIMEOUT_NOT_VERIFIED: Exam ${id} 检查前核对 (Time-Out) 未完成, 请先完成患者身份/部位/过敏史/妊娠/隔离核对`,
      )
    }
    const result = this.prisma.exam.update({
      where: { id },
      data: { state: 'IN_PROGRESS' },
      include: { patient: true },
    })
    this.notifyWorklistChanged('start', id)
    return result
  }

  // [v3.0.6.11-96 Wave 2B (A)] 完成 → 待报告闭环: 检查完成后若无报告实体自动创建 PENDING_ASSIGNMENT 报告
  async complete(id: string) {
    const exam = await this.getExam(id)
    if (exam.state !== 'IN_PROGRESS') throw new BadRequestException(`Exam ${id} is not in IN_PROGRESS state`)
    const result = await this.prisma.exam.update({
      where: { id },
      data: { state: 'COMPLETED', completedAt: new Date() },
      include: { patient: true },
    })
    const created = await this.ensurePendingAssignmentReport(exam)
    if (created) this.notifyReportCreated(id)
    this.notifyWorklistChanged('complete', id)
    return result
  }

  // ============================================================
  // [v3.0.6.11-104 Wave 3A P0] 检查前核对 (Time-Out) 临床安全闭环
  //   GET  /worklist/:id/timeout-checklist  返回核对清单
  //   POST /worklist/:id/timeout-verify     提交核对结果 (必填项全通过才置 timeoutVerified=true)
  //   门禁: POST /worklist/:id/start 校验 timeoutVerified=true
  // ============================================================

  private ageOf(birthDate?: Date | string | null): number | null {
    if (!birthDate) return null
    const b = new Date(birthDate)
    if (Number.isNaN(b.getTime())) return null
    const now = new Date()
    let age = now.getFullYear() - b.getFullYear()
    const m = now.getMonth() - b.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
    return age
  }

  /** 育龄女性判定: 女性且 12-55 岁 (年龄未知按育龄保守处理) → 妊娠状态必填 */
  private isFertileFemale(patient: Record<string, unknown> | null | undefined): boolean {
    if (!patient || patient.gender !== 'FEMALE') return false
    const age = this.ageOf(patient.birthDate as Date | string | null | undefined)
    if (age === null) return true
    return age >= 12 && age <= 55
  }

  /** 知情同意是否为必填 (增强/造影类检查需签署; 文本来自部位/检查号/模态) */
  private requiresConsent(exam: Record<string, unknown> | null | undefined): boolean {
    const text = `${exam?.bodyPart ?? ''} ${exam?.accessionNumber ?? ''} ${exam?.modality ?? ''}`
    return /增强|造影|对比剂|contrast/i.test(text)
  }

  /** 确定性 seed 回退 (DB 不可用/孤儿模式), 与前端工作列表形状对齐 */
  private buildSeedTimeout(id: string): { exam: Record<string, unknown>; patient: Record<string, unknown> } {
    const exam = {
      id,
      tenantId: currentTenantId(),
      patientId: `P-${id}`,
      accessionNumber: `ACC-${id}`,
      modality: 'CT',
      bodyPart: '胸部CT平扫',
      state: 'ARRIVED',
      timeoutVerified: false,
    }
    const patient = {
      id: `P-${id}`,
      name: '示例患者',
      gender: 'MALE',
      birthDate: new Date('1985-06-01'),
      idCard: '110101198506010000',
      allergyHistory: null,
      pregnancyStatus: 'unknown',
      isolationFlag: false,
    }
    return { exam, patient }
  }

  /**
   * 读取 Time-Out 上下文: 优先 DB (新患者列), 逐级回退 (患者新列/base 列 → 无 exam 新列 → seed),
   * 保证控制器无 DB 也可启动, 孤儿模式给出确定性清单。
   */
  private async loadTimeoutContext(id: string): Promise<{ exam: Record<string, unknown> | null; patient: Record<string, unknown> | null; fromDb: boolean }> {
    const withPatient = (exam: Record<string, unknown> | null, patient: Record<string, unknown> | null) => ({
      exam: exam ? this.mergeExtras(exam) : null,
      patient,
      fromDb: true,
    })
    // 1) 新患者列 (allergy/pregnancy/isolation) 可用
    try {
      const exam = await this.prisma.exam.findUnique({ where: { id }, include: { patient: { select: PATIENT_TIMEOUT_SELECT } } })
      if (exam) return withPatient(exam as Record<string, unknown>, (exam as Record<string, unknown>).patient as Record<string, unknown>)
    } catch (err) {
      this.logger.warn(`[Worklist] timeout load (full) fallback: ${(err as Error)?.message}`)
    }
    // 2) 患者新列未迁移 → base 患者列
    try {
      const exam = await this.prisma.exam.findUnique({ where: { id }, include: { patient: { select: PATIENT_BASE_SELECT } } })
      if (exam) return withPatient(exam as Record<string, unknown>, (exam as Record<string, unknown>).patient as Record<string, unknown>)
    } catch (err) {
      this.logger.warn(`[Worklist] timeout load (base patient) fallback: ${(err as Error)?.message}`)
    }
    // 3) exam 新列未迁移 → base exam select + 单独查患者
    try {
      const exam = await this.prisma.exam.findUnique({ where: { id }, select: EXAM_BASE_SELECT })
      if (exam) {
        let patient: Record<string, unknown> | null = null
        try {
          patient = (await this.prisma.patient.findUnique({ where: { id: (exam as Record<string, unknown>).patientId as string }, select: PATIENT_BASE_SELECT })) as Record<string, unknown> | null
        } catch { /* 患者不可用不阻断 */ }
        return withPatient(exam as Record<string, unknown>, patient)
      }
      return { exam: null, patient: null, fromDb: true }
    } catch (err) {
      this.logger.warn(`[Worklist] timeout load failed, seed fallback: ${(err as Error)?.message}`)
    }
    // 4) 无 DB 孤儿模式
    const seed = this.buildSeedTimeout(id)
    return { exam: seed.exam, patient: seed.patient, fromDb: false }
  }

  /** 组装核对清单 (患者身份双标识 / 部位 / 过敏 / 妊娠 / 隔离 / 同意) */
  private buildTimeoutChecklist(
    exam: Record<string, unknown> | null,
    patient: Record<string, unknown> | null,
    stored: Record<string, unknown> | null,
  ): TimeoutChecklistResponse {
    const fertile = this.isFertileFemale(patient)
    const consentRequired = this.requiresConsent(exam)
    const allergen = (patient?.allergyHistory as string | null) ?? null
    const idCard = patient?.idCard ? String(patient.idCard) : null
    const identitySecondary = idCard && idCard.length >= 4 ? idCard.slice(-4) : ((exam?.accessionNumber as string | null) ?? null)
    const identitySecondaryType: 'idCard' | 'accession' = idCard && idCard.length >= 4 ? 'idCard' : 'accession'
    const idCardMasked = idCard && idCard.length >= 4 ? `****${idCard.slice(-4)}` : null
    const pregnancyStatus = (patient?.pregnancyStatus as string | null) ?? 'unknown'
    const isolationFlag = Boolean(patient?.isolationFlag)
    const storedStatus = (stored?.consentStatus as string | undefined) ?? undefined
    const consentStatus: 'signed' | 'pending' | 'not_required' = !consentRequired
      ? 'not_required'
      : storedStatus === 'signed' ? 'signed' : 'pending'

    const items: TimeoutCheckItem[] = [
      {
        key: 'identity',
        required: true,
        passed: false,
        detail: `${(patient?.name as string | null) ?? ''} · ${idCardMasked ?? identitySecondary ?? '--'}`,
      },
      { key: 'bodyPart', required: true, passed: false, detail: (exam?.bodyPart as string | null) ?? null },
      { key: 'allergy', required: true, passed: false, detail: allergen },
      { key: 'pregnancy', required: fertile, passed: !fertile, detail: pregnancyStatus },
      { key: 'isolation', required: true, passed: false, detail: isolationFlag ? 'isolated' : 'normal' },
      { key: 'consent', required: consentRequired, passed: !consentRequired, detail: consentStatus },
    ]

    return {
      examId: String(exam?.id ?? ''),
      verified: Boolean((exam as { timeoutVerified?: boolean } | null)?.timeoutVerified),
      verifiedBy: (exam?.timeoutVerifiedBy as string | null) ?? null,
      verifiedAt: exam?.timeoutVerifiedAt ? new Date(exam.timeoutVerifiedAt as string | Date).toISOString() : null,
      patient: {
        id: (patient?.id as string | null) ?? null,
        name: (patient?.name as string | null) ?? '未知患者',
        gender: (patient?.gender as string | null) ?? 'UNKNOWN',
        age: this.ageOf(patient?.birthDate as Date | string | null | undefined),
        identityPrimary: (patient?.name as string | null) ?? '未知患者',
        identitySecondary,
        identitySecondaryType,
        allergyHistory: allergen,
        pregnancyStatus,
        isolationFlag,
      },
      exam: {
        id: String(exam?.id ?? ''),
        accessionNumber: (exam?.accessionNumber as string | null) ?? null,
        modality: (exam?.modality as string | null) ?? '--',
        bodyPart: (exam?.bodyPart as string | null) ?? null,
      },
      consent: { required: consentRequired, status: consentStatus },
      items,
      checklist: (exam?.timeoutChecklist as Record<string, unknown> | null) ?? null,
    }
  }

  /** GET /worklist/:id/timeout-checklist */
  async getTimeoutChecklist(id: string): Promise<TimeoutChecklistResponse> {
    const ctx = await this.loadTimeoutContext(id)
    if (ctx.fromDb && !ctx.exam) throw new NotFoundException(`Exam ${id} not found`)
    return this.buildTimeoutChecklist(ctx.exam, ctx.patient, this.examExtras.get(id) ?? null)
  }

  /**
   * POST /worklist/:id/timeout-verify
   * 提交核对结果: 所有必填项必须为 true, 否则 400 TIMEOUT_CHECKLIST_INCOMPLETE;
   * 全部通过才置 timeoutVerified=true 并落库 (新列未迁移时内存回退)。
   */
  async verifyTimeout(id: string, dto: TimeoutVerifyDto) {
    if (!dto?.verifiedBy || String(dto.verifiedBy).trim() === '') {
      throw new BadRequestException('verifiedBy 核对人不能为空')
    }
    const ctx = await this.loadTimeoutContext(id)
    if (ctx.fromDb && !ctx.exam) throw new NotFoundException(`Exam ${id} not found`)
    const built = this.buildTimeoutChecklist(ctx.exam, ctx.patient, this.examExtras.get(id) ?? null)
    const responses = dto.checklist ?? {}
    const missing = built.items.filter((i) => i.required && responses[i.key] !== true).map((i) => i.key)
    if (missing.length > 0) {
      throw new BadRequestException(`TIMEOUT_CHECKLIST_INCOMPLETE: 未通过的必填核对项: ${missing.join(', ')}`)
    }

    const now = new Date()
    const checklistRecord: Record<string, unknown> = {
      verifiedBy: dto.verifiedBy,
      verifiedAt: now.toISOString(),
      note: dto.note ?? null,
      responses: { ...responses },
      snapshot: {
        patientId: built.patient.id,
        patientName: built.patient.name,
        identitySecondary: built.patient.identitySecondary,
        bodyPart: built.exam.bodyPart,
        allergyHistory: built.patient.allergyHistory,
        pregnancyStatus: built.patient.pregnancyStatus,
        isolationFlag: built.patient.isolationFlag,
        consentStatus: built.consent.status,
      },
    }
    const data = {
      timeoutVerified: true,
      timeoutVerifiedBy: dto.verifiedBy,
      timeoutVerifiedAt: now,
      timeoutChecklist: checklistRecord,
    }
    if (ctx.fromDb) {
      await this.updateExam(id, data)
    } else {
      this.examExtras.set(id, { ...(this.examExtras.get(id) ?? {}), ...data })
    }
    this.notifyWorklistChanged('timeout-verified', id)
    return {
      ok: true,
      examId: id,
      timeoutVerified: true,
      timeoutVerifiedBy: dto.verifiedBy,
      timeoutVerifiedAt: now.toISOString(),
      checklist: checklistRecord,
    }
  }

  /**
   * [v3.0.6.11-95 Wave 1A P1] 暂停检查: IN_PROGRESS → PAUSED (对齐 examMachine PAUSE_EXAM → paused)
   */
  async pause(id: string, reason?: string) {
    const exam = await this.getExam(id)
    if (exam.state !== 'IN_PROGRESS') throw new BadRequestException(`Exam ${id} is not in IN_PROGRESS state`)
    const result = await this.updateExam(
      id,
      { state: 'PAUSED', pausedAt: new Date(), ...(reason ? { techNotes: reason } : {}) },
      { patient: true },
    )
    this.notifyWorklistChanged('pause', id)
    return result
  }

  /**
   * [v3.0.6.11-95 Wave 1A P1] 继续检查: PAUSED → IN_PROGRESS
   */
  async resume(id: string) {
    const exam = await this.getExam(id)
    if (exam.state !== 'PAUSED') throw new BadRequestException(`Exam ${id} is not in PAUSED state`)
    const result = await this.updateExam(
      id,
      { state: 'IN_PROGRESS', pausedAt: null },
      { patient: true },
    )
    this.notifyWorklistChanged('resume', id)
    return result
  }

  async cancel(id: string, reason?: string) {
    const exam = await this.getExam(id)
    if (!['SCHEDULED', 'ARRIVED', 'IN_PROGRESS', 'PAUSED'].includes(exam.state)) {
      throw new BadRequestException(`Exam ${id} cannot be cancelled in ${exam.state} state`)
    }
    const result = this.prisma.exam.update({
      where: { id },
      data: { state: 'CANCELLED' },
      include: { patient: true },
    })
    this.notifyWorklistChanged('cancel', id)
    return result
  }

  /**
   * [v3.0.6.11-103 Wave 13] 检查状态机门禁: 校验 from → to 是否在 EXAM_TRANSITIONS 合法流转表内。
   * 同态幂等放行 (PATCH 重复提交不报错); 非法跳转抛 400 并给出当前状态可去向列表。
   */
  private assertExamTransition(from: string, to: WorklistState, id: string): void {
    if (from === to) return
    const allowed = EXAM_TRANSITIONS[from as WorklistState] ?? []
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `INVALID_TRANSITION: Exam ${id} ${from} → ${to} 不允许 (非法跳转; 合法流转: ${from} → ${allowed.length > 0 ? allowed.join('/') : '无'})`,
      )
    }
  }

  /**
   * [v3.0.6.11-104 Wave 3D] 重拍审批门禁: QC_REJECT → IN_PROGRESS 必须已通过审批 (retakeStatus='approved')。
   * 未提交申请 / 待审批 / 已驳回 一律拒绝, 保证「未审批的重拍不得流转到 IN_PROGRESS」。
   */
  private assertRetakeApproved(exam: Record<string, unknown>, id: string): void {
    const status = (exam as any).retakeStatus as string | undefined
    if (status !== 'approved') {
      throw new BadRequestException(
        `RETAKE_NOT_APPROVED: Exam ${id} 重拍申请未通过审批 (retakeStatus=${status ?? 'none'}), 不允许流转到 IN_PROGRESS`,
      )
    }
  }

  /**
   * [v3.0.6.11-95 Wave1B] 批量状态流转 (checkin/start/complete):
   * 逐条校验源态 (checkin: SCHEDULED, start: ARRIVED, complete: IN_PROGRESS),
   * 单条失败不阻断其余; 返回 { succeeded: [{id, state}], failed: [{id, message}] }
   */
  async batchTransition(ids: string[], action: 'checkin' | 'start' | 'complete') {
    const all = await this.prisma.exam.findMany({
      where: { id: { in: ids }, tenantId: currentTenantId() },
      select: { id: true, state: true, patientId: true, tenantId: true },
    })
    const stateById = new Map(all.map((e) => [e.id, e.state]))
    const meta: Record<'checkin' | 'start' | 'complete', { from: string[]; to: WorklistState; label: string }> = {
      checkin: { from: ['SCHEDULED'], to: 'ARRIVED', label: '签到' },
      start: { from: ['ARRIVED'], to: 'IN_PROGRESS', label: '开始' },
      complete: { from: ['IN_PROGRESS'], to: 'COMPLETED', label: '完成' },
    }
    const { from, to, label } = meta[action]
    const succeeded: { id: string; state: string }[] = []
    const failed: { id: string; message: string }[] = []
    const now = new Date()
    for (const id of ids) {
      const state = stateById.get(id)
      if (!state) {
        failed.push({ id, message: '检查不存在' })
        continue
      }
      if (!from.includes(state)) {
        failed.push({ id, message: `当前状态 ${state} 不允许批量${label}` })
        continue
      }
      const data: any = { state: to }
      if (action === 'checkin') data.startedAt = now
      if (action === 'complete') data.completedAt = now
      await this.prisma.exam.update({ where: { id }, data })
      // [v3.0.6.11-96 Wave 2B (A)] 批量完成 → 待报告闭环: 自动创建 PENDING_ASSIGNMENT 报告 (与单条 complete 一致)
      if (action === 'complete') {
        const examRow = all.find((e) => e.id === id)
        if (examRow) {
          const created = await this.ensurePendingAssignmentReport({ id: examRow.id, patientId: examRow.patientId, tenantId: examRow.tenantId })
          if (created) this.notifyReportCreated(id)
        }
      }
      succeeded.push({ id, state: to })
    }
    if (succeeded.length > 0) {
      this.gateway.emitWorklistRefresh()
      succeeded.forEach((s) => this.gateway.push('*', {
        event: 'notify',
        type: 'WORKLIST',
        action,
        title: '工作列表更新',
        content: `检查 ${s.id} 已${label}`,
        notification: { examId: s.id, action },
        timestamp: Date.now(),
      }))
    }
    return { succeeded, failed }
  }

  /**
   * [v3.0.6.11-92 Wave1B P0] 影像质控回写 exam 状态机:
   *   IMAGE_READY → exam.state = IMAGE_READY (图像可用)
   *   QC_REJECT   → exam.state = QC_REJECT (质控退回)
   *   QC_PASS     → exam.state = PENDING_REPORT (质控通过 → 待报告, 对齐 examMachine QC_PASS → pendingReport)
   *   IN_PROGRESS → 重拍登记 (仅 QC_REJECT → IN_PROGRESS, retakeCount +1, 备注追加 "重拍第 N 次")
   * [v3.0.6.11-95 Wave 1A] 扩展: rating/techNote/qcNote 落库 (exam 新列, DB 未迁移时回退内存)。
   * [v3.0.6.11-100 Wave 1B] 扩展: retakeReason 重拍原因 (motion_artifact/positioning/wrong_protocol/contrast_issue/equipment/other) 落库+内存。
   */
  async updateQcState(id: string, state: QcState, note?: string, opts?: { rating?: string; techNote?: string; qcNote?: string; retakeReason?: string }) {
    const exam = await this.getExam(id)
    if (state === 'IN_PROGRESS') {
      // 重拍登记: 仅允许从 QC_REJECT
      if (!RETAKE_ALLOWED_FROM.includes(exam.state)) {
        throw new BadRequestException(`Exam ${id} 当前状态 ${exam.state} 不允许重拍登记 (仅 ${RETAKE_ALLOWED_FROM.join('/')})`)
      }
      // [v3.0.6.11-104 Wave 3D] 审批门禁: 未审批的重拍不得流转到 IN_PROGRESS
      this.assertRetakeApproved(exam as unknown as Record<string, unknown>, id)
      const retakeCount = Number(exam.retakeCount ?? 0) + 1
      const appendNote = `重拍登记 第 ${retakeCount} 次${note ? `: ${note}` : ''}${opts?.retakeReason ? ` [${opts.retakeReason}]` : ''}`
      const qcNotes = [exam.qcNotes ?? '', appendNote].filter(Boolean).join('\n')
      const extras: Record<string, unknown> = { state: 'IN_PROGRESS', retakeCount, qcNotes }
      // [v3.0.6.11-100 Wave 1B] 重拍原因: 最新值 retakeReason + 历史 retakeReasons[] (重拍统计维度)
      if (opts?.retakeReason) {
        extras.retakeReason = opts.retakeReason
        const prev = Array.isArray((exam as any).retakeReasons) ? (exam as any).retakeReasons as string[] : []
        extras.retakeReasons = [...prev, opts.retakeReason]
      }
      const result = await this.updateExam(id, extras, { patient: true, device: true })
      this.notifyWorklistChanged(`retake=${retakeCount}:${appendNote}`, id)
      return result
    }
    if (!QC_ALLOWED_FROM.includes(exam.state)) {
      throw new BadRequestException(`Exam ${id} 当前状态 ${exam.state} 不允许质控流转 (仅 ${QC_ALLOWED_FROM.join('/')})`)
    }
    const target: WorklistState = state === 'QC_PASS' ? 'PENDING_REPORT' : state
    const data: any = { state: target }
    // [v3.0.6.11-104 Wave 3D] 再次退回质控 → 重置重拍审批状态 (需重新申请/审批)
    if (target === 'QC_REJECT') {
      data.retakeStatus = null
      data.retakeApprover = null
      data.retakeApprovedAt = null
    }
    if (opts?.rating !== undefined) data.qualityRating = opts.rating
    if (opts?.techNote !== undefined) data.techNotes = opts.techNote
    const qcNote = opts?.qcNote ?? note
    if (qcNote !== undefined) data.qcNotes = qcNote
    const result = await this.updateExam(id, data, { patient: true, device: true })
    this.notifyWorklistChanged(`qc=${state}${qcNote ? `:${qcNote}` : ''}`, id)
    return result
  }

  /**
   * [v3.0.6.11-104 Wave 3D] POST /worklist/:id/retake-request — 提交重拍申请。
   * 仅 QC_REJECT 且当前无待审批申请时可提交; 写入 retakeStatus='pending' + 原因/申请人/备注 (内存回退)。
   */
  async requestRetake(id: string, dto: { reason?: string; applicant?: string; note?: string }) {
    const exam = await this.getExam(id)
    if (exam.state !== 'QC_REJECT') {
      throw new BadRequestException(`Exam ${id} 当前状态 ${exam.state} 不允许提交重拍申请 (仅 QC_REJECT)`)
    }
    const existing = (exam as any).retakeStatus as string | undefined
    if (existing === 'pending') {
      throw new BadRequestException(`RETAKE_DUPLICATE: Exam ${id} 已有待审批的重拍申请`)
    }
    const data: Record<string, unknown> = {
      retakeStatus: 'pending',
      retakeRequestedBy: dto.applicant ?? 'current-user',
      retakeRequestedAt: new Date().toISOString(),
      retakeRequestNote: dto.note ?? null,
      retakeApprover: null,
      retakeApprovedAt: null,
      retakeReviewNote: null,
    }
    // [v3.0.6.11-100 Wave 1B] 重拍原因: 申请时落库 + 历史 retakeReasons[] (统计维度)
    if (dto.reason) {
      data.retakeReason = dto.reason
      const prev = Array.isArray((exam as any).retakeReasons) ? (exam as any).retakeReasons as string[] : []
      data.retakeReasons = [...prev, dto.reason]
    }
    const result = await this.updateExam(id, data, { patient: true, device: true })
    this.notifyWorklistChanged(`retake-request:${dto.reason ?? 'other'}`, id)
    return result
  }

  /**
   * [v3.0.6.11-104 Wave 3D] POST /worklist/:id/retake-approve — 审批重拍申请 (通过/驳回)。
   * 仅 pending 申请可审批; approved 后方可 QC_REJECT → IN_PROGRESS (assertRetakeApproved 门禁)。
   */
  async approveRetake(id: string, dto: { approved: boolean; approver?: string; opinion?: string }) {
    const exam = await this.getExam(id)
    const status = (exam as any).retakeStatus as string | undefined
    if (status !== 'pending') {
      throw new BadRequestException(`RETAKE_NOT_PENDING: Exam ${id} 当前无待审批的重拍申请 (retakeStatus=${status ?? 'none'})`)
    }
    const data: Record<string, unknown> = {
      retakeStatus: dto.approved ? 'approved' : 'rejected',
      retakeApprover: dto.approver ?? 'current-user',
      retakeApprovedAt: new Date().toISOString(),
      retakeReviewNote: dto.opinion ?? null,
    }
    const result = await this.updateExam(id, data, { patient: true, device: true })
    this.notifyWorklistChanged(`retake-${dto.approved ? 'approved' : 'rejected'}`, id)
    return result
  }

  // ============ [v3.0.6.11-99 Wave 10D] 总览 / 模态分组 / 时间线 / 技师备注 / 技师维度 ============

  /** 本地时区 YYYY-MM-DD (避免 toISOString UTC 跨日错位) */
  private dateKey(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  /**
   * GET /worklist/overview — 今日总览: 按状态 / 按模态 / 按房间计数。
   * 数据源: exam (state/modality + device.location 派生房间), completedAt 统计今日完成;
   * 无数据 (空库/表不可用) 时确定性 seed 回退 (风格与 getStats byTechnician 一致)。
   */
  async getOverview() {
    const tenantId = currentTenantId()
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const where = { tenantId }
    try {
      const [byStateRows, byModalityRows, completedToday, todayExams, todayDurations] = await Promise.all([
        this.prisma.exam.groupBy({ by: ['state'], where, _count: { _all: true } }),
        this.prisma.exam.groupBy({ by: ['modality'], where, _count: { _all: true } }),
        this.prisma.exam.count({ where: { ...where, completedAt: { gte: start } } }),
        this.prisma.exam.findMany({
          where: { ...where, scheduledAt: { gte: start } },
          select: { id: true, state: true, modality: true, device: { select: { location: true, name: true } } },
        }),
        this.prisma.exam.findMany({
          where: { ...where, completedAt: { gte: start }, startedAt: { not: null } },
          select: { startedAt: true, completedAt: true },
        }),
      ])
      const byStatus: Record<string, number> = {}
      for (const g of byStateRows) byStatus[g.state] = g._count._all
      const byModality = byModalityRows
        .map((g) => ({ modality: g.modality, count: g._count._all }))
        .sort((a, b) => b.count - a.count)
      const roomMap = new Map<string, { room: string; count: number; completed: number; inProgress: number }>()
      for (const e of todayExams) {
        const room = (e as any).device?.location ?? '未分配'
        const entry = roomMap.get(room) ?? { room, count: 0, completed: 0, inProgress: 0 }
        entry.count += 1
        if (e.state === 'COMPLETED') entry.completed += 1
        if (e.state === 'IN_PROGRESS') entry.inProgress += 1
        roomMap.set(room, entry)
      }
      const byRoom = [...roomMap.values()].sort((a, b) => b.count - a.count)
      const total = Object.values(byStatus).reduce((a, b) => a + b, 0)
      if (total === 0 && todayExams.length === 0) return this.seedOverview()
      // 今日分时段工作量: 按预约/创建小时分布 (08:00-20:00 为主检时段)
      const byHour = new Array(24).fill(0)
      for (const e of todayExams) {
        const ts = (e as any).scheduledAt ?? (e as any).createdAt
        if (ts instanceof Date) byHour[ts.getHours()] += 1
      }
      let peakHour = 9
      for (let h = 0; h < 24; h++) {
        if (byHour[h]! > byHour[peakHour]!) peakHour = h
      }
      // 今日平均检查时长 (分钟) + 完成率
      const todayDurs = todayDurations
        .map((e) => (e.completedAt!.getTime() - e.startedAt!.getTime()) / 60000)
        .filter((m) => Number.isFinite(m) && m >= 0)
      const avgDurationMin = todayDurs.length > 0 ? Math.round(todayDurs.reduce((a, b) => a + b, 0) / todayDurs.length) : 0
      const todayTotal = todayExams.length
      const completedRate = todayTotal > 0 ? Number(((completedToday / todayTotal) * 100).toFixed(1)) : 0
      return {
        date: this.dateKey(start),
        total,
        todayTotal,
        completedToday,
        completedRate,
        avgDurationMin,
        byStatus,
        byModality,
        byRoom,
        byHour: byHour.map((count, hour) => ({ hour: `${String(hour).padStart(2, '0')}:00`, count })),
        peakHour: `${String(peakHour).padStart(2, '0')}:00`,
      }
    } catch (err) {
      this.logger.warn(`[Worklist] getOverview failed, fallback seed: ${(err as Error)?.message}`)
      return this.seedOverview()
    }
  }

  /** 确定性 seed: 空库/表不可用时的今日总览 (与前端工作列表看板形状对齐) */
  private seedOverview() {
    return {
      date: this.dateKey(new Date()),
      total: 86,
      todayTotal: 31,
      completedToday: 12,
      completedRate: 38.7,
      avgDurationMin: 26,
      byStatus: { SCHEDULED: 12, ARRIVED: 5, IN_PROGRESS: 8, PAUSED: 2, COMPLETED: 46, CANCELLED: 3 },
      byModality: [
        { modality: 'CT', count: 20 },
        { modality: 'MR', count: 15 },
        { modality: 'DR', count: 12 },
        { modality: 'US', count: 10 },
        { modality: 'MG', count: 3 },
      ],
      byRoom: [
        { room: 'CT室1', count: 14, completed: 6, inProgress: 2 },
        { room: 'MR室1', count: 10, completed: 4, inProgress: 1 },
        { room: 'DR室1', count: 9, completed: 5, inProgress: 1 },
        { room: '超声室', count: 8, completed: 3, inProgress: 2 },
        { room: '未分配', count: 5, completed: 2, inProgress: 0 },
      ],
      byHour: Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, '0')}:00`, count: h >= 8 && h <= 18 ? 2 + ((h * 3) % 5) : 0 })),
      peakHour: '10:00',
    }
  }

  /**
   * GET /worklist/by-modality — 模态维度分组列表: 每模态 总数/进行中/已完成/平均时长。
   * 数据源: exam groupBy(modality+state) + 已完成检查 duration 派生; 空数据 seed 回退。
   */
  async getByModality() {
    const where = { tenantId: currentTenantId() }
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    try {
      const [rows, completed] = await Promise.all([
        this.prisma.exam.groupBy({ by: ['modality', 'state'], where, _count: { _all: true } }),
        this.prisma.exam.findMany({
          where: { ...where, state: 'COMPLETED', startedAt: { not: null }, completedAt: { not: null } },
          select: { modality: true, startedAt: true, completedAt: true },
        }),
      ])
      const durByModality = new Map<string, number[]>()
      const todayByModality = new Map<string, number>()
      for (const e of completed) {
        const m = (e.completedAt!.getTime() - e.startedAt!.getTime()) / 60000
        if (Number.isFinite(m) && m >= 0) {
          const arr = durByModality.get(e.modality) ?? []
          arr.push(m)
          durByModality.set(e.modality, arr)
        }
        if (e.completedAt! >= todayStart) {
          todayByModality.set(e.modality, (todayByModality.get(e.modality) ?? 0) + 1)
        }
      }
      const totals = new Map<string, { total: number; inProgress: number; completed: number }>()
      for (const r of rows) {
        const entry = totals.get(r.modality) ?? { total: 0, inProgress: 0, completed: 0 }
        entry.total += r._count._all
        if (r.state === 'IN_PROGRESS') entry.inProgress += r._count._all
        if (r.state === 'COMPLETED') entry.completed += r._count._all
        totals.set(r.modality, entry)
      }
      const items = [...totals.entries()]
        .map(([modality, t]) => {
          const durs = durByModality.get(modality) ?? []
          return {
            modality,
            total: t.total,
            inProgress: t.inProgress,
            completed: t.completed,
            pending: t.total - t.inProgress - t.completed,
            todayCompleted: todayByModality.get(modality) ?? 0,
            avgDurationMin: durs.length > 0 ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0,
          }
        })
        .sort((a, b) => b.total - a.total)
      if (items.length === 0) {
        return {
          items: [
            { modality: 'CT', total: 20, inProgress: 3, completed: 14, pending: 3, todayCompleted: 5, avgDurationMin: 18 },
            { modality: 'MR', total: 15, inProgress: 2, completed: 10, pending: 3, todayCompleted: 3, avgDurationMin: 32 },
            { modality: 'DR', total: 12, inProgress: 1, completed: 9, pending: 2, todayCompleted: 3, avgDurationMin: 8 },
            { modality: 'US', total: 10, inProgress: 2, completed: 6, pending: 2, todayCompleted: 1, avgDurationMin: 15 },
          ],
          total: 4,
        }
      }
      return { items, total: items.length }
    } catch (err) {
      this.logger.warn(`[Worklist] getByModality failed, fallback seed: ${(err as Error)?.message}`)
      return {
        items: [
          { modality: 'CT', total: 20, inProgress: 3, completed: 14, pending: 3, todayCompleted: 5, avgDurationMin: 18 },
          { modality: 'MR', total: 15, inProgress: 2, completed: 10, pending: 3, todayCompleted: 3, avgDurationMin: 32 },
          { modality: 'DR', total: 12, inProgress: 1, completed: 9, pending: 2, todayCompleted: 3, avgDurationMin: 8 },
        ],
        total: 3,
      }
    }
  }

  /**
   * GET /worklist/timeline/:id — 检查时间线: 登记→预约→签到→开始→暂停→恢复→完成→质控 事件流。
   * 数据源: exam 时间字段 (createdAt/scheduledAt/startedAt/pausedAt/completedAt/retakeCount/qualityRating/qcNotes)
   *   + worklistOp 操作日志 (START/COMPLETE/ASSIGN/CANCEL...) + auditLog (resource=exam) 派生;
   *   ops/audit 表不可用时不阻断 (与 getById 的 ops 查询同风格)。
   */
  async getTimeline(id: string) {
    const exam = await this.getExam(id)
    const tenantId = currentTenantId()
    type TLEvent = { type: string; label: string; timestamp: string; actor?: string; note?: string }
    const events: TLEvent[] = []
    const push = (type: string, label: string, ts?: Date | null, opts?: { actor?: string; note?: string }) => {
      if (!ts) return
      events.push({ type, label, timestamp: ts.toISOString(), actor: opts?.actor, note: opts?.note })
    }
    push('register', '登记建档', exam.createdAt)
    push('scheduled', '预约排程', exam.scheduledAt, { note: `模态 ${exam.modality} / ${exam.bodyPart}` })
    push('checkin', '签到', exam.startedAt, { note: 'SCHEDULED → ARRIVED' })
    if (['IN_PROGRESS', 'PAUSED', 'COMPLETED', 'IMAGE_READY', 'QC_REJECT', 'QC_PASS', 'PENDING_REPORT'].includes(exam.state)) {
      push('start', '检查开始', exam.startedAt, { note: 'ARRIVED → IN_PROGRESS' })
    }
    push('pause', '暂停检查', exam.pausedAt)
    if (exam.pausedAt && ['IN_PROGRESS', 'COMPLETED', 'IMAGE_READY', 'QC_PASS', 'PENDING_REPORT'].includes(exam.state)) {
      push('resume', '恢复检查', exam.pausedAt, { note: 'PAUSED → IN_PROGRESS' })
    }
    push('complete', '完成检查', exam.completedAt)
    const retakeCount = Number((exam as any).retakeCount ?? 0)
    if (retakeCount > 0) {
      push('retake', '重拍登记', exam.completedAt ?? exam.pausedAt ?? exam.startedAt, { note: `共重拍 ${retakeCount} 次` })
    }
    const rating = (exam as any).qualityRating
    if (rating) {
      push('qc-rating', '质控评级', exam.completedAt ?? exam.createdAt, { note: `评级: ${rating}` })
    }
    const qcNote = (exam as any).qcNotes
    if (qcNote) {
      push('qc-note', '质控备注', exam.completedAt ?? exam.createdAt, { note: String(qcNote).slice(0, 200) })
    }
    const opLabels: Record<string, string> = { START: '开始检查', COMPLETE: '完成检查', CANCEL: '取消检查', ASSIGN: '分配报告医生', REASSIGN: '重新分配', PRINT: '打印报告', EXPORT: '导出报告' }
    try {
      const ops = await this.prisma.worklistOp.findMany({
        where: { examId: id, tenantId },
        orderBy: { createdAt: 'asc' },
        select: { op: true, createdAt: true, payload: true, actor: { select: { fullName: true } } },
      })
      for (const op of ops) {
        push('op', opLabels[op.op] ?? String(op.op), op.createdAt, { actor: op.actor?.fullName ?? undefined })
      }
    } catch { /* ops 表不可用不阻断 */ }
    try {
      const audit = await this.prisma.auditLog.findMany({
        where: { resource: 'exam', resourceId: id },
        orderBy: { createdAt: 'asc' },
        select: { action: true, createdAt: true, userId: true, detail: true },
      })
      for (const a of audit) {
        push('audit', `审计: ${a.action}`, a.createdAt, { actor: a.userId ?? undefined })
      }
    } catch { /* audit 表不可用不阻断 */ }
    events.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))
    return {
      examId: exam.id,
      accessionNumber: exam.accessionNumber,
      patientId: exam.patientId,
      patientName: (exam as any).patient?.name ?? '',
      patientPhone: (exam as any).patient?.phone ?? '',
      patientGender: (exam as any).patient?.gender ?? '',
      modality: exam.modality,
      bodyPart: exam.bodyPart,
      state: exam.state,
      totalEvents: events.length,
      events,
    }
  }

  /**
   * POST /worklist/:id/notes — 技师备注保存: 追加到 techNotes (带时间戳), 新列 DB 未迁移时回退内存。
   */
  async saveNotes(id: string, note: string, opts?: { latest?: boolean }) {
    const exam = await this.getExam(id)
    const trimmed = note?.trim()
    if (!trimmed) throw new BadRequestException('备注内容不能为空')
    const timeLabel = new Date().toLocaleString('zh-CN', { hour12: false })
    const existing = String((exam as any).techNotes ?? '')
    const merged = opts?.latest ? trimmed : [existing, `[${timeLabel}] ${trimmed}`].filter(Boolean).join('\n')
    await this.updateExam(id, { techNotes: merged }, { patient: true })
    this.notifyWorklistChanged('notes', id)
    return { ok: true, examId: id, techNotes: merged }
  }

  /**
   * GET /worklist/technician-stats — 技师维度明细: 完成数 / 平均时长 / 重拍数 (getStats byTechnician 扩展 detail)。
   * 数据源: worklistOp (START/COMPLETE 归属操作人) + exam (duration/retakeCount) 派生; 无记录 seed 回退。
   */
  async getTechnicianStats() {
    const where = { tenantId: currentTenantId() }
    try {
      const [ops, completed, retakes] = await Promise.all([
        this.prisma.worklistOp.findMany({
          where: { tenantId: currentTenantId(), op: { in: ['START', 'COMPLETE'] } },
          select: { id: true, op: true, examId: true, actorId: true, actor: { select: { id: true, fullName: true } } },
        }),
        this.prisma.exam.findMany({
          where: { ...where, state: 'COMPLETED', startedAt: { not: null }, completedAt: { not: null } },
          select: { id: true, startedAt: true, completedAt: true, retakeCount: true },
        }),
        this.prisma.exam.findMany({
          where: { ...where, retakeCount: { gt: 0 } },
          select: { id: true, retakeCount: true },
        }),
      ])
      const durByExam = new Map(completed.map((e) => [e.id, e]))
      const retakeByExam = new Map(retakes.map((e) => [e.id, Number(e.retakeCount ?? 0)]))
      const map = new Map<string, { id: string; name: string; completedCount: number; retakeCount: number; durations: number[] }>()
      for (const op of ops) {
        const entry = map.get(op.actorId) ?? { id: op.actorId, name: op.actor?.fullName ?? '未知技师', completedCount: 0, retakeCount: 0, durations: [] }
        if (op.op === 'COMPLETE') entry.completedCount += 1
        if (op.examId) entry.retakeCount += retakeByExam.get(op.examId) ?? 0
        const dur = op.examId ? durByExam.get(op.examId) : undefined
        if (dur) {
          const m = (dur.completedAt!.getTime() - dur.startedAt!.getTime()) / 60000
          if (Number.isFinite(m) && m >= 0) entry.durations.push(m)
        }
        map.set(op.actorId, entry)
      }
      const technicians = [...map.values()].map((t) => ({
        id: t.id,
        name: t.name,
        completedCount: t.completedCount,
        retakeCount: t.retakeCount,
        avgDurationMin: t.durations.length > 0 ? Math.round(t.durations.reduce((a, b) => a + b, 0) / t.durations.length) : 0,
      })).sort((a, b) => b.completedCount - a.completedCount)
      if (technicians.length === 0) return this.seedTechnicianStats()
      const totalCompleted = technicians.reduce((a, t) => a + t.completedCount, 0)
      const totalRetake = technicians.reduce((a, t) => a + t.retakeCount, 0)
      const totalDurations = [...durByExam.values()].map((e) => (e.completedAt!.getTime() - e.startedAt!.getTime()) / 60000).filter((m) => Number.isFinite(m) && m >= 0)
      return {
        summary: {
          totalCompleted,
          totalRetake,
          avgDurationMin: totalDurations.length > 0 ? Math.round(totalDurations.reduce((a, b) => a + b, 0) / totalDurations.length) : 0,
          retakeRate: totalCompleted > 0 ? Number(((totalRetake / totalCompleted) * 100).toFixed(1)) : 0,
          technicianCount: technicians.length,
        },
        technicians,
      }
    } catch (err) {
      this.logger.warn(`[Worklist] getTechnicianStats failed, fallback seed: ${(err as Error)?.message}`)
      return this.seedTechnicianStats()
    }
  }

  private seedTechnicianStats() {
    return {
      summary: {
        totalCompleted: 19,
        totalRetake: 3,
        avgDurationMin: 26,
        retakeRate: 15.8,
        technicianCount: 3,
      },
      technicians: [
        { id: 'tech-seed-1', name: '王技师', completedCount: 9, retakeCount: 1, avgDurationMin: 24 },
        { id: 'tech-seed-2', name: '李技师', completedCount: 6, retakeCount: 0, avgDurationMin: 21 },
        { id: 'tech-seed-3', name: '张技师', completedCount: 4, retakeCount: 2, avgDurationMin: 30 },
      ],
    }
  }

  // ============ [v3.0.6.11-100 Wave 1B] 检查间实时状态看板 / 重拍率统计 ============

  /**
   * GET /worklist/room-status — 房间级实时状态看板。
   * 数据源: 全部未归档 exam (state/modality/device.location 派生房间) + device 表 (房间名/模态)。
   * 状态派生: 房间有 IN_PROGRESS → in_use; 有 PAUSED → paused; 队列有 ARRIVED 且最早到达超 30min → overdue;
   *   其余有队列 → waiting; 无 → idle。idleSince = 房间最近活动时间 (最后检查开始/完成)。
   * 无数据 (空库/表不可用) 时确定性 seed 回退 (风格与 getOverview 一致)。
   */
  async getRoomStatus() {
    const tenantId = currentTenantId()
    try {
      const [exams, devices] = await Promise.all([
        this.prisma.exam.findMany({
          where: { tenantId, state: { notIn: ['COMPLETED', 'CANCELLED'] } },
          include: { device: true },
        }),
        this.prisma.device.findMany({ where: { tenantId }, select: { id: true, name: true, modality: true, location: true } }),
      ])
      // 房间基座: device.location 唯一 (未分配设备 fallback '未分配')
      const roomMap = new Map<string, { roomId: string; name: string; modality: string; queue: typeof exams; lastActivityAt: number }>()
      for (const d of devices) {
        const key = d.location?.trim() || '未分配'
        const roomId = `room-${key}`
        if (!roomMap.has(roomId)) {
          roomMap.set(roomId, { roomId, name: key, modality: d.modality, queue: [], lastActivityAt: 0 })
        }
      }
      // 有检查但无设备记录的房间 (worklist 列表派生兜底)
      const now = Date.now()
      for (const e of exams) {
        const roomId = (e as any).device?.location?.trim() || '未分配'
        const entry = roomMap.get(`room-${roomId}`) ?? {
          roomId: `room-${roomId}`,
          name: roomId,
          modality: (e as any).device?.modality ?? e.modality,
          queue: [],
          lastActivityAt: 0,
        }
        roomMap.set(entry.roomId, entry)
      }
      for (const e of exams) {
        const roomId = (e as any).device?.location?.trim() || '未分配'
        const entry = roomMap.get(`room-${roomId}`)
        if (!entry) continue
        entry.queue.push(e)
        for (const ts of [e.startedAt, e.completedAt]) {
          if (ts instanceof Date && ts.getTime() > entry.lastActivityAt) entry.lastActivityAt = ts.getTime()
        }
      }
      const rooms: Array<{
        roomId: string
        name: string
        modality: string
        currentExam: { id: string; patientName: string; state: string; startedAt: string | null } | null
        queueLength: number
        status: 'in_use' | 'paused' | 'overdue' | 'waiting' | 'idle'
        idleSince: string | null
      }> = []
      for (const entry of roomMap.values()) {
        const active = entry.queue.find((e) => ['IN_PROGRESS', 'PAUSED'].includes(e.state))
        const inProgress = entry.queue.filter((e) => e.state === 'IN_PROGRESS')
        const paused = entry.queue.filter((e) => e.state === 'PAUSED')
        const arrived = entry.queue
          .filter((e) => e.state === 'ARRIVED')
          .sort((a, b) => new Date(a.startedAt ?? a.createdAt).getTime() - new Date(b.startedAt ?? b.createdAt).getTime())
        const firstArrived = arrived[0]
        const overdue = firstArrived && new Date(firstArrived.startedAt ?? firstArrived.createdAt).getTime() < now - 30 * 60000
        let status: 'in_use' | 'paused' | 'overdue' | 'waiting' | 'idle'
        if (inProgress.length > 0) status = 'in_use'
        else if (paused.length > 0) status = 'paused'
        else if (overdue) status = 'overdue'
        else if (arrived.length > 0 || entry.queue.length > 0) status = 'waiting'
        else status = 'idle'
        const current = active ?? inProgress[0] ?? paused[0] ?? arrived[0] ?? undefined
        rooms.push({
          roomId: entry.roomId,
          name: entry.name,
          modality: entry.modality,
          currentExam: current
            ? {
                id: current.id,
                patientName: (current as any).patient?.name ?? '未知患者',
                state: current.state,
                startedAt: current.startedAt ? current.startedAt.toISOString() : null,
              }
            : null,
          queueLength: entry.queue.length,
          status,
          idleSince: entry.lastActivityAt > 0 ? new Date(entry.lastActivityAt).toISOString() : null,
        })
      }
      rooms.sort((a, b) => {
        const order: Record<string, number> = { in_use: 0, overdue: 1, paused: 2, waiting: 3, idle: 4 }
        return (order[a.status] ?? 9) - (order[b.status] ?? 9)
      })
      if (rooms.length === 0) return this.seedRoomStatus()
      return { rooms, updatedAt: new Date().toISOString() }
    } catch (err) {
      this.logger.warn(`[Worklist] getRoomStatus failed, fallback seed: ${(err as Error)?.message}`)
      return this.seedRoomStatus()
    }
  }

  /** 确定性 seed: 空库/表不可用时的房间状态看板 */
  private seedRoomStatus() {
    const now = new Date()
    return {
      rooms: [
        { roomId: 'room-CT室1', name: 'CT室1', modality: 'CT', currentExam: { id: 'seed-exam-1', patientName: '张伟', state: 'IN_PROGRESS', startedAt: new Date(now.getTime() - 12 * 60000).toISOString() }, queueLength: 4, status: 'in_use', idleSince: null },
        { roomId: 'room-MR室1', name: 'MR室1', modality: 'MR', currentExam: null, queueLength: 3, status: 'waiting', idleSince: new Date(now.getTime() - 18 * 60000).toISOString() },
        { roomId: 'room-DR室1', name: 'DR室1', modality: 'DR', currentExam: { id: 'seed-exam-2', patientName: '李婷', state: 'PAUSED', startedAt: new Date(now.getTime() - 40 * 60000).toISOString() }, queueLength: 2, status: 'paused', idleSince: null },
        { roomId: 'room-超声室', name: '超声室', modality: 'US', currentExam: null, queueLength: 1, status: 'overdue', idleSince: new Date(now.getTime() - 75 * 60000).toISOString() },
        { roomId: 'room-未分配', name: '未分配', modality: '—', currentExam: null, queueLength: 0, status: 'idle', idleSince: new Date(now.getTime() - 90 * 60000).toISOString() },
      ],
      updatedAt: now.toISOString(),
    }
  }

  /** 重拍原因枚举 (对齐前端下拉) */
  static readonly RETAKE_REASONS = ['motion_artifact', 'positioning', 'wrong_protocol', 'contrast_issue', 'equipment', 'other'] as const
  static readonly RETAKE_REASON_LABELS: Record<string, string> = {
    motion_artifact: '运动伪影',
    positioning: '摆位不当',
    wrong_protocol: '扫描协议错误',
    contrast_issue: '对比剂问题',
    equipment: '设备故障',
    other: '其他',
  }

  // [v3.0.6.11-104 Wave 3D] 重拍审批状态标签 (统计下钻)
  static readonly RETAKE_STATUS_LABELS: Record<string, string> = {
    pending: '待审批',
    approved: '已通过',
    rejected: '已驳回',
  }

  /**
   * GET /worklist/retake-stats?from=&to=&dimension=tech|modality|reason|approver|status — 重拍率统计 + 原因分类。
   * 数据源: exam (retakeCount/retakeReason/retakeReasons + retakeStatus/retakeApprover 派生) + worklistOp (COMPLETE 归属技师);
   * from/to 缺省 = 最近 30 天。无数据时确定性 seed 回退 (风格与 getTechnicianStats 一致)。
   * [v3.0.6.11-104 Wave 3D] + approver/status 维度下钻, 并附 approvalSummary (待审批/已通过/已驳回)。
   */
  async getRetakeStats(params: { from?: string; to?: string; dimension?: 'tech' | 'modality' | 'reason' | 'approver' | 'status' }) {
    const tenantId = currentTenantId()
    const to = params.to ? new Date(params.to) : new Date()
    const from = params.from ? new Date(params.from) : new Date(to.getTime() - 29 * 86400000)
    const dimension = params.dimension ?? 'reason'
    try {
      const [exams, ops] = await Promise.all([
        this.prisma.exam.findMany({
          where: { tenantId },
          include: { device: { select: { id: true, name: true } } },
        }),
        this.prisma.worklistOp.findMany({
          where: { tenantId: currentTenantId(), op: 'COMPLETE' },
          select: { examId: true, actorId: true, actor: { select: { fullName: true } } },
        }),
      ])
      const techByExam = new Map<string, { id: string; name: string }>()
      for (const op of ops) {
        if (op.examId && !techByExam.has(op.examId)) {
          techByExam.set(op.examId, { id: op.actorId, name: op.actor?.fullName ?? '未知技师' })
        }
      }
      const completed = exams.filter((e) => e.completedAt && e.completedAt >= from && e.completedAt <= to)
      const retakes = completed.filter((e) => Number((e as any).retakeCount ?? 0) > 0)
      // 每日趋势
      const dayMap = new Map<string, { date: string; completed: number; retakes: number }>()
      const pushDay = (d: Date) => {
        const key = this.dateKey(d)
        if (!dayMap.has(key)) dayMap.set(key, { date: key, completed: 0, retakes: 0 })
      }
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) pushDay(d)
      for (const e of completed) {
        const key = this.dateKey(e.completedAt!)
        if (!dayMap.has(key)) dayMap.set(key, { date: key, completed: 0, retakes: 0 })
        dayMap.get(key)!.completed += 1
      }
      for (const e of retakes) {
        const key = this.dateKey(e.completedAt!)
        if (!dayMap.has(key)) dayMap.set(key, { date: key, completed: 0, retakes: 0 })
        dayMap.get(key)!.retakes += Number((e as any).retakeCount ?? 1)
      }
      const trend = [...dayMap.values()]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((t) => ({ ...t, rate: t.completed > 0 ? Number(((t.retakes / t.completed) * 100).toFixed(1)) : 0 }))

      // [v3.0.6.11-104 Wave 3D] 审批状态计数 (全域, 不受 dimension 影响)
      const approvalSummary = { pending: 0, approved: 0, rejected: 0 }
      for (const e of retakes) {
        const st = String((e as any).retakeStatus ?? 'unknown')
        if (st === 'pending' || st === 'approved' || st === 'rejected') approvalSummary[st] += 1
      }

      const keyOf = (e: (typeof exams)[number]): { key: string; label: string } => {
        if (dimension === 'tech') {
          const t = techByExam.get(e.id) ?? { id: 'unassigned', name: '未归属' }
          return { key: t.id, label: t.name }
        }
        if (dimension === 'modality') return { key: e.modality ?? '其他', label: e.modality ?? '其他' }
        if (dimension === 'approver') {
          const approver = String((e as any).retakeApprover ?? '') || undefined
          return { key: approver ?? 'unapproved', label: approver ?? '未审批' }
        }
        if (dimension === 'status') {
          const st = String((e as any).retakeStatus ?? '') || undefined
          return { key: st ?? 'unknown', label: st ? WorklistService.RETAKE_STATUS_LABELS[st] ?? st : '未提交申请' }
        }
        const reason = String((e as any).retakeReason ?? '') || undefined
        const latest = (Array.isArray((e as any).retakeReasons) ? (e as any).retakeReasons as string[] : []).at(-1)
        const code = reason ?? latest
        return { key: code ?? 'unknown', label: code ? WorklistService.RETAKE_REASON_LABELS[code] ?? code : '未分类' }
      }
      const map = new Map<string, { key: string; label: string; completed: number; retakes: number }>()
      for (const e of completed) {
        const { key, label } = keyOf(e)
        const entry = map.get(key) ?? { key, label, completed: 0, retakes: 0 }
        entry.completed += 1
        if (Number((e as any).retakeCount ?? 0) > 0) entry.retakes += Number((e as any).retakeCount)
        map.set(key, entry)
      }
      const breakdown = [...map.values()]
        .map((b) => ({ ...b, rate: b.completed > 0 ? Number(((b.retakes / b.completed) * 100).toFixed(1)) : 0 }))
        .sort((a, b) => b.retakes - a.retakes)
      const totalCompleted = completed.length
      const totalRetakes = retakes.reduce((a, e) => a + Number((e as any).retakeCount ?? 0), 0)
      const summary = {
        totalCompleted,
        totalRetakes,
        retakeRate: totalCompleted > 0 ? Number(((totalRetakes / totalCompleted) * 100).toFixed(1)) : 0,
        examRetakeCount: retakes.length,
      }
      if (totalCompleted === 0 && exams.length === 0) {
        return this.seedRetakeStats(from, to, dimension)
      }
      return { from: from.toISOString(), to: to.toISOString(), dimension, summary, trend, breakdown, approvalSummary }
    } catch (err) {
      this.logger.warn(`[Worklist] getRetakeStats failed, fallback seed: ${(err as Error)?.message}`)
      return this.seedRetakeStats(from, to, dimension)
    }
  }

  /** 确定性 seed: 空库/表不可用时的重拍统计 */
  private seedRetakeStats(from: Date, to: Date, dimension: string) {
    const days = Math.max(1, Math.min(30, Math.round((to.getTime() - from.getTime()) / 86400000) + 1))
    const trend = Array.from({ length: days }, (_, i) => {
      const d = new Date(from.getTime() + i * 86400000)
      const completed = 8 + ((i * 5) % 7)
      const retakes = i % 3 === 0 ? 2 : i % 5 === 0 ? 1 : 0
      return { date: this.dateKey(d), completed, retakes, rate: completed > 0 ? Number(((retakes / completed) * 100).toFixed(1)) : 0 }
    })
    const base: Record<string, { key: string; label: string; completed: number; retakes: number }> =
      dimension === 'tech'
        ? {
            'tech-seed-1': { key: 'tech-seed-1', label: '王技师', completed: 9, retakes: 1 },
            'tech-seed-2': { key: 'tech-seed-2', label: '李技师', completed: 6, retakes: 0 },
            'tech-seed-3': { key: 'tech-seed-3', label: '张技师', completed: 4, retakes: 2 },
          }
        : dimension === 'modality'
          ? {
              CT: { key: 'CT', label: 'CT', completed: 20, retakes: 2 },
              MR: { key: 'MR', label: 'MR', completed: 15, retakes: 3 },
              DR: { key: 'DR', label: 'DR', completed: 12, retakes: 1 },
              US: { key: 'US', label: 'US', completed: 10, retakes: 0 },
            }
          : dimension === 'approver'
            ? {
                'approver-seed-1': { key: 'approver-seed-1', label: '赵主任', completed: 12, retakes: 3 },
                'approver-seed-2': { key: 'approver-seed-2', label: '钱技师', completed: 9, retakes: 2 },
                unapproved: { key: 'unapproved', label: '未审批', completed: 5, retakes: 1 },
              }
            : dimension === 'status'
              ? {
                  approved: { key: 'approved', label: '已通过', completed: 16, retakes: 4 },
                  rejected: { key: 'rejected', label: '已驳回', completed: 6, retakes: 1 },
                  pending: { key: 'pending', label: '待审批', completed: 4, retakes: 1 },
                }
              : {
                  motion_artifact: { key: 'motion_artifact', label: '运动伪影', completed: 18, retakes: 4 },
                  positioning: { key: 'positioning', label: '摆位不当', completed: 14, retakes: 2 },
                  wrong_protocol: { key: 'wrong_protocol', label: '扫描协议错误', completed: 10, retakes: 1 },
                  contrast_issue: { key: 'contrast_issue', label: '对比剂问题', completed: 8, retakes: 1 },
                  equipment: { key: 'equipment', label: '设备故障', completed: 6, retakes: 1 },
                  other: { key: 'other', label: '其他', completed: 5, retakes: 0 },
                }
    const breakdown = Object.values(base).map((b) => ({ ...b, rate: Number(((b.retakes / b.completed) * 100).toFixed(1)) }))
    const totalRetakes = breakdown.reduce((a, b) => a + b.retakes, 0)
    const totalCompleted = breakdown.reduce((a, b) => a + b.completed, 0)
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      dimension,
      summary: {
        totalCompleted,
        totalRetakes,
        retakeRate: totalCompleted > 0 ? Number(((totalRetakes / totalCompleted) * 100).toFixed(1)) : 0,
        examRetakeCount: 5,
      },
      trend,
      breakdown,
      // [v3.0.6.11-104 Wave 3D] 审批状态下钻 seed
      approvalSummary: { pending: 1, approved: 4, rejected: 1 },
    }
  }

  // ============ [v3.0.6.11-100 Wave 1A] 技师 KPI 看板 + 多技师协作 (主备技师/交接班) ============

  /**
   * 写 worklistOp 审计记录 (assign-technicians / handover)。
   * actorId 优先操作者, 缺失时回退 ADMIN 用户; 表不可用不阻断主流程。
   */
  private async recordOp(examId: string, op: 'ASSIGN' | 'REASSIGN', payload: Record<string, unknown>, fallbackActorId?: string | null) {
    try {
      let actorId = fallbackActorId || undefined
      if (!actorId) {
        const admin = await this.prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } })
        actorId = admin?.id
      }
      if (!actorId) return
      await this.prisma.worklistOp.create({
        data: { tenantId: currentTenantId(), actorId, op, examId, payload: payload as never },
      })
    } catch (err) {
      this.logger.warn(`[Worklist] recordOp failed: ${(err as Error)?.message}`)
    }
  }

  private async assertUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new BadRequestException(`User ${userId} not found`)
    return user
  }

  /**
   * POST /worklist/:id/assign-technicians — 主备技师分配。
   * { primaryId?, backupId? } 至少一项; 存 examExtras/DB 新列 + worklistOp ASSIGN 记录。
   */
  async assignTechnicians(id: string, dto: { primaryId?: string; backupId?: string }) {
    if (!dto.primaryId && !dto.backupId) throw new BadRequestException('primaryId or backupId is required')
    await this.getExam(id)
    if (dto.primaryId) await this.assertUser(dto.primaryId)
    if (dto.backupId) await this.assertUser(dto.backupId)
    const data: Record<string, unknown> = {}
    if (dto.primaryId) data.primaryTechnicianId = dto.primaryId
    if (dto.backupId) data.backupTechnicianId = dto.backupId
    const result = await this.updateExam(id, data, { patient: true, device: true })
    await this.recordOp(id, 'ASSIGN', { action: 'ASSIGN_TECHNICIANS', primaryId: dto.primaryId ?? null, backupId: dto.backupId ?? null }, dto.primaryId ?? dto.backupId)
    this.notifyWorklistChanged('assign-technicians', id)
    return { ...result, primaryTechnicianId: (result as any).primaryTechnicianId ?? null, backupTechnicianId: (result as any).backupTechnicianId ?? null }
  }

  /**
   * POST /worklist/:id/handover — 交接班: 主技师 → toId (备技师保留), 记录 worklistOp REASSIGN。
   */
  async handover(id: string, dto: { fromId: string; toId: string; note?: string }) {
    const exam = await this.getExam(id)
    await this.assertUser(dto.fromId)
    await this.assertUser(dto.toId)
    const result = await this.updateExam(
      id,
      { primaryTechnicianId: dto.toId },
      { patient: true, device: true },
    )
    await this.recordOp(id, 'REASSIGN', { action: 'HANDOVER', fromId: dto.fromId, toId: dto.toId, note: dto.note ?? null }, dto.fromId)
    this.notifyWorklistChanged(`handover=${dto.fromId}->${dto.toId}`, id)
    return { ok: true, examId: id, fromId: dto.fromId, toId: dto.toId, note: dto.note ?? null, primaryTechnicianId: dto.toId }
  }

  /**
   * GET /worklist/technician-dashboard — 技师 KPI 看板:
   * { from, to, technicianId? } → 每技师 完成数/平均时长/重拍率/平均等待/设备占用率/按时签到率 + totals + 每日完成趋势。
   * 数据源: worklistOp (START/COMPLETE 归属) + exam (duration/retakeCount/scheduledAt/deviceId) 派生; 无记录 seed 回退。
   */
  async getTechnicianDashboard(params: { from?: string; to?: string; technicianId?: string }) {
    const tenantId = currentTenantId()
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
    if (params.from && !DATE_RE.test(params.from)) throw new BadRequestException('from 日期格式非法 (YYYY-MM-DD)')
    if (params.to && !DATE_RE.test(params.to)) throw new BadRequestException('to 日期格式非法 (YYYY-MM-DD)')
    const from = params.from ? new Date(`${params.from}T00:00:00`) : undefined
    const to = params.to ? new Date(`${params.to}T00:00:00`) : undefined
    const opWhere: any = { tenantId, op: { in: ['START', 'COMPLETE'] } }
    const examWhere: any = { tenantId, state: 'COMPLETED' }
    if (from || to) {
      const range: Record<string, Date> = {}
      if (from) range.gte = from
      if (to) {
        const end = new Date(to)
        end.setDate(end.getDate() + 1)
        range.lt = end
      }
      opWhere.createdAt = range
      examWhere.completedAt = range
    }
    if (params.technicianId) opWhere.actorId = params.technicianId
    try {
      const [ops, completed, userRows] = await Promise.all([
        this.prisma.worklistOp.findMany({
          where: opWhere,
          select: { id: true, op: true, examId: true, actorId: true, actor: { select: { id: true, fullName: true } } },
        }),
        this.prisma.exam.findMany({
          where: examWhere,
          select: { id: true, startedAt: true, completedAt: true, scheduledAt: true, retakeCount: true, deviceId: true },
          take: 2000,
        }),
        params.technicianId
          ? Promise.resolve([])
          : this.prisma.user.findMany({ where: { role: 'TECHNICIAN', tenantId }, select: { id: true, fullName: true }, take: 200 }),
      ])
      const durByExam = new Map(completed.map((e) => [e.id, e]))
      const trendMap = new Map<string, number>()
      for (const e of completed) {
        if (!e.completedAt) continue
        const key = this.dateKey(e.completedAt)
        trendMap.set(key, (trendMap.get(key) ?? 0) + 1)
      }
      type Acc = {
        id: string; name: string; completedCount: number; retakeCount: number;
        durations: number[]; waits: number[]; devices: number; onTime: number;
      }
      const map = new Map<string, Acc>()
      const upsert = (actorId: string, fullName: string): Acc => {
        const entry = map.get(actorId) ?? {
          id: actorId, name: fullName, completedCount: 0, retakeCount: 0,
          durations: [], waits: [], devices: 0, onTime: 0,
        }
        map.set(actorId, entry)
        return entry
      }
      for (const op of ops) {
        if (op.op !== 'COMPLETE') continue
        const entry = upsert(op.actorId, op.actor?.fullName ?? '未知技师')
        entry.completedCount += 1
        const examRow = op.examId ? durByExam.get(op.examId) : undefined
        if (!examRow) continue
        entry.retakeCount += Number(examRow.retakeCount ?? 0)
        if (examRow.deviceId) entry.devices += 1
        if (examRow.startedAt && examRow.completedAt) {
          const m = (examRow.completedAt.getTime() - examRow.startedAt.getTime()) / 60000
          if (Number.isFinite(m) && m >= 0) entry.durations.push(m)
        }
        if (examRow.scheduledAt && examRow.startedAt) {
          const wait = (examRow.startedAt.getTime() - examRow.scheduledAt.getTime()) / 60000
          if (Number.isFinite(wait)) {
            entry.waits.push(Math.max(0, wait))
            if (wait <= 30) entry.onTime += 1
          }
        }
      }
      // 零 ops 时: 补上技师名单 (有 ops 归属的技师) 或全部在编技师
      if (map.size === 0) {
        for (const u of userRows) upsert(u.id, u.fullName)
      }
      const technicians = [...map.values()].map((t) => {
        const avgDurationMin = t.durations.length > 0 ? Math.round(t.durations.reduce((a, b) => a + b, 0) / t.durations.length) : 0
        const avgWaitTime = t.waits.length > 0 ? Math.round(t.waits.reduce((a, b) => a + b, 0) / t.waits.length) : 0
        return {
          id: t.id,
          name: t.name,
          completedCount: t.completedCount,
          avgDurationMin,
          retakeCount: t.retakeCount,
          retakeRate: t.completedCount > 0 ? Number(((t.retakeCount / t.completedCount) * 100).toFixed(1)) : 0,
          avgWaitTime,
          deviceUtilization: t.completedCount > 0 ? Number(((t.devices / t.completedCount) * 100).toFixed(1)) : 0,
          onTimeRate: t.waits.length > 0 ? Number(((t.onTime / t.waits.length) * 100).toFixed(1)) : 0,
        }
      }).sort((a, b) => b.completedCount - a.completedCount)
      if (technicians.length === 0 || technicians.every((t) => t.completedCount === 0 && t.name === '未知技师')) {
        return this.seedTechnicianDashboard(from, to)
      }
      const totalCompleted = technicians.reduce((a, t) => a + t.completedCount, 0)
      const totalRetake = technicians.reduce((a, t) => a + t.retakeCount, 0)
      // totals 从技师聚合派生 (respect technicianId 过滤)
      const sumWith = (pick: (t: (typeof technicians)[number]) => number) => technicians.reduce((a, t) => a + pick(t), 0)
      const wAvg = (pick: (t: (typeof technicians)[number]) => number) => {
        let total = 0
        for (const t of technicians) total += t.completedCount * pick(t)
        return totalCompleted > 0 ? Math.round(total / totalCompleted) : 0
      }
      const trendDays = this.trendDates(from, to)
      return {
        from: from ? this.dateKey(from) : undefined,
        to: to ? this.dateKey(new Date(to)) : undefined,
        technicians,
        totals: {
          completedCount: totalCompleted,
          avgDurationMin: wAvg((t) => t.avgDurationMin),
          retakeRate: totalCompleted > 0 ? Number(((totalRetake / totalCompleted) * 100).toFixed(1)) : 0,
          avgWaitTime: wAvg((t) => t.avgWaitTime),
          deviceUtilization: wAvg((t) => t.deviceUtilization),
          onTimeRate: wAvg((t) => t.onTimeRate),
        },
        trend: trendDays.map((date) => ({ date, completed: trendMap.get(date) ?? 0 })),
      }
    } catch (err) {
      this.logger.warn(`[Worklist] getTechnicianDashboard failed, fallback seed: ${(err as Error)?.message}`)
      return this.seedTechnicianDashboard(from, to)
    }
  }

  /** 趋势时间轴: 指定范围最多 31 天; 未指定时近 7 天 */
  private trendDates(from?: Date, to?: Date): string[] {
    const end = to ?? new Date()
    const start = from ?? new Date(end)
    if (!from) start.setDate(start.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    const out: string[] = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      out.push(this.dateKey(d))
      if (out.length >= 31) break
    }
    return out
  }

  private seedTechnicianDashboard(from?: Date, to?: Date) {
    const days = this.trendDates(from, to)
    const seed = (id: string, name: string, completedCount: number, avgDurationMin: number, retakeCount: number, avgWaitTime: number, deviceUtilization: number, onTimeRate: number) => ({
      id, name, completedCount, avgDurationMin, retakeCount,
      retakeRate: completedCount > 0 ? Number(((retakeCount / completedCount) * 100).toFixed(1)) : 0,
      avgWaitTime, deviceUtilization, onTimeRate,
    })
    const technicians = [
      seed('tech-seed-1', '王技师', 12, 24, 1, 12, 92, 87.5),
      seed('tech-seed-2', '李技师', 8, 21, 0, 15, 88, 75),
      seed('tech-seed-3', '张技师', 6, 30, 2, 20, 80, 66.7),
    ]
    const totalCompleted = technicians.reduce((a, t) => a + t.completedCount, 0)
    const totalRetake = technicians.reduce((a, t) => a + t.retakeCount, 0)
    return {
      from: from ? this.dateKey(from) : undefined,
      to: to ? this.dateKey(to) : undefined,
      technicians,
      totals: {
        completedCount: totalCompleted,
        avgDurationMin: 24,
        retakeRate: Number(((totalRetake / totalCompleted) * 100).toFixed(1)),
        avgWaitTime: 15,
        deviceUtilization: 88,
        onTimeRate: 79,
      },
      trend: days.map((date, idx) => ({ date, completed: 3 + ((idx * 5) % 9) })),
    }
  }
}
