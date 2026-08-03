import { useState, useCallback } from 'react'
import { Search, Monitor, CheckCircle, Clock, Play, Camera, ListChecks, BarChart3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import OfflineIndicator from '../components/OfflineIndicator'

interface TechExamItem {
  id: string
  patientName: string
  gender: string
  age: number
  modality: string
  examItem: string
  bodyPart: string
  deviceName: string
  roomName: string
  status: 'scheduled' | 'in-progress' | 'completed'
  priority: 'routine' | 'urgent'
  scheduledTime: string
}

interface DeviceGroup {
  deviceName: string
  modality: string
  items: TechExamItem[]
}

const MOCK_EXAMS: TechExamItem[] = [
  { id: 'T1', patientName: '王磊', gender: '男', age: 38, modality: 'CT', examItem: '胸部CT平扫', bodyPart: '胸部', deviceName: 'CT-1', roomName: 'CT室1', status: 'scheduled', priority: 'routine', scheduledTime: '09:00' },
  { id: 'T2', patientName: '张丽华', gender: '女', age: 52, modality: 'MR', examItem: '腰椎MR平扫', bodyPart: '腰椎', deviceName: 'MR-1', roomName: 'MR室1', status: 'scheduled', priority: 'urgent', scheduledTime: '09:30' },
  { id: 'T3', patientName: '刘强', gender: '男', age: 29, modality: 'DR', examItem: '胸部正位片', bodyPart: '胸部', deviceName: 'DR-1', roomName: 'DR室1', status: 'in-progress', priority: 'routine', scheduledTime: '08:45' },
  { id: 'T4', patientName: '陈秀芳', gender: '女', age: 67, modality: 'CT', examItem: '腹部CT增强', bodyPart: '腹部', deviceName: 'CT-1', roomName: 'CT室1', status: 'completed', priority: 'urgent', scheduledTime: '08:00' },
  { id: 'T5', patientName: '赵强', gender: '男', age: 45, modality: 'DR', examItem: '膝关节正侧位', bodyPart: '膝关节', deviceName: 'DR-2', roomName: 'DR室2', status: 'scheduled', priority: 'routine', scheduledTime: '10:00' },
  { id: 'T6', patientName: '孙丽', gender: '女', age: 33, modality: 'MR', examItem: '颈椎MR平扫', bodyPart: '颈椎', deviceName: 'MR-1', roomName: 'MR室1', status: 'scheduled', priority: 'routine', scheduledTime: '10:30' },
]

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  scheduled: { color: '#2563eb', bg: '#dbeafe', label: '待检查' },
  'in-progress': { color: '#d97706', bg: '#fef3c7', label: '检查中' },
  completed: { color: '#059669', bg: '#d1fae5', label: '已完成' },
}

const btnBase: React.CSSProperties = {
  minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13,
  padding: '10px 16px', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
}

