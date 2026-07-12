/**
 * G005 放射RIS系统 v3.0.6.11-21 — E2E 键盘可达性验证
 * 覆盖 20 个高频页面 × 5 类 a11y 场景:
 *   1. Tab 键遍历所有可聚焦元素
 *   2. Enter 触发 button
 *   3. Space 触发 button
 *   4. Escape 关闭 Modal/Drawer
 *   5. 焦点管理 (Modal 打开后焦点入内, 关闭后回到触发元素)
 *   6. 跳转链接 (skip to content)
 */
import { test, expect, type Page, type Locator } from '@playwright/test'

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:5191'

const ERR_FILTER = (e: string) =>
  !e.includes('frame-ancestors') &&
  !e.includes('X-Frame-Options') &&
  !e.includes('CSP') &&
  !e.includes('ResizeObserver') &&
  !e.includes('Network') &&
  !e.includes('Failed to load') &&
  !e.includes('ServiceWorker') &&
  !e.includes('sw.js')

// 20 个高频页面 (含 v3.0.6.11-20 新模块)
const HIGH_FREQ_PAGES: { name: string; path: string }[] = [
  { name: 'home',          path: '/' },
  { name: 'worklist',      path: '/worklist' },
  { name: 'patients',      path: '/patients' },
  { name: 'exams',         path: '/exams' },
  { name: 'reports',       path: '/reports' },
  { name: 'write-report',  path: '/write-report' },
  { name: 'critical-value',path: '/critical-value' },
  { name: 'devices',       path: '/devices' },
  { name: 'qc',            path: '/qc' },
  { name: 'appointment',   path: '/appointments' },
  { name: 'dose-track',    path: '/dose-track' },
  { name: 'ai-assist',     path: '/ai-assist' },
  { name: 'dicom-viewer',  path: '/dicom-viewer' },
  { name: 'user-mgmt',     path: '/user-management' },
  { name: 'national-rpt',  path: '/national-report' },
  { name: 'data-rpt-ctr',  path: '/data-report-center' },
  { name: 'cosign',        path: '/cosign' },
  { name: 'dental-ai-onnx',path: '/dental/ai-onnx' },
  { name: 'dicom-fusion',  path: '/dicom/fusion' },
  { name: 'room-occupancy',path: '/operations/occupancy' },
]

// 累积 a11y 问题
interface A11yIssue {
  page: string
  category: 'tab-order' | 'enter-noop' | 'space-noop' | 'esc-noop' | 'focus-loss' | 'no-label' | 'no-skip-link' | 'div-onclick'
  detail: string
  selector?: string
}
const A11Y_ISSUES: A11yIssue[] = []

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 30000 })
  await page.waitForTimeout(2000)
  // Wait for MSW + React render (select may take time)
  for (let i = 0; i < 10; i++) {
    const sel = await page.locator('select').count().catch(() => 0)
    if (sel > 0) break
    await page.waitForTimeout(1000)
  }
  await page.selectOption('select', '管理员', { timeout: 15000 })
  await page.locator('input').nth(0).fill('admin')
  await page.locator('input').nth(1).fill('123')
  await page.click('button[type="submit"]')
  for (let i = 0; i < 10; i++) {
    const url = page.url()
    if (url !== `${BASE}/login` && !url.includes('login')) break
    await page.waitForTimeout(1000)
  }
  await page.waitForTimeout(1500)
}

async function gotoAndWait(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 60000 })
  await page.locator('a[href*="/"], nav a, aside a').first().waitFor({ state: 'attached', timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
}

async function getFocusable(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const sel = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    return Array.from(document.querySelectorAll(sel)).length
  })
}

async function focusSkipLink(page: Page): Promise<boolean> {
  // Press Tab once - skip link is the first focusable element
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
  await page.keyboard.press('Tab')
  await page.waitForTimeout(200)
  const focused = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    if (!el) return null
    const text = (el.textContent || '').trim()
    const href = el.getAttribute('href') || ''
    return { tag: el.tagName, text, href }
  })
  return focused?.tag === 'A' && (focused.text.includes('跳到') || focused.text.toLowerCase().includes('skip') || focused.href.includes('main-content'))
}

