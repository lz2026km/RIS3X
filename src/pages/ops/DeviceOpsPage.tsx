import { useState, useEffect, useCallback } from 'react'
import { message } from 'antd'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { Monitor, AlertTriangle, CheckCircle, XCircle, Search, Clock, Settings, ChevronDown, ChevronRight, Gauge } from 'lucide-react'
import { ChartContainer } from '../../components/charts'
import { replayDeviceEvent } from '../../utils/deviceStateAdapter'
// [W2-A] 设备运营接 deviceMgmtApi (equipment-lifecycle/faults/maintenance-plans) + oeeApi (利用率)
// [W1-B] 剂量追踪接 deviceMgmtApi.getDoseTracking/recordDose (POST /device-mgmt/dose-tracking)
import { deviceMgmtApi, type DoseRecord } from '../../services/api/deviceMgmtApi'
import { oeeApi } from '../../services/api/oeeApi'

interface Device {
  id: string; name: string; type: string; location: string; status: 'online' | 'offline' | 'maintenance' | 'fault'
  utilization: number; lastMaintenance: string; nextMaintenance: string; firmware: string; ip: string
}

const MOCK_DEVICES: Device[] = [
  { id: 'D001', name: 'CT-01 (Siemens SOMATOM)', type: 'CT', location: 'CT室1', status: 'online', utilization: 91, lastMaintenance: '2025-05-15', nextMaintenance: '2025-06-15', firmware: 'VA61A', ip: '10.0.1.10' },
  { id: 'D002', name: 'CT-02 (GE Revolution)', type: 'CT', location: 'CT室2', status: 'online', utilization: 78, lastMaintenance: '2025-05-20', nextMaintenance: '2025-06-20', firmware: 'Rev3.2', ip: '10.0.1.11' },
  { id: 'D003', name: 'MR-01 (Siemens Skyra)', type: 'MRI', location: 'MRI室1', status: 'online', utilization: 85, lastMaintenance: '2025-05-10', nextMaintenance: '2025-06-10', firmware: 'VE11C', ip: '10.0.2.10' },
  { id: 'D004', name: 'MR-02 (Philips Ingenia)', type: 'MRI', location: 'MRI室2', status: replayDeviceEvent('idle', { type: 'START_MAINTENANCE', notes: '冷头压缩机更换', by: 'system' }) as 'maintenance', utilization: 0, lastMaintenance: '2025-06-01', nextMaintenance: '2025-06-08', firmware: 'R7.1', ip: '10.0.2.11' },
  { id: 'D005', name: 'DR-01 (Siemens Multix)', type: 'X-Ray', location: 'X线室', status: 'online', utilization: 72, lastMaintenance: '2025-05-25', nextMaintenance: '2025-06-25', firmware: 'VX3.0', ip: '10.0.3.10' },
  { id: 'D006', name: 'MG-01 (Hologic Selenia)', type: 'Mammo', location: '乳腺室', status: replayDeviceEvent('idle', { type: 'GO_OFFLINE', reason: '探测器通讯故障', by: 'system' }) as 'offline', utilization: 0, lastMaintenance: '2025-04-20', nextMaintenance: '2025-05-20', firmware: 'S2.1', ip: '10.0.4.10' },
  { id: 'D007', name: 'US-01 (GE Logiq E10)', type: 'Ultrasound', location: '超声室1', status: 'online', utilization: 65, lastMaintenance: '2025-05-28', nextMaintenance: '2025-06-28', firmware: 'L6.0', ip: '10.0.5.10' },
]

const UTIL_DATA = MOCK_DEVICES.filter(d => d.status === 'online').map(d => ({ name: d.name.split('(')[0].trim(), utilization: d.utilization }))

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: typeof CheckCircle }> = {
  online: { color: '#22c55e', label: '在线', icon: CheckCircle },
  offline: { color: '#6e7681', label: '离线', icon: XCircle },
  maintenance: { color: '#f59e0b', label: '维护中', icon: Settings },
  fault: { color: '#ef4444', label: '故障', icon: AlertTriangle },
}

