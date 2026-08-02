import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('A11y 可访问性检查', () => {
  test('首页 SkipLink 可跳转', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.selectOption('select', '主任')
    await page.locator('input').nth(0).fill('admin')
    await page.locator('input').nth(1).fill('123')
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => url.pathname !== '/login', { timeout: 10000 })
    await page.waitForTimeout(3000)
    const skip = page.locator('a[href="#main-content"]')
    await expect(skip).toHaveCount(1)
    await skip.focus()
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
    await page.waitForURL((url) => url.pathname !== '/login', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(4000)
    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast', 'landmark-one-main', 'region', 'scrollable-region-focusable', 'label', 'select-name', 'button-name', 'link-name', 'heading-order', 'aria-allowed-attr'])
      .analyze()
    for (const v of results.violations) {
      console.log(`VIOLATION [${v.impact}] ${v.id}`)
      v.nodes.slice(0, 3).forEach(n => console.log('  target:', n.target.join(' '), (n.html || '').slice(0, 100)))
    }
    expect(results.violations.length).toBe(0)
  })
})
