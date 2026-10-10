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
        background: 'var(--bg-card)', borderRadius: 12, padding: 'var(--space-6, 24px)', width: 640, maxHeight: '80vh', overflow: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4, 16px)' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)' }}>排序前后对比</h3>
          <button aria-label="关闭" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-4, 16px)' }}>
          <div style={{ flex: 1, padding: 'var(--space-3, 12px)', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-success-600)' }}>{improved.length}</div>
            <div style={{ fontSize: 12, color: '#15803d' }}>优先级提升</div>
          </div>
          <div style={{ flex: 1, padding: 'var(--space-3, 12px)', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-error-600)' }}>{declined.length}</div>
            <div style={{ fontSize: 12, color: '#991b1b' }}>优先级下降</div>
          </div>
          <div style={{ flex: 1, padding: 'var(--space-3, 12px)', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#64748b' }}>{items.length - changed.length}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>排序不变</div>
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 'var(--space-2, 8px)' }}>排序变化详情</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)' }}>
          {items.slice(0, 30).map((item) => {
            const diff = item.beforeRank - item.afterRank
            const isImproved = diff > 0
            const isDeclined = diff < 0
            return (
              <div key={item.exam.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)',
                padding: '6px 8px', borderRadius: 6,
                background: isImproved ? '#f0fdf4' : isDeclined ? '#fef2f2' : '#f8fafc',
                fontSize: 12,
              }}>
                <div style={{ minWidth: 40, textAlign: 'center', color: '#94a3b8' }}>
                  #{item.beforeRank}
                </div>
                <div style={{ color: isImproved ? 'var(--color-success-600)' : isDeclined ? 'var(--color-error-600)' : '#94a3b8', display: 'flex' }}>
                  {isImproved ? <ArrowUp size={14} /> : isDeclined ? <ArrowDown size={14} /> : <Minus size={14} />}
                </div>
                <div style={{ minWidth: 40, textAlign: 'center', fontWeight: 700, color: 'var(--color-primary-800)' }}>
                  #{item.afterRank}
                </div>
                <div style={{ flex: 1, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.exam.patientName} - {item.exam.examItemName}
                </div>
                {item.score !== undefined && (
                  <span style={{
                    fontWeight: 700, fontSize: 11,
                    color: item.score >= 70 ? 'var(--color-error-600)' : item.score >= 45 ? 'var(--color-warning-600)' : '#059669',
                  }}>
                    {item.score}分
                  </span>
                )}
              </div>
            )
          })}
          {items.length > 30 && (
            <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', padding: 'var(--space-2, 8px)' }}>
              ... 仅显示前30项, 共 {items.length} 项
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
