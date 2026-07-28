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

export const criticalStatsApi = {
  getMissedStats: () =>
    api.get<MissedReportStats>('/criticals/stats/missed'),

  getNotificationStats: () =>
    api.get<NotificationCompletionStats>('/criticals/stats/notification'),
}
