import { test, expect, type Page } from '@playwright/test'

const BASE = '/g005-radiology-ris'
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
  '/dental/patient-view', '/dental/billing', '/dental/schedule',
  '/dental/photo',
  '/eye', '/eye/pacs', '/eye/pacs/viewer', '/eye/pacs/oct',
  '/eye/pacs/fundus', '/eye/pacs/visual-field', '/eye/pacs/topography',
  '/eye/pacs/ffa', '/eye/pacs/compare', '/eye/pacs/montage',
  '/eye/ris', '/eye/ris/iol-calculator', '/eye/ris/va', '/eye/ris/iop',
  '/eye/emr', '/eye/ai', '/eye/ai-report', '/eye/report-write',
  '/eye/kpi-dashboard', '/eye/tele', '/eye/case-library',
]

test.describe('Full Page Audit', () => {
  let page: Page
  const errors: { route: string; msg: string }[] = []

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push({ route: page.url(), msg: msg.text() })
      }
    })
    page.on('pageerror', (err) => {
      errors.push({ route: page.url(), msg: err.message })
    })
  })

  for (const route of ROUTES) {
    test(`Visit ${route}`, async () => {
      const fullUrl = `${BASE}${route}`
      const resp = await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 })
      expect(resp?.status()).toBeLessThan(400)
      await page.waitForTimeout(1000)
    })
  }

  test.afterAll(() => {
    console.log(`\n=== PAGE AUDIT COMPLETE ===`)
    console.log(`Routes checked: ${ROUTES.length}`)
    if (errors.length > 0) {
      console.log(`\nERRORS found: ${errors.length}`)
      for (const e of errors) {
        console.log(`  [${e.route}] ${e.msg}`)
      }
    } else {
      console.log('No errors detected!')
    }
  })
})
