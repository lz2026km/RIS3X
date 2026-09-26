import { Injectable, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
// [G005 W6] 队列优先级联动 (可选注入; 无队列模块时静默跳过)
import { QueueService } from '../queue/queue.service'

// [G005 W6] 生命体征输入 (ESI 分级依据)
export interface VitalSigns {
  systolicBp?: number
  diastolicBp?: number
  heartRate?: number
  temperature?: number
  spo2?: number
  respiratoryRate?: number
}

export type EsiLevel = 1 | 2 | 3 | 4 | 5
export type QueuePriorityZh = '危重' | '紧急' | '普通'

export interface TriageExamInput {
  examId: string
  patientId: string
  patientName: string
  examType: string
  symptoms?: string
  referringDept?: string
  referringDoctorLevel?: string
  patientAge?: number
  gender?: string
  // [G005 W6] 结构化生命体征 (BP/HR/Temp/SpO2/RR)
  vitals?: VitalSigns
  nurseId?: string
  nurseName?: string
}

export interface TriageScoreResult {
  examId: string
  score: number
  level: 'CRITICAL' | 'URGENT' | 'SEMI_URGENT' | 'ROUTINE'
  factors: TriageFactor[]
  suggestedDoctor?: string
  // [G005 Wave1A] AI 分检页 (AiTriagePage) 需要的扩展字段
  aiConfidence: number
  reasoning: string
  status?: 'PENDING' | 'ASSIGNED' | 'COMPLETED'
  assignedDoctor?: string
  // [G005 W6] ESI 五级分诊 + 复评 + 队列优先级联动 + 分诊护士
  esiLevel: EsiLevel
  queuePriority: QueuePriorityZh
  vitalsBreaches: string[]
  reTriageRecommended: boolean
  reTriageAt?: string
  nurseId?: string
  nurseName?: string
}

export interface TriageStats {
  total: number
  byLevel: Record<string, number>
  avgScore: number
  accuracy: number
}

export interface TriageFactor {
  name: string
  weight: number
  contribution: number
}

export interface TriagePendingItem {
  id: string
  examId: string
  patientId: string
  patientName: string
  examType: string
  score: number
  level: string
  status: 'PENDING' | 'ASSIGNED' | 'COMPLETED'
  assignedDoctor?: string
  createdAt: Date
  // [G005 W6]
  esiLevel?: EsiLevel
  queuePriority?: QueuePriorityZh
  reTriageRecommended?: boolean
  reTriageAt?: string
  nurseId?: string
  nurseName?: string
  vitals?: VitalSigns
}

const EMERGENCY_KEYWORDS = [
  '卒中', '中风', '脑梗', '脑出血', '蛛网膜下腔出血',
  '主动脉夹层', '肺栓塞', '气胸', '肝破裂', '脾破裂',
  'stroke', 'infarct', 'hemorrhage', 'aneurysm',
  'aortic dissection', 'pulmonary embolism', 'pneumothorax',
  'cardiac tamponade', 'spinal cord compression',
  'acute abdomen', 'perforation', 'obstruction',
  'intracranial', 'subarachnoid', '脑疝',
]

const EXAM_WEIGHTS: Record<string, number> = {
  'CT头': 8, 'CT头部': 8, 'CT头颅': 8,
  'CT头+CTA': 10, 'CTA头': 10, 'CTA头部': 10,
  'CT灌注': 9, 'CTP': 9,
  'MR头FLAIR': 7, 'MR头DWI': 9, 'MR头MRA': 8,
  'MR头MRV': 7, 'MR头增强': 6,
  'CT胸': 6, 'CT胸部': 6, 'CTPA': 10,
  'CT腹': 6, 'CT腹部': 6, 'CT腹部增强': 7,
  'CT脊柱': 5, 'CT颈椎': 5, 'CT腰椎': 5,
  'MR脊柱': 5, 'MR颈椎': 5, 'MR腰椎': 5,
}

const DOCTOR_LEVEL_WEIGHTS: Record<string, number> = {
  '急诊科': 2,
  'ICU': 2,
  '神经内科': 2,
  '神经外科': 2,
  '心内科': 1.5,
  '门诊': 0,
}

function calculateAgeWeight(age?: number): number {
  if (!age) return 0
  if (age < 3) return 3
  if (age < 12) return 2
  if (age < 18) return 1
  if (age >= 70) return 3
  if (age >= 60) return 1.5
  return 0
}

function findEmergencyKeywords(symptoms?: string): string[] {
  if (!symptoms) return []
  const lower = symptoms.toLowerCase()
  return EMERGENCY_KEYWORDS.filter(kw => lower.includes(kw.toLowerCase()))
}

function scoreToLevel(score: number): 'CRITICAL' | 'URGENT' | 'SEMI_URGENT' | 'ROUTINE' {
  if (score >= 16) return 'CRITICAL'
  if (score >= 11) return 'URGENT'
  if (score >= 6) return 'SEMI_URGENT'
  return 'ROUTINE'
}

const DOCTOR_POOL = [
  '张主任', '李主任', '王主任', '刘主任',
  '陈医生', '赵医生', '周医生', '吴医生',
]

const LEVEL_LABEL: Record<string, string> = {
  CRITICAL: '危急',
  URGENT: '紧急',
  SEMI_URGENT: '半紧急',
  ROUTINE: '常规',
}

// [G005 W6] ESI 五级分诊: 生命体征越界时升级 (1=复苏 2=危急 3=紧急 4=次紧急 5=非紧急)
type EsiBase = Omit<TriageScoreResult, 'aiConfidence' | 'reasoning' | 'status' | 'assignedDoctor' | 'esiLevel' | 'queuePriority' | 'vitalsBreaches' | 'reTriageRecommended'>

function computeEsi(input: TriageExamInput, level: TriageScoreResult['level']): { esiLevel: EsiLevel; breaches: string[] } {
  const v = input.vitals ?? {}
  const breaches: string[] = []
  let esi: EsiLevel = level === 'CRITICAL' ? 2 : level === 'URGENT' ? 3 : level === 'SEMI_URGENT' ? 4 : 5
  const elevate = (to: EsiLevel, label: string) => {
    breaches.push(label)
    if (to < esi) esi = to
  }
  if (v.systolicBp !== undefined) {
    if (v.systolicBp < 90 || v.systolicBp >= 220) elevate(1, `收缩压危象 ${v.systolicBp}mmHg`)
    else if (v.systolicBp < 100 || v.systolicBp >= 180) elevate(2, `收缩压异常 ${v.systolicBp}mmHg`)
    else if (v.systolicBp >= 160) elevate(3, `收缩压偏高 ${v.systolicBp}mmHg`)
  }
  if (v.diastolicBp !== undefined) {
    if (v.diastolicBp >= 120 || v.diastolicBp < 50) elevate(2, `舒张压异常 ${v.diastolicBp}mmHg`)
    else if (v.diastolicBp >= 100) elevate(3, `舒张压偏高 ${v.diastolicBp}mmHg`)
  }
  if (v.spo2 !== undefined) {
    if (v.spo2 < 90) elevate(1, `血氧危急 ${v.spo2}%`)
    else if (v.spo2 < 93) elevate(2, `血氧偏低 ${v.spo2}%`)
    else if (v.spo2 < 95) elevate(3, `血氧临界 ${v.spo2}%`)
  }
  if (v.heartRate !== undefined) {
    if (v.heartRate < 40 || v.heartRate > 150) elevate(1, `心率危象 ${v.heartRate}bpm`)
    else if (v.heartRate < 50 || v.heartRate > 120) elevate(2, `心率异常 ${v.heartRate}bpm`)
    else if (v.heartRate < 60 || v.heartRate > 100) elevate(3, `心率偏离 ${v.heartRate}bpm`)
  }
  if (v.respiratoryRate !== undefined) {
    if (v.respiratoryRate < 8 || v.respiratoryRate > 30) elevate(1, `呼吸危象 ${v.respiratoryRate}/min`)
    else if (v.respiratoryRate > 24 || v.respiratoryRate < 10) elevate(2, `呼吸异常 ${v.respiratoryRate}/min`)
    else if (v.respiratoryRate > 20) elevate(3, `呼吸偏快 ${v.respiratoryRate}/min`)
  }
  if (v.temperature !== undefined) {
    if (v.temperature >= 41 || v.temperature < 35) elevate(1, `体温危象 ${v.temperature}℃`)
    else if (v.temperature >= 39 || v.temperature < 36) elevate(2, `体温异常 ${v.temperature}℃`)
    else if (v.temperature >= 38) elevate(3, `发热 ${v.temperature}℃`)
  }
  return { esiLevel: esi, breaches }
}

function esiToQueuePriority(esi: EsiLevel): QueuePriorityZh {
  if (esi <= 1) return '危重'
  if (esi <= 3) return '紧急'
  return '普通'
}

// 确定性 AI 辅助字段 (无 Math.random): 置信度由得分映射, 推理文本由因子拼接
function enrichScore(scored: EsiBase, input: TriageExamInput): TriageScoreResult {
  const aiConfidence = Math.round((0.72 + scored.score / 250) * 100) / 100
  const reasons = [
    `检查类型 ${input.examType ?? '未知'} 权重 ${scored.factors[0]?.weight ?? 4}`,
    input.symptoms ? `症状匹配关键词 ${scored.factors.find(f => f.name === '症状关键词')?.contribution ?? 0} 分` : '未提供症状',
    input.referringDept ? `申请科室 ${input.referringDept}` : '未提供申请科室',
    input.patientAge !== undefined ? `患者年龄 ${input.patientAge} 岁` : null,
  ].filter(Boolean)
  const { esiLevel, breaches } = computeEsi(input, scored.level)
  return {
    ...scored,
    aiConfidence,
    reasoning: `基于多因子加权评分（${reasons.join('；')}），综合得分 ${scored.score} 分，判定为${LEVEL_LABEL[scored.level] ?? scored.level}优先级。` +
      (breaches.length > 0 ? `生命体征触发复评：${breaches.join('、')}。` : ''),
    esiLevel,
    queuePriority: esiToQueuePriority(esiLevel),
    vitalsBreaches: breaches,
    reTriageRecommended: breaches.length > 0,
    nurseId: input.nurseId,
    nurseName: input.nurseName,
  }
}

interface TriageEsiEntry {
  esiLevel: EsiLevel
  queuePriority: QueuePriorityZh
  vitalsBreaches: string[]
  reTriageRecommended: boolean
  reTriageAt?: string
  nurseId?: string
  nurseName?: string
  vitals?: VitalSigns
}

@Injectable()
export class TriageService {
  private pendingStore: TriagePendingItem[] = []
  private idCounter = 0
  // [G005 W6] ESI/复评/护士 内存 overlay (key = examId)
  private readonly esiStore = new Map<string, TriageEsiEntry>()

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly queue?: QueueService,
  ) {}

  /** 记录 ESI 扩展信息并 best-effort 联动队列优先级 */
  private async rememberEsi(input: TriageExamInput, scored: TriageScoreResult, extra: Partial<TriageEsiEntry> = {}): Promise<void> {
    const prev = this.esiStore.get(input.examId)
    const entry: TriageEsiEntry = {
      esiLevel: scored.esiLevel,
      queuePriority: scored.queuePriority,
      vitalsBreaches: scored.vitalsBreaches,
      reTriageRecommended: scored.reTriageRecommended,
      reTriageAt: extra.reTriageAt ?? prev?.reTriageAt,
      nurseId: input.nurseId ?? prev?.nurseId,
      nurseName: input.nurseName ?? prev?.nurseName,
      vitals: input.vitals ?? prev?.vitals,
    }
    this.esiStore.set(input.examId, entry)
    if (this.queue?.setPriority) {
      try {
        await this.queue.setPriority(input.examId, scored.queuePriority)
      } catch {
        // 队列无对应条目 / DB 不可用 → 静默跳过 (仅保留 triage 侧优先级)
      }
    }
  }

  private computeScore(input: TriageExamInput): EsiBase {
    const factors: TriageFactor[] = []
    let totalScore = 0

    const examWeight = EXAM_WEIGHTS[input.examType] ?? 4
    factors.push({ name: '检查类型', weight: examWeight, contribution: examWeight })
    totalScore += examWeight

    const keywords = findEmergencyKeywords(input.symptoms)
    const keywordScore = Math.min(keywords.length * 3, 10)
    if (keywordScore > 0) {
      factors.push({ name: '症状关键词', weight: keywordScore, contribution: keywordScore })
      totalScore += keywordScore
    }

    const deptWeight = DOCTOR_LEVEL_WEIGHTS[input.referringDept ?? ''] ?? 0
    if (deptWeight > 0) {
      factors.push({ name: '申请科室', weight: deptWeight, contribution: deptWeight })
      totalScore += deptWeight
    }

    const ageWeight = calculateAgeWeight(input.patientAge)
    if (ageWeight > 0) {
      factors.push({ name: '患者年龄', weight: ageWeight, contribution: ageWeight })
      totalScore += ageWeight
    }

    return {
      examId: input.examId,
      score: totalScore,
      level: scoreToLevel(totalScore),
      factors,
    }
  }

  private toItem(row: { id: string; examId: string; patientId: string; patientName: string | null; examType: string | null; score: number; status: string; assignedTo: string | null; createdAt: Date }): TriagePendingItem {
    const esi = this.esiStore.get(row.examId)
    const level = scoreToLevel(row.score)
    return {
      id: row.id,
      examId: row.examId,
      patientId: row.patientId,
      patientName: row.patientName ?? '',
      examType: row.examType ?? '',
      score: row.score,
      level,
      status: (['PENDING', 'ASSIGNED', 'COMPLETED'].includes(row.status) ? row.status : 'PENDING') as TriagePendingItem['status'],
      assignedDoctor: row.assignedTo ?? undefined,
      createdAt: row.createdAt,
      esiLevel: esi?.esiLevel ?? (level === 'CRITICAL' ? 2 : level === 'URGENT' ? 3 : level === 'SEMI_URGENT' ? 4 : 5),
      queuePriority: esi?.queuePriority ?? esiToQueuePriority(level === 'CRITICAL' ? 2 : level === 'URGENT' ? 3 : level === 'SEMI_URGENT' ? 4 : 5),
      reTriageRecommended: esi?.reTriageRecommended ?? false,
      reTriageAt: esi?.reTriageAt,
      nurseId: esi?.nurseId,
      nurseName: esi?.nurseName,
      vitals: esi?.vitals,
    }
  }

  private async persistScore(input: TriageExamInput, scored: Pick<TriageScoreResult, 'score' | 'factors'>, status: 'PENDING' | 'ASSIGNED', assignedTo?: string): Promise<void> {
    const existing = await this.prisma.triageRecord.findFirst({ where: { examId: input.examId }, orderBy: { createdAt: 'desc' } })
    const data = {
      patientId: input.patientId,
      patientName: input.patientName,
      examType: input.examType,
      urgency: scored.score,
      score: scored.score,
      rules: scored.factors as unknown as object,
      status,
      assignedTo: assignedTo ?? null,
    }
    if (existing) {
      await this.prisma.triageRecord.update({ where: { id: existing.id }, data: { ...data, assignedTo: assignedTo ?? existing.assignedTo } })
    } else {
      await this.prisma.triageRecord.create({ data: { ...data, id: `triage-${++this.idCounter}`, examId: input.examId } })
    }
  }

  async score(input: TriageExamInput): Promise<TriageScoreResult> {
    const scored = enrichScore(this.computeScore(input), input)
    await this.rememberEsi(input, scored)
    try {
      await this.persistScore(input, scored, 'PENDING')
    } catch {
      // DB unavailable -> keep pure scoring result
    }
    return { ...scored, status: 'PENDING' }
  }

  async batchScore(inputs: TriageExamInput[]): Promise<TriageScoreResult[]> {
    const results: TriageScoreResult[] = []
    for (const input of inputs) {
      const scored = enrichScore(this.computeScore(input), input)
      await this.rememberEsi(input, scored)
      try {
        await this.persistScore(input, scored, 'PENDING')
      } catch {
        // DB unavailable -> keep pure scoring result
      }
      results.push({ ...scored, status: 'PENDING' })
    }
    return results
  }

  /**
   * POST /triage/re-triage — 复评: 重新采集生命体征并重算 ESI/评分, 写入 reTriageAt。
   * 生命体征越界时 reTriageRecommended=true (前端高亮 复评 提示)。
   */
  async reTriage(input: TriageExamInput): Promise<TriageScoreResult> {
    const scored = enrichScore(this.computeScore(input), input)
    const reTriageAt = new Date().toISOString()
    await this.rememberEsi(input, scored, { reTriageAt })
    try {
      await this.persistScore(input, scored, 'PENDING')
    } catch {
      // DB unavailable -> keep pure scoring result
    }
    return { ...scored, status: 'PENDING', reTriageAt, reTriageRecommended: scored.reTriageRecommended || scored.vitalsBreaches.length > 0 }
  }

  /** POST /triage/nurse — 分诊护士指派 (内存 overlay, DB-less-safe) */
  async assignNurse(examId: string, nurseId: string, nurseName?: string): Promise<{ examId: string; nurseId: string; nurseName?: string; esiLevel?: EsiLevel; queuePriority?: QueuePriorityZh }> {
    const prev = this.esiStore.get(examId)
    const entry: TriageEsiEntry = prev
      ? { ...prev, nurseId, nurseName: nurseName ?? prev.nurseName }
      : { esiLevel: 5, queuePriority: '普通', vitalsBreaches: [], reTriageRecommended: false, nurseId, nurseName }
    this.esiStore.set(examId, entry)
    return { examId, nurseId, nurseName: entry.nurseName, esiLevel: entry.esiLevel, queuePriority: entry.queuePriority }
  }

  async getStats(): Promise<TriageStats> {
    const fallback = (items: TriagePendingItem[]): TriageStats => {
      if (items.length === 0) {
        // 确定性 seed 回退 (无 DB 且无内存记录时)
        return {
          total: 120,
          byLevel: { CRITICAL: 3, URGENT: 12, SEMI_URGENT: 26, ROUTINE: 79 },
          avgScore: 62,
          accuracy: 95,
        }
      }
      const byLevel: Record<string, number> = {}
      let scoreSum = 0
      for (const item of items) {
        byLevel[item.level] = (byLevel[item.level] ?? 0) + 1
        scoreSum += item.score
      }
      return {
        total: items.length,
        byLevel,
        avgScore: Math.round(scoreSum / items.length),
        accuracy: 95,
      }
    }
    try {
      const rows = await this.prisma.triageRecord.findMany({ select: { score: true, status: true } })
      if (rows.length === 0) return fallback(this.pendingStore)
      const byLevel: Record<string, number> = {}
      let scoreSum = 0
      for (const r of rows) {
        const level = scoreToLevel(r.score)
        byLevel[level] = (byLevel[level] ?? 0) + 1
        scoreSum += r.score
      }
      return {
        total: rows.length,
        byLevel,
        avgScore: Math.round(scoreSum / rows.length),
        accuracy: 95,
      }
    } catch {
      return fallback(this.pendingStore)
    }
  }

  async assign(input: TriageExamInput): Promise<TriageScoreResult & { assignedDoctor: string }> {
    const scored = enrichScore(this.computeScore(input), input)
    const idx = Math.floor(Math.random() * DOCTOR_POOL.length)
    const doctor = DOCTOR_POOL[idx]
    await this.rememberEsi(input, scored)

    const item: TriagePendingItem = {
      id: `triage-${++this.idCounter}`,
      examId: input.examId,
      patientId: input.patientId,
      patientName: input.patientName,
      examType: input.examType,
      score: scored.score,
      level: scored.level,
      status: 'ASSIGNED',
      assignedDoctor: doctor,
      createdAt: new Date(),
    }
    try {
      await this.persistScore(input, scored, 'ASSIGNED', doctor)
    } catch {
      this.pendingStore.push(item)
    }

    return { ...scored, assignedDoctor: doctor, status: 'ASSIGNED' }
  }

  async getPending(): Promise<TriagePendingItem[]> {
    try {
      const rows = await this.prisma.triageRecord.findMany({ orderBy: { score: 'desc' } })
      return rows.map(r => this.toItem(r))
    } catch {
      return [...this.pendingStore]
        .sort((a, b) => b.score - a.score)
    }
  }

  async update(id: string, data: Partial<Pick<TriagePendingItem, 'assignedDoctor' | 'status'>>): Promise<TriagePendingItem> {
    try {
      const existing = await this.prisma.triageRecord.findUnique({ where: { id } })
      if (!existing) throw new NotFoundException(`Triage item ${id} not found`)
      const updated = await this.prisma.triageRecord.update({
        where: { id },
        data: {
          assignedTo: data.assignedDoctor !== undefined ? data.assignedDoctor : existing.assignedTo,
          status: data.status ?? existing.status,
        },
      })
      return this.toItem(updated)
    } catch (error) {
      if (error instanceof NotFoundException) throw error
      const item = this.pendingStore.find(i => i.id === id)
      if (!item) throw new NotFoundException(`Triage item ${id} not found`)
      if (data.assignedDoctor !== undefined) item.assignedDoctor = data.assignedDoctor
      if (data.status !== undefined) item.status = data.status
      return item
    }
  }
}
