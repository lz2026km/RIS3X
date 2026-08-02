const fs = require('fs');
const path = require('path');

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      walk(p, acc);
    } else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

// 用户可见英文模式（排除代码标识符）
const patterns = [
  />(Loading|Error|Failed|Success|Saved|Submit|Cancel|Save|Delete|Edit|Add|Search|Reset|Filter|Apply|Confirm|Close|OK|Yes|No|Refresh|Retry|Back|Next|Home|Dashboard|Settings|Admin|Login|Logout|View|Detail|Download|Upload|Export|Import|Print|More|All|None|Empty|No data|Total|Pending|Completed|Failed|Share|Copy Link|Select Image|Zoom In|Zoom Out|Upload Photo|Generate Share Link|Photo Gallery|Before Treatment|Image File)<\//g,
  /title="(Upload|Cancel|Total|Pending|Completed|New Consent|Audit Detail|Audit Trail|Photo Gallery|Before Treatment|Upload Photo|Concept Search|Education Materials|Edit|View|Download|Export|Filter|Share|Settings|Back|Reset|Confirm|Dismiss|Sign Now|PDF|About|None)"\s*[\/>]/g,
  /placeholder="(Patient ID|Patient Name|Study Instance UID|All|None|Search[^"]*|YYYY-MM-DD|Accession[^"]*)"\s*[\/>]/g,
  /okText="(Upload|Cancel|OK|Save|Delete|Confirm)"|cancelText="(Upload|Cancel|OK|Save|Delete|Confirm)"/g,
];

const files = walk('src');
const results = new Map();
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  for (const re of patterns) {
    const m = c.match(re);
    if (m) {
      if (!results.has(f)) results.set(f, []);
      results.get(f).push(...m);
    }
  }
}
console.log('含英文 UI 残留的文件:', results.size);
let total = 0;
for (const [f, ms] of results) {
  console.log('\n' + f);
  [...new Set(ms)].forEach(x => { total++; console.log('  ' + x.slice(0, 90)); });
}
console.log('\n总匹配:', total);
