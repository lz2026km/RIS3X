import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '__tests__') continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(SRC).filter((f) => /\.tsx$/.test(f) && !/\.test\.|\.spec\./.test(f));

const FILTER_HINT = /Input\.Search|<Input\b|<Select\b|AppSelectField|DatePicker|RangePicker|FilterBar|usePagination|searchParams\.get|setFilter|keyword|searchTerm|filterText/i;

const noFilter = [];
let tablePages = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  if (!/<DataTable\b|<ProTable\b|<VirtualTable\b/.test(src)) continue;
  tablePages++;
  if (!FILTER_HINT.test(src)) noFilter.push(relative(SRC, f).replace(/\\/g, '/'));
}

const BUDGET = {
  filterlessTableFiles: Number(process.env['GUARD_FILTERLESS'] ?? 0),
};

console.log('[filter-guard] 表格页面筛选能力检查');
console.log(`  含表格文件: ${tablePages}`);
let failed = false;
const limit = BUDGET.filterlessTableFiles;
const ok = noFilter.length <= limit;
if (!ok) failed = true;
console.log(`  ${ok ? 'PASS' : 'FAIL'}  filterlessTableFiles: ${noFilter.length} / 上限 ${limit}  — 有表格但无任何筛选控件/关键词状态`);
if (!ok) {
  for (const n of noFilter.slice(0, 20)) console.log(`        ${n}`);
}
if (failed) {
  console.error('\n[filter-guard] 存在超预算项, 请修复后再提交。');
  process.exit(1);
}
console.log('\n[filter-guard] 通过。');
