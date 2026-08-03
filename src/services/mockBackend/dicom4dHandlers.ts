// [Phase 2] /api/v1/dicom/4d MSW handlers — 4D 动态影像（与 dicomApi.dicom4dApi 对齐）
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/dicom/4d';

const delayMs = (min = 50, max = 160) => Math.floor(Math.random() * (max - min) + min);

const SERIES = [
  {
    seriesUid: '1.3.6.1.4.1.9590.100.4d.001',
    studyUid: '1.3.6.1.4.1.9590.100.4d.study.001',
    patientName: '张伟',
    patientId: 'P000101',
    modality: 'CT',
    seriesDescription: '冠脉CTA 4D（心电门控）',
    frameCount: 32,
    frameRate: 10,
    gatingType: 'cardiac',
    dimensions: { width: 512, height: 512 },
  },
  {
    seriesUid: '1.3.6.1.4.1.9590.100.4d.002',
    studyUid: '1.3.6.1.4.1.9590.100.4d.study.002',
    patientName: '李娜',
    patientId: 'P000102',
    modality: 'CT',
    seriesDescription: '肺通气-灌注 4D（呼吸门控）',
    frameCount: 48,
    frameRate: 8,
    gatingType: 'respiratory',
    dimensions: { width: 512, height: 512 },
  },
  {
    seriesUid: '1.3.6.1.4.1.9590.100.4d.003',
    studyUid: '1.3.6.1.4.1.9590.100.4d.study.003',
    patientName: '王强',
    patientId: 'P000103',
    modality: 'MR',
    seriesDescription: '心脏电影序列（双门控）',
    frameCount: 40,
    frameRate: 12,
    gatingType: 'both',
    dimensions: { width: 256, height: 256 },
  },
];

function buildFrames(series: (typeof SERIES)[number]) {
  const t0 = Date.now() - series.frameCount * (1000 / series.frameRate);
  return Array.from({ length: series.frameCount }, (_, i) => ({
    frameIndex: i,
    timestamp: new Date(t0 + i * (1000 / series.frameRate)).toISOString(),
    phase: Math.round((i / series.frameCount) * 100),
    dataUrl: '',
  }));
}

export const dicom4dHandlers = [
  http.post(`${API}/list`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: SERIES });
  }),

  http.post(`${API}/frames`, async ({ request }) => {
    await delay(delayMs(60, 180));
    const body = (await request.json()) as any;
    const series = SERIES.find(s => s.seriesUid === body?.seriesUid) || SERIES[0];
    return HttpResponse.json({ success: true, data: buildFrames(series) });
  }),

  http.get(`${API}/phase/:seriesUid`, async ({ params }) => {
    await delay(delayMs());
    const series = SERIES.find(s => s.seriesUid === params.seriesUid) || SERIES[0];
    return HttpResponse.json({
      success: true,
      data: {
        seriesUid: series.seriesUid,
        gatingType: series.gatingType,
        cardiacPhase: 45,
        respiratoryPhase: 50,
        cardiacCycleMs: series.gatingType !== 'respiratory' ? 850 : 0,
        respiratoryCycleMs: series.gatingType !== 'cardiac' ? 4000 : 0,
        frameCount: series.frameCount,
      },
    });
  }),
];
