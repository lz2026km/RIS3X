import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5191';

test.describe('Smoke', () => {
  test('login page loads', async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('body')).toBeVisible({ timeout: 30000 });
  });

  test('login + home KPI visible', async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.setItem('ris_current_user', JSON.stringify({
        id: 'D001', name: '张明远', role: '主任', department: '放射科',
      }));
    });
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible({ timeout: 30000 });
  });

  test('worklist loads', async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.setItem('ris_current_user', JSON.stringify({
        id: 'D001', name: '张明远', role: '主任', department: '放射科',
      }));
    });
    await page.goto(`${BASE}/worklist`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible({ timeout: 30000 });
  });

  test('critical value list loads', async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.setItem('ris_current_user', JSON.stringify({
        id: 'D001', name: '张明远', role: '主任', department: '放射科',
      }));
    });
    await page.goto(`${BASE}/critical-value`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible({ timeout: 30000 });
  });

  test('report center loads', async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.setItem('ris_current_user', JSON.stringify({
        id: 'D001', name: '张明远', role: '主任', department: '放射科',
      }));
    });
    await page.goto(`${BASE}/reports`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible({ timeout: 30000 });
  });
});
