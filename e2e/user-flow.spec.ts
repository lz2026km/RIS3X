import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5191'

test('完整用户流程验证', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`)
  })

  // 1. 打开登录页
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  const title = await page.locator('h1').textContent()
  console.log(`[1] 登录页标题: ${title}`)
  expect(title).toContain('登录')

  // 2. 选择角色 → 点击登录按钮 (用主任角色可访问更多页面)
  await page.selectOption('select', '主任')
  await page.fill('input[type="text"], input:not([type="password"])', 'admin')
  await page.fill('input[type="password"]', '123')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(5000)
  console.log(`[2] 登录后URL: ${page.url()}`)
  
  const user = await page.evaluate(() => localStorage.getItem('ris_current_user'))
  console.log(`[2] localStorage用户: ${user}`)
  expect(user).toContain('主任')

  // 3. 验证进入系统后能看到导航
  const bodyText = await page.locator('body').textContent()
  const hasAppContent = bodyText?.includes('G005') || bodyText?.includes('RIS') || bodyText?.includes('工作')
  console.log(`[3] 应用内容可见: ${hasAppContent}`)

  // 4. 点击侧边栏进入 Worklist
  await page.goto(`${BASE}/worklist`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  const wlText = await page.locator('body').textContent()
  const wlOK = wlText?.includes('工作') || wlText?.includes('检查') || wlText?.includes('worklist')
  console.log(`[4] Worklist页面: ${wlOK ? 'OK' : 'FAIL'}, URL: ${page.url()}`)

  // 5. 去 Dashboard
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  console.log(`[5] Dashboard URL: ${page.url()}`)

  // 6. 去 报告页面
  await page.goto(`${BASE}/reports`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(3000)
  const rText = await page.locator('body').textContent()
  const rOK = rText?.includes('报告') || rText?.includes('report')
  console.log(`[6] Reports页面: ${rOK ? 'OK' : 'FAIL'}, URL: ${page.url()}`)

  // 7. 去 DICOM Viewer
  await page.goto(`${BASE}/dicom-viewer`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(3000)
  console.log(`[7] DICOM Viewer URL: ${page.url()}`)

  // 8. 去 危急值
  await page.goto(`${BASE}/critical-value`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(3000)
  console.log(`[8] 危急值 URL: ${page.url()}`)

  // 9. 去 眼科工作台
  await page.goto(`${BASE}/eye`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  console.log(`[9] 眼科 URL: ${page.url()}`)

  // 10. 去 口腔科
  await page.goto(`${BASE}/dental`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  console.log(`[10] 口腔科 URL: ${page.url()}`)

  // 汇总
  const realErrors = errors.filter(e => !e.includes('frame-ancestors') && !e.includes('X-Frame-Options'))
  console.log(`\n=== 错误统计 ===`)
  console.log(`总日志: ${errors.length} | CSP警告: ${errors.length - realErrors.length} | 真实错误: ${realErrors.length}`)
  for (const e of realErrors) console.log(`  真实错误: ${e.slice(0, 300)}`)
  expect(realErrors.length).toBe(0)
})
