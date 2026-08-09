import { useState, useEffect, useMemo } from 'react'
import { AlertTriangle, Plus, Search, PieChart, ChevronDown, ChevronRight, X } from 'lucide-react'
import { message } from 'antd'
import { getAdverseReactionService } from '../../services/contrast'
import type { AdverseReaction, ReactionType, ReactionSeverity, ReactionOutcome } from '../../services/contrast'
import { createAdverseEvent } from '../../services/api/safetyApi'
// [W1-B] 列表优先 deviceMgmtApi.listAdverseReactions (GET /device-mgmt/contrast/adverse-reactions), 失败回退本地演示
import { deviceMgmtApi } from '../../services/api/deviceMgmtApi'

const svc = getAdverseReactionService()

const TYPE_COLORS: Record<ReactionType, string> = { allergic: '#ef4444', nephrotoxic: '#f59e0b', extravasation: '#3b82f6', vasovagal: '#a855f7', other: '#6e7681' }
const TYPE_LABELS: Record<ReactionType, string> = { allergic: '过敏', nephrotoxic: '肾毒性', extravasation: '外渗', vasovagal: '血管迷走', other: '其他' }
const SEV_COLORS: Record<ReactionSeverity, string> = { mild: '#22c55e', moderate: '#f59e0b', severe: '#ef4444' }
const SEV_LABELS: Record<ReactionSeverity, string> = { mild: '轻度', moderate: '中度', severe: '重度' }
const OUTCOME_LABELS: Record<string, string> = { resolved: '已痊愈', improving: '好转中', ongoing: '持续中', fatal: '死亡' }
const OUTCOME_OPTIONS: ReactionOutcome[] = ['resolved', 'improving', 'ongoing', 'fatal']

