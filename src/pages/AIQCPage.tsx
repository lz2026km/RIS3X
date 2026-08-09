// @ts-nocheck
// G005 放射科RIS系统 - AI智能质控 v1.0.0
// v1.0.4 (R4) 集成：跳转至 AIReportDraftPage 一键自动初稿
// [v3.0.6.11-75] W1-2: 接入 aiPlatformApi.listQcResults (GET /ai-platform/qc, 后端 auditLog resource=ai-qc)
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiPlatformApi } from '../services/api/aiPlatformApi'
import {
  ShieldCheck, AlertTriangle, CheckCircle, Search, Filter, Star,
  TrendingUp, TrendingDown, BarChart3, Clock, Camera, Image, X, Check,
  Eye, Edit3, Activity, Bell, Target, Award, Users, FileText, RefreshCw,
  Zap, ThumbsUp, ThumbsDown, Plus, Download, ChevronDown, ChevronUp,
  Brain, Bot, Scan, Gauge, MessageSquare, Wrench
} from 'lucide-react'

const PRIMARY = '#3b82f6'
const PRIMARY_DARK = '#2563eb'
const ACCENT = '#3b82f6'
const SUCCESS = '#10b981'
const WARNING = '#f59e0b'
const DANGER = '#ef4444'
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
const generateAIQCData = () => {
  const data = []
  const baseDate = new Date('2026-05-03')
  
  for (let i = 0; i < 50; i++) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() - Math.floor(Math.random() * 30))
    const deviceType = DEVICE_TYPES[Math.floor(Math.random() * DEVICE_TYPES.length)]
    const bodyPart = BODY_PARTS[Math.floor(Math.random() * BODY_PARTS.length)]
    const aiScore = Math.floor(Math.random() * 40) + 60 // 60-100
    const technician = TECHNICIANS[Math.floor(Math.random() * TECHNICIANS.length)]
    
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
      patientName: ['张三', '李四', '王五', '赵六', '刘七', '陈八', '杨九', '周十'][Math.floor(Math.random() * 8)],
      aiScore,
      result,
      technician,
      date: date.toISOString().split('T')[0],
      time: date.toTimeString().slice(0, 5),
      confirmed,
      confirmedTime: confirmedTime ? confirmedTime.toISOString().replace('T', ' ').slice(0, 16) : null,
      issues: aiScore < 80 ? ['运动伪影', '曝光不当', '体位不正', '对比剂不足'][Math.floor(Math.random() * 4)] : null,
    })
  }
  return data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

const AI_QC_DATA = generateAIQCData()

// [v3.0.6.11-75] 归一化后端 /ai-platform/qc 记录 (auditLog: detail 为 JSON 负载)
const normalizeQcRow = (item) => {
  const d = item?.detail && typeof item.detail === 'object' ? item.detail : {}
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
  if (score >= 80) return '#22c55e'
  if (score >= 70) return WARNING
  if (score >= 60) return '#f97316'
  return DANGER
}

