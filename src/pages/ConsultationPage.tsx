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
import { consultationApi, type ConsultationDto } from '../services/api'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import { t } from '../i18n/appI18n'
import { StatusTag } from '../components/common/StatusTag'
import { DataTable } from '../components/common'

const PRIMARY = 'var(--color-primary-800)'
const ACCENT = 'var(--color-primary-500)'
const SUCCESS = '#059669'
const WARNING = 'var(--color-warning-600)'
const DANGER = 'var(--color-error-600)'
const GRAY = 'var(--text-secondary, #475569)'
const LIGHT_BG = 'var(--bg-card)'
const BORDER = 'var(--border-color)'
const WHITE = 'var(--bg-card, #ffffff)'

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  '待回复': { bg: '#f59e0b22', color: 'var(--color-warning-500)', label: '待回复' },
  '已回复': { bg: '#22c55e22', color: '#059669', label: '已回复' },
  '已拒绝': { bg: 'var(--bg-deep)', color: 'var(--text-secondary)', label: '已拒绝' },
  '进行中': { bg: '#3b82f622', color: 'var(--color-primary-500)', label: '进行中' },
  '已完成': { bg: '#22c55e22', color: '#059669', label: '已完成' },
}

const TYPE_CONFIG: Record<string, { bg: string; color: string }> = {
  'MDT': { bg: '#8b5cf622', color: '#6d28d9' },
  '疑难病例': { bg: '#f59e0b22', color: '#b45309' },
  '远程会诊': { bg: '#3b82f622', color: 'var(--color-primary-500)' },
  '二次意见': { bg: '#22c55e22', color: '#047857' },
}

