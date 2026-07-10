/**
 * G005 放射RIS系统 v3.0.5.1 - MSW Handlers
 * R3.WRITING(40) + R3.DIST(30) + R3.INTEGRATION(50) + R3.OTHER(20) = 140 handlers
 * + R3.REVIEW COSIGN(20) = 160 handlers
 * [v3.0.6.12-A4] top-20 高频路由读写 store
 */

import { http, HttpResponse, delay } from 'msw';
import { v4 as uuidv4 } from 'uuid';
import { list, get, create, update, remove } from './store';

const API_BASE = (() => {
  try { return window.location.origin + '/api/v1'; } catch { return 'http://localhost:5173/api/v1'; }
})();

// ============================================================
// 1. R3.WRITING(40 handlers)
// ============================================================
export const writingHandlers = [
  // 1.1 结构化字段模板(8)  [v3.0.6.12-A4] #1 GET /writing/templates - 读 store
  http.get(`${API_BASE}/writing/templates`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    let data: string[] = [];
    try {
      const all = list<{ id: string; name: string; category: string }>('writing_templates');
      if (all.length === 0) {
        const seed = ['recist', 'birads', 'pirads', 'lungRads', 'tiRads', 'cadRads'];
        seed.forEach((name) => create('writing_templates', { id: `tpl-${name}`, name, category: 'structured', version: '1.0.0' }));
        data = seed;
      } else {
        data = all.map(t => t.name).filter(n => !q || n.includes(q));
      }
    } catch { data = ['recist', 'birads', 'pirads', 'lungRads', 'tiRads', 'cadRads']; }
    return HttpResponse.json({ success: true, data });
  }),
  http.get(`${API_BASE}/writing/templates/:id`, async ({ params }) => { await delay(80); return HttpResponse.json({ success: true, data: { id: params.id, version: '1.0.0', fields: [], groups: [] } }); }),
  http.post(`${API_BASE}/writing/templates`, async () => { await delay(100); return HttpResponse.json({ success: true, data: { id: `tpl-${Date.now()}` } }, { status: 201 }); }),
  http.put(`${API_BASE}/writing/templates/:id`, async () => { await delay(80); return HttpResponse.json({ success: true }); }),
  http.delete(`${API_BASE}/writing/templates/:id`, async () => { await delay(80); return new HttpResponse(null, { status: 204 }); }),
  http.post(`${API_BASE}/writing/templates/:id/clone`, async () => { await delay(100); return HttpResponse.json({ success: true, data: { id: `tpl-clone-${Date.now()}` } }); }),
  http.post(`${API_BASE}/writing/templates/:id/approve`, async () => { await delay(100); return HttpResponse.json({ success: true }); }),
  http.get(`${API_BASE}/writing/templates/diff`, async () => { await delay(80); return HttpResponse.json({ success: true, data: { red: '', green: '' } }); }),

  // 1.2 字段类型(8)
  http.post(`${API_BASE}/writing/fields/text`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { value: 'string' } }); }),
  http.post(`${API_BASE}/writing/fields/number`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { value: 0 } }); }),
  http.post(`${API_BASE}/writing/fields/enum`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { value: '' } }); }),
  http.post(`${API_BASE}/writing/fields/multi-enum`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { value: [] } }); }),
  http.post(`${API_BASE}/writing/fields/date`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { value: new Date().toISOString() } }); }),
  http.post(`${API_BASE}/writing/fields/scale`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { value: 0 } }); }),
  http.post(`${API_BASE}/writing/fields/boolean`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { value: false } }); }),
  http.post(`${API_BASE}/writing/fields/image`, async () => { await delay(200); return HttpResponse.json({ success: true, data: { id: uuidv4(), url: '/upload' } }); }),

  // 1.3 RECIST / BI-RADS / PI-RADS(8)
  http.get(`${API_BASE}/writing/recist/lesions/:reportId`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ id: 'lesion-1', type: 'target', site: 'Lung', diameter: 25, response: 'SD' }, { id: 'lesion-2', type: 'non-target', site: 'Liver', diameter: 15, response: 'PR' }] }); }),
  http.get(`${API_BASE}/writing/recist/response/:reportId`, async () => { await delay(80); return HttpResponse.json({ success: true, data: { category: 'SD', categoryLabel: '疾病稳定' } }); }),
  http.get(`${API_BASE}/writing/birads/:reportId`, async () => { await delay(80); return HttpResponse.json({ success: true, data: { assessment: { category: '2' }, findings: [] } }); }),
  http.get(`${API_BASE}/writing/pirads/:reportId`, async () => { await delay(80); return HttpResponse.json({ success: true, data: { overallScore: 3 } }); }),
  http.post(`${API_BASE}/writing/recist/calc`, async () => { await delay(100); return HttpResponse.json({ success: true, data: { category: 'PR' } }); }),
  http.post(`${API_BASE}/writing/birads/calc`, async () => { await delay(100); return HttpResponse.json({ success: true, data: { category: '3' } }); }),
  http.post(`${API_BASE}/writing/pirads/calc`, async () => { await delay(100); return HttpResponse.json({ success: true, data: { overallScore: 4 } }); }),
  http.post(`${API_BASE}/writing/fields/formula`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { value: 0 } }); }),

  // 1.4 草稿(8)  [v3.0.6.12-A4] #2-#5 草稿读写 store
  http.get(`${API_BASE}/writing/drafts`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId');
    let data: any[] = [];
    try {
      const all = list<any>('writing_drafts');
      data = reportId ? all.filter(d => d.reportId === reportId) : all;
    } catch {}
    if (data.length === 0) data = [{ id: `draft-${reportId ?? '0'}`, reportId: reportId ?? '0', version: 7, autoSaved: true, content: '', status: 'draft', updatedAt: new Date().toISOString() }];
    return HttpResponse.json({ success: true, data });
  }),
  http.post(`${API_BASE}/writing/drafts`, async ({ request }) => {
    await delay(150);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = `draft-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const item = { id, reportId: body.reportId ?? '', content: body.content ?? '', status: 'draft', version: 1, autoSaved: false, createdBy: body.createdBy ?? 'system', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...body };
    try { create('writing_drafts', item); } catch {}
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
  http.put(`${API_BASE}/writing/drafts/:id`, async ({ params, request }) => {
    await delay(100);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = params.id as string;
    let updated: any = { id, ...body, updatedAt: new Date().toISOString() };
    try {
      const existing = get<any>('writing_drafts', id);
      if (existing) updated = update<any>('writing_drafts', id, { ...body, updatedAt: updated.updatedAt }) ?? updated;
      else create('writing_drafts', updated);
    } catch {}
    return HttpResponse.json({ success: true, data: updated });
  }),
  http.delete(`${API_BASE}/writing/drafts/:id`, async ({ params }) => {
    await delay(80);
    try { remove('writing_drafts', params.id as string); } catch {}
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${API_BASE}/writing/drafts/:id/auto-save`, async ({ params, request }) => {
    await delay(20);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = params.id as string;
    const savedAt = new Date().toISOString();
    try { update<any>('writing_drafts', id, { autoSaved: true, content: body.content, updatedAt: savedAt }); } catch {}
    return HttpResponse.json({ success: true, data: { id, savedAt } });
  }),
  http.post(`${API_BASE}/writing/drafts/:id/resolve-conflict`, async () => { await delay(100); return HttpResponse.json({ success: true }); }),
  http.get(`${API_BASE}/writing/drafts/:id/history`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ version: 1, content: '初稿', updatedAt: '2026-07-01T10:00:00Z', author: 'Dr. Zhang' }, { version: 2, content: '修改稿', updatedAt: '2026-07-02T14:00:00Z', author: 'Dr. Li' }] }); }),
  http.post(`${API_BASE}/writing/drafts/restore`, async () => { await delay(100); return HttpResponse.json({ success: true, data: { id: `draft-restored-${Date.now()}` } }); }),

  // 1.5 AI / 短语库 / RadLex / 预评分(8)  [v3.0.6.12-A4] #6 POST /writing/ai/draft - 写 store
  http.post(`${API_BASE}/writing/ai/draft`, async ({ request }) => {
    await delay(800);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = `aidraft-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const item = { id, reportId: body.reportId ?? '', scenario: body.scenario ?? 'chest-ct', clinicalHistory: body.clinicalHistory ?? '', stage: 'ready', confidence: 0.85, findings: body.findings ?? '', impression: body.impression ?? '', createdAt: new Date().toISOString() };
    try { create('writing_ai_drafts', item); } catch {}
    return HttpResponse.json({ success: true, data: item });
  }),
  http.get(`${API_BASE}/writing/ai/status/:reportId`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { stage: 'ready', progress: 100 } }); }),
  http.get(`${API_BASE}/writing/phrases`, async ({ request }) => { await delay(50); const url = new URL(request.url); const q = url.searchParams.get('q') ?? ''; return HttpResponse.json({ success: true, data: [{ id: 'p-1', text: '双肺透光度增加，肺纹理增多', category: 'finding' }, { id: 'p-2', text: '未见明显异常', category: 'conclusion' }, { id: 'p-3', text: '建议定期随访', category: 'recommendation' }].filter(p => !q || p.text.includes(q)), meta: { query: q } }); }),
  http.post(`${API_BASE}/writing/phrases`, async () => { await delay(80); return HttpResponse.json({ success: true, data: { id: `p-${Date.now()}` } }, { status: 201 }); }),
  http.post(`${API_BASE}/writing/phrases/:id/fav`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { favorite: true } }); }),
  http.get(`${API_BASE}/writing/radlex`, async ({ request }) => { await delay(50); const url = new URL(request.url); return HttpResponse.json({ success: true, data: [{ code: 'RID1234', term: '肺结节', category: 'finding' }, { code: 'RID5678', term: '毛刺征', category: 'morphology' }], meta: { q: url.searchParams.get('q') ?? '' } }); }),
  http.post(`${API_BASE}/writing/pre-score`, async () => { await delay(200); return HttpResponse.json({ success: true, data: { score: 88, passed: true } }); }),
  http.post(`${API_BASE}/writing/spellcheck`, async () => { await delay(100); return HttpResponse.json({ success: true, data: [{ word: '结疖', suggestions: ['结节', '结痂'], offset: 0 }] }); }),
];

// ============================================================
// 2. R3.DIST(30 handlers)
// ============================================================
export const distributionHandlers = [
  // 2.1 通道配置(5)  [v3.0.6.12-A4] #7-#9 channels 读写 store
  http.get(`${API_BASE}/dist/channels`, async () => {
    await delay(80);
    let data: any[] = [];
    try {
      data = list<any>('dist_channels');
      if (data.length === 0) {
        const seed = ['wechat', 'sms', 'dingtalk', 'email', 'inApp', 'dicom', 'paper', 'cloud', 'film'];
        seed.forEach(c => create('dist_channels', { id: c, channel: c, enabled: true }));
        data = seed.map(c => ({ id: c, channel: c, enabled: true }));
      } else {
        data = data.map(d => d.channel || d.id);
      }
    } catch { data = ['wechat', 'sms', 'dingtalk', 'email', 'inApp', 'dicom', 'paper', 'cloud', 'film']; }
    return HttpResponse.json({ success: true, data });
  }),
  http.get(`${API_BASE}/dist/channels/:channel`, async ({ params }) => {
    await delay(80);
    const ch = params.channel as string;
    let item: any = null;
    try { item = get<any>('dist_channels', ch) ?? null; } catch {}
    if (!item) item = { id: ch, channel: ch, enabled: true };
    return HttpResponse.json({ success: true, data: item });
  }),
  http.put(`${API_BASE}/dist/channels/:channel`, async ({ params, request }) => {
    await delay(150);
    const ch = params.channel as string;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    let updated: any = { id: ch, channel: ch, ...body };
    try { updated = update<any>('dist_channels', ch, body) ?? updated; } catch {}
    return HttpResponse.json({ success: true, data: updated });
  }),
  http.post(`${API_BASE}/dist/channels/:channel/test`, async () => { await delay(500); return HttpResponse.json({ success: true, data: { success: true, durationMs: 250 } }); }),
  http.get(`${API_BASE}/dist/channels/monitor`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { online: true, workers: 12, queueDepth: 24 } }); }),

  // 2.2 推送任务(8)  [v3.0.6.12-A4] #10-#12 dist_tasks 读写 store
  http.get(`${API_BASE}/dist/tasks`, async () => {
    await delay(80);
    let data: any[] = [];
    try {
      data = list<any>('dist_tasks');
      if (data.length === 0) {
        const seed = [
          { id: 'dt-001', channel: 'wechat', target: '张三', reportId: 'R-001', status: 'sent', sentAt: '2026-07-03T10:00:00Z' },
          { id: 'dt-002', channel: 'sms', target: '李四', reportId: 'R-002', status: 'pending' },
        ];
        seed.forEach(s => create('dist_tasks', s));
        data = seed;
      }
    } catch { data = []; }
    return HttpResponse.json({ success: true, data, meta: { total: data.length } });
  }),
  http.get(`${API_BASE}/dist/tasks/:id`, async ({ params }) => {
    await delay(50);
    let item: any = { id: params.id, status: 'pending' };
    try { const got = get<any>('dist_tasks', params.id as string); if (got) item = got; } catch {}
    return HttpResponse.json({ success: true, data: item });
  }),
  http.post(`${API_BASE}/dist/tasks`, async ({ request }) => {
    await delay(200);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = `dt-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const item = { id, channel: body.channel ?? 'inApp', target: body.target ?? '', reportId: body.reportId ?? '', status: 'pending', createdAt: new Date().toISOString(), ...body };
    try { create('dist_tasks', item); } catch {}
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
  http.post(`${API_BASE}/dist/tasks/multi`, async () => { await delay(500); return HttpResponse.json({ success: true, data: { taskIds: [`dtm-1`, `dtm-2`], sent: 2, failed: 0 } }); }),
  http.post(`${API_BASE}/dist/tasks/:id/retry`, async () => { await delay(300); return HttpResponse.json({ success: true, data: { newStatus: 'queued' } }); }),
  http.post(`${API_BASE}/dist/tasks/:id/cancel`, async () => { await delay(150); return HttpResponse.json({ success: true }); }),
  http.get(`${API_BASE}/dist/queue`, async () => {
    await delay(50);
    let stats = { pending: 0, sending: 0, failed: 0 };
    try {
      const tasks = list<any>('dist_tasks');
      stats.pending = tasks.filter(t => t.status === 'pending' || t.status === 'queued').length;
      stats.sending = tasks.filter(t => t.status === 'sending').length;
      stats.failed = tasks.filter(t => t.status === 'failed').length;
    } catch {}
    if (stats.pending === 0 && stats.sending === 0 && stats.failed === 0) stats = { pending: 24, sending: 8, failed: 3 };
    return HttpResponse.json({ success: true, data: stats });
  }),
  http.get(`${API_BASE}/dist/history`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ date: '2026-07-03', channel: 'wechat', total: 15, success: 14, failed: 1 }, { date: '2026-07-02', channel: 'sms', total: 8, success: 8, failed: 0 }] }); }),

  // 2.3 HL7 ORU + MLLP(4)
  http.post(`${API_BASE}/dist/hl7/oru/build`, async () => { await delay(100); return HttpResponse.json({ success: true, data: { message: 'MSH|^~\\&|...', bytes: 2048 } }); }),
  http.post(`${API_BASE}/dist/hl7/oru/send`, async () => { await delay(500); return HttpResponse.json({ success: true, data: { ack: 'AA', durationMs: 420 } }); }),
  http.post(`${API_BASE}/dist/hl7/orm/build`, async () => { await delay(80); return HttpResponse.json({ success: true, data: { message: 'MSH|...', bytes: 1024 } }); }),
  http.post(`${API_BASE}/dist/hl7/adt/build`, async () => { await delay(80); return HttpResponse.json({ success: true, data: { message: 'MSH|...', bytes: 512 } }); }),

  // 2.4 送达回执(5)  [v3.0.6.12-A4] #13-#14 receipts 读写 store
  http.get(`${API_BASE}/dist/receipts`, async () => {
    await delay(80);
    let data: any[] = [];
    try {
      data = list<any>('dist_receipts');
      if (data.length === 0) {
        const seed = [
          { id: 'rcp-001', taskId: 'dt-001', channel: 'wechat', status: 'verified', verifiedAt: '2026-07-03T10:05:00Z' },
          { id: 'rcp-002', taskId: 'dt-002', channel: 'sms', status: 'pending' },
        ];
        seed.forEach(s => create('dist_receipts', s));
        data = seed;
      }
    } catch { data = []; }
    return HttpResponse.json({ success: true, data });
  }),
  http.get(`${API_BASE}/dist/receipts/:id`, async ({ params }) => {
    await delay(50);
    let item: any = { id: params.id, verified: false };
    try { const got = get<any>('dist_receipts', params.id as string); if (got) item = got; } catch {}
    return HttpResponse.json({ success: true, data: item });
  }),
  http.post(`${API_BASE}/dist/receipts/:id/verify`, async ({ params, request }) => {
    await delay(150);
    const id = params.id as string;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const verifiedAt = new Date().toISOString();
    let updated: any = { id, status: 'verified', verified: true, details: body.details ?? '签名通过', verifiedAt };
    try { updated = update<any>('dist_receipts', id, { status: 'verified', verified: true, details: body.details ?? '签名通过', verifiedAt }) ?? updated; } catch {}
    return HttpResponse.json({ success: true, data: updated });
  }),
  http.post(`${API_BASE}/dist/receipts/:id/events`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { id: `e-${Date.now()}` } }); }),
  http.get(`${API_BASE}/dist/kpi`, async () => {
    await delay(80);
    let data = { totalSent: 0, successRate: 0, avgDeliveryTime: 0, channelBreakdown: {} as Record<string, number> };
    try {
      const tasks = list<any>('dist_tasks');
      const rcp = list<any>('dist_receipts');
      data.totalSent = tasks.length || 128;
      const verified = rcp.filter(r => r.status === 'verified').length;
      data.successRate = tasks.length ? Math.round((verified / tasks.length) * 1000) / 10 : 96.8;
      data.avgDeliveryTime = 2.4;
      const breakdown: Record<string, number> = {};
      tasks.forEach(t => { breakdown[t.channel] = (breakdown[t.channel] || 0) + 1; });
      data.channelBreakdown = Object.keys(breakdown).length ? breakdown : { wechat: 85, sms: 30, email: 13 };
    } catch {
      data = { totalSent: 128, successRate: 96.8, avgDeliveryTime: 2.4, channelBreakdown: { wechat: 85, sms: 30, email: 13 } };
    }
    return HttpResponse.json({ success: true, data });
  }),

  // 2.5 患者端(4)
  http.get(`${API_BASE}/dist/patient/links`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ id: 'pl-001', patient: '张三', shortCode: 'ABC123', expiresAt: '2026-08-03T10:00:00Z', views: 2 }, { id: 'pl-002', patient: '李四', shortCode: 'DEF456', expiresAt: '2026-08-02T11:00:00Z', views: 0 }] }); }),
  http.post(`${API_BASE}/dist/patient/links`, async () => { await delay(200); return HttpResponse.json({ success: true, data: { id: `pl-${Date.now()}`, shortCode: 'ABC123' } }, { status: 201 }); }),
  http.post(`${API_BASE}/dist/patient/links/:id/revoke`, async () => { await delay(100); return HttpResponse.json({ success: true }); }),
  http.get(`${API_BASE}/dist/patient/links/:id/views`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ ip: '192.168.1.100', viewedAt: '2026-07-03T10:05:00Z', device: 'Mobile' }, { ip: '192.168.1.101', viewedAt: '2026-07-03T14:00:00Z', device: 'Desktop' }] }); }),

  // 2.6 策略(4)
  http.get(`${API_BASE}/dist/policies`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ id: 'dp-001', name: '默认分发策略', channels: ['wechat', 'sms'], priority: 1, enabled: true }, { id: 'dp-002', name: '紧急报告策略', channels: ['wechat', 'sms', 'phone'], priority: 0, enabled: true }] }); }),
  http.put(`${API_BASE}/dist/policies/:id`, async () => { await delay(150); return HttpResponse.json({ success: true }); }),
  http.post(`${API_BASE}/dist/policies`, async () => { await delay(150); return HttpResponse.json({ success: true, data: { id: `dp-${Date.now()}` } }); }),
  http.delete(`${API_BASE}/dist/policies/:id`, async () => { await delay(80); return new HttpResponse(null, { status: 204 }); }),
];

