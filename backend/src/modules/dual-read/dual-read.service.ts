import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { floatInRange, hashString } from '../../common/utils/deterministic-hash'

export interface DualReadAssignment {
  id: string
  studyId: string
  patientName: string
  patientId: string
  modality: string
  reader1Id: string
  reader1Name: string
  reader2Id: string
  reader2Name: string
  report1?: string
  report2?: string
  status: 'pending' | 'reader1_done' | 'reader2_done' | 'both_done' | 'arbitrated' | 'completed'
  discrepancyScore?: number
  arbitrationReport?: string
  arbitratorId?: string
  arbitratorName?: string
  createdAt: string
  /** true = 内存回退 (DB 不可用, 未落库) */
  simulated?: boolean
}

export interface DualReadRow {
  id: string
  reportId: string | null
  studyId: string | null
  patientId: string
  patientName: string
  modality: string
  reader1Id: string
  reader1Name: string
  reader2Id: string
  reader2Name: string
  report1: string | null
  report2: string | null
  status: string
  discrepancyScore: number | null
  arbitrationReport: string | null
  arbitratorId: string | null
  arbitratorName: string | null
  createdAt: Date
}

// [G-21 Wave3C] 双阅 → 报告自动关联
export interface DualReadReportLink {
  reportId: string
  examId: string | null
  state: string
  impression: string
  created: boolean
}

export interface DualReadCompleteResult {
  assignment: DualReadAssignment
  report: DualReadReportLink | null
  created: boolean
}

interface MemoryReportLink extends DualReadReportLink {}

const memoryReportLinks = new Map<string, MemoryReportLink>()

// ================= [W9-QC] 抽查 + 双盲 + 一致性 (kappa) =================

export type SamplingMethod = 'random' | 'low_yield' | 'stratified'
export type SamplingReadingResult = 'positive' | 'negative' | 'indeterminate'

export interface SamplingReading {
  readerSlot: 1 | 2
  readerId: string
  readerName: string
  result: SamplingReadingResult
  report?: string
  recordedAt: string
}

export interface SamplingItem {
  itemId: string
  reportId: string
  studyId: string
  patientId: string
  patientName: string
  modality: string
  yielder: 'high' | 'low'
  stratum: string
  readings: SamplingReading[]
}

export interface SamplingBatch {
  id: string
  name: string
  method: SamplingMethod
  blind: boolean
  targetSize: number
  modality?: string
  dateFrom?: string
  dateTo?: string
  status: 'open' | 'closed'
  createdBy: string
  createdAt: string
  items: SamplingItem[]
}

/** 双盲视图: 隐藏评审人身份 + 已录入结果 (仅暴露已录入数量) */
export interface SamplingItemView {
  itemId: string
  reportId: string
  patientName: string
  modality: string
  yielder: 'high' | 'low'
  stratum: string
  recordedCount: number
  readings: Array<{ readerSlot: 1 | 2; readerLabel: string; result: SamplingReadingResult | null; recordedAt: string }>
}

export interface SamplingBatchView {
  id: string
  name: string
  method: SamplingMethod
  blind: boolean
  targetSize: number
  modality?: string
  status: 'open' | 'closed'
  createdBy: string
  createdAt: string
  itemCount: number
  items: SamplingItemView[]
}

export interface AgreementResult {
  evaluatedItems: number
  positiveAgreement: number
  negativeAgreement: number
  agreementRate: number
  observedAgreement: number
  expectedAgreement: number
  kappa: number
  interpretation: string
}

