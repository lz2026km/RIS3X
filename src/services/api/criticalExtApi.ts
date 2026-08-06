import { api } from './client'

export interface CriticalExtRuleDto {
  id: string; name: string; condition: string; action: string; severity: string; enabled: boolean; createdAt?: string; updatedAt?: string
}

export interface CriticalExtStatsDto { total: number; pending: number; notified: number; acknowledged: number; resolved: number; escalated: number }
export interface CriticalExtSummaryDto { todayCount: number; weeklyCount: number; monthlyCount: number; avgResponseTime: number }
export interface CriticalExtTimelineDto { date: string; count: number; resolved: number; escalated: number }
export interface CriticalExtCenterDto { id: string; patientName: string; finding: string; severity: string; status: string; triggeredAt: string; department: string }

// [W5] 危急值通知通道开关配置
export interface CriticalChannelDto {
  channel: 'SYSTEM' | 'SMS' | 'PHONE' | 'WECHAT' | 'EMAIL'
  label: string
  enabled: boolean
}

// [G005-P0] 危急值扩展前缀统一: 与 backend criticalext.controller.ts (@Controller('critical-ext')) 一一对应
// [G005-P1] 列表双形状: MSW 裸数组 { data: T[] } / 后端 { data: { items, total } }
export type ListPayload<T> = T[] | { items: T[]; total: number }

export const criticalExtApi = {
  listRules: () => api.get<ListPayload<CriticalExtRuleDto>>('/critical-ext/rules'),
  createRule: (data: Partial<CriticalExtRuleDto>) => api.post<CriticalExtRuleDto>('/critical-ext/rules', data),
  updateRule: (id: string, data: Partial<CriticalExtRuleDto>) => api.put<CriticalExtRuleDto>(`/critical-ext/rules/${id}`, data),
  deleteRule: (id: string) => api.delete(`/critical-ext/rules/${id}`),
  getStats: () => api.get<CriticalExtStatsDto>('/critical-ext/stats'),
  getSummary: () => api.get<CriticalExtSummaryDto>('/critical-ext/stats/summary'),
  getTimeline: () => api.get<CriticalExtTimelineDto[]>('/critical-ext/stats/timeline'),
  listCenter: () => api.get<CriticalExtCenterDto[]>('/critical-ext/center'),
  getCenterItem: (id: string) => api.get<CriticalExtCenterDto>(`/critical-ext/center/${id}`),
  autoDetect: (data: { examId: string; finding: string }) => api.post<{ id: string }>('/critical-ext/auto-detect', data),
  closeLoop: (data: { criticalId: string; note: string }) => api.post<{ id: string }>('/critical-ext/close-loop', data),
  getReceiverPortal: () => api.get<unknown>('/critical-ext/receiver'),
  // [G005-P0] 随访记录 (后端 critical-ext/follow-up-records)
  listFollowUpRecords: () => api.get<unknown[]>('/critical-ext/follow-up-records'),
  // [W5] 通知通道开关配置 (GET/PUT /critical-ext/channels)
  getChannels: () => api.get<ListPayload<CriticalChannelDto>>('/critical-ext/channels'),
  saveChannels: (channels: CriticalChannelDto[]) =>
    api.put<ListPayload<CriticalChannelDto>>('/critical-ext/channels', { channels }),
}
