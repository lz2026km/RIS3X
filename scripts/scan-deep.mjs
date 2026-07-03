import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5191/g005-radiology-ris';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errs = [];
const consoleErrs = [];
page.on('pageerror', e => errs.push('PAGE: ' + e.message.slice(0, 200)));
page.on('console', m => {
  if (m.type() === 'error') {
    const t = m.text();
    if (!/frame-ancestors|X-Frame-Options/.test(t)) {
      consoleErrs.push(t.slice(0, 200));
    }
  }
});

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);
try { await page.click('button:has-text("登录")', { timeout: 5000 }); } catch {}
await page.waitForTimeout(2000);

// 抓 sidebar 全部链接 (我们之前扫描过的路径)
const links = await page.$$eval('aside a, nav a', els => [...new Set(els.map(a => a.getAttribute('href')).filter(h => h && h.startsWith('/')))]);
console.log('sidebar links:', links.length, 'unique:', new Set(links).size);
fs.writeFileSync('screenshots-fix/sidebar-links.json', JSON.stringify(links, null, 2));

// 跑所有 sidebar links, 收集所有错误
for (const link of links) {
  try {
    await page.goto(BASE + link, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);
    const url = page.url().replace(BASE, '');
    // 检查 raw i18n keys
    const texts = await page.locator('h1, h2, h3, button, .ant-btn, .ant-tag, td, .ant-typography, label').allInnerTexts().catch(() => []);
    const rawKeys = texts.filter(x => /^[a-z][a-zA-Z0-9_.]+$/.test(x.trim()));
    if (rawKeys.length > 0 || !url.startsWith(link)) {
      console.log('ISSUE:', link, '->', url, '| raw:', rawKeys.slice(0, 3));
    }
  } catch (e) {
    console.log('NAV-ERR:', link, e.message.slice(0, 100));
  }
}

console.log('=== unique page errors ===');
[...new Set(errs)].forEach(e => console.log(' -', e));
console.log('=== unique console errors (top 15) ===');
[...new Set(consoleErrs)].slice(0, 15).forEach(e => console.log(' -', e));
await browser.close();
