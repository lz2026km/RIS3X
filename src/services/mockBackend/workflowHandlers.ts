// [v3.0.6.11-7] /api/v1/workflow MSW handlers
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/workflow';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

export const workflowHandlers = [
  http.get(`${API}/definitions`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('definitions'); } catch {}
    if (!items.length) items = [{"id":"WF001","name":"报告审核流程","description":"标准三级审核","version":1,"active":true}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/definitions`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('definition', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/definitions/:id`, async ({ params }) => {
    await delay(delayMs());
    let item: any = null;
    try { item = get<any>('definition', params.id as string); } catch {}
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.delete(`${API}/definitions/:id`, async ({ params }) => {
    await delay(delayMs());
    try { remove('null', params.id as string); } catch {}
    return HttpResponse.json({ success: true, data: {} });
  }),
  http.put(`${API}/definitions/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const merged = { id: params.id, ...body, updatedAt: new Date().toISOString() };
    try { create('definition' as any, merged); } catch {}
    return HttpResponse.json({ success: true, data: merged });
  }),
  http.post(`${API}/definitions/:id/activate`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('null', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/definitions/:id/steps`, async ({ params }) => {
    await delay(delayMs());
    let item: any = null;
    try { item = get<any>('steps', params.id as string); } catch {}
    if (!item) {
      item = [
        { id: 'step-1', name: '书写', type: 'write', order: 1 },
        { id: 'step-2', name: '审核', type: 'review', order: 2 },
        { id: 'step-3', name: '签署', type: 'sign', order: 3 },
        { id: 'step-4', name: '发布', type: 'publish', order: 4 },
      ];
      try { create('steps' as any, { id: params.id as string, steps: item }); } catch {}
    }
    return HttpResponse.json({ success: true, data: Array.isArray(item) ? item : (item.steps ?? []) });
  }),
  http.get(`${API}/sla-policies`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('policies'); } catch {}
    if (!items.length) items = [{"id":"SLA001","name":"常规报告","modality":"CT","targetMinutes":120,"warningMinutes":90}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/sla-policies`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('policy', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.delete(`${API}/sla-policies/:id`, async ({ params }) => {
    await delay(delayMs());
    try { remove('policy' as any, params.id as string); } catch {}
    return HttpResponse.json({ success: true, data: {} });
  }),
  http.get(`${API}/routing-rules`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('rules'); } catch {}
    if (!items.length) items = [{"id":"RR001","name":"急诊CT","modality":"CT","targetDept":"急诊科","priority":1}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/routing-rules`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('rule', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.put(`${API}/routing-rules/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const merged = { id: params.id, ...body, updatedAt: new Date().toISOString() };
    try { create('rule' as any, merged); } catch {}
    return HttpResponse.json({ success: true, data: merged });
  }),
  http.put(`${API}/sla-policies/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const merged = { id: params.id, ...body, updatedAt: new Date().toISOString() };
    try { create('policy' as any, merged); } catch {}
    return HttpResponse.json({ success: true, data: merged });
  }),
];
