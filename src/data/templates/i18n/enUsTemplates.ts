/**
 * G005 RIS v3.0.6.5 - en-US 模板数据
 * 40 升级点 - 英文标签 / 英文短语 / 英文 RADS 描述
 * 与 src/i18n/locales/en-US/* 互补,提供结构化模板的英文内容
 */
import type { StructuredTemplate, StructuredFieldDefinition, StructuredFieldGroup } from '../../types/R3/R3.WRITING';
import type { RadsCategory } from '../../data/rads/radsCommon';

// ============================================================
// 1. 通用短语 / 模板内容 (en-US)
// ============================================================
export interface EnUsPhrase {
  id: string;
  title: string;
  content: string;
  category: 'normal' | 'abnormal' | 'followup' | 'critical' | 'signature' | 'disclaimer';
  bodyPart: string[];
  modality: string[];
  scene: string;
}

export const EN_US_PHRASES: EnUsPhrase[] = [
  { id: 'en-norm-chest', title: 'Normal Chest CT', content: 'The lungs are clear. No focal consolidation, mass, or pleural effusion. The mediastinum is unremarkable. The heart size is normal. No evidence of pneumothorax.', category: 'normal', bodyPart: ['CHEST'], modality: ['CT'], scene: 'normal' },
  { id: 'en-norm-abd', title: 'Normal Abdomen CT', content: 'The liver, gallbladder, pancreas, and spleen appear unremarkable. Both kidneys are normal in size and enhancement. No free fluid or free air. The bowel shows normal caliber.', category: 'normal', bodyPart: ['ABDOMEN'], modality: ['CT'], scene: 'normal' },
  { id: 'en-norm-brain', title: 'Normal Brain MR', content: 'No acute intracranial abnormality. Gray-white matter differentiation is preserved. Ventricles, sulci, and cisterns are normal in size and configuration. No midline shift.', category: 'normal', bodyPart: ['BRAIN'], modality: ['MR'], scene: 'normal' },
  { id: 'en-abn-lung-nodule', title: 'Pulmonary Nodule', content: 'A solid nodule measuring [X] mm is seen in the [right/left] [upper/middle/lower] lobe. The margin is [smooth/lobulated/spiculated]. No associated pleural retraction or lymphadenopathy.', category: 'abnormal', bodyPart: ['CHEST'], modality: ['CT'], scene: 'lung-nodule' },
  { id: 'en-abn-stroke', title: 'Acute Stroke', content: 'A wedge-shaped area of hypoattenuation is seen in the [right/left] MCA territory, consistent with acute/subacute infarct. No hemorrhage. ASPECTS score: [X].', category: 'critical', bodyPart: ['BRAIN'], modality: ['CT'], scene: 'stroke' },
  { id: 'en-abn-frac', title: 'Fracture', content: 'A [transverse/oblique/spiral/comminuted] fracture is identified at the [location], with [displacement/angulation]. Surrounding soft tissue swelling is present.', category: 'abnormal', bodyPart: ['EXTREMITY'], modality: ['DR'], scene: 'fracture' },
  { id: 'en-fu-nodule', title: 'Follow-up Nodule', content: 'Recommend follow-up CT in 3 months to assess stability per Lung-RADS 4A management guidelines.', category: 'followup', bodyPart: ['CHEST'], modality: ['CT'], scene: 'lung-nodule' },
  { id: 'en-sig-doc', title: 'Physician Signature', content: 'Electronically signed by: Dr. [Name]  Date: [YYYY-MM-DD]', category: 'signature', bodyPart: [], modality: [], scene: 'signature' },
];

