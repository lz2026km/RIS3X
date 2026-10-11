// [v3.0.6.11-71] /api/v1/cardiac MSW handlers — 心脏专科分析
// [G005 demo-data] 25 例冠脉 CTA 分析种子 (钙化积分 / EF% / 狭窄率% / CAD-RADS / 血管分析 overlay):
//   patientId·examId·reportId ← store.list('exams') (modality CT + bodyPart/examItem/临床诊断 心脏·冠脉·胸痛),
//   store 为空依次回落 EXAM_REPORT_PRE → PATIENT_MASTER (CT 冠脉/心脏检查项);
//   ai 链接 ← aiDiagnosisHandlers /ai-diagnosis/cardiac-ai:
//     · CARDIAC-001/002/003 种子直接共享 studyId (CS20260713-001 / CS20260716-004 / CS20260719-008),
//     · 其余 22 例 studyId 按 CSyyyymmdd-nnn 约定生成, ai.resultId = CARDIAC-AN-<fnv1aAbs(studyId)>,
//       与 aiDiagnosisHandlers.hashStr 同源, POST /cardiac-ai/analyze/:studyId 可解析同一结果。
import { http, HttpResponse, delay } from 'msw';
import { parseQuery } from './queryBuilder';
import { v4 as uuidv4 } from 'uuid';
import { list } from './store';
import { PATIENT_MASTER, PATIENT_BY_ID } from '../../data/master';
import { EXAM_REPORT_PRE } from '../../data/_generators';
import { hashSeed, mulberry32 } from '../../utils/seededRandom';

const API = '/api/v1/cardiac';

// 确定性延迟抖动 (无模块级 Math.random)
let delayTick = 0;
const delayMs = (min = 30, max = 100) => min + ((delayTick++ * 37) % Math.max(1, max - min));

function rngFor(tag: string): () => number {
  return mulberry32(hashSeed(tag));
}

