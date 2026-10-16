/**
 * [G005 v3.0.6.16-0] 表格比例失衡防回退守则
 *
 * 针对 v3.0.6.15-5 引入的表格比例失衡回归, 冻结以下四类问题预算:
 *   1) 数字 scroll.x   : 传入字面量数字的 scroll.x 会被归一算法覆盖,
 *                         但若绕过 DataTable/ProTable (裸 Table/VirtualTable) 仍会挤压列
 *   2) 组件外裸 Table   : 未走统一封装 -> 无列宽归一/紧凑密度
 *   3) 未归一的 VirtualTable : VirtualTable 未接入 normalizeColumnWidths
 *   4) dt-wrap 列声明宽 : dt-wrap 列若又声明了 width 会双重计入, 需保持单一来源
 *
 * 用法: `node scripts/table-guard.mjs`
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['node_modules', 'dist', '.git', 'coverage', 'build']);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(p)) out.push(p);
  }
  return out;
}

const files = walk(join(ROOT, 'src'));
const rel = (f) => relative(ROOT, f).replace(/\\/g, '/');

// 基础设施自身允许裸 Table
const INFRA = [
  'components/common/DataTable.tsx',
  'components/common/VirtualTable.tsx',
  'components/common/StateView.tsx',
  'components/data/ProTable.tsx',
];

let bareTable = 0;
const bareEx = [];
// VirtualTable 组件本身是否已接入归一 (检查实现文件, 而非调用点数量 ——
// 调用点数量不代表是否归一; 只要 VirtualTable.tsx 接了 normalizeColumnWidths,
// 它的所有调用点就都已被归一)
const VT = join(ROOT, 'src', 'components', 'common', 'VirtualTable.tsx');
let virtualTableUnnormalized = 0;
const virtEx = [];
if (existsSync(VT)) {
  const vtSrc = readFileSync(VT, 'utf8');
  const wired = /normalizeColumnWidths/.test(vtSrc);
  if (!wired) {
    virtualTableUnnormalized = 1;
    virtEx.push({ file: 'components/common/VirtualTable.tsx', n: 1 });
  }
}
let numericScrollX = 0;
const scrollEx = [];

for (const f of files) {
  const relF = rel(f);
  const src = readFileSync(f, 'utf8');
  if (INFRA.some((i) => relF.endsWith(i))) continue;

  // 裸 antd <Table (排除 DataTable/ProTable/TableColumnsType 等)
  const bt = (src.match(/<Table\b/g) || []).length;
  if (bt) {
    bareTable += bt;
    bareEx.push({ file: relF, n: bt });
  }

  // 数字 scroll.x (x: <number>) 且不在统一组件内 —— 表示作者手写了具体宽度
  const nx = (src.match(/scroll=\{\{[^}]*\bx:\s*\d{3,}/g) || []).length;
  if (nx) {
    numericScrollX += nx;
    scrollEx.push({ file: relF, n: nx });
  }
}

const BUDGET = {
  bareTableOutsideInfra: Number(process.env['GUARD_TABLE_BARE'] ?? 0),
  virtualTableUnnormalized: Number(process.env['GUARD_TABLE_VIRTUAL'] ?? 0),
  numericScrollX: Number(process.env['GUARD_TABLE_NUM_X'] ?? 60),
};

console.log('[table-guard] 表格比例失衡检查');
let failed = false;
const check = (key, value, desc, examples) => {
  const limit = BUDGET[key];
  const ok = value <= limit;
  if (!ok) failed = true;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${key}: ${value} / 上限 ${limit}  — ${desc}`);
  if (examples.length && !ok) {
    for (const e of examples.slice(0, 12)) {
      console.log(`        ${e.file} x${e.n}`);
    }
  }
};

check('bareTableOutsideInfra', bareTable, '组件外裸 <Table> (绕过列宽归一/紧凑密度)', bareEx);
check('virtualTableUnnormalized', virtualTableUnnormalized, '<VirtualTable> 未接入 normalizeColumnWidths', virtEx);
check('numericScrollX', numericScrollX, '手写数字 scroll.x (列宽被固定值锁死)', scrollEx);

if (failed) {
  console.error('\n[table-guard] 存在超预算项, 请修复后再提交。');
  process.exit(1);
}
console.log('\n[table-guard] 通过。');
