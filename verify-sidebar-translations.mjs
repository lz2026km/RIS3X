import { readFileSync } from "node:fs";

const config = readFileSync("src/routes/sidebarConfig.tsx", "utf8");
const i18n = readFileSync("src/i18n/appI18n.ts", "utf8");

const keys = new Set();
for (const m of config.matchAll(/(?:labelKey|section)\s*:\s*"([^"]+)"/g)) {
  keys.add(m[1]);
}

const missing = [...keys].filter(k => !i18n.includes(`"${k}"`) && !i18n.includes(`'${k}'`));
const withNavPrefix = [...keys].filter(k => k.startsWith("nav."));
const nonNav = [...keys].filter(k => !k.startsWith("nav."));

console.log("Total keys referenced:", keys.size);
console.log("Keys with nav. prefix:", withNavPrefix.length);
console.log("Keys without nav. prefix:", nonNav.length);
if (nonNav.length) console.log("  non-nav keys:", nonNav.join(", "));
console.log("Missing in appI18n.ts:", missing.length);
if (missing.length) console.log("  MISSING:", missing.join(", "));
console.log("Coverage: " + (((keys.size - missing.length) / keys.size) * 100).toFixed(1) + "%");
process.exit(missing.length ? 1 : 0);
