// [W3-A] /api/v1/auto-collection MSW handlers
// [v3.0.6.11-88] 后端 auto-collection.controller 已实现 → 本 handler 仅 dev 模式兜底 (页面标注"演示数据"来源)
//   GET  /auto-collection/rules        · POST /auto-collection/rules
//   PUT  /auto-collection/rules/:id    · DELETE /auto-collection/rules/:id
//   GET  /auto-collection/stats        · GET /auto-collection/tasks
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/auto-collection';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

interface AutoCollectionRule {
  id: string
  name: string
  description: string
  triggerType: 'event' | 'schedule' | 'threshold'
  triggerConfig: Record<string, unknown>
  action: 'notify' | 'report' | 'archive' | 'transfer'
  actionConfig: Record<string, unknown>
  enabled: boolean
  createdAt: string
  updatedAt: string
}

let rules: AutoCollectionRule[] = [
  { id: 'ac-001', name: 'DICOM 自动归档', description: '检查完成后自动归档影像至 VNA', triggerType: 'event', triggerConfig: { event: 'exam.completed' }, action: 'archive', actionConfig: { target: 'vna' }, enabled: true, createdAt: '2026-06-01T08:00:00Z', updatedAt: '2026-07-28T10:00:00Z' },
  { id: 'ac-002', name: '危急值自动通知', description: '检出危急值后自动推送通知', triggerType: 'event', triggerConfig: { event: 'critical.created' }, action: 'notify', actionConfig: { channel: 'sms+wechat' }, enabled: true, createdAt: '2026-06-02T08:00:00Z', updatedAt: '2026-07-28T09:30:00Z' },
  { id: 'ac-003', name: '每日质量报告', description: '每日定时生成科室质量报告', triggerType: 'schedule', triggerConfig: { cron: '0 8 * * *' }, action: 'report', actionConfig: { template: 'daily-qc' }, enabled: false, createdAt: '2026-06-05T08:00:00Z', updatedAt: '2026-07-27T08:00:00Z' },
];

