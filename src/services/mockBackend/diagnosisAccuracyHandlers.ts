// [W3-A] /api/v1/diagnosis-accuracy MSW handlers
// 后端暂未实现 → 本地演示数据 (页面标注"演示数据"来源)
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
