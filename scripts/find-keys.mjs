import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const c = fs.readFileSync(path.join(root, 'src', 'i18n', 'appI18n.ts'), 'utf-8');

// Find lines with nav.xxx in appI18n.ts and check for 'config' related keys
const lines = c.split('\n');
lines.forEach((line, i) => {
  if (line.includes('config') && line.includes('nav')) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
});