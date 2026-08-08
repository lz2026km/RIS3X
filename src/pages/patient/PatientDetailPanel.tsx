// [W2-4] 患者详情 360°: 一键预约/随访/合并 + 危急值历史 + 可点击影像 + 多源时间线 + 报告下载/账单
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Calendar, CreditCard, Phone, MapPin, Contact, User, Shield, Stethoscope,
  Activity, AlertTriangle, CheckCircle, Clock, AlertCircle, Image, Layers, CalendarPlus,
  ClipboardList, GitMerge, Download, Eye, FileText, BellRing, Receipt, X, RefreshCw,
} from 'lucide-react'
import type { Patient } from '../../types'
import type { RadiologyExam } from '../../types'
import type { TimelineEvent } from './types'
import { getBirthDateFromIdCard, getPatientStats } from './utils'
import {
  patientApi, criticalApi, appointmentApi, reportApi, financeApi,
  type CriticalValueDto, type AppointmentDto,
} from '../../services/api'
import { invalidateApiCacheByPrefix } from '../../services/api/client'
import type { ReportDto, ExamDto, InvoiceDto } from '../../types/dto'
import { useAuth } from '../../hooks/useAuth'

const TIMELINE_ICONS: Record<string, React.ReactNode> = {
  exam: <Image size={14} />,
  report: <FileText size={14} />,
  appointment: <Calendar size={14} />,
  diagnosis: <Stethoscope size={14} />,
  critical: <BellRing size={14} />,
}

const TIMELINE_COLORS: Record<string, string> = {
  exam: '#3b82f6',
  report: '#059669',
  appointment: '#d97706',
  diagnosis: '#7c3aed',
  critical: '#dc2626',
}

const STATUS_MAP: Record<string, string> = {
  draft: '草稿', pending: '待出报告', submitted: '待出报告', reviewed: '审核中',
  cosigned: '已双签', published: '报告已发', signed: '已签发', completed: '已完成',
  in_progress: '检查中', scheduled: '已登记', checked_in: '已到检', cancelled: '已取消',
  no_show: '爽约',
}

function normalizeStatus(status?: string): string {
  if (!status) return '未知'
  if (/[\u4e00-\u9fa5]/.test(status)) return status
  return STATUS_MAP[status.toLowerCase()] || status
}

function normalizeDate(value?: string): string {
  if (!value) return '-'
  return String(value).slice(0, 10)
}

// [W2-4] 兼容 ExamDto / RadiologyExam 双形状的展示行
interface PatientExamRow {
  id?: string
  patientId?: string
  modality: string
  bodyPart: string
  status?: string
  priority?: string
  scheduledAt?: string
  examDate?: string
  patientType?: string
  deviceName?: string
  deviceModel?: string
  examItemName?: string
  examItem?: string
  hasCriticalValue?: boolean
  imagesAcquired?: number
}

function toExamRow(e: unknown): PatientExamRow {
  return (e ?? {}) as PatientExamRow
}

function criticalClosed(cv: CriticalValueDto): boolean {
  const state = String(cv.state ?? cv.status ?? '').toUpperCase()
  return state === 'CLOSED_LOOP' || !!cv.resolvedAt || cv.status === '已处理'
}

interface PatientTimelineProps {
  events: TimelineEvent[]
}

