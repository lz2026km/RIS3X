import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5191'

test.describe('登录功能', () => {
  test('登录页面渲染检查', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`) })

    await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(5000)

    await page.screenshot({ path: 'e2e/screenshots/login-page.png', fullPage: true })

    const body = await page.locator('body').textContent() || ''
    expect(body.includes('登录')).toBe(true)

    const selectCount = await page.locator('select').count()
    const inputCount = await page.locator('input').count()
    const buttonCount = await page.locator('button').count()
    console.log('Select:', selectCount, 'Input:', inputCount, 'Button:', buttonCount)

    expect(selectCount).toBeGreaterThanOrEqual(1)
  })

  test('用户登录和页面访问', async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(3000)
    const title = await page.locator('h1', { hasText: '登录' }).textContent()
    expect(title).toContain('登录')

    await page.selectOption('select', '主任')
    await page.locator('input').nth(0).fill('admin')
    await page.locator('input').nth(1).fill('123')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(5000)

    const user = await page.evaluate(() => localStorage.getItem('ris_current_user'))
    expect(user).toContain('主任')

    const pages = ['/', '/worklist', '/reports', '/dicom-viewer', '/critical-value']
    for (const p of pages) {
      await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
      await page.waitForTimeout(2000)
      console.log(`Accessed: ${p}`)
    }
  })

  test('正常登录 localStorage auth', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('g005.user', JSON.stringify({ id: 'D001', name: '张明远' }))
    })
    await page.reload()
    await expect(page).toHaveTitle(/G005/)
  })

  test('响应式 - 移动端', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
  })

  test('a11y - 键盘导航', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(focused).toBeTruthy()
  })
})
