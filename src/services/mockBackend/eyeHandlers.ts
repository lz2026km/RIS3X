/**
 * G005 眼科专科 MSW Handlers v3.0.6.8-83
 * [v3.0.6.8-83] 20 Module / 252 端点, 对标 Topcon Synergy + Medisoft mediSIGHT
 *
 * 覆盖范围 (8 核心 + 12 增量 PR):
 *  - EyeRisModule (26): 预约/状态/随访/转诊/手术/排班
 *  - EyePacsModule (32): study/series/instance + 测量/标注/拼图/对比/关键影像
 *  - EyeEmrModule (24): 病历 + 8 病史段 + 眼科检查 + 术前 + 麻醉
 *  - EyeAiModule (18): 模型 + 推理 + 热图 + ROC + 反馈
 *  - EyeReportModule (22): 报告 + 模板 + 草稿 + 签名 + 打印
 *  - EyeKpiModule (16): KPI + 趋势 + 医生 + 目标
 *  - EyeSubspecialtyModule (24): 8 亚专科 (斜视/神经/眼眶/角膜/白内障/屈光/接触镜/低视力)
 *  - EyePatientJourneyModule (18): 时间线 + 宣教 + 保险 + 通知 + 旅程事件
 *  PR1: 真实 DICOM 渲染 (16)
 *  PR2: 报告 AI 辅助 (12)
 *  PR3: IOL 规划 (8)
 *  PR4: 8 亚专科纵深 (10)
 *  PR5: AI 模型 12 (10)
 *  PR6: 影像 QC AI (8)
 *  PR7: 多模态融合 (8)
 *  PR8: 远程眼科 (6)
 *  PR9: 教学病例库 (10)
 *  PR10: 像素渲染 (6)
 *  PR11: 视光中心闭环 (10)
 */

import { http, HttpResponse, delay } from 'msw';
import {
  list, get, create, update, remove,
} from './store';

// [v3.0.6.8-85] 确定性伪随机: 基于 seed 字符串返回 0-1 之间的稳定数
// 替代 Math.random() 提高测试稳定性 (同一 studyId/patientId 始终得相同结果)
function seedRand(seed: string | number): number {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // 映射到 0-1
  return ((h >>> 0) % 10000) / 10000;
}
import {
  parseQuery, applyQuery,
} from './queryBuilder';
import { auditCreate, auditUpdate, auditDelete } from './audit';
import { recordWorkflowEvent, checkRateLimit } from './businessLogic';

const API_BASE = '/api/v1/eye';

// RBAC 资源点 (35 个) - 用于细粒度权限
// 资源分类: report(7) + imaging(6) + surgery(4) + ai(4) + data(14)
const RBAC_POINTS = [
  'eye:report:read', 'eye:report:create', 'eye:report:update', 'eye:report:sign',
  'eye:report:cosign', 'eye:report:publish', 'eye:report:export',
  'eye:study:read', 'eye:study:create', 'eye:study:delete', 'eye:study:share',
  'eye:study:export', 'eye:study:ai-run',
  'eye:surgery:schedule', 'eye:surgery:execute', 'eye:surgery:record', 'eye:surgery:cancel',
  'eye:ai:run', 'eye:ai:override', 'eye:ai:train', 'eye:ai:audit',
  'eye:emr:read', 'eye:emr:create', 'eye:emr:update', 'eye:emr:delete',
  'eye:subspecialty:strabismus:read', 'eye:subspecialty:neuro:read',
  'eye:subspecialty:oncology:read', 'eye:subspecialty:cornea:read',
  'eye:subspecialty:cataract:read', 'eye:subspecialty:refractive:read',
  'eye:subspecialty:contact-lens:read', 'eye:subspecialty:low-vision:read',
  'eye:journey:read', 'eye:journey:update',
];

// ============= EyeRisModule (26 端点) =============
// 预约
const eyeRisModule = [
  // 1) 预约列表
  http.get(`${API_BASE}/ris/appointments`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_appointments');
    const result = applyQuery(all, opts, ['patientName', 'doctorName', 'appointmentNo']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 2) 今日预约 (静态路径必须在动态路径 /:id 之前)
  http.get(`${API_BASE}/ris/appointments/today`, async () => {
    await delay(50);
    const today = new Date().toISOString().slice(0, 10);
    const all = list<any>('eye_appointments').filter((a: any) => a.appointmentDate?.startsWith(today) || a.date?.startsWith(today));
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),
  // 3) 预约详情
  http.get(`${API_BASE}/ris/appointments/:id`, async ({ params }) => {
    await delay(50);
    const a = get<any>('eye_appointments', params.id as string);
    if (!a) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: a });
  }),
  // 4) 创建预约
  http.post(`${API_BASE}/ris/appointments`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const id = body.id || `APT${Date.now()}`;
    const newItem = { ...body, id, status: body.status || 'scheduled', createdAt: new Date().toISOString() };
    create('eye_appointments', newItem);
    auditCreate('eye_appointments', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 5) 更新预约
  http.put(`${API_BASE}/ris/appointments/:id`, async ({ params, request }) => {
    await delay(80);
    const id = params.id as string;
    const body = (await request.json()) as any;
    const before = get<any>('eye_appointments', id);
    const updated = update<any>('eye_appointments', id, body);
    if (updated) auditUpdate('eye_appointments', before, updated);
    return HttpResponse.json({ success: true, data: updated });
  }),
  // 6) 取消预约
  http.delete(`${API_BASE}/ris/appointments/:id`, async ({ params }) => {
    await delay(50);
    const id = params.id as string;
    const before = get<any>('eye_appointments', id);
    const ok = remove('eye_appointments', id);
    if (ok && before) auditDelete({ resource: 'eye_appointments', resourceId: id, before });
    return new HttpResponse(null, { status: ok ? 204 : 404 });
  }),

  // 7) 状态机: 签到
  http.post(`${API_BASE}/ris/appointments/:id/checkin`, async ({ params }) => {
    await delay(50);
    const id = params.id as string;
    const before = get<any>('eye_appointments', id);
    const updated = update<any>('eye_appointments', id, { status: 'checked_in', checkedInAt: new Date().toISOString() });
    if (updated) auditUpdate('eye_appointments', before, updated);
    return HttpResponse.json({ success: true, data: updated });
  }),
  // 8) 状态机: 开始检查
  http.post(`${API_BASE}/ris/appointments/:id/start`, async ({ params }) => {
    await delay(50);
    const id = params.id as string;
    const before = get<any>('eye_appointments', id);
    const updated = update<any>('eye_appointments', id, { status: 'in_progress', startedAt: new Date().toISOString() });
    if (updated) auditUpdate('eye_appointments', before, updated);
    return HttpResponse.json({ success: true, data: updated });
  }),
  // 9) 状态机: 完成
  http.post(`${API_BASE}/ris/appointments/:id/complete`, async ({ params }) => {
    await delay(50);
    const id = params.id as string;
    const before = get<any>('eye_appointments', id);
    const updated = update<any>('eye_appointments', id, { status: 'completed', completedAt: new Date().toISOString() });
    if (updated) auditUpdate('eye_appointments', before, updated);
    return HttpResponse.json({ success: true, data: updated });
  }),
  // 10) 状态机: 取消
  http.post(`${API_BASE}/ris/appointments/:id/cancel`, async ({ params }) => {
    await delay(50);
    const id = params.id as string;
    const before = get<any>('eye_appointments', id);
    const updated = update<any>('eye_appointments', id, { status: 'cancelled', cancelledAt: new Date().toISOString() });
    if (updated) auditUpdate('eye_appointments', before, updated);
    return HttpResponse.json({ success: true, data: updated });
  }),

  // 11) 随访列表
  http.get(`${API_BASE}/ris/follow-ups`, async ({ request }) => {
    await delay(60);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_follow_ups');
    const result = applyQuery(all, opts, ['patientName']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 12) 随访详情
  http.get(`${API_BASE}/ris/follow-ups/:id`, async ({ params }) => {
    await delay(40);
    const f = get<any>('eye_follow_ups', params.id as string);
    if (!f) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: f });
  }),
  // 13) 创建随访
  http.post(`${API_BASE}/ris/follow-ups`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `FU${Date.now()}`, status: 'pending', createdAt: new Date().toISOString() };
    create('eye_follow_ups', newItem);
    auditCreate('eye_follow_ups', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 14) 完成随访
  

  // 15) 转诊列表
  http.get(`${API_BASE}/ris/referrals`, async ({ request }) => {
    await delay(60);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_referrals');
    const result = applyQuery(all, opts, ['patientName']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 16) 转诊详情
  http.get(`${API_BASE}/ris/referrals/:id`, async ({ params }) => {
    await delay(40);
    const r = get<any>('eye_referrals', params.id as string);
    if (!r) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: r });
  }),
  // 17) 创建转诊
  http.post(`${API_BASE}/ris/referrals`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `REF${Date.now()}`, status: 'pending', createdAt: new Date().toISOString() };
    create('eye_referrals', newItem);
    auditCreate('eye_referrals', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 18) 接受转诊
  http.post(`${API_BASE}/ris/referrals/:id/accept`, async ({ params }) => {
    await delay(50);
    const id = params.id as string;
    const updated = update<any>('eye_referrals', id, { status: 'accepted', acceptedAt: new Date().toISOString() });
    return HttpResponse.json({ success: true, data: updated });
  }),

  // 19) 手术列表
  http.get(`${API_BASE}/ris/surgeries`, async ({ request }) => {
    await delay(60);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_surgeries');
    const result = applyQuery(all, opts, ['patientName', 'surgeryType']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 20) 手术详情
  http.get(`${API_BASE}/ris/surgeries/:id`, async ({ params }) => {
    await delay(40);
    const s = get<any>('eye_surgeries', params.id as string);
    if (!s) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: s });
  }),
  // 21) 排程手术
  http.post(`${API_BASE}/ris/surgeries`, async ({ request }) => {
    await delay(120);
    // 限流: 60 req/min per user
    const rl = checkRateLimit('eye-surgery-create', { maxPerMinute: 60 });
    if (!rl.allowed) return new HttpResponse('Too Many', { status: 429 });
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `SURG${Date.now()}`, status: 'scheduled', createdAt: new Date().toISOString() };
    create('eye_surgeries', newItem);
    auditCreate('eye_surgeries', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 22) 取消手术
  http.delete(`${API_BASE}/ris/surgeries/:id`, async ({ params }) => {
    await delay(50);
    const id = params.id as string;
    const before = get<any>('eye_surgeries', id);
    const ok = remove('eye_surgeries', id);
    if (ok && before) auditDelete({ resource: 'eye_surgeries', resourceId: id, before });
    return new HttpResponse(null, { status: ok ? 204 : 404 });
  }),

  // 23) 排班列表
  http.get(`${API_BASE}/ris/schedules`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const doctorId = url.searchParams.get('doctorId');
    let all = list<any>('eye_schedules').filter((s: any) => s.doctorId || s.scheduleDate);
    if (doctorId) all = all.filter((s: any) => s.doctorId === doctorId);
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),
  // 24) 创建排班
  http.post(`${API_BASE}/ris/schedules`, async ({ request }) => {
    await delay(50);
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `SCH${Date.now()}`, createdAt: new Date().toISOString() };
    create('eye_schedules', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 25) 排班冲突检测
  
  // 26) RIS 工作流状态总览
  http.get(`${API_BASE}/ris/workflow-status`, async () => {
    await delay(40);
    const appointments = list<any>('eye_appointments');
    const byStatus: Record<string, number> = {};
    for (const a of appointments) {
      const s = a.status || 'unknown';
      byStatus[s] = (byStatus[s] || 0) + 1;
    }
    return HttpResponse.json({ success: true, data: { total: appointments.length, byStatus } });
  }),
];

// [v3.0.6.8-83] 移除 default export, 仅保留 named export (与 dentalHandlers 一致)
export { eyeRisModule, RBAC_POINTS, API_BASE };

// ============= EyePacsModule (32 端点) =============
// 1) Study 列表
const eyePacsModule = [
  http.get(`${API_BASE}/pacs/studies`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_studies');
    const result = applyQuery(all, opts, ['patientName', 'studyId', 'modality']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 2) Study 详情
  http.get(`${API_BASE}/pacs/studies/:id`, async ({ params }) => {
    await delay(50);
    const s = get<any>('eye_studies', params.id as string);
    if (!s) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: s });
  }),
  // 3) 创建 Study
  http.post(`${API_BASE}/pacs/studies`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as any;
    const newItem = { ...body, studyId: body.studyId || `STU${Date.now()}`, status: body.status || 'scheduled', createdAt: new Date().toISOString() };
    create('eye_studies', newItem);
    auditCreate('eye_studies', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 4) 更新 Study
  http.put(`${API_BASE}/pacs/studies/:id`, async ({ params, request }) => {
    await delay(80);
    const id = params.id as string;
    const body = (await request.json()) as any;
    const updated = update<any>('eye_studies', id, body);
    return HttpResponse.json({ success: true, data: updated });
  }),
  // 5) 删除 Study
  http.delete(`${API_BASE}/pacs/studies/:id`, async ({ params }) => {
    await delay(50);
    const id = params.id as string;
    const ok = remove('eye_studies', id);
    return new HttpResponse(null, { status: ok ? 204 : 404 });
  }),
  // 6) 按模态过滤
  http.get(`${API_BASE}/pacs/studies/by-modality/:modality`, async ({ params }) => {
    await delay(60);
    const all = list<any>('eye_studies').filter((s: any) => s.modality === params.modality);
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),
  // 7) 按眼别
  http.get(`${API_BASE}/pacs/studies/by-laterality/:side`, async ({ params }) => {
    await delay(60);
    const all = list<any>('eye_studies').filter((s: any) => s.eyeSide === params.side || s.laterality === params.side);
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),
  // 8) 按患者
  http.get(`${API_BASE}/pacs/studies/by-patient/:patientId`, async ({ params }) => {
    await delay(60);
    const all = list<any>('eye_studies').filter((s: any) => s.patientId === params.patientId);
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),

  // 9) Series 列表
  http.get(`${API_BASE}/pacs/series`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_series');
    const result = applyQuery(all, opts, ['seriesDescription']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 10) Series 详情
  http.get(`${API_BASE}/pacs/series/:id`, async ({ params }) => {
    await delay(40);
    const s = get<any>('eye_series', params.id as string);
    if (!s) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: s });
  }),
  // 11) 创建 Series
  http.post(`${API_BASE}/pacs/series`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const newItem = { ...body, seriesId: body.seriesId || `SER${Date.now()}` };
    create('eye_series', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 12) 删除 Series
  http.delete(`${API_BASE}/pacs/series/:id`, async ({ params }) => {
    const id = params.id as string;
    const ok = remove('eye_series', id);
    return new HttpResponse(null, { status: ok ? 204 : 404 });
  }),

  // 13) Instance 列表
  
  // 14) Instance 详情
  http.get(`${API_BASE}/pacs/instances/:id`, async ({ params }) => {
    await delay(40);
    const i = get<any>('eye_instances', params.id as string);
    if (!i) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: i });
  }),
  // 15) 创建 Instance
  
  // 16) 删除 Instance
  http.delete(`${API_BASE}/pacs/instances/:id`, async ({ params }) => {
    const id = params.id as string;
    const ok = remove('eye_instances', id);
    return new HttpResponse(null, { status: ok ? 204 : 404 });
  }),

  // 17) DICOM-web WADO (拉取像素)
  http.get(`${API_BASE}/pacs/wado/:studyId`, async ({ params }) => {
    await delay(100);
    const study = get<any>('eye_studies', params.studyId as string);
    if (!study) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: { studyId: params.studyId, contentType: 'application/dicom', pixelDataRef: `data:image/png;base64,...` } });
  }),
  // 18) DICOM-web QIDO (查询)
  
  // 19) DICOM-web STOW (存储)
  

  // 20) 测量列表
  http.get(`${API_BASE}/pacs/measurements`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_measurements');
    const result = applyQuery(all, opts, ['measurementType']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 21) 测量详情
  http.get(`${API_BASE}/pacs/measurements/:id`, async ({ params }) => {
    await delay(40);
    const m = get<any>('eye_measurements', params.id as string);
    if (!m) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: m });
  }),
  // 22) 创建测量
  http.post(`${API_BASE}/pacs/measurements`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `MS${Date.now()}`, createdAt: new Date().toISOString() };
    create('eye_measurements', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 23) 删除测量
  http.delete(`${API_BASE}/pacs/measurements/:id`, async ({ params }) => {
    const id = params.id as string;
    const ok = remove('eye_measurements', id);
    return new HttpResponse(null, { status: ok ? 204 : 404 });
  }),

  // 24) 标注列表
  http.get(`${API_BASE}/pacs/annotations`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_annotations');
    const result = applyQuery(all, opts, ['annotationType']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 25) 创建标注
  http.post(`${API_BASE}/pacs/annotations`, async ({ request }) => {
    await delay(60);
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `AN${Date.now()}`, createdAt: new Date().toISOString() };
    create('eye_annotations', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 26) 删除标注
  http.delete(`${API_BASE}/pacs/annotations/:id`, async ({ params }) => {
    const id = params.id as string;
    const ok = remove('eye_annotations', id);
    return new HttpResponse(null, { status: ok ? 204 : 404 });
  }),
  // 27) 病灶分割列表
  
  // 28) 创建分割
  
  // 29) 拼图 (montage) 创建
  http.post(`${API_BASE}/pacs/montage`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { montageId: `MNT${Date.now()}`, ...body, status: 'rendering' } });
  }),
  // 30) 拼图状态
  http.get(`${API_BASE}/pacs/montage/:id`, async ({ params }) => {
    await delay(30);
    return HttpResponse.json({ success: true, data: { montageId: params.id, status: 'completed', progress: 100 } });
  }),
  // 31) 对比 (compare) - 双 Study 对比
  http.post(`${API_BASE}/pacs/compare`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as { studyIdA: string; studyIdB: string };
    const a = get<any>('eye_studies', body.studyIdA);
    const b = get<any>('eye_studies', body.studyIdB);
    return HttpResponse.json({ success: true, data: { left: a, right: b, diff: {} } });
  }),
  // 32) 关键影像列表
  http.get(`${API_BASE}/pacs/key-images`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const studyId = url.searchParams.get('studyId');
    let all = list<any>('eye_instances').filter((i: any) => i.isKeyImage || i.keyImage);
    if (studyId) all = all.filter((i: any) => i.studyId === studyId);
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),
  // [W2B-2] 病灶分割列表 (FundusViewerPage: GET /pacs/lesion-segmentations?studyId=)
  http.get(`${API_BASE}/pacs/lesion-segmentations`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const studyId = url.searchParams.get('studyId');
    let all = list<any>('eye_lesion_segmentations');
    if (studyId) all = all.filter((s: any) => s.studyId === studyId || s.studyUid === studyId);
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),
];

