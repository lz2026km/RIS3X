import { http, HttpResponse, delay } from "msw";
import { v4 as uuidv4 } from "uuid";
import { list } from "./store";
import {
  DEVICES_BY_MODALITY,
  DEVICE_BY_ID,
  PATIENT_BY_ID,
  type DeviceModality,
} from "../../data/master";
import { fnv1a32, resolvePatientId } from "../../data/master/idAlias";
import type {
  DrlEntry,
  RdsrResult,
  DoseAlert,
  CumulativeDose,
  PatientDoseSummary,
  TodayDoseStats,
  RdsrStats,
  DrlCheckRecordInput,
  DrlCheckResult,
  DrlCheckSummary,
} from "../api/rdsrApi";

const API_BASE = (() => {
  try { return window.location.origin + "/api/v1"; } catch { return "http://localhost/api/v1"; }
})();

const DRLS: DrlEntry[] = [
  { modality: "CT", bodyPart: "头部", ctdivolDrl: 60, dlpDrl: 1000, source: "国家DRLs 2023" },
  { modality: "CT", bodyPart: "胸部", ctdivolDrl: 15, dlpDrl: 500, source: "国家DRLs 2023" },
  { modality: "CT", bodyPart: "腹部", ctdivolDrl: 25, dlpDrl: 800, source: "国家DRLs 2023" },
  { modality: "CT", bodyPart: "盆腔", ctdivolDrl: 20, dlpDrl: 600, source: "国家DRLs 2023" },
  { modality: "CT", bodyPart: "腰椎", ctdivolDrl: 40, dlpDrl: 700, source: "国家DRLs 2023" },
];

const CHILD_DRLS: DrlEntry[] = [
  { modality: "CT", bodyPart: "头部", ctdivolDrl: 40, dlpDrl: 700, source: "国家DRLs 2023(儿童)", ageGroup: "child" },
  { modality: "CT", bodyPart: "胸部", ctdivolDrl: 12, dlpDrl: 400, source: "国家DRLs 2023(儿童)", ageGroup: "child" },
  { modality: "CT", bodyPart: "腹部", ctdivolDrl: 20, dlpDrl: 600, source: "国家DRLs 2023(儿童)", ageGroup: "child" },
];

// [G005] 剂量记录直接挂接到 store 的检查主脊 (store.list('exams')),
//   patientId → PATIENT_MASTER (P000001-P049700), deviceId → DEVICE_MASTER (DEV-CT-001 ...)
interface MockDoseRecord {
  id: string;
  /** store exams 集合主键 (cross-link 证据) */
  examId: string;
  accessionNumber?: string;
  patientId: string;
  patientName: string;
  age?: number;
  studyUid: string;
  /** 输出模态: CT / MR / IR (介入, 主数据中以 DSA 存储) */
  modality: string;
  /** 源检查模态 (CT / MR / DSA) */
  examModality: string;
  bodyPart: string;
  ctdiVol: number;
  dlp: number;
  /** DAP (剂量面积积, Gy·cm²) */
  dap: number;
  ssde?: number;
  /** DEVICE_MASTER 设备 id */
  deviceId: string;
  deviceName: string;
  /** DRL 合规标记 (无对应 DRL 时视为合规) */
  drlCompliant: boolean;
  date: string;
}

const BODY_PARTS = ["头部", "胸部", "腹部", "盆腔", "腰椎"];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, days: number) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
};

let seq = 20261011;
const lcg = () => {
  seq = (seq * 1103515245 + 12345) % 2147483648;
  return seq / 2147483648;
};

const ackedAlerts = new Set<string>([]);

const findDrl = (bodyPart: string, ageGroup: "adult" | "child" = "adult"): DrlEntry | undefined =>
  (ageGroup === "child" ? CHILD_DRLS : DRLS).find((d) => d.bodyPart === bodyPart);

