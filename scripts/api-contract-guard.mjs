/**
 * [G005 v3.0.6.16-7] 前后端 API 契约守则
 *
 * 审查背景: 全站存在三类"演示能过 / 上线即挂"的问题, 本脚本自动检出:
 *   1) **死调用**    : 前端 api 层调用了后端不存在的路由 → 生产必 404
 *   2) **孤儿端点**  : 后端实现了但前端从不调用 (做完没人用)
 *   3) **mock-only** : 只存在于 MSW、后端没有的端点 —— 一旦被生产页面引用即 404
 *   4) **动词不匹配**: 路径存在但 HTTP 动词不一致 (GET /x 有, 前端却 POST /x)
 *
 * 解析逻辑统一收敛到 `scripts/lib/route-parse.mjs` (见该文件头部 B1–B7 修复说明)。
 * 本脚本此前因注释剥离顺序倒置而**静默读取被破坏的源码** (22 个文件受害),
 * 导致契约数字长期失真; v3.0.6.16-7 起由 `guard-selfcheck` 夹具守护, 防止再次腐化。
 *
 * 用法: `node scripts/api-contract-guard.mjs`
 * CI 中作为 `pnpm guard:api` 运行, 预算只减不增。
 */
import { join } from 'node:path';
import {
  walk,
  norm,
  parseBackendRoutes,
  collectFrontendCalls,
  segmentsMatch,
  matchesRoute,
} from './lib/route-parse.mjs';

const ROOT = process.cwd();

// ============================================================================
// 1. 后端路由 (B6 修复: handler 归属最近的 @Controller, 无笛卡尔积幽灵)
// ============================================================================
const backendFiles = walk(join(ROOT, 'backend', 'src')).filter((f) => f.endsWith('.controller.ts'));
const { routes: backendRoutes, verbRoutes } = parseBackendRoutes(backendFiles, ROOT);

// ============================================================================
// 2. 前端调用点 (B1–B5 修复)
//    - 扫描 src/services/api/** 与其余 src/** (排除 mockBackend: 那是演示层)
//    - B5 修复: 此前 pageFiles 的三元表达式恒定分支, 屏蔽了 src/services/ 下
//      非 api 目录的真实调用者 (如 src/services/ai/aiService.ts)
// ============================================================================
const mockDir = norm(`${ROOT}/src/services/mockBackend`);
// [v3.0.6.16-7] mswHandlers.ts 是 mockBackend/ 之外的第二套 mock (29 个 handler,
// 0 应用引用, 仅一个测试引用) —— 属死代码, 阶段 3 删除。此处先排除, 避免它
// 的 handler 被当成"前端死调用"污染计数。
const deadMock = norm(`${ROOT}/src/services/mswHandlers.ts`);
const allSrc = walk(join(ROOT, 'src')).filter((f) => {
  const n = norm(f);
  return (
    /\.(ts|tsx)$/.test(n) &&
    !n.startsWith(mockDir) &&
    n !== deadMock &&
    !/\.(test|spec)\./.test(n)
  );
});
const apiDir = norm(`${ROOT}/src/services/api`);
const apiFiles = allSrc.filter((f) => norm(f).startsWith(apiDir));
const pageFiles = allSrc.filter((f) => !norm(f).startsWith(apiDir));

const apiCalls = collectFrontendCalls(apiFiles, ROOT);
const pageCalls = collectFrontendCalls(pageFiles, ROOT);
// [v3.0.6.16-7] 绕过统一 client 的裸请求 (fetch / xhr.open)。
// 纳入对账后: (a) 经 fetch 上传的 files/* 不再被误报为孤儿;
// (b) 页面里硬编码 /api/v1 的不存在端点会显形为死调用 (生产 404)。
const rawCalls = collectFrontendCalls(allSrc, ROOT, { includeRaw: true, rawOnly: true });

/** 合并视图: path -> { files:Set, fromApi:boolean } */
const frontendCalls = new Map();
for (const [path, files] of apiCalls.byPath) {
  frontendCalls.set(path, { files: new Set(files), fromApi: true });
}
for (const [path, files] of pageCalls.byPath) {
  const prev = frontendCalls.get(path);
  if (prev) {
    for (const f of files) prev.files.add(f);
  } else {
    frontendCalls.set(path, { files: new Set(files), fromApi: false });
  }
}
for (const [path, files] of rawCalls.byPath) {
  const prev = frontendCalls.get(path);
  if (prev) {
    for (const f of files) prev.files.add(f);
  } else {
    frontendCalls.set(path, { files: new Set(files), fromApi: false });
  }
}

// ============================================================================
// 3. MSW handler 路径 (演示层)
// ============================================================================
const mswFiles = walk(join(ROOT, 'src', 'services', 'mockBackend')).filter((f) => /\.(ts|tsx)$/.test(f));
const mswCalls = collectFrontendCalls(mswFiles, ROOT);
const mswPaths = mswCalls.byPath;

// ============================================================================
// 4. 三方对账
// ============================================================================
const segCache = new Map();
const segsOf = (p) => {
  if (!segCache.has(p)) segCache.set(p, p.split('/'));
  return segCache.get(p);
};

const mswSegList = [...mswPaths.keys()].map((p) => segsOf(p));

/** 前端路径是否被 MSW 兜底 (段级) */
const mswCovers = (pathSegs) => mswSegList.some((m) => segmentsMatch(pathSegs, m));

