import { useState, useEffect, useMemo } from 'react'
import { AlertTriangle, Plus, Search, PieChart, ChevronDown, ChevronRight } from 'lucide-react'
import { message } from 'antd'
import { getAdverseReactionService } from '../../services/contrast'
import type { AdverseReaction, ReactionType, ReactionSeverity } from '../../services/contrast'

const svc = getAdverseReactionService()

const TYPE_COLORS: Record<ReactionType, string> = { allergic: '#ef4444', nephrotoxic: '#f59e0b', extravasation: '#3b82f6', vasovagal: '#a855f7', other: '#6e7681' }
const TYPE_LABELS: Record<ReactionType, string> = { allergic: '过敏', nephrotoxic: '肾毒性', extravasation: '外渗', vasovagal: '血管迷走', other: '其他' }
const SEV_COLORS: Record<ReactionSeverity, string> = { mild: '#22c55e', moderate: '#f59e0b', severe: '#ef4444' }
const SEV_LABELS: Record<ReactionSeverity, string> = { mild: '轻度', moderate: '中度', severe: '重度' }
const OUTCOME_LABELS: Record<string, string> = { resolved: '已痊愈', improving: '好转中', ongoing: '持续中', fatal: '死亡' }

export default function AdverseReactionPage() {
  const [reactions, setReactions] = useState<AdverseReaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [typeFilter, setTypeFilter] = useState<ReactionType | ''>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const run = async () => {
      const items = await svc.getReactions()
      setReactions(items)
      setLoading(false)
    }
    void run()
  }, [])

  const filtered = useMemo(() => {
    let items = reactions
    if (typeFilter) items = items.filter(r => r.reactionType === typeFilter)
    if (searchText) { const q = searchText.toLowerCase(); items = items.filter(r => r.patientName.toLowerCase().includes(q) || r.patientId.toLowerCase().includes(q)) }
    return items
  }, [reactions, typeFilter, searchText])

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>加载中...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>对比剂不良反应管理</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <PieChart size={14} />统计报表
          </button>
          <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: showForm ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Plus size={14} />记录不良反应
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: showForm ? '1fr 400px' : '1fr', gap: 20 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#6e7681' }} />
                <input type="text" placeholder="搜索患者姓名/ID..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ padding: '8px 12px 8px 34px', borderRadius: 6, border: '1px solid #30363d', background: '#161b22', color: '#f0f6fc', fontSize: 13, width: 200, outline: 'none' }} />
              </div>
              {(Object.keys(TYPE_LABELS) as ReactionType[]).map(t => (
                <button key={t} onClick={() => setTypeFilter(typeFilter === t ? '' : t)} style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #30363d', background: typeFilter === t ? `${TYPE_COLORS[t]}20` : 'transparent', color: typeFilter === t ? TYPE_COLORS[t] : '#8b949e', cursor: 'pointer', fontSize: 12 }}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 13, color: '#6e7681' }}>共 {filtered.length} 例</span>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '24px 120px 80px 80px 1fr 100px 100px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', background: '#0d1117', color: '#8b949e', fontSize: 12, fontWeight: 600 }}>
              <span></span><span>患者</span><span>类型</span><span>严重度</span><span>描述</span><span>发生时间</span><span>转归</span>
            </div>
            {filtered.map((r, idx) => (
              <div key={r.id}>
                <div onClick={() => setExpandedId(expandedId === r.id ? null : r.id)} style={{ display: 'grid', gridTemplateColumns: '24px 120px 80px 80px 1fr 100px 100px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', alignItems: 'center', background: idx % 2 === 0 ? '#0d1117' : '#161b22', cursor: 'pointer' }}>
                  <span style={{ color: '#6e7681' }}>{expandedId === r.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                  <div><div style={{ fontSize: 13 }}>{r.patientName}</div><div style={{ fontSize: 12, color: '#6e7681' }}>{r.patientId}</div></div>
                  <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 3, background: `${TYPE_COLORS[r.reactionType]}20`, color: TYPE_COLORS[r.reactionType], textAlign: 'center' }}>{TYPE_LABELS[r.reactionType]}</span>
                  <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 3, background: `${SEV_COLORS[r.severity]}20`, color: SEV_COLORS[r.severity], textAlign: 'center' }}>{SEV_LABELS[r.severity]}</span>
                  <span style={{ fontSize: 12, color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</span>
                  <span style={{ fontSize: 12, color: '#6e7681' }}>{new Date(r.occurredAt).toLocaleString('zh-CN')}</span>
                  <span style={{ fontSize: 12, color: r.outcome === 'fatal' ? '#ef4444' : r.outcome === 'ongoing' ? '#f59e0b' : '#22c55e' }}>{OUTCOME_LABELS[r.outcome]}</span>
                </div>
                {expandedId === r.id && (
                  <div style={{ padding: '12px 16px 12px 48px', background: '#0d1117', borderBottom: '1px solid #21262d' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                      <div><span style={{ color: '#8b949e' }}>症状: </span>{r.symptoms.join('、')}</div>
                      <div><span style={{ color: '#8b949e' }}>对比剂: </span>{r.contrastName}</div>
                      <div><span style={{ color: '#8b949e' }}>处理措施: </span>{r.action}</div>
                      <div><span style={{ color: '#8b949e' }}>用药: </span>{r.medicationGiven || '无'}</div>
                      <div><span style={{ color: '#8b949e' }}>报告人: </span>{r.reportedBy}</div>
                      <div><span style={{ color: '#8b949e' }}>上报状态: </span>{r.isReported ? <span style={{ color: '#22c55e' }}>已上报</span> : <span style={{ color: '#f59e0b' }}>未上报</span>}</div>
                    </div>
                    {r.followUpNotes && <div style={{ marginTop: 8, padding: 8, background: '#161b22', borderRadius: 4, fontSize: 12, color: '#8b949e' }}>随访: {r.followUpNotes}</div>}
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <button style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 12 }}>编辑</button>
                      {!r.isReported && <button onClick={() => { message.success('不良事件上报已提交'); setReactions(prev => prev.map(a => a.id === r.id ? {...a, isReported: true} : a)); }} style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #22c55e', background: '#22c55e20', color: '#22c55e', cursor: 'pointer', fontSize: 12 }}>上报</button>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {showForm && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>记录不良反应</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={{ fontSize: 12, color: '#8b949e' }}>患者ID</label><input style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: '#8b949e' }}>类型</label><select style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box' }}>{Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label style={{ fontSize: 12, color: '#8b949e' }}>严重程度</label><select style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box' }}>{Object.entries(SEV_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label style={{ fontSize: 12, color: '#8b949e' }}>描述</label><textarea rows={3} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box', resize: 'vertical' }} /></div>
              <button onClick={() => { message.success('不良反应记录已提交'); setShowForm(false); }} style={{ padding: '8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#dc2626', color: '#fff', fontSize: 13 }}>提交记录</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
