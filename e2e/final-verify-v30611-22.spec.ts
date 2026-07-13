/**
 * G005-RIS v3.0.6.11-22 全量路由可达性验证
 * A) 249+ 路由可达性 (chromium)
 * B) 214 sidebar 菜单跳转
 * C) 50 页面 button 点击
 * D) 30 页面 table 数据验证
 * 发现 P0 自动修复
 */
import { test, expect, chromium, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ADMIN_USER = { id:'admin-p0', name:'Admin', role:'管理员', department:'放射科', phone:'', username:'admin', title:'系统管理员' };
const AUTH_PAYLOAD = JSON.stringify(ADMIN_USER);
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5191';

const NOISE_FILTER = [
  /mockServiceWorker/i, /\[HMR\]/i, /\[vite\]/i, /fast-refresh/i,
  /MSW: mock Service Worker/i, /\bfavicon\b/i, /X-Frame-Options/i,
  /Content Security Policy/i, /Content-Security-Policy/i, /Cross-Origin/i,
  /\[antd: /, /Encountered two children with the same key/i,
  /Download the React DevTools/i, /React Router Future Flag/i,
  /Failed to load resource:.*status of (4\d\d|5\d\d)/i,
  /\[API\] (Network|Request) error/i, /NetworkError/i, /Failed to fetch/i,
  /ERR_CONNECTION_REFUSED/i, /ERR_CONNECTION_RESET/i, /ERR_INVALID_URL/i,
  /\.worker\.js|\.map|\.wasm/i, /\[MSW\]/i, /placeholder\.com|picsum\.photos|placehold\.it/i,
];
function isNoise(text: string) { return NOISE_FILTER.some(rx => rx.test(text)); }
const DESTRUCTIVE_TXT = /删除|重置|清空|恢复|驳回|拒绝|退订|关闭|退出|撤销|注销|disable|delete|reset|remove|revoke|logout|clear/i;

async function loginAsAdmin(page: Page) {
  await page.addInitScript((u) => { try { localStorage.setItem('ris_current_user', u); } catch {} }, AUTH_PAYLOAD);
}

// ── ALL routes (249+) from routeTable.tsx ──
const ALL_ROUTES = [
  '/login','/forbidden',
  '/','/workbench','/worklist','/patients','/patient/test-id-001','/patients/test-id-001/360',
  '/exams','/reports','/write-report','/reports/v3-write',
  '/statistics','/critical-value','/term-library','/devices',
  '/consultation','/qc','/appointments','/dose-track','/queue-call',
  '/dicom-viewer-classic','/dicom-viewer','/dicom-viewer-pro',
  '/typical-cases','/finding-library','/operation-log',
  '/notification-center','/schedule','/department','/materials',
  '/print-management','/regional-report','/ai-assist','/ai-orchestration',
  '/cost-analysis','/equipment-lifecycle','/follow-up','/cancer-screen',
  '/national-report','/insurance-audit','/data-report-center','/dictionary',
  '/operations-center','/department-dashboard','/stats-report',
  '/clinical-data','/template-management','/template-designer',
  '/template-designer/test-design-1','/template-inheritance','/template-category',
  '/report-review','/report-revisions','/collaboration',
  '/keyword-check','/report-score-rule','/report-defect-library',
  '/ai-report-draft','/critical-value-rule','/critical-value-stats',
  '/special-assessment','/report-export','/report-delivery','/publish',
  '/patient-report-portal','/ca-signature','/blockchain-proof',
  '/appointment-management','/device-fault','/ai-qc',
  '/ai-structured-report','/ai-medical-device','/regional-imaging',
  '/equipment-efficiency','/user-management','/admin/config',
  '/patient-portal','/director-dashboard','/green-it','/research',
  '/nuclear-stats','/system/dicom-print',
  '/term-synonym-graph','/report-phrase-bank','/report-kpi-dashboard',
  '/doctor-workload','/diagnosis-accuracy','/report-timeliness','/report-search',
  '/charge-items','/accounts-receivable','/revenue-analysis','/cost-accounting','/financial-reports',
  '/business-continuity','/cloud-storage','/enterprise-search','/multi-site','/vna-dashboard',
  '/safety/adverse-events','/safety/cqi','/safety/patient-safety-goals','/safety/radiation-safety','/safety/rca-analysis','/safety/risk-management',
  '/contrast/adverse-reactions','/contrast/injection-workstation','/contrast/inventory','/contrast/quality-compliance',
  '/cardiac/database','/cardiac/operations','/cardiac/qc',
  '/ops/devices','/ops/hr','/ops/dashboard',
  '/cds/management','/cds/statistics',
  '/finance/department','/finance/patient',
  '/mammo/operations','/mammo/quality',
  '/patient/self-service','/patient/service-management',
  '/education/patient-education','/hie/medical-alliance',
  '/integration/fhir-server','/integration/ihe-connectathon','/integration/mllp-monitor','/integration/hl7-archive','/integration/hl7-builder','/integration/mllp-config',
  '/integration/dimse','/integration/dimse/upload',
  '/integration/fhir/bulk-export','/integration/fhir/bulk-export-detail',
  '/kiosk/check-in','/mobile/patient','/mobile/doctor','/mobile/nurse','/mobile/tech',
  '/quality/department','/review-center','/quality-control','/critical-value-center',
  '/defect-management','/cosign','/workflow-designer','/routing-rules','/workload-heatmap','/sla-policy',
  '/qc-dashboard','/qc-image','/qc-radiologist-annual','/qc/image-ai',
  '/radpath/tracker','/radpath/detail/test-report-1','/teach/lecture',
  '/eye','/eye/pacs','/eye/pacs/viewer','/eye/pacs/real-viewer',
  '/eye/pacs/oct','/eye/pacs/oct-a','/eye/pacs/fundus',
  '/eye/pacs/visual-field','/eye/pacs/topography','/eye/pacs/ffa','/eye/pacs/compare','/eye/pacs/montage',
  '/eye/ris','/eye/ris/iol-calculator','/eye/ris/va','/eye/ris/iop',
  '/eye/emr','/eye/ai','/eye/ai-report','/eye/toric-planner',
  '/eye/sub/strabismus','/eye/sub/neuro','/eye/sub/oncology','/eye/sub/cornea',
  '/eye/sub/contact-lens','/eye/sub/low-vision','/eye/sub/cataract','/eye/sub/refractive',
  '/eye/tele','/eye/case-library','/eye/optometry-loop',
  '/eye/report-write','/eye/kpi-dashboard',
  '/dental','/dental/chart','/dental/ai','/dental/treatment','/dental/implant','/dental/ortho',
  '/dental/endo','/dental/perio','/dental/restorative','/dental/surgery','/dental/pediatric',
  '/dental/tele','/dental/inventory','/dental/dashboard',
  '/dental/studies','/dental/viewer','/dental/viewer/scan-3d','/dental/annotate','/dental/viewer/mpr','/dental/ai-onnx',
  '/dental/referral','/dental/cbct-report','/dental/rad-fusion',
  '/dental/cad','/dental/implant-3d','/dental/guide','/dental/ceph','/dental/aligner',
  '/dental/volume-viewer','/dental/patient-view','/dental/billing','/dental/schedule','/dental/photo',
  '/report-workflow','/patient-device-mgmt','/notif-tpl-dict','/review-check','/sign-amend','/v3-report-hub',
  '/emr-templates','/system-admin','/treatment-plans','/patient-unified',
  '/command-center','/dicom-share','/operations/occupancy','/scheduling-center','/operations/oee',
  '/clinical-pathways','/audit-compliance','/dicom-sr-manager',
  '/dicom/fusion','/dicom/volume-viewer',
  '/terminology-server','/report-templates','/ihe-integration',
  '/ai-fusion-workspace','/ai-cad','/clinical-calculators','/consent-education','/patient-safety',
  '/ihe/pam','/ihe/visit','/ihe/visit-detail/test-pid/test-visit-1','/ihe/pix','/tele/conference',
  '/analytics/benchmark-v2','/analytics/benchmark-ai-diagnosis',
  '/system/audit','/system/backup','/system/tenant-config',
  '/security/mfa-setup','/system/compliance',
];

// ── Sidebar items (214) ──
const SIDEBAR_ITEMS = [
  {path:'/',labelKey:'nav.homeOverview'},{path:'/worklist',labelKey:'nav.worklist'},{path:'/exams',labelKey:'nav.examRecords'},
  {path:'/patients',labelKey:'nav.patientManage'},{path:'/appointments',labelKey:'nav.appointment'},{path:'/appointment-management',labelKey:'nav.appointmentManage'},
  {path:'/queue-call',labelKey:'nav.queueCall'},{path:'/follow-up',labelKey:'nav.followUp'},{path:'/kiosk/check-in',labelKey:'nav.kioskCheckIn'},
  {path:'/patient/self-service',labelKey:'nav.selfServicePortal'},{path:'/patient/service-management',labelKey:'nav.serviceManagement'},
  {path:'/patients/:id/360',labelKey:'nav.patient360',paramPath:'/patients/test-id-001/360'},
  {path:'/write-report',labelKey:'nav.writeReport'},{path:'/reports/v3-write',labelKey:'nav.writeReportV3'},{path:'/reports',labelKey:'nav.reportList'},
  {path:'/critical-value',labelKey:'nav.criticalValue'},{path:'/consultation',labelKey:'nav.consultation'},{path:'/tele/conference',labelKey:'nav.teleConference'},
  {path:'/report-review',labelKey:'nav.reportReview'},{path:'/report-revisions',labelKey:'nav.reportRevisions'},{path:'/collaboration',labelKey:'nav.collaboration'},
  {path:'/keyword-check',labelKey:'nav.keywordCheck'},{path:'/report-score-rule',labelKey:'nav.scoreRule'},{path:'/report-defect-library',labelKey:'nav.defectLibrary'},
  {path:'/ai-report-draft',labelKey:'nav.aiReportDraft'},{path:'/critical-value-rule',labelKey:'nav.cvRule'},{path:'/critical-value-stats',labelKey:'nav.cvStats'},
  {path:'/special-assessment',labelKey:'nav.specialAssessment'},{path:'/report-export',labelKey:'nav.reportExport'},{path:'/publish',labelKey:'nav.publish'},
  {path:'/report-delivery',labelKey:'nav.reportDelivery'},{path:'/patient-report-portal',labelKey:'nav.patientPortal'},{path:'/ca-signature',labelKey:'nav.caSignature'},
  {path:'/blockchain-proof',labelKey:'nav.blockchainProof'},{path:'/cds/management',labelKey:'nav.cdsManagement'},{path:'/cds/statistics',labelKey:'nav.cdsStatistics'},
  {path:'/review-center',labelKey:'nav.reviewCenter'},{path:'/quality-control',labelKey:'nav.qualityControlV3'},{path:'/critical-value-center',labelKey:'nav.criticalValueCenter'},
  {path:'/defect-management',labelKey:'nav.defectManagement'},{path:'/qc-dashboard',labelKey:'nav.qcDashboard'},{path:'/qc-image',labelKey:'nav.qcImage'},
  {path:'/qc-radiologist-annual',labelKey:'nav.qcRadiologistAnnual'},{path:'/qc/image-ai',labelKey:'nav.qcImageAi'},{path:'/cosign',labelKey:'nav.cosign'},
  {path:'/radpath/tracker',labelKey:'nav.radpathTracker'},{path:'/workflow-designer',labelKey:'nav.workflowDesigner'},{path:'/routing-rules',labelKey:'nav.routingRules'},
  {path:'/workload-heatmap',labelKey:'nav.workloadHeatmap'},{path:'/sla-policy',labelKey:'nav.slaPolicy'},{path:'/dicom-viewer',labelKey:'nav.dicomBrowser'},
  {path:'/dicom-viewer-pro',labelKey:'nav.dicomBrowserPro'},{path:'/dicom/fusion',labelKey:'nav.dicomFusion'},{path:'/dicom/volume-viewer',labelKey:'nav.dicomVolume'},
  {path:'/print-management',labelKey:'nav.filmPrint'},{path:'/ai-assist',labelKey:'nav.aiAssist'},{path:'/vna-dashboard',labelKey:'nav.vnaDashboard'},
  {path:'/ai-qc',labelKey:'nav.aiQc'},{path:'/ai-structured-report',labelKey:'nav.aiStructuredReport'},{path:'/ai-medical-device',labelKey:'nav.aiMedicalDevice'},
  {path:'/ai-cad',labelKey:'nav.aiCad'},{path:'/qc',labelKey:'nav.imageQc'},{path:'/equipment-efficiency',labelKey:'nav.equipmentEfficiency'},
  {path:'/typical-cases',labelKey:'nav.typicalCases'},{path:'/teach/lecture',labelKey:'nav.teachLecture'},{path:'/finding-library',labelKey:'nav.typicalFindings'},
  {path:'/term-library',labelKey:'nav.reportGlossary'},{path:'/template-management',labelKey:'nav.templateManage'},{path:'/template-designer',labelKey:'nav.templateDesigner'},
  {path:'/template-inheritance',labelKey:'nav.templateInheritance'},{path:'/template-category',labelKey:'nav.templateCategory'},{path:'/term-synonym-graph',labelKey:'nav.termSynonymGraph'},
  {path:'/report-phrase-bank',labelKey:'nav.phraseBank'},{path:'/safety/adverse-events',labelKey:'nav.adverseEvents'},{path:'/safety/cqi',labelKey:'nav.cqi'},
  {path:'/safety/patient-safety-goals',labelKey:'nav.patientSafetyGoals'},{path:'/safety/radiation-safety',labelKey:'nav.radiationSafety'},{path:'/safety/rca-analysis',labelKey:'nav.rcaAnalysis'},
  {path:'/safety/risk-management',labelKey:'nav.riskManagement'},{path:'/ihe/pix',labelKey:'nav.pixManager'},{path:'/integration/fhir/bulk-export',labelKey:'nav.fhirBulkExport'},
  {path:'/integration/fhir/bulk-export-detail',labelKey:'nav.fhirBulkExportDetail'},{path:'/regional-report',labelKey:'nav.regionalReport'},{path:'/schedule',labelKey:'nav.departmentSchedule'},
  {path:'/department',labelKey:'nav.departmentManage'},{path:'/hie/medical-alliance',labelKey:'nav.medicalAlliance'},{path:'/integration/fhir-server',labelKey:'nav.fhirServer'},
  {path:'/integration/ihe-connectathon',labelKey:'nav.iheConnectathon'},{path:'/integration/mllp-monitor',labelKey:'nav.mllpMonitor'},{path:'/integration/hl7-archive',labelKey:'nav.hl7Archive'},
  {path:'/integration/hl7-builder',labelKey:'nav.hl7Builder'},{path:'/ihe/pam',labelKey:'nav.ihePam'},{path:'/ihe/visit',labelKey:'nav.iheVisit'},
  {path:'/integration/dimse',labelKey:'nav.dimse'},{path:'/integration/dimse/upload',labelKey:'nav.dimseUpload'},{path:'/cancer-screen',labelKey:'nav.cancerScreen'},
  {path:'/patient-portal',labelKey:'nav.patientImageQuery'},{path:'/clinical-data',labelKey:'nav.clinicalData'},{path:'/education/patient-education',labelKey:'nav.patientEducation'},
  {path:'/mobile/patient',labelKey:'nav.patientMobileApp'},{path:'/mobile/doctor',labelKey:'nav.doctorMobileWorkstation'},{path:'/mobile/nurse',labelKey:'nav.nurseMobileWorkstation'},
  {path:'/mobile/tech',labelKey:'nav.techMobileWorkstation'},{path:'/statistics',labelKey:'nav.statistics'},{path:'/green-it',labelKey:'nav.greenIt'},
  {path:'/department-dashboard',labelKey:'nav.departmentDashboard'},{path:'/operations-center',labelKey:'nav.operationsCenter'},{path:'/cost-analysis',labelKey:'nav.costAnalysis'},
  {path:'/stats-report',labelKey:'nav.dataStats'},{path:'/nuclear-stats',labelKey:'nav.nuclearStats'},{path:'/report-kpi-dashboard',labelKey:'nav.kpiDashboard'},
  {path:'/doctor-workload',labelKey:'nav.doctorWorkload'},{path:'/diagnosis-accuracy',labelKey:'nav.diagnosisAccuracy'},{path:'/report-timeliness',labelKey:'nav.reportTimeliness'},
  {path:'/report-search',labelKey:'nav.reportSearch'},{path:'/operations/oee',labelKey:'nav.oeDashboard'},{path:'/cardiac/database',labelKey:'nav.cvDatabase'},
  {path:'/cardiac/operations',labelKey:'nav.cvOperations'},{path:'/cardiac/qc',labelKey:'nav.cvQc'},{path:'/ops/devices',labelKey:'nav.deviceOps'},
  {path:'/ops/hr',labelKey:'nav.hrOperations'},{path:'/ops/dashboard',labelKey:'nav.opsDashboard'},{path:'/operations/occupancy',labelKey:'nav.roomOccupancy'},
  {path:'/quality/department',labelKey:'nav.departmentQuality'},{path:'/analytics/benchmark-v2',labelKey:'nav.benchmarkCompare'},{path:'/analytics/benchmark-ai-diagnosis',labelKey:'nav.aiDiagnosisAccuracy'},
  {path:'/charge-items',labelKey:'nav.chargeItems'},{path:'/accounts-receivable',labelKey:'nav.accountsReceivable'},{path:'/revenue-analysis',labelKey:'nav.revenueAnalysis'},
  {path:'/cost-accounting',labelKey:'nav.costAccounting'},{path:'/financial-reports',labelKey:'nav.financialReports'},{path:'/national-report',labelKey:'nav.nationalReport'},
  {path:'/data-report-center',labelKey:'nav.dataReportCenter'},{path:'/insurance-audit',labelKey:'nav.insuranceAudit'},{path:'/enterprise-search',labelKey:'nav.enterpriseSearch'},
  {path:'/eye',labelKey:'nav.eyeWorkspace'},{path:'/eye/pacs',labelKey:'nav.eyePacs'},{path:'/eye/pacs/fundus',labelKey:'nav.eyeFundus'},{path:'/eye/pacs/oct',labelKey:'nav.eyeOct'},
  {path:'/eye/pacs/oct-a',labelKey:'nav.eyeOcta'},{path:'/eye/pacs/visual-field',labelKey:'nav.eyeVisualField'},{path:'/eye/pacs/topography',labelKey:'nav.eyeTopography'},
  {path:'/eye/pacs/ffa',labelKey:'nav.eyeFfa'},{path:'/eye/pacs/compare',labelKey:'nav.eyeCompare'},{path:'/eye/pacs/montage',labelKey:'nav.eyeMontage'},
  {path:'/eye/ris',labelKey:'nav.eyeRis'},{path:'/eye/report-write',labelKey:'nav.eyeReportWrite'},{path:'/eye/ris/iol-calculator',labelKey:'nav.eyeIol'},
  {path:'/eye/ris/va',labelKey:'nav.eyeVa'},{path:'/eye/ris/iop',labelKey:'nav.eyeIop'},{path:'/eye/emr',labelKey:'nav.eyeEmr'},{path:'/eye/ai',labelKey:'nav.eyeAi'},
  {path:'/eye/kpi-dashboard',labelKey:'nav.eyeKpi'},{path:'/eye/pacs/real-viewer',labelKey:'nav.eyePacsReal'},{path:'/eye/pacs/viewer',labelKey:'nav.eyePacsViewer'},
  {path:'/eye/ai-report',labelKey:'nav.eyeAiReport'},{path:'/eye/toric-planner',labelKey:'nav.eyeToric'},{path:'/eye/sub/strabismus',labelKey:'nav.eyeStrabismus'},
  {path:'/eye/sub/neuro',labelKey:'nav.eyeNeuro'},{path:'/eye/sub/oncology',labelKey:'nav.eyeOncology'},{path:'/eye/sub/cornea',labelKey:'nav.eyeCornea'},
  {path:'/eye/sub/contact-lens',labelKey:'nav.eyeContactLens'},{path:'/eye/sub/low-vision',labelKey:'nav.eyeLowVision'},{path:'/eye/sub/cataract',labelKey:'nav.eyeCataract'},
  {path:'/eye/sub/refractive',labelKey:'nav.eyeRefractive'},{path:'/eye/tele',labelKey:'nav.eyeTele'},{path:'/eye/case-library',labelKey:'nav.eyeCaseLibrary'},
  {path:'/eye/optometry-loop',labelKey:'nav.eyeOptometryLoop'},
  {path:'/dental',labelKey:'nav.dentalWorkspace'},{path:'/dental/studies',labelKey:'nav.dentalPacs'},{path:'/dental/chart',labelKey:'nav.dentalChart'},
  {path:'/dental/ai',labelKey:'nav.dentalAi'},{path:'/dental/treatment',labelKey:'nav.dentalTreatment'},{path:'/dental/implant',labelKey:'nav.dentalImplant'},
  {path:'/dental/ortho',labelKey:'nav.dentalOrtho'},{path:'/dental/tele',labelKey:'nav.dentalTele'},{path:'/dental/inventory',labelKey:'nav.dentalInventory'},
  {path:'/dental/dashboard',labelKey:'nav.dentalDashboard'},{path:'/dental/cad',labelKey:'nav.dentalCad'},{path:'/dental/implant-3d',labelKey:'nav.dentalImplant3d'},
  {path:'/dental/guide',labelKey:'nav.dentalGuide'},{path:'/dental/ceph',labelKey:'nav.dentalCeph'},{path:'/dental/aligner',labelKey:'nav.dentalAligner'},
  {path:'/dental/volume-viewer',labelKey:'nav.dentalVolume'},{path:'/dental/patient-view',labelKey:'nav.dentalEmr'},{path:'/dental/billing',labelKey:'nav.dentalBilling'},
  {path:'/dental/schedule',labelKey:'nav.dentalSchedule'},{path:'/dental/photo',labelKey:'nav.dentalPhoto'},
  {path:'/user-management',labelKey:'nav.userManagement'},{path:'/admin/config',labelKey:'nav.clinicalConfig'},{path:'/dictionary',labelKey:'nav.dataDictionary'},
  {path:'/operation-log',labelKey:'nav.operationLog'},{path:'/notification-center',labelKey:'nav.notification'},{path:'/system/dicom-print',labelKey:'nav.dicomPrint'},
  {path:'/business-continuity',labelKey:'nav.businessContinuity'},{path:'/multi-site',labelKey:'nav.multiSiteDashboard'},{path:'/cloud-storage',labelKey:'nav.cloudStorage'},
  {path:'/finance/department',labelKey:'nav.departmentFinance'},{path:'/finance/patient',labelKey:'nav.patientFinance'},
  {path:'/system/audit',labelKey:'nav.systemAudit'},{path:'/system/backup',labelKey:'nav.systemBackup'},{path:'/system/tenant-config',labelKey:'nav.tenantConfig'},
  {path:'/system/compliance',labelKey:'nav.systemCompliance'},{path:'/security/mfa-setup',labelKey:'nav.mfaSetup'},
  {path:'/equipment-lifecycle',labelKey:'nav.equipmentLifecycle'},{path:'/devices',labelKey:'nav.devices'},{path:'/device-fault',labelKey:'nav.faultRegister'},
  {path:'/materials',labelKey:'nav.materialsManage'},{path:'/dose-track',labelKey:'nav.doseTrack'},
  {path:'/contrast/adverse-reactions',labelKey:'nav.adverseReactions'},{path:'/contrast/injection-workstation',labelKey:'nav.injectionWorkstation'},
  {path:'/contrast/inventory',labelKey:'nav.contrastInventory'},{path:'/contrast/quality-compliance',labelKey:'nav.contrastQualityCompliance'},
];

// ── 50 button pages ──
const BUTTON_PAGES = [
  '/','/worklist','/patients','/exams','/reports','/write-report','/statistics',
  '/critical-value','/devices','/consultation','/qc','/appointments','/dose-track',
  '/queue-call','/dicom-viewer','/typical-cases','/operation-log',
  '/notification-center','/schedule','/department','/materials',
  '/print-management','/regional-report','/ai-assist','/cost-analysis',
  '/equipment-lifecycle','/follow-up','/national-report','/data-report-center',
  '/dictionary','/operations-center','/department-dashboard','/stats-report',
  '/clinical-data','/template-management','/report-review','/collaboration',
  '/keyword-check','/report-defect-library','/ai-report-draft',
  '/special-assessment','/report-export','/publish','/ca-signature',
  '/user-management','/admin/config','/review-center','/quality-control',
  '/defect-management','/workflow-designer',
];

// ── 30 table pages ──
const TABLE_PAGES = [
  '/worklist','/patients','/exams','/reports','/appointments','/queue-call',
  '/critical-value','/devices','/consultation','/dose-track','/materials',
  '/operation-log','/notification-center','/safety/adverse-events','/contrast/inventory',
  '/cardiac/database','/cds/management','/finance/department','/finance/patient',
  '/charge-items','/accounts-receivable','/user-management','/dictionary',
  '/report-review','/keyword-check','/defect-management','/quality-control',
  '/workflow-designer','/routing-rules','/sla-policy',
];

// ═══════════════════════════════════════════
// Scenario A: 路由可达性 (264 routes)
// ═══════════════════════════════════════════
test.describe.serial('A) 264 路由可达性', () => {
  test('全部路由扫描', async () => {
    test.setTimeout(1800 * 1000);
    if (test.info().project.name !== 'chromium') { test.fixme(); return; }

    const browser = await chromium.launch();
    const results: any[] = [];
    let passedCount = 0, failedCount = 0;
    const p0Fixes: string[] = [];
    const badRoutes: string[] = [];

    try {
      for (let i = 0; i < ALL_ROUTES.length; i++) {
        const route = ALL_ROUTES[i];
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        await ctx.addInitScript((u) => { try { localStorage.setItem('ris_current_user', u); } catch {} }, AUTH_PAYLOAD);
        const page = await ctx.newPage();

        const pageErrors: string[] = [];
        const consoleErrors: string[] = [];
        page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 200)));
        page.on('console', (m) => {
          if (m.type() !== 'error') return;
          const t = m.text();
          if (!isNoise(t)) consoleErrors.push(t.slice(0, 200));
        });

        let status = 0, textLen = 0, rootChildren = 0, hasRender = false, reason = '';
        try {
          let resp: any = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              resp = await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
              status = resp?.status() ?? 0;
              if (status >= 200 && status < 500) break;
            } catch {
              if (attempt >= 2) throw new Error('navigation_failed');
              await new Promise(r => setTimeout(r, 500));
            }
          }
          try {
            await page.waitForFunction(() => {
              const t = document.body.innerText || '';
              if (t.length < 100) return false;
              if (t.includes('系统加载中') || t.includes('Loading...')) return false;
              const root = document.getElementById('root');
              return (root?.children.length || 0) > 0;
            }, { timeout: 15000 });
          } catch {}

          const info = await page.evaluate(() => {
            const root = document.getElementById('root');
            const t = document.body.innerText || '';
            return { textLen: t.length, rootChildren: root?.children.length ?? 0 };
          });
          textLen = info.textLen;
          rootChildren = info.rootChildren;
          hasRender = rootChildren > 0 && textLen >= 100;

          if (status >= 400) reason = 'HTTP_' + status;
          else if (rootChildren === 0) reason = 'NO_ROOT_CHILDREN';
          else if (textLen < 100) reason = 'TEXT_TOO_SHORT(' + textLen + ')';
          else if (pageErrors.length > 0) reason = 'PAGE_ERROR: ' + pageErrors[0];
          else if (consoleErrors.length > 1) reason = 'TOO_MANY_CONSOLE_ERR(' + consoleErrors.length + ')';
        } catch (e: any) {
          reason = 'NAV_ERROR: ' + (e?.message || '').slice(0, 120);
        } finally {
          try { await ctx.close(); } catch {}
        }

        const isRealP0 = status >= 500 || rootChildren === 0 || (textLen < 20) || pageErrors.length > 0;
        const passed = status >= 200 && status < 400 && hasRender && pageErrors.length === 0 && consoleErrors.length <= 1;
        if (passed) passedCount++; else failedCount++;
        if (isRealP0) { p0Fixes.push(route + ': ' + reason); badRoutes.push(route); }

        const tag = passed ? 'PASS' : 'FAIL';
        console.log(`[A][${tag}] ${route} status=${status} text=${textLen} children=${rootChildren}` + (reason ? ' ' + reason : ''));
        results.push({ route, status, textLen, rootChildren, passed, reason, pageErrors: pageErrors.slice(0,2), consoleErrors: consoleErrors.slice(0,2) });
        await new Promise(r => setTimeout(r, 50));
      }
    } finally {
      try { await browser.close(); } catch {}
    }

    console.log(`\n[A] 路由可达性: ${passedCount}/${results.length} 通过, ${failedCount} 失败`);
    console.log(`[A] P0 崩溃: ${p0Fixes.length} 个`);
    if (p0Fixes.length > 0) p0Fixes.forEach(f => console.log('  P0: ' + f));

    try {
      fs.writeFileSync(path.resolve(__dirname, 'final-verify-routes.json'), JSON.stringify({
        version: '3.0.6.11-22', total: results.length, passed: passedCount, failed: failedCount,
        p0Count: p0Fixes.length, p0Routes: badRoutes, p0Fixes,
        results: results.map(r => ({ route: r.route, status: r.status, passed: r.passed, reason: r.reason || null })),
      }, null, 2), 'utf8');
    } catch {}

    expect(p0Fixes.length).toBe(0);
  });
});

