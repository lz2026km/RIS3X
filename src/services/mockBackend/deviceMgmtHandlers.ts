// [v3.0.6.11-7] /api/v1/device-mgmt MSW handlers
// [G005 P1] 补齐缺口: getEquipmentLifecycle/:id / getDevice/:id / update* / recordDose /
//           contrast/injection / contrast/quality / 设备 CRUD (device-mgmt 根路径)
import { http, HttpResponse, delay } from 'msw';
import { list, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { DEVICE_BY_ID, DEVICE_MASTER, PATIENT_BY_ID, type DeviceMaster } from '../../data/master';
import { v4 as uuidv4 } from 'uuid';

// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5191/api/v1');

const API = `${API_BASE}/device-mgmt`;

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

// [G005] 设备生命周期 fallback 同样取自主数据 (原 EL001-EL003 为虚构机型)
const FALLBACK_LIFECYCLE = (['DEV-CT-001', 'DEV-MR-001', 'DEV-DR-001'] as const).map((id) => {
  const d = DEVICE_BY_ID[id];
  return {
    id: `EL-${id}`,
    name: `${d?.modality ?? ''}·${d?.model ?? id}`,
    model: d?.model ?? '',
    serialNumber: d?.serialNumber ?? '',
    manufacturer: d?.brand ?? '',
    location: d?.room ?? '',
    status: d?.status === '停用' ? 'RETIRED' : d?.status === '维护中' ? 'MAINTENANCE' : 'ACTIVE',
    purchaseDate: d?.purchaseDate ?? '',
    installationDate: d?.installedAt ?? '',
    warrantyExpiry: d?.warrantyExpiry ?? '',
    lastMaintenanceDate: d?.lastMaintenanceAt ?? '',
    nextMaintenanceDate: d?.nextMaintenanceAt ?? null,
    totalCost: (d?.purchasePrice ?? 0) * 10000,
    maintenanceCost: Math.round((d?.totalDowntime ?? 0) * 1200),
  };
});

// [G005] 设备列表不再使用 3 台虚构设备 (DEV001/CT-01 ...),
//   统一由 DEVICE_MASTER (45 台: CT 10 / MR 8 / DR 12 / US 8 / MG 3 / DSA 2 / PET-CT 2) 映射。
const STATE_BY_STATUS: Record<string, string> = {
  '运行中': 'IN_USE',
  '待机': 'IDLE',
  '维护中': 'MAINTENANCE',
  '故障': 'BROKEN',
  '停用': 'OFFLINE',
  '校准中': 'MAINTENANCE',
};

const toMgmtDevice = (d: DeviceMaster) => ({
  id: d.id,
  code: d.id.replace(/^DEV-/, ''),
  name: `${d.modality}·${d.model}`,
  modality: d.modality,
  manufacturer: d.brand,
  location: d.room,
  state: STATE_BY_STATUS[d.status] ?? 'IDLE',
  serialNumber: d.serialNumber,
  assetCode: d.assetCode,
  status: d.status,
  lastMaintenanceDate: d.lastMaintenanceAt,
  nextMaintenanceDate: d.nextMaintenanceAt,
  doseComplianceRate: d.doseComplianceRate,
  defectRate: d.defectRate,
});

const MASTER_DEVICES = DEVICE_MASTER.map(toMgmtDevice);

const deviceLabel = (deviceId: string): string => {
  const d = DEVICE_BY_ID[deviceId];
  return d ? `${d.brand} ${d.model}` : deviceId;
};


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
    if (!items.length) items = MASTER_DEVICES;
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: { items: result.data, total: result.total } });
  }),

  http.get(`${API}/devices/:id`, async ({ params }) => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('mgmtDevices' as any); } catch {}
    if (!items.length) items = MASTER_DEVICES;
    const found = items.find((i) => i.id === params.id) ?? items[0];
    return HttpResponse.json({ success: true, data: found });
  }),

  http.put(`${API}/devices/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const existing = { id: params.id, ...MASTER_DEVICES[0] };
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
    // [G005] 故障史 5 条, deviceId 全部来自 DEVICE_MASTER
    if (!items.length) items = FAILURE_HISTORY;
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: { items: result.data, total: result.total } });
  }),
  http.post(`${API}/faults`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('faults' as any, newItem); } catch {}
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
      { id: 'DOSE-001', patientId: 'P000001', patientName: PATIENT_BY_ID['P000001']?.name ?? 'P000001', deviceId: 'DEV-CT-001', deviceName: deviceLabel('DEV-CT-001'), doseValue: 450, doseUnit: 'mGy·cm', examType: 'CT胸部平扫', recordedAt: '2026-08-01T09:30:00Z' },
      { id: 'DOSE-002', patientId: 'P000002', patientName: PATIENT_BY_ID['P000002']?.name ?? 'P000002', deviceId: 'DEV-CT-002', deviceName: deviceLabel('DEV-CT-002'), doseValue: 620, doseUnit: 'mGy·cm', examType: 'CT腹部增强', recordedAt: '2026-08-01T10:15:00Z' },
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
    if (!items.length) items = [{
      id: 'AR001',
      patientId: 'P000001',
      patientName: PATIENT_BY_ID['P000001']?.name ?? 'P000001',
      contrastAgent: '碘海醇（欧乃派克）',
      reaction: '皮疹',
      severity: 'MINOR',
      occurredAt: isoAt(-4, 11),
    }];
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
    if (!items.length) items = MASTER_DEVICES;
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
  // [G005] 校准记录 8 条 (DEVICE_MASTER 真实 deviceId), 静态路径先于 :id 通配注册
  http.get(`${API}/calibration-records`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const deviceId = url.searchParams.get('deviceId');
    const result = url.searchParams.get('result');
    let items: any[] = CALIBRATION_RECORDS;
    if (deviceId) items = items.filter((c) => c.deviceId === deviceId);
    if (result) items = items.filter((c) => c.result === result);
    return HttpResponse.json({ success: true, data: { items, total: items.length } });
  }),
  http.get(`${API}/failure-history`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const deviceId = url.searchParams.get('deviceId');
    let items: any[] = FAILURE_HISTORY;
    if (deviceId) items = items.filter((f) => f.deviceId === deviceId);
    return HttpResponse.json({ success: true, data: { items, total: items.length } });
  }),
  http.get(`${API}/:id`, async ({ params }) => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('mgmtDevices' as any); } catch {}
    if (!items.length) items = MASTER_DEVICES;
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
    const existing = { id: params.id, ...MASTER_DEVICES[0] };
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

// [G005] 维护/校准/故障数据全部绑定 DEVICE_MASTER 真实 deviceId
//   (移除旧的 DEV-CT-01 / DEV-MR-01 / DEV-DR-01 / DEV-MG-01 虚构设备)
const DAY_MS = 86400000;
const ANCHOR = new Date();
const isoAt = (offsetDays: number, hour = 9) => {
  const d = new Date(ANCHOR.getTime() + offsetDays * DAY_MS);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const WORK_ORDER_DEVICES = [
  'DEV-CT-001', 'DEV-CT-002', 'DEV-CT-003',
  'DEV-MR-001', 'DEV-MR-002',
  'DEV-DR-001', 'DEV-DR-002',
  'DEV-US-001', 'DEV-MG-001', 'DEV-DSA-001',
] as const;

const WORK_ORDER_TEMPLATES = [
  { type: '定期保养', content: '球管衰减检测，系统综合保养', intervalDays: 90, estimatedCost: 3000, assignee: '工程师-1' },
  { type: '半年保养', content: '液氦补充，滑环清洁，梯度线圈测试', intervalDays: 180, estimatedCost: 2500, assignee: '工程师-2' },
  { type: '定期保养', content: '探测器校准，X线管训练', intervalDays: 90, estimatedCost: 1800, assignee: '工程师-3' },
  { type: '季度保养', content: '高压注射器管路更换与流量校验', intervalDays: 90, estimatedCost: 1200, assignee: '工程师-4' },
  { type: '年度保养', content: '图像质量模体检测，剂量输出校验', intervalDays: 365, estimatedCost: 4200, assignee: '工程师-5' },
] as const;

const MAINTENANCE_WORK_ORDERS = WORK_ORDER_DEVICES.map((deviceId, i) => {
  const tpl = WORK_ORDER_TEMPLATES[i % WORK_ORDER_TEMPLATES.length]!;
  const offset = (i - 5) * 7; // -35d ~ +28d: 覆盖已完成/逾期/待办
  const maintenanceDate = isoAt(offset);
  const completed = offset < -3;
  return {
    id: `MP-${String(i + 1).padStart(3, '0')}`,
    deviceId,
    deviceName: deviceLabel(deviceId),
    maintenanceDate,
    intervalDays: tpl.intervalDays,
    type: tpl.type,
    content: tpl.content,
    estimatedCost: tpl.estimatedCost,
    assignee: tpl.assignee,
    status: completed ? 'COMPLETED' : 'PENDING',
    nextDate: isoAt(offset + tpl.intervalDays),
    completedAt: completed ? maintenanceDate : null,
    createdAt: isoAt(offset - 14),
    updatedAt: completed ? maintenanceDate : isoAt(offset - 14),
  };
});

const CALIBRATION_DEVICES = [
  'DEV-CT-001', 'DEV-CT-004', 'DEV-MR-001', 'DEV-MR-003',
  'DEV-DR-001', 'DEV-MG-001', 'DEV-DSA-001', 'DEV-PET-CT-001',
] as const;

const CALIBRATION_TEMPLATES = [
  { calibrationType: '剂量校准', standard: 'GBZ 130-2020', result: 'PASS', notes: 'CTDIvol 偏差 < 5%' },
  { calibrationType: '图像质量校准', standard: 'AAPM TG-233', result: 'PASS', notes: 'MTF/噪声体模检测合格' },
  { calibrationType: '场强匀场校准', standard: 'YY/T 0482-2022', result: 'PASS', notes: '3.0T 匀场偏差达标' },
  { calibrationType: '探测器增益校准', standard: 'IEC 62220-1', result: 'PASS', notes: '坏点校正后一致性良好' },
  { calibrationType: '压迫器力值校准', standard: 'YY/T 0687-2023', result: 'FAIL', notes: '压迫力超差, 已安排复校' },
] as const;

const CALIBRATION_RECORDS = CALIBRATION_DEVICES.map((deviceId, i) => {
  const tpl = CALIBRATION_TEMPLATES[i % CALIBRATION_TEMPLATES.length]!;
  const offset = -(i * 11 + 5);
  return {
    id: `CAL-${String(i + 1).padStart(3, '0')}`,
    deviceId,
    deviceName: deviceLabel(deviceId),
    calibrationType: tpl.calibrationType,
    standard: tpl.standard,
    performedAt: isoAt(offset, 10),
    result: tpl.result,
    nextDueAt: isoAt(offset + 180, 10),
    engineer: `工程师-${(i % 12) + 1}`,
    notes: tpl.notes,
  };
});

const FAILURE_DEVICES = [
  'DEV-CT-002', 'DEV-MR-002', 'DEV-DR-002', 'DEV-US-001', 'DEV-DSA-001',
] as const;

const FAILURE_TEMPLATES = [
  { description: '球管过热保护停机', severity: 'MAJOR', rootCause: '冷却循环水温偏高', downtimeHours: 6 },
  { description: '梯度放大器报错 E120', severity: 'MAJOR', rootCause: '梯度线圈接插件松动', downtimeHours: 12 },
  { description: '平板探测器坏点增多', severity: 'MINOR', rootCause: '探测器老化', downtimeHours: 3 },
  { description: '探头穿刺激活失败', severity: 'MINOR', rootCause: '阵元通道故障', downtimeHours: 2 },
  { description: '高压注射联锁异常', severity: 'CRITICAL', rootCause: 'C臂限位开关失灵', downtimeHours: 24 },
] as const;

const FAILURE_HISTORY = FAILURE_DEVICES.map((deviceId, i) => {
  const tpl = FAILURE_TEMPLATES[i % FAILURE_TEMPLATES.length]!;
  const offset = -(i * 6 + 2);
  const resolved = i % 3 !== 2;
  return {
    id: `FAULT-${String(i + 1).padStart(3, '0')}`,
    deviceId,
    deviceName: deviceLabel(deviceId),
    description: tpl.description,
    severity: tpl.severity,
    status: resolved ? 'RESOLVED' : 'OPEN',
    rootCause: tpl.rootCause,
    downtimeHours: tpl.downtimeHours,
    occurredAt: isoAt(offset, 14),
    resolvedAt: resolved ? isoAt(offset, 14 + tpl.downtimeHours) : null,
  };
});

function getMaintenancePlans(): any[] {
  try {
    const items = list<any>('maintenancePlans' as any);
    if (items && items.length) return items;
  } catch {}
  return MAINTENANCE_WORK_ORDERS.map((p) => ({ ...p }));
}
