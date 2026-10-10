// [W2-3] G005 危急值报告一键转入 Modal
// 从报告列表将检查标记为危急值: examId + severity + description → criticalApi.create
import { useState } from 'react'
import { X, Zap } from 'lucide-react'
import type { RadiologyReport } from '../../types'

export interface ReportCriticalModalProps {
  report: RadiologyReport | null
  submitting: boolean
  onClose: () => void
  onSubmit: (severity: string, description: string, method: string) => void
}

const SEVERITY_OPTIONS = [
  { value: 'CRITICAL', label: '危急 (CRITICAL)', color: 'var(--color-error)', bg: 'var(--color-error-bg)' },
  { value: 'HIGH', label: '高 (HIGH)', color: '#ea580c', bg: 'rgba(234,88,12,0.12)' },
  { value: 'MEDIUM', label: '中 (MEDIUM)', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  { value: 'LOW', label: '低 (LOW)', color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
]

const METHOD_OPTIONS = [
  { value: 'PHONE', label: '电话' },
  { value: 'SMS', label: '短信' },
  { value: 'SYSTEM', label: '站内' },
  { value: 'EMAIL', label: '邮件' },
]

export default function ReportCriticalModal({ report, submitting, onClose, onSubmit }: ReportCriticalModalProps) {
  const [severity, setSeverity] = useState('CRITICAL')
  const [method, setMethod] = useState('PHONE')
  const [description, setDescription] = useState('')

  if (!report) return null
  const selected = SEVERITY_OPTIONS.find(s => s.value === severity)

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 540, boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-error-600)', borderRadius: '14px 14px 0 0' }}>
          <Zap size={18} style={{ color: '#fff' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>危急值一键转入</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>
              {report.reportId} · {report.patientName} · {report.examItemName}
            </div>
          </div>
          <button onClick={onClose} style={{ padding: 4, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#fff', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>危急等级</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SEVERITY_OPTIONS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setSeverity(s.value)}
                  style={{
                    padding: '8px 14px', borderRadius: 8, border: `2px solid ${severity === s.value ? s.color : 'var(--border-color)'}`,
                    background: severity === s.value ? s.bg : 'var(--bg-card)',
                    color: s.color, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>通知方式</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {METHOD_OPTIONS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  style={{
                    padding: '6px 12px', borderRadius: 6, border: `1px solid ${method === m.value ? 'var(--color-error-600)' : 'var(--border-color)'}`,
                    background: method === m.value ? 'var(--color-error-bg)' : 'var(--bg-card)',
                    color: method === m.value ? 'var(--color-error-600)' : '#64748b', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>危急值描述</div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder={`例如: ${report.diagnosis || report.examFindings || '检查所见提示危急结果'}（自动带入诊断意见）`}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12, resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          {description && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-error)' }}>
              转入后将以 <strong>{selected?.label}</strong> 等级发起 {METHOD_OPTIONS.find(m => m.value === method)?.label} 通知, 并进入危急值闭环流程。
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: '#64748b', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>取消</button>
          <button
            onClick={() => onSubmit(severity, description.trim() || (report.diagnosis || report.examFindings || '危急值报告'), method)}
            disabled={submitting}
            style={{
              padding: '8px 24px', border: 'none', background: submitting ? '#f87171' : 'var(--color-error-600)',
              color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: submitting ? 0.7 : 1,
            }}
          >
            <Zap size={14} /> {submitting ? '转入中...' : '确认转入危急值'}
          </button>
        </div>
      </div>
    </div>
  )
}
