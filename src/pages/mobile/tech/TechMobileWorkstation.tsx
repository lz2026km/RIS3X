import { useState, useCallback } from 'react'
import { message } from 'antd'
import { Search, ListChecks, Camera, Monitor, Play, CheckCircle, Clock, ChevronRight, AlertCircle, Wifi, WifiOff, XCircle } from 'lucide-react'
import { replayDeviceEvent } from '../../../utils/deviceStateAdapter'

export interface TechExamItem {
  id: string
  patientName: string
  gender: string
  age: number
  modality: string
  examItem: string
  bodyPart: string
  roomName: string
  deviceName: string
  status: 'scheduled' | 'in-progress' | 'completed'
  priority: 'routine' | 'urgent'
  scheduledTime: string
}

export interface DeviceStatus {
  id: string
  name: string
  modality: string
  status: 'online' | 'offline' | 'maintenance'
  currentPatient?: string
}

const MOCK_EXAMS: TechExamItem[] = [
  { id: 'T1', patientName: '王磊', gender: '男', age: 38, modality: 'CT', examItem: '胸部CT平扫', bodyPart: '胸部', roomName: 'CT室1', deviceName: 'CT-1', status: 'scheduled', priority: 'routine', scheduledTime: '09:00' },
  { id: 'T2', patientName: '张丽华', gender: '女', age: 52, modality: 'MR', examItem: '腰椎MR平扫', bodyPart: '腰椎', roomName: 'MR室1', deviceName: 'MR-1', status: 'scheduled', priority: 'urgent', scheduledTime: '09:30' },
  { id: 'T3', patientName: '刘强', gender: '男', age: 29, modality: 'DR', examItem: '胸部正位片', bodyPart: '胸部', roomName: 'DR室1', deviceName: 'DR-1', status: 'in-progress', priority: 'routine', scheduledTime: '08:45' },
  { id: 'T4', patientName: '陈秀芳', gender: '女', age: 67, modality: 'CT', examItem: '腹部CT增强', bodyPart: '腹部', roomName: 'CT室1', deviceName: 'CT-1', status: 'completed', priority: 'urgent', scheduledTime: '08:00' },
  { id: 'T5', patientName: '赵强', gender: '男', age: 45, modality: 'DR', examItem: '膝关节正侧位', bodyPart: '膝关节', roomName: 'DR室2', deviceName: 'DR-2', status: 'scheduled', priority: 'routine', scheduledTime: '10:00' },
]

const MOCK_DEVICES: DeviceStatus[] = [
  { id: 'DEV-CT-01', name: 'CT-1', modality: 'CT', status: 'online', currentPatient: '王磊' },
  { id: 'DEV-CT-02', name: 'CT-2', modality: 'CT', status: replayDeviceEvent('idle', { type: 'START_MAINTENANCE', notes: '球管季度校准', by: 'tech' }) as 'maintenance' },
  { id: 'DEV-MR-01', name: 'MR-1', modality: 'MR', status: 'online', currentPatient: '张丽华' },
  { id: 'DEV-DR-01', name: 'DR-1', modality: 'DR', status: 'online', currentPatient: '刘强' },
  { id: 'DEV-DR-02', name: 'DR-2', modality: 'DR', status: replayDeviceEvent('idle', { type: 'GO_OFFLINE', reason: '网络中断', by: 'tech' }) as 'offline' },
]

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#dbeafe',
  'in-progress': '#fef3c7',
  completed: '#d1fae5',
}

const STATUS_TEXT: Record<string, string> = {
  scheduled: '待检查',
  'in-progress': '检查中',
  completed: '已完成',
}

const s = {
  container: { maxWidth: 420, margin: '0 auto', background: '#f8fafc', minHeight: '100vh', fontFamily: '-apple-system, sans-serif' },
  header: { background: 'linear-gradient(135deg, #0f766e, #14b8a6)', color: '#fff', padding: '16px 16px 12px' },
  headerTitle: { fontSize: 18, fontWeight: 700 },
  searchBar: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 10, padding: '10px 14px', margin: '12px 16px', border: '1px solid #e2e8f0' },
  tabRow: { display: 'flex', margin: '0 16px', gap: 4 },
  tab: (active: boolean) => ({ flex: 1, padding: '8px 0', textAlign: 'center' as const, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: active ? '#0f766e' : '#94a3b8', borderBottom: active ? '2px solid #0f766e' : '2px solid transparent' }),
  listItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' },
}

