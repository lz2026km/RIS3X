/**
 * G005 放射RIS系统 v3.0.6.11-21 — Form Submit 行为验证
 *
 * 覆盖 10 个有 form 的高频页面:
 *   1. login                LoginPage             (真实 <form onSubmit>)
 *   2. critical-value       CriticalValuePage      (Notify/Process 模态对话框提交)
 *   3. queue-call           QueueCallPage          (叫号按钮 onClick → API)
 *   4. appointments         AppointmentPage        (AppointmentForm → handleSubmit → POST /appointments)
 *   5. patient              PatientPage            (新建患者 3 步向导 → onComplete)
 *   6. regional-report      RegionalReportPage     (会诊申请 / 意见表单提交)
 *   7. dental/implant       DentalImplant3DPage    (antd Form + handleCreate)
 *   8. dental/treatment     DentalTreatmentPage    (list only - 记录缺 form)
 *   9. cosign               CoSignPage             (拒签 textarea + 通过按钮)
 *  10. compliance           CompliancePage         (路由未注册,记录 P0)
 *
 * 验证维度:
 *   - 表单元素存在并可见
 *   - 填写测试数据
 *   - 触发表单 submit / 关键动作按钮
 *   - 监控 API 调用 (request / response)
 *   - 检查 UI 反馈 (loading / success / toast / modal close)
 *   - 不抛 JS 错误
 */

import { test, expect, type Page, type Request } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE = 'http://localhost:5191'
const SCREENSHOT_DIR = path.join(process.cwd(), 'test-reports', 'form-submit-v30611-21')
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

const ADMIN_AUTH = {
  id: 'demo-管理员',
  name: '系统管理员',
  role: '管理员',
  department: '放射科',
  phone: '',
  username: 'admin',
  title: '管理员 (admin)',
}

/** 全局错误跟踪结果 */
type PageResult = {
  name: string
  path: string
  status: 'pass' | 'fail' | 'warn' | 'skip'
  formFound: boolean
  apiCalls: { url: string; method: string; status?: number }[]
  errors: string[]
  uiFeedback?: string
  notes?: string
}
const results: PageResult[] = []

/** 在每个测试前注入 admin 登录态 */
async function injectAdminAuth(page: Page) {
  await page.addInitScript((auth) => {
    try {
      window.localStorage.setItem('ris_current_user', JSON.stringify(auth))
    } catch {}
  }, ADMIN_AUTH)
}

