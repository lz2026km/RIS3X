import fs from 'node:fs';
const path = 'src/pages/eye/ris/EyeRisPage.tsx';
let text = fs.readFileSync(path, 'utf8');
const before = '<Tag style={{ fontSize: 12 }}>{v}</Tag>';
const after = '<Tag style={{ fontSize: 12 }}>{MODALITY_LABELS[v] || v}</Tag>';
if (text.includes(before)) {
  text = text.replace(before, after);
  // 加 MODALITY_LABELS 字典
  const modLabels = "\nconst MODALITY_LABELS: Record<string, string> = { fundus_photo: '眼底彩照', oct: 'OCT', ffa: 'FFA', icga: 'ICGA', visual_field: '视野', topography: '角膜地形图', pentacam: 'Pentacam', iol_master: 'IOL Master', ubm: 'UBM', slit_lamp: '裂隙灯', oct_a: 'OCTA', corneal_endothelium: '角膜内皮', tear_film: '泪膜', fundus_autofluorescence: '眼底自发荧光' };\n";
  // 加到文件最前面 (在 import 后)
  const lastImport = text.lastIndexOf('import ');
  const lineEnd = text.indexOf('\n', lastImport) + 1;
  text = text.slice(0, lineEnd) + modLabels + text.slice(lineEnd);
  fs.writeFileSync(path, text, 'utf8');
  console.log('done');
} else { console.log('not found'); }
