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

// [G005 Wave1A P1-1] kiosk.controller 3 端点: settings / messages / stats
export interface KioskSetting {
  key: string
  value: string
  description: string
}

export interface KioskMessage {
  id: string
  title: string
  content: string
  level: 'info' | 'warning' | 'urgent'
  active: boolean
  updatedAt: string
}

export const kioskApi = {
  lookup: (idCardLast4: string) =>
    api.get<KioskPatientDto[]>(`/kiosk/patients?last4=${encodeURIComponent(idCardLast4)}`),

  checkIn: (data: KioskCheckInRequest) =>
    api.post<KioskCheckInResultDto>('/kiosk/check-in', data),

  // [Wave1B P2] 主路径封装: POST /kiosk/patients/:id/checkin (患者 ID 走路径参数)
  checkinById: (id: string, data: Omit<KioskCheckInRequest, 'patientId'>) =>
    api.post<KioskCheckInResultDto>(`/kiosk/patients/${encodeURIComponent(id)}/checkin`, data),

  todayStats: () =>
    api.get<KioskTodayStatsDto>('/kiosk/today-stats'),

  // [G005 Wave1A P1-1] GET /kiosk/settings — 签到机设置
  getSettings: () =>
    api.get<KioskSetting[]>('/kiosk/settings'),

  // [G005 Wave1A P1-1] GET /kiosk/messages — 屏幕公告
  getMessages: () =>
    api.get<KioskMessage[]>('/kiosk/messages'),

  // [G005 Wave1A P1-1] GET /kiosk/stats — 今日统计 (与 /today-stats 同源)
  getStats: () =>
    api.get<KioskTodayStatsDto>('/kiosk/stats'),
}
