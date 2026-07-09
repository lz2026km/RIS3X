import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// 1. Read all section and labelKey from sidebarConfig
const sc = fs.readFileSync(path.join(root, 'src', 'routes', 'sidebarConfig.tsx'), 'utf-8');
const sections = [...sc.matchAll(/section: "([^"]+)"/g)].map(m => m[1]);
const labelKeys = [...sc.matchAll(/labelKey: "([^"]+)"/g)].map(m => m[1]);

console.log('=== 所有 section key ===');
sections.forEach(s => console.log(s));
console.log('\n=== 所有 labelKey ===');
labelKeys.forEach(s => console.log(s));

// 2. Read zh-CN nav.json and en-US nav.json
const zhFile = path.join(root, 'src', 'i18n', 'locales', 'zh-CN', 'nav.json');
const enFile = path.join(root, 'src', 'i18n', 'locales', 'en-US', 'nav.json');

const zh = fs.existsSync(zhFile) ? JSON.parse(fs.readFileSync(zhFile, 'utf-8')) : {};
const en = fs.existsSync(enFile) ? JSON.parse(fs.readFileSync(enFile, 'utf-8')) : {};

console.log('\n=== 中文 nav.json keys ===');
Object.keys(zh).forEach(k => console.log(`${k}: ${zh[k]}`));

console.log('\n=== 英文 nav.json keys ===');
Object.keys(en).forEach(k => console.log(`${k}: ${en[k]}`));

// 3. Check which sidebar keys are missing in zh/en
const allKeys = [...sections, ...labelKeys];
console.log('\n=== 缺失中文翻译 ===');
for (const key of allKeys) {
  if (!zh[key]) console.log(`  MISSING zh: ${key}`);
}
console.log('=== 缺失英文翻译 ===');
for (const key of allKeys) {
  if (!en[key]) console.log(`  MISSING en: ${key}`);
}

// 4. Check other locale files
const localeDir = path.join(root, 'src', 'i18n', 'locales');
const dirs = fs.readdirSync(localeDir).filter(d => d !== 'en-US' && d !== 'zh-CN');
for (const d of dirs) {
  const nf = path.join(localeDir, d, 'nav.json');
  if (fs.existsSync(nf)) {
    const t = JSON.parse(fs.readFileSync(nf, 'utf-8'));
    const missing = allKeys.filter(k => !t[k]);
    if (missing.length > 0) {
      console.log(`\n=== 缺失 ${d} 翻译 (${missing.length} 项) ===`);
      missing.slice(0, 10).forEach(k => console.log(`  ${k}`));
      if (missing.length > 10) console.log(`  ... 还有 ${missing.length - 10} 项`);
    }
  }
}
