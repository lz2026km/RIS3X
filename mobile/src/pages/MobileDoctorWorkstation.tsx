import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, AlertTriangle, Home, ListChecks, MessageSquare, User, Filter, Activity } from 'lucide-react'
import { useMobileStore } from '../store/mobileStore'
import OfflineIndicator from '../components/OfflineIndicator'

interface WorklistItem {
  id: string
  patientName: string
  gender: string
  age: number
  modality: string
  examItem: string
  bodyPart: string
  priority: 'routine' | 'urgent' | 'critical'
  status: 'pending' | 'reading' | 'reported'
  imagesCount: number
  createdAt: string
  patientId: string
  accessionNumber: string
}

interface PatientInfo {
  id: string
  name: string
  gender: string
  age: number
  phone: string
  exams: { id: string; examItem: string; date: string; status: string }[]
}

const PRIORITY_COLORS: Record<string, string> = {
  routine: '#64748b',
  urgent: '#d97706',
  critical: '#dc2626',
}

const PRIORITY_LABELS: Record<string, string> = {
  routine: '普通',
  urgent: '紧急',
  critical: '危急',
}

const MOCK_WORKLIST: WorklistItem[] = [
  { id: 'W1', patientName: '张志刚', gender: '男', age: 62, modality: 'CT', examItem: '胸部CT平扫', bodyPart: '胸部', priority: 'urgent', status: 'pending', imagesCount: 128, createdAt: '2026-06-15 09:00', patientId: 'P001', accessionNumber: 'ACC001' },
  { id: 'W2', patientName: '李秀英', gender: '女', age: 55, modality: 'MR', examItem: '头颅MR平扫', bodyPart: '头颅', priority: 'routine', status: 'pending', imagesCount: 1200, createdAt: '2026-06-15 08:30', patientId: 'P002', accessionNumber: 'ACC002' },
  { id: 'W3', patientName: '王建军', gender: '男', age: 45, modality: 'CT', examItem: '腹部CT增强', bodyPart: '腹部', priority: 'critical', status: 'reading', imagesCount: 256, createdAt: '2026-06-15 07:45', patientId: 'P003', accessionNumber: 'ACC003' },
  { id: 'W4', patientName: '赵敏', gender: '女', age: 34, modality: 'DR', examItem: '胸部正位片', bodyPart: '胸部', priority: 'routine', status: 'pending', imagesCount: 2, createdAt: '2026-06-15 10:00', patientId: 'P004', accessionNumber: 'ACC004' },
  { id: 'W5', patientName: '陈国强', gender: '男', age: 71, modality: 'CT', examItem: '冠脉CTA', bodyPart: '心脏', priority: 'critical', status: 'reading', imagesCount: 512, createdAt: '2026-06-15 06:30', patientId: 'P005', accessionNumber: 'ACC005' },
  { id: 'W6', patientName: '刘芳', gender: '女', age: 28, modality: 'MR', examItem: '腰椎MR平扫', bodyPart: '腰椎', priority: 'routine', status: 'reported', imagesCount: 480, createdAt: '2026-06-14 14:00', patientId: 'P006', accessionNumber: 'ACC006' },
]

const MOCK_PATIENT: PatientInfo = {
  id: 'P003', name: '王建军', gender: '男', age: 45, phone: '138****1234',
  exams: [
    { id: 'E1', examItem: '腹部CT增强', date: '2026-06-15', status: 'in-progress' },
    { id: 'E2', examItem: '胸部CT平扫', date: '2026-05-20', status: 'completed' },
  ],
}

const STATUS_LABEL: Record<string, string> = { pending: '待报告', reading: '报告中', reported: '已报告' }
const STATUS_COLOR: Record<string, string> = { pending: '#d97706', reading: '#2563eb', reported: '#059669' }

const btnBase: React.CSSProperties = {
  minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13,
  padding: '10px 16px', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
}

