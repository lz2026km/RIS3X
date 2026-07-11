import { useState, useCallback } from 'react'
import { Search, Calendar, Bell, UserCheck, Syringe, Clock, ChevronRight, AlertCircle, CheckCircle, XCircle } from 'lucide-react'

export interface NurseAppointment {
  id: string
  patientName: string
  gender: string
  age: number
  examItem: string
  modality: string
  status: 'waiting' | 'in-progress' | 'completed' | 'cancelled'
  appointmentTime: string
  contrastRequired: boolean
  medications: string[]
  notes?: string
}

export interface MedicationRecord {
  id: string
  patientName: string
  medication: string
  dosage: string
  route: string
  administeredAt: string
  administeredBy: string
}

const MOCK_APPOINTMENTS: NurseAppointment[] = [
  { id: 'N1', patientName: '张伟', gender: '男', age: 42, examItem: '腹部CT增强', modality: 'CT', status: 'waiting', appointmentTime: '09:00', contrastRequired: true, medications: ['碘海醇'] },
  { id: 'N2', patientName: '李芳', gender: '女', age: 35, examItem: '胸部CT平扫', modality: 'CT', status: 'in-progress', appointmentTime: '09:15', contrastRequired: false, medications: [] },
  { id: 'N3', patientName: '王建国', gender: '男', age: 68, examItem: '头颅MR平扫', modality: 'MR', status: 'waiting', appointmentTime: '09:30', contrastRequired: false, medications: [], notes: '有幽闭恐惧症史' },
  { id: 'N4', patientName: '赵雪梅', gender: '女', age: 55, examItem: 'MG', modality: 'MG', status: 'completed', appointmentTime: '08:30', contrastRequired: false, medications: [] },
  { id: 'N5', patientName: '刘洋', gender: '男', age: 28, examItem: '膝关节MR平扫', modality: 'MR', status: 'cancelled', appointmentTime: '08:45', contrastRequired: false, medications: [] },
]

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  waiting: { bg: '#fef3c7', color: '#d97706', label: '等候中' },
  'in-progress': { bg: '#dbeafe', color: '#2563eb', label: '检查中' },
  completed: { bg: '#d1fae5', color: '#059669', label: '已完成' },
  cancelled: { bg: '#f1f5f9', color: '#94a3b8', label: '已取消' },
}

const s = {
  container: { maxWidth: 420, margin: '0 auto', background: '#f8fafc', minHeight: '100vh', fontFamily: '-apple-system, sans-serif' },
  header: { background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', padding: '16px 16px 12px' },
  headerTitle: { fontSize: 18, fontWeight: 700 },
  searchBar: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 10, padding: '10px 14px', margin: '12px 16px', border: '1px solid #e2e8f0' },
  tabRow: { display: 'flex', margin: '0 16px', gap: 4 },
  tab: (active: boolean) => ({ flex: 1, padding: '8px 0', textAlign: 'center' as const, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: active ? '#7c3aed' : '#94a3b8', borderBottom: active ? '2px solid #7c3aed' : '2px solid transparent' }),
  listItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' },
}

