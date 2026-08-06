// [G005-P0] 危急值前缀统一:
//   API     = /api/v1/criticals     → backend criticals.controller.ts (@Controller('criticals'))
//   EXT_API = /api/v1/critical-ext  → backend criticalext.controller.ts (@Controller('critical-ext'))
import { http, HttpResponse, delay } from 'msw';
import { list, create, update, remove } from './store';
import { parseQuery, applyQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/criticals';
const EXT_API = '/api/v1/critical-ext';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

const countByStatus = (items: any[], statuses: string[]) => items.filter((i) => statuses.includes(i.status)).length;

const VALUE5STEP_FALLBACK = [
  {
    id: 'CV5-001', patientName: '张明远', finding: '颅内出血', severity: '危急', currentStep: 1,
    steps: { discovered: { done: true, time: '2026-08-03 07:45', user: '自动检测' }, voiceCall: { done: false }, acknowledged: { done: false }, receipted: { done: false }, closed: { done: false } },
  },
  {
    id: 'CV5-002', patientName: '李静', finding: '主动脉夹层', severity: '危及生命', currentStep: 2,
    steps: { discovered: { done: true, time: '2026-08-03 08:02', user: '自动检测' }, voiceCall: { done: true, time: '2026-08-03 08:08', user: '值班医生', phone: '13800000001' }, acknowledged: { done: false }, receipted: { done: false }, closed: { done: false } },
  },
  {
    id: 'CV5-003', patientName: '王强', finding: '急性心肌梗死', severity: '危及生命', currentStep: 3,
    steps: { discovered: { done: true, time: '2026-08-03 07:20', user: '自动检测' }, voiceCall: { done: true, time: '2026-08-03 07:25', user: '值班医生', phone: '13800000002' }, acknowledged: { done: true, time: '2026-08-03 07:30', user: '心内科陈医生' }, receipted: { done: false }, closed: { done: false } },
  },
  {
    id: 'CV5-004', patientName: '赵敏', finding: '蛛网膜下腔出血', severity: '危急', currentStep: 5,
    steps: { discovered: { done: true, time: '2026-08-02 21:10', user: '自动检测' }, voiceCall: { done: true, time: '2026-08-02 21:16', user: '值班医生', phone: '13800000003' }, acknowledged: { done: true, time: '2026-08-02 21:22', user: '神经外科刘医生' }, receipted: { done: true, time: '2026-08-02 21:35', user: '神经外科刘医生', comment: '已收治，急诊手术' }, closed: { done: true, time: '2026-08-03 06:00', user: '系统' } },
  },
];

const FOLLOW_UP_FALLBACK = [
  { id: 'FU-001', time: '2026-08-02 10:30', type: '电话回访', result: '已回复', operator: '王护士', content: '患者自述症状缓解，嘱按计划复查。', relatedCVId: 'CV5-004' },
  { id: 'FU-002', time: '2026-08-02 15:10', type: '短信确认', result: '转接成功', operator: '李护士', content: '短信随访确认，患者状态稳定。', relatedCVId: 'CV5-003' },
  { id: 'FU-003', time: '2026-08-03 09:05', type: '现场走访', result: '已回复', operator: '张医生', content: '术后复查恢复良好，建议 1 月后复查影像。', relatedCVId: 'CV5-001' },
];

// [W5] 通知通道开关配置 (后端 criticalext.controller GET/PUT /channels → critical_channel_<CHANNEL>)
const CHANNEL_DEFAULTS = [
  { channel: 'SYSTEM', label: '站内通知', enabled: true },
  { channel: 'SMS', label: '短信', enabled: true },
  { channel: 'PHONE', label: '电话', enabled: true },
  { channel: 'WECHAT', label: '微信', enabled: true },
  { channel: 'EMAIL', label: '邮件', enabled: true },
];
let channelSettings: Record<string, boolean> = {};
const channelList = () =>
  CHANNEL_DEFAULTS.map(c => ({ ...c, enabled: channelSettings[c.channel] ?? c.enabled }));

export const criticalExtHandlers = [
  // ==================== /critical-ext (criticalext.controller.ts) ====================
  http.get(`${EXT_API}/rules`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('criticalRules'); } catch {}
    if (!items.length) items = [{"id":"CR001","name":"危急值规则1","condition":"WBC>30","severity":"URGENT"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.post(`${EXT_API}/rules`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('criticalRules', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.put(`${EXT_API}/rules/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    try { update('criticalRules', params.id as string, { id: params.id, ...body }); } catch {}
    return HttpResponse.json({ success: true, data: { id: params.id, ...body } });
  }),
  http.delete(`${EXT_API}/rules/:id`, async ({ params }) => {
    await delay(delayMs());
    try { remove('criticalRules', params.id as string); } catch {}
    return HttpResponse.json({ success: true, data: {} });
  }),
  // 统计: 后端 criticals.controller 与 criticalext.controller 均有 GET stats
  http.get(`${EXT_API}/stats`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('criticalEvents'); } catch {}
    const countByStatus = (st: string) => items.filter((i) => i.status === st).length;
    const today = new Date().toISOString().slice(0, 10);
    return HttpResponse.json({ success: true, data: {
      pending: countByStatus('pending'),
      notified: countByStatus('notified'),
      acknowledged: countByStatus('acknowledged'),
      receipted: countByStatus('receipted'),
      resolved: countByStatus('resolved') + countByStatus('closed_loop'),
      escalated: countByStatus('escalated'),
      total: items.length,
      todayCount: items.filter((i) => String(i.reportedTime ?? i.triggeredAt ?? '').startsWith(today)).length,
    } });
  }),
  http.get(`${API}/stats`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('criticalEvents'); } catch {}
    const countByStatus = (st: string) => items.filter((i) => i.status === st).length;
    const today = new Date().toISOString().slice(0, 10);
    return HttpResponse.json({ success: true, data: {
      pending: countByStatus('pending'),
      notified: countByStatus('notified'),
      acknowledged: countByStatus('acknowledged'),
      receipted: countByStatus('receipted'),
      resolved: countByStatus('resolved') + countByStatus('closed_loop'),
      escalated: countByStatus('escalated'),
      total: items.length,
      todayCount: items.filter((i) => String(i.reportedTime ?? i.triggeredAt ?? '').startsWith(today)).length,
    } });
  }),
  http.get(`${EXT_API}/stats/summary`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any = [];
    try { items = list<any>('criticalRules'); } catch {}
    if (!items.length) items = {"bySeverity":{"URGENT":5,"HIGH":30,"LOW":10},"byDepartment":{}};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${EXT_API}/stats/timeline`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any = [];
    try { items = list<any>('criticalRules'); } catch {}
    if (!items.length) items = {"timeline":[{"date":"2026-07-01","count":3}]};
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${EXT_API}/center`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('criticalEvents'); } catch {}
    if (!items.length) items = [{"id":"CC001","patientName":"赵六","finding":"颅内出血","status":"ACKNOWLEDGED"}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${EXT_API}/center/:id`, async ({ params }) => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('criticalEvents'); } catch {}
    const found = items.find((i) => i.id === params.id);
    return HttpResponse.json({ success: true, data: found ?? { id: params.id, patientName: '未知', finding: '未知', status: 'PENDING' } });
  }),
  http.post(`${EXT_API}/auto-detect`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('criticalRules', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.post(`${EXT_API}/close-loop`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, createdAt: new Date().toISOString() };
    try { create('criticalRules', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${EXT_API}/receiver`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('criticalEvents'); } catch {}
    if (!items.length) items = [{"id":"CV5-004","patientName":"赵敏","finding":"蛛网膜下腔出血","status":"receipted"}];
    return HttpResponse.json({ success: true, data: items });
  }),
  // [G005-P0] 随访记录 (前端 /critical-ext/follow-up-records)
  http.get(`${EXT_API}/follow-up-records`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: FOLLOW_UP_FALLBACK });
  }),

  // [W5] 通知通道开关: GET / PUT (落库 critical_channel_<CHANNEL>)
  http.get(`${EXT_API}/channels`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: channelList() });
  }),
  http.put(`${EXT_API}/channels`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => null)) as any;
    const items = Array.isArray(body) ? body : body?.channels;
    if (!Array.isArray(items)) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'channels 数组不能为空' } },
        { status: 400 },
      );
    }
    for (const item of items) {
      if (item && typeof item.channel === 'string' && typeof item.enabled === 'boolean') {
        channelSettings[item.channel] = item.enabled;
      }
    }
    return HttpResponse.json({ success: true, data: channelList() });
  }),

  // ==================== /criticals (criticals.controller.ts) ====================
  // voice-call bridge
  http.post(`${API}/:criticalId/voice-call`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.criticalId, voiceCalledBy: body.calledBy, voiceCalledAt: new Date().toISOString() }, meta: {} });
  }),

  // clinical receipt
  http.post(`${API}/:criticalId/clinical-receipt`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: params.criticalId, confirmedBy: body.confirmedBy, confirmedAt: body.confirmedAt || new Date().toISOString() }, meta: {} });
  }),

  // ---- 5 步工作流记录 (对齐后端 /criticals/value5step/list, 从 criticalEvents 聚合) ----
  http.get(`${API}/value5step/list`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('criticalEvents'); } catch {}
    if (!items.length) {
      return HttpResponse.json({ success: true, data: { items: VALUE5STEP_FALLBACK, total: VALUE5STEP_FALLBACK.length } });
    }
    const STEP_ORDER: Record<string, number> = {
      pending: 0, notified: 1, voice_called: 2, overdue: 1,
      acknowledged: 3, receipted: 4, resolved: 5, closed_loop: 5, cancelled: 5, escalated: 2,
    };
    const data = items.slice(0, 50).map((cv: any) => {
      const currentStep = STEP_ORDER[String(cv.status)] ?? 0;
      return {
        id: cv.id,
        patientName: cv.patientName ?? '未知患者',
        finding: cv.criticalFinding ?? cv.finding ?? cv.findingDetails ?? cv.description ?? '危急值',
        severity: cv.severity ?? '危急',
        currentStep,
        steps: {
          discovered: { done: true, time: cv.reportedTime ?? cv.triggeredAt, user: cv.reportedByName ?? '自动检测' },
          voiceCall: { done: currentStep >= 2, time: cv.receivingTime, user: cv.receivingDoctorName, phone: cv.phone },
          acknowledged: { done: currentStep >= 3, time: cv.acknowledgedTime, user: cv.acknowledgedBy },
          receipted: { done: currentStep >= 4, time: cv.receivingTime, user: cv.receivingDoctorName, comment: cv.processingMeasure },
          closed: { done: currentStep >= 5 },
        },
      };
    });
    return HttpResponse.json({ success: true, data: { items: data, total: data.length } });
  }),

  // ---- 基础 CRUD（对齐后端 criticals.controller.ts @Controller('criticals')）----
  http.get(`${API}`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('criticalEvents'); } catch {}
    if (!items.length) {
      items = [
        { id: 'CV001', patientName: '张明远', finding: '颅内出血', severity: 'critical', status: 'pending', modality: 'CT', deviceName: 'CT-01', triggeredAt: new Date().toISOString() },
        { id: 'CV002', patientName: '李静', finding: '主动脉夹层', severity: 'urgent', status: 'notified', modality: 'CT', deviceName: 'CT-02', triggeredAt: new Date().toISOString(), notifiedAt: new Date().toISOString() },
        { id: 'CV003', patientName: '王强', finding: '急性心肌梗死', severity: 'high', status: 'acknowledged', modality: 'MR', deviceName: 'MR-01', triggeredAt: new Date().toISOString(), notifiedAt: new Date().toISOString() },
      ];
    }
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/stats/missed`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('criticalEvents'); } catch {}
    const total = items.length;
    const missed = countByStatus(items, ['pending', 'notified']);
    const missedRate = total > 0 ? `${((missed / total) * 100).toFixed(1)}%` : '0.0%';
    return HttpResponse.json({ success: true, data: {
      missed, total,
      totalExams: total,
      missedCount: missed,
      missedRate,
      topMissedReasons: [
        { reason: '登记信息不完整', count: Math.max(1, Math.round(missed / 2)) },
        { reason: '值班电话无人接听', count: Math.max(0, Math.round(missed / 3)) },
        { reason: '临床暂拒收', count: Math.max(0, missed - Math.round(missed / 2) - Math.round(missed / 3)) },
      ],
    } });
  }),
  http.get(`${API}/stats/notification`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('criticalEvents'); } catch {}
    const total = items.length;
    const success = items.filter((i) => !['pending', 'overdue'].includes(i.status)).length;
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = items.filter((i) => String(i.reportedTime ?? i.triggeredAt ?? '').startsWith(today)).length;
    return HttpResponse.json({ success: true, data: {
      total, byStatus: { SUCCESS: success, PENDING: items.length - success },
      totalCount: total,
      completedWithin10Min: Math.round(success * 0.9),
      completionRate: total > 0 ? Math.round((success / total) * 100) : 0,
      avgNotificationTime: '10',
      todayCount,
      todayCompleted: Math.round(todayCount * 0.9),
      todayRate: `${todayCount > 0 ? 90 : 0}%`,
    } });
  }),
  http.get(`${API}/:id`, async ({ params }) => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('criticalEvents'); } catch {}
    const found = items.find((i) => i.id === params.id);
    return HttpResponse.json({ success: true, data: found ?? { id: params.id, patientName: '未知', finding: '未知', severity: 'critical', status: 'pending', modality: 'CT', triggeredAt: new Date().toISOString() } });
  }),
  http.post(`${API}`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = { id: body.id || uuidv4(), ...body, severity: body.severity ?? 'critical', status: body.status ?? 'pending', triggeredAt: body.triggeredAt || new Date().toISOString() };
    try { create('criticalEvents', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.patch(`${API}/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    let items: any[] = [];
    try { items = list<any>('criticalEvents'); } catch {}
    const existing = items.find((i) => i.id === params.id) ?? { id: params.id };
    const updated = { ...existing, ...body };
    try { update('criticalEvents', params.id as string, updated); } catch {}
    return HttpResponse.json({ success: true, data: updated });
  }),
  http.delete(`${API}/:id`, async ({ params }) => {
    await delay(delayMs());
    try { remove('criticalEvents', params.id as string); } catch {}
    return HttpResponse.json({ success: true, data: {} });
  }),
  http.post(`${API}/:id/escalation-chain`, async ({ params }) => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: { id: params.id, chain: ['值班医生', '科主任', '医务处'], escalated: true } });
  }),
  http.get(`${API}/:criticalId/history`, async ({ params }) => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: [
      { id: 'H1', criticalId: params.criticalId, action: 'REPORTED', by: '放射技师', at: new Date().toISOString() },
      { id: 'H2', criticalId: params.criticalId, action: 'NOTIFIED', by: '值班医生', at: new Date().toISOString() },
    ] });
  }),
  http.post(`${API}/notify`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: body.id ?? 'CV001', status: 'notified', notifiedAt: new Date().toISOString() } });
  }),
  http.post(`${API}/escalate`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: body.id ?? 'CV001', status: 'escalated', escalatedAt: new Date().toISOString(), escalatedTo: body.to } });
  }),
];
