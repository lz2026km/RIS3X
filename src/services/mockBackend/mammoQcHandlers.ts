// [W3-A] /api/v1/mammo-qc MSW handlers
// 后端暂未实现 /mammo-qc 端点 → 本地演示数据 (页面标注"演示数据"来源)
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
];
