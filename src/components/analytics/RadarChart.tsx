;
import type { ChartPayload } from '../../types/analytics';

export interface RadarChartProps {
  data: ChartPayload;
  title?: string;
  size?: number;
}

export default function RadarChart({ data, title, size = 220 }: RadarChartProps) {
  const series = data.series[0];
  const points = series?.data ?? [];
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const maxVal = Math.max(...points.map(p => p.y), 1);
  const numAxes = points.length;
  const angleStep = (2 * Math.PI) / numAxes;

  const gridLevels = [0.25, 0.5, 0.75, 1];

  const getPoint = (i: number, value: number) => {
    const angle = angleStep * i - Math.PI / 2;
    const r = (value / maxVal) * radius;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>{title ?? data.title}</div>
      <svg width={size} height={size}>
        {gridLevels.map(l => {
          const pts = points.map((_, i) => getPoint(i, maxVal * l));
          return <polygon key={l} points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#e2e8f0" strokeWidth={1} />;
        })}
        {numAxes > 0 ? (
          <>
            <polygon
              points={points.map((p, i) => {
                const pt = getPoint(i, p.y);
                return `${pt.x},${pt.y}`;
              }).join(' ')}
              fill="#3b82f6" fillOpacity={0.15} stroke="#3b82f6" strokeWidth={2}
            />
            {points.map((p, i) => {
              const pt = getPoint(i, p.y);
              return (
                <g key={i}>
                  <line x1={cx} y1={cy} x2={pt.x} y2={pt.y} stroke="#e2e8f0" strokeWidth={1} />
                  <circle cx={pt.x} cy={pt.y} r={3} fill="#3b82f6" />
                  <text x={pt.x + 6} y={pt.y + 4} fontSize={9} fill="#475569">{String(p.x)}</text>
                </g>
              );
            })}
          </>
        ) : null}
      </svg>
    </div>
  );
}
