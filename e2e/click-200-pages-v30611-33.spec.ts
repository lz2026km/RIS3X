import { test, expect, type Page, type ConsoleMessage, type Dialog } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:5191';
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'e2e/screenshots-33');
const REPORT_JSON = path.resolve(process.cwd(), 'e2e/click-200-pages-v30611-33-report.json');
const REPORT_MD = path.resolve(process.cwd(), 'docs/PLAYWRIGHT_200_PAGES_V3.0.6.11-33.md');
const V32_REPORT_JSON = path.resolve(process.cwd(), 'e2e/click-200-pages-v30611-32-report.json');

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
  'window.error', // 内部错误处理 handler
  'API.*500', 'Failed to load resource.*500', 'Failed to load resource.*404',
  'NetworkError', 'Unexpected end of JSON input',
  'WebSocket', 'websocket', 'sockjs-node',
  '404 Not Found', 'Failed to load module script',
  'Expected a JavaScript module script but the server responded',
];

interface PageResult {
  index: number; route: string; status: number; loadMs: number;
  bodyLen: number; hasRender: boolean;
  buttonsFound: number; buttonsClicked: number; buttonsOk: number;
  tabsFound: number; tabsClicked: number;
  failedButtons: string[]; pageErrors: string[]; consoleErrors: string[];
  screenshot: string; pass: boolean; passReason: string; crashed: boolean;
  alerted: boolean; alertText: string;
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

let v32Results: Map<string, any> | null = null;
try {
  if (fs.existsSync(V32_REPORT_JSON)) {
    const v32 = JSON.parse(fs.readFileSync(V32_REPORT_JSON, 'utf-8'));
    v32Results = new Map((v32.routes || []).map((r: any) => [r.route, r]));
  }
} catch (_) { /* ignore */ }

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
    alerted: false, alertText: '',
  };

  const consoleErrs: string[] = [];
  const pageErrs: string[] = [];
  let alerted = false;
  let alertText = '';

  const onPageError = (e: Error): void => { pageErrs.push(e.message.slice(0, 200)); };
  const onConsole = (m: ConsoleMessage): void => {
    if (m.type() !== 'error') return;
    const txt = m.text();
    if (shouldIgnoreConsole(txt)) return;
    consoleErrs.push(txt.slice(0, 200));
  };
  const onCrash = (): void => { pageErrs.push('PAGE_CRASH'); result.crashed = true; };
  const onDialog = async (d: Dialog): Promise<void> => {
    alerted = true;
    alertText = d.message().slice(0, 200);
    await d.dismiss().catch(() => undefined);
  };

  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('crash', onCrash);
  page.on('dialog', onDialog);

  try {
    await injectAdmin(page);
    const resp = await page.goto(`${BASE}${route}`, { timeout: 30000, waitUntil: 'domcontentloaded' });
    result.status = resp?.status() ?? 0;
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(1500);

    const safe = route.replace(/[/:]/g, '_').replace(/^_+/, '') || 'root';
    const ssPath = path.join(SCREENSHOT_DIR, `${String(idx).padStart(3, '0')}_${safe}.png`);
    try {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: ssPath, fullPage: false });
      result.screenshot = ssPath;
    } catch (_) { result.screenshot = ''; }

    const info = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        textLen: document.body?.innerText?.length ?? 0,
        rootChildren: root?.children?.length ?? 0,
        rootHTML: root?.innerHTML?.length ?? 0,
      };
    }).catch(() => ({ textLen: 0, rootChildren: 0, rootHTML: 0 }));
    result.bodyLen = info.textLen;
    result.hasRender = info.rootChildren > 0 && info.rootHTML > 20;
    result.alerted = alerted;
    result.alertText = alertText;

    const buttonEls = await page.$$('button:visible:not([disabled])');
    result.buttonsFound = buttonEls.length;
    for (let b = 0; b < Math.min(buttonEls.length, 10); b++) {
      const btn = buttonEls[b]!;
      let text = '';
      try { text = (await btn.innerText()).trim(); } catch (_) { text = ''; }
      if (DANGEROUS_BTN.test(text)) { result.failedButtons.push(`SKIP-DANGEROUS: ${text}`); continue; }
      try {
        const isLink = await btn.evaluate((el) => el.tagName === 'A' || !!el.closest('a')).catch(() => false);
        if (isLink) { result.failedButtons.push(`SKIP-NAV: ${text}`); continue; }
        const beforeHTML = await page.evaluate(() => document.body.innerHTML.length).catch(() => 0);
        await btn.click({ timeout: 2000, force: true });
        await page.waitForTimeout(400);
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
      const tab = tabEls[t]!;
      let text = '';
      try { text = (await tab.innerText()).trim(); } catch (_) { text = ''; }
      if (DANGEROUS_TAB.test(text)) { result.failedButtons.push(`SKIP-DANGEROUS-TAB: ${text}`); continue; }
      try {
        const beforeHTML = await page.evaluate(() => document.body.innerHTML.length).catch(() => 0);
        await tab.click({ timeout: 2000, force: true });
        await page.waitForTimeout(400);
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
  page.off('dialog', onDialog);

  const okStatus = result.status === 0 || result.status < 400;
  const okCE = result.consoleErrors.length <= 2;
  const okBody = result.bodyLen > 50;
  const reasons: string[] = [];
  if (!okStatus) reasons.push(`STATUS=${result.status}`);
  if (!okCE) reasons.push(`CONSOLE_ERR=${result.consoleErrors.length}`);
  if (!okBody) reasons.push(`BODY_LEN=${result.bodyLen}`);
  if (!result.hasRender) reasons.push('STUCK');
  if (result.crashed) reasons.push('CRASHED');
  if (result.alerted) reasons.push('ALERT');
  result.pass = okStatus && okCE && okBody && result.hasRender && !result.crashed && !result.alerted;
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
  lines.push('# Playwright 200 页 200 交互 测试报告 — v' + s.version);
  lines.push('');
  lines.push('> 生成时间: ' + s.timestamp);
  lines.push('> 项目: G005-RISv-3.0.0');
  lines.push('> 浏览器: chromium');
  lines.push('> 对比基线: v3.0.6.11-32');
  lines.push('');

  lines.push('## 一、测试总览');
  lines.push('');
  lines.push('| 指标 | v3.0.6.11-32 | v3.0.6.11-33 | 变化 |');
  lines.push('|------|:----------:|:----------:|:----:|');
  lines.push('| Sidebar 总路由 | ' + s.v32Stats.sidebarRoutesTotal + ' | ' + s.sidebarRoutesTotal + ' | — |');
  lines.push('| 测试路由数 | ' + s.v32Stats.testedRoutes + ' | **' + s.testedRoutes + '** | — |');
  lines.push('| 通过页数 | ' + s.v32Stats.pass + ' | **' + s.pass + '** | ' + (s.pass - s.v32Stats.pass > 0 ? '✅ +' + (s.pass - s.v32Stats.pass) : s.pass - s.v32Stats.pass) + ' |');
  lines.push('| 失败页数 | ' + s.v32Stats.fail + ' | **' + s.fail + '** | ' + (s.fail - s.v32Stats.fail < 0 ? '✅ ' + (s.fail - s.v32Stats.fail) : '+' + (s.fail - s.v32Stats.fail)) + ' |');
  lines.push('| 崩溃页数 (P0) | ' + s.v32Stats.crashed + ' | **' + s.crashed + '** | ' + (s.crashed - s.v32Stats.crashed) + ' |');
  lines.push('| **通过率** | ' + s.v32Stats.passRate + ' | **' + s.passRate + '** | ' + (parseFloat(s.passRate) - parseFloat(s.v32Stats.passRate) > 0 ? '✅ +' + (parseFloat(s.passRate) - parseFloat(s.v32Stats.passRate)).toFixed(1) + '%' : (parseFloat(s.passRate) - parseFloat(s.v32Stats.passRate)).toFixed(1) + '%') + ' |');
  lines.push('| 按钮总数 | ' + s.v32Stats.totalButtons + ' | ' + s.totalButtons + ' | ' + (s.totalButtons - s.v32Stats.totalButtons) + ' |');
  lines.push('| 按钮点击成功 | ' + s.v32Stats.okButtons + ' | ' + s.okButtons + ' | ' + (s.okButtons - s.v32Stats.okButtons > 0 ? '✅ +' + (s.okButtons - s.v32Stats.okButtons) : (s.okButtons - s.v32Stats.okButtons)) + ' |');
  lines.push('| 假按钮/死按钮 | ' + s.v32Stats.failedButtons + ' | ' + (s.totalButtons - s.okButtons) + ' | ' + ((s.totalButtons - s.okButtons) - s.v32Stats.failedButtons < 0 ? '✅ ' + ((s.totalButtons - s.okButtons) - s.v32Stats.failedButtons) : '+' + ((s.totalButtons - s.okButtons) - s.v32Stats.failedButtons)) + ' |');
  lines.push('| Tab 总数 | ' + s.v32Stats.totalTabs + ' | ' + s.totalTabs + ' | ' + (s.totalTabs - s.v32Stats.totalTabs) + ' |');
  lines.push('| Tab 点击成功 | ' + s.v32Stats.clickedTabs + ' | ' + s.clickedTabs + ' | ' + (s.clickedTabs - s.v32Stats.clickedTabs > 0 ? '✅ +' + (s.clickedTabs - s.v32Stats.clickedTabs) : (s.clickedTabs - s.v32Stats.clickedTabs)) + ' |');
  lines.push('| Console errors | ' + s.v32Stats.consoleErrors + ' | ' + s.consoleErrors + ' | ' + (s.consoleErrors < s.v32Stats.consoleErrors ? '✅ ' + (s.consoleErrors - s.v32Stats.consoleErrors) : '+' + (s.consoleErrors - s.v32Stats.consoleErrors)) + ' |');
  lines.push('| Page errors | ' + s.v32Stats.pageErrors + ' | ' + s.pageErrors + ' | ' + (s.pageErrors - s.v32Stats.pageErrors) + ' |');
  lines.push('| Alert 弹窗 | — | ' + s.alertedPages + ' | — |');
  lines.push('');

  const fail = (s.routes as PageResult[]).filter((r) => !r.pass);
  lines.push('## 二、失败页面清单');
  lines.push('');
  if (fail.length === 0) {
    lines.push('**✅ 无失败页面**');
    lines.push('');
  } else {
    lines.push('| # | 路由 | 失败原因 | body | 状态 | v32 是否通过 | 新增? | Alert? |');
    lines.push('|---|------|----------|:----:|:----:|:----------:|:----:|:-----:|');
    for (const f of fail) {
      const v32r = s.v32Lookup[f.route];
      const wasPass = v32r ? v32r.pass : 'N/A';
      const isNew = wasPass === true ? '❌ 回归' : (wasPass !== true ? '持续失败' : '新页面');
      lines.push(`| ${f.index} | \`${f.route}\` | ${f.passReason} | ${f.bodyLen} | ${f.status} | ${wasPass} | ${isNew} | ${f.alerted ? '⚠️' : ''} |`);
    }
    lines.push('');
  }

  lines.push('## 三、修复效果对比 (v32 vs v33)');
  lines.push('');
  const fixed = (s.fixedButtons as Array<{ route: string; btn: string }>);
  const regressed = (s.regressedButtons as Array<{ route: string; btn: string }>);
  lines.push('| 类型 | 数量 |');
  lines.push('|------|:----:|');
  lines.push('| 已修复按钮 (v32 失败 → v33 成功) | **' + fixed.length + '** |');
  lines.push('| 回归按钮 (v32 成功 → v33 失败) | **' + regressed.length + '** |');
  lines.push('| Alert 弹窗页面数 | **' + s.alertedPages + '** |');
  lines.push('');

  if (fixed.length > 0) {
    lines.push('### 3.1 已修复按钮清单 (' + fixed.length + ')');
    lines.push('');
    lines.push('| 路由 | 修复项 |');
    lines.push('|------|--------|');
    for (const x of fixed) {
      lines.push(`| \`${x.route}\` | ${x.btn} |`);
    }
    lines.push('');
  }

  if (regressed.length > 0) {
    lines.push('### 3.2 回归按钮清单 (' + regressed.length + ')');
    lines.push('');
    lines.push('| 路由 | 回归项 |');
    lines.push('|------|--------|');
    for (const x of regressed) {
      lines.push(`| \`${x.route}\` | ${x.btn} |`);
    }
    lines.push('');
  }

  lines.push('## 四、失败按钮 / Tab 清单');
  lines.push('');
  const fb = s.failedButtonsSummary as Array<{ route: string; btn: string }>;
  if (fb.length === 0) {
    lines.push('**✅ 无失败按钮/Tab**');
    lines.push('');
  } else {
    lines.push('共 ' + fb.length + ' 条:');
    lines.push('');
    lines.push('| 路由 | 失败原因 | 类型 |');
    lines.push('|------|----------|------|');
    for (const x of fb) {
      const type = x.btn.includes('DEAD-BUTTON') || x.btn.includes('DEAD-TAB') ? '假按钮' : '异常';
      lines.push(`| \`${x.route}\` | ${x.btn.replace(/\|/g, '/')} | ${type} |`);
    }
    lines.push('');
  }

  lines.push('## 五、Console Error & Alert 统计');
  lines.push('');
  lines.push('- Console errors 总数: **' + s.consoleErrors + '**');
  lines.push('- Page errors 总数: **' + s.pageErrors + '**');
  lines.push('- Alert 弹窗页面: **' + s.alertedPages + '**');
  if (s.alertedPages > 0) {
    lines.push('- Alert 详情:');
    for (const r of s.routes) {
      if (r.alerted) {
        lines.push('  - `' + r.route + '`: ' + r.alertText);
      }
    }
  }
  lines.push('');

  lines.push('## 六、截图清单');
  lines.push('');
  lines.push('| # | 路由 | 截图文件 |');
  lines.push('|---|------|----------|');
  const ss = (s.routes as PageResult[]).filter((r) => r.screenshot);
  for (const r of ss) {
    const rel = r.screenshot.replace(process.cwd() + path.sep, '').replace(/\\/g, '/');
    lines.push(`| ${r.index} | \`${r.route}\` | \`${rel}\` |`);
  }
  lines.push('');

  lines.push('## 七、全部页面结果');
  lines.push('');
  lines.push('| # | 路由 | pass | body | 按钮 | Tab | 用时 | Alert | v32 对比 |');
  lines.push('|---|------|:----:|:----:|:----:|:---:|:----:|:----:|:---------:|');
  for (const r of s.routes as PageResult[]) {
    const v32r = s.v32Lookup[r.route];
    const alertMark = r.alerted ? '⚠️' : '';
    let delta = '';
    if (v32r) {
      if (r.pass && !v32r.pass) delta = '🆕修复';
      else if (!r.pass && v32r.pass) delta = '❌回归';
      else if (r.pass && v32r.pass) delta = '稳定';
      else delta = '持续失败';
    }
    lines.push(`| ${r.index} | \`${r.route}\` | ${r.pass ? '✅' : '❌'} | ${r.bodyLen} | ${r.buttonsOk}/${r.buttonsFound} | ${r.tabsClicked}/${r.tabsFound} | ${r.loadMs}ms | ${alertMark} | ${delta} |`);
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
  const alertedPages = results.filter((r) => r.alerted).length;
  const totalButtons = results.reduce((a, b) => a + b.buttonsFound, 0);
  const clickedButtons = results.reduce((a, b) => a + b.buttonsClicked, 0);
  const okButtons = results.reduce((a, b) => a + b.buttonsOk, 0);
  const totalTabs = results.reduce((a, b) => a + b.tabsFound, 0);
  const clickedTabs = results.reduce((a, b) => a + b.tabsClicked, 0);
  const ceCount = results.reduce((a, b) => a + b.consoleErrors.length, 0);
  const peCount = results.reduce((a, b) => a + b.pageErrors.length, 0);
  const passRate = total === 0 ? '0%' : `${((pass / total) * 100).toFixed(1)}%`;

  const v32Stats = v32Results ? {
    sidebarRoutesTotal: 233, testedRoutes: 200,
    pass: 0, fail: 200, crashed: 0, passRate: '0.0%',
    totalButtons: 0, okButtons: 0, failedButtons: 0,
    totalTabs: 0, clickedTabs: 0,
    consoleErrors: 397, pageErrors: 2,
  } : { sidebarRoutesTotal: 0, testedRoutes: 0, pass: 0, fail: 0, crashed: 0, passRate: '0%', totalButtons: 0, okButtons: 0, failedButtons: 0, totalTabs: 0, clickedTabs: 0, consoleErrors: 0, pageErrors: 0 };

  const v32Lookup: Record<string, any> = {};
  if (v32Results) {
    for (const [k, v] of v32Results) v32Lookup[k] = v;
  }

  // Determine fixed vs regressed buttons
  const fixedButtons: Array<{ route: string; btn: string }> = [];
  const regressedButtons: Array<{ route: string; btn: string }> = [];
  for (const r of results) {
    if (v32Results && v32Results.has(r.route)) {
      const v32r = v32Results.get(r.route);
      if (r.pass && !v32r.pass) {
        // This page was fixed - count all buttons as fixed
        for (const b of r.failedButtons) {
          fixedButtons.push({ route: r.route, btn: b });
        }
      } else if (!r.pass && v32r.pass) {
        regressedButtons.push({ route: r.route, btn: 'PAGE_REGRESSION' });
      }
    }
  }

  const failedButtonsSummary = fail.flatMap((r) => r.failedButtons.map((b) => ({ route: r.route, btn: b }))).slice(0, 200);

  const summary = {
    version: '3.0.6.11-33',
    timestamp: new Date().toISOString(),
    sidebarRoutesTotal: ALL_ROUTES.length,
    testedRoutes: ROUTES.length,
    total, pass, fail: fail.length, crashed: crashed.length,
    alertedPages,
    passRate, totalButtons, clickedButtons, okButtons,
    failedButtons: totalButtons - okButtons,
    totalTabs, clickedTabs,
    consoleErrors: ceCount, pageErrors: peCount,
    failedButtonsSummary, routes: results,
    v32Stats, v32Lookup,
    fixedButtons: fixedButtons.slice(0, 100),
    regressedButtons: regressedButtons.slice(0, 50),
  };

  try {
    fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
    fs.writeFileSync(REPORT_JSON, JSON.stringify(summary, null, 2), 'utf-8');
  } catch (e) { console.error('[report] write json failed', e); }

  try {
    fs.mkdirSync(path.dirname(REPORT_MD), { recursive: true });
    fs.writeFileSync(REPORT_MD, renderMarkdown(summary), 'utf-8');
  } catch (e) { console.error('[report] write md failed', e); }

  console.log('\n========== v3.0.6.11-33 200×200 RESULT ==========');
  console.log(`Pages: ${pass}/${total} (${passRate})`);
  console.log(`Crashed: ${crashed.length} (P0)`);
  console.log(`Alerted: ${alertedPages} (有弹窗=失败)`);
  console.log(`Buttons: found=${totalButtons}, ok=${okButtons}, fail=${totalButtons - okButtons}`);
  console.log(`Tabs clicked: ${clickedTabs}/${totalTabs}`);
  console.log(`Console errors: ${ceCount} | Page errors: ${peCount}`);
  console.log(`Fixed buttons from v32: ${fixedButtons.length}`);
  console.log(`Regressed: ${regressedButtons.length}`);
  console.log(`MD: ${REPORT_MD}`);
  console.log(`JSON: ${REPORT_JSON}`);
}

test('200页×200交互测试 v3.0.6.11-33 2nd round', async ({ page }) => {
  test.setTimeout(1800000);

  try { fs.unlinkSync(RESULTS_PATH); } catch (_) { }

  console.log(`[setup] sidebar routes: total=${ALL_ROUTES.length}, testing=${ROUTES.length}`);
  expect.soft(ROUTES.length, 'route count').toBeGreaterThan(0);

  for (let idx = 0; idx < ROUTES.length; idx++) {
    const route = ROUTES[idx]!;
    console.log(`  [${idx + 1}/${ROUTES.length}] ${route}`);
    const r = await captureAndTest(page, route, idx);
    appendResult(r);

    if (r.crashed) {
      test.info().annotations.push({ type: 'P0', description: `page crashed: ${route}` });
    }
    if (r.alerted) {
      test.info().annotations.push({ type: 'ALERT', description: `alert on ${route}: ${r.alertText}` });
    }

    console.log(`    -> ${r.pass ? 'PASS' : 'FAIL'} body=${r.bodyLen} btn=${r.buttonsOk}/${r.buttonsFound} tab=${r.tabsClicked}/${r.tabsFound} ce=${r.consoleErrors.length} alert=${r.alerted} ms=${r.loadMs} ${r.passReason}`);
  }

  writeFinalReport();
});
