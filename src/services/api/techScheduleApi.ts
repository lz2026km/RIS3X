import { api } from './client'

// Tech-Schedule (技师排班) API
// Backend: GET/POST /tech-schedules, PATCH/DELETE /tech-schedules/:id,
//          POST /tech-schedules/:id/confirm|swap|leave,
//          GET /tech-schedules/calendar|stats|meta, POST /tech-schedules/batch-create

export type TechShift = 'DAY' | 'NIGHT' | 'WEEKEND' | 'BACKUP'
export type TechScheduleStatus = 'SCHEDULED' | 'CONFIRMED' | 'SWAPPED' | 'ON_LEAVE'

export interface TechScheduleItem {
  id: string
  date: string
  shift: TechShift
  technicianId: string
  technicianName: string
  roomId: string | null
  roomName: string | null
  status: TechScheduleStatus
  notes: string | null
  swapReason: string | null
  leaveReason: string | null
  createdAt: string
  updatedAt: string
}

export interface TechScheduleInput {
  date: string
  shift: TechShift
  technicianId: string
  roomId?: string | null
  notes?: string | null
}

export interface TechTechnician {
  id: string
  name: string
  group: string
}

export interface TechRoom {
  id: string
  name: string
}

export interface TechCalendarDay {
  date: string
  weekday: string
  isToday: boolean
  schedules: TechScheduleItem[]
}

export interface TechCalendar {
  month: string
  year: number
  days: TechCalendarDay[]
  technicians: TechTechnician[]
}

export interface TechStats {
  month: string
  totalShifts: number
  technicianCount: number
  leaveCount: number
  nightShiftCount: number
  weekendShiftCount: number
  backupShiftCount: number
  confirmedCount: number
  swappedCount: number
  byTechnician: Array<{ technicianId: string; technicianName: string; count: number; nights: number; leaves: number }>
  byShift: Array<{ shift: TechShift; label: string; count: number }>
}

const qs = (params: Record<string, string | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
  return parts.length > 0 ? `?${parts.join('&')}` : ''
}

export const techScheduleApi = {
  list: (params?: { date?: string; month?: string; technicianId?: string; status?: string }) =>
    api.getList<TechScheduleItem>(`/tech-schedules${qs(params ?? {})}`),

  calendar: (month?: string, year?: number) =>
    api.get<TechCalendar>(`/tech-schedules/calendar${qs({ month, year: year ? String(year) : undefined })}`),

  stats: (month?: string, year?: number) =>
    api.get<TechStats>(`/tech-schedules/stats${qs({ month, year: year ? String(year) : undefined })}`),

  meta: () => api.get<{ technicians: TechTechnician[]; rooms: TechRoom[] }>('/tech-schedules/meta'),

  create: (data: TechScheduleInput) => api.post<TechScheduleItem>('/tech-schedules', data),

  update: (id: string, data: Partial<TechScheduleInput>) =>
    api.patch<TechScheduleItem>(`/tech-schedules/${id}`, data),

  remove: (id: string) => api.delete(`/tech-schedules/${id}`),

  confirm: (id: string) => api.post<TechScheduleItem>(`/tech-schedules/${id}/confirm`),

  swap: (id: string, data: { targetId?: string; targetTechId?: string; reason?: string }) =>
    api.post<{ source: TechScheduleItem; target: TechScheduleItem }>(`/tech-schedules/${id}/swap`, data),

  leave: (id: string, data: { reason: string }) =>
    api.post<TechScheduleItem>(`/tech-schedules/${id}/leave`, data),

  batchCreate: (data: { startDate: string; endDate: string; shiftPattern: TechShift[] }) =>
    api.post<{ created: TechScheduleItem[]; count: number }>('/tech-schedules/batch-create', data),
}
