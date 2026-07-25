import { useState, useCallback } from 'react'
import { message } from 'antd'
import { Search, Filter, ChevronRight, Monitor, Activity, FileText, Bell, User, AlertTriangle, LayoutDashboard, ListChecks, Image, Mic, BarChart3 } from 'lucide-react'

export interface DoctorWorklistItem {
  id: string
  patientName: string
  gender: string
  age: number
  modality: string
  examItem: string
  bodyPart: string
  status: 'pending' | 'reading' | 'reported'
  priority: 'routine' | 'urgent' | 'critical'
  accessionNumber: string
  imagesCount: number
  createdAt: string
}

export interface DoctorStats {
  totalPending: number
  totalReading: number
  completedToday: number
  criticalFindings: number
  avgReportTime: number
}

const MOCK_STATS: DoctorStats = {
  totalPending: 12,
  totalReading: 3,
  completedToday: 18,
  criticalFindings: 2,
  avgReportTime: 28,
}

const MOCK_WORKLIST: DoctorWorklistItem[] = [
  { id: 'D1', patientName: '张志刚', gender: '男', age: 62, modality: 'CT', examItem: '胸部CT平扫', bodyPart: '胸部', status: 'pending', priority: 'urgent', accessionNumber: '20260615001', imagesCount: 128, createdAt: '2026-06-15 09:00' },
  { id: 'D2', patientName: '李秀英', gender: '女', age: 55, modality: 'MR', examItem: '头颅MR平扫', bodyPart: '头颅', status: 'pending', priority: 'routine', accessionNumber: '20260615002', imagesCount: 1200, createdAt: '2026-06-15 08:30' },
  { id: 'D3', patientName: '王建军', gender: '男', age: 45, modality: 'CT', examItem: '腹部CT增强', bodyPart: '腹部', status: 'reading', priority: 'urgent', accessionNumber: '20260615003', imagesCount: 256, createdAt: '2026-06-15 07:45' },
  { id: 'D4', patientName: '赵敏', gender: '女', age: 34, modality: 'DR', examItem: '胸部正位片', bodyPart: '胸部', status: 'pending', priority: 'routine', accessionNumber: '20260615004', imagesCount: 2, createdAt: '2026-06-15 10:00' },
  { id: 'D5', patientName: '陈国强', gender: '男', age: 71, modality: 'CT', examItem: '冠脉CTA', bodyPart: '心脏', status: 'reading', priority: 'critical', accessionNumber: '20260615005', imagesCount: 512, createdAt: '2026-06-15 06:30' },
  { id: 'D6', patientName: '刘芳', gender: '女', age: 28, modality: 'MR', examItem: '腰椎MR平扫', bodyPart: '腰椎', status: 'reported', priority: 'routine', accessionNumber: '20260615006', imagesCount: 480, createdAt: '2026-06-14 14:00' },
]

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

export default function DoctorMobileWorkstation() {
  const [tab, setTab] = useState<'worklist' | 'stats'>('worklist')
  const [filter, setFilter] = useState<'all' | 'pending' | 'reading'>('all')
  const [search, setSearch] = useState('')

  const filtered = MOCK_WORKLIST.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false
    if (search && !item.patientName.includes(search) && !item.accessionNumber.includes(search)) return false
    return true
  })

  const handleItemClick = useCallback((item: DoctorWorklistItem) => {
    message.info(`打开 ${item.examItem} - ${item.patientName} (Accession: ${item.accessionNumber})`)
  }, [])

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.headerTitle}>医生移动工作站</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>放射科 · 诊断工作台</div>
        <div style={s.statsRow}>
          <div style={s.statCard('#dbeafe')}><div style={s.statValue}>{MOCK_STATS.totalPending}</div><div style={s.statLabel}>待报告</div></div>
          <div style={s.statCard('#fef3c7')}><div style={s.statValue}>{MOCK_STATS.totalReading}</div><div style={s.statLabel}>报告中</div></div>
          <div style={s.statCard('#d1fae5')}><div style={s.statValue}>{MOCK_STATS.completedToday}</div><div style={s.statLabel}>今日完成</div></div>
          <div style={s.statCard('#fee2e2')}><div style={s.statValue}>{MOCK_STATS.criticalFindings}</div><div style={s.statLabel}>危急值</div></div>
        </div>
      </div>

      <div style={s.searchBar}>
        <Search size={16} color="#94a3b8" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索患者、Accession号..." style={{ border: 'none', outline: 'none', fontSize: 13, color: '#334155', width: '100%', background: 'transparent' }} />
        <Filter size={16} color="#94a3b8" style={{ cursor: 'pointer' }} />
      </div>

      <div style={s.tabRow}>
        {[{ key: 'worklist' as const, icon: ListChecks, label: '工作列表' }, { key: 'stats' as const, icon: BarChart3, label: '统计' }].map(t => (
          <div key={t.key} style={s.tab(tab === t.key)} onClick={() => setTab(t.key)}>
            <t.icon size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            {t.label}
          </div>
        ))}
      </div>

      {tab === 'worklist' ? (
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
                <div style={s.priorityDot(PRIORITY_COLORS[item.priority])} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{item.patientName}</span>
                    {item.priority === 'critical' && <AlertTriangle size={12} color="#dc2626" />}
                    <span style={s.badge(PRIORITY_COLORS[item.priority])}>
                      {item.priority === 'critical' ? '危急' : item.priority === 'urgent' ? '紧急' : '普通'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 8 }}>
                    <span>{item.gender}/{item.age}岁</span>
                    <span>{item.modality}</span>
                    <span>{item.bodyPart}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{item.examItem} · {item.imagesCount}幅</div>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <span style={s.badge(STATUS_LABELS[item.status] === '已报告' ? '#059669' : '#d97706')}>{STATUS_LABELS[item.status]}</span>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{item.createdAt}</div>
                </div>
                <ChevronRight size={14} color="#cbd5e1" />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>工作效率统计</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {[
                { label: '平均报告时间', value: `${MOCK_STATS.avgReportTime}分钟`, color: '#2563eb' },
                { label: '今日完成', value: `${MOCK_STATS.completedToday}份`, color: '#059669' },
                { label: '危急值', value: `${MOCK_STATS.criticalFindings}个`, color: '#dc2626' },
                { label: '待处理', value: `${MOCK_STATS.totalPending}份`, color: '#d97706' },
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
