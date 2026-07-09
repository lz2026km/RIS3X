import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const zhFile = path.join(root, 'src', 'i18n', 'locales', 'zh-CN', 'nav.json');
const enFile = path.join(root, 'src', 'i18n', 'locales', 'en-US', 'nav.json');

const zh = JSON.parse(fs.readFileSync(zhFile, 'utf-8'));
const en = JSON.parse(fs.readFileSync(enFile, 'utf-8'));

const addZh = {
  "workflowV3": "工作流",
  "eyeSpecialty": "眼科专科",
  "dentalSpecialty": "口腔专科",
  "patient360": "患者 360°",
  "workflowDesigner": "工作流设计器",
  "routingRules": "路由规则",
  "workloadHeatmap": "工作量热力图",
  "slaPolicy": "SLA 策略",
  "dicomBrowserPro": "DICOM 浏览器 Pro",
  "eyeReportWrite": "眼科报告书写",
  "eyeStrabismus": "斜视检查",
  "eyeNeuro": "神经眼科",
  "eyeOncology": "眼眶肿瘤",
  "eyeCornea": "角膜病",
  "eyeContactLens": "接触镜",
  "eyeLowVision": "低视力",
  "eyeCataract": "白内障",
  "eyeRefractive": "屈光手术",
  "dentalVolume": "体绘制",
  "dentalEmr": "患者 360°",
  "dentalBilling": "收费 · 医保",
  "dentalSchedule": "排班 · PSR",
  "dentalPhoto": "口内照片"
};

const addEn = {
  "workflowV3": "Workflow",
  "eyeSpecialty": "Eye Specialty",
  "dentalSpecialty": "Dental",
  "patient360": "Patient 360°",
  "workflowDesigner": "Workflow Designer",
  "routingRules": "Routing Rules",
  "workloadHeatmap": "Workload Heatmap",
  "slaPolicy": "SLA Policy",
  "dicomBrowserPro": "DICOM Browser Pro",
  "eyeReportWrite": "Eye Report Writing",
  "eyeStrabismus": "Strabismus",
  "eyeNeuro": "Neuro-Ophthalmology",
  "eyeOncology": "Ocular Oncology",
  "eyeCornea": "Corneal Disease",
  "eyeContactLens": "Contact Lens",
  "eyeLowVision": "Low Vision",
  "eyeCataract": "Cataract",
  "eyeRefractive": "Refractive Surgery",
  "dentalVolume": "Volume Rendering",
  "dentalEmr": "Patient 360°",
  "dentalBilling": "Billing & Insurance",
  "dentalSchedule": "Schedule & PSR",
  "dentalPhoto": "Intraoral Photos"
};

let changed = 0;
for (const [k, v] of Object.entries(addZh)) {
  if (!zh[k]) { zh[k] = v; changed++; }
}
fs.writeFileSync(zhFile, JSON.stringify(zh, null, 2) + '\n', 'utf-8');
console.log(`zh-CN: added ${changed} keys`);

changed = 0;
for (const [k, v] of Object.entries(addEn)) {
  if (!en[k]) { en[k] = v; changed++; }
}
fs.writeFileSync(enFile, JSON.stringify(en, null, 2) + '\n', 'utf-8');
console.log(`en-US: added ${changed} keys`);
