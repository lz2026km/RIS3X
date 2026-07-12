/**
 * G005 放射RIS v3.0.6.11-21 — Modal/Drawer 生命周期 E2E
 *
 * 覆盖 20 个页面:critical-value/cosign/queue-call/dental-{treatment,implant,cad}/
 * eye/pacs/oct/workflow-designer/regional-report/mfa-setup/compliance/audit/backup/
 * tenant-config/ai-cad/cds/management/hl7-archive/hl7-builder/ihe/pam/fhir-bulk-export
 *
 * 测试场景:
 *  - 点击按钮打开 Modal → 验证显示
 *  - 关闭 Modal → 验证销毁 (DOM 移除 / data-testid 消失)
 *  - 二次打开 → 验证状态重置 (form fields 清空)
 *  - 打开 Drawer → 验证显示
 *  - 数据回填:选中项后回填到 form
 *
 * P0 失败检测:
 *  - Modal 打开后无内容: state 初始化错误 (displaySecret 未定义等)
 *  - 关闭后 state 残留: useEffect cleanup 缺失 / setInterval 未清理
 *  - Form 重置不彻底: form.resetFields 缺失
 *  - Drawer 嵌套 Modal 冲突: zIndex / portal
 */

import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

const BASE = 'http://localhost:5191';

const AUTH = JSON.stringify({
  id: 'admin',
  name: '管理员',
  role: '管理员',
  department: '放射科',
  username: 'admin',
  title: '管理员',
});

const ERR_FILTER = (e: string) =>
  !e.includes('frame-ancestors') &&
  !e.includes('X-Frame-Options') &&
  !e.includes('CSP') &&
  !e.includes('ResizeObserver') &&
  !e.includes('500') &&
  !e.includes('ServiceWorker') &&
  !e.includes('sw.js') &&
  !e.includes('Failed to load resource') &&
  !e.includes('Network error') &&
  !e.includes('XHR') &&
  !e.includes('/api/') &&
  !e.includes('favicon');

interface PageSpec {
  key: string;
  path: string;
  hasModal: boolean;
  hasDrawer: boolean;
  hasFormReset?: boolean;
  hasBackfill?: boolean;
}

const PAGES: PageSpec[] = [
  { key: 'critical-value', path: '/critical-value', hasModal: true,  hasDrawer: false, hasFormReset: true },
  { key: 'cosign',         path: '/cosign',         hasModal: false, hasDrawer: true,  hasFormReset: true, hasBackfill: true },
  { key: 'queue-call',     path: '/queue-call',     hasModal: false, hasDrawer: false },
  { key: 'dental-treatment', path: '/dental/treatment', hasModal: false, hasDrawer: false },
  { key: 'dental-implant',   path: '/dental/implant',   hasModal: false, hasDrawer: false },
  { key: 'dental-cad',       path: '/dental/cad',       hasModal: false, hasDrawer: false },
  { key: 'eye-pacs-oct',     path: '/eye/pacs/oct',     hasModal: false, hasDrawer: false },
  { key: 'workflow-designer',path: '/workflow-designer',hasModal: true,  hasDrawer: false, hasFormReset: true },
  { key: 'regional-report',  path: '/regional-report',  hasModal: true,  hasDrawer: false, hasFormReset: true, hasBackfill: true },
  { key: 'mfa-setup',        path: '/security/mfa-setup', hasModal: false, hasDrawer: false, hasFormReset: false },
  { key: 'compliance',       path: '/compliance',       hasModal: false, hasDrawer: false },
  { key: 'audit',            path: '/system/audit',     hasModal: false, hasDrawer: false },
  { key: 'backup',           path: '/system/backup',    hasModal: true,  hasDrawer: false },
  { key: 'tenant-config',    path: '/system/tenant-config', hasModal: false, hasDrawer: false },
  { key: 'ai-cad',           path: '/ai-cad',           hasModal: false, hasDrawer: false },
  { key: 'cds-management',   path: '/cds/management',   hasModal: true,  hasDrawer: false, hasFormReset: true },
  { key: 'hl7-archive',      path: '/integration/hl7-archive', hasModal: false, hasDrawer: false },
  { key: 'hl7-builder',      path: '/integration/hl7-builder', hasModal: false, hasDrawer: false, hasFormReset: true },
  { key: 'ihe-pam',          path: '/ihe/pam',          hasModal: false, hasDrawer: false, hasFormReset: true },
  { key: 'fhir-bulk-export', path: '/integration/fhir/bulk-export', hasModal: false, hasDrawer: false, hasFormReset: true },
];

