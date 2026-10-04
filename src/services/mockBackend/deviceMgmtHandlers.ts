// [v3.0.6.11-7] /api/v1/device-mgmt MSW handlers
// [G005 P1] 补齐缺口: getEquipmentLifecycle/:id / getDevice/:id / update* / recordDose /
//           contrast/injection / contrast/quality / 设备 CRUD (device-mgmt 根路径)
import { http, HttpResponse, delay } from 'msw';
import { list, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5191/api/v1');

const API = `${API_BASE}/device-mgmt`;

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

  // [v3.0.6.11-104 Wave 2A] 设备管理看板: overview / usage-trend / by-room / maintenance-calendar
  // 静态路径必须注册在 GET /:id 通配之前
  http.get(`${API}/overview`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        total: 8,
        online: 6,
        byState: { IDLE: 3, IN_USE: 3, MAINTENANCE: 1, BROKEN: 1, OFFLINE: 0 },
        todayExams: 31,
        todayUsageMin: 640,
        faultsToday: 1,
        faultRate: 12.5,
        maintenanceDue: 2,
        byModality: [
          { modality: 'CT', total: 1, online: 1 },
          { modality: 'MR', total: 1, online: 1 },
          { modality: 'DR', total: 2, online: 1 },
          { modality: 'US', total: 2, online: 2 },
          { modality: 'MG', total: 1, online: 1 },
          { modality: 'DSA', total: 1, online: 0 },
        ],
      },
    });
  }),

  http.get(`${API}/usage-trend`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days') ?? 30)));
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      return d.toISOString().slice(0, 10);
    });
    const items = dates.map((date, idx) => ({ date, count: 3 + ((idx * 5) % 11) }));
    return HttpResponse.json({
      success: true,
      data: {
        items,
        byModality: [
          { modality: 'CT', counts: dates.map((date, idx) => ({ date, count: 1 + ((idx * 3) % 6) })) },
          { modality: 'MR', counts: dates.map((date, idx) => ({ date, count: (idx * 2) % 5 })) },
        ],
        total: days,
      },
    });
  }),

  http.get(`${API}/by-room`, async () => {
    await delay(delayMs());
    const items = [
      { room: 'CT室1', devices: 1, online: 1, todayExams: 14 },
      { room: 'MR室1', devices: 1, online: 1, todayExams: 10 },
      { room: 'DR室1', devices: 2, online: 1, todayExams: 9 },
      { room: '超声室', devices: 2, online: 2, todayExams: 8 },
    ];
    return HttpResponse.json({ success: true, data: { items, total: items.length } });
  }),

  http.get(`${API}/maintenance-calendar`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const month = url.searchParams.get('month');
    const plans = getMaintenancePlans();
    const byMonth = new Map<string, any[]>();
    let pendingCount = 0;
    let overdueCount = 0;
    let totalCost = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const p of plans) {
      const m = String(p.maintenanceDate).slice(0, 7);
      if (month && m !== month) continue;
      const arr = byMonth.get(m) ?? [];
      arr.push(p);
      byMonth.set(m, arr);
      if (p.status !== 'COMPLETED') pendingCount += 1;
      if (p.status !== 'COMPLETED' && new Date(p.maintenanceDate).getTime() < today.getTime()) overdueCount += 1;
      if (typeof p.estimatedCost === 'number') totalCost += p.estimatedCost;
    }
    const months = [...byMonth.entries()]
      .map(([monthKey, items]) => ({ month: monthKey, items, count: items.length }))
      .sort((a, b) => (a.month < b.month ? -1 : 1));
    return HttpResponse.json({ success: true, data: { months, pendingCount, overdueCount, totalCost: Number(totalCost.toFixed(2)) } });
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
  // [W1-B] 注射指令下发: POST /device-mgmt/contrast/injection
  http.post(`${API}/contrast/injection`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), action: 'SEND', resource: 'injection-command', detail: body, createdAt: new Date().toISOString() };
    try { create('injectionCommands' as any, newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
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
  // [W4-B] 保养计划 CRUD + 到期提醒 (必须先于 :id 通配)
  http.get(`${API}/maintenance-due`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const days = Math.max(1, Number(url.searchParams.get('days') ?? 30));
    const horizon = new Date(Date.now() + days * 86400000).getTime();
    const plans = getMaintenancePlans();
    const items = plans
      .filter((p: any) => p.status !== 'COMPLETED' && new Date(p.maintenanceDate).getTime() <= horizon)
      .sort((a: any, b: any) => a.maintenanceDate.localeCompare(b.maintenanceDate));
    return HttpResponse.json({ success: true, data: { items, total: items.length, days } });
  }),
  http.get(`${API}/maintenance-plans`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const deviceId = url.searchParams.get('deviceId');
    const status = url.searchParams.get('status');
    let items = getMaintenancePlans();
    if (deviceId) items = items.filter((p: any) => p.deviceId === deviceId);
    if (status) items = items.filter((p: any) => p.status === status);
    items.sort((a: any, b: any) => a.maintenanceDate.localeCompare(b.maintenanceDate));
    return HttpResponse.json({ success: true, data: { items, total: items.length } });
  }),
  http.post(`${API}/maintenance-plans`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const maintenanceDate = body.maintenanceDate ?? new Date().toISOString();
    const intervalDays = Number(body.intervalDays ?? 90);
    const nextDate = new Date(new Date(maintenanceDate).getTime() + intervalDays * 86400000).toISOString();
    const plan = {
      id: `MP-${Date.now()}`,
      deviceId: body.deviceId ?? '',
      deviceName: body.deviceName ?? '',
      maintenanceDate,
      intervalDays,
      type: body.type ?? '定期保养',
      content: body.content ?? '',
      estimatedCost: body.estimatedCost ?? null,
      assignee: body.assignee ?? '',
      status: 'PENDING',
      nextDate,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try { create('maintenancePlans' as any, plan); } catch {}
    return HttpResponse.json({ success: true, data: plan }, { status: 201 });
  }),
  http.put(`${API}/maintenance-plans/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const plans = getMaintenancePlans();
    const existing = plans.find((p: any) => p.id === params.id);
    if (!existing) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'MaintenancePlan not found' } }, { status: 404 });
    const merged = { ...existing, ...body, id: params.id, updatedAt: new Date().toISOString() };
    if (body.maintenanceDate || body.intervalDays) {
      merged.nextDate = new Date(new Date(merged.maintenanceDate).getTime() + merged.intervalDays * 86400000).toISOString();
    }
    if (body.status === 'COMPLETED' && !merged.completedAt) merged.completedAt = new Date().toISOString();
    try { update('maintenancePlans' as any, params.id as string, merged); } catch {}
    return HttpResponse.json({ success: true, data: merged });
  }),
  http.delete(`${API}/maintenance-plans/:id`, async ({ params }) => {
    await delay(delayMs());
    let existed = false;
    try { existed = !!getMaintenancePlans().find((p: any) => p.id === params.id); } catch {}
    try { remove('maintenancePlans' as any, params.id as string); } catch {}
    return new HttpResponse(null, { status: existed ? 204 : 404 });
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

const FALLBACK_MAINTENANCE_PLANS = [
  { id: 'MP001', deviceId: 'DEV-CT-01', deviceName: 'CT-1（GE Revolution CT）', maintenanceDate: '2026-08-15T00:00:00.000Z', intervalDays: 90, type: '定期保养', content: '球管衰减检测，系统综合保养', estimatedCost: 3000, assignee: '张工', status: 'PENDING', nextDate: '2026-11-13T00:00:00.000Z', completedAt: null, createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z' },
  { id: 'MP002', deviceId: 'DEV-MR-01', deviceName: 'MR-1（西门子MAGNETOM Vida）', maintenanceDate: '2026-09-05T00:00:00.000Z', intervalDays: 180, type: '半年保养', content: '液氦补充，滑环清洁，梯度测试', estimatedCost: 2500, assignee: '李工', status: 'PENDING', nextDate: '2027-03-04T00:00:00.000Z', completedAt: null, createdAt: '2026-05-10T00:00:00.000Z', updatedAt: '2026-05-10T00:00:00.000Z' },
  { id: 'MP003', deviceId: 'DEV-DR-01', deviceName: 'DR-1（飞利浦DigitalDiagnost）', maintenanceDate: '2026-08-02T00:00:00.000Z', intervalDays: 90, type: '定期保养', content: '探测器校准，X线管训练', estimatedCost: 1800, assignee: '王工', status: 'PENDING', nextDate: '2026-10-31T00:00:00.000Z', completedAt: null, createdAt: '2026-05-20T00:00:00.000Z', updatedAt: '2026-05-20T00:00:00.000Z' },
  { id: 'MP004', deviceId: 'DEV-MG-01', deviceName: '乳腺钼靶（GE Senographe）', maintenanceDate: '2026-07-01T00:00:00.000Z', intervalDays: 90, type: '定期保养', content: '压迫器校准，图像质量检测', estimatedCost: 1500, assignee: '陈工', status: 'COMPLETED', nextDate: '2026-09-29T00:00:00.000Z', completedAt: '2026-07-01T00:00:00.000Z', createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z' },
];

function getMaintenancePlans(): any[] {
  try {
    const items = list<any>('maintenancePlans' as any);
    if (items && items.length) return items;
  } catch {}
  return FALLBACK_MAINTENANCE_PLANS.map((p) => ({ ...p }));
}
