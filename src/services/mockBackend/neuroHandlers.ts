// [v3.0.6.11-81] W2-B /api/v1/neuro MSW handlers — 神经专科分析 (脑卒中/脑肿瘤/癫痫/动脉瘤)
// [v3.0.6.11-99 Wave1A 17] 后端已实现 /neuro/* controller (Exam 派生 + seed), 本模块仅 dev 兜底
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/neuro';

interface NeuroStudy {
  id: string
  patientName: string
  age: number
  gender: 'M' | 'F'
  modality: string
  indication: string
  type: 'stroke' | 'tumor' | 'epilepsy' | 'aneurysm'
  subtype?: 'ischemic' | 'hemorrhagic' | 'tia' | 'subarachnoid'
  vessel?: string
  aspectScore?: number
  coreMl?: number
  penumbraMl?: number
  lvo?: boolean
  tumorType?: string
  grade?: string
  sizeMm?: number
  volumeCm3?: number
  location?: string
  focus?: string
  mts?: boolean
  hippocampalAsymmetry?: number
  neckMm?: number
  ruptureRisk?: string
  date: string
  status: string
}

let studies: NeuroStudy[] = [
  { id: 'NX001', patientName: '张伟', age: 68, gender: 'M', modality: 'MRI', indication: '急性左侧偏瘫', type: 'stroke', subtype: 'ischemic', vessel: 'MCA-L', aspectScore: 8, coreMl: 15, penumbraMl: 45, lvo: true, date: '2026-08-07', status: 'reported' },
  { id: 'NX002', patientName: '李芳', age: 52, gender: 'F', modality: 'MRI', indication: '头痛、视力下降', type: 'tumor', tumorType: 'meningioma', grade: 'I', sizeMm: 28, volumeCm3: 5.2, location: 'frontal', date: '2026-08-07', status: 'reviewed' },
  { id: 'NX003', patientName: '王明', age: 45, gender: 'M', modality: 'CT', indication: '突发剧烈头痛', type: 'stroke', subtype: 'subarachnoid', vessel: 'ACoA', aspectScore: 10, coreMl: 0, penumbraMl: 0, lvo: false, date: '2026-08-06', status: 'reported' },
  { id: 'NX004', patientName: '赵丽', age: 34, gender: 'F', modality: 'MRI', indication: '难治性癫痫', type: 'epilepsy', focus: 'mesial-temporal', mts: true, hippocampalAsymmetry: 18, date: '2026-08-06', status: 'reported' },
  { id: 'NX005', patientName: '陈浩', age: 62, gender: 'M', modality: 'MRI', indication: '头痛、恶心', type: 'tumor', tumorType: 'glioma', grade: 'IV', sizeMm: 42, volumeCm3: 28.5, location: 'frontal', date: '2026-08-05', status: 'reviewed' },
  { id: 'NX006', patientName: '刘洁', age: 71, gender: 'F', modality: 'CTA', indication: '疑似动脉瘤', type: 'aneurysm', location: 'PCom', sizeMm: 5.2, neckMm: 3.1, ruptureRisk: 'moderate', date: '2026-08-05', status: 'reported' },
  { id: 'NX007', patientName: '孙志强', age: 58, gender: 'M', modality: 'CT', indication: '左侧肢体无力2小时', type: 'stroke', subtype: 'ischemic', vessel: 'MCA-R', aspectScore: 6, coreMl: 32, penumbraMl: 78, lvo: true, date: '2026-08-04', status: 'pending' },
  { id: 'NX008', patientName: '周敏', age: 47, gender: 'F', modality: 'MRI', indication: '阵发性意识障碍', type: 'epilepsy', focus: 'frontal', mts: false, hippocampalAsymmetry: 6, date: '2026-08-04', status: 'pending' },
  { id: 'NX009', patientName: '吴建国', age: 66, gender: 'M', modality: 'MRI', indication: '眩晕、行走不稳', type: 'tumor', tumorType: 'schwannoma', grade: 'I', sizeMm: 18, volumeCm3: 2.1, location: 'cerebellopontine', date: '2026-08-03', status: 'reported' },
  { id: 'NX010', patientName: '郑秀英', age: 74, gender: 'F', modality: 'CT', indication: '突发意识障碍', type: 'stroke', subtype: 'hemorrhagic', vessel: 'Basilar', aspectScore: 4, coreMl: 58, penumbraMl: 0, lvo: false, date: '2026-08-03', status: 'reported' },
  { id: 'NX011', patientName: '冯涛', age: 55, gender: 'M', modality: 'CTA', indication: '体检发现颅内动脉瘤', type: 'aneurysm', location: 'ACoA', sizeMm: 4.1, neckMm: 2.2, ruptureRisk: 'low', date: '2026-08-02', status: 'reported' },
  { id: 'NX012', patientName: '许文静', age: 39, gender: 'F', modality: 'MRI', indication: '言语不清', type: 'tumor', tumorType: 'pituitary', grade: 'II', sizeMm: 15, volumeCm3: 1.8, location: 'sella', date: '2026-08-02', status: 'reviewed' },
];