const levelFor = (r: MockDoseRecord): "normal" | "warning" | "critical" => {
  if (r.modality !== "CT") return "normal"; // DRL 仅针对 CT 电离辐射剂量
  const drl = findDrl(r.bodyPart);
  if (!drl) return "normal";
  if (r.ctdiVol > drl.ctdivolDrl * 1.5 || r.dlp > drl.dlpDrl * 1.5) return "critical";
  if (r.ctdiVol > drl.ctdivolDrl || r.dlp > drl.dlpDrl) return "warning";
  return "normal";
};

// ==================== 检查主脊 (store exams → 剂量记录) ====================
interface ExamSource {
  id?: string;
  reportId?: string;
  accessionNumber?: string;
  patientId?: string;
  patientName?: string;
  patientAge?: number;
  age?: number;
  modality?: string;
  bodyPart?: string;
  examItem?: string;
  examItemName?: string;
  examDate?: string;
  examAt?: string;
  deviceId?: string;
  deviceName?: string;
  deviceModel?: string;
  studyInstanceUID?: string;
  studyInstanceUid?: string;
}

/** 剂量监测覆盖的检查模态: CT / MR / IR(DSA 介入) */
const DOSE_SOURCE_MODALITIES = ["CT", "MR", "DSA"] as const;
const DOSE_RECORD_TOTAL = 30;
// 仅采用同步种子生成的检查 id (RPT-YYYYMMDD-xxxxx / RAD-EXxxx),
//   排除异步懒加载的 unified-exams, 保证抽样集合确定性
const STABLE_EXAM_ID = /^(RPT-\d{8}-\d{5}|RAD-EX\d{3,})$/;
const DEVICE_MODALITY_ORDER: DeviceModality[] = ["CT", "MR", "DR", "US", "MG", "DSA", "PET-CT"];

const examKey = (e: ExamSource) => String(e.id ?? e.reportId ?? "");
const examDay = (e: ExamSource) => {
  const raw = e.examDate ?? e.examAt ?? "";
  return raw ? raw.slice(0, 10) : "";
};
const compareExamDesc = (a: ExamSource, b: ExamSource) => {
  const da = examDay(a);
  const db = examDay(b);
  if (da !== db) return db.localeCompare(da);
  return examKey(a).localeCompare(examKey(b));
};

/** 确定性等距抽样: 保证日期跨度 (含当日) 且顺序稳定 */
const pickSpread = (items: ExamSource[], limit: number): ExamSource[] => {
  if (items.length <= limit) return [...items];
  const stride = Math.max(1, Math.floor(items.length / limit));
  const out: ExamSource[] = [];
  for (let i = 0; out.length < limit && i < items.length; i += stride) {
    const item = items[i];
    if (item && !out.includes(item)) out.push(item);
  }
  return out;
};

const resolveDevice = (
  examModality: string,
  deviceId: string | undefined,
  index: number,
): { id: string; name: string } => {
  const master = deviceId ? DEVICE_BY_ID[deviceId] : undefined;
  if (master) return { id: master.id, name: `${master.brand} ${master.model}` };
  const key = DEVICE_MODALITY_ORDER.find((m) => m === examModality) ?? "CT";
  const pool = DEVICES_BY_MODALITY[key];
  const fallback = pool[index % pool.length];
  return fallback
    ? { id: fallback.id, name: `${fallback.brand} ${fallback.model}` }
    : { id: "", name: "未知设备" };
};

const buildDoseRecords = (): MockDoseRecord[] => {
  seq = 20261011; // 重置种子 → 每次构建序列一致
  const exams = list<ExamSource>("exams");
  const candidates = exams.filter(
    (e) =>
      STABLE_EXAM_ID.test(examKey(e)) &&
      (DOSE_SOURCE_MODALITIES as readonly string[]).includes(String(e.modality ?? "")) &&
      !!e.patientId &&
      !!examDay(e),
  );
  const byModality = (m: string) => candidates.filter((e) => e.modality === m).sort(compareExamDesc);
  const picked: ExamSource[] = [];
  const add = (pool: ExamSource[], limit: number) => {
    for (const item of pickSpread(pool, limit)) {
      if (picked.length >= DOSE_RECORD_TOTAL) return;
      if (!picked.includes(item)) picked.push(item);
    }
  };
  add(byModality("CT"), 16);
  add(byModality("MR"), 8);
  add(byModality("DSA"), 6);
  if (picked.length < DOSE_RECORD_TOTAL) {
    for (const item of [...candidates].sort(compareExamDesc)) {
      if (picked.length >= DOSE_RECORD_TOTAL) break;
      if (!picked.includes(item)) picked.push(item);
    }
  }
  return picked.slice(0, DOSE_RECORD_TOTAL).map((e, i) => toDoseRecord(e, i + 1));
};

