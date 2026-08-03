// [v3.0.6.11-60] 验证 /dicom/sr-report 全链路: 生成 SR → 详情树 → ORU 回传
import { chromium } from 'playwright';
import { setTimeout as wait } from 'node:timers/promises';

const BASE = 'http://127.0.0.1:5191';
const PAGE = '/dicom/sr-report';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'allow' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`[PAGE ERROR] ${e.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[CONSOLE] ${msg.text()}`); });

  await ctx.addInitScript(() => {
    localStorage.setItem('ris_current_user', JSON.stringify({ id: 'u-admin', name: '测试管理员', role: '管理员', department: '放射科', username: 'admin' }));
  });

  console.log('1. 打开页面...');
  await page.goto(BASE + PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=DICOM SR 结构化报告', { timeout: 20000 });
  console.log('   PASS 页面渲染成功');
  await page.waitForTimeout(1500);

  console.log('2. 打开"从报告生成 SR"弹窗...');
  await page.click('button:has-text("从报告生成 SR")');
  await page.waitForSelector('.ant-modal:has-text("选择报告")', { timeout: 10000 });
  console.log('   PASS 生成弹窗已打开');

  await page.waitForSelector('.ant-modal .ant-select:not(.ant-select-loading)', { timeout: 15000 });
  await page.click('.ant-modal .ant-select');
  await page.waitForSelector('.ant-select-dropdown .ant-select-item', { timeout: 10000 });
  const firstOption = page.locator('.ant-select-dropdown .ant-select-item-option').first();
  const optionText = (await firstOption.innerText()).trim();
  await firstOption.click();
  console.log(`   PASS 已选择报告: ${optionText}`);
  await page.waitForTimeout(400);

  console.log('3. 点击"生成 SR"...');
  await page.click('.ant-modal button:has-text("生成 SR")');
  await page.waitForSelector('.ant-modal:has-text("SR 文档详情")', { timeout: 15000 });
  console.log('   PASS 生成成功,详情弹窗已打开');
  await wait(800);

  const detailModal = page.locator('.ant-modal:has-text("SR 文档详情")').first();
  const treeText = await detailModal.innerText();
  const checks = [
    ['TID 1500', treeText.includes('TID 1500')],
    ['检查所见 / Findings', treeText.includes('检查所见 / Findings')],
    ['结论 / Impression', treeText.includes('结论 / Impression')],
    ['SNOMED 编码 SCT', treeText.includes('SCT:')],
    ['上下文 Context', treeText.includes('上下文 (Context)')],
    ['DICOM 文本', treeText.includes('DICOM SR 文本')],
    ['结构化内容树', treeText.includes('结构化内容树')],
  ];
  let fail = 0;
  for (const [name, ok] of checks) {
    console.log(`   ${ok ? 'PASS' : 'FAIL'} 详情树: ${name}`);
    if (!ok) fail++;
  }

  console.log('4. 点击"ORU 回传"...');
  await detailModal.locator('.ant-modal-footer button:has-text("ORU 回传")').click();
  await wait(1500);
  const statusText = await detailModal.innerText();
  const pushed = statusText.includes('已回传') || statusText.includes('ORU^R01');
  console.log(`   ${pushed ? 'PASS' : 'FAIL'} ORU 回传,状态/消息已更新`);
  await wait(800);
  const listText = await page.locator('body').innerText();
  console.log(`   ${listText.includes('已回传') ? 'PASS' : 'FAIL'} 列表状态标记为"已回传"`);
  if (!listText.includes('已回传')) fail++;

  console.log('5. 校验 ORU 消息预览 (OBX 段)...');
  const bodyText = await page.locator('body').innerText();
  const oruPreview = bodyText.includes('OBX') && bodyText.includes('18782-3');
  console.log(`   ${oruPreview ? 'PASS' : 'FAIL'} ORU^R01 消息预览 (含 OBX)`);
  if (!oruPreview) fail++;

  console.log('\n=== 验证结果 ===');
  console.log(`页面错误: ${errors.length > 0 ? errors.join('\n') : '无'}`);
  const pass = pushed && fail === 0 && errors.length === 0;
  console.log(pass ? 'SR 全链路验证 PASS' : 'SR 全链路验证 FAIL');
  await browser.close();
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
