import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Monitor, AlertTriangle, CheckCircle, XCircle, Search, Clock, Settings, ChevronDown, ChevronRight } from 'lucide-react'
import { replayDeviceEvent } from '../../utils/deviceStateAdapter'

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

  const filtered = MOCK_DEVICES.filter(d => {
    if (filterType !== 'all' && d.type !== filterType) return false
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const types = [...new Set(MOCK_DEVICES.map(d => d.type))]

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Monitor size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>设备运营管理</span></div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>共 {MOCK_DEVICES.length} 台设备</span>
      </div>

      <div style={{ padding: '20px 24px' }}>
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
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={UTIL_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#8b949e' }} unit="%" />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d' }} />
                <Bar dataKey="utilization" fill="#3b82f6" radius={[4, 4, 0, 0]} name="使用率" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} />设备故障/维护预警
            </div>
            {FAULTS.map((f, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < FAULTS.length - 1 ? '1px solid #21262d' : 'none' }}>
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
                  <div style={{ padding: '12px 16px 12px 48px', background: '#0d1117', borderBottom: '1px solid #21262d', display: 'flex', gap: 24, fontSize: 12 }}>
                    <div><span style={{ color: '#6e7681' }}>固件: </span><span>{d.firmware}</span></div>
                    <div><span style={{ color: '#6e7681' }}>IP: </span><span>{d.ip}</span></div>
                    <div><span style={{ color: '#6e7681' }}>上一次维护: </span><span>{d.lastMaintenance}</span></div>
                    <div><span style={{ color: '#6e7681' }}>使用率: </span><span style={{ color: d.utilization > 80 ? '#22c55e' : '#f59e0b' }}>{d.utilization}%</span></div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color="#8b5cf6" />维护记录
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
              {MAINT_LOG.map((m, i) => (
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
      </div>
    </div>
  )
}
