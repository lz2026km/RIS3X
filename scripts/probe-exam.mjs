import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:5191/g005-radiology-ris';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);
try { await page.click('button:has-text("登录")'); } catch {}
await page.waitForTimeout(2000);
await page.goto(BASE + '/exams', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
const rows = await page.$$eval('table tbody tr', rows => rows.slice(0, 5).map(r => Array.from(r.querySelectorAll('td')).map(c => c.textContent.trim().slice(0, 20))));
console.log('first 5 rows:');
for (const r of rows) console.log(' ', r);
await page.screenshot({ path: 'screenshots-fix/exam-2026-07-02.png' });
await browser.close();