export default function AdverseReactionPage() {
  const [reactions, setReactions] = useState<AdverseReaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [typeFilter, setTypeFilter] = useState<ReactionType | ''>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [editTarget, setEditTarget] = useState<AdverseReaction | null>(null)
  const [form, setForm] = useState({ patientId: '', reactionType: 'allergic' as ReactionType, severity: 'mild' as ReactionSeverity, description: '', symptoms: '', contrastName: '', action: '', medicationGiven: '', outcome: 'ongoing' as ReactionOutcome })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const run = async () => {
      // [W1-B] 真实列表优先: /device-mgmt/contrast/adverse-reactions
      try {
        const res = await deviceMgmtApi.listAdverseReactions()
        const raw = res.data as unknown
        const items: any[] = Array.isArray(raw) ? raw : (raw as any)?.items ?? []
        if (res.success && items.length > 0) {
          setReactions(items.map((r: any) => ({
            id: String(r.id ?? ''),
            patientId: String(r.detail?.patientId ?? r.patientId ?? ''),
            patientName: String(r.detail?.patientName ?? '未知患者'),
            examId: String(r.detail?.examId ?? ''),
            contrastName: String(r.detail?.contrastType ?? r.contrastType ?? '未知'),
            batchId: String(r.detail?.batchId ?? ''),
            reactionType: 'other' as ReactionType,
            severity: (String(r.detail?.severity ?? r.severity ?? 'mild').toLowerCase().startsWith('sev') ? 'severe' : String(r.detail?.severity ?? r.severity ?? 'mild').toLowerCase().startsWith('mod') ? 'moderate' : 'mild') as ReactionSeverity,
            symptoms: [],
            description: String(r.detail?.reaction ?? r.reaction ?? r.description ?? ''),
            occurredAt: String(r.detail?.administeredAt ?? r.administeredAt ?? r.createdAt ?? new Date().toISOString()),
            reportedBy: String(r.detail?.reportedBy ?? 'system'),
            action: '',
            medicationGiven: '',
            outcome: 'ongoing' as ReactionOutcome,
            followUpNotes: String(r.detail?.notes ?? ''),
            isReported: true,
            createdAt: String(r.createdAt ?? new Date().toISOString()),
          } as AdverseReaction)))
          setLoading(false)
          return
        }
      } catch { /* 回退本地演示 */ }
      const items = await svc.getReactions()
      setReactions(items)
      setLoading(false)
    }
    void run()
  }, [])

  const openEdit = (r: AdverseReaction) => {
    setEditTarget(r)
    setForm({
      patientId: r.patientId, reactionType: r.reactionType, severity: r.severity,
      description: r.description, symptoms: r.symptoms.join('、'), contrastName: r.contrastName,
      action: r.action, medicationGiven: r.medicationGiven || '', outcome: r.outcome,
    })
  }

  const handleOpenStats = async () => {
    const end = new Date().toISOString()
    const start = new Date(Date.now() - 90 * 86400000).toISOString()
    try {
      const s = await svc.getReactionStats(start, end)
      setStats(s)
    } catch {
      setStats({ totalReactions: reactions.length, byType: {}, bySeverity: {}, byOutcome: {}, severeReactionRate: 0, totalExamsWithContrast: 0 })
    }
    setShowStats(true)
  }

  const handleSubmitForm = async () => {
    if (!form.patientId.trim()) { message.warning('请填写患者ID'); return; }
    if (!form.description.trim()) { message.warning('请填写反应描述'); return; }
    setSubmitting(true)
    try {
      const payload = {
        patientId: form.patientId,
        patientName: '未知患者',
        examId: '',
        contrastName: form.contrastName || '碘海醇',
        batchId: '',
        reactionType: form.reactionType,
        severity: form.severity,
        symptoms: form.symptoms.split(/[、,，]/).filter(Boolean),
        description: form.description,
        occurredAt: new Date().toISOString(),
        reportedBy: 'current-user',
        action: form.action,
        medicationGiven: form.medicationGiven,
        outcome: form.outcome,
        followUpNotes: '',
      }
      let saved: AdverseReaction
      if (editTarget) {
        saved = (await svc.updateReaction(editTarget.id, payload)) ?? payload as AdverseReaction
      } else {
        saved = await svc.recordReaction(payload)
      }
      setReactions(prev => editTarget
        ? prev.map(r => r.id === editTarget.id ? { ...r, ...payload } : r)
        : [saved, ...prev])
      void createAdverseEvent({
        eventType: 'contrast-reaction',
        severity: form.severity === 'severe' ? 'severe' : form.severity === 'moderate' ? 'moderate' : 'minor',
        description: `对比剂不良反应: ${form.description}`,
        department: '放射科',
        reportedBy: 'current-user',
        patientId: form.patientId || undefined,
      }).catch(() => { /* 安全事件上报失败不阻断记录 */ })
      message.success(editTarget ? '记录已更新并上报安全事件' : '不良反应记录已提交')
      setShowForm(false)
      setEditTarget(null)
      setForm({ patientId: '', reactionType: 'allergic', severity: 'mild', description: '', symptoms: '', contrastName: '', action: '', medicationGiven: '', outcome: 'ongoing' })
    } catch {
      message.error('提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

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
          <button onClick={() => void handleOpenStats()} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <PieChart size={14} />统计报表
          </button>
          <button onClick={() => { setEditTarget(null); setForm({ patientId: '', reactionType: 'allergic', severity: 'mild', description: '', symptoms: '', contrastName: '', action: '', medicationGiven: '', outcome: 'ongoing' }); setShowForm(!showForm) }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: showForm ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Plus size={14} />{editTarget ? '编辑记录' : '记录不良反应'}
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
                      <button onClick={() => { openEdit(r); setShowForm(true) }} style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 12 }}>编辑</button>
                      {!r.isReported && <button onClick={() => {
                        void (async () => {
                          try {
                            await createAdverseEvent({
                              eventType: 'contrast-reaction',
                              severity: r.severity === 'severe' ? 'severe' : r.severity === 'moderate' ? 'moderate' : 'minor',
                              description: `对比剂不良反应: ${r.description}`,
                              department: '放射科',
                              reportedBy: r.reportedBy || 'current-user',
                              patientId: r.patientId || undefined,
                              patientName: r.patientName || undefined,
                              actionsTaken: r.action ? [r.action] : undefined,
                            })
                            message.success('不良事件上报已提交 (POST /safety/adverse-events)')
                          } catch (e) {
                            message.error((e as Error)?.message || '上报失败')
                            return
                          }
                          setReactions(prev => prev.map(a => a.id === r.id ? { ...a, isReported: true } : a))
                        })()
                      }} style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #22c55e', background: '#22c55e20', color: '#22c55e', cursor: 'pointer', fontSize: 12 }}>上报</button>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {showForm && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{editTarget ? `编辑记录 - ${editTarget.patientName}` : '记录不良反应'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={{ fontSize: 12, color: '#8b949e' }}>患者ID *</label><input value={form.patientId} onChange={e => setForm({ ...form, patientId: e.target.value })} placeholder="必填" style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: '#8b949e' }}>类型</label><select value={form.reactionType} onChange={e => setForm({ ...form, reactionType: e.target.value as ReactionType })} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box' }}>{Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label style={{ fontSize: 12, color: '#8b949e' }}>严重程度</label><select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value as ReactionSeverity })} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box' }}>{Object.entries(SEV_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label style={{ fontSize: 12, color: '#8b949e' }}>症状</label><input value={form.symptoms} onChange={e => setForm({ ...form, symptoms: e.target.value })} placeholder="用顿号分隔" style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: '#8b949e' }}>对比剂</label><input value={form.contrastName} onChange={e => setForm({ ...form, contrastName: e.target.value })} placeholder="如 碘海醇" style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: '#8b949e' }}>处理措施</label><input value={form.action} onChange={e => setForm({ ...form, action: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: '#8b949e' }}>转归</label><select value={form.outcome} onChange={e => setForm({ ...form, outcome: e.target.value as ReactionOutcome })} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box' }}>{OUTCOME_OPTIONS.map(k => <option key={k} value={k}>{OUTCOME_LABELS[k]}</option>)}</select></div>
              <div><label style={{ fontSize: 12, color: '#8b949e' }}>描述 *</label><textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="反应经过及处理过程" style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box', resize: 'vertical' }} /></div>
              <button onClick={() => void handleSubmitForm()} disabled={submitting} style={{ padding: '8px', borderRadius: 6, border: 'none', cursor: submitting ? 'wait' : 'pointer', background: '#dc2626', color: '#fff', fontSize: 13 }}>{submitting ? '提交中...' : (editTarget ? '保存修改' : '提交记录')}</button>
            </div>
          </div>
        )}
      </div>

      {showStats && stats && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowStats(false)}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 24, width: 520, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>近90天不良反应统计</div>
              <button onClick={() => setShowStats(false)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 14, background: '#0d1117', borderRadius: 8, textAlign: 'center' }}><div style={{ fontSize: 28, fontWeight: 700, color: '#f0f6fc' }}>{stats.totalReactions}</div><div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>总例数</div></div>
              <div style={{ padding: 14, background: '#0d1117', borderRadius: 8, textAlign: 'center' }}><div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>{stats.bySeverity?.severe ?? 0}</div><div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>重度反应</div></div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>按类型</div>
            {(Object.keys(TYPE_LABELS) as ReactionType[]).map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ width: 56, fontSize: 12, color: TYPE_COLORS[t] }}>{TYPE_LABELS[t]}</span>
                <div style={{ flex: 1, height: 8, background: '#0d1117', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${stats.totalReactions > 0 ? ((stats.byType?.[t] ?? 0) / stats.totalReactions) * 100 : 0}%`, background: TYPE_COLORS[t] }} /></div>
                <span style={{ width: 30, textAlign: 'right', fontSize: 12 }}>{stats.byType?.[t] ?? 0}</span>
              </div>
            ))}
            <div style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 8px' }}>按转归</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{OUTCOME_OPTIONS.map(k => (
              <span key={k} style={{ padding: '4px 10px', borderRadius: 12, background: '#0d1117', border: '1px solid #30363d', fontSize: 12 }}>{OUTCOME_LABELS[k]}: {stats.byOutcome?.[k] ?? 0} 例</span>
            ))}</div>
          </div>
        </div>
      )}
    </div>
  )
}
