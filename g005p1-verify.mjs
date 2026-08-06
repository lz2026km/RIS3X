// [G005-P1] 浏览器 mock 模式验证: regional/sign-amend/materials/eye/dental 数据正常
import { chromium } from 'playwright';
import { setTimeout as wait } from 'node:timers/promises';

const BASE = 'http://127.0.0.1:5191';

const pages = [
  { path: '/regional-imaging', label: 'regional-imaging', markers: ['调阅申请', '跨院查询', '审计', '张伟'] },
  { path: '/regional-report', label: 'regional-report', markers: ['会诊', '危急值', '远程', '联合签发'] },
  { path: '/sign-amend', label: 'sign-amend', markers: ['证书', '修订'] },
  { path: '/materials', label: 'materials', markers: ['IOL', '接触镜', '低库存', 'SA60AT'] },
  { path: '/dental/dashboard', label: 'dental-dashboard', markers: ['治疗', '预约'] },
  { path: '/eye', label: 'eye-workspace', markers: ['今日'] },
];

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'allow' });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 150)}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !t.includes('404') && !t.includes('favicon') && !t.includes('Failed to load resource')) errors.push(`console: ${t.slice(0, 150)}`);
  });

  await ctx.addInitScript(() => {
    localStorage.setItem('ris_current_user', JSON.stringify({
      id: 'demo-admin', name: '系统管理员', role: '管理员', department: '放射科', username: 'admin',
    }));
    localStorage.setItem('ris_api_mode', 'mock');
  });

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await wait(4000);

  const results = [];
  for (const p of pages) {
    errors.length = 0;
    await page.goto(BASE + p.path, { waitUntil: 'domcontentloaded' });
    await wait(4500);
    const body = await page.evaluate(() => document.body?.innerText ?? '');
    const found = p.markers.map((m) => ({ marker: m, ok: body.includes(m) }));
    const allOk = found.every((f) => f.ok);
    results.push({ path: p.path, label: p.label, found, allOk, errors: errors.slice(0, 3) });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(results[results.length - 1], null, 1));
  }

  await browser.close();
  const failed = results.filter((r) => !r.allOk);
  // eslint-disable-next-line no-console
  console.log(`\n=== RESULT: ${results.length - failed.length}/${results.length} OK ===`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
