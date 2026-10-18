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
 * 预算只减不增。设置 DEBUG_ROUTE=<substr> 可打印 MSW 路由中匹配的子集, 便于排查误报。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const norm = (p) => p.replace(/\\/g, '/');

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.git' || e === 'coverage' || e === 'build') continue;
    const p = join(dir, e);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** 从 start 处的反引号起扫描完整模板字面量 (处理嵌套 ${} 与内层反引号) */
function readTemplateLiteral(s, start) {
  let j = start + 1;
  while (j < s.length) {
    const c = s[j];
    if (c === '\\') { j += 2; continue; }
    if (c === '`') return { value: s.slice(start + 1, j), end: j + 1 };
    if (c === '$' && s[j + 1] === '{') {
      let depth = 0;
      let k = j + 1;
      for (; k < s.length; k++) {
        if (s[k] === '`') {
          const r = readTemplateLiteral(s, k);
          if (!r) break;
          k = r.end - 1;
          continue;
        }
        if (s[k] === '{') depth++;
        else if (s[k] === '}') { depth--; if (depth === 0) break; }
      }
      j = k + 1;
      continue;
    }
    j++;
  }
  return null;
}

/**
 * 抽取 HTTP 调用路径。
 * 只认「HTTP 客户端对象」上的调用 (api / client / http / axios / this),
 * 否则 `headers.get('Content-Disposition')` 之类会被误当端点。
 * 支持三种首参: 反引号模板 / 字符串字面量 / 裸标识符常量 (http.post(OCSP))。
 */
function extractPaths(text, consts) {
  const out = [];
  const re = /\b(api|client|http|axios|this)\.(?:get|post|put|patch|delete)(?:<[^>]*>)?\s*\(\s*/g;
  let m;
  while ((m = re.exec(text))) {
    const i = m.index + m[0].length;
    const c = text[i];
    if (c === '`') {
      const r = readTemplateLiteral(text, i);
      if (r && r.value) out.push(r.value);
      if (r) re.lastIndex = r.end;
    } else if (c === "'" || c === '"') {
      const end = text.indexOf(c, i + 1);
      if (end > 0) {
        out.push(text.slice(i + 1, end));
        re.lastIndex = end + 1;
      }
    } else if (/[A-Za-z_$]/.test(c)) {
      const idm = /^[A-Za-z_$][\w$]*/.exec(text.slice(i));
      const ident = idm ? idm[0] : '';
      if (ident && consts && consts.has(ident)) out.push(consts.get(ident));
      if (ident) re.lastIndex = i + ident.length;
    }
  }
  return out;
}

/** 收集路径前缀常量 (普通字符串 / 模板字面量 / 跨行表达式), 并迭代解析引用 */
function collectPrefixConstants(src) {
  const map = new Map();
  // 必须整行锚定: 否则 `const X = typeof a !== 'undefined' ? 'y' : 'z'` 会把
  // 比较用的 'undefined' 当成 X 的值。
  for (const m of src.matchAll(/^[^\S\n]*const\s+([A-Za-z_$][\w$]*)\s*=\s*['"]([^'"]*)['"]\s*[,;]?[^\S\n]*$/gm)) {
    map.set(m[1], m[2]);
  }
  for (const m of src.matchAll(/^[^\S\n]*const\s+([A-Za-z_$][\w$]*)\s*=\s*`([^`]*)`\s*[,;]?[^\S\n]*$/gm)) {
    if (!map.has(m[1])) map.set(m[1], m[2]);
  }
  // 跨行表达式常量: const X = ... ? 'a' : '/b'   (取路径样式的字面量, 排除含 : 的绝对 URL)
  const declRe = /const\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]*(?:\n[^;\n]*)?)/g;
  let d;
  while ((d = declRe.exec(src))) {
    const name = d[1];
    if (map.has(name)) continue;
    const rhs = d[2];
    const lits = [...rhs.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
    // 必须含 `/` 才可能是路径: 否则 `typeof x !== 'undefined'` 里的 'undefined'
    // 会被当成常量值, 进而把整条路由解析成 "undefined/..."。
    const pathLike = lits
      .filter((s) => s.includes('/') && /^\/?[a-z][\w./-]*$/i.test(s))
      .sort((a, b) => b.length - a.length)[0];
    if (pathLike) map.set(name, pathLike);
  }
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const [k, v] of map) {
      if (!v.includes('${')) continue;
      const next = v.replace(/\$\{([A-Za-z_$][\w$]*)\}/g, (full, n) => (map.has(n) ? map.get(n) : full));
      if (next !== v) {
        map.set(k, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return map;
}

/** 迭代把 ${CONST} / ${expr} 替换为常量值或通配 (常量本身可能是模板) */
function substituteConstants(tpl, consts) {
  let cur = tpl;
  for (let pass = 0; pass < 5; pass++) {
    if (!cur.includes('${')) break;
    const next = cur.replace(/\$\{([^}]*)\}/g, (_, expr) => {
      const name = expr.trim();
      if (consts.has(name)) return consts.get(name);
      const m = /^([A-Za-z_$][\w$]*)\s*[?:]/.exec(name);
      if (m && consts.has(m[1])) return consts.get(m[1]);
      return '*';
    });
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

/**
 * 规范化: 去 host → 去 /api(/vN) → 段级 templatize → 去掉前导无法解析的基址段。
 * 例: "STAR/ai-draft-v2/extract-fields" (STAR 为未解析的基址通配) → "ai-draft-v2/extract-fields"
 */
function normalizePath(full) {
  const stripped = full
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^\/?api(\/v\d+)?\/?/, '');
  const segs = stripped
    .split('?')[0]
    .split('/')
    .map((seg) => {
      if (seg === '*' || seg.includes('${')) return ':p';
      const cleaned = seg.replace(/\*+$/, '');
      return cleaned === '' ? ':p' : cleaned;
    })
    .filter((s) => s.length > 0);
  while (segs.length > 1 && segs[0] === ':p') segs.shift();
  return segs.join('/');
}

/** 模板解析在复杂嵌套下可能带出后续代码, 这类结果不是真实路径 */
function looksLikeCodeArtifact(p) {
  return /[`}{]/.test(p) || /\s:\s/.test(p) || p.includes('${');
}

