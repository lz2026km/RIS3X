import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:5191/g005-radiology-ris';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('ERR:', e.message, '\n', (e.stack || '').slice(0, 1500)));
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);
try { await page.click('button:has-text("登录")', { timeout: 5000 }); } catch {}
await page.waitForTimeout(2000);
await page.goto(BASE + '/dental/billing', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await browser.close();
