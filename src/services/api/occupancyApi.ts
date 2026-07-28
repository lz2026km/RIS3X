import { api } from './client'

// Occupancy (房间占用) API
// Backend: /occupancy/*

export interface OccupancyRoom {
  id: string
  roomId: string
  roomName: string
  department: string
  status: 'available' | 'occupied' | 'maintenance' | 'reserved'
  currentPatient?: string
  currentStudy?: string
  currentModality?: string
  scheduledUntil?: string
  utilization: number
}

export interface OccupancyTimelineEntry {
  id: string
  roomId: string
  roomName: string
  patientName?: string
  studyId?: string
  modality?: string
  startTime: string
  endTime?: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
}

export interface OccupancyStats {
  totalRooms: number
  availableRooms: number
  occupiedRooms: number
  avgUtilization: number
  peakHour: string
  roomDistribution: { roomName: string; utilization: number }[]
}

export interface OccupancyQueryParams {
  department?: string
  status?: string
  date?: string
  page?: number
  pageSize?: number
}

export const occupancyApi = {
  listRooms: (params?: OccupancyQueryParams) =>
    api.get<OccupancyRoom[]>(`/occupancy/rooms?${new URLSearchParams(params ?? {}).toString()}`),

  getRoom: (id: string) =>
    api.get<OccupancyRoom>(`/occupancy/rooms/${id}`),

  getTimeline: (params?: { roomId?: string; date?: string }) =>
    api.get<OccupancyTimelineEntry[]>(`/occupancy/timeline?${new URLSearchParams(params ?? {}).toString()}`),

  updateRoomStatus: (id: string, status: string) =>
    api.put<OccupancyRoom>(`/occupancy/rooms/${id}/status`, { status }),

  getStats: (params?: { startDate?: string; endDate?: string }) =>
    api.get<OccupancyStats>(`/occupancy/stats?${new URLSearchParams(params ?? {}).toString()}`),

  getDepartmentStats: () =>
    api.get<{ department: string; avgUtilization: number; roomCount: number }[]>('/occupancy/department-stats'),
}
