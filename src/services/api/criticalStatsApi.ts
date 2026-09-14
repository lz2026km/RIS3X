import { api } from './client'

export interface MissedReportStats {
  totalExams: number
  missedCount: number
  missedRate: string
  topMissedReasons: { reason: string; count: number }[]
}

export interface NotificationCompletionStats {
  totalCount: number
  completedWithin10Min: number
  completionRate: string
  avgNotificationTime: string
  todayCount: number
  todayCompleted: number
  todayRate: string
}

// ===== [v3.0.6.11-104 Wave 2D] 危急值统计扩展端点 DTO =====

export interface CriticalOverviewDto {
  total: number
  todayCount: number
  unhandled: number
  timeoutCount: number
  avgResponseMin: number
  avgCloseMin: number
  bySeverity: Record<string, number>
  byState: Record<string, number>
}

export interface CriticalDailyTrendDto {
  items: Array<{ date: string; found: number; closed: number }>
  total: number
}

export interface CriticalDepartmentStat {
  department: string
  total: number
  success: number
  pending: number
  escalated: number
  successRate: number
}

export interface CriticalDepartmentStatsDto {
  items: CriticalDepartmentStat[]
  total: number
}

export interface CriticalTimelineEvent {
  type: string
  label: string
  timestamp: string
  actor?: string
  note?: string
}

export interface CriticalTimelineDto {
  criticalId: string
  state: string
  severity: string
  steps: Record<string, boolean>
  totalEvents: number
  events: CriticalTimelineEvent[]
}

export const criticalStatsApi = {
  getMissedStats: () =>
    api.get<MissedReportStats>('/criticals/stats/missed'),

  getNotificationStats: () =>
    api.get<NotificationCompletionStats>('/criticals/stats/notification'),

  // [v3.0.6.11-104 Wave 2D]
  getOverview: () =>
    api.get<CriticalOverviewDto>('/criticals/overview'),

  getDailyTrend: (days = 30) =>
    api.get<CriticalDailyTrendDto>(`/criticals/daily-trend?days=${days}`),

  getByDepartment: () =>
    api.get<CriticalDepartmentStatsDto>('/criticals/by-department'),

  getTimeline: (id: string) =>
    api.get<CriticalTimelineDto>(`/criticals/${encodeURIComponent(id)}/timeline`),
}
