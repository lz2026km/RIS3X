import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5191/g005-radiology-ris';
const OUT = 'screenshots-fix';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const allErrs = [];
page.on('pageerror', e => allErrs.push('PAGE: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/frame-ancestors|X-Frame-Options/i.test(m.text())) allErrs.push('CON: ' + m.text().slice(0, 150)); });

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);
try { await page.click('button:has-text("登录")', { timeout: 5000 }); } catch {}
await page.waitForTimeout(2000);

const targets = [
  { name: 'final-01-home', path: '/', wait: 3000 },
  { name: 'final-02-worklist', path: '/worklist', wait: 4000 },
  { name: 'final-03-statistics', path: '/statistics', wait: 5000 },
  { name: 'final-04-reports', path: '/reports', wait: 4000 },
  { name: 'final-05-dicom', path: '/dicom-viewer', wait: 5000 },
  { name: 'final-06-write-report', path: '/write-report', wait: 4000 },
  { name: 'final-07-ai-assist', path: '/ai-assist', wait: 4000 },
  { name: 'final-08-critical', path: '/critical-value', wait: 4000 },
  { name: 'final-09-dental', path: '/dental', wait: 4000 },
  { name: 'final-10-eye', path: '/eye', wait: 4000 },
];

let totalRawKeys = 0;
const summary = [];
for (const t of targets) {
  await page.goto(BASE + t.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(t.wait);
  const url = page.url();
  const titles = await page.locator('h1, h2, h3, .ant-typography, button, .ant-btn, .ant-tag, td').allInnerTexts().catch(() => []);
  const rawKeys = titles.filter(x => /^[a-z][a-zA-Z0-9_.]+$/.test(x.trim()));
  totalRawKeys += rawKeys.length;
  await page.screenshot({ path: OUT + '/' + t.name + '.png', fullPage: false });
  summary.push({ name: t.name, path: t.path, ok: url.endsWith(t.path), rawKeys: rawKeys.slice(0, 3) });
}
console.log('=== pages summary ===');
for (const s of summary) console.log(' ', s.name, s.path, s.ok ? 'OK' : 'REDIRECT', '| raw:', JSON.stringify(s.rawKeys));
console.log('total raw keys:', totalRawKeys);
console.log('=== unique errors ===');
[...new Set(allErrs)].forEach(e => console.log(' -', e));
await browser.close();
