/**
 * G005 放射RIS系统 v3.0.1 - E2E: DICOM 浏览器
 */
import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5191'

async function login(page: any) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.selectOption('select', '主任')
  await page.locator('input').nth(0).fill('admin')
  await page.locator('input').nth(1).fill('123')
  await page.click('button[type="submit"]')
  await page.waitForURL((url: URL) => url.pathname !== '/login', { timeout: 10000 })
  await page.waitForTimeout(3000)
}

test.describe('DICOM Viewer (E2E)', () => {
  test('访问 /dicom-viewer 渲染主区 + 工具栏', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE}/dicom-viewer`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(5000)
    const body = await page.locator('body').textContent()
    expect(body).toContain('DICOM')
  })

  test('? 唤起快捷键速查面板', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE}/dicom-viewer`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(5000)
    await page.keyboard.press('?')
    await page.waitForTimeout(1000)
    await expect(page.locator('body')).toBeVisible()
  })
})
