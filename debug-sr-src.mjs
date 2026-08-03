import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const resp = await page.goto('http://127.0.0.1:5191/src/pages/dicom/SrReportPage.tsx', { waitUntil: 'load' });
const text = await resp.text();
const lines = text.split('\n');
for (let i = 900; i <= 1000; i++) {
  if (lines[i-1] !== undefined && lines[i-1].includes('useWatch')) console.log(i, lines[i-1]);
}
console.log('--- around 924 ---');
console.log(lines.slice(915, 935).join('\n'));
await browser.close();
