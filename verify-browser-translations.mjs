import { chromium } from "@playwright/test";

const BASE = "http://localhost:5191";
const results = {};

const EN_HEADER_FORBIDDEN = /^(Status|Actions?|Name|Patient Name|Age|Gender|Date|Time|Description|Created|Updated|Created At|Updated At|Type|Value|Count|Priority|Provider|Department|Notes?|Actions|View|Edit|Delete|Download|Upload|Export|Import|Submit|Save|Cancel|ID|Action)$/i;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", e => { results.pageerrors = results.pageerrors || []; results.pageerrors.push(e.message); });

// 1. Login
await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(3000);
await page.selectOption("select", { label: "主任" }).catch(() => page.selectOption("select", "主任"));
await page.locator("input").nth(0).fill("admin");
await page.locator("input").nth(1).fill("123");
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);

const user = await page.evaluate(() => localStorage.getItem("ris_current_user"));
results.loginUser = user;

// 2. Sidebar nav. residue check
const sidebarText = await page.evaluate(() => {
  const els = document.querySelectorAll("aside, .ant-layout-sider, nav, [class*='sider']");
  let best = "";
  for (const el of els) {
    const t = el.innerText || "";
    if (t.length > best.length) best = t;
  }
  return best;
});
const navResidue = (sidebarText.match(/nav\.[a-zA-Z.]+/g) || []).filter(v => !v.startsWith("nav."));
results.sidebarNavResidue = navResidue.length ? [...new Set(navResidue)] : "NONE";
const sidebarSample = sidebarText.split("\n").filter(l => l.trim()).slice(0, 30);
results.sidebarVisibleSample = sidebarSample;

// 3. Page checks
async function checkPage(path, expected, headers) {
  await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(2500);
  const info = { title: (await page.title()) || (await page.locator("h1,h2").first().textContent().catch(() => "")) };
  info.bodyNavResidue = [...new Set(((await page.locator("body").innerText()) || "").match(/nav\.[a-zA-Z.]+/g) || [])];
  info.bodyNavResidue = info.bodyNavResidue.length ? info.bodyNavResidue : "NONE";
  const headerTexts = await page.evaluate(() =>
    [...document.querySelectorAll("th, [role='columnheader'], .ant-table-column-title, label, [class*='ant-form-item-label']")].map(e => (e.innerText || e.textContent || "").trim()).filter(Boolean)
  );
  info.totalHeaders = headerTexts.length;
  const uniqueHeaders = [...new Set(headerTexts)];
  info.enHeaders = uniqueHeaders.filter(h => EN_HEADER_FORBIDDEN.test(h));
  info.headersSample = uniqueHeaders.slice(0, 25);
  await page.screenshot({ path: `screenshots-fix/verify-${path.replace(/[^a-z]/gi, "-")}.png`, fullPage: false });
  return info;
}

results.dimse = await checkPage("/dicom/dimse");
results.fhirPatient = await checkPage("/fhir/patient");
results.pix = await checkPage("/ihe/pix");

await b.close();
console.log(JSON.stringify(results, null, 2));
