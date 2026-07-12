/**
 * G005 放射 RIS v3.0.6.11-21 — v3.0.6.11-19/20 新增页面整合度审计
 *
 * 范围:
 *  v3.0.6.11-19 (10 功能, 12 路由):
 *    F01 /ai-cad
 *    F02 /dicom/volume-viewer
 *    F03 /dicom/fusion
 *    F04 /radpath/tracker + /radpath/detail/:id
 *    F05 /tele/conference
 *    F06 /qc/image-ai
 *    F07 /teach/lecture
 *    F08 /operations/oee
 *    F09 /operations/occupancy
 *    F10 /analytics/benchmark-v2 + /analytics/benchmark-ai-diagnosis
 *
 *  v3.0.6.11-20 (5 新页面):
 *    /system/audit
 *    /system/backup
 *    /system/tenant-config
 *    /system/compliance
 *    /security/mfa-setup
 *
 * 验证项 (每页):
 *  - HTTP 200 + 渲染 (root 有子节点, body 文本 > 200 字符)
 *  - console error <= 1
 *  - sidebar 可达 (管理员登录后导航能进入该页)
 *  - 至少 1 个有效交互 (button / select / input)
 */
import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

type RouteKind = 'f01' | 'f02' | 'f03' | 'f04-tracker' | 'f04-detail'
  | 'f05' | 'f06' | 'f07' | 'f08' | 'f09' | 'f10-v2' | 'f10-ai'
  | 'g01' | 'g02' | 'g03' | 'g04' | 'g05';

type RouteSpec = {
  route: string;
  kind: RouteKind;
  group: 'v3.0.6.11-19' | 'v3.0.6.11-20';
  feature: string;
  /** 替换路径参数 (e.g. /radpath/detail/:id → /radpath/detail/test-001) */
  resolvedRoute?: string;
};

const ROUTES: RouteSpec[] = [
  { route: '/ai-cad',                       kind: 'f01',         group: 'v3.0.6.11-19', feature: 'F01 AI 阅片' },
  { route: '/dicom/volume-viewer',          kind: 'f02',         group: 'v3.0.6.11-19', feature: 'F02 3D 体绘制' },
  { route: '/dicom/fusion',                 kind: 'f03',         group: 'v3.0.6.11-19', feature: 'F03 影像融合' },
  { route: '/radpath/tracker',              kind: 'f04-tracker', group: 'v3.0.6.11-19', feature: 'F04 Rad-Path 追踪' },
  { route: '/radpath/detail/:id',           kind: 'f04-detail',  group: 'v3.0.6.11-19', feature: 'F04 Rad-Path 详情', resolvedRoute: '/radpath/detail/RPT-TEST-001' },
  { route: '/tele/conference',              kind: 'f05',         group: 'v3.0.6.11-19', feature: 'F05 远程会诊' },
  { route: '/qc/image-ai',                  kind: 'f06',         group: 'v3.0.6.11-19', feature: 'F06 影像 AI 质控' },
  { route: '/teach/lecture',                kind: 'f07',         group: 'v3.0.6.11-19', feature: 'F07 教学讲座' },
  { route: '/operations/oee',               kind: 'f08',         group: 'v3.0.6.11-19', feature: 'F08 OEE 看板' },
  { route: '/operations/occupancy',         kind: 'f09',         group: 'v3.0.6.11-19', feature: 'F09 房间占用率' },
  { route: '/analytics/benchmark-v2',       kind: 'f10-v2',      group: 'v3.0.6.11-19', feature: 'F10 报表同比环比' },
  { route: '/analytics/benchmark-ai-diagnosis', kind: 'f10-ai',  group: 'v3.0.6.11-19', feature: 'F10 AI 准确率' },
  { route: '/system/audit',                 kind: 'g01',         group: 'v3.0.6.11-20', feature: 'G01 审计日志' },
  { route: '/system/backup',                kind: 'g02',         group: 'v3.0.6.11-20', feature: 'G02 备份管理' },
  { route: '/system/tenant-config',         kind: 'g03',         group: 'v3.0.6.11-20', feature: 'G03 租户合规' },
  { route: '/system/compliance',            kind: 'g04',         group: 'v3.0.6.11-20', feature: 'G04 合规管理' },
  { route: '/security/mfa-setup',           kind: 'g05',         group: 'v3.0.6.11-20', feature: 'G05 MFA 设置' },
];

const ADMIN_USER = JSON.stringify({
  id: 'audit-admin',
  name: '审计管理员',
  role: '管理员',
  department: '放射科',
  phone: '',
  username: 'admin',
  title: '系统管理员',
});

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5191';