const FAULTS = [
  { device: 'MR-02', issue: '冷头压缩机异常噪音', severity: 'warning', reported: '2025-06-01 14:30', eta: '2025-06-03' },
  { device: 'MG-01', issue: '平板探测器通讯中断', severity: 'critical', reported: '2025-05-30 09:15', eta: '2025-06-10' },
]

const MAINT_LOG = [
  { device: 'CT-01', action: '年度预防性维护', performedBy: '西门子工程师', date: '2025-05-15', result: '通过' },
  { device: 'MR-01', action: '冷头更换', performedBy: '院内工程师', date: '2025-05-10', result: '通过' },
  { device: 'DR-01', action: '球管校准', performedBy: '院内工程师', date: '2025-05-25', result: '通过' },
]

export default function DeviceOpsPage() {
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  // [W2-A] deviceMgmtApi/oeeApi 实时状态 (失败回退静态演示数据)
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'api' | 'demo'>('demo')
  const [apiError, setApiError] = useState('')
  const [devices, setDevices] = useState<Device[]>(MOCK_DEVICES)
  const [utilData, setUtilData] = useState(UTIL_DATA)
  const [faults, setFaults] = useState(FAULTS)
  const [maintLog, setMaintLog] = useState(MAINT_LOG)

  // [W1-B] 剂量追踪: deviceMgmtApi.getDoseTracking (GET /device-mgmt/dose-tracking)
  const [doseRecords, setDoseRecords] = useState<DoseRecord[]>([])
  const [doseLoading, setDoseLoading] = useState(false)
  const [doseError, setDoseError] = useState('')
  const [doseForm, setDoseForm] = useState({ patientId: '', deviceId: '', doseValue: '', doseUnit: 'mGy', examType: 'CT' })
  const [doseSaving, setDoseSaving] = useState(false)

  const loadDoses = useCallback(async () => {
    setDoseLoading(true)
    setDoseError('')
    try {
      const res = await deviceMgmtApi.getDoseTracking()
      const raw = res.data as unknown
      const items: any[] = Array.isArray(raw) ? raw : (raw as any)?.items ?? []
      setDoseRecords(items.length > 0
        ? items.map((r: any) => ({
            id: String(r.id ?? ''),
            patientId: String(r.detail?.patientId ?? r.patientId ?? ''),
            deviceId: String(r.detail?.deviceId ?? r.deviceId ?? ''),
            doseValue: Number(r.detail?.doseValue ?? r.doseValue ?? 0),
            doseUnit: String(r.detail?.doseUnit ?? r.doseUnit ?? 'mGy'),
            examType: String(r.detail?.examType ?? r.examType ?? ''),
            recordedAt: String(r.detail?.recordedAt ?? r.createdAt ?? ''),
          }))
        : [])
    } catch (e) {
      setDoseError(e instanceof Error ? e.message : '剂量记录加载失败, 展示空列表')
    } finally {
      setDoseLoading(false)
    }
  }, [])

  useEffect(() => { void loadDoses() }, [loadDoses])

  const handleRecordDose = async () => {
    if (!doseForm.patientId.trim() || !doseForm.deviceId.trim()) { setDoseError('请填写患者ID和设备ID'); return }
    const value = Number(doseForm.doseValue)
    if (!Number.isFinite(value) || value <= 0) { setDoseError('剂量值必须为正数'); return }
    setDoseSaving(true)
    setDoseError('')
    try {
      const res = await deviceMgmtApi.recordDose({
        patientId: doseForm.patientId.trim(),
        deviceId: doseForm.deviceId.trim(),
        doseValue: value,
        doseUnit: doseForm.doseUnit,
        examType: doseForm.examType,
      })
      if (res.success) {
        setDoseRecords(prev => [{ ...res.data, recordedAt: res.data.recordedAt || new Date().toISOString() }, ...prev])
        setDoseForm({ patientId: '', deviceId: '', doseValue: '', doseUnit: 'mGy', examType: 'CT' })
      } else {
        setDoseError(res.error?.message ?? '剂量记录提交失败')
      }
    } catch (e) {
      setDoseError(e instanceof Error ? e.message : '剂量记录提交失败')
    } finally {
      setDoseSaving(false)
    }
  }

  const toNum = (v: unknown): number => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  // [G005 Wave1B] 设备状态更新: deviceMgmtApi.updateDevice (PUT /device-mgmt/devices/:id)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const handleUpdateDeviceState = async (id: string, state: string) => {
    setUpdatingId(id)
    const stateStatusMap: Record<string, Device['status']> = { IDLE: 'online', IN_USE: 'online', MAINTENANCE: 'maintenance', BROKEN: 'offline', OFFLINE: 'offline' }
    try {
      const res = await deviceMgmtApi.updateDevice(id, { state: state as any })
      if (res.success) {
        setDevices(prev => prev.map(d => d.id === id ? { ...d, status: stateStatusMap[state] ?? d.status } : d))
        message.success(`设备 ${id} 状态已更新: ${state}`)
      } else {
        message.error(res.error?.message ?? '状态更新失败')
      }
    } catch {
      message.error('状态更新失败')
    }
    setUpdatingId(null)
  }

  const loadDevices = useCallback(async () => {
    setLoading(true)
    setApiError('')
    try {
      const [lifeR, oeeR, faultsR, plansR, devicesR] = await Promise.allSettled([
        deviceMgmtApi.listEquipmentLifecycle(),
        oeeApi.list(),
        deviceMgmtApi.listDeviceFaults(),
        deviceMgmtApi.listMaintenancePlans(),
        deviceMgmtApi.listDevices(),
      ])
      const lifeRaw = lifeR.status === 'fulfilled' && lifeR.value.success ? lifeR.value.data : null
      const life: any[] = Array.isArray(lifeRaw) ? lifeRaw : (lifeRaw as any)?.items ?? []
      const oee = oeeR.status === 'fulfilled' && oeeR.value.success ? (oeeR.value.data as any[]) ?? [] : []
      const faultsRaw = faultsR.status === 'fulfilled' && faultsR.value.success ? faultsR.value.data : null
      const faultList: any[] = Array.isArray(faultsRaw) ? faultsRaw : (faultsRaw as any)?.items ?? []
      const plans = plansR.status === 'fulfilled' && plansR.value.success ? (plansR.value.data?.data ?? []) : []
      // [G005 Wave1B] 设备注册表: deviceMgmtApi.listDevices (GET /device-mgmt/devices)
      const devRaw = devicesR.status === 'fulfilled' && devicesR.value.success ? devicesR.value.data : null
      const devList: any[] = Array.isArray(devRaw) ? devRaw : (devRaw as any)?.items ?? []

      const anyReal = life.length > 0 || oee.length > 0 || faultList.length > 0 || plans.length > 0 || devList.length > 0
      if (!anyReal) {
        setDataSource('demo')
        setApiError('deviceMgmtApi 暂不可用，当前展示内置演示数据')
        return
      }
      setDataSource('api')

      const statusOf = (s: string): Device['status'] => {
        if (s === 'MAINTENANCE') return 'maintenance'
        if (s === 'RETIRED' || s === 'BROKEN' || s === 'OFFLINE') return 'offline'
        return 'online'
      }
      const oeeById = new Map<string, any>()
      oee.forEach((o: any) => oeeById.set(String(o.id), o))
      const lifeById = new Map<string, any>()
      life.forEach((l: any) => lifeById.set(String(l.id), l))

      const merged: Device[] = []
      const seen = new Set<string>()
      life.forEach((l: any) => {
        const o = oeeById.get(String(l.id)) || Array.from(oeeById.values()).find((x: any) => String(x.name).includes(String(l.name).slice(0, 3)))
        merged.push({
          id: l.id, name: `${l.name} (${l.model || '—'})`, type: l.modality || l.manufacturer || '设备',
          location: l.location || '—',
          status: statusOf(l.status),
          utilization: toNum(o?.oee ?? l.oee),
          lastMaintenance: String(l.lastMaintenanceDate || '').slice(0, 10) || '—',
          nextMaintenance: String(l.nextMaintenanceDate || '').slice(0, 10) || '—',
          firmware: '—', ip: '—',
        })
        seen.add(l.id)
      })
      oee.forEach((o: any) => {
        if (seen.has(String(o.id))) return
        merged.push({
          id: o.id, name: `${o.name} (${o.model || ''})`.trim(), type: o.modality || '设备',
          location: '—', status: 'online', utilization: toNum(o.oee),
          lastMaintenance: '—', nextMaintenance: '—', firmware: '—', ip: '—',
        })
      })
      // [G005 Wave1B] 设备注册表补充: listDevices (state: IDLE/IN_USE/MAINTENANCE/BROKEN/OFFLINE)
      const devStatusOf = (s: string): Device['status'] => {
        if (s === 'MAINTENANCE') return 'maintenance'
        if (s === 'BROKEN' || s === 'OFFLINE') return 'offline'
        return 'online'
      }
      devList.forEach((d: any) => {
        const id = String(d.id)
        if (seen.has(id)) return
        merged.push({
          id, name: d.name || d.code || id,
          type: d.modality || d.code || '设备',
          location: d.location || '—',
          status: devStatusOf(d.state ?? d.status),
          utilization: 0, lastMaintenance: '—', nextMaintenance: '—', firmware: '—', ip: '—',
        })
        seen.add(id)
      })
      if (merged.length > 0) setDevices(merged)

      setUtilData(merged.filter(d => d.status === 'online').map(d => ({ name: (d.name.split('(')[0] ?? '').trim(), utilization: d.utilization })))

      if (faultList.length > 0) {
        const nameOf = (deviceId: string) => {
          const l = lifeById.get(String(deviceId))
          if (l?.name) return l.name
          const m = merged.find(d => d.id === String(deviceId) || d.name.includes(deviceId))
          return m?.name || deviceId
        }
        setFaults(faultList.map((f: any) => ({
          device: nameOf(f.deviceId),
          issue: f.description || f.name || '未知故障',
          severity: ['CRITICAL', 'HIGH'].includes(String(f.severity)) ? 'critical' : 'warning',
          reported: String(f.createdAt || '').replace('T', ' ').slice(0, 16) || '—',
          eta: '—',
        })))
      }

      if (plans.length > 0) {
        setMaintLog(plans.map((p: any) => ({
          device: p.deviceName || p.deviceId || '—',
          action: [p.type, p.content].filter(Boolean).join(' · ') || '维护',
          performedBy: p.assignee || '—',
          date: String(p.maintenanceDate || '').slice(0, 10) || '—',
          result: p.status === 'COMPLETED' ? '通过' : p.status === 'CANCELLED' ? '已取消' : '待执行',
        })))
      }
    } catch (e) {
      setDataSource('demo')
      setApiError(e instanceof Error ? e.message : '数据加载失败，已回退演示数据')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadDevices() }, [loadDevices])

  const filtered = devices.filter(d => {
    if (filterType !== 'all' && d.type !== filterType) return false
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const types = [...new Set(devices.map(d => d.type))]

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Monitor size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>设备运营管理</span></div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>共 {devices.length} 台设备 · {dataSource === 'api' ? 'deviceMgmtApi 实时' : '演示数据'}</span>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999,
            background: dataSource === 'api' ? '#22c55e20' : '#f59e0b20', color: dataSource === 'api' ? '#22c55e' : '#f59e0b', fontWeight: 600,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dataSource === 'api' ? '#22c55e' : '#f59e0b' }} />
            {loading ? '数据同步中...' : dataSource === 'api' ? '数据源: deviceMgmtApi/oeeApi 实时' : '数据源: 演示数据'}
          </span>
          {apiError && (
            <span style={{ color: '#ef4444' }}>
              {apiError}
              <button onClick={() => void loadDevices()} style={{ marginLeft: 8, padding: '2px 10px', borderRadius: 4, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>重试</button>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          {['all', ...types].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: filterType === t ? '#1e40af' : '#21262d', color: filterType === t ? '#fff' : '#8b949e' }}>
              {t === 'all' ? '全部' : t}
            </button>
          ))}
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#6e7681' }} />
            <input placeholder="搜索设备..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ padding: '6px 12px 6px 32px', borderRadius: 6, border: '1px solid #30363d', background: '#161b22', color: '#f0f6fc', fontSize: 13, outline: 'none', width: 200 }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart size={16} color="#3b82f6" />设备使用率
            </div>
            <ChartContainer height={200} state={utilData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无设备使用率数据">
              <BarChart data={utilData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#8b949e' }} unit="%" />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d' }} />
                <Bar dataKey="utilization" fill="#3b82f6" radius={[4, 4, 0, 0]} name="使用率" />
              </BarChart>
            </ChartContainer>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} />设备故障/维护预警
            </div>
            {faults.map((f, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < faults.length - 1 ? '1px solid #21262d' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#f0f6fc' }}>{f.device}</span>
                  <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 4, background: f.severity === 'critical' ? '#ef444420' : '#f59e0b20', color: f.severity === 'critical' ? '#ef4444' : '#f59e0b' }}>
                    {f.severity === 'critical' ? '严重' : '警告'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>{f.issue}</div>
                <div style={{ fontSize: 12, color: '#6e7681', marginTop: 2 }}>预计修复: {f.eta}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px 90px 100px 110px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', background: '#0d1117', color: '#8b949e', fontSize: 12, fontWeight: 600 }}>
            <span /><span>设备名称</span><span>状态</span><span>类型</span><span>位置</span><span>下次维护</span>
          </div>
          {filtered.map((d, idx) => {
            const sc = STATUS_CONFIG[d.status]
            const isOpen = expandedId === d.id
            return (
              <div key={d.id}>
                <div onClick={() => setExpandedId(isOpen ? null : d.id)}
                  style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px 90px 100px 110px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', alignItems: 'center', background: idx % 2 === 0 ? '#0d1117' : '#161b22', cursor: 'pointer' }}>
                  <span style={{ color: '#6e7681' }}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Monitor size={14} color="#3b82f6" />
                    <span style={{ fontSize: 13 }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: sc.color }}>
                    <sc.icon size={12} />{sc.label}
                  </span>
                  <span style={{ fontSize: 12, color: '#8b949e' }}>{d.type}</span>
                  <span style={{ fontSize: 12, color: '#8b949e' }}>{d.location}</span>
                  <span style={{ fontSize: 12, color: '#6e7681' }}>{d.nextMaintenance}</span>
                </div>
                {isOpen && (
                  <div style={{ padding: '12px 16px 12px 48px', background: '#0d1117', borderBottom: '1px solid #21262d', display: 'flex', gap: 24, fontSize: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div><span style={{ color: '#6e7681' }}>固件: </span><span>{d.firmware}</span></div>
                    <div><span style={{ color: '#6e7681' }}>IP: </span><span>{d.ip}</span></div>
                    <div><span style={{ color: '#6e7681' }}>上一次维护: </span><span>{d.lastMaintenance}</span></div>
                    <div><span style={{ color: '#6e7681' }}>使用率: </span><span style={{ color: d.utilization > 80 ? '#22c55e' : '#f59e0b' }}>{d.utilization}%</span></div>
                    {/* [G005 Wave1B] 状态流转: deviceMgmtApi.updateDevice */}
                    {dataSource === 'api' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#6e7681' }}>状态: </span>
                        <select
                          value={({ online: 'IDLE', offline: 'OFFLINE', maintenance: 'MAINTENANCE' } as Record<string, string>)[d.status] ?? 'IDLE'}
                          onChange={e => void handleUpdateDeviceState(d.id, e.target.value)}
                          disabled={updatingId === d.id}
                          style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #30363d', background: '#161b22', color: '#f0f6fc', fontSize: 12 }}
                        >
                          {['IDLE', 'IN_USE', 'MAINTENANCE', 'BROKEN', 'OFFLINE'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color="#8b5cf6" />维护记录 {dataSource === 'api' && <span style={{ fontSize: 11, color: '#22c55e' }}>(maintenance-plans 实时)</span>}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>设备</th>
                <th style={{ textAlign: 'left', padding: '8px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>维护内容</th>
                <th style={{ textAlign: 'left', padding: '8px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>执行人</th>
                <th style={{ textAlign: 'left', padding: '8px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>日期</th>
                <th style={{ textAlign: 'left', padding: '8px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>结果</th>
              </tr>
            </thead>
            <tbody>
              {maintLog.map((m, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px', borderBottom: '1px solid #21262d', fontWeight: 500 }}>{m.device}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{m.action}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{m.performedBy}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{m.date}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #21262d', color: '#22c55e' }}>{m.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* [W1-B] 剂量追踪: deviceMgmtApi.getDoseTracking / recordDose */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Gauge size={16} color="#22d3ee" />剂量追踪 <span style={{ fontSize: 11, color: '#22d3ee' }}>(/device-mgmt/dose-tracking 实时)</span>
            <button onClick={() => void loadDoses()} style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 4, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 12 }}>刷新</button>
          </div>
          {doseError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{doseError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 12 }}>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>患者ID</th>
                    <th style={{ textAlign: 'left', padding: '8px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>设备ID</th>
                    <th style={{ textAlign: 'left', padding: '8px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>剂量</th>
                    <th style={{ textAlign: 'left', padding: '8px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>检查类型</th>
                    <th style={{ textAlign: 'left', padding: '8px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>记录时间</th>
                  </tr>
                </thead>
                <tbody>
                  {doseRecords.map(r => (
                    <tr key={r.id}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #21262d' }}>{r.patientId}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{r.deviceId}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #21262d', fontWeight: 600, color: '#22d3ee' }}>{r.doseValue} {r.doseUnit}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{r.examType}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #21262d', color: '#6e7681' }}>{(r.recordedAt ?? '').replace('T', ' ').slice(0, 16) || '—'}</td>
                    </tr>
                  ))}
                  {doseRecords.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: '#6e7681' }}>{doseLoading ? '剂量记录加载中...' : '暂无剂量记录, 请在右侧登记'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ background: '#0d1117', borderRadius: 6, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f6fc', marginBottom: 10 }}>登记剂量记录</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input placeholder="患者ID *" value={doseForm.patientId} onChange={e => setDoseForm({ ...doseForm, patientId: e.target.value })} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#161b22', color: '#f0f6fc', fontSize: 13, outline: 'none' }} />
                <input placeholder="设备ID *" value={doseForm.deviceId} onChange={e => setDoseForm({ ...doseForm, deviceId: e.target.value })} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#161b22', color: '#f0f6fc', fontSize: 13, outline: 'none' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
                  <input type="number" placeholder="剂量值 *" value={doseForm.doseValue} onChange={e => setDoseForm({ ...doseForm, doseValue: e.target.value })} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#161b22', color: '#f0f6fc', fontSize: 13, outline: 'none' }} />
                  <select value={doseForm.doseUnit} onChange={e => setDoseForm({ ...doseForm, doseUnit: e.target.value })} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#161b22', color: '#f0f6fc', fontSize: 13, outline: 'none' }}>
                    <option>mGy</option><option>mGy·cm</option><option>dGy</option>
                  </select>
                </div>
                <select value={doseForm.examType} onChange={e => setDoseForm({ ...doseForm, examType: e.target.value })} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#161b22', color: '#f0f6fc', fontSize: 13, outline: 'none' }}>
                  <option>CT</option><option>DR</option><option>DSA</option><option>MG</option><option>X-ray</option>
                </select>
                <button onClick={() => void handleRecordDose()} disabled={doseSaving} style={{ padding: '8px', borderRadius: 4, border: 'none', cursor: doseSaving ? 'wait' : 'pointer', background: '#22d3ee', color: '#0d1117', fontSize: 13, fontWeight: 600 }}>{doseSaving ? '提交中...' : '登记剂量'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
