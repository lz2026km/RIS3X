import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] || "E:/codex work/ris/G005-RISv-3.0.0";
const pagesDir = path.join(root, "src", "pages");
const reportPath = path.join(root, "scripts", "empty-state-report.json");

const PLACEHOLDER_PATTERNS = [
  /\u6682\u65e0\u6570\u636e/,         // 暂无数据
  /\u6ca1\u6709\u6570\u636e/,         // 没有数据
  /No data/i,
  /\u6682\u65e0\u8bb0\u5f55/,         // 暂无记录
  /\u7a7a\u6570\u636e/,               // 空数据
];

const results = [];

function walk(d) {
  let items;
  try { items = fs.readdirSync(d); } catch (e) { return; }
  for (const f of items) {
    const p = path.join(d, f);
    let s;
    try { s = fs.statSync(p); } catch (e) { continue; }
    if (s.isDirectory()) {
      walk(p);
    } else if (f.endsWith(".tsx") && !f.endsWith(".stories.tsx") && !f.endsWith(".test.tsx")) {
      scan(p);
    }
  }
}

function scan(file) {
  const src = fs.readFileSync(file, "utf8");
  if (src.includes("AppEmpty")) return;
  const lines = src.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    for (const pat of PLACEHOLDER_PATTERNS) {
      if (pat.test(lines[i])) {
        hits.push({ line: i + 1, text: lines[i].trim() });
        break;
      }
    }
  }
  if (hits.length > 0) {
    results.push({
      file: file.replace(root + path.sep, "").replace(/\\/g, "/"),
      hits,
      confidence: hits.length > 1 ? 0.85 : 0.7,
    });
  }
}

walk(pagesDir);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), "utf8");
console.log("Files needing AppEmpty migration:", results.length);
console.log("Report:", reportPath);

const top = results.sort((a, b) => b.confidence - a.confidence).slice(0, 30);
for (const r of top) {
  console.log("  [" + r.confidence + "] " + r.file + " (" + r.hits.length + " hits)");
}