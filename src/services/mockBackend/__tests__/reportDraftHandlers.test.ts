// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { reportDraftHandlers } from "../reportDraftHandlers";

const server = setupServer(...reportDraftHandlers);

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
