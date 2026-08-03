import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('[ERR]', m.text()); });
await ctx.addInitScript(() => {
  localStorage.setItem('ris_current_user', JSON.stringify({ id: 'u-admin', name: '测试管理员', role: '管理员', department: '放射科', username: 'admin' }));
});
await page.goto('http://127.0.0.1:5191/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const res = await page.evaluate(async () => {
  const r = await fetch('/api/v1/reports?pageSize=100');
  const body = await r.json();
  return { status: r.status, success: body?.success, count: Array.isArray(body?.data) ? body.data.length : -1, sample: Array.isArray(body?.data) && body.data[0] ? { id: body.data[0].id, patientName: body.data[0].patientName } : null, err: body?.error };
});
console.log(JSON.stringify(res, null, 2));
await browser.close();
