import React from 'react';
import type { ForecastResult } from '../../types/analytics';

export interface PredictiveForecastProps {
  forecast: ForecastResult;
  title?: string;
}

export default function PredictiveForecast({ forecast, title }: PredictiveForecastProps) {
  type Point = { t: string; v: number; forecast: boolean; lower?: number; upper?: number };
  const allPoints: Point[] = [
    ...forecast.history.map(p => ({ t: p.t, v: p.v, forecast: false as const })),
    ...forecast.forecast.map(p => ({ t: p.t, v: p.predicted, forecast: true as const, lower: p.lower, upper: p.upper })),
  ];

  const allVals = allPoints.map(p => p.v);
  const minVal = Math.min(...allVals, ...forecast.forecast.flatMap(f => [f.lower]));
  const maxVal = Math.max(...allVals, ...forecast.forecast.flatMap(f => [f.upper]));
  const range = maxVal - minVal || 1;
  const w = 600;
  const h = 200;
  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const splitIdx = forecast.history.length;

  const xScale = (i: number) => pad.left + (i / Math.max(1, allPoints.length - 1)) * plotW;
  const yScale = (v: number) => pad.top + plotH - ((v - minVal) / range) * plotH;

  const historyPath = allPoints.slice(0, splitIdx + 1).map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(p.v)}`).join(' ');
  const forecastPath = allPoints.slice(splitIdx).map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(splitIdx + i)},${yScale(p.v)}`).join(' ');

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{title ?? '预测'}</span>
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>方法: {forecast.method} · MSE: {forecast.metrics.mape}%</span>
        </div>
      </div>
      <svg width={w} height={h}>
        {allPoints.map((p, i) => {
          if (p.forecast && p.lower !== undefined && p.upper !== undefined) {
            return (
              <rect
                key={i}
                x={xScale(i) - (plotW / allPoints.length / 2)}
                y={yScale(p.upper)}
                width={plotW / allPoints.length}
                height={yScale(p.lower) - yScale(p.upper)}
                fill="#3b82f6" fillOpacity={0.1}
              />
            );
          }
          return null;
        })}
        <path d={historyPath} fill="none" stroke="#3b82f6" strokeWidth={2} />
        <path d={forecastPath} fill="none" stroke="#dc2626" strokeWidth={2} strokeDasharray="4,2" />
        {allPoints.map((p, i) => (
          <circle key={i} cx={xScale(i)} cy={yScale(p.v)} r={2} fill={p.forecast ? '#dc2626' : '#3b82f6'} />
        ))}
        <line x1={xScale(splitIdx)} y1={pad.top} x2={xScale(splitIdx)} y2={pad.top + plotH} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="3,2" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 12, height: 2, background: '#3b82f6' }} /><span style={{ fontSize: 12, color: '#94a3b8' }}>历史</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 12, height: 2, background: '#dc2626', borderTop: '2px dashed #dc2626' }} /><span style={{ fontSize: 12, color: '#94a3b8' }}>预测</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 12, height: 6, background: '#3b82f6', opacity: 0.1, borderRadius: 1 }} /><span style={{ fontSize: 12, color: '#94a3b8' }}>置信区间</span></div>
      </div>
    </div>
  );
}
