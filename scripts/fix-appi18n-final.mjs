import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let c = fs.readFileSync(path.join(root, 'src', 'i18n', 'appI18n.ts'), 'utf-8');

// Add nav.dicomBrowserPro to zh-CN (after nav.dicomBrowser)
c = c.replace(
  '"nav.dicomBrowser": "DICOM\u6d4f\u89c8",',
  '"nav.dicomBrowser": "DICOM\u6d4f\u89c8",\n    "nav.dicomBrowserPro": "DICOM Pro",'
);

// Add nav.clinicalConfig to zh-CN (after nav.clinicalConfigCenter or similar)
c = c.replace(
  '"nav.clinicalConfigCenter": "\u4e34\u5e8a\u914d\u7f6e\u4e2d\u5fc3",',
  '"nav.clinicalConfigCenter": "\u4e34\u5e8a\u914d\u7f6e\u4e2d\u5fc3",\n    "nav.clinicalConfig": "\u4e34\u5e8a\u914d\u7f6e",'
);

// Add nav.clinicalConfig to en-US
c = c.replace(
  '"nav.clinicalConfigCenter": "Clinical Config Center",',
  '"nav.clinicalConfigCenter": "Clinical Config Center",\n    "nav.clinicalConfig": "Clinical Config",'
);

fs.writeFileSync(path.join(root, 'src', 'i18n', 'appI18n.ts'), c, 'utf-8');
console.log('Added 2 missing keys (dicomBrowserPro zh, clinicalConfig zh+en) to appI18n.ts');