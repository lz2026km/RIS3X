import fs from 'node:fs';
const path = 'src/pages/worklist/WorklistListView.tsx';
let text = fs.readFileSync(path, 'utf8');
// 在 STATUS_CONFIG 中加 published -> 已发布
const before = "  submitted: { bg: '#d1fae5', color: '#059669', label: '已提交', order: 4.5 },";
const after = "  published: { bg: '#ecfdf5', color: '#047857', label: '已发布', order: 5 },\n  submitted: { bg: '#d1fae5', color: '#059669', label: '已提交', order: 4.5 },";
if (text.includes(before) && !text.includes("published: { bg")) {
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log('added published status mapping');
} else if (text.includes("published: { bg")) {
  console.log('already has published mapping');
} else {
  console.log('anchor not found');
}
