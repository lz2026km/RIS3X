/**
 * [G005 v3.0.6.11-85 Wave 4B (G-12)] AI 检出叠加层
 * 在阅片视口上渲染 AI 检出标记 (box 占位框/标注点):
 *   - 标记: 按百分比坐标定位, 边框颜色随置信度 (红/橙/绿)
 *   - 点击标记 → Popover: 病灶类型 / 置信度 / 风险 / 建议
 *   - 底部摘要栏: 检出总数 + AI 建议
 */
import { useMemo } from 'react'
import { Brain, FileText, X } from 'lucide-react'
import type { AiFinding } from '../../pages/dicom/aiFindings'
import { t } from '../../i18n/appI18n'

const COLOR_BY_CONFIDENCE = (c: number): string => (c >= 0.7 ? '#ef4444' : c >= 0.4 ? '#f59e0b' : '#22c55e')

export interface AiFindingsOverlayProps {
  findings: AiFinding[]
  loading?: boolean
  selected: AiFinding | null
  onSelect: (f: AiFinding | null) => void
  // [G005 v3.0.6.11-100 Wave 6A (D-1)] AI 标注一键插入报告: 每条检出 + 全部检出 → 报告书写页
  onInsertReport?: (f: AiFinding) => void
  onInsertAllReport?: () => void
}

function confidenceLabel(f: AiFinding): string {
  return `${Math.round(f.confidence * 100)}%`
}

function AiMarkerPopover({ finding, onClose, onInsertReport }: { finding: AiFinding; onClose: () => void; onInsertReport?: (f: AiFinding) => void }) {
  return (
    <div
      data-testid="ai-marker-popover"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        minWidth: 280,
        maxWidth: 340,
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: 10,
        padding: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
        zIndex: 40,
        fontSize: 12,
        color: '#e2e8f0',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: '#60a5fa', fontSize: 13 }}>{finding.label}</span>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            background: COLOR_BY_CONFIDENCE(finding.confidence),
            whiteSpace: 'nowrap',
          }}
        >
          {confidenceLabel(finding)}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div><span style={{ color: '#94a3b8' }}>{t('w9d.aiOverlay.model')} </span>{finding.modelLabel}{finding.demo && <span style={{ color: '#fbbf24', marginLeft: 6 }}>{t('w9d.aiOverlay.demoData')}</span>}</div>
        <div><span style={{ color: '#94a3b8' }}>{t('w9d.aiOverlay.lesionType')} </span>{finding.label}</div>
        <div><span style={{ color: '#94a3b8' }}>{t('w9d.aiOverlay.risk')} </span><span style={{ color: COLOR_BY_CONFIDENCE(finding.confidence), fontWeight: 700 }}>{finding.risk}</span></div>
        {finding.detail && <div style={{ lineHeight: 1.6 }}><span style={{ color: '#94a3b8' }}>{t('w9d.aiOverlay.detail')} </span>{finding.detail}</div>}
        {finding.sliceLocation != null && (
          <div><span style={{ color: '#94a3b8' }}>{t('w9d.aiOverlay.slice')} </span>{finding.sliceLocation}</div>
        )}
      </div>
      {finding.suggestion && (
        <div style={{ borderTop: '1px solid #334155', marginTop: 8, paddingTop: 8, color: '#cbd5e1', lineHeight: 1.6 }}>
          <span style={{ color: '#4ade80', fontWeight: 700 }}>{t('w9d.aiOverlay.suggestion')} </span>{finding.suggestion}
        </div>
      )}
      {/* [G005 v3.0.6.11-100 Wave 6A (D-1)] 检出 → 一键插入报告 */}
      {onInsertReport && (
        <div style={{ borderTop: '1px solid #334155', marginTop: 10, paddingTop: 10 }}>
          <button
            data-testid={`ai-insert-report-${finding.id}`}
            onClick={(e) => { e.stopPropagation(); onInsertReport(finding) }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '7px 0',
              borderRadius: 6,
              border: 'none',
              background: '#1d4ed8',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <FileText size={12} /> {t('w9d.aiOverlay.insertReport')}
          </button>
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          border: 'none',
          background: 'transparent',
          color: '#64748b',
          cursor: 'pointer',
          padding: 2,
          display: 'flex',
          borderRadius: 4,
        }}
        aria-label={t('w9d.aiOverlay.close')}
      >
        <X size={12} />
      </button>
    </div>
  )
}