// ============================================================================
// 1. MSW handler 路由
// ============================================================================
const mswFiles = walk(join(ROOT, 'src', 'services', 'mockBackend')).filter((f) => /\.(ts|tsx)$/.test(f));
const mswRoutes = new Set();
for (const f of mswFiles) {
  const src = readFileSync(f, 'utf8');
  const consts = collectPrefixConstants(src);
  // 用 extractPaths 而非只匹配反引号: 不少 handler 写的是普通字符串
  // (http.get('/api/v1/olap/metadata')), 只认模板字面量会漏掉整批。
  for (const rawPath of extractPaths(src, consts)) {
    const full = substituteConstants(rawPath, consts);
    if (looksLikeCodeArtifact(full)) continue;
    const p = normalizePath(full);
    if (p) mswRoutes.add(p);
  }
}

// ============================================================================
// 2. 前端调用点 (只看 services/api 层; 页面裸 fetch 已在 v3.0.6.16-6 全部收口)
//    client.ts 是 HTTP 客户端实现本身, 不是调用点 —— 它的 JSDoc @example 里写了
//    `api.post('/reports/123/sign')`, 扫描它会产出假端点, 故排除。
// ============================================================================
const apiFiles = walk(join(ROOT, 'src', 'services', 'api')).filter(
  (f) =>
    /\.(ts|tsx)$/.test(f) &&
    !/\.(test|spec)\./.test(f) &&
    !norm(f).includes('/__tests__/') &&
    !norm(f).endsWith('/services/api/client.ts'),
);
const frontendCalls = new Map();
for (const f of apiFiles) {
  const src = readFileSync(f, 'utf8');
  const consts = collectPrefixConstants(src);
  for (const rawPath of extractPaths(src, consts)) {
    const full = substituteConstants(rawPath, consts);
    if (looksLikeCodeArtifact(full)) continue;
    const p = normalizePath(full);
    if (!p) continue;
    if (!frontendCalls.has(p)) frontendCalls.set(p, new Set());
    frontendCalls.get(p).add(norm(relative(ROOT, f)));
  }
}

// ============================================================================
// 3. 对账
// ============================================================================
function matchesMsw(route, set) {
  if (set.has(route)) return true;
  const segs = route.split('/');
  for (const r of set) {
    const rs = r.split('/');
    if (rs.length !== segs.length) continue;
    let ok = true;
    for (let i = 0; i < segs.length; i++) {
      if (rs[i] === ':p' || segs[i] === ':p') continue;
      if (rs[i] !== segs[i]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

const uncovered = [];
for (const [p, files] of frontendCalls) {
  if (!matchesMsw(p, mswRoutes)) uncovered.push({ path: p, files: [...files] });
}

// ============================================================================
// 4. 输出 (预算只减不增)
// ============================================================================
const BUDGET = Number(process.env['GUARD_DEMO_UNCOVERED'] ?? 0);

console.log('[demo-guard] 演示构建 (MSW) 可用性检查');
console.log(`  MSW 路由: ${mswRoutes.size}  前端调用路径: ${frontendCalls.size}`);

if (process.env['DEBUG_ROUTE']) {
  const needle = process.env['DEBUG_ROUTE'];
  const hits = [...mswRoutes].filter((r) => r.includes(needle));
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
