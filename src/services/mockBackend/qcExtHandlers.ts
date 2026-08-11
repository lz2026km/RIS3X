// [v3.0.6.11-7] /api/v1/qc MSW handlers
// [Phase 2 MSW 降级] 大部分 qc 端点无前端调用(qcImageAiApi 使用 /qc/image-ai/*,
//   后端已有 /api/qc/image-ai 真实实现),已按 C 类清理。
// [W1-A P0] qcextApi.rateQcImage 路径已对齐后端 POST /qc-ext/image/:id/rate,
//   补一个 MSW handler 防止 mock 模式 404。
// [W2-B-3] 补全 qcextApi 全套端点 (dashboard / image / radiologist-annual /
//   defect / stats / scores), 对齐后端 qcext.controller, 修复 dev mock 下 500。
import { http, HttpResponse, delay } from 'msw';
import { API_BASE } from '../api/client';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

const SEED_IMAGES: any[] = [
  { id: 'IMG-001', patientName: '张伟', device: 'GE Revolution CT', score: 92, issues: [], status: 'passed', examDate: '2026-08-05', modality: 'CT' },
  { id: 'IMG-002', patientName: '李娜', device: '西门子 Force CT', score: 78, issues: ['定位线偏移'], status: 'review', examDate: '2026-08-04', modality: 'CT' },
  { id: 'IMG-003', patientName: '王磊', device: '飞利浦 Ingenia MR', score: 88, issues: [], status: 'passed', examDate: '2026-08-04', modality: 'MR' },
  { id: 'IMG-004', patientName: '赵敏', device: 'GE Revolution CT', score: 65, issues: ['运动伪影', '扫描范围不足'], status: 'failed', examDate: '2026-08-03', modality: 'CT' },
  { id: 'IMG-005', patientName: '周婷', device: 'DR-2（岛津）', score: 95, issues: [], status: 'passed', examDate: '2026-08-03', modality: 'DR' },
];

const SEED_RADIOLOGIST_ANNUAL: any[] = [
  { id: 'RA-001', doctorId: 'D001', doctorName: '张医生', year: 2026, totalScore: 92.5, formatScore: 95, accuracyScore: 91, timelinessScore: 90, reportCount: 1280, defectCount: 12, grade: 'A' },
  { id: 'RA-002', doctorId: 'D002', doctorName: '李医生', year: 2026, totalScore: 88.2, formatScore: 90, accuracyScore: 87, timelinessScore: 89, reportCount: 1120, defectCount: 18, grade: 'B' },
  { id: 'RA-003', doctorId: 'D003', doctorName: '王医生', year: 2026, totalScore: 95.1, formatScore: 96, accuracyScore: 95, timelinessScore: 94, reportCount: 1450, defectCount: 6, grade: 'A' },
  { id: 'RA-004', doctorId: 'D004', doctorName: '赵医生', year: 2026, totalScore: 81.7, formatScore: 84, accuracyScore: 80, timelinessScore: 82, reportCount: 980, defectCount: 25, grade: 'C' },
];

const SEED_DEFECTS: any[] = [
  { id: 'DF-001', reportId: 'RPT001', defectType: '描述不准确', description: '肺结节测量值偏小', severity: 'high', status: 'open', createdAt: '2026-08-05 09:30', reportedBy: '李医生' },
  { id: 'DF-002', reportId: 'RPT002', defectType: '测量缺失', description: '缺少病灶最大径测量', severity: 'medium', status: 'pending', createdAt: '2026-08-04 14:20', reportedBy: '王医生' },
  { id: 'DF-003', reportId: 'RPT003', defectType: '结论不明确', description: '结论与所见矛盾', severity: 'high', status: 'resolved', createdAt: '2026-08-03 10:10', reportedBy: '赵医生' },
];

