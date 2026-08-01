import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'src';

function walkDir(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) files.push(...walkDir(full));
    else if (/\.(tsx?|json)$/.test(extname(full))) files.push(full);
  }
  return files;
}

const brokenPatterns = [
  // ? at end of Chinese string (truncated)
  [/[^\x00-\x7f]\?\)/g, ')'],
  [/[^\x00-\x7f]\?;/g, ';'],
  // ? in Chinese strings
  [/\u00bf/g, ''],
];

let totalFixed = 0;
for (const file of walkDir(ROOT)) {
  let content = readFileSync(file, 'utf-8');
  const original = content;
  
  // Remove remaining ? (U+FFFD replacement chars) that are inside strings
  content = content.replace(/\uFFFD/g, '');
  
  // Fix specific broken Chinese patterns where ? replaced the last byte of a char
  // Pattern: Chinese char followed by ? followed by closing quote/paren
  content = content.replace(/([\u4e00-\u9fff])\?(['"`)])/g, '$1$2');
  
  if (content !== original) {
    writeFileSync(file, content, 'utf-8');
    console.log(`Fixed: ${file}`);
    totalFixed++;
  }
}
console.log(`\nTotal files fixed: ${totalFixed}`);