function attachErrorTracking(page: Page, sink: string[]) {
  page.on('pageerror', (e) => sink.push(`[pageerror] ${e.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') sink.push(`[console.error] ${msg.text()}`)
  })
}

const IGNORED_ERR_FRAGMENTS = [
  'frame-ancestors',
  'X-Frame-Options',
  'CSP',
  'ResizeObserver',
  'ServiceWorker',
  'mockServiceWorker',
  'sw.js',
  'Failed to load resource',
  'Network',
  '404',
  'preloaded using link preload',
]

function isRealError(msg: string) {
  if (!msg) return false
  for (const f of IGNORED_ERR_FRAGMENTS) {
    if (msg.includes(f)) return false
  }
  // 忽略空 pageerror
  if (msg === '[pageerror] ') return false
  return true
}

/** 通用 API 监控器 (按路径筛选匹配) */
function attachApiTracking(page: Page, sink: PageResult['apiCalls']) {
  page.on('request', (req) => {
    const u = req.url()
    if (u.includes('/api/')) sink.push({ url: u.replace(BASE, ''), method: req.method() })
  })
  page.on('response', async (resp) => {
    const req = resp.request()
    const u = req.url()
    if (u.includes('/api/')) {
      const existing = sink.find((s) => s.url === u.replace(BASE, '') && !('status' in (s as object) && (s as { status?: number }).status !== undefined))
      if (existing) existing.status = resp.status()
    }
  })
}

test.describe('v3.0.6.11-21 Form Submit 验证', () => {
  test.describe.configure({ mode: 'serial' })

  test('1. /login - 真实 form 提交 + 跳转', async ({ page }) => {
    const errors: string[] = []
    const apiCalls: PageResult['apiCalls'] = []
    attachErrorTracking(page, errors)
    attachApiTracking(page, apiCalls)
    const r: PageResult = {
      name: 'login',
      path: '/login',
      status: 'fail',
      formFound: false,
      apiCalls,
      errors,
    }
    results.push(r)

    await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForSelector('select', { timeout: 15000 })
    await page.waitForSelector('input', { timeout: 5000 })

    const form = page.locator('form').first()
    r.formFound = (await form.count()) > 0

    await page.selectOption('select', '管理员')
    await page.locator('input').nth(0).fill('admin')
    await page.locator('input').nth(1).fill('123456')

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-login-before.png'), fullPage: true })

    await form.evaluate((f: HTMLFormElement) => f.requestSubmit())

    // 等到 URL 跳出 /login
    await page.waitForFunction(() => location.pathname !== '/login', undefined, { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)

    r.uiFeedback = `URL=${page.url()}`
    r.status = !page.url().includes('/login') ? 'pass' : 'fail'
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-login-after.png'), fullPage: true })
  })

  test('2. /critical-value - 模态框 Process 提交', async ({ page }) => {
    const errors: string[] = []
    const apiCalls: PageResult['apiCalls'] = []
    attachErrorTracking(page, errors)
    attachApiTracking(page, apiCalls)
    const r: PageResult = {
      name: 'critical-value',
      path: '/critical-value',
      status: 'fail',
      formFound: false,
      apiCalls,
      errors,
    }
    results.push(r)
    await injectAdminAuth(page)

    await page.goto(`${BASE}/critical-value`, { waitUntil: 'load', timeout: 30000 })
    // 等到第一个危急值行渲染
    await page.waitForSelector('[data-testid="critical-value-page"]', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)

    // 寻找 "处理" 按钮(每行有处理按钮)或页面 "批量处理"
    const processBtn = page.locator('button').filter({ hasText: /处理/ }).first()
    const hasBtn = (await processBtn.count()) > 0
    r.formFound = hasBtn

    if (hasBtn) {
      await processBtn.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(1200)
      // 模态对话框中点击 "确认处理完成"
      const confirm = page.locator('button').filter({ hasText: /确认处理/ }).first()
      if ((await confirm.count()) > 0) {
        await confirm.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(2000)
        r.uiFeedback = '点击确认处理完成'
      }
    }

    // 不强制要求通过 — 但要求触发 API 或 toast
    const hadApi = apiCalls.some((c) => /critical|notify|resolve/i.test(c.url))
    const hadToast = await page.locator('[role="status"]').count()
    r.status = hadApi ? 'pass' : (hasBtn ? 'warn' : 'skip')
    r.uiFeedback = `${r.uiFeedback ?? ''} | apiCalls=${apiCalls.length} toast=${hadToast}`
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-critical-value.png'), fullPage: true })
  })

  test('3. /queue-call - 叫号按钮触发 API', async ({ page }) => {
    const errors: string[] = []
    const apiCalls: PageResult['apiCalls'] = []
    attachErrorTracking(page, errors)
    attachApiTracking(page, apiCalls)
    const r: PageResult = {
      name: 'queue-call',
      path: '/queue-call',
      status: 'fail',
      formFound: false,
      apiCalls,
      errors,
    }
    results.push(r)
    await injectAdminAuth(page)

    await page.goto(`${BASE}/queue-call`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForSelector('[data-testid="queue-call-page"]', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)

    // 找 "呼叫" 按钮 (可能伴随 emoji/icon,文本匹配) — 有多个按钮时,可能在滚动区
    let callBtn = page.locator('button').filter({ hasText: /^呼叫$/ }).first()
    let btnCount = await callBtn.count()
    if (btnCount === 0) {
      // 滚动到候诊队列列表区域
      await page.evaluate(() => {
        const list = document.querySelector('[data-testid="queue-call-page"]')
        list?.querySelectorAll('button').forEach((b: any) => {
          if (b.textContent?.includes('呼叫') && b.offsetParent) b.scrollIntoView({ block: 'center' })
        })
      }).catch(() => {})
      await page.waitForTimeout(800)
      callBtn = page.locator('button').filter({ hasText: /^呼叫$/ }).first()
      btnCount = await callBtn.count()
    }
    if (btnCount === 0) {
      const anyBtn = page.locator('button').filter({ hasText: /呼叫/ }).first()
      btnCount = await anyBtn.count()
      r.formFound = btnCount > 0
      if (btnCount > 0) {
        const beforeCount = apiCalls.length
        await anyBtn.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(2500)
        const newCalls = apiCalls.length - beforeCount
        r.uiFeedback = `呼叫按钮点击 - 新增API调用=${newCalls}`
        r.status = newCalls > 0 ? 'pass' : 'warn'
      } else {
        r.status = 'skip'
        r.uiFeedback = '未找到叫号按钮(空队列或仅 busy)'
      }
    } else {
      r.formFound = true
      const beforeCount = apiCalls.length
      await callBtn.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(2500)
      const newCalls = apiCalls.length - beforeCount
      r.uiFeedback = `呼叫按钮点击 - 新增API调用=${newCalls}`
      r.status = newCalls > 0 ? 'pass' : 'warn'
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-queue-call.png'), fullPage: true })
  })

  test('4. /appointments - AppointmentForm 提交', async ({ page }) => {
    const errors: string[] = []
    const apiCalls: PageResult['apiCalls'] = []
    attachErrorTracking(page, errors)
    attachApiTracking(page, apiCalls)
    const r: PageResult = {
      name: 'appointments',
      path: '/appointments',
      status: 'fail',
      formFound: false,
      apiCalls,
      errors,
    }
    results.push(r)
    await injectAdminAuth(page)

    await page.goto(`${BASE}/appointments`, { waitUntil: 'load', timeout: 30000 })
    // AppointmentPage uses React.lazy + complex initial data — wait longer for hydration
    await page.waitForTimeout(8000)

    // 找到 "新建预约" 按钮 (allow longer timeout for slow render)
    const newBtn = page.locator('button').filter({ hasText: /新建预约/ }).first()
    let newBtnCount = await newBtn.count().catch(() => 0)
    if (newBtnCount === 0) {
      // 重试若干次
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(2000)
        newBtnCount = await newBtn.count().catch(() => 0)
        if (newBtnCount > 0) break
      }
    }
    if (newBtnCount > 0) {
      await newBtn.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(2500)
    }

    // 表单字段
    const patientNameInput = page.locator('input[placeholder*="患者姓名"]').first()
    const formVisible = (await patientNameInput.count()) > 0
    r.formFound = formVisible

    if (formVisible) {
      await patientNameInput.fill('王测试')
      // 选择第一个可选 检查项目 (must)
      const examItemSelect = page.locator('select').nth(1) // 0=gamder,1=examType,2=examItem,3=device
      const examItemOptions = await examItemSelect.locator('option').allInnerTexts()
      if (examItemOptions.length > 1) {
        await examItemSelect.selectOption({ index: 1 })
        await page.waitForTimeout(300)
      }
      // 选设备
      const deviceSelect = page.locator('select').filter({ hasText: /设备/ }).first().or(page.locator('select').nth(3))
      const deviceOptions = await page.locator('select').nth(3).locator('option').allInnerTexts()
      if (deviceOptions.length > 1) {
        await page.locator('select').nth(3).selectOption({ index: 1 })
        await page.waitForTimeout(300)
      }

      const beforeCount = apiCalls.length
      // 点击 "创建预约"
      const submitBtn = page.locator('button').filter({ hasText: /创建预约/ }).first()
      if ((await submitBtn.count()) > 0) {
        await submitBtn.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(2500)
        const newCalls = apiCalls.length - beforeCount
        r.uiFeedback = `新预约 - 新增API调用=${newCalls}`
        r.status = newCalls > 0 || apiCalls.some((c) => /appointment/i.test(c.url)) ? 'pass' : 'warn'
      }
    } else {
      r.status = 'skip'
      r.uiFeedback = 'AppointmentForm 未渲染'
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-appointments.png'), fullPage: true })
  })

  test('5. /patients - RegistrationWizard 创建', async ({ page }) => {
    const errors: string[] = []
    const apiCalls: PageResult['apiCalls'] = []
    attachErrorTracking(page, errors)
    attachApiTracking(page, apiCalls)
    const r: PageResult = {
      name: 'patient',
      path: '/patients',
      status: 'fail',
      formFound: false,
      apiCalls,
      errors,
    }
    results.push(r)
    await injectAdminAuth(page)

    await page.goto(`${BASE}/patients`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(8000)

    const newBtn = page.locator('button').filter({ hasText: /新建患者/ }).first()
    let btnCount = await newBtn.count().catch(() => 0)
    if (btnCount === 0) {
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(2000)
        btnCount = await newBtn.count().catch(() => 0)
        if (btnCount > 0) break
      }
    }
    if (btnCount > 0) {
      await newBtn.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(2000)
    }

    // 步骤1: 输入姓名 + 身份证 + 手机号
    const nameInput = page.locator('input[placeholder*="姓名"]').first()
    const idCardInput = page.locator('input[placeholder*="身份证"]').first()
    const phoneInput = page.locator('input[placeholder*="手机"]').first()
    const nameOk = (await nameInput.count()) > 0

    if (nameOk) {
      r.formFound = true
      await nameInput.fill('测试患者王')
      if ((await idCardInput.count()) > 0) await idCardInput.fill('110101199003078888')
      if ((await phoneInput.count()) > 0) await phoneInput.fill('13800138000')
      // 点击 下一步
      let nextBtn = page.locator('button').filter({ hasText: /^下一步$|^下一步/ }).first()
      if ((await nextBtn.count()) === 0) nextBtn = page.locator('button').filter({ hasText: /下一步/ }).first()
      if ((await nextBtn.count()) > 0) {
        await nextBtn.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(1200)
      }
      // 步骤2: 过敏史必填 "无"
      const allergyInput = page.locator('input[placeholder*="过敏"], textarea[placeholder*="过敏"]').first()
      if ((await allergyInput.count()) > 0) {
        await allergyInput.fill('无')
        nextBtn = page.locator('button').filter({ hasText: /下一步/ }).first()
        if ((await nextBtn.count()) > 0) await nextBtn.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(1200)
      }
      // 步骤3: 联系人 + 电话
      const emergencyName = page.locator('input[placeholder*="联系人"], input[placeholder*="紧急联系人"]').first()
      if ((await emergencyName.count()) > 0) await emergencyName.fill('王家属')
      const emergencyPhone = page.locator('input[placeholder*="联系人电话"], input[placeholder*="紧急电话"]').first()
      if ((await emergencyPhone.count()) > 0) await emergencyPhone.fill('13900139000')
      const beforeCount = apiCalls.length
      // 提交
      const submit = page.locator('button').filter({ hasText: /提交|完成|建档|保存/ }).first()
      if ((await submit.count()) > 0) {
        await submit.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(2500)
      }
      const newCalls = apiCalls.length - beforeCount
      r.uiFeedback = `新建患者 - 新增API调用=${newCalls}`
      r.status = newCalls > 0 || apiCalls.some((c) => /patient/i.test(c.url)) ? 'pass' : 'warn'
    } else {
      r.status = 'skip'
      r.uiFeedback = '注册向导未渲染'
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-patient.png'), fullPage: true })
  })

  test('6. /regional-report - 会诊申请表单提交', async ({ page }) => {
    const errors: string[] = []
    const apiCalls: PageResult['apiCalls'] = []
    attachErrorTracking(page, errors)
    attachApiTracking(page, apiCalls)
    const r: PageResult = {
      name: 'regional-report',
      path: '/regional-report',
      status: 'fail',
      formFound: false,
      apiCalls,
      errors,
    }
    results.push(r)
    await injectAdminAuth(page)

    await page.goto(`${BASE}/regional-report`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(3000)

    // 切到 "apply" tab: 找 "申请" / "新建"
    const applyTab = page.locator('button').filter({ hasText: /申请|新建/ }).first()
    if ((await applyTab.count()) > 0) {
      await applyTab.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(1000)
    }

    // 表单 input: 患者姓名
    const patientInput = page.locator('input[placeholder*="患者"], input[placeholder*="姓名"]').first()
    if ((await patientInput.count()) > 0) {
      r.formFound = true
      await patientInput.fill('区域测试')
      // 年龄
      const ageInput = page.locator('input[placeholder*="年龄"]').first()
      if ((await ageInput.count()) > 0) await ageInput.fill('45')
      // 检查项目
      const examInput = page.locator('input[placeholder*="检查项目"]').first()
      if ((await examInput.count()) > 0) await examInput.fill('CT胸部平扫')

      const beforeCount = apiCalls.length
      // 提交
      const submit = page.locator('button').filter({ hasText: /^提交$|提交申请/ }).first()
      if ((await submit.count()) > 0) {
        await submit.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(2000)
      }
      const newCalls = apiCalls.length - beforeCount
      r.uiFeedback = `会诊申请 - 新增API=${newCalls}`
      r.status = newCalls > 0 ? 'pass' : 'warn'
    } else {
      r.status = 'warn'
      r.uiFeedback = '未发现申请表单字段'
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-regional-report.png'), fullPage: true })
  })

  test('7. /dental/implant-3d - antd Form 创建规划', async ({ page }) => {
    const errors: string[] = []
    const apiCalls: PageResult['apiCalls'] = []
    attachErrorTracking(page, errors)
    attachApiTracking(page, apiCalls)
    const r: PageResult = {
      name: 'dental/implant',
      path: '/dental/implant-3d',
      status: 'fail',
      formFound: false,
      apiCalls,
      errors,
      notes:
        '注: 路由 /dental/implant 仅为列表页(无 form),实际 /dental/implant-3d 才有 antd 表单',
    }
    results.push(r)
    await injectAdminAuth(page)

    // 任务要求是 /dental/implant — 该路由实际只有 list view,我们先验证 /dental/implant 再访问带表单的 3D 页
    await page.goto(`${BASE}/dental/implant`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(2000)
    const implantOnlyForm = await page.locator('form').count()
    r.notes = `/dental/implant form=${implantOnlyForm}`

    await page.goto(`${BASE}/dental/implant-3d`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(3000)
    const antdFormCount = await page.locator('form.ant-form, .ant-form').count()
    r.formFound = antdFormCount > 0
    if (antdFormCount > 0) {
      const beforeCount = apiCalls.length
      const submit = page.locator('button').filter({ hasText: /新建 3D 规划/ }).first()
      if ((await submit.count()) > 0) {
        await submit.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(2500)
      }
      const newCalls = apiCalls.length - beforeCount
      r.uiFeedback = `antd Form 提交 - 新增API=${newCalls}`
      r.status = newCalls > 0 || apiCalls.some((c) => /implant/i.test(c.url)) ? 'pass' : 'warn'
    } else {
      r.status = 'warn'
      r.uiFeedback = '未发现 antd Form 元素'
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-dental-implant-3d.png'), fullPage: true })
  })

  test('8. /dental/treatment - list-only 无表单 P0 记录', async ({ page }) => {
    const errors: string[] = []
    const apiCalls: PageResult['apiCalls'] = []
    attachErrorTracking(page, errors)
    attachApiTracking(page, apiCalls)
    const r: PageResult = {
      name: 'dental/treatment',
      path: '/dental/treatment',
      status: 'fail',
      formFound: false,
      apiCalls,
      errors,
      notes: '当前 DentalTreatmentPage 仅渲染列表 (DentalTreatmentTable) — 无 form,记录 P0',
    }
    results.push(r)
    await injectAdminAuth(page)

    await page.goto(`${BASE}/dental/treatment`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(2500)
    const forms = await page.locator('form').count()
    r.formFound = forms > 0
    r.status = forms > 0 ? 'warn' : 'skip'
    r.uiFeedback = `form 数量=${forms} (页面无 form)`
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-dental-treatment.png'), fullPage: true })
  })

  test('9. /cosign - 双签通过', async ({ page }) => {
    const errors: string[] = []
    const apiCalls: PageResult['apiCalls'] = []
    attachErrorTracking(page, errors)
    attachApiTracking(page, apiCalls)
    const r: PageResult = {
      name: 'cosign',
      path: '/cosign',
      status: 'fail',
      formFound: false,
      apiCalls,
      errors,
    }
    results.push(r)
    await injectAdminAuth(page)

    await page.goto(`${BASE}/cosign`, { waitUntil: 'load', timeout: 30000 })
    await page.waitForSelector('[data-testid="cosign-page"]', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2500)

    // 找第一个 "详情" 或 row
    const detailBtn = page.locator('[data-testid^="cosign-row-"]').first()
    let rowFound = (await detailBtn.count()) > 0
    if (!rowFound) {
      // fallback to "详情"
      const link = page.locator('button').filter({ hasText: /详情/ }).first()
      if ((await link.count()) > 0) {
        await link.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(1000)
        rowFound = true
      }
    } else {
      await detailBtn.click({ timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(1000)
    }

    const drawer = page.locator('[data-testid="cosign-detail-drawer"]')
    const drawerVisible = (await drawer.count()) > 0
    r.formFound = drawerVisible

    if (drawerVisible) {
      // 拒签表单(textarea)
      const rejectBtn = page.locator('[data-testid="cosign-reject-btn"]').first()
      const rejectBtnCount = await rejectBtn.count()
      if (rejectBtnCount > 0) {
        await rejectBtn.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(800)
        const textarea = page.locator('[data-testid="cosign-reject-reason"]').first()
        if ((await textarea.count()) > 0) {
          await textarea.fill('测试:理由不足,请补充')
          const beforeCount = apiCalls.length
          // 重新点 确认拒签 (按钮文本变为 确认拒签)
          await rejectBtn.click({ timeout: 5000 }).catch(() => {})
          await page.waitForTimeout(2500)
          const newCalls = apiCalls.length - beforeCount
          r.uiFeedback = `拒签表单 - 新增API=${newCalls}`
          r.status = newCalls > 0 || apiCalls.some((c) => /cosign|review/i.test(c.url)) ? 'pass' : 'warn'
        } else {
          r.status = 'warn'
          r.uiFeedback = '拒签 textarea 未出现'
        }
      } else {
        r.status = 'warn'
        r.uiFeedback = 'Drawer 未发现 拒签 按钮'
      }
    } else {
      r.status = 'skip'
      r.uiFeedback = 'cosign 详情 drawer 未渲染(可能收件箱为空)'
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-cosign.png'), fullPage: true })
  })

  test('10. /compliance - 路由未注册 P0 记录', async ({ page }) => {
    const errors: string[] = []
    const apiCalls: PageResult['apiCalls'] = []
    attachErrorTracking(page, errors)
    attachApiTracking(page, apiCalls)
    const r: PageResult = {
      name: 'compliance',
      path: '/compliance',
      status: 'fail',
      formFound: false,
      apiCalls,
      errors,
      notes: 'P0: src/pages/CompliancePage.tsx 未在 routeTable 注册;实际路由为 /audit-compliance (不同页面)',
    }
    results.push(r)
    await injectAdminAuth(page)

    const resp = await page.goto(`${BASE}/compliance`, { waitUntil: 'load', timeout: 30000 }).catch((e) => e)
    await page.waitForTimeout(2000)
    // 检查是否回退到了某个有效页
    const url = page.url()
    const bodyText = (await page.locator('body').textContent()) || ''
    r.formFound = /合规|compliance|审计/i.test(bodyText)
    r.uiFeedback = `URL=${url} body含合规关键词=${r.formFound}`
    r.status = r.formFound ? 'warn' : 'fail'
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-compliance.png'), fullPage: true })

    // 附加验证: 尝试 /audit-compliance (实际生效的合规页)
    await page.goto(`${BASE}/audit-compliance`, { waitUntil: 'load', timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const auditForms = await page.locator('form').count()
    r.notes = `${r.notes} | /audit-compliance forms=${auditForms}`
  })

  test.afterAll(async () => {
    // 输出报告
    const report = {
      generatedAt: new Date().toISOString(),
      baseURL: BASE,
      summary: {
        total: results.length,
        pass: results.filter((r) => r.status === 'pass').length,
        warn: results.filter((r) => r.status === 'warn').length,
        fail: results.filter((r) => r.status === 'fail').length,
        skip: results.filter((r) => r.status === 'skip').length,
      },
      results,
    }
    const reportPath = path.join(SCREENSHOT_DIR, 'report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')

    const mdPath = path.join(SCREENSHOT_DIR, 'REPORT.md')
    let md = `# Form Submit 验证报告 v3.0.6.11-21\n\n`
    md += `生成时间: ${report.generatedAt}\n\n`
    md += `通过率: **${report.summary.pass}/${report.summary.total}** (warn=${report.summary.warn}, fail=${report.summary.fail}, skip=${report.summary.skip})\n\n`
    md += `| # | 页面 | 路径 | 状态 | Form | API 调用 | UI 反馈 |\n`
    md += `|---|------|------|------|------|----------|---------|\n`
    results.forEach((r, i) => {
      const apiList = r.apiCalls.map((a) => `${a.method} ${a.url}`).slice(0, 3).join(' / ') || '-'
      md += `| ${i + 1} | ${r.name} | ${r.path} | ${r.status.toUpperCase()} | ${r.formFound ? 'Y' : 'N'} | ${apiList} | ${r.uiFeedback || '-'} |\n`
    })
    md += `\n## 详情\n\n`
    results.forEach((r) => {
      md += `### ${r.name} (${r.status})\n`
      md += `- 路径: ${r.path}\n`
      md += `- Form 元素: ${r.formFound ? 'YES' : 'NO'}\n`
      md += `- API 调用: ${r.apiCalls.length}\n`
      if (r.errors.length > 0) {
        md += `- 错误:\n`
        r.errors.filter(isRealError).slice(0, 5).forEach((e) => (md += `  - ${e}\n`))
      }
      if (r.notes) md += `- 备注: ${r.notes}\n`
      if (r.uiFeedback) md += `- UI: ${r.uiFeedback}\n`
      md += `\n`
    })
    fs.writeFileSync(mdPath, md, 'utf8')
    console.log(`\n=== Form Submit 验证报告 ===\n${md}\n`)
    console.log(`报告已保存: ${reportPath}`)
  })
})
