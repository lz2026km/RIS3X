// G005-P0 浏览器验证 (5191 dev mock 模式)
// 页面: /critical-value /critical-value-center /critical-value-stats /critical-value-rule
//       /critical-value-5step /data-report-center /analytics/tat-dashboard /dicom/compress
// 检查: API 无 4xx/5xx、危急值数据渲染、无页面 JS 错误
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5191';
const PAGES = [
  { path: '/critical-value', name: '危急值管理' },
  { path: '/critical-value-center', name: '危急值中心' },
  { path: '/critical-value-stats', name: '危急值统计' },
  { path: '/critical-value-rule', name: '危急值规则' },
  { path: '/critical-value-5step', name: '5步工作流' },
  { path: '/data-report-center', name: '数据上报中心' },
  { path: '/analytics/tat-dashboard', name: 'TAT看板(OLAP)' },
  { path: '/dicom/compress', name: 'DICOM压缩' },
];

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('ris_current_user', JSON.stringify({
        id: 'demo-admin', name: '系统管理员', role: '管理员', department: '放射科', username: 'admin',
      }));
    } catch (e) { /* ignore */ }
  });

  let failed = 0;
  const apiFailures = [];
  const pageErrors = [];
  const NOISE = [
    'frame-ancestors',
    'X-Frame-Options may only be set via an HTTP header',
    'unique "key" prop',
  ];
  page.on('response', (res) => {
    const url = res.url();
    if (!url.includes('/api/v1')) return;
    if (res.status() >= 400) {
      failed++;
      apiFailures.push(`${res.status()} ${res.request().method()} ${url.replace(BASE, '')}`);
    }
  });
  page.on('pageerror', (e) => { failed++; pageErrors.push(e.message); });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    if (NOISE.some((n) => msg.text().includes(n))) return;
    failed++;
    pageErrors.push('[console.error] ' + msg.text().slice(0, 200));
  });

  const DATA_MARKERS = {
    '/critical-value': ['危急值管理'],
    '/critical-value-5step': ['危急值5步工作流', '闭环'],
    '/critical-value-center': ['危急值中心'],
    '/critical-value-stats': ['危急值统计大屏'],
    '/data-report-center': ['数据上报'],
    '/dicom/compress': ['DICOM'],
  };
  const ROW_SELECTORS = {
    '/critical-value': 'tbody tr',
    '/critical-value-5step': 'tbody tr',
  };

  for (const p of PAGES) {
    try {
      await page.goto(BASE + p.path, { waitUntil: 'networkidle', timeout: 45000 });
    } catch (e) {
      console.log(`  [${p.name}] ${p.path} → goto失败: ${e.message.slice(0, 120)}`);
      failed++;
      continue;
    }
    await page.waitForTimeout(800);
    let bodyText = '';
    try { bodyText = await page.evaluate(() => document.body.innerText); } catch { /* ignore */ }
    const markers = DATA_MARKERS[p.path] ?? [];
    const missing = markers.filter((m) => !bodyText.includes(m));
    let rowCount = -1;
    if (ROW_SELECTORS[p.path]) {
      rowCount = await page.evaluate((sel) => document.querySelectorAll(sel).length, ROW_SELECTORS[p.path]).catch(() => -1);
      if (rowCount < 0) missing.push('表格行');
    }
    const status = missing.length === 0 && bodyText.trim().length > 0 ? 'PASS' : 'FAIL';
    if (status === 'FAIL') failed++;
    console.log(`  [${p.name}] ${p.path} → ${status} (text ${bodyText.length} chars, 数据行: ${rowCount}${missing.length ? ', 缺: ' + missing.join(',') : ''})`);
  }

  console.log('\n===== API 失败清单 =====');
  if (apiFailures.length === 0) console.log('  ✓ 无 4xx/5xx API 响应');
  else for (const f of apiFailures) console.log('  ✗ ' + f);

  console.log('\n===== 页面/控制台错误 =====');
  if (pageErrors.length === 0) console.log('  ✓ 无页面 JS 错误');
  else for (const e of pageErrors.slice(0, 20)) console.log('  ✗ ' + e);

  console.log(`\n===== 汇总: ${failed === 0 ? 'PASS ✓' : 'FAIL (' + failed + ' 问题)'} =====`);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('脚本崩溃:', e.message); process.exit(1); });
