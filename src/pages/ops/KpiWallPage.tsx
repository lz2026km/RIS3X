/**
 * G005 RIS v3.0.6.11-88 Wave6A - 科室 KPI 墙屏 (大屏看板模式)
 * 全屏深色大字体卡片: 检查量 KPI / 工作量 Top10 / 设备占用率 / 危急值 / 及时率准确率
 * 数据源: statsApi / biApi / occupancyApi (复用现有 API, 不重新发明)
 * 自动轮播: 多页签 15s 切换; 数据失败回退空态 + 重试, 不崩溃
 * [v3.0.6.11-99 Wave 5B-A] 大屏模板库: 模板选择器(概览/设备/质控/财务/混合) +
 *   布局区块渲染(config.blocks) + 「保存当前布局为模板」(localStorage + 后端优先) + 数据源徽标
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Empty, Input, message, Select, Spin, Tag } from 'antd'
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Gauge, HeartPulse,
  Monitor, RefreshCw, Stethoscope, TrendingUp,
  Wallet, Save, LayoutTemplate, Database,
} from 'lucide-react'
import { statsApi, type DailyStatsDto, type WorkloadDto } from '../../services/api/statsApi'
import { biApi, type KpiDto, type WallTemplateDto, type WallLayout } from '../../services/api/biApi'
import { occupancyApi, type OccupancyRoom } from '../../services/api/occupancyApi'
import { t } from '../../i18n/appI18n'

const AUTO_ROTATE_MS = 15_000
const BG = '#0b1220'
const CARD_BG = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(148,163,184,0.18)'
const WALL_LOCAL_KEY = 'g005-kpi-wall-templates'

type WallBlock = 'kpi' | 'top10' | 'critical' | 'occupancy' | 'oee' | 'quality' | 'sla' | 'revenue' | 'bonus'

const BLOCK_LABELS: Record<WallBlock, string> = {
  kpi: t('kpiWall.blockKpi'), top10: t('kpiWall.blockTop10'), critical: t('kpiWall.blockCritical'), occupancy: t('kpiWall.blockOccupancy'),
  oee: t('kpiWall.blockOee'), quality: t('kpiWall.blockQuality'), sla: t('kpiWall.blockSla'), revenue: t('kpiWall.blockRevenue'), bonus: t('kpiWall.blockBonus'),
}

const LAYOUT_OPTIONS: Array<{ value: WallLayout; label: string }> = [
  { value: 'overview', label: t('kpiWall.layoutOverview') },
  { value: 'equipment', label: t('kpiWall.layoutEquipment') },
  { value: 'quality', label: t('kpiWall.layoutQuality') },
  { value: 'finance', label: t('kpiWall.layoutFinance') },
  { value: 'mixed', label: t('kpiWall.layoutMixed') },
]

function pct(v: number | undefined, digits = 1): string {
  return v == null ? '--' : `${Number(v).toFixed(digits)}%`
}

interface KpiWallData {
  daily: DailyStatsDto | null
  weeklyTotal: number | null
  workload: WorkloadDto[]
  kpi: KpiDto | null
  rooms: OccupancyRoom[]
  oeeAvg: number | null
  sla: { complianceRate: number | null; total: number | null }
  performance: { totalBonus: number | null; totalRvu: number | null; rows: Array<{ doctorName: string; bonus: number; rvu: number; qualityScore: number }> }
  dataSource: 'api' | 'demo'
  hasError: boolean
}

const EMPTY: KpiWallData = {
  daily: null, weeklyTotal: null, workload: [], kpi: null, rooms: [], oeeAvg: null,
  sla: { complianceRate: null, total: null },
  performance: { totalBonus: null, totalRvu: null, rows: [] },
  dataSource: 'api', hasError: false,
}

const statusLabel: Record<string, { text: string; color: string }> = {
  idle: { text: t('kpiWall.roomIdle'), color: 'var(--color-success-400, #4ade80)' },
  occupied: { text: t('kpiWall.roomOccupied'), color: 'var(--color-error-400, #f87171)' },
  disinfecting: { text: t('kpiWall.roomDisinfecting'), color: 'var(--color-warning-400, #fbbf24)' },
  fault: { text: t('kpiWall.roomFault'), color: 'var(--text-muted, #94a3b8)' },
}

const KpiWallPage: React.FC = () => {
  const [data, setData] = useState<KpiWallData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [retryTick, setRetryTick] = useState(0)
  const [tab, setTab] = useState(0)
  const timerRef = useRef<number | null>(null)

  // ── [Wave 5B-A] 大屏模板库状态 ──
  const [templates, setTemplates] = useState<WallTemplateDto[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateSource, setTemplateSource] = useState<'api' | 'local' | 'seed'>('seed')

  const loadTemplates = useCallback(async () => {
    const res = await biApi.getWallTemplates().catch(() => null)
    const env = res?.data as { data?: WallTemplateDto[] } | WallTemplateDto[] | null | undefined
    const remote = Array.isArray(env) ? env : Array.isArray(env?.data) ? env.data : null
    if (remote && remote.length > 0) {
      setTemplates(remote)
      setTemplateSource('api')
      return
    }
    // 后端模板不可用时回退 localStorage
    try {
      const raw = localStorage.getItem(WALL_LOCAL_KEY)
      const local = raw ? (JSON.parse(raw) as WallTemplateDto[]) : []
      if (Array.isArray(local) && local.length > 0) {
        setTemplates(local)
        setTemplateSource('local')
        return
      }
    } catch { /* ignore */ }
    setTemplates([])
    setTemplateSource('seed')
  }, [])

  useEffect(() => { void loadTemplates() }, [loadTemplates])

  const load = useCallback(async () => {
    setLoading(true)
    const [dailyRes, weeklyRes, workloadRes, kpiRes, roomsRes, oeeRes, slaRes, perfRes] = await Promise.allSettled([
      statsApi.getDaily(),
      statsApi.getWeekly(),
      statsApi.getWorkload(),
      biApi.getKpi(),
      occupancyApi.getRooms(),
      biApi.getDeviceOee(7),
      biApi.getCriticalSla(),
      biApi.getPhysicianPerformance(),
    ])
    const daily = dailyRes.status === 'fulfilled' && dailyRes.value.success ? dailyRes.value.data : null
    const weekly = weeklyRes.status === 'fulfilled' && weeklyRes.value.success
      ? (weeklyRes.value.data as { totalExams?: number } | null)?.totalExams ?? null
      : null
    const workload = workloadRes.status === 'fulfilled' && workloadRes.value.success ? (workloadRes.value.data ?? []) : []
    // biApi 返回 { source, generatedAt, data } 信封 → 解包
    const kpiRaw = kpiRes.status === 'fulfilled' && kpiRes.value.success ? kpiRes.value.data : null
    const kpi: KpiDto | null = kpiRaw && 'data' in kpiRaw ? (kpiRaw.data as KpiDto) : (kpiRaw as KpiDto | null)
    const rooms = roomsRes.status === 'fulfilled' && roomsRes.value.success ? (roomsRes.value.data ?? []) : []
    const oeeEnv = oeeRes.status === 'fulfilled' && oeeRes.value.success ? (oeeRes.value.data as { data?: { devices?: Array<{ avgOee: number }> } } | null)?.data : null
    const oeeDevices = Array.isArray(oeeEnv?.devices) ? oeeEnv.devices : []
    const oeeAvg = oeeDevices.length > 0
      ? Math.round(oeeDevices.reduce((s, d) => s + Number(d.avgOee ?? 0), 0) / oeeDevices.length)
      : null
    const slaEnv = slaRes.status === 'fulfilled' && slaRes.value.success ? (slaRes.value.data as { data?: { complianceRate?: number; total?: number } } | null)?.data : null
    const perfEnv = perfRes.status === 'fulfilled' && perfRes.value.success
      ? (perfRes.value.data as { data?: { bonus?: number; totalRvu?: number; byPhysician?: Array<{ doctorName: string; bonus: number; rvu: number; qualityScore: number }> } } | null)?.data
      : null
    setData({
      daily,
      weeklyTotal: weekly,
      workload: (Array.isArray(workload) ? workload : []).slice(0, 10),
      kpi,
      rooms: Array.isArray(rooms) ? rooms : [],
      oeeAvg,
      sla: {
        complianceRate: slaEnv?.complianceRate ?? null,
        total: slaEnv?.total ?? null,
      },
      performance: {
        totalBonus: perfEnv?.bonus ?? null,
        totalRvu: perfEnv?.totalRvu ?? null,
        rows: Array.isArray(perfEnv?.byPhysician) ? perfEnv.byPhysician : [],
      },
      dataSource: daily && kpi ? 'api' : 'demo',
      hasError: !daily && !kpi && rooms.length === 0,
    })
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load, retryTick])

  // 自动轮播: 3 页签轮换 (间隔取模板 autoRotateMs, 默认 15s)
  const activeTemplate = useMemo(() => templates.find((tpl) => tpl.id === selectedTemplateId) ?? null, [templates, selectedTemplateId])
  const activeBlocks = useMemo<WallBlock[]>(() => {
    const blocks = activeTemplate?.config?.blocks
    if (Array.isArray(blocks) && blocks.length > 0) return blocks.filter((b): b is WallBlock => b in BLOCK_LABELS)
    // 未选模板/配置缺失 → 按布局默认
    if (activeTemplate?.layout === 'equipment') return ['occupancy', 'oee']
    if (activeTemplate?.layout === 'quality') return ['quality', 'sla']
    if (activeTemplate?.layout === 'finance') return ['revenue', 'bonus']
    if (activeTemplate?.layout === 'mixed') return ['kpi', 'occupancy', 'quality', 'top10']
    return ['kpi', 'top10', 'critical']
  }, [activeTemplate])

  useEffect(() => {
    const rotateMs = Math.max(3000, Number(activeTemplate?.config?.autoRotateMs) || AUTO_ROTATE_MS)
    timerRef.current = window.setInterval(() => {
      setTab((n) => (n + 1) % Math.max(1, activeBlocks.length))
    }, rotateMs)
    return () => { if (timerRef.current) window.clearInterval(timerRef.current) }
  }, [activeTemplate, activeBlocks.length])

  const occupiedRooms = useMemo(() => data.rooms.filter((r) => r.status === 'occupied').length, [data.rooms])
  const occupiedRate = data.rooms.length > 0 ? Math.round((occupiedRooms / data.rooms.length) * 100) : 0

  const topDoctors = useMemo(() =>
    [...data.workload].sort((a, b) => (b.reportCount ?? 0) - (a.reportCount ?? 0)).slice(0, 10),
  [data.workload])

  const kpiCards = useMemo(() => {
    return [
      { label: t('kpiWall.todayExams'), value: String(data.daily?.examCount ?? '--'), icon: Activity, color: '#38bdf8' },
      { label: t('kpiWall.weekExams'), value: String(data.weeklyTotal ?? '--'), icon: TrendingUp, color: '#818cf8' },
      { label: t('kpiWall.monthExams'), value: data.daily?.examCount != null ? String(data.daily.examCount * 22) : '--', icon: Stethoscope, color: '#a78bfa' },
      { label: t('kpiWall.criticalToday'), value: String(data.daily?.criticalCount ?? '--'), icon: AlertTriangle, color: '#f87171' },
      { label: t('kpiWall.criticalSlaRate'), value: pct(data.kpi?.criticalSlaRate), icon: CheckCircle2, color: '#4ade80' },
      { label: t('kpiWall.onTimeRate'), value: pct(data.kpi?.completionRate), icon: Clock, color: '#fbbf24' },
      { label: t('kpiWall.avgReportTime'), value: data.kpi?.avgReportMinutes != null ? `${data.kpi.avgReportMinutes} min` : '--', icon: Gauge, color: '#2dd4bf' },
      { label: t('kpiWall.deviceOccupancy'), value: data.rooms.length > 0 ? `${occupiedRate}%` : '--', icon: Monitor, color: '#fb923c' },
    ]
  }, [data, occupiedRate])

  const blockHeader = (icon: React.ReactNode, title: string, tag?: React.ReactNode) => (
    <div style={{ fontSize: 34, fontWeight: 800, color: '#e2e8f0', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
      {icon} {title}
      {tag}
    </div>
  )

  // [Wave 5B-A] 区块渲染器: 按模板 config.blocks 组合
  const renderBlock = (block: WallBlock) => {
    switch (block) {
      case 'kpi':
        return (
          <div style={{ padding: '48px 40px' }}>
            {blockHeader(<Activity size={30} color="#38bdf8" />, t('kpiWall.headerKpi'), <Tag color="cyan" style={{ fontSize: 13, padding: '2px 10px' }}>{t('kpiWall.snapshotToday')}</Tag>)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
              {kpiCards.map((c) => {
                const Icon = c.icon
                return (
                  <div key={c.label} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '28px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: 17, marginBottom: 14 }}>
                      <Icon size={22} color={c.color} />
                      <span>{c.label}</span>
                    </div>
                    <div style={{ fontSize: 44, fontWeight: 800, color: c.color, lineHeight: 1.1 }}>{c.value}</div>
                    <div style={{ marginTop: 10, color: '#64748b', fontSize: 13 }}>
                      {c.label === t('kpiWall.deviceOccupancy') ? `${occupiedRooms}/${data.rooms.length} ${t('kpiWall.devicesInUse')}` : c.label === t('kpiWall.criticalSlaRate') ? t('kpiWall.criticalSlaCaption') : t('kpiWall.departmentSummary')}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      case 'top10':
        return (
          <div style={{ padding: '48px 40px' }}>
            {blockHeader(<TrendingUp size={30} color="#818cf8" />, t('kpiWall.headerTop10'), <Tag color="geekblue" style={{ fontSize: 13, padding: '2px 10px' }}>{t('kpiWall.top10Tag')}</Tag>)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
              {topDoctors.map((d, i) => {
                const max = Math.max(1, ...topDoctors.map((x) => x.reportCount ?? 0))
                return (
                  <div key={d.doctorId ?? d.doctorName + i} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 12, background: i < 3 ? 'rgba(251,191,36,0.15)' : 'rgba(59,130,246,0.15)', color: i < 3 ? '#fbbf24' : '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>{d.doctorName} <span style={{ color: '#64748b', fontSize: 14, fontWeight: 400 }}>{d.department ?? ''}</span></div>
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 10, background: 'rgba(148,163,184,0.15)', borderRadius: 5 }}>
                          <div style={{ width: `${Math.round(((d.reportCount ?? 0) / max) * 100)}%`, height: '100%', background: i < 3 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#2563eb,#60a5fa)', borderRadius: 5 }} />
                        </div>
                        <span style={{ fontSize: 28, fontWeight: 700, color: '#e2e8f0' }}>{d.reportCount ?? 0}</span>
                      </div>
                      <div style={{ marginTop: 6, color: '#94a3b8', fontSize: 14 }}>{t('kpiWall.examCountPrefix')} {d.examCount ?? 0} {t('kpiWall.examCountMid')} {d.avgTime ?? 0} {t('kpiWall.avgTimeSuffix')}</div>
                    </div>
                  </div>
                )
              })}
              {topDoctors.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('kpiWall.noWorkload')} style={{ margin: 40 }} />}
            </div>
          </div>
        )
      case 'critical':
        return (
          <div style={{ padding: '48px 40px' }}>
            {blockHeader(<HeartPulse size={30} color="#f87171" />, t('kpiWall.headerCritical'), <Tag color="red" style={{ fontSize: 13, padding: '2px 10px' }}>{t('kpiWall.today')}</Tag>)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32 }}>
                <div style={{ fontSize: 120, fontWeight: 800, color: '#f87171', lineHeight: 1.1 }}>{data.daily?.criticalCount ?? 0}</div>
                <div style={{ color: '#94a3b8', fontSize: 17 }}>{t('kpiWall.criticalReportsToday')}</div>
              </div>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32, color: '#cbd5e1', fontSize: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span>{t('kpiWall.avgTime')}</span><span style={{ fontWeight: 700, color: '#4ade80' }}>{data.daily?.avgTAT != null ? `${data.daily.avgTAT} min` : '--'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span>{t('kpiWall.qcAvgScore')}</span><span style={{ fontWeight: 700, color: '#fbbf24' }}>{data.daily?.qcAvgScore ?? '--'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('kpiWall.defectCount')}</span><span style={{ fontWeight: 700, color: '#f87171' }}>{data.daily?.defectCount ?? '--'}</span>
                </div>
              </div>
            </div>
          </div>
        )
      case 'occupancy':
        return (
          <div style={{ padding: '48px 40px' }}>
            {blockHeader(<Monitor size={30} color="#fb923c" />, t('kpiWall.headerOccupancy'), <Tag color="orange" style={{ fontSize: 13, padding: '2px 10px' }}>{t('kpiWall.realtimePrefix')} {occupiedRate}% ({occupiedRooms}/{data.rooms.length})</Tag>)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
              {data.rooms.map((room) => {
                const s = statusLabel[room.status] ?? { text: room.status, color: '#94a3b8' }
                const inUse = room.status === 'occupied'
                return (
                  <div key={room.id} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, borderLeft: `5px solid ${s.color}` }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>{room.roomNo}</div>
                    <div style={{ margin: '10px 0', fontSize: 16, color: s.color, fontWeight: 700 }}>{s.text}</div>
                    {inUse ? (
                      <>
                        <div style={{ fontSize: 15, color: '#cbd5e1' }}>{room.currentPatient ?? '--'}</div>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{room.examItem ?? ''}</div>
                        <div style={{ fontSize: 13, color: room.overdue ? '#f87171' : '#94a3b8', marginTop: 6 }}>
                          {t('kpiWall.startAt')} {room.startTime?.slice(11) ?? '--'} · {room.expectedEnd ? `${t('kpiWall.expectedAt')} ${room.expectedEnd.slice(11)}` : ''} {room.overdue ? t('kpiWall.overdueTag') : ''}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 14, color: '#64748b' }}>{room.status === 'fault' ? t('kpiWall.awaitingRepair') : t('kpiWall.canAcceptPatient')}</div>
                    )}
                  </div>
                )
              })}
              {data.rooms.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('kpiWall.noOccupancy')} style={{ margin: 40 }} />}
            </div>
          </div>
        )
      case 'oee':
        return (
          <div style={{ padding: '48px 40px' }}>
            {blockHeader(<Gauge size={30} color="#2dd4bf" />, t('kpiWall.headerOee'), <Tag color="cyan" style={{ fontSize: 13, padding: '2px 10px' }}>{t('kpiWall.last7DaysAvg')}</Tag>)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32 }}>
                <div style={{ fontSize: 110, fontWeight: 800, color: '#2dd4bf', lineHeight: 1.1 }}>{data.oeeAvg != null ? `${data.oeeAvg}%` : '--'}</div>
                <div style={{ color: '#94a3b8', fontSize: 17 }}>{t('kpiWall.oeeMeanCaption')}</div>
              </div>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>{t('kpiWall.deviceStatusDist')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, fontSize: 17 }}>
                  <div>{t('kpiWall.roomIdle')} <strong style={{ color: '#4ade80' }}>{data.rooms.filter((r) => r.status === 'idle').length}</strong></div>
                  <div>{t('kpiWall.roomOccupied')} <strong style={{ color: '#f87171' }}>{data.rooms.filter((r) => r.status === 'occupied').length}</strong></div>
                  <div>{t('kpiWall.roomDisinfecting')} <strong style={{ color: '#fbbf24' }}>{data.rooms.filter((r) => r.status === 'disinfecting').length}</strong></div>
                  <div>{t('kpiWall.roomFault')} <strong style={{ color: '#94a3b8' }}>{data.rooms.filter((r) => r.status === 'fault').length}</strong></div>
                </div>
              </div>
            </div>
          </div>
        )
      case 'quality':
        return (
          <div style={{ padding: '48px 40px' }}>
            {blockHeader(<CheckCircle2 size={30} color="#4ade80" />, t('kpiWall.headerQuality'), <Tag color="green" style={{ fontSize: 13, padding: '2px 10px' }}>{t('kpiWall.qualityTag')}</Tag>)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '28px 24px' }}>
                <div style={{ color: '#94a3b8', fontSize: 17, marginBottom: 14 }}>{t('kpiWall.onTimeRate')}</div>
                <div style={{ fontSize: 44, fontWeight: 800, color: '#4ade80' }}>{pct(data.kpi?.completionRate)}</div>
              </div>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '28px 24px' }}>
                <div style={{ color: '#94a3b8', fontSize: 17, marginBottom: 14 }}>{t('kpiWall.avgReportTime')}</div>
                <div style={{ fontSize: 44, fontWeight: 800, color: '#fbbf24' }}>{data.kpi?.avgReportMinutes != null ? `${data.kpi.avgReportMinutes} min` : '--'}</div>
              </div>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '28px 24px' }}>
                <div style={{ color: '#94a3b8', fontSize: 17, marginBottom: 14 }}>{t('kpiWall.qcAvgScore')}</div>
                <div style={{ fontSize: 44, fontWeight: 800, color: '#2dd4bf' }}>{data.daily?.qcAvgScore ?? '--'}</div>
              </div>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '28px 24px' }}>
                <div style={{ color: '#94a3b8', fontSize: 17, marginBottom: 14 }}>{t('kpiWall.pendingReports')}</div>
                <div style={{ fontSize: 44, fontWeight: 800, color: '#f87171' }}>{data.kpi?.pendingReports ?? '--'}</div>
              </div>
            </div>
          </div>
        )
      case 'sla':
        return (
          <div style={{ padding: '48px 40px' }}>
            {blockHeader(<Clock size={30} color="#fbbf24" />, t('kpiWall.headerSla'), <Tag color="gold" style={{ fontSize: 13, padding: '2px 10px' }}>{t('kpiWall.slaThreshold')}</Tag>)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32 }}>
                <div style={{ fontSize: 110, fontWeight: 800, color: '#fbbf24', lineHeight: 1.1 }}>{data.sla.complianceRate != null ? `${data.sla.complianceRate}%` : '--'}</div>
                <div style={{ color: '#94a3b8', fontSize: 17 }}>{t('kpiWall.criticalSlaRate')}</div>
              </div>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32, fontSize: 20, color: '#cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span>{t('kpiWall.criticalTotal')}</span><span style={{ fontWeight: 700, color: '#f87171' }}>{data.sla.total ?? '--'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span>{t('kpiWall.criticalTodayCount')}</span><span style={{ fontWeight: 700, color: '#f87171' }}>{data.daily?.criticalCount ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('kpiWall.avgTime')}</span><span style={{ fontWeight: 700, color: '#4ade80' }}>{data.daily?.avgTAT != null ? `${data.daily.avgTAT} min` : '--'}</span>
                </div>
              </div>
            </div>
          </div>
        )
      case 'revenue':
        return (
          <div style={{ padding: '48px 40px' }}>
            {blockHeader(<Wallet size={30} color="#a78bfa" />, t('kpiWall.headerRevenue'), <Tag color="purple" style={{ fontSize: 13, padding: '2px 10px' }}>{t('kpiWall.revenueTag')}</Tag>)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '28px 24px' }}>
                <div style={{ color: '#94a3b8', fontSize: 17, marginBottom: 14 }}>{t('kpiWall.todayRevenue')}</div>
                <div style={{ fontSize: 44, fontWeight: 800, color: '#a78bfa' }}>{data.daily?.examCount != null ? `¥${(data.daily.examCount * 1250).toLocaleString()}` : '--'}</div>
              </div>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '28px 24px' }}>
                <div style={{ color: '#94a3b8', fontSize: 17, marginBottom: 14 }}>{t('kpiWall.weekExams')}</div>
                <div style={{ fontSize: 44, fontWeight: 800, color: '#818cf8' }}>{data.weeklyTotal ?? '--'}</div>
              </div>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '28px 24px' }}>
                <div style={{ color: '#94a3b8', fontSize: 17, marginBottom: 14 }}>{t('kpiWall.totalRvu')}</div>
                <div style={{ fontSize: 44, fontWeight: 800, color: '#fbbf24' }}>{data.performance.totalRvu ?? '--'}</div>
              </div>
            </div>
          </div>
        )
      case 'bonus':
        return (
          <div style={{ padding: '48px 40px' }}>
            {blockHeader(<Wallet size={30} color="#fbbf24" />, t('kpiWall.headerBonus'), <Tag color="gold" style={{ fontSize: 13, padding: '2px 10px' }}>{t('kpiWall.bonusTag')}</Tag>)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.performance.rows.slice(0, 10).map((p, i) => {
                const max = Math.max(1, ...data.performance.rows.map((x) => x.bonus ?? 0))
                return (
                  <div key={p.doctorName + i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 28, fontSize: 17, fontWeight: 800, color: i < 3 ? '#fbbf24' : '#64748b' }}>{i + 1}</span>
                    <span style={{ width: 150, fontSize: 17, color: '#cbd5e1' }}>{p.doctorName}</span>
                    <div style={{ flex: 1, height: 14, background: 'rgba(148,163,184,0.15)', borderRadius: 7 }}>
                      <div style={{ width: `${Math.round(((p.bonus ?? 0) / max) * 100)}%`, height: '100%', background: i < 3 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#7c3aed,#a78bfa)', borderRadius: 7 }} />
                    </div>
                    <span style={{ width: 60, textAlign: 'right', fontSize: 14, color: '#94a3b8' }}>{p.qualityScore ?? '--'} {t('kpiWall.scoreUnit')}</span>
                    <span style={{ width: 110, textAlign: 'right', fontSize: 20, fontWeight: 700, color: '#fbbf24' }}>¥{Number(p.bonus ?? 0).toLocaleString()}</span>
                  </div>
                )
              })}
              {data.performance.rows.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('kpiWall.noBonus')} style={{ margin: 40 }} />}
              {data.performance.totalBonus != null && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#94a3b8', fontSize: 17 }}>{t('kpiWall.monthlyBonusTotal')}</span>
                  <span style={{ fontSize: 36, fontWeight: 800, color: '#fbbf24' }}>¥{data.performance.totalBonus.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )
      default:
        return null
    }
  }

  // [Wave 5B-A] 保存当前布局为模板: localStorage + 后端优先
  const handleSaveTemplate = useCallback(async () => {
    const name = templateName.trim()
    if (!name) { message.warning(t('kpiWall.templateNameRequired')); return }
    const layout: WallLayout = activeTemplate?.layout ?? 'overview'
    const config = { blocks: activeBlocks, autoRotateMs: Number(activeTemplate?.config?.autoRotateMs) || AUTO_ROTATE_MS }
    const now = new Date().toISOString()
    const template: WallTemplateDto = {
      id: `wall-local-${Date.now()}`,
      name,
      layout,
      config,
      active: false,
      createdAt: now,
      updatedAt: now,
    }
    // 1) 后端持久化 (失败不阻断)
    try {
      const res = await biApi.createWallTemplate({ name, layout, config, active: false })
      if (res.success && res.data?.id) template.id = res.data.id
    } catch { /* 后端不可用时仅存 localStorage */ }
    // 2) localStorage 兜底
    try {
      const local = [template, ...templates.filter((tpl) => tpl.id !== template.id)]
      localStorage.setItem(WALL_LOCAL_KEY, JSON.stringify(local))
    } catch { /* ignore */ }
    setTemplates((prev) => {
      const next = [template, ...prev.filter((tpl) => tpl.id !== template.id)]
      return next
    })
    setTemplateName('')
    setSelectedTemplateId(template.id)
    message.success(`模板「${name}」已保存 (${layout})`)
  }, [templateName, activeTemplate, activeBlocks, templates])

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#e2e8f0', position: 'relative' }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '18px 36px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
          <span style={{ color: '#38bdf8' }}>{t('kpiWall.department')}</span> {t('kpiWall.title')}
          <span style={{ fontSize: 14, color: '#64748b', fontWeight: 400, marginLeft: 14 }}>
            G005 · {activeTemplate?.config?.autoRotateMs ? Math.round(Number(activeTemplate.config.autoRotateMs) / 1000) : 15} {t('kpiWall.autoRotateSuffix')} {activeTemplate?.name ?? t('kpiWall.defaultTemplate')}
          </span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* [Wave 5B-A] 数据源徽标 */}
          <Tag
            color={data.dataSource === 'api' ? 'green' : 'orange'}
            icon={<Database size={12} />}
            style={{ fontSize: 13, padding: '2px 10px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {data.dataSource === 'api' ? t('kpiWall.realtimeApi') : t('kpiWall.demoFallbackData')}
          </Tag>
          {/* [Wave 5B-A] 模板选择器 */}
          <Select
            value={selectedTemplateId}
            onChange={setSelectedTemplateId}
            placeholder={t('kpiWall.selectTemplate')}
            style={{ width: 180 }}
            popupMatchSelectWidth={false}
            options={[
              ...LAYOUT_OPTIONS.map((l) => ({
                value: `layout-${l.value}`,
                label: `${l.label}${t('kpiWall.layoutSuffix')}`,
              })),
              ...templates.map((tpl) => ({ value: tpl.id, label: `${tpl.name} (${LAYOUT_OPTIONS.find((x) => x.value === tpl.layout)?.label ?? tpl.layout})` })),
            ]}
          />
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder={t('kpiWall.newTemplateName')}
            style={{ width: 140, background: 'rgba(255,255,255,0.06)', borderColor: BORDER, color: '#e2e8f0' }}
            onPressEnter={() => void handleSaveTemplate()}
          />
          <Button icon={<Save size={14} />} onClick={() => void handleSaveTemplate()}>{t('kpiWall.saveAsTemplate')}</Button>
          <Button type="primary" ghost icon={<RefreshCw size={14} />} onClick={() => setRetryTick((n) => n + 1)} loading={loading}>{t('kpiWall.refresh')}</Button>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' })}
          </div>
        </div>
      </div>

      {/* 轮播区块指示: 按模板 blocks 渲染 */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', padding: '14px 0 0' }}>
        {activeBlocks.map((b, i) => (
          <button
            key={b}
            onClick={() => setTab(i)}
            style={{
              padding: '6px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              background: tab % Math.max(1, activeBlocks.length) === i ? '#38bdf8' : 'rgba(148,163,184,0.15)',
              color: tab % Math.max(1, activeBlocks.length) === i ? '#0b1220' : '#94a3b8',
            }}
          >
            {BLOCK_LABELS[b]}
          </button>
        ))}
        <Tag
          icon={<LayoutTemplate size={12} />}
          color={templateSource === 'api' ? 'blue' : templateSource === 'local' ? 'purple' : 'default'}
          style={{ fontSize: 12, padding: '2px 10px', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {t('kpiWall.templateSource')} {templateSource === 'api' ? t('kpiWall.sourceBackend') : templateSource === 'local' ? t('kpiWall.sourceLocal') : t('kpiWall.sourceBuiltin')}
        </Tag>
      </div>

      <Spin spinning={loading} tip={t('kpiWall.loadingTip')}>
        {data.hasError ? (
          <div style={{ padding: '80px 40px', textAlign: 'center' }}>
            <Empty
              description={<span style={{ color: '#94a3b8' }}>{t('kpiWall.loadFailedEmpty')}</span>}
              style={{ marginBottom: 16 }}
              image={<AlertTriangle size={48} style={{ opacity: 0.4 }} />}
            />
            <Button type="primary" icon={<RefreshCw size={14} />} onClick={() => setRetryTick((n) => n + 1)}>{t('kpiWall.retry')}</Button>
          </div>
        ) : (
          <div key={activeBlocks.length === 0 ? 'none' : `${activeTemplate?.id ?? 'default'}:${tab % Math.max(1, activeBlocks.length)}`}>
            {activeBlocks.length > 0 ? renderBlock(activeBlocks[tab % activeBlocks.length]!) : null}
          </div>
        )}
      </Spin>

      <div style={{ position: 'fixed', bottom: 14, right: 24, fontSize: 12, color: '#475569' }}>
        {new Date().toLocaleTimeString('zh-CN', { hour12: false })}
      </div>
    </div>
  )
}

export default KpiWallPage
