// G005 放射科RIS系统 - 远程会诊管理 v1.1.0
import { useState, useEffect, useRef } from 'react'
import {
  Radio, Search, Video, CheckCircle, Clock, FileText,
  User, Stethoscope, Activity, Upload, Printer, Send, X, Check,
  AlertCircle, Image, MessageSquare, Star, ThumbsUp,
  Calendar, Clock3, Users, MapPin, Heart, Shield, RefreshCw, Download, Edit3, Play, Pause, Square, Camera,
  Film, Volume2, VolumeX, SkipBack, SkipForward
} from 'lucide-react'
import { initialConsultations, initialRadiologyExams, initialPatients } from '../data/initialData'
import { consultationApi } from '../services/api'
import { LoadingBanner, ErrorBanner } from '../components/feedback'

const PRIMARY = '#1e40af'
const ACCENT = '#3b82f6'
const SUCCESS = '#059669'
const WARNING = '#d97706'
const DANGER = '#dc2626'
const GRAY = '#64748b'
const LIGHT_BG = '#f8fafc'
const BORDER = '#e2e8f0'
const WHITE = '#ffffff'

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  '待回复': { bg: '#fef3c7', color: '#d97706', label: '待回复' },
  '已回复': { bg: '#d1fae5', color: '#059669', label: '已回复' },
  '已拒绝': { bg: '#f1f5f9', color: '#94a3b8', label: '已拒绝' },
  '进行中': { bg: '#dbeafe', color: '#2563eb', label: '进行中' },
  '已完成': { bg: '#d1fae5', color: '#059669', label: '已完成' },
}

const TYPE_CONFIG: Record<string, { bg: string; color: string }> = {
  'MDT': { bg: '#ede9fe', color: '#6d28d9' },
  '疑难病例': { bg: '#fef3c7', color: '#b45309' },
  '远程会诊': { bg: '#dbeafe', color: '#2563eb' },
  '二次意见': { bg: '#d1fae5', color: '#047857' },
}

const RECORDING_STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  '准备中': { bg: '#f1f5f9', color: '#64748b', label: '准备中' },
  '录制中': { bg: '#fee2e2', color: '#dc2626', label: '录制中' },
  '已暂停': { bg: '#fef3c7', color: '#d97706', label: '已暂停' },
  '已完成': { bg: '#d1fae5', color: '#059669', label: '已完成' },
}

interface RecordingArchive {
  id: string
  consultationId: string
  patientName: string
  duration: string
  fileSize: string
  recordTime: string
  status: '可用' | '处理中' | '已损坏'
}

interface TimelineNode {
  label: string
  time: string
  operator: string
  status: 'done' | 'current' | 'pending'
  icon: React.ReactNode
}

// 虚构的录音录像存档数据
const mockRecordingArchives: RecordingArchive[] = [
  { id: 'REC001', consultationId: 'CST2026050101', patientName: '张伟', duration: '00:45:23', fileSize: '1.2GB', recordTime: '2026-05-01 14:30', status: '可用' },
  { id: 'REC002', consultationId: 'CST2026050102', patientName: '李娜', duration: '01:12:45', fileSize: '2.0GB', recordTime: '2026-05-02 09:15', status: '可用' },
  { id: 'REC003', consultationId: 'CST2026050103', patientName: '王芳', duration: '00:32:10', fileSize: '850MB', recordTime: '2026-05-02 15:40', status: '可用' },
  { id: 'REC004', consultationId: 'CST2026050104', patientName: '刘建国', duration: '00:58:33', fileSize: '1.5GB', recordTime: '2026-05-03 10:20', status: '处理中' },
  { id: 'REC005', consultationId: 'CST2026050105', patientName: '陈晓燕', duration: '01:25:18', fileSize: '1.8GB', recordTime: '2026-05-03 16:55', status: '可用' },
  { id: 'REC006', consultationId: 'CST2026050106', patientName: '赵明', duration: '00:18:42', fileSize: '480MB', recordTime: '2026-05-04 11:05', status: '可用' },
  { id: 'REC007', consultationId: 'CST2026050107', patientName: '孙丽华', duration: '00:55:07', fileSize: '1.4GB', recordTime: '2026-05-04 14:30', status: '已损坏' },
  { id: 'REC008', consultationId: 'CST2026050108', patientName: '周杰', duration: '01:03:29', fileSize: '1.6GB', recordTime: '2026-05-05 08:45', status: '可用' },
  { id: 'REC009', consultationId: 'CST2026050109', patientName: '吴婷', duration: '00:38:55', fileSize: '980MB', recordTime: '2026-05-05 13:20', status: '可用' },
  { id: 'REC010', consultationId: 'CST2026050110', patientName: '郑海', duration: '01:48:12', fileSize: '2.0GB', recordTime: '2026-05-06 10:00', status: '可用' },
]

// 虚构的会诊录像关联（部分会诊有录像）
const consultationVideoMap: Record<string, string> = {
  'CST2026050101': 'REC001',
  'CST2026050102': 'REC002',
  'CST2026050103': 'REC003',
  'CST2026050105': 'REC005',
  'CST2026050107': 'REC007',
}

