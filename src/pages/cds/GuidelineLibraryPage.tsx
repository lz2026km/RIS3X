// [G005 W2-B] CDS 指南库: listGuidelines / getGuideline / createGuideline
import { useState, useMemo, useEffect, useCallback } from 'react'
import { BookOpen, Plus, Search, Eye, X, Save, RefreshCw } from 'lucide-react'
import { cdsApi, type CdsGuidelineDto } from '../../services/api/cdsApi'
import { DataTable } from '../../components/common/DataTable'
import { t } from '../../i18n/appI18n'
import { severityColor, statusColor } from '../../theme/statusTokens'

const INITIAL_FORM = { name: '', category: '通用', version: '1.0', status: 'draft', description: '', source: '' }

const STATUS_COLORS: Record<string, string> = {
  active: severityColor('success'),
  draft: severityColor('warning'),
  archived: statusColor('archived'),
}

const STATUS_LABELS: Record<string, string> = {
  active: '启用',
  draft: '草稿',
  archived: '归档',
}

const CATEGORY_OPTIONS = ['通用', '呼吸', '心脏', '神经', '造影', '剂量', '骨骼']

function normalizeList(res: { success: boolean; data: CdsGuidelineDto[] | { data: CdsGuidelineDto[] } }): CdsGuidelineDto[] {
  if (!res.success) return []
  const d = res.data as unknown
  if (Array.isArray(d)) return d as CdsGuidelineDto[]
  const nested = (d as { data?: unknown })?.data
  if (Array.isArray(nested)) return nested as CdsGuidelineDto[]
  return []
}

