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
const TENANT_COMPLIANCE = {
  status: 'ok',
  compliant: true,
  score: 96,
  checks: [
    { id: 'chk-001', name: 'HTTPS 加密传输', passed: true, detail: '全站启用 TLS 1.3' },
    { id: 'chk-002', name: '敏感字段加密', passed: true, detail: '身份证/手机号 AES-256 加密' },
    { id: 'chk-003', name: '审计日志完整性', passed: true, detail: '最近 30 天 0 缺失' },
    { id: 'chk-004', name: '密码策略', passed: true, detail: '12 位 + 大小写 + 数字 + 符号' },
    { id: 'chk-005', name: 'MFA 多因素', passed: true, detail: '管理员账号 100% 启用' },
    { id: 'chk-006', name: '会话超时', passed: false, detail: '3 个账号未设置超时 (建议 30 分钟)' },
    { id: 'chk-007', name: '数据备份', passed: true, detail: '每日全量 + 6 小时增量' },
    { id: 'chk-008', name: '等保测评', passed: true, detail: '三级等保, 2026 年测评通过' },
  ],
  generatedAt: new Date().toISOString(),
};

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

// 合规文档 mock
const COMPLIANCE_DOCS = [
  { id: 'd-001', title: '隐私政策', category: '法规文档', status: 'CURRENT', version: '3.2', updatedAt: new Date(Date.now() - 7 * 86400_000).toISOString() },
  { id: 'd-002', title: '数据安全管理制度', category: '管理制度', status: 'CURRENT', version: '2.1', updatedAt: new Date(Date.now() - 14 * 86400_000).toISOString() },
  { id: 'd-003', title: '等保测评报告 (2026)', category: '测评报告', status: 'CURRENT', version: '1.0', updatedAt: new Date(Date.now() - 30 * 86400_000).toISOString() },
  { id: 'd-004', title: '应急响应预案', category: '应急预案', status: 'DRAFT', version: '0.9', updatedAt: new Date(Date.now() - 3 * 86400_000).toISOString() },
  { id: 'd-005', title: '历史 SOP (旧版)', category: '管理制度', status: 'ARCHIVED', version: '1.5', updatedAt: new Date(Date.now() - 180 * 86400_000).toISOString() },
];

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
  http.get(`${API_BASE}/audit/aggregation`, () => {
    const byAction: Record<string, number> = {};
    const byResource: Record<string, number> = {};
    const byUser: Array<{ userId: string; count: number }> = [];
    const userMap = new Map<string, number>();
    for (const l of AUDIT_LOGS) {
      byAction[l.action] = (byAction[l.action] ?? 0) + 1;
      byResource[l.resource] = (byResource[l.resource] ?? 0) + 1;
      userMap.set(l.userId, (userMap.get(l.userId) ?? 0) + 1);
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
  http.get(`${API_BASE}/compliance-docs`, () => {
    return HttpResponse.json({ success: true, data: COMPLIANCE_DOCS });
  }),

  // ─────────── Tenant ───────────
  
];
