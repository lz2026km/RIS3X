import { chromium } from '@playwright/test';
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5191';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(() => {});
  const list = await page.evaluate(async () => {
    const r = await fetch('/api/v1/tech-schedules?month=2026-08');
    return await r.text();
  });
  const cal = await page.evaluate(async () => {
    const r = await fetch('/api/v1/tech-schedules/calendar?month=2026-08');
    return await r.text();
  });
  console.log('LIST:', list.slice(0, 500));
  console.log('CAL:', cal.slice(0, 400));
  await browser.close();
})();
