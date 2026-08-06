/**
 * [v3.0.6.8-100] 全面页面健康度检查
 * - 阶段 1: 232 路由访问性
 * - 阶段 2: 83 关键页面点击交互
 */
import { test } from '@playwright/test';
import * as fs from 'fs';

const AUTH = JSON.stringify({
  id: 'admin', name: '管理员', role: '管理员', token: 'health100'
});

// 所有路由
const ROUTES = [
  '/', '/workbench', '/worklist', '/patients', '/patient/:id',
  '/exams', '/reports', '/write-report', '/reports/v3-write',
  '/statistics', '/critical-value', '/term-library', '/devices',
  '/consultation', '/qc', '/appointments', '/dose-track', '/queue-call',
  '/dicom-viewer', '/typical-cases', '/finding-library', '/operation-log',
  '/notification-center', '/schedule', '/department', '/materials',
  '/print-management', '/regional-report', '/ai-assist', '/cost-analysis',
  '/equipment-lifecycle', '/follow-up', '/cancer-screen', '/national-report',
  '/insurance-audit', '/data-report-center', '/dictionary', '/operations-center',
  '/department-dashboard', '/stats-report', '/clinical-data',
  '/template-management', '/template-designer', '/template-designer/:id',
  '/template-inheritance', '/template-category', '/report-review',
  '/report-revisions', '/collaboration', '/keyword-check',
  '/report-score-rule', '/report-defect-library', '/ai-report-draft',
  '/critical-value-rule', '/critical-value-stats', '/special-assessment',
  '/report-export', '/report-delivery', '/publish', '/patient-report-portal',
  '/ca-signature', '/blockchain-proof', '/appointment-management',
  '/device-fault', '/ai-qc', '/ai-structured-report', '/ai-medical-device',
  '/regional-imaging', '/equipment-efficiency', '/user-management',
  '/patient-portal', '/director-dashboard', '/green-it', '/research',
  '/nuclear-stats', '/system/dicom-print', '/term-synonym-graph',
  '/report-phrase-bank', '/report-kpi-dashboard', '/doctor-workload',
  '/diagnosis-accuracy', '/report-timeliness', '/report-search',
  '/charge-items', '/accounts-receivable', '/revenue-analysis',
  '/cost-accounting', '/financial-reports', '/business-continuity',
  '/cloud-storage', '/enterprise-search', '/multi-site', '/vna-dashboard',
  '/safety/adverse-events', '/safety/cqi', '/safety/patient-safety-goals',
  '/safety/radiation-safety', '/safety/rca-analysis', '/safety/risk-management',
  '/contrast/adverse-reactions', '/contrast/injection-workstation',
  '/contrast/inventory', '/contrast/quality-compliance',
  '/cardiac/database', '/cardiac/operations', '/cardiac/qc',
  '/ops/devices', '/ops/hr', '/ops/dashboard', '/cds/management',
  '/cds/statistics', '/finance/department', '/finance/patient',
  '/mammo/operations', '/mammo/quality', '/patient/self-service',
  '/patient/service-management', '/education/patient-education',
  '/hie/medical-alliance', '/integration/fhir-server',
  '/integration/ihe-connectathon', '/integration/mllp-monitor',
  '/kiosk/check-in', '/mobile/patient', '/mobile/doctor',
  '/mobile/nurse', '/mobile/tech', '/quality/department',
  '/review-center', '/quality-control', '/critical-value-center',
  '/defect-management', '/cosign', '/workflow-designer',
  '/routing-rules', '/workload-heatmap', '/sla-policy',
  // 牙科 v87-v98
  '/dental', '/dental/chart', '/dental/ai', '/dental/treatment',
  '/dental/implant', '/dental/ortho', '/dental/endo', '/dental/perio',
  '/dental/restorative', '/dental/surgery', '/dental/pediatric',
  '/dental/tele', '/dental/inventory', '/dental/dashboard',
  '/dental/studies', '/dental/viewer', '/dental/viewer/scan-3d',
  '/dental/annotate', '/dental/viewer/mpr', '/dental/ai-onnx',
  '/dental/referral', '/dental/cbct-report', '/dental/rad-fusion',
  '/dental/cad', '/dental/implant-3d', '/dental/guide',
  '/dental/ceph', '/dental/aligner', '/dental/volume-viewer',
  '/dental/patient-view', '/dental/billing', '/dental/schedule',
  '/dental/photo',
  // v3.0.6.8 PRs
  '/report-workflow', '/patient-device-mgmt', '/notif-tpl-dict',
  '/review-check', '/sign-amend', '/v3-report-hub',
  // 眼科
  '/eye', '/eye/pacs', '/eye/pacs/viewer', '/eye/pacs/real-viewer',
  '/eye/ris', '/eye/ris/va', '/eye/ris/iop', '/eye/ris/iol-calculator',
  '/eye/emr', '/eye/ai', '/eye/ai-report', '/eye/toric-planner',
  '/eye/kpi-dashboard', '/eye/report-write',
  '/eye/sub/strabismus', '/eye/sub/neuro', '/eye/sub/oncology',
  '/eye/sub/cornea', '/eye/sub/contact-lens', '/eye/sub/low-vision',
  '/eye/sub/cataract', '/eye/sub/refractive', '/eye/tele',
  '/eye/case-library', '/eye/optometry-loop',
  '/eye/pacs/fundus', '/eye/pacs/oct', '/eye/pacs/oct-a',
  '/eye/pacs/visual-field', '/eye/pacs/topography', '/eye/pacs/ffa',
  '/eye/pacs/compare', '/eye/pacs/montage',
  // 通用扩展
  '/command-center', '/dicom-share', '/scheduling-center',
  '/clinical-pathways', '/audit-compliance', '/dicom-sr-manager',
  '/terminology-server', '/report-templates', '/ihe-integration',
  '/ai-fusion-workspace', '/clinical-calculators', '/consent-education',
  '/patient-safety', '/emr-templates', '/system-admin',
  '/treatment-plans', '/patient-unified',
  '/qc-dashboard', '/qc-image', '/qc-radiologist-annual',
];

