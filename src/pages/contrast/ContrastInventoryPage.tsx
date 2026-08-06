import { useState, useEffect, useMemo } from 'react'
import { Package, Plus, Search, AlertTriangle, ChevronDown, ChevronRight, Archive } from 'lucide-react'
import { getContrastInventoryService } from '../../services/contrast'
import type { ContrastInventoryItem, ContrastAgentType } from '../../services/contrast'

const svc = getContrastInventoryService()

const AGENT_COLORS: Record<ContrastAgentType, string> = {
  iodinated: '#3b82f6', gadolinium: '#22c55e', ultrasound: '#f59e0b', barium: '#a855f7', other: '#6e7681',
}


export default function ContrastInventoryPage() {
  const [inventory, setInventory] = useState<ContrastInventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [_showReceive, setShowReceive] = useState(false)

  useEffect(() => {
    const run = async () => {
      const items = await svc.getInventory()
      setInventory(items)
      setLoading(false)
    }
    void run()
  }, [])

  const filtered = useMemo(() => {
    if (!searchText) return inventory
    const q = searchText.toLowerCase()
    return inventory.filter(i => i.contrastName.toLowerCase().includes(q) || i.batchId.toLowerCase().includes(q) || i.lotNumber.toLowerCase().includes(q))
  }, [inventory, searchText])

  const alerts = useMemo(() => inventory.filter(i => i.status === 'low' || i.status === 'expired'), [inventory])

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>加载中...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Package size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>对比剂库存管理</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowLog(!showLog)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: showLog ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Archive size={14} />出入库记录
          </button>
          <button onClick={() => setShowReceive(true)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Plus size={14} />入库登记
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div style={{ margin: '16px 24px 0', padding: 12, borderRadius: 8, background: '#f59e0b20', border: '1px solid #f59e0b40', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: 13 }}>警告: {alerts.filter(a => a.status === 'low').length} 项库存不足，{alerts.filter(a => a.status === 'expired').length} 项已过期</span>
        </div>
      )}

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#6e7681' }} />
            <input type="text" placeholder="搜索对比剂/批次号..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ padding: '8px 12px 8px 34px', borderRadius: 6, border: '1px solid #30363d', background: '#161b22', color: '#f0f6fc', fontSize: 13, width: 240, outline: 'none' }} />
          </div>
          <span style={{ fontSize: 13, color: '#6e7681' }}>共 {filtered.length} 批次</span>
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 100px 100px 120px 100px 80px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', background: '#0d1117', color: '#8b949e', fontSize: 12, fontWeight: 600 }}>
            <span></span><span>对比剂/批次</span><span>总量</span><span>剩余量</span><span>有效期</span><span>供应商</span><span>状态</span>
          </div>
          {filtered.map((item, idx) => (
            <div key={item.batchId}>
              <div onClick={() => setExpandedId(expandedId === item.batchId ? null : item.batchId)} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 100px 100px 120px 100px 80px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', alignItems: 'center', background: idx % 2 === 0 ? '#0d1117' : '#161b22', cursor: 'pointer' }}>
                <span style={{ color: '#6e7681' }}>{expandedId === item.batchId ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: AGENT_COLORS[item.agentType], display: 'inline-block' }}></span>
                  <span style={{ fontSize: 13 }}>{item.contrastName}</span>
                  <span style={{ fontSize: 12, color: '#6e7681' }}>({item.batchId})</span>
                </div>
                <span style={{ fontSize: 12 }}>{item.volumeMl}mL</span>
                <span style={{ fontSize: 12, color: item.remainingMl < item.lowStockThresholdMl ? '#ef4444' : '#f0f6fc' }}>{item.remainingMl}mL</span>
                <span style={{ fontSize: 12, color: new Date(item.expiryDate) < new Date() ? '#ef4444' : '#8b949e' }}>{new Date(item.expiryDate).toLocaleDateString('zh-CN')}</span>
                <span style={{ fontSize: 12, color: '#8b949e' }}>{item.supplier}</span>
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: item.status === 'available' ? '#22c55e20' : item.status === 'low' ? '#f59e0b20' : item.status === 'expired' ? '#ef444420' : '#6e768120', color: item.status === 'available' ? '#22c55e' : item.status === 'low' ? '#f59e0b' : item.status === 'expired' ? '#ef4444' : '#6e7681', textAlign: 'center' }}>
                  {item.status === 'available' ? '正常' : item.status === 'low' ? '不足' : item.status === 'expired' ? '过期' : '耗竭'}
                </span>
              </div>
              {expandedId === item.batchId && (
                <div style={{ padding: '12px 16px 12px 48px', background: '#0d1117', borderBottom: '1px solid #21262d', display: 'flex', gap: 8 }}>
                  <button style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 12 }}>调拨</button>
                  <button style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 12 }}>报损</button>
                  <button style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 12 }}>查看记录</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
