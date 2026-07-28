import { api } from './client'

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

export interface TriageFactor {
  name: string
  weight: number
  contribution: number
}

export interface TriageScoreResult {
  examId: string
  score: number
  level: 'CRITICAL' | 'URGENT' | 'SEMI_URGENT' | 'ROUTINE'
  factors: TriageFactor[]
  suggestedDoctor?: string
  assignedDoctor?: string
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
}

export const triageApi = {
  score: (input: TriageExamInput) =>
    api.post<TriageScoreResult>('/triage/score', input),

  assign: (input: TriageExamInput) =>
    api.post<TriageScoreResult & { assignedDoctor: string }>('/triage/assign', input),

  getPending: () =>
    api.get<TriagePendingItem[]>('/triage/pending'),

  update: (id: string, data: { assignedDoctor?: string; status?: 'PENDING' | 'ASSIGNED' | 'COMPLETED' }) =>
    api.put<TriagePendingItem>(`/triage/${id}`, data),
}
