import { Injectable } from '@nestjs/common'
import { v4 as uuid } from 'uuid'
import { PrismaService } from '../../prisma/prisma.service'

export interface RoutingRule {
  id: string
  name: string
  modality: string
  bodyPart: string
  patientStatus: string
  maxLoad: number
  priority: number
  enabled: boolean
}

export interface Assignment {
  id: string
  studyId: string
  patientName: string
  modality: string
  assignedTo: string
  ruleName: string
  assignedAt: string
  stage: 'qualification' | 'load-balance' | 'priority' | 'fallback'
  qualification?: string
  reason?: string
}

export interface DoctorQualification {
  doctorId: string
  name: string
  subspecialty: string
  modality: string[]
  bodyParts: string[]
  qualifications: string[]
  currentLoad: number
  maxLoad: number
  priority: number
  /** 历史报告质量准确率 (0-1, 由 ReportQualityScore 聚合, DB 不可用回退 seed) */
  accuracy: number
}

export interface RecommendInput {
  modality: string
  bodyPart: string
  patientStatus: string
}

export interface DoctorRecommendation {
  doctorId: string
  name: string
  subspecialty: string
  qualified: boolean
  matchScore: number
  currentLoad: number
  maxLoad: number
  accuracy: number
  composite: number
  reasons: string[]
}

