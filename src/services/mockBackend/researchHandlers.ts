// [W2-B-3] /api/v1/research MSW handlers
// 对齐后端 research.controller 12 端点 (projects / exam-records / labels / exports /
//   irb / cohorts / export-audit / quality-scores) 与 researchApi DTO 形状。
// 页面: /research (ResearchPage)
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/research';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

let projects: any[] = [
  {
    id: 'PRJ001', code: 'R-2026-001', name: '肺结节AI辅助诊断多中心研究', leader: '张明远',
    startDate: '2026-01-15', status: '进行中', dataCount: 1286, description: '基于胸部CT的肺结节智能诊断模型验证',
    members: ['张明远', '李慧敏', '王建华'],
  },
  {
    id: 'PRJ002', code: 'R-2026-002', name: '冠脉CTA斑块特征与预后研究', leader: '陈静',
    startDate: '2026-03-01', status: '进行中', dataCount: 642, description: '冠脉CTA斑块量化与心血管事件相关性',
    members: ['陈静', '刘洋', '赵敏'],
  },
  {
    id: 'PRJ003', code: 'R-2025-018', name: '乳腺钼靶AI筛查效能评估', leader: '王建华',
    startDate: '2025-06-01', status: '已完成', dataCount: 2100, description: 'AI辅助乳腺钼靶筛查前瞻性队列',
    members: ['王建华', '孙丽'],
  },
];

let labels: any[] = [
  { id: 'LBL001', name: '肺结节', type: '诊断', color: 'var(--color-primary-500)', useCount: 356 },
  { id: 'LBL002', name: '磨玻璃影', type: '特征', color: 'var(--color-success-500)', useCount: 289 },
  { id: 'LBL003', name: '右肺上叶', type: '部位', color: 'var(--color-warning-500)', useCount: 176 },
  { id: 'LBL004', name: '钙化', type: '特征', color: 'var(--color-error-500)', useCount: 122 },
];

const examRecords: any[] = [
  {
    id: 'EXR001', patientId: 'P001', patientName: '张伟', age: 62, gender: '男',
    examType: '胸部CT平扫', examDate: '2026-07-15', diagnosis: '右肺上叶磨玻璃结节',
    result: '阳性', idCard: '3101011964021XXXXX', phone: '13800138001',
    address: '广州市越秀区', modality: 'CT',
  },
  {
    id: 'EXR002', patientId: 'P002', patientName: '李秀英', age: 55, gender: '女',
    examType: '胸部CT平扫', examDate: '2026-07-12', diagnosis: '双肺纹理增粗',
    result: '阴性', idCard: '3101021970021XXXXX', phone: '13800138002',
    address: '广州市天河区', modality: 'CT',
  },
  {
    id: 'EXR003', patientId: 'P003', patientName: '王建国', age: 58, gender: '男',
    examType: '脊柱CT', examDate: '2026-07-10', diagnosis: '腰椎间盘突出',
    result: '阳性', idCard: '3101031968011XXXXX', phone: '13800138003',
    address: '广州市白云区', modality: 'CT',
  },
];

const exports_: any[] = [
  {
    id: 'EXP001', projectId: 'PRJ001', projectName: '肺结节AI辅助诊断多中心研究',
    format: 'CSV', exportTime: '2026-08-01 10:30', recordCount: 1286,
    downloadUrl: '/api/v1/research/exports/EXP001/download', operator: '张明远',
  },
  {
    id: 'EXP002', projectId: 'PRJ002', projectName: '冠脉CTA斑块特征与预后研究',
    format: 'DICOM', exportTime: '2026-07-28 15:20', recordCount: 642,
    downloadUrl: '/api/v1/research/exports/EXP002/download', operator: '陈静',
  },
];

const irbSubmissions: any[] = [
  {
    id: 'IRB001', projectName: '肺结节AI辅助诊断多中心研究', pi: '张明远',
    submittedDate: '2026-01-10', status: 'approved', approvedDate: '2026-01-25',
    expiryDate: '2027-01-24', consentForm: '知情同意书V2.0',
  },
  {
    id: 'IRB002', projectName: '冠脉CTA斑块特征与预后研究', pi: '陈静',
    submittedDate: '2026-02-20', status: 'submitted', approvedDate: '', expiryDate: '', consentForm: '知情同意书V1.0',
  },
];

