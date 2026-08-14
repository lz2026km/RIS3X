// [Wave6B spot-check] /ops/tech-schedule 交互验证: 月历渲染/新建/批量/换班/请假/统计
import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5191';
const ADMIN_USER = JSON.stringify({ id: 'A001', name: '系统管理员', role: '管理员', department: '信息科', token: 'admin-200x200' });
const G005_AUTH = JSON.stringify({ token: 'admin-200x200', role: '管理员', userId: 'A001', username: '系统管理员' });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.addInitScript(([user, auth]) => {
    localStorage.setItem('ris_current_user', user);
    localStorage.setItem('g005_auth', auth);
  }, [ADMIN_USER, G005_AUTH]);

  const report = {};
  try {
    await page.goto(`${BASE}/ops/tech-schedule`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="tech-schedule-page"]', { timeout: 30000 });
    await page.waitForTimeout(2500);

    // 1. 统计卡
    const kpiText = await page.locator('text=本月班次').locator('xpath=ancestor::div[contains(@style,"padding: 14px 18px")]').first().innerText().catch(() => '');
    report.kpiCards = kpiText.split('\n').filter(Boolean).slice(0, 2);
    const nightKpi = await page.locator('text=夜班').count();
    report.nightKpiExists = nightKpi > 0;

    // 2. 月历矩阵: 表格存在 + 有班次 Tag
    const tags = await page.locator('.ant-tag').count();
    report.shiftTagsRendered = tags;
    const headerCells = await page.locator('thead th').count();
    report.calendarHeaderCells = headerCells;

    // 3. 数据源徽标
    const badge = await page.locator('span:has-text("tech-schedules API")').count();
    report.apiBadge = badge > 0;

    // 4. 新建排班
    await page.getByRole('button', { name: '新建排班' }).first().click();
    await page.waitForTimeout(500);
    await page.locator('.ant-modal:visible').waitFor({ timeout: 5000 });
    await page.fill('[data-testid="ts-create-date"]', '2026-09-15');
    await page.locator('.ant-modal:visible .ant-select').first().click();
    await page.waitForTimeout(300);
    await page.locator('.ant-select-dropdown:visible .ant-select-item').first().click();
    await page.locator('.ant-modal:visible .ant-select').nth(1).click();
    await page.waitForTimeout(300);
    await page.locator('.ant-select-dropdown:visible .ant-select-item').nth(1).click();
    await page.getByRole('button', { name: '确 定' }).last().click();
    await page.waitForTimeout(1200);
    const createToast = await page.locator('.ant-message:visible').innerText().catch(() => '');
    report.createToast = createToast.replace('\n', ' ');

    // 5. 批量生成
    await page.getByRole('button', { name: '批量生成' }).click();
    await page.waitForTimeout(500);
    const modalCount = await page.locator('.ant-modal:visible').count();
    report.batchModalOpened = modalCount > 0;
    await page.getByRole('button', { name: '确 定' }).last().click();
    await page.waitForTimeout(1200);
    const batchToast = await page.locator('.ant-message:visible').innerText().catch(() => '');
    report.batchToast = batchToast.replace('\n', ' ');

    // 6. 单元格详情 + 请假
    await page.locator('tbody td .ant-tag').first().click();
    await page.waitForTimeout(500);
    const detailModal = await page.locator('.ant-modal:visible').count();
    report.detailModalOpened = detailModal > 0;
    await page.getByRole('button', { name: '请假' }).first().click();
    await page.waitForTimeout(400);
    await page.locator('.ant-modal:visible input[type="text"]').first().fill('spot-check 请假补位');
    await page.getByRole('button', { name: '确 定' }).last().click();
    await page.waitForTimeout(1200);
    const leaveToast = await page.locator('.ant-message:visible').innerText().catch(() => '');
    report.leaveToast = leaveToast.replace('\n', ' ');

    // 7. 换班
    await page.locator('tbody td .ant-tag').first().click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: '换班' }).first().click();
    await page.waitForTimeout(400);
    await page.locator('.ant-modal:visible .ant-select').first().click();
    await page.waitForTimeout(300);
    await page.locator('.ant-select-dropdown:visible .ant-select-item').first().click();
    await page.getByRole('button', { name: '确 定' }).last().click();
    await page.waitForTimeout(1200);
    const swapToast = await page.locator('.ant-message:visible').innerText().catch(() => '');
    report.swapToast = swapToast.replace('\n', ' ');

    // 8. 技师班次分布表
    const distRows = await page.locator('text=技师班次分布').count();
    report.distributionSection = distRows > 0;
  } catch (e) {
    report.fatal = String(e).slice(0, 300);
  }

  report.pageErrors = errors.slice(0, 6);
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})();
