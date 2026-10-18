// [W2-B-3] /api/v1/radpath MSW handlers
// 对齐后端 radpath.controller (create / report/:reportId / pathology/:pathId /
//   consistency / stats) + 前端 radpathApi.getRecords 需的 /records 端点。
// 页面: /radpath (RadPathPage) /radpath/tracker (RadPathTrackerPage) /radpath/detail
import { http, HttpResponse, delay } from "msw";
import { v4 as uuidv4 } from "uuid";
// [G005 demo-data] 25 组影像-病理配对: patientId ← PATIENT_MASTER, examId/reportId ← store.list('exams'),
//   store 为空则回落 EXAM_REPORT_PRE
import { list } from "./store";
import { PATIENT_MASTER, PATIENT_BY_ID } from "../../data/master";
import { EXAM_REPORT_PRE } from "../../data/_generators";

const API = "/api/v1/radpath";

// 确定性延迟抖动 (无模块级 Math.random)
let delayTick = 0;
const delayMs = (min = 50, max = 150) =>
  min + ((delayTick++ * 37) % Math.max(1, max - min));

// ==================== [G005 demo-data] 25 组 影像→报告→病理标本→病理报告 配对种子 ====================
// 一致率: 22 concordant / 25 = 88.0%, 3 组 discordant (下标 4/13/21)
const RECORD_COUNT = 25;
const DAY_MS = 86400000;
const HOUR_MS = 3600000;
const DISCORDANT_INDEX = new Set([4, 13, 21]);

const PATHOLOGISTS = [
  { id: "PATH-D01", name: "陈之远" },
  { id: "PATH-D02", name: "周敏行" },
  { id: "PATH-D03", name: "吴清源" },
  { id: "PATH-D04", name: "郑怀安" },
];

interface SeedExamRef {
  examId: string;
  reportId: string;
  patientId: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  examItem: string;
  findings: string;
  impression: string;
  examAt: string;
  accessionNumber: string;
  patientGender: string;
  patientAge: number;
  birthDate: string;
}

interface RegionRecipe {
  keys: string[];
  finding: string;
  impression: string;
  concordant: string;
  discordant: string;
  specimenType: string;
  malignancy: "恶性" | "良性" | "交界性";
}