const delayMs = (min = 30, max = 90) => Math.floor(Math.random() * (max - min) + min);

export const neuroHandlers = [
  http.get(`${API}/studies`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const search = url.searchParams.get('search') ?? '';
    let items = [...studies];
    if (type) items = items.filter((s) => s.type === type);
    if (search) items = items.filter((s) => s.patientName.includes(search) || s.id.includes(search));
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),

  http.get(`${API}/studies/:id`, async ({ params }) => {
    await delay(delayMs());
    const found = studies.find((s) => s.id === params.id) ?? null;
    return HttpResponse.json({ success: true, data: found });
  }),

  // 神经专科统计 (KPI + 疾病分布)
  http.get(`${API}/stats`, async () => {
    await delay(delayMs());
    const stroke = studies.filter((s) => s.type === 'stroke');
    const tumor = studies.filter((s) => s.type === 'tumor');
    const epilepsy = studies.filter((s) => s.type === 'epilepsy');
    const aneurysm = studies.filter((s) => s.type === 'aneurysm');
    const total = studies.length;
    return HttpResponse.json({
      success: true,
      data: {
        total,
        todayScans: 15,
        strokeCount: stroke.length,
        tumorCount: tumor.length,
        epilepsyCount: epilepsy.length,
        aneurysmCount: aneurysm.length,
        lvoPositive: stroke.filter((s) => s.lvo).length,
        pendingReports: studies.filter((s) => s.status === 'pending').length,
        diseaseDistribution: [
          { label: '脑卒中', count: stroke.length, pct: Math.round((stroke.length / total) * 100) },
          { label: '脑肿瘤', count: tumor.length, pct: Math.round((tumor.length / total) * 100) },
          { label: '癫痫', count: epilepsy.length, pct: Math.round((epilepsy.length / total) * 100) },
          { label: '动脉瘤', count: aneurysm.length, pct: Math.round((aneurysm.length / total) * 100) },
        ],
      },
    });
  }),

  // 肿瘤分级分布
  http.get(`${API}/tumor-grades`, async () => {
    await delay(delayMs());
    const tumors = studies.filter((s) => s.type === 'tumor');
    const byGrade: Record<string, number> = {};
    for (const t of tumors) byGrade[t.grade ?? 'other'] = (byGrade[t.grade ?? 'other'] || 0) + 1;
    const gradeOrder = ['I', 'II', 'III', 'IV'];
    const grades = gradeOrder
      .filter((g) => byGrade[g])
      .map((g) => ({ grade: g, count: byGrade[g] }));
    const byTypeMap: Record<string, number> = {};
    for (const t of tumors) byTypeMap[t.tumorType ?? 'other'] = (byTypeMap[t.tumorType ?? 'other'] || 0) + 1;
    const typeTotal = tumors.length || 1;
    const types = Object.entries(byTypeMap).map(([k, v]) => ({
      label: k,
      count: v,
      pct: Math.round((v / typeTotal) * 100),
    }));
    return HttpResponse.json({ success: true, data: { grades, types } });
  }),

  // 卒中治疗时间窗
  http.get(`${API}/stroke-windows`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: [
        { window: '0-3h (IV tPA)', count: 5, color: '#16a34a' },
        { window: '3-6h (MT)', count: 3, color: '#ca8a04' },
        { window: '6-24h (MT)', count: 2, color: '#ea580c' },
        { window: '>24h (保守)', count: 1, color: '#dc2626' },
      ],
    });
  }),

  // 急诊分析 (演示: 返回成功标记)
  http.post(`${API}/analyze`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: { queued: true, message: '神经 AI 急诊分析已入队' } });
  }),
];
