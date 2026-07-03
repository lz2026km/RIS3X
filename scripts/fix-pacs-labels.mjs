import fs from 'node:fs';
const path = 'src/pages/eye/pacs/PacsStudyListPage.tsx';
let text = fs.readFileSync(path, 'utf8');
const before = "  fundus_photo: \"眼底彩照\",\n  oct: \"OCT\",";
const after = "  fundus_photo: \"眼底彩照\",\n  oct_a: \"OCTA\",\n  oct: \"OCT\",\n  corneal_endothelium: \"角膜内皮\",";
if (text.includes(before)) {
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log('done');
} else { console.log('not found'); }