export default function MobileTechWorkstation() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'list' | 'stats'>('list')
  const [search, setSearch] = useState('')
  const [deviceFilter, setDeviceFilter] = useState<string>('all')

  const devices = [...new Set(MOCK_EXAMS.map(e => e.deviceName))]

  const grouped: DeviceGroup[] = devices
    .filter(d => deviceFilter === 'all' || d === deviceFilter)
    .map(d => ({
      deviceName: d,
      modality: MOCK_EXAMS.find(e => e.deviceName === d)?.modality || '',
      items: MOCK_EXAMS.filter(e => e.deviceName === d && (!search || e.patientName.includes(search) || e.examItem.includes(search))),
    }))
    .filter(g => g.items.length > 0)

  const handleStart = useCallback((id: string) => {
    const msg = `开始检查: ${id}`
    console.log(msg)
  }, [])

  const handleComplete = useCallback((id: string) => {
    const msg = `完成检查: ${id}`
    console.log(msg)
  }, [])

  const handleScan = useCallback(() => {
    console.log('扫码')
  }, [])

  const totalCount = MOCK_EXAMS.length
  const completedCount = MOCK_EXAMS.filter(e => e.status === 'completed').length
  const pendingCount = MOCK_EXAMS.filter(e => e.status === 'scheduled').length
  const inProgressCount = MOCK_EXAMS.filter(e => e.status === 'in-progress').length

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>技师移动工作站</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>放射科 · 检查操作台</div>
          </div>
          <OfflineIndicator compact />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
          {[
            { value: totalCount, label: '总检查数', bg: '#dbeafe', color: '#2563eb' },
            { value: pendingCount, label: '待完成', bg: '#fef3c7', color: '#d97706' },
            { value: inProgressCount, label: '检查中', bg: '#e0e7ff', color: '#4f46e5' },
            { value: completedCount, label: '已完成', bg: '#d1fae5', color: '#059669' },
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
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索患者、检查项目..."
          style={{ border: 'none', outline: 'none', fontSize: 14, color: '#334155', width: '100%', background: 'transparent' }} />
        <Camera size={16} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={handleScan} />
      </div>

      <div style={{ display: 'flex', margin: '0 16px', gap: 4 }}>
        {[
          { key: 'list' as const, icon: ListChecks, label: '检查列表' },
          { key: 'stats' as const, icon: BarChart3, label: '统计' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'transparent', color: tab === t.key ? '#0f766e' : '#94a3b8', borderBottom: tab === t.key ? '2px solid #0f766e' : '2px solid transparent' }}>
            <t.icon size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'list' ? (
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          <div style={{ display: 'flex', gap: 6, padding: '0 16px 8px', overflowX: 'auto' }}>
            <button onClick={() => setDeviceFilter('all')}
              style={{ ...filterChipStyle, background: deviceFilter === 'all' ? '#0f766e' : '#f1f5f9', color: deviceFilter === 'all' ? '#fff' : '#64748b' }}>
              全部设备
            </button>
            {devices.map(d => (
              <button key={d} onClick={() => setDeviceFilter(d)}
                style={{ ...filterChipStyle, background: deviceFilter === d ? '#0f766e' : '#f1f5f9', color: deviceFilter === d ? '#fff' : '#64748b' }}>
                <Monitor size={12} style={{ marginRight: 4 }} />{d}
              </button>
            ))}
          </div>

          {grouped.map(group => (
            <div key={group.deviceName}>
              <div style={{ padding: '8px 16px 4px', fontSize: 13, fontWeight: 700, color: '#0f766e', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Monitor size={14} /> {group.deviceName} <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>({group.modality})</span>
              </div>
              {group.items.map(item => {
                const sc = STATUS_CONFIG[item.status]
                return (
                  <div key={item.id} style={listItemStyle}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {item.status === 'completed' ? <CheckCircle size={18} color={sc.color} /> : item.status === 'in-progress' ? <Play size={18} color={sc.color} /> : <Clock size={18} color={sc.color} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{item.patientName}</span>
                        <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: item.priority === 'urgent' ? '#fef3c7' : '#f1f5f9', color: item.priority === 'urgent' ? '#d97706' : '#64748b' }}>
                          {item.priority === 'urgent' ? '紧急' : '普通'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 6 }}>
                        <span>{item.gender}/{item.age}岁</span><span>{item.modality}</span><span>{item.bodyPart}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{item.roomName} · {item.scheduledTime}</div>
                    </div>
                    <div>
                      {item.status === 'scheduled' && (
                        <button onClick={() => handleStart(item.id)} style={{ ...btnBase, background: '#0f766e', color: '#fff', padding: '8px 14px', fontSize: 12 }}>到检</button>
                      )}
                      {item.status === 'in-progress' && (
                        <button onClick={() => handleComplete(item.id)} style={{ ...btnBase, background: '#059669', color: '#fff', padding: '8px 14px', fontSize: 12 }}>完成</button>
                      )}
                      {item.status === 'completed' && (
                        <span style={{ fontSize: 12, color: '#059669', fontWeight: 600, whiteSpace: 'nowrap' }}>✓ 已采集</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
          {grouped.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>暂无匹配检查</div>
          )}
        </div>
      ) : (
        <div style={{ padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>今日检查统计</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {[
                { label: '总检查数', value: `${totalCount}`, color: '#2563eb' },
                { label: '已完成', value: `${completedCount}`, color: '#059669' },
                { label: '待完成', value: `${pendingCount}`, color: '#d97706' },
                { label: '检查中', value: `${inProgressCount}`, color: '#4f46e5' },
              ].map(stat => (
                <div key={stat.label} style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{stat.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: stat.color, marginTop: 4 }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0', marginTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>按设备统计</div>
            {devices.map(d => {
              const devExams = MOCK_EXAMS.filter(e => e.deviceName === d)
              const devDone = devExams.filter(e => e.status === 'completed').length
              return (
                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <Monitor size={14} color="#0f766e" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', flex: 1 }}>{d}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{devDone}/{devExams.length}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', background: '#fff', borderTop: '1px solid #e2e8f0', padding: '4px 0 6px', flexShrink: 0 }}>
        {[
          { key: 'home', icon: '🏠', label: '首页', path: '/' },
          { key: 'list', icon: '📋', label: '检查' },
          { key: 'scan', icon: '📷', label: '扫码' },
          { key: 'profile', icon: '👤', label: '个人', path: '/profile' },
        ].map(navItem => (
          <button key={navItem.key} onClick={() => {
            if (navItem.path) navigate(navItem.path)
            else if (navItem.key === 'scan') handleScan()
            else setTab(navItem.key as 'list' | 'stats')
          }}
            style={{ flex: 1, textAlign: 'center', padding: '6px 0', cursor: 'pointer', border: 'none', background: 'transparent', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>
            <span style={{ fontSize: 22, display: 'block', margin: '0 auto 2px' }}>{navItem.icon}</span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{navItem.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  maxWidth: 420, margin: '0 auto', background: '#f8fafc', minHeight: '100vh',
  display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, sans-serif',
}

const headerStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #0f766e, #14b8a6)', color: '#fff', padding: '16px 16px 12px',
}

const searchBarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 10,
  padding: '12px 14px', margin: '12px 16px 4px', border: '1px solid #e2e8f0',
}

const listItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff',
  borderBottom: '1px solid #f1f5f9', minHeight: 44,
}

const filterChipStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, border: 'none',
  cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', minHeight: 44,
}
