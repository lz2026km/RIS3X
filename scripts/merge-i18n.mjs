#!/usr/bin/env node
/**
 * 合并 per-namespace JSON 到 nested JSON
 * 输入: src/i18n/locales/<lng>/<ns>.json
 * 输出: src/i18n/locales/<flat>.json  (嵌套结构: { ns: { ...inner } })
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', 'src', 'i18n', 'locales');

const pairs = [
  { dir: 'zh-CN', out: 'zh_CN.json' },
  { dir: 'en-US', out: 'en_US.json' },
];

for (const { dir, out } of pairs) {
  const dirPath = join(root, dir);
  const files = readdirSync(dirPath).filter((f) => f.endsWith('.json')).sort();
  const merged = {};
  for (const f of files) {
    const ns = f.replace(/\.json$/, '');
    const raw = readFileSync(join(dirPath, f), 'utf8').replace(/^\uFEFF/, '');
    const obj = JSON.parse(raw);
    merged[ns] = obj;
  }
  const outPath = join(root, out);
  writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  const size = statSync(outPath).size;
  const nsCount = Object.keys(merged).length;
  let keyCount = 0;
  for (const v of Object.values(merged)) {
    if (v && typeof v === 'object') keyCount += Object.keys(v).length;
  }
  console.log(`[ok] ${out}: ${nsCount} namespaces, ${keyCount} keys, ${size} bytes`);
}
