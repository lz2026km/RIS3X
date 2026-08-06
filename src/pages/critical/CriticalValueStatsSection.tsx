import { useState, useEffect } from 'react'
import {
  Bell, Clock, CheckCircle, AlertTriangle, TrendingUp, Target, ArrowUpRight,
  Timer, PieChart as PieChartIcon, BarChart3, AlertOctagon,
} from 'lucide-react'
import type { CriticalValue } from './types'
import { toStoreStatus, PRIMARY_COLOR, PRIMARY_LIGHT } from './types'
import { criticalStatsApi, type MissedReportStats, type NotificationCompletionStats } from '../../services/api/criticalStatsApi'
import { criticalApi, type CriticalStatsDto } from '../../services/api/criticalApi'

interface ChartData {
  label: string; value: number; color: string
}

const StatCard = ({ label, value, icon: Icon, color, bgColor, trend, suffix }: {
  label: string; value: number | string; icon: React.ComponentType<any>; color: string; bgColor: string; trend?: string; suffix?: string
}) => (
  <div
    style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 16, transition: 'box-shadow 0.2s', cursor: 'pointer' }}
    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)')}
  >
    <div style={{ width: 48, height: 48, borderRadius: 12, background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={24} style={{ color }} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#1e3a5f', lineHeight: 1 }}>{value}{suffix || ''}</div>
      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{label}</div>
    </div>
    {trend && (
      <div style={{ fontSize: 12, color: trend.startsWith('+') ? '#059669' : '#dc2626', background: trend.startsWith('+') ? '#d1fae5' : '#fee2e2', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
        {trend}
      </div>
    )}
  </div>
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
    const d = new Date(c.createdAt)
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
    { label: 'CT', value: data.filter((d) => d.modality === 'CT').length, color: '#1e40af' },
    { label: 'MR', value: data.filter((d) => d.modality === 'MR').length, color: '#2563eb' },
    { label: 'DR', value: data.filter((d) => d.modality === 'DR').length, color: '#059669' },
    { label: 'DSA', value: data.filter((d) => d.modality === 'DSA').length, color: '#d97706' },
  ]
  const totalModality = modalityData.reduce((sum, d) => sum + d.value, 0)

  const timeData: ChartData[] = [
    { label: '30分钟内', value: 3, color: '#059669' },
    { label: '1小时内', value: 4, color: '#2563eb' },
    { label: '2小时内', value: 2, color: '#d97706' },
    { label: '超时', value: overdueCount || 1, color: '#dc2626' },
  ]
  const maxTime = Math.max(...timeData.map((d) => d.value))

  const chartTabs = [
    { key: 'trend', label: '趋势', icon: TrendingUp },
    { key: 'modality', label: '设备分布', icon: PieChartIcon },
    { key: 'time', label: '处理时效', icon: BarChart3 },
    { key: 'notification', label: '10分钟通报', icon: Timer },
    { key: 'missed', label: '漏报率', icon: AlertOctagon },
  ]

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', borderRadius: 10, padding: 14, color: '#fff' }}>
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>本月新增危急值</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{thisMonthCount}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>例</div>
        </div>
        <div style={{ background: '#d1fae5', borderRadius: 10, padding: 14, border: '1px solid #a7f3d0' }}>
          <div style={{ fontSize: 12, color: '#059669', marginBottom: 4 }}>及时处理率</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#059669' }}>{timelyRate}</div>
          <div style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>目标≥85%</div>
        </div>
        <div style={{ background: '#f5f3ff', borderRadius: 10, padding: 14, border: '1px solid #ddd6fe' }}>
          <div style={{ fontSize: 12, color: '#7c3aed', marginBottom: 4 }}>已转随访数</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#7c3aed' }}>{transferredCount}</div>
          <div style={{ fontSize: 12, color: '#a855f7', marginTop: 2 }}>例</div>
        </div>
        <div style={{ background: overdueProcessingCount > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: 10, padding: 14, border: `1px solid ${overdueProcessingCount > 0 ? '#fecaca' : '#bbf7d0'}` }}>
          <div style={{ fontSize: 12, color: overdueProcessingCount > 0 ? '#dc2626' : '#059669', marginBottom: 4 }}>处理中超期数</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: overdueProcessingCount > 0 ? '#dc2626' : '#059669' }}>{overdueProcessingCount}</div>
          <div style={{ fontSize: 12, color: overdueProcessingCount > 0 ? '#f87171' : '#4ade80', marginTop: 2 }}>{overdueProcessingCount > 0 ? '需要关注' : '全部正常'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {chartTabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button key={tab.key} onClick={() => setActiveChart(tab.key as typeof activeChart)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: `1px solid ${activeChart === tab.key ? '#1e3a5f' : '#e2e8f0'}`, background: activeChart === tab.key ? '#1e3a5f' : '#fff', color: activeChart === tab.key ? '#fff' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Icon size={14} />{tab.label}
            </button>
          )
        })}
      </div>

      {activeChart === 'trend' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 12 }}>本月危急值数量趋势（近7天）</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
            {trendData.map((d, idx) => (
              <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', height: `${(d.count / maxTrend) * 80}px`, background: idx === trendData.length - 1 ? '#dc2626' : '#1e3a5f', borderRadius: '4px 4px 0 0', transition: 'height 0.3s', minHeight: 4 }} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{d.day}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f' }}>{d.count}</span>
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
                acc.elements.push(<circle key={d.label} cx="60" cy="60" r="50" fill="none" stroke={d.color} strokeWidth="20" strokeDasharray={`${dashArray} ${377 - dashArray}`} strokeDashoffset={-acc.offset} />)
                acc.offset += dashArray; return acc
              }, { elements: [] as React.ReactNode[], offset: 0 }).elements}
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1e3a5f' }}>{totalModality}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>总计</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {modalityData.map((d) => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color }} />
                <div style={{ flex: 1, fontSize: 12, color: '#334155' }}>{d.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f' }}>{d.value}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', width: 40, textAlign: 'right' }}>{Math.round((d.value / totalModality) * 100)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeChart === 'time' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 12 }}>处理时效分布</div>
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
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 12 }}>漏报率统计</div>
          {missedStats ? (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: 14, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>本月检查总数</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#1e40af' }}>{missedStats.totalExams}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>人次</div>
                </div>
                <div style={{ flex: 1, background: '#fef2f2', borderRadius: 10, padding: 14, border: '1px solid #fecaca', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>漏报次数</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{missedStats.missedCount}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>次</div>
                </div>
                <div style={{ flex: 1, background: '#d1fae5', borderRadius: 10, padding: 14, border: '1px solid #a7f3d0', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>漏报率</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#059669' }}>{missedStats.missedRate}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>低于目标1%</div>
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', marginBottom: 10 }}>漏报原因分析</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {missedStats.topMissedReasons.map((item, idx) => {
                  const pct = Math.round((item.count / missedStats.missedCount) * 100)
                  const colors = ['#dc2626', '#d97706', '#2563eb', '#64748b']
                  return (
                    <div key={item.reason} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: colors[idx], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>{idx + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 12, color: '#334155' }}>{item.reason}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{item.count}次</span>
                        </div>
                        <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: colors[idx], borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>加载中...</div>
          )}
        </div>
      )}

      {activeChart === 'notification' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Timer size={16} style={{ color: '#1e40af' }} />
            10分钟通报完成率统计
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>国家卫健委2024年版质控指标</span>
          </div>
          {notificationStats ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_LIGHT} 100%)`, borderRadius: 10, padding: 14, textAlign: 'center', color: '#fff' }}>
                  <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>本月通报总数</div>
                  <div style={{ fontSize: 28, fontWeight: 800 }}>{notificationStats.totalCount}</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>例</div>
                </div>
                <div style={{ background: '#d1fae5', borderRadius: 10, padding: 14, textAlign: 'center', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: 12, color: '#059669', marginBottom: 4 }}>10分钟内完成</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#059669' }}>{notificationStats.completedWithin10Min}</div>
                  <div style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>例</div>
                </div>
                <div style={{ background: '#eff6ff', borderRadius: 10, padding: 14, textAlign: 'center', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: 12, color: '#1e40af', marginBottom: 4 }}>完成率</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#1e40af' }}>{notificationStats.completionRate}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>目标≥90%</div>
                </div>
                <div style={{ background: '#fef3c7', borderRadius: 10, padding: 14, textAlign: 'center', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: 12, color: '#d97706', marginBottom: 4 }}>平均通报时间</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#d97706' }}>{notificationStats.avgNotificationTime}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>分钟</div>
                </div>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 12 }}>今日通报情况</div>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>今日通报</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#1e40af' }}>{notificationStats.todayCount}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                      <span>完成进度</span>
                      <span style={{ fontWeight: 700, color: '#059669' }}>{notificationStats.todayCompleted}/{notificationStats.todayCount}</span>
                    </div>
                    <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${notificationStats.todayCount > 0 ? (notificationStats.todayCompleted / notificationStats.todayCount) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, #1e40af 0%, #3b82f6 100%)', borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>完成率</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: parseFloat(notificationStats.todayRate) >= 90 ? '#059669' : '#d97706' }}>{notificationStats.todayRate}</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>加载中...</div>
          )}
          <div style={{ background: '#eff6ff', borderRadius: 10, padding: 12, border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>国家卫健委2024年版质控指标说明</div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
              <div style={{ marginBottom: 4 }}>• <span style={{ fontWeight: 600, color: '#334155' }}>10分钟通报完成率</span>：自发现危急值至通报临床时间&lt;=10分钟的比例</div>
              <div style={{ marginBottom: 4 }}>• <span style={{ fontWeight: 600, color: '#334155' }}>达标标准</span>：三级医院≥90%，二级医院≥85%</div>
              <div>• <span style={{ fontWeight: 600, color: '#334155' }}>超时处理</span>：&gt;30分钟未通报需启动升级机制</div>
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
    const d = new Date(c.createdAt)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const timelyRate = notificationStats?.completionRate || '—'
  const transferred = data.filter((c) => c.transferredToFollowUp).length
  const overdueProcessing = data.filter((c) => toStoreStatus(String(c.status)) === 'resolving' && c.processingDuration && parseInt(String(c.processingDuration || 0)) > 60).length

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label="待处理危急值" value={pending} icon={Bell} color="#dc2626" bgColor="#fee2e2" trend={pending > 0 ? '+' + pending : undefined} />
        <StatCard label="处理中" value={processing} icon={Clock} color="#d97706" bgColor="#fef3c7" />
        <StatCard label="已处理" value={resolved} icon={CheckCircle} color="#059669" bgColor="#d1fae5" trend="+3" />
        <StatCard label="超时未处理" value={overdue} icon={AlertTriangle} color="#991b1b" bgColor="#fecaca" trend={overdue > 0 ? '+' + overdue : undefined} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        <StatCard label={apiStats ? '今日新增危急值' : '本月新增危急值'} value={thisMonth} icon={TrendingUp} color="#1e40af" bgColor="#dbeafe" />
        <StatCard label="及时处理率" value={timelyRate} icon={Target} color="#059669" bgColor="#d1fae5" suffix="%" />
        <StatCard label="已转随访数" value={transferred} icon={ArrowUpRight} color="#7c3aed" bgColor="#f5f3ff" />
        <StatCard label="处理中超期数" value={overdueProcessing} icon={Timer} color={overdueProcessing > 0 ? '#dc2626' : '#059669'} bgColor={overdueProcessing > 0 ? '#fef2f2' : '#d1fae5'} />
      </div>
      <StatisticsCharts data={data} missedStats={missedStats} notificationStats={notificationStats} />
    </>
  )
}
