
import { patientApi } from '../../services/api/patientApi'
import type { PatientDto } from '../../types/dto'
import type { PatientSummaryDto, PatientVisitHistoryDto } from '../../services/api/patientApi'
import { ExamDto } from '../../types/dto'
import { Card, Descriptions, Tag, Timeline, Table, Collapse, Button, Badge, Spin, Alert, Empty, Divider, Statistic, Row, Col } from 'antd'
import {
  User,
  Phone,
  Activity,
  Image,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Eye,
  Calendar,
} from 'lucide-react'
import { BellOff, Inbox, Map, PhoneCall, Wallet, LineChart as LineChartIcon, Crosshair, Stethoscope, Database } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
// [v3.0.6.11-99 Wave10B] 患者360深化: 随访/病灶追踪/费用/频次趋势
import { followupApi, type FollowUpPlan } from '../../services/api/followupApi'
import { lesionTrackingApi, type TrackedLesion, type LesionStats } from '../../services/api/lesionTrackingApi'
import { financeApi, type InvoiceDto } from '../../services/api/financeApi'
import { t } from '../../i18n/appI18n'

interface ExamView {
  id: string
  examDate: string
  examItemName: string
  modality: string
  bodyPart?: string
  deviceName?: string
  status: string
  criticalFinding: boolean
  findings?: string
  diagnosis?: string
  radiologistName?: string
  reportId?: string
}

const examStatusColor: Record<string, string> = {
  '已完成': '#16a34a',
  '待出报告': '#d97706',
  '报告已发': '#2563eb',
  '检查中': '#8b5cf6',
}

const STATUS_MAP: Record<string, string> = {
  draft: '草稿',
  submitted: '待出报告',
  reviewed: '审核中',
  cosigned: '已双签',
  published: '报告已发',
  completed: '已完成',
  in_progress: '检查中',
  pending: '待出报告',
}

function normalizeStatus(status: string): string {
  if (!status) return '未知'
  if (/[\u4e00-\u9fa5]/.test(status)) return status
  return STATUS_MAP[status.toLowerCase()] || status
}

function toExamView(exam: ExamDto, report?: { findings?: string; diagnosis?: string; impression?: string; doctorId?: string; id?: string }): ExamView {
  return {
    id: exam.id || exam.examId,
    examDate: exam.scheduledAt || '',
    examItemName: exam.examItem || '影像检查',
    modality: exam.modality,
    bodyPart: exam.bodyPart,
    deviceName: exam.deviceName || exam.deviceModel,
    status: normalizeStatus(exam.status),
    criticalFinding: exam.hasCriticalValue === true,
    findings: report?.findings,
    diagnosis: report?.diagnosis || report?.impression,
    radiologistName: report?.doctorId,
    reportId: report?.id || report?.reportId,
  }
}

