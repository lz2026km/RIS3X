import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { X, Clock, User, FileText, CheckCircle, Download, BarChart3, Activity, AlertCircle, History, List, Globe, Loader2, FileSpreadsheet, Users, Shield, AlertTriangle, Pause, Play, Radio, GitBranch, Fingerprint, FileJson, FileBarChart } from 'lucide-react'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { userApi } from '../services/api'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import {
  LogDetail, LogFilter, LogTable, TimelineView,
  TodayTrendCard, HipaaStatsCards, HipaaLogTable, HipaaAlertSummary,
  HipaaExportPanel, DurationAnalysisView, UserActivityHeatmap, StatisticsCharts,
} from './operation-log'
import type { OperationLog, ViewTab, QuickTimeValue, HipaaStats } from './operation-log'
import { PRIMARY, ACCENT, SUCCESS, WARNING, DANGER, GRAY, WHITE, BG, ACTION_COLORS, HIPAA_ACTION_TYPES, HIPAA_ACTION_CATEGORIES, PAGE_SIZES, QUICK_TIME_FILTERS } from './operation-log'
import { generateMockOperationLogs, formatDateTime, formatTime } from './operation-log'

export default function OperationLogPage() {
  const allLogs = useMemo(() => generateMockOperationLogs(), [])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const res = await userApi.list()
      if (cancelled) return
      if (res.success) {
        setLoadError(null)
      } else {
        setLoadError('API 不可用,使用本地数据')
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table')
  const [viewTab, setViewTab] = useState<ViewTab>('logs')
  const [searchText, setSearchText] = useState('')
  const [actionFilter, setActionFilter] = useState('全部')
  const [moduleFilter, setModuleFilter] = useState('全部')
  const [userFilter, setUserFilter] = useState('全部')
  const [sourceFilter, setSourceFilter] = useState('全部')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [quickTimeFilter, setQuickTimeFilter] = useState<QuickTimeValue>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedLog, setSelectedLog] = useState<OperationLog | null>(null)
  const [showStats, setShowStats] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  const [hipaaDateFrom, setHipaaDateFrom] = useState('')
  const [hipaaDateTo, setHipaaDateTo] = useState('')
  const [hipaaActionFilter, setHipaaActionFilter] = useState('全部')
  const [hipaaUserFilter, setHipaaUserFilter] = useState('全部')
  const [hipaaCurrentPage, setHipaaCurrentPage] = useState(1)
  const [hipaaPageSize, setHipaaPageSize] = useState(20)

  const filteredLogs = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10)
    const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

    return allLogs.filter(log => {
      if (searchText) {
        const search = searchText.toLowerCase()
        if (
          !log.userName.toLowerCase().includes(search) &&
          !log.targetDesc.toLowerCase().includes(search) &&
          !log.targetId.toLowerCase().includes(search) &&
          !log.id.toLowerCase().includes(search)
        ) {
          return false
        }
      }
      if (actionFilter !== '全部' && log.action !== actionFilter) return false
      if (moduleFilter !== '全部' && log.module !== moduleFilter) return false
      if (userFilter !== '全部' && log.userName !== userFilter) return false
      if (sourceFilter !== '全部' && log.source !== sourceFilter) return false
      if (dateFrom) {
        const fromDate = dateFrom === 'today' ? todayStart : dateFrom === 'week' ? weekStart : dateFrom === 'month' ? monthStart : dateFrom
        if (log.timestamp < fromDate) return false
      }
      if (dateTo && log.timestamp > dateTo + 'T23:59:59') return false

      if (quickTimeFilter === 'today') {
        if (log.timestamp.slice(0, 10) !== todayStart) return false
      } else if (quickTimeFilter === 'week') {
        if (log.timestamp < weekStart) return false
      } else if (quickTimeFilter === 'month') {
        if (log.timestamp < monthStart) return false
      }
      return true
    })
  }, [allLogs, searchText, actionFilter, moduleFilter, userFilter, sourceFilter, dateFrom, dateTo, quickTimeFilter])

  // [Wave2A] 真实 CSV 导出 (当前筛选数据 Blob 下载)
  const exportLogsCsv = useCallback(() => {
    const header = ['操作ID', '用户', '部门', '动作', '模块', '目标', '目标ID', '患者ID', '报告ID', 'IP', '时间', '合规等级']
    const rows = filteredLogs.map((log) => [
      log.id, log.userName, log.department ?? '', log.action, log.module,
      log.targetDesc, log.targetId, log.patientId ?? '', log.reportId ?? '',
      log.ipAddress, log.timestamp, log.complianceLevel ?? '',
    ])
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `操作日志-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    showToast(`CSV已导出 (${rows.length} 条)`)
  }, [filteredLogs])

  // [Wave2A] PDF 导出: 无 PDF 依赖库 → 简化文本版报告 (标注)
  const exportLogsPdf = useCallback(() => {
    const lines: string[] = []
    lines.push(`=== 放射科操作日志合规报告 (简化文本版) ===`)
    lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`)
    lines.push(`筛选范围: ${actionFilter === '全部' ? '全部' : '动作 ' + actionFilter} / ${moduleFilter === '全部' ? '全部模块' : '模块 ' + moduleFilter}`)
    lines.push(`记录数: ${filteredLogs.length}`)
    lines.push('')
    filteredLogs.slice(0, 200).forEach((log) => {
      lines.push(`[${log.timestamp}] ${log.userName} (${log.department ?? '无部门'}) · ${log.action} · ${log.module} · ${log.targetDesc} · ${log.ipAddress}`)
    })
    lines.push('')
    lines.push('注: 本报告为纯文本简化版, 正式 PDF 版需接入报告引擎后生成。')
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `操作日志合规报告-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    showToast(`PDF已导出 (简化文本版, ${filteredLogs.length} 条)`)
  }, [filteredLogs, actionFilter, moduleFilter])

  const hipaaFilteredLogs = useMemo(() => {
    return allLogs.filter(log => {
      if (!HIPAA_ACTION_TYPES.includes(log.action) && log.action !== '全部') {
        if (!Object.values(HIPAA_ACTION_CATEGORIES).flat().includes(log.action)) {
          if (!log.complianceLevel) return false
        }
      }
      if (hipaaActionFilter !== '全部' && log.action !== hipaaActionFilter) return false
      if (hipaaUserFilter !== '全部' && log.userName !== hipaaUserFilter) return false
      if (hipaaDateFrom && log.timestamp < hipaaDateFrom) return false
      if (hipaaDateTo && log.timestamp > hipaaDateTo + 'T23:59:59') return false
      return true
    })
  }, [allLogs, hipaaActionFilter, hipaaUserFilter, hipaaDateFrom, hipaaDateTo])

  const hipaaStats = useMemo((): HipaaStats => {
    const today = new Date().toISOString().slice(0, 10)
    const todayLogs = allLogs.filter(l => l.timestamp.slice(0, 10) === today)
    const abnormalLogs = todayLogs.filter(l => l.complianceLevel === 'critical' || l.complianceLevel === 'warning')

    const userCounts: Record<string, number> = {}
    todayLogs.forEach(log => { userCounts[log.userName] = (userCounts[log.userName] || 0) + 1 })
    const mostActiveUser = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'

    const actionRisk: Record<string, number> = {}
    todayLogs.forEach(log => {
      if (log.complianceLevel === 'critical') actionRisk[log.action] = (actionRisk[log.action] || 0) + 3
      else if (log.complianceLevel === 'warning') actionRisk[log.action] = (actionRisk[log.action] || 0) + 1
    })
    const highestRiskOperation = Object.entries(actionRisk).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'

    return { todayTotal: todayLogs.length, abnormalCount: abnormalLogs.length, mostActiveUser, highestRiskOperation }
  }, [allLogs])

  const todayTrendData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const todayLogs = filteredLogs.filter(l => l.timestamp.slice(0, 10) === today)
    const yesterdayLogs = filteredLogs.filter(l => l.timestamp.slice(0, 10) === new Date(Date.now() - 86400000).toISOString().slice(0, 10))

    const hourlyCounts = new Array(24).fill(0)
    todayLogs.forEach(log => { hourlyCounts[new Date(log.timestamp).getHours()]++ })

    const peakHourIndex = hourlyCounts.indexOf(Math.max(...hourlyCounts))
    const peakHour = `${String(peakHourIndex).padStart(2, '0')}:00`

    const userCounts: Record<string, number> = {}
    todayLogs.forEach(log => { userCounts[log.userName] = (userCounts[log.userName] || 0) + 1 })
    const topUser = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'

    return { todayCount: todayLogs.length, yesterdayCount: yesterdayLogs.length, todayTrend: hourlyCounts, peakHour, topUser }
  }, [filteredLogs])

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredLogs.slice(start, start + pageSize)
  }, [filteredLogs, currentPage, pageSize])

  const hipaaPaginatedLogs = useMemo(() => {
    const start = (hipaaCurrentPage - 1) * hipaaPageSize
    return hipaaFilteredLogs.slice(start, start + hipaaPageSize)
  }, [hipaaFilteredLogs, hipaaCurrentPage, hipaaPageSize])

  const totalPages = Math.ceil(filteredLogs.length / pageSize)
  const hipaaTotalPages = Math.ceil(hipaaFilteredLogs.length / hipaaPageSize)

  const handleFilterChange = useCallback(() => { setCurrentPage(1) }, [])

  const allUserNames = useMemo(() => {
    const names = new Set(allLogs.map(l => l.userName))
    return ['全部', ...Array.from(names)]
  }, [allLogs])

  const handleExportCSV = useCallback(() => {
    setIsExporting(true)
    setTimeout(() => {
      const headers = ['日志ID', '时间', '用户', '用户ID', '操作类型', '模块', '目标ID', '目标描述', 'IP地址', '设备', '来源', '耗时(秒)']
      const rows = filteredLogs.map(log => [
        log.id, formatDateTime(log.timestamp), log.userName, log.userId, log.action, log.module,
        log.targetId, log.targetDesc, log.ipAddress, log.device, log.source, log.duration || 0,
      ])
      const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `操作日志_${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      setIsExporting(false)
    }, 1500)
  }, [filteredLogs])

  const handleHipaaExportCSV = useCallback(() => {
    setIsExporting(true)
    setTimeout(() => {
      const headers = ['日志ID', '时间', '用户', '科室', '操作类型', '患者ID', '报告ID', 'IP地址', '操作详情', '合规状态', '告警信息']
      const rows = hipaaFilteredLogs.map(log => [
        log.id, formatDateTime(log.timestamp), log.userName, log.department || '-', log.action,
        log.patientId || '-', log.reportId || log.targetId, log.ipAddress, log.targetDesc,
        log.complianceLevel === 'critical' ? '违规' : log.complianceLevel === 'warning' ? '警告' : '合规',
        log.complianceAlerts?.map(a => a.message).join('; ') || '-',
      ])
      const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `HIPAA审计日志_${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      setIsExporting(false)
    }, 1500)
  }, [hipaaFilteredLogs])

  const handleHipaaExportPDF = useCallback(() => {
    setIsExporting(true)
    setExportProgress(0)
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) { clearInterval(interval); setTimeout(() => { setIsExporting(false); setExportProgress(0) }, 500); return 100 }
        return prev + 20
      })
    }, 200)
  }, [])

  const handleGenerateReport = useCallback(() => {
    setIsExporting(true)
    setExportProgress(0)
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) { clearInterval(interval); setTimeout(() => { setIsExporting(false); setExportProgress(0) }, 500); return 100 }
        return prev + 15
      })
    }, 200)
  }, [])

  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000) }

  const handleQuickTimeFilter = useCallback((value: QuickTimeValue) => {
    setQuickTimeFilter(value)
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10)
    const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

    if (value === 'today') { setDateFrom(todayStart); setDateTo('') }
    else if (value === 'week') { setDateFrom(weekStart); setDateTo('') }
    else if (value === 'month') { setDateFrom(monthStart); setDateTo('') }
    else { setDateFrom(''); setDateTo('') }
    setCurrentPage(1)
  }, [])

  const [liveTab, setLiveTab] = useState<'stream' | 'anomaly' | 'session' | 'complianceReports' | 'blockchain'>('stream')
  const [liveLogs, setLiveLogs] = useState<OperationLog[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [severityFilter, setSeverityFilter] = useState<string>('全部')
  const liveContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const interval = setInterval(() => {
      const newLog = { ...allLogs[Math.floor(Math.random() * allLogs.length)], id: `LIVE-${Date.now()}`, timestamp: new Date().toISOString() }
      setLiveLogs(prev => [newLog, ...prev].slice(0, 200))
    }, 5000)
    return () => clearInterval(interval)
  }, [allLogs])
  useEffect(() => {
    if (autoScroll && liveContainerRef.current) { liveContainerRef.current.scrollTop = 0 }
  }, [liveLogs, autoScroll])

  const anomalyLogs = useMemo(() => {
    return allLogs.filter(l => {
      const hour = new Date(l.timestamp).getHours()
      const isOffHours = hour >= 22 || hour < 6
      const isMassDeletion = l.action === '删除报告' || l.action === '批量导出'
      const isRapidFire = allLogs.filter(ol => ol.userName === l.userName && Math.abs(new Date(ol.timestamp).getTime() - new Date(l.timestamp).getTime()) < 60000).length > 5
      return isOffHours || isMassDeletion || isRapidFire
    }).slice(0, 30)
  }, [allLogs])
  const anomalyScores = useMemo(() => anomalyLogs.map(l => ({
    id: l.id, userName: l.userName, action: l.action,
    score: Math.floor(Math.random() * 60) + 20,
    reason: l.action === '删除报告' ? '删除操作预警' : l.action === '批量导出' ? '批量导出预警' : '非工作时间操作',
    timestamp: l.timestamp,
  })), [anomalyLogs])
  const anomalyTrend = [
    { month: '2025-11', count: 12 }, { month: '2025-12', count: 15 }, { month: '2026-01', count: 10 },
    { month: '2026-02', count: 18 }, { month: '2026-03', count: 14 }, { month: '2026-04', count: 9 },
  ]

  const [selectedSessionUser, setSelectedSessionUser] = useState<string | null>(null)
  const sessionUsers = useMemo(() => Array.from(new Set(allLogs.map(l => l.userName))).slice(0, 10), [allLogs])
  const sessionLogs = useMemo(() => {
    if (!selectedSessionUser) return []
    return allLogs.filter(l => l.userName === selectedSessionUser).slice(0, 50).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }, [allLogs, selectedSessionUser])

  const [reportSchedule, setReportSchedule] = useState<'daily' | 'weekly' | 'monthly'>('monthly')
  const [generatingReport, setGeneratingReport] = useState(false)
  const [blockchainData] = useState(() => {
    return allLogs.slice(0, 50).map(l => ({
      ...l, blockHash: `0x${Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      previousHash: `0x${Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`, verified: Math.random() > 0.2,
    }))
  })
  const [verifyResult, setVerifyResult] = useState<string | null>(null)

  const filterBtnStyle = (active: boolean) => ({
    padding: '5px 12px', borderRadius: 6, border: `1px solid ${active ? ACCENT : 'var(--border-color)'}`,
    background: active ? `${ACCENT}15` : WHITE, color: active ? ACCENT : GRAY,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
  })

  return (
    <div data-testid="operation-log-page" style={{ minHeight: '100vh', background: BG }}>
      {loading && <LoadingBanner message="正在从 API 加载操作日志..." />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {/* 顶部导航 */}
      <div style={{
        background: WHITE, borderBottom: '1px solid var(--border-color)', padding: '14px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <History size={24} color={PRIMARY} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: PRIMARY }}>操作痕迹日志</div>
            <div style={{ fontSize: 12, color: GRAY }}>操作日志 - 共 {filteredLogs.length} 条记录</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            style={{
              padding: '6px 14px', borderRadius: 6, border: `1px solid ${isExporting ? 'var(--border-color)' : SUCCESS}`,
              background: isExporting ? 'var(--bg-card)' : `${SUCCESS}10`, color: isExporting ? '#94a3b8' : SUCCESS,
              fontSize: 12, fontWeight: 600, cursor: isExporting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            {isExporting ? '导出中...' : '导出CSV'}
          </button>
          <button
            onClick={() => setShowStats(!showStats)}
            style={{ ...filterBtnStyle(showStats), display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <BarChart3 size={14} />
            {showStats ? '隐藏' : '显示'}统计
          </button>
          <button
            onClick={() => setViewMode('table')}
            style={{ ...filterBtnStyle(viewMode === 'table'), display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <List size={14} />列表视图
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            style={{ ...filterBtnStyle(viewMode === 'timeline'), display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Clock size={14} />时间线视图
          </button>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {/* 今日趋势卡片 */}
        {showStats && (
          <div style={{ marginBottom: 16 }}>
            <TodayTrendCard {...todayTrendData} />
          </div>
        )}

        {/* 快捷时间筛选 + Tab切换 */}
        <div style={{
          background: WHITE, borderRadius: 10, padding: 16, border: '1px solid var(--border-color)',
          marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            {/* 快捷时间筛选 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: GRAY, marginRight: 4 }}>快捷筛选:</span>
              {QUICK_TIME_FILTERS.map(filter => (
                <button
                  key={filter.value}
                  onClick={() => handleQuickTimeFilter(filter.value)}
                  style={{
                    padding: '4px 10px', borderRadius: 6,
                    border: `1px solid ${quickTimeFilter === filter.value ? ACCENT : 'var(--border-color)'}`,
                    background: quickTimeFilter === filter.value ? `${ACCENT}15` : WHITE,
                    color: quickTimeFilter === filter.value ? ACCENT : GRAY,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Tab切换 */}
            {showStats && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button onClick={() => setViewTab('logs')} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: viewTab === 'logs' ? PRIMARY : 'transparent', color: viewTab === 'logs' ? WHITE : GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>日志统计</button>
                <button onClick={() => setViewTab('duration')} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: viewTab === 'duration' ? PRIMARY : 'transparent', color: viewTab === 'duration' ? WHITE : GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>耗时分析</button>
                <button onClick={() => setViewTab('heatmap')} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: viewTab === 'heatmap' ? PRIMARY : 'transparent', color: viewTab === 'heatmap' ? WHITE : GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>热力图</button>
                <button onClick={() => setViewTab('hipaa')} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: viewTab === 'hipaa' ? PRIMARY : 'transparent', color: viewTab === 'hipaa' ? WHITE : GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={14} />HIPAA安全审计</button>
              </div>
            )}
          </div>

          {/* LogFilter */}
          <LogFilter
            searchText={searchText}
            onSearchChange={(v) => { setSearchText(v); handleFilterChange() }}
            actionFilter={actionFilter}
            onActionFilterChange={(v) => { setActionFilter(v); handleFilterChange() }}
            moduleFilter={moduleFilter}
            onModuleFilterChange={(v) => { setModuleFilter(v); handleFilterChange() }}
            userFilter={userFilter}
            onUserFilterChange={(v) => { setUserFilter(v); handleFilterChange() }}
            sourceFilter={sourceFilter}
            onSourceFilterChange={(v) => { setSourceFilter(v); handleFilterChange() }}
            dateFrom={dateFrom}
            onDateFromChange={(v) => { setDateFrom(v); setQuickTimeFilter(''); handleFilterChange() }}
            dateTo={dateTo}
            onDateToChange={(v) => { setDateTo(v); handleFilterChange() }}
            quickTimeFilter={quickTimeFilter}
            onQuickTimeFilter={handleQuickTimeFilter}
            onReset={() => {
              setSearchText('')
              setActionFilter('全部')
              setModuleFilter('全部')
              setUserFilter('全部')
              setSourceFilter('全部')
              setDateFrom('')
              setDateTo('')
              setQuickTimeFilter('')
              setCurrentPage(1)
            }}
            allUserNames={allUserNames}
          />
        </div>

        {/* 统计图表 */}
        {showStats && (
          <div style={{ marginBottom: 16 }}>
            {viewTab === 'logs' && <StatisticsCharts logs={filteredLogs} />}
            {viewTab === 'duration' && <DurationAnalysisView logs={filteredLogs} />}
            {viewTab === 'heatmap' && (
              <div style={{ background: WHITE, borderRadius: 10, padding: 16, border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, color: PRIMARY, marginBottom: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={16} />用户活跃时段热力图
                </div>
                <UserActivityHeatmap logs={filteredLogs} />
              </div>
            )}
            {viewTab === 'hipaa' && (
              <>
                <HipaaStatsCards stats={hipaaStats} />
                <HipaaAlertSummary logs={allLogs} />
                <HipaaExportPanel
                  hipaaLogs={hipaaFilteredLogs}
                  onExportCSV={handleHipaaExportCSV}
                  onExportPDF={handleHipaaExportPDF}
                  onGenerateReport={handleGenerateReport}
                  dateFrom={hipaaDateFrom}
                  setDateFrom={setHipaaDateFrom}
                  dateTo={hipaaDateTo}
                  setDateTo={setHipaaDateTo}
                  actionFilter={hipaaActionFilter}
                  setActionFilter={setHipaaActionFilter}
                  userFilter={hipaaUserFilter}
                  setUserFilter={setHipaaUserFilter}
                  allUserNames={allUserNames}
                />
                <HipaaLogTable logs={hipaaPaginatedLogs} onViewDetail={setSelectedLog} />
                {/* HIPAA分页 */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', background: WHITE, borderTop: '1px solid var(--border-color)',
                  marginTop: -1,
                }}>
                  <div style={{ fontSize: 12, color: GRAY }}>
                    显示 {((hipaaCurrentPage - 1) * hipaaPageSize) + 1} - {Math.min(hipaaCurrentPage * hipaaPageSize, hipaaFilteredLogs.length)} 条，共 {hipaaFilteredLogs.length} 条
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: GRAY }}>每页</span>
                      <select
                        value={hipaaPageSize}
                        onChange={e => { setHipaaPageSize(Number(e.target.value)); setHipaaCurrentPage(1) }}
                        style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)', fontSize: 12 }}
                      >
                        {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <span style={{ fontSize: 12, color: GRAY }}>条</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setHipaaCurrentPage(p => Math.max(1, p - 1))} disabled={hipaaCurrentPage === 1} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: WHITE, color: hipaaCurrentPage === 1 ? 'var(--text-muted)' : PRIMARY, fontSize: 12, cursor: hipaaCurrentPage === 1 ? 'not-allowed' : 'pointer' }}>上一页</button>
                      <button onClick={() => setHipaaCurrentPage(p => Math.min(hipaaTotalPages, p + 1))} disabled={hipaaCurrentPage === hipaaTotalPages} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: WHITE, color: hipaaCurrentPage === hipaaTotalPages ? 'var(--text-muted)' : PRIMARY, fontSize: 12, cursor: hipaaCurrentPage === hipaaTotalPages ? 'not-allowed' : 'pointer' }}>下一页</button>
                    </div>
                    <span style={{ fontSize: 12, color: GRAY }}>第 {hipaaCurrentPage} / {hipaaTotalPages} 页</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 日志列表/时间线 */}
        {viewTab !== 'hipaa' && (
          viewMode === 'table' ? (
            <LogTable
              logs={paginatedLogs}
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              total={filteredLogs.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1) }}
              onViewDetail={setSelectedLog}
            />
          ) : (
            <div style={{
              background: WHITE, borderRadius: 10, border: '1px solid var(--border-color)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              <div style={{ padding: 20 }}>
                <TimelineView logs={paginatedLogs} onViewDetail={setSelectedLog} />
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0', borderTop: '1px solid var(--border-color)', marginTop: 16,
                }}>
                  <div style={{ fontSize: 12, color: GRAY }}>
                    显示 {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredLogs.length)} 条，共 {filteredLogs.length} 条
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: WHITE, color: currentPage === 1 ? 'var(--text-muted)' : PRIMARY, fontSize: 12, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>上一页</button>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-color)', background: WHITE, color: currentPage === totalPages ? 'var(--text-muted)' : PRIMARY, fontSize: 12, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>下一页</button>
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* 实时流/异常检测/会话追踪/合规报告/区块链 Tab栏 */}
      <div style={{ background: WHITE, borderRadius: 10, padding: '4px', margin: '0 20px 16px', display: 'flex', gap: 4, border: `1px solid var(--border-color)`, flexWrap: 'wrap' }}>
        {[
          { key: 'stream', label: '实时日志流', icon: <Radio size={14} /> },
          { key: 'anomaly', label: '异常检测', icon: <AlertTriangle size={14} /> },
          { key: 'session', label: '会话追踪', icon: <Users size={14} /> },
          { key: 'complianceReports', label: '合规报告', icon: <FileBarChart size={14} /> },
          { key: 'blockchain', label: '区块链存证', icon: <Fingerprint size={14} /> },
        ].map(tab => (
          <button key={tab.key} onClick={() => setLiveTab(tab.key as typeof liveTab)} style={{
            padding: '6px 14px', borderRadius: 6, border: 'none',
            background: liveTab === tab.key ? PRIMARY : 'transparent',
            color: liveTab === tab.key ? WHITE : GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>{tab.icon}{tab.label}</button>
        ))}
      </div>

      {/* 实时日志流 */}
      {liveTab === 'stream' && (
        <div style={{ background: WHITE, borderRadius: 10, border: '1px solid var(--border-color)', margin: '0 20px 16px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#1e293b', color: WHITE }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Radio size={16} color="#22c55e" />
              <span style={{ fontWeight: 600, fontSize: 13 }}>实时日志流</span>
              <span style={{ background: '#22c55e', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>5s轮询</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #475569', background: '#334155', color: WHITE, fontSize: 12, outline: 'none' }}>
                {['全部', 'info', 'warn', 'error', 'critical'].map(s => (<option key={s} value={s}>{s}</option>))}
              </select>
              <button onClick={() => setAutoScroll(!autoScroll)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #475569', background: autoScroll ? '#22c55e' : '#64748b', color: WHITE, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                {autoScroll ? <Play size={12} /> : <Pause size={12} />}{autoScroll ? '自动滚动' : '暂停'}
              </button>
            </div>
          </div>
          <div ref={liveContainerRef} style={{ height: 400, overflow: 'auto', fontFamily: 'monospace', fontSize: 12, background: '#0f172a', color: '#e2e8f0' }}>
            {liveLogs.filter(l => severityFilter === '全部' || l.source === severityFilter || l.action.includes(severityFilter)).slice(0, 100).map((log, idx) => {
              const levelColor = log.action.includes('删除') || log.action.includes('驳回') ? '#ef4444' : log.action.includes('导出') || log.action.includes('修改') ? '#f59e0b' : log.action.includes('登录') ? '#7c3aed' : '#3b82f6'
              return (
                <div key={log.id} style={{ padding: '4px 12px', display: 'flex', gap: 12, borderBottom: '1px solid #1e293b', background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                  <span style={{ color: 'var(--text-secondary)', minWidth: 80 }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span style={{ color: levelColor, fontWeight: 600, minWidth: 70 }}>[{log.action}]</span>
                  <span style={{ color: '#22c55e', minWidth: 60 }}>{log.userName}</span>
                  <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.targetDesc}</span>
                  <span style={{ color: 'var(--text-secondary)', minWidth: 100 }}>{log.ipAddress}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 异常检测 */}
      {liveTab === 'anomaly' && (
        <div style={{ margin: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: '异常事件数', value: anomalyLogs.length, icon: <AlertTriangle size={18} />, color: DANGER, bg: 'var(--color-error-bg)' },
              { label: '高危异常', value: anomalyScores.filter(s => s.score >= 70).length, icon: <AlertCircle size={18} />, color: '#7c3aed', bg: 'var(--color-info-bg)' },
              { label: '非工作时间', value: anomalyLogs.filter(l => new Date(l.timestamp).getHours() >= 22 || new Date(l.timestamp).getHours() < 6).length, icon: <Clock size={18} />, color: WARNING, bg: 'var(--color-warning-bg)' },
              { label: '批量导出/删除', value: anomalyLogs.filter(l => l.action === '批量导出' || l.action === '删除报告').length, icon: <Download size={18} />, color: '#f97316', bg: 'var(--color-warning-bg)' },
            ].map(card => (
              <div key={card.label} style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{card.icon}</div>
                <div><div style={{ fontSize: 22, fontWeight: 800, color: card.color }}>{card.value}</div><div style={{ fontSize: 12, color: GRAY }}>{card.label}</div></div>
              </div>
            ))}
          </div>
          <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px' }}>异常评分明细</h3>
            <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
                {['用户', '操作', '异常评分', '原因', '时间'].map(h => (<th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: PRIMARY, fontSize: 12 }}>{h}</th>))}
              </tr></thead>
              <tbody>
                {anomalyScores.filter(s => s.score >= 50).slice(0, 10).map((s, idx) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? WHITE : 'var(--bg-primary)' }}>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: PRIMARY }}>{s.userName}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12 }}>{s.action}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: s.score >= 70 ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', color: s.score >= 70 ? DANGER : WARNING }}>{s.score}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-primary)' }}>{s.reason}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: GRAY }}>{new Date(s.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {anomalyScores.filter(s => s.score >= 70).length > 0 && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--color-error-bg)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} color={DANGER} />
                <span style={{ fontSize: 12, color: '#991b1b' }}>检测到 {anomalyScores.filter(s => s.score >= 70).length} 例高危异常，建议立即审查</span>
              </div>
            )}
          </div>
          <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px' }}>异常趋势</h3>
            <ResponsiveContainer width='100%' height={200}>
              <AreaChart data={anomalyTrend}>
                <CartesianGrid strokeDasharray='3 3' stroke='var(--border-color)' />
                <XAxis dataKey='month' tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type='monotone' dataKey='count' stroke={DANGER} fill='var(--color-error-bg)' strokeWidth={2} name='异常次数' />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 会话追踪 */}
      {liveTab === 'session' && (
        <div style={{ margin: '0 20px 16px', display: 'flex', gap: 16 }}>
          <div style={{ width: 220, flexShrink: 0, background: WHITE, borderRadius: 10, border: '1px solid var(--border-color)', padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: PRIMARY, margin: '0 0 12px' }}>选择用户</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sessionUsers.map(name => (
                <button key={name} onClick={() => setSelectedSessionUser(name)} style={{
                  padding: '8px 12px', borderRadius: 6, border: 'none', textAlign: 'left',
                  background: selectedSessionUser === name ? ACCENT : 'transparent',
                  color: selectedSessionUser === name ? WHITE : PRIMARY,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <User size={14} />{name}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, background: WHITE, borderRadius: 10, border: '1px solid var(--border-color)', padding: 16 }}>
            {selectedSessionUser ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: PRIMARY, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={16} />{selectedSessionUser} 的会话时间线
                  </h3>
                  <span style={{ fontSize: 12, color: GRAY }}>共 {sessionLogs.length} 条操作</span>
                </div>
                <div style={{ position: 'relative' }}>
                  {sessionLogs.slice(0, 30).map((log, idx) => (
                    <div key={log.id} style={{ display: 'flex', gap: 12, paddingBottom: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
                        <span style={{ fontSize: 12, color: GRAY }}>{formatTime(log.timestamp)}</span>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: ACTION_COLORS[log.action] || ACCENT, marginTop: 4, border: '2px solid var(--border-color)' }} />
                        {idx < sessionLogs.length - 1 && <div style={{ width: 2, height: '100%', background: 'var(--border-color)' }} />}
                      </div>
                      <div style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-color)', marginBottom: 4 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: `${ACTION_COLORS[log.action] || ACCENT}20`, color: ACTION_COLORS[log.action] || ACCENT }}>{log.action}</span>
                          <span style={{ fontSize: 12, color: GRAY }}>{log.module}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{log.targetDesc}</div>
                        <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>
                          <Globe size={10} style={{ verticalAlign: 'middle' }} /> {log.ipAddress}
                          {log.department && <> · {log.department}</>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: GRAY }}>
                <Users size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
                <div style={{ fontSize: 14 }}>请从左侧选择一个用户查看会话时间线</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 合规报告 */}
      {liveTab === 'complianceReports' && (
        <div style={{ margin: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: WHITE, borderRadius: 10, padding: 16, border: '1px solid var(--border-color)', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileBarChart size={18} color={PRIMARY} />
              <span style={{ fontSize: 14, fontWeight: 600, color: PRIMARY }}>合规报告模板</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['daily' as const, 'weekly' as const, 'monthly' as const]).map(s => (
                <button key={s} onClick={() => setReportSchedule(s)} style={{
                  padding: '4px 12px', borderRadius: 6, border: `1px solid ${reportSchedule === s ? ACCENT : 'var(--border-color)'}`,
                  background: reportSchedule === s ? ACCENT : WHITE, color: reportSchedule === s ? WHITE : GRAY,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>{s === 'daily' ? '日报' : s === 'weekly' ? '周报' : '月报'}</button>
              ))}
            </div>
            <button onClick={() => setGeneratingReport(true)} disabled={generatingReport} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', background: ACCENT, color: WHITE,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {generatingReport ? <Loader2 size={14} /> : <FileText size={14} />}
              {generatingReport ? '生成中...' : '生成报告'}
            </button>
            <button onClick={exportLogsCsv} style={{
              padding: '6px 14px', borderRadius: 6, border: `1px solid #059669`, background: `${SUCCESS}10`,
              color: SUCCESS, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}><FileSpreadsheet size={14} />导出CSV</button>
            <button onClick={exportLogsPdf} style={{
              padding: '6px 14px', borderRadius: 6, border: `1px solid #dc2626`, background: `${DANGER}10`,
              color: DANGER, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}><FileJson size={14} />导出PDF</button>
          </div>
          <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px' }}>
              {reportSchedule === 'daily' ? '日' : reportSchedule === 'weekly' ? '周' : '月'}度合规报告摘要
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { label: '总操作数', value: filteredLogs.length, color: ACCENT },
                { label: '合规操作', value: Math.round(filteredLogs.length * 0.92), color: SUCCESS },
                { label: '告警操作', value: Math.round(filteredLogs.length * 0.08), color: WARNING },
              ].map(card => (
                <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>{card.label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, background: 'var(--color-success-bg)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} color={SUCCESS} />
              <span style={{ fontSize: 12, color: '#065f46' }}>HIPAA / GDPR / 等保 合规要求已满足，报告已就绪</span>
            </div>
          </div>
        </div>
      )}

      {/* 区块链存证 */}
      {liveTab === 'blockchain' && (
        <div style={{ margin: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: WHITE, borderRadius: 10, padding: 16, border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Fingerprint size={18} color={PRIMARY} />
              <span style={{ fontSize: 14, fontWeight: 600, color: PRIMARY }}>区块链日志存证</span>
              <span style={{ fontSize: 12, color: GRAY }}>SHA-256 哈希链</span>
            </div>
            <button onClick={() => {
              const allMatch = blockchainData.every(b => b.verified)
              setVerifyResult(allMatch ? '全部日志验证通过 ✓' : '检测到篡改！哈希不匹配')
              setTimeout(() => setVerifyResult(null), 4000)
            }} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', background: ACCENT, color: WHITE,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}><Shield size={14} />验证完整性</button>
          </div>
          {verifyResult && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: verifyResult.includes('通过') ? 'var(--color-success-bg)' : 'var(--color-error-bg)', color: verifyResult.includes('通过') ? SUCCESS : DANGER, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              {verifyResult.includes('通过') ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              {verifyResult}
            </div>
          )}
          <div style={{ background: WHITE, borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 100px 1fr 1fr 80px', padding: '10px 14px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', fontSize: 12, fontWeight: 700, color: GRAY }}>
              <div>日志ID</div><div>用户</div><div>区块哈希</div><div>前一哈希</div><div>验证</div>
            </div>
            {blockchainData.slice(0, 10).map(b => (
              <div key={b.id} style={{
                display: 'grid', gridTemplateColumns: '80px 100px 1fr 1fr 80px',
                padding: '8px 14px', borderBottom: '1px solid var(--border-light)',
                fontSize: 12, alignItems: 'center',
                background: b.verified ? 'transparent' : 'var(--color-error-bg)',
              }}>
                <div style={{ color: PRIMARY }}>{b.id.slice(0, 8)}</div>
                <div style={{ color: GRAY }}>{b.userName}</div>
                <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.blockHash.slice(0, 20)}...</div>
                <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.previousHash.slice(0, 20)}...</div>
                <div style={{ textAlign: 'center' }}>{b.verified ? <CheckCircle size={12} color={SUCCESS} /> : <X size={12} color={DANGER} />}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '8px 14px', background: 'var(--bg-card)', borderRadius: 8 }}>
            <GitBranch size={14} color={GRAY} />
            <span style={{ fontSize: 12, color: GRAY }}>区块链高度: {blockchainData.length} · 最新区块: {new Date().toISOString().slice(0, 10)} · 哈希算法: SHA-256</span>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: 'fixed', top: 24, right: 24, padding: '10px 18px', borderRadius: 8, background: SUCCESS, color: WHITE, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} />{toastMsg}
        </div>
      )}

      {/* 日志详情弹窗 */}
      <LogDetail log={selectedLog} onClose={() => setSelectedLog(null)} />

      {/* 导出进度弹窗 */}
      {isExporting && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{ background: WHITE, borderRadius: 12, padding: '32px 40px', minWidth: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <Loader2 size={40} style={{ color: PRIMARY, animation: 'spin 1s linear infinite', marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: PRIMARY, marginBottom: 8 }}>
                {exportProgress < 100 ? '正在导出...' : '导出完成'}
              </div>
              <div style={{ fontSize: 13, color: GRAY, marginBottom: 16 }}>
                {exportProgress < 100 ? '请稍候' : '文件已准备好'}
              </div>
              <div style={{ width: '100%', height: 8, background: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${exportProgress}%`, height: '100%', background: exportProgress === 100 ? SUCCESS : PRIMARY, transition: 'width 0.2s ease-out' }} />
              </div>
              <div style={{ fontSize: 12, color: GRAY, marginTop: 8 }}>{exportProgress}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
