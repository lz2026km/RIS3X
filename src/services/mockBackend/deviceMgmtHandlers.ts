// [v3.0.6.11-7] /api/v1/device-mgmt MSW handlers
// [G005 P1] 补齐缺口: getEquipmentLifecycle/:id / getDevice/:id / update* / recordDose /
//           contrast/injection / contrast/quality / 设备 CRUD (device-mgmt 根路径)
import { http, HttpResponse, delay } from 'msw';
import { list, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/device-mgmt';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

const FALLBACK_LIFECYCLE = [
  { id: 'EL001', name: 'CT 1号机', model: 'uCT 780', serialNumber: 'SN-CT-001', manufacturer: '联影', location: '1号检查室', status: 'ACTIVE', purchaseDate: '2020-01-01', installationDate: '2020-03-01', warrantyExpiry: '2025-03-01', lastMaintenanceDate: '2026-06-15', nextMaintenanceDate: '2026-09-15', totalCost: 1200000, maintenanceCost: 58000 },
  { id: 'EL002', name: 'MR 1号机', model: 'uMR 790', serialNumber: 'SN-MR-001', manufacturer: '联影', location: '2号检查室', status: 'MAINTENANCE', purchaseDate: '2021-06-01', installationDate: '2021-08-01', warrantyExpiry: '2026-08-01', lastMaintenanceDate: '2026-07-20', nextMaintenanceDate: '2026-08-20', totalCost: 2800000, maintenanceCost: 96000 },
  { id: 'EL003', name: 'DR 1号机', model: 'uDR 760i', serialNumber: 'SN-DR-001', manufacturer: '联影', location: '3号检查室', status: 'RETIRED', purchaseDate: '2012-05-01', installationDate: '2012-06-01', warrantyExpiry: '2015-06-01', lastMaintenanceDate: '2024-12-01', nextMaintenanceDate: null, totalCost: 350000, maintenanceCost: 12000 },
];

const FALLBACK_DEVICES = [
  { id: 'DEV001', code: 'CT-01', name: 'CT 1号机', modality: 'CT', manufacturer: '联影', location: '1号检查室', state: 'IN_USE' },
  { id: 'DEV002', code: 'MR-01', name: 'MR 1号机', modality: 'MR', manufacturer: '联影', location: '2号检查室', state: 'MAINTENANCE' },
  { id: 'DEV003', code: 'DR-01', name: 'DR 1号机', modality: 'DR', manufacturer: '飞利浦', location: '3号检查室', state: 'IDLE' },
];

export const deviceMgmtHandlers = [
  http.get(`${API}/equipment-lifecycle`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('equipmentLifecycle' as any); } catch {}
    if (!items.length) items = FALLBACK_LIFECYCLE;
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: { items: result.data, total: result.total } });
  }),

  http.get(`${API}/equipment-lifecycle/:id`, async ({ params }) => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('equipmentLifecycle' as any); } catch {}
    if (!items.length) items = FALLBACK_LIFECYCLE;
    const found = items.find((i) => i.id === params.id) ?? items[0];
    return HttpResponse.json({ success: true, data: found });
  }),

  http.put(`${API}/equipment-lifecycle/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const existing = { id: params.id, ...FALLBACK_LIFECYCLE[0] };
    const updated = { ...existing, ...body, id: params.id };
    try { update('equipmentLifecycle' as any, params.id as string, updated); } catch {}
    return HttpResponse.json({ success: true, data: updated });
  }),

  http.get(`${API}/devices`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('mgmtDevices' as any); } catch {}
    if (!items.length) items = FALLBACK_DEVICES;
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: { items: result.data, total: result.total } });
  }),

  http.get(`${API}/devices/:id`, async ({ params }) => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('mgmtDevices' as any); } catch {}
    if (!items.length) items = FALLBACK_DEVICES;
    const found = items.find((i) => i.id === params.id) ?? items[0];
    return HttpResponse.json({ success: true, data: found });
  }),

  http.put(`${API}/devices/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const existing = { id: params.id, ...FALLBACK_DEVICES[0] };
    const updated = { ...existing, ...body, id: params.id };
    try { update('mgmtDevices' as any, params.id as string, updated); } catch {}
    return HttpResponse.json({ success: true, data: updated });
  }),

  http.get(`${API}/faults`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('faults' as any); } catch {}
    if (!items.length) items = [{"id":"FA001","deviceId":"DEV001","description":"软件死机","severity":"MINOR","status":"RESOLVED"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: { items: result.data, total: result.total } });
  }),
  http.post(`${API}/faults`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('devices', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/materials`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('materials' as any); } catch {}
    if (!items.length) items = [{"id":"MAT001","code":"MAT-001","name":"一次性针筒","quantity":200,"unit":"支"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: { items: result.data, total: result.total } });
  }),
  http.post(`${API}/materials`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('materials' as any, newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/dose-tracking`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('doseRecords' as any); } catch {}
    if (!items.length) items = [
      { id: 'DOSE-001', patientId: 'P000001', deviceId: 'DEV001', doseValue: 450, doseUnit: 'mGy·cm', examType: 'CT胸部平扫', recordedAt: '2026-08-01T09:30:00Z' },
      { id: 'DOSE-002', patientId: 'P000002', deviceId: 'DEV001', doseValue: 620, doseUnit: 'mGy·cm', examType: 'CT腹部增强', recordedAt: '2026-08-01T10:15:00Z' },
    ];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: { items: result.data, total: result.total } });
  }),
  http.post(`${API}/dose-tracking`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, recordedAt: body.recordedAt ?? new Date().toISOString() };
    try { create('doseRecords' as any, newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/contrast/adverse-reactions`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('reactions' as any); } catch {}
    if (!items.length) items = [{"id":"AR001","patientName":"张三","reaction":"皮疹","severity":"MINOR"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: { items: result.data, total: result.total } });
  }),
  http.post(`${API}/contrast/adverse-reactions`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('criticalEvents', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/contrast/inventory`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('items' as any); } catch {}
    if (!items.length) items = [{"id":"CI001","name":"碘海醇","volume":500,"unit":"ml","quantity":30}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: { items: result.data, total: result.total } });
  }),
  http.put(`${API}/contrast/inventory/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const updated = { id: params.id, ...body };
    try { update('items' as any, params.id as string, updated); } catch {}
    return HttpResponse.json({ success: true, data: updated });
  }),
  // [G005 P1] 缺口补齐: contrast/injection + contrast/quality
  http.get(`${API}/contrast/injection`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: { id: 'INJ-001', name: '高压注射器 1号', status: 'READY', lastCalibration: '2026-06-01' },
    });
  }),
  http.get(`${API}/contrast/quality`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('contrastQuality' as any); } catch {}
    if (!items.length) items = [
      { id: 'CQ-001', contrastType: '碘海醇 350', batchNo: 'B20260601', qualityStatus: 'PASS', expiryDate: '2027-06-01' },
      { id: 'CQ-002', contrastType: '碘帕醇 370', batchNo: 'B20260610', qualityStatus: 'PENDING', expiryDate: '2027-06-10' },
    ];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: { items: result.data, total: result.total } });
  }),
  // [G005 P1] 缺口补齐: 设备 CRUD 根路径 (device.controller @Controller('device-mgmt'))
  http.get(`${API}`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('mgmtDevices' as any); } catch {}
    if (!items.length) items = FALLBACK_DEVICES;
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: { items: result.data, total: result.total } });
  }),
  http.get(`${API}/:id`, async ({ params }) => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('mgmtDevices' as any); } catch {}
    if (!items.length) items = FALLBACK_DEVICES;
    const found = items.find((i) => i.id === params.id) ?? items[0];
    return HttpResponse.json({ success: true, data: found });
  }),
  http.post(`${API}`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || `DEV-${Date.now()}`, ...body, state: body.state ?? 'IDLE' };
    try { create('mgmtDevices' as any, newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.patch(`${API}/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const existing = { id: params.id, ...FALLBACK_DEVICES[0] };
    const updated = { ...existing, ...body, id: params.id };
    try { update('mgmtDevices' as any, params.id as string, updated); } catch {}
    return HttpResponse.json({ success: true, data: updated });
  }),
  http.delete(`${API}/:id`, async ({ params }) => {
    await delay(delayMs());
    try { remove('mgmtDevices' as any, params.id as string); } catch {}
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`${API}/:id/stats`, async ({ params }) => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        deviceId: params.id,
        todayExams: 24,
        monthlyExams: 486,
        utilization: 78.5,
        uptime: '99.2%',
        avgDowntimeHours: 3.2,
      },
    });
  }),
];
