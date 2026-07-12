import { api } from './client'

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
    const qs = query.toString()
    return api.get<AppointmentDto[]>(`/appointments${qs ? '?' + qs : ''}`)
  },

  getById: (id: string) =>
    api.get<AppointmentDto>(`/appointments/${id}`),

  create: (data: Omit<AppointmentDto, 'id' | 'state' | 'createdAt' | 'updatedAt'>) =>
    api.post<AppointmentDto>('/appointments', data),

  update: (id: string, data: Partial<Pick<AppointmentDto, 'state' | 'startAt' | 'endAt' | 'note'>>) =>
    api.patch<AppointmentDto>(`/appointments/${id}`, data),

  cancel: (id: string) =>
    api.delete<void>(`/appointments/${id}`),
}