const RECORDING_STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  '准备中': { bg: 'var(--bg-deep)', color: 'var(--text-secondary)', label: '准备中' },
  '录制中': { bg: '#ef444422', color: 'var(--color-error-500)', label: '录制中' },
  '已暂停': { bg: '#f59e0b22', color: 'var(--color-warning-500)', label: '已暂停' },
  '已完成': { bg: '#22c55e22', color: '#059669', label: '已完成' },
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
      label: t('consultation.timelineSubmitted'),
      time: consultation.requestTime,
      operator: consultation.requestingDoctorName,
      status: 'done',
      icon: <FileText size={14} />,
    },
    {
      label: t('consultation.timelineConfirmed'),
      time: consultation.responseTime || '—',
      operator: consultation.consultedDoctorName || t('consultation.assignPending'),
      status: consultation.status === '待回复' ? 'pending' : 'done',
      icon: <CheckCircle size={14} />,
    },
    {
      label: t('consultation.timelineTransfer'),
      time: consultation.status !== '待回复' ? '2026-05-01 15:00' : '—',
      operator: t('consultation.systemAuto'),
      status: consultation.status === '已回复' || consultation.status === '已完成' ? 'done' : 'pending',
      icon: <Image size={14} />,
    },
    {
      label: t('consultation.timelineInProgress'),
      time: consultation.status === '已回复' ? '2026-05-01 15:30' : '—',
      operator: consultation.consultedDoctorName || '—',
      status: consultation.status === '已回复' ? 'current' : 'pending',
      icon: <MessageSquare size={14} />,
    },
    {
      label: t('consultation.timelineCompleted'),
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
  const [activeTab, setActiveTab] = useState<'会诊列表' | '录音录像会诊' | '登记与查询'>('会诊列表')
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
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)

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

  // [G005 2B] 会诊统计 (GET /consultations/stats, 失败回退本地计算)
  const [consultStats, setConsultStats] = useState<any>(null)
  useEffect(() => {
    void consultationApi.getStats().then(res => {
      if (res.success && res.data) setConsultStats(res.data)
    }).catch(() => { /* 后端不可用 → 本地计算 */ })
  }, [])

  // [G005 Wave1A] 登记与查询: create / pending / by-patient / by-doctor / update
  const [regSection, setRegSection] = useState<'create' | 'pending' | 'query'>('create')
  const [pendingConsults, setPendingConsults] = useState<ConsultationDto[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [queryByPatientId, setQueryByPatientId] = useState('')
  const [queryByDoctorId, setQueryByDoctorId] = useState('')
  const [queryResults, setQueryResults] = useState<ConsultationDto[]>([])
  const [queryResultType, setQueryResultType] = useState<'patient' | 'doctor' | null>(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [createForm, setCreateForm] = useState({
    patientName: '',
    modality: 'CT',
    bodyPart: '',
    consultationType: '疑难病例',
    requestingDepartment: '',
    consultedDepartment: '',
    requestReason: '',
    priority: 'normal',
  })
  const [creating, setCreating] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<Partial<ConsultationDto>>({})
  const [updating, setUpdating] = useState(false)

  const loadPending = async () => {
    setPendingLoading(true)
    try {
      const res = await consultationApi.getPending()
      if (res.success && Array.isArray(res.data)) setPendingConsults(res.data as ConsultationDto[])
      else setPendingConsults([])
    } catch {
      setPendingConsults([])
    } finally {
      setPendingLoading(false)
    }
  }

  const handleCreateConsultation = async () => {
    if (!createForm.patientName.trim()) {
      showToast(t('consultation.inputPatientName'), 'info')
      return
    }
    setCreating(true)
    try {
      const res = await consultationApi.create({ ...createForm, bodyPart: createForm.bodyPart.trim() || '头部', requestReason: createForm.requestReason.trim() || '请专家会诊' })
      if (res.success) {
        showToast(t('consultation.registration.createSuccess'), 'success')
        setCreateForm({ ...createForm, patientName: '', bodyPart: '', requestingDepartment: '', consultedDepartment: '', requestReason: '' })
        void consultationApi.list().then(r => {
          if (r.success && Array.isArray(r.data) && r.data.length > 0) setConsultations(r.data as unknown as typeof initialConsultations)
        })
      } else {
        showToast(res.error?.message ?? t('consultation.registration.createFailed'), 'info')
      }
    } catch {
      showToast(t('consultation.registration.createFailed'), 'info')
    } finally {
      setCreating(false)
    }
  }

  const handleQueryByPatient = async () => {
    const id = queryByPatientId.trim()
    if (!id) { showToast(t('consultation.inputPatientId'), 'info'); return }
    setQueryLoading(true)
    setQueryResultType('patient')
    try {
      const res = await consultationApi.getByPatient(id)
      if (res.success && Array.isArray(res.data)) setQueryResults(res.data as ConsultationDto[])
      else setQueryResults([])
    } catch {
      setQueryResults([])
    } finally {
      setQueryLoading(false)
    }
  }

  const handleQueryByDoctor = async () => {
    const id = queryByDoctorId.trim()
    if (!id) { showToast(t('consultation.inputDoctorId'), 'info'); return }
    setQueryLoading(true)
    setQueryResultType('doctor')
    try {
      const res = await consultationApi.getByDoctor(id)
      if (res.success && Array.isArray(res.data)) setQueryResults(res.data as ConsultationDto[])
      else setQueryResults([])
    } catch {
      setQueryResults([])
    } finally {
      setQueryLoading(false)
    }
  }

  const openEditModal = () => {
    if (!selected) return
    setEditForm({
      patientName: selected.patientName,
      modality: selected.modality,
      bodyPart: selected.bodyPart,
      consultationType: selected.consultationType,
      requestingDepartment: selected.requestingDepartment,
      consultedDepartment: selected.consultedDepartment,
      requestReason: selected.requestReason,
      priority: selected.priority,
    })
    setShowEditModal(true)
  }

  const handleUpdateConsultation = async () => {
    if (!selected) return
    setUpdating(true)
    try {
      const res = await consultationApi.update(selected.id, editForm)
      if (res.success) {
        setConsultations(prev => prev.map(c => c.id === selected.id ? { ...c, ...editForm } : c))
        setShowEditModal(false)
        showToast(t('consultation.registration.updateSuccess'), 'success')
      } else {
        showToast(res.error?.message ?? t('consultation.registration.updateFailed'), 'info')
      }
    } catch {
      showToast(t('consultation.registration.updateFailed'), 'info')
    } finally {
      setUpdating(false)
    }
  }

  const renderRegResultRow = (c: ConsultationDto) => (
    <div key={c.id} role="button" tabIndex={0} onClick={() => { setSelectedId(c.id); setActiveTab('会诊列表') }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(c.id); setActiveTab('会诊列表') } }} style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: 'var(--bg-card)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>{c.patientName || '—'} <span style={{ fontWeight: 400, color: GRAY, fontSize: 12 }}>#{c.id}</span></div>
        <div style={{ fontSize: 12, color: GRAY }}>{c.modality} · {c.bodyPart} · {c.consultationType || c.type}</div>
      </div>
      <StatusTag size="md" style={{ fontWeight: 700 }} tone={{ bg: STATUS_CONFIG[c.status]?.bg ?? 'var(--bg-primary, #f8fafc)', border: 'transparent', color: STATUS_CONFIG[c.status]?.color ?? GRAY, dot: STATUS_CONFIG[c.status]?.color ?? GRAY }}>
        {STATUS_CONFIG[c.status]?.label ?? c.status}
      </StatusTag>
    </div>
  )

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
        setLoadError(t('consultation.apiUnavailable'))
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

  // [G005 2B] 接受会诊 → 后端 POST /consultations/:id/start (失败本地回退)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const handleAccept = async () => {
    if (!selected) return
    setAcceptingId(selected.id)
    try {
      const res = await consultationApi.start(selected.id)
      if (res.success) {
        setConsultations(prev => prev.map(c => c.id === selected.id ? { ...c, status: '已回复' as const } : c))
        showToast(t('consultation.acceptStarted'), 'success')
      } else {
        setConsultations(prev => prev.map(c => c.id === selected.id ? { ...c, status: '已回复' as const } : c))
        showToast(t('consultation.acceptLocalFallback'), 'info')
      }
    } catch {
      setConsultations(prev => prev.map(c => c.id === selected.id ? { ...c, status: '已回复' as const } : c))
      showToast(t('consultation.acceptLocal'), 'success')
    } finally {
      setAcceptingId(null)
    }
  }

  // [G005 2B] 邀请专家 → 后端 POST /consultations/:id/invite
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteDoctorIds, setInviteDoctorIds] = useState('')
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const handleInvite = async () => {
    if (!selected) return
    const doctorIds = inviteDoctorIds.split(',').map(s => s.trim()).filter(Boolean)
    if (doctorIds.length === 0) {
      showToast(t('consultation.inputExpertId'), 'info')
      return
    }
    setInvitingId(selected.id)
    try {
      const res = await consultationApi.invite(selected.id, doctorIds)
      if (res.success) {
        showToast(`已邀请 ${doctorIds.length} 位专家 (${doctorIds.join(', ')})`, 'success')
      } else {
        showToast(res.error?.message ?? t('consultation.inviteFailed'), 'info')
      }
    } catch {
      showToast(t('consultation.inviteUnavailable'), 'info')
    } finally {
      setInvitingId(null)
      setShowInviteModal(false)
    }
  }

  const handleReject = () => {
    showToast(t('consultation.rejected'), 'info')
  }

  // [G005 Wave1B] 详情刷新: consultationApi.getById 合并最新字段 (失败保持列表数据)
  const handleSelectConsultation = (id: string) => {
    setSelectedId(id)
    void consultationApi.getById(id).then((res) => {
      if (res.success && res.data) {
        setConsultations(prev => prev.map(c => c.id === id ? { ...c, ...res.data } : c))
      }
    }).catch(() => { /* 详情接口不可用, 保持列表数据 */ })
  }

  // [G005 Wave1B] 取消会诊: consultationApi.cancel (POST /consultations/:id/cancel)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const handleCancelConsultation = async () => {
    if (!selected) return
    setCancellingId(selected.id)
    try {
      const res = await consultationApi.cancel(selected.id)
      if (res.success) {
        setConsultations(prev => prev.map(c => c.id === selected.id ? { ...c, status: '已拒绝' as const } : c))
        showToast(t('consultation.cancelled'), 'success')
      } else {
        showToast(res.error?.message ?? t('consultation.cancelFailed'), 'info')
      }
    } catch {
      setConsultations(prev => prev.map(c => c.id === selected.id ? { ...c, status: '已拒绝' as const } : c))
      showToast(t('consultation.cancelledLocal'), 'success')
    } finally {
      setCancellingId(null)
    }
  }

  const handleUpload = () => {
    setShowUploadModal(true)
  }

  // [Wave2A] 附件选择 (文件输入)
  const handleSelectFiles = (files: FileList | null) => {
    if (!files) return
    setUploadFiles(prev => [...prev, ...Array.from(files)].slice(0, 10))
  }

  const handleRemoveUploadFile = (name: string) => {
    setUploadFiles(prev => prev.filter(f => f.name !== name))
  }

  // [Wave2A] 开始上传: 后端无会诊附件端点 → 本地预览 + 标注
  const handleStartUpload = () => {
    if (uploadFiles.length === 0) {
      showToast(t('consultation.selectFilesFirst'), 'info')
      return
    }
    setUploading(true)
    showToast(t('consultation.uploading'), 'progress')
    setTimeout(() => {
      setUploading(false)
      showToast(`已上传 ${uploadFiles.length} 个文件 (本地预览 · 后端附件接口待接入)`, 'success')
      setUploadFiles([])
      setShowUploadModal(false)
    }, 900)
  }

  const handleSubmitConclusion = () => {
    if (!conclusionText.trim()) {
      showToast(t('consultation.fillConclusion'), 'info')
      return
    }
    setShowConclusionModal(true)
  }

  // [Wave2A] 确认提交: consultationApi.complete 真实完成会诊
  const [submittingConclusion, setSubmittingConclusion] = useState(false)
  const handleConfirmConclusion = async () => {
    if (!selected) { setShowConclusionModal(false); return }
    setSubmittingConclusion(true)
    try {
      const res = await consultationApi.complete(selected.id, conclusionText.trim())
      if (res.success) {
        setConsultations(prev => prev.map(c => c.id === selected.id ? { ...c, status: '已完成' as const } : c))
        showToast(t('consultation.conclusionSubmitted'), 'success')
        setShowConclusionModal(false)
      } else {
        showToast(res.error?.message ?? t('consultation.submitFailed'), 'info')
      }
    } catch {
      showToast(t('consultation.submitUnavailable'), 'info')
    } finally {
      setSubmittingConclusion(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSubmitRating = () => {
    const total = ratingModalData.reduce((sum, item) => sum + item.score, 0)
    setQualityScore(Math.round(total / ratingModalData.length))
    setShowRatingModal(false)
    showToast(t('consultation.ratingSubmitted'), 'success')
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

  const openConsultationRecording = (consultationId: string) => {
    const archiveId = consultationVideoMap[consultationId]
    const archive = mockRecordingArchives.find(a => a.id === archiveId)
    if (archive) {
      setSelectedArchive(archive)
      setVideoModalOpen(true)
    }
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
            fill={star <= score ? 'var(--color-warning-500)' : 'none'}
            color={star <= score ? 'var(--color-warning-500)' : '#d1d5db'}
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

  // [G005 2B] 统计卡: 优先后端 /consultations/stats, 失败回退本地计算
  const statCards = [
    {
      label: t('consultation.statAll'),
      value: consultStats?.total ?? consultations.length,
      icon: <Radio size={18} color={ACCENT} />,
      bg: '#3b82f622',
    },
    {
      label: t('consultation.statPending'),
      value: consultStats?.pendingCount ?? consultations.filter(c => c.status === '待回复').length,
      icon: <Clock size={18} color={WARNING} />,
      bg: '#f59e0b22',
    },
    {
      label: t('consultation.statInProgress'),
      value: consultStats?.repliedCount ?? consultations.filter(c => c.status === '已回复').length,
      icon: <Activity size={18} color={ACCENT} />,
      bg: '#3b82f622',
    },
    {
      label: t('consultation.statCompleted'),
      value: consultStats?.completedCount ?? consultations.filter(c => c.status === '已完成').length,
      icon: <CheckCircle size={18} color={SUCCESS} />,
      bg: '#22c55e22',
    },
  ]

  const recordingStatCards = [
    { label: t('consultation.statTotalArchives'), value: mockRecordingArchives.length, icon: <Film size={18} color={ACCENT} />, bg: '#3b82f622' },
    { label: t('consultation.statAvailable'), value: mockRecordingArchives.filter(a => a.status === '可用').length, icon: <CheckCircle size={18} color={SUCCESS} />, bg: '#22c55e22' },
    { label: t('consultation.statProcessing'), value: mockRecordingArchives.filter(a => a.status === '处理中').length, icon: <Clock size={18} color={WARNING} />, bg: '#f59e0b22' },
    { label: t('consultation.statCorrupted'), value: mockRecordingArchives.filter(a => a.status === '已损坏').length, icon: <AlertCircle size={18} color={DANGER} />, bg: '#ef444422' },
  ]

  return (
    <div data-testid="consultation-page" style={{ padding: 24, maxWidth: 1600, margin: '0 auto', background: 'var(--bg-card)',}}>
      {/* [v3.0.6.11-88] 已接入真实 API: 后端 consultations.controller 全端点已实现 */}
      <div style={{ background: 'var(--color-success-bg)', color: '#065f46', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6, border: '1px solid #a7f3d0', marginBottom: 12 }}>
        {t('consultation.realApiBanner')}</div>
      {loading && <LoadingBanner message={t('consultation.loadingData')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: PRIMARY, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, background: PRIMARY, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Radio size={18} color='#fff' />
          </div>
          {t('consultation.title')}
          <span style={{ fontSize: 12, fontWeight: 400, color: GRAY, marginLeft: 8 }}>{t('consultation.title')}</span>
        </h1>
        <p style={{ fontSize: 12, color: GRAY, margin: 0 }}>{t('consultation.subtitle')}</p>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab('会诊列表')}
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            border: activeTab === '会诊列表' ? 'none' : `1px solid ${BORDER}`,
            background: activeTab === '会诊列表' ? PRIMARY : 'var(--bg-card)',
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
          {t('consultation.tabList')}
        </button>
        <button
          onClick={() => setActiveTab('录音录像会诊')}
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            border: activeTab === '录音录像会诊' ? 'none' : `1px solid ${BORDER}`,
            background: activeTab === '录音录像会诊' ? PRIMARY : 'var(--bg-card)',
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
          {t('consultation.tabRecording')}
          <span style={{
            background: activeTab === '录音录像会诊' ? 'rgba(255,255,255,0.25)' : '#fee2e2',
            color: activeTab === '录音录像会诊' ? WHITE : DANGER,
            borderRadius: 10,
            padding: '2px 8px',
            fontSize: 12,
            fontWeight: 700,
          }}>{mockRecordingArchives.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('登记与查询')}
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            border: activeTab === '登记与查询' ? 'none' : `1px solid ${BORDER}`,
            background: activeTab === '登记与查询' ? PRIMARY : 'var(--bg-card)',
            color: activeTab === '登记与查询' ? WHITE : GRAY,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Users size={16} />
          {t('consultation.registration.title')}
        </button>
      </div>

      {/* 会诊列表 Tab */}
      {activeTab === '会诊列表' && (
        <>
          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map(card => (
              <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: PRIMARY }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: GRAY }}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Main Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 16, alignItems: 'start' }}>
            {/* Left Panel - Consultation List */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {/* Search */}
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: LIGHT_BG }}>
                <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: `1px solid ${BORDER}`, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Search size={14} color={GRAY} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t('consultation.searchPlaceholder')}
                    style={{ border: 'none', fontSize: 12, width: '100%', color: PRIMARY }}
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
                        background: isActive ? PRIMARY : 'var(--bg-card)',
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
                        background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--bg-primary, #f8fafc)',
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
                    <div style={{ fontSize: 12 }}>{t('consultation.noConsultations')}</div>
                  </div>
                ) : filtered.map((c, idx) => {
                  const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG['待回复']!
                  const tc = TYPE_CONFIG[c.consultationType] || TYPE_CONFIG['疑难病例']!
                  const isSelected = selectedId === c.id
                  const hasVideo = !!consultationVideoMap[c.id]
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectConsultation(c.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectConsultation(c.id) } }}
                      style={{
                        padding: '14px 16px',
                        borderBottom: `1px solid ${BORDER}`,
                        cursor: 'pointer',
                        background: isSelected ? '#eff6ff' : idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-card)',
                        borderLeft: isSelected ? `3px solid ${ACCENT}` : '3px solid transparent',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--color-info-bg)' }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-card)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: PRIMARY }}>{c.patientName}</span>
                          {c.isRemote && (
                            <span style={{ padding: '1px 6px', background: '#8b5cf622', color: '#6d28d9', borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Video size={9} />{t('consultation.remote')}
                            </span>
                          )}
                          {hasVideo && (
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label={t('consultation.playRecording')}
                              style={{ padding: '1px 6px', background: 'var(--color-error-bg)', color: DANGER, borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                openConsultationRecording(c.id)
                              }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openConsultationRecording(c.id) } }}
                              title={t('consultation.playRecording')}
                            >
                              {t('consultation.video')}
                            </span>
                          )}
                        </div>
                        <StatusTag size="md" style={{ fontWeight: 700 }} tone={{ bg: sc.bg, border: 'transparent', color: sc.color, dot: sc.color }}>
                          {sc.label}
                        </StatusTag>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{ padding: '1px 8px', background: 'var(--color-info-bg)', color: ACCENT, borderRadius: 4, fontSize: 12 }}>{c.modality}</span>
                        <span style={{ padding: '1px 8px', background: tc.bg, color: tc.color, borderRadius: 4, fontSize: 12 }}>{c.consultationType}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        <div>
                          <div style={{ fontSize: 12, color: GRAY }}>{t('consultation.requestingDept')}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.requestingDepartment}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: GRAY }}>{t('consultation.consultedDept')}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.consultedDepartment || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: GRAY }}>{t('consultation.consultDoctor')}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{c.consultedDoctorName || t('consultation.assignPending')}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: GRAY }}>{t('consultation.requestTime')}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{c.requestTime.split(' ')[0]}</div>
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
                <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 60, textAlign: 'center', border: `1px solid ${BORDER}` }}>
                  <AlertCircle size={48} color={GRAY} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <div style={{ fontSize: 14, color: GRAY }}>{t('consultation.selectHint')}</div>
                </div>
              ) : (
                <>
                  {/* Header Info Card */}
                  <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <h2 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: 0 }}>{selected.patientName}</h2>
                          <StatusTag size="md" style={{ fontWeight: 700 }} tone={{ bg: STATUS_CONFIG[selected.status]?.bg ?? 'var(--bg-card)', border: 'transparent', color: STATUS_CONFIG[selected.status]?.color ?? GRAY, dot: STATUS_CONFIG[selected.status]?.color ?? GRAY }}>
                            {STATUS_CONFIG[selected.status]?.label}
                          </StatusTag>
                          {selected.isRemote && (
                            <span style={{ padding: '2px 8px', background: '#8b5cf622', color: '#6d28d9', borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Video size={11} />{t('consultation.remoteConsultation')}
                            </span>
                          )}
                          {consultationVideoMap[selected.id] && (
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label={t('consultation.playRecording')}
                              style={{ padding: '2px 8px', background: 'var(--color-error-bg)', color: DANGER, borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                              onClick={() => openConsultationRecording(selected.id)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openConsultationRecording(selected.id) } }}
                            >
                              <Film size={11} />{t('consultation.hasVideo')}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: GRAY }}>{t('consultation.consultNo')}：{selected.id}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={handleUpload} style={{ padding: '6px 14px', background: 'var(--color-info-bg)', color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Upload size={13} />{t('consultation.uploadMaterials')}
                        </button>
                        <button onClick={handlePrint} style={{ padding: '6px 14px', background: 'var(--color-info-bg)', color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Printer size={13} />{t('consultation.printConsult')}
                        </button>
                        {/* [G005 Wave1A] 编辑会诊 (PUT /consultations/:id) */}
                        <button onClick={openEditModal} style={{ padding: '6px 14px', background: 'var(--color-info-bg)', color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Edit3 size={13} />{t('consultation.registration.edit')}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                      {[
                        { label: t('consultation.consultNo'), value: selected.id, icon: <FileText size={14} color={GRAY} /> },
                        { label: t('consultation.requestTime'), value: selected.requestTime, icon: <Calendar size={14} color={GRAY} /> },
                        { label: t('consultation.consultType'), value: selected.consultationType, icon: <Users size={14} color={GRAY} /> },
                        { label: t('consultation.consultDept'), value: selected.consultedDepartment || t('consultation.assignPending'), icon: <MapPin size={14} color={GRAY} /> },
                      ].map(item => (
                        <div key={item.label} style={{ background: LIGHT_BG, borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                            {item.icon}
                            <span style={{ fontSize: 12, color: GRAY }}>{item.label}</span>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
                      {selected.status === '待回复' && (
                        <>
                          <button onClick={() => void handleAccept()} disabled={acceptingId === selected.id} style={{ padding: '8px 20px', background: SUCCESS, color: WHITE, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: acceptingId === selected.id ? 0.6 : 1 }}>
                            <CheckCircle size={15} />{acceptingId === selected.id ? t('consultation.starting') : t('consultation.accept')}
                          </button>
                          <button onClick={handleReject} style={{ padding: '8px 20px', background: 'var(--bg-card)', color: DANGER, border: `1px solid ${DANGER}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <X size={15} />{t('consultation.reject')}
                          </button>
                        </>
                      )}
                      {(selected.status === '待回复' || selected.status === '已回复') && (
                        <button onClick={() => { setInviteDoctorIds(''); setShowInviteModal(true) }} style={{ padding: '8px 20px', background: '#8b5cf6', color: WHITE, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Users size={15} />{t('consultation.inviteExpert')}
                        </button>
                      )}
                      {(selected.status === '待回复' || selected.status === '已回复') && (
                        <button onClick={() => void handleCancelConsultation()} disabled={cancellingId === selected.id} style={{ padding: '8px 20px', background: 'var(--bg-card)', color: DANGER, border: `1px solid ${DANGER}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: cancellingId === selected.id ? 0.6 : 1 }}>
                          <X size={15} />{cancellingId === selected.id ? t('consultation.cancelling') : t('consultation.cancelConsultation')}
                        </button>
                      )}
                      <button onClick={handleSubmitConclusion} style={{ padding: '8px 20px', background: PRIMARY, color: WHITE, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Send size={15} />{t('consultation.submitConclusion')}
                      </button>
                    </div>
                  </div>

                  {/* Patient & Exam Info */}
                  <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={16} color={ACCENT} />{t('consultation.patientExamInfo')}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {/* Patient Info */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>{t('consultation.patientBasicInfo')}</div>
                        {(() => {
                          const patient = getPatientForConsultation(selected)
                          return patient ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              {[
                                { label: t('consultation.patientName'), value: patient.name },
                                { label: t('consultation.gender'), value: patient.gender },
                                { label: t('consultation.age'), value: `${patient.age}岁` },
                                { label: t('consultation.patientType'), value: patient.patientType },
                                { label: t('consultation.phone'), value: patient.phone },
                                { label: t('consultation.primaryDiagnosis'), value: patient.primaryDiagnosis },
                              ].map(item => (
                                <div key={item.label} style={{ background: LIGHT_BG, borderRadius: 6, padding: '6px 10px' }}>
                                  <div style={{ fontSize: 12, color: GRAY }}>{item.label}</div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>{item.value}</div>
                                </div>
                              ))}
                            </div>
                          ) : <div style={{ color: GRAY, fontSize: 12 }}>{t('consultation.patientNotFound')}</div>
                        })()}
                      </div>
                      {/* Exam Info */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>{t('consultation.examInfo')}</div>
                        {(() => {
                          const exam = getExamForConsultation(selected)
                          return exam ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              {[
                                { label: t('consultation.examItem'), value: exam.examItemName },
                                { label: t('consultation.examDate'), value: exam.examDate },
                                { label: t('consultation.device'), value: exam.deviceName?.split('（')[0] },
                                { label: t('consultation.imageCount'), value: `${exam.imagesAcquired}幅` },
                                { label: t('consultation.accessionNumber'), value: exam.accessionNumber },
                                { label: t('consultation.clinicalDiagnosis'), value: exam.clinicalDiagnosis },
                              ].map(item => (
                                <div key={item.label} style={{ background: LIGHT_BG, borderRadius: 6, padding: '6px 10px' }}>
                                  <div style={{ fontSize: 12, color: GRAY }}>{item.label}</div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>{item.value}</div>
                                </div>
                              ))}
                            </div>
                          ) : <div style={{ color: GRAY, fontSize: 12 }}>{t('consultation.examNotFound')}</div>
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Consultation Purpose & Clinical Info */}
                  <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Stethoscope size={16} color={ACCENT} />{t('consultation.purposeClinicalInfo')}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {[
                        { label: t('consultation.purposeDesc'), value: selected.requestReason, icon: <MessageSquare size={14} color={ACCENT} /> },
                        { label: t('consultation.clinicalDiagnosis'), value: getExamForConsultation(selected)?.clinicalDiagnosis || '—', icon: <Activity size={14} color={ACCENT} /> },
                        { label: t('consultation.relevantResults'), value: getExamForConsultation(selected)?.relevantLabResults || t('consultation.noLabResults'), icon: <FileText size={14} color={ACCENT} /> },
                      ].map(item => (
                        <div key={item.label} style={{ background: LIGHT_BG, borderRadius: 8, padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            {item.icon}
                            <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{item.label}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock3 size={16} color={ACCENT} />{t('consultation.timelineTitle')}
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
                              background: node.status === 'done' ? ACCENT : node.status === 'current' ? 'var(--bg-card)' : 'var(--bg-card)',
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
                              <div style={{ fontSize: 12, fontWeight: 700, color: node.status === 'pending' ? GRAY : PRIMARY }}>{node.label}</div>
                              <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>{t('consultation.operator')}：{node.operator}</div>
                            </div>
                            <div style={{ fontSize: 12, color: GRAY, textAlign: 'right' }}>
                              <div>{node.time !== '—' ? t('consultation.time') : ''}</div>
                              <div style={{ fontWeight: 600, color: node.status === 'pending' ? GRAY : PRIMARY }}>{node.time}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Consultation Conclusion */}
                  <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MessageSquare size={16} color={ACCENT} />{t('consultation.conclusionSection')}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>
                          {t('consultation.doctorOpinion')} <span style={{ color: DANGER }}>*</span>
                        </label>
                        <textarea
                          value={conclusionText}
                          onChange={e => setConclusionText(e.target.value)}
                          placeholder={t('consultation.doctorOpinionPlaceholder')}
                          rows={4}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12, color: PRIMARY, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
                          onFocus={e => e.target.style.borderColor = ACCENT}
                          onBlur={e => e.target.style.borderColor = BORDER}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>
                          {t('consultation.diagnosisAdvice')}
                        </label>
                        <textarea
                          value={diagnosisAdvice}
                          onChange={e => setDiagnosisAdvice(e.target.value)}
                          placeholder={t('consultation.diagnosisAdvicePlaceholder')}
                          rows={3}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12, color: PRIMARY, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
                          onFocus={e => e.target.style.borderColor = ACCENT}
                          onBlur={e => e.target.style.borderColor = BORDER}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>
                          {t('consultation.referenceInfo')}
                        </label>
                        <textarea
                          value={referenceInfo}
                          onChange={e => setReferenceInfo(e.target.value)}
                          placeholder={t('consultation.referencePlaceholder')}
                          rows={2}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12, color: PRIMARY, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
                          onFocus={e => e.target.style.borderColor = ACCENT}
                          onBlur={e => e.target.style.borderColor = BORDER}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Consultation Evaluation */}
                  <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ThumbsUp size={16} color={ACCENT} />{t('consultation.evaluation')}
                      </h3>
                      <button
                        onClick={() => setShowRatingModal(true)}
                        style={{ padding: '4px 12px', background: 'var(--color-info-bg)', color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Edit3 size={14} />{t('consultation.detailedRating')}
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div style={{ background: LIGHT_BG, borderRadius: 8, padding: '14px 16px' }}>
                        <div style={{ fontSize: 12, color: GRAY, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Shield size={14} />{t('consultation.qualityScore')}
                        </div>
                        <div style={{ marginBottom: 8 }}>{renderStars(qualityScore)}</div>
                        <div style={{ fontSize: 12, color: GRAY }}>{t('consultation.overallScore')}：<span style={{ fontWeight: 700, color: PRIMARY }}>{qualityScore}.0/5.0</span></div>
                      </div>
                      <div style={{ background: LIGHT_BG, borderRadius: 8, padding: '14px 16px' }}>
                        <div style={{ fontSize: 12, color: GRAY, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Heart size={14} />{t('consultation.satisfaction')}
                        </div>
                        <div style={{ marginBottom: 8 }}>{renderStars(satisfactionScore, setSatisfactionScore)}</div>
                        <div style={{ fontSize: 12, color: GRAY }}>{t('consultation.satisfactionLabel')}：<span style={{ fontWeight: 700, color: PRIMARY }}>{satisfactionScore}.0/5.0</span></div>
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
          {/* [G005 W2-B P2] 后端暂无录像/存档端点, 列表为演示数据 */}
          <div style={{ background: '#fffbeb', color: '#92400e', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6, border: '1px solid #fcd34d' }}>
            {t('consultation.recordingDemoBanner')}
          </div>
          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {recordingStatCards.map(card => (
              <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: PRIMARY }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: GRAY }}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* 会诊录音录像控制面板 */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Video size={16} color={ACCENT} />{t('consultation.recordingPanel')}
              </h3>

              {/* 当前会诊信息 */}
              <div style={{ background: LIGHT_BG, borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 10 }}>{t('consultation.currentConsultInfo')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: GRAY }}>{t('consultation.consultId')}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>{selected?.id || 'CST2026050101'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: GRAY }}>{t('consultation.patientName')}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>{selected?.patientName || '张伟'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: GRAY }}>{t('consultation.participatingDoctors')}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>{selected?.consultedDoctorName || '王建国 主任医师'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: GRAY }}>{t('consultation.startTime')}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>{selected?.requestTime || '2026-05-01 14:30'}</div>
                  </div>
                </div>
              </div>

              {/* 录制控制 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 12 }}>{t('consultation.recordingControl')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {/* 录制按钮 */}
                  {recordingStatus === '准备中' && (
                    <button
                      onClick={handleStartRecording}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: 'var(--color-error-bg)',
                        border: '3px solid var(--color-error-600)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 0 4px rgba(220, 38, 38, 0.2)',
                      }}
                    >
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-error-600)' }} />
                    </button>
                  )}

                  {recordingStatus === '录制中' && (
                    <button
                      onClick={handleStartRecording}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: 'var(--color-error-bg)',
                        border: '3px solid var(--color-error-600)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 0 4px rgba(220, 38, 38, 0.2)',
                        animation: 'pulse 1.5s infinite',
                      }}
                    >
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-error-600)' }} />
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
                        border: `2px solid ${recordingStatus === '已暂停' ? 'var(--color-primary-600)' : 'var(--color-warning-600)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {recordingStatus === '已暂停' ? <Play size={20} color="var(--color-primary-600)" /> : <Pause size={20} color="var(--color-warning-600)" />}
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
                        background: 'var(--bg-card)',
                        border: '2px solid var(--text-secondary, #475569)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Square size={18} color="var(--text-secondary)" />
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
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <RefreshCw size={14} />{t('consultation.restart')}
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
                    <div style={{ fontSize: 12, color: GRAY }}>{t('consultation.recordingDuration')}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: recordingStatus === '录制中' ? DANGER : PRIMARY, fontFamily: 'monospace' }}>
                      {formatTime(recordingSeconds)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 当前状态标签 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: GRAY }}>{t('consultation.currentStatus')}：</span>
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
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Film size={16} color={ACCENT} />{t('consultation.videoPreview')}
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
                  background: 'linear-gradient(135deg, var(--color-primary-800) 0%, #16213e 100%)',
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
                      <div style={{ marginTop: 8 }}>{t('consultation.playing')}</div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                      <Video size={48} />
                      <div style={{ marginTop: 8 }}>{t('consultation.clickToPlay')}</div>
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
                      role="button"
                      tabIndex={0}
                      aria-label={t('consultation.videoPlayback')}
                      onClick={handleSeek}
                      onKeyDown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setVideoProgress(p => Math.max(0, Math.min(100, p + (e.key === 'ArrowLeft' ? -5 : 5)))) } }}
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
                            fontSize: 10,
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
                  background: 'var(--color-info-bg)',
                  border: `1px solid ${ACCENT}`,
                  color: ACCENT,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Camera size={16} />{t('consultation.snapshot')}
              </button>
            </div>
          </div>

          {/* 录音录像存档列表 */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Film size={16} color={ACCENT} />{t('consultation.archiveList')}
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-warning-600)', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '2px 8px' }}>{t('consultation.demoData')}</span>
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <DataTable
                rowKey="id"
                dataSource={mockRecordingArchives}
                showPagination={false}
                showExport={false}
                showDensity={false}
                columns={[
                  { title: t('consultation.archiveId'), dataIndex: 'id', key: 'id', render: (v: string) => <span style={{ fontWeight: 600, color: PRIMARY }}>{v}</span> },
                  { title: t('consultation.consultId'), dataIndex: 'consultationId', key: 'consultationId', render: (v: string) => <span style={{ color: 'var(--text-primary)' }}>{v}</span> },
                  { title: t('consultation.patientName'), dataIndex: 'patientName', key: 'patientName', render: (v: string) => <span style={{ color: 'var(--text-primary)' }}>{v}</span> },
                  { title: t('consultation.duration'), dataIndex: 'duration', key: 'duration', render: (v: string) => <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{v}</span> },
                  { title: t('consultation.fileSize'), dataIndex: 'fileSize', key: 'fileSize', render: (v: string) => <span style={{ color: 'var(--text-primary)' }}>{v}</span> },
                  { title: t('consultation.archiveTime'), dataIndex: 'recordTime', key: 'recordTime', render: (v: string) => <span style={{ color: 'var(--text-primary)' }}>{v}</span> },
                  {
                    title: t('consultation.status'), dataIndex: 'status', key: 'status',
                    render: (v: string) => (
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 600,
                        background: v === '可用' ? '#d1fae5' : v === '处理中' ? '#fef3c7' : '#fee2e2',
                        color: v === '可用' ? '#059669' : v === '处理中' ? 'var(--color-warning-600)' : 'var(--color-error-600)',
                      }}>
                        {v}
                      </span>
                    ),
                  },
                  {
                    title: t('consultation.actions'), key: 'actions',
                    render: (_: unknown, archive: RecordingArchive) => (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => handlePlayArchive(archive)}
                          disabled={archive.status !== '可用'}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            background: archive.status === '可用' ? '#f0f7ff' : 'var(--bg-primary, #f8fafc)',
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
                          <Play size={11} />{t('consultation.play')}
                        </button>
                        <button
                          onClick={() => handleDownloadArchive(archive)}
                          disabled={archive.status !== '可用'}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            background: archive.status === '可用' ? '#f0f7ff' : 'var(--bg-primary, #f8fafc)',
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
                          <Download size={11} />{t('consultation.download')}
                        </button>
                        <button
                          onClick={() => handleDeleteArchive(archive)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            background: 'var(--bg-card)',
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
                          <X size={11} />{t('consultation.delete')}
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      {/* 登记与查询 Tab [G005 Wave1A]: create / pending / by-patient / by-doctor */}
      {activeTab === '登记与查询' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([
              { key: 'create', label: t('consultation.registration.create'), color: ACCENT },
              { key: 'pending', label: t('consultation.registration.pending'), color: WARNING },
              { key: 'query', label: t('consultation.registration.results'), color: SUCCESS },
            ] as const).map(s => (
              <button
                key={s.key}
                onClick={() => {
                  setRegSection(s.key)
                  if (s.key === 'pending') void loadPending()
                }}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: regSection === s.key ? 'none' : `1px solid ${BORDER}`,
                  background: regSection === s.key ? s.color : 'var(--bg-card)',
                  color: regSection === s.key ? WHITE : GRAY,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {regSection === 'create' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={16} color={ACCENT} />{t('consultation.registration.createTitle')}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                {([
                  { label: t('consultation.registration.patientName'), key: 'patientName', placeholder: t('consultation.regPatientNamePh') },
                  { label: t('consultation.registration.modality'), key: 'modality', placeholder: t('consultation.regModalityPh') },
                  { label: t('consultation.registration.bodyPart'), key: 'bodyPart', placeholder: t('consultation.regBodyPartPh') },
                  { label: t('consultation.registration.consultationType'), key: 'consultationType', placeholder: t('consultation.regConsultTypePh') },
                  { label: t('consultation.registration.requestingDepartment'), key: 'requestingDepartment', placeholder: t('consultation.regReqDeptPh') },
                  { label: t('consultation.registration.consultedDepartment'), key: 'consultedDepartment', placeholder: t('consultation.regConsDeptPh') },
                  { label: t('consultation.registration.priority'), key: 'priority', placeholder: 'normal/urgent/stat' },
                  { label: t('consultation.registration.requestReason'), key: 'requestReason', placeholder: t('consultation.regRequestReasonPh') },
                ] as const).map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{f.label}</label>
                    <input
                      value={(createForm as Record<string, string>)[f.key]}
                      onChange={e => setCreateForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, fontSize: 12, color: PRIMARY, boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button onClick={() => void handleCreateConsultation()} disabled={creating} style={{ padding: '8px 24px', background: PRIMARY, color: WHITE, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: creating ? 0.6 : 1 }}>
                  <Send size={14} />{creating ? t('consultation.submitting') : t('consultation.registration.submit')}
                </button>
              </div>
            </div>
          )}

          {regSection === 'pending' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={16} color={WARNING} />{t('consultation.registration.pending')}
                  <span style={{ background: '#fef3c7', color: WARNING, borderRadius: 10, padding: '2px 8px', fontSize: 12 }}>{t('consultation.registration.pendingCount')}: {pendingConsults.length}</span>
                </h3>
                <button onClick={() => void loadPending()} style={{ padding: '6px 14px', background: 'var(--color-info-bg)', color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <RefreshCw size={13} />{t('consultation.refresh')}
                </button>
              </div>
              {pendingLoading ? (
                <LoadingBanner message={t('consultation.loadingPending')} />
              ) : pendingConsults.length === 0 ? (
                <div style={{ padding: 36, textAlign: 'center', color: GRAY }}>
                  <CheckCircle size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <div style={{ fontSize: 12 }}>{t('consultation.registration.pendingEmpty')}</div>
                </div>
              ) : (
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                  {pendingConsults.map(c => renderRegResultRow(c))}
                </div>
              )}
            </div>
          )}

          {regSection === 'query' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Search size={16} color={SUCCESS} />{t('consultation.registration.title')}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{t('consultation.registration.byPatient')}</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={queryByPatientId}
                      onChange={e => setQueryByPatientId(e.target.value)}
                      placeholder={t('consultation.registration.patientIdPlaceholder')}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, fontSize: 12, color: PRIMARY,}}
                    />
                    <button onClick={() => void handleQueryByPatient()} disabled={queryLoading} style={{ padding: '8px 18px', background: SUCCESS, color: WHITE, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: queryLoading ? 0.6 : 1 }}>
                      {t('consultation.registration.search')}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{t('consultation.registration.byDoctor')}</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={queryByDoctorId}
                      onChange={e => setQueryByDoctorId(e.target.value)}
                      placeholder={t('consultation.registration.doctorIdPlaceholder')}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, fontSize: 12, color: PRIMARY,}}
                    />
                    <button onClick={() => void handleQueryByDoctor()} disabled={queryLoading} style={{ padding: '8px 18px', background: SUCCESS, color: WHITE, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: queryLoading ? 0.6 : 1 }}>
                      {t('consultation.registration.search')}
                    </button>
                  </div>
                </div>
              </div>
              {queryResultType && (
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 14px', background: LIGHT_BG, fontSize: 12, fontWeight: 700, color: ACCENT, borderBottom: `1px solid ${BORDER}` }}>
                    {t('consultation.registration.results')} · {queryResultType === 'patient' ? t('consultation.registration.byPatient') : t('consultation.registration.byDoctor')} · {t('consultation.registration.resultCount', { count: queryResults.length })}
                  </div>
                  {queryResults.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: GRAY, fontSize: 12 }}>{t('consultation.registration.noResult')}</div>
                  ) : queryResults.map(c => renderRegResultRow(c))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, width: 480, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: 0 }}>{t('consultation.detailRatingTitle')}</h3>
              <button onClick={() => setShowRatingModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY, padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {ratingModalData.map((item, idx) => (
                <div key={item.dimension} style={{ background: LIGHT_BG, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>{item.dimension}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>{item.score}{t('consultation.points')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <button
                        key={s}
                        onClick={() => {
                          const updated = [...ratingModalData]
                          updated[idx]!.score = s
                          setRatingModalData(updated)
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                      >
                        <Star size={22} fill={s <= item.score ? 'var(--color-warning-500)' : 'none'} color={s <= item.score ? 'var(--color-warning-500)' : '#d1d5db'} />
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={item.comment}
                    onChange={e => {
                      const updated = [...ratingModalData]
                      updated[idx]!.comment = e.target.value
                      setRatingModalData(updated)
                    }}
                    placeholder={`${item.dimension}评语（选填）`}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, fontSize: 12, boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRatingModal(false)} style={{ padding: '8px 20px', background: LIGHT_BG, color: GRAY, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t('consultation.cancel')}
              </button>
              <button onClick={handleSubmitRating} style={{ padding: '8px 20px', background: PRIMARY, color: WHITE, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {t('consultation.confirmSubmit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Playback Modal */}
      {videoModalOpen && selectedArchive && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, width: 800, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: '0 0 4px' }}>{t('consultation.videoPlayback')} - {selectedArchive.patientName}</h3>
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
                background: 'linear-gradient(135deg, var(--color-primary-800) 0%, #16213e 100%)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.5)',
              }}>
                {isPlaying ? (
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    <Play size={64} />
                    <div style={{ marginTop: 12, fontSize: 16 }}>{t('consultation.playing')}</div>
                    <div style={{ fontSize: 12, marginTop: 8, fontFamily: 'monospace' }}>{formatTime(Math.floor(videoProgress * 2.7))}</div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                    <Video size={64} />
                    <div style={{ marginTop: 12, fontSize: 16 }}>{t('consultation.clickToPlay')}</div>
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
                    role="button"
                    tabIndex={0}
                    aria-label={t('consultation.videoPlayback')}
                    onClick={handleSeek}
                    onKeyDown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setVideoProgress(p => Math.max(0, Math.min(100, p + (e.key === 'ArrowLeft' ? -5 : 5)))) } }}
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
                          fontSize: 10,
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
                  background: 'var(--color-info-bg)',
                  border: `1px solid ${ACCENT}`,
                  color: ACCENT,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Camera size={14} />{t('consultation.snapshot')}
              </button>
              <button
                onClick={() => handleDownloadArchive(selectedArchive)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: PRIMARY,
                  border: 'none',
                  color: WHITE,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Download size={14} />{t('consultation.downloadRecording')}
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
          background: toast.type === 'success' ? '#059669' : toast.type === 'progress' ? 'var(--color-primary-600)' : '#64748b',
          color: 'white',
          fontSize: 12,
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
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, width: 480, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: 0 }}>{t('consultation.uploadTitle')}</h3>
              <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY, padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div role="button" tabIndex={0} style={{ border: `2px dashed ${BORDER}`, borderRadius: 12, padding: '32px 16px', textAlign: 'center', marginBottom: 16, cursor: 'pointer' }} onClick={() => uploadInputRef.current?.click()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); uploadInputRef.current?.click() } }}>
              <Upload size={32} color={GRAY} style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 12, color: GRAY, marginBottom: 8 }}>{t('consultation.dragDropHint')}</div>
              <div style={{ fontSize: 12, color: GRAY }}>{t('consultation.supportedFormats')}</div>
              <input
                ref={uploadInputRef}
                type="file"
                multiple
                accept=".dcm,.pdf,.jpg,.jpeg,.png,.zip"
                style={{ display: 'none' }}
                onChange={e => { handleSelectFiles(e.target.files); e.target.value = '' }}
              />
            </div>
            {uploadFiles.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 6 }}>{t('consultation.selectedFiles', { count: uploadFiles.length })}</div>
                <div style={{ display: 'grid', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
                  {uploadFiles.map(f => (
                    <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, background: LIGHT_BG, padding: '6px 10px', borderRadius: 6, fontSize: 12 }}>
                      <FileText size={14} color={ACCENT} />
                      <span style={{ flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <span style={{ color: GRAY }}>{(f.size / 1024).toFixed(0)}KB</span>
                      <button onClick={() => handleRemoveUploadFile(f.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: DANGER, padding: 0 }}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowUploadModal(false)} style={{ padding: '8px 20px', background: LIGHT_BG, color: GRAY, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t('consultation.cancel')}
              </button>
              <button onClick={handleStartUpload} disabled={uploading} style={{ padding: '8px 20px', background: PRIMARY, color: WHITE, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: uploading ? 0.6 : 1 }}>
                {uploading ? t('consultation.uploading') : t('consultation.startUpload')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [G005 2B] Invite Expert Modal (POST /consultations/:id/invite) */}
      {showInviteModal && selected && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: 0 }}>{t('consultation.inviteTitle')}</h3>
              <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY, padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: GRAY, marginBottom: 12 }}>
              {t('consultation.invitePrefix')} <strong style={{ color: PRIMARY }}>{selected.id}</strong> · {selected.patientName} · {t('consultation.currentExpert')}: {selected.consultedDoctorName || t('consultation.assignPending')}
            </div>
            <input
              type="text"
              value={inviteDoctorIds}
              onChange={e => setInviteDoctorIds(e.target.value)}
              placeholder={t('consultation.invitePlaceholder')}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12, color: PRIMARY, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowInviteModal(false)} style={{ padding: '8px 20px', background: LIGHT_BG, color: GRAY, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t('consultation.cancel')}
              </button>
              <button onClick={() => void handleInvite()} disabled={invitingId === selected.id} style={{ padding: '8px 20px', background: '#8b5cf6', color: WHITE, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: invitingId === selected.id ? 0.6 : 1 }}>
                {invitingId === selected.id ? t('consultation.inviting') : t('consultation.sendInvite')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [G005 Wave1A] Edit Consultation Modal (PUT /consultations/:id) */}
      {showEditModal && selected && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, width: 560, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: 0 }}>{t('consultation.registration.editTitle')} #{selected.id}</h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY, padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {([
                { label: t('consultation.registration.patientName'), key: 'patientName' as const },
                { label: t('consultation.registration.modality'), key: 'modality' as const },
                { label: t('consultation.registration.bodyPart'), key: 'bodyPart' as const },
                { label: t('consultation.registration.consultationType'), key: 'consultationType' as const },
                { label: t('consultation.registration.requestingDepartment'), key: 'requestingDepartment' as const },
                { label: t('consultation.registration.consultedDepartment'), key: 'consultedDepartment' as const },
                { label: t('consultation.registration.priority'), key: 'priority' as const },
              ]).map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{f.label}</label>
                  <input
                    value={editForm[f.key] ?? ''}
                    onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, fontSize: 12, color: PRIMARY, boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, display: 'block', marginBottom: 6 }}>{t('consultation.registration.requestReason')}</label>
                <textarea
                  value={editForm.requestReason ?? ''}
                  onChange={e => setEditForm(prev => ({ ...prev, requestReason: e.target.value }))}
                  rows={3}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, fontSize: 12, color: PRIMARY, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowEditModal(false)} style={{ padding: '8px 20px', background: LIGHT_BG, color: GRAY, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t('consultation.cancel')}
              </button>
              <button onClick={() => void handleUpdateConsultation()} disabled={updating} style={{ padding: '8px 20px', background: PRIMARY, color: WHITE, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: updating ? 0.6 : 1 }}>
                {updating ? t('consultation.saving') : t('consultation.registration.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conclusion Modal */}
      {showConclusionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, width: 520, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: PRIMARY, margin: 0 }}>{t('consultation.confirmConclusionTitle')}</h3>
              <button onClick={() => setShowConclusionModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY, padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div style={{ background: LIGHT_BG, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>{t('consultation.doctorOpinion')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>{conclusionText || t('consultation.notFilled')}</div>
              </div>
              <div style={{ background: LIGHT_BG, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>{t('consultation.diagnosisAdvice')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>{diagnosisAdvice || t('consultation.notFilled')}</div>
              </div>
              <div style={{ background: LIGHT_BG, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>{t('consultation.referenceInfo')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>{referenceInfo || t('consultation.notFilled')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowConclusionModal(false)} style={{ padding: '8px 20px', background: LIGHT_BG, color: GRAY, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t('consultation.backToEdit')}
              </button>
              <button onClick={() => void handleConfirmConclusion()} disabled={submittingConclusion} style={{ padding: '8px 20px', background: SUCCESS, color: WHITE, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: submittingConclusion ? 0.6 : 1 }}>
                {submittingConclusion ? t('consultation.submitting') : t('consultation.confirmSubmit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: DANGER, margin: 0 }}>{t('consultation.confirmDeleteArchive')}</h3>
              <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GRAY, padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 20 }}>
              {t('consultation.deleteArchiveMsg', { id: deleteTarget.id })}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null) }} style={{ padding: '8px 20px', background: LIGHT_BG, color: GRAY, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t('consultation.cancel')}
              </button>
              <button onClick={() => { setShowDeleteModal(false); showToast(`存档 ${deleteTarget.id} 已删除`, 'info'); setDeleteTarget(null) }} style={{ padding: '8px 20px', background: DANGER, color: WHITE, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {t('consultation.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