export default function Patient360Page() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [patient, setPatient] = useState<PatientDto | null>(null)
  const [exams, setExams] = useState<ExamView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [patientRes, examRes, reportRes] = await Promise.all([
          patientApi.getById(id),
          patientApi.getExams(id),
          patientApi.getReports(id),
        ])
        if (cancelled) return
        if (patientRes.success && patientRes.data) {
          setPatient(patientRes.data as PatientDto)
        } else {
          setPatient(null)
        }
        const rawExams = examRes.success && Array.isArray(examRes.data) ? examRes.data as ExamDto[] : []
        const rawReports = reportRes.success && Array.isArray(reportRes.data) ? reportRes.data as any[] : []
        const reportByExam = new Map<string, any>()
        for (const r of rawReports) {
          if (r.examId) reportByExam.set(r.examId, r)
          if (r.id) reportByExam.set(r.id, r)
        }
        const views = rawExams.map(e => toExamView(e, reportByExam.get(e.id) || reportByExam.get(e.examId)))
        setExams(views)
        if (!patientRes.success && !examRes.success && !reportRes.success) {
          setError(t('patient360.loadFailed'))
        }
      } catch {
        if (!cancelled) setError(t('patient360.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  const stats = useMemo(() => {
    if (!exams.length) return null
    return {
      totalExams: exams.length,
      positiveCount: exams.filter(ex => ex.criticalFinding || (ex.findings && /异常|占位|肿瘤|癌|结节|梗死|骨折|夹层/.test(ex.findings))).length,
      negativeCount: exams.filter(ex => !ex.criticalFinding && (!ex.findings || !/异常|占位|肿瘤|癌|结节|梗死|骨折|夹层/.test(ex.findings))).length,
      firstExamDate: exams.length ? exams.map(e => e.examDate).filter(Boolean).sort()[0]?.slice(0, 10) || '-' : '-',
    }
  }, [exams])

  const timelineEvents = useMemo(() => {
    return [...exams]
      .sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime())
      .map((ex) => ({
        date: ex.examDate,
        type: ex.modality,
        title: ex.examItemName,
        description: `${ex.modality} · ${ex.bodyPart || ''} · ${ex.deviceName || ''}`,
        status: ex.status,
        isCritical: ex.criticalFinding,
      }))
  }, [exams])

  const criticalExams = useMemo(() => exams.filter((ex) => ex.criticalFinding), [exams])

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 深化: 时间轴事件流 / 随访计划 / 病灶追踪 / 费用汇总 / 频次趋势
  // 全部接真实 API (followupApi / lesionTrackingApi / financeApi / patientApi.getTimeline),
  // 失败回退本地派生 + 数据源徽标。
  // ============================================================
  const [followUps, setFollowUps] = useState<FollowUpPlan[]>([])
  const [lesions, setLesions] = useState<TrackedLesion[]>([])
  const [lesionStats, setLesionStats] = useState<LesionStats | null>(null)
  const [invoices, setInvoices] = useState<InvoiceDto[]>([])
  const [apiTimelineEvents, setApiTimelineEvents] = useState<any[]>([])
  const [deepSource, setDeepSource] = useState<'real' | 'demo'>('demo')
  const [deepLoading, setDeepLoading] = useState(false)
  const [deepError, setDeepError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      setDeepLoading(true)
      setDeepError(null)
      let anyReal = false
      try {
        const [fuRes, lesionRes, lesionStatsRes, invRes, tlRes] = await Promise.allSettled([
          followupApi.list({ patientId: id, search: '' }),
          lesionTrackingApi.list(id),
          lesionTrackingApi.stats(id),
          financeApi.listInvoices(),
          patientApi.getTimeline(id),
        ])
        if (cancelled) return
        const settled = <T,>(r: PromiseSettledResult<T>): T | null =>
          r.status === 'fulfilled' && r.value && (r.value as any)?.success !== false ? (r.value as any)?.data ?? null : null

        // 随访计划 (GET /followups?patientId=..)
        const fu = settled(fuRes)
        const fuList: FollowUpPlan[] = Array.isArray(fu) ? fu : Array.isArray((fu as any)?.data) ? (fu as any).data : []
        if (fuList.length > 0) {
          setFollowUps(fuList.filter(p => p.patientId === id).slice(0, 10))
          anyReal = true
        }

        // 病灶追踪 (GET /lesion-tracking/lesions?patientId=..)
        const lesionPayload = settled(lesionRes)
        const lesionItems: TrackedLesion[] = Array.isArray(lesionPayload) ? lesionPayload
          : Array.isArray((lesionPayload as any)?.items) ? (lesionPayload as any).items : []
        if (lesionItems.length > 0) {
          setLesions(lesionItems)
          anyReal = true
        }
        const lStats = settled(lesionStatsRes)
        if (lStats && typeof lStats === 'object' && (lStats as any).total !== undefined) {
          setLesionStats(lStats as unknown as LesionStats)
          anyReal = true
        }

        // 费用汇总 (GET /finance/invoices → 按 patientId 过滤)
        const inv = settled(invRes)
        const invList: InvoiceDto[] = Array.isArray(inv) ? inv : []
        const mine = invList.filter(i => i.patientId === id)
        if (mine.length > 0) {
          setInvoices(mine)
          anyReal = true
        }

        // 时间轴 (GET /patients/:id/timeline)
        const tl = settled(tlRes)
        if (Array.isArray(tl) && tl.length > 0) {
          setApiTimelineEvents(tl)
          anyReal = true
        }

        setDeepSource(anyReal ? 'real' : 'demo')
        if (!anyReal) setDeepError(t('patient360.deepUnavailable'))
      } catch {
        if (!cancelled) {
          setDeepSource('demo')
          setDeepError(t('patient360.deepLoadFailed'))
        }
      } finally {
        if (!cancelled) setDeepLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  // ============================================================
  // [v3.0.6.11-104 Wave 2B] 患者档案: 综合摘要 (summary) + 就诊历史 (visit-history)
  // ============================================================
  const [summary, setSummary] = useState<PatientSummaryDto | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [visitHistory, setVisitHistory] = useState<PatientVisitHistoryDto | null>(null)
  const [visitLoading, setVisitLoading] = useState(false)
  const [visitError, setVisitError] = useState<string | null>(null)
  const [profileReloadKey, setProfileReloadKey] = useState(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      setSummaryLoading(true)
      setVisitLoading(true)
      setSummaryError(null)
      setVisitError(null)
      const [summaryRes, visitRes] = await Promise.allSettled([
        patientApi.getSummary(id),
        patientApi.getVisitHistory(id),
      ])
      if (cancelled) return
      if (summaryRes.status === 'fulfilled' && summaryRes.value.success && summaryRes.value.data) {
        setSummary(summaryRes.value.data)
      } else {
        setSummary(null)
        setSummaryError(t('patientPage.summaryLoadFailed'))
      }
      if (visitRes.status === 'fulfilled' && visitRes.value.success && visitRes.value.data) {
        setVisitHistory(visitRes.value.data)
      } else {
        setVisitHistory(null)
        setVisitError(t('patientPage.visitHistoryLoadFailed'))
      }
      setSummaryLoading(false)
      setVisitLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, profileReloadKey])

  // 时间轴事件流: 检查/报告/随访/危急值 合并为统一事件流
  const eventStream = useMemo(() => {
    const events: Array<{
      id: string
      date: string
      kind: 'exam' | 'report' | 'followup' | 'critical' | 'system'
      title: string
      desc: string
      color: string
    }> = []
    exams.forEach(ex => {
      events.push({
        id: `ev-ex-${ex.id}`,
        date: ex.examDate,
        kind: 'exam',
        title: `检查 · ${ex.examItemName}`,
        desc: `${ex.modality} ${ex.bodyPart || ''} · ${ex.status}${ex.criticalFinding ? ' · 含危急值' : ''}`,
        color: ex.criticalFinding ? '#dc2626' : '#2563eb',
      })
    })
    followUps.forEach(f => {
      events.push({
        id: `ev-fu-${f.id}`,
        date: f.nextDate || f.planDate,
        kind: 'followup',
        title: `随访 · ${f.status}`,
        desc: f.note || `计划 ${f.planDate} → 下次 ${f.nextDate}`,
        color: f.status === 'COMPLETED' ? '#16a34a' : f.status === 'MISSED' || f.status === 'OVERDUE' ? '#dc2626' : '#d97706',
      })
    })
    apiTimelineEvents.forEach((t: any) => {
      events.push({
        id: `ev-tl-${t.id ?? Math.random()}`,
        date: t.date ?? t.timestamp ?? '',
        kind: 'system',
        title: `事件 · ${t.type ?? t.event ?? '记录'}`,
        desc: t.description ?? t.content ?? '',
        color: '#7c3aed',
      })
    })
    return events.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30)
  }, [exams, followUps, apiTimelineEvents])

  // 费用汇总
  const financeSummary = useMemo(() => {
    if (invoices.length === 0) return null
    return {
      totalAmount: invoices.reduce((s, i) => s + Number(i.totalAmount ?? 0), 0),
      paidAmount: invoices.reduce((s, i) => s + Number(i.paidAmount ?? 0), 0),
      balance: invoices.reduce((s, i) => s + Number(i.balance ?? 0), 0),
      insuranceCovered: invoices.reduce((s, i) => s + Number(i.insuranceCovered ?? 0), 0),
      selfPay: invoices.reduce((s, i) => s + Number(i.selfPayAmount ?? 0), 0),
      unpaid: invoices.filter(i => String(i.status).toLowerCase().includes('unpaid') || Number(i.balance ?? 0) > 0).length,
    }
  }, [invoices])

  // 检查频次趋势 (按月)
  const examFreqTrend = useMemo(() => {
    const byMonth: Record<string, number> = {}
    exams.forEach(ex => {
      const m = String(ex.examDate ?? '').slice(0, 7)
      if (m) byMonth[m] = (byMonth[m] || 0) + 1
    })
    const months = Object.keys(byMonth).sort()
    const max = Math.max(1, ...Object.values(byMonth))
    return months.slice(-8).map(m => ({
      month: m,
      count: byMonth[m] ?? 0,
      percent: Math.round(((byMonth[m] ?? 0) / max) * 100),
    }))
  }, [exams])

  // 病灶追踪汇总 (随访计划与病灶关联展示, 用于病灶卡"关联随访"高亮)
  // 已在病灶卡内直接通过 followUps.find 渲染, 见渲染区块3

  if (loading) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" tip={t('patient360.loadingTip')}>
          <div style={{ height: 60 }} />
        </Spin>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => navigate('/patients')}>{t('patient360.backToList')}</Button>} />
      </div>
    )
  }

  if (!patient) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
        <User size={48} style={{ marginBottom: 16, color: '#cbd5e1' }} />
        <div style={{ fontSize: 16, fontWeight: 600 }}>{t('patient360.notFound')}</div>
        <Button type="primary" style={{ marginTop: 16 }} onClick={() => navigate('/patients')}>
          {t('patient360.backToList')}
        </Button>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}
          >
            {patient.name.slice(0, 1)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1e40af' }}>
              {patient.name}
              {patient.patientType && <Tag color="blue" style={{ marginLeft: 12, fontSize: 12 }}>{patient.patientType}</Tag>}
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 8, fontSize: 13, color: '#64748b', flexWrap: 'wrap' }}>
              <span><User size={13} style={{ marginRight: 4 }} />{patient.gender} · {patient.age}{t('patient360.ageUnit')}</span>
              {patient.phone && <span><Phone size={13} style={{ marginRight: 4 }} />{patient.phone}</span>}
              <span><Calendar size={13} style={{ marginRight: 4 }} />ID: {patient.id}</span>
              {patient.birthDate && <span>{t('patient360.birth')}{patient.birthDate.slice(0, 10)}</span>}
            </div>
          </div>
          <Button
            type="default"
            icon={<Image size={14} />}
            onClick={() => navigate(`/dicom/fusion-v2?patientId=${patient.id}`)}
          >
            {t('patient360.imageCompare')}
          </Button>
        </div>
      </Card>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: t('patient360.statTotalExams'), value: stats.totalExams, color: '#1e40af', bg: 'var(--color-info-bg)', icon: Activity },
            { label: t('patient360.statPositive'), value: stats.positiveCount, color: 'var(--color-error)', bg: 'var(--color-error-bg)', icon: AlertTriangle },
            { label: t('patient360.statNegative'), value: stats.negativeCount, color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: Clock },
            { label: t('patient360.statFirstExam'), value: stats.firstExamDate, color: 'var(--text-secondary)', bg: 'var(--bg-card)', icon: Calendar },
          ].map((item) => (
            <div key={item.label} style={{ background: item.bg, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <item.icon size={22} style={{ color: item.color }} />
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1e40af' }}>{item.value}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* [v3.0.6.11-104 Wave 2B] 患者综合摘要 (GET /patients/:id/summary) */}
      <Card
        title={<span><Database size={14} /> {t('patientPage.summaryCard')}</span>}
        style={{ marginBottom: 16, borderRadius: 12 }}
        extra={
          <Button size="small" onClick={() => setProfileReloadKey((k) => k + 1)} loading={summaryLoading}>
            {t('examPage.refresh')}
          </Button>
        }
      >
        {summaryError && !summaryLoading ? (
          <Alert type="warning" showIcon message={summaryError} />
        ) : !summary ? (
          <Empty image={<Inbox size={48} style={{ opacity: 0.4 }} />} description={t('patientPage.summaryEmpty')} style={{ padding: 16 }} />
        ) : (
          <>
            <Row gutter={[12, 12]}>
              {[
                { label: t('patientPage.summaryExams'), value: summary.counts.exams, color: '#1e40af', bg: 'var(--color-info-bg)' },
                { label: t('patientPage.summaryReports'), value: summary.counts.reports, color: '#16a34a', bg: 'var(--color-success-bg)' },
                { label: t('patientPage.summaryFollowUps'), value: summary.counts.followUps, color: '#d97706', bg: 'var(--color-warning-bg)' },
                { label: t('patientPage.summaryCriticals'), value: summary.counts.criticalValues, color: '#dc2626', bg: 'var(--color-error-bg)' },
                { label: t('patientPage.summaryInvoices'), value: summary.counts.invoices, color: '#7c3aed', bg: 'var(--bg-card)' },
              ].map((item) => (
                <Col xs={12} sm={8} md={4} key={item.label}>
                  <div style={{ textAlign: 'center', padding: 12, borderRadius: 10, background: item.bg }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{item.label}</div>
                  </div>
                </Col>
              ))}
              <Col xs={12} sm={8} md={4}>
                <div style={{ textAlign: 'center', padding: 12, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706' }}>¥{summary.totalCharges}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t('patientPage.summaryCharges')}</div>
                </div>
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>{t('patientPage.recentExams')}</div>
                {summary.recentExams.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('patientPage.noRecord')}</div>
                ) : summary.recentExams.map((ex) => (
                  <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0' }}>
                    <Tag color="blue">{ex.modality}</Tag>
                    <span style={{ color: '#334155' }}>{ex.bodyPart}</span>
                    <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>{String(ex.createdAt).slice(0, 10)}</span>
                  </div>
                ))}
              </Col>
              <Col xs={24} md={12}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>{t('patientPage.recentReports')}</div>
                {summary.recentReports.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('patientPage.noRecord')}</div>
                ) : summary.recentReports.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0' }}>
                    <Tag color="green">{r.state}</Tag>
                    <span style={{ color: '#334155', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.conclusion || '—'}</span>
                    <span style={{ color: '#94a3b8' }}>{String(r.createdAt).slice(0, 10)}</span>
                  </div>
                ))}
              </Col>
            </Row>
          </>
        )}
      </Card>

      {/* [v3.0.6.11-104 Wave 2B] 就诊历史 (GET /patients/:id/visit-history) */}
      <Card
        title={<span><Calendar size={14} /> {t('patientPage.visitHistoryCard')}</span>}
        style={{ marginBottom: 16, borderRadius: 12 }}
        extra={<Tag color={visitError ? 'orange' : 'blue'}>{visitHistory?.total ?? 0}</Tag>}
      >
        {visitError && !visitLoading ? (
          <Alert type="warning" showIcon message={visitError} />
        ) : !visitHistory || visitHistory.events.length === 0 ? (
          <Empty image={<Inbox size={48} style={{ opacity: 0.4 }} />} description={t('patientPage.visitHistoryEmpty')} style={{ padding: 16 }} />
        ) : (
          <Timeline
            style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 8 }}
            items={visitHistory.events.map((ev, idx) => ({
              color: ev.type === 'exam' ? '#16a34a' : ev.type === 'appointment' ? '#d97706' : '#2563eb',
              children: (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: '#1e40af', fontSize: 13 }}>{ev.label}</span>
                    <Tag style={{ fontSize: 11, margin: 0 }}>{ev.status || ev.type}</Tag>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>
                      {String(ev.date || '').slice(0, 10)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{ev.detail}</div>
                </div>
              ),
              key: `vh-${idx}`,
            }))}
          />
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title={t('patient360.examTimeline')} style={{ borderRadius: 12 }}>
          {timelineEvents.length === 0 ? (
            <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('patient360.noExamRecord')} style={{ padding: 24 }} />
          ) : (
            <Timeline
              items={timelineEvents.map((evt) => ({
                color: evt.isCritical ? '#dc2626' : '#3b82f6',
                dot: evt.isCritical ? <Badge dot color="#dc2626"><ShieldAlert size={14} color="#dc2626" /></Badge> : undefined,
                children: (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: '#1e40af' }}>{evt.title}</span>
                      {evt.isCritical && <Tag color="red" style={{ fontSize: 11, lineHeight: '18px' }}>{t('patient360.criticalValue')}</Tag>}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{evt.description}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      <Calendar size={11} style={{ marginRight: 4 }} />
                      {evt.date}
                      <Tag color={examStatusColor[evt.status] || '#64748b'} style={{ marginLeft: 8, fontSize: 11 }}>
                        {evt.status}
                      </Tag>
                    </div>
                  </div>
                ),
              }))}
            />
          )}
        </Card>

        <Card title={t('patient360.reportSummary')} style={{ borderRadius: 12 }}>
          {exams.length === 0 ? (
            <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('patient360.noReportRecord')} style={{ padding: 24 }} />
          ) : (
            <Collapse
              ghost
              items={exams.map((ex, idx) => ({
                key: String(idx),
                label: (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span style={{ fontWeight: 600, color: ex.criticalFinding ? '#dc2626' : '#1e40af' }}>
                      {ex.examItemName}
                      {ex.criticalFinding && <AlertTriangle size={12} style={{ marginLeft: 6, color: '#dc2626' }} />}
                    </span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{ex.examDate}</span>
                  </div>
                ),
                extra: ex.criticalFinding ? <Tag color="red">{t('patient360.critical')}</Tag> : null,
                children: (
                  <div>
                    <Descriptions size="small" column={1} style={{ fontSize: 13 }}>
                      <Descriptions.Item label={t('patient360.examDate')}>{ex.examDate || '-'}</Descriptions.Item>
                      <Descriptions.Item label={t('patient360.examType')}>{ex.modality || '-'}</Descriptions.Item>
                      <Descriptions.Item label={t('patient360.examBodyPart')}>{ex.bodyPart || '-'}</Descriptions.Item>
                      <Descriptions.Item label={t('patient360.device')}>{ex.deviceName || '-'}</Descriptions.Item>
                      <Descriptions.Item label={t('patient360.status')}>{ex.status}</Descriptions.Item>
                      <Descriptions.Item label={t('patient360.findings')}>{ex.findings || t('patient360.noAbnormal')}</Descriptions.Item>
                      <Descriptions.Item label={t('patient360.diagnosis')}>{ex.diagnosis || '-'}</Descriptions.Item>
                    </Descriptions>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      <Button size="small" icon={<Eye size={12} />} onClick={() => navigate(`/dicom-viewer?examId=${ex.id}`)}>
                        {t('patient360.viewImage')}
                      </Button>
                      {ex.reportId && (
                        <Button size="small" icon={<FileText size={12} />} onClick={() => navigate(`/reports?reportId=${ex.reportId}`)}>
                          {t('patient360.viewReport')}
                        </Button>
                      )}
                    </div>
                  </div>
                ),
              }))}
            />
          )}
        </Card>
      </div>

      <Card title={t('patient360.criticalMark')} style={{ marginTop: 16, borderRadius: 12 }}>
        {criticalExams.length === 0 ? (
          <Empty image={<BellOff size={48} style={{opacity:0.4}}/>} description={t('patient360.noCriticalRecord')} style={{ padding: 16 }} />
        ) : (
          <Table
            dataSource={criticalExams}
            columns={[
              { title: t('patient360.examDate'), dataIndex: 'examDate', key: 'examDate', width: 120 },
              {
                title: t('patient360.examItem'), dataIndex: 'examItemName', key: 'examItemName',
                render: (_, r) => <span style={{ color: '#dc2626', fontWeight: 600 }}>{r.examItemName}</span>,
              },
              { title: t('patient360.device'), dataIndex: 'deviceName', key: 'deviceName', width: 120 },
              { title: t('patient360.bodyPart'), dataIndex: 'bodyPart', key: 'bodyPart', width: 100 },
              {
                title: t('patient360.criticalDetails'), key: 'criticalFindingDetails',
                render: (_, r) => r.findings || t('patient360.hasCriticalFinding'),
              },
              {
                title: t('patient360.action'), key: 'action', width: 120,
                render: (_, r) => (
                  <Button type="link" danger size="small" onClick={() => navigate(`/critical-value?examId=${r.id}`)}>
                    {t('patient360.viewHandle')}
                  </Button>
                ),
              },
            ]}
            rowKey="id"
            pagination={false}
            size="small"
          scroll={{ x: 'max-content' }}
          />
        )}
      </Card>

      {/* ============================================================
          [v3.0.6.11-99 Wave10B] 深化: 时间轴事件流 / 随访 / 病灶 / 费用 / 频次趋势
          ============================================================ */}
      {/* 数据源徽标 */}
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
          background: deepSource === 'real' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
          color: deepSource === 'real' ? '#065f46' : '#92400e',
          border: `1px solid ${deepSource === 'real' ? '#bbf7d0' : '#fcd34d'}`,
        }}>
          <Database size={12} />
          {t('patient360.deepSource')}{deepSource === 'real' ? t('patient360.deepReal') : t('patient360.deepDemo')}
        </span>
        {deepLoading && <span style={{ fontSize: 12, color: '#94a3b8' }}>{t('patient360.loading')}</span>}
        {deepError && <span style={{ fontSize: 11, color: '#d97706' }}>{deepError}</span>}
      </div>

      {/* 1. 时间轴视图 (事件流: 检查/报告/随访/危急值) */}
      <Card
        title={<span><Calendar size={14} /> {t('patient360.eventTimeline')}</span>}
        style={{ marginTop: 16, borderRadius: 12 }}
        extra={<Tag color={deepSource === 'real' ? 'green' : 'orange'}>{deepSource === 'real' ? t('patient360.apiRealtime') : t('patient360.derived')}</Tag>}
      >
        {eventStream.length === 0 ? (
          <Empty image={<Inbox size={48} style={{ opacity: 0.4 }} />} description={t('patient360.noEventRecord')} style={{ padding: 16 }} />
        ) : (
          <Timeline
            style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 8 }}
            items={eventStream.map(ev => ({
              color: ev.color,
              dot: ev.kind === 'critical' ? <Badge dot color="#dc2626"><ShieldAlert size={14} color="#dc2626" /></Badge>
                : ev.kind === 'followup' ? <Stethoscope size={14} style={{ color: ev.color }} />
                : ev.kind === 'system' ? <Map size={14} style={{ color: ev.color }} />
                : undefined,
              children: (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: ev.color, fontSize: 13 }}>{ev.title}</span>
                    {ev.kind === 'critical' && <Tag color="red" style={{ fontSize: 11, lineHeight: '18px', margin: 0 }}>{t('patient360.critical')}</Tag>}
                    {ev.kind === 'followup' && <Tag color="orange" style={{ fontSize: 11, lineHeight: '18px', margin: 0 }}>{t('patient360.followup')}</Tag>}
                    <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>
                      {String(ev.date || '').slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{ev.desc}</div>
                </div>
              ),
            }))}
          />
        )}
      </Card>

      {/* 2. 随访计划卡 */}
      <Card
        title={<span><PhoneCall size={14} /> {t('patient360.followupPlan')}</span>}
        style={{ marginTop: 16, borderRadius: 12 }}
        extra={<Button size="small" type="primary" ghost onClick={() => navigate(`/follow-up?patientId=${patient.id}`)}>{t('patient360.goFollowupMgmt')}</Button>}
      >
        {followUps.length === 0 ? (
          <Empty image={<BellOff size={48} style={{ opacity: 0.4 }} />} description={t('patient360.noFollowupPlan')} style={{ padding: 16 }} />
        ) : (
          <Table
            dataSource={followUps}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: t('patient360.status'), dataIndex: 'status', key: 'status', width: 100,
                render: (s: string) => {
                  const map: Record<string, { label: string; color: string }> = {
                    PENDING: { label: t('patient360.fuPending'), color: '#d97706' },
                    REMINDED: { label: t('patient360.fuReminded'), color: '#2563eb' },
                    IN_PROGRESS: { label: t('patient360.fuInProgress'), color: '#7c3aed' },
                    COMPLETED: { label: t('patient360.fuCompleted'), color: '#16a34a' },
                    MISSED: { label: t('patient360.fuMissed'), color: '#dc2626' },
                    CANCELLED: { label: t('patient360.fuCancelled'), color: '#94a3b8' },
                    OVERDUE: { label: t('patient360.fuOverdue'), color: '#dc2626' },
                  }
                  const cfg = map[s] || { label: s, color: '#64748b' }
                  return <Tag color={cfg.color}>{cfg.label}</Tag>
                },
              },
              { title: t('patient360.planDate'), dataIndex: 'planDate', key: 'planDate', width: 120, render: (v: string) => String(v || '').slice(0, 10) },
              { title: t('patient360.nextDate'), dataIndex: 'nextDate', key: 'nextDate', width: 120, render: (v: string) => String(v || '').slice(0, 10) },
              { title: t('patient360.interval'), dataIndex: 'intervalDays', key: 'intervalDays', width: 70, render: (v: number) => `${v ?? '-'} ${t('patient360.days')}` },
              { title: t('patient360.note'), dataIndex: 'note', key: 'note', ellipsis: true },
              {
                title: t('patient360.completedAt'), dataIndex: 'completedAt', key: 'completedAt', width: 130,
                render: (v: string | null) => v ? String(v).slice(0, 10) : '—',
              },
            ]}
          />
        )}
      </Card>

      {/* 3. 病灶追踪摘要 */}
      <Card
        title={<span><Crosshair size={14} /> {t('patient360.lesionSummary')}</span>}
        style={{ marginTop: 16, borderRadius: 12 }}
        extra={
          lesionStats && (
            <Tag color="purple">
              {t('patient360.lesionCount', { total: lesionStats.total, newCount: lesionStats.new, progressed: lesionStats.progressed, stable: lesionStats.stable })}
            </Tag>
          )
        }
      >
        {lesions.length === 0 ? (
          <Empty image={<Inbox size={48} style={{ opacity: 0.4 }} />} description={t('patient360.noLesion')} style={{ padding: 16 }} />
        ) : (
          <Row gutter={[12, 12]}>
            {lesions.slice(0, 4).map(l => {
              const ms = [...(l.measurements ?? [])].sort((a, b) => String(a.date).localeCompare(String(b.date)))
              const first = ms[0]
              const last = ms[ms.length - 1]
              const change = first && last && first.sizeMm ? Math.round(((last.sizeMm - first.sizeMm) / first.sizeMm) * 1000) / 10 : 0
              const linked = followUps.find(f => f.id === l.followupId)
              return (
                <Col xs={24} md={12} key={l.id}>
                  <div style={{
                    padding: 14, borderRadius: 10, border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: '#1e40af', fontSize: 14 }}>{l.name}</span>
                      <Tag color={l.currentStatus === '增大' ? 'red' : l.currentStatus === '缩小' ? 'green' : l.currentStatus === '消失' ? 'green' : l.currentStatus === '新发' ? 'orange' : 'blue'}>
                        {l.currentStatus}
                      </Tag>
                      <Tag>{l.type}</Tag>
                      <Tag color="cyan">{l.site}</Tag>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                      {l.modality} · {t('patient360.registeredAt')} {String(l.createdAt || '').slice(0, 10)}
                    </div>
                    {first && last && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#1e40af' }}>{last.sizeMm}mm</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{t('patient360.latest')} ({String(last.date).slice(0, 10)})</div>
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>→</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>{first.sizeMm}mm</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{t('patient360.baseline')} ({String(first.date).slice(0, 10)})</div>
                        </div>
                        <span style={{
                          marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
                          background: change > 0 ? 'var(--color-error-bg)' : change < 0 ? 'var(--color-success-bg)' : 'var(--color-info-bg)',
                          color: change > 0 ? '#b91c1c' : change < 0 ? '#065f46' : '#1e40af',
                        }}>
                          {change > 0 ? '+' : ''}{change}%
                        </span>
                      </div>
                    )}
                    {linked && (
                      <div style={{
                        marginTop: 10, padding: '8px 10px', borderRadius: 6, fontSize: 12,
                        background: 'var(--color-info-bg)', color: '#1e40af',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <Stethoscope size={12} />
                        {t('patient360.linkedFollowup')} {String(linked.nextDate || '').slice(0, 10)} · {linked.status}
                      </div>
                    )}
                  </div>
                </Col>
              )
            })}
          </Row>
        )}
      </Card>

      {/* 4. 费用汇总 */}
      <Card title={<span><Wallet size={14} /> {t('patient360.financeSummary')}</span>} style={{ marginTop: 16, borderRadius: 12 }}>
        {financeSummary ? (
          <>
            <Row gutter={[12, 12]}>
              <Col xs={12} md={6}>
                <div style={{ textAlign: 'center', padding: 14, background: 'var(--color-info-bg)', borderRadius: 10 }}>
                  <Statistic title={t('patient360.totalCost')} value={financeSummary.totalAmount} precision={2} prefix="¥" valueStyle={{ color: '#1e40af', fontSize: 22 }} />
                </div>
              </Col>
              <Col xs={12} md={6}>
                <div style={{ textAlign: 'center', padding: 14, background: 'var(--color-success-bg)', borderRadius: 10 }}>
                  <Statistic title={t('patient360.paid')} value={financeSummary.paidAmount} precision={2} prefix="¥" valueStyle={{ color: '#16a34a', fontSize: 22 }} />
                </div>
              </Col>
              <Col xs={12} md={6}>
                <div style={{ textAlign: 'center', padding: 14, background: financeSummary.balance > 0 ? 'var(--color-warning-bg)' : 'var(--color-success-bg)', borderRadius: 10 }}>
                  <Statistic title={t('patient360.unpaid')} value={financeSummary.balance} precision={2} prefix="¥" valueStyle={{ color: financeSummary.balance > 0 ? '#d97706' : '#16a34a', fontSize: 22 }} />
                </div>
              </Col>
              <Col xs={12} md={6}>
                <div style={{ textAlign: 'center', padding: 14, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t('patient360.insuranceSelfPay')}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#7c3aed' }}>¥{financeSummary.insuranceCovered} / ¥{financeSummary.selfPay}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{t('patient360.unpaidCount', { count: financeSummary.unpaid })}</div>
                </div>
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <Table
              dataSource={invoices}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: t('patient360.examItem'), dataIndex: 'examItem', key: 'examItem' },
                { title: t('patient360.examDate'), dataIndex: 'examDate', key: 'examDate', width: 120, render: (v: string) => String(v || '').slice(0, 10) },
                { title: t('patient360.totalAmount'), dataIndex: 'totalAmount', key: 'totalAmount', width: 100, render: (v: number) => `¥${Number(v ?? 0).toFixed(2)}` },
                { title: t('patient360.insurance'), dataIndex: 'insuranceCovered', key: 'insuranceCovered', width: 100, render: (v: number) => `¥${Number(v ?? 0).toFixed(2)}` },
                { title: t('patient360.balance'), dataIndex: 'balance', key: 'balance', width: 100, render: (v: number) => (
                    <span style={{ color: Number(v ?? 0) > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>¥{Number(v ?? 0).toFixed(2)}</span>
                  ) },
                { title: t('patient360.status'), dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={String(v).toLowerCase().includes('paid') ? 'green' : 'orange'}>{v}</Tag> },
              ]}
            />
          </>
        ) : (
          <Empty image={<Wallet size={48} style={{ opacity: 0.4 }} />} description={t('patient360.noFinanceRecord')} style={{ padding: 16 }} />
        )}
      </Card>

      {/* 5. 检查频次趋势 */}
      <Card title={<span><LineChartIcon size={14} /> {t('patient360.freqTrend')}</span>} style={{ marginTop: 16, borderRadius: 12 }}>
        {examFreqTrend.length === 0 ? (
          <Empty image={<Inbox size={48} style={{ opacity: 0.4 }} />} description={t('patient360.noFreqData')} style={{ padding: 16 }} />
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, padding: '0 8px' }}>
              {examFreqTrend.map((m) => (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{m.count}</div>
                  <div style={{
                    width: '70%', height: `${m.percent * 0.9}px`, minHeight: 6, borderRadius: '3px 3px 0 0',
                    background: m.count >= Math.max(...examFreqTrend.map(x => x.count)) ? 'linear-gradient(180deg, #1e40af, #3b82f6)' : 'linear-gradient(180deg, #93c5fd, #bfdbfe)',
                    transition: 'height 0.3s',
                  }} title={`${m.month}: ${m.count} 次`} />
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>{m.month.slice(5)}{t('patient360.monthUnit')}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: '#64748b' }}>
              {t('patient360.freqSummaryPrefix', { months: examFreqTrend.length })} <strong>{exams.length}</strong> {t('patient360.freqSummaryMid')} <strong>{Math.max(...examFreqTrend.map(x => x.count))}</strong> {t('patient360.freqSummarySuffix')}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Activity size={12} /> {t('patient360.firstExam')} {stats?.firstExamDate || '—'}
              </span>
              <span style={{ fontSize: 12, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> {t('patient360.lastExam')} {exams.map(e => e.examDate).filter(Boolean).sort().slice(-1)[0]?.slice(0, 10) || '—'}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* ============================================================
          [v3.0.6.11-99 Wave10B] 深化 II: 报告要点/对比剂/就诊时段分布
          ============================================================ */}
      {/* 6. 报告结构化要点卡 */}
      <Card title={<span><FileText size={14} /> {t('patient360.reportKeyPoints')}</span>} style={{ marginTop: 16, borderRadius: 12 }}>
        {exams.length === 0 ? (
          <Empty image={<Inbox size={48} style={{ opacity: 0.4 }} />} description={t('patient360.noReportPoints')} style={{ padding: 16 }} />
        ) : (
          <Row gutter={[12, 12]}>
            {exams.filter(ex => ex.findings || ex.diagnosis).slice(0, 3).map(ex => (
              <Col xs={24} md={12} xl={8} key={ex.id}>
                <div style={{
                  padding: 14, borderRadius: 10, border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)', height: '100%',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: '#1e40af', fontSize: 13 }}>{ex.examItemName}</span>
                    <Tag color="blue">{ex.modality}</Tag>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{String(ex.examDate || '').slice(0, 10)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.7, marginBottom: 8, maxHeight: 84, overflow: 'hidden' }}>
                    <strong style={{ color: '#1e40af' }}>{t('patient360.findingsLabel')}</strong> {ex.findings || t('patient360.notFilled')}
                  </div>
                  <div style={{
                    fontSize: 12, lineHeight: 1.7, padding: '8px 10px', borderRadius: 6,
                    background: ex.criticalFinding ? 'var(--color-error-bg)' : 'var(--color-info-bg)',
                    color: ex.criticalFinding ? '#991b1b' : '#1e40af',
                  }}>
                    <strong>{t('patient360.diagnosisLabel')}</strong> {ex.diagnosis || '—'}
                    {ex.criticalFinding && <Tag color="red" style={{ marginLeft: 8 }}>{t('patient360.critical')}</Tag>}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      {/* 7. 对比剂与就诊时段分布 */}
      <Card title={<span><Activity size={14} /> {t('patient360.visitProfile')}</span>} style={{ marginTop: 16, borderRadius: 12 }}>
        {(() => {
          const contrastCount = exams.filter(e => String(e.findings || '').includes('对比剂') || String(e.deviceName || '').includes('增强') || String(e.examItemName).includes('增强')).length
          const hourBuckets = { '上午 (8-12)': 0, '下午 (12-18)': 0, '晚间 (18-24)': 0, '凌晨 (0-8)': 0 }
          exams.forEach(e => {
            const t = String(e.examDate || '')
            const h = Number(t.slice(11, 13) || 12)
            if (h >= 8 && h < 12) hourBuckets['上午 (8-12)'] += 1
            else if (h >= 12 && h < 18) hourBuckets['下午 (12-18)'] += 1
            else if (h >= 18) hourBuckets['晚间 (18-24)'] += 1
            else hourBuckets['凌晨 (0-8)'] += 1
          })
          const total = exams.length
          const maxBucket = Math.max(1, ...Object.values(hourBuckets))
          return (
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={13} /> {t('patient360.contrastUsage')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0' }}>
                  <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
                    <svg viewBox="0 0 100 100" width={90} height={90}>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="16" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#8b5cf6" strokeWidth="16"
                        strokeDasharray={`${(contrastCount / Math.max(1, total)) * 264} 264`}
                        transform="rotate(-90 50 50)" />
                      <text x="50" y="48" textAnchor="middle" fontSize="16" fontWeight="700" fill="#1e40af">
                        {total > 0 ? Math.round((contrastCount / total) * 100) : 0}%
                      </text>
                      <text x="50" y="63" textAnchor="middle" fontSize="8" fill="#94a3b8">{t('patient360.contrastRatio')}</text>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                      {t('patient360.contrastExamPrefix')} <strong style={{ color: '#8b5cf6' }}>{contrastCount}</strong> {t('patient360.contrastExamMid')} <strong>{total}</strong> {t('patient360.contrastExamSuffix')}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
                      {t('patient360.contrastHint')}
                    </div>
                  </div>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={13} /> {t('patient360.hourDistribution')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(hourBuckets).map(([label, count]) => (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: '#64748b' }}>{label}</span>
                        <span style={{ color: '#1e40af', fontWeight: 700 }}>{count} {t('patient360.times')}</span>
                      </div>
                      <div style={{ height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${(count / maxBucket) * 100}%`, height: '100%', borderRadius: 4,
                          background: 'linear-gradient(90deg, #3b82f6, #1e40af)', transition: 'width 0.3s',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                  {t('patient360.peakHour')} {Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'}
                </div>
              </Col>
            </Row>
          )
        })()}
      </Card>
    </div>
  )
}

function FileText({ size }: { size?: number }) {
  return (
    <svg width={size || 14} height={size || 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}
