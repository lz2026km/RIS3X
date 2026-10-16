/**
 * [G005 v3.0.6.16-0] 前后端 API 契约守则
 *
 * 审查背景: 全站存在三类"演示能过 / 上线即挂"的问题, 本脚本自动检出:
 *   1) **死调用**  : 前端 api 层调用了后端不存在的路由 → 生产必 404
 *   2) **孤儿端点**: 后端实现了但前端从不调用 (做完没人用)
 *   3) **mock-only**: 只存在于 MSW、后端没有的端点 —— 一旦被生产页面引用即 404
 *
 * 用法: `node scripts/api-contract-guard.mjs`
 * CI 中作为 `pnpm guard:api` 运行, 预算只减不增。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'build', 'test', '__tests__']);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e)) continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const norm = (p) => p.replace(/\\/g, '/');
const stripIndex = (p) => norm(relative(ROOT, p));

// ============================================================================
// 1. 收集后端路由
// ============================================================================
const backendFiles = walk(join(ROOT, 'backend', 'src')).filter((f) => f.endsWith('.controller.ts'));

/** NestJS 路由: @Controller('a/b') + @Get('c/:id') -> 'a/b/c/:id' */
const backendRoutes = new Set();
for (const f of backendFiles) {
  const src = readFileSync(f, 'utf8');
  // 支持多个 @Controller 与空前缀
  const ctrlPrefixes = [...src.matchAll(/@Controller\(\s*['"]([^'"]*)['"]\s*\)/g)].map((m) => m[1]);
  const ctrlEmpty = [...src.matchAll(/@Controller\(\s*\)\s*$/gm)].length;
  const prefixes = [...ctrlPrefixes, ...Array(ctrlEmpty).fill('')];

  const handlers = [...src.matchAll(/@(Get|Post|Put|Patch|Delete)\(\s*(['"])([^'"]*)\2\s*\)/g)];
  for (const h of handlers) {
    const sub = h[3];
    for (const pre of prefixes) {
      const parts = [pre, sub].filter(Boolean).join('/');
      backendRoutes.add(parts.replace(/^\/+/, ''));
    }
  }
}

// ============================================================================
// 2. 收集前端调用点
// ============================================================================
const apiFiles = walk(join(ROOT, 'src', 'services', 'api')).filter((f) => /\.(ts|tsx)$/.test(f));
const pageFiles = walk(join(ROOT, 'src')).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(`${ROOT}${norm('/src/services')}` ? 'services' : 'services'));

/** 从 api.get/post/put/patch/delete(...) 抽取路径字符串 (含反引号模板) */
function extractPaths(text) {
  const out = [];
  const re = /\.(?:get|post|put|patch|delete)(?:<[^>]*>)?\s*\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g;
  let m;
  while ((m = re.exec(text))) {
    let lit = m[1];
    if (lit[0] === '`') lit = lit.slice(1, -1);
    else lit = lit.slice(1, -1);
    if (lit) out.push(lit);
  }
  return out;
}

// 路径归一:
//  1) 模板表达式 -> 通配段
//  2) 去掉 query string (search 部分不属于路由契约)
//  3) 去掉结尾斜杠
//  4) 去掉 API_BASE 前缀常量拼接产生的残留
function templatize(p) {
  return p
    .replace(/\$\{[^}]*\}/g, '*') // 先折叠模板, 再切 query
    .split('?')[0]
    .replace(/`[^`]*$/g, '')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/$/, '');
}

/** 判断前端路径是否命中某个后端路由 (支持通配) */
function matchesBackend(route, backendSet) {
  if (backendSet.has(route)) return true;
  // 前端含 * 而后端是参数段: /fhir/r4/* -> /fhir/r4/Patient/:id
  if (route.includes('*')) {
    const prefix = route.slice(0, route.indexOf('*'));
    for (const b of backendSet) if (b.startsWith(prefix)) return true;
    return false;
  }
  // 后端含通配 (如 $export) 而前端是具体段
  for (const b of backendSet) {
    const rSeg = route.split('/');
    const bSeg = b.split('/');
    if (rSeg.length !== bSeg.length) continue;
    let ok = true;
    for (let i = 0; i < rSeg.length; i++) {
      const r = rSeg[i];
      const bs = bSeg[i];
      if (bs.startsWith(':') || bs.startsWith('$') || bs === '*') continue;
      if (r !== bs) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

const frontendCalls = new Map(); // path -> Set<file>
for (const f of [...apiFiles, ...pageFiles]) {
  const src = readFileSync(f, 'utf8');
  for (const raw of extractPaths(src)) {
    const p = templatize(raw);
    // 过滤: 不含 '/' 的裸段 (通常是 mock 常量/资源路径, 非 REST 路由), 以及空
    if (!p || !p.includes('/')) continue;
    if (!frontendCalls.has(p)) frontendCalls.set(p, new Set());
    frontendCalls.get(p).add(stripIndex(f));
  }
}

// ============================================================================
// 3. 收集 MSW handler 路径
// ============================================================================
const mswFiles = walk(join(ROOT, 'src', 'services', 'mockBackend')).filter((f) => /\.(ts|tsx)$/.test(f));
const mswOnly = new Map(); // path -> Set<file>
for (const f of mswFiles) {
  const src = readFileSync(f, 'utf8');
  // 覆盖 ${API} / ${API_BASE} / ${API_NO_R4} / ${API_R4} 等常量名
  const re = /http\.(?:get|post|put|patch|delete)\(\s*`\$\{[A-Za-z_][A-Za-z0-9_]*\}([^`]*)`/g;
  let m;
  while ((m = re.exec(src))) {
    const p = templatize(m[1]);
    if (!p || !p.includes('/')) continue;
    if (!mswOnly.has(p)) mswOnly.set(p, new Set());
    mswOnly.get(p).add(stripIndex(f));
  }
}

// ============================================================================
// 4. 三方对账
// ============================================================================
const deadCalls = [];   // 前端调、后端无
const orphanRoutes = [];// 后端有、前端从未调

for (const [p, files] of frontendCalls) {
  if (!matchesBackend(p, backendRoutes)) deadCalls.push({ path: p, files: [...files] });
}
for (const r of backendRoutes) {
  let used = false;
  for (const p of frontendCalls.keys()) {
    if (matchesBackend(p, new Set([r]))) { used = true; break; }
  }
  if (!used) orphanRoutes.push(r);
}

// mock-only 且被前端 api 层引用 -> 生产必 404
// 为避免误报, 这里要求"前端路径与 MSW 路径段数一致且逐段匹配(后端通配除外)",
// 即宽松的前缀匹配不算 —— 否则 `models` 会误配到 `ai-platform/models`。
const mockOnlyUsedByProd = [];
for (const [p, mswFilesSet] of mswOnly) {
  if (matchesBackend(p, backendRoutes)) continue; // 后端有, 不算 mock-only
  for (const [frontPath, files] of frontendCalls) {
    const isProdApi = [...files].some((f) => f.includes('services/api/'));
    if (!isProdApi) continue;
    // 双向段匹配: 段数相同且逐段相等 (允许后端段是 :param / $op)
    if (segmentMatch(frontPath, p) || segmentMatch(p, frontPath)) {
      mockOnlyUsedByProd.push({ path: p, api: [...files] });
      break;
    }
  }
}

function segmentMatch(a, b) {
  const as = a.split('/');
  const bs = b.split('/');
  if (as.length !== bs.length) return false;
  for (let i = 0; i < as.length; i++) {
    if (as[i] === '*' || bs[i] === '*') continue;
    if (bs[i].startsWith(':') || bs[i].startsWith('$')) continue;
    if (as[i] !== bs[i]) return false;
  }
  return true;
}

// 真正高危: 前端调用了、后端没有、**MSW 也没有** 的端点
// (既不落真实后端, 又不会被 MSW 兜住 -> 演示与生产都 404, 纯死路)
const realDeadCalls = deadCalls.filter(({ path }) => {
  const inMsw = [...mswOnly.keys()].some((m) => segmentMatch(path, m) || segmentMatch(m, path));
  return !inMsw;
});

// ============================================================================
// 5. 预算输出
// ============================================================================
const BUDGET = {
  deadCalls: Number(process.env['GUARD_DEAD_CALLS'] ?? 40),
  realDeadCalls: Number(process.env['GUARD_REAL_DEAD_CALLS'] ?? 12),
};

console.log('[api-contract-guard] 前后端 API 契约检查');
console.log(`  后端路由: ${backendRoutes.size}  前端调用路径: ${frontendCalls.size}  MSW 路径: ${mswOnly.size}`);

let failed = false;
const showDetail = (title, items, cap = 30) => {
  console.log(`\n  ── ${title} (${items.length}) ──`);
  for (const it of items.slice(0, cap)) {
    console.log(`    ${it.path}${it.files ? `  <- ${it.files[0]}` : ''}${it.api ? `  <- ${it.api[0]}` : ''}`);
  }
  if (items.length > cap) console.log(`    ... 其余 ${items.length - cap} 条`);
};

showDetail('真死调用 (前后端 + MSW 都没有 -> 演示+生产都 404)', realDeadCalls);
showDetail('死调用明细 (前端调 / 后端无; 含 MSW 兜底)', deadCalls, 15);
showDetail('mock-only 且被 api 层引用 (生产 404, 由 MSW 兜底)', mockOnlyUsedByProd, 15);

const check = (key, value, desc) => {
  const limit = BUDGET[key];
  const ok = value <= limit;
  if (!ok) failed = true;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${key}: ${value} / 上限 ${limit}  — ${desc}`);
};

check('realDeadCalls', realDeadCalls.length, '前后端与 MSW 均无此端点 (纯死路)');
check('deadCalls', deadCalls.length, '前端调用但后端无此路由 (含被 MSW 兜底的)');

console.log(`\n  INFO  孤儿端点 (后端有 / 前端从未调用): ${orphanRoutes.length} (信息项, 不作为门禁)`);
console.log(`  INFO  mock-only 引用数: ${mockOnlyUsedByProd.length} (演示态由 MSW 兜底; 生产接入需补后端)`);

if (failed) {
  console.error('\n[api-contract-guard] 存在超预算项, 请修复后再提交。');
  process.exit(1);
}
console.log('\n[api-contract-guard] 通过。');