// ============================================================
// 3. R3.INTEGRATION(50 handlers)
// ============================================================
export const integrationHandlers = [
  // 3.1 HL7 CDA R2(8)
  http.get(`${API_BASE}/integration/cda`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ id: 'cda-001', patient: '张三', type: 'DiagnosticReport', created: '2026-07-01', status: 'final' }] }); }),
  http.get(`${API_BASE}/integration/cda/:id`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { id: 'cda-001', validation: { passed: true } } }); }),
  http.post(`${API_BASE}/integration/cda`, async () => { await delay(200); return HttpResponse.json({ success: true, data: { id: `cda-${Date.now()}` } }, { status: 201 }); }),
  http.post(`${API_BASE}/integration/cda/:id/validate`, async () => { await delay(100); return HttpResponse.json({ success: true, data: { passed: true, errors: [], warnings: [] } }); }),
  http.post(`${API_BASE}/integration/cda/:id/parse`, async () => { await delay(80); return HttpResponse.json({ success: true, data: { sections: [] } }); }),
  http.get(`${API_BASE}/integration/cda/:id/download`, async () => { await delay(150); return HttpResponse.json({ success: true, data: { content: '<?xml...', mime: 'application/cda+xml' } }); }),
  http.post(`${API_BASE}/integration/cda/:id/sign`, async () => { await delay(300); return HttpResponse.json({ success: true, data: { signedBy: '王主任' } }); }),
  http.get(`${API_BASE}/integration/cda/sections`, async () => { await delay(50); return HttpResponse.json({ success: true, data: ['10164-2', '29545-1', '18776-5'] }); }),

  // 3.2 DICOM SR(8)
  http.get(`${API_BASE}/integration/dicom-sr`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ id: 'sr-001', studyUid: '1.2.840.10008.5.1.4.1.1.2', templateId: 'TID2000', status: 'final' }] }); }),
  http.get(`${API_BASE}/integration/dicom-sr/:id`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { id: 'sr-001', templateId: 'TID2000' } }); }),
  http.post(`${API_BASE}/integration/dicom-sr`, async () => { await delay(300); return HttpResponse.json({ success: true, data: { id: `sr-${Date.now()}` } }, { status: 201 }); }),
  http.post(`${API_BASE}/integration/dicom-sr/:id/validate`, async () => { await delay(100); return HttpResponse.json({ success: true, data: { passed: true } }); }),
  http.post(`${API_BASE}/integration/dicom-sr/:id/send`, async () => { await delay(1000); return HttpResponse.json({ success: true, data: { status: 'Success', statusCode: 0x0000 } }); }),
  http.get(`${API_BASE}/integration/dicom-sr/:id/download`, async () => { await delay(150); return HttpResponse.json({ success: true, data: { content: 'DICOM-File', mime: 'application/dicom' } }); }),
  http.get(`${API_BASE}/integration/dicom-sr/templates`, async () => { await delay(50); return HttpResponse.json({ success: true, data: ['TID2000', 'TID2010'] }); }),
  http.post(`${API_BASE}/integration/dicom-sr/:id/dump`, async () => { await delay(100); return HttpResponse.json({ success: true, data: { text: '# DICOM SR...' } }); }),

  // 3.3 FHIR R4(8)
  http.get(`${API_BASE}/integration/fhir/diagnostic-report`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ id: 'fhir-001', resourceType: 'DiagnosticReport', status: 'final', subject: { reference: 'Patient/P001' } }] }); }),
  http.get(`${API_BASE}/integration/fhir/diagnostic-report/:id`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { resourceType: 'DiagnosticReport', id: 'fhir-001' } }); }),
  http.post(`${API_BASE}/integration/fhir/diagnostic-report`, async () => { await delay(200); return HttpResponse.json({ success: true, data: { id: `fhir-${Date.now()}` } }, { status: 201 }); }),
  http.post(`${API_BASE}/integration/fhir/diagnostic-report/:id/send`, async () => { await delay(800); return HttpResponse.json({ success: true, data: { statusCode: 201, durationMs: 620 } }); }),
  http.post(`${API_BASE}/integration/fhir/bundle`, async () => { await delay(300); return HttpResponse.json({ success: true, data: { resourceType: 'Bundle', type: 'collection', total: 0 } }); }),
  http.post(`${API_BASE}/integration/fhir/validate`, async () => { await delay(100); return HttpResponse.json({ success: true, data: { passed: true } }); }),
  http.get(`${API_BASE}/integration/fhir/diagnostic-report/:id/download`, async () => { await delay(150); return HttpResponse.json({ success: true, data: { content: '{}', mime: 'application/fhir+json' } }); }),
  http.post(`${API_BASE}/integration/fhir/oauth2/token`, async () => { await delay(500); return HttpResponse.json({ success: true, data: { access_token: 'mock-token', token_type: 'Bearer', expires_in: 3600 } }); }),

  // 3.4 IHE XDS.b(8)
  http.get(`${API_BASE}/integration/xds/registries`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ id: 'xds-001', name: '主注册中心', type: 'XDS.b', status: 'active' }] }); }),
  http.get(`${API_BASE}/integration/xds/registries/:id`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { id: 'xds-001' } }); }),
  http.post(`${API_BASE}/integration/xds/registries`, async () => { await delay(800); return HttpResponse.json({ success: true, data: { id: `xds-${Date.now()}` } }, { status: 201 }); }),
  http.post(`${API_BASE}/integration/xds/registries/:id/validate`, async () => { await delay(100); return HttpResponse.json({ success: true, data: { passed: true } }); }),
  http.post(`${API_BASE}/integration/xds/query`, async () => { await delay(300); return HttpResponse.json({ success: true, data: [{ id: 'doc-001', patientId: 'P001', status: 'available' }] }); }),
  http.get(`${API_BASE}/integration/xds/registries/:id/ebxml`, async () => { await delay(150); return HttpResponse.json({ success: true, data: { content: '<?xml...', mime: 'application/xml' } }); }),
  http.post(`${API_BASE}/integration/xds/stored-query/find-documents`, async () => { await delay(300); return HttpResponse.json({ success: true, data: [{ id: 'doc-001', title: 'Chest CT Report', format: 'CDA' }] }); }),
  http.post(`${API_BASE}/integration/xds/stored-query/find-folders`, async () => { await delay(300); return HttpResponse.json({ success: true, data: [{ id: 'fld-001', title: '2026-07 Studies' }] }); }),

  // 3.5 HIS(6)
  http.post(`${API_BASE}/integration/his/order`, async () => { await delay(200); return HttpResponse.json({ success: true, data: { id: `ord-${Date.now()}` } }); }),
  http.post(`${API_BASE}/integration/his/patient`, async () => { await delay(200); return HttpResponse.json({ success: true }); }),
  http.post(`${API_BASE}/integration/his/report`, async () => { await delay(300); return HttpResponse.json({ success: true }); }),
  http.post(`${API_BASE}/integration/his/critical`, async () => { await delay(200); return HttpResponse.json({ success: true }); }),
  http.get(`${API_BASE}/integration/his/status`, async () => { await delay(80); return HttpResponse.json({ success: true, data: { connected: true, host: 'his.hospital.com' } }); }),
  http.get(`${API_BASE}/integration/his/config`, async () => { await delay(80); return HttpResponse.json({ success: true, data: { host: 'his.hospital.com', port: 6661 } }); }),

  // 3.6 PACS(6)
  http.get(`${API_BASE}/pacs/studies`, async () => { await delay(200); return HttpResponse.json({ success: true, data: [{ studyInstanceUID: '1.2.840.10008.5.1.4.1.1.2', patientName: '张三', modality: 'CT', date: '2026-07-01', description: 'Chest CT' }] }); }),
  http.get(`${API_BASE}/pacs/studies/:uid`, async () => { await delay(300); return HttpResponse.json({ success: true, data: { studyInstanceUID: '1.2.840...' } }); }),
  http.post(`${API_BASE}/pacs/verify`, async () => { await delay(500); return HttpResponse.json({ success: true, data: { matched: true, score: 0.95 } }); }),
  http.get(`${API_BASE}/pacs/wado/:uid`, async () => { await delay(300); return HttpResponse.json({ success: true, data: { contentType: 'application/dicom' } }); }),
  http.get(`${API_BASE}/pacs/qido`, async () => { await delay(200); return HttpResponse.json({ success: true, data: [{ studyInstanceUID: '1.2.840.10008.5.1.4.1.1.2', modality: 'CT', patientName: '张三' }] }); }),
  http.post(`${API_BASE}/pacs/stow`, async () => { await delay(400); return HttpResponse.json({ success: true }); }),

  // 3.7 EHR / BI / Webhook(6)
  http.post(`${API_BASE}/integration/ehr`, async () => { await delay(300); return HttpResponse.json({ success: true }); }),
  http.post(`${API_BASE}/integration/ehr/pull`, async () => { await delay(400); return HttpResponse.json({ success: true, data: [{ id: 'ehr-001', resourceType: 'Observation', code: '12345', value: '正常' }] }); }),
  http.get(`${API_BASE}/integration/bi/board`, async () => { await delay(200); return HttpResponse.json({ success: true, data: { totalReports: 1240 } }); }),
  http.post(`${API_BASE}/integration/webhooks`, async () => { await delay(200); return HttpResponse.json({ success: true, data: { id: `wh-${Date.now()}` } }); }),
  http.post(`${API_BASE}/integration/webhooks/:id/test`, async () => { await delay(500); return HttpResponse.json({ success: true, data: { delivered: true, statusCode: 200 } }); }),
  http.get(`${API_BASE}/integration/webhooks/:id/log`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ event: 'report.sent', status: 200, timestamp: '2026-07-03T10:00:00Z' }, { event: 'report.sent', status: 200, timestamp: '2026-07-03T09:00:00Z' }] }); }),
];