// 与 aiDiagnosisHandlers.hashStr 同源 (FNV-1a + Math.abs) — 推导 CARDIAC-AN-* 结果 id
function fnv1aAbs(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const AI_MODEL_VERSION = 'cardiacai-v2.4.1';
const RECORD_COUNT = 25;

// ==================== 冠脉 CTA 种子类型 ====================
type CadRads = '0' | '1' | '2' | '3' | '4' | '5';
type CardiacSeverity = 'normal' | 'mild' | 'moderate' | 'severe' | 'occluded';
type PlaqueType = 'none' | 'calcified' | 'mixed' | 'non-calcified';

interface CalciumScore {
  totalAgatston: number;
  lm: number;
  lad: number;
  lcx: number;
  rca: number;
  percentile: number;
  category: string;
}

// CAD-RADS 0-5 分布: 0×3 · 1×4 · 2×5 · 3×5 · 4×5 · 5×3 = 25; 前 3 例对齐 aiDiagnosisHandlers 种子分级
const CAD_RADS_PLAN: CadRads[] = [
  '3', '2', '4', '0', '1', '3', '5', '2', '4', '1',
  '0', '3', '2', '4', '5', '1', '3', '0', '2', '4',
  '5', '1', '3', '2', '4',
];

// 与 aiDiagnosisHandlers.cardiacResults 前 3 条 CT 种子直接对齐 (共享 studyId → 双向可查)
interface AiSeedLink {
  resultId: string;
  studyId: string;
  ejectionFraction: number;
  lvEdvMl: number;
  lvEsvMl: number;
  lvMassG: number;
  agatston: number | null;
  stenoses: Array<{ vessel: string; segment: string; stenosisPercent: number; severity: CardiacSeverity; calcified: boolean }>;
}

const AI_SEED_LINKS: AiSeedLink[] = [
  {
    resultId: 'CARDIAC-001', studyId: 'CS20260713-001',
    ejectionFraction: 45, lvEdvMl: 128, lvEsvMl: 70, lvMassG: 168, agatston: 452,
    stenoses: [
      { vessel: 'LAD', segment: '近段', stenosisPercent: 65, severity: 'moderate', calcified: true },
      { vessel: 'LCX', segment: '中段', stenosisPercent: 30, severity: 'mild', calcified: true },
      { vessel: 'RCA', segment: '近段', stenosisPercent: 15, severity: 'mild', calcified: false },
    ],
  },
  {
    resultId: 'CARDIAC-002', studyId: 'CS20260716-004',
    ejectionFraction: 58, lvEdvMl: 110, lvEsvMl: 46, lvMassG: 118, agatston: 214,
    stenoses: [
      { vessel: 'LCX', segment: '远段', stenosisPercent: 45, severity: 'mild', calcified: true },
    ],
  },
  {
    resultId: 'CARDIAC-003', studyId: 'CS20260719-008',
    ejectionFraction: 32, lvEdvMl: 142, lvEsvMl: 96, lvMassG: 210, agatston: 895,
    stenoses: [
      { vessel: 'LAD', segment: '近段', stenosisPercent: 90, severity: 'severe', calcified: true },
      { vessel: 'LM', segment: '开口部', stenosisPercent: 55, severity: 'moderate', calcified: true },
      { vessel: 'RCA', segment: '中段', stenosisPercent: 80, severity: 'severe', calcified: false },
    ],
  },
];

const VESSEL_LABELS: Record<string, string> = { LM: '左主干', LAD: '左前降支', LCX: '左回旋支', RCA: '右冠状动脉' };
const VESSEL_DEFS: Array<{ vessel: string; segments: string[] }> = [
  { vessel: 'LM', segments: ['开口部', '体部'] },
  { vessel: 'LAD', segments: ['近段', '中段', '远段'] },
  { vessel: 'LCX', segments: ['近段', '中段', '远段'] },
  { vessel: 'RCA', segments: ['近段', '中段', '远段'] },
];
const SEVERITY_LABELS: Record<CardiacSeverity, string> = { normal: '正常', mild: '轻度', moderate: '中度', severe: '重度', occluded: '闭塞' };
const PLAQUE_LABELS: Record<PlaqueType, string> = { none: '无斑块', calcified: '钙化斑块', mixed: '混合斑块', 'non-calcified': '非钙化斑块' };

function severityOf(pct: number): CardiacSeverity {
  if (pct >= 100) return 'occluded';
  if (pct >= 70) return 'severe';
  if (pct >= 30) return 'moderate';
  if (pct > 0) return 'mild';
  return 'normal';
}

function overlayFor(tag: string): { x: number; y: number; width: number; height: number } {
  const r = rngFor(`overlay:${tag}`);
  return {
    x: 40 + Math.floor(r() * 300),
    y: 50 + Math.floor(r() * 260),
    width: 24 + Math.floor(r() * 60),
    height: 12 + Math.floor(r() * 36),
  };
}

function calciumCategory(agatston: number): string {
  if (agatston <= 0) return '无钙化 (0)';
  if (agatston < 100) return '极少钙化 (1-99)';
  if (agatston < 400) return '轻度钙化 (100-399)';
  if (agatston < 1000) return '中度钙化 (400-999)';
  return '重度钙化 (≥1000)';
}

function buildCalcium(agatston: number, tag: string): CalciumScore {
  const r = rngFor(`ca:${tag}`);
  const lad = Math.round(agatston * (0.45 + r() * 0.2));
  const rca = Math.round(agatston * (0.12 + r() * 0.12));
  const lcx = Math.round(agatston * (0.08 + r() * 0.1));
  const lm = Math.max(0, agatston - lad - rca - lcx);
  return {
    totalAgatston: agatston,
    lm, lad, lcx, rca,
    percentile: Math.min(99, Math.round(Math.sqrt(agatston) * 2.2)),
    category: calciumCategory(agatston),
  };
}

function agatstonForGrade(grade: CadRads, rand: () => number): number {
  const ranges: Record<CadRads, [number, number]> = {
    '0': [0, 0], '1': [1, 99], '2': [100, 399], '3': [400, 999], '4': [1000, 1999], '5': [1000, 2599],
  };
  const [lo, hi] = ranges[grade] ?? [0, 0];
  return lo + Math.floor(rand() * (hi - lo + 1));
}

function efForGrade(grade: CadRads, rand: () => number): number {
  if (grade === '0' || grade === '1' || grade === '2') return 56 + Math.floor(rand() * 14);
  if (grade === '3') return 45 + Math.floor(rand() * 16);
  if (grade === '4') return 35 + Math.floor(rand() * 20);
  return 25 + Math.floor(rand() * 25);
}

// ==================== 检查锚点 (store.exams → 心脏 CTA) ====================
interface CtaAnchor {
  examId: string;
  reportId: string;
  patientId: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  examItem: string;
  examAt: string;
  accessionNumber: string;
  patientGender: string;
  patientAge: number;
  clinicalDiagnosis: string;
}

const CARDIAC_TEXT = /心脏|冠脉|胸痛|心血管|胸闷|心悸|心绞痛|冠心病|心肌梗死|心力衰竭|心律失常/;

function normalizeExam(row: unknown): CtaAnchor | null {
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
    patientId,
    patientName,
    modality: String(r.modality ?? 'CT'),
    bodyPart: String(r.bodyPart ?? ''),
    examItem: String(r.examItem ?? r.examItemName ?? ''),
    examAt: String(r.examAt ?? r.examDate ?? ''),
    accessionNumber: String(r.accessionNumber ?? `ACC-${reportId}`),
    patientGender: String(r.patientGender ?? r.gender ?? person?.gender ?? '男'),
    patientAge: Number.isFinite(ageNum) ? ageNum : (person?.age ?? 0),
    clinicalDiagnosis: String(r.clinicalDiagnosis ?? person?.clinicalDiagnosis ?? ''),
  };
}

