// [v3.0.6.11-54] Phase 2 壳页面真实化 - 缺失端点 MSW mock
// 覆盖: dicom-web (QIDO) / critical-alert / dicom sr-report / nuclear-stats
import { http, HttpResponse, delay } from 'msw';
import { v4 as uuidv4 } from 'uuid';

const API_BASE = (() => {
  try { return window.location.origin + '/api/v1'; } catch { return 'http://localhost:5173/api/v1'; }
})();

const delayMs = (min = 60, max = 200) => Math.floor(Math.random() * (max - min) + min);

// ───────────────────────── DICOM-web QIDO ─────────────────────────
const MOCK_STUDIES: any[] = Array.from({ length: 14 }, (_, i) => {
  const mod = (['CT', 'MR', 'DR', 'CBCT', 'MG'] as const)[i % 5];
  const seriesCount = 1 + (i % 3);
  return {
    studyInstanceUID: `1.2.840.113654.${100 + i}.${String(i).padStart(10, '0')}`,
    studyID: `STU-${String(20260001 + i)}`,
    studyDate: `2026-0${(i % 6) + 1}-${String(10 + (i % 18)).padStart(2, '0')}`,
    studyTime: `${String(8 + (i % 10)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`,
    studyDescription: ['胸部CT平扫', '头颅MRI增强', '腹部CT增强', '颈椎DR正侧位', '口腔CBCT全景', '乳腺钼靶' ][i % 6],
    patientID: `P2026${String(10000 + i)}`,
    patientName: ['张三', '李四', '王五', '赵六', '陈七', '刘八', '周九', '吴十', '郑一', '孙二', '钱三', '何四', '黄五', '林六'][i],
    patientSex: i % 2 === 0 ? 'F' : 'M',
    accessionNumber: `ACC-${String(10000 + i)}`,
    modalitiesInStudy: [mod],
    numberOfStudyRelatedSeries: seriesCount,
    numberOfStudyRelatedInstances: seriesCount * (40 + i * 7),
  };
});

const MOCK_SERIES: Record<string, any[]> = {};
for (const s of MOCK_STUDIES) {
  MOCK_SERIES[s.studyInstanceUID] = Array.from({ length: s.numberOfStudyRelatedSeries }, (_, i) => ({
    seriesInstanceUID: `${s.studyInstanceUID}.${i + 1}`,
    seriesNumber: i + 1,
    modality: s.modalitiesInStudy[0],
    seriesDescription: i === 0 ? '平扫' : i === 1 ? '增强动脉期' : '增强静脉期',
    bodyPartExamined: 'CHEST',
    sliceThickness: i === 0 ? 1.25 : 5,
    numberOfSeriesRelatedInstances: 40 + i * 7,
    studyInstanceUID: s.studyInstanceUID,
  }));
}

