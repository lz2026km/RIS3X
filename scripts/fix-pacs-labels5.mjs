import fs from 'node:fs';
const path = 'src/pages/eye/pacs/PacsStudyListPage.tsx';
let text = fs.readFileSync(path, 'utf8');
const target = '  fundus_photo: "眼底彩照",\r';
const idx = text.indexOf(target);
if (idx < 0) { console.log('not found'); process.exit(1); }
const inserts = '  oct_a: "OCTA",\r  corneal_endothelium: "角膜内皮",\r  tear_film: "泪膜",\r  fundus_autofluorescence: "眼底自发荧光",\r';
text = text.slice(0, idx) + inserts + text.slice(idx);
fs.writeFileSync(path, text, 'utf8');
console.log('inserted at', idx);
