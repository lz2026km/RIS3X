// [v3.0.6.11-7] /api/v1/dental MSW handlers
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/dental';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

export const dentalNewHandlers = [
  http.get(`${API}/implants`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('dental_treatments'); } catch {}
    if (!items.length) items = [{"id":"IMP001","patientId":"P001","toothNumber":"16","implantBrand":"Straumann","implantModel":"BLT","diameter":4.1,"length":10,"status":"PLANNED"},{"id":"IMP002","patientId":"P001","toothNumber":"17","implantBrand":"Nobel Biocare","implantModel":"Active","diameter":3.75,"length":11.5,"status":"SURGERY_DONE"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/implants`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('dental_treatments', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.put(`${API}/implants/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    try { update('dental_treatments', params.id as string, body); } catch {}
    return HttpResponse.json({ success: true, data: { id: params.id, ...body } });
  }),
  http.get(`${API}/appointments`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('dental_appointments'); } catch {}
    if (!items.length) items = [{"id":"DA001","patientId":"P001","dentistName":"李医生","modality":"检查","scheduledAt":"2026-07-10T09:00","state":"SCHEDULED"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/appointments`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('dental_appointments', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/invoices`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('invoices'); } catch {}
    if (!items.length) items = [{"id":"DI001","patientId":"P001","invoiceNumber":"INV-2026-001","totalAmount":3500,"status":"UNPAID"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/invoices`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('invoices', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/inventory`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('dental_treatments'); } catch {}
    if (!items.length) items = [{"id":"DINV001","code":"MAT-001","name":"种植体","category":"材料","quantity":50,"unit":"件","unitPrice":800}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/inventory`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('dental_treatments', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.put(`${API}/inventory/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    try { update('dental_treatments', params.id as string, body); } catch {}
    return HttpResponse.json({ success: true, data: { id: params.id, ...body } });
  }),
];
