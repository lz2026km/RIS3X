import _React, { useState, useCallback } from 'react'
import { Settings, Star, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import {
  HangingProtocolProvider,
  HangingProtocolSwitcher,
  useHangingProtocol,
  type HangingProtocol,
} from '../v3/dicom/HangingProtocol'



interface HangingProtocolPanelProps {
  onApply?: (protocol: HangingProtocol) => void
  modality?: string
  bodyPart?: string
}

function HangingProtocolPanelInner({ onApply, modality, bodyPart }: HangingProtocolPanelProps) {
  const { protocols, active, applyProtocol, suggestProtocol, addProtocol, removeProtocol } = useHangingProtocol()
  const [expanded, setExpanded] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newModality, setNewModality] = useState('')

  const suggested = suggestProtocol(modality, bodyPart)

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
    setShowCreate(false)
  }, [newName, newDesc, newModality, addProtocol])

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
        <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', flex: 1 }}>摆位协议</span>
        {active && (
          <span style={{
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 4,
            background: '#334155',
            color: '#60a5fa',
          }}>
            {active.name}
          </span>
        )}
        {suggested && suggested.id !== active?.id && (
          <span style={{
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
            background: '#1e40af',
            color: '#4ade80',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}>
            <Star size={10} />
            推荐
          </span>
        )}
        {expanded ? <ChevronUp size={12} color="#94a3b8" /> : <ChevronDown size={12} color="#94a3b8" />}
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #334155', padding: '8px 0' }}>
          <div style={{ padding: '0 12px 8px' }}>
            <HangingProtocolSwitcher
              onApply={(p) => onApply?.(p)}
              showManager={false}
            />
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

          <div style={{ padding: '0 8px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', padding: '4px 4px', textTransform: 'uppercase' }}>
              全部协议 ({protocols.length})
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {protocols.map(p => (
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
                    background: active?.id === p.id ? '#1e40af' : 'transparent',
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
                    </div>
                  </div>
                  {active?.id === p.id && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '8px 12px', borderTop: '1px solid #334155' }}>
            {showCreate ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="协议名称"
                  style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: 12, outline: 'none' }}
                />
                <input
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="描述 (可选)"
                  style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: 12, outline: 'none' }}
                />
                <input
                  value={newModality}
                  onChange={e => setNewModality(e.target.value)}
                  placeholder="设备类型 (CT/MR/DR)"
                  style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: 12, outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={handleCreate}
                    style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    创建
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #475569', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px dashed #475569',
                  background: 'transparent',
                  color: '#94a3b8',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Plus size={12} />
                新建协议
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function HangingProtocolPanel(props: HangingProtocolPanelProps) {
  return (
    <HangingProtocolProvider>
      <HangingProtocolPanelInner {...props} />
    </HangingProtocolProvider>
  )
}

export default HangingProtocolPanel
