/**
 * [G005 v3.0.6.16-0] 下拉选项控件守则
 *
 * 审查发现的四类下拉问题, 本脚本自动检出并冻结预算:
 *   1) label-less options  : options 只有 value 没有 label -> 界面直接显示英文枚举
 *                             (实测 4 处: stat/urgent/routine、CT/MR/DR/MG)
 *   2) 硬编码主数据下拉    : 医生/设备/机构等写死, 机构新增后永远看不到
 *   3) showSearch 无过滤   : 未带 optionFilterProp/filterOption, 按 value 匹配搜不到中文
 *   4) 裸日期输入          : <input type="date"> 而非 antd DatePicker (locale/区间缺失)
 *
 * 用法: `node scripts/select-guard.mjs`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { walk as libWalk, stripComments } from './lib/route-parse.mjs';

const ROOT = process.cwd();

// [v3.0.6.16-7] 统一口径: 复用共享库的 walk (跳过 __tests__) 与 stripComments。
// 此前本 guard 既不剥注释也不排除测试文件 —— 注释里出现的
// `<Select showSearch>` 会被计入, 测试文件也会被计入, 与另两套守卫口径不一致。
const files = libWalk(join(ROOT, 'src')).filter(
  (f) => /\.tsx$/.test(f) && !/\.(test|spec)\./.test(f),
);
const rel = (f) => relative(ROOT, f).replace(/\\/g, '/');

// 1) label-less options: .map(v => ({ value: v })) 且无 label
let labelLess = 0;
const labelLessEx = [];
// 2) 硬编码医生/设备等主数据下拉(写死数组常量 + options 引用)
let hardcodedMaster = 0;
const masterEx = [];
// 3) showSearch 无 filterOption/optionFilterProp
let searchNoFilter = 0;
const searchEx = [];
// 4) 裸日期输入
let rawDateInput = 0;
const dateEx = [];
// 5) [v3.0.6.16-6] 原生 <select> —— 已全量迁移至 AppSelectField, 预算锁定为 0
let nativeSelect = 0;
const nativeSelectEx = [];

const MASTER_KEYS = ['DOCTORS', 'OWNER_OPTIONS', 'DEVICE_OPTIONS', 'NURSES', 'STAFF', 'USERS', 'DEPARTMENTS_LIST'];
// 合法的临床枚举(非机构主数据): 眼压计型号等检查手段枚举, 不应接 deviceApi
const CLINICAL_ENUM_ALLOWLIST = ['src/pages/eye/ris/IntraocularPressurePage.tsx'];

for (const f of files) {
  const src = stripComments(readFileSync(f, 'utf8'));
  const relF = rel(f);

  // label-less: map 到只有 value 的对象
  const llRe = /\.(?:map|flatMap)\(\s*\([^)]*\)\s*=>\s*\(\{\s*value\s*:\s*[^,}]+\s*\}\s*\)/g;
  const llMatches = src.match(llRe) || [];
  if (llMatches.length) {
    labelLess += llMatches.length;
    labelLessEx.push({ file: relF, n: llMatches.length });
  }

  // 硬编码主数据下拉: 出现 *_OPTIONS/DOCTORS 常量且带 options= 引用
  if (!CLINICAL_ENUM_ALLOWLIST.includes(relF)) {
    for (const k of MASTER_KEYS) {
      if (new RegExp(`const\\s+${k}\\b`).test(src) && new RegExp(`options=\\{${k}`).test(src)) {
        hardcodedMaster++;
        masterEx.push({ file: relF, k });
      }
    }
  }

  // showSearch 无过滤: 同一 <Select ...> 块内 showSearch 但无 optionFilterProp/filterOption/onSearch
  const selectRe = /<Select\b[\s\S]{0,400}?\/>/g;
  let sm;
  while ((sm = selectRe.exec(src))) {
    const blk = sm[0];
    if (/\bshowSearch\b/.test(blk) && !/optionFilterProp|filterOption|onSearch/.test(blk)) {
      searchNoFilter++;
      searchEx.push({ file: relF, line: src.slice(0, sm.index).split('\n').length });
    }
  }

  // 裸日期输入
  const dateRe = /type=["']date(?:time-local)?["']/g;
  const dm = src.match(dateRe);
  if (dm) {
    rawDateInput += dm.length;
    dateEx.push({ file: relF, n: dm.length });
  }

  // [v3.0.6.16-6] 原生 <select>: 与 antd 设计体系割裂 (操作系统原生外观),
  // 已全量迁移到 components/common/AppSelectField, 此处锁定防止回流。
  const nsRe = /<select[\s>]/g;
  let nsm;
  while ((nsm = nsRe.exec(src))) {
    nativeSelect++;
    nativeSelectEx.push({ file: relF, line: src.slice(0, nsm.index).split('\n').length });
  }
}

const BUDGET = {
  labelLessOptions: Number(process.env['GUARD_LABEL_LESS'] ?? 2),
  hardcodedMasterSelect: Number(process.env['GUARD_HARDCODED_MASTER'] ?? 0),
  showSearchNoFilter: Number(process.env['GUARD_SEARCH_NOFILTER'] ?? 0),
  rawDateInput: Number(process.env['GUARD_RAW_DATE'] ?? 0),
  nativeSelect: Number(process.env['GUARD_NATIVE_SELECT'] ?? 0),
};

console.log('[select-guard] 下拉选项控件检查');
let failed = false;
const check = (key, value, desc, examples) => {
  const limit = BUDGET[key];
  const ok = value <= limit;
  if (!ok) failed = true;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${key}: ${value} / 上限 ${limit}  — ${desc}`);
  if (examples.length && !ok) {
    for (const e of examples.slice(0, 12)) {
      console.log(`        ${e.file}${e.line ? ':' + e.line : ''}${e.k ? ' [' + e.k + ']' : ''}${e.n ? ' x' + e.n : ''}`);
    }
  }
};

check('labelLessOptions', labelLess, 'options 只有 value 无 label (界面显示英文枚举)', labelLessEx);
check('hardcodedMasterSelect', hardcodedMaster, '硬编码医生/设备/科室等主数据下拉', masterEx);
check('showSearchNoFilter', searchNoFilter, 'showSearch 未带过滤 (搜中文无效)', searchEx);
check('rawDateInput', rawDateInput, '裸 <input type=date> (应改 antd DatePicker)', dateEx);
check('nativeSelect', nativeSelect, '原生 <select> (应改 AppSelectField)', nativeSelectEx);

if (failed) {
  console.error('\n[select-guard] 存在超预算项, 请修复后再提交。');
  process.exit(1);
}
console.log('\n[select-guard] 通过。');
