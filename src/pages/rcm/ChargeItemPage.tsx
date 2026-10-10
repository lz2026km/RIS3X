// [W1-5] 收费项目管理 — 接入 financeApi (list/create/update/delete charge-items CRUD)
import { useState, useMemo, useCallback, useEffect } from 'react'
import { Modal, Input, Select, message } from 'antd'
import { Search, Plus, Edit3, ToggleLeft, ToggleRight, DollarSign, X, Check, List, Trash2, RefreshCw } from 'lucide-react'
import { financeApi, type ChargeItemDto } from '../../services/api/financeApi'
import { DataTable } from '../../components/common/DataTable'
import { t } from '../../i18n/appI18n'

const CATEGORY_OPTIONS = ['检查', '增强', '造影', '介入', '放射治疗', '其他']

const CATEGORY_COLORS: Record<string, string> = {
  检查: 'var(--color-primary-500)', 增强: '#8b5cf6', 造影: 'var(--color-warning-500)', 介入: 'var(--color-success-500)', 放射治疗: '#ec4899', 其他: '#6b7280',
}

function normalizeItems(res: { success: boolean; data: unknown }): ChargeItemDto[] {
  if (!res.success) return []
  const d = res.data as any
  if (Array.isArray(d)) return d as ChargeItemDto[]
  if (d && Array.isArray(d.items)) return d.items as ChargeItemDto[]
  if (d && Array.isArray(d.data)) return d.data as ChargeItemDto[]
  return []
}

interface EditorState {
  id?: string
  name: string
  category: string
  unitPrice: string
  description: string
  insuranceEligible: boolean
  active: boolean
}

const EMPTY_EDITOR: EditorState = {
  id: undefined, name: '', category: '检查', unitPrice: '0', description: '', insuranceEligible: true, active: true,
}