// ============================================================
// 4. R3.OTHER(20 handlers)
// ============================================================
export const otherHandlers = [
  // 4.1 通知中心(5)
  http.get(`${API_BASE}/notifications`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ id: 'notif-001', type: 'review', title: '新审核任务', message: '报告R-001待审核', read: false, createdAt: '2026-07-04T10:00:00Z' }, { id: 'notif-002', type: 'critical', title: '危急值', message: '患者张三CT发现主动脉夹层', read: false, createdAt: '2026-07-04T09:30:00Z' }] }); }),
  http.put(`${API_BASE}/notifications/:id/read`, async () => { await delay(30); return HttpResponse.json({ success: true }); }),
  http.get(`${API_BASE}/notifications/unread`, async () => { await delay(30); return HttpResponse.json({ success: true, data: { count: 12 } }); }),
  http.get(`${API_BASE}/notifications/prefs`, async () => { await delay(80); return HttpResponse.json({ success: true, data: { dndStartHour: 22, dndEndHour: 8 } }); }),
  http.put(`${API_BASE}/notifications/prefs`, async () => { await delay(80); return HttpResponse.json({ success: true }); }),

  // 4.2 监控埋点(5)
  http.post(`${API_BASE}/analytics`, async () => { await delay(30); return new HttpResponse(null, { status: 204 }); }),
  http.post(`${API_BASE}/analytics/error`, async () => { await delay(30); return new HttpResponse(null, { status: 204 }); }),
  http.post(`${API_BASE}/analytics/perf`, async () => { await delay(30); return new HttpResponse(null, { status: 204 }); }),
  http.get(`${API_BASE}/analytics/dashboard`, async () => { await delay(200); return HttpResponse.json({ success: true, data: { todayEvents: 1240, topEvents: [{ name: '报告完成', count: 45 }, { name: '危急值', count: 3 }, { name: '审核退回', count: 2 }] } }); }),
  http.post(`${API_BASE}/analytics/ab-test`, async () => { await delay(30); return HttpResponse.json({ success: true }); }),

  // 4.3 i18n(3)
  http.get(`${API_BASE}/i18n/locales`, async () => { await delay(30); return HttpResponse.json({ success: true, data: ['zh-CN', 'en-US', 'ar', 'he', 'fa', 'ur'] }); }),
  http.put(`${API_BASE}/i18n/locales/:lng`, async () => { await delay(30); return HttpResponse.json({ success: true }); }),
  http.post(`${API_BASE}/i18n/translate`, async () => { await delay(200); return HttpResponse.json({ success: true, data: { key: 'translated' } }); }),

  // 4.4 PWA(3)
  http.get(`${API_BASE}/pwa/manifest`, async () => { await delay(30); return HttpResponse.json({ success: true, data: { name: 'G005 RIS' } }); }),
  http.post(`${API_BASE}/pwa/subscribe`, async () => { await delay(100); return HttpResponse.json({ success: true, data: { endpoint: 'mock-endpoint' } }); }),
  http.post(`${API_BASE}/pwa/sync`, async () => { await delay(200); return HttpResponse.json({ success: true, data: { synced: 0 } }); }),

  // 4.5 帮助 / 反馈 / 版本(4)
  http.get(`${API_BASE}/help/articles`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ id: 'a-1', title: '如何书写放射报告', category: 'report' }, { id: 'a-2', title: '危急值处理流程', category: 'critical' }] }); }),
  http.post(`${API_BASE}/feedback`, async () => { await delay(100); return HttpResponse.json({ success: true, data: { id: `fb-${Date.now()}` } }); }),
  http.get(`${API_BASE}/version`, async () => { await delay(30); return HttpResponse.json({ success: true, data: { version: '3.0.5.1', buildTime: '2026-09-15' } }); }),
  http.get(`${API_BASE}/changelog`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ version: 'v3.0.6.8', date: '2026-07-01', changes: ['新增眼科模块', '修复MSW路径'] }] }); }),
];

