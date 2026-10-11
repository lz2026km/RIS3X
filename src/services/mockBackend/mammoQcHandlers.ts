// [W3-A] /api/v1/mammo-qc MSW handlers
// [G005 Wave1B P1] 标注更新: 后端已实现 /mammo-qc 端点 (mammo-qc.module),
// 本 handler 仅作为 mock 模式兜底演示数据。
//   GET /mammo-qc/overview · GET /mammo-qc/records
// [G005 demo-data] 50 条质控记录全部挂接真实检查: patientId/examId/reportId ← store.list('exams')
//   (MG/TOM←MG 检查, US←US, MRI←MR), store 为空回落 EXAM_REPORT_PRE / PATIENT_MASTER;
//   每条记录附带 study/series Instance UID 与体模质控图像引用 (ACR/CDMAM/CDRH · 超声体模 · ACR MRI 体模)。
import { http, HttpResponse, delay } from 'msw';
import { list } from './store';
import { PATIENT_MASTER, PATIENT_BY_ID, DEVICE_MASTER } from '../../data/master';
import { EXAM_REPORT_PRE } from '../../data/_generators';
import { hashSeed } from '../../utils/seededRandom';

const API = '/api/v1/mammo-qc';

// 确定性延迟抖动 (无模块级 Math.random)
let delayTick = 0;
const delayMs = (min = 60, max = 180) => min + ((delayTick++ * 43) % Math.max(1, max - min));

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

// 体模质控图像引用 (mock-images 演示资源路径, 按模态区分体模类型)
const PHANTOMS_BY_MODALITY: Record<string, Array<{ type: string; model: string; imageRef: string }>> = {
  MG: [
    { type: 'ACR 乳腺体模', model: 'ACR Mammography Phantom (Gammex 075-8)', imageRef: 'mock-images/mg-phantom-acr-01.png' },
    { type: 'CDMAM 3.0', model: 'Phantom Laboratory CDMAM 3.0', imageRef: 'mock-images/mg-phantom-cdmam-01.png' },
    { type: 'FDA/CDRH 均匀性体模', model: 'CDRH Uniformity Phantom', imageRef: 'mock-images/mg-phantom-cdrh-01.png' },
  ],
  TOM: [
    { type: 'ACR 断层体模', model: 'ACR DBT Phantom', imageRef: 'mock-images/dbt-phantom-acr-01.png' },
    { type: 'CDMAM 3.0', model: 'Phantom Laboratory CDMAM 3.0', imageRef: 'mock-images/dbt-phantom-cdmam-01.png' },
  ],
  US: [
    { type: '超声通用体模', model: 'Gammex Superficial/Seneral Ultrasound Phantom', imageRef: 'mock-images/us-phantom-01.png' },
    { type: '乳腺仿真体模', model: 'CIRS Breast Ultrasound Phantom 059', imageRef: 'mock-images/us-phantom-breast-01.png' },
  ],
  MRI: [
    { type: 'ACR MRI 体模', model: 'ACR MRI Accreditation Phantom', imageRef: 'mock-images/mr-phantom-acr-01.png' },
  ],
};

// DICOM UID 根 (与 dbtHandlers 演示 UID 同根)
const UID_ROOT = '1.2.826.0.1.3680043.10.155.3.0.6.11';

interface QcExamRef {
  examId: string;
  reportId: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
}

interface MammoQcRecord {
  id: string
  date: string
  patient: string
  modality: string
  score: number
  status: '合格' | '待复评' | '不合格'
  technologist: string
  issue: string
  patientId: string
  examId: string
  reportId: string
  accessionNumber: string
  deviceId: string
  deviceModel: string
  studyInstanceUid: string
  seriesInstanceUid: string
  qcType: string
  phantom: {
    type: string
    model: string
    imageRef: string
    thicknessMm: number
    acceptance: '合格' | '待复评' | '不合格'
    checkedAt: string
  }
}

const RECORD_COUNT = 50;

function modalityExamTarget(modality: string): string {
  if (modality === 'MG' || modality === 'TOM') return 'MG';
  if (modality === 'US') return 'US';
  return 'MR';
}

function normalizeExam(row: unknown): QcExamRef | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const reportId = String(r.reportId ?? r.id ?? '');
  const patientId = String(r.patientId ?? '');
  if (!reportId || !patientId) return null;
  const person = PATIENT_BY_ID[patientId];
  const patientName = String(r.patientName ?? person?.name ?? '');
  if (!patientName) return null;
  return {
    examId: String(r.id ?? reportId),
    reportId,
    accessionNumber: String(r.accessionNumber ?? `ACC-${reportId}`),
    patientId,
    patientName,
  };
}

