import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'
import type { z } from 'zod'
import type { ApplyTemplateSchema, CreateFollowUpPlanSchema, FromExamFollowUpSchema, UpdateFollowUpPlanSchema } from './followup.schema'

type CreateDto = z.infer<typeof CreateFollowUpPlanSchema>
type UpdateDto = z.infer<typeof UpdateFollowUpPlanSchema>

// [v3.0.6.11-99 Wave3B] 终态 (不可再流转)
const TERMINAL_STATUS = new Set(['COMPLETED', 'MISSED', 'CANCELLED'])

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

function addDays(value: Date, days: number): Date {
  const d = new Date(value)
  d.setDate(d.getDate() + days)
  return d
}

/** [v3.0.6.11-99 Wave3B] 闭包解析 intervals (Json → number[]) */
function parseIntervals(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)
}

/** [v3.0.6.11-99 Wave3B] 闭包解析 items (Json → string[]) */
function parseItems(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v)).filter(Boolean)
}

@Injectable()
export class FollowUpService {
  constructor(private readonly prisma: PrismaService) {}

  /** [W4-B] 非终态且 nextDate 早于今天的计划自动归为 OVERDUE */
  private deriveStatus(plan: { status: string; nextDate: Date }): string {
    if (TERMINAL_STATUS.has(plan.status)) return plan.status
    if (plan.status === 'OVERDUE') return 'OVERDUE'
    if (new Date(plan.nextDate).getTime() < Date.now()) return 'OVERDUE'
    return plan.status
  }

  private toDto(plan: {
    id: string
    patientId: string
    patientName: string
    reportId: string | null
    examId: string | null
    templateId: string | null
    planDate: Date
    intervalDays: number
    nextDate: Date
    status: string
    note: string
    reminderEnabled: boolean
    remindedAt: Date | null
    missedAt: Date | null
    cancelledAt: Date | null
    reason: string | null
    completedAt: Date | null
    createdAt: Date
    updatedAt: Date
  }) {
    const status = this.deriveStatus(plan)
    return {
      id: plan.id,
      patientId: plan.patientId,
      patientName: plan.patientName,
      reportId: plan.reportId ?? undefined,
      examId: plan.examId ?? undefined,
      templateId: plan.templateId ?? undefined,
      planDate: plan.planDate.toISOString(),
      intervalDays: plan.intervalDays,
      nextDate: plan.nextDate.toISOString(),
      status,
      note: plan.note,
      reminderEnabled: plan.reminderEnabled,
      remindedAt: plan.remindedAt ? plan.remindedAt.toISOString() : null,
      missedAt: plan.missedAt ? plan.missedAt.toISOString() : null,
      cancelledAt: plan.cancelledAt ? plan.cancelledAt.toISOString() : null,
      reason: plan.reason ?? undefined,
      completedAt: plan.completedAt ? plan.completedAt.toISOString() : null,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    }
  }

  async list(query: { status?: string; date?: string; patientId?: string; search?: string }) {
    const tenantId = currentTenantId()
    const where: Prisma.FollowUpPlanWhereInput = { tenantId }
    if (query.status) where.status = query.status
    if (query.patientId) where.patientId = query.patientId
    if (query.date) {
      const dayStart = new Date(`${query.date}T00:00:00`)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      where.planDate = { gte: dayStart, lt: dayEnd }
    }
    if (query.search) {
      where.OR = [
        { patientName: { contains: query.search, mode: 'insensitive' } },
        { patientId: { contains: query.search, mode: 'insensitive' } },
      ]
    }
    const [items, total] = await Promise.all([
      this.prisma.followUpPlan.findMany({ where, orderBy: [{ status: 'asc' }, { nextDate: 'asc' }] }),
      this.prisma.followUpPlan.count({ where }),
    ])
    return { items: items.map((p) => this.toDto(p as any)), total }
  }

