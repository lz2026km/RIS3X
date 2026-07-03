import fs from 'node:fs';
const text = fs.readFileSync('src/i18n/appI18n.ts', 'utf8');
const namespaces = ['worklist', 'critical', 'v3worklist', 'v3report', 'v3stats'];
for (const ns of namespaces) {
  const re = new RegExp('"' + ns + '\\.', 'g');
  const matches = text.match(re) || [];
  console.log(ns, 'occurrences:', matches.length);
}
