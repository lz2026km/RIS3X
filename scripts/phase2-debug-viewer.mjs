import { chromium } from 'playwright';

const BASE = 'http://localhost:5191';
const ADMIN_USER = JSON.stringify({ id: 'A001', name: '系统管理员', role: '管理员', department: '信息科', token: 'admin-200x200' });
const G005_AUTH = JSON.stringify({ token: 'admin-200x200', role: '管理员', userId: 'A001', username: '系统管理员' });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((d) => {
    try { window.localStorage.setItem('ris_current_user', d.user); } catch {}
    try { window.localStorage.setItem('g005_auth', d.auth); } catch {}
  }, { user: ADMIN_USER, auth: G005_AUTH });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message.slice(0, 300)));
  await page.goto(BASE + '/dicom-viewer-pro', { waitUntil: 'domcontentloaded', timeout: 30000 });
  for (const wait of [2000, 4000, 8000]) {
    await page.waitForTimeout(wait);
    const info = await page.evaluate(() => ({
      bodyLen: document.body.innerText.length,
      bodyText: document.body.innerText.slice(0, 200),
      antdSelects: document.querySelectorAll('.ant-select').length,
      buttons: document.querySelectorAll('button').length,
      html: document.body.innerHTML.slice(0, 300),
    }));
    console.log(`after +${wait}ms:`, JSON.stringify(info));
  }
  console.log('---- logs ----');
  logs.forEach((l) => console.log(l));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
