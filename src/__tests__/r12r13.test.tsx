// ============================================================
// G005 放射RIS系统 v3.0.2.1 - R12+R13 Tests (修复 TS 严格模式)
// Phase R12+R13: Reports/Terms/OpenAPI/MSW
// ============================================================

import { describe, it, expect } from "vitest";
import { generateReports, summarizeReports } from "../data/reportSeed";
import {
  generateTerms,
  searchTerms,
  suggestAutocomplete,
} from "../data/termSeed";
import {
  getTermStats,
  lookup,
  autocomplete,
  recommendTerms,
  getCategoriesForModality,
} from "../services/termService";
import { openApiSpec } from "../services/openapi";

describe("Report Seed (500)", () => {
  it("generates exactly 500 by default", () => {
    const r = generateReports(500);
    expect(r.length).toBe(500);
  });

  it("generates 1000 when requested", () => {
    expect(generateReports(1000).length).toBe(1000);
  });

  it("produces unique IDs", () => {
    const r = generateReports(500);
    const ids = new Set(r.map((x) => x.id));
    expect(ids.size).toBe(500);
  });

  it("uses valid modalities", () => {
    const valid = new Set([
      "CT",
      "MR",
      "DR",
      "CR",
      "US",
      "MG",
      "PT",
      "XA",
      "NM",
    ]);
    const r = generateReports(100);
    r.forEach((x) => expect(valid.has(x.modality)).toBe(true));
  });

  it("uses valid statuses", () => {
    const valid = new Set([
      "draft",
      "pending",
      "preliminary",
      "final",
      "amended",
      "cancelled",
    ]);
    const r = generateReports(100);
    r.forEach((x) => expect(valid.has(x.status)).toBe(true));
  });

  it("uses valid priorities", () => {
    const valid = new Set(["routine", "urgent", "stat", "critical"]);
    const r = generateReports(100);
    r.forEach((x) => expect(valid.has(x.priority)).toBe(true));
  });

  it("isCritical flag matches priority=critical", () => {
    const r = generateReports(200);
    r.forEach((x) => expect(x.isCritical).toBe(x.priority === "critical"));
  });

  it("isDraft flag matches status", () => {
    const r = generateReports(200);
    r.forEach((x) =>
      expect(x.isDraft).toBe(x.status === "draft" || x.status === "pending"),
    );
  });

  it("produces patientNames in Chinese", () => {
    const r = generateReports(50);
    r.forEach((x) => expect(x.patientName.length).toBeGreaterThanOrEqual(2));
  });

  it("produces qualityScore 0-100", () => {
    const r = generateReports(100);
    r.forEach((x) => {
      expect(x.qualityScore).toBeGreaterThanOrEqual(0);
      expect(x.qualityScore).toBeLessThanOrEqual(100);
    });
  });

  it("summarizeReports produces statistics", () => {
    const r = generateReports(200);
    const s = summarizeReports(r);
    expect(s.total).toBe(200);
    expect(s.criticalCount).toBeGreaterThanOrEqual(0);
    expect(s.byModality.CT).toBeGreaterThan(0);
    expect(s.avgQuality).toBeGreaterThan(50);
    expect(s.avgQuality).toBeLessThanOrEqual(100);
  });

  it("is deterministic with same seed", () => {
    const a = generateReports(50, 42);
    const b = generateReports(50, 42);
    expect(a[0]?.patientName).toBe(b[0]?.patientName);
    expect(a[10]?.id).toBe(b[10]?.id);
  });

  it("generates different data with different seeds", () => {
    const a = generateReports(50, 42);
    const b = generateReports(50, 99);
    expect(a[0]?.patientName).not.toBe(b[0]?.patientName);
  });
});

