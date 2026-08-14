// [G005 Wave 3A v3.0.6.11-99] qc-pdca 质控闭环模块 — PDCA 周期管理 (Plan/Do/Check/Act)
// 数据源: 内存 CRUD + 确定性 seed; 关联缺陷从 auditLog('qc-defect'/'defect-library') 派生 + seed 回退
// 响应带 source 信封: 'database' 真实派生 / 'demo' seed 回退 (与 MSW qcPdcaHandlers 对齐)
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export type PdcaPhaseCode = 'plan' | 'do' | 'check' | 'act' | 'completed'
export type PdcaCategory = '报告质控' | '图像质控' | '流程质控' | '服务质控'

export interface PdcaPhaseEntry {
  id: string
  phase: Exclude<PdcaPhaseCode, 'completed'>
  content: string
  createdAt: string
  updatedAt: string
}

export interface PdcaCycle {
  id: string
  title: string
  category: PdcaCategory
  description: string
  target: string
  ownerId: string
  ownerName: string
  phase: PdcaPhaseCode
  status: '进行中' | '已完成'
  startDate: string
  dueDate: string
  completedAt?: string
  summary?: string
  defectIds: string[]
  createdAt: string
  updatedAt: string
}

export interface PdcaDefectRef {
  id: string
  defectType: string
  description: string
  severity: string
  status: string
  reportedBy: string
  reportedAt: string
}

export const PDCA_PHASE_ORDER: Exclude<PdcaPhaseCode, 'completed'>[] = ['plan', 'do', 'check', 'act']

const CATEGORIES: PdcaCategory[] = ['报告质控', '图像质控', '流程质控', '服务质控']
const OWNERS = [
  { id: 'u-001', name: '张主任' },
  { id: 'u-002', name: '李医生' },
  { id: 'u-003', name: '王技师' },
]

export const SEED_DEFECTS: PdcaDefectRef[] = [
  { id: 'df-001', defectType: '术语错误', description: '诊断结论中"考虑"类模糊表述占比偏高', severity: 'medium', status: 'in_progress', reportedBy: '质控组', reportedAt: '2026-07-02' },
  { id: 'df-002', defectType: '完整性缺陷', description: 'CT 增强报告未描述造影剂用量与过敏反应', severity: 'high', status: 'open', reportedBy: '张主任', reportedAt: '2026-07-05' },
  { id: 'df-003', defectType: '描述缺陷', description: '部分报告影像所见与诊断结论逻辑不符', severity: 'medium', status: 'in_progress', reportedBy: '李医生', reportedAt: '2026-07-08' },
  { id: 'df-004', defectType: '格式缺陷', description: '报告模板字段未按规范排版(左对齐/字号)', severity: 'low', status: 'resolved', reportedBy: '王技师', reportedAt: '2026-07-10' },
  { id: 'df-005', defectType: '流程缺陷', description: '危急值报告口头通知后 30 分钟内未电话复核', severity: 'high', status: 'open', reportedBy: '护士站', reportedAt: '2026-07-12' },
  { id: 'df-006', defectType: '图像缺陷', description: 'DR 胸片曝光不足, 心影后方结构无法评估', severity: 'medium', status: 'resolved', reportedBy: '王技师', reportedAt: '2026-07-15' },
  { id: 'df-007', defectType: '服务缺陷', description: '患者取报告等待时长超过 60 分钟投诉', severity: 'low', status: 'in_progress', reportedBy: '服务中心', reportedAt: '2026-07-18' },
]

function iso(day: string): string {
  return new Date(day + 'T00:00:00Z').toISOString()
}