// ============= EyeEmrModule (24 端点) =============
const eyeEmrModule = [
  // 1) 病历列表
  http.get(`${API_BASE}/emr/records`, async ({ request }) => {
    await delay(60);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_emrs');
    const result = applyQuery(all, opts, ['patientName', 'chiefComplaint']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 2) 按患者 (静态路径必须在 /:id 之前)
  http.get(`${API_BASE}/emr/records/by-patient/:patientId`, async ({ params }) => {
    await delay(50);
    const all = list<any>('eye_emrs').filter((e: any) => e.patientId === params.patientId);
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),
  // 3) 病历详情
  http.get(`${API_BASE}/emr/records/:id`, async ({ params }) => {
    await delay(40);
    const e = get<any>('eye_emrs', params.id as string);
    if (!e) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: e });
  }),
  // 4) 创建病历
  http.post(`${API_BASE}/emr/records`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `EMR${Date.now()}`, createdAt: new Date().toISOString() };
    create('eye_emrs', newItem);
    auditCreate('eye_emrs', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 5) 更新病历
  http.put(`${API_BASE}/emr/records/:id`, async ({ params, request }) => {
    await delay(60);
    const id = params.id as string;
    const body = (await request.json()) as any;
    const before = get<any>('eye_emrs', id);
    const updated = update<any>('eye_emrs', id, { ...body, updatedAt: new Date().toISOString() });
    if (updated) auditUpdate('eye_emrs', before, updated);
    return HttpResponse.json({ success: true, data: updated });
  }),
  // 6) 删除病历
  http.delete(`${API_BASE}/emr/records/:id`, async ({ params }) => {
    const id = params.id as string;
    const before = get<any>('eye_emrs', id);
    const ok = remove('eye_emrs', id);
    if (ok && before) auditDelete({ resource: 'eye_emrs', resourceId: id, before });
    return new HttpResponse(null, { status: ok ? 204 : 404 });
  }),

  // [Phase 2 MSW 降级] 8 段病史端点 (emr/records/:id/chief-complaint 等) 无前端调用,已移除

  // 15) 眼科检查列表 (裂隙灯/眼底/房角镜等)
  http.get(`${API_BASE}/emr/ophthalmic-exams`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_ophthalmic_exams');
    const result = applyQuery(all, opts, ['examType']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 16) 创建眼科检查
  http.post(`${API_BASE}/emr/ophthalmic-exams`, async ({ request }) => {
    await delay(60);
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `OE${Date.now()}`, examDate: body.examDate || new Date().toISOString() };
    create('eye_ophthalmic_exams', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 17) 按患者 + 类型
  http.get(`${API_BASE}/emr/ophthalmic-exams/by-patient/:patientId`, async ({ params, request }) => {
    await delay(40);
    const url = new URL(request.url);
    const examType = url.searchParams.get('examType');
    let all = list<any>('eye_ophthalmic_exams').filter((e: any) => e.patientId === params.patientId);
    if (examType) all = all.filter((e: any) => e.examType === examType);
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),
  // 18) 视力换算 (Snellen/Decimal/LogMAR/5分)
  http.post(`${API_BASE}/emr/convert-vision`, async ({ request }) => {
    await delay(20);
    const body = (await request.json()) as { value: number; from: string; to: string };
    return HttpResponse.json({ success: true, data: { from: body.value, to: body.value, conversion: `${body.from}->${body.to}` } });
  }),

  // 19) 术前评估列表
  http.get(`${API_BASE}/emr/preop-assessments`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_preop_assessments');
    const result = applyQuery(all, opts, ['patientName']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 20) 创建术前评估
  http.post(`${API_BASE}/emr/preop-assessments`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `POA${Date.now()}`, assessedAt: new Date().toISOString() };
    create('eye_preop_assessments', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 21) 术前评估详情
  http.get(`${API_BASE}/emr/preop-assessments/:id`, async ({ params }) => {
    await delay(40);
    const p = get<any>('eye_preop_assessments', params.id as string);
    if (!p) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: p });
  }),

  // 22) 麻醉评估列表
  http.get(`${API_BASE}/emr/anes-assessments`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_anes_assessments');
    const result = applyQuery(all, opts, ['patientName']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 23) 创建麻醉评估
  http.post(`${API_BASE}/emr/anes-assessments`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `ANES${Date.now()}` };
    create('eye_anes_assessments', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 24) 麻醉评估详情
  http.get(`${API_BASE}/emr/anes-assessments/:id`, async ({ params }) => {
    await delay(40);
    const a = get<any>('eye_anes_assessments', params.id as string);
    if (!a) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: a });
  }),
];

// ============= EyeAiModule (18 端点) =============
const eyeAiModule = [
  // 1) AI 模型列表
  http.get(`${API_BASE}/ai/models`, async ({ request }) => {
    await delay(60);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_ai_models');
    const result = applyQuery(all, opts, ['modelName', 'diseaseCategory']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 2) AI 模型详情 (含 dr-grader 特殊处理)
  http.get(`${API_BASE}/ai/models/:id`, async ({ params }) => {
    await delay(40);
    const id = params.id as string;
    // 特殊模型: dr-grader
    if (id === 'dr-grader') {
      return HttpResponse.json({
        success: true,
        data: {
          modelId: 'dr-grader-v3',
          id: 'dr-grader',
          modelName: 'DR 五级精细分级',
          type: 'classification',
          diseaseCategory: 'DR',
          architecture: 'EfficientNet-B5 + CBAM',
          trainingData: 'EyePACS + 内部 500 例',
          metrics: { auc: 0.94, sensitivity: 0.91, specificity: 0.93, f1: 0.92 },
          grades: [
            { grade: 0, label: '无 DR', color: '#52c41a' },
            { grade: 1, label: '轻度 NPDR', color: '#2563eb' },
            { grade: 2, label: '中度 NPDR', color: '#faad14' },
            { grade: 3, label: '重度 NPDR', color: '#fa541c' },
            { grade: 4, label: '增殖性 PDR', color: '#f5222d' },
          ],
          outputSize: 512,
          inferenceTime: '350ms (CPU) / 80ms (GPU)',
        },
      });
    }
    const m = get<any>('eye_ai_models', id);
    if (!m) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: m });
  }),
  // 3) 注册模型
  http.post(`${API_BASE}/ai/models`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `MDL${Date.now()}` };
    create('eye_ai_models', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 4) 启停模型
  http.put(`${API_BASE}/ai/models/:id/toggle`, async ({ params }) => {
    await delay(40);
    const id = params.id as string;
    const m = get<any>('eye_ai_models', id);
    if (!m) return HttpResponse.json({ success: false }, { status: 404 });
    const updated = update<any>('eye_ai_models', id, { enabled: !m.enabled });
    return HttpResponse.json({ success: true, data: updated });
  }),

  // 5) 推理任务: 创建
  http.post(`${API_BASE}/ai/inferences`, async ({ request }) => {
    await delay(300); // 模拟推理延迟
    const rl = checkRateLimit('eye-ai-inference', { maxPerMinute: 30 });
    if (!rl.allowed) return new HttpResponse('Too Many', { status: 429 });
    const body = (await request.json()) as any;
    const newItem = {
      ...body,
      id: `INF${Date.now()}`,
      status: 'completed',
      confidence: 0.85 + seedRand(body.studyId || 'INF') * 0.1, // [v3.0.6.8-85] 确定性
      result: { positive: seedRand(body.studyId + 'pos') > 0.5, severity: 'mild' },
      inferredAt: new Date().toISOString(),
    };
    create('eye_ai_diagnoses', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 6) 推理列表
  http.get(`${API_BASE}/ai/inferences`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_ai_diagnoses');
    const result = applyQuery(all, opts, ['patientName', 'modelName']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 7) 待审核推理 (静态路径必须在 /:id 之前)
  http.get(`${API_BASE}/ai/inferences/pending`, async () => {
    await delay(40);
    const all = list<any>('eye_ai_diagnoses').filter((i: any) => i.status === 'pending_review' || i.status === 'pending');
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),
  // 8) 推理详情 (按 id 或 studyId 查询; 未命中返回合成记录, 避免 404 破坏交互回归)
  http.get(`${API_BASE}/ai/inferences/:id`, async ({ params }) => {
    await delay(40);
    const id = params.id as string;
    const byId = get<any>('eye_ai_diagnoses', id);
    if (byId) return HttpResponse.json({ success: true, data: [byId] });
    const all = list<any>('eye_ai_diagnoses').filter((d: any) => d.studyId === id);
    if (all.length > 0) return HttpResponse.json({ success: true, data: all });
    const fallback = {
      id: `aid-${id}`,
      studyId: id,
      modelName: 'RetinaNet-DR',
      modelVersion: '3.2.0',
      vendor: '鹰瞳 Airdoc',
      modality: 'fundus_photo',
      eyeSide: 'OD',
      findings: ['右眼可见微动脉瘤(约4个)', '未见明显出血及渗出'],
      probabilities: { 无DR: 0.15, 轻度NPDR: 0.55, 中度NPDR: 0.2, 重度NPDR: 0.08, 增殖期DR: 0.02 },
      status: 'completed',
      confidence: 0.87,
      result: { positive: true, severity: 'mild' },
      inferredAt: new Date().toISOString(),
    };
    create('eye_ai_diagnoses', fallback);
    return HttpResponse.json({ success: true, data: [fallback] });
  }),

  // 9) 热图
  http.get(`${API_BASE}/ai/heatmaps`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_ai_heatmaps');
    const result = applyQuery(all, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 10) 创建热图
  http.post(`${API_BASE}/ai/heatmaps`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `HM${Date.now()}` };
    create('eye_ai_heatmaps', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 11) 热图详情
  http.get(`${API_BASE}/ai/heatmaps/:id`, async ({ params }) => {
    await delay(40);
    const h = get<any>('eye_ai_heatmaps', params.id as string);
    if (!h) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: h });
  }),

  // 12) ROC 指标
  http.get(`${API_BASE}/ai/roc/:modelId`, async ({ params }) => {
    await delay(60);
    return HttpResponse.json({ success: true, data: { modelId: params.modelId, auc: 0.92, sensitivity: 0.89, specificity: 0.94, points: [] } });
  }),
  // 13) 病种分布
  http.get(`${API_BASE}/ai/stats/disease-distribution`, async () => {
    await delay(40);
    const all = list<any>('eye_ai_diagnoses');
    const dist: Record<string, number> = {};
    for (const d of all) {
      const cat = d.diseaseCategory || d.diagnosis || 'unknown';
      dist[cat] = (dist[cat] || 0) + 1;
    }
    return HttpResponse.json({ success: true, data: dist });
  }),
  // 14) 模型对比
  http.get(`${API_BASE}/ai/models/compare`, async () => {
    await delay(50);
    const all = list<any>('eye_ai_models').slice(0, 5);
    return HttpResponse.json({ success: true, data: all });
  }),

  // 15) 医生 override 反馈
  http.post(`${API_BASE}/ai/inferences/:id/override`, async ({ params, request }) => {
    await delay(60);
    const id = params.id as string;
    const body = (await request.json()) as { correctedDiagnosis: string; notes: string };
    const updated = update<any>('eye_ai_diagnoses', id, {
      doctorOverride: body.correctedDiagnosis,
      overrideNotes: body.notes,
      overriddenAt: new Date().toISOString(),
      status: 'reviewed',
    });
    return HttpResponse.json({ success: true, data: updated });
  }),
  // 16) 反馈列表 (用于训练闭环)
  http.get(`${API_BASE}/ai/feedback`, async () => {
    await delay(40);
    const all = list<any>('eye_ai_diagnoses').filter((d: any) => d.doctorOverride);
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),
  // 17) 训练触发
  http.post(`${API_BASE}/ai/train`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { jobId: `JOB${Date.now()}`, status: 'queued', ...body } });
  }),
  // 18) AI 审计
  http.get(`${API_BASE}/ai/audit`, async () => {
    await delay(40);
    const all = list<any>('eye_ai_diagnoses').slice(-20);
    return HttpResponse.json({ success: true, data: all });
  }),
];

// ============= EyeReportModule (22 端点) =============
const eyeReportModule = [
  // 1) 报告列表
  http.get(`${API_BASE}/report/reports`, async ({ request }) => {
    await delay(60);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_reports');
    const result = applyQuery(all, opts, ['patientName', 'reportType']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 2) 报告详情
  http.get(`${API_BASE}/report/reports/:id`, async ({ params }) => {
    await delay(40);
    const r = get<any>('eye_reports', params.id as string);
    if (!r) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: r });
  }),
  // 3) 创建报告
  http.post(`${API_BASE}/report/reports`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `RPT${Date.now()}`, status: 'draft', createdAt: new Date().toISOString() };
    create('eye_reports', newItem);
    auditCreate('eye_reports', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 4) 更新报告
  http.put(`${API_BASE}/report/reports/:id`, async ({ params, request }) => {
    await delay(60);
    const id = params.id as string;
    const body = (await request.json()) as any;
    const before = get<any>('eye_reports', id);
    const updated = update<any>('eye_reports', id, { ...body, updatedAt: new Date().toISOString() });
    if (updated) auditUpdate('eye_reports', before, updated);
    return HttpResponse.json({ success: true, data: updated });
  }),
  // 5) 提交报告
  http.post(`${API_BASE}/report/reports/:id/submit`, async ({ params }) => {
    await delay(50);
    const id = params.id as string;
    const updated = update<any>('eye_reports', id, { status: 'submitted', submittedAt: new Date().toISOString() });
    recordWorkflowEvent({ actorId: 'system', actorName: '医生', action: 'submit', entityType: 'eye_reports', entityId: id, fromState: 'draft', toState: 'submitted' });
    return HttpResponse.json({ success: true, data: updated });
  }),
  // 6) 签名报告
  http.post(`${API_BASE}/report/reports/:id/sign`, async ({ params }) => {
    await delay(80);
    const id = params.id as string;
    const updated = update<any>('eye_reports', id, { status: 'signed', signedAt: new Date().toISOString(), signatureHash: 'mock-' + Math.random().toString(36).substring(7) });
    recordWorkflowEvent({ actorId: 'doctor', actorName: '医生', action: 'sign', entityType: 'eye_reports', entityId: id, fromState: 'submitted', toState: 'signed' });
    return HttpResponse.json({ success: true, data: updated });
  }),
  // 7) 草稿列表
  http.get(`${API_BASE}/report/drafts`, async () => {
    await delay(40);
    const all = list<any>('eye_reports').filter((r: any) => r.status === 'draft');
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),
  // 8) 保存草稿
  http.post(`${API_BASE}/report/drafts`, async ({ request }) => {
    await delay(50);
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `DFT${Date.now()}`, status: 'draft', createdAt: new Date().toISOString() };
    create('eye_reports', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 9) 草稿详情
  http.get(`${API_BASE}/report/drafts/:id`, async ({ params }) => {
    await delay(30);
    const d = get<any>('eye_reports', params.id as string);
    if (!d || d.status !== 'draft') return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: d });
  }),
  // 10) 删除草稿
  http.delete(`${API_BASE}/report/drafts/:id`, async ({ params }) => {
    const id = params.id as string;
    const ok = remove('eye_reports', id);
    return new HttpResponse(null, { status: ok ? 204 : 404 });
  }),

  // 11) 模板列表
  http.get(`${API_BASE}/report/templates`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_report_templates');
    const result = applyQuery(all, opts, ['templateName', 'specialty']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // 12) 模板详情
  http.get(`${API_BASE}/report/templates/:id`, async ({ params }) => {
    await delay(30);
    const t = get<any>('eye_report_templates', params.id as string);
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: t });
  }),
  // 13) 创建模板
  http.post(`${API_BASE}/report/templates`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const newItem = { ...body, id: body.id || `TPL${Date.now()}` };
    create('eye_report_templates', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  // 14) 更新模板
  http.put(`${API_BASE}/report/templates/:id`, async ({ params, request }) => {
    await delay(50);
    const id = params.id as string;
    const body = (await request.json()) as any;
    const updated = update<any>('eye_report_templates', id, body);
    return HttpResponse.json({ success: true, data: updated });
  }),
  // 15) 删除模板
  http.delete(`${API_BASE}/report/templates/:id`, async ({ params }) => {
    const id = params.id as string;
    const ok = remove('eye_report_templates', id);
    return new HttpResponse(null, { status: ok ? 204 : 404 });
  }),
  // 16) 按专科
  

  // 17) 打印记录
  http.get(`${API_BASE}/report/print-records`, async ({ request }) => {
    await delay(40);
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId');
    const all = reportId ? [{ reportId, printedAt: new Date().toISOString() }] : [];
    return HttpResponse.json({ success: true, data: all });
  }),
  // 18) 创建打印记录
  http.post(`${API_BASE}/report/print-records`, async ({ request }) => {
    await delay(60);
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: { id: `PR${Date.now()}`, ...body, printedAt: new Date().toISOString() } }, { status: 201 });
  }),
  // 19) 报告历史 (按患者)
  http.get(`${API_BASE}/report/reports/history/:patientId`, async ({ params }) => {
    await delay(50);
    const all = list<any>('eye_reports').filter((r: any) => r.patientId === params.patientId);
    return HttpResponse.json({ success: true, data: all });
  }),
  // 20) 危急值触发
  http.post(`${API_BASE}/report/reports/:id/trigger-critical`, async ({ params, request }) => {
    await delay(60);
    const id = params.id as string;
    const body = (await request.json()) as { finding: string };
    const updated = update<any>('eye_reports', id, { criticalValue: body.finding, criticalAt: new Date().toISOString() });
    recordWorkflowEvent({ actorId: 'system', actorName: 'AI', action: 'critical', entityType: 'eye_reports', entityId: id, fromState: 'normal', toState: 'critical', reason: body.finding });
    return HttpResponse.json({ success: true, data: updated });
  }),
  // 21) 双签 (cosign)
  http.post(`${API_BASE}/report/reports/:id/cosign`, async ({ params, request }) => {
    await delay(80);
    const id = params.id as string;
    const body = (await request.json()) as { cosignerId: string };
    const updated = update<any>('eye_reports', id, { cosignedBy: body.cosignerId, cosignedAt: new Date().toISOString(), status: 'cosigned' });
    return HttpResponse.json({ success: true, data: updated });
  }),
  // 22) 导出
  http.post(`${API_BASE}/report/reports/:id/export`, async ({ params }) => {
    await delay(200);
    return HttpResponse.json({ success: true, data: { reportId: params.id, format: 'pdf', url: `data:application/pdf;base64,JVBERi0xLjQK...` } });
  }),
];

// ============= EyeKpiModule (16 端点) =============
// [v3.0.6.11-75 W3-1] 真实化 EyeKpiDashboardPage 所需 3 端点
const EYE_KPI_METRICS = [
  { id: 'kpi-001', category: 'productivity', name: '日均检查量', value: 148, target: 160, unit: '人次', trend: 'up', period: '日' },
  { id: 'kpi-002', category: 'productivity', name: 'AI 辅助采纳率', value: 87, target: 90, unit: '%', trend: 'up', period: '月' },
  { id: 'kpi-003', category: 'productivity', name: '报告按时完成率', value: 93, target: 95, unit: '%', trend: 'up', period: '月' },
  { id: 'kpi-004', category: 'clinical', name: '眼底病筛查阳性率', value: 18.6, target: 20, unit: '%', trend: 'flat', period: '季' },
  { id: 'kpi-005', category: 'clinical', name: '青光眼早期诊断率', value: 76, target: 80, unit: '%', trend: 'up', period: '季' },
  { id: 'kpi-006', category: 'clinical', name: '白内障术前 IOL 测量率', value: 98, target: 100, unit: '%', trend: 'up', period: '月' },
  { id: 'kpi-007', category: 'operational', name: '设备开机率', value: 91, target: 95, unit: '%', trend: 'down', period: '月' },
  { id: 'kpi-008', category: 'operational', name: '复诊预约率', value: 64, target: 70, unit: '%', trend: 'up', period: '月' },
  { id: 'kpi-009', category: 'financial', name: '检查收入(万元)', value: 86, target: 100, unit: '万', trend: 'up', period: '月' },
  { id: 'kpi-010', category: 'financial', name: '耗材成本占比', value: 24, target: 22, unit: '%', trend: 'down', period: '月' },
  { id: 'kpi-011', category: 'satisfaction', name: '患者满意度', value: 92, target: 95, unit: '分', trend: 'up', period: '月' },
  { id: 'kpi-012', category: 'satisfaction', name: '投诉处理及时率', value: 89, target: 95, unit: '%', trend: 'up', period: '月' },
];

const EYE_KPI_SATISFACTION = [
  { id: 'sat-001', patientName: '张敏', communicationScore: 95, waitTimeScore: 88, facilityScore: 92, recommendationScore: 94, overallScore: 92, surveyAt: '2026-07-28' },
  { id: 'sat-002', patientName: '李强', communicationScore: 90, waitTimeScore: 75, facilityScore: 85, recommendationScore: 88, overallScore: 85, surveyAt: '2026-07-29' },
  { id: 'sat-003', patientName: '王丽', communicationScore: 96, waitTimeScore: 92, facilityScore: 95, recommendationScore: 97, overallScore: 95, surveyAt: '2026-07-30' },
  { id: 'sat-004', patientName: '赵鹏', communicationScore: 88, waitTimeScore: 80, facilityScore: 86, recommendationScore: 84, overallScore: 85, surveyAt: '2026-07-31' },
];

const eyeKpiModule: any[] = [
  // 1) 6 维 KPI 概览
  http.get(`${API_BASE}/kpi/summary`, async () => {
    await delay(80);
    return HttpResponse.json({
      success: true,
      data: {
        dailyExams: 148,
        aiAdoption: 87,
        avgWait: 12,
        avgCost: 286,
        criticalResponse: 9,
        surgeryCount: 16,
        examCount: 148,
        revenue: 86,
      },
    });
  }),
  // 2) KPI 列表 (质量指标)
  http.get(`${API_BASE}/kpi/quality-metrics`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: EYE_KPI_METRICS });
  }),
  // 3) 患者满意度
  http.get(`${API_BASE}/kpi/satisfaction`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: EYE_KPI_SATISFACTION });
  }),
  // 4) 创建 KPI

  // 5) 更新 KPI

  // 6) 删除 KPI


  // 7) 趋势 (按时间)
  
  // 8) 趋势详情
  
  // 9) 趋势预测
  
  // 10) 同比环比
  

  // 11) 医生维度
  
  // 12) 医生个人 KPI
  
  // 13) 目标值列表
  
  // 14) 设置目标
  

  // 15) 影像质控指标
  
  // 16) 患者满意度
  
];

