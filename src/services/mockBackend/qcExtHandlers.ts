// [v3.0.6.11-7] /api/v1/qc MSW handlers
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/qc';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

export const qcExtHandlers = [
  http.get(`${API}/dashboard`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('null'); } catch {}
    if (!items.length) items = {"totalImages":1240,"pendingReview":89,"passRate":94.5,"avgScore":92};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/image`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('images'); } catch {}
    if (!items.length) items = [{"id":"IMG001","patientName":"张三","modality":"CT","score":95,"status":"PASSED"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/radiologist-annual`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('items'); } catch {}
    if (!items.length) items = [{"id":"RA001","name":"李医生","total":1200,"avgScore":93}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/defect`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('defects'); } catch {}
    if (!items.length) items = [{"id":"DEF001","type":"图像质量","description":"运动伪影","severity":"MINOR"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/defect`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('defect', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/stats`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('null'); } catch {}
    if (!items.length) items = {"byMonth":[{"month":"2026-07","total":320,"passed":302}]};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
];