/** 双阅结论文本: 仲裁报告优先, 否则合并两位阅片医师结论 */
export function dualReadConclusion(a: Pick<DualReadAssignment, 'arbitrationReport' | 'report1' | 'report2' | 'reader1Name' | 'reader2Name'>): string {
  if (a.arbitrationReport && a.arbitrationReport.trim()) return a.arbitrationReport.trim()
  const parts: string[] = []
  if (a.report1?.trim()) parts.push(`阅片医师一(${a.reader1Name}): ${a.report1.trim()}`)
  if (a.report2?.trim()) parts.push(`阅片医师二(${a.reader2Name}): ${a.report2.trim()}`)
  if (parts.length === 0) return '双阅完成, 未见明确阳性征象。'
  return parts.join('\n')
}

const doctors = [
  { id: 'dr-001', name: 'Dr. Wang' },
  { id: 'dr-002', name: 'Dr. Li' },
  { id: 'dr-003', name: 'Dr. Zhang' },
  { id: 'dr-004', name: 'Dr. Liu' },
  { id: 'dr-005', name: 'Dr. Chen' },
]

/** [W9-QC] 抽查报告种子池 (确定性, 供抽样) */
const SAMPLING_POOL: Array<{ reportId: string; studyId: string; patientId: string; patientName: string; modality: string; yielder: 'high' | 'low' }> = (() => {
  const pool: Array<{ reportId: string; studyId: string; patientId: string; patientName: string; modality: string; yielder: 'high' | 'low' }> = []
  const names = ['张伟', '李秀英', '王建国', '刘敏', '陈杰', '赵敏', '孙丽', '周强', '吴静', '郑磊', '冯娜', '蒋涛']
  const modalities = ['CT', 'MR', 'DR', 'MG']
  for (let i = 1; i <= 120; i++) {
    const modality = modalities[i % modalities.length]!
    pool.push({
      reportId: `RPT-QC-${String(i).padStart(3, '0')}`,
      studyId: `STU-QC-${String(i).padStart(3, '0')}`,
      patientId: `P${String(100 + i)}`,
      patientName: names[i % names.length]!,
      modality,
      yielder: i % 6 === 0 ? 'low' : 'high',
    })
  }
  return pool
})()

/** [W9-QC] Cohen's kappa (二分类) */
export function computeKappa(pairs: Array<{ a: 'positive' | 'negative'; b: 'positive' | 'negative' }>): AgreementResult {
  const n = pairs.length
  if (n === 0) {
    return { evaluatedItems: 0, positiveAgreement: 0, negativeAgreement: 0, agreementRate: 0, observedAgreement: 0, expectedAgreement: 0, kappa: 0, interpretation: '无可用双读结果' }
  }
  let bothPos = 0
  let bothNeg = 0
  let aPos = 0
  let bPos = 0
  for (const { a, b } of pairs) {
    if (a === 'positive') aPos += 1
    if (b === 'positive') bPos += 1
    if (a === 'positive' && b === 'positive') bothPos += 1
    if (a === 'negative' && b === 'negative') bothNeg += 1
  }
  const po = (bothPos + bothNeg) / n
  const pe = (aPos / n) * (bPos / n) + (1 - aPos / n) * (1 - bPos / n)
  const kappa = pe >= 1 ? 1 : Math.round(((po - pe) / (1 - pe)) * 1000) / 1000
  const interpretation =
    kappa >= 0.81 ? '几乎完全一致' : kappa >= 0.61 ? '高度一致' : kappa >= 0.41 ? '中度一致' : kappa >= 0.21 ? '一般一致' : kappa >= 0 ? '轻微一致' : '低于随机'
  return {
    evaluatedItems: n,
    positiveAgreement: bothPos,
    negativeAgreement: bothNeg,
    agreementRate: Math.round((po * 100) * 10) / 10,
    observedAgreement: Math.round(po * 1000) / 1000,
    expectedAgreement: Math.round(pe * 1000) / 1000,
    kappa,
    interpretation,
  }
}

