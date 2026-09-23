import { test, expect, type Page, type ConsoleMessage, type Dialog } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:5191';
const RESULTS_DIR = path.resolve(process.cwd(), 'e2e/.click-all-88-results');
const SS_DIR = path.resolve(process.cwd(), 'e2e/screenshots-88');

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

const DANGEROUS_BTN = /(删除|驳回|拒绝|注销|退出登录|退订|解绑|禁用|移除|彻底删除|清空|丢弃|确认删除|取消|关闭|重置|登出|退出|返回|取消登记|撤销|作废|归档|下架|停用|revoke|remove|delete|cancel|close|reset|logout)/i;
const DANGEROUS_TAB = /(危险|高级|危险操作|删除)/;
const MODAL_BTN = /(新建|详情|编辑|配置|添加|新增|查看)/;

const IGNORE_CE_PATTERNS = [
  'mockServiceWorker', 'X-Frame-Options', 'Content Security Policy',
  'favicon', '[HMR]', '[vite]', 'manifest.json', 'Service Worker', '[MSW]',
  'window.error',
  'NetworkError', 'Unexpected end of JSON input',
  'WebSocket', 'websocket', 'sockjs-node',
  '404 Not Found', 'Failed to load module script',
  'Expected a JavaScript module script but the server responded',
  'frame-ancestors',
  'deprecated', 'Warning:', 'antd',
  'Download the React DevTools',
  'Failed to load resource',
];

const PARAM_VALUES: Record<string, string> = {
  ':patientId': 'P001',
  ':visitNumber': 'V001',
  ':reportId': 'RPT001',
  ':id': 'TMP001',
};

interface RouteResult {
  route: string;
  status: number;
  loadMs: number;
  bodyLen: number;
  hasRender: boolean;
  finalUrl: string;
  pageErrors: Array<{ phase: string; msg: string }>;
  consoleErrors: Array<{ phase: string; msg: string }>;
  resourceErrors: Array<{ phase: string; status: number; url: string }>;
  interactionErrors: string[];
  navigatedAway: boolean;
  deadButtons: string[];
  buttonsFound: number;
  buttonsClicked: number;
  tabsFound: number;
  tabsClicked: number;
  modalProbe: boolean;
  modalOpened: boolean;
  selectProbe: boolean;
  selectOpened: boolean;
  crashed: boolean;
  alerted: boolean;
  alertText: string;
  pass: boolean;
  passReason: string;
}

function extractSidebarRoutes(): string[] {
  const cfgPath = path.resolve(process.cwd(), 'src/routes/sidebarConfig.tsx');
  if (!fs.existsSync(cfgPath)) throw new Error(`sidebarConfig.tsx not found: ${cfgPath}`);
  const src = fs.readFileSync(cfgPath, 'utf-8');
  const re = /path:\s*"([^"]+)"/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) { const p = m[1]; if (p && p.startsWith('/')) out.add(p); }
  return Array.from(out);
}

function extractRouteTablePaths(): string[] {
  const rtPath = path.resolve(process.cwd(), 'src/routes/routeTable.tsx');
  if (!fs.existsSync(rtPath)) return [];
  const src = fs.readFileSync(rtPath, 'utf-8');
  const re = /"(\/[^"]*)"/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) { const p = m[1]; if (p && p.startsWith('/')) out.add(p); }
  return Array.from(out);
}

function resolveParams(route: string): string {
  let out = route;
  for (const [k, v] of Object.entries(PARAM_VALUES)) {
    out = out.split(k).join(v);
  }
  return out;
}

const SIDEBAR_ROUTES = extractSidebarRoutes();
const ROUTE_TABLE_PATHS = extractRouteTablePaths();
const EXTRA = ROUTE_TABLE_PATHS.filter((p) => !SIDEBAR_ROUTES.includes(p));
const EXCLUDED = new Set(['/login', '/forbidden']);

const ROUTES: string[] = [];
for (const r of SIDEBAR_ROUTES) {
  if (EXCLUDED.has(r)) continue;
  ROUTES.push(resolveParams(r));
}
for (const r of EXTRA) {
  if (EXCLUDED.has(r)) continue;
  ROUTES.push(resolveParams(r));
}

if (ROUTES.length === 0) throw new Error('No routes extracted');

