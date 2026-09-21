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

// ===== [W10E-3] 叫号队列扩展统计 DTO =====
export interface QueueOverviewDto {
  date: string
  todayCalled: number
  todayCompleted: number
  waitingCount: number
  calledCount: number
  inServiceCount: number
  completedCount: number
  avgWaitMinutes: number
  maxWaitMinutes: number
  timeoutCount: number
  busyRooms: number
  idleRooms: number
  totalRooms: number
  avgQueueLength: number
  seeded: boolean
}

export interface QueueRoomStatusSummaryDto {
  totalRooms: number
  byStatus: Record<string, number>
  waitingTotal: number
  inServiceTotal: number
  busyRate: number
  byModality: Array<{ modality: string; total: number; busy: number; waiting: number; completed: number }>
  seeded: boolean
}

export interface QueueDailyTrendPoint {
  date: string
  label: string
  called: number
  completed: number
  timeout: number
  seeded: boolean
}

export interface QueueWaitingStatsDto {
  total: number
  waitingCount: number
  calledCount: number
  avgWaitMinutes: number
  maxWaitMinutes: number
  timeoutCount: number
  distribution: Array<{ range: string; count: number; percent: number }>
  byModality: Array<{ modality: string; count: number }>
  byPriority: Array<{ priority: string; count: number }>
  byPatientType: Array<{ patientType: string; count: number }>
  seeded: boolean
}

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

  // [G005 contract] 后端 POST /queue/:roomId/call, body 可选 { examId | patientId };
  //   path 为叫号房间 roomId, 按 body 定位患者 (房间无可解析条目时回退房间队列下一等待患者)。
  call: (roomId: string, body?: { examId?: string; patientId?: string }) =>
    api.post<QueueCallDto>(`/queue/${encodeURIComponent(roomId)}/call`, body ?? {}),

  // 后端 complete/recall 由队列条目 id (或 examId) 解析当前号 (路径参数名虽为 roomId, 语义为条目标识)
  complete: (entryId: string) =>
    api.post<QueueCallDto>(`/queue/${encodeURIComponent(entryId)}/complete`),

  recall: (entryId: string) =>
    api.post<QueueCallDto>(`/queue/${encodeURIComponent(entryId)}/recall`),

  // [v3.0.6.11-104 Wave 2D] 调整排队优先级
  setPriority: (id: string, priority: QueuePriority) =>
    api.post<QueueCallDto>(`/queue/${encodeURIComponent(id)}/priority`, { priority }),

  // [W10E-3] 叫号总览 / 房间状态汇总 / 趋势 / 候诊统计
  getOverview: () => api.get<QueueOverviewDto>('/queue/overview'),

  getRoomStatusSummary: () =>
    api.get<QueueRoomStatusSummaryDto>('/queue/room-status'),

  getDailyTrend: (days = 7) =>
    api.get<QueueDailyTrendPoint[]>(`/queue/daily-trend?days=${days}`),

  getWaitingStats: () => api.get<QueueWaitingStatsDto>('/queue/waiting-stats'),
}
