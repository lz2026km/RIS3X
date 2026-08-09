// [W3-A] /api/v1/mammo-qc MSW handlers
// [G005 Wave1B P1] 标注更新: 后端已实现 /mammo-qc 端点 (mammo-qc.module),
// 本 handler 仅作为 mock 模式兜底演示数据。
//   GET /mammo-qc/overview · GET /mammo-qc/records
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/mammo-qc';

const delayMs = (min = 60, max = 180) => Math.floor(Math.random() * (max - min) + min);

const ACR_CHECKS = [
  { name: '体位标准', score: 96, items: ['CC位胸大肌显示', 'MLO位乳房下角', '乳头轮廓'] },
  { name: '曝光参数', score: 92, items: ['mAs范围', 'kVp准确度', 'AEC校准'] },
  { name: '图像质量', score: 88, items: ['锐利度', '对比度', '噪声水平'] },
  { name: '剂量水平', score: 95, items: ['AGD限值', '压迫厚度', '乳腺密度校正'] },
  { name: '技师操作', score: 90, items: ['定位重复性', '压迫力控制', '患者标识'] },
  { name: '设备性能', score: 93, items: ['MQSA合规', '日常质控记录', '校准状态'] },
];

const TECHNOLOGISTS = ['王芳', '李艳', '张敏', '刘洁', '陈静'];
const MODALITIES = ['MG', 'TOM', 'US', 'MRI'];

interface MammoQcRecord {
  id: string
  date: string
  patient: string
  modality: string
  score: number
  status: '合格' | '待复评' | '不合格'
  technologist: string
  issue: string
}

const RECORDS: MammoQcRecord[] = Array.from({ length: 50 }, (_, i) => {
  const score = 60 + Math.floor(Math.random() * 40);
  const status: MammoQcRecord['status'] = score >= 80 ? '合格' : score >= 60 ? '待复评' : '不合格';
  return {
    id: `mam-qc-${i + 1}`,
    date: `2026-${String(1 + (i % 5)).padStart(2, '0')}-${String(5 + i).padStart(2, '0')}`,
    patient: `患者${String.fromCharCode(65 + (i % 26))}${i}`,
    modality: MODALITIES[i % MODALITIES.length]!,
    score,
    status,
    technologist: TECHNOLOGISTS[i % TECHNOLOGISTS.length]!,
    issue: score < 70 ? '压缩不足' : score < 80 ? '定位偏移' : '',
  };
});

export const mammoQcHandlers = [
  http.get(`${API}/overview`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        source: 'demo',
        generatedAt: new Date().toISOString(),
        data: {
          overallScore: 92.4,
          acrComplianceRate: 98.2,
          recallRate: 8.6,
          avgDoseMgy: 2.4,
          imageFailRate: 3.2,
          technologistConsistency: 88.5,
          acrChecks: ACR_CHECKS.map((c) => ({ ...c, items: [...c.items] })),
        },
      },
    });
  }),

  http.get(`${API}/records`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    const items = search
      ? RECORDS.filter((r) => r.patient.toLowerCase().includes(search) || r.technologist.toLowerCase().includes(search))
      : RECORDS;
    return HttpResponse.json({
      success: true,
      data: {
        source: 'demo',
        generatedAt: new Date().toISOString(),
        data: items.map((r) => ({ ...r })),
      },
      meta: { total: items.length },
    });
  }),

  // [G005 Wave1A W9] 质控测试项 / 标准 / 统计 (与后端 mammo-qc.controller 对齐)
  http.get(`${API}/tests`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'T-001', name: 'X线输出量一致性', category: '设备性能', frequency: '每日', target: '±10%', lastResult: 96.2, status: '通过', nextDue: '2026-08-10' },
        { id: 'T-002', name: '压迫力校验', category: '剂量控制', frequency: '每周', target: '111-196N', lastResult: 88.5, status: '通过', nextDue: '2026-08-12' },
        { id: 'T-003', name: '影像接收器响应', category: '图像质量', frequency: '每周', target: '±10%', lastResult: 72.1, status: '待复评', nextDue: '2026-08-08' },
        { id: 'T-004', name: 'AGD剂量限值', category: '剂量控制', frequency: '每月', target: '≤3.0mGy', lastResult: 94.8, status: '通过', nextDue: '2026-08-20' },
        { id: 'T-005', name: '伪影评估', category: '图像质量', frequency: '每月', target: '无伪影', lastResult: 81.0, status: '通过', nextDue: '2026-08-25' },
      ],
    });
  }),

  http.get(`${API}/standards`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'S-001', name: 'ACR 乳腺质控手册', requirement: '乳腺X线设备需按 ACR 质控手册执行每日/每周/每月质控测试', source: 'ACR', scope: 'MG/TOM' },
        { id: 'S-002', name: 'MQSA 法规', requirement: '设备认证、技师资质、报告质量三位一体监管', source: 'FDA MQSA', scope: 'MG' },
        { id: 'S-003', name: 'WS 674-2020 乳腺X线摄影技术规范', requirement: '平均腺体剂量 ≤ 3.0mGy', source: '国家卫健委', scope: 'MG/TOM' },
      ],
    });
  }),

  http.get(`${API}/stats`, async () => {
    await delay(delayMs());
    const total = RECORDS.length;
    const pass = RECORDS.filter((r) => r.status === '合格').length;
    const review = RECORDS.filter((r) => r.status === '待复评').length;
    const fail = RECORDS.filter((r) => r.status === '不合格').length;
    return HttpResponse.json({
      success: true,
      data: {
        source: 'demo',
        generatedAt: new Date().toISOString(),
        data: {
          totalRecords: total,
          passRate: Math.round((pass / total) * 1000) / 10,
          reviewRate: Math.round((review / total) * 1000) / 10,
          failRate: Math.round((fail / total) * 1000) / 10,
          avgScore: Math.round((RECORDS.reduce((s, r) => s + r.score, 0) / total) * 10) / 10,
          byModality: {},
          byTechnologist: TECHNOLOGISTS.map((name) => ({
            technologist: name,
            count: RECORDS.filter((r) => r.technologist === name).length,
            avgScore: 80 + Math.floor(Math.random() * 12),
          })),
        },
      },
    });
  }),
];
