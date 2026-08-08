import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { Users, Search, TrendingUp, Award, Clock, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react'
// [W2-A] 人员名册/工作量接 userApi 实时; 排班/满意度趋势无数据源 → 标注演示数据
import { userApi } from '../../services/api/userApi'

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
        setApiError('userApi 暂不可用，当前展示内置演示数据')
        return
      }
      setDataSource('api')
      const mapped: Staff[] = users.map((u: any) => ({
        id: u.id,
        name: u.name || u.fullName || u.username || '—',
        role: u.title || u.role || '医师',
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
        .map(s => ({ staff: s.name, cert: s.certification, expiry: '长期有效(演示)', status: 'valid' as const }))
      if (certs.length > 0) setCertRows(certs)
    } catch (e) {
      setDataSource('demo')
      setApiError(e instanceof Error ? e.message : '数据加载失败，已回退演示数据')
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

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Users size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>人力资源运营</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>在岗 {staff.filter(s => s.status === 'active').length}/{staff.length} · {dataSource === 'api' ? 'userApi 实时' : '演示数据'}</span>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999,
            background: dataSource === 'api' ? '#22c55e20' : '#f59e0b20', color: dataSource === 'api' ? '#22c55e' : '#f59e0b', fontWeight: 600,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dataSource === 'api' ? '#22c55e' : '#f59e0b' }} />
            {loading ? '数据同步中...' : dataSource === 'api' ? '数据源: userApi 实时 (人员/工作量/资质)' : '数据源: 演示数据'}
          </span>
          {apiError && (
            <span style={{ color: '#ef4444' }}>
              {apiError}
              <button onClick={() => void loadStaff()} style={{ marginLeft: 8, padding: '2px 10px', borderRadius: 4, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>重试</button>
            </span>
          )}
          <span style={{ color: '#8b949e' }}>排班表/满意度趋势为内置演示数据</span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#21262d', padding: 4, borderRadius: 8 }}>
          {(['roster', 'shift', 'certs'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: view === v ? '#1e40af' : 'transparent', color: view === v ? '#fff' : '#8b949e' }}>
              {v === 'roster' ? '人员名册' : v === 'shift' ? '排班管理' : '资质证书'}
            </button>
          ))}
        </div>

        {view === 'roster' && (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              {['all', ...roles].map(r => (
                <button key={r} onClick={() => setRoleFilter(r)}
                  style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: roleFilter === r ? '#1e40af' : '#21262d', color: roleFilter === r ? '#fff' : '#8b949e' }}>
                  {r === 'all' ? '全部' : r}
                </button>
              ))}
              <div style={{ position: 'relative', marginLeft: 'auto' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#6e7681' }} />
                <input placeholder="搜索姓名..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ padding: '6px 12px 6px 32px', borderRadius: 6, border: '1px solid #30363d', background: '#161b22', color: '#f0f6fc', fontSize: 13, outline: 'none', width: 180 }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={16} color="#22c55e" />本周工作量对比 (在职) {dataSource === 'api' && <span style={{ fontSize: 11, color: '#22c55e' }}>(userApi 实时)</span>}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={prodData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                    <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                    <Bar dataKey="examsThisWeek" fill="#22c55e" radius={[4, 4, 0, 0]} name="检查量" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={16} color="#8b5cf6" />员工满意度趋势 <span style={{ fontSize: 11, color: '#f59e0b' }}>(演示数据)</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={SATISFACTION_TREND}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#8b949e' }} />
                    <YAxis domain={[60, 100]} tick={{ fontSize: 12, fill: '#8b949e' }} />
                    <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`${v}`, '满意度']} />
                    <Line type="monotone" dataKey="satisfaction" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} name="满意度" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 90px 80px 90px 80px 60px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', background: '#0d1117', color: '#8b949e', fontSize: 12, fontWeight: 600 }}>
                <span /><span>姓名</span><span>角色</span><span>班组</span><span>排班</span><span>本周检查</span><span>加班(h)</span>
              </div>
              {filtered.map((s, idx) => {
                const isOpen = expandedId === s.id
                return (
                  <div key={s.id}>
                    <div onClick={() => setExpandedId(isOpen ? null : s.id)}
                      style={{ display: 'grid', gridTemplateColumns: '24px 1fr 90px 80px 90px 80px 60px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', alignItems: 'center', background: idx % 2 === 0 ? '#0d1117' : '#161b22', cursor: 'pointer' }}>
                      <span style={{ color: '#6e7681' }}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Users size={14} color="#3b82f6" />
                        <span style={{ fontSize: 13 }}>{s.name}</span>
                      </div>
                      <span style={{ fontSize: 12, color: '#8b949e' }}>{s.role}</span>
                      <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: s.status === 'active' ? '#22c55e' : s.status === 'leave' ? '#ef4444' : '#f59e0b' }}>
                        {s.status === 'active' ? <CheckCircle size={12} /> : s.status === 'leave' ? <XCircle size={12} /> : <Clock size={12} />}
                        {s.status === 'active' ? '在职' : s.status === 'leave' ? '休假' : '培训'}
                      </span>
                      <span style={{ fontSize: 12, color: '#8b949e' }}>{s.shift}</span>
                      <span style={{ fontSize: 12, color: '#f0f6fc', fontWeight: 600 }}>{s.examsThisWeek}</span>
                      <span style={{ fontSize: 12, color: s.overtimeHrs > 5 ? '#ef4444' : '#8b949e' }}>{s.overtimeHrs}</span>
                    </div>
                    {isOpen && (
                      <div style={{ padding: '12px 16px 12px 48px', background: '#0d1117', borderBottom: '1px solid #21262d', display: 'flex', gap: 24, fontSize: 12 }}>
                        <div><span style={{ color: '#6e7681' }}>资质: </span><span>{s.certification}</span></div>
                        <div><span style={{ color: '#6e7681' }}>满意度: </span><span style={{ color: s.satisfaction >= 85 ? '#22c55e' : '#f59e0b' }}>{s.satisfaction}%</span></div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {view === 'shift' && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#f0f6fc' }}>本周排班表 <span style={{ fontSize: 11, color: '#f59e0b' }}>(演示数据)</span></div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>日期</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>白班</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>夜班</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>备班</th>
                </tr>
              </thead>
              <tbody>
                {SHIFT_GRID.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', fontWeight: 600 }}>{row.day}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{row['白班']}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{row['夜班']}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{row['备班']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'certs' && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={16} color="#f59e0b" />资质证书到期提醒 {dataSource === 'api' && <span style={{ fontSize: 11, color: '#22c55e' }}>(userApi 实时 · 到期日为演示)</span>}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>姓名</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>证书</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>到期日</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>状态</th>
                </tr>
              </thead>
              <tbody>
                {certRows.map((c, i) => (
                  <tr key={i}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{c.staff}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{c.cert}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{c.expiry}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: c.status === 'valid' ? '#22c55e20' : '#f59e0b20', color: c.status === 'valid' ? '#22c55e' : '#f59e0b' }}>
                        {c.status === 'valid' ? '有效' : '即将过期'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
