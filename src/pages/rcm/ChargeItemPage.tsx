import { useState, useMemo } from 'react'
import { Modal, Input } from 'antd'
import { Search, Plus, Edit3, ToggleLeft, ToggleRight, DollarSign, X, Check, List, Monitor, Radio, Cpu, Printer, Scan } from 'lucide-react'
import type { ChargeItemDto } from '../../services/rcm'

type ModalityType = 'all' | 'CT' | 'MRI' | 'DSA' | 'DR' | 'MG'

const MODALITY_OPTIONS: { value: ModalityType; label: string; icon: typeof Monitor }[] = [
  { value: 'all', label: '全部', icon: List },
  { value: 'CT', label: 'CT', icon: Scan },
  { value: 'MRI', label: 'MRI', icon: Radio },
  { value: 'DSA', label: 'DSA', icon: Cpu },
  { value: 'DR', label: 'DR', icon: Printer },
  { value: 'MG', label: 'MG', icon: Monitor },
]

const MODALITY_COLORS: Record<string, string> = {
  CT: '#3b82f6', MRI: '#8b5cf6', DSA: '#f59e0b', DR: '#22c55e', MG: '#ec4899', CR: '#6b7280', RF: '#14b8a6',
}

const MOCK_ITEMS: ChargeItemDto[] = [
  { id: 'ci-001', code: 'CT-PLAIN-HEAD', name: 'CT平扫(头颅)', modality: 'CT', category: '检查', price: 450, insuranceCode: '210300001', isActive: true, description: '头颅CT平扫', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-002', code: 'CT-CONTRAST-CHEST', name: 'CT增强(胸部)', modality: 'CT', category: '增强', price: 850, insuranceCode: '210300002', isActive: true, description: '胸部CT增强扫描', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-003', code: 'CT-CCTA', name: '冠脉CTA', modality: 'CT', category: '造影', price: 1500, insuranceCode: '210300003', isActive: true, description: '冠状动脉CT血管成像', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-004', code: 'MR-PLAIN-BRAIN', name: 'MRI平扫(头颅)', modality: 'MRI', category: '检查', price: 780, insuranceCode: '210300004', isActive: true, description: '头颅MRI平扫', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-005', code: 'MR-CONTRAST-ABDOMEN', name: 'MRI增强(腹部)', modality: 'MRI', category: '增强', price: 1200, insuranceCode: '210300005', isActive: true, description: '腹部MRI增强扫描', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-006', code: 'DSA-CORONARY', name: '冠脉造影', modality: 'DSA', category: '介入', price: 8500, insuranceCode: '210300006', isActive: true, description: '冠状动脉造影术', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-007', code: 'DSA-PERIPHERAL', name: '外周血管造影', modality: 'DSA', category: '介入', price: 6800, insuranceCode: '210300007', isActive: true, description: '外周血管造影及介入治疗', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-008', code: 'DR-CHEST', name: '胸部正侧位', modality: 'DR', category: '检查', price: 120, insuranceCode: '210300008', isActive: true, description: '胸部正侧位DR', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-009', code: 'DR-BONE', name: '骨骼X线(单部位)', modality: 'DR', category: '检查', price: 150, insuranceCode: '210300009', isActive: true, description: '单部位骨骼X线检查', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-010', code: 'MG-BREAST', name: '乳腺钼靶(双乳)', modality: 'MG', category: '检查', price: 280, insuranceCode: '210300010', isActive: true, description: '双侧乳腺钼靶摄影', createdTime: '2025-01-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-011', code: 'CT-LUNG-LOWDOSE', name: 'CT低剂量肺筛查', modality: 'CT', category: '检查', price: 320, insuranceCode: '210300011', isActive: false, description: '低剂量胸部CT肺癌筛查', createdTime: '2025-06-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
  { id: 'ci-012', code: 'MR-FUNCTIONAL', name: 'MR功能成像(fMRI)', modality: 'MRI', category: '检查', price: 980, insuranceCode: '210300012', isActive: true, description: '脑功能磁共振成像', createdTime: '2025-06-01T00:00:00Z', updatedTime: '2026-01-01T00:00:00Z' },
]

export default function ChargeItemPage() {
  const [items, setItems] = useState<ChargeItemDto[]>(MOCK_ITEMS)
  const [modalityFilter, setModalityFilter] = useState<ModalityType>('all')
  const [searchText, setSearchText] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showBulkPrice, setShowBulkPrice] = useState(false)
  const [bulkPrice, setBulkPrice] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const filteredItems = useMemo(() => {
    let arr = items
    if (!showInactive) arr = arr.filter(i => i.isActive)
    if (modalityFilter !== 'all') arr = arr.filter(i => i.modality === modalityFilter)
    if (searchText) {
      const q = searchText.toLowerCase()
      arr = arr.filter(i => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) || (i.insuranceCode || '').toLowerCase().includes(q))
    }
    return arr
  }, [items, modalityFilter, searchText, showInactive])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const toggleAll = () => {
    const ids = filteredItems.map(i => i.id)
    setSelectedIds(prev => prev.length === ids.length ? [] : ids)
  }

  const handleBulkPriceUpdate = () => {
    if (!bulkPrice || isNaN(Number(bulkPrice))) return
    const newPrice = Number(bulkPrice)
    setItems(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, price: newPrice, updatedTime: new Date().toISOString() } : i))
    setShowBulkPrice(false)
    setBulkPrice('')
    setSelectedIds([])
  }

  const handleAddItem = () => {
    const newItem: ChargeItemDto = {
      id: `ci-${Date.now()}`,
      code: `NEW-${Date.now().toString().slice(-6)}`,
      name: '新收费项目',
      modality: 'CT',
      category: '检查',
      price: 0,
      insuranceCode: '',
      isActive: true,
      description: '请编辑',
      createdTime: new Date().toISOString(),
      updatedTime: new Date().toISOString(),
    }
    setItems(prev => [newItem, ...prev])
  }

  const handleEditItem = (item: ChargeItemDto) => {
    let newName = item.name
    Modal.confirm({
      title: '编辑项目名称',
      content: <Input defaultValue={item.name} autoFocus onChange={(e) => { newName = e.target.value }} />,
      okText: '保存',
      cancelText: '取消',
      onOk: () => {
        if (newName && newName !== item.name) {
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, name: newName, updatedTime: new Date().toISOString() } : i))
        }
      },
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DollarSign size={24} />
          <span style={{ fontSize: 20, fontWeight: 600 }}>收费项目管理</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setShowBulkPrice(true)} disabled={selectedIds.length === 0} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, opacity: selectedIds.length === 0 ? 0.5 : 1 }}><DollarSign size={14} />批量调价</button>
          <button type="button" onClick={handleAddItem} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#1e40af', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}><Plus size={14} />新增项目</button>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#6e7681' }} />
              <input type="text" placeholder="搜索项目名称/编码..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ padding: '8px 12px 8px 34px', borderRadius: 6, border: '1px solid #30363d', background: '#161b22', color: '#f0f6fc', fontSize: 13, width: 240, outline: 'none' }} />
            </div>
            {MODALITY_OPTIONS.map(opt => {
              const Icon = opt.icon
              return (
                <button key={opt.value} type="button" onClick={() => setModalityFilter(opt.value)} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, background: modalityFilter === opt.value ? '#1e40af' : '#21262d', color: modalityFilter === opt.value ? '#fff' : '#8b949e' }}>
                  <Icon size={14} />{opt.label}
                </button>
              )
            })}
            <button type="button" onClick={() => setShowInactive(!showInactive)} style={{ padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, background: showInactive ? '#f59e0b20' : '#21262d', color: showInactive ? '#f59e0b' : '#8b949e' }}>
              {showInactive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}显示已停用
            </button>
          </div>
          <span style={{ fontSize: 13, color: '#6e7681' }}>共 {filteredItems.length} 项</span>
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '36px 120px 1fr 80px 80px 70px 100px 80px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', background: '#0d1117', color: '#8b949e', fontSize: 12, fontWeight: 600 }}>
            <input type="checkbox" checked={selectedIds.length === filteredItems.length && filteredItems.length > 0} onChange={toggleAll} />
            <span>编码</span>
            <span>项目名称</span>
            <span>设备类型</span>
            <span>类别</span>
            <span>状态</span>
            <span style={{ textAlign: 'right' }}>价格(元)</span>
            <span>操作</span>
          </div>
          {filteredItems.map((item, idx) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '36px 120px 1fr 80px 80px 70px 100px 80px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', alignItems: 'center', background: idx % 2 === 0 ? '#0d1117' : '#161b22' }}>
              <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} />
              <span style={{ fontSize: 12, color: '#6e7681', fontFamily: 'monospace' }}>{item.code}</span>
              <div>
                <span style={{ fontSize: 13 }}>{item.name}</span>
                {item.description && <div style={{ fontSize: 12, color: '#6e7681' }}>{item.description}</div>}
              </div>
              <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500, background: `${MODALITY_COLORS[item.modality] || '#6b7280'}20`, color: MODALITY_COLORS[item.modality] || '#6b7280', textAlign: 'center', width: 'fit-content' }}>{item.modality}</span>
              <span style={{ fontSize: 12, color: '#8b949e' }}>{item.category}</span>
              <span style={{ fontSize: 12, color: item.isActive ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                {item.isActive ? <Check size={12} /> : <X size={12} />}{item.isActive ? '启用' : '停用'}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, textAlign: 'right', color: '#22c55e' }}>¥{item.price.toLocaleString()}</span>
              <button type="button" onClick={() => handleEditItem(item)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><Edit3 size={12} />编辑</button>
            </div>
          ))}
        </div>
      </div>

      {showBulkPrice && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setShowBulkPrice(false)}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 24, width: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><DollarSign size={18} />批量调价</div>
            <div style={{ fontSize: 13, color: '#8b949e', marginBottom: 12 }}>已选择 <strong style={{ color: '#f0f6fc' }}>{selectedIds.length}</strong> 个项目</div>
            <input type="number" placeholder="输入新价格(元)" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 14, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" onClick={() => setShowBulkPrice(false)} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 13 }}>取消</button>
              <button type="button" onClick={handleBulkPriceUpdate} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#1e40af', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>确认更新</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
