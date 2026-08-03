// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { doseHandlers } from "../doseHandlers";

const server = setupServer(...doseHandlers);

const BASE = "http://localhost/api/v1";

const getJson = async (path: string) => {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: (await res.json()) as { success: boolean; data: unknown; error?: unknown } };
};

const postJson = async (path: string, body: unknown) => {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as { success: boolean; data: unknown; error?: unknown } };
};

describe("doseHandlers - 剂量管理 DRL 端点", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterAll(() => server.close());

  it("GET /rdsr/drl 返回 DRL 参考水平（CT 头/胸/腹）", async () => {
    const { status, body } = await getJson("/rdsr/drl");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const data = body.data as Array<{ bodyPart: string; ctdivolDrl: number; dlpDrl: number }>;
    expect(data.length).toBeGreaterThanOrEqual(5);
    const head = data.find((d) => d.bodyPart === "头部");
    expect(head?.ctdivolDrl).toBe(60);
    expect(head?.dlpDrl).toBe(1000);
    const chest = data.find((d) => d.bodyPart === "胸部");
    expect(chest?.ctdivolDrl).toBe(15);
    expect(chest?.dlpDrl).toBe(500);
  });

  it("GET /rdsr/drls 兼容旧路径", async () => {
    const { status, body } = await getJson("/rdsr/drls?bodyPart=腹部");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect((body.data as unknown[]).length).toBe(1);
  });

  it("POST /rdsr/drl 可更新阈值", async () => {
    const { status, body } = await postJson("/rdsr/drl", { bodyPart: "胸部", ctdivolDrl: 20, dlpDrl: 600, source: "自定义" });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const data = body.data as Array<{ bodyPart: string; ctdivolDrl: number; dlpDrl: number }>;
    const chest = data.find((d) => d.bodyPart === "胸部");
    expect(chest?.ctdivolDrl).toBe(20);
    expect(chest?.dlpDrl).toBe(600);
  });

  it("POST /rdsr/drl 缺失阈值返回 400", async () => {
    const { status } = await postJson("/rdsr/drl", { bodyPart: "胸部" });
    expect(status).toBe(400);
  });

  it("GET /rdsr/today 返回今日统计与部位分布", async () => {
    const { status, body } = await getJson("/rdsr/today");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const data = body.data as {
      totalExams: number;
      avgDlp: number;
      overDrlCount: number;
      bodyPartDistribution: Array<{ bodyPart: string; avgDlp: number; overDrlCount: number }>;
    };
    expect(data.totalExams).toBeGreaterThanOrEqual(0);
    expect(data.bodyPartDistribution).toBeDefined();
  });

  it("GET /rdsr/stats 返回聚合统计", async () => {
    const { status, body } = await getJson("/rdsr/stats");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const data = body.data as { totalExams: number; trend: unknown[] };
    expect(data.totalExams).toBeGreaterThan(0);
    expect(data.trend.length).toBeGreaterThan(0);
  });

  it("POST /rdsr/parse 解析并返回剂量结果", async () => {
    const { status, body } = await postJson("/rdsr/parse", { modality: "CT", dicomJson: { BodyPartExamined: "胸部" } });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    const data = body.data as { ctdivol: number; dlp: number; bodyPart: string; alertLevel: string };
    expect(data.bodyPart).toBe("胸部");
    expect(data.ctdivol).toBeGreaterThan(0);
    expect(["normal", "warning", "critical"]).toContain(data.alertLevel);
  });

  it("GET /rdsr/patients 按关键字搜索患者累计", async () => {
    const { status, body } = await getJson("/rdsr/patients?search=张三");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const data = body.data as Array<{ patientId: string; patientName: string; examCount: number; totalDlp30d: number; totalDlp1y: number }>;
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0]!.patientName).toContain("张三");
    expect(data[0]!.totalDlp1y).toBeGreaterThan(0);
  });

  it("GET /rdsr/patients/:id/cumulative 返回 30天/年累计与月度趋势", async () => {
    const patients = await getJson("/rdsr/patients");
    const first = (patients.body.data as Array<{ patientId: string }>)[0]!;
    const { status, body } = await getJson(`/rdsr/patients/${first.patientId}/cumulative`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const data = body.data as {
      totalExams: number;
      totalDlp30d: number;
      totalDlp1y: number;
      annualLimit: number;
      monthlyTrend: Array<{ month: string; totalDlp: number }>;
      exams: unknown[];
    };
    expect(data.totalExams).toBeGreaterThan(0);
    expect(data.annualLimit).toBe(5000);
    expect(data.monthlyTrend).toHaveLength(12);
    expect(data.exams.length).toBeGreaterThan(0);
  });

  it("GET /rdsr/patients/:id/cumulative 未知患者返回 404", async () => {
    const { status } = await getJson("/rdsr/patients/P-NOPE/cumulative");
    expect(status).toBe(404);
  });

  it("GET /rdsr/alerts 返回超 DRL 告警并可确认", async () => {
    const list = await getJson("/rdsr/alerts");
    expect(list.body.success).toBe(true);
    const alerts = list.body.data as Array<{ id: string; level: string; acknowledged: boolean; dlpDrl: number }>;
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    const target = alerts.find((a) => !a.acknowledged) ?? alerts[0]!;

    const ack = await postJson(`/rdsr/alerts/${target.id}/ack`, {});
    expect(ack.status).toBe(200);
    expect(ack.body.success).toBe(true);
    expect((ack.body.data as { acknowledged: boolean }).acknowledged).toBe(true);

    const pending = await getJson("/rdsr/alerts?status=pending");
    const pendingIds = (pending.body.data as Array<{ id: string }>).map((a) => a.id);
    expect(pendingIds).not.toContain(target.id);

    const acknowledged = await getJson("/rdsr/alerts?status=acknowledged");
    const ackedIds = (acknowledged.body.data as Array<{ id: string }>).map((a) => a.id);
    expect(ackedIds).toContain(target.id);
  });

  it("POST /rdsr/alerts/:id/ack 未知告警返回 404", async () => {
    const { status } = await postJson("/rdsr/alerts/not-exist/ack", {});
    expect(status).toBe(404);
  });
});