// ============================================================
// 2. 英文 RADS 报告片段
// ============================================================
export const EN_US_RADS_SNIPPETS: Record<string, Record<string, { finding: string; impression: string; recommendation: string }>> = {
  'BI-RADS': {
    '0': { finding: 'Additional imaging evaluation is recommended.', impression: 'BI-RADS Category 0: Incomplete - Need additional imaging.', recommendation: 'Recommend spot compression / magnification / ultrasound / MR recall.' },
    '1': { finding: 'Both breasts are negative.', impression: 'BI-RADS Category 1: Negative.', recommendation: 'Routine annual screening in 1 year.' },
    '2': { finding: 'A benign finding such as [typical benign].', impression: 'BI-RADS Category 2: Benign finding.', recommendation: 'Routine annual screening.' },
    '3': { finding: 'Probably benign finding with ≤ 2% risk of malignancy.', impression: 'BI-RADS Category 3: Probably benign.', recommendation: 'Short interval follow-up (6 months) or continued screening.' },
    '4A': { finding: 'Low suspicion for malignancy (2-10%).', impression: 'BI-RADS Category 4A: Low suspicion.', recommendation: 'Tissue diagnosis (biopsy).' },
    '4B': { finding: 'Moderate suspicion for malignancy (10-50%).', impression: 'BI-RADS Category 4B: Moderate suspicion.', recommendation: 'Tissue diagnosis (biopsy).' },
    '4C': { finding: 'High suspicion for malignancy (50-95%).', impression: 'BI-RADS Category 4C: High suspicion.', recommendation: 'Tissue diagnosis (biopsy).' },
    '5': { finding: 'Highly suggestive of malignancy (≥ 95%).', impression: 'BI-RADS Category 5: Highly suggestive of malignancy.', recommendation: 'Biopsy and treatment planning at MDT.' },
    '6': { finding: 'Known biopsy-proven malignancy.', impression: 'BI-RADS Category 6: Known biopsy-proven malignancy.', recommendation: 'Surgical / systemic treatment per staging.' },
  },
  'Lung-RADS': {
    '1': { finding: 'No pulmonary nodules.', impression: 'Lung-RADS Category 1: Negative.', recommendation: 'Continue annual LDCT screening.' },
    '2': { finding: 'Benign appearance nodules (e.g., complete calcification).', impression: 'Lung-RADS Category 2: Benign appearance.', recommendation: 'Continue annual LDCT.' },
    '3': { finding: 'Probably benign nodule.', impression: 'Lung-RADS Category 3: Probably benign.', recommendation: '6-month LDCT follow-up.' },
    '4A': { finding: 'Suspicious nodule.', impression: 'Lung-RADS Category 4A: Suspicious.', recommendation: '3-month LDCT / PET-CT / tissue sampling.' },
    '4B': { finding: 'Very suspicious nodule.', impression: 'Lung-RADS Category 4B: Very suspicious.', recommendation: '3-month LDCT / PET-CT / tissue sampling.' },
    '4X': { finding: 'Category 4 with additional suspicious features.', impression: 'Lung-RADS Category 4X: Additional findings.', recommendation: 'Tissue diagnosis and MDT discussion.' },
  },
  'TI-RADS': {
    'TR1': { finding: 'Cystic nodule.', impression: 'TI-RADS 1: Benign.', recommendation: 'No FNA needed.' },
    'TR2': { finding: 'Not suspicious (0 points).', impression: 'TI-RADS 2: Not suspicious.', recommendation: 'No FNA needed.' },
    'TR3': { finding: 'Mildly suspicious (3 points).', impression: 'TI-RADS 3: Mildly suspicious.', recommendation: 'FNA if ≥ 2.5 cm; follow-up if smaller.' },
    'TR4': { finding: 'Moderately suspicious (4-6 points).', impression: 'TI-RADS 4: Moderately suspicious.', recommendation: 'FNA if ≥ 1.5 cm; follow-up if smaller.' },
    'TR5': { finding: 'Highly suspicious (≥ 7 points).', impression: 'TI-RADS 5: Highly suspicious.', recommendation: 'FNA if ≥ 1.0 cm; close follow-up if smaller.' },
  },
  'CAD-RADS': {
    '0': { finding: 'No coronary artery stenosis.', impression: 'CAD-RADS 0: No stenosis.', recommendation: 'No further evaluation needed.' },
    '1': { finding: 'Minimal stenosis (< 25%).', impression: 'CAD-RADS 1: Minimal.', recommendation: 'No further evaluation needed.' },
    '2': { finding: 'Mild stenosis (25-49%).', impression: 'CAD-RADS 2: Mild.', recommendation: 'Risk factor modification and follow-up.' },
    '3': { finding: 'Moderate stenosis (50-69%).', impression: 'CAD-RADS 3: Moderate.', recommendation: 'Consider ICA or functional testing (FFR-CT/SPECT).' },
    '4A': { finding: 'Severe stenosis 1-2 vessels (70-99%).', impression: 'CAD-RADS 4A: Severe 1-2 vessel.', recommendation: 'Consider revascularization (PCI / CABG).' },
    '4B': { finding: 'Severe stenosis 3 vessels / left main.', impression: 'CAD-RADS 4B: Severe 3 vessel/LM.', recommendation: 'Strongly consider revascularization + MDT.' },
    '5': { finding: 'Total occlusion.', impression: 'CAD-RADS 5: Total occlusion.', recommendation: 'Cardiology + PCI/CABG.' },
  },
  'PI-RADS': {
    '1': { finding: 'No suspicious lesions.', impression: 'PI-RADS 1: Very low risk.', recommendation: 'Continue PSA monitoring.' },
    '2': { finding: 'Likely benign.', impression: 'PI-RADS 2: Low risk.', recommendation: 'Continue follow-up.' },
    '3': { finding: 'Intermediate suspicion.', impression: 'PI-RADS 3: Intermediate risk.', recommendation: 'Consider MR-targeted biopsy + systematic biopsy.' },
    '4': { finding: 'High suspicion.', impression: 'PI-RADS 4: High risk.', recommendation: 'Targeted biopsy + MDT discussion.' },
    '5': { finding: 'Very high suspicion (≥ 1.5 cm or ECE).', impression: 'PI-RADS 5: Very high risk.', recommendation: 'Biopsy + clinical staging + treatment planning.' },
  },
  'LI-RADS': {
    'LR-1': { finding: 'Definitely benign observation.', impression: 'LI-RADS 1: Definitely benign.', recommendation: 'Routine follow-up.' },
    'LR-2': { finding: 'Probably benign.', impression: 'LI-RADS 2: Probably benign.', recommendation: '6-month imaging follow-up.' },
    'LR-3': { finding: 'Intermediate probability.', impression: 'LI-RADS 3: Intermediate.', recommendation: '3-6 month CT/MRI; consider biopsy.' },
    'LR-4': { finding: 'Probably HCC.', impression: 'LI-RADS 4: Probably HCC.', recommendation: 'MDT discussion.' },
    'LR-5': { finding: 'Definitely HCC.', impression: 'LI-RADS 5: Definitely HCC.', recommendation: 'Treat as HCC per BCLC staging.' },
  },
  'C-RADS': {
    'C0': { finding: 'Inadequate bowel preparation.', impression: 'C-RADS C0: Incomplete.', recommendation: 'Repeat CTC.' },
    'C1': { finding: 'Normal colon, no polyps ≥ 6 mm.', impression: 'C-RADS C1: Normal colon.', recommendation: '5-year routine screening.' },
    'C2': { finding: 'Intermediate polyps (1-2 of 6-9 mm).', impression: 'C-RADS C2: Intermediate.', recommendation: '1-3 year CTC follow-up.' },
    'C3': { finding: 'Advanced polyps (≥ 3 of 6-9 mm or ≥ 10 mm).', impression: 'C-RADS C3: Advanced.', recommendation: 'Colonoscopy polypectomy.' },
    'C4': { finding: 'Colonic mass.', impression: 'C-RADS C4: Colonic mass (likely malignant).', recommendation: 'Colonoscopy + biopsy.' },
  },
  'NI-RADS': {
    '1': { finding: 'No evidence of recurrence.', impression: 'NI-RADS 1: No recurrence.', recommendation: 'Routine MR follow-up.' },
    '2': { finding: 'Low suspicion (inflammation/treatment effect).', impression: 'NI-RADS 2: Low suspicion.', recommendation: '3-month MR follow-up; consider PET-CT.' },
    '3': { finding: 'High suspicion.', impression: 'NI-RADS 3: High suspicion.', recommendation: 'Biopsy for confirmation.' },
    '4': { finding: 'Definite recurrence (pathology-proven).', impression: 'NI-RADS 4: Definite recurrence.', recommendation: 'MDT + systemic treatment.' },
  },
  'O-RADS': {
    '0': { finding: 'Incomplete evaluation.', impression: 'O-RADS 0: Incomplete.', recommendation: 'MRI or specialist consultation.' },
    '1': { finding: 'Normal ovary.', impression: 'O-RADS 1: Normal.', recommendation: 'Routine follow-up.' },
    '2': { finding: 'Almost certainly benign.', impression: 'O-RADS 2: Almost benign.', recommendation: 'No follow-up needed.' },
    '3': { finding: 'Low risk (1-< 10%).', impression: 'O-RADS 3: Low risk.', recommendation: '1-year US/MRI follow-up.' },
    '4': { finding: 'Intermediate risk (10-< 50%).', impression: 'O-RADS 4: Intermediate.', recommendation: 'Gynecology consult; consider MRI.' },
    '5': { finding: 'High risk (≥ 50%).', impression: 'O-RADS 5: High risk.', recommendation: 'Gynecologic oncology MDT.' },
  },
  'VI-RADS': {
    '1': { finding: 'Very unlikely muscle invasion.', impression: 'VI-RADS 1: Very unlikely muscle invasion.', recommendation: 'TURBT.' },
    '2': { finding: 'Unlikely muscle invasion.', impression: 'VI-RADS 2: Unlikely.', recommendation: 'TURBT + repeat biopsy.' },
    '3': { finding: 'Equivocal.', impression: 'VI-RADS 3: Equivocal.', recommendation: 'TURBT + MDT.' },
    '4': { finding: 'Likely muscle invasion.', impression: 'VI-RADS 4: Likely muscle invasion.', recommendation: 'Neoadjuvant chemo + cystectomy.' },
    '5': { finding: 'Invasion beyond muscle.', impression: 'VI-RADS 5: Beyond muscle.', recommendation: 'Radical cystectomy + chemo.' },
  },
  'Bone-RADS': {
    '1': { finding: 'Definitely benign.', impression: 'Bone-RADS 1: Benign.', recommendation: 'No follow-up.' },
    '2': { finding: 'Probably benign.', impression: 'Bone-RADS 2: Probably benign.', recommendation: '6-12 month imaging follow-up.' },
    '3': { finding: 'Indeterminate.', impression: 'Bone-RADS 3: Indeterminate.', recommendation: 'MRI or biopsy for further characterization.' },
    '4': { finding: 'Highly suspicious for malignancy.', impression: 'Bone-RADS 4: Highly suspicious.', recommendation: 'Biopsy + oncology consult.' },
  },
};