function collectExamsByModality(rows: unknown[], target: string): QcExamRef[] {
  const out: QcExamRef[] = [];
  const used = new Set<string>();
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    if (String((raw as Record<string, unknown>).modality ?? '') !== target) continue;
    const ref = normalizeExam(raw);
    if (!ref || used.has(ref.reportId)) continue;
    used.add(ref.reportId);
    out.push(ref);
  }
  return out;
}

function pickExamsByModality(target: string): QcExamRef[] {
  let storeRows: unknown[] = [];
  try { storeRows = list<unknown>('exams'); } catch { storeRows = []; }
  const fromStore = collectExamsByModality(storeRows, target);
  if (fromStore.length >= RECORD_COUNT / 4) return fromStore;
  const fromPre = collectExamsByModality(EXAM_REPORT_PRE, target);
  return fromStore.length > 0 ? [...fromStore, ...fromPre.filter((r) => !fromStore.some((s) => s.reportId === r.reportId))] : fromPre;
}

function masterFallbackFor(target: string, index: number): QcExamRef | null {
  const wanted = target === 'MR' ? 'MR' : target;
  const pool = PATIENT_MASTER.filter((p) => p.modality === wanted);
  const p = pool[index % Math.max(1, pool.length)] ?? PATIENT_MASTER[index % PATIENT_MASTER.length];
  if (!p) return null;
  const seq = String(index + 1).padStart(5, '0');
  return {
    examId: `EXAM-QC-FB-${seq}`,
    reportId: `RPT-QC-FB-${seq}`,
    accessionNumber: `ACC-QC-FB-${seq}`,
    patientId: p.id,
    patientName: p.name,
  };
}

function deviceFor(modality: string, index: number): { id: string; model: string } {
  const wanted = modality === 'TOM' ? 'MG' : modality === 'MRI' ? 'MR' : modality;
  const pool = DEVICE_MASTER.filter((d) => d.modality === wanted);
  const d = pool[index % Math.max(1, pool.length)];
  if (d) return { id: d.id, model: d.model };
  return { id: `${wanted}-QC-${String(index + 1).padStart(2, '0')}`, model: `${wanted} Demo Unit` };
}

