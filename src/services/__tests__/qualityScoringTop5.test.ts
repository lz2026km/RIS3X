/**
 * [v3.0.6.12-B3] qualityScoringHandlers top-5 改造 smoke test
 *   覆盖: store 种子 + 5 个核心路由读写一致性
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { qualityScoringHandlers } from '../mockBackend/qualityScoringHandlers';
import { initStore, list, get } from '../mockBackend/store';

const API_BASE = 'http://localhost:5173/api/v1';
const server = setupServer(...qualityScoringHandlers);

beforeAll(async () => {
  await initStore();
  server.listen({ onUnhandledRequest: 'bypass' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('qualityScoringHandlers top-5 (B3)', () => {
  it('store 种子: quality_dimensions 含 15 条且权重和 ≈ 0.6', () => {
    const dims = list<{ id: string; key: string; weight: number }>('quality_dimensions');
    expect(dims.length).toBe(15);
    const total = dims.reduce((s, d) => s + d.weight, 0);
    expect(total).toBeCloseTo(0.6, 1);
  });

  it('store 种子: quality_kpi + quality_threshold_config 单条', () => {
    expect(get('quality_kpi', 'current')).toBeDefined();
    expect(get('quality_threshold_config', 'default')).toBeDefined();
  });

  it('GET /quality/scoring/dimensions 读 store (15 条)', async () => {
    const res = await fetch(`${API_BASE}/quality/scoring/dimensions`);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.length).toBe(15);
    expect(json.data[0]).toHaveProperty('weight');
  });

  it('POST /quality/scoring/evaluate 写 store, 后续 GET 可读取', async () => {
    const postRes = await fetch(`${API_BASE}/quality/scoring/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId: 'rpt-smoke-1' }),
    });
    const postJson: any = await postRes.json();
    expect(postJson.success).toBe(true);
    const scoreId = postJson.data.scoreId;
    expect(scoreId).toMatch(/^qs-/);

    const stored = get<any>('quality_scores', scoreId);
    expect(stored).toBeDefined();
    expect(stored.reportId).toBe('rpt-smoke-1');

    const getRes = await fetch(`${API_BASE}/quality/scoring/scores/${scoreId}`);
    const getJson: any = await getRes.json();
    expect(getJson.success).toBe(true);
    expect(getJson.data.scoreId).toBe(scoreId);
    expect(getJson.data.totalScore).toBe(postJson.data.totalScore);
  });

  it('GET /quality/scoring/scores/:id 找不到时回退 (兼容 mock id)', async () => {
    const res = await fetch(`${API_BASE}/quality/scoring/scores/nonexistent-id`);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.scoreId).toBe('nonexistent-id');
  });

  it('GET /quality/scoring/kpi 读 store', async () => {
    const res = await fetch(`${API_BASE}/quality/scoring/kpi`);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.totalEvaluated).toBe(1248);
    expect(json.data.gradeDistribution.A).toBe(542);
  });

  it('PUT + GET /quality/scoring/threshold-config 一致性', async () => {
    const putRes = await fetch(`${API_BASE}/quality/scoring/threshold-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publishBlockThreshold: 65 }),
    });
    const putJson: any = await putRes.json();
    expect(putJson.data.id).toBe('default');
    expect(putJson.data.publishBlockThreshold).toBe(65);

    const getRes = await fetch(`${API_BASE}/quality/scoring/threshold-config`);
    const getJson: any = await getRes.json();
    expect(getJson.data.publishBlockThreshold).toBe(65);
    expect(getJson.data.version).toBe(6);
  });
});