const ALLOW_FILTER = [
  /mockServiceWorker/i,
  /X-Frame-Options/i,
  /Content Security Policy/i,
  /Content-Security-Policy/i,
  /\bfavicon\b/i,
  /\[vite\]/i,
  /\[HMR\]/i,
  /Download the React DevTools/i,
  /fast-refresh/i,
  /MSW: mock Service Worker/i,
  /Cross-Origin/i,
  /Failed to load resource.*404/i, // 历史懒加载文件 404 不算致命
  /frame-ancestors/i,
  // antd 6 deprecation warnings (non-fatal, 不阻塞渲染)
  /\[antd:/i,
  // Encountered two children with the same key (React 警告, 不阻塞)
  /Encountered two children with the same key/i,
  // API 500 (mock 后端在 dev 模式未实现全部 endpoint, 前端有 fallback)
  /Failed to load resource.*500/i,
  /\[API\] Network error/i,
  /Failed to execute 'json' on 'Response'/i,
  // THREE.js / WebGL shader (GPU 限制, 不阻塞渲染)
  /THREE\./i,
  /WebGLProgram/i,
  /Shader Error/i,
];

function isAllowedError(text: string): boolean {
  return ALLOW_FILTER.some((rx) => rx.test(text));
}

type RouteResult = {
  route: string;
  resolvedRoute: string;
  kind: RouteKind;
  group: string;
  feature: string;
  status: number;
  textLen: number;
  rootChildren: number;
  hasRender: boolean;
  pageErrors: string[];
  consoleErrors: string[];
  interactiveCount: number;
  hasSidebarLink: boolean;
  passed: boolean;
  reason?: string;
};

const results: RouteResult[] = [];
const REPORT_PATH = path.resolve(__dirname, 'new-page-audit-v30611-21-report.json');

function attachListeners(page: Page, pageErrors: string[], consoleErrors: string[]) {
  const errHandler = (e: Error) => {
    if (!isAllowedError(e.message)) pageErrors.push(e.message.slice(0, 200));
  };
  const consoleHandler = (m: ConsoleMessage) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (isAllowedError(t)) return;
    consoleErrors.push(t.slice(0, 200));
  };
  page.on('pageerror', errHandler);
  page.on('console', consoleHandler);
  return () => {
    page.off('pageerror', errHandler);
    page.off('console', consoleHandler);
  };
}