function PatientTimeline({ events }: PatientTimelineProps) {
  const navigate = useNavigate()
  const sorted = useMemo(() => [...events].sort((a, b) => b.date.localeCompare(a.date)), [events])

  return (
    <div style={{ position: 'relative', paddingLeft: 32 }}>
      <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: '#e2e8f0' }} />
      {sorted.map((evt, idx) => {
        const color = TIMELINE_COLORS[evt.type] || '#64748b'
        return (
          <div key={evt.key ?? idx} style={{ position: 'relative', paddingBottom: 24, display: 'flex', gap: 16 }}>
            <div style={{ position: 'absolute', left: -24, width: 32, height: 32, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 1, fontSize: 12 }}>
              {evt.icon || TIMELINE_ICONS[evt.type] || <Clock size={14} />}
            </div>
            <div style={{ flex: 1, marginLeft: 8 }}>
              <div
                style={{
                  background: 'var(--content-bg)', borderRadius: 8, padding: '12px 16px',
                  border: '1px solid #e2e8f0', borderLeft: `3px solid ${color}`,
                  cursor: evt.link ? 'pointer' : 'default',
                }}
                onClick={evt.link ? () => navigate(evt.link!) : undefined}
                onMouseEnter={(e) => { if (evt.link) (e.currentTarget as HTMLDivElement).style.background = '#eff6ff' }}
                onMouseLeave={(e) => { if (evt.link) (e.currentTarget as HTMLDivElement).style.background = '#f8fafc' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: '#1e40af', fontSize: 13 }}>
                    {evt.type === 'exam' && '📷 '}
                    {evt.type === 'report' && '📄 '}
                    {evt.type === 'appointment' && '🗓 '}
                    {evt.type === 'critical' && '🚨 '}
                    {evt.title}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{evt.date}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{evt.description}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                  {evt.status && (
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: evt.type === 'critical' ? '#fef2f2' : '#eff6ff', color: evt.type === 'critical' ? '#dc2626' : '#2563eb' }}>
                      {evt.status}
                    </span>
                  )}
                  {evt.extra && <span style={{ fontSize: 11, color: '#94a3b8' }}>{evt.extra}</span>}
                  {evt.link && <span style={{ fontSize: 11, color: '#2563eb', marginLeft: 'auto' }}>查看 →</span>}
                </div>
              </div>
            </div>
          </div>
        )
      })}
      {sorted.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>暂无时间线事件</div>
      )}
    </div>
  )
}

export interface PatientDetailPanelProps {
  selectedPatient: Patient | null
  onBack: () => void
  onEdit: (patient: Patient) => void
  exams: RadiologyExam[]
}

interface MergeResult {
  ok?: boolean
  movedExams?: number
  movedReports?: number
  movedAppointments?: number
  movedCriticalValues?: number
}

