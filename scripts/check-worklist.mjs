import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5191/g005-radiology-ris';
const OUT = 'screenshots-fix';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);
try { await page.click('button:has-text("登录")', { timeout: 5000 }); } catch {}
await page.waitForTimeout(2000);

const targets = [
  { name: 'worklist', path: '/worklist', wait: 4000 },
  { name: 'home', path: '/', wait: 3000 },
];
for (const t of targets) {
  await page.goto(BASE + t.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(t.wait);
  const url = page.url();
  const titles = await page.locator('h1, h2, h3, .ant-typography').allInnerTexts().catch(() => []);
  const rawKeys = titles.filter(x => /^[a-z][a-zA-Z0-9_.]+$/.test(x.trim()));
  console.log(t.path, '->', url.replace(BASE, ''), '| titles:', titles.slice(0, 4), '| rawKeys:', rawKeys.length);
  await page.screenshot({ path: OUT + '/' + t.name + '-2-2026-07-02.png', fullPage: false });
}
console.log('errs:', errs.length, errs.slice(0, 3));
await browser.close();
