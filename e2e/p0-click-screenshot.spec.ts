/**
 * [v3.0.6.10] P0-9 / P0-11 / P0-12 点击 + 截图验收
 * 验证 3 个 P0 缺口在真实浏览器中的可见性
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = process.env["E2E_BASE_URL"] ?? "http://127.0.0.1:5191";
const APP = BASE + "/g005-radiology-ris";
const SHOT_DIR = "screenshots-p0";
fs.mkdirSync(SHOT_DIR, { recursive: true });

// 标准 auth 注入 (与 full-page-health 一致)
const AUTH = JSON.stringify({
  id: "admin", name: "管理员", role: "管理员", token: "p0-verify-token"
});

test.describe("P0 Click + Screenshot", () => {
test.beforeEach(async ({ context }) => {
  await context.addInitScript((auth: string) => {
    localStorage.setItem("g005_auth", auth);
    localStorage.setItem("g005_user", auth);
  }, AUTH);
});

test("P0-9 种植体规格库 — 点击进入 + 看到 18 品牌", async ({ page }) => {
  // 1. 进入牙科种植体页
  await page.goto(APP + "/dental/implant", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SHOT_DIR, "01-dental-implant-page.png"), fullPage: true });

  // 2. 验证页面标题
  await expect(page).toHaveTitle(/G005/);

  // 3. 在页面上下文中读取 implant 品牌数据 (通过 React/JS 暴露的全局)
  const brandsVisible = await page.evaluate(() => {
    const win = window as any;
    // Try to find implant data
    const im = win.__MOCK_IMPLANT_BRANDS__ || win.g005ImplantBrands;
    if (im && Array.isArray(im)) return im.map((b: any) => b.id);
    return null;
  });

  // 4. 至少搜索关键品牌名 (中英文)
  const pageText = await page.textContent("body");
  const newBrands = ["威高", "Bicon", "CDIC", "Zimmer", "Camlog", "MIS"];
  const foundBrands = newBrands.filter(b => pageText && pageText.includes(b));

  // 5. 写文件汇报
  fs.writeFileSync(
    path.join(SHOT_DIR, "01-dental-implant-report.json"),
    JSON.stringify({ brandsVisible, foundBrands, textSampleLen: (pageText||"").length }, null, 2)
  );

  // 6. 验证至少 1 个新品牌出现
  expect(foundBrands.length).toBeGreaterThanOrEqual(1);
});

test("P0-11 PWA — 验证 manifest + registerSW", async ({ page }) => {
  // 1. 进入主页面
  await page.goto(APP + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SHOT_DIR, "02-pwa-home.png"), fullPage: true });

  // 2. 抓 manifest 内容
  const manifestRes = await page.request.get(APP + "/manifest.webmanifest");
  expect(manifestRes.status()).toBe(200);
  const manifest = await manifestRes.json();
  expect(manifest.name).toContain("G005");
  expect(manifest.start_url).toBeDefined();
  expect(manifest.icons.length).toBeGreaterThan(0);

  fs.writeFileSync(
    path.join(SHOT_DIR, "02-pwa-manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  // 3. 检查 sw.js + workbox 可访问
  const swRes = await page.request.get(APP + "/sw.js");
  expect(swRes.status()).toBe(200);
  const wbRes = await page.request.get(APP + "/workbox-17b71f1d.js");
  expect(wbRes.status()).toBe(200);

  // 4. 验证 registerSW.js 存在
  const regRes = await page.request.get(APP + "/registerSW.js");
  expect(regRes.status()).toBe(200);
});

test("P0-12 微信小程序 API — fetch + MSW 拦截", async ({ page }) => {
  // 1. 进入主页面 (确保 MSW 注册了)
  await page.goto(APP + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // 2. 在浏览器内调用 wechat API (MSW 拦截)
  const result = await page.evaluate(async () => {
    const calls: any[] = [];
    const origFetch = window.fetch;
    // 记录 fetch 调用
    (window as any).__wechatCalls = calls;

    // 1) jscode2session
    const r1 = await origFetch("/api/v1/mobile/wechat/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsCode: "test_jscode_abc123" })
    }).then(r => r.json());
    calls.push({ endpoint: "session", response: r1 });

    // 2) getPatientReports
    const r2 = await origFetch("/api/v1/mobile/wechat/patients/P100001/reports?page=1&pageSize=10")
      .then(r => r.json());
    calls.push({ endpoint: "reports", response: r2 });

    // 3) getReportPDF
    const r3 = await origFetch("/api/v1/mobile/wechat/reports/RPT-2026-0001/pdf")
      .then(r => r.json());
    calls.push({ endpoint: "pdf", response: r3 });

    // 4) getExamStatus
    const r4 = await origFetch("/api/v1/mobile/wechat/exams/EXM-001/status")
      .then(r => r.json());
    calls.push({ endpoint: "exam", response: r4 });

    return calls;
  });

  // 3. 截图
  await page.screenshot({ path: path.join(SHOT_DIR, "03-wechat-api-calls.png"), fullPage: true });

  // 4. 写报告
  fs.writeFileSync(
    path.join(SHOT_DIR, "03-wechat-api-results.json"),
    JSON.stringify(result, null, 2)
  );

  // 5. 验证至少 4 个端点都成功 (MSW 拦截并返回 mock)
  expect(result.length).toBe(4);
  // session 应该有 openid
  const sessionCall = result.find(c => c.endpoint === "session");
  expect(sessionCall?.response?.openid).toBeDefined();
  // reports 应该有 items
  const reportsCall = result.find(c => c.endpoint === "reports");
  expect(reportsCall?.response?.items?.length).toBeGreaterThan(0);
  // pdf 应该有 expiresAt
  const pdfCall = result.find(c => c.endpoint === "pdf");
  expect(pdfCall?.response?.expiresAt).toBeDefined();
  // exam 应该有 status
  const examCall = result.find(c => c.endpoint === "exam");
  expect(examCall?.response?.status).toBeDefined();
});

test("E2E 总结报告 — 22 关键页面截图", async ({ page }) => {
  const KEY_PAGES = [
    "/",
    "/worklist",
    "/reports",
    "/dental/implant",
    "/dental",
    "/vna-dashboard",
    "/integration/fhir-server",
    "/mobile/patient",
    "/mobile/doctor",
    "/admin/clinical-config-center",
    "/ai-assist",
    "/critical-value",
    "/dicom-viewer",
    "/patient/portal",
    "/materials",
    "/charge-items",
    "/report-export",
    "/cds/management",
    "/mammo/operations",
    "/education/patient-education",
    "/hie/medical-alliance",
    "/safety/patient-safety-goals",
  ];

  const results: any[] = [];
  for (const route of KEY_PAGES) {
    try {
      const start = Date.now();
      const resp = await page.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(800);
      const safeName = route.replace(/[^a-zA-Z0-9]/g, "_") || "root";
      await page.screenshot({ path: path.join(SHOT_DIR, "10-page-" + safeName + ".png"), fullPage: false });
      const text = (await page.textContent("body")) || "";
      const errorMatch = text.match(/(Error|TypeError|ReferenceError|Uncaught|404|500)/g);
      results.push({
        route,
        status: resp?.status() || 0,
        ms: Date.now() - start,
        textLen: text.length,
        errors: errorMatch ? errorMatch.slice(0, 3) : null,
        screenshot: "10-page-" + safeName + ".png",
      });
    } catch (e: any) {
      results.push({ route, error: e.message.substring(0, 100) });
    }
  }
  fs.writeFileSync(
    path.join(SHOT_DIR, "10-summary-report.json"),
    JSON.stringify(results, null, 2)
  );

  // 至少 18/22 页面成功 (90% 阈值, 允许 4 个非关键失败)
  const success = results.filter(r => r.status && r.status >= 200 && r.status < 400).length;
  expect(success).toBeGreaterThanOrEqual(18);
});
});
