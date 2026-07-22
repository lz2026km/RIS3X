import { Injectable } from '@nestjs/common'
import { v4 as uuid } from 'uuid'

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
}

const doctors = [
  { id: 'dr-001', name: 'Dr. Wang' },
  { id: 'dr-002', name: 'Dr. Li' },
  { id: 'dr-003', name: 'Dr. Zhang' },
  { id: 'dr-004', name: 'Dr. Liu' },
  { id: 'dr-005', name: 'Dr. Chen' },
]

@Injectable()
export class DualReadService {
  private assignments: DualReadAssignment[] = [
    {
      id: 'da-001', studyId: 'STU001', patientName: 'Zhang San', patientId: 'P001', modality: 'CT',
      reader1Id: 'dr-001', reader1Name: 'Dr. Wang', reader2Id: 'dr-002', reader2Name: 'Dr. Li',
      report1: '右肺上叶见磨玻璃结节，大小约1.2cm×0.8cm，边界欠清。',
      report2: '右肺上叶磨玻璃密度影，建议密切随访。',
      status: 'both_done', discrepancyScore: 0.15, createdAt: '2026-07-10T08:00:00Z',
    },
    {
      id: 'da-002', studyId: 'STU002', patientName: 'Li Si', patientId: 'P002', modality: 'MR',
      reader1Id: 'dr-001', reader1Name: 'Dr. Wang', reader2Id: 'dr-003', reader2Name: 'Dr. Zhang',
      report1: '左侧基底节区急性梗死灶。',
      report2: '左侧基底节区急性期脑梗死，建议DWI序列复查。',
      status: 'arbitrated', discrepancyScore: 0.05, arbitrationReport: '左侧基底节区急性脑梗死，建议临床干预。', arbitratorId: 'dr-005', arbitratorName: 'Dr. Chen', createdAt: '2026-07-09T10:00:00Z',
    },
    {
      id: 'da-003', studyId: 'STU003', patientName: 'Wang Wu', patientId: 'P003', modality: 'DX',
      reader1Id: 'dr-002', reader1Name: 'Dr. Li', reader2Id: 'dr-004', reader2Name: 'Dr. Liu',
      status: 'pending', createdAt: '2026-07-11T09:00:00Z',
    },
  ]

  assign(studyId: string, patientName: string, patientId: string, modality: string): DualReadAssignment {
    const shuffled = [...doctors].sort(() => Math.random() - 0.5)
    const reader1 = shuffled[0], reader2 = shuffled[1]
    const assignment: DualReadAssignment = {
      id: `da-${uuid().slice(0, 6)}`, studyId, patientName, patientId, modality,
      reader1Id: reader1.id, reader1Name: reader1.name,
      reader2Id: reader2.id, reader2Name: reader2.name,
      status: 'pending', createdAt: new Date().toISOString(),
    }
    this.assignments.push(assignment)
    return assignment
  }

  arbitrate(id: string, arbitratorId: string, arbitratorName: string, report: string): DualReadAssignment {
    const a = this.assignments.find(x => x.id === id)
    if (!a) throw new Error('Assignment not found')
    a.arbitratorId = arbitratorId
    a.arbitratorName = arbitratorName
    a.arbitrationReport = report
    a.discrepancyScore = Math.round(Math.random() * 30) / 100
    a.status = 'arbitrated'
    return a
  }

  discrepancyStats(): { total: number; arbitrated: number; avgDiscrepancy: number } {
    const total = this.assignments.length
    const arbitrated = this.assignments.filter(a => a.status === 'arbitrated').length
    const scores = this.assignments.filter(a => a.discrepancyScore != null).map(a => a.discrepancyScore!)
    const avgDiscrepancy = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0
    return { total, arbitrated, avgDiscrepancy }
  }

  list(): DualReadAssignment[] {
    return this.assignments
  }
}
