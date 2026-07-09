import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let c = fs.readFileSync(path.join(root, 'src', 'i18n', 'appI18n.ts'), 'utf-8');

c = c.replace(
  '"nav.dicomBrowser": "DICOM\u6d4f\u89c8\u5668",',
  '"nav.dicomBrowser": "DICOM\u6d4f\u89c8\u5668",\n    "nav.dicomBrowserPro": "DICOM\u6d4f\u89c8\u5668Pro",'
);

c = c.replace(
  '"nav.dicomBrowser": "DICOM Browser",',
  '"nav.dicomBrowser": "DICOM Browser",\n    "nav.dicomBrowserPro": "DICOM Browser Pro",'
);

c = c.replace(
  '"nav.patientPortal": "\u60a3\u8005\u95e8\u6237",',
  '"nav.patientPortal": "\u60a3\u8005\u95e8\u6237",\n    "nav.patient360": "\u60a3\u8005360\u00b0",'
);

c = c.replace(
  '"nav.patientPortal": "Patient Portal",',
  '"nav.patientPortal": "Patient Portal",\n    "nav.patient360": "Patient 360\u00b0",'
);

fs.writeFileSync(path.join(root, 'src', 'i18n', 'appI18n.ts'), c, 'utf-8');
console.log('Added 4 missing keys to appI18n.ts (zh+en each for patient360 + dicomBrowserPro)');