const buildTimeline = (consultation: typeof initialConsultations[0]): TimelineNode[] => {
  const nodes: TimelineNode[] = [
    {
      label: '申请提交',
      time: consultation.requestTime,
      operator: consultation.requestingDoctorName,
      status: 'done',
      icon: <FileText size={14} />,
    },
    {
      label: '接收确认',
      time: consultation.responseTime || '—',
      operator: consultation.consultedDoctorName || '待指定',
      status: consultation.status === '待回复' ? 'pending' : 'done',
      icon: <CheckCircle size={14} />,
    },
    {
      label: '影像传输',
      time: consultation.status !== '待回复' ? '2026-05-01 15:00' : '—',
      operator: '系统自动',
      status: consultation.status === '已回复' || consultation.status === '已完成' ? 'done' : 'pending',
      icon: <Image size={14} />,
    },
    {
      label: '会诊进行',
      time: consultation.status === '已回复' ? '2026-05-01 15:30' : '—',
      operator: consultation.consultedDoctorName || '—',
      status: consultation.status === '已回复' ? 'current' : 'pending',
      icon: <MessageSquare size={14} />,
    },
    {
      label: '会诊完成',
      time: consultation.status === '已完成' ? '2026-05-01 16:45' : '—',
      operator: consultation.consultedDoctorName || '—',
      status: consultation.status === '已完成' ? 'done' : 'pending',
      icon: <Check size={14} />,
    },
  ]
  return nodes
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function ConsultationPage() {
  const [activeTab, setActiveTab] = useState<'会诊列表' | '录音录像会诊'>('会诊列表')
  const [filter, setFilter] = useState<string>('全部')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string>(initialConsultations[0]?.id || '')
  const [conclusionText, setConclusionText] = useState('')
  const [diagnosisAdvice, setDiagnosisAdvice] = useState('')
  const [referenceInfo, setReferenceInfo] = useState('')
  const [qualityScore, setQualityScore] = useState(5)
  const [satisfactionScore, setSatisfactionScore] = useState(5)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [ratingModalData, setRatingModalData] = useState<{ dimension: string; score: number; comment: string }[]>([
    { dimension: '完整性', score: 5, comment: '' },
    { dimension: '准确性', score: 5, comment: '' },
    { dimension: '规范性', score: 5, comment: '' },
    { dimension: '及时性', score: 5, comment: '' },
  ])

  // Toast state
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'info' | 'progress' }>({ show: false, message: '', type: 'success' })
  const showToast = (message: string, type: 'success' | 'info' | 'progress' = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), type === 'progress' ? 3000 : 2000)
  }

  // Upload Modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  useState<File[]>([])

  // Conclusion Modal state
  const [showConclusionModal, setShowConclusionModal] = useState(false)

  // Delete Confirmation Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RecordingArchive | null>(null)

  // 录音录像相关状态
  const [recordingStatus, setRecordingStatus] = useState<'准备中' | '录制中' | '已暂停' | '已完成'>('准备中')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [videoProgress, setVideoProgress] = useState(0)
  useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [selectedArchive, setSelectedArchive] = useState<RecordingArchive | null>(null)
  const [videoModalOpen, setVideoModalOpen] = useState(false)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const videoProgressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // API 加载会诊数据
  const [consultations, setConsultations] = useState(initialConsultations)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const res = await consultationApi.list()
      if (cancelled) return
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setConsultations(res.data as unknown as typeof initialConsultations)
        setLoadError(null)
      } else {
        setConsultations(initialConsultations)
        setLoadError('API 不可用,使用本地数据')
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const selected = consultations.find(c => c.id === selectedId)

  const filters = ['全部', '待回复', '已回复', '已完成', '已拒绝']

  const filtered = consultations.filter(c => {
    const matchFilter = filter === '全部' || c.status === filter
    const matchSearch = !search || c.patientName.includes(search) || c.id.includes(search)
    return matchFilter && matchSearch
  })

  const getExamForConsultation = (consultation: typeof selected) => {
    return initialRadiologyExams.find(e => e.id === consultation?.examId)
  }

  const getPatientForConsultation = (consultation: typeof selected) => {
    return initialPatients.find(p => p.id === consultation?.patientId)
  }

  const handleAccept = () => {
    showToast('已接受会诊请求', 'success')
  }

  const handleReject = () => {
    showToast('已拒绝会诊请求', 'info')
  }

  const handleUpload = () => {
    setShowUploadModal(true)
  }

  const handleSubmitConclusion = () => {
    if (!conclusionText.trim()) {
      showToast('请填写会诊意见见', 'info')
      return
    }
    setShowConclusionModal(true)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSubmitRating = () => {
    const total = ratingModalData.reduce((sum, item) => sum + item.score, 0)
    setQualityScore(Math.round(total / ratingModalData.length))
    setShowRatingModal(false)
    showToast('评价已提交，感谢您的反馈', 'success')
  }

  // 录制控制
  const handleStartRecording = () => {
    setRecordingStatus('录制中')
    setRecordingSeconds(0)
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds(prev => prev + 1)
    }, 1000)
  }

  const handlePauseRecording = () => {
    if (recordingStatus === '录制中') {
      setRecordingStatus('已暂停')
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    } else if (recordingStatus === '已暂停') {
      setRecordingStatus('录制中')
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1)
      }, 1000)
    }
  }

  const handleStopRecording = () => {
    setRecordingStatus('已完成')
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  // 视频播放控制
  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false)
      if (videoProgressRef.current) {
        clearInterval(videoProgressRef.current)
        videoProgressRef.current = null
      }
    } else {
      setIsPlaying(true)
      videoProgressRef.current = setInterval(() => {
        setVideoProgress(prev => {
          if (prev >= 100) {
            if (videoProgressRef.current) clearInterval(videoProgressRef.current)
            setIsPlaying(false)
            return 0
          }
          return prev + 0.5
        })
      }, 100)
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = (x / rect.width) * 100
    setVideoProgress(Math.max(0, Math.min(100, percent)))
  }

  const handleSnapshot = () => {
    showToast('快照已保存到: /captures/snapshot_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.png', 'success')
  }

  const handlePlayArchive = (archive: RecordingArchive) => {
    setSelectedArchive(archive)
    setVideoModalOpen(true)
    setVideoProgress(0)
    setIsPlaying(false)
  }

  const handleDownloadArchive = (archive: RecordingArchive) => {
    showToast(`开始下载: ${archive.patientName}_${archive.recordTime.replace(/:/g, '-')}.mp4`, 'progress')
  }

  const handleDeleteArchive = (archive: RecordingArchive) => {
    setDeleteTarget(archive)
    setShowDeleteModal(true)
  }

  const renderStars = (score: number, onChange?: (s: number) => void) => {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            size={18}
            fill={star <= score ? '#f59e0b' : 'none'}
            color={star <= score ? '#f59e0b' : '#d1d5db'}
            style={{ cursor: onChange ? 'pointer' : 'default' }}
            onClick={() => onChange?.(star)}
          />
        ))}
      </div>
    )
  }

  // 清理计时器
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (videoProgressRef.current) clearInterval(videoProgressRef.current)
    }
  }, [])

  const timeline = selected ? buildTimeline(selected) : []

  const statCards = [
    {
      label: '全部会诊',
      value: consultations.length,
      icon: <Radio size={18} color={ACCENT} />,
      bg: '#eff6ff',
    },
    {
      label: '待回复',
      value: consultations.filter(c => c.status === '待回复').length,
      icon: <Clock size={18} color={WARNING} />,
      bg: '#fef3c7',
    },
    {
      label: '进行中',
      value: consultations.filter(c => c.status === '已回复').length,
      icon: <Activity size={18} color={ACCENT} />,
      bg: '#dbeafe',
    },
    {
      label: '已完成',
      value: consultations.filter(c => c.status === '已完成').length,
      icon: <CheckCircle size={18} color={SUCCESS} />,
      bg: '#d1fae5',
    },
  ]

  const recordingStatCards = [
    { label: '总存档数', value: mockRecordingArchives.length, icon: <Film size={18} color={ACCENT} />, bg: '#eff6ff' },
    { label: '可用', value: mockRecordingArchives.filter(a => a.status === '可用').length, icon: <CheckCircle size={18} color={SUCCESS} />, bg: '#d1fae5' },
    { label: '处理中', value: mockRecordingArchives.filter(a => a.status === '处理中').length, icon: <Clock size={18} color={WARNING} />, bg: '#fef3c7' },
    { label: '已损坏', value: mockRecordingArchives.filter(a => a.status === '已损坏').length, icon: <AlertCircle size={18} color={DANGER} />, bg: '#fee2e2' },
  ]

  return (
    <div data-testid="consultation-page" style={{ padding: 24, maxWidth: 1600, margin: '0 auto', background: '#f1f5f9', minHeight: '100vh' }}>
      {/* [G005 W1-C] 演示数据（后端待实现）: 后端无 /consultations controller, 数据由 MSW 演示数据提供 */}
      <div style={{ background: '#fef3c7', color: '#92400e', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6, border: '1px solid #fcd34d', marginBottom: 12 }}>
        演示数据（后端待实现）：本页会诊数据由 MSW 演示数据提供，后端暂无 /consultations 接口
      </div>
      {loading && <LoadingBanner message="正在从 API 加载会诊数据..." />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: PRIMARY, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, background: PRIMARY, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Radio size={18} color='#fff' />
          </div>
          远程会诊管理
          <span style={{ fontSize: 12, fontWeight: 400, color: GRAY, marginLeft: 8 }}>远程会诊管理</span>
        </h1>
        <p style={{ fontSize: 13, color: GRAY, margin: 0 }}>疑难病例讨论 · MDT多学科会诊 · 远程影像会诊 · 二次意见 · 录音录像会诊</p>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab('会诊列表')}
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            border: activeTab === '会诊列表' ? 'none' : `1px solid ${BORDER}`,
            background: activeTab === '会诊列表' ? PRIMARY : WHITE,
            color: activeTab === '会诊列表' ? WHITE : GRAY,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <FileText size={16} />
          会诊列表
        </button>
        <button
          onClick={() => setActiveTab('录音录像会诊')}
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            border: activeTab === '录音录像会诊' ? 'none' : `1px solid ${BORDER}`,
            background: activeTab === '录音录像会诊' ? PRIMARY : WHITE,
            color: activeTab === '录音录像会诊' ? WHITE : GRAY,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Video size={16} />
          录音录像会诊
          <span style={{
            background: activeTab === '录音录像会诊' ? 'rgba(255,255,255,0.25)' : '#fee2e2',
            color: activeTab === '录音录像会诊' ? WHITE : DANGER,
            borderRadius: 10,
            padding: '2px 8px',
            fontSize: 12,
            fontWeight: 700,
          }}>{mockRecordingArchives.length}</span>
        </button>
      </div>

      {/* 会诊列表 Tab */}
      {activeTab === '会诊列表' && (
        <>
          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map(card => (
              <div key={card.label} style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: PRIMARY }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: GRAY }}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Main Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 16, alignItems: 'start' }}>
            {/* Left Panel - Consultation List */}
            <div style={{ background: WHITE, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {/* Search */}
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: LIGHT_BG }}>
                <div style={{ background: WHITE, borderRadius: 8, border: `1px solid ${BORDER}`, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Search size={14} color={GRAY} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="搜索患者姓名、会诊单号..."
                    style={{ border: 'none', outline: 'none', fontSize: 13, width: '100%', color: PRIMARY }}
                  />
                </div>
              </div>

              {/* Filter Tabs */}
              <div style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {filters.map(f => {
                  const count = f === '全部' ? consultations.length : consultations.filter(c => c.status === f).length
                  const isActive = filter === f
                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 16,
                        border: isActive ? 'none' : `1px solid ${BORDER}`,
                        background: isActive ? PRIMARY : WHITE,
                        color: isActive ? WHITE : GRAY,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      {f}
                      <span style={{
                        background: isActive ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                        color: isActive ? WHITE : GRAY,
                        borderRadius: 10,
                        padding: '1px 6px',
                        fontSize: 12,
                      }}>{count}</span>
                    </button>
                  )
                })}
              </div>

              {/* List */}
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: GRAY }}>
                    <AlertCircle size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                    <div style={{ fontSize: 13 }}>暂无会诊记录</div>
                  </div>
                ) : filtered.map((c, idx) => {
                  const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG['待回复']
                  const tc = TYPE_CONFIG[c.consultationType] || TYPE_CONFIG['疑难病例']
                  const isSelected = selectedId === c.id
                  const hasVideo = !!consultationVideoMap[c.id]
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      style={{
                        padding: '14px 16px',
                        borderBottom: `1px solid ${BORDER}`,
                        cursor: 'pointer',
                        background: isSelected ? '#eff6ff' : idx % 2 === 0 ? WHITE : '#fafbfc',
                        borderLeft: isSelected ? `3px solid ${ACCENT}` : '3px solid transparent',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#f0f7ff' }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = idx % 2 === 0 ? WHITE : '#fafbfc' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: PRIMARY }}>{c.patientName}</span>
                          {c.isRemote && (
                            <span style={{ padding: '1px 6px', background: '#ede9fe', color: '#6d28d9', borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Video size={9} />远程
                            </span>
                          )}
                          {hasVideo && (
                            <span
                              style={{ padding: '1px 6px', background: '#fee2e2', color: DANGER, borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                const archiveId = consultationVideoMap[c.id]
                                const archive = mockRecordingArchives.find(a => a.id === archiveId)
                                if (archive) {
                                  setSelectedArchive(archive)
                                  setVideoModalOpen(true)
                                }
                              }}
                              title="点击播放录音录像"
                            >
                              📹录像
                            </span>
                          )}
                        </div>
                        <span style={{ padding: '2px 10px', background: sc.bg, color: sc.color, borderRadius: 10, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {sc.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{ padding: '1px 8px', background: '#eff6ff', color: ACCENT, borderRadius: 4, fontSize: 12 }}>{c.modality}</span>
                        <span style={{ padding: '1px 8px', background: tc.bg, color: tc.color, borderRadius: 4, fontSize: 12 }}>{c.consultationType}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        <div>
                          <div style={{ fontSize: 12, color: GRAY }}>申请科室</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{c.requestingDepartment}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: GRAY }}>接收科室</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{c.consultedDepartment || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: GRAY }}>会诊医生</div>
                          <div style={{ fontSize: 12, color: '#334155' }}>{c.consultedDoctorName || '待指定'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: GRAY }}>申请时间</div>
                          <div style={{ fontSize: 12, color: '#334155' }}>{c.requestTime.split(' ')[0]}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: GRAY, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <FileText size={11} /> {c.requestReason.length > 30 ? c.requestReason.slice(0, 30) + '…' : c.requestReason}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right Panel - Consultation Detail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!selected ? (
                <div style={{ background: WHITE, borderRadius: 12, padding: 60, textAlign: 'center', border: `1px solid ${BORDER}` }}>
                  <AlertCircle size={48} color={GRAY} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <div style={{ fontSize: 15, color: GRAY }}>请从左侧选择一个会诊记录查看详情</div>
                </div>
              ) : (
                <>
                  {/* Header Info Card */}
                  <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <h2 style={{ fontSize: 18, fontWeight: 700, color: PRIMARY, margin: 0 }}>{selected.patientName}</h2>
                          <span style={{ padding: '2px 10px', background: STATUS_CONFIG[selected.status]?.bg, color: STATUS_CONFIG[selected.status]?.color, borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
                            {STATUS_CONFIG[selected.status]?.label}
                          </span>
                          {selected.isRemote && (
                            <span style={{ padding: '2px 8px', background: '#ede9fe', color: '#6d28d9', borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Video size={11} />远程会诊
                            </span>
                          )}
                          {consultationVideoMap[selected.id] && (
                            <span
                              style={{ padding: '2px 8px', background: '#fee2e2', color: DANGER, borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                              onClick={() => {
                                const archiveId = consultationVideoMap[selected.id]
                                const archive = mockRecordingArchives.find(a => a.id === archiveId)
                                if (archive) {
                                  setSelectedArchive(archive)
                                  setVideoModalOpen(true)
                                }
                              }}
                            >
                              <Film size={11} />📹有录像
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: GRAY }}>会诊单号：{selected.id}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={handleUpload} style={{ padding: '6px 14px', background: '#f0f7ff', color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Upload size={13} />上传资料
                        </button>
                        <button onClick={handlePrint} style={{ padding: '6px 14px', background: '#f0f7ff', color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Printer size={13} />打印会诊单
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                      {[
                        { label: '会诊单号', value: selected.id, icon: <FileText size={14} color={GRAY} /> },
                        { label: '申请时间', value: selected.requestTime, icon: <Calendar size={14} color={GRAY} /> },
                        { label: '会诊类型', value: selected.consultationType, icon: <Users size={14} color={GRAY} /> },
                        { label: '会诊科室', value: selected.consultedDepartment || '待指定', icon: <MapPin size={14} color={GRAY} /> },
                      ].map(item => (
                        <div key={item.label} style={{ background: LIGHT_BG, borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                            {item.icon}
                            <span style={{ fontSize: 12, color: GRAY }}>{item.label}</span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: PRIMARY }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
                      {selected.status === '待回复' && (
                        <>
                          <button onClick={handleAccept} style={{ padding: '8px 20px', background: SUCCESS, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CheckCircle size={15} />接受会诊
                          </button>
                          <button onClick={handleReject} style={{ padding: '8px 20px', background: WHITE, color: DANGER, border: `1px solid ${DANGER}`, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <X size={15} />拒绝会诊
                          </button>
                        </>
                      )}
                      <button onClick={handleSubmitConclusion} style={{ padding: '8px 20px', background: PRIMARY, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Send size={15} />提交会诊结论
                      </button>
                    </div>
                  </div>

                  {/* Patient & Exam Info */}
                  <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={16} color={ACCENT} />患者与检查信息
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {/* Patient Info */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>患者基本信息</div>
                        {(() => {
                          const patient = getPatientForConsultation(selected)
                          return patient ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              {[
                                { label: '姓名', value: patient.name },
                                { label: '性别', value: patient.gender },
                                { label: '年龄', value: `${patient.age}岁` },
                                { label: '类型', value: patient.patientType },
                                { label: '电话', value: patient.phone },
                                { label: '主诊断', value: patient.primaryDiagnosis },
                              ].map(item => (
                                <div key={item.label} style={{ background: LIGHT_BG, borderRadius: 6, padding: '6px 10px' }}>
                                  <div style={{ fontSize: 12, color: GRAY }}>{item.label}</div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>{item.value}</div>
                                </div>
                              ))}
                            </div>
                          ) : <div style={{ color: GRAY, fontSize: 13 }}>未找到患者信息</div>
                        })()}
                      </div>
                      {/* Exam Info */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>检查信息</div>
                        {(() => {
                          const exam = getExamForConsultation(selected)
                          return exam ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              {[
                                { label: '检查项目', value: exam.examItemName },
                                { label: '检查日期', value: exam.examDate },
                                { label: '设备', value: exam.deviceName?.split('（')[0] },
                                { label: '影像数量', value: `${exam.imagesAcquired}幅` },
                                { label: '检查号', value: exam.accessionNumber },
                                { label: '临床诊断', value: exam.clinicalDiagnosis },
                              ].map(item => (
                                <div key={item.label} style={{ background: LIGHT_BG, borderRadius: 6, padding: '6px 10px' }}>
                                  <div style={{ fontSize: 12, color: GRAY }}>{item.label}</div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>{item.value}</div>
                                </div>
                              ))}
                            </div>
                          ) : <div style={{ color: GRAY, fontSize: 13 }}>未找到检查信息</div>
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Consultation Purpose & Clinical Info */}
                  <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Stethoscope size={16} color={ACCENT} />会诊目的与临床信息
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {[
                        { label: '会诊目的描述', value: selected.requestReason, icon: <MessageSquare size={14} color={ACCENT} /> },
                        { label: '临床诊断', value: getExamForConsultation(selected)?.clinicalDiagnosis || '—', icon: <Activity size={14} color={ACCENT} /> },
                        { label: '相关检查结果', value: getExamForConsultation(selected)?.relevantLabResults || '暂无实验室检查结果', icon: <FileText size={14} color={ACCENT} /> },
                      ].map(item => (
                        <div key={item.label} style={{ background: LIGHT_BG, borderRadius: 8, padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            {item.icon}
                            <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{item.label}</span>
                          </div>
                          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock3 size={16} color={ACCENT} />会诊进度时间轴
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {timeline.map((node, idx) => (
                        <div key={node.label} style={{ display: 'flex', alignItems: 'stretch', minHeight: 72 }}>
                          {/* Connector line */}
                          {idx < timeline.length - 1 && (
                            <div style={{ position: 'absolute', left: 19, top: 40, bottom: -16, width: 2, background: node.status === 'done' ? ACCENT : BORDER, zIndex: 0 }} />
                          )}
                          {/* Node */}
                          <div style={{ position: 'relative', zIndex: 1, width: 40, minWidth: 40, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: node.status === 'done' ? ACCENT : node.status === 'current' ? WHITE : LIGHT_BG,
                              border: `2px solid ${node.status === 'done' ? ACCENT : node.status === 'current' ? ACCENT : BORDER}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: node.status === 'done' ? WHITE : node.status === 'current' ? ACCENT : GRAY,
                              boxShadow: node.status === 'current' ? `0 0 0 4px ${ACCENT}22` : 'none',
                            }}>
                              {node.icon}
                            </div>
                          </div>
                          {/* Content */}
                          <div style={{ flex: 1, padding: '6px 12px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: node.status === 'pending' ? GRAY : PRIMARY }}>{node.label}</div>
                              <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>操作人：{node.operator}</div>
                            </div>
                            <div style={{ fontSize: 12, color: GRAY, textAlign: 'right' }}>
                              <div>{node.time !== '—' ? '时间' : ''}</div>
                              <div style={{ fontWeight: 600, color: node.status === 'pending' ? GRAY : PRIMARY }}>{node.time}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Consultation Conclusion */}
                  <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MessageSquare size={16} color={ACCENT} />会诊结论区
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>
                          会诊医生意见 <span style={{ color: DANGER }}>*</span>
                        </label>
                        <textarea
                          value={conclusionText}
                          onChange={e => setConclusionText(e.target.value)}
                          placeholder="请输入会诊医生的详细意见..."
                          rows={4}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, color: PRIMARY, resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
                          onFocus={e => e.target.style.borderColor = ACCENT}
                          onBlur={e => e.target.style.borderColor = BORDER}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>
                          诊断建议
                        </label>
                        <textarea
                          value={diagnosisAdvice}
                          onChange={e => setDiagnosisAdvice(e.target.value)}
                          placeholder="请输入诊断建议和治疗方案建议..."
                          rows={3}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, color: PRIMARY, resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
                          onFocus={e => e.target.style.borderColor = ACCENT}
                          onBlur={e => e.target.style.borderColor = BORDER}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>
                          参考资料
                        </label>
                        <textarea
                          value={referenceInfo}
                          onChange={e => setReferenceInfo(e.target.value)}
                          placeholder="请输入参考资料、文献依据等..."
                          rows={2}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, color: PRIMARY, resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
                          onFocus={e => e.target.style.borderColor = ACCENT}
                          onBlur={e => e.target.style.borderColor = BORDER}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Consultation Evaluation */}
                  <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ThumbsUp size={16} color={ACCENT} />会诊评价
                      </h3>
                      <button
                        onClick={() => setShowRatingModal(true)}
                        style={{ padding: '4px 12px', background: '#f0f7ff', color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Edit3 size={12} />详细评分
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={{ background: LIGHT_BG, borderRadius: 8, padding: '14px 16px' }}>
                        <div style={{ fontSize: 12, color: GRAY, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Shield size={12} />会诊质量评分
                        </div>
                        <div style={{ marginBottom: 8 }}>{renderStars(qualityScore)}</div>
                        <div style={{ fontSize: 12, color: GRAY }}>综合评分：<span style={{ fontWeight: 700, color: PRIMARY }}>{qualityScore}.0/5.0</span></div>
                      </div>
                      <div style={{ background: LIGHT_BG, borderRadius: 8, padding: '14px 16px' }}>
                        <div style={{ fontSize: 12, color: GRAY, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Heart size={12} />满意度评价
                        </div>
                        <div style={{ marginBottom: 8 }}>{renderStars(satisfactionScore, setSatisfactionScore)}</div>
                        <div style={{ fontSize: 12, color: GRAY }}>满意度：<span style={{ fontWeight: 700, color: PRIMARY }}>{satisfactionScore}.0/5.0</span></div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* 录音录像会诊 Tab */}
      {activeTab === '录音录像会诊' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {recordingStatCards.map(card => (
              <div key={card.label} style={{ background: WHITE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: PRIMARY }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: GRAY }}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* 会诊录音录像控制面板 */}
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Video size={16} color={ACCENT} />会诊录音录像控制面板
              </h3>

              {/* 当前会诊信息 */}
              <div style={{ background: LIGHT_BG, borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 10 }}>当前会诊信息</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: GRAY }}>会诊ID</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>{selected?.id || 'CST2026050101'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: GRAY }}>患者姓名</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>{selected?.patientName || '张伟'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: GRAY }}>参与医生</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>{selected?.consultedDoctorName || '王建国 主任医师'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: GRAY }}>开始时间</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>{selected?.requestTime || '2026-05-01 14:30'}</div>
                  </div>
                </div>
              </div>

              {/* 录制控制 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 12 }}>录制控制</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {/* 录制按钮 */}
                  {recordingStatus === '准备中' && (
                    <button
                      onClick={handleStartRecording}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: '#fee2e2',
                        border: '3px solid #dc2626',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 0 4px rgba(220, 38, 38, 0.2)',
                      }}
                    >
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#dc2626' }} />
                    </button>
                  )}

                  {recordingStatus === '录制中' && (
                    <button
                      onClick={handleStartRecording}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: '#fee2e2',
                        border: '3px solid #dc2626',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 0 4px rgba(220, 38, 38, 0.2)',
                        animation: 'pulse 1.5s infinite',
                      }}
                    >
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#dc2626' }} />
                    </button>
                  )}

                  {/* 暂停/继续按钮 */}
                  {(recordingStatus === '录制中' || recordingStatus === '已暂停') && (
                    <button
                      onClick={handlePauseRecording}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: recordingStatus === '已暂停' ? '#dbeafe' : '#fef3c7',
                        border: `2px solid ${recordingStatus === '已暂停' ? '#2563eb' : '#d97706'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {recordingStatus === '已暂停' ? <Play size={20} color="#2563eb" /> : <Pause size={20} color="#d97706" />}
                    </button>
                  )}

                  {/* 停止按钮 */}
                  {(recordingStatus === '录制中' || recordingStatus === '已暂停') && (
                    <button
                      onClick={handleStopRecording}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: '#f1f5f9',
                        border: '2px solid #64748b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Square size={18} color="#64748b" />
                    </button>
                  )}

                  {/* 重新开始 */}
                  {recordingStatus === '已完成' && (
                    <button
                      onClick={() => {
                        setRecordingStatus('准备中')
                        setRecordingSeconds(0)
                      }}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        background: PRIMARY,
                        border: 'none',
                        color: WHITE,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <RefreshCw size={14} />重新开始
                    </button>
                  )}

                  {/* 录制时长 */}
                  <div style={{
                    padding: '8px 16px',
                    background: recordingStatus === '录制中' ? '#fee2e2' : recordingStatus === '已暂停' ? '#fef3c7' : LIGHT_BG,
                    borderRadius: 8,
                    minWidth: 120,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 12, color: GRAY }}>录制时长</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: recordingStatus === '录制中' ? DANGER : PRIMARY, fontFamily: 'monospace' }}>
                      {formatTime(recordingSeconds)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 当前状态标签 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: GRAY }}>当前状态：</span>
                <span style={{
                  padding: '4px 12px',
                  background: RECORDING_STATUS_CONFIG[recordingStatus]?.bg,
                  color: RECORDING_STATUS_CONFIG[recordingStatus]?.color,
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  {recordingStatus === '录制中' && '● '}{RECORDING_STATUS_CONFIG[recordingStatus]?.label}
                </span>
              </div>
            </div>

            {/* 录像预览区 */}
            <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Film size={16} color={ACCENT} />录像预览区
              </h3>

              {/* 视频预览 */}
              <div style={{
                background: '#1a1a2e',
                borderRadius: 8,
                padding: 16,
                marginBottom: 12,
                position: 'relative',
              }}>
                <div style={{
                  aspectRatio: '16/9',
                  background: 'linear-gradient(135deg, #1e40af 0%, #16213e 100%)',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.3)',
                  fontSize: 14,
                }}>
                  {isPlaying ? (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                      <Play size={48} />
                      <div style={{ marginTop: 8 }}>录像播放中...</div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                      <Video size={48} />
                      <div style={{ marginTop: 8 }}>点击播放预览</div>
                    </div>
                  )}
                </div>

                {/* 视频播放控制条 */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <button
                      onClick={handlePlayPause}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: PRIMARY,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isPlaying ? <Pause size={16} color="white" /> : <Play size={16} color="white" />}
                    </button>

                    {/* 进度条 */}
                    <div
                      onClick={handleSeek}
                      style={{
                        flex: 1,
                        height: 6,
                        background: '#334155',
                        borderRadius: 3,
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                    >
                      <div style={{
                        width: `${videoProgress}%`,
                        height: '100%',
                        background: PRIMARY,
                        borderRadius: 3,
                        transition: 'width 0.1s',
                      }} />
                    </div>

                    {/* 音量 */}
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'rgba(255,255,255,0.6)',
                        padding: 4,
                      }}
                    >
                      {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>

                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'monospace' }}>
                      {Math.floor(videoProgress * 0.45)}:{(Math.floor(videoProgress * 2.7) % 60).toString().padStart(2, '0')} / 45:23
                    </span>
                  </div>

                  {/* 录像缩略图时间轴 */}
                  <div style={{
                    display: 'flex',
                    gap: 2,
                    height: 32,
                    background: '#0f0f1a',
                    borderRadius: 4,
                    padding: 4,
                    overflow: 'hidden',
                  }}>
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          background: i % 4 === 0 ? '#2d3748' : '#1a202c',
                          borderRadius: 2,
                          position: 'relative',
                        }}
                      >
                        {i % 4 === 0 && (
                          <span style={{
                            position: 'absolute',
                            bottom: -14,
                            left: 0,
                            fontSize: 8,
                            color: 'rgba(255,255,255,0.4)',
                          }}>
                            {i * 2}m
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 快照截图按钮 */}
              <button
                onClick={handleSnapshot}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: 8,
                  background: '#f0f7ff',
                  border: `1px solid ${ACCENT}`,
                  color: ACCENT,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Camera size={16} />快照截图
              </button>
            </div>
          </div>

          {/* 录音录像存档列表 */}
          <div style={{ background: WHITE, borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Film size={16} color={ACCENT} />录音录像存档列表
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: LIGHT_BG }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: PRIMARY, borderBottom: `1px solid ${BORDER}` }}>存档ID</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: PRIMARY, borderBottom: `1px solid ${BORDER}` }}>会诊ID</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: PRIMARY, borderBottom: `1px solid ${BORDER}` }}>患者姓名</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: PRIMARY, borderBottom: `1px solid ${BORDER}` }}>录制时长</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: PRIMARY, borderBottom: `1px solid ${BORDER}` }}>文件大小</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: PRIMARY, borderBottom: `1px solid ${BORDER}` }}>存档时间</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: PRIMARY, borderBottom: `1px solid ${BORDER}` }}>状态</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: PRIMARY, borderBottom: `1px solid ${BORDER}` }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {mockRecordingArchives.map((archive, idx) => (
                    <tr
                      key={archive.id}
                      style={{
                        background: idx % 2 === 0 ? WHITE : '#fafbfc',
                        borderBottom: `1px solid ${BORDER}`,
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: PRIMARY }}>{archive.id}</td>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>{archive.consultationId}</td>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>{archive.patientName}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#334155' }}>{archive.duration}</td>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>{archive.fileSize}</td>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>{archive.recordTime}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 600,
                          background: archive.status === '可用' ? '#d1fae5' : archive.status === '处理中' ? '#fef3c7' : '#fee2e2',
                          color: archive.status === '可用' ? '#059669' : archive.status === '处理中' ? '#d97706' : '#dc2626',
                        }}>
                          {archive.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handlePlayArchive(archive)}
                            disabled={archive.status !== '可用'}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 4,
                              background: archive.status === '可用' ? '#f0f7ff' : '#f1f5f9',
                              border: `1px solid ${archive.status === '可用' ? ACCENT : BORDER}`,
                              color: archive.status === '可用' ? ACCENT : GRAY,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: archive.status === '可用' ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Play size={11} />播放
                          </button>
                          <button
                            onClick={() => handleDownloadArchive(archive)}
                            disabled={archive.status !== '可用'}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 4,
                              background: archive.status === '可用' ? '#f0f7ff' : '#f1f5f9',
                              border: `1px solid ${archive.status === '可用' ? ACCENT : BORDER}`,
                              color: archive.status === '可用' ? ACCENT : GRAY,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: archive.status === '可用' ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Download size={11} />下载
                          </button>
                          <button
                            onClick={() => handleDeleteArchive(archive)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 4,
                              background: '#fff',
                              border: '1px solid #fee2e2',
                              color: DANGER,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <X size={11} />删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: 480, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: PRIMARY, margin: 0 }}>会诊质量详细评分</h3>
              <button onClick={() => setShowRatingModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY, padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {ratingModalData.map((item, idx) => (
                <div key={item.dimension} style={{ background: LIGHT_BG, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{item.dimension}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>{item.score}分</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <button
                        key={s}
                        onClick={() => {
                          const updated = [...ratingModalData]
                          updated[idx].score = s
                          setRatingModalData(updated)
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                      >
                        <Star size={22} fill={s <= item.score ? '#f59e0b' : 'none'} color={s <= item.score ? '#f59e0b' : '#d1d5db'} />
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={item.comment}
                    onChange={e => {
                      const updated = [...ratingModalData]
                      updated[idx].comment = e.target.value
                      setRatingModalData(updated)
                    }}
                    placeholder={`${item.dimension}评语（选填）`}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRatingModal(false)} style={{ padding: '8px 20px', background: LIGHT_BG, color: GRAY, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                取消
              </button>
              <button onClick={handleSubmitRating} style={{ padding: '8px 20px', background: PRIMARY, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Playback Modal */}
      {videoModalOpen && selectedArchive && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: 800, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: PRIMARY, margin: '0 0 4px' }}>录像播放 - {selectedArchive.patientName}</h3>
                <div style={{ fontSize: 12, color: GRAY }}>{selectedArchive.consultationId} | {selectedArchive.duration} | {selectedArchive.fileSize}</div>
              </div>
              <button
                onClick={() => {
                  setVideoModalOpen(false)
                  setIsPlaying(false)
                  if (videoProgressRef.current) {
                    clearInterval(videoProgressRef.current)
                    videoProgressRef.current = null
                  }
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY, padding: 4 }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Video Player */}
            <div style={{
              background: '#1a1a2e',
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}>
              <div style={{
                aspectRatio: '16/9',
                background: 'linear-gradient(135deg, #1e40af 0%, #16213e 100%)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.5)',
              }}>
                {isPlaying ? (
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    <Play size={64} />
                    <div style={{ marginTop: 12, fontSize: 16 }}>录像播放中</div>
                    <div style={{ fontSize: 12, marginTop: 8, fontFamily: 'monospace' }}>{formatTime(Math.floor(videoProgress * 2.7))}</div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                    <Video size={64} />
                    <div style={{ marginTop: 12, fontSize: 16 }}>点击播放</div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <button
                    onClick={handlePlayPause}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: PRIMARY,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isPlaying ? <Pause size={18} color="white" /> : <Play size={18} color="white" />}
                  </button>

                  <button
                    onClick={() => setVideoProgress(Math.max(0, videoProgress - 10))}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'rgba(255,255,255,0.6)',
                    }}
                  >
                    <SkipBack size={20} />
                  </button>

                  <button
                    onClick={() => setVideoProgress(Math.min(100, videoProgress + 10))}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'rgba(255,255,255,0.6)',
                    }}
                  >
                    <SkipForward size={20} />
                  </button>

                  {/* Progress */}
                  <div
                    onClick={handleSeek}
                    style={{
                      flex: 1,
                      height: 8,
                      background: '#334155',
                      borderRadius: 4,
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <div style={{
                      width: `${videoProgress}%`,
                      height: '100%',
                      background: PRIMARY,
                      borderRadius: 4,
                      transition: 'width 0.1s',
                    }} />
                  </div>

                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'monospace', minWidth: 80 }}>
                    {formatTime(Math.floor(videoProgress * 2.7))} / {selectedArchive.duration}
                  </span>

                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                </div>

                {/* Thumbnail Timeline */}
                <div style={{
                  display: 'flex',
                  gap: 2,
                  height: 40,
                  background: '#0f0f1a',
                  borderRadius: 4,
                  padding: 4,
                  overflow: 'hidden',
                }}>
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        background: i % 3 === 0 ? '#2d3748' : '#1a202c',
                        borderRadius: 2,
                        position: 'relative',
                      }}
                    >
                      {i % 3 === 0 && (
                        <span style={{
                          position: 'absolute',
                          bottom: -16,
                          left: 0,
                          fontSize: 8,
                          color: 'rgba(255,255,255,0.4)',
                        }}>
                          {i * 1.5}m
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={handleSnapshot}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: '#f0f7ff',
                  border: `1px solid ${ACCENT}`,
                  color: ACCENT,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Camera size={14} />快照截图
              </button>
              <button
                onClick={() => handleDownloadArchive(selectedArchive)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: PRIMARY,
                  border: 'none',
                  color: WHITE,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Download size={14} />下载录像
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pulse animation for recording indicator */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.2); }
          50% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0.4); }
        }
      `}</style>

      {/* Toast Notification */}
      {toast.show && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 2000,
          padding: '12px 20px',
          borderRadius: 10,
          background: toast.type === 'success' ? '#059669' : toast.type === 'progress' ? '#2563eb' : '#64748b',
          color: 'white',
          fontSize: 13,
          fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          maxWidth: 360,
        }}>
          {toast.type === 'success' && <CheckCircle size={16} />}
          {toast.type === 'progress' && <Activity size={16} />}
          {toast.type === 'info' && <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: 480, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: PRIMARY, margin: 0 }}>补充资料上传</h3>
              <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY, padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ border: `2px dashed ${BORDER}`, borderRadius: 12, padding: '32px 16px', textAlign: 'center', marginBottom: 16 }}>
              <Upload size={32} color={GRAY} style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: GRAY, marginBottom: 8 }}>将文件拖拽到此处，或点击选择文件</div>
              <div style={{ fontSize: 12, color: GRAY }}>支持 DICOM、PDF、JPG、PNG 等格式</div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowUploadModal(false)} style={{ padding: '8px 20px', background: LIGHT_BG, color: GRAY, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                取消
              </button>
              <button onClick={() => { showToast('资料上传成功', 'success'); setShowUploadModal(false) }} style={{ padding: '8px 20px', background: PRIMARY, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                开始上传
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conclusion Modal */}
      {showConclusionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: 520, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: PRIMARY, margin: 0 }}>确认会诊结论</h3>
              <button onClick={() => setShowConclusionModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY, padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div style={{ background: LIGHT_BG, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>会诊医生意见</div>
                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>{conclusionText || '（未填写）'}</div>
              </div>
              <div style={{ background: LIGHT_BG, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>诊断建议</div>
                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>{diagnosisAdvice || '（未填写）'}</div>
              </div>
              <div style={{ background: LIGHT_BG, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>参考资料</div>
                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>{referenceInfo || '（未填写）'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowConclusionModal(false)} style={{ padding: '8px 20px', background: LIGHT_BG, color: GRAY, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                返回修改
              </button>
              <button onClick={() => { setShowConclusionModal(false); showToast('会诊结论已提交', 'success') }} style={{ padding: '8px 20px', background: SUCCESS, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: DANGER, margin: 0 }}>确认删除存档</h3>
              <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY, padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, marginBottom: 20 }}>
              确定删除存档 <strong>{deleteTarget.id}</strong> 吗？此操作不可恢复。
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null) }} style={{ padding: '8px 20px', background: LIGHT_BG, color: GRAY, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                取消
              </button>
              <button onClick={() => { setShowDeleteModal(false); showToast(`存档 ${deleteTarget.id} 已删除`, 'info'); setDeleteTarget(null) }} style={{ padding: '8px 20px', background: DANGER, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
