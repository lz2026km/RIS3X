import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5191/g005-radiology-ris';
const OUT = 'screenshots-fix';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

console.log('=== login ===');
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
try { await page.click('button:has-text("登录")', { timeout: 5000 }); } catch (e) { console.log('login btn err:', e.message); }
await page.waitForTimeout(3000);
console.log('logged in url:', page.url());

const targets = [
  { name: 'statistics', path: '/statistics', wait: 5000 },
  { name: 'worklist', path: '/worklist', wait: 4000 },
  { name: 'reports', path: '/reports', wait: 4000 },
];

for (const t of targets) {
  console.log('=== ' + t.name + ' ===');
  try {
    await page.goto(BASE + t.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(t.wait);
    const url = page.url();
    const titles = await page.locator('h1, h2, h3, .ant-typography').allInnerTexts().catch(() => []);
    console.log('url:', url);
    console.log('titles (first 8):', titles.slice(0, 8));
    const file = OUT + '/' + t.name + '-2026-07-02.png';
    await page.screenshot({ path: file, fullPage: false });
    console.log('shot:', file);
  } catch (e) {
    console.log('err:', e.message);
  }
}

console.log('=== ERRORS ===');
console.log('count:', errs.length);
errs.slice(0, 20).forEach(e => console.log(' -', e));

await browser.close();
