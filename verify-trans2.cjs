const { chromium } = require('@playwright/test');

const PAGES = [
  ['/cardiac/cardiac-specialty', ['Status', 'Action', 'Name', 'Total', 'Modality']],
  ['/ai/lung-cad', ['Status', 'Action', 'Patient']],
  ['/compliance/audit', ['Action', 'User', 'Time', 'Result']],
  ['/consent/education', ['Status', 'Action', 'Pending']],
  ['/clinical/terminology-server', ['Status', 'Action', 'Code']],
  ['/workflow/orchestrator', ['Steps', 'Action', 'Edit']],
  ['/dental/photo', ['Upload', 'Cancel', 'Total']],
  ['/fhir/bulk-export', ['completed', 'failed', 'pending']],
  ['/tele/tele-sign', ['Chest CT']],
  ['/', ['radiological department', 'Quality Control Center']],
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:5191/login', { waitUntil: 'networkidle', timeout: 30000 });
  await p.selectOption('select', '管理员');
  await p.locator('input').nth(0).fill('admin');
  await p.locator('input').nth(1).fill('admin123');
  await p.click('button[type="submit"]');
  await p.waitForTimeout(6000);

  for (const [pg, enWords] of PAGES) {
    await p.goto('http://localhost:5191' + pg, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => console.log(pg, 'ERR'));
    await p.waitForTimeout(4000);
    const body = await p.evaluate(() => document.body.innerText);
    const hits = enWords.filter(w => new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(body));
    console.log(`${pg}: ${hits.length ? '残留 ' + hits.join(',') : 'OK'}`);
  }
  await b.close();
})();
