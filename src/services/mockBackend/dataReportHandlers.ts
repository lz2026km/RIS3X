// [v3.0.6.11-7] /api/v1/data-report MSW handlers
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/data-report';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

export const dataReportHandlers = [
  http.get(`${API}/national-reports`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('reports'); } catch {}
    if (!items.length) items = [{"id":"NR001","name":"国家质控月报","period":"2026-07","status":"DRAFT"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/national-reports/:id`, async ({ params }) => {
    await delay(delayMs());
    let item: any = null;
    try { item = get<any>('report', params.id as string); } catch {}
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.get(`${API}/data-reports`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('reports'); } catch {}
    if (!items.length) items = [{"id":"DR001","name":"检查量统计","category":"统计","createdAt":"2026-07-01"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/data-reports/:id`, async ({ params }) => {
    await delay(delayMs());
    let item: any = null;
    try { item = get<any>('report', params.id as string); } catch {}
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.get(`${API}/insurance-audits`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('audits'); } catch {}
    if (!items.length) items = [{"id":"IA001","patientName":"张三","status":"PENDING","totalAmount":2500}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/enterprise-search`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('null'); } catch {}
    if (!items.length) items = {"results":[],"total":0};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
];
