// [v3.0.6.11-7] /api/v1/data-report MSW handlers
// [v3.0.6.11-79 W2-B] 补全: 种子数据形状对齐 DTO · :id 详情可命中 · exam-statistics / report-logs / monthly-trends
//   覆盖: national-reports(GET/POST/:id) · data-reports(GET/POST/:id) · insurance-audits(GET/:id)
//         enterprise-search · exam-statistics · report-logs · monthly-trends
import { http, HttpResponse, delay } from 'msw';
import { list } from './store';

const API = '/api/v1/data-report';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

// ===== [W2-B] 种子数据 (与 datareportApi DTO 形状对齐) =====

let nationalReports: any[] = [
  {
    id: 'NR001', reportMonth: '2026-05', modality: 'CT', totalExams: 1256, totalDLP: 980500,
    avgDLP: 781, totalCTDI: 29400, avgCTDI: 23.4, alertCount: 12, highDoseCount: 56,
    status: '已上报', submitTime: '2026-06-05 10:30',
  },
  {
    id: 'NR002', reportMonth: '2026-05', modality: 'DR', totalExams: 1089, totalDLP: 0,
    avgDLP: 0, totalCTDI: 1633, avgCTDI: 1.5, alertCount: 2, highDoseCount: 5,
    status: '待上报',
  },
  {
    id: 'NR003', reportMonth: '2026-05', modality: 'MRI', totalExams: 1212, totalDLP: 0,
    avgDLP: 0, totalCTDI: 0, avgCTDI: 0, alertCount: 0, highDoseCount: 0,
    status: '待上报',
  },
  {
    id: 'NR004', reportMonth: '2026-04', modality: 'CT', totalExams: 3677, totalDLP: 2856400,
    avgDLP: 777, totalCTDI: 85600, avgCTDI: 23.3, alertCount: 28, highDoseCount: 156,
    status: '已确认', submitTime: '2026-05-05 10:30', confirmTime: '2026-05-06 09:15',
    confirmOrg: '国家辐射防护中心',
  },
  {
    id: 'NR005', reportMonth: '2026-04', modality: 'DR', totalExams: 3032, totalDLP: 0,
    avgDLP: 0, totalCTDI: 4548, avgCTDI: 1.5, alertCount: 5, highDoseCount: 12,
    status: '已确认', submitTime: '2026-05-05 10:35', confirmTime: '2026-05-06 09:20',
    confirmOrg: '国家辐射防护中心',
  },
  {
    id: 'NR006', reportMonth: '2026-04', modality: 'MG', totalExams: 324, totalDLP: 0,
    avgDLP: 0, totalCTDI: 648, avgCTDI: 2.0, alertCount: 0, highDoseCount: 0,
    status: '已确认', submitTime: '2026-05-05 10:42', confirmTime: '2026-05-06 09:28',
    confirmOrg: '国家辐射防护中心',
  },
];

let dataReports: any[] = [
  {
    id: 'QR001', reportType: '报告质量', reportMonth: '2026-04', totalReports: 7033,
    qualifiedReports: 6856, excellentReports: 2156, qualifiedRate: 97.5, excellentRate: 30.7,
    avgScore: 87.3, status: '已通过',
    commonIssues: ['描述不准确', '测量数据缺失', '结论不明确'],
    improvementMeasures: ['加强培训', '完善模板', '增加复核环节'],
  },
  {
    id: 'QR002', reportType: '报告质量', reportMonth: '2026-05', totalReports: 3457,
    qualifiedReports: 3356, excellentReports: 1025, qualifiedRate: 97.1, excellentRate: 29.7,
    avgScore: 86.8, status: '待审核',
    commonIssues: ['图像质量描述不足', '病史采集不全'],
    improvementMeasures: ['优化检查流程', '加强病史采集培训'],
  },
  {
    id: 'QR003', reportType: '检查统计', reportMonth: '2026-04', totalReports: 7633,
    qualifiedReports: 7456, excellentReports: 2310, qualifiedRate: 97.7, excellentRate: 30.3,
    avgScore: 88.1, status: '已通过',
    commonIssues: ['部位名称不规范'],
    improvementMeasures: ['统一解剖术语'],
  },
];

let insuranceAudits: any[] = [
  {
    id: 'IA001', patientName: '张伟', patientId: 'P202400001', examType: 'CT增强',
    drugName: '碘海醇注射液', drugCategory: 'CT对比剂', status: 'PENDING',
    submitTime: '2026-07-20 08:30', reason: '申请头颅CT增强检查使用碘海醇',
  },
  {
    id: 'IA002', patientName: '李娜', patientId: 'P202400002', examType: 'MRI增强',
    drugName: '钆喷酸葡胺注射液', drugCategory: 'MRI对比剂', status: 'PENDING',
    submitTime: '2026-07-20 09:15', reason: '申请头颅MRI增强检查使用钆喷酸葡胺',
  },
  {
    id: 'IA003', patientName: '王磊', patientId: 'P202400003', examType: 'DSA手术',
    drugName: '比伐卢定注射液', drugCategory: '抗凝药物', status: 'APPROVED',
    submitTime: '2026-07-18 10:20', result: '通过', auditor: '李审核', auditTime: '2026-07-19 14:00',
  },
  {
    id: 'IA004', patientName: '赵敏', patientId: 'P202400004', examType: 'CT增强',
    drugName: '碘克沙醇注射液', drugCategory: 'CT对比剂', status: 'REJECTED',
    submitTime: '2026-07-17 11:45', result: '拒绝', auditor: '王审核', auditTime: '2026-07-18 10:00',
    reason: '肾功能 eGFR=28ml/min，低于安全阈值',
  },
];

