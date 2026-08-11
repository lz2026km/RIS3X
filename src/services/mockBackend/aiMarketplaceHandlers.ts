// [W2-B-3] /api/v1/ai-marketplace MSW handlers
// 对齐后端 ai-marketplace.controller (models / models/deploy / models/:id / models/:id/status)
// 页面: /ai-marketplace (AiMarketplacePage)
import { http, HttpResponse, delay } from 'msw';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/ai-marketplace';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

let models: any[] = [
  {
    id: 'MOD-001', name: '肺结节检测模型', version: 'v2.1', modality: 'CT',
    description: '基于深度学习的肺结节自动检测与分类',
    status: 'running', deployedAt: '2026-06-15T08:00:00Z', accuracy: 0.94,
  },
  {
    id: 'MOD-002', name: '骨折识别模型', version: 'v1.8', modality: 'DR',
    description: '四肢骨骼骨折自动识别',
    status: 'running', deployedAt: '2026-05-20T08:00:00Z', accuracy: 0.91,
  },
  {
    id: 'MOD-003', name: '乳腺钼靶辅助诊断', version: 'v3.0', modality: 'MG',
    description: 'BI-RADS 分级辅助评估',
    status: 'stopped', deployedAt: '2026-04-10T08:00:00Z', accuracy: 0.89,
  },
  {
    id: 'MOD-004', name: '头颅MR出血检测', version: 'v1.2', modality: 'MR',
    description: '急性颅内出血快速检测',
    status: 'error', deployedAt: '2026-03-01T08:00:00Z', accuracy: 0.87,
  },
];

export const aiMarketplaceHandlers = [
  http.get(`${API}/models`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: models, meta: { total: models.length } });
  }),

  http.post(`${API}/models/deploy`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const newModel = {
      id: `MOD-${uuidv4().slice(0, 8)}`,
      name: String(body?.name ?? '未命名模型'),
      version: String(body?.version ?? 'v1.0'),
      modality: String(body?.modality ?? 'CT'),
      description: String(body?.description ?? ''),
      status: 'running',
      deployedAt: new Date().toISOString(),
      accuracy: 0.9,
    };
    models = [newModel, ...models];
    return HttpResponse.json({ success: true, data: newModel }, { status: 201 });
  }),

  http.delete(`${API}/models/:id`, async ({ params }) => {
    await delay(delayMs());
    models = models.filter((m) => m.id !== params.id);
    return HttpResponse.json({ success: true, data: { ok: true } });
  }),

  http.get(`${API}/models/:id/status`, async ({ params }) => {
    await delay(delayMs());
    const found = models.find((m) => m.id === params.id);
    if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Model ${params.id} not found` } }, { status: 404 });
    return HttpResponse.json({ success: true, data: { id: found.id, status: found.status, deployedAt: found.deployedAt } });
  }),
];
