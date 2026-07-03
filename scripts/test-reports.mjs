// Test just the reports page with longer timeout
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

// Now click on the sidebar "报告列表" link
console.log('clicking sidebar link...');
try {
  await page.click('text="报告列表"', { timeout: 5000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: OUT + '/05-reports.png', fullPage: false });
  console.log('reports page OK, current:', page.url());
} catch (e) {
  console.log('click failed:', e.message.split('\n')[0]);
  // direct navigation as fallback
  await page.goto(BASE + '/reports', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: OUT + '/05-reports.png', fullPage: false });
  console.log('fallback OK, current:', page.url());
}

await browser.close();