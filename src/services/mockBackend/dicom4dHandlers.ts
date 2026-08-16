// [Phase 2] /api/v1/dicom/4d MSW handlers — 4D 动态影像（与 dicomApi.dicom4dApi 对齐）
// [G005 v3.0.6.11-101 Wave 1B (G-07)] 新增 phase-info / movie 端点
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
    const series = SERIES.find(s => s.seriesUid === body?.seriesUid) || SERIES[0]!;
    return HttpResponse.json({ success: true, data: buildFrames(series) });
  }),

  http.get(`${API}/phase/:seriesUid`, async ({ params }) => {
    await delay(delayMs());
    const series = SERIES.find(s => s.seriesUid === params.seriesUid) || SERIES[0]!;
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

  // ----- [G005 v3.0.6.11-101 Wave 1B (G-07)] phase-info: 序列 → 时相分布 (cardiac 0-19 / respiratory 0-9) -----
  http.post(`${API}/phase-info`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const series = SERIES.find(s => s.seriesUid === body?.seriesUid) || SERIES[0]!;
    const cardiac = series.gatingType !== 'respiratory'
      ? Array.from({ length: 20 }, (_, phase) => ({ phase, count: phase < 16 ? 1 : 0 }))
      : Array.from({ length: 20 }, (_, phase) => ({ phase, count: 0 }));
    const respiratory = series.gatingType !== 'cardiac'
      ? Array.from({ length: 10 }, (_, phase) => ({ phase, count: phase < 8 ? 1 : 0 }))
      : Array.from({ length: 10 }, (_, phase) => ({ phase, count: 0 }));
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
        distribution: { gatingType: series.gatingType, cardiac, respiratory, totalFrames: series.frameCount },
      },
    });
  }),

  // ----- [G005 v3.0.6.11-101 Wave 1B (G-07)] movie: 帧间插值参数 + 心电/RR 间期 -----
  http.post(`${API}/movie`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const series = SERIES.find(s => s.seriesUid === body?.seriesUid) || SERIES[0]!;
    const cycleMs = series.gatingType === 'respiratory' ? 4000 : 850;
    const bpm = series.gatingType === 'respiratory' ? 15 : 71;
    const beats = Math.max(8, Math.min(24, series.frameCount));
    const rrIntervals = Array.from({ length: beats }, () => Math.round(cycleMs * (0.95 + ((Date.now() + Math.random()) % 10) / 100)));
    return HttpResponse.json({
      success: true,
      data: {
        seriesUid: series.seriesUid,
        studyUid: series.studyUid,
        modality: series.modality,
        frameCount: series.frameCount,
        gatingType: series.gatingType,
        frameRate: series.frameRate,
        cycleMs,
        framesPerPhase: Math.ceil(series.frameCount / (series.gatingType === 'both' ? 20 : series.gatingType === 'cardiac' ? 20 : 10)),
        interpolatedFrames: 0,
        interpolationMode: 'phase-bin',
        bpm,
        rrIntervals,
        ecgWaveform: rrIntervals.map((rr: number, i: number) => ({ t: rr * i, rr })),
        phaseSequence: Array.from({ length: series.frameCount }, (_, i) => Math.floor((i / series.frameCount) * 20)),
      },
    });
  }),
];
