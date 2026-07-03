// Wider screenshot pass to find UI issues
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5191/g005-radiology-ris';
const OUT = 'screenshots-wide';
fs.mkdirSync(OUT, { recursive: true });

// Pages grouped by domain for systematic inspection
const PAGES = [
  // Already seen
  { name: 'a02-home', path: '/', wait: 3000 },
  { name: 'a03-worklist', path: '/worklist', wait: 4000 },
  { name: 'a05-reports', path: '/reports', wait: 4000 },

  // Not yet inspected
  { name: 'b01-exams', path: '/exams', wait: 3000 },
  { name: 'b02-department', path: '/department', wait: 3000 },
  { name: 'b03-statistics', path: '/statistics', wait: 4000 },
  { name: 'b04-typical-cases', path: '/typical-cases', wait: 3000 },
  { name: 'b05-finding-library', path: '/finding-library', wait: 3000 },
  { name: 'b06-term-library', path: '/term-library', wait: 3000 },
  { name: 'b07-operation-log', path: '/operation-log', wait: 4000 },
  { name: 'b08-notification', path: '/notification-center', wait: 3000 },
  { name: 'b09-material', path: '/materials', wait: 3000 },
  { name: 'b10-print', path: '/print-management', wait: 3000 },
  { name: 'b11-ai-structured', path: '/ai-structured-report', wait: 3000 },
  { name: 'b12-ai-qc', path: '/ai-qc', wait: 3000 },
  { name: 'b13-ai-medical', path: '/ai-medical-device', wait: 3000 },
  { name: 'b14-cds-mgmt', path: '/cds/management', wait: 3000 },
  { name: 'b15-cds-stats', path: '/cds/statistics', wait: 3000 },
  { name: 'b16-finance-dept', path: '/finance/department', wait: 3000 },
  { name: 'b17-rcm-charge', path: '/charge-items', wait: 3000 },
  { name: 'b18-clinical-data', path: '/clinical-data', wait: 3000 },
  { name: 'b19-multi-site', path: '/multi-site', wait: 3000 },
  { name: 'b20-business-cont', path: '/business-continuity', wait: 3000 },
  { name: 'b21-green-it', path: '/green-it', wait: 3000 },
  { name: 'b22-cost-analysis', path: '/cost-analysis', wait: 3000 },
  { name: 'b23-revenue', path: '/revenue-analysis', wait: 3000 },
  { name: 'b24-insurance', path: '/insurance-audit', wait: 3000 },
  { name: 'b25-equipment-eff', path: '/equipment-efficiency', wait: 3000 },
  { name: 'b26-doctor-wl', path: '/doctor-workload', wait: 3000 },
  { name: 'b27-report-kpi', path: '/report-kpi-dashboard', wait: 3000 },
  { name: 'b28-diagnosis', path: '/diagnosis-accuracy', wait: 3000 },
  { name: 'b29-cloud-storage', path: '/cloud-storage', wait: 3000 },
  { name: 'b30-special-asm', path: '/special-assessment', wait: 3000 },
  { name: 'b31-keyword-check', path: '/keyword-check', wait: 3000 },
  { name: 'b32-template-cat', path: '/template-category', wait: 3000 },
  { name: 'b33-template-design', path: '/template-designer', wait: 3000 },
  { name: 'b34-template-inh', path: '/template-inheritance', wait: 3000 },
  { name: 'b35-template-mgmt', path: '/template-management', wait: 3000 },
  { name: 'b36-routing', path: '/routing-rules', wait: 3000 },
  { name: 'b37-sla-policy', path: '/sla-policy', wait: 3000 },
  { name: 'b38-workflow', path: '/workflow-designer', wait: 3000 },
  { name: 'b39-stats-report', path: '/stats-report', wait: 3000 },
  { name: 'b40-nat-report', path: '/national-report', wait: 3000 },
  { name: 'b41-data-rc', path: '/data-report-center', wait: 3000 },
  { name: 'b42-collab', path: '/collaboration', wait: 3000 },
  { name: 'b43-region-img', path: '/regional-imaging', wait: 3000 },
  { name: 'b44-region-rpt', path: '/regional-report', wait: 3000 },
  { name: 'b45-consult', path: '/consultation', wait: 3000 },
  { name: 'b46-finance-pt', path: '/finance/patient', wait: 3000 },
  { name: 'b47-rcm-ar', path: '/accounts-receivable', wait: 3000 },
  { name: 'b48-rcm-cost', path: '/cost-accounting', wait: 3000 },
  { name: 'b49-rcm-fin', path: '/financial-reports', wait: 3000 },
  { name: 'b50-quality-dept', path: '/quality/department', wait: 3000 },
  { name: 'b51-qc-page', path: '/qc', wait: 3000 },
  { name: 'b52-qc-image', path: '/qc-image', wait: 3000 },
  { name: 'b53-qc-dash', path: '/qc-dashboard', wait: 3000 },
  { name: 'b54-qc-radio', path: '/qc-radiologist-annual', wait: 3000 },
  { name: 'b55-quality-ctl', path: '/quality-control', wait: 3000 },
  { name: 'b56-rpt-rev', path: '/report-review', wait: 3000 },
  { name: 'b57-rpt-defect', path: '/report-defect-library', wait: 3000 },
  { name: 'b58-rpt-rev-his', path: '/report-revisions', wait: 3000 },
  { name: 'b59-rpt-delivery', path: '/report-delivery', wait: 3000 },
  { name: 'b60-rpt-export', path: '/report-export', wait: 3000 },
  { name: 'b61-rpt-phrase', path: '/report-phrase-bank', wait: 3000 },
  { name: 'b62-rpt-score', path: '/report-score-rule', wait: 3000 },
  { name: 'b63-rpt-search', path: '/report-search', wait: 3000 },
  { name: 'b64-rpt-timeliness', path: '/report-timeliness', wait: 3000 },
  { name: 'b65-dept-dash', path: '/department-dashboard', wait: 3000 },
  { name: 'b66-rpt-write', path: '/write-report', wait: 3000 },
  { name: 'b67-dose', path: '/dose-track', wait: 3000 },
  { name: 'b68-follow-up', path: '/follow-up', wait: 3000 },
  { name: 'b69-cancer', path: '/cancer-screen', wait: 3000 },
  { name: 'b70-education', path: '/education/patient-education', wait: 3000 },
  { name: 'b71-equip-life', path: '/equipment-lifecycle', wait: 3000 },
  { name: 'b72-co-sign', path: '/cosign', wait: 3000 },
  { name: 'b73-blockchain', path: '/blockchain-proof', wait: 3000 },
  { name: 'b74-ca-sign', path: '/ca-signature', wait: 3000 },
  { name: 'b75-user-mgmt', path: '/user-management', wait: 3000 },
];

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('PAGEERR:', e.message));

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
await page.click('button:has-text("登录")', { timeout: 5000 });
await page.waitForTimeout(2500);
console.log('logged in');

let ok = 0, fail = 0;
for (const p of PAGES) {
  process.stdout.write('[' + p.name + '] ' + p.path + ' ... ');
  try {
    await page.goto(BASE + p.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(p.wait);
    await page.screenshot({ path: OUT + '/' + p.name + '.png', fullPage: false });
    console.log('OK');
    ok++;
  } catch (e) {
    console.log('FAIL: ' + e.message.split('\n')[0]);
    fail++;
  }
}
await browser.close();
console.log('done: ok=' + ok + ' fail=' + fail);