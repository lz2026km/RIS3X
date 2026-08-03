import { api } from './client'

export interface KioskPatientDto {
  patientId: string
  patientName: string
  idCardLast4: string
  exams: Array<{ id: string; name: string }>
}

export interface KioskCheckInRequest {
  patientId: string
  patientName?: string
  examItemId: string
  idCardLast4: string
}

export interface KioskCheckInResultDto {
  patientId: string
  patientName: string
  examItemId: string
  queueNumber: string
  estimatedWaitMinutes: number
  roomName: string
  checkedInAt: string
}

export interface KioskTodayStatsDto {
  todayCount: number
  waitingCount: number
  avgWaitMinutes: number
  activeRooms: number
}

export const kioskApi = {
  lookup: (idCardLast4: string) =>
    api.get<KioskPatientDto[]>(`/kiosk/patients?last4=${encodeURIComponent(idCardLast4)}`),

  checkIn: (data: KioskCheckInRequest) =>
    api.post<KioskCheckInResultDto>('/kiosk/check-in', data),

  todayStats: () =>
    api.get<KioskTodayStatsDto>('/kiosk/today-stats'),
}
