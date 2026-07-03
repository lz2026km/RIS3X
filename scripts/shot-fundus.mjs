import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:5191/g005-radiology-ris';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);
try { await page.click('button:has-text("登录")'); } catch {}
await page.waitForTimeout(2000);
await page.goto(BASE + '/eye/pacs/fundus', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await page.screenshot({ path: 'C:/tmp/eye-fundus-shot.png' });
console.log('saved');
await browser.close();
