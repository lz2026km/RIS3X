// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { reportDraftHandlers } from "../reportDraftHandlers";
import { aiDraftAdvancedHandlers } from "../aiDraftAdvancedHandlers";
import { create } from "../store";

const server = setupServer(...reportDraftHandlers, ...aiDraftAdvancedHandlers);

const BASE = "http://localhost:5173/api/v1";

const getJson = async (path: string) => {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: (await res.json()) as { success: boolean; data: any; error?: any } };
};

const postJson = async (path: string, body: unknown) => {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as { success: boolean; data: any; error?: any } };
};

describe("reportDraftHandlers - 环境式 AI 报告草稿端点", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterAll(() => server.close());

  it("POST /ai/report-draft 生成确定性模板草稿 (CT 胸部)", async () => {
    const { status, body } = await postJson("/ai/report-draft", {
      reportId: "rpt-038", modality: "CT", bodyPart: "胸部",
      clinicalInfo: "体检发现结节", findings: "右肺上叶结节影", style: "standard",
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    const draft = body.data;
    expect(draft.reportId).toBe("rpt-038");
    expect(draft.status).toBe("PENDING");
    expect(draft.draftText).toContain("胸部CT平扫");
    expect(draft.draftText).toContain("右肺上叶结节影");
    expect(draft.sections.map((s: { heading: string }) => s.heading)).toEqual(
      expect.arrayContaining(["检查技术", "临床信息", "影像所见", "影像诊断", "建议"]),
    );
    expect(draft.style).toBe("standard");
  });

  it("GET /ai/report-draft/:reportId 返回最新草稿", async () => {
    await postJson("/ai/report-draft", { reportId: "rpt-100", modality: "MR", bodyPart: "头颅" });
    const { status, body } = await getJson("/ai/report-draft/rpt-100");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.reportId).toBe("rpt-100");
    expect(body.data.draftText).toContain("头颅MRI");
  });

  it("GET /ai/report-draft/:reportId 无草稿返回 404", async () => {
    const { status } = await getJson("/ai/report-draft/rpt-nope");
    expect(status).toBe(404);
  });

  it("POST /ai/report-draft/:id/accept 医生接受草稿", async () => {
    const created = await postJson("/ai/report-draft", { reportId: "rpt-200", modality: "DR", bodyPart: "胸部" });
    const id = created.body.data.id as string;
    const { status, body } = await postJson(`/ai/report-draft/${id}/accept`, {});
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("ACCEPTED");
  });

  it("POST /ai/report-draft/:id/accept 重复接受返回 400", async () => {
    const created = await postJson("/ai/report-draft", { reportId: "rpt-201", modality: "US", bodyPart: "腹部" });
    const id = created.body.data.id as string;
    await postJson(`/ai/report-draft/${id}/accept`, {});
    const again = await postJson(`/ai/report-draft/${id}/accept`, {});
    expect(again.status).toBe(400);
  });

  it("POST /ai/report-draft/:id/modify 医生修改后保存", async () => {
    const created = await postJson("/ai/report-draft", { reportId: "rpt-202", modality: "CT", bodyPart: "腹部" });
    const id = created.body.data.id as string;
    const { status, body } = await postJson(`/ai/report-draft/${id}/modify`, {
      draftText: "【影像所见】\n右肺上叶见结节影。\n【影像诊断】\n1. 右肺上叶结节, 性质待定。",
    });
    expect(status).toBe(200);
    expect(body.data.status).toBe("MODIFIED");
    expect(body.data.draftText).toContain("右肺上叶见结节影");
  });

  it("POST /ai/report-draft/:id/modify 空内容返回 400", async () => {
    const created = await postJson("/ai/report-draft", { reportId: "rpt-203", modality: "CT", bodyPart: "胸部" });
    const id = created.body.data.id as string;
    const { status } = await postJson(`/ai/report-draft/${id}/modify`, { draftText: "  " });
    expect(status).toBe(400);
  });
});

