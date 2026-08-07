const { chromium } = require('@playwright/test');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const logs = [];
  p.on('console', m => { if (m.text().includes('[i18n]') || m.text().includes('orchestrator')) logs.push(m.text().slice(0, 150)); });
  await p.goto('http://localhost:5191/login', { waitUntil: 'networkidle', timeout: 30000 });
  await p.selectOption('select', '管理员');
  await p.locator('input').nth(0).fill('admin');
  await p.locator('input').nth(1).fill('admin123');
  await p.click('button[type="submit"]');
  await p.waitForTimeout(6000);
  await p.goto('http://localhost:5191/orchestrator', { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(6000);
  console.log('=== i18n 日志 ===');
  logs.slice(0, 10).forEach(l => console.log(l));
  // 通过 window 访问 i18n store（react-i18next 挂载）
  const storeInfo = await p.evaluate(() => {
    // @ts-ignore
    const w = window;
    const keys = Object.keys(w).filter(k => k.toLowerCase().includes('i18n'));
    return { i18nGlobals: keys };
  });
  console.log('=== i18n 全局:', JSON.stringify(storeInfo));
  await b.close();
})();
