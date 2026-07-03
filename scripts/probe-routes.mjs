import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5191/g005-radiology-ris';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);
try { await page.click('button:has-text("登录")', { timeout: 5000 }); } catch {}
await page.waitForTimeout(2000);

// 看 worklist 重定向的真实路径
for (const r of ['/worklist', '/quality', '/critical', '/admin', '/dental', '/eye', '/fhir', '/dental-ai-onnx']) {
  await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => console.log('err', r, e.message));
  await page.waitForTimeout(1500);
  console.log(r, '=>', page.url());
}
await browser.close();
