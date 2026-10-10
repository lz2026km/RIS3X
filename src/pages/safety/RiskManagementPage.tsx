import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { ChartContainer } from '../../components/charts'
import { StateView } from '../../components/common/StateView'
import { DataTable } from '../../components/common'
import { ShieldAlert, AlertTriangle, CheckCircle, Plus, BarChart3, Target, Send } from 'lucide-react'
import {
  getRiskItems, createRiskItem, updateRiskItem,
  type RiskItem, type RiskLevel, type RiskCategory,
} from '../../services/api/safetyApi'
import { t } from '../../i18n/appI18n'

const LEVEL_COLORS: Record<RiskLevel, string> = {
  'very-low': 'var(--color-success-500)',
  low: 'var(--color-primary-500)',
  medium: 'var(--color-warning-500)',
  high: 'var(--color-error-500)',
  'very-high': 'var(--color-error-600)',
}

const LEVEL_KEYS: RiskLevel[] = ['very-low', 'low', 'medium', 'high', 'very-high']
const CATEGORY_KEYS = ['clinical', 'operational', 'regulatory', 'financial', 'it-security']

const levelLabel = (level: RiskLevel): string => ({
  'very-low': t('riskMgmt.levelVeryLow'),
  low: t('riskMgmt.levelLow'),
  medium: t('riskMgmt.levelMedium'),
  high: t('riskMgmt.levelHigh'),
  'very-high': t('riskMgmt.levelVeryHigh'),
}[level] ?? level)

const categoryLabel = (cat: string): string => ({
  clinical: t('riskMgmt.catClinical'),
  operational: t('riskMgmt.catOperational'),
  regulatory: t('riskMgmt.catRegulatory'),
  financial: t('riskMgmt.catFinancial'),
  'it-security': t('riskMgmt.catItSecurity'),
}[cat] ?? cat)

const statusLabel = (status: string): string => ({
  identified: t('riskMgmt.statusIdentified'),
  mitigating: t('riskMgmt.statusMitigating'),
  monitoring: t('riskMgmt.statusMonitoring'),
  closed: t('riskMgmt.statusClosed'),
}[status] ?? status)