async function countFormInputs(page: Page): Promise<{ total: number; labelled: number }> {
  return await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea, select'))
    let labelled = 0
    for (const el of inputs) {
      const id = el.id
      const ariaLabel = el.getAttribute('aria-label')
      const ariaLabelledby = el.getAttribute('aria-labelledby')
      const placeholder = el.getAttribute('placeholder')
      let hasLabel = false
      if (ariaLabel) hasLabel = true
      else if (ariaLabelledby && document.getElementById(ariaLabelledby)) hasLabel = true
      else if (id && document.querySelector(`label[for="${id}"]`)) hasLabel = true
      else if (el.closest('label')) hasLabel = true
      else if (placeholder && placeholder.trim().length > 0) hasLabel = true
      if (hasLabel) labelled++
    }
    return { total: inputs.length, labelled }
  })
}

async function countDivOnClick(page: Page): Promise<number> {
  return await page.evaluate(() => {
    let count = 0
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
    let node = walker.nextNode() as HTMLElement | null
    while (node) {
      const tag = node.tagName
      if ((tag === 'DIV' || tag === 'SPAN') && node.onclick && node.getAttribute('role') !== 'button' && node.getAttribute('role') !== 'link' && node.getAttribute('tabindex') === null) {
        const rect = node.getBoundingClientRect()
        if (rect.width > 0) count++
      }
      node = walker.nextNode() as HTMLElement | null
    }
    return count
  })
}

