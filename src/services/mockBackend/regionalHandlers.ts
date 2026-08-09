// [v3.0.6.11-7] /api/v1/regional MSW handlers
// [G005-P1] 补齐医联体影像页/报告页在用孤儿端点 (applications/consultations/access-records/
//           institutions/cross-query/document-registry/pix/audit-trail/report-records/
//           critical-values/remote-diagnoses/co-sign-records/institutions)
import { http, HttpResponse, delay } from 'msw';
import { parseQuery, applyQuery } from './queryBuilder';

const API = '/api/v1/regional';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

// ── [G005-P1] seed 数据 (与后端 regional.service.ts 对齐) ──

const SEED_APPLICATIONS = [
  { id: 'APP-202607-001', patientName: '张伟', patientId: 'P000023', hospital: '东华区第一医院', modality: 'CT', studyDate: '2026-07-06', reason: '肺癌术后复查,申请调阅外院基线片', status: 'pending', applyDate: '2026-07-08' },
  { id: 'APP-202607-002', patientName: '王芳', patientId: 'P000047', hospital: '西城区人民医院', modality: 'MRI', studyDate: '2026-07-05', reason: '腰椎间盘突出会诊', status: 'approved', applyDate: '2026-07-07' },
  { id: 'APP-202607-003', patientName: '李强', patientId: 'P000088', hospital: '高新区中心医院', modality: 'DR', studyDate: '2026-07-04', reason: '体检发现肺结节,调阅历史胸片', status: 'rejected', applyDate: '2026-07-06' },
  { id: 'APP-202607-004', patientName: '刘敏', patientId: 'P000112', hospital: '东华区第一医院', modality: 'US', studyDate: '2026-07-03', reason: '甲状腺结节随访', status: 'pending', applyDate: '2026-07-05' },
];

const SEED_CONSULTATIONS = [
  { id: 'CSL-202607-001', patientName: '赵霞', hospital: '东华区第一医院', diagnosis: '颅内占位性质待定', priority: 'urgent', status: 'in-progress', createDate: '2026-07-08', expert: '王建华 主任医师' },
  { id: 'CSL-202607-002', patientName: '孙浩', hospital: '西城区人民医院', diagnosis: '胰腺占位', priority: 'critical', status: 'open', createDate: '2026-07-08' },
  { id: 'CSL-202607-003', patientName: '周婷', hospital: '高新区中心医院', diagnosis: '肺结节随访策略咨询', priority: 'normal', status: 'completed', createDate: '2026-07-06', expert: '张明远 主任医师' },
];

const SEED_ACCESS_RECORDS = [
  { id: 'ARC-001', patientName: '张伟', patientId: 'P000023', studyType: 'CT 胸部平扫', hospital: '东华区第一医院', accessTime: '2026-07-08 09:32', accessor: '王建华', purpose: '跨院调阅基线对比' },
  { id: 'ARC-002', patientName: '王芳', patientId: 'P000047', studyType: 'MRI 腰椎', hospital: '西城区人民医院', accessTime: '2026-07-08 10:15', accessor: '李慧敏', purpose: '远程会诊' },
  { id: 'ARC-003', patientName: '刘敏', patientId: 'P000112', studyType: 'US 甲状腺', hospital: '东华区第一医院', accessTime: '2026-07-07 14:03', accessor: '张明远', purpose: '随访对比' },
];

const SEED_INSTITUTIONS = [
  { id: 'INST-001', name: '东华区第一医院', aeTitle: 'G005-DH01', address: '东华区解放路 88 号', status: 'online' },
  { id: 'INST-002', name: '西城区人民医院', aeTitle: 'G005-XC01', address: '西城区人民大道 210 号', status: 'online' },
  { id: 'INST-003', name: '高新区中心医院', aeTitle: 'G005-GX01', address: '高新区科园路 66 号', status: 'busy' },
  { id: 'INST-004', name: '南港区第二医院', aeTitle: 'G005-NG01', address: '南港区港城路 12 号', status: 'offline' },
];

