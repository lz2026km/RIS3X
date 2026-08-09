// [W3-A] /api/v1/diagnosis-accuracy MSW handlers
// [G005 Wave1B P1] 标注更新: 后端已实现 /diagnosis-accuracy 端点 (diagnosis-accuracy.module),
// 本 handler 仅作为 mock 模式兜底演示数据。
//   GET /diagnosis-accuracy
import { http, HttpResponse, delay } from 'msw';
import { DIAGNOSIS_ACCURACY_DATA } from '@data/knowledgeStatsMock';

const API = '/api/v1/diagnosis-accuracy';

export const diagnosisAccuracyHandlers = [
  http.get(`${API}`, async () => {
    await delay(120);
    const d = DIAGNOSIS_ACCURACY_DATA;
    return HttpResponse.json({
      success: true,
      data: {
        source: 'demo',
        generatedAt: new Date().toISOString(),
        data: {
          period: d.period,
          totalReports: d.totalReports,
          pathConfirmed: d.pathConfirmed,
          clinicalConfirmed: d.clinicalConfirmed,
          imagingFollowupConfirmed: d.imagingFollowupConfirmed,
          totalConfirmed: d.totalConfirmed,
          accuracyRate: d.accuracyRate,
          sensitivity: d.sensitivity,
          specificity: d.specificity,
          positivePredictiveValue: d.positivePredictiveValue,
          negativePredictiveValue: d.negativePredictiveValue,
          byModality: d.byModality,
          byDisease: d.byDisease,
        },
      },
    });
  }),
];
