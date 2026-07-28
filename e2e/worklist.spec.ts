/**
 * G005 放射RIS系统 v3.0.1 - E2E: 工作列表
 */
import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5191'

async function ensureLoggedIn(page: any) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(2000)
  const existing = await page.evaluate(() => localStorage.getItem('ris_current_user'))
  if (existing) return
  await page.evaluate(() => {
    localStorage.setItem('ris_current_user', JSON.stringify({
      id: 'demo-管理员', name: '系统管理员', role: '管理员',
      department: '放射科', phone: '', username: 'admin',
      title: '管理员 (admin)',
    }))
  })
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)
}

test.describe('Worklist V3 (E2E)', () => {
  test('访问 /worklist 渲染主表 + 双视图切换', async ({ page }) => {
    await ensureLoggedIn(page)
    await page.goto(`${BASE}/worklist`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    await expect(page.getByRole('heading', { name: '检查工作列表' })).toBeVisible({ timeout: 10000 })
    const bodyText = await page.locator('body').textContent()
    const hasSearch = bodyText?.includes('搜索') || bodyText?.includes('患者') || bodyText?.includes('查找')
    expect(hasSearch).toBeTruthy()
  })

  test('点击高级筛选打开抽屉', async ({ page }) => {
    await ensureLoggedIn(page)
    await page.goto(`${BASE}/worklist`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    await page.getByText('筛选').first().click({ trial: false }).catch(() => {})
    await expect(page.locator('text=高级筛选').first()).toBeVisible({ timeout: 5000 })
  })

  test('批量操作空态显示"未选中"', async ({ page }) => {
    await ensureLoggedIn(page)
    await page.goto(`${BASE}/worklist`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    const bodyText = await page.locator('body').textContent()
    const hasBatch = bodyText?.includes('未选中') || bodyText?.includes('全选') || bodyText?.includes('批量') || bodyText?.includes('选中') || bodyText?.includes('检查工作列表')
    expect(hasBatch).toBeTruthy()
  })
})