export default function NurseMobileWorkstation() {
  const [tab, setTab] = useState<'queue' | 'meds'>('queue')
  const [filter, setFilter] = useState<'all' | 'waiting' | 'in-progress'>('all')
  const [search, setSearch] = useState('')

  const filtered = MOCK_APPOINTMENTS.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false
    if (search && !item.patientName.includes(search) && !item.examItem.includes(search)) return false
    return true
  })

  const handleCheckIn = useCallback((id: string) => {
    alert(`签到患者: ${id}`)
  }, [])

  const handleMedication = useCallback((id: string) => {
    alert(`记录用药: ${id}`)
  }, [])

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.headerTitle}>护士移动工作站</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>放射科 · 护理工作台</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
          {[
            { value: MOCK_APPOINTMENTS.filter(a => a.status === 'waiting').length, label: '等候', bg: '#fef3c7', color: '#d97706' },
            { value: MOCK_APPOINTMENTS.filter(a => a.status === 'in-progress').length, label: '检查中', bg: '#dbeafe', color: '#2563eb' },
            { value: MOCK_APPOINTMENTS.filter(a => a.contrastRequired).length, label: '需造影', bg: '#fee2e2', color: '#dc2626' },
          ].map(stat => (
            <div key={stat.label} style={{ background: stat.bg, borderRadius: 8, padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={s.searchBar}>
        <Search size={16} color="#94a3b8" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索患者..." style={{ border: 'none', outline: 'none', fontSize: 13, color: '#334155', width: '100%', background: 'transparent' }} />
        <Bell size={16} color="#94a3b8" style={{ cursor: 'pointer' }} />
      </div>

      <div style={s.tabRow}>
        {[{ key: 'queue' as const, icon: Calendar, label: '患者队列' }, { key: 'meds' as const, icon: Syringe, label: '用药记录' }].map(t => (
          <div key={t.key} style={s.tab(tab === t.key)} onClick={() => setTab(t.key)}>
            <t.icon size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            {t.label}
          </div>
        ))}
      </div>

      {tab === 'queue' ? (
        <>
          <div style={{ display: 'flex', gap: 6, padding: '8px 16px' }}>
            {[{ key: 'all', label: '全部' }, { key: 'waiting', label: '等候中' }, { key: 'in-progress', label: '检查中' }].map(f => (
              <div key={f.key} onClick={() => setFilter(f.key as typeof filter)}
                style={{ padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: filter === f.key ? '#7c3aed' : '#f1f5f9', color: filter === f.key ? '#fff' : '#64748b' }}>
                {f.label}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 4 }}>
            {filtered.map(item => {
              const sc = STATUS_CONFIG[item.status]
              return (
                <div key={item.id} style={s.listItem}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: sc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.status === 'completed' ? <CheckCircle size={18} color="#059669" /> : item.status === 'cancelled' ? <XCircle size={18} color="#94a3b8" /> : <Clock size={18} color={sc.color} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{item.patientName}</span>
                      {item.contrastRequired && <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: '#fee2e2', color: '#dc2626' }}>造影</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 6 }}>
                      <span>{item.gender}/{item.age}岁</span>
                      <span>{item.modality}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{item.examItem} · {item.appointmentTime}</div>
                    {item.notes && <div style={{ fontSize: 12, color: '#d97706', marginTop: 2 }}>⚠ {item.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color }}>{sc.label}</span>
                    {item.status === 'waiting' && (
                      <button onClick={() => handleCheckIn(item.id)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        签到
                      </button>
                    )}
                    {item.contrastRequired && item.status === 'waiting' && (
                      <button onClick={() => handleMedication(item.id)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        用药
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div style={{ padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Syringe size={16} color="#7c3aed" /> 造影剂/用药记录
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {MOCK_APPOINTMENTS.filter(a => a.contrastRequired || a.medications.length > 0).map(item => (
                <div key={item.id} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{item.patientName} - {item.examItem}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    {item.contrastRequired && <span>需要使用造影剂: {item.medications.join(', ')}</span>}
                    {!item.contrastRequired && <span>无需造影剂</span>}
                  </div>
                  <button onClick={() => handleMedication(item.id)} style={{ marginTop: 8, padding: '4px 12px', borderRadius: 6, border: '1px solid #7c3aed', background: '#fff', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    记录用药
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 0, display: 'flex', background: '#fff', borderTop: '1px solid #e2e8f0', padding: '6px 0' }}>
        {[
          { key: 'queue', icon: Calendar, label: '队列' },
          { key: 'meds', icon: Syringe, label: '用药' },
          { key: 'bell', icon: Bell, label: '通知' },
          { key: 'check', icon: UserCheck, label: '签到' },
        ].map(nav => (
          <div key={nav.key} style={{ flex: 1, textAlign: 'center', padding: '4px 0', fontSize: 12, color: tab === nav.key ? '#7c3aed' : '#94a3b8', cursor: 'pointer', fontWeight: tab === nav.key ? 700 : 400 }}
            onClick={() => ['queue', 'meds'].includes(nav.key) && setTab(nav.key as 'queue' | 'meds')}>
            <nav.icon size={18} style={{ display: 'block', margin: '0 auto 2px' }} />
            {nav.label}
          </div>
        ))}
      </div>
    </div>
  )
}
