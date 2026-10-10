import React from 'react';
import type { IopRecord } from '@/types/eye';

interface Props {
  records: IopRecord[];
  patientId: string;
}

const IopCurveChart: React.FC<Props> = ({ records, patientId }) => {
  if (records.length === 0) {
    return <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 12 }}>暂无眼压记录</div>;
  }

  const iopMin = Math.min(...records.flatMap((r) => [r.od, r.os])) - 2;
  const iopMax = Math.max(...records.flatMap((r) => [r.od, r.os])) + 2;

  const chartWidth = 300;
  const chartHeight = 120;
  const padding = { top: 16, right: 16, bottom: 24, left: 24 };
  const plotW = chartWidth - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;

  const xScale = (i: number) => padding.left + (i / Math.max(records.length - 1, 1)) * plotW;
  const yScale = (v: number) => padding.top + plotH - ((v - iopMin) / (iopMax - iopMin)) * plotH;

  const odPoints = records.map((r, i) => `${xScale(i)},${yScale(r.od)}`).join(' ');
  const osPoints = records.map((r, i) => `${xScale(i)},${yScale(r.os)}`).join(' ');

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#475569' }}>
        24h 眼压曲线 - {patientId}
      </div>
      <svg width={chartWidth} height={chartHeight} style={{ display: 'block' }}>
        {/* 网格 */}
        {Array.from({ length: 5 }, (_, i) => (
          <line
            key={`grid-${i}`}
            x1={padding.left}
            y1={padding.top + (plotH / 5) * i}
            x2={chartWidth - padding.right}
            y2={padding.top + (plotH / 5) * i}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        ))}
        {/* 眼压 21mmHg 参考线 */}
        <line
          x1={padding.left}
          y1={yScale(21)}
          x2={chartWidth - padding.right}
          y2={yScale(21)}
          stroke="var(--color-error-500)"
          strokeWidth={1}
          strokeDasharray="3,3"
        />
        {records.map((r, i) => (
          <text key={`x-${i}`} x={xScale(i)} y={chartHeight - 4} fontSize={8} textAnchor="middle" fill="#94a3b8">
            {new Date(r.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </text>
        ))}
        {/* OD 线 */}
        <polyline points={odPoints} fill="none" stroke="var(--color-primary-500)" strokeWidth={2} />
        {records.map((r, i) => (
          <circle key={`od-${i}`} cx={xScale(i)} cy={yScale(r.od)} r={3} fill="var(--color-primary-500)" />
        ))}
        {/* OS 线 */}
        <polyline points={osPoints} fill="none" stroke="#8b5cf6" strokeWidth={2} />
        {records.map((r, i) => (
          <circle key={`os-${i}`} cx={xScale(i)} cy={yScale(r.os)} r={3} fill="#8b5cf6" />
        ))}
        {records.length > 0 && (
          <>
            <text x={chartWidth - padding.right - 40} y={padding.top + 10} fontSize={9} fill="var(--color-primary-500)">OD</text>
            <text x={chartWidth - padding.right - 40} y={padding.top + 22} fontSize={9} fill="#8b5cf6">OS</text>
            <text x={chartWidth - padding.right - 40} y={padding.top + 34} fontSize={8} fill="var(--color-error-500)">21 参考</text>
          </>
        )}
      </svg>
    </div>
  );
};

export default IopCurveChart;
