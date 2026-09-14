import { api } from './client'

export interface QueueCallDto {
  id: string
  patientName: string
  examItem: string
  roomId: string
  roomName: string
  status: 'waiting' | 'called' | 'in_service' | 'completed'
  queueNumber: string
  calledAt?: string
  completedAt?: string
  priority?: string
}

export interface ExamRoomStatus {
  id: string
  roomNumber: string
  modality: string
  status: '空闲' | '使用中' | '维护中'
  currentPatient?: string
  queueCount: number
}

// [G005 Wave1A P0] 房间队列明细 (后端 GET /queue/:roomId → { roomId, roomName, queue })
export interface RoomQueueDetail {
  roomId: string
  roomName: string
  queue: QueueCallDto[]
}

// [v3.0.6.11-104 Wave 2D] 排队优先级 (POST /queue/:id/priority)
export type QueuePriority = '普通' | '紧急' | '危重'

export const queueApi = {
  list: () =>
    api.get<QueueCallDto[]>('/queue'),

  // [G005 Wave1A P0] 房间队列明细 (GET /queue/:roomId)
  getRoomQueue: (roomId: string) =>
    api.get<RoomQueueDetail>(`/queue/${encodeURIComponent(roomId)}`),

  // [G005 Wave1A P0] 房间实时状态 (GET /queue/:roomId/status)
  getRoomStatusDetail: (roomId: string) =>
    api.get<ExamRoomStatus>(`/queue/${encodeURIComponent(roomId)}/status`),

  getRoomStatus: () =>
    api.get<ExamRoomStatus[]>('/queue/rooms'),

  call: (id: string) =>
    api.post<QueueCallDto>(`/queue/${id}/call`),

  complete: (id: string) =>
    api.post<QueueCallDto>(`/queue/${id}/complete`),

  recall: (id: string) =>
    api.post<QueueCallDto>(`/queue/${id}/recall`),

  // [v3.0.6.11-104 Wave 2D] 调整排队优先级
  setPriority: (id: string, priority: QueuePriority) =>
    api.post<QueueCallDto>(`/queue/${encodeURIComponent(id)}/priority`, { priority }),
}