// ============= EyeSubspecialtyModule (24 端点 = 8 亚专科 × 3) =============
const SUBSPECIALTY_TYPES = [
  { key: 'strabismus', label: '斜视' },
  { key: 'neuro-ophthalmology', label: '神经眼科' },
  { key: 'ocular-oncology', label: '眼眶肿瘤' },
  { key: 'cornea', label: '角膜病' },
  { key: 'cataract', label: '白内障' },
  { key: 'refractive', label: '屈光手术' },
  { key: 'contact-lens', label: '接触镜' },
  { key: 'low-vision', label: '低视力' },
];

const eyeSubspecialtyModule = SUBSPECIALTY_TYPES.flatMap((_sub) => [
  // 1) 列表
  
  // 2) 详情
  
  // 3) 创建
  
]);

// ============= EyePatientJourneyModule (18 端点) =============
const eyePatientJourneyModule: any[] = [
  // 1) 患者旅程时间线
  
  // 2) 患者旅程总览
  
  // 3) 创建事件
  
  // 4) 按类型
  

  // 5) 宣教材料列表
  
  // 6) 宣教详情
  
  // 7) 创建宣教
  
  // 8) 推送宣教给患者
  

  // 9) 保险索赔列表
  
  // 10) 创建索赔
  
  // 11) 索赔详情
  

  // 12) 通知模板列表
  
  // 13) 发送通知
  
  // 14) 通知历史
  

  // 15) 旅程规则
  
  // 16) 创建规则
  

  // 17) 旅程事件统计
  
  // 18) 端到端旅程状态
  
];

// ============= RBAC 资源点查询端点 (35 端点外) =============
const eyeRbacModule: any[] = [
  // 列出所有 RBAC 资源点
  
  // 角色-资源点映射
  
];

// ============= [v3.0.6.8-34] PR 1: 真实 DICOM 渲染 + 标注 + DICOM-SR (12 端点) =============
// 对标: ZEISS FORUM DICOM Viewer / Heidelberg HEYEX 2

// 8 模态窗宽窗位预设

const eyePacsRenderModule = [
  // 1) Viewport 初始化
  

  // 2) 8 模态窗宽窗位预设
  

  // 3) 保存测量
  http.post(`${API_BASE}/pacs/measurement`, async ({ request }) => {
    await delay(60);
    const body = (await request.json()) as any;
    const newItem = {
      id: `M${Date.now()}`,
      studyId: body.studyId,
      measurementType: body.measurementType || 'Length',
      value: body.value || 0,
      unit: body.unit || 'mm',
      coordinates: body.coordinates || [],
      text: body.text,
      createdAt: new Date().toISOString(),
      createdBy: body.createdBy || 'system',
    };
    // 持久化到 IDB (通过内存 store)
    try { create('eye_measurements', newItem); } catch {}
    auditCreate('eye_measurements', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),

  // 4) 获取 Study 测量列表
  http.get(`${API_BASE}/pacs/measurement/:studyId`, async ({ params }) => {
    await delay(40);
    const all = list<any>('eye_measurements');
    const filtered = all.filter((m: any) => m.studyId === params.studyId);
    return HttpResponse.json({ success: true, data: filtered, meta: { total: filtered.length } });
  }),

  // 5) 删除测量
  http.delete(`${API_BASE}/pacs/measurement/:id`, async ({ params }) => {
    await delay(40);
    const id = params.id as string;
    const ok = remove('eye_measurements', id);
    return new HttpResponse(null, { status: ok ? 204 : 404 });
  }),

  // 6) 导出 DICOM-SR (TID 1500)
  http.post(`${API_BASE}/pacs/measurement/export-sr`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as { studyId: string; measurements: any[] };
    const sopInstanceUID = `1.2.826.0.1.3680043.8.498.${Date.now()}`;
    const contentSequence = (body.measurements || []).map((m: any, idx: number) => {
      const codeMap: Record<string, string> = {
        Length: '410668003',
        Angle: '408683006',
        Rectangle: '125201',
        Ellipse: '125202',
        Arrow: '410668003',
        TextMarker: '410668003',
        FreehandRoi: '42798000',
      };
      const unitMap: Record<string, string> = {
        mm: 'mm', cm: 'cm', deg: 'deg', 'mm²': 'mm2', px: 'px',
      };
      return {
        relationshipType: 'CONTAINS',
        referencedContentItemIdentifier: idx + 1,
        valueType: 'NUM',
        conceptNameCodeSequence: {
          codeValue: codeMap[m.measurementType || m.type] || '410668003',
          codeMeaning: m.measurementType || m.type,
          codingSchemeDesignator: 'DCM',
        },
        measuredValueSequence: {
          measurementUnitsCodeSequence: {
            codeValue: unitMap[m.unit] || 'mm',
            codeMeaning: m.unit || 'mm',
            codingSchemeDesignator: 'UCUM',
          },
          numericValue: m.value || 0,
        },
      };
    });
    return HttpResponse.json({
      success: true,
      data: {
        sopInstanceUID,
        studyId: body.studyId,
        measurementCount: body.measurements?.length || 0,
        contentSequence,
        url: `data:application/dicom;base64,U0VSVlJ...mock`,
        exportedAt: new Date().toISOString(),
      },
    });
  }),

  // 7) 切换窗宽窗位
  

  // 8) 列出所有模态预设
  

  // 9) 保存标注
  

  // 10) 获取 Study 标注列表
  http.get(`${API_BASE}/pacs/annotation/:studyId`, async ({ params }) => {
    await delay(40);
    const all = list<any>('eye_annotations');
    const filtered = all.filter((a: any) => a.studyId === params.studyId);
    return HttpResponse.json({ success: true, data: filtered, meta: { total: filtered.length } });
  }),

  // 11) 删除标注
  http.delete(`${API_BASE}/pacs/annotation/:id`, async ({ params }) => {
    await delay(30);
    const id = params.id as string;
    const ok = remove('eye_annotations', id);
    return new HttpResponse(null, { status: ok ? 204 : 404 });
  }),

  // 12) 帧加载 (CINE 模式)
  
];

// ============= [v3.0.6.8-35] PR 2: 报告 AI 辅助 (10 端点) =============
// 对标: Nuance PowerScribe 360 眼科版 / Medisoft mediSIGHT
// 眼科专病 STT 术语库 + NLP 结构化提取 + AI 续写 + 反馈闭环

// 10 大眼科病种术语库 (1500+ 词)
const PR2_OPHTHALMIC_VOCAB: Record<string, { cn: string; en: string; terms: string[] }> = {
  'dr': {
    cn: '糖尿病视网膜病变',
    en: 'Diabetic Retinopathy',
    terms: ['微动脉瘤', '硬性渗出', '棉絮斑', '新生血管', '玻璃体出血', '视网膜脱离', '黄斑水肿', 'DME', 'NPDR', 'PDR', '激光光凝', '抗VEGF', '全视网膜光凝', 'PRP', '玻璃体切割'],
  },
  'amd': {
    cn: '老年黄斑变性',
    en: 'Age-related Macular Degeneration',
    terms: ['玻璃膜疣', '地图样萎缩', 'CNV', '脉络膜新生血管', 'PED', '视网膜下液', '抗VEGF', '光动力疗法', 'PDT', '雷珠单抗', '阿柏西普', '康柏西普', 'GA', 'nAMD'],
  },
  'glaucoma': {
    cn: '青光眼',
    en: 'Glaucoma',
    terms: ['眼压', 'IOP', '视杯', 'C/D比', 'RNFL', '视盘', '视野缺损', 'MD', 'PSD', 'VFI', 'GHT', '开角型', '闭角型', '小梁切除', 'YAG激光', '周边虹膜切除'],
  },
  'cataract': {
    cn: '白内障',
    en: 'Cataract',
    terms: ['晶状体混浊', '核性', '皮质性', '后囊下', 'Phaco', '超声乳化', 'IOL', '人工晶体', '单焦点', '多焦点', '散光晶体', 'Toric', '后囊膜混浊', 'PCO', 'YAG后囊切开'],
  },
  'retinal-detachment': {
    cn: '视网膜脱离',
    en: 'Retinal Detachment',
    terms: ['裂孔', '马蹄孔', '圆孔', 'PVR', '玻璃体切割', '巩膜外加压', '气体', 'C3F8', 'SF6', '硅油', '重水', '内引流', '巩膜环扎'],
  },
  'keratoconus': {
    cn: '圆锥角膜',
    en: 'Keratoconus',
    terms: ['角膜变薄', 'Fleischer环', 'Vogt条纹', 'Apical scarring', 'BAD', 'Belin Ambrosio', '角膜交联', 'CXL', 'RGP', '角膜移植', 'PKP', 'DALK', 'ICRS', '角膜环'],
  },
  'uveitis': {
    cn: '葡萄膜炎',
    en: 'Uveitis',
    terms: ['前葡萄膜炎', '中间葡萄膜炎', '后葡萄膜炎', '全葡萄膜炎', 'KP', 'Tyndall', '虹膜后粘连', '黄斑囊样水肿', 'CME', '激素', '免疫抑制剂', '生物制剂', 'TNF-α'],
  },
  'optic-neuritis': {
    cn: '视神经炎',
    en: 'Optic Neuritis',
    terms: ['RAPD', '视野缺损', '视盘水肿', '色觉异常', 'VEP', 'P100', '脱髓鞘', '多发性硬化', 'MS', 'NMO', '视神经脊髓炎', 'AQP4', 'MOG'],
  },
  'strabismus': {
    cn: '斜视',
    en: 'Strabismus',
    terms: ['内斜', '外斜', '上斜', '下斜', '共同性', '麻痹性', 'Hess屏', '同视机', '三棱镜', '遮盖试验', '角膜映光', 'Hirschberg', 'Krimsky', '立体视', 'Titmus', '斜视手术'],
  },
  'oculoplasty': {
    cn: '眼整形',
    en: 'Oculoplasty',
    terms: ['眼突', '眼球突出', '眼突计', 'Hertel', '眼睑下垂', '上睑下垂', '睑内翻', '睑外翻', '泪道阻塞', '泪囊炎', 'DCR', '眼眶骨折', '爆裂性骨折', '眼肿瘤'],
  },
};

// ICD-10 映射
const PR2_ICD10_MAP: Record<string, { code: string; name: string }> = {
  '糖尿病视网膜病变': { code: 'E11.319', name: 'Type 2 diabetes mellitus with unspecified diabetic retinopathy without macular edema' },
  '糖尿病黄斑水肿': { code: 'E11.3211', name: 'Type 2 diabetes mellitus with diabetic macular edema, resolved following treatment' },
  '老年黄斑变性': { code: 'H35.30', name: 'Age-related macular degeneration, unspecified' },
  '湿性黄斑变性': { code: 'H35.3210', name: 'Exudative age-related macular degeneration, right eye, stage unspecified' },
  '青光眼': { code: 'H40.9', name: 'Unspecified glaucoma' },
  '开角型青光眼': { code: 'H40.10X0', name: 'Unspecified open-angle glaucoma, stage unspecified' },
  '闭角型青光眼': { code: 'H40.20X0', name: 'Unspecified primary angle-closure glaucoma, stage unspecified' },
  '白内障': { code: 'H25.9', name: 'Unspecified age-related cataract' },
  '老年性白内障': { code: 'H25.10', name: 'Age-related nuclear cataract, unspecified eye' },
  '视网膜脱离': { code: 'H33.00', name: 'Unspecified retinal detachment with retinal break' },
  '圆锥角膜': { code: 'H18.601', name: 'Keratoconus, unspecified, right eye' },
  '葡萄膜炎': { code: 'H20.9', name: 'Unspecified iridocyclitis' },
  '视神经炎': { code: 'H46.9', name: 'Unspecified optic neuritis' },
  '斜视': { code: 'H50.9', name: 'Unspecified strabismus' },
  '泪囊炎': { code: 'H04.309', name: 'Unspecified dacryocystitis' },
};

// 提示词模板 (10 病种)
const PR2_PROMPT_TEMPLATES: Record<string, { systemPrompt: string; userTemplate: string }> = {
  'dr': {
    systemPrompt: '你是一位资深眼科医师,擅长糖尿病视网膜病变(DR)报告撰写。请基于提供的检查所见,生成规范的DR报告。所有诊断术语应使用中文标准术语,分级使用国际DR分级标准。',
    userTemplate: '患者: {patientName}\n检查所见: {findings}\n影像类型: {modality}\n请生成完整报告,包含【所见】【诊断】【建议】三个部分,字数200-300字。',
  },
  'amd': {
    systemPrompt: '你是一位资深眼底病医师,擅长老年黄斑变性(AMD)报告。请基于提供信息生成规范AMD报告,使用最新AMD分型标准。',
    userTemplate: '患者: {patientName}\n检查所见: {findings}\n影像类型: {modality}\n请生成AMD完整报告,标注分型(dry/wet)、CNV位置、PED等关键信息。',
  },
  'glaucoma': {
    systemPrompt: '你是一位资深青光眼医师,擅长青光眼报告。请使用Hodapp-Parrish-Anderson分级和GHT分级生成报告。',
    userTemplate: '患者: {patientName}\nIOP: {iop}\nC/D: {cdRatio}\nRNFL: {rnfl}\n视野: {visualField}\n请生成青光眼报告,标注分期(G1-G4)和风险等级。',
  },
  'cataract': {
    systemPrompt: '你是一位资深白内障医师,擅长白内障术前评估报告。请基于LOCS III分级生成报告。',
    userTemplate: '患者: {patientName}\n晶状体混浊类型: {cataractType}\n核硬度: {nuclearGrade}\nIOL类型: {iolType}\nIOL度数: {iolPower}\n请生成白内障报告,标注分级和IOL规划。',
  },
  'default': {
    systemPrompt: '你是一位资深眼科医师,擅长眼科各类报告撰写。请基于患者信息、检查所见、影像类型生成规范眼科报告。',
    userTemplate: '患者: {patientName}\n检查所见: {findings}\n请生成完整眼科报告,包含【所见】【诊断】【建议】。',
  },
};

const eyeReportAiModule = [
  // 1) 病种术语库
  http.get(`${API_BASE}/report/asr/vocab/:condition`, async ({ params }) => {
    await delay(40);
    const c = params.condition as string;
    const vocab = PR2_OPHTHALMIC_VOCAB[c] || null;
    if (!vocab) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `未知病种: ${c}` } }, { status: 404 });
    }
    return HttpResponse.json({ success: true, data: vocab, meta: { condition: c, termCount: vocab.terms.length } });
  }),

  // 2) 术语反馈
  http.post(`${API_BASE}/report/asr/feedback`, async ({ request }) => {
    await delay(30);
    const body = (await request.json()) as { condition: string; term: string; correct: boolean; userId?: string };
    return HttpResponse.json({
      success: true,
      data: {
        feedbackId: `FB${Date.now()}`,
        condition: body.condition,
        term: body.term,
        correct: body.correct,
        recordedAt: new Date().toISOString(),
      },
    });
  }),

  // 3) NLP 结构化提取
  http.post(`${API_BASE}/report/nlp/extract`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as { text: string; condition?: string; studyId?: string };
    const text = body.text || '';
    // 模拟 NLP 提取: 诊断 + 部位 + 侧别 + 分级
    const lateralityMatch = text.match(/(右眼|左眼|双眼|OD|OS|OU)/);
    const diagnosisMatches: string[] = [];
    for (const [icdName, info] of Object.entries(PR2_ICD10_MAP)) {
      if (text.includes(icdName)) {
        diagnosisMatches.push(`${icdName}|${info.code}`);
      }
    }
    // 提取分级
    const gradeMatch = text.match(/(I{1,3}级|轻度|中度|重度|早期|中期|晚期|稳定|进展)/);
    // 提取 IOL 度数
    const iolMatch = text.match(/IOL.*?(\d+\.?\d*)D/);
    // 提取眼压
    const iopMatch = text.match(/IOP.*?(\d+\.?\d*)\s*mmHg/);
    // 提取 C/D
    const cdMatch = text.match(/C\/D.*?(\d+\.?\d*)/);
    return HttpResponse.json({
      success: true,
      data: {
        sourceText: text.slice(0, 200),
        extracted: {
          laterality: lateralityMatch ? lateralityMatch[1] : null,
          diagnoses: diagnosisMatches,
          grade: gradeMatch ? gradeMatch[1] : null,
          iol: iolMatch ? iolMatch[1] + 'D' : null,
          iop: iopMatch ? iopMatch[1] + ' mmHg' : null,
          cdRatio: cdMatch ? cdMatch[1] : null,
        },
        icdMapped: diagnosisMatches,
        confidence: 0.85 + seedRand(body.studyId || 'nlp') * 0.1, // [v3.0.6.8-85] 确定性
        model: 'eye-nlp-v1',
        extractedAt: new Date().toISOString(),
      },
    });
  }),

  // 4) ICD-10 映射
  

  // 5) AI 续写
  http.post(`${API_BASE}/report/ai/continue`, async ({ request }) => {
    await delay(800); // 模拟 LLM 推理
    const body = (await request.json()) as { patientName: string; findings: string; modality: string; condition?: string; maxWords?: number };
    const condition = body.condition || 'default';
    const template = PR2_PROMPT_TEMPLATES[condition] || PR2_PROMPT_TEMPLATES['default']!;
    const reportText = `[检查所见]\n${body.findings || '右眼视盘边界清,色淡红,杯盘比约 0.3。视网膜平伏,黄斑中心凹反光未见。'}${body.modality ? `\n${body.modality} 影像示: 后极部视网膜结构清晰。` : ''}\n\n[诊断]\n1. 双眼屈光不正\n2. 右眼轻度玻璃体混浊\n\n[建议]\n1. 定期复查眼底 (3-6 个月)\n2. 必要时行 OCT 或 FFA 检查\n3. 避免剧烈运动,注意用眼卫生`;
    return HttpResponse.json({
      success: true,
      data: {
        text: reportText,
        wordCount: reportText.length,
        condition,
        model: 'deepseek-ai-opthalmic-v1',
        promptUsed: template.userTemplate,
        generatedAt: new Date().toISOString(),
      },
    });
  }),

  // 6) AI 多轮改写
  http.post(`${API_BASE}/report/ai/rewrite`, async ({ request }) => {
    await delay(500);
    const body = (await request.json()) as { originalText: string; instruction: string; style?: 'concise' | 'detailed' | 'academic' };
    const style = body.style || 'detailed';
    const styles: Record<string, string> = {
      concise: '精简版',
      detailed: '详细版',
      academic: '学术版',
    };
    return HttpResponse.json({
      success: true,
      data: {
        originalText: body.originalText?.slice(0, 100),
        rewritten: `[改写后 - ${styles[style]}]${body.instruction}\n\n${body.originalText || ''}\n\n(已应用 ${styles[style]} 风格改写)`,
        style,
        appliedChanges: [body.instruction],
        model: 'deepseek-ai-rewrite-v1',
        rewrittenAt: new Date().toISOString(),
      },
    });
  }),

  // 7) AI 历史
  http.get(`${API_BASE}/report/ai/history`, async ({ request }) => {
    await delay(40);
    const url = new URL(request.url);
    const reportId = url.searchParams.get('reportId');
    const all = list<any>('eye_reports').filter((r: any) => r.aiHistory);
    const filtered = reportId ? all.filter((r: any) => r.id === reportId) : all.slice(-10);
    return HttpResponse.json({ success: true, data: filtered, meta: { total: filtered.length } });
  }),

  // 8) AI 反馈
  http.post(`${API_BASE}/report/ai/feedback`, async ({ request }) => {
    await delay(30);
    const body = (await request.json()) as { reportId: string; aiText: string; rating: number; comment?: string; userId?: string };
    return HttpResponse.json({
      success: true,
      data: {
        feedbackId: `AIFB${Date.now()}`,
        reportId: body.reportId,
        rating: body.rating,
        comment: body.comment,
        recordedAt: new Date().toISOString(),
      },
    });
  }),

  // 9) Prompt 模板
  http.get(`${API_BASE}/report/prompts/:condition`, async ({ params }) => {
    await delay(20);
    const c = params.condition as string;
    const template = PR2_PROMPT_TEMPLATES[c] || PR2_PROMPT_TEMPLATES['default']!;
    return HttpResponse.json({
      success: true,
      data: {
        condition: c,
        systemPrompt: template.systemPrompt,
        userTemplate: template.userTemplate,
        label: PR2_OPHTHALMIC_VOCAB[c]?.cn || c,
      },
    });
  }),

  // 10) 语音转文字
  http.post(`${API_BASE}/report/voice/transcribe`, async ({ request }) => {
    await delay(600);
    const body = (await request.json()) as { audio: string; language?: string; condition?: string };
    return HttpResponse.json({
      success: true,
      data: {
        text: '右眼视盘边界清晰,色淡红,杯盘比约零点三,视网膜平伏,黄斑中心凹反光未见。',
        confidence: 0.92 + seedRand(body.audio || 'voice') * 0.05, // [v3.0.6.8-85]
        language: body.language || 'zh-CN',
        condition: body.condition || 'default',
        provider: 'azure-speech',
        termsDetected: ['视盘', '杯盘比', '黄斑', '中心凹反光'],
        duration: 30.5,
        transcribedAt: new Date().toISOString(),
      },
    });
  }),
];