const examStatisticsSeed = [
  { id: 'EX001', modality: 'CT', examType: '头颅CT平扫', examCount: 1256, positiveCount: 312, positiveRate: 24.8, avgReportTime: 25, qualifiedRate: 96.5 },
  { id: 'EX002', modality: 'CT', examType: '胸部CT平扫', examCount: 1089, positiveCount: 287, positiveRate: 26.4, avgReportTime: 22, qualifiedRate: 97.2 },
  { id: 'EX003', modality: 'CT', examType: '腹部CT平扫', examCount: 876, positiveCount: 198, positiveRate: 22.6, avgReportTime: 28, qualifiedRate: 95.8 },
  { id: 'EX004', modality: 'CT', examType: '冠脉CTA', examCount: 456, positiveCount: 189, positiveRate: 41.4, avgReportTime: 35, qualifiedRate: 94.3 },
  { id: 'EX005', modality: 'MRI', examType: '头颅MRI平扫', examCount: 678, positiveCount: 156, positiveRate: 23.0, avgReportTime: 30, qualifiedRate: 98.1 },
  { id: 'EX006', modality: 'MRI', examType: '膝关节MRI', examCount: 534, positiveCount: 289, positiveRate: 54.1, avgReportTime: 25, qualifiedRate: 97.5 },
  { id: 'EX007', modality: 'DR', examType: '胸部正侧位', examCount: 2156, positiveCount: 432, positiveRate: 20.0, avgReportTime: 15, qualifiedRate: 98.9 },
  { id: 'EX008', modality: 'DR', examType: '腹部平片', examCount: 876, positiveCount: 98, positiveRate: 11.2, avgReportTime: 12, qualifiedRate: 99.2 },
  { id: 'EX009', modality: 'MG', examType: '乳腺钼靶', examCount: 324, positiveCount: 45, positiveRate: 13.9, avgReportTime: 20, qualifiedRate: 96.8 },
  { id: 'EX010', modality: 'DSA', examType: '冠脉造影', examCount: 156, positiveCount: 89, positiveRate: 57.1, avgReportTime: 45, qualifiedRate: 93.5 },
];

const reportLogsSeed = [
  { id: 'LOG001', reportType: 'dose', reportMonth: '2026-05', submitTime: '2026-06-05 10:30', status: '已上报', operator: '李建国', note: '辐射剂量数据上报成功' },
  { id: 'LOG002', reportType: 'exam', reportMonth: '2026-05', submitTime: '2026-06-05 11:00', status: '已上报', operator: '李建国' },
  { id: 'LOG003', reportType: 'quality', reportMonth: '2026-04', submitTime: '2026-05-05 11:30', status: '已确认', operator: '王晓燕', note: '质量数据上报成功' },
  { id: 'LOG004', reportType: 'dose', reportMonth: '2026-04', submitTime: '2026-05-05 10:30', status: '已确认', operator: '李建国', note: '国家辐射防护中心确认通过' },
  { id: 'LOG005', reportType: 'exam', reportMonth: '2026-04', submitTime: '2026-05-05 11:00', status: '已确认', operator: '李建国', note: '上报成功' },
];

const monthlyTrendsSeed = [
  { month: '2025-12', CT: 3200, MRI: 1100, DR: 2800, MG: 280, DSA: 120 },
  { month: '2026-01', CT: 3350, MRI: 1150, DR: 2950, MG: 295, DSA: 135 },
  { month: '2026-02', CT: 3100, MRI: 1080, DR: 2750, MG: 265, DSA: 125 },
  { month: '2026-03', CT: 3450, MRI: 1200, DR: 3050, MG: 310, DSA: 145 },
  { month: '2026-04', CT: 3677, MRI: 1212, DR: 3032, MG: 324, DSA: 156 },
  { month: '2026-05', CT: 1256, MRI: 580, DR: 1089, MG: 156, DSA: 68 },
];

const findById = <T extends { id: string }>(items: T[], id: string): T | undefined =>
  items.find(i => i.id === id);

