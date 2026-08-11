// [Phase 2] /api/v1/fusion MSW handlers — 多模态影像融合（与 fusionApi 对齐）
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/fusion';

const delayMs = (min = 60, max = 200) => Math.floor(Math.random() * (max - min) + min);

// 融合可用序列池（按患者）
const SERIES_POOL: Record<string, any[]> = {
  P000001: [
    { seriesUid: '1.3.6.1.4.1.9590.100.1.1001', modality: 'CT', seriesDescription: 'CT 胸部平扫', instanceCount: 240 },
    { seriesUid: '1.3.6.1.4.1.9590.100.1.2001', modality: 'PET', seriesDescription: 'PET 全身显像', instanceCount: 180 },
    { seriesUid: '1.3.6.1.4.1.9590.100.1.3001', modality: 'MR', seriesDescription: 'MR 胸部 T1 增强', instanceCount: 120 },
  ],
  P000002: [
    { seriesUid: '1.3.6.1.4.1.9590.100.2.1001', modality: 'CT', seriesDescription: 'CT 颅脑平扫', instanceCount: 200 },
    { seriesUid: '1.3.6.1.4.1.9590.100.2.2001', modality: 'PET', seriesDescription: 'PET 脑代谢显像', instanceCount: 160 },
  ],
};

export const fusionHandlers = [
  // 融合研究列表 (fusionApi.list)
  http.get(`${API}`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const patientId = url.searchParams.get('patientId') || '';
    const studies = Object.entries(SERIES_POOL)
      .filter(([pid]) => !patientId || pid === patientId)
      .flatMap(([pid, series]) => [
        {
          id: `study-${pid}`,
          studyUid: `1.3.6.1.4.1.9590.100.study.${pid}`,
          patientName: pid === 'P000001' ? '张伟' : '李娜',
          patientId: pid,
          studyDate: '2026-07-18',
          fixedModality: series[0]?.modality || 'CT',
          movingModality: series[1]?.modality || 'PET',
          status: 'ready',
        },
      ]);
    return HttpResponse.json({ success: true, data: studies, meta: { total: studies.length } });
  }),

  http.get(`${API}/series/:patientId`, async ({ params }) => {
    await delay(delayMs());
    const patientId = params.patientId as string;
    const series = SERIES_POOL[patientId] || SERIES_POOL['P000001'] || [];
    return HttpResponse.json({ success: true, data: { patientId, series } });
  }),

  // [G005 Wave4A G-06] SUV 定量 — 确定性 seed, 与 fusionApi.getSuv 对齐
  http.get(`${API}/suv/:studyId`, async ({ params }) => {
    await delay(delayMs());
    const studyId = params.studyId as string;
    const hash = (s: string): number => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0) / 4294967295;
    };
    const hasPet = SERIES_POOL[studyId]?.some((s: any) => s.modality === 'PET' || s.modality === 'PT') ?? false;
    const h = hash(`${studyId}:exam`);
    const lesionCount = hasPet ? 1 + Math.floor(h * 3) : 0;
    const baseSuv = 6.2 + h * 4.6;
    const lesions = Array.from({ length: lesionCount }, (_, i) => {
      const lh = hash(`${studyId}:lesion:${i}`);
      const rh = hash(`${studyId}:lesion:${i}:r`);
      return {
        id: `lesion-${i + 1}`,
        x: Math.round((0.28 + lh * 0.44) * 1000) / 1000,
        y: Math.round((0.24 + rh * 0.44) * 1000) / 1000,
        diameterMm: Math.round((9 + lh * 16) * 10) / 10,
        suvMax: Math.round((baseSuv + (i === 0 ? 0 : lh * 2.1)) * 10) / 10,
        label: i === 0 ? '主病灶' : `病灶 ${i + 1}`,
        slice: 40 + Math.floor(rh * 48),
      };
    });
    const max = lesions[0]?.suvMax ?? 0;
    return HttpResponse.json({
      success: true,
      data: {
        studyId,
        hasPet,
        source: hasPet ? 'exam' : 'none',
        suv: hasPet
          ? {
              max,
              mean: Math.round(max * 0.38 * 10) / 10,
              peak: Math.round(max * 0.93 * 10) / 10,
              normalization: {
                weightKg: 70,
                injectedDoseMbg: 370,
                injectionToScanMin: 60,
                formula: 'SUV = 像素活度(MBq/ml) ÷ (注射剂量(MBq) ÷ 体重(kg))',
                unit: 'g/ml',
              },
            }
          : null,
        lesions,
      },
    });
  }),

  http.post(`${API}/register`, async ({ request }) => {
    await delay(delayMs(150, 400));
    const body = (await request.json()) as any;
    const transformType = body?.transformType || 'rigid';
    const metricsByType: Record<string, { dice: number; hd95: number; rmse: number }> = {
      rigid: { dice: 0.91, hd95: 2.3, rmse: 6.8 },
      affine: { dice: 0.94, hd95: 1.7, rmse: 4.2 },
      deformable: { dice: 0.97, hd95: 1.1, rmse: 2.6 },
      nonlinear: { dice: 0.96, hd95: 1.3, rmse: 3.1 },
    };
    const m = metricsByType[transformType] || metricsByType.rigid;
    return HttpResponse.json({
      success: true,
      data: {
        registrationId: `reg-${Date.now()}`,
        fixedSeriesUid: body?.fixedSeriesUid,
        movingSeriesUid: body?.movingSeriesUid,
        transformType,
        status: 'completed',
        metrics: m,
        matrix: [
          [1, 0, 0, -0.5],
          [0, 1, 0, 0.3],
          [0, 0, 1, 0],
          [0, 0, 0, 1],
        ],
      },
    });
  }),

  http.post(`${API}/render`, async ({ request }) => {
    await delay(delayMs(80, 200));
    const body = (await request.json()) as any;
    return HttpResponse.json({
      success: true,
      data: {
        frameId: `frame-${Date.now()}`,
        width: 512,
        height: 512,
        alpha: body?.alpha ?? 0.5,
        plane: body?.plane || 'axial',
        sliceIndex: body?.sliceIndex ?? 64,
        pixelDataBase64: '',
        windowWidth: body?.windowWidth ?? 400,
        windowLevel: body?.windowLevel ?? 40,
        fusionWindowWidth: body?.fusionWindowWidth ?? 400,
        fusionWindowLevel: body?.fusionWindowLevel ?? 40,
      },
    });
  }),
];