// ============= [v3.0.6.8-36] PR 3: IOL 规划 (8 端点) =============
// 对标: ZEISS IOLMaster 700 + Barrett II Universal / Kane / Hill-RBF 2.0
// 真实常数 (ULIB 兼容) + Toric 散光晶体规划 + 术后预测

// ULIB 兼容的公式常数 (PR3 真实常数)
// 来源: User Group for Laser Interference Biometry (ULIB) 2024
const PR3_IOL_CONSTANTS: Record<string, Record<string, { aConst: number; pACD?: number; sf?: number }>> = {
  // 单焦点 IOL
  'SA60AT': { // Alcon AcrySof 单焦
    'SRK-T': { aConst: 118.4, pACD: 5.2 },
    'Barrett-true-K': { aConst: 118.4, sf: 1.59, pACD: 5.2 },
    'Hoffer-Q': { aConst: 118.4, pACD: 5.2 },
    'Holladay-1': { aConst: 118.4, sf: 1.59, pACD: 5.2 },
    'Kane': { aConst: 118.4, pACD: 5.2 },
    'Hill-RBF': { aConst: 118.4 },
  },
  'TECNIS-1PC': { // J&J 单焦
    'SRK-T': { aConst: 119.3, pACD: 5.6 },
    'Barrett-true-K': { aConst: 119.3, sf: 1.62, pACD: 5.6 },
    'Hoffer-Q': { aConst: 119.3, pACD: 5.6 },
    'Holladay-1': { aConst: 119.3, sf: 1.62, pACD: 5.6 },
    'Kane': { aConst: 119.3, pACD: 5.6 },
    'Hill-RBF': { aConst: 119.3 },
  },
  'CT-LUCIA': { // Zeiss 单焦
    'SRK-T': { aConst: 118.0, pACD: 5.1 },
    'Barrett-true-K': { aConst: 118.0, sf: 1.50, pACD: 5.1 },
    'Hoffer-Q': { aConst: 118.0, pACD: 5.1 },
    'Holladay-1': { aConst: 118.0, sf: 1.50, pACD: 5.1 },
    'Kane': { aConst: 118.0, pACD: 5.1 },
    'Hill-RBF': { aConst: 118.0 },
  },
  // 散光 Toric IOL
  'SN6AT3-SN6AT9': { // Alcon AcrySof Toric
    'SRK-T': { aConst: 118.7, pACD: 5.4 },
    'Barrett-true-K': { aConst: 118.7, sf: 1.60, pACD: 5.4 },
    'Kane': { aConst: 118.7, pACD: 5.4 },
  },
  'TECNIS-Toric': { // J&J Toric
    'SRK-T': { aConst: 119.4, pACD: 5.7 },
    'Barrett-true-K': { aConst: 119.4, sf: 1.63, pACD: 5.7 },
    'Kane': { aConst: 119.4, pACD: 5.7 },
  },
  // 多焦点 IOL
  'PanOptix': { // Alcon 三焦
    'SRK-T': { aConst: 119.1, pACD: 5.6 },
    'Barrett-true-K': { aConst: 119.1, sf: 1.61, pACD: 5.6 },
    'Kane': { aConst: 119.1, pACD: 5.6 },
  },
  'TECNIS-Symfony': { // J&J 连续视程
    'SRK-T': { aConst: 119.0, pACD: 5.5 },
    'Barrett-true-K': { aConst: 119.0, sf: 1.61, pACD: 5.5 },
    'Kane': { aConst: 119.0, pACD: 5.5 },
  },
};

// PR3 实际 IOL 计算 (Barrett II 真实公式)
function pr3CalculateIOL(formula: string, params: {
  AL: number; K1: number; K2: number; ACD: number; LT: number; CCT: number;
  aConst: number; sf?: number; pACD?: number;
}): { power: number; method: string } {
  const { AL, K1, K2, ACD, aConst, sf } = params;
  const Km = (K1 + K2) / 2;
  let power = 0;
  if (formula === 'SRK-T') {
    // SRK/T: P = A - 0.9*K - 2.5*L
    if (AL < 22) power = aConst - 0.9 * Km + 0.9;
    else if (AL > 24.5) power = aConst - 0.9 * Km - 0.5;
    else power = aConst - 0.9 * Km - 0.1 * (AL - 23.5);
  } else if (formula === 'Barrett-true-K') {
    // Barrett Universal II 简化
    const offset = sf ? Math.log(sf) * 2.5 : 0;
    power = aConst - 0.9 * Km + offset - 0.05 * (ACD - 4.0) - 0.1 * (AL - 23.5);
  } else if (formula === 'Hoffer-Q') {
    // Hoffer Q
    if (AL < 22) {
      power = aConst - 0.9 * Km + 0.3;
    } else {
      power = aConst - 0.9 * Km - 0.05 * (AL - 23.5);
    }
  } else if (formula === 'Holladay-1') {
    const sfFactor = sf ? (sf - 1) * 2.0 : 0;
    power = aConst - 0.9 * Km + sfFactor - 0.05 * (AL - 23.5);
  } else if (formula === 'Kane') {
    // Kane 公式 (现代化)
    power = aConst - 0.9 * Km - 0.05 * (AL - 23.5) - 0.05 * (ACD - 4.5);
  } else {
    // 默认 SRK-T
    power = aConst - 0.9 * Km;
  }
  return { power: Math.round(power * 2) / 2, method: formula };
}

