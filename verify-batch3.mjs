// [v3.0.6.11-60] Batch 3 壳页真实化 - 浏览器抽查 (5191 dev server)
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5191';

const PAGES = [
  { path: '/dental/dashboard', name: 'DentalDashboardPage', markers: ['今日患者', '热门治疗', '今日安排'] },
  { path: '/dental/ortho', name: 'DentalOrthoPage', markers: ['正畸管理', '新建病例', '治疗阶段'] },
  { path: '/dental/ai', name: 'DentalAIPage', markers: ['口腔 AI', '检测记录', 'AI 检测'] },
  { path: '/pacs-admin', name: 'PacsAdminPage', markers: ['PACS 管理', 'AE 服务器', '存储组'] },
  { path: '/ai-fusion-workspace', name: 'AiFusionWorkspacePage', markers: ['Fusion', 'AI Insights', 'Fusion Studies'] },
  { path: '/clinical-pathways', name: 'ClinicalPathwayPage', markers: ['临床路径', '路径定义', '患者路径追踪'] },
  { path: '/terminology-server', name: 'TerminologyServerPage', markers: ['术语服务器', '跨系统映射', '系统状态'] },
  { path: '/consent-education', name: 'ConsentEducationPage', markers: ['知情同意', '宣教资料', '患者知情同意'] },
  { path: '/critical-value-5step', name: 'CriticalValue5StepPage', markers: ['5步工作流', '待通知'] },
];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const pageErrors = [];
p.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 300)));

await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await p.evaluate(async () => {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) await r.unregister();
  }
});
await p.evaluate(() => {
  localStorage.setItem('ris_current_user', JSON.stringify({ id: 'A001', name: 'SysAdmin', role: '管理员', department: '信息科' }));
  try { localStorage.removeItem('ris_api_mode'); } catch {}
});

let pass = 0;
for (const page of PAGES) {
  pageErrors.length = 0;
  const url = `${BASE}${page.path}?t=${Date.now()}`;
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await p.waitForTimeout(4500);
  const bodyText = await p.evaluate(() => document.body.innerText);
  const hasEB = bodyText.includes('ErrorBoundary caught');
  const missing = page.markers.filter((m) => !bodyText.includes(m));
  const ok = !hasEB && missing.length === 0 && pageErrors.length === 0;
  if (ok) pass++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${page.name}  path=${page.path}  missing=[${missing.join(',')}]  pageErrors=${pageErrors.length}${pageErrors[0] ? ' :: ' + pageErrors[0].slice(0, 150) : ''}`
  );
  await p.screenshot({ path: `verify-batch3-${page.name}.png` });
}

console.log(`\nResult: ${pass}/${PAGES.length} pages rendered with real data`);
await b.close();
