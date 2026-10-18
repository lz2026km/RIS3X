/**
 * G005 RIS v3.0.5.1 - R3.DEFECT 缺陷库服务
 * [v3.0.6.16-8] 读走真后端 (defect-library / qc-analytics loop), 失败回退 demo 并标记 source;
 *   写 (导入/删除/提交整改/发送提醒) 走真接口, 失败不谎报成功。
 */
import {
  DEFECT_CATEGORIES,
  DEFECT_DETAILS,
  DEFECT_ANALYTICS,
  DEFECT_IMPORT_RECORDS,
} from "../../data/defectLibraryMock";
import { DEFECT_REMEDIATIONS } from "../../data/reportQualityMock";
import {
  qualityScoringCenterApi,
  type DefectItem,
} from "../api/qualityScoringCenterApi";
import { qcAnalyticsApi, type RectificationItem } from "../api/qcAnalyticsApi";
import type {
  DefectCategory,
  DefectDetail,
  DefectAnalytics,
  DefectImportRecord,
  DefectTreeNode,
  DefectRemediation,
  DefectCategoryCode,
  DefectFilter,
  DefectStatus,
  DefectSeverityLevel,
} from "../../types/R3/R3.DEFECT";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const CATEGORY_FROM_API: Record<string, DefectCategoryCode> = {
  STRUCT: "FMT",
  TERM: "TER",
  ACCUR: "LOG",
  TIMELY: "TIM",
  IMAGE: "IMG",
  PROC: "CRI",
};
const CATEGORY_TO_API: Record<DefectCategoryCode, string> = {
  FMT: "STRUCT",
  TER: "TERM",
  LOG: "ACCUR",
  TIM: "TIMELY",
  IMG: "IMAGE",
  CRI: "PROC",
  DSC: "STRUCT",
  CMP: "STRUCT",
  CON: "ACCUR",
  OTH: "STRUCT",
};
const SEVERITY_FROM_API: Record<string, DefectSeverityLevel> = {
  low: "minor",
  medium: "major",
  high: "critical",
  critical: "critical",
};
const SEVERITY_TO_API: Record<DefectSeverityLevel, DefectItem["severity"]> = {
  minor: "low",
  major: "medium",
  critical: "critical",
};
const SEVERITY_FROM_LOOP: Record<string, DefectRemediation["severity"]> = {
  low: "minor",
  medium: "major",
  high: "critical",
  critical: "critical",
};
const LOOP_STATUS_TO_REM: Record<string, DefectRemediation["status"]> = {
  open: "pending",
  rectifying: "in-progress",
  rechecking: "rectified",
  closed: "rectified",
};

const inMemoryImports: DefectImportRecord[] = clone(DEFECT_IMPORT_RECORDS);

// ============================================================
// 映射 / 过滤工具
// ============================================================
function mapDefectItem(it: DefectItem): DefectDetail {
  const now = new Date().toISOString();
  return {
    id: it.id,
    code: it.code,
    name: it.name,
    nameEn: it.nameEn ?? "",
    category: CATEGORY_FROM_API[String(it.categoryCode).toUpperCase()] ?? "OTH",
    severity: SEVERITY_FROM_API[it.severity] ?? "minor",
    description: it.description,
    descriptionEn: "",
    examples: [],
    solution: it.checkMethod ?? it.standard ?? "",
    solutionEn: "",
    references: it.standard ? [it.standard] : [],
    count: 0,
    isActive: true,
    customDefect: false,
    level: 2,
    tags: [],
    createdBy: "system",
    createdAt: now,
    updatedAt: now,
    sla: 24,
    trainingRequired: false,
    source: "database",
  };
}

function applyFilter(
  list: DefectDetail[],
  filter?: DefectFilter,
): DefectDetail[] {
  let out = list;
  if (filter?.category) out = out.filter((d) => d.category === filter.category);
  if (filter?.severity) out = out.filter((d) => d.severity === filter.severity);
  if (filter?.status) {
    const map: Record<DefectStatus, boolean> = {
      active: true,
      deprecated: false,
      draft: true,
      reviewing: true,
    };
    out = out.filter((d) => map[filter.status!] === d.isActive);
  }
  if (filter?.customOnly) out = out.filter((d) => d.customDefect);
  if (filter?.level) out = out.filter((d) => d.level === filter.level);
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    out = out.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q),
    );
  }
  if (filter?.tags && filter.tags.length > 0)
    out = out.filter((d) => filter.tags!.some((x) => d.tags.includes(x)));
  return out;
}

