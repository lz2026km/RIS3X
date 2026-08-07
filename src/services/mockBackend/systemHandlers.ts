// [v3.0.6.11-21] System 模块 MSW Handlers
// 为 v3.0.6.11-20 新增页面 (system/audit, system/backup, system/tenant-config)
// 及 v3.0.6.11-20 compliance 子模块提供后端 mock 数据
import { http, HttpResponse, delay } from 'msw';

const API_BASE = (() => {
  try { return window.location.origin + '/api/v1'; } catch { return 'http://localhost:5173/api/v1'; }
})();

// 审计日志 mock
const AUDIT_LOGS = Array.from({ length: 30 }, (_, i) => ({
  id: 'AUD-' + String(i + 1).padStart(4, '0'),
  userId: ['admin', 'dr.wang', 'nurse.li', 'tech.zhao', 'ext.api'][i % 5],
  username: ['系统管理员', '王医生', '李护士', '赵技师', '外部API'][i % 5],
  userRole: ['admin', 'doctor', 'nurse', 'technician', 'api'][i % 5],
  action: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'VIEW'][i % 7],
  resource: [
    '/api/v1/reports/RPT-2026-' + String(1000 + i).padStart(4, '0'),
    '/api/v1/patients/P-' + String(100 + i).padStart(3, '0'),
    '/api/v1/exams/E-' + String(2000 + i).padStart(4, '0'),
    '/api/v1/users',
    '/api/v1/system/backup',
  ][i % 5],
  resourceId: 'RPT-2026-' + String(1000 + i).padStart(4, '0'),
  details: ['操作详情 #' + (i + 1) + ' - 自动生成测试数据'],
  ip: '192.168.1.' + (10 + i),
  userAgent: ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'G005-RIS-API-Client/3.0.6', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)'][i % 3],
  status: (['SUCCESS', 'SUCCESS', 'DENIED', 'SUCCESS', 'FAILURE'] as const)[i % 5],
  createdAt: new Date(Date.now() - i * 3600_000).toISOString(),
}));

// 备份 mock
const BACKUPS = Array.from({ length: 6 }, (_, i) => ({
  id: 'BKP-' + String(i + 1).padStart(4, '0'),
  type: i % 2 === 0 ? 'FULL' : 'INCREMENTAL',
  status: i === 0 ? 'IN_PROGRESS' : 'COMPLETED',
  sizeBytes: (50 + i * 12) * 1024 * 1024,
  createdBy: i % 3 === 0 ? 'admin' : 'system',
  createdAt: new Date(Date.now() - i * 86400_000).toISOString(),
}));

// 租户/合规 mock


// 合规报告 mock
const COMPLIANCE_REPORT = {
  summary: {
    totalAudits: 120,
    passed: 114,
    failed: 4,
    complianceRate: 95.0,
  },
  details: [
    { id: 'a-001', module: '用户认证', checkItem: 'MFA 启用', status: 'PASS', severity: 'MAJOR', description: '所有管理员账号已启用 MFA', checkedAt: new Date().toISOString() },
    { id: 'a-002', module: '数据加密', checkItem: 'TLS 1.3', status: 'PASS', severity: 'CRITICAL', description: 'API 全量启用 TLS 1.3', checkedAt: new Date().toISOString() },
    { id: 'a-003', module: '审计日志', checkItem: '日志完整性', status: 'PASS', severity: 'MAJOR', description: '最近 30 天日志 hash 链验证通过', checkedAt: new Date().toISOString() },
    { id: 'a-004', module: '数据备份', checkItem: 'RPO ≤ 6h', status: 'PASS', severity: 'MAJOR', description: '增量备份每 6 小时执行', checkedAt: new Date().toISOString() },
    { id: 'a-005', module: '访问控制', checkItem: 'RBAC 粒度', status: 'WARN', severity: 'MINOR', description: '建议细分到资源级 (当前角色级)', checkedAt: new Date().toISOString() },
    { id: 'a-006', module: '数据加密', checkItem: '敏感字段静态加密', status: 'PASS', severity: 'CRITICAL', description: 'AES-256 + KMS 密钥管理', checkedAt: new Date().toISOString() },
    { id: 'a-007', module: '日志保留', checkItem: '保留 ≥ 180 天', status: 'FAIL', severity: 'MAJOR', description: '审计日志保留 150 天, 不足 180', checkedAt: new Date().toISOString() },
    { id: 'a-008', module: '等保合规', checkItem: '三级等保', status: 'PASS', severity: 'CRITICAL', description: '已通过 2026 年度测评', checkedAt: new Date().toISOString() },
  ],
  generatedAt: new Date().toISOString(),
};