// ============================================================
// 3. 英文结构化字段(精选)
// ============================================================
const enUsRecistGroups: StructuredFieldGroup[] = [
  { id: 'en-g1', label: 'Baseline', labelEn: 'Baseline', order: 1, collapsible: false, defaultExpanded: true },
  { id: 'en-g2', label: 'Target Lesions', labelEn: 'Target Lesions', order: 2, collapsible: true, defaultExpanded: true },
  { id: 'en-g3', label: 'Response Assessment', labelEn: 'Response Assessment', order: 3, collapsible: false, defaultExpanded: true },
];

const enUsRecistFields: StructuredFieldDefinition[] = [
  { id: 'en-f1', key: 'baselineDate', label: 'Baseline Date', labelEn: 'Baseline Date', type: 'date', required: true, group: 'en-g1', order: 1 },
  { id: 'en-f2', key: 'lesionCount', label: 'Target Lesion Count', labelEn: 'Target Lesion Count', type: 'number', required: true, group: 'en-g1', min: 1, max: 10, order: 2 },
  { id: 'en-f3', key: 'lesion1Site', label: 'Lesion 1 Site', labelEn: 'Lesion 1 Site', type: 'text', required: true, group: 'en-g2', order: 3 },
  { id: 'en-f4', key: 'lesion1Long', label: 'Lesion 1 Long Diameter (mm)', labelEn: 'Lesion 1 Long Diameter', type: 'number', required: true, group: 'en-g2', min: 0, max: 500, unit: 'mm', order: 4 },
  { id: 'en-f5', key: 'lesion1Baseline', label: 'Lesion 1 Baseline (mm)', labelEn: 'Lesion 1 Baseline', type: 'number', required: true, group: 'en-g2', min: 0, max: 500, unit: 'mm', order: 5 },
  { id: 'en-f6', key: 'sumOfDiameters', label: 'Sum of Diameters (mm)', labelEn: 'Sum of Diameters', type: 'formula', required: true, group: 'en-g3', order: 6, formula: 'sum(lesion1Long+lesion2Long+lesion3Long+lesion4Long+lesion5Long)', locked: true },
  { id: 'en-f7', key: 'percentChange', label: 'Percent Change (%)', labelEn: 'Percent Change', type: 'formula', required: true, group: 'en-g3', order: 7, formula: '(sumOfDiameters-baselineSum)/baselineSum*100', locked: true },
  { id: 'en-f8', key: 'responseCategory', label: 'Response Category', labelEn: 'Response Category', type: 'enum', required: true, group: 'en-g3', options: [
    { value: 'CR', label: 'Complete Response', labelEn: 'Complete Response', color: '#10b981' },
    { value: 'PR', label: 'Partial Response', labelEn: 'Partial Response', color: '#3b82f6' },
    { value: 'SD', label: 'Stable Disease', labelEn: 'Stable Disease', color: '#f59e0b' },
    { value: 'PD', label: 'Progressive Disease', labelEn: 'Progressive Disease', color: '#dc2626' },
    { value: 'NE', label: 'Not Evaluable', labelEn: 'Not Evaluable', color: '#6b7280' },
  ], order: 8 },
];