function mapLoopItem(it: RectificationItem): DefectRemediation {
  const deadline =
    it.closedAt ??
    new Date(new Date(it.createdAt).getTime() + 7 * 86400000).toISOString();
  return {
    id: it.id,
    defectCode: it.defectCode,
    defectName: it.title || it.typeLabel,
    reportId: it.reportId,
    patientName: "-",
    doctorId: "",
    doctorName: it.assigneeName ?? "-",
    reportedBy: "系统",
    reportedAt: it.createdAt,
    deadlineAt: deadline,
    status: LOOP_STATUS_TO_REM[it.status] ?? "pending",
    severity: SEVERITY_FROM_LOOP[String(it.severity)] ?? "major",
    description: it.title || it.typeLabel,
    suggestedFix: it.fixNote ?? "",
    rectifiedAt: it.closedAt,
    rectifiedNote: it.fixNote,
    verifiedBy:
      it.recheckResult === "pass" ? it.recheckNote || "质控复核" : undefined,
    remindersSent: 0,
    source: "database",
  };
}

function parseDefectRows(format: string, content: string): unknown[] {
  if (format === "json") {
    const parsed = JSON.parse(content) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>).items
        : null;
    if (!Array.isArray(rows))
      throw new Error("JSON 结构无效, 期望数组或 { items: [] }");
    return rows;
  }
  if (format === "csv") {
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return [];
    const header = lines[0]!.split(",").map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const cells = line.split(",");
      const row: Record<string, string> = {};
      header.forEach((h, i) => {
        row[h] = (cells[i] ?? "").trim();
      });
      return row;
    });
  }
  throw new Error(`导入格式 ${format} 解析后端未实现 (仅支持 json / csv)`);
}

function toCreatePayload(row: unknown): {
  code: string;
  categoryCode: string;
  name: string;
  nameEn?: string;
  severity: DefectItem["severity"];
  description: string;
} {
  const r = (row ?? {}) as Record<string, unknown>;
  const localCategory = String(
    r.category ?? "OTH",
  ).toUpperCase() as DefectCategoryCode;
  const localSeverity = String(
    r.severity ?? "minor",
  ).toLowerCase() as DefectSeverityLevel;
  return {
    code: String(r.code ?? "").trim(),
    categoryCode: CATEGORY_TO_API[localCategory] ?? "STRUCT",
    name: String(r.name ?? "").trim(),
    nameEn: r.nameEn ? String(r.nameEn) : undefined,
    severity: SEVERITY_TO_API[localSeverity] ?? "low",
    description: String(r.description ?? r.name ?? "").trim(),
  };
}