export default function ChargeItemPage() {
  const [items, setItems] = useState<ChargeItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchText, setSearchText] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await financeApi.listChargeItems()
      if (res.success) {
        setItems(normalizeItems(res))
      } else {
        setError(res.error?.message ?? t('chargeItem.loadFailed'))
      }
    } catch (e) {
      setError((e as Error)?.message ?? t('chargeItem.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filteredItems = useMemo(() => {
    let arr = items
    if (!showInactive) arr = arr.filter(i => i.active)
    if (categoryFilter !== 'all') arr = arr.filter(i => i.category === categoryFilter)
    if (searchText) {
      const q = searchText.toLowerCase()
      arr = arr.filter(i => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q))
    }
    return arr
  }, [items, categoryFilter, searchText, showInactive])

  const openCreate = () => {
    setEditor(EMPTY_EDITOR)
    setEditorOpen(true)
  }

  const openEdit = (item: ChargeItemDto) => {
    setEditor({
      id: item.id, name: item.name, category: item.category ?? '检查',
      unitPrice: String(item.unitPrice ?? 0), description: item.description ?? '',
      insuranceEligible: item.insuranceEligible !== false, active: item.active !== false,
    })
    setEditorOpen(true)
  }

  const handleSave = async () => {
    if (!editor.name.trim()) { message.warning(t('chargeItem.nameRequired')); return }
    const price = Number(editor.unitPrice)
    if (Number.isNaN(price) || price < 0) { message.warning(t('chargeItem.priceInvalid')); return }
    setSaving(true)
    const payload = {
      name: editor.name.trim(),
      category: editor.category,
      unitPrice: price,
      description: editor.description.trim() || undefined,
      insuranceEligible: editor.insuranceEligible,
      active: editor.active,
    }
    try {
      const res = editor.id
        ? await financeApi.updateChargeItem(editor.id, payload)
        : await financeApi.createChargeItem(payload)
      if (res.success) {
        message.success(editor.id ? t('chargeItem.updated') : t('chargeItem.created'))
        setEditorOpen(false)
        void load()
      } else {
        message.error(res.error?.message ?? t('chargeItem.saveFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('chargeItem.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (item: ChargeItemDto) => {
    Modal.confirm({
      title: t('chargeItem.deleteTitle'),
      content: t('w9e.chargeItem.deleteConfirm', { name: item.name }),
      okText: t('chargeItem.delete'),
      okButtonProps: { style: { background: 'var(--color-error-500, var(--color-error-500))', borderColor: 'var(--color-error-500, var(--color-error-500))' } },
      cancelText: t('chargeItem.cancel'),
      onOk: async () => {
        try {
          const res = await financeApi.deleteChargeItem(item.id)
          if (res.success) {
            message.success(t('chargeItem.deleted'))
            void load()
          } else {
            message.error(res.error?.message ?? t('chargeItem.deleteFailed'))
          }
        } catch (e) {
          message.error((e as Error)?.message ?? t('chargeItem.deleteFailed'))
        }
      },
    })
  }

  const handleToggleActive = async (item: ChargeItemDto) => {
    try {
      const res = await financeApi.updateChargeItem(item.id, { active: !item.active })
      if (res.success) {
        message.success(item.active ? t('chargeItem.disabled') : t('chargeItem.enabled'))
        void load()
      } else {
        message.error(res.error?.message ?? t('chargeItem.operationFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('chargeItem.operationFailed'))
    }
  }

  const chargeColumns = [
    { title: t('chargeItem.colId'), dataIndex: 'id', key: 'id', render: (v: string) => <span style={{ fontSize: 12, color: '#6e7681', fontFamily: 'monospace' }}>{v}</span> },
    {
      title: t('chargeItem.colName'), key: 'name',
      render: (_: unknown, item: ChargeItemDto) => (
        <div>
          <span>{item.name}</span>
          {item.description && <div style={{ fontSize: 12, color: '#6e7681' }}>{item.description}</div>}
        </div>
      ),
    },
    {
      title: t('chargeItem.colCategory'), dataIndex: 'category', key: 'category',
      render: (v: string) => <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: `${CATEGORY_COLORS[v] ?? '#6b7280'}20`, color: CATEGORY_COLORS[v] ?? '#6b7280' }}>{v ?? '检查'}</span>,
    },
    {
      title: t('chargeItem.colInsurance'), dataIndex: 'insuranceEligible', key: 'insuranceEligible',
      render: (v: boolean) => <span style={{ fontSize: 12, color: v ? 'var(--color-success-500, var(--color-success-500))' : 'var(--color-warning-500, var(--color-warning-500))' }}>{v ? t('chargeItem.reimbursable') : t('chargeItem.selfPay')}</span>,
    },
    {
      title: t('chargeItem.colStatus'), dataIndex: 'active', key: 'active',
      render: (v: boolean) => (
        <span style={{ fontSize: 12, color: v ? 'var(--color-success-500, var(--color-success-500))' : 'var(--color-error-500, var(--color-error-500))', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
          {v ? <Check size={12} /> : <X size={12} />}{v ? t('chargeItem.enabled') : t('chargeItem.disabled')}
        </span>
      ),
    },
    { title: t('chargeItem.colPrice'), dataIndex: 'unitPrice', key: 'unitPrice', align: 'right' as const, render: (v: number) => <strong style={{ color: 'var(--color-success-500, var(--color-success-500))' }}>¥{(v ?? 0).toLocaleString()}</strong> },
    {
      title: t('chargeItem.colActions'), key: 'actions',
      render: (_: unknown, item: ChargeItemDto) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => openEdit(item)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'transparent', color: 'var(--text-muted, #8b949e)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', fontSize: 12 }}><Edit3 size={12} />{t('chargeItem.edit')}</button>
          <button type="button" onClick={() => handleToggleActive(item)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'transparent', color: item.active ? 'var(--color-warning-500, var(--color-warning-500))' : 'var(--color-success-500, var(--color-success-500))', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', fontSize: 12 }}>{item.active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}{item.active ? t('chargeItem.disabled') : t('chargeItem.enabled')}</button>
          <button type="button" onClick={() => handleDelete(item)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-error-500, var(--color-error-500))', background: 'transparent', color: 'var(--color-error-400, #f87171)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', fontSize: 12 }}><Trash2 size={12} />{t('chargeItem.delete')}</button>
        </div>
      ),
    },
  ]

  const modalStyle = { container: { background: 'var(--bg-card, #161b22)', color: 'var(--text-primary, #f0f6fc)' }, header: { background: 'var(--bg-card, #161b22)', color: 'var(--text-primary, #f0f6fc)', borderBottom: '1px solid var(--border-default, #30363d)' }, footer: { borderTop: '1px solid var(--border-default, #30363d)' } }

  return (
    <div style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,var(--color-primary-800),#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)' }}>
          <DollarSign size={24} />
          <span style={{ fontSize: 20, fontWeight: 600 }}>{t('chargeItem.title')}</span>
          <span style={{ fontSize: 12, padding: '2px 8px', background: 'rgba(255,255,255,0.2)', borderRadius: 4 }}>{t('chargeItem.apiConnected')}</span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
          <button type="button" onClick={() => void load()} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}><RefreshCw size={14} />{t('chargeItem.refresh')}</button>
          <button type="button" onClick={openCreate} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: 'var(--color-success-500, var(--color-success-500))', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}><Plus size={14} />{t('chargeItem.newItem')}</button>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#6e7681' }} />
              <input type="text" placeholder={t('chargeItem.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} style={{ padding: '8px 12px 8px 34px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-card, #161b22)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12, width: 240,}} />
            </div>
            <button type="button" onClick={() => setCategoryFilter('all')} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, background: categoryFilter === 'all' ? 'var(--color-primary-800)' : 'var(--bg-secondary, #21262d)', color: categoryFilter === 'all' ? '#fff' : 'var(--text-muted, #8b949e)' }}><List size={14} />{t('chargeItem.all')}</button>
            {CATEGORY_OPTIONS.map(cat => (
              <button key={cat} type="button" onClick={() => setCategoryFilter(cat)} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: categoryFilter === cat ? 'var(--color-primary-800)' : 'var(--bg-secondary, #21262d)', color: categoryFilter === cat ? '#fff' : 'var(--text-muted, #8b949e)' }}>{cat}</button>
            ))}
            <button type="button" onClick={() => setShowInactive(!showInactive)} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, background: showInactive ? '#f59e0b20' : 'var(--bg-secondary, #21262d)', color: showInactive ? 'var(--color-warning-500)' : 'var(--text-muted, #8b949e)' }}>
              {showInactive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}{t('chargeItem.showInactive')}
            </button>
          </div>
          <span style={{ fontSize: 12, color: '#6e7681' }}>{t('chargeItem.total', { filtered: filteredItems.length, total: items.length })}</span>
        </div>

        {error && (
          <div style={{ padding: 'var(--space-3, 12px)', borderRadius: 6, background: '#ef444420', border: '1px solid var(--color-error-500)', color: '#fca5a5', marginBottom: 'var(--space-4, 16px)', fontSize: 12 }}>
            {t('chargeItem.loadFailed')}:{error}
            <button onClick={() => void load()} style={{ marginLeft: 'var(--space-3, 12px)', padding: '2px 10px', borderRadius: 4, border: 'none', background: 'var(--color-error-500)', color: '#fff', cursor: 'pointer', fontSize: 12 }}>{t('chargeItem.retry')}</button>
          </div>
        )}

        <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, overflow: 'hidden' }}>
          <DataTable dataSource={filteredItems} rowKey="id" columns={chargeColumns} loading={loading} pagination={{ pageSize: 10, showSizeChanger: false }} emptyText={t('chargeItem.empty')} />
        </div>
      </div>

      <Modal
        open={editorOpen}
        title={editor.id ? t('chargeItem.editTitle') : t('chargeItem.newTitle')}
        okText={t('chargeItem.save')}
        cancelText={t('chargeItem.cancel')}
        confirmLoading={saving}
        onOk={() => void handleSave()}
        onCancel={() => setEditorOpen(false)}
        width={480}
        styles={modalStyle}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 'var(--space-2, 8px)' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 6 }}>{t('chargeItem.fieldName')}</div>
            <Input value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} placeholder={t('chargeItem.namePlaceholder')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 6 }}>{t('chargeItem.colCategory')}</div>
              <Select value={editor.category} onChange={v => setEditor({ ...editor, category: v })} style={{ width: '100%' }} options={CATEGORY_OPTIONS.map(c => ({ value: c, label: c }))} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 6 }}>{t('chargeItem.fieldPrice')}</div>
              <Input type="number" min={0} value={editor.unitPrice} onChange={e => setEditor({ ...editor, unitPrice: e.target.value })} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 6 }}>{t('chargeItem.fieldDescription')}</div>
            <Input.TextArea value={editor.description} onChange={e => setEditor({ ...editor, description: e.target.value })} rows={2} placeholder={t('chargeItem.descriptionPlaceholder')} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-6, 24px)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={editor.insuranceEligible} onChange={e => setEditor({ ...editor, insuranceEligible: e.target.checked })} style={{ width: 15, height: 15 }} />
              {t('chargeItem.insuranceEligible')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={editor.active} onChange={e => setEditor({ ...editor, active: e.target.checked })} style={{ width: 15, height: 15 }} />
              {t('chargeItem.enabled')}
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
