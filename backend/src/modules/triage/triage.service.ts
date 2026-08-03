import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

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
}

export interface TriageScoreResult {
  examId: string
  score: number
  level: 'CRITICAL' | 'URGENT' | 'SEMI_URGENT' | 'ROUTINE'
  factors: TriageFactor[]
  suggestedDoctor?: string
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

@Injectable()
export class TriageService {
  private pendingStore: TriagePendingItem[] = []
  private idCounter = 0

  constructor(private readonly prisma: PrismaService) {}

  private computeScore(input: TriageExamInput): TriageScoreResult {
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
    return {
      id: row.id,
      examId: row.examId,
      patientId: row.patientId,
      patientName: row.patientName ?? '',
      examType: row.examType ?? '',
      score: row.score,
      level: scoreToLevel(row.score),
      status: (['PENDING', 'ASSIGNED', 'COMPLETED'].includes(row.status) ? row.status : 'PENDING') as TriagePendingItem['status'],
      assignedDoctor: row.assignedTo ?? undefined,
      createdAt: row.createdAt,
    }
  }

  private async persistScore(input: TriageExamInput, scored: TriageScoreResult, status: 'PENDING' | 'ASSIGNED', assignedTo?: string): Promise<void> {
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
    const scored = this.computeScore(input)
    try {
      await this.persistScore(input, scored, 'PENDING')
    } catch {
      // DB unavailable -> keep pure scoring result
    }
    return scored
  }

  async assign(input: TriageExamInput): Promise<TriageScoreResult & { assignedDoctor: string }> {
    const scored = this.computeScore(input)
    const idx = Math.floor(Math.random() * DOCTOR_POOL.length)
    const doctor = DOCTOR_POOL[idx]

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

    return { ...scored, assignedDoctor: doctor }
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