// ============================================================
// 5. R3.REVIEW COSIGN(20 handlers)
//    覆盖: 排班/急诊双签/多人签/签冲突/自动派主任/SLA 监控/历史/跳过配置/临时授权/批量签
// ============================================================
export const cosignHandlers = [
  // 5.1 排班 + 签人(3)
  http.get(`${API_BASE}/review/cosign/calendar`, async ({ request }) => {
    await delay(120);
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const { COSIGN_CALENDAR_V2 } = await import('../../data/cosignMock');
    let list = COSIGN_CALENDAR_V2.slice();
    if (date) list = list.filter((c) => c.date === date);
    return HttpResponse.json({ success: true, data: list });
  }),
  http.post(`${API_BASE}/review/cosign/calendar`, async ({ request }) => {
    await delay(180);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ success: true, data: { id: `cc-${Date.now()}`, ...body, reserved: 0, status: 'scheduled' } }, { status: 201 });
  }),
  http.get(`${API_BASE}/review/cosign/reviewers`, async () => {
    await delay(120);
    const { COSIGN_REVIEWERS } = await import('../../data/cosignMock');
    return HttpResponse.json({ success: true, data: COSIGN_REVIEWERS });
  }),

  // 5.2 双签记录(3)
  http.get(`${API_BASE}/review/cosign/records`, async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const { COSIGN_RECORDS } = await import('../../data/cosignMock');
    let list = COSIGN_RECORDS.slice();
    if (status) list = list.filter((r) => r.status === status);
    return HttpResponse.json({ success: true, data: list });
  }),
  http.get(`${API_BASE}/review/cosign/records/:id`, async ({ params }) => {
    await delay(120);
    const { COSIGN_RECORDS } = await import('../../data/cosignMock');
    const r = COSIGN_RECORDS.find((x) => x.id === params.id);
    if (!r) return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    return HttpResponse.json({ success: true, data: r });
  }),
  http.post(`${API_BASE}/review/cosign/records/:id/skip`, async ({ params, request }) => {
    await delay(180);
    const body = (await request.json()) as { reason: string; comment: string };
    if (!body.comment || body.comment.trim().length < 5) return HttpResponse.json({ success: false, message: '说明不能少于 5 字符' }, { status: 400 });
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'skipped', reason: body.reason, comment: body.comment, skippedAt: new Date().toISOString() } });
  }),

  // 5.3 急诊双签(2)
  http.get(`${API_BASE}/review/cosign/emergency`, async () => {
    await delay(150);
    const { COSIGN_EMERGENCY } = await import('../../data/cosignMock');
    return HttpResponse.json({ success: true, data: COSIGN_EMERGENCY });
  }),
  http.post(`${API_BASE}/review/cosign/emergency`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ success: true, data: { id: `em-${Date.now()}`, smsSent: true, emailSent: true, phoneCalled: false, appPushed: true, ...body } }, { status: 201 });
  }),

  // 5.4 多人签(2)
  http.get(`${API_BASE}/review/cosign/multi-sign`, async () => {
    await delay(120);
    const { COSIGN_MULTI_SIGN } = await import('../../data/cosignMock');
    return HttpResponse.json({ success: true, data: COSIGN_MULTI_SIGN });
  }),
  http.post(`${API_BASE}/review/cosign/multi-sign/:id/sign`, async ({ params, request }) => {
    await delay(220);
    const body = (await request.json()) as { signerId: string; certificateId: string };
    return HttpResponse.json({ success: true, data: { id: params.id, signerId: body.signerId, signedAt: new Date().toISOString(), certificateId: body.certificateId } });
  }),

  // 5.5 签冲突(2)
  http.get(`${API_BASE}/review/cosign/conflicts`, async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const { COSIGN_CONFLICTS } = await import('../../data/cosignMock');
    let list = COSIGN_CONFLICTS.slice();
    if (status) list = list.filter((c) => c.status === status);
    return HttpResponse.json({ success: true, data: list });
  }),
  http.post(`${API_BASE}/review/cosign/conflicts/:id/resolve`, async ({ params, request }) => {
    await delay(220);
    const body = (await request.json()) as { resolution: string };
    return HttpResponse.json({ success: true, data: { id: params.id, resolution: body.resolution, resolvedAt: new Date().toISOString(), status: 'resolved' } });
  }),

  // 5.6 自动派主任(2)
  http.get(`${API_BASE}/review/cosign/superior-rules`, async () => {
    await delay(120);
    const { COSIGN_SUPERIOR_RULES } = await import('../../data/cosignMock');
    return HttpResponse.json({ success: true, data: COSIGN_SUPERIOR_RULES });
  }),
  http.post(`${API_BASE}/review/cosign/auto-assign`, async ({ request }) => {
    await delay(220);
    const body = (await request.json()) as { ruleId: string; reportId: string; modality: string; priority: string };
    const { COSIGN_REVIEWERS, COSIGN_SUPERIOR_RULES } = await import('../../data/cosignMock');
    const rule = COSIGN_SUPERIOR_RULES.find((r) => r.id === body.ruleId);
    if (!rule) return HttpResponse.json({ success: false, message: 'Rule not found' }, { status: 404 });
    const eligible = COSIGN_REVIEWERS.filter((rv) => rv.title === 'chief' || rv.title === 'associateChief');
    const sorted = eligible.slice().sort((a, b) => a.currentLoad - b.currentLoad);
    const assigned = sorted[0] ?? null;
    return HttpResponse.json({ success: true, data: { assigned, rule, reason: assigned ? `自动派主任:${assigned.name}` : '无可用主任' } });
  }),

  // 5.7 SLA 监控(2)
  http.get(`${API_BASE}/review/cosign/sla/config`, async () => {
    await delay(120);
    const { COSIGN_SLA_CONFIG } = await import('../../data/cosignMock');
    return HttpResponse.json({ success: true, data: COSIGN_SLA_CONFIG });
  }),
  http.get(`${API_BASE}/review/cosign/sla/metrics`, async () => {
    await delay(150);
    const { COSIGN_SLA_METRICS } = await import('../../data/cosignMock');
    return HttpResponse.json({ success: true, data: COSIGN_SLA_METRICS });
  }),

  // 5.8 历史(1)
  http.get(`${API_BASE}/review/cosign/history/:reportId`, async ({ params }) => {
    await delay(120);
    const { COSIGN_RECORDS } = await import('../../data/cosignMock');
    const recs = COSIGN_RECORDS.filter((r) => r.reportId === params.reportId);
    const all = recs.flatMap((r) => r.history);
    return HttpResponse.json({ success: true, data: all });
  }),

  // 5.9 跳过配置(1)
  http.get(`${API_BASE}/review/cosign/skip-config`, async () => {
    await delay(100);
    const { COSIGN_SKIP_CONFIG } = await import('../../data/cosignMock');
    return HttpResponse.json({ success: true, data: COSIGN_SKIP_CONFIG });
  }),

  // 5.10 临时授权(2)
  http.get(`${API_BASE}/review/cosign/temp-auths`, async ({ request }) => {
    await delay(120);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const { COSIGN_TEMP_AUTHS } = await import('../../data/cosignMock');
    let list = COSIGN_TEMP_AUTHS.slice();
    if (status) list = list.filter((t) => t.status === status);
    return HttpResponse.json({ success: true, data: list });
  }),
  http.post(`${API_BASE}/review/cosign/temp-auths/:id/revoke`, async ({ params, request }) => {
    await delay(180);
    const body = (await request.json()) as { reason: string };
    return HttpResponse.json({ success: true, data: { id: params.id, status: 'revoked', revokedAt: new Date().toISOString(), reason: body.reason } });
  }),

  // 5.11 批量签(2)
  http.get(`${API_BASE}/review/cosign/batch`, async () => {
    await delay(120);
    const { COSIGN_BATCH_REQUESTS } = await import('../../data/cosignMock');
    return HttpResponse.json({ success: true, data: COSIGN_BATCH_REQUESTS });
  }),
  http.post(`${API_BASE}/review/cosign/batch/:id/execute`, async ({ params }) => {
    await delay(800);
    return HttpResponse.json({ success: true, data: { id: params.id, executedAt: new Date().toISOString(), successCount: 4, failCount: 0 } });
  }),

  // 5.12 仪表盘(1)
  http.get(`${API_BASE}/review/cosign/dashboard`, async () => {
    await delay(200);
    const { COSIGN_DASHBOARD_KPI } = await import('../../data/cosignMock');
    return HttpResponse.json({ success: true, data: COSIGN_DASHBOARD_KPI });
  }),

  // 5.13 证书(1)
  http.get(`${API_BASE}/review/cosign/certificates`, async () => {
    await delay(80);
    const { COSIGN_CERTIFICATES } = await import('../../data/cosignMock');
    return HttpResponse.json({ success: true, data: COSIGN_CERTIFICATES });
  }),
];

