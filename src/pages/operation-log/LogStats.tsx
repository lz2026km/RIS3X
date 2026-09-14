import { useMemo } from 'react'
import type { OperationLog, HipaaStats } from './types'
import { PRIMARY, PRIMARY_LIGHT, ACCENT, SUCCESS, WARNING, DANGER, GRAY, WHITE, ACTION_COLORS, ACTION_ICONS, HIPAA_ACTION_TYPES } from './constants'
import { formatDate, formatTime } from './utils'
import { Activity, TrendingUp, TrendingDown, Flame, Users, Clock, User, Shield, AlertTriangle, AlertCircle, CheckCircle, Download, FileText, FileCheck, FileSpreadsheet, Eye, Timer, BarChart3, PieChart as PieChartIcon } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts'
import ChartContainer from '../../components/charts/ChartContainer'
import { t } from '../../i18n/appI18n'

// ============================================================
// TodayTrendCard
// ============================================================
function TodayTrendCard({ todayCount, yesterdayCount, todayTrend, peakHour, topUser }: {
  todayCount: number
  yesterdayCount: number
  todayTrend: number[]
  peakHour: string
  topUser: string
}) {
  const trendPercent = yesterdayCount > 0 ? ((todayCount - yesterdayCount) / yesterdayCount * 100).toFixed(1) : '0'
  const isPositive = todayCount >= yesterdayCount

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: `${ACCENT}20`, padding: 8, borderRadius: 8 }}>
              <Activity size={18} color={ACCENT} />
            </div>
            <span style={{ fontSize: 12, color: GRAY }}>{t('logStats.todayOps')}</span>
          </div>
          <span style={{
            fontSize: 12, padding: '2px 6px', borderRadius: 4,
            background: isPositive ? `${SUCCESS}20` : `${DANGER}20`,
            color: isPositive ? SUCCESS : DANGER,
          }}>
            {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          </span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: PRIMARY }}>{todayCount}</div>
        <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>
          {t('logStats.yesterday')} {yesterdayCount}，{isPositive ? '↑' : '↓'}{Math.abs(parseFloat(trendPercent))}%
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)', gridColumn: 'span 2' }}>
        <div style={{ fontWeight: 600, color: PRIMARY, marginBottom: 8, fontSize: 16 }}>{t('logStats.trend24h')}</div>
        <ChartContainer height={80} state={todayTrend.length > 0 ? 'ready' : 'empty'} emptyDescription={t('logStats.noData')}>
          <AreaChart data={todayTrend.map((v, i) => ({ hour: `${String(i).padStart(2, '0')}:00`, value: v }))}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="hour" tick={{ fontSize: 12 }} interval={3} />
            <YAxis hide />
            <Tooltip
              formatter={(value: number) => [`${value}次`, t('logStats.opCount')]}
              contentStyle={{ borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12 }}
            />
            <Area type="monotone" dataKey="value" stroke={ACCENT} fill="url(#colorValue)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ background: `${WARNING}20`, padding: 8, borderRadius: 8 }}>
            <Flame size={18} color={WARNING} />
          </div>
          <span style={{ fontSize: 12, color: GRAY }}>{t('logStats.peakHour')}</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: PRIMARY }}>{peakHour}</div>
        <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>
          <Users size={10} style={{ verticalAlign: 'middle' }} /> {t('logStats.mostActiveUser')}: {topUser}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// HipaaStatsCards
