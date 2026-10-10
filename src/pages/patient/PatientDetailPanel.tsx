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
  type CriticalValueDto, type AppointmentDto, type PatientSummaryDto,
} from '../../services/api'
import { invalidateApiCacheByPrefix } from '../../services/api/client'
import type { ReportDto, ExamDto, InvoiceDto } from '../../types/dto'
import { useAuth } from '../../hooks/useAuth'
import { t } from '../../i18n/appI18n'
import { StatusTag } from '../../components/common/StatusTag'
import { SeverityTag } from '../../components/common/SeverityTag'
import { DataTable } from '../../components/common'
import type { TableColumnsType } from 'antd'

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
  draft: 'patientDetailPanel.statusDraft', pending: 'patientDetailPanel.statusPendingReport', submitted: 'patientDetailPanel.statusPendingReport', reviewed: 'patientDetailPanel.statusReviewing',
  cosigned: 'patientDetailPanel.statusCosigned', published: 'patientDetailPanel.statusPublished', signed: 'patientDetailPanel.statusSigned', completed: 'patientDetailPanel.statusCompleted',
  in_progress: 'patientDetailPanel.statusInProgress', scheduled: 'patientDetailPanel.statusScheduled', checked_in: 'patientDetailPanel.statusCheckedIn', cancelled: 'patientDetailPanel.statusCancelled',
  no_show: 'patientDetailPanel.statusNoShow',
}

