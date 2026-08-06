// [v3.0.6.11-7] /api/v1/report-quality MSW handlers
// [v3.0.6.11-50] 新增 /api/v1/report-quality-ext 前缀 (前端已统一到 /report-quality-ext)
// [G005 P1] 响应形状统一: 列表端点返回 { items, total }, stats 返回直接对象 (与后端 reportquality.service 对齐)
import { http, HttpResponse, delay } from "msw";
import { list, create, update } from "./store";
import { v4 as uuidv4 } from "uuid";

const API_EXT = "/api/v1/report-quality-ext";
const API_QUALITY = "/api/v1/reports/quality";

const delayMs = (min = 50, max = 150) =>
  Math.floor(Math.random() * (max - min) + min);

// ── /reports/quality (reports-quality.controller) ──
const qualityRules = {
  version: "3.0.2.2",
  dimensions: [
    { key: "structured", label: "结构化字段完整度", max: 20, weight: 0.2 },
    { key: "keywords", label: "关键术语命中", max: 20, weight: 0.2 },
    { key: "rads", label: "RADS 类别标注", max: 15, weight: 0.15 },
    { key: "clarity", label: "结论清晰度", max: 15, weight: 0.15 },
    { key: "length", label: "长度合理性", max: 10, weight: 0.1 },
    { key: "blacklist", label: "黑名单规避", max: 10, weight: 0.1 },
    { key: "critical", label: "危急值标注", max: 5, weight: 0.05 },
    { key: "verified", label: "审核完成", max: 5, weight: 0.05 },
  ],
  grades: [
    { grade: "A", min: 90, label: "优秀" },
    { grade: "B", min: 80, label: "良好" },
    { grade: "C", min: 70, label: "合格" },
    { grade: "D", min: 60, label: "欠佳" },
    { grade: "F", min: 0, label: "不合格" },
  ],
  keywords: ["符合", "规则", "肺纹理", "未见明确"],
  blacklist: ["似乎", "大概", "可能病变?"],
};

const mockEvaluation = (reportId: string, overrides?: any) => ({
  id: `QE-${Date.now()}`,
  reportId,
  totalScore: 88,
  grade: "B",
  dimensions: qualityRules.dimensions.map((d) => ({
    key: d.key,
    label: d.label,
    score: Math.round((d.max * (80 + Math.random() * 20)) / 100),
    max: d.max,
    weight: d.weight,
    issues: [],
  })),
  evaluatedAt: new Date().toISOString(),
  suggestions: ["建议补充关键术语", "结论部分需更清晰"],
  ...overrides,
});

const qualityCoreHandlers = [
  http.get(`${API_QUALITY}/rules`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: qualityRules });
  }),
  http.post(`${API_QUALITY}/evaluate`, async ({ request }) => {
    await delay(delayMs(120, 350));
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: mockEvaluation(body?.reportId ?? "RPT-001") }, { status: 201 });
  }),
  http.get(`${API_QUALITY}/history/:reportId`, async ({ params }) => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: [mockEvaluation(params.reportId as string)] });
  }),
  http.get(`${API_QUALITY}/trend/:reportId`, async ({ params }) => {
    await delay(delayMs());
    const days = 7;
    return HttpResponse.json({
      success: true,
      data: Array.from({ length: days }, (_, i) => mockEvaluation(params.reportId as string, {
        evaluatedAt: new Date(Date.now() - (days - 1 - i) * 86400000).toISOString(),
        totalScore: 80 + i * 2,
      })),
    });
  }),
  http.post(`${API_QUALITY}/re-evaluate/:reportId`, async ({ params, request }) => {
    await delay(delayMs(120, 350));
    const body = (await request.json()) as any;
    return HttpResponse.json({ success: true, data: mockEvaluation(params.reportId as string, body) }, { status: 201 });
  }),
];

const makeHandlers = (api: string) => [
  http.get(`${api}/score-rules`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try {
      items = list<any>("rules" as any);
    } catch {}
    if (!items.length)
      items = [
        { id: "SR001", name: "完整性评分", maxScore: 30, category: "结构" },
      ];
    return HttpResponse.json({
      success: true,
      data: { items, total: items.length },
    });
  }),
  http.post(`${api}/score-rules`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = {
      id: body.id || uuidv4(),
      ...body,
      createdAt: new Date().toISOString(),
    };
    try {
      create("rule" as any, newItem);
    } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.put(`${api}/score-rules/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const updated = { id: params.id, ...body };
    try {
      update("rule" as any, params.id as string, updated);
    } catch {}
    return HttpResponse.json({ success: true, data: updated });
  }),
  http.get(`${api}/defect-library`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try {
      items = list<any>("entries" as any);
    } catch {}
    if (!items.length)
      items = [
        { id: "DL001", action: "CREATE", resource: "defect-library", detail: { code: "DEF-001", name: "漏写部位", category: "description", severity: "major", description: "报告中未描述病变所在解剖部位", examples: ["胸部CT未见描述肺叶位置"], solution: "按解剖部位逐项描述", count: 12 }, createdAt: "2026-08-01T08:00:00Z" },
        { id: "DL002", action: "CREATE", resource: "defect-library", detail: { code: "DEF-002", name: "结论与所见不一致", category: "logic", severity: "critical", description: "诊断结论与影像所见描述矛盾", examples: [], solution: "结论应与所见保持一致", count: 5 }, createdAt: "2026-08-01T09:00:00Z" },
      ];
    return HttpResponse.json({
      success: true,
      data: { items, total: items.length },
    });
  }),
  http.post(`${api}/defect-library`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = {
      id: body.id || uuidv4(),
      ...body,
      createdAt: new Date().toISOString(),
    };
    try {
      create("entry" as any, newItem);
    } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.put(`${api}/defect-library/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const updated = { id: params.id, ...body };
    try {
      update("entry" as any, params.id as string, updated);
    } catch {}
    return HttpResponse.json({ success: true, data: updated });
  }),
  http.get(`${api}/ai-report-drafts`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try {
      items = list<any>("drafts" as any);
    } catch {}
    if (!items.length)
      items = [
        {
          id: "AID001",
          patientName: "张三",
          status: "DRAFT",
          createdAt: "2026-07-08",
        },
      ];
    return HttpResponse.json({
      success: true,
      data: { items, total: items.length },
    });
  }),
  http.post(`${api}/ai-report-drafts`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const newItem = {
      id: body.id || uuidv4(),
      ...body,
      createdAt: new Date().toISOString(),
    };
    try {
      create("draft" as any, newItem);
    } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${api}/stats`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: { total: 450, avgScore: 88, passRate: 92 },
    });
  }),
];

export const reportQualityHandlers = [
  // [Phase 2 MSW 降级] 旧前缀 /api/v1/report-quality 无前端调用,已移除;仅保留 /report-quality-ext
  ...qualityCoreHandlers,
  ...makeHandlers(API_EXT),
];
