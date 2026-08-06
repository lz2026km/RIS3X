// [W1-5] 收费项目管理 — 接入 financeApi (list/create/update/delete charge-items CRUD)
import { useState, useMemo, useCallback, useEffect } from 'react'
import { Modal, Input, Select, message, Spin } from 'antd'
import { Search, Plus, Edit3, ToggleLeft, ToggleRight, DollarSign, X, Check, List, Trash2, RefreshCw } from 'lucide-react'
import { financeApi, type ChargeItemDto } from '../../services/api/financeApi'

const CATEGORY_OPTIONS = ['检查', '增强', '造影', '介入', '放射治疗', '其他']

const CATEGORY_COLORS: Record<string, string> = {
  检查: '#3b82f6', 增强: '#8b5cf6', 造影: '#f59e0b', 介入: '#22c55e', 放射治疗: '#ec4899', 其他: '#6b7280',
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
        setError(res.error?.message ?? '加载失败')
      }
    } catch (e) {
      setError((e as Error)?.message ?? '加载失败')
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
    if (!editor.name.trim()) { message.warning('请填写项目名称'); return }
    const price = Number(editor.unitPrice)
    if (Number.isNaN(price) || price < 0) { message.warning('请填写有效单价'); return }
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
        message.success(editor.id ? '收费项目已更新' : '收费项目已创建')
        setEditorOpen(false)
        void load()
      } else {
        message.error(res.error?.message ?? '保存失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (item: ChargeItemDto) => {
    Modal.confirm({
      title: '删除收费项目',
      content: `确认删除「${item.name}」?该操作不可恢复。`,
      okText: '删除',
      okButtonProps: { style: { background: '#ef4444', borderColor: '#ef4444' } },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await financeApi.deleteChargeItem(item.id)
          if (res.success) {
            message.success('已删除收费项目')
            void load()
          } else {
            message.error(res.error?.message ?? '删除失败')
          }
        } catch (e) {
          message.error((e as Error)?.message ?? '删除失败')
        }
      },
    })
  }

  const handleToggleActive = async (item: ChargeItemDto) => {
    try {
      const res = await financeApi.updateChargeItem(item.id, { active: !item.active })
      if (res.success) {
        message.success(item.active ? '已停用' : '已启用')
        void load()
      } else {
        message.error(res.error?.message ?? '操作失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '操作失败')
    }
  }

  const modalStyle = { container: { background: '#161b22', color: '#f0f6fc' }, header: { background: '#161b22', color: '#f0f6fc', borderBottom: '1px solid #30363d' }, footer: { borderTop: '1px solid #30363d' } }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DollarSign size={24} />
          <span style={{ fontSize: 20, fontWeight: 600 }}>收费项目管理</span>
          <span style={{ fontSize: 12, padding: '2px 8px', background: 'rgba(255,255,255,0.2)', borderRadius: 4 }}>financeApi 已接入</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => void load()} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><RefreshCw size={14} />刷新</button>
          <button type="button" onClick={openCreate} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}><Plus size={14} />新增项目</button>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#6e7681' }} />
              <input type="text" placeholder="搜索项目名称/编号..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ padding: '8px 12px 8px 34px', borderRadius: 6, border: '1px solid #30363d', background: '#161b22', color: '#f0f6fc', fontSize: 13, width: 240, outline: 'none' }} />
            </div>
            <button type="button" onClick={() => setCategoryFilter('all')} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, background: categoryFilter === 'all' ? '#1e40af' : '#21262d', color: categoryFilter === 'all' ? '#fff' : '#8b949e' }}><List size={14} />全部</button>
            {CATEGORY_OPTIONS.map(cat => (
              <button key={cat} type="button" onClick={() => setCategoryFilter(cat)} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: categoryFilter === cat ? '#1e40af' : '#21262d', color: categoryFilter === cat ? '#fff' : '#8b949e' }}>{cat}</button>
            ))}
            <button type="button" onClick={() => setShowInactive(!showInactive)} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, background: showInactive ? '#f59e0b20' : '#21262d', color: showInactive ? '#f59e0b' : '#8b949e' }}>
              {showInactive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}显示已停用
            </button>
          </div>
          <span style={{ fontSize: 13, color: '#6e7681' }}>共 {filteredItems.length} 项 / 全部 {items.length} 项</span>
        </div>

        {error && (
          <div style={{ padding: 12, borderRadius: 6, background: '#ef444420', border: '1px solid #ef4444', color: '#fca5a5', marginBottom: 16, fontSize: 13 }}>
            加载失败:{error}
            <button onClick={() => void load()} style={{ marginLeft: 12, padding: '2px 10px', borderRadius: 4, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 12 }}>重试</button>
          </div>
        )}

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 100px 110px 80px 140px 110px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', background: '#0d1117', color: '#8b949e', fontSize: 12, fontWeight: 600 }}>
            <span>编号</span>
            <span>项目名称</span>
            <span>类别</span>
            <span>医保</span>
            <span>状态</span>
            <span style={{ textAlign: 'right' }}>单价(元)</span>
            <span>操作</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>
              <Spin size="large" />
              <div style={{ marginTop: 12, fontSize: 13 }}>加载收费项目...</div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6e7681', fontSize: 13 }}>暂无收费项目,点击右上角「新增项目」创建</div>
          ) : (
            filteredItems.map((item, idx) => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 100px 110px 80px 140px 110px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', alignItems: 'center', background: idx % 2 === 0 ? '#0d1117' : '#161b22' }}>
                <span style={{ fontSize: 12, color: '#6e7681', fontFamily: 'monospace' }}>{item.id}</span>
                <div>
                  <span style={{ fontSize: 13 }}>{item.name}</span>
                  {item.description && <div style={{ fontSize: 12, color: '#6e7681' }}>{item.description}</div>}
                </div>
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500, background: `${CATEGORY_COLORS[item.category] ?? '#6b7280'}20`, color: CATEGORY_COLORS[item.category] ?? '#6b7280', textAlign: 'center', width: 'fit-content' }}>{item.category ?? '检查'}</span>
                <span style={{ fontSize: 12, color: item.insuranceEligible ? '#22c55e' : '#f59e0b' }}>{item.insuranceEligible ? '可报销' : '自费'}</span>
                <span style={{ fontSize: 12, color: item.active ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {item.active ? <Check size={12} /> : <X size={12} />}{item.active ? '启用' : '停用'}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, textAlign: 'right', color: '#22c55e' }}>¥{(item.unitPrice ?? 0).toLocaleString()}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => openEdit(item)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><Edit3 size={12} />编辑</button>
                  <button type="button" onClick={() => handleToggleActive(item)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #30363d', background: 'transparent', color: item.active ? '#f59e0b' : '#22c55e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>{item.active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}{item.active ? '停用' : '启用'}</button>
                  <button type="button" onClick={() => handleDelete(item)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ef4444', background: 'transparent', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><Trash2 size={12} />删除</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        open={editorOpen}
        title={editor.id ? '编辑收费项目' : '新增收费项目'}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        onOk={() => void handleSave()}
        onCancel={() => setEditorOpen(false)}
        width={480}
        styles={modalStyle}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>项目名称 *</div>
            <Input value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} placeholder="例如:CT平扫(头颅)" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>类别</div>
              <Select value={editor.category} onChange={v => setEditor({ ...editor, category: v })} style={{ width: '100%' }} options={CATEGORY_OPTIONS.map(c => ({ value: c, label: c }))} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>单价(元) *</div>
              <Input type="number" min={0} value={editor.unitPrice} onChange={e => setEditor({ ...editor, unitPrice: e.target.value })} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>描述</div>
            <Input.TextArea value={editor.description} onChange={e => setEditor({ ...editor, description: e.target.value })} rows={2} placeholder="项目说明(可选)" />
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={editor.insuranceEligible} onChange={e => setEditor({ ...editor, insuranceEligible: e.target.checked })} style={{ width: 15, height: 15 }} />
              医保可报销
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={editor.active} onChange={e => setEditor({ ...editor, active: e.target.checked })} style={{ width: 15, height: 15 }} />
              启用
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
