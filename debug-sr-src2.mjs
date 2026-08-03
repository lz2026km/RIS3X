import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const resp = await page.goto('http://127.0.0.1:5191/src/pages/dicom/SrReportPage.tsx', { waitUntil: 'load' });
const text = await resp.text();
const lines = text.split('\n');
console.log(lines.slice(935, 1000).join('\n'));
await browser.close();
