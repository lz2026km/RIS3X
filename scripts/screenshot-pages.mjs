// Screenshot script: log in first, then visit each page
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://127.0.0.1:5191/g005-radiology-ris';

const PAGES = [
  { name: '01-login', path: '/login', wait: 1500 },
  { name: '02-home', path: '/', wait: 3000 },
  { name: '03-worklist', path: '/worklist', wait: 3000 },
  { name: '04-patient', path: '/patients', wait: 3000 },
  { name: '05-reports', path: '/reports', wait: 3000 },
  { name: '06-report-write', path: '/write-report', wait: 3000 },
  { name: '07-device', path: '/devices', wait: 3000 },
  { name: '08-critical', path: '/critical-value', wait: 3000 },
  { name: '09-stats', path: '/statistics', wait: 3500 },
  { name: '10-dicom', path: '/dicom-viewer', wait: 4000 },
  { name: '11-template', path: '/template-management', wait: 3000 },
  { name: '12-dictionary', path: '/dictionary', wait: 3000 },
  { name: '13-finance', path: '/accounts-receivable', wait: 3000 },
  { name: '14-appointment', path: '/appointments', wait: 3000 },
  { name: '15-ai-assist', path: '/ai-assist', wait: 3500 },
  { name: '16-cds', path: '/cds/management', wait: 3000 },
  { name: '17-quality', path: '/qc', wait: 3000 },
  { name: '18-schedule', path: '/schedule', wait: 3000 },
  { name: '19-collaboration', path: '/collaboration', wait: 3000 },
  { name: '20-eye', path: '/eye', wait: 3500 },
  { name: '21-mobile-tech', path: '/mobile/tech', wait: 3000 },
  { name: '22-oplog', path: '/operation-log', wait: 3000 },
  { name: '23-user', path: '/user-management', wait: 3000 },
  { name: '24-materials', path: '/materials', wait: 3000 },
  { name: '25-routing', path: '/routing-rules', wait: 3000 },
  { name: '26-workload', path: '/doctor-workload', wait: 3000 },
  { name: '27-print', path: '/print-management', wait: 3000 },
  { name: '28-follow-up', path: '/follow-up', wait: 3000 },
  { name: '29-cancer', path: '/cancer-screen', wait: 3000 },
  { name: '30-merge', path: '/business-continuity', wait: 3000 },
  { name: '31-report-review', path: '/report-review', wait: 3000 },
  { name: '32-report-defect', path: '/report-defect-library', wait: 3000 },
  { name: '33-report-revisions', path: '/report-revisions', wait: 3000 },
  { name: '34-distribution', path: '/report-delivery', wait: 3000 },
  { name: '35-export', path: '/report-export', wait: 3000 },
  { name: '36-finding-lib', path: '/finding-library', wait: 3000 },
  { name: '37-term-lib', path: '/term-library', wait: 3000 },
  { name: '38-template-design', path: '/template-designer', wait: 3000 },
  { name: '39-stat-report', path: '/stats-report', wait: 3000 },
  { name: '40-cost-analysis', path: '/cost-analysis', wait: 3000 },
  { name: '41-national', path: '/national-report', wait: 3000 },
  { name: '42-finance-dept', path: '/finance/department', wait: 3000 },
  { name: '43-rcm-ar', path: '/accounts-receivable', wait: 3000 },
  { name: '44-charge-items', path: '/charge-items', wait: 3000 },
  { name: '45-clinical-data', path: '/clinical-data', wait: 3000 },
  { name: '46-cloud-storage', path: '/cloud-storage', wait: 3000 },
  { name: '47-multi-site', path: '/multi-site', wait: 3000 },
  { name: '48-business-continuity', path: '/business-continuity', wait: 3000 },
  { name: '49-green-it', path: '/green-it', wait: 3000 },
  { name: '50-eye-ai', path: '/eye/ai', wait: 3000 },
  { name: '51-eye-emr', path: '/eye/emr', wait: 3000 },
  { name: '52-eye-kpi', path: '/eye/kpi-dashboard', wait: 3000 },
  { name: '53-eye-pacs', path: '/eye/pacs', wait: 3000 },
  { name: '54-ai-medical', path: '/ai-medical-device', wait: 3000 },
  { name: '55-ai-qc', path: '/ai-qc', wait: 3000 },
  { name: '56-ai-report-draft', path: '/ai-report-draft', wait: 3000 },
  { name: '57-ai-structured', path: '/ai-structured-report', wait: 3000 },
  { name: '58-blockchain', path: '/blockchain-proof', wait: 3000 },
  { name: '59-ca-signature', path: '/ca-signature', wait: 3000 },
  { name: '60-cosign', path: '/cosign', wait: 3000 },
];

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('PAGEERR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE:', m.text().slice(0, 200)); });

const summary = [];

// Step 1: go to /login and submit
console.log('=== Logging in ===');
await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
try {
  await page.click('button:has-text("登录")', { timeout: 5000 });
  await page.waitForTimeout(3000);
  console.log('  logged in, current URL:', page.url());
} catch (e) {
  console.log('  login click failed:', e.message.split('\n')[0]);
}

// Step 2: navigate to each page
for (const p of PAGES) {
  const url = BASE + p.path;
  process.stdout.write('[' + p.name + '] ' + p.path + ' ... ');
  try {
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    try { await page.waitForSelector('#root > *', { timeout: 5000 }); } catch {}
    await page.waitForTimeout(p.wait || 2000);
    const elapsed = Date.now() - t0;
    const file = path.join(OUT, p.name + '.png');
    await page.screenshot({ path: file, fullPage: false });
    const errs = await page.evaluate(() => window.__errors || []);
    const cur = page.url();
    summary.push({ name: p.name, path: p.path, ms: elapsed, errs: errs.length, url: cur });
    console.log('OK (' + elapsed + 'ms, errs=' + errs.length + ') -> ' + cur.replace(BASE, ''));
  } catch (e) {
    console.log('FAIL: ' + e.message.split('\n')[0]);
    summary.push({ name: p.name, path: p.path, error: e.message.split('\n')[0] });
  }
}

await browser.close();
fs.writeFileSync(path.join(OUT, '_summary.json'), JSON.stringify(summary, null, 2));
console.log('=== done ===');