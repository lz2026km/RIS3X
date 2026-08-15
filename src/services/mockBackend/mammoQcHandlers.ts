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

  // [G-21 Wave3C] 乳腺质控规则列表 (15 条 seed, 与后端 mammo-qc.service 对齐)
  http.get(`${API}/breast-rules`, async () => {
    await delay(delayMs());
    const rules = [
      { id: 'BR-001', category: '投照质量', name: 'CC 位乳腺覆盖', description: 'CC 位应包括全部乳腺实质, 胸大肌显示或达乳头水平, 覆盖 ≥ 90%', level: 'required', metric: 'coverage', views: ['CC'], thresholdMin: 90, warnMin: 85 },
      { id: 'BR-002', category: '投照质量', name: 'MLO 位乳腺覆盖', description: 'MLO 位应包括乳房下角、胸大肌上缘, 覆盖 ≥ 95%', level: 'required', metric: 'coverage', views: ['MLO'], thresholdMin: 95, warnMin: 90 },
      { id: 'BR-003', category: '投照质量', name: '乳头切线位', description: '乳头应呈切线位显示, 不可被遮挡或下垂', level: 'required', metric: 'nippleTangential', views: ['CC', 'MLO'] },
      { id: 'BR-004', category: '投照质量', name: 'CC 位压迫厚度', description: 'CC 位压迫厚度 ≤ 55mm 为佳, > 60mm 提示压迫不足', level: 'advisory', metric: 'compression', views: ['CC'], thresholdMax: 55, warnMax: 60 },
      { id: 'BR-005', category: '投照质量', name: 'MLO 位压迫厚度', description: 'MLO 位压迫厚度 ≤ 65mm 为佳, > 70mm 提示压迫不足', level: 'advisory', metric: 'compression', views: ['MLO'], thresholdMax: 65, warnMax: 70 },
      { id: 'BR-006', category: '投照质量', name: '双侧对称性', description: '左右乳投照角度与压迫应对称, 便于对比阅片', level: 'advisory' },
      { id: 'BR-007', category: '投照质量', name: '图像清晰度/无运动伪影', description: '无运动模糊, 乳腺轮廓与皮肤线清晰可辨', level: 'required' },
      { id: 'BR-008', category: '剂量', name: 'AGD 剂量限值 (WS 674-2020)', description: '平均腺体剂量 ≤ 3.0 mGy (法规限值, 超标为不合格)', level: 'required', metric: 'agd', thresholdMax: 3.0, warnMax: 3.0 },
      { id: 'BR-009', category: '剂量', name: 'AGD 优化目标 (ACR)', description: '平均腺体剂量 ≤ 2.4 mGy (ACR 基准, 超限提示曝光优化)', level: 'advisory', metric: 'agd', thresholdMax: 2.4, warnMax: 3.0 },
      { id: 'BR-010', category: '剂量', name: 'CC 位 AGD 限值', description: 'CC 位平均腺体剂量 ≤ 2.6 mGy', level: 'advisory', metric: 'agd', views: ['CC'], thresholdMax: 2.6, warnMax: 3.0 },
      { id: 'BR-011', category: '剂量', name: 'MLO 位 AGD 限值', description: 'MLO 位平均腺体剂量 ≤ 3.0 mGy', level: 'advisory', metric: 'agd', views: ['MLO'], thresholdMax: 3.0, warnMax: 3.0 },
      { id: 'BR-012', category: '随访建议', name: 'BI-RADS 3 类随访', description: 'BI-RADS 3 类 (可能良性) 建议 6 个月短期随访', level: 'advisory' },
      { id: 'BR-013', category: '随访建议', name: 'BI-RADS 4+ 处理', description: 'BI-RADS 4 类及以上建议活检/专科会诊', level: 'required' },
      { id: 'BR-014', category: '随访建议', name: '年度筛查', description: '40 岁以上女性建议每年 1 次乳腺 X 线筛查', level: 'advisory' },
      { id: 'BR-015', category: '随访建议', name: '高密度乳腺补充成像', description: '致密型乳腺建议补充超声或断层合成检查', level: 'advisory' },
    ];
    return HttpResponse.json({ success: true, data: rules });
  }),

  // [G-21 Wave3C] 影像质量参数 → 规则命中评估 (通过/告警/不合格 + 依据)
  http.post(`${API}/breast-evaluate`, async ({ request }) => {
    await delay(delayMs(80, 200));
    const body = await request.json().catch(() => ({})) as { images?: Array<Record<string, unknown>> };
    const images = Array.isArray(body.images) ? body.images : [];
    if (images.length === 0) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '至少需要一张乳腺影像参数进行评估' } }, { status: 400 });
    }
    const hits: Array<{ ruleId: string; name: string; category: string; level: string; status: '通过' | '告警' | '不合格'; basis: string }> = [];
    const evaluated = images.map((raw) => {
      const img = raw as { view: string; coverage?: number; nippleTangential?: boolean; compression?: number; agd?: number };
      const viewUpper = String(img.view ?? '').toUpperCase();
      const isCC = viewUpper.includes('CC');
      const isMLO = viewUpper.includes('MLO');
      const imgHits: typeof hits = [];
      const push = (ruleId: string, name: string, category: string, status: '通过' | '告警' | '不合格', basis: string) =>
        imgHits.push({ ruleId, name, category, level: ruleId === 'BR-001' || ruleId === 'BR-002' || ruleId === 'BR-003' || ruleId === 'BR-007' || ruleId === 'BR-008' || ruleId === 'BR-013' ? 'required' : 'advisory', status, basis });
      if (img.coverage !== undefined && img.coverage !== null) {
        if (isCC) {
          const v = Number(img.coverage);
          if (v >= 90) push('BR-001', 'CC 位乳腺覆盖', '投照质量', '通过', `${img.view}: 覆盖 ${v}% ≥ 90% (合格)`);
          else if (v >= 85) push('BR-001', 'CC 位乳腺覆盖', '投照质量', '告警', `${img.view}: 覆盖 ${v}% 低于目标 90%, 建议重新投照评估`);
          else push('BR-001', 'CC 位乳腺覆盖', '投照质量', '不合格', `${img.view}: 覆盖 ${v}% < 85%, 乳腺实质覆盖不足 (不合格)`);
        }
        if (isMLO) {
          const v = Number(img.coverage);
          if (v >= 95) push('BR-002', 'MLO 位乳腺覆盖', '投照质量', '通过', `${img.view}: 覆盖 ${v}% ≥ 95% (合格)`);
          else if (v >= 90) push('BR-002', 'MLO 位乳腺覆盖', '投照质量', '告警', `${img.view}: 覆盖 ${v}% 低于目标 95%, 建议重新投照评估`);
          else push('BR-002', 'MLO 位乳腺覆盖', '投照质量', '不合格', `${img.view}: 覆盖 ${v}% < 90%, 乳腺实质覆盖不足 (不合格)`);
        }
      }
      if (img.nippleTangential === false) push('BR-003', '乳头切线位', '投照质量', '不合格', `${img.view}: 乳头未呈切线位, 乳头轮廓遮挡或下垂 (不合格)`);
      else if (img.nippleTangential === true) push('BR-003', '乳头切线位', '投照质量', '通过', `${img.view}: 乳头呈切线位 (合格)`);
      if (img.compression !== undefined && img.compression !== null) {
        const v = Number(img.compression);
        const max = isMLO ? 65 : 55;
        const warn = isMLO ? 70 : 60;
        const ruleId = isMLO ? 'BR-005' : 'BR-004';
        const name = isMLO ? 'MLO 位压迫厚度' : 'CC 位压迫厚度';
        if (v <= max) push(ruleId, name, '投照质量', '通过', `${img.view}: 压迫厚度 ${v}mm ≤ ${max}mm (合格)`);
        else if (v <= warn) push(ruleId, name, '投照质量', '告警', `${img.view}: 压迫厚度 ${v}mm 超目标 ${max}mm, 提示压迫可能不足 (告警)`);
        else push(ruleId, name, '投照质量', '不合格', `${img.view}: 压迫厚度 ${v}mm > ${warn}mm, 压迫严重不足 (不合格)`);
      }
      if (img.agd !== undefined && img.agd !== null) {
        const v = Number(img.agd);
        if (v <= 2.4) {
          push('BR-008', 'AGD 剂量限值 (WS 674-2020)', '剂量', '通过', `${img.view}: AGD ${v.toFixed(2)} mGy ≤ 3.0 mGy (合格)`);
          push('BR-009', 'AGD 优化目标 (ACR)', '剂量', '通过', `${img.view}: AGD ${v.toFixed(2)} mGy ≤ 2.4 mGy (合格)`);
          if (isCC) push('BR-010', 'CC 位 AGD 限值', '剂量', '通过', `${img.view}: AGD ${v.toFixed(2)} mGy ≤ 2.6 mGy (合格)`);
          if (isMLO) push('BR-011', 'MLO 位 AGD 限值', '剂量', '通过', `${img.view}: AGD ${v.toFixed(2)} mGy ≤ 3.0 mGy (合格)`);
        } else if (v <= 2.6 && !isMLO) {
          push('BR-008', 'AGD 剂量限值 (WS 674-2020)', '剂量', '通过', `${img.view}: AGD ${v.toFixed(2)} mGy ≤ 3.0 mGy (合格)`);
          push('BR-009', 'AGD 优化目标 (ACR)', '剂量', '告警', `${img.view}: AGD ${v.toFixed(2)} mGy 超目标 2.4 mGy, 建议优化曝光参数 (告警)`);
          push('BR-010', 'CC 位 AGD 限值', '剂量', '通过', `${img.view}: AGD ${v.toFixed(2)} mGy ≤ 2.6 mGy (合格)`);
        } else if (v <= 3.0) {
          push('BR-008', 'AGD 剂量限值 (WS 674-2020)', '剂量', '通过', `${img.view}: AGD ${v.toFixed(2)} mGy ≤ 3.0 mGy (合格)`);
          push('BR-009', 'AGD 优化目标 (ACR)', '剂量', '告警', `${img.view}: AGD ${v.toFixed(2)} mGy 超目标 2.4 mGy, 建议优化曝光参数 (告警)`);
          if (isCC) push('BR-010', 'CC 位 AGD 限值', '剂量', '告警', `${img.view}: AGD ${v.toFixed(2)} mGy 超目标 2.6 mGy, 建议优化曝光参数 (告警)`);
          if (isMLO) push('BR-011', 'MLO 位 AGD 限值', '剂量', '通过', `${img.view}: AGD ${v.toFixed(2)} mGy ≤ 3.0 mGy (合格)`);
        } else {
          push('BR-008', 'AGD 剂量限值 (WS 674-2020)', '剂量', '不合格', `${img.view}: AGD ${v.toFixed(2)} mGy > 3.0 mGy 法规限值 (不合格)`);
          push('BR-009', 'AGD 优化目标 (ACR)', '剂量', '告警', `${img.view}: AGD ${v.toFixed(2)} mGy 超目标 2.4 mGy, 建议优化曝光参数 (告警)`);
        }
      }
      if (imgHits.length === 0) {
        imgHits.push({ ruleId: 'BR-000', name: '影像参数完整性', category: '投照质量', level: 'advisory', status: '告警', basis: `${img.view}: 未提供覆盖/乳头切线位/压迫/AGD 参数, 无法完整评估` });
      }
      const failed = imgHits.some((h) => h.status === '不合格');
      const warned = !failed && imgHits.some((h) => h.status === '告警');
      return { view: img.view, status: failed ? '不合格' : warned ? '告警' : '通过', hits: imgHits };
    });
    for (const img of evaluated) hits.push(...img.hits);
    const passed = hits.filter((h) => h.status === '通过').length;
    const warned = hits.filter((h) => h.status === '告警').length;
    const failed = hits.filter((h) => h.status === '不合格').length;
    return HttpResponse.json({
      success: true,
      data: {
        overall: failed > 0 ? '不合格' : warned > 0 ? '告警' : '通过',
        passed, warned, failed,
        score: hits.length > 0 ? Math.round((passed / hits.length) * 1000) / 10 : 0,
        hits, images: evaluated,
        evaluatedAt: new Date().toISOString(),
      },
    });
  }),
];