// [W5] /system/admin/configs: 系统管理配置项 (后端 system-storage.controller 对应端点)
const ADMIN_CONFIG_DEFAULTS: Record<string, { value: string; desc: string }> = {
  hospital_name: { value: 'G005 放射科信息管理系统', desc: '医院名称' },
  report_footer: { value: '本报告仅供临床参考，请结合临床实际情况。', desc: '报告页脚' },
  critical_sla_minutes: { value: '10', desc: '危急值 SLA 阈值（分钟）' },
  critical_timeout_minutes: { value: '60', desc: '危急值超时升级（分钟）' },
  default_page_size: { value: '20', desc: '默认分页大小' },
  pdf_watermark_text: { value: 'G005 RIS 内部资料', desc: 'PDF 水印文本' },
};
let adminConfigs: Record<string, string> = Object.fromEntries(
  Object.entries(ADMIN_CONFIG_DEFAULTS).map(([k, v]) => [k, v.value]),
);

// [W3-B] /system/clinical-config: 临床配置持久化 (7 模块; 后端 SystemConfig key=clinical_config)
const CLINICAL_MODULE_KEYS = [
  'gradingScales',
  'aiModels',
  'imagingDevices',
  'kpiThresholds',
  'reportTemplates',
  'findingsLexicon',
  'iolFormulas',
];
let clinicalConfigModules: Record<string, unknown> | null = null;
let clinicalConfigUpdatedAt: string | null = null;