function normalizeStatus(status?: string): string {
  if (!status) return t('patientDetailPanel.unknown')
  if (/[\u4e00-\u9fa5]/.test(status)) return status
  return t(STATUS_MAP[status.toLowerCase()] || status)
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
      <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: 'var(--border-color)' }} />
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
                  border: '1px solid var(--border-color)', borderLeft: `3px solid ${color}`,
                  cursor: evt.link ? 'pointer' : 'default',
                }}
                onClick={evt.link ? () => navigate(evt.link!) : undefined}
                onMouseEnter={(e) => { if (evt.link) (e.currentTarget as HTMLDivElement).style.background = 'var(--color-info-bg)' }}
                onMouseLeave={(e) => { if (evt.link) (e.currentTarget as HTMLDivElement).style.background = 'var(--content-bg)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: '#1e40af', fontSize: 12 }}>
                    {evt.type === 'exam' && ''}
                    {evt.type === 'report' && ''}
                    {evt.type === 'appointment' && ''}
                    {evt.type === 'critical' && ''}
                    {evt.title}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{evt.date}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{evt.description}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                  {evt.status && (
                    <StatusTag status={evt.type === 'critical' ? 'critical' : 'info'} size="md">
                      {evt.status}
                    </StatusTag>
                  )}
                  {evt.extra && <span style={{ fontSize: 11, color: '#94a3b8' }}>{evt.extra}</span>}
                  {evt.link && <span style={{ fontSize: 11, color: '#2563eb', marginLeft: 'auto' }}>{t('patientDetailPanel.viewArrow')}</span>}
                </div>
              </div>
            </div>
          </div>
        )
      })}
      {sorted.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>{t('patientDetailPanel.noTimelineEvents')}</div>
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

  // [v3.0.6.11-104 Wave 2B] 患者综合摘要 (GET /patients/:id/summary)
  const [summary, setSummary] = useState<PatientSummaryDto | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  useEffect(() => {
    if (!patientId) return
    let cancelled = false
    setSummaryLoading(true)
    setSummaryError(null)
    void (async () => {
      try {
        const res = await patientApi.getSummary(patientId)
        if (cancelled) return
        if (res.success && res.data) {
          setSummary(res.data)
        } else {
          setSummary(null)
          setSummaryError(res.error?.message ?? t('patientPage.summaryLoadFailed'))
        }
      } catch (e) {
        if (!cancelled) {
          setSummary(null)
          setSummaryError((e as Error)?.message ?? t('patientPage.summaryLoadFailed'))
        }
      } finally {
        if (!cancelled) setSummaryLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [patientId, reloadKey])

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
    const timer = setTimeout(() => {
      // mock 首访空结果会被客户端 GET 缓存(60s TTL)污染 → 重拉前先失效相关缓存
      try {
        invalidateApiCacheByPrefix('/patients/')
        invalidateApiCacheByPrefix('/criticals')
      } catch { /* ignore */ }
      setWarmRetryCount((c) => c + 1)
      setReloadKey((k) => k + 1)
    }, delays[warmRetryCount] ?? 9000)
    return () => clearTimeout(timer)
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
        extra: t('patientDetailPanel.clickViewImages'),
      })
    })
    reports.forEach((r, i) => {
      events.push({
        key: `report-${r.reportId}-${i}`,
        date: String(r.createdTime ?? r.updatedTime ?? '').slice(0, 16) || '-',
        type: 'report',
        title: t('patientDetailPanel.reportTitle', { modality: r.modality, bodyPart: r.bodyPart }),
        description: (r.findings || r.impression || '').slice(0, 60) || t('patientDetailPanel.noContent'),
        status: normalizeStatus(r.status),
        link: `/reports?reportId=${encodeURIComponent(r.reportId || r.id)}`,
        extra: t('patientDetailPanel.clickViewReport'),
      })
    })
    appointments.forEach((a, i) => {
      const aptAny = a as unknown as { startAt?: string; scheduledAt?: string; date?: string; modality?: string; bodyPart?: string; deviceName?: string; deviceId?: string; priority?: string; state?: string }
      const date = aptAny.startAt || aptAny.scheduledAt || aptAny.date || ''
      events.push({
        key: `apt-${a.id}-${i}`,
        date: String(date).slice(0, 16) || '-',
        type: 'appointment',
        title: t('patientDetailPanel.appointmentTitle', { modality: aptAny.modality ?? '', bodyPart: aptAny.bodyPart ?? '' }).trim(),
        description: t('patientDetailPanel.appointmentDesc', { device: aptAny.deviceName || aptAny.deviceId || t('patientDetailPanel.noDevice'), priority: aptAny.priority ?? '-' }),
        status: normalizeStatus(a.state),
        link: `/appointments?patientId=${encodeURIComponent(patientId ?? '')}`,
        extra: t('patientDetailPanel.clickGoAppointment'),
      })
    })
    criticalValues.forEach((c, i) => {
      events.push({
        key: `critical-${c.id}-${i}`,
        date: String(c.triggeredAt ?? c.createdAt ?? '').slice(0, 16) || '-',
        type: 'critical',
        title: t('patientDetailPanel.criticalTitle', { finding: c.finding || c.description || c.category || t('patientDetailPanel.unknown') }),
        description: t('patientDetailPanel.criticalDesc', { severity: c.severity ?? '-', status: criticalClosed(c) ? t('patientDetailPanel.closedLoop') : normalizeStatus(c.state ?? c.status) }),
        status: criticalClosed(c) ? t('patientDetailPanel.closedLoop') : (c.state ?? c.status ?? t('patientDetailPanel.processing')),
        link: `/critical-value?cvId=${encodeURIComponent(c.id)}`,
        extra: t('patientDetailPanel.clickGoCritical'),
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
        showToast(t('patientDetailPanel.mergeSuccess', { from: selectedPatient.id, to: mergeTargetId.trim() }), 'success')
        setReloadKey((k) => k + 1)
      } else {
        setMergeError(res.error?.message ?? t('patientDetailPanel.mergeFailed'))
      }
    } catch (e) {
      setMergeError((e as Error)?.message ?? t('patientDetailPanel.mergeFailed'))
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
        showToast(t('patientDetailPanel.exportQueued', { id, format: res.data?.downloadUrl ? ` (${res.data.format})` : '' }), 'success')
      } else {
        showToast(t('patientDetailPanel.exportFailedDetail', { error: res.error?.message ?? t('patientDetailPanel.unknownError') }), 'error')
      }
    } catch {
      showToast(t('patientDetailPanel.exportRequestFailed'), 'error')
    } finally {
      setExportingId(null)
    }
  }

  if (!selectedPatient) {
    return (
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: 60, textAlign: 'center' }}>
        <User size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 14, color: '#64748b' }}>{t('patientDetailPanel.selectPatientHint')}</div>
        <button onClick={onBack} style={{ marginTop: 16, padding: '8px 20px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {t('patientDetailPanel.backToPatientList')}
        </button>
      </div>
    )
  }

  const patientExams = localExams

  const examColumns: TableColumnsType<PatientExamRow> = [
    { title: t('patientDetailPanel.colExamDate'), key: 'examDate', render: (_v, ex) => <span style={{ color: 'var(--text-secondary)' }}>{normalizeDate(ex.scheduledAt || ex.examDate)}</span> },
    {
      title: t('patientDetailPanel.colExamItem'), key: 'examItem',
      render: (_v, ex) => {
        const itemName = ex.examItemName || ex.examItem || `${ex.modality} ${ex.bodyPart}`
        return (
          <>
            <div style={{ fontWeight: 600, color: '#1e40af' }}>{itemName}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{ex.modality} · {ex.bodyPart}</div>
          </>
        )
      },
    },
    { title: t('patientDetailPanel.colDevice'), key: 'device', render: (_v, ex) => <span style={{ color: '#64748b', fontSize: 12 }}>{ex.deviceName || ex.deviceModel || '-'}</span> },
    { title: t('patientDetailPanel.colExamType'), key: 'patientType', render: (_v, ex) => <StatusTag status="neutral" size="md">{ex.patientType || t('patientDetailPanel.outpatient')}</StatusTag> },
    {
      title: t('patientDetailPanel.colPriority'), key: 'priority',
      render: (_v, ex) => (
        <StatusTag status={ex.priority === '危重' || ex.priority === '紧急' ? 'critical' : 'success'} size="md" style={{ fontWeight: 700 }}>
          {ex.priority || t('patientDetailPanel.normal')}
        </StatusTag>
      ),
    },
    {
      title: t('patientDetailPanel.colStatus'), key: 'status',
      render: (_v, ex) => (
        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
          {normalizeStatus(ex.status)}
        </span>
      ),
    },
    {
      title: t('patientDetailPanel.colReportResult'), key: 'result',
      render: (_v, ex) => (
        ex.hasCriticalValue ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#dc2626', fontWeight: 600 }}>
            <AlertCircle size={14} />{t('patientDetailPanel.positive')}
          </span>
        ) : (
          <span style={{ color: '#16a34a' }}>{t('patientDetailPanel.normalResult')}</span>
        )
      ),
    },
    { title: t('patientDetailPanel.colActions'), key: 'actions', render: () => <span style={{ color: '#2563eb', fontSize: 12, fontWeight: 600 }}>{t('patientDetailPanel.viewImagesArrow')}</span> },
  ]

  const criticalColumns: TableColumnsType<CriticalValueDto> = [
    { title: t('patientDetailPanel.colTriggeredAt'), key: 'triggeredAt', render: (_v, cv) => <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{String(cv.triggeredAt ?? cv.createdAt ?? '').slice(0, 16) || '-'}</span> },
    { title: t('patientDetailPanel.colType'), key: 'finding', render: (_v, cv) => <span style={{ fontWeight: 600, color: '#1e40af' }}>{cv.finding || cv.description || cv.category || '-'}</span> },
    {
      title: t('patientDetailPanel.colSeverity'), key: 'severity',
      render: (_v, cv) => (
        <SeverityTag level={cv.severity || 'neutral'} size="md" style={{ fontWeight: 700 }}>
          {cv.severity || '-'}
        </SeverityTag>
      ),
    },
    { title: t('patientDetailPanel.colStatus'), key: 'state', render: (_v, cv) => <StatusTag status="neutral" size="md">{normalizeStatus(cv.state ?? cv.status)}</StatusTag> },
    {
      title: t('patientDetailPanel.colClosedState'), key: 'closed',
      render: (_v, cv) => (
        criticalClosed(cv) ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#16a34a', fontWeight: 600 }}>
            <CheckCircle size={14} />{t('patientDetailPanel.closedLoop')}
          </span>
        ) : (
          <span style={{ color: '#d97706', fontWeight: 600 }}>{t('patientDetailPanel.processing')}</span>
        )
      ),
    },
    { title: t('patientDetailPanel.colActions'), key: 'actions', render: () => <span style={{ color: '#2563eb', fontSize: 12, fontWeight: 600 }}>{t('patientDetailPanel.detailArrow')}</span> },
  ]

  const reportColumns: TableColumnsType<ReportDto> = [
    { title: t('patientDetailPanel.colReportId'), key: 'reportId', render: (_v, r) => <span style={{ fontFamily: 'monospace', color: '#64748b', fontSize: 12 }}>{r.reportId || r.id}</span> },
    { title: t('patientDetailPanel.colExamItem'), key: 'examItem', render: (_v, r) => <span style={{ fontWeight: 600, color: '#1e40af' }}>{r.modality} {r.bodyPart}</span> },
    { title: t('patientDetailPanel.colStatus'), key: 'status', render: (_v, r) => <StatusTag status="info" size="md">{normalizeStatus(r.status)}</StatusTag> },
    { title: t('patientDetailPanel.colIssuedAt'), key: 'issuedAt', render: (_v, r) => <span style={{ color: '#64748b' }}>{String(r.createdTime ?? r.updatedTime ?? '').slice(0, 16) || '-'}</span> },
    { title: t('patientDetailPanel.colReportDoctor'), key: 'doctorId', render: (_v, r) => <span style={{ color: '#64748b' }}>{r.doctorId || '-'}</span> },
    {
      title: t('patientDetailPanel.colActions'), key: 'actions',
      render: (_v, r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => navigate(`/reports?reportId=${encodeURIComponent(r.reportId || r.id)}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: 'var(--color-info-bg)', color: 'var(--color-info)', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <Eye size={14} />{t('patientDetailPanel.view')}
          </button>
          <button
            onClick={() => handleExportReport(r)}
            disabled={exportingId === (r.reportId || r.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: 'var(--color-success-bg)', color: 'var(--color-success)', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <Download size={14} />{exportingId === (r.reportId || r.id) ? t('patientDetailPanel.exporting') : t('patientDetailPanel.download')}
          </button>
        </div>
      ),
    },
  ]

  const invoiceColumns: TableColumnsType<InvoiceDto> = [
    {
      title: t('patientDetailPanel.colInvoiceNo'), key: 'invoiceNo',
      render: (_v, inv) => {
        const invAny = inv as unknown as { invoiceNo?: string; invoiceId?: string }
        return <span style={{ fontFamily: 'monospace', color: '#64748b', fontSize: 12 }}>{invAny.invoiceNo || invAny.invoiceId || inv.id}</span>
      },
    },
    {
      title: t('patientDetailPanel.colExamItem'), key: 'examItem',
      render: (_v, inv) => {
        const invAny = inv as unknown as { examItem?: string }
        return <span style={{ fontWeight: 600, color: '#1e40af' }}>{invAny.examItem || inv.items?.map(i => i.itemName).join('、') || '-'}</span>
      },
    },
    {
      title: t('patientDetailPanel.colDate'), key: 'date',
      render: (_v, inv) => {
        const invAny = inv as unknown as { examDate?: string; issuedAt?: string }
        return <span style={{ color: '#64748b' }}>{normalizeDate(invAny.examDate || inv.createdAt || invAny.issuedAt)}</span>
      },
    },
    { title: t('patientDetailPanel.colTotalAmount'), key: 'total', render: (_v, inv) => <span style={{ fontWeight: 700, color: '#1e40af' }}>¥{Number(inv.totalAmount ?? 0).toFixed(2)}</span> },
    {
      title: t('patientDetailPanel.colPaid'), key: 'paid',
      render: (_v, inv) => {
        const total = Number(inv.totalAmount ?? 0)
        const paid = Number(inv.paidAmount ?? (inv.status === 'PAID' ? total : 0))
        return <span style={{ color: '#16a34a' }}>¥{paid.toFixed(2)}</span>
      },
    },
    {
      title: t('patientDetailPanel.colBalance'), key: 'balance',
      render: (_v, inv) => {
        const invAny = inv as unknown as { balance?: number }
        const total = Number(inv.totalAmount ?? 0)
        const paid = Number(inv.paidAmount ?? (inv.status === 'PAID' ? total : 0))
        const balance = Number(invAny.balance ?? Math.max(0, total - paid))
        return <span style={{ color: balance > 0 ? '#dc2626' : '#94a3b8', fontWeight: 600 }}>¥{balance.toFixed(2)}</span>
      },
    },
    {
      title: t('patientDetailPanel.colStatus'), key: 'status',
      render: (_v, inv) => {
        const total = Number(inv.totalAmount ?? 0)
        const paid = Number(inv.paidAmount ?? (inv.status === 'PAID' ? total : 0))
        const status = inv.status || (Math.max(0, total - paid) > 0 ? 'UNPAID' : 'PAID')
        return (
          <StatusTag status={status === 'PAID' ? 'success' : status === 'PARTIAL' ? 'warning' : 'failed'} size="md">
            {status === 'PAID' ? t('patientDetailPanel.settled') : status === 'PARTIAL' ? t('patientDetailPanel.partialPaid') : t('patientDetailPanel.unpaid')}
          </StatusTag>
        )
      },
    },
  ]

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>
          <ArrowLeft size={14} />{t('patientDetailPanel.backToList')}
        </button>
        <button
          onClick={() => navigate('/patients/' + encodeURIComponent(selectedPatient.id) + '/360')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--color-info)', cursor: 'pointer' }}
        >
          <Layers size={14} />{t('patientDetailPanel.open360View')}
        </button>
        {dataLoading && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
            <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> {t('patientDetailPanel.loadingMultiSource')}
          </span>
        )}
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          title={t('patientDetailPanel.refreshDataTitle')}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#64748b', cursor: 'pointer' }}
        >
          <RefreshCw size={14} />{t('patientDetailPanel.refresh')}
        </button>
      </div>

      {dataError && !dataLoading && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', color: 'var(--color-error)', borderRadius: 6, fontSize: 12 }}>{dataError}</div>
      )}

      {toast.show && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '10px 18px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: toast.type === 'success' ? '#059669' : toast.type === 'error' ? '#dc2626' : '#2563eb', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {toast.message}
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: 24, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #1e40af, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: '#fff' }}>{selectedPatient.name.slice(0, 1)}</span>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1e40af' }}>{selectedPatient.name}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{selectedPatient.gender} · {selectedPatient.age}{t('patientDetailPanel.ageSuffix')} · {selectedPatient.patientType}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>ID: {selectedPatient.id}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={() => navigate(`/appointments?patientId=${encodeURIComponent(selectedPatient.id)}`)}
              title={t('patientDetailPanel.newAppointmentTitle')}
              style={{ padding: '8px 16px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 4px rgba(30,58,95,0.3)' }}
            >
              <CalendarPlus size={14} />{t('patientDetailPanel.newAppointment')}
            </button>
            <button
              onClick={() => navigate(`/follow-up?patientId=${encodeURIComponent(selectedPatient.id)}`)}
              title={t('patientDetailPanel.followUpTitle')}
              style={{ padding: '8px 16px', background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <ClipboardList size={14} />{t('patientDetailPanel.followUp')}
            </button>
            {isAdminView && (
              <button
                onClick={() => { setShowMergeModal(true); setMergeTargetId(''); setMergeError(null); setMergeResult(null) }}
                title={t('patientDetailPanel.mergeTitle')}
                style={{ padding: '8px 16px', background: 'var(--color-error-bg)', color: 'var(--color-error)', border: '1px solid var(--color-error-border)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <GitMerge size={14} />{t('patientDetailPanel.merge')}
              </button>
            )}
            <button onClick={() => onEdit(selectedPatient)}
              style={{ padding: '8px 16px', background: 'var(--bg-card)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Edit2 size={14} />{t('patientDetailPanel.edit')}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: t('patientDetailPanel.birthDate'), value: getBirthDateFromIdCard(selectedPatient.idCard), icon: <Calendar size={14} /> },
            { label: t('patientDetailPanel.idCardNo'), value: selectedPatient.idCard, icon: <CreditCard size={14} /> },
            { label: t('patientDetailPanel.phone'), value: selectedPatient.phone, icon: <Phone size={14} /> },
            { label: t('patientDetailPanel.address'), value: selectedPatient.address, icon: <MapPin size={14} /> },
            { label: t('patientDetailPanel.emergencyContact'), value: selectedPatient.emergencyContact, icon: <Contact size={14} /> },
            { label: t('patientDetailPanel.emergencyPhone'), value: selectedPatient.emergencyPhone, icon: <Phone size={14} /> },
            { label: t('patientDetailPanel.cardNo'), value: selectedPatient.id, icon: <CreditCard size={14} /> },
            { label: t('patientDetailPanel.patientType'), value: selectedPatient.patientType, icon: <User size={14} /> },
            { label: t('patientDetailPanel.insuranceType'), value: selectedPatient.insuranceType || '-', icon: <Shield size={14} /> },
            { label: t('patientDetailPanel.bedNumber'), value: selectedPatient.bedNumber || '-', icon: <User size={14} /> },
            { label: t('patientDetailPanel.attendingDoctor'), value: selectedPatient.attendingDoctor || '-', icon: <Stethoscope size={14} /> },
            { label: t('patientDetailPanel.registrationDate'), value: selectedPatient.registrationDate, icon: <Calendar size={14} /> },
          ].map(item => (
            <div key={item.label} style={{ padding: 12, background: 'var(--content-bg)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ color: '#94a3b8' }}>{item.icon}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{item.label}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <div style={{ padding: 16, background: selectedPatient.allergyHistory && selectedPatient.allergyHistory !== t('patientDetailPanel.none') ? 'var(--color-error-bg)' : 'var(--bg-card)', border: `1px solid ${selectedPatient.allergyHistory && selectedPatient.allergyHistory !== t('patientDetailPanel.none') ? 'var(--color-error-border)' : 'var(--border-color)'}`, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <AlertTriangle size={14} color={selectedPatient.allergyHistory && selectedPatient.allergyHistory !== t('patientDetailPanel.none') ? '#dc2626' : '#94a3b8'} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{t('patientDetailPanel.allergyHistory')}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedPatient.allergyHistory || t('patientDetailPanel.none')}</div>
          </div>
          <div style={{ padding: 16, background: 'var(--content-bg)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Clock size={14} color="#94a3b8" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{t('patientDetailPanel.medicalHistory')}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedPatient.medicalHistory || t('patientDetailPanel.none')}</div>
          </div>
        </div>
      </div>

      {/* [v3.0.6.11-104 Wave 2B] 患者综合摘要 (GET /patients/:id/summary) */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>{t('patientPage.summaryCard')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {summaryLoading && <span style={{ fontSize: 12, color: '#94a3b8' }}>{t('common.loading')}</span>}
            {summaryError && <span style={{ fontSize: 12, color: '#d97706' }}>{summaryError}</span>}
          </div>
        </div>
        {!summary ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 12 }}>{t('patientPage.summaryEmpty')}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
            {[
              { label: t('patientPage.summaryExams'), value: summary.counts.exams, color: '#1e40af', bg: 'var(--color-info-bg)' },
              { label: t('patientPage.summaryReports'), value: summary.counts.reports, color: '#16a34a', bg: 'var(--color-success-bg)' },
              { label: t('patientPage.summaryFollowUps'), value: summary.counts.followUps, color: '#d97706', bg: 'var(--color-warning-bg)' },
              { label: t('patientPage.summaryCriticals'), value: summary.counts.criticalValues, color: '#dc2626', bg: 'var(--color-error-bg)' },
              { label: t('patientPage.summaryInvoices'), value: summary.counts.invoices, color: '#7c3aed', bg: 'var(--bg-card)' },
              { label: t('patientPage.summaryCharges'), value: `¥${summary.totalCharges}`, color: '#d97706', bg: 'var(--content-bg)' },
            ].map((item) => (
              <div key={item.label} style={{ textAlign: 'center', padding: 14, borderRadius: 8, background: item.bg }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{item.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 16 }}>{t('patientDetailPanel.examStatsTitle')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div style={{ textAlign: 'center', padding: 16, background: 'var(--color-info-bg)', borderRadius: 8 }}>
            <Activity size={24} color="#3b82f6" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 30, fontWeight: 800, color: '#1e40af' }}>{stats.totalExams}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{t('patientDetailPanel.totalExamCount')}</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, background: 'var(--color-error-bg)', borderRadius: 8 }}>
            <AlertTriangle size={24} color="#dc2626" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 30, fontWeight: 800, color: '#dc2626' }}>{stats.positiveCount}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{t('patientDetailPanel.positiveCritical')}</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, background: 'var(--color-success-bg)', borderRadius: 8 }}>
            <CheckCircle size={24} color="#16a34a" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 30, fontWeight: 800, color: '#16a34a' }}>{stats.negativeCount}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{t('patientDetailPanel.negativeNormal')}</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, background: 'var(--content-bg)', borderRadius: 8 }}>
            <Clock size={24} color="#64748b" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>{stats.firstExamDate}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{t('patientDetailPanel.firstExamDate')}</div>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>{t('patientDetailPanel.examHistoryTitle')}</div>
          <span style={{ fontSize: 12, color: '#64748b' }}>{t('patientDetailPanel.recordsCount', { count: patientExams.length })}</span>
        </div>
        {patientExams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>{t('patientDetailPanel.noExamRecords')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <DataTable<PatientExamRow>
              columns={examColumns}
              dataSource={patientExams}
              rowKey={(ex, idx) => String(ex.id ?? idx)}
              onRow={(ex) => ({
                onClick: () => navigate(`/dicom-viewer?studyUid=${encodeURIComponent(ex.id ?? '')}`),
                title: t('patientDetailPanel.clickViewImages'),
                style: { cursor: 'pointer' },
              })}
            />
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BellRing size={16} color="#dc2626" />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>{t('patientDetailPanel.criticalHistoryTitle')}</div>
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>{t('patientDetailPanel.recordsCount', { count: criticalValues.length })}</span>
        </div>
        {criticalValues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>{t('patientDetailPanel.noCriticalRecords')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <DataTable<CriticalValueDto>
              columns={criticalColumns}
              dataSource={criticalValues}
              rowKey="id"
              onRow={(cv) => ({
                onClick: () => navigate(`/critical-value?cvId=${encodeURIComponent(cv.id)}`),
                title: t('patientDetailPanel.clickViewCriticalDetail'),
                style: { cursor: 'pointer' },
              })}
            />
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} color="#059669" />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>{t('patientDetailPanel.reportSectionTitle')}</div>
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>{t('patientDetailPanel.reportsCount', { count: reports.length })}</span>
        </div>
        {reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>{t('patientDetailPanel.noReports')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <DataTable<ReportDto>
              columns={reportColumns}
              dataSource={reports}
              rowKey={(r) => String(r.reportId || r.id)}
            />
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={16} color="#d97706" />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>{t('patientDetailPanel.invoiceSectionTitle')}</div>
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>{t('patientDetailPanel.invoicesCount', { count: invoices.length })}</span>
        </div>
        {invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>{t('patientDetailPanel.noInvoices')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <DataTable<InvoiceDto>
              columns={invoiceColumns}
              dataSource={invoices}
              rowKey={(inv) => String(inv.id ?? (inv as unknown as { invoiceId?: string }).invoiceId)}
            />
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={16} color="#1e40af" />
          {t('patientDetailPanel.timelineTitle')}
          <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>{t('patientDetailPanel.timelineSubtitle')}</span>
        </div>
        <PatientTimeline events={timelineEvents} />
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Image size={16} color="#1e40af" />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af' }}>{t('patientDetailPanel.imageHistoryTitle')}</div>
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>{t('patientDetailPanel.imageCount', { count: patientExams.length })}</span>
        </div>
        {patientExams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>{t('patientDetailPanel.noImages')}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {patientExams.map((ex, idx) => {
              const itemName = ex.examItemName || ex.examItem || `${ex.modality} ${ex.bodyPart}`
              const imageCount = ex.imagesAcquired || 0
              return (
                <div key={ex.id ?? idx} style={{ padding: 12, background: 'var(--content-bg)', borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'pointer' }}
                  onClick={() => navigate(`/dicom-viewer?studyUid=${encodeURIComponent(ex.id ?? '')}`)}
                  title={t('patientDetailPanel.openImageTitle', { name: itemName })}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#1e40af'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-color)'}>
                  <div style={{ width: '100%', height: 80, background: 'linear-gradient(135deg, #1e40af, #3b82f6)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Image size={24} color="rgba(255,255,255,0.6)" />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', marginBottom: 2 }}>{itemName}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{normalizeDate(ex.scheduledAt || ex.examDate)}</div>
                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{imageCount > 0 ? t('patientDetailPanel.frames', { count: imageCount }) : t('patientDetailPanel.pendingAcquisition')}</span>
                    <span style={{ color: '#2563eb', fontWeight: 600 }}>{t('patientDetailPanel.openArrow')}</span>
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
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #7f1d1d, #dc2626)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <GitMerge size={22} color="#fff" />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{t('patientDetailPanel.mergeModalTitle')}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{t('patientDetailPanel.mergeModalDesc', { name: selectedPatient.name, id: selectedPatient.id })}</div>
                </div>
              </div>
              <button onClick={() => { if (!mergeLoading) setShowMergeModal(false) }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color="#fff" />
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1e40af', marginBottom: 8 }}>{t('patientDetailPanel.mergeTargetLabel')}</label>
              <input
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                placeholder={t('patientDetailPanel.mergeTargetPlaceholder')}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
              />
              <div style={{ marginTop: 10, padding: 10, background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-warning)', lineHeight: 1.6 }}>
                {t('patientDetailPanel.mergeWarning', { name: selectedPatient.name })}
              </div>
              {mergeError && (
                <div style={{ marginTop: 10, padding: 10, background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-error)' }}>{mergeError}</div>
              )}
              {mergeResult && (
                <div style={{ marginTop: 10, padding: 10, background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-success)' }}>
                  {t('patientDetailPanel.mergeResultDetail', { exams: mergeResult.movedExams ?? 0, reports: mergeResult.movedReports ?? 0, appointments: mergeResult.movedAppointments ?? 0, criticals: mergeResult.movedCriticalValues ?? 0 })}
                </div>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowMergeModal(false)} disabled={mergeLoading} style={{ padding: '8px 20px', background: 'var(--bg-card)', color: '#64748b', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t('patientDetailPanel.cancel')}
              </button>
              <button
                onClick={handleMerge}
                disabled={mergeLoading || !mergeTargetId.trim()}
                style={{ padding: '8px 20px', background: mergeLoading ? '#fca5a5' : '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: mergeLoading || !mergeTargetId.trim() ? 'not-allowed' : 'pointer' }}
              >
                {mergeLoading ? t('patientDetailPanel.merging') : t('patientDetailPanel.confirmMerge')}
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