function isCardiacCta(a: CtaAnchor): boolean {
  if (a.modality !== 'CT') return false;
  const text = `${a.bodyPart} ${a.examItem} ${a.clinicalDiagnosis}`;
  return CARDIAC_TEXT.test(text);
}

function pickCtaAnchors(count: number): CtaAnchor[] {
  const used = new Set<string>();
  const out: CtaAnchor[] = [];
  const push = (a: CtaAnchor | null): void => {
    if (!a || out.length >= count || used.has(a.reportId)) return;
    used.add(a.reportId);
    out.push(a);
  };
  const collect = (rows: unknown[]): CtaAnchor[] =>
    rows.map(normalizeExam).filter((a): a is CtaAnchor => a !== null && isCardiacCta(a));

  const pools: CtaAnchor[][] = [];
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
    // store + 生成器同时不可用: PATIENT_MASTER CT 冠脉/心脏 检查项兜底
    const masterCardiac = PATIENT_MASTER.filter((p) => p.modality === 'CT' && CARDIAC_TEXT.test(`${p.bodyPart} ${p.examItem} ${p.clinicalDiagnosis}`));
    const fallbackPool = masterCardiac.length >= count - out.length ? masterCardiac : PATIENT_MASTER.filter((p) => p.modality === 'CT');
    fallbackPool.forEach((p, i) => {
      if (out.length >= count) return;
      const seq = String(i + 1).padStart(5, '0');
      push({
        examId: `EXAM-CTA-FB-${seq}`,
        reportId: `RPT-CTA-FB-${seq}`,
        patientId: p.id,
        patientName: p.name,
        modality: 'CT',
        bodyPart: p.bodyPart,
        examItem: p.examItem,
        examAt: p.examDate,
        accessionNumber: `ACC-CTA-FB-${seq}`,
        patientGender: p.gender,
        patientAge: p.age,
        clinicalDiagnosis: p.clinicalDiagnosis,
      });
    });
  }
  return out;
}

function dateCompact(examAt: string, fallback: string): string {
  const d = String(examAt).slice(0, 10).replace(/-/g, '');
  return /^\d{8}$/.test(d) ? d : fallback;
}

function buildStenosesForGrade(grade: CadRads, tag: string): Array<{ vessel: string; segment: string; stenosisPercent: number; severity: CardiacSeverity }> {
  if (grade === '0') return [];
  const rand = rngFor(`sten:${tag}`);
  const worstRange: Record<Exclude<CadRads, '0'>, [number, number]> = {
    '1': [10, 29], '2': [30, 49], '3': [50, 69], '4': [70, 99], '5': [100, 100],
  };
  const [lo, hi] = worstRange[grade as Exclude<CadRads, '0'>] ?? [30, 49];
  const segPool = [
    { vessel: 'LAD', segment: '近段' }, { vessel: 'LAD', segment: '中段' },
    { vessel: 'LCX', segment: '近段' }, { vessel: 'LCX', segment: '中段' },
    { vessel: 'RCA', segment: '近段' }, { vessel: 'RCA', segment: '中段' },
    { vessel: 'LM', segment: '开口部' },
  ];
  const count = 1 + Math.floor(rand() * 3);
  const picked: Array<{ vessel: string; segment: string; stenosisPercent: number; severity: CardiacSeverity }> = [];
  const usedKey = new Set<string>();
  for (let i = 0; i < count; i += 1) {
    const seg = segPool[Math.floor(rand() * segPool.length)];
    if (!seg) break;
    const key = `${seg.vessel}:${seg.segment}`;
    if (usedKey.has(key)) continue;
    usedKey.add(key);
    const worst = i === 0;
    const pct = worst
      ? lo + Math.floor(rand() * (hi - lo + 1))
      : Math.max(5, Math.min(Math.max(5, lo - 1), Math.floor(rand() * Math.max(6, lo))));
    picked.push({ vessel: seg.vessel, segment: seg.segment, stenosisPercent: pct, severity: severityOf(pct) });
  }
  return picked;
}

