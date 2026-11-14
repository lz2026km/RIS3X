/**
 * G005 RIS — guard:enum-coverage
 *
 * 背景: 前端状态筛选 / 看板常把后端枚举「抄一部分」写成字符串字面量数组,
 * 后端新增状态后页面悄悄漏掉 —— 本版本补齐了 10 态检查、10 态危急值、
 * 8 态预约。本 guard 从 `backend/prisma/schema.prisma` 读取枚举, 对照
 * `src/**` 中「同一枚举值出现 ≥2 个」的字符串数组, 发现**部分覆盖**即报告。
 *
 * 只把「明显用于筛选/看板/状态列表」的数组计入:
 *   数组所在行或上文 3 行内出现 status|state|状态|filter|filterOptions|COLUMNS|OPTIONS。
 * 刻意子集 (如看板仅展示流程中列、pending 队列) 写入
 * `scripts/enum-coverage.allowlist.json`, 每项必须带 reason。
 *
 * 范围: src 下全部 .ts/.tsx, 排除测试与 src/services/mockBackend (演示数据层)。
 * 用法: `node scripts/enum-coverage-guard.mjs` (CI: `pnpm guard:enum-coverage`)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { walk, norm, readTemplateLiteral } from './lib/route-parse.mjs';

const ROOT = process.cwd();
const BUDGET = 0;
const REQUESTED_ENUMS = [
  'ExamStatus',
  'CriticalState',
  'ReportState',
  'AppointmentState',
  'DeviceState',
];
const ALLOWLIST_FILE = join(ROOT, 'scripts', 'enum-coverage.allowlist.json');
const CONTEXT_RE = /(?:status|state|状态|filter|filterOptions|COLUMNS|OPTIONS)/i;

const STRING_RE = /(['"])((?:\\.|(?!\1)[^\\\n])*)\1/g;

/** 解析 `enum <Name> { ... }`; 返回 Map<名称, 值数组> */
export function parsePrismaEnums(src) {
  const enums = new Map();
  const re = /\benum\s+([A-Za-z_]\w*)\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(src))) {
    const values = [];
    for (const rawLine of m[2].split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('//') || line.startsWith('///')) continue;
      if (line.startsWith('@@') || line.startsWith('@')) continue;
      const token = line.split(/\s+/)[0];
      if (/^[A-Za-z_]\w*$/.test(token)) values.push(token);
    }
    if (values.length > 0) enums.set(m[1], values);
  }
  return enums;
}

/** 注释替换为空格 (保留换行与字符串内容), 供数组/枚举字面量扫描 */
export function maskComments(src) {
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
    if (c === "'" || c === '"') {
      i++;
      while (i < n) {
        if (src[i] === '\\') {
          i += 2;
          continue;
        }
        if (src[i] === c) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === '`') {
      const r = readTemplateLiteral(src, i);
      if (r) {
        i = r.end;
        continue;
      }
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

function matchBracket(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"') {
      i++;
      while (i < s.length) {
        if (s[i] === '\\') {
          i += 2;
          continue;
        }
        if (s[i] === c) break;
        i++;
      }
      continue;
    }
    if (c === '`') {
      const r = readTemplateLiteral(s, i);
      if (r) {
        i = r.end - 1;
        continue;
      }
    }
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function collectArraysFromMasked(masked) {
  const arrays = [];
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] !== '[') continue;
    const close = matchBracket(masked, i);
    if (close < 0) continue;
    // 排除「成员判定」与「对象属性值」两类数组: 它们是动作可用性 / 状态转移表,
    // 不是筛选/看板的状态选项清单。
    const after = masked.slice(close + 1, close + 40);
    if (/^\s*(?:\?\.)?\.\s*(?:includes|has|indexOf)\b/.test(after)) continue;
    const lineStart = masked.lastIndexOf('\n', i - 1) + 1;
    const before = masked.slice(lineStart, i);
    if (/(?:[A-Za-z_$][\w$]*|['"][^'"]*['"])\s*:\s*$/.test(before)) continue;
    const inner = masked.slice(i + 1, close);
    const withoutStrings = inner.replace(STRING_RE, '');
    if (!/^[\s,]*$/.test(withoutStrings)) continue;
    const values = [];
    for (const m of inner.matchAll(STRING_RE)) values.push(m[2]);
    if (values.length < 2) continue;
    arrays.push({ line: lineOf(masked, i), index: i, values });
  }
  return arrays;
}

/** 枚举名 -> 领域关键词 (用于排除同名字段但属于别的业务的数组) */
const ENUM_DOMAIN = {
  ExamStatus: /exam/i,
  CriticalState: /critical/i,
  ReportState: /report/i,
  AppointmentState: /appoint|appt/i,
  DeviceState: /device/i,
};

function contextText(maskedSrc, line) {
  const lines = maskedSrc.split(/\r?\n/);
  const start = Math.max(0, line - 4);
  return lines.slice(start, line).join('\n');
}

/**
 * 判断数组是否处于「状态/筛选/看板」上下文 (所在行 + 上文 3 行)。
 * 使用**注释已剥离**的文本, 避免注释里的「状态/筛选」把转移表等误判为筛选列表。
 */
export function isStatusContext(maskedSrc, line) {
  return CONTEXT_RE.test(contextText(maskedSrc, line));
}

