import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { ChartContainer } from '../../components/charts'
import { StateView } from '../../components/common/StateView'
import { DataTable } from '../../components/common'
import { TrendingUp, CheckCircle, Target, Plus, BarChart3, Activity } from 'lucide-react'
import {
  getCqiDashboard, createCqiProject, closeCqiProject,
  type CqiProject, type CqiStatus,
} from '../../services/api/safetyApi'
import { t } from '../../i18n/appI18n'
import { statusColor } from '../../theme/statusTokens'

const STATUS_LABELS: Record<CqiStatus, string> = {
  planning: 'cqi.status.planning',
  active: 'cqi.status.active',
  sustaining: 'cqi.status.sustaining',
  closed: 'cqi.status.closed',
}

const STATUS_COLORS: Record<CqiStatus, string> = {
  planning: statusColor('draft'),
  active: statusColor('in_progress'),
  sustaining: statusColor('completed'),
  closed: statusColor('closed'),
}

export default function CQIPage() {
  const [projects, setProjects] = useState<CqiProject[]>([])
  const [selectedProject, setSelectedProject] = useState<CqiProject | null>(null)
  const [filter, setFilter] = useState<CqiStatus | 'all'>('all')

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await getCqiDashboard()
      setProjects(data)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('w2d.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter)
  const statusData = Object.entries(STATUS_LABELS).map(([k, v]) => ({
    name: t(v), count: projects.filter(p => p.status === k).length,
  }))
  const indicatorData = projects.flatMap(p => p.indicators.map(ind => ({
    project: p.title.length > 8 ? p.title.slice(0, 8) + '..' : p.title,
    indicator: ind.name,
    current: ind.currentValue,
    target: ind.targetValue,
    baseline: ind.baselineValue,
  })))

  return (
    <div style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TrendingUp size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>{t('cqi.title')}</span>
        </div>
        <button onClick={() => {
          createCqiProject({
            title: t('cqi.newProjectTitle'),
            description: t('cqi.newProjectDesc'),
            aim: t('cqi.newProjectAim'),
            indicators: [],
            pdsaCycles: [],
            sponsor: t('cqi.currentUser'),
            teamMembers: [],
            startDate: new Date().toISOString().slice(0, 10),
            targetEndDate: '',
          }).then(() => getCqiDashboard().then(setProjects))
        }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <Plus size={14} />{t('cqi.newProject')}
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { title: t('cqi.statProjects'), value: projects.length, icon: Target, color: 'var(--color-info-600, #0891b2)' },
            { title: t('cqi.status.active'), value: projects.filter(p => p.status === 'active').length, icon: Activity, color: 'var(--color-primary-500, #3b82f6)' },
            { title: t('cqi.status.sustaining'), value: projects.filter(p => p.status === 'sustaining').length, icon: CheckCircle, color: 'var(--color-success-500, #22c55e)' },
            { title: t('cqi.statPdsa'), value: projects.reduce((s, p) => s + p.pdsaCycles.length, 0), icon: BarChart3, color: 'var(--color-modality-mr, #8b5cf6)' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}><span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{k.title}</span><k.icon size={20} style={{ color: k.color }} /></div>
              <div style={{ fontSize: 30, fontWeight: 700 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {selectedProject ? (
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedProject.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{selectedProject.id} · {selectedProject.startDate} ~ {selectedProject.targetEndDate || t('cqi.tbd')}</div>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: 4, fontSize: 12, background: `${STATUS_COLORS[selectedProject.status]}20`, color: STATUS_COLORS[selectedProject.status] }}>{t(STATUS_LABELS[selectedProject.status])}</span>
            </div>
            <div style={{ marginBottom: 16, color: 'var(--text-muted, #8b949e)', fontSize: 12 }}>{selectedProject.description}</div>
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bg-primary, #0d1117)', borderRadius: 6, border: '1px solid var(--bg-secondary, #21262d)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 4 }}>{t('cqi.aim')}</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary, #f0f6fc)' }}>{selectedProject.aim}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t('cqi.indicators')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {selectedProject.indicators.map((ind, i) => (
                  <div key={i} style={{ background: 'var(--bg-primary, #0d1117)', borderRadius: 6, padding: 12, border: '1px solid var(--bg-secondary, #21262d)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 4 }}>{ind.name}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: ind.trend === 'up' ? '#22c55e' : ind.trend === 'down' ? '#ef4444' : '#f59e0b' }}>
                      {ind.currentValue}{ind.unit}
                    </div>
                    <div style={{ fontSize: 12, color: '#6e7681' }}>{t('cqi.baseline')}: {ind.baselineValue} → {t('cqi.target')}: {ind.targetValue}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t('cqi.pdsaCycles')}</div>
              {selectedProject.pdsaCycles.length > 0 ? selectedProject.pdsaCycles.map((pd, i) => (
                <div key={i} style={{ background: 'var(--bg-primary, #0d1117)', borderRadius: 6, padding: 12, border: '1px solid var(--bg-secondary, #21262d)', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>PDSA #{pd.cycle}</span>
                    <span style={{ fontSize: 12, color: '#6e7681' }}>{pd.startDate} ~ {pd.endDate}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                    <div><span style={{ color: '#3b82f6' }}>{t('cqi.plan')}</span> {pd.plan}</div>
                    <div><span style={{ color: '#22c55e' }}>{t('cqi.do')}</span> {pd.do_}</div>
                    <div><span style={{ color: '#f59e0b' }}>{t('cqi.study')}</span> {pd.study}</div>
                    <div><span style={{ color: '#8b5cf6' }}>{t('cqi.act')}</span> {pd.act}</div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: pd.success ? '#22c55e' : '#ef4444' }}>
                    {pd.outcome} {pd.success ? '' : ''}
                  </div>
                </div>
              )) : (
                <div style={{ color: 'var(--text-muted, #8b949e)', fontSize: 12 }}>{t('cqi.noPdsa')}</div>
              )}
            </div>

            {selectedProject.status !== 'closed' && (
              <div style={{ marginTop: 16 }}>
                <button onClick={async () => {
                  await closeCqiProject(selectedProject.id, t('cqi.closeConclusion'), t('cqi.closeLessons'))
                  const data = await getCqiDashboard()
                  setProjects(data)
                  setSelectedProject(null)
                }} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0891b2', color: '#fff', cursor: 'pointer', fontSize: 12 }}>
                  {t('cqi.closeProject')}
                </button>
                <button onClick={() => setSelectedProject(null)} style={{ marginLeft: 8, padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'transparent', color: 'var(--text-muted, #8b949e)', cursor: 'pointer', fontSize: 12 }}>
                  {t('cqi.back')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart3 size={16} color="#3b82f6" />{t('cqi.statusChart')}
                </div>
                <ChartContainer height={200} state={statusData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('cqi.noStatusData')}>
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default, #30363d)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, fontSize: 12 }} />
                    <Bar dataKey="count" fill="#0891b2" radius={[4, 4, 0, 0]} name={t('cqi.count')} />
                  </BarChart>
                </ChartContainer>
              </div>
              <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={16} color="#22c55e" />{t('cqi.indicatorChart')}
                </div>
                <ChartContainer height={200} state={indicatorData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('cqi.noIndicatorData')}>
                  <BarChart data={indicatorData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default, #30363d)" />
                    <XAxis dataKey="indicator" tick={{ fontSize: 10, fill: 'var(--text-muted, #8b949e)' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="baseline" fill="#6e7681" radius={[4, 4, 0, 0]} name={t('cqi.baseline')} />
                    <Bar dataKey="current" fill="#22c55e" radius={[4, 4, 0, 0]} name={t('cqi.current')} />
                    <Bar dataKey="target" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t('cqi.target')} />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['all', 'planning', 'active', 'sustaining', 'closed'] as const).map(s => (
                <button key={s} onClick={() => setFilter(s)} style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${filter === s ? '#0891b2' : 'var(--border-default, #30363d)'}`, background: filter === s ? '#0891b220' : 'transparent', color: filter === s ? '#0891b2' : 'var(--text-muted, #8b949e)', cursor: 'pointer', fontSize: 12 }}>
                  {s === 'all' ? t('cqi.all') : t(STATUS_LABELS[s as CqiStatus])}
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
            <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, overflow: 'hidden' }}>
              <DataTable
                rowKey="id"
                dataSource={filtered}
                columns={[
                  { title: t('cqi.colProject'), dataIndex: 'title', key: 'title' },
                  { title: t('cqi.colAim'), dataIndex: 'aim', key: 'aim', ellipsis: true },
                  {
                    title: t('cqi.colStatus'),
                    dataIndex: 'status',
                    key: 'status',
                    render: (v: CqiStatus) => <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: `${STATUS_COLORS[v]}20`, color: STATUS_COLORS[v] }}>{t(STATUS_LABELS[v])}</span>,
                  },
                  { title: 'PDSA', key: 'pdsaCycles', render: (_v, p) => p.pdsaCycles.length },
                  { title: t('cqi.colIndicators'), key: 'indicators', render: (_v, p) => p.indicators.length },
                  { title: t('cqi.colOwner'), dataIndex: 'sponsor', key: 'sponsor', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
                  {
                    title: t('cqi.colActions'),
                    key: 'actions',
                    render: (_v, p) => (
                      <button onClick={() => setSelectedProject(p)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'transparent', color: '#3b82f6', cursor: 'pointer', fontSize: 12 }}>
                        {t('cqi.view')}
                      </button>
                    ),
                  },
                ]}
              />
            </div>
            </StateView>
          </>
        )}
      </div>
    </div>
  )
}