const REGION_RECIPES: RegionRecipe[] = [
  {
    keys: ["胸部", "肺"],
    finding: "右肺上叶磨玻璃结节，大小约 8×6mm，边界清晰，可见浅分叶征",
    impression: "肺结节 (Lung-RADS 4A)，建议穿刺活检明确性质",
    concordant: "微浸润性肺腺癌 (MIA, IA1期)",
    discordant: "局灶性纤维化伴慢性炎症",
    specimenType: "CT引导下经皮肺穿刺活检",
    malignancy: "恶性",
  },
  {
    keys: ["腹部", "全腹", "肝脏"],
    finding:
      "肝右叶稍低密度结节，约 32×28mm，动脉期明显强化，门脉期廓清 (快进快出)",
    impression: "肝细胞癌可能性大 (LI-RADS 4)",
    concordant: "肝细胞癌 (中分化)",
    discordant: "肝血管瘤",
    specimenType: "超声引导下肝穿刺活检",
    malignancy: "恶性",
  },
  {
    keys: ["乳腺"],
    finding: "左乳外上象限结节伴细小多形性钙化，约 15×11mm，边界不规则",
    impression: "BI-RADS 4C，建议空芯针活检",
    concordant: "浸润性导管癌 (Nottingham II级)",
    discordant: "纤维腺瘤伴钙化",
    specimenType: "空芯针穿刺活检",
    malignancy: "恶性",
  },
  {
    keys: ["头部", "脑部", "颅脑"],
    finding:
      "右侧额叶占位，T1WI等信号、T2WI混杂信号，增强后不均匀强化，周边片状水肿",
    impression: "高级别胶质瘤可能，建议手术切除后病理",
    concordant: "胶质母细胞瘤 (IDH野生型, WHO 4级)",
    discordant: "放射性坏死伴脱髓鞘改变",
    specimenType: "手术切除标本",
    malignancy: "恶性",
  },
  {
    keys: ["盆腔"],
    finding: "前列腺外周带结节，约 14×12mm，DWI明显弥散受限，ADC值降低",
    impression: "前列腺癌可能性大 (PI-RADS 5)",
    concordant: "前列腺腺癌 (Gleason 3+4=7,  grade group 2)",
    discordant: "前列腺炎性肉芽肿",
    specimenType: "经会阴前列腺穿刺活检",
    malignancy: "恶性",
  },
  {
    keys: ["颈椎", "腰椎", "脊柱", "胸椎"],
    finding: "腰 4/5 椎间盘后突，相应硬膜囊及右侧神经根受压，黄韧带增厚",
    impression: "腰椎间盘突出伴神经根受压",
    concordant: "椎间盘退行性变伴纤维环撕裂",
    discordant: "椎管内神经鞘瘤",
    specimenType: "手术切除标本",
    malignancy: "良性",
  },
  {
    keys: ["冠脉", "心脏", "肺动脉"],
    finding: "冠脉多发钙化，左前降支近段非钙化斑块，管腔狭窄约 60%",
    impression: "冠心病 (不稳定型心绞痛待排)，建议 DSA 造影",
    concordant: "粥样斑块形成伴管腔中度狭窄",
    discordant: "血管壁炎性改变 (川崎病后改变)",
    specimenType: "旋磨+抽吸物病理",
    malignancy: "良性",
  },
  {
    keys: ["泌尿系", "肾脏"],
    finding: "左肾上极占位，约 35×30mm，增强呈不均匀强化，皮质期明显强化",
    impression: "肾细胞癌可能性大",
    concordant: "透明细胞肾细胞癌 (ISUP II级)",
    discordant: "肾嗜酸细胞腺瘤",
    specimenType: "手术切除标本",
    malignancy: "恶性",
  },
  {
    keys: ["膝关节", "肩关节", "关节"],
    finding: "右膝外侧半月板后角线状高信号达关节面，前交叉韧带连续性中断",
    impression: "外侧半月板撕裂伴前交叉韧带损伤",
    concordant: "半月板水平撕裂 (Ⅲ级)",
    discordant: "半月板黏液样退变 (Ⅰ-Ⅱ级)",
    specimenType: "关节镜手术标本",
    malignancy: "良性",
  },
  {
    keys: ["垂体", "脑垂体"],
    finding: "垂体右侧微腺体，约 8mm，增强后强化低于正常垂体",
    impression: "垂体微腺瘤 (泌乳素瘤待排)",
    concordant: "垂体腺瘤 (稀疏颗粒型, WHO 1级)",
    discordant: "垂体细胞增生",
    specimenType: "经蝶手术标本",
    malignancy: "良性",
  },
];

const GENERIC_RECIPE: RegionRecipe = {
  keys: [],
  finding: "检查部位见异常密度/信号区，边界欠清，建议结合临床进一步评估",
  impression: "影像表现不典型，建议穿刺活检或短期随访",
  concordant: "病理未见恶性证据, 与影像表现相符",
  discordant: "病理结果与影像诊断不符, 建议 MDT 讨论",
  specimenType: "穿刺活检",
  malignancy: "良性",
};

function pickRecipe(
  bodyPart: string,
  examItem: string,
  index: number,
): RegionRecipe {
  const text = `${bodyPart} ${examItem}`;
  const hit = REGION_RECIPES.find((r) => r.keys.some((k) => text.includes(k)));
  return hit ?? REGION_RECIPES[index % REGION_RECIPES.length] ?? GENERIC_RECIPE;
}

function normalizeSeedExam(row: unknown): SeedExamRef | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const reportId = String(r.reportId ?? r.id ?? "");
  const patientId = String(r.patientId ?? "");
  if (!reportId || !patientId) return null;
  const person = PATIENT_BY_ID[patientId];
  const patientName = String(r.patientName ?? person?.name ?? "");
  if (!patientName) return null;
  const age =
    typeof r.patientAge === "number" ? r.patientAge : (person?.age ?? 0);
  return {
    examId: String(r.id ?? reportId),
    reportId,
    patientId,
    patientName,
    modality: String(r.modality ?? "CT"),
    bodyPart: String(r.bodyPart ?? "未知"),
    examItem: String(r.examItem ?? ""),
    findings: String(r.findings ?? ""),
    impression: String(r.impression ?? ""),
    examAt: String(r.examAt ?? ""),
    accessionNumber: String(r.accessionNumber ?? `ACC-${reportId}`),
    patientGender: String(r.patientGender ?? person?.gender ?? "男"),
    patientAge: age,
    birthDate: String(person?.birthDate ?? ""),
  };
}

