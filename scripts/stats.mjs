import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const exclude = [
  'node_modules', '.git', 'dist', 'coverage', 
  'playwright-report', 'test-results', 'screenshots-p0',
  'pnpm-lock.yaml', 'backend/node_modules', 'backend/pnpm-lock.yaml'
];
const binaryExts = new Set(['.png', '.svg', '.gz', '.wasm', '.ico', '.woff', '.jpg', '.jpeg', '.gif', '.webp']);

let totalFiles = 0, totalLines = 0;
const byExt = {}, byDir = {};

function walk(d) {
  let items;
  try { items = fs.readdirSync(d); } catch { return; }
  for (const f of items) {
    const fp = path.join(d, f);
    if (exclude.some(e => fp.includes(e.replace(/\//g, path.sep)))) continue;
    try {
      const s = fs.statSync(fp);
      if (s.isDirectory()) { walk(fp); continue; }
      if (!s.isFile() || f.startsWith('.')) continue;
      const ext = path.extname(f);
      if (binaryExts.has(ext)) continue;
      
      totalFiles++;
      if (!byExt[ext]) byExt[ext] = { files: 0, lines: 0 };
      byExt[ext].files++;
      
      const c = fs.readFileSync(fp, 'utf-8');
      const lines = c.split('\n').length;
      byExt[ext].lines += lines;
      totalLines += lines;

      let rel = fp.replace(root, '');
      if (rel.startsWith(path.sep)) rel = rel.slice(1);
      const dirParts = rel.split(path.sep);
      const topDir = dirParts[0];
      if (!byDir[topDir]) byDir[topDir] = { files: 0, lines: 0 };
      byDir[topDir].files++;
      byDir[topDir].lines += lines;
    } catch {}
  }
}

walk(root);

console.log('========================================');
console.log('  G005-RISv-3.0.0 项目源码统计');
console.log('========================================\n');

console.log(`总源码文件: ${totalFiles}`);
console.log(`总源码行数: ${totalLines.toLocaleString()}\n`);

console.log('--- 按扩展名 ---');
const sorted = Object.entries(byExt).sort((a, b) => b[1].lines - a[1].lines);
let sumF = 0, sumL = 0;
for (const [ext, data] of sorted) {
  console.log(
    ext.padEnd(8),
    String(data.files).padStart(6), '文件',
    String(data.lines.toLocaleString()).padStart(10), '行',
    String(Math.round(data.lines / totalLines * 100)).padStart(3) + '%'
  );
  sumF += data.files; sumL += data.lines;
}
console.log('-'.repeat(45));
console.log('合计'.padEnd(8), String(sumF).padStart(6), '文件', String(sumL.toLocaleString()).padStart(10), '行');

console.log('\n--- 按顶层目录 ---');
const dirSorted = Object.entries(byDir).sort((a, b) => b[1].lines - a[1].lines);
for (const [dir, data] of dirSorted) {
  console.log(
    dir.padEnd(20),
    String(data.files).padStart(5), '文件',
    String(data.lines.toLocaleString()).padStart(10), '行'
  );
}

console.log('\n--- 前端 (src/) 细分 ---');
const frontendExts = { '.tsx': 0, '.ts': 0, '.css': 0, '.html': 0, '.json': 0 };
for (const [ext, data] of sorted) {
  if (ext in frontendExts) frontendExts[ext] = data.lines;
}
console.log(`  TSX: ${frontendExts['.tsx'].toLocaleString()} 行`);
console.log(`  TS:  ${frontendExts['.ts'].toLocaleString()} 行`);
console.log(`  CSS: ${frontendExts['.css'].toLocaleString()} 行`);
console.log(`  HTML: ${frontendExts['.html'].toLocaleString()} 行`);

console.log('\n--- 后端 (backend/) 细分 ---');
const beExts = {};
for (const [ext, data] of byExt) {
  beExts[ext] = data.lines;
}
// Sum all backend lines
let beLines = 0, beFiles = 0;
const beDir = byDir['backend'] || { files: 0, lines: 0 };
// backend dir might have subdirs counted separately, but our topDir split handles it
console.log(`  backend/ 总计: ${beDir.files} 文件, ${beDir.lines.toLocaleString()} 行`);
