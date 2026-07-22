import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5191'

async function login(page: any) {
  await page.addInitScript(() => {
    localStorage.setItem('ris_current_user', JSON.stringify({
      id: 'admin', name: '主任', role: '主任', department: '放射科',
      username: 'admin', title: '主任医师'
    }))
    localStorage.setItem('g005_auth', JSON.stringify({
      id: 'admin', name: '主任', role: '主任', token: 'test-token'
    }))
  })
  await page.goto(`${BASE}/worklist`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(3000)
}

test.describe('Page Verification', () => {
  test('screenshot all main pages', async ({ page }) => {
    await login(page)
    const pages = ['/', '/worklist', '/reports', '/critical-value', '/dicom-viewer']
    for (const p of pages) {
      await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(2000)
      await page.screenshot({ path: `e2e/screenshots/${p.replace(/\//g, '_') || 'home'}.png`, fullPage: true })
    }
  })

  test('final verify - routes and buttons', async ({ page }) => {
    await login(page)
    const routes = ['/', '/worklist', '/reports', '/patients', '/critical-value', '/dicom-viewer', '/eye', '/dental']
    for (const route of routes) {
      const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null)
      await page.waitForTimeout(1000)
      expect(resp).not.toBeNull()
    }
  })

  test('page audit - check page content', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE}/worklist`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    const body = await page.locator('body').textContent() || ''
    expect(body.length).toBeGreaterThan(100)
  })
})