const results: any[] = [];

test.describe.serial('全面页面健康度检查 v100', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.addInitScript((u) => {
      try { localStorage.setItem('ris_current_user', u); } catch (_) {}
    }, AUTH);
  });

  for (let i = 0; i < ROUTES.length; i++) {
    const route = ROUTES[i];
    test(`R${String(i).padStart(3,'0')} ${route}`, async ({ page }) => {
      const t0 = Date.now();
      const errs: string[] = [];
      const consoleErrs: string[] = [];
      page.on('pageerror', e => errs.push('PE: ' + e.message.slice(0, 100)));
      page.on('console', m => {
        if (m.type() === 'error') {
          const t = m.text();
          if (t.includes('mockServiceWorker') || t.includes('X-Frame-Options') ||
              t.includes('Content Security Policy') || t.includes('favicon')) return;
          consoleErrs.push('CE: ' + t.slice(0, 100));
        }
      });

      let status = 0, len = 0, hasAnt = false, hasRender = false;
      try {
        const resp = await page.goto(`http://localhost:5191${route}`, {
          timeout: 25000, waitUntil: 'domcontentloaded'
        });
        status = resp?.status() ?? 0;
        await page.waitForTimeout(8000);
        const info: any = await page.evaluate(() => ({
          textLen: document.body.innerText.length,
          hasAnt: !!document.querySelector('[class*="ant-"]'),
          hasLoading: document.body.innerText.includes('系统加载中'),
          rootChildren: document.getElementById('root')?.children.length ?? 0,
        }));
        len = info.textLen;
        hasAnt = info.hasAnt;
        hasRender = !info.hasLoading && info.rootChildren > 0;
        if (len < 100) errs.push(`TEXT=${len}`);
        if (info.hasLoading) errs.push('STUCK_LOADING');
        if (errs.length === 0 && consoleErrs.length === 0 && status < 400) {
          // 点击 3 个 Tab
          const tabCount = await page.locator('.ant-tabs-tab:visible').count();
          for (let t = 0; t < Math.min(tabCount, 3); t++) {
            try { await page.locator('.ant-tabs-tab:visible').nth(t).click({ timeout: 2000 }); } catch (_) {}
            await page.waitForTimeout(300);
          }
          // 点击 3 个非危险按钮
          const btnCount = await page.locator('button:visible:not([disabled])').count();
          for (let b = 0; b < Math.min(btnCount, 3); b++) {
            try {
              const txt = await page.locator('button:visible').nth(b).innerText();
              if (txt.match(/删除|取消|驳回|退订|拒绝/)) continue;
              await page.locator('button:visible').nth(b).click({ timeout: 2000 });
            } catch (_) {}
            await page.waitForTimeout(200);
          }
        }
      } catch (e: any) {
        errs.push('NAV: ' + e.message?.slice(0, 80));
      }
      results.push({
        route, status, len, hasAnt, hasRender, errs, consoleErrs,
        ms: Date.now() - t0,
      });
    });
  }

  test.afterAll(async () => {
    // 写结果文件
    const total = results.length;
    const pass = results.filter(r => r.errs.length === 0 && r.consoleErrs.length === 0 && r.hasRender).length;
    const fail = results.filter(r => r.errs.length > 0);
    const err = results.filter(r => r.consoleErrs.length > 0);
    const stuck = results.filter(r => r.hasRender === false);
    const summary = {
      version: '3.0.6.8-100',
      timestamp: new Date().toISOString(),
      total, pass,
      fail: fail.length,
      consoleErr: err.length,
      stuck: stuck.length,
      routes: results,
    };
    try { fs.writeFileSync('audit-result-v100.json', JSON.stringify(summary, null, 2)); } catch (_) {}
    console.log(`\n========== AUDIT RESULT v100 ==========`);
    console.log(`Total: ${total}, Pass: ${pass}, Fail: ${fail.length}, ConsoleErr: ${err.length}, StuckLoading: ${stuck.length}`);
    if (fail.length > 0) {
      console.log('\n--- FAILED ROUTES ---');
      fail.forEach(r => console.log(`  ${r.route}: [${r.errs.join('; ')}]`));
    }
    if (err.length > 0) {
      console.log('\n--- CONSOLE ERRORS ---');
      err.slice(0, 20).forEach(r => console.log(`  ${r.route}: ${r.consoleErrs.join('; ')}`));
    }
    if (stuck.length > 0) {
      console.log('\n--- STUCK ON LOADING ---');
      stuck.slice(0, 20).forEach(r => console.log(`  ${r.route}`));
    }
  });
});
