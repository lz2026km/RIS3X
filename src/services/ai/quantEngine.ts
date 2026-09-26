// [G005 W3] AI 定量分析模拟引擎 (concept UI / deterministic simulation)
// 说明: 本模块不包含真实深度学习模型推理, 仅基于 studyId 的确定性种子生成
//   临床上合理、可复现的定量结果, 用于产品概念演示。所有输出均标记
//   aiAssisted: true / simulated: true。刷新后同一 studyId 结果完全一致。
import { hashSeed, mulberry32 } from "../../utils/seededRandom";

export const QUANT_MODEL_VERSION = "quant-sim-v1.0.0";

/** 固定基准时刻 (UTC), 各研究 generatedAt = 基准 + 确定性偏移, 保证稳定 */
const BASE_TS = Date.UTC(2025, 0, 6, 0, 0, 0);

export interface QuantMeta {
  studyId: string;
  confidence: number;
  modelVersion: string;
  generatedAt: string;
  aiAssisted: true;
  simulated: true;
}

interface Rng {
  next: () => number;
  between: (min: number, max: number) => number;
  int: (min: number, max: number) => number;
  round: (v: number, digits?: number) => number;
}

function makeRng(studyId: string, ns: string): Rng {
  const rand = mulberry32(hashSeed(`${studyId}::${ns}`));
  const round = (v: number, digits = 1): number => {
    const f = 10 ** digits;
    return Math.round(v * f) / f;
  };
  return {
    next: () => rand(),
    between: (min, max) => round(min + rand() * (max - min), 2),
    int: (min, max) => Math.floor(min + rand() * (max - min + 1)),
    round,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
    d.getUTCDate(),
  )} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

function baseMeta(studyId: string, rng: Rng, confidence?: number): QuantMeta {
  const offsetMin = rng.int(0, 72 * 60);
  return {
    studyId,
    confidence: confidence ?? rng.int(84, 98),
    modelVersion: QUANT_MODEL_VERSION,
    generatedAt: formatUtc(BASE_TS + offsetMin * 60000),
    aiAssisted: true,
    simulated: true,
  };
}

export type StenosisSeverity =
  | "normal"
  | "mild"
  | "moderate"
  | "severe"
  | "occlusion";

/** 狭窄程度分级: 0 正常 / 1-49 轻度 / 50-69 中度 / 70-99 重度 / 100 闭塞 */
export function severityOf(stenosis: number): StenosisSeverity {
  if (stenosis <= 0) return "normal";
  if (stenosis < 50) return "mild";
  if (stenosis < 70) return "moderate";
  if (stenosis < 100) return "severe";
  return "occlusion";
}

function drawStenosis(rng: Rng, risk: number): number {
  const bias = clamp(0.5 - risk * 0.18, 0.15, 0.62);
  const roll = rng.next();
  if (roll < bias) return rng.int(0, 24);
  if (roll < bias + (1 - bias) * 0.3) return rng.int(25, 49);
  if (roll < bias + (1 - bias) * 0.58) return rng.int(50, 69);
  if (roll < bias + (1 - bias) * 0.84) return rng.int(70, 99);
  return 100;
}

export function cadRadsFromStenosis(stenosis: number): number {
  if (stenosis <= 0) return 0;
  if (stenosis < 25) return 1;
  if (stenosis < 50) return 2;
  if (stenosis < 70) return 3;
  if (stenosis < 100) return 4;
  return 5;
}

/* ============================ 1. 冠脉 CTA (AI-QCA) ============================ */

export interface PlaqueComposition {
  calcified: number;
  nonCalcified: number;
  lowAttenuation: number;
  fibrous: number;
}

export interface CoronarySegment {
  id: string;
  name: string;
  nameEn: string;
  vessel: string;
  stenosis: number;
  severity: StenosisSeverity;
  plaque: PlaqueComposition;
  lesionLengthMm: number;
  remodelingIndex: number;
}

export interface CoronaryVesselScore {
  vessel: string;
  name: string;
  nameEn: string;
  agatston: number;
  maxStenosis: number;
  ffrCt: number;
}

export interface CoronaryResult extends QuantMeta {
  kind: "coronary";
  segments: CoronarySegment[];
  vessels: CoronaryVesselScore[];
  agatstonTotal: number;
  cadRads: number;
  culpritSegmentId: string | null;
  culpritSegmentName: string;
  ffrCtLowest: number;
  positiveRemodeling: boolean;
}

interface SegmentTemplate {
  id: string;
  name: string;
  nameEn: string;
  vessel: string;
  risk: number;
}

