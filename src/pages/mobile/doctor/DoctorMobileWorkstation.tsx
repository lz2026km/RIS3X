import { useState, useEffect, useCallback, useRef } from 'react'
import { message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, ChevronRight, Bell, AlertTriangle, ListChecks, Image, Mic, BarChart3, FileText, RefreshCw, CheckCircle, FileCheck2, X } from 'lucide-react'
import {
  mobileApi,
  reportApi,
  type WorklistItem,
  type TodaySummary,
  type CriticalValueItem,
  type LatestReportItem,
  type ReportDto,
} from '../../../services/api'
import { t } from '../../../i18n/appI18n'

export { type DoctorWorklistItem, type DoctorStats } from '../../../services/api'

const PRIORITY_COLORS: Record<string, string> = {
  routine: '#64748b',
  urgent: 'var(--color-warning-600)',
  critical: 'var(--color-error-600)',
}

const STATUS_LABELS: Record<string, string> = {
  pending: t('docMobile.status.pending'),
  reading: t('docMobile.status.reading'),
  reported: t('docMobile.status.reported'),
}

// ── 离线演示数据兜底 (后端 /mobile 不可用时展示, 与 backend mobile.service seed 对齐)
// 标注: 页面在接口全部失败时回退到此处, 顶部横幅会提示"离线演示数据"
const MOCK_WORKLIST: WorklistItem[] = [
  { id: 'W1', accessionNumber: 'ACC001', patientId: 'P001', patientName: '张志刚', gender: 'MALE', age: 62, modality: 'CT', bodyPart: '胸部', status: 'pending', state: 'SCHEDULED', urgency: 'critical', scheduledAt: new Date(Date.now() + 3600_000).toISOString() },
  { id: 'W2', accessionNumber: 'ACC002', patientId: 'P002', patientName: '李秀英', gender: 'FEMALE', age: 55, modality: 'MR', bodyPart: '头颅', status: 'pending', state: 'SCHEDULED', urgency: 'routine', scheduledAt: new Date(Date.now() + 1800_000).toISOString() },
  { id: 'W3', accessionNumber: 'ACC003', patientId: 'P003', patientName: '王建军', gender: 'MALE', age: 45, modality: 'CT', bodyPart: '腹部', status: 'reading', state: 'IN_PROGRESS', urgency: 'critical', scheduledAt: new Date().toISOString() },
  { id: 'W5', accessionNumber: 'ACC005', patientId: 'P005', patientName: '陈国强', gender: 'MALE', age: 71, modality: 'CT', bodyPart: '心脏', status: 'reading', state: 'IN_PROGRESS', urgency: 'routine', scheduledAt: new Date().toISOString() },
]

const MOCK_SUMMARY: TodaySummary = {
  examsToday: 42, pendingExams: 12, inProgressExams: 5, criticalValues: 3,
  reportsToday: 28, signedReportsToday: 21, date: new Date().toISOString().slice(0, 10),
}

const MOCK_CRITICALS: CriticalValueItem[] = [
  { id: 'CV1', patientName: '王建军', gender: 'MALE', age: 45, description: '腹部CT示肝右叶占位，考虑恶性可能', severity: 'CRITICAL', state: 'FOUND', method: 'SYSTEM', notifiedTo: '急诊科 张医生', accessionNumber: 'ACC003', modality: 'CT', createdAt: new Date().toISOString(), ackedAt: null },
  { id: 'CV2', patientName: '陈国强', gender: 'MALE', age: 71, description: '冠脉CTA示左前降支重度狭窄', severity: 'URGENT', state: 'NOTIFIED', method: 'PHONE', notifiedTo: '心内科 李主任', accessionNumber: 'ACC005', modality: 'CT', createdAt: new Date(Date.now() - 3600_000).toISOString(), ackedAt: null },
]

