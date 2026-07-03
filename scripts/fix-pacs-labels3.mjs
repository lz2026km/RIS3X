import fs from 'node:fs';
const path = 'src/pages/eye/pacs/PacsStudyListPage.tsx';
let text = fs.readFileSync(path, 'utf8');
const lines = text.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i] === '  fundus_photo: "眼底彩照",') {
    lines.splice(i, 0,
      '  oct_a: "OCTA",',
      '  corneal_endothelium: "角膜内皮",',
      '  tear_film: "泪膜",',
      '  fundus_autofluorescence: "眼底自发荧光",'
    );
    break;
  }
}
fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('done');
