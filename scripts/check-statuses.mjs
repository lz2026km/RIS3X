import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5191/g005-radiology-ris/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
try { await page.click('button:has-text("登录")'); } catch {}
await page.waitForTimeout(2000);
await page.goto('http://127.0.0.1:5191/g005-radiology-ris/worklist', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const rows = await page.$$eval('table tbody tr', rows => rows.map(r => Array.from(r.querySelectorAll('td')).map(c => c.textContent.trim())));
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  // 找包含 published 的行
  if (r.some(c => /published|submitted|reviewed|completed|cosigned/i.test(c))) {
    console.log('row', i, ':', r);
  }
}
await browser.close();