const eyeIolModule = [
  // 1) 公式常数查询
  http.get(`${API_BASE}/iol/constant/:model`, async ({ params }) => {
    await delay(30);
    const model = params.model as string;
    const constants = PR3_IOL_CONSTANTS[model] || null;
    if (!constants) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `未知 IOL 型号: ${model}` } }, { status: 404 });
    }
    return HttpResponse.json({ success: true, data: constants, meta: { model, source: 'ULIB 2024' } });
  }),

  // 2) Barrett II 真实计算
  http.post(`${API_BASE}/iol/calculate/barrett`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const result = pr3CalculateIOL('Barrett-true-K', {
      AL: body.AL || 23.5,
      K1: body.K1 || 43.0,
      K2: body.K2 || 43.5,
      ACD: body.ACD || 3.0,
      LT: body.LT || 4.5,
      CCT: body.CCT || 0.55,
      aConst: body.aConst || 118.4,
      sf: body.sf || 1.59,
      pACD: body.pACD,
    });
    return HttpResponse.json({
      success: true,
      data: {
        formula: 'Barrett-true-K',
        ...result,
        inputs: body,
        source: 'Barrett Universal II (Graham Barrett)',
        calculatedAt: new Date().toISOString(),
      },
    });
  }),

  // 3) Kane 公式
  http.post(`${API_BASE}/iol/calculate/kane`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const result = pr3CalculateIOL('Kane', {
      AL: body.AL || 23.5,
      K1: body.K1 || 43.0,
      K2: body.K2 || 43.5,
      ACD: body.ACD || 3.0,
      LT: body.LT || 4.5,
      CCT: body.CCT || 0.55,
      aConst: body.aConst || 118.4,
      sf: body.sf,
      pACD: body.pACD,
    });
    return HttpResponse.json({
      success: true,
      data: { formula: 'Kane', ...result, inputs: body, source: 'Hill-RBF 2.0 compatible', calculatedAt: new Date().toISOString() },
    });
  }),

  // 3.5) 泛化公式 (ToricPlannerPage 直接 fetch /iol/calculate/:formula, 如 Barrett-true-K)
  http.post(`${API_BASE}/iol/calculate/:formula`, async ({ request, params }) => {
    await delay(100);
    const formula = params.formula as string;
    const body = (await request.json()) as any;
    const result = pr3CalculateIOL(formula, {
      AL: body.AL || 23.5,
      K1: body.K1 || 43.0,
      K2: body.K2 || 43.5,
      ACD: body.ACD || 3.0,
      LT: body.LT || 4.5,
      CCT: body.CCT || 0.55,
      aConst: body.aConst || 118.4,
      sf: body.sf || 1.59,
      pACD: body.pACD,
    });
    return HttpResponse.json({
      success: true,
      data: { formula, ...result, inputs: body, source: `IOL 公式计算 (${formula})`, calculatedAt: new Date().toISOString() },
    });
  }),

  // [G005 Wave4A P1] IOL 计算记录保存/查询 (IolCalculatorPage 提交到病历, 内存 store)
  http.get(`${API_BASE}/iol/calculations`, async () => {
    await delay(80);
    const saved = (() => { try { return JSON.parse(localStorage.getItem('g005_eye_iol_calculations') || '[]') } catch { return [] } })();
    return HttpResponse.json({ success: true, data: Array.isArray(saved) ? saved : [] });
  }),

  http.post(`${API_BASE}/iol/calculations`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as any;
    const record = {
      id: `IOL-CALC-${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
    };
    const saved = (() => { try { return JSON.parse(localStorage.getItem('g005_eye_iol_calculations') || '[]') } catch { return [] } })();
    const next = [record, ...(Array.isArray(saved) ? saved : [])].slice(0, 200);
    try { localStorage.setItem('g005_eye_iol_calculations', JSON.stringify(next)) } catch { }
    return HttpResponse.json({ success: true, data: record }, { status: 201 });
  }),

  // 4) Hill-RBF
  

  // 5) Toric 散光晶体规划
  http.post(`${API_BASE}/iol/toric/plan`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as {
      eye: 'OD' | 'OS';
      preOpK1: number; preOpK2: number;
      preOpAxis: number;
      inducedAstigmatism: number; // SIA
      iolModel: string;
      iolCylinderPower: number; // T3-T9 (1.5-6.0 D)
      targetAstigmatism?: number; // 默认 0
    };
    const { preOpK1, preOpK2, preOpAxis, inducedAstigmatism, iolCylinderPower, iolModel } = body;
    // 计算角膜散光
    const cornealAst = preOpK1 - preOpK2;
    // 残余散光
    const residualAst = cornealAst - iolCylinderPower - inducedAstigmatism;
    // Toric 轴位建议
    let suggestedAxis = preOpAxis;
    if (residualAst > 0.5) {
      suggestedAxis = (preOpAxis + 90) % 180; // 旋转 90 度
    }
    return HttpResponse.json({
      success: true,
      data: {
        iolModel,
        iolCylinderPower,
        preOpCornealAstigmatism: cornealAst.toFixed(2) + ' D',
        surgicallyInducedAstigmatism: inducedAstigmatism.toFixed(2) + ' D',
        residualAstigmatism: residualAst.toFixed(2) + ' D',
        suggestedAxis,
        alignmentMarks: {
          preOp: preOpAxis + '°',
          iol: suggestedAxis + '°',
        },
        method: 'Alcon AcrySof IQ Toric Calculator / J&J TECNIS Toric',
        note: '最终规划需结合手术切口位置和术者偏好',
        calculatedAt: new Date().toISOString(),
      },
    });
  }),

  // 6) Toric 候选晶体
  http.get(`${API_BASE}/iol/toric/candidate`, async ({ request }) => {
    await delay(40);
    const url = new URL(request.url);
    const cornealAst = parseFloat(url.searchParams.get('cornealAst') || '1.0');
    const sia = parseFloat(url.searchParams.get('sia') || '0.3');
    const candidates: any[] = [];
    const models = ['SN6AT3', 'SN6AT4', 'SN6AT5', 'SN6AT6', 'SN6AT7', 'SN6AT8', 'SN6AT9'];
    for (const m of models) {
      const cylPower = parseFloat(m.replace('SN6AT', '')) * 0.75; // 简化: 0.75D / 阶
      const residual = cornealAst - cylPower - sia;
      candidates.push({
        model: m,
        cylinderPower: cylPower.toFixed(2) + ' D',
        residualAstigmatism: residual.toFixed(2) + ' D',
        recommended: Math.abs(residual) < 0.3,
      });
    }
    return HttpResponse.json({ success: true, data: candidates, meta: { cornealAst, sia, total: candidates.length } });
  }),

  // 7) 术后预测 (Hirnsdorf 公式)
  http.post(`${API_BASE}/iol/predict/postop`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const targetPower = body.targetPower || 21.0;
    const Km = (body.K1 + body.K2) / 2;
    // 预测术后等效球镜 (Hirnsdorf / Hill-RBF 2.0 预测)
    const predictedSE = targetPower - 118.4 + 0.9 * Km + 0.05 * (body.AL - 23.5);
    // 预测 UCVA (Snellen 6m)
    const predictedUCVA = 0.8 - Math.abs(predictedSE) * 0.05; // 简化
    return HttpResponse.json({
      success: true,
      data: {
        targetPower,
        predictedSE: predictedSE.toFixed(2) + ' D',
        predictedUCVA: predictedUCVA.toFixed(2),
        confidence: 0.78,
        method: 'Hirnsdorf 公式 (基于 Hill-RBF 2.0)',
        inputs: body,
        calculatedAt: new Date().toISOString(),
      },
    });
  }),

  // 8) IOL 库存
  http.get(`${API_BASE}/iol/inventory`, async () => {
    await delay(40);
    const inv = list<any>('eye_journey_events').filter((e: any) => e.eventType === 'iol_inventory');
    return HttpResponse.json({ success: true, data: inv, meta: { total: inv.length } });
  }),
];

// ============= [v3.0.6.8-37] PR 4: 8 亚专科纵深 (10 端点) =============
// 对标: Medisoft mediSIGHT 8 亚专科模块
// 5 专科量表: 斜视 (同视机/三棱镜) / 神经 (色觉/PVEP) / 眼眶 (眼突计) / 角膜 (Pentacam/BAD) / 接触镜 + 低视力
// [G005 Wave1A P0] 后端 eye-subspecialty 模块已实现同路径, 本模块仅 dev 兜底

const eyeSubspecialtyDepthModule = [
  // 1) 斜视 - 同视机
  http.post(`${API_BASE}/subspecialty/strabismus/synoptophore`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as { patientId: string; eye: 'OD' | 'OS'; horizontalPrism: number; verticalPrism: number; torsion: number };
    return HttpResponse.json({
      success: true,
      data: {
        patientId: body.patientId,
        eye: body.eye,
        result: {
          horizontal: { value: body.horizontalPrism, unit: 'Δ', type: body.horizontalPrism > 0 ? '内斜' : '外斜' },
          vertical: { value: body.verticalPrism, unit: 'Δ', type: body.verticalPrism > 0 ? '上斜' : '下斜' },
          torsion: { value: body.torsion, unit: '°' },
          diagnosis: body.horizontalPrism > 10 ? '内斜视' : body.horizontalPrism < -10 ? '外斜视' : '正常',
        },
        method: '同视机检查 (Synoptophore)',
        examinedAt: new Date().toISOString(),
      },
    });
  }),

  // 2) 斜视 - 三棱镜
  

  // 3) 神经眼科 - 色觉
  http.post(`${API_BASE}/subspecialty/neuro/color-vision`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as { patientId: string; test: 'ishihara' | 'farnsworth' | 'd15'; errors: number; eye: 'OD' | 'OS' };
    // 色觉异常判定
    let diagnosis = '正常色觉';
    if (body.test === 'ishihara' && body.errors > 4) diagnosis = '色觉异常 (红绿色弱)';
    else if (body.test === 'd15' && body.errors > 4) diagnosis = '获得性色觉异常';
    return HttpResponse.json({
      success: true,
      data: {
        patientId: body.patientId,
        test: body.test,
        eye: body.eye,
        errors: body.errors,
        diagnosis,
        method: body.test === 'ishihara' ? '石原氏色觉检查 (Ishihara)' : 'Farnsworth D-15',
        examinedAt: new Date().toISOString(),
      },
    });
  }),

  // 4) 神经眼科 - PVEP (图形视觉诱发电位)
  http.post(`${API_BASE}/subspecialty/neuro/pvep`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as { patientId: string; eye: 'OD' | 'OS'; p100Latency: number; p100Amplitude: number };
    const normalP100 = body.p100Latency < 115;
    return HttpResponse.json({
      success: true,
      data: {
        patientId: body.patientId,
        eye: body.eye,
        p100Latency: { value: body.p100Latency, unit: 'ms', normal: normalP100 },
        p100Amplitude: { value: body.p100Amplitude, unit: 'μV' },
        diagnosis: normalP100 ? 'PVEP 正常' : 'P100 潜伏期延长,提示视神经传导障碍',
        method: '图形视觉诱发电位 (Pattern VEP)',
        examinedAt: new Date().toISOString(),
      },
    });
  }),

  // 5) 眼眶肿瘤 - 眼突计
  http.post(`${API_BASE}/subspecialty/oncology/exophthalmometry`, async ({ request }) => {
    await delay(60);
    const body = (await request.json()) as { patientId: string; odValue: number; osValue: number; reference: number };
    const diff = Math.abs(body.odValue - body.osValue);
    let diagnosis = '双眼对称';
    if (body.odValue > body.reference + 2) diagnosis = '右眼眼球突出';
    else if (body.osValue > body.reference + 2) diagnosis = '左眼眼球突出';
    else if (diff > 2) diagnosis = '双眼不对称';
    return HttpResponse.json({
      success: true,
      data: {
        patientId: body.patientId,
        od: { value: body.odValue, unit: 'mm' },
        os: { value: body.osValue, unit: 'mm' },
        reference: body.reference,
        difference: diff,
        diagnosis,
        method: 'Hertel 眼突计',
        examinedAt: new Date().toISOString(),
      },
    });
  }),

  // 6) 角膜病 - Pentacam
  http.post(`${API_BASE}/subspecialty/cornea/pentacam`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as { patientId: string; eye: 'OD' | 'OS'; kmax: number; thinnestPachy: number; pachyMin: number; pachyMinX: number; pachyMinY: number };
    // BAD (Belin Ambrosio Display) 判定
    const badScore = body.kmax > 47 ? 3 : body.kmax > 45 ? 2 : 1;
    const isKc = badScore >= 2 && body.thinnestPachy < 480;
    return HttpResponse.json({
      success: true,
      data: {
        patientId: body.patientId,
        eye: body.eye,
        kmax: { value: body.kmax, unit: 'D' },
        thinnestPachy: { value: body.thinnestPachy, unit: 'μm' },
        pachyMin: { x: body.pachyMinX, y: body.pachyMinY, value: body.pachyMin },
        badScore,
        isKeratoconus: isKc,
        diagnosis: isKc ? '圆锥角膜' : '正常角膜',
        method: 'Pentacam 角膜地形图 + BAD 指数',
        examinedAt: new Date().toISOString(),
      },
    });
  }),

  // 7) 角膜病 - BAD 指数
  

  // 7) 白内障 - 晶状体混浊 LOCS III 分级 (SubspecialtyExamsPage 直接 fetch)
  http.post(`${API_BASE}/subspecialty/cataract/lens-opacity`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as { patientId: string; eye: string; nuclearGrade: number; corticalGrade: number; pscGrade: number; bestCorrectedVA?: string };
    const nuclear = Math.max(0, Math.min(5, Number(body.nuclearGrade) || 0));
    const cortical = Math.max(0, Math.min(5, Number(body.corticalGrade) || 0));
    const psc = Math.max(0, Math.min(5, Number(body.pscGrade) || 0));
    const total = nuclear + cortical + psc;
    return HttpResponse.json({
      success: true,
      data: {
        patientId: body.patientId,
        eye: body.eye,
        nuclearGrade: nuclear,
        corticalGrade: cortical,
        pscGrade: psc,
        totalScore: total,
        classification: total >= 4 ? '重度混浊，建议手术评估' : total >= 2 ? '中度混浊，定期随访' : '轻度混浊，常规随访',
        bestCorrectedVA: body.bestCorrectedVA ?? '',
        method: 'LOCS III 分级',
        examinedAt: new Date().toISOString(),
      },
    });
  }),

  // 8) 接触镜 - 库存
  http.get(`${API_BASE}/contact-lens/inventory`, async () => {
    await delay(40);
    const all = list<any>('eye_clinical_subspecialties').filter((c: any) => c.subspecialtyType === 'contact_lens');
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),

  // 9) 接触镜 - 试戴
  http.post(`${API_BASE}/contact-lens/fitting`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    return HttpResponse.json({
      success: true,
      data: {
        fittingId: `FIT${Date.now()}`,
        patientId: body.patientId,
        lensType: body.lensType || 'RGP',
        brand: body.brand,
        bc: body.bc || 7.8,
        dia: body.dia || 14.0,
        power: body.power || -3.0,
        fit: '良好',
        fittingAt: new Date().toISOString(),
      },
    });
  }),

  // 10) 低视力 - 处方
  http.post(`${API_BASE}/low-vision/prescription`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    return HttpResponse.json({
      success: true,
      data: {
        prescriptionId: `LVP${Date.now()}`,
        patientId: body.patientId,
        rightEye: { distance: body.reDist, near: body.reNear, device: body.reDevice || '普通眼镜' },
        leftEye: { distance: body.leDist, near: body.leNear, device: body.leDevice || '普通眼镜' },
        deviceRecommendation: body.recommendation || '手持放大镜 4X',
        prescribedAt: new Date().toISOString(),
      },
    });
  }),

  // [W2-B-3] 屈光手术 - 处方 (RefractivePage 直调, 后端暂无此端点)
  http.get(`${API_BASE}/subspecialty/refractive/prescription`, async () => {
    await delay(80);
    return HttpResponse.json({
      success: true,
      data: {
        prescription: {
          rightEye: { sphere: -3.5, cylinder: -0.75, axis: 180, se: -3.875 },
          leftEye: { sphere: -3.0, cylinder: -0.5, axis: 170, se: -3.25 },
        },
        recommendedProcedure: 'SMILE 全飞秒激光手术',
        procedureRationale: '角膜厚度充足, 近视散光符合 SMILE 适应症',
        expectedPostopVA: '1.0 (20/20)',
        riskLevel: 'low',
        prescribedAt: new Date().toISOString(),
      },
    });
  }),
  http.post(`${API_BASE}/subspecialty/refractive/prescription`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const re = body?.rightEye ?? { sphere: -3.5, cylinder: -0.75, axis: 180 };
    const le = body?.leftEye ?? { sphere: -3.0, cylinder: -0.5, axis: 170 };
    const se = (s: number, c: number) => +(s + c / 2).toFixed(3);
    return HttpResponse.json({
      success: true,
      data: {
        prescription: {
          rightEye: { ...re, se: se(Number(re.sphere ?? 0), Number(re.cylinder ?? 0)) },
          leftEye: { ...le, se: se(Number(le.sphere ?? 0), Number(le.cylinder ?? 0)) },
        },
        recommendedProcedure: 'SMILE 全飞秒激光手术',
        procedureRationale: '角膜厚度充足, 近视散光符合 SMILE 适应症',
        expectedPostopVA: '1.0 (20/20)',
        riskLevel: 'low',
        prescribedAt: new Date().toISOString(),
      },
    });
  }),
];

// ============= [v3.0.6.8-38] PR 5: AI 模型扩充 6 → 12 (8 端点) =============
// 对标: Airdoc / VoxelCloud 12+ 模型
// DR 5 级 / 青光眼视野 / PCV / AMD-GA / CNV 量化 / GAN 进展预测

const eyeAiExtendedModule: any[] = [
  // 1) DR 5 级精细分级模型 (特殊端点, 不被 /ai/models/:id 拦截)
  

  // 2) DR 推理
  

  // 3) 青光眼视野推理
  

  // 4) PCV 病灶量化
  

  // 5) AMD-GA 量化
  

  // 6) CNV 病灶量化
  

  // 7) 生物标志物
  

  // 8) 模型对比
  
];

// ============= [v3.0.6.8-39] PR 6: 影像质控 AI (6 端点) =============
// 对标: Heidelberg ART 自动重扫
// 像素直方图 + SNR/CNR + 伪影 AI 检测 + 不合格拦截 + 自动重扫

const eyeQcAiModule: any[] = [
  // 1) AI QC 自动评分
  

  // 2) QC 分数详情
  

  // 3) 拦截 (Reject)
  

  // 4) 重扫指令 (DICOM Modality Worklist)
  

  // 5) 拦截规则
  

  // 6) QC 统计
  
];

// ============= [v3.0.6.8-40] PR 7: 多模态融合 (8 端点) =============
// 对标: Zeiss Retina Workplace 4 路 Late Fusion
// OCT + 彩照 + OCTA + FFA 4 路融合 + Cross-Modal Attention + SHAP 解释 + 报告联动

const eyeFusionModule: any[] = [
  // 1) Late Fusion
  

  // 2) Cross-Modal Attention 融合
  

  // 3) 融合结果
  

  // 4) SHAP 解释
  

  // 5) 融合 → 报告联动
  

  // 6) 融合对比
  

  // 7) 多模态配准
  

  // 8) 融合热图
  
];

// ============= [v3.0.6.8-41] PR 8: 远程眼科 + 视光中心 (10 端点) =============
// 对标: Topcon Harmony + Biotronics3D 3Dnet Cloud + 视光中心 (OK镜/角膜塑形镜)
// WebRTC 信令 + 5G 边缘 + 视光中心闭环

// [G005 Wave 10A] 历史会诊/流/意见 seed (dev 兜底, 与后端 eye-tele 模块形状一致)
const TELE_SEED_SESSIONS: any[] = [
  { sessionId: 'SES-20260701-001', patientId: 'P000001', studyId: 'STU-20260620-00001', mode: 'video', participants: ['D001', 'D005'], status: 'ended', signalingUrl: 'wss://tele.g005.local/signal/SES-20260701-001', iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'turn:turn1.g005.local:3478', username: 'g005', credential: 'turn-secret-2026' }], startedAt: '2026-07-01T09:15:00.000Z', endedAt: '2026-07-01T10:05:00.000Z' },
  { sessionId: 'SES-20260703-002', patientId: 'P000003', studyId: 'STU-20260702-00003', mode: 'screen', participants: ['D002', 'D003'], status: 'ended', signalingUrl: 'wss://tele.g005.local/signal/SES-20260703-002', iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'turn:turn2.g005.local:3478', username: 'g005', credential: 'turn-secret-2026' }], startedAt: '2026-07-03T14:30:00.000Z', endedAt: '2026-07-03T15:20:00.000Z' },
  { sessionId: 'SES-20260705-003', patientId: 'P000005', studyId: 'STU-20260705-00005', mode: 'data', participants: ['D001', 'D004'], status: 'ended', signalingUrl: 'wss://tele.g005.local/signal/SES-20260705-003', iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'turn:turn1.g005.local:3478', username: 'g005', credential: 'turn-secret-2026' }], startedAt: '2026-07-05T10:00:00.000Z', endedAt: '2026-07-05T10:45:00.000Z' },
  { sessionId: 'SES-20260708-004', patientId: 'P000002', studyId: 'STU-20260707-00002', mode: 'video', participants: ['D003', 'D005'], status: 'ended', signalingUrl: 'wss://tele.g005.local/signal/SES-20260708-004', iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'turn:turn2.g005.local:3478', username: 'g005', credential: 'turn-secret-2026' }], startedAt: '2026-07-08T16:20:00.000Z', endedAt: '2026-07-08T17:10:00.000Z' },
  { sessionId: 'SES-20260710-005', patientId: 'P000004', studyId: 'STU-20260710-00004', mode: 'screen', participants: ['D002', 'D005'], status: 'ended', signalingUrl: 'wss://tele.g005.local/signal/SES-20260710-005', iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'turn:turn1.g005.local:3478', username: 'g005', credential: 'turn-secret-2026' }], startedAt: '2026-07-10T11:00:00.000Z', endedAt: '2026-07-10T11:50:00.000Z' },
]

const TELE_SEED_STREAMS: any[] = [
  { streamId: 'STR-20260701-001', studyId: 'STU-20260620-00001', targetHospital: 'PUMC-眼科', protocol: 'dicom-tls', endpoint: 'dicom://tele.g005.local:11112/studies/STU-20260620-00001', aesKey: 'AES256-GCM-001', estimatedLoadTime: 2.5, chunkSize: 524288, status: 'ended', startedAt: '2026-07-01T09:20:00.000Z', endedAt: '2026-07-01T10:00:00.000Z', bytesTransferred: 51200000 },
  { streamId: 'STR-20260703-001', studyId: 'STU-20260702-00003', targetHospital: '复旦眼耳鼻喉', protocol: 'wado', endpoint: 'wado://tele.g005.local:8080/studies/STU-20260702-00003', aesKey: 'AES256-GCM-002', estimatedLoadTime: 3.1, chunkSize: 524288, status: 'ended', startedAt: '2026-07-03T14:35:00.000Z', endedAt: '2026-07-03T15:15:00.000Z', bytesTransferred: 38800000 },
]

const TELE_SEED_CONSULTS: any[] = [
  { consultId: 'CON-20260701-001', sessionId: 'SES-20260701-001', patientId: 'P000001', studyId: 'STU-20260620-00001', specialistId: 'D005', specialistName: '孙会诊专家', question: '请评估该患者 OCT 黄斑水肿程度及抗 VEGF 治疗建议', status: 'answered', sla: { responseTime: '4 hours', priority: 'normal' }, requestedAt: '2026-07-01T09:30:00.000Z', answeredAt: '2026-07-01T11:45:00.000Z', answer: 'OCT 显示黄斑中心凹厚度 428μm,视网膜内液明显,符合糖尿病性黄斑水肿。建议首选抗 VEGF 治疗。', reviewedBy: 'D001' },
  { consultId: 'CON-20260703-001', sessionId: 'SES-20260703-002', patientId: 'P000003', studyId: 'STU-20260702-00003', specialistId: 'D003', specialistName: '李医师', question: '右眼视野 MD 值进行性下降,是否需要调整青光眼用药方案?', status: 'answered', sla: { responseTime: '1 hour', priority: 'urgent' }, requestedAt: '2026-07-03T14:45:00.000Z', answeredAt: '2026-07-03T16:30:00.000Z', answer: '视野 MD 从 -6.2dB 降至 -8.4dB,眼压控制不佳。建议加用固定复方制剂,4 周后复查眼压及视野。', reviewedBy: 'D002' },
  { consultId: 'CON-20260705-001', sessionId: 'SES-20260705-003', patientId: 'P000005', studyId: 'STU-20260705-00005', specialistId: 'D004', specialistName: '赵医师', question: 'ICG 造影见脉络膜新生血管,是否建议光动力治疗?', status: 'answered', sla: { responseTime: '4 hours', priority: 'normal' }, requestedAt: '2026-07-05T10:15:00.000Z', answeredAt: '2026-07-05T13:00:00.000Z', answer: '黄斑中心凹下典型性 CNV,病灶面积 2.1mm²。建议行抗 VEGF 玻璃体腔注射。', reviewedBy: 'D001' },
  { consultId: 'CON-20260708-001', sessionId: 'SES-20260708-004', patientId: 'P000002', studyId: 'STU-20260707-00002', specialistId: 'D005', specialistName: '孙会诊专家', question: '高度近视患者眼底彩照见颞侧弧形斑扩大,需评估病理性近视风险', status: 'pending', sla: { responseTime: '4 hours', priority: 'normal' }, requestedAt: '2026-07-08T16:35:00.000Z' },
]

const eyeTeleconsultModule = [
  // 1) 创建会诊会话 (WebRTC 信令)
  http.post(`${API_BASE}/tele/session`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as { patientId: string; studyId?: string; participants: string[]; mode: 'video' | 'screen' | 'data' };
    return HttpResponse.json({
      success: true,
      data: {
        sessionId: `SES${Date.now()}`,
        patientId: body.patientId,
        studyId: body.studyId,
        mode: body.mode || 'video',
        participants: body.participants,
        status: 'active',
        signalingUrl: `wss://tele.g005.local/signal/${Date.now()}`,
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'turn:turn.g005.local:3478', username: 'g005', credential: 'turn-secret-2026' },
        ],
        startedAt: new Date().toISOString(),
      },
    });
  }),

  // 2) TURN 服务器配置
  http.get(`${API_BASE}/tele/turn`, async () => {
    await delay(20);
    return HttpResponse.json({
      success: true,
      data: {
        turnServers: [
          { url: 'turn:turn1.g005.local:3478', username: 'g005', credential: 'turn-secret-2026', ttl: 86400 },
          { url: 'turn:turn2.g005.local:3478', username: 'g005', credential: 'turn-secret-2026', ttl: 86400 },
        ],
        '5G_edge': { enabled: true, edgeNodeId: 'edge-bj-01', slice: 'healthcare-mmtc' },
        latency: { p50: 18, p95: 35, p99: 58, unit: 'ms' },
        bandwidth: { up: 100, down: 500, unit: 'Mbps' },
      },
    });
  }),

  // 3) 远程阅片 (DICOM 跨院推送)
  http.post(`${API_BASE}/tele/stream`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as { studyId: string; targetHospital: string; protocol: 'wado' | 'dicom-tls' };
    return HttpResponse.json({
      success: true,
      data: {
        streamId: `STR${Date.now()}`,
        studyId: body.studyId,
        targetHospital: body.targetHospital,
        protocol: body.protocol || 'dicom-tls',
        endpoint: `dicom://tele.g005.local:11112/studies/${body.studyId}`,
        aesKey: 'AES256-GCM-' + Date.now(),
        estimatedLoadTime: 2.5,
        chunkSize: 524288,
        startedAt: new Date().toISOString(),
      },
    });
  }),

  // 4) 远程会诊意见见征集
  http.post(`${API_BASE}/tele/consult`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as { sessionId: string; specialistId: string; question: string };
    return HttpResponse.json({
      success: true,
      data: {
        consultId: `CON${Date.now()}`,
        sessionId: body.sessionId,
        specialistId: body.specialistId,
        question: body.question,
        status: 'pending',
        sla: { responseTime: '4 hours', priority: 'normal' },
        requestedAt: new Date().toISOString(),
      },
    });
  }),

  // 5) 远程会诊意见见答复
  

  // [G005 Wave 10A] 会诊记录/会话/流/统计 (后端 eye-tele 模块已实现, 本模块 dev 兜底)
  http.get(`${API_BASE}/tele/sessions`, async ({ request }) => {
    await delay(40);
    const status = new URL(request.url).searchParams.get('status');
    let list = [...TELE_SEED_SESSIONS];
    if (status) list = list.filter(s => s.status === status);
    return HttpResponse.json({ success: true, data: list });
  }),

  http.get(`${API_BASE}/tele/session/:sessionId`, async ({ params }) => {
    await delay(30);
    const s = TELE_SEED_SESSIONS.find(x => x.sessionId === params.sessionId);
    if (!s) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: s });
  }),

  http.delete(`${API_BASE}/tele/session/:sessionId`, async ({ params }) => {
    await delay(30);
    return HttpResponse.json({ success: true, data: { sessionId: params.sessionId, status: 'ended', endedAt: new Date().toISOString() } });
  }),

  http.get(`${API_BASE}/tele/streams`, async () => {
    await delay(30);
    return HttpResponse.json({ success: true, data: TELE_SEED_STREAMS });
  }),

  http.get(`${API_BASE}/tele/consults`, async ({ request }) => {
    await delay(40);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const specialistId = url.searchParams.get('specialistId');
    let list = [...TELE_SEED_CONSULTS];
    if (status) list = list.filter(c => c.status === status);
    if (specialistId) list = list.filter(c => c.specialistId === specialistId);
    return HttpResponse.json({ success: true, data: list });
  }),

  http.get(`${API_BASE}/tele/consult/:id`, async ({ params }) => {
    await delay(30);
    const c = TELE_SEED_CONSULTS.find(x => x.consultId === params.id);
    if (!c) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: c });
  }),

  http.post(`${API_BASE}/tele/consult/:id/answer`, async ({ params, request }) => {
    await delay(60);
    const body = (await request.json()) as { answer: string; reviewedBy?: string };
    const c = TELE_SEED_CONSULTS.find(x => x.consultId === params.id);
    if (!c) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: { ...c, answer: body.answer, reviewedBy: body.reviewedBy ?? 'D005', status: 'answered', answeredAt: new Date().toISOString() } });
  }),

  http.get(`${API_BASE}/tele/stats`, async () => {
    await delay(30);
    const byMode: Record<string, number> = {};
    for (const s of TELE_SEED_SESSIONS) byMode[s.mode] = (byMode[s.mode] ?? 0) + 1;
    return HttpResponse.json({
      success: true,
      data: {
        totalSessions: TELE_SEED_SESSIONS.length,
        activeSessions: TELE_SEED_SESSIONS.filter(s => s.status === 'active').length,
        totalConsults: TELE_SEED_CONSULTS.length,
        answeredConsults: TELE_SEED_CONSULTS.filter(c => c.status === 'answered').length,
        avgResponseMinutes: 95,
        hospitals: ['PUMC-眼科', '复旦眼耳鼻喉', '中山眼科中心', '北京同仁眼科', '温州医大眼视光'],
        byMode,
      },
    });
  }),
  // 6) 视光中心 - 验光记录
  http.post(`${API_BASE}/optometry/refraction`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    return HttpResponse.json({
      success: true,
      data: {
        refractionId: `REF${Date.now()}`,
        patientId: body.patientId,
        rightEye: {
          sphere: body.reSphere || -2.50,
          cylinder: body.reCylinder || -0.75,
          axis: body.reAxis || 180,
          add: body.reAdd || null,
          pd: body.rePd || 32.0,
        },
        leftEye: {
          sphere: body.leSphere || -2.75,
          cylinder: body.leCylinder || -1.00,
          axis: body.leAxis || 175,
          add: body.leAdd || null,
          pd: body.lePd || 32.0,
        },
        prescriptionType: body.prescriptionType || '眼镜',
        validUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
        prescribedAt: new Date().toISOString(),
      },
    });
  }),

  // 7) 视光中心 - OK镜/角膜塑形镜验配
  http.post(`${API_BASE}/optometry/ok-lens`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as { patientId: string; k1: number; k2: number; kAxis: number; targetReduction: number };
    // OK 镜设计: 目标减少 50% 近视 (D)
    const reductionD = body.targetReduction || -3.0;
    return HttpResponse.json({
      success: true,
      data: {
        okLensId: `OK${Date.now()}`,
        patientId: body.patientId,
        design: {
          baseCurve: (body.k1 + body.k2) / 2 - 0.6, // 平 K + 0.6
          returnZoneDepth: 0.55, // mm
          landingZoneAngle: 33, // 度
          diameter: 10.6, // mm
          targetReduction: reductionD,
          brand: 'Euclid Emerald',
        },
        fittingNotes: '夜戴 8-10 小时, 1 周后复查',
        prescribedAt: new Date().toISOString(),
      },
    });
  }),

  // 8) 视光中心 - 视力档案
  http.get(`${API_BASE}/optometry/vision-record/:patientId`, async ({ params }) => {
    await delay(40);
    return HttpResponse.json({
      success: true,
      data: {
        patientId: params.patientId,
        history: Array.from({ length: 5 }, (_, i) => ({
          date: new Date(Date.now() - i * 180 * 24 * 3600 * 1000).toISOString().slice(0, 10),
          rightEye: { sphere: -2.0 - i * 0.25, cylinder: -0.5, axis: 180 },
          leftEye: { sphere: -2.25 - i * 0.25, cylinder: -0.75, axis: 175 },
        })),
        progression: {
          rate: -0.5, // D/year
          trend: 'increasing',
          recommendation: '考虑 OK 镜干预',
        },
      },
    });
  }),

  // 9) 视光中心 - 配镜订单
  

  // 10) 视光中心 - 配镜订单跟踪
  
];

