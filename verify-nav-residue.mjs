import { chromium } from "@playwright/test";

const BASE = "http://localhost:5191";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(3000);
await page.selectOption("select", { label: "主任" }).catch(() => page.selectOption("select", "主任"));
await page.locator("input").nth(0).fill("admin");
await page.locator("input").nth(1).fill("123");
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);

const out = {};

// find where nav.fhir / nav.ihe texts live in DOM
for (const route of ["/fhir/patient", "/ihe/pix"]) {
  await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(2500);
  const locs = await page.evaluate(() => {
    const hits = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = n.textContent || "";
      if (/nav\.[a-zA-Z]+/.test(t)) {
        const el = n.parentElement;
        hits.push({
          text: t.trim().slice(0, 60),
          tag: el ? el.tagName : "?",
          cls: el ? (el.className || "").toString().slice(0, 80) : "?",
          visible: el ? !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) : false,
        });
      }
    }
    return hits;
  });
  out[route] = locs;
}

// dimse page: collect console/pageerror + body snapshot
await page.goto(`${BASE}/dicom/dimse`, { waitUntil: "load", timeout: 30000 }).catch(e => out.dimseGotoError = e.message);
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error") errors.push(`[console] ${m.text().slice(0, 200)}`); });
await page.waitForTimeout(4000);
out.dimseErrors = errors;
out.dimseBody = ((await page.locator("body").innerText().catch(() => "")) || "").slice(0, 800);

await b.close();
console.log(JSON.stringify(out, null, 2));
