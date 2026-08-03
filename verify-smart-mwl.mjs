import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5191';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => {
  localStorage.setItem('ris_current_user', JSON.stringify({ id: 'A001', name: 'SysAdmin', role: '管理员', department: '信息科' }));
  localStorage.setItem('ris_api_mode', 'mock');
});
const p = await ctx.newPage();
const pageErrors = [];
p.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 160)));
p.on('console', (m) => { if (m.type() === 'error' && !/Content Security Policy|X-Frame-Options|antd: message|antd: Statistic/i.test(m.text())) pageErrors.push('[console] ' + m.text().slice(0, 160)); });

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra });
  console.log((ok ? '[PASS] ' : '[FAIL] ') + name + (extra ? ' :: ' + extra : ''));
};

// ── Smart MWL ──
await p.goto(BASE + '/smart-mwl', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(6000);

// 1. 优先级分组统计卡
const cardText = await p.evaluate(() => document.body.innerText);
check('优先级统计卡(危急/高/中/低)', /总检查数/.test(cardText) && /危急/.test(cardText) && /高优先级/.test(cardText) && /中优先级/.test(cardText) && /低优先级/.test(cardText));

// 2. 多因子表格列
const ths = await p.$$eval('.ant-table-thead th', (els) => els.map((e) => e.textContent.trim()));
check('因子明细列(等待时长/紧急度/AI分检/综合评分)', ['等待时长', '紧急度', 'AI 分检', '综合评分'].every((c) => ths.some((t) => t.includes(c))), ths.join('|'));

// 3. 表格行有 得分×权重 明细
const rows = await p.$$('.ant-table-tbody tr.ant-table-row');
check('表格渲染行数 > 0', rows.length > 0, `${rows.length} rows`);
if (rows.length > 0) {
  const firstRowText = await rows[0].innerText();
  check('行内含"分 × %权重"明细', firstRowText.includes('分 × ') && firstRowText.includes('%权重'), firstRowText.slice(0, 120));
}

// 4. 权重配置面板
await p.click('text=权重配置');
await p.waitForTimeout(1500);
const modalText = await p.evaluate(() => document.body.innerText);
check('权重面板(紧急度/等待时长/年龄/检查类型)', /紧急度权重/.test(modalText) && /等待时长权重/.test(modalText) && /年龄权重/.test(modalText) && /检查类型权重/.test(modalText) && /权重合计/.test(modalText));
const sliderCount = await p.$$('.ant-modal .ant-slider').then((s) => s.length);
check('权重面板 4 个滑块', sliderCount === 4, `${sliderCount} sliders`);
await p.click('.ant-modal .ant-btn-primary'); // 保存并重算
await p.waitForTimeout(2500);
check('保存权重后无报错', pageErrors.length === 0);

// 5. 因子明细 modal
const firstDetailBtn = await p.$('.ant-table-tbody tr.ant-table-row button');
if (firstDetailBtn) {
  await firstDetailBtn.click();
  await p.waitForTimeout(1200);
  const detailText = await p.evaluate(() => document.body.innerText);
  check('因子明细弹窗(6因子+理由)', /评分因子/.test(detailText) && /紧急度/.test(detailText) && /AI 分检/.test(detailText) && /评估理由/.test(detailText));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
}

// ── Smart Routing ──
await p.goto(BASE + '/smart-routing', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(5000);
const routeText = await p.evaluate(() => document.body.innerText);
check('路由页规则表(CT Chest - Senior)', /CT Chest - Senior/.test(routeText) && /MR Brain - Specialist/.test(routeText));

await p.click('text=医生资质');
await p.waitForTimeout(2500);
const qualText = await p.evaluate(() => document.body.innerText);
check('资质表(亚专科+负载)', /胸部影像/.test(qualText) && /神经影像/.test(qualText) && /当前负载/.test(qualText) && /3\/10/.test(qualText), qualText.replace(/\n/g, ' ').slice(0, 300));

await p.click('text=分配预览');
await p.waitForTimeout(1000);
await p.fill('input[placeholder="STU-2026-0001"]', 'STU-2026-0999');
await p.fill('input[placeholder="张三"]', '测试患者');
await p.click('button:has-text("模拟分配")');
await p.waitForTimeout(2500);
const assignText = await p.evaluate(() => document.body.innerText);
check('分配预览(医生+规则+阶段+资质)', /分配结果预览/.test(assignText) && /分配医生/.test(assignText) && /匹配规则/.test(assignText) && /路由阶段/.test(assignText) && /匹配资质/.test(assignText) && /Dr\./.test(assignText));

await p.screenshot({ path: 'verify-smartmwl.png', fullPage: true });

const failed = results.filter((r) => !r.ok);
console.log('\nResult: ' + (results.length - failed.length) + '/' + results.length + ' passed');
if (pageErrors.length) {
  console.log('\nPage errors:');
  pageErrors.slice(0, 10).forEach((e) => console.log('  -', e));
}
await b.close();
process.exit(failed.length ? 1 : 0);
