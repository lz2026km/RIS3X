// G005 放射RIS系统 v3.0.6.11-101 Wave 4A (tech-v2) - 技师工作站 V2: 双检间轮转 + 工作量预测
// 功能: 轮转计划甘特图 (房间×时段格子显示技师) + 工作量均衡条形图 + 7 天预测 (实际 vs 预测 + 置信带)
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, message, Modal, Select, Spin, Tag, Tooltip } from 'antd'
import {
  Area, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ComposedChart, ReferenceLine,
} from 'recharts'
import { ChartContainer, chartDefaults } from '../../components/charts'
import {
  CalendarRange, RefreshCw, Repeat2, Scale, TrendingUp, PlayCircle, History as HistoryIcon,
} from 'lucide-react'
import { techV2Api } from '../../services/api/techV2Api'
import type {
  RotationPlan, RotationExecutionRecord, TechShift,
  WorkloadBalance, WorkloadForecast,
} from '../../services/api/techV2Api'
import { invalidateApiCacheByPrefix } from '../../services/api/client'
import { t } from '../../i18n/appI18n'
import { PageHeader } from '../../components/common/PageHeader'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'
import { EmptyState } from '../../components/common/EmptyState'
import { DataTable } from '../../components/common'

const shiftLabel = (shift: TechShift) => t(`techRotation.shift.${shift}`)

