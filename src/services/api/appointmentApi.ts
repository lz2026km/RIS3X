import { api } from './client'

// [G005 Wave1B P1] 预约 API — CRUD 真实; rules/waitlist/reminders/reschedules/cancellations 已补
// (appointments.controller, Device/Appointment 派生 + seed), MSW 标注已更新。
export interface AppointmentDto {
  id: string
  patientName: string
  patientId: string
  modality: string
  bodyPart?: string
  startAt: string
  endAt: string
  deviceId: string
  deviceName: string
  room?: string
  priority: 'ROUTINE' | 'URGENT' | 'STAT'
  note?: string
  referringDoctor?: string
  state: 'SCHEDULED' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
  createdById: string
  createdAt?: string
  updatedAt?: string
}

export interface AppointmentListParams {
  skip?: number
  take?: number
  state?: string
  deviceId?: string
  dateFrom?: string
  dateTo?: string
  // [W2-4] 按患者过滤 (患者详情 360 时间线)
  patientId?: string
}

export interface WaitlistPatientDto {
  id: string
  patientName: string
  phone: string
  examItemName: string
  modality: string
  preferredDate: string
  preferredTime: string
  priority: string
  addedAt: string
  notified: boolean
}

export interface ReminderRecordDto {
  id: string
  patientName: string
  phone: string
  examType: string
  examDate: string
  examTime: string
  reminderTime: string
  channel: string
  status: string
  responseTime: string
}

export interface RescheduleRecordDto {
  id: string
  patientName: string
  phone: string
  examType: string
  originalDate: string
  originalTime: string
  newDate: string
  newTime: string
  reason: string
  operateTime: string
}

export interface CancellationRecordDto {
  id: string
  patientName: string
  phone: string
  examType: string
  cancelTime: string
  reason: string
  rebooked: string
}

export interface AppointmentRulesDto {
  deviceId: string
  deviceName: string
  maxDailyAppointments: number
  maxPerTimeSlot: number
  minAdvanceDays: number
  maxAdvanceDays: number
  noShowPenalty: number
  enabled: boolean
}

export const appointmentApi = {
  list: (params?: AppointmentListParams) => {
    const query = new URLSearchParams()
    if (params?.skip != null) query.set('skip', String(params.skip))
    if (params?.take != null) query.set('take', String(params.take))
    if (params?.state) query.set('state', params.state)
    if (params?.deviceId) query.set('deviceId', params.deviceId)
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    if (params?.patientId) query.set('patientId', params.patientId)
    const qs = query.toString()
    return api.get<AppointmentDto[]>(`/appointments${qs ? '?' + qs : ''}`)
  },

  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  getById: (id: string) =>
    api.get<AppointmentDto>(`/appointments/${id}`),

  create: (data: Omit<AppointmentDto, 'id' | 'state' | 'createdAt' | 'updatedAt'>) =>
    api.post<AppointmentDto>('/appointments', data),

  update: (id: string, data: Partial<Pick<AppointmentDto, 'state' | 'startAt' | 'endAt' | 'note'>>) =>
    api.patch<AppointmentDto>(`/appointments/${id}`, data),

  cancel: (id: string) =>
    api.delete<void>(`/appointments/${id}`),

  getRules: () =>
    api.get<AppointmentRulesDto[]>('/appointments/rules'),

  getWaitlist: () =>
    api.get<WaitlistPatientDto[]>('/appointments/waitlist'),

  getReminderRecords: () =>
    api.get<ReminderRecordDto[]>('/appointments/reminders'),

  getRescheduleRecords: () =>
    api.get<RescheduleRecordDto[]>('/appointments/reschedules'),

  getCancellationRecords: () =>
    api.get<CancellationRecordDto[]>('/appointments/cancellations'),
}
