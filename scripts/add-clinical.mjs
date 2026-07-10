import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let c = fs.readFileSync(path.join(root, 'src', 'i18n', 'appI18n.ts'), 'utf-8');

// Find nav.userManagement lines and insert after
const zhUserLine = c.indexOf('"nav.userManagement": "\u7528\u6237\u7ba1\u7406",');
if (zhUserLine > 0) {
  // Insert after the line
  const insertPos = c.indexOf('\n', zhUserLine) + 1;
  c = c.substring(0, insertPos) +
    '    "nav.clinicalConfig": "\u4e34\u5e8a\u914d\u7f6e",\n' +
    c.substring(insertPos);
}

const enUserLine = c.indexOf('"nav.userManagement": "User Management",');
if (enUserLine > 0) {
  const insertPos = c.indexOf('\n', enUserLine) + 1;
  c = c.substring(0, insertPos) +
    '    "nav.clinicalConfig": "Clinical Config",\n' +
    c.substring(insertPos);
}

fs.writeFileSync(path.join(root, 'src', 'i18n', 'appI18n.ts'), c, 'utf-8');
console.log('clinicalConfig added after userManagement');