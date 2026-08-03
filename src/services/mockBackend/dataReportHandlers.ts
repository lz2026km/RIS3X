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
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    if (!q) return HttpResponse.json({ success: true, data: [], meta: { total: 0 } });
    let patients: any[] = [];
    let exams: any[] = [];
    try { patients = list<any>('patients') || []; } catch {}
    try { exams = list<any>('exams') || []; } catch {}
    const out: any[] = [];
    for (const p of patients.slice(0, 150)) {
      const hay = `${p.id} ${p.name} ${p.phone || ''}`.toLowerCase();
      if (!hay.includes(q)) continue;
      out.push({ id: `P-${p.id}`, title: `患者 ${p.name}`, description: `${p.gender || '-'} ${p.age ?? '-'}岁 · ${p.id} · 登记 ${p.registeredAt || '-'}`, type: '患者', score: 96 });
    }
    for (const e of exams.slice(0, 400)) {
      const hay = `${e.patientName || ''} ${e.examItem || ''} ${e.modality || ''} ${e.bodyPart || ''} ${e.reportId || ''} ${e.findings || ''} ${e.impression || ''}`.toLowerCase();
      if (!hay.includes(q)) continue;
      out.push({ id: `E-${e.id || e.reportId}`, title: `检查 ${e.examItem || '影像检查'}`, description: `${e.patientName || '-'} · ${e.modality || '-'} · ${e.examAt || '-'}`, type: '检查', score: 90 });
      out.push({ id: `R-${e.reportId || e.id}`, title: `报告 ${e.reportId || e.id}`, description: `所见：${(e.findings || '—').slice(0, 80)}`, type: '报告', score: 84 });
    }
    out.sort((a, b) => b.score - a.score);
    return HttpResponse.json({ success: true, data: out.slice(0, 100), meta: { total: out.length } });
  }),
];
