// [v3.0.6.11-71] /api/v1/cardiac MSW handlers — 心脏专科分析
import { http, HttpResponse, delay } from 'msw';
import { parseQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';

const API = '/api/v1/cardiac';

let analyses: any[] = [
  { id: 'CA-001', patientId: 'P001', patientName: '张伟', studyId: 'STU-001', modality: 'CT', date: '2026-07-20', ejectionFraction: 62, lvVolume: 118, lvMass: 96, stenosis: [{ segment: 'LAD', severity: 'moderate' }], findings: ['冠状动脉钙化积分 128', '左室功能正常'], status: 'completed', confidence: 0.92 },
  { id: 'CA-002', patientId: 'P002', patientName: '李秀英', studyId: 'STU-002', modality: 'CT', date: '2026-07-21', ejectionFraction: 55, lvVolume: 132, lvMass: 108, stenosis: [{ segment: 'LCX', severity: 'mild' }], findings: ['左前降支近段软斑块', '室壁运动正常'], status: 'completed', confidence: 0.88 },
  { id: 'CA-003', patientId: 'P003', patientName: '王建国', studyId: 'STU-003', modality: 'MR', date: '2026-07-22', ejectionFraction: 41, lvVolume: 156, lvMass: 132, stenosis: [], findings: ['左室射血分数降低', '节段性室壁运动异常'], status: 'pending', confidence: 0.85 },
  { id: 'CA-004', patientId: 'P004', patientName: '陈芳', studyId: 'STU-004', modality: 'CT', date: '2026-07-23', ejectionFraction: 68, lvVolume: 104, lvMass: 88, stenosis: [], findings: ['冠状动脉未见明显狭窄'], status: 'completed', confidence: 0.95 },
];

const delayMs = (min = 30, max = 100) => Math.floor(Math.random() * (max - min) + min);

export const cardiacHandlers = [
  http.get(`${API}/analyses`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items = [...analyses];
    if (opts?.search) items = items.filter((a) => (a.patientName + a.patientId).toLowerCase().includes(String(opts.search).toLowerCase()));
    if (opts?.modality) items = items.filter((a) => a.modality === opts.modality);
    if (opts?.status) items = items.filter((a) => a.status === opts.status);
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),
  http.get(`${API}/analyses/:id`, async ({ params }) => {
    await delay(delayMs());
    const found = analyses.find((a) => a.id === params.id);
    return HttpResponse.json({ success: true, data: found ?? null });
  }),
  http.post(`${API}/analyses`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const item = { id: body.id || `CA-${uuidv4().slice(0, 8)}`, ...body, status: body.status ?? 'pending', date: body.date || new Date().toISOString().slice(0, 10) };
    analyses = [item, ...analyses];
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
  http.patch(`${API}/analyses/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const idx = analyses.findIndex((a) => a.id === params.id);
    if (idx >= 0) analyses[idx] = { ...analyses[idx], ...body };
    return HttpResponse.json({ success: true, data: analyses[idx] ?? { id: params.id, ...body } });
  }),
  http.delete(`${API}/analyses/:id`, async ({ params }) => {
    await delay(delayMs());
    analyses = analyses.filter((a) => a.id !== params.id);
    return HttpResponse.json({ success: true, data: {} });
  }),
];