export default function RiskManagementPage() {
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showMitigate, setShowMitigate] = useState<string | null>(null)
  const [filter, setFilter] = useState<RiskLevel | 'all'>('all')
  const [formData, setFormData] = useState<Partial<RiskItem>>({})
  const [mitigateData, setMitigateData] = useState({ plan: '', owner: '', deadline: '' })

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const d = await getRiskItems()
      setRisks(d ?? [])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('w2d.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = filter === 'all' ? risks : risks.filter(r => r.riskLevel === filter)
  const byLevel = risks.reduce<Record<string, number>>((acc, r) => {
    acc[r.riskLevel] = (acc[r.riskLevel] ?? 0) + 1
    return acc
  }, {})
  const levelData = LEVEL_KEYS.map((k) => ({ name: levelLabel(k), count: byLevel[k] ?? 0 }))
  const byCategory = risks.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1
    return acc
  }, {})
  const categoryData = CATEGORY_KEYS.map((k) => ({ name: categoryLabel(k), count: byCategory[k] ?? 0 }))

  const handleSubmit = async () => {
    if (!formData.title || !formData.likelihood || !formData.severity) return
    await createRiskItem({
      riskType: formData.category ?? 'clinical',
      title: formData.title,
      description: formData.description ?? '',
      category: (formData.category ?? 'clinical') as RiskCategory,
      likelihood: formData.likelihood,
      severity: formData.severity,
      identifiedBy: formData.identifiedBy ?? t('riskMgmt.defaultUser'),
    })
    const data = await getRiskItems()
    setRisks(data)
    setShowForm(false)
    setFormData({})
  }

  const handleMitigate = async (riskId: string) => {
    await updateRiskItem(riskId, {
      mitigationPlan: mitigateData.plan,
      mitigationOwner: mitigateData.owner,
      mitigationDeadline: mitigateData.deadline,
      status: 'mitigating',
    })
    const data = await getRiskItems()
    setRisks(data)
    setShowMitigate(null)
    setMitigateData({ plan: '', owner: '', deadline: '' })
  }

  return (
    <div style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#e11d48,#be123c)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)' }}>
          <ShieldAlert size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>{t('riskMgmt.title')}</span>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <Plus size={14} />{t('riskMgmt.identifyRisk')}
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {showForm && (
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 'var(--space-5, 20px)', marginBottom: 'var(--space-5, 20px)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-4, 16px)' }}>{t('riskMgmt.identifyNewRisk')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-3, 12px)' }}>
              <input style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, padding: '6px 10px' }} placeholder={t('riskMgmt.riskTitle')} value={formData.title ?? ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              <select style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, padding: '6px 10px' }} value={formData.category ?? ''} onChange={e => setFormData({ ...formData, category: e.target.value as RiskCategory })}>
                <option value="">{t('riskMgmt.selectCategory')}</option>
                {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{categoryLabel(k)}</option>)}
              </select>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', display: 'block', marginBottom: 'var(--space-1, 4px)' }}>{t('riskMgmt.likelihood')}</label>
                <input type="number" min={1} max={5} style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, padding: '6px 10px', width: '100%' }} value={formData.likelihood ?? ''} onChange={e => setFormData({ ...formData, likelihood: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', display: 'block', marginBottom: 'var(--space-1, 4px)' }}>{t('riskMgmt.severity')}</label>
                <input type="number" min={1} max={5} style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, padding: '6px 10px', width: '100%' }} value={formData.severity ?? ''} onChange={e => setFormData({ ...formData, severity: parseInt(e.target.value) || 0 })} />
              </div>
              <input style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, padding: '6px 10px' }} placeholder={t('riskMgmt.identifier')} value={formData.identifiedBy ?? ''} onChange={e => setFormData({ ...formData, identifiedBy: e.target.value })} />
            </div>
            <textarea style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, padding: '6px 10px', width: '100%', minHeight: 60, marginBottom: 'var(--space-3, 12px)' }} placeholder={t('riskMgmt.riskDescription')} value={formData.description ?? ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
              <button onClick={handleSubmit} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#e11d48', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}><Send size={13} />{t('riskMgmt.submit')}</button>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'transparent', color: 'var(--text-muted, #8b949e)', cursor: 'pointer' }}>{t('riskMgmt.cancel')}</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-6, 24px)', flexWrap: 'wrap' }}>
          {[
            { title: t('riskMgmt.statTotal'), value: risks.length, icon: ShieldAlert, color: '#e11d48' },
            { title: t('riskMgmt.statHigh'), value: risks.filter(r => r.riskLevel === 'high' || r.riskLevel === 'very-high').length, icon: AlertTriangle, color: 'var(--color-error-600, var(--color-error-600))' },
            { title: t('riskMgmt.statMitigated'), value: risks.filter(r => r.status === 'mitigating').length, icon: CheckCircle, color: 'var(--color-success-500, var(--color-success-500))' },
            { title: t('riskMgmt.statMonitoring'), value: risks.filter(r => r.status === 'monitoring').length, icon: Target, color: 'var(--color-primary-500, var(--color-primary-500))' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2, 8px)' }}><span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{k.title}</span><k.icon size={20} style={{ color: k.color }} /></div>
              <div style={{ fontSize: 30, fontWeight: 700 }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-6, 24px)' }}>
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 'var(--space-4, 16px)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
              <BarChart3 size={16} color="var(--color-primary-500)" />{t('riskMgmt.levelDistribution')}
            </div>
            <ChartContainer height={200} state={levelData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('riskMgmt.noLevelData')}>
              <BarChart data={levelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default, #30363d)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, fontSize: 12 }} />
                <Bar dataKey="count" fill="#e11d48" radius={[4, 4, 0, 0]} name={t('riskMgmt.count')} />
              </BarChart>
            </ChartContainer>
          </div>
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 'var(--space-4, 16px)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
              <BarChart3 size={16} color="var(--color-success-500)" />{t('riskMgmt.categoryDistribution')}
            </div>
            <ChartContainer height={200} state={categoryData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('riskMgmt.noCategoryData')}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default, #30363d)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--color-success-500)" radius={[4, 4, 0, 0]} name={t('riskMgmt.count')} />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-3, 12px)' }}>
          {(['all', 'very-low', 'low', 'medium', 'high', 'very-high'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${filter === s ? '#e11d48' : 'var(--border-default, #30363d)'}`, background: filter === s ? '#e11d4820' : 'transparent', color: filter === s ? '#e11d48' : 'var(--text-muted, #8b949e)', cursor: 'pointer', fontSize: 12 }}>
              {s === 'all' ? t('riskMgmt.filterAll') : levelLabel(s as RiskLevel)}
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
              { title: t('riskMgmt.colRisk'), dataIndex: 'title', key: 'title' },
              { title: t('riskMgmt.colCategory'), dataIndex: 'category', key: 'category', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 12 }}>{categoryLabel(v)}</span> },
              { title: 'L×S', key: 'ls', render: (_v, r) => <span>{r.likelihood}×{r.severity}</span> },
              { title: 'RPN', dataIndex: 'rpn', key: 'rpn', render: (v: number, r) => <span style={{ fontWeight: 700, color: LEVEL_COLORS[r.riskLevel] }}>{v}</span> },
              {
                title: t('riskMgmt.colLevel'),
                dataIndex: 'riskLevel',
                key: 'riskLevel',
                render: (v: RiskLevel) => <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: `${LEVEL_COLORS[v]}20`, color: LEVEL_COLORS[v] }}>{levelLabel(v)}</span>,
              },
              {
                title: t('riskMgmt.colStatus'),
                dataIndex: 'status',
                key: 'status',
                render: (v: string) => <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: v === 'mitigating' ? '#22c55e20' : v === 'monitoring' ? '#3b82f620' : '#8b949e20', color: v === 'mitigating' ? 'var(--color-success-500)' : v === 'monitoring' ? 'var(--color-primary-500)' : 'var(--text-muted, #8b949e)' }}>{statusLabel(v)}</span>,
              },
              { title: t('riskMgmt.colResidualRpn'), key: 'residualRpn', render: (_v, r) => <span style={{ color: r.residualRpn ? 'var(--color-success-500)' : 'var(--text-muted, #8b949e)' }}>{r.residualRpn ?? '-'}</span> },
              {
                title: t('riskMgmt.colActions'),
                key: 'actions',
                render: (_v, r) => (
                  r.status === 'identified' && (
                    <button onClick={() => { setShowMitigate(r.id); setMitigateData({ plan: '', owner: '', deadline: '' }) }} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #e11d48', background: 'transparent', color: '#e11d48', cursor: 'pointer', fontSize: 12 }}>
                      {t('riskMgmt.developMitigation')}
                    </button>
                  )
                ),
              },
            ]}
          />
        </div>
        </StateView>

        {showMitigate && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 'var(--space-6, 24px)', width: 400 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-4, 16px)' }}>{t('riskMgmt.mitigationPlanTitle')}</div>
              <textarea style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, padding: '6px 10px', width: '100%', minHeight: 60, marginBottom: 'var(--space-3, 12px)' }} placeholder={t('riskMgmt.mitigationPlan')} value={mitigateData.plan} onChange={e => setMitigateData({ ...mitigateData, plan: e.target.value })} />
              <input style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, padding: '6px 10px', width: '100%', marginBottom: 'var(--space-3, 12px)' }} placeholder={t('riskMgmt.owner')} value={mitigateData.owner} onChange={e => setMitigateData({ ...mitigateData, owner: e.target.value })} />
              <input style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, padding: '6px 10px', width: '100%', marginBottom: 'var(--space-3, 12px)' }} type="date" value={mitigateData.deadline} onChange={e => setMitigateData({ ...mitigateData, deadline: e.target.value })} />
              <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
                <button onClick={() => handleMitigate(showMitigate)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#e11d48', color: '#fff', cursor: 'pointer' }}>{t('riskMgmt.submit')}</button>
                <button onClick={() => setShowMitigate(null)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'transparent', color: 'var(--text-muted, #8b949e)', cursor: 'pointer' }}>{t('riskMgmt.cancel')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
