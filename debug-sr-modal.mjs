import { chromium } from 'playwright';
import { setTimeout as wait } from 'node:timers/promises';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('[ERR]', m.text().slice(0, 300)); });
await ctx.addInitScript(() => {
  localStorage.setItem('ris_current_user', JSON.stringify({ id: 'u-admin', name: '测试管理员', role: '管理员', department: '放射科', username: 'admin' }));
});
await page.goto('http://127.0.0.1:5191/dicom/sr-report', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=DICOM SR 结构化报告', { timeout: 20000 });
await page.waitForTimeout(1200);
await page.click('button:has-text("从报告生成 SR")');
await wait(3000);
const dump = await page.evaluate(() => {
  const modal = document.querySelector('.ant-modal');
  const sel = modal?.querySelector('.ant-select');
  const selInput = sel?.querySelector('.ant-select-selection-search-input');
  const alertBox = modal?.querySelector('.ant-alert');
  return {
    selectClass: sel?.className ?? 'NO SELECT',
    hasOptions: !!modal?.querySelector('.ant-select-item'),
    alertText: alertBox?.textContent ?? null,
    modalText: (modal?.textContent ?? '').slice(0, 200),
    ariaExpanded: selInput?.getAttribute('aria-expanded'),
  };
});
console.log(JSON.stringify(dump, null, 2));
await browser.close();
