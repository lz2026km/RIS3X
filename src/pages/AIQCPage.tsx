// G005 放射科RIS系统 - AI智能质控 v1.0.0
// @deprecated [v3.0.6.11-104 Wave 5A] 已内嵌为 QCPage 的「AI 智能质控」Tab; 旧路由 /ai-qc redirect → /qc?tab=ai。
//   文件保留仅作参考/回退，请勿在路由中直接挂载，新功能请改 QCPage。
// v1.0.4 (R4) 集成：跳转至 AIReportDraftPage 一键自动初稿
// [v3.0.6.11-75] W1-2: 接入 aiPlatformApi.listQcResults (GET /ai-platform/qc, 后端 auditLog resource=ai-qc)
import { useState, useEffect } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography, Tooltip } from 'antd'
import { aiPlatformApi } from '../services/api/aiPlatformApi'
import { DataTable } from '../components/common'
import { qcImageAiApi } from '../services/api/qcImageAiApi'
import type { QcAiAssessResult, QcAiAssessRecord } from '../services/api/qcImageAiApi'
import { t } from '../i18n/appI18n'

const { Title } = Typography
import {
  ShieldCheck, AlertTriangle, CheckCircle, Search, Filter,
  TrendingUp, Clock, X,
  Eye, Target, RefreshCw,
  Zap, Download,
  Brain, Bot, Scan, Gauge, MessageSquare, Wrench
} from 'lucide-react'

const PRIMARY = 'var(--color-primary-500)'
const PRIMARY_DARK = 'var(--color-primary-600)'
const SUCCESS = '#10b981'
const WARNING = 'var(--color-warning-500)'
const DANGER = 'var(--color-error-500)'
const GRAY = '#94a3b8'
const DARK_BG = '#0f172a'
const DARK_CARD = '#1e293b'
const DARK_BORDER = '#334155'
const WHITE = '#ffffff'

// 设备类型
const DEVICE_TYPES = ['CT-1（GE Revolution）', 'CT-2（西门子Force）', 'MR-1（西门子Vida）', 'MR-2（西门子Prisma）', 'DR-1（飞利浦）', 'DSA-1（飞利浦）', 'MG', 'PET-CT']

// 检查部位
const BODY_PARTS = ['头颅', '胸部', '腹部', '腰椎', '颈椎', '盆腔', '四肢', '心脏', '血管']

// 质控结果
const QC_RESULTS = ['合格', '警告', '不合格']

// 技师列表
const TECHNICIANS = ['张明', '李华', '王芳', '刘强', '陈静', '赵伟', '孙磊', '周涛']

// 模拟AI质控数据
interface AIQCRecord {
  id: string
  deviceType: string
  bodyPart: string
  patientName: string
  aiScore: number
  result: '合格' | '警告' | '不合格'
  technician: string
  date: string
  time: string
  confirmed: boolean
  confirmedTime: string | null
  issues: string | null
}

const generateAIQCData = () => {
  const data: AIQCRecord[] = []
  const baseDate = new Date('2026-05-03')
  
  for (let i = 0; i < 50; i++) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() - Math.floor(Math.random() * 30))
    const deviceType = DEVICE_TYPES[Math.floor(Math.random() * DEVICE_TYPES.length)]!
    const bodyPart = BODY_PARTS[Math.floor(Math.random() * BODY_PARTS.length)]!
    const aiScore = Math.floor(Math.random() * 40) + 60 // 60-100
    const technician = TECHNICIANS[Math.floor(Math.random() * TECHNICIANS.length)]!
    
    let result: '合格' | '警告' | '不合格'
    if (aiScore >= 85) result = '合格'
    else if (aiScore >= 70) result = '警告'
    else result = '不合格'
    
    const confirmed = Math.random() > 0.3
    const confirmedTime = confirmed ? new Date(date.getTime() + Math.random() * 3600000) : null
    
    data.push({
      id: `AIQC-${String(i + 1).padStart(4, '0')}`,
      deviceType,
      bodyPart,
      patientName: ['张三', '李四', '王五', '赵六', '刘七', '陈八', '杨九', '周十'][Math.floor(Math.random() * 8)]!,
      aiScore,
      result,
      technician,
      date: date.toISOString().split('T')[0]!,
      time: date.toTimeString().slice(0, 5),
      confirmed,
      confirmedTime: confirmedTime ? confirmedTime.toISOString().replace('T', ' ').slice(0, 16) : null,
      issues: aiScore < 80 ? ['运动伪影', '曝光不当', '体位不正', '对比剂不足'][Math.floor(Math.random() * 4)]! : null,
    })
  }
  return data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

const AI_QC_DATA = generateAIQCData()

type AssessRow = QcAiAssessResult & { verdict?: string }

