import { useState, useEffect } from 'react'
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

// ===== Types =====
export type { PortalPatientDto as PatientPortalUser, ExamHistoryItemDto as ExamHistoryItem, ImagePreviewDto as ImagePreview }

// ===== Constants =====
const MODALITIES: Array<{ value: string; label: string; parts: string[] }> = [
  { value: 'CT', label: 'CT 计算机断层', parts: ['头部', '胸部', '腹部', '腰椎'] },
  { value: 'MR', label: 'MR 磁共振', parts: ['颅脑', '颈椎', '腰椎', '膝关节'] },
  { value: 'DR', label: 'DR 数字化X线', parts: ['胸部', '腰椎', '四肢', '腹部'] },
  { value: 'US', label: '超声', parts: ['腹部', '甲状腺', '乳腺', '心脏'] },
]

const TIME_SLOTS = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']

const FEEDBACK_CATEGORIES = ['就诊体验', '检查流程', '报告服务', '影像服务', '其他']

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
  card: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 },
  subTitle: { fontSize: 16, fontWeight: 600, color: '#1e293b', margin: 0, marginBottom: 16 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  label: { fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 },
  value: { fontSize: 14, color: '#1e293b' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#64748b', textAlign: 'left' as const, borderBottom: '2px solid #e2e8f0' },
  td: { padding: '10px 12px', fontSize: 13, color: '#334155', borderBottom: '1px solid #f1f5f9' },
  badge: (status: string) => ({
    padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    background: status === '已出报告' || status === '已发布' ? '#dcfce7' : status === '审核中' ? '#fef9c3' : '#f1f5f9',
    color: status === '已出报告' || status === '已发布' ? '#166534' : status === '审核中' ? '#854d0e' : '#64748b',
  }),
  btn: { padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#1e40af', color: '#fff' },
  btnGreen: { padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#0d9488', color: '#fff' },
  imageGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 },
  imageCard: { background: '#f8fafc', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0' },
  imagePlaceholder: { width: '100%', aspectRatio: '1', background: '#e2e8f0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12, marginBottom: 8 },
  slider: { width: '100%', margin: '4px 0' },
  voucherBtn: { padding: '12px 24px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#059669', color: '#fff' },
  voucherCode: { marginTop: 12, padding: 12, background: '#f0fdf4', borderRadius: 8, fontSize: 18, fontWeight: 700, color: '#059669', fontFamily: 'monospace', textAlign: 'center' as const, letterSpacing: 2 },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 },
  todoItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' },
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
  const weekdayHeaders = ['一', '二', '三', '四', '五', '六', '日']
  return (
    <div style={{ userSelect: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))}
          style={{ ...styles.btn, background: '#e2e8f0', color: '#475569' }}
        >上月</button>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{year}年{monthIndex + 1}月</div>
        <button
          type="button"
          onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))}
          style={{ ...styles.btn, background: '#e2e8f0', color: '#475569' }}
        >下月</button>
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
                border: isSelected ? '2px solid #1e40af' : isToday ? '2px solid #93c5fd' : '1px solid #e2e8f0',
                background: isSelected ? '#1e40af' : isToday ? '#eff6ff' : '#fff',
                color: isSelected ? '#fff' : disabled ? '#cbd5e1' : '#334155',
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

  const openClinicalDetail = async (id: string) => {
    setClinicalDrawerOpen(true)
    setClinicalDetailLoading(true)
    try {
      const res = await patientPortalApi.getClinicalData(id)
      if (res.success) {
        const item = Array.isArray(res.data) ? res.data[0] : res.data
        setClinicalDetail(item ?? null)
      } else {
        message.error(res.error?.message ?? '临床数据加载失败')
      }
    } catch {
      message.error('临床数据加载失败，请稍后重试')
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
      message.error('医护联系方式加载失败，请稍后重试')
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
    message.success('报告已下载')
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
        message.success('报告已下载')
      } else {
        message.error(res.error?.message ?? '报告下载失败')
      }
    } catch {
      message.error('报告下载失败，请稍后重试')
    }
  }

  const handleLogin = async () => {
    const keyword = loginId.trim()
    if (!keyword) {
      message.warning('请输入手机号或证件号')
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
        setLoginError('未查询到匹配的患者信息，请确认输入是否正确')
      }
    } catch {
      setLoginError('查询服务暂不可用，请稍后重试')
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
        if (!userRes.success && !examsRes.success) setLoadError('数据加载失败，请稍后重试')
      } catch {
        setLoadError('数据加载失败，请稍后重试')
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn])

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
      message.warning('请完整选择检查类型、部位、日期和时段')
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
        message.success('预约成功')
        setBookingDone(res.data)
        setAppointments(prev => [res.data!, ...prev])
        setBooking({})
      } else {
        message.error(res.error?.message ?? '预约失败，请稍后重试')
      }
    } catch {
      message.error('预约服务暂不可用，请稍后重试')
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
      message.warning('请先选择星级评分')
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
        message.success('感谢您的反馈，我们会持续改进服务')
        setRating(0)
        setFeedbackCategory(undefined)
        setFeedbackComment('')
      } else {
        message.error(res.error?.message ?? '反馈提交失败，请稍后重试')
      }
    } catch {
      message.error('反馈服务暂不可用，请稍后重试')
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
          <h2 style={{ fontSize: 22, marginBottom: 8 }}>患者自助服务</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>输入手机号或证件号查询</p>
          <input
            placeholder="手机号 / 身份证号"
            value={loginId}
            onChange={e => setLoginId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loginLoading && void handleLogin()}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' as const }}
          />
          <button style={{ ...styles.btn, width: '100%', padding: '12px', fontSize: 15 }} onClick={() => void handleLogin()} disabled={loginLoading}>
            {loginLoading ? '查询中...' : '查询'}
          </button>
          {loginError && <Alert type="error" showIcon message={loginError} style={{ marginTop: 16, textAlign: 'left' }} />}
          <div style={{ marginTop: 16, fontSize: 12, color: '#94a3b8' }}>演示账号：输入 13800138000 或 P001</div>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ padding: 80, textAlign: 'center' }}>
          <Spin size="large" tip="正在加载患者服务数据...">
            <div style={{ height: 60 }} />
          </Spin>
        </div>
      </div>
    )
  }

  const tabItems = [
    {
      key: 'home',
      label: '首页',
      children: (
        <div>
          <div style={styles.statRow}>
            <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
              <Statistic title="检查记录" value={exams.length} suffix="次" />
            </Card>
            <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
              <Statistic title="待完成预约" value={upcomingAppointments.length} suffix="项" />
            </Card>
            <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
              <Statistic title="已出报告" value={reports.length} suffix="份" />
            </Card>
          </div>
          <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
            <h3 style={styles.subTitle}>今日待办</h3>
            {upcomingAppointments.length === 0 && reports.length === 0 ? (
              <Empty description="暂无待办事项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div>
                {upcomingAppointments.slice(0, 3).map(a => (
                  <div key={a.id} style={styles.todoItem}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                        {a.modality} · {a.bodyPart ?? '未指定部位'}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{fmtDateTime(a.scheduledAt)} 检查</div>
                    </div>
                    <Tag color="processing">预约提醒</Tag>
                  </div>
                ))}
                {reports.length > 0 && (
                  <div style={styles.todoItem}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                        {latestReport?.modality ?? ''} · {latestReport?.bodyPart ?? '影像'} 报告已发布
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>签发时间 {fmtDateTime(latestReport?.signedAt)}</div>
                    </div>
                    <div>
                      <Tag color="success">报告通知</Tag>
                      <button style={{ ...styles.btn, marginLeft: 8 }} onClick={() => { setActiveTab('reports') }}>去查看</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
          {upcomingAppointments.length > 0 && (
            <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
              <h3 style={styles.subTitle}>最近预约</h3>
              {upcomingAppointments.slice(0, 3).map(a => (
                <div key={a.id} style={styles.todoItem}>
                  <div style={{ fontSize: 13, color: '#334155' }}>{a.modality} · {a.bodyPart ?? '-'}</div>
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
      label: '检查预约',
      children: (
        <div>
          {bookingDone && (
            <Card bordered={false} style={{ ...styles.card, border: '1px solid #a7f3d0', background: '#f0fdf4' }} styles={{ body: { padding: 0 } }}>
              <h3 style={{ ...styles.subTitle, color: '#166534' }}>预约成功</h3>
              <div style={styles.grid2}>
                <div><div style={styles.label}>检查类型</div><div style={styles.value}>{bookingDone.modality}（{bookingDone.bodyPart ?? '未指定部位'}）</div></div>
                <div><div style={styles.label}>预约时间</div><div style={styles.value}>{fmtDateTime(bookingDone.scheduledAt)}</div></div>
                <div><div style={styles.label}>预约单号</div><div style={styles.value}>{bookingDone.id}</div></div>
                <div><div style={styles.label}>状态</div><div style={styles.value}>{APPOINTMENT_STATE_LABEL[bookingDone.state] ?? bookingDone.state}</div></div>
              </div>
              <p style={{ fontSize: 12, color: '#059669', marginTop: 12 }}>请按预约时间提前 15 分钟到放射科登记台报到，检查当天请携带本人有效证件。</p>
            </Card>
          )}
          <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
            <h3 style={styles.subTitle}>选择检查类型</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {MODALITIES.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setBooking({ ...booking, modality: m.value, bodyPart: undefined })}
                  style={{
                    padding: '16px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 13,
                    border: booking.modality === m.value ? '2px solid #1e40af' : '1px solid #e2e8f0',
                    background: booking.modality === m.value ? '#eff6ff' : '#fff',
                    color: booking.modality === m.value ? '#1e40af' : '#475569',
                    fontWeight: booking.modality === m.value ? 700 : 500,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{m.value}</div>
                  <div style={{ fontSize: 11, marginTop: 4, color: '#94a3b8' }}>{m.label}</div>
                </button>
              ))}
            </div>
          </Card>
          {booking.modality && (
            <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
              <h3 style={styles.subTitle}>选择检查部位</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {modalityParts.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setBooking({ ...booking, bodyPart: p })}
                    style={{
                      padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                      border: booking.bodyPart === p ? '2px solid #0d9488' : '1px solid #e2e8f0',
                      background: booking.bodyPart === p ? '#f0fdfa' : '#fff',
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
              <h3 style={styles.subTitle}>选择检查日期</h3>
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
              <h3 style={styles.subTitle}>选择时段 — {booking.date}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {TIME_SLOTS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setBooking({ ...booking, slot: s })}
                    style={{
                      padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                      border: booking.slot === s ? '2px solid #1e40af' : '1px solid #e2e8f0',
                      background: booking.slot === s ? '#eff6ff' : '#fff',
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
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                  {booking.modality} · {booking.bodyPart} · {booking.date} {booking.slot}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>确认后将为您创建预约，请按时到检</div>
              </div>
              <button style={{ ...styles.btn, padding: '12px 28px', fontSize: 14 }} onClick={() => void submitBooking()} disabled={bookingLoading}>
                {bookingLoading ? '提交中...' : '确认预约'}
              </button>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'reports',
      label: '我的报告',
      children: (
        <div>
          <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
            <h3 style={styles.subTitle}>报告列表（{reports.length}）</h3>
            {reports.length === 0 ? (
              <Empty description="暂无已发布报告" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <table style={styles.table}>
                <thead><tr>
                  <th style={styles.th}>检查项目</th><th style={styles.th}>部位</th><th style={styles.th}>检查日期</th>
                  <th style={styles.th}>状态</th><th style={styles.th}>签发时间</th><th style={styles.th}>操作</th>
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
                          {expandedReport === r.id ? '收起' : '查看报告'}
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
                <button style={{ ...styles.btn, background: '#059669' }} onClick={() => downloadReportText(selectedReport)}>
                  下载报告
                </button>
                <button style={{ ...styles.btnGreen, background: '#1e40af' }} onClick={() => window.print()}>
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
              <h3 style={styles.subTitle}>历史检查报告</h3>
              {exams.filter(e => e.reportContent).map(exam => (
                <div key={exam.id} style={styles.todoItem}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{exam.examItem}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{exam.examDate} · {exam.bodyPart}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ ...styles.btnGreen }} onClick={() => setExpandedReport(expandedReport === exam.id ? null : exam.id)}>
                      {expandedReport === exam.id ? '收起' : '查看'}
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
                  <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, color: '#334155' }}>
                    {exam.reportContent}
                    {exam.diagnosis && <div style={{ marginTop: 12 }}><div style={styles.label}>诊断意见</div><div style={styles.value}>{exam.diagnosis}</div></div>}
                    {exam.recommendations && <div style={{ marginTop: 8 }}><div style={styles.label}>建议</div><div style={styles.value}>{exam.recommendations}</div></div>}
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
      label: '我的影像',
      children: (
        <div>
          <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
            <h3 style={styles.subTitle}>可查看的检查</h3>
            {viewableExams.length === 0 ? (
              <Empty description="暂无可用影像" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <table style={styles.table}>
                <thead><tr>
                  <th style={styles.th}>检查项目</th><th style={styles.th}>日期</th><th style={styles.th}>部位</th>
                  <th style={styles.th}>状态</th><th style={styles.th}>操作</th>
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
                          {selectedExam?.id === exam.id ? '收起' : '查看影像'}
                        </button>
                        <button style={{ ...styles.btnGreen, marginLeft: 8 }} onClick={() => openViewer(exam)}>打开影像浏览器</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          {selectedExam && (
            <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
              <h3 style={styles.subTitle}>电子胶片 — {selectedExam.examItem}</h3>
              {study && study.series.length > 0 && (
                <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                    DICOM 检查号：{study.studyInstanceUid} · WADO-RS：<code style={{ fontSize: 11 }}>{study.wadoRs.study}</code>
                  </div>
                  {study.series.map(s => (
                    <div key={s.seriesInstanceUid} style={{ fontSize: 12, color: '#334155', marginBottom: 4 }}>
                      序列 {s.seriesNumber ?? '-'}（{s.modality}）：{s.instanceCount} 帧
                      <span style={{ color: '#94a3b8', marginLeft: 8 }}>{s.wadoRs.instances}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={styles.imageGrid}>
                {images.map(img => (
                  <div key={img.id} style={styles.imageCard}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>{img.label}</div>
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
                      <button onClick={() => handleInvertToggle(img.id)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 12, cursor: 'pointer', background: img.invert ? '#3b82f6' : '#fff', color: img.invert ? '#fff' : '#64748b' }}>
                        {img.invert ? '取消反转' : '反转'}
                      </button>
                      <button style={{ ...styles.btnGreen, marginLeft: 8 }} onClick={() => openViewer(selectedExam)}>完整查看</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card bordered={false} style={{ ...styles.card, textAlign: 'center' }} styles={{ body: { padding: 0 } }}>
            <h3 style={{ ...styles.subTitle, textAlign: 'left' }}>影像下载凭证</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>生成凭证后可在自助终端领取影像光盘</p>
            {!voucherCode ? (
              <button style={styles.voucherBtn} onClick={generateVoucher}>生成下载凭证</button>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>您的下载凭证：</div>
                <div style={styles.voucherCode}>{voucherCode}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>有效期：24小时</div>
              </div>
            )}
          </Card>
        </div>
      ),
    },
    {
      key: 'education',
      label: '宣教资料',
      children: (
        <div>
          <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
            <h3 style={styles.subTitle}>健康宣教（{educations.length}）</h3>
            {educations.length === 0 ? (
              <Empty description="暂无宣教资料" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              educations.map((edu, idx) => {
                const id = edu.id ?? edu.key ?? `edu-${idx}`
                const title = edu.title ?? edu.label ?? `宣教资料 ${idx + 1}`
                const body = edu.content ?? (typeof edu.value === 'string' ? edu.value : '')
                const summary = edu.summary
                const contentType = edu.contentType
                const isOpen = expandedEdu === id
                return (
                  <div key={id} style={{ padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {title}
                          {contentType === 'video' && <Tag color="blue">视频</Tag>}
                          {contentType === 'audio' && <Tag color="purple">音频</Tag>}
                          {contentType === 'text' && <Tag>图文</Tag>}
                          {edu.category === 'pre_exam' && <Tag color="orange">检查前</Tag>}
                          {edu.category === 'post_exam' && <Tag color="cyan">检查后</Tag>}
                        </div>
                        {summary && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{summary}</div>}
                      </div>
                      {body && (
                        <button style={{ ...styles.btn, background: '#475569' }} onClick={() => setExpandedEdu(isOpen ? null : id)}>
                          {isOpen ? '收起' : '查看详情'}
                        </button>
                      )}
                    </div>
                    {isOpen && body && (
                      <div style={{ marginTop: 12, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, color: '#334155' }}>
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
      label: '临床数据',
      children: (
        <div>
          <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
            <h3 style={styles.subTitle}>临床数据记录（{clinicalData.length}）</h3>
            {clinicalData.length === 0 ? (
              <Empty description="暂无临床数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <table style={styles.table}>
                <thead><tr>
                  <th style={styles.th}>检查项目</th><th style={styles.th}>部位</th><th style={styles.th}>日期</th>
                  <th style={styles.th}>状态</th><th style={styles.th}>操作</th>
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
      label: '联系医护',
      children: (
        <div>
          <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
            <h3 style={{ ...styles.subTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>医护联系方式</span>
              <button style={{ ...styles.btn, background: '#475569' }} onClick={() => void openContacts()} disabled={contactsLoading}>
                {contactsLoading ? '加载中...' : '刷新'}
              </button>
            </h3>
            {contactsLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="small" tip="加载联系方式..." />
              </div>
            ) : doctorContacts.length === 0 && nurseContacts.length === 0 && techContacts.length === 0 ? (
              <Empty description="点击右上角「刷新」加载医护联系方式" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { title: '放射科医生', color: '#1e40af', users: doctorContacts },
                  { title: '放射科护士', color: '#0d9488', users: nurseContacts },
                  { title: '技师', color: '#7c3aed', users: techContacts },
                ].map(group => (
                  <div key={group.title} style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: group.color, marginBottom: 10 }}>{group.title}（{group.users.length}）</div>
                    {group.users.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>暂无</div>
                    ) : (
                      group.users.map(u => (
                        <div key={u.id} style={{ padding: '8px 0', borderBottom: '1px solid #eef2f7' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{u.name}</div>
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
      key: 'feedback',
      label: '满意度反馈',
      children: (
        <Card bordered={false} style={styles.card} styles={{ body: { padding: 0 } }}>
          <h3 style={styles.subTitle}>服务满意度评价</h3>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>您的评价将帮助我们持续改进服务品质，感谢您的参与。</p>
          <div style={{ marginBottom: 24 }}>
            <div style={styles.label}>总体满意度</div>
            <Rate
              value={rating}
              onChange={setRating}
              style={{ fontSize: 28 }}
            />
            {rating > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#1e40af' }}>
                {rating === 5 ? '非常满意' : rating === 4 ? '满意' : rating === 3 ? '一般' : rating === 2 ? '不满意' : '非常不满意'}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 24, maxWidth: 360 }}>
            <div style={styles.label}>评价分类</div>
            <Select
              placeholder="请选择评价分类"
              style={{ width: '100%' }}
              value={feedbackCategory}
              onChange={setFeedbackCategory}
              options={FEEDBACK_CATEGORIES.map(c => ({ value: c, label: c }))}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={styles.label}>您的建议与意见</div>
            <Input.TextArea
              rows={4}
              maxLength={500}
              showCount
              placeholder="请输入您的意见或建议（选填）"
              value={feedbackComment}
              onChange={e => setFeedbackComment(e.target.value)}
            />
          </div>
          <button style={{ ...styles.btn, padding: '10px 32px', fontSize: 14 }} onClick={() => void submitFeedback()} disabled={submitting}>
            {submitting ? '提交中...' : '提交反馈'}
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
          <h2 style={styles.title}>患者自助服务</h2>
          <button style={{ ...styles.btn, background: '#64748b' }} onClick={handleLogout}>退出</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#1e40af', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700,
          }}>
            {(user?.name ?? '患').slice(0, 1)}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{user?.name ?? '-'}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>患者编号：{user?.id ?? '-'}</div>
          </div>
        </div>
        <div style={styles.grid2}>
          <div><div style={styles.label}>性别/年龄</div><div style={styles.value}>{user?.gender ?? '-'} / {user?.age ?? '-'}岁</div></div>
          <div><div style={styles.label}>证件号</div><div style={styles.value}>{user?.idNumber ?? '-'}</div></div>
          <div><div style={styles.label}>手机号</div><div style={styles.value}>{user?.phone ?? '-'}</div></div>
          <div><div style={styles.label}>注册日期</div><div style={styles.value}>{user?.createdAt ? fmtDate(new Date(user.createdAt)) : '-'}</div></div>
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
              <div style={{ marginTop: 16, padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <div style={styles.label}>检验/生命体征</div>
                <div style={{ ...styles.value, fontSize: 13, lineHeight: 1.7 }}>{(clinicalDetail as any).labValues}</div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
