import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const appI18n = fs.readFileSync(path.join(root, 'src', 'i18n', 'appI18n.ts'), 'utf-8');

const zhNavKeys = [
  ['workflowV3', '工作流V3'],
  ['eyeSpecialty', '眼科专科'],
  ['dentalSpecialty', '口腔专科'],
  ['patient360', '患者360°'],
  ['workflowDesigner', '工作流设计器'],
  ['routingRules', '路由规则'],
  ['workloadHeatmap', '工作量热力图'],
  ['slaPolicy', 'SLA策略'],
  ['dicomBrowserPro', 'DICOM浏览器Pro'],
  ['eyeReportWrite', '眼科报告书写'],
  ['eyeStrabismus', '斜视'],
  ['eyeNeuro', '神经眼科'],
  ['eyeOncology', '眼眶肿瘤'],
  ['eyeCornea', '角膜病'],
  ['eyeContactLens', '接触镜'],
  ['eyeLowVision', '低视力'],
  ['eyeCataract', '白内障'],
  ['eyeRefractive', '屈光手术'],
  ['dentalVolume', '体绘制'],
  ['dentalEmr', '患者360°'],
  ['dentalBilling', '收费·医保'],
  ['dentalSchedule', '排班·PSR'],
  ['dentalPhoto', '口内照片'],
];

const enNavKeys = [
  ['workflowV3', 'Workflow V3'],
  ['eyeSpecialty', 'Eye Specialty'],
  ['dentalSpecialty', 'Dental Specialty'],
  ['patient360', 'Patient 360°'],
  ['workflowDesigner', 'Workflow Designer'],
  ['routingRules', 'Routing Rules'],
  ['workloadHeatmap', 'Workload Heatmap'],
  ['slaPolicy', 'SLA Policy'],
  ['dicomBrowserPro', 'DICOM Browser Pro'],
  ['eyeReportWrite', 'Eye Report Writing'],
  ['eyeStrabismus', 'Strabismus'],
  ['eyeNeuro', 'Neuro-Ophthalmology'],
  ['eyeOncology', 'Ocular Oncology'],
  ['eyeCornea', 'Corneal Disease'],
  ['eyeContactLens', 'Contact Lens'],
  ['eyeLowVision', 'Low Vision'],
  ['eyeCataract', 'Cataract'],
  ['eyeRefractive', 'Refractive Surgery'],
  ['dentalVolume', 'Volume Rendering'],
  ['dentalEmr', 'Patient 360°'],
  ['dentalBilling', 'Billing & Insurance'],
  ['dentalSchedule', 'Schedule & PSR'],
  ['dentalPhoto', 'Intraoral Photos'],
];

// Check which already exist
const missingZh = zhNavKeys.filter(([k]) => !appI18n.includes(`"nav.${k}"`));
const missingEn = enNavKeys.filter(([k]) => !appI18n.includes(`"nav.${k}"`));

console.log('appI18n.ts 缺失:');
console.log(`中文 ${missingZh.length}/${zhNavKeys.length}`);
console.log(`英文 ${missingEn.length}/${enNavKeys.length}`);

if (missingZh.length > 0) {
  console.log('\n需要添加的中文:');
  missingZh.forEach(([k, v]) => console.log(`  "nav.${k}": "${v}",`));
}