const SEED_CROSS_STUDIES = [
  { id: 'CS-001', patientId: 'P000023', patientName: '张伟', studyUid: '1.2.826.0.1.3680043.8.498.1001', studyDescription: 'CT 胸部平扫', modality: 'CT', institution: '东华区第一医院', date: '2025-03-12', status: 'COMPLETE' },
  { id: 'CS-002', patientId: 'P000023', patientName: '张伟', studyUid: '1.2.826.0.1.3680043.8.498.1002', studyDescription: 'CT 胸部增强', modality: 'CT', institution: '西城区人民医院', date: '2026-06-28', status: 'COMPLETE' },
  { id: 'CS-003', patientId: 'P000047', patientName: '王芳', studyUid: '1.2.826.0.1.3680043.8.498.1003', studyDescription: 'MRI 腰椎平扫', modality: 'MRI', institution: '西城区人民医院', date: '2026-05-20', status: 'COMPLETE' },
];

const SEED_DOCUMENT_REGISTRY = [
  { id: 'DOC-001', patientId: 'P000023', patientName: '张伟', studyUid: '1.2.826.0.1.3680043.8.498.1001', studyDescription: 'CT 胸部平扫', modality: 'CT', institution: '东华区第一医院', date: '2025-03-12', status: 'REGISTERED' },
  { id: 'DOC-002', patientId: 'P000047', patientName: '王芳', studyUid: '1.2.826.0.1.3680043.8.498.1003', studyDescription: 'MRI 腰椎平扫', modality: 'MRI', institution: '西城区人民医院', date: '2026-05-20', status: 'REGISTERED' },
  { id: 'DOC-003', patientId: 'P000156', patientName: '陈杰', studyUid: '1.2.826.0.1.3680043.8.498.1005', studyDescription: 'CT 腹部增强', modality: 'CT', institution: '南港区第二医院', date: '2026-07-02', status: 'SYNCED' },
];

const SEED_AUDIT_TRAIL = [
  { id: 'AUD-001', patientId: 'P000023', action: 'CROSS_QUERY', institution: '东华区第一医院', user: '王建华', time: '2026-07-08 09:32:11', details: '跨院检索: 患者 张伟' },
  { id: 'AUD-002', patientId: 'P000047', action: 'PIX_QUERY', institution: '西城区人民医院', user: '李慧敏', time: '2026-07-08 10:15:42', details: 'PIX 患者标识映射' },
  { id: 'AUD-003', patientId: 'P000112', action: 'DOCUMENT_RETRIEVE', institution: '东华区第一医院', user: '张明远', time: '2026-07-07 14:03:55', details: '调阅文档: DOC-001' },
];

const SEED_REPORT_CONSULTATIONS = [
  { id: 'RC-202607-001', caseId: 'CASE-20260701', patientName: '赵霞', gender: '女', age: 56, institution: '东华区第一医院', modality: 'MRI', examItem: '头颅 MRI 增强', applyReason: '颅内占位性质待定', status: '会诊中', applyTime: '2026-07-08 08:30', acceptTime: '2026-07-08 09:10', applyDoctor: '刘敏', acceptDoctor: '王建华', priority: '紧急' },
  { id: 'RC-202607-002', caseId: 'CASE-20260702', patientName: '孙浩', gender: '男', age: 61, institution: '西城区人民医院', modality: 'CT', examItem: '腹部增强 CT', applyReason: '胰腺占位,申请多学科会诊', status: '待接诊', applyTime: '2026-07-08 09:45', applyDoctor: '陈杰', priority: '立即' },
  { id: 'RC-202607-003', caseId: 'CASE-20260703', patientName: '周婷', gender: '女', age: 43, institution: '高新区中心医院', modality: 'CT', examItem: '胸部 HRCT', applyReason: '肺结节随访策略', status: '已完成', applyTime: '2026-07-06 14:20', acceptTime: '2026-07-06 15:00', completeTime: '2026-07-07 10:30', applyDoctor: '吴刚', acceptDoctor: '张明远', consultationOpinion: '建议 6 个月后复查', priority: '普通' },
];

