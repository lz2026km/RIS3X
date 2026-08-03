import { worklistApi } from './worklistApi'
import {
  worklistSmartApi,
  type SmartScoreInput,
  type SmartScoreResult,
  type SmartWeightConfig,
  type SmartPriorityCounts,
} from './worklistSmartApi'

export interface SmartMwlItem {
  id: string
  patientName: string
  patientId: string
  modality: string
  bodyPart: string
  examItem: string
  priority: string
  patientType: string
  status: string
  createdTime: string
  scheduledTime?: string
  referringDoctor?: string
  deviceId?: string
  roomId?: string
  age?: number
  gender?: string
  clinicalInfo?: string
  hasCriticalValue?: boolean
}

export interface SmartScoreFactors {
  urgencyScore: number
  waitTimeScore: number
  ageScore: number
  patientTypeScore: number
  bodyPartScore: number
  clinicalInfoScore: number
  totalScore: number
  level: 'critical' | 'urgent' | 'semi-urgent' | 'routine'
  reasons: string[]
}

const PRIORITY_URGENCY: Record<string, number> = { 急诊: 3, 加急: 2, 危重: 3, 紧急: 3, 普通: 0, 体检: -1 }

/** 将工作列表项转换为评分输入 */
export function toSmartScoreInput(item: SmartMwlItem): SmartScoreInput {
  const created = new Date(item.createdTime).getTime()
  const waitingMinutes = Number.isFinite(created) ? Math.max(0, Math.floor((Date.now() - created) / 60000)) : 0
  return {
    id: item.id,
    urgency: PRIORITY_URGENCY[item.priority] ?? 0,
    waitingMinutes,
    age: item.age,
    modality: item.modality,
    bodyPart: item.bodyPart,
    patientType: item.patientType,
    priority: item.priority,
    criticalFinding: item.hasCriticalValue,
  }
}

interface WorklistRow {
  id?: string
  reportId?: string
  patientName?: string
  patientId?: string
  modality?: string
  bodyPart?: string
  examItem?: string
  examName?: string
  examDescription?: string
  priority?: string
  patientType?: string
  status?: string
  examAt?: string
  createdAt?: string
  scheduledAt?: string
  age?: number
  gender?: string
  patientSex?: string
  patientGender?: string
  clinicalDiagnosis?: string
  deviceId?: string
  hasCriticalValue?: boolean
}

function toMwlItem(r: WorklistRow): SmartMwlItem {
  return {
    id: r.id ?? r.reportId ?? '',
    patientName: r.patientName ?? '',
    patientId: r.patientId ?? '',
    modality: r.modality ?? '',
    bodyPart: r.bodyPart ?? '',
    examItem: r.examItem ?? r.examName ?? r.examDescription ?? '',
    priority: r.priority ?? '普通',
    patientType: r.patientType ?? '门诊',
    status: r.status ?? '',
    createdTime: r.examAt ?? r.createdAt ?? r.scheduledAt ?? new Date().toISOString(),
    scheduledTime: r.scheduledAt,
    age: typeof r.age === 'number' ? r.age : undefined,
    gender: r.gender ?? r.patientSex ?? r.patientGender,
    clinicalInfo: r.clinicalDiagnosis,
    deviceId: r.deviceId,
    hasCriticalValue: r.hasCriticalValue,
  }
}

export const smartMwlApi = {
  getWorklist: async (params?: { modality?: string; status?: string; priority?: string }) => {
    const res = await worklistApi.list({ pageSize: 60, ...params })
    const raw = res.data as unknown
    const arr: WorklistRow[] = Array.isArray(raw) ? raw : (raw as { items?: WorklistRow[] })?.items ?? []
    return { success: res.success, data: arr.map(toMwlItem), error: res.error }
  },

  score: (item: SmartMwlItem) =>
    worklistSmartApi.score(toSmartScoreInput(item)),

  scoreInput: (input: SmartScoreInput) =>
    worklistSmartApi.score(input),

  reorder: (items: SmartMwlItem[]) =>
    worklistSmartApi.reorder(items.map(toSmartScoreInput)),

  getWeights: (): Promise<{ success: boolean; data: SmartWeightConfig; error?: unknown }> =>
    worklistSmartApi.getWeights() as Promise<{ success: boolean; data: SmartWeightConfig; error?: unknown }>,

  setWeights: (weights: Partial<SmartWeightConfig>) =>
    worklistSmartApi.setWeights(weights),

  getPriorities: (): Promise<{ success: boolean; data: SmartPriorityCounts; error?: unknown }> =>
    worklistSmartApi.getPriorities() as Promise<{ success: boolean; data: SmartPriorityCounts; error?: unknown }>,
}

export type { SmartScoreInput, SmartScoreResult, SmartWeightConfig, SmartPriorityCounts }
