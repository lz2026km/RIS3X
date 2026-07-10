import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// 1. Update zh-CN nav.json - add app.searchPlaceholder
const zhFile = path.join(root, 'src', 'i18n', 'locales', 'zh-CN', 'nav.json');
const enFile = path.join(root, 'src', 'i18n', 'locales', 'en-US', 'nav.json');
let zh = JSON.parse(fs.readFileSync(zhFile, 'utf-8'));
let en = JSON.parse(fs.readFileSync(enFile, 'utf-8'));

zh.searchPlaceholder = '搜索患者/检查号/报告...';
en.searchPlaceholder = 'Search patient/exam/report...';

fs.writeFileSync(zhFile, JSON.stringify(zh, null, 2) + '\n');
fs.writeFileSync(enFile, JSON.stringify(en, null, 2) + '\n');
console.log('nav.json: added searchPlaceholder');

// 2. Update appI18n.ts - add app.searchPlaceholder key
let c = fs.readFileSync(path.join(root, 'src', 'i18n', 'appI18n.ts'), 'utf-8');

// Add to zh-CN section
c = c.replace(
  '"app.expand": "\u5c55\u5f00",',
  '"app.expand": "\u5c55\u5f00",\n    "app.searchPlaceholder": "\u641c\u7d22\u60a3\u8005/\u68c0\u67e5\u53f7/\u62a5\u544a...",'
);

// Add to en-US section
c = c.replace(
  '"app.expand": "Expand",',
  '"app.expand": "Expand",\n    "app.searchPlaceholder": "Search patient/exam/report...",'
);

fs.writeFileSync(path.join(root, 'src', 'i18n', 'appI18n.ts'), c, 'utf-8');
console.log('appI18n.ts: added app.searchPlaceholder');