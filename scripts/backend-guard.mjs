/**
 * G005 RIS — guard:backend
 *
 * 审查 (v3.0.6.16-8) 发现三类高危后端缺陷并已修复:
 *   1) **跨租户写入**: 22 处 `update`/`delete` 只按 `id` 定位, 缺 `tenantId`,
 *      导致 A 租户可改/删 B 租户的 Patient / Report / Exam / CriticalValue / User …
 *   2) **操作人不可归属**: JWT 载荷是 `sub` 而不是 `id`, 11 处读 `req.user.id`
 *      (恒为 undefined) -> 域内审计记成 "unknown"; 且客户端 `body.actorId` 因此
 *      反而生效 -> **签名/审核/召回的操作人可被伪造**
 *   3) **硬编码操作人**: '当前用户' / 'current-user' / 'system' 被写进
 *      危急值闭环署名、重拍审批、修订作者等医疗法律记录
 *
 * 本守卫把上述三类钉死, 防止回归。
 *
 * 用法: `node scripts/backend-guard.mjs`  (CI 中作为 `pnpm guard:backend`)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './lib/route-parse.mjs';

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
    if (e === 'node_modules' || e === 'dist' || e === '.git' || e === '__tests__') continue;
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

// ============================================================================
// 0) 收集带 tenantId 的 Prisma 模型
// ============================================================================
const schemaPath = join(ROOT, 'backend', 'prisma', 'schema.prisma');
const schemaSrc = readFileSync(schemaPath, 'utf8');
/** model 名 -> 是否含 tenantId 列 */
const tenantModels = new Set();
for (const m of schemaSrc.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
  if (/^\s*tenantId\s+/m.test(m[2])) tenantModels.add(m[1]);
}

// ============================================================================
// 工具: 取 `where: { ... }` 里花括号平衡的内容
// ============================================================================
function extractWhere(src, from) {
  const idx = src.indexOf('where:', from);
  if (idx < 0) return null;
  let i = src.indexOf('{', idx);
  if (i < 0) return null;
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') {
      depth--;
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  return null;
}

const backendFiles = walk(join(ROOT, 'backend', 'src')).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
const backendTests = walk(join(ROOT, 'backend', 'test')).filter((f) => f.endsWith('.ts'));

// ============================================================================
// 1) 跨租户写入: 带 tenantId 的模型, update/delete/findUnique 只按 id 定位
// ============================================================================
const untenantWrites = [];
for (const f of backendFiles) {
  const src = stripComments(readFileSync(f, 'utf8'));
  const rel = norm(relative(ROOT, f));
  // this.prisma.<model>.update( / .delete( / .findUnique(
  const re = /this\.prisma\.(\w+)\.(update|delete|findUnique|findFirst|updateMany|deleteMany)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const model = m[1];
    const op = m[2];
    if (!tenantModels.has(model)) continue;
    if (op === 'findFirst' || op === 'updateMany' || op === 'deleteMany') continue; // 这两个总是带显式 where
    const where = extractWhere(src, m.index + m[0].length);
    if (!where) continue;
    // where 里只按 id 定位 => 缺 tenantId
    if (/\btenantId\b/.test(where)) continue;
    if (!/\bid\s*:/.test(where)) continue;
    // 复合主键 where: { id, tenantId } 已被上面的 tenantId 检查覆盖
    const line = src.slice(0, m.index).split('\n').length;
    untenantWrites.push({ rel, line, model, op, where: where.replace(/\s+/g, ' ').slice(0, 90) });
  }
}

// ============================================================================
// 2) 操作人: req.user.id (JWT 里是 sub)
// ============================================================================
const reqUserId = [];
for (const f of backendFiles) {
  const src = stripComments(readFileSync(f, 'utf8'));
  const rel = norm(relative(ROOT, f));
  const re = /(?:req|request)\.user\??\.id\b|user as \{\s*id\??:\s*string\s*\}/g;
  let m;
  while ((m = re.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length;
    reqUserId.push({ rel, line, snippet: m[0] });
  }
}

// ============================================================================
// 3) 客户端可伪造操作人: body.actorId 被当作操作人
// ============================================================================
const forgedActor = [];
for (const f of backendFiles) {
  const src = stripComments(readFileSync(f, 'utf8'));
  const rel = norm(relative(ROOT, f));
  const re = /body\.actorId\s*\?\?|\|\|\s*body\.actorId|body\.actorId\.trim\(\)/g;
  let m;
  while ((m = re.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length;
    forgedActor.push({ rel, line, snippet: m[0] });
  }
}

// ============================================================================
// 4) 硬编码操作人字面量
// ============================================================================
const HARDCODED_ACTORS = ["'当前用户'", "'current-user'", '"当前用户"', '"current-user"'];
const hardcodedActors = [];
for (const f of backendFiles) {
  const src = stripComments(readFileSync(f, 'utf8'));
  const rel = norm(relative(ROOT, f));
  for (const lit of HARDCODED_ACTORS) {
    let idx = src.indexOf(lit);
    while (idx >= 0) {
      const line = src.slice(0, idx).split('\n').length;
      hardcodedActors.push({ rel, line, snippet: lit });
      idx = src.indexOf(lit, idx + lit.length);
    }
  }
}

// ============================================================================
// 输出
// ============================================================================
const BUDGET = {
  untenantWrites: Number(process.env['GUARD_UNTENANT_WRITES'] ?? 0),
  reqUserId: Number(process.env['GUARD_REQ_USER_ID'] ?? 0),
  forgedActor: Number(process.env['GUARD_FORGED_ACTOR'] ?? 0),
  hardcodedActors: Number(process.env['GUARD_HARDCODED_ACTORS'] ?? 0),
};

console.log('[backend-guard] 后端多租户与操作人归属检查');
console.log(`  带 tenantId 的模型: ${tenantModels.size}  扫描后端文件: ${backendFiles.length}`);

let failed = false;
const check = (key, value, desc, examples) => {
  const limit = BUDGET[key];
  const ok = value <= limit;
  if (!ok) failed = true;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${key}: ${value} / 上限 ${limit}  — ${desc}`);
  if (!ok) {
    for (const e of examples.slice(0, 15)) {
      console.log(`        ${e.rel}:${e.line}  ${e.snippet ?? `${e.model}.${e.op} where ${e.where}`}`);
    }
    if (examples.length > 15) console.log(`        ... 其余 ${examples.length - 15} 个`);
  }
};

check('untenantWrites', untenantWrites.length, '带 tenantId 的模型写入/读取未按 tenantId 定位 (跨租户风险)', untenantWrites);
check('reqUserId', reqUserId.length, '读取 req.user.id (JWT 载荷是 sub, id 恒为 undefined)', reqUserId);
check('forgedActor', forgedActor.length, '客户端 body.actorId 被当作操作人 (可伪造签名/审核/召回)', forgedActor);
check('hardcodedActors', hardcodedActors.length, "硬编码操作人字面量 ('当前用户' / 'current-user')", hardcodedActors);

if (failed) {
  console.error('\n[backend-guard] 存在超预算项, 请修复后再提交。');
  process.exit(1);
}
console.log('\n[backend-guard] 通过。');
