import fs from 'node:fs';
const path = 'src/pages/eye/ris/EyeRisPage.tsx';
let text = fs.readFileSync(path, 'utf8');
text = text.replace(/\n  published: "已发布",/, '');
fs.writeFileSync(path, text, 'utf8');
console.log('done');
