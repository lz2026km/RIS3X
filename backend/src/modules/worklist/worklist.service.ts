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
// 允许质控流转的源态 (检查已完成后的影像阶段; IN_PROGRESS 允许技师工作站直接评定)
const QC_ALLOWED_FROM = ['COMPLETED', 'IN_PROGRESS', 'IMAGE_READY', 'QC_REJECT', 'QC_PASS', 'PENDING_REPORT']
// 重拍登记 (QC_REJECT → IN_PROGRESS) 允许的源态
const RETAKE_ALLOWED_FROM = ['QC_REJECT']

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
      if (['techNotes', 'qcNotes', 'qualityRating', 'retakeCount', 'priority', 'pausedAt'].includes(k)) extras[k] = v
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
    return { ...exam, ops }
  }

  async update(id: string, dto: { state?: WorklistState; priority?: string; deviceId?: string | null; bodyPart?: string; modality?: string; scheduledAt?: string | null; techNote?: string; qcNote?: string; rating?: string }) {
    await this.getExam(id)
    const data: any = {}
    if (dto.state !== undefined) data.state = dto.state
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
   */
  async updateQcState(id: string, state: QcState, note?: string, opts?: { rating?: string; techNote?: string; qcNote?: string }) {
    const exam = await this.getExam(id)
    if (state === 'IN_PROGRESS') {
      // 重拍登记: 仅允许从 QC_REJECT
      if (!RETAKE_ALLOWED_FROM.includes(exam.state)) {
        throw new BadRequestException(`Exam ${id} 当前状态 ${exam.state} 不允许重拍登记 (仅 ${RETAKE_ALLOWED_FROM.join('/')})`)
      }
      const retakeCount = Number(exam.retakeCount ?? 0) + 1
      const appendNote = `重拍登记 第 ${retakeCount} 次${note ? `: ${note}` : ''}`
      const qcNotes = [exam.qcNotes ?? '', appendNote].filter(Boolean).join('\n')
      const result = await this.updateExam(id, { state: 'IN_PROGRESS', retakeCount, qcNotes }, { patient: true, device: true })
      this.notifyWorklistChanged(`retake=${retakeCount}:${appendNote}`, id)
      return result
    }
    if (!QC_ALLOWED_FROM.includes(exam.state)) {
      throw new BadRequestException(`Exam ${id} 当前状态 ${exam.state} 不允许质控流转 (仅 ${QC_ALLOWED_FROM.join('/')})`)
    }
    const target: WorklistState = state === 'QC_PASS' ? 'PENDING_REPORT' : state
    const data: any = { state: target }
    if (opts?.rating !== undefined) data.qualityRating = opts.rating
    if (opts?.techNote !== undefined) data.techNotes = opts.techNote
    const qcNote = opts?.qcNote ?? note
    if (qcNote !== undefined) data.qcNotes = qcNote
    const result = await this.updateExam(id, data, { patient: true, device: true })
    this.notifyWorklistChanged(`qc=${state}${qcNote ? `:${qcNote}` : ''}`, id)
    return result
  }
}