let cohorts: any[] = [
  {
    id: 'COH001', name: '肺结节阳性队列', criteria: '影像报告包含"肺结节"且已病理确诊',
    estimatedSize: 320, createdBy: '张明远', createdDate: '2026-02-10', lastRun: '2026-07-30',
  },
  {
    id: 'COH002', name: '冠脉CTA高危斑块队列', criteria: '斑块负荷 > 50% 且 CTA 阳性',
    estimatedSize: 180, createdBy: '陈静', createdDate: '2026-03-15', lastRun: '2026-07-28',
  },
];

const exportAudit: any[] = [
  {
    id: 'EA001', exportId: 'EXP001', requester: '张明远', approvedBy: '王建华',
    exportTime: '2026-08-01 10:30', records: 1286, purpose: '多中心研究数据汇总', status: 'APPROVED',
  },
];

const qualityScores: any[] = [
  { field: '诊断结论', completeness: 98.2, consistency: 95.6, freshness: '2026-08-01', suggestion: '补充TNM分期字段' },
  { field: '影像特征', completeness: 92.5, consistency: 90.1, freshness: '2026-08-01', suggestion: '统一结节特征术语' },
  { field: '随访信息', completeness: 78.3, consistency: 82.4, freshness: '2026-07-25', suggestion: '完善随访记录采集' },
];

export const researchHandlers = [
  http.get(`${API}/projects`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    let items = projects;
    if (status) items = items.filter((p) => p.status === status);
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),
  http.post(`${API}/projects`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const newItem = {
      id: `PRJ${Date.now().toString(36).toUpperCase()}`,
      code: String(body?.code ?? `R-2026-${String(projects.length + 1).padStart(3, '0')}`),
      name: String(body?.name ?? '未命名课题'),
      leader: String(body?.leader ?? '当前用户'),
      startDate: String(body?.startDate ?? new Date().toISOString().slice(0, 10)),
      status: '进行中',
      dataCount: Number(body?.dataCount ?? 0),
      description: String(body?.description ?? ''),
      members: Array.isArray(body?.members) ? body.members : [],
    };
    projects = [newItem, ...projects];
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),

  http.get(`${API}/exam-records`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: examRecords, meta: { total: examRecords.length } });
  }),

  http.get(`${API}/labels`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: labels, meta: { total: labels.length } });
  }),
  http.post(`${API}/labels`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const newItem = {
      id: `LBL${Date.now().toString(36).toUpperCase()}`,
      name: String(body?.name ?? '未命名标签'),
      type: String(body?.type ?? '诊断'),
      color: String(body?.color ?? 'var(--color-primary-500)'),
      useCount: 0,
    };
    labels = [newItem, ...labels];
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),

  http.get(`${API}/exports`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: exports_, meta: { total: exports_.length } });
  }),

  http.get(`${API}/irb`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: irbSubmissions, meta: { total: irbSubmissions.length } });
  }),
  http.post(`${API}/irb`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const newItem = {
      id: `IRB${Date.now().toString(36).toUpperCase()}`,
      projectName: String(body?.projectName ?? '未命名课题'),
      pi: String(body?.pi ?? '当前用户'),
      submittedDate: new Date().toISOString().slice(0, 10),
      status: 'draft',
      approvedDate: '',
      expiryDate: '',
      consentForm: String(body?.consentForm ?? ''),
    };
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),

  http.get(`${API}/cohorts`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: cohorts, meta: { total: cohorts.length } });
  }),
  http.post(`${API}/cohorts`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const newItem = {
      id: `COH${Date.now().toString(36).toUpperCase()}`,
      name: String(body?.name ?? '未命名队列'),
      criteria: String(body?.criteria ?? ''),
      estimatedSize: Number(body?.estimatedSize ?? 0),
      createdBy: String(body?.createdBy ?? '当前用户'),
      createdDate: new Date().toISOString().slice(0, 10),
      lastRun: '',
    };
    cohorts = [newItem, ...cohorts];
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),

  http.get(`${API}/export-audit`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: exportAudit, meta: { total: exportAudit.length } });
  }),

  http.get(`${API}/quality-scores`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: qualityScores, meta: { total: qualityScores.length } });
  }),
];
