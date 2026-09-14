import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'
import {
  AlertTriangle, CheckCircle, XCircle, Plus, Search,
  Activity, BarChart3, ShieldAlert, Send,
} from 'lucide-react'
import {
  getAdverseEvents, getAdverseEventTrend, createAdverseEvent,
  type AdverseEvent, type EventSeverity, type EventStatus, type EventCategory, type AdverseEventTrendItem,
} from '../../services/api/safetyApi'
import { ChartContainer } from '../../components/charts'
import { StateView } from '../../components/common/StateView'
import { t } from '../../i18n/appI18n'

const SEVERITY_COLORS: Record<EventSeverity, string> = {
  'near-miss': '#8b5cf6',
  minor: '#3b82f6',
  moderate: '#f59e0b',
  severe: '#ef4444',
  catastrophic: '#dc2626',
}


const SEVERITY_LABELS: Record<EventSeverity, string> = {
  'near-miss': 'ade.severity.near_miss',
  minor: 'ade.severity.minor',
  moderate: 'ade.severity.moderate',
  severe: 'ade.severity.severe',
  catastrophic: 'ade.severity.catastrophic',
};
const CATEGORY_LABELS: Record<EventCategory, string> = {
  'medication-error': 'ade.category.medication_error',
  'patient-identification': 'ade.category.patient_identification',
  'contrast-reaction': 'ade.category.contrast_reaction',
  'radiation-overdose': 'ade.category.radiation_overdose',
  fall: 'ade.category.fall',
  'specimen-error': 'ade.category.specimen_error',
  'communication-failure': 'ade.category.communication_failure',
  'equipment-malfunction': 'ade.category.equipment_malfunction',
  'information-loss': 'ade.category.information_loss',
  other: 'ade.category.other',
}

const STATUS_LABELS: Record<EventStatus, string> = {
  reported: 'ade.status.reported',
  investigating: 'ade.status.investigating',
  resolved: 'ade.status.resolved',
  closed: 'ade.status.closed',
}