  async create(dto: CreateDto) {
    const planDate = toDate(dto.planDate)
    const nextDate = addDays(planDate, dto.intervalDays ?? 30)
    const plan = await this.prisma.followUpPlan.create({
      data: {
        tenantId: currentTenantId(),
        patientId: dto.patientId,
        patientName: dto.patientName,
        // [v3.0.6.11-92 Wave1B P0] 报告/检查关联 (报告详情"创建随访"入口带入)
        reportId: dto.reportId ?? null,
        examId: dto.examId ?? null,
        templateId: dto.templateId ?? null,
        planDate,
        intervalDays: dto.intervalDays ?? 30,
        nextDate,
        status: dto.status ?? 'PENDING',
        note: dto.note ?? '',
        reminderEnabled: dto.reminderEnabled ?? true,
      },
    })
    return this.toDto(plan as any)
  }

  async update(id: string, dto: UpdateDto) {
    const existing = await this.prisma.followUpPlan.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`FollowUpPlan ${id} not found`)
    const data: Prisma.FollowUpPlanUpdateInput = {}
    if (dto.patientId !== undefined) data.patientId = dto.patientId
    if (dto.patientName !== undefined) data.patientName = dto.patientName
    if (dto.reportId !== undefined) data.reportId = dto.reportId
    if (dto.examId !== undefined) data.examId = dto.examId
    if (dto.templateId !== undefined) data.templateId = dto.templateId
    if (dto.planDate !== undefined) data.planDate = toDate(dto.planDate)
    if (dto.intervalDays !== undefined) data.intervalDays = dto.intervalDays
    if (dto.status !== undefined) data.status = dto.status
    if (dto.note !== undefined) data.note = dto.note
    if (dto.reminderEnabled !== undefined) data.reminderEnabled = dto.reminderEnabled
    // 同步 nextDate = planDate + intervalDays
    const planDate = (data.planDate as Date | undefined) ?? existing.planDate
    const intervalDays = (data.intervalDays as number | undefined) ?? existing.intervalDays
    data.nextDate = addDays(planDate, intervalDays)
    const plan = await this.prisma.followUpPlan.update({ where: { id }, data })
    return this.toDto(plan as any)
  }

  async remove(id: string) {
    const existing = await this.prisma.followUpPlan.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`FollowUpPlan ${id} not found`)
    await this.prisma.followUpPlan.delete({ where: { id } })
    return { ok: true, id }
  }

  /** 状态流转前置校验: 存在 + 非终态 */
  private async mustBeActive(id: string) {
    const existing = await this.prisma.followUpPlan.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`FollowUpPlan ${id} not found`)
    if (TERMINAL_STATUS.has(existing.status)) {
      throw new BadRequestException(`FollowUpPlan ${id} 已处于终态 ${existing.status}, 不可流转`)
    }
    return existing as any
  }

  async complete(id: string) {
    await this.mustBeActive(id)
    const plan = await this.prisma.followUpPlan.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
    return this.toDto(plan as any)
  }

  // ============ [v3.0.6.11-99 Wave3B] 随访闭环状态机 ============

  /** POST /followups/:id/remind — 触发提醒: 创建 notification + 标记已提醒 */
  async remind(id: string, userId: string) {
    await this.mustBeActive(id)
    const plan = await this.prisma.followUpPlan.update({
      where: { id },
      data: { status: 'REMINDED', remindedAt: new Date() },
    })
    await this.createReminderNotification(plan as any, userId)
    return this.toDto(plan as any)
  }

  /** POST /followups/:id/miss — 标记失访 { reason } */
  async miss(id: string, reason: string) {
    await this.mustBeActive(id)
    const plan = await this.prisma.followUpPlan.update({
      where: { id },
      data: { status: 'MISSED', missedAt: new Date(), reason: reason || null },
    })
    return this.toDto(plan as any)
  }

  /** POST /followups/:id/cancel — 取消 { reason } */
  async cancel(id: string, reason: string) {
    await this.mustBeActive(id)
    const plan = await this.prisma.followUpPlan.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), reason: reason || null },
    })
    return this.toDto(plan as any)
  }

  /** POST /followups/:id/in-progress — 开始随访 */
  async inProgress(id: string) {
    await this.mustBeActive(id)
    const plan = await this.prisma.followUpPlan.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    })
    return this.toDto(plan as any)
  }

  /** 提醒通知: 直接落库 notification (DB 不可用静默回退, 不阻塞主流程) */
  private async createReminderNotification(plan: {
    id: string
    patientId: string
    patientName: string
    nextDate: Date
  }, userId: string) {
    const model = (this.prisma as any).notification
    if (!model?.create) return
    try {
      await model.create({
        data: {
          tenantId: currentTenantId(),
          userId: userId || 'u-001',
          type: 'TASK',
          severity: 'INFO',
          title: '随访提醒',
          content: `患者 ${plan.patientName} 的随访计划 (${plan.nextDate.toISOString().slice(0, 10)}) 已到提醒时间, 请安排随访`,
          link: '/follow-up',
          targetId: plan.id,
        },
      })
    } catch {
      /* 通知失败不阻塞状态流转 */
    }
  }

  // ============ [v3.0.6.11-99 Wave3B] 统计 ============

  /** GET /followups/stats — 完成率/失访率/异常率(逾期)/按类别/按时段 (现有表派生) */
  async stats() {
    const tenantId = currentTenantId()
    const [plans, templates] = await Promise.all([
      this.prisma.followUpPlan.findMany({ where: { tenantId } }),
      (this.prisma as any).followUpTemplate?.findMany
        ? this.prisma.followUpTemplate.findMany({ where: { tenantId } }).catch(() => [])
        : Promise.resolve([]),
    ])
    const now = Date.now()
    const rows = (plans as any[]).map((p) => ({
      ...p,
      status: this.deriveStatus(p),
      month: new Date(p.planDate).toISOString().slice(0, 7),
    }))
    const total = rows.length
    const countBy = (s: string) => rows.filter((r) => r.status === s).length
    const completed = countBy('COMPLETED')
    const missed = countBy('MISSED')
    const cancelled = countBy('CANCELLED')
    const overdue = countBy('OVERDUE')
    const inProgress = countBy('IN_PROGRESS')
    const reminded = countBy('REMINDED')
    const pending = countBy('PENDING')
    const evaluable = Math.max(1, total - cancelled)
    const categoryMap = new Map<string, string>()
    for (const t of templates as any[]) {
      categoryMap.set(t.id, String(t.category || '未分类'))
    }
    const byCategory: Record<string, number> = {}
    for (const r of rows) {
      const cat = (r.templateId && categoryMap.get(r.templateId)) || '未分类'
      byCategory[cat] = (byCategory[cat] ?? 0) + 1
    }
    const byMonth: Array<{ month: string; total: number; completed: number; missed: number }> = []
    const monthMap = new Map<string, { total: number; completed: number; missed: number }>()
    for (const r of rows) {
      const entry = monthMap.get(r.month) ?? { total: 0, completed: 0, missed: 0 }
      entry.total += 1
      if (r.status === 'COMPLETED') entry.completed += 1
      if (r.status === 'MISSED') entry.missed += 1
      monthMap.set(r.month, entry)
    }
    for (const [month, entry] of monthMap) byMonth.push({ month, ...entry })
    byMonth.sort((a, b) => a.month.localeCompare(b.month))
    return {
      total,
      completed,
      missed,
      cancelled,
      overdue,
      inProgress,
      reminded,
      pending,
      completionRate: Math.round((completed / evaluable) * 1000) / 10,
      missRate: Math.round((missed / Math.max(1, total)) * 1000) / 10,
      abnormalRate: Math.round((overdue / Math.max(1, total)) * 1000) / 10,
      byCategory: Object.entries(byCategory).map(([category, count]) => ({ category, count })),
      byMonth,
    }
  }

  // ============ [v3.0.6.11-99 Wave3B] 模板应用 / 检查联动 ============

  /** 按模板 intervals 批量生成计划 (公共: applyTemplate / from-exam 复用) */
  async generateFromTemplate(input: {
    templateId: string
    patientId: string
    patientName: string
    planDate: string
    reportId?: string
    examId?: string
    note?: string
  }) {
    const template = await ((this.prisma as any).followUpTemplate?.findUnique
      ? this.prisma.followUpTemplate.findUnique({ where: { id: input.templateId } }).catch(() => null)
      : Promise.resolve(null))
    if (!template) throw new NotFoundException(`FollowUpTemplate ${input.templateId} not found`)
    const intervals = parseIntervals(template.intervals)
    if (intervals.length === 0) throw new BadRequestException('模板未配置间隔天数 (intervals)')
    const base = toDate(input.planDate)
    const items = parseItems(template.items)
    const created: any[] = []
    for (const days of intervals) {
      const planDate = addDays(base, 0)
      const dto: CreateDto = {
        patientId: input.patientId,
        patientName: input.patientName,
        planDate: base.toISOString(),
        intervalDays: days,
        reportId: input.reportId,
        examId: input.examId,
        templateId: template.id,
        note: input.note ?? `模板「${template.name}」第${intervals.indexOf(days) + 1}期`,
        reminderEnabled: true,
      }
      if (items.length > 0) dto.note = `${dto.note} · ${items.join('/')}`
      const plan = await this.prisma.followUpPlan.create({
        data: {
          tenantId: currentTenantId(),
          patientId: dto.patientId,
          patientName: dto.patientName,
          reportId: dto.reportId ?? null,
          examId: dto.examId ?? null,
          templateId: dto.templateId ?? null,
          planDate,
          intervalDays: dto.intervalDays ?? 30,
          nextDate: addDays(planDate, days),
          status: 'PENDING',
          note: dto.note ?? '',
          reminderEnabled: dto.reminderEnabled ?? true,
        },
      })
      created.push(this.toDto(plan as any))
    }
    return { items: created, total: created.length, templateId: template.id }
  }

  /** POST /followup-templates/:id/apply — 模板应用到患者 (批量生成计划) */
  async applyTemplate(templateId: string, dto: z.infer<typeof ApplyTemplateSchema>) {
    return this.generateFromTemplate({
      templateId,
      patientId: dto.patientId,
      patientName: dto.patientName,
      planDate: dto.planDate,
      reportId: dto.reportId,
      examId: dto.examId,
      note: dto.note,
    })
  }

  /** POST /followups/from-exam — 检查完成联动: 检查 → 自动创建随访计划 (可选模板) */
  async fromExam(dto: z.infer<typeof FromExamFollowUpSchema>) {
    const exam = await ((this.prisma as any).exam?.findUnique
      ? this.prisma.exam.findUnique({
          where: { id: dto.examId },
          include: { patient: true },
        }).catch(() => null)
      : Promise.resolve(null))
    if (!exam) throw new NotFoundException(`Exam ${dto.examId} not found`)
    const patient = (exam as any).patient
    const patientId = String((exam as any).patientId ?? patient?.id ?? '')
    const patientName = String(patient?.name ?? (exam as any).patientName ?? '未知患者')
    const baseDate = ((exam as any).scheduledAt ?? (exam as any).createdAt ?? new Date()).toISOString().slice(0, 10)
    const note = `来源检查: ${(exam as any).accessionNumber ?? dto.examId} 完成联动`
    if (dto.templateId) {
      return this.generateFromTemplate({
        templateId: dto.templateId,
        patientId,
        patientName,
        planDate: baseDate,
        examId: dto.examId,
        note,
      })
    }
    const created = await this.create({
      patientId,
      patientName,
      planDate: baseDate,
      intervalDays: 30,
      examId: dto.examId,
      note: dto.note ?? note,
      reminderEnabled: true,
    })
    return { items: [created], total: 1 }
  }

  // ============ [v3.0.6.11-99 Wave3B] 模板库 ============

  private templateModel(): any {
    return (this.prisma as any).followUpTemplate
  }

  private async toTemplateDto(t: any) {
    return {
      id: t.id,
      name: t.name,
      category: t.category ?? '',
      intervals: parseIntervals(t.intervals),
      items: parseItems(t.items),
      active: t.active ?? true,
      createdAt: t.createdAt ? t.createdAt.toISOString() : undefined,
      updatedAt: t.updatedAt ? t.updatedAt.toISOString() : undefined,
    }
  }

  /** GET /followup-templates — 模板列表 (演示回退: 内置病种模板) */
  async listTemplates() {
    const model = this.templateModel()
    if (!model?.findMany) return this.demoTemplates()
    let rows: any[]
    try {
      rows = await model.findMany({ where: { tenantId: currentTenantId() }, orderBy: [{ active: 'desc' }, { createdAt: 'asc' }] })
    } catch {
      return this.demoTemplates()
    }
    return { items: await Promise.all(rows.map((r: any) => this.toTemplateDto(r))), total: rows.length }
  }

  // [G005 Wave 10A] 模板库扩充: 20 个随访模板 (病种: 肺癌/乳腺/甲状腺 + 术式 8 类 + 检查类型)
  private async demoTemplates() {
    const items = [
      // ── 病种 (肺癌 / 乳腺 / 甲状腺) ──
      { id: 'tpl-onc-ct', name: '肿瘤术后复查(CT)', category: '病种', intervals: [30, 90, 180], items: ['影像学复查', '肿瘤标志物'], active: true },
      { id: 'tpl-contrast', name: '对比剂反应随访', category: '检查类型', intervals: [7, 30], items: ['对比剂反应评估'], active: true },
      { id: 'tpl-nodule', name: '肺结节随访', category: '病种', intervals: [90, 180, 360], items: ['薄层CT复查', '结节大小对比'], active: true },
      { id: 'tpl-lung-ca', name: '肺癌术后随访', category: '病种', intervals: [90, 180, 270, 360], items: ['胸部CT', '肿瘤标志物(CEA/NSE)', '门诊复诊'], active: true },
      { id: 'tpl-lung-radio', name: '肺癌放疗后随访', category: '病种', intervals: [30, 90, 180, 360], items: ['胸部CT', '放射性肺炎评估', '肺功能检查'], active: true },
      { id: 'tpl-lung-target', name: '肺癌靶向治疗随访', category: '病种', intervals: [30, 90, 180], items: ['胸部CT', '靶病灶测量(RECIST)', '基因检测动态'], active: true },
      { id: 'tpl-breast-ca', name: '乳腺癌术后随访', category: '病种', intervals: [90, 180, 360], items: ['乳腺钼靶/超声', '肿瘤标志物(CA15-3)', '内分泌治疗评估'], active: true },
      { id: 'tpl-breast-radio', name: '乳腺癌放疗后随访', category: '病种', intervals: [90, 180, 360], items: ['乳腺影像复查', '放疗皮肤反应评估', '心功能评估(左乳放疗)'], active: true },
      { id: 'tpl-breast-endocrine', name: '乳腺癌内分泌治疗随访', category: '病种', intervals: [90, 180, 360], items: ['骨密度检测', '血脂检查', '妇科超声'], active: true },
      { id: 'tpl-thyroid-ca', name: '甲状腺癌术后随访', category: '病种', intervals: [90, 180, 360], items: ['甲状腺功能(TSH/Tg)', '颈部超声', '碘131治疗评估'], active: true },
      { id: 'tpl-thyroid-benign', name: '甲状腺良性结节随访', category: '病种', intervals: [180, 360], items: ['甲状腺超声', '甲状腺功能'], active: true },
      { id: 'tpl-thyroid-ablation', name: '甲状腺射频消融术后随访', category: '术式', intervals: [30, 90, 180, 360], items: ['消融区超声', '甲状腺功能', '体积变化测量'], active: true },
      // ── 术式 8 类 ──
      { id: 'tpl-stent', name: '冠脉支架术后随访', category: '术式', intervals: [30, 90, 180, 360], items: ['心电图', '心功能评估', '药物依从性'], active: true },
      { id: 'tpl-cabg', name: '冠脉搭桥术后随访', category: '术式', intervals: [90, 180, 360], items: ['冠脉CTA(1年)', '心功能超声', '血糖血脂'], active: true },
      { id: 'tpl-joint-hip', name: '髋关节置换术后随访', category: '术式', intervals: [30, 90, 180, 360], items: ['髋关节X线', 'Harris 评分', '步态评估'], active: true },
      { id: 'tpl-joint-knee', name: '膝关节置换术后随访', category: '术式', intervals: [30, 90, 180, 360], items: ['膝关节X线', 'KSS 评分', 'ROM 测量'], active: true },
      { id: 'tpl-spine-fusion', name: '脊柱融合术后随访', category: '术式', intervals: [90, 180, 360], items: ['脊柱X线/CT', '融合率评估', 'ODI 评分'], active: true },
      { id: 'tpl-hernia', name: '疝修补术后随访', category: '术式', intervals: [30, 90, 180], items: ['切口评估', '复发超声'], active: true },
      { id: 'tpl-gallbladder', name: '胆囊切除术后随访', category: '术式', intervals: [30, 90], items: ['腹部超声', '消化功能评估'], active: true },
      { id: 'tpl-cataract', name: '白内障术后随访', category: '术式', intervals: [7, 30, 90], items: ['视力检查', '眼压测量', '眼底检查'], active: true },
    ]
    return { items, total: items.length }
  }

  /** POST /followup-templates — 创建模板 */
  async createTemplate(dto: { name: string; category?: string; intervals?: number[]; items?: string[]; active?: boolean }) {
    const model = this.templateModel()
    if (!model?.create) throw new BadRequestException('FollowUpTemplate 表不可用')
    const intervals = parseIntervals(dto.intervals)
    if (dto.name?.trim() && intervals.length === 0) throw new BadRequestException('模板至少需要一个间隔天数')
    const t = await model.create({
      data: {
        tenantId: currentTenantId(),
        name: dto.name,
        category: dto.category ?? '',
        intervals,
        items: Array.isArray(dto.items) ? dto.items.filter(Boolean) : [],
        active: dto.active ?? true,
      },
    })
    return this.toTemplateDto(t)
  }

  /** PATCH /followup-templates/:id — 更新模板 */
  async updateTemplate(id: string, dto: Partial<{ name: string; category?: string; intervals?: number[]; items?: string[]; active?: boolean }>) {
    const model = this.templateModel()
    if (!model?.findUnique) throw new BadRequestException('FollowUpTemplate 表不可用')
    const existing = await model.findUnique({ where: { id } }).catch(() => null)
    if (!existing) throw new NotFoundException(`FollowUpTemplate ${id} not found`)
    const data: any = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.category !== undefined) data.category = dto.category
    if (dto.intervals !== undefined) data.intervals = parseIntervals(dto.intervals)
    if (dto.items !== undefined) data.items = Array.isArray(dto.items) ? dto.items.filter(Boolean) : []
    if (dto.active !== undefined) data.active = dto.active
    const t = await model.update({ where: { id }, data })
    return this.toTemplateDto(t)
  }

  /** DELETE /followup-templates/:id — 删除模板 */
  async removeTemplate(id: string) {
    const model = this.templateModel()
    if (!model?.findUnique) throw new BadRequestException('FollowUpTemplate 表不可用')
    const existing = await model.findUnique({ where: { id } }).catch(() => null)
    if (!existing) throw new NotFoundException(`FollowUpTemplate ${id} not found`)
    await model.delete({ where: { id } })
    return { ok: true, id }
  }

  /** [W4-B] 即将到期提醒: 未完成且 nextDate 落在未来 days 天内(含已逾期) */
  async due(days: number) {
    const daysNum = Number.isFinite(days) && days > 0 ? days : 7
    const horizon = addDays(new Date(), daysNum)
    const items = await this.prisma.followUpPlan.findMany({
      where: {
        tenantId: currentTenantId(),
        status: { not: 'COMPLETED' },
        nextDate: { lte: horizon },
      },
      orderBy: { nextDate: 'asc' },
    })
    return { items: items.map((p) => this.toDto(p as any)), total: items.length, days: daysNum }
  }
}