const SHIFT_ORDER: TechShift[] = ['DAY', 'NIGHT', 'WEEKEND', 'BACKUP']

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const shiftDate = (base: string, offset: number) => {
  const d = new Date(`${base}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

// 确定性哈希 (demo 回退与后端 seed 对齐)
const fnv1a = (input: string) => {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
const detRand = (min: number, max: number, seed: string) => {
  let a = (fnv1a(seed) + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296 * (max - min) + min
}

const TECH_DEMO = [
  { id: 'T-001', name: '刘洋', group: 'CT 组' },
  { id: 'T-002', name: '赵志刚', group: 'CT 组' },
  { id: 'T-003', name: '孙伟', group: 'MR 组' },
  { id: 'T-004', name: '王磊', group: 'DR 组' },
  { id: 'T-005', name: '陈静', group: 'DSA 组' },
  { id: 'T-006', name: '周婷', group: 'MG 组' },
  { id: 'T-007', name: '吴强', group: 'CT 组' },
  { id: 'T-008', name: '郑爽', group: 'MR 组' },
]

const ROOM_DEMO = [
  { id: 'R-CT1', name: 'CT-1 检查室' },
  { id: 'R-CT2', name: 'CT-2 检查室' },
  { id: 'R-MR1', name: 'MR-1 检查室' },
  { id: 'R-DR1', name: 'DR-1 检查室' },
  { id: 'R-DSA1', name: 'DSA-1 检查室' },
  { id: 'R-MG1', name: 'MG-1 检查室' },
]

const TECH_COLORS: Record<string, string> = {
  'T-001': 'var(--color-primary-500)', 'T-002': '#10b981', 'T-003': '#8b5cf6',
  'T-004': 'var(--color-warning-500)', 'T-005': 'var(--color-error-500)', 'T-006': 'var(--color-info-500)',
  'T-007': '#ec4899', 'T-008': '#84cc16',
}

const techColor = (id: string) => TECH_COLORS[id] ?? '#64748b'

// ==================== Demo 回退构建器 (确定性) ====================
function buildDemoPlan(startDate: string, days: number): RotationPlan {
  const assignments: RotationPlan['assignments'] = []
  const planId = `ROT-DEMO-${fnv1a(`${startDate}|${days}`).toString(16).toUpperCase()}`
  const rules = ['RULE-CT-DAY', 'RULE-CT-NIGHT', 'RULE-MR-DAY', 'RULE-MR-NIGHT', 'RULE-DR-DAY', 'RULE-DSA-DAY', 'RULE-MG-DAY', 'RULE-BACKUP'] as const
  const roomShift: Array<{ rule: string; shift: TechShift; roomId: string | null }> = [
    { rule: 'RULE-CT-DAY', shift: 'DAY', roomId: 'R-CT1' },
    { rule: 'RULE-CT-DAY', shift: 'DAY', roomId: 'R-CT2' },
    { rule: 'RULE-CT-NIGHT', shift: 'NIGHT', roomId: 'R-CT1' },
    { rule: 'RULE-MR-DAY', shift: 'DAY', roomId: 'R-MR1' },
    { rule: 'RULE-MR-NIGHT', shift: 'NIGHT', roomId: 'R-MR1' },
    { rule: 'RULE-DR-DAY', shift: 'DAY', roomId: 'R-DR1' },
    { rule: 'RULE-DSA-DAY', shift: 'DAY', roomId: 'R-DSA1' },
    { rule: 'RULE-MG-DAY', shift: 'DAY', roomId: 'R-MG1' },
  ]
  const skill: Record<string, string[]> = {
    'R-CT1': ['T-001', 'T-002', 'T-007'],
    'R-CT2': ['T-001', 'T-002', 'T-007'],
    'R-MR1': ['T-003', 'T-008'],
    'R-DR1': ['T-004'],
    'R-DSA1': ['T-005'],
    'R-MG1': ['T-006'],
  }
  const load = new Map(TECH_DEMO.map((t) => [t.id, Math.round(detRand(10, 26, `wv-base:${t.id}`))]))
  const usedPerDay = new Map<string, Set<string>>()
  const loadPerShift = (shift: TechShift) => (shift === 'NIGHT' ? 20 : shift === 'BACKUP' ? 3 : 60)
  const ruleName = (rid: string) => rules.includes(rid as typeof rules[number]) ? rid : rid
  for (let d = 0; d < days; d++) {
    const date = shiftDate(startDate, d)
    const wd = new Date(`${date}T00:00:00Z`).getUTCDay()
    const weekend = wd === 0 || wd === 6
    if (!usedPerDay.has(date)) usedPerDay.set(date, new Set())
    const slots = weekend
      ? [
          { rule: 'RULE-CT-DAY', shift: 'WEEKEND' as TechShift, roomId: 'R-CT1' },
          { rule: 'RULE-DR-DAY', shift: 'WEEKEND' as TechShift, roomId: 'R-DR1' },
          { rule: 'RULE-MG-DAY', shift: 'WEEKEND' as TechShift, roomId: 'R-MG1' },
          { rule: 'RULE-CT-NIGHT', shift: 'NIGHT' as TechShift, roomId: 'R-CT1' },
          { rule: 'RULE-MR-NIGHT', shift: 'NIGHT' as TechShift, roomId: 'R-MR1' },
        ]
      : roomShift
    slots.forEach((slot, i) => {
      const pool = slot.roomId ? (skill[slot.roomId] ?? []) : ['T-003', 'T-007', 'T-008']
      const used = usedPerDay.get(date)!
      const avail = pool.filter((id) => !used.has(id) && detRand(0, 1, `wv-leave:${id}:${date}`) >= 0.04)
      if (avail.length === 0) return
      avail.sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0))
      const tech = avail[0]!
      const predicted = loadPerShift(slot.shift) + Math.round(detRand(-4, 6, `wv-load:${date}:${slot.roomId}:${i}`))
      const before = load.get(tech) ?? 0
      load.set(tech, before + predicted)
      used.add(tech)
      const room = ROOM_DEMO.find((r) => r.id === slot.roomId) ?? null
      assignments.push({
        id: `ASG-DEMO-${fnv1a(`${planId}:${date}:${slot.shift}:${slot.roomId ?? 'b'}`).toString(16).toUpperCase()}`,
        planId,
        ruleId: ruleName(slot.rule),
        date,
        shift: slot.shift,
        roomId: room?.id ?? null,
        roomName: room?.name ?? null,
        technicianId: tech,
        technicianName: TECH_DEMO.find((t) => t.id === tech)?.name ?? tech,
        accumulatedBefore: before,
        predictedLoad: predicted,
        reason: '最小累计工作量优先 (demo)',
      })
    })
  }
  const planLoad = new Map<string, number>()
  const count = new Map<string, number>()
  const nights = new Map<string, number>()
  assignments.forEach((a) => {
    planLoad.set(a.technicianId, (planLoad.get(a.technicianId) ?? 0) + a.predictedLoad)
    count.set(a.technicianId, (count.get(a.technicianId) ?? 0) + 1)
    if (a.shift === 'NIGHT') nights.set(a.technicianId, (nights.get(a.technicianId) ?? 0) + 1)
  })
  const perTechnician = TECH_DEMO.map((t) => {
    const baseLoad = Math.round(detRand(10, 26, `wv-base:${t.id}`))
    const pl = planLoad.get(t.id) ?? 0
    return {
      technicianId: t.id, technicianName: t.name, baseLoad, planLoad: pl,
      cumulativeLoad: baseLoad + pl, assignmentCount: count.get(t.id) ?? 0, nights: nights.get(t.id) ?? 0,
    }
  })
  const ctLoads = ['T-001', 'T-002', 'T-007'].map((id) => planLoad.get(id) ?? 0)
  const mrLoads = ['T-003', 'T-008'].map((id) => planLoad.get(id) ?? 0)
  const groups: WorkloadBalance['groups'] = [
    { groupId: 'GROUP-CT', groupName: 'CT 组', technicianIds: ['T-001', 'T-002', 'T-007'], loads: ['T-001', 'T-002', 'T-007'].map((id) => ({ technicianId: id, technicianName: TECH_DEMO.find((t) => t.id === id)?.name ?? id, load: planLoad.get(id) ?? 0 })), maxMinDiff: Math.max(...ctLoads) - Math.min(...ctLoads) },
    { groupId: 'GROUP-MR', groupName: 'MR 组', technicianIds: ['T-003', 'T-008'], loads: ['T-003', 'T-008'].map((id) => ({ technicianId: id, technicianName: TECH_DEMO.find((t) => t.id === id)?.name ?? id, load: planLoad.get(id) ?? 0 })), maxMinDiff: Math.max(...mrLoads) - Math.min(...mrLoads) },
  ]
  const maxMinDiff = Math.max(...groups.map((g) => g.maxMinDiff), 0)
  const threshold = Math.max(8, Math.round(Math.max(...groups.map((g) => g.loads.reduce((s, l) => s + l.load, 0) / Math.max(1, g.loads.length))) * 0.5 + 60 * 0.9))
  return {
    id: planId,
    generatedAt: new Date().toISOString(),
    startDate,
    endDate: shiftDate(startDate, days - 1),
    days,
    balanceWeight: 0.6,
    assignments,
    skipped: [],
    balance: { perTechnician, groups, maxMinDiff, threshold, balanced: maxMinDiff <= threshold, seeded: true },
    seeded: true,
  }
}

function buildDemoForecast(startDate: string, days: number): WorkloadForecast {
  const daily: WorkloadForecast['daily'] = []
  for (let d = 0; d < days; d++) {
    const date = shiftDate(startDate, d)
    const wd = new Date(`${date}T00:00:00Z`).getUTCDay()
    const weekdayFactor = [0.85, 0.95, 1.0, 1.05, 1.1, 1.15, 1.1][wd] ?? 1
    const periods = ['00-03', '03-06', '06-09', '09-12', '12-15', '15-18', '18-21', '21-24'].map((p, i) => {
      const base = [2, 1, 20, 95, 80, 65, 35, 12][i] ?? 10
      const value = Math.round(base * weekdayFactor * detRand(0.9, 1.1, `wv-f:${date}:${p}`))
      return { period: p, hourRange: p, value, lower: Math.max(0, value - 6), upper: value + 6 }
    })
    const value = periods.reduce((s, p) => s + p.value, 0)
    daily.push({
      date, weekday: WEEKDAYS[wd] ?? '', label: `${date.slice(5)} ${WEEKDAYS[wd] ?? ''}`,
      value, lower: value - 24, upper: value + 24,
      appointments: 110 + 4 * wd, trendFactor: 1, periods,
    })
  }
  const history = Array.from({ length: 7 }, (_, k) => {
    const date = shiftDate(startDate, -(7 - k))
    const wd = new Date(`${date}T00:00:00Z`).getUTCDay()
    const weekdayFactor = [0.85, 0.95, 1.0, 1.05, 1.1, 1.15, 1.1][wd] ?? 1
    return { date, weekday: WEEKDAYS[wd] ?? '', value: Math.round(410 * weekdayFactor * detRand(0.92, 1.08, `wv-act:${date}`)) }
  })
  const perTechnician = daily.flatMap((d) => {
    const weights = TECH_DEMO.map((t) => ({ t, w: detRand(0.5, 1.5, `wv-share:${t.id}:${d.date}`) }))
    const sum = weights.reduce((s, x) => s + x.w, 0)
    return weights.map((x) => ({ technicianId: x.t.id, technicianName: x.t.name, date: d.date, share: Math.round(x.w / sum * 1000) / 1000, value: Math.round(d.value * x.w / sum) }))
  })
  return {
    startDate, days, model: 'demo', seeded: true,
    daily,
    totals: { value: daily.reduce((s, d) => s + d.value, 0), lower: daily.reduce((s, d) => s + d.lower, 0), upper: daily.reduce((s, d) => s + d.upper, 0) },
    perTechnician,
    byRoom: ROOM_DEMO.flatMap((r) => daily.map((d) => ({ roomId: r.id, roomName: r.name, date: d.date, value: Math.round(d.value / ROOM_DEMO.length) }))),
    history,
  }
}

// ==================== 页面 ====================

export default function TechRotationPage() {
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'api' | 'demo'>('demo')
  const [plan, setPlan] = useState<RotationPlan | null>(null)
  const [forecast, setForecast] = useState<WorkloadForecast | null>(null)
  const [executions, setExecutions] = useState<RotationExecutionRecord[]>([])
  const [startDate, setStartDate] = useState(todayStr())
  const [days, setDays] = useState(7)
  const [techFilter, setTechFilter] = useState<string | undefined>(undefined)
  const [execModal, setExecModal] = useState<{ assignmentId: string; techName: string; date: string; shift: TechShift } | null>(null)

  const load = useCallback(async (start: string, dayCount: number) => {
    setLoading(true)
    try {
      const [planRes, forecastRes, histRes] = await Promise.all([
        techV2Api.rotationPlan(start, dayCount),
        techV2Api.forecast({ startDate: start, days: dayCount }),
        techV2Api.rotationHistory(),
      ])
      if (!planRes.success || !forecastRes.success || !histRes.success) throw new Error('tech-v2 api failed')
      setPlan(planRes.data)
      setForecast(forecastRes.data)
      setExecutions(histRes.data?.executions ?? [])
      setDataSource('api')
    } catch {
      const demoPlan = buildDemoPlan(start, dayCount)
      setPlan(demoPlan)
      setForecast(buildDemoForecast(start, dayCount))
      setExecutions([])
      setDataSource('demo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(startDate, days) }, [load, startDate, days])

  const regenerate = () => {
    void invalidateApiCacheByPrefix('/tech-v2')
    void load(startDate, days)
  }

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await techV2Api.generatePlan({ startDate, days })
      if (res.success) {
        message.success(t('techRotation.generated', { count: res.data.assignments.length, result: res.data.balance.balanced ? t('techRotation.balancedOk') : t('techRotation.balancedNo') }))
        regenerate()
        return
      }
      message.error(res.error?.message ?? t('techRotation.generateFailed'))
      setLoading(false)
    } catch {
      message.error(t('techRotation.generateFailedDemo'))
      setLoading(false)
    }
  }

  const handleExecute = async () => {
    if (!execModal) return
    const res = await techV2Api.executeAssignment(execModal.assignmentId, '工作站手动执行')
    if (res.success) {
      message.success(t('techRotation.execRegistered', { name: res.data.technicianName, shift: shiftLabel(res.data.shift) }))
      setExecModal(null)
      regenerate()
    } else {
      message.error(res.error?.message ?? t('techRotation.execFailed'))
    }
  }

  // ==================== 派生视图 ====================

  const balance: WorkloadBalance | null = plan?.balance ?? null

  const ganttRows = useMemo(() => {
    if (!plan) return []
    const dates = Array.from({ length: plan.days }, (_, d) => shiftDate(plan.startDate, d))
    const rows: Array<{ key: string; label: string; shift: TechShift; cells: Array<RotationPlan['assignments'][number] | undefined> }> = []
    const rowKeys = new Set<string>()
    plan.assignments.forEach((a) => {
      const key = `${a.shift}:${a.roomId ?? 'BACKUP'}`
      if (rowKeys.has(key)) return
      rowKeys.add(key)
    })
    const ordered = SHIFT_ORDER.flatMap((shift) => {
      const roomIds = [...new Set(plan.assignments.filter((a) => a.shift === shift).map((a) => a.roomId ?? 'BACKUP'))]
      return roomIds.sort((x, y) => (x === 'BACKUP' ? 1 : y === 'BACKUP' ? -1 : x.localeCompare(y)))
    })
    ordered.forEach((key) => {
      const [shift, roomId] = key.split(':') as [TechShift, string]
      const room = roomId === 'BACKUP' ? null : ROOM_DEMO.find((r) => r.id === roomId)
      rows.push({
        key,
        shift,
        label: room ? `${room.name} · ${shiftLabel(shift)}` : `${t('techRotation.mobile')} · ${shiftLabel(shift)}`,
        cells: dates.map((date) => plan.assignments.find((a) => a.date === date && a.shift === shift && (a.roomId ?? 'BACKUP') === roomId)),
      })
    })
    return rows
  }, [plan])

  const forecastChartData = useMemo(() => {
    const hist = (forecast?.history ?? []).map((h) => ({ label: `${h.date.slice(5)} ${h.weekday}`, actual: h.value, forecast: null as number | null, lower: null as number | null, upper: null as number | null }))
    const fut = (forecast?.daily ?? []).map((d) => ({ label: `${d.date.slice(5)} ${d.weekday}`, actual: null as number | null, forecast: d.value, lower: d.lower, upper: d.upper }))
    return [...hist, ...fut]
  }, [forecast])

  const periodData = useMemo(() => {
    const day = forecast?.daily.find((d) => d.date === startDate) ?? forecast?.daily[0]
    if (!day) return []
    return day.periods.map((p) => ({ period: p.period, value: p.value, lower: p.lower, upper: p.upper }))
  }, [forecast, startDate])

  const techForecastRows = useMemo(() => {
    const date = forecast?.daily[0]?.date ?? ''
    const items = (forecast?.perTechnician ?? []).filter((t) => t.date === date && (!techFilter || t.technicianId === techFilter))
    return items.sort((a, b) => b.value - a.value)
  }, [forecast, techFilter])

  const execCount = useMemo(() => {
    if (!plan) return 0
    return executions.filter((e) => e.planId === plan.id).length
  }, [plan, executions])

  const balanceChartData = useMemo(
    () => (balance?.perTechnician ?? []).map((t) => ({ name: t.technicianName, 累计工作量: t.cumulativeLoad, 计划负载: t.planLoad })),
    [balance],
  )

  return (
    <div data-testid="tech-rotation-page" style={{ padding: 20, maxWidth: 1320, margin: '0 auto' }}>
      {/* ================= 头部 ================= */}
      <PageHeader
        icon={<Repeat2 size={18} color="var(--color-primary-800)" />}
        title={t('techRotation.title')}
        subtitle={<>
          <Tag color="blue" style={{ fontSize: 11 }}>{t('techRotation.wave')}</Tag>
          <Tag color={dataSource === 'api' ? 'green' : 'orange'} style={{ fontSize: 11 }}>
            {dataSource === 'api' ? t('techRotation.apiLive') : t('techRotation.demoData')}
          </Tag>
        </>}
        actions={
          <>
            <CalendarRange size={14} color="var(--text-secondary)" />
            <input
              type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '3px 8px', fontSize: 12, background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              data-testid="trv-start-date"
            />
            <Select size="small" value={days} style={{ width: 90 }} onChange={(v) => setDays(v)}
              options={[{ value: 7, label: t('techRotation.days7') }, { value: 14, label: t('techRotation.days14') }]} />
            <Button size="small" type="primary" onClick={() => void handleGenerate()} data-testid="trv-generate">{t('techRotation.generate')}</Button>
            <Tooltip title={t('techRotation.refresh')}>
              <Button size="small" icon={<RefreshCw size={14} />} onClick={regenerate} />
            </Tooltip>
          </>
        }
      />

      {/* ================= KPI ================= */}
      <StatCardGrid minWidth={170} gap={14} style={{ marginBottom: 16 }}>
        <StatCard title={t('techRotation.kpiPlanDays')} value={plan?.days ?? 0} icon={<CalendarRange size={18} />} color="var(--color-primary-800)" />
        <StatCard title={t('techRotation.kpiAssignments')} value={plan?.assignments.length ?? 0} icon={<Repeat2 size={18} />} color="success" />
        <StatCard title={t('techRotation.kpiMaxMinDiff')} value={balance?.maxMinDiff ?? 0} color={balance?.balanced ? 'success' : 'error'} icon={<Scale size={18} />} />
        <StatCard title={t('techRotation.kpiExecuted')} value={execCount} icon={<PlayCircle size={18} />} color="#7c3aed" />
        {balance && (
          <StatCard
            title={t('techRotation.balanceTitle')}
            value={balance.balanced ? t('techRotation.balanced') : t('techRotation.needManual')}
            sub={`${balance.maxMinDiff} / ${balance.threshold}`}
            color={balance.balanced ? 'success' : 'error'}
            icon={<Scale size={18} />}
          />
        )}
      </StatCardGrid>

      <Spin spinning={loading}>
        {/* ================= 轮转计划甘特图 ================= */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Repeat2 size={16} color="var(--color-primary-800)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t('techRotation.ganttTitle')}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)' }}>
              {plan ? t('techRotation.ganttSub', { range: `${plan.startDate} ~ ${plan.endDate}` }) : t('techRotation.noPlan')}
            </span>
          </div>
          {plan && ganttRows.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900, fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>{t('techRotation.roomShift')}</th>
                    {Array.from({ length: plan.days }, (_, d) => {
                      const date = shiftDate(plan.startDate, d)
                      const wd = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? ''
                      const weekend = wd === '周六' || wd === '周日'
                      return (
                        <th key={date} style={{ ...thStyle, background: weekend ? '#fef3c7' : undefined, color: weekend ? '#b45309' : 'var(--text-primary)' }}>
                          {date.slice(5)} <span style={{ fontSize: 10, color: weekend ? '#b45309' : 'var(--text-secondary)' }}>{wd}</span>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {ganttRows.map((row) => (
                    <tr key={row.key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', background: 'var(--bg-card)' }}>{row.label}</td>
                      {row.cells.map((cell, i) => (
                        <td key={i} style={{ ...tdStyle, textAlign: 'center' }}>
                          {cell ? (
                            <Tooltip title={`${cell.technicianName} · ${t('techRotation.loadHint', { load: cell.predictedLoad, before: cell.accumulatedBefore })}`}>
                              <div
                                onClick={() => setExecModal({ assignmentId: cell.id, techName: cell.technicianName, date: cell.date, shift: cell.shift })}
                                style={{
                                  display: 'inline-block', padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                                  background: `${techColor(cell.technicianId)}1a`, color: techColor(cell.technicianId),
                                  border: `1px solid ${techColor(cell.technicianId)}55`, fontWeight: 600, fontSize: 11,
                                }}
                                data-testid={`trv-cell-${cell.date}`}
                              >
                                {cell.technicianName}
                              </div>
                            </Tooltip>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', opacity: 0.4 }}>-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* 图例 */}
              <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('techRotation.legendTech')}</span>
                {TECH_DEMO.map((tech) => (
                  <span key={tech.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: techColor(tech.id) }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: techColor(tech.id), display: 'inline-block' }} />
                    {tech.name}
                  </span>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)' }}>{t('techRotation.clickToRegister')}</span>
              </div>
            </div>
          ) : (
            <EmptyState description={t('techRotation.noPlanEmpty')} />
          )}
        </div>

        {/* ================= 工作量均衡 + 预测 ================= */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16, marginBottom: 16 }}>
          {/* 均衡条形图 */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Scale size={16} color="#059669" />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t('techRotation.balancePanel')}</span>
            </div>
            {balanceChartData.length > 0 ? (
              <ChartContainer type="bar" height={260}>
                <BarChart data={balanceChartData} margin={chartDefaults.margin}>
                  <CartesianGrid {...chartDefaults.grid} />
                  <XAxis dataKey="name" {...chartDefaults.axis} />
                  <YAxis {...chartDefaults.axis} />
                  <RTooltip {...chartDefaults.tooltip} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="计划负载" name={t('techRotation.planLoad')} fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="累计工作量" name={t('techRotation.cumulativeLoad')} fill="var(--color-primary-500)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyState description={t('techRotation.noBalance')} />
            )}
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
              {t('techRotation.diffSummary', { diff: balance?.maxMinDiff ?? '-', threshold: balance?.threshold ?? '-' })}
              {' · '}{t('techRotation.judgement')} <b style={{ color: balance?.balanced ? '#059669' : 'var(--color-error-600)' }}>{balance?.balanced ? t('techRotation.balanced') : t('techRotation.notBalanced')}</b>
            </div>
          </div>

          {/* 技师预测排行 */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <TrendingUp size={16} color="#7c3aed" />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t('techRotation.techForecastTitle', { label: forecast?.daily[0]?.label ?? '-' })}</span>
              <Select
                size="small" placeholder={t('techRotation.allTechs')} allowClear style={{ width: 130, marginLeft: 'auto' }} value={techFilter}
                onChange={(v) => setTechFilter(v ?? undefined)}
                options={TECH_DEMO.map((tech) => ({ value: tech.id, label: tech.name }))}
              />
            </div>
            {techForecastRows.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {techForecastRows.map((t) => {
                  const total = forecast?.daily[0]?.value ?? 1
                  const pct = Math.round((t.value / total) * 100)
                  return (
                    <div key={t.technicianId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 56, fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{t.technicianName}</span>
                      <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--border-color)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: 10, borderRadius: 5, background: techColor(t.technicianId) }} />
                      </div>
                      <span style={{ width: 64, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {t.value} · {pct}%
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState description={t('techRotation.noForecast')} />
            )}
          </div>
        </div>

        {/* ================= 预测面板: 实际 vs 预测 + 置信带 ================= */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <TrendingUp size={16} color="var(--color-primary-800)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t('techRotation.forecastTitle', { days })}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)' }}>
              {t('techRotation.modelSummary', { model: forecast?.model ?? '-', total: forecast?.totals.value ?? '-', lower: forecast?.totals.lower ?? '-', upper: forecast?.totals.upper ?? '-' })}
            </span>
          </div>
          {forecastChartData.length > 0 ? (
            <ChartContainer type="composed" height={300}>
              <ComposedChart data={forecastChartData} margin={chartDefaults.margin}>
                <CartesianGrid {...chartDefaults.grid} />
                <XAxis dataKey="label" interval={0} angle={-32} textAnchor="end" height={56} {...chartDefaults.axis} />
                <YAxis {...chartDefaults.axis} />
                <RTooltip {...chartDefaults.tooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area dataKey="upper" name={t('techRotation.upperBound')} stroke="none" fill="var(--color-primary-500)" fillOpacity={0.12} />
                <Area dataKey="lower" name={t('techRotation.lowerBound')} stroke="none" fill="var(--color-primary-500)" fillOpacity={0.12} />
                <Line dataKey="actual" name={t('techRotation.actual')} stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                <Line dataKey="forecast" name={t('techRotation.forecast')} stroke="var(--color-primary-500)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                <ReferenceLine x={forecastChartData[Math.max(0, forecastChartData.length - (forecast?.days ?? 7))]?.label ?? ''} stroke="var(--color-warning-500)" strokeDasharray="4 4" label={{ value: t('techRotation.today'), fontSize: 10, fill: 'var(--color-warning-500)', position: 'top' }} />
              </ComposedChart>
            </ChartContainer>
          ) : (
            <EmptyState description={t('techRotation.noForecastData')} />
          )}
          {/* 每时段预测 */}
          {periodData.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                {t('techRotation.periodTitle', { date: startDate, count: periodData.length })}
              </div>
              <ChartContainer type="bar" height={200}>
                <BarChart data={periodData} margin={chartDefaults.margin}>
                  <CartesianGrid {...chartDefaults.grid} />
                  <XAxis dataKey="period" {...chartDefaults.axis} />
                  <YAxis {...chartDefaults.axis} />
                  <RTooltip {...chartDefaults.tooltip} />
                  <Bar dataKey="value" name={t('techRotation.periodLoad')} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          )}
        </div>

        {/* ================= 执行记录 ================= */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <HistoryIcon size={16} color="#7c3aed" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t('techRotation.execTitle', { count: executions.length })}</span>
          </div>
          {executions.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <DataTable
                dataSource={executions.slice(0, 12)}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: t('techRotation.thDate'), dataIndex: 'date' },
                  { title: t('techRotation.thShift'), dataIndex: 'shift', render: (v: TechShift) => shiftLabel(v) },
                  { title: t('techRotation.thTech'), dataIndex: 'technicianName', render: (v: string) => <b>{v}</b> },
                  { title: t('techRotation.thRoom'), dataIndex: 'roomId', render: (v: string | null) => v ? ROOM_DEMO.find((r) => r.id === v)?.name ?? v : t('techRotation.mobile') },
                  {
                    title: t('techRotation.thStatus'), dataIndex: 'status',
                    render: (v: string) => <Tag color={v === 'EXECUTED' ? 'green' : 'orange'}>{v === 'EXECUTED' ? t('techRotation.executed') : t('techRotation.skipped')}</Tag>,
                  },
                  { title: t('techRotation.thExecTime'), dataIndex: 'executedAt', render: (v: string) => v.slice(0, 16).replace('T', ' ') },
                  { title: t('techRotation.thNote'), dataIndex: 'note', render: (v: string | null | undefined) => <span style={{ color: 'var(--text-secondary)' }}>{v ?? '-'}</span> },
                ]}
              />
            </div>
          ) : (
            <EmptyState description={t('techRotation.noExec')} />
          )}
        </div>
      </Spin>

      {/* ================= 执行弹窗 ================= */}
      <Modal
        title={t('techRotation.execModalTitle')}
        open={!!execModal}
        onCancel={() => setExecModal(null)}
        onOk={() => void handleExecute()}
        okText={t('techRotation.execOk')}
        cancelText={t('techRotation.cancel')}
        width={380}
        destroyOnClose
      >
        {execModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <div>{t('techRotation.execTech')} <b>{execModal.techName}</b></div>
            <div>{t('techRotation.execDate')} {execModal.date} · {shiftLabel(execModal.shift)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('techRotation.execConfirmHint')}</div>
          </div>
        )}
      </Modal>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '8px 6px', borderBottom: '1px solid var(--border-color)', textAlign: 'center', fontSize: 12,
  color: 'var(--text-secondary)', background: 'var(--bg-card)', whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '6px', borderBottom: '1px solid var(--border-color)', fontSize: 12,
  color: 'var(--text-primary)',
}
