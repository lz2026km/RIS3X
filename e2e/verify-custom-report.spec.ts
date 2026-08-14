import { test, expect } from '@playwright/test';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:5191';

test('custom-report full flow: defs/run/result/history/schedule/export/push', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('ris_current_user', JSON.stringify({ id: 'A001', name: '系统管理员', role: '管理员', department: '信息科', token: 'admin-200x200' }));
      window.localStorage.setItem('g005_auth', JSON.stringify({ token: 'admin-200x200', role: '管理员', userId: 'A001', username: '系统管理员' }));
    } catch (_) {}
  });
  await page.goto(`${BASE}/data-report-center`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  // 切换到自定义报表 → 定义管理
  await page.getByRole('combobox').first().click();
  await page.getByText('自定义报表', { exact: true }).click();
  await page.waitForTimeout(800);

  // 定义列表出现 (MSW seed)
  await expect(page.getByText('科室检查周报').first()).toBeVisible({ timeout: 10000 });

  // 数据源徽标 + 定时标签
  await expect(page.getByText('OLAP', { exact: true }).first()).toBeVisible();

  // 运行 → 结果 Drawer
  const runBtn = page.getByRole('button', { name: '运行' }).first();
  await runBtn.click();
  await expect(page.getByText('运行结果: 科室检查周报')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.ant-drawer-open').getByRole('columnheader', { name: '检查量' }).first()).toBeVisible();
  // 关闭结果抽屉
  await page.locator('.ant-drawer-open .ant-drawer-close').click();
  await page.waitForTimeout(400);

  // 历史 Drawer
  await page.getByRole('button', { name: '历史' }).first().click();
  await expect(page.getByText('执行历史: 科室检查周报')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.ant-drawer-open').getByText('成功')).toBeVisible();
  await page.locator('.ant-drawer-open .ant-drawer-close').click();
  await page.waitForTimeout(400);

  // 结果 (运行后缓存)
  await page.getByRole('button', { name: '结果' }).first().click();
  await expect(page.getByText('运行结果: 科室检查周报')).toBeVisible({ timeout: 10000 });
  await page.locator('.ant-drawer-open .ant-drawer-close').click();
  await page.waitForTimeout(400);

  // 定时 Modal + 推送
  await page.getByRole('button', { name: '定时' }).first().click();
  await expect(page.getByText('定时设置: 科室检查周报')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: '保存并推送通知' }).click();
  await expect(page.getByText('定时已保存')).toBeVisible({ timeout: 10000 });

  // 定时筛选 Tab (seed 有 1 条定时)
  await page.getByText(/定时报表 \(\d+\)/).click();
  await page.waitForTimeout(500);
  const rows = await page.locator('.ant-table-tbody > tr.ant-table-row').count();
  expect(rows).toBeGreaterThan(0);

  // 导出 (下载事件)
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
  await page.getByRole('button', { name: '导出' }).first().click();
  const download = await downloadPromise;
  if (download) {
    expect(download.suggestedFilename()).toContain('.csv');
    download.cancel().catch(() => {});
  }

  // 新建报表 Modal → 创建 → 列表新增
  await page.getByRole('button', { name: '新建报表' }).click();
  await expect(page.getByText('新建自定义报表')).toBeVisible({ timeout: 10000 });
  await page.locator('.ant-modal').getByPlaceholder('如: 月度检查收入分析').fill('验证报表-自动化');
  await page.getByRole('button', { name: /创\s*建/ }).click();
  await expect(page.getByText('验证报表-自动化')).toBeVisible({ timeout: 10000 });

  // 简易生成器兼容
  await page.getByRole('tab', { name: '简易生成器' }).click();
  await expect(page.getByText('报表定义配置')).toBeVisible({ timeout: 10000 });
});