export const EN_US_RECIST_TEMPLATE: StructuredTemplate = {
  id: 'recist',
  name: 'RECIST 1.1 (en-US)',
  nameEn: 'RECIST 1.1',
  modality: 'CT',
  bodyPart: 'Whole Body',
  version: '1.0.0',
  fields: enUsRecistFields,
  groups: enUsRecistGroups,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  author: 'G005 RIS',
  score: 4.8,
  tags: ['oncology', 'en-US', 'RECIST'],
  inheritable: true,
  approved: true,
};

export const EN_US_TEMPLATES: StructuredTemplate[] = [EN_US_RECIST_TEMPLATE];

// ============================================================
// 4. 英文 RADS 描述(从 RADS 标准翻译)
// ============================================================
export const EN_US_RADS_DESCRIPTIONS: Record<string, RadsCategory[]> = {
  'BI-RADS': [
    { code: '0', name: 'Incomplete', description: 'Need additional imaging evaluation', riskPercent: 'N/A', recommendation: 'Recall for additional imaging', isActionable: true },
    { code: '1', name: 'Negative', description: 'No abnormal findings', riskPercent: '~0%', recommendation: 'Annual screening', isActionable: false },
    { code: '2', name: 'Benign', description: 'Completely characterized benign finding', riskPercent: '~0%', recommendation: 'Annual screening', isActionable: false },
    { code: '3', name: 'Probably Benign', description: '≤ 2% risk of malignancy', riskPercent: '≤ 2%', recommendation: 'Short-term follow-up (6 months)', isActionable: true },
    { code: '4A', name: 'Low Suspicion', description: '2-10% risk of malignancy', riskPercent: '2-10%', recommendation: 'Tissue diagnosis (biopsy)', isActionable: true },
    { code: '4B', name: 'Moderate Suspicion', description: '10-50% risk of malignancy', riskPercent: '10-50%', recommendation: 'Tissue diagnosis (biopsy)', isActionable: true },
    { code: '4C', name: 'High Suspicion', description: '50-95% risk of malignancy', riskPercent: '50-95%', recommendation: 'Tissue diagnosis (biopsy)', isActionable: true },
    { code: '5', name: 'Highly Suggestive of Malignancy', description: '≥ 95% risk of malignancy', riskPercent: '≥ 95%', recommendation: 'Biopsy + treatment planning', isActionable: true },
    { code: '6', name: 'Known Biopsy-Proven Malignancy', description: 'Pre-treatment baseline', riskPercent: '100%', recommendation: 'Surgical / systemic treatment', isActionable: true },
  ],
  'Lung-RADS': [
    { code: '1', name: 'Negative', description: 'No nodules or complete benign', riskPercent: '< 1%', recommendation: '12-month LDCT', isActionable: false },
    { code: '2', name: 'Benign Appearance', description: 'Benign calcification / fat / parallel pleural', riskPercent: '< 1%', recommendation: '12-month LDCT', isActionable: false },
    { code: '3', name: 'Probably Benign', description: 'Solid 6-7 mm / part-solid ≤ 5 mm / GGN ≥ 30 mm', riskPercent: '1-2%', recommendation: '6-month LDCT', isActionable: true },
    { code: '4A', name: 'Suspicious', description: 'Solid 8-15 mm / part-solid 6-7 mm', riskPercent: '5-15%', recommendation: '3-month LDCT / PET / biopsy', isActionable: true },
    { code: '4B', name: 'Very Suspicious', description: 'Solid ≥ 15 mm / part-solid 8-30 mm', riskPercent: '> 15%', recommendation: '3-month LDCT / PET / biopsy', isActionable: true },
    { code: '4X', name: 'Category 4 + Additional Findings', description: '4A/4B + additional suspicious features', riskPercent: '> 15%', recommendation: 'Tissue diagnosis + MDT', isActionable: true },
  ],
  'TI-RADS': [
    { code: 'TR1', name: 'Benign', description: 'Cystic nodule', riskPercent: '~0%', recommendation: 'No FNA', isActionable: false },
    { code: 'TR2', name: 'Not Suspicious', description: '0 points', riskPercent: '< 2%', recommendation: 'No FNA', isActionable: false },
    { code: 'TR3', name: 'Mildly Suspicious', description: '3 points', riskPercent: '< 5%', recommendation: 'FNA if ≥ 2.5 cm; follow-up', isActionable: true },
    { code: 'TR4', name: 'Moderately Suspicious', description: '4-6 points', riskPercent: '5-20%', recommendation: 'FNA if ≥ 1.5 cm; follow-up', isActionable: true },
    { code: 'TR5', name: 'Highly Suspicious', description: '≥ 7 points', riskPercent: '> 20%', recommendation: 'FNA if ≥ 1.0 cm', isActionable: true },
  ],
};