describe("aiDraftAdvancedHandlers - G-19 AI 草稿深化端点", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterAll(() => server.close());

  const seedReport = () => {
    try {
      create<any>("reports", {
        id: "rpt-adv-1", reportId: "rpt-adv-1", examId: "exam-adv-1",
        patientId: "P-ADV-1", modality: "CT", bodyPart: "胸部",
        findings: "右肺上叶见磨玻璃结节影",
        impression: "右肺上叶磨玻璃结节, 建议随访",
        createdAt: "2026-07-01T00:00:00.000Z",
      });
      create<any>("reports", {
        id: "rpt-adv-0", reportId: "rpt-adv-0", examId: "exam-adv-0",
        patientId: "P-ADV-1", modality: "CT", bodyPart: "胸部",
        findings: "右肺上叶见磨玻璃结节影, 边界清晰, 与上次无明显变化",
        impression: "右肺上叶磨玻璃结节",
        createdAt: "2026-06-01T00:00:00.000Z",
      });
    } catch { /* 集合已存在时忽略 */ }
  };

  it("GET /ai-draft/providers 返回 3 个模型且 mock 可用", async () => {
    const { status, body } = await getJson("/ai-draft/providers");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const ids = body.data.map((p: { id: string }) => p.id);
    expect(ids).toEqual(["mock", "deepseek", "hunyuan"]);
    expect(body.data.find((p: { id: string }) => p.id === "mock").available).toBe(true);
  });

  it("GET /ai-draft/rag-context 无匹配报告返回 404", async () => {
    const { status } = await getJson("/ai-draft/rag-context?reportId=ghost-000");
    expect(status).toBe(404);
  });

  it("GET /ai-draft/rag-context 返回既往报告摘要 + 匹配术语", async () => {
    seedReport();
    const { status, body } = await getJson("/ai-draft/rag-context?reportId=rpt-adv-1");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.patientId).toBe("P-ADV-1");
    expect(body.data.bodyPart).toBe("胸部");
    expect(body.data.priorReports.length).toBeGreaterThanOrEqual(1);
    expect(body.data.priorReports[0].reportId).toBe("rpt-adv-0");
    expect(body.data.matchedTerms.map((t: { term: string }) => t.term)).toContain("肺");
  });

  it("POST /ai-draft/generate-advanced 生成草稿 + confidenceScore + RAG sources", async () => {
    seedReport();
    const { status, body } = await postJson("/ai-draft/generate-advanced", {
      reportId: "rpt-adv-1", provider: "mock", includeRag: true,
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.confidenceScore).toBe(0.93);
    expect(body.data.ragUsed).toBe(true);
    expect(body.data.sources.length).toBeGreaterThanOrEqual(1);
    expect(body.data.draftText).toContain("【影像所见】");
    expect(body.data.draftText).toContain("与既往报告");
  });

  it("POST /ai-draft/generate-advanced 无 RAG 时 confidenceScore=0.9 且 sources 为空", async () => {
    seedReport();
    const { status, body } = await postJson("/ai-draft/generate-advanced", {
      reportId: "rpt-adv-1", provider: "mock", includeRag: false,
    });
    expect(status).toBe(201);
    expect(body.data.confidenceScore).toBe(0.9);
    expect(body.data.sources).toEqual([]);
  });

  it("POST /ai-draft/generate-advanced 缺 reportId 返回 400", async () => {
    const { status } = await postJson("/ai-draft/generate-advanced", { provider: "mock" });
    expect(status).toBe(400);
  });

  it("POST /ai-draft/generate-structured 生成 现病史/检查所见/诊断意见", async () => {
    seedReport();
    const { status, body } = await postJson("/ai-draft/generate-structured", { reportId: "rpt-adv-1" });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.sections.map((s: { heading: string }) => s.heading)).toEqual(["现病史", "检查所见", "诊断意见"]);
    expect(body.data.confidenceScore).toBe(0.88);
    expect(body.data.sections[1].content).toContain("磨玻璃");
  });

  it("POST /ai-draft/generate-structured 报告不存在返回 404", async () => {
    const { status } = await postJson("/ai-draft/generate-structured", { reportId: "ghost-000" });
    expect(status).toBe(404);
  });
});
