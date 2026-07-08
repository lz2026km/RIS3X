import type { TimeSeries, TimeSeriesPoint, Period, TimeRange } from '../../types/analytics';
import { ANALYTICS_KPIS } from '../../data/analyticsKpis';

export class TimeSeriesBuilder {
  build(kpiIds: string[], period: Period, range: TimeRange): TimeSeries[] {
    return kpiIds.map(id => this.buildSingle(id, period, range));
  }

  buildSingle(kpiId: string, period: Period, range: TimeRange): TimeSeries {
    const def = ANALYTICS_KPIS.find(d => d.id === kpiId);
    const days = Math.max(1, Math.ceil((new Date(range.end).getTime() - new Date(range.start).getTime()) / 86400000));
    const steps = period === 'today' ? 24 : period === 'week' ? 7 : period === 'month' ? 30 : 12;
    const base = Math.abs(this.hashCode(kpiId)) % 100;
    const points: TimeSeriesPoint[] = Array.from({ length: steps }, (_, i) => {
      const t = new Date(new Date(range.start).getTime() + (i / steps) * days * 86400000);
      return {
        t: t.toISOString(),
        v: Math.round((base + Math.sin(i * 0.8) * 20 + Math.random() * 15) * 10) / 10,
        meta: { step: i },
      };
    });

    return {
      id: kpiId,
      name: def?.name ?? kpiId,
      unit: def?.unit,
      points,
      interval: period === 'today' ? 'hour' : period === 'week' ? 'day' : period === 'month' ? 'day' : 'month',
    };
  }

  movingAverage(ts: TimeSeries, window: number): TimeSeriesPoint[] {
    return ts.points.map((p, i) => {
      const start = Math.max(0, i - window + 1);
      const slice = ts.points.slice(start, i + 1);
      const avg = slice.reduce((s, pt) => s + pt.v, 0) / slice.length;
      return { t: p.t, v: Math.round(avg * 10) / 10, meta: p.meta };
    });
  }

  aggregate(series: TimeSeries[], fn: 'sum' | 'avg' | 'max' | 'min'): TimeSeriesPoint[] {
    if (!series.length) return [];
    const length = series[0]!.points.length;
    return Array.from({ length }, (_, i) => {
      const vals = series.map(s => s.points[i]?.v ?? 0).filter(v => !isNaN(v));
      const value = fn === 'sum' ? vals.reduce((a, b) => a + b, 0) :
                    fn === 'avg' ? vals.reduce((a, b) => a + b, 0) / (vals.length || 1) :
                    fn === 'max' ? Math.max(...vals) :
                    Math.min(...vals);
      return { t: series[0]!.points[i]!.t, v: Math.round(value * 10) / 10 };
    });
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

export const timeSeriesBuilder = new TimeSeriesBuilder();
