import { useState, useEffect, useCallback } from 'react'
import { message } from 'antd'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { Monitor, AlertTriangle, CheckCircle, XCircle, Search, Clock, Settings, Gauge } from 'lucide-react'
import { ChartContainer } from '../../components/charts'
import { StateView } from '../../components/common/StateView'
import { DataTable } from '../../components/common/DataTable'
import { replayDeviceEvent } from '../../utils/deviceStateAdapter'
// [W2-A] 设备运营接 deviceMgmtApi (equipment-lifecycle/faults/maintenance-plans) + oeeApi (利用率)
// [W1-B] 剂量追踪接 deviceMgmtApi.getDoseTracking/recordDose (POST /device-mgmt/dose-tracking)
import { deviceMgmtApi, type DoseRecord } from '../../services/api/deviceMgmtApi'
import { oeeApi } from '../../services/api/oeeApi'
import { t } from '../../i18n/appI18n'

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

const UTIL_DATA = MOCK_DEVICES.filter(d => d.status === 'online').map(d => ({ name: d.name.split('(')[0]?.trim() ?? d.name, utilization: d.utilization }))

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: typeof CheckCircle }> = {
  online: { color: 'var(--color-success-500)', label: t('w9e.deviceOps.stateOnline'), icon: CheckCircle },
  offline: { color: '#6e7681', label: t('w9e.deviceOps.stateOffline'), icon: XCircle },
  maintenance: { color: 'var(--color-warning-500)', label: t('w9e.deviceOps.stateMaintenance'), icon: Settings },
  fault: { color: 'var(--color-error-500)', label: t('w9e.deviceOps.stateFault'), icon: AlertTriangle },
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
      setDoseError(e instanceof Error ? e.message : t('deviceOps.doseLoadFailed'))
    } finally {
      setDoseLoading(false)
    }
  }, [])

  useEffect(() => { void loadDoses() }, [loadDoses])

  const handleRecordDose = async () => {
    if (!doseForm.patientId.trim() || !doseForm.deviceId.trim()) { setDoseError(t('deviceOps.fillPatientDevice')); return }
    const value = Number(doseForm.doseValue)
    if (!Number.isFinite(value) || value <= 0) { setDoseError(t('deviceOps.dosePositive')); return }
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
        setDoseError(res.error?.message ?? t('deviceOps.doseSubmitFailed'))
      }
    } catch (e) {
      setDoseError(e instanceof Error ? e.message : t('deviceOps.doseSubmitFailed'))
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
        message.success(t('w9e.deviceOps.deviceUpdated', { id, state }))
      } else {
        message.error(res.error?.message ?? t('deviceOps.statusUpdateFailed'))
      }
    } catch {
      message.error(t('deviceOps.statusUpdateFailed'))
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
        setApiError(t('deviceOps.apiUnavailable'))
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
          id: l.id, name: `${l.name} (${l.model || '—'})`, type: l.modality || l.manufacturer || t('w9e.deviceOps.deviceTypeFallback'),
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
          id: o.id, name: `${o.name} (${o.model || ''})`.trim(), type: o.modality || t('w9e.deviceOps.deviceTypeFallback'),
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
          type: d.modality || d.code || t('w9e.deviceOps.deviceTypeFallback'),
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
          issue: f.description || f.name || t('w9e.deviceOps.unknownFault'),
          severity: ['CRITICAL', 'HIGH'].includes(String(f.severity)) ? 'critical' : 'warning',
          reported: String(f.createdAt || '').replace('T', ' ').slice(0, 16) || '—',
          eta: '—',
        })))
      }

      if (plans.length > 0) {
        setMaintLog(plans.map((p: any) => ({
          device: p.deviceName || p.deviceId || '—',
          action: [p.type, p.content].filter(Boolean).join(' · ') || t('w9e.deviceOps.maintenanceFallback'),
          performedBy: p.assignee || '—',
          date: String(p.maintenanceDate || '').slice(0, 10) || '—',
          result: p.status === 'COMPLETED' ? t('w9e.deviceOps.resultPass') : p.status === 'CANCELLED' ? t('w9e.deviceOps.resultCancelled') : t('w9e.deviceOps.resultPending'),
        })))
      }
    } catch (e) {
      setDataSource('demo')
      setApiError(e instanceof Error ? e.message : t('deviceOps.loadFailedFallback'))
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

  const deviceColumns = [
    {
      title: t('deviceOps.colDeviceName'), dataIndex: 'name', key: 'name',
      render: (v: string) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Monitor size={14} color="var(--color-primary-500)" />
          <span>{v}</span>
        </span>
      ),
    },
    {
      title: t('deviceOps.colStatus'), dataIndex: 'status', key: 'status',
      render: (v: Device['status']) => {
        const sc = STATUS_CONFIG[v]
        return <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: sc?.color }}>{sc && <sc.icon size={12} />}{sc?.label}</span>
      },
    },
    { title: t('deviceOps.colType'), dataIndex: 'type', key: 'type', render: (v: string) => <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
    { title: t('deviceOps.colLocation'), dataIndex: 'location', key: 'location', render: (v: string) => <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
    { title: t('deviceOps.colNextMaintenance'), dataIndex: 'nextMaintenance', key: 'nextMaintenance', render: (v: string) => <span style={{ fontSize: 12, color: '#6e7681' }}>{v}</span> },
  ]

  return (
    <div style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,var(--color-primary-800),#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Monitor size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>{t('deviceOps.title')}</span></div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{t('deviceOps.summary', { count: devices.length, source: dataSource === 'api' ? t('deviceOps.realtime') : t('deviceOps.demo') })}</span>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999,
            background: dataSource === 'api' ? 'rgba(34,197,94,0.13)' : 'rgba(245,158,11,0.13)', color: dataSource === 'api' ? 'var(--color-success-500, var(--color-success-500))' : 'var(--color-warning-500, var(--color-warning-500))', fontWeight: 600,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dataSource === 'api' ? 'var(--color-success-500, var(--color-success-500))' : 'var(--color-warning-500, var(--color-warning-500))' }} />
            {loading ? t('deviceOps.syncing') : dataSource === 'api' ? t('deviceOps.sourceApi') : t('deviceOps.sourceDemo')}
          </span>
          {apiError && (
            <span style={{ color: 'var(--color-error-500, var(--color-error-500))' }}>
              {apiError}
              <button onClick={() => void loadDevices()} style={{ marginLeft: 8, padding: '2px 10px', borderRadius: 4, border: '1px solid var(--color-error-500, var(--color-error-500))', background: 'transparent', color: 'var(--color-error-500, var(--color-error-500))', cursor: 'pointer', fontSize: 12 }}>{t('deviceOps.retry')}</button>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          {['all', ...types].map(ty => (
            <button key={ty} onClick={() => setFilterType(ty)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: filterType === ty ? 'var(--color-primary-800)' : 'var(--bg-secondary, #21262d)', color: filterType === ty ? '#fff' : 'var(--text-muted, #8b949e)' }}>
              {ty === 'all' ? t('deviceOps.all') : ty}
            </button>
          ))}
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#6e7681' }} />
            <input placeholder={t('deviceOps.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
              style={{ padding: '6px 12px 6px 32px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-card, #161b22)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12, width: 200 }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary, #f0f6fc)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart {...({ size: 16, color: "var(--color-primary-500)" } as Record<string, unknown>)} />{t('deviceOps.utilizationTitle')}
            </div>
            <ChartContainer height={200} state={utilData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('deviceOps.noUtilization')}>
              <BarChart data={utilData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default, #30363d)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} unit="%" />
                <Tooltip contentStyle={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)' }} />
                <Bar dataKey="utilization" fill="var(--color-primary-500)" radius={[4, 4, 0, 0]} name={t('deviceOps.utilization')} />
              </BarChart>
            </ChartContainer>
          </div>

          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--color-error-500)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} />{t('deviceOps.faultTitle')}
            </div>
            {faults.map((f, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < faults.length - 1 ? '1px solid var(--bg-secondary, #21262d)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-primary, #f0f6fc)' }}>{f.device}</span>
                  <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 4, background: f.severity === 'critical' ? '#ef444420' : '#f59e0b20', color: f.severity === 'critical' ? 'var(--color-error-500)' : 'var(--color-warning-500)' }}>
                    {f.severity === 'critical' ? t('deviceOps.severityCritical') : t('deviceOps.severityWarning')}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginTop: 4 }}>{f.issue}</div>
                <div style={{ fontSize: 12, color: '#6e7681', marginTop: 2 }}>{t('deviceOps.etaPrefix')}: {f.eta}</div>
              </div>
            ))}
          </div>
        </div>

        <StateView empty={filtered.length === 0} emptyDescription={t('w2d.empty')}>
        <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
          <DataTable
            dataSource={filtered}
            rowKey="id"
            columns={deviceColumns}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            emptyText={t('w2d.empty')}
            expandable={{
              expandedRowKeys: expandedId ? [expandedId] : [],
              onExpand: (expanded, record) => setExpandedId(expanded ? (record as Device).id : null),
              expandedRowRender: (record) => {
                const d = record as Device
                return (
                  <div style={{ display: 'flex', gap: 24, fontSize: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div><span style={{ color: '#6e7681' }}>{t('deviceOps.firmware')}: </span><span>{d.firmware}</span></div>
                    <div><span style={{ color: '#6e7681' }}>IP: </span><span>{d.ip}</span></div>
                    <div><span style={{ color: '#6e7681' }}>{t('deviceOps.lastMaintenance')}: </span><span>{d.lastMaintenance}</span></div>
                    <div><span style={{ color: '#6e7681' }}>{t('deviceOps.utilization')}: </span><span style={{ color: d.utilization > 80 ? 'var(--color-success-500)' : 'var(--color-warning-500)' }}>{d.utilization}%</span></div>
                    {/* [G005 Wave1B] 状态流转: deviceMgmtApi.updateDevice */}
                    {dataSource === 'api' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#6e7681' }}>{t('deviceOps.status')}: </span>
                        <select
                          value={({ online: 'IDLE', offline: 'OFFLINE', maintenance: 'MAINTENANCE' } as Record<string, string>)[d.status] ?? 'IDLE'}
                          onChange={e => void handleUpdateDeviceState(d.id, e.target.value)}
                          disabled={updatingId === d.id}
                          style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-card, #161b22)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12 }}
                        >
                          {['IDLE', 'IN_USE', 'MAINTENANCE', 'BROKEN', 'OFFLINE'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )
              },
            }}
          />
        </div>
        </StateView>

        <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary, #f0f6fc)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color="#8b5cf6" />{t('deviceOps.maintRecords')} {dataSource === 'api' && <span style={{ fontSize: 11, color: 'var(--color-success-500)' }}>{t('deviceOps.maintRealtime')}</span>}
          </div>
          <DataTable
            dataSource={maintLog}
            rowKey={(m) => `${m.device}-${m.date}-${m.action}`}
            pagination={false}
            columns={[
              { title: t('deviceOps.colDevice'), dataIndex: 'device', render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
              { title: t('deviceOps.colMaintContent'), dataIndex: 'action', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
              { title: t('deviceOps.colPerformer'), dataIndex: 'performedBy', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
              { title: t('deviceOps.colDate'), dataIndex: 'date', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
              { title: t('deviceOps.colResult'), dataIndex: 'result', render: (v: string) => <span style={{ color: 'var(--color-success-500)' }}>{v}</span> },
            ]}
          />
        </div>

        {/* [W1-B] 剂量追踪: deviceMgmtApi.getDoseTracking / recordDose */}
        <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary, #f0f6fc)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Gauge size={16} color="#22d3ee" />{t('deviceOps.doseTracking')} <span style={{ fontSize: 11, color: '#22d3ee' }}>{t('deviceOps.doseRealtime')}</span>
            <button onClick={() => void loadDoses()} style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'transparent', color: 'var(--text-muted, #8b949e)', cursor: 'pointer', fontSize: 12 }}>{t('deviceOps.refresh')}</button>
          </div>
          {doseError && <div style={{ fontSize: 12, color: 'var(--color-error-500)', marginBottom: 8 }}>{doseError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 12 }}>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              <DataTable
                dataSource={doseRecords}
                rowKey="id"
                pagination={false}
                loading={doseLoading}
                emptyText={t('deviceOps.noDoseRecords')}
                columns={[
                  { title: t('deviceOps.colPatientId'), dataIndex: 'patientId' },
                  { title: t('deviceOps.colDeviceId'), dataIndex: 'deviceId', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
                  { title: t('deviceOps.colDose'), key: 'dose', render: (_: unknown, r: DoseRecord) => <span style={{ fontWeight: 600, color: '#22d3ee' }}>{r.doseValue} {r.doseUnit}</span> },
                  { title: t('deviceOps.colExamType'), dataIndex: 'examType', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
                  { title: t('deviceOps.colRecordedAt'), dataIndex: 'recordedAt', render: (v: string) => <span style={{ color: '#6e7681' }}>{(v ?? '').replace('T', ' ').slice(0, 16) || '—'}</span> },
                ]}
              />
            </div>
            <div style={{ background: 'var(--bg-primary, #0d1117)', borderRadius: 6, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #f0f6fc)', marginBottom: 10 }}>{t('deviceOps.registerDose')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input placeholder={t('deviceOps.patientIdPlaceholder')} value={doseForm.patientId} onChange={e => setDoseForm({ ...doseForm, patientId: e.target.value })} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-card, #161b22)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12,}} />
                <input placeholder={t('deviceOps.deviceIdPlaceholder')} value={doseForm.deviceId} onChange={e => setDoseForm({ ...doseForm, deviceId: e.target.value })} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-card, #161b22)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12,}} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
                  <input type="number" placeholder={t('deviceOps.doseValuePlaceholder')} value={doseForm.doseValue} onChange={e => setDoseForm({ ...doseForm, doseValue: e.target.value })} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-card, #161b22)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12,}} />
                  <select value={doseForm.doseUnit} onChange={e => setDoseForm({ ...doseForm, doseUnit: e.target.value })} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-card, #161b22)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12,}}>
                    <option>mGy</option><option>mGy·cm</option><option>dGy</option>
                  </select>
                </div>
                <select value={doseForm.examType} onChange={e => setDoseForm({ ...doseForm, examType: e.target.value })} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-card, #161b22)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12,}}>
                  <option>CT</option><option>DR</option><option>DSA</option><option>MG</option><option>X-ray</option>
                </select>
                <button onClick={() => void handleRecordDose()} disabled={doseSaving} style={{ padding: '8px', borderRadius: 4, border: 'none', cursor: doseSaving ? 'wait' : 'pointer', background: '#22d3ee', color: '#0d1117', fontSize: 12, fontWeight: 600 }}>{doseSaving ? t('deviceOps.submitting') : t('deviceOps.registerDoseBtn')}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