function buildSeedCases(): any[] {
  const anchors = pickCtaAnchors(RECORD_COUNT);
  return anchors.map((anchor, i) => {
    const seq = String(i + 1).padStart(3, '0');
    const grade = CAD_RADS_PLAN[i] ?? '2';
    const rand = rngFor(`cardiac-cta-${seq}:${anchor.patientId}`);
    const aiSeed = i < AI_SEED_LINKS.length ? AI_SEED_LINKS[i] : undefined;
    const studyId = aiSeed?.studyId ?? `CS${dateCompact(anchor.examAt, '20260701')}-${seq}`;

    const rawStenoses = aiSeed
      ? aiSeed.stenoses.map((s) => ({ ...s, plaqueType: (s.calcified ? 'calcified' : 'non-calcified') as PlaqueType }))
      : buildStenosesForGrade(grade, `${seq}:${anchor.patientId}`).map((s) => {
          const plaqueRoll = rngFor(`plaque:${seq}:${s.vessel}:${s.segment}`)();
          const plaqueType: PlaqueType = plaqueRoll < 0.45 ? 'calcified' : plaqueRoll < 0.75 ? 'mixed' : 'non-calcified';
          return { ...s, calcified: plaqueType !== 'non-calcified', plaqueType };
        });

    // 血管分析 overlay: 4 支血管全量树, 狭窄段取实测/生成值, 其余 0%
    const vesselAnalysis = VESSEL_DEFS.flatMap((def) =>
      def.segments.map((segment) => {
        const hit = rawStenoses.find((s) => s.vessel === def.vessel && s.segment === segment);
        const pct = hit?.stenosisPercent ?? 0;
        const plaqueType: PlaqueType = hit?.plaqueType ?? 'none';
        const lengthMm = pct > 0 ? 10 + Math.floor(rngFor(`len:${seq}:${def.vessel}:${segment}`)() * 21) : 8 + Math.floor(rngFor(`len0:${seq}:${def.vessel}:${segment}`)() * 12);
        return {
          vessel: def.vessel,
          vesselLabel: VESSEL_LABELS[def.vessel] ?? def.vessel,
          segment,
          stenosisPercent: pct,
          severity: severityOf(pct),
          plaqueType,
          lengthMm,
          overlay: overlayFor(`${seq}:${def.vessel}:${segment}`),
        };
      }),
    );

    const stenosis = rawStenoses.map((s) => ({
      vessel: s.vessel,
      vesselLabel: VESSEL_LABELS[s.vessel] ?? s.vessel,
      segment: s.segment,
      stenosisPercent: s.stenosisPercent,
      severity: s.severity,
      plaqueType: s.plaqueType,
      calcified: s.calcified,
    }));

    const agatston = aiSeed?.agatston ?? agatstonForGrade(grade, rand);
    const calciumScore = buildCalcium(agatston, `${seq}:${anchor.patientId}`);

    const ef = aiSeed?.ejectionFraction ?? efForGrade(grade, rand);
    const lvEdvMl = aiSeed?.lvEdvMl ?? Math.round(85 + rand() * 60 + (ef < 40 ? 30 : 0));
    const lvEsvMl = aiSeed?.lvEsvMl ?? Math.max(15, Math.round(lvEdvMl * (1 - ef / 100)));
    const lvMassG = aiSeed?.lvMassG ?? Math.round(90 + rand() * 70 + (ef < 40 ? 40 : 0));
    const strokeVolumeMl = Math.max(20, lvEdvMl - lvEsvMl);

    const valves = [
      { valve: 'aortic', valveLabel: '主动脉瓣', severity: grade === '4' || grade === '5' ? ('mild' as const) : ('normal' as const) },
      { valve: 'mitral', valveLabel: '二尖瓣', severity: ef < 40 ? ('moderate' as const) : ('normal' as const) },
    ];

    const findings: string[] = [];
    findings.push(`冠状动脉钙化积分 ${agatston} AU (${calciumScore.category})`);
    if (stenosis.length === 0) findings.push('冠状动脉管腔未见明显狭窄, 未见斑块形成');
    for (const s of stenosis) {
      findings.push(`${VESSEL_LABELS[s.vessel] ?? s.vessel}${s.segment}狭窄约 ${s.stenosisPercent}% (${SEVERITY_LABELS[s.severity]}, ${PLAQUE_LABELS[s.plaqueType]})`);
    }
    findings.push(`左室射血分数 ${ef}%, LVEDV ${lvEdvMl}mL, LV Mass ${lvMassG}g`);

    const impression = grade === '0'
      ? '冠脉 CTA 未见明显斑块及狭窄 (CAD-RADS 0), 建议按指南常规随访。'
      : grade === '5'
        ? '冠脉 CTA 见完全闭塞病变 (CAD-RADS 5), 建议尽早冠脉造影评估血运重建。'
        : `冠脉 CTA 提示 ${grade === '1' ? '轻微' : grade === '2' ? '轻度' : grade === '3' ? '中度' : '重度'}冠状动脉粥样硬化 (CAD-RADS ${grade}), 建议${grade === '3' ? '负荷心肌灌注显像进一步评估' : grade === '4' ? '冠脉造影 + 规范药物治疗' : '控制危险因素并定期复查'}。`;

    const status = (['completed', 'completed', 'completed', 'reviewing', 'pending'] as const)[i % 5] ?? 'completed';
    const confidence = Math.round((0.8 + rand() * 0.17) * 100) / 100;

    return {
      id: `CA-${seq}`,
      examId: anchor.examId,
      reportId: anchor.reportId,
      accessionNumber: anchor.accessionNumber,
      patientId: anchor.patientId,
      patientName: anchor.patientName,
      gender: anchor.patientGender,
      age: anchor.patientAge,
      studyId,
      modality: 'CT' as const,
      examItem: '冠脉CTA',
      bodyPart: anchor.bodyPart || '冠脉',
      date: String(anchor.examAt).slice(0, 10) || '2026-07-01',
      examAt: anchor.examAt,
      ejectionFraction: ef,
      lvVolume: lvEdvMl,
      lvMass: lvMassG,
      lvFunction: { chamber: 'LV', edvMl: lvEdvMl, esvMl: lvEsvMl, efPercent: ef, strokeVolumeMl },
      calciumScore,
      cadRads: grade,
      stenosis,
      vesselAnalysis,
      valves,
      findings,
      impression,
      status,
      confidence,
      ai: {
        resultId: aiSeed?.resultId ?? `CARDIAC-AN-${fnv1aAbs(studyId)}`,
        studyId,
        modelVersion: AI_MODEL_VERSION,
        link: aiSeed ? ('seed' as const) : ('analyze-ready' as const),
        endpoint: '/api/v1/ai-diagnosis/cardiac-ai',
      },
    };
  });
}

