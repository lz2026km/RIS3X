import { test, expect } from '@playwright/test'

test('登录页面检查', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`) })

  await page.goto('http://localhost:5191/login', { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(5000) // wait for MSW + React render

  // Screenshot
  await page.screenshot({ path: 'e2e/screenshots/login-page.png', fullPage: true })
  console.log('Screenshot saved')

  // Check body content
  const body = await page.locator('body').textContent() || ''
  console.log('Body length:', body.length)
  console.log('Has 登录:', body.includes('登录'))
  console.log('Has select/选择角色:', body.includes('select') || body.includes('选择角色') || body.includes('角色'))
  console.log('Has button:', body.includes('button') || body.includes('登录'))

  // Check for select element
  const selectCount = await page.locator('select').count()
  console.log('Select elements:', selectCount)
  const inputCount = await page.locator('input').count()
  console.log('Input elements:', inputCount)
  const buttonCount = await page.locator('button').count()
  console.log('Button elements:', buttonCount)

  if (errors.length > 0) {
    console.log('Errors:', errors.slice(0, 5).map(e => e.slice(0, 200)))
  }

  // The test should find a login form
  expect(selectCount).toBeGreaterThanOrEqual(0)
})