function buildRecords(): MammoQcRecord[] {
  const pools: Record<string, QcExamRef[]> = {
    MG: pickExamsByModality('MG'),
    US: pickExamsByModality('US'),
    MR: pickExamsByModality('MR'),
  };
  const usedPick = { MG: 0, US: 0, MR: 0 };
  const out: MammoQcRecord[] = [];

  for (let i = 0; i < RECORD_COUNT; i += 1) {
    const modality = MODALITIES[i % MODALITIES.length] ?? 'MG';
    const target = modalityExamTarget(modality);
    const pool = pools[target] ?? [];
    const pickIdx = usedPick[target as 'MG' | 'US' | 'MR'] ?? 0;
    let exam = pool.length > 0 ? (pool[pickIdx % pool.length] ?? null) : null;
    if (exam && pool.length > 0) usedPick[target as 'MG' | 'US' | 'MR'] = pickIdx + 1;
    if (!exam) exam = masterFallbackFor(target, i);
    const examRef: QcExamRef = exam ?? {
      examId: `EXAM-QC-${String(i + 1).padStart(3, '0')}`,
      reportId: `RPT-QC-${String(i + 1).padStart(3, '0')}`,
      accessionNumber: `ACC-QC-${String(i + 1).padStart(3, '0')}`,
      patientId: `P-QC-${String(i + 1).padStart(3, '0')}`,
      patientName: `患者${String.fromCharCode(65 + (i % 26))}${i}`,
    };

    // 确定性评分 55-100 (合格 ≥80 / 待复评 60-79 / 不合格 <60)
    const score = 55 + (hashSeed(`mammo-qc-${i + 1}:${examRef.reportId}`) % 46);
    const status: MammoQcRecord['status'] = score >= 80 ? '合格' : score >= 60 ? '待复评' : '不合格';
    const day = 5 + (i % 24);
    const date = `2026-${String(1 + (i % 5)).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const device = deviceFor(modality, i);
    const phantomPool = PHANTOMS_BY_MODALITY[modality] ?? PHANTOMS_BY_MODALITY.MG ?? [];
    const phantomDef = phantomPool[i % Math.max(1, phantomPool.length)] ?? { type: '体模', model: 'Demo Phantom', imageRef: 'mock-images/phantom-01.png' };
    const uidDate = date.replace(/-/g, '');
    const seq = String(i + 1).padStart(4, '0');

    out.push({
      id: `mam-qc-${i + 1}`,
      date,
      patient: examRef.patientName,
      modality,
      score,
      status,
      technologist: TECHNOLOGISTS[i % TECHNOLOGISTS.length] ?? '王芳',
      issue: score < 70 ? '压缩不足' : score < 80 ? '定位偏移' : '',
      patientId: examRef.patientId,
      examId: examRef.examId,
      reportId: examRef.reportId,
      accessionNumber: examRef.accessionNumber,
      deviceId: device.id,
      deviceModel: device.model,
      studyInstanceUid: `${UID_ROOT}.${uidDate}.${examRef.accessionNumber}`,
      seriesInstanceUid: `${UID_ROOT}.${uidDate}.${examRef.accessionNumber}.S.${i + 1}`,
      qcType: modality === 'US' || modality === 'MRI' ? '设备质控' : '体模质控',
      phantom: {
        type: phantomDef.type,
        model: phantomDef.model,
        imageRef: phantomDef.imageRef,
        thicknessMm: 20 + (hashSeed(`phantom:${seq}`) % 45),
        acceptance: status,
        checkedAt: `${date}T08:${String(i % 60).padStart(2, '0')}:00`,
      },
    });
  }
  return out;
}

let RECORDS: MammoQcRecord[] = [];
let seeded = false;

// 幂等种子: 首个路由命中时构建 (store 为空则回落生成器 / 主数据)
function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  RECORDS = buildRecords();
}

// 路由统一入口: 先确保种子就绪, 再执行确定性 delay
function routeDelay(ms: number): Promise<void> {
  ensureSeeded();
  return delay(ms);
}

export const mammoQcHandlers = [
  http.get(`${API}/overview`, async () => {
    await routeDelay(delayMs());
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
    await routeDelay(delayMs());
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    const items = search
      ? RECORDS.filter((r) =>
          r.patient.toLowerCase().includes(search) ||
          r.technologist.toLowerCase().includes(search) ||
          r.patientId.toLowerCase().includes(search) ||
          r.studyInstanceUid.toLowerCase().includes(search))
      : RECORDS;
    return HttpResponse.json({
      success: true,
      data: {
        source: 'demo',
        generatedAt: new Date().toISOString(),
        data: items.map((r) => ({ ...r, phantom: { ...r.phantom } })),
      },
      meta: { total: items.length, linkedExams: RECORDS.filter((r) => !r.examId.startsWith('EXAM-QC')).length },
    });
  }),

  // [G005 Wave1A W9] 质控测试项 / 标准 / 统计 (与后端 mammo-qc.controller 对齐)
  http.get(`${API}/tests`, async () => {
    await routeDelay(delayMs());
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
    await routeDelay(delayMs());
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
    await routeDelay(delayMs());
    const total = RECORDS.length;
    const pass = RECORDS.filter((r) => r.status === '合格').length;
    const review = RECORDS.filter((r) => r.status === '待复评').length;
    const fail = RECORDS.filter((r) => r.status === '不合格').length;
    const byModality: Record<string, number> = {};
    for (const r of RECORDS) byModality[r.modality] = (byModality[r.modality] ?? 0) + 1;
    return HttpResponse.json({
      success: true,
      data: {
        source: 'demo',
        generatedAt: new Date().toISOString(),
        data: {
          totalRecords: total,
          passRate: total > 0 ? Math.round((pass / total) * 1000) / 10 : 0,
          reviewRate: total > 0 ? Math.round((review / total) * 1000) / 10 : 0,
          failRate: total > 0 ? Math.round((fail / total) * 1000) / 10 : 0,
          avgScore: total > 0 ? Math.round((RECORDS.reduce((s, r) => s + r.score, 0) / total) * 10) / 10 : 0,
          byModality,
          byTechnologist: TECHNOLOGISTS.map((name) => {
            const own = RECORDS.filter((r) => r.technologist === name);
            const ownAvg = own.length > 0 ? Math.round((own.reduce((s, r) => s + r.score, 0) / own.length) * 10) / 10 : 0;
            return { technologist: name, count: own.length, avgScore: ownAvg };
          }),
        },
      },
    });
  }),

  // [G-21 Wave3C] 乳腺质控规则列表 (15 条 seed, 与后端 mammo-qc.service 对齐)
  http.get(`${API}/breast-rules`, async () => {
    await routeDelay(delayMs());
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
    await routeDelay(delayMs(80, 200));
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
