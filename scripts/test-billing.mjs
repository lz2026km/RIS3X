import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:5191/g005-radiology-ris';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
let errs = 0;
page.on('pageerror', () => errs++);
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);
try { await page.click('button:has-text("登录")'); } catch {}
await page.waitForTimeout(2000);
await page.goto(BASE + '/dental/billing', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
console.log('billing page errs:', errs);
await browser.close();
