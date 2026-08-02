/**
 * G005 放射RIS系统 v3.0.1 - E2E: 协同
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
  await page.waitForURL((url) => url.pathname !== '/login', { timeout: 10000 })
  await page.waitForTimeout(2000)
}

test.describe('Collaboration (E2E)', () => {
  test('访问 /collaboration 渲染协同页', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE}/collaboration`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    const body = await page.locator('body').textContent()
    expect(body).toContain('协同')
  })

  test('访问 /consultation 渲染会诊页', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE}/consultation`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    const body = await page.locator('body').textContent()
    expect(body).toContain('会诊')
  })
})
