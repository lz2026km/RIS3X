import { useEffect, useState } from 'react'
import { Spin, Alert, Empty, message } from 'antd'
import { getEducationService, type EducationMaterial, type PatientEducationRecord, type CommunicationTemplate } from '../../services/education/EducationService'
import { patientPortalApi } from '../../services/api'

// ===== Styles =====
const s = {
  container: { maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: '-apple-system, sans-serif' },
  card: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' },
  title: { fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0, marginBottom: 16 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  badge: (color: string, bg: string) => ({ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: bg, color }),
  btn: { padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#1e40af', color: '#fff' },
  select: { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff' },
  label: { fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4, display: 'block' },
  tab: (active: boolean) => ({
    flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    background: active ? '#fff' : 'transparent', color: active ? '#1e40af' : '#64748b',
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
  text: { bg: '#f1f5f9', text: '#475569' },
  video: { bg: '#fee2e2', text: '#b91c1c' },
  audio: { bg: '#fef3c7', text: '#b45309' },
  pdf: { bg: '#ede9fe', text: '#7c3aed' },
  image: { bg: '#dbeafe', text: '#1d4ed8' },
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

  const svc = getEducationService()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const eduRes = await patientPortalApi.listEducation()
        const apiMaterials = eduRes.success && Array.isArray(eduRes.data) ? eduRes.data : []
        if (cancelled) return
        if (apiMaterials.length > 0) {
          setMaterials(apiMaterials as unknown as EducationMaterial[])
        } else {
          const local = await svc.getMaterials()
          if (!cancelled) setMaterials(local)
        }
        const [r, t] = await Promise.all([svc.getPatientRecords('P001'), svc.getTemplates()])
        if (!cancelled) { setRecords(r); setTemplates(t) }
      } catch {
        if (!cancelled) {
          setLoadError('宣教资料加载失败，请稍后重试')
          const [r, t] = await Promise.all([svc.getPatientRecords('P001'), svc.getTemplates()])
          setRecords(r); setTemplates(t)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

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
      <div style={{ ...s.container, textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip="正在加载宣教资料...">
          <div style={{ height: 60 }} />
        </Spin>
      </div>
    )
  }

  return (
    <div style={s.container}>
      <h2 style={s.title}>患者教育与沟通</h2>
      {loadError && <Alert type="warning" showIcon message={loadError} style={{ marginBottom: 16 }} />}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f1f5f9', padding: 4, borderRadius: 10 }}>
        {(['materials', 'records', 'communication'] as const).map(tab => (
          <button key={tab} style={s.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>
            {tab === 'materials' ? `教育资料 (${materials.length})` : tab === 'records' ? '学习记录' : '沟通模板'}
          </button>
        ))}
      </div>

      {/* Materials Tab */}
      {activeTab === 'materials' && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...s.title, margin: 0, fontSize: 16 }}>健康教育资料库</h3>
            <select style={{ ...s.select, width: 180 }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">全部分类</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {selectedMaterial ? (
            <div>
              <button style={{ ...s.btn, background: '#64748b', marginBottom: 16 }} onClick={() => setSelectedMaterial(null)}>← 返回列表</button>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{selectedMaterial.title}</div>
              <span style={s.badge('#fff', '#1e40af')}>{CATEGORY_LABELS[selectedMaterial.category] || selectedMaterial.category}</span>
              {selectedMaterial.modality && <span style={{ ...s.badge('#0369a1', '#e0f2fe'), marginLeft: 8 }}>{selectedMaterial.modality}</span>}
              <span style={{ ...s.badge(CONTENT_TYPE_COLORS[selectedMaterial.contentType]?.text || '#475569', CONTENT_TYPE_COLORS[selectedMaterial.contentType]?.bg || '#f1f5f9'), marginLeft: 8 }}>
                {CONTENT_TYPE_LABELS[selectedMaterial.contentType] || selectedMaterial.contentType}
              </span>
              {selectedMaterial.duration && (
                <span style={{ marginLeft: 8, fontSize: 12, color: '#94a3b8' }}>
                  {Math.floor((selectedMaterial.duration || 0) / 60)}分{(selectedMaterial.duration || 0) % 60}秒
                </span>
              )}

              {/* 播放器 */}
              {(selectedMaterial.contentType === 'video' || selectedMaterial.contentType === 'audio') && (
                <div style={{ marginTop: 16, background: '#0f172a', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>{selectedMaterial.contentType === 'video' ? '🎬' : '🎧'}</div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 12 }}>{selectedMaterial.title}</div>
                  <div style={{ background: '#1e293b', borderRadius: 4, height: 8, overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{ width: `${playerProgress}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                    <button style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 13, cursor: 'pointer' }}
                      onClick={() => setPlaying(v => !v)}>
                      {playing ? '⏸ 暂停' : playerProgress >= 100 ? '🔁 重新播放' : '▶ 播放'}
                    </button>
                    <button style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #334155', background: 'transparent', color: '#cbd5e1', fontSize: 13, cursor: 'pointer' }}
                      onClick={() => void markComplete(selectedMaterial)}>
                      ✅ 标记完成
                    </button>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>{Math.round(playerProgress)}% · 演示播放器</div>
                </div>
              )}

              <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 8, fontSize: 14, color: '#334155', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {selectedMaterial.content}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 4 }}>
                {selectedMaterial.tags.map(t => <span key={t} style={s.badge('#64748b', '#f1f5f9')}>{t}</span>)}
              </div>
            </div>
          ) : materials.length === 0 ? (
            <Empty description="暂无宣教资料" />
          ) : (
            <div style={s.grid2}>
              {filtered.map(m => (
                <div key={m.id} style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer' }}
                  onClick={() => handlePlay(m)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 20 }}>{m.contentType === 'video' ? '🎬' : m.contentType === 'audio' ? '🎧' : m.contentType === 'pdf' ? '📄' : '📖'}</span>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{m.title}</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{m.summary}</div>
                  <span style={s.badge('#fff', '#1e40af')}>{CATEGORY_LABELS[m.category] || m.category}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>{CONTENT_TYPE_LABELS[m.contentType] || m.contentType}</span>
                  {m.duration && <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>{Math.floor(m.duration / 60)}分{m.duration % 60}秒</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Records Tab */}
      {activeTab === 'records' && (
        <div style={s.card}>
          <h3 style={{ ...s.title, fontSize: 16 }}>患者学习记录</h3>
          {records.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{r.materialTitle}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>分配时间：{new Date(r.assignedAt).toLocaleString()}</div>
              </div>
              <span style={s.badge(r.completed ? '#166534' : '#854d0e', r.completed ? '#dcfce7' : '#fef9c3')}>
                {r.completed ? '已学习' : '未学习'}
              </span>
            </div>
          ))}
          {records.length === 0 && <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 24 }}>暂无学习记录</div>}
        </div>
      )}

      {/* Communication Tab */}
      {activeTab === 'communication' && (
        <div style={s.card}>
          <h3 style={{ ...s.title, fontSize: 16 }}>沟通模板</h3>
          {templates.map(t => (
            <div key={t.id} style={{ padding: 16, marginBottom: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{t.name}</span>
                <span style={s.badge('#fff', { 'sms': '#0369a1', 'wechat': '#166534', 'email': '#92400e', 'app_push': '#7c3aed' }[t.channel] || '#64748b')}>{t.channel}</span>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>标题：{t.title}</div>
              <div style={{ fontSize: 12, color: '#475569', background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>{t.body}</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                {t.variables.map(v => <span key={v} style={s.badge('#7c3aed', '#f3e8ff')}>{`{${v}}`}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
