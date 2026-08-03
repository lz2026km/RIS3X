// 截图: /ai-orchestration 三 Tab
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:5191';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } });
const page = await ctx.newPage();
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  localStorage.setItem('ris_current_user', JSON.stringify({ id: 'A001', name: '系统管理员', role: '管理员', department: '信息科', username: 'admin' }));
  localStorage.setItem('ris_api_mode', 'mock');
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(4500);
await page.evaluate((p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }, '/ai-orchestration');
await page.waitForTimeout(3500);
await page.screenshot({ path: 'verify-ai-orch-tab1-market.png' });
await page.locator('.ant-tabs-tab:has-text("工作流集成")').click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'verify-ai-orch-tab2-integrations.png' });
await page.locator('.ant-tabs-tab:has-text("推理任务")').click();
await page.waitForTimeout(2000);
await page.screenshot({ path: 'verify-ai-orch-tab3-jobs.png' });
const viewBtn = page.locator('button:has-text("二次检出查看")').first();
if (await viewBtn.count()) {
  await viewBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'verify-ai-orch-drawer-viewer.png' });
}
await browser.close();
console.log('screenshots saved');
