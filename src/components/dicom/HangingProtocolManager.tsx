/**
 * G005 RIS v3.0.6 - Hanging Protocol Manager (增强版)
 * 补齐挂片协议功能：导入导出、模板库、高级匹配、批量管理
 */
import React, { useState, useCallback, useMemo } from 'react'
import { message } from 'antd'
import {
  Settings, Star, Plus, Trash2, Download, Upload, Copy,
  ChevronDown, ChevronUp, Layout, LayoutGrid, Grid3x3,
  Search, Filter, Check, X, Edit3, Save,
} from 'lucide-react'
import {
  HangingProtocolProvider,
  HangingProtocolSwitcher,
  useHangingProtocol,
  type HangingProtocol,
  type HangingProtocolView,
} from '../v3/dicom/HangingProtocol'

const LAYOUT_ICONS: Record<string, React.ReactNode> = {
  '1x1': <Layout size={14} />,
  '2x1': <LayoutGrid size={14} />,
  '1x2': <LayoutGrid size={14} style={{ transform: 'rotate(90deg)' }} />,
  '2x2': <Grid3x3 size={14} />,
  '3x3': <Grid3x3 size={14} />,
}

const BODY_PARTS = [
  'HEAD', 'NECK', 'CHEST', 'ABDOMEN', 'PELVIS',
  'EXTREMITY', 'SPINE', 'CARDIAC', 'BREAST', 'WHOLE BODY',
]

const MODALITIES = ['CT', 'MR', 'DX', 'MG', 'US', 'NM', 'PT', 'XA']

interface ExtendedHangingProtocol extends HangingProtocol {
  bodyPart?: string
  tags?: string[]
  usageCount?: number
  lastUsed?: string
}

interface HangingProtocolManagerProps {
  onApply?: (protocol: HangingProtocol) => void
  modality?: string
  bodyPart?: string
}

const PROTOCOL_TEMPLATES: ExtendedHangingProtocol[] = [
  {
    id: 'tpl-chest-ct', name: '胸部CT标准', description: '胸部CT常规：肺窗+纵隔窗',
    builtin: true, modality: 'CT', bodyPart: 'CHEST', priority: 100,
    views: [
      { id: 'v1', layout: '1x1', initialWw: 1500, initialWl: -600, seriesMatcher: { modality: 'CT', bodyPart: 'CHEST' } },
      { id: 'v2', layout: '1x1', initialWw: 400, initialWl: 40 },
    ],
  },
  {
    id: 'tpl-brain-mr', name: '头颅MR标准', description: '头颅MR：T1/T2/FLAIR/DWI',
    builtin: true, modality: 'MR', bodyPart: 'HEAD', priority: 100,
    views: [
      { id: 'v1', layout: '2x2', initialWw: 80, initialWl: 40, seriesMatcher: { modality: 'MR' } },
    ],
  },
  {
    id: 'tpl-abdomen-ct', name: '腹部CT标准', description: '腹部CT：平扫+增强',
    builtin: true, modality: 'CT', bodyPart: 'ABDOMEN', priority: 100,
    views: [
      { id: 'v1', layout: '1x1', initialWw: 400, initialWl: 40, seriesMatcher: { modality: 'CT' } },
    ],
  },
  {
    id: 'tpl-spine-mr', name: '脊柱MR标准', description: '脊柱MR：矢状位+横断位',
    builtin: true, modality: 'MR', bodyPart: 'SPINE', priority: 90,
    views: [
      { id: 'v1', layout: '2x1', initialWw: 80, initialWl: 40, seriesMatcher: { modality: 'MR' } },
    ],
  },
  {
    id: 'tpl-cardiac-ct', name: '心脏CT标准', description: '心脏CTA：冠脉重建',
    builtin: true, modality: 'CT', bodyPart: 'CARDIAC', priority: 110,
    views: [
      { id: 'v1', layout: '2x1', initialWw: 300, initialWl: 100, seriesMatcher: { modality: 'CT' } },
    ],
  },
  {
    id: 'tpl-mammography', name: '乳腺钼靶标准', description: '乳腺钼靶：CC/MLO位',
    builtin: true, modality: 'MG', bodyPart: 'BREAST', priority: 100,
    views: [
      { id: 'v1', layout: '1x2', initialWw: 2000, initialWl: 400, seriesMatcher: { modality: 'MG' } },
    ],
  },
]

