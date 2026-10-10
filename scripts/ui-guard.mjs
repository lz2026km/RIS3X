/**
 * G005 放射RIS系统 [UI-G v3.0.6.13-0] - 前端 UI 防回退守则
 *
 * 在 CI / pre-commit 运行: `pnpm guard:ui`
 * 预算 (budget) 只允许下降, 不允许上升。新增违规即失败。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
}

const pages = [];
walk("src/pages", pages);
const allSrc = [];
walk("src", allSrc);

let antdTable = 0;
let outlineNone = 0;
let viewportHeight = 0;
let hexTotal = 0;
let mojibake = 0;
let href = 0;

for (const f of pages) {
  const c = readFileSync(f, "utf8");
  antdTable += (c.match(/<Table\b/g) || []).length;
  outlineNone += (c.match(/outline:\s*['"]none['"]/g) || []).length;
  viewportHeight += (c.match(/minHeight:\s*['"]100vh['"]/g) || []).length;
  hexTotal += (c.match(/#[0-9a-fA-F]{6}\b/g) || []).length;
}
for (const f of allSrc) {
  mojibake += (readFileSync(f, "utf8").match(/\uFFFD/g) || []).length;
  href += 0;
}

const BUDGET = {
  antdTable: 0,
  outlineNone: 0,
  viewportHeight: 0,
  hexTotal: 13775, // 只减不增
  mojibake: 0,
};

const checks = [
  ["antdTable", antdTable, "裸 antd <Table> (请改用 components/common 的 <DataTable>)"],
  ["outlineNone", outlineNone, "outline:'none' 焦点抑制 (改用 :focus-visible / --shadow-focus)"],
  ["viewportHeight", viewportHeight, "minHeight:'100vh' (内容区已滚动, 会造成幽灵滚动条)"],
  ["hexTotal", hexTotal, "硬编码 #rrggbb (优先使用 design-system.css 令牌)"],
  ["mojibake", mojibake, "U+FFFD 乱码"],
];

let failed = false;
console.log("[ui-guard] G005 前端 UI 预算检查");
for (const [key, value, desc] of checks) {
  const limit = BUDGET[key];
  const ok = value <= limit;
  if (!ok) failed = true;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${key}: ${value} / 上限 ${limit}  — ${desc}`);
}
if (failed) {
  console.error("\n[ui-guard] 存在超预算项, 请修复后再提交。");
  process.exit(1);
}
console.log("[ui-guard] 通过。");
