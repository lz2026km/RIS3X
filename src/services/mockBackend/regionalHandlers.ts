// [v3.0.6.11-7] /api/v1/regional MSW handlers
import { http, HttpResponse, delay } from 'msw';
import { list, get, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/regional';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

export const regionalHandlers = [
  http.get(`${API}/imaging`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('studies'); } catch {}
    if (!items.length) items = [{"id":"RI001","patientName":"李四","modality":"CT","sourceDept":"分院1"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/schedule`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('schedule'); } catch {}
    if (!items.length) items = [{"id":"SCH001","department":"放射科","date":"2026-07-08","total":120}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/departments`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('departments'); } catch {}
    if (!items.length) items = [{"id":"DEPT001","name":"放射科","type":"医技","region":"本院"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/medical-alliance`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('alliances'); } catch {}
    if (!items.length) items = [{"id":"MA001","name":"医联体1","status":"ACTIVE"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/integration/fhir`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('null'); } catch {}
    if (!items.length) items = {"status":"CONNECTED","lastSync":"2026-07-08T10:00"};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/integration/mllp`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('null'); } catch {}
    if (!items.length) items = {"status":"ACTIVE","messages24h":1240};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
];