const CORONARY_TEMPLATES: readonly SegmentTemplate[] = [
  { id: "LM", name: "左主干", nameEn: "Left main", vessel: "LM", risk: 0.5 },
  { id: "LAD1", name: "前降支近段", nameEn: "LAD proximal", vessel: "LAD", risk: 1.0 },
  { id: "LAD2", name: "前降支中段", nameEn: "LAD mid", vessel: "LAD", risk: 0.9 },
  { id: "LAD3", name: "前降支远段", nameEn: "LAD distal", vessel: "LAD", risk: 0.6 },
  { id: "D1", name: "第一对角支", nameEn: "First diagonal", vessel: "LAD", risk: 0.4 },
  { id: "D2", name: "第二对角支", nameEn: "Second diagonal", vessel: "LAD", risk: 0.3 },
  { id: "LCX1", name: "回旋支近段", nameEn: "LCx proximal", vessel: "LCX", risk: 0.7 },
  { id: "LCX2", name: "回旋支远段", nameEn: "LCx distal", vessel: "LCX", risk: 0.5 },
  { id: "OM1", name: "第一钝缘支", nameEn: "First obtuse marginal", vessel: "LCX", risk: 0.4 },
  { id: "OM2", name: "第二钝缘支", nameEn: "Second obtuse marginal", vessel: "LCX", risk: 0.3 },
  { id: "RCA1", name: "右冠近段", nameEn: "RCA proximal", vessel: "RCA", risk: 0.7 },
  { id: "RCA2", name: "右冠中段", nameEn: "RCA mid", vessel: "RCA", risk: 0.6 },
  { id: "RCA3", name: "右冠远段", nameEn: "RCA distal", vessel: "RCA", risk: 0.4 },
  { id: "PDA", name: "后降支", nameEn: "Posterior descending", vessel: "RCA", risk: 0.3 },
  { id: "PLV", name: "左室后支", nameEn: "Posterolateral", vessel: "RCA", risk: 0.3 },
];

const VESSEL_NAMES: Record<string, { name: string; nameEn: string }> = {
  LM: { name: "左主干", nameEn: "Left main" },
  LAD: { name: "左前降支", nameEn: "LAD" },
  LCX: { name: "左回旋支", nameEn: "LCx" },
  RCA: { name: "右冠状动脉", nameEn: "RCA" },
};

function makePlaque(rng: Rng, stenosis: number): PlaqueComposition {
  if (stenosis <= 0) {
    return { calcified: 0, nonCalcified: 0, lowAttenuation: 0, fibrous: 0 };
  }
  const total = rng.round(stenosis * rng.between(0.4, 1.2), 1);
  const c = rng.between(0.1, 0.7);
  const n = rng.between(0.1, 0.7);
  const l = rng.between(0.05, 0.5);
  const f = rng.between(0.1, 0.7);
  const sum = c + n + l + f;
  const part = (x: number): number => rng.round((total * x) / sum, 1);
  return {
    calcified: part(c),
    nonCalcified: part(n),
    lowAttenuation: part(l),
    fibrous: part(f),
  };
}

export function coronaryCta(studyId: string): CoronaryResult {
  const rng = makeRng(studyId, "coronary");
  const meta = baseMeta(studyId, rng);
  const segments: CoronarySegment[] = CORONARY_TEMPLATES.map((tpl) => {
    const stenosis = drawStenosis(rng, tpl.risk);
    return {
      id: tpl.id,
      name: tpl.name,
      nameEn: tpl.nameEn,
      vessel: tpl.vessel,
      stenosis,
      severity: severityOf(stenosis),
      plaque: makePlaque(rng, stenosis),
      lesionLengthMm: stenosis >= 25 ? rng.round(rng.between(5, 28), 1) : 0,
      remodelingIndex: stenosis >= 25 ? rng.round(rng.between(0.82, 1.35), 2) : 0,
    };
  });

  const vessels: CoronaryVesselScore[] = ["LM", "LAD", "LCX", "RCA"].map((v) => {
    const segs = segments.filter((s) => s.vessel === v);
    const maxStenosis = segs.reduce((m, s) => Math.max(m, s.stenosis), 0);
    const calcVol = segs.reduce((a, s) => a + s.plaque.calcified, 0);
    const names = VESSEL_NAMES[v] ?? { name: v, nameEn: v };
    return {
      vessel: v,
      name: names.name,
      nameEn: names.nameEn,
      agatston: Math.round(calcVol * 1.6 + rng.between(0, 12)),
      maxStenosis,
      ffrCt: rng.round(
        clamp(1 - (maxStenosis / 100) * 0.95 - rng.between(0, 0.05), 0.55, 1),
        2,
      ),
    };
  });

  const agatstonTotal = vessels.reduce((a, v) => a + v.agatston, 0);
  const culprit = segments.reduce<CoronarySegment | null>(
    (best, s) => (!best || s.stenosis > best.stenosis ? s : best),
    null,
  );
  const ffrCtLowest = vessels.reduce((m, v) => Math.min(m, v.ffrCt), 1);

  return {
    ...meta,
    kind: "coronary",
    segments,
    vessels,
    agatstonTotal,
    cadRads: cadRadsFromStenosis(culprit?.stenosis ?? 0),
    culpritSegmentId: culprit && culprit.stenosis > 0 ? culprit.id : null,
    culpritSegmentName: culprit && culprit.stenosis > 0 ? culprit.name : "",
    ffrCtLowest,
    positiveRemodeling: (culprit?.remodelingIndex ?? 0) > 1.1,
  };
}

/* ============================ 2. 卒中 CTA / CTP ============================ */

export interface AspectsRegion {
  key: string;
  name: string;
  nameEn: string;
  involved: boolean;
}

export interface LvoFinding {
  present: boolean;
  site: string;
  siteEn: string;
  confidence: number;
}

