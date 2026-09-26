import { useCallback } from 'react'
import type { Annotation, AnnotationType } from './DicomViewerTypes'
import { useFocusTrap } from '../../a11y/SkipLink'
import { useEscape } from '../../hooks/useEscape'
import { t } from '../../i18n/appI18n'

interface Props {
  annotations: Annotation[]
  showAnnotationsOverlay: boolean
  selectedAnnotationId: string | null
  setSelectedAnnotationId: (id: string | null) => void
  toggleAnnotationVisibility: (id: string) => void
  toggleAnnotationLock: (id: string) => void
  deleteAnnotation: (id: string) => void
  activeAnnotationType: AnnotationType
  activeAnnotationColor: string
  activeAnnotationFontSize: number
  setActiveAnnotationType: (t: AnnotationType) => void
  setActiveAnnotationColor: (c: string) => void
  setActiveAnnotationFontSize: (s: number) => void
  clearAllAnnotations: () => void
  annotationTypes: { type: AnnotationType; icon: React.ReactNode; label: string }[]
  ANNOTATION_COLORS: string[]
  ANNOTATION_COLOR_NAMES: Record<string, string>
  showAnnotationPanel: boolean
  setShowAnnotationPanel: (v: boolean) => void
}

export default function AnnotationOverlay(props: Props) {
  const {
    annotations, showAnnotationsOverlay, selectedAnnotationId, setSelectedAnnotationId,
    toggleAnnotationVisibility, toggleAnnotationLock, deleteAnnotation,
    activeAnnotationType, activeAnnotationColor, activeAnnotationFontSize,
    setActiveAnnotationType, setActiveAnnotationColor, setActiveAnnotationFontSize,
    clearAllAnnotations, annotationTypes, ANNOTATION_COLORS, ANNOTATION_COLOR_NAMES,
    showAnnotationPanel, setShowAnnotationPanel
  } = props

  const PRIMARY = '#1e40af'

  const panelRef = useFocusTrap(showAnnotationPanel)
  useEscape(showAnnotationPanel, () => setShowAnnotationPanel(false), { stopPropagation: true })
  const closePanel = useCallback(() => setShowAnnotationPanel(false), [setShowAnnotationPanel])

  return (
    <>
      {showAnnotationsOverlay && annotations.length > 0 && (
        <svg style={{ position: 'absolute' as const, top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' as const }}>
          {annotations.filter(a => a.visible).map(ann => {
            if (ann.type === 'text') {
              return <g key={ann.id}><text x={ann.x} y={ann.y} fill={ann.color} fontSize={ann.fontSize} fontFamily="PingFang SC, Microsoft YaHei, sans-serif" fontWeight="bold">{ann.text}</text></g>
            }
            if (ann.type === 'arrow' && ann.x2 !== undefined && ann.y2 !== undefined) {
              const dx = ann.x2 - ann.x; const dy = ann.y2 - ann.y; const angle = Math.atan2(dy, dx); const headLen = 15; const headAngle = Math.PI / 6
              return (
                <g key={ann.id}>
                  <line x1={ann.x} y1={ann.y} x2={ann.x2 - headLen * Math.cos(angle - headAngle)} y2={ann.y2 - headLen * Math.sin(angle - headAngle)} stroke={ann.color} strokeWidth={2} />
                  <line x1={ann.x2} y1={ann.y2} x2={ann.x2 - headLen * Math.cos(angle + headAngle)} y2={ann.y2 - headLen * Math.sin(angle + headAngle)} stroke={ann.color} strokeWidth={2} />
                  <line x1={ann.x} y1={ann.y} x2={ann.x2} y2={ann.y2} stroke={ann.color} strokeWidth={2} />
                </g>
              )
            }
            if (ann.type === 'rect' && ann.x2 !== undefined && ann.y2 !== undefined) {
              return <g key={ann.id}><rect x={Math.min(ann.x, ann.x2)} y={Math.min(ann.y, ann.y2)} width={Math.abs(ann.x2 - ann.x)} height={Math.abs(ann.y2 - ann.y)} fill="transparent" stroke={ann.color} strokeWidth={2} strokeDasharray="5,3" /></g>
            }
            if (ann.type === 'ellipse' && ann.x2 !== undefined && ann.y2 !== undefined) {
              const cx = (ann.x + ann.x2) / 2; const cy = (ann.y + ann.y2) / 2; const rx = Math.abs(ann.x2 - ann.x) / 2; const ry = Math.abs(ann.y2 - ann.y) / 2
              return <g key={ann.id}><ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="transparent" stroke={ann.color} strokeWidth={2} strokeDasharray="5,3" /></g>
            }
            return null
          })}
        </svg>
      )}

      {showAnnotationPanel && (
        <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('w9d.annotation.panelTitle')} style={{ position: 'absolute' as const, left: 60, top: 200, width: 200, background: 'var(--bg-card)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', zIndex: 100, padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{t('w9d.annotation.panelTitle')}</span>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }} onClick={closePanel} aria-label={t('w9d.annotation.closePanelAria')}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 8 }}>
            {annotationTypes.map(({ type, icon, label }) => (
              <button key={type} style={{ height: 36, borderRadius: 6, border: `1px solid ${activeAnnotationType === type ? PRIMARY : 'var(--border-color)'}`, background: activeAnnotationType === type ? PRIMARY : 'var(--bg-card)', cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 2, padding: 4, color: activeAnnotationType === type ? '#fff' : '#64748b' }} onClick={() => setActiveAnnotationType(type)}>
                {icon}
                <span style={{ fontSize: 8, color: activeAnnotationType === type ? 'rgba(255,255,255,0.8)' : '#64748b' }}>{label}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{t('w9d.annotation.color')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 8 }}>
            {ANNOTATION_COLORS.map(color => (
              <button key={color} style={{ width: 24, height: 24, borderRadius: 4, border: activeAnnotationColor === color ? '2px solid #1e40af' : '2px solid transparent', background: color, cursor: 'pointer', transform: activeAnnotationColor === color ? 'scale(1.1)' : 'none' }} onClick={() => setActiveAnnotationColor(color)} title={ANNOTATION_COLOR_NAMES[color] || color} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>{t('w9d.annotation.fontSize')}</span>
            <input type="number" min={8} max={48} value={activeAnnotationFontSize} onChange={e => setActiveAnnotationFontSize(Number(e.target.value))} style={{ flex: 1, padding: '4px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 12, outline: 'none', width: 50 }} />
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, marginTop: 8 }}>{t('w9d.annotation.addedAnnotations', { count: annotations.length })}</div>
          <div style={{ maxHeight: 150, overflowY: 'auto' }}>
            {annotations.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 8 }}>{t('w9d.annotation.clickToAdd')}</div>
            ) : (
              annotations.map(ann => (
                <div key={ann.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--bg-primary)', borderRadius: 6, marginBottom: 4, border: `1px solid ${selectedAnnotationId === ann.id ? '#3b82f6' : 'var(--border-color)'}`, cursor: 'pointer' }} onClick={() => setSelectedAnnotationId(ann.id)}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: ann.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ann.type === 'text' ? ann.text : ann.type === 'arrow' ? t('w9d.annotation.arrowAnnotation') : ann.type === 'rect' ? t('w9d.annotation.rectAnnotation') : t('w9d.annotation.ellipseAnnotation')}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{ann.type} | {ann.visible ? t('w9d.annotation.visible') : t('w9d.annotation.hidden')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { e.stopPropagation(); toggleAnnotationVisibility(ann.id) }}>{ann.visible ? '👁' : '👁‍🗨'}</button>
                    <button style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { e.stopPropagation(); toggleAnnotationLock(ann.id) }}>{ann.locked ? '🔒' : '🔓'}</button>
                    <button style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { e.stopPropagation(); deleteAnnotation(ann.id) }}>🗑</button>
                  </div>
                </div>
              ))
            )}
          </div>
          {annotations.length > 0 && (
            <button style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: 'none', background: 'var(--color-error-bg)', color: '#ef4444', marginTop: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }} onClick={clearAllAnnotations}>{t('w9d.annotation.clearAll')}</button>
          )}
          <button
            type="button"
            aria-label={t('w9d.annotation.closePanelAria')}
            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: '#64748b', marginTop: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            onClick={closePanel}
          >
            {t('w9d.annotation.closeEsc')}
          </button>
        </div>
      )}
    </>
  )
}
