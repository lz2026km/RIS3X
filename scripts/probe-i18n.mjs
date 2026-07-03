import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto('http://127.0.0.1:5191/g005-radiology-ris/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);
try { await page.click('button:has-text("登录")', { timeout: 5000 }); } catch {}
await page.waitForTimeout(2000);

// 等 i18n 模块加载
const result = await page.evaluate(() => {
  return new Promise((resolve) => {
    // 等模块 hot-accept 加载
    const t = setTimeout(() => resolve({err: 'timeout'}), 10000);
    fetch('/src/i18n/index.ts', { headers: { 'Accept': 'application/javascript' } })
      .then(r => r.text())
      .then(src => {
        clearTimeout(t);
        // 试在 dev 全局找 i18n 实例（react-i18next 通常不会挂全局，但 react 组件会用）
        const keys = Object.keys(window).filter(k => /i18n|translation/i.test(k));
        resolve({hasI18nGlobal: keys, srcLen: src.length, srcHead: src.slice(0, 300)});
      }).catch(e => { clearTimeout(t); resolve({err: e.message}); });
  });
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
