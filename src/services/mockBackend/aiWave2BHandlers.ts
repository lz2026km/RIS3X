/**
 * G005 v3.0.6.11-88 Wave 2B-2 — 交互回归缺失 AI 端点 MSW handlers
 * 覆盖 (此前 pass-through → 后端 404/500):
 *   GET  /ai/providers                 (AiProvidersPage)
 *   GET  /ai/draft/patients            (AiDraftPage 患者列表)
 *   GET  /ai/draft/templates           (AiDraftPage 模板)
 */
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

export const aiWave2BHandlers = [
  http.get(`${API}/ai/providers`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: { providers: ['deepseek', 'openai', 'anthropic', 'mock-local'], active: 'deepseek' },
    });
  }),

  http.get(`${API}/ai/draft/patients`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'P001', name: '张三', gender: '男', age: 45 },
        { id: 'P002', name: '李娜', gender: '女', age: 38 },
        { id: 'P003', name: '王伟', gender: '男', age: 62 },
        { id: 'TMP001', name: '演示患者', gender: '男', age: 45 },
      ],
    });
  }),

  http.get(`${API}/ai/draft/patients/:patientId/exams`, async ({ params }) => {
    await delay(delayMs());
    const pid = params.patientId as string;
    return HttpResponse.json({
      success: true,
      data: [
        { id: `EX-${pid}-1`, patientId: pid, modality: 'CT', bodyPart: '胸部', date: '2026-07-01', description: '胸部CT平扫' },
        { id: `EX-${pid}-2`, patientId: pid, modality: 'DR', bodyPart: '胸部', date: '2026-06-20', description: '胸部正位片' },
      ],
    });
  }),

  http.get(`${API}/ai/draft/templates`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const modality = url.searchParams.get('modality') || 'CT';
    return HttpResponse.json({
      success: true,
      data: {
        templates: [
          { id: 'tpl-chest-ct', name: '胸部CT平扫报告', modality, bodyPart: '胸部', description: '标准胸部CT模板', sections: ['影像所见', '影像诊断', '建议'] },
          { id: 'tpl-head-mr', name: '头颅MRI报告', modality: 'MR', bodyPart: '头颅', description: '标准头颅MRI模板', sections: ['影像所见', '影像诊断', '建议'] },
          { id: 'tpl-spine-mr', name: '脊柱MRI报告', modality: 'MR', bodyPart: '脊柱', description: '标准脊柱MRI模板', sections: ['影像所见', '影像诊断', '建议'] },
        ],
      },
    });
  }),
];
