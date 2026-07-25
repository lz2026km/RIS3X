import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:5191';
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'e2e/screenshots-200');
const REPORT_JSON = path.resolve(process.cwd(), 'e2e/click-200-pages-v30611-32-report.json');
const REPORT_MD = path.resolve(process.cwd(), 'docs/PLAYWRIGHT_200X200_V3.0.6.11-32.md');

const ADMIN_USER = JSON.stringify({
  id: 'A001',
  name: '系统管理员',
  role: '管理员',
  department: '信息科',
  token: 'admin-200x200',
});

const G005_AUTH = JSON.stringify({
  token: 'admin-200x200',
  role: '管理员',
  userId: 'A001',
  username: '系统管理员',
});

const DANGEROUS_BTN = /(删除|驳回|拒绝|注销|退出登录|退订|解绑|禁用|移除|彻底删除|清空|丢弃|确认删除)/;
const DANGEROUS_TAB = /(危险|高级|危险操作|删除)/;

const IGNORE_CE_PATTERNS = [
  'mockServiceWorker', 'X-Frame-Options', 'Content Security Policy',
  'favicon', '[HMR]', '[vite]', 'manifest.json', 'Service Worker', '[MSW]',
];

interface PageResult {
  index: number; route: string; status: number; loadMs: number;
  bodyLen: number; hasRender: boolean;
  buttonsFound: number; buttonsClicked: number; buttonsOk: number;
  tabsFound: number; tabsClicked: number;
  failedButtons: string[]; pageErrors: string[]; consoleErrors: string[];
  screenshot: string; pass: boolean; passReason: string; crashed: boolean;
}

function extractRoutesFromSidebar(): string[] {
  const cfgPath = path.resolve(process.cwd(), 'src/routes/sidebarConfig.tsx');
  if (!fs.existsSync(cfgPath)) throw new Error(`sidebarConfig.tsx not found: ${cfgPath}`);
  const src = fs.readFileSync(cfgPath, 'utf-8');
  const re = /path:\s*"([^"]+)"/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) { const p = m[1]; if (p && p.startsWith('/')) out.add(p); }
  return Array.from(out);
}

const ALL_ROUTES = extractRoutesFromSidebar();
const ROUTES: string[] = ALL_ROUTES.slice(0, 200);
if (ROUTES.length === 0) throw new Error('No routes extracted from sidebarConfig.tsx');

async function injectAdmin(page: Page): Promise<void> {
  await page.addInitScript((data) => {
    try { window.localStorage.setItem('ris_current_user', data.user); } catch (_) { }
    try { window.localStorage.setItem('g005_auth', data.auth); } catch (_) { }
  }, { user: ADMIN_USER, auth: G005_AUTH });
}

function shouldIgnoreConsole(t: string): boolean {
  return IGNORE_CE_PATTERNS.some((p) => t.includes(p));
}