export const autoCollectionHandlers = [
  http.get(`${API}/rules`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: rules.map((r) => ({ ...r })) });
  }),

  http.post(`${API}/rules`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as Partial<AutoCollectionRule> | null;
    if (!body || typeof body.name !== 'string' || !body.name.trim() || !body.triggerType || !body.action) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'name/triggerType/action 为必填字段' } },
        { status: 400 },
      );
    }
    const now = new Date().toISOString();
    const rule: AutoCollectionRule = {
      id: `ac-${Date.now().toString(36)}`,
      name: body.name.trim(),
      description: body.description ?? '',
      triggerType: body.triggerType,
      triggerConfig: body.triggerConfig ?? {},
      action: body.action,
      actionConfig: body.actionConfig ?? {},
      enabled: body.enabled !== false,
      createdAt: now,
      updatedAt: now,
    };
    rules = [rule, ...rules];
    return HttpResponse.json({ success: true, data: rule }, { status: 201 });
  }),

  http.put(`${API}/rules/:id`, async ({ request, params }) => {
    await delay(delayMs());
    const id = params.id as string;
    const body = (await request.json().catch(() => null)) as Partial<AutoCollectionRule> | null;
    const target = rules.find((r) => r.id === id);
    if (!target) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Rule not found: ${id}` } }, { status: 404 });
    Object.assign(target, body ?? {}, { updatedAt: new Date().toISOString() });
    return HttpResponse.json({ success: true, data: { ...target } });
  }),

  http.delete(`${API}/rules/:id`, async ({ params }) => {
    await delay(delayMs());
    const id = params.id as string;
    const next = rules.filter((r) => r.id !== id);
    if (next.length === rules.length) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Rule not found: ${id}` } }, { status: 404 });
    rules = next;
    return HttpResponse.json({ success: true, data: { id } });
  }),

  http.get(`${API}/stats`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        totalRules: rules.length,
        activeRules: rules.filter((r) => r.enabled).length,
        totalTasks: 128,
        completedTasks: 124,
        failedTasks: 2,
        dailyExecutions: [
          { date: '2026-07-27', count: 42, successCount: 41 },
          { date: '2026-07-28', count: 45, successCount: 45 },
        ],
      },
    });
  }),

  // [G005 Wave1A W9] 规则详情 / 配置 (页面加载调用, 补齐避免穿透 500)
  http.get(`${API}/rules/:id`, async ({ params }) => {
    await delay(delayMs());
    const found = rules.find((r) => r.id === params.id);
    if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Rule not found: ${params.id}` } }, { status: 404 });
    return HttpResponse.json({ success: true, data: { ...found } });
  }),

  http.get(`${API}/config`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'cfg-001', key: 'poll_interval_sec', value: '30', description: 'DICOM 轮询间隔', category: 'DICOM' },
        { id: 'cfg-002', key: 'hl7_port', value: '2575', description: 'HL7 MLLP 监听端口', category: 'HL7' },
        { id: 'cfg-003', key: 'ftp_host', value: 'ftp-archive.local', description: 'FTP 归档服务器', category: 'FTP' },
        { id: 'cfg-004', key: 'max_retry', value: '3', description: '失败最大重试次数', category: 'COMMON' },
      ],
    });
  }),

  http.put(`${API}/config/:key`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as { value?: string } | null;
    return HttpResponse.json({
      success: true,
      data: { id: `cfg-${params.key}`, key: params.key, value: body?.value ?? '', description: '', category: 'CUSTOM' },
    });
  }),

  http.get(`${API}/tasks`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: rules.slice(0, 3).map((r, i) => ({
        id: `task-${i + 1}`,
        ruleId: r.id,
        ruleName: r.name,
        status: r.enabled ? 'completed' : 'pending',
        triggeredAt: r.updatedAt,
        completedAt: r.updatedAt,
      })),
    });
  }),

  // [G005 Wave1A W9] 任务启动/停止/立即执行/重跑 (与后端 auto-collection.controller 对齐)
  http.post(`${API}/tasks/:id/start`, async ({ params }) => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: { id: params.id, ruleId: 'ac-001', ruleName: 'DICOM 自动归档', status: 'running', triggeredAt: new Date().toISOString(), result: { startedAt: new Date().toISOString() } },
    });
  }),
  http.post(`${API}/tasks/:id/stop`, async ({ params }) => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: { id: params.id, ruleId: 'ac-001', ruleName: 'DICOM 自动归档', status: 'completed', triggeredAt: new Date().toISOString(), completedAt: new Date().toISOString(), result: { stopped: true } },
    });
  }),
  http.post(`${API}/tasks/:id/run`, async ({ params }) => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: { id: params.id, ruleId: 'ac-001', ruleName: 'DICOM 自动归档', status: 'completed', triggeredAt: new Date().toISOString(), completedAt: new Date().toISOString(), result: { success: true, count: 1 } },
    });
  }),
  http.post(`${API}/tasks/:id/rerun`, async ({ params }) => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: { id: params.id, ruleId: 'ac-001', ruleName: 'DICOM 自动归档', status: 'completed', triggeredAt: new Date().toISOString(), completedAt: new Date().toISOString(), result: { success: true, count: 1 } },
    });
  }),

  // [G005 Wave1A W9] 执行日志
  http.get(`${API}/logs`, async () => {
    await delay(delayMs());
    const now = Date.now();
    const seeds = [
      { level: 'INFO', source: 'DICOM', message: '轮询发现 12 个待归档研究' },
      { level: 'INFO', source: 'HL7', message: '收到 ORU^R01 消息, 校验通过' },
      { level: 'ERROR', source: 'FTP', message: 'FTP 连接失败: 认证失败 (5 次尝试)' },
      { level: 'WARN', source: 'TASKS', message: '任务 ac-t-003 执行超时, 已重试' },
    ];
    return HttpResponse.json({
      success: true,
      data: Array.from({ length: 12 }, (_, i) => {
        const s = seeds[i % seeds.length]!;
        return { id: `ac-log-msw-${i + 1}`, time: new Date(now - i * 120000).toISOString(), level: s.level, source: s.source, message: s.message };
      }),
    });
  }),
];