export function AiFindingsOverlay({ findings, loading = false, selected, onSelect, onInsertReport, onInsertAllReport }: AiFindingsOverlayProps) {
  const summary = useMemo(() => {
    if (findings.length === 0) return null
    const models = Array.from(new Set(findings.map((f) => f.modelLabel)))
    const suggestion = findings.find((f) => f.suggestion)?.suggestion ?? ''
    return { models, suggestion }
  }, [findings])

  if (findings.length === 0 && !loading) return null

  return (
    <div data-testid="ai-findings-overlay" style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none' }}>
      {selected && (
        <div
          data-testid="ai-overlay-backdrop"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
          onClick={() => onSelect(null)}
        />
      )}
      {findings.map((f) => {
        const active = selected?.id === f.id
        const color = COLOR_BY_CONFIDENCE(f.confidence)
        const flipUp = (f.box?.y ?? 0) > 55
        return (
          <div
            key={f.id}
            data-testid={`ai-marker-${f.id}`}
            role="button"
            tabIndex={0}
            aria-label={t('w9d.aiOverlay.findingAria', { label: f.label })}
            onClick={(e) => { e.stopPropagation(); onSelect(active ? null : f) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelect(active ? null : f) } }}
            style={{
              position: 'absolute',
              left: `${f.box?.x ?? 10}%`,
              top: `${f.box?.y ?? 10}%`,
              width: `${f.box?.width ?? 12}%`,
              height: `${f.box?.height ?? 8}%`,
              minWidth: 14,
              minHeight: 14,
              border: `2px solid ${color}`,
              background: `${color}26`,
              borderRadius: 4,
              boxSizing: 'border-box',
              pointerEvents: 'auto',
              cursor: 'pointer',
              boxShadow: active ? `0 0 0 2px rgba(255,255,255,0.6)` : 'none',
            }}
          >
            {!active && (
              <span
                style={{
                  position: 'absolute',
                  top: -16,
                  left: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  color,
                  background: 'rgba(0,0,0,0.8)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                  lineHeight: '14px',
                }}
              >
                {f.label}
              </span>
            )}
            {active && (
              <div style={{ position: 'absolute', left: 0, ...(flipUp ? { bottom: '100%', top: 'auto' } : { top: '100%', bottom: 'auto' }) }}>
                <AiMarkerPopover finding={f} onClose={() => onSelect(null)} onInsertReport={onInsertReport} />
              </div>
            )}
          </div>
        )
      })}

      {summary && (
        <div
          data-testid="ai-overlay-summary"
          style={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            maxWidth: '55%',
            background: 'rgba(15,23,42,0.94)',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            color: '#e2e8f0',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#60a5fa' }}>
            <Brain size={13} color="#60a5fa" />
            {t('w9d.aiOverlay.summaryTitle', { count: findings.length })}
            {loading && <span style={{ color: '#94a3b8', fontWeight: 400 }}>{t('w9d.viewerPro.loading')}</span>}
          </div>
          <div style={{ marginTop: 4, color: '#94a3b8' }}>{t('w9d.aiOverlay.model')} {summary.models.join(' / ')}</div>
          {summary.suggestion && (
            <div style={{ marginTop: 4, color: '#cbd5e1', lineHeight: 1.6 }}>
              <span style={{ color: '#4ade80', fontWeight: 700 }}>{t('w9d.aiOverlay.suggestion')} </span>{summary.suggestion}
            </div>
          )}
          {/* [G005 v3.0.6.11-100 Wave 6A (D-1)] 全部检出 → 一键插入报告 */}
          {onInsertAllReport && findings.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <button
                data-testid="ai-insert-report-all"
                onClick={(e) => { e.stopPropagation(); onInsertAllReport() }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#1d4ed8',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <FileText size={11} /> {t('w9d.aiOverlay.insertAllReport', { count: findings.length })}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AiFindingsOverlay
