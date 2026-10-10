import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { ChartContainer } from '../../components/charts'
import { StateView } from '../../components/common/StateView'
import { ShieldAlert, AlertTriangle, CheckCircle, Plus, BarChart3, Target, Send } from 'lucide-react'
import {
  getRiskItems, createRiskItem, updateRiskItem,
  type RiskItem, type RiskLevel, type RiskCategory,
} from '../../services/api/safetyApi'
import { t } from '../../i18n/appI18n'

const LEVEL_COLORS: Record<RiskLevel, string> = {
  'very-low': '#22c55e',
  low: '#3b82f6',
  medium: '#f59e0b',
  high: '#ef4444',
  'very-high': '#dc2626',
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
    <div style={{ background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#e11d48,#be123c)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShieldAlert size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>{t('riskMgmt.title')}</span>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus size={14} />{t('riskMgmt.identifyRisk')}
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {showForm && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{t('riskMgmt.identifyNewRisk')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} placeholder={t('riskMgmt.riskTitle')} value={formData.title ?? ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              <select style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} value={formData.category ?? ''} onChange={e => setFormData({ ...formData, category: e.target.value as RiskCategory })}>
                <option value="">{t('riskMgmt.selectCategory')}</option>
                {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{categoryLabel(k)}</option>)}
              </select>
              <div>
                <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 4 }}>{t('riskMgmt.likelihood')}</label>
                <input type="number" min={1} max={5} style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px', width: '100%' }} value={formData.likelihood ?? ''} onChange={e => setFormData({ ...formData, likelihood: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 4 }}>{t('riskMgmt.severity')}</label>
                <input type="number" min={1} max={5} style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px', width: '100%' }} value={formData.severity ?? ''} onChange={e => setFormData({ ...formData, severity: parseInt(e.target.value) || 0 })} />
              </div>
              <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} placeholder={t('riskMgmt.identifier')} value={formData.identifiedBy ?? ''} onChange={e => setFormData({ ...formData, identifiedBy: e.target.value })} />
            </div>
            <textarea style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px', width: '100%', minHeight: 60, marginBottom: 12 }} placeholder={t('riskMgmt.riskDescription')} value={formData.description ?? ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSubmit} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#e11d48', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Send size={13} />{t('riskMgmt.submit')}</button>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer' }}>{t('riskMgmt.cancel')}</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { title: t('riskMgmt.statTotal'), value: risks.length, icon: ShieldAlert, color: '#e11d48' },
            { title: t('riskMgmt.statHigh'), value: risks.filter(r => r.riskLevel === 'high' || r.riskLevel === 'very-high').length, icon: AlertTriangle, color: 'var(--color-error-600, #dc2626)' },
            { title: t('riskMgmt.statMitigated'), value: risks.filter(r => r.status === 'mitigating').length, icon: CheckCircle, color: 'var(--color-success-500, #22c55e)' },
            { title: t('riskMgmt.statMonitoring'), value: risks.filter(r => r.status === 'monitoring').length, icon: Target, color: 'var(--color-primary-500, #3b82f6)' },
          ].map((k, i) => (
            <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}><span style={{ fontSize: 12, color: '#8b949e' }}>{k.title}</span><k.icon size={20} style={{ color: k.color }} /></div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} color="#3b82f6" />{t('riskMgmt.levelDistribution')}
            </div>
            <ChartContainer height={200} state={levelData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('riskMgmt.noLevelData')}>
              <BarChart data={levelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                <Bar dataKey="count" fill="#e11d48" radius={[4, 4, 0, 0]} name={t('riskMgmt.count')} />
              </BarChart>
            </ChartContainer>
          </div>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} color="#22c55e" />{t('riskMgmt.categoryDistribution')}
            </div>
            <ChartContainer height={200} state={categoryData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('riskMgmt.noCategoryData')}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} name={t('riskMgmt.count')} />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['all', 'very-low', 'low', 'medium', 'high', 'very-high'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${filter === s ? '#e11d48' : '#30363d'}`, background: filter === s ? '#e11d4820' : 'transparent', color: filter === s ? '#e11d48' : '#8b949e', cursor: 'pointer', fontSize: 12 }}>
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
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('riskMgmt.colRisk')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('riskMgmt.colCategory')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>L×S</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>RPN</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('riskMgmt.colLevel')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('riskMgmt.colStatus')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('riskMgmt.colResidualRpn')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('riskMgmt.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{r.title}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e', fontSize: 12 }}>{categoryLabel(r.category)}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{r.likelihood}×{r.severity}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', fontWeight: 700, color: LEVEL_COLORS[r.riskLevel] }}>{r.rpn}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: `${LEVEL_COLORS[r.riskLevel]}20`, color: LEVEL_COLORS[r.riskLevel] }}>{levelLabel(r.riskLevel)}</span>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: r.status === 'mitigating' ? '#22c55e20' : r.status === 'monitoring' ? '#3b82f620' : '#8b949e20', color: r.status === 'mitigating' ? '#22c55e' : r.status === 'monitoring' ? '#3b82f6' : '#8b949e' }}>
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: r.residualRpn ? '#22c55e' : '#8b949e' }}>{r.residualRpn ?? '-'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                    {r.status === 'identified' && (
                      <button onClick={() => { setShowMitigate(r.id); setMitigateData({ plan: '', owner: '', deadline: '' }) }} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #e11d48', background: 'transparent', color: '#e11d48', cursor: 'pointer', fontSize: 12 }}>
                        {t('riskMgmt.developMitigation')}
                      </button>                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
        </StateView>

        {showMitigate && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 24, width: 400 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{t('riskMgmt.mitigationPlanTitle')}</div>
              <textarea style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px', width: '100%', minHeight: 60, marginBottom: 12 }} placeholder={t('riskMgmt.mitigationPlan')} value={mitigateData.plan} onChange={e => setMitigateData({ ...mitigateData, plan: e.target.value })} />
              <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px', width: '100%', marginBottom: 12 }} placeholder={t('riskMgmt.owner')} value={mitigateData.owner} onChange={e => setMitigateData({ ...mitigateData, owner: e.target.value })} />
              <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px', width: '100%', marginBottom: 12 }} type="date" value={mitigateData.deadline} onChange={e => setMitigateData({ ...mitigateData, deadline: e.target.value })} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleMitigate(showMitigate)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#e11d48', color: '#fff', cursor: 'pointer' }}>{t('riskMgmt.submit')}</button>
                <button onClick={() => setShowMitigate(null)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer' }}>{t('riskMgmt.cancel')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
