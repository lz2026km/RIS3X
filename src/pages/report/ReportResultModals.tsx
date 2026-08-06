
import { X, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { PRIMARY, GRAY, DANGER, SUCCESS, WHITE, BG } from './reportUtils'

export interface ReviewResultModalProps {
  show: boolean
  reportId: string
  result: string
  suggestion: string
  onClose: () => void
}

export function ReviewResultModal({ show, reportId, result, suggestion, onClose }: ReviewResultModalProps) {
  if (!show) return null
  const isApproved = result === '已审核'
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}>
      <div style={{ background: WHITE, borderRadius: 16, padding: 28, width: 420, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: PRIMARY }}>审核结果</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color={GRAY} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <CheckCircle size={32} color={isApproved ? SUCCESS : DANGER} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: isApproved ? SUCCESS : DANGER }}>{isApproved ? '审核通过' : '已退回'}</div>
            <div style={{ fontSize: 12, color: GRAY }}>报告ID: {reportId}</div>
          </div>
        </div>
        <div style={{ background: BG, borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: GRAY, marginBottom: 4 }}>审核意见</div>
          <div style={{ fontSize: 13, color: '#334155' }}>{suggestion}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 24px', background: PRIMARY, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>关闭</button>
        </div>
      </div>
    </div>
  )
}

export interface BatchResultModalProps {
  show: boolean
  title: string
  message: string
  type: 'success' | 'error'
  onClose: () => void
}

export function BatchResultModal({ show, title, message, type, onClose }: BatchResultModalProps) {
  if (!show) return null
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}>
      <div style={{ background: WHITE, borderRadius: 16, padding: 28, width: 400, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: PRIMARY }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color={GRAY} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {type === 'success' ? <CheckCircle size={32} color={SUCCESS} /> : <AlertTriangle size={32} color={DANGER} />}
          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{message}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 24px', background: PRIMARY, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>关闭</button>
        </div>
      </div>
    </div>
  )
}

export interface PrintModalProps {
  show: boolean
  title: string
  message: string
  onClose: () => void
  onPrint: () => void
}

export function PrintModal({ show, title, message, onClose, onPrint }: PrintModalProps) {
  if (!show) return null
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}>
      <div style={{ background: WHITE, borderRadius: 16, padding: 28, width: 400, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: PRIMARY }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color={GRAY} /></button>
        </div>
        <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5, marginBottom: 16 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', border: '1px solid #e2e8f0', background: WHITE, color: GRAY, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>取消</button>
          <button onClick={onPrint} style={{ padding: '8px 20px', background: PRIMARY, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>打印</button>
        </div>
      </div>
    </div>
  )
}

export interface BulkActionModalProps {
  show: boolean
  action: string
  count: number
  loading: boolean
  onClose: () => void
  onConfirm: () => void
}

export function BulkActionModal({ show, action, count, loading, onClose, onConfirm }: BulkActionModalProps) {
  if (!show) return null
  const isDelete = action === 'delete'
  const isPublish = action === 'publish'
  const isReview = action === 'review'
  const isSign = action === 'sign'
  const TITLE = isDelete ? '批量删除' : isPublish ? '批量发布' : isReview ? '批量审核' : isSign ? '批量签署' : '批量操作'
  const VERB = isDelete ? '删除' : isPublish ? '发布' : isReview ? '审核' : isSign ? '签署' : '执行'
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}>
      <div style={{ background: WHITE, borderRadius: 16, padding: 28, width: 440, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {isDelete ? <AlertTriangle size={28} color={DANGER} /> : <CheckCircle size={28} color={SUCCESS} />}
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: isDelete ? DANGER : PRIMARY }}>
              {TITLE}
            </h2>
            <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>
              {VERB} {count} 份报告
            </div>
          </div>
        </div>
        {isDelete && (
          <div style={{ background: '#fff5f5', borderRadius: 8, padding: '12px 16px', marginBottom: 16, border: '1px solid #fed7d7' }}>
            <div style={{ fontSize: 12, color: DANGER, fontWeight: 600, marginBottom: 4 }}>⚠ 危险操作</div>
            <div style={{ fontSize: 12, color: '#7f1d1d' }}>此操作不可撤销。已发布的报告将无法恢复。</div>
          </div>
        )}
        {isPublish && (
          <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '12px 16px', marginBottom: 16, border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: 12, color: SUCCESS, fontWeight: 600, marginBottom: 4 }}>确认发布</div>
            <div style={{ fontSize: 12, color: '#14532d' }}>将选中报告中状态为"已审核"的报告发布为正式报告。</div>
          </div>
        )}
        {isReview && (
          <div style={{ background: '#eff6ff', borderRadius: 8, padding: '12px 16px', marginBottom: 16, border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600, marginBottom: 4 }}>确认审核</div>
            <div style={{ fontSize: 12, color: '#1e3a8a' }}>将选中报告中状态为"待审核"的报告逐条提交初审,审核通过后进入签发环节。</div>
          </div>
        )}
        {isSign && (
          <div style={{ background: '#f5f3ff', borderRadius: 8, padding: '12px 16px', marginBottom: 16, border: '1px solid #ddd6fe' }}>
            <div style={{ fontSize: 12, color: '#6d28d9', fontWeight: 600, marginBottom: 4 }}>确认签署</div>
            <div style={{ fontSize: 12, color: '#4c1d95' }}>将选中报告中状态为"已审核"的报告批量电子签署(→ 已签发)。</div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', border: '1px solid #e2e8f0', background: WHITE, color: GRAY, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>取消</button>
          <button onClick={onConfirm} disabled={loading}
            style={{ padding: '8px 20px', border: 'none', background: isDelete ? DANGER : SUCCESS, color: WHITE, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, opacity: loading ? 0.6 : 1 }}>
            {loading ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> 处理中...</> : <>确认{VERB}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