const MOCK_REPORTS: LatestReportItem[] = [
  { id: 'R1', patientName: '刘芳', gender: 'FEMALE', modality: 'MR', bodyPart: '腰椎', accessionNumber: 'ACC006', state: 'SIGNED', isCritical: false, impression: '腰椎轻度退行性变', conclusion: '未见明显异常', findings: 'L4/5、L5/S1 椎间盘轻度膨出。', radiologistName: '周医生', signedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: 'R2', patientName: '王建军', gender: 'MALE', modality: 'CT', bodyPart: '腹部', accessionNumber: 'ACC003', state: 'SUBMITTED', isCritical: true, impression: '肝右叶占位待查', conclusion: '建议增强MRI进一步检查', findings: '肝右叶见类圆形低密度灶，边界欠清。', radiologistName: null, signedAt: null, createdAt: new Date().toISOString() },
]

// ── 待审批报告兜底 (reportApi 不可用时展示) ──
const MOCK_REVIEWS: ReportDto[] = [
  { id: 'REV1', reportId: 'RPT-20260815-001', patientId: 'P001', patientName: '张志刚', examId: 'E1', modality: 'CT', bodyPart: '胸部', status: '初审中', state: 'INITIAL_REVIEW', findings: '右肺上叶见磨玻璃样密度结节影，大小约 8mm，边界欠清。', impression: '右肺上叶磨玻璃结节，建议随访', createdTime: new Date().toISOString(), updatedTime: new Date().toISOString() },
  { id: 'REV2', reportId: 'RPT-20260815-002', patientId: 'P002', patientName: '李秀英', examId: 'E2', modality: 'MR', bodyPart: '头颅', status: '终审中', state: 'FINAL_REVIEW', findings: '右侧基底节区见点状缺血灶，余脑实质未见明显异常。', impression: '腔隙性脑梗死', createdTime: new Date().toISOString(), updatedTime: new Date().toISOString() },
]

const REVIEW_STATE_LABELS: Record<string, string> = {
  INITIAL_REVIEW: t('docMobile.reviewState.initial'), FINAL_REVIEW: t('docMobile.reviewState.final'), CO_SIGN_REVIEW: t('docMobile.reviewState.coSign'), REVIEWED: t('docMobile.reviewState.reviewed'),
}