// ============================================================
// 5. 英文免责声明
// ============================================================
export const EN_US_DISCLAIMERS = [
  'This report is generated for clinical decision support and should be interpreted by a qualified radiologist.',
  'All measurements are based on DICOM images acquired with the protocol described in the study header.',
  'Comparison with prior studies is recommended when available.',
  'Critical findings have been communicated to the referring clinician per institutional policy.',
  'This document is a controlled medical record. Unauthorized distribution is prohibited.',
];

// ============================================================
// 6. RADS 标签英文别名(术语映射)
// ============================================================
export const EN_US_RADS_ALIAS: Record<string, string> = {
  'GGO': 'ground-glass opacity',
  'GGN': 'ground-glass nodule',
  'solid': 'solid',
  'part-solid': 'part-solid',
  'subsolid': 'subsolid',
  'mass': 'mass',
  'nodule': 'nodule',
  'calcification': 'calcification',
  'spiculation': 'spiculation',
  'pleural retraction': 'pleural retraction',
  'APHE': 'arterial phase hyperenhancement',
  'washout': 'washout',
  'capsule': 'capsule',
  'TIV': 'tumor in vein',
  'target sign': 'target sign',
  'HRP': 'high-risk plaque',
  'FFR-CT': 'CT-derived fractional flow reserve',
};

// 默认导出
export default {
  phrases: EN_US_PHRASES,
  radsSnippets: EN_US_RADS_SNIPPETS,
  templates: EN_US_TEMPLATES,
  radsDescriptions: EN_US_RADS_DESCRIPTIONS,
  disclaimers: EN_US_DISCLAIMERS,
  radsAlias: EN_US_RADS_ALIAS,
};