export interface StrokeResult extends QuantMeta {
  kind: "stroke";
  aspects: AspectsRegion[];
  aspectsTotal: number;
  collateralScore: number;
  coreVolumeMl: number;
  penumbraVolumeMl: number;
  mismatchRatio: number;
  lvo: LvoFinding;
  treatmentWindow: "0-3h" | "3-6h" | "6-24h";
  ich: boolean;
  ichSubtype: string;
  ichSubtypeEn: string;
}

const ASPECTS_TEMPLATES: ReadonlyArray<{
  key: string;
  name: string;
  nameEn: string;
  weight: number;
}> = [
  { key: "C", name: "尾状核", nameEn: "Caudate", weight: 1.2 },
  { key: "I", name: "岛叶带状区", nameEn: "Insular ribbon", weight: 1.6 },
  { key: "IC", name: "内囊后肢", nameEn: "Internal capsule", weight: 1.0 },
  { key: "L", name: "豆状核", nameEn: "Lentiform nucleus", weight: 1.3 },
  { key: "M1", name: "MCA 皮层 M1", nameEn: "MCA cortex M1", weight: 1.5 },
  { key: "M2", name: "MCA 皮层 M2", nameEn: "MCA cortex M2", weight: 1.4 },
  { key: "M3", name: "MCA 皮层 M3", nameEn: "MCA cortex M3", weight: 1.2 },
  { key: "M4", name: "MCA 皮层 M4", nameEn: "MCA cortex M4", weight: 1.1 },
  { key: "M5", name: "MCA 皮层 M5", nameEn: "MCA cortex M5", weight: 1.0 },
  { key: "M6", name: "MCA 皮层 M6", nameEn: "MCA cortex M6", weight: 0.8 },
];

const LVO_SITES: ReadonlyArray<{ site: string; siteEn: string }> = [
  { site: "右侧大脑中动脉 M1 段", siteEn: "Right MCA M1" },
  { site: "左侧大脑中动脉 M1 段", siteEn: "Left MCA M1" },
  { site: "右侧大脑中动脉 M2 段", siteEn: "Right MCA M2" },
  { site: "左侧颈内动脉末端 (ICA-T)", siteEn: "Left ICA terminus" },
  { site: "基底动脉", siteEn: "Basilar artery" },
];

const ICH_SUBTYPES: ReadonlyArray<{ site: string; siteEn: string }> = [
  { site: "基底节区 (深部)", siteEn: "Deep (basal ganglia)" },
  { site: "脑叶", siteEn: "Lobar" },
  { site: "脑干", siteEn: "Brainstem" },
  { site: "小脑", siteEn: "Cerebellar" },
  { site: "脑室内出血", siteEn: "Intraventricular" },
];

export function strokeCta(studyId: string): StrokeResult {
  const rng = makeRng(studyId, "stroke");
  const meta = baseMeta(studyId, rng);

  const hasInfarct = rng.next() < 0.45;
  const involvedCount = hasInfarct ? rng.int(1, 7) : 0;
  const ranked = ASPECTS_TEMPLATES.map((t) => ({
    tpl: t,
    order: rng.next() / t.weight,
  })).sort((a, b) => a.order - b.order);
  const involvedKeys = new Set(
    ranked.slice(0, involvedCount).map((r) => r.tpl.key),
  );
  const aspects: AspectsRegion[] = ASPECTS_TEMPLATES.map((t) => ({
    key: t.key,
    name: t.name,
    nameEn: t.nameEn,
    involved: involvedKeys.has(t.key),
  }));
  const aspectsTotal = aspects.filter((a) => !a.involved).length;

  const collateralScore = hasInfarct ? rng.int(1, 3) : rng.int(2, 3);
  const coreVolumeMl = hasInfarct
    ? rng.round(rng.between(15, 130), 1)
    : rng.round(rng.between(0, 12), 1);
  const penumbraVolumeMl = rng.round(
    rng.between(Math.max(4, coreVolumeMl * 0.9), 260),
    1,
  );
  const mismatchRatio = rng.round(
    clamp(penumbraVolumeMl / Math.max(1, coreVolumeMl), 0.6, 6),
    1,
  );

  const lvoPresent = hasInfarct && coreVolumeMl > 28 && rng.next() < 0.85;
  const lvoSite = LVO_SITES[rng.int(0, LVO_SITES.length - 1)] ?? LVO_SITES[0]!;
  const lvo: LvoFinding = {
    present: lvoPresent,
    site: lvoPresent ? lvoSite.site : "",
    siteEn: lvoPresent ? lvoSite.siteEn : "",
    confidence: lvoPresent ? rng.int(80, 97) : rng.int(55, 75),
  };

  const treatmentWindow: StrokeResult["treatmentWindow"] =
    mismatchRatio >= 1.8 && coreVolumeMl < 70
      ? "0-3h"
      : coreVolumeMl < 100
        ? "3-6h"
        : "6-24h";

  const ich = rng.next() < 0.12;
  const ichPick = ICH_SUBTYPES[rng.int(0, ICH_SUBTYPES.length - 1)] ?? ICH_SUBTYPES[0]!;

  return {
    ...meta,
    kind: "stroke",
    aspects,
    aspectsTotal,
    collateralScore,
    coreVolumeMl,
    penumbraVolumeMl,
    mismatchRatio,
    lvo,
    treatmentWindow,
    ich,
    ichSubtype: ich ? ichPick.site : "",
    ichSubtypeEn: ich ? ichPick.siteEn : "",
  };
}

