// G005-P0 危急值前缀统一 + 双前缀族修复 — 三方一致性验证
// 前端 api 路径 (src/services/api/*.ts) ↔ 后端 controller 路由 (backend/src/**/*.controller.ts) ↔ MSW handler (src/services/mockBackend/*.ts)
// 运行: node scripts/verify-api-consistency.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const SRC = join(ROOT, 'src');
const BACKEND = join(ROOT, 'backend', 'src');

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

// 模板字符串归一化:
//   /criticals/${id}/x  -> /criticals/:id/x
//   /criticals${qs ? ...} -> /criticals (截断查询条件)
//   /eye${buildQuery(...)} -> /eye
//   :criticalId -> :id
function normalize(tpl) {
  let out = tpl.split(/\$\{qs/i)[0];
  out = out
    .replace(/\$\{[A-Za-z_][\w]*(\.\w+)?\}/g, ':id')
    .replace(/\$\{[^}]*\}/g, '');
  out = out.replace(/:\w+/g, ':id');
  return out.replace(/[?&].*$/, '');
}

// ---------- 前端: api.<verb>('<path>') / api.get<X>(`${API}/...`) ----------
function scanFrontend() {
  const calls = [];
  for (const file of walk(SRC).filter((f) => /[\\/]api[\\/][^\\/]+\.ts$/.test(f) && !f.includes('mockBackend'))) {
    const src = readFileSync(file, 'utf8');
    const consts = new Map();
    const constRe = /(?:const|let)\s+([A-Z][A-Z0-9_]*_API|API)\s*=\s*(['"`])([\s\S]*?)\2/g;
    let cm;
    while ((cm = constRe.exec(src))) consts.set(cm[1], cm[3]);
    const re = /api\.(get|post|put|patch|delete)(?:\s*<[^()]*>)?\s*\(\s*([`'"])([\s\S]*?)\2/g;
    let m;
    while ((m = re.exec(src))) {
      let tpl = m[3];
      // 解析模板中的已知常量 (${EYE_API} -> /eye)
      tpl = tpl.replace(/\$\{([A-Z][A-Z0-9_]*_API|API)\}/g, (_, name) => consts.get(name) ?? '');
      calls.push({ file: relative(ROOT, file), verb: m[1], path: normalize(tpl) });
    }
  }
  return calls;
}

// ---------- 后端: @Controller('x') + @Get/@Post/...('y') ----------
function scanBackend() {
  const routes = [];
  for (const file of walk(BACKEND).filter((f) => f.endsWith('.controller.ts'))) {
    const src = readFileSync(file, 'utf8');
    const ctrl = src.match(/@Controller\(\s*(['"])([\s\S]*?)\1\s*\)/);
    if (!ctrl) continue;
    const base = normalize(ctrl[2]);
    const re = /@(Get|Post|Put|Patch|Delete)\(\s*(?:(['"])([\s\S]*?)\2|)\s*\)/g;
    let m;
    while ((m = re.exec(src))) {
      const sub = normalize(m[3] || '');
      const full = [base, sub].filter(Boolean).join('/').replace(/\/+/g, '/');
      routes.push({ file: relative(BACKEND, file), verb: m[1].toUpperCase(), path: `/${full}` });
    }
  }
  return routes;
}

// ---------- MSW: http.<verb>(`${API}/sub` | '/api/v1/...') ----------
function scanMsw() {
  const handlers = [];
  for (const file of walk(SRC).filter((f) => f.includes(`${'mockBackend'}`) && f.endsWith('.ts') && !f.includes('__tests__'))) {
    const src = readFileSync(file, 'utf8');
    const consts = new Map();
    const constRe = /(?:const|let)\s+(API\w*|API_BASE|EXT_API)\s*=\s*(['"`])([\s\S]*?)\2/g;
    let cm;
    while ((cm = constRe.exec(src))) consts.set(cm[1], cm[3]);
    const re = /http\.(get|post|put|patch|delete)\(\s*(`\$\{(API_BASE|EXT_API|API\w*)\}([\s\S]*?)`|['"]([\s\S]*?)['"])/g;
    let m;
    while ((m = re.exec(src))) {
      let path;
      if (m[3]) {
        const name = m[3];
        const base = consts.get(name) ?? (name === 'API_BASE' ? '/api/v1' : null);
        if (base === null) continue;
        path = base + normalize(m[4]);
      } else {
        path = normalize(m[5]);
      }
      handlers.push({ file: relative(ROOT, file), verb: m[1].toUpperCase(), path });
    }
  }
  return handlers;
}

const FAMILIES = ['criticals', 'critical-ext', 'data-report', 'eye', 'v1/benchmark', 'v1/olap', 'dicom/compress'];

const fe = scanFrontend();
const be = scanBackend();
const msw = scanMsw();

const beByKey = new Map(be.map((r) => [`${r.verb} ${r.path}`, r]));
const mswByKey = new Map(msw.map((r) => [`${r.verb} ${r.path}`, r]));

// mock URL = /api/v1 + 前端 path; MSW 注册路径已含 /api/v1
let ok = 0, fail = 0;
const rows = [];
for (const c of fe) {
  const fam = FAMILIES.find((f) => c.path.startsWith('/' + f));
  if (!fam) continue;
  const verb = c.verb.toUpperCase();
  const beKey = `${verb} ${c.path}`;
  const mswKey = `${verb} /api/v1${c.path}`;
  const hasBe = beByKey.has(beKey);
  const hasMsw = mswByKey.has(mswKey);
  const status = hasBe && hasMsw ? 'OK' : !hasBe && !hasMsw ? 'MISSING-BOTH' : !hasBe ? 'MISSING-BACKEND' : 'MISSING-MSW';
  if (status === 'OK') ok++; else { fail++; rows.push({ status, fe: `${verb} ${c.path}`, feFile: c.file }); }
}
rows.sort((a, b) => (a.status < b.status ? -1 : 1));

console.log('===== 三方一致性验证 (前端路径 → 后端 controller → MSW handler) =====');
console.log(`前端 API 调用数(相关族): ${fe.filter((c) => FAMILIES.some((f) => c.path.startsWith('/' + f))).length}  一致: ${ok}  不一致: ${fail}`);
if (fail > 0) {
  for (const r of rows) console.log(`  [${r.status}] ${r.fe}   (${r.feFile})`);
} else {
  console.log('  ✓ 全部一致');
}

// 反向检查: 后端有而前端未调用(供参考)
console.log('\n===== 后端 controller 路由(相关族, 共 ' + be.filter((r) => FAMILIES.some((f) => r.path.startsWith('/' + f))).length + ' 条) =====');
for (const r of be.filter((r) => FAMILIES.some((f) => r.path.startsWith('/' + f))).sort((a, b) => a.path.localeCompare(b.path))) {
  const used = fe.some((c) => c.verb.toUpperCase() === r.verb && c.path === r.path);
  const mswOk = mswByKey.has(`${r.verb} /api/v1${r.path}`);
  console.log(`  ${r.verb} ${r.path}  frontend=${used ? '✓' : '-'} msw=${mswOk ? '✓' : '-'}  (${r.file})`);
}

console.log('\n===== 后端路由与前端路径一一对应 (同路径不同 verb 视为一致) =====');
let mismatch = 0;
for (const r of be.filter((r) => FAMILIES.some((f) => r.path.startsWith('/' + f)))) {
  const feMatch = fe.some((c) => c.path === r.path && c.verb.toUpperCase() === r.verb);
  if (!feMatch) { mismatch++; console.log(`  后端独有: ${r.verb} ${r.path}`); }
}
console.log(mismatch === 0 ? '  ✓ 无后端独有路由(所有后端路由前端均已覆盖)' : `  ${mismatch} 条后端路由前端未调用(可能为预留端点)`);
process.exit(fail > 0 ? 1 : 0);
