/**
 * [v3.0.6.11-70] P0 报告主流程真实化 — MSW 端点冒烟测试(临时)
 * 覆盖: GET /reports (list) → PATCH /reports/:id (保存) → POST /reports/:id/transition (提交/审核) → POST /reports/:id/export
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { server } from '../server';

const BASE = 'http://localhost:5173/api/v1';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

describe('P0 report flow endpoints', () => {
  it('GET /reports returns list', async () => {
    const res = await fetch(`${BASE}/reports`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    const first = body.data[0];
    expect(first.reportId).toBeTruthy();
    expect(first.patientName).toBeTruthy();
  });

  it('POST /reports creates a report, PATCH /reports/:id updates content', async () => {
    const createRes = await fetch(`${BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: 'p-038', examId: 'rpt-p0-test', findings: '初始所见', conclusion: '初始结论' }),
    });
    const created = await createRes.json();
    expect(created.success).toBe(true);
    const id = created.data.reportId || created.data.id;

    const patchRes = await fetch(`${BASE}/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ findings: '保存后的所见内容', conclusion: '保存后的结论' }),
    });
    const updated = await patchRes.json();
    expect(updated.success).toBe(true);
    expect(updated.data.findings).toBe('保存后的所见内容');

    const getRes = await fetch(`${BASE}/reports/${id}`);
    const got = await getRes.json();
    expect(got.data.findings).toBe('保存后的所见内容');
  });

  it('POST /reports/:id/transition moves state SUBMITTED → REVIEWED → REJECTED with reason', async () => {
    const created = await fetch(`${BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: 'p-038', examId: 'rpt-p0-transition', findings: '所见', conclusion: '结论' }),
    }).then(r => r.json());
    const id = created.data.reportId || created.data.id;

    const submit = await fetch(`${BASE}/reports/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'SUBMITTED', actorId: 'D001' }),
    });
    const submitted = await submit.json();
    expect(submitted.success).toBe(true);
    expect(submitted.data.status).toMatch(/已提交|submitted/i);

    const approve = await fetch(`${BASE}/reports/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'REVIEWED', actorId: 'D005' }),
    });
    const reviewed = await approve.json();
    expect(reviewed.success).toBe(true);
    expect(reviewed.data.status).toMatch(/已审核|reviewed/i);

    const reject = await fetch(`${BASE}/reports/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'REJECTED', actorId: 'D005', reason: '诊断描述不完整' }),
    });
    const rejected = await reject.json();
    expect(rejected.success).toBe(true);
    expect(rejected.data.rejectReason).toBe('诊断描述不完整');
  });

  it('POST /reports/:id/export queues and returns downloadUrl', async () => {
    const created = await fetch(`${BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: 'p-038', examId: 'rpt-p0-export', findings: '所见', conclusion: '结论' }),
    }).then(r => r.json());
    const id = created.data.reportId || created.data.id;

    const res = await fetch(`${BASE}/reports/${id}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'pdf' }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.queued).toBe(true);
    expect(body.data.downloadUrl).toContain(id);
  });
});
