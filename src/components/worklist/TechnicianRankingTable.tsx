// [G005 v3.0.6.11-100 Wave 1A] 技师排行表 Top10: 完成数 / 平均时长 / 重拍率 三榜
import { useState } from 'react'
import { Trophy, Clock, RefreshCw, CheckCircle2 } from 'lucide-react'
import type { TechnicianKpiDto } from '../../services/api/worklistApi'

interface Props {
  technicians: TechnicianKpiDto[]
  loading?: boolean
}

type RankKind = 'completed' | 'duration' | 'retake'

const KIND_DEFS: Record<RankKind, { label: string; icon: React.ReactNode; color: string }> = {
  completed: { label: '完成数', icon: <CheckCircle2 size={12} />, color: '#059669' },
  duration: { label: '平均时长', icon: <Clock size={12} />, color: 'var(--color-primary-600)' },
  retake: { label: '重拍率', icon: <RefreshCw size={12} />, color: 'var(--color-error-600)' },
}

const rankColor = (idx: number) => (idx === 0 ? 'var(--color-warning-500)' : idx === 1 ? '#94a3b8' : idx === 2 ? 'var(--color-warning-600)' : '#cbd5e1')

export default function TechnicianRankingTable({ technicians, loading }: Props) {
  const [kind, setKind] = useState<RankKind>('completed')

  const sorted = [...technicians].sort((a, b) => {
    if (kind === 'completed') return b.completedCount - a.completedCount
    if (kind === 'duration') return a.avgDurationMin - b.avgDurationMin
    return a.retakeRate - b.retakeRate
  }).slice(0, 10)

  const valueOf = (t: TechnicianKpiDto): string => {
    if (kind === 'completed') return `${t.completedCount} 项`
    if (kind === 'duration') return `${t.avgDurationMin} min`
    return `${t.retakeRate}%`
  }
  const maxOf = (t: TechnicianKpiDto): number => {
    const raw = kind === 'completed' ? t.completedCount : kind === 'duration' ? Math.max(1, 60 - t.avgDurationMin) : Math.max(1, 100 - t.retakeRate)
    return raw
  }
  const maxVal = sorted.length > 0 ? Math.max(...sorted.map(maxOf), 1) : 1

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)',
      padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }} data-testid="tech-ranking-table">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Trophy size={13} color="var(--color-warning-500)" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)' }}>技师排行 Top10</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-1, 4px)' }}>
          {(Object.keys(KIND_DEFS) as RankKind[]).map((k) => (
            <button
              key={k}
              data-testid={`tech-rank-tab-${k}`}
              onClick={() => setKind(k)}
              style={{
                padding: '3px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 11,
                fontWeight: 600,
                background: kind === k ? KIND_DEFS[k].color : 'var(--bg-deep)',
                color: kind === k ? '#fff' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
              }}
            >
              {KIND_DEFS[k].icon}
              {KIND_DEFS[k].label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>加载中...</div>
      ) : sorted.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>暂无技师数据</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.map((t, idx) => {
            const pct = Math.max(4, Math.round((maxOf(t) / maxVal) * 100))
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }} data-testid={`tech-rank-row-${t.id}`}>
                <span style={{
                  width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, background: rankColor(idx), color: idx < 3 ? '#fff' : '#334155',
                }}>{idx + 1}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', width: 72, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.name}
                </span>
                <div style={{ flex: 1, height: 7, background: 'var(--bg-deep)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%', borderRadius: 999,
                    background: KIND_DEFS[kind].color, transition: 'width 0.4s',
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', width: 56, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {valueOf(t)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