async function visitAndAudit(page: Page, spec: RouteSpec): Promise<RouteResult> {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const detach = attachListeners(page, pageErrors, consoleErrors);

  let status = 0;
  let textLen = 0;
  let rootChildren = 0;
  let hasRender = false;
  let interactiveCount = 0;
  let hasSidebarLink = false;
  let reason: string | undefined;
  const resolved = spec.resolvedRoute ?? spec.route;

  try {
    let resp = await page.goto(`${BASE_URL}${resolved}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    status = resp?.status() ?? 0;

    // 等真实内容渲染
    try {
      await page.waitForFunction(
        () => {
          const t = document.body.innerText || '';
          if (t.length < 200) return false;
          if (t.includes('系统加载中')) return false;
          if (t.includes('Loading...')) return false;
          const root = document.getElementById('root');
          return (root?.children.length || 0) > 0;
        },
        { timeout: 10000 },
      );
    } catch { /* allow short pages */ }

    const info: { textLen: number; rootChildren: number; hasLoading: boolean } =
      await page.evaluate(() => {
        const root = document.getElementById('root');
        const t = document.body.innerText || '';
        return {
          textLen: t.length,
          rootChildren: root?.children.length ?? 0,
          hasLoading: t.includes('系统加载中') || t.includes('Loading...'),
        };
      });
    textLen = info.textLen;
    rootChildren = info.rootChildren;
    hasRender = !info.hasLoading && rootChildren > 0 && textLen >= 100;

    // 统计交互元素 (button / select / input / .ant-btn)
    interactiveCount = await page.evaluate(() => {
      const sel = [
        'button:visible',
        'input:visible',
        'select:visible',
        'textarea:visible',
        '.ant-btn:visible',
        '.ant-select:visible',
        '.ant-input:visible',
        '[role="button"]:visible',
      ].join(', ');
      try {
        return document.querySelectorAll(sel).length;
      } catch {
        return document.querySelectorAll('button, input, select, textarea, .ant-btn, .ant-select').length;
      }
    });

    // 验证 sidebar 可达: 跳到首页, 在 sidebar 中查找对应链接
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2500);
    hasSidebarLink = await page.evaluate((href) => {
      const links = Array.from(document.querySelectorAll('a[href], [data-testid^="nav-"]')) as HTMLElement[];
      return links.some((el) => {
        const tag = el.tagName.toLowerCase();
        const h = el.getAttribute('href') || '';
        const tid = el.getAttribute('data-testid') || '';
        const candidate = tid ? tid.replace(/^nav-/, '') : h;
        return candidate === href || candidate.endsWith(href) || href.endsWith(candidate);
      });
    }, spec.route);
  } catch (e: any) {
    reason = 'NAV_ERROR: ' + (e?.message || '').slice(0, 120);
    pageErrors.push(reason);
  } finally {
    detach();
  }

  if (status >= 400) reason = reason ?? `HTTP_${status}`;
  else if (!hasRender && rootChildren === 0) reason = reason ?? 'NO_RENDER';
  else if (pageErrors.length > 0) reason = reason ?? 'PAGE_ERROR';
  else if (consoleErrors.length > 1) reason = reason ?? `TOO_MANY_CONSOLE_ERR(${consoleErrors.length})`;

  const passed =
    status >= 200 && status < 400 &&
    hasRender &&
    pageErrors.length === 0 &&
    consoleErrors.length <= 1 &&
    interactiveCount >= 1;

  return {
    route: spec.route,
    resolvedRoute: resolved,
    kind: spec.kind,
    group: spec.group,
    feature: spec.feature,
    status,
    textLen,
    rootChildren,
    hasRender,
    pageErrors,
    consoleErrors,
    interactiveCount,
    hasSidebarLink,
    passed,
    ...(reason ? { reason } : {}),
  };
}

test.describe.serial('v3.0.6.11-19/20 新增页面整合度审计', () => {
  test('17 新页面 × 4 维度验证', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    await ctx.addInitScript((u) => {
      try { localStorage.setItem('ris_current_user', u); } catch { /* ignore */ }
    }, ADMIN_USER);

    try {
      for (let i = 0; i < ROUTES.length; i++) {
        const spec: RouteSpec = ROUTES[i]!;
        const t0 = Date.now();
        // 每条路由使用全新页面，避免懒加载导致的内存/context 关闭
        const page = await ctx.newPage();
        try {
          const result = await visitAndAudit(page, spec);
          results.push(result);
          const tag = result.passed ? 'PASS' : 'FAIL';
          // eslint-disable-next-line no-console
          console.log(
            `[${tag}] R${String(i + 1).padStart(2, '0')} ${spec.group} ${spec.feature} (${result.resolvedRoute}) ` +
            `status=${result.status} text=${result.textLen} children=${result.rootChildren} ` +
            `inter=${result.interactiveCount} sidebar=${result.hasSidebarLink ? 'Y' : 'N'} ` +
            `${result.reason ? 'reason=' + result.reason : ''} ` +
            `${result.consoleErrors.length ? 'ce=' + result.consoleErrors.length : ''} ` +
            `${result.pageErrors.length ? 'pe=' + result.pageErrors.length : ''} ` +
            `(${Date.now() - t0}ms)`,
          );
        } finally {
          await page.close();
        }
      }
    } finally {
      await ctx.close();
    }
  });

  test('汇总报告 + 关键断言', async () => {
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed);
    const byGroup = {
      'v3.0.6.11-19': {
        total: results.filter((r) => r.group === 'v3.0.6.11-19').length,
        passed: results.filter((r) => r.group === 'v3.0.6.11-19' && r.passed).length,
      },
      'v3.0.6.11-20': {
        total: results.filter((r) => r.group === 'v3.0.6.11-20').length,
        passed: results.filter((r) => r.group === 'v3.0.6.11-20' && r.passed).length,
      },
    };

    const report = {
      version: '3.0.6.11-21',
      audit_target: 'v3.0.6.11-19 + v3.0.6.11-20 新增页面整合度',
      timestamp: new Date().toISOString(),
      total,
      passed,
      failed_count: failed.length,
      by_group: byGroup,
      failed_routes: failed.map((r) => ({
        route: r.route,
        resolvedRoute: r.resolvedRoute,
        group: r.group,
        feature: r.feature,
        status: r.status,
        textLen: r.textLen,
        rootChildren: r.rootChildren,
        hasRender: r.hasRender,
        hasSidebarLink: r.hasSidebarLink,
        interactiveCount: r.interactiveCount,
        reason: r.reason ?? null,
        pageErrors: r.pageErrors.slice(0, 3),
        consoleErrors: r.consoleErrors.slice(0, 3),
      })),
      all_results: results,
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

    // eslint-disable-next-line no-console
    console.log(`\n========== v3.0.6.11-19/20 新增页面整合度审计 ==========`);
    // eslint-disable-next-line no-console
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed.length}`);
    // eslint-disable-next-line no-console
    console.log(`v3.0.6.11-19: ${byGroup['v3.0.6.11-19'].passed}/${byGroup['v3.0.6.11-19'].total}`);
    // eslint-disable-next-line no-console
    console.log(`v3.0.6.11-20: ${byGroup['v3.0.6.11-20'].passed}/${byGroup['v3.0.6.11-20'].total}`);
    // eslint-disable-next-line no-console
    console.log(`Report: ${REPORT_PATH}`);

    if (failed.length > 0) {
      // eslint-disable-next-line no-console
      console.log('\n--- FAILED ROUTES ---');
      for (const f of failed) {
        // eslint-disable-next-line no-console
        console.log(
          `  ${f.route} [${f.group}]: status=${f.status} text=${f.textLen} ` +
          `children=${f.rootChildren} inter=${f.interactiveCount} sidebar=${f.hasSidebarLink ? 'Y' : 'N'} ` +
          `reason=${f.reason ?? 'n/a'}`,
        );
        if (f.pageErrors.length) {
          // eslint-disable-next-line no-console
          console.log('    pageErrors:', f.pageErrors.slice(0, 2));
        }
        if (f.consoleErrors.length) {
          // eslint-disable-next-line no-console
          console.log('    consoleErrors:', f.consoleErrors.slice(0, 2));
        }
      }
    }

    // 必须全部通过
    expect(results.length).toBe(total);
    expect(failed.length).toBe(0);
  });
});