const toDoseRecord = (e: ExamSource, index: number): MockDoseRecord => {
  const examModality = String(e.modality ?? "CT");
  const examId = examKey(e);
  const patientId = resolvePatientId(String(e.patientId ?? ""));
  const patient = PATIENT_BY_ID[patientId];
  const patientName = patient?.name ?? e.patientName ?? patientId;
  const bodyPart = String(e.bodyPart ?? patient?.bodyPart ?? "未指定");
  const device = resolveDevice(examModality, e.deviceId, index);
  const isCt = examModality === "CT";
  const ctdiVol = isCt ? +(8 + lcg() * 42).toFixed(1) : 0;
  const dlp = isCt
    ? +(150 + lcg() * 900).toFixed(1)
    : examModality === "DSA"
      ? +(40 + lcg() * 260).toFixed(1)
      : 0;
  // MR 无电离辐射 → DAP=0; CT/DSA 由 DLP 派生 DAP (Gy·cm²)
  const dap = examModality === "MR" ? 0 : +(dlp * (1.1 + lcg() * 0.9)).toFixed(1);
  const record: MockDoseRecord = {
    id: `dr-${String(index).padStart(3, "0")}`,
    examId,
    accessionNumber: e.accessionNumber,
    patientId,
    patientName,
    age: e.patientAge ?? e.age ?? patient?.age,
    studyUid:
      e.studyInstanceUID ??
      e.studyInstanceUid ??
      `1.2.826.0.1.3680043.10.543.${fnv1a32(examId || `dr-${index}`)}`,
    modality: examModality === "DSA" ? "IR" : examModality,
    examModality,
    bodyPart,
    ctdiVol,
    dlp,
    dap,
    ssde: isCt ? +(8 + lcg() * 25).toFixed(1) : undefined,
    deviceId: device.id,
    deviceName: device.name,
    drlCompliant: true,
    date: examDay(e) || iso(new Date()),
  };
  record.drlCompliant = levelFor(record) === "normal";
  return record;
};

let doseRecordsCache: MockDoseRecord[] | null = null;
const doseRecords = (): MockDoseRecord[] => {
  if (!doseRecordsCache) doseRecordsCache = buildDoseRecords();
  return doseRecordsCache;
};

type RdsrResultWithLinks = RdsrResult & {
  examId: string;
  dap: number;
  deviceId: string;
  deviceName: string;
  drlCompliant: boolean;
};

function buildCheck(records: DrlCheckRecordInput[]): DrlCheckSummary {
  const overLimit: DrlCheckResult[] = [];
  for (const rec of records) {
    const ageGroup = rec.ageGroup ?? (rec.age !== undefined ? (rec.age < 15 ? "child" : "adult") : "adult");
    const drl = findDrl(rec.bodyPart, ageGroup);
    if (!drl) continue;
    const ctdivol = rec.ctdivol ?? 0;
    const dlp = rec.dlp ?? 0;
    const overCtdi = ctdivol > drl.ctdivolDrl;
    const overDlp = dlp > drl.dlpDrl;
    if (!overCtdi && !overDlp) continue;
    const level: "warning" | "critical" = ctdivol > drl.ctdivolDrl * 1.5 || dlp > drl.dlpDrl * 1.5 ? "critical" : "warning";
    const exceededBy = {
      ctdivol: drl.ctdivolDrl > 0 ? Math.round(((ctdivol - drl.ctdivolDrl) / drl.ctdivolDrl) * 100) : 0,
      dlp: drl.dlpDrl > 0 ? Math.round(((dlp - drl.dlpDrl) / drl.dlpDrl) * 100) : 0,
    };
    const ageLabel = ageGroup === "child" ? "儿童" : "成人";
    overLimit.push({
      id: uuidv4(),
      patientId: rec.patientId ?? null,
      patientName: rec.patientName ?? null,
      modality: rec.modality,
      bodyPart: rec.bodyPart,
      ctdivol,
      dlp,
      ssde: rec.ssde,
      examDate: rec.examDate ?? iso(new Date()),
      ageGroup,
      level,
      ctdivolDrl: drl.ctdivolDrl,
      dlpDrl: drl.dlpDrl,
      exceededBy,
      reason: level === "critical"
        ? `超过 ${ageLabel} DRL ${drl.ctdivolDrl}/${drl.dlpDrl} 的 150%`
        : `超过 ${ageLabel} DRL ${drl.ctdivolDrl}/${drl.dlpDrl}`,
    });
  }
  return {
    checked: records.length,
    overLimitCount: overLimit.length,
    warningCount: overLimit.filter((o) => o.level === "warning").length,
    criticalCount: overLimit.filter((o) => o.level === "critical").length,
    generatedAlertCount: 0,
    overLimit,
  };
}