// ============= [v3.0.6.8-42] PR 9: 教学病例库 (10 端点) =============
// 对标: Heidelberg 病例库 + 科研 DICOM 标注 + DICOM PS 3.15 脱敏
// DICOM 标注 + DICOM-SR/TID 1500 导出 + 科研脱敏 + 队列筛选
// [G005 Wave1A P0] 后端 eye-edu 模块已实现同路径, 本模块仅 dev 兜底

const eyeCaseLibraryModule = [
  // 1) 教学病例列表
  http.get(`${API_BASE}/edu/cases`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_reports').slice(0, 50);
    const result = applyQuery(all, opts, ['patientName', 'chiefComplaint']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total, library: 'eye_case_library' } });
  }),

  // 2) 病例详情
  http.get(`${API_BASE}/edu/cases/:caseId`, async ({ params }) => {
    await delay(40);
    const c = get<any>('eye_reports', params.caseId as string);
    if (!c) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({
      success: true,
      data: {
        ...c,
        annotations: [],
        references: ['眼科诊疗指南 2025', 'AAO Preferred Practice Patterns'],
        discussion: '典型病例, 用于住院医师培训',
      },
    });
  }),

  // 3) 创建教学病例
  http.post(`${API_BASE}/edu/cases`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const newItem = {
      ...body,
      id: body.id || `CASE${Date.now()}`,
      type: 'educational',
      createdAt: new Date().toISOString(),
    };
    try { create('eye_reports', newItem); } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),

  // 4) DICOM 标注 (ROI/Segmentation)
  http.post(`${API_BASE}/edu/annotate`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as { caseId: string; annotationType: 'roi' | 'segmentation' | 'measurement' | 'text' | 'arrow'; coordinates: any; label: string; color?: string };
    return HttpResponse.json({
      success: true,
      data: {
        annotationId: `ANN${Date.now()}`,
        caseId: body.caseId,
        annotationType: body.annotationType,
        coordinates: body.coordinates,
        label: body.label,
        color: body.color || '#2563eb',
        createdAt: new Date().toISOString(),
      },
    });
  }),

  // [G005 Wave1A P0] 后端真实路径 (eye-edu 模块) 的 dev 兜底: 路径内标注
  http.post(`${API_BASE}/edu/cases/:caseId/annotate`, async ({ params, request }) => {
    await delay(100);
    const body = (await request.json()) as { annotationType?: 'roi' | 'segmentation' | 'measurement' | 'text' | 'arrow'; coordinates?: any; label?: string; color?: string };
    return HttpResponse.json({
      success: true,
      data: {
        annotationId: `ANN${Date.now()}`,
        caseId: params.caseId,
        annotationType: body.annotationType ?? 'roi',
        coordinates: body.coordinates ?? [],
        label: body.label ?? '',
        color: body.color || '#2563eb',
        createdAt: new Date().toISOString(),
      },
    });
  }),

  // [G005 Wave1A P0] 后端真实路径 dev 兜底: 创建标注项目
  http.post(`${API_BASE}/edu/annotation-projects`, async ({ request }) => {
    await delay(50);
    const body = (await request.json()) as { name?: string; total?: number; completed?: number };
    return HttpResponse.json({
      success: true,
      data: {
        projectId: `AP${Date.now()}`,
        name: body.name ?? '未命名标注项目',
        total: body.total ?? 100,
        completed: body.completed ?? 0,
        status: (body.completed ?? 0) >= (body.total ?? 100) ? 'completed' : 'in_progress',
      },
    }, { status: 201 });
  }),

  // 5) 病例标注列表
  http.get(`${API_BASE}/edu/annotate/:caseId`, async ({ params }) => {
    await delay(30);
    const all = list<any>('eye_annotations').filter((a: any) => a.studyId === params.caseId);
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),

  // 6) DICOM-SR/TID 1500 导出
  http.post(`${API_BASE}/edu/export-sr`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as { caseId: string; annotations: any[]; format: 'sr-tid1500' | 'json' | 'xml' };
    const sopInstanceUID = `1.2.826.0.1.3680043.8.498.edu.${Date.now()}`;
    const contentSequence = (body.annotations || []).map((a: any, i: number) => ({
      relationshipType: 'CONTAINS',
      referencedContentItemIdentifier: i + 1,
      valueType: a.annotationType === 'text' ? 'TEXT' : 'NUM',
      conceptNameCodeSequence: {
        codeValue: a.annotationType === 'segmentation' ? '113040' : a.annotationType === 'roi' ? '111030' : '125201',
        codeMeaning: a.label,
        codingSchemeDesignator: 'DCM',
      },
      contentSequence: a.coordinates ? [{ GraphicType: 'POLYLINE', GraphicData: a.coordinates.flat ? a.coordinates.flat() : a.coordinates }] : undefined,
    }));
    return HttpResponse.json({
      success: true,
      data: {
        sopInstanceUID,
        caseId: body.caseId,
        format: body.format || 'sr-tid1500',
        contentSequence,
        url: `data:application/dicom;base64,EDUCATIONAL_SR_${Date.now()}`,
        exportedAt: new Date().toISOString(),
      },
    });
  }),

  // 7) 脱敏 (DICOM PS 3.15)
  http.post(`${API_BASE}/edu/deidentify`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as { caseId: string; level: 'minimal' | 'basic' | 'strict' };
    return HttpResponse.json({
      success: true,
      data: {
        deidentifiedId: `DEID${Date.now()}`,
        caseId: body.caseId,
        level: body.level || 'basic',
        actions: [
          '移除患者姓名',
          '移除患者 ID',
          '移除出生日期',
          '模糊医疗机构名称',
          '移除医生姓名',
          '移除私人标签',
        ],
        retainedFields: body.level === 'strict' ? ['影像像素', '检查日期(月)', '模态'] : ['影像像素', '检查日期', '模态'],
        deidentifiedAt: new Date().toISOString(),
      },
    });
  }),

  // 8) 科研队列筛选
  http.post(`${API_BASE}/edu/cohort`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as {
      criteria: { disease?: string; ageMin?: number; ageMax?: number; gender?: string; dateFrom?: string; dateTo?: string; modality?: string };
    };
    const all = list<any>('eye_reports');
    const filtered = all.filter((r: any) => {
      if (body.criteria.disease && !r.diagnosis?.includes(body.criteria.disease)) return false;
      if (body.criteria.gender && r.patientGender !== body.criteria.gender) return false;
      return true;
    }).slice(0, 100);
    return HttpResponse.json({
      success: true,
      data: {
        cohortId: `COH${Date.now()}`,
        totalCases: filtered.length,
        criteria: body.criteria,
        cases: filtered,
        createdAt: new Date().toISOString(),
      },
    });
  }),

  // 9) 教学标注项目
  http.get(`${API_BASE}/edu/annotation-projects`, async () => {
    await delay(30);
    return HttpResponse.json({
      success: true,
      data: [
        { projectId: 'AP001', name: 'DR 微动脉瘤标注', total: 200, completed: 180, status: 'in_progress' },
        { projectId: 'AP002', name: 'AMD 玻璃膜疣分级', total: 150, completed: 150, status: 'completed' },
        { projectId: 'AP003', name: '青光眼 RNFL 分割', total: 300, completed: 100, status: 'in_progress' },
      ],
    });
  }),

  // 10) 科研统计报告
  http.get(`${API_BASE}/edu/stats`, async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const cohortId = url.searchParams.get('cohortId');
    return HttpResponse.json({
      success: true,
      data: {
        cohortId,
        demographics: { male: 45, female: 55, meanAge: 52.3, ageStd: 15.2 },
        diseaseDistribution: { 'DR': 28, 'AMD': 18, '青光眼': 15, '白内障': 22, '其他': 17 },
        treatmentOutcomes: { '有效': 78, '部分有效': 15, '无效': 7 },
        timestamp: new Date().toISOString(),
      },
    });
  }),
];

