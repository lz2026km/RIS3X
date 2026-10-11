// [Phase 2] /api/v1/screening MSW handlers — 早癌筛查队列 + 统计
// [G005 demo-data] 30 例乳腺筛查 episode: MG/DBT/US 三联投照 (CC/MLO + 断层 + 超声),
//   BI-RADS 0-5 分级分布, 腺体密度 A-D, 随访召回 (recall) 率;
//   patientId·examId·reportId ← store.list('exams') (modality MG / US-乳腺),
//   store 为空依次回落 EXAM_REPORT_PRE → PATIENT_MASTER (MG/US 女性患者);
//   aiCad ← aiDiagnosisHandlers breast-cad 种子 (BREAST-001..004 共享 studyId,
//     其余按 BSyyyymmdd-nnn 约定 + BREAST-AN-<fnv1aAbs(studyId)> 由 POST /breast-cad/analyze 解析);
//   dbt ← dbtHandlers (DBT-STUDY-CURRENT / DBT-STUDY-PRIOR 及其 series UID)。
import { http, HttpResponse, delay } from 'msw';
import { v4 as uuidv4 } from 'uuid';
import { list } from './store';
import { PATIENT_MASTER, PATIENT_BY_ID } from '../../data/master';
import { EXAM_REPORT_PRE } from '../../data/_generators';
import { hashSeed, mulberry32 } from '../../utils/seededRandom';

const API = '/api/v1/screening';

// 确定性延迟抖动 (无模块级 Math.random)
let delayTick = 0;
const delayMs = (min = 60, max = 200) => min + ((delayTick++ * 41) % Math.max(1, max - min));

function rngFor(tag: string): () => number {
  return mulberry32(hashSeed(tag));
}

// 与 aiDiagnosisHandlers.hashStr 同源 (FNV-1a + Math.abs) — 推导 BREAST-AN-* 结果 id
function fnv1aAbs(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const EPISODE_COUNT = 30;
const BREAST_CAD_MODEL = 'breastcad-v2.8.0';

// BI-RADS 0-5 分布 (0×2 · 1×9 · 2×9 · 3×4 · 4A×3 · 4B×1 · 4C×1 · 5×1 = 30, 4+ 共 6 例)
const BI_RADS_PLAN = [
  '1', '2', '1', '3', '0', '2', '1', '4A', '2', '1',
  '3', '2', '1', '4B', '2', '3', '1', '0', '2', '4A',
  '1', '2', '3', '4C', '1', '2', '5', '1', '4A', '2',
] as const;

// 腺体密度 A-D (脂肪型→极度致密)
const DENSITY_PLAN = ['b', 'c', 'a', 'd', 'b', 'c', 'b', 'a', 'd', 'c', 'b', 'a', 'c', 'b', 'd', 'c', 'a', 'b', 'd', 'c', 'b', 'a', 'c', 'd', 'b', 'c', 'a', 'b', 'c', 'd'] as const;
const DENSITY_LABELS: Record<string, string> = { a: 'a 脂肪型', b: 'b 散在纤维腺体型', c: 'c 不均匀致密型', d: 'd 极度致密型' };

const INSTITUTIONS = [
  '山东省立医院乳腺中心', '河南省人民医院放射科', '华西医院乳腺外科', '广东省人民医院影像科',
  '南京鼓楼医院放射科', '浙大一院乳腺中心', '湘雅医院放射科', '西京医院放射科',
];

// 与 aiDiagnosisHandlers.breastResults 种子直接对齐 (共享 studyId → 双向可查)
const BREAST_AI_SEEDS = [
  { resultId: 'BREAST-001', studyId: 'BS20260715-002', overallBiRads: '4C' },
  { resultId: 'BREAST-002', studyId: 'BS20260716-005', overallBiRads: '3' },
  { resultId: 'BREAST-003', studyId: 'BS20260720-009', overallBiRads: '4B' },
  { resultId: 'BREAST-004', studyId: 'BS20260724-014', overallBiRads: '4A' },
];

// dbtHandlers 两个演示 study 的真实 UID (DBT-STUDY-CURRENT / DBT-STUDY-PRIOR)
const DBT_CURRENT_UID = '1.2.826.0.1.3680043.10.155.3.0.6.11.20260310.ACC-SAMPLE-0005';
const DBT_PRIOR_UID = '1.2.826.0.1.3680043.10.155.3.0.6.11.20251102.ACC-SAMPLE-0006';

// ==================== 筛查锚点 (store.exams → 乳腺筛查) ====================
interface ScreeningAnchor {
  examId: string;
  reportId: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  age: number;
  phone: string;
  examAt: string;
}

function normalizeExam(row: unknown): ScreeningAnchor | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const reportId = String(r.reportId ?? r.id ?? '');
  const patientId = String(r.patientId ?? '');
  if (!reportId || !patientId) return null;
  const person = PATIENT_BY_ID[patientId];
  const patientName = String(r.patientName ?? person?.name ?? '');
  if (!patientName) return null;
  const ageRaw = r.patientAge ?? r.age;
  const ageNum = typeof ageRaw === 'number' ? ageRaw : Number(ageRaw);
  return {
    examId: String(r.id ?? reportId),
    reportId,
    accessionNumber: String(r.accessionNumber ?? `ACC-${reportId}`),
    patientId,
    patientName,
    age: Number.isFinite(ageNum) ? ageNum : (person?.age ?? 50),
    phone: String(person?.phone ?? ''),
    examAt: String(r.examAt ?? r.examDate ?? ''),
  };
}

