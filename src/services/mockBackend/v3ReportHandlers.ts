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
  
  

  // 1.2 字段类型(8)
  
  
  
  
  
  
  
  

  // 1.3 RECIST / BI-RADS / PI-RADS(8)
  
  
  
  
  
  
  
  

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
  
  
  
  

  // 1.5 AI / 短语库 / RadLex / 预评分(8)  [v3.0.6.12-A4] #6 POST /writing/ai/draft - 写 store
  
  
  http.get(`${API_BASE}/writing/phrases`, async ({ request }) => { await delay(50); const url = new URL(request.url); const q = url.searchParams.get('q') ?? ''; return HttpResponse.json({ success: true, data: [{ id: 'p-1', text: '双肺透光度增加，肺纹理增多', category: 'finding' }, { id: 'p-2', text: '未见明显异常', category: 'conclusion' }, { id: 'p-3', text: '建议定期随访', category: 'recommendation' }].filter(p => !q || p.text.includes(q)), meta: { query: q } }); }),
  http.post(`${API_BASE}/writing/phrases`, async () => { await delay(80); return HttpResponse.json({ success: true, data: { id: `p-${Date.now()}` } }, { status: 201 }); }),
  
  http.get(`${API_BASE}/writing/radlex`, async ({ request }) => { await delay(50); const url = new URL(request.url); return HttpResponse.json({ success: true, data: [{ code: 'RID1234', term: '肺结节', category: 'finding' }, { code: 'RID5678', term: '毛刺征', category: 'morphology' }], meta: { q: url.searchParams.get('q') ?? '' } }); }),
  
  
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
  
  http.post(`${API_BASE}/dist/tasks/:id/retry`, async () => { await delay(300); return HttpResponse.json({ success: true, data: { newStatus: 'queued' } }); }),
  
  
  

  // 2.3 HL7 ORU + MLLP(4)
  
  
  
  

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
  
  
  

  // 2.5 患者端(4)
  
  
  
  

  // 2.6 策略(4)
  
  
  
  
];

// ============================================================
// 3. R3.INTEGRATION(50 handlers)
// ============================================================
export const integrationHandlers = [
  // 3.1 HL7 CDA R2(8)
  http.get(`${API_BASE}/integration/cda`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ id: 'cda-001', patient: '张三', type: 'DiagnosticReport', created: '2026-07-01', status: 'final' }] }); }),
  http.get(`${API_BASE}/integration/cda/:id`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { id: 'cda-001', validation: { passed: true } } }); }),
  http.post(`${API_BASE}/integration/cda`, async () => { await delay(200); return HttpResponse.json({ success: true, data: { id: `cda-${Date.now()}` } }, { status: 201 }); }),
  
  http.post(`${API_BASE}/integration/cda/:id/parse`, async () => { await delay(80); return HttpResponse.json({ success: true, data: { sections: [] } }); }),
  http.get(`${API_BASE}/integration/cda/:id/download`, async () => { await delay(150); return HttpResponse.json({ success: true, data: { content: '<?xml...', mime: 'application/cda+xml' } }); }),

  // 3.1b HL7 SIU^S12 (排班消息生成 + 解析)
  http.post(`${API_BASE}/hl7/siu`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as any;
    const now = new Date();
    const controlId = `SIU-G005-${body.patientId}-${now.getTime()}`;
    const fmt = (dt: string) => new Date(dt).toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const msh = `MSH|^~\\&|G005_RIS|G005|HIS|HOSPITAL|${fmt(now.toISOString())}||SIU^S12|${controlId}|P|2.5.1`;
    const pid = `PID|1||${body.patientId}^^^G005^MR||${body.patientName}^${body.patientName}||${body.patientSex || 'M'}||||||`;
    const sch = `SCH|1||${body.doctorId}^^^G005^DR||${body.doctorName}|${body.department}|||${fmt(body.startDateTime)}|${fmt(body.endDateTime)}`;
    const message = [msh, pid, sch, body.note ? `NTE|1|${body.note}` : ''].filter(Boolean).join('\r');
    return HttpResponse.json({
      success: true,
      data: { controlId, messageType: 'SIU^S12', message, generatedAt: now.toISOString(), bytes: message.length },
    });
  }),
  http.post(`${API_BASE}/hl7/siu/parse`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const result: Record<string, string> = {};
    for (const line of String(body.raw ?? '').split('\r')) {
      const s = line.split('|');
      if (line.startsWith('MSH')) {
        result['sendingApp'] = s[2] || ''; result['sendingFacility'] = s[3] || '';
        result['receivingApp'] = s[4] || ''; result['receivingFacility'] = s[5] || '';
        result['messageType'] = s[8] || ''; result['controlId'] = s[9] || '';
      } else if (line.startsWith('PID')) {
        result['patientId'] = s[3]?.split('^')[0] || ''; result['patientName'] = s[5]?.split('^')[0] || ''; result['patientSex'] = s[8] || '';
      } else if (line.startsWith('SCH')) {
        result['doctorId'] = s[3]?.split('^')[0] || ''; result['doctorName'] = s[5] || ''; result['department'] = s[6] || '';
        result['startDateTime'] = s[9] || ''; result['endDateTime'] = s[10] || '';
      }
    }
    return HttpResponse.json({ success: true, data: result });
  }),
  
  

  // 3.2 DICOM SR(8)
  
  
  
  
  
  
  
  

  // 3.3 FHIR R4(8)
  
  http.get(`${API_BASE}/integration/fhir/diagnostic-report/:id`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { resourceType: 'DiagnosticReport', id: 'fhir-001' } }); }),
  
  
  
  
  
  

  // 3.4 IHE XDS.b(8)
  http.get(`${API_BASE}/integration/xds/registries`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ id: 'xds-001', name: '主注册中心', type: 'XDS.b', status: 'active' }] }); }),
  http.get(`${API_BASE}/integration/xds/registries/:id`, async () => { await delay(50); return HttpResponse.json({ success: true, data: { id: 'xds-001' } }); }),
  http.post(`${API_BASE}/integration/xds/registries`, async () => { await delay(800); return HttpResponse.json({ success: true, data: { id: `xds-${Date.now()}` } }, { status: 201 }); }),
  
  
  
  
  

  // 3.5 HIS(6)
  
  
  
  
  
  

  // 3.6 PACS(6)
  http.get(`${API_BASE}/pacs/studies`, async () => { await delay(200); return HttpResponse.json({ success: true, data: [{ studyInstanceUID: '1.2.840.10008.5.1.4.1.1.2', patientName: '张三', modality: 'CT', date: '2026-07-01', description: 'Chest CT' }] }); }),
  http.get(`${API_BASE}/pacs/studies/:uid`, async () => { await delay(300); return HttpResponse.json({ success: true, data: { studyInstanceUID: '1.2.840...' } }); }),
  
  
  
  

  // 3.7 EHR / BI / Webhook(6)
  
  
  
  http.post(`${API_BASE}/integration/webhooks`, async () => { await delay(200); return HttpResponse.json({ success: true, data: { id: `wh-${Date.now()}` } }); }),
  
  
];

