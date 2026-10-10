// [W2-3] G005 报告多版本并排对比 Modal
// 左右分栏显示 当前版本 vs 上一版本, 合并视图基于 computeDiff (reportDiffEngine) 高亮差异
import { useMemo } from 'react'
import { X, GitCompare, ArrowLeftRight, Loader2 } from 'lucide-react'
import type { RadiologyReport } from '../../types'
import { computeDiff } from '../../services/reportDiffEngine'

export interface ReportDiffData {
  oldVersion?: Record<string, unknown>
  newVersion?: Record<string, unknown>
  changes?: Array<{ field?: string; type?: string; oldValue?: string; newValue?: string }>
  // [G005 W8-Report] 后端内容版本快照 diff 的真实字段级差异
  source?: string
  changedFields?: string[]
  fields?: Array<{ field: string; label: string; before: string; after: string; changed: boolean }>
}

export interface ReportDiffModalProps {
  report: RadiologyReport | null
  data: ReportDiffData | null
  loading: boolean
  onClose: () => void
}

const FIELD_LABEL: Record<string, string> = {
  findings: '检查所见',
  examFindings: '检查所见',
  impression: '诊断意见',
  diagnosis: '诊断意见',
  recommendations: '建议',
  criticalFindingDetails: '危急值',
}

const FIELD_KEYS = ['findings', 'examFindings', 'impression', 'diagnosis', 'recommendations', 'criticalFindingDetails']

function pickText(v: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!v) return out
  for (const k of FIELD_KEYS) {
    const val = v[k]
    if (typeof val === 'string' && val) out[k] = val
  }
  return out
}

function DiffText({ before, after }: { before: string; after: string }) {
  const chunks = useMemo(() => computeDiff(before, after), [before, after])
  if (before === after) {
    return <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{before || <em style={{ color: '#94a3b8' }}>（无变更内容）</em>}</span>
  }
  return (
    <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
      {chunks.map((c, i) => (
        <span
          key={i}
          style={{
            background: c.type === 'removed' ? 'var(--color-error-bg)' : c.type === 'added' ? 'var(--color-success-bg)' : 'transparent',
            color: c.type === 'removed' ? 'var(--color-error)' : c.type === 'added' ? 'var(--color-success)' : 'var(--text-primary)',
            textDecoration: c.type === 'removed' ? 'line-through' : 'none',
            padding: '0 2px',
            borderRadius: 2,
          }}
        >
          {c.text}
        </span>
      ))}
    </span>
  )
}

export default function ReportDiffModal({ report, data, loading, onClose }: ReportDiffModalProps) {
  const merged = useMemo(() => {
    if (!report || !data) return null
    // [G005 W8-Report] 优先使用内容版本快照的真实字段差异 (含 label)
    if (data.fields && data.fields.length > 0) {
      return data.fields
        .filter(f => f.changed || f.after)
        .map(f => ({ field: f.field, label: f.label || FIELD_LABEL[f.field] || f.field, before: f.before, after: f.after }))
    }
    const oldV = pickText(data.oldVersion)
    const newV = pickText(data.newVersion)
    const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]))
    return keys
      .map(k => ({
        field: k,
        label: FIELD_LABEL[k] ?? k,
        before: oldV[k] ?? '',
        after: newV[k] ?? '',
      }))
      .filter(f => f.before !== f.after || f.after)
  }, [report, data])

  if (!report) return null

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 1080,
          maxHeight: '92vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <GitCompare size={18} color="#f59e0b" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>多版本并排对比</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
              {report.reportId} · {report.patientName} · 当前版本 vs 上一版本
            </div>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', color: '#64748b', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#64748b', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Loader2 size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> 正在加载版本历史...
            </div>
          ) : !data ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>暂无可用版本历史</div>
          ) : (
            <>
              {/* 左右分栏 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid #fed7aa', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9a3412', marginBottom: 8 }}>上一版本</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8, maxHeight: 260, overflowY: 'auto' }}>
                    {Object.keys(pickText(data.oldVersion)).length === 0
                      ? <em style={{ color: '#94a3b8' }}>（空）</em>
                      : Object.entries(pickText(data.oldVersion)).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 600 }}>{FIELD_LABEL[k] ?? k}</div>
                          <div>{v}</div>
                        </div>
                      ))}
                  </div>
                </div>
                <div style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-success)', marginBottom: 8 }}>当前版本</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.8, maxHeight: 260, overflowY: 'auto' }}>
                    {Object.keys(pickText(data.newVersion)).length === 0
                      ? <em style={{ color: '#94a3b8' }}>（空）</em>
                      : Object.entries(pickText(data.newVersion)).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 600 }}>{FIELD_LABEL[k] ?? k}</div>
                          <div>{v}</div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* 差异高亮 (computeDiff) */}
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeftRight size={13} /> 字段级差异高亮（红=删除 绿=新增）
              </div>
              {merged && merged.length > 0 ? (
                merged.map(f => (
                  <div key={f.field} style={{ marginBottom: 12, padding: 12, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6, padding: '2px 8px', background: 'var(--color-info-bg)', borderRadius: 4, display: 'inline-block' }}>
                      {f.label}
                    </div>
                    <div style={{ fontSize: 12 }}>
                      <DiffText before={f.before} after={f.after} />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: 16, textAlign: 'center', background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', borderRadius: 8, color: 'var(--color-success)', fontSize: 12 }}>
                  两个版本内容一致,无差异
                </div>
              )}

              {data.changes && data.changes.length > 0 && (
                <div style={{ marginTop: 12, padding: 10, background: 'var(--color-warning-bg)', borderRadius: 8, border: '1px solid var(--color-warning-border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-warning)', marginBottom: 6 }}>后端变更记录（{data.changes.length} 项）</div>
                  {data.changes.map((c, i) => (
                    <div key={i} style={{ fontSize: 12, marginBottom: 6, padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 4 }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-warning)' }}>{FIELD_LABEL[c.field ?? ''] ?? c.field ?? '字段'}</span>
                      <span style={{ margin: '0 6px', padding: '1px 5px', borderRadius: 3, background: c.type === 'modified' ? 'var(--color-warning-bg)' : c.type === 'added' ? 'var(--color-success-bg)' : 'var(--color-error-bg)', color: 'var(--color-warning)' }}>
                        {c.type === 'modified' ? '修改' : c.type === 'added' ? '新增' : c.type === 'deleted' ? '删除' : c.type}
                      </span>
                      <span style={{ color: '#64748b' }}>
                        {c.oldValue ? `旧: ${c.oldValue}` : ''}
                        {c.oldValue && c.newValue ? ' → ' : ''}
                        {c.newValue ? `新: ${c.newValue}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 24px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: '#64748b', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>关闭</button>
        </div>
      </div>
    </div>
  )
}
