import React, { useState, useCallback } from 'react'

export type RegistrationType = 'rigid' | 'affine' | 'deformable'

export interface Landmark {
  id: string
  label: string
  sourcePoint: { x: number; y: number; z?: number }
  targetPoint: { x: number; y: number; z?: number }
}

export interface RegistrationResult {
  type: RegistrationType
  matrix: number[][]
  error: number
  processingTimeMs: number
}

export interface RegistrationPanelProps {
  sourceImageIds: string[]
  targetImageIds: string[]
  onRegister?: (result: RegistrationResult) => void
  height?: number
}

export const RegistrationPanel: React.FC<RegistrationPanelProps> = ({
  sourceImageIds,
  targetImageIds,
  onRegister,
  height = 400,
}) => {
  const [regType, setRegType] = useState<RegistrationType>('rigid')
  const [landmarks, setLandmarks] = useState<Landmark[]>([])
  const [registering, setRegistering] = useState(false)
  const [result, setResult] = useState<RegistrationResult | null>(null)

  const addLandmark = useCallback(() => {
    const idx = landmarks.length + 1
    const newLandmark: Landmark = {
      id: `lm-${Date.now()}`,
      label: `Landmark ${idx}`,
      sourcePoint: { x: 100 + idx * 20, y: 100 + idx * 15 },
      targetPoint: { x: 110 + idx * 18, y: 105 + idx * 14 },
    }
    setLandmarks(prev => [...prev, newLandmark])
  }, [landmarks])

  const removeLandmark = useCallback((id: string) => {
    setLandmarks(prev => prev.filter(l => l.id !== id))
  }, [])

  const runRegistration = useCallback(async () => {
    setRegistering(true)
    const start = performance.now()
    await new Promise(r => setTimeout(r, 500))
    const identity = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ]
    const residualError = landmarks.length > 0
      ? landmarks.reduce((sum, lm) => {
          const dx = lm.sourcePoint.x - lm.targetPoint.x
          const dy = lm.sourcePoint.y - lm.targetPoint.y
          return sum + Math.sqrt(dx * dx + dy * dy)
        }, 0) / landmarks.length
      : 0

    const regResult: RegistrationResult = {
      type: regType,
      matrix: identity,
      error: Math.round(residualError * 100) / 100,
      processingTimeMs: Math.round(performance.now() - start),
    }
    setResult(regResult)
    setRegistering(false)
    onRegister?.(regResult)
  }, [landmarks, regType, onRegister])

  return (
    <div style={{ background: '#0a0a0a', borderRadius: 8, padding: 8, height }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: '#cbd5e1' }}>
        <span style={{ fontWeight: 600 }}>图像配准</span>
        <div style={{ width: 1, height: 16, background: '#333' }} />
        {(['rigid', 'affine', 'deformable'] as RegistrationType[]).map(t => (
          <button
            key={t}
            onClick={() => setRegType(t)}
            style={{
              background: regType === t ? '#1e40af' : 'transparent',
              border: '1px solid', borderColor: regType === t ? '#3b82f6' : '#333',
              borderRadius: 4, padding: '2px 8px', color: '#cbd5e1', fontSize: 12, cursor: 'pointer',
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, height: 'calc(100% - 80px)' }}>
        <div style={{ flex: 1, background: '#000', borderRadius: 4, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 4, left: 4, fontSize: 12, color: '#fbbf24', background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 2 }}>
            Source ({sourceImageIds.length})
          </div>
          {landmarks.map(lm => (
            <div
              key={lm.id}
              style={{
                position: 'absolute', left: lm.sourcePoint.x, top: lm.sourcePoint.y,
                width: 8, height: 8, borderRadius: '50%', background: '#3b82f6',
                transform: 'translate(-50%, -50%)', zIndex: 5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title={lm.label}
            >
              <span style={{ position: 'absolute', top: -14, fontSize: 12, color: '#3b82f6', whiteSpace: 'nowrap' }}>{lm.label}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, background: '#000', borderRadius: 4, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 4, left: 4, fontSize: 12, color: '#22c55e', background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 2 }}>
            Target ({targetImageIds.length})
          </div>
          {landmarks.map(lm => (
            <div
              key={lm.id}
              style={{
                position: 'absolute', left: lm.targetPoint.x, top: lm.targetPoint.y,
                width: 8, height: 8, borderRadius: '50%', background: '#22c55e',
                transform: 'translate(-50%, -50%)', zIndex: 5,
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: '#cbd5e1' }}>
        <button onClick={addLandmark} style={{ background: '#1e40af', border: 'none', borderRadius: 4, padding: '4px 12px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
          + Add Landmark ({landmarks.length})
        </button>
        <button
          onClick={runRegistration}
          disabled={registering}
          style={{ background: registering ? '#333' : '#059669', border: 'none', borderRadius: 4, padding: '4px 12px', color: '#fff', fontSize: 12, cursor: 'pointer' }}
        >
          {registering ? 'Registering...' : 'Run Registration'}
        </button>
        {result && (
          <span>
            Error: <span style={{ color: result.error < 5 ? '#22c55e' : '#ef4444' }}>{result.error.toFixed(1)}px</span>
            {' | '}Time: {result.processingTimeMs}ms
          </span>
        )}
        {landmarks.length > 0 && (
          <button onClick={() => removeLandmark(landmarks[landmarks.length - 1]!.id)} style={{ background: 'transparent', border: '1px solid #ef4444', borderRadius: 4, padding: '2px 8px', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>
            Remove Last
          </button>
        )}
      </div>
    </div>
  )
}

export default RegistrationPanel
