// ============================================================
// G005 放射RIS系统 v3.0.6.5 - 病理-影像融合组件
// WSI 大体切片与 CT/MR 影像并排显示, 标注 + ROI 框
// ============================================================

import React, { useState, useCallback } from 'react'
import { Microscope, Move, Loader2 } from 'lucide-react'
import { runPathologyRadiologyRegistration } from '../../services/fusion/pathology/PathReg'
import type { PathologyRadiologyInput, PathologyRadiologyResult } from '../../types/fusion'
import { MOCK_STUDY_MR_PROSTATE, MOCK_PATH_RAD_RESULT } from '../../data/fusionMock'

export interface PathologyRadiologyFusionProps {
  study?: PathologyRadiologyInput
  height?: number
  onResult?: (r: PathologyRadiologyResult) => void
}

export const PathologyRadiologyFusion: React.FC<PathologyRadiologyFusionProps> = ({
  study: studyProp,
  height = 480,
  onResult,
}) => {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<PathologyRadiologyResult | null>(MOCK_PATH_RAD_RESULT)
  const [landmarkCount, setLandmarkCount] = useState(5)

  const defaultStudy: PathologyRadiologyInput = studyProp ?? {
    wsi: {
      id: 'WSI-001',
      width: 4000,
      height: 3000,
      level: 0,
    },
    radiology: MOCK_STUDY_MR_PROSTATE,
    initialLandmarks: [],
  }

  const run = useCallback(async () => {
    setRunning(true)
    try {
      const lms = Array.from({ length: landmarkCount }).map((_, i) => ({
        id: `lm-${i}`,
        label: `LM${i + 1}`,
        fixed: { x: i * 4 - 10, y: i * 3 - 6, z: 0 },
        moving: { x: i * 4 - 10 + (Math.random() - 0.5) * 1.2, y: i * 3 - 6 + (Math.random() - 0.5) * 1.2, z: 0 },
      }))
      const r = await runPathologyRadiologyRegistration({
        ...defaultStudy,
        initialLandmarks: lms,
      })
      setResult(r)
      onResult?.(r)
    } finally {
      setRunning(false)
    }
  }, [defaultStudy, landmarkCount, onResult])

  return (
    <div
      data-testid="path-rad-fusion"
      style={{ background: '#0a0a0a', borderRadius: 8, padding: 10, color: '#cbd5e1', height, display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Microscope size={14} color="#a78bfa" />
        <span style={{ fontSize: 13, fontWeight: 600 }}>病理-影像融合</span>
        <span style={{ fontSize: 12, color: '#64748b' }}>{defaultStudy.wsi.id} ⇄ {defaultStudy.radiology.studyId}</span>
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 12, color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          标注
          <input
            type="number"
            min={3}
            max={20}
            value={landmarkCount}
            onChange={(e) => setLandmarkCount(Math.max(3, Math.min(20, parseInt(e.target.value, 10) || 3)))}
            style={inputStyle}
          />
        </label>
        <button
          data-testid="path-rad-run"
          onClick={run}
          disabled={running}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: running ? '#475569' : '#7c3aed',
            border: 'none',
            borderRadius: 4,
            padding: '5px 12px',
            color: '#fff',
            fontSize: 12,
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          {running ? <Loader2 size={11} /> : <Move size={11} />}
          {running ? '配准中...' : '执行配准'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, background: '#000', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 4, left: 4, fontSize: 12, color: '#a78bfa', background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 2, zIndex: 5 }}>
            WSI · {defaultStudy.wsi.id} · {defaultStudy.wsi.width}×{defaultStudy.wsi.height}
          </div>
          <WsiMock roi={result?.roi} />
        </div>
        <div style={{ flex: 1, background: '#000', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 4, left: 4, fontSize: 12, color: '#22d3ee', background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 2, zIndex: 5 }}>
            CT/MR · {defaultStudy.radiology.studyId}
          </div>
          <MrMock />
        </div>
      </div>

      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          <Metric label="TRE" value={`${result.tre.toFixed(2)} mm`} color={result.tre < 2 ? '#10b981' : '#fbbf24'} />
          <Metric label="Dice" value={result.dice.toFixed(3)} color={result.dice > 0.85 ? '#10b981' : '#fbbf24'} />
          <Metric label="置信度" value={`${(result.confidence * 100).toFixed(0)}%`} color="#3b82f6" />
          <Metric label="ROI" value={`${result.roi.w}×${result.roi.h}`} color="#a78bfa" />
        </div>
      )}
    </div>
  )
}

function WsiMock({ roi }: { roi?: { x: number; y: number; w: number; h: number } }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      <defs>
        <radialGradient id="wsiBg" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <pattern id="glands" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
          <circle cx="15" cy="15" r="6" fill="none" stroke="#7c3aed" strokeWidth="0.3" opacity="0.5" />
          <circle cx="15" cy="15" r="2" fill="#7c3aed" opacity="0.4" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="400" height="300" fill="url(#wsiBg)" />
      <rect x="0" y="0" width="400" height="300" fill="url(#glands)" />
      {roi && (
        <g>
          <rect x={roi.x / 10} y={roi.y / 10} width={roi.w / 10} height={roi.h / 10} fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4,2" />
          <text x={roi.x / 10 + 4} y={roi.y / 10 - 3} fontSize="8" fill="#fbbf24">ROI</text>
        </g>
      )}
    </svg>
  )
}

function MrMock() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 256 256" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      <rect x="0" y="0" width="256" height="256" fill="#020617" />
      <ellipse cx="128" cy="128" rx="80" ry="90" fill="none" stroke="#475569" strokeWidth="0.5" />
      <ellipse cx="128" cy="128" rx="55" ry="60" fill="#1e293b" opacity="0.4" />
      <circle cx="110" cy="128" r="14" fill="#1e293b" />
      <circle cx="146" cy="128" r="14" fill="#1e293b" />
      <circle cx="110" cy="128" r="4" fill="#ef4444" opacity="0.7" />
      <text x="110" y="158" fontSize="6" fill="#94a3b8" textAnchor="middle">外周带</text>
      <text x="128" y="80" fontSize="6" fill="#64748b" textAnchor="middle">中央带</text>
    </svg>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#0f172a', borderRadius: 4, padding: 6, textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color }}>{value}</div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#1e293b',
  color: '#cbd5e1',
  border: '1px solid #334155',
  borderRadius: 3,
  padding: '2px 4px',
  fontSize: 12,
  width: 50,
}

export default PathologyRadiologyFusion