const SEED_REPORT_RECORDS = [
  { id: 'RR-001', reportId: 'RP20260708001', institution: '东华区第一医院', patientName: '张伟', gender: '男', age: 58, modality: 'CT', examItem: '胸部平扫', reportTime: '2026-07-08 09:20', reportDoctor: '刘敏', status: '待审核', qualityScore: 92, qualityIssues: [] },
  { id: 'RR-002', reportId: 'RP20260707005', institution: '西城区人民医院', patientName: '王芳', gender: '女', age: 45, modality: 'MRI', examItem: '腰椎平扫', reportTime: '2026-07-07 15:40', reportDoctor: '陈杰', status: '已通过', qualityScore: 96, qualityIssues: [], reviewOpinion: '诊断明确', reviewDoctor: '王建华', reviewTime: '2026-07-07 17:02' },
  { id: 'RR-003', reportId: 'RP20260706002', institution: '高新区中心医院', patientName: '李强', gender: '男', age: 52, modality: 'DR', examItem: '胸部正位', reportTime: '2026-07-06 10:12', reportDoctor: '孙浩', status: '有问题', qualityScore: 71, qualityIssues: ['影像位置描述不全'], reviewOpinion: '请补充描述', reviewDoctor: '李慧敏', reviewTime: '2026-07-06 11:30' },
];

const SEED_CRITICAL_VALUES = [
  { id: 'CV-001', patientName: '孙浩', gender: '男', age: 61, institution: '西城区人民医院', modality: 'CT', examItem: '腹部增强 CT', criticalFinding: '胰头区 4.2×3.5cm 肿块,考虑恶性占位', severity: '危急', reportedTime: '2026-07-08 09:50', reportedDoctor: '陈杰', status: '待确认' },
  { id: 'CV-002', patientName: '赵霞', gender: '女', age: 56, institution: '东华区第一医院', modality: 'MRI', examItem: '头颅 MRI 增强', criticalFinding: '右侧基底节区急性脑出血灶', severity: '危急', reportedTime: '2026-07-08 08:35', reportedDoctor: '刘敏', status: '已接收', receiveTime: '2026-07-08 08:47', receiveDoctor: '值班医生' },
  { id: 'CV-003', patientName: '周婷', gender: '女', age: 43, institution: '高新区中心医院', modality: 'CT', examItem: '胸部 HRCT', criticalFinding: '双肺弥漫性磨玻璃影', severity: '高危', reportedTime: '2026-07-06 15:10', reportedDoctor: '吴刚', status: '处理中', receiveTime: '2026-07-06 15:22', receiveDoctor: '呼吸科会诊' },
];

const SEED_REMOTE_DIAGNOSES = [
  { id: 'RD-001', caseId: 'CASE-20260701', patientName: '赵霞', gender: '女', age: 56, examType: '头颅 MRI', applyInstitution: '东华区第一医院', remoteExpert: '王建华', expertInstitution: '市中心医院', status: '书写中', applyTime: '2026-07-08 08:30', startTime: '2026-07-08 09:10' },
  { id: 'RD-002', caseId: 'CASE-20260702', patientName: '孙浩', gender: '男', age: 61, examType: '腹部增强 CT', applyInstitution: '西城区人民医院', remoteExpert: '张明远', expertInstitution: '市肿瘤医院', status: '待书写', applyTime: '2026-07-08 09:45' },
  { id: 'RD-003', caseId: 'CASE-20260703', patientName: '周婷', gender: '女', age: 43, examType: '胸部 HRCT', applyInstitution: '高新区中心医院', remoteExpert: '李慧敏', expertInstitution: '市中心医院', status: '已完成', applyTime: '2026-07-06 14:20', startTime: '2026-07-06 15:00', completeTime: '2026-07-07 09:30', reportContent: '双肺多发磨玻璃影,建议 6 个月复查。' },
];

const SEED_CO_SIGN_RECORDS = [
  {
    id: 'CSG-001', reportId: 'RP20260701001', examType: 'CT 腹部增强', patientName: '陈杰', gender: '男', age: 66,
    participatingInstitutions: ['东华区第一医院', '南港区第二医院'], status: '签发中', createTime: '2026-07-01 10:00', completeTime: '2026-07-02 15:30',
    signatures: [
      { institution: '东华区第一医院', doctorName: '张明远', signTime: '2026-07-01 10:20', certificateStatus: '有效', order: 1 },
      { institution: '南港区第二医院', doctorName: '赵雪琴', signTime: '2026-07-02 15:30', certificateStatus: '有效', order: 2 },
    ],
    versions: [
      { version: 'v1.0', modifyTime: '2026-07-01 10:00', modifyInstitution: '东华区第一医院', modifyReason: '初始版本', modifier: '张明远' },
    ],
  },
  {
    id: 'CSG-002', reportId: 'RP20260705002', examType: 'MRI 头颅增强', patientName: '赵霞', gender: '女', age: 56,
    participatingInstitutions: ['东华区第一医院', '市中心医院'], status: '待签发', createTime: '2026-07-05 09:00',
    signatures: [],
    versions: [{ version: 'v1.0', modifyTime: '2026-07-05 09:00', modifyInstitution: '东华区第一医院', modifyReason: '初始版本', modifier: '刘敏' }],
  },
];

