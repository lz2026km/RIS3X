// [v3.0.6.11-60] /dicom/compress 真实压缩验证 (MSW 模式, preview 根路径)
import { chromium } from 'playwright';
import { setTimeout as wait } from 'node:timers/promises';

const BASE = 'http://127.0.0.1:5199';

const USER = {
  id: 'demo-admin',
  name: 'SysAdmin',
  role: '\u7ba1\u7406\u5458', // 管理员
  department: 'IT',
  phone: '',
  username: 'admin',
  title: 'System Admin',
};

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await ctx.addInitScript((user) => {
    localStorage.setItem('ris_current_user', JSON.stringify(user));
    localStorage.setItem('ris_api_mode', 'mock');
  }, USER);

  console.log('=== opening /dicom/compress ===');
  await page.goto(BASE + '/dicom/compress', { waitUntil: 'domcontentloaded' });
  await wait(6000);

  // 1) 实例列表加载
  const selText = await page.locator('.ant-select-selection-item').allInnerTexts().catch(() => []);
  console.log('instance select options loaded:', selText.length > 0);
  console.log('selected:', selText[0]);

  // 2) 触发压缩 (默认 JPEG2000 Lossless predictive, CT_CHEST_001)
  console.log('=== compressing (JPEG2000 Lossless predictive) ===');
  await page.getByRole('button', { name: /\u5f00\u59cb\u538b\u7f29/ }).click();
  await wait(4000);
  const statTitles = await page.locator('.ant-statistic-title').allInnerTexts().catch(() => []);
  const statValues = await page.locator('.ant-statistic-content').allInnerTexts().catch(() => []);
  console.log('result card:', JSON.stringify({ statTitles, statValues }));

  const ratioText = await page
    .locator('.ant-statistic-content', { hasText: '\u00d7' })
    .first()
    .innerText()
    .catch(() => 'N/A');
  console.log('real ratio displayed:', ratioText);
  const realBadges = await page.locator('.ant-tag', { hasText: '\u771f\u5b9e' }).count();
  console.log('real badges (真实):', realBadges);
  const estBadges = await page.locator('.ant-tag', { hasText: '\u4f30\u7b97' }).count();
  console.log('estimate badges (估算):', estBadges);

  // 3) 任务列表
  const taskRows = await page.locator('.ant-table-tbody tr').count();
  console.log('task table rows:', taskRows);
  const taskTags = await page.locator('.ant-table-tbody .ant-tag').allInnerTexts();
  console.log('task tags:', taskTags.filter((t) => t.includes('\u00d7')));

  // 4) 全部算法对比 (6 种语法 -> 6 行对比表)
  console.log('=== compare all algorithms ===');
  await page.getByRole('button', { name: /\u5168\u90e8\u7b97\u6cd5\u5bf9\u6bd4/ }).click();
  await wait(14000);
  const compareRows = await page
    .locator('.ant-table-tbody tr', { hasText: '\u00d7' })
    .allInnerTexts()
    .catch(() => []);
  console.log('compare rows (' + compareRows.length + '):');
  compareRows.forEach((r) => console.log('  ', r.replace(/\n/g, ' | ')));
  const compareTableText = await page.locator('.ant-card').allInnerTexts();
  const compareTable = compareTableText.find((c) => c.includes('\u7b97\u6cd5\u5bf9\u6bd4'));
  console.log('compare table has 6 rows:', (compareTable?.match(/JPEG|RLE/g) ?? []).length >= 6);

  // 5) 统计卡 (按算法)
  const statsText = await page.locator('.ant-card').allInnerTexts().catch(() => []);
  const hasStats = statsText.some((c) => c.includes('\u6309\u7b97\u6cd5'));
  console.log('ratio stats card present:', hasStats);

  // 6) 解压验证
  console.log('=== decompress verify ===');
  await page.getByRole('button', { name: /\u89e3\u538b\u9a8c\u8bc1/ }).click().catch(() => {});
  await wait(2000);
  const decompValues = await page.locator('.ant-statistic-content').allInnerTexts().catch(() => []);
  console.log('result stats after decompress:', JSON.stringify(decompValues));
  await page.screenshot({ path: 'verify-compress-final.png', fullPage: true });

  console.log('\npage errors:', errors.length ? errors.slice(0, 8) : 'NONE');
  await browser.close();
}

main().catch((e) => {
  console.error('SCRIPT FAILED:', e);
  process.exit(1);
});
