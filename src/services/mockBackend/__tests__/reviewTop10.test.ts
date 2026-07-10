/**
 * Agent-B.2 smoke test: v3ReviewHandlers top-10 store I/O
 * 验证 10 个高频路由通过 store 读写:
 *   1. GET  /reviews/ai-hint/:reportId
 *   2. POST /reviews/ai-hint/:reportId/trigger
 *   3. GET  /reviews/:id/history
 *   4. GET  /reviews/:id/comments
 *   5. POST /reviews/:id/comments
 *   6. GET  /reviews/workload
 *   7. GET  /reviews/kpi/personal
 *   8. GET  /reviews/sla
 *   9. GET  /reviews/reviewers
 *  10. GET  /reviews/reject-templates
 *   + PUT /reviews/sla-config (write)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  initStore, list, get, create, update, stats, resetStore,
} from '../store';

describe('v3ReviewHandlers top-10 store seed', () => {
  beforeAll(async () => {
    await resetStore();
    await initStore();
  });

  it('seeds review_ai_hints (>=2)', () => {
    const arr = list<any>('review_ai_hints');
    expect(arr.length).toBeGreaterThanOrEqual(2);
    expect(arr[0]).toHaveProperty('reportId');
    expect(arr[0]).toHaveProperty('suggestedScore');
  });

  it('seeds review_reviewers (>=6)', () => {
    const arr = list<any>('review_reviewers');
    expect(arr.length).toBeGreaterThanOrEqual(6);
    expect(arr[0]).toHaveProperty('name');
    expect(arr[0]).toHaveProperty('title');
  });

  it('seeds review_reject_templates (>=8)', () => {
    const arr = list<any>('review_reject_templates');
    expect(arr.length).toBeGreaterThanOrEqual(8);
    expect(arr[0]).toHaveProperty('category');
  });

  it('seeds review_comments (>=5)', () => {
    const arr = list<any>('review_comments');
    expect(arr.length).toBeGreaterThanOrEqual(5);
    expect(arr[0]).toHaveProperty('taskId');
  });

  it('seeds review_workloads (>=6)', () => {
    const arr = list<any>('review_workloads');
    expect(arr.length).toBeGreaterThanOrEqual(6);
    expect(arr[0]).toHaveProperty('reviewerId');
  });

  it('seeds review_kpi_personal as current snapshot', () => {
    const item = get<any>('review_kpi_personal', 'current');
    expect(item).toBeDefined();
    expect(item).toHaveProperty('totalToday');
  });

  it('seeds review_sla as current snapshot', () => {
    const item = get<any>('review_sla', 'current');
    expect(item).toBeDefined();
    expect(item).toHaveProperty('initialReviewSLA');
  });

  it('seeds review_sla_config as default snapshot', () => {
    const item = get<any>('review_sla_config', 'default');
    expect(item).toBeDefined();
    expect(item).toHaveProperty('initialReviewSLA');
  });

  it('seeds review_assignments (>=3)', () => {
    const arr = list<any>('review_assignments');
    expect(arr.length).toBeGreaterThanOrEqual(3);
    expect(arr[0]).toHaveProperty('taskId');
  });
});

describe('v3ReviewHandlers top-10 write/read round-trip', () => {
  beforeAll(async () => {
    await resetStore();
    await initStore();
  });

  it('create AI hint then read via list', () => {
    const id = 'ai-rt-' + Date.now();
    const item = {
      id, reportId: 'RP-RT-001', suggestedScore: 80, confidence: 0.9,
      riskLevel: 'low', consistencyScore: 0.95, completenessScore: 0.95,
      terminologyScore: 0.95, criticalFindingDetected: false,
      defects: [], suggestions: ['ok'], generatedAt: new Date().toISOString(),
      modelVersion: 'v2.3.1',
    };
    create('review_ai_hints', item);
    const got = get<any>('review_ai_hints', id);
    expect(got?.reportId).toBe('RP-RT-001');
  });

  it('create review comment then list filters by taskId', () => {
    const taskId = 'rt-rt-' + Date.now();
    const item = {
      id: 'cmt-rt-' + Date.now(),
      taskId, reportId: 'R-1', authorId: 'D001', authorName: 'test',
      content: 'hi', resolved: false, createdAt: new Date().toISOString(),
    };
    create('review_comments', item);
    const all = list<any>('review_comments').filter(c => c.taskId === taskId);
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(all[0].content).toBe('hi');
  });

  it('update sla-config persists', () => {
    const item = {
      id: 'default',
      initialReviewSLA: 6, finalReviewSLA: 3, signSLA: 1,
      cosignSLA: 2, escalateSLA: 0.5, updatedAt: new Date().toISOString(),
    };
    update('review_sla_config', 'default', item);
    const got = get<any>('review_sla_config', 'default');
    expect(got?.initialReviewSLA).toBe(6);
  });

  it('reject-template create round-trip', () => {
    const item = {
      id: 'rt-rt-' + Date.now(),
      category: 'test-cat', title: 'test', presetComment: 'p',
      requiredMinLength: 5, isSystem: false,
    };
    create('review_reject_templates', item);
    const got = get<any>('review_reject_templates', item.id);
    expect(got?.title).toBe('test');
  });

  it('all 10 review collections registered', () => {
    const s = stats();
    expect(s).toHaveProperty('review_ai_hints');
    expect(s).toHaveProperty('review_history');
    expect(s).toHaveProperty('review_comments');
    expect(s).toHaveProperty('review_workloads');
    expect(s).toHaveProperty('review_kpi_personal');
    expect(s).toHaveProperty('review_sla');
    expect(s).toHaveProperty('review_sla_config');
    expect(s).toHaveProperty('review_reviewers');
    expect(s).toHaveProperty('review_reject_templates');
    expect(s).toHaveProperty('review_assignments');
    expect(s.review_ai_hints).toBeGreaterThan(0);
    expect(s.review_reviewers).toBeGreaterThan(0);
  });
});