const deadCalls = []; // 前端调、后端无 (路径级)
const realDeadCalls = []; // 前端调、后端无、MSW 也无 -> 演示+生产都 404
for (const [path, info] of frontendCalls) {
  const segs = segsOf(path);
  if (!matchesRoute(segs, backendRoutes)) {
    const rec = { path, files: [...info.files], fromApi: info.fromApi };
    deadCalls.push(rec);
    if (!mswCovers(segs)) realDeadCalls.push(rec);
  }
}

// 孤儿: 后端有、前端从未调用
const frontendSegList = [...frontendCalls.keys()].map((p) => segsOf(p));
const orphanRoutes = [];
for (const r of backendRoutes) {
  const rSegs = r.split('/');
  if (!frontendSegList.some((f) => segmentsMatch(f, rSegs))) orphanRoutes.push(r);
}

// [B7] 动词不匹配: 路径在后端存在, 但该动词不存在。
// 注意必须段级比较 —— 后端键是字面量路径 (`GET ai-diagnosis/lung-cad/results`),
// 而前端可能是通配 (`GET ai-diagnosis/*/results`), 直接字符串相等会全量误报。
const backendByVerb = new Map();
for (const key of verbRoutes.keys()) {
  const [verb, ...rest] = key.split(' ');
  const p = rest.join(' ');
  if (!backendByVerb.has(verb)) backendByVerb.set(verb, []);
  backendByVerb.get(verb).push(p.split('/'));
}
const verbMismatch = [];
for (const [vp, files] of apiCalls.byVerbPath) {
  const [verb, ...rest] = vp.split(' ');
  const path = rest.join(' ');
  const segs = segsOf(path);
  // 路径本身必须存在于后端 (任意动词); 否则属 deadCalls 范畴
  if (!matchesRoute(segs, backendRoutes)) continue;
  const list = backendByVerb.get(verb) ?? [];
  if (list.some((bs) => segmentsMatch(segs, bs))) continue;
  verbMismatch.push({ path: `${verb} ${path}`, files: [...files] });
}

// mock-only 且被前端 api 层引用 -> 生产必 404
const mockOnlyUsedByProd = [];
for (const [path, files] of mswPaths) {
  const segs = segsOf(path);
  if (matchesRoute(segs, backendRoutes)) continue; // 后端有, 不算 mock-only
  const callers = frontendCalls.get(path);
  const apiCaller = apiCalls.byPath.get(path);
  if (apiCaller) {
    mockOnlyUsedByProd.push({ path, api: [...apiCaller] });
  } else if (callers && callers.fromApi) {
    mockOnlyUsedByProd.push({ path, api: [...files] });
  }
}

// ============================================================================
// 5. 预算输出
// ============================================================================
const BUDGET = {
  // [v3.0.6.16-7] 门禁修复后首次得到**可信**基线。以下三项是已确认的真实缺陷
  // (此前因解析缺陷不可见), 阶段 1 逐项修复后应收紧为 0:
  //   deadCalls   4: 页面硬编码 /api/v1 调后端不存在的端点 (生产 404, 演示由 MSW 兜底)
  //                  -> quality/defects/:id/status, dental/patient/:id/photos,
  //                     dental/referrals/:id, eye/report/asr/vocab/:condition
  //   verbMismatch 3: 路径存在但动词不一致 -> POST eye/emr/records,
  //                  GET notifications, POST reports/:id/signature
  deadCalls: Number(process.env['GUARD_DEAD_CALLS'] ?? 4),
  realDeadCalls: Number(process.env['GUARD_REAL_DEAD_CALLS'] ?? 0),
  verbMismatch: Number(process.env['GUARD_VERB_MISMATCH'] ?? 3),
};

console.log('[api-contract-guard] 前后端 API 契约检查');
console.log(
  `  后端路由: ${backendRoutes.size}  前端调用路径: ${frontendCalls.size} (api 层 ${apiCalls.byPath.size})  MSW 路径: ${mswPaths.size}`,
);

let failed = false;
const showDetail = (title, items, cap = 30) => {
  console.log(`\n  ── ${title} (${items.length}) ──`);
  for (const it of items.slice(0, cap)) {
    console.log(
      `    ${it.path}${it.files ? `  <- ${it.files[0]}` : ''}${it.api ? `  <- ${it.api[0]}` : ''}`,
    );
  }
  if (items.length > cap) console.log(`    ... 其余 ${items.length - cap} 条`);
};

showDetail('真死调用 (前后端 + MSW 都没有 -> 演示+生产都 404)', realDeadCalls);
showDetail('死调用明细 (前端调 / 后端无; 含 MSW 兜底)', deadCalls, 15);
showDetail('动词不匹配 (路径存在但动词不一致)', verbMismatch, 15);
showDetail('mock-only 且被 api 层引用 (生产 404, 由 MSW 兜底)', mockOnlyUsedByProd, 15);

const check = (key, value, desc) => {
  const limit = BUDGET[key];
  const ok = value <= limit;
  if (!ok) failed = true;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${key}: ${value} / 上限 ${limit}  — ${desc}`);
};

check('realDeadCalls', realDeadCalls.length, '前后端与 MSW 均无此端点 (纯死路)');
check('deadCalls', deadCalls.length, '前端调用但后端无此路由 (含被 MSW 兜底的)');
check('verbMismatch', verbMismatch.length, '路径存在但 HTTP 动词不一致');

console.log(`\n  INFO  孤儿端点 (后端有 / 前端从未调用): ${orphanRoutes.length}`);
console.log(`  INFO  mock-only 引用数: ${mockOnlyUsedByProd.length} (演示态由 MSW 兜底; 生产接入需补后端)`);

if (failed) {
  console.error('\n[api-contract-guard] 存在超预算项, 请修复后再提交。');
  process.exit(1);
}
console.log('\n[api-contract-guard] 通过。');
