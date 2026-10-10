// G005 放射RIS系统 v3.0.6.11-101 Wave 4B (tech-ops) - 技师工作站 V2
// 功能: ① 设备利用率历史 (30 天折线 + 小时热力图 + 统计卡 + 设备对比)
//       ② 紧急插入 (时段建议列表: 当前进行中/最近空闲/备用设备 + 冲突检测 → 调整方案 + 插入记录)
//       ③ 跨机房排程优化 (检查队列 + 设备矩阵 → 贪心分配表 + 优化前后总等待对比)
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Empty, Input, InputNumber, message, Modal, Select, Spin, Tabs, Tag, Tooltip } from 'antd'
import {
  Activity, AlertTriangle, BarChart3, CalendarClock, CheckCircle2,
  Clock, Flame, Gauge, LayoutGrid, ListOrdered, RefreshCw, Server, Siren,
  TrendingDown, TrendingUp, User, XCircle, Zap, Timer, ArrowRightLeft,
} from 'lucide-react'
import { techOpsApi } from '../../services/api/techOpsApi'
import type {
  DeviceUtilization, EmergencyRecord, EmergencySuggestion, ExamPriority,
  OptimizeAssignment, OptimizeDevice, OptimizeExam, OptimizeResult, TechOpsDevice,
  UtilizationHistory, UtilizationStats,
} from '../../services/api/techOpsApi'
import { invalidateApiCacheByPrefix } from '../../services/api/client'
import { DataTable } from '../../components/common/DataTable'
import { t } from '../../i18n/appI18n'

// ============================================================
// 样式常量 (ops 深色主题)
// ============================================================
// [UI] retokenized ops palette — resolves correctly in light + dark themes
const C = {
  bg: 'var(--bg-primary)',
  panel: 'var(--bg-card)',
  border: 'var(--border-default)',
  text: 'var(--text-primary)',
  textMid: 'var(--text-secondary)',
  textLight: 'var(--text-muted)',
  blue: 'var(--color-primary)',
  green: 'var(--color-success)',
  orange: 'var(--color-warning)',
  red: 'var(--color-error)',
  purple: 'var(--color-modality-mr)',
  teal: 'var(--color-info-500)',
}

const MODALITY_COLORS: Record<string, string> = {
  CT: 'var(--color-modality-ct)',
  MR: 'var(--color-modality-mr)',
  DR: 'var(--color-modality-dr)',
  DSA: 'var(--color-modality-dsa)',
  MG: 'var(--color-modality-mg)',
}

const PRIORITY_COLORS: Record<ExamPriority, string> = {
  STAT: C.red,
  URGENT: C.orange,
  ROUTINE: C.textMid,
}

const priorityLabel = (p: ExamPriority) => t(`techOps.priority.${p}`)

const STRATEGY_COLORS: Record<string, string> = {
  INSERT_NOW: C.red,
  NEXT_FREE: C.green,
  SPARE_DEVICE: C.blue,
}

const fmtMin = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

const fmtTime = (iso: string) => {
  if (!iso) return '--'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const fmtDate = (iso: string) => {
  if (!iso) return '--'
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

const rateColor = (rate: number) => {
  if (rate >= 85) return C.red
  if (rate >= 60) return C.orange
  if (rate >= 35) return C.blue
  return C.green
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-primary)', color: C.text, border: `1px solid ${C.border}`,
  borderRadius: 6, padding: '4px 10px', fontSize: 13, }

// ============================================================
// 本地演示回退数据 (API 不可用时保证页面可用)
// ============================================================
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function buildDemoUtilization(): UtilizationHistory {
  const dateKeys: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dateKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  const devices: DeviceUtilization[] = [
    { deviceId: 'DEV-CT1', name: 'CT-1 检查室', modality: 'CT', technician: '刘洋', meanRate: 74, peakRate: 92, troughRate: 8, totalExams: 412, busyDays: 21, avgSessionMin: 18, trend: [], hours: [] },
    { deviceId: 'DEV-CT2', name: 'CT-2 检查室', modality: 'CT', technician: '赵志刚', meanRate: 66, peakRate: 88, troughRate: 6, totalExams: 368, busyDays: 18, avgSessionMin: 16, trend: [], hours: [] },
    { deviceId: 'DEV-MR1', name: 'MR-1 检查室', modality: 'MR', technician: '孙伟', meanRate: 71, peakRate: 90, troughRate: 5, totalExams: 231, busyDays: 19, avgSessionMin: 25, trend: [], hours: [] },
    { deviceId: 'DEV-DR1', name: 'DR-1 检查室', modality: 'DR', technician: '王磊', meanRate: 62, peakRate: 85, troughRate: 7, totalExams: 486, busyDays: 15, avgSessionMin: 12, trend: [], hours: [] },
    { deviceId: 'DEV-DSA1', name: 'DSA-1 检查室', modality: 'DSA', technician: '陈静', meanRate: 58, peakRate: 83, troughRate: 4, totalExams: 96, busyDays: 13, avgSessionMin: 32, trend: [], hours: [] },
    { deviceId: 'DEV-MG1', name: 'MG-1 检查室', modality: 'MG', technician: '周婷', meanRate: 55, peakRate: 80, troughRate: 6, totalExams: 152, busyDays: 11, avgSessionMin: 15, trend: [], hours: [] },
  ]
  const devSeeds = [74, 66, 71, 62, 58, 55]
  dateKeys.forEach((key, di) => {
    const weekday = WEEKDAYS[new Date(`${key}T00:00:00`).getDay()] ?? ''
    const weekend = weekday === '周日' || weekday === '周六'
    const dayFactor = 0.82 + ((di * 37) % 37) / 100
    const wf = weekend ? 0.62 : 1
    devices.forEach((dev, vi) => {
      const base = devSeeds[vi] as number
      const rate = Math.max(3, Math.min(96, Math.round(base * dayFactor * wf * (0.95 + ((vi + di) % 13) / 100))))
      dev.trend.push({ date: key, rate })
      if (dev.hours.length === 0) {
        for (let h = 0; h < 24; h++) {
          let hb: number
          if (h >= 8 && h < 11) hb = 82
          else if (h >= 11 && h < 14) hb = 62
          else if (h >= 14 && h < 18) hb = 70
          else if (h >= 18 && h < 21) hb = 32
          else if (h >= 21 || h < 6) hb = 9
          else hb = 20
          dev.hours.push({ hour: h, hourLabel: `${String(h).padStart(2, '0')}:00`, rate: Math.max(2, Math.min(98, hb + ((h + vi) % 9) - 4)) })
        }
      }
    })
  })
  const series = dateKeys.map((key, di) => {
    const rates = devices.map((d) => (d.trend[di] as { rate: number }).rate)
    const mean = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
    return {
      date: key, label: key.slice(5), weekday: WEEKDAYS[new Date(`${key}T00:00:00`).getDay()] ?? '',
      rate: mean, occupiedHours: Math.round(mean * 0.24 * 10) / 10,
      exams: devices.reduce((a, d) => a + Math.round((mean / 100) * 24 * 60 / d.avgSessionMin / devices.length), 0),
      points: Array.from({ length: 24 }, (_, h) => {
        const hrs = devices.map((d) => d.hours[h]!.rate)
        return { hour: h, hourLabel: `${String(h).padStart(2, '0')}:00`, rate: Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) }
      }),
    }
  })
  const totalExams = devices.reduce((a, d) => a + d.totalExams, 0)
  const peakIdx = series.map((s) => s.rate).indexOf(Math.max(...series.map((x) => x.rate)))
  const troughIdx = series.map((s) => s.rate).indexOf(Math.min(...series.map((x) => x.rate)))
  const stats: UtilizationStats = {
    meanRate: Math.round(series.reduce((a, s) => a + s.rate, 0) / series.length),
    peakRate: Math.max(...series.map((s) => s.rate)),
    peakDate: series[peakIdx]!.date,
    peakHour: 10, peakHourLabel: '10:00',
    troughRate: Math.min(...series.map((s) => s.rate)),
    troughDate: series[troughIdx]!.date,
    troughHour: 3, troughHourLabel: '03:00',
    totalExams, avgDailyExams: Math.round(totalExams / 30),
  }
  return { days: 30, granularity: 'day', seeded: true, series, stats, devices }
}