const toResult = (r: MockDoseRecord): RdsrResultWithLinks => ({
  id: r.id,
  studyInstanceUid: r.studyUid,
  modality: r.modality,
  bodyPart: r.bodyPart,
  ctdivol: r.ctdiVol,
  dlp: r.dlp,
  ssde: r.ssde,
  totalExposure: 0,
  numberOfEvents: 0,
  examDate: r.date,
  alertLevel: levelFor(r),
  patientId: r.patientId,
  patientName: r.patientName,
  examId: r.examId,
  dap: r.dap,
  deviceId: r.deviceId,
  deviceName: r.deviceName,
  drlCompliant: r.drlCompliant,
});

const buildAlerts = (status?: string): DoseAlert[] => {
  const alerts: DoseAlert[] = [];
  for (const r of doseRecords()) {
    const level = levelFor(r);
    if (level === "normal") continue;
    const drl = findDrl(r.bodyPart);
    const acknowledged = ackedAlerts.has(r.id);
    if (status === "pending" && acknowledged) continue;
    if (status === "acknowledged" && !acknowledged) continue;
    alerts.push({
      id: r.id,
      patientId: r.patientId,
      patientName: r.patientName,
      modality: r.modality,
      bodyPart: r.bodyPart,
      ctdivol: r.ctdiVol,
      dlp: r.dlp,
      ssde: r.ssde,
      date: r.date,
      level,
      ctdivolDrl: drl?.ctdivolDrl ?? 0,
      dlpDrl: drl?.dlpDrl ?? 0,
      acknowledged,
    });
  }
  alerts.sort((a, b) => b.date.localeCompare(a.date) || b.dlp - a.dlp);
  return alerts;
};

const buildToday = (): TodayDoseStats => {
  const today = iso(new Date());
  const records = doseRecords().filter((r) => r.date === today);
  const byBodyPart = new Map<string, MockDoseRecord[]>();
  for (const r of records) {
    const list = byBodyPart.get(r.bodyPart) ?? [];
    list.push(r);
    byBodyPart.set(r.bodyPart, list);
  }
  const bodyPartDistribution = Array.from(byBodyPart.entries())
    .map(([bodyPart, items]) => ({
      bodyPart,
      examCount: items.length,
      avgDlp: +(items.reduce((s, r) => s + r.dlp, 0) / items.length).toFixed(1),
      avgCtdiVol: +(items.reduce((s, r) => s + r.ctdiVol, 0) / items.length).toFixed(1),
      overDrlCount: items.filter((r) => levelFor(r) !== "normal").length,
    }))
    .sort((a, b) => b.examCount - a.examCount);
  const levels = records.map(levelFor);
  return {
    date: today,
    totalExams: records.length,
    avgDlp: records.length === 0 ? 0 : +(records.reduce((s, r) => s + r.dlp, 0) / records.length).toFixed(1),
    avgCtdiVol: records.length === 0 ? 0 : +(records.reduce((s, r) => s + r.ctdiVol, 0) / records.length).toFixed(1),
    maxDlp: records.length === 0 ? 0 : Math.max(...records.map((r) => r.dlp)),
    overDrlCount: levels.filter((l) => l !== "normal").length,
    warningCount: levels.filter((l) => l === "warning").length,
    criticalCount: levels.filter((l) => l === "critical").length,
    bodyPartDistribution,
  };
};

