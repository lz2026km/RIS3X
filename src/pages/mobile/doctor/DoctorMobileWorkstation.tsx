import { useState, useEffect, useCallback, useRef } from 'react'
import { message } from 'antd'
import { Search, Filter, ChevronRight, Bell, AlertTriangle, ListChecks, Image, Mic, BarChart3, FileText, RefreshCw, CheckCircle } from 'lucide-react'
import {
  mobileApi,
  type WorklistItem,
  type TodaySummary,
  type CriticalValueItem,
  type LatestReportItem,
} from '../../../services/api'

export { type DoctorWorklistItem, type DoctorStats } from '../../../services/api'

const PRIORITY_COLORS: Record<string, string> = {
  routine: '#64748b',
  urgent: '#d97706',
  critical: '#dc2626',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待报告',
  reading: '报告中',
  reported: '已报告',
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

const s = {
  container: { maxWidth: 420, margin: '0 auto', background: '#f8fafc', minHeight: '100vh', fontFamily: '-apple-system, sans-serif' },
  header: { background: 'linear-gradient(135deg, #1e3a5f, #2d4a6f)', color: '#fff', padding: '16px 16px 12px' },
  headerTitle: { fontSize: 18, fontWeight: 700 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 },
  statCard: (bg: string) => ({ background: bg, borderRadius: 10, padding: '10px 8px', textAlign: 'center' as const }),
  statValue: { fontSize: 20, fontWeight: 800, color: '#1e3a5f' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  searchBar: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 10, padding: '10px 14px', margin: '12px 16px', border: '1px solid #e2e8f0' },
  tabRow: { display: 'flex', margin: '0 16px', gap: 4 },
  tab: (active: boolean) => ({ flex: 1, padding: '8px 0', textAlign: 'center' as const, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: active ? '#1e3a5f' : '#94a3b8', borderBottom: active ? '2px solid #1e3a5f' : '2px solid transparent' }),
  listItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' },
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
  const [tab, setTab] = useState<'worklist' | 'critical' | 'reports' | 'stats'>('worklist')
  const [filter, setFilter] = useState<'all' | 'pending' | 'reading'>('all')
  const [search, setSearch] = useState('')
  const [worklist, setWorklist] = useState<WorklistItem[]>([])
  const [summary, setSummary] = useState<TodaySummary>({ examsToday: 0, pendingExams: 0, inProgressExams: 0, criticalValues: 0, reportsToday: 0, signedReportsToday: 0, date: '' })
  const [criticals, setCriticals] = useState<CriticalValueItem[]>([])
  const [reports, setReports] = useState<LatestReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [usingMock, setUsingMock] = useState(false)
  const [ackingId, setAckingId] = useState<string | null>(null)
  const [pullDist, setPullDist] = useState(0)
  const startY = useRef(0)

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    const [wl, sm, cv, rp] = await Promise.allSettled([
      mobileApi.getWorklist(filter !== 'all' ? { status: filter } : undefined),
      mobileApi.getTodaySummary(),
      mobileApi.getCriticalValues(),
      mobileApi.getReportsLatest(10),
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

  const handleItemClick = useCallback((_item: WorklistItem) => {
    message.info('该功能暂不可用')
  }, [])

  const handleAck = useCallback(async (id: string) => {
    setAckingId(id)
    try {
      const res = await mobileApi.ackCriticalValue(id, currentUserName())
      if (res.success) {
        setCriticals(prev => prev.map(c => c.id === id ? { ...c, state: 'ACKNOWLEDGED', ackedAt: new Date().toISOString(), ackedBy: currentUserName() } : c))
        message.success('危急值已确认')
      } else {
        message.error(`确认失败: ${res.error?.message ?? '未知错误'}`)
      }
    } catch {
      message.error('确认失败: 网络错误')
    }
    setAckingId(null)
  }, [])

  const isAcked = (c: CriticalValueItem) => c.state === 'ACKNOWLEDGED' || !!c.ackedAt

  return (
    <div
      style={s.container}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {(pullDist > 0 || refreshing) && (
        <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: '#64748b', background: '#e2e8f0' }}>
          <RefreshCw size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
          {refreshing ? '刷新中...' : pullDist >= 80 ? '松开刷新' : '下拉刷新'}
        </div>
      )}

      {usingMock && (
        <div style={{ background: '#fef3c7', color: '#92400e', fontSize: 12, padding: '6px 16px', textAlign: 'center' }}>
          ⚠ 后端不可用，当前展示离线演示数据
        </div>
      )}

      <div style={s.header}>
        <div style={s.headerTitle}>医生移动工作站</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>放射科 · 诊断工作台{summary.date ? ` · ${summary.date}` : ''}</div>
        <div style={s.statsRow}>
          <div style={s.statCard('#dbeafe')}><div style={s.statValue}>{summary.pendingExams}</div><div style={s.statLabel}>待报告</div></div>
          <div style={s.statCard('#fef3c7')}><div style={s.statValue}>{summary.inProgressExams}</div><div style={s.statLabel}>报告中</div></div>
          <div style={s.statCard('#d1fae5')}><div style={s.statValue}>{summary.signedReportsToday}</div><div style={s.statLabel}>今日完成</div></div>
          <div style={s.statCard('#fee2e2')}><div style={s.statValue}>{summary.criticalValues}</div><div style={s.statLabel}>危急值</div></div>
        </div>
      </div>

      <div style={s.searchBar}>
        <Search size={16} color="#94a3b8" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索患者、Accession号..." style={{ border: 'none', outline: 'none', fontSize: 13, color: '#334155', width: '100%', background: 'transparent' }} />
        <Filter size={16} color="#94a3b8" style={{ cursor: 'pointer' }} />
      </div>

      <div style={s.tabRow}>
        {[{ key: 'worklist' as const, icon: ListChecks, label: '工作列表' }, { key: 'critical' as const, icon: AlertTriangle, label: '危急值' }, { key: 'reports' as const, icon: FileText, label: '报告' }, { key: 'stats' as const, icon: BarChart3, label: '统计' }].map(t => (
          <div key={t.key} style={s.tab(tab === t.key)} onClick={() => setTab(t.key)}>
            <t.icon size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            {t.label}
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', fontSize: 13 }}>加载中...</div>
      ) : tab === 'worklist' ? (
        <>
          <div style={{ display: 'flex', gap: 6, padding: '8px 16px' }}>
            {[{ key: 'all', label: '全部' }, { key: 'pending', label: '待报告' }, { key: 'reading', label: '报告中' }].map(f => (
              <div key={f.key} onClick={() => setFilter(f.key as typeof filter)}
                style={{ padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: filter === f.key ? '#1e3a5f' : '#f1f5f9', color: filter === f.key ? '#fff' : '#64748b' }}>
                {f.label}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 4 }}>
            {filtered.map(item => (
              <div key={item.id} style={s.listItem} onClick={() => handleItemClick(item)}>
                <div style={s.priorityDot(PRIORITY_COLORS[item.urgency] ?? '#64748b')} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{item.patientName}</span>
                    {item.urgency === 'critical' && <AlertTriangle size={12} color="#dc2626" />}
                    <span style={s.badge(PRIORITY_COLORS[item.urgency] ?? '#64748b')}>
                      {item.urgency === 'critical' ? '危急' : item.urgency === 'urgent' ? '紧急' : '普通'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 8 }}>
                    <span>{item.gender}/{item.age ?? '-'}岁</span>
                    <span>{item.modality}</span>
                    <span>{item.bodyPart}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{item.accessionNumber} · 预约 {formatTime(item.scheduledAt)}</div>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <span style={s.badge(STATUS_LABELS[item.status] === '已报告' ? '#059669' : '#d97706')}>{STATUS_LABELS[item.status] ?? item.state}</span>
                </div>
                <ChevronRight size={14} color="#cbd5e1" />
              </div>
            ))}
            {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>暂无工作项</div>}
          </div>
        </>
      ) : tab === 'critical' ? (
        <div style={{ padding: 16 }}>
          {criticals.map(c => (
            <div key={c.id} style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${c.severity === 'CRITICAL' ? '#fca5a5' : '#fcd34d'}`, borderLeft: `4px solid ${c.severity === 'CRITICAL' ? '#dc2626' : '#d97706'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{c.patientName}</span>
                <span style={s.badge(c.severity === 'CRITICAL' ? '#dc2626' : '#d97706')}>
                  {c.severity === 'CRITICAL' ? '危急' : c.severity === 'URGENT' ? '紧急' : c.severity}
                </span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{c.modality ?? ''} {c.accessionNumber ?? ''}</span>
              </div>
              <div style={{ fontSize: 13, color: '#334155', marginTop: 6, lineHeight: 1.5 }}>{c.description}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{formatTime(c.createdAt)} · {c.notifiedTo ?? '未通知'}</span>
                {isAcked(c) ? (
                  <span style={{ color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={14} /> 已确认
                  </span>
                ) : (
                  <button
                    onClick={() => handleAck(c.id)}
                    disabled={ackingId === c.id}
                    style={{ padding: '4px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: ackingId === c.id ? 0.6 : 1 }}
                  >
                    {ackingId === c.id ? '确认中...' : '确认接收'}
                  </button>
                )}
              </div>
            </div>
          ))}
          {criticals.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>暂无危急值</div>}
        </div>
      ) : tab === 'reports' ? (
        <div style={{ padding: 16 }}>
          {reports.map(r => (
            <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{r.patientName}</span>
                {r.isCritical && <span style={s.badge('#dc2626')}>危急</span>}
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{r.modality ?? ''} {r.bodyPart ?? ''}</span>
              </div>
              <div style={{ fontSize: 13, color: '#334155', marginTop: 6, lineHeight: 1.5 }}>{r.impression || '—'}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>{r.radiologistName ? `${r.radiologistName} 报告` : '报告撰写中'}</span>
                <span>{formatTime(r.signedAt ?? r.createdAt)}</span>
              </div>
            </div>
          ))}
          {reports.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>暂无报告</div>}
        </div>
      ) : (
        <div style={{ padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>今日工作统计 ({summary.date})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {[
                { label: '今日检查', value: `${summary.examsToday}例`, color: '#2563eb' },
                { label: '今日报告', value: `${summary.reportsToday}份`, color: '#059669' },
                { label: '已签发', value: `${summary.signedReportsToday}份`, color: '#7c3aed' },
                { label: '危急值', value: `${summary.criticalValues}个`, color: '#dc2626' },
                { label: '待检查', value: `${summary.pendingExams}例`, color: '#d97706' },
                { label: '检查中', value: `${summary.inProgressExams}例`, color: '#0891b2' },
              ].map(stat => (
                <div key={stat.label} style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{stat.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: stat.color, marginTop: 4 }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 0, display: 'flex', background: '#fff', borderTop: '1px solid #e2e8f0', padding: '6px 0' }}>
        {[
          { key: 'worklist', icon: ListChecks, label: '工作台' },
          { key: 'viewer', icon: Image, label: '阅片' },
          { key: 'input', icon: Mic, label: '报告' },
          { key: 'bell', icon: Bell, label: '消息' },
        ].map(nav => (
          <div key={nav.key} style={{ flex: 1, textAlign: 'center', padding: '4px 0', fontSize: 12, color: tab === nav.key ? '#1e3a5f' : '#94a3b8', cursor: 'pointer', fontWeight: tab === nav.key ? 700 : 400 }}>
            <nav.icon size={18} style={{ display: 'block', margin: '0 auto 2px' }} />
            {nav.label}
          </div>
        ))}
      </div>
    </div>
  )
}
