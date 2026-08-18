import { useState, useEffect } from 'react'
import { Printer, Download } from 'lucide-react'
import { Spin, Alert, message, Tabs, Tag, Rate, Select, Input, Empty, Descriptions, Statistic, Drawer, Card } from 'antd'
import {
  patientPortalApi,
  type PortalPatientDto,
  type PortalClinicalDataDto,
  type PortalMobileUserDto,
  type ExamHistoryItemDto,
  type ImagePreviewDto,
  type PortalAppointmentDto,
  type PortalReportDto,
  type PortalImageStudyDto,
} from '../../services/api'
import { followupApi, type FollowUpPlan } from '../../services/api/followupApi'
import { t } from '../../i18n/appI18n'

// ===== Types =====
export type { PortalPatientDto as PatientPortalUser, ExamHistoryItemDto as ExamHistoryItem, ImagePreviewDto as ImagePreview }

// ===== Constants =====
const MODALITIES: Array<{ value: string; label: string; parts: string[] }> = [
  { value: 'CT', label: t('selfService.modality.ct'), parts: [t('selfService.part.head'), t('selfService.part.chest'), t('selfService.part.abdomen'), t('selfService.part.lumbar')] },
  { value: 'MR', label: t('selfService.modality.mr'), parts: [t('selfService.part.brain'), t('selfService.part.cervical'), t('selfService.part.lumbar'), t('selfService.part.knee')] },
  { value: 'DR', label: t('selfService.modality.dr'), parts: [t('selfService.part.chest'), t('selfService.part.lumbar'), t('selfService.part.limbs'), t('selfService.part.abdomen')] },
  { value: 'US', label: t('selfService.modality.us'), parts: [t('selfService.part.abdomen'), t('selfService.part.thyroid'), t('selfService.part.breast'), t('selfService.part.heart')] },
]

// [v3.0.6.11-96 Wave3B G-30 P2] 随访类型选项
const FOLLOWUP_TYPES = [
  { value: '复查', label: t('selfService.followupType.routine'), intervalDays: 30 },
  { value: '增强随访', label: t('selfService.followupType.enhanced'), intervalDays: 90 },
  { value: '结节随访', label: t('selfService.followupType.nodule'), intervalDays: 180 },
  { value: '术后随访', label: t('selfService.followupType.postop'), intervalDays: 90 },
]

// [v3.0.6.11-96 Wave3B G-30 P2] 随访计划演示回退数据 (followupApi 不可用时)
const MOCK_FOLLOWUPS = [
  { id: 'FU-DEMO-1', patientId: 'P001', patientName: '演示患者', planDate: '2026-07-01', intervalDays: 30, nextDate: '2026-08-01', status: 'IN_PROGRESS' as const, note: '肺结节 6 个月随访', reminderEnabled: true, completedAt: null },
  { id: 'FU-DEMO-2', patientId: 'P001', patientName: '演示患者', planDate: '2026-07-15', intervalDays: 90, nextDate: '2026-10-15', status: 'PENDING' as const, note: '乳腺 BI-RADS 3 定期复查', reminderEnabled: true, completedAt: null },
]

const FOLLOWUP_STATE_LABEL: Record<string, string> = {
  PENDING: '待随访', IN_PROGRESS: '随访中', COMPLETED: '已完成', OVERDUE: '已逾期',
}

const TIME_SLOTS = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']

const FEEDBACK_CATEGORIES = [t('selfService.feedbackCategory.experience'), t('selfService.feedbackCategory.process'), t('selfService.feedbackCategory.report'), t('selfService.feedbackCategory.imaging'), t('selfService.feedbackCategory.other')]

const APPOINTMENT_STATE_LABEL: Record<string, string> = {
  SCHEDULED: '已预约', CONFIRMED: '已确认', REGISTERED: '已登记', CHECKED_IN: '已到检',
  IN_PROGRESS: '检查中', COMPLETED: '已完成', CANCELLED: '已取消', NO_SHOW: '未到检',
}

const REPORT_STATE_LABEL: Record<string, string> = {
  PUBLISHED: '已发布', AMENDED: '已修订', SIGNED: '已签发', SUBMITTED: '审核中',
}

