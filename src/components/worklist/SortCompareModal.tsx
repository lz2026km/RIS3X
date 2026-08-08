import { X, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import type { RadiologyExam } from '../../types'


interface SortCompareItem {
  exam: RadiologyExam
  beforeRank: number
  afterRank: number
  score?: number
  reasons?: string[]
}

interface SortCompareModalProps {
  items: SortCompareItem[]
  onClose: () => void
}

export function SortCompareModal({ items, onClose }: SortCompareModalProps) {
  const changed = items.filter(i => i.beforeRank !== i.afterRank)
  const improved = changed.filter(i => i.afterRank < i.beforeRank)
  const declined = changed.filter(i => i.afterRank > i.beforeRank)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="排序前后对比"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      onClick={onClose}
    >
      <div style={{
        background: '#fff', borderRadius: 12, padding: 24, width: 640, maxHeight: '80vh', overflow: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e40af' }}>排序前后对比</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{improved.length}</div>
            <div style={{ fontSize: 12, color: '#15803d' }}>优先级提升</div>
          </div>
          <div style={{ flex: 1, padding: 12, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{declined.length}</div>
            <div style={{ fontSize: 12, color: '#991b1b' }}>优先级下降</div>
          </div>
          <div style={{ flex: 1, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#64748b' }}>{items.length - changed.length}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>排序不变</div>
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>排序变化详情</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.slice(0, 30).map((item) => {
            const diff = item.beforeRank - item.afterRank
            const isImproved = diff > 0
            const isDeclined = diff < 0
            return (
              <div key={item.exam.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', borderRadius: 6,
                background: isImproved ? '#f0fdf4' : isDeclined ? '#fef2f2' : '#f8fafc',
                fontSize: 12,
              }}>
                <div style={{ minWidth: 40, textAlign: 'center', color: '#94a3b8' }}>
                  #{item.beforeRank}
                </div>
                <div style={{ color: isImproved ? '#16a34a' : isDeclined ? '#dc2626' : '#94a3b8', display: 'flex' }}>
                  {isImproved ? <ArrowUp size={14} /> : isDeclined ? <ArrowDown size={14} /> : <Minus size={14} />}
                </div>
                <div style={{ minWidth: 40, textAlign: 'center', fontWeight: 700, color: '#1e40af' }}>
                  #{item.afterRank}
                </div>
                <div style={{ flex: 1, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.exam.patientName} - {item.exam.examItemName}
                </div>
                {item.score !== undefined && (
                  <span style={{
                    fontWeight: 700, fontSize: 11,
                    color: item.score >= 70 ? '#dc2626' : item.score >= 45 ? '#d97706' : '#059669',
                  }}>
                    {item.score}分
                  </span>
                )}
              </div>
            )
          })}
          {items.length > 30 && (
            <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', padding: 8 }}>
              ... 仅显示前30项, 共 {items.length} 项
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
