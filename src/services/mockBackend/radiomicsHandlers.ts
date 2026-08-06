// [G005 P1] /api/v1/radiomics MSW handlers — 与 backend modules/radiomics/radiomics.controller.ts 对齐
// 页面: /radiomics (RadiomicsFeaturePage) /dicom-viewer 内 RadiomicsPage (extract)
import { http, HttpResponse, delay } from "msw";

const API = "/api/v1/radiomics";

const delayMs = (min = 80, max = 300) =>
  Math.floor(Math.random() * (max - min) + min);

const BASE_FEATURES = [
  { category: "Shape", name: "Volume", value: 125.4, unit: "mm³" },
  { category: "Shape", name: "SurfaceArea", value: 210.8, unit: "mm²" },
  { category: "Shape", name: "Compactness1", value: 0.87, unit: "1" },
  { category: "Shape", name: "Sphericity", value: 0.76, unit: "1" },
  { category: "FirstOrder", name: "Mean", value: 85.3, unit: "HU" },
  { category: "FirstOrder", name: "Median", value: 82.0, unit: "HU" },
  { category: "FirstOrder", name: "StdDev", value: 42.1, unit: "HU" },
  { category: "GLCM", name: "Contrast", value: 128.5, unit: "1" },
  { category: "GLCM", name: "Correlation", value: 0.62, unit: "1" },
  { category: "GLCM", name: "Energy", value: 0.18, unit: "1" },
  { category: "GLCM", name: "Homogeneity", value: 0.73, unit: "1" },
  { category: "Wavelet", name: "Wavelet-HLL_Mean", value: 72.1, unit: "HU" },
];

const jitter = (v: number) => Number((v * (0.9 + Math.random() * 0.2)).toFixed(3));

export const radiomicsHandlers = [
  http.post(`${API}/extract`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    return HttpResponse.json({
      success: true,
      data: {
        instanceId: body?.instanceId,
        features: BASE_FEATURES.map((f) => ({ ...f, value: jitter(f.value) })),
        simulated: true,
      },
    });
  }),

  http.get(`${API}/features/:instanceId`, async ({ params }) => {
    await delay(delayMs(60, 200));
    return HttpResponse.json({
      success: true,
      data: {
        instanceId: params.instanceId,
        features: BASE_FEATURES.map((f) => ({ ...f, value: jitter(f.value) })),
        simulated: true,
      },
    });
  }),

  http.post(`${API}/compare`, async ({ request }) => {
    await delay(delayMs(120, 350));
    const body = (await request.json()) as any;
    const ids = (body?.instanceIds ?? []) as string[];
    return HttpResponse.json({
      success: true,
      data: ids.map((id, i) => ({
        instanceId: id,
        features: BASE_FEATURES.map((f) => ({ ...f, value: jitter(f.value + i * 10) })),
        simulated: true,
      })),
    });
  }),
];
