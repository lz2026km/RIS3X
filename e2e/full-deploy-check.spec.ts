import { test, expect, type Page } from '@playwright/test'

const BASE = ''
const BASE_URL = `http://localhost:5191${BASE}`

interface RouteResult {
  route: string
  status: number
  consoleErrors: string[]
  jsErrors: string[]
  buttons: { text: string; clickable: boolean }[]
  tables: { found: boolean; rows: number }
}

const ROUTES = [
  '/login', '/forbidden',
  '/worklist', '/patients', '/exams', '/reports', '/write-report',
  '/statistics', '/critical-value', '/term-library', '/devices',
  '/consultation', '/qc', '/appointments', '/dose-track', '/queue-call',
  '/dicom-viewer', '/typical-cases', '/finding-library', '/operation-log',
  '/notification-center', '/schedule', '/department', '/materials',
  '/print-management', '/regional-report', '/ai-assist', '/ai-orchestration',
  '/cost-analysis', '/equipment-lifecycle', '/follow-up', '/cancer-screen',
  '/national-report', '/insurance-audit', '/data-report-center', '/dictionary',
  '/operations-center', '/department-dashboard', '/stats-report',
  '/clinical-data', '/template-management', '/template-designer',
  '/template-inheritance', '/template-category', '/report-review',
  '/report-revisions', '/collaboration', '/keyword-check',
  '/report-score-rule', '/report-defect-library', '/ai-report-draft',
  '/critical-value-rule', '/critical-value-stats', '/special-assessment',
  '/report-export', '/report-delivery', '/publish', '/patient-report-portal',
  '/ca-signature', '/blockchain-proof', '/appointment-management',
  '/device-fault', '/ai-qc', '/ai-structured-report', '/ai-medical-device',
  '/regional-imaging', '/equipment-efficiency', '/user-management',
  '/patient-portal', '/director-dashboard', '/green-it', '/research',
  '/nuclear-stats', '/term-synonym-graph', '/report-phrase-bank',
  '/report-kpi-dashboard', '/doctor-workload', '/diagnosis-accuracy',
  '/report-timeliness', '/report-search', '/review-center', '/quality-control',
  '/critical-value-center', '/defect-management', '/cosign',
  '/workflow-designer', '/routing-rules', '/workload-heatmap', '/sla-policy',
  '/qc-dashboard', '/qc-image', '/qc-radiologist-annual',
  '/charge-items', '/accounts-receivable', '/revenue-analysis',
  '/cost-accounting', '/financial-reports', '/patient-safety',
  '/dental', '/dental/chart', '/dental/ai', '/dental/treatment',
  '/dental/implant', '/dental/ortho', '/dental/endo', '/dental/perio',
  '/dental/restorative', '/dental/surgery', '/dental/pediatric',
  '/dental/tele', '/dental/inventory', '/dental/dashboard',
  '/dental/studies', '/dental/viewer', '/dental/annotate',
  '/dental/ai-onnx', '/dental/cad', '/dental/implant-3d', '/dental/guide',
  '/dental/ceph', '/dental/aligner', '/dental/volume-viewer',
  '/dental/patient-view', '/dental/billing', '/dental/schedule', '/dental/photo',
  '/eye', '/eye/pacs', '/eye/pacs/viewer', '/eye/pacs/oct',
  '/eye/pacs/fundus', '/eye/pacs/visual-field', '/eye/pacs/topography',
  '/eye/pacs/ffa', '/eye/pacs/compare', '/eye/pacs/montage',
  '/eye/ris', '/eye/ris/iol-calculator', '/eye/ris/va', '/eye/ris/iop',
  '/eye/emr', '/eye/ai', '/eye/ai-report', '/eye/report-write',
  '/eye/kpi-dashboard', '/eye/tele', '/eye/case-library',
  '/system-admin', '/command-center', '/clinical-pathways',
  '/audit-compliance', '/dicom-sr-manager', '/terminology-server',
  '/emr-templates', '/treatment-plans', '/report-workflow',
  '/review-check', '/sign-amend', '/v3-report-hub',
]

test.describe('Full Deploy Verification', () => {
  const results: Record<string, RouteResult> = {}
  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  })

  for (const route of ROUTES) {
    test(`Page: ${route}`, async () => {
      const consoleErrors: string[] = []
      const jsErrors: string[] = []

      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })
      page.on('pageerror', (err) => jsErrors.push(err.message))

      const url = `${BASE}${route}`
      const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForLoadState('domcontentloaded')

      const buttonInfo: { text: string; clickable: boolean }[] = []
      const buttons = await page.locator('button, [role="button"], a[href]').all()
      for (const btn of buttons.slice(0, 10)) {
        const text = (await btn.textContent())?.trim().slice(0, 40) || ''
        const disabled = await btn.isDisabled().catch(() => false)
        buttonInfo.push({ text, clickable: !disabled && text.length > 0 })
      }

      const tables = await page.locator('table, .ant-table, [class*="Table"], [class*="table"]').all()
      let tableRows = 0
      for (const tbl of tables.slice(0, 3)) {
        const rows = await tbl.locator('tr, [class*="Row"], [class*="row"]').count()
        tableRows += rows
      }

      results[route] = {
        route,
        status: resp?.status() ?? 0,
        consoleErrors: consoleErrors.filter(e => !e.includes('frame-ancestors') && !e.includes('X-Frame-Options')),
        jsErrors,
        buttons: buttonInfo,
        tables: { found: tables.length > 0, rows: tableRows },
      }

      expect(resp?.status()).toBeLessThan(400)
      expect(jsErrors.length).toBe(0)
    })
  }

  test.afterAll(async () => {
    console.log('\n======== FULL DEPLOY CHECK REPORT ========')
    const total = Object.keys(results).length
    let ok = 0, failed = 0
    
    for (const [route, r] of Object.entries(results)) {
      if (r.jsErrors.length === 0 && r.status < 400) ok++
      else failed++
    }
    
    console.log(`Pages: ${total} | OK: ${ok} | FAIL: ${failed}`)
    console.log('')
    
    const failedRoutes = Object.entries(results).filter(([, r]) => r.jsErrors.length > 0 || r.status >= 400)
    if (failedRoutes.length > 0) {
      console.log('FAILED PAGES:')
      for (const [route, r] of failedRoutes) {
        console.log(`  ${route}: status=${r.status}, jsErrors=${r.jsErrors.length}`)
        for (const e of r.jsErrors.slice(0, 3)) console.log(`    JS: ${e.slice(0, 200)}`)
      }
    }
    
    console.log('\n--- BUTTON SUMMARY ---')
    let totalBtns = 0, clickableBtns = 0
    for (const [, r] of Object.entries(results)) {
      for (const b of r.buttons) {
        totalBtns++
        if (b.clickable) clickableBtns++
      }
    }
    console.log(`Buttons found: ${totalBtns} | Clickable: ${clickableBtns}`)
    
    console.log('\n--- TABLE SUMMARY ---')
    let pagesWithTables = 0, totalTableRows = 0
    for (const [, r] of Object.entries(results)) {
      if (r.tables.found) { pagesWithTables++; totalTableRows += r.tables.rows }
    }
    console.log(`Pages with tables: ${pagesWithTables}/${total} | Total rows: ${totalTableRows}`)
    
    await page.close()
  })
})
