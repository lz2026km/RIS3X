import fs from 'node:fs';
const path = 'src/pages/eye/pacs/PacsStudyListPage.tsx';
let text = fs.readFileSync(path, 'utf8');
const lines = text.split('\n');
let target = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i] === '  fundus_photo: "眼底彩照",') { target = i; break; }
}
if (target < 0) { console.log('not found'); process.exit(1); }
const inserts = [
  '  oct_a: "OCTA",',
  '  corneal_endothelium: "角膜内皮",',
  '  tear_film: "泪膜",',
  '  fundus_autofluorescence: "眼底自发荧光",',
];
for (let j = 0; j < inserts.length; j++) {
  lines.splice(target + j, 0, inserts[j]);
}
fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('inserted at', target);