// ===== Styles =====
const styles = {
  container: { maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: '-apple-system, sans-serif' },
  card: { background: 'var(--bg-card)', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 },
  subTitle: { fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: 16 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  label: { fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 },
  value: { fontSize: 14, color: 'var(--text-primary)' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#64748b', textAlign: 'left' as const, borderBottom: '2px solid var(--border-color)' },
  td: { padding: '10px 12px', fontSize: 13, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' },
  badge: (status: string) => ({
    padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    background: status === '已出报告' || status === '已发布' ? 'var(--color-success-bg)' : status === '审核中' ? 'var(--color-warning-bg)' : 'var(--bg-card)',
    color: status === '已出报告' || status === '已发布' ? 'var(--color-success)' : status === '审核中' ? 'var(--color-warning)' : 'var(--text-secondary)',
  }),
  btn: { padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#1e40af', color: '#fff' },
  btnGreen: { padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#0d9488', color: '#fff' },
  imageGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 },
  imageCard: { background: 'var(--bg-card)', borderRadius: 8, padding: 12, border: '1px solid var(--border-color)' },
  imagePlaceholder: { width: '100%', aspectRatio: '1', background: 'var(--bg-elevated)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12, marginBottom: 8 },
  slider: { width: '100%', margin: '4px 0' },
  voucherBtn: { padding: '12px 24px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#059669', color: '#fff' },
  voucherCode: { marginTop: 12, padding: 12, background: 'var(--color-success-bg)', borderRadius: 8, fontSize: 16, fontWeight: 600, color: 'var(--color-success)', fontFamily: 'monospace', textAlign: 'center' as const, letterSpacing: 2 },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 },
  todoItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' },
}

// ===== Helpers =====
const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const fmtDateTime = (iso?: string) => {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${fmtDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const stateColor = (state: string): string => {
  if (state === 'CANCELLED' || state === 'NO_SHOW' || state === 'REJECTED' || state === 'WITHDRAWN') return 'error'
  if (state === 'COMPLETED' || state === 'PUBLISHED' || state === 'SIGNED' || state === 'CHECKED_IN' || state === 'CONFIRMED') return 'success'
  if (state === 'IN_PROGRESS') return 'processing'
  return 'default'
}

// ===== MiniCalendar: 月份网格选日期 (周一起始, 禁选过去日期) =====
function MiniCalendar(props: {
  month: Date
  selected?: string
  onSelect: (dateStr: string) => void
  onMonthChange: (month: Date) => void
}) {
  const { month, selected, onSelect, onMonthChange } = props
  const todayStr = fmtDate(new Date())
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const startDow = (new Date(year, monthIndex, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells: Array<string | null> = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(fmtDate(new Date(year, monthIndex, d)))
  const weekdayHeaders = [t('selfService.weekday.mon'), t('selfService.weekday.tue'), t('selfService.weekday.wed'), t('selfService.weekday.thu'), t('selfService.weekday.fri'), t('selfService.weekday.sat'), t('selfService.weekday.sun')]
  return (
    <div style={{ userSelect: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))}
          style={{ ...styles.btn, background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
        >{t('selfService.booking.prevMonth')}</button>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('selfService.calendar.yearMonth', { year, month: monthIndex + 1 })}</div>
        <button
          type="button"
          onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))}
          style={{ ...styles.btn, background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
        >{t('selfService.booking.nextMonth')}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {weekdayHeaders.map(w => (
          <div key={w} style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e-${i}`} />
          const disabled = cell < todayStr
          const isSelected = cell === selected
          const isToday = cell === todayStr
          return (
            <button
              key={cell}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(cell)}
              style={{
                padding: '8px 0', borderRadius: 8, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
                border: isSelected ? '2px solid #1e40af' : isToday ? '2px solid #93c5fd' : '1px solid var(--border-color)',
                background: isSelected ? '#1e40af' : isToday ? 'var(--color-info-bg)' : 'var(--bg-card)',
                color: isSelected ? '#fff' : disabled ? '#cbd5e1' : 'var(--text-secondary)',
                fontWeight: isToday || isSelected ? 700 : 400,
              }}
            >{Number(cell.slice(8))}</button>
          )
        })}
      </div>
    </div>
  )
}

// ===== Component =====
export default function SelfServicePortal() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [loginId, setLoginId] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const [user, setUser] = useState<PortalPatientDto | null>(null)
  const [exams, setExams] = useState<ExamHistoryItemDto[]>([])
  const [appointments, setAppointments] = useState<PortalAppointmentDto[]>([])
  const [reports, setReports] = useState<PortalReportDto[]>([])
  const [educations, setEducations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('home')

  // 预约
  const [booking, setBooking] = useState<{ modality?: string; bodyPart?: string; date?: string; slot?: string }>({})
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingDone, setBookingDone] = useState<PortalAppointmentDto | null>(null)

  // 报告
  const [expandedReport, setExpandedReport] = useState<string | null>(null)

  // 影像
  const [selectedExam, setSelectedExam] = useState<ExamHistoryItemDto | null>(null)
  const [images, setImages] = useState<ImagePreviewDto[]>([])
  const [study, setStudy] = useState<PortalImageStudyDto | null>(null)
  const [voucherCode, setVoucherCode] = useState<string | null>(null)

  // 反馈
  const [rating, setRating] = useState(0)
  const [feedbackCategory, setFeedbackCategory] = useState<string | undefined>(undefined)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 宣教
  const [expandedEdu, setExpandedEdu] = useState<string | null>(null)

  // [W2-B] 临床数据 (列表 + 详情 Drawer)
  const [clinicalData, setClinicalData] = useState<PortalClinicalDataDto[]>([])
  const [clinicalDetail, setClinicalDetail] = useState<PortalClinicalDataDto | null>(null)
  const [clinicalDrawerOpen, setClinicalDrawerOpen] = useState(false)
  const [clinicalDetailLoading, setClinicalDetailLoading] = useState(false)

  // [W2-B] 医护联系方式
  const [doctorContacts, setDoctorContacts] = useState<PortalMobileUserDto[]>([])
  const [nurseContacts, setNurseContacts] = useState<PortalMobileUserDto[]>([])
  const [techContacts, setTechContacts] = useState<PortalMobileUserDto[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)

  // [v3.0.6.11-96 Wave3B G-30 P2] 随访管理: followupApi (list/create/complete 真实), 失败回退演示 + 标注
  const [followups, setFollowups] = useState<FollowUpPlan[]>([])
  const [followupSource, setFollowupSource] = useState<'api' | 'fallback'>('api')
  const [followupLoading, setFollowupLoading] = useState(false)
  const [followupForm, setFollowupForm] = useState<{ date: string; type: string; note: string }>({
    date: fmtDate(new Date(new Date().getTime() + 7 * 86400000)),
    type: '复查',
    note: '',
  })
  const [followupCreating, setFollowupCreating] = useState(false)
  const [followupCompletingId, setFollowupCompletingId] = useState<string | null>(null)

  const openClinicalDetail = async (id: string) => {
    setClinicalDrawerOpen(true)
    setClinicalDetailLoading(true)
    try {
      const res = await patientPortalApi.getClinicalData(id)
      if (res.success) {
        const item = Array.isArray(res.data) ? res.data[0] : res.data
        setClinicalDetail(item ?? null)
      } else {
        message.error(res.error?.message ?? t('selfService.clinicalDrawer.loadFailed'))
      }
    } catch {
      message.error(t('selfService.clinicalDrawer.loadRetry'))
    } finally {
      setClinicalDetailLoading(false)
    }
  }

  const openContacts = async () => {
    setContactsLoading(true)
    try {
      const [docRes, nurseRes, techRes] = await Promise.all([
        patientPortalApi.getDoctorMobile(),
        patientPortalApi.getNurseMobile(),
        patientPortalApi.getTechMobile(),
      ])
      if (docRes.success && Array.isArray(docRes.data)) setDoctorContacts(docRes.data)
      if (nurseRes.success && Array.isArray(nurseRes.data)) setNurseContacts(nurseRes.data)
      if (techRes.success && Array.isArray(techRes.data)) setTechContacts(techRes.data)
    } catch {
      message.error(t('selfService.contacts.loadFailed'))
    } finally {
      setContactsLoading(false)
    }
  }

  const downloadReportText = (report: PortalReportDto) => {
    const lines = [
      '========== 影像检查报告 ==========',
      `检查项目：${report.modality ?? '-'}（${report.bodyPart ?? '未指定部位'}）`,
      `检查日期：${fmtDateTime(report.examDate)}`,
      `报告状态：${REPORT_STATE_LABEL[report.state] ?? report.state}`,
      `签发时间：${fmtDateTime(report.signedAt)}`,
      '',
      '【检查所见】',
      report.findings || '-',
      '',
      '【诊断意见】',
      report.diagnosis || '-',
      '',
      '【影像印象】',
      report.impression || '-',
      '',
      '【结论】',
      report.conclusion || '-',
      '',
      '【建议】',
      report.recommendations || '-',
      '',
      '电子报告与纸质报告具有同等法律效力。',
    ].join('\n')
    const blob = new Blob(['\ufeff' + lines], { type: 'text/plain;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `报告_${report.id}.txt`
    link.click()
    URL.revokeObjectURL(link.href)
    message.success(t('selfService.reports.downloaded'))
  }

  const downloadExamReport = async (examId: string) => {
    try {
      const res = await patientPortalApi.getExamReport(examId)
      if (res.success && res.data) {
        const report = res.data
        const lines = [
          '========== 历史检查报告 ==========',
          `检查项目：${report.modality ?? '影像检查'}（${report.bodyPart ?? '未指定部位'}）`,
          `检查日期：${report.examDate ? fmtDateTime(report.examDate) : '-'} · 状态：${REPORT_STATE_LABEL[report.state] ?? report.state}`,
          '',
          '【检查所见】',
          report.findings ?? '-',
          '',
          '【诊断意见】',
          report.diagnosis ?? '-',
          '',
          '【影像印象】',
          report.impression ?? '-',
          '',
          '【结论】',
          report.conclusion ?? '-',
          '',
          '【建议】',
          report.recommendations ?? '-',
        ].join('\n')
        const blob = new Blob(['\ufeff' + lines], { type: 'text/plain;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `检查报告_${report.id}.txt`
        link.click()
        URL.revokeObjectURL(link.href)
        message.success(t('selfService.reports.downloaded'))
      } else {
        message.error(res.error?.message ?? t('selfService.reports.downloadFailed'))
      }
    } catch {
      message.error(t('selfService.reports.downloadRetry'))
    }
  }

  const handleLogin = async () => {
    const keyword = loginId.trim()
    if (!keyword) {
      message.warning(t('selfService.login.inputRequired'))
      return
    }
    setLoginLoading(true)
    setLoginError(null)
    try {
      const res = await patientPortalApi.listPatients()
      const list = res.success && Array.isArray(res.data) ? res.data : []
      const match = list.find(p =>
        (p.phone && p.phone.includes(keyword)) ||
        (p.idNumber && p.idNumber.includes(keyword)) ||
        (p.id && p.id.includes(keyword)),
      )
      if (match) {
        setUser(match)
        setLoggedIn(true)
      } else {
        setLoginError(t('selfService.login.notFound'))
      }
    } catch {
      setLoginError(t('selfService.login.serviceUnavailable'))
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = () => {
    setLoggedIn(false)
    setUser(null)
    setExams([])
    setAppointments([])
    setReports([])
    setEducations([])
    setSelectedExam(null)
    setImages([])
    setStudy(null)
    setVoucherCode(null)
    setBooking({})
    setBookingDone(null)
    setExpandedReport(null)
    setActiveTab('home')
    setClinicalData([])
    setClinicalDetail(null)
    setClinicalDrawerOpen(false)
    setDoctorContacts([])
    setNurseContacts([])
    setTechContacts([])
    setFollowups([])
  }

  useEffect(() => {
    if (!loggedIn) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const [userRes, examsRes, apptRes, reportRes, eduRes, clinicalRes] = await Promise.all([
          patientPortalApi.getPortalUser(user?.id || 'current'),
          patientPortalApi.listExamHistory(user?.id || 'current'),
          patientPortalApi.listAppointments(user?.id || 'current'),
          patientPortalApi.listReports(user?.id || 'current'),
          patientPortalApi.listEducation(),
          patientPortalApi.listClinicalData(),
        ])
        if (cancelled) return
        if (userRes.success && userRes.data) setUser(userRes.data)
        if (examsRes.success && Array.isArray(examsRes.data)) setExams(examsRes.data)
        if (apptRes.success && apptRes.data && Array.isArray(apptRes.data)) setAppointments(apptRes.data)
        if (reportRes.success && reportRes.data && Array.isArray(reportRes.data)) setReports(reportRes.data)
        if (eduRes.success && Array.isArray(eduRes.data)) setEducations(eduRes.data)
        if (clinicalRes.success && Array.isArray(clinicalRes.data)) setClinicalData(clinicalRes.data)
        if (!userRes.success && !examsRes.success) setLoadError(t('selfService.clinicalDrawer.loadRetry'))
      } catch {
        setLoadError(t('selfService.clinicalDrawer.loadRetry'))
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn])

  // [v3.0.6.11-96 Wave3B G-30 P2] 加载当前患者随访计划
  // [v3.0.6.11-99 Wave7B] 移动 H5: 优先 patient-portal 随访端点, 失败回退 followupApi → 演示数据 + 标注
  useEffect(() => {
    if (!loggedIn || !user?.id) return
    let cancelled = false
    void (async () => {
      setFollowupLoading(true)
      try {
        const portalRes = await patientPortalApi.listFollowups(user.id)
        if (cancelled) return
        if (portalRes.success && Array.isArray(portalRes.data) && portalRes.data.length > 0) {
          setFollowups(portalRes.data as unknown as FollowUpPlan[])
          setFollowupSource('api')
        } else {
          const res = await followupApi.list({ patientId: user.id })
          if (cancelled) return
          const items = res.success ? ((res.data as any)?.items ?? []) : []
          if (res.success && items.length > 0) {
            setFollowups(items)
            setFollowupSource('api')
          } else {
            setFollowups(MOCK_FOLLOWUPS.map((f, i) => ({ ...f, id: `FU-DEMO-${i + 1}`, createdAt: '', updatedAt: '' })) as FollowUpPlan[])
            setFollowupSource('fallback')
          }
        }
      } catch {
        if (cancelled) return
        setFollowups(MOCK_FOLLOWUPS.map((f, i) => ({ ...f, id: `FU-DEMO-${i + 1}`, createdAt: '', updatedAt: '' })) as FollowUpPlan[])
        setFollowupSource('fallback')
      } finally {
        if (!cancelled) setFollowupLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn])

  // [v3.0.6.11-96 Wave3B G-30 P2] 自助预约随访 (followupApi.create), 失败回退本地新增 + 标注
  const submitFollowup = async () => {
    if (!user) return
    if (!followupForm.date) {
      message.warning(t('selfService.followup.dateRequired'))
      return
    }
    setFollowupCreating(true)
    try {
      const res = await followupApi.create({
        patientId: user.id,
        patientName: user.name ?? '',
        planDate: `${followupForm.date}T00:00:00+08:00`,
        intervalDays: FOLLOWUP_TYPES.find(t => t.value === followupForm.type)?.intervalDays ?? 30,
        note: followupForm.note || `${followupForm.type}随访`,
        reminderEnabled: true,
      })
      if (res.success && res.data) {
        setFollowups(prev => [res.data as FollowUpPlan, ...prev])
        setFollowupSource('api')
        message.success(t('selfService.followup.bookSuccess'))
        setFollowupForm({ ...followupForm, note: '' })
      } else {
        message.error(res.error?.message ?? t('selfService.booking.bookFailed'))
      }
    } catch {
      // 失败回退: 本地新增并标注
      const local: FollowUpPlan = {
        id: `FU-LOCAL-${Date.now()}`,
        patientId: user.id,
        patientName: user.name ?? '',
        planDate: `${followupForm.date}T00:00:00+08:00`,
        intervalDays: FOLLOWUP_TYPES.find(t => t.value === followupForm.type)?.intervalDays ?? 30,
        nextDate: '',
        status: 'PENDING',
        note: followupForm.note || `${followupForm.type}随访`,
        reminderEnabled: true,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setFollowups(prev => [local, ...prev])
      if (followupSource !== 'fallback') setFollowupSource('fallback')
      message.warning(t('selfService.followup.serviceUnavailable'))
    } finally {
      setFollowupCreating(false)
    }
  }

  // [v3.0.6.11-96 Wave3B G-30 P2] 完成登记
  // [v3.0.6.11-99 Wave7B] 移动 H5: 优先 patient-portal 完成端点, 失败回退 followupApi → 本地标注
  const completeFollowup = async (plan: FollowUpPlan) => {
    setFollowupCompletingId(plan.id)
    try {
      let res = await patientPortalApi.completeFollowup(plan.id)
      if (!res.success || !res.data) res = await followupApi.complete(plan.id) as unknown as typeof res
      if (res.success && res.data) {
        const data = (res.data as { data?: FollowUpPlan } | null)?.data ?? res.data
        setFollowups(prev => prev.map(p => p.id === plan.id ? data as FollowUpPlan : p))
        setFollowupSource('api')
        message.success(t('selfService.followup.completeSuccess'))
      } else {
        message.error(res.error?.message ?? t('selfService.followup.completeFailed'))
      }
    } catch {
      setFollowups(prev => prev.map(p => p.id === plan.id ? { ...p, status: 'COMPLETED', completedAt: new Date().toISOString(), note: `${p.note}（本地完成登记，同步失败待重试）` } as FollowUpPlan : p))
      message.warning(t('selfService.followup.completeLocal'))
    } finally {
      setFollowupCompletingId(null)
    }
  }

  useEffect(() => {
    if (!selectedExam) {
      setImages([])
      setStudy(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        // [G005 W1-C] exam-history/:id/images 后端无此端点, 统一走 /patient-portal/images/:studyUid,
        // 电子胶片预览由 study.series 派生
        const studyRes = await patientPortalApi.listImages(selectedExam.id)
        if (cancelled) return
        if (studyRes.success && studyRes.data) {
          setStudy(studyRes.data)
          setImages((studyRes.data.series ?? []).map((s, i) => ({
            id: s.seriesInstanceUid || `series-${i}`,
            label: `序列 ${s.seriesNumber ?? i + 1}（${s.modality ?? 'OT'}）· ${s.instanceCount ?? 0} 帧`,
            windowWidth: 1200,
            windowCenter: 40,
            invert: false,
          })))
        }
      } catch { /* keep empty images */ }
    })()
    return () => { cancelled = true }
  }, [selectedExam])

  // ===== 预约流程 =====
  const modalityParts = MODALITIES.find(m => m.value === booking.modality)?.parts ?? []

  const submitBooking = async () => {
    if (!booking.modality || !booking.bodyPart || !booking.date || !booking.slot) {
      message.warning(t('selfService.booking.fillAll'))
      return
    }
    if (!user) return
    setBookingLoading(true)
    setBookingDone(null)
    try {
      const res = await patientPortalApi.createAppointment({
        patientId: user.id,
        modality: booking.modality,
        bodyPart: booking.bodyPart,
        scheduledAt: `${booking.date}T${booking.slot}:00+08:00`,
      })
      if (res.success && res.data) {
        message.success(t('selfService.booking.booked'))
        setBookingDone(res.data)
        setAppointments(prev => [res.data!, ...prev])
        setBooking({})
      } else {
        message.error(res.error?.message ?? t('selfService.booking.bookFailed'))
      }
    } catch {
      message.error(t('selfService.booking.serviceUnavailable'))
    } finally {
      setBookingLoading(false)
    }
  }

  // ===== 报告 / 影像 =====
  const selectedReport = reports.find(r => r.id === expandedReport) ?? null

  const openViewer = (exam: ExamHistoryItemDto) => {
    window.open(`/dicom-viewer?studyUid=${encodeURIComponent(exam.id)}`, '_blank')
  }

  const generateVoucher = async () => {
    if (!user) return
    // [G005 W1-C] 后端无 /patient-portal/voucher 端点, 凭证改为本地生成(标注: 待后端实现)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 16; i++) code += chars[Math.floor(Math.random() * chars.length)]
    setVoucherCode(code)
    message.info('凭证由客户端演示生成（后端 voucher 端点待实现）')
  }

  const handleWindowChange = (id: string, type: 'width' | 'center', value: number) => {
    setImages(prev => prev.map(img =>
      img.id === id
        ? { ...img, [type === 'width' ? 'windowWidth' : 'windowCenter']: value }
        : img,
    ))
  }

  const handleInvertToggle = (id: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, invert: !img.invert } : img))
  }

  const getImageFilter = (img: ImagePreviewDto) => {
    const brightness = img.windowCenter / 40
    const contrast = img.windowWidth / 400
    return `brightness(${brightness}) contrast(${contrast})${img.invert ? ' invert(1)' : ''}`
  }

  const submitFeedback = async () => {
    if (!rating || rating < 1) {
      message.warning(t('selfService.feedback.ratingRequired'))
      return
    }
    setSubmitting(true)
    try {
      const res = await patientPortalApi.submitFeedback({
        patientId: user?.id,
        patientName: user?.name,
        rating,
        category: feedbackCategory,
        comment: feedbackComment,
      })
      if (res.success && res.data) {
        message.success(t('selfService.feedback.thanks'))
        setRating(0)
        setFeedbackCategory(undefined)
        setFeedbackComment('')
      } else {
        message.error(res.error?.message ?? t('selfService.feedback.submitFailed'))
      }
    } catch {
      message.error(t('selfService.feedback.serviceUnavailable'))
    } finally {
      setSubmitting(false)
    }
  }

  // ===== 首页待办 =====
  const upcomingAppointments = appointments
    .filter(a => a.state !== 'CANCELLED' && a.state !== 'NO_SHOW' && new Date(a.scheduledAt).getTime() >= Date.now())
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  const latestReport = [...reports].sort((a, b) =>
    String(b.signedAt ?? b.examDate ?? '').localeCompare(String(a.signedAt ?? a.examDate ?? '')),
  )[0]
  const viewableExams = exams.filter(e => e.hasImages)

  if (!loggedIn) {
    return (
      <div style={styles.container}>
        <Card bordered={false} style={{ ...styles.card, maxWidth: 400, margin: '80px auto', textAlign: 'center' }} styles={{ body: { padding: 0 } }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{t('selfService.login.title')}</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>{t('selfService.login.hint')}</p>
          <input
            placeholder={t('selfService.login.placeholder')}
            value={loginId}
            onChange={e => setLoginId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loginLoading && void handleLogin()}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' as const }}
          />
          <button style={{ ...styles.btn, width: '100%', padding: '12px', fontSize: 15 }} onClick={() => void handleLogin()} disabled={loginLoading}>
            {loginLoading ? t('selfService.login.searching') : t('selfService.login.search')}
          </button>
          {loginError && <Alert type="error" showIcon message={loginError} style={{ marginTop: 16, textAlign: 'left' }} />}
          <div style={{ marginTop: 16, fontSize: 12, color: '#94a3b8' }}>{t('selfService.login.demo')}</div>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ padding: 80, textAlign: 'center' }}>
          <Spin size="large" tip={t('selfService.loading')}>
            <div style={{ height: 60 }} />
          </Spin>
        </div>
      </div>
    )
  }

  const tabItems = [
    {
      key: 'home',
      label: t('selfService.tab.home'),
      children: (
        <div>
          <div style={styles.statRow}>
            <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
              <Statistic title={t('selfService.home.examRecords')} value={exams.length} suffix={t('selfService.home.examRecordsSuffix')} />
            </Card>
            <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
              <Statistic title={t('selfService.home.pendingAppointments')} value={upcomingAppointments.length} suffix={t('selfService.home.pendingAppointmentsSuffix')} />
            </Card>
            <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
              <Statistic title={t('selfService.home.reports')} value={reports.length} suffix={t('selfService.home.reportsSuffix')} />
            </Card>
          </div>
          <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
            <h3 style={styles.subTitle}>{t('selfService.home.todayTodo')}</h3>
            {upcomingAppointments.length === 0 && reports.length === 0 ? (
              <Empty description={t('selfService.home.noTodo')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div>
                {upcomingAppointments.slice(0, 3).map(a => (
                  <div key={a.id} style={styles.todoItem}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {a.modality} · {a.bodyPart ?? '未指定部位'}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{fmtDateTime(a.scheduledAt)} 检查</div>
                    </div>
                    <Tag color="processing">{t('selfService.home.appointmentReminder')}</Tag>
                  </div>
                ))}
                {reports.length > 0 && (
                  <div style={styles.todoItem}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {latestReport?.modality ?? ''} · {latestReport?.bodyPart ?? '影像'} 报告已发布
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{t('selfService.home.signedTime')} {fmtDateTime(latestReport?.signedAt)}</div>
                    </div>
                    <div>
                      <Tag color="success">{t('selfService.home.reportNotice')}</Tag>
                      <button style={{ ...styles.btn, marginLeft: 8 }} onClick={() => { setActiveTab('reports') }}>{t('selfService.home.viewReport')}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
          {upcomingAppointments.length > 0 && (
            <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
              <h3 style={styles.subTitle}>{t('selfService.home.recentAppointments')}</h3>
              {upcomingAppointments.slice(0, 3).map(a => (
                <div key={a.id} style={styles.todoItem}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.modality} · {a.bodyPart ?? '-'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{fmtDateTime(a.scheduledAt)}</span>
                    <Tag color={stateColor(a.state)}>{APPOINTMENT_STATE_LABEL[a.state] ?? a.state}</Tag>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'booking',
      label: t('selfService.tab.booking'),
      children: (
        <div>
          {bookingDone && (
            <Card bordered={false} style={{ ...styles.card, border: '1px solid var(--color-success-border)', background: 'var(--color-success-bg)' }} styles={{ body: { padding: 0 } }}>
              <h3 style={{ ...styles.subTitle, color: 'var(--color-success)' }}>{t('selfService.booking.success')}</h3>
              <div style={styles.grid2}>
                <div><div style={styles.label}>{t('selfService.booking.examType')}</div><div style={styles.value}>{bookingDone.modality}（{bookingDone.bodyPart ?? '未指定部位'}）</div></div>
                <div><div style={styles.label}>{t('selfService.booking.appointmentTime')}</div><div style={styles.value}>{fmtDateTime(bookingDone.scheduledAt)}</div></div>
                <div><div style={styles.label}>{t('selfService.booking.appointmentId')}</div><div style={styles.value}>{bookingDone.id}</div></div>
                <div><div style={styles.label}>{t('selfService.booking.status')}</div><div style={styles.value}>{APPOINTMENT_STATE_LABEL[bookingDone.state] ?? bookingDone.state}</div></div>
              </div>
              <p style={{ fontSize: 12, color: '#059669', marginTop: 12 }}>请按预约时间提前 15 分钟到放射科登记台报到，检查当天请携带本人有效证件。</p>
            </Card>
          )}
          <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
            <h3 style={styles.subTitle}>{t('selfService.booking.selectType')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {MODALITIES.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setBooking({ ...booking, modality: m.value, bodyPart: undefined })}
                  style={{
                    padding: '16px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 13,
                    border: booking.modality === m.value ? '2px solid #1e40af' : '1px solid var(--border-color)',
                    background: booking.modality === m.value ? 'var(--color-info-bg)' : 'var(--bg-card)',
                    color: booking.modality === m.value ? '#1e40af' : '#475569',
                    fontWeight: booking.modality === m.value ? 700 : 500,
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{m.value}</div>
                  <div style={{ fontSize: 11, marginTop: 4, color: '#94a3b8' }}>{m.label}</div>
                </button>
              ))}
            </div>
          </Card>
          {booking.modality && (
            <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
              <h3 style={styles.subTitle}>{t('selfService.booking.selectPart')}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {modalityParts.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setBooking({ ...booking, bodyPart: p })}
                    style={{
                      padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                      border: booking.bodyPart === p ? '2px solid #0d9488' : '1px solid var(--border-color)',
                      background: booking.bodyPart === p ? 'rgba(13,148,136,0.12)' : 'var(--bg-card)',
                      color: booking.bodyPart === p ? '#0f766e' : '#475569',
                      fontWeight: booking.bodyPart === p ? 700 : 500,
                    }}
                  >{p}</button>
                ))}
              </div>
            </Card>
          )}
          {booking.modality && (
            <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
              <h3 style={styles.subTitle}>{t('selfService.booking.selectDate')}</h3>
              <MiniCalendar
                month={calendarMonth}
                selected={booking.date}
                onSelect={d => setBooking({ ...booking, date: d })}
                onMonthChange={setCalendarMonth}
              />
            </Card>
          )}
          {booking.modality && booking.date && (
            <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
              <h3 style={styles.subTitle}>{t('selfService.booking.selectSlot')} — {booking.date}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {TIME_SLOTS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setBooking({ ...booking, slot: s })}
                    style={{
                      padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                      border: booking.slot === s ? '2px solid #1e40af' : '1px solid var(--border-color)',
                      background: booking.slot === s ? 'var(--color-info-bg)' : 'var(--bg-card)',
                      color: booking.slot === s ? '#1e40af' : '#475569',
                      fontWeight: booking.slot === s ? 700 : 500,
                    }}
                  >{s}</button>
                ))}
              </div>
            </Card>
          )}
          {booking.modality && booking.bodyPart && booking.date && booking.slot && (
            <Card bordered={false} style={{ ...styles.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} styles={{ body: { padding: 0 } }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {booking.modality} · {booking.bodyPart} · {booking.date} {booking.slot}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{t('selfService.booking.confirmHint')}</div>
              </div>
              <button style={{ ...styles.btn, padding: '12px 28px', fontSize: 14 }} onClick={() => void submitBooking()} disabled={bookingLoading}>
                {bookingLoading ? t('selfService.booking.submitting') : t('selfService.booking.confirm')}
              </button>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'reports',
      label: t('selfService.tab.reports'),
      children: (
        <div>
          <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
            <h3 style={styles.subTitle}>{t('selfService.reports.title')}（{reports.length}）</h3>
            {reports.length === 0 ? (
              <Empty description={t('selfService.reports.noReports')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <table style={styles.table}>
                <thead><tr>
                  <th style={styles.th}>{t('selfService.reports.col.examItem')}</th><th style={styles.th}>{t('selfService.reports.col.bodyPart')}</th><th style={styles.th}>{t('selfService.reports.col.examDate')}</th>
                  <th style={styles.th}>{t('selfService.reports.col.status')}</th><th style={styles.th}>{t('selfService.reports.col.signedAt')}</th><th style={styles.th}>{t('selfService.reports.col.actions')}</th>
                </tr></thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id}>
                      <td style={styles.td}>{r.modality ?? '-'}</td>
                      <td style={styles.td}>{r.bodyPart ?? '-'}</td>
                      <td style={styles.td}>{fmtDateTime(r.examDate)}</td>
                      <td style={styles.td}><span style={styles.badge(REPORT_STATE_LABEL[r.state] ?? r.state)}>{REPORT_STATE_LABEL[r.state] ?? r.state}</span></td>
                      <td style={styles.td}>{fmtDateTime(r.signedAt)}</td>
                      <td style={styles.td}>
                        <button style={{ ...styles.btn, background: '#0d9488' }} onClick={() => setExpandedReport(expandedReport === r.id ? null : r.id)}>
                          {expandedReport === r.id ? t('selfService.reports.collapse') : t('selfService.reports.viewReport')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          {selectedReport && (
            <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
              <h3 style={{ ...styles.subTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>报告详情 — {selectedReport.modality ?? '影像'}（{selectedReport.bodyPart ?? '未指定'}）</span>
                {selectedReport.isCritical && <Tag color="error">危急值</Tag>}
              </h3>
              <Descriptions
                column={1}
                size="small"
                bordered
                items={[
                  { key: 'state', label: '报告状态', children: <Tag color={stateColor(selectedReport.state)}>{REPORT_STATE_LABEL[selectedReport.state] ?? selectedReport.state}</Tag> },
                  { key: 'examDate', label: '检查日期', children: fmtDateTime(selectedReport.examDate) },
                  { key: 'signedAt', label: '报告签发时间', children: fmtDateTime(selectedReport.signedAt) },
                  { key: 'findings', label: '检查所见', children: selectedReport.findings || '-' },
                  { key: 'diagnosis', label: '诊断意见', children: selectedReport.diagnosis || '-' },
                  { key: 'impression', label: '影像印象', children: selectedReport.impression || '-' },
                  { key: 'recommendations', label: '建议', children: selectedReport.recommendations || '-' },
                  { key: 'conclusion', label: '结论', children: selectedReport.conclusion || '-' },
                ]}
              />
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button style={{ ...styles.btn, background: '#059669', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => downloadReportText(selectedReport)}>
                  <Download size={13} />
                  下载报告
                </button>
                <button style={{ ...styles.btnGreen, background: '#1e40af', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => window.print()}>
                  <Printer size={13} />
                  打印报告
                </button>
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 16 }}>
                电子报告与纸质报告具有同等法律效力；如有疑问请携带报告咨询临床医生。
              </p>
            </Card>
          )}
          {!selectedReport && exams.filter(e => e.reportContent).length > 0 && (
            <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
              <h3 style={styles.subTitle}>{t('selfService.reports.historyTitle')}</h3>
              {exams.filter(e => e.reportContent).map(exam => (
                <div key={exam.id} style={styles.todoItem}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{exam.examItem}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{exam.examDate} · {exam.bodyPart}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ ...styles.btnGreen }} onClick={() => setExpandedReport(expandedReport === exam.id ? null : exam.id)}>
                      {expandedReport === exam.id ? t('selfService.reports.collapse') : t('selfService.reports.view')}
                    </button>
                    <button style={{ ...styles.btnGreen, background: '#059669' }} onClick={() => void downloadExamReport(exam.id)}>
                      下载
                    </button>
                  </div>
                </div>
              ))}
              {expandedReport && (() => {
                const exam = exams.find(e => e.id === expandedReport)
                if (!exam?.reportContent) return null
                return (
                  <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                    {exam.reportContent}
                    {exam.diagnosis && <div style={{ marginTop: 12 }}><div style={styles.label}>{t('selfService.reports.diagnosisLabel')}</div><div style={styles.value}>{exam.diagnosis}</div></div>}
                    {exam.recommendations && <div style={{ marginTop: 8 }}><div style={styles.label}>{t('selfService.reports.recommendationsLabel')}</div><div style={styles.value}>{exam.recommendations}</div></div>}
                  </div>
                )
              })()}
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'images',
      label: t('selfService.tab.images'),
      children: (
        <div>
          <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
            <h3 style={styles.subTitle}>{t('selfService.images.viewableTitle')}</h3>
            {viewableExams.length === 0 ? (
              <Empty description={t('selfService.images.noImages')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <table style={styles.table}>
                <thead><tr>
                  <th style={styles.th}>{t('selfService.reports.col.examItem')}</th><th style={styles.th}>日期</th><th style={styles.th}>{t('selfService.reports.col.bodyPart')}</th>
                  <th style={styles.th}>{t('selfService.reports.col.status')}</th><th style={styles.th}>{t('selfService.reports.col.actions')}</th>
                </tr></thead>
                <tbody>
                  {viewableExams.map(exam => (
                    <tr key={exam.id}>
                      <td style={styles.td}>{exam.examItem}</td>
                      <td style={styles.td}>{exam.examDate}</td>
                      <td style={styles.td}>{exam.bodyPart}</td>
                      <td style={styles.td}><span style={styles.badge(exam.reportStatus)}>{exam.reportStatus}</span></td>
                      <td style={styles.td}>
                        <button style={styles.btn} onClick={() => setSelectedExam(selectedExam?.id === exam.id ? null : exam)}>
                          {selectedExam?.id === exam.id ? t('selfService.images.collapse') : t('selfService.images.viewImage')}
                        </button>
                        <button style={{ ...styles.btnGreen, marginLeft: 8 }} onClick={() => openViewer(exam)}>{t('selfService.images.openViewer')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          {selectedExam && (
            <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
              <h3 style={styles.subTitle}>{t('selfService.images.electronicFilm')} — {selectedExam.examItem}</h3>
              {study && study.series.length > 0 && (
                <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                    DICOM 检查号：{study.studyInstanceUid} · WADO-RS：<code style={{ fontSize: 11 }}>{study.wadoRs.study}</code>
                  </div>
                  {study.series.map(s => (
                    <div key={s.seriesInstanceUid} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      序列 {s.seriesNumber ?? '-'}（{s.modality}）：{s.instanceCount} 帧
                      <span style={{ color: '#94a3b8', marginLeft: 8 }}>{s.wadoRs.instances}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={styles.imageGrid}>
                {images.map(img => (
                  <div key={img.id} style={styles.imageCard}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{img.label}</div>
                    <div style={{ ...styles.imagePlaceholder, filter: getImageFilter(img), background: '#1e293b' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 1, padding: 8, width: '100%', height: '100%', boxSizing: 'border-box' as const }}>
                        {Array.from({ length: 64 }).map((_, i) => (
                          <div key={i} style={{ background: `hsl(200,10%,${20 + Math.random() * 20}%)`, borderRadius: 1 }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div><label style={styles.label}>窗宽</label><input type="range" min={100} max={2000} value={img.windowWidth} onChange={e => handleWindowChange(img.id, 'width', +e.target.value)} style={styles.slider} /></div>
                      <div><label style={styles.label}>窗位</label><input type="range" min={-100} max={500} value={img.windowCenter} onChange={e => handleWindowChange(img.id, 'center', +e.target.value)} style={styles.slider} /></div>
                      <button onClick={() => handleInvertToggle(img.id)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-color)', fontSize: 12, cursor: 'pointer', background: img.invert ? '#3b82f6' : 'var(--bg-card)', color: img.invert ? '#fff' : '#64748b' }}>
                        {img.invert ? t('selfService.images.cancelInvert') : t('selfService.images.invert')}
                      </button>
                      <button style={{ ...styles.btnGreen, marginLeft: 8 }} onClick={() => openViewer(selectedExam)}>{t('selfService.images.fullView')}</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card bordered={false} style={{ ...styles.card, textAlign: 'center' }} styles={{ body: { padding: 0 } }}>
            <h3 style={{ ...styles.subTitle, textAlign: 'left' }}>{t('selfService.voucher.title')}</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{t('selfService.voucher.hint')}</p>
            {!voucherCode ? (
              <button style={styles.voucherBtn} onClick={generateVoucher}>{t('selfService.voucher.generate')}</button>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>{t('selfService.voucher.yourVoucher')}：</div>
                <div style={styles.voucherCode}>{voucherCode}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>{t('selfService.voucher.validity')}</div>
              </div>
            )}
          </Card>
        </div>
      ),
    },
    {
      key: 'education',
      label: t('selfService.tab.education'),
      children: (
        <div>
          <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
            <h3 style={styles.subTitle}>{t('selfService.education.title')}（{educations.length}）</h3>
            {educations.length === 0 ? (
              <Empty description={t('selfService.education.noData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              educations.map((edu, idx) => {
                const id = edu.id ?? edu.key ?? `edu-${idx}`
                const title = edu.title ?? edu.label ?? `宣教资料 ${idx + 1}`
                const body = edu.content ?? (typeof edu.value === 'string' ? edu.value : '')
                const summary = edu.summary
                const contentType = edu.contentType
                const isOpen = expandedEdu === id
                return (
                  <div key={id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {title}
                          {contentType === 'video' && <Tag color="blue">{t('selfService.education.video')}</Tag>}
                          {contentType === 'audio' && <Tag color="purple">{t('selfService.education.audio')}</Tag>}
                          {contentType === 'text' && <Tag>图文</Tag>}
                          {edu.category === 'pre_exam' && <Tag color="orange">检查前</Tag>}
                          {edu.category === 'post_exam' && <Tag color="cyan">检查后</Tag>}
                        </div>
                        {summary && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{summary}</div>}
                      </div>
                      {body && (
                        <button style={{ ...styles.btn, background: '#475569' }} onClick={() => setExpandedEdu(isOpen ? null : id)}>
                          {isOpen ? t('selfService.education.collapse') : t('selfService.education.viewDetail')}
                        </button>
                      )}
                    </div>
                    {isOpen && body && (
                      <div style={{ marginTop: 12, padding: 16, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                        {body}
                        {edu.duration && <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>预计阅读时长：约 {edu.duration} 秒</div>}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </Card>
        </div>
      ),
    },
    {
      key: 'clinical',
      label: t('selfService.tab.clinical'),
      children: (
        <div>
          <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
            <h3 style={styles.subTitle}>{t('selfService.clinical.title')}（{clinicalData.length}）</h3>
            {clinicalData.length === 0 ? (
              <Empty description={t('selfService.clinical.noData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <table style={styles.table}>
                <thead><tr>
                  <th style={styles.th}>{t('selfService.reports.col.examItem')}</th><th style={styles.th}>{t('selfService.reports.col.bodyPart')}</th><th style={styles.th}>日期</th>
                  <th style={styles.th}>{t('selfService.reports.col.status')}</th><th style={styles.th}>{t('selfService.reports.col.actions')}</th>
                </tr></thead>
                <tbody>
                  {clinicalData.map(d => (
                    <tr key={d.id}>
                      <td style={styles.td}>{d.examType ?? '-'}</td>
                      <td style={styles.td}>{d.bodyPart ?? '-'}</td>
                      <td style={styles.td}>{d.examDate ?? '-'}</td>
                      <td style={styles.td}><span style={styles.badge(d.reportStatus ?? '')}>{d.reportStatus ?? '-'}</span></td>
                      <td style={styles.td}>
                        <button style={{ ...styles.btn, background: '#0d9488' }} onClick={() => void openClinicalDetail(d.id)}>
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      ),
    },
    {
      key: 'contacts',
      label: t('selfService.tab.contacts'),
      children: (
        <div>
          <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
            <h3 style={{ ...styles.subTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('selfService.contacts.title')}</span>
              <button style={{ ...styles.btn, background: '#475569' }} onClick={() => void openContacts()} disabled={contactsLoading}>
                {contactsLoading ? t('selfService.contacts.loading') : t('selfService.contacts.refresh')}
              </button>
            </h3>
            {contactsLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="small" tip={t('selfService.contacts.loadContacts')} />
              </div>
            ) : doctorContacts.length === 0 && nurseContacts.length === 0 && techContacts.length === 0 ? (
              <Empty description={t('selfService.contacts.emptyHint')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { title: t('selfService.contacts.doctor'), color: '#1e40af', users: doctorContacts },
                  { title: t('selfService.contacts.nurse'), color: '#0d9488', users: nurseContacts },
                  { title: t('selfService.contacts.tech'), color: '#7c3aed', users: techContacts },
                ].map(group => (
                  <div key={group.title} style={{ background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)', padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: group.color, marginBottom: 10 }}>{group.title}（{group.users.length}）</div>
                    {group.users.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('selfService.contacts.noContacts')}</div>
                    ) : (
                      group.users.map(u => (
                        <div key={u.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{u.title ?? u.role} · {u.department ?? '-'}</div>
                          <div style={{ fontSize: 12, color: '#0d9488', fontFamily: 'monospace' }}>{u.phone ?? '-'}</div>
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>联系电话仅供就医咨询使用，工作时间 08:00-17:00。</p>
          </Card>
        </div>
      ),
    },
    {
      key: 'followup',
      label: t('selfService.tab.followup'),
      children: (
        <div>
          <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
            <h3 style={{ ...styles.subTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('selfService.followup.title')}（{followups.length}）</span>
              {followupSource === 'api'
                ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-success-bg)', color: '#16a34a', border: '1px solid #bbf7d0' }}>followupApi 实时</span>
                : <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f59e0b22', color: '#b45309', border: '1px solid #fcd34d' }}>演示回退（followupApi 不可用）</span>}
            </h3>
            {followupLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin tip="加载随访计划..." /></div>
            ) : followups.length === 0 ? (
              <Empty description="暂无随访计划，可自助预约随访" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              // [v3.0.6.11-99 Wave7B] 移动卡片化: 响应式 grid (桌面 2 列 / 手机 1 列) + 提醒展示
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {followups.map(p => (
                  <div key={p.id} style={{ background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)', padding: 14, borderLeft: `4px solid ${p.status === 'COMPLETED' ? '#059669' : p.status === 'OVERDUE' ? '#dc2626' : p.status === 'IN_PROGRESS' ? '#0d9488' : '#d97706'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.note || '随访计划'}</div>
                      <Tag color={p.status === 'COMPLETED' ? 'success' : p.status === 'OVERDUE' ? 'error' : p.status === 'IN_PROGRESS' ? 'processing' : 'warning'}>
                        {FOLLOWUP_STATE_LABEL[p.status] ?? p.status}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span>计划 {p.planDate ? fmtDateTime(p.planDate) : '-'}</span>
                      <span>下次 {p.nextDate ? fmtDateTime(p.nextDate) : '-'}</span>
                      {p.intervalDays ? <span>每 {p.intervalDays} 天</span> : null}
                    </div>
                    {/* 提醒展示 */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      <Tag color={p.reminderEnabled ? 'green' : 'default'} style={{ margin: 0 }}>
                        {p.reminderEnabled ? '提醒已开启' : '未开启提醒'}
                      </Tag>
                      {p.status === 'OVERDUE' && <Tag color="error" style={{ margin: 0 }}>{t('selfService.followup.overdue')}</Tag>}
                      {p.status === 'COMPLETED' && p.completedAt && (
                        <Tag color="success" style={{ margin: 0 }}>完成于 {fmtDateTime(p.completedAt)}</Tag>
                      )}
                    </div>
                    {p.status !== 'COMPLETED' && (
                      <button
                        style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => void completeFollowup(p)}
                        disabled={followupCompletingId === p.id}
                      >
                        {followupCompletingId === p.id ? t('selfService.followup.registering') : t('selfService.followup.completeReg')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
            <h3 style={styles.subTitle}>{t('selfService.followup.bookTitle')}</h3>
            <div style={styles.grid2}>
              <div>
                <div style={styles.label}>{t('selfService.followup.dateLabel')}</div>
                <Input type="date" value={followupForm.date} onChange={e => setFollowupForm({ ...followupForm, date: e.target.value })} style={{ width: '100%' }} />
              </div>
              <div>
                <div style={styles.label}>{t('selfService.followup.typeLabel')}</div>
                <Select
                  value={followupForm.type}
                  onChange={v => setFollowupForm({ ...followupForm, type: v })}
                  style={{ width: '100%' }}
                  options={FOLLOWUP_TYPES.map(t => ({ value: t.value, label: `${t.label}（${t.intervalDays} 天）` }))}
                />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={styles.label}>{t('selfService.followup.noteLabel')}</div>
              <Input.TextArea rows={2} maxLength={200} showCount value={followupForm.note} onChange={e => setFollowupForm({ ...followupForm, note: e.target.value })} placeholder={t('selfService.followup.notePlaceholder')} />
            </div>
            <div style={{ marginTop: 16 }}>
              <button style={{ ...styles.btn, padding: '10px 28px', fontSize: 13 }} onClick={() => void submitFollowup()} disabled={followupCreating}>
                {followupCreating ? t('selfService.followup.submitting') : t('selfService.followup.submit')}
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>提交后将在预约日期到期时提醒，检查时请携带既往影像资料。</p>
          </Card>
        </div>
      ),
    },
    {
      key: 'feedback',
      label: t('selfService.tab.feedback'),
      children: (
        <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
          <h3 style={styles.subTitle}>{t('selfService.feedback.title')}</h3>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>您的评价将帮助我们持续改进服务品质，感谢您的参与。</p>
          <div style={{ marginBottom: 24 }}>
            <div style={styles.label}>{t('selfService.feedback.overallSatisfaction')}</div>
            <Rate
              value={rating}
              onChange={setRating}
              style={{ fontSize: 28 }}
            />
            {rating > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#1e40af' }}>
                {rating === 5 ? t('selfService.rating.verySatisfied') : rating === 4 ? t('selfService.rating.satisfied') : rating === 3 ? t('selfService.rating.average') : rating === 2 ? t('selfService.rating.dissatisfied') : t('selfService.rating.veryDissatisfied')}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 24, maxWidth: 360 }}>
            <div style={styles.label}>{t('selfService.feedback.category')}</div>
            <Select
              placeholder={t('selfService.feedback.selectCategory')}
              style={{ width: '100%' }}
              value={feedbackCategory}
              onChange={setFeedbackCategory}
              options={FEEDBACK_CATEGORIES.map(c => ({ value: c, label: c }))}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={styles.label}>{t('selfService.feedback.suggestion')}</div>
            <Input.TextArea
              rows={4}
              maxLength={500}
              showCount
              placeholder={t('selfService.feedback.placeholder')}
              value={feedbackComment}
              onChange={e => setFeedbackComment(e.target.value)}
            />
          </div>
          <button style={{ ...styles.btn, padding: '10px 32px', fontSize: 14 }} onClick={() => void submitFeedback()} disabled={submitting}>
            {submitting ? t('selfService.feedback.submitting') : t('selfService.feedback.submit')}
          </button>
        </Card>
      ),
    },
  ]

  return (
    <div style={styles.container}>
      {loadError && <Alert type="error" showIcon message={loadError} style={{ marginBottom: 16 }} />}
      {/* 患者身份卡 */}
      <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
        <div style={styles.header}>
          <h2 style={styles.title}>{t('selfService.login.title')}</h2>
          <button style={{ ...styles.btn, background: '#64748b' }} onClick={handleLogout}>{t('selfService.patientCard.logout')}</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#1e40af', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700,
          }}>
            {(user?.name ?? '患').slice(0, 1)}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name ?? '-'}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{t('selfService.patientCard.patientId')}：{user?.id ?? '-'}</div>
          </div>
        </div>
        <div style={styles.grid2}>
          <div><div style={styles.label}>{t('selfService.patientCard.genderAge')}</div><div style={styles.value}>{user?.gender ?? '-'} / {user?.age ?? '-'}岁</div></div>
          <div><div style={styles.label}>{t('selfService.patientCard.idNumber')}</div><div style={styles.value}>{user?.idNumber ?? '-'}</div></div>
          <div><div style={styles.label}>{t('selfService.patientCard.phone')}</div><div style={styles.value}>{user?.phone ?? '-'}</div></div>
          <div><div style={styles.label}>{t('selfService.patientCard.registerDate')}</div><div style={styles.value}>{user?.createdAt ? fmtDate(new Date(user.createdAt)) : '-'}</div></div>
        </div>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        tabBarStyle={{ marginBottom: 20 }}
      />

      {/* [W2-B] 临床数据详情 Drawer */}
      <Drawer
        title={clinicalDetail ? `临床数据详情 — ${clinicalDetail.examType ?? clinicalDetail.id}` : '临床数据详情'}
        open={clinicalDrawerOpen}
        onClose={() => setClinicalDrawerOpen(false)}
        width={520}
        loading={clinicalDetailLoading}
      >
        {clinicalDetail && (
          <div>
            <Descriptions
              column={1}
              size="small"
              bordered
              items={[
                { key: 'patient', label: '患者', children: `${clinicalDetail.patientName ?? '-'}（${clinicalDetail.patientId ?? '-'}）` },
                { key: 'examType', label: '检查项目', children: clinicalDetail.examType ?? '-' },
                { key: 'bodyPart', label: '部位', children: clinicalDetail.bodyPart ?? '-' },
                { key: 'modality', label: '设备类型', children: clinicalDetail.modality ?? '-' },
                { key: 'examDate', label: '检查日期', children: clinicalDetail.examDate ?? '-' },
                { key: 'status', label: '报告状态', children: <Tag color={stateColor(clinicalDetail.reportStatus ?? '')}>{clinicalDetail.reportStatus ?? '-'}</Tag> },
                { key: 'findings', label: '检查所见', children: clinicalDetail.findings || '-' },
                { key: 'diagnosis', label: '诊断意见', children: clinicalDetail.diagnosis || '-' },
              ]}
            />
            {(clinicalDetail as any).labValues && (
              <div style={{ marginTop: 16, padding: 12, background: 'var(--color-success-bg)', borderRadius: 8, border: '1px solid var(--color-success-border)' }}>
                <div style={styles.label}>{t('selfService.clinicalDrawer.labValues')}</div>
                <div style={{ ...styles.value, fontSize: 13, lineHeight: 1.7 }}>{(clinicalDetail as any).labValues}</div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