function isBreastExam(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  const modality = String(r.modality ?? '');
  const text = `${String(r.bodyPart ?? '')} ${String(r.examItem ?? r.examItemName ?? '')}`;
  if (modality === 'MG') return true;
  return modality === 'US' && /乳腺/.test(text);
}

function pickAnchors(count: number): ScreeningAnchor[] {
  const used = new Set<string>();
  const out: ScreeningAnchor[] = [];
  const push = (a: ScreeningAnchor | null): void => {
    if (!a || out.length >= count || used.has(a.reportId)) return;
    used.add(a.reportId);
    out.push(a);
  };
  const collect = (rows: unknown[]): ScreeningAnchor[] =>
    rows.filter(isBreastExam).map(normalizeExam).filter((a): a is ScreeningAnchor => a !== null);

  const pools: ScreeningAnchor[][] = [];
  let storeRows: unknown[] = [];
  try { storeRows = list<unknown>('exams'); } catch { storeRows = []; }
  pools.push(collect(storeRows));
  pools.push(collect(EXAM_REPORT_PRE));

  for (const pool of pools) {
    if (pool.length === 0 || out.length >= count) continue;
    const strideCount = Math.min(count - out.length, pool.length);
    const step = pool.length / strideCount;
    for (let i = 0; i < strideCount; i += 1) push(pool[Math.floor(i * step)] ?? null);
    for (const row of pool) {
      if (out.length >= count) break;
      push(row);
    }
  }

  if (out.length < count) {
    // store + 生成器同时不可用: PATIENT_MASTER MG / 乳腺US 女性患者兜底
    const masterPool = PATIENT_MASTER.filter((p) => p.gender === '女' && (p.modality === 'MG' || (p.modality === 'US' && p.bodyPart.includes('乳腺'))));
    const fallback = masterPool.length >= count - out.length ? masterPool : PATIENT_MASTER.filter((p) => p.gender === '女');
    fallback.forEach((p, i) => {
      if (out.length >= count) return;
      const seq = String(i + 1).padStart(5, '0');
      push({
        examId: `EXAM-SCR-FB-${seq}`,
        reportId: `RPT-SCR-FB-${seq}`,
        accessionNumber: `ACC-SCR-FB-${seq}`,
        patientId: p.id,
        patientName: p.name,
        age: p.age,
        phone: p.phone,
        examAt: p.examDate,
      });
    });
  }
  return out;
}

function dateCompact(examAt: string, fallback: string): string {
  const d = String(examAt).slice(0, 10).replace(/-/g, '');
  return /^\d{8}$/.test(d) ? d : fallback;
}