let analyses: any[] = [];
let seeded = false;

// 幂等种子: 首个路由命中时构建 (store 为空则回落生成器 / 主数据)
function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  analyses = buildSeedCases();
}

// 路由统一入口: 先确保种子就绪, 再执行确定性 delay
function routeDelay(ms: number): Promise<void> {
  ensureSeeded();
  return delay(ms);
}

export const cardiacHandlers = [
  http.get(`${API}/analyses`, async ({ request }) => {
    await routeDelay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items = [...analyses];
    if (opts?.search) items = items.filter((a) => (a.patientName + a.patientId + a.id + a.studyId).toLowerCase().includes(String(opts.search).toLowerCase()));
    if (opts?.filters?.modality) items = items.filter((a) => a.modality === opts.filters!.modality);
    if (opts?.filters?.status) items = items.filter((a) => a.status === opts.filters!.status);
    if (opts?.filters?.cadRads) items = items.filter((a) => a.cadRads === opts.filters!.cadRads);
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } });
  }),
  http.get(`${API}/analyses/:id`, async ({ params }) => {
    await routeDelay(delayMs());
    const found = analyses.find((a) => a.id === params.id);
    return HttpResponse.json({ success: true, data: found ?? null });
  }),
  http.post(`${API}/analyses`, async ({ request }) => {
    await routeDelay(delayMs());
    const body = (await request.json()) as any;
    const item = { id: body.id || `CA-${uuidv4().slice(0, 8)}`, ...body, status: body.status ?? 'pending', date: body.date || new Date().toISOString().slice(0, 10) };
    analyses = [item, ...analyses];
    return HttpResponse.json({ success: true, data: item }, { status: 201 });
  }),
  http.patch(`${API}/analyses/:id`, async ({ params, request }) => {
    await routeDelay(delayMs());
    const body = (await request.json()) as any;
    const idx = analyses.findIndex((a) => a.id === params.id);
    if (idx >= 0) analyses[idx] = { ...analyses[idx], ...body };
    return HttpResponse.json({ success: true, data: analyses[idx] ?? { id: params.id, ...body } });
  }),
  http.delete(`${API}/analyses/:id`, async ({ params }) => {
    await routeDelay(delayMs());
    analyses = analyses.filter((a) => a.id !== params.id);
    return HttpResponse.json({ success: true, data: {} });
  }),
];
