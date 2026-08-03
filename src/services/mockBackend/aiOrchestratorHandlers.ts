// [v3.0.6.11-60] /api/v1/ai-platform AI Orchestrator MSW handlers
// 模型注册 → 部署/下线/测试 → 工作流集成 → 推理任务(队列模拟) → 二次检出结果
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/ai-platform';

const delayMs = (min = 60, max = 200) => Math.floor(Math.random() * (max - min) + min);

const now = () => new Date().toISOString();
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

// ==================== 内存存储 ====================
interface MockModel {
  id: string;
  name: string;
  version: string;
  vendor: string | null;
  category: string | null;
  status: 'REGISTERED' | 'DEPLOYED' | 'UNDEPLOYED' | 'FAILED';
  endpoint: string | null;
  triggerConditions?: Record<string, unknown> | null;
  deployedAt: string | null;
  config?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  deploymentCount: number;
  integrationCount: number;
}

interface MockIntegration {
  id: string;
  modelId: string;
  name: string;
  triggerConditions: Record<string, unknown>;
  targetWorkflow: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface MockJob {
  id: string;
  modelId: string;
  examId: string | null;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  trigger: string;
  result?: { summary?: string; findings?: unknown[]; structured?: Record<string, unknown>; heatmapUrl?: string | null } | null;
  error?: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

let models: MockModel[] = [
  {
    id: 'MOD-001', name: '肺结节检测 (LungNet)', version: '2.3.1', vendor: 'DeepHealth', category: '检测',
    status: 'DEPLOYED', endpoint: 'https://ai.deephealth.local/lungnet/v2', deployedAt: minutesAgo(60 * 24 * 12),
    createdAt: minutesAgo(60 * 24 * 30), updatedAt: minutesAgo(60 * 24 * 12), deploymentCount: 0, integrationCount: 0,
    triggerConditions: { trigger: 'ON_STUDY_COMPLETE', modality: 'CT' },
  },
  {
    id: 'MOD-002', name: '骨折AI辅助诊断 (FracDetect)', version: '3.0.2', vendor: 'Siemens Healthineers', category: '检测',
    status: 'DEPLOYED', endpoint: 'https://ai.siemens.local/fracdetect/v3', deployedAt: minutesAgo(60 * 24 * 8),
    createdAt: minutesAgo(60 * 24 * 40), updatedAt: minutesAgo(60 * 24 * 8), deploymentCount: 0, integrationCount: 0,
  },
  {
    id: 'MOD-003', name: '冠脉狭窄分级 (StenosisGrade)', version: '2.1.0', vendor: 'GE HealthCare', category: '分类',
    status: 'UNDEPLOYED', endpoint: 'https://ai.geh.local/stenosis/v2', deployedAt: null,
    createdAt: minutesAgo(60 * 24 * 18), updatedAt: minutesAgo(60 * 24 * 3), deploymentCount: 0, integrationCount: 0,
  },
  {
    id: 'MOD-004', name: '乳腺钼靶筛查 (MammoAI)', version: '4.0.1', vendor: 'Lunit', category: '筛查',
    status: 'DEPLOYED', endpoint: 'https://ai.lunit.local/mammo/v4', deployedAt: minutesAgo(60 * 24 * 2),
    createdAt: minutesAgo(60 * 24 * 22), updatedAt: minutesAgo(60 * 24 * 2), deploymentCount: 0, integrationCount: 0,
    triggerConditions: { trigger: 'ON_EXAM_CREATE', modality: 'MG' },
  },
  {
    id: 'MOD-005', name: '脑卒中 ASPECTS 评分', version: '1.5.3', vendor: 'Aidoc', category: '定量分析',
    status: 'FAILED', endpoint: 'https://ai.aidoc.local/stroke/v1', deployedAt: null,
    createdAt: minutesAgo(60 * 24 * 10), updatedAt: minutesAgo(60 * 24 * 1), deploymentCount: 0, integrationCount: 0,
  },
  {
    id: 'MOD-006', name: '骨密度定量 (BMD-QCT)', version: '1.0.0', vendor: 'Mindray', category: '定量分析',
    status: 'REGISTERED', endpoint: 'https://ai.mindray.local/bmd/v1', deployedAt: null,
    createdAt: minutesAgo(60 * 6), updatedAt: minutesAgo(60 * 6), deploymentCount: 0, integrationCount: 0,
  },
];

let integrations: MockIntegration[] = [
  {
    id: 'INT-001', modelId: 'MOD-001', name: '胸部CT结节检测自动工作流',
    triggerConditions: { trigger: 'ON_STUDY_COMPLETE', modality: 'CT', bodyPart: 'CHEST' },
    targetWorkflow: 'lung-nodule-auto', status: 'ACTIVE', createdAt: minutesAgo(60 * 24 * 10), updatedAt: minutesAgo(60 * 24 * 10),
  },
  {
    id: 'INT-002', modelId: 'MOD-002', name: 'DR骨折筛查流程',
    triggerConditions: { trigger: 'ON_STUDY_COMPLETE', modality: 'DR' },
    targetWorkflow: 'fracture-screening', status: 'ACTIVE', createdAt: minutesAgo(60 * 24 * 7), updatedAt: minutesAgo(60 * 24 * 7),
  },
  {
    id: 'INT-003', modelId: 'MOD-004', name: '钼靶检查即时AI预筛',
    triggerConditions: { trigger: 'ON_EXAM_CREATE', modality: 'MG' },
    targetWorkflow: 'mammo-prescreen', status: 'ACTIVE', createdAt: minutesAgo(60 * 24 * 2), updatedAt: minutesAgo(60 * 24 * 2),
  },
];

const findingsPool = [
  { label: '可疑结节', x: 0.62, y: 0.38, width: 0.09, height: 0.09, confidence: 0.94 },
  { label: '磨玻璃影', x: 0.3, y: 0.6, width: 0.12, height: 0.1, confidence: 0.87 },
  { label: '骨折线', x: 0.52, y: 0.25, width: 0.14, height: 0.05, confidence: 0.91 },
  { label: '钙化灶', x: 0.72, y: 0.5, width: 0.06, height: 0.06, confidence: 0.82 },
  { label: '低密度区', x: 0.45, y: 0.2, width: 0.08, height: 0.07, confidence: 0.9 },
  { label: '占位病变', x: 0.35, y: 0.68, width: 0.1, height: 0.12, confidence: 0.88 },
];

function buildResult(seedIdx: number) {
  const start = seedIdx % findingsPool.length;
  const count = 1 + (seedIdx % 3);
  const findings = Array.from({ length: count }, (_, i) => {
    return findingsPool[(start + i) % findingsPool.length] ?? findingsPool[0]!;
  });
  return {
    summary: `检出 ${findings.length} 处异常区域`,
    findings,
    structured: {
      radiologistRecommended: true,
      priority: findings.some((f) => f.confidence >= 0.9) ? 'HIGH' : 'NORMAL',
    },
    heatmapUrl: null,
  };
}

let jobs: MockJob[] = Array.from({ length: 9 }, (_, i) => {
  const model = models[i % 3] ?? models[0]!;
  const completed = i % 4 !== 0;
  return {
    id: `JOB-${String(i + 1).padStart(3, '0')}`,
    modelId: model.id,
    examId: `EX-${String(5000 + i)}`,
    status: completed ? 'COMPLETED' : 'QUEUED',
    trigger: i % 2 ? 'ON_STUDY_COMPLETE' : 'MANUAL',
    result: completed ? buildResult(i) : null,
    error: null,
    startedAt: completed ? minutesAgo(6 + i) : null,
    completedAt: completed ? minutesAgo(6 + i - 0.5) : null,
    createdAt: minutesAgo(8 + i),
    updatedAt: completed ? minutesAgo(6 + i - 0.5) : minutesAgo(8 + i),
  };
});

function modelDto(m: MockModel): MockModel {
  return {
    ...m,
    deploymentCount: jobs.filter((j) => j.modelId === m.id).length,
    integrationCount: integrations.filter((it) => it.modelId === m.id).length,
  };
}

function withModel(m: { id: string; name: string; version: string; vendor: string | null; category: string | null; endpoint: string | null }) {
  return {
    id: m.id,
    name: m.name,
    version: m.version,
    vendor: m.vendor,
    category: m.category,
    endpoint: m.endpoint,
  };
}

// ==================== 队列模拟推进器 ====================
function advanceJobs() {
  for (const job of jobs) {
    if (job.status === 'QUEUED' && Date.now() - Date.parse(job.createdAt) > 1200) {
      job.status = 'RUNNING';
      job.startedAt = job.startedAt ?? now();
      job.updatedAt = now();
    } else if (job.status === 'RUNNING' && Date.now() - Date.parse(job.startedAt ?? job.createdAt) > 2600) {
      if (Math.random() < 0.08) {
        job.status = 'FAILED';
        job.error = '推理服务返回非 200 状态';
      } else {
        job.status = 'COMPLETED';
        const idx = parseInt(job.id.replace(/\D/g, '') || '1', 10);
        job.result = buildResult(idx);
      }
      job.completedAt = now();
      job.updatedAt = now();
    }
  }
  jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ==================== handlers ====================
export const aiOrchestratorHandlers = [
  // ----- 模型注册表 -----
  http.get(`${API}/models`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    let items = models.map(modelDto);
    if (status) items = items.filter((m) => m.status === status);
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),

  http.get(`${API}/models/:id`, async ({ params }) => {
    await delay(delayMs(30, 80));
    const model = models.find((m) => m.id === params.id);
    if (!model) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '模型不存在' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: [modelDto(model)] });
  }),

  http.post(`${API}/models`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as Record<string, unknown>;
    const model: MockModel = {
      id: `MOD-${String(models.length + 1).padStart(3, '0')}`,
      name: String(body.name ?? '未命名模型'),
      version: String(body.version ?? '1.0.0'),
      vendor: (body.vendor as string) ?? '未知厂商',
      category: (body.category as string) ?? '通用',
      status: 'REGISTERED',
      endpoint: (body.endpoint as string) ?? null,
      triggerConditions: (body.triggerConditions as Record<string, unknown>) ?? null,
      deployedAt: null,
      config: (body.config as Record<string, unknown>) ?? null,
      createdAt: now(),
      updatedAt: now(),
      deploymentCount: 0,
      integrationCount: 0,
    };
    models = [model, ...models];
    return HttpResponse.json({ success: true, data: [modelDto(model)] }, { status: 201 });
  }),

