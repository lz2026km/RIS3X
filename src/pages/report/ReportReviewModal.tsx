import { useState } from 'react'
import { X, ShieldCheck, AlertTriangle, FileText, User, Stethoscope } from 'lucide-react'
import type { RadiologyReport } from '../../types'
import { StatusBadge } from '../../components/report'
import { PRIMARY, GRAY, DANGER, SUCCESS, WHITE } from './reportUtils'

export interface ReportReviewModalProps {
  report: RadiologyReport
  onClose: () => void
  onSubmit: (reportId: string, result: 'approved' | 'rejected', suggestion: string, password: string) => void
}

export default function ReportReviewModal({ report, onClose, onSubmit }: ReportReviewModalProps) {
  const [result, setResult] = useState<'approved' | 'rejected'>('approved')
  const [suggestion, setSuggestion] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    await onSubmit(report.id, result, suggestion, password)
    setSubmitting(false)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 520,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#6d28d9', borderRadius: '12px 12px 0 0',
        }}>
          <ShieldCheck size={18} style={{ color: WHITE }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: WHITE, flex: 1 }}>报告审核</span>
          <button onClick={onClose} style={{ padding: 4, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, cursor: 'pointer', color: WHITE, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '12px 20px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={12} style={{ color: GRAY }} />
            <span style={{ fontSize: 12, color: GRAY }}>报告: <strong style={{ color: PRIMARY }}>{report.reportId}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={12} style={{ color: GRAY }} />
            <span style={{ fontSize: 12, color: GRAY }}>患者: <strong style={{ color: PRIMARY }}>{report.patientName}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Stethoscope size={12} style={{ color: GRAY }} />
            <span style={{ fontSize: 12, color: GRAY }}>检查: {report.examItemName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusBadge status={report.status} size="sm" />
          </div>
        </div>

        <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>审核结果</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setResult('approved')} style={{
                flex: 1, padding: '10px 16px', borderRadius: 8, border: '2px solid',
                borderColor: result === 'approved' ? SUCCESS : 'var(--border-color)',
                background: result === 'approved' ? 'var(--color-success-bg)' : 'var(--bg-card)',
                color: result === 'approved' ? SUCCESS : GRAY,
                fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <ShieldCheck size={16} /> 审核通过
              </button>
              <button onClick={() => setResult('rejected')} style={{
                flex: 1, padding: '10px 16px', borderRadius: 8, border: '2px solid',
                borderColor: result === 'rejected' ? DANGER : 'var(--border-color)',
                background: result === 'rejected' ? 'var(--color-error-bg)' : 'var(--bg-card)',
                color: result === 'rejected' ? DANGER : GRAY,
                fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <AlertTriangle size={16} /> 退回修改
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>审核意见</div>
            <textarea value={suggestion} onChange={e => setSuggestion(e.target.value)}
              placeholder={result === 'approved' ? '同意发布，报告书写规范。' : '请修改诊断意见中的描述...'}
              rows={3} style={{
                width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 6,
                fontSize: 12, resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
              }} />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>电子签名密码</div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="请输入审核签名密码..."
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>取消</button>
          <button onClick={handleSubmit} disabled={submitting || !password}
            style={{
              padding: '8px 24px', borderRadius: 8, border: 'none',
              background: result === 'approved' ? SUCCESS : DANGER,
              color: WHITE, fontSize: 12, fontWeight: 700, cursor: submitting || !password ? 'not-allowed' : 'pointer',
              opacity: submitting || !password ? 0.6 : 1,
            }}>
            {submitting ? '提交中...' : result === 'approved' ? '确认审核通过' : '确认退回'}
          </button>
        </div>
      </div>
    </div>
  )
}
