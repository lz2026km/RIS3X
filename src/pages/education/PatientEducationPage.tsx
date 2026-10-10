import { patientPortalApi, type CreateEducationInput } from '../../services/api'
import { getEducationService, type EducationMaterial, type PatientEducationRecord, type CommunicationTemplate } from '../../services/education/EducationService'
import { Spin, Alert, Empty, message, Modal, Input, Select, InputNumber, Card, Typography } from 'antd'
import { Inbox, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
// [v3.0.6.11-104 Wave 3D] 结构化患者宣教资料库 (PATIENT_EDUCATION_MATERIALS)
import { PATIENT_EDUCATION_MATERIALS } from '../../data/patientEducationMaterials'
import { t } from '../../i18n/appI18n'

const { Title } = Typography

// ===== Styles =====
const s = {
  container: { maxWidth: 1000, margin: '0 auto', padding: 'var(--space-6, 24px)', fontFamily: '-apple-system, sans-serif' },
  card: { background: 'var(--bg-card)', borderRadius: 12, padding: 'var(--space-6, 24px)', marginBottom: 'var(--space-5, 20px)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--space-4, 16px)' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4, 16px)' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3, 12px)' },
  badge: (color: string, bg: string) => ({ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: bg, color }),
  btn: { padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--color-primary-800)', color: '#fff' },
  select: { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, background: 'var(--bg-card)' },
  label: { fontSize: 12, color: 'var(--text-muted, #64748b)', fontWeight: 600, marginBottom: 'var(--space-1, 4px)', display: 'block' },
  tab: (active: boolean) => ({
    flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    background: active ? 'var(--bg-card)' : 'transparent', color: active ? 'var(--color-primary-800)' : '#64748b',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
  }),
}

const CATEGORY_LABELS: Record<string, string> = {
  pre_exam: '检查前准备', post_exam: '检查后指导', condition: '疾病知识', medication: '药物指导', general: '一般宣教',
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  text: '图文', video: '视频', audio: '音频', pdf: 'PDF', image: '图片',
}