  http.post(`${API}/models/:id/deploy`, async ({ params }) => {
    await delay(delayMs());
    const model = models.find((m) => m.id === params.id);
    if (!model) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '模型不存在' } }, { status: 404 });
    model.status = 'DEPLOYED';
    model.deployedAt = now();
    model.updatedAt = now();
    return HttpResponse.json({ success: true, data: [modelDto(model)] });
  }),

  http.post(`${API}/models/:id/undeploy`, async ({ params }) => {
    await delay(delayMs());
    const model = models.find((m) => m.id === params.id);
    if (!model) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '模型不存在' } }, { status: 404 });
    model.status = 'UNDEPLOYED';
    model.deployedAt = null;
    model.updatedAt = now();
    return HttpResponse.json({ success: true, data: [modelDto(model)] });
  }),

  http.post(`${API}/models/:id/test`, async ({ params }) => {
    await delay(delayMs(150, 500));
    const model = models.find((m) => m.id === params.id);
    if (!model) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '模型不存在' } }, { status: 404 });
    const latencyMs = Math.round(80 + Math.random() * 600);
    const reachable = model.status !== 'FAILED';
    return HttpResponse.json({
      success: true,
      data: [{
        id: model.id,
        reachable,
        latencyMs,
        timeoutMs: 3000,
        status: reachable ? 'OK' : 'TIMEOUT',
        message: reachable
          ? `${model.name} v${model.version} 连通性测试通过 (${latencyMs}ms)`
          : `${model.name} v${model.version} 响应异常 (${latencyMs}ms)`,
        endpoint: model.endpoint,
        testedAt: now(),
      }],
    });
  }),

  // ----- 工作流集成 -----
  http.get(`${API}/workflow/integrations`, async () => {
    await delay(delayMs());
    const data = integrations.map((it) => {
      const model = models.find((m) => m.id === it.modelId);
      return { ...it, model: model ? withModel(model) : null };
    });
    return HttpResponse.json({ success: true, data, meta: { total: data.length } });
  }),

  http.post(`${API}/workflow/integrations`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as Record<string, unknown>;
    const model = models.find((m) => m.id === body.modelId);
    if (!model) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '所选模型不存在' } }, { status: 400 });
    const integration: MockIntegration = {
      id: `INT-${String(integrations.length + 1).padStart(3, '0')}`,
      modelId: model.id,
      name: (body.name as string) ?? `${model.name} → ${String(body.targetWorkflow)}`,
      triggerConditions: (body.triggerConditions as Record<string, unknown>) ?? {},
      targetWorkflow: String(body.targetWorkflow),
      status: 'ACTIVE',
      createdAt: now(),
      updatedAt: now(),
    };
    integrations = [integration, ...integrations];
    return HttpResponse.json({ success: true, data: [{ ...integration, model: withModel(model) }] }, { status: 201 });
  }),

  http.post(`${API}/workflow/trigger`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as Record<string, unknown>;
    const trigger = String(body.trigger ?? 'MANUAL');
    const examId = String(body.examId ?? 'EX-UNKNOWN');
    const matched = integrations
      .filter((it) => it.status === 'ACTIVE')
      .filter((it) => {
        const c = it.triggerConditions ?? {};
        if (c.trigger && c.trigger !== trigger) return false;
        if (c.modality && c.modality !== body.modality) return false;
        if (c.bodyPart && c.bodyPart !== body.bodyPart) return false;
        return true;
      });
    const created: Array<{ id: string }> = [];
    for (const it of matched) {
      const job: MockJob = {
        id: `JOB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        modelId: it.modelId,
        examId,
        status: 'QUEUED',
        trigger,
        result: null,
        error: null,
        startedAt: null,
        completedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      jobs = [job, ...jobs];
      created.push({ id: job.id });
    }
    return HttpResponse.json({ success: true, data: { trigger, examId, matchedCount: matched.length, jobs: created } });
  }),

  // ----- 推理任务 -----
  http.get(`${API}/jobs`, async ({ request }) => {
    await delay(delayMs());
    advanceJobs();
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const modelId = url.searchParams.get('modelId');
    let items = jobs;
    if (status) items = items.filter((j) => j.status === status);
    if (modelId) items = items.filter((j) => j.modelId === modelId);
    const data = items.map((j) => {
      const model = models.find((m) => m.id === j.modelId);
      return { ...j, model: model ? withModel(model) : null };
    });
    return HttpResponse.json({ success: true, data, meta: { total: data.length } });
  }),

  http.get(`${API}/jobs/:id`, async ({ params }) => {
    await delay(delayMs(30, 80));
    advanceJobs();
    const job = jobs.find((j) => j.id === params.id);
    if (!job) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '任务不存在' } }, { status: 404 });
    const model = models.find((m) => m.id === job.modelId);
    return HttpResponse.json({ success: true, data: [{ ...job, model: model ? withModel(model) : null }] });
  }),

  http.post(`${API}/jobs`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as Record<string, unknown>;
    const model = models.find((m) => m.id === body.modelId);
    if (!model) return HttpResponse.json({ success: false, error: { code: 'MODEL_NOT_DEPLOYED', message: '模型未部署' } }, { status: 400 });
    if (model.status !== 'DEPLOYED') {
      return HttpResponse.json({ success: false, error: { code: 'MODEL_NOT_DEPLOYED', message: `模型 ${model.name} 未部署，无法触发推理` } }, { status: 400 });
    }
    const job: MockJob = {
      id: `JOB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      modelId: model.id,
      examId: String(body.examId ?? 'EX-UNKNOWN'),
      status: 'QUEUED',
      trigger: (body.trigger as string) ?? 'MANUAL',
      result: null,
      error: null,
      startedAt: null,
      completedAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    jobs = [job, ...jobs];
    return HttpResponse.json({ success: true, data: [{ ...job, model: withModel(model) }] }, { status: 201 });
  }),
];
