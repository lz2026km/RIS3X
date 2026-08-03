import { chromium } from 'playwright';

const BASE = 'http://localhost:5191';
const ADMIN_USER = JSON.stringify({ id: 'A001', name: '系统管理员', role: '管理员', department: '信息科', token: 'admin-200x200' });
const G005_AUTH = JSON.stringify({ token: 'admin-200x200', role: '管理员', userId: 'A001', username: '系统管理员' });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  await ctx.addInitScript((d) => {
    try { window.localStorage.setItem('ris_current_user', d.user); } catch {}
    try { window.localStorage.setItem('g005_auth', d.auth); } catch {}
  }, { user: ADMIN_USER, auth: G005_AUTH });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  for (const url of ['/api/v1/analytics/dashboard?period=month', '/api/v1/analytics/dashboard', '/api/v1/writing/templates', '/api/v1/analytics/ab-test']) {
    const r = await page.evaluate(async (u) => {
      const res = await fetch(u, { headers: { Authorization: 'Bearer admin-200x200' } });
      let body = '';
      try { body = (await res.text()).slice(0, 300); } catch {}
      return { status: res.status, body };
    }, url);
    console.log(r.status, url, '=>', r.body.replace(/\n/g, ' '));
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