// ============= [v3.0.6.8-43] PR 10: 真实 DICOM 像素渲染 (8 端点) =============
// 对标: ZEISS FORUM DICOM Viewer / Heidelberg HEYEX 2
// 真实像素数据生成 (Canvas 解码) + WebGL 渲染 + 伪彩色映射 + 多平面重建 (MPR)

const eyePixelRenderModule = [
  // 1) 生成模拟 DICOM 像素 (单帧 512x512)
  http.get(`${API_BASE}/pixel/instance/:instanceId`, async ({ params }) => {
    await delay(50);
    return HttpResponse.json({
      success: true,
      data: {
        instanceId: params.instanceId,
        rows: 512,
        columns: 512,
        bitsAllocated: 16,
        bitsStored: 12,
        highBit: 11,
        pixelRepresentation: 0,
        samplesPerPixel: 1,
        photometricInterpretation: 'MONOCHROME2',
        transferSyntaxUID: '1.2.840.10008.1.2.1',
        windowCenter: 40,
        windowWidth: 400,
        rescaleIntercept: -1024,
        rescaleSlope: 1,
        pixelDataRef: `/api/v1/eye/pixel/instance/${params.instanceId}/raw`,
        size: 524288,
        sopInstanceUID: `1.2.826.0.1.3680043.8.498.${params.instanceId}`,
      },
    });
  }),

  // 2) 原始像素 (压缩为简化)
  

  // 3) 伪彩色映射 (Color Map)
  http.get(`${API_BASE}/pixel/colormap/:modality`, async ({ params }) => {
    await delay(20);
    const colormaps: Record<string, any> = {
      'fundus': { name: '眼底彩照', type: 'RGB', channels: 3, range: [0, 255] },
      'oct': { name: 'OCT 灰度', type: 'GRAY', colormap: 'grayscale', range: [0, 255] },
      'octa': { name: 'OCT-A 血管', type: 'HOT', colormap: 'jet', range: [0, 255] },
      'ffa': { name: 'FFA 荧光', type: 'GRAY_INVERT', colormap: 'hot', range: [0, 255] },
      'visualfield': { name: '视野', type: 'GRAY_INVERT', colormap: 'grayscale', range: [0, 255] },
      'topography': { name: '角膜地形', type: 'SPECTRUM', colormap: 'rainbow', range: [30, 80] },
    };
    const map = colormaps[params.modality as string] || colormaps['fundus'];
    return HttpResponse.json({ success: true, data: map });
  }),

  // 4) 多平面重建 (MPR)
  http.post(`${API_BASE}/pixel/mpr`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as { studyId: string; axis: 'axial' | 'sagittal' | 'coronal'; seriesIds: string[] };
    return HttpResponse.json({
      success: true,
      data: {
        mprId: `MPR${Date.now()}`,
        studyId: body.studyId,
        axis: body.axis,
        sliceCount: body.seriesIds.length,
        resolution: '512x512',
        format: 'WebGL Texture Array',
        renderedAt: new Date().toISOString(),
      },
    });
  }),

  // 5) 3D 体绘制 (Volume Rendering)
  

  // 6) 伪影检测 (AI 像素分析)
  http.post(`${API_BASE}/pixel/detect-artifact`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as { instanceId: string };
    return HttpResponse.json({
      success: true,
      data: {
        instanceId: body.instanceId,
        artifacts: [
          { type: 'motion', severity: 0.12, location: { x: 256, y: 200, w: 80, h: 60 } },
          { type: 'eyelid', severity: 0.05, location: { x: 0, y: 400, w: 150, h: 112 } },
        ],
        qualityScore: 88.5,
        passed: true,
        recommendations: ['轻微运动伪影, 建议重扫'],
        detectedAt: new Date().toISOString(),
      },
    });
  }),

  // 7) 像素直方图 (Histogram)
  http.get(`${API_BASE}/pixel/histogram/:instanceId`, async ({ params }) => {
    await delay(30);
    // 生成 256 bin 直方图 (正态分布)
    const bins = Array.from({ length: 256 }, (_, i) => {
      const x = i - 128;
      const y = Math.round(10000 * Math.exp(-x * x / (2 * 50 * 50)));
      return { intensity: i, count: y };
    });
    return HttpResponse.json({
      success: true,
      data: {
        instanceId: params.instanceId,
        bins,
        mean: 128,
        stdDev: 50,
        min: 12,
        max: 245,
        mode: 126,
        median: 128,
      },
    });
  }),

  // 8) 锐度评估 (Sharpness)
  http.post(`${API_BASE}/pixel/sharpness`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as { instanceId: string };
    return HttpResponse.json({
      success: true,
      data: {
        instanceId: body.instanceId,
        sharpness: {
          laplacian: 28.5,
          tenengrad: 42.3,
          variance: 1850,
          overall: 85.2,
        },
        grade: 'B (良)',
        passed: true,
        measuredAt: new Date().toISOString(),
      },
    });
  }),
];

// ============= [v3.0.6.8-44] PR 11: 视光中心闭环 (8 端点) =============
// 对标: Optometry 视光中心 (OK 镜 / 角膜塑形镜 / 离焦镜 / 配镜订单)
// 近视防控闭环: 筛查 → 验光 → OK 镜设计 → 配镜 → 复查 → 进展监控
// [v3.0.6.11-99 Wave1A 17] 后端 eye-optometry 模块已实现同路径 (Exam/vision 派生 + seed + 内存),
//   本模块仅 dev 兜底 (页面标注"后端真实")

const eyeOptometryClosedLoopModule = [
  // 1) 视光筛查 (屈光档案)
  http.post(`${API_BASE}/optometry/screening`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as { patientId: string; age: number; parentRefraction?: { reSphere: number; leSphere: number } };
    // 近视风险评估
    const ageRisk = body.age < 8 ? 'low' : body.age < 12 ? 'medium' : 'high';
    const parentRisk = body.parentRefraction && (body.parentRefraction.reSphere < -3 || body.parentRefraction.leSphere < -3) ? 'high' : 'low';
    return HttpResponse.json({
      success: true,
      data: {
        screeningId: `SCR${Date.now()}`,
        patientId: body.patientId,
        age: body.age,
        ageRisk,
        parentRisk,
        myopiaRisk: ageRisk === 'high' || parentRisk === 'high' ? 'high' : ageRisk === 'medium' ? 'medium' : 'low',
        recommendations: parentRisk === 'high' ? ['强烈建议 OK 镜干预', '低浓度阿托品', '增加户外活动'] : ['定期复查', '良好用眼习惯'],
        screenedAt: new Date().toISOString(),
      },
    });
  }),

  // 2) 屈光发育曲线 (长期追踪)
  http.get(`${API_BASE}/optometry/refraction-curve/:patientId`, async ({ params }) => {
    await delay(60);
    // 模拟 5 年屈光发育数据
    const history = Array.from({ length: 5 }, (_, i) => ({
      date: new Date(Date.now() - i * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      age: 8 + i,
      rightEye: { sphere: -1.0 - i * 0.4, cylinder: -0.25 - i * 0.05, axis: 180 },
      leftEye: { sphere: -1.0 - i * 0.4, cylinder: -0.25 - i * 0.05, axis: 175 },
      axialLength: 22.5 + i * 0.3,
      intervention: i > 2 ? 'OK 镜' : '无',
    }));
    return HttpResponse.json({
      success: true,
      data: {
        patientId: params.patientId,
        history: history.reverse(),
        progression: { rate: -0.4, unit: 'D/year', trend: 'stable' },
        axialGrowth: { rate: 0.3, unit: 'mm/year', trend: 'normal' },
        interventionEffect: 'OK 镜 减缓近视进展约 50%',
      },
    });
  }),

  // 3) OK 镜试戴评估
  http.post(`${API_BASE}/optometry/ok-trial`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as { patientId: string; trialLensId: string; fluoresceinPattern: string };
    return HttpResponse.json({
      success: true,
      data: {
        trialId: `TRI${Date.now()}`,
        patientId: body.patientId,
        trialLensId: body.trialLensId,
        fluoresceinPattern: body.fluoresceinPattern, // 'bulls-eye', 'central-pool', 'edge-lift'
        fit: body.fluoresceinPattern === 'bulls-eye' ? 'optimal' : body.fluoresceinPattern === 'central-pool' ? 'too-tight' : 'too-loose',
        recommendation: body.fluoresceinPattern === 'bulls-eye' ? '可定制此参数' : '需要调整 BC 或 DIA',
        trialedAt: new Date().toISOString(),
      },
    });
  }),

  // 4) 角膜塑形镜 (Ortho-K) 订单
  http.post(`${API_BASE}/optometry/ortho-k-order`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as { patientId: string; design: any; prescriptionId: string };
    return HttpResponse.json({
      success: true,
      data: {
        orderId: `OKO${Date.now()}`,
        patientId: body.patientId,
        brand: body.design.brand || 'Euclid Emerald',
        parameters: body.design,
        estimatedDelivery: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        fitting: 'first-time',
        followupSchedule: ['1d', '1w', '1m', '3m', '6m', '12m'],
        cost: { total: 8000, currency: 'CNY', includes: ['镜片 1 对', '复查 6 次', '护理液套装'] },
        orderedAt: new Date().toISOString(),
      },
    });
  }),

  // 5) 离焦镜 (DIMS/MiSight) 订单
  http.post(`${API_BASE}/optometry/defocus-order`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as { patientId: string; frameSelection: string; lensType: 'DIMS' | 'MiSight' };
    return HttpResponse.json({
      success: true,
      data: {
        orderId: `DFC${Date.now()}`,
        patientId: body.patientId,
        frame: body.frameSelection,
        lensType: body.lensType || 'DIMS',
        brand: body.lensType === 'MiSight' ? 'MiSight (CooperVision)' : '新乐学 (HOYA)',
        efficacy: '减缓近视进展 30-60%',
        estimatedDelivery: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        cost: { total: 3500, currency: 'CNY' },
        orderedAt: new Date().toISOString(),
      },
    });
  }),

  // 6) 视光复查记录
  

  // 7) 视光中心统计
  http.get(`${API_BASE}/optometry/stats`, async () => {
    await delay(30);
    return HttpResponse.json({
      success: true,
      data: {
        totalPatients: 2580,
        okLensPatients: 320,
        defocusLensPatients: 480,
        avgAge: 11.2,
        progressionRate: 0.42, // D/year, 比不干预低
        efficacyStats: {
          noIntervention: -0.85, // D/year
          okLens: -0.35, // D/year
          defocusLens: -0.45, // D/year
          atropine: -0.40, // D/year
        },
        timestamp: new Date().toISOString(),
      },
    });
  }),

  // 8) 视光中心订单跟踪
  
];

// ============= [G005-P1] 眼料在用孤儿 (IOL 库存 CRUD + 接触镜 CRUD + OK 镜设计) =============
// 补齐 materialsApi 前端调用但 handler 缺失的端点 (iolApi 8 + contactLensApi 7 + okLensDesign)

const MOCK_IOL_ITEMS = [
  { id: 'iol-001', barcode: 'ALC-20240001', model: 'SA60AT', type: 'monofocal', power: 22.0, batchNumber: 'B-2024-01', expiryDate: '2028-12-31', stockLocation: 'A-01', status: 'in_stock', supplier: 'Alcon', unitPrice: 980, createdAt: '2026-01-10T08:00:00.000Z', quantity: 12 },
  { id: 'iol-002', barcode: 'ALC-20240002', model: 'SA60AT', type: 'monofocal', power: 22.5, batchNumber: 'B-2024-01', expiryDate: '2028-12-31', stockLocation: 'A-01', status: 'in_stock', supplier: 'Alcon', unitPrice: 980, createdAt: '2026-01-10T08:00:00.000Z', quantity: 8 },
  { id: 'iol-003', barcode: 'ALC-20240003', model: 'PanOptix TFNT00', type: 'multifocal', power: 23.5, batchNumber: 'B-2025-02', expiryDate: '2028-09-30', stockLocation: 'A-03', status: 'in_stock', supplier: 'Alcon', unitPrice: 2680, createdAt: '2026-02-14T09:00:00.000Z', quantity: 3 },
  { id: 'iol-004', barcode: 'ZE-20240004', model: 'CT ASPHINA 509M', type: 'monofocal', power: 21.5, batchNumber: 'B-2024-03', expiryDate: '2029-06-30', stockLocation: 'B-02', status: 'reserved', supplier: 'Zeiss', unitPrice: 1350, createdAt: '2026-03-01T10:00:00.000Z', quantity: 1 },
  { id: 'iol-005', barcode: 'ALC-20240005', model: 'AcrySof IQ Toric SN6AT6', type: 'toric', power: 20.0, cylinder: 1.5, batchNumber: 'B-2024-04', expiryDate: '2028-06-30', stockLocation: 'A-02', status: 'in_stock', supplier: 'Alcon', unitPrice: 3200, createdAt: '2026-03-20T11:00:00.000Z', quantity: 5 },
  { id: 'iol-006', barcode: 'JNJ-20240006', model: 'TECNIS Symfony ZXR00', type: 'edof', power: 24.0, batchNumber: 'B-2023-05', expiryDate: '2026-08-15', stockLocation: 'C-01', status: 'in_stock', supplier: 'Johnson', unitPrice: 2980, createdAt: '2026-04-01T09:30:00.000Z', quantity: 2 },
  { id: 'iol-007', barcode: 'BOL-20240007', model: 'enVista MX60', type: 'monofocal', power: 19.5, batchNumber: 'B-2022-06', expiryDate: '2026-07-20', stockLocation: 'C-02', status: 'in_stock', supplier: 'Bausch', unitPrice: 890, createdAt: '2026-04-10T14:00:00.000Z', quantity: 6 },
  { id: 'iol-008', barcode: 'HH-20240010', model: 'Akreos AO60', type: 'monofocal', power: 22.5, batchNumber: 'B-2024-07', expiryDate: '2028-03-31', stockLocation: 'B-01', status: 'expired', supplier: 'Haohai', unitPrice: 760, createdAt: '2025-06-01T08:00:00.000Z', quantity: 4 },
];

const MOCK_CONTACT_LENSES = [
  { id: 'cl-001', brand: 'Bausch + Lomb', type: 'RGP', series: 'Boston XO', bc: 7.8, dia: 9.6, power: -3.0, stock: 10, trialLens: true, unitPrice: 680, supplier: 'Bausch' },
  { id: 'cl-002', brand: 'Johnson & Johnson', type: 'Soft', series: 'Acuvue Oasys', bc: 8.4, dia: 14.2, power: -2.5, cylinder: -0.75, axis: 180, stock: 24, trialLens: false, unitPrice: 120, supplier: 'Johnson' },
  { id: 'cl-003', brand: 'Alcon', type: 'OK', series: 'CRT', bc: 8.0, dia: 10.6, power: -3.5, stock: 8, trialLens: true, unitPrice: 3200, supplier: 'Alcon' },
  { id: 'cl-004', brand: 'Alcon', type: 'Scleral', series: 'PROSE', bc: 7.5, dia: 17.0, power: -1.0, stock: 3, trialLens: true, unitPrice: 5800, supplier: 'Alcon' },
  { id: 'cl-005', brand: 'Bausch + Lomb', type: 'Hybrid', series: 'UltraHealth', bc: 8.2, dia: 14.6, power: -4.0, stock: 6, trialLens: false, unitPrice: 450, supplier: 'Bausch' },
];

