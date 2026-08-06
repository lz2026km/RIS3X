// ============================================================
// G005 放射RIS系统 v2.1.0 - MSW Mock Handlers
// Phase R13 W12: Mock 后端服务 (开发/演示用)
// ============================================================

import { http, HttpResponse, delay } from 'msw';
import { generateReports, summarizeReports, type SeedReport } from '../data/reportSeed';
import { getAllTerms } from '../data/termSeed';
import { getTermStats } from './termService';

// 内存数据
let REPORTS: SeedReport[] = generateReports(500);
let _auditLog: Array<{ seq: number; ts: string; reportId: string; actor: string; action: string; detail?: string }> = [];
let _collaborators = new Set<string>();

const API = '/api';

function ok<T>(data: T, init?: ResponseInit) {
  return HttpResponse.json(data as unknown as Record<string, unknown>, { status: 200, ...init });
}

function err(status: number, message: string) {
  return HttpResponse.json({ error: message }, { status });
}

function paginate<T>(arr: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(arr.length / pageSize));
  return { data: arr.slice((page - 1) * pageSize, page * pageSize), total: arr.length, page, pageSize, totalPages };
}

export const handlers = [
  // ===== 报告 =====
  http.get(`${API}/reports`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const text = url.searchParams.get('text')?.toLowerCase();
    const status = url.searchParams.get('status');
    const modality = url.searchParams.get('modality');
    const priority = url.searchParams.get('priority');
    const isCritical = url.searchParams.get('isCritical');
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const pageSize = Math.min(200, parseInt(url.searchParams.get('pageSize') ?? '20'));
    let filtered = REPORTS;
    if (text) filtered = filtered.filter(r => (r.patientName + r.id + r.bodyPart + r.findings + r.impression).toLowerCase().includes(text));
    if (status) filtered = filtered.filter(r => r.status === status);
    if (modality) filtered = filtered.filter(r => r.modality === modality);
    if (priority) filtered = filtered.filter(r => r.priority === priority);
    if (isCritical !== null) filtered = filtered.filter(r => r.isCritical === (isCritical === 'true'));
    return ok(paginate(filtered, page, pageSize));
  }),

  http.get(`${API}/reports/stats`, async () => {
    await delay(30);
    return ok(summarizeReports(REPORTS));
  }),

  http.get(`${API}/reports/:id`, async ({ params }) => {
    await delay(30);
    const r = REPORTS.find(x => x.id === params.id);
    if (!r) return err(404, 'Report not found');
    return ok(r);
  }),

  http.post(`${API}/reports`, async ({ request }) => {
    await delay(50);
    const body = await request.json() as Partial<SeedReport>;
    const r: SeedReport = {
      id: `R${Date.now()}`,
      patientId: body.patientId ?? 'P000000',
      patientName: body.patientName ?? '',
      modality: body.modality ?? 'CT',
      bodyPart: body.bodyPart ?? '',
      status: body.status ?? 'draft',
      doctorId: body.doctorId ?? 'd001',
      doctorName: body.doctorName ?? '',
      priority: body.priority ?? 'routine',
      clinicalHistory: body.clinicalHistory ?? '',
      findings: body.findings ?? '',
      impression: body.impression ?? '',
      recommendation: body.recommendation ?? '',
      technique: body.technique ?? '',
      isCritical: body.isCritical ?? false,
      isDraft: body.isDraft ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      qualityScore: 0,
      measurements: [],
    };
    REPORTS.unshift(r);
    return HttpResponse.json(r, { status: 201 });
  }),

  http.put(`${API}/reports/:id`, async ({ params, request }) => {
    await delay(30);
    const idx = REPORTS.findIndex(x => x.id === params.id);
    if (idx < 0) return err(404, 'Report not found');
    const patch = await request.json() as Partial<SeedReport>;
    REPORTS[idx] = { ...REPORTS[idx]!, ...patch, id: REPORTS[idx]!.id, updatedAt: new Date().toISOString() };
    return ok(REPORTS[idx]);
  }),

  http.delete(`${API}/reports/:id`, async ({ params }) => {
    await delay(30);
    REPORTS = REPORTS.filter(x => x.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // ===== 患者 =====
  http.get(`${API}/patients`, async () => {
    await delay(40);
    const patientMap = new Map<string, { id: string; mrn: string; name: string; reportCount: number }>();
    REPORTS.forEach(r => {
      const cur = patientMap.get(r.patientId);
      if (cur) cur.reportCount++;
      else patientMap.set(r.patientId, { id: r.patientId, mrn: `MRN${r.patientId}`, name: r.patientName, reportCount: 1 });
    });
    return ok(Array.from(patientMap.values()).slice(0, 50));
  }),

  // ===== DICOM =====
  http.get(`${API}/imaging/dicom`, async () => {
    await delay(30);
    return ok([
      { studyInstanceUID: '1.2.3.4.5', seriesCount: 3, instanceCount: 120, modality: 'CT', description: '胸部 CT 增强' },
      { studyInstanceUID: '1.2.3.4.6', seriesCount: 4, instanceCount: 200, modality: 'MR', description: '头颅 MR 平扫' },
      { studyInstanceUID: '1.2.3.4.7', seriesCount: 1, instanceCount: 2, modality: 'DR', description: '胸部正侧位 DR' },
    ]);
  }),

  // ===== AI =====
  http.post(`${API}/ai/chat`, async ({ request }) => {
    await delay(20);
    const body = await request.json() as { task?: string; text?: string };
    return ok({
      id: `chat-${Date.now()}`,
      task: body.task ?? 'custom',
      response: `[MSW 模拟] ${body.task ?? 'AI'} 响应：${(body.text ?? '').slice(0, 50)}...`,
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });
  }),

  // ===== CA =====
  http.get(`${API}/ca/certificates`, async () => {
    await delay(20);
    return ok([
      { serial: 'CA-ROOT-001', subject: 'G005 Test CA', notAfter: '2034-12-31T00:00:00Z' },
    ]);
  }),

  http.post(`${API}/ca/certificates`, async () => {
    await delay(50);
    return HttpResponse.json({ serial: `USR-${Date.now()}`, issued: true }, { status: 201 });
  }),

  // ===== 审计 =====
  http.get(`${API}/audit/entries`, async ({ request }) => {
    await delay(20);
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId');
    const actor = url.searchParams.get('actor');
    let out = _auditLog;
    if (reportId) out = out.filter(e => e.reportId === reportId);
    if (actor) out = out.filter(e => e.actor === actor);
    return ok(out);
  }),

  http.post(`${API}/audit/entries`, async ({ request }) => {
    await delay(20);
    const body = await request.json() as { reportId: string; actor: string; action: string; detail?: string };
    _auditLog.push({ seq: _auditLog.length, ts: new Date().toISOString(), ...body });
    return ok({ ok: true });
  }),

  http.post(`${API}/audit/verify`, async () => {
    await delay(30);
    return ok({ valid: true, count: _auditLog.length });
  }),

  http.get(`${API}/audit/merkle`, async () => {
    await delay(20);
    return ok({ root: '0'.repeat(64), count: _auditLog.length });
  }),

  // ===== 协同 =====
  http.get(`${API}/collab/rooms`, async () => {
    await delay(10);
    return ok(Array.from(_collaborators));
  }),

  // ===== 术语 =====
  http.get(`${API}/terms`, async ({ request }) => {
    await delay(30);
    const url = new URL(request.url);
    const text = url.searchParams.get('text')?.toLowerCase();
    const category = url.searchParams.get('category');
    const limit = parseInt(url.searchParams.get('limit') ?? '20');
    let terms = getAllTerms();
    if (category) terms = terms.filter(t => t.category === category);
    if (text) {
      terms = terms.filter(t => t.cn.toLowerCase().includes(text) || t.term.toLowerCase().includes(text));
    }
    return ok(terms.slice(0, limit));
  }),

  http.get(`${API}/terms/autocomplete`, async ({ request }) => {
    await delay(15);
    const url = new URL(request.url);
    const prefix = url.searchParams.get('prefix')?.toLowerCase() ?? '';
    if (!prefix) return ok([]);
    const out = getAllTerms().filter(t => t.cn.toLowerCase().startsWith(prefix) || t.term.toLowerCase().startsWith(prefix));
    return ok(out.slice(0, 10));
  }),

  http.post(`${API}/terms/recommend`, async ({ request }) => {
    await delay(20);
    const ctx = await request.json() as { bodyPart?: string; clinicalHistory?: string };
    const terms = getAllTerms().filter(t => ctx.bodyPart && t.cn.includes(ctx.bodyPart));
    return ok(terms.slice(0, 20));
  }),

  http.get(`${API}/stats/dashboard`, async () => {
    await delay(30);
    return ok({
      reports: summarizeReports(REPORTS),
      terms: getTermStats(),
      collabRooms: _collaborators.size,
      auditEntries: _auditLog.length,
    });
  }),

  // ===== [P0-12 v3.0.7] 微信小程序 API =====
  // jscode2session
  http.post(`${API}/v1/mobile/wechat/session`, async ({ request }) => {
    const { jsCode } = (await request.json()) as { jsCode: string };
    if (!jsCode) return err(400, 'missing jsCode');
    return ok({
      openid: 'mock_open_' + (jsCode || '').substring(0, 8),
      sessionKey: 'mock_session_key_' + Date.now(),
      patientId: 'P100001',
      patientNameMasked: '张*',
      token: 'mock-token-' + Date.now(),
      expiresIn: 7200,
    });
  }),

  // getPatientReports
  http.get(`${API}/v1/mobile/wechat/patients/:patientId/reports`, ({  request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
    const items = [
      { id: 'RPT-2026-0001', studyId: 'STD-001', modality: 'CT', bodyPart: '胸部', examDescription: '胸部 CT 平扫', status: 'published', reportDate: '2026-07-01T10:30:00+08:00', radiologist: '张三主任医师', hasCriticalFinding: false, pdfAvailable: true },
      { id: 'RPT-2026-0002', studyId: 'STD-002', modality: 'MR', bodyPart: '头部', examDescription: '头部 MR 平扫+DWI', status: 'published', reportDate: '2026-07-02T14:20:00+08:00', radiologist: '李四副主任医师', hasCriticalFinding: true, pdfAvailable: true },
      { id: 'RPT-2026-0003', studyId: 'STD-003', modality: 'DR', bodyPart: '胸部正侧位', examDescription: '胸部正侧位 DR', status: 'preliminary', reportDate: '2026-07-03T08:15:00+08:00', radiologist: '王五主治医师', hasCriticalFinding: false, pdfAvailable: false },
    ];
    return ok({ items, total: items.length, page, pageSize });
  }),

  // getReportPDF
  http.get(`${API}/v1/mobile/wechat/reports/:reportId/pdf`, ({ params }) => {
    return ok({
      reportId: params['reportId'],
      url: `/g005-radiology-ris/api/v1/mobile/wechat/reports/${params['reportId']}/download?t=${Date.now()}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      size: 1024 * 256,
      sha256: 'mock_sha256_abcdef123456',
    });
  }),

  // sendNotification
  http.post(`${API}/v1/mobile/wechat/notifications`, async ({ request }) => {await request.json();
    return ok({
      ok: true,
      messageId: 'msg_' + Date.now(),
      deliveredAt: new Date().toISOString(),
      channel: 'wechat_subscribe',
      cost: 0,
    });
  }),

  // getExamStatus
  http.get(`${API}/v1/mobile/wechat/exams/:examId/status`, ({ params }) => {
    return ok({
      examId: params['examId'],
      patientId: 'P100001',
      status: 'in_progress',
      scheduledAt: '2026-07-04T09:00:00+08:00',
      startedAt: '2026-07-04T09:15:00+08:00',
      modality: 'CT',
      room: 'CT-1',
      queuePosition: 1,
      estimatedWaitMinutes: 10,
      hasCriticalFinding: false,
      timeline: [
        { step: 'scheduled', at: '2026-07-03T10:00:00+08:00' },
        { step: 'arrived', at: '2026-07-04T08:50:00+08:00' },
        { step: 'in_progress', at: '2026-07-04T09:15:00+08:00', operator: '技师小赵' },
      ],
    });
  }),

  // rescheduleAppointment
  http.post(`${API}/v1/mobile/wechat/appointments/:appointmentId/reschedule`, async ({  request }) => {await request.json();
    return ok({ ok: true, newAppointmentId: 'APT-' + Date.now() });
  }),

  // cancelAppointment
  http.post(`${API}/v1/mobile/wechat/appointments/:appointmentId/cancel`, async ({  request }) => {await request.json();
    return ok({ ok: true, refunded: false });
  }),

  // acknowledgeCritical
  http.post(`${API}/v1/mobile/wechat/notifications/:notificationId/ack`, ({  }) => {
    return ok({ ok: true, acknowledgedAt: new Date().toISOString() });
  }),

    // ===== 通用 ping =====
  http.get(`${API}/ping`, async () => {
    return ok({ pong: true, ts: new Date().toISOString() });
  }),
];

export default handlers;
