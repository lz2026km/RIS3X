import { Injectable, NotFoundException } from '@nestjs/common'

export type PlanStatus = 'planned' | 'in_progress' | 'completed' | 'pending'

export interface TimelineStep {
  step: string
  date: string
  status: PlanStatus
}

export interface TreatmentPlan {
  id: string
  patientId: string
  patient: string
  type: string
  status: PlanStatus
  progress: number
  department: string
  startDate: string
  desc: string
  outcome?: string
  timeline?: TimelineStep[]
  createdAt: string
  updatedAt: string
}

const STATUS_FLOW: PlanStatus[] = ['planned', 'in_progress', 'completed']

const SEED: TreatmentPlan[] = [
  {
    id: 'PLAN-001', patientId: 'P100001', patient: '张伟', type: '种植', status: 'in_progress', progress: 0.6,
    department: '口腔科→放射科', startDate: '2026-06-20', desc: '36 位种植体植入 (Straumann BLT 4.1×10mm)',
    outcome: '待 CBCT 复核', createdAt: '2026-06-20T08:00:00.000Z', updatedAt: '2026-06-22T10:00:00.000Z',
    timeline: [
      { step: '口腔科初诊', date: '2026-06-20', status: 'completed' },
      { step: '转诊放射科 CBCT', date: '2026-06-21', status: 'completed' },
      { step: '种植规划 (导板设计)', date: '2026-06-22', status: 'in_progress' },
      { step: '手术日', date: '2026-06-28', status: 'pending' },
      { step: '术后复查 CBCT', date: '2026-07-05', status: 'pending' },
    ],
  },
  {
    id: 'PLAN-002', patientId: 'P100002', patient: '李娜', type: '根管治疗', status: 'completed', progress: 1,
    department: '口腔科', startDate: '2026-06-15', desc: '16 位根管治疗 (根管预备 + 充填)',
    outcome: '已完成, 建议全冠修复', createdAt: '2026-06-15T09:00:00.000Z', updatedAt: '2026-06-18T15:00:00.000Z',
    timeline: [
      { step: '口腔科初诊', date: '2026-06-15', status: 'completed' },
      { step: '根管预备', date: '2026-06-16', status: 'completed' },
      { step: '根管充填', date: '2026-06-18', status: 'completed' },
      { step: '复查评估', date: '2026-07-10', status: 'pending' },
    ],
  },
  {
    id: 'PLAN-003', patientId: 'P100003', patient: '王芳', type: '正畸-正颌', status: 'planned', progress: 0.2,
    department: '口腔科→放射科→口腔外科', startDate: '2026-07-01', desc: '下颌前突正畸-正颌联合治疗',
    outcome: '头影测量分析中', createdAt: '2026-07-01T08:30:00.000Z', updatedAt: '2026-07-05T11:00:00.000Z',
    timeline: [
      { step: '口腔科初诊', date: '2026-07-01', status: 'completed' },
      { step: '头影测量分析', date: '2026-07-05', status: 'in_progress' },
      { step: '正颌手术规划', date: '2026-07-20', status: 'pending' },
      { step: '术后复查', date: '2026-09-01', status: 'pending' },
    ],
  },
]

const memPlans: TreatmentPlan[] = []

export type TreatmentPlanInput = Omit<Partial<TreatmentPlan>, 'department'> & {
  department?: string | string[]
  timeline?: Array<{ step: string; date: string; status: string }>
}

@Injectable()
export class TreatmentPlanService {
  list(): TreatmentPlan[] {
    return [...memPlans, ...SEED].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  get(id: string): TreatmentPlan {
    const found = this.list().find((p) => p.id === id)
    if (!found) throw new NotFoundException('Treatment plan not found')
    return found
  }

  create(data: TreatmentPlanInput): TreatmentPlan {
    const now = new Date().toISOString()
    const today = now.slice(0, 10)
    const plan: TreatmentPlan = {
      id: `PLAN-${String(this.list().length + 1).padStart(3, '0')}`,
      patientId: data.patientId ?? `P${Date.now()}`,
      patient: data.patient ?? '待定患者',
      type: data.type ?? '综合治疗',
      status: 'planned',
      progress: 0,
      department: Array.isArray(data.department) ? (data.department as string[]).join('→') : (data.department ?? '口腔科'),
      startDate: data.startDate ?? today,
      desc: data.desc ?? '',
      outcome: data.outcome ?? '',
      timeline: (data.timeline ?? [{ step: '初诊规划', date: data.startDate ?? today, status: 'completed' }]) as TimelineStep[],
      createdAt: now,
      updatedAt: now,
    }
    memPlans.unshift(plan)
    return plan
  }

  update(id: string, data: TreatmentPlanInput): TreatmentPlan {
    const plan = this.get(id)
    if (Array.isArray(data.department)) {
      data.department = data.department.join('→')
    }
    Object.assign(plan, data, { updatedAt: new Date().toISOString() })
    return plan
  }

  remove(id: string): void {
    const idx = memPlans.findIndex((p) => p.id === id)
    if (idx >= 0) memPlans.splice(idx, 1)
    else throw new NotFoundException('Treatment plan not found')
  }

  transition(id: string, status: PlanStatus): TreatmentPlan {
    const plan = this.get(id)
    const next = status && STATUS_FLOW.includes(status) ? status : 'in_progress'
    plan.status = next
    plan.progress = next === 'completed' ? 1 : next === 'in_progress' ? Math.max(plan.progress, 0.4) : plan.progress
    plan.updatedAt = new Date().toISOString()
    if (next === 'completed' && !plan.outcome) plan.outcome = '治疗已完成, 建议随访复查'
    return plan
  }

  getTimeline(id: string): TimelineStep[] {
    return this.get(id).timeline ?? []
  }
}
