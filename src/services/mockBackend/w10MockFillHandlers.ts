// [W10-B] 新页面真实 API 补齐 handlers (注册于 handlers 数组最前)
// 覆盖本 wave 新接线但后端/MSW 尚无对应端点的接口:
//   - 骨科影像分析: GET/POST /ortho-specialty/studies (orthoSpecialtyApi)
//   - 儿童剂量记录: GET /rdsr/pediatric (rdsrApi.getPediatric)
import { http, HttpResponse, delay } from 'msw';

const API_BASE = (() => {
  try { return window.location.origin + '/api/v1'; } catch { return 'http://localhost/api/v1'; }
})();

const ORTHO_STUDIES = [
  { id: 'OX001', name: '张伟', age: 65, gender: 'M', joint: 'knee', modality: 'XR', klGrade: 'III', oaScore: 7.5, fracture: false, date: '2026-07-15' },
  { id: 'OX002', name: '李芳', age: 52, gender: 'F', joint: 'hip', modality: 'XR', klGrade: 'II', oaScore: 4.2, fracture: false, date: '2026-07-14' },
  { id: 'OX003', name: '王明', age: 70, gender: 'M', joint: 'lumbar', modality: 'MRI', klGrade: 'IV', oaScore: 9.1, fracture: true, date: '2026-07-13' },
  { id: 'OX004', name: '赵丽', age: 34, gender: 'F', joint: 'knee', modality: 'MRI', klGrade: '0', oaScore: 0, fracture: false, date: '2026-07-12' },
  { id: 'OX005', name: '陈浩', age: 58, gender: 'M', joint: 'shoulder', modality: 'CT', klGrade: 'I', oaScore: 2.0, fracture: true, date: '2026-07-11' },
];

const PEDIATRIC_DOSE = [
  { id: 'P001', patientId: 'RAD-P010', patientName: '患者F', age: 8, ageGroup: '5-10岁', gender: '女', examDate: '2026-05-01', modality: 'CT', examItem: '头部CT', doseValue: 420, doseUnit: 'mGy·cm', doseReductionFactor: 0.6, alertLevel: 'normal', device: 'CT-1' },
  { id: 'P002', patientId: 'RAD-P011', patientName: '患者G', age: 5, ageGroup: '0-5岁', gender: '男', examDate: '2026-05-01', modality: 'CT', examItem: '胸部CT', doseValue: 280, doseUnit: 'mGy·cm', doseReductionFactor: 0.4, alertLevel: 'normal', device: 'CT-2' },
  { id: 'P003', patientId: 'RAD-P015', patientName: '患者H', age: 12, ageGroup: '10-15岁', gender: '女', examDate: '2026-04-30', modality: 'CT', examItem: '腹部CT', doseValue: 320, doseUnit: 'mGy·cm', doseReductionFactor: 0.7, alertLevel: 'normal', device: 'CT-1' },
  { id: 'P004', patientId: 'RAD-P025', patientName: '患者I', age: 3, ageGroup: '0-5岁', gender: '男', examDate: '2026-04-30', modality: 'CT', examItem: '腹部CT', doseValue: 350, doseUnit: 'mGy·cm', doseReductionFactor: 0.4, alertLevel: 'normal', device: 'CT-2' },
  { id: 'P005', patientId: 'RAD-P026', patientName: '患者J', age: 7, ageGroup: '5-10岁', gender: '女', examDate: '2026-04-29', modality: 'CT', examItem: '头部CT', doseValue: 480, doseUnit: 'mGy·cm', doseReductionFactor: 0.6, alertLevel: 'warning', device: 'CT-1' },
  { id: 'P006', patientId: 'RAD-P027', patientName: '患者K', age: 14, ageGroup: '10-15岁', gender: '男', examDate: '2026-04-29', modality: 'CT', examItem: '胸部CT', doseValue: 380, doseUnit: 'mGy·cm', doseReductionFactor: 0.7, alertLevel: 'normal', device: 'CT-2' },
];

export const w10MockFillHandlers = [
  http.get(`${API_BASE}/ortho-specialty/studies`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: ORTHO_STUDIES });
  }),

  http.post(`${API_BASE}/ortho-specialty/studies`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      { success: true, data: { id: `OX${String(ORTHO_STUDIES.length + 1).padStart(3, '0')}`, ...body } },
      { status: 201 },
    );
  }),

  http.get(`${API_BASE}/rdsr/pediatric`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: PEDIATRIC_DOSE });
  }),
];
