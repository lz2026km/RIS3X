// [v3.0.6.11-60] /ai-orchestration 三 Tab 浏览器验证
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5191';
const PATH = '/ai-orchestration';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 300)}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) consoleErrors.push(`console: ${m.text().slice(0, 300)}`);
});

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`);
};

try {
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    localStorage.setItem('ris_current_user', JSON.stringify({
      id: 'A001', name: '系统管理员', role: '管理员', department: '信息科', username: 'admin',
    }));
    localStorage.setItem('ris_api_mode', 'mock');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(4500);

  // 进入 /ai-orchestration (SPA pushState)
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, PATH);
  await page.waitForTimeout(3500);

  const body = await page.locator('body').textContent();
  check('页面标题 AI 编排平台', body.includes('AI 编排平台'));
  check('Tab1 模型市场', body.includes('模型市场'));
  check('Tab2 工作流集成', body.includes('工作流集成'));
  check('Tab3 推理任务', body.includes('推理任务'));

  // === Tab1: 模型市场 ===
  const modelCards = await page.locator('text=肺结节检测').count();
  check('模型卡片渲染 (LungNet)', modelCards > 0);
  const cardCount = await page.locator('.ant-card').count();
  check('模型卡片网格数量', cardCount >= 6, `cards=${cardCount}`);
  const deployBtns = await page.locator('button:has-text("部署")').count();
  check('部署按钮存在', deployBtns > 0, `btns=${deployBtns}`);
  const testBtns = await page.locator('button:has-text("测试")').count();
  check('测试按钮存在', testBtns > 0, `btns=${testBtns}`);

  // 注册模型 Modal
  await page.locator('button:has-text("注册模型")').click();
  await page.waitForTimeout(600);
  const modalText = await page.locator('.ant-modal:visible').textContent();
  check('注册模型 Modal 打开', modalText.includes('注册 AI 模型'));
  await page.locator('.ant-modal:visible input[placeholder="如：肺结节检测"]').fill('脑出血检测');
  await page.locator('.ant-modal:visible input[placeholder="如：2.3.1"]').fill('1.0.0');
  await page.locator('.ant-modal:visible input[placeholder="如：DeepHealth"]').fill('TestVendor');
  await page.locator('.ant-modal:visible input[placeholder="https://ai.example.com/model/v1"]').fill('https://ai.test.local/ich/v1');
  await page.locator('.ant-modal:visible button', { hasText: /注\s*册/ }).click();
  await page.waitForTimeout(1500);
  const body2 = await page.locator('body').textContent();
  check('新模型注册成功显示', body2.includes('脑出血检测'), '脑出血检测出现在卡片区');

  // 测试按钮点击 → 连通性结果 Modal
  await page.locator('.ant-card button:has-text("测试")').first().click();
  await page.waitForTimeout(1200);
  const testModal = await page.locator('.ant-modal', { hasText: /连通正常|连接异常/ }).textContent();
  check('连通性测试结果 Modal', testModal.includes('连通正常') || testModal.includes('连接异常'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // === Tab2: 工作流集成 ===
  await page.locator('.ant-tabs-tab:has-text("工作流集成")').click();
  await page.waitForTimeout(1500);
  const intBody = await page.locator('body').textContent();
  check('集成列表渲染', intBody.includes('胸部CT结节检测自动工作流'));
  check('触发条件 Tag', intBody.includes('ON_STUDY_COMPLETE'));
  check('目标工作流 Tag', intBody.includes('lung-nodule-auto'));

  // 新建集成 Modal
  await page.locator('button:has-text("新建集成")').click();
  await page.waitForTimeout(600);
  const intModal = await page.locator('.ant-modal:visible').textContent();
  check('新建集成 Modal 打开', intModal.includes('新建 AI → 工作流集成'));
  await page.locator('.ant-modal:visible button', { hasText: /取\s*消/ }).click();
  await page.waitForTimeout(400);

  // 模拟事件触发 (选择 CT 模态 → 匹配 INT-001 肺结节集成)
  await page.locator('button:has-text("模拟事件触发")').click();
  await page.waitForTimeout(600);
  await page.locator('.ant-modal:visible input[placeholder="如：EX-5123"]').fill('EX-9001');
  await page.locator('.ant-modal:visible .ant-select').nth(1).click();
  await page.waitForTimeout(500);
  const ctOption = page.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: /^CT$/ }).first();
  if (await ctOption.count()) {
    await ctOption.click();
  }
  await page.waitForTimeout(400);
  const selText = (await page.locator('.ant-modal:visible .ant-select').nth(1).textContent()).trim();
  console.log('  [debug] event modal selects:', await page.locator('.ant-modal:visible .ant-select').count(), 'modality select text:', selText.slice(0, 40));
  await page.locator('.ant-modal:visible input[placeholder="如：CHEST"]').fill('CHEST');
  await page.waitForTimeout(200);
  await page.locator('.ant-modal:visible button', { hasText: /触发事件/ }).click();
  await page.waitForTimeout(1500);
  const eventMsg = await page.locator('.ant-message').textContent().catch(() => '');
  check('事件触发匹配消息', eventMsg.includes('1 条工作流匹配'), eventMsg.slice(0, 60));

  // === Tab3: 推理任务 ===
  await page.locator('.ant-tabs-tab:has-text("推理任务")').click();
  await page.waitForTimeout(2000);
  const jobsBody = await page.locator('body').textContent();
  check('任务表格渲染 (JOB-001)', jobsBody.includes('JOB-001'));
  check('任务状态 Tag 已完成', jobsBody.includes('已完成'));
  check('二次检出入口', jobsBody.includes('二次检出查看'));

  // 打开任务详情 Drawer (第一个含 二次检出查看 的行)
  const viewBtn = page.locator('button:has-text("二次检出查看")').first();
  const hasViewBtn = (await viewBtn.count()) > 0;
  check('详情 Drawer 入口按钮', hasViewBtn);
  if (hasViewBtn) {
    await viewBtn.click();
    await page.waitForTimeout(1200);
    const drawerBody = await page.locator('.ant-drawer').textContent();
    check('Drawer 打开', drawerBody.includes('推理任务详情'));
    check('SVG 查看器渲染', (await page.locator('.ant-drawer-body svg[aria-label="AI 异常区域查看器"]').count()) > 0);
    check('异常区域列表', drawerBody.includes('异常区域列表'));
    check('坐标信息', drawerBody.includes('坐标 ('));
    const findingItems = await page.locator('.ant-drawer-body div[style*="cursor: pointer"]').count();
    check('异常区域可点击项', findingItems >= 2, `items=${findingItems}`);

    // 点击第一个异常区域 → 高亮
    const borderBefore = await page.locator('.ant-drawer-body div[style*="cursor: pointer"]').first()
      .evaluate((el) => getComputedStyle(el).borderColor);
    await page.locator('.ant-drawer-body div[style*="cursor: pointer"]').first().click();
    await page.waitForTimeout(400);
    const borderAfter = await page.locator('.ant-drawer-body div[style*="cursor: pointer"]').first()
      .evaluate((el) => getComputedStyle(el).borderColor);
    check('点击异常区域 → 查看器高亮', borderAfter.includes('239, 68, 68') || borderBefore !== borderAfter, `${borderBefore} -> ${borderAfter}`);
    // 关闭 Drawer (释放遮罩)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }

  // 任务轮询下队列推进: 触发新推理任务
  await page.locator('button:has-text("触发推理")').click();
  await page.waitForTimeout(600);
  const trigModal = await page.locator('.ant-modal:visible').textContent();
  check('触发推理 Modal', trigModal.includes('触发 AI 推理'));
  await page.locator('.ant-modal:visible .ant-select').nth(0).click();
  await page.waitForTimeout(500);
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').first().click();
  await page.waitForTimeout(300);
  await page.locator('.ant-modal:visible input[placeholder="如：EX-5123"]').fill('EX-7777');
  await page.locator('.ant-modal:visible button', { hasText: /触\s*发/ }).click();
  await page.waitForTimeout(1500);
  const jobsBody2 = await page.locator('body').textContent();
  check('新任务进入队列', jobsBody2.includes('EX-7777'), '新任务已创建 (排队/推理中)');

  // 等待队列推进 → RUNNING/COMPLETED (轮询 4s)
  await page.waitForTimeout(6000);
  const jobsBody3 = await page.locator('body').textContent();
  check('队列模拟推进', jobsBody3.includes('推理中') || jobsBody3.includes('已完成'), '状态从排队中推进');

  check('无页面崩溃', !consoleErrors.some((e) => e.includes('TypeError') || e.includes('is not defined') || e.includes('Minified React')), consoleErrors.join(' | ').slice(0, 200));
} catch (err) {
  check('脚本执行', false, String(err).slice(0, 300));
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n[结果] ${results.length - failed}/${results.length} PASS`);
if (consoleErrors.length) {
  console.log('\n[控制台错误]');
  consoleErrors.slice(0, 8).forEach((e) => console.log('  - ' + e));
}
await browser.close();
process.exit(failed > 0 ? 1 : 0);



