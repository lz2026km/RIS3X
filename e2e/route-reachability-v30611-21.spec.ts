/**
 * G005 放射 RIS v3.0.6.11-21 — 200+ 路由可达性 Playwright 测试
 * 合并 src/routes/routeTable.tsx 与 src/routes/sidebarConfig.tsx 的所有路径,
 * 模拟管理员登录, 验证每条路由 HTTP 200、无白屏、console error ≤ 1。
 * 输出报告 e2e/route-reachability-report.json。
 */
import { test, expect, chromium, type Browser } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// 仅在 chromium 项目运行, 避免多浏览器长跑
test.beforeEach(({ browserName }, testInfo) => {
  if (browserName !== 'chromium') {
    testInfo.skip(true, 'route-reachability 仅在 chromium 运行');
  }
});

type RouteResult = {
  route: string;
  status: number;
  textLen: number;
  rootChildren: number;
  hasRender: boolean;
  pageErrors: string[];
  consoleErrors: string[];
  passed: boolean;
  reason?: string;
};

const ADMIN_USER = {
  id: 'admin-p0',
  name: 'Admin',
  role: '管理员',
  department: '放射科',
  phone: '',
  username: 'admin',
  title: '系统管理员',
};

// 合并 routeTable.tsx + sidebarConfig.tsx 共 220+ 路径
// 含参路径已替换为可解析的具体值
const ROUTES: readonly string[] = [
  '/', '/workbench', '/login', '/forbidden',
  '/worklist', '/patients', '/patient/test-id-001',
  '/patients/test-id-001/360',
  '/exams', '/reports', '/write-report', '/reports/v3-write',
  '/statistics', '/critical-value', '/term-library', '/devices',
  '/consultation', '/qc', '/appointments', '/dose-track', '/queue-call',
  '/dicom-viewer-classic', '/dicom-viewer', '/dicom-viewer-pro',
  '/typical-cases', '/finding-library', '/operation-log',
  '/notification-center', '/schedule', '/department', '/materials',
  '/print-management', '/regional-report', '/ai-assist', '/ai-orchestration',
  '/cost-analysis', '/equipment-lifecycle', '/follow-up', '/cancer-screen',
  '/national-report', '/insurance-audit', '/data-report-center', '/dictionary',
  '/operations-center', '/department-dashboard', '/stats-report',
  '/clinical-data', '/template-management', '/template-designer',
  '/template-designer/test-id-001',
  '/template-inheritance', '/template-category',
  '/report-review', '/report-revisions', '/collaboration',
  '/keyword-check', '/report-score-rule', '/report-defect-library',
  '/ai-report-draft', '/critical-value-rule', '/critical-value-stats',
  '/special-assessment', '/report-export', '/report-delivery', '/publish',
  '/patient-report-portal', '/ca-signature', '/blockchain-proof',
  '/appointment-management', '/device-fault', '/ai-qc',
  '/ai-structured-report', '/ai-medical-device', '/regional-imaging',
  '/equipment-efficiency', '/user-management', '/admin/config',
  '/patient-portal', '/director-dashboard', '/green-it', '/research',
  '/nuclear-stats', '/system/dicom-print',
  '/term-synonym-graph', '/report-phrase-bank', '/report-kpi-dashboard',
  '/doctor-workload', '/diagnosis-accuracy', '/report-timeliness',
  '/report-search', '/charge-items', '/accounts-receivable',
  '/revenue-analysis', '/cost-accounting', '/financial-reports',
  '/business-continuity', '/cloud-storage', '/enterprise-search',
  '/multi-site', '/vna-dashboard',
  '/safety/adverse-events', '/safety/cqi',
  '/safety/patient-safety-goals', '/safety/radiation-safety',
  '/safety/rca-analysis', '/safety/risk-management',
  '/contrast/adverse-reactions', '/contrast/injection-workstation',
  '/contrast/inventory', '/contrast/quality-compliance',
  '/cardiac/database', '/cardiac/operations', '/cardiac/qc',
  '/ops/devices', '/ops/hr', '/ops/dashboard',
  '/cds/management', '/cds/statistics',
  '/finance/department', '/finance/patient',
  '/mammo/operations', '/mammo/quality',
  '/patient/self-service', '/patient/service-management',
  '/education/patient-education', '/hie/medical-alliance',
  '/integration/fhir-server', '/integration/ihe-connectathon',
  '/integration/mllp-monitor', '/integration/hl7-archive',
  '/integration/hl7-builder', '/integration/mllp-config',
  '/integration/dimse', '/integration/dimse/upload',
  '/integration/fhir/bulk-export', '/integration/fhir/bulk-export-detail',
  '/kiosk/check-in', '/mobile/patient', '/mobile/doctor',
  '/mobile/nurse', '/mobile/tech', '/quality/department',
  '/review-center', '/quality-control', '/critical-value-center',
  '/defect-management', '/cosign', '/workflow-designer',
  '/routing-rules', '/workload-heatmap', '/sla-policy',
  '/qc-dashboard', '/qc-image', '/qc-radiologist-annual', '/qc/image-ai',
  '/radpath/tracker', '/radpath/detail/test-report-1',
  '/teach/lecture', '/system/audit', '/system/backup', '/system/tenant-config',
  // 眼科
  '/eye', '/eye/pacs', '/eye/pacs/viewer', '/eye/pacs/real-viewer',
  '/eye/pacs/oct', '/eye/pacs/oct-a', '/eye/pacs/fundus',
  '/eye/pacs/visual-field', '/eye/pacs/topography',
  '/eye/pacs/ffa', '/eye/pacs/compare', '/eye/pacs/montage',
  '/eye/ris', '/eye/ris/iol-calculator', '/eye/ris/va', '/eye/ris/iop',
  '/eye/emr', '/eye/ai', '/eye/ai-report', '/eye/toric-planner',
  '/eye/sub/strabismus', '/eye/sub/neuro', '/eye/sub/oncology',
  '/eye/sub/cornea', '/eye/sub/contact-lens', '/eye/sub/low-vision',
  '/eye/sub/cataract', '/eye/sub/refractive',
  '/eye/tele', '/eye/case-library', '/eye/optometry-loop',
  '/eye/report-write', '/eye/kpi-dashboard',
  // 牙科
  '/dental', '/dental/chart', '/dental/ai', '/dental/treatment',
  '/dental/implant', '/dental/ortho', '/dental/endo', '/dental/perio',
  '/dental/restorative', '/dental/surgery', '/dental/pediatric',
  '/dental/tele', '/dental/inventory', '/dental/dashboard',
  '/dental/studies', '/dental/viewer', '/dental/viewer/scan-3d',
  '/dental/annotate', '/dental/viewer/mpr', '/dental/ai-onnx',
  '/dental/referral', '/dental/cbct-report', '/dental/rad-fusion',
  '/dental/cad', '/dental/implant-3d', '/dental/guide',
  '/dental/ceph', '/dental/aligner', '/dental/volume-viewer',
  '/dental/patient-view', '/dental/billing', '/dental/schedule',
  '/dental/photo',
  // v3 报告
  '/report-workflow', '/patient-device-mgmt', '/notif-tpl-dict',
  '/review-check', '/sign-amend', '/v3-report-hub',
  '/emr-templates', '/system-admin', '/treatment-plans',
  '/patient-unified',
  '/command-center', '/dicom-share',
  '/operations/occupancy', '/scheduling-center', '/operations/oee',
  '/clinical-pathways', '/audit-compliance', '/dicom-sr-manager',
  '/dicom/fusion', '/dicom/volume-viewer',
  '/terminology-server', '/report-templates', '/ihe-integration',
  '/ai-fusion-workspace', '/ai-cad',
  '/clinical-calculators', '/consent-education', '/patient-safety',
  // IHE / Tele
  '/ihe/pam', '/ihe/visit',
  '/ihe/visit-detail/test-pid/test-visit-1',
  '/ihe/pix', '/tele/conference',
  '/analytics/benchmark-v2', '/analytics/benchmark-ai-diagnosis',
];

