// 6.8 Department Operations (20 pts)
import { useState, useMemo } from 'react'
import { Users, Calendar, Clock, Activity, TrendingUp, RefreshCw, Download, Plus, Bed, UserCheck, FileText } from 'lucide-react'

const statsData = [
  { label: '今日检查量', value: '28', unit: '例', icon: Activity, color: '#2563eb', bg: '#eff6ff' },
  { label: '待诊患者', value: '12', unit: '人', icon: Users, color: '#ea580c', bg: '#fff7ed' },
  { label: '平均等待', value: '18', unit: 'min', icon: Clock, color: '#ca8a04', bg: '#fefce8' },
  { label: '设备使用率', value: '86', unit: '%', icon: TrendingUp, color: '#16a34a', bg: '#f0fdf4' },
  { label: '当日报告', value: '18', unit: '份', icon: FileText, color: '#7c3aed', bg: '#f5f3ff' },
  { label: '值班人员', value: '6', unit: '人', icon: UserCheck, color: '#0891b2', bg: '#ecfeff' },
]

const s: Record<string, React.CSSProperties> = {
  root: { padding: 0 },
  header: { marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: 700, color: '#1a3a5c', margin: 0 },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 },
  statCard: { background: '#fff', borderRadius: 12, padding: '18px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  statIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 26, fontWeight: 800, color: '#1a3a5c', lineHeight: 1.1 },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  section: { background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  btn: { padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  btnPrimary: { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' },
  td: { padding: '10px 8px', borderBottom: '1px solid #f8fafc', color: '#334155' },
  bad: { padding: '3px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'inline-block' },
  scrollBox: { maxHeight: 280, overflowY: 'auto' },
}

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, { bg: string; text: string }> = {
    '空闲': { bg: '#f0fdf4', text: '#16a34a' },
    '使用中': { bg: '#2563eb', text: '#fff' },
    '维护中': { bg: '#fefce8', text: '#ca8a04' },
    '等待中': { bg: '#fff7ed', text: '#ea580c' },
    '已完成': { bg: '#f0fdf4', text: '#16a34a' },
    '已签到': { bg: '#eff6ff', text: '#2563eb' },
  }
  const c = colors[status] || { bg: '#f1f5f9', text: '#64748b' }
  return <span style={{ ...s.bad, background: c.bg, color: c.text }}>{status}</span>
}

const DepartmentOperationsPage = () => {
  const [search, setSearch] = useState('')
  const [_tab] = useState(1)
  new Date();

  const staff = [
    { name: '张敏', role: '主任医师', shift: '上午', status: '在岗', focus: '诊断' },
    { name: '李芳', role: '主治医师', shift: '上午', status: '在岗', focus: '诊断' },
    { name: '王丽', role: '技师', shift: '上午', status: '检查中', focus: 'MG扫描' },
    { name: '赵静', role: '技师', shift: '下午', status: '在岗', focus: 'TOMO' },
    { name: '刘洁', role: '技师', shift: '上午', status: '检查中', focus: '超声' },
    { name: '陈艳', role: '护士', shift: '上午', status: '在岗', focus: '注射' },
  ]

  const rooms = useMemo(() => [
    { name: '钼靶室1', device: 'Hologic Selenia', modality: 'MG', status: '使用中', patient: '王秀兰', todayCount: 12 },
    { name: '钼靶室2', device: 'GE Senographe', modality: 'MG', status: '空闲', patient: '', todayCount: 8 },
    { name: '断层室', device: 'Siemens Inspiration', modality: 'TOM', status: '使用中', patient: '李桂英', todayCount: 6 },
    { name: '超声室1', device: 'GE Logiq E10', modality: 'US', status: '使用中', patient: '赵丽娟', todayCount: 10 },
    { name: '超声室2', device: 'Philips EPIQ', modality: 'US', status: '维护中', patient: '', todayCount: 0 },
    { name: 'MRI室', device: 'Siemens Skyra', modality: 'MRI', status: '空闲', patient: '', todayCount: 4 },
  ], [])

  const queue = useMemo(() => Array.from({ length: 15 }, (_, i) => ({
    id: i + 1, name: `患者${String.fromCharCode(65 + (i % 26))}${i}`,
    exam: ['MG', '乳腺断层', '乳腺超声', '乳腺MRI'][i % 4],
    room: rooms[i % rooms.length].name, scheduled: `${8 + Math.floor(i / 2)}:${(i % 2) * 30 + 10}`,
    status: ['等待中', '已签到', '检查中', '已完成'][Math.min(i % 4, 3)] as string,
  })), [rooms])

  const filteredQueue = queue.filter(q => q.name.includes(search) || q.exam.includes(search))

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>乳腺科室运营管理</h1>
          <p style={s.subtitle}>乳腺影像科室运营 · 排班 · 设备 · 工作流 · 统计</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btn}><RefreshCw size={14} /></button>
          <button style={s.btnPrimary}><Download size={14} /> 统计报表</button>
        </div>
      </div>

      <div style={s.statsRow}>
        {statsData.map((stat, i) => (
          <div key={i} style={s.statCard}>
            <div style={{ ...s.statIcon, background: stat.bg }}><stat.icon size={20} color={stat.color} /></div>
            <div style={s.statValue}>{stat.value}<span style={{ fontSize: 14, fontWeight: 400, color: '#64748b' }}>{stat.unit}</span></div>
            <div style={s.statLabel}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={s.grid2}>
        <div style={s.section}>
          <div style={s.sectionTitle}><Bed size={16} color='#2563eb' />设备状态</div>
          {rooms.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.status === '空闲' ? '#16a34a' : r.status === '使用中' ? '#2563eb' : '#ca8a04' }} />
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>{r.device} · {r.modality}</div></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <StatusBadge status={r.status} />
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>今日{r.todayCount}例</div>
              </div>
            </div>
          ))}
        </div>

        <div style={s.section}>
          <div style={s.sectionTitle}><Users size={16} color='#7c3aed' />值班人员</div>
          <div style={s.grid4}>
            {staff.map((p, i) => (
              <div key={i} style={{ padding: 12, background: '#f8fafc', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e2e8f0', margin: '0 auto 6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#64748b' }}>{p.name[0]}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{p.role}</div>
                <StatusBadge status={p.status} />
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{p.shift} · {p.focus}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={s.section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={s.sectionTitle}><Calendar size={16} color='#0891b2' />候诊队列</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', width: 200 }} placeholder='搜索患者或检查...' value={search} onChange={e => setSearch(e.target.value)} />
            <button style={{ ...s.btn, padding: '6px 12px' }}><Plus size={12} /> 加号</button>
          </div>
        </div>
        <div style={s.scrollBox}>
          <table style={s.table}>
            <thead><tr>
              <th style={s.th}>序号</th><th style={s.th}>患者</th><th style={s.th}>检查项目</th>
              <th style={s.th}>检查室</th><th style={s.th}>预约时间</th><th style={s.th}>状态</th>
            </tr></thead>
            <tbody>
              {filteredQueue.map(q => (
                <tr key={q.id}>
                  <td style={s.td}>{q.id}</td>
                  <td style={{ ...s.td, fontWeight: 600 }}>{q.name}</td>
                  <td style={s.td}>{q.exam}</td>
                  <td style={s.td}>{q.room}</td>
                  <td style={s.td}>{q.scheduled}</td>
                  <td style={s.td}><StatusBadge status={q.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default DepartmentOperationsPage
