import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts'
import { ChartContainer } from '../../components/charts'
import { StateView } from '../../components/common/StateView'
import { DataTable } from '../../components/common/DataTable'
import { Users, Search, TrendingUp, Award, Clock, CheckCircle, XCircle } from 'lucide-react'
// [W2-A] 人员名册/工作量接 userApi 实时; 排班/满意度趋势无数据源 → 标注演示数据
import { userApi } from '../../services/api/userApi'
import { t } from '../../i18n/appI18n'

interface Staff {
  id: string; name: string; role: string; department: string; status: 'active' | 'leave' | 'training'
  shift: string; examsThisWeek: number; overtimeHrs: number; certification: string; satisfaction: number
}

const ROLES = ['放射科医师', '技师', '护士', '行政人员']

const MOCK_STAFF: Staff[] = [
  { id: 'S001', name: '张伟', role: '放射科医师', department: 'CT组', status: 'active', shift: '白班', examsThisWeek: 48, overtimeHrs: 2, certification: '放射医师中级', satisfaction: 88 },
  { id: 'S002', name: '李静', role: '技师', department: 'MRI组', status: 'active', shift: '白班', examsThisWeek: 45, overtimeHrs: 0, certification: '大型设备上岗证', satisfaction: 92 },
  { id: 'S003', name: '王强', role: '技师', department: 'X线组', status: 'active', shift: '夜班', examsThisWeek: 42, overtimeHrs: 8, certification: '放射技师', satisfaction: 75 },
  { id: 'S004', name: '赵敏', role: '护士', department: '造影室', status: 'leave', shift: '白班', examsThisWeek: 0, overtimeHrs: 0, certification: '护士执业证', satisfaction: 85 },
  { id: 'S005', name: '刘洋', role: '技师', department: 'CT组', status: 'active', shift: '白班', examsThisWeek: 50, overtimeHrs: 3, certification: '大型设备上岗证', satisfaction: 90 },
  { id: 'S006', name: '陈晓燕', role: '放射科医师', department: 'MRI组', status: 'active', shift: '白班', examsThisWeek: 38, overtimeHrs: 1, certification: '放射医师中级', satisfaction: 87 },
  { id: 'S007', name: '张志明', role: '技师', department: '超声组', status: 'training', shift: '白班', examsThisWeek: 12, overtimeHrs: 0, certification: '超声技师', satisfaction: 80 },
  { id: 'S008', name: '周芳', role: '行政人员', department: '科室办公室', status: 'active', shift: '白班', examsThisWeek: 0, overtimeHrs: 0, certification: '—', satisfaction: 95 },
]

const SATISFACTION_TREND = [
  { month: '1月', satisfaction: 78 },
  { month: '2月', satisfaction: 82 },
  { month: '3月', satisfaction: 80 },
  { month: '4月', satisfaction: 85 },
  { month: '5月', satisfaction: 88 },
  { month: '6月', satisfaction: 86 },
]

const SHIFT_GRID = [
  { day: '周一', '白班': '张伟, 李静, 赵敏', '夜班': '王强', '备班': '刘洋' },
  { day: '周二', '白班': '刘洋, 陈晓燕, 周芳', '夜班': '王强', '备班': '张伟' },
  { day: '周三', '白班': '张伟, 李静, 周芳', '夜班': '张志明', '备班': '陈晓燕' },
  { day: '周四', '白班': '刘洋, 陈晓燕, 赵敏', '夜班': '王强', '备班': '李静' },
  { day: '周五', '白班': '张伟, 刘洋, 周芳', '夜班': '张志明', '备班': '陈晓燕' },
]

const CERTIFICATIONS = [
  { staff: '张伟', cert: '放射医师中级', expiry: '2027-03-15', status: 'valid' },
  { staff: '李静', cert: '大型设备(MRI)上岗证', expiry: '2025-08-20', status: 'expiring' },
  { staff: '王强', cert: '放射技师', expiry: '2026-11-01', status: 'valid' },
  { staff: '刘洋', cert: '大型设备(CT)上岗证', expiry: '2025-07-01', status: 'expiring' },
]