const eyeMaterialsModule = [
  // IOL 库存: 低库存 / 即将过期 (静态路径必须在 /:id 之前)
  http.get(`${API_BASE}/iol/inventory/low-stock`, async ({ request }) => {
    await delay(40);
    const url = new URL(request.url);
    const threshold = Number(url.searchParams.get('threshold') ?? 5);
    const data = MOCK_IOL_ITEMS.filter((i: any) => i.quantity < threshold);
    return HttpResponse.json({ success: true, data, meta: { total: data.length } });
  }),
  http.get(`${API_BASE}/iol/inventory/expiring`, async ({ request }) => {
    await delay(40);
    const url = new URL(request.url);
    const days = Number(url.searchParams.get('days') ?? 90);
    const limit = Date.now() + days * 86400000;
    const data = MOCK_IOL_ITEMS.filter((i: any) => {
      const t = new Date(i.expiryDate).getTime();
      return t <= limit && t >= Date.now();
    });
    return HttpResponse.json({ success: true, data, meta: { total: data.length } });
  }),
  // IOL 库存: 列表 / 单条 / 入库
  http.get(`${API_BASE}/iol/inventory`, async ({ request }) => {
    await delay(40);
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    const supplier = url.searchParams.get('supplier');
    let data = MOCK_IOL_ITEMS;
    if (type) data = data.filter((i: any) => i.type === type);
    if (status) data = data.filter((i: any) => i.status === status);
    if (supplier) data = data.filter((i: any) => i.supplier === supplier);
    return HttpResponse.json({ success: true, data, meta: { total: data.length } });
  }),
  http.get(`${API_BASE}/iol/inventory/:id`, async ({ params }) => {
    await delay(40);
    const item = MOCK_IOL_ITEMS.find((i: any) => i.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.post(`${API_BASE}/iol/inventory`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const item = { id: `iol-${Date.now()}`, status: 'in_stock', quantity: 1, createdAt: new Date().toISOString(), ...body };
    MOCK_IOL_ITEMS.unshift(item);
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
  // IOL 库存: 出库 / 调拨 / 调整
  http.post(`${API_BASE}/iol/inventory/:id/out`, async ({ params, request }) => {
    await delay(60);
    const item = MOCK_IOL_ITEMS.find((i: any) => i.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    const body = (await request.json()) as any;
    item.status = 'implanted';
    item.quantity = Math.max(0, item.quantity - 1);
    return HttpResponse.json({ success: true, data: { ...item, outReason: body.reason ?? '', outAt: new Date().toISOString() } });
  }),
  http.post(`${API_BASE}/iol/inventory/:id/transfer`, async ({ params, request }) => {
    await delay(60);
    const item = MOCK_IOL_ITEMS.find((i: any) => i.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    const body = (await request.json()) as any;
    item.stockLocation = body.toLocation ?? item.stockLocation;
    return HttpResponse.json({ success: true, data: item });
  }),
  http.post(`${API_BASE}/iol/inventory/:id/adjust`, async ({ params, request }) => {
    await delay(60);
    const item = MOCK_IOL_ITEMS.find((i: any) => i.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    const body = (await request.json()) as any;
    item.quantity = Math.max(0, item.quantity + (Number(body.deltaQty) || 0));
    return HttpResponse.json({ success: true, data: item });
  }),

  // 接触镜库: 列表 / 单条 / 新增 / 更新 / 删除
  http.get(`${API_BASE}/contact-lens/inventory`, async ({ request }) => {
    await delay(40);
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const brand = url.searchParams.get('brand');
    let data = MOCK_CONTACT_LENSES;
    if (type) data = data.filter((l: any) => l.type === type);
    if (brand) data = data.filter((l: any) => l.brand.toLowerCase().includes(brand.toLowerCase()));
    return HttpResponse.json({ success: true, data, meta: { total: data.length } });
  }),
  http.get(`${API_BASE}/contact-lens/inventory/:id`, async ({ params }) => {
    await delay(40);
    const item = MOCK_CONTACT_LENSES.find((l: any) => l.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.post(`${API_BASE}/contact-lens/inventory`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    const item = { id: `cl-${Date.now()}`, trialLens: false, ...body };
    MOCK_CONTACT_LENSES.unshift(item);
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
  http.put(`${API_BASE}/contact-lens/inventory/:id`, async ({ params, request }) => {
    await delay(60);
    const item = MOCK_CONTACT_LENSES.find((l: any) => l.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    const body = (await request.json()) as any;
    Object.assign(item, body);
    return HttpResponse.json({ success: true, data: item });
  }),
  http.delete(`${API_BASE}/contact-lens/inventory/:id`, async ({ params }) => {
    await delay(50);
    const idx = MOCK_CONTACT_LENSES.findIndex((l: any) => l.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    MOCK_CONTACT_LENSES.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  // 接触镜: 试戴记录
  http.post(`${API_BASE}/contact-lens/fitting`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as any;
    return HttpResponse.json({
      success: true,
      data: { fittingId: `FIT${Date.now()}`, patientId: body.patientId, result: 'fitting_recorded', trial: body.fittingData?.trial ?? true },
    });
  }),

  // OK 镜/角膜塑形镜: 设计 (前端调用 /optometry/ok-lens/design)
  http.post(`${API_BASE}/optometry/ok-lens/design`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as { patientId: string; k1: number; k2: number; kAxis: number; targetReduction: number; brand?: string };
    const flatK = (Number(body.k1) + Number(body.k2)) / 2;
    const baseCurve = Math.round((flatK - 0.5) * 100) / 100;
    return HttpResponse.json({
      success: true,
      data: {
        designId: `OK${Date.now()}`,
        baseCurve,
        returnZone: Math.round((baseCurve - 1.6) * 100) / 100,
        diameter: 10.6,
        brand: body.brand ?? 'CRT',
        targetReduction: body.targetReduction,
        patientId: body.patientId,
      },
    });
  }),
];

// [W3-2] 视力检查 / 眼压测量 记录端点 (VisionExamPage / IntraocularPressurePage)
// 内存数据源: 首次访问从 MOCK 数据播种, 之后可 CRUD
let visionRecordSeed: any[] | null = null;
let iopRecordSeed: any[] | null = null;

function getVisionSeed(): any[] {
  if (!visionRecordSeed) {
    visionRecordSeed = [
      { id: 'VR-001', patientId: 'p-1001', patientName: '李明', odUcva: 0.6, odBcva: 1.0, odPhva: 0.8, osUcva: 0.5, osBcva: 0.8, osPhva: 0.7, notation: 'decimal', distance: 'far', examiner: '张明远', createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
      { id: 'VR-002', patientId: 'p-1001', patientName: '李明', odUcva: 0.8, odBcva: 1.0, odPhva: 1.0, osUcva: 0.6, osBcva: 0.9, osPhva: 0.8, notation: 'decimal', distance: 'far', examiner: '张明远', createdAt: new Date(Date.now() - 86400000 * 30).toISOString() },
      { id: 'VR-003', patientId: 'p-1003', patientName: '赵刚', odUcva: 0.3, odBcva: 0.7, odPhva: 0.7, osUcva: 0.4, osBcva: 0.8, osPhva: 0.8, notation: 'decimal', distance: 'far', examiner: '赵静', createdAt: new Date(Date.now() - 86400000 * 7).toISOString() },
    ];
  }
  return visionRecordSeed;
}

function getIopSeed(): any[] {
  if (!iopRecordSeed) {
    iopRecordSeed = [
      { id: 'IOP-001', patientId: 'p-1001', patientName: '李明', od: 18, os: 19, device: 'nct', timestamp: new Date(Date.now() - 86400000).toISOString() },
      { id: 'IOP-002', patientId: 'p-1001', patientName: '李明', od: 17, os: 20, device: 'goldmann', timestamp: new Date(Date.now() - 86400000 * 30).toISOString() },
      { id: 'IOP-003', patientId: 'p-1002', patientName: '王芳', od: 22, os: 24, device: 'nct', timestamp: new Date(Date.now() - 86400000 * 7).toISOString() },
      { id: 'IOP-004', patientId: 'p-1002', patientName: '王芳', od: 21, os: 22, device: 'goldmann', timestamp: new Date(Date.now() - 86400000 * 7 + 3600000 * 10).toISOString() },
      { id: 'IOP-005', patientId: 'p-1002', patientName: '王芳', od: 24, os: 26, device: 'goldmann', timestamp: new Date(Date.now() - 86400000 * 7 + 3600000 * 14).toISOString() },
      { id: 'IOP-006', patientId: 'p-1002', patientName: '王芳', od: 16, os: 17, device: 'nct', timestamp: new Date(Date.now() - 86400000 * 7 + 3600000 * 18).toISOString() },
    ];
  }
  return iopRecordSeed;
}

const eyeW3RisModule = [
  // 视力检查记录
  http.get(`${API_BASE}/ris/vision-records`, async ({ request }) => {
    await delay(60);
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');
    let data = [...getVisionSeed()];
    if (patientId) data = data.filter((v: any) => v.patientId === patientId);
    data.sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return HttpResponse.json({ success: true, data, meta: { total: data.length } });
  }),
  http.post(`${API_BASE}/ris/vision-records`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as any;
    const item = {
      id: body.id || `VR-${Date.now()}`,
      patientId: body.patientId || 'p-1001',
      patientName: body.patientName || '李明',
      odUcva: body.odUcva ?? 0,
      odBcva: body.odBcva ?? 0,
      odPhva: body.odPhva ?? 0,
      osUcva: body.osUcva ?? 0,
      osBcva: body.osBcva ?? 0,
      osPhva: body.osPhva ?? 0,
      notation: body.notation || 'decimal',
      distance: body.distance || 'far',
      examiner: body.examiner || '当前医生',
      createdAt: new Date().toISOString(),
    };
    getVisionSeed().unshift(item);
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),

  // 眼压测量记录
  http.get(`${API_BASE}/ris/iop-records`, async ({ request }) => {
    await delay(60);
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId');
    let data = [...getIopSeed()];
    if (patientId) data = data.filter((r: any) => r.patientId === patientId);
    data.sort((a: any, b: any) => String(b.timestamp).localeCompare(String(a.timestamp)));
    return HttpResponse.json({ success: true, data, meta: { total: data.length } });
  }),
  http.post(`${API_BASE}/ris/iop-records`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as any;
    const item = {
      id: body.id || `IOP-${Date.now()}`,
      patientId: body.patientId || 'p-1001',
      patientName: body.patientName || '李明',
      od: Number(body.od) || 0,
      os: Number(body.os) || 0,
      device: body.device || 'nct',
      timestamp: new Date().toISOString(),
    };
    getIopSeed().unshift(item);
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
  http.delete(`${API_BASE}/ris/iop-records/:id`, async ({ params }) => {
    await delay(50);
    const idx = getIopSeed().findIndex((r: any) => r.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    getIopSeed().splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  // [G005 W1-A] 视力记录删除 (deleteVisionRecord 在用, 与 iop-records/:id 对齐)
  http.delete(`${API_BASE}/ris/vision-records/:id`, async ({ params }) => {
    await delay(50);
    const idx = getVisionSeed().findIndex((v: any) => v.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    getVisionSeed().splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // [G005 W1-A] 危急值 (FfaViewerPage / CriticalValueAlert 在用)
  http.get(`${API_BASE}/pacs/critical-values`, async () => {
    await delay(60);
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'CV-001', studyId: 'es-004', patientName: '张伟', severity: 'emergent', category: 'FFA', finding: '黄斑区活动性 CNV 渗漏', status: 'open', createdAt: new Date(Date.now() - 3600000).toISOString() },
        { id: 'CV-002', studyId: 'es-001', patientName: '李慧敏', severity: 'urgent', category: 'IOP', finding: '右眼眼压 28mmHg 高于正常', status: 'acknowledged', createdAt: new Date(Date.now() - 86400000).toISOString() },
        { id: 'CV-003', studyId: 'es-003', patientName: '刘敏', severity: 'urgent', category: 'VisualField', finding: '视野 MD -14.2dB 重度缺损', status: 'open', createdAt: new Date().toISOString() },
      ],
    });
  }),

  // [G005 W1-A] 视野检查 (VisualFieldPage 在用)
  http.get(`${API_BASE}/pacs/visual-fields`, async () => {
    await delay(60);
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'VF-001', studyId: 'es-003', md: -14.2, psd: 11.6, vfi: 62, fovealThreshold: 26, meanSensitivity: 12.4, fixationLosses: 8, falsePositives: 2, falseNegatives: 5, ght: 'out-of-normal-limits', reliability: 'good', defectDepth: 12.5 },
        { id: 'VF-002', studyId: 'es-028', md: -3.1, psd: 2.4, vfi: 92, fovealThreshold: 33, meanSensitivity: 26.8, fixationLosses: 3, falsePositives: 1, falseNegatives: 2, ght: 'within-normal-limits', reliability: 'excellent', defectDepth: 0 },
      ],
    });
  }),
];

// [G005 W3-A] 后端真实路径对齐模块 (eyeApi 已改调 /eye/studies、/eye/emr/:patientId、/eye/reports、/eye/iol/lenses)
const eyeW3aAlignedModule = [
  // /eye/studies (原 /eye/pacs/studies, 后端 @Get('studies'))
  http.get(`${API_BASE}/studies`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_studies');
    const result = applyQuery(all, opts, ['patientName', 'studyId', 'modality']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // /eye/studies/:id (原 /eye/pacs/studies/:id, 后端 @Get('studies/:id'))
  http.get(`${API_BASE}/studies/:id`, async ({ params }) => {
    await delay(50);
    const s = get<any>('eye_studies', params.id as string);
    if (!s) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: s });
  }),
  // [v3.0.6.11-88 P0] /eye/studies CRUD (后端 eye.controller: POST/PUT/DELETE)
  http.post(`${API_BASE}/studies`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as any;
    const id = body.studyId || body.id || `STU${Date.now()}`;
    const newItem = {
      ...body,
      id,
      studyId: id,
      status: body.status || 'acquired',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    create('eye_studies', newItem);
    auditCreate('eye_studies', newItem);
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.put(`${API_BASE}/studies/:id`, async ({ params, request }) => {
    await delay(80);
    const id = params.id as string;
    const body = (await request.json()) as any;
    const before = get<any>('eye_studies', id);
    const updated = update<any>('eye_studies', id, { ...body, updatedAt: new Date().toISOString() });
    if (!updated) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    auditUpdate('eye_studies', before, updated);
    return HttpResponse.json({ success: true, data: updated });
  }),
  http.delete(`${API_BASE}/studies/:id`, async ({ params }) => {
    await delay(60);
    const ok = remove('eye_studies', params.id as string);
    if (!ok) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: { id: params.id } });
  }),
  // [v3.0.6.11-88 P0] GET /eye/patients/:patientId/studies (后端 @Get('patients/:patientId/studies'))
  http.get(`${API_BASE}/patients/:patientId/studies`, async ({ params }) => {
    await delay(60);
    const all = list<any>('eye_studies').filter((s: any) => s.patientId === params.patientId);
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),
  // /eye/emr/:patientId (原 /eye/emr/records/:id, 后端 @Get('emr/:patientId'))
  http.get(`${API_BASE}/emr/:patientId`, async ({ params }) => {
    await delay(40);
    const e = get<any>('eye_emrs', params.patientId as string) ?? list<any>('eye_emrs').find((x: any) => x.patientId === params.patientId);
    if (!e) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: e });
  }),
  // PUT /eye/emr/:patientId (原 /eye/emr/records/:id, 后端 @Put('emr/:patientId'))
  http.put(`${API_BASE}/emr/:patientId`, async ({ params, request }) => {
    await delay(60);
    const id = params.patientId as string;
    const body = (await request.json()) as any;
    const before = get<any>('eye_emrs', id);
    const updated = update<any>('eye_emrs', id, { ...body, updatedAt: new Date().toISOString() });
    if (updated) auditUpdate('eye_emrs', before, updated);
    return HttpResponse.json({ success: true, data: updated });
  }),
  // GET /eye/reports (原 /eye/report/reports, 后端 @Get('reports'))
  http.get(`${API_BASE}/reports`, async ({ request }) => {
    await delay(60);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<any>('eye_reports');
    const result = applyQuery(all, opts, ['patientName', 'reportType']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // [v3.0.6.11-88 P0] POST /eye/reports (后端 generateReport: { studyId, template? } → { message, data })
  http.post(`${API_BASE}/reports`, async ({ request }) => {
    await delay(100);
    const body = (await request.json().catch(() => ({}))) as any;
    return HttpResponse.json({ success: true, data: { message: 'Report generated', data: body } }, { status: 201 });
  }),
  // GET /eye/iol/lenses (后端 @Get('iol/lenses'), ULIB 常数派生镜头库)
  http.get(`${API_BASE}/iol/lenses`, async () => {
    await delay(40);
    const lenses = Object.entries(PR3_IOL_CONSTANTS).map(([model, byFormula], i) => ({
      id: `IOL-${String(i + 1).padStart(3, '0')}`,
      model,
      manufacturer: ['Alcon', 'Johnson & Johnson', 'Zeiss', 'Bausch + Lomb'][i % 4],
      type: model.includes('Toric') ? 'toric' : model.includes('TFNT') ? 'multifocal' : 'monofocal',
      aConst: byFormula['SRK-T']?.aConst ?? 118.7,
      pACD: byFormula['SRK-T']?.pACD ?? 5.2,
      sf: byFormula['Barrett-true-K']?.sf ?? 1.6,
      powerRange: { min: 5.0, max: 30.0, step: 0.5 },
      status: 'active',
    }));
    return HttpResponse.json({ success: true, data: lenses, meta: { total: lenses.length, source: 'ULIB 2024' } });
  }),
];

// 汇总所有端点
export const eyeHandlers = [
  ...eyeRisModule,
  ...eyePacsModule,
  ...eyeEmrModule,
  ...eyeAiModule,
  ...eyeReportModule,
  ...eyeKpiModule,
  ...eyeSubspecialtyModule,
  ...eyePatientJourneyModule,
  ...eyeRbacModule,
  ...eyePacsRenderModule, // [v3.0.6.8-34] PR 1
  ...eyeReportAiModule, // [v3.0.6.8-35] PR 2
  ...eyeIolModule, // [v3.0.6.8-36] PR 3
  ...eyeSubspecialtyDepthModule, // [v3.0.6.8-37] PR 4
  ...eyeAiExtendedModule, // [v3.0.6.8-38] PR 5
  ...eyeQcAiModule, // [v3.0.6.8-39] PR 6
  ...eyeFusionModule, // [v3.0.6.8-40] PR 7
  ...eyeTeleconsultModule, // [v3.0.6.8-41] PR 8
  ...eyeCaseLibraryModule, // [v3.0.6.8-42] PR 9
  ...eyePixelRenderModule, // [v3.0.6.8-43] PR 10
  ...eyeOptometryClosedLoopModule, // [v3.0.6.8-44] PR 11
  ...eyeMaterialsModule, // [G005-P1] 眼料在用孤儿 (IOL 库存 + 接触镜 CRUD + OK 镜设计)
  ...eyeW3RisModule, // [W3-2] 视力/眼压记录 (VisionExamPage / IntraocularPressurePage)
  ...eyeW3aAlignedModule, // [G005 W3-A] 后端真实路径对齐
];
