// [v3.0.6.11-7] /api/v1/criticals MSW handlers
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/criticals';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

export const criticalExtHandlers = [
  http.get(`${API}/rules`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('criticalRules'); } catch {}
    if (!items.length) items = [{"id":"CR001","name":"危急值规则1","condition":"WBC>30","severity":"URGENT"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/rules`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('criticalRules', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.delete(`${API}/rules/:id`, async ({ params }) => {
    await delay(delayMs());
    try { remove('criticalRules', params.id as string); } catch {}
    return HttpResponse.json({ success: true, data: {} });
  }),
  http.get(`${API}/stats`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('criticalRules'); } catch {}
    if (!items.length) items = {"total":45,"pending":3,"avgCloseTime":28};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/stats/summary`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('criticalRules'); } catch {}
    if (!items.length) items = {"bySeverity":{"URGENT":5,"HIGH":30,"LOW":10},"byDepartment":{}};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/stats/timeline`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('criticalRules'); } catch {}
    if (!items.length) items = {"timeline":[{"date":"2026-07-01","count":3}]};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/center`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('criticalEvents'); } catch {}
    if (!items.length) items = [{"id":"CC001","patientName":"赵六","finding":"颅内出血","status":"ACKNOWLEDGED"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/auto-detect`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('criticalRules', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.post(`${API}/close-loop`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('criticalRules', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),

  // voice-call bridge
  http.post(`${API}/:criticalId/voice-call`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.criticalId, voiceCalledBy: body.calledBy, voiceCalledAt: new Date().toISOString() }, meta: {} });
  }),

  // clinical receipt
  http.post(`${API}/:criticalId/clinical-receipt`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.criticalId, confirmedBy: body.confirmedBy, confirmedAt: body.confirmedAt || new Date().toISOString() }, meta: {} });
  }),

  // ---- 基础 CRUD（对齐后端 criticals.controller.ts @Controller('criticals')）----
  http.get(`${API}`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('criticalEvents'); } catch {}
    if (!items.length) {
      items = [
        { id: 'CV001', patientName: '张明远', finding: '颅内出血', severity: 'critical', status: 'pending', modality: 'CT', deviceName: 'CT-01', triggeredAt: new Date().toISOString() },
        { id: 'CV002', patientName: '李静', finding: '主动脉夹层', severity: 'urgent', status: 'notified', modality: 'CT', deviceName: 'CT-02', triggeredAt: new Date().toISOString(), notifiedAt: new Date().toISOString() },
        { id: 'CV003', patientName: '王强', finding: '急性心肌梗死', severity: 'high', status: 'acknowledged', modality: 'MR', deviceName: 'MR-01', triggeredAt: new Date().toISOString(), notifiedAt: new Date().toISOString() },
      ];
    }
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/stats/missed`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: { missed: 2, missedRate: 0.066, total: 30, bySeverity: { critical: 1, urgent: 1 } } });
  }),
  http.get(`${API}/stats/notification`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: { notified: 25, pending: 3, avgResponseMin: 6.5, byMethod: { SYSTEM: 15, SMS: 8, PHONE: 2 } } });
  }),
  http.get(`${API}/:id`, async ({ params }) => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('criticalEvents'); } catch {}
    const found = items.find((i) => i.id === params.id);
    return HttpResponse.json({ success: true, data: found ?? { id: params.id, patientName: '未知', finding: '未知', severity: 'critical', status: 'pending', modality: 'CT', triggeredAt: new Date().toISOString() } });
  }),
  http.post(`${API}`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, severity: body.severity ?? 'critical', status: body.status ?? 'pending', triggeredAt: body.triggeredAt || new Date().toISOString() };
    try { create('criticalEvents', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.patch(`${API}/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    let items: any[] = [];
    try { items = list<any>('criticalEvents'); } catch {}
    const existing = items.find((i) => i.id === params.id) ?? { id: params.id };
    const updated = { ...existing, ...body };
    try { update('criticalEvents', updated); } catch {}
    return HttpResponse.json({ success: true, data: updated });
  }),
  http.delete(`${API}/:id`, async ({ params }) => {
    await delay(delayMs());
    try { remove('criticalEvents', params.id as string); } catch {}
    return HttpResponse.json({ success: true, data: {} });
  }),
  http.post(`${API}/:id/escalation-chain`, async ({ params }) => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: { id: params.id, chain: ['值班医生', '科主任', '医务处'], escalated: true } });
  }),
  http.get(`${API}/:criticalId/history`, async ({ params }) => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: [
      { id: 'H1', criticalId: params.criticalId, action: 'REPORTED', by: '放射技师', at: new Date().toISOString() },
      { id: 'H2', criticalId: params.criticalId, action: 'NOTIFIED', by: '值班医生', at: new Date().toISOString() },
    ] });
  }),
  http.post(`${API}/notify`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: body.id ?? 'CV001', status: 'notified', notifiedAt: new Date().toISOString() } });
  }),
  http.post(`${API}/escalate`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: body.id ?? 'CV001', status: 'escalated', escalatedAt: new Date().toISOString(), escalatedTo: body.to } });
  }),
];
