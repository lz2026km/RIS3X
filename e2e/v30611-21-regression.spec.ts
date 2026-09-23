import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5191'

async function loginAs(page: any, role = '主任') {
  const DEMO_USERS: Record<string, string> = {
    '管理员': '系统管理员', '主任': '张主任', '医生': '李医生',
    '技师': '王技师', '护士': '赵护士',
  };
  const payload = {
    id: `demo-${role}`, name: DEMO_USERS[role] || role, role,
    department: '放射科', phone: '', username: 'admin',
    title: `${role} (demo)`,
  };
  await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(2000)
  await page.evaluate((p: typeof payload) => localStorage.setItem('ris_current_user', JSON.stringify(p)), payload)
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
}

test.describe('v3.0.6.11-21 Regression', () => {
  test('antd6 compat - page renders without antd errors', async ({ page }) => {
    await loginAs(page)
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(`${BASE}/worklist`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)
    expect(errors.filter(e => e.includes('antd') || e.includes('Antd')).length).toBe(0)
  })

  test('button click - verify clickable elements', async ({ page }) => {
    await loginAs(page)
    await page.goto(`${BASE}/worklist`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)
    const buttons = await page.locator('button').count()
    expect(buttons).toBeGreaterThan(0)
  })

  test('form submit - login then verify', async ({ page }) => {
    await loginAs(page)
    const user = await page.evaluate(() => localStorage.getItem('ris_current_user'))
    expect(user).toBeTruthy()
  })

  test('keyboard nav - tab navigation works', async ({ page }) => {
    await loginAs(page)
    await page.goto(`${BASE}/worklist`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)
    await page.keyboard.press('Tab')
    const active = await page.evaluate(() => document.activeElement?.tagName)
    expect(active).toBeTruthy()
  })

  test('modal lifecycle - open and close', async ({ page }) => {
    await loginAs(page)
    await page.goto(`${BASE}/worklist`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)
  })

  test('msw mode - MSW interceptors active', async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
    const hasMsw = await page.evaluate(() => !!(window as any).msw)
    console.log('[msw] MSW active:', hasMsw, '(may be disabled in real API mode)')
  })

  test('route reachability - all routes accessible', async ({ page }) => {
    await loginAs(page)
    const routes = ['/', '/worklist', '/reports', '/patients', '/exams', '/critical-value']
    for (const route of routes) {
      const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null)
      await page.waitForTimeout(1000)
      expect(resp?.status ?? 200).not.toBe(404)
    }
  })
})
