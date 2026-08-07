// [v3.0.6.11-79] /api/v1/orchestrator MSW handlers — 流程编排（对齐后端 orchestrator.controller）
import { http, HttpResponse, delay } from 'msw';
import { parseQuery, applyQuery } from './queryBuilder';

const API = '/api/v1/orchestrator';

let flows: any[] = [
  { id: 'FLOW-001', name: '报告书写流程', description: '书写→审核→签署→发布', active: true, steps: [{ id: 's1', name: '书写', type: 'write' }, { id: 's2', name: '审核', type: 'review' }], createdAt: '2026-07-01T08:00:00Z', updatedAt: '2026-07-20T08:00:00Z' },
  { id: 'FLOW-002', name: '危急值通知流程', description: '触发→通知→回执→闭环', active: true, steps: [{ id: 's1', name: '通知', type: 'notify' }], createdAt: '2026-07-05T08:00:00Z', updatedAt: '2026-07-22T08:00:00Z' },
];

let executions: any[] = [
  { id: 'EXE-001', flowId: 'FLOW-001', flowName: '报告书写流程', status: 'completed', startedAt: '2026-07-25T09:00:00Z', completedAt: '2026-07-25T09:35:00Z', currentStep: '发布', slaBreached: false },
  { id: 'EXE-002', flowId: 'FLOW-002', flowName: '危急值通知流程', status: 'running', startedAt: '2026-07-26T10:00:00Z', completedAt: null, currentStep: '回执', slaBreached: false },
];

const delayMs = (min = 30, max = 100) => Math.floor(Math.random() * (max - min) + min);

export const orchestratorHandlers = [
  http.get(`${API}/flows`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const result = applyQuery(flows, opts, ['name', 'description']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/flow/:id`, async ({ params }) => {
    await delay(delayMs());
    const found = flows.find((f) => f.id === params.id);
    return HttpResponse.json({ success: true, data: found ?? null });
  }),
  http.post(`${API}/flow`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const item = { id: body.id || `FLOW-${Date.now()}`, ...body, active: body.active ?? false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    flows = [item, ...flows];
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
  http.post(`${API}/flow/:id/trigger`, async ({ params }) => {
    await delay(delayMs());
    const exe = { id: `EXE-${Date.now()}`, flowId: params.id, flowName: '触发流程', status: 'running', startedAt: new Date().toISOString(), completedAt: null, currentStep: '开始', slaBreached: false };
    executions = [exe, ...executions];
    return HttpResponse.json({ success: true, data: exe }, { status: 201 });
  }),
  http.post(`${API}/flow/:id/next`, async ({ params }) => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'completed', completedAt: new Date().toISOString() } });
  }),
  http.get(`${API}/executions`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const result = applyQuery(executions, opts, ['flowName', 'status']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/sla`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: [{ id: 'SLA-1', name: '报告完成 SLA', thresholdMinutes: 240, active: true }, { id: 'SLA-2', name: '危急值响应 SLA', thresholdMinutes: 30, active: true }] });
  }),
  http.get(`${API}/sla/stats`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: { totalExecutions: 20, breachedExecutions: 2, slaComplianceRate: 90, avgCompletionMin: 45.6, totalSteps: 40, breachedSteps: 4 } });
  }),
];
