// [v3.0.6.11-60] Tenant 模块 MSW Handlers
// /api/v1/tenant/* — 当前租户信息/用量/功能开关 + 平台管理（租户列表/创建/启停）
import { http, HttpResponse, delay } from 'msw';

const API_BASE = (() => {
  try { return window.location.origin + '/api/v1'; } catch { return 'http://localhost:5173/api/v1'; }
})();

const DEFAULT_FEATURES = {
  aiOrchestration: true,
  biDashboard: true,
  doseManagement: true,
  vna: true,
  similarCases: true,
  environmentReport: true,
  mobileApp: true,
  teleRadiology: true,
};

interface MockTenant {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED';
  license: string;
  maxUsers: number;
  maxStorageGb: number;
  maxExams: number;
  features: Record<string, boolean>;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const now = (offsetDays = 0) => new Date(Date.now() - offsetDays * 86400_000).toISOString();

const TENANTS: MockTenant[] = [
  {
    id: 'default',
    code: 'default',
    name: '主租户（默认）',
    status: 'ACTIVE',
    license: 'Enterprise',
    maxUsers: 200,
    maxStorageGb: 1024,
    maxExams: 100000,
    features: { ...DEFAULT_FEATURES },
    config: { locale: 'zh-CN', timezone: 'Asia/Shanghai' },
    createdAt: now(180),
    updatedAt: now(3),
  },
  {
    id: 'tenant-001',
    code: 'demo-a',
    name: '演示租户 A',
    status: 'ACTIVE',
    license: 'Professional',
    maxUsers: 100,
    maxStorageGb: 512,
    maxExams: 50000,
    features: { ...DEFAULT_FEATURES, mobileApp: false },
    config: { locale: 'zh-CN' },
    createdAt: now(60),
    updatedAt: now(10),
  },
  {
    id: 'tenant-002',
    code: 'demo-b',
    name: '演示租户 B',
    status: 'DISABLED',
    license: 'Basic',
    maxUsers: 50,
    maxStorageGb: 128,
    maxExams: 20000,
    features: { ...DEFAULT_FEATURES, vna: false, teleRadiology: false },
    config: {},
    createdAt: now(120),
    updatedAt: now(15),
  },
];

function currentTenant(): MockTenant {
  const id = localStorage.getItem('ris_mock_tenant_id') ?? 'default';
  return TENANTS.find((t) => t.id === id) ?? TENANTS[0]!;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const tenantHandlers = [
  // ─────────── 当前租户 ───────────
  http.get(`${API_BASE}/tenant/current`, async () => {
    await delay(120);
    return HttpResponse.json({ success: true, data: clone(currentTenant()) });
  }),

  http.get(`${API_BASE}/tenant/usage`, async () => {
    await delay(150);
    const tenant = currentTenant();
    return HttpResponse.json({
      success: true,
      data: {
        users: 156,
        patients: 12840,
        exams: 52360,
        reports: 49820,
        storageBytes: 50 * 1024 * 1024 * 1024,
        storageLimitBytes: tenant.maxStorageGb * 1024 * 1024 * 1024,
        examLimit: tenant.maxExams,
        userLimit: tenant.maxUsers,
      },
    });
  }),

  http.put(`${API_BASE}/tenant/profile`, async ({ request }) => {
    await delay(200);
    const body = await request.json() as Record<string, unknown>;
    const tenant = currentTenant();
    Object.assign(tenant, {
      ...(typeof body.name === 'string' ? { name: body.name } : {}),
      ...(typeof body.license === 'string' ? { license: body.license } : {}),
      ...(typeof body.maxUsers === 'number' ? { maxUsers: body.maxUsers } : {}),
      ...(typeof body.maxStorageGb === 'number' ? { maxStorageGb: body.maxStorageGb } : {}),
      updatedAt: new Date().toISOString(),
    });
    return HttpResponse.json({ success: true, data: clone(tenant) });
  }),

  http.get(`${API_BASE}/tenant/features`, async () => {
    await delay(100);
    return HttpResponse.json({ success: true, data: clone(currentTenant().features) });
  }),

  http.put(`${API_BASE}/tenant/features`, async ({ request }) => {
    await delay(200);
    const body = await request.json() as Partial<Record<keyof typeof DEFAULT_FEATURES, boolean>>;
    const tenant = currentTenant();
    tenant.features = { ...tenant.features, ...body };
    tenant.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: clone(tenant.features) });
  }),

  // ─────────── 平台管理（管理员） ───────────
  http.get(`${API_BASE}/tenant/list`, async () => {
    await delay(120);
    return HttpResponse.json({
      success: true,
      data: TENANTS.map((t) => clone(t)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  }),

  http.post(`${API_BASE}/tenant`, async ({ request }) => {
    await delay(250);
    const body = await request.json() as { code?: string; name?: string; license?: string; maxUsers?: number; maxStorageGb?: number };
    const code = (body.code ?? '').trim();
    const name = (body.name ?? '').trim();
    if (!code || !name) {
      return HttpResponse.json({ success: false, data: null, error: { code: 'VALIDATION', message: '租户 code 与名称不能为空' } }, { status: 400 });
    }
    if (TENANTS.some((t) => t.code === code)) {
      return HttpResponse.json({ success: false, data: null, error: { code: 'CONFLICT', message: '租户 code 已存在' } }, { status: 409 });
    }
    const tenant: MockTenant = {
      id: `tenant-${code}`,
      code,
      name,
      status: 'ACTIVE',
      license: body.license ?? 'Enterprise',
      maxUsers: body.maxUsers ?? 100,
      maxStorageGb: body.maxStorageGb ?? 256,
      maxExams: 50000,
      features: { ...DEFAULT_FEATURES },
      config: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    TENANTS.push(tenant);
    return HttpResponse.json({ success: true, data: clone(tenant) });
  }),

  http.put(`${API_BASE}/tenant/:id/status`, async ({ params, request }) => {
    await delay(200);
    const id = params['id'] as string;
    const body = await request.json() as { status?: string };
    const tenant = TENANTS.find((t) => t.id === id);
    if (!tenant) {
      return HttpResponse.json({ success: false, data: null, error: { code: 'NOT_FOUND', message: '租户不存在' } }, { status: 404 });
    }
    if (body.status !== 'ACTIVE' && body.status !== 'DISABLED') {
      return HttpResponse.json({ success: false, data: null, error: { code: 'VALIDATION', message: 'status 必须为 ACTIVE 或 DISABLED' } }, { status: 400 });
    }
    tenant.status = body.status;
    tenant.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: clone(tenant) });
  }),
];
