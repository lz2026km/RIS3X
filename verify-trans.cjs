const { chromium } = require('@playwright/test');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:5191/login', { waitUntil: 'networkidle', timeout: 30000 });
  await p.selectOption('select', '管理员');
  await p.locator('input').nth(0).fill('admin');
  await p.locator('input').nth(1).fill('admin123');
  await p.click('button[type="submit"]');
  await p.waitForTimeout(6000);

  // 检查侧边栏是否有 nav. 前缀残留
  const navText = await p.evaluate(() => {
    const nav = document.querySelector('nav[aria-label]');
    return nav ? nav.innerText : '';
  });
  const navPrefix = (navText.match(/nav\.\w+/g) || []);
  console.log('=== 侧边栏 nav. 前缀残留:', navPrefix.length, navPrefix.slice(0, 10));
  console.log('=== 侧边栏样本(前300字):');
  console.log(navText.slice(0, 300).replace(/\n/g, ' | '));

  // 检查几个重灾页面
  for (const pg of ['/dicom/dimse', '/fhir/patient', '/ihe/pix']) {
    await p.goto('http://localhost:5191' + pg, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => console.log(pg, 'GOTO ERR:', e.message.slice(0, 80)));
    await p.waitForTimeout(4000);
    const body = await p.evaluate(() => document.body.innerText);
    const enCols = ['Status', 'Action', 'Patient Name', 'Storage Path', 'Assigning Authority'];
    const hits = enCols.filter(c => new RegExp('\\b' + c + '\\b').test(body));
    console.log(`=== ${pg}: 英文列残留:`, hits.length ? hits.join(',') : '无');
  }
  await b.close();
})();
