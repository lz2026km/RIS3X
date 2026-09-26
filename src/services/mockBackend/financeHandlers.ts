// [v3.0.6.11-7] /api/v1/finance MSW handlers
import { http, HttpResponse, delay } from 'msw';
import { list, get, create } from './store';
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
    try { items = list<any>('chargeItems'); } catch {}
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
    if (!items.length) items = [
      { id: 'INV001', invoiceNo: 'INV-001', patientId: 'P000001', patientName: '张明远', examItem: '头颅CT平扫', examDate: '2026-06-02', totalAmount: 300, paidAmount: 300, balance: 0, status: 'PAID', insuranceCovered: 210, selfPayAmount: 90, createdAt: '2026-06-02 16:00' },
      { id: 'INV002', invoiceNo: 'INV-002', patientId: 'P000002', patientName: '李静', examItem: '胸部CT增强', examDate: '2026-06-05', totalAmount: 850, paidAmount: 500, balance: 350, status: 'PARTIAL', insuranceCovered: 595, selfPayAmount: 255, createdAt: '2026-06-05 10:30' },
      { id: 'INV003', invoiceNo: 'INV-003', patientId: 'P000003', patientName: '王强', examItem: '腰椎MR平扫', examDate: '2026-06-08', totalAmount: 780, paidAmount: 0, balance: 780, status: 'UNPAID', insuranceCovered: 546, selfPayAmount: 234, createdAt: '2026-06-08 09:15' },
      { id: 'INV004', invoiceNo: 'INV-004', patientId: 'P043853', patientName: '叶琳', examItem: '腹部CT平扫+增强', examDate: '2026-06-11', totalAmount: 1200, paidAmount: 1200, balance: 0, status: 'PAID', insuranceCovered: 840, selfPayAmount: 360, createdAt: '2026-06-11 14:20' },
      { id: 'INV005', invoiceNo: 'INV-005', patientId: 'P001193', patientName: '何俊', examItem: '头颅MR增强', examDate: '2026-06-12', totalAmount: 1080, paidAmount: 0, balance: 1080, status: 'UNPAID', insuranceCovered: 756, selfPayAmount: 324, createdAt: '2026-06-12 08:45' },
    ];
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
    if (!Array.isArray(items) || !items.length) {
      return HttpResponse.json({ success: true, data: { daily: [{ date: '2026-07-01', amount: 45000 }], monthly: [{ month: '2026-07', amount: 980000 }] }, meta: { total: 2 } });
    }
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/cost-accounting`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: { byDept: [{ dept: '放射科', cost: 320000, revenue: 480000 }], byModality: [{ modality: 'CT', cost: 120000, revenue: 180000 }], totalCost: 620000, totalRevenue: 980000 }, meta: { total: 2 } });
  }),
  http.get(`${API}/financial-reports`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('invoices'); } catch {}
    if (!Array.isArray(items) || !items.length) {
      return HttpResponse.json({ success: true, data: { reports: [{ id: 'FR001', type: '月度', period: '2026-07', totalRevenue: 980000 }] }, meta: { total: 1 } });
    }
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
];
