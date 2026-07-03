import fs from 'node:fs';
const path = 'src/pages/eye/ris/EyeRisPage.tsx';
let text = fs.readFileSync(path, 'utf8');
// 删除 oct_a 等 modality keys
const toRemove = ['oct_a', 'corneal_endothelium', 'tear_film', 'fundus_autofluorescence', 'borderline', 'cup_to_disc_ratio', 'rim_width', 'arteriovenous_ratio', 'abnormal', 'v6', 'text', 'findings_multi', 'images', 'productivity', 'clinical', 'operational', 'financial', 'critical_value', 'pending_review', 'reviewing', 'amended', 'printed', 'draft'];
for (const k of toRemove) {
  const re = new RegExp('\\n\\s+' + k + ':\\s*"[^"]+",', 'g');
  text = text.replace(re, '');
}
fs.writeFileSync(path, text, 'utf8');
console.log('cleaned');
