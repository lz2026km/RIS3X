import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { Target, CheckCircle, TrendingUp, BarChart3, AlertTriangle, Plus } from 'lucide-react'
import { getPatientSafetyGoals, createPatientSafetyGoal, type PatientSafetyGoal } from '../../services/api/safetyApi'
import { ChartContainer } from '../../components/charts'
import { t } from '../../i18n/appI18n'

const CATEGORIES = ['身份识别', '手术安全', '用药安全', '危急值管理', '患者安全', '感染控制', '辐射安全', '服务品质']
const STATUS_CONFIG = {
  'on-track': { label: '正常推进', color: '#22c55e' },
  'at-risk': { label: '存在风险', color: '#f59e0b' },
  behind: { label: '落后计划', color: '#ef4444' },
  achieved: { label: '已完成', color: '#3b82f6' },
}

export default function PatientSafetyGoalsPage() {
  const [goals, setGoals] = useState<PatientSafetyGoal[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newGoal, setNewGoal] = useState<Partial<PatientSafetyGoal>>({ title: '', category: '身份识别', target: 100, current: 0, unit: '%', baseline: 0, deadline: '', owner: '', description: '' })

  useEffect(() => { getPatientSafetyGoals().then(setGoals) }, [])

  const handleCreateGoal = async () => {
    if (!newGoal.title?.trim() || !newGoal.deadline) return
    try {
      const created = await createPatientSafetyGoal({
        title: newGoal.title.trim(),
        description: newGoal.description || '',
        category: newGoal.category || '身份识别',
        target: Number(newGoal.target) || 100,
        current: Number(newGoal.current) || 0,
        unit: newGoal.unit || '%',
        baseline: Number(newGoal.baseline) || 0,
        deadline: newGoal.deadline,
        owner: newGoal.owner || '当前用户',
      })
      setGoals(prev => [created, ...prev])
    } catch { /* 演示环境使用本地状态 */ }
    setShowCreateModal(false)
    setNewGoal({ title: '', category: '身份识别', target: 100, current: 0, unit: '%', baseline: 0, deadline: '', owner: '', description: '' })
  }

  const filtered = categoryFilter === 'all' ? goals : goals.filter(g => g.category === categoryFilter)

  const progressData = goals.map(g => ({
    name: g.title.length > 10 ? g.title.slice(0, 10) + '...' : g.title,
    current: g.current,
    target: g.target,
    unit: g.unit,
    progress: g.unit === '%' ? Math.round(g.current / g.target * 100) : g.target === 0 ? Math.max(0, 100 - g.current * 20) : Math.round((1 - g.current / g.target) * 100),
  }))

  Object.entries(STATUS_CONFIG).map(([k, v]) => ({
    name: v.label,
    value: goals.filter(g => g.status === k).length,
    color: v.color,
  }));

  const categoryCompData = CATEGORIES.map(c => ({
    category: c,
    passed: goals.filter(g => g.category === c && (g.status === 'on-track' || g.status === 'achieved')).length,
    failed: goals.filter(g => g.category === c && (g.status === 'at-risk' || g.status === 'behind')).length,
  }))

  const overallProgress = Math.round(goals.filter(g => g.status === 'on-track' || g.status === 'achieved').length / goals.length * 100)

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Target size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>{t('safetyGoals.title')}</span>
        </div>
        <button onClick={() => setShowCreateModal(true)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus size={14} />{t('safetyGoals.newGoal')}
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { title: t('safetyGoals.totalGoals'), value: goals.length, icon: Target, color: '#3b82f6' },
            { title: t('safetyGoals.onTrack'), value: goals.filter(g => g.status === 'on-track').length, icon: CheckCircle, color: '#22c55e' },
            { title: t('safetyGoals.atRisk'), value: goals.filter(g => g.status === 'at-risk').length, icon: AlertTriangle, color: '#f59e0b' },
            { title: t('safetyGoals.achieved'), value: goals.filter(g => g.status === 'achieved').length, icon: CheckCircle, color: '#3b82f6' },
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
              <TrendingUp size={16} color="#3b82f6" />{t('safetyGoals.progressOverview')}
            </div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: overallProgress >= 80 ? '#22c55e' : overallProgress >= 60 ? '#f59e0b' : '#ef4444' }}>{overallProgress}%</div>
              <div style={{ fontSize: 12, color: '#8b949e' }}>{t('safetyGoals.overallRate')}</div>
            </div>
            <ChartContainer height={180} state={progressData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('safetyGoals.noProgressData')}>
              <BarChart data={progressData.slice(0, 6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: '#8b949e' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                <Bar dataKey="progress" fill="#3b82f6" radius={[0, 4, 4, 0]} name={t('safetyGoals.completionRate')} />
              </BarChart>
            </ChartContainer>
          </div>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} color="#22c55e" />{t('safetyGoals.categoryStatus')}
            </div>
            <ChartContainer height={240} state={categoryCompData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('safetyGoals.noCategoryData')}>
              <BarChart data={categoryCompData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="category" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="passed" fill="#22c55e" radius={[4, 4, 0, 0]} name={t('safetyGoals.passed')} stackId="a" />
                <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} name={t('safetyGoals.failed')} stackId="a" />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => setCategoryFilter('all')} style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${categoryFilter === 'all' ? '#2563eb' : '#30363d'}`, background: categoryFilter === 'all' ? '#2563eb20' : 'transparent', color: categoryFilter === 'all' ? '#2563eb' : '#8b949e', cursor: 'pointer', fontSize: 12 }}>{t('safetyGoals.all')}</button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)} style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${categoryFilter === c ? '#2563eb' : '#30363d'}`, background: categoryFilter === c ? '#2563eb20' : 'transparent', color: categoryFilter === c ? '#2563eb' : '#8b949e', cursor: 'pointer', fontSize: 12 }}>{c}</button>
          ))}
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('safetyGoals.colGoal')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('safetyGoals.colCategory')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('safetyGoals.colBaseline')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('safetyGoals.colCurrent')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('safetyGoals.colTarget')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('safetyGoals.colStatus')}</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>{t('safetyGoals.colOwner')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => {
                const cfg = STATUS_CONFIG[g.status]
                return (
                  <tr key={g.id}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                      <div style={{ fontSize: 13 }}>{g.title}</div>
                      <div style={{ fontSize: 12, color: '#6e7681' }}>{g.description}</div>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{g.category}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{g.baseline}{g.unit}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', fontWeight: 600 }}>{g.current}{g.unit}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#22c55e' }}>{g.target}{g.unit}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: `${cfg.color}20`, color: cfg.color }}>{cfg.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{g.owner}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowCreateModal(false)}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, width: 480, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #30363d' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}><Target size={16} color="#3b82f6" /> {t('safetyGoals.newGoalTitle')}</div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e', fontSize: 18, padding: 4 }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 6 }}>{t('safetyGoals.goalName')}</label>
                <input value={newGoal.title} onChange={e => setNewGoal({ ...newGoal, title: e.target.value })} placeholder={t('safetyGoals.goalNamePlaceholder')} style={{ width: '100%', padding: '8px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#f0f6fc', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 6 }}>{t('safetyGoals.category')}</label>
                <select value={newGoal.category} onChange={e => setNewGoal({ ...newGoal, category: e.target.value })} style={{ width: '100%', padding: '8px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#f0f6fc', fontSize: 13 }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 6 }}>{t('safetyGoals.baseline')}</label>
                  <input type="number" value={newGoal.baseline} onChange={e => setNewGoal({ ...newGoal, baseline: Number(e.target.value) })} style={{ width: '100%', padding: '8px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#f0f6fc', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 6 }}>{t('safetyGoals.current')}</label>
                  <input type="number" value={newGoal.current} onChange={e => setNewGoal({ ...newGoal, current: Number(e.target.value) })} style={{ width: '100%', padding: '8px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#f0f6fc', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 6 }}>{t('safetyGoals.target')}</label>
                  <input type="number" value={newGoal.target} onChange={e => setNewGoal({ ...newGoal, target: Number(e.target.value) })} style={{ width: '100%', padding: '8px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#f0f6fc', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 6 }}>{t('safetyGoals.unit')}</label>
                  <select value={newGoal.unit} onChange={e => setNewGoal({ ...newGoal, unit: e.target.value })} style={{ width: '100%', padding: '8px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#f0f6fc', fontSize: 13 }}>
                    {['%', '次', '例', '小时'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 6 }}>{t('safetyGoals.deadline')}</label>
                  <input type="date" value={newGoal.deadline} onChange={e => setNewGoal({ ...newGoal, deadline: e.target.value })} style={{ width: '100%', padding: '8px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#f0f6fc', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 6 }}>{t('safetyGoals.owner')}</label>
                <input value={newGoal.owner} onChange={e => setNewGoal({ ...newGoal, owner: e.target.value })} placeholder={t('safetyGoals.ownerPlaceholder')} style={{ width: '100%', padding: '8px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#f0f6fc', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 6 }}>{t('safetyGoals.description')}</label>
                <textarea value={newGoal.description} onChange={e => setNewGoal({ ...newGoal, description: e.target.value })} rows={2} placeholder={t('safetyGoals.descriptionPlaceholder')} style={{ width: '100%', padding: '8px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#f0f6fc', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowCreateModal(false)} style={{ padding: '8px 20px', background: '#21262d', border: '1px solid #30363d', borderRadius: 6, color: '#8b949e', fontSize: 13, cursor: 'pointer' }}>{t('safetyGoals.cancel')}</button>
                <button onClick={() => void handleCreateGoal()} disabled={!newGoal.title?.trim() || !newGoal.deadline} style={{ padding: '8px 20px', background: newGoal.title?.trim() && newGoal.deadline ? '#2563eb' : '#21262d', border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600, cursor: newGoal.title?.trim() && newGoal.deadline ? 'pointer' : 'not-allowed' }}>{t('safetyGoals.createGoal')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
