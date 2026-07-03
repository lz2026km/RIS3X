import fs from 'node:fs';
const path = 'src/pages/eye/tele/TeleConsultPage.tsx';
let text = fs.readFileSync(path, 'utf8');
const before = String.raw`节点: ${turnInfo['5G'].edgeNodeId} | 切片: ${turnInfo['5G'].slice}`;
const after = String.raw`节点: ${turnInfo?.['5G']?.edgeNodeId ?? 'N/A'} | 切片: ${turnInfo?.['5G']?.slice ?? 'N/A'}`;
if (text.includes(before)) {
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log('fixed');
} else { console.log('not found'); }