function daysAfter(day: string, n: number): string {
  const d = new Date(day + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString()
}

@Injectable()
export class QcPdcaService {
  private readonly logger = new Logger(QcPdcaService.name)
  private cycles: PdcaCycle[] = []
  private phaseEntries = new Map<string, PdcaPhaseEntry[]>()
  private idCounter = 100

  constructor(private readonly prisma: PrismaService) {
    this.seed()
  }

  private nextId(prefix: string): string {
    this.idCounter += 1
    return `${prefix}-${this.idCounter}`
  }

  private seed(): void {
    const mkCycle = (
      id: string,
      title: string,
      category: PdcaCategory,
      description: string,
      target: string,
      owner: { id: string; name: string },
      phase: PdcaPhaseCode,
      startDay: string,
      dueDay: string,
      defectIds: string[],
      completedAt?: string,
      summary?: string,
    ): PdcaCycle => ({
      id,
      title,
      category,
      description,
      target,
      ownerId: owner.id,
      ownerName: owner.name,
      phase,
      status: phase === 'completed' ? '已完成' : '进行中',
      startDate: iso(startDay),
      dueDate: iso(dueDay),
      completedAt,
      summary,
      defectIds,
      createdAt: iso(startDay),
      updatedAt: iso(completedAt ?? dueDay),
    })

    this.cycles = [
      mkCycle('pdca-001', '报告术语规范专项', '报告质控', '降低诊断结论中模糊表述占比, 提升报告权威性', '模糊表述率 ≤ 5%', OWNERS[0]!, 'completed', '2026-05-06', '2026-06-30', ['df-001', 'df-003'], '2026-06-28', '术语规范化培训完成, 复评抽查 120 份报告达标'),
      mkCycle('pdca-002', 'CT 增强报告完整性提升', '报告质控', '补充造影剂使用与过敏反应描述字段', '完整性字段覆盖率 100%', OWNERS[1]!, 'act', '2026-06-10', '2026-08-15', ['df-002'], undefined, '培训与模板已下发, 进入效果维持阶段'),
      mkCycle('pdca-003', '危急值报告复核流程再造', '流程质控', '危急值通知后电话复核确认闭环', '复核率 ≥ 98%', OWNERS[0]!, 'check', '2026-06-20', '2026-08-31', ['df-005'], undefined, undefined),
      mkCycle('pdca-004', 'DR 胸片曝光参数校准', '图像质控', '胸片曝光不足问题整改与技师培训', '曝光合格率 ≥ 95%', OWNERS[2]!, 'do', '2026-07-01', '2026-09-10', ['df-006'], undefined, undefined),
      mkCycle('pdca-005', '报告排版模板统一', '报告质控', '全科报告模板排版字段统一', '模板统一率 100%', OWNERS[2]!, 'plan', '2026-07-15', '2026-09-30', ['df-004'], undefined, undefined),
      mkCycle('pdca-006', '患者取报告时长优化', '服务质控', '缩短患者取报告等待时长', '平均等待 ≤ 40 分钟', OWNERS[1]!, 'plan', '2026-08-01', '2026-10-15', ['df-007'], undefined, undefined),
    ]

    const entries: Record<string, Array<{ phase: Exclude<PdcaPhaseCode, 'completed'>; content: string }>> = {
      'pdca-001': [
        { phase: 'plan', content: '统计 4 月-5 月 600 份报告中模糊表述分布' },
        { phase: 'plan', content: '制定术语规范清单与培训课件' },
        { phase: 'do', content: '组织 2 场全员术语规范培训' },
        { phase: 'do', content: '更新报告模板与常用短语库' },
        { phase: 'check', content: '抽查 120 份报告, 模糊表述率降至 4.2%' },
        { phase: 'act', content: '写入科室质控 SOP, 纳入月度质控指标' },
      ],
      'pdca-002': [
        { phase: 'plan', content: '盘点增强报告缺失字段 Top10' },
        { phase: 'do', content: '模板增加造影剂描述必填字段' },
        { phase: 'check', content: '7 月抽查覆盖率 92%, 剩余科室提示提醒' },
        { phase: 'act', content: '固化模板并培训低分医生' },
      ],
      'pdca-003': [
        { phase: 'plan', content: '梳理危急值通知-复核流程断点' },
        { phase: 'do', content: '上线电话复核提醒与超时预警' },
        { phase: 'check', content: '运行两周复核率 96%, 待满月评估' },
      ],
      'pdca-004': [
        { phase: 'plan', content: '统计 DR 曝光不足率与设备分布' },
        { phase: 'do', content: '校准 3 台 DR 自动曝光参数并培训技师' },
      ],
    }
    this.phaseEntries = new Map(
      Object.entries(entries).map(([cycleId, list]) => [
        cycleId,
        list.map((e, i) => ({
          id: `phase-${cycleId}-${i + 1}`,
          phase: e.phase,
          content: e.content,
          createdAt: iso('2026-07-01'),
          updatedAt: iso('2026-07-01'),
        })),
      ]),
    )
  }

  private cloneCycle(c: PdcaCycle): PdcaCycle {
    return { ...c, defectIds: [...c.defectIds] }
  }

  private toDto(c: PdcaCycle) {
    return this.cloneCycle(c)
  }

  private findCycle(id: string): PdcaCycle {
    const cycle = this.cycles.find((c) => c.id === id)
    if (!cycle) throw new NotFoundException(`PDCA 周期 ${id} 不存在`)
    return cycle
  }

  private findPhase(phaseId: string): { cycleId: string; entry: PdcaPhaseEntry } {
    for (const [cycleId, list] of this.phaseEntries) {
      const entry = list.find((p) => p.id === phaseId)
      if (entry) return { cycleId, entry }
    }
    throw new NotFoundException(`阶段条目 ${phaseId} 不存在`)
  }

  async listCycles(): Promise<{ source: 'database' | 'demo'; generatedAt: string; data: PdcaCycle[] }> {
    return {
      source: 'demo',
      generatedAt: new Date().toISOString(),
      data: this.cycles.map((c) => this.toDto(c)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }
  }

  async createCycle(body: { title: string; category: PdcaCategory; description?: string; target?: string; ownerId?: string }): Promise<PdcaCycle> {
    if (!body.title?.trim()) throw new BadRequestException('标题不能为空')
    if (!CATEGORIES.includes(body.category)) throw new BadRequestException(`类别必须为 ${CATEGORIES.join('|')}`)
    const owner = OWNERS.find((o) => o.id === body.ownerId) ?? OWNERS[0]!
    const now = iso('2026-08-14')
    const cycle: PdcaCycle = {
      id: this.nextId('pdca'),
      title: body.title.trim(),
      category: body.category,
      description: body.description ?? '',
      target: body.target ?? '',
      ownerId: owner.id,
      ownerName: owner.name,
      phase: 'plan',
      status: '进行中',
      startDate: now,
      dueDate: daysAfter('2026-08-14', 45),
      defectIds: [],
      createdAt: now,
      updatedAt: now,
    }
    this.cycles.push(cycle)
    this.phaseEntries.set(cycle.id, [])
    return this.toDto(cycle)
  }

  async getCycle(id: string): Promise<PdcaCycle & { phases: PdcaPhaseEntry[] }> {
    const cycle = this.findCycle(id)
    return { ...this.toDto(cycle), phases: (this.phaseEntries.get(id) ?? []).map((p) => ({ ...p })) }
  }

  async updateCycle(id: string, body: Partial<{ title: string; category: PdcaCategory; description: string; target: string; ownerId: string; dueDate: string }>): Promise<PdcaCycle> {
    const cycle = this.findCycle(id)
    if (body.category !== undefined && !CATEGORIES.includes(body.category)) throw new BadRequestException('类别不合法')
    if (body.title !== undefined && !body.title.trim()) throw new BadRequestException('标题不能为空')
    if (body.ownerId !== undefined) {
      const owner = OWNERS.find((o) => o.id === body.ownerId)
      if (owner) {
        cycle.ownerId = owner.id
        cycle.ownerName = owner.name
      }
    }
    if (body.title !== undefined) cycle.title = body.title.trim()
    if (body.category !== undefined) cycle.category = body.category
    if (body.description !== undefined) cycle.description = body.description
    if (body.target !== undefined) cycle.target = body.target
    if (body.dueDate !== undefined) cycle.dueDate = body.dueDate
    cycle.updatedAt = iso('2026-08-14')
    return this.toDto(cycle)
  }

  async deleteCycle(id: string): Promise<{ id: string; deleted: true }> {
    this.findCycle(id)
    this.cycles = this.cycles.filter((c) => c.id !== id)
    this.phaseEntries.delete(id)
    return { id, deleted: true }
  }

  async advanceCycle(id: string): Promise<PdcaCycle> {
    const cycle = this.findCycle(id)
    if (cycle.phase === 'completed') throw new BadRequestException('周期已完成, 不能再推进')
    const idx = PDCA_PHASE_ORDER.indexOf(cycle.phase)
    if (idx < 0) throw new BadRequestException(`当前阶段 ${cycle.phase} 不合法`)
    if (idx === PDCA_PHASE_ORDER.length - 1) {
      cycle.phase = 'completed'
      cycle.status = '已完成'
      cycle.completedAt = cycle.completedAt ?? iso('2026-08-14')
      cycle.summary = cycle.summary ?? '周期闭环: 各阶段措施已落实并纳入科室 SOP'
    } else {
      cycle.phase = PDCA_PHASE_ORDER[idx + 1]!
    }
    cycle.updatedAt = iso('2026-08-14')
    return this.toDto(cycle)
  }

  async listPhases(id: string): Promise<{ source: 'database' | 'demo'; generatedAt: string; data: PdcaPhaseEntry[] }> {
    this.findCycle(id)
    return {
      source: 'demo',
      generatedAt: new Date().toISOString(),
      data: (this.phaseEntries.get(id) ?? []).map((p) => ({ ...p })).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    }
  }

  async addPhase(id: string, body: { phase: Exclude<PdcaPhaseCode, 'completed'>; content: string }): Promise<PdcaPhaseEntry> {
    this.findCycle(id)
    if (!PDCA_PHASE_ORDER.includes(body.phase)) throw new BadRequestException(`阶段必须为 ${PDCA_PHASE_ORDER.join('|')}`)
    if (!body.content?.trim()) throw new BadRequestException('内容不能为空')
    const now = iso('2026-08-14')
    const entry: PdcaPhaseEntry = { id: this.nextId('phase'), phase: body.phase, content: body.content.trim(), createdAt: now, updatedAt: now }
    this.phaseEntries.get(id)!.push(entry)
    return { ...entry }
  }

  async updatePhase(phaseId: string, body: Partial<{ phase: Exclude<PdcaPhaseCode, 'completed'>; content: string }>): Promise<PdcaPhaseEntry> {
    const { entry } = this.findPhase(phaseId)
    if (body.phase !== undefined) {
      if (!PDCA_PHASE_ORDER.includes(body.phase)) throw new BadRequestException('阶段不合法')
      entry.phase = body.phase
    }
    if (body.content !== undefined) {
      if (!body.content.trim()) throw new BadRequestException('内容不能为空')
      entry.content = body.content.trim()
    }
    entry.updatedAt = iso('2026-08-14')
    return { ...entry }
  }

  async listCycleDefects(id: string): Promise<{ source: 'database' | 'demo'; generatedAt: string; data: PdcaDefectRef[] }> {
    const cycle = this.findCycle(id)
    const derived = await this.deriveDefects()
    const picked = cycle.defectIds.length > 0
      ? derived.filter((d) => cycle.defectIds.includes(d.id))
      : derived.slice(0, 3)
    return { source: derived.length === SEED_DEFECTS.length ? 'demo' : 'database', generatedAt: new Date().toISOString(), data: picked }
  }

  async linkDefect(id: string, body: { defectId: string }): Promise<{ linked: boolean; defectIds: string[] }> {
    const cycle = this.findCycle(id)
    const defectId = body.defectId
    if (!defectId) throw new BadRequestException('defectId 不能为空')
    if (!cycle.defectIds.includes(defectId)) cycle.defectIds.push(defectId)
    cycle.updatedAt = iso('2026-08-14')
    return { linked: true, defectIds: [...cycle.defectIds] }
  }

  async completeCycle(id: string, body: { summary?: string }): Promise<PdcaCycle> {
    const cycle = this.findCycle(id)
    if (cycle.phase === 'completed') throw new BadRequestException('周期已完成')
    cycle.phase = 'completed'
    cycle.status = '已完成'
    cycle.completedAt = iso('2026-08-14')
    cycle.summary = body.summary?.trim() || '周期闭环: 各阶段措施已落实'
    cycle.updatedAt = iso('2026-08-14')
    return this.toDto(cycle)
  }

  async getStats(): Promise<{
    source: 'database' | 'demo'
    generatedAt: string
    data: {
      total: number
      byPhase: Record<string, number>
      completionRate: number
      byCategory: Record<string, number>
      avgDurationDays: number
      inProgress: number
    }
  }> {
    const cycles = this.cycles
    const byPhase: Record<string, number> = { plan: 0, do: 0, check: 0, act: 0, completed: 0 }
    const byCategory: Record<string, number> = { '报告质控': 0, '图像质控': 0, '流程质控': 0, '服务质控': 0 }
    let completed = 0
    let durationSum = 0
    let durationCount = 0
    for (const c of cycles) {
      byPhase[c.phase] = (byPhase[c.phase] ?? 0) + 1
      byCategory[c.category] = (byCategory[c.category] ?? 0) + 1
      if (c.phase === 'completed') {
        completed += 1
        const start = new Date(c.startDate).getTime()
        const end = new Date(c.completedAt ?? c.dueDate).getTime()
        if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
          durationSum += (end - start) / 86400000
          durationCount += 1
        }
      }
    }
    return {
      source: 'demo',
      generatedAt: new Date().toISOString(),
      data: {
        total: cycles.length,
        byPhase,
        completionRate: cycles.length > 0 ? Math.round((completed / cycles.length) * 1000) / 10 : 0,
        byCategory,
        avgDurationDays: durationCount > 0 ? Math.round((durationSum / durationCount) * 10) / 10 : 0,
        inProgress: cycles.length - completed,
      },
    }
  }

  // 关联缺陷派生: auditLog('qc-defect'/'defect-library') 真实记录 + seed 回退
  private async deriveDefects(): Promise<PdcaDefectRef[]> {
    try {
      const rows = await this.prisma.auditLog.findMany({
        where: { resource: { in: ['qc-defect', 'defect-library'] } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      if (rows.length === 0) return SEED_DEFECTS.map((d) => ({ ...d }))
      return rows.map((r) => {
        const detail = (r.detail ?? {}) as Record<string, unknown>
        return {
          id: r.id,
          defectType: String(detail.defectType ?? '未分类'),
          description: String(detail.description ?? detail.name ?? ''),
          severity: String(detail.severity ?? 'medium'),
          status: String(detail.status ?? 'open'),
          reportedBy: String(detail.reportedBy ?? '质控组'),
          reportedAt: r.createdAt.toISOString().slice(0, 10),
        }
      })
    } catch (err) {
      this.logger.warn(`[QcPdca] deriveDefects failed, fallback to seed: ${(err as Error).message}`)
      return SEED_DEFECTS.map((d) => ({ ...d }))
    }
  }

  // 全部缺陷池 (供前端详情抽屉候选列表使用)
  async listAllDefects(): Promise<{ source: 'database' | 'demo'; generatedAt: string; data: PdcaDefectRef[] }> {
    const derived = await this.deriveDefects()
    return { source: derived.length === SEED_DEFECTS.length ? 'demo' : 'database', generatedAt: new Date().toISOString(), data: derived }
  }
}
