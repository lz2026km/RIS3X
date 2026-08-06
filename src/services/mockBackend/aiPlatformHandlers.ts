// [v3.0.6.11-7] /api/v1/ai-platform MSW handlers
import { http, HttpResponse, delay } from 'msw';
import { list, get, create } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/ai-platform';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

export const aiPlatformHandlers = [
  http.get(`${API}/models`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('models'); } catch {}
    if (!items.length) items = [{"id":"AI001","name":"肺结节检测","version":"2.3","status":"DEPLOYED","accuracy":96.5}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/models/:id`, async ({ params }) => {
    await delay(delayMs());
    let item: any = null;
    try { item = get<any>('model', params.id as string); } catch {}
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.get(`${API}/qc`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('results'); } catch {}
    if (!items.length) items = [{"id":"AIQC001","patientName":"张三","aiScore":95,"humanScore":93}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/qc/:id`, async ({ params }) => {
    await delay(delayMs());
    const id = String(params.id ?? '');
    const fallback = [{ "id": "AIQC001", "patientName": "张三", "aiScore": 95, "humanScore": 93 }];
    const item = fallback.find((r) => r.id === id) ?? { id, patientName: '未知患者', aiScore: 0, humanScore: 0, notFound: true };
    return HttpResponse.json({ success: true, data: item });
  }),
  http.get(`${API}/medical-devices`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('devices'); } catch {}
    return HttpResponse.json({ success: true, data: items });
  }),
  http.get(`${API}/structured-reports`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('reports'); } catch {}
    if (!items.length) items = [{"id":"AISR001","patientName":"张三","status":"COMPLETED","createdAt":"2026-07-08"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/structured-reports`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('report', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/orchestration`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('null'); } catch {}
    if (!items.length) items = {"pipelines":[],"activeCount":3};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/fusion`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('null'); } catch {}
    if (!items.length) items = {"modalities":["CT","MRI","PET"],"activeSessions":[]};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/marketplace`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('null'); } catch {}
    if (!items.length) items = {"apps":[{"id":"APP001","name":"AI肺结节","vendor":"DeepHealth","price":50000}]};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
];