export function PatientDetailPanel({ selectedPatient, onBack, onEdit, exams }: PatientDetailPanelProps) {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [apiExams, setApiExams] = useState<ExamDto[]>([])
  const [reports, setReports] = useState<ReportDto[]>([])
  const [criticalValues, setCriticalValues] = useState<CriticalValueDto[]>([])
  const [appointments, setAppointments] = useState<AppointmentDto[]>([])
  const [invoices, setInvoices] = useState<InvoiceDto[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  // [W2-4] mock 环境首访时 store 异步种子(大体积动态导入)未就绪 → 空结果后按退避自动重拉
  const [warmRetryCount, setWarmRetryCount] = useState(0)
  const [dataLoaded, setDataLoaded] = useState(false)

  // 合并 Modal
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [mergeLoading, setMergeLoading] = useState(false)
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null)
  const [mergeError, setMergeError] = useState<string | null>(null)

  // 报告导出状态
  const [exportingId, setExportingId] = useState<string | null>(null)

  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'info'; message: string }>({ show: false, type: 'success', message: '' })
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, type, message })
    setTimeout(() => setToast((v) => ({ ...v, show: false })), 3500)
  }, [])

  const patientId = selectedPatient?.id

  // [W2-4] 多源数据加载: 检查 + 报告 + 危急值 + 预约 + 账单
  useEffect(() => {
    if (!patientId) return
    let cancelled = false
    setDataLoading(true)
    setDataError(null)
    void (async () => {
      const [examsRes, reportsRes, criticalRes, aptRes, invRes] = await Promise.allSettled([
        patientApi.getExams(patientId),
        patientApi.getReports(patientId),
        criticalApi.list({ patientId, take: 100 }),
        appointmentApi.list({ patientId }),
        financeApi.listInvoices(),
      ])
      if (cancelled) return
      const norm = <T,>(r: PromiseSettledResult<unknown>, extract: (d: unknown) => T[], fallback: T[] = []): T[] => {
        if (r.status !== 'fulfilled') return fallback
        const res = r.value as { success?: boolean; data?: unknown }
        if (!res?.success) return fallback
        const raw = res.data
        if (Array.isArray(raw)) return extract(raw)
        const wrapped = raw as { items?: unknown[] } | null
        return extract(wrapped?.items ?? [])
      }
      setApiExams(norm(examsRes, (d) => d as ExamDto[]))
      setReports(norm(reportsRes, (d) => d as ReportDto[]))
      setCriticalValues(norm(criticalRes, (d) => d as CriticalValueDto[]))
      setAppointments(norm(aptRes, (d) => d as AppointmentDto[]))
      const allInvoices = norm(invRes, (d) => d as InvoiceDto[])
      setInvoices(allInvoices.filter((i) => i.patientId === patientId))
      setDataLoading(false)
      setDataError(null)
      if (!cancelled) {
        setDataLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [patientId, reloadKey])

  const localExams = useMemo<PatientExamRow[]>(() => {
    if (apiExams.length > 0) return apiExams.map(toExamRow)
    return getPatientExamsLocal(selectedPatient?.id ?? '', exams).map(toExamRow)
  }, [apiExams, selectedPatient?.id, exams])

  // [W2-4] mock 首访暖身: 检查/报告/危急值全空(store 异步种子未就绪) → 按 2.5s/5s/9s 退避自动重拉 (最多 3 次)
  useEffect(() => {
    if (!patientId || !dataLoaded || warmRetryCount >= 3) return
    const coreEmpty =
      apiExams.length === 0 && reports.length === 0 && criticalValues.length === 0
    if (!coreEmpty) return
    const delays = [2500, 5000, 9000]
    const t = setTimeout(() => {
      // mock 首访空结果会被客户端 GET 缓存(60s TTL)污染 → 重拉前先失效相关缓存
      try {
        invalidateApiCacheByPrefix('/patients/')
        invalidateApiCacheByPrefix('/criticals')
      } catch { /* ignore */ }
      setWarmRetryCount((c) => c + 1)
      setReloadKey((k) => k + 1)
    }, delays[warmRetryCount] ?? 9000)
    return () => clearTimeout(t)
  }, [dataLoaded, warmRetryCount, apiExams, reports, criticalValues, patientId])

  const stats = useMemo(() => {
    if (localExams.length > 0) {
      return {
        totalExams: localExams.length,
        positiveCount: localExams.filter((e) => e.hasCriticalValue).length,
        negativeCount: localExams.filter((e) => !e.hasCriticalValue).length,
        firstExamDate: normalizeDate(localExams[localExams.length - 1]?.scheduledAt || localExams[localExams.length - 1]?.examDate),
      }
    }
    return getPatientStats(selectedPatient?.id ?? '', exams)
  }, [localExams, selectedPatient?.id, exams])

  // [W2-4] 360° 多源时间线: 检查 + 报告 + 预约 + 危急值, 按时间倒序
  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = []
    localExams.forEach((e, i) => {
      events.push({
        key: `exam-${e.id ?? i}-${i}`,
        date: String(e.scheduledAt ?? e.examDate ?? '').slice(0, 16) || '-',
        type: 'exam',
        title: e.examItemName || e.examItem || `${e.modality} ${e.bodyPart}`,
        description: `${e.modality} · ${e.bodyPart}${e.deviceName || e.deviceModel ? ` · ${e.deviceName || e.deviceModel}` : ''}`,
        status: normalizeStatus(e.status),
        link: `/dicom-viewer?studyUid=${encodeURIComponent(e.id ?? '')}`,
        extra: '点击查看影像',
      })
    })
    reports.forEach((r, i) => {
      events.push({
        key: `report-${r.reportId}-${i}`,
        date: String(r.createdTime ?? r.updatedTime ?? '').slice(0, 16) || '-',
        type: 'report',
        title: `${r.modality} ${r.bodyPart} 报告`,
        description: (r.findings || r.impression || '').slice(0, 60) || '暂无内容',
        status: normalizeStatus(r.status),
        link: `/reports?reportId=${encodeURIComponent(r.reportId || r.id)}`,
        extra: '点击查看报告',
      })
    })
    appointments.forEach((a, i) => {
      const aptAny = a as unknown as { startAt?: string; scheduledAt?: string; date?: string; modality?: string; bodyPart?: string; deviceName?: string; deviceId?: string; priority?: string; state?: string }
      const date = aptAny.startAt || aptAny.scheduledAt || aptAny.date || ''
      events.push({
        key: `apt-${a.id}-${i}`,
        date: String(date).slice(0, 16) || '-',
        type: 'appointment',
        title: `预约检查 ${aptAny.modality ?? ''} ${aptAny.bodyPart ?? ''}`.trim(),
        description: `${aptAny.deviceName || aptAny.deviceId || '未排设备'} · 优先级 ${aptAny.priority ?? '-'}`,
        status: normalizeStatus(a.state),
        link: `/appointments?patientId=${encodeURIComponent(patientId ?? '')}`,
        extra: '点击前往预约',
      })
    })
    criticalValues.forEach((c, i) => {
      events.push({
        key: `critical-${c.id}-${i}`,
        date: String(c.triggeredAt ?? c.createdAt ?? '').slice(0, 16) || '-',
        type: 'critical',
        title: `危急值: ${c.finding || c.description || c.category || '未知'}`,
        description: `严重度 ${c.severity ?? '-'} · 状态 ${criticalClosed(c) ? '已闭环' : normalizeStatus(c.state ?? c.status)}`,
        status: criticalClosed(c) ? '已闭环' : (c.state ?? c.status ?? '处理中'),
        link: `/critical-value?cvId=${encodeURIComponent(c.id)}`,
        extra: '点击前往危急值',
      })
    })
    return events
  }, [localExams, reports, appointments, criticalValues, patientId])

  const isAdminView = !!isAdmin

  const handleMerge = async () => {
    if (!selectedPatient || !mergeTargetId.trim()) return
    setMergeLoading(true)
    setMergeError(null)
    setMergeResult(null)
    try {
      const res = await patientApi.merge(selectedPatient.id, mergeTargetId.trim())
      if (res.success && res.data?.ok) {
        setMergeResult(res.data.merged as MergeResult)
        showToast(`合并成功: ${selectedPatient.id} → ${mergeTargetId.trim()}`, 'success')
        setReloadKey((k) => k + 1)
      } else {
        setMergeError(res.error?.message ?? '合并失败')
      }
    } catch (e) {
      setMergeError((e as Error)?.message ?? '合并失败')
    } finally {
      setMergeLoading(false)
    }
  }

  const handleExportReport = async (report: ReportDto) => {
    const id = report.reportId || report.id
    setExportingId(id)
    try {
      const res = await reportApi.exportReport(id, 'pdf')
      if (res.success) {
        showToast(`报告 ${id} 已加入导出队列` + (res.data?.downloadUrl ? ` (${res.data.format})` : ''), 'success')
      } else {
        showToast(`导出失败: ${res.error?.message ?? '未知错误'}`, 'error')
      }
    } catch {
      showToast('导出请求失败，请稍后重试', 'error')
    } finally {
      setExportingId(null)
    }
  }

  if (!selectedPatient) {
    return (
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid #e2e8f0', padding: 60, textAlign: 'center' }}>
        <User size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 14, color: '#64748b' }}>请从患者列表选择一个患者查看详情</div>
        <button onClick={onBack} style={{ marginTop: 16, padding: '8px 20px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          返回患者列表
        </button>
      </div>
    )
  }

  const patientExams = localExams

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>
          <ArrowLeft size={14} />返回列表
        </button>
        <button
          onClick={() => navigate('/patients/' + encodeURIComponent(selectedPatient.id) + '/360')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}
        >
          <Layers size={14} />打开 360° 视图
        </button>
        {dataLoading && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
            <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> 正在加载多源数据...
          </span>
        )}
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          title="刷新数据"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#64748b', cursor: 'pointer' }}
        >
          <RefreshCw size={14} />刷新
        </button>
      </div>

      {dataError && !dataLoading && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#7f1d1d', borderRadius: 6, fontSize: 12 }}>{dataError}</div>
      )}

      {toast.show && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: toast.type === 'success' ? '#059669' : toast.type === 'error' ? '#dc2626' : '#2563eb', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {toast.message}
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #1e40af, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{selectedPatient.name.slice(0, 1)}</span>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1e40af' }}>{selectedPatient.name}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{selectedPatient.gender} · {selectedPatient.age}岁 · {selectedPatient.patientType}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>ID: {selectedPatient.id}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={() => navigate(`/appointments?patientId=${encodeURIComponent(selectedPatient.id)}`)}
              title="为患者新建检查预约"
              style={{ padding: '8px 16px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 4px rgba(30,58,95,0.3)' }}
            >
              <CalendarPlus size={14} />预约检查
            </button>
            <button
              onClick={() => navigate(`/follow-up?patientId=${encodeURIComponent(selectedPatient.id)}`)}
              title="进入随访管理"
              style={{ padding: '8px 16px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <ClipboardList size={14} />随访
            </button>
            {isAdminView && (
              <button
                onClick={() => { setShowMergeModal(true); setMergeTargetId(''); setMergeError(null); setMergeResult(null) }}
                title="管理员: 合并重复患者 (此患者归入目标患者)"
                style={{ padding: '8px 16px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <GitMerge size={14} />合并
              </button>
            )}
            <button onClick={() => onEdit(selectedPatient)}
              style={{ padding: '8px 16px', background: 'var(--bg-card)', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Edit2 size={14} />编辑
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: '出生日期', value: getBirthDateFromIdCard(selectedPatient.idCard), icon: <Calendar size={14} /> },
            { label: '身份证号', value: selectedPatient.idCard, icon: <CreditCard size={14} /> },
            { label: '联系电话', value: selectedPatient.phone, icon: <Phone size={14} /> },
            { label: '家庭住址', value: selectedPatient.address, icon: <MapPin size={14} /> },
            { label: '联系人', value: selectedPatient.emergencyContact, icon: <Contact size={14} /> },
            { label: '联系人电话', value: selectedPatient.emergencyPhone, icon: <Phone size={14} /> },
            { label: '就诊卡号', value: selectedPatient.id, icon: <CreditCard size={14} /> },
            { label: '患者类型', value: selectedPatient.patientType, icon: <User size={14} /> },
            { label: '医保类型', value: selectedPatient.insuranceType || '-', icon: <Shield size={14} /> },
            { label: '床位号', value: selectedPatient.bedNumber || '-', icon: <User size={14} /> },
            { label: '主治医师', value: selectedPatient.attendingDoctor || '-', icon: <Stethoscope size={14} /> },
            { label: '建档日期', value: selectedPatient.registrationDate, icon: <Calendar size={14} /> },
          ].map(item => (
            <div key={item.label} style={{ padding: 12, background: 'var(--content-bg)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ color: '#94a3b8' }}>{item.icon}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{item.label}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <div style={{ padding: 16, background: selectedPatient.allergyHistory && selectedPatient.allergyHistory !== '无' ? '#fef2f2' : '#f8fafc', border: `1px solid ${selectedPatient.allergyHistory && selectedPatient.allergyHistory !== '无' ? '#fecaca' : '#e2e8f0'}`, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <AlertTriangle size={14} color={selectedPatient.allergyHistory && selectedPatient.allergyHistory !== '无' ? '#dc2626' : '#94a3b8'} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>过敏史</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selectedPatient.allergyHistory || '无'}</div>
          </div>
          <div style={{ padding: 16, background: 'var(--content-bg)', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Clock size={14} color="#94a3b8" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>既往史</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selectedPatient.medicalHistory || '无'}</div>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 16 }}>检查统计</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div style={{ textAlign: 'center', padding: 16, background: '#eff6ff', borderRadius: 8 }}>
            <Activity size={24} color="#3b82f6" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1e40af' }}>{stats.totalExams}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>总检查次数</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, background: '#fef2f2', borderRadius: 8 }}>
            <AlertTriangle size={24} color="#dc2626" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626' }}>{stats.positiveCount}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>阳性/危急</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, background: '#f0fdf4', borderRadius: 8 }}>
            <CheckCircle size={24} color="#16a34a" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a' }}>{stats.negativeCount}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>阴性/正常</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, background: 'var(--content-bg)', borderRadius: 8 }}>
            <Clock size={24} color="#64748b" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>{stats.firstExamDate}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>首次检查日期</div>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>检查历史</div>
          <span style={{ fontSize: 12, color: '#64748b' }}>共 {patientExams.length} 条记录</span>
        </div>
        {patientExams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>暂无检查记录</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--content-bg)', borderBottom: '1px solid #e2e8f0' }}>
                  {['检查日期', '检查项目', '设备', '检查类型', '优先级', '状态', '报告结果', '操作'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patientExams.map((ex, idx) => {
                  const itemName = ex.examItemName || ex.examItem || `${ex.modality} ${ex.bodyPart}`
                  const deviceName = ex.deviceName || ex.deviceModel || '-'
                  return (
                    <tr key={ex.id ?? idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafbfc', cursor: 'pointer' }}
                      onClick={() => navigate(`/dicom-viewer?studyUid=${encodeURIComponent(ex.id ?? '')}`)}
                      title="点击查看影像">
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{normalizeDate(ex.scheduledAt || ex.examDate)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: '#1e40af' }}>{itemName}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{ex.modality} · {ex.bodyPart}</div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>{deviceName}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: 'var(--content-bg)', color: '#475569' }}>{ex.patientType || '门诊'}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, background: ex.priority === '危重' || ex.priority === '紧急' ? '#fef2f2' : '#f0fdf4', color: ex.priority === '危重' || ex.priority === '紧急' ? '#dc2626' : '#16a34a' }}>
                          {ex.priority || '普通'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: '#dbeafe', color: '#1e40af' }}>
                          {normalizeStatus(ex.status)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {ex.hasCriticalValue ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#dc2626', fontWeight: 600 }}>
                            <AlertCircle size={12} />阳性
                          </span>
                        ) : (
                          <span style={{ color: '#16a34a' }}>正常</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ color: '#2563eb', fontSize: 12, fontWeight: 600 }}>查看影像 →</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BellRing size={16} color="#dc2626" />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>危急值历史</div>
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>共 {criticalValues.length} 条记录</span>
        </div>
        {criticalValues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>该患者暂无危急值记录</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--content-bg)', borderBottom: '1px solid #e2e8f0' }}>
                  {['触发时间', '类型', '严重度', '状态', '闭环状态', '操作'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {criticalValues.map((cv, idx) => (
                  <tr key={cv.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafbfc', cursor: 'pointer' }}
                    onClick={() => navigate(`/critical-value?cvId=${encodeURIComponent(cv.id)}`)}
                    title="点击查看危急值详情">
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{String(cv.triggeredAt ?? cv.createdAt ?? '').slice(0, 16) || '-'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e40af' }}>{cv.finding || cv.description || cv.category || '-'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, background: '#fef2f2', color: '#dc2626' }}>
                        {cv.severity || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: 'var(--content-bg)', color: '#475569' }}>
                        {normalizeStatus(cv.state ?? cv.status)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {criticalClosed(cv) ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#16a34a', fontWeight: 600 }}>
                          <CheckCircle size={12} />已闭环
                        </span>
                      ) : (
                        <span style={{ color: '#d97706', fontWeight: 600 }}>处理中</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ color: '#2563eb', fontSize: 12, fontWeight: 600 }}>详情 →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} color="#059669" />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>检查报告</div>
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>共 {reports.length} 份报告</span>
        </div>
        {reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>该患者暂无报告</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--content-bg)', borderBottom: '1px solid #e2e8f0' }}>
                  {['报告编号', '检查项目', '状态', '出具时间', '报告医生', '操作'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r, idx) => (
                  <tr key={r.reportId || r.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#64748b', fontSize: 12 }}>{r.reportId || r.id}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e40af' }}>{r.modality} {r.bodyPart}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: '#eff6ff', color: '#2563eb' }}>
                        {normalizeStatus(r.status)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{String(r.createdTime ?? r.updatedTime ?? '').slice(0, 16) || '-'}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{r.doctorId || '-'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => navigate(`/reports?reportId=${encodeURIComponent(r.reportId || r.id)}`)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          <Eye size={12} />查看
                        </button>
                        <button
                          onClick={() => handleExportReport(r)}
                          disabled={exportingId === (r.reportId || r.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: '#f0fdf4', color: '#16a34a', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          <Download size={12} />{exportingId === (r.reportId || r.id) ? '导出中...' : '下载'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={16} color="#d97706" />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>费用账单</div>
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>共 {invoices.length} 张账单</span>
        </div>
        {invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>该患者暂无账单记录</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--content-bg)', borderBottom: '1px solid #e2e8f0' }}>
                  {['账单号', '检查项目', '日期', '总金额', '已付', '待缴', '状态'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, idx) => {
                  const invAny = inv as unknown as { balance?: number; examItem?: string; examDate?: string; invoiceNo?: string; invoiceId?: string; issuedAt?: string; insurancePaid?: number; selfPaid?: number }
                  const total = Number(inv.totalAmount ?? 0)
                  const paid = Number(inv.paidAmount ?? (inv.status === 'PAID' ? total : 0))
                  const balance = Number(invAny.balance ?? Math.max(0, total - paid))
                  const status = inv.status || (balance > 0 ? 'UNPAID' : 'PAID')
                  return (
                    <tr key={inv.id ?? invAny.invoiceId} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#64748b', fontSize: 12 }}>{invAny.invoiceNo || invAny.invoiceId || inv.id}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e40af' }}>{invAny.examItem || inv.items?.map(i => i.itemName).join('、') || '-'}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>{normalizeDate(invAny.examDate || inv.createdAt || invAny.issuedAt)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1e40af' }}>¥{total.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', color: '#16a34a' }}>¥{paid.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', color: balance > 0 ? '#dc2626' : '#94a3b8', fontWeight: 600 }}>¥{balance.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: status === 'PAID' ? '#f0fdf4' : status === 'PARTIAL' ? '#fffbeb' : '#fef2f2', color: status === 'PAID' ? '#16a34a' : status === 'PARTIAL' ? '#d97706' : '#dc2626' }}>
                          {status === 'PAID' ? '已结清' : status === 'PARTIAL' ? '部分支付' : '未支付'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={16} color="#1e40af" />
          患者360°时间线
          <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>(检查 · 报告 · 预约 · 危急值)</span>
        </div>
        <PatientTimeline events={timelineEvents} />
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Image size={16} color="#1e40af" />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>影像历史</div>
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>共 {patientExams.length} 组影像 · 点击卡片打开 DICOM 浏览器</span>
        </div>
        {patientExams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>暂无影像记录</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {patientExams.map((ex, idx) => {
              const itemName = ex.examItemName || ex.examItem || `${ex.modality} ${ex.bodyPart}`
              const imageCount = ex.imagesAcquired || 0
              return (
                <div key={ex.id ?? idx} style={{ padding: 12, background: 'var(--content-bg)', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer' }}
                  onClick={() => navigate(`/dicom-viewer?studyUid=${encodeURIComponent(ex.id ?? '')}`)}
                  title={`打开 ${itemName} 影像`}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#1e40af'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0'}>
                  <div style={{ width: '100%', height: 80, background: 'linear-gradient(135deg, #1e40af, #3b82f6)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Image size={24} color="rgba(255,255,255,0.6)" />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', marginBottom: 2 }}>{itemName}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{normalizeDate(ex.scheduledAt || ex.examDate)}</div>
                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{imageCount > 0 ? `${imageCount} 帧` : '待采集'}</span>
                    <span style={{ color: '#2563eb', fontWeight: 600 }}>打开 →</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showMergeModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={(e) => { if (e.target === e.currentTarget && !mergeLoading) setShowMergeModal(false) }}
        >
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #7f1d1d, #dc2626)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <GitMerge size={22} color="#fff" />
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>患者合并</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>将当前患者 {selectedPatient.name} ({selectedPatient.id}) 的所有关联数据归并到目标患者</div>
                </div>
              </div>
              <button onClick={() => { if (!mergeLoading) setShowMergeModal(false) }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color="#fff" />
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1e40af', marginBottom: 8 }}>目标患者 ID</label>
              <input
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                placeholder="例如 P000002"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ marginTop: 10, padding: 10, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
                合并后 {selectedPatient.name} 的检查、报告、预约、危急值将全部迁移至目标患者，源患者记录将被软删除。此操作不可撤销。
              </div>
              {mergeError && (
                <div style={{ marginTop: 10, padding: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#7f1d1d' }}>{mergeError}</div>
              )}
              {mergeResult && (
                <div style={{ marginTop: 10, padding: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12, color: '#166534' }}>
                  合并成功: 迁移检查 {mergeResult.movedExams ?? 0} 条 · 报告 {mergeResult.movedReports ?? 0} 份 · 预约 {mergeResult.movedAppointments ?? 0} 条 · 危急值 {mergeResult.movedCriticalValues ?? 0} 条
                </div>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowMergeModal(false)} disabled={mergeLoading} style={{ padding: '8px 20px', background: 'var(--bg-card)', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                取消
              </button>
              <button
                onClick={handleMerge}
                disabled={mergeLoading || !mergeTargetId.trim()}
                style={{ padding: '8px 20px', background: mergeLoading ? '#fca5a5' : '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: mergeLoading || !mergeTargetId.trim() ? 'not-allowed' : 'pointer' }}
              >
                {mergeLoading ? '合并中...' : '确认合并'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function getPatientExamsLocal(patientId: string, exams: RadiologyExam[]): RadiologyExam[] {
  return exams.filter((e) => e.patientId === patientId)
}