// AI评分标签
const getScoreLabel = (score: number) => {
  if (score >= 90) return '优秀'
  if (score >= 80) return '良好'
  if (score >= 70) return '一般'
  if (score >= 60) return '较差'
  return '差'
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

  const loadApiQc = async (silent = false) => {
    if (!silent) setApiLoading(true)
    try {
      const res = await aiPlatformApi.listQcResults()
      if (!res.success) {
        setApiError(res.error?.message ?? 'AI QC 数据加载失败')
        return
      }
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
      const rows = raw.map(normalizeQcRow).filter(Boolean)
      if (rows.length > 0) {
        setMergedData([...rows, ...AI_QC_DATA])
        setApiError('')
      } else if (!silent) {
        setApiError('接口返回空数据，展示演示数据')
      }
    } catch (e) {
      setApiError((e as Error)?.message ?? 'AI QC 数据加载失败')
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
      label: '今日完成',
      value: liveStats.todayComplete,
      unit: '例',
      icon: <CheckCircle size={22} />,
      bg: '#1e40af',
      color: PRIMARY,
      trend: '+12%',
      trendUp: true,
    },
    {
      label: '合格率',
      value: liveStats.qualifiedRate,
      unit: '%',
      icon: <ShieldCheck size={22} />,
      bg: '#1a3d2e',
      color: SUCCESS,
      trend: '+2.3%',
      trendUp: true,
    },
    {
      label: '问题发现',
      value: liveStats.issuesFound,
      unit: '例',
      icon: <AlertTriangle size={22} />,
      bg: '#3d2a1a',
      color: WARNING,
      trend: '-5例',
      trendUp: true,
    },
    {
      label: '技师反馈率',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          fontSize: 13,
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
    const c = colors[result] || colors['警告']
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
  const ConfirmStatus = ({ confirmed, time }: { confirmed: boolean; time: string | null }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {confirmed ? (
        <>
          <CheckCircle size={16} color={SUCCESS} />
          <span style={{ color: SUCCESS, fontSize: 12 }}>已确认</span>
        </>
      ) : (
        <>
          <Clock size={16} color={GRAY} />
          <span style={{ color: GRAY, fontSize: 12 }}>待确认</span>
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
      padding: 24,
      maxWidth: 1600,
      margin: '0 auto',
      background: DARK_BG,
      minHeight: '100vh',
      color: WHITE,
    }}>
      {/* [v1.0.4 R4] 升级入口横幅 */}
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
        borderRadius: 10, padding: 12, marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 18 }}>✨</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
            v1.0.4 AI 智能质控升级 · 一键自动初稿
          </div>
          <div style={{ fontSize: 12, color: '#e0e7ff', marginTop: 2 }}>
            6 大临床场景模板 · AI 模型 v2.3 · 历史相似病例匹配 · 应用到报告
          </div>
        </div>
        <button
          onClick={() => navigate('/ai-report-draft')}
          style={{
            padding: '6px 12px', border: 'none', borderRadius: 4,
            background: 'var(--bg-card)', color: '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          ✨ 一键 AI 初稿
        </button>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
              <h1 style={{ fontSize: 20, fontWeight: 700, color: WHITE, margin: 0 }}>
                AI智能质控
              </h1>
              <p style={{ fontSize: 12, color: GRAY, margin: 0 }}>
                基于深度学习的影像质量智能分析与质控 {apiLoading ? '(同步中…)' : ''}
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
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw size={14} className={apiLoading ? 'spin-icon' : ''} />
              同步 AI 平台数据
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: `1px solid ${autoRefresh ? PRIMARY : DARK_BORDER}`,
                background: autoRefresh ? `${PRIMARY}22` : 'transparent',
                color: autoRefresh ? PRIMARY : GRAY,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw size={14} style={{ animation: autoRefresh ? 'spin 1s linear infinite' : 'none' }} />
              自动刷新
            </button>
            <button
              onClick={() => { const csv = 'AI质控报表\n记录数,合格率,需重审数,采纳率\n' + mergedData.length + ',' + liveStats.qualifiedRate + '%,' + liveStats.issuesFound + ',' + liveStats.feedbackRate + '%'; const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'AI质控报表.csv'; a.click(); URL.revokeObjectURL(url); }}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
                color: WHITE,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Download size={14} />
              导出报表
            </button>
          </div>
        </div>
        {apiError && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 8,
            border: `1px solid ${WARNING}66`,
            background: `${WARNING}14`,
            color: '#fbbf24',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>{apiError}（继续展示演示数据）</span>
            <button onClick={() => { setApiError(''); void loadApiQc() }} style={{ background: 'transparent', border: 'none', color: '#fbbf24', cursor: 'pointer', fontSize: 12 }}>重试</button>
          </div>
        )}
      </div>

      {/* 统计卡片 - v3.0.6.8-23c (A8-P0-4): auto-fit 响应式 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        {statCards.map((card, idx) => (
          <div
            key={idx}
            style={{
              background: DARK_CARD,
              borderRadius: 12,
              padding: 20,
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
              marginBottom: 12,
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
            <div style={{ fontSize: 13, color: GRAY, marginBottom: 4 }}>{card.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: WHITE }}>{card.value}</span>
              <span style={{ fontSize: 14, color: GRAY }}>{card.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 多维筛选区域 */}
      <div style={{
        background: DARK_CARD,
        borderRadius: 12,
        padding: 20,
        border: `1px solid ${DARK_BORDER}`,
        marginBottom: 20,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} color={PRIMARY} />
            <span style={{ fontSize: 14, fontWeight: 600, color: WHITE }}>多维筛选</span>
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
              gap: 4,
            }}
          >
            <RefreshCw size={12} /> 重置
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr',
          gap: 12,
          alignItems: 'center',
        }}>
          {/* 搜索框 */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: GRAY }} />
            <input
              type="text"
              placeholder="搜索患者姓名/报告ID/设备..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 38px',
                borderRadius: 8,
                border: `1px solid ${DARK_BORDER}`,
                background: DARK_BG,
                color: WHITE,
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
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
              fontSize: 13,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="全部">全部设备</option>
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
              fontSize: 13,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="全部">全部结果</option>
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
              fontSize: 13,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="全部">全部技师</option>
            {TECHNICIANS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* 日期范围 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                fontSize: 13,
                outline: 'none',
              }}
            />
            <span style={{ color: GRAY }}>至</span>
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
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
        </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={16} color={PRIMARY} />
            <span style={{ fontSize: 14, fontWeight: 600, color: WHITE }}>AI质控记录</span>
            <span style={{
              fontSize: 12,
              color: GRAY,
              background: DARK_BG,
              padding: '2px 10px',
              borderRadius: 10,
            }}>
              共 {filteredData.length} 条
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: SUCCESS }} />
              <span style={{ fontSize: 12, color: GRAY }}>合格</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: WARNING }} />
              <span style={{ fontSize: 12, color: GRAY }}>警告</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: DANGER }} />
              <span style={{ fontSize: 12, color: GRAY }}>不合格</span>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: DARK_BG }}>
                {['报告ID', '设备类型', '检查部位', 'AI评分', '质控结果', '技师', '确认状态', '时间', '操作'].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      color: GRAY,
                      borderBottom: `1px solid ${DARK_BORDER}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedData.map((row, idx) => (
                <tr
                  key={row.id}
                  style={{
                    background: idx % 2 === 0 ? 'transparent' : `${PRIMARY}08`,
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${PRIMARY}15`)}
                  onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : `${PRIMARY}08`)}
                >
                  <td style={{ padding: '14px 16px', fontSize: 13, color: PRIMARY, fontWeight: 500 }}>{row.id}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: WHITE }}>{row.deviceType}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: WHITE }}>{row.bodyPart}</td>
                  <td style={{ padding: '14px 16px', minWidth: 160 }}>
                    <ScoreBar score={row.aiScore} />
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <ResultBadge result={row.result} />
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: WHITE }}>{row.technician}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <ConfirmStatus confirmed={row.confirmed} time={row.confirmedTime} />
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 12, color: GRAY }}>
                    <div>{row.date}</div>
                    <div>{row.time}</div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
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
                        gap: 4,
                      }}
                    >
                      <Eye size={12} /> 详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredData.length === 0 && (
          <div style={{
            padding: 60,
            textAlign: 'center',
            color: GRAY,
          }}>
            <Search size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
            <p>未找到匹配的质控记录</p>
          </div>
        )}

        {/* 分页 */}
        <div style={{
          padding: '16px 20px',
          borderTop: `1px solid ${DARK_BORDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 13, color: GRAY }}>
            显示 {filteredData.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredData.length)} / {filteredData.length} 条
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
                fontSize: 13,
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage <= 1 ? 0.5 : 1,
              }}
            >
              上一页
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
                fontSize: 13,
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage >= totalPages ? 0.5 : 1,
              }}
            >
              下一页
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
              padding: 24,
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
              marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Brain size={20} color={PRIMARY} />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: WHITE, margin: 0 }}>AI质控详情</h3>
              </div>
              <button
                onClick={() => setShowDetail(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: GRAY,
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{
                background: DARK_BG,
                borderRadius: 10,
                padding: 16,
              }}>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 8 }}>AI综合评分</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    fontSize: 36,
                    fontWeight: 700,
                    color: getScoreColor(selectedRecord.aiScore),
                  }}>
                    {selectedRecord.aiScore}
                  </span>
                  <div style={{ flex: 1 }}>
                    <ScoreBar score={selectedRecord.aiScore} />
                    <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>
                      {getScoreLabel(selectedRecord.aiScore)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['报告ID', selectedRecord.id],
                  ['设备类型', selectedRecord.deviceType],
                  ['检查部位', selectedRecord.bodyPart],
                  ['患者姓名', selectedRecord.patientName],
                  ['质控结果', selectedRecord.result],
                  ['负责技师', selectedRecord.technician],
                ].map(([label, value]) => (
                  <div key={label} style={{
                    background: DARK_BG,
                    borderRadius: 8,
                    padding: 12,
                  }}>
                    <div style={{ fontSize: 12, color: GRAY, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 14, color: WHITE, fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>

              {selectedRecord.issues && (
                <div style={{
                  background: '#991b1b22',
                  borderRadius: 8,
                  padding: 12,
                  border: '1px solid #991b1b',
                }}>
                  <div style={{ fontSize: 12, color: DANGER, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={14} /> 发现问题
                  </div>
                  <div style={{ fontSize: 13, color: WHITE }}>{selectedRecord.issues}</div>
                </div>
              )}

              <div style={{
                background: DARK_BG,
                borderRadius: 8,
                padding: 12,
              }}>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 8 }}>确认状态</div>
                <ConfirmStatus confirmed={selectedRecord.confirmed} time={selectedRecord.confirmedTime} />
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <button
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: `1px solid ${DARK_BORDER}`,
                  background: 'transparent',
                  color: GRAY,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
                onClick={() => setShowDetail(false)}
              >
                关闭
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
                  color: WHITE,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {selectedRecord.confirmed ? '更新确认' : '确认质控'}
              </button>
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
