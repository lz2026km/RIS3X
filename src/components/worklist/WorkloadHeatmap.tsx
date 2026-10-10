/**
 * G005 RIS v3.0.6.6 - WorkloadHeatmap 工作负载热力图
 * 50 点升级 - SVG 24h × Site 渲染
 */

import React from 'react';
import type { WorkloadSite } from '../../types/workflow';
import type { WorkloadHeatmapCell } from '../../types/workflow';

interface WorkloadHeatmapProps {
  sites: WorkloadSite[];
  cells: WorkloadHeatmapCell[];
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function intensityColor(intensity: number): string {
  const clamped = Math.max(0, Math.min(1, intensity));
  if (clamped < 0.2) return '#dbeafe';
  if (clamped < 0.4) return '#93c5fd';
  if (clamped < 0.6) return '#60a5fa';
  if (clamped < 0.8) return 'var(--color-warning-500)';
  return 'var(--color-error-600)';
}

export const WorkloadHeatmap: React.FC<WorkloadHeatmapProps> = ({ sites, cells }) => {
  const cellMap = new Map<string, WorkloadHeatmapCell>();
  for (const c of cells) cellMap.set(`${c.siteId}|${c.hour}`, c);

  return (
    <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)', overflowX: 'auto' }}>
      <div style={{ fontWeight: 700, color: 'var(--color-primary-800)', fontSize: 14, marginBottom: 12 }}>24h × 院区 工作负载热力图</div>
      <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ padding: 4, background: 'var(--bg-primary)', color: '#475569', fontWeight: 700, minWidth: 100 }}>院区</th>
            {HOURS.map((h) => (
              <th key={h} style={{ padding: 4, background: 'var(--bg-primary)', color: '#475569', fontWeight: 600, minWidth: 28, textAlign: 'center' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => (
            <tr key={site.siteId}>
              <td style={{ padding: 4, color: 'var(--color-primary-800)', fontWeight: 600 }}>
                <div>{site.siteName}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>利用率 {site.utilizationPct}%</div>
              </td>
              {HOURS.map((h) => {
                const cell = cellMap.get(`${site.siteId}|${h}`);
                const intensity = cell?.intensity ?? 0;
                return (
                  <td
                    key={h}
                    title={`${site.siteName} ${h}:00 负荷 ${cell?.load ?? 0}`}
                    style={{
                      width: 28,
                      height: 24,
                      background: intensityColor(intensity),
                      textAlign: 'center',
                      color: intensity > 0.5 ? '#fff' : '#0f172a',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {cell?.load ?? 0}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 12, color: '#475569' }}>
        <span>低</span>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <span key={v} style={{ width: 24, height: 12, background: intensityColor(v), display: 'inline-block', borderRadius: 2 }} />
        ))}
        <span>高</span>
      </div>
    </div>
  );
};

export default WorkloadHeatmap;