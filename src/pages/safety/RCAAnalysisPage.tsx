import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Search, CheckCircle, AlertTriangle, FileText, Plus, BarChart3 } from 'lucide-react'
import {
  getRcaInvestigations, createRcaInvestigation, updateRcaInvestigation,
  type RcaInvestigation, type RcaStatus,
} from '../../services/api/safetyApi'

const STATUS_LABELS: Record<RcaStatus, string> = {
  open: '待分析',
  analyzing: '分析中',
  'capa-planned': '已制定CAPA',
  implementing: '实施中',
  verified: '已验证',
  closed: '已关闭',
}

const STATUS_COLORS: Record<RcaStatus, string> = {
  open: '#8b949e',
  analyzing: '#3b82f6',
  'capa-planned': '#f59e0b',
  implementing: '#8b5cf6',
  verified: '#22c55e',
  closed: '#6e7681',
}

export default function RCAAnalysisPage() {
  const [rcas, setRcas] = useState<RcaInvestigation[]>([])
  const [selectedRca, setSelectedRca] = useState<RcaInvestigation | null>(null)
  const [filter, setFilter] = useState<RcaStatus | 'all'>('all')

  useEffect(() => { getRcaInvestigations().then(setRcas) }, [])

  const filtered = filter === 'all' ? rcas : rcas.filter(r => r.capaStatus === filter)
  const statusData = Object.entries(STATUS_LABELS).map(([k, v]) => ({
    name: v, count: rcas.filter(r => r.capaStatus === k).length,
  }))
  const capaStatusData = rcas.flatMap(r => r.capaPlans ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.implementationStatus] = (acc[c.implementationStatus] ?? 0) + 1
    return acc
  }, {})
  const capaChartData = Object.entries(capaStatusData).map(([k, v]) => ({
    name: { pending: '待执行', 'in-progress': '进行中', completed: '已完成' }[k] ?? k,
    count: v,
  }))

  const handleCreateRca = async () => {
    const rca = await createRcaInvestigation({
      adverseEventId: `AE-${String(rcas.length + 1).padStart(3, '0')}`,
      eventTitle: '新调查',
      description: '待补充事件描述',
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
      closedBy: '当前用户',
      closedAt: new Date().toISOString(),
      conclusion: 'RCA调查完成',
      lessonsLearned: '总结经验教训',
    })
    const data = await getRcaInvestigations()
    setRcas(data)
    setSelectedRca(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Search size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>根因分析 (RCA)</span>
        </div>
        <button onClick={handleCreateRca} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Plus size={14} />新建RCA
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { title: 'RCA总数', value: rcas.length, icon: FileText, color: '#dc2626' },
            { title: '分析中', value: rcas.filter(r => r.capaStatus === 'analyzing').length, icon: Search, color: '#3b82f6' },
            { title: 'CAPA实施中', value: rcas.filter(r => r.capaStatus === 'implementing').length, icon: AlertTriangle, color: '#8b5cf6' },
            { title: '已关闭', value: rcas.filter(r => r.capaStatus === 'closed').length, icon: CheckCircle, color: '#22c55e' },
          ].map((k, i) => (
            <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}><span style={{ fontSize: 12, color: '#8b949e' }}>{k.title}</span><k.icon size={20} style={{ color: k.color }} /></div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {selectedRca ? (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedRca.eventTitle}</div>
                <div style={{ fontSize: 12, color: '#8b949e' }}>{selectedRca.id} · {selectedRca.dateOccurred}</div>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: 4, fontSize: 12, background: `${STATUS_COLORS[selectedRca.capaStatus]}20`, color: STATUS_COLORS[selectedRca.capaStatus] }}>{STATUS_LABELS[selectedRca.capaStatus]}</span>
            </div>
            <div style={{ marginBottom: 16, color: '#8b949e', fontSize: 13 }}>{selectedRca.description}</div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>根因</div>
              {(selectedRca.rootCauses ?? []).length > 0 ? (
                <ul style={{ margin: 0, padding: '0 0 0 20px', color: '#ef4444', fontSize: 13 }}>
                  {(selectedRca.rootCauses ?? []).map((rc, i) => <li key={i}>{rc}</li>)}
                </ul>
              ) : (
                <div style={{ color: '#8b949e', fontSize: 13 }}>尚未确定根因</div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>鱼骨图分析</div>
              {(selectedRca.fishboneData ?? []).length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {(selectedRca.fishboneData ?? []).map((fb, i) => (
                    <div key={i} style={{ background: '#0d1117', borderRadius: 6, padding: 12, border: '1px solid #21262d' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 6 }}>{fb.category}</div>
                      {fb.causes.map((c, j) => <div key={j} style={{ fontSize: 12, color: '#8b949e', marginBottom: 2 }}>• {c}</div>)}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#8b949e', fontSize: 13 }}>尚未进行鱼骨图分析</div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>5-Whys 分析</div>
              {(selectedRca.fiveWhys ?? []).length > 0 ? (selectedRca.fiveWhys ?? []).map((fw, i) => (
                <div key={i} style={{ background: '#0d1117', borderRadius: 6, padding: 12, border: '1px solid #21262d', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>问题: {fw.problem}</div>
                  {fw.whys.map((w, j) => (
                    <div key={j} style={{ fontSize: 12, marginBottom: 2, paddingLeft: `${w.level * 20}px` }}>
                      <span style={{ color: '#3b82f6' }}>为什么? </span><span style={{ color: '#f0f6fc' }}>{w.answer}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 12, color: '#22c55e', marginTop: 4 }}>根因: {fw.rootCause}</div>
                </div>
              )) : (
                <div style={{ color: '#8b949e', fontSize: 13 }}>尚未进行5-Whys分析</div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>CAPA计划</div>
              {(selectedRca.capaPlans ?? []).length > 0 ? (selectedRca.capaPlans ?? []).map((cp, i) => (
                <div key={i} style={{ background: '#0d1117', borderRadius: 6, padding: 12, border: '1px solid #21262d', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#f0f6fc' }}>{cp.id}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: cp.implementationStatus === 'completed' ? '#22c55e20' : cp.implementationStatus === 'in-progress' ? '#3b82f620' : '#8b949e20', color: cp.implementationStatus === 'completed' ? '#22c55e' : cp.implementationStatus === 'in-progress' ? '#3b82f6' : '#8b949e' }}>
                      {{ pending: '待执行', 'in-progress': '进行中', completed: '已完成' }[cp.implementationStatus]}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#8b949e' }}>纠正: {cp.correctiveAction}</div>
                  <div style={{ fontSize: 12, color: '#8b949e' }}>预防: {cp.preventiveAction}</div>
                  <div style={{ fontSize: 12, color: '#8b949e' }}>负责人: {cp.responsiblePerson} | 截止: {cp.deadline}</div>
                </div>
              )) : (
                <div style={{ color: '#8b949e', fontSize: 13 }}>尚未制定CAPA计划</div>
              )}
            </div>

            {selectedRca.capaStatus !== 'closed' && (
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <button onClick={handleCloseRca} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
                  关闭RCA
                </button>
                <button onClick={() => setSelectedRca(null)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 13 }}>
                  返回
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart3 size={16} color="#3b82f6" />RCA状态分布
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                    <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                    <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} name="数量" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={16} color="#22c55e" />CAPA执行状态
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={capaChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                    <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                    <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} name="数量" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['all', 'open', 'analyzing', 'capa-planned', 'implementing', 'verified', 'closed'] as const).map(s => (
                <button key={s} onClick={() => setFilter(s)} style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${filter === s ? '#dc2626' : '#30363d'}`, background: filter === s ? '#dc262620' : 'transparent', color: filter === s ? '#dc2626' : '#8b949e', cursor: 'pointer', fontSize: 12 }}>
                  {s === 'all' ? '全部' : STATUS_LABELS[s as RcaStatus]}
                </button>
              ))}
            </div>

            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>编号</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>事件标题</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>状态</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>团队成员</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>根因数</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>CAPA数</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#6e7681', fontSize: 12 }}>{r.id}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{r.eventTitle}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: `${STATUS_COLORS[r.capaStatus]}20`, color: STATUS_COLORS[r.capaStatus] }}>{STATUS_LABELS[r.capaStatus]}</span>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e', fontSize: 12 }}>{(r.teamMembers ?? []).join(', ') || '-'}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{(r.rootCauses ?? []).length}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{(r.capaPlans ?? []).length}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                        <button onClick={() => setSelectedRca(r)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #30363d', background: 'transparent', color: '#3b82f6', cursor: 'pointer', fontSize: 12 }}>
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