const buildStats = (dateFrom?: string, dateTo?: string, modality?: string): RdsrStats => {
  let items = doseRecords();
  if (dateFrom) items = items.filter((r) => r.date >= dateFrom);
  if (dateTo) items = items.filter((r) => r.date <= dateTo);
  if (modality) items = items.filter((r) => r.modality === modality);
  if (items.length === 0) {
    return { totalExams: 0, avgCtdivol: 0, avgDlp: 0, maxCtdivol: 0, maxDlp: 0, warningCount: 0, criticalCount: 0, trend: [] };
  }
  const byDate = new Map<string, { ctdi: number[]; dlp: number[] }>();
  for (const r of items) {
    const entry = byDate.get(r.date) ?? { ctdi: [], dlp: [] };
    entry.ctdi.push(r.ctdiVol);
    entry.dlp.push(r.dlp);
    byDate.set(r.date, entry);
  }
  const trend = Array.from(byDate.entries())
    .map(([date, v]) => ({
      date,
      avgCtdivol: v.ctdi.reduce((s, x) => s + x, 0) / v.ctdi.length,
      avgDlp: v.dlp.reduce((s, x) => s + x, 0) / v.dlp.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    totalExams: items.length,
    avgCtdivol: items.reduce((s, r) => s + r.ctdiVol, 0) / items.length,
    avgDlp: items.reduce((s, r) => s + r.dlp, 0) / items.length,
    maxCtdivol: Math.max(...items.map((r) => r.ctdiVol)),
    maxDlp: Math.max(...items.map((r) => r.dlp)),
    warningCount: items.filter((r) => levelFor(r) === "warning").length,
    criticalCount: items.filter((r) => levelFor(r) === "critical").length,
    trend,
  };
};

const buildCumulative = (patientId: string): CumulativeDose => {
  const records = doseRecords().filter((r) => r.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date));
  const cutoff30 = iso(addDays(new Date(), -30));
  const cutoff365 = iso(addDays(new Date(), -365));
  const totalDlp30d = records.filter((r) => r.date >= cutoff30).reduce((s, r) => s + r.dlp, 0);
  const totalDlp1y = records.filter((r) => r.date >= cutoff365).reduce((s, r) => s + r.dlp, 0);
  const totalCtdiVol1y = records.filter((r) => r.date >= cutoff365).reduce((s, r) => s + r.ctdiVol, 0);
  const annualLimit = 5000;
  const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
    const month = iso(addDays(new Date(), -30 * (11 - i))).slice(0, 7);
    const totalDlp = records.filter((r) => r.date.startsWith(month)).reduce((s, r) => s + r.dlp, 0);
    return { month, totalDlp: +totalDlp.toFixed(1) };
  });
  return {
    patientId,
    patientName: records[0]?.patientName ?? patientId,
    totalExams: records.length,
    totalDlp30d: +totalDlp30d.toFixed(1),
    totalDlp1y: +totalDlp1y.toFixed(1),
    totalCtdiVol1y: +totalCtdiVol1y.toFixed(1),
    annualLimit,
    percentOfLimit30d: +((totalDlp30d / annualLimit) * 100).toFixed(1),
    percentOfLimit1y: +((totalDlp1y / annualLimit) * 100).toFixed(1),
    monthlyTrend,
    exams: records.map(toResult),
  };
};

