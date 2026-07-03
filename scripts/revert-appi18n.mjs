import fs from 'node:fs';

const path = 'src/i18n/appI18n.ts';
let text = fs.readFileSync(path, 'utf8');

// 移除上次插入的 10 个块
const lines = text.split('\n');
const keep = [];
let skip = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('namespace (audit-fix-2026-07-02) ===')) {
    // 跳过这一行 + 后续直到 // === 下一块 或 en-US "};" 或 zh-CN "  }," (字典结束)
    // 简单策略: 跳过连续 indent=8 的行 直到 indent=4 的行
    skip = 1;
    continue;
  }
  if (skip > 0) {
    // 探测: 如果这行不是 8 空格开头的 (i.e., 字典结束或下一段)
    if (!lines[i].startsWith('        ')) {
      skip = 0;
      keep.push(lines[i]);
    }
    continue;
  }
  keep.push(lines[i]);
}
fs.writeFileSync(path, keep.join('\n'), 'utf8');
console.log('reverted to', keep.length, 'lines');