// ============================================================
// 6. R3.QUALITY REPORT (15 handlers)
//    v3.0.5.1 月报/季报/年报/实时仪表盘/导出/配置
// ============================================================
export const qualityReportHandlers = [
  // 6.1 月报 (4)  [v3.0.6.12-A4] #16 GET /quality/monthly-report - 优先读 store
  http.get(`${API_BASE}/quality/monthly-report`, async ({ request }) => {
    await delay(1000);
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') ?? '2026', 10);
    const month = parseInt(url.searchParams.get('month') ?? '6', 10);
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const { getMonthlyReport } = await import('../../data/qualityReportMock');
    let storeItem: any = null;
    try { storeItem = get<any>('quality_reports', `monthly-${key}`); } catch {}
    if (storeItem) return HttpResponse.json({ success: true, data: storeItem.content });
    const report = getMonthlyReport(year, month);
    try { create('quality_reports', { id: `monthly-${key}`, period: key, type: 'monthly', content: report, status: 'final', createdAt: new Date().toISOString() }); } catch {}
    return HttpResponse.json({ success: true, data: report });
  }),
  http.get(`${API_BASE}/quality/monthly-report/list`, async () => {
    await delay(300);
    const { MONTHLY_QUALITY_REPORTS } = await import('../../data/qualityReportMock');
    return HttpResponse.json({ success: true, data: MONTHLY_QUALITY_REPORTS });
  }),
  http.get(`${API_BASE}/quality/monthly-report/latest`, async () => {
    await delay(500);
    const { getMonthlyReport } = await import('../../data/qualityReportMock');
    return HttpResponse.json({ success: true, data: getMonthlyReport(2026, 6) });
  }),
  http.get(`${API_BASE}/quality/monthly-report/sections`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') ?? '2026', 10);
    const month = parseInt(url.searchParams.get('month') ?? '6', 10);
    const { getMonthlyReport } = await import('../../data/qualityReportMock');
    const r = getMonthlyReport(year, month);
    return HttpResponse.json({ success: true, data: r.sections });
  }),

  // 6.2 季报/年报 (3)  [v3.0.6.12-A4] #17-#18 quarterly/annual report - 优先读 store
  http.get(`${API_BASE}/quality/quarterly-report`, async ({ request }) => {
    await delay(1200);
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') ?? '2026', 10);
    const q = parseInt(url.searchParams.get('quarter') ?? '2', 10) as 1 | 2 | 3 | 4;
    const { QUARTERLY_QUALITY_REPORTS } = await import('../../data/qualityReportMock');
    const key = `quarterly-${year}-Q${q}`;
    let storeItem: any = null;
    try { storeItem = get<any>('quality_reports', key); } catch {}
    if (storeItem) return HttpResponse.json({ success: true, data: storeItem.content });
    const r = QUARTERLY_QUALITY_REPORTS.find((x) => x.year === year && x.quarter === q) ?? QUARTERLY_QUALITY_REPORTS[0];
    try { create('quality_reports', { id: key, period: `${year}-Q${q}`, type: 'quarterly', content: r, status: 'final', createdAt: new Date().toISOString() }); } catch {}
    return HttpResponse.json({ success: true, data: r });
  }),
  http.get(`${API_BASE}/quality/quarterly-report/list`, async () => {
    await delay(300);
    const { QUARTERLY_QUALITY_REPORTS } = await import('../../data/qualityReportMock');
    return HttpResponse.json({ success: true, data: QUARTERLY_QUALITY_REPORTS });
  }),
  http.get(`${API_BASE}/quality/annual-report`, async ({ request }) => {
    await delay(1500);
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') ?? '2026', 10);
    const { ANNUAL_QUALITY_REPORT } = await import('../../data/qualityReportMock');
    const key = `annual-${year}`;
    let storeItem: any = null;
    try { storeItem = get<any>('quality_reports', key); } catch {}
    if (storeItem) return HttpResponse.json({ success: true, data: storeItem.content });
    const data = { ...ANNUAL_QUALITY_REPORT, year };
    try { create('quality_reports', { id: key, period: `${year}`, type: 'annual', content: data, status: 'final', createdAt: new Date().toISOString() }); } catch {}
    return HttpResponse.json({ success: true, data });
  }),

  // 6.3 实时仪表盘 (2)  [v3.0.6.12-A4] #19 GET /quality/dashboard - 读 store
  http.get(`${API_BASE}/quality/dashboard`, async () => {
    await delay(200);
    const { QUALITY_DASHBOARD_MOCK } = await import('../../data/qualityReportMock');
    let storeItem: any = null;
    try { storeItem = get<any>('quality_reports', 'dashboard-live'); } catch {}
    if (storeItem) return HttpResponse.json({ success: true, data: { ...QUALITY_DASHBOARD_MOCK, ...storeItem.content, updatedAt: new Date().toISOString() } });
    return HttpResponse.json({ success: true, data: { ...QUALITY_DASHBOARD_MOCK, updatedAt: new Date().toISOString() } });
  }),
  http.get(`${API_BASE}/quality/dashboard/kpi`, async () => {
    await delay(150);
    const { QUALITY_DASHBOARD_KPI } = await import('../../data/qualityReportMock');
    return HttpResponse.json({ success: true, data: QUALITY_DASHBOARD_KPI });
  }),

  // 6.4 导出与配置 (4)
  http.get(`${API_BASE}/quality/monthly-report/export`, async ({ request }) => {
    await delay(1500);
    const url = new URL(request.url);
    const year = url.searchParams.get('year') ?? '2026';
    const month = url.searchParams.get('month') ?? '6';
    const format = url.searchParams.get('format') ?? 'pdf';
    return HttpResponse.json({
      success: true,
      data: {
        data: `Mock ${format.toUpperCase()} content`,
        mime: format === 'pdf' ? 'application/pdf' : 'application/msword',
        filename: `quality-report-${year}-${month}.${format}`,
      },
    });
  }),
  http.get(`${API_BASE}/quality/exports`, async () => {
    await delay(150);
    let data: any[] = [];
    try {
      data = list<any>('quality_exports');
      if (data.length === 0) {
        const seed = [{ id: 'exp-001', type: 'monthly', period: '2026-06', status: 'completed', createdAt: '2026-07-01T00:00:00Z' }];
        seed.forEach(s => create('quality_exports', s));
        data = seed;
      }
    } catch { data = []; }
    return HttpResponse.json({ success: true, data });
  }),
  http.post(`${API_BASE}/quality/exports`, async ({ request }) => {
    await delay(200);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = `exp-${Date.now()}-${uuidv4().slice(0, 8)}`;
    const item = { id, type: body.type ?? 'monthly', period: body.period ?? '', status: 'pending', createdAt: new Date().toISOString(), ...body };
    try { create('quality_exports', item); } catch {}
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
  http.delete(`${API_BASE}/quality/exports/:id`, async ({ params }) => {
    await delay(80);
    try { remove('quality_exports', params.id as string); } catch {}
    return new HttpResponse(null, { status: 204 });
  }),

  // 6.5 报表配置 (2)
  http.get(`${API_BASE}/quality/report-configs`, async () => {
    await delay(120);
    return HttpResponse.json({ success: true, data: [{ id: 'cfg-001', name: '月度质控报表', period: 'monthly', sections: ['score', 'defect', 'trend'], enabled: true }] });
  }),
  http.post(`${API_BASE}/quality/report-configs`, async ({ request }) => {
    await delay(180);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ success: true, data: { id: `cfg-${Date.now()}`, ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }, { status: 201 });
  }),
];