export default function HrOperationsPage() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [view, setView] = useState<'roster' | 'shift' | 'certs'>('roster')
  // [W2-A] userApi 实时状态 (失败回退静态演示数据)
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'api' | 'demo'>('demo')
  const [apiError, setApiError] = useState('')
  const [staff, setStaff] = useState<Staff[]>(MOCK_STAFF)
  const [roles, setRoles] = useState<string[]>(ROLES)
  const [certRows, setCertRows] = useState(CERTIFICATIONS)

  const toNum = (v: unknown): number => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  const loadStaff = useCallback(async () => {
    setLoading(true)
    setApiError('')
    try {
      const res = await userApi.list(0, 100)
      const users = res.success && Array.isArray(res.data) ? res.data : []
      if (users.length === 0) {
        setDataSource('demo')
        setApiError(t('hrOps.apiUnavailable'))
        return
      }
      setDataSource('api')
      const mapped: Staff[] = users.map((u: any) => ({
        id: u.id,
        name: u.name || u.fullName || u.username || '—',
        role: u.title || u.role || t('hrOps.physicianFallback'),
        department: u.subspecialty || u.department || '—',
        status: u.isActive === false ? 'leave' : 'active',
        shift: u.schedule || '白班',
        examsThisWeek: toNum(u.monthlyExamCount ?? u.monthlyReportCount),
        overtimeHrs: 0,
        certification: Array.isArray(u.certifications) && u.certifications.length > 0 ? u.certifications[0] : '—',
        satisfaction: toNum(u.annualQCScore) || 80,
      }))
      setStaff(mapped)
      const uniqRoles = [...new Set(mapped.map(s => s.role).filter(Boolean))]
      if (uniqRoles.length > 0) setRoles(uniqRoles)
      const certs = mapped
        .filter(s => s.certification && s.certification !== '—')
        .map(s => ({ staff: s.name, cert: s.certification, expiry: t('hrOps.longTermDemo'), status: 'valid' as const }))
      if (certs.length > 0) setCertRows(certs)
    } catch (e) {
      setDataSource('demo')
      setApiError(e instanceof Error ? e.message : t('hrOps.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadStaff() }, [loadStaff])

  const filtered = staff.filter(s => {
    if (roleFilter !== 'all' && s.role !== roleFilter) return false
    if (search && !s.name.includes(search)) return false
    return true
  })

  const prodData = staff.filter(s => s.role !== '行政人员' && s.status === 'active').map(s => ({
    name: s.name, examsThisWeek: s.examsThisWeek,
  }))

  const staffColumns = [
    {
      title: t('hrOps.colName'), dataIndex: 'name', key: 'name',
      render: (v: string) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={14} color="#3b82f6" />
          <span>{v}</span>
        </span>
      ),
    },
    { title: t('hrOps.colRole'), dataIndex: 'role', key: 'role', render: (v: string) => <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
    {
      title: t('hrOps.colTeam'), key: 'status',
      render: (_: unknown, s: Staff) => (
        <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: s.status === 'active' ? '#22c55e' : s.status === 'leave' ? '#ef4444' : '#f59e0b' }}>
          {s.status === 'active' ? <CheckCircle size={12} /> : s.status === 'leave' ? <XCircle size={12} /> : <Clock size={12} />}
          {s.status === 'active' ? t('hrOps.statusActive') : s.status === 'leave' ? t('hrOps.statusLeave') : t('hrOps.statusTraining')}
        </span>
      ),
    },
    { title: t('hrOps.colShift'), dataIndex: 'shift', key: 'shift', render: (v: string) => <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
    { title: t('hrOps.colWeeklyExams'), dataIndex: 'examsThisWeek', key: 'examsThisWeek', render: (v: number) => <strong style={{ color: 'var(--text-primary, #f0f6fc)' }}>{v}</strong> },
    { title: t('hrOps.colOvertime'), dataIndex: 'overtimeHrs', key: 'overtimeHrs', render: (v: number) => <span style={{ color: v > 5 ? '#ef4444' : 'var(--text-muted, #8b949e)' }}>{v}</span> },
  ]

  return (
    <div style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Users size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>{t('hrOps.title')}</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{t('hrOps.onDuty', { active: staff.filter(s => s.status === 'active').length, total: staff.length })} · {dataSource === 'api' ? t('hrOps.apiRealtime') : t('hrOps.demoData')}</span>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999,
            background: dataSource === 'api' ? 'rgba(34,197,94,0.13)' : 'rgba(245,158,11,0.13)', color: dataSource === 'api' ? 'var(--color-success-500, #22c55e)' : 'var(--color-warning-500, #f59e0b)', fontWeight: 600,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dataSource === 'api' ? 'var(--color-success-500, #22c55e)' : 'var(--color-warning-500, #f59e0b)' }} />
            {loading ? t('hrOps.syncing') : dataSource === 'api' ? t('hrOps.dataSourceApi') : t('hrOps.dataSourceDemo')}
          </span>
          {apiError && (
            <span style={{ color: 'var(--color-error-500, #ef4444)' }}>
              {apiError}
              <button onClick={() => void loadStaff()} style={{ marginLeft: 8, padding: '2px 10px', borderRadius: 4, border: '1px solid var(--color-error-500, #ef4444)', background: 'transparent', color: 'var(--color-error-500, #ef4444)', cursor: 'pointer', fontSize: 12 }}>{t('hrOps.retry')}</button>
            </span>
          )}
          <span style={{ color: 'var(--text-muted, #8b949e)' }}>{t('hrOps.builtinDemoNote')}</span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-secondary, #21262d)', padding: 4, borderRadius: 8 }}>
          {(['roster', 'shift', 'certs'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: view === v ? '#1e40af' : 'transparent', color: view === v ? '#fff' : 'var(--text-muted, #8b949e)' }}>
              {v === 'roster' ? t('hrOps.tabRoster') : v === 'shift' ? t('hrOps.tabShift') : t('hrOps.tabCerts')}
            </button>
          ))}
        </div>

        {view === 'roster' && (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              {['all', ...roles].map(r => (
                <button key={r} onClick={() => setRoleFilter(r)}
                  style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: roleFilter === r ? '#1e40af' : 'var(--bg-secondary, #21262d)', color: roleFilter === r ? '#fff' : 'var(--text-muted, #8b949e)' }}>
                  {r === 'all' ? t('hrOps.all') : r}
                </button>
              ))}
              <div style={{ position: 'relative', marginLeft: 'auto' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#6e7681' }} />
                <input placeholder={t('hrOps.searchName')} value={search} onChange={e => setSearch(e.target.value)}
                  style={{ padding: '6px 12px 6px 32px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-card, #161b22)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12, width: 180 }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary, #f0f6fc)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={16} color="#22c55e" />{t('hrOps.weeklyWorkload')} {dataSource === 'api' && <span style={{ fontSize: 11, color: '#22c55e' }}>{t('hrOps.apiRealtimeTag')}</span>}
                </div>
                <ChartContainer height={220} state={prodData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('hrOps.noWorkload')}>
                  <BarChart data={prodData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default, #30363d)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, fontSize: 12 }} />
                    <Bar dataKey="examsThisWeek" fill="#22c55e" radius={[4, 4, 0, 0]} name={t('hrOps.examVolume')} />
                  </BarChart>
                </ChartContainer>
              </div>

              <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary, #f0f6fc)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={16} color="#8b5cf6" />{t('hrOps.satisfactionTrend')} <span style={{ fontSize: 11, color: '#f59e0b' }}>{t('hrOps.demoTag')}</span>
                </div>
                <ChartContainer height={220} state={SATISFACTION_TREND.length === 0 ? 'empty' : 'ready'} emptyDescription={t('hrOps.noSatisfaction')}>
                  <LineChart data={SATISFACTION_TREND}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default, #30363d)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                    <YAxis domain={[60, 100]} tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`${v}`, t('hrOps.satisfaction')]} />
                    <Line type="monotone" dataKey="satisfaction" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} name={t('hrOps.satisfaction')} />
                  </LineChart>
                </ChartContainer>
              </div>
            </div>

            <StateView empty={filtered.length === 0} emptyDescription={t('w2d.empty')}>
            <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, overflow: 'hidden' }}>
              <DataTable
                dataSource={filtered}
                rowKey="id"
                columns={staffColumns}
                pagination={{ pageSize: 10, showSizeChanger: false }}
                emptyText={t('w2d.empty')}
                expandable={{
                  expandedRowKeys: expandedId ? [expandedId] : [],
                  onExpand: (expanded, record) => setExpandedId(expanded ? (record as Staff).id : null),
                  expandedRowRender: (record) => {
                    const s = record as Staff
                    return (
                      <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
                        <div><span style={{ color: '#6e7681' }}>{t('hrOps.certificationLabel')} </span><span>{s.certification}</span></div>
                        <div><span style={{ color: '#6e7681' }}>{t('hrOps.satisfactionLabel')} </span><span style={{ color: s.satisfaction >= 85 ? '#22c55e' : '#f59e0b' }}>{s.satisfaction}%</span></div>
                      </div>
                    )
                  },
                }}
              />
            </div>
            </StateView>
          </>
        )}

        {view === 'shift' && (
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary, #f0f6fc)' }}>{t('hrOps.weeklyShift')} <span style={{ fontSize: 11, color: '#f59e0b' }}>{t('hrOps.demoTag')}</span></div>
            <DataTable
              dataSource={SHIFT_GRID}
              rowKey="day"
              pagination={false}
              columns={[
                { title: t('hrOps.colDate'), dataIndex: 'day', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
                { title: t('hrOps.dayShift'), dataIndex: '白班', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
                { title: t('hrOps.nightShift'), dataIndex: '夜班', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
                { title: t('hrOps.backupShift'), dataIndex: '备班', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
              ]}
            />
          </div>
        )}

        {view === 'certs' && (
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary, #f0f6fc)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={16} color="#f59e0b" />{t('hrOps.certExpiry')} {dataSource === 'api' && <span style={{ fontSize: 11, color: '#22c55e' }}>{t('hrOps.certExpiryTag')}</span>}
            </div>
            <DataTable
              dataSource={certRows}
              rowKey={(c, i) => `${c.staff}-${i ?? 0}`}
              pagination={false}
              columns={[
                { title: t('hrOps.colName'), dataIndex: 'staff' },
                { title: t('hrOps.colCert'), dataIndex: 'cert', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
                { title: t('hrOps.colExpiry'), dataIndex: 'expiry', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
                {
                  title: t('hrOps.colStatus'), dataIndex: 'status',
                  render: (v: string) => (
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: v === 'valid' ? '#22c55e20' : '#f59e0b20', color: v === 'valid' ? '#22c55e' : '#f59e0b' }}>
                      {v === 'valid' ? t('hrOps.certValid') : t('hrOps.certExpiring')}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  )
}