// ============================================================
// 4. R3.OTHER(20 handlers)
// ============================================================
export const otherHandlers = [
  // 4.1 通知中心(5)
  http.get(`${API_BASE}/notifications`, async () => { await delay(80); return HttpResponse.json({ success: true, data: [{ id: 'notif-001', type: 'review', title: '新审核任务', message: '报告R-001待审核', read: false, createdAt: '2026-07-04T10:00:00Z' }, { id: 'notif-002', type: 'critical', title: '危急值', message: '患者张三CT发现主动脉夹层', read: false, createdAt: '2026-07-04T09:30:00Z' }] }); }),
  
  
  
  

  // 4.2 监控埋点(5)
  
  
  
  http.get(`${API_BASE}/analytics/dashboard`, async () => { await delay(200); return HttpResponse.json({ success: true, data: { totalReports: 1260, reviewed: 1038, avgTAT: 3.2, signedRate: 92.4, aiAdoption: 68.5, distSuccess: 97.1, todayEvents: 1240, topEvents: [{ name: '报告完成', count: 45 }, { name: '危急值', count: 3 }, { name: '审核退回', count: 2 }] } }); }),
  http.post(`${API_BASE}/analytics/ab-test`, async () => { await delay(30); return HttpResponse.json({ success: true }); }),

  // 4.3 i18n(3)
  
  
  

  // 4.4 PWA(3)
  
  
  

  // 4.5 帮助 / 反馈 / 版本(4)
  
  
  
  
];

// ============================================================
// 5. R3.REVIEW COSIGN(20 handlers)
//    覆盖: 排班/急诊双签/多人签/签冲突/自动派主任/SLA 监控/历史/跳过配置/临时授权/批量签
// ============================================================
export const cosignHandlers = [
  // 5.1 排班 + 签人(3)
  
  
  

  // 5.2 双签记录(3)
  
  
  

  // 5.3 急诊双签(2)
  
  

  // 5.4 多人签(2)
  
  

  // 5.5 签冲突(2)
  
  

  // 5.6 自动派主任(2)
  
  

  // 5.7 SLA 监控(2)
  
  

  // 5.8 历史(1)
  

  // 5.9 跳过配置(1)
  

  // 5.10 临时授权(2)
  
  

  // 5.11 批量签(2)
  
  

  // 5.12 仪表盘(1)
  

  // 5.13 证书(1)
  
];

// ============================================================
// 6. R3.QUALITY REPORT (15 handlers)
//    v3.0.5.1 月报/季报/年报/实时仪表盘/导出/配置
// ============================================================
export const qualityReportHandlers = [
  // 6.1 月报 (4)  [v3.0.6.12-A4] #16 GET /quality/monthly-report - 优先读 store
  
  
  
  

  // 6.2 季报/年报 (3)  [v3.0.6.12-A4] #17-#18 quarterly/annual report - 优先读 store
  
  
  

  // 6.3 实时仪表盘 (2)  [v3.0.6.12-A4] #19 GET /quality/dashboard - 读 store
  
  

  // 6.4 导出与配置 (4)
  
  
  
  

  // 6.5 报表配置 (2)
  
  
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
  

  // 7.2 AI 预审 (3)
  
  
  

  // 7.3 AI 风险预测 (2)
  
  

  // 7.4 AI 鉴别诊断 (2)
  
  

  // 7.5 AI 服务治理 (5)
  
  
  
  
  
];