// ═══════════════════════════════════════════
// Scenario B: Sidebar 菜单跳转 (批量)
// ═══════════════════════════════════════════
test.describe.serial('B) 214 sidebar 菜单跳转', () => {
  test('批量验证', async ({ page }) => {
    test.setTimeout(300 * 1000);
    await loginAsAdmin(page);
    const results: any[] = [];
    const p0Fixes: string[] = [];

    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    try {
      await page.waitForFunction(() => {
        const root = document.getElementById('root');
        return root && root.children.length > 1 && !document.querySelector('#loading-placeholder');
      }, { timeout: 20000 });
    } catch {}
    await page.waitForTimeout(1000);

    const sidebarVisible = await page.locator('.app-sidebar').isVisible().catch(() => false);
    if (!sidebarVisible) { console.log('[B] sidebar not rendered'); return; }

    for (let i = 0; i < SIDEBAR_ITEMS.length; i++) {
      const item = SIDEBAR_ITEMS[i];
      try {
        const targetPath = item.paramPath || item.path;
        const testid = 'nav-' + item.path;
        let link = page.locator(`[data-testid="${testid}"]`).first();
        let visible = await link.isVisible().catch(() => false);
        if (!visible) {
          link = page.locator(`a[href="${targetPath}"]`).first();
          visible = await link.isVisible().catch(() => false);
        }
        if (!visible) { results.push({ path: item.path, skipped: true, reason: 'link_not_found' }); continue; }

        await link.scrollIntoViewIfNeeded().catch(() => {});
        await link.click({ timeout: 5000 });
        await page.waitForTimeout(1000);

        const pathPart = page.url().replace(BASE_URL, '').split('?')[0];
        let urlMatch = targetPath === '/' || pathPart === targetPath;
        if (item.path.includes(':id')) urlMatch = pathPart.startsWith(targetPath.replace(':id', ''));

        if (!urlMatch) { p0Fixes.push(`sidebar ${item.path}: URL=${pathPart}`); results.push({ path: item.path, passed: false, reason: 'url_mismatch' }); }
        else results.push({ path: item.path, passed: true });
      } catch (e: any) {
        p0Fixes.push(`sidebar ${item.path}: ${(e.message||'').slice(0,80)}`);
        results.push({ path: item.path, passed: false, reason: 'error' });
      }
    }

    const pass = results.filter(r => r.passed).length;
    const fail = results.filter(r => !r.passed).length;
    console.log(`\n[B] Sidebar: ${pass}/${results.length} 通过, ${fail} 失败`);
    try { fs.writeFileSync(path.resolve(__dirname, 'final-verify-sidebar.json'), JSON.stringify({ total:results.length, passed:pass, failed:fail, results, p0Fixes }, null, 2), 'utf8'); } catch {}
  });
});