export default function AdverseEventPage() {
  const [events, setEvents] = useState<AdverseEvent[]>([])
  const [trend, setTrend] = useState<AdverseEventTrendItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<EventStatus | 'all'>('all')
  const [formData, setFormData] = useState<Partial<AdverseEvent>>({})

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [evts, tr] = await Promise.all([getAdverseEvents(), getAdverseEventTrend()])
      setEvents(evts ?? [])
      setTrend(tr ?? [])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('w2d.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = filter === 'all' ? events : events.filter(e => e.status === filter)
  const trendChartData = trend.map(tr => ({ period: tr.period, total: tr.total }))
  const categoryData = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.eventType] = (acc[e.eventType] ?? 0) + 1
    return acc
  }, {})
  const categoryChartData = Object.entries(categoryData).map(([k, v]) => ({
    name: t(CATEGORY_LABELS[k as EventCategory]),
    count: v,
  }))

  const handleSubmit = async () => {
    if (!formData.eventType || !formData.severity || !formData.description) return
    await createAdverseEvent({
      eventType: formData.eventType as EventCategory,
      severity: formData.severity as EventSeverity,
      description: formData.description,
      department: formData.location ?? t('ade.unspecified'),
      reportedBy: formData.reportedBy ?? t('ade.currentUser'),
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
          <ShieldAlert size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>{t('ade.title')}</span>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus size={14} />{t('ade.reportEvent')}
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {showForm && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{t('ade.newEvent')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <select style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} value={formData.eventType ?? ''} onChange={e => setFormData({ ...formData, eventType: e.target.value as EventCategory })}>
                <option value="">{t('ade.selectEventType')}</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
              </select>
              <select style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} value={formData.severity ?? ''} onChange={e => setFormData({ ...formData, severity: e.target.value as EventSeverity })}>
                <option value="">{t('ade.selectSeverity')}</option>
                {Object.entries(SEVERITY_COLORS).map(([k]) => <option key={k} value={k}>{t(SEVERITY_LABELS[k as EventSeverity] ?? k)}</option>)}
              </select>
              <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} placeholder={t('ade.patientName')} value={formData.patientName ?? ''} onChange={e => setFormData({ ...formData, patientName: e.target.value })} />
              <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} placeholder={t('ade.patientId')} value={formData.patientId ?? ''} onChange={e => setFormData({ ...formData, patientId: e.target.value })} />
              <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} placeholder={t('ade.location')} value={formData.location ?? ''} onChange={e => setFormData({ ...formData, location: e.target.value })} />
              <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} placeholder={t('ade.reportedBy')} value={formData.reportedBy ?? ''} onChange={e => setFormData({ ...formData, reportedBy: e.target.value })} />
            </div>
            <textarea style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px', width: '100%', minHeight: 80, marginBottom: 12 }} placeholder={t('ade.description')} value={formData.description ?? ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px', width: '100%', marginBottom: 12 }} placeholder={t('ade.contributingFactors')} value={(formData.contributingFactors ?? []).join(', ')} onChange={e => setFormData({ ...formData, contributingFactors: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSubmit} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Send size={13} />{t('ade.submit')}</button>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer' }}>{t('ade.cancel')}</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { title: t('ade.monthEvents'), value: events.length, icon: AlertTriangle, color: 'var(--color-error-500, #ef4444)' },
            { title: t('ade.investigating'), value: events.filter(e => e.status === 'investigating').length, icon: Search, color: 'var(--color-warning-500, #f59e0b)' },
            { title: t('ade.resolved'), value: events.filter(e => e.status === 'resolved').length, icon: CheckCircle, color: 'var(--color-success-500, #22c55e)' },
            { title: t('ade.closed'), value: events.filter(e => e.status === 'closed').length, icon: XCircle, color: '#8b949e' },
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
              <Activity size={16} color="#3b82f6" />{t('ade.trendTitle')}
            </div>
            <ChartContainer height={240} state={trendChartData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('ade.noTrendData')}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                <Line type="monotone" dataKey="total" stroke="#7c3aed" strokeWidth={2} dot={{ fill: '#7c3aed' }} name={t('ade.eventCount')} />
              </LineChart>
            </ChartContainer>
          </div>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} color="#22c55e" />{t('ade.typeDistribution')}
            </div>
            <ChartContainer height={240} state={categoryChartData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('ade.noTypeData')}>
              <BarChart data={categoryChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} name={t('ade.count')} />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['all', 'reported', 'investigating', 'resolved', 'closed'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${filter === s ? '#7c3aed' : '#30363d'}`, background: filter === s ? '#7c3aed20' : 'transparent', color: filter === s ? '#7c3aed' : '#8b949e', cursor: 'pointer', fontSize: 12 }}>
              {s === 'all' ? t('ade.all') : t(STATUS_LABELS[s])}
            </button>
          ))}
        </div>

        <StateView
          loading={loading}
          error={loadError}
          empty={!loading && !loadError && filtered.length === 0}
          emptyDescription={t('w2d.empty')}
          onRetry={() => void load()}
          skeletonRows={5}
        >
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('ade.colId')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('ade.colType')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('ade.colSeverity')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('ade.colPatient')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('ade.colStatus')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('ade.colReporter')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('ade.colDate')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#6e7681', fontSize: 12 }}>{e.id}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{t(CATEGORY_LABELS[e.eventType])}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: `${SEVERITY_COLORS[e.severity]}20`, color: SEVERITY_COLORS[e.severity] }}>{t(SEVERITY_LABELS[e.severity] ?? e.severity)}</span>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#f0f6fc' }}>{e.patientName ?? '-'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: e.status === 'closed' ? '#22c55e20' : e.status === 'resolved' ? '#3b82f620' : e.status === 'investigating' ? '#f59e0b20' : '#8b949e20', color: e.status === 'closed' ? '#22c55e' : e.status === 'resolved' ? '#3b82f6' : e.status === 'investigating' ? '#f59e0b' : '#8b949e' }}>
                      {t(STATUS_LABELS[e.status])}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{e.reportedBy}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e', fontSize: 12 }}>{e.reportedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </StateView>
      </div>
    </div>
  )
}
