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
let clickableNoRole = 0;
let nativeTable = 0;
let offScaleFont = 0;
const FONT_SCALE = new Set(["10", "11", "12", "14", "16", "18", "20", "24", "30", "36", "48"]);

for (const f of pages) {
  const c = readFileSync(f, "utf8");
  antdTable += (c.match(/<Table\b/g) || []).length;
  nativeTable += (c.match(/<table\b/g) || []).length;
  outlineNone += (c.match(/outline:\s*['"]none['"]/g) || []).length;
  viewportHeight += (c.match(/minHeight:\s*['"]100vh['"]/g) || []).length;
  hexTotal += (c.match(/#[0-9a-fA-F]{6}\b/g) || []).length;
  // 行级判定: 含 <div/<span + onClick 且同一行无 role, 排除 stopPropagation 包装
  for (const line of c.split("\n")) {
    if (!/onClick=/.test(line)) continue;
    if (!/<(div|span)\b/.test(line)) continue;
    if (/role=/.test(line)) continue;
    if (/stopPropagation/.test(line)) continue;
    clickableNoRole++;
  }
  const fRe = /fontSize:\s*(\d+(?:\.\d+)?)/g;
  let fm;
  while ((fm = fRe.exec(c))) {
    if (!FONT_SCALE.has(fm[1])) offScaleFont++;
  }
}
for (const f of allSrc) {
  mojibake += (readFileSync(f, "utf8").match(/\uFFFD/g) || []).length;
}

const BUDGET = {
  antdTable: 0,
  outlineNone: 0,
  viewportHeight: 0,
  hexTotal: 13390, // 只减不增
  mojibake: 0,
  clickableNoRole: 151, // 只减不增 (行级统计; 剩余多为遮罩/包装)
  nativeTable: 26, // 只减不增 (剩余为打印/热力图/日历模板)
  offScaleFont: 42, // 只减不增 (仅允许设计刻度 10/11/12/14/16/18/20/24/30/36/48)
};

const checks = [
  ["antdTable", antdTable, "裸 antd <Table> (请改用 components/common 的 <DataTable>)"],
  ["nativeTable", nativeTable, "原生 HTML <table> (数据表请用 <DataTable>; 打印/热力图除外)"],
  ["outlineNone", outlineNone, "outline:'none' 焦点抑制 (改用 :focus-visible / --shadow-focus)"],
  ["viewportHeight", viewportHeight, "minHeight:'100vh' (内容区已滚动, 会造成幽灵滚动条)"],
  ["hexTotal", hexTotal, "硬编码 #rrggbb (优先使用 design-system.css 令牌)"],
  ["offScaleFont", offScaleFont, "脱离设计尺度的 fontSize (仅 10/11/12/14/16/18/20/24/30/36/48)"],
  ["mojibake", mojibake, "U+FFFD 乱码"],
  ["clickableNoRole", clickableNoRole, "可点击 div/span 缺 role (交互元素需键盘可达)"],
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