/* ============================ 3. 头颈 CTA (Willis 环) ============================ */

export interface VesselPatency {
  id: string;
  name: string;
  nameEn: string;
  stenosis: number;
  patency: "patent" | "stenosis" | "occluded";
  dissection: boolean;
}

export interface CarotidResult extends QuantMeta {
  kind: "carotid";
  vessels: VesselPatency[];
  maxStenosis: number;
  dissectionDetected: boolean;
}

const WILLIS_VESSELS: ReadonlyArray<{
  id: string;
  name: string;
  nameEn: string;
  risk: number;
  dissectionProne: boolean;
}> = [
  { id: "ICA-L", name: "左侧颈内动脉", nameEn: "Left ICA", risk: 0.7, dissectionProne: true },
  { id: "ICA-R", name: "右侧颈内动脉", nameEn: "Right ICA", risk: 0.7, dissectionProne: true },
  { id: "MCA-L", name: "左侧大脑中动脉 M1", nameEn: "Left MCA M1", risk: 0.5, dissectionProne: false },
  { id: "MCA-R", name: "右侧大脑中动脉 M1", nameEn: "Right MCA M1", risk: 0.5, dissectionProne: false },
  { id: "ACA-L", name: "左侧大脑前动脉 A1", nameEn: "Left ACA A1", risk: 0.3, dissectionProne: false },
  { id: "ACA-R", name: "右侧大脑前动脉 A1", nameEn: "Right ACA A1", risk: 0.3, dissectionProne: false },
  { id: "PCA-L", name: "左侧大脑后动脉 P1", nameEn: "Left PCA P1", risk: 0.3, dissectionProne: false },
  { id: "PCA-R", name: "右侧大脑后动脉 P1", nameEn: "Right PCA P1", risk: 0.3, dissectionProne: false },
  { id: "BA", name: "基底动脉", nameEn: "Basilar artery", risk: 0.4, dissectionProne: false },
  { id: "VA-L", name: "左侧椎动脉", nameEn: "Left vertebral", risk: 0.5, dissectionProne: true },
  { id: "VA-R", name: "右侧椎动脉", nameEn: "Right vertebral", risk: 0.5, dissectionProne: true },
  { id: "ACoA", name: "前交通动脉", nameEn: "ACoA", risk: 0.2, dissectionProne: false },
];

export function carotidHeadNeck(studyId: string): CarotidResult {
  const rng = makeRng(studyId, "carotid");
  const meta = baseMeta(studyId, rng);
  const vessels: VesselPatency[] = WILLIS_VESSELS.map((t) => {
    const stenosis = drawStenosis(rng, t.risk);
    const patency: VesselPatency["patency"] =
      stenosis >= 100 ? "occluded" : stenosis > 0 ? "stenosis" : "patent";
    return {
      id: t.id,
      name: t.name,
      nameEn: t.nameEn,
      stenosis,
      patency,
      dissection: t.dissectionProne && rng.next() < 0.12,
    };
  });
  const maxStenosis = vessels.reduce((m, v) => Math.max(m, v.stenosis), 0);
  return {
    ...meta,
    kind: "carotid",
    vessels,
    maxStenosis,
    dissectionDetected: vessels.some((v) => v.dissection),
  };
}

/* ============================ 4. 肝脏定量 ============================ */

export interface CouinaudSegment {
  key: string;
  name: string;
  nameEn: string;
  volumeMl: number;
}

export interface LiverObservation {
  present: boolean;
  category: string;
  sizeMm: number;
  segment: string;
  segmentEn: string;
  pattern: string;
  patternEn: string;
}

export interface LiverResult extends QuantMeta {
  kind: "liver";
  segments: CouinaudSegment[];
  totalVolumeMl: number;
  fatFractionPct: number;
  steatosisGrade: number;
  steatosisLabel: string;
  steatosisLabelEn: string;
  ironR2Star: number;
  ironT2StarMs: number;
  observation: LiverObservation;
}

const COUINAUD_TEMPLATES: ReadonlyArray<{
  key: string;
  name: string;
  nameEn: string;
  weight: number;
}> = [
  { key: "I", name: "Ⅰ 段 (尾状叶)", nameEn: "Segment I (caudate)", weight: 4 },
  { key: "II", name: "Ⅱ 段", nameEn: "Segment II", weight: 9 },
  { key: "III", name: "Ⅲ 段", nameEn: "Segment III", weight: 9 },
  { key: "IV", name: "Ⅳ 段", nameEn: "Segment IV", weight: 14 },
  { key: "V", name: "Ⅴ 段", nameEn: "Segment V", weight: 13 },
  { key: "VI", name: "Ⅵ 段", nameEn: "Segment VI", weight: 13 },
  { key: "VII", name: "Ⅶ 段", nameEn: "Segment VII", weight: 17 },
  { key: "VIII", name: "Ⅷ 段", nameEn: "Segment VIII", weight: 21 },
];