export default function TechMobileWorkstation() {
  const [tab, setTab] = useState<'exams' | 'devices'>('exams')
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'in-progress'>('all')
  const [search, setSearch] = useState('')

  const filteredExams = MOCK_EXAMS.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false
    if (search && !item.patientName.includes(search) && !item.examItem.includes(search)) return false
    return true
  })

  const handleStartExam = useCallback((id: string) => {
    message.success(`开始检查: ${id}`)
  }, [])

  const handleCompleteExam = useCallback((id: string) => {
    message.success(`完成检查: ${id}`)
  }, [])

  const handleScan = useCallback(() => {
    message.info('扫码枪/相机扫描条码')
  }, [])

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.headerTitle}>技师移动工作站</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>放射科 · 检查操作台</div>
      </div>

      <div style={s.searchBar}>
        <Search size={16} color="#94a3b8" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索患者、检查项目..." style={{ border: 'none', outline: 'none', fontSize: 13, color: '#334155', width: '100%', background: 'transparent' }} />
        <Camera size={16} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={handleScan} />
      </div>

      <div style={s.tabRow}>
        {[{ key: 'exams' as const, icon: ListChecks, label: '检查队列' }, { key: 'devices' as const, icon: Monitor, label: '设备状态' }].map(t => (
          <div key={t.key} style={s.tab(tab === t.key)} onClick={() => setTab(t.key)}>
            <t.icon size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            {t.label}
          </div>
        ))}
      </div>

      {tab === 'exams' ? (
        <>
          <div style={{ display: 'flex', gap: 6, padding: '8px 16px' }}>
            {[{ key: 'all', label: '全部' }, { key: 'scheduled', label: '待检查' }, { key: 'in-progress', label: '检查中' }].map(f => (
              <div key={f.key} onClick={() => setFilter(f.key as typeof filter)}
                style={{ padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: filter === f.key ? '#0f766e' : '#f1f5f9', color: filter === f.key ? '#fff' : '#64748b' }}>
                {f.label}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 4 }}>
            {filteredExams.map(item => (
              <div key={item.id} style={s.listItem}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: STATUS_COLORS[item.status], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.status === 'completed' ? <CheckCircle size={18} color="#059669" /> : item.status === 'in-progress' ? <Play size={18} color="#d97706" /> : <Clock size={18} color="#2563eb" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{item.patientName}</span>
                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: item.priority === 'urgent' ? '#fef3c7' : '#f1f5f9', color: item.priority === 'urgent' ? '#d97706' : '#64748b' }}>
                      {item.priority === 'urgent' ? '紧急' : '普通'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 6 }}>
                    <span>{item.gender}/{item.age}岁</span>
                    <span>{item.modality}</span>
                    <span>{item.bodyPart}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{item.roomName} · {item.scheduledTime}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {item.status === 'scheduled' && (
                    <button onClick={() => handleStartExam(item.id)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#0f766e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>开始</button>
                  )}
                  {item.status === 'in-progress' && (
                    <button onClick={() => handleCompleteExam(item.id)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>完成</button>
                  )}
                  {item.status === 'completed' && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✓ 已完成</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ padding: 16 }}>
          {MOCK_DEVICES.map(device => (
            <div key={device.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff', borderRadius: 10, marginBottom: 8, border: '1px solid #e2e8f0' }}>
              {device.status === 'online' ? <Wifi size={18} color="#059669" /> : device.status === 'offline' ? <WifiOff size={18} color="#dc2626" /> : <AlertCircle size={18} color="#d97706" />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{device.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{device.modality} · {device.status === 'online' ? '在线' : device.status === 'offline' ? '离线' : '维护中'}</div>
                {device.currentPatient && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>当前患者: {device.currentPatient}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 0, display: 'flex', background: '#fff', borderTop: '1px solid #e2e8f0', padding: '6px 0' }}>
        {[
          { key: 'exams', icon: ListChecks, label: '检查' },
          { key: 'devices', icon: Monitor, label: '设备' },
          { key: 'scan', icon: Camera, label: '扫码' },
          { key: 'bell', icon: AlertCircle, label: '通知' },
        ].map(nav => (
          <div key={nav.key} style={{ flex: 1, textAlign: 'center', padding: '4px 0', fontSize: 12, color: tab === nav.key ? '#0f766e' : '#94a3b8', cursor: 'pointer', fontWeight: tab === nav.key ? 700 : 400 }}
            onClick={nav.key === 'scan' ? handleScan : () => nav.key !== 'scan' && setTab(nav.key as 'exams' | 'devices')}>
            <nav.icon size={18} style={{ display: 'block', margin: '0 auto 2px' }} />
            {nav.label}
          </div>
        ))}
      </div>
    </div>
  )
}