/**
 * 分析单文件: 返回状态数组定义与枚举缺口。
 * enums: Map<枚举名, 值数组>
 * 返回 { arrays, findings }
 */
export function analyzeEnumCoverageDetailed(src, enums, file = '<fixture>') {
  const masked = maskComments(src);
  const arrays = collectArraysFromMasked(masked).filter((a) =>
    isStatusContext(masked, a.line),
  );
  const findings = [];
  for (const arr of arrays) {
    const valueSet = new Set(arr.values);
    const ctx = contextText(masked, arr.line) + '\n' + file;
    for (const [enumName, enumValues] of enums) {
      const domain = ENUM_DOMAIN[enumName];
      if (domain && !domain.test(ctx)) continue;
      const covered = enumValues.filter((v) => valueSet.has(v));
      if (covered.length < 2 || covered.length >= enumValues.length) continue;
      const cnt = new Set(covered);
      findings.push({
        file,
        line: arr.line,
        enum: enumName,
        arrayValues: enumValues.filter((v) => cnt.has(v)),
        missing: enumValues.filter((v) => !cnt.has(v)),
      });
    }
  }
  return { arrays, findings };
}

export function analyzeEnumCoverage(src, enums, file = '<fixture>') {
  return analyzeEnumCoverageDetailed(src, enums, file).findings;
}

function fileMatches(entryFile, findingFile) {
  const e = norm(String(entryFile));
  const f = norm(String(findingFile));
  return f === e || f.endsWith('/' + e) || f.endsWith(e);
}

export function isAllowlisted(finding, allowlist) {
  if (!Array.isArray(allowlist)) return null;
  for (const entry of allowlist) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) continue;
    if (entry.enum && entry.enum !== finding.enum) continue;
    if (entry.file && !fileMatches(entry.file, finding.file)) continue;
    if (Array.isArray(entry.values)) {
      if (!finding.arrayValues.every((v) => entry.values.includes(v))) continue;
    }
    return entry;
  }
  return null;
}

export function filterAllowlisted(findings, allowlist) {
  const kept = [];
  const allowed = [];
  for (const f of findings) {
    const entry = isAllowlisted(f, allowlist);
    if (entry) allowed.push({ finding: f, entry });
    else kept.push(f);
  }
  return { kept, allowed };
}

function loadAllowlist() {
  try {
    const raw = readFileSync(ALLOWLIST_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function run() {
  const schemaPath = join(ROOT, 'backend', 'prisma', 'schema.prisma');
  let schema;
  try {
    schema = readFileSync(schemaPath, 'utf8');
  } catch (e) {
    console.error(`[enum-coverage-guard] 无法读取 ${schemaPath}: ${e?.message}`);
    process.exitCode = 1;
    return;
  }
  const allEnums = parsePrismaEnums(schema);
  const enums = new Map();
  for (const name of REQUESTED_ENUMS) {
    if (allEnums.has(name)) enums.set(name, allEnums.get(name));
  }
  const missingEnums = REQUESTED_ENUMS.filter((n) => !allEnums.has(n));

  const mockDir = norm(join(ROOT, 'src', 'services', 'mockBackend'));
  const files = walk(join(ROOT, 'src')).filter((f) => {
    const n = norm(f);
    if (!/\.(ts|tsx)$/.test(n)) return false;
    if (/\.(test|spec)\./.test(n)) return false;
    if (n.startsWith(mockDir)) return false;
    return true;
  });

  const allowlist = loadAllowlist();
  const findings = [];
  let arrayCount = 0;
  for (const f of files) {
    const rel = norm(f).replace(norm(`${ROOT}/`), '');
    let raw;
    try {
      raw = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    const result = analyzeEnumCoverageDetailed(raw, enums, rel);
    arrayCount += result.arrays.length;
    findings.push(...result.findings);
  }
  findings.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

  const { kept, allowed } = filterAllowlisted(findings, allowlist);
  const ok = kept.length <= BUDGET;

  console.log('[enum-coverage-guard] 前端状态枚举覆盖检查');
  console.log(
    `  已解析枚举: ${[...enums.entries()].map(([n, v]) => `${n}(${v.length})`).join(', ')}  文件: ${files.length}`,
  );
  if (missingEnums.length) {
    console.log(`  INFO  schema.prisma 未定义请求枚举: ${missingEnums.join(', ')} (以实际文件为准)`);
  }
  console.log(`  状态数组候选: ${arrayCount}`);

  for (const { finding, entry } of allowed) {
    console.log(
      `  ALLOW  ${finding.file}:${finding.line}  枚举 ${finding.enum} 缺少 ${finding.missing.join('、')}  — ${entry.reason.trim()}`,
    );
  }

  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  enumCoverageGaps: ${kept.length} / 上限 ${BUDGET}  — 前端状态列表只覆盖枚举子集`,
  );
  if (!ok) {
    for (const f of kept) {
      console.log(`        ${f.file}:${f.line}  枚举 ${f.enum} 缺少值 ${f.missing.join('、')}`);
    }
    console.error('\n[enum-coverage-guard] 存在超预算项, 请补全状态或在 allowlist 写明理由后再提交。');
    process.exitCode = 1;
    return;
  }
  console.log('\n[enum-coverage-guard] 通过。');
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) run();
