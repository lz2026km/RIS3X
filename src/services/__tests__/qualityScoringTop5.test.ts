/**
 * [v3.0.6.12-B3] qualityScoringHandlers top-5 改造 smoke test
 *   覆盖: store 种子 + 5 个核心路由读写一致性
 * [W1-107] 改用 node 环境: 与其他 MSW handler 测试一致, 避免 jsdom 下全局 fetch
 *   拦截器在多文件串行执行时失效 (ECONNREFUSED localhost:5173)。
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { qualityScoringHandlers } from '../mockBackend/qualityScoringHandlers';
import { initStore, list, get } from '../mockBackend/store';

const API_BASE = 'http://localhost:5173/api/v1';
const server = setupServer(...qualityScoringHandlers);
// [W1-107] 在模块作用域启动拦截器, 避免 beforeAll 在重负载下超时导致 fetch 未被拦截
server.listen({ onUnhandledRequest: 'warn' });

beforeAll(async () => {
  await initStore();
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
    expect(res.ok).toBe(true);
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
    expect(postRes.ok).toBe(true);
    const postJson: any = await postRes.json();
    expect(postJson.success).toBe(true);
    const scoreId = postJson.data.scoreId;
    expect(scoreId).toMatch(/^qs-/);

    const stored = get<any>('quality_scores', scoreId);
    expect(stored).toBeDefined();
    expect(stored.reportId).toBe('rpt-smoke-1');

    const getRes = await fetch(`${API_BASE}/quality/scoring/scores/${scoreId}`);
    expect(getRes.ok).toBe(true);
    const getJson: any = await getRes.json();
    expect(getJson.success).toBe(true);
    expect(getJson.data.scoreId).toBe(scoreId);
    expect(getJson.data.totalScore).toBe(postJson.data.totalScore);
  });

  it('GET /quality/scoring/scores/:id 找不到时回退 (兼容 mock id)', async () => {
    const res = await fetch(`${API_BASE}/quality/scoring/scores/nonexistent-id`);
    expect(res.ok).toBe(true);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.scoreId).toBe('nonexistent-id');
  });

  it('GET /quality/scoring/kpi 读 store', async () => {
    const res = await fetch(`${API_BASE}/quality/scoring/kpi`);
    expect(res.ok).toBe(true);
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
    expect(putRes.ok).toBe(true);
    const putJson: any = await putRes.json();
    expect(putJson.data.id).toBe('default');
    expect(putJson.data.publishBlockThreshold).toBe(65);

    const getRes = await fetch(`${API_BASE}/quality/scoring/threshold-config`);
    expect(getRes.ok).toBe(true);
    const getJson: any = await getRes.json();
    expect(getJson.data.publishBlockThreshold).toBe(65);
    expect(getJson.data.version).toBe(6);
  });
});
