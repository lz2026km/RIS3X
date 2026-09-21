import { api } from './client'
import type { ApiResponse } from './types'

export interface PatientInfo {
  id: string
  name: string
  gender: string
  age: number
}

export interface ExamInfo {
  id: string
  patientId: string
  modality: string
  bodyPart: string
  date: string
  description: string
}

// [G005] 真实后端路由对齐 (原 /ai/draft/patients* 后端不存在 → 404):
//   - 患者列表   GET /patients            (Nest 分页返回 { items, total })
//   - 患者检查   GET /patients/:id/exams  (Nest 返回裸数组)
// 归一化为页面期望的裸数组 (兼容 MSW 裸数组 / { data } / 后端 { items })。
function unwrapList<T>(res: ApiResponse<T[] | { items?: T[]; data?: T[] }>): ApiResponse<T[]> {
  if (!res.success) return { ...res, data: [] }
  const raw = res.data
  if (Array.isArray(raw)) return { ...res, data: raw }
  if (raw && typeof raw === 'object') {
    const boxed = raw as { items?: T[]; data?: T[] }
    if (Array.isArray(boxed.items)) return { ...res, data: boxed.items }
    if (Array.isArray(boxed.data)) return { ...res, data: boxed.data }
  }
  return { ...res, data: [] }
}

export const patientExamApi = {
  getPatients: async () =>
    unwrapList<PatientInfo>(
      await api.get<PatientInfo[] | { items?: PatientInfo[] }>('/patients?take=200'),
    ),

  getExams: async (patientId: string) =>
    unwrapList<ExamInfo>(
      await api.get<ExamInfo[] | { items?: ExamInfo[] }>(
        `/patients/${encodeURIComponent(patientId)}/exams`,
      ),
    ),
}