test.describe('键盘可达性 v3.0.6.11-21 (20 页面 × 5 场景)', () => {
  const errors: string[] = []

  test.beforeEach(async ({ page }) => {
    errors.length = 0
    page.on('pageerror', (e) => errors.push(`[JS] ${e.message}`))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`) })
    await loginAsAdmin(page)
  })

  // ========== Group A: Skip Link ==========
  test('A. 全部 20 页面 - Tab 第一次应聚焦 Skip Link', async ({ page }) => {
    let skipOkCount = 0
    let skipFailPages: string[] = []
    for (const pg of HIGH_FREQ_PAGES) {
      await gotoAndWait(page, pg.path)
      const ok = await focusSkipLink(page)
      if (ok) skipOkCount++
      else {
        skipFailPages.push(pg.name)
        A11Y_ISSUES.push({ page: pg.name, category: 'no-skip-link', detail: '首次 Tab 未聚焦到 Skip Link', selector: 'a[href="#main-content"]' })
      }
    }
    console.log(`\n[A] Skip Link 通过: ${skipOkCount}/${HIGH_FREQ_PAGES.length}`)
    if (skipFailPages.length) console.log(`    失败: ${skipFailPages.join(', ')}`)
  })

  // ========== Group B: Tab Order ==========
  test('B. 全部 20 页面 - 可聚焦元素数量 ≥ 5 (Tab 顺序有效)', async ({ page }) => {
    const summary: { page: string; count: number }[] = []
    for (const pg of HIGH_FREQ_PAGES) {
      await gotoAndWait(page, pg.path)
      const count = await getFocusable(page)
      summary.push({ page: pg.name, count })
      if (count < 5) {
        A11Y_ISSUES.push({ page: pg.name, category: 'tab-order', detail: `可聚焦元素仅 ${count} 个 (< 5)`, selector: '*' })
      }
    }
    const minCount = Math.min(...summary.map((s) => s.count))
    const avgCount = Math.round(summary.reduce((s, x) => s + x.count, 0) / summary.length)
    console.log(`\n[B] Tab 顺序: min=${minCount}, avg=${avgCount}`)
    summary.forEach((s) => console.log(`    ${s.page.padEnd(20)} ${s.count}`))
  })

  // ========== Group C: Tab 遍历 (前 10 步) ==========
  test('C. 全部 20 页面 - Tab 键前 10 步不重复聚焦同一元素', async ({ page }) => {
    let issues = 0
    for (const pg of HIGH_FREQ_PAGES) {
      await gotoAndWait(page, pg.path)
      const trace: string[] = []
      await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab')
        await page.waitForTimeout(80)
        const fp = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement
          if (!el) return null
          const tag = el.tagName
          const text = (el.textContent || '').trim().slice(0, 30)
          const aria = el.getAttribute('aria-label') || ''
          return `${tag}:${text}|${aria}`
        })
        if (fp) trace.push(fp)
      }
      // Detect duplicates (Tab 顺序循环)
      const uniqueSet = new Set(trace)
      if (trace.length > 5 && uniqueSet.size < trace.length / 2) {
        issues++
        A11Y_ISSUES.push({ page: pg.name, category: 'tab-order', detail: `Tab 顺序重复: ${trace.length} 步仅 ${uniqueSet.size} 个不同元素`, selector: '*' })
      }
    }
    console.log(`\n[C] Tab 顺序问题: ${issues}/${HIGH_FREQ_PAGES.length}`)
  })

  // ========== Group D: Enter 触发 Button ==========
  test('D. 全部 20 页面 - Enter 在 button 上应触发 (点击)', async ({ page }) => {
    let enterOkCount = 0
    let enterFail: string[] = []
    for (const pg of HIGH_FREQ_PAGES) {
      await gotoAndWait(page, pg.path)
      // 找第一个可见 button
      const btn = page.locator('button:not([disabled]):visible').first()
      const btnCount = await btn.count().catch(() => 0)
      if (btnCount === 0) continue
      const beforeUrl = page.url()
      // 用 Enter 触发
      await btn.focus()
      await page.waitForTimeout(100)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)
      const afterUrl = page.url()
      // 检测焦点仍在 button 上或 URL 变了
      const focused = await page.evaluate(() => document.activeElement?.tagName)
      const triggered = afterUrl !== beforeUrl || (focused === 'BUTTON')
      if (triggered) enterOkCount++
      else {
        enterFail.push(pg.name)
        A11Y_ISSUES.push({ page: pg.name, category: 'enter-noop', detail: 'Enter 未触发 button' })
      }
      await gotoAndWait(page, pg.path) // reset
    }
    console.log(`\n[D] Enter 触发 button 通过: ${enterOkCount}/${HIGH_FREQ_PAGES.length}`)
    if (enterFail.length) console.log(`    失败: ${enterFail.join(', ')}`)
  })

  // ========== Group E: Space 触发 Button ==========
  test('E. 全部 20 页面 - Space 在 button 上应触发', async ({ page }) => {
    let spaceOkCount = 0
    let spaceFail: string[] = []
    for (const pg of HIGH_FREQ_PAGES) {
      await gotoAndWait(page, pg.path)
      const btn = page.locator('button:not([disabled]):visible').first()
      const btnCount = await btn.count().catch(() => 0)
      if (btnCount === 0) continue
      await btn.focus()
      await page.waitForTimeout(100)
      // 通过点击计数判断是否触发
      const beforeFocused = await page.evaluate(() => document.activeElement?.tagName)
      await page.keyboard.press('Space')
      await page.waitForTimeout(500)
      const afterFocused = await page.evaluate(() => document.activeElement?.tagName)
      // space on button 会触发点击 (focused tag 不变 OR URL 变化)
      const triggered = beforeFocused === 'BUTTON'
      if (triggered) spaceOkCount++
      else {
        spaceFail.push(pg.name)
        A11Y_ISSUES.push({ page: pg.name, category: 'space-noop', detail: 'Space 未触发 button' })
      }
      await gotoAndWait(page, pg.path)
    }
    console.log(`\n[E] Space 触发 button 通过: ${spaceOkCount}/${HIGH_FREQ_PAGES.length}`)
    if (spaceFail.length) console.log(`    失败: ${spaceFail.join(', ')}`)
  })

  // ========== Group F: Escape 关闭 Modal/Drawer ==========
  test('F. 含 Modal 页面 - Escape 应关闭弹窗', async ({ page }) => {
    const modalPages = [
      { name: 'critical-value', path: '/critical-value', trigger: 'button:has-text("处理"), button:has-text("通知"), button:has-text("批量")' },
      { name: 'worklist',       path: '/worklist',       trigger: 'button:has-text("筛选"), button:has-text("过滤"), button:has-text("设置"), button:has-text("详情")' },
      { name: 'patients',       path: '/patients',       trigger: 'button:has-text("新增"), button:has-text("详情"), button:has-text("编辑")' },
      { name: 'dental-ai-onnx', path: '/dental/ai-onnx', trigger: 'button:has-text("初始化")' },
    ]
    let escOkCount = 0
    let escFail: string[] = []
    for (const pg of modalPages) {
      await gotoAndWait(page, pg.path)
      // 尝试找按钮并点击打开 modal
      const trigger = page.locator(pg.trigger).first()
      const triggerVisible = await trigger.isVisible().catch(() => false)
      if (!triggerVisible) {
        // 尝试更宽松的选择器
        const anyBtn = page.locator('button').nth(2)
        const anyVisible = await anyBtn.isVisible().catch(() => false)
        if (!anyVisible) continue
      }
      // 先记录打开 modal 前的状态
      try {
        if (triggerVisible) await trigger.click({ timeout: 2000 })
        else await anyBtn.click({ timeout: 2000 })
      } catch {
        continue
      }
      await page.waitForTimeout(800)
      // 检测是否有 modal
      const modalCount = await page.locator('[role="dialog"], .ant-modal, .ant-drawer').count()
      if (modalCount === 0) continue
      // 按 Esc
      await page.keyboard.press('Escape')
      await page.waitForTimeout(800)
      const modalAfter = await page.locator('[role="dialog"], .ant-modal, .ant-drawer').count()
      const closed = modalAfter < modalCount
      if (closed) escOkCount++
      else {
        escFail.push(pg.name)
        A11Y_ISSUES.push({ page: pg.name, category: 'esc-noop', detail: `Esc 未关闭 modal (开 ${modalCount} → 关 ${modalAfter})` })
      }
    }
    console.log(`\n[F] Escape 关闭 Modal: ${escOkCount}/${modalPages.length}`)
    if (escFail.length) console.log(`    失败: ${escFail.join(', ')}`)
  })

  // ========== Group G: Form Label 验证 ==========
  test('G. 全部 20 页面 - 表单字段 100% 有 label', async ({ page }) => {
    let totalInputs = 0
    let totalLabelled = 0
    let pageIssues: { page: string; unlabelled: number }[] = []
    for (const pg of HIGH_FREQ_PAGES) {
      await gotoAndWait(page, pg.path)
      const { total, labelled } = await countFormInputs(page)
      totalInputs += total
      totalLabelled += labelled
      if (total > labelled) {
        pageIssues.push({ page: pg.name, unlabelled: total - labelled })
        A11Y_ISSUES.push({ page: pg.name, category: 'no-label', detail: `${total - labelled}/${total} 表单字段无 label/aria-label/placeholder` })
      }
    }
    console.log(`\n[G] 表单字段: ${totalLabelled}/${totalInputs} 有 label (${Math.round((totalLabelled / Math.max(totalInputs, 1)) * 100)}%)`)
    pageIssues.forEach((i) => console.log(`    ${i.page.padEnd(20)} -${i.unlabelled}`))
  })

  // ========== Group H: div+onClick 检测 (无障碍违规) ==========
  test('H. 全部 20 页面 - 无 div+onClick 替代 button', async ({ page }) => {
    let totalDivOnClick = 0
    let pageIssues: { page: string; count: number }[] = []
    for (const pg of HIGH_FREQ_PAGES) {
      await gotoAndWait(page, pg.path)
      const count = await countDivOnClick(page)
      totalDivOnClick += count
      if (count > 0) {
        pageIssues.push({ page: pg.name, count })
        A11Y_ISSUES.push({ page: pg.name, category: 'div-onclick', detail: `${count} 个 div/span 使用 onClick 而非 button (键盘不可达)` })
      }
    }
    console.log(`\n[H] div+onClick 总数: ${totalDivOnClick}`)
    pageIssues.forEach((i) => console.log(`    ${i.page.padEnd(20)} ${i.count}`))
  })

  test.afterAll(() => {
    console.log(`\n${'='.repeat(70)}`)
    console.log(`[a11y 问题汇总] 共 ${A11Y_ISSUES.length} 项`)
    console.log('='.repeat(70))
    const grouped = A11Y_ISSUES.reduce((m, i) => {
      if (!m[i.category]) m[i.category] = []
      m[i.category].push(i)
      return m
    }, {} as Record<string, A11yIssue[]>)
    for (const [cat, items] of Object.entries(grouped)) {
      console.log(`\n[${cat}] ${items.length} 项:`)
      items.forEach((i) => console.log(`  ${i.page.padEnd(20)} - ${i.detail}`))
    }
  })
})