// ============================================================
function HipaaStatsCards({ stats }: { stats: HipaaStats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ background: `${PRIMARY}20`, padding: 8, borderRadius: 8 }}>
            <Activity size={18} color={PRIMARY} />
          </div>
          <span style={{ fontSize: 12, color: GRAY }}>{t('logStats.todayTotal')}</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: PRIMARY }}>{stats.todayTotal}</div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: `1px solid ${stats.abnormalCount > 0 ? DANGER : 'var(--border-color)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ background: `${DANGER}20`, padding: 8, borderRadius: 8 }}>
            <AlertTriangle size={18} color={DANGER} />
          </div>
          <span style={{ fontSize: 12, color: GRAY }}>{t('logStats.abnormalCount')}</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: stats.abnormalCount > 0 ? DANGER : SUCCESS }}>{stats.abnormalCount}</div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ background: `${SUCCESS}20`, padding: 8, borderRadius: 8 }}>
            <User size={18} color={SUCCESS} />
          </div>
          <span style={{ fontSize: 12, color: GRAY }}>{t('logStats.mostActiveUser')}</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: PRIMARY }}>{stats.mostActiveUser}</div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ background: `${WARNING}20`, padding: 8, borderRadius: 8 }}>
            <Shield size={18} color={WARNING} />
          </div>
          <span style={{ fontSize: 12, color: GRAY }}>{t('logStats.highestRisk')}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: WARNING }}>{stats.highestRiskOperation}</div>
      </div>
    </div>
  )
}

// ============================================================
// HipaaLogTable
// ============================================================
function HipaaLogTable({ logs, onViewDetail }: { logs: OperationLog[]; onViewDetail: (log: OperationLog) => void }) {
  const getComplianceBadge = (log: OperationLog) => {
    if (log.complianceLevel === 'critical') {
      return (
        <span style={{
          background: `${DANGER}20`,
          color: DANGER,
          padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <AlertTriangle size={12} /> {t('logStats.violation')}
        </span>
      )
    }
    if (log.complianceLevel === 'warning') {
      return (
        <span style={{
          background: `${WARNING}20`,
          color: WARNING,
          padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <AlertCircle size={12} /> {t('logStats.warning')}
        </span>
      )
    }
    return (
      <span style={{
        background: `${SUCCESS}20`,
        color: SUCCESS,
        padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        <CheckCircle size={12} /> {t('logStats.compliant')}
      </span>
    )
  }

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '140px 80px 100px 120px 100px 1fr 100px',
        padding: '12px 16px',
        background: PRIMARY,
        fontSize: 12, fontWeight: 600, color: WHITE,
      }}>
        <div>{t('logStats.colTime')}</div>
        <div>{t('logStats.colUser')}</div>
        <div>{t('logStats.colActionType')}</div>
        <div>{t('logStats.colTarget')}</div>
        <div>{t('logStats.colIp')}</div>
        <div>{t('logStats.colDetail')}</div>
        <div>{t('logStats.colCompliance')}</div>
      </div>

      {logs.map((log, index) => (
        <div
          key={log.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '140px 80px 100px 120px 100px 1fr 100px',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-light)',
            fontSize: 12,
            alignItems: 'center',
            background: index % 2 === 0 ? 'var(--bg-card)' : 'var(--content-bg)',
            borderLeft: log.complianceLevel === 'critical' ? `3px solid ${DANGER}` :
                       log.complianceLevel === 'warning' ? `3px solid ${WARNING}` : '3px solid transparent',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = index % 2 === 0 ? 'var(--bg-card)' : 'var(--content-bg)'}
        >
          <div style={{ color: PRIMARY, fontWeight: 500 }}>
            <div>{formatDate(log.timestamp)}</div>
            <div style={{ color: GRAY, fontSize: 12 }}>{formatTime(log.timestamp)}</div>
          </div>
          <div>
            <div style={{ color: PRIMARY, fontWeight: 500 }}>{log.userName}</div>
            {log.department && (
              <div style={{ fontSize: 12, color: GRAY }}>{log.department}</div>
            )}
          </div>
          <div>
            <span style={{
              background: `${ACTION_COLORS[log.action] || ACCENT}20`,
              color: ACTION_COLORS[log.action] || ACCENT,
              padding: '2px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              {ACTION_ICONS[log.action]}
              {log.action}
            </span>
          </div>
          <div style={{ color: '#475569' }}>
            {log.patientId && <div style={{ fontSize: 12 }}>{t('logStats.patient')}: {log.patientId}</div>}
            {log.reportId && <div style={{ fontSize: 12 }}>{t('logStats.report')}: {log.reportId}</div>}
            {!log.patientId && !log.reportId && (
              <div style={{ fontSize: 12, color: GRAY }}>{log.targetId}</div>
            )}
          </div>
          <div style={{ color: GRAY }}>{log.ipAddress}</div>
          <div style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.targetDesc}>
            {log.targetDesc}
          </div>
          <div>
            {getComplianceBadge(log)}
            {log.complianceAlerts && log.complianceAlerts.length > 0 && (
              <button
                onClick={() => onViewDetail(log)}
                style={{
                  marginTop: 4,
                  padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)', color: ACCENT, fontSize: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 2,
                }}
              >
                <Eye size={10} /> {t('logStats.detailBtn')}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// HipaaAlertSummary
// ============================================================
function HipaaAlertSummary({ logs }: { logs: OperationLog[] }) {
  const alertStats = useMemo(() => {
    const stats = { nonWorkHours: 0, crossDepartment: 0, batchExport: 0, highFrequency: 0 }
    logs.forEach(log => {
      if (log.complianceAlerts) {
        log.complianceAlerts.forEach(alert => {
          if (alert.type === 'non_work_hours') stats.nonWorkHours++
          if (alert.type === 'cross_department') stats.crossDepartment++
          if (alert.type === 'batch_export') stats.batchExport++
          if (alert.type === 'high_frequency') stats.highFrequency++
        })
      }
    })
    return stats
  }, [logs])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--color-error-border)', borderLeft: `4px solid ${DANGER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ background: `${DANGER}20`, padding: 8, borderRadius: 8 }}>
            <Clock size={18} color={DANGER} />
          </div>
          <span style={{ fontSize: 12, color: GRAY }}>{t('logStats.nonWorkHours')}</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: DANGER }}>{alertStats.nonWorkHours}</div>
        <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>22:00 - 06:00</div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--color-error-border)', borderLeft: `4px solid ${DANGER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ background: `${DANGER}20`, padding: 8, borderRadius: 8 }}>
            <Users size={18} color={DANGER} />
          </div>
          <span style={{ fontSize: 12, color: GRAY }}>{t('logStats.crossDepartment')}</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: DANGER }}>{alertStats.crossDepartment}</div>
        <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>{t('logStats.outOfScope')}</div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--color-warning-border)', borderLeft: `4px solid ${WARNING}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ background: `${WARNING}20`, padding: 8, borderRadius: 8 }}>
            <Download size={18} color={WARNING} />
          </div>
          <span style={{ fontSize: 12, color: GRAY }}>{t('logStats.batchExport')}</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: WARNING }}>{alertStats.batchExport}</div>
        <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>{t('logStats.overFrequency')}</div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--color-warning-border)', borderLeft: `4px solid ${WARNING}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ background: `${WARNING}20`, padding: 8, borderRadius: 8 }}>
            <Activity size={18} color={WARNING} />
          </div>
          <span style={{ fontSize: 12, color: GRAY }}>{t('logStats.highFrequency')}</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: WARNING }}>{alertStats.highFrequency}</div>
        <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>{t('logStats.samePatientMulti')}</div>
      </div>
    </div>
  )
}

