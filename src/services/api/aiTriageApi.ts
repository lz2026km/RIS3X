import { api } from './client'

export interface AiTriageInput {
  examId: string
  patientId: string
  patientName: string
  examType: string
  symptoms?: string
  clinicalInfo?: string
  referringDept?: string
  patientAge?: number
  gender?: string
  modality?: string
  bodyPart?: string
}

export interface AiTriageFactor {
  name: string
  weight: number
  contribution: number
  description: string
}

export interface AiTriageResult {
  examId: string
  patientId?: string
  patientName?: string
  examType?: string
  score: number
  level: 'CRITICAL' | 'URGENT' | 'SEMI_URGENT' | 'ROUTINE'
  factors: AiTriageFactor[]
  suggestedDoctor?: string
  assignedDoctor?: string
  aiConfidence: number
  reasoning: string
  // [W3-2] 任务流转状态 (MSW 提供, 后端可缺省)
  status?: 'PENDING' | 'ASSIGNED' | 'COMPLETED'
}

export const aiTriageApi = {
  // [G005 Wave1A P0] 路径对齐: 原 MSW-only /ai-triage/* → 后端真实 /triage/* (triage.controller)
  score: (input: AiTriageInput) =>
    api.post<AiTriageResult>('/triage/score', input),

  batchScore: (inputs: AiTriageInput[]) =>
    api.post<AiTriageResult[]>('/triage/batch-score', { items: inputs }),

  assign: (input: AiTriageInput) =>
    api.post<AiTriageResult & { assignedDoctor: string }>('/triage/assign', input),

  getPending: () =>
    api.get<AiTriageResult[]>('/triage/pending'),

  getStats: () =>
    api.get<{ total: number; byLevel: Record<string, number>; avgScore: number; accuracy: number }>('/triage/stats'),
}