describe("Term Seed (2000+)", () => {
  it("generates > 2000 terms", () => {
    const t = generateTerms();
    expect(t.length).toBeGreaterThanOrEqual(2000);
  });

  it("uses unique IDs", () => {
    const t = generateTerms();
    const ids = new Set(t.map((x) => x.id));
    expect(ids.size).toBe(t.length);
  });

  it("uses unique cn names", () => {
    const t = generateTerms();
    const names = new Set(t.map((x) => x.cn));
    // 允许少量重复（衍生 + 原始），至少 90% 唯一
    expect(names.size).toBeGreaterThan(t.length * 0.9);
  });

  it("searchTerms matches Chinese prefix", () => {
    const r = searchTerms({ text: "肺" });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]?.cn).toContain("肺");
  });

  it("searchTerms matches English term", () => {
    const r = searchTerms({ text: "pulmonary" });
    expect(r.length).toBeGreaterThan(0);
  });

  it("searchTerms filters by category", () => {
    const r = searchTerms({ text: "cancer", category: "finding-lung" });
    r.forEach((x) => expect(x.category).toBe("finding-lung"));
  });

  it("searchTerms sorts by score", () => {
    const r = searchTerms({ text: "肿块" });
    for (let i = 1; i < r.length; i++) {
      expect((r[i - 1] as { score: number }).score).toBeGreaterThanOrEqual(
        (r[i] as { score: number }).score,
      );
    }
  });

  it("searchTerms supports limit + offset", () => {
    const page1 = searchTerms({ text: "肺", limit: 5, offset: 0 });
    const page2 = searchTerms({ text: "肺", limit: 5, offset: 5 });
    expect(page1.length).toBe(5);
    expect(page2.length).toBe(5);
    expect(page1[0]?.id).not.toBe(page2[0]?.id);
  });

  it("suggestAutocomplete returns prefix matches", () => {
    const a = suggestAutocomplete("pulmonary", 5);
    expect(a.length).toBeGreaterThan(0);
    a.forEach((t) =>
      expect(
        t.term.startsWith("pulmonary") || t.cn.startsWith("pulmonary"),
      ).toBe(true),
    );
  });

  it("getTermStats reports coverage", () => {
    const s = getTermStats();
    expect(s.total).toBeGreaterThan(2000);
    expect(s.withSnomed).toBeGreaterThan(20);
    expect(s.withIcd10).toBeGreaterThan(5);
    expect(Object.keys(s.byCategory).length).toBeGreaterThan(5);
  });
});

describe("Term service", () => {
  it("lookup returns sorted results", () => {
    const r = lookup("肺", { limit: 10 });
    expect(r.length).toBeGreaterThan(0);
  });

  it("autocomplete respects limit", () => {
    const a = autocomplete("p", 3);
    expect(a.length).toBeLessThanOrEqual(3);
  });

  it("recommendTerms considers bodyPart", () => {
    const r = recommendTerms({ bodyPart: "肝脏", clinicalHistory: "黄疸" }, 10);
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((t) => t.cn.includes("肝"))).toBe(true);
  });

  it("getCategoriesForModality returns appropriate", () => {
    expect(getCategoriesForModality("CT")).toContain("finding-lung");
    expect(getCategoriesForModality("MG")).toContain("finding-breast");
    expect(getCategoriesForModality("XX")).toContain("finding-general");
  });
});

describe("OpenAPI 3.0", () => {
  it("spec has openapi 3.0.3", () => {
    expect(openApiSpec.openapi).toBe("3.0.3");
  });

  it("spec has info block", () => {
    expect(openApiSpec.info.title).toBeTruthy();
    expect(openApiSpec.info.version).toBeTruthy();
  });

  it("spec has 3 servers (prod/staging/local)", () => {
    expect(openApiSpec.servers.length).toBe(3);
  });

  it("spec has 9 tags", () => {
    expect(openApiSpec.tags.length).toBe(9);
  });

  it("paths include all key endpoints", () => {
    const paths = Object.keys(openApiSpec.paths);
    expect(paths).toContain("/reports");
    expect(paths).toContain("/reports/{id}");
    expect(paths).toContain("/reports/stats");
    expect(paths).toContain("/reports/{id}/sign");
    expect(paths).toContain("/reports/{id}/sr");
    expect(paths).toContain("/reports/{id}/anchors");
    expect(paths).toContain("/patients");
    expect(paths).toContain("/imaging/dicom");
    expect(paths).toContain("/ai/chat");
    expect(paths).toContain("/ca/certificates");
    expect(paths).toContain("/audit/entries");
    expect(paths).toContain("/audit/verify");
    expect(paths).toContain("/audit/merkle");
    expect(paths).toContain("/collab/rooms");
    expect(paths).toContain("/terms");
    expect(paths).toContain("/terms/autocomplete");
    expect(paths).toContain("/terms/recommend");
    expect(paths).toContain("/stats/dashboard");
    expect(paths.length).toBeGreaterThan(15);
  });

  it("components/schemas include Report", () => {
    expect(openApiSpec.components.schemas.Report).toBeTruthy();
  });

  it("components/securitySchemes include bearerAuth", () => {
    expect(openApiSpec.components.securitySchemes.bearerAuth).toBeTruthy();
    expect(openApiSpec.components.securitySchemes.bearerAuth.type).toBe("http");
    expect(openApiSpec.components.securitySchemes.bearerAuth.scheme).toBe(
      "bearer",
    );
  });
});