export const systemHandlers = [
  // ─────────── Audit ───────────
  http.get(`${API_BASE}/audit`, ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') ?? '20');
    const action = url.searchParams.get('action');
    const filtered = action ? AUDIT_LOGS.filter(l => l.action === action) : AUDIT_LOGS;
    const start = (page - 1) * pageSize;
    const slice = filtered.slice(start, start + pageSize);
    return HttpResponse.json({
      success: true,
      data: {
        items: slice,
        total: filtered.length,
        page,
        pageSize,
      },
    });
  }),
  http.get(`${API_BASE}/audit/stats`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        total: AUDIT_LOGS.length * 17,
        last24h: AUDIT_LOGS.length,
      },
    });
  }),
  http.get(`${API_BASE}/audit/export`, ({ request }) => {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const userId = url.searchParams.get('userId');
    const resource = url.searchParams.get('resource');
    const filtered = AUDIT_LOGS.filter((l) =>
      (!action || l.action === action) &&
      (!userId || l.userId === userId) &&
      (!resource || String(l.resource ?? '').includes(resource))
    );
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = ['id', 'userId', 'username', 'action', 'resource', 'resourceId', 'details', 'ip', 'status', 'createdAt'];
    const out = [lines.join(',')];
    for (const l of filtered) {
      out.push([
        l.id, l.userId, l.username, l.action, l.resource, l.resourceId, l.details, l.ip, l.status, l.createdAt,
      ].map(esc).join(','));
    }
    return new HttpResponse('\uFEFF' + out.join('\r\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    });
  }),
  http.get(`${API_BASE}/audit/aggregation`, () => {
    const byAction: Record<string, number> = {};
    const byResource: Record<string, number> = {};
    const byUser: Array<{ userId: string; count: number }> = [];
    const userMap = new Map<string, number>();
    for (const l of AUDIT_LOGS) {
      byAction[l.action ?? ''] = (byAction[l.action ?? ''] ?? 0) + 1;
      byResource[l.resource ?? ''] = (byResource[l.resource ?? ''] ?? 0) + 1;
      userMap.set(l.userId ?? '', (userMap.get(l.userId ?? '') ?? 0) + 1);
    }
    for (const [userId, count] of userMap) byUser.push({ userId, count });
    byUser.sort((a, b) => b.count - a.count);
    return HttpResponse.json({
      success: true,
      data: {
        total: AUDIT_LOGS.length,
        last24h: AUDIT_LOGS.length,
        denied: AUDIT_LOGS.filter((l) => l.status === 'DENIED').length,
        byAction,
        byResource,
        byUser,
      },
    });
  }),
  // [W2-C] 审计记录详情 (AuditPage Drawer; 静态路由已在上方注册, :id 不会抢占)
  http.get(`${API_BASE}/audit/:id`, ({ params }) => {
    const entry = AUDIT_LOGS.find((l) => l.id === params.id);
    if (!entry) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `审计记录 ${params.id} 不存在` } },
        { status: 404 },
      );
    }
    return HttpResponse.json({ success: true, data: entry });
  }),

  // ─────────── Backup ───────────
  http.get(`${API_BASE}/backup`, () => {
    return HttpResponse.json({ success: true, data: BACKUPS });
  }),
  http.post(`${API_BASE}/backup`, async ({ request }) => {
    await delay(600);
    const url = new URL(request.url);
    const type = url.searchParams.get('type') ?? 'FULL';
    const newBackup = {
      id: 'BKP-' + String(BACKUPS.length + 1).padStart(4, '0'),
      type,
      status: 'COMPLETED',
      sizeBytes: 64 * 1024 * 1024,
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
    };
    return HttpResponse.json({ success: true, data: newBackup });
  }),
  http.get(`${API_BASE}/backup/:id/download`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: { id: params['id'], url: '#mock-download-' + params['id'] },
    });
  }),
  http.post(`${API_BASE}/backup/:id/restore`, async () => {
    await delay(800);
    return HttpResponse.json({ success: true, data: null });
  }),

  // ─────────── Compliance ───────────
  http.get(`${API_BASE}/compliance/report`, () => {
    return HttpResponse.json({ success: true, data: COMPLIANCE_REPORT });
  }),
  // [v3.0.6.11-79 W1-C] compliance-docs 7 端点已迁至 complianceDocsHandlers

  // ─────────── Admin Configs [W5] ───────────
  http.get(`${API_BASE}/system/admin/configs`, () => {
    return HttpResponse.json({
      success: true,
      data: Object.entries(adminConfigs).map(([key, value]) => ({
        key,
        value,
        desc: ADMIN_CONFIG_DEFAULTS[key]?.desc ?? '',
      })),
    });
  }),
  http.put(`${API_BASE}/system/admin/configs`, async ({ request }) => {
    await delay(120);
    const body = (await request.json().catch(() => null)) as any;
    const items = Array.isArray(body) ? body : body?.configs;
    if (!Array.isArray(items) || items.length === 0) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'configs 数组不能为空' } },
        { status: 400 },
      );
    }
    for (const item of items) {
      if (item && typeof item.key === 'string' && item.key in ADMIN_CONFIG_DEFAULTS) {
        adminConfigs[item.key] = String(item.value ?? '');
      }
    }
    return HttpResponse.json({
      success: true,
      data: Object.entries(adminConfigs).map(([key, value]) => ({
        key,
        value,
        desc: ADMIN_CONFIG_DEFAULTS[key]?.desc ?? '',
      })),
    });
  }),
  http.patch(`${API_BASE}/system/admin/configs/:key`, async ({ params, request }) => {
    await delay(100);
    const key = params.key as string;
    const body = (await request.json().catch(() => null)) as any;
    if (!(key in ADMIN_CONFIG_DEFAULTS)) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `未知配置项: ${key}` } },
        { status: 404 },
      );
    }
    adminConfigs[key] = String(body?.value ?? '');
    return HttpResponse.json({
      success: true,
      data: { key, value: adminConfigs[key], desc: ADMIN_CONFIG_DEFAULTS[key]!.desc },
    });
  }),

  // ─────────── Clinical Config [W3-B] ───────────
  // 静态路由在前, :module 参数路由在后, 避免抢占
  http.get(`${API_BASE}/system/clinical-config`, () => {
    return HttpResponse.json({
      success: true,
      data: { modules: clinicalConfigModules, updatedAt: clinicalConfigUpdatedAt },
    });
  }),
  http.put(`${API_BASE}/system/clinical-config`, async ({ request }) => {
    await delay(120);
    const body = (await request.json().catch(() => null)) as any;
    const modules = body?.modules ?? body;
    if (!modules || typeof modules !== 'object' || Array.isArray(modules) || Object.keys(modules).length === 0) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'modules 对象不能为空' } },
        { status: 400 },
      );
    }
    for (const k of Object.keys(modules)) {
      if (!CLINICAL_MODULE_KEYS.includes(k)) {
        return HttpResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `未知模块: ${k}` } },
          { status: 400 },
        );
      }
    }
    clinicalConfigModules = modules;
    clinicalConfigUpdatedAt = new Date().toISOString();
    return HttpResponse.json({
      success: true,
      data: { modules: clinicalConfigModules, updatedAt: clinicalConfigUpdatedAt },
    });
  }),
  http.put(`${API_BASE}/system/clinical-config/:module`, async ({ params, request }) => {
    await delay(100);
    const key = params.module as string;
    if (!CLINICAL_MODULE_KEYS.includes(key)) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `未知模块: ${key}` } },
        { status: 404 },
      );
    }
    const body = (await request.json().catch(() => null)) as any;
    const module = body?.module ?? body;
    if (!module || typeof module !== 'object' || Array.isArray(module)) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'module 必须是对象' } },
        { status: 400 },
      );
    }
    clinicalConfigModules = { ...(clinicalConfigModules ?? {}), [key]: module };
    clinicalConfigUpdatedAt = new Date().toISOString();
    return HttpResponse.json({
      success: true,
      data: { module, updatedAt: clinicalConfigUpdatedAt },
    });
  }),

  // ─────────── Tenant ───────────
  
];