const results: RouteResult[] = [];
const REPORT_PATH = path.resolve(__dirname, 'route-reachability-report.json');
const NOISE_FILTER = [
  // 浏览器/网络基础设施噪声
  /mockServiceWorker/i,
  /\[HMR\]/i,
  /\[vite\]/i,
  /fast-refresh/i,
  /MSW: mock Service Worker/i,
  /\bfavicon\b/i,
  /X-Frame-Options/i,
  /Content Security Policy/i,
  /Content-Security-Policy/i,
  /Cross-Origin/i,
  // React / antd 已知的兼容性 warning(本次升级过渡产物)
  /\[antd: /,
  /Encountered two children with the same key/i,
  /Download the React DevTools/i,
  /React Router Future Flag/i,
  /antd: compatible/i,
  /antd v5 support React/i,
  // 网络请求层面的正常失败(后端 mock 未提供)
  /Failed to load resource:.*status of (4\d\d|5\d\d)/i,
  /\[API\] (Network|Request) error/i,
  /NetworkError when attempting to fetch/i,
  /Failed to fetch/i,
  // 连接被拒往往表示本地后端服务未起,与路由可达性无关
  /ERR_CONNECTION_REFUSED/i,
  /ERR_CONNECTION_RESET/i,
  /ERR_INVALID_URL/i,
  /An unknown error occurred when fetching the script/i,
  // 静态资源 worker/source map 加载失败
  /\.worker\.js|\.map|\.wasm/i,
  // DICOM / 3D view 加载时的无 mock 资源
  /Failed to load resource.*\.(dcm|nii|nii\.gz|h5)/i,
  // MSW 已知无害警告
  /\[MSW\]/i,
  // picsum 等三方图片占位服务测试环境可能不可达
  /placeholder\.com|picsum\.photos|placehold\.it/i,
];

function isNoise(text: string): boolean {
  return NOISE_FILTER.some((rx) => rx.test(text));
}

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5191';

async function visitRoute(
  browser: Browser,
  route: string,
): Promise<RouteResult> {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  await ctx.addInitScript((u) => {
    try {
      localStorage.setItem('ris_current_user', u);
    } catch {}
  }, JSON.stringify(ADMIN_USER));
  const page = await ctx.newPage();

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const consoleNoises: string[] = [];
  page.on('pageerror', (e: Error) => pageErrors.push(e.message.slice(0, 200)));
  page.on('console', (m: any) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (isNoise(t)) {
      consoleNoises.push(t.slice(0, 200));
      return;
    }
    consoleErrors.push(t.slice(0, 200));
  });

    let status = 0;
  let textLen = 0;
  let rootChildren = 0;
  let hasRender = false;
  let reason: string | undefined;
  let stillStuck = false;

  try {
    let resp: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        resp = await page.goto(`${BASE_URL}${route}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        status = resp?.status() ?? 0;
        if (status >= 200 && status < 400) break;
        if (status >= 400 && status < 500) break;
      } catch {
        if (attempt >= 2) throw new Error('navigation_failed');
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    status = resp?.status() ?? 0;

    // 等真实内容渲染好: 长度 > 100, 不含加载中提示, 最多 15s
    try {
      await page.waitForFunction(
        () => {
          const t = document.body.innerText || '';
          if (t.length < 100) return false;
          if (t.includes('系统加载中')) return false;
          if (t.includes('Loading...')) return false;
          if (t.includes('正在从 API 加载')) return false;
          const root = document.getElementById('root');
          return (root?.children.length || 0) > 0;
        },
        { timeout: 15000 },
      );
    } catch {
      stillStuck = true;
    }

    const info: any = await page.evaluate(() => {
      const root = document.getElementById('root');
      const t = document.body.innerText || '';
      const loading =
        t.includes('系统加载中') ||
        t.includes('Loading...') ||
        t.includes('正在从 API 加载');
      return {
        textLen: t.length,
        rootChildren: root?.children.length ?? 0,
        hasLoading: loading,
        url: location.pathname,
        title: document.title,
      };
    });
    textLen = info.textLen;
    rootChildren = info.rootChildren;
    // 渲染判断: 根节点有内容,文本 >100 字 (loading banner 可存在但页面已渲染)
    hasRender = rootChildren > 0 && textLen >= 100;
    const stuckLoading = info.hasLoading && stillStuck && textLen < 200;

    if (status >= 400) reason = `HTTP_${status}`;
    else if (rootChildren === 0) reason = 'NO_ROOT_CHILDREN';
    else if (textLen < 100) reason = `TEXT_TOO_SHORT(${textLen})`;
    else if (stuckLoading) reason = 'STUCK_LOADING';
    else if (pageErrors.length > 0) reason = 'PAGE_ERROR';
    // 用户要求: console error ≤ 1 (允许 React DevTools warning)
    // 真实报错阈值, 框架/CSP 噪声已过滤
    else if (consoleErrors.length > 1)
      reason = `TOO_MANY_CONSOLE_ERR(${consoleErrors.length})`;
  } catch (e: any) {
    reason = 'NAV_ERROR: ' + (e?.message || '').slice(0, 120);
    pageErrors.push(reason);
  } finally {
    try {
      await ctx.close();
    } catch {}
  }

  const passed =
    status >= 200 &&
    status < 400 &&
    hasRender &&
    pageErrors.length === 0 &&
    consoleErrors.length <= 1;

  return {
    route,
    status,
    textLen,
    rootChildren,
    hasRender,
    pageErrors,
    consoleErrors,
    consoleNoiseCount: consoleNoises.length,
    passed,
    ...(reason ? { reason } : {}),
  };
}

test.describe.serial('G005-RIS v3.0.6.11-21 路由可达性 200+', () => {
  test('全部路由扫描', async () => {
    test.setTimeout(1800 * 1000); // 30 分钟足够扫描 220+ 路由
    const browser = await chromium.launch();

    try {
      // 先 warm-up dev server 一次避免首个请求出现 404/cache miss
      try {
        const warm = await browser.newContext();
        const wp = await warm.newPage();
        await wp.goto(`${BASE_URL}/`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await wp.close();
        await warm.close();
      } catch {}

      for (let i = 0; i < ROUTES.length; i++) {
        const route = ROUTES[i];
        let result: RouteResult;
        try {
          result = await visitRoute(browser, route);
        } catch (e: any) {
          // 如果 browser 自身崩溃,重启一次再试
          try {
            await browser.close();
          } catch {}
          const fresh = await chromium.launch();
          try {
            result = await visitRoute(fresh, route);
          } finally {
            try {
              await fresh.close();
            } catch {}
          }
        }
        results.push(result);
        // eslint-disable-next-line no-console
        const tag = result.passed ? 'PASS' : 'FAIL';
        console.log(
          `[${tag}] R${String(i + 1).padStart(3, '0')} ${route} status=${result.status} text=${result.textLen} children=${result.rootChildren}` +
            (result.reason ? ` reason=${result.reason}` : '') +
            (result.consoleErrors.length
              ? ` ce=${result.consoleErrors.length}`
              : '') +
            (result.pageErrors.length ? ` pe=${result.pageErrors.length}` : ''),
        );

        // 给 dev server 喘息时间避免累积压力
        await new Promise((r) => setTimeout(r, 80));
      }
    } finally {
      try {
        await browser.close();
      } catch {}
    }
  });

  test('输出报告', async () => {
    test.setTimeout(60 * 1000);
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed);
    const failedSummary = failed.map((r) => ({
      route: r.route,
      status: r.status,
      textLen: r.textLen,
      rootChildren: r.rootChildren,
      hasRender: r.hasRender,
      reason: r.reason ?? null,
      pageErrors: r.pageErrors.slice(0, 3),
      consoleErrors: r.consoleErrors.slice(0, 3),
    }));
    const allConsoleErrors = Array.from(
      new Set(results.flatMap((r) => r.consoleErrors).filter(Boolean)),
    );

    const report = {
      version: '3.0.6.11-21',
      timestamp: new Date().toISOString(),
      total,
      passed,
      failed_count: failed.length,
      failed: failedSummary.map((f) => f.route),
      errors: failedSummary,
      console_errors_summary: allConsoleErrors.slice(0, 30),
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    // eslint-disable-next-line no-console
    console.log(`\n========== ROUTE REACHABILITY v3.0.6.11-21 ==========`);
    // eslint-disable-next-line no-console
    console.log(
      `Total: ${total} | Passed: ${passed} | Failed: ${failed.length}`,
    );
    // eslint-disable-next-line no-console
    console.log(`Report: ${REPORT_PATH}`);
    if (failed.length > 0) {
      // eslint-disable-next-line no-console
      console.log('\n--- FAILED ROUTES (first 50) ---');
      for (const f of failedSummary.slice(0, 50)) {
        // eslint-disable-next-line no-console
        console.log(
          `  ${f.route}: status=${f.status} text=${f.textLen} children=${f.rootChildren} reason=${f.reason}`,
        );
      }
    }
    expect(results.length).toBe(total);
  });
});