const dicomWebHandlers = [
  http.get(`${API_BASE}/dicom-web/studies`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const modality = url.searchParams.get('Modality');
    const patientId = url.searchParams.get('PatientID');
    let all = MOCK_STUDIES;
    if (modality) all = all.filter((s) => s.modalitiesInStudy.includes(modality));
    if (patientId) all = all.filter((s) => s.patientID === patientId);
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),
  http.get(`${API_BASE}/dicom-web/studies/:studyUid/series`, async ({ params }) => {
    await delay(delayMs());
    const series = MOCK_SERIES[String(params.studyUid)] ?? [];
    return HttpResponse.json({ success: true, data: series });
  }),
  http.get(`${API_BASE}/dicom-web/studies/:studyUid/instances`, async ({ params, request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const seriesUid = url.searchParams.get('series');
    const base = String(params.studyUid);
    const count = seriesUid ? 60 : 120;
    return HttpResponse.json({
      success: true,
      data: Array.from({ length: count }, (_, i) => ({
        sopInstanceUID: `${base}.${seriesUid ?? 'S1'}.${String(i + 1).padStart(5, '0')}`,
        sopClassUID: '1.2.840.10008.5.1.4.1.1.2',
        instanceNumber: i + 1,
        seriesInstanceUID: seriesUid ?? `${base}.1`,
        studyInstanceUID: base,
        numberOfFrames: 1,
      })),
    });
  }),
];

// ───────────────────────── Critical Alert ─────────────────────────
let criticalAlerts: any[] = Array.from({ length: 12 }, (_, i) => {
  const severities = ['info', 'warning', 'critical', 'emergency'] as const;
  const alertTypes = ['critical_value', 'unexpected_finding', 'technical_issue', 'protocol_deviation'] as const;
  const statuses = ['active', 'acknowledged', 'resolved', 'escalated'] as const;
  const titles = [
    '危急值: 血钾 6.8 mmol/L', '意外发现: 左侧气胸', '技术问题: 运动伪影',
    '危急值: 肌钙蛋白 12.5 ng/mL', '意外发现: 颅内占位', '协议偏离: 增强延迟',
    '危急值: 白细胞 32×10⁹/L', '技术问题: 探测器离线', '意外发现: 主动脉夹层',
    '危急值: 血糖 1.9 mmol/L', '协议偏离: 造影剂量不足', '技术问题: 重建失败',
  ];
  return {
    id: `ca-${String(i + 1).padStart(3, '0')}`,
    patientId: `P2026${String(20000 + i)}`,
    patientName: ['张伟', '李娜', '王芳', '赵敏', '陈杰', '刘洋', '周婷', '吴强', '郑爽', '孙浩', '钱慧', '何军'][i],
    studyId: `STU-${String(20260001 + i)}`,
    modality: ['CT', 'MR', 'DR', 'CT', 'MR', 'CBCT'][i % 6],
    alertType: alertTypes[i % 4],
    severity: severities[i % 4],
    title: titles[i],
    description: '系统自动检测到异常结果, 需要医生确认处理。',
    status: statuses[i % 4],
    assignee: i % 3 === 0 ? 'Dr. Wang' : undefined,
    createdAt: new Date(Date.now() - i * 3.5 * 3600_000).toISOString(),
    resolvedAt: statuses[i % 4] === 'resolved' ? new Date(Date.now() - i * 2 * 3600_000).toISOString() : undefined,
  };
});

const criticalAlertHandlers = [
  http.get(`${API_BASE}/critical-alert/stats`, async () => {
    await delay(delayMs());
    const sevDist: Record<string, number> = {};
    for (const a of criticalAlerts) sevDist[a.severity] = (sevDist[a.severity] ?? 0) + 1;
    return HttpResponse.json({
      success: true,
      data: {
        totalAlerts: criticalAlerts.length,
        activeCount: criticalAlerts.filter((a) => a.status === 'active').length,
        acknowledgedCount: criticalAlerts.filter((a) => a.status === 'acknowledged').length,
        resolvedCount: criticalAlerts.filter((a) => a.status === 'resolved').length,
        avgResponseTimeMinutes: 23,
        severityDistribution: Object.entries(sevDist).map(([severity, count]) => ({ severity, count })),
      },
    });
  }),
  http.get(`${API_BASE}/critical-alert/alerts`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    // [W1-A P0] 前端 URLSearchParams 会把 undefined 序列化为 "undefined", 需忽略
    const status = url.searchParams.get('status');
    const severity = url.searchParams.get('severity');
    const alertType = url.searchParams.get('alertType');
    let all = criticalAlerts;
    if (status && status !== 'undefined') all = all.filter((a) => a.status === status);
    if (severity && severity !== 'undefined') all = all.filter((a) => a.severity === severity);
    if (alertType && alertType !== 'undefined') all = all.filter((a) => a.alertType === alertType);
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),
  http.get(`${API_BASE}/critical-alert/alerts/:id`, async ({ params }) => {
    await delay(delayMs());
    const item = criticalAlerts.find((a) => a.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Alert not found' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.post(`${API_BASE}/critical-alert/alerts/:id/acknowledge`, async ({ params, request }) => {
    await delay(delayMs());
    const item = criticalAlerts.find((a) => a.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    item.status = 'acknowledged';
    item.acknowledgedBy = String(body.acknowledgedBy ?? '当前用户');
    item.acknowledgedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: item });
  }),
  http.post(`${API_BASE}/critical-alert/alerts/:id/resolve`, async ({ params, request }) => {
    await delay(delayMs());
    const item = criticalAlerts.find((a) => a.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    item.status = 'resolved';
    item.resolvedAt = new Date().toISOString();
    void body;
    return HttpResponse.json({ success: true, data: item });
  }),
  http.post(`${API_BASE}/critical-alert/alerts/:id/escalate`, async ({ params }) => {
    await delay(delayMs());
    const item = criticalAlerts.find((a) => a.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    item.status = 'escalated';
    item.assignee = '值班主任医师';
    return HttpResponse.json({ success: true, data: item });
  }),
  http.post(`${API_BASE}/critical-alert/alerts`, async ({ request }) => {
    await delay(delayMs());
    const body = await request.json() as Record<string, unknown>;
    const item: any = {
      id: `ca-${Date.now()}`,
      patientName: String(body.patientName ?? '未知患者'),
      studyId: String(body.studyId ?? ''),
      modality: String(body.modality ?? 'CT'),
      alertType: String(body.alertType ?? 'critical_value'),
      severity: String(body.severity ?? 'critical'),
      title: String(body.title ?? ''),
      description: String(body.description ?? ''),
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    criticalAlerts = [item, ...criticalAlerts];
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
];

// ───────────────────────── DICOM SR Report ─────────────────────────
const MOCK_SR_REPORTS = Array.from({ length: 8 }, (_, i) => {
  const types = ['comprehensive', 'key_object', 'measurement', 'textural'] as const;
  const statuses = ['draft', 'final', 'amended'] as const;
  return {
    id: `SR-${String(20260001 + i)}`,
    studyInstanceUid: `1.2.840.113654.${100 + i}.${String(i).padStart(10, '0')}`,
    seriesInstanceUid: `1.2.840.113654.${100 + i}.${String(i).padStart(10, '0')}.1`,
    sopInstanceUid: uuidv4(),
    patientName: ['张伟', '李娜', '王芳', '赵敏', '陈杰', '刘洋', '周婷', '吴强'][i],
    patientId: `P2026${String(20000 + i)}`,
    modality: ['CT', 'MR', 'CT', 'PET-CT', 'CT', 'MR', 'CT', 'DR'][i],
    reportType: types[i % 4],
    title: ['胸部CT肺结节结构化报告', '头颅MRI占位评估', '腹部CT增强评估', 'PET-CT全身SUV评估', '肺结节随访测量', '膝关节MRI结构评估', '冠脉CTA结构化报告', '颈椎DR测量报告'][i],
    content: {
      patient: { name: ['张伟', '李娜', '王芳', '赵敏'][i % 4], id: `P2026${String(20000 + i)}` },
      study: { uid: `1.2.840.113654.${100 + i}.${String(i).padStart(10, '0')}`, date: `2026-0${(i % 5) + 1}-1${i}`, description: '常规检查' },
      findings: [
        {
          id: `f-${i}-1`, category: '结节', location: '右上肺', description: '磨玻璃密度结节, 边界清晰',
          measurements: [{ id: `m-${i}-1`, name: '最大径', value: 6.5, unit: 'mm' }],
        },
        { id: `f-${i}-2`, category: '结论', description: '未见明显异常征象' },
      ],
      conclusion: '影像所见未见明确恶性征象, 建议定期随访复查。',
      recommendations: '3-6 个月后复查胸部 CT 平扫。',
    },
    status: statuses[i % 3],
    authorId: `D${String(100 + i)}`,
    authorName: `Dr. ${['Wang', 'Li', 'Zhang', 'Zhao', 'Chen', 'Liu', 'Zhou', 'Wu'][i]}`,
    createdAt: new Date(Date.now() - i * 2 * 86400_000).toISOString(),
    updatedAt: new Date(Date.now() - i * 86400_000).toISOString(),
  };
});

const srReportHandlers = [
  http.get(`${API_BASE}/dicom/sr-report/reports`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const reportType = url.searchParams.get('reportType');
    let all = MOCK_SR_REPORTS;
    if (status) all = all.filter((r) => r.status === status);
    if (reportType) all = all.filter((r) => r.reportType === reportType);
    return HttpResponse.json({ success: true, data: all, meta: { total: all.length } });
  }),
  http.get(`${API_BASE}/dicom/sr-report/reports/:id`, async ({ params }) => {
    await delay(delayMs());
    const item = MOCK_SR_REPORTS.find((r) => r.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.get(`${API_BASE}/dicom/sr-report/studies/:studyUid/reports`, async ({ params }) => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: MOCK_SR_REPORTS.filter((r) => r.studyInstanceUid === params.studyUid) });
  }),
  http.post(`${API_BASE}/dicom/sr-report/reports`, async ({ request }) => {
    await delay(delayMs());
    const body = await request.json() as Record<string, unknown>;
    const item = {
      id: `SR-${Date.now()}`,
      ...body,
      status: 'draft',
      authorName: '当前用户',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
  http.post(`${API_BASE}/dicom/sr-report/reports/:id/finalize`, async ({ params }) => {
    await delay(delayMs());
    const item = MOCK_SR_REPORTS.find((r) => r.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    item.status = 'final';
    item.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: item });
  }),
];

// ───────────────────────── Nuclear Stats ─────────────────────────
const nuclearSummary = {
  month: '2026-06',
  totalExams: 1248,
  examMoM: -7.6,
  drugConsumptionCi: 78.2,
  drugDailyCi: 2.76,
  utilizationAvg: 77.4,
  positiveRate: 67.8,
  positiveMoM: 1.0,
  avgSuv: 6.1,
  suvRange: [2.1, 12.8],
};

const nuclearDaily = Array.from({ length: 30 }, (_, i) => ({
  date: `06-${String(i + 1).padStart(2, '0')}`,
  exams: 22 + Math.round(24 * (1 - Math.abs(i - 15) / 20) + Math.random() * 8),
  petct: Math.round((22 + Math.round(24 * (1 - Math.abs(i - 15) / 20) + Math.random() * 8)) * 0.42),
  spect: Math.round((22 + Math.round(24 * (1 - Math.abs(i - 15) / 20) + Math.random() * 8)) * 0.31),
  drug: 1400 + Math.round((22 + Math.round(24 * (1 - Math.abs(i - 15) / 20) + Math.random() * 8)) * 30),
  positive: Math.round((60 + Math.random() * 14) * 10) / 10,
  suvAvg: Math.round((4.9 + Math.random() * 2.3) * 10) / 10,
  utilization: Math.round(40 + Math.random() * 55),
}));

const nuclearMonthly = [
  { month: '1月', exams: 1180, positive: 62.3, utilization: 72 },
  { month: '2月', exams: 1250, positive: 63.8, utilization: 75 },
  { month: '3月', exams: 1320, positive: 65.2, utilization: 78 },
  { month: '4月', exams: 1280, positive: 64.5, utilization: 76 },
  { month: '5月', exams: 1350, positive: 66.8, utilization: 80 },
  { month: '6月', exams: 1248, positive: 67.8, utilization: 77 },
];

const nuclearDevices = [
  { name: 'PET-CT 1', model: 'GE Discovery MI', exams: 328, utilization: 92, positive: 71.5, avgSuv: 6.8, status: 'running' },
  { name: 'PET-CT 2', model: '西门子Biography', exams: 285, utilization: 88, positive: 69.2, avgSuv: 6.4, status: 'running' },
  { name: 'SPECT 1', model: 'GE Discovery NM', exams: 245, utilization: 76, positive: 58.3, avgSuv: 3.2, status: 'running' },
  { name: 'SPECT 2', model: '西门子Symbia', exams: 168, utilization: 68, positive: 55.8, avgSuv: 3.0, status: 'maintenance' },
  { name: '回旋加速器', model: '西门子Eclipse', cycles: 62, utilization: 85, output: 48520, purity: 98.5, status: 'running' },
];

const nuclearSuv = {
  avg: 6.1, max: 12.8, min: 2.1, std: 2.3, tumorAvg: 7.8, inflammationAvg: 3.2, threshold: 4.5,
  distribution: [
    { range: '0-2', count: 8 }, { range: '2-4', count: 22 }, { range: '4-6', count: 45 },
    { range: '6-8', count: 38 }, { range: '8-10', count: 18 }, { range: '>10', count: 7 },
  ],
};

const nuclearDrugs = [
  { name: '¹⁸F-FDG', consumption: 48520, unit: 'mCi', percent: 62, color: '#0891b2', usage: 'PET-CT显像' },
  { name: '⁹⁹mTc-MDP', consumption: 18250, unit: 'mCi', percent: 23, color: '#3b82f6', usage: '骨扫描' },
  { name: '¹³¹I', consumption: 5800, unit: 'mCi', percent: 7, color: '#8b5cf6', usage: '甲状腺' },
  { name: '¹¹C-PIB', consumption: 3200, unit: 'mCi', percent: 4, color: '#22c55e', usage: '淀粉样显像' },
  { name: '其他', consumption: 2430, unit: 'mCi', percent: 4, color: '#94a3b8', usage: '杂项' },
];

const nuclearStatsHandlers = [
  http.get(`${API_BASE}/nuclear-stats/summary`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: nuclearSummary });
  }),
  http.get(`${API_BASE}/nuclear-stats/daily`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: nuclearDaily });
  }),
  http.get(`${API_BASE}/nuclear-stats/monthly`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: nuclearMonthly });
  }),
  http.get(`${API_BASE}/nuclear-stats/devices`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: nuclearDevices });
  }),
  http.get(`${API_BASE}/nuclear-stats/suv`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: nuclearSuv });
  }),
  http.get(`${API_BASE}/nuclear-stats/drugs`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: nuclearDrugs });
  }),
];

