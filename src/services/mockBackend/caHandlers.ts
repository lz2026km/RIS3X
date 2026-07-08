// [v3.0.6.11-7] /api/v1/ca MSW handlers
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/ca';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

export const caHandlers = [
  http.get(`${API}/certificates`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('certificates'); } catch {}
    if (!items.length) items = [{"id":"CERT001","subject":"放射科CA","issuer":"国家CA","validFrom":"2025-01-01","validTo":"2027-01-01"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/certificates`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('certificate', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.post(`${API}/sign`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('null', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/signatures`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('signatures'); } catch {}
    if (!items.length) items = [{"id":"SIG001","documentType":"报告","signer":"张主任","signedAt":"2026-07-08T10:00"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${API}/verify`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('null', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/config`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('null'); } catch {}
    if (!items.length) items = {"provider":"内部CA","algorithm":"SHA256withRSA"};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
];
