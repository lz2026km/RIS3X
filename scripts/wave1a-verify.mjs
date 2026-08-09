// [G005 Wave1A] 5191 dev(mock) 抽查: 9 页面 0 4xx + 无 MSW unhandled + 无页面错误
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5191';

const ROUTES = [
  { name: 'AI 分检', path: '/ai-triage', api: ['/triage/'] },
  { name: '审计合规', path: '/audit-compliance', api: ['/audit/'] },
  { name: '统计报表', path: '/stats-report', api: ['/stats/'] },
  { name: 'PACS 管理', path: '/pacs-admin', api: ['/pacs-admin/'] },
  { name: '会诊', path: '/consultation', api: ['/consultations'] },
  { name: '打印管理', path: '/print-management', api: ['/print/'] },
  { name: '自动采集', path: '/auto-collection', api: ['/auto-collection/'] },
  { name: '自助签到', path: '/kiosk/check-in', api: ['/kiosk/', '/queue'] },
  { name: '知情同意', path: '/consent-education', api: ['/consent-education/'] },
];

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'allow' });
  const page = await ctx.newPage();

  const issues = new Map(); // route -> string[]
  const captured = { responses: [], consoleWarns: [], pageErrors: [] };

  page.on('response', (res) => {
    if (res.status() >= 400) captured.responses.push(`${res.status()} ${res.url()}`);
  });
  page.on('console', (msg) => {
    const t = msg.text();
    if (msg.type() !== 'error' && msg.type() !== 'warning') return; // info/debug 日志 (web-vitals 等) 忽略
    if (/Mock backend started|endpoints ready/.test(t)) return;
    if (/without a matching request handler|Failed to load resource|404|unhandled/i.test(t)) {
      captured.consoleWarns.push(`[${msg.type()}] ${t.slice(0, 220)}`);
    }
  });
  page.on('pageerror', (e) => captured.pageErrors.push(e.message));

  console.log('=== 登录 (mock: 任意账号密码) ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#login-username', 'admin');
  await page.fill('#login-password', 'demo1234');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // 等待 SW 控制页面 (MSW 生效), 否则首屏请求会穿透到 vite proxy(后端3001未启动 → 500)
  const controlled = await page.evaluate(async () => {
    const t0 = Date.now();
    while (!navigator.serviceWorker.controller && Date.now() - t0 < 20000) {
      await new Promise((r) => setTimeout(r, 250));
    }
    return { controlled: !!navigator.serviceWorker.controller, ms: Date.now() - t0 };
  });
  console.log(`MSW SW control: ${controlled.controlled} (${controlled.ms}ms)`);
  if (!controlled.controlled) console.warn('!!! SW 未控制页面 — 后续结果可能包含穿透 500');

  for (const route of ROUTES) {
    captured.responses = [];
    captured.consoleWarns = [];
    captured.pageErrors = [];
    const url = `${BASE}${route.path}`;
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4500); // 等待页面 API 调用 + MSW 响应
      const problems = [];
      if (resp && resp.status() >= 400) problems.push(`文档 ${resp.status()}`);
      for (const r of captured.responses) problems.push(`HTTP ${r}`);
      for (const w of captured.consoleWarns) problems.push(w);
      for (const e of captured.pageErrors) problems.push(`PAGE_ERROR: ${e.slice(0, 160)}`);
      const bodyLen = (await page.evaluate(() => document.getElementById('root')?.innerHTML.length ?? 0));
      issues.set(route.name, { url, problems, bodyLen });
    } catch (e) {
      issues.set(route.name, { url, problems: [`NAV ERROR: ${String(e).slice(0, 160)}`], bodyLen: 0 });
    }
  }

  await browser.close();

  let fail = 0;
  for (const [name, v] of issues) {
    const status = v.problems.length === 0 ? 'PASS' : 'FAIL';
    if (status === 'FAIL') fail++;
    console.log(`[${status}] ${name.padEnd(8, ' ')} ${v.url} (DOM ${v.bodyLen} chars)`);
    for (const p of v.problems) console.log(`        ${p}`);
  }
  console.log(`\n结果: ${9 - fail}/9 通过`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
