import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://127.0.0.1:5191/g005-radiology-ris';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const allErrs = [];
page.on('pageerror', e => allErrs.push('PAGE: ' + e.message.slice(0, 200)));

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);
try { await page.click('button:has-text("登录")', { timeout: 5000 }); } catch {}
await page.waitForTimeout(2000);

const links = JSON.parse(fs.readFileSync('screenshots-fix/sidebar-links.json', 'utf8'));
let rawKeyCount = 0;
const issues = [];
for (const link of links) {
  try {
    await page.goto(BASE + link, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    const url = page.url().replace(BASE, '');
    const texts = await page.locator('h1, h2, h3, button, .ant-btn, .ant-tag, td, .ant-typography, label').allInnerTexts().catch(() => []);
    const rawKeys = texts.filter(x => /^[a-z][a-zA-Z0-9_.]+$/.test(x.trim()));
    if (rawKeys.length > 0 || !url.startsWith(link)) {
      issues.push({ link, url, rawKeys: rawKeys.slice(0, 5) });
      rawKeyCount += rawKeys.length;
    }
  } catch (e) {}
}
console.log('=== raw i18n keys remaining ===');
console.log('total:', rawKeyCount, '| pages with issues:', issues.length);
for (const i of issues.slice(0, 20)) {
  console.log(' ', i.link, '->', i.url, '| raw:', JSON.stringify(i.rawKeys));
}
console.log('=== unique page errors ===');
[...new Set(allErrs)].forEach(e => console.log(' -', e));
await browser.close();
