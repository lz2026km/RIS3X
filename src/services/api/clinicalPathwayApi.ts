import { api } from './client'

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

export const clinicalPathwayApi = {
  listPathways: () => api.get<ClinicalPathway[]>('/clinical-pathways'),

  getStats: () => api.get<PathwayStats>('/clinical-pathways/stats'),

  listPatients: () => api.get<PathwayPatient[]>('/clinical-pathways/patients'),

  getSteps: (id: string) => api.get<string[]>(`/clinical-pathways/${id}/steps`),

  togglePathway: (id: string, status?: 'active' | 'paused') =>
    api.post<{ id: string; status: string }>(`/clinical-pathways/${id}/toggle`, { status }),

  enrollPatient: (data: { patientName: string; pathwayName: string }) =>
    api.post<PathwayPatient>('/clinical-pathways/enroll', data),

  // [G005 W2-B] 患者路径追踪: 推进阶段 / 退出路径 (页面操作列, 后端暂无端点时前端本地兜底)
  advancePatient: (id: string) =>
    api.post<PathwayPatient>(`/clinical-pathways/patients/${id}/advance`),

  exitPatient: (id: string) =>
    api.post<{ deleted: boolean }>(`/clinical-pathways/patients/${id}/exit`),
}
