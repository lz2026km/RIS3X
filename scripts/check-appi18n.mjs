import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const sc = fs.readFileSync(path.join(root, 'src', 'routes', 'sidebarConfig.tsx'), 'utf-8');
const labelKeys = [...sc.matchAll(/labelKey: "([^"]+)"/g)].map(m => m[1]);
const sections = [...sc.matchAll(/section: "([^"]+)"/g)].map(m => m[1]);
const allKeys = [...new Set([...sections, ...labelKeys])];

const app = fs.readFileSync(path.join(root, 'src', 'i18n', 'appI18n.ts'), 'utf-8');

const zhBlock = app.match(/"zh-CN":\s*\{[\s\S]+?\n  \},/m)?.[0] || '';
const enBlock = app.match(/"en-US":\s*\{[\s\S]+?\n  \},/m)?.[0] || '';

const missingZh = allKeys.filter(k => !zhBlock.includes(`"${k}"`));
const missingEn = allKeys.filter(k => !enBlock.includes(`"${k}"`));

console.log('=== 缺失中文 (' + missingZh.length + ') ===');
missingZh.forEach(k => console.log('  ' + k));
console.log('\n=== 缺失英文 (' + missingEn.length + ') ===');
missingEn.forEach(k => console.log('  ' + k));
console.log('\n总键数:', allKeys.length);