const CONTENT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  text: { bg: 'var(--bg-card)', text: 'var(--text-secondary)' },
  video: { bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
  audio: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  pdf: { bg: 'rgba(124,58,237,0.12)', text: '#7c3aed' },
  image: { bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
}

// ===== Component =====
export default function PatientEducationPage() {
  const [activeTab, setActiveTab] = useState<'materials' | 'records' | 'communication'>('materials')
  const [materials, setMaterials] = useState<EducationMaterial[]>([])
  const [records, setRecords] = useState<PatientEducationRecord[]>([])
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([])
  const [selectedMaterial, setSelectedMaterial] = useState<EducationMaterial | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [playerProgress, setPlayerProgress] = useState(0)
  // [v3.0.6.11-104 Wave 3D] 结构化宣教资料 (PATIENT_EDUCATION_MATERIALS) 分类筛选 + 详情
  const [eduCategory, setEduCategory] = useState<string>('')
  const [eduDetail, setEduDetail] = useState<(typeof PATIENT_EDUCATION_MATERIALS)[number] | null>(null)
  const eduFiltered = useMemo(
    () => (eduCategory ? PATIENT_EDUCATION_MATERIALS.filter(m => m.category === eduCategory) : PATIENT_EDUCATION_MATERIALS),
    [eduCategory],
  )
  // [W5] 新建宣教资料
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<{
    title: string
    category: string
    contentType: string
    summary: string
    content: string
    duration?: number
    tags: string
  }>({ title: '', category: 'general', contentType: 'text', summary: '', content: '', tags: '' })

  const svc = getEducationService()

  const loadMaterials = async () => {
    const eduRes = await patientPortalApi.listEducation()
    const apiMaterials = eduRes.success && Array.isArray(eduRes.data) ? eduRes.data : []
    if (apiMaterials.length > 0) {
      setMaterials(apiMaterials as unknown as EducationMaterial[])
    } else {
      const local = await svc.getMaterials()
      setMaterials(local)
    }
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError(null)
      try {
        await loadMaterials()
        if (cancelled) return
        const [r, tmpls] = await Promise.all([svc.getPatientRecords('P001'), svc.getTemplates()])
        if (!cancelled) { setRecords(r); setTemplates(tmpls) }
      } catch {
        if (!cancelled) {
          setLoadError(t('patientEdu.loadFailedRetry'))
          const [r, tmpls] = await Promise.all([svc.getPatientRecords('P001'), svc.getTemplates()])
          setRecords(r); setTemplates(tmpls)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // [W5] 新建宣教资料 → POST /patient-portal/education
  const handleCreateMaterial = async () => {
    if (!createForm.title.trim() || !createForm.content.trim()) {
      message.warning(t('patientEdu.titleContentRequired'))
      return
    }
    setCreating(true)
    try {
      const input: CreateEducationInput = {
        title: createForm.title.trim(),
        category: (createForm.category || 'general') as CreateEducationInput['category'],
        contentType: (createForm.contentType || 'text') as CreateEducationInput['contentType'],
        content: createForm.content.trim(),
        summary: createForm.summary.trim() || undefined,
        duration: createForm.duration,
        tags: createForm.tags.split(/[,，]/).map(tag => tag.trim()).filter(Boolean),
      }
      const res = await patientPortalApi.createEducation(input)
      if (res.success) {
        message.success(`已新建宣教资料: ${createForm.title}`)
        setCreateOpen(false)
        setCreateForm({ title: '', category: 'general', contentType: 'text', summary: '', content: '', tags: '' })
        await loadMaterials()
      } else {
        message.error(res.error?.message || t('patientEdu.createFailed'))
      }
    } catch {
      message.error(t('patientEdu.createFailed'))
    }
    setCreating(false)
  }

  // [W5] 删除宣教资料 → DELETE /patient-portal/education/:key
  const handleDeleteMaterial = async (m: EducationMaterial) => {
    const key = (m as unknown as { key?: string }).key ?? m.id
    try {
      const res = await patientPortalApi.deleteEducation(key)
      if (res.success) {
        message.success(`已删除: ${m.title}`)
        await loadMaterials()
      } else {
        message.error(res.error?.message || t('patientEdu.deleteFailedRes'))
      }
    } catch {
      message.error(t('patientEdu.deleteMaterialFailed'))
    }
  }

  const filtered = categoryFilter ? materials.filter(m => m.category === categoryFilter) : materials

  const handlePlay = (m: EducationMaterial) => {
    setSelectedMaterial(m)
    setPlayerProgress(0)
    setPlaying(m.contentType === 'video' || m.contentType === 'audio')
  }

  useEffect(() => {
    if (!playing || !selectedMaterial) return
    const duration = selectedMaterial.duration || 120
    const timer = setInterval(() => {
      setPlayerProgress(p => {
        if (p >= 100) { setPlaying(false); return 100 }
        return Math.min(100, p + 100 / duration)
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [playing, selectedMaterial])

  const markComplete = async (m: EducationMaterial) => {
    message.success(`已完成《${m.title}》学习`)
    const res = await patientPortalApi.listExamHistory('current').catch(() => null)
    void res
    try {
      await svc.assignMaterial('P001', m.id)
      const r = await svc.getPatientRecords('P001')
      setRecords(r)
    } catch { /* noop */ }
  }

  if (loading) {
    return (
      <div style={{ ...s.container, textAlign: 'center', padding: 'var(--space-20, 80px)' }}>
        <Spin size="large" tip={t('patientEdu.loadingMaterials')}>
          <div style={{ height: 60 }} />
        </Spin>
      </div>
    )
  }

  return (
    <div style={s.container}>
      <Title level={4} style={{ margin: 0, marginBottom: 'var(--space-4, 16px)' }}>{t('patientEdu.title')}</Title>
      {loadError && <Alert type="warning" showIcon message={loadError} style={{ marginBottom: 'var(--space-4, 16px)' }} />}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', marginBottom: 'var(--space-5, 20px)', background: 'var(--bg-card)', padding: 'var(--space-1, 4px)', borderRadius: 10 }}>
        {(['materials', 'records', 'communication'] as const).map(tab => (
          <button key={tab} style={s.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>
            {tab === 'materials' ? t('patientEdu.tabMaterials', { count: materials.length }) : tab === 'records' ? t('patientEdu.tabRecords') : t('patientEdu.tabCommunication')}
          </button>
        ))}
      </div>

      {/* Materials Tab */}
      {activeTab === 'materials' && (
        <>
        <Card bordered={false} style={s.card} styles={{ body: { padding: 0 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
            <h3 style={{ ...s.title, margin: 0, fontSize: 16 }}>{t('patientEdu.healthLibrary')}</h3>
            <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
                <button style={{ ...s.btn, background: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }} onClick={() => setCreateOpen(true)}><Plus size={13} /> {t('patientEdu.newMaterial')}</button>
              <select style={{ ...s.select, width: 180 }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="">{t('patientEdu.allCategories')}</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {selectedMaterial ? (
            <div>
              <button style={{ ...s.btn, background: '#64748b', marginBottom: 'var(--space-4, 16px)' }} onClick={() => setSelectedMaterial(null)}>{t('patientEdu.backToList')}</button>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-1, 4px)' }}>{selectedMaterial.title}</div>
              <span style={s.badge('#fff', 'var(--color-primary-800)')}>{CATEGORY_LABELS[selectedMaterial.category] || selectedMaterial.category}</span>
              {selectedMaterial.modality && <span style={{ ...s.badge('#0369a1', '#e0f2fe'), marginLeft: 'var(--space-2, 8px)' }}>{selectedMaterial.modality}</span>}
              <span style={{ ...s.badge(CONTENT_TYPE_COLORS[selectedMaterial.contentType]?.text || 'var(--text-secondary)', CONTENT_TYPE_COLORS[selectedMaterial.contentType]?.bg || 'var(--bg-card)'), marginLeft: 'var(--space-2, 8px)' }}>
                {CONTENT_TYPE_LABELS[selectedMaterial.contentType] || selectedMaterial.contentType}
              </span>
              {selectedMaterial.duration && (
                <span style={{ marginLeft: 'var(--space-2, 8px)', fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
                  {Math.floor((selectedMaterial.duration || 0) / 60)}{t('patientEdu.minuteUnit')}{(selectedMaterial.duration || 0) % 60}{t('patientEdu.secondUnit')}
                </span>
              )}

              {/* 播放器 */}
              {(selectedMaterial.contentType === 'video' || selectedMaterial.contentType === 'audio') && (
                <div style={{ marginTop: 'var(--space-4, 16px)', background: '#0f172a', borderRadius: 8, padding: 'var(--space-4, 16px)', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 'var(--space-2, 8px)' }}>{selectedMaterial.contentType === 'video' ? '' : ''}</div>
                  <div style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 'var(--space-3, 12px)' }}>{selectedMaterial.title}</div>
                  <div style={{ background: '#1e293b', borderRadius: 4, height: 8, overflow: 'hidden', marginBottom: 'var(--space-3, 12px)' }}>
                    <div style={{ width: `${playerProgress}%`, height: '100%', background: 'var(--color-primary-500)', transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2, 8px)' }}>
                    <button style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--color-primary-500)', color: '#fff', fontSize: 12, cursor: 'pointer' }}
                      onClick={() => setPlaying(v => !v)}>
                      {playing ? t('patientEdu.pause') : playerProgress >= 100 ? t('patientEdu.replay') : t('patientEdu.play')}
                    </button>
                    <button style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #334155', background: 'transparent', color: '#cbd5e1', fontSize: 12, cursor: 'pointer' }}
                      onClick={() => void markComplete(selectedMaterial)}>
                      {t('patientEdu.markComplete')}
                    </button>
                  </div>
                  <div style={{ marginTop: 'var(--space-2, 8px)', fontSize: 11, color: 'var(--text-muted, #64748b)' }}>{Math.round(playerProgress)}% · {t('patientEdu.demoPlayer')}</div>
                </div>
              )}

              <div style={{ marginTop: 'var(--space-4, 16px)', padding: 'var(--space-4, 16px)', background: 'var(--bg-card)', borderRadius: 8, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {selectedMaterial.content}
              </div>
              <div style={{ marginTop: 'var(--space-3, 12px)', display: 'flex', gap: 'var(--space-1, 4px)' }}>
                {selectedMaterial.tags.map(t => <span key={t} style={s.badge('var(--text-secondary)', 'var(--bg-card)')}>{t}</span>)}
              </div>
            </div>
          ) : materials.length === 0 ? (
            <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('patientEdu.noMaterials')} />
          ) : (
            <div style={s.grid2}>
              {filtered.map(m => (
                <div key={m.id} style={{ padding: 'var(--space-4, 16px)', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'pointer', position: 'relative' }}
                  onClick={() => handlePlay(m)}>
                  <button
                    title={t('patientEdu.deleteMaterialTitle')}
                    style={{ position: 'absolute', top: 8, right: 8, border: 'none', background: 'transparent', color: 'var(--text-muted, #94a3b8)', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}
                    onClick={e => { e.stopPropagation(); void handleDeleteMaterial(m) }}
                  >×</button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-1, 4px)' }}>
                    <span style={{ fontSize: 20 }}>{m.contentType === 'video' ? '' : m.contentType === 'audio' ? '' : m.contentType === 'pdf' ? '' : ''}</span>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{m.title}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 'var(--space-2, 8px)' }}>{m.summary}</div>
                  <span style={s.badge('#fff', 'var(--color-primary-800)')}>{CATEGORY_LABELS[m.category] || m.category}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginLeft: 'var(--space-2, 8px)' }}>{CONTENT_TYPE_LABELS[m.contentType] || m.contentType}</span>
                  {m.duration && <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginLeft: 'var(--space-2, 8px)' }}>{Math.floor(m.duration / 60)}{t('patientEdu.minuteUnit')}{m.duration % 60}{t('patientEdu.secondUnit')}</span>}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* [v3.0.6.11-104 Wave 3D] 结构化患者宣教资料库 (关键要点/常见问题/注意事项/护理) */}
        <Card bordered={false} style={s.card} styles={{ body: { padding: 0 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
            <h3 style={{ ...s.title, margin: 0, fontSize: 16 }}>{t('w3d.edu.title')}</h3>
            <select style={{ ...s.select, width: 200 }} value={eduCategory} onChange={e => setEduCategory(e.target.value)}>
              <option value="">{t('w3d.edu.structured')} · {t('patientEdu.allCategories')}</option>
              {[...new Set(PATIENT_EDUCATION_MATERIALS.map(m => m.category))].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={s.grid2}>
            {eduFiltered.map(m => (
              <div key={m.code} style={{ padding: 'var(--space-4, 16px)', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => setEduDetail(m)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{m.title}</span>
                  <span style={{ ...s.badge('#0369a1', '#e0f2fe'), marginLeft: 'auto' }}>{m.category}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--space-2, 8px)' }}>
                  {m.modality && <span style={s.badge('#fff', 'var(--color-primary-800)')}>{m.modality}</span>}
                  {m.duration && <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{t('w3d.edu.duration')}: {m.duration}</span>}
                  {m.fasting && <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{t('w3d.edu.fasting')}: {m.fasting}</span>}
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {m.keyPoints.slice(0, 3).map((p, i) => <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
          {eduFiltered.length === 0 && <Empty image={<Inbox size={48} style={{ opacity: 0.4 }} />} description={t('patientEdu.noStructuredMaterials')} />}
        </Card>
        </>
      )}

      {/* Records Tab */}
      {activeTab === 'records' && (
        <Card bordered={false} style={s.card} styles={{ body: { padding: 0 } }}>
          <h3 style={{ ...s.title, fontSize: 16 }}>{t('patientEdu.learningRecords')}</h3>
          {records.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r.materialTitle}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{t('patientEdu.assignedAt')}{new Date(r.assignedAt).toLocaleString()}</div>
              </div>
              <span style={s.badge(r.completed ? 'var(--color-success)' : 'var(--color-warning)', r.completed ? 'var(--color-success-bg)' : 'var(--color-warning-bg)')}>
                {r.completed ? t('patientEdu.learned') : t('patientEdu.notLearned')}
              </span>
            </div>
          ))}
          {records.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', textAlign: 'center', padding: 'var(--space-6, 24px)' }}>{t('patientEdu.noRecords')}</div>}
        </Card>
      )}

      {/* Communication Tab */}
      {activeTab === 'communication' && (
        <Card bordered={false} style={s.card} styles={{ body: { padding: 0 } }}>
          <h3 style={{ ...s.title, fontSize: 16 }}>{t('patientEdu.tabCommunication')}</h3>
          {templates.map(tpl => (
            <div key={tpl.id} style={{ padding: 'var(--space-4, 16px)', marginBottom: 'var(--space-3, 12px)', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2, 8px)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{tpl.name}</span>
                <span style={s.badge('#fff', { 'sms': '#0369a1', 'wechat': '#166534', 'email': '#92400e', 'app_push': '#7c3aed' }[tpl.channel] || '#64748b')}>{tpl.channel}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 'var(--space-1, 4px)' }}>{t('patientEdu.commTitle')}{tpl.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: 'var(--space-2, 8px)', borderRadius: 6, border: '1px solid var(--border-color)' }}>{tpl.body}</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 'var(--space-1, 4px)' }}>
                {tpl.variables.map(v => <span key={v} style={s.badge('#7c3aed', '#f3e8ff')}>{`{${v}}`}</span>)}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* [v3.0.6.11-104 Wave 3D] 结构化宣教资料详情 */}
      <Modal
        title={eduDetail?.title}
        open={!!eduDetail}
        onCancel={() => setEduDetail(null)}
        footer={null}
        width={640}
      >
        {eduDetail && (
          <div style={{ display: 'grid', gap: 14, paddingTop: 'var(--space-1, 4px)' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={s.badge('#fff', 'var(--color-primary-800)')}>{eduDetail.category}</span>
              {eduDetail.modality && <span style={s.badge('#0369a1', '#e0f2fe')}>{eduDetail.modality}</span>}
              <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{eduDetail.targetAudience}</span>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{t('w3d.edu.keyPoints')}</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>{eduDetail.keyPoints.map((p, i) => <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p}</li>)}</ul>
            </div>
            {eduDetail.warnings.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-error-600)', marginBottom: 6 }}>{t('w3d.edu.warnings')}</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>{eduDetail.warnings.map((w, i) => <li key={i} style={{ fontSize: 12, color: 'var(--color-error-600)' }}>{w}</li>)}</ul>
              </div>
            )}
            {eduDetail.postCare && eduDetail.postCare.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{t('w3d.edu.postCare')}</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>{eduDetail.postCare.map((w, i) => <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{w}</li>)}</ul>
              </div>
            )}
            {eduDetail.medication && (
              <div><span style={{ fontSize: 12, fontWeight: 700 }}>{t('w3d.edu.medication')}: </span><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{eduDetail.medication}</span></div>
            )}
            {eduDetail.commonQuestions.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{t('w3d.edu.faq')}</div>
                <div style={{ display: 'grid', gap: 'var(--space-2, 8px)' }}>
                  {eduDetail.commonQuestions.map((q, i) => (
                    <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Q: {q.question}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 'var(--space-1, 4px)' }}>A: {q.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* [W5] 新建宣教资料 */}
      <Modal
        title={t('patientEdu.newMaterial')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreateMaterial()}
        confirmLoading={creating}
        okText={t('patientEdu.create')}
        cancelText={t('patientEdu.cancel')}
      >
        <div style={{ display: 'grid', gap: 'var(--space-3, 12px)', paddingTop: 'var(--space-2, 8px)' }}>
          <div>
            <label style={s.label}>{t('patientEdu.fieldTitle')}</label>
            <Input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder={t('patientEdu.titlePlaceholder')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
            <div>
              <label style={s.label}>{t('patientEdu.category')}</label>
              <Select value={createForm.category} style={{ width: '100%' }} onChange={v => setCreateForm(f => ({ ...f, category: v }))}
                options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
            </div>
            <div>
              <label style={s.label}>{t('patientEdu.contentType')}</label>
              <Select value={createForm.contentType} style={{ width: '100%' }} onChange={v => setCreateForm(f => ({ ...f, contentType: v }))}
                options={Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
            </div>
          </div>
          <div>
            <label style={s.label}>{t('patientEdu.summary')}</label>
            <Input value={createForm.summary} onChange={e => setCreateForm(f => ({ ...f, summary: e.target.value }))} placeholder={t('patientEdu.summaryPlaceholder')} />
          </div>
          <div>
            <label style={s.label}>{t('patientEdu.fieldContent')}</label>
            <Input.TextArea rows={4} value={createForm.content} onChange={e => setCreateForm(f => ({ ...f, content: e.target.value }))} placeholder={t('patientEdu.contentPlaceholder')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
            <div>
              <label style={s.label}>{t('patientEdu.duration')}</label>
              <InputNumber min={1} value={createForm.duration} style={{ width: '100%' }} onChange={v => setCreateForm(f => ({ ...f, duration: v ?? undefined }))} placeholder={t('patientEdu.durationPlaceholder')} />
            </div>
            <div>
              <label style={s.label}>{t('patientEdu.tags')}</label>
              <Input value={createForm.tags} onChange={e => setCreateForm(f => ({ ...f, tags: e.target.value }))} placeholder={t('patientEdu.tagsPlaceholder')} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
