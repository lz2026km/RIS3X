// G005 v3.1 患者门户验证: /patient/self-service 6 Tab + 自助预约流程
import { chromium } from 'playwright';

const BASE = 'http://localhost:5191';
const results = [];
const ok = (name, pass, extra = '') => {
  results.push({ name, pass, extra });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 200)); });

try {
  // 先登录 (任意账号, MSW mock)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#login-username', { timeout: 30000 });
  await page.fill('#login-password', 'demo123456');
  await page.click('button:has-text("登录（演示）")');
  await page.waitForTimeout(2500);
  ok('系统登录成功', page.url().includes('/login') === false);

  await page.goto(`${BASE}/patient/self-service`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('text=患者自助服务', { timeout: 60000 });
  ok('门户页渲染', true);

  // 登录
  await page.fill('input[placeholder="手机号 / 身份证号"]', '13800138000');
  await page.click('button:has-text("查询")');
  await page.waitForSelector('text=今日待办', { timeout: 30000 });
  ok('登录成功进入门户', true);

  // 患者身份卡
  const hasName = await page.locator('text=张三').count();
  ok('患者身份卡显示张三', hasName > 0);

  // 6 个 Tab
  const tabLabels = ['首页', '检查预约', '我的报告', '我的影像', '宣教资料', '满意度反馈'];
  for (const t of tabLabels) {
    const c = await page.locator(`[role="tab"]:has-text("${t}")`).count();
    ok(`Tab「${t}」存在`, c > 0);
  }

  // Tab1 首页: 今日待办/预约提醒/报告通知
  const homeHasTodo = await page.locator('text=预约提醒').count();
  ok('首页-预约提醒', homeHasTodo > 0);
  const homeHasReport = await page.locator('text=报告通知').count();
  ok('首页-报告通知', homeHasReport > 0);

  // Tab2 自助预约流程
  await page.click('[role="tab"]:has-text("检查预约")');
  await page.waitForSelector('text=选择检查类型', { timeout: 15000 });
  await page.click('button:has-text("CT 计算机断层")');
  await page.waitForSelector('text=选择检查部位', { timeout: 10000 });
  await page.click('button:has-text("胸部")');
  await page.waitForSelector('text=选择检查日期', { timeout: 10000 });
  // 选今天 (默认月份, 第一个可用日期按钮)
  const dateBtns = page.locator('button[type="button"]:not([disabled])');
  const enabledCount = await dateBtns.count();
  let clickedDate = false;
  for (let i = 0; i < enabledCount; i++) {
    const txt = (await dateBtns.nth(i).textContent())?.trim() ?? '';
    if (/^\d+$/.test(txt) && Number(txt) >= 3) {
      await dateBtns.nth(i).click();
      clickedDate = true;
      ok('日期选择', true, `选中 ${txt} 号`);
      break;
    }
  }
  if (!clickedDate) ok('日期选择', false, '未找到可用日期');
  await page.waitForSelector('text=选择时段', { timeout: 10000 });
  await page.click('button:has-text("09:00")');
  await page.waitForSelector('text=确认预约', { timeout: 10000 });
  await page.click('button:has-text("确认预约")');
  await page.waitForSelector('text=预约成功', { timeout: 15000 });
  ok('自助预约提交成功（预约成功卡片）', true);
  const apptNo = await page.locator('text=AP-P001-').count();
  ok('预约单号生成', apptNo > 0);

  // Tab3 我的报告
  await page.click('[role="tab"]:has-text("我的报告")');
  await page.waitForSelector('text=报告列表', { timeout: 15000 });
  const reportRows = await page.locator('button:has-text("查看报告")').count();
  ok('报告列表渲染', reportRows > 0, `${reportRows} 条`);
  await page.locator('button:has-text("查看报告")').first().click();
  await page.waitForSelector('text=报告详情', { timeout: 10000 });
  const hasDiagnosis = await page.locator('text=诊断意见').count();
  ok('报告详情结构化渲染（诊断意见）', hasDiagnosis > 0);

  // Tab4 我的影像
  await page.click('[role="tab"]:has-text("我的影像")');
  await page.waitForSelector('text=可查看的检查', { timeout: 15000 });
  const viewBtn = page.locator('button:has-text("查看影像")').first();
  const viewCount = await page.locator('button:has-text("查看影像")').count();
  ok('影像检查列表渲染', viewCount > 0, `${viewCount} 项可查看`);
  if (viewCount > 0) {
    await viewBtn.click();
    await page.waitForSelector('text=电子胶片', { timeout: 10000 });
    await page.waitForSelector('input[type="range"]', { timeout: 10000 });
    const wwSlider = await page.locator('input[type="range"]').count();
    ok('影像预览加载(窗宽/窗位滑块)', wwSlider > 0, `${wwSlider} 个滑块`);
    const viewerBtn = await page.locator('button:has-text("打开影像浏览器")').count();
    ok('影像浏览器入口', viewerBtn > 0);
  }

  // Tab5 宣教资料
  await page.click('[role="tab"]:has-text("宣教资料")');
  await page.waitForSelector('text=健康宣教', { timeout: 15000 });
  const eduCount = await page.locator('text=CT检查注意事项').count();
  ok('宣教资料列表渲染', eduCount > 0);
  await page.locator('button:has-text("查看详情")').first().click();
  const eduBody = await page.locator('text=CT检查前需去除金属物品').count();
  ok('宣教详情展开', eduBody > 0);

  // Tab6 满意度反馈
  await page.click('[role="tab"]:has-text("满意度反馈")');
  await page.waitForSelector('text=服务满意度评价', { timeout: 15000 });
  await page.locator('.ant-rate li').nth(4).click();
  const starText = await page.locator('text=非常满意').count();
  ok('星级评分选择(5星)', starText > 0);
  await page.fill('textarea', '检查流程顺畅，报告解读清晰，非常满意！');
  await page.click('button:has-text("提交反馈")');
  await page.waitForSelector('text=感谢您的反馈', { timeout: 15000 });
  ok('反馈提交成功', true);

  // 退出
  await page.click('button:has-text("退出")');
  await page.waitForSelector('input[placeholder="手机号 / 身份证号"]', { timeout: 10000 });
  ok('退出回到登录页', true);
} catch (e) {
  ok('流程执行', false, String(e).slice(0, 300));
  await page.screenshot({ path: 'test-screenshots/portal-fail.png', fullPage: true }).catch(() => {});
}

const passed = results.filter(r => r.pass).length;
console.log(`\n===== 汇总: ${passed}/${results.length} PASS =====`);
await browser.close();
process.exit(passed === results.length ? 0 : 1);
