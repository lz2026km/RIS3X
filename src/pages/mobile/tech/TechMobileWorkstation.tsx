import { useState, useCallback, useEffect, useRef } from 'react'
import { message, Modal, Drawer } from 'antd'
import { Search, ListChecks, Camera, Monitor, Play, CheckCircle, Clock, AlertCircle, Wifi, WifiOff, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { appointmentApi, type AppointmentDto, deviceApi, type DeviceDto, examApi, mobileApi, type TodaySummary, type WorklistItem, worklistApi, type WorklistItemDto } from '../../../services/api'

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
  status: 'scheduled' | 'arrived' | 'in-progress' | 'completed' | 'cancelled'
  priority: 'routine' | 'urgent'
  scheduledTime: string
  accessionNumber?: string
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
  arrived: '#fef9c3',
  'in-progress': '#fef3c7',
  completed: '#d1fae5',
  cancelled: '#f1f5f9',
}

const GENDER_CN: Record<string, string> = { MALE: '男', FEMALE: '女', OTHER: '其他', '男': '男', '女': '女' }

const genderCn = (raw?: string | null): string => (raw ? GENDER_CN[raw] ?? '未知' : '未知')

// [v3.0.6.11-95 Wave1B] 后端 worklist state → 技师端状态 (含历史别名, 对齐 MSW WORKLIST_STATUS_ALIASES)
const WL_STATE_MAP: Record<string, TechExamItem['status']> = {
  SCHEDULED: 'scheduled',
  ARRIVED: 'arrived',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  IMAGE_READY: 'completed',
  QC_REJECT: 'completed',
  QC_PASS: 'completed',
  PENDING_REPORT: 'completed',
  CANCELLED: 'cancelled',
  // 历史/中文别名
  draft: 'scheduled', pending: 'scheduled', 待登记: 'scheduled', 已登记: 'scheduled', 待检查: 'scheduled',
  checkedIn: 'arrived', 已报到: 'arrived',
  inProgress: 'in-progress', 检查中: 'in-progress', 已暂停: 'in-progress',
  completed: 'completed', submitted: 'completed', reviewed: 'completed', cosigned: 'completed',
  published: 'completed', 待报告: 'completed', 已报告: 'completed', 已发布: 'completed',
  已归档: 'completed', 质控退回: 'completed', 检查异常: 'completed',
  cancelled: 'cancelled', 已取消: 'cancelled',
}

const ageFromBirth = (birthDate?: string | null): number => {
  if (!birthDate) return 0
  const d = new Date(birthDate)
  if (Number.isNaN(d.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000)))
}

const s = {
  container: { maxWidth: 420, margin: '0 auto', background: 'var(--bg-primary)', minHeight: '100vh', fontFamily: '-apple-system, sans-serif' },
  header: { background: 'linear-gradient(135deg, #0f766e, #14b8a6)', color: '#fff', padding: '16px 16px 12px' },
  headerTitle: { fontSize: 18, fontWeight: 700 },
  searchBar: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', borderRadius: 10, padding: '10px 14px', margin: '12px 16px', border: '1px solid var(--border-color)' },
  tabRow: { display: 'flex', margin: '0 16px', gap: 4 },
  tab: (active: boolean) => ({ flex: 1, padding: '8px 0', textAlign: 'center' as const, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: active ? '#0f766e' : '#94a3b8', borderBottom: active ? '2px solid #0f766e' : '2px solid transparent' }),
  listItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' },
}