function pickSeedExams(count: number, allowed: string[]): SeedExamRef[] {
  const allow = new Set(allowed);
  const out: SeedExamRef[] = [];
  const used = new Set<string>();
  const push = (row: unknown): void => {
    const normalized = normalizeSeedExam(row);
    if (!normalized || used.has(normalized.reportId)) return;
    used.add(normalized.reportId);
    out.push(normalized);
  };
  let raw: unknown[] = [];
  try {
    raw = list<unknown>("exams");
  } catch {
    raw = [];
  }
  const pool = raw.filter((row) => {
    if (!row || typeof row !== "object") return false;
    return allow.has(String((row as Record<string, unknown>).modality ?? ""));
  });
  if (pool.length > 0) {
    const strideCount = Math.min(count, pool.length);
    const step = pool.length / strideCount;
    for (let i = 0; i < strideCount; i++) push(pool[Math.floor(i * step)]);
  }
  if (out.length < count)
    for (const row of pool) {
      if (out.length >= count) break;
      push(row);
    }
  if (out.length < count) {
    const seen = new Set(used);
    for (const row of EXAM_REPORT_PRE) {
      if (out.length >= count) break;
      if (allow.has(row.modality) && !seen.has(row.reportId)) push(row);
    }
  }
  if (out.length < count) {
    // store + 生成器同时不可用: PATIENT_MASTER 兜底
    PATIENT_MASTER.forEach((p, i) => {
      if (out.length >= count) return;
      const seq = String(i + 1).padStart(5, "0");
      const reportId = `RPT-FALLBACK-${seq}`;
      if (used.has(reportId)) return;
      used.add(reportId);
      out.push({
        examId: `EXAM-FALLBACK-${seq}`,
        reportId,
        patientId: p.id,
        patientName: p.name,
        modality: allowed[i % allowed.length] ?? "CT",
        bodyPart: p.bodyPart,
        examItem: p.examItem,
        findings: `${p.bodyPart}检查所见请结合临床。`,
        impression: `${p.bodyPart}检查建议随访或进一步检查。`,
        examAt: p.examDate,
        accessionNumber: `ACC-FALLBACK-${seq}`,
        patientGender: p.gender,
        patientAge: p.age,
        birthDate: p.birthDate,
      });
    });
  }
  return out;
}

function buildSeedRecords(): any[] {
  const exams = pickSeedExams(RECORD_COUNT, ["CT", "MR"]);
  const now = Date.now();
  return exams.map((exam, i) => {
    const seq = String(i + 1).padStart(4, "0");
    const recipe = pickRecipe(exam.bodyPart, exam.examItem, i);
    const discordant = DISCORDANT_INDEX.has(i);
    const pathResult = discordant ? recipe.discordant : recipe.concordant;
    const malignancy = discordant
      ? recipe.malignancy === "恶性"
        ? "良性"
        : "恶性"
      : recipe.malignancy;
    const pathologist = PATHOLOGISTS[i % PATHOLOGISTS.length]!;

    // 周转时间 (TAT): 影像报告 20-80min, 报告→取材 6-48h, 取材→病理报告 12-48h
    const examToReportMin = 20 + ((i * 11) % 61);
    const reportToSpecimenH = 6 + ((i * 7) % 43);
    const specimenToPathH = 12 + ((i * 5) % 37);
    const parsedExamAt = Date.parse(exam.examAt || "");
    const examAtMs =
      Number.isFinite(parsedExamAt) && parsedExamAt > 0
        ? parsedExamAt
        : now - (30 + ((i * 5) % 140)) * DAY_MS;
    const reportAtMs = examAtMs + examToReportMin * 60000;
    const collectedAtMs = reportAtMs + reportToSpecimenH * HOUR_MS;
    const receivedAtMs = collectedAtMs + 2 * HOUR_MS;
    const pathAtMs = receivedAtMs + specimenToPathH * HOUR_MS;
    const totalH = +(
      examToReportMin / 60 +
      reportToSpecimenH +
      specimenToPathH
    ).toFixed(1);

    return {
      id: `RP-${String(i + 1).padStart(3, "0")}`,
      reportId: exam.reportId,
      examId: exam.examId,
      patientId: exam.patientId,
      patientName: exam.patientName,
      pathologyId: `PATH-2026-${seq}`,
      modality: exam.modality,
      radFinding: recipe.finding,
      radImpression: recipe.impression,
      pathResult,
      consistency: discordant ? "discordant" : "concordant",
      notes: discordant ? "影像与病理不一致, 建议 MDT 讨论" : "影像与病理一致",
      specimen: {
        id: `SPC-2026-${seq}`,
        type: recipe.specimenType,
        site: exam.bodyPart,
        blocks: 1 + (i % 4),
        stain: "HE + 免疫组化",
        collectedAt: new Date(collectedAtMs).toISOString(),
        receivedAt: new Date(receivedAtMs).toISOString(),
      },
      pathReport: {
        id: `PATH-2026-${seq}`,
        diagnosis: pathResult,
        malignancy,
        pathologistId: pathologist.id,
        pathologistName: pathologist.name,
        signedAt: new Date(pathAtMs).toISOString(),
      },
      turnaround: {
        examToReportMin,
        reportToSpecimenH,
        specimenToPathH,
        totalH,
      },
      createdAt: new Date(reportAtMs).toISOString(),
      report: {
        id: exam.reportId,
        findings: exam.findings || recipe.finding,
        conclusion: exam.impression || recipe.impression,
        signedAt: new Date(reportAtMs).toISOString(),
        patient: {
          name: exam.patientName,
          gender: exam.patientGender,
          birthDate: exam.birthDate,
        },
        exam: {
          modality: exam.modality,
          bodyPart: exam.bodyPart,
          accessionNumber: exam.accessionNumber,
        },
      },
    };
  });
}