const SEED_REGIONAL_INSTITUTIONS = [
  { id: 'RI-001', institutionId: 'INST-001', institutionName: '东华区第一医院', modality: 'CT', examCount: 1284, positiveCount: 389, positiveRate: 30.3, avgReportTime: 1.8, qualifiedRate: 96.2, period: '2026-06' },
  { id: 'RI-002', institutionId: 'INST-002', institutionName: '西城区人民医院', modality: 'MRI', examCount: 856, positiveCount: 302, positiveRate: 35.3, avgReportTime: 2.4, qualifiedRate: 94.8, period: '2026-06' },
  { id: 'RI-003', institutionId: 'INST-003', institutionName: '高新区中心医院', modality: 'DR', examCount: 1932, positiveCount: 412, positiveRate: 21.3, avgReportTime: 1.2, qualifiedRate: 97.5, period: '2026-06' },
  { id: 'RI-004', institutionId: 'INST-004', institutionName: '南港区第二医院', modality: 'US', examCount: 1021, positiveCount: 356, positiveRate: 34.9, avgReportTime: 1.5, qualifiedRate: 93.1, period: '2026-06' },
];

// [W2-C] 区域影像共享 / 科室排班 / 集成状态 seed (与 backend regional.service DTO 对齐)
const SEED_REGIONAL_IMAGING = [
  { id: 'RI-001', institutionId: 'INST-001', institutionName: '东华区第一医院', modality: 'CT', examCount: 1284, positiveCount: 389, positiveRate: 30.3, avgReportTime: 1.8, qualifiedRate: 96.2, period: '2026-06' },
  { id: 'RI-002', institutionId: 'INST-002', institutionName: '西城区人民医院', modality: 'MRI', examCount: 856, positiveCount: 302, positiveRate: 35.3, avgReportTime: 2.4, qualifiedRate: 94.8, period: '2026-06' },
  { id: 'RI-003', institutionId: 'INST-003', institutionName: '高新区中心医院', modality: 'DR', examCount: 1932, positiveCount: 412, positiveRate: 21.3, avgReportTime: 1.2, qualifiedRate: 97.5, period: '2026-06' },
  { id: 'RI-004', institutionId: 'INST-004', institutionName: '南港区第二医院', modality: 'US', examCount: 1021, positiveCount: 356, positiveRate: 34.9, avgReportTime: 1.5, qualifiedRate: 93.1, period: '2026-06' },
];

const SEED_SCHEDULE = [
  { id: 'SCH-001', departmentId: 'DEPT-001', departmentName: '放射科', date: '2026-07-08', shift: '白班', doctorId: 'DOC-001', doctorName: '王建华', status: '已排班' },
  { id: 'SCH-002', departmentId: 'DEPT-001', departmentName: '放射科', date: '2026-07-08', shift: '夜班', doctorId: 'DOC-002', doctorName: '李慧敏', status: '已排班' },
  { id: 'SCH-003', departmentId: 'DEPT-002', departmentName: 'CT室', date: '2026-07-08', shift: '白班', doctorId: 'DOC-003', doctorName: '张明远', status: '已排班' },
  { id: 'SCH-004', departmentId: 'DEPT-002', departmentName: 'CT室', date: '2026-07-09', shift: '白班', doctorId: 'DOC-004', doctorName: '刘敏', status: '待确认' },
  { id: 'SCH-005', departmentId: 'DEPT-003', departmentName: '超声科', date: '2026-07-08', shift: '白班', doctorId: 'DOC-005', doctorName: '陈杰', status: '已排班' },
];

const SEED_DEPARTMENTS = [
  { id: 'DEPT-001', name: '放射科', level: '一级科室', type: '影像', reportCount: 1284, pendingCount: 12 },
  { id: 'DEPT-002', name: 'CT室', level: '二级科室', type: '影像', reportCount: 856, pendingCount: 8 },
  { id: 'DEPT-003', name: '超声科', level: '一级科室', type: '功能', reportCount: 1021, pendingCount: 5 },
];

