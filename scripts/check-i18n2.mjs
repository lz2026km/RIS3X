import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const c = fs.readFileSync(path.join(root, 'src', 'routes', 'sidebarConfig.tsx'), 'utf-8');
const labelKeys = [...c.matchAll(/labelKey: "([^"]+)"/g)].map(m => m[1].replace('nav.', ''));
const sections = [...c.matchAll(/section: "([^"]+)"/g)].map(m => m[1].replace('nav.', ''));
const allKeys = [...new Set([...sections, ...labelKeys])];

const zh = JSON.parse(fs.readFileSync(path.join(root, 'src', 'i18n', 'locales', 'zh-CN', 'nav.json'), 'utf-8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src', 'i18n', 'locales', 'en-US', 'nav.json'), 'utf-8'));

console.log('=== 中文缺失 (' + allKeys.filter(k => !zh[k]).length + ' 项) ===');
allKeys.filter(k => !zh[k]).forEach(k => console.log('  ' + k));

console.log('\n=== 英文缺失 (' + allKeys.filter(k => !en[k]).length + ' 项) ===');
allKeys.filter(k => !en[k]).forEach(k => console.log('  ' + k));

const totalSections = sections.length;
const totalItems = labelKeys.length;
const missingZh = allKeys.filter(k => !zh[k]).length;
const missingEn = allKeys.filter(k => !en[k]).length;
console.log(`\n总计: ${totalSections} 分区 + ${totalItems} 菜单 = ${allKeys.length} 键`);
console.log(`中文缺失: ${missingZh}, 英文缺失: ${missingEn}`);
