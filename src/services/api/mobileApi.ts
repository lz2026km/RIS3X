import { api } from './client'


export interface DoctorWorklistItem {
  id: string
  patientName: string
  gender: string
  age: number
  modality: string
  examItem: string
  bodyPart: string
  status: 'pending' | 'reading' | 'reported'
  priority: 'routine' | 'urgent' | 'critical'
  accessionNumber: string
  imagesCount: number
  createdAt: string
}

export interface DoctorStats {
  totalPending: number
  totalReading: number
  completedToday: number
  criticalFindings: number
  avgReportTime: number
}

export const mobileApi = {
  jscode2session: () => api.get<unknown>('/mobile/jscode2session'),

  getDoctorWorklist: (params?: { status?: string; search?: string }) =>
    api.get<DoctorWorklistItem[]>(`/mobile/doctor/worklist?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  getDoctorStats: () =>
    api.get<DoctorStats>('/mobile/doctor/stats'),
}

export default mobileApi