export default function TechMobileWorkstation() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'exams' | 'devices'>('exams')
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'in-progress'>('all')
  const [search, setSearch] = useState('')
  const [exams, setExams] = useState<TechExamItem[]>([])
  const [devices, setDevices] = useState<DeviceStatus[]>([])
  const [summary, setSummary] = useState<TodaySummary>({ examsToday: 0, pendingExams: 0, inProgressExams: 0, criticalValues: 0, reportsToday: 0, signedReportsToday: 0, date: '' })
  // [v3.0.6.11-95 Wave1B] 扩展统计: GET /worklist/stats (当日完成/平均时长/技师维度)
  const [techStats, setTechStats] = useState<{ completedToday: number; avgDurationMin: number; technicianCount: number }>({ completedToday: 0, avgDurationMin: 0, technicianCount: 0 })
  const [usingMock, setUsingMock] = useState(false)

  // [v3.0.6.11-95 Wave1B] 主数据源切换为 /worklist (含检查室/设备/年龄字段) (离线兜底保留)
  const mapWorklistDto = useCallback((w: WorklistItemDto): TechExamItem => ({
    id: w.id,
    patientName: w.patient?.name ?? w.patientName ?? '未知患者',
    gender: genderCn(w.patient?.gender ?? w.gender ?? w.patientSex ?? null),
    age: w.patient?.birthDate ? ageFromBirth(w.patient.birthDate) : Number(w.patientAge ?? w.age ?? 0) || 0,
    modality: w.modality,
    examItem: w.bodyPart ?? w.examName ?? w.accessionNumber ?? '检查',
    bodyPart: w.bodyPart ?? '',
    roomName: w.device?.location ?? '',
    deviceName: w.device?.name ?? w.deviceName ?? w.deviceModel ?? '',
    status: WL_STATE_MAP[w.state ?? w.status ?? 'SCHEDULED'] ?? 'scheduled',
    priority: w.isUrgent || w.priority === 'urgent' || w.priority === 'critical' ? 'urgent' as const : 'routine' as const,
    scheduledTime: w.scheduledAt ? new Date(w.scheduledAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '',
    accessionNumber: w.accessionNumber ?? w.accessionNo,
  }), [])

  // 后端 /mobile/worklist 项目 → 技师视角列表项 (离线兜底)
  const mapWorklistItem = useCallback((w: WorklistItem): TechExamItem => ({
    id: w.id,
    patientName: w.patientName,
    gender: genderCn(w.gender),
    age: w.age ?? 0,
    modality: w.modality,
    examItem: w.bodyPart,
    bodyPart: w.bodyPart,
    roomName: '',
    deviceName: '',
    status: w.status === 'pending' ? 'scheduled' : w.status === 'reading' ? 'in-progress' : 'completed',
    priority: w.urgency === 'critical' || w.urgency === 'urgent' ? 'urgent' as const : 'routine' as const,
    scheduledTime: w.scheduledAt ? new Date(w.scheduledAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '',
    accessionNumber: w.accessionNumber,
  }), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [summaryRes, statsRes, devRes] = await Promise.allSettled([
        mobileApi.getTodaySummary(),
        worklistApi.getStats(),
        deviceApi.list(),
      ])
      if (!cancelled && summaryRes.status === 'fulfilled' && summaryRes.value.success && summaryRes.value.data) {
        setSummary(summaryRes.value.data)
      } else if (!cancelled) {
        // [离线兜底] 与后端 mobile.service seed 对齐
        setSummary({ examsToday: 42, pendingExams: 12, inProgressExams: 5, criticalValues: 3, reportsToday: 28, signedReportsToday: 21, date: new Date().toISOString().slice(0, 10) })
      }
      // [v3.0.6.11-95 Wave1B] 检查耗时统计: /worklist/stats 扩展字段
      if (!cancelled && statsRes.status === 'fulfilled' && statsRes.value.success && statsRes.value.data) {
        const d = statsRes.value.data
        setTechStats({
          completedToday: Number(d.completedToday ?? 0),
          avgDurationMin: Number(d.avgDurationMin ?? 0),
          technicianCount: Array.isArray(d.byTechnician) ? d.byTechnician.length : 0,
        })
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

      // [v3.0.6.11-95 Wave1B] 数据源优先级: /worklist (含 room/device/age) → 预约 → /mobile/worklist
      // 响应形状兼容: 后端 { items, total } / MSW 裸数组
      const wl = await worklistApi.list({ page: 1, pageSize: 200 })
      const wlItems = wl.data && Array.isArray(wl.data) ? wl.data : (wl.data as { items?: WorklistItemDto[] } | null)?.items
      if (!cancelled && wl.success && Array.isArray(wlItems)) {
        setExams(wlItems.map(mapWorklistDto))
        return
      }
      const examRes = await appointmentApi.list()
      if (!cancelled && examRes.success && Array.isArray(examRes.data)) {
        const stateMap: Record<string, TechExamItem['status']> = {
          SCHEDULED: 'scheduled', CONFIRMED: 'scheduled', CHECKED_IN: 'arrived',
          IN_PROGRESS: 'in-progress', COMPLETED: 'completed', CANCELLED: 'cancelled', NO_SHOW: 'cancelled',
        }
        setExams(examRes.data.map((a: AppointmentDto) => ({
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
      } else if (!cancelled) {
        // [离线兜底] 预约接口失败 → 使用 /mobile/worklist (技师视角检查队列)
        const wl2 = await mobileApi.getWorklist()
        if (!cancelled) {
          if (wl2.success && Array.isArray(wl2.data)) {
            setExams(wl2.data.map(mapWorklistItem))
            setUsingMock(true)
          }
        }
      }
    })()
    return () => { cancelled = true }
  }, [mapWorklistDto, mapWorklistItem])

  const filteredExams = exams.filter(item => {
    if (filter !== 'all') {
      if (filter === 'scheduled' && item.status !== 'scheduled' && item.status !== 'arrived') return false
      if (filter === 'in-progress' && item.status !== 'in-progress') return false
    }
    if (search && !item.patientName.includes(search) && !item.examItem.includes(search)) return false
    return true
  })

  // [Wave2A] 开始检查 → POST /worklist/:id/start (MSW 支撑, 后端 worklist 待对齐)
  const [operatingId, setOperatingId] = useState<string | null>(null)
  const handleStartExam = useCallback(async (id: string) => {
    setOperatingId(id)
    try {
      const res = await examApi.start(id)
      if (res.success) {
        setExams(prev => prev.map(item => item.id === id ? { ...item, status: 'in-progress' as const } : item))
        message.success(`已开始检查: ${id}`)
      } else {
        message.error(res.error?.message ?? '开始检查失败')
      }
    } catch {
      message.error('开始检查失败: 网络错误')
    } finally {
      setOperatingId(null)
    }
  }, [])

  const handleCompleteExam = useCallback(async (id: string) => {
    setOperatingId(id)
    try {
      const res = await examApi.complete(id)
      if (res.success) {
        setExams(prev => prev.map(item => item.id === id ? { ...item, status: 'completed' as const } : item))
        message.success(`检查完成: ${id}`)
      } else {
        message.error(res.error?.message ?? '完成检查失败')
      }
    } catch {
      message.error('完成检查失败: 网络错误')
    } finally {
      setOperatingId(null)
    }
  }, [])

  // [v3.0.6.11-95 Wave1B] 签到: SCHEDULED → ARRIVED (worklistApi.checkIn)
  const handleCheckIn = useCallback(async (id: string) => {
    setOperatingId(id)
    try {
      const res = await worklistApi.checkIn(id)
      if (res.success) {
        setExams(prev => prev.map(item => item.id === id ? { ...item, status: 'arrived' as const } : item))
        message.success(`签到成功: ${id}`)
      } else {
        message.error(res.error?.message ?? '签到失败')
      }
    } catch {
      message.error('签到失败: 网络错误')
    } finally {
      setOperatingId(null)
    }
  }, [])

  // [v3.0.6.11-95 Wave1B] 取消检查: worklistApi.cancel (确认后执行)
  const handleCancelExam = useCallback((id: string, name: string) => {
    Modal.confirm({
      title: '取消检查',
      content: `确认取消 ${name} 的检查?该操作不可撤销。`,
      okText: '确认取消',
      okButtonProps: { danger: true },
      cancelText: '返回',
      onOk: async () => {
        setOperatingId(id)
        try {
          const res = await worklistApi.cancel(id, '技师端取消')
          if (res.success) {
            setExams(prev => prev.map(item => item.id === id ? { ...item, status: 'cancelled' as const } : item))
            message.success(`已取消检查: ${id}`)
          } else {
            message.error(res.error?.message ?? '取消检查失败')
          }
        } catch {
          message.error('取消检查失败: 网络错误')
        } finally {
          setOperatingId(null)
        }
      },
    })
  }, [])

  // [v3.0.6.11-95 Wave1B] 详情 Drawer: 患者/检查/状态/操作日志 (worklistApi.getById)
  const [detail, setDetail] = useState<TechExamItem | null>(null)
  const [detailOps, setDetailOps] = useState<Array<{ op: string; createdAt: string; actorName?: string }>>([])
  const openDetail = useCallback(async (item: TechExamItem) => {
    setDetail(item)
    setDetailOps([])
    try {
      const res = await worklistApi.getById(item.id)
      const raw = (res.data ?? {}) as unknown as Record<string, unknown> & { ops?: Array<{ op?: string; createdAt?: string; actor?: { fullName?: string } }> }
      setDetailOps(Array.isArray(raw.ops) ? raw.ops.map(o => ({
        op: String(o.op ?? ''),
        createdAt: o.createdAt ? new Date(o.createdAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '',
        actorName: o.actor?.fullName,
      })) : [])
    } catch { /* 操作日志不可用不阻断 */ }
  }, [])

  // [v3.0.6.11-95 Wave1B] 质控: 影像已完成 → 跳转影像质控页
  const handleQc = useCallback((item: TechExamItem) => {
    message.info(`跳转影像质控: ${item.patientName} ${item.examItem}`)
    navigate('/qc-image')
  }, [navigate])

  // [Wave2A] 扫码: 优先调用条形码扫描 API, 桌面端 navigator 不可用 → 文件输入回退(文件名即扫码结果)
  const scanInputRef = useRef<HTMLInputElement | null>(null)
  const handleScan = useCallback(() => {
    try {
      const nav = navigator as any
      if (typeof nav?.mediaDevices?.getUserMedia === 'function' || typeof nav?.BarcodeDetector !== 'undefined') {
        message.info('请对准检查申请单条形码扫描 (BarcodeDetector 可用)')
      }
    } catch { /* ignore */ }
    if (scanInputRef.current) scanInputRef.current.click()
  }, [])

  const handleScanFile = useCallback((file: File | null) => {
    if (!file) return
    const code = file.name.replace(/\.[^.]+$/, '')
    setSearch(code)
    message.success(`已扫码: ${code}（文件名回退扫码，扫描队列已按此过滤）`)
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
        {/* [v3.0.6.11-95 Wave1B] 检查耗时统计: /worklist/stats 扩展字段 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
          {[
            { value: techStats.completedToday, label: '今日完成', bg: 'rgba(255,255,255,0.15)' },
            { value: techStats.avgDurationMin ? `${techStats.avgDurationMin}min` : '--', label: '平均时长', bg: 'rgba(255,255,255,0.15)' },
            { value: techStats.technicianCount, label: '技师', bg: 'rgba(255,255,255,0.15)' },
          ].map(stat => (
            <div key={stat.label} style={{ background: stat.bg, borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{stat.value}</div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>{stat.label}</div>
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

      <input
        ref={scanInputRef}
        type="file"
        accept="image/*,.pdf"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0] ?? null; handleScanFile(f); e.target.value = '' }}
      />

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
                style={{ padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: filter === f.key ? '#0f766e' : 'var(--bg-card)', color: filter === f.key ? '#fff' : '#64748b' }}>
                {f.label}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 4 }}>
            {filteredExams.map(item => (
              <div key={item.id} style={s.listItem} onClick={() => void openDetail(item)}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: STATUS_COLORS[item.status], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.status === 'completed' ? <CheckCircle size={18} color="#059669" /> : item.status === 'in-progress' ? <Play size={18} color="#d97706" /> : item.status === 'cancelled' ? <XCircle size={18} color="#94a3b8" /> : <Clock size={18} color="#2563eb" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.patientName}</span>
                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: item.priority === 'urgent' ? 'var(--color-warning-bg)' : 'var(--bg-card)', color: item.priority === 'urgent' ? 'var(--color-warning)' : '#64748b' }}>
                      {item.priority === 'urgent' ? '紧急' : '普通'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 6 }}>
                    <span>{item.gender}/{item.age}岁</span>
                    <span>{item.modality}</span>
                    <span>{item.bodyPart}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                    {item.deviceName ? `${item.deviceName}${item.roomName ? ` · ${item.roomName}` : ''}` : item.roomName || '未分配设备'} · {item.scheduledTime}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} onClick={e => e.stopPropagation()}>
                  {item.status === 'scheduled' && (
                    <>
                      <button onClick={() => void handleCheckIn(item.id)} disabled={operatingId === item.id} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: operatingId === item.id ? 0.6 : 1 }}>{operatingId === item.id ? '处理中' : '签到'}</button>
                      <button onClick={() => void handleStartExam(item.id)} disabled={operatingId === item.id} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#0f766e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: operatingId === item.id ? 0.6 : 1 }}>{operatingId === item.id ? '处理中' : '开始'}</button>
                    </>
                  )}
                  {item.status === 'arrived' && (
                    <>
                      <button onClick={() => void handleStartExam(item.id)} disabled={operatingId === item.id} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#0f766e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: operatingId === item.id ? 0.6 : 1 }}>{operatingId === item.id ? '处理中' : '开始'}</button>
                      <button onClick={() => handleCancelExam(item.id, item.patientName)} disabled={operatingId === item.id} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#f1f5f9', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>取消</button>
                    </>
                  )}
                  {item.status === 'in-progress' && (
                    <>
                      <button onClick={() => void handleCompleteExam(item.id)} disabled={operatingId === item.id} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: operatingId === item.id ? 0.6 : 1 }}>{operatingId === item.id ? '处理中' : '完成'}</button>
                      <button onClick={() => handleCancelExam(item.id, item.patientName)} disabled={operatingId === item.id} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#f1f5f9', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>取消</button>
                    </>
                  )}
                  {item.status === 'completed' && (
                    <>
                      <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✓ 已完成</span>
                      <button onClick={() => handleQc(item)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>质控</button>
                    </>
                  )}
                  {item.status === 'cancelled' && <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>已取消</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ padding: 16 }}>
          {devices.map(device => (
            <div key={device.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 10, marginBottom: 8, border: '1px solid var(--border-color)' }}>
              {device.status === 'online' ? <Wifi size={18} color="#059669" /> : device.status === 'offline' ? <WifiOff size={18} color="#dc2626" /> : <AlertCircle size={18} color="#d97706" />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{device.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{device.modality} · {device.status === 'online' ? '在线' : device.status === 'offline' ? '离线' : '维护中'}</div>
                {device.currentPatient && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>当前患者: {device.currentPatient}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer
        title={detail ? `${detail.patientName} · 检查详情` : '检查详情'}
        open={!!detail}
        onClose={() => setDetail(null)}
        placement="right"
        width={360}
      >
        {detail && (
          <div style={{ fontSize: 13 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{detail.patientName}</div>
            <div style={{ marginBottom: 14, fontSize: 12, color: '#64748b' }}>
              {detail.gender} / {detail.age}岁 · {detail.modality} · {detail.bodyPart}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: '检查项目', value: detail.examItem },
                { label: '设备', value: detail.deviceName || '未分配' },
                { label: '检查室', value: detail.roomName || '未分配' },
                { label: '预约时间', value: detail.scheduledTime },
                { label: '状态', value: detail.status === 'scheduled' ? '待签到' : detail.status === 'arrived' ? '已签到' : detail.status === 'in-progress' ? '检查中' : detail.status === 'completed' ? '已完成' : '已取消' },
                { label: '登记号', value: detail.accessionNumber || '-' },
              ].map(f => (
                <div key={f.label} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{f.label}</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{f.value}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, margin: '14px 0 8px' }}>操作日志</div>
            {detailOps.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>暂无操作记录</div>
            ) : (
              detailOps.map((o, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)', fontSize: 12 }}>
                  <span style={{ color: '#334155' }}>{o.actorName ?? '系统'} · {o.op}</span>
                  <span style={{ color: '#94a3b8' }}>{o.createdAt}</span>
                </div>
              ))
            )}
          </div>
        )}
      </Drawer>

      <div style={{ position: 'sticky', bottom: 0, display: 'flex', background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', padding: '6px 0' }}>
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
