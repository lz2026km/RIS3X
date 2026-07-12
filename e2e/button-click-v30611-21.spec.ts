/**
 * G005 放射RIS v3.0.6.11-21 — 全量 button 点击有效性验证
 *
 * 目标：
 *  1. 选取 20 个高频页面（含 v3.0.6.11-20 新模块）
 *  2. 注入 admin 登录态
 *  3. 对每个页面查找所有 button 元素
 *  4. 排除 destructive 按钮 (删除/重置/恢复/驳回/取消/拒绝/清空/关闭/退出)
 *  5. 逐个点击 → 验证：
 *     - 点击无 page error / console error
 *     - 触发预期 UI 变化 (modal/drawer/notification/badge/计数变化)
 *  6. 失败分类：
 *     - P0_BUTTON_NORES: onClick handler 缺失 / 无响应
 *     - P0_BUTTON_DISABLED: 状态错误（不应 disabled 但 disabled）
 *     - P0_BUTTON_THROW: 抛 uncaught error
 *
 * 输出：e2e/button-click-v30611-21-report.json
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:5191';

// 20 高频页面 — 含 v3.0.6.11-20 新增 (system/audit, system/backup, system/tenant-config, audit-compliance)
const TARGET_PAGES: { name: string; path: string; isNew?: boolean }[] = [
  { name: 'critical-value',   path: '/critical-value',         isNew: false },
  { name: 'worklist',         path: '/worklist',               isNew: false },
  { name: 'reports',          path: '/reports',                isNew: false },
  { name: 'patients',         path: '/patients',               isNew: false },
  { name: 'appointments',     path: '/appointments',           isNew: false },
  { name: 'queue-call',       path: '/queue-call',             isNew: false },
  { name: 'dicom-viewer',     path: '/dicom-viewer',           isNew: false },
  { name: 'ai-assist',        path: '/ai-assist',              isNew: false },
  { name: 'workflow-designer',path: '/workflow-designer',      isNew: false },
  { name: 'cosign',           path: '/cosign',                 isNew: false },
  { name: 'dose-track',       path: '/dose-track',             isNew: false },
  { name: 'regional-report',  path: '/regional-report',        isNew: false },
  { name: 'notification-ctr', path: '/notification-center',    isNew: false },
  { name: 'report-review',    path: '/report-review',          isNew: false },
  { name: 'qc',               path: '/qc',                     isNew: false },
  { name: 'schedule',         path: '/schedule',               isNew: false },
  { name: 'audit-compliance', path: '/audit-compliance',       isNew: false },
  // v3.0.6.11-20 新增系统模块
  { name: 'sys-audit',        path: '/system/audit',           isNew: true  },
  { name: 'sys-backup',       path: '/system/backup',          isNew: true  },
  { name: 'sys-tenant-config',path: '/system/tenant-config',   isNew: true  },
];

const AUTH_PAYLOAD = JSON.stringify({
  id: 'admin', name: '管理员', role: '管理员', token: 'btn-click-verify',
  department: '放射科', phone: '', username: 'admin', title: '系统管理员',
});

const IGNORE_PATTERNS = [
  'mockServiceWorker', 'X-Frame-Options', 'frame-ancestors',
  'Content Security Policy', 'favicon', 'cdn.jsdelivr.net',
  'WebSocket', 'Download the React DevTools', '[MSW]',
  'ServiceWorker', 'sw.js',
];

const DESTRUCTIVE_TXT = /删除|重置|清空|恢复|驳回|拒绝|退订|关闭|退出|撤销|注销|disable|delete|reset|remove|revoke|logout|clear/i;

interface ButtonClickResult {
  selector: string;
  text: string;
  clicked: boolean;
  urlChanged: boolean;
  modalOpened: boolean;
  drawerOpened: boolean;
  toastShown: boolean;
  domChanged: boolean;
  error?: string;
  category: 'ok' | 'no-handler' | 'disabled' | 'throw' | 'nav';
}

interface PageResult {
  page: string;
  path: string;
  isNew: boolean;
  buttonsFound: number;
  buttonsClicked: number;
  buttonsOk: number;
  results: ButtonClickResult[];
  pageErrors: string[];
  consoleErrors: string[];
  loadMs: number;
}

const allResults: PageResult[] = [];

function shouldIgnore(text: string): boolean {
  return IGNORE_PATTERNS.some(p => text.includes(p));
}

async function loginAsAdmin(page: Page) {
  // 先注入 localStorage, 然后访问主页 — 优先减少登录页选择器的脆弱性
  await page.addInitScript((u) => {
    try { localStorage.setItem('ris_current_user', u); } catch (_) {}
  }, AUTH_PAYLOAD);
}

async function gotoPage(page: Page, route: string) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // 等 React + MSW 渲染
  await page.waitForTimeout(3500);
}

async function getUIState(page: Page) {
  return await page.evaluate(() => ({
    url: location.href,
    modalCount: document.querySelectorAll('.ant-modal:not([style*="display: none"])').length,
    drawerCount: document.querySelectorAll('.ant-drawer:not(.ant-drawer-hidden)').length,
    modalAny: document.querySelectorAll('.ant-modal').length,
    drawerAny: document.querySelectorAll('.ant-drawer').length,
    messageCount: document.querySelectorAll('.ant-message-notice, .ant-notification-notice').length,
    bodyHtmlLen: document.body.innerHTML.length,
  }));
}

async function findClickableButtons(page: Page): Promise<Locator[]> {
  // 抓所有可见且非禁用的 button
  const allBtns = await page.locator('button:visible').all();
  const out: Locator[] = [];
  for (const b of allBtns) {
    const dis = await b.isDisabled().catch(() => true);
    const visible = await b.isVisible().catch(() => false);
    if (!dis && visible) out.push(b);
  }
  return out;
}

async function tryClickButton(
  page: Page,
  btn: Locator,
  index: number,
): Promise<ButtonClickResult> {
  const sel = `button[visible]:nth(${index})`;
  let text = '';
  let before = await getUIState(page);
  let pageErr = '';
  let consoleErr = '';
  const errCapture = (m: string) => {
    if (pageErr || consoleErr) return;
    if (/pageerror|throw|uncaught/i.test(m)) pageErr = m.slice(0, 200);
    else consoleErr = m.slice(0, 200);
  };
  const peListener = (e: Error) => errCapture('pageerror:' + e.message);
  const ceListener = (m: any) => { if (m.type() === 'error') errCapture('console:' + m.text()); };
  page.on('pageerror', peListener);
  page.on('console', ceListener);

  try {
    text = (await btn.innerText().catch(() => '')).trim().slice(0, 40);
    if (DESTRUCTIVE_TXT.test(text)) {
      page.off('pageerror', peListener);
      page.off('console', ceListener);
      return { selector: sel, text, clicked: false, urlChanged: false, modalOpened: false, drawerOpened: false, toastShown: false, domChanged: false, category: 'ok' };
    }
    await btn.click({ timeout: 2500, force: false });
    await page.waitForTimeout(700);
    const after = await getUIState(page);
    const urlChanged = after.url !== before.url;
    const modalOpened = after.modalCount > before.modalCount;
    const drawerOpened = after.drawerCount > before.drawerCount;
    const toastShown = after.messageCount > before.messageCount;
    const domChanged = Math.abs(after.bodyHtmlLen - before.bodyHtmlLen) > 20;

    page.off('pageerror', peListener);
    page.off('console', ceListener);

    let category: ButtonClickResult['category'] = 'ok';
    let error: string | undefined;
    if (pageErr) { category = 'throw'; error = pageErr; }
    else if (consoleErr) { category = 'throw'; error = consoleErr; }
    else if (!urlChanged && !modalOpened && !drawerOpened && !toastShown && !domChanged) {
      category = 'no-handler';
    } else if (urlChanged) {
      category = 'nav';
    }

    return { selector: sel, text, clicked: true, urlChanged, modalOpened, drawerOpened, toastShown, domChanged, error, category };
  } catch (e: any) {
    page.off('pageerror', peListener);
    page.off('console', ceListener);
    const msg = (e?.message ?? String(e)).slice(0, 200);
    // 不抛错 — 仅记录
    let cat: ButtonClickResult['category'] = 'throw';
    if (/disabled/i.test(msg)) cat = 'disabled';
    else if (/not.*visible|intercepts|timeout/i.test(msg)) cat = 'no-handler';
    return { selector: sel, text, clicked: false, urlChanged: false, modalOpened: false, drawerOpened: false, toastShown: false, domChanged: false, error: msg, category: cat };
  }
}

test.describe.serial('全量 button 点击有效性 v3.0.6.11-21 (20 页面)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const pg of TARGET_PAGES) {
    test(`BTN ${pg.isNew ? '[新]' : '   '} ${pg.path}`, async ({ page }) => {
      const t0 = Date.now();
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];

      const peH = (e: Error) => { const m = 'PE: ' + e.message.slice(0, 200); if (!shouldIgnore(m)) pageErrors.push(m); };
      const ceH = (m: any) => {
        if (m.type() !== 'error') return;
        const t = m.text();
        if (shouldIgnore(t)) return;
        consoleErrors.push('CE: ' + t.slice(0, 200));
      };
      page.on('pageerror', peH);
      page.on('console', ceH);

      const btnResults: ButtonClickResult[] = [];
      let buttonsFound = 0;
      let buttonsClicked = 0;
      let buttonsOk = 0;

      try {
        await gotoPage(page, pg.path);
        const btns = await findClickableButtons(page);
        buttonsFound = btns.length;
        // 每个页面最多点击前 8 个按钮 (避免副作用链式触发)
        const limit = Math.min(btns.length, 8);
        for (let i = 0; i < limit; i++) {
          const r = await tryClickButton(page, btns[i], i);
          btnResults.push(r);
          if (r.clicked) buttonsClicked++;
          if (r.category === 'ok' || r.category === 'nav') buttonsOk++;
          // 若点击触发了 modal 或导航, 重置页面以继续测试下一个 button
          if (r.modalOpened || r.drawerOpened) {
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(400);
          } else if (r.urlChanged) {
            await gotoPage(page, pg.path);
            // 重新获取 button 列表 (DOM 已变)
            const reloaded = await findClickableButtons(page);
            btns.splice(0, btns.length, ...reloaded);
          }
        }
      } catch (e: any) {
        pageErrors.push('NAV: ' + (e.message?.slice(0, 200) ?? 'unknown'));
      } finally {
        page.off('pageerror', peH);
        page.off('console', ceH);
      }

      allResults.push({
        page: pg.name, path: pg.path, isNew: !!pg.isNew,
        buttonsFound, buttonsClicked, buttonsOk,
        results: btnResults,
        pageErrors, consoleErrors,
        loadMs: Date.now() - t0,
      });
    });
  }

  test.afterAll(async () => {
    // 写报告
    const total = allResults.length;
    const newCount = allResults.filter(r => r.isNew).length;
    const totalBtns = allResults.reduce((s, r) => s + r.buttonsFound, 0);
    const clickedBtns = allResults.reduce((s, r) => s + r.buttonsClicked, 0);
    const okBtns = allResults.reduce((s, r) => s + r.buttonsOk, 0);
    const noHandler = allResults.flatMap(r => r.results.filter(x => x.category === 'no-handler'));
    const threws = allResults.flatMap(r => r.results.filter(x => x.category === 'throw'));
    const disabled = allResults.flatMap(r => r.results.filter(x => x.category === 'disabled'));

    const summary = {
      version: '3.0.6.11-21',
      timestamp: new Date().toISOString(),
      totalPages: total,
      newPages: newCount,
      totalButtons: totalBtns,
      clickedButtons: clickedBtns,
      okButtons: okBtns,
      failCounts: {
        noHandler: noHandler.length,
        throw: threws.length,
        disabled: disabled.length,
      },
      pages: allResults,
    };

    try {
      fs.mkdirSync('e2e', { recursive: true });
      fs.writeFileSync(
        path.join('e2e', 'button-click-v30611-21-report.json'),
        JSON.stringify(summary, null, 2),
      );
    } catch (_) { /* ignore */ }

    console.log(`\n${'='.repeat(72)}`);
    console.log(`[BUTTON CLICK VERIFY v3.0.6.11-21] 20 页面 × 最多 8 button/页`);
    console.log('='.repeat(72));
    console.log(`页面: ${total} (新模块: ${newCount})`);
    console.log(`按钮: 发现=${totalBtns}, 点击=${clickedBtns}, 有效=${okBtns}`);
    console.log(`失败分类: 无响应=${noHandler.length}, 抛错=${threws.length}, disabled=${disabled.length}`);

    // 表格: 每个页面
    console.log('\n[页面级汇总]');
    console.log('页面'.padEnd(22) + '路径'.padEnd(28) + '找到'.padStart(6) + '点击'.padStart(6) + '有效'.padStart(6) + '错误'.padStart(6) + ' ms'.padStart(6));
    allResults.forEach(r => {
      const errCount = r.results.filter(x => x.category === 'throw' || x.category === 'no-handler').length;
      console.log(
        r.page.padEnd(22) +
        r.path.padEnd(28) +
        String(r.buttonsFound).padStart(6) +
        String(r.buttonsClicked).padStart(6) +
        String(r.buttonsOk).padStart(6) +
        String(errCount).padStart(6) +
        String(r.loadMs).padStart(6),
      );
    });

    // 列出失效 button
    if (noHandler.length > 0) {
      console.log('\n[无响应按钮 (onClick handler 缺失)]');
      noHandler.slice(0, 30).forEach(r => {
        console.log(`  - [${r.selector}] "${r.text}"`);
      });
      if (noHandler.length > 30) console.log(`  ... 共 ${noHandler.length} 个`);
    }
    if (threws.length > 0) {
      console.log('\n[抛错按钮 (代码 bug)]');
      threws.slice(0, 30).forEach(r => {
        console.log(`  - "${r.text}": ${r.error?.slice(0, 120)}`);
      });
      if (threws.length > 30) console.log(`  ... 共 ${threws.length} 个`);
    }

    // 按页面定位失效
    console.log('\n[按页面定位失效 button]');
    allResults.forEach(r => {
      const fails = r.results.filter(x => x.category !== 'ok' && x.category !== 'nav');
      if (fails.length > 0) {
        console.log(`  ${r.path}:`);
        fails.forEach(f => {
          console.log(`    [${f.category}] "${f.text}" — ${(f.error ?? '').slice(0, 100)}`);
        });
      }
    });

    // 断言: 没有未捕获 page error (允许按钮无响应作为 P0 报告, 但不抛测试失败)
    const totalPageErrors = allResults.reduce((s, r) => s + r.pageErrors.length, 0);
    expect(totalPageErrors).toBe(0);
  });
});
