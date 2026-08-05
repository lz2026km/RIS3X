import React, { useEffect, useState } from 'react'
import type { CineAnalysisResult, CardiacPhase } from '../../types/imaging/postprocess'

export interface Cine4DPlayerProps {
  result: CineAnalysisResult | null
  height?: number
  onPhaseCommit?: (phase: CardiacPhase) => void
}

export default function Cine4DPlayer({ result, height = 320, onPhaseCommit }: Cine4DPlayerProps) {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [loop, setLoop] = useState(true)
  const [reverse, setReverse] = useState(false)
  const [smoothTransition, setSmoothTransition] = useState(true)

  useEffect(() => {
    if (!result) return
    if (phaseIdx >= result.phases.length) setPhaseIdx(0)
  }, [result, phaseIdx])

  useEffect(() => {
    if (!result) return
    const phase = result.phases[phaseIdx]
    if (phase) onPhaseCommit?.(phase)
  }, [phaseIdx, result, onPhaseCommit])

  if (!result) {
    return (
      <div style={{ background: '#0a0a0a', borderRadius: 8, padding: 12, height, color: '#64748b', fontSize: 12 }}>
        等待 CineAnalysis 数据…
      </div>
    )
  }

  const phase = result.phases[phaseIdx] ?? result.phases[0]!

  return (
    <div style={{ background: '#0a0a0a', borderRadius: 8, padding: 8, height, color: '#cbd5e1', fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: '#fbbf24' }}>4D Cine Phase Player</span>
        <span style={{ color: '#94a3b8' }}>时相 <span style={{ color: '#fbbf24' }}>{phaseIdx + 1}</span> / {result.phases.length}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setLoop(l => !l)} style={btnStyle(loop ? '#1e40af' : '#1a1a1a')}>{loop ? '🔁 循环' : '➡ 单次'}</button>
        <button onClick={() => setReverse(r => !r)} style={btnStyle(reverse ? '#1e40af' : '#1a1a1a')}>{reverse ? '↩ 反向' : '↪ 正向'}</button>
        <button onClick={() => setSmoothTransition(s => !s)} style={btnStyle(smoothTransition ? '#1e40af' : '#1a1a1a')}>插值 {smoothTransition ? '开' : '关'}</button>
      </div>

      <PhaseTimeline phases={result.phases} phaseIdx={phaseIdx} onSelect={setPhaseIdx} />

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={() => setPhaseIdx(p => Math.max(0, p - 1))} style={btnStyle('#1e3a5f')}>⏮ 上一相位</button>
        <button onClick={() => stepAuto(result, phaseIdx, setPhaseIdx, loop, reverse)} style={btnStyle('#059669')}>▶ 自动步进</button>
        <button onClick={() => setPhaseIdx(p => Math.min(result.phases.length - 1, p + 1))} style={btnStyle('#1e3a5f')}>⏭ 下一相位</button>
      </div>

      <div style={{ marginTop: 8, padding: 6, background: '#1a1a1a', borderRadius: 4, fontSize: 12 }}>
        <span style={{ color: '#fbbf24' }}>当前相位：</span>
        LV <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>{phase.lvVolumeMl.toFixed(1)}</span> ml ·
        RV <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>{phase.rvVolumeMl.toFixed(1)}</span> ml ·
        Mass <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>{phase.myocardialMassG.toFixed(1)}</span> g
        {phase.isEndDiastolic && <span style={{ marginLeft: 8, color: '#22c55e' }}>[ED]</span>}
        {phase.isEndSystolic && <span style={{ marginLeft: 8, color: '#ef4444' }}>[ES]</span>}
      </div>
    </div>
  )
}

function stepAuto(
  result: CineAnalysisResult,
  current: number,
  setter: (n: number) => void,
  loop: boolean,
  reverse: boolean,
) {
  let next = reverse ? current - 1 : current + 1
  if (next < 0) next = loop ? result.phases.length - 1 : 0
  if (next >= result.phases.length) next = loop ? 0 : result.phases.length - 1
  setter(next)
}

function PhaseTimeline({
  phases,
  phaseIdx,
  onSelect,
}: {
  phases: CardiacPhase[]
  phaseIdx: number
  onSelect: (i: number) => void
}) {
  const max = Math.max(...phases.map(p => p.lvVolumeMl), 1)
  const min = Math.min(...phases.map(p => p.lvVolumeMl), 0)
  const range = Math.max(1, max - min)
  const w = 100 / phases.length
  return (
    <svg viewBox={`0 0 ${phases.length * 8} 60`} preserveAspectRatio="none" width="100%" height="60" style={{ background: '#000', borderRadius: 4 }}>
      <polyline
        points={phases.map((p, i) => `${i * 8 + 4},${60 - ((p.lvVolumeMl - min) / range) * 56 - 2}`).join(' ')}
        fill="none" stroke="#fbbf24" strokeWidth="1.4"
      />
      {phases.map((p, i) => (
        <rect
          key={i}
          x={i * 8}
          y={0}
          width={8}
          height={60}
          fill={i === phaseIdx ? 'rgba(59,130,246,0.35)' : p.isEndDiastolic ? 'rgba(34,197,94,0.18)' : p.isEndSystolic ? 'rgba(239,68,68,0.18)' : 'transparent'}
          stroke={i === phaseIdx ? '#3b82f6' : '#1f2937'}
          strokeWidth="0.4"
          onClick={() => onSelect(i)}
          style={{ cursor: 'pointer' }}
        />
      ))}
    </svg>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, border: 'none', color: '#fff', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }
}