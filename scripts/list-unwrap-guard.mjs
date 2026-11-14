/**
 * G005 RIS — guard:list-unwrap
 *
 * 背景: `api.getList()` / `requestList()` 恒返回归一化后的 `{ items, total }`
 * (`ApiResponse<NormalizedList<T>>`), 但消费方仍写 `Array.isArray(res.data)` ——
 * 对对象恒为 false, 页面永久空表。报告工作台 (`/reports`) 曾因此长期显示
 * 「接口不可用」, 本版本一次性修复 31 处同类 P0。
 *
 * 本 guard 保守地只盯 `getList` / `requestList` 的返回值 (不覆盖 reportApi.list
 * 等二次封装), 检测三类误用:
 *   a) 变量 X ← getList/requestList, 同文件出现 `Array.isArray(X.data)`
 *   b) 直接链式: `Array.isArray(<getList调用>.data)`
 *   c) 变量 X ← getList/requestList, 使用 `X.data.length|map|filter`,
 *      且该文件从未用 `listItems(...)` 解包
 *
 * 正确写法: `listItems<T>(res)` 或 `res.data.items`。
 * 文件头注释 `// list-unwrap-guard: allow` 可显式豁免 (需写明理由)。
 *
 * 用法: `node scripts/list-unwrap-guard.mjs` (CI: `pnpm guard:list-unwrap`)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { walk, norm } from './lib/route-parse.mjs';

const ROOT = process.cwd();
const ALLOW_MARK = 'list-unwrap-guard: allow';
const BUDGET = 0;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 把注释与字符串/模板字面量的内容替换为空格 (保留换行, 因此行号仍与原文一致)。
 * 这样既不会在注释里误报, 也能安全地做括号配对。
 */
export function maskSource(src) {
  const out = src.split('');
  const n = src.length;
  const blank = (start, end) => {
    for (let k = start; k < end; k++) {
      if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
    }
  };
  let i = 0;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === '/' && c2 === '/') {
      const s = i;
      while (i < n && src[i] !== '\n') i++;
      blank(s, i);
      continue;
    }
    if (c === '/' && c2 === '*') {
      const s = i;
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i = Math.min(n, i + 2);
      blank(s, i);
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      const s = i;
      i++;
      while (i < n) {
        if (src[i] === '\\') {
          i += 2;
          continue;
        }
        if (src[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      blank(s, i);
      continue;
    }
    i++;
  }
  return out.join('');
}

function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === '\n') line++;
  return line;
}

function matchParen(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function hasAllowHeader(src) {
  return src.split(/\r?\n/, 5).some((l) => l.includes(ALLOW_MARK));
}

/**
 * 分析单文件。返回 `{ violations, assignments, usesListItems }`。
 * violations 元素: { file, line, index, kind, variable }
 */
export function analyzeListUnwrap(src, file = '<fixture>') {
  const masked = maskSource(src);
  const usesListItems =
    /\blistItems\s*(?:<[^;\n]{0,300}>)?\s*\(/.test(masked);
  const assignments = [];
  const assignRe =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n;]+)?=\s*(?:await\s+)?[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*\s*(?:\.|\?\.)\s*(getList|requestList)\s*(?:<[^;\n]{0,300}>)?\s*\(/g;
  let m;
  while ((m = assignRe.exec(masked))) {
    assignments.push({ variable: m[1], method: m[2], index: m.index });
  }

  if (hasAllowHeader(src)) {
    return { violations: [], assignments, usesListItems, allowedFile: true };
  }

  const violations = [];
  const seen = new Set();
  const push = (index, kind, variable) => {
    const key = `${index}:${kind}:${variable ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({ file, line: lineOf(masked, index), index, kind, variable });
  };

  for (const a of assignments) {
    const name = escapeRe(a.variable);
    const reA = new RegExp(
      `Array\\s*\\.\\s*isArray\\s*\\(\\s*${name}\\s*(?:\\?\\.|\\.)\\s*data\\b`,
      'g',
    );
    for (const hit of masked.matchAll(reA)) push(hit.index, 'array-isArray', a.variable);

    if (!usesListItems) {
      const reC = new RegExp(
        `\\b${name}\\s*(?:\\?\\.|\\.)\\s*data\\s*(?:\\?\\.|\\.)\\s*(?:length|map|filter)\\b`,
        'g',
      );
      for (const hit of masked.matchAll(reC)) push(hit.index, 'data-chain', a.variable);
    }
  }

  const chainRe = /Array\s*\.\s*isArray\s*\(/g;
  for (const hit of masked.matchAll(chainRe)) {
    const open = hit.index + hit[0].length - 1;
    const close = matchParen(masked, open);
    if (close < 0) continue;
    const arg = masked.slice(open + 1, close);
    if (!/\.\s*(?:getList|requestList)\b/.test(arg)) continue;
    if (!/(?:\.|\?\.)\s*data\b/.test(arg)) continue;
    push(hit.index, 'direct-chain', null);
  }

  violations.sort((x, y) => x.index - y.index);
  return { violations, assignments, usesListItems, allowedFile: false };
}

function run() {
  const files = walk(join(ROOT, 'src')).filter((f) => {
    const n = norm(f);
    if (!/\.(ts|tsx)$/.test(n)) return false;
    if (/\.(test|spec)\./.test(n)) return false;
    return true;
  });

  let assignmentCount = 0;
  let allowedFiles = 0;
  const violations = [];
  for (const f of files) {
    const rel = norm(f).replace(norm(`${ROOT}/`), '');
    let raw;
    try {
      raw = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    const result = analyzeListUnwrap(raw, rel);
    assignmentCount += result.assignments.length;
    if (result.allowedFile) {
      allowedFiles++;
      continue;
    }
    violations.push(...result.violations);
  }

  const ok = violations.length <= BUDGET;
  console.log('[list-unwrap-guard] getList/requestList 解包检查');
  console.log(
    `  扫描文件: ${files.length}  getList/requestList 赋值: ${assignmentCount}  豁免文件: ${allowedFiles}`,
  );
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  listUnwrapMisuse: ${violations.length} / 上限 ${BUDGET}  — getList 返回 {items,total} 却按数组消费`,
  );

  if (!ok) {
    for (const v of violations) {
      const what =
        v.kind === 'array-isArray'
          ? `Array.isArray(${v.variable}.data) 恒为 false`
          : v.kind === 'direct-chain'
            ? 'Array.isArray(<getList调用>.data) 恒为 false'
            : `${v.variable}.data.${v.kind === 'data-chain' ? 'length/map/filter' : '?'} 作用于归一化对象`;
      console.log(`        ${v.file}:${v.line}  ${what}`);
      console.log(
        `          → 改用 listItems(res), 或读取 res.data.items (listItems 见 src/services/api/client.ts)`,
      );
    }
    console.error('\n[list-unwrap-guard] 存在超预算项, 请修复后再提交。');
    process.exitCode = 1;
    return;
  }
  console.log('\n[list-unwrap-guard] 通过。');
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) run();