function steatosisFromFat(fat: number): { grade: number; zh: string; en: string } {
  if (fat < 5) return { grade: 0, zh: "无脂肪浸润", en: "Normal" };
  if (fat < 14) return { grade: 1, zh: "轻度脂肪肝 (S1)", en: "Mild steatosis (S1)" };
  if (fat < 28) return { grade: 2, zh: "中度脂肪肝 (S2)", en: "Moderate steatosis (S2)" };
  return { grade: 3, zh: "重度脂肪肝 (S3)", en: "Severe steatosis (S3)" };
}

export function liverQuant(studyId: string): LiverResult {
  const rng = makeRng(studyId, "liver");
  const meta = baseMeta(studyId, rng);
  const totalVolumeMl = rng.int(1080, 1820);
  let assigned = 0;
  const segments: CouinaudSegment[] = COUINAUD_TEMPLATES.map((t, i) => {
    const isLast = i === COUINAUD_TEMPLATES.length - 1;
    const vol = isLast
      ? totalVolumeMl - assigned
      : Math.round((totalVolumeMl * t.weight) / 100);
    assigned += vol;
    return {
      key: t.key,
      name: t.name,
      nameEn: t.nameEn,
      volumeMl: vol,
    };
  });

  const fatFractionPct = rng.round(
    rng.next() < 0.35 ? rng.between(1, 4.9) : rng.between(5, 34),
    1,
  );
  const steatosis = steatosisFromFat(fatFractionPct);
  const ironR2Star = rng.round(rng.between(28, 135), 1);
  const ironT2StarMs = rng.round(clamp(1000 / ironR2Star, 4, 40), 1);

  const observationPresent = rng.next() < 0.3;
  const liRads = ["LR-1", "LR-2", "LR-3", "LR-4", "LR-5", "LR-M"][rng.int(0, 5)] ?? "LR-3";
  const segPick = COUINAUD_TEMPLATES[rng.int(0, COUINAUD_TEMPLATES.length - 1)] ?? COUINAUD_TEMPLATES[0]!;
  const patterns: ReadonlyArray<{ zh: string; en: string }> = [
    { zh: "动脉期高强化 / 门脉期廓清", en: "APHE with washout" },
    { zh: "环形强化", en: "Rim enhancement" },
    { zh: "持续强化", en: "Persistent enhancement" },
    { zh: "无强化", en: "No enhancement" },
  ];
  const pattern = patterns[rng.int(0, patterns.length - 1)] ?? patterns[0]!;
  const observation: LiverObservation = {
    present: observationPresent,
    category: observationPresent ? liRads : "",
    sizeMm: observationPresent ? rng.round(rng.between(8, 62), 1) : 0,
    segment: observationPresent ? segPick.name : "",
    segmentEn: observationPresent ? segPick.nameEn : "",
    pattern: observationPresent ? pattern.zh : "",
    patternEn: observationPresent ? pattern.en : "",
  };

  return {
    ...meta,
    kind: "liver",
    segments,
    totalVolumeMl,
    fatFractionPct,
    steatosisGrade: steatosis.grade,
    steatosisLabel: steatosis.zh,
    steatosisLabelEn: steatosis.en,
    ironR2Star,
    ironT2StarMs,
    observation,
  };
}

/* ============================ 5. 骨龄 ============================ */

export interface BoneAgeResult extends QuantMeta {
  kind: "boneAge";
  boneAgeYears: number;
  chronologicAgeYears: number;
  deltaYears: number;
  gpEstimate: number;
  tw3Estimate: number;
  maturityScore: number;
  interpretation: string;
  interpretationEn: string;
}

export function boneAge(studyId: string): BoneAgeResult {
  const rng = makeRng(studyId, "boneAge");
  const meta = baseMeta(studyId, rng);
  const chronologicAgeYears = rng.round(rng.between(5.5, 17.5), 1);
  const deltaYears = rng.round(rng.between(-1.6, 2.4), 1);
  const boneAgeYears = rng.round(
    clamp(chronologicAgeYears + deltaYears, 4, 19),
    1,
  );
  const gpEstimate = rng.round(boneAgeYears + rng.between(-0.4, 0.4), 1);
  const tw3Estimate = rng.round(boneAgeYears + rng.between(-0.4, 0.4), 1);
  const diff = boneAgeYears - chronologicAgeYears;
  const interpretation =
    diff > 1
      ? "骨龄提前"
      : diff < -1
        ? "骨龄落后"
        : "骨龄与年龄相符";
  const interpretationEn =
    diff > 1
      ? "Advanced bone age"
      : diff < -1
        ? "Delayed bone age"
        : "Bone age concordant";
  return {
    ...meta,
    kind: "boneAge",
    boneAgeYears,
    chronologicAgeYears,
    deltaYears: rng.round(diff, 1),
    gpEstimate,
    tw3Estimate,
    maturityScore: clamp(Math.round((boneAgeYears / 19) * 100), 1, 100),
    interpretation,
    interpretationEn,
  };
}

/* ============================ 6. 肺结节 ============================ */

export type NoduleDensity = "solid" | "part-solid" | "ggo";

export interface LungNodule {
  id: string;
  lobe: string;
  lobeEn: string;
  diameterMm: number;
  volumeMm3: number;
  density: NoduleDensity;
  densityLabel: string;
  densityLabelEn: string;
  priorVolumeMm3: number | null;
  vdtDays: number | null;
  lungRads: string;
  malignancyRiskPct: number;
  followUp: string;
  followUpEn: string;
}

