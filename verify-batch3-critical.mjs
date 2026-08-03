// [v3.0.6.11-60] Batch 3 - CriticalValuePage 独立页浏览器抽查
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:5191';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const pageErrors = [];
p.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 300)));
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await p.evaluate(async () => {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) await r.unregister();
  }
});
await p.evaluate(() => {
  localStorage.setItem('ris_current_user', JSON.stringify({ id: 'A001', name: 'SysAdmin', role: '管理员', department: '信息科' }));
});
await p.goto(`${BASE}/critical-value?t=${Date.now()}`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(5000);
const bodyText = await p.evaluate(() => document.body.innerText);
const markers = ['危急值管理', '5 步闭环工作流', '进入 5 步流程', '危急值列表'];
const missing = markers.filter((m) => !bodyText.includes(m));
const hasEB = bodyText.includes('ErrorBoundary caught');
console.log(`hasErrorBoundary=${hasEB} pageErrors=${pageErrors.length}${pageErrors[0] ? ' :: ' + pageErrors[0] : ''}`);
console.log(`missing=[${missing.join(',')}]`);
const hasData = /共 \d+ 条/.test(bodyText) || bodyText.includes('暂无危急值数据');
console.log(`hasListData=${hasData}`);
console.log('sample:', bodyText.slice(0, 300).replace(/\n/g, ' | '));
await p.screenshot({ path: 'verify-batch3-CriticalValuePage.png', fullPage: false });
await b.close();
