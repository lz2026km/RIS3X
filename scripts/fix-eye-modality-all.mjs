import fs from 'node:fs';
import path from 'node:path';

const MODALITY_LABELS = "const MODALITY_LABELS: Record<string, string> = { fundus_photo: '眼底彩照', oct: 'OCT', ffa: 'FFA', icga: 'ICGA', visual_field: '视野', topography: '角膜地形图', pentacam: 'Pentacam', iol_master: 'IOL Master', ubm: 'UBM', slit_lamp: '裂隙灯', oct_a: 'OCTA', corneal_endothelium: '角膜内皮', tear_film: '泪膜', fundus_autofluorescence: '眼底自发荧光' };\n";

const files = [
  'src/pages/eye/ai/EyeAiPage.tsx',
  'src/pages/eye/EyeKpiDashboardPage.tsx',
  'src/pages/eye/pacs/FundusViewerPage.tsx',
  'src/pages/eye/report/EyeReportWritePage.tsx',
  'src/pages/eye/ris/EyeRisPage.tsx',  // 已修,跳过
];

for (const f of files) {
  let text = fs.readFileSync(f, 'utf8');
  if (text.includes('const MODALITY_LABELS')) continue;
  // 1. 加 MODALITY_LABELS
  const lastImport = text.lastIndexOf('import ');
  if (lastImport < 0) continue;
  const lineEnd = text.indexOf('\n', lastImport) + 1;
  text = text.slice(0, lineEnd) + MODALITY_LABELS + text.slice(lineEnd);
  // 2. 替换 <Tag ...>{v}</Tag> -> 用 MODALITY_LABELS
  text = text.replace(/<Tag([^>]*)>\{v\}<\/Tag>/g, "<Tag$1>{MODALITY_LABELS[v] || v}</Tag>");
  // 3. 替换 {x.modality} -> {MODALITY_LABELS[x.modality] || x.modality}
  text = text.replace(/\{(\w+)\.modality\}/g, "{MODALITY_LABELS[$1.modality] || $1.modality}");
  fs.writeFileSync(f, text, 'utf8');
  console.log('patched', f);
}