const DEMO_DEVICES: TechOpsDevice[] = [
  { id: 'DEV-CT1', name: 'CT-1 检查室', modality: 'CT', technician: '刘洋', spare: false },
  { id: 'DEV-CT2', name: 'CT-2 检查室', modality: 'CT', technician: '赵志刚', spare: true },
  { id: 'DEV-MR1', name: 'MR-1 检查室', modality: 'MR', technician: '孙伟', spare: false },
  { id: 'DEV-DR1', name: 'DR-1 检查室', modality: 'DR', technician: '王磊', spare: false },
  { id: 'DEV-DSA1', name: 'DSA-1 检查室', modality: 'DSA', technician: '陈静', spare: false },
  { id: 'DEV-MG1', name: 'MG-1 检查室', modality: 'MG', technician: '周婷', spare: false },
]

const DEMO_EMERGENCY_RECORDS: EmergencyRecord[] = [
  {
    id: 'EMG-DEMO-1', patientName: '马建军', examItem: '头颅CT平扫', modality: 'CT', priority: 'STAT',
    deviceId: 'DEV-CT2', deviceName: 'CT-2 检查室', technician: '赵志刚',
    startMin: 0, startAt: new Date().toISOString(), endMin: 25, endAt: new Date().toISOString(),
    status: 'INSERTED', conflictCount: 0, adjustments: [], reason: '脑外伤疑似出血', createdAt: new Date().toISOString(),
  },
]

const DEMO_OPTIMIZE: { exams: OptimizeExam[]; devices: OptimizeDevice[] } = {
  exams: [
    { id: 'DEMO-E1', patientName: '张伟', examItem: '胸部CT平扫', modality: 'CT', durationMin: 15, priority: 'ROUTINE', arrivalMin: 0 },
    { id: 'DEMO-E2', patientName: '王芳', examItem: '腰椎MR平扫', modality: 'MR', durationMin: 20, priority: 'ROUTINE', arrivalMin: 5 },
    { id: 'DEMO-E3', patientName: '李明', examItem: '头颅CT增强', modality: 'CT', durationMin: 25, priority: 'URGENT', arrivalMin: 2 },
    { id: 'DEMO-E4', patientName: '刘洋', examItem: '冠脉造影', modality: 'DSA', durationMin: 40, priority: 'STAT', arrivalMin: 10 },
    { id: 'DEMO-E5', patientName: '赵敏', examItem: '乳腺钼靶', modality: 'MG', durationMin: 12, priority: 'ROUTINE', arrivalMin: 15 },
    { id: 'DEMO-E6', patientName: '陈杰', examItem: '腹部CT平扫', modality: 'CT', durationMin: 15, priority: 'ROUTINE', arrivalMin: 20 },
    { id: 'DEMO-E7', patientName: '孙丽', examItem: '膝关节DR', modality: 'DR', durationMin: 8, priority: 'ROUTINE', arrivalMin: 18 },
    { id: 'DEMO-E8', patientName: '周强', examItem: '颈椎MR平扫', modality: 'MR', durationMin: 18, priority: 'ROUTINE', arrivalMin: 30 },
    { id: 'DEMO-E9', patientName: '吴敏', examItem: '胸部CT增强', modality: 'CT', durationMin: 25, priority: 'ROUTINE', arrivalMin: 35 },
    { id: 'DEMO-E10', patientName: '郑华', examItem: '腰椎MR增强', modality: 'MR', durationMin: 25, priority: 'URGENT', arrivalMin: 40 },
  ],
  devices: [
    { id: 'DEV-CT1', name: 'CT-1 检查室', modality: 'CT', availableFrom: 100, technician: '刘洋' },
    { id: 'DEV-CT2', name: 'CT-2 检查室', modality: 'CT', availableFrom: 0, technician: '赵志刚' },
    { id: 'DEV-MR1', name: 'MR-1 检查室', modality: 'MR', availableFrom: 0, technician: '孙伟' },
    { id: 'DEV-DR1', name: 'DR-1 检查室', modality: 'DR', availableFrom: 0, technician: '王磊' },
    { id: 'DEV-DSA1', name: 'DSA-1 检查室', modality: 'DSA', availableFrom: 15, technician: '陈静' },
    { id: 'DEV-MG1', name: 'MG-1 检查室', modality: 'MG', availableFrom: 0, technician: '周婷' },
  ],
}

// ============================================================
// 折线图 (纯 SVG, 无第三方依赖)
// ============================================================
function RateLineChart({ rates, labels, height = 170 }: { rates: number[]; labels: string[]; height?: number }) {
  const W = 640
  const H = height
  const PAD_L = 34
  const PAD_R = 12
  const PAD_T = 12
  const PAD_B = 22
  if (rates.length < 2) return <Empty description={t('common.empty.noData')} style={{ color: C.textMid }} />
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  const step = innerW / (rates.length - 1)
  const px = (i: number) => PAD_L + i * step
  const py = (v: number) => PAD_T + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH
  const pts = rates.map((v, i) => `${px(i)},${py(v)}`)
  const area = `${PAD_L},${PAD_T + innerH} ${pts.join(' ')} ${PAD_L + innerW},${PAD_T + innerH}`
  const stepLabels = Math.max(1, Math.ceil(rates.length / 10))
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={PAD_L} x2={W - PAD_R} y1={py(g)} y2={py(g)} stroke="var(--border-default)" strokeDasharray="3 3" />
          <text x={PAD_L - 4} y={py(g) + 3} fill={C.textLight} fontSize={9} textAnchor="end">{g}%</text>
        </g>
      ))}
      <polygon points={area} fill="rgba(59,130,246,0.12)" stroke="none" />
      <polyline points={pts.join(' ')} fill="none" stroke={C.blue} strokeWidth={2} strokeLinejoin="round" />
      {rates.map((v, i) => (
        <circle key={i} cx={px(i)} cy={py(v)} r={i % stepLabels === 0 ? 2.6 : 1.6} fill={rateColor(v)}>
          <title>{`${labels[i] ?? ''} ${v}%`}</title>
        </circle>
      ))}
      {rates.map((_, i) =>
        i % stepLabels === 0 ? (
          <text key={`l${i}`} x={px(i)} y={H - 6} fill={C.textLight} fontSize={9} textAnchor="middle">
            {(labels[i] ?? '').slice(5)}
          </text>
        ) : null,
      )}
    </svg>
  )
}

