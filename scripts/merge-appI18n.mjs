import fs from 'node:fs';

const zhCn = JSON.parse(fs.readFileSync('src/i18n/locales/zh_CN.json', 'utf8'));
const enUs = JSON.parse(fs.readFileSync('src/i18n/locales/en_US.json', 'utf8'));

const path = 'src/i18n/appI18n.ts';
let text = fs.readFileSync(path, 'utf8');

// 找到 zh-CN 字典结束位置
const lines = text.split('\n');
let zhStart = -1, enStart = -1, zhEnd = -1, enEnd = -1;
let braceDepth = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('"zh-CN": {') && zhStart < 0) zhStart = i;
  if (line.includes('"en-US": {') && enStart < 0) enStart = i;
}

console.log('zhStart:', zhStart, 'enStart:', enStart);
if (zhStart < 0 || enStart < 0) { console.log('not found'); process.exit(1); }

// 找 zh-CN 字典结尾：往上扫 zhStart..enStart, 找到 "  }," 配对 (4空格 + 闭合) 
// 简单做法: 把 zhStart 之后的第一个外层 "  }," 找出来
let zhDepth = 0;
for (let i = zhStart; i < enStart; i++) {
  for (const ch of lines[i]) {
    if (ch === '{') zhDepth++;
    else if (ch === '}') {
      zhDepth--;
      if (zhDepth === 0) {
        zhEnd = i;
        break;
      }
    }
  }
  if (zhEnd > 0) break;
}
console.log('zhEnd:', zhEnd);

// en-US 字典结尾: 找到 enStart 之后的第一个 "};"
let enDepth = 0;
for (let i = enStart; i < lines.length; i++) {
  for (const ch of lines[i]) {
    if (ch === '{') enDepth++;
    else if (ch === '}') {
      enDepth--;
      if (enDepth === 0) {
        enEnd = i;
        break;
      }
    }
  }
  if (enEnd > 0) break;
}
console.log('enEnd:', enEnd);

// 要合并的 namespace: worklist, v3stats, v3report, v3worklist, critical
const namespaces = ['worklist', 'critical', 'v3worklist', 'v3report', 'v3stats'];

function dumpNs(ns, obj, indent) {
  // indent 形如 '    ' (4 空格)
  const entries = Object.entries(obj).map(([k, v]) => {
    const safe = String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return indent + '    "' + k + '": "' + safe + '",';
  });
  return entries.join('\n');
}

// 合并到 zh-CN 字典 zhEnd 之前
let added = 0;
for (const ns of namespaces) {
  const data = zhCn[ns] || enUs[ns];
  if (!data) continue;
  // 检查 key 是否已存在
  const existing = text.split('\n').slice(zhStart, zhEnd).join('\n');
  const hasKey = existing.includes('"' + ns + '.');
  if (hasKey) {
    console.log('skip', ns, '(already exists)');
    continue;
  }
  const block = '    // === ' + ns + ' namespace (audit-fix-2026-07-02) ===\n' + dumpNs(ns, data, '    ');
  lines.splice(zhEnd, 0, block);
  zhEnd += block.split('\n').length;
  enStart = lines.findIndex((l, i) => i > zhStart && l.includes('"en-US":'));
  added++;
}

// 同步处理 en-US
for (const ns of namespaces) {
  const data = enUs[ns] || zhCn[ns];
  if (!data) continue;
  const existing = text.split('\n').slice(enStart, enEnd).join('\n');
  const hasKey = existing.includes('"' + ns + '.');
  if (hasKey) {
    console.log('skip en', ns, '(already exists)');
    continue;
  }
  const block = '    // === ' + ns + ' namespace (audit-fix-2026-07-02) ===\n' + dumpNs(ns, data, '    ');
  // en-US 字典结尾位置需要重新算 (因为 zh 段插入了行)
  let enDepth2 = 0;
  let newEnEnd = -1;
  for (let i = enStart; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') enDepth2++;
      else if (ch === '}') {
        enDepth2--;
        if (enDepth2 === 0) {
          newEnEnd = i;
          break;
        }
      }
    }
    if (newEnEnd > 0) break;
  }
  if (newEnEnd < 0) { console.log('en end not found'); continue; }
  lines.splice(newEnEnd, 0, block);
  enEnd = newEnEnd + block.split('\n').length;
  added++;
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('done, added blocks:', added, 'total lines now:', lines.length);
