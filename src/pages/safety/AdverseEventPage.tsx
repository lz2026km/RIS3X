import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'
import {
  AlertTriangle, CheckCircle, XCircle, Plus, Search,
  Activity, BarChart3, ShieldAlert,
} from 'lucide-react'
import {
  getAdverseEvents, getAdverseEventTrend, createAdverseEvent,
  type AdverseEvent, type EventSeverity, type EventStatus, type EventCategory, type AdverseEventTrendItem,
} from '../../services/api/safetyApi'
import { ChartContainer } from '../../components/charts'

const SEVERITY_COLORS: Record<EventSeverity, string> = {
  'near-miss': '#8b5cf6',
  minor: '#3b82f6',
  moderate: '#f59e0b',
  severe: '#ef4444',
  catastrophic: '#dc2626',
}


const SEVERITY_LABELS: Record<EventSeverity, string> = {
  'near-miss': '险情',
  minor: '轻微',
  moderate: '中度',
  severe: '严重',
  catastrophic: '灾难性',
};
const CATEGORY_LABELS: Record<EventCategory, string> = {
  'medication-error': '用药错误',
  'patient-identification': '患者身份识别',
  'contrast-reaction': '对比剂反应',
  'radiation-overdose': '辐射超量',
  fall: '跌倒',
  'specimen-error': '标本错误',
  'communication-failure': '沟通失败',
  'equipment-malfunction': '设备故障',
  'information-loss': '信息丢失',
  other: '其他',
}

const STATUS_LABELS: Record<EventStatus, string> = {
  reported: '已报告',
  investigating: '调查中',
  resolved: '已解决',
  closed: '已关闭',
}

export default function AdverseEventPage() {
  const [events, setEvents] = useState<AdverseEvent[]>([])
  const [trend, setTrend] = useState<AdverseEventTrendItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<EventStatus | 'all'>('all')
  const [formData, setFormData] = useState<Partial<AdverseEvent>>({})

  useEffect(() => { getAdverseEvents().then(d => setEvents(d ?? [])) }, [])
  useEffect(() => { getAdverseEventTrend().then(d => setTrend(d ?? [])) }, [])

  const filtered = filter === 'all' ? events : events.filter(e => e.status === filter)
  const trendChartData = trend.map(t => ({ period: t.period, total: t.total }))
  const categoryData = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.eventType] = (acc[e.eventType] ?? 0) + 1
    return acc
  }, {})
  const categoryChartData = Object.entries(categoryData).map(([k, v]) => ({
    name: CATEGORY_LABELS[k as EventCategory],
    count: v,
  }))

  const handleSubmit = async () => {
    if (!formData.eventType || !formData.severity || !formData.description) return
    await createAdverseEvent({
      eventType: formData.eventType as EventCategory,
      severity: formData.severity as EventSeverity,
      description: formData.description,
      department: formData.location ?? '未指定',
      reportedBy: formData.reportedBy ?? '当前用户',
      patientId: formData.patientId,
      patientName: formData.patientName,
      location: formData.location,
      contributingFactors: formData.contributingFactors ?? [],
      actionsTaken: formData.actionsTaken ?? [],
      rootCauseIds: [],
    })
    const data = await getAdverseEvents()
    setEvents(data)
    setShowForm(false)
    setFormData({})
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShieldAlert size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>不良事件报告</span>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus size={14} />报告事件
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {showForm && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>报告新不良事件</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <select style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} value={formData.eventType ?? ''} onChange={e => setFormData({ ...formData, eventType: e.target.value as EventCategory })}>
                <option value="">选择事件类型</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} value={formData.severity ?? ''} onChange={e => setFormData({ ...formData, severity: e.target.value as EventSeverity })}>
                <option value="">选择严重程度</option>
                {Object.entries(SEVERITY_COLORS).map(([k]) => <option key={k} value={k}>{SEVERITY_LABELS[k as EventSeverity] ?? k}</option>)}
              </select>
              <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} placeholder="患者姓名" value={formData.patientName ?? ''} onChange={e => setFormData({ ...formData, patientName: e.target.value })} />
              <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} placeholder="患者ID" value={formData.patientId ?? ''} onChange={e => setFormData({ ...formData, patientId: e.target.value })} />
              <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} placeholder="发生地点" value={formData.location ?? ''} onChange={e => setFormData({ ...formData, location: e.target.value })} />
              <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} placeholder="报告人" value={formData.reportedBy ?? ''} onChange={e => setFormData({ ...formData, reportedBy: e.target.value })} />
            </div>
            <textarea style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px', width: '100%', minHeight: 80, marginBottom: 12 }} placeholder="事件描述" value={formData.description ?? ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px', width: '100%', marginBottom: 12 }} placeholder="促成因素（逗号分隔）" value={(formData.contributingFactors ?? []).join(', ')} onChange={e => setFormData({ ...formData, contributingFactors: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSubmit} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer' }}>提交</button>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer' }}>取消</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { title: '本月事件', value: events.length, icon: AlertTriangle, color: '#ef4444' },
            { title: '调查中', value: events.filter(e => e.status === 'investigating').length, icon: Search, color: '#f59e0b' },
            { title: '已解决', value: events.filter(e => e.status === 'resolved').length, icon: CheckCircle, color: '#22c55e' },
            { title: '已关闭', value: events.filter(e => e.status === 'closed').length, icon: XCircle, color: '#8b949e' },
          ].map((k, i) => (
            <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#8b949e' }}>{k.title}</span>
                <k.icon size={20} style={{ color: k.color }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} color="#3b82f6" />事件趋势
            </div>
            <ChartContainer height={240} state={trendChartData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无事件趋势数据">
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                <Line type="monotone" dataKey="total" stroke="#7c3aed" strokeWidth={2} dot={{ fill: '#7c3aed' }} name="事件数量" />
              </LineChart>
            </ChartContainer>
          </div>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} color="#22c55e" />事件类型分布
            </div>
            <ChartContainer height={240} state={categoryChartData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无事件类型数据">
              <BarChart data={categoryChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} name="数量" />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['all', 'reported', 'investigating', 'resolved', 'closed'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${filter === s ? '#7c3aed' : '#30363d'}`, background: filter === s ? '#7c3aed20' : 'transparent', color: filter === s ? '#7c3aed' : '#8b949e', cursor: 'pointer', fontSize: 12 }}>
              {s === 'all' ? '全部' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>编号</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>类型</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>严重程度</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>患者</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>状态</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>报告人</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>日期</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#6e7681', fontSize: 12 }}>{e.id}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{CATEGORY_LABELS[e.eventType]}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: `${SEVERITY_COLORS[e.severity]}20`, color: SEVERITY_COLORS[e.severity] }}>{SEVERITY_LABELS[e.severity] ?? e.severity}</span>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#f0f6fc' }}>{e.patientName ?? '-'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: e.status === 'closed' ? '#22c55e20' : e.status === 'resolved' ? '#3b82f620' : e.status === 'investigating' ? '#f59e0b20' : '#8b949e20', color: e.status === 'closed' ? '#22c55e' : e.status === 'resolved' ? '#3b82f6' : e.status === 'investigating' ? '#f59e0b' : '#8b949e' }}>
                      {STATUS_LABELS[e.status]}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{e.reportedBy}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e', fontSize: 12 }}>{e.reportedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
