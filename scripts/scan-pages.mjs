import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5191/g005-radiology-ris';
const OUT = 'screenshots-fix/wide-2026-07-02';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const allErrs = [];
page.on('pageerror', e => allErrs.push('PAGEERR: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/frame-ancestors|X-Frame-Options/.test(m.text())) allErrs.push('CONSOLE: ' + m.text().slice(0, 200)); });

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);
try { await page.click('button:has-text("登录")', { timeout: 5000 }); } catch {}
await page.waitForTimeout(2000);

// 找 sidebar 所有路由
const links = await page.$$eval('aside a, nav a, [class*=sidebar] a', els => [...new Set(els.map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim().slice(0, 30) })))]).catch(() => []);
console.log('sidebar links:', links.length);

// 收集主要路由
const routes = [
  '/', '/worklist', '/reports', '/write-report', '/patients', '/appointments', '/dicom-viewer',
  '/statistics', '/quality', '/ai-assist', '/critical', '/template-management',
  '/devices', '/materials', '/billing', '/schedule', '/dictionary',
  '/doctor-workstation', '/tech-workstation', '/admin', '/settings',
  '/fhir', '/hl7', '/xds', '/dicom-sr', '/dose-track',
  '/integration', '/webhooks', '/insurance-audit', '/patient-portal',
  '/federated-learning', '/biomarker', '/multimodal',
  '/disaster-recovery', '/compliance', '/research', '/ehr',
  '/rcm', '/cds', '/cosign', '/sign-amend',
  '/system-health', '/audit-log', '/roles', '/permissions',
  '/dental', '/eye', '/dental-ai-onnx', '/dental-cad-cam',
  '/dental-implant', '/dental-implant-3d', '/dental-guide',
  '/dental-ceph', '/dental-aligner', '/dental-volume',
  '/dental-emr', '/dental-billing', '/dental-sched',
  '/dental-ai', '/dental-photo', '/dental-workbench',
  '/cataract', '/refractive', '/glaucoma', '/retina', '/ocular-oncology',
  '/eye-exam', '/eye-prescription', '/eye-ipl', '/eye-iol',
  '/eye-contact-lens', '/eye-tryon',
];

console.log('=== scanning', routes.length, 'routes ===');
const results = [];
for (const r of routes) {
  try {
    await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const url = page.url();
    const finalPath = url.replace(BASE, '');
    const titles = await page.locator('h1, h2, h3, .ant-typography').allInnerTexts().catch(() => []);
    const rawKeys = titles.filter(t => /^[a-z][a-zA-Z0-9_.]+$/.test(t.trim()));
    const status = url === BASE + r ? 'ok' : (url === BASE + '/' ? 'redirect-home' : 'redirect-other');
    results.push({ route: r, status, final: finalPath, rawKeys: rawKeys.slice(0, 5), firstTitle: titles[0]?.slice(0, 50) });
  } catch (e) {
    results.push({ route: r, status: 'err', error: e.message.slice(0, 100) });
  }
}

const summary = {
  total: results.length,
  ok: results.filter(r => r.status === 'ok').length,
  redirectHome: results.filter(r => r.status === 'redirect-home').length,
  redirectOther: results.filter(r => r.status === 'redirect-other').length,
  err: results.filter(r => r.status === 'err').length,
  withRawKeys: results.filter(r => r.rawKeys && r.rawKeys.length > 0).length,
};
console.log('=== summary ===');
console.log(JSON.stringify(summary, null, 2));
console.log('=== with raw i18n keys (still bug) ===');
results.filter(r => r.rawKeys && r.rawKeys.length > 0).forEach(r => {
  console.log(' ', r.route, '->', r.rawKeys.slice(0, 3).join(', '));
});
console.log('=== redirect-home (not landing) ===');
results.filter(r => r.status === 'redirect-home').forEach(r => {
  console.log(' ', r.route);
});
console.log('=== err ===');
results.filter(r => r.status === 'err').forEach(r => {
  console.log(' ', r.route, '->', r.error);
});
console.log('=== ERRORS (unique first 20) ===');
[...new Set(allErrs)].slice(0, 20).forEach(e => console.log(' -', e.slice(0, 200)));

fs.writeFileSync('screenshots-fix/wide-2026-07-02/scan.json', JSON.stringify({summary, results, errs: [...new Set(allErrs)]}, null, 2));
await browser.close();