// ============================================================
// 7. R3.AI 智能辅助 (15 handlers)
//    v3.0.5.1 AI 草稿/预审/风险/鉴别诊断/服务/治理
// ============================================================
export const aiAssistHandlers = [
  // 7.1 AI 草稿 (3)
  http.post(`${API_BASE}/ai-assist/drafts`, async ({ request }) => {
    await delay(1500);
    const body = (await request.json()) as { scenario: string; clinicalHistory: string; reportId?: string };
    return HttpResponse.json({
      success: true,
      data: {
        id: `aidraft-${Date.now()}`,
        reportId: body.reportId ?? `new-${Date.now()}`,
        scenario: body.scenario,
        clinicalHistory: body.clinicalHistory,
        findings: 'AI 草稿所见（mock）',
        diagnosis: 'AI 草稿诊断（mock）',
        impression: 'AI 草稿意见（mock）',
        recommendations: '随访',
        confidence: { overall: 0.85, findings: 0.88, diagnosis: 0.82, impression: 0.85, level: 'high' },
        references: [{ id: 'ref-1', title: '国家卫健委《放射诊断报告书写规范》', source: 'NHC', year: 2022 }],
        generatedAt: new Date().toISOString(),
        modelVersion: 'v2.3-mock',
        tokenUsage: { prompt: 230, completion: 480, total: 710 },
        processingMs: 1500,
      },
    });
  }),
  http.get(`${API_BASE}/ai-assist/drafts/:id`, async ({ params }) => {
    await delay(80);
    return HttpResponse.json({
      success: true,
      data: {
        id: params.id,
        reportId: 'RP20260618012',
        scenario: 'chest-ct',
        clinicalHistory: '男性 65 岁，咳嗽 2 周',
        findings: '右肺下叶背段磨玻璃结节',
        diagnosis: '右肺下叶背段磨玻璃结节 (Lung-RADS 3)',
        impression: '建议 3 个月后复查',
        confidence: { overall: 0.85, level: 'high' },
        modelVersion: 'v2.3-mock',
        generatedAt: new Date().toISOString(),
      },
    });
  }),
  http.get(`${API_BASE}/ai-assist/drafts/list`, async () => {
    await delay(150);
    const { AI_DRAFTS } = await import('../../data/reportAIMock');
    return HttpResponse.json({ success: true, data: AI_DRAFTS });
  }),

  // 7.2 AI 预审 (3)
  http.get(`${API_BASE}/ai-assist/pre-review/:reportId`, async ({ params }) => {
    await delay(800);
    const { AI_PRE_REVIEWS } = await import('../../data/reportAIMock');
    const r = AI_PRE_REVIEWS.find((x) => x.reportId === params.reportId) ?? AI_PRE_REVIEWS[0]!;
    return HttpResponse.json({ success: true, data: r });
  }),
  http.get(`${API_BASE}/ai-assist/pre-review/list`, async () => {
    await delay(150);
    const { AI_PRE_REVIEWS } = await import('../../data/reportAIMock');
    return HttpResponse.json({ success: true, data: AI_PRE_REVIEWS });
  }),
  http.post(`${API_BASE}/ai-assist/pre-review/apply`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as { reportId: string; suggestionId: string };
    return HttpResponse.json({ success: true, data: { reportId: body.reportId, applied: true, suggestionId: body.suggestionId, appliedAt: new Date().toISOString() } });
  }),

  // 7.3 AI 风险预测 (2)
  http.get(`${API_BASE}/ai-assist/risk/:reportId`, async ({ params }) => {
    await delay(800);
    const { AI_RISK_PREDICTIONS } = await import('../../data/reportAIMock');
    const r = AI_RISK_PREDICTIONS.find((x) => x.reportId === params.reportId) ?? AI_RISK_PREDICTIONS[0]!;
    return HttpResponse.json({ success: true, data: r });
  }),
  http.get(`${API_BASE}/ai-assist/risk/list`, async () => {
    await delay(150);
    const { AI_RISK_PREDICTIONS } = await import('../../data/reportAIMock');
    return HttpResponse.json({ success: true, data: AI_RISK_PREDICTIONS });
  }),

  // 7.4 AI 鉴别诊断 (2)
  http.get(`${API_BASE}/ai-assist/ddx/:reportId`, async ({ params }) => {
    await delay(800);
    const { AI_DIFFERENTIAL_DXS } = await import('../../data/reportAIMock');
    const r = AI_DIFFERENTIAL_DXS.find((x) => x.reportId === params.reportId) ?? AI_DIFFERENTIAL_DXS[0]!;
    return HttpResponse.json({ success: true, data: r });
  }),
  http.get(`${API_BASE}/ai-assist/ddx/list`, async () => {
    await delay(150);
    const { AI_DIFFERENTIAL_DXS } = await import('../../data/reportAIMock');
    return HttpResponse.json({ success: true, data: AI_DIFFERENTIAL_DXS });
  }),

  // 7.5 AI 服务治理 (5)
  http.get(`${API_BASE}/ai-assist/health`, async () => {
    await delay(80);
    return HttpResponse.json({
      success: true,
      data: { status: 'healthy', avgLatencyMs: 850, queueDepth: 2, rateLimitRemaining: 87, checkedAt: new Date().toISOString() },
    });
  }),
  http.get(`${API_BASE}/ai-assist/usage`, async () => {
    await delay(120);
    const { AI_USAGE_LOGS } = await import('../../data/reportAIMock');
    return HttpResponse.json({ success: true, data: AI_USAGE_LOGS });
  }),
  http.get(`${API_BASE}/ai-assist/quota`, async ({ request }) => {
    await delay(100);
    const url = new URL(request.url);
    const { AI_QUOTAS } = await import('../../data/reportAIMock');
    const userId = url.searchParams.get('userId');
    const q = userId ? AI_QUOTAS.find((x) => x.userId === userId) : AI_QUOTAS[0];
    return HttpResponse.json({ success: true, data: q ?? AI_QUOTAS[0] });
  }),
  http.post(`${API_BASE}/ai-assist/consent`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ success: true, data: { id: `consent-${Date.now()}`, ...body, consentedAt: new Date().toISOString() } }, { status: 201 });
  }),
  http.get(`${API_BASE}/ai-assist/dashboard`, async () => {
    await delay(150);
    return HttpResponse.json({
      success: true,
      data: {
        totalCalls: 4128,
        avgLatencyMs: 850,
        acceptanceRate: 0.785,
        errorRate: 0.02,
        queueDepth: 2,
        byEndpoint: [
          { endpoint: '/api/v1/ai-assist/drafts', calls: 1850 },
          { endpoint: '/api/v1/ai-assist/pre-review', calls: 1100 },
          { endpoint: '/api/v1/ai-assist/risk', calls: 580 },
          { endpoint: '/api/v1/ai-assist/ddx', calls: 598 },
        ],
      },
    });
  }),
];