function HangingProtocolManagerInner({ onApply, modality, bodyPart }: HangingProtocolManagerProps) {
  const { protocols, active, applyProtocol, suggestProtocol, addProtocol, removeProtocol } = useHangingProtocol()
  const [expanded, setExpanded] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newModality, setNewModality] = useState('')
  const [newBodyPart, setNewBodyPart] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterModality, setFilterModality] = useState('')
  const [importJson, setImportJson] = useState('')
  const [editingProtocol, setEditingProtocol] = useState<HangingProtocol | null>(null)

  const suggested = suggestProtocol(modality, bodyPart)

  const filteredProtocols = useMemo(() => {
    return protocols.filter(p => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false
      }
      if (filterModality && p.modality && p.modality !== filterModality) return false
      return true
    })
  }, [protocols, searchQuery, filterModality])

  const handleApply = useCallback((id: string) => {
    const p = applyProtocol(id)
    if (p && onApply) onApply(p)
  }, [applyProtocol, onApply])

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return
    const id = `custom-${Date.now()}`
    addProtocol({
      id,
      name: newName.trim(),
      description: newDesc.trim() || '自定义协议',
      builtin: false,
      modality: newModality.trim() || undefined,
      priority: 50,
      views: [{ id: `${id}-v1`, layout: '1x1' }],
    })
    setNewName('')
    setNewDesc('')
    setNewModality('')
    setNewBodyPart('')
    setShowCreate(false)
  }, [newName, newDesc, newModality, newBodyPart, addProtocol])

  const handleExport = useCallback(() => {
    const data = JSON.stringify(protocols.filter(p => !p.builtin), null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'hanging-protocols.json'
    link.click()
    URL.revokeObjectURL(url)
  }, [protocols])

  const handleImport = useCallback(() => {
    try {
      const parsed = JSON.parse(importJson) as HangingProtocol[]
      parsed.forEach(p => {
        addProtocol({ ...p, id: `imported-${Date.now()}-${p.id}`, builtin: false })
      })
      setShowImport(false)
      setImportJson('')
    } catch {
      message.error('JSON 格式错误')
    }
  }, [importJson, addProtocol])

  const handleDuplicate = useCallback((protocol: HangingProtocol) => {
    const id = `dup-${Date.now()}`
    addProtocol({
      ...protocol,
      id,
      name: `${protocol.name} (副本)`,
      builtin: false,
      priority: protocol.priority ?? 50,
    })
  }, [addProtocol])

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: 8,
      border: '1px solid #334155',
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded) } }}
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          background: '#1e293b',
        }}
      >
        <Settings size={14} color="#94a3b8" />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', flex: 1 }}>摆位协议管理</span>
        {active && (
          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#334155', color: '#60a5fa' }}>
            {active.name}
          </span>
        )}
        {suggested && suggested.id !== active?.id && (
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#1e3a5f', color: '#4ade80', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Star size={10} /> 推荐
          </span>
        )}
        {expanded ? <ChevronUp size={12} color="#94a3b8" /> : <ChevronDown size={12} color="#94a3b8" />}
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #334155', padding: '8px 0' }}>
          <div style={{ padding: '0 12px 8px' }}>
            <HangingProtocolSwitcher onApply={(p) => onApply?.(p)} showManager={false} />
          </div>

          {suggested && suggested.id !== active?.id && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleApply(suggested.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleApply(suggested.id) } }}
              style={{
                margin: '0 8px 8px',
                padding: '8px 10px',
                background: '#0f2a1f',
                border: '1px solid #166534',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Star size={12} color="#4ade80" />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#4ade80' }}>推荐: {suggested.name}</div>
                <div style={{ fontSize: 11, color: '#86efac', marginTop: 2 }}>{suggested.description}</div>
              </div>
            </div>
          )}

          {/* 搜索和过滤 */}
          <div style={{ padding: '0 8px', display: 'flex', gap: 6, marginBottom: 8 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: '#0f172a', borderRadius: 4, padding: '4px 8px', border: '1px solid #475569' }}>
              <Search size={12} color="#94a3b8" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索协议..."
                style={{ border: 'none', outline: 'none', background: 'transparent', color: '#e2e8f0', fontSize: 12, width: '100%' }}
              />
            </div>
            <select
              value={filterModality}
              onChange={e => setFilterModality(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: 12 }}
            >
              <option value="">全部</option>
              {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* 协议列表 */}
          <div style={{ padding: '0 8px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', padding: '4px 4px', textTransform: 'uppercase' }}>
              协议列表 ({filteredProtocols.length})
            </div>
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {filteredProtocols.map(p => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleApply(p.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleApply(p.id) } }}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: active?.id === p.id ? '#1e3a5f' : 'transparent',
                    marginBottom: 2,
                  }}
                  onMouseEnter={e => { if (active?.id !== p.id) e.currentTarget.style.background = '#27272a' }}
                  onMouseLeave={e => { if (active?.id !== p.id) e.currentTarget.style.background = 'transparent' }}
                >
                  {p.builtin && <Star size={10} color="#f59e0b" />}
                  {!p.builtin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeProtocol(p.id) }}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', padding: 0, display: 'flex' }}
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.description}
                      {p.modality && <span style={{ marginLeft: 4, padding: '1px 4px', background: '#334155', borderRadius: 3, fontSize: 10 }}>{p.modality}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {!p.builtin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDuplicate(p) }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#60a5fa', padding: 2, display: 'flex' }}
                        title="复制"
                      >
                        <Copy size={10} />
                      </button>
                    )}
                  </div>
                  {active?.id === p.id && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid #334155', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowCreate(true)}
              style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px dashed #475569', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <Plus size={12} /> 新建
            </button>
            <button
              onClick={() => setShowTemplates(true)}
              style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px dashed #475569', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <Star size={12} /> 模板库
            </button>
            <button
              onClick={handleExport}
              style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #475569', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              title="导出协议"
            >
              <Download size={12} />
            </button>
            <button
              onClick={() => setShowImport(true)}
              style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #475569', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              title="导入协议"
            >
              <Upload size={12} />
            </button>
          </div>

          {/* 新建协议模态框 */}
          {showCreate && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#1e293b', borderRadius: 12, border: '1px solid #475569', width: 400, padding: 20 }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>新建摆位协议</div>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="协议名称 *" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="描述" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <select value={newModality} onChange={e => setNewModality(e.target.value)} style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: 13 }}>
                    <option value="">设备类型</option>
                    {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={newBodyPart} onChange={e => setNewBodyPart(e.target.value)} style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: 13 }}>
                    <option value="">检查部位</option>
                    {BODY_PARTS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowCreate(false)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #475569', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>取消</button>
                  <button onClick={handleCreate} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>创建</button>
                </div>
              </div>
            </div>
          )}

          {/* 模板库模态框 */}
          {showTemplates && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#1e293b', borderRadius: 12, border: '1px solid #475569', width: 500, maxHeight: '70vh', padding: 20, overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>协议模板库</div>
                  <button onClick={() => setShowTemplates(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {PROTOCOL_TEMPLATES.map(tpl => (
                    <div key={tpl.id} style={{ padding: 12, background: '#0f172a', borderRadius: 8, border: '1px solid #334155' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Star size={12} color="#f59e0b" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{tpl.name}</span>
                        {tpl.modality && <span style={{ padding: '1px 6px', background: '#334155', borderRadius: 4, fontSize: 10, color: '#60a5fa' }}>{tpl.modality}</span>}
                        {tpl.bodyPart && <span style={{ padding: '1px 6px', background: '#334155', borderRadius: 4, fontSize: 10, color: '#94a3b8' }}>{tpl.bodyPart}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{tpl.description}</div>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                        {tpl.views.map(v => (
                          <span key={v.id} style={{ padding: '2px 6px', background: '#1e3a5f', borderRadius: 4, fontSize: 11, color: '#60a5fa' }}>
                            {v.layout} {v.initialWw ? `WW=${v.initialWw}` : ''}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => { addProtocol({ ...tpl, id: `tpl-${Date.now()}`, builtin: false }); setShowTemplates(false) }}
                        style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid #3b82f6', background: 'transparent', color: '#60a5fa', fontSize: 12, cursor: 'pointer' }}
                      >
                        使用此模板
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 导入模态框 */}
          {showImport && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: '#1e293b', borderRadius: 12, border: '1px solid #475569', width: 500, padding: 20 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>导入协议</div>
                  <button onClick={() => setShowImport(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
                </div>
                <textarea
                  value={importJson}
                  onChange={e => setImportJson(e.target.value)}
                  placeholder='粘贴 JSON 格式协议数据...'
                  style={{ width: '100%', height: 200, padding: 12, borderRadius: 6, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button onClick={() => setShowImport(false)} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #475569', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>取消</button>
                  <button onClick={handleImport} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>导入</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function HangingProtocolManager(props: HangingProtocolManagerProps) {
  return (
    <HangingProtocolProvider>
      <HangingProtocolManagerInner {...props} />
    </HangingProtocolProvider>
  )
}

export default HangingProtocolManager
