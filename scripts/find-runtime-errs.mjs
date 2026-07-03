import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://127.0.0.1:5191/g005-radiology-ris';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push({ msg: e.message, stack: (e.stack || '').slice(0, 800) }));

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);
try { await page.click('button:has-text("登录")', { timeout: 5000 }); } catch {}
await page.waitForTimeout(2000);

const links = JSON.parse(fs.readFileSync('screenshots-fix/sidebar-links.json', 'utf8'));
for (const link of links) {
  await page.goto(BASE + link, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
}
console.log('unique page errors:');
[...new Map(errs.map(e => [e.msg, e])).values()].forEach(e => {
  console.log(' -', e.msg);
  console.log('   at:', e.stack.split('\n').slice(0, 5).join(' | '));
});
await browser.close();
