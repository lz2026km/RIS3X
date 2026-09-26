import { api } from './client'

export interface VitalSigns {
  systolicBp?: number
  diastolicBp?: number
  heartRate?: number
  temperature?: number
  spo2?: number
  respiratoryRate?: number
}

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
  // [G005 W6] 生命体征 + 分诊护士
  vitals?: VitalSigns
  nurseId?: string
  nurseName?: string
}

export interface TriageFactor {
  name: string
  weight: number
  contribution: number
}

export type EsiLevel = 1 | 2 | 3 | 4 | 5
export type QueuePriorityZh = '危重' | '紧急' | '普通'

export interface TriageScoreResult {
  examId: string
  score: number
  level: 'CRITICAL' | 'URGENT' | 'SEMI_URGENT' | 'ROUTINE'
  factors: TriageFactor[]
  suggestedDoctor?: string
  assignedDoctor?: string
  // [G005 W6]
  esiLevel?: EsiLevel
  queuePriority?: QueuePriorityZh
  vitalsBreaches?: string[]
  reTriageRecommended?: boolean
  reTriageAt?: string
  nurseId?: string
  nurseName?: string
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
  createdAt: string
  // [G005 W6]
  esiLevel?: EsiLevel
  queuePriority?: QueuePriorityZh
  reTriageRecommended?: boolean
  reTriageAt?: string
  nurseId?: string
  nurseName?: string
  vitals?: VitalSigns
}

export interface NurseAssignResult {
  examId: string
  nurseId: string
  nurseName?: string
  esiLevel?: EsiLevel
  queuePriority?: QueuePriorityZh
}

export const triageApi = {
  score: (input: TriageExamInput) =>
    api.post<TriageScoreResult>('/triage/score', input),

  assign: (input: TriageExamInput) =>
    api.post<TriageScoreResult & { assignedDoctor: string }>('/triage/assign', input),

  // [G005 W6] 复评: 重采生命体征重算 ESI/评分
  reTriage: (input: TriageExamInput) =>
    api.post<TriageScoreResult>('/triage/re-triage', input),

  // [G005 W6] 分诊护士指派
  assignNurse: (examId: string, nurseId: string, nurseName?: string) =>
    api.post<NurseAssignResult>('/triage/nurse', { examId, nurseId, nurseName }),

  getPending: () =>
    api.get<TriagePendingItem[]>('/triage/pending'),

  update: (id: string, data: { assignedDoctor?: string; status?: 'PENDING' | 'ASSIGNED' | 'COMPLETED' }) =>
    api.put<TriagePendingItem>(`/triage/${id}`, data),
}