const SEED_INTEGRATION_STATUS: Record<string, Record<string, unknown>> = {
  fhir: { status: 'CONNECTED', lastSync: '2026-07-08T10:00:00+08:00' },
  ihe: { status: 'CONNECTED', lastSync: '2026-07-08T09:42:00+08:00' },
  mllp: { status: 'ACTIVE', lastSync: '2026-07-08T10:05:00+08:00', messages24h: 1240 },
};

export const regionalHandlers = [
  http.get(`${API}/imaging`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const result = applyQuery(SEED_REGIONAL_IMAGING as any[], opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/schedule`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const result = applyQuery(SEED_SCHEDULE as any[], opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.put(`${API}/schedule/:id`, async ({ params, request }) => {
    await delay(delayMs(40, 120));
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const idx = SEED_SCHEDULE.findIndex((s) => s.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `排班 ${params.id} 不存在` } }, { status: 404 });
    }
    const updated = { ...SEED_SCHEDULE[idx], ...(body ?? {}) } as { id: string; departmentId: string; departmentName: string; date: string; shift: string; doctorId: string; doctorName: string; status: string };
    SEED_SCHEDULE[idx] = updated;
    return HttpResponse.json({ success: true, data: updated });
  }),
  http.get(`${API}/departments`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const result = applyQuery(SEED_DEPARTMENTS as any[], opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/medical-alliance`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const result = applyQuery([{ id: 'MA001', name: '东华区医联体', level: '区域', type: '紧密型', memberCount: 4, status: 'ACTIVE' }] as any[], opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/integration/:name`, async ({ request, params }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    void url;
    const name = String(params.name);
    const data = SEED_INTEGRATION_STATUS[name] ?? { status: 'UNKNOWN', lastSync: '', error: `未配置 ${name}` };
    return HttpResponse.json({ success: true, data });
  }),

  // ── [G005-P1] 医联体影像页在用孤儿 ──

  http.get(`${API}/imaging/applications`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: SEED_APPLICATIONS });
  }),
  http.post(`${API}/imaging/applications`, async ({ request }) => {
    await delay(delayMs());
    const body = await request.json() as Record<string, unknown>;
    const item = { id: 'APP-' + Date.now(), status: 'pending', applyDate: new Date().toISOString().slice(0, 10), ...body };
    SEED_APPLICATIONS.unshift(item as never);
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
  http.post(`${API}/imaging/applications/:id/approve`, async ({ params }) => {
    await delay(delayMs());
    const item = SEED_APPLICATIONS.find(a => a.id === params.id);
    if (item) item.status = 'approved';
    return HttpResponse.json({ success: true, data: item ?? null });
  }),
  http.post(`${API}/imaging/applications/:id/reject`, async ({ params }) => {
    await delay(delayMs());
    const item = SEED_APPLICATIONS.find(a => a.id === params.id);
    if (item) item.status = 'rejected';
    return HttpResponse.json({ success: true, data: item ?? null });
  }),
  http.get(`${API}/imaging/consultations`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: SEED_CONSULTATIONS });
  }),
  http.post(`${API}/imaging/consultations`, async ({ request }) => {
    await delay(delayMs());
    const body = await request.json() as Record<string, unknown>;
    const item = { id: 'CSL-' + Date.now(), priority: 'normal', status: 'open', createDate: new Date().toISOString().slice(0, 10), ...body };
    SEED_CONSULTATIONS.unshift(item as never);
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
  http.get(`${API}/imaging/access-records`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: SEED_ACCESS_RECORDS });
  }),
  http.get(`${API}/imaging/institutions`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: SEED_INSTITUTIONS });
  }),
  http.get(`${API}/imaging/cross-query`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const queryValue = (url.searchParams.get('queryValue') ?? '').toLowerCase();
    const data = SEED_CROSS_STUDIES.filter(s =>
      !queryValue || s.patientName.toLowerCase().includes(queryValue) || s.patientId.toLowerCase().includes(queryValue) || s.studyDescription.toLowerCase().includes(queryValue),
    );
    return HttpResponse.json({ success: true, data });
  }),
  http.get(`${API}/imaging/document-registry`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: SEED_DOCUMENT_REGISTRY });
  }),
  http.get(`${API}/imaging/pix`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId') ?? '';
    const local = SEED_CROSS_STUDIES.find(s => s.patientId === patientId)?.studyUid ?? patientId;
    return HttpResponse.json({ success: true, data: { local, remote: `PIX-EXT-${patientId.replace(/\D/g, '').slice(0, 6) || '000001'}` } });
  }),
  http.get(`${API}/imaging/audit-trail`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: SEED_AUDIT_TRAIL });
  }),
  // [G005 Wave1A W9] 静态子路由 (applications/consultations/access-records/institutions/
  //   cross-query/document-registry/pix/audit-trail) 必须在此 :id 通配之前注册
  http.get(`${API}/imaging/:id`, async ({ params }) => {
    await delay(delayMs());
    const item = SEED_REGIONAL_IMAGING.find((s) => s.id === params.id);
    if (!item) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `区域影像 ${params.id} 不存在` } }, { status: 404 });
    }
    return HttpResponse.json({ success: true, data: item });
  }),

  // ── [G005-P1] 医联体报告页在用孤儿 ──

  http.get(`${API}/institutions`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: SEED_REGIONAL_INSTITUTIONS });
  }),
  http.get(`${API}/consultations`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: SEED_REPORT_CONSULTATIONS });
  }),
  http.get(`${API}/report-records`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: SEED_REPORT_RECORDS });
  }),
  http.get(`${API}/critical-values`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: SEED_CRITICAL_VALUES });
  }),
  http.get(`${API}/remote-diagnoses`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: SEED_REMOTE_DIAGNOSES });
  }),
  http.get(`${API}/co-sign-records`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: SEED_CO_SIGN_RECORDS });
  }),

  // ── [W3-A] 多站点/多院区仪表板 (regionalApi.listSites / listSiteSyncEvents / listSiteRoutingRules) ──
  // 后端暂未实现 → 本地演示数据 (页面标注"演示数据"来源)

  http.get(`${API}/sites`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        source: 'demo',
        generatedAt: new Date().toISOString(),
        data: SEED_SITES.map((s) => ({ ...s })),
      },
    });
  }),
  http.get(`${API}/sites/sync-events`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        source: 'demo',
        generatedAt: new Date().toISOString(),
        data: SEED_SYNC_EVENTS.map((e) => ({ ...e })),
      },
    });
  }),
  http.get(`${API}/sites/routing-rules`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        source: 'demo',
        generatedAt: new Date().toISOString(),
        data: SEED_ROUTING_RULES.map((r) => ({ ...r })),
      },
    });
  }),
];

// [W3-A] 多站点演示数据 (静态, 来源标注 demo)

const NOW = Date.now();

const SEED_SITES = [
  { id: 'SITE-MAIN', name: '山东省人民医院 (总院)', code: 'SDPH-MAIN', region: '华东', city: '济南', status: 'active', studies: 148523, patients: 89521, users: 842, storage: 48230, bandwidth: 980, lastSync: new Date(NOW - 30000).toISOString(), latencyMs: 12, uptimePct: 99.97, version: 'v3.0.6.8-52', primary: true },
  { id: 'SITE-OPH', name: '山东省立眼科医院', code: 'SDPH-OPH', region: '华东', city: '济南', status: 'active', studies: 64218, patients: 38421, users: 312, storage: 18950, bandwidth: 520, lastSync: new Date(NOW - 60000).toISOString(), latencyMs: 18, uptimePct: 99.92, version: 'v3.0.6.8-52', primary: false },
  { id: 'SITE-PED', name: '山东省妇幼保健院', code: 'SDPH-PED', region: '华东', city: '济南', status: 'active', studies: 38412, patients: 22891, users: 218, storage: 9870, bandwidth: 380, lastSync: new Date(NOW - 45000).toISOString(), latencyMs: 22, uptimePct: 99.85, version: 'v3.0.6.8-52', primary: false },
  { id: 'SITE-QD', name: '青岛大学附属医院', code: 'QDUH-MAIN', region: '华东', city: '青岛', status: 'syncing', studies: 52891, patients: 31224, users: 412, storage: 14420, bandwidth: 450, lastSync: new Date(NOW - 120000).toISOString(), latencyMs: 45, uptimePct: 99.71, version: 'v3.0.6.8-52', primary: false },
  { id: 'SITE-WF', name: '潍坊市人民医院', code: 'WFH-MAIN', region: '华东', city: '潍坊', status: 'active', studies: 41228, patients: 24110, users: 296, storage: 11240, bandwidth: 320, lastSync: new Date(NOW - 90000).toISOString(), latencyMs: 32, uptimePct: 99.78, version: 'v3.0.6.8-52', primary: false },
  { id: 'SITE-JN2', name: '济南市中心医院 (二院区)', code: 'JN2-MAIN', region: '华东', city: '济南', status: 'offline', studies: 28934, patients: 16280, users: 184, storage: 7820, bandwidth: 0, lastSync: new Date(NOW - 1800000).toISOString(), latencyMs: 0, uptimePct: 95.42, version: 'v3.0.6.8-52', primary: false },
  { id: 'SITE-YT', name: '烟台毓璜顶医院', code: 'YTH-MAIN', region: '华东', city: '烟台', status: 'active', studies: 32145, patients: 19420, users: 242, storage: 8930, bandwidth: 280, lastSync: new Date(NOW - 70000).toISOString(), latencyMs: 38, uptimePct: 99.65, version: 'v3.0.6.8-52', primary: false },
  { id: 'SITE-WH', name: '威海市立医院', code: 'WHH-MAIN', region: '华东', city: '威海', status: 'maintenance', studies: 22110, patients: 13280, users: 158, storage: 6010, bandwidth: 0, lastSync: new Date(NOW - 3600000).toISOString(), latencyMs: 0, uptimePct: 97.83, version: 'v3.0.6.8-52', primary: false },
];

const SEED_SYNC_TYPES = ['study_pushed', 'study_pushed', 'study_pulled', 'user_sync', 'config_sync', 'study_pushed', 'study_pulled', 'study_pushed'] as const;
const SEED_SYNC_STATUSES = ['success', 'success', 'success', 'success', 'success', 'success', 'failed', 'success'] as const;

const SEED_SYNC_EVENTS = Array.from({ length: 32 }, (_, i) => {
  const site = SEED_SITES[i % SEED_SITES.length]!;
  const type = SEED_SYNC_TYPES[i % SEED_SYNC_TYPES.length];
  const status = SEED_SYNC_STATUSES[i % SEED_SYNC_STATUSES.length];
  return {
    id: `SYNC-${(1000 + i).toString()}`,
    siteId: site.id,
    type,
    status,
    count: 1 + Math.floor(Math.random() * 50),
    bytes: 1024 * (1 + Math.floor(Math.random() * 5000)),
    duration: 50 + Math.floor(Math.random() * 800),
    timestamp: new Date(NOW - i * 240000).toISOString(),
    message: status === 'failed' ? 'Network timeout after 30s' : undefined,
  };
});

const SEED_ROUTING_RULES = [
  { id: 'RR-001', name: 'CT 影像 → 总院 PACS', sourceSite: 'SITE-OPH', destSite: 'SITE-MAIN', modality: 'CT', condition: 'default', active: true, matchedCount: 8421 },
  { id: 'RR-002', name: 'MR 影像 → 总院 PACS', sourceSite: 'SITE-OPH', destSite: 'SITE-MAIN', modality: 'MR', condition: 'default', active: true, matchedCount: 3421 },
  { id: 'RR-003', name: '急诊 CT → 总院 (优先级)', sourceSite: '*', destSite: 'SITE-MAIN', modality: 'CT', condition: 'priority=STAT', active: true, matchedCount: 248 },
  { id: 'RR-004', name: 'MG 钼靶 → 妇幼', sourceSite: 'SITE-PED', destSite: 'SITE-MAIN', modality: 'MG', condition: 'default', active: true, matchedCount: 1024 },
  { id: 'RR-005', name: 'CR 移动拍片 → 现场', sourceSite: 'SITE-MAIN', destSite: 'SITE-MAIN', modality: 'CR', condition: 'portable=true', active: true, matchedCount: 421 },
  { id: 'RR-006', name: '青岛分院 CT → 总院 PACS', sourceSite: 'SITE-QD', destSite: 'SITE-MAIN', modality: 'CT', condition: 'default', active: true, matchedCount: 5128 },
  { id: 'RR-007', name: '潍坊分院 → 区域影像中心', sourceSite: 'SITE-WF', destSite: 'SITE-MAIN', modality: '*', condition: 'default', active: false, matchedCount: 0 },
];
