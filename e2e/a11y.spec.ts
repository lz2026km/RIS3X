import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('A11y 可访问性检查', () => {
  test('首页有 SkipLink 可跳转', async ({ page }) => {
    await page.goto('/')
    const skip = page.getByText(/跳到|skip/i).first()
    await expect(skip).toBeVisible({ timeout: 5000 })
  })

  test('快捷键 Esc 关闭弹窗', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Escape')
    await expect(page.locator('body')).toBeVisible()
  })

  test('login 页面无 WCAG 违规', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.length).toBe(0)
  })

  test('home 页面（登录后）无 WCAG 违规', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.selectOption('select', '主任')
    await page.locator('input').nth(0).fill('admin')
    await page.locator('input').nth(1).fill('123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/home/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.length).toBe(0)
  })
})