const DEFAULT_RULES: RoutingRule[] = [
  { id: 'rr-001', name: 'CT Chest - Senior', modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient', maxLoad: 10, priority: 1, enabled: true },
  { id: 'rr-002', name: 'MR Brain - Specialist', modality: 'MR', bodyPart: 'Brain', patientStatus: 'Any', maxLoad: 8, priority: 2, enabled: true },
  { id: 'rr-003', name: 'DX Routine', modality: 'DX', bodyPart: 'Any', patientStatus: 'Outpatient', maxLoad: 20, priority: 3, enabled: true },
  { id: 'rr-004', name: 'CT Emergency', modality: 'CT', bodyPart: 'Any', patientStatus: 'Emergency', maxLoad: 5, priority: 0, enabled: true },
]

const DEFAULT_HISTORY: Assignment[] = [
  { id: 'as-001', studyId: 'STU001', patientName: 'Zhang San', modality: 'CT', assignedTo: 'Dr. Wang', ruleName: 'CT Chest - Senior', assignedAt: '2026-07-10T08:30:00Z', stage: 'load-balance', qualification: '胸部影像', reason: '资质匹配→负载均衡' },
  { id: 'as-002', studyId: 'STU002', patientName: 'Li Si', modality: 'MR', assignedTo: 'Dr. Li', ruleName: 'MR Brain - Specialist', assignedAt: '2026-07-10T09:00:00Z', stage: 'qualification', qualification: '神经影像', reason: '资质匹配' },
]

// 医生亚专科资质表 (无 Prisma 模型,内存 seed; 负载/准确率运行时用 DB 信号覆盖)
const DEFAULT_QUALIFICATIONS: DoctorQualification[] = [
  { doctorId: 'doc-001', name: 'Dr. Wang', subspecialty: '胸部影像', modality: ['CT', 'DX'], bodyParts: ['Chest', '胸部'], qualifications: ['CT 高级资质', '胸部亚专科'], currentLoad: 3, maxLoad: 10, priority: 1, accuracy: 0.94 },
  { doctorId: 'doc-002', name: 'Dr. Li', subspecialty: '神经影像', modality: ['MR', 'CT'], bodyParts: ['Brain', '头部', '头颅'], qualifications: ['MR 神经专科', '造影资质'], currentLoad: 2, maxLoad: 8, priority: 2, accuracy: 0.97 },
  { doctorId: 'doc-003', name: 'Dr. Zhang', subspecialty: '急诊影像', modality: ['CT', 'DX'], bodyParts: ['Any'], qualifications: ['急诊资质', '危急值处理'], currentLoad: 5, maxLoad: 5, priority: 0, accuracy: 0.88 },
  { doctorId: 'doc-004', name: 'Dr. Liu', subspecialty: '腹部影像', modality: ['MR', 'CT', 'US'], bodyParts: ['Abdomen', '腹部'], qualifications: ['腹部亚专科'], currentLoad: 6, maxLoad: 12, priority: 3, accuracy: 0.92 },
  { doctorId: 'doc-005', name: 'Dr. Chen', subspecialty: '骨科影像', modality: ['DX', 'CT'], bodyParts: ['Any'], qualifications: ['骨科亚专科'], currentLoad: 4, maxLoad: 20, priority: 4, accuracy: 0.9 },
]

// 未完成报告状态 (计入当日负载: 尚未 SIGNED 的报告)
const UNFINISHED_REPORT_STATES = [
  'PENDING_ASSIGNMENT', 'ASSIGNED', 'WRITING', 'SUBMITTED', 'INITIAL_REVIEW',
  'FINAL_REVIEW', 'CO_SIGN_REVIEW', 'REVIEWED', 'SIGNING', 'AMENDING',
  'RECTIFYING', 'SUPPLEMENTING', 'REDISTRIBUTING',
]

@Injectable()
export class SmartRouteService {
  private fallbackRules: RoutingRule[] = [...DEFAULT_RULES]
  private history: Assignment[] = [...DEFAULT_HISTORY]
  private qualifications: DoctorQualification[] = DEFAULT_QUALIFICATIONS.map(q => ({ ...q, modality: [...q.modality], bodyParts: [...q.bodyParts], qualifications: [...q.qualifications] }))

  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: { id: string; name: string; priority: number; condition: unknown; action: unknown; enabled: boolean; order: number }): RoutingRule {
    const condition = (row.condition ?? {}) as { modality?: string; bodyPart?: string; patientStatus?: string; maxLoad?: number }
    return {
      id: row.id,
      name: row.name,
      modality: condition.modality ?? 'Any',
      bodyPart: condition.bodyPart ?? 'Any',
      patientStatus: condition.patientStatus ?? 'Any',
      maxLoad: condition.maxLoad ?? 10,
      priority: row.priority,
      enabled: row.enabled,
    }
  }

  private conditionOf(r: RoutingRule): { modality: string; bodyPart: string; patientStatus: string; maxLoad: number } {
    return { modality: r.modality, bodyPart: r.bodyPart, patientStatus: r.patientStatus, maxLoad: r.maxLoad }
  }

  /**
   * 运行时真实信号 (DB 可用时覆盖 seed):
   * - 负载: Report 表中该医生未完成报告数 (当日未完成报告数)
   * - 准确率: ReportQualityScore 平均分 / 100 (经 Report.radiologistId 归因到医生)
   * DB 不可用/表不存在时静默回退 seed, 不影响路由主流程。
   */
  private async loadDbSignals(): Promise<{ loads: Map<string, number>; accuracies: Map<string, number> }> {
    const loads = new Map<string, number>()
    const accuracies = new Map<string, number>()
    const ids = this.qualifications.map(q => q.doctorId)
    try {
      const grouped = await this.prisma.report.groupBy({
        by: ['radiologistId'],
        where: { radiologistId: { in: ids }, state: { in: UNFINISHED_REPORT_STATES as any } },
        _count: { radiologistId: true },
      })
      for (const row of grouped) {
        if (row.radiologistId) loads.set(row.radiologistId, row._count.radiologistId ?? 0)
      }
    } catch {
      // DB unavailable - keep seeded loads
    }
    try {
      const rows = await this.prisma.reportQualityScore.findMany({
        where: { report: { radiologistId: { in: ids } } },
        select: { totalScore: true, report: { select: { radiologistId: true } } },
        take: 500,
      })
      const sums = new Map<string, { sum: number; n: number }>()
      for (const row of rows) {
        const rid = row.report?.radiologistId
        if (!rid) continue
        const cur = sums.get(rid) ?? { sum: 0, n: 0 }
        cur.sum += row.totalScore
        cur.n += 1
        sums.set(rid, cur)
      }
      for (const [rid, v] of sums) accuracies.set(rid, +(v.sum / v.n / 100).toFixed(3))
    } catch {
      // DB unavailable - keep seeded accuracy
    }
    return { loads, accuracies }
  }

  /**
   * 资质感知推荐: 检查模态/亚专科 → 医生资质 (specialty/certifications 语义, seed 表) + 负载均衡 + 历史准确率
   * 综合分 = 0.5*资质匹配度 + 0.3*负载余量 + 0.2*历史准确率
   */
  async recommend(input: RecommendInput): Promise<DoctorRecommendation[]> {
    const { loads, accuracies } = await this.loadDbSignals()
    const candidates: DoctorRecommendation[] = this.qualifications.map(q => {
      const currentLoad = loads.get(q.doctorId) ?? q.currentLoad
      const accuracy = accuracies.get(q.doctorId) ?? q.accuracy
      const exactBodyPart = q.bodyParts.includes(input.bodyPart)
      const anyBodyPart = q.bodyParts.includes('Any')
      const modalityMatch = q.modality.includes(input.modality)
      // 亚专科精确匹配 > 通用资质(Any) > 仅模态匹配
      const matchScore = modalityMatch && exactBodyPart ? 1 : modalityMatch && anyBodyPart ? 0.8 : modalityMatch ? 0.5 : 0
      const loadScore = q.maxLoad <= 0 ? 0 : Math.max(0, 1 - currentLoad / q.maxLoad)
      const composite = +(0.5 * matchScore + 0.3 * loadScore + 0.2 * accuracy).toFixed(3)
      const reasons: string[] = []
      if (matchScore >= 1) reasons.push(`资质匹配: 模态+亚专科精确匹配(${q.subspecialty})`)
      else if (matchScore >= 0.8) reasons.push(`通用资质匹配: 可接诊任意部位(${q.subspecialty})`)
      else if (matchScore >= 0.5) reasons.push(`仅模态匹配(${q.subspecialty}), 亚专科需复核`)
      else reasons.push('无匹配资质')
      reasons.push(currentLoad < q.maxLoad
        ? `负载 ${currentLoad}/${q.maxLoad}, 可接诊`
        : `负载已满 ${currentLoad}/${q.maxLoad}, 不建议接诊`)
      reasons.push(`历史准确率 ${(accuracy * 100).toFixed(0)}分`)
      return {
        doctorId: q.doctorId, name: q.name, subspecialty: q.subspecialty,
        qualified: matchScore > 0, matchScore, currentLoad, maxLoad: q.maxLoad,
        accuracy, composite, reasons,
      }
    })
    candidates.sort((a, b) => b.composite - a.composite || b.matchScore - a.matchScore || a.currentLoad - b.currentLoad)
    return candidates
  }

  /**
   * 三级路由: 规则匹配 → 资质感知推荐 (推荐列表 top-1 或指定 doctorId) → 负载/优先级兜底
   */
  async assign(studyId: string, patientName: string, modality: string, bodyPart: string, patientStatus: string, doctorId?: string): Promise<Assignment> {
    let rules: RoutingRule[]
    try {
      await this.ensureSeeded()
      const rows = await this.prisma.smartRouteRule.findMany({ orderBy: { order: 'asc' } })
      rules = rows.map(r => this.toDto(r))
    } catch {
      rules = this.fallbackRules
    }
    const matched = rules
      .filter(r => r.enabled && (r.modality === modality || r.modality === 'Any') && (r.bodyPart === bodyPart || r.bodyPart === 'Any') && (r.patientStatus === patientStatus || r.patientStatus === 'Any'))
      .sort((a, b) => a.priority - b.priority)
    const rule = matched[0] || rules[0]

    const ranked = await this.recommend({ modality, bodyPart, patientStatus })
    const qualified = ranked.filter(r => r.qualified)
    let doctor: DoctorRecommendation | undefined
    let stage: Assignment['stage'] = 'fallback'
    let reason = '无匹配资质,按规则兜底分配'
    if (doctorId) {
      const forced = ranked.find(r => r.doctorId === doctorId)
      if (forced && forced.matchScore >= 0.8) {
        doctor = forced
        stage = 'qualification'
        reason = `资质匹配(${doctor.subspecialty})→按推荐指定分配,推荐分${(doctor.composite * 100).toFixed(0)}`
      }
    }
    if (!doctor && qualified.length > 0) {
      doctor = qualified[0]
      if (doctor.currentLoad < doctor.maxLoad) {
        stage = 'load-balance'
        reason = `资质匹配(${doctor.subspecialty})→负载均衡(${doctor.currentLoad}/${doctor.maxLoad})→历史准确率${(doctor.accuracy * 100).toFixed(0)}%`
      } else {
        stage = 'priority'
        const base = this.qualifications.find(q => q.doctorId === doctor!.doctorId)
        reason = `资质匹配(${doctor.subspecialty})→满载,按优先级(${base?.priority ?? 9})`
      }
    }
    const baseQual = this.qualifications.find(q => q.doctorId === doctor?.doctorId)
    if (baseQual) baseQual.currentLoad += 1

    const assignment: Assignment = {
      id: `as-${uuid().slice(0, 6)}`, studyId, patientName, modality,
      assignedTo: doctor ? doctor.name : `Dr. ${['Wang', 'Li', 'Zhang', 'Liu', 'Chen'][Math.floor(Math.random() * 5)]}`,
      ruleName: rule.name, assignedAt: new Date().toISOString(),
      stage,
      qualification: doctor?.subspecialty,
      reason,
    }
    this.history.push(assignment)
    return assignment
  }

  private async ensureSeeded(): Promise<void> {
    const count = await this.prisma.smartRouteRule.count()
    if (count > 0) return
    await this.prisma.smartRouteRule.createMany({
      data: DEFAULT_RULES.map((r, i) => ({
        id: r.id,
        name: r.name,
        priority: r.priority,
        condition: this.conditionOf(r),
        action: {},
        enabled: r.enabled,
        order: i,
      })),
      skipDuplicates: true,
    })
  }

  /** 医生亚专科资质列表 (内存 seed) */
  getQualifications(): DoctorQualification[] {
    return this.qualifications.map(q => ({ ...q, modality: [...q.modality], bodyParts: [...q.bodyParts], qualifications: [...q.qualifications] }))
  }

  async getRules(): Promise<RoutingRule[]> {
    try {
      await this.ensureSeeded()
      const rows = await this.prisma.smartRouteRule.findMany({ orderBy: { order: 'asc' } })
      return rows.map(r => this.toDto(r))
    } catch {
      return this.fallbackRules.map(r => ({ ...r }))
    }
  }

  async updateRules(newRules: RoutingRule[]): Promise<RoutingRule[]> {
    try {
      await this.prisma.smartRouteRule.deleteMany({})
      await this.prisma.smartRouteRule.createMany({
        data: newRules.map((r, i) => ({
          id: r.id,
          name: r.name,
          priority: r.priority,
          condition: this.conditionOf(r),
          action: {},
          enabled: r.enabled,
          order: i,
        })),
      })
      const rows = await this.prisma.smartRouteRule.findMany({ orderBy: { order: 'asc' } })
      return rows.map(r => this.toDto(r))
    } catch {
      this.fallbackRules = newRules.map(r => ({ ...r }))
      return this.fallbackRules.map(r => ({ ...r }))
    }
  }

  getHistory(): Assignment[] {
    return this.history
  }

  stats() {
    const total = this.history.length
    const byModality: Record<string, number> = {}
    const byDoctor: Record<string, number> = {}
    this.history.forEach(h => {
      byModality[h.modality] = (byModality[h.modality] || 0) + 1
      byDoctor[h.assignedTo] = (byDoctor[h.assignedTo] || 0) + 1
    })
    return { total, byModality, byDoctor }
  }
}
