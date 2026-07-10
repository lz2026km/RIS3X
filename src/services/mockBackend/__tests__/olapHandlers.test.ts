import { describe, it, expect } from 'vitest';
import {
  aggregateFromKpiHistory,
  aggregateFromCollections,
  METRICS,
} from '../olapHandlers';
import { KPI_HISTORY } from '../../../data/kpiHistory';

const ALL_MEASURES: string[] = METRICS.map((m: { id: string }) => m.id);

describe('olapHandlers - 13 measures full coverage', () => {
  it('KPI_HISTORY contains 36 KPIs across 1096 days', () => {
    const kpiIds = Object.keys(KPI_HISTORY);
    expect(kpiIds.length).toBeGreaterThanOrEqual(30);
    const sampleKpi = kpiIds[0]!;
    expect(KPI_HISTORY[sampleKpi]?.length).toBeGreaterThan(1000);
    const total = kpiIds.reduce((s, k) => s + (KPI_HISTORY[k]?.length || 0), 0);
    expect(total).toBeGreaterThan(30000);
  });

  describe.each(ALL_MEASURES)('measure "%s"', (measure: string) => {
    it('aggregates non-zero values from kpiHistory (monthly)', () => {
      const result = aggregateFromKpiHistory({
        measures: [measure],
        dimensions: ['date'],
        granularity: 'monthly',
      });
      expect(result.source).toBe('kpiHistory');
      expect(result.rows.length).toBeGreaterThan(0);
      const nonZero = result.rows.filter((r) => Number(r[measure]) > 0);
      expect(nonZero.length).toBeGreaterThan(0);
    });
  });

  it('multi-measure query returns aligned rows', () => {
    const result = aggregateFromKpiHistory({
      measures: ALL_MEASURES,
      dimensions: ['date'],
      granularity: 'monthly',
    });
    expect(result.rows.length).toBeGreaterThan(0);
    for (const measure of ALL_MEASURES) {
      const nonZero = result.rows.filter((r) => Number(r[measure]) > 0);
      expect(nonZero.length, `${measure} should have non-zero rows`).toBeGreaterThan(0);
    }
  });

  it('honors date range filter', () => {
    const result = aggregateFromKpiHistory({
      measures: ['exam_count'],
      dimensions: ['date'],
      granularity: 'monthly',
      filters: [{ dimension: 'date', operator: 'between', value: ['2024-01-01', '2024-06-30'] }],
    });
    expect(result.rows.length).toBeGreaterThan(0);
    for (const row of result.rows) {
      const d = String(row.date);
      expect(d >= '2024-01' && d <= '2024-06', `unexpected period ${d}`).toBe(true);
    }
  });

  it('daily granularity returns up to 90 rows', () => {
    const result = aggregateFromKpiHistory({
      measures: ['exam_count'],
      dimensions: ['date'],
      granularity: 'daily',
    });
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.length).toBeLessThanOrEqual(90);
  });

  it('unknown measures are ignored', () => {
    const result = aggregateFromKpiHistory({
      measures: ['bogus_measure', 'exam_count'],
      dimensions: ['date'],
      granularity: 'monthly',
    });
    expect(result.rows.length).toBeGreaterThan(0);
    const first = result.rows[0]!;
    expect(first['exam_count']).toBeGreaterThan(0);
    expect(first['bogus_measure']).toBeUndefined();
  });

  describe('collection fallback', () => {
    it('uses store data when provided', () => {
      const result = aggregateFromCollections(
        {
          measures: ALL_MEASURES,
          dimensions: ['date'],
          granularity: 'monthly',
        },
        {
          exams: [
            { id: 'e1', price: 500 },
            { id: 'e2', price: 600 },
            { id: 'e3', amount: 700 },
          ],
          reports: [
            { id: 'r1', isOvertime: true },
            { id: 'r2' },
            { id: 'r3', isOvertime: true },
          ],
          criticals: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }, { id: 'c4' }],
          quality: [{ id: 'q1', score: 85 }, { id: 'q2', score: 92 }, { id: 'q3', qualityScore: 88 }],
        },
      );
      expect(result.source).toBe('collection-fallback');
      const r0 = result.rows[0]!;
      expect(r0['exam_count']).toBe(3);
      expect(r0['exam_revenue']).toBe(1800);
      expect(r0['report_count']).toBe(3);
      expect(r0['report_overtime']).toBe(2);
      expect(r0['critical_count']).toBe(4);
      expect(r0['quality_score_avg']).toBeCloseTo(88.3, 1);
      expect(r0['consultation_count']).toBe(0);
      expect(r0['workload_avg']).toBe(0);
    });

    it('falls back to baselines when collections are empty', () => {
      const result = aggregateFromCollections(
        {
          measures: ALL_MEASURES,
          dimensions: ['date'],
          granularity: 'monthly',
        },
        { exams: [], reports: [], criticals: [], quality: [] },
      );
      expect(result.rows.length).toBe(1);
      for (const measure of ALL_MEASURES) {
        const r0 = result.rows[0]!;
        expect(r0[measure], `${measure} should be non-zero baseline`).toBeGreaterThan(0);
      }
    });

    it('handles missing optional fields without NaN', () => {
      const result = aggregateFromCollections(
        { measures: ['quality_score_avg'], dimensions: ['date'], granularity: 'monthly' },
        { quality: [{ id: 'q1' }, { id: 'q2', score: 'abc' as unknown as number }] },
      );
      const r0 = result.rows[0]!;
      expect(Number.isFinite(r0['quality_score_avg'])).toBe(true);
    });
  });
});
