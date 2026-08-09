import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { ChartContainer } from '../../components/charts'
import { ShieldAlert, AlertTriangle, CheckCircle, Plus, BarChart3, Target, Send } from 'lucide-react'
import {
  getRiskItems, createRiskItem, updateRiskItem,
  type RiskItem, type RiskLevel, type RiskCategory,
} from '../../services/api/safetyApi'

const LEVEL_COLORS: Record<RiskLevel, string> = {
  'very-low': '#22c55e',
  low: '#3b82f6',
  medium: '#f59e0b',
  high: '#ef4444',
  'very-high': '#dc2626',
}

const LEVEL_LABELS: Record<RiskLevel, string> = {
  'very-low': '极低',
  low: '低',
  medium: '中',
  high: '高',
  'very-high': '极高',
}

const CATEGORY_LABELS: Record<string, string> = {
  clinical: '临床',
  operational: '运营',
  regulatory: '合规',
  financial: '财务',
  'it-security': '信息安全',
}

export default function RiskManagementPage() {
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showMitigate, setShowMitigate] = useState<string | null>(null)
  const [filter, setFilter] = useState<RiskLevel | 'all'>('all')
  const [formData, setFormData] = useState<Partial<RiskItem>>({})
  const [mitigateData, setMitigateData] = useState({ plan: '', owner: '', deadline: '' })

  useEffect(() => { getRiskItems().then(d => setRisks(d ?? [])) }, [])

  const filtered = filter === 'all' ? risks : risks.filter(r => r.riskLevel === filter)
  const byLevel = risks.reduce<Record<string, number>>((acc, r) => {
    acc[r.riskLevel] = (acc[r.riskLevel] ?? 0) + 1
    return acc
  }, {})
  const levelData = Object.entries(LEVEL_LABELS).map(([k, v]) => ({ name: v, count: byLevel[k] ?? 0 }))
  const byCategory = risks.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1
    return acc
  }, {})
  const categoryData = Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ name: v, count: byCategory[k] ?? 0 }))

  const handleSubmit = async () => {
    if (!formData.title || !formData.likelihood || !formData.severity) return
    await createRiskItem({
      riskType: formData.category ?? 'clinical',
      title: formData.title,
      description: formData.description ?? '',
      category: (formData.category ?? 'clinical') as RiskCategory,
      likelihood: formData.likelihood,
      severity: formData.severity,
      identifiedBy: formData.identifiedBy ?? '当前用户',
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
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#e11d48,#be123c)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShieldAlert size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>风险管理</span>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus size={14} />识别风险
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {showForm && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>识别新风险</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} placeholder="风险标题" value={formData.title ?? ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              <select style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} value={formData.category ?? ''} onChange={e => setFormData({ ...formData, category: e.target.value as RiskCategory })}>
                <option value="">选择类别</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div>
                <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 4 }}>可能性 (1-5)</label>
                <input type="number" min={1} max={5} style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px', width: '100%' }} value={formData.likelihood ?? ''} onChange={e => setFormData({ ...formData, likelihood: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#8b949e', display: 'block', marginBottom: 4 }}>影响程度 (1-5)</label>
                <input type="number" min={1} max={5} style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px', width: '100%' }} value={formData.severity ?? ''} onChange={e => setFormData({ ...formData, severity: parseInt(e.target.value) || 0 })} />
              </div>
              <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px' }} placeholder="识别者" value={formData.identifiedBy ?? ''} onChange={e => setFormData({ ...formData, identifiedBy: e.target.value })} />
            </div>
            <textarea style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px', width: '100%', minHeight: 60, marginBottom: 12 }} placeholder="风险描述" value={formData.description ?? ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSubmit} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#e11d48', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Send size={13} />提交</button>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer' }}>取消</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { title: '风险总数', value: risks.length, icon: ShieldAlert, color: '#e11d48' },
            { title: '极高/高风险', value: risks.filter(r => r.riskLevel === 'high' || r.riskLevel === 'very-high').length, icon: AlertTriangle, color: '#dc2626' },
            { title: '已缓解', value: risks.filter(r => r.status === 'mitigating').length, icon: CheckCircle, color: '#22c55e' },
            { title: '监控中', value: risks.filter(r => r.status === 'monitoring').length, icon: Target, color: '#3b82f6' },
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
              <BarChart3 size={16} color="#3b82f6" />风险等级分布
            </div>
            <ChartContainer height={200} state={levelData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无风险等级数据">
              <BarChart data={levelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                <Bar dataKey="count" fill="#e11d48" radius={[4, 4, 0, 0]} name="数量" />
              </BarChart>
            </ChartContainer>
          </div>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} color="#22c55e" />风险类别分布
            </div>
            <ChartContainer height={200} state={categoryData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无风险类别数据">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} name="数量" />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['all', 'very-low', 'low', 'medium', 'high', 'very-high'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${filter === s ? '#e11d48' : '#30363d'}`, background: filter === s ? '#e11d4820' : 'transparent', color: filter === s ? '#e11d48' : '#8b949e', cursor: 'pointer', fontSize: 12 }}>
              {s === 'all' ? '全部' : LEVEL_LABELS[s as RiskLevel]}
            </button>
          ))}
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ overflowX: "auto" }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>风险</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>类别</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>L×S</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>RPN</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>等级</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>状态</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>残余RPN</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{r.title}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e', fontSize: 12 }}>{CATEGORY_LABELS[r.category]}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{r.likelihood}×{r.severity}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', fontWeight: 700, color: LEVEL_COLORS[r.riskLevel] }}>{r.rpn}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: `${LEVEL_COLORS[r.riskLevel]}20`, color: LEVEL_COLORS[r.riskLevel] }}>{LEVEL_LABELS[r.riskLevel]}</span>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: r.status === 'mitigating' ? '#22c55e20' : r.status === 'monitoring' ? '#3b82f620' : '#8b949e20', color: r.status === 'mitigating' ? '#22c55e' : r.status === 'monitoring' ? '#3b82f6' : '#8b949e' }}>
                      {{ identified: '已识别', mitigating: '缓解中', monitoring: '监控中', closed: '已关闭' }[r.status]}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: r.residualRpn ? '#22c55e' : '#8b949e' }}>{r.residualRpn ?? '-'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                    {r.status === 'identified' && (
                      <button onClick={() => { setShowMitigate(r.id); setMitigateData({ plan: '', owner: '', deadline: '' }) }} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #e11d48', background: 'transparent', color: '#e11d48', cursor: 'pointer', fontSize: 12 }}>
                        制定缓解
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>

        {showMitigate && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 24, width: 400 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>制定风险缓解计划</div>
              <textarea style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px', width: '100%', minHeight: 60, marginBottom: 12 }} placeholder="缓解措施" value={mitigateData.plan} onChange={e => setMitigateData({ ...mitigateData, plan: e.target.value })} />
              <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px', width: '100%', marginBottom: 12 }} placeholder="负责人" value={mitigateData.owner} onChange={e => setMitigateData({ ...mitigateData, owner: e.target.value })} />
              <input style={{ background: '#0d1117', color: '#f0f6fc', border: '1px solid #30363d', borderRadius: 4, padding: '6px 10px', width: '100%', marginBottom: 12 }} type="date" value={mitigateData.deadline} onChange={e => setMitigateData({ ...mitigateData, deadline: e.target.value })} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleMitigate(showMitigate)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#e11d48', color: '#fff', cursor: 'pointer' }}>提交</button>
                <button onClick={() => setShowMitigate(null)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer' }}>取消</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