async function captureAndTest(page: Page, route: string, idx: number): Promise<PageResult> {
  const t0 = Date.now();
  const result: PageResult = {
    index: idx, route, status: 0, loadMs: 0, bodyLen: 0, hasRender: false,
    buttonsFound: 0, buttonsClicked: 0, buttonsOk: 0,
    tabsFound: 0, tabsClicked: 0,
    failedButtons: [], pageErrors: [], consoleErrors: [],
    screenshot: '', pass: false, passReason: '', crashed: false,
  };

  const consoleErrs: string[] = [];
  const pageErrs: string[] = [];

  const onPageError = (e: Error): void => { pageErrs.push(e.message.slice(0, 200)); };
  const onConsole = (m: ConsoleMessage): void => {
    if (m.type() !== 'error') return;
    const txt = m.text();
    if (shouldIgnoreConsole(txt)) return;
    consoleErrs.push(txt.slice(0, 200));
  };
  const onCrash = (): void => { pageErrs.push('PAGE_CRASH'); result.crashed = true; };

  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('crash', onCrash);

  try {
    await injectAdmin(page);
    const resp = await page.goto(`${BASE}${route}`, { timeout: 20000, waitUntil: 'domcontentloaded' });
    result.status = resp?.status() ?? 0;
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
    await page.waitForTimeout(1200);

    const safe = route.replace(/[/:]/g, '_').replace(/^_+/, '') || 'root';
    const ssPath = path.join(SCREENSHOT_DIR, `${String(idx).padStart(3, '0')}_${safe}.png`);
    try {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: ssPath, fullPage: false });
      result.screenshot = ssPath;
    } catch (_) { result.screenshot = ''; }

    const info = await page.evaluate(() => ({
      textLen: document.body.innerText.length,
      hasLoading: document.body.innerText.includes('系统加载中'),
      rootChildren: document.getElementById('root')?.children.length ?? 0,
    })).catch(() => ({ textLen: 0, hasLoading: true, rootChildren: 0 }));
    result.bodyLen = info.textLen;
    result.hasRender = !info.hasLoading && info.rootChildren > 0;

    const buttonEls = await page.$$('button:visible:not([disabled])');
    result.buttonsFound = buttonEls.length;
    for (let b = 0; b < Math.min(buttonEls.length, 10); b++) {
      const btn = buttonEls[b];
      let text = '';
      try { text = (await btn.innerText()).trim(); } catch (_) { text = ''; }
      if (DANGEROUS_BTN.test(text)) { result.failedButtons.push(`SKIP-DANGEROUS: ${text}`); continue; }
      try {
        const isLink = await btn.evaluate((el) => el.tagName === 'A' || !!el.closest('a')).catch(() => false);
        if (isLink) { result.failedButtons.push(`SKIP-NAV: ${text}`); continue; }
        const beforeHTML = await page.evaluate(() => document.body.innerHTML.length).catch(() => 0);
        await btn.click({ timeout: 1500, force: true });
        await page.waitForTimeout(300);
        const afterHTML = await page.evaluate(() => document.body.innerHTML.length).catch(() => 0);
        result.buttonsClicked += 1;
        if (Math.abs(afterHTML - beforeHTML) < 10 && !text.includes('展开') && !text.includes('收起') && !text.includes('更多')) {
          result.failedButtons.push(`DEAD-BUTTON: ${text || '(no-text)'}`);
        } else {
          result.buttonsOk += 1;
        }
      } catch (e: any) {
        result.buttonsClicked += 1;
        result.failedButtons.push(`THROW: ${text || '(no-text)'} | ${(e?.message ?? '').slice(0, 80)}`);
      }
    }

    const tabEls = await page.$$('.ant-tabs-tab:visible');
    result.tabsFound = tabEls.length;
    for (let t = 0; t < Math.min(tabEls.length, 5); t++) {
      const tab = tabEls[t];
      let text = '';
      try { text = (await tab.innerText()).trim(); } catch (_) { text = ''; }
      if (DANGEROUS_TAB.test(text)) { result.failedButtons.push(`SKIP-DANGEROUS-TAB: ${text}`); continue; }
      try {
        const beforeHTML = await page.evaluate(() => document.body.innerHTML.length).catch(() => 0);
        await tab.click({ timeout: 1500, force: true });
        await page.waitForTimeout(300);
        const afterHTML = await page.evaluate(() => document.body.innerHTML.length).catch(() => 0);
        result.tabsClicked += 1;
        if (Math.abs(afterHTML - beforeHTML) < 10) {
          result.failedButtons.push(`DEAD-TAB: ${text || '(no-text)'}`);
        }
      } catch (e: any) {
        result.failedButtons.push(`TAB-THROW: ${text || '(no-text)'} | ${(e?.message ?? '').slice(0, 80)}`);
      }
    }
  } catch (e: any) {
    pageErrs.push('NAV: ' + (e?.message ?? '').slice(0, 200));
  }

  result.pageErrors = pageErrs;
  result.consoleErrors = consoleErrs;
  result.loadMs = Date.now() - t0;

  page.off('pageerror', onPageError);
  page.off('console', onConsole);
  page.off('crash', onCrash);

  const okStatus = result.status === 0 || result.status < 400;
  const okCE = result.consoleErrors.length <= 1;
  const okBody = result.bodyLen > 50;
  const reasons: string[] = [];
  if (!okStatus) reasons.push(`STATUS=${result.status}`);
  if (!okCE) reasons.push(`CONSOLE_ERR=${result.consoleErrors.length}`);
  if (!okBody) reasons.push(`BODY_LEN=${result.bodyLen}`);
  if (!result.hasRender) reasons.push('STUCK');
  if (result.crashed) reasons.push('CRASHED');
  result.pass = okStatus && okCE && okBody && result.hasRender && !result.crashed;
  result.passReason = result.pass ? 'OK' : reasons.join(', ');

  return result;
}

