import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const app = fs.readFileSync(path.join(root, 'src', 'i18n', 'appI18n.ts'), 'utf-8');

const zhStart = app.indexOf('"zh-CN": {');
const enStart = app.indexOf('"en-US": {');

console.log('zh position:', zhStart);
console.log('en position:', enStart);

// Find end of each block (matching closing brace at column 2)
// Each locale dict is "zh-CN": { ... },
// followed by next locale
const zhEnd = app.indexOf('  },', zhStart) + 3;
const enEnd = app.indexOf('  },', enStart) + 3;

const zhBlock = app.substring(zhStart, zhEnd);
const enBlock = app.substring(enStart, enEnd);

console.log('zh block length:', zhBlock.length);
console.log('en block length:', enBlock.length);

// Check for missing nav keys
const navKeys = ['patient360', 'workflowV3', 'eyeSpecialty', 'dentalSpecialty', 'dicomBrowserPro', 'clinicalConfig'];

console.log('\n=== In zh-CN block ===');
for (const k of navKeys) {
  const keyIn = zhBlock.includes('"' + k + '"') || zhBlock.includes('"nav.' + k + '"');
  console.log(`  ${k}: ${keyIn ? 'YES' : 'NO'}`);
}
console.log('\n=== In en-US block ===');
for (const k of navKeys) {
  const keyIn = enBlock.includes('"' + k + '"') || enBlock.includes('"nav.' + k + '"');
  console.log(`  ${k}: ${keyIn ? 'YES' : 'NO'}`);
}