// ============================================================
// 小时热力图 (设备 × 24h)
// ============================================================
function HourHeatmap({ devices }: { devices: DeviceUtilization[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900, fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 10px', color: C.textMid, fontWeight: 500, minWidth: 130 }}>{t('techOps.thDevice')}</th>
            {Array.from({ length: 24 }, (_, h) => (
              <th key={h} style={{ padding: '4px 2px', color: h >= 8 && h < 18 ? C.text : C.textLight, fontWeight: 500, width: 26 }}>
                {h}
              </th>
            ))}
            <th style={{ padding: '4px 8px', color: C.textMid, fontWeight: 500 }}>{t('techOps.thMean')}</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((dev) => (
            <tr key={dev.deviceId}>
              <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>
                <span style={{ color: MODALITY_COLORS[dev.modality] ?? C.blue, fontWeight: 600 }}>{dev.modality}</span>
                <span style={{ color: C.text, marginLeft: 6 }}>{dev.name}</span>
              </td>
              {dev.hours.map((p) => (
                <td key={p.hour} style={{ padding: 0 }}>
                  <div
                    title={t('techOps.hourOccupy', { name: dev.name, hour: p.hourLabel, rate: p.rate })}
                    style={{
                      height: 22, margin: 1, borderRadius: 3,
                      background: `rgba(59,130,246,${Math.max(0.06, p.rate / 100)})`,
                      border: p.rate >= 85 ? `1px solid ${C.red}` : '1px solid rgba(255,255,255,0.04)',
                    }}
                  />
                </td>
              ))}
              <td style={{ padding: '5px 8px', color: rateColor(dev.meanRate), fontWeight: 700, whiteSpace: 'nowrap' }}>{dev.meanRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11, color: C.textMid }}>
        {t('techOps.occupancyLegend')} {[10, 35, 60, 85].map((r) => (
          <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: `rgba(59,130,246,${r / 100})`, display: 'inline-block' }} />
            ~{r}%
          </span>
        ))}
        <span style={{ marginLeft: 8 }}>{t('techOps.clickForDetail')}</span>
      </div>
    </div>
  )
}

