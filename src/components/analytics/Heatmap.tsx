;
import type { HeatmapData } from '../../types/analytics';

export interface HeatmapProps {
  data: HeatmapData;
  title?: string;
  cellSize?: number;
}

function cellColor(intensity: number, legend: { low: string; mid: string; high: string }): string {
  if (intensity < 0.33) return legend.low;
  if (intensity < 0.66) return legend.mid;
  return legend.high;
}

export default function Heatmap({ data, title, cellSize = 28 }: HeatmapProps) {
  const cellW = cellSize;
  const cellH = cellSize;

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 14 }}>
      {title && <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>{title}</div>}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 80 }}>
            {data.cols.filter((_, i) => i % Math.ceil(data.cols.length / 12) === 0).map(c => (
              <div key={c} style={{ width: cellW, fontSize: 8, color: '#94a3b8', textAlign: 'center' }}>{c}</div>
            ))}
          </div>
          {data.rows.map(row => (
            <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <div style={{ width: 76, fontSize: 12, color: '#475569', fontWeight: 600, textAlign: 'right', paddingRight: 4 }}>{row}</div>
              {data.cols.map(col => {
                const cell = data.cells.find(c => c.row === row && c.col === col);
                return (
                  <div
                    key={`${row}-${col}`}
                    style={{
                      width: cellW, height: cellH, borderRadius: 2,
                      background: cellColor(cell?.intensity ?? 0, data.legend),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 7, color: (cell?.intensity ?? 0) > 0.5 ? '#fff' : '#475569',
                      fontWeight: 600,
                    }}
                    title={`${row} - ${col}: ${cell?.value ?? 0}`}
                  >
                    {cell?.value ?? 0}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{data.legend.low}</span>
        <div style={{ width: 80, height: 6, borderRadius: 3, background: `linear-gradient(90deg, ${data.legend.low}, ${data.legend.mid}, ${data.legend.high})` }} />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{data.legend.high}</span>
      </div>
    </div>
  );
}
