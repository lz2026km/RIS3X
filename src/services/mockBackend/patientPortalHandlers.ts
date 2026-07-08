// [v3.0.6.11-7] /api/v1/patient-portal MSW handlers
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/patient-portal';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

export const patientPortalHandlers = [
  http.get(`${API}/patients`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('patients'); } catch {}
    if (!items.length) items = [{"id":"P001","name":"张三","phone":"13800138000"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/patients/:id`, async ({ params }) => {
    await delay(delayMs());
    let item: any = null;
    try { item = get<any>('patient', params.id as string); } catch {}
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.get(`${API}/clinical-data`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('data'); } catch {}
    if (!items.length) items = [{"id":"CD001","patientId":"P001","type":"化验","value":"正常"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/education`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('materials'); } catch {}
    if (!items.length) items = [{"id":"ED001","title":"CT检查注意事项","category":"检查准备"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/mobile/patients`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('null'); } catch {}
    if (!items.length) items = {"appVersion":"2.1.0","features":["预约","查询报告"]};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/mobile/doctors`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('null'); } catch {}
    if (!items.length) items = {"appVersion":"2.1.0","features":["移动阅片","审批"]};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
];
