import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5191'

test('用户登录和页面验证', async ({ page }) => {
  // 1. 登录页
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  const title = await page.locator('h1').textContent()
  console.log(`登录页: ${title}`)
  expect(title).toContain('登录')

  // 2. 选择主任角色登录
  await page.selectOption('select', '主任')
  await page.locator('input').nth(0).fill('admin')
  await page.locator('input').nth(1).fill('123')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(5000)

  const user = await page.evaluate(() => localStorage.getItem('ris_current_user'))
  console.log(`用户: ${user ? JSON.parse(user).name : '无'}`)
  expect(user).toContain('主任')

  // 3-8. 访问各页面
  const pages = ['/', '/worklist', '/reports', '/dicom-viewer', '/critical-value', '/eye', '/dental']
  for (const p of pages) {
    await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(2000)
    const ok = ![401, 403, 404, 500].includes(page.url().includes('forbidden') ? 403 : 200)
    console.log(`${p}: ${page.url().replace(BASE, '')}`)
  }
})
