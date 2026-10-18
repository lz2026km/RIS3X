/**
 * G005 RIS — guard:demo
 *
 * 演示构建 (GitHub Pages / `pnpm build`) 跑的是 MSW mock 后端, **没有真实后端**。
 * 因此对演示版而言, 真正的可用性判据不是「后端有没有这个路由」, 而是
 * **「MSW 有没有这个 handler」** —— 只被后端实现、MSW 未兜底的端点, 在演示版里
 * 一律 404, 客户点下去就是空白/报错。
 *
 * api-contract-guard 管「前端 ↔ 后端」契约; 本 guard 管「前端 ↔ MSW」契约
 * (演示可用性), 两者互补。
 *
 * [v3.0.6.16-7] 解析逻辑统一收敛到 `scripts/lib/route-parse.mjs` —— 此前三套守卫
 * 各自实现解析, 口径不一致 (例如本 guard 已修好注释剥离, 而 api-contract-guard
 * 仍在破坏源码)。现在由同一库 + `guard-selfcheck` 夹具共同守护。
 *
 * 预算只减不增。设置 DEBUG_ROUTE=<substr> 可打印 MSW 路由中匹配的子集, 便于排查误报。
 */
import { join } from 'node:path';
import { walk, norm, collectFrontendCalls, segmentsMatch } from './lib/route-parse.mjs';

const ROOT = process.cwd();

// ============================================================================
// 1. MSW handler 路由 (演示层)
// ============================================================================
const mswFiles = walk(join(ROOT, 'src', 'services', 'mockBackend')).filter((f) => /\.(ts|tsx)$/.test(f));
const mswCalls = collectFrontendCalls(mswFiles, ROOT);
const mswPaths = mswCalls.byPath;

// ============================================================================
// 2. 前端调用点
//    [v3.0.6.16-7] 必须覆盖**页面层**的 api.* 调用, 不能只看 services/api/**:
//    页面里直接 `api.patch(...)` 的调用同样会在演示版打到 MSW, 若 MSW 无 handler
//    就 404 —— 此前只扫 api 层, 这类调用完全逃过检查。
// ============================================================================
const mockDir = norm(`${ROOT}/src/services/mockBackend`);
// [v3.0.6.16-7] mswHandlers.ts 是 mockBackend/ 之外的第二套 mock (0 应用引用),
// 属死代码, 阶段 3 删除。此处先排除, 避免它的 handler 污染演示覆盖统计。
const deadMock = norm(`${ROOT}/src/services/mswHandlers.ts`);
const allSrc = walk(join(ROOT, 'src')).filter(
  (f) =>
    /\.(ts|tsx)$/.test(norm(f)) &&
    !norm(f).startsWith(mockDir) &&
    norm(f) !== deadMock &&
    !/\.(test|spec)\./.test(norm(f)),
);
const frontendCalls = collectFrontendCalls(allSrc, ROOT, { includeRaw: true });

// ============================================================================
// 3. 对账: 前端调用必须有 MSW 兜底
// ============================================================================
const mswSegList = [...mswPaths.keys()].map((p) => p.split('/'));
const matchesMsw = (path) => {
  const segs = path.split('/');
  return mswSegList.some((m) => segmentsMatch(segs, m));
};

const uncovered = [];
for (const [path, files] of frontendCalls.byPath) {
  if (!matchesMsw(path)) uncovered.push({ path, files: [...files] });
}

// ============================================================================
// 4. 输出 (预算只减不增)
// ============================================================================
const BUDGET = Number(process.env['GUARD_DEMO_UNCOVERED'] ?? 0);

console.log('[demo-guard] 演示构建 (MSW) 可用性检查');
console.log(`  MSW 路由: ${mswPaths.size}  前端调用路径: ${frontendCalls.byPath.size}`);

if (process.env['DEBUG_ROUTE']) {
  const needle = process.env['DEBUG_ROUTE'];
  const hits = [...mswPaths.keys()].filter((r) => r.includes(needle));
  console.log(`  [debug] MSW 路由含 "${needle}": ${hits.length}`);
  for (const h of hits.slice(0, 12)) console.log(`      ${h}`);
}

let failed = false;
const ok = uncovered.length <= BUDGET;
if (!ok) failed = true;
console.log(
  `  ${ok ? 'PASS' : 'FAIL'}  demoUncoveredCalls: ${uncovered.length} / 上限 ${BUDGET}  — 前端调用但 MSW 无 handler (演示版会 404)`,
);
if (!ok) {
  for (const u of uncovered.slice(0, 30)) {
    console.log(`        ${u.path}  <- ${u.files.slice(0, 2).join(', ')}`);
  }
  if (uncovered.length > 30) console.log(`        ... 其余 ${uncovered.length - 30} 个`);
}

if (failed) {
  console.error('\n[demo-guard] 存在超预算项, 请补 MSW handler 后再提交。');
  process.exit(1);
}
console.log('\n[demo-guard] 通过。');
