import { api } from './client'

export interface SmartScoreInput {
  id: string
  urgency: number
  waitingMinutes: number
  age?: number
  modality?: string
  bodyPart?: string
  patientType?: string
  priority?: string
  criticalFinding?: boolean
}

export interface SmartFactorDetail {
  key: 'urgency' | 'wait' | 'age' | 'examType' | 'patientType' | 'aiTriage'
  label: string
  score: number
  weight: number
  contribution: number
  // [G005 Wave4A] 因子得分来源说明 (aiTriage: 真实分检记录 | 检查优先级回退)
  source?: string
}

export interface SmartScoreResult {
  studyId: string
  score: number
  reasons: string[]
  level: 'low' | 'normal' | 'urgent' | 'critical'
  factors: SmartFactorDetail[]
}

export interface SmartWeightConfig {
  urgencyWeight: number
  waitWeight: number
  ageWeight: number
  examTypeWeight: number
  // [G005 Wave4A] 权重是否已持久化至后端 system_config
  persisted?: boolean
}

export interface SmartPriorityCounts {
  critical: number
  high: number
  medium: number
  low: number
}

export const worklistSmartApi = {
  score: (input: SmartScoreInput) =>
    api.post<SmartScoreResult>('/worklist-smart/score', input),

  reorder: (items: SmartScoreInput[]) =>
    api.post<Array<SmartScoreInput & { score: number; reasons: string[]; level: string; rank: number; beforeRank: number }>>('/worklist-smart/reorder', { items }),

  getWeights: () =>
    api.get<SmartWeightConfig>('/worklist-smart/weights'),

  setWeights: (weights: Partial<SmartWeightConfig>) =>
    api.put<SmartWeightConfig>('/worklist-smart/weights', weights),

  getPriorities: () =>
    api.get<SmartPriorityCounts>('/worklist-smart/priorities'),
}