// [v3.0.6.11-75] 归一化后端 /ai-platform/qc 记录 (auditLog: detail 为 JSON 负载)
const normalizeQcRow = (item: { id?: string; detail?: unknown; createdAt?: string }) => {
  const d = (item?.detail && typeof item.detail === 'object' ? item.detail : {}) as Record<string, any>
  const createdAt = item?.createdAt ? String(item.createdAt) : ''
  const aiScore = Number(d.aiScore ?? d.score ?? 90)
  const result = d.result ?? (aiScore >= 85 ? '合格' : aiScore >= 70 ? '警告' : '不合格')
  return {
    id: item?.id ?? `AIQC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    deviceType: d.deviceType ?? d.device ?? d.modality ?? 'AI 平台',
    bodyPart: d.bodyPart ?? d.bodyPartName ?? '—',
    patientName: d.patientName ?? d.patient ?? '—',
    aiScore,
    result,
    technician: d.technician ?? d.operatorName ?? '—',
    date: createdAt.slice(0, 10) || d.date || '2026-05-03',
    time: createdAt.slice(11, 16) || d.time || '00:00',
    confirmed: Boolean(d.confirmed),
    confirmedTime: d.confirmedTime ?? null,
    issues: d.issues ?? null,
  }
}

// 统计卡片数据
const getStats = () => {
  const today = '2026-05-03'
  const todayData = AI_QC_DATA.filter(d => d.date === today)
  const todayComplete = todayData.length
  const qualifiedRate = Math.round((AI_QC_DATA.filter(d => d.result === '合格').length / AI_QC_DATA.length) * 100)
  const issuesFound = AI_QC_DATA.filter(d => d.result !== '合格').length
  const feedbackRate = Math.round((AI_QC_DATA.filter(d => d.confirmed).length / AI_QC_DATA.length) * 100)
  
  return { todayComplete, qualifiedRate, issuesFound, feedbackRate }
}

const STATS = getStats()

// AI评分颜色
const getScoreColor = (score: number) => {
  if (score >= 90) return SUCCESS
  if (score >= 80) return 'var(--color-success-500)'
  if (score >= 70) return WARNING
  if (score >= 60) return '#f97316'
  return DANGER
}

// AI评分标签
const getScoreLabel = (score: number) => {
  if (score >= 90) return t('aiQcPage.scoreExcellent')
  if (score >= 80) return t('aiQcPage.scoreGood')
  if (score >= 70) return t('aiQcPage.scoreFair')
  if (score >= 60) return t('aiQcPage.scorePoor')
  return t('aiQcPage.scoreBad')
}

export default function AIQCPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [deviceFilter, setDeviceFilter] = useState('全部')
  const [resultFilter, setResultFilter] = useState('全部')
  const [technicianFilter, setTechnicianFilter] = useState('全部')
  const [dateRange, setDateRange] = useState({ start: '2026-04-01', end: '2026-05-03' })
  const [selectedRecord, setSelectedRecord] = useState<typeof AI_QC_DATA[0] | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 15

  // [v3.0.6.11-75] 真实数据: GET /ai-platform/qc (后端 auditLog resource=ai-qc) + 本地生成兜底
  const [mergedData, setMergedData] = useState<typeof AI_QC_DATA>(() => AI_QC_DATA.slice())
  const [apiLoading, setApiLoading] = useState(true)
  const [apiError, setApiError] = useState('')

  // [G005 Wave4A] G-24 三维度评估: POST /qc/image-ai/assess (后端确定性 seed, 无 DB 可跑)
  const [dimAssessments, setDimAssessments] = useState<AssessRow[]>([])
  const [assessStudyId, setAssessStudyId] = useState('EX-5001')
  const [assessing, setAssessing] = useState(false)
  const [assessError, setAssessError] = useState('')

  // [G005 2B] SAMPLE_ASSESS_IDS 保留: 仅用于「刷新示例」按钮批量评估演示用途
  const SAMPLE_ASSESS_IDS = ['EX-5001', 'EX-5002', 'EX-5003']

  // [G005 Wave3A P16] G-24 深化: 历史趋势 / 批量评估 / CSV 导出 / 阈值配置
  const THRESHOLD_KEY = 'g005.aiqc.thresholds.v1'
  const DEFAULT_THRESHOLDS = { artifact: 80, exposure: 80, positioning: 80, overall: 80 }
  const [thresholds, setThresholds] = useState<typeof DEFAULT_THRESHOLDS>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(THRESHOLD_KEY) ?? 'null')
      return { ...DEFAULT_THRESHOLDS, ...(saved ?? {}) }
    } catch {
      return DEFAULT_THRESHOLDS
    }
  })
  const [assessHistory, setAssessHistory] = useState<QcAiAssessRecord[]>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [showTrend, setShowTrend] = useState(false)
  const [batchIds, setBatchIds] = useState('EX-5001,EX-5002,EX-5003')
  const [batchResults, setBatchResults] = useState<(QcAiAssessResult & { verdict: string })[]>([])
  const [batchAssessing, setBatchAssessing] = useState(false)

  useEffect(() => {
    localStorage.setItem(THRESHOLD_KEY, JSON.stringify(thresholds))
  }, [thresholds])

  // 维度通过阈值判定: score >= 阈值 通过; >= 阈值-10 告警; 否则失败
  const dimVerdict = (score: number, threshold: number): string => {
    if (score >= threshold) return '通过'
    if (score >= threshold - 10) return '告警'
    return '失败'
  }
  const overallVerdict = (a: QcAiAssessResult): string => {
    const dims = [
      dimVerdict(a.artifact.score, thresholds.artifact),
      dimVerdict(a.exposure.score, thresholds.exposure),
      dimVerdict(a.positioning.score, thresholds.positioning),
    ]
    if (dims.includes('失败')) return '失败'
    if (dims.includes('告警') || a.overall.score < thresholds.overall) return '告警'
    return '通过'
  }
  const verdictColor = (v: string) => (v === '通过' ? SUCCESS : v === '告警' ? WARNING : DANGER)

  const updateThreshold = (key: keyof typeof DEFAULT_THRESHOLDS) => (e: ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(50, Math.min(100, Number(e.target.value) || 0))
    setThresholds((prev) => ({ ...prev, [key]: v }))
  }

  const loadAssessHistory = async (silent = false) => {
    if (!silent) setTrendLoading(true)
    try {
      const res = await qcImageAiApi.listAssessments({ pageSize: 100 })
      if (res.success && Array.isArray(res.data)) {
        setAssessHistory(res.data)
      }
    } catch (e) {
      console.warn('[AIQC] loadAssessHistory failed', e)
    } finally {
      setTrendLoading(false)
    }
  }

  // 按日期聚合历史评估 (伪影/曝光/体位/总分 日均)
  const trendData = (() => {
    const byDate: Record<string, { artifact: number; exposure: number; positioning: number; overall: number; n: number }> = {}
    for (const r of assessHistory) {
      const d = (r.assessedAt ?? '').slice(0, 10)
      let entry = byDate[d]
      if (!entry) { entry = { artifact: 0, exposure: 0, positioning: 0, overall: 0, n: 0 }; byDate[d] = entry }
      entry.artifact += r.artifact.score
      entry.exposure += r.exposure.score
      entry.positioning += r.positioning.score
      entry.overall += r.overall.score
      entry.n += 1
    }
    return Object.entries(byDate)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, v]) => ({
        date,
        artifact: Math.round(v.artifact / v.n),
        exposure: Math.round(v.exposure / v.n),
        positioning: Math.round(v.positioning / v.n),
        overall: Math.round(v.overall / v.n),
      }))
  })()

  const renderTrendChart = () => {
    const w = 760
    const h = 190
    const pad = 36
    const min = 50
    const max = 100
    const xs = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, trendData.length - 1)
    const ys = (v: number) => h - pad - ((v - min) / (max - min)) * (h - pad * 2)
    const series: { key: 'artifact' | 'exposure' | 'positioning' | 'overall'; color: string; label: string }[] = [
      { key: 'artifact', color: WARNING, label: t('aiQcPage.artifact') },
      { key: 'exposure', color: PRIMARY, label: t('aiQcPage.exposure') },
      { key: 'positioning', color: '#a855f7', label: t('aiQcPage.positioning') },
      { key: 'overall', color: SUCCESS, label: t('aiQcPage.overallScore') },
    ]
    return (
      <div style={{ padding: '0 20px 16px' }}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', background: DARK_BG, borderRadius: 8 }}>
          {[60, 70, 80, 90].map((g) => (
            <g key={g}>
              <line x1={pad} y1={ys(g)} x2={w - pad} y2={ys(g)} stroke={DARK_BORDER} strokeDasharray="3 3" />
              <text x={pad - 6} y={ys(g) + 4} fill={GRAY} fontSize={10} textAnchor="end">{g}</text>
            </g>
          ))}
          {trendData.map((d, i) => (
            <text key={i} x={xs(i)} y={h - 10} fill={GRAY} fontSize={9} textAnchor="middle">{d.date.slice(5)}</text>
          ))}
          {series.map((s) => (
            <polyline
              key={s.key}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              points={trendData.map((d, i) => `${xs(i)},${ys(d[s.key])}`).join(' ')}
            />
          ))}
        </svg>
        <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', marginTop: 'var(--space-2, 8px)', justifyContent: 'center' }}>
          {series.map((s) => (
            <span key={s.key} style={{ fontSize: 12, color: GRAY, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 3, background: s.color, display: 'inline-block' }} />
              {s.label}
            </span>
          ))}
          {trendLoading && <span style={{ fontSize: 12, color: GRAY }}>{t('aiQcPage.syncing')}</span>}
        </div>
      </div>
    )
  }

  // 批量评估: 多检查号逐条 assess -> 结果表 (通过/告警/失败)
  const handleBatchAssess = async () => {
    const ids = batchIds.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean)
    if (ids.length === 0 || batchAssessing) return
    setBatchAssessing(true)
    setAssessError('')
    const results: (QcAiAssessResult & { verdict: string })[] = []
    for (const id of ids) {
      try {
        const res = await qcImageAiApi.assess({ studyId: id })
        if (res.success && res.data) results.push({ ...res.data, verdict: overallVerdict(res.data) })
      } catch (e) {
        console.warn(`[AIQC] batch assess ${id} failed`, e)
      }
    }
    setBatchResults(results)
    if (results.length > 0) {
      setDimAssessments((prev) => {
        const merged: AssessRow[] = [...results]
        for (const p of prev) {
          if (!results.some((r) => r.studyId === p.studyId)) merged.push(p)
        }
        return merged
      })
      void loadAssessHistory(true)
    } else {
      setAssessError(t('aiQcPage.batchNoReturn'))
    }
    setBatchAssessing(false)
  }

  // 三维度评分结果导出 CSV (真实 Blob)
  const exportAssessCsv = () => {
    const rows: AssessRow[] = batchResults.length > 0 ? batchResults : dimAssessments
    if (rows.length === 0) {
      setAssessError(t('aiQcPage.noResultToExport'))
      return
    }
    const head = ['检查号', '模态', '部位', '时间', '伪影分', '伪影结论', '曝光分', '曝光结论', '体位分', '体位结论', '总分', '总评']
    const lines = rows.map((r) => [
      r.studyId,
      r.modality,
      r.bodyPart,
      (r.assessedAt ?? '').slice(0, 19).replace('T', ' '),
      r.artifact.score,
      dimVerdict(r.artifact.score, thresholds.artifact),
      r.exposure.score,
      dimVerdict(r.exposure.score, thresholds.exposure),
      r.positioning.score,
      dimVerdict(r.positioning.score, thresholds.positioning),
      r.overall.score,
      r.verdict ?? overallVerdict(r),
    ])
    const csv = [head, ...lines]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'AI三维度质控评估.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const runAssess = async (studyId: string) => {
    setAssessing(true)
    setAssessError('')
    try {
      const res = await qcImageAiApi.assess({ studyId })
      if (!res.success) {
        setAssessError(res.error?.message ?? t('aiQcPage.assessFailed'))
        return null
      }
      return res.data
    } catch (e) {
      setAssessError((e as Error)?.message ?? t('aiQcPage.assessFailed'))
      return null
    } finally {
      setAssessing(false)
    }
  }

  const loadAssessments = async (ids: string[]) => {
    setAssessing(true)
    try {
      const results: QcAiAssessResult[] = []
      for (const id of ids) {
        const res = await qcImageAiApi.assess({ studyId: id })
        if (res.success && res.data) results.push(res.data)
      }
      setDimAssessments(results.length > 0 ? results : dimAssessments)
      if (results.length === 0) setAssessError(t('aiQcPage.assessNoReturn'))
      else setAssessError('')
    } catch (e) {
      setAssessError((e as Error)?.message ?? t('aiQcPage.assessLoadFailed'))
    } finally {
      setAssessing(false)
    }
  }

  const handleManualAssess = async () => {
    const data = await runAssess(assessStudyId)
    if (data) {
      setDimAssessments(prev => [data, ...prev.filter(a => a.studyId !== data.studyId)])
    }
  }

  useEffect(() => {
    void loadAssessments(SAMPLE_ASSESS_IDS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadApiQc = async (silent = false) => {
    if (!silent) setApiLoading(true)
    try {
      const res = await aiPlatformApi.listQcResults()
      if (!res.success) {
        setApiError(res.error?.message ?? t('aiQcPage.dataLoadFailed'))
        return
      }
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
      const rows = raw.map(normalizeQcRow).filter(Boolean)
      if (rows.length > 0) {
        // [G005 2B] 接口成功只展示真实数据, 演示数据仅失败回退 (初始态 AI_QC_DATA)
        setMergedData(rows)
        setApiError('')
      } else if (!silent) {
        setApiError(t('aiQcPage.emptyFallbackDemo'))
      }
    } catch (e) {
      setApiError((e as Error)?.message ?? t('aiQcPage.dataLoadFailed'))
    } finally {
      setApiLoading(false)
    }
  }

  useEffect(() => {
    void loadApiQc()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(() => void loadApiQc(true), 30000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh])

  // [v3.0.6.11-98 Wave3B P1] 确认质控: 后端暂无确认端点 (qcImageAiApi 无 confirm/review 方法,
  //   backend/src/modules/qc/image-ai.controller 仅 score / assess / assessments / stats)。
  //   原实现为「本地改状态 + 成功 toast」的虚假成功, 已移除; 详情弹窗确认按钮改为
  //   Tooltip + disabled, 待后端提供确认接口后再接入真实调用。

  // 筛选数据
  const filteredData = mergedData.filter(item => {
    const matchSearch = !search || item.patientName.includes(search) || item.id.includes(search) || item.deviceType.includes(search)
    const matchDevice = deviceFilter === '全部' || item.deviceType === deviceFilter
    const matchResult = resultFilter === '全部' || item.result === resultFilter
    const matchTechnician = technicianFilter === '全部' || item.technician === technicianFilter
    const matchDate = item.date >= dateRange.start && item.date <= dateRange.end
    return matchSearch && matchDevice && matchResult && matchTechnician && matchDate
  })

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE))
  const pagedData = filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // 筛选条件变化时回到第 1 页
  useEffect(() => { setCurrentPage(1) }, [search, deviceFilter, resultFilter, technicianFilter, dateRange])

  // 数据变少时页码越界自动收敛
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  // [v3.0.6.11-75] 统计基于真实+演示合并数据实时计算
  const liveStats = {
    todayComplete: mergedData.filter(d => d.date === dateRange.end || d.date === '2026-05-03').length || STATS.todayComplete,
    qualifiedRate: Math.round((mergedData.filter(d => d.result === '合格').length / Math.max(1, mergedData.length)) * 100),
    issuesFound: mergedData.filter(d => d.result !== '合格').length,
    feedbackRate: Math.round((mergedData.filter(d => d.confirmed).length / Math.max(1, mergedData.length)) * 100),
  }

  // 统计卡片
  const statCards = [
    {
      label: t('aiQcPage.todayCompleted'),
      value: liveStats.todayComplete,
      unit: t('aiQcPage.cases'),
      icon: <CheckCircle size={22} />,
      bg: 'var(--color-primary-800)',
      color: PRIMARY,
      trend: '+12%',
      trendUp: true,
    },
    {
      label: t('aiQcPage.passRate'),
      value: liveStats.qualifiedRate,
      unit: '%',
      icon: <ShieldCheck size={22} />,
      bg: '#1a3d2e',
      color: SUCCESS,
      trend: '+2.3%',
      trendUp: true,
    },
    {
      label: t('aiQcPage.issuesFound'),
      value: liveStats.issuesFound,
      unit: t('aiQcPage.cases'),
      icon: <AlertTriangle size={22} />,
      bg: '#3d2a1a',
      color: WARNING,
      trend: '-5例',
      trendUp: true,
    },
    {
      label: t('aiQcPage.techFeedbackRate'),
      value: liveStats.feedbackRate,
      unit: '%',
      icon: <MessageSquare size={22} />,
      bg: '#2e1a3d',
      color: '#a855f7',
      trend: '+8%',
      trendUp: true,
    },
  ]

  // AI评分进度条组件
  const ScoreBar = ({ score }: { score: number }) => {
    const color = getScoreColor(score)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
        <div style={{
          flex: 1,
          height: 8,
          background: '#334155',
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${score}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
            borderRadius: 4,
            transition: 'width 0.5s ease',
            boxShadow: `0 0 8px ${color}66`,
          }} />
        </div>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color,
          minWidth: 36,
          textAlign: 'right',
        }}>{score}</span>
      </div>
    )
  }

  // 质控结果标签
  const ResultBadge = ({ result }: { result: string }) => {
    const colors: Record<string, { bg: string; color: string }> = {
      '合格': { bg: '#065f46', color: SUCCESS },
      '警告': { bg: '#92400e', color: WARNING },
      '不合格': { bg: '#991b1b', color: DANGER },
    }
    const c = colors[result] ?? colors['警告']!
    return (
      <span style={{
        padding: '3px 10px',
        borderRadius: 12,
        background: c.bg,
        color: c.color,
        fontSize: 12,
        fontWeight: 600,
      }}>
        {result}
      </span>
    )
  }

  // 确认状态
  const ConfirmStatus = ({ confirmed, time: _time }: { confirmed: boolean; time: string | null }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {confirmed ? (
        <>
          <CheckCircle size={16} color={SUCCESS} />
          <span style={{ color: SUCCESS, fontSize: 12 }}>{t('aiQcPage.confirmed')}</span>
        </>
      ) : (
        <>
          <Clock size={16} color={GRAY} />
          <span style={{ color: GRAY, fontSize: 12 }}>{t('aiQcPage.pendingConfirm')}</span>
        </>
      )}
    </div>
  )

  const handleViewDetail = (record: typeof AI_QC_DATA[0]) => {
    setSelectedRecord(record)
    setShowDetail(true)
  }

  return (
    <div style={{
      padding: 'var(--space-6, 24px)',
      maxWidth: 1600,
      margin: '0 auto',
      background: DARK_BG, color: WHITE,
    }}>
      {/* [v1.0.4 R4] 升级入口横幅 */}
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, var(--color-primary-500) 100%)',
        borderRadius: 10, padding: 'var(--space-3, 12px)', marginBottom: 'var(--space-4, 16px)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)',
      }}>
        <div style={{ fontSize: 18 }}></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
            {t('aiQcPage.bannerTitle')}
          </div>
          <div style={{ fontSize: 12, color: '#e0e7ff', marginTop: 2 }}>
            {t('aiQcPage.bannerDesc')}
          </div>
        </div>
        <button
          onClick={() => navigate('/ai-report-draft')}
          style={{
            padding: '6px 12px', border: 'none', borderRadius: 4,
            background: 'var(--bg-card)', color: '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
          }}
        >
          {t('aiQcPage.oneClickDraft')}
        </button>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6, 24px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)' }}>
            <div style={{
              width: 40,
              height: 40,
              background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 12px ${PRIMARY}44`,
            }}>
              <Brain size={22} color="#fff" />
            </div>
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {t('aiQcPage.heading')}
              </Title>
              <p style={{ fontSize: 12, color: GRAY, margin: 0 }}>
                {t('aiQcPage.subtitle')} {apiLoading ? t('aiQcPage.syncing') : ''}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => void loadApiQc()}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: `1px solid ${PRIMARY}`,
                background: `${PRIMARY}22`,
                color: PRIMARY,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw size={14} className={apiLoading ? 'spin-icon' : ''} />
              {t('aiQcPage.syncAiPlatform')}
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: `1px solid ${autoRefresh ? PRIMARY : DARK_BORDER}`,
                background: autoRefresh ? `${PRIMARY}22` : 'transparent',
                color: autoRefresh ? PRIMARY : GRAY,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw size={14} style={{ animation: autoRefresh ? 'spin 1s linear infinite' : 'none' }} />
              {t('aiQcPage.autoRefresh')}
            </button>
            <button
              onClick={() => { const csv = 'AI质控报表\n记录数,合格率,需重审数,采纳率\n' + mergedData.length + ',' + liveStats.qualifiedRate + '%,' + liveStats.issuesFound + ',' + liveStats.feedbackRate + '%'; const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'AI质控报表.csv'; a.click(); URL.revokeObjectURL(url); }}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
                color: WHITE,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Download size={14} />
              {t('aiQcPage.exportReport')}
            </button>
          </div>
        </div>
        {apiError && (
          <div style={{
            marginTop: 'var(--space-3, 12px)',
            padding: '10px 14px',
            borderRadius: 8,
            border: `1px solid ${WARNING}66`,
            background: `${WARNING}14`,
            color: 'var(--color-warning-400)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>{apiError}{t('aiQcPage.continueDemo')}</span>
            <button onClick={() => { setApiError(''); void loadApiQc() }} style={{ background: 'transparent', border: 'none', color: 'var(--color-warning-400)', cursor: 'pointer', fontSize: 12 }}>{t('aiQcPage.retry')}</button>
          </div>
        )}
      </div>

      {/* 统计卡片 - v3.0.6.8-23c (A8-P0-4): auto-fit 响应式 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 'var(--space-4, 16px)',
        marginBottom: 'var(--space-6, 24px)',
      }}>
        {statCards.map((card, idx) => (
          <div
            key={idx}
            style={{
              background: DARK_CARD,
              borderRadius: 12,
              padding: 'var(--space-5, 20px)',
              border: `1px solid ${DARK_BORDER}`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 80,
              height: 80,
              background: `${card.color}11`,
              borderRadius: '50%',
            }} />
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-3, 12px)',
            }}>
              <div style={{
                width: 44,
                height: 44,
                background: card.bg,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: card.color,
              }}>
                {card.icon}
              </div>
              <span style={{
                fontSize: 12,
                color: card.trendUp ? SUCCESS : DANGER,
                background: card.trendUp ? '#065f4622' : '#991b1b22',
                padding: '2px 8px',
                borderRadius: 10,
              }}>
                {card.trend}
              </span>
            </div>
            <div style={{ fontSize: 12, color: GRAY, marginBottom: 'var(--space-1, 4px)' }}>{card.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-1, 4px)' }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: WHITE }}>{card.value}</span>
              <span style={{ fontSize: 14, color: GRAY }}>{card.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 多维筛选区域 */}
      <div style={{
        background: DARK_CARD,
        borderRadius: 12,
        padding: 'var(--space-5, 20px)',
        border: `1px solid ${DARK_BORDER}`,
        marginBottom: 'var(--space-5, 20px)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-4, 16px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
            <Filter size={16} color={PRIMARY} />
            <span style={{ fontSize: 14, fontWeight: 600, color: WHITE }}>{t('aiQcPage.multiFilter')}</span>
          </div>
          <button
            onClick={() => {
              setSearch('')
              setDeviceFilter('全部')
              setResultFilter('全部')
              setTechnicianFilter('全部')
              setDateRange({ start: '2026-04-01', end: '2026-05-03' })
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: GRAY,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1, 4px)',
            }}
          >
            <RefreshCw size={12} /> {t('aiQcPage.reset')}
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr',
          gap: 'var(--space-3, 12px)',
          alignItems: 'center',
        }}>
          {/* 搜索框 */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: GRAY }} />
            <input
              type="text"
              placeholder={t('aiQcPage.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 38px',
                borderRadius: 8,
                border: `1px solid ${DARK_BORDER}`,
                background: DARK_BG,
                color: WHITE,
                fontSize: 12, boxSizing: 'border-box',
              }}
            />
          </div>

          {/* 设备类型 */}
          <select
            value={deviceFilter}
            onChange={e => setDeviceFilter(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${DARK_BORDER}`,
              background: DARK_BG,
              color: WHITE,
              fontSize: 12, cursor: 'pointer',
            }}
          >
            <option value="全部">{t('aiQcPage.allDevices')}</option>
            {DEVICE_TYPES.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* 质控结果 */}
          <select
            value={resultFilter}
            onChange={e => setResultFilter(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${DARK_BORDER}`,
              background: DARK_BG,
              color: WHITE,
              fontSize: 12, cursor: 'pointer',
            }}
          >
            <option value="全部">{t('aiQcPage.allResults')}</option>
            {QC_RESULTS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* 技师 */}
          <select
            value={technicianFilter}
            onChange={e => setTechnicianFilter(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${DARK_BORDER}`,
              background: DARK_BG,
              color: WHITE,
              fontSize: 12, cursor: 'pointer',
            }}
          >
            <option value="全部">{t('aiQcPage.allTechnicians')}</option>
            {TECHNICIANS.map(tech => (
              <option key={tech} value={tech}>{tech}</option>
            ))}
          </select>

          {/* 日期范围 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
            <input
              type="date"
              value={dateRange.start}
              onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${DARK_BORDER}`,
                background: DARK_BG,
                color: WHITE,
                fontSize: 12, }}
            />
            <span style={{ color: GRAY }}>{t('aiQcPage.to')}</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${DARK_BORDER}`,
                background: DARK_BG,
                color: WHITE,
                fontSize: 12, }}
            />
          </div>
        </div>
      </div>

      {/* [G005 Wave4A] G-24 三维度自动质控区块: 伪影/曝光/体位 + 总评分 + 问题列表 */}
      <div style={{
        background: DARK_CARD,
        borderRadius: 12,
        border: `1px solid ${DARK_BORDER}`,
        marginBottom: 'var(--space-5, 20px)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${DARK_BORDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
            <Gauge size={16} color={PRIMARY} />
            <span style={{ fontSize: 14, fontWeight: 600, color: WHITE }}>{t('aiQcPage.autoQc3d')}</span>
            <span style={{ fontSize: 12, color: GRAY }}>{t('aiQcPage.autoQc3dDesc')}</span>
            {assessing && <span style={{ fontSize: 12, color: GRAY }}>{t('aiQcPage.assessing')}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
            <input
              type="text"
              value={assessStudyId}
              onChange={e => setAssessStudyId(e.target.value)}
              placeholder={t('aiQcPage.enterStudyId')}
              style={{
                width: 150,
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${DARK_BORDER}`,
                background: DARK_BG,
                color: WHITE,
                fontSize: 12, }}
            />
            <button
              onClick={() => void handleManualAssess()}
              disabled={assessing}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
                color: WHITE,
                fontSize: 12,
                fontWeight: 600,
                cursor: assessing ? 'not-allowed' : 'pointer',
                opacity: assessing ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Scan size={14} /> {t('aiQcPage.assessStudy')}
            </button>
            <button
              onClick={() => void loadAssessments(SAMPLE_ASSESS_IDS)}
              disabled={assessing}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: `1px solid ${PRIMARY}`,
                background: `${PRIMARY}22`,
                color: PRIMARY,
                fontSize: 12,
                cursor: assessing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw size={14} /> {t('aiQcPage.refreshSamples')}
            </button>
          </div>
        </div>
        {/* [G005 Wave3A P16] 深化工具栏: 阈值配置 / 批量评估 / CSV 导出 / 历史趋势 */}
        <div style={{
          padding: '12px 20px',
          borderBottom: `1px solid ${DARK_BORDER}`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          background: DARK_BG,
        }}>
          <span style={{ fontSize: 12, color: GRAY, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
            <Target size={13} /> {t('aiQcPage.passThreshold')}
          </span>
          {([
            { key: 'artifact', label: t('aiQcPage.artifact') },
            { key: 'exposure', label: t('aiQcPage.exposure') },
            { key: 'positioning', label: t('aiQcPage.positioning') },
            { key: 'overall', label: t('aiQcPage.overallScore') },
          ] as { key: keyof typeof DEFAULT_THRESHOLDS; label: string }[]).map(({ key, label }) => (
            <label key={key} style={{ fontSize: 12, color: GRAY, display: 'flex', alignItems: 'center', gap: 5 }}>
              {label}
              <input
                type="number"
                min={50}
                max={100}
                value={thresholds[key]}
                onChange={updateThreshold(key)}
                style={{
                  width: 58,
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: `1px solid ${DARK_BORDER}`,
                  background: DARK_CARD,
                  color: WHITE,
                  fontSize: 12, }}
              />
            </label>
          ))}
          <div style={{ flex: 1 }} />
          <input
            type="text"
            value={batchIds}
            onChange={(e) => setBatchIds(e.target.value)}
            placeholder={t('aiQcPage.batchPlaceholder')}
            style={{
              width: 200,
              padding: '7px 10px',
              borderRadius: 6,
              border: `1px solid ${DARK_BORDER}`,
              background: DARK_CARD,
              color: WHITE,
              fontSize: 12, }}
          />
          <button
            onClick={() => void handleBatchAssess()}
            disabled={batchAssessing}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: 'none',
              background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
              color: WHITE,
              fontSize: 12,
              fontWeight: 600,
              cursor: batchAssessing ? 'not-allowed' : 'pointer',
              opacity: batchAssessing ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Zap size={13} /> {t('aiQcPage.batchAssess')} {batchAssessing && t('aiQcPage.inProgress')}
          </button>
          <button
            onClick={exportAssessCsv}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: 'none',
              background: `linear-gradient(135deg, ${SUCCESS}, #059669)`,
              color: WHITE,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Download size={13} /> {t('aiQcPage.exportCsv')}
          </button>
          <button
            onClick={() => { setShowTrend((v) => !v); if (!assessHistory.length) void loadAssessHistory() }}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: `1px solid ${showTrend ? PRIMARY : DARK_BORDER}`,
              background: showTrend ? `${PRIMARY}22` : 'transparent',
              color: showTrend ? PRIMARY : GRAY,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <TrendingUp size={13} /> {t('aiQcPage.historyTrend')}
          </button>
        </div>
        {showTrend && (
          <div style={{ borderBottom: `1px solid ${DARK_BORDER}` }}>
            <div style={{ padding: '12px 20px 4px', fontSize: 12, color: GRAY }}>
              {t('aiQcPage.historyTrendDesc', { count: assessHistory.length })}
            </div>
            {trendData.length > 0 ? renderTrendChart() : (
              <div style={{ padding: '24px', textAlign: 'center', color: GRAY, fontSize: 12 }}>
                {trendLoading ? t('aiQcPage.trendSyncing') : t('aiQcPage.noHistory')}
              </div>
            )}
          </div>
        )}
        {batchResults.length > 0 && (
          <div style={{ borderBottom: `1px solid ${DARK_BORDER}`, padding: '14px 20px', overflowX: 'auto' }}>
            <div style={{ fontSize: 12, color: GRAY, marginBottom: 'var(--space-2, 8px)', display: 'flex', gap: 14, alignItems: 'center' }}>
              <span>{t('aiQcPage.batchResults', { count: batchResults.length })}</span>
              {([['通过', 'aiQcPage.verdictPass'], ['告警', 'aiQcPage.verdictWarn'], ['失败', 'aiQcPage.verdictFail']] as [string, string][]).map(([v, k]) => (
                <span key={v} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: verdictColor(v) }} /> {t(k)}
                </span>
              ))}
            </div>
            <DataTable
              dataSource={batchResults}
              rowKey="studyId"
              pagination={false}
              columns={[
                { title: t('aiQcPage.studyId'), dataIndex: 'studyId', render: (v: string) => <span style={{ fontSize: 12, color: PRIMARY }}>{v}</span> },
                { title: t('aiQcPage.modality'), dataIndex: 'modality', render: (v: string) => <span style={{ fontSize: 12, color: WHITE }}>{v}</span> },
                { title: t('aiQcPage.bodyPart'), dataIndex: 'bodyPart', render: (v: string) => <span style={{ fontSize: 12, color: WHITE }}>{v}</span> },
                {
                  title: t('aiQcPage.artifact'), key: 'artifact',
                  render: (_: unknown, r: QcAiAssessResult & { verdict: string }) => {
                    const v = dimVerdict(r.artifact.score, thresholds.artifact)
                    return <span style={{ fontSize: 12, color: verdictColor(v) }}>{v}</span>
                  },
                },
                {
                  title: t('aiQcPage.exposure'), key: 'exposure',
                  render: (_: unknown, r: QcAiAssessResult & { verdict: string }) => {
                    const v = dimVerdict(r.exposure.score, thresholds.exposure)
                    return <span style={{ fontSize: 12, color: verdictColor(v) }}>{v}</span>
                  },
                },
                {
                  title: t('aiQcPage.positioning'), key: 'positioning',
                  render: (_: unknown, r: QcAiAssessResult & { verdict: string }) => {
                    const v = dimVerdict(r.positioning.score, thresholds.positioning)
                    return <span style={{ fontSize: 12, color: verdictColor(v) }}>{v}</span>
                  },
                },
                { title: t('aiQcPage.overallScore'), key: 'overallScore', render: (_: unknown, r: QcAiAssessResult & { verdict: string }) => <span style={{ fontSize: 12, color: getScoreColor(r.overall.score) }}>{r.overall.score}</span> },
                {
                  title: t('aiQcPage.overallVerdict'), dataIndex: 'verdict',
                  render: (v: string) => (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: verdictColor(v),
                      background: `${verdictColor(v)}22`,
                      padding: '2px 10px',
                      borderRadius: 10,
                    }}>{v}</span>
                  ),
                },
              ]}
            />
          </div>
        )}
        {assessError && (
          <div style={{ padding: '10px 20px', borderBottom: `1px solid ${DARK_BORDER}`, color: 'var(--color-warning-400)', fontSize: 12 }}>
            {assessError}
          </div>
        )}
        {dimAssessments.length === 0 && !assessing ? (
          <div style={{ padding: 'var(--space-10, 40px)', textAlign: 'center', color: GRAY }}>
            <Gauge size={36} style={{ opacity: 0.5 }} />
            <p style={{ marginTop: 'var(--space-2, 8px)' }}>{t('aiQcPage.no3dResult')}</p>
          </div>
        ) : (
          <div style={{ padding: 'var(--space-5, 20px)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
            {dimAssessments.map((a) => (
              <div key={a.studyId} style={{
                background: DARK_BG,
                borderRadius: 10,
                padding: 'var(--space-4, 16px)',
                border: `1px solid ${DARK_BORDER}`,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 14,
                  flexWrap: 'wrap',
                  gap: 'var(--space-2, 8px)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: WHITE }}>{t('aiQcPage.studyId')} {a.studyId}</span>
                    <span style={{ fontSize: 12, color: GRAY }}>{a.modality} · {a.bodyPart}</span>
                    {a.instanceId && <span style={{ fontSize: 12, color: GRAY }}>{t('aiQcPage.instance')} {a.instanceId}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: GRAY }}>{t('aiQcPage.totalScore')}</span>
                    <span style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: getScoreColor(a.overall.score),
                    }}>{a.overall.score}</span>
                    <span style={{
                      fontSize: 12,
                      color: getScoreColor(a.overall.score),
                      background: `${getScoreColor(a.overall.score)}22`,
                      padding: '2px 8px',
                      borderRadius: 10,
                    }}>{a.overall.label}</span>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 'var(--space-3, 12px)',
                }}>
                  {[
                    { key: 'artifact', label: t('aiQcPage.artifactAssess'), icon: <Wrench size={15} />, data: a.artifact },
                    { key: 'exposure', label: t('aiQcPage.exposureAssess'), icon: <Zap size={15} />, data: a.exposure },
                    { key: 'positioning', label: t('aiQcPage.positioningAssess'), icon: <Target size={15} />, data: a.positioning },
                  ].map((dim) => (
                    <div key={dim.key} style={{
                      background: DARK_CARD,
                      borderRadius: 8,
                      padding: 'var(--space-3, 12px)',
                      border: `1px solid ${DARK_BORDER}`,
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 'var(--space-2, 8px)',
                      }}>
                        <span style={{ fontSize: 12, color: GRAY, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {dim.icon} {dim.label}
                        </span>
                        <span style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: getScoreColor(dim.data.score),
                        }}>{dim.data.score}
                          <span style={{ fontSize: 11, fontWeight: 400, color: GRAY, marginLeft: 6 }}>{dim.data.label}</span>
                        </span>
                      </div>
                      <ScoreBar score={dim.data.score} />
                      <div style={{ marginTop: 'var(--space-2, 8px)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)' }}>
                        {dim.data.issues.map((iss, i) => (
                          <div key={i} style={{
                            fontSize: 12,
                            color: iss.includes('未见') || iss.includes('正常') || iss.includes('正确') ? SUCCESS : 'var(--color-warning-400)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 5,
                            lineHeight: '17px',
                          }}>
                            {iss.includes('未见') || iss.includes('正常') || iss.includes('正确') ? (
                              <CheckCircle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                            ) : (
                              <AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                            )}
                            <span>{iss}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI质控表格 */}
      <div style={{
        background: DARK_CARD,
        borderRadius: 12,
        border: `1px solid ${DARK_BORDER}`,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${DARK_BORDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
            <Bot size={16} color={PRIMARY} />
            <span style={{ fontSize: 14, fontWeight: 600, color: WHITE }}>{t('aiQcPage.qcRecords')}</span>
            <span style={{
              fontSize: 12,
              color: GRAY,
              background: DARK_BG,
              padding: '2px 10px',
              borderRadius: 10,
            }}>
              {t('aiQcPage.totalCount', { count: filteredData.length })}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4, 16px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: SUCCESS }} />
              <span style={{ fontSize: 12, color: GRAY }}>{t('aiQcPage.qualified')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: WARNING }} />
              <span style={{ fontSize: 12, color: GRAY }}>{t('aiQcPage.warning')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: DANGER }} />
              <span style={{ fontSize: 12, color: GRAY }}>{t('aiQcPage.unqualified')}</span>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <DataTable
            dataSource={pagedData}
            rowKey="id"
            pagination={false}
            emptyText={t('aiQcPage.noMatching')}
            columns={[
              { title: t('aiQcPage.reportId'), dataIndex: 'id', render: (v: string) => <span style={{ fontSize: 12, color: PRIMARY, fontWeight: 500 }}>{v}</span> },
              { title: t('aiQcPage.deviceType'), dataIndex: 'deviceType', render: (v: string) => <span style={{ fontSize: 12, color: WHITE }}>{v}</span> },
              { title: t('aiQcPage.bodyPart'), dataIndex: 'bodyPart', render: (v: string) => <span style={{ fontSize: 12, color: WHITE }}>{v}</span> },
              { title: t('aiQcPage.aiScore'), dataIndex: 'aiScore', render: (v: number) => <div style={{ minWidth: 160 }}><ScoreBar score={v} /></div> },
              { title: t('aiQcPage.qcResult'), dataIndex: 'result', render: (v: string) => <ResultBadge result={v} /> },
              { title: t('aiQcPage.technician'), dataIndex: 'technician', render: (v: string) => <span style={{ fontSize: 12, color: WHITE }}>{v}</span> },
              {
                title: t('aiQcPage.confirmStatus'), key: 'confirmed',
                render: (_: unknown, row: AIQCRecord) => <ConfirmStatus confirmed={row.confirmed} time={row.confirmedTime} />,
              },
              {
                title: t('aiQcPage.time'), key: 'time',
                render: (_: unknown, row: AIQCRecord) => (
                  <span style={{ fontSize: 12, color: GRAY }}>
                    <div>{row.date}</div>
                    <div>{row.time}</div>
                  </span>
                ),
              },
              {
                title: t('aiQcPage.actions'), key: 'actions',
                render: (_: unknown, row: AIQCRecord) => (
                  <button
                    onClick={() => handleViewDetail(row)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: `1px solid ${DARK_BORDER}`,
                      background: 'transparent',
                      color: PRIMARY,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1, 4px)',
                    }}
                  >
                    <Eye size={12} /> {t('aiQcPage.detail')}
                  </button>
                ),
              },
            ]}
          />
        </div>

        {/* 分页 */}
        <div style={{
          padding: '16px 20px',
          borderTop: `1px solid ${DARK_BORDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, color: GRAY }}>
            {t('aiQcPage.showing', { start: filteredData.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1, end: Math.min(currentPage * PAGE_SIZE, filteredData.length), total: filteredData.length })}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: `1px solid ${DARK_BORDER}`,
                background: 'transparent',
                color: currentPage <= 1 ? '#475569' : GRAY,
                fontSize: 12,
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage <= 1 ? 0.5 : 1,
              }}
            >
              {t('aiQcPage.prevPage')}
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: `1px solid ${DARK_BORDER}`,
                background: 'transparent',
                color: currentPage >= totalPages ? '#475569' : GRAY,
                fontSize: 12,
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage >= totalPages ? 0.5 : 1,
              }}
            >
              {t('aiQcPage.nextPage')}
            </button>
          </div>
        </div>
      </div>

      {/* 详情弹窗 */}
      {showDetail && selectedRecord && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowDetail(false)}
        >
          <div
            style={{
              background: DARK_CARD,
              borderRadius: 16,
              padding: 'var(--space-6, 24px)',
              width: 500,
              maxWidth: '90%',
              border: `1px solid ${DARK_BORDER}`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-5, 20px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Brain size={20} color={PRIMARY} />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: WHITE, margin: 0 }}>{t('aiQcPage.detailTitle')}</h3>
              </div>
              <button aria-label="关闭"
                onClick={() => setShowDetail(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: GRAY,
                  cursor: 'pointer',
                  padding: 'var(--space-1, 4px)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 'var(--space-4, 16px)' }}>
              <div style={{
                background: DARK_BG,
                borderRadius: 10,
                padding: 'var(--space-4, 16px)',
              }}>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 'var(--space-2, 8px)' }}>{t('aiQcPage.aiOverallScore')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)' }}>
                  <span style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: getScoreColor(selectedRecord.aiScore),
                  }}>
                    {selectedRecord.aiScore}
                  </span>
                  <div style={{ flex: 1 }}>
                    <ScoreBar score={selectedRecord.aiScore} />
                    <div style={{ fontSize: 12, color: GRAY, marginTop: 'var(--space-1, 4px)' }}>
                      {getScoreLabel(selectedRecord.aiScore)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
                {[
                  [t('aiQcPage.reportId'), selectedRecord.id],
                  [t('aiQcPage.deviceType'), selectedRecord.deviceType],
                  [t('aiQcPage.bodyPart'), selectedRecord.bodyPart],
                  [t('aiQcPage.patientName'), selectedRecord.patientName],
                  [t('aiQcPage.qcResult'), selectedRecord.result],
                  [t('aiQcPage.responsibleTech'), selectedRecord.technician],
                ].map(([label, value]) => (
                  <div key={label} style={{
                    background: DARK_BG,
                    borderRadius: 8,
                    padding: 'var(--space-3, 12px)',
                  }}>
                    <div style={{ fontSize: 12, color: GRAY, marginBottom: 'var(--space-1, 4px)' }}>{label}</div>
                    <div style={{ fontSize: 14, color: WHITE, fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>

              {selectedRecord.issues && (
                <div style={{
                  background: '#991b1b22',
                  borderRadius: 8,
                  padding: 'var(--space-3, 12px)',
                  border: '1px solid #991b1b',
                }}>
                  <div style={{ fontSize: 12, color: DANGER, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                    <AlertTriangle size={14} /> {t('aiQcPage.issuesFoundLabel')}
                  </div>
                  <div style={{ fontSize: 12, color: WHITE }}>{selectedRecord.issues}</div>
                </div>
              )}

              <div style={{
                background: DARK_BG,
                borderRadius: 8,
                padding: 'var(--space-3, 12px)',
              }}>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 'var(--space-2, 8px)' }}>{t('aiQcPage.confirmStatus')}</div>
                <ConfirmStatus confirmed={selectedRecord.confirmed} time={selectedRecord.confirmedTime} />
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-5, 20px)', display: 'flex', gap: 10 }}>
              <button
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: `1px solid ${DARK_BORDER}`,
                  background: 'transparent',
                  color: GRAY,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
                onClick={() => setShowDetail(false)}
              >
                {t('aiQcPage.close')}
              </button>
              {/* 无后端确认端点 → 禁用 + Tooltip 说明 (无对应 i18n key, 沿用本文件既有的中文提示文案) */}
              <Tooltip title="确认质控需要后端确认接口支持，当前暂未提供，按钮已停用">
                <span style={{ flex: 1, display: 'block' }}>
                  <button
                    disabled
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
                      color: WHITE,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'not-allowed',
                      opacity: 0.55,
                    }}
                  >
                    {selectedRecord.confirmed ? t('aiQcPage.updateConfirm') : t('aiQcPage.confirmQc')}
                  </button>
                </span>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-icon {
          animation: spin 1s linear infinite;
        }
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(0.7);
        }
      `}</style>
    </div>
  )
}
