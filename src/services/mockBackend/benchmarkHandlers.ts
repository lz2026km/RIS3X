// [G005-P0] /api/v1/benchmark MSW handlers
// 对齐 backend modules/benchmark/benchmark.controller.ts (@Controller('v1/benchmark'))
//   端点: GET list / POST compare / POST cross-site / GET stats
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/benchmark';

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min);

const METRICS = [
  { code: 'exam_count', name: '检查量', unit: '例', higherIsBetter: true },
  { code: 'positive_rate', name: '阳性率', unit: '%', higherIsBetter: false },
  { code: 'grade_a_rate', name: '甲级片率', unit: '%', higherIsBetter: true },
  { code: 'report_ontime_rate', name: '报告及时率', unit: '%', higherIsBetter: true },
  { code: 'critical_closed_rate', name: '危急值闭环率', unit: '%', higherIsBetter: true },
];

const SITES = ['本院', '东院区', '西院区', '南院区', '北院区'];
const DEPTS = ['放射科', 'CT室', 'MR室', '超声科', '核医学科'];

const rand = (min: number, max: number) => Math.round((Math.random() * (max - min) + min) * 100) / 100;

export const benchmarkHandlers = [
  http.get(`${API}/list`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: METRICS });
  }),

  http.post(`${API}/compare`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const metric = METRICS.find((m) => m.code === body?.metricCode) ?? METRICS[0]!;
    const current = rand(60, 98);
    const previous = rand(50, current);
    const delta = current - previous;
    const deltaPercent = previous > 0 ? Math.round((delta / previous) * 10000) / 100 : 0;
    const result: Record<string, unknown> = { metricName: metric.name, current, previous, delta, deltaPercent };
    if (body?.dimension === 'dept') {
      result.breakdown = DEPTS.map((d) => ({ label: d, current: rand(55, 99), previous: rand(50, 95) }));
    } else if (body?.dimension === 'site') {
      result.breakdown = SITES.map((s) => ({ label: s, current: rand(55, 99), previous: rand(50, 95) }));
    } else if (body?.dimension === 'time') {
      result.breakdown = Array.from({ length: 12 }, (_, i) => ({
        label: `2026-${String(i + 1).padStart(2, '0')}`,
        current: rand(55, 99),
        previous: rand(50, 95),
      }));
    }
    return HttpResponse.json({ success: true, data: result });
  }),

  http.post(`${API}/cross-site`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const siteIds: string[] = Array.isArray(body?.siteIds) ? body.siteIds : ['SITE-1'];
    const metricCodes: string[] = Array.isArray(body?.metricCodes) ? body.metricCodes : ['exam_count'];
    const data = siteIds.map((siteId: string, i: number) => ({
      siteId,
      siteName: SITES[i] ?? `院区${siteId}`,
      values: Object.fromEntries(metricCodes.map((code: string) => [code, rand(50, 100)])),
    }));
    return HttpResponse.json({ success: true, data });
  }),

  http.get(`${API}/stats`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: {
      totalExams: Math.round(Math.random() * 5000 + 3000),
      positiveRate: rand(30, 60),
      gradeARate: rand(85, 98),
      reportOnTimeRate: rand(88, 99),
      criticalClosedRate: rand(90, 100),
      totalCases: Math.round(Math.random() * 8000 + 2000),
    } });
  }),
];
