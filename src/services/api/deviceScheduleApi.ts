import { api } from './client'

// [G005 v3.0.6.11-103 Wave 18] 设备调度甘特图 V2 API — 后端 /devices/schedule (DeviceScheduleService)

export type ScheduleBlockType = 'EXAM' | 'MAINTENANCE' | 'IDLE'

export interface ScheduleBlockDto {
  id: string
  deviceId: string
  deviceName: string
  type: ScheduleBlockType
  title: string
  start: string
  end: string
  examId?: string
  examNo?: string
  patientName?: string
  priority?: string
}

export interface ConflictInfoDto {
  blockId: string
  deviceId: string
  deviceName: string
  title: string
  start: string
  end: string
  overlapWith: string[]
  suggestion: { start: string; end: string; reason: string }
}

export interface DeviceWeekDayDto {
  date: string
  label: string
}

export interface DeviceWeekViewDto {
  weekStart: string
  days: DeviceWeekDayDto[]
  devices: Array<{
    deviceId: string
    code: string
    name: string
    modality: string
    blocks: ScheduleBlockDto[]
    conflicts: ConflictInfoDto[]
    utilization: number
  }>
}

export interface DeviceScheduleStatsDto {
  weekStart: string
  totalBlocks: number
  examBlocks: number
  maintenanceBlocks: number
  conflicts: number
  utilizationByDevice: Array<{ deviceId: string; name: string; utilization: number; examCount: number; maintenanceMinutes: number }>
  idleHours: number
}

export interface CreateBlockDto {
  deviceId: string
  type: 'EXAM' | 'MAINTENANCE'
  title: string
  start: string
  end: string
  examId?: string
  examNo?: string
  patientName?: string
  priority?: string
}

export const deviceScheduleApi = {
  getWeek: (weekStart?: string) => {
    const qs = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : ''
    return api.get<DeviceWeekViewDto>(`/devices/schedule${qs}`)
  },

  getStats: (weekStart?: string) => {
    const qs = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : ''
    return api.get<DeviceScheduleStatsDto>(`/devices/schedule/stats${qs}`)
  },

  getConflicts: (weekStart?: string) => {
    const qs = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : ''
    return api.get<ConflictInfoDto[]>(`/devices/schedule/conflicts${qs}`)
  },

  createBlock: (dto: CreateBlockDto) =>
    api.post<{ block: ScheduleBlockDto; conflicts: ConflictInfoDto[] }>('/devices/schedule/blocks', dto),

  updateBlock: (id: string, dto: { start?: string; end?: string; title?: string; type?: 'EXAM' | 'MAINTENANCE' }) =>
    api.patch<{ block: ScheduleBlockDto; conflicts: ConflictInfoDto[] }>(`/devices/schedule/blocks/${id}`, dto),

  deleteBlock: (id: string) =>
    api.delete<{ deleted: string }>(`/devices/schedule/blocks/${id}`),

  suggestMove: (id: string) =>
    api.get<{ blockId: string; suggestion: ConflictInfoDto['suggestion'] }>(`/devices/schedule/blocks/${id}/suggest`),
}
