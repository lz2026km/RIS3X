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

export const occupancyApi = {
  getRooms: () => api.get<OccupancyRoom[]>('/occupancy/rooms'),

  getQueue: (roomId: string) => api.get<OccupancyQueue>(`/occupancy/queue/${roomId}`),

  getTrends: () => api.get<OccupancyTrendPoint[]>('/occupancy/trends'),

  updateRoomStatus: (roomId: string, status: RoomStatusValue) =>
    api.post<OccupancyRoom>(`/occupancy/room/${roomId}/status`, { status }),
}
