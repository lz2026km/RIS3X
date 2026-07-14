// [v3.0.6.11-7] /api/v1/critical MSW handlers
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/critical';

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
];
