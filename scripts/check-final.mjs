import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const sc = fs.readFileSync(path.join(root, 'src', 'routes', 'sidebarConfig.tsx'), 'utf-8');
const labelKeys = [...sc.matchAll(/labelKey: "([^"]+)"/g)].map(m => m[1].replace('nav.', ''));

const zh = JSON.parse(fs.readFileSync(path.join(root, 'src', 'i18n', 'locales', 'zh-CN', 'nav.json'), 'utf-8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src', 'i18n', 'locales', 'en-US', 'nav.json'), 'utf-8'));
const app = fs.readFileSync(path.join(root, 'src', 'i18n', 'appI18n.ts'), 'utf-8');

console.log('=== sidebar labelKeys missing in zh nav.json ===');
labelKeys.filter(k => !zh[k]).forEach(k => console.log('  ' + k));
console.log('=== sidebar labelKeys missing in en nav.json ===');
labelKeys.filter(k => !en[k]).forEach(k => console.log('  ' + k));

// Check both zh and en sections of appI18n.ts
const zhBlock = app.match(/"zh-CN":\s*\{[\s\S]+?^\s{4}\}/m);
const enBlock = app.match(/"en-US":\s*\{[\s\S]+?^\s{4}\}/m);

console.log('\n=== sidebar labelKeys missing in appI18n.ts zh-CN ===');
if (zhBlock) {
  labelKeys.filter(k => !zhBlock[0].includes(`"nav.${k}"`)).forEach(k => console.log('  ' + k));
}
console.log('=== sidebar labelKeys missing in appI18n.ts en-US ===');
if (enBlock) {
  labelKeys.filter(k => !enBlock[0].includes(`"nav.${k}"`)).forEach(k => console.log('  ' + k));
}