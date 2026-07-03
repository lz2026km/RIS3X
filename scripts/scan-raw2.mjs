import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://127.0.0.1:5191/g005-radiology-ris';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);
try { await page.click('button:has-text("登录")'); } catch {}
await page.waitForTimeout(2000);
const links = JSON.parse(fs.readFileSync('screenshots-fix/sidebar-links.json', 'utf8'));
const issues = [];
for (const link of links) {
  try {
    await page.goto(BASE + link, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    const texts = await page.locator('h1, h2, h3, button, .ant-btn, .ant-tag, td, .ant-typography, label').allInnerTexts().catch(() => []);
    const rawKeys = texts.filter(x => /^[a-z][a-zA-Z0-9_.]+$/.test(x.trim()));
    if (rawKeys.length > 0) {
      issues.push({ link, rawKeys: [...new Set(rawKeys)] });
    }
  } catch (e) {}
}
console.log('=== pages with raw keys ===');
for (const i of issues) console.log(' ', i.link, '|', i.rawKeys.slice(0, 5).join(','));
await browser.close();