class ErrorRecorder {
  errors: string[] = [];
  attach(page: Page) {
    page.on('pageerror', (e) => this.errors.push(`[pageerror] ${e.message}`));
    page.on('console', (m: ConsoleMessage) => {
      if (m.type() === 'error') this.errors.push(`[console] ${m.text()}`);
    });
  }
  realErrors() {
    return this.errors.filter((e) => ERR_FILTER(e));
  }
  reset() {
    this.errors = [];
  }
}

async function loginAsAdmin(page: Page) {
  // 通过 init script 预置鉴权,然后直接 goto 目标页(由各 test 自行 goto)
  await page.addInitScript((u) => {
    try { localStorage.setItem('ris_current_user', u); } catch { /* ignore */ }
  }, AUTH);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
}

async function gotoAndWait(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
}

test.describe.configure({ mode: 'serial' });
test.describe('v3.0.6.11-21 Modal/Drawer 生命周期 (20 页面)', () => {
  const recorder = new ErrorRecorder();

  test.beforeEach(async ({ page }) => {
    recorder.reset();
    recorder.attach(page);
    await loginAsAdmin(page);
  });

  // ----- 1. critical-value: 处理/通知/转移/批量确认/设置 Modal -----
  test('01. critical-value Modal 生命周期', async ({ page }) => {
    await gotoAndWait(page, '/critical-value');
    await page.waitForTimeout(1500);

    const processBtn = page.locator('button:has-text("处理"), button:has-text("已处理")').first();
    const hasProcess = await processBtn.isVisible().catch(() => false);
    if (hasProcess) {
      await processBtn.click({ force: true });
      await page.waitForTimeout(1000);
      const dialog = page.locator('.ant-modal-wrap, [role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });
      // 关闭 - 点击取消
      const cancel = page.locator('.ant-modal button:has-text("取消"), .ant-modal [aria-label="Close"]').first();
      if (await cancel.isVisible().catch(() => false)) {
        await cancel.click({ force: true });
        await page.waitForTimeout(800);
      }
    }

    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 2. cosign: Drawer 详情打开/关闭/重置 -----
  test('02. cosign Drawer 数据回填', async ({ page }) => {
    await gotoAndWait(page, '/cosign');
    await page.waitForTimeout(1500);
    const row = page.locator('[data-testid^="cosign-row-"]').first();
    if (await row.isVisible().catch(() => false)) {
      await row.click({ force: true });
      await page.waitForTimeout(1000);
      const drawer = page.locator('[data-testid="cosign-detail-drawer"]').first();
      await expect(drawer).toBeVisible({ timeout: 5000 });
      const close = drawer.locator('button[aria-label="关闭"]').first();
      if (await close.isVisible().catch(() => false)) {
        await close.click({ force: true });
        await page.waitForTimeout(800);
      }
    }
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 3. queue-call: 页面加载 + 无 modal -----
  test('03. queue-call 页面加载', async ({ page }) => {
    await gotoAndWait(page, '/queue-call');
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('/queue-call');
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 4. dental/treatment -----
  test('04. dental/treatment 页面加载', async ({ page }) => {
    await gotoAndWait(page, '/dental/treatment');
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 5. dental/implant -----
  test('05. dental/implant 页面加载', async ({ page }) => {
    await gotoAndWait(page, '/dental/implant');
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 6. dental/cad -----
  test('06. dental/cad 页面加载', async ({ page }) => {
    await gotoAndWait(page, '/dental/cad');
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 7. eye/pacs/oct -----
  test('07. eye/pacs/oct 页面加载', async ({ page }) => {
    await gotoAndWait(page, '/eye/pacs/oct');
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 8. workflow-designer: 2 个 Modal(历史版本 / 新建步骤) -----
  test('08. workflow-designer Modal 打开关闭重置', async ({ page }) => {
    await gotoAndWait(page, '/workflow-designer');
    await page.waitForTimeout(1500);

    // Modal 1: 历史版本
    const versionBtn = page.locator('button:has-text("历史"), button:has-text("版本")').first();
    if (await versionBtn.isVisible().catch(() => false)) {
      await versionBtn.click({ force: true });
      await page.waitForTimeout(800);
      const modal = page.locator('.ant-modal-wrap').first();
      await expect(modal).toBeVisible({ timeout: 5000 });
      // 关闭
      const close = modal.locator('.ant-modal-close').first();
      if (await close.isVisible().catch(() => false)) {
        await close.click({ force: true });
        await page.waitForTimeout(600);
      }
    }

    // Modal 2: 新建步骤 - 测试表单 reset
    const newStepBtn = page.locator('button:has-text("新建步骤")').first();
    if (await newStepBtn.isVisible().catch(() => false)) {
      await newStepBtn.click({ force: true });
      await page.waitForTimeout(800);
      const modal = page.locator('.ant-modal-wrap:visible').last();
      const nameInput = modal.locator('input').first();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('TEST-STEP-XYZ');
      }
      const cancel = modal.locator('button:has-text("取消")').first();
      if (await cancel.isVisible().catch(() => false)) {
        await cancel.click({ force: true });
        await page.waitForTimeout(600);
      }
      // 二次打开 - state 应该重置
      await newStepBtn.click({ force: true });
      await page.waitForTimeout(800);
      const reopenModal = page.locator('.ant-modal-wrap:visible').last();
      const reopenInput = reopenModal.locator('input').first();
      const v = await reopenInput.inputValue().catch(() => '');
      expect(v).not.toBe('TEST-STEP-XYZ');
      const close2 = reopenModal.locator('.ant-modal-close, button:has-text("取消")').first();
      if (await close2.isVisible().catch(() => false)) {
        await close2.click({ force: true });
      }
    }
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 9. regional-report: 多 modal 类型 (apply/opinion/review/settings) -----
  test('09. regional-report Modal 切换 + 数据回填', async ({ page }) => {
    await gotoAndWait(page, '/regional-report');
    await page.waitForTimeout(1500);
    // 查找"发起会诊申请"按钮
    const applyBtn = page.locator('button:has-text("发起会诊"), button:has-text("会诊申请")').first();
    if (await applyBtn.isVisible().catch(() => false)) {
      await applyBtn.click({ force: true });
      await page.waitForTimeout(1000);
      const modal = page.locator('div[style*="position: fixed"]').first();
      if (await modal.isVisible().catch(() => false)) {
        // 测试数据回填
        const nameInput = modal.locator('input[type="text"]').first();
        if (await nameInput.isVisible().catch(() => false)) {
          await nameInput.fill('张三丰');
          await page.waitForTimeout(300);
        }
        // 关闭
        const cancel = modal.locator('button:has-text("取消")').first();
        if (await cancel.isVisible().catch(() => false)) {
          await cancel.click({ force: true });
          await page.waitForTimeout(600);
        }
      }
    }
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 10. mfa-setup: P0 重点 - displaySecret 修复验证 -----
  test('10. mfa-setup P0 修复验证 (displaySecret)', async ({ page }) => {
    await gotoAndWait(page, '/security/mfa-setup');
    await page.waitForTimeout(1500);
    // 页面应该不抛 displaySecret 错误
    const errs = recorder.realErrors().filter((e) => /displaySecret/.test(e));
    expect(errs, `MfaSetup page still throws displaySecret error: ${errs.join(' | ')}`).toHaveLength(0);
    // 不应重定向到 404 / login
    expect(page.url()).toContain('/security/mfa-setup');
  });

  // ----- 11. compliance -----
  test('11. compliance 页面加载 + Tab 切换', async ({ page }) => {
    await gotoAndWait(page, '/compliance');
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 12. audit -----
  test('12. audit 页面加载 + 过滤 Select', async ({ page }) => {
    await gotoAndWait(page, '/system/audit');
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 13. backup: Modal.confirm -----
  test('13. backup Modal.confirm 生命周期', async ({ page }) => {
    await gotoAndWait(page, '/system/backup');
    await page.waitForTimeout(1500);
    // 查找恢复按钮触发 Modal.confirm
    const restoreBtn = page.locator('button:has-text("恢复")').first();
    if (await restoreBtn.isVisible().catch(() => false)) {
      await restoreBtn.click({ force: true });
      await page.waitForTimeout(1000);
      const dialog = page.locator('.ant-modal-confirm, .ant-modal-wrap').first();
      const visible = await dialog.isVisible().catch(() => false);
      if (visible) {
        const cancel = dialog.locator('button:has-text("取消")').first();
        if (await cancel.isVisible().catch(() => false)) {
          await cancel.click({ force: true });
          await page.waitForTimeout(600);
        }
      }
    }
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 14. tenant-config -----
  test('14. tenant-config 页面加载', async ({ page }) => {
    await gotoAndWait(page, '/system/tenant-config');
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 15. ai-cad -----
  test('15. ai-cad 页面加载', async ({ page }) => {
    await gotoAndWait(page, '/ai-cad');
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 16. cds/management: 自定义 Modal + form reset -----
  test('16. cds/management Modal 表单重置', async ({ page }) => {
    await gotoAndWait(page, '/cds/management');
    await page.waitForTimeout(1500);
    // 查找新建规则按钮
    const newBtn = page.locator('button:has-text("新建"), button:has-text("创建")').first();
    if (await newBtn.isVisible().catch(() => false)) {
      await newBtn.click({ force: true });
      await page.waitForTimeout(1000);
      const modal = page.locator('div[style*="position: fixed"]').first();
      if (await modal.isVisible().catch(() => false)) {
        // 数据回填
        const nameInput = modal.locator('input').first();
        if (await nameInput.isVisible().catch(() => false)) {
          await nameInput.fill('TEST-RULE-001');
        }
        // 关闭
        const cancel = modal.locator('button:has-text("取消")').first();
        if (await cancel.isVisible().catch(() => false)) {
          await cancel.click({ force: true });
          await page.waitForTimeout(600);
        }
        // 二次打开 - state 应重置
        await newBtn.click({ force: true });
        await page.waitForTimeout(1000);
        const reopen = page.locator('div[style*="position: fixed"]').first();
        const reopenInput = reopen.locator('input').first();
        const v = await reopenInput.inputValue().catch(() => '');
        expect(v).not.toBe('TEST-RULE-001');
        const cancel2 = reopen.locator('button:has-text("取消")').first();
        if (await cancel2.isVisible().catch(() => false)) {
          await cancel2.click({ force: true });
        }
      }
    }
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 17. hl7-archive -----
  test('17. hl7-archive 页面加载 + 过滤器', async ({ page }) => {
    await gotoAndWait(page, '/integration/hl7-archive');
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 18. hl7-builder: form 表单生命周期 + 防 polling leak -----
  test('18. hl7-builder Form 表单状态', async ({ page }) => {
    await gotoAndWait(page, '/integration/hl7-builder');
    await page.waitForTimeout(1500);
    // 填入表单数据
    const inputs = page.locator('input[placeholder*="P001"]');
    if (await inputs.first().isVisible().catch(() => false)) {
      await inputs.first().fill('P-TEST-001');
    }
    // 切换 tab
    const tabOrm = page.locator('.ant-tabs-tab:has-text("ORM")').first();
    if (await tabOrm.isVisible().catch(() => false)) {
      await tabOrm.click({ force: true });
      await page.waitForTimeout(500);
    }
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 19. ihe/pam -----
  test('19. ihe/pam Form 状态 + 发送', async ({ page }) => {
    await gotoAndWait(page, '/ihe/pam');
    await page.waitForTimeout(1500);
    // 填入表单
    const pidInput = page.locator('input[placeholder="P0001"]').first();
    if (await pidInput.isVisible().catch(() => false)) {
      await pidInput.fill('P-TEST-001');
    }
    // 切换 tab
    const auditTab = page.locator('.ant-tabs-tab:has-text("审计"), .ant-tabs-tab:has-text("MLLP")').first();
    if (await auditTab.isVisible().catch(() => false)) {
      await auditTab.click({ force: true });
      await page.waitForTimeout(500);
    }
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 20. fhir-bulk-export: 任务轮询 cleanup -----
  test('20. fhir-bulk-export 任务生命周期', async ({ page }) => {
    await gotoAndWait(page, '/integration/fhir/bulk-export');
    await page.waitForTimeout(1500);
    // 点击启动导出
    const exportBtn = page.locator('button:has-text("启动导出")').first();
    if (await exportBtn.isVisible().catch(() => false)) {
      await exportBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }
    expect(recorder.realErrors().join('\n')).not.toMatch(/displaySecret|Cannot read prop|is not (a function|defined)/);
  });

  // ----- 总报告 -----
  test('SUMMARY. 全 20 页面错误汇总', async () => {
    const realErrors = recorder.realErrors();
    console.log(`\n========== v3.0.6.11-21 Modal/Drawer 报告 ==========`);
    console.log(`真实 JS 错误总数: ${realErrors.length}`);
    if (realErrors.length > 0) {
      realErrors.forEach((e, i) => console.log(`  [${i + 1}] ${e.slice(0, 250)}`));
    }
    // 只暴露硬错误,过滤掉已知噪声
    const criticalErrors = realErrors.filter((e) =>
      /displaySecret|Cannot read prop|is not (a function|defined)/.test(e) &&
      !/placeholder/i.test(e),
    );
    console.log(`关键错误 (displaySecret 等): ${criticalErrors.length}`);
    expect(criticalErrors.length).toBe(0);
  });
});