export const qcExtHandlers = [
  // [W1-A P0] 图像评分 (id 在路径, body: { score, issues? })
  http.post(`${API_BASE}/qc-ext/image/:id/rate`, async ({ params, request }) => {
    await delay(80);
    const id = params.id as string;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      data: {
        id,
        patientName: '示例患者',
        device: 'GE Revolution CT',
        score: Number(body.score ?? 90),
        issues: Array.isArray(body.issues) ? body.issues : [],
        status: 'rated',
        examDate: new Date().toISOString().slice(0, 10),
        modality: 'CT',
      },
    });
  }),

  // [W2-B-3] 影像质控仪表盘 (RadiologyQCDashboardPage / CvQcPage)
  http.get(`${API_BASE}/qc-ext/dashboard`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        id: 'DASH-001',
        totalInspected: 346,
        passedRate: 92.4,
        excellentRate: 68.2,
        defectRate: 4.6,
        avgScore: 88.7,
        period: '2026-08',
      },
    });
  }),
  http.get(`${API_BASE}/qc-ext/dashboard/:id`, async ({ params }) => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        id: params.id as string,
        totalInspected: 346,
        passedRate: 92.4,
        excellentRate: 68.2,
        defectRate: 4.6,
        avgScore: 88.7,
        period: '2026-08',
      },
    });
  }),

  // [W2-B-3] 影像列表 (SpecialAssessmentPage 历次评估)
  http.get(`${API_BASE}/qc-ext/image`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    let items = SEED_IMAGES;
    if (status) items = items.filter((i) => i.status === status);
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),
  http.get(`${API_BASE}/qc-ext/image/:id`, async ({ params }) => {
    await delay(delayMs());
    const item = SEED_IMAGES.find((i) => i.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `影像不存在: ${params.id}` } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),

  // [W2-B-3] 医师年度质控 (RadiologistAnnualQCPage)
  http.get(`${API_BASE}/qc-ext/radiologist-annual`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const year = url.searchParams.get('year');
    let items = SEED_RADIOLOGIST_ANNUAL;
    if (year) items = items.filter((i) => String(i.year) === year);
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),
  http.get(`${API_BASE}/qc-ext/radiologist-annual/:id`, async ({ params }) => {
    await delay(delayMs());
    const item = SEED_RADIOLOGIST_ANNUAL.find((i) => i.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `年度质控记录不存在: ${params.id}` } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),

  // [W2-B-3] 缺陷管理 (DefectManagementPage)
  http.get(`${API_BASE}/qc-ext/defect`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    let items = SEED_DEFECTS;
    if (status) items = items.filter((d) => d.status === status);
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),
  http.post(`${API_BASE}/qc-ext/defect`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const newItem = {
      id: `DF-${Date.now().toString(36).toUpperCase()}`,
      reportId: String(body?.reportId ?? ''),
      defectType: String(body?.defectType ?? '其他'),
      description: String(body?.description ?? ''),
      severity: String(body?.severity ?? 'medium'),
      status: 'open',
      createdAt: new Date().toISOString(),
      reportedBy: String(body?.reportedBy ?? '当前用户'),
    };
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),

  // [W2-B-3] 质控统计 (RadiologyQCDashboardPage / CvQcPage)
  http.get(`${API_BASE}/qc-ext/stats`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        totalReports: 346,
        avgScore: 88.7,
        gradeDistribution: [
          { grade: 'A', count: 236, percentage: 68.2 },
          { grade: 'B', count: 84, percentage: 24.3 },
          { grade: 'C', count: 20, percentage: 5.8 },
          { grade: 'D', count: 6, percentage: 1.7 },
        ],
        defectDistribution: [
          { defectType: '描述不准确', count: 8, percentage: 40 },
          { defectType: '测量缺失', count: 7, percentage: 35 },
          { defectType: '结论不明确', count: 5, percentage: 25 },
        ],
      },
    });
  }),

  // [W2-B-3] 评分榜
  http.get(`${API_BASE}/qc-ext/scores`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: [
        { doctorId: 'D003', doctorName: '王医生', totalScore: 95.1, formatScore: 96, accuracyScore: 95, timelinessScore: 94, reportCount: 1450, rank: 1, grade: 'A' },
        { doctorId: 'D001', doctorName: '张医生', totalScore: 92.5, formatScore: 95, accuracyScore: 91, timelinessScore: 90, reportCount: 1280, rank: 2, grade: 'A' },
        { doctorId: 'D002', doctorName: '李医生', totalScore: 88.2, formatScore: 90, accuracyScore: 87, timelinessScore: 89, reportCount: 1120, rank: 3, grade: 'B' },
      ],
      meta: { total: 3 },
    });
  }),
];
