import { api, type ListData } from './client'

export type AnnouncementCategory = 'notice' | 'meeting' | 'policy' | 'urgent' | 'other'

export interface DeptAnnouncement {
  id: string
  title: string
  content: string
  category: AnnouncementCategory
  pinned: boolean
  expiresAt: string
  author: string
  createdAt: string
  updatedAt: string
}

export type OnCallShiftType = 'DAY' | 'NIGHT' | 'WEEKEND'

export interface OnCallSchedule {
  id: string
  date: string
  doctorId: string
  doctorName: string
  shift: OnCallShiftType
  role: string
  createdAt: string
  updatedAt: string
}

export interface OnCallCalendarDay {
  date: string
  weekday: string
  isToday: boolean
  schedules: OnCallSchedule[]
}

export interface OnCallCalendar {
  month: string
  days: OnCallCalendarDay[]
}

// [G005 Wave3A P2] 科室公告 + 值班管理 (backend dept-announcement module)
export const deptApi = {
  // 公告
  listAnnouncements: () => api.get<ListData<DeptAnnouncement>>('/dept-announcements'),
  listActiveAnnouncements: () => api.get<ListData<DeptAnnouncement>>('/dept-announcements/active'),
  createAnnouncement: (data: Partial<DeptAnnouncement>) => api.post<DeptAnnouncement>('/dept-announcements', data),
  updateAnnouncement: (id: string, data: Partial<DeptAnnouncement>) => api.patch<DeptAnnouncement>(`/dept-announcements/${id}`, data),
  deleteAnnouncement: (id: string) => api.delete(`/dept-announcements/${id}`),
  // 值班
  listSchedules: (month?: string) =>
    api.get<ListData<OnCallSchedule>>(`/on-call-schedules${month ? `?month=${month}` : ''}`),
  getCalendar: (month: string) => api.get<OnCallCalendar>(`/on-call-schedules/calendar?month=${month}`),
  createSchedule: (data: { date: string; doctorId: string; doctorName: string; shift: OnCallShiftType; role?: string }) =>
    api.post<OnCallSchedule>('/on-call-schedules', data),
  updateSchedule: (id: string, data: Partial<{ date: string; doctorId: string; doctorName: string; shift: OnCallShiftType; role: string }>) =>
    api.put<OnCallSchedule>(`/on-call-schedules/${id}`, data),
  deleteSchedule: (id: string) => api.delete(`/on-call-schedules/${id}`),
}