const memoryAssignments: DualReadAssignment[] = [
  {
    id: 'da-001', studyId: 'STU001', patientName: 'Zhang San', patientId: 'P001', modality: 'CT',
    reader1Id: 'dr-001', reader1Name: 'Dr. Wang', reader2Id: 'dr-002', reader2Name: 'Dr. Li',
    report1: '右肺上叶见磨玻璃结节，大小约1.2cm×0.8cm，边界欠清。',
    report2: '右肺上叶磨玻璃密度影，建议密切随访。',
    status: 'both_done', discrepancyScore: 0.15, createdAt: '2026-07-10T08:00:00Z', simulated: true,
  },
  {
    id: 'da-002', studyId: 'STU002', patientName: 'Li Si', patientId: 'P002', modality: 'MR',
    reader1Id: 'dr-001', reader1Name: 'Dr. Wang', reader2Id: 'dr-003', reader2Name: 'Dr. Zhang',
    report1: '左侧基底节区急性梗死灶。',
    report2: '左侧基底节区急性期脑梗死，建议DWI序列复查。',
    status: 'arbitrated', discrepancyScore: 0.05, arbitrationReport: '左侧基底节区急性脑梗死，建议临床干预。', arbitratorId: 'dr-005', arbitratorName: 'Dr. Chen', createdAt: '2026-07-09T10:00:00Z', simulated: true,
  },
  {
    id: 'da-003', studyId: 'STU003', patientName: 'Wang Wu', patientId: 'P003', modality: 'DX',
    reader1Id: 'dr-002', reader1Name: 'Dr. Li', reader2Id: 'dr-004', reader2Name: 'Dr. Liu',
    status: 'pending', createdAt: '2026-07-11T09:00:00Z', simulated: true,
  },
]

/** 确定性双人指派: 同 (studyId, patientId, modality) 恒定同一对医生 */
function pickReaders(studyId: string, patientId: string, modality: string): { reader1Id: string; reader1Name: string; reader2Id: string; reader2Name: string } {
  const h = hashString(`${studyId}:${patientId}:${modality}`)
  const first = doctors[h % doctors.length]
  let second = doctors[(h >>> 8) % doctors.length]
  if (second.id === first.id) second = doctors[(second.id === doctors[0].id ? 1 : 0)]
  return {
    reader1Id: first.id,
    reader1Name: first.name,
    reader2Id: second.id,
    reader2Name: second.name,
  }
}

/** 确定性差异度: 同 (id, report) 恒定 0.01-0.45 */
function discrepancyOf(id: string, report: string): number {
  return floatInRange(`${id}:${report}`, 0.01, 0.45, 0, 2)
}

function toDto(row: DualReadRow, simulated: boolean): DualReadAssignment {
  return {
    id: row.id,
    studyId: row.studyId ?? '',
    patientName: row.patientName,
    patientId: row.patientId,
    modality: row.modality,
    reader1Id: row.reader1Id,
    reader1Name: row.reader1Name,
    reader2Id: row.reader2Id,
    reader2Name: row.reader2Name,
    report1: row.report1 ?? undefined,
    report2: row.report2 ?? undefined,
    status: row.status as DualReadAssignment['status'],
    discrepancyScore: row.discrepancyScore ?? undefined,
    arbitrationReport: row.arbitrationReport ?? undefined,
    arbitratorId: row.arbitratorId ?? undefined,
    arbitratorName: row.arbitratorName ?? undefined,
    createdAt: row.createdAt.toISOString(),
    ...(simulated ? { simulated: true } : {}),
  }
}

@Injectable()
export class DualReadService {
  private samplingBatches: SamplingBatch[] = []
  private samplingSeq = 0

  constructor(private readonly prisma: PrismaService) {
    void this.prisma
  }

