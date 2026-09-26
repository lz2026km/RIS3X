/**
 * G005 Radiology RIS - ChartSkeleton
 * Loading skeleton for charts. Use 4 rectangular blocks for axes hints.
 */
import React from 'react'

export interface ChartSkeletonProps {
  height?: number
  showHeader?: boolean
  testId?: string
}

export default function ChartSkeleton({
  height = 240,
  showHeader = true,
  testId = 'chart-skeleton',
}: ChartSkeletonProps) {
  const pulseStyle: React.CSSProperties = {
    background: 'var(--color-bg-subtle, #f1f5f9)',
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
  }

  const block = (w: string, h: number | string, extra: React.CSSProperties = {}): React.ReactElement => (
    <div
      className="chart-skel-block"
      style={{
        ...pulseStyle,
        width: w,
        height: h,
        ...extra,
      }}
    >
      <style>{`
        @keyframes chart-skel-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .chart-skel-block::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%);
          animation: chart-skel-shimmer 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  )

  return (
    <div
      data-testid={testId}
      role="status"
      aria-label="图表加载中"
      aria-live="polite"
      style={{
        width: '100%',
        height,
        padding: showHeader ? 12 : 0,
        boxSizing: 'border-box',
      }}
    >
      {showHeader && block('40%', 14, { marginBottom: 16 })}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          height: 'calc(100% - 50px)',
        }}
      >
        {[60, 45, 75, 50, 80, 65, 55, 70].map((h, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {block('100%', `${h}%`)}
            {block('60%', 8)}
          </div>
        ))}
      </div>
    </div>
  )
}