// ============================================================
// 主页面
// ============================================================
export default function TechOpsPage() {
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'api' | 'demo'>('demo')

  // --- Tab 1: 利用率 ---
  const [util, setUtil] = useState<UtilizationHistory>(buildDemoUtilization)
  const [utilDays, setUtilDays] = useState(30)

  // --- Tab 2: 紧急插入 ---
  const [emgForm, setEmgForm] = useState({ modality: 'CT', deviceId: '', durationMin: 15, patientName: '', examItem: '', priority: 'URGENT' as ExamPriority, reason: '' })
  const [suggestions, setSuggestions] = useState<EmergencySuggestion[] | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [records, setRecords] = useState<EmergencyRecord[]>(DEMO_EMERGENCY_RECORDS)
  const [confirmTarget, setConfirmTarget] = useState<EmergencySuggestion | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [insertResult, setInsertResult] = useState<{ success: boolean; message: string; adjustments: EmergencyRecord['adjustments']; conflicts: EmergencySuggestion['conflicts'] } | null>(null)

  // --- Tab 3: 优化 ---
  const [optQueue, setOptQueue] = useState<{ exams: OptimizeExam[]; devices: OptimizeDevice[] } | null>(null)
  const [optResult, setOptResult] = useState<OptimizeResult | null>(null)
  const [optLoading, setOptLoading] = useState(false)

  const loadUtil = useCallback(async () => {
    setLoading(true)
    try {
      const res = await techOpsApi.utilization(utilDays, 'day')
      if (!res.success) throw new Error('utilization api failed')
      setUtil(res.data)
      setDataSource('api')
    } catch {
      setUtil(buildDemoUtilization())
      setDataSource('demo')
    } finally {
      setLoading(false)
    }
  }, [utilDays])

  const loadRecords = useCallback(async () => {
    try {
      const res = await techOpsApi.records()
      if (res.success) setRecords(res.data)
    } catch {
      // 保留演示记录
    }
  }, [])

  useEffect(() => { void loadUtil() }, [loadUtil])
  useEffect(() => { void loadRecords() }, [loadRecords])

  // ================= 紧急插入 =================
  const handleSuggest = async () => {
    if (!emgForm.modality) {
      message.warning(t('techOps.selectModality'))
      return
    }
    setSuggesting(true)
    setSuggestions(null)
    try {
      const res = await techOpsApi.suggest({
        modality: emgForm.modality,
        deviceId: emgForm.deviceId || undefined,
        durationMin: emgForm.durationMin,
      })
      if (!res.success) throw new Error('suggest api failed')
      setSuggestions(res.data)
      setDataSource('api')
    } catch {
      setSuggestions(buildDemoSuggestions(emgForm))
      setDataSource('demo')
    } finally {
      setSuggesting(false)
    }
  }

  const handleInsert = async () => {
    if (!confirmTarget) return
    setConfirmLoading(true)
    try {
      const res = await techOpsApi.insert({
        patientName: emgForm.patientName || t('techOps.emergencyPatient'),
        examItem: emgForm.examItem || undefined,
        modality: emgForm.modality,
        deviceId: confirmTarget.deviceId,
        startMin: confirmTarget.startMin,
        durationMin: emgForm.durationMin,
        priority: emgForm.priority,
        reason: emgForm.reason || undefined,
        force: confirmTarget.conflictCount > 0,
      })
      if (res.success) {
        setInsertResult({ success: true, message: res.data.message, adjustments: res.data.adjustments, conflicts: res.data.conflicts })
        void invalidateApiCacheByPrefix('/tech-ops')
        void loadRecords()
      } else {
        setInsertResult({ success: false, message: res.data.message, adjustments: res.data.adjustments, conflicts: res.data.conflicts })
      }
      setConfirmTarget(null)
    } catch (err) {
      message.error(t('techOps.insertFailed', { msg: (err as Error)?.message ?? t('techOps.unknownError') }))
    } finally {
      setConfirmLoading(false)
    }
  }

  // ================= 跨机房优化 =================
  const handleLoadDemo = async () => {
    setOptLoading(true)
    try {
      const res = await techOpsApi.demoQueue()
      if (!res.success) throw new Error('demo queue api failed')
      setOptQueue(res.data)
      setOptResult(null)
      setDataSource('api')
    } catch {
      setOptQueue(DEMO_OPTIMIZE)
      setOptResult(null)
      setDataSource('demo')
    } finally {
      setOptLoading(false)
    }
  }

  const handleOptimize = async () => {
    if (!optQueue) {
      message.warning(t('techOps.loadQueueFirst'))
      return
    }
    setOptLoading(true)
    try {
      const res = await techOpsApi.optimize(optQueue)
      if (!res.success) throw new Error('optimize api failed')
      setOptResult(res.data)
      setDataSource('api')
    } catch {
      const local = runLocalOptimize(optQueue)
      setOptResult(local)
      setDataSource('demo')
    } finally {
      setOptLoading(false)
    }
  }

  const utilStats = useMemo(() => util?.stats, [util])
  const assignments = useMemo(() => optResult?.assignments ?? [], [optResult])

  // ============================================================
  // Tab 1: 设备利用率历史
  // ============================================================
  function renderUtilization() {
    return (
      <div>
        <div style={{ padding: '20px 0 0' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { title: t('techOps.kpiAvgRate'), value: `${utilStats?.meanRate ?? 0}%`, sub: t('techOps.daysAvg', { days: util?.days ?? 30 }), icon: <Gauge size={20} />, color: C.blue },
              { title: t('techOps.kpiPeakRate'), value: `${utilStats?.peakRate ?? 0}%`, sub: `${fmtDate(utilStats?.peakDate ?? '')}`, icon: <TrendingUp size={20} />, color: C.red },
              { title: t('techOps.kpiTroughRate'), value: `${utilStats?.troughRate ?? 0}%`, sub: `${fmtDate(utilStats?.troughDate ?? '')} ${utilStats?.troughHourLabel ?? ''}`, icon: <TrendingDown size={20} />, color: C.green },
              { title: t('techOps.kpiPeakHour'), value: utilStats?.peakHourLabel ?? '--', sub: t('techOps.crossDevicePeak'), icon: <Flame size={20} />, color: C.orange },
              { title: t('techOps.kpiTotalExams'), value: utilStats?.totalExams ?? 0, sub: t('techOps.dailyAvg', { count: utilStats?.avgDailyExams ?? 0 }), icon: <ListOrdered size={20} />, color: C.teal },
            ].map((kpi) => (
              <div key={kpi.title} style={{ flex: 1, minWidth: 160, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: C.textMid }}>{kpi.title}</span>
                  <span style={{ color: kpi.color }}>{kpi.icon}</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 700 }}>{kpi.value}</div>
                <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{kpi.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} color={C.blue} />
              <span style={{ fontWeight: 600 }}>{t('techOps.utilTrendTitle')}</span>
              {util?.seeded && <Tag color="orange" style={{ marginLeft: 4 }}>{t('techOps.seed')}</Tag>}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[7, 14, 30].map((d) => (
                <Button key={d} size="small" type={utilDays === d ? 'primary' : 'default'} onClick={() => setUtilDays(d)}>
                  {t('techOps.daysUnit', { days: d })}
                </Button>
              ))}
            </div>
          </div>
          <Spin spinning={loading}>
            <RateLineChart rates={util?.series.map((s) => s.rate) ?? []} labels={util?.series.map((s) => s.date) ?? []} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textLight, marginTop: 4 }}>
              <span>{t('techOps.trendNote1')}</span>
              <span>{t('techOps.trendNote2')}</span>
            </div>
          </Spin>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CalendarClock size={16} color={C.purple} />
            <span style={{ fontWeight: 600 }}>{t('techOps.hourHeatmapTitle')}</span>
          </div>
          <HourHeatmap devices={util?.devices ?? []} />
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Server size={16} color={C.teal} />
            <span style={{ fontWeight: 600 }}>{t('techOps.deviceCompare')}</span>
          </div>
          <DataTable
            dataSource={util?.devices ?? []}
            rowKey={(dev) => dev.deviceId}
            pagination={false}
            showExport={false}
            showDensity={false}
            emptyText={t('common.empty.noData')}
            columns={[
              {
                title: t('techOps.thDevice'),
                key: 'device',
                render: (_v, dev) => (
                  <span style={{ whiteSpace: 'nowrap' }}>
                    <Tag color={MODALITY_COLORS[dev.modality]}>{dev.modality}</Tag>
                    <span style={{ color: C.text }}>{dev.name}</span>
                  </span>
                ),
              },
              {
                title: t('techOps.thTech'),
                key: 'technician',
                render: (_v, dev) => (
                  <span style={{ color: C.textMid }}>
                    <User size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                    {dev.technician}
                  </span>
                ),
              },
              {
                title: t('techOps.thAvgRate'),
                key: 'meanRate',
                render: (_v, dev) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                    <div style={{ flex: 1, background: 'var(--bg-primary)', borderRadius: 4, height: 8, overflow: 'hidden', minWidth: 80 }}>
                      <div style={{ width: `${dev.meanRate}%`, height: 8, background: rateColor(dev.meanRate), borderRadius: 4 }} />
                    </div>
                    <span style={{ fontWeight: 700, color: rateColor(dev.meanRate), width: 40, textAlign: 'right' }}>{dev.meanRate}%</span>
                  </div>
                ),
              },
              { title: t('techOps.thPeak'), key: 'peakRate', align: 'right' as const, render: (_v, dev) => <span style={{ color: C.red }}>{dev.peakRate}%</span> },
              { title: t('techOps.thTrough'), key: 'troughRate', align: 'right' as const, render: (_v, dev) => <span style={{ color: C.green }}>{dev.troughRate}%</span> },
              { title: t('techOps.thExamCount'), key: 'totalExams', align: 'right' as const, render: (_v, dev) => <span style={{ color: C.text }}>{dev.totalExams}</span> },
              { title: t('techOps.thBusyDays'), key: 'busyDays', align: 'right' as const, render: (_v, dev) => <span style={{ color: C.textMid }}>{t('techOps.busyDaysUnit', { count: dev.busyDays })}</span> },
              { title: t('techOps.thAvgSession'), key: 'avgSessionMin', align: 'right' as const, render: (_v, dev) => <span style={{ color: C.textMid }}>{t('techOps.minUnit', { count: dev.avgSessionMin })}</span> },
            ]}
          />
        </div>
      </div>
    )
  }

  // ============================================================
  // Tab 2: 紧急插入
  // ============================================================
  function renderEmergency() {
    return (
      <div>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Siren size={16} color={C.red} />
            <span style={{ fontWeight: 600 }}>{t('techOps.emgInsertTitle')}</span>
            <span style={{ fontSize: 12, color: C.textLight }}>{t('techOps.emgInsertDesc')}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <Select
              size="middle" style={{ width: 110 }} value={emgForm.modality}
              onChange={(v) => setEmgForm({ ...emgForm, modality: v })}
              options={['CT', 'MR', 'DR', 'DSA', 'MG'].map((m) => ({ value: m, label: m }))}
            />
            <Select
              size="middle" style={{ width: 170 }} value={emgForm.deviceId || undefined} placeholder={t('techOps.allDevices')}
              onChange={(v) => setEmgForm({ ...emgForm, deviceId: v ?? '' })} allowClear
              options={DEMO_DEVICES.map((d) => ({ value: d.id, label: `${d.name} (${d.modality})` }))}
            />
            <span style={{ color: C.textMid, fontSize: 13 }}>{t('techOps.duration')}</span>
            <InputNumber
              size="middle" min={5} max={90} value={emgForm.durationMin}
              onChange={(v) => setEmgForm({ ...emgForm, durationMin: v ?? 15 })}
              style={{ width: 90 }} addonAfter={t('techOps.min')}
            />
            <Input
              style={{ ...inputStyle, width: 140 }} placeholder={t('techOps.patientName')} value={emgForm.patientName}
              onChange={(e) => setEmgForm({ ...emgForm, patientName: e.target.value })}
            />
            <Input
              style={{ ...inputStyle, width: 160 }} placeholder={t('techOps.examItem')} value={emgForm.examItem}
              onChange={(e) => setEmgForm({ ...emgForm, examItem: e.target.value })}
            />
            <Select
              size="middle" style={{ width: 100 }} value={emgForm.priority}
              onChange={(v) => setEmgForm({ ...emgForm, priority: v })}
              options={(['STAT', 'URGENT'] as ExamPriority[]).map((p) => ({ value: p, label: priorityLabel(p) }))}
            />
            <Button size="middle" type="primary" icon={<Zap size={14} />} loading={suggesting} onClick={() => void handleSuggest()}>
              {t('techOps.getSuggestions')}
            </Button>
          </div>
        </div>

        {suggestions !== null && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Clock size={15} color={C.blue} />
              <span style={{ fontWeight: 600 }}>{t('techOps.suggestionTitle')}</span>
              <span style={{ fontSize: 12, color: C.textLight }}>{t('techOps.suggestionDesc')}</span>
            </div>
            {suggestions.length === 0 ? (
              <Empty description={t('techOps.noSlot')} style={{ color: C.textMid }} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
                {suggestions.map((s) => (
                  <div key={s.id} style={{ background: C.panel, border: `1px solid ${s.conflictCount > 0 ? 'var(--color-warning)' : C.border}`, borderRadius: 8, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                      <Tag color={STRATEGY_COLORS[s.strategy]} style={{ marginRight: 0 }}>{s.strategyLabel}</Tag>
                      {s.conflictCount > 0
                        ? <Tag color="red" icon={<AlertTriangle size={11} />}>{t('techOps.conflicts', { count: s.conflictCount })}</Tag>
                        : <Tag color="green" icon={<CheckCircle2 size={11} />}>{t('techOps.noConflict')}</Tag>}
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: C.textMid }}>{t('techOps.device')}</span>
                      <b style={{ color: C.text }}>{s.deviceName}</b>
                      <Tag color={MODALITY_COLORS[s.modality]} style={{ marginLeft: 6 }}>{s.modality}</Tag>
                    </div>
                    <div style={{ fontSize: 13, display: 'flex', gap: 14, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span><span style={{ color: C.textLight }}>{t('techOps.start')} </span><b style={{ color: s.startInMin <= 10 ? C.green : C.text }}>{fmtTime(s.startAt)}</b></span>
                      <span><span style={{ color: C.textLight }}>{t('techOps.end')} </span><b>{fmtTime(s.endAt)}</b></span>
                      <span><span style={{ color: C.textLight }}>{t('techOps.wait')} </span><b style={{ color: C.orange }}>{t('techOps.waitMin', { count: s.startInMin })}</b></span>
                    </div>
                    <div style={{ fontSize: 12, color: C.textLight, marginBottom: 10, minHeight: 32, lineHeight: 1.5 }}>{s.note}</div>
                    {s.conflicts.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: C.textMid, marginBottom: 4 }}>{t('techOps.conflictDetail')}</div>
                        {s.conflicts.slice(0, 3).map((c) => (
                          <Tooltip key={c.examId} title={`${c.patientName} ${c.examItem} ${fmtMin(c.startMin)}-${fmtMin(c.endMin)} · ${t('techOps.overlapMin', { count: c.overlapMin })}`}>
                            <div style={{ fontSize: 11, color: C.orange, background: 'rgba(245,158,11,0.08)', borderRadius: 4, padding: '3px 8px', marginBottom: 3 }}>
                              {c.type === 'ONGOING' ? t('techOps.ongoing') : t('techOps.scheduled')} {c.patientName} · {c.examItem}
                            </div>
                          </Tooltip>
                        ))}
                        {s.conflicts.length > 3 && <div style={{ fontSize: 11, color: C.textLight }}>{t('techOps.moreConflicts', { count: s.conflicts.length - 3 })}</div>}
                      </div>
                    )}
                    <Button size="small" type="primary" block icon={<Siren size={13} />} onClick={() => setConfirmTarget(s)}>
                      {t('techOps.insertNow')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Timer size={15} color={C.teal} />
            <span style={{ fontWeight: 600 }}>{t('techOps.emgRecords')}</span>
            <span style={{ fontSize: 12, color: C.textLight }}>{t('techOps.recordCount', { count: records.length })}</span>
          </div>
          {records.length === 0 ? (
            <Empty description={t('techOps.noRecords')} style={{ color: C.textMid }} />
          ) : (
            <DataTable
              dataSource={records}
              rowKey={(r) => r.id}
              pagination={false}
              showExport={false}
              showDensity={false}
              emptyText={t('techOps.noRecords')}
              columns={[
                { title: t('techOps.thPatient'), key: 'patientName', render: (_v, r) => <span style={{ color: C.text, fontWeight: 500 }}>{r.patientName}</span> },
                { title: t('techOps.thItem'), key: 'examItem', dataIndex: 'examItem' },
                {
                  title: t('techOps.thDevice'), key: 'device',
                  render: (_v, r) => (
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <Tag color={MODALITY_COLORS[r.modality]}>{r.modality}</Tag>
                      {r.deviceName}
                    </span>
                  ),
                },
                { title: t('techOps.thStart'), key: 'startAt', render: (_v, r) => <span style={{ color: C.green }}>{fmtTime(r.startAt)}</span> },
                { title: t('techOps.thEnd'), key: 'endAt', render: (_v, r) => <span style={{ color: C.textLight }}>{fmtTime(r.endAt)}</span> },
                { title: t('techOps.thPriority'), key: 'priority', render: (_v, r) => <Tag color={PRIORITY_COLORS[r.priority]}>{priorityLabel(r.priority)}</Tag> },
                {
                  title: t('techOps.thConflict'), key: 'conflictCount',
                  render: (_v, r) => <span style={{ color: r.conflictCount > 0 ? C.orange : C.green }}>{r.conflictCount > 0 ? `${r.conflictCount} 项` : t('techOps.none')}</span>,
                },
                { title: t('techOps.thAdjust'), key: 'adjustments', render: (_v, r) => <span style={{ color: C.textMid }}>{r.adjustments.length > 0 ? t('techOps.adjustCount', { count: r.adjustments.length }) : '—'}</span> },
                { title: t('techOps.thRemark'), key: 'reason', render: (_v, r) => <span style={{ color: C.textLight, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>{r.reason ?? '—'}</span> },
              ]}
            />
          )}
        </div>
      </div>
    )
  }

  // ============================================================
  // Tab 3: 跨机房排程优化
  // ============================================================
  function renderOptimize() {
    return (
      <div>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <ArrowRightLeft size={16} color={C.blue} />
            <span style={{ fontWeight: 600 }}>{t('techOps.optTitle')}</span>
            <span style={{ fontSize: 12, color: C.textLight }}>{t('techOps.optDesc')}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button size="middle" icon={<ListOrdered size={14} />} loading={optLoading} onClick={() => void handleLoadDemo()}>
              {optQueue ? t('techOps.reloadDemoQueue') : t('techOps.loadDemoQueue')}
            </Button>
            <Button size="middle" type="primary" icon={<BarChart3 size={14} />} loading={optLoading} disabled={!optQueue} onClick={() => void handleOptimize()}>
              {t('techOps.runOptimize')}
            </Button>
            {optResult && (
              <span style={{ fontSize: 12, color: C.textLight, alignSelf: 'center' }}>
                {t('techOps.generatedAt', { time: fmtTime(optResult.generatedAt) })}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(560px,1fr))', gap: 16, marginBottom: 16 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <User size={15} color={C.teal} />
              <span style={{ fontWeight: 600 }}>{t('techOps.queueTitle')}</span>
              <span style={{ fontSize: 12, color: C.textLight }}>{t('techOps.itemCount', { count: optQueue?.exams.length ?? 0 })}</span>
            </div>
            {!optQueue ? (
              <Empty description={t('techOps.loadQueueHint')} style={{ color: C.textMid }} />
            ) : (
              <DataTable
                dataSource={[...optQueue.exams].sort((a, b) => a.arrivalMin - b.arrivalMin)}
                rowKey={(e) => e.id}
                pagination={false}
                showExport={false}
                showDensity={false}
                scroll={{ y: 420 }}
                columns={[
                  { title: t('techOps.thPatient'), key: 'patientName', render: (_v, e) => <span style={{ color: C.text }}>{e.patientName}</span> },
                  { title: t('techOps.thItem'), key: 'examItem', dataIndex: 'examItem' },
                  { title: t('techOps.thModality'), key: 'modality', render: (_v, e) => <Tag color={MODALITY_COLORS[e.modality]}>{e.modality}</Tag> },
                  { title: t('techOps.thDuration'), key: 'durationMin', align: 'right' as const, render: (_v, e) => <span style={{ color: C.textMid }}>{t('techOps.minUnit', { count: e.durationMin })}</span> },
                  { title: t('techOps.thPriority'), key: 'priority', render: (_v, e) => <Tag color={PRIORITY_COLORS[e.priority]}>{priorityLabel(e.priority)}</Tag> },
                  { title: t('techOps.thArrival'), key: 'arrivalMin', align: 'right' as const, render: (_v, e) => <span style={{ color: C.textLight }}>{fmtMin(e.arrivalMin)}</span> },
                ]}
              />
            )}
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Server size={15} color={C.purple} />
              <span style={{ fontWeight: 600 }}>{t('techOps.deviceMatrix')}</span>
              <span style={{ fontSize: 12, color: C.textLight }}>{t('techOps.deviceCount', { count: optQueue?.devices.length ?? 0 })}</span>
            </div>
            {!optQueue ? (
              <Empty description={t('techOps.loadQueueHint')} style={{ color: C.textMid }} />
            ) : (
              <DataTable
                dataSource={optQueue.devices}
                rowKey={(d) => d.id}
                pagination={false}
                showExport={false}
                showDensity={false}
                columns={[
                  { title: t('techOps.thDevice'), key: 'name', render: (_v, d) => <span style={{ color: C.text }}>{d.name}</span> },
                  { title: t('techOps.thModality'), key: 'modality', render: (_v, d) => <Tag color={MODALITY_COLORS[d.modality]}>{d.modality}</Tag> },
                  { title: t('techOps.thTech'), key: 'technician', render: (_v, d) => <span style={{ color: C.textMid }}>{d.technician}</span> },
                  {
                    title: t('techOps.thAvailable'), key: 'availableFrom',
                    render: (_v, d) => (
                      <span style={{ color: d.availableFrom > 0 ? C.orange : C.green }}>
                        {d.availableFrom > 0 ? t('techOps.occupied', { time: fmtMin(d.availableFrom) }) : t('techOps.availableNow')}
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </div>
        </div>

        {optResult && (
          <>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 160, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px' }}>
                <div style={{ fontSize: 12, color: C.textMid, marginBottom: 8 }}>{t('techOps.waitBefore')}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: C.red }}>{t('techOps.minUnit', { count: optResult.totalWaitBefore })}</div>
              </div>
              <div style={{ flex: 1, minWidth: 160, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px' }}>
                <div style={{ fontSize: 12, color: C.textMid, marginBottom: 8 }}>{t('techOps.waitAfter')}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: C.green }}>{t('techOps.minUnit', { count: optResult.totalWaitAfter })}</div>
              </div>
              <div style={{ flex: 1, minWidth: 160, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px' }}>
                <div style={{ fontSize: 12, color: C.textMid, marginBottom: 8 }}>{t('techOps.waitReduce')}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: C.blue }}>{optResult.better ? `${optResult.improvementPct}%` : t('techOps.notImproved')}</div>
                <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>
                  {optResult.better ? t('techOps.savedMin', { count: Math.max(0, optResult.totalWaitBefore - optResult.totalWaitAfter) }) : t('techOps.sameAsBefore')}
                </div>
              </div>
            </div>

            {optResult.unassigned.length > 0 && (
              <div style={{ background: 'rgba(248,113,113,0.08)', border: `1px solid ${C.red}`, borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: C.red }}>
                <AlertTriangle size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                {t('techOps.unassignedWarn', { count: optResult.unassigned.length, list: optResult.unassigned.map((u) => `${u.patientName}(${u.modality})`).join('、') })}
              </div>
            )}

            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <BarChart3 size={15} color={C.blue} />
                <span style={{ fontWeight: 600 }}>{t('techOps.scheduleTitle')}</span>
                <span style={{ fontSize: 12, color: C.textLight }}>{t('techOps.assignCount', { count: assignments.length })}</span>
              </div>
              <DataTable
                dataSource={[...assignments].sort((a, b) => a.startMin - b.startMin)}
                rowKey={(a) => a.examId}
                pagination={false}
                showExport={false}
                showDensity={false}
                columns={[
                  { title: t('techOps.thStart'), key: 'startMin', render: (_v, a) => <span style={{ color: C.green, fontWeight: 600 }}>{fmtMin(a.startMin)}</span> },
                  { title: t('techOps.thEnd'), key: 'endMin', render: (_v, a) => <span style={{ color: C.textLight }}>{fmtMin(a.endMin)}</span> },
                  { title: t('techOps.thPatient'), key: 'patientName', render: (_v, a) => <span style={{ color: C.text }}>{a.patientName}</span> },
                  { title: t('techOps.thItem'), key: 'examItem', dataIndex: 'examItem' },
                  { title: t('techOps.thPriority'), key: 'priority', render: (_v, a) => <Tag color={PRIORITY_COLORS[a.priority]}>{priorityLabel(a.priority)}</Tag> },
                  {
                    title: t('techOps.thDevice'), key: 'device',
                    render: (_v, a) => (
                      <span style={{ whiteSpace: 'nowrap' }}>
                        <Tag color={MODALITY_COLORS[a.modality]}>{a.modality}</Tag>
                        {a.deviceName}
                      </span>
                    ),
                  },
                  { title: t('techOps.thTech'), key: 'technician', render: (_v, a) => <span style={{ color: C.textMid }}>{a.technician}</span> },
                  {
                    title: t('techOps.thWait'), key: 'waitMin', align: 'right' as const,
                    render: (_v, a) => (
                      <span style={{ color: a.waitMin === 0 ? C.green : a.waitMin <= 30 ? C.orange : C.red, fontWeight: 600 }}>
                        {a.waitMin === 0 ? t('techOps.immediate') : t('techOps.minUnit', { count: a.waitMin })}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </>
        )}
      </div>
    )
  }

  // ============================================================
  // 渲染 (render* 函数声明在上方, 因函数提升可在此引用)
  // ============================================================
  return (
    <div data-testid="tech-ops-page" style={{ background: C.bg, color: C.text, fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      {/* ================= 头部 ================= */}
      <div style={{ background: 'linear-gradient(135deg,var(--color-primary-800),var(--color-primary-950))', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LayoutGrid size={24} />
          <span style={{ fontSize: 20, fontWeight: 600 }}>{t('techOps.title')}</span>
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 10,
            background: dataSource === 'api' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.25)',
            color: dataSource === 'api' ? C.green : C.orange,
            border: `1px solid ${dataSource === 'api' ? 'var(--color-success)' : 'var(--color-warning)'}`,
          }}>
            {dataSource === 'api' ? t('techOps.apiLive') : t('techOps.demoData')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{t('techOps.subtitle')}</span>
          <span title={t('techOps.refreshData')} style={{ cursor: 'pointer', display: 'inline-flex' }} onClick={() => { void loadUtil(); void loadRecords() }}>
            <RefreshCw size={16} />
          </span>
        </div>
      </div>

      <Tabs
        style={{ padding: '0 24px' }}
        items={[
          {
            key: 'utilization',
            label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Activity size={14} />{t('techOps.tabUtilization')}</span>,
            children: renderUtilization(),
          },
          {
            key: 'emergency',
            label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Siren size={14} />{t('techOps.tabEmergency')}</span>,
            children: renderEmergency(),
          },
          {
            key: 'optimize',
            label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><BarChart3 size={14} />{t('techOps.tabOptimize')}</span>,
            children: renderOptimize(),
          },
        ]}
      />

      {/* ================= 插入确认弹窗 ================= */}
      <Modal
        open={confirmTarget !== null}
        title={<span style={{ color: C.text }}>{t('techOps.confirmInsertTitle')}</span>}
        onCancel={() => setConfirmTarget(null)}
        onOk={() => void handleInsert()}
        confirmLoading={confirmLoading}
        okText={t('techOps.confirmInsertOk')}
        cancelText={t('techOps.cancel')}
        styles={{ body: { background: C.panel }, header: { background: C.panel } }}
      >
        {confirmTarget && (
          <div style={{ fontSize: 13 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <Tag color={STRATEGY_COLORS[confirmTarget.strategy]}>{confirmTarget.strategyLabel}</Tag>
              <Tag color={MODALITY_COLORS[confirmTarget.modality]}>{confirmTarget.modality}</Tag>
              <span style={{ color: C.textMid }}>
                {t('techOps.confirmInfo', { device: confirmTarget.deviceName, time: fmtTime(confirmTarget.startAt), minutes: emgForm.durationMin })}
              </span>
            </div>
            {confirmTarget.conflictCount > 0 ? (
              <div style={{ color: C.orange, lineHeight: 1.7 }}>
                <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
                {t('techOps.conflictWarn', { count: confirmTarget.conflictCount })}
              </div>
            ) : (
              <div style={{ color: C.green }}>
                <CheckCircle2 size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
                {t('techOps.noConflictOk')}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ================= 插入结果弹窗 ================= */}
      <Modal
        open={insertResult !== null}
        title={<span style={{ color: C.text }}>{t('techOps.insertResultTitle')}</span>}
        footer={<Button size="small" onClick={() => setInsertResult(null)}>{t('techOps.close')}</Button>}
        onCancel={() => setInsertResult(null)}
        styles={{ body: { background: C.panel }, header: { background: C.panel } }}
      >
        {insertResult && (
          <div style={{ fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {insertResult.success
                ? <CheckCircle2 size={18} color={C.green} />
                : <XCircle size={18} color={C.red} />}
              <span style={{ color: insertResult.success ? C.green : C.red, fontWeight: 600 }}>{insertResult.message}</span>
            </div>
            {insertResult.conflicts.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ color: C.textMid, marginBottom: 6 }}>{t('techOps.conflictList')}</div>
                {insertResult.conflicts.map((c) => (
                  <div key={c.examId} style={{ background: 'var(--bg-primary)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{c.patientName} · {c.examItem} ({c.type === 'ONGOING' ? t('techOps.ongoing') : t('techOps.scheduled')})</span>
                    <span style={{ color: C.orange }}>{c.action === 'PREEMPT' ? t('techOps.preempt') : t('techOps.defer')} {t('techOps.overlapMin', { count: c.overlapMin })}</span>
                  </div>
                ))}
              </div>
            )}
            {insertResult.adjustments.length > 0 && (
              <div>
                <div style={{ color: C.textMid, marginBottom: 6 }}>{t('techOps.adjustPlan')}</div>
                <DataTable
                  dataSource={insertResult.adjustments}
                  rowKey={(a) => a.examId}
                  pagination={false}
                  showExport={false}
                  showDensity={false}
                  scroll={{ y: 220 }}
                  columns={[
                    { title: t('techOps.thExam'), key: 'patientName', dataIndex: 'patientName' },
                    { title: t('techOps.thOrigStart'), key: 'originalStartMin', render: (_v, a) => <span style={{ color: C.textLight }}>{fmtMin(a.originalStartMin)}</span> },
                    { title: t('techOps.thAfter'), key: 'suggestedStartMin', render: (_v, a) => <span style={{ color: C.orange }}>{fmtMin(a.suggestedStartMin)}</span> },
                    { title: t('techOps.thDevice'), key: 'suggestedDeviceName', dataIndex: 'suggestedDeviceName' },
                    {
                      title: t('techOps.thPlan'), key: 'action',
                      render: (_v, a) => (
                        <Tag color={a.action === 'MOVE_DEVICE' ? C.blue : C.orange}>
                          {a.action === 'MOVE_DEVICE' ? t('techOps.useSpare') : a.action === 'DEFER' ? t('techOps.defer') : t('techOps.keepUnchanged')}
                        </Tag>
                      ),
                    },
                  ]}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      <div style={{ padding: '0 24px' }}>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 12, color: C.textLight }}>
          {t('techOps.footnote')}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 本地演示建议 (API 不可用回退)
// ============================================================
function buildDemoSuggestions(form: { modality: string; deviceId: string; durationMin: number }): EmergencySuggestion[] {
  const mod = form.modality
  const dur = form.durationMin
  const devices = DEMO_DEVICES.filter((d) => (form.deviceId ? d.id === form.deviceId : d.modality === mod))
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const nowIso = new Date().toISOString()
  const list: EmergencySuggestion[] = []
  devices.forEach((d, i) => {
    const conflict = i === 0
    const start = nowMin + (i === 0 ? 0 : 12 + i * 6)
    list.push({
      id: `S-DEMO-${i}-1`,
      strategy: 'INSERT_NOW',
      strategyLabel: '当前进行中(抢占/顺延)',
      deviceId: d.id,
      deviceName: d.name,
      modality: d.modality,
      technician: d.technician,
      startMin: start,
      startAt: nowIso,
      endMin: start + dur,
      endAt: nowIso,
      startInMin: 0,
      waitMin: 0,
      conflictCount: conflict ? 1 : 0,
      conflicts: conflict ? [{ examId: `E-DEMO-${i}`, patientName: '周建国', examItem: `${mod}检查中`, type: 'ONGOING', startMin: start - 13, endMin: start + 12, overlapMin: dur, action: 'PREEMPT' }] : [],
      feasibility: conflict ? 'CONFLICT' : 'OK',
      note: conflict ? '当前有 1 项冲突, 进行中检查约 12 分钟后结束' : '当前设备空闲, 可立即插入',
    })
    list.push({
      id: `S-DEMO-${i}-2`,
      strategy: 'NEXT_FREE',
      strategyLabel: '最近空闲时段',
      deviceId: d.id,
      deviceName: d.name,
      modality: d.modality,
      technician: d.technician,
      startMin: start + 25,
      startAt: nowIso,
      endMin: start + 25 + dur,
      endAt: nowIso,
      startInMin: 25,
      waitMin: 25,
      conflictCount: 0,
      conflicts: [],
      feasibility: 'OK',
      note: `${fmtMin(start + 25)} 起空闲 ${dur} 分钟`,
    })
  })
  if (!form.deviceId) {
    const spare = DEMO_DEVICES.find((d) => d.spare && d.modality === mod)
    if (spare) {
      list.push({
        id: 'S-DEMO-SPARE',
        strategy: 'SPARE_DEVICE',
        strategyLabel: '启用备用设备',
        deviceId: spare.id,
        deviceName: spare.name,
        modality: spare.modality,
        technician: spare.technician,
        startMin: nowMin + 5,
        startAt: nowIso,
        endMin: nowMin + 5 + dur,
        endAt: nowIso,
        startInMin: 5,
        waitMin: 5,
        conflictCount: 0,
        conflicts: [],
        feasibility: 'OK',
        note: '备用设备, 正常启用',
      })
    }
  }
  return list.sort((a, b) => a.startInMin - b.startInMin)
}

// ============================================================
// 本地演示优化 (API 不可用回退, 与后端算法一致)
// ============================================================
function runLocalOptimize(queue: { exams: OptimizeExam[]; devices: OptimizeDevice[] }): OptimizeResult {
  const rank: Record<ExamPriority, number> = { STAT: 0, URGENT: 1, ROUTINE: 2 }
  const ordered = [...queue.exams].sort((a, b) => rank[a.priority] - rank[b.priority] || a.arrivalMin - b.arrivalMin || a.id.localeCompare(b.id))
  const comp = (e: OptimizeExam) => queue.devices.filter((d) => d.modality === e.modality)
  const run = (mode: 'naive' | 'greedy') => {
    const state = new Map<string, number>()
    for (const d of queue.devices) state.set(d.id, d.availableFrom)
    const out: OptimizeAssignment[] = []
    const unassigned: OptimizeExam[] = []
    for (const e of ordered) {
      const pool = comp(e)
      if (pool.length === 0) {
        unassigned.push(e)
        continue
      }
      let dev: OptimizeDevice
      if (mode === 'naive') {
        dev = pool[0]!
      } else {
        dev = [...pool].sort((a, b) => {
          const as = Math.max(state.get(a.id) ?? a.availableFrom, e.arrivalMin)
          const bs = Math.max(state.get(b.id) ?? b.availableFrom, e.arrivalMin)
          return as - bs || (state.get(a.id) ?? a.availableFrom) - (state.get(b.id) ?? b.availableFrom) || a.id.localeCompare(b.id)
        })[0]!
      }
      const start = Math.max(state.get(dev.id) ?? dev.availableFrom, e.arrivalMin)
      const end = start + e.durationMin
      state.set(dev.id, end)
      out.push({
        examId: e.id, patientName: e.patientName, examItem: e.examItem, modality: e.modality,
        priority: e.priority, durationMin: e.durationMin, arrivalMin: e.arrivalMin,
        deviceId: dev.id, deviceName: dev.name, technician: dev.technician,
        startMin: start, startAt: new Date().toISOString(), endMin: end, endAt: new Date().toISOString(),
        waitMin: Math.max(0, start - e.arrivalMin),
      })
    }
    return { out, unassigned }
  }
  const before = run('naive')
  const after = run('greedy')
  const w1 = before.out.reduce((a, x) => a + x.waitMin, 0)
  const w2 = after.out.reduce((a, x) => a + x.waitMin, 0)
  return {
    generatedAt: new Date().toISOString(),
    seeded: true,
    exams: queue.exams,
    devices: queue.devices,
    assignments: after.out,
    unassigned: after.unassigned,
    totalWaitBefore: w1,
    totalWaitAfter: w2,
    improvementPct: w1 > 0 ? Math.max(0, Math.round(((w1 - w2) / w1) * 100)) : 0,
    better: w2 <= w1,
  }
}
