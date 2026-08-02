/**
 * G005 放射RIS系统 v3.0.6.8-20 — E2E: 眼科专科模块
 */
import { test, expect } from '@playwright/test'

test.describe('眼科专科模块', () => {
  test.use({ baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:5191' });

  test('眼科工作台加载', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
      localStorage.setItem('ris_current_user', JSON.stringify({
        id: 'D001', name: '张明远', role: '医生', department: '放射科',
      }))
    })
    await page.goto('/eye', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    const body = page.locator('body')
    const text = await body.textContent()
    expect(text).toContain('眼科工作台')
    expect(text).toContain('今日预约')
    expect(text).toContain('今日手术安排')
  })

  test('PACS 影像中心列表加载', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
      localStorage.setItem('ris_current_user', JSON.stringify({
        id: 'D001', name: '张明远', role: '医生', department: '放射科',
      }))
    })
    await page.goto('/eye/pacs', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    const body = page.locator('body')
    const text = await body.textContent()
    expect(text).toContain('眼')
    expect(text).toContain('PACS')
  })

  test('IOL 计算器加载', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
      localStorage.setItem('ris_current_user', JSON.stringify({
        id: 'D001', name: '张明远', role: '医生', department: '放射科',
      }))
    })
    await page.goto('/eye/ris/iol-calculator', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    const body = page.locator('body')
    const text = await body.textContent()
    expect(text).toContain('IOL')
    expect(text).toContain('SRK/T')
    expect(text).toContain('Barrett II')
  })

  test('视力检查加载', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
      localStorage.setItem('ris_current_user', JSON.stringify({
        id: 'D001', name: '张明远', role: '医生', department: '放射科',
      }))
    })
    await page.goto('/eye/ris/va', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    const body = page.locator('body')
    const text = await body.textContent()
    expect(text).toContain('视力')
  })

  test('眼压测量加载', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
      localStorage.setItem('ris_current_user', JSON.stringify({
        id: 'D001', name: '张明远', role: '医生', department: '放射科',
      }))
    })
    await page.goto('/eye/ris/iop', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    const body = page.locator('body')
    const text = await body.textContent()
    expect(text).toContain('眼压')
    expect(text).toContain('mmHg')
  })
})