  /** assign: 从 Report 表查待分配报告 (PENDING_ASSIGNMENT 或匹配 studyId/patient) 关联 reportId */
  async assign(studyId: string, patientName: string, patientId: string, modality: string): Promise<DualReadAssignment> {
    const pair = pickReaders(studyId, patientId, modality)
    try {
      const pendingReport = await this.prisma.report.findFirst({
        where: {
          OR: [
            { exam: { accessionNumber: studyId } },
            { patientId, state: 'PENDING_ASSIGNMENT' },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
      const created = await this.prisma.dualReadAssignment.create({
        data: {
          reportId: pendingReport?.id ?? null,
          studyId,
          patientId,
          patientName,
          modality,
          reader1Id: pair.reader1Id,
          reader1Name: pair.reader1Name,
          reader2Id: pair.reader2Id,
          reader2Name: pair.reader2Name,
          status: 'pending',
        },
      })
      return toDto(created, false)
    } catch {
      const assignment: DualReadAssignment = {
        id: `da-mem-${hashString(`${studyId}:${patientId}`).toString(16).slice(0, 8)}`,
        studyId, patientName, patientId, modality,
        ...pair,
        status: 'pending',
        createdAt: new Date().toISOString(),
        simulated: true,
      }
      memoryAssignments.unshift(assignment)
      return assignment
    }
  }

  async arbitrate(id: string, arbitratorId: string, arbitratorName: string, report: string): Promise<DualReadAssignment> {
    const score = discrepancyOf(id, report)
    try {
      const updated = await this.prisma.dualReadAssignment.update({
        where: { id },
        data: {
          arbitratorId,
          arbitratorName,
          arbitrationReport: report,
          discrepancyScore: score,
          status: 'arbitrated',
        },
      })
      return toDto(updated, false)
    } catch {
      const a = memoryAssignments.find((x) => x.id === id)
      if (!a) throw new NotFoundException('Assignment not found')
      a.arbitratorId = arbitratorId
      a.arbitratorName = arbitratorName
      a.arbitrationReport = report
      a.discrepancyScore = score
      a.status = 'arbitrated'
      return { ...a }
    }
  }

  /** 提交单方阅片结果:reader1/reader2 → report1/report2,双方完成后置 both_done 并确定性计算分差 */
  async submitReader(id: string, readerNumber: 1 | 2, report: string): Promise<DualReadAssignment> {
    const field = readerNumber === 1 ? 'report1' : 'report2'
    try {
      const current = await this.prisma.dualReadAssignment.findUnique({ where: { id } })
      if (!current) throw new NotFoundException('Assignment not found')
      const otherReport = readerNumber === 1 ? current.report2 : current.report1
      const nextStatus: string = otherReport ? 'both_done' : `${readerNumber === 1 ? 'reader1' : 'reader2'}_done`
      const data: Record<string, unknown> = { [field]: report, status: nextStatus }
      if (nextStatus === 'both_done') {
        data.discrepancyScore = discrepancyOf(id, `${current.report1 ?? report}:${current.report2 ?? report}`)
      }
      const updated = await this.prisma.dualReadAssignment.update({ where: { id }, data })
      return toDto(updated, false)
    } catch (err) {
      if (err instanceof NotFoundException) throw err
      const a = memoryAssignments.find((x) => x.id === id)
      if (!a) throw new NotFoundException('Assignment not found')
      const other = readerNumber === 1 ? a.report2 : a.report1
      if (readerNumber === 1) a.report1 = report
      else a.report2 = report
      if (other) {
        a.status = 'both_done'
        a.discrepancyScore = discrepancyOf(id, `${a.report1 ?? report}:${a.report2 ?? report}`)
      } else {
        a.status = readerNumber === 1 ? 'reader1_done' : 'reader2_done'
      }
      return { ...a }
    }
  }

  async discrepancyStats(): Promise<{ total: number; arbitrated: number; avgDiscrepancy: number }> {
    try {
      const [total, arbitrated] = await Promise.all([
        this.prisma.dualReadAssignment.count(),
        this.prisma.dualReadAssignment.count({ where: { status: 'arbitrated' } }),
      ])
      const rows = await this.prisma.dualReadAssignment.findMany({
        where: { discrepancyScore: { not: null } },
        select: { discrepancyScore: true },
      })
      const scores = rows.map((r) => r.discrepancyScore as number)
      const avgDiscrepancy = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0
      return { total, arbitrated, avgDiscrepancy: Math.round(avgDiscrepancy * 100) / 100 }
    } catch {
      const scores = memoryAssignments
        .filter((a) => a.discrepancyScore != null)
        .map((a) => a.discrepancyScore as number)
      return {
        total: memoryAssignments.length,
        arbitrated: memoryAssignments.filter((a) => a.status === 'arbitrated').length,
        avgDiscrepancy: scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0,
      }
    }
  }

  async list(): Promise<DualReadAssignment[]> {
    try {
      const rows = await this.prisma.dualReadAssignment.findMany({ orderBy: { createdAt: 'desc' } })
      return rows.map((r) => toDto(r, false))
    } catch {
      return memoryAssignments.map((a) => ({ ...a }))
    }
  }

  // [G-21 Wave3C] 双阅完成 → 报告自动关联:
  //  - 已仲裁或双方完成 → 生成双阅结论文本 (仲裁报告优先)
  //  - 该检查已有报告 → 关联并写入 impression; 无报告 → 自动创建
  //  - DB 不可用 → 内存回退 (reportId 用确定性 ID 生成, simulated 语义沿用)
  async complete(id: string): Promise<DualReadCompleteResult> {
    let row: DualReadRow | null = null
    let assignment: DualReadAssignment | undefined
    try {
      row = await this.prisma.dualReadAssignment.findUnique({ where: { id } })
      if (row) assignment = toDto(row, false)
    } catch {
      assignment = undefined
    }
    if (!assignment) {
      const mem = memoryAssignments.find((x) => x.id === id)
      if (mem) assignment = { ...mem }
    }
    if (!assignment) throw new NotFoundException('Assignment not found')
    if (!['both_done', 'arbitrated'].includes(assignment.status)) {
      throw new BadRequestException('双阅尚未完成 (需双方阅片完成或已仲裁) 才能生成报告')
    }
    const conclusion = dualReadConclusion(assignment)
    let created = false

    try {
      const exam = assignment.studyId
        ? await this.prisma.exam.findFirst({ where: { accessionNumber: assignment.studyId }, select: { id: true } })
        : null
      let report: { id: string; examId: string | null; state: string; impression: string } | null = null
      if (row?.reportId) {
        const found = await this.prisma.report.findUnique({ where: { id: row.reportId } })
        if (found) report = { id: found.id, examId: found.examId, state: found.state, impression: found.impression }
      }
      if (!report) {
        const where: Record<string, unknown> = {
          state: { in: ['PENDING_ASSIGNMENT', 'ASSIGNED', 'WRITING'] },
        }
        if (exam) {
          where.OR = [{ examId: exam.id }, { patientId: assignment.patientId }]
        } else {
          where.patientId = assignment.patientId
        }
        const found = await this.prisma.report.findFirst({ where, orderBy: { createdAt: 'desc' } })
        if (found) report = { id: found.id, examId: found.examId, state: found.state, impression: found.impression }
      }
      const impression = `【双阅结论】\n${conclusion}`
      if (!report) {
        const createdReport = await this.prisma.report.create({
          data: {
            tenantId: 'default',
            patientId: assignment.patientId,
            examId: exam?.id ?? null,
            state: 'PENDING_ASSIGNMENT',
            findings: '',
            impression,
          },
        })
        report = { id: createdReport.id, examId: createdReport.examId, state: createdReport.state, impression: createdReport.impression }
        created = true
      } else {
        await this.prisma.report.update({ where: { id: report.id }, data: { impression } })
        created = false
      }
      const updatedRow = await this.prisma.dualReadAssignment.update({
        where: { id },
        data: { status: 'completed', reportId: report.id },
      })
      const link: DualReadReportLink = { reportId: report.id, examId: report.examId, state: report.state, impression: report.impression, created }
      memoryReportLinks.set(id, link)
      return { assignment: { ...toDto(updatedRow, false) }, report: link, created }
    } catch {
      const mem = memoryAssignments.find((x) => x.id === id)
      if (!mem) throw new NotFoundException('Assignment not found')
      mem.status = 'completed'
      const existing = memoryReportLinks.get(id)
      const link: DualReadReportLink = existing
        ? { ...existing }
        : {
            reportId: `rep-mem-${hashString(`${id}:${conclusion}`).toString(16).slice(0, 10)}`,
            examId: mem.studyId,
            state: 'DRAFT',
            impression: `【双阅结论】\n${conclusion}`,
            created: true,
          }
      memoryReportLinks.set(id, link)
      return { assignment: { ...mem }, report: link, created: link.created }
    }
  }

  /** [G-21 Wave3C] 关联报告信息查询 (未关联返回 { linked: false }) */
  async reportLink(id: string): Promise<{ linked: boolean; report?: DualReadReportLink }> {
    try {
      const row = await this.prisma.dualReadAssignment.findUnique({ where: { id } })
      if (!row) throw new NotFoundException('Assignment not found')
      let report: { id: string; examId: string | null; state: string; impression: string } | null = null
      if (row.reportId) {
        const found = await this.prisma.report.findUnique({ where: { id: row.reportId } })
        if (found) report = { id: found.id, examId: found.examId, state: found.state, impression: found.impression }
      }
      if (!report && row.studyId) {
        const found = await this.prisma.report.findFirst({
          where: { exam: { accessionNumber: row.studyId } },
          orderBy: { createdAt: 'desc' },
        })
        if (found) report = { id: found.id, examId: found.examId, state: found.state, impression: found.impression }
      }
      if (!report) {
        const found = await this.prisma.report.findFirst({
          where: { patientId: row.patientId, state: { in: ['PENDING_ASSIGNMENT', 'ASSIGNED', 'WRITING'] } },
          orderBy: { createdAt: 'desc' },
        })
        if (found) report = { id: found.id, examId: found.examId, state: found.state, impression: found.impression }
      }
      if (!report) return { linked: false }
      return { linked: true, report: { reportId: report.id, examId: report.examId, state: report.state, impression: report.impression, created: false } }
    } catch {
      const mem = memoryReportLinks.get(id)
      if (!mem) return { linked: false }
      return { linked: true, report: { ...mem } }
    }
  }

  // ================= [W9-QC] 抽查抽样 + 双盲 + 一致性 =================

  /** 抽样: random 均匀随机 / low_yield 低阳性率优先 / stratified 按模态分层 */
  createSamplingBatch(input: {
    name?: string
    method?: SamplingMethod
    size?: number
    modality?: string
    dateFrom?: string
    dateTo?: string
    blind?: boolean
    createdBy?: string
  }): SamplingBatch {
    const method: SamplingMethod = input.method === 'low_yield' || input.method === 'stratified' ? input.method : 'random'
    const targetSize = Math.max(1, Math.min(100, Math.floor(input.size ?? 20)))
    let pool = SAMPLING_POOL
    if (input.modality) pool = pool.filter((p) => p.modality.toUpperCase() === input.modality!.toUpperCase())
    const items: SamplingItem[] = this.sampleItems(pool, method, targetSize)
    this.samplingSeq += 1
    const batch: SamplingBatch = {
      id: `SB-${this.samplingSeq}`,
      name: input.name?.trim() || `QC 抽查批次 ${this.samplingSeq}`,
      method,
      blind: input.blind !== false,
      targetSize,
      modality: input.modality,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      status: 'open',
      createdBy: input.createdBy?.trim() || '质控组',
      createdAt: new Date().toISOString(),
      items,
    }
    this.samplingBatches.unshift(batch)
    return this.cloneBatch(batch)
  }

  private sampleItems(pool: typeof SAMPLING_POOL, method: SamplingMethod, size: number): SamplingItem[] {
    const toItem = (p: (typeof SAMPLING_POOL)[number]): SamplingItem => ({
      itemId: `IT-${p.reportId}`,
      reportId: p.reportId,
      studyId: p.studyId,
      patientId: p.patientId,
      patientName: p.patientName,
      modality: p.modality,
      yielder: p.yielder,
      stratum: p.modality,
      readings: [],
    })
    if (method === 'low_yield') {
      const low = pool.filter((p) => p.yielder === 'low')
      const high = pool.filter((p) => p.yielder === 'high')
      // 低阳性率优先 (低产率报告更易出现漏诊)
      const picked = [...low, ...high].slice(0, size)
      return picked.map(toItem)
    }
    if (method === 'stratified') {
      const strata = new Map<string, typeof pool>()
      for (const p of pool) {
        const list = strata.get(p.modality) ?? []
        list.push(p)
        strata.set(p.modality, list)
      }
      const keys = [...strata.keys()].sort()
      const out: SamplingItem[] = []
      let idx = 0
      while (out.length < size && keys.length > 0) {
        for (const k of keys) {
          const list = strata.get(k)!
          if (idx < list.length && out.length < size) out.push(toItem(list[idx]!))
        }
        idx += 1
        if (keys.every((k) => idx >= strata.get(k)!.length)) break
      }
      return out
    }
    // random: 确定性打散取前 size
    const sorted = [...pool].sort((a, b) => hashString(`s:${a.reportId}`) - hashString(`s:${b.reportId}`))
    return sorted.slice(0, size).map(toItem)
  }

  private cloneBatch(b: SamplingBatch): SamplingBatch {
    return {
      ...b,
      items: b.items.map((i) => ({ ...i, readings: i.readings.map((r) => ({ ...r })) })),
    }
  }

  private blindView(batch: SamplingBatch, slotForViewer?: 1 | 2): SamplingBatchView {
    return {
      id: batch.id,
      name: batch.name,
      method: batch.method,
      blind: batch.blind,
      targetSize: batch.targetSize,
      modality: batch.modality,
      status: batch.status,
      createdBy: batch.createdBy,
      createdAt: batch.createdAt,
      itemCount: batch.items.length,
      items: batch.items.map((i) => ({
        itemId: i.itemId,
        reportId: i.reportId,
        patientName: batch.blind ? '***' : i.patientName,
        modality: i.modality,
        yielder: i.yielder,
        stratum: i.stratum,
        recordedCount: i.readings.length,
        readings: i.readings.map((r) => {
          const masked = batch.blind && r.readerSlot !== slotForViewer
          return {
            readerSlot: r.readerSlot,
            readerLabel: batch.blind ? `阅片医师${r.readerSlot === 1 ? '一' : '二'}` : r.readerName,
            result: masked ? null : r.result,
            recordedAt: batch.blind ? '' : r.recordedAt,
          }
        }),
      })),
    }
  }

  listSamplingBatches(): SamplingBatchView[] {
    return this.samplingBatches.map((b) => this.blindView(b))
  }

  getSamplingBatch(id: string, unblind = false, viewerSlot?: 1 | 2): SamplingBatchView {
    const batch = this.samplingBatches.find((b) => b.id === id)
    if (!batch) throw new NotFoundException(`抽查批次 ${id} 不存在`)
    if (unblind) {
      const cloned = this.cloneBatch(batch)
      cloned.blind = false
      return this.blindView(cloned)
    }
    return this.blindView(batch, viewerSlot)
  }

  /** 录入双盲阅片结果: 同一 slot 重复录入覆盖; 双方完成后不自动解盲 */
  recordSamplingReading(
    id: string,
    itemId: string,
    body: { readerSlot: 1 | 2; readerId: string; readerName: string; result: SamplingReadingResult; report?: string },
  ): SamplingBatchView {
    const batch = this.samplingBatches.find((b) => b.id === id)
    if (!batch) throw new NotFoundException(`抽查批次 ${id} 不存在`)
    if (batch.status === 'closed') throw new BadRequestException('批次已关闭')
    const item = batch.items.find((i) => i.itemId === itemId || i.reportId === itemId)
    if (!item) throw new NotFoundException(`抽查条目 ${itemId} 不存在`)
    if (![1, 2].includes(body.readerSlot)) throw new BadRequestException('readerSlot 必须为 1 或 2')
    if (!['positive', 'negative', 'indeterminate'].includes(body.result)) throw new BadRequestException('result 不合法')
    const existing = item.readings.find((r) => r.readerSlot === body.readerSlot)
    if (existing) {
      existing.readerId = body.readerId
      existing.readerName = body.readerName
      existing.result = body.result
      existing.report = body.report
      existing.recordedAt = new Date().toISOString()
    } else {
      item.readings.push({
        readerSlot: body.readerSlot,
        readerId: body.readerId,
        readerName: body.readerName,
        result: body.result,
        report: body.report,
        recordedAt: new Date().toISOString(),
      })
    }
    return this.blindView(batch, body.readerSlot === 1 ? 1 : 2)
  }

  closeSamplingBatch(id: string): SamplingBatchView {
    const batch = this.samplingBatches.find((b) => b.id === id)
    if (!batch) throw new NotFoundException(`抽查批次 ${id} 不存在`)
    batch.status = 'closed'
    return this.blindView(batch)
  }

  /** 一致性: 对全部批次中已有双方结果 (positive/negative) 的条目计算 Cohen's kappa */
  agreement(batchId?: string): AgreementResult {
    const batches = batchId ? this.samplingBatches.filter((b) => b.id === batchId) : this.samplingBatches
    const pairs: Array<{ a: 'positive' | 'negative'; b: 'positive' | 'negative' }> = []
    for (const batch of batches) {
      for (const item of batch.items) {
        const r1 = item.readings.find((r) => r.readerSlot === 1)
        const r2 = item.readings.find((r) => r.readerSlot === 2)
        if (!r1 || !r2) continue
        if (r1.result === 'indeterminate' || r2.result === 'indeterminate') continue
        pairs.push({ a: r1.result, b: r2.result })
      }
    }
    return computeKappa(pairs)
  }

  getSamplingStats(): {
    batchCount: number
    openBatchCount: number
    itemCount: number
    recordedPairs: number
    pendingItems: number
    agreement: AgreementResult
    byModality: Array<{ modality: string; items: number; recordedPairs: number }>
  } {
    const byModalityMap = new Map<string, { items: number; recordedPairs: number }>()
    let itemCount = 0
    let recordedPairs = 0
    for (const batch of this.samplingBatches) {
      for (const item of batch.items) {
        itemCount += 1
        const entry = byModalityMap.get(item.modality) ?? { items: 0, recordedPairs: 0 }
        entry.items += 1
        const r1 = item.readings.find((r) => r.readerSlot === 1)
        const r2 = item.readings.find((r) => r.readerSlot === 2)
        if (r1 && r2 && r1.result !== 'indeterminate' && r2.result !== 'indeterminate') {
          recordedPairs += 1
          entry.recordedPairs += 1
        }
        byModalityMap.set(item.modality, entry)
      }
    }
    return {
      batchCount: this.samplingBatches.length,
      openBatchCount: this.samplingBatches.filter((b) => b.status === 'open').length,
      itemCount,
      recordedPairs,
      pendingItems: itemCount - recordedPairs,
      agreement: this.agreement(),
      byModality: [...byModalityMap.entries()].map(([modality, v]) => ({ modality, ...v })).sort((a, b) => a.modality.localeCompare(b.modality)),
    }
  }
}