function shouldIgnoreConsole(t: string): boolean {
  return IGNORE_CE_PATTERNS.some((p) => t.includes(p));
}

function writeResult(r: RouteResult): void {
  try {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const hash = crypto.createHash('md5').update(r.route).digest('hex').slice(0, 10);
    fs.writeFileSync(path.join(RESULTS_DIR, `${hash}.json`), JSON.stringify(r), 'utf-8');
  } catch (_) { }
}

function readAllResults(): RouteResult[] {
  try {
    if (!fs.existsSync(RESULTS_DIR)) return [];
    return fs.readdirSync(RESULTS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf-8')));
  } catch { return []; }
}
void readAllResults;

async function injectAdmin(page: Page): Promise<void> {
  await page.addInitScript((data) => {
    try { window.localStorage.setItem('ris_current_user', data.user); } catch (_) { }
    try { window.localStorage.setItem('g005_auth', data.auth); } catch (_) { }
  }, { user: ADMIN_USER, auth: G005_AUTH });
}

async function checkBlueScreen(page: Page): Promise<boolean> {
  try {
    const t = await page.evaluate(() => document.body?.innerText ?? '');
    return t.includes('Unexpected Application Error');
  } catch { return false; }
}

async function runRouteTest(page: Page, route: string): Promise<RouteResult> {
  const t0 = Date.now();
  const result: RouteResult = {
    route, status: 0, loadMs: 0, bodyLen: 0, hasRender: false, finalUrl: '',
    pageErrors: [], consoleErrors: [], resourceErrors: [], interactionErrors: [], navigatedAway: false, deadButtons: [],
    buttonsFound: 0, buttonsClicked: 0, tabsFound: 0, tabsClicked: 0,
    modalProbe: false, modalOpened: false, selectProbe: false, selectOpened: false,
    crashed: false, alerted: false, alertText: '', pass: false, passReason: '',
  };

  let phase = 'LOAD';
  const consoleErrs: Array<{ phase: string; msg: string }> = [];
  const pageErrs: Array<{ phase: string; msg: string }> = [];
  const resErrs: Array<{ phase: string; status: number; url: string }> = [];
  let crashed = false;

  const onPageError = (e: Error): void => { pageErrs.push({ phase, msg: e.message.slice(0, 300) }); };
  const onConsole = (m: ConsoleMessage): void => {
    if (m.type() !== 'error') return;
    const txt = m.text();
    if (shouldIgnoreConsole(txt)) return;
    consoleErrs.push({ phase, msg: txt.slice(0, 300) });
  };
  const onResponse = (resp: any): void => {
    const s = resp.status();
    if (s >= 400) {
      const u = (resp.url() ?? '').slice(0, 200);
      if (!u.includes('/@vite/') && !u.includes('.tsx')) {
        resErrs.push({ phase, status: s, url: u });
      }
    }
  };
  const onCrash = (): void => { crashed = true; };
  const onDialog = async (d: Dialog): Promise<void> => {
    result.alerted = true;
    result.alertText = d.message().slice(0, 300);
    await d.dismiss().catch(() => undefined);
  };

  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('response', onResponse);
  page.on('crash', onCrash);
  page.on('dialog', onDialog);

  try {
    await injectAdmin(page);
    const resp = await page.goto(`${BASE}${route}`, { timeout: 30000, waitUntil: 'domcontentloaded' });
    result.status = resp?.status() ?? 0;
    await page.waitForFunction(() => {
      const t = document.body?.innerText?.length ?? 0;
      const btns = document.querySelectorAll('button').length;
      return t > 80 || btns > 0;
    }, { timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(800);

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
    result.finalUrl = page.url();
    if (await checkBlueScreen(page)) {
      pageErrs.push({ phase: 'LOAD', msg: 'BLUE_SCREEN: Unexpected Application Error' });
    }

    const buttonEls = await page.$$('button:visible:not([disabled])');
    result.buttonsFound = buttonEls.length;
    for (let b = 0; b < Math.min(buttonEls.length, 10); b++) {
      if (result.navigatedAway) break;
      const btn = buttonEls[b]!;
      let text = '';
      try { text = (await btn.innerText()).trim(); } catch (_) { text = ''; }
      if (DANGEROUS_BTN.test(text)) continue;
      if (!text) continue;
      try {
        const isLink = await btn.evaluate((el) => el.tagName === 'A' || !!el.closest('a')).catch(() => false);
        if (isLink) continue;
        phase = `BUTTON:${text || '(no-text)'}`;
        const beforeHTML = await page.evaluate(() => document.body.innerHTML.length).catch(() => 0);
        const beforeURL = page.url();
        await btn.click({ timeout: 2000, force: true });
        await page.waitForTimeout(400);
        const afterURL = page.url();
        if (afterURL !== beforeURL) { result.navigatedAway = true; }
        const afterHTML = await page.evaluate(() => document.body.innerHTML.length).catch(() => 0);
        result.buttonsClicked += 1;
        if (!result.navigatedAway && Math.abs(afterHTML - beforeHTML) < 10 && !text.includes('展开') && !text.includes('收起') && !text.includes('更多')) {
          result.deadButtons.push(text || '(no-text)');
        }
      } catch (e: any) {
        result.buttonsClicked += 1;
        result.interactionErrors.push(`BUTTON:${text || '(no-text)'} | ${(e?.message ?? '').slice(0, 120)}`);
      }
      phase = 'LOAD';
    }

    const tabEls = await page.$$('.ant-tabs-tab:visible');
    result.tabsFound = tabEls.length;
    for (let t = 0; t < Math.min(tabEls.length, 5); t++) {
      if (result.navigatedAway) break;
      const tab = tabEls[t]!;
      let text = '';
      try { text = (await tab.innerText()).trim(); } catch (_) { text = ''; }
      if (DANGEROUS_TAB.test(text)) continue;
      phase = `TAB:${text || '(no-text)'}`;
      try {
        const beforeURL = page.url();
        await tab.click({ timeout: 2000, force: true });
        await page.waitForTimeout(400);
        if (page.url() !== beforeURL) { result.navigatedAway = true; }
        result.tabsClicked += 1;
      } catch (e: any) {
        result.interactionErrors.push(`TAB:${text || '(no-text)'} | ${(e?.message ?? '').slice(0, 120)}`);
      }
      phase = 'LOAD';
    }

    result.modalProbe = true;
    let modalBtn: any = null;
    if (!result.navigatedAway) {
      const modalBtnEls = await page.$$('button:visible:not([disabled])');
      for (const mb of modalBtnEls) {
        let mt = '';
        try { mt = (await mb.innerText()).trim(); } catch (_) { mt = ''; }
        if (!mt) continue;
        if (MODAL_BTN.test(mt) && !DANGEROUS_BTN.test(mt)) {
          const isLink = await mb.evaluate((el) => el.tagName === 'A' || !!el.closest('a')).catch(() => true);
          if (!isLink) { modalBtn = mb; break; }
        }
      }
    }
    if (modalBtn) {
      phase = 'MODAL';
      try {
        const beforeURL = page.url();
        await modalBtn.click({ timeout: 2000, force: true });
        await page.waitForTimeout(800);
        if (page.url() !== beforeURL) { result.navigatedAway = true; }
        const opened = await page.$$('.ant-modal-wrap:not([style*="display: none"])').then((e) => e.length)
          .catch(() => 0) + await page.$$('.ant-drawer-open').then((e) => e.length).catch(() => 0);
        result.modalOpened = opened > 0;
        if (await checkBlueScreen(page)) {
          pageErrs.push({ phase: 'MODAL', msg: 'BLUE_SCREEN: Unexpected Application Error' });
        }
        await page.keyboard.press('Escape').catch(() => undefined);
        await page.waitForTimeout(400);
      } catch (e: any) {
        result.interactionErrors.push('MODAL | ' + (e?.message ?? '').slice(0, 120));
      }
      phase = 'LOAD';
    }

    result.selectProbe = true;
    const selEls = await page.$$('.ant-select-selector:visible').catch(() => []);
    if (selEls.length > 0 && !result.navigatedAway) {
      phase = 'SELECT';
      try {
        await selEls[0]!.click({ timeout: 2000, force: true });
        await page.waitForTimeout(500);
        const dropdownOpen = await page.evaluate(() => {
          const dd = document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
          return !!dd;
        }).catch(() => false);
        result.selectOpened = dropdownOpen;
        await page.keyboard.press('Escape').catch(() => undefined);
        await page.waitForTimeout(300);
      } catch (e: any) {
        result.interactionErrors.push('SELECT | ' + (e?.message ?? '').slice(0, 120));
      }
      phase = 'LOAD';
    }
  } catch (e: any) {
    pageErrs.push({ phase: 'LOAD', msg: 'NAV: ' + (e?.message ?? '').slice(0, 300) });
  }

  result.pageErrors = pageErrs;
  result.consoleErrors = consoleErrs;
  result.resourceErrors = resErrs;
  result.crashed = crashed;
  result.loadMs = Date.now() - t0;
  result.finalUrl = page.url();

  page.off('pageerror', onPageError);
  page.off('console', onConsole);
  page.off('response', onResponse);
  page.off('crash', onCrash);
  page.off('dialog', onDialog);

  const okStatus = result.status === 0 || result.status < 400;
  const okPE = result.pageErrors.length === 0;
  const okCE = result.consoleErrors.length === 0;
  const okBody = result.bodyLen > 50;
  const okNav = !result.finalUrl.includes('/forbidden');
  const okRes = result.resourceErrors.length === 0;
  const reasons: string[] = [];
  if (!okStatus) reasons.push(`STATUS=${result.status}`);
  if (!okPE) reasons.push(`PAGE_ERR=${result.pageErrors.length}`);
  if (!okCE) reasons.push(`CONSOLE_ERR=${result.consoleErrors.length}`);
  if (!okRes) reasons.push(`HTTP_ERR=${result.resourceErrors.length}`);
  if (!okBody) reasons.push(`BODY_LEN=${result.bodyLen}`);
  if (!result.hasRender) reasons.push('STUCK');
  if (result.crashed) reasons.push('CRASHED');
  if (!okNav) reasons.push('FORBIDDEN_REDIRECT');
  if (result.alerted) reasons.push('ALERT');
  result.pass = okStatus && okPE && okCE && okRes && okBody && result.hasRender && !result.crashed && okNav && !result.alerted;
  result.passReason = result.pass ? 'OK' : reasons.join(', ');

  return result;
}

test.describe.configure({ mode: 'parallel' });

for (let i = 0; i < ROUTES.length; i++) {
  const route = ROUTES[i]!;
  test(`[click-all:${String(i + 1).padStart(3, '0')}/${ROUTES.length}] ${route}`, async ({ page }) => {
    test.setTimeout(60000);
    const r = await runRouteTest(page, route);
    writeResult(r);

    if (!r.pass) {
      const ssName = (route.replace(/[/:]/g, '_').replace(/^_+/, '') || 'root');
      try {
        fs.mkdirSync(SS_DIR, { recursive: true });
        await page.screenshot({ path: path.join(SS_DIR, `${ssName}.png`), fullPage: false });
      } catch (_) { }

      const parts: string[] = [`route=${route}`, `reason=${r.passReason}`];
      if (r.pageErrors.length > 0) {
        parts.push('pageerrors=' + r.pageErrors.map((e) => `[${e.phase}]${e.msg}`).join(' || '));
      }
      if (r.consoleErrors.length > 0) {
        parts.push('console_errors=' + r.consoleErrors.map((e) => `[${e.phase}]${e.msg}`).join(' || '));
      }
      if (r.interactionErrors.length > 0) parts.push('interaction_errors=' + r.interactionErrors.slice(0, 5).join(' || '));
      if (r.resourceErrors.length > 0) parts.push('http_errors=' + r.resourceErrors.slice(0, 5).map((e) => `${e.status}@${e.url}`).join(' || '));
      if (r.deadButtons.length > 0) parts.push('dead_buttons=' + r.deadButtons.join(','));
      if (r.crashed) parts.push('crashed=true');
      if (r.alerted) parts.push(`alert=${r.alertText}`);
      if (r.finalUrl.includes('/forbidden')) parts.push(`final_url=${r.finalUrl}`);
      test.info().annotations.push({ type: 'FAIL', description: `${route} | ${r.passReason}` });
      expect.soft(r.pass, parts.join(' | ')).toBe(true);
    }
  });
}
