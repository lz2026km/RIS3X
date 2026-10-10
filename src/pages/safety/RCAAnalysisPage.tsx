import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { Search, CheckCircle, AlertTriangle, FileText, Plus, BarChart3 } from 'lucide-react'
import { ChartContainer } from '../../components/charts'
import { StateView } from '../../components/common/StateView'
import {
  getRcaInvestigations, createRcaInvestigation, updateRcaInvestigation,
  type RcaInvestigation, type RcaStatus,
} from '../../services/api/safetyApi'
import { t } from '../../i18n/appI18n'
import { statusColor } from '../../theme/statusTokens'

const STATUS_LABELS: Record<RcaStatus, string> = {
  open: 'rca.status.open',
  analyzing: 'rca.status.analyzing',
  'capa-planned': 'rca.status.capa_planned',
  implementing: 'rca.status.implementing',
  verified: 'rca.status.verified',
  closed: 'rca.status.closed',
}

const STATUS_COLORS: Record<RcaStatus, string> = {
  open: statusColor('open'),
  analyzing: statusColor('in_progress'),
  'capa-planned': statusColor('on_hold'),
  implementing: statusColor('in_progress'),
  verified: statusColor('verified'),
  closed: statusColor('closed'),
}

export default function RCAAnalysisPage() {
  const [rcas, setRcas] = useState<RcaInvestigation[]>([])
  const [selectedRca, setSelectedRca] = useState<RcaInvestigation | null>(null)
  const [filter, setFilter] = useState<RcaStatus | 'all'>('all')

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await getRcaInvestigations()
      setRcas(data)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('w2d.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = filter === 'all' ? rcas : rcas.filter(r => r.capaStatus === filter)
  const statusData = Object.entries(STATUS_LABELS).map(([k, v]) => ({
    name: t(v), count: rcas.filter(r => r.capaStatus === k).length,
  }))
  const capaStatusData = rcas.flatMap(r => r.capaPlans ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.implementationStatus] = (acc[c.implementationStatus] ?? 0) + 1
    return acc
  }, {})
  const capaChartData = Object.entries(capaStatusData).map(([k, v]) => ({
    name: t({ pending: 'rca.capa.pending', 'in-progress': 'rca.capa.in_progress', completed: 'rca.capa.completed' }[k] ?? k),
    count: v,
  }))

  const handleCreateRca = async () => {
    const rca = await createRcaInvestigation({
      adverseEventId: `AE-${String(rcas.length + 1).padStart(3, '0')}`,
      eventTitle: t('rca.newInvestigation'),
      description: t('rca.newInvestigationDesc'),
      dateOccurred: new Date().toISOString(),
      teamMembers: [],
      fishboneData: [],
      fiveWhys: [],
      rootCauses: [],
      capaPlans: [],
    })
    const data = await getRcaInvestigations()
    setRcas(data)
    setSelectedRca(rca)
  }

  const handleCloseRca = async () => {
    if (!selectedRca) return
    await updateRcaInvestigation(selectedRca.id, {
      capaStatus: 'closed',
      closedBy: t('rca.currentUser'),
      closedAt: new Date().toISOString(),
      conclusion: t('rca.conclusionDone'),
      lessonsLearned: t('rca.lessonsLearned'),
    })
    const data = await getRcaInvestigations()
    setRcas(data)
    setSelectedRca(null)
  }

  return (
    <div style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Search size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>{t('rca.title')}</span>
        </div>
        <button onClick={handleCreateRca} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus size={14} />{t('rca.newRca')}
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { title: t('rca.statTotal'), value: rcas.length, icon: FileText, color: 'var(--color-error-600, #dc2626)' },
            { title: t('rca.status.analyzing'), value: rcas.filter(r => r.capaStatus === 'analyzing').length, icon: Search, color: 'var(--color-primary-500, #3b82f6)' },
            { title: t('rca.statImplementing'), value: rcas.filter(r => r.capaStatus === 'implementing').length, icon: AlertTriangle, color: 'var(--color-modality-mr, #8b5cf6)' },
            { title: t('rca.status.closed'), value: rcas.filter(r => r.capaStatus === 'closed').length, icon: CheckCircle, color: 'var(--color-success-500, #22c55e)' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}><span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{k.title}</span><k.icon size={20} style={{ color: k.color }} /></div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {selectedRca ? (
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedRca.eventTitle}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{selectedRca.id} · {selectedRca.dateOccurred}</div>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: 4, fontSize: 12, background: `${STATUS_COLORS[selectedRca.capaStatus]}20`, color: STATUS_COLORS[selectedRca.capaStatus] }}>{t(STATUS_LABELS[selectedRca.capaStatus])}</span>
            </div>
            <div style={{ marginBottom: 16, color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{selectedRca.description}</div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t('rca.rootCauses')}</div>
              {(selectedRca.rootCauses ?? []).length > 0 ? (
                <ul style={{ margin: 0, padding: '0 0 0 20px', color: '#ef4444', fontSize: 13 }}>
                  {(selectedRca.rootCauses ?? []).map((rc, i) => <li key={i}>{rc}</li>)}
                </ul>
              ) : (
                <div style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{t('rca.noRootCauses')}</div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t('rca.fishbone')}</div>
              {(selectedRca.fishboneData ?? []).length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {(selectedRca.fishboneData ?? []).map((fb, i) => (
                    <div key={i} style={{ background: 'var(--bg-primary, #0d1117)', borderRadius: 6, padding: 12, border: '1px solid var(--bg-secondary, #21262d)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 6 }}>{fb.category}</div>
                      {fb.causes.map((c, j) => <div key={j} style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 2 }}>• {c}</div>)}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{t('rca.noFishbone')}</div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t('rca.fiveWhys')}</div>
              {(selectedRca.fiveWhys ?? []).length > 0 ? (selectedRca.fiveWhys ?? []).map((fw, i) => (
                <div key={i} style={{ background: 'var(--bg-primary, #0d1117)', borderRadius: 6, padding: 12, border: '1px solid var(--bg-secondary, #21262d)', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 4 }}>{t('rca.problem')}: {fw.problem}</div>
                  {fw.whys.map((w, j) => (
                    <div key={j} style={{ fontSize: 12, marginBottom: 2, paddingLeft: `${w.level * 20}px` }}>
                      <span style={{ color: '#3b82f6' }}>{t('rca.why')} </span><span style={{ color: 'var(--text-primary, #f0f6fc)' }}>{w.answer}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 12, color: '#22c55e', marginTop: 4 }}>{t('rca.rootCause')}: {fw.rootCause}</div>
                </div>
              )) : (
                <div style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{t('rca.noFiveWhys')}</div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t('rca.capaPlans')}</div>
              {(selectedRca.capaPlans ?? []).length > 0 ? (selectedRca.capaPlans ?? []).map((cp, i) => (
                <div key={i} style={{ background: 'var(--bg-primary, #0d1117)', borderRadius: 6, padding: 12, border: '1px solid var(--bg-secondary, #21262d)', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary, #f0f6fc)' }}>{cp.id}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: cp.implementationStatus === 'completed' ? '#22c55e20' : cp.implementationStatus === 'in-progress' ? '#3b82f620' : '#8b949e20', color: cp.implementationStatus === 'completed' ? '#22c55e' : cp.implementationStatus === 'in-progress' ? '#3b82f6' : 'var(--text-muted, #8b949e)' }}>
                      {t({ pending: 'rca.capa.pending', 'in-progress': 'rca.capa.in_progress', completed: 'rca.capa.completed' }[cp.implementationStatus] ?? cp.implementationStatus)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{t('rca.corrective')}: {cp.correctiveAction}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{t('rca.preventive')}: {cp.preventiveAction}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{t('rca.responsible')}: {cp.responsiblePerson} | {t('rca.deadline')}: {cp.deadline}</div>
                </div>
              )) : (
                <div style={{ color: 'var(--text-muted, #8b949e)', fontSize: 13 }}>{t('rca.noCapa')}</div>
              )}
            </div>

            {selectedRca.capaStatus !== 'closed' && (
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <button onClick={handleCloseRca} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
                  {t('rca.closeRca')}
                </button>
                <button onClick={() => setSelectedRca(null)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'transparent', color: 'var(--text-muted, #8b949e)', cursor: 'pointer', fontSize: 13 }}>
                  {t('rca.back')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart3 size={16} color="#3b82f6" />{t('rca.statusChart')}
                </div>
                <ChartContainer height={200} state={statusData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('rca.noStatusData')}>
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default, #30363d)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, fontSize: 12 }} />
                    <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} name={t('rca.count')} />
                  </BarChart>
                </ChartContainer>
              </div>
              <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={16} color="#22c55e" />{t('rca.capaChart')}
                </div>
                <ChartContainer height={200} state={capaChartData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('rca.noCapaData')}>
                  <BarChart data={capaChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default, #30363d)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, fontSize: 12 }} />
                    <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} name={t('rca.count')} />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['all', 'open', 'analyzing', 'capa-planned', 'implementing', 'verified', 'closed'] as const).map(s => (
                <button key={s} onClick={() => setFilter(s)} style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${filter === s ? '#dc2626' : 'var(--border-default, #30363d)'}`, background: filter === s ? '#dc262620' : 'transparent', color: filter === s ? '#dc2626' : 'var(--text-muted, #8b949e)', cursor: 'pointer', fontSize: 12 }}>
                  {s === 'all' ? t('rca.all') : t(STATUS_LABELS[s as RcaStatus])}
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
              <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted, #8b949e)', borderBottom: '1px solid var(--border-default, #30363d)' }}>{t('rca.colId')}</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted, #8b949e)', borderBottom: '1px solid var(--border-default, #30363d)' }}>{t('rca.colEventTitle')}</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted, #8b949e)', borderBottom: '1px solid var(--border-default, #30363d)' }}>{t('rca.colStatus')}</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted, #8b949e)', borderBottom: '1px solid var(--border-default, #30363d)' }}>{t('rca.colTeam')}</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted, #8b949e)', borderBottom: '1px solid var(--border-default, #30363d)' }}>{t('rca.colRootCauses')}</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted, #8b949e)', borderBottom: '1px solid var(--border-default, #30363d)' }}>{t('rca.colCapa')}</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted, #8b949e)', borderBottom: '1px solid var(--border-default, #30363d)' }}>{t('rca.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-secondary, #21262d)', color: '#6e7681', fontSize: 12 }}>{r.id}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-secondary, #21262d)' }}>{r.eventTitle}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-secondary, #21262d)' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: `${STATUS_COLORS[r.capaStatus]}20`, color: STATUS_COLORS[r.capaStatus] }}>{t(STATUS_LABELS[r.capaStatus])}</span>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-secondary, #21262d)', color: 'var(--text-muted, #8b949e)', fontSize: 12 }}>{(r.teamMembers ?? []).join(', ') || '-'}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-secondary, #21262d)' }}>{(r.rootCauses ?? []).length}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-secondary, #21262d)' }}>{(r.capaPlans ?? []).length}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-secondary, #21262d)' }}>
                        <button onClick={() => setSelectedRca(r)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'transparent', color: '#3b82f6', cursor: 'pointer', fontSize: 12 }}>
                          {t('rca.view')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
            </StateView>
          </>
        )}
      </div>
    </div>
  )
}