// ============================================================
// Service
// ============================================================
export const defectService = {
  async listCategories(): Promise<DefectCategory[]> {
    try {
      const res = await qualityScoringCenterApi.listDefectCategories();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        return res.data.map((c, i) => ({
          code: (CATEGORY_FROM_API[String(c.code).toUpperCase()] ??
            "OTH") as DefectCategoryCode,
          name: c.name,
          nameEn: c.nameEn ?? "",
          description: c.description,
          descriptionEn: "",
          color: "#64748b",
          icon: "",
          childCount: 0,
          totalCount: 0,
          level: 1,
          sortOrder: i + 1,
          source: "database",
        }));
      }
    } catch {
      /* fall through to demo */
    }
    return clone(DEFECT_CATEGORIES).map((c) => ({
      ...c,
      source: "demo" as const,
    }));
  },

  async getCategory(code: DefectCategoryCode): Promise<DefectCategory | null> {
    const cats = await defectService.listCategories();
    return cats.find((c) => c.code === code) ?? null;
  },

  async listDefects(filter?: DefectFilter): Promise<DefectDetail[]> {
    try {
      const res = await qualityScoringCenterApi.listDefectItems({
        keyword: filter?.search,
      });
      if (res.success && Array.isArray(res.data)) {
        return applyFilter(res.data.map(mapDefectItem), filter);
      }
    } catch {
      /* fall through to demo */
    }
    return applyFilter(
      clone(DEFECT_DETAILS).map((d) => ({ ...d, source: "demo" as const })),
      filter,
    );
  },

  async getDefectByCode(code: string): Promise<DefectDetail | null> {
    const list = await defectService.listDefects();
    return list.find((d) => d.code === code) ?? null;
  },

  async getTree(): Promise<DefectTreeNode[]> {
    const [cats, defects] = await Promise.all([
      defectService.listCategories(),
      defectService.listDefects(),
    ]);
    return cats.map((cat) => {
      const items = defects.filter((d) => d.category === cat.code);
      return {
        key: cat.code,
        title: `${cat.name} (${cat.code})`,
        code: cat.code,
        level: cat.level,
        count: items.length,
        childCount: items.length,
        children: items.map((d) => ({
          key: d.code,
          title: `${d.name} (${d.code})`,
          code: d.code,
          level: 2,
          count: d.count,
          childCount: 0,
        })),
        source: cat.source,
      } as DefectTreeNode;
    });
  },

  async getAnalytics(): Promise<DefectAnalytics> {
    // 后端无与 DefectAnalytics 形状一致的聚合端点 (defect-library/aggregation 仅分类/严重度计数)
    return { ...clone(DEFECT_ANALYTICS), source: "demo" };
  },

  async listRemediations(filter?: {
    status?: string;
    doctorId?: string;
  }): Promise<DefectRemediation[]> {
    let list: DefectRemediation[];
    try {
      const res = await qcAnalyticsApi.listLoopItems();
      list =
        res.success && res.data?.data?.length
          ? res.data.data.map(mapLoopItem)
          : clone(DEFECT_REMEDIATIONS).map((r) => ({
              ...r,
              source: "demo" as const,
            }));
    } catch {
      list = clone(DEFECT_REMEDIATIONS).map((r) => ({
        ...r,
        source: "demo" as const,
      }));
    }
    if (filter?.status) list = list.filter((r) => r.status === filter.status);
    if (filter?.doctorId)
      list = list.filter((r) => r.doctorId === filter.doctorId);
    return list;
  },

  async createRemediation(
    _rem: Partial<DefectRemediation>,
  ): Promise<DefectRemediation> {
    // qc-analytics/loop/items 需 defectId (整改池缺陷), 当前入参仅有 defectCode, 无法可靠派生 → 明确不实现
    throw new Error(
      "缺陷整改任务创建接口未实现: /qc-analytics/loop/items 需要整改池缺陷 ID, 现有入参仅含缺陷编码",
    );
  },

  async updateRemediation(
    id: string,
    patch: Partial<DefectRemediation>,
  ): Promise<DefectRemediation> {
    const current = await qcAnalyticsApi.getLoopItem(id);
    if (!current.success || !current.data)
      throw new Error(current.error?.message ?? "整改任务不存在");
    let item = current.data;
    if (
      patch.status === "rectified" ||
      patch.rectifiedNote ||
      patch.rectifiedAt
    ) {
      if (item.status === "open") {
        const started = await qcAnalyticsApi.startFix(id, { note: "开始整改" });
        if (!started.success || !started.data)
          throw new Error(started.error?.message ?? "开始整改失败");
        item = started.data;
      }
      const note = patch.rectifiedNote ?? patch.description ?? "已提交整改说明";
      const fixed = await qcAnalyticsApi.submitFix(id, { note });
      if (!fixed.success || !fixed.data)
        throw new Error(fixed.error?.message ?? "提交整改失败");
      return mapLoopItem(fixed.data);
    }
    if (patch.status === "cancelled") {
      const closed = await qcAnalyticsApi.closeLoopItem(id, {
        note: "取消整改",
      });
      if (!closed.success || !closed.data)
        throw new Error(closed.error?.message ?? "关闭整改失败");
      return mapLoopItem(closed.data);
    }
    throw new Error("该整改更新字段后端未支持 (仅支持提交整改 / 取消)");
  },

  async sendReminder(_id: string): Promise<DefectRemediation> {
    // qc-analytics/loop/* 无提醒端点
    throw new Error(
      "发送整改提醒接口未实现: /qc-analytics/loop/* 未提供 remind 端点",
    );
  },

  async listImportRecords(): Promise<DefectImportRecord[]> {
    return clone(inMemoryImports);
  },

  async importDefects(
    format: "json" | "excel" | "csv" | "yaml",
    filename: string,
    userId: string,
    content?: string,
  ): Promise<DefectImportRecord> {
    const now = new Date().toISOString();
    if (!content || !content.trim()) {
      const rec: DefectImportRecord = {
        id: "di-" + Date.now(),
        filename,
        format,
        totalRows: 0,
        successCount: 0,
        failedCount: 0,
        importedBy: userId,
        importedAt: now,
        status: "failed",
        errorLog: "未提供导入文件内容 (content), 无法解析",
        source: "demo",
      };
      inMemoryImports.unshift(rec);
      return clone(rec);
    }
    let rows: unknown[];
    try {
      rows = parseDefectRows(format, content);
    } catch (e) {
      const rec: DefectImportRecord = {
        id: "di-" + Date.now(),
        filename,
        format,
        totalRows: 0,
        successCount: 0,
        failedCount: 0,
        importedBy: userId,
        importedAt: now,
        status: "failed",
        errorLog: (e as Error).message,
        source: "demo",
      };
      inMemoryImports.unshift(rec);
      return clone(rec);
    }
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    for (const row of rows) {
      const payload = toCreatePayload(row);
      if (!payload.code || !payload.name) {
        failedCount += 1;
        if (errors.length < 3)
          errors.push(`缺失 code/name: ${payload.code || "(空)"}`);
        continue;
      }
      const res = await qualityScoringCenterApi.createDefectItem(payload);
      if (res.success) successCount += 1;
      else {
        failedCount += 1;
        if (errors.length < 3)
          errors.push(`${payload.code}: ${res.error?.message ?? "导入失败"}`);
      }
    }
    const rec: DefectImportRecord = {
      id: "di-" + Date.now(),
      filename,
      format,
      totalRows: rows.length,
      successCount,
      failedCount,
      importedBy: userId,
      importedAt: now,
      status:
        failedCount === 0
          ? "success"
          : successCount === 0
            ? "failed"
            : "partial",
      errorLog: errors.length > 0 ? errors.join("; ") : undefined,
      source: successCount > 0 ? "database" : "demo",
    };
    inMemoryImports.unshift(rec);
    return clone(rec);
  },

  async exportDefects(
    format: "json" | "excel" | "csv",
  ): Promise<{ data: string; mime: string; filename: string }> {
    const rows = await defectService.listDefects();
    if (format === "json") {
      return {
        data: JSON.stringify(rows, null, 2),
        mime: "application/json",
        filename: "defect-library.json",
      };
    }
    const header = [
      "code",
      "name",
      "category",
      "severity",
      "description",
      "solution",
      "sla",
      "isActive",
      "count",
    ];
    const cell = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.code,
          r.name,
          r.category,
          r.severity,
          r.description,
          r.solution,
          r.sla,
          r.isActive,
          r.count,
        ]
          .map(cell)
          .join(","),
      );
    }
    return {
      data: lines.join("\n"),
      mime: "text/csv;charset=utf-8",
      filename: "defect-library.csv",
    };
  },

  async deleteDefect(id: string): Promise<{ ok: boolean; message?: string }> {
    const res = await qualityScoringCenterApi.deleteDefectItem(id);
    return res.success
      ? { ok: true }
      : { ok: false, message: res.error?.message ?? "删除失败" };
  },

  async testRule(
    pattern: string,
    testContent: string,
  ): Promise<{
    matches: Array<{ position: number; matched: string; suggestion: string }>;
  }> {
    const matches: Array<{
      position: number;
      matched: string;
      suggestion: string;
    }> = [];
    if (!pattern) return { matches };
    try {
      const re = new RegExp(pattern, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(testContent)) !== null) {
        matches.push({
          position: m.index,
          matched: m[0],
          suggestion: "请按规范修改",
        });
        if (matches.length > 50) break;
      }
    } catch {
      // ignore invalid regex
    }
    return { matches };
  },
};

export type DefectService = typeof defectService;
export default defectService;