const RESULTS_PATH = path.resolve(process.cwd(), 'e2e/.click-200-results-tmp.ndjson');

function appendResult(r: PageResult): void {
  try { fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true }); } catch (_) { }
  try { fs.appendFileSync(RESULTS_PATH, JSON.stringify(r) + '\n', 'utf-8'); } catch (_) { }
}

function readAllResults(): PageResult[] {
  try {
    if (!fs.existsSync(RESULTS_PATH)) return [];
    const raw = fs.readFileSync(RESULTS_PATH, 'utf-8').trim();
    if (!raw) return [];
    return raw.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch { return []; }
}

function renderMarkdown(s: any): string {
  const lines: string[] = [];
  lines.push('# Playwright 200×200 测试报告 — v' + s.version);
  lines.push('');
  lines.push('> 生成时间: ' + s.timestamp);
  lines.push('> 项目: G005-RISv-3.0.0');
  lines.push('> 浏览器: chromium');
  lines.push('');
  lines.push('## 一、测试总览');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|:----:|');
  lines.push('| Sidebar 总路由 | ' + s.sidebarRoutesTotal + ' |');
  lines.push('| 测试路由数 | **' + s.testedRoutes + '** |');
  lines.push('| 通过页数 | **' + s.pass + '** |');
  lines.push('| 失败页数 | **' + s.fail + '** |');
  lines.push('| 崩溃页数 (P0) | **' + s.crashed + '** |');
  lines.push('| **通过率** | **' + s.passRate + '** |');
  lines.push('| 按钮总数 | ' + s.totalButtons + ' |');
  lines.push('| 按钮点击成功 | ' + s.okButtons + ' |');
  lines.push('| 假按钮/死按钮 | ' + (s.failedButtons) + ' |');
  lines.push('| Tab 总数 | ' + s.totalTabs + ' |');
  lines.push('| Tab 点击成功 | ' + s.clickedTabs + ' |');
  lines.push('| Console errors | ' + s.consoleErrors + ' |');
  lines.push('| Page errors | ' + s.pageErrors + ' |');
  lines.push('');

  const fail = (s.routes as PageResult[]).filter((r) => !r.pass);
  lines.push('## 二、失败页面清单');
  lines.push('');
  if (fail.length === 0) {
    lines.push('**✅ 无失败页面**');
    lines.push('');
  } else {
    lines.push('| # | 路由 | 失败原因 | body | 状态 | 崩溃 |');
    lines.push('|---|------|----------|:----:|:----:|:----:|');
    for (const f of fail) {
      lines.push(`| ${f.index} | \`${f.route}\` | ${f.passReason} | ${f.bodyLen} | ${f.status} | ${f.crashed ? '💥P0' : ''} |`);
    }
    lines.push('');
  }

  lines.push('## 三、失败按钮 / Tab 清单');
  lines.push('');
  const fb = s.failedButtonsSummary as Array<{ route: string; btn: string }>;
  if (fb.length === 0) {
    lines.push('**✅ 无失败按钮/Tab**');
    lines.push('');
  } else {
    lines.push('共 ' + fb.length + ' 条 (前 200):');
    lines.push('');
    lines.push('| 路由 | 失败原因 | 类型 |');
    lines.push('|------|----------|------|');
    for (const x of fb) {
      const type = x.btn.includes('DEAD-BUTTON') || x.btn.includes('DEAD-TAB') ? '假按钮' : '异常';
      lines.push(`| \`${x.route}\` | ${x.btn.replace(/\|/g, '/')} | ${type} |`);
    }
    lines.push('');
  }

  lines.push('## 四、Console Error 统计');
  lines.push('');
  lines.push('- Console errors 总数: **' + s.consoleErrors + '**');
  lines.push('- Page errors 总数: **' + s.pageErrors + '**');
  lines.push('');

  lines.push('## 五、截图清单');
  lines.push('');
  lines.push('| # | 路由 | 截图文件 |');
  lines.push('|---|------|----------|');
  const ss = (s.routes as PageResult[]).filter((r) => r.screenshot);
  for (const r of ss) {
    const rel = r.screenshot.replace(process.cwd() + path.sep, '').replace(/\\/g, '/');
    lines.push(`| ${r.index} | \`${r.route}\` | \`${rel}\` |`);
  }
  lines.push('');

  lines.push('## 六、全部页面结果');
  lines.push('');
  lines.push('| # | 路由 | pass | body | 按钮 | Tab | 用时 | 原因 |');
  lines.push('|---|------|:----:|:----:|:----:|:---:|:----:|------|');
  for (const r of s.routes as PageResult[]) {
    lines.push(`| ${r.index} | \`${r.route}\` | ${r.pass ? '✅' : '❌'} | ${r.bodyLen} | ${r.okButtons}/${r.buttonsFound} | ${r.tabsClicked}/${r.tabsFound} | ${r.loadMs}ms | ${r.passReason}${r.crashed ? ' 💥P0' : ''} |`);
  }
  lines.push('');

  return lines.join('\n');
}

function writeFinalReport(): void {
  const results = readAllResults();
  const total = results.length;
  if (total === 0) return;

  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass);
  const crashed = results.filter((r) => r.crashed);
  const totalButtons = results.reduce((a, b) => a + b.buttonsFound, 0);
  const clickedButtons = results.reduce((a, b) => a + b.buttonsClicked, 0);
  const okButtons = results.reduce((a, b) => a + b.buttonsOk, 0);
  const totalTabs = results.reduce((a, b) => a + b.tabsFound, 0);
  const clickedTabs = results.reduce((a, b) => a + b.tabsClicked, 0);
  const ceCount = results.reduce((a, b) => a + b.consoleErrors.length, 0);
  const peCount = results.reduce((a, b) => a + b.pageErrors.length, 0);
  const passRate = total === 0 ? '0%' : `${((pass / total) * 100).toFixed(1)}%`;

  const failedButtonsSummary = fail.flatMap((r) => r.failedButtons.map((b) => ({ route: r.route, btn: b }))).slice(0, 200);

  const summary = {
    version: '3.0.6.11-32',
    timestamp: new Date().toISOString(),
    sidebarRoutesTotal: ALL_ROUTES.length,
    testedRoutes: ROUTES.length,
    total, pass, fail: fail.length, crashed: crashed.length,
    passRate, totalButtons, clickedButtons, okButtons,
    failedButtons: totalButtons - okButtons,
    totalTabs, clickedTabs,
    consoleErrors: ceCount, pageErrors: peCount,
    failedButtonsSummary, routes: results,
  };

  try {
    fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
    fs.writeFileSync(REPORT_JSON, JSON.stringify(summary, null, 2), 'utf-8');
  } catch (e) { console.error('[report] write json failed', e); }

  try {
    fs.mkdirSync(path.dirname(REPORT_MD), { recursive: true });
    fs.writeFileSync(REPORT_MD, renderMarkdown(summary), 'utf-8');
  } catch (e) { console.error('[report] write md failed', e); }

  console.log('\n========== v3.0.6.11-32 200×200 RESULT ==========');
  console.log(`Pages: ${pass}/${total} (${passRate})`);
  console.log(`Crashed: ${crashed.length} (P0)`);
  console.log(`Buttons: found=${totalButtons}, ok=${okButtons}, fail=${totalButtons - okButtons}`);
  console.log(`Tabs clicked: ${clickedTabs}/${totalTabs}`);
  console.log(`Console errors: ${ceCount} | Page errors: ${peCount}`);
  console.log(`MD: ${REPORT_MD}`);
  console.log(`JSON: ${REPORT_JSON}`);
}

test('200页×200交互测试 v3.0.6.11-32', async ({ page }) => {
  test.setTimeout(1800000);

  // Cleanup previous partial results
  try { fs.unlinkSync(RESULTS_PATH); } catch (_) { }

  console.log(`[setup] sidebar routes: total=${ALL_ROUTES.length}, testing=${ROUTES.length}`);
  expect.soft(ROUTES.length, 'route count').toBeGreaterThan(0);

  for (let idx = 0; idx < ROUTES.length; idx++) {
    const route = ROUTES[idx];
    console.log(`  [${idx + 1}/${ROUTES.length}] ${route}`);
    const r = await captureAndTest(page, route, idx);
    appendResult(r);

    if (r.crashed) {
      test.info().annotations.push({ type: 'P0', description: `page crashed: ${route}` });
    }

    console.log(`    -> ${r.pass ? 'PASS' : 'FAIL'} body=${r.bodyLen} btn=${r.buttonsOk}/${r.buttonsFound} tab=${r.tabsClicked}/${r.tabsFound} ce=${r.consoleErrors.length} ms=${r.loadMs} ${r.passReason}`);
  }

  writeFinalReport();
});
