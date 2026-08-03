import { chromium } from "playwright";

const BASE = "http://127.0.0.1:5191";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon") && !m.text().includes("404"))
    errors.push(`console: ${m.text()}`);
});

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok, extra });
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name} ${extra}`);
};

await page.goto(BASE + "/", { waitUntil: "load" });
await page.waitForTimeout(3000);
await page.evaluate(() => {
  localStorage.setItem("ris_current_user", JSON.stringify({ id: "A001", name: "系统管理员", role: "管理员", department: "信息科" }));
});
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(4000);

await page.evaluate(() => {
  window.history.pushState({}, "", "/dose-track");
  window.dispatchEvent(new PopStateEvent("popstate"));
});
await page.waitForTimeout(3500);

const bodyText = (await page.locator("body").textContent()) || "";
check("页面标题", bodyText.includes("辐射剂量跟踪"), `(${bodyText.length}ch)`);

const liveTab = page.getByRole("button", { name: "实时监测" });
if ((await liveTab.count()) > 0) {
  await liveTab.click();
  await page.waitForTimeout(3000);
} else {
  check("实时监测 tab 存在", false);
}

const pageBody = (await page.locator("body").textContent()) || "";
check("今日统计卡", pageBody.includes("今日检查数") && pageBody.includes("今日平均 DLP"));
check("超 DRL 阈值卡", pageBody.includes("超 DRL 阈值"));
check("部位分布图标题", pageBody.includes("今日各部位平均 DLP vs DRL 阈值"));
check("DRL 阈值配置表", pageBody.includes("DRL 阈值配置表") && pageBody.includes("检查部位"));
check("DRL 表行(头部/胸部)", pageBody.includes("头部") && pageBody.includes("胸部"));

const alertSection = pageBody.includes("超 DRL 告警列表");
check("超 DRL 告警列表", alertSection);

const ackBtn = page.getByRole("button", { name: "确认", exact: true });
const hadPendingAlert = (await ackBtn.count()) > 0;
if (hadPendingAlert) {
  const before = await ackBtn.count();
  await ackBtn.first().click();
  await page.waitForTimeout(1500);
  const after = await page.getByRole("button", { name: "确认", exact: true }).count();
  check("告警确认生效", after < before, `(${before}->${after} 待确认按钮)`);
} else {
  check("告警确认按钮", false, "(无待处理告警)");
}

await page.getByPlaceholder("输入患者姓名 / ID 搜索").fill("张三");
await page.getByRole("button", { name: "搜索" }).click();
await page.waitForTimeout(1500);
const searchBody = (await page.locator("body").textContent()) || "";
check("患者搜索命中", searchBody.includes("张三") || searchBody.includes("P1001"));

const patientRow = page.locator('[data-testid="patient-row-P1001"]');
if ((await patientRow.count()) > 0) {
  await patientRow.click();
  await page.waitForTimeout(2000);
  const cumBody = (await page.locator("body").textContent()) || "";
  check("累计剂量面板", cumBody.includes("年度累计趋势") && cumBody.includes("30天累计 DLP"));
  check("年度限额占比", cumBody.includes("年度限额占比"));
  check("剂量记录明细表", cumBody.includes("剂量记录明细") && cumBody.includes("CTDIvol"));
} else {
  check("患者累计剂量面板", false, "(未找到患者行)");
}

await page.screenshot({ path: "verify-dose-live.png", fullPage: true });
console.log(`\n[RESULT] ${results.filter((r) => r.ok).length}/${results.length} OK, ${errors.length} runtime errors`);
if (errors.length > 0) [...new Set(errors)].slice(0, 6).forEach((e) => console.log("  " + e));
await browser.close();
const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.log("FAILED CHECKS:");
  failed.forEach((f) => console.log(`  - ${f.name} ${f.extra}`));
  process.exit(1);
}
process.exit(0);
