import { useState, useEffect, useMemo } from 'react'
import { AlertTriangle, Plus, Search, PieChart, ChevronDown, ChevronRight, X } from 'lucide-react'
import { message } from 'antd'
import { getAdverseReactionService } from '../../services/contrast'
import type { AdverseReaction, ReactionType, ReactionSeverity, ReactionOutcome } from '../../services/contrast'
import { createAdverseEvent } from '../../services/api/safetyApi'
// [W1-B] 列表优先 deviceMgmtApi.listAdverseReactions (GET /device-mgmt/contrast/adverse-reactions), 失败回退本地演示
import { deviceMgmtApi } from '../../services/api/deviceMgmtApi'
// [v3.0.6.11-104 Wave 3D] 过敏分级处置指引 (CONTRAST_ALLERGY_TREATMENT)
import { CONTRAST_ALLERGY_TREATMENT } from '../../data/contrastProtocols'
// [v3.0.6.11-104 Wave 3B] 不良反应与注射后留观联动 (记录后追加留观观察记录)
import { contrastSafetyApi } from '../../services/api/contrastSafetyApi'
import { AppEmpty } from '../../components/feedback'
import { t } from '../../i18n/appI18n'

const svc = getAdverseReactionService()

const TYPE_COLORS: Record<ReactionType, string> = { allergic: 'var(--color-error-500)', nephrotoxic: 'var(--color-warning-500)', extravasation: 'var(--color-primary-500)', vasovagal: '#a855f7', other: '#6e7681' }
const TYPE_LABELS: Record<ReactionType, string> = { allergic: t('advR.type.allergic'), nephrotoxic: t('advR.type.nephrotoxic'), extravasation: t('advR.type.extravasation'), vasovagal: t('advR.type.vasovagal'), other: t('advR.type.other') }
const SEV_COLORS: Record<ReactionSeverity, string> = { mild: 'var(--color-success-500)', moderate: 'var(--color-warning-500)', severe: 'var(--color-error-500)' }
const SEV_LABELS: Record<ReactionSeverity, string> = { mild: t('advR.sev.mild'), moderate: t('advR.sev.moderate'), severe: t('advR.sev.severe') }
const OUTCOME_LABELS: Record<string, string> = { resolved: t('advR.outcome.resolved'), improving: t('advR.outcome.improving'), ongoing: t('advR.outcome.ongoing'), fatal: t('advR.outcome.fatal') }
const OUTCOME_OPTIONS: ReactionOutcome[] = ['resolved', 'improving', 'ongoing', 'fatal']