export interface NoduleResult extends QuantMeta {
  kind: "nodule";
  nodules: LungNodule[];
  noduleCount: number;
  maxLungRads: string;
}

const LOBES: ReadonlyArray<{ zh: string; en: string }> = [
  { zh: "右肺上叶", en: "RUL" },
  { zh: "右肺中叶", en: "RML" },
  { zh: "右肺下叶", en: "RLL" },
  { zh: "左肺上叶", en: "LUL" },
  { zh: "左肺下叶", en: "LLL" },
];

function densityMeta(d: NoduleDensity): { zh: string; en: string } {
  if (d === "solid") return { zh: "实性", en: "Solid" };
  if (d === "part-solid") return { zh: "部分实性", en: "Part-solid" };
  return { zh: "磨玻璃 (GGO)", en: "Ground-glass (GGO)" };
}

function lungRadsFor(d: number, density: NoduleDensity): string {
  if (density === "solid") {
    if (d < 6) return "2";
    if (d <= 8) return "3";
    if (d <= 15) return "4A";
    return "4B";
  }
  if (density === "part-solid") {
    if (d < 6) return "2";
    if (d <= 8) return "3";
    return "4A";
  }
  if (d < 30) return "2";
  return "3";
}

function malignancyFor(rads: string): number {
  switch (rads) {
    case "4B":
      return 65;
    case "4A":
      return 32;
    case "3":
      return 12;
    default:
      return 3;
  }
}

function followUpFor(rads: string): { zh: string; en: string } {
  switch (rads) {
    case "4B":
      return { zh: "建议 PET-CT / 活检评估", en: "PET-CT or biopsy" };
    case "4A":
      return { zh: "3 个月随访或 PET-CT", en: "3-month follow-up or PET-CT" };
    case "3":
      return { zh: "6 个月 LDCT 随访", en: "6-month LDCT follow-up" };
    default:
      return { zh: "12 个月 LDCT 随访", en: "12-month LDCT follow-up" };
  }
}

export function noduleLung(studyId: string): NoduleResult {
  const rng = makeRng(studyId, "nodule");
  const meta = baseMeta(studyId, rng);
  const count = rng.int(1, 4);
  const nodules: LungNodule[] = [];
  for (let i = 0; i < count; i++) {
    const lobe = LOBES[rng.int(0, LOBES.length - 1)] ?? LOBES[0]!;
    const diameterMm = rng.round(rng.between(3.5, 26), 1);
    const volumeMm3 = Math.round((Math.PI / 6) * diameterMm ** 3);
    const density: NoduleDensity =
      rng.next() < 0.6 ? "solid" : rng.next() < 0.65 ? "part-solid" : "ggo";
    const dMeta = densityMeta(density);
    const stable = rng.next() < 0.25;
    const priorVolumeMm3 = stable
      ? volumeMm3
      : Math.round(volumeMm3 * rng.between(0.45, 0.98));
    const vdtDays = stable
      ? null
      : Math.round(
          clamp(
            (Math.log(2) * 365) / Math.log(volumeMm3 / Math.max(1, priorVolumeMm3)),
            20,
            1400,
          ),
        );
    const lungRads = lungRadsFor(diameterMm, density);
    const risk = clamp(
      malignancyFor(lungRads) + (vdtDays != null && vdtDays < 400 ? 8 : 0),
      1,
      95,
    );
    const follow = followUpFor(lungRads);
    nodules.push({
      id: `N${i + 1}`,
      lobe: lobe.zh,
      lobeEn: lobe.en,
      diameterMm,
      volumeMm3,
      density,
      densityLabel: dMeta.zh,
      densityLabelEn: dMeta.en,
      priorVolumeMm3: stable ? null : priorVolumeMm3,
      vdtDays,
      lungRads,
      malignancyRiskPct: risk,
      followUp: follow.zh,
      followUpEn: follow.en,
    });
  }
  const rank: Record<string, number> = {
    "4B": 5,
    "4A": 4,
    "3": 3,
    "2": 2,
    "1": 1,
    "0": 0,
  };
  const maxLungRads = nodules.reduce(
    (best, n) => ((rank[n.lungRads] ?? 0) > (rank[best] ?? 0) ? n.lungRads : best),
    "1",
  );
  return {
    ...meta,
    kind: "nodule",
    nodules,
    noduleCount: nodules.length,
    maxLungRads,
  };
}

/* ============================ 7. 乳腺密度 ============================ */

export interface BreastLesion {
  id: string;
  side: "L" | "R";
  sideLabel: string;
  sideLabelEn: string;
  quadrant: string;
  quadrantEn: string;
  sizeMm: number;
  biRads: string;
  kind: string;
  kindEn: string;
}

export interface BreastResult extends QuantMeta {
  kind: "breast";
  densityCategory: "A" | "B" | "C" | "D";
  fibroglandularPct: number;
  leftVolumetricPct: number;
  rightVolumetricPct: number;
  lesions: BreastLesion[];
}

function densityCategory(pct: number): "A" | "B" | "C" | "D" {
  if (pct < 10) return "A";
  if (pct < 25) return "B";
  if (pct < 50) return "C";
  return "D";
}