// ───────────────────────── V3 集成列表 (补齐缺失 GET 端点) ─────────────────────────
const v3IntegrationListHandlers = [
  http.get(`${API_BASE}/integration/fhir`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'fhir-001', resourceType: 'DiagnosticReport', status: 'final', patientId: 'P001', createdAt: new Date().toISOString() },
        { id: 'fhir-002', resourceType: 'ImagingStudy', status: 'current', patientId: 'P002', createdAt: new Date().toISOString() },
        { id: 'fhir-003', resourceType: 'Patient', status: 'active', patientId: 'P003', createdAt: new Date().toISOString() },
      ],
    });
  }),
  http.get(`${API_BASE}/integration/webhooks`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'wh-001', name: '门诊系统回调', url: 'https://his.hospital.com/webhook', event: 'report.signed', status: 'active' },
        { id: 'wh-002', name: '短信通知', url: 'https://sms.provider/webhook', event: 'critical.created', status: 'active' },
        { id: 'wh-003', name: '科研平台', url: 'https://research.hospital.com/hook', event: 'study.completed', status: 'inactive' },
      ],
    });
  }),
];

// ───────────────────────── V3 AI 草稿 / 质控报告 (补齐缺失 GET 端点) ─────────────────────────
const v3AiQualityListHandlers = [
  http.get(`${API_BASE}/ai-assist/drafts`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'aid-001', reportId: 'RPT-2026001', status: 'draft', riskLevel: 'low', differential: ['肺结节', '炎性假瘤'], createdAt: new Date().toISOString() },
        { id: 'aid-002', reportId: 'RPT-2026002', status: 'confirmed', riskLevel: 'medium', differential: ['气胸', '肺大疱'], createdAt: new Date().toISOString() },
        { id: 'aid-003', reportId: 'RPT-2026003', status: 'draft', riskLevel: 'high', differential: ['主动脉夹层', '肺栓塞'], createdAt: new Date().toISOString() },
      ],
    });
  }),
  http.get(`${API_BASE}/quality/reports`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'qc-001', period: 'month', score: 92.4, publishedAt: new Date().toISOString(), total: 1240, passed: 1150 },
        { id: 'qc-002', period: 'quarter', score: 94.1, publishedAt: new Date().toISOString(), total: 3680, passed: 3462 },
        { id: 'qc-003', period: 'year', score: 93.5, publishedAt: new Date().toISOString(), total: 14850, passed: 13878 },
      ],
    });
  }),
];

export const shellUpgradeHandlers = [
  ...dicomWebHandlers,
  ...criticalAlertHandlers,
  ...srReportHandlers,
  ...nuclearStatsHandlers,
  ...v3IntegrationListHandlers,
  ...v3AiQualityListHandlers,
];
