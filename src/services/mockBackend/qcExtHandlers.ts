// [v3.0.6.11-7] /api/v1/qc MSW handlers
// [Phase 2 MSW 降级] 大部分 qc 端点无前端调用(qcImageAiApi 使用 /qc/image-ai/*,
//   后端已有 /api/qc/image-ai 真实实现),已按 C 类清理。
// [W1-A P0] qcextApi.rateQcImage 路径已对齐后端 POST /qc-ext/image/:id/rate,
//   补一个 MSW handler 防止 mock 模式 404。
import { http, HttpResponse, delay } from 'msw';
import { API_BASE } from '../api/client';

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
];