export function breastDensity(studyId: string): BreastResult {
  const rng = makeRng(studyId, "breast");
  const meta = baseMeta(studyId, rng);
  const fibroglandularPct = rng.round(rng.between(4, 72), 1);
  const leftVolumetricPct = rng.round(
    clamp(fibroglandularPct + rng.between(-8, 8), 1, 95),
    1,
  );
  const rightVolumetricPct = rng.round(
    clamp(fibroglandularPct + rng.between(-8, 8), 1, 95),
    1,
  );
  const count = rng.next() < 0.4 ? 0 : rng.int(1, 3);
  const quadrants: ReadonlyArray<{ zh: string; en: string }> = [
    { zh: "外上象限", en: "Upper outer" },
    { zh: "内上象限", en: "Upper inner" },
    { zh: "外下象限", en: "Lower outer" },
    { zh: "内下象限", en: "Lower inner" },
    { zh: "乳晕后区", en: "Retroareolar" },
  ];
  const kinds: ReadonlyArray<{ zh: string; en: string }> = [
    { zh: "肿块", en: "Mass" },
    { zh: "钙化", en: "Calcification" },
    { zh: "结构扭曲", en: "Architectural distortion" },
    { zh: "非肿块强化", en: "Non-mass enhancement" },
  ];
  const lesions: BreastLesion[] = [];
  for (let i = 0; i < count; i++) {
    const side: "L" | "R" = rng.next() < 0.5 ? "L" : "R";
    const q = quadrants[rng.int(0, quadrants.length - 1)] ?? quadrants[0]!;
    const kind = kinds[rng.int(0, kinds.length - 1)] ?? kinds[0]!;
    lesions.push({
      id: `L${i + 1}`,
      side,
      sideLabel: side === "L" ? "左乳" : "右乳",
      sideLabelEn: side === "L" ? "Left" : "Right",
      quadrant: q.zh,
      quadrantEn: q.en,
      sizeMm: rng.round(rng.between(3, 34), 1),
      biRads: ["1", "2", "3", "4A", "4B", "5"][rng.int(0, 5)] ?? "3",
      kind: kind.zh,
      kindEn: kind.en,
    });
  }
  return {
    ...meta,
    kind: "breast",
    densityCategory: densityCategory(fibroglandularPct),
    fibroglandularPct,
    leftVolumetricPct,
    rightVolumetricPct,
    lesions,
  };
}

/* ============================ 8. 心胸比 ============================ */

export interface CtrResult extends QuantMeta {
  kind: "ctr";
  ctr: number;
  cardiomegaly: boolean;
  cardiacWidthMm: number;
  thoracicWidthMm: number;
}

export function cardiothoracicRatio(studyId: string): CtrResult {
  const rng = makeRng(studyId, "ctr");
  const meta = baseMeta(studyId, rng);
  const thoracicWidthMm = rng.int(240, 330);
  const ctr = rng.round(rng.between(0.38, 0.62), 2);
  const cardiacWidthMm = Math.round(thoracicWidthMm * ctr);
  return {
    ...meta,
    kind: "ctr",
    ctr,
    cardiomegaly: ctr > 0.5,
    cardiacWidthMm,
    thoracicWidthMm,
  };
}

/* ============================ 9. 脊柱 QCT ============================ */

export interface VertebraQct {
  level: string;
  bmdMgCm3: number;
  tScore: number;
  zScore: number;
  genantGrade: 0 | 1 | 2 | 3;
}

export interface SpineQctResult extends QuantMeta {
  kind: "spineQct";
  levels: VertebraQct[];
  meanTScore: number;
  osteoporosis: boolean;
}

export function spineQct(studyId: string): SpineQctResult {
  const rng = makeRng(studyId, "spineQct");
  const meta = baseMeta(studyId, rng);
  const levelNames = ["T12", "L1", "L2", "L3", "L4"];
  const baseT = rng.round(rng.between(-3.4, 1.2), 1);
  const levels: VertebraQct[] = levelNames.map((level) => {
    const bmdMgCm3 = rng.round(
      clamp(120 + baseT * 22 + rng.between(-8, 8), 35, 220),
      1,
    );
    const tScore = rng.round(clamp((bmdMgCm3 - 145) / 22, -4.5, 2.5), 1);
    const zScore = rng.round(clamp(tScore + rng.between(-0.6, 0.6), -4, 2.5), 1);
    const genantRoll = rng.next();
    const genantGrade: 0 | 1 | 2 | 3 =
      tScore < -2.5 && genantRoll > 0.7
        ? 2
        : tScore < -1.5 && genantRoll > 0.75
          ? 1
          : genantRoll > 0.92
            ? 1
            : 0;
    return { level, bmdMgCm3, tScore, zScore, genantGrade };
  });
  const meanTScore = rng.round(
    levels.reduce((a, l) => a + l.tScore, 0) / levels.length,
    1,
  );
  return {
    ...meta,
    kind: "spineQct",
    levels,
    meanTScore,
    osteoporosis: meanTScore <= -2.5,
  };
}

/* ============================ 10. 体成分 ============================ */

export interface BodyCompositionResult extends QuantMeta {
  kind: "bodyComposition";
  sex: "male" | "female";
  heightM: number;
  muscleAreaCm2: number;
  smi: number;
  visceralFatCm2: number;
  subcutaneousFatCm2: number;
  fatFractionPct: number;
  sarcopenia: boolean;
}

