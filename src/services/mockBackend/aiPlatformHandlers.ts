// [v3.0.6.11-7] /api/v1/ai-platform MSW handlers
// [W1-D] 结构化报告/编排/融合/辅助/市场 对齐 backend aiplatform.service:
//   所有端点返回 { data: [...] } (审计记录数组), 记录字段与 Prisma AuditLog 一致。
// 注意: /models /jobs /workflow/* 由 aiOrchestratorHandlers 处理 (注册顺序在前)。
import { http, HttpResponse, delay } from 'msw';
import { list, get } from './store';
import { parseQuery, applyQuery } from './queryBuilder';

const API = '/api/v1/ai-platform';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);
const now = () => new Date().toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

interface PlatformRecord {
  id: string;
  action: string;
  resource: string;
  detail: Record<string, unknown>;
  tenantId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

// ==================== 内存种子 (与 backend auditLog 语义一致) ====================
let structuredReports: PlatformRecord[] = [
  {
    id: 'SR-001', action: 'GENERATE', resource: 'ai-structured-report',
    detail: {
      studyId: 'EX-5001', templateId: 'TPL-CHEST-CT',
      findings: ['右肺上叶可见一约 8mm 磨玻璃结节', '双肺纹理清晰，未见实变'],
      additionalContext: { modality: 'CT', priority: 'NORMAL' },
    },
    createdAt: hoursAgo(5),
  },
  {
    id: 'SR-002', action: 'GENERATE', resource: 'ai-structured-report',
    detail: {
      studyId: 'EX-5012', templateId: 'TPL-DR-FRACTURE',
      findings: ['左桡骨远端见透亮骨折线，无明显移位'],
    },
    createdAt: hoursAgo(26),
  },
];

let orchestrations: PlatformRecord[] = [
  {
    id: 'ORCH-001', action: 'CREATE', resource: 'ai-orchestration',
    detail: {
      workflowName: '胸部CT结节智能闭环',
      trigger: 'ON_STUDY_COMPLETE',
      steps: [
        { order: 1, action: 'ai_detection', params: { modelId: 'MOD-001' } },
        { order: 2, action: 'report_draft', params: { template: 'TPL-CHEST-CT' } },
        { order: 3, action: 'human_review', params: {} },
      ],
    },
    createdAt: hoursAgo(20),
  },
];

let fusionJobs: PlatformRecord[] = [
  {
    id: 'FUS-001', action: 'FUSION', resource: 'ai-fusion',
    detail: {
      primarySeries: 'SR-PET-001', secondarySeries: 'SR-CT-001',
      type: 'PET_CT', status: 'COMPLETED', resultPath: '/data/fusion/FUS-001.nii.gz',
      params: { method: 'rigid', opacity: 0.6 },
    },
    createdAt: hoursAgo(3),
  },
  {
    id: 'FUS-002', action: 'FUSION', resource: 'ai-fusion',
    detail: {
      primarySeries: 'SR-MR-012', secondarySeries: 'SR-PET-003',
      type: 'MR_PET', status: 'RUNNING', resultPath: null,
      params: { method: 'affine' },
    },
    createdAt: hoursAgo(0.5),
  },
  {
    id: 'FUS-003', action: 'FUSION', resource: 'ai-fusion',
    detail: {
      primarySeries: 'SR-CT-045', secondarySeries: 'SR-CT-045A',
      type: 'CT_CTA', status: 'QUEUED', resultPath: null,
    },
    createdAt: hoursAgo(0.2),
  },
];

let assistTemplates: PlatformRecord[] = [
  {
    id: 'AS-001', action: 'SUGGEST', resource: 'ai-assist',
    detail: {
      title: '所见-印象一致性检查',
      category: 'quality', level: 'WARN',
      suggestion: '检查所见中描述了磨玻璃结节，但诊断印象未提及，建议补充影像所见与诊断结论的一致性描述。',
      applicableTo: 'CT 肺结节',
    },
    createdAt: hoursAgo(72),
  },
  {
    id: 'AS-002', action: 'SUGGEST', resource: 'ai-assist',
    detail: {
      title: '鉴别诊断建议',
      category: 'diagnosis', level: 'INFO',
      suggestion: '根据右肺 8mm 磨玻璃结节影像特征，建议鉴别诊断：原位腺癌、微浸润腺癌、炎性结节，可结合 PET-CT 代谢活性进一步评估。',
      applicableTo: 'CT 肺结节',
    },
    createdAt: hoursAgo(72),
  },
  {
    id: 'AS-003', action: 'SUGGEST', resource: 'ai-assist',
    detail: {
      title: '随访建议模板',
      category: 'followup', level: 'INFO',
      suggestion: '建议 3-6 个月后复查 CT，观察结节大小及密度变化；若稳定可延长至 12 个月随访。',
      applicableTo: '肺结节随访',
    },
    createdAt: hoursAgo(72),
  },
  {
    id: 'AS-004', action: 'SUGGEST', resource: 'ai-assist',
    detail: {
      title: '危急值提示',
      category: 'critical', level: 'CRITICAL',
      suggestion: '检出主动脉夹层征象（内膜片），应立即电话通知开单医生并触发危急值上报流程。',
      applicableTo: '急诊 CTA',
    },
    createdAt: hoursAgo(72),
  },
];

let marketplaceApps: PlatformRecord[] = [
  {
    id: 'APP-001', action: 'CATALOG', resource: 'ai-marketplace',
    detail: {
      name: '肺结节智能检测', vendor: 'DeepHealth', category: '检测',
      price: 50000, rating: 4.8, description: '基于深度学习的高精度肺结节检测与随访对比',
    },
    createdAt: hoursAgo(24 * 15),
  },
  {
    id: 'APP-002', action: 'CATALOG', resource: 'ai-marketplace',
    detail: {
      name: '骨龄评估 AI', vendor: 'Siemens Healthineers', category: '定量分析',
      price: 80000, rating: 4.6, description: '儿童骨龄自动评估与生长预测',
    },
    createdAt: hoursAgo(24 * 10),
  },
  {
    id: 'APP-003', action: 'CATALOG', resource: 'ai-marketplace',
    detail: {
      name: '乳腺钼靶筛查助手', vendor: 'Lunit', category: '筛查',
      price: 120000, rating: 4.9, description: '乳腺 X 线异常征象自动筛查与 BI-RADS 分级建议',
    },
    createdAt: hoursAgo(24 * 7),
  },
  {
    id: 'APP-004', action: 'CATALOG', resource: 'ai-marketplace',
    detail: {
      name: '脑卒中 ASPECTS 评分', vendor: 'Aidoc', category: '定量分析',
      price: 60000, rating: 4.5, description: '急性缺血性卒中 ASPECTS 自动评分，辅助溶栓决策',
    },
    createdAt: hoursAgo(24 * 4),
  },
];

// ==================== [G005 demo-fill] AI 定量/模型注册 demo 数据 (确定性, 无 Math.random) ====================
// 20 条容积病灶测量: 挂接 store 'exams' 检查 (examId/patientId/studyUID 同源), 含 seriesUID 与逐病灶体积 mm³
// 15 条定量模型注册行: 名称 / AUC(mAP) / 状态 / 最近运行时间
interface QuantLesionMeasurement {
  id: string;
  examId: string;
  reportId: string | null;
  accessionNumber: string | null;
  patientId: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  studyUID: string;
  seriesUID: string;
  lesionIndex: number;
  lesionType: string;
  location: string;
  longestAxisMm: number;
  shortAxisMm: number;
  voxelSpacingMm: { x: number; y: number; z: number };
  voxelCount: number;
  voxelVolumeMm3: number;
  lesionVolumeMm3: number;
  lesionVolumeMl: number;
  meanDensityHu: number;
  modelId: string;
  measuredAt: string;
}

interface QuantModelRegistryRow {
  id: string;
  name: string;
  version: string;
  vendor: string;
  category: string;
  modality: string;
  metricName: 'AUC' | 'mAP' | 'Dice';
  metricValue: number;
  status: 'DEPLOYED' | 'VALIDATING' | 'REGISTERED' | 'RETIRED' | 'FAILED';
  lastRunAt: string;
  lastRunResult: string;
  inferenceCount: number;
  avgLatencyMs: number;
}

function quantHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function quantStudyUid(exam: any): string {
  const raw = String(exam?.studyInstanceUID ?? exam?.studyInstanceUid ?? exam?.studyUID ?? exam?.studyUid ?? '');
  if (raw) return raw;
  const key = String(exam?.accessionNumber || exam?.reportId || exam?.examId || exam?.id || 'unknown');
  return `1.2.826.0.1.3680043.8.498.${quantHash(key)}`;
}

const QUANT_LESION_TYPES = ['实性结节', '磨玻璃结节', '混合磨玻璃结节', '肿大淋巴结', '占位病变', '骨破坏灶'];
const QUANT_LESION_LOCATIONS = ['右肺上叶', '右肺中叶', '右肺下叶', '左肺上叶', '左肺下叶', '纵隔 4R 组', '肝右叶', '双侧肾上腺', '腰椎椎体', '甲状腺右叶'];
// 20 条病灶分布在 13 例检查上 (floor(i*13/20) → 0..12, 部分检查含 2 处病灶)
const QUANT_EXAM_PLAN = Array.from({ length: 20 }, (_, i) => Math.floor((i * 13) / 20));

let quantLesionCache: QuantLesionMeasurement[] | null = null;
function getQuantLesionMeasurements(): QuantLesionMeasurement[] {
  if (quantLesionCache) return quantLesionCache;
  const exams = list<any>('exams');
  const rows = exams.filter((e: any) => e && (e.patientId || e.patientName));
  const withAccession = rows.filter((e: any) => Boolean(e.accessionNumber));
  const pool = (withAccession.length >= 13 ? withAccession : rows)
    .slice()
    .sort((a: any, b: any) => String(a.accessionNumber ?? a.id ?? a.reportId ?? '').localeCompare(String(b.accessionNumber ?? b.id ?? b.reportId ?? '')));
  const picked: any[] = [];
  const used = new Set<string>();
  const step = pool.length / 13;
  for (let i = 0; i < 13; i++) {
    const exam = pool[Math.min(pool.length - 1, Math.floor(i * step))];
    if (!exam) break;
    const key = String(exam.id ?? exam.reportId ?? exam.accessionNumber ?? i);
    if (used.has(key)) continue;
    used.add(key);
    picked.push(exam);
  }
  quantLesionCache = QUANT_EXAM_PLAN.map((examIdx, i) => {
    const exam = picked[examIdx] ?? picked[picked.length - 1 - examIdx] ?? picked[0];
    const baseKey = String(exam?.id ?? exam?.reportId ?? exam?.accessionNumber ?? `quant-${i}`);
    const h = quantHash(`${baseKey}:${i}`);
    const lesionIndex = QUANT_EXAM_PLAN.slice(0, i).filter((v) => v === examIdx).length + 1;
    const sx = Math.round((0.5 + (h % 5) * 0.1) * 100) / 100; // 0.50-0.90mm
    const sy = Math.round((0.5 + ((h >>> 3) % 5) * 0.1) * 100) / 100;
    const sz = Math.round((0.625 + ((h >>> 6) % 8) * 0.625) * 1000) / 1000; // 0.625-5.0mm
    const voxelVolumeMm3 = Math.round(sx * sy * sz * 1e6) / 1e6;
    const longestAxisMm = Math.round((3.2 + ((h >>> 9) % 280) / 10) * 10) / 10; // 3.2-31.1mm
    const shortAxisMm = Math.round(longestAxisMm * (0.52 + ((h >>> 12) % 40) / 100) * 10) / 10;
    const minorAxisMm = Math.round(shortAxisMm * (0.7 + ((h >>> 16) % 25) / 100) * 10) / 10;
    // 椭球体积近似: V = π/6 · a · b · c
    const ellipsoidMm3 = (Math.PI / 6) * longestAxisMm * shortAxisMm * minorAxisMm;
    const voxelCount = Math.max(8, Math.round(ellipsoidMm3 / voxelVolumeMm3));
    const lesionVolumeMm3 = Math.round(voxelCount * voxelVolumeMm3 * 100) / 100;
    const studyUID = quantStudyUid(exam);
    return {
      id: `VLM-${String(i + 1).padStart(3, '0')}`,
      examId: String(exam?.id ?? exam?.reportId ?? ''),
      reportId: exam?.reportId ? String(exam.reportId) : null,
      accessionNumber: exam?.accessionNumber ? String(exam.accessionNumber) : null,
      patientId: String(exam?.patientId ?? ''),
      patientName: String(exam?.patientName ?? exam?.name ?? '未知患者'),
      modality: String(exam?.modality ?? 'CT').toUpperCase(),
      bodyPart: String(exam?.bodyPart ?? exam?.examItemName ?? ''),
      studyUID,
      seriesUID: `${studyUID}.${100 + lesionIndex}`,
      lesionIndex,
      lesionType: QUANT_LESION_TYPES[h % QUANT_LESION_TYPES.length]!,
      location: QUANT_LESION_LOCATIONS[(h >>> 4) % QUANT_LESION_LOCATIONS.length]!,
      longestAxisMm,
      shortAxisMm,
      voxelSpacingMm: { x: sx, y: sy, z: sz },
      voxelCount,
      voxelVolumeMm3,
      lesionVolumeMm3,
      lesionVolumeMl: Math.round(lesionVolumeMm3 / 100) / 10,
      meanDensityHu: Math.round(-900 + ((h >>> 18) % 1400) - 200),
      modelId: `QMOD-${String((h % 6) + 1).padStart(2, '0')}`,
      measuredAt: hoursAgo(1 + (i % 20) * 5),
    };
  });
  return quantLesionCache;
}

const QUANT_MODEL_SEED: Array<Omit<QuantModelRegistryRow, 'metricValue' | 'lastRunAt' | 'lastRunResult' | 'inferenceCount' | 'avgLatencyMs'>> = [
  { id: 'QMOD-01', name: '肺结节体积定量 (LungVol)', version: '3.1.0', vendor: 'DeepHealth', category: '结节定量', modality: 'CT', metricName: 'AUC', status: 'DEPLOYED' },
  { id: 'QMOD-02', name: '磨玻璃结节密度分析 (GGN-Dens)', version: '2.0.4', vendor: '推想医疗', category: '结节定量', modality: 'CT', metricName: 'AUC', status: 'DEPLOYED' },
  { id: 'QMOD-03', name: '脑萎缩容量测量 (BrainVol)', version: '1.8.2', vendor: 'Siemens Healthineers', category: '器官容量', modality: 'MR', metricName: 'Dice', status: 'DEPLOYED' },
  { id: 'QMOD-04', name: '海马体积定量 (HippocampVol)', version: '1.4.0', vendor: 'Aidoc', category: '器官容量', modality: 'MR', metricName: 'Dice', status: 'VALIDATING' },
  { id: 'QMOD-05', name: '肝脏分割与体积计算 (LiverVol)', version: '2.2.1', vendor: '联影智能', category: '器官容量', modality: 'CT', metricName: 'Dice', status: 'DEPLOYED' },
  { id: 'QMOD-06', name: '骨密度 QCT 定量 (BMD-QCT)', version: '1.0.6', vendor: 'Mindray', category: '骨密度', modality: 'CT', metricName: 'AUC', status: 'REGISTERED' },
  { id: 'QMOD-07', name: '冠脉钙化积分 (CAC-Agatston)', version: '3.3.0', vendor: 'GE HealthCare', category: '钙化积分', modality: 'CT', metricName: 'AUC', status: 'DEPLOYED' },
  { id: 'QMOD-08', name: '主动脉夹层假腔容积 (AD-LumenVol)', version: '1.2.5', vendor: '数坤科技', category: '血管定量', modality: 'CTA', metricName: 'Dice', status: 'VALIDATING' },
  { id: 'QMOD-09', name: '乳腺肿块体积与 BI-RADS (MammoVol)', version: '4.1.2', vendor: 'Lunit', category: '肿块定量', modality: 'MG', metricName: 'mAP', status: 'DEPLOYED' },
  { id: 'QMOD-10', name: '肋骨骨折检出 (RibFx-Detect)', version: '2.5.0', vendor: 'AIMed Vision', category: '骨折检测', modality: 'CT', metricName: 'mAP', status: 'DEPLOYED' },
  { id: 'QMOD-11', name: '肺气肿 LAA% 定量 (Emphysema-LAA)', version: '1.9.3', vendor: 'PulmoQuant', category: '肺功能定量', modality: 'CT', metricName: 'AUC', status: 'DEPLOYED' },
  { id: 'QMOD-12', name: '甲状腺结节 TI-RADS 分级 (TI-RADS-AI)', version: '2.0.0', vendor: '推想医疗', category: '分级', modality: 'US', metricName: 'AUC', status: 'REGISTERED' },
  { id: 'QMOD-13', name: '前列腺 PI-RADS 分级 (PI-RADS-AI)', version: '1.1.4', vendor: '联影智能', category: '分级', modality: 'MR', metricName: 'AUC', status: 'VALIDATING' },
  { id: 'QMOD-14', name: '脑卒中 ASPECTS 定量 (ASPECTS-AI)', version: '1.5.3', vendor: 'Aidoc', category: '评分定量', modality: 'CT', metricName: 'mAP', status: 'FAILED' },
  { id: 'QMOD-15', name: '骨龄评估定量 (BoneAge-Q)', version: '1.0.2', vendor: 'Siemens Healthineers', category: '发育定量', modality: 'DR', metricName: 'mAP', status: 'RETIRED' },
];

let quantModelCache: QuantModelRegistryRow[] | null = null;
function getQuantModelRegistry(): QuantModelRegistryRow[] {
  if (quantModelCache) return quantModelCache;
  quantModelCache = QUANT_MODEL_SEED.map((m, i) => {
    const h = quantHash(m.id);
    const metricBase = m.metricName === 'Dice' ? 0.78 : 0.85;
    const metricSpan = m.metricName === 'Dice' ? 0.19 : 0.14;
    const metricValue = Math.round((metricBase + ((h % 1000) / 1000) * metricSpan) * 1000) / 1000;
    const lastRunHoursAgo = m.status === 'RETIRED' ? 24 * (30 + (i % 20)) : 1 + (i % 6) * 5;
    const pass = m.status === 'DEPLOYED' || m.status === 'VALIDATING';
    return {
      ...m,
      metricValue,
      lastRunAt: hoursAgo(lastRunHoursAgo),
      lastRunResult: pass ? `通过 (${m.metricName} ${metricValue})` : m.status === 'FAILED' ? '失败 (验证集 Dice 下降 8.2%)' : m.status === 'RETIRED' ? '已停用 (转归档)' : '待最近一次运行',
      inferenceCount: m.status === 'DEPLOYED' ? 420 + (h % 3800) : m.status === 'VALIDATING' ? 60 + (h % 240) : 0,
      avgLatencyMs: 320 + (h % 2100),
    };
  });
  return quantModelCache;
}

// ==================== handlers ====================
// [G005 v3.0.6.11-101 Wave 1B (G-10)] 降噪处理历史 (内存, 对齐 backend ring buffer)
let denoiseHistoryStore: Array<Record<string, unknown>> = [];

export const aiPlatformHandlers = [
  http.get(`${API}/models`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('models' as never); } catch {}
    if (!items.length) items = [{"id":"AI001","name":"肺结节检测","version":"2.3","status":"DEPLOYED","accuracy":96.5}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/models/:id`, async ({ params }) => {
    await delay(delayMs());
    let item: any = null;
    try { item = get<any>('model' as never, params.id as string); } catch {}
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
  http.get(`${API}/qc`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try { items = list<any>('results' as never); } catch {}
    if (!items.length) items = [{"id":"AIQC001","patientName":"张三","aiScore":95,"humanScore":93}];
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  http.get(`${API}/qc/:id`, async ({ params }) => {
    await delay(delayMs());
    const id = String(params.id ?? '');
    const fallback = [{ "id": "AIQC001", "patientName": "张三", "aiScore": 95, "humanScore": 93 }];
    const item = fallback.find((r) => r.id === id) ?? { id, patientName: '未知患者', aiScore: 0, humanScore: 0, notFound: true };
    return HttpResponse.json({ success: true, data: item });
  }),
  http.get(`${API}/medical-devices`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('devices'); } catch {}
    return HttpResponse.json({ success: true, data: items });
  }),

  // ----- [W1-B] 平台统计 (对齐后端 GET /ai-platform/stats) -----
  http.get(`${API}/stats`, async () => {
    await delay(delayMs());
    const dailyUsage = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86400000);
      return { date: d.toISOString().slice(0, 10), count: 3 + ((i * 7) % 12) };
    });
    return HttpResponse.json({
      success: true,
      data: {
        totalModels: 6,
        activeModels: 3,
        totalInferences: 9,
        avgLatencyMs: 1240,
        successRate: 91.5,
        dailyUsage,
      },
    });
  }),

  // ----- [W1-D] 结构化报告 (对齐 backend auditLog resource=ai-structured-report) -----
  http.get(`${API}/structured-reports`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const items = structuredReports
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),

  http.post(`${API}/structured-reports`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as Record<string, unknown>;
    const record: PlatformRecord = {
      id: body.id ? String(body.id) : `SR-${Date.now().toString(36).toUpperCase()}`,
      action: 'GENERATE',
      resource: 'ai-structured-report',
      detail: {
        studyId: String(body.studyId ?? ''),
        templateId: String(body.templateId ?? ''),
        findings: Array.isArray(body.findings) ? body.findings : [],
        additionalContext: body.additionalContext ?? undefined,
      },
      createdAt: now(),
    };
    structuredReports = [record, ...structuredReports];
    return HttpResponse.json({ success: true, data: [record] }, { status: 201 });
  }),

  // ----- [W1-D] AI 编排 (对齐 backend auditLog resource=ai-orchestration) -----
  http.get(`${API}/orchestration`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const items = orchestrations
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),

  http.post(`${API}/orchestration`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as Record<string, unknown>;
    const record: PlatformRecord = {
      id: body.id ? String(body.id) : `ORCH-${Date.now().toString(36).toUpperCase()}`,
      action: 'CREATE',
      resource: 'ai-orchestration',
      detail: {
        workflowName: String(body.workflowName ?? '未命名编排'),
        steps: Array.isArray(body.steps) ? body.steps : [],
        trigger: body.trigger ?? 'MANUAL',
      },
      createdAt: now(),
    };
    orchestrations = [record, ...orchestrations];
    return HttpResponse.json({ success: true, data: [record] }, { status: 201 });
  }),

  // ----- [W1-D] 融合工作区 (对齐 backend auditLog resource=ai-fusion, FusionJob 语义) -----
  http.get(`${API}/fusion`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const items = fusionJobs
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),

  // ----- [W1-D] AI 辅助建议模板 (对齐 backend auditLog resource=ai-assist) -----
  http.get(`${API}/assist`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const result = applyQuery(assistTemplates, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),

  // ----- [W1-D] 模型市场 (对齐 backend auditLog resource=ai-marketplace) -----
  http.get(`${API}/marketplace`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const result = applyQuery(marketplaceApps, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),

  // ----- [G005 demo-fill] AI 定量中心: 容积病灶测量 (20 条, 挂接 store exams) -----
  // 注意: /models 与 /models/:id 由 aiOrchestratorHandlers 更前置注册, 定量模型注册表走 /quant/models
  http.get(`${API}/quant/lesions`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const items = getQuantLesionMeasurements()
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id));
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),

  http.get(`${API}/quant/lesions/stats`, async () => {
    await delay(delayMs(30, 90));
    const items = getQuantLesionMeasurements();
    const totalVolumeMm3 = items.reduce((s, m) => s + m.lesionVolumeMm3, 0);
    const byModality = new Map<string, { modality: string; lesions: number; volumeMl: number }>();
    const byModel = new Map<string, { modelId: string; lesions: number; volumeMl: number }>();
    for (const m of items) {
      const mod = byModality.get(m.modality) ?? { modality: m.modality, lesions: 0, volumeMl: 0 };
      mod.lesions += 1;
      mod.volumeMl = Math.round((mod.volumeMl + m.lesionVolumeMl) * 10) / 10;
      byModality.set(m.modality, mod);
      const mdl = byModel.get(m.modelId) ?? { modelId: m.modelId, lesions: 0, volumeMl: 0 };
      mdl.lesions += 1;
      mdl.volumeMl = Math.round((mdl.volumeMl + m.lesionVolumeMl) * 10) / 10;
      byModel.set(m.modelId, mdl);
    }
    return HttpResponse.json({
      success: true,
      data: {
        totalMeasurements: items.length,
        studyCount: new Set(items.map((m) => m.examId)).size,
        totalVolumeMm3: Math.round(totalVolumeMm3 * 100) / 100,
        totalVolumeMl: Math.round(totalVolumeMm3 / 100) / 10,
        avgLesionVolumeMl: items.length ? Math.round((totalVolumeMm3 / items.length / 100) * 10) / 10 : 0,
        byModality: [...byModality.values()].sort((a, b) => b.lesions - a.lesions),
        byModel: [...byModel.values()].sort((a, b) => b.lesions - a.lesions),
      },
    });
  }),

  // ----- [G005 demo-fill] AI 定量模型注册表 (15 条: 名称/AUC(mAP)/状态/最近运行) -----
  http.get(`${API}/quant/models`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const items = getQuantModelRegistry();
    const result = applyQuery(items, opts);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),

  http.get(`${API}/quant/models/stats`, async () => {
    await delay(delayMs(30, 90));
    const items = getQuantModelRegistry();
    const byStatus: Record<string, number> = {};
    let totalInferences = 0;
    for (const m of items) {
      byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
      totalInferences += m.inferenceCount;
    }
    return HttpResponse.json({
      success: true,
      data: {
        totalModels: items.length,
        deployedModels: byStatus['DEPLOYED'] ?? 0,
        validatingModels: byStatus['VALIDATING'] ?? 0,
        byStatus,
        totalInferences,
        avgMetric: Math.round((items.reduce((s, m) => s + m.metricValue, 0) / Math.max(1, items.length)) * 1000) / 1000,
      },
    });
  }),

  // ----- [G005 v3.0.6.11-90 Wave 4B (G-10)] DL 降噪 (对齐 backend aiplatform.service.denoiseImage) -----
  // SW 环境无 canvas: 返回服务端指标, 图像由页面本地确定性滤波渲染 (标注 msw 模拟)
  http.post(`${API}/denoise`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    await delay(delayMs(180, 420));
    const strength = Math.max(0, Math.min(100, Number(body?.strength ?? 50)));
    const modelId = String(body?.modelId ?? 'unet');
    const kernel = String(body?.kernel ?? 'median');
    const preset = String(body?.preset ?? 'standard');
    const psnr = Math.round((22 + (100 - strength) * 0.16) * 10) / 10;
    const ssim = Math.round(Math.min(0.98, 0.7 + (100 - strength) * 0.0024) * 1000) / 1000;
    return HttpResponse.json({
      success: true,
      data: {
        denoisedBase64: null,
        psnr,
        ssim,
        elapsedMs: 160 + Math.round(strength * 4),
        algorithm: `${kernel} (msw 模拟)`,
        source: 'msw',
        modelId,
        strength,
        kernel,
        preset,
        noiseReduction: Math.round((1 - strength / 200) * 100) / 100,
        noiseEstimate: { type: 'gaussian', sigma: strength / 4, variance: (strength / 4) ** 2, poissonSigma: 0, snrDb: 15, level: strength, method: 'msw-estimate' },
        width: 256,
        height: 256,
      },
    });
  }),

  // ----- [G005 v3.0.6.11-101 Wave 1B (G-10)] 降噪处理历史 (内存, 对齐 backend) -----
  http.get(`${API}/denoise/history`, async () => {
    await delay(delayMs(20, 80));
    return HttpResponse.json({ success: true, data: denoiseHistoryStore });
  }),

  http.post(`${API}/denoise/history/clear`, async () => {
    await delay(delayMs(20, 60));
    denoiseHistoryStore = [];
    return HttpResponse.json({ success: true, data: { cleared: true, count: 0 } });
  }),
];