let records: any[] = [];
let seeded = false;

// 幂等种子: 首个路由命中时构建
function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  records = buildSeedRecords();
}

// 路由入口统一入口: 先确保种子就绪, 再执行 msw delay
function routeDelay(ms: number): Promise<void> {
  ensureSeeded();
  return delay(ms);
}

// [demo 兜底] 演示版深链接 (如 /radpath/detail/RPT001) 携带的 id 未必命中种子:
//   种子 reportId 形如 `RPT-YYYYMMDD-00001`, 而 E2E 夹具 / 用户手输可能是 `RPT001`。
//   为避免演示页因 404 空白 (与 users.controller 的合成用户兜底策略一致),
//   未命中时按请求 id 合成一条确定性记录, 保持成功响应形状不变。
function synthesizeRecord(reportId: string, pathologyId?: string): any {
  const now = new Date().toISOString();
  const pid = pathologyId ?? `PATH-${reportId}`;
  const finding = "影像表现参见报告原文, 详见结构化描述。";
  const conclusion = "影像所见需结合病理进一步评估。";
  const pathResult = "病理未见明确恶性证据, 与影像表现基本相符。";
  return {
    id: `RP-FALLBACK-${reportId}`,
    reportId,
    examId: `EXAM-${reportId}`,
    patientId: "P001",
    patientName: "演示患者",
    pathologyId: pid,
    modality: "CT",
    radFinding: finding,
    radImpression: conclusion,
    pathResult,
    consistency: "pending",
    notes: "演示兜底记录 (未命中种子)",
    specimen: {
      id: `SPC-${reportId}`,
      type: "穿刺活检",
      site: "胸部",
      blocks: 1,
      stain: "HE + 免疫组化",
      collectedAt: now,
      receivedAt: now,
    },
    pathReport: {
      id: pid,
      diagnosis: pathResult,
      malignancy: "良性",
      pathologistId: PATHOLOGISTS[0]!.id,
      pathologistName: PATHOLOGISTS[0]!.name,
      signedAt: now,
    },
    turnaround: {
      examToReportMin: 30,
      reportToSpecimenH: 12,
      specimenToPathH: 24,
      totalH: 36.5,
    },
    createdAt: now,
    report: {
      id: reportId,
      findings: finding,
      conclusion,
      signedAt: now,
      patient: { name: "演示患者", gender: "男", birthDate: "" },
      exam: {
        modality: "CT",
        bodyPart: "胸部",
        accessionNumber: `ACC-${reportId}`,
      },
    },
  };
}

