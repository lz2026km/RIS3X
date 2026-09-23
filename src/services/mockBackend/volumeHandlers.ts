// [v3.0.6.11-53] /api/v1/volume MSW handlers — 与后端 volume.controller 对齐
// [G005 P1] 补齐 GET /volume/status/:jobId; reconstruct 对齐后端 { jobId, volume:{x,y,z}, source } 形状
import { http, HttpResponse, delay } from 'msw';
import { parseQuery } from './queryBuilder';

const API = '/api/v1/volume';

// 内置示例 DICOM series（与 backend/dicom-samples 对齐）
const SERIES: any[] = [
  { seriesUid: '1.2.826.0.1.3680043.8.498.20260718120000.001', studyUid: '1.2.826.0.1.3680043.8.498.20260718090000.001', patientName: 'ZHANG^CS01', patientId: 'P000001', modality: 'CT', bodyPart: 'HEAD', description: 'CT 头颅平扫', seriesNumber: 1, rows: 512, columns: 512, sliceCount: 20, sliceThickness: 5, windowCenter: 40, windowWidth: 80 },
  { seriesUid: '1.2.826.0.1.3680043.8.498.20260718130000.002', studyUid: '1.2.826.0.1.3680043.8.498.20260718090000.002', patientName: 'LI^CS02', patientId: 'P000002', modality: 'CT', bodyPart: 'CHEST', description: 'CT 胸部平扫', seriesNumber: 1, rows: 512, columns: 512, sliceCount: 15, sliceThickness: 5, windowCenter: 40, windowWidth: 400 },
  { seriesUid: '1.2.826.0.1.3680043.8.498.20260718140000.003', studyUid: '1.2.826.0.1.3680043.8.498.20260718090000.003', patientName: 'WANG^CS03', patientId: 'P000003', modality: 'MR', bodyPart: 'BRAIN', description: 'MR 头颅 T1', seriesNumber: 2, rows: 256, columns: 256, sliceCount: 10, sliceThickness: 5, windowCenter: 1600, windowWidth: 3200 },
];

const delayMs = (min = 30, max = 100) => Math.floor(Math.random() * (max - min) + min);

export const volumeHandlers = [
  http.get(`${API}/series`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items = SERIES;
    if (opts?.filters?.modality) items = items.filter((s) => s.modality === opts.filters!.modality);
    if (opts?.search) items = items.filter((s) => (s.patientName + s.patientId).toLowerCase().includes(String(opts.search).toLowerCase()));
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),

  http.get(`${API}/:studyUid`, async ({ params }) => {
    await delay(delayMs());
    const found = SERIES.find((s) => s.studyUid === params.studyUid || s.seriesUid === params.studyUid);
    return HttpResponse.json({ success: true, data: found ?? SERIES[0] });
  }),

  http.post(`${API}/reconstruct`, async ({ request }) => {
    await delay(delayMs(80, 200));
    const body = (await request.json()) as any;
    const series = SERIES.find((s) => s.seriesUid === body?.seriesUID) ?? SERIES[0];
    const jobId = `vol-${Date.now()}`;
    return HttpResponse.json({
      success: true,
      data: {
        jobId,
        volume: { x: series.columns, y: series.rows, z: series.sliceCount },
        source: 'real',
        instanceCount: series.sliceCount,
        seriesUID: series.seriesUid,
        rows: series.rows,
        columns: series.columns,
        slices: series.sliceCount,
        windowCenter: series.windowCenter,
        windowWidth: series.windowWidth,
        rescaleIntercept: -1024,
        status: 'completed',
      },
    });
  }),

  // [G005 P1] 后端 volume.service.getStatus: { status, progress, source, volume }
  http.get(`${API}/status/:jobId`, async ({ params }) => {
    await delay(delayMs(40, 120));
    const jobId = params.jobId as string;
    const series = SERIES[0];
    return HttpResponse.json({
      success: true,
      data: {
        status: 'completed',
        progress: 100,
        source: 'real',
        volume: { x: series.columns, y: series.rows, z: series.sliceCount },
        slices: series.sliceCount,
        modality: series.modality,
        jobId,
      },
    });
  }),

  http.post(`${API}/mpr`, async ({ request }) => {
    await delay(delayMs(60, 150));
    const body = (await request.json()) as any;
    const plane = body?.plane ?? 'axial';
    return HttpResponse.json({
      success: true,
      data: {
        plane,
        width: plane === 'sagittal' || plane === 'coronal' ? 200 : 512,
        height: plane === 'axial' ? 512 : 200,
        pixelDataBase64: '',
        windowCenter: 40,
        windowWidth: 400,
        source: 'real-dicom-samples',
      },
    });
  }),

  http.post(`${API}/mip`, async () => {
    await delay(delayMs(60, 150));
    return HttpResponse.json({ success: true, data: { width: 512, height: 512, pixelDataBase64: '', windowCenter: 40, windowWidth: 400, source: 'real-dicom-samples' } });
  }),

  http.post(`${API}/vr`, async () => {
    await delay(delayMs(80, 200));
    return HttpResponse.json({ success: true, data: { width: 512, height: 512, pixelDataBase64: '', windowCenter: 40, windowWidth: 400, source: 'real-dicom-samples' } });
  }),
];
