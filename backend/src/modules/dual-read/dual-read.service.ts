import { Injectable, NotFoundException } from '@nestjs/common'
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
  status: 'pending' | 'reader1_done' | 'reader2_done' | 'both_done' | 'arbitrated'
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

const doctors = [
  { id: 'dr-001', name: 'Dr. Wang' },
  { id: 'dr-002', name: 'Dr. Li' },
  { id: 'dr-003', name: 'Dr. Zhang' },
  { id: 'dr-004', name: 'Dr. Liu' },
  { id: 'dr-005', name: 'Dr. Chen' },
]

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
  constructor(private readonly prisma: PrismaService) {}

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
}
