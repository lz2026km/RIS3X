import fs from 'node:fs';
const path = 'src/pages/DefectManagementPage.tsx';
let text = fs.readFileSync(path, 'utf8');
text = text.replace("<span className=\"text-sm\">{cat}</span>", "<span className=\"text-sm\">{CATEGORY_LABELS[cat] ?? cat}</span>");
fs.writeFileSync(path, text, 'utf8');
console.log('done');
