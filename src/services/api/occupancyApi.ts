import { api } from './client'

// Occupancy (房间占用) API
// Backend: GET /occupancy/rooms, /occupancy/queue/:roomId, /occupancy/trends, POST /occupancy/room/:roomId/status

export type RoomStatusValue = 'idle' | 'occupied' | 'disinfecting' | 'fault'

export interface OccupancyRoom {
  id: string
  roomNo: string
  status: RoomStatusValue
  currentPatient?: string
  examItem?: string
  startTime?: string
  expectedEnd?: string
  overdue: boolean
}

export interface OccupancyQueueEntry {
  position: number
  patientName: string
  examItem: string
  estimatedWaitMin: number
}

export interface OccupancyQueue {
  roomId: string
  queue: OccupancyQueueEntry[]
}

export interface OccupancyTrendPoint {
  time: string
  occupied: number
  total: number
  rate: number
}

// ===== [v3.0.6.11-104 Wave 2D] 占用扩展端点 (总览/每日趋势/班次对比) =====

export interface OccupancyOverviewDto {
  totalRooms: number
  occupiedRooms: number
  idleRooms: number
  disinfectingRooms: number
  faultRooms: number
  occupancyRate: number
  avgSessionMinutes: number
  todayExams: number
  overdueRooms: number
  seeded: boolean
}

export interface OccupancyDailyPoint {
  date: string
  label: string
  occupancyRate: number
  occupiedAvg: number
  totalRooms: number
  exams: number
  seeded: boolean
}

export interface ShiftStatDto {
  shift: 'morning' | 'afternoon' | 'evening' | 'night'
  shiftZh: string
  timeRange: string
  occupancyRate: number
  exams: number
  avgSessionMinutes: number
  seeded: boolean
}

export const occupancyApi = {
  getRooms: () => api.get<OccupancyRoom[]>('/occupancy/rooms'),

  getQueue: (roomId: string) => api.get<OccupancyQueue>(`/occupancy/queue/${roomId}`),

  getTrends: () => api.get<OccupancyTrendPoint[]>('/occupancy/trends'),

  updateRoomStatus: (roomId: string, status: RoomStatusValue) =>
    api.post<OccupancyRoom>(`/occupancy/room/${roomId}/status`, { status }),

  // [v3.0.6.11-104 Wave 2D]
  getOverview: () => api.get<OccupancyOverviewDto>('/occupancy/overview'),

  getDailyTrend: (days = 7) => api.get<OccupancyDailyPoint[]>(`/occupancy/daily-trend?days=${days}`),

  getByShift: () => api.get<ShiftStatDto[]>('/occupancy/by-shift'),
}