export default function GuidelineLibraryPage() {
  const [guidelines, setGuidelines] = useState<CdsGuidelineDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState({ ...INITIAL_FORM })
  const [creating, setCreating] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<CdsGuidelineDto | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' })

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type })
  }, [])

  useEffect(() => {
    if (!toast.show) return
    const timer = setTimeout(() => setToast((t0) => ({ ...t0, show: false })), 2000)
    return () => clearTimeout(timer)
  }, [toast.show])

  const fetchGuidelines = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await cdsApi.listGuidelines()
      const items = normalizeList(res)
      setGuidelines(items)
      if (!res.success) setError(res.error?.message ?? t('guideline.listLoadFailed'))
    } catch (e) {
      setError((e as Error)?.message || t('guideline.listLoadFailed'))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchGuidelines() }, [fetchGuidelines])

  const handleOpenDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await cdsApi.getGuideline(id)
      if (res.success) {
        const d = res.data as unknown
        const item = Array.isArray(d) ? (d as CdsGuidelineDto[])[0] : (d as CdsGuidelineDto)
        if (item?.id) setDetail(item)
        else showToast(t('guideline.notFound'), 'error')
      } else {
        showToast(res.error?.message ?? t('guideline.detailLoadFailed'), 'error')
      }
    } catch (e) {
      showToast((e as Error)?.message || t('guideline.detailLoadFailed'), 'error')
    }
    setDetailLoading(false)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) {
      showToast(t('guideline.nameRequired'), 'error')
      return
    }
    setCreating(true)
    try {
      const res = await cdsApi.createGuideline({
        name: form.name.trim(),
        category: form.category,
        version: form.version || '1.0',
        status: form.status,
        description: form.description.trim(),
        source: form.source.trim(),
      })
      if (res.success) {
        setShowCreateModal(false)
        setForm({ ...INITIAL_FORM })
        showToast(`指南「${form.name.trim()}」已创建`, 'success')
        fetchGuidelines()
      } else {
        showToast(res.error?.message ?? t('guideline.createFailed'), 'error')
      }
    } catch (e) {
      showToast((e as Error)?.message || t('guideline.createFailed'), 'error')
    }
    setCreating(false)
  }

  const filtered = useMemo(() => {
    let items = guidelines
    if (searchText) {
      const q = searchText.toLowerCase()
      items = items.filter((g) => g.name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q) || g.id.toLowerCase().includes(q))
    }
    return items
  }, [guidelines, searchText])

  const guidelineColumns = [
    {
      title: t('guideline.colName'), key: 'name',
      render: (_: unknown, g: CdsGuidelineDto) => (
        <div>
          <span>{g.name}</span>
          <span style={{ fontSize: 12, color: '#6e7681', marginLeft: 8 }}>({g.id})</span>
        </div>
      ),
    },
    { title: t('guideline.colCategory'), dataIndex: 'category', key: 'category', render: (v: string) => <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
    { title: t('guideline.colVersion'), dataIndex: 'version', key: 'version', render: (v: string) => <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>v{v}</span> },
    { title: t('guideline.colStatus'), dataIndex: 'status', key: 'status', render: (v: string) => <span style={{ fontSize: 12, color: STATUS_COLORS[v] || 'var(--text-muted, #8b949e)' }}>{STATUS_LABELS[v] || v}</span> },
    { title: t('guideline.colUpdatedAt'), dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => <span style={{ fontSize: 12, color: '#6e7681' }}>{v ? new Date(v).toLocaleString('zh-CN') : '-'}</span> },
    {
      title: t('guideline.colActions'), key: 'actions',
      render: (_: unknown, g: CdsGuidelineDto) => (
        <button onClick={(e) => { e.stopPropagation(); handleOpenDetail(g.id) }} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'transparent', color: 'var(--text-muted, #8b949e)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Eye size={12} />{t('guideline.detail')}
        </button>
      ),
    },
  ]

  return (
    <div style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BookOpen size={24} />
          <span style={{ fontSize: 20, fontWeight: 600 }}>{t('guideline.title')}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { fetchGuidelines() }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <RefreshCw size={14} />{t('guideline.refresh')}
          </button>
          <button onClick={() => { setForm({ ...INITIAL_FORM }); setShowCreateModal(true) }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Plus size={14} />{t('guideline.newGuideline')}
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#6e7681' }} />
            <input
              type="text"
              placeholder={t('guideline.searchPlaceholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ padding: '8px 12px 8px 34px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-card, #161b22)', color: 'var(--text-primary, #f0f6fc)', fontSize: 13, width: 260,}}
            />
          </div>
          <span style={{ fontSize: 13, color: '#6e7681' }}>{t('guideline.total', { count: filtered.length })}</span>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 6, border: '1px solid #ef444455', background: '#ef444410', color: '#f87171', fontSize: 13, marginBottom: 16 }}>
            {t('guideline.loadFailed')}: {error}
          </div>
        )}

        <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, overflow: 'hidden' }}>
          <DataTable
            dataSource={filtered}
            rowKey="id"
            columns={guidelineColumns}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            emptyText={t('guideline.emptyList')}
            onRow={(record) => ({
              role: 'button',
              tabIndex: 0,
              onClick: () => handleOpenDetail(record.id),
              onKeyDown: (e) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenDetail(record.id) } },
              style: { cursor: 'pointer' },
            })}
          />
        </div>
      </div>

      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowCreateModal(false)}>
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 12, padding: 24, width: 520, maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #f0f6fc)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={18} style={{ color: '#3b82f6' }} /> {t('guideline.newGuideline')}
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ border: 'none', background: 'transparent', color: '#6e7681', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 4 }}>{t('guideline.labelName')}</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('guideline.namePlaceholder')} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 4 }}>{t('guideline.colCategory')}</label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 13, boxSizing: 'border-box' }}>
                    {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 4 }}>{t('guideline.labelVersion')}</label>
                  <input value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} placeholder="2025" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 4 }}>{t('guideline.colStatus')}</label>
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 13, boxSizing: 'border-box' }}>
                    <option value="draft">{t('guideline.statusDraft')}</option>
                    <option value="active">{t('guideline.statusActive')}</option>
                    <option value="archived">{t('guideline.statusArchived')}</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 4 }}>{t('guideline.labelSource')}</label>
                  <input value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} placeholder={t('guideline.sourcePlaceholder')} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 4 }}>{t('guideline.labelDescription')}</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder={t('guideline.descriptionPlaceholder')} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowCreateModal(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'transparent', color: 'var(--text-muted, #8b949e)', cursor: 'pointer', fontSize: 13 }}>{t('guideline.cancel')}</button>
              <button onClick={handleCreate} disabled={creating} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#1e40af', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Save size={14} />{creating ? t('guideline.creating') : t('guideline.createGuideline')}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }} onClick={() => setDetailOpen(false)}>
          <div style={{ width: 480, maxWidth: '92vw', height: '100%', background: 'var(--bg-card, #161b22)', borderLeft: '1px solid var(--border-default, #30363d)', padding: 24, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #f0f6fc)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={18} style={{ color: '#3b82f6' }} /> {t('guideline.detailTitle')}
              </div>
              <button onClick={() => setDetailOpen(false)} style={{ border: 'none', background: 'transparent', color: '#6e7681', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            {detailLoading ? (
              <div style={{ textAlign: 'center', color: '#6e7681', padding: '48px 0', fontSize: 13 }}>{t('guideline.loadingDetail')}</div>
            ) : detail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'ID', value: detail.id },
                  { label: t('guideline.detailName'), value: detail.name },
                  { label: t('guideline.colCategory'), value: detail.category },
                  { label: t('guideline.detailVersion'), value: `v${detail.version}` },
                  { label: t('guideline.colStatus'), value: STATUS_LABELS[detail.status] || detail.status },
                  { label: t('guideline.labelSource'), value: detail.source || '-' },
                  { label: t('guideline.colUpdatedAt'), value: detail.updatedAt ? new Date(detail.updatedAt).toLocaleString('zh-CN') : '-' },
                ].map((row) => (
                  <div key={row.label} style={{ display: 'flex', gap: 12, padding: '10px 12px', background: 'var(--bg-primary, #0d1117)', borderRadius: 6 }}>
                    <span style={{ width: 80, fontSize: 12, color: 'var(--text-muted, #8b949e)', flexShrink: 0 }}>{row.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-primary, #f0f6fc)' }}>{row.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 12, padding: '10px 12px', background: 'var(--bg-primary, #0d1117)', borderRadius: 6 }}>
                  <span style={{ width: 80, fontSize: 12, color: 'var(--text-muted, #8b949e)', flexShrink: 0 }}>{t('guideline.labelDescription')}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary, #f0f6fc)', lineHeight: 1.6 }}>{detail.description || '-'}</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#6e7681', padding: '48px 0', fontSize: 13 }}>{t('guideline.notFound')}</div>
            )}
          </div>
        </div>
      )}

      {toast.show && (
        <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'success' ? 'var(--color-success-600, #16a34a)' : 'var(--color-error-600, #dc2626)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 1100 }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
