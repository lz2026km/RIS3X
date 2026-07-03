import fs from 'node:fs';

const zhCn = JSON.parse(fs.readFileSync('src/i18n/locales/zh_CN.json', 'utf8'));
const enUs = JSON.parse(fs.readFileSync('src/i18n/locales/en_US.json', 'utf8'));

const path = 'src/i18n/appI18n.ts';
let text = fs.readFileSync(path, 'utf8');

const lines = text.split('\n');
let zhStart = -1, enStart = -1, zhEnd = -1, enEnd = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('"zh-CN": {') && zhStart < 0) zhStart = i;
  if (line.includes('"en-US": {') && enStart < 0) enStart = i;
}
if (zhStart < 0 || enStart < 0) { console.log('not found'); process.exit(1); }

let zhDepth = 0;
for (let i = zhStart; i < enStart; i++) {
  for (const ch of lines[i]) {
    if (ch === '{') zhDepth++;
    else if (ch === '}') { zhDepth--; if (zhDepth === 0) { zhEnd = i; break; } }
  }
  if (zhEnd > 0) break;
}

let enDepth = 0;
for (let i = enStart; i < lines.length; i++) {
  for (const ch of lines[i]) {
    if (ch === '{') enDepth++;
    else if (ch === '}') { enDepth--; if (enDepth === 0) { enEnd = i; break; } }
  }
  if (enEnd > 0) break;
}
console.log('zhStart:', zhStart, 'zhEnd:', zhEnd, 'enStart:', enStart, 'enEnd:', enEnd);

const namespaces = ['worklist', 'critical', 'v3worklist', 'v3report', 'v3stats'];

function dumpNs(ns, obj) {
  return Object.entries(obj).map(([k, v]) => {
    const safe = String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return '    "' + ns + '.' + k + '": "' + safe + '",';
  }).join('\n');
}

let added = 0;
for (const ns of namespaces) {
  const dataZh = zhCn[ns]; const dataEn = enUs[ns];
  if (!dataZh || !dataEn) { console.log('skip', ns, 'missing data'); continue; }
  // zh-CN block
  const blockZh = '\n    // === ' + ns + ' namespace (audit-fix-2026-07-02) ===\n' + dumpNs(ns, dataZh);
  // 重新找 zh-CN 当前 end (因为后面我们再插入会让 enStart 移动)
  lines.splice(zhEnd, 0, blockZh);
  // 重新定位 enStart 和 enEnd
  enStart = -1;
  for (let i = zhStart; i < lines.length; i++) {
    if (lines[i].includes('"en-US": {')) { enStart = i; break; }
  }
  if (enStart < 0) { console.log('lost enStart'); break; }
  // 找新的 zhEnd
  zhEnd = -1;
  let d = 0;
  for (let i = zhStart; i < enStart; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') d++;
      else if (ch === '}') { d--; if (d === 0) { zhEnd = i; break; } }
    }
    if (zhEnd > 0) break;
  }
  // 找 en-US 结束
  enEnd = -1;
  let d2 = 0;
  for (let i = enStart; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') d2++;
      else if (ch === '}') { d2--; if (d2 === 0) { enEnd = i; break; } }
    }
    if (enEnd > 0) break;
  }
  // en-US block
  const blockEn = '\n    // === ' + ns + ' namespace (audit-fix-2026-07-02) ===\n' + dumpNs(ns, dataEn);
  lines.splice(enEnd, 0, blockEn);
  // 重定位 enStart/enEnd/zhEnd
  enStart = -1;
  for (let i = zhStart; i < lines.length; i++) {
    if (lines[i].includes('"en-US": {')) { enStart = i; break; }
  }
  zhEnd = -1;
  d = 0;
  for (let i = zhStart; i < enStart; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') d++;
      else if (ch === '}') { d--; if (d === 0) { zhEnd = i; break; } }
    }
    if (zhEnd > 0) break;
  }
  enEnd = -1;
  d2 = 0;
  for (let i = enStart; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') d2++;
      else if (ch === '}') { d2--; if (d2 === 0) { enEnd = i; break; } }
    }
    if (enEnd > 0) break;
  }
  added++;
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('done, added', added, 'namespace pairs, total lines:', lines.length);
