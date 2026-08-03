import { http, HttpResponse, delay } from "msw";
import { v4 as uuidv4 } from "uuid";
import type {
  DrlEntry,
  RdsrResult,
  DoseAlert,
  CumulativeDose,
  PatientDoseSummary,
  TodayDoseStats,
  RdsrStats,
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

interface MockDoseRecord {
  id: string;
  patientId: string;
  patientName: string;
  studyUid: string;
  modality: string;
  bodyPart: string;
  ctdiVol: number;
  dlp: number;
  ssde?: number;
  date: string;
}

const PATIENTS = [
  { id: "P1001", name: "张三" },
  { id: "P1002", name: "李四" },
  { id: "P1003", name: "王五" },
  { id: "P1004", name: "赵六" },
  { id: "P1005", name: "陈七" },
  { id: "P1006", name: "刘八" },
  { id: "P1007", name: "周九" },
  { id: "P1008", name: "吴十" },
];

const BODY_PARTS = ["头部", "胸部", "腹部", "盆腔", "腰椎"];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, days: number) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
};

let seq = 0;
const lcg = () => {
  seq = (seq * 1103515245 + 12345) % 2147483648;
  return seq / 2147483648;
};

const MOCK_RECORDS: MockDoseRecord[] = [];
const NOW = new Date();
for (let i = 0; i < 64; i++) {
  const patient = PATIENTS[i % PATIENTS.length]!;
  const bodyPart = BODY_PARTS[i % BODY_PARTS.length]!;
  const daysAgo = i < 8 ? 0 : 1 + Math.floor(lcg() * 364);
  const date = iso(addDays(NOW, -daysAgo));
  const ctdiVol = +(10 + lcg() * 45).toFixed(1);
  const dlp = +(200 + lcg() * 850).toFixed(1);
  MOCK_RECORDS.push({
    id: `dr-${String(i + 1).padStart(3, "0")}`,
    patientId: patient.id,
    patientName: patient.name,
    studyUid: `1.2.840.113654.2026.${String(100000 + i)}`,
    modality: "CT",
    bodyPart,
    ctdiVol,
    dlp,
    ssde: +(10 + lcg() * 30).toFixed(1),
    date,
  });
}

const ackedAlerts = new Set<string>([]);

const findDrl = (bodyPart: string): DrlEntry | undefined =>
  DRLS.find((d) => d.bodyPart === bodyPart);

const levelFor = (r: MockDoseRecord): "normal" | "warning" | "critical" => {
  const drl = findDrl(r.bodyPart);
  if (!drl) return "normal";
  if (r.ctdiVol > drl.ctdivolDrl * 1.5 || r.dlp > drl.dlpDrl * 1.5) return "critical";
  if (r.ctdiVol > drl.ctdivolDrl || r.dlp > drl.dlpDrl) return "warning";
  return "normal";
};

const toResult = (r: MockDoseRecord): RdsrResult => ({
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
});

const buildAlerts = (status?: string): DoseAlert[] => {
  const alerts: DoseAlert[] = [];
  for (const r of MOCK_RECORDS) {
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
  const records = MOCK_RECORDS.filter((r) => r.date === today);
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
  let items = MOCK_RECORDS;
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
  const records = MOCK_RECORDS.filter((r) => r.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date));
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
  for (const r of MOCK_RECORDS) {
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
    const body = (await request.json()) as { dicomJson?: Record<string, unknown>; modality?: string; patientId?: string; patientName?: string; examDate?: string };
    const json = body.dicomJson ?? {};
    const patient = PATIENTS[Math.floor(Math.random() * PATIENTS.length)]!;
    const bodyPart = typeof json.BodyPartExamined === "string" && json.BodyPartExamined !== "" ? String(json.BodyPartExamined) : BODY_PARTS[Math.floor(Math.random() * BODY_PARTS.length)]!;
    const record: MockDoseRecord = {
      id: uuidv4(),
      patientId: body.patientId ?? patient.id,
      patientName: body.patientName ?? patient.name,
      studyUid: typeof json.StudyInstanceUID === "string" ? String(json.StudyInstanceUID) : `1.2.840.${Date.now()}`,
      modality: body.modality ?? "CT",
      bodyPart,
      ctdiVol: +(10 + Math.random() * 40).toFixed(1),
      dlp: +(200 + Math.random() * 800).toFixed(1),
      ssde: +(12 + Math.random() * 30).toFixed(1),
      date: body.examDate ?? iso(new Date()),
    };
    MOCK_RECORDS.unshift(record);
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
    const has = MOCK_RECORDS.some((r) => r.patientId === patientId);
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
    const record = MOCK_RECORDS.find((r) => r.id === id);
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