export default function MobileDoctorWorkstation() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'reading'>('all')
  const [selected, setSelected] = useState<WorklistItem | null>(null)
  const [showPatient, setShowPatient] = useState(false)

  const filtered = MOCK_WORKLIST.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false
    if (search && !item.patientName.includes(search) && !item.accessionNumber.includes(search)) return false
    return true
  })

  const handleViewImage = useCallback(() => {
    navigate('/mobile/viewer')
  }, [navigate])

  const handleItemTap = useCallback((item: WorklistItem) => {
    setSelected(item)
    setShowPatient(true)
  }, [])

  const unread = useMobileStore(s => s.unreadNotifications)

  if (showPatient && selected) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <button onClick={() => setShowPatient(false)} style={{ ...btnBase, background: 'transparent', color: '#fff', padding: '4px 0', alignSelf: 'flex-start' }}>
            ← 返回列表
          </button>
          <div style={{ fontSize: 18, fontWeight: 700 }}>患者详情</div>
        </div>

        <div style={{ padding: 16 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{selected.patientName}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{selected.gender}/{selected.age}岁 · {selected.patientId}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{MOCK_PATIENT.phone}</div>
          </div>

          <div style={{ ...cardStyle, marginTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>当前检查</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#334155' }}>{selected.examItem}</span>
              <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: `${PRIORITY_COLORS[selected.priority]}20`, color: PRIORITY_COLORS[selected.priority] }}>
                {PRIORITY_LABELS[selected.priority]}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 8 }}>
              <span>{selected.modality}</span><span>{selected.bodyPart}</span><span>{selected.imagesCount}幅</span>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{selected.accessionNumber}</div>
            <button onClick={handleViewImage} style={{ ...btnBase, background: '#1e3a5f', color: '#fff', width: '100%', marginTop: 16, gap: 6 }}>
              <Activity size={18} /> 阅片
            </button>
          </div>

          <div style={{ ...cardStyle, marginTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>历史检查</div>
            {MOCK_PATIENT.exams.map(ex => (
              <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#334155' }}>{ex.examItem}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{ex.date}</div>
                </div>
                <span style={{ fontSize: 12, color: ex.status === 'completed' ? '#059669' : '#d97706', fontWeight: 600 }}>
                  {ex.status === 'completed' ? '已完成' : '进行中'}
                </span>
              </div>
            ))}
          </div>
        </div>
        <BottomNav active="worklist" unread={unread} />
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>医生移动工作站</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>放射科 · 诊断工作台</div>
          </div>
          <OfflineIndicator compact />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
          {[
            { value: MOCK_WORKLIST.filter(i => i.status === 'pending').length, label: '待报告', bg: '#dbeafe', color: '#2563eb' },
            { value: MOCK_WORKLIST.filter(i => i.status === 'reading').length, label: '报告中', bg: '#fef3c7', color: '#d97706' },
            { value: MOCK_WORKLIST.filter(i => i.status === 'reported').length, label: '今日完成', bg: '#d1fae5', color: '#059669' },
            { value: MOCK_WORKLIST.filter(i => i.priority === 'critical').length, label: '危急值', bg: '#fee2e2', color: '#dc2626' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={searchBarStyle}>
        <Search size={16} color="#94a3b8" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索患者、Accession号..."
          style={{ border: 'none', outline: 'none', fontSize: 14, color: '#334155', width: '100%', background: 'transparent' }} />
        <Filter size={16} color="#94a3b8" style={{ cursor: 'pointer' }} />
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '4px 16px 8px' }}>
        {[{ key: 'all', label: '全部' }, { key: 'pending', label: '待报告' }, { key: 'reading', label: '报告中' }].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as typeof filter)}
            style={{ ...filterBtnStyle, background: filter === f.key ? '#1e3a5f' : '#f1f5f9', color: filter === f.key ? '#fff' : '#64748b' }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.map(item => (
          <div key={item.id} style={listItemStyle} onClick={() => handleItemTap(item)}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLORS[item.priority], flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>{item.patientName}</span>
                {item.priority === 'critical' && <AlertTriangle size={14} color="#dc2626" />}
                <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: `${PRIORITY_COLORS[item.priority]}20`, color: PRIORITY_COLORS[item.priority] }}>
                  {PRIORITY_LABELS[item.priority]}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2, display: 'flex', gap: 8 }}>
                <span>{item.gender}/{item.age}岁</span><span>{item.modality}</span><span>{item.bodyPart}</span>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{item.examItem} · {item.imagesCount}幅</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLOR[item.status] }}>{STATUS_LABEL[item.status]}</span>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.createdAt}</div>
            </div>
            <ChevronRight size={16} color="#cbd5e1" style={{ flexShrink: 0 }} />
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>暂无匹配记录</div>
        )}
      </div>

      <BottomNav active="worklist" unread={unread} />
    </div>
  )
}

function BottomNav({ active, unread }: { active: string; unread: number }) {
  const navigate = useNavigate()
  const tabs = [
    { key: 'home', icon: Home, label: '首页', path: '/' },
    { key: 'worklist', icon: ListChecks, label: '工作列表', path: '/doctor' },
    { key: 'messages', icon: MessageSquare, label: '消息', path: '/doctor' },
    { key: 'profile', icon: User, label: '个人', path: '/profile' },
  ]
  return (
    <div style={{ display: 'flex', background: '#fff', borderTop: '1px solid #e2e8f0', padding: '4px 0 6px', flexShrink: 0 }}>
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = active === tab.key
        return (
          <button key={tab.key} onClick={() => navigate(tab.path)}
            style={{ flex: 1, textAlign: 'center', padding: '6px 0', cursor: 'pointer', border: 'none', background: 'transparent', position: 'relative', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>
            <Icon size={22} style={{ display: 'block', margin: '0 auto 2px', color: isActive ? '#1e3a5f' : '#94a3b8' }} />
            <span style={{ fontSize: 10, color: isActive ? '#1e3a5f' : '#94a3b8', fontWeight: isActive ? 700 : 400 }}>{tab.label}</span>
            {tab.key === 'messages' && unread > 0 && (
              <span style={{ position: 'absolute', top: 0, right: '50%', marginRight: -16, background: '#dc2626', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>
                {unread}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  maxWidth: 420, margin: '0 auto', background: '#f8fafc', minHeight: '100vh',
  display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, sans-serif',
}

const headerStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1e3a5f, #2d4a6f)', color: '#fff', padding: '16px 16px 12px',
}

const searchBarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 10,
  padding: '12px 14px', margin: '12px 16px 4px', border: '1px solid #e2e8f0',
}

const filterBtnStyle: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 16, fontSize: 12, fontWeight: 600,
  border: 'none', cursor: 'pointer', minHeight: 44,
}

const listItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#fff',
  borderBottom: '1px solid #f1f5f9', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation', minHeight: 44,
}

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0',
}