// ============================================================
// HipaaExportPanel
// ============================================================
function HipaaExportPanel({
   onExportCSV, onExportPDF, onGenerateReport,
  dateFrom, setDateFrom, dateTo, setDateTo,
  actionFilter, setActionFilter, userFilter, setUserFilter, allUserNames,
}: {
  hipaaLogs: OperationLog[]
  onExportCSV: () => void
  onExportPDF: () => void
  onGenerateReport: () => void
  dateFrom: string
  setDateFrom: (v: string) => void
  dateTo: string
  setDateTo: (v: string) => void
  actionFilter: string
  setActionFilter: (v: string) => void
  userFilter: string
  setUserFilter: (v: string) => void
  allUserNames: string[]
}) {
  const inputStyle = {
    padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)',
    background: 'var(--bg-card)', color: PRIMARY, fontSize: 12, outline: 'none' as const,
  }
  const selectStyle = {
    padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)',
    background: 'var(--bg-card)', color: PRIMARY, fontSize: 12, cursor: 'pointer' as const, outline: 'none' as const,
  }

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)',
      marginBottom: 16, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
        <FileCheck size={18} color={PRIMARY} />
        <span style={{ fontSize: 16, fontWeight: 600, color: PRIMARY }}>{t('logStats.exportPanel')}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: GRAY, whiteSpace: 'nowrap' }}>{t('logStats.dateRange')}</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
        <span style={{ color: GRAY }}>-</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: GRAY, whiteSpace: 'nowrap' }}>{t('logStats.actionType')}</span>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={selectStyle}>
          {HIPAA_ACTION_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: GRAY, whiteSpace: 'nowrap' }}>{t('logStats.user')}</span>
        <select value={userFilter} onChange={e => setUserFilter(e.target.value)} style={selectStyle}>
          {allUserNames.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
        <button onClick={onExportCSV} style={{
          padding: '6px 14px', borderRadius: 6, border: `1px solid ${SUCCESS}`,
          background: `${SUCCESS}10`, color: SUCCESS,
          fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <FileSpreadsheet size={14} />{t('logStats.exportCsv')}
        </button>
        <button onClick={onExportPDF} style={{
          padding: '6px 14px', borderRadius: 6, border: `1px solid ${DANGER}`,
          background: `${DANGER}10`, color: DANGER,
          fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <FileText size={14} />{t('logStats.exportPdf')}
        </button>
        <button onClick={onGenerateReport} style={{
          padding: '6px 14px', borderRadius: 6, border: `1px solid ${PRIMARY}`,
          background: `${PRIMARY}10`, color: PRIMARY,
          fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Shield size={14} />{t('logStats.generateReport')}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// DurationAnalysisView
// ============================================================
function DurationAnalysisView({ logs }: { logs: OperationLog[] }) {
  const durationByAction = useMemo(() => {
    const stats: Record<string, { total: number; count: number; durations: number[] }> = {}
    logs.forEach(log => {
      if (log.duration !== undefined) {
        if (!stats[log.action]) {
          stats[log.action] = { total: 0, count: 0, durations: [] }
        }
        stats[log.action].total += log.duration
        stats[log.action].count++
        stats[log.action].durations.push(log.duration)
      }
    })
    return Object.entries(stats)
      .map(([action, data]) => ({
        action,
        avgDuration: Math.round(data.total / data.count),
        maxDuration: Math.max(...data.durations),
        minDuration: Math.min(...data.durations),
        count: data.count,
        color: ACTION_COLORS[action] || ACCENT,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
  }, [logs])

  const durationDistribution = useMemo(() => {
    const ranges = [
      { label: '<1分钟', min: 0, max: 60, color: '#10b981' },
      { label: '1-5分钟', min: 60, max: 300, color: '#3b82f6' },
      { label: '5-15分钟', min: 300, max: 900, color: '#f59e0b' },
      { label: '15-60分钟', min: 900, max: 3600, color: '#ef4444' },
      { label: '>1小时', min: 3600, max: Infinity, color: '#7c3aed' },
    ]
    return ranges.map(range => {
      const count = logs.filter(l => l.duration !== undefined && l.duration >= range.min && l.duration < range.max).length
      const percent = logs.length > 0 ? (count / logs.length * 100).toFixed(1) : '0'
      return { ...range, count, percent }
    })
  }, [logs])

  const durationTrend = useMemo(() => {
    const hourly: Record<number, { total: number; count: number }> = {}
    logs.forEach(log => {
      if (log.duration !== undefined) {
        const hour = new Date(log.timestamp).getHours()
        if (!hourly[hour]) hourly[hour] = { total: 0, count: 0 }
        hourly[hour].total += log.duration
        hourly[hour].count++
      }
    })
    return Array.from({ length: 24 }, (_, hour) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      avgDuration: hourly[hour] ? Math.round(hourly[hour].total / hourly[hour].count) : 0,
    }))
  }, [logs])

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
    return `${Math.floor(seconds / 3600)}时${Math.floor((seconds % 3600) / 60)}分`
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ fontWeight: 600, color: PRIMARY, marginBottom: 12, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Timer size={16} />{t('logStats.durationRanking')}
        </div>
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          {durationByAction.map((item, index) => (
            <div key={item.action} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
              borderBottom: index < durationByAction.length - 1 ? '1px solid var(--border-light)' : 'none',
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', background: `${item.color}20`,
                color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
              }}>
                {index + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: PRIMARY, fontWeight: 500 }}>{item.action}</div>
                <div style={{ fontSize: 12, color: GRAY }}>{t('logStats.totalOps', { count: item.count })}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: PRIMARY }}>{formatDuration(item.avgDuration)}</div>
                <div style={{ fontSize: 12, color: GRAY }}>{t('logStats.avgDuration')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ fontWeight: 600, color: PRIMARY, marginBottom: 12, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <PieChartIcon size={16} />{t('logStats.durationDistribution')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <ChartContainer height={180} state={durationDistribution.length > 0 ? 'ready' : 'empty'} emptyDescription={t('logStats.noData')}>
              <PieChart>
                <Pie data={durationDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="count" nameKey="label">
                  {durationDistribution.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value}次 (${durationDistribution.find(d => d.label === name)?.percent}%)`, name]}
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12 }}
                />
              </PieChart>
            </ChartContainer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
            {durationDistribution.map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
                <span style={{ fontSize: 12, color: GRAY, flex: 1 }}>{item.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>{item.count}{t('logStats.timesUnit')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)', gridColumn: 'span 2' }}>
        <div style={{ fontWeight: 600, color: PRIMARY, marginBottom: 12, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={16} />{t('logStats.durationTrend24h')}
        </div>
        <ChartContainer height={200} state={durationTrend.length > 0 ? 'ready' : 'empty'} emptyDescription={t('logStats.noData')}>
          <LineChart data={durationTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="hour" tick={{ fontSize: 12 }} interval={2} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(v / 60)}分`} />
            <Tooltip
              formatter={(value: number) => [formatDuration(value), t('logStats.avgDuration')]}
              contentStyle={{ borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12 }}
            />
            <Line type="monotone" dataKey="avgDuration" stroke={PRIMARY} strokeWidth={2} dot={{ fill: PRIMARY, r: 3 }} />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  )
}

// ============================================================
// UserActivityHeatmap
// ============================================================
function UserActivityHeatmap({  }: { logs: OperationLog[] }) {
  const heatmapData = useMemo(() => {
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    const data: { day: string; hour: number; value: number }[] = []
    days.forEach((day, dayIndex) => {
      for (let hour = 0; hour < 24; hour++) {
        let value = Math.floor(Math.random() * 20)
        if (hour >= 8 && hour <= 17 && dayIndex < 5) {
          value = Math.floor(Math.random() * 40) + 20
        } else if (hour >= 9 && hour <= 11 && dayIndex < 5) {
          value = Math.floor(Math.random() * 50) + 40
        }
        data.push({ day, hour, value })
      }
    })
    return data
  }, [])

  const getHeatColor = (value: number) => {
    if (value < 10) return '#f0f9ff'
    if (value < 20) return '#bae6fd'
    if (value < 30) return '#38bdf8'
    if (value < 40) return '#0ea5e9'
    if (value < 50) return '#0284c7'
    return '#0369a1'
  }

  return (
    <div>
      <div style={{ overflow: 'auto' }}>
        <div style={{ display: 'flex', marginLeft: 50, marginBottom: 4 }}>
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} style={{ width: 20, fontSize: 12, color: GRAY, textAlign: 'center' }}>
              {i % 4 === 0 ? `${i}` : ''}
            </div>
          ))}
        </div>
        {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day, _dayIndex) => (
          <div key={day} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
            <div style={{ width: 45, fontSize: 12, color: GRAY }}>{day}</div>
            <div style={{ display: 'flex', gap: 1 }}>
              {heatmapData.filter(d => d.day === day).map((item) => (
                <div
                  key={item.hour}
                  style={{ width: 18, height: 14, background: getHeatColor(item.value), borderRadius: 2 }}
                  title={`${day} ${item.hour}:00 - ${item.value}次操作`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: GRAY }}>{t('logStats.low')}</span>
        {[5, 15, 25, 35, 45, 55].map((val) => (
          <div key={val} style={{ width: 14, height: 14, background: getHeatColor(val), borderRadius: 2 }} />
        ))}
        <span style={{ fontSize: 12, color: GRAY }}>{t('logStats.high')}</span>
      </div>
    </div>
  )
}

// ============================================================
// StatisticsCharts
// ============================================================
function StatisticsCharts({ logs }: { logs: OperationLog[] }) {
  const actionStats = useMemo(() => {
    const counts: Record<string, number> = {}
    logs.forEach(log => { counts[log.action] = (counts[log.action] || 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value, color: ACTION_COLORS[name] || ACCENT }))
  }, [logs])

  const userStats = useMemo(() => {
    const counts: Record<string, number> = {}
    logs.forEach(log => { counts[log.userName] = (counts[log.userName] || 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [logs])

  const hourStats = useMemo(() => {
    const counts: number[] = new Array(24).fill(0)
    logs.forEach(log => { counts[new Date(log.timestamp).getHours()]++ })
    return counts.map((value, hour) => ({ hour: `${String(hour).padStart(2, '0')}:00`, value }))
  }, [logs])

  const heatmapData = useMemo(() => {
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    const data: { day: string; hour: number; value: number }[] = []
    days.forEach((day, dayIndex) => {
      for (let hour = 0; hour < 24; hour++) {
        let value = Math.floor(Math.random() * 20)
        if (hour >= 8 && hour <= 17 && dayIndex < 5) value = Math.floor(Math.random() * 40) + 20
        else if (hour >= 9 && hour <= 11 && dayIndex < 5) value = Math.floor(Math.random() * 50) + 40
        data.push({ day, hour, value })
      }
    })
    return data
  }, [])

  const getHeatColor = (value: number) => {
    if (value < 10) return '#f0f9ff'
    if (value < 20) return '#bae6fd'
    if (value < 30) return '#38bdf8'
    if (value < 40) return '#0ea5e9'
    if (value < 50) return '#0284c7'
    return '#0369a1'
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ fontWeight: 600, color: PRIMARY, marginBottom: 12, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <PieChartIcon size={16} />{t('logStats.actionDistribution')}
        </div>
        <ChartContainer height={220} state={actionStats.length > 0 ? 'ready' : 'empty'} emptyDescription={t('logStats.noData')}>
          <PieChart>
            <Pie data={actionStats} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value"
              label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
            >
              {actionStats.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
            </Pie>
            <Tooltip formatter={(value: number) => [`${value}次`, t('logStats.opCount')]} contentStyle={{ borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12 }} />
          </PieChart>
        </ChartContainer>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ fontWeight: 600, color: PRIMARY, marginBottom: 12, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart3 size={16} />{t('logStats.userTop10')}
        </div>
        <ChartContainer height={220} state={userStats.length > 0 ? 'ready' : 'empty'} emptyDescription={t('logStats.noData')}>
          <BarChart data={userStats} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
            <Tooltip formatter={(value: number) => [`${value}次`, t('logStats.opCount')]} contentStyle={{ borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12 }} />
            <Bar dataKey="value" fill={ACCENT} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ fontWeight: 600, color: PRIMARY, marginBottom: 12, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={16} />{t('logStats.opTrend24h')}
        </div>
        <ChartContainer height={180} state={hourStats.length > 0 ? 'ready' : 'empty'} emptyDescription={t('logStats.noData')}>
          <BarChart data={hourStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="hour" tick={{ fontSize: 12 }} interval={2} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number) => [`${value}次`, t('logStats.opCount')]} contentStyle={{ borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12 }} />
            <Bar dataKey="value" fill={PRIMARY_LIGHT} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ fontWeight: 600, color: PRIMARY, marginBottom: 12, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={16} />{t('logStats.peakHeatmap')}
        </div>
        <div style={{ overflow: 'auto' }}>
          <div style={{ display: 'flex', marginLeft: 50, marginBottom: 4 }}>
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} style={{ width: 20, fontSize: 12, color: GRAY, textAlign: 'center' }}>{i % 4 === 0 ? `${i}` : ''}</div>
            ))}
          </div>
          {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day) => (
            <div key={day} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
              <div style={{ width: 45, fontSize: 12, color: GRAY }}>{day}</div>
              <div style={{ display: 'flex', gap: 1 }}>
                {heatmapData.filter(d => d.day === day).map((item) => (
                  <div key={item.hour} style={{ width: 18, height: 14, background: getHeatColor(item.value), borderRadius: 2 }}
                    title={`${day} ${item.hour}:00 - ${item.value}次操作`} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: GRAY }}>{t('logStats.low')}</span>
          {[5, 15, 25, 35, 45, 55].map((val) => (
            <div key={val} style={{ width: 14, height: 14, background: getHeatColor(val), borderRadius: 2 }} />
          ))}
          <span style={{ fontSize: 12, color: GRAY }}>{t('logStats.high')}</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Exports
// ============================================================
export { TodayTrendCard, HipaaStatsCards, HipaaLogTable, HipaaAlertSummary, HipaaExportPanel, DurationAnalysisView, UserActivityHeatmap, StatisticsCharts }