export const dataReportHandlers = [
  http.get(`${API}/national-reports`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const month = url.searchParams.get('reportMonth');
    const status = url.searchParams.get('status');
    let items = nationalReports;
    if (month) items = items.filter(d => d.reportMonth === month);
    if (status) items = items.filter(d => d.status === status);
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),
  http.get(`${API}/national-reports/:id`, async ({ params }) => {
    await delay(delayMs());
    const item = findById(nationalReports, params.id as string);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `上报记录不存在: ${params.id}` } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.post(`${API}/national-reports`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const reportMonth = String(body?.reportMonth ?? new Date().toISOString().slice(0, 7));
    const modality = String(body?.modality ?? 'CT');
    const totalExams = Number(body?.totalExams ?? 0);
    const newItem = {
      id: `NR${Date.now().toString(36).toUpperCase()}`,
      reportMonth,
      modality,
      totalExams,
      totalDLP: Number(body?.totalDLP ?? 0),
      avgDLP: Number(body?.avgDLP ?? 0),
      totalCTDI: Number(body?.totalCTDI ?? 0),
      avgCTDI: Number(body?.avgCTDI ?? 0),
      alertCount: Number(body?.alertCount ?? 0),
      highDoseCount: Number(body?.highDoseCount ?? 0),
      status: body?.status ?? '待上报',
      submitTime: body?.submitTime,
      createdAt: new Date().toISOString(),
    };
    nationalReports = [newItem, ...nationalReports];
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/data-reports`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const month = url.searchParams.get('reportMonth');
    let items = dataReports;
    if (month) items = items.filter(d => d.reportMonth === month);
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),
  http.get(`${API}/data-reports/:id`, async ({ params }) => {
    await delay(delayMs());
    const item = findById(dataReports, params.id as string);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `数据上报不存在: ${params.id}` } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.post(`${API}/data-reports`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = {
      id: `QR${Date.now().toString(36).toUpperCase()}`,
      reportType: String(body?.reportType ?? '报告质量'),
      reportMonth: String(body?.reportMonth ?? new Date().toISOString().slice(0, 7)),
      totalReports: Number(body?.totalReports ?? 0),
      qualifiedReports: Number(body?.qualifiedReports ?? 0),
      excellentReports: Number(body?.excellentReports ?? 0),
      qualifiedRate: Number(body?.qualifiedRate ?? 0),
      excellentRate: Number(body?.excellentRate ?? 0),
      avgScore: Number(body?.avgScore ?? 0),
      status: body?.status ?? '待审核',
      commonIssues: Array.isArray(body?.commonIssues) ? body.commonIssues : [],
      improvementMeasures: Array.isArray(body?.improvementMeasures) ? body.improvementMeasures : [],
      createdAt: new Date().toISOString(),
    };
    dataReports = [newItem, ...dataReports];
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${API}/insurance-audits`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    let items = insuranceAudits;
    if (status) items = items.filter(d => d.status === status.toUpperCase());
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),
  http.get(`${API}/insurance-audits/:id`, async ({ params }) => {
    await delay(delayMs());
    const item = findById(insuranceAudits, params.id as string);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `保险审计记录不存在: ${params.id}` } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.get(`${API}/enterprise-search`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    if (!q) return HttpResponse.json({ success: true, data: [], meta: { total: 0 } });
    let patients: any[] = [];
    let exams: any[] = [];
    try { patients = list<any>('patients') || []; } catch {}
    try { exams = list<any>('exams') || []; } catch {}
    const out: any[] = [];
    for (const p of patients.slice(0, 150)) {
      const hay = `${p.id} ${p.name} ${p.phone || ''}`.toLowerCase();
      if (!hay.includes(q)) continue;
      out.push({ id: `P-${p.id}`, title: `患者 ${p.name}`, description: `${p.gender || '-'} ${p.age ?? '-'}岁 · ${p.id} · 登记 ${p.registeredAt || '-'}`, type: '患者', score: 96 });
    }
    for (const e of exams.slice(0, 400)) {
      const hay = `${e.patientName || ''} ${e.examItem || ''} ${e.modality || ''} ${e.bodyPart || ''} ${e.reportId || ''} ${e.findings || ''} ${e.impression || ''}`.toLowerCase();
      if (!hay.includes(q)) continue;
      out.push({ id: `E-${e.id || e.reportId}`, title: `检查 ${e.examItem || '影像检查'}`, description: `${e.patientName || '-'} · ${e.modality || '-'} · ${e.examAt || '-'}`, type: '检查', score: 90 });
      out.push({ id: `R-${e.reportId || e.id}`, title: `报告 ${e.reportId || e.id}`, description: `所见：${(e.findings || '—').slice(0, 80)}`, type: '报告', score: 84 });
    }
    out.sort((a, b) => b.score - a.score);
    return HttpResponse.json({ success: true, data: out.slice(0, 100), meta: { total: out.length } });
  }),

  // [W2-B] 检查统计 / 上报记录 / 月度趋势 (页面使用, 对齐 datareportApi)
  http.get(`${API}/exam-statistics`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: examStatisticsSeed, meta: { total: examStatisticsSeed.length } });
  }),
  http.get(`${API}/report-logs`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: reportLogsSeed, meta: { total: reportLogsSeed.length } });
  }),
  http.get(`${API}/monthly-trends`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: monthlyTrendsSeed, meta: { total: monthlyTrendsSeed.length } });
  }),
];