export const radpathHandlers = [
  http.get(`${API}/records`, async () => {
    await routeDelay(delayMs());
    return HttpResponse.json({ success: true, data: records });
  }),

  http.post(`${API}/create`, async ({ request }) => {
    await routeDelay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const newRecord = {
      id: `RP-${uuidv4().slice(0, 8)}`,
      reportId: String(body?.reportId ?? ""),
      pathologyId: String(body?.pathologyId ?? ""),
      radFinding: String(body?.radFinding ?? ""),
      pathResult: String(body?.pathResult ?? ""),
      consistency: String(body?.consistency ?? "pending"),
      notes: body?.notes ? String(body.notes) : undefined,
      createdAt: new Date().toISOString(),
      report: {
        id: String(body?.reportId ?? ""),
        findings: String(body?.radFinding ?? ""),
        conclusion: "影像与病理对照",
        signedAt: new Date().toISOString(),
        patient: { name: "演示患者", gender: "男", birthDate: "" },
        exam: { modality: "CT", bodyPart: "胸部", accessionNumber: "" },
      },
    };
    records = [newRecord, ...records];
    return HttpResponse.json(
      { success: true, data: newRecord },
      { status: 201 },
    );
  }),

  http.get(`${API}/report/:reportId`, async ({ params }) => {
    await routeDelay(delayMs());
    let item = records.find((r) => r.reportId === params.reportId);
    // 未命中: 合成并落库, 使后续 PUT /consistency 能命中同一条记录
    if (!item) {
      item = synthesizeRecord(String(params.reportId));
      records = [item, ...records];
    }
    return HttpResponse.json({ success: true, data: item });
  }),

  http.get(`${API}/pathology/:pathId`, async ({ params }) => {
    await routeDelay(delayMs());
    let item = records.find((r) => r.pathologyId === params.pathId);
    if (!item) {
      item = synthesizeRecord(
        `RPT-${String(params.pathId)}`,
        String(params.pathId),
      );
      records = [item, ...records];
    }
    return HttpResponse.json({ success: true, data: item });
  }),

  http.put(`${API}/consistency`, async ({ request }) => {
    await routeDelay(delayMs());
    const body = (await request.json().catch(() => ({}))) as any;
    const found = records.find((r) => r.id === body?.id);
    if (!found)
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `RadPath record ${body?.id} not found`,
          },
        },
        { status: 404 },
      );
    const updated = {
      ...found,
      consistency: String(body?.consistency ?? found.consistency),
      notes: body?.notes !== undefined ? String(body.notes) : found.notes,
    };
    records = records.map((r) => (r.id === updated.id ? updated : r));
    return HttpResponse.json({ success: true, data: updated });
  }),

  http.get(`${API}/stats`, async () => {
    await routeDelay(delayMs());
    const total = records.length;
    const concordant = records.filter(
      (r) => r.consistency === "concordant",
    ).length;
    const discordant = records.filter(
      (r) => r.consistency === "discordant",
    ).length;
    const pending = records.filter((r) => r.consistency === "pending").length;
    const trendMap = new Map<string, { total: number; concordant: number }>();
    for (const r of records) {
      const month = (r.createdAt ?? "").slice(0, 7);
      const entry = trendMap.get(month) ?? { total: 0, concordant: 0 };
      entry.total += 1;
      if (r.consistency === "concordant") entry.concordant += 1;
      trendMap.set(month, entry);
    }
    const trend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        rate: v.total > 0 ? +((v.concordant / v.total) * 100).toFixed(1) : 0,
      }));
    const turnaroundValues = records
      .map((r) => Number(r.turnaround?.totalH ?? 0))
      .filter((v) => v > 0);
    const avgTurnaroundHours =
      turnaroundValues.length > 0
        ? +(
            turnaroundValues.reduce((s, v) => s + v, 0) /
            turnaroundValues.length
          ).toFixed(1)
        : 0;
    const modalityBreakdown = ["CT", "MR"].map((m) => ({
      modality: m,
      count: records.filter((r) => r.modality === m).length,
    }));
    return HttpResponse.json({
      success: true,
      data: {
        total,
        concordant,
        discordant,
        pending,
        positiveConsistency:
          total > 0 ? +((concordant / total) * 100).toFixed(1) : 0,
        avgTurnaroundHours,
        modalityBreakdown,
        trend,
      },
    });
  }),
];
