// [v3.0.6.11-54] Phase 2 壳页面真实化 - 浏览器抽查
import { chromium } from 'playwright';

const BASE = 'http://localhost:5191';

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

const IGNORE = [
  'mockServiceWorker', 'X-Frame-Options', 'Content Security Policy',
  'favicon', '[HMR]', '[vite]', 'manifest.json', 'Service Worker', '[MSW]',
  'jsdom', 'gzip', 'wasm', 'cornerstone', 'WebGL', 'AudioContext',
];

const ROUTES = [
  ['/dicom-viewer-pro', 'DicomViewerPro'],
  ['/ai-cad', 'AiCadPage'],
  ['/scheduling-center', 'SchedulingCenterPage'],
  ['/audit-compliance', 'AuditCompliancePage'],
  ['/command-center', 'CommandCenterPage'],
  ['/critical-alert', 'CriticalAlertPage'],
  ['/dental', 'DentalWorkspacePage'],
  ['/dental/treatment', 'DentalTreatmentPage'],
  ['/eye', 'EyeWorkspacePage'],
  ['/v3-report-hub', 'V3ReportHubPage'],
  ['/dicom/sr-report', 'SrReportPage'],
  ['/device-fault', 'DeviceFaultPage'],
  ['/nuclear-stats', 'NuclearStatsPage'],
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((data) => {
    try { window.localStorage.setItem('ris_current_user', data.user); } catch {}
    try { window.localStorage.setItem('g005_auth', data.auth); } catch {}
  }, { user: ADMIN_USER, auth: G005_AUTH });

  const results = [];
  for (const [route, name] of ROUTES) {
    const page = await ctx.newPage();
    const errors = [];
    const badUrls = [];
    page.on('response', (res) => {
      if (res.status() >= 400) badUrls.push(`${res.status()} ${res.url().replace(BASE, '')}`);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const t = msg.text();
        if (!IGNORE.some((p) => t.includes(p))) errors.push(t);
      }
    });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    try {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3500);
      const bodyLen = (await page.evaluate(() => document.body.innerText.length)) ?? 0;
      const hasTable = await page.locator('.ant-table').count();
      const hasCard = await page.locator('.ant-card').count();
      const hasSpin = await page.locator('.ant-spin-spinning').count();
      const rendered = bodyLen > 60;
      results.push({ route, name, bodyLen, hasTable, hasCard, spinStill: hasSpin, rendered, errors, badUrls });
    } catch (e) {
      results.push({ route, name, bodyLen: 0, hasTable: 0, hasCard: 0, spinStill: 0, rendered: false, errors: ['NAVIGATION FAILED: ' + String(e instanceof Error ? e.message : e)], badUrls: [] });
    }
    await page.close();
  }
  await browser.close();

  console.log('==== Phase 2 壳页面真实化 浏览器抽查 ====');
  let pass = 0;
  for (const r of results) {
    const errs = r.errors.filter((e) => !e.includes('404'));
    const ok = r.rendered && errs.length === 0;
    if (ok) pass++;
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${r.name.padEnd(22)} | bodyLen=${String(r.bodyLen).padStart(5)} | cards=${r.hasCard} tables=${r.hasTable} spin=${r.spinStill}`);
    if (r.badUrls && r.badUrls.length > 0) {
      const unique = [...new Set(r.badUrls)].slice(0, 6);
      for (const u of unique) console.log(`      http: ${u}`);
    }
    if (!ok) {
      console.log(`      errors:`);
      for (const e of errs.slice(0, 6)) console.log(`      - ${e.slice(0, 220)}`);
    }
  }
  console.log(`==== ${pass}/${results.length} 通过 ====`);
}

main().catch((e) => { console.error(e); process.exit(1); });
