import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface ClinicalPathway {
  id: string
  name: string
  dept: string
  phase: string
  progress: number
  status: 'active' | 'paused' | 'archived'
  patients: number
  version: string
  updatedAt: string
}

export interface PathwayPatient {
  id: string
  patient: string
  pathway: string
  step: number
  totalSteps: number
  status: 'on-track' | 'delayed' | 'completed'
  enteredAt: string
  variance: string | null
  steps?: string[]
}

export interface PathwayStats {
  active: number
  paused: number
  totalPatients: number
  onTrack: number
  delayed: number
}

const SEED_PATHWAYS: ClinicalPathway[] = [
  { id: 'PW-001', name: '肺结节随访路径', dept: '呼吸科', phase: '随访复查', progress: 0.65, status: 'active', patients: 128, version: 'v1.3', updatedAt: '2026-07-28T08:00:00.000Z' },
  { id: 'PW-002', name: '乳腺癌筛查路径', dept: '乳腺外科', phase: '影像评估', progress: 0.4, status: 'active', patients: 86, version: 'v2.1', updatedAt: '2026-07-27T09:30:00.000Z' },
  { id: 'PW-003', name: '卒中绿色通道', dept: '神经内科', phase: '溶栓评估', progress: 0.8, status: 'active', patients: 42, version: 'v1.0', updatedAt: '2026-07-28T10:00:00.000Z' },
  { id: 'PW-004', name: '骨科术后康复路径', dept: '骨科', phase: '术后康复', progress: 0.3, status: 'paused', patients: 57, version: 'v1.1', updatedAt: '2026-07-20T14:00:00.000Z' },
  { id: 'PW-005', name: '心血管CTA路径', dept: '心内科', phase: '随访', progress: 1, status: 'archived', patients: 214, version: 'v3.0', updatedAt: '2026-06-30T16:00:00.000Z' },
]

const SEED_PATIENTS: PathwayPatient[] = [
  { id: 'PP-001', patient: '张三', pathway: '肺结节随访路径', step: 3, totalSteps: 6, status: 'on-track', enteredAt: '2026-07-01', variance: null, steps: ['初诊登记', '低剂量CT', 'AI分析', '随访复查', '专科门诊', '年度复查'] },
  { id: 'PP-002', patient: '李四', pathway: '卒中绿色通道', step: 4, totalSteps: 5, status: 'on-track', enteredAt: '2026-07-10', variance: null, steps: ['急诊分诊', '头颅CT', '溶栓评估', '溶栓治疗', '康复转诊'] },
  { id: 'PP-003', patient: '王五', pathway: '乳腺癌筛查路径', step: 2, totalSteps: 5, status: 'delayed', enteredAt: '2026-06-20', variance: '影像设备检修', steps: ['登记', '钼靶检查', '超声补充', '病理活检', '多学科会诊'] },
  { id: 'PP-004', patient: '赵六', pathway: '骨科术后康复路径', step: 5, totalSteps: 5, status: 'completed', enteredAt: '2026-05-15', variance: null, steps: ['术前评估', '手术', '影像复查', '康复训练', '出院评估'] },
  { id: 'PP-005', patient: '钱七', pathway: '肺结节随访路径', step: 1, totalSteps: 6, status: 'on-track', enteredAt: '2026-07-25', variance: null, steps: ['初诊登记', '低剂量CT', 'AI分析', '随访复查', '专科门诊', '年度复查'] },
]

const memPatients: PathwayPatient[] = []

@Injectable()
export class ClinicalPathwayService {
  private readonly logger = new Logger(ClinicalPathwayService.name)

  constructor(private readonly prisma: PrismaService) {}

  async listPathways(): Promise<ClinicalPathway[]> {
    try {
      const rows = await this.prisma.workflowDefinition.findMany({
        select: { id: true, name: true, description: true, active: true, version: true, updatedAt: true, _count: { select: { steps: true } } },
        orderBy: { updatedAt: 'desc' },
      })
      if (rows.length === 0) return SEED_PATHWAYS
      return rows.map((r) => ({
        id: `pw-${r.id}`,
        name: r.name,
        dept: r.description || '放射科',
        phase: r.active ? '运行中' : '已归档',
        progress: Math.min(1, (r._count.steps || 1) / 8),
        status: (r.active ? 'active' : 'archived') as ClinicalPathway['status'],
        patients: 0,
        version: `v${r.version}`,
        updatedAt: r.updatedAt.toISOString(),
      }))
    } catch (err) {
      this.logger.warn(`[ClinicalPathway] DB query failed, fallback to seed: ${(err as Error).message}`)
      return SEED_PATHWAYS
    }
  }

  async getStats(): Promise<PathwayStats> {
    const pathways = await this.listPathways()
    const patients = await this.listPatients()
    return {
      active: pathways.filter((p) => p.status === 'active').length,
      paused: pathways.filter((p) => p.status === 'paused').length,
      totalPatients: patients.length,
      onTrack: patients.filter((p) => p.status === 'on-track').length,
      delayed: patients.filter((p) => p.status === 'delayed').length,
    }
  }

  async listPatients(): Promise<PathwayPatient[]> {
    return [...memPatients, ...SEED_PATIENTS]
  }

  async getSteps(id: string): Promise<string[]> {
    const patient = [...memPatients, ...SEED_PATIENTS].find((p) => p.id === id)
    const steps = patient?.steps ?? SEED_PATIENTS[0]?.steps ?? []
    return steps
  }

  async togglePathway(id: string, status?: 'active' | 'paused'): Promise<{ id: string; status: string }> {
    const target = SEED_PATHWAYS.find((p) => p.id === id)
    return { id, status: status ?? (target?.status === 'active' ? 'paused' : 'active') }
  }

  async enrollPatient(input: { patientName: string; pathwayName: string }): Promise<PathwayPatient> {
    const record: PathwayPatient = {
      id: `PP-${Date.now()}`,
      patient: input.patientName ?? '新患者',
      pathway: input.pathwayName ?? '未指定路径',
      step: 1,
      totalSteps: 8,
      status: 'on-track',
      enteredAt: new Date().toISOString().slice(0, 10),
      variance: null,
      steps: ['门诊评估', '术前检查', '会诊', '宣教', '治疗', '观察', '随访', '复查'],
    }
    memPatients.unshift(record)
    return record
  }
}
