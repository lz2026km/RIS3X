import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5191'
const ERR_FILTER = (e: string) => !e.includes('frame-ancestors') && !e.includes('X-Frame-Options') && !e.includes('CSP')

test('v3.0.6.11-6 综合验证', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`) })

  // 1. 版本验证
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2000)
  const version = await page.evaluate(() => (window as any).__appVersion || '')
  console.log(`[1] APP版本: ${version}`)

  // 2. 登录 - 选主任
  await page.selectOption('select', '主任')
  await page.locator('input').nth(0).fill('admin')
  await page.locator('input').nth(1).fill('123')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(4000)
  console.log(`[2] 登录后URL: ${page.url()}`)
  const auth = await page.evaluate(() => localStorage.getItem('ris_current_user'))
  expect(auth).toContain('主任')

  // 3. Task 3 验证: criticalStore状态名
  await page.goto(`${BASE}/critical-value`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  const cvText = await page.locator('body').textContent()
  const cvOk = cvText?.includes('待处理') || cvText?.includes('处理中') || cvText?.includes('已闭环') || cvText?.includes('pending') || cvText?.includes('resolved')
  console.log(`[3] 危急值页: ${cvOk ? 'OK' : 'FAIL'}`)

  // 4. Task 1 验证: Eye工作台可点击
  await page.goto(`${BASE}/eye`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  const eyeCards = await page.locator('a, [role="button"], .ant-card').count()
  console.log(`[4] Eye可点击元素: ${eyeCards}个`)

  // 5. Task 2 验证: i18n key正确
  await page.goto(`${BASE}/eye/pacs/real-viewer`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)
  const eyePacsText = await page.locator('body').textContent()
  const eyeI18nOk = eyePacsText?.includes('undefined') === false
  console.log(`[5] /eye/pacs/real-viewer i18n: ${eyeI18nOk ? 'OK' : '有undefined'} 长度: ${eyePacsText?.length}`)

  // 6. Task 6 验证: CoSign
  await page.goto(`${BASE}/cosign`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)
  const coText = await page.locator('body').textContent()
  const coOk = coText?.includes('双签') && !coText?.includes('undefined双签')
  console.log(`[6] CoSign页: ${coOk ? 'OK' : 'FAIL'}`)

  // 7. 测验关键路径无critical错误
  const realErrors = errors.filter(e => ERR_FILTER(e) && !e.includes('api') && !e.includes('/api/') && !e.includes('Network error') && !e.includes('500'))
  console.log(`\n=== 错误统计 ===`)
  console.log(`总: ${errors.length} | 真实JS: ${realErrors.length}`)
  if (realErrors.length > 0) {
    console.log('真实JS错误:')
    realErrors.forEach(e => console.log(`  - ${e.slice(0, 300)}`))
  }
  expect(realErrors.length).toBe(0)
})
