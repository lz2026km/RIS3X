import { ANALYTICS_KPIS } from '../../data/analyticsKpis';
import type { KpiDefinition, KpiValue, KpiSnapshot, KpiCategory, Period, TimeRange } from '../../types/analytics';

export class KpiEngine {
  private definitions: Map<string, KpiDefinition>;
  private snapshots: Map<string, KpiSnapshot>;
  private listeners: Set<(snapshot: KpiSnapshot) => void>;

  constructor() {
    this.definitions = new Map(ANALYTICS_KPIS.map(d => [d.id, d]));
    this.snapshots = new Map();
    this.listeners = new Set();
  }

  getDefinition(kpiId: string): KpiDefinition | undefined {
    return this.definitions.get(kpiId);
  }

  getAllDefinitions(): KpiDefinition[] {
    return [...this.definitions.values()];
  }

  getByCategory(category: KpiCategory): KpiDefinition[] {
    return this.getAllDefinitions().filter(d => d.category === category);
  }

  getByTag(tag: string): KpiDefinition[] {
    return this.getAllDefinitions().filter(d => d.tags.includes(tag));
  }

  computeValue(kpiId: string, range: TimeRange): KpiValue {
    const def = this.definitions.get(kpiId);
    if (!def) throw new Error(`Unknown KPI: ${kpiId}`);

    const seed = this.seedValue(def, range);
    const previous = this.seedValue(def, this.prevRange(range));
    const yoy = this.seedValue(def, this.yoyRange(range));

    const trend: 'up' | 'down' | 'flat' =
      seed > (previous * 1.05) ? 'up' :
      seed < (previous * 0.95) ? 'down' : 'flat';

    return {
      kpiId,
      value: seed,
      previous,
      yoy: previous ? Math.round(((seed - yoy) / yoy) * 1000) / 10 : undefined,
      mom: previous ? Math.round(((seed - previous) / previous) * 1000) / 10 : undefined,
      trend,
      target: def.target,
      achieved: def.target ? Math.round((seed / def.target) * 1000) / 10 : undefined,
      sparkline: this.generateSparkline(def, range),
      updatedAt: new Date().toISOString(),
    };
  }

  computeSnapshot(period: Period, range: TimeRange): KpiSnapshot {
    const values = this.getAllDefinitions().map(d => this.computeValue(d.id, range));
    const snapshot: KpiSnapshot = { period, range, values, generatedAt: new Date().toISOString() };
    this.snapshots.set(period, snapshot);
    this.notify(snapshot);
    return snapshot;
  }

  getSnapshot(period: Period): KpiSnapshot | undefined {
    return this.snapshots.get(period);
  }

  subscribe(listener: (snapshot: KpiSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private seedValue(def: KpiDefinition, range: TimeRange): number {
    const days = (new Date(range.end).getTime() - new Date(range.start).getTime()) / 86400000;
    const base = Math.abs(this.hashCode(def.id));
    const dayFactor = Math.max(1, Math.round(days));
    const multiplier = def.category === 'volume' ? 20 : def.category === 'timeliness' ? 3 : def.category === 'quality' ? 5 : 10;
    return Math.round((base % 100 + 10) * dayFactor * multiplier) / 10;
  }

  private prevRange(range: TimeRange): TimeRange {
    const start = new Date(range.start);
    const end = new Date(range.end);
    const span = end.getTime() - start.getTime();
    return {
      start: new Date(start.getTime() - span).toISOString().substring(0, 10),
      end: start.toISOString().substring(0, 10),
    };
  }

  private yoyRange(range: TimeRange): TimeRange {
    const start = new Date(range.start);
    const end = new Date(range.end);
    return {
      start: new Date(start.getFullYear() - 1, start.getMonth(), start.getDate()).toISOString().substring(0, 10),
      end: new Date(end.getFullYear() - 1, end.getMonth(), end.getDate()).toISOString().substring(0, 10),
    };
  }

  private generateSparkline(def: KpiDefinition, _range: TimeRange): number[] {
    const points = 24;
    const base = this.hashCode(def.id) % 100;
    return Array.from({ length: points }, (_, i) =>
      Math.round((base + Math.sin(i * 1.5) * 15 + Math.random() * 10) * 10) / 10
    );
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

  private notify(snapshot: KpiSnapshot): void {
    for (const listener of this.listeners) {
      try { listener(snapshot); } catch { /* ignore */ }
    }
  }
}

export const kpiEngine = new KpiEngine();
