import { useState, useEffect } from 'react'
import {
  Bell, Clock, CheckCircle, AlertTriangle, TrendingUp, Target, ArrowUpRight,
  Timer, PieChart as PieChartIcon, BarChart3, AlertOctagon,
} from 'lucide-react'
import type { CriticalValue } from './types'
import { toStoreStatus, PRIMARY_COLOR, PRIMARY_LIGHT } from './types'
import { criticalStatsApi, type MissedReportStats, type NotificationCompletionStats } from '../../services/api/criticalStatsApi'
import { criticalApi, type CriticalStatsDto } from '../../services/api/criticalApi'
import { StatCard as CommonStatCard } from '../../components/common/StatCard'
import { t } from '../../i18n/appI18n'

interface ChartData {
  label: string; value: number; color: string
}

// [UI-4] 收敛至公共 StatCard (保留数值/后缀/趋势)
const StatCard = ({ label, value, icon: Icon, color, bgColor, trend, suffix }: {
  label: string; value: number | string; icon: React.ComponentType<any>; color: string; bgColor: string; trend?: string; suffix?: string
}) => (
  <CommonStatCard
    title={label}
    value={value}
    suffix={suffix}
    icon={<Icon size={24} style={{ color }} />}
    color={color}
    iconBg={bgColor}
    sub={
      trend ? (
        <span style={{ fontSize: 12, color: trend.startsWith('+') ? '#059669' : 'var(--color-error-600)', background: trend.startsWith('+') ? 'var(--color-success-bg)' : 'var(--color-error-bg)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
          {trend}
        </span>
      ) : undefined
    }
  />
)

const StatisticsCharts = ({ data, missedStats, notificationStats }: {
  data: CriticalValue[]
  missedStats: MissedReportStats | null
  notificationStats: NotificationCompletionStats | null
}) => {
  const [activeChart, setActiveChart] = useState<'trend' | 'modality' | 'time' | 'missed' | 'notification'>('trend')

  data.filter((c) => toStoreStatus(String(c.status)) === 'pending').length;
  data.filter((c) => toStoreStatus(String(c.status)) === 'resolving').length;
  data.filter((c) => toStoreStatus(String(c.status)) === 'resolved').length;
  const overdueCount = data.filter((c) => toStoreStatus(String(c.status)) === 'overdue').length
  const transferredCount = data.filter((c) => c.transferredToFollowUp).length
  const overdueProcessingCount = data.filter((c) => toStoreStatus(String(c.status)) === 'resolving' && c.processingDuration && parseInt(String(c.processingDuration || 0)) > 60).length
  const thisMonthCount = data.filter((c) => {
    const d = new Date(c.createdAt ?? c.reportedTime ?? '')
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const timelyRate = notificationStats?.completionRate || '—'

  const trendData = [
    { day: '04-25', count: 18 }, { day: '04-26', count: 17 }, { day: '04-27', count: 15 },
    { day: '04-28', count: 16 }, { day: '04-29', count: 14 }, { day: '04-30', count: 12 },
    { day: '05-01', count: data.length },
  ]
  const maxTrend = Math.max(...trendData.map((d) => d.count))

  const modalityData: ChartData[] = [
    { label: 'CT', value: data.filter((d) => d.modality === 'CT').length, color: 'var(--color-primary-800)' },
    { label: 'MR', value: data.filter((d) => d.modality === 'MR').length, color: 'var(--color-primary-600)' },
    { label: 'DR', value: data.filter((d) => d.modality === 'DR').length, color: '#059669' },
    { label: 'DSA', value: data.filter((d) => d.modality === 'DSA').length, color: 'var(--color-warning-600)' },
  ]
  const totalModality = modalityData.reduce((sum, d) => sum + d.value, 0)

  const timeData: ChartData[] = [
    { label: t('criticalValueStats.within30m'), value: 3, color: '#059669' },
    { label: t('criticalValueStats.within1h'), value: 4, color: 'var(--color-primary-600)' },
    { label: t('criticalValueStats.within2h'), value: 2, color: 'var(--color-warning-600)' },
    { label: t('criticalValueStats.overtime'), value: overdueCount || 1, color: 'var(--color-error-600)' },
  ]
  const maxTime = Math.max(...timeData.map((d) => d.value))

  const chartTabs = [
    { key: 'trend', label: t('criticalValueStats.tabTrend'), icon: TrendingUp },
    { key: 'modality', label: t('criticalValueStats.tabModality'), icon: PieChartIcon },
    { key: 'time', label: t('criticalValueStats.tabTime'), icon: BarChart3 },
    { key: 'notification', label: t('criticalValueStats.tabNotification'), icon: Timer },
    { key: 'missed', label: t('criticalValueStats.tabMissed'), icon: AlertOctagon },
  ]

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-500) 100%)', borderRadius: 10, padding: 14, color: '#fff' }}>
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>{t('criticalValueStats.thisMonthNewCritical')}</div>
          <div style={{ fontSize: 30, fontWeight: 700 }}>{thisMonthCount}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{t('criticalValueStats.unitCases')}</div>
        </div>
        <div style={{ background: 'var(--color-success-bg)', borderRadius: 10, padding: 14, border: '1px solid var(--color-success-border)' }}>
          <div style={{ fontSize: 12, color: '#059669', marginBottom: 4 }}>{t('criticalValueStats.timelyRate')}</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#059669' }}>{timelyRate}</div>
          <div style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>{t('criticalValueStats.target85')}</div>
        </div>
        <div style={{ background: 'var(--color-info-bg)', borderRadius: 10, padding: 14, border: '1px solid var(--color-info-border)' }}>
          <div style={{ fontSize: 12, color: '#7c3aed', marginBottom: 4 }}>{t('criticalValueStats.transferredToFollowUp')}</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#7c3aed' }}>{transferredCount}</div>
          <div style={{ fontSize: 12, color: '#a855f7', marginTop: 2 }}>{t('criticalValueStats.unitCases')}</div>
        </div>
        <div style={{ background: overdueProcessingCount > 0 ? 'var(--color-error-bg)' : 'var(--color-success-bg)', borderRadius: 10, padding: 14, border: `1px solid ${overdueProcessingCount > 0 ? 'var(--color-error-border)' : 'var(--color-success-border)'}` }}>
          <div style={{ fontSize: 12, color: overdueProcessingCount > 0 ? 'var(--color-error-600)' : '#059669', marginBottom: 4 }}>{t('criticalValueStats.overdueProcessingCount')}</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: overdueProcessingCount > 0 ? 'var(--color-error-600)' : '#059669' }}>{overdueProcessingCount}</div>
          <div style={{ fontSize: 12, color: overdueProcessingCount > 0 ? '#f87171' : '#4ade80', marginTop: 2 }}>{overdueProcessingCount > 0 ? t('criticalValueStats.needsAttention') : t('criticalValueStats.allNormal')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {chartTabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button key={tab.key} onClick={() => setActiveChart(tab.key as typeof activeChart)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: `1px solid ${activeChart === tab.key ? 'var(--color-primary-800)' : 'var(--border-color)'}`, background: activeChart === tab.key ? 'var(--color-primary-800)' : 'var(--bg-card)', color: activeChart === tab.key ? '#fff' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Icon size={14} />{tab.label}
            </button>
          )
        })}
      </div>

      {activeChart === 'trend' && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-primary-800)', marginBottom: 12 }}>{t('criticalValueStats.trendTitle')}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
            {trendData.map((d, idx) => (
              <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', height: `${(d.count / maxTrend) * 80}px`, background: idx === trendData.length - 1 ? 'var(--color-error-600)' : 'var(--color-primary-800)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s', minHeight: 4 }} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{d.day}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)' }}>{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeChart === 'modality' && (
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 120, height: 120 }}>
            <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
              {modalityData.reduce((acc, d) => {
                const pct = d.value / totalModality; const dashArray = pct * 377
                acc.elements.push(<circle key={d.label} cx="60" cy="60" r="50" fill="none" stroke={d.color} strokeWidth="14" strokeDasharray={`${dashArray} ${377 - dashArray}`} strokeDashoffset={-acc.offset} />)
                acc.offset += dashArray; return acc
              }, { elements: [] as React.ReactNode[], offset: 0 }).elements}
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-primary-800)' }}>{totalModality}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('criticalValueStats.total')}</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {modalityData.map((d) => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color }} />
                <div style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)' }}>{d.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)' }}>{d.value}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', width: 40, textAlign: 'right' }}>{Math.round((d.value / totalModality) * 100)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeChart === 'time' && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-primary-800)', marginBottom: 12 }}>{t('criticalValueStats.timeDistTitle')}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 100 }}>
            {timeData.map((d) => (
              <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', maxWidth: 48, height: `${(d.value / maxTime) * 80}px`, background: d.color, borderRadius: '4px 4px 0 0', transition: 'height 0.3s', minHeight: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{d.value}</span>
                </div>
                <span style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeChart === 'missed' && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-primary-800)', marginBottom: 12 }}>{t('criticalValueStats.missedStatsTitle')}</div>
          {missedStats ? (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 10, padding: 14, border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('criticalValueStats.totalExamsMonth')}</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-primary-800)' }}>{missedStats.totalExams}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{t('criticalValueStats.unitPersonTimes')}</div>
                </div>
                <div style={{ flex: 1, background: 'var(--color-error-bg)', borderRadius: 10, padding: 14, border: '1px solid var(--color-error-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('criticalValueStats.missedCount')}</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-error-600)' }}>{missedStats.missedCount}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{t('criticalValueStats.unitTimes')}</div>
                </div>
                <div style={{ flex: 1, background: 'var(--color-success-bg)', borderRadius: 10, padding: 14, border: '1px solid var(--color-success-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('criticalValueStats.missedRateLabel')}</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: '#059669' }}>{missedStats.missedRate}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{t('criticalValueStats.belowTarget1')}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 10 }}>{t('criticalValueStats.missedReasonTitle')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {missedStats.topMissedReasons.map((item, idx) => {
                  const pct = Math.round((item.count / missedStats.missedCount) * 100)
                  const colors = ['var(--color-error-600)', 'var(--color-warning-600)', 'var(--color-primary-600)', '#64748b']
                  return (
                    <div key={item.reason} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: colors[idx], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>{idx + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{item.reason}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)' }}>{t('criticalValueStats.countTimes', { count: item.count })}</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: colors[idx], borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>{t('criticalValueStats.loading')}</div>
          )}
        </div>
      )}

      {activeChart === 'notification' && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-primary-800)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Timer size={16} style={{ color: 'var(--color-primary-800)' }} />
            {t('criticalValueStats.notificationTitle')}
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>{t('criticalValueStats.guidelineTag')}</span>
          </div>
          {notificationStats ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_LIGHT} 100%)`, borderRadius: 10, padding: 14, textAlign: 'center', color: '#fff' }}>
                  <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>{t('criticalValueStats.totalNotificationsMonth')}</div>
                  <div style={{ fontSize: 30, fontWeight: 700 }}>{notificationStats.totalCount}</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{t('criticalValueStats.unitCases')}</div>
                </div>
                <div style={{ background: 'var(--color-success-bg)', borderRadius: 10, padding: 14, textAlign: 'center', border: '1px solid var(--color-success-border)' }}>
                  <div style={{ fontSize: 12, color: '#059669', marginBottom: 4 }}>{t('criticalValueStats.completedWithin10Min')}</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: '#059669' }}>{notificationStats.completedWithin10Min}</div>
                  <div style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>{t('criticalValueStats.unitCases')}</div>
                </div>
                <div style={{ background: 'var(--color-info-bg)', borderRadius: 10, padding: 14, textAlign: 'center', border: '1px solid var(--color-info-border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-primary-800)', marginBottom: 4 }}>{t('criticalValueStats.completionRate')}</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-primary-800)' }}>{notificationStats.completionRate}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{t('criticalValueStats.target90')}</div>
                </div>
                <div style={{ background: 'var(--color-warning-bg)', borderRadius: 10, padding: 14, textAlign: 'center', border: '1px solid var(--color-warning-border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-warning-600)', marginBottom: 4 }}>{t('criticalValueStats.avgNotificationTime')}</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-warning-600)' }}>{notificationStats.avgNotificationTime}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{t('criticalValueStats.unitMinutes')}</div>
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 14, border: '1px solid var(--border-color)', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 12 }}>{t('criticalValueStats.todayNotificationTitle')}</div>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('criticalValueStats.todayNotifications')}</div>
                    <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-primary-800)' }}>{notificationStats.todayCount}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                      <span>{t('criticalValueStats.completionProgress')}</span>
                      <span style={{ fontWeight: 700, color: '#059669' }}>{notificationStats.todayCompleted}/{notificationStats.todayCount}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${notificationStats.todayCount > 0 ? (notificationStats.todayCompleted / notificationStats.todayCount) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-primary-800) 0%, var(--color-primary-500) 100%)', borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('criticalValueStats.completionRate')}</div>
                    <div style={{ fontSize: 30, fontWeight: 700, color: parseFloat(notificationStats.todayRate) >= 90 ? '#059669' : 'var(--color-warning-600)' }}>{notificationStats.todayRate}</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>{t('criticalValueStats.loading')}</div>
          )}
          <div style={{ background: 'var(--color-info-bg)', borderRadius: 10, padding: 12, border: '1px solid var(--color-info-border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 8 }}>{t('criticalValueStats.guidelineDescTitle')}</div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
              <div style={{ marginBottom: 4 }}>• <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('criticalValueStats.guideline10minLabel')}</span>{t('criticalValueStats.guideline10minDesc')}</div>
              <div style={{ marginBottom: 4 }}>• <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('criticalValueStats.guidelineStandardLabel')}</span>{t('criticalValueStats.guidelineStandardDesc')}</div>
              <div>• <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('criticalValueStats.guidelineOverdueLabel')}</span>{t('criticalValueStats.guidelineOverdueDesc')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const CriticalValueStatsSection = ({ data }: { data: CriticalValue[] }) => {
  const [missedStats, setMissedStats] = useState<MissedReportStats | null>(null)
  const [notificationStats, setNotificationStats] = useState<NotificationCompletionStats | null>(null)
  const [apiStats, setApiStats] = useState<CriticalStatsDto | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [missedRes, notifRes, statsRes] = await Promise.all([
          criticalStatsApi.getMissedStats(),
          criticalStatsApi.getNotificationStats(),
          criticalApi.getStats(),
        ])
        if (cancelled) return
        if (missedRes.success && missedRes.data) setMissedStats(missedRes.data)
        if (notifRes.success && notifRes.data) setNotificationStats(notifRes.data)
        if (statsRes.success && statsRes.data) setApiStats(statsRes.data)
      } catch {
        // stats APIs may not be available yet; keep defaults
      }
    })()
    return () => { cancelled = true }
  }, [])

  // 优先使用后端 /criticals/stats 聚合值,失败时回退到列表数据统计
  const pending = apiStats?.pending ?? data.filter((c) => toStoreStatus(String(c.status)) === 'pending').length
  const processing = apiStats ? apiStats.acknowledged + apiStats.receipted : data.filter((c) => toStoreStatus(String(c.status)) === 'resolving').length
  const resolved = apiStats?.resolved ?? data.filter((c) => toStoreStatus(String(c.status)) === 'resolved').length
  const overdue = apiStats?.escalated ?? data.filter((c) => toStoreStatus(String(c.status)) === 'overdue').length
  const thisMonth = apiStats?.todayCount ?? data.filter((c) => {
    const d = new Date(c.createdAt ?? c.reportedTime ?? '')
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const timelyRate = notificationStats?.completionRate || '—'
  const transferred = data.filter((c) => c.transferredToFollowUp).length
  const overdueProcessing = data.filter((c) => toStoreStatus(String(c.status)) === 'resolving' && c.processingDuration && parseInt(String(c.processingDuration || 0)) > 60).length

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label={t('criticalValueStats.pendingCritical')} value={pending} icon={Bell} color="var(--color-error-600)" bgColor="var(--color-error-bg)" trend={pending > 0 ? '+' + pending : undefined} />
        <StatCard label={t('criticalValueStats.processing')} value={processing} icon={Clock} color="var(--color-warning-600)" bgColor="var(--color-warning-bg)" />
        <StatCard label={t('criticalValueStats.resolved')} value={resolved} icon={CheckCircle} color="#059669" bgColor="var(--color-success-bg)" trend="+3" />
        <StatCard label={t('criticalValueStats.overdueUnhandled')} value={overdue} icon={AlertTriangle} color="#991b1b" bgColor="var(--color-error-bg)" trend={overdue > 0 ? '+' + overdue : undefined} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label={apiStats ? t('criticalValueStats.todayNewCritical') : t('criticalValueStats.thisMonthNewCritical')} value={thisMonth} icon={TrendingUp} color="var(--color-primary-800)" bgColor="var(--color-info-bg)" />
        <StatCard label={t('criticalValueStats.timelyRate')} value={timelyRate} icon={Target} color="#059669" bgColor="var(--color-success-bg)" suffix="%" />
        <StatCard label={t('criticalValueStats.transferredToFollowUp')} value={transferred} icon={ArrowUpRight} color="#7c3aed" bgColor="var(--color-info-bg)" />
        <StatCard label={t('criticalValueStats.overdueProcessingCount')} value={overdueProcessing} icon={Timer} color={overdueProcessing > 0 ? 'var(--color-error-600)' : '#059669'} bgColor={overdueProcessing > 0 ? 'var(--color-error-bg)' : 'var(--color-success-bg)'} />
      </div>
      <StatisticsCharts data={data} missedStats={missedStats} notificationStats={notificationStats} />
    </>
  )
}