const s = {
  container: { maxWidth: 420, margin: '0 auto', background: 'var(--bg-primary)', fontFamily: '-apple-system, sans-serif' },
  header: { background: 'linear-gradient(135deg, var(--color-primary-800), var(--color-primary-600))', color: '#fff', padding: '16px 16px 12px' },
  headerTitle: { fontSize: 18, fontWeight: 700 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2, 8px)', marginTop: 'var(--space-3, 12px)' },
  statCard: (bg: string) => ({ background: bg, borderRadius: 10, padding: '10px 8px', textAlign: 'center' as const }),
  statValue: { fontSize: 20, fontWeight: 800, color: 'var(--color-primary-800)' },
  statLabel: { fontSize: 12, color: 'var(--text-muted, #64748b)', marginTop: 2 },
  searchBar: { display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', background: 'var(--bg-card)', borderRadius: 10, padding: '10px 14px', margin: '12px 16px', border: '1px solid var(--border-color)' },
  tabRow: { display: 'flex', margin: '0 16px', gap: 'var(--space-1, 4px)' },
  tab: (active: boolean) => ({ flex: 1, padding: '8px 0', textAlign: 'center' as const, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: active ? 'var(--color-primary-800)' : '#94a3b8', borderBottom: active ? '2px solid var(--color-primary-800)' : '2px solid transparent' }),
  listItem: { display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' },
  badge: (color: string) => ({ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: `${color}20`, color }),
  priorityDot: (color: string) => ({ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }),
}

function currentUserName(): string {
  try {
    const raw = localStorage.getItem('ris_current_user')
    if (raw) {
      const u = JSON.parse(raw) as { name?: string; fullName?: string; id?: string }
      return u.name || u.fullName || u.id || 'mobile-doctor'
    }
  } catch { /* ignore */ }
  return 'mobile-doctor'
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

export default function DoctorMobileWorkstation() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'worklist' | 'critical' | 'reports' | 'stats' | 'approval'>('worklist')
  const [filter, setFilter] = useState<'all' | 'pending' | 'reading'>('all')
  const [search, setSearch] = useState('')
  const [worklist, setWorklist] = useState<WorklistItem[]>([])
  const [summary, setSummary] = useState<TodaySummary>({ examsToday: 0, pendingExams: 0, inProgressExams: 0, criticalValues: 0, reportsToday: 0, signedReportsToday: 0, date: '' })
  const [criticals, setCriticals] = useState<CriticalValueItem[]>([])
  const [reports, setReports] = useState<LatestReportItem[]>([])
  // [Wave7B] 待审批报告: reportApi.list({ state: INITIAL_REVIEW,FINAL_REVIEW }) + 审批 Modal
  const [pendingReviews, setPendingReviews] = useState<ReportDto[]>([])
  const [reviewTarget, setReviewTarget] = useState<ReportDto | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [failedReviewIds, setFailedReviewIds] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [usingMock, setUsingMock] = useState(false)
  const [ackingId, setAckingId] = useState<string | null>(null)
  const [pullDist, setPullDist] = useState(0)
  const startY = useRef(0)

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    const [wl, sm, cv, rp, rv] = await Promise.allSettled([
      mobileApi.getDoctorWorklist(filter !== 'all' ? { status: filter } : undefined),
      mobileApi.getDoctorStats(),
      mobileApi.getCriticalValues(),
      mobileApi.getReportsLatest(10),
      reportApi.list({ state: 'INITIAL_REVIEW,FINAL_REVIEW' }),
    ])
    let fallback = false
    if (wl.status === 'fulfilled' && wl.value.success && Array.isArray(wl.value.data)) setWorklist(wl.value.data)
    else { setWorklist(MOCK_WORKLIST); fallback = true }
    if (sm.status === 'fulfilled' && sm.value.success && sm.value.data) setSummary(sm.value.data)
    else { setSummary(MOCK_SUMMARY); fallback = true }
    if (cv.status === 'fulfilled' && cv.value.success && Array.isArray(cv.value.data)) setCriticals(cv.value.data)
    else { setCriticals(MOCK_CRITICALS); fallback = true }
    if (rp.status === 'fulfilled' && rp.value.success && Array.isArray(rp.value.data)) setReports(rp.value.data)
    else { setReports(MOCK_REPORTS); fallback = true }
    if (rv.status === 'fulfilled' && rv.value.success) {
      const raw = rv.value.data as unknown
      const items = Array.isArray(raw) ? raw : (raw as { items?: ReportDto[] } | null)?.items ?? []
      setPendingReviews(items.filter((x): x is ReportDto => !!x && typeof x === 'object'))
    } else { setPendingReviews(MOCK_REVIEWS); fallback = true }
    setUsingMock(fallback)
    if (isRefresh) setRefreshing(false); else setLoading(false)
  }, [filter])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0]?.clientY ?? 0
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const dy = (e.touches[0]?.clientY ?? startY.current) - startY.current
    if (dy > 0 && window.scrollY <= 0) setPullDist(Math.min(dy, 120))
  }, [])

  const onTouchEnd = useCallback(() => {
    if (pullDist >= 80) void loadData(true)
    setPullDist(0)
  }, [pullDist, loadData])

  const filtered = worklist.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false
    if (search && !item.patientName.includes(search) && !item.accessionNumber.includes(search)) return false
    return true
  })

  // [Wave2A] 列表项点击 → 报告书写页 (带 patientId/examId)
  // 注: 需求文档目标路由 /report/write 未在 routeTable 注册, 实际报告书写路由为 /write-report
  const handleItemClick = useCallback((item: WorklistItem) => {
    const params = new URLSearchParams()
    if (item.patientId) params.set('patientId', item.patientId)
    if (item.id) params.set('examId', item.id)
    if (item.accessionNumber) params.set('accessionNumber', item.accessionNumber)
    navigate(`/write-report?${params.toString()}`)
  }, [navigate])

  const handleAck = useCallback(async (id: string) => {
    setAckingId(id)
    try {
      const res = await mobileApi.ackCriticalValue(id, currentUserName())
      if (res.success) {
        setCriticals(prev => prev.map(c => c.id === id ? { ...c, state: 'ACKNOWLEDGED', ackedAt: new Date().toISOString(), ackedBy: currentUserName() } : c))
        message.success(t('docMobile.ackSuccess'))
      } else {
        message.error(`确认失败: ${res.error?.message ?? '未知错误'}`)
      }
    } catch {
      message.error(t('docMobile.ackFailNetwork'))
    }
    setAckingId(null)
  }, [])

  const isAcked = (c: CriticalValueItem) => c.state === 'ACKNOWLEDGED' || !!c.ackedAt

  // [Wave7B] 移动审批: 通过 reportApi.review (按当前状态自动推下一步) / 驳回 reportApi.reject
  // 失败回退: 保留卡片并标注「同步失败」, 不中断其余操作
  const handleReviewSubmit = useCallback(async (approve: boolean) => {
    if (!reviewTarget) return
    const id = reviewTarget.id
    if (!approve && !reviewComment.trim()) {
      message.warning(t('docMobile.rejectReasonRequired'))
      return
    }
    setReviewSubmitting(true)
    try {
      const res = approve ? await reportApi.review(id) : await reportApi.reject(id, reviewComment.trim())
      if (res.success) {
        setPendingReviews(prev => prev.filter(r => r.id !== id))
        setFailedReviewIds(prev => { const n = { ...prev }; delete n[id]; return n })
        setReviewTarget(null)
        setReviewComment('')
        message.success(approve ? t('docMobile.approved') : t('docMobile.rejected'))
      } else {
        setFailedReviewIds(prev => ({ ...prev, [id]: res.error?.message ?? t('docMobile.approveFail') }))
        message.error(`审批失败: ${res.error?.message ?? '未知错误'}`)
      }
    } catch (e) {
      setFailedReviewIds(prev => ({ ...prev, [id]: e instanceof Error ? e.message : t('docMobile.networkError') }))
      message.error(`审批失败: ${e instanceof Error ? e.message : t('docMobile.networkError')}`)
    } finally {
      setReviewSubmitting(false)
    }
  }, [reviewTarget, reviewComment])

  return (
    <div
      style={s.container}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {(pullDist > 0 || refreshing) && (
        <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: 'var(--text-muted, #64748b)', background: 'var(--bg-card)' }}>
          <RefreshCw size={12} style={{ display: 'inline', marginRight: 'var(--space-1, 4px)', verticalAlign: 'middle', animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
          {refreshing ? t('docMobile.refreshing') : pullDist >= 80 ? t('docMobile.releaseRefresh') : t('docMobile.pullRefresh')}
        </div>
      )}

      {usingMock && (
        <div style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)', fontSize: 12, padding: '6px 16px', textAlign: 'center' }}>
          {t('docMobile.offlineBanner')}
        </div>
      )}

      <div style={s.header}>
        <div style={s.headerTitle}>{t('docMobile.headerTitle')}</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{t('docMobile.headerSubtitle')}{summary.date ? ` · ${summary.date}` : ''}</div>
        <div style={s.statsRow}>
          <div style={s.statCard('var(--color-info-bg)')}><div style={s.statValue}>{summary.pendingExams}</div><div style={s.statLabel}>{t('docMobile.stat.pending')}</div></div>
          <div style={s.statCard('var(--color-warning-bg)')}><div style={s.statValue}>{summary.inProgressExams}</div><div style={s.statLabel}>{t('docMobile.stat.reading')}</div></div>
          <div style={s.statCard('var(--color-success-bg)')}><div style={s.statValue}>{summary.signedReportsToday}</div><div style={s.statLabel}>{t('docMobile.stat.completed')}</div></div>
          <div style={s.statCard('var(--color-error-bg)')}><div style={s.statValue}>{summary.criticalValues}</div><div style={s.statLabel}>{t('docMobile.stat.critical')}</div></div>
        </div>
      </div>

      <div style={s.searchBar}>
        <Search size={16} color="#94a3b8" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('docMobile.searchPlaceholder')} style={{ border: 'none', fontSize: 12, color: 'var(--text-primary)', width: '100%', background: 'transparent' }} />
        <Filter size={16} color="#94a3b8" style={{ cursor: 'pointer' }} />
      </div>

      <div style={s.tabRow}>
        {[{ key: 'worklist' as const, icon: ListChecks, label: t('docMobile.tab.worklist') }, { key: 'critical' as const, icon: AlertTriangle, label: t('docMobile.tab.critical') }, { key: 'approval' as const, icon: FileCheck2, label: t('docMobile.tab.approval') }, { key: 'reports' as const, icon: FileText, label: t('docMobile.tab.reports') }, { key: 'stats' as const, icon: BarChart3, label: t('docMobile.tab.stats') }].map(tb => (
          <div key={tb.key} role="button" tabIndex={0} style={s.tab(tab === tb.key)} onClick={() => setTab(tb.key)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTab(tb.key) } }}>
            <tb.icon size={14} style={{ display: 'inline', marginRight: 'var(--space-1, 4px)', verticalAlign: 'middle' }} />
            {tb.label}
            {tb.key === 'approval' && pendingReviews.length > 0 && (
              <span style={{ marginLeft: 2, background: 'var(--color-error-600)', color: '#fff', borderRadius: 8, padding: '0 5px', fontSize: 10, fontWeight: 700 }}>{pendingReviews.length}</span>
            )}
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12, 48px)', color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>{t('docMobile.loading')}</div>
      ) : tab === 'worklist' ? (
        <>
          <div style={{ display: 'flex', gap: 6, padding: '8px 16px' }}>
            {[{ key: 'all', label: t('docMobile.filter.all') }, { key: 'pending', label: t('docMobile.filter.pending') }, { key: 'reading', label: t('docMobile.filter.reading') }].map(f => (
              <div key={f.key} role="button" tabIndex={0} onClick={() => setFilter(f.key as typeof filter)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFilter(f.key as typeof filter) } }}
                style={{ padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: filter === f.key ? 'var(--color-primary-800)' : 'var(--bg-card)', color: filter === f.key ? '#fff' : '#64748b' }}>
                {f.label}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'var(--space-1, 4px)' }}>
            {filtered.map(item => (
              <div key={item.id} role="button" tabIndex={0} style={s.listItem} onClick={() => handleItemClick(item)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleItemClick(item) } }}>
                <div style={s.priorityDot(PRIORITY_COLORS[item.urgency] ?? '#64748b')} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.patientName}</span>
                    {item.urgency === 'critical' && <AlertTriangle size={12} color="var(--color-error-600)" />}
                    <span style={s.badge(PRIORITY_COLORS[item.urgency] ?? '#64748b')}>
                      {item.urgency === 'critical' ? t('docMobile.urgency.critical') : item.urgency === 'urgent' ? t('docMobile.urgency.urgent') : t('docMobile.urgency.routine')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginTop: 2, display: 'flex', gap: 'var(--space-2, 8px)' }}>
                    <span>{item.gender}/{item.age ?? '-'}{t('docMobile.yearsOld')}</span>
                    <span>{item.modality}</span>
                    <span>{item.bodyPart}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginTop: 1 }}>{item.accessionNumber} · {t('docMobile.appointment')} {formatTime(item.scheduledAt)}</div>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <span style={s.badge(STATUS_LABELS[item.status] === t('docMobile.status.reported') ? '#059669' : 'var(--color-warning-600)')}>{STATUS_LABELS[item.status] ?? item.state}</span>
                </div>
                <ChevronRight size={14} color="#cbd5e1" />
              </div>
            ))}
            {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 'var(--space-10, 40px)', color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>{t('docMobile.noWorkItems')}</div>}
          </div>
        </>
      ) : tab === 'critical' ? (
        <div style={{ padding: 'var(--space-4, 16px)' }}>
          {criticals.map(c => (
            <div key={c.id} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${c.severity === 'CRITICAL' ? 'var(--color-error-border)' : 'var(--color-warning-border)'}`, borderLeft: `4px solid ${c.severity === 'CRITICAL' ? 'var(--color-error-600)' : 'var(--color-warning-600)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{c.patientName}</span>
                <span style={s.badge(c.severity === 'CRITICAL' ? 'var(--color-error-600)' : 'var(--color-warning-600)')}>
                  {c.severity === 'CRITICAL' ? t('docMobile.urgency.critical') : c.severity === 'URGENT' ? t('docMobile.urgency.urgent') : c.severity}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{c.modality ?? ''} {c.accessionNumber ?? ''}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{c.description}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{formatTime(c.createdAt)} · {c.notifiedTo ?? t('docMobile.notNotified')}</span>
                {isAcked(c) ? (
                  <span style={{ color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                    <CheckCircle size={14} /> {t('docMobile.confirmed')}
                  </span>
                ) : (
                  <button
                    onClick={() => handleAck(c.id)}
                    disabled={ackingId === c.id}
                    style={{ padding: '4px 14px', borderRadius: 6, border: 'none', background: 'var(--color-error-600)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: ackingId === c.id ? 0.6 : 1 }}
                  >
                    {ackingId === c.id ? t('docMobile.confirming') : t('docMobile.ackReceive')}
                  </button>
                )}
              </div>
            </div>
          ))}
          {criticals.length === 0 && <div style={{ textAlign: 'center', padding: 'var(--space-10, 40px)', color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>{t('docMobile.noCriticals')}</div>}
        </div>
      ) : tab === 'reports' ? (
        <div style={{ padding: 'var(--space-4, 16px)' }}>
          {reports.map(r => (
            <div key={r.id} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{r.patientName}</span>
                {r.isCritical && <span style={s.badge('var(--color-error-600)')}>{t('docMobile.urgency.critical')}</span>}
                <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{r.modality ?? ''} {r.bodyPart ?? ''}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{r.impression || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>{r.radiologistName ? `${r.radiologistName} 报告` : '报告撰写中'}</span>
                <span>{formatTime(r.signedAt ?? r.createdAt)}</span>
              </div>
            </div>
          ))}
          {reports.length === 0 && <div style={{ textAlign: 'center', padding: 'var(--space-10, 40px)', color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>{t('docMobile.noReports')}</div>}
        </div>
      ) : tab === 'approval' ? (
        <div style={{ padding: 'var(--space-4, 16px)' }}>
          {pendingReviews.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 10, display: 'flex', gap: 'var(--space-2, 8px)', flexWrap: 'wrap' }}>
              {pendingReviews.map(r => (
                <span key={`badge-${r.id}`} style={s.badge(r.state === 'FINAL_REVIEW' ? '#7c3aed' : 'var(--color-warning-600)')}>{REVIEW_STATE_LABELS[r.state ?? ''] ?? r.state ?? r.status}</span>
              ))}
            </div>
          )}
          {pendingReviews.map(r => (
            <div key={r.id} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid var(--border-color)', borderLeft: `4px solid ${r.state === 'FINAL_REVIEW' ? '#7c3aed' : 'var(--color-warning-600)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{r.patientName}</span>
                <span style={s.badge(r.state === 'FINAL_REVIEW' ? '#7c3aed' : 'var(--color-warning-600)')}>{REVIEW_STATE_LABELS[r.state ?? ''] ?? r.state ?? r.status}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{r.modality} {r.bodyPart}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginTop: 'var(--space-1, 4px)' }}>{r.reportId} · {formatTime(r.updatedTime ?? r.createdTime)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5, WebkitLineClamp: 2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>
                {r.impression || r.diagnosis || r.findings || t('docMobile.noDescription')}
              </div>
              {failedReviewIds[r.id] && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-error-600)', background: 'var(--color-error-bg)', borderRadius: 6, padding: '4px 8px' }}>
                  {t('docMobile.reviewSyncFail', { reason: failedReviewIds[r.id] })}
                </div>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', marginTop: 10 }}>
                <button
                  onClick={() => setReviewTarget(r)}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >{t('docMobile.reviewAction')}</button>
              </div>
            </div>
          ))}
          {pendingReviews.length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--space-12, 48px)', color: 'var(--text-muted, #94a3b8)', fontSize: 12, background: 'var(--bg-card)', borderRadius: 12 }}>
              <CheckCircle size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
              {t('docMobile.noReviews')}
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: 'var(--space-4, 16px)' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-3, 12px)' }}>{t('docMobile.statsTitle', { date: summary.date })}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3, 12px)' }}>
              {[
                { label: t('docMobile.stat2.todayExam'), value: `${summary.examsToday}例`, color: 'var(--color-primary-600)' },
                { label: t('docMobile.stat2.todayReport'), value: `${summary.reportsToday}份`, color: '#059669' },
                { label: t('docMobile.stat2.signed'), value: `${summary.signedReportsToday}份`, color: '#7c3aed' },
                { label: t('docMobile.stat.critical'), value: `${summary.criticalValues}个`, color: 'var(--color-error-600)' },
                { label: t('docMobile.stat2.pendingExam'), value: `${summary.pendingExams}例`, color: 'var(--color-warning-600)' },
                { label: t('docMobile.stat2.inProgress'), value: `${summary.inProgressExams}例`, color: 'var(--color-info-600)' },
              ].map(stat => (
                <div key={stat.label} style={{ padding: 'var(--space-3, 12px)', background: 'var(--bg-card)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{stat.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: stat.color, marginTop: 'var(--space-1, 4px)' }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 0, display: 'flex', background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', padding: '6px 0' }}>
        {[
          { key: 'worklist', icon: ListChecks, label: t('docMobile.nav.workbench') },
          { key: 'viewer', icon: Image, label: t('docMobile.nav.viewer') },
          { key: 'input', icon: Mic, label: t('docMobile.nav.input') },
          { key: 'bell', icon: Bell, label: t('docMobile.nav.bell') },
        ].map(nav => (
          <div key={nav.key} style={{ flex: 1, textAlign: 'center', padding: '4px 0', fontSize: 12, color: tab === nav.key ? 'var(--color-primary-800)' : '#94a3b8', cursor: 'pointer', fontWeight: tab === nav.key ? 700 : 400 }}>
            <nav.icon size={18} style={{ display: 'block', margin: '0 auto 2px' }} />
            {nav.label}
          </div>
        ))}
      </div>

      {/* [Wave7B] 移动报告审批 Modal: 通过 / 驳回 + 原因 */}
      {reviewTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => { if (!reviewSubmitting) setReviewTarget(null) }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 14, width: '90%', maxWidth: 420, padding: 'var(--space-5, 20px)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3, 12px)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{t('docMobile.reviewModalTitle')}</div>
              <button onClick={() => setReviewTarget(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted, #94a3b8)', padding: 'var(--space-1, 4px)' }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-3, 12px)' }}>
              <div><strong>{reviewTarget.patientName}</strong> · {reviewTarget.modality} {reviewTarget.bodyPart}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>{reviewTarget.reportId} · {REVIEW_STATE_LABELS[reviewTarget.state ?? ''] ?? reviewTarget.state ?? reviewTarget.status}</div>
              <div style={{ marginTop: 6, padding: 'var(--space-2, 8px)', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                {reviewTarget.impression || reviewTarget.diagnosis || reviewTarget.findings || t('docMobile.noDescription')}
              </div>
            </div>
            <div style={{ marginBottom: 'var(--space-3, 12px)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)', marginBottom: 6 }}>{t('docMobile.rejectReasonLabel')}</div>
              <textarea
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder={t('docMobile.rejectPlaceholder')}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, resize: 'none', boxSizing: 'border-box', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => void handleReviewSubmit(false)}
                disabled={reviewSubmitting}
                style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: '1px solid #fecaca', background: 'var(--bg-card)', color: 'var(--color-error-600)', fontSize: 12, fontWeight: 700, cursor: reviewSubmitting ? 'wait' : 'pointer' }}
              >{reviewSubmitting ? t('docMobile.submitting') : t('docMobile.reject')}</button>
              <button
                onClick={() => void handleReviewSubmit(true)}
                disabled={reviewSubmitting}
                style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: 12, fontWeight: 700, cursor: reviewSubmitting ? 'wait' : 'pointer' }}
              >{reviewSubmitting ? t('docMobile.submitting') : t('docMobile.approve')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