export default function AdverseReactionPage() {
  const [reactions, setReactions] = useState<AdverseReaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [typeFilter, setTypeFilter] = useState<ReactionType | ''>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showStats, setShowStats] = useState(false)
  // [v3.0.6.11-104 Wave 3D] 过敏分级处置指引面板
  const [showAllergyGuide, setShowAllergyGuide] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [editTarget, setEditTarget] = useState<AdverseReaction | null>(null)
  const [form, setForm] = useState({ patientId: '', reactionType: 'allergic' as ReactionType, severity: 'mild' as ReactionSeverity, description: '', symptoms: '', contrastName: '', action: '', medicationGiven: '', outcome: 'ongoing' as ReactionOutcome, observationId: '' })
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
            patientName: String(r.detail?.patientName ?? t('advR.unknownPatient')),
            examId: String(r.detail?.examId ?? ''),
            contrastName: String(r.detail?.contrastType ?? r.contrastType ?? t('advR.unknown')),
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
      observationId: '',
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
    if (!form.patientId.trim()) { message.warning(t('advR.patientIdRequired')); return; }
    if (!form.description.trim()) { message.warning(t('advR.descriptionRequired')); return; }
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
      // [Wave 3B] 联动留观: 记录不良反应后追加留观观察记录 (留观ID 可选)
      if (form.observationId.trim() && saved) {
        void contrastSafetyApi.addObservationRecord(form.observationId.trim(), {
          symptoms: form.description,
          action: form.action || t('advR.defaultAction'),
          recordedBy: 'current-user',
          reactionId: saved.id,
        }).then(() => { message.success(t('contrastSafety.observationLinked')) }).catch(() => { /* 留观关联失败不阻断记录 */ })
      }
      void createAdverseEvent({
        eventType: 'contrast-reaction',
        severity: form.severity === 'severe' ? 'severe' : form.severity === 'moderate' ? 'moderate' : 'minor',
        description: `对比剂不良反应: ${form.description}`,
        department: '放射科',
        reportedBy: 'current-user',
        patientId: form.patientId || undefined,
      }).catch(() => { /* 安全事件上报失败不阻断记录 */ })
      message.success(editTarget ? t('advR.updatedReported') : t('advR.recordSubmitted'))
      setShowForm(false)
      setEditTarget(null)
      setForm({ patientId: '', reactionType: 'allergic', severity: 'mild', description: '', symptoms: '', contrastName: '', action: '', medicationGiven: '', outcome: 'ongoing', observationId: '' })
    } catch {
      message.error(t('advR.submitFailed'))
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
    return <div style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{t('advR.loading')}</div>
  }

  return (
    <div style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,var(--color-error-600),#991b1b)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)' }}>
          <AlertTriangle size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>{t('advR.title')}</span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
          {/* [v3.0.6.11-104 Wave 3D] 过敏分级处置指引 (CONTRAST_ALLERGY_TREATMENT) */}
          <button onClick={() => setShowAllergyGuide(true)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: showAllergyGuide ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <AlertTriangle size={14} />{t('w3d.allergy.open')}
          </button>
          <button onClick={() => void handleOpenStats()} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <PieChart size={14} />{t('advR.statsReport')}
          </button>
          <button onClick={() => { setEditTarget(null); setForm({ patientId: '', reactionType: 'allergic', severity: 'mild', description: '', symptoms: '', contrastName: '', action: '', medicationGiven: '', outcome: 'ongoing', observationId: '' }); setShowForm(!showForm) }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: showForm ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <Plus size={14} />{editTarget ? t('advR.editRecord') : t('advR.recordReaction')}
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: showForm ? '1fr 400px' : '1fr', gap: 'var(--space-5, 20px)' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)', gap: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#6e7681' }} />
                <input type="text" placeholder={t('advR.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} style={{ padding: '8px 12px 8px 34px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-card, #161b22)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12, width: 200,}} />
              </div>
              {(Object.keys(TYPE_LABELS) as ReactionType[]).map(t => (
                <button key={t} onClick={() => setTypeFilter(typeFilter === t ? '' : t)} style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: typeFilter === t ? `${TYPE_COLORS[t]}20` : 'transparent', color: typeFilter === t ? TYPE_COLORS[t] : 'var(--text-muted, #8b949e)', cursor: 'pointer', fontSize: 12 }}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: '#6e7681' }}>{t('advR.totalCases', { count: filtered.length })}</span>
          </div>

          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '24px 120px 80px 80px 1fr 100px 100px', gap: 'var(--space-2, 8px)', padding: '12px 16px', borderBottom: '1px solid var(--bg-secondary, #21262d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-muted, #8b949e)', fontSize: 12, fontWeight: 600 }}>
              <span></span><span>{t('advR.col.patient')}</span><span>{t('advR.col.type')}</span><span>{t('advR.col.severity')}</span><span>{t('advR.col.description')}</span><span>{t('advR.col.time')}</span><span>{t('advR.col.outcome')}</span>
            </div>
            {filtered.length === 0 && <AppEmpty variant="no-data" minHeight={120} />}
            {filtered.map((r, idx) => (
              <div key={r.id}>
                <div role="button" tabIndex={0} onClick={() => setExpandedId(expandedId === r.id ? null : r.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(expandedId === r.id ? null : r.id) } }} style={{ display: 'grid', gridTemplateColumns: '24px 120px 80px 80px 1fr 100px 100px', gap: 'var(--space-2, 8px)', padding: '12px 16px', borderBottom: '1px solid var(--bg-secondary, #21262d)', alignItems: 'center', background: idx % 2 === 0 ? 'var(--bg-primary, #0d1117)' : 'var(--bg-card, #161b22)', cursor: 'pointer' }}>
                  <span style={{ color: '#6e7681' }}>{expandedId === r.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                  <div><div style={{ fontSize: 12 }}>{r.patientName}</div><div style={{ fontSize: 12, color: '#6e7681' }}>{r.patientId}</div></div>
                  <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 3, background: `${TYPE_COLORS[r.reactionType]}20`, color: TYPE_COLORS[r.reactionType], textAlign: 'center' }}>{TYPE_LABELS[r.reactionType]}</span>
                  <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 3, background: `${SEV_COLORS[r.severity]}20`, color: SEV_COLORS[r.severity], textAlign: 'center' }}>{SEV_LABELS[r.severity]}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</span>
                  <span style={{ fontSize: 12, color: '#6e7681' }}>{new Date(r.occurredAt).toLocaleString('zh-CN')}</span>
                  <span style={{ fontSize: 12, color: r.outcome === 'fatal' ? 'var(--color-error-500)' : r.outcome === 'ongoing' ? 'var(--color-warning-500)' : 'var(--color-success-500)' }}>{OUTCOME_LABELS[r.outcome]}</span>
                </div>
                {expandedId === r.id && (
                  <div style={{ padding: '12px 16px 12px 48px', background: 'var(--bg-primary, #0d1117)', borderBottom: '1px solid var(--bg-secondary, #21262d)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)', fontSize: 12 }}>
                      <div><span style={{ color: 'var(--text-muted, #8b949e)' }}>{t('advR.symptomsLabel')}</span>{r.symptoms.join('、')}</div>
                      <div><span style={{ color: 'var(--text-muted, #8b949e)' }}>{t('advR.contrastLabel')}</span>{r.contrastName}</div>
                      <div><span style={{ color: 'var(--text-muted, #8b949e)' }}>{t('advR.actionLabel')}</span>{r.action}</div>
                      <div><span style={{ color: 'var(--text-muted, #8b949e)' }}>{t('advR.medicationLabel')}</span>{r.medicationGiven || '-'}</div>
                      <div><span style={{ color: 'var(--text-muted, #8b949e)' }}>{t('advR.reporterLabel')}</span>{r.reportedBy}</div>
                      <div><span style={{ color: 'var(--text-muted, #8b949e)' }}>{t('advR.reportStatusLabel')}</span>{r.isReported ? <span style={{ color: 'var(--color-success-500)' }}>{t('advR.reported')}</span> : <span style={{ color: 'var(--color-warning-500)' }}>{t('advR.notReported')}</span>}</div>
                    </div>
                    {r.followUpNotes && <div style={{ marginTop: 'var(--space-2, 8px)', padding: 'var(--space-2, 8px)', background: 'var(--bg-card, #161b22)', borderRadius: 4, fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{t('advR.followupLabel')}{r.followUpNotes}</div>}
                    <div style={{ marginTop: 'var(--space-2, 8px)', display: 'flex', gap: 'var(--space-2, 8px)' }}>
                      <button onClick={() => { openEdit(r); setShowForm(true) }} style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'transparent', color: 'var(--text-muted, #8b949e)', cursor: 'pointer', fontSize: 12 }}>{t('advR.edit')}</button>
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
                            message.success(t('advR.adverseSubmitted'))
                          } catch (e) {
                            message.error((e as Error)?.message || t('advR.reportFailed'))
                            return
                          }
                          setReactions(prev => prev.map(a => a.id === r.id ? { ...a, isReported: true } : a))
                        })()
                      }} style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid var(--color-success-500)', background: '#22c55e20', color: 'var(--color-success-500)', cursor: 'pointer', fontSize: 12 }}>{t('advR.report')}</button>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {showForm && (
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 'var(--space-4, 16px)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)' }}>{editTarget ? `编辑记录 - ${editTarget.patientName}` : t('advR.recordReaction')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{t('advR.patientIdLabel')}</label><input value={form.patientId} onChange={e => setForm({ ...form, patientId: e.target.value })} placeholder={t('advR.required')} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12, marginTop: 'var(--space-1, 4px)', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{t('contrastSafety.observationIdOptional')}</label><input value={form.observationId} onChange={e => setForm({ ...form, observationId: e.target.value })} placeholder="obs-0001" style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12, marginTop: 'var(--space-1, 4px)', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{t('advR.typeLabel')}</label><select value={form.reactionType} onChange={e => setForm({ ...form, reactionType: e.target.value as ReactionType })} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12, marginTop: 'var(--space-1, 4px)', boxSizing: 'border-box' }}>{Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{t('advR.severityLabel')}</label><select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value as ReactionSeverity })} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12, marginTop: 'var(--space-1, 4px)', boxSizing: 'border-box' }}>{Object.entries(SEV_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{t('advR.symptoms')}</label><input value={form.symptoms} onChange={e => setForm({ ...form, symptoms: e.target.value })} placeholder={t('advR.symptomsPlaceholder')} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12, marginTop: 'var(--space-1, 4px)', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{t('advR.contrast')}</label><input value={form.contrastName} onChange={e => setForm({ ...form, contrastName: e.target.value })} placeholder={t('advR.contrastPlaceholder')} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12, marginTop: 'var(--space-1, 4px)', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{t('advR.action')}</label><input value={form.action} onChange={e => setForm({ ...form, action: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12, marginTop: 'var(--space-1, 4px)', boxSizing: 'border-box' }} /></div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{t('advR.outcomeLabel')}</label><select value={form.outcome} onChange={e => setForm({ ...form, outcome: e.target.value as ReactionOutcome })} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12, marginTop: 'var(--space-1, 4px)', boxSizing: 'border-box' }}>{OUTCOME_OPTIONS.map(k => <option key={k} value={k}>{OUTCOME_LABELS[k]}</option>)}</select></div>
              <div><label style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{t('advR.descriptionLabel')}</label><textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={t('advR.descriptionPlaceholder')} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12, marginTop: 'var(--space-1, 4px)', boxSizing: 'border-box', resize: 'vertical' }} /></div>
              <button onClick={() => void handleSubmitForm()} disabled={submitting} style={{ padding: '8px', borderRadius: 6, border: 'none', cursor: submitting ? 'wait' : 'pointer', background: 'var(--color-error-600)', color: '#fff', fontSize: 12 }}>{submitting ? t('advR.submitting') : (editTarget ? t('advR.saveChanges') : t('advR.submitRecord'))}</button>
            </div>
          </div>
        )}
      </div>

      {showStats && stats && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowStats(false)}>
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 10, padding: 'var(--space-6, 24px)', width: 520, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{t('advR.statsTitle')}</div>
              <button onClick={() => setShowStats(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted, #8b949e)', cursor: 'pointer', padding: 'var(--space-1, 4px)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-4, 16px)' }}>
              <div style={{ padding: 14, background: 'var(--bg-primary, #0d1117)', borderRadius: 8, textAlign: 'center' }}><div style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-primary, #f0f6fc)' }}>{stats.totalReactions}</div><div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginTop: 'var(--space-1, 4px)' }}>{t('advR.totalCount')}</div></div>
              <div style={{ padding: 14, background: 'var(--bg-primary, #0d1117)', borderRadius: 8, textAlign: 'center' }}><div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-error-500)' }}>{stats.bySeverity?.severe ?? 0}</div><div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginTop: 'var(--space-1, 4px)' }}>{t('advR.severeReactions')}</div></div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 'var(--space-2, 8px)' }}>{t('advR.byType')}</div>
            {(Object.keys(TYPE_LABELS) as ReactionType[]).map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ width: 56, fontSize: 12, color: TYPE_COLORS[t] }}>{TYPE_LABELS[t]}</span>
                <div style={{ flex: 1, height: 8, background: 'var(--bg-primary, #0d1117)', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${stats.totalReactions > 0 ? ((stats.byType?.[t] ?? 0) / stats.totalReactions) * 100 : 0}%`, background: TYPE_COLORS[t] }} /></div>
                <span style={{ width: 30, textAlign: 'right', fontSize: 12 }}>{stats.byType?.[t] ?? 0}</span>
              </div>
            ))}
            <div style={{ fontSize: 12, fontWeight: 600, margin: '12px 0 8px' }}>{t('advR.byOutcome')}</div>
            <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', flexWrap: 'wrap' }}>{OUTCOME_OPTIONS.map(k => (
              <span key={k} style={{ padding: '4px 10px', borderRadius: 12, background: 'var(--bg-primary, #0d1117)', border: '1px solid var(--border-default, #30363d)', fontSize: 12 }}>{OUTCOME_LABELS[k]}: {stats.byOutcome?.[k] ?? 0} {t('advR.caseUnit')}</span>
            ))}</div>
          </div>
        </div>
      )}

      {/* [v3.0.6.11-104 Wave 3D] 过敏分级处置指引 (CONTRAST_ALLERGY_TREATMENT 4 级) */}
      {showAllergyGuide && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowAllergyGuide(false)}>
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 10, padding: 'var(--space-6, 24px)', width: 720, maxHeight: '88vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{t('w3d.allergy.title')}</div>
              <button onClick={() => setShowAllergyGuide(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted, #8b949e)', cursor: 'pointer', padding: 'var(--space-1, 4px)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
              {CONTRAST_ALLERGY_TREATMENT.map(a => {
                const color = a.grade === 1 ? 'var(--color-success-500)' : a.grade === 2 ? 'var(--color-warning-500)' : a.grade === 3 ? '#f97316' : 'var(--color-error-500)'
                return (
                  <div key={a.grade} style={{ border: `1px solid ${color}40`, borderRadius: 8, padding: 14, background: 'var(--bg-primary, #0d1117)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-2, 8px)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${color}20`, color }}>{t('w3d.allergy.grade', { grade: a.grade })} · {a.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{t('w3d.allergy.onset')}: {a.onset}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                      <div>
                        <div style={{ color: 'var(--text-muted, #8b949e)', fontWeight: 600, marginBottom: 'var(--space-1, 4px)' }}>{t('w3d.allergy.symptoms')}</div>
                        <ul style={{ margin: 0, paddingLeft: 'var(--space-4, 16px)' }}>{a.symptoms.map((s, i) => <li key={i} style={{ color: 'var(--text-primary, #f0f6fc)' }}>{s}</li>)}</ul>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted, #8b949e)', fontWeight: 600, marginBottom: 'var(--space-1, 4px)' }}>{t('w3d.allergy.treatment')}</div>
                        <ul style={{ margin: 0, paddingLeft: 'var(--space-4, 16px)' }}>{a.treatment.map((s, i) => <li key={i} style={{ color: 'var(--text-primary, #f0f6fc)' }}>{s}</li>)}</ul>
                      </div>
                    </div>
                    <div style={{ marginTop: 'var(--space-2, 8px)', fontSize: 12 }}><span style={{ color: 'var(--text-muted, #8b949e)' }}>{t('w3d.allergy.medication')}: </span><span style={{ color: 'var(--text-primary, #f0f6fc)' }}>{a.medication}</span></div>
                    <div style={{ marginTop: 'var(--space-1, 4px)', fontSize: 12 }}><span style={{ color: 'var(--text-muted, #8b949e)' }}>{t('w3d.allergy.hospitalization')}: </span><span style={{ color }}>{a.hospitalization}</span></div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
