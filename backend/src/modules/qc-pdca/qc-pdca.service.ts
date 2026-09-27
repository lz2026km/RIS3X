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

// [W9-QC] PDCA 整改措施 / 问题发现 (持久化模型扩展)
export type PdcaActionStatus = 'pending' | 'in_progress' | 'done' | 'overdue'

export interface PdcaAction {
  id: string
  cycleId: string
  phase: Exclude<PdcaPhaseCode, 'completed'>
  description: string
  ownerId: string
  ownerName: string
  deadline: string
  status: PdcaActionStatus
  createdAt: string
  completedAt?: string
}

export interface PdcaFinding {
  id: string
  cycleId: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  createdAt: string
}

export interface PdcaMetrics {
  cycleCount: number
  actionCount: number
  actionDone: number
  actionOverdue: number
  actionCompletionRate: number
  findingCount: number
  byOwner: Array<{ ownerId: string; ownerName: string; total: number; done: number; overdue: number }>
  byActionStatus: Record<PdcaActionStatus, number>
  defectCount: number
  linkedDefectCount: number
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
  // [G005 Wave 10A] 完整周期关联缺陷 (pdca-101..105)
  { id: 'df-101', defectType: '安全事件', description: '增强扫描对比剂外渗事件月发生率 0.9% 超标', severity: 'high', status: 'resolved', reportedBy: '质控组', reportedAt: '2026-04-03' },
  { id: 'df-102', defectType: '服务缺陷', description: 'MRI 检查预约平均等待 6.5 天, 患者投诉增多', severity: 'medium', status: 'in_progress', reportedBy: '服务中心', reportedAt: '2026-05-12' },
  { id: 'df-103', defectType: '流程缺陷', description: 'CT 增强知情同意书签署完整率仅 91%', severity: 'medium', status: 'open', reportedBy: '质控组', reportedAt: '2026-06-05' },
  { id: 'df-104', defectType: '设备缺陷', description: '移动 DR 图像上传 PACS 平均延迟 95 秒', severity: 'medium', status: 'in_progress', reportedBy: '王技师', reportedAt: '2026-06-18' },
  { id: 'df-105', defectType: '流程缺陷', description: '疑难报告双签名平均流转 3.5 小时超时', severity: 'medium', status: 'open', reportedBy: '张主任', reportedAt: '2026-07-12' },
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
  private actions: PdcaAction[] = []
  private findings: PdcaFinding[] = []
  // [G005 Wave 10A] 起始计数 1000, 避免与 seed 周期 id (pdca-10x) 冲突
  private idCounter = 1000

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
      // [G005 Wave 10A] 5 个完整 PDCA 示例周期 (4 阶段齐全)
      mkCycle('pdca-101', '增强扫描对比剂外渗事件专项', '流程质控', '降低静脉注射对比剂外渗发生率', '外渗率 ≤ 0.3%', OWNERS[2]!, 'completed', '2026-04-01', '2026-05-31', ['df-101'], '2026-05-28', '外渗率从 0.9% 降至 0.2%, 高压注射流程 SOP 已更新'),
      mkCycle('pdca-102', 'MRI 检查预约等待时间整改', '服务质控', '缩短 MRI 检查预约等待天数', '预约等待 ≤ 3 天', OWNERS[0]!, 'act', '2026-05-10', '2026-07-20', ['df-102'], undefined, '排班扩容后平均等待 2.8 天, 进入持续监测'),
      mkCycle('pdca-103', 'CT 检查前知情同意完整性', '报告质控', '提升 CT 增强知情同意书签署完整率', '签署完整率 ≥ 99%', OWNERS[1]!, 'check', '2026-06-01', '2026-08-10', ['df-103'], undefined, undefined),
      mkCycle('pdca-104', '移动 DR 图像传输延迟优化', '图像质控', '降低床旁 DR 图像上传 PACS 延迟', '上传延迟 ≤ 60 秒', OWNERS[2]!, 'do', '2026-06-15', '2026-08-31', ['df-104'], undefined, undefined),
      mkCycle('pdca-105', '报告双签名流程效率提升', '流程质控', '缩短疑难报告双签名流转时间', '双签流转 ≤ 2 小时', OWNERS[0]!, 'plan', '2026-07-10', '2026-09-30', ['df-105'], undefined, undefined),
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
      // [G005 Wave 10A] 5 个完整周期: plan→do→check→act 全阶段
      'pdca-101': [
        { phase: 'plan', content: '回顾 3 月对比剂外渗事件 8 起, 分析原因(流速/穿刺部位/患者依从)' },
        { phase: 'plan', content: '制定高压注射外渗预防规范与高危患者评估表' },
        { phase: 'do', content: '组织技师操作规范培训并考核' },
        { phase: 'do', content: '上线外渗事件上报与追踪系统' },
        { phase: 'check', content: '5 月外渗率降至 0.2%, 复查 420 例增强扫描' },
        { phase: 'act', content: '更新科室高压注射 SOP, 纳入新员工岗前培训' },
      ],
      'pdca-102': [
        { phase: 'plan', content: '统计 4 月 MRI 预约平均等待 6.5 天, 瓶颈在夜间机时利用率' },
        { phase: 'plan', content: '制定延长夜班与周末加机方案' },
        { phase: 'do', content: '调整技师排班, 夜间及周六开放预约' },
        { phase: 'check', content: '7 月平均等待 2.8 天, 完成率 96%' },
        { phase: 'act', content: '固化排班方案并建立预约超时预警' },
      ],
      'pdca-103': [
        { phase: 'plan', content: '抽查 5 月 200 份增强知情同意书, 完整率 91%' },
        { phase: 'plan', content: '梳理缺失字段(过敏史/肾功能/剂量)' },
        { phase: 'do', content: '更新电子知情同意模板并增加必填校验' },
        { phase: 'check', content: '7 月复抽查完整率 97.5%, 待 8 月满月评估' },
        { phase: 'act', content: '纳入护理核对清单, 每周质控抽检' },
      ],
      'pdca-104': [
        { phase: 'plan', content: '测量床旁 DR 上传延迟平均 95 秒, 定位网络瓶颈' },
        { phase: 'plan', content: '制定 AP 带宽扩容与队列优化方案' },
        { phase: 'do', content: '升级移动 DR 网络模块并部署 QoS 策略' },
        { phase: 'check', content: '试运行两周平均延迟 48 秒, 达标率 92%' },
        { phase: 'act', content: '形成网络运维基线, 纳入月度巡检项' },
      ],
      'pdca-105': [
        { phase: 'plan', content: '梳理双签名流程耗时分布, 平均 3.5 小时' },
        { phase: 'plan', content: '确定电子签名与消息提醒优化点' },
        { phase: 'do', content: '上线签名消息提醒与超时升级机制' },
        { phase: 'check', content: '8 月运行两周平均流转 1.8 小时, 待满月复评' },
        { phase: 'act', content: '固化提醒规则并设置月度指标监测' },
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

    // [W9-QC] 整改措施 (actions) 种子: 覆盖 pending/in_progress/done/overdue
    const mkAction = (
      id: string,
      cycleId: string,
      phase: Exclude<PdcaPhaseCode, 'completed'>,
      description: string,
      owner: { id: string; name: string },
      deadline: string,
      status: PdcaActionStatus,
      completedAt?: string,
    ): PdcaAction => ({
      id, cycleId, phase, description,
      ownerId: owner.id, ownerName: owner.name,
      deadline, status, createdAt: iso('2026-05-06'), completedAt,
    })
    this.actions = [
      mkAction('act-001', 'pdca-001', 'do', '组织 2 场全员术语规范培训', OWNERS[0]!, '2026-05-30', 'done', iso('2026-05-28')),
      mkAction('act-002', 'pdca-001', 'act', '将术语规范写入科室 SOP', OWNERS[0]!, '2026-06-25', 'done', iso('2026-06-24')),
      mkAction('act-003', 'pdca-002', 'do', '模板增加造影剂描述必填字段', OWNERS[1]!, '2026-07-15', 'done', iso('2026-07-12')),
      mkAction('act-004', 'pdca-002', 'check', '7 月抽查覆盖率复核', OWNERS[1]!, '2026-08-10', 'in_progress'),
      mkAction('act-005', 'pdca-003', 'do', '上线电话复核提醒与超时预警', OWNERS[0]!, '2026-07-20', 'done', iso('2026-07-18')),
      mkAction('act-006', 'pdca-003', 'check', '满月复核率评估', OWNERS[0]!, '2026-08-05', 'overdue'),
      mkAction('act-007', 'pdca-004', 'do', '校准 3 台 DR 自动曝光参数', OWNERS[2]!, '2026-08-20', 'in_progress'),
      mkAction('act-008', 'pdca-101', 'do', '组织技师外渗预防培训并考核', OWNERS[2]!, '2026-04-30', 'done', iso('2026-04-28')),
      mkAction('act-009', 'pdca-101', 'check', '复查 420 例增强扫描外渗率', OWNERS[2]!, '2026-05-20', 'done', iso('2026-05-18')),
      mkAction('act-010', 'pdca-102', 'do', '调整技师排班, 夜间及周六开放预约', OWNERS[0]!, '2026-06-15', 'done', iso('2026-06-14')),
      mkAction('act-011', 'pdca-102', 'act', '固化排班方案并建立预约超时预警', OWNERS[0]!, '2026-07-15', 'in_progress'),
      mkAction('act-012', 'pdca-103', 'do', '更新电子知情同意模板并增加必填校验', OWNERS[1]!, '2026-07-01', 'done', iso('2026-06-30')),
      mkAction('act-013', 'pdca-104', 'do', '升级移动 DR 网络模块并部署 QoS', OWNERS[2]!, '2026-07-31', 'pending'),
      mkAction('act-014', 'pdca-105', 'plan', '梳理双签名流程耗时分布', OWNERS[0]!, '2026-07-25', 'overdue'),
    ]

    // [W9-QC] 问题发现 (findings) 种子
    this.findings = [
      { id: 'find-001', cycleId: 'pdca-001', title: '模糊表述占比偏高', description: '4-5 月 600 份报告中模糊表述占比 8.3%', severity: 'medium', source: '抽样质控', createdAt: iso('2026-05-06') },
      { id: 'find-002', cycleId: 'pdca-002', title: '增强报告字段缺失', description: 'CT 增强报告造影剂描述缺失率 18%', severity: 'high', source: '结构化校验', createdAt: iso('2026-06-10') },
      { id: 'find-003', cycleId: 'pdca-003', title: '危急值复核断点', description: '口头通知后 30 分钟未电话复核占 4%', severity: 'high', source: '流程审计', createdAt: iso('2026-06-20') },
      { id: 'find-004', cycleId: 'pdca-101', title: '对比剂外渗超标', description: '3 月外渗率 0.9% 超国标目标 0.3%', severity: 'high', source: '不良事件上报', createdAt: iso('2026-04-01') },
      { id: 'find-005', cycleId: 'pdca-102', title: 'MRI 预约等待过长', description: '4 月平均等待 6.5 天', severity: 'medium', source: '运营统计', createdAt: iso('2026-05-10') },
      { id: 'find-006', cycleId: 'pdca-104', title: '床旁 DR 传输延迟', description: '移动 DR 上传 PACS 平均延迟 95 秒', severity: 'medium', source: '设备巡检', createdAt: iso('2026-06-15') },
    ]
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

  // ================= [W9-QC] 整改措施 / 问题发现 (持久化模型扩展) =================

  private findAction(id: string): PdcaAction {
    const action = this.actions.find((a) => a.id === id)
    if (!action) throw new NotFoundException(`整改措施 ${id} 不存在`)
    return action
  }

  private deriveActionStatus(a: PdcaAction): PdcaAction {
    if (a.status !== 'done' && Date.parse(a.deadline) < Date.parse('2026-08-14')) {
      return { ...a, status: 'overdue' }
    }
    return a
  }

  listActions(cycleId: string): PdcaAction[] {
    this.findCycle(cycleId)
    return this.actions.filter((a) => a.cycleId === cycleId).map((a) => this.deriveActionStatus({ ...a }))
  }

  addAction(cycleId: string, body: { description: string; phase?: Exclude<PdcaPhaseCode, 'completed'>; ownerId?: string; deadline?: string }): PdcaAction {
    this.findCycle(cycleId)
    if (!body.description?.trim()) throw new BadRequestException('description 不能为空')
    const phase = body.phase ?? 'plan'
    if (!PDCA_PHASE_ORDER.includes(phase)) throw new BadRequestException(`阶段必须为 ${PDCA_PHASE_ORDER.join('|')}`)
    const owner = OWNERS.find((o) => o.id === body.ownerId) ?? OWNERS[0]!
    const action: PdcaAction = {
      id: this.nextId('act'),
      cycleId,
      phase,
      description: body.description.trim(),
      ownerId: owner.id,
      ownerName: owner.name,
      deadline: body.deadline ?? daysAfter('2026-08-14', 30),
      status: 'pending',
      createdAt: iso('2026-08-14'),
    }
    this.actions.push(action)
    return { ...action }
  }

  updateAction(id: string, body: Partial<{ description: string; phase: Exclude<PdcaPhaseCode, 'completed'>; ownerId: string; deadline: string; status: PdcaActionStatus }>): PdcaAction {
    const action = this.findAction(id)
    if (body.description !== undefined) {
      if (!body.description.trim()) throw new BadRequestException('description 不能为空')
      action.description = body.description.trim()
    }
    if (body.phase !== undefined) {
      if (!PDCA_PHASE_ORDER.includes(body.phase)) throw new BadRequestException('阶段不合法')
      action.phase = body.phase
    }
    if (body.ownerId !== undefined) {
      const owner = OWNERS.find((o) => o.id === body.ownerId)
      if (owner) {
        action.ownerId = owner.id
        action.ownerName = owner.name
      }
    }
    if (body.deadline !== undefined) action.deadline = body.deadline
    if (body.status !== undefined) {
      action.status = body.status
      if (body.status === 'done') action.completedAt = action.completedAt ?? iso('2026-08-14')
    }
    return { ...action }
  }

  completeAction(id: string): PdcaAction {
    const action = this.findAction(id)
    if (action.status === 'done') throw new BadRequestException('整改措施已完成')
    action.status = 'done'
    action.completedAt = iso('2026-08-14')
    return { ...action }
  }

  deleteAction(id: string): { id: string; deleted: true } {
    this.findAction(id)
    this.actions = this.actions.filter((a) => a.id !== id)
    return { id, deleted: true }
  }

  listFindings(cycleId: string): PdcaFinding[] {
    this.findCycle(cycleId)
    return this.findings.filter((f) => f.cycleId === cycleId).map((f) => ({ ...f }))
  }

  addFinding(cycleId: string, body: { title: string; description?: string; severity?: PdcaFinding['severity']; source?: string }): PdcaFinding {
    this.findCycle(cycleId)
    if (!body.title?.trim()) throw new BadRequestException('title 不能为空')
    const severity = body.severity ?? 'medium'
    if (!['low', 'medium', 'high', 'critical'].includes(severity)) throw new BadRequestException('severity 不合法')
    const finding: PdcaFinding = {
      id: this.nextId('find'),
      cycleId,
      title: body.title.trim(),
      description: body.description?.trim() ?? '',
      severity,
      source: body.source?.trim() ?? '质控发现',
      createdAt: iso('2026-08-14'),
    }
    this.findings.push(finding)
    return { ...finding }
  }

  async getMetrics(): Promise<{ source: 'database' | 'demo'; generatedAt: string; data: PdcaMetrics }> {
    const actions = this.actions.map((a) => this.deriveActionStatus(a))
    const done = actions.filter((a) => a.status === 'done').length
    const overdue = actions.filter((a) => a.status === 'overdue').length
    const byStatus: Record<PdcaActionStatus, number> = { pending: 0, in_progress: 0, done: 0, overdue: 0 }
    const ownerMap = new Map<string, { ownerId: string; ownerName: string; total: number; done: number; overdue: number }>()
    for (const a of actions) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
      const e = ownerMap.get(a.ownerId) ?? { ownerId: a.ownerId, ownerName: a.ownerName, total: 0, done: 0, overdue: 0 }
      e.total += 1
      if (a.status === 'done') e.done += 1
      if (a.status === 'overdue') e.overdue += 1
      ownerMap.set(a.ownerId, e)
    }
    const linkedDefectCount = this.cycles.reduce((a, c) => a + c.defectIds.length, 0)
    return {
      source: 'demo',
      generatedAt: new Date().toISOString(),
      data: {
        cycleCount: this.cycles.length,
        actionCount: actions.length,
        actionDone: done,
        actionOverdue: overdue,
        actionCompletionRate: actions.length > 0 ? Math.round((done / actions.length) * 1000) / 10 : 0,
        findingCount: this.findings.length,
        byOwner: [...ownerMap.values()],
        byActionStatus: byStatus,
        defectCount: SEED_DEFECTS.length,
        linkedDefectCount,
      },
    }
  }
}
