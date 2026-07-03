// Screenshot fix verification with domcontentloaded
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5191/g005-radiology-ris';
const OUT = 'screenshots-fix';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('PAGEERR:', e.message));

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
await page.click('button:has-text("登录")', { timeout: 5000 });
await page.waitForTimeout(3000);
console.log('logged in:', page.url());

const PAGES = [
  { name: '02-home', path: '/', wait: 3000 },
  { name: '03-worklist', path: '/worklist', wait: 4000 },
  { name: '04-patient', path: '/patients', wait: 4000 },
  { name: '05-reports', path: '/reports', wait: 4000 },
  { name: '06-report-write', path: '/write-report', wait: 4000 },
  { name: '10-dicom', path: '/dicom-viewer', wait: 5000 },
  { name: '11-template', path: '/template-management', wait: 4000 },
  { name: '15-ai-assist', path: '/ai-assist', wait: 4000 },
];

for (const p of PAGES) {
  process.stdout.write('[' + p.name + '] ' + p.path + ' ... ');
  try {
    await page.goto(BASE + p.path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(p.wait);
    await page.screenshot({ path: OUT + '/' + p.name + '.png', fullPage: false });
    console.log('OK');
  } catch (e) {
    console.log('FAIL: ' + e.message.split('\n')[0]);
  }
}
await browser.close();
console.log('done');