function addMonths(isoDate: string, months: number): string {
  const base = new Date(`${String(isoDate).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return '';
  base.setUTCMonth(base.getUTCMonth() + months);
  return base.toISOString().slice(0, 10);
}

function statusFor(birads: string, i: number): string {
  if (i % 9 === 4) return '已登记';
  if (i % 9 === 6) return '筛查中';
  if (birads === '0') return '异常';
  if (i % 11 === 8) return '待审核';
  return '已完成';
}

function resultFor(birads: string, status: string): string {
  if (status === '异常') return '需进一步检查';
  if (status !== '已完成') return '-';
  return birads === '1' || birads === '2' ? '阴性' : '阳性';
}

function recallFor(birads: string): { recall: boolean; recallReason: string; followUpMonths: number } {
  if (birads === '0') return { recall: true, recallReason: '需补充压迫点压/放大摄影或超声评估', followUpMonths: 0 };
  if (birads === '3') return { recall: true, recallReason: '可能良性, 6 个月短期随访', followUpMonths: 6 };
  if (birads === '4A' || birads === '4B' || birads === '4C') return { recall: true, recallReason: '可疑恶性, 建议空芯针活检', followUpMonths: 0 };
  if (birads === '5') return { recall: true, recallReason: '高度怀疑恶性, 活检并临床干预', followUpMonths: 0 };
  return { recall: false, recallReason: '', followUpMonths: 12 };
}

function buildViews(screenType: string, seq: string): Array<{ modality: string; view: string; laterality: 'L' | 'R'; imageCount: number }> {
  const mgModality = screenType === 'DBT' ? 'DBT' : 'MG';
  const mgImages = screenType === 'DBT' ? 15 : 2;
  return [
    { modality: mgModality, view: 'CC-L', laterality: 'L', imageCount: mgImages },
    { modality: mgModality, view: 'MLO-L', laterality: 'L', imageCount: mgImages },
    { modality: mgModality, view: 'CC-R', laterality: 'R', imageCount: mgImages },
    { modality: mgModality, view: 'MLO-R', laterality: 'R', imageCount: mgImages },
    { modality: 'US', view: 'US-左乳轴向', laterality: 'L', imageCount: 1 + (hashSeed(`us:${seq}:L`) % 6) },
    { modality: 'US', view: 'US-右乳轴向', laterality: 'R', imageCount: 1 + (hashSeed(`us:${seq}:R`) % 6) },
  ];
}

function buildQueue(): any[] {
  const anchors = pickAnchors(EPISODE_COUNT);
  const episodes = anchors.map((anchor, i) => {
    const seq = String(i + 1).padStart(3, '0');
    const birads = BI_RADS_PLAN[i] ?? '1';
    const density = DENSITY_PLAN[i] ?? 'b';
    const screenType = (['MG', 'DBT', '乳腺超声'] as const)[i % 3] ?? 'MG';
    const status = statusFor(birads, i);
    const result = resultFor(birads, status);
    const { recall, recallReason, followUpMonths } = recallFor(birads);
    const screenDate = String(anchor.examAt).slice(0, 10) || `2026-06-${String((i % 23) + 1).padStart(2, '0')}`;
    const rand = rngFor(`screening:${seq}:${anchor.patientId}`);

    return {
      id: `SC-2026-${seq}`,
      examId: anchor.examId,
      reportId: anchor.reportId,
      accessionNumber: anchor.accessionNumber,
      patientId: anchor.patientId,
      patientName: anchor.patientName,
      age: anchor.age,
      gender: '女',
      phone: anchor.phone || `13${Math.floor(rand() * 9) + 1}${String(10000000 + (hashSeed(anchor.patientId) % 89999999)).slice(0, 8)}`,
      screenType,
      protocol: 'MG+DBT+US 三联筛查',
      screenDate,
      status,
      result,
      rads: status === '已登记' || status === '筛查中' ? '-' : `BI-RADS ${birads}`,
      birads,
      density,
      densityLabel: DENSITY_LABELS[density] ?? density,
      views: buildViews(screenType, seq),
      recall,
      recallReason,
      followUp: {
        required: recall || followUpMonths === 12,
        intervalMonths: followUpMonths,
        dueDate: addMonths(screenDate, followUpMonths || 1),
        reason: recall ? recallReason : '年度常规筛查',
      },
      institution: INSTITUTIONS[i % INSTITUTIONS.length] ?? '本院放射科',
      markDoctor: status === '已完成' ? `乳腺${['王', '李', '张', '刘', '陈'][i % 5]}医生` : '-',
      markedAt: status === '已完成' ? `${screenDate}T10:${String(i % 60).padStart(2, '0')}:00` : undefined,
      // DBT 阅片联动: 前 2 例 DBT 筛查直接指向 dbtHandlers 演示 study
      dbt: null as null | { studyId: string; priorStudyId?: string; seriesUids: string[]; source: string },
      aiCad: {
        resultId: '',
        studyId: '',
        modelVersion: BREAST_CAD_MODEL,
        link: 'analyze-ready' as 'seed' | 'analyze-ready',
        endpoint: '/api/v1/ai-diagnosis/breast-cad',
      },
    };
  });

  // aiCad 链接: BI-RADS 与种子分级匹配的 episode 直连 BREAST-001..004, 其余按 analyze 约定
  const seedUsed = new Set<string>();
  for (const seed of BREAST_AI_SEEDS) {
    const hit = episodes.find((e) => e.birads === seed.overallBiRads && !seedUsed.has(e.id));
    if (hit) {
      hit.aiCad = {
        resultId: seed.resultId,
        studyId: seed.studyId,
        modelVersion: BREAST_CAD_MODEL,
        link: 'seed',
        endpoint: '/api/v1/ai-diagnosis/breast-cad',
      };
      seedUsed.add(hit.id);
    }
  }
  for (const e of episodes) {
    if (e.aiCad.link === 'seed') continue;
    const studyId = `BS${dateCompact(e.screenDate, '20260601')}-${e.id.slice(-3)}`;
    e.aiCad.studyId = studyId;
    e.aiCad.resultId = `BREAST-AN-${fnv1aAbs(studyId)}`;
  }

  // dbt 链接: DBT 筛查类型 episode 挂接 dbtHandlers study (第 1 例当次, 第 2 例既往对照)
  let dbtLinked = 0;
  for (const e of episodes) {
    if (e.screenType !== 'DBT') continue;
    dbtLinked += 1;
    if (dbtLinked === 1) {
      e.dbt = { studyId: 'DBT-STUDY-CURRENT', priorStudyId: 'DBT-STUDY-PRIOR', seriesUids: [`${DBT_CURRENT_UID}.S.5`, `${DBT_CURRENT_UID}.S.6`], source: 'dbtHandlers' };
    } else if (dbtLinked === 2) {
      e.dbt = { studyId: 'DBT-STUDY-PRIOR', seriesUids: [`${DBT_PRIOR_UID}.S.7`, `${DBT_PRIOR_UID}.S.8`], source: 'dbtHandlers' };
    }
  }

  return episodes;
}

let QUEUE: any[] = [];
let seeded = false;

// 幂等种子: 首个路由命中时构建
function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  QUEUE = buildQueue();
}

function routeDelay(ms: number): Promise<void> {
  ensureSeeded();
  return delay(ms);
}

const STATS = {
  ldctCount: 8642,
  breastCount: 5826,
  highRiskCount: 1284,
  earlyCancerCount: 326,
  birads4Plus: 412,
  monthlyNew: 628,
};

export const screeningHandlers = [
  http.get(`${API}/stats`, async () => {
    await routeDelay(delayMs());
    const birads4PlusEpisodes = QUEUE.filter((q) => ['4A', '4B', '4C', '5'].includes(String(q.birads))).length;
    const recallCount = QUEUE.filter((q) => q.recall === true).length;
    const densityBreakdown: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
    for (const q of QUEUE) densityBreakdown[String(q.density)] = (densityBreakdown[String(q.density)] ?? 0) + 1;
    return HttpResponse.json({
      success: true,
      data: {
        ...STATS,
        // 本队列 30 例 episode 的队列级统计 (与项目级累计统计并存)
        episodeTotal: QUEUE.length,
        episodeBirads4Plus: birads4PlusEpisodes,
        episodeRecallCount: recallCount,
        episodeRecallRate: QUEUE.length > 0 ? Math.round((recallCount / QUEUE.length) * 1000) / 10 : 0,
        episodeDensityBreakdown: densityBreakdown,
      },
    });
  }),

  http.get(`${API}/queue`, async ({ request }) => {
    await routeDelay(delayMs());
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('screenType');
    const keyword = (url.searchParams.get('keyword') || '').toLowerCase();
    let items = QUEUE;
    if (status && status !== '全部') items = items.filter(i => i.status === status);
    if (type && type !== '全部') items = items.filter(i => i.screenType === type);
    if (keyword) {
      items = items.filter(i =>
        i.patientName.toLowerCase().includes(keyword) ||
        i.patientId.toLowerCase().includes(keyword) ||
        i.examId.toLowerCase().includes(keyword),
      );
    }
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),

  // 筛查标记（把检查标记为某类筛查并记录）
  http.post(`${API}/queue/:id/mark`, async ({ params, request }) => {
    await routeDelay(delayMs(80, 200));
    const body = (await request.json()) as any;
    const item = QUEUE.find(q => q.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    item.status = '筛查中';
    item.screenType = body?.screenType || item.screenType;
    item.markDoctor = body?.doctor || item.markDoctor;
    item.markedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: item });
  }),

  // 更新状态（完成/异常）
  http.post(`${API}/queue/:id/status`, async ({ params, request }) => {
    await routeDelay(delayMs(80, 200));
    const body = (await request.json()) as any;
    const item = QUEUE.find(q => q.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 });
    item.status = body?.status || item.status;
    if (body?.status === '已完成') {
      const positive = rngFor(`screening:status:${item.id}:${delayTick++}`)() > 0.6;
      item.result = body?.result || (positive ? '阳性' : '阴性');
      const isBreast = ['MG', 'DBT', '乳腺超声'].includes(String(item.screenType));
      item.rads = isBreast
        ? (item.result === '阳性' ? 'BI-RADS 4A' : 'BI-RADS 2')
        : (item.result === '阳性' ? 'Lung-RADS 4A' : 'Lung-RADS 2');
    }
    return HttpResponse.json({ success: true, data: item });
  }),

  // 月度趋势（统计图, 确定性种子 → 刷新不抖动）
  http.get(`${API}/trend`, async () => {
    await routeDelay(delayMs());
    const months = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
    return HttpResponse.json({
      success: true,
      data: months.map((month, i) => {
        const rand = rngFor(`screening:trend:${month}`);
        return {
          month,
          screenings: 580 + i * 55 + Math.floor(rand() * 40),
          detections: 15 + i * 2 + Math.floor(rand() * 4),
          rate: Number((2.8 + i * 0.06).toFixed(2)),
        };
      }),
    });
  }),

  // 生成新筛查任务
  http.post(`${API}/queue`, async ({ request }) => {
    await routeDelay(delayMs());
    const body = (await request.json()) as any;
    const item = {
      id: `SC-${uuidv4().slice(0, 8).toUpperCase()}`,
      examId: `E2026${String(9000 + QUEUE.length)}`,
      reportId: `RPT-NEW-${String(9000 + QUEUE.length)}`,
      accessionNumber: `ACC-NEW-${String(9000 + QUEUE.length)}`,
      patientId: body?.patientId || `P2026${String(9000 + QUEUE.length)}`,
      patientName: body?.patientName || '新筛查患者',
      age: body?.age || 50,
      gender: body?.gender || '女',
      phone: body?.phone || '',
      screenType: body?.screenType || 'MG',
      protocol: 'MG+DBT+US 三联筛查',
      screenDate: new Date().toISOString().slice(0, 10),
      status: '已登记',
      result: '-',
      rads: '-',
      birads: '',
      density: '',
      densityLabel: '',
      views: [],
      recall: false,
      recallReason: '',
      followUp: { required: false, intervalMonths: 0, dueDate: '', reason: '' },
      institution: body?.institution || '本院放射科',
      markDoctor: '-',
      dbt: null,
      aiCad: { resultId: '', studyId: '', modelVersion: BREAST_CAD_MODEL, link: 'analyze-ready' as const, endpoint: '/api/v1/ai-diagnosis/breast-cad' },
    };
    QUEUE = [item, ...QUEUE];
    return HttpResponse.json({ success: true, data: item });
  }),
];