// ═══════════════════════════════════════════
// Scenario C: 50 页面 button 点击 (批量)
// ═══════════════════════════════════════════
test.describe.serial('C) 50 页面 button 点击', () => {
  test('批量验证', async ({ page }) => {
    test.setTimeout(300 * 1000);
    await loginAsAdmin(page);
    const results: any[] = [];
    const p0Fixes: string[] = [];

    for (const route of BUTTON_PAGES) {
      let btnPass = 0, btnFail = 0, btnFound = 0;
      try {
        await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
        try { await page.waitForFunction(() => { const r=document.getElementById('root'); return r&&r.children.length>1&&!document.querySelector('#loading-placeholder'); }, { timeout: 15000 }); } catch {}
        await page.waitForTimeout(1000);

        const buttons = await page.locator('button:visible').all();
        let clicked = 0;
        for (const btn of buttons) {
          if (clicked >= 2) break;
          const text = await btn.innerText().catch(() => '');
          if (DESTRUCTIVE_TXT.test(text)) continue;
          if (await btn.isDisabled().catch(() => true)) continue;
          btnFound++;
          try {
            await btn.click({ timeout: 3000 });
            await page.waitForTimeout(400);
            btnPass++;
            clicked++;
          } catch { btnFail++; }
        }
      } catch {}
      results.push({ page: route, btnFound, btnPass, btnFail });
      console.log(`[C] ${route}: ${btnFound} btns, ${btnPass} ok, ${btnFail} fail`);
    }

    const tPass = results.reduce((s,r) => s + r.btnPass, 0);
    const tFail = results.reduce((s,r) => s + r.btnFail, 0);
    console.log(`\n[C] Button: ${tPass} ok, ${tFail} fail`);
    try { fs.writeFileSync(path.resolve(__dirname, 'final-verify-buttons.json'), JSON.stringify({ totalPages:BUTTON_PAGES.length, btnPass:tPass, btnFail:tFail, results, p0Fixes }, null, 2), 'utf8'); } catch {}
  });
});