const buildSummaries = (search?: string): PatientDoseSummary[] => {
  const byPatient = new Map<string, MockDoseRecord[]>();
  for (const r of doseRecords()) {
    const list = byPatient.get(r.patientId) ?? [];
    list.push(r);
    byPatient.set(r.patientId, list);
  }
  const cutoff30 = iso(addDays(new Date(), -30));
  const cutoff365 = iso(addDays(new Date(), -365));
  const summaries = Array.from(byPatient.entries()).map(([patientId, items]) => {
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    return {
      patientId,
      patientName: sorted[0]?.patientName ?? patientId,
      examCount: sorted.length,
      firstExamDate: sorted[0]?.date ?? "",
      lastExamDate: sorted[sorted.length - 1]?.date ?? "",
      totalDlp30d: +items.filter((r) => r.date >= cutoff30).reduce((s, r) => s + r.dlp, 0).toFixed(1),
      totalDlp1y: +items.filter((r) => r.date >= cutoff365).reduce((s, r) => s + r.dlp, 0).toFixed(1),
      overDrlCount: items.filter((r) => levelFor(r) !== "normal").length,
    };
  });
  if (search && search.trim() !== "") {
    const kw = search.trim().toLowerCase();
    return summaries.filter((s) => s.patientName.toLowerCase().includes(kw) || s.patientId.toLowerCase().includes(kw));
  }
  return summaries.sort((a, b) => b.totalDlp1y - a.totalDlp1y);
};

