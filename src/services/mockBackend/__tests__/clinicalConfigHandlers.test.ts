// @vitest-environment node
// [W3-B] /system/clinical-config 3 端点 MSW 测试 (后端 clinical-config.controller 对应)
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { systemHandlers } from "../systemHandlers";

const server = setupServer(...systemHandlers);

const BASE = "http://localhost:5173/api/v1";

const getJson = async (path: string) => {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: (await res.json()) as { success: boolean; data: any; error?: any } };
};

const putJson = async (path: string, body: unknown) => {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as { success: boolean; data: any; error?: any } };
};

describe("systemHandlers - /system/clinical-config (W3-B persistence)", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterAll(() => server.close());

  it("GET returns null modules when nothing is stored", async () => {
    const { status, body } = await getJson("/system/clinical-config");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.modules).toBeNull();
    expect(body.data.updatedAt).toBeNull();
  });

  it("PUT all modules persists and GET returns them", async () => {
    const modules = {
      gradingScales: { scales: [{ id: "dr" }] },
      aiModels: { models: [] },
      imagingDevices: { devices: [] },
      kpiThresholds: { metrics: [] },
      reportTemplates: { templates: [] },
      findingsLexicon: { entries: [] },
      iolFormulas: { formulas: [] },
    };
    const saved = await putJson("/system/clinical-config", { modules });
    expect(saved.status).toBe(200);
    expect(saved.body.success).toBe(true);
    expect(saved.body.data.modules.gradingScales).toEqual({ scales: [{ id: "dr" }] });
    expect(typeof saved.body.data.updatedAt).toBe("string");

    const { body } = await getJson("/system/clinical-config");
    expect(body.data.modules.gradingScales).toEqual({ scales: [{ id: "dr" }] });
    expect(body.data.modules.iolFormulas).toEqual({ formulas: [] });
  });

  it("PUT /:module saves a single module and merges with existing", async () => {
    await putJson("/system/clinical-config", { modules: { gradingScales: { scales: [{ id: "etdrs" }] } } });
    const res = await putJson("/system/clinical-config/iolFormulas", { module: { formulas: [{ name: "SRK/T" }] } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.module).toEqual({ formulas: [{ name: "SRK/T" }] });
    expect(typeof res.body.data.updatedAt).toBe("string");

    const { body } = await getJson("/system/clinical-config");
    expect(body.data.modules.gradingScales).toEqual({ scales: [{ id: "etdrs" }] });
    expect(body.data.modules.iolFormulas).toEqual({ formulas: [{ name: "SRK/T" }] });
  });

  it("PUT /:module rejects unknown module with 404", async () => {
    const res = await putJson("/system/clinical-config/evil_key", { module: {} });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("PUT all rejects empty modules with 400", async () => {
    const res = await putJson("/system/clinical-config", { modules: {} });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
