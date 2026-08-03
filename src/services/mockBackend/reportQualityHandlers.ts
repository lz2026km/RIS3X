// [v3.0.6.11-7] /api/v1/report-quality MSW handlers
// [v3.0.6.11-50] 新增 /api/v1/report-quality-ext 前缀 (前端已统一到 /report-quality-ext)
// [Phase 2 MSW 降级] 旧前缀 /api/v1/report-quality 无前端调用,已移除
import { http, HttpResponse, delay } from "msw";
import { list, get, create, update, remove } from "./store";
import { parseQuery, applyQuery } from "./queryBuilder";
import { v4 as uuidv4 } from "uuid";

const API_EXT = "/api/v1/report-quality-ext";

const delayMs = (min = 50, max = 150) =>
  Math.floor(Math.random() * (max - min) + min);

const makeHandlers = (api: string) => [
  http.get(`${api}/score-rules`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try {
      items = list<any>("rules");
    } catch {}
    if (!items.length)
      items = [
        { id: "SR001", name: "完整性评分", maxScore: 30, category: "结构" },
      ];
    const result = applyQuery(items, opts);
    return HttpResponse.json({
      success: true,
      data: result.data,
      meta: { total: result.total },
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
      create("rule", newItem);
    } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${api}/defect-library`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try {
      items = list<any>("entries");
    } catch {}
    if (!items.length)
      items = [
        { id: "DL001", name: "漏写部位", severity: "MAJOR", category: "遗漏" },
      ];
    const result = applyQuery(items, opts);
    return HttpResponse.json({
      success: true,
      data: result.data,
      meta: { total: result.total },
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
      create("entry", newItem);
    } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${api}/ai-report-drafts`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try {
      items = list<any>("drafts");
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
    const result = applyQuery(items, opts);
    return HttpResponse.json({
      success: true,
      data: result.data,
      meta: { total: result.total },
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
      create("draft", newItem);
    } catch {}
    return HttpResponse.json({ success: true, data: newItem }, { status: 201 });
  }),
  http.get(`${api}/stats`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const opts = parseQuery(url);
    let items: any[] = [];
    try {
      items = list<any>("null");
    } catch {}
    if (!items.length) items = { total: 450, avgScore: 88, passRate: 92 };
    const result = applyQuery(items, opts);
    return HttpResponse.json({
      success: true,
      data: result.data,
      meta: { total: result.total },
    });
  }),
];

export const reportQualityHandlers = [
  // [Phase 2 MSW 降级] 旧前缀 /api/v1/report-quality 无前端调用,已移除;仅保留 /report-quality-ext
  ...makeHandlers(API_EXT),
];