export const doseHandlers = [
  http.get(`${API_BASE}/rdsr/drl`, async ({ request }) => {
    await delay(60);
    const url = new URL(request.url);
    const modality = url.searchParams.get("modality");
    const bodyPart = url.searchParams.get("bodyPart");
    let data = DRLS;
    if (modality) data = data.filter((d) => d.modality === modality);
    if (bodyPart) data = data.filter((d) => d.bodyPart === bodyPart);
    return HttpResponse.json({ success: true, data });
  }),

  http.get(`${API_BASE}/rdsr/drls`, async ({ request }) => {
    const url = new URL(request.url);
    const modality = url.searchParams.get("modality");
    const bodyPart = url.searchParams.get("bodyPart");
    let data = DRLS;
    if (modality) data = data.filter((d) => d.modality === modality);
    if (bodyPart) data = data.filter((d) => d.bodyPart === bodyPart);
    return HttpResponse.json({ success: true, data });
  }),

  http.post(`${API_BASE}/rdsr/drl`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as { bodyPart: string; modality?: string; ctdivolDrl?: number; dlpDrl?: number; source?: string };
    if (!body.bodyPart || (body.ctdivolDrl === undefined && body.dlpDrl === undefined)) {
      return HttpResponse.json({ success: false, data: null, error: { code: "VALIDATION", message: "bodyPart 及至少一个阈值字段必填" } }, { status: 400 });
    }
    const existing = DRLS.find((d) => d.bodyPart === body.bodyPart);
    if (existing) {
      if (body.ctdivolDrl !== undefined) existing.ctdivolDrl = body.ctdivolDrl;
      if (body.dlpDrl !== undefined) existing.dlpDrl = body.dlpDrl;
      existing.source = body.source ?? "自定义";
    } else {
      DRLS.push({
        modality: body.modality ?? "CT",
        bodyPart: body.bodyPart,
        ctdivolDrl: body.ctdivolDrl ?? 0,
        dlpDrl: body.dlpDrl ?? 0,
        source: body.source ?? "自定义",
      });
    }
    return HttpResponse.json({ success: true, data: DRLS });
  }),

  http.post(`${API_BASE}/rdsr/check`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as { records: DrlCheckRecordInput[] };
    return HttpResponse.json({ success: true, data: buildCheck(body.records ?? []) });
  }),

  // [G005] 30 条剂量记录 (源自 store exams, 关联 patient/device/DRL 合规)
  http.get(`${API_BASE}/rdsr/records`, async () => {
    await delay(90);
    return HttpResponse.json({ success: true, data: doseRecords().map(toResult) });
  }),

  http.get(`${API_BASE}/rdsr/today`, async () => {
    await delay(80);
    return HttpResponse.json({ success: true, data: buildToday() });
  }),

  http.get(`${API_BASE}/rdsr/stats`, async ({ request }) => {
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
    const dateTo = url.searchParams.get("dateTo") ?? undefined;
    const modality = url.searchParams.get("modality") ?? undefined;
    return HttpResponse.json({ success: true, data: buildStats(dateFrom, dateTo, modality) });
  }),

  http.post(`${API_BASE}/rdsr/parse`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as {
      dicomJson?: Record<string, unknown>;
      modality?: string;
      patientId?: string;
      patientName?: string;
      examDate?: string;
      deviceId?: string;
    };
    const json = body.dicomJson ?? {};
    const patientId = resolvePatientId(body.patientId ?? doseRecords()[0]?.patientId ?? "P000001");
    const patient = PATIENT_BY_ID[patientId];
    const patientName = body.patientName ?? patient?.name ?? patientId;
    const bodyPart = typeof json.BodyPartExamined === "string" && json.BodyPartExamined !== ""
      ? String(json.BodyPartExamined)
      : BODY_PARTS[Math.floor(lcg() * BODY_PARTS.length)]!;
    const modality = body.modality ?? "CT";
    const device = resolveDevice(modality, body.deviceId, doseRecords().length + 1);
    const dlp = +(200 + lcg() * 800).toFixed(1);
    const record: MockDoseRecord = {
      id: uuidv4(),
      examId: "",
      patientId,
      patientName,
      age: patient?.age,
      studyUid: typeof json.StudyInstanceUID === "string" ? String(json.StudyInstanceUID) : `1.2.840.${Date.now()}`,
      modality: modality === "DSA" ? "IR" : modality,
      examModality: modality,
      bodyPart,
      ctdiVol: modality === "CT" ? +(10 + lcg() * 40).toFixed(1) : 0,
      dlp: modality === "CT" ? dlp : 0,
      dap: modality === "CT" ? +(dlp * (1.1 + lcg() * 0.9)).toFixed(1) : modality === "DSA" ? +(400 + lcg() * 3600).toFixed(1) : 0,
      ssde: modality === "CT" ? +(12 + lcg() * 30).toFixed(1) : undefined,
      deviceId: device.id,
      deviceName: device.name,
      drlCompliant: true,
      date: body.examDate ?? iso(new Date()),
    };
    record.drlCompliant = levelFor(record) === "normal";
    doseRecords().unshift(record);
    return HttpResponse.json({ success: true, data: toResult(record) }, { status: 201 });
  }),

  http.get(`${API_BASE}/rdsr/patients`, async ({ request }) => {
    await delay(90);
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? undefined;
    return HttpResponse.json({ success: true, data: buildSummaries(search) });
  }),

  http.get(`${API_BASE}/rdsr/patients/:id/cumulative`, async ({ params }) => {
    await delay(110);
    const patientId = String(params.id);
    const has = doseRecords().some((r) => r.patientId === patientId);
    if (!has) {
      return HttpResponse.json({ success: false, data: null, error: { code: "NOT_FOUND", message: `未找到患者 ${patientId} 的剂量记录` } }, { status: 404 });
    }
    return HttpResponse.json({ success: true, data: buildCumulative(patientId) });
  }),

  http.get(`${API_BASE}/rdsr/alerts`, async ({ request }) => {
    await delay(100);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    return HttpResponse.json({ success: true, data: buildAlerts(status ?? undefined) });
  }),

  http.post(`${API_BASE}/rdsr/alerts/:id/ack`, async ({ params }) => {
    await delay(100);
    const id = String(params.id);
    const record = doseRecords().find((r) => r.id === id);
    const level = record ? levelFor(record) : "normal";
    if (!record || level === "normal") {
      return HttpResponse.json({ success: false, data: null, error: { code: "NOT_FOUND", message: "未找到该告警" } }, { status: 404 });
    }
    ackedAlerts.add(id);
    const drl = findDrl(record.bodyPart);
    return HttpResponse.json({
      success: true,
      data: {
        id,
        patientId: record.patientId,
        patientName: record.patientName,
        modality: record.modality,
        bodyPart: record.bodyPart,
        ctdivol: record.ctdiVol,
        dlp: record.dlp,
        ssde: record.ssde,
        date: record.date,
        level,
        ctdivolDrl: drl?.ctdivolDrl ?? 0,
        dlpDrl: drl?.dlpDrl ?? 0,
        acknowledged: true,
        ackedAt: new Date().toISOString(),
      } satisfies DoseAlert,
    });
  }),
];
