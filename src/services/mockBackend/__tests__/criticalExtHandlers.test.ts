// [W2-A] criticalExtHandlers: /critical-ext/center + auto-detect + close-loop 生命周期
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { criticalExtHandlers } from "../criticalExtHandlers";

const server = setupServer(...criticalExtHandlers);

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

describe("criticalExtHandlers - 危急值中心 (W2-A)", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterAll(() => server.close());

  it("GET /critical-ext/center 返回中心列表 (新事件可见, 按触发时间倒序)", async () => {
    const { status, body } = await getJson("/critical-ext/center");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const data = body.data as Array<{ id: string; triggeredAt: string }>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    // 倒序: 首条触发时间 >= 末条触发时间
    const times = data.map((d) => d.triggeredAt ?? "");
    const sorted = [...times].sort((a, b) => b.localeCompare(a));
    expect(times).toEqual(sorted);
  });

  it("POST /critical-ext/auto-detect 创建 PENDING 事件并出现在中心列表", async () => {
    const { status, body } = await postJson("/critical-ext/auto-detect", {
      examId: "EXAM-TEST-001",
      reportContent: "WBC 45.2 x10^9/L, 严重感染",
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    const created = body.data as { id: string; state: string; status: string; examId: string };
    expect(created.examId).toBe("EXAM-TEST-001");
    expect(created.state).toBe("PENDING");

    const center = await getJson("/critical-ext/center");
    const items = center.body.data as Array<{ id: string; examId?: string; finding?: string }>;
    const found = items.find((i) => i.id === created.id || i.examId === "EXAM-TEST-001");
    expect(found).toBeDefined();
    expect(found?.finding).toContain("WBC 45.2");
  });

  it("POST /critical-ext/close-loop 将事件置为 CLOSED_LOOP 终态", async () => {
    const created = await postJson("/critical-ext/auto-detect", {
      examId: "EXAM-TEST-002",
      reportContent: "颅内出血",
    });
    const id = (created.body.data as { id: string }).id;

    const closed = await postJson("/critical-ext/close-loop", {
      criticalId: id,
      resolution: "已电话通知临床并收治",
      resolvedBy: "test-doctor",
    });
    expect(closed.status).toBe(201);
    expect(closed.body.success).toBe(true);
    const closedData = closed.body.data as { id: string; state: string; closedAt: string };
    expect(closedData.state).toBe("CLOSED_LOOP");
    expect(closedData.closedAt).toBeDefined();

    const center = await getJson("/critical-ext/center");
    const items = center.body.data as Array<{ id: string; state?: string; status?: string }>;
    const updated = items.find((i) => i.id === id);
    expect(updated?.state ?? updated?.status).toBe("CLOSED_LOOP");
  });
});
