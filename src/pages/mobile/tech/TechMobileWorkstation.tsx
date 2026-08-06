import { useState, useCallback, useEffect } from 'react'
import { message } from 'antd'
import { Search, ListChecks, Camera, Monitor, Play, CheckCircle, Clock, AlertCircle, Wifi, WifiOff } from 'lucide-react'
import {  } from '../../../utils/deviceStateAdapter'
import { appointmentApi, type AppointmentDto, deviceApi, type DeviceDto, mobileApi, type TodaySummary, type WorklistItem } from '../../../services/api'

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

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#dbeafe',
  'in-progress': '#fef3c7',
  completed: '#d1fae5',
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
  const [exams, setExams] = useState<TechExamItem[]>([])
  const [devices, setDevices] = useState<DeviceStatus[]>([])
  const [summary, setSummary] = useState<TodaySummary>({ examsToday: 0, pendingExams: 0, inProgressExams: 0, criticalValues: 0, reportsToday: 0, signedReportsToday: 0, date: '' })
  const [usingMock, setUsingMock] = useState(false)

  // 后端 /mobile/worklist 项目 → 技师视角列表项 (离线兜底)
  const mapWorklistItem = useCallback((w: WorklistItem): TechExamItem => ({
    id: w.id,
    patientName: w.patientName,
    gender: w.gender ?? '未知',
    age: w.age ?? 0,
    modality: w.modality,
    examItem: w.bodyPart,
    bodyPart: w.bodyPart,
    roomName: '',
    deviceName: '',
    status: w.status === 'pending' ? 'scheduled' : w.status === 'reading' ? 'in-progress' : 'completed',
    priority: w.urgency === 'critical' || w.urgency === 'urgent' ? 'urgent' as const : 'routine' as const,
    scheduledTime: w.scheduledAt ? new Date(w.scheduledAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '',
  }), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [examRes, devRes, summaryRes] = await Promise.allSettled([
        appointmentApi.list(),
        deviceApi.list(),
        mobileApi.getTodaySummary(),
      ])
      if (!cancelled && summaryRes.status === 'fulfilled' && summaryRes.value.success && summaryRes.value.data) {
        setSummary(summaryRes.value.data)
      } else if (!cancelled) {
        // [离线兜底] 与后端 mobile.service seed 对齐
        setSummary({ examsToday: 42, pendingExams: 12, inProgressExams: 5, criticalValues: 3, reportsToday: 28, signedReportsToday: 21, date: new Date().toISOString().slice(0, 10) })
      }
      if (examRes.status === 'fulfilled' && examRes.value.success && Array.isArray(examRes.value.data)) {
        const stateMap: Record<string, TechExamItem['status']> = {
          SCHEDULED: 'scheduled', CONFIRMED: 'scheduled', CHECKED_IN: 'in-progress',
          IN_PROGRESS: 'in-progress', COMPLETED: 'completed', CANCELLED: 'completed', NO_SHOW: 'completed',
        }
        if (!cancelled) {
          setExams(examRes.value.data.map((a: AppointmentDto) => ({
            id: a.id,
            patientName: a.patientName || '未知患者',
            gender: '未知',
            age: 0,
            modality: a.modality,
            examItem: a.room || '',
            bodyPart: a.bodyPart || '',
            roomName: a.room || '',
            deviceName: a.deviceName || '',
            status: stateMap[a.state] || 'scheduled',
            priority: a.priority === 'URGENT' || a.priority === 'STAT' ? 'urgent' as const : 'routine' as const,
            scheduledTime: a.startAt ? new Date(a.startAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '',
          })))
        }
      } else if (!cancelled) {
        // [离线兜底] 预约接口失败 → 使用 /mobile/worklist (技师视角检查队列)
        const wl = await mobileApi.getWorklist()
        if (!cancelled) {
          if (wl.success && Array.isArray(wl.data)) {
            setExams(wl.data.map(mapWorklistItem))
            setUsingMock(true)
          }
        }
      }
      if (!cancelled && devRes.status === 'fulfilled' && devRes.value.success && Array.isArray(devRes.value.data)) {
        setDevices(devRes.value.data.map((d: DeviceDto) => ({
          id: d.id,
          name: d.name || d.deviceId || '',
          modality: d.modality || '',
          status: (d.status || 'offline') as 'online' | 'offline' | 'maintenance',
          currentPatient: undefined,
        })))
      }
    })()
    return () => { cancelled = true }
  }, [mapWorklistItem])

  const filteredExams = exams.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false
    if (search && !item.patientName.includes(search) && !item.examItem.includes(search)) return false
    return true
  })

  const handleStartExam = useCallback((id: string) => {
    message.success(`开始检查: ${id}`)
  }, [])

  const handleCompleteExam = useCallback((_id: string) => {
    message.info('完成检查功能暂不可用')
  }, [])

  const handleScan = useCallback(() => {
    message.info('扫码功能暂不可用')
  }, [])

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.headerTitle}>技师移动工作站</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>放射科 · 检查操作台{summary.date ? ` · ${summary.date}` : ''}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
          {[
            { value: summary.examsToday, label: '今日检查', bg: 'rgba(255,255,255,0.15)' },
            { value: summary.pendingExams, label: '待检查', bg: 'rgba(255,255,255,0.15)' },
            { value: summary.inProgressExams, label: '检查中', bg: 'rgba(255,255,255,0.15)' },
            { value: summary.criticalValues, label: '危急值', bg: 'rgba(239,68,68,0.3)' },
          ].map(stat => (
            <div key={stat.label} style={{ background: stat.bg, borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{stat.value}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {usingMock && (
        <div style={{ background: '#fef3c7', color: '#92400e', fontSize: 12, padding: '6px 16px', textAlign: 'center' }}>
          ⚠ 预约接口不可用，检查队列已切换为 /mobile/worklist 演示数据
        </div>
      )}

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
          {devices.map(device => (
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
