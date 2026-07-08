// [v3.0.6.11-7] /api/v1/device-mgmt MSW handlers
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/device-mgmt';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

export const deviceMgmtHandlers = [
  http.get(`${API}/equipment-lifecycle`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('events'); } catch {}
    if (!items.length) items = [{"id":"EL001","deviceId":"DEV001","event":"安装","date":"2020-01-01","operator":"工程师A"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/devices`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('devices'); } catch {}
    if (!items.length) items = [{"id":"DEV001","code":"CT-01","name":"CT 1号机","modality":"CT","state":"IN_USE","location":"1号检查室"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/faults`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('faults'); } catch {}
    if (!items.length) items = [{"id":"FA001","deviceId":"DEV001","description":"软件死机","severity":"MINOR","status":"RESOLVED"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/faults`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('fault', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/materials`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('materials'); } catch {}
    if (!items.length) items = [{"id":"MAT001","code":"MAT-001","name":"一次性针筒","quantity":200,"unit":"支"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/materials`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('material', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/dose-tracking`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('null'); } catch {}
    if (!items.length) items = {"patients":[],"totalExams":1240,"avgDlp":450,"exceeded":5};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/contrast/adverse-reactions`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('reactions'); } catch {}
    if (!items.length) items = [{"id":"AR001","patientName":"张三","reaction":"皮疹","severity":"MINOR"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/contrast/adverse-reactions`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('reaction', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/contrast/inventory`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('items'); } catch {}
    if (!items.length) items = [{"id":"CI001","name":"碘海醇","volume":500,"unit":"ml","quantity":30}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
];