export function bodyComposition(studyId: string): BodyCompositionResult {
  const rng = makeRng(studyId, "body");
  const meta = baseMeta(studyId, rng);
  const sex: "male" | "female" = rng.next() < 0.5 ? "male" : "female";
  const heightM = rng.round(
    sex === "male" ? rng.between(1.6, 1.85) : rng.between(1.5, 1.75),
    2,
  );
  const muscleAreaCm2 = rng.round(
    sex === "male" ? rng.between(105, 165) : rng.between(80, 130),
    1,
  );
  const smi = rng.round(muscleAreaCm2 / (heightM * heightM), 1);
  const threshold = sex === "male" ? 52.4 : 38.5;
  return {
    ...meta,
    kind: "bodyComposition",
    sex,
    heightM,
    muscleAreaCm2,
    smi,
    visceralFatCm2: rng.round(rng.between(35, 210), 1),
    subcutaneousFatCm2: rng.round(rng.between(80, 320), 1),
    fatFractionPct: rng.round(rng.between(18, 45), 1),
    sarcopenia: smi < threshold,
  };
}

/* ============================ 分类注册表 ============================ */

export type QuantResult =
  | CoronaryResult
  | StrokeResult
  | CarotidResult
  | LiverResult
  | BoneAgeResult
  | NoduleResult
  | BreastResult
  | CtrResult
  | SpineQctResult
  | BodyCompositionResult;

export type QuantCategoryId =
  | "cardiac"
  | "neuro"
  | "abdomen"
  | "musculoskeletal"
  | "chest"
  | "breast"
  | "body";

export interface QuantAnalysisDef {
  id: string;
  name: string;
  nameEn: string;
  run: (studyId: string) => QuantResult;
}

export interface QuantCategoryDef {
  id: QuantCategoryId;
  name: string;
  nameEn: string;
  analyses: ReadonlyArray<QuantAnalysisDef>;
}

export const QUANT_CATEGORIES: ReadonlyArray<QuantCategoryDef> = [
  {
    id: "cardiac",
    name: "心血管",
    nameEn: "Cardiovascular",
    analyses: [
      { id: "coronary", name: "冠脉 CTA 定量", nameEn: "Coronary CTA", run: coronaryCta },
    ],
  },
  {
    id: "neuro",
    name: "神经",
    nameEn: "Neuro",
    analyses: [
      { id: "stroke", name: "卒中 ASPECTS / CTP", nameEn: "Stroke ASPECTS / CTP", run: strokeCta },
      { id: "carotid", name: "头颈 CTA", nameEn: "Head & Neck CTA", run: carotidHeadNeck },
    ],
  },
  {
    id: "abdomen",
    name: "腹部",
    nameEn: "Abdomen",
    analyses: [
      { id: "liver", name: "肝脏定量", nameEn: "Liver Quantification", run: liverQuant },
    ],
  },
  {
    id: "musculoskeletal",
    name: "骨肌",
    nameEn: "Musculoskeletal",
    analyses: [
      { id: "boneAge", name: "骨龄评估", nameEn: "Bone Age", run: boneAge },
      { id: "spineQct", name: "脊柱 QCT", nameEn: "Spine QCT", run: spineQct },
    ],
  },
  {
    id: "chest",
    name: "胸部",
    nameEn: "Chest",
    analyses: [
      { id: "nodule", name: "肺结节分析", nameEn: "Lung Nodule", run: noduleLung },
      { id: "ctr", name: "心胸比", nameEn: "Cardiothoracic Ratio", run: cardiothoracicRatio },
    ],
  },
  {
    id: "breast",
    name: "乳腺",
    nameEn: "Breast",
    analyses: [
      { id: "breast", name: "乳腺密度", nameEn: "Breast Density", run: breastDensity },
    ],
  },
  {
    id: "body",
    name: "体成分",
    nameEn: "Body Composition",
    analyses: [
      { id: "body", name: "体成分分析", nameEn: "Body Composition", run: bodyComposition },
    ],
  },
];

/** 固定演示研究列表 (确定性, 供页面选择器使用) */
export interface QuantStudyOption {
  id: string;
  label: string;
  modality: string;
}

export const QUANT_STUDY_OPTIONS: ReadonlyArray<QuantStudyOption> = [
  { id: "STU-2026-0001", label: "王建国 / 冠脉 CTA", modality: "CCTA" },
  { id: "STU-2026-0002", label: "李秀兰 / 头颅 CTA", modality: "CTA" },
  { id: "STU-2026-0003", label: "张伟 / 上腹部 MR", modality: "MR" },
  { id: "STU-2026-0004", label: "陈小雨 / 左手腕 DR", modality: "DR" },
  { id: "STU-2026-0005", label: "刘志强 / 胸部 LDCT", modality: "CT" },
  { id: "STU-2026-0006", label: "赵敏 / 乳腺 DBT", modality: "DBT" },
  { id: "STU-2026-0007", label: "孙丽 / 腰椎 QCT", modality: "QCT" },
  { id: "STU-2026-0008", label: "周涛 / 腹部 CT 体成分", modality: "CT" },
];
