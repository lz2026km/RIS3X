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

// ==================== handlers ====================
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
];
