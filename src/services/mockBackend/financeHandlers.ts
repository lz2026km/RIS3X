// [v3.0.6.11-7] /api/v1/finance MSW handlers
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/finance';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

export const financeHandlers = [
  http.get(`${API}/charge-items`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('items'); } catch {}
    if (!items.length) items = [{"id":"CI001","code":"CHG-001","name":"CT平扫","category":"检查","unitPrice":300,"active":true}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/charge-items`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('invoices', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/invoices`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('invoices'); } catch {}
    if (!items.length) items = [{"id":"INV001","patientId":"P001","invoiceNumber":"INV-001","totalAmount":1200,"status":"UNPAID"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/invoices/:id`, async ({ params }) => {
    await delay(delayMs());
    let item: any = null;
    try { item = get<any>('invoices', params.id as string); } catch {}
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.post(`${API}/invoices`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('invoices', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.post(`${API}/invoices/:id/pay`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('invoices', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/revenue-analysis`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('invoices'); } catch {}
    if (!items.length) items = {"daily":[{"date":"2026-07-01","amount":45000}],"monthly":[{"month":"2026-07","amount":980000}]};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/financial-reports`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('invoices'); } catch {}
    if (!items.length) items = {"reports":[{"id":"FR001","type":"月度","period":"2026-07","totalRevenue":980000}]};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
];
