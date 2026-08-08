// [W3-A] /api/v1/auto-collection MSW handlers
// 后端无 auto-collection controller → 本地 MSW 支撑 (页面标注"演示数据"来源)
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
];