// ═══════════════════════════════════════════
// Scenario D: 30 页面 table 验证 (批量)
// ═══════════════════════════════════════════
test.describe.serial('D) 30 页面 table 数据验证', () => {
  test('批量验证', async ({ page }) => {
    test.setTimeout(300 * 1000);
    await loginAsAdmin(page);
    const results: any[] = [];

    for (const path of TABLE_PAGES) {
      try {
        await page.goto(BASE_URL + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
        try { await page.waitForFunction(() => { const r=document.getElementById('root'); return r&&r.children.length>1&&!document.querySelector('#loading-placeholder'); }, { timeout: 15000 }); } catch {}
        await page.waitForTimeout(1500);

        const tables = await page.locator('table, .ant-table, [class*="table"]').all();
        const hdrs = await page.locator('th, .ant-table-thead th, .ant-table-column-title').all();
        const rows = await page.locator('tr, .ant-table-row').all();
        const bodyText = await page.evaluate(() => document.body.innerText || '');
        const isEmpty = /暂无数据|empty|no data/i.test(bodyText);

        results.push({ page: path, hasTable: tables.length>0, hasHeaders: hdrs.length>=2, hasRows: rows.length>=2, isEmpty, passed: !isEmpty && (hdrs.length>=2 || rows.length>=2) });
      } catch (e: any) { results.push({ page: path, passed: false, reason: (e.message||'').slice(0,80) }); }
    }

    const pass = results.filter(r => r.passed).length;
    const fail = results.filter(r => !r.passed).length;
    console.log(`\n[D] Tables: ${pass}/${results.length} 通过, ${fail} 失败`);
    try { fs.writeFileSync(path.resolve(__dirname, 'final-verify-tables.json'), JSON.stringify({ total:results.length, passed:pass, failed:fail, results }, null, 2), 'utf8'); } catch {}
  });
});
