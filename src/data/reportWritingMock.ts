/**
 * G005 放射RIS系统 v3.0.5.1 - R3.WRITING 书写模块 Mock 数据
 * 150 升级点 mock:结构化字段 / 富文本 / AI 草稿 / 语音 / 影像锚定 / 短语库 / 模板
 */

import type {
  StructuredTemplate, StructuredFieldDefinition, StructuredFieldGroup,
  RecistTargetLesion, RecistResponse,
  BiradsAssessment, BiradsFinding, BiradsCategory,
  PiradsAssessment, PiradsScore,
  RichEditorDocument, RichEditorImage, RichEditorStyle,
  AiDraftResult, AiDraftRequest,
  VoiceDictationSession,
  ImageAnchor,
  Phrase, RadLexTerm,
  PriorReport, SimilarCase,
  ReportDraft,
  ReportTemplate, TemplateCategory,
  WritingMetrics, PreSubmitScore,
  MultiModalityPanel,
  KeywordHighlight,
  ReportWritingContext,
  CriticalPattern, VoiceCommand, VoiceProfile, Collaborator, ChargeItem,
} from '../types/R3/R3.WRITING';

// ============================================================
// 1. RECIST 1.1 模板(40 fields)
// ============================================================
const recistGroups: StructuredFieldGroup[] = [
  { id: 'g1', label: '基线评估', labelEn: 'Baseline', order: 1, collapsible: false, defaultExpanded: true },
  { id: 'g2', label: '靶病灶', labelEn: 'Target Lesions', order: 2, collapsible: true, defaultExpanded: true },
  { id: 'g3', label: '非靶病灶', labelEn: 'Non-Target Lesions', order: 3, collapsible: true, defaultExpanded: true },
  { id: 'g4', label: '新发病灶', labelEn: 'New Lesions', order: 4, collapsible: true, defaultExpanded: true },
  { id: 'g5', label: '疗效评估', labelEn: 'Response Assessment', order: 5, collapsible: false, defaultExpanded: true },
];

const recistFields: StructuredFieldDefinition[] = [
  { id: 'f1', key: 'baselineDate', label: '基线测量日期', labelEn: 'Baseline Date', type: 'date', required: true, group: 'g1', order: 1, placeholder: 'YYYY-MM-DD', permissions: ['doctor:read', 'doctor:write'] },
  { id: 'f2', key: 'lesionCount', label: '靶病灶数量', labelEn: 'Target Lesion Count', type: 'number', required: true, group: 'g1', min: 1, max: 10, defaultValue: 5, order: 2 },
  { id: 'f3', key: 'measurementMethod', label: '测量方法', labelEn: 'Measurement Method', type: 'enum', required: true, group: 'g1', options: [
    { value: 'CT', label: 'CT', labelEn: 'CT', color: 'var(--color-info-600)' },
    { value: 'MR', label: 'MR', labelEn: 'MR', color: '#7c3aed' },
    { value: 'PET', label: 'PET-CT', labelEn: 'PET-CT', color: 'var(--color-error-600)' },
  ], defaultValue: 'CT', order: 3 },
  { id: 'f4', key: 'lesion1Site', label: '病灶 1 部位', labelEn: 'Lesion 1 Site', type: 'text', required: true, group: 'g2', order: 4, placeholder: '例:右肺上叶', dependsOn: { fieldKey: 'lesionCount', equals: 5 } },
  { id: 'f5', key: 'lesion1Long', label: '病灶 1 长径(mm)', labelEn: 'Lesion 1 Long Diameter', type: 'number', required: true, group: 'g2', min: 0, max: 500, unit: 'mm', unitOptions: ['mm', 'cm'], order: 5, referenceRange: { min: 0, max: 500, unit: 'mm' } },
  { id: 'f6', key: 'lesion1Short', label: '病灶 1 短径(mm)', labelEn: 'Lesion 1 Short Diameter', type: 'number', required: false, group: 'g2', min: 0, max: 500, unit: 'mm', unitOptions: ['mm', 'cm'], order: 6 },
  { id: 'f7', key: 'lesion1Baseline', label: '病灶 1 基线(mm)', labelEn: 'Lesion 1 Baseline', type: 'number', required: true, group: 'g2', min: 0, max: 500, unit: 'mm', order: 7 },
  { id: 'f8', key: 'lesion2Site', label: '病灶 2 部位', labelEn: 'Lesion 2 Site', type: 'text', required: true, group: 'g2', order: 8 },
  { id: 'f9', key: 'lesion2Long', label: '病灶 2 长径(mm)', labelEn: 'Lesion 2 Long Diameter', type: 'number', required: true, group: 'g2', min: 0, max: 500, unit: 'mm', order: 9 },
  { id: 'f10', key: 'lesion2Short', label: '病灶 2 短径(mm)', labelEn: 'Lesion 2 Short Diameter', type: 'number', required: false, group: 'g2', min: 0, max: 500, unit: 'mm', order: 10 },
  { id: 'f11', key: 'lesion2Baseline', label: '病灶 2 基线(mm)', labelEn: 'Lesion 2 Baseline', type: 'number', required: true, group: 'g2', min: 0, max: 500, unit: 'mm', order: 11 },
  { id: 'f12', key: 'lesion3Site', label: '病灶 3 部位', labelEn: 'Lesion 3 Site', type: 'text', required: true, group: 'g2', order: 12 },
  { id: 'f13', key: 'lesion3Long', label: '病灶 3 长径(mm)', labelEn: 'Lesion 3 Long Diameter', type: 'number', required: true, group: 'g2', min: 0, max: 500, unit: 'mm', order: 13 },
  { id: 'f14', key: 'lesion3Short', label: '病灶 3 短径(mm)', labelEn: 'Lesion 3 Short Diameter', type: 'number', required: false, group: 'g2', min: 0, max: 500, unit: 'mm', order: 14 },
  { id: 'f15', key: 'lesion3Baseline', label: '病灶 3 基线(mm)', labelEn: 'Lesion 3 Baseline', type: 'number', required: true, group: 'g2', min: 0, max: 500, unit: 'mm', order: 15 },
  { id: 'f16', key: 'lesion4Site', label: '病灶 4 部位', labelEn: 'Lesion 4 Site', type: 'text', required: false, group: 'g2', order: 16 },
  { id: 'f17', key: 'lesion4Long', label: '病灶 4 长径(mm)', labelEn: 'Lesion 4 Long Diameter', type: 'number', required: false, group: 'g2', min: 0, max: 500, unit: 'mm', order: 17 },
  { id: 'f18', key: 'lesion4Short', label: '病灶 4 短径(mm)', labelEn: 'Lesion 4 Short Diameter', type: 'number', required: false, group: 'g2', min: 0, max: 500, unit: 'mm', order: 18 },
  { id: 'f19', key: 'lesion4Baseline', label: '病灶 4 基线(mm)', labelEn: 'Lesion 4 Baseline', type: 'number', required: false, group: 'g2', min: 0, max: 500, unit: 'mm', order: 19 },
  { id: 'f20', key: 'lesion5Site', label: '病灶 5 部位', labelEn: 'Lesion 5 Site', type: 'text', required: false, group: 'g2', order: 20 },
  { id: 'f21', key: 'lesion5Long', label: '病灶 5 长径(mm)', labelEn: 'Lesion 5 Long Diameter', type: 'number', required: false, group: 'g2', min: 0, max: 500, unit: 'mm', order: 21 },
  { id: 'f22', key: 'lesion5Short', label: '病灶 5 短径(mm)', labelEn: 'Lesion 5 Short Diameter', type: 'number', required: false, group: 'g2', min: 0, max: 500, unit: 'mm', order: 22 },
  { id: 'f23', key: 'lesion5Baseline', label: '病灶 5 基线(mm)', labelEn: 'Lesion 5 Baseline', type: 'number', required: false, group: 'g2', min: 0, max: 500, unit: 'mm', order: 23 },
  { id: 'f24', key: 'nonTargetLesions', label: '非靶病灶存在', labelEn: 'Non-Target Lesions Present', type: 'boolean', required: true, group: 'g3', defaultValue: false, order: 24 },
  { id: 'f25', key: 'nonTargetSites', label: '非靶病灶部位', labelEn: 'Non-Target Sites', type: 'multi-enum', required: false, group: 'g3', options: [
    { value: 'liver', label: '肝脏', labelEn: 'Liver' },
    { value: 'bone', label: '骨骼', labelEn: 'Bone' },
    { value: 'pleural', label: '胸膜', labelEn: 'Pleural' },
    { value: 'lymph', label: '淋巴结', labelEn: 'Lymph Node' },
    { value: 'adrenal', label: '肾上腺', labelEn: 'Adrenal' },
  ], order: 25, dependsOn: { fieldKey: 'nonTargetLesions', equals: true } },
  { id: 'f26', key: 'nonTargetProgression', label: '非靶病灶进展', labelEn: 'Non-Target Progression', type: 'boolean', required: false, group: 'g3', defaultValue: false, order: 26 },
  { id: 'f27', key: 'newLesion', label: '出现新发病灶', labelEn: 'New Lesion', type: 'boolean', required: true, group: 'g4', defaultValue: false, order: 27 },
  { id: 'f28', key: 'newLesionSites', label: '新发病灶部位', labelEn: 'New Lesion Sites', type: 'text', required: false, group: 'g4', order: 28, dependsOn: { fieldKey: 'newLesion', equals: true } },
  { id: 'f29', key: 'sumOfDiameters', label: '靶病灶直径总和(mm)', labelEn: 'Sum of Diameters', type: 'number', required: true, group: 'g5', min: 0, max: 2000, unit: 'mm', order: 29, formula: 'sum(lesion1Long+lesion2Long+lesion3Long+lesion4Long+lesion5Long)', locked: true },
  { id: 'f30', key: 'baselineSum', label: '基线直径总和(mm)', labelEn: 'Baseline Sum', type: 'number', required: true, group: 'g5', min: 0, max: 2000, unit: 'mm', order: 30, formula: 'sum(lesion1Baseline+lesion2Baseline+lesion3Baseline+lesion4Baseline+lesion5Baseline)', locked: true },
  { id: 'f31', key: 'percentChange', label: '变化百分比(%)', labelEn: 'Percent Change', type: 'number', required: true, group: 'g5', min: -100, max: 1000, unit: '%', order: 31, formula: '(sumOfDiameters-baselineSum)/baselineSum*100', locked: true },
  { id: 'f32', key: 'responseCategory', label: '疗效分类', labelEn: 'Response Category', type: 'enum', required: true, group: 'g5', options: [
    { value: 'CR', label: '完全缓解 CR', labelEn: 'Complete Response', color: '#10b981' },
    { value: 'PR', label: '部分缓解 PR', labelEn: 'Partial Response', color: 'var(--color-primary-500)' },
    { value: 'SD', label: '疾病稳定 SD', labelEn: 'Stable Disease', color: 'var(--color-warning-500)' },
    { value: 'PD', label: '疾病进展 PD', labelEn: 'Progressive Disease', color: 'var(--color-error-600)' },
    { value: 'NE', label: '无法评估 NE', labelEn: 'Not Evaluable', color: '#6b7280' },
  ], defaultValue: 'SD', order: 32 },
  { id: 'f33', key: 'treatmentLine', label: '治疗线数', labelEn: 'Treatment Line', type: 'enum', required: false, group: 'g5', options: [
    { value: '1L', label: '一线', labelEn: 'First Line' },
    { value: '2L', label: '二线', labelEn: 'Second Line' },
    { value: '3L+', label: '三线及以上', labelEn: 'Third Line+' },
  ], order: 33 },
  { id: 'f34', key: 'assessor', label: '评估医师', labelEn: 'Assessor', type: 'text', required: true, group: 'g5', order: 34 },
  { id: 'f35', key: 'followUpDate', label: '下次随访日期', labelEn: 'Follow-up Date', type: 'date', required: false, group: 'g5', order: 35 },
  { id: 'f36', key: 'imageUpload', label: '关键图像', labelEn: 'Key Image', type: 'image', required: false, group: 'g5', order: 36 },
  { id: 'f37', key: 'signatureField', label: '签名', labelEn: 'Signature', type: 'signature', required: false, group: 'g5', order: 37, locked: true, permissions: ['doctor:sign'] },
  { id: 'f38', key: 'fieldScore', label: '字段质量分', labelEn: 'Field Score', type: 'number', required: false, group: 'g5', min: 0, max: 100, unit: '%', order: 38, defaultValue: 85, locked: true },
  { id: 'f39', key: 'fillDuration', label: '填写耗时(s)', labelEn: 'Fill Duration', type: 'number', required: false, group: 'g5', min: 0, max: 3600, unit: 's', order: 39, locked: true, defaultValue: 0 },
  { id: 'f40', key: 'recistSummary', label: '总结说明', labelEn: 'Summary', type: 'text', required: false, group: 'g5', order: 40, fillGuide: '请综合所有评估指标后填写', example: '本例患者经2周期化疗后,靶病灶长径总和较基线缩小32.5%,疗效评价为PR。' },
];

export const RECIST_TEMPLATE: StructuredTemplate = {
  id: 'recist',
  name: 'RECIST 1.1 实体瘤疗效评估',
  nameEn: 'RECIST 1.1 Solid Tumor Response',
  modality: 'CT',
  bodyPart: '全身',
  version: '1.1.3',
  fields: recistFields,
  groups: recistGroups,
  createdAt: '2026-05-10T08:00:00Z',
  updatedAt: '2026-08-15T10:00:00Z',
  author: 'G005 肿瘤评估组',
  score: 4.8,
  tags: ['肿瘤', '疗效评估', 'RECIST', 'CT'],
  inheritable: true,
  approved: true,
  approver: '张主任',
};

// ============================================================
// 2. BI-RADS 模板
// ============================================================
const biradsGroups: StructuredFieldGroup[] = [
  { id: 'bg1', label: '临床信息', labelEn: 'Clinical Info', order: 1, collapsible: false, defaultExpanded: true },
  { id: 'bg2', label: '影像所见', labelEn: 'Findings', order: 2, collapsible: false, defaultExpanded: true },
  { id: 'bg3', label: '评估分类', labelEn: 'Assessment', order: 3, collapsible: false, defaultExpanded: true },
  { id: 'bg4', label: '建议', labelEn: 'Recommendation', order: 4, collapsible: false, defaultExpanded: true },
];

const biradsFields: StructuredFieldDefinition[] = [
  { id: 'bf1', key: 'clinicalHistory', label: '临床病史', labelEn: 'Clinical History', type: 'text', required: true, group: 'bg1', order: 1, placeholder: '例:女性 52 岁,自检发现右乳肿块' },
  { id: 'bf2', key: 'breastDensity', label: '乳腺密度', labelEn: 'Breast Density', type: 'enum', required: true, group: 'bg1', options: [
    { value: 'A', label: 'A:几乎全部为脂肪', labelEn: 'A: Almost entirely fatty', color: '#a7f3d0' },
    { value: 'B', label: 'B:散在纤维腺体', labelEn: 'B: Scattered fibroglandular', color: '#bfdbfe' },
    { value: 'C', label: 'C:不均匀致密', labelEn: 'C: Heterogeneously dense', color: '#fed7aa' },
    { value: 'D', label: 'D:极度致密', labelEn: 'D: Extremely dense', color: '#fecaca' },
  ], order: 2 },
  { id: 'bf3', key: 'laterality', label: '侧别', labelEn: 'Laterality', type: 'multi-enum', required: true, group: 'bg2', options: [
    { value: 'L', label: '左乳', labelEn: 'Left' },
    { value: 'R', label: '右乳', labelEn: 'Right' },
  ], order: 3 },
  { id: 'bf4', key: 'mass', label: '肿块', labelEn: 'Mass', type: 'boolean', required: true, group: 'bg2', defaultValue: false, order: 4 },
  { id: 'bf5', key: 'massShape', label: '肿块形态', labelEn: 'Mass Shape', type: 'enum', required: false, group: 'bg2', options: [
    { value: 'round', label: '圆形', labelEn: 'Round' },
    { value: 'oval', label: '卵圆形', labelEn: 'Oval' },
    { value: 'irregular', label: '不规则形', labelEn: 'Irregular' },
  ], order: 5, dependsOn: { fieldKey: 'mass', equals: true } },
  { id: 'bf6', key: 'massMargin', label: '肿块边缘', labelEn: 'Mass Margin', type: 'enum', required: false, group: 'bg2', options: [
    { value: 'circumscribed', label: '清晰', labelEn: 'Circumscribed' },
    { value: 'obscured', label: '遮蔽', labelEn: 'Obscured' },
    { value: 'microlobulated', label: '微小分叶', labelEn: 'Microlobulated' },
    { value: 'indistinct', label: '模糊', labelEn: 'Indistinct' },
    { value: 'spiculated', label: '毛刺', labelEn: 'Spiculated' },
  ], order: 6, dependsOn: { fieldKey: 'mass', equals: true } },
  { id: 'bf7', key: 'massDensity', label: '肿块密度', labelEn: 'Mass Density', type: 'enum', required: false, group: 'bg2', options: [
    { value: 'high', label: '高密度', labelEn: 'High' },
    { value: 'equal', label: '等密度', labelEn: 'Equal' },
    { value: 'low', label: '低密度', labelEn: 'Low' },
    { value: 'fat-containing', label: '含脂肪', labelEn: 'Fat-containing' },
  ], order: 7, dependsOn: { fieldKey: 'mass', equals: true } },
  { id: 'bf8', key: 'massSizeX', label: '肿块大小 X(mm)', labelEn: 'Mass Size X', type: 'number', required: false, group: 'bg2', min: 0, max: 200, unit: 'mm', order: 8, dependsOn: { fieldKey: 'mass', equals: true } },
  { id: 'bf9', key: 'massSizeY', label: '肿块大小 Y(mm)', labelEn: 'Mass Size Y', type: 'number', required: false, group: 'bg2', min: 0, max: 200, unit: 'mm', order: 9, dependsOn: { fieldKey: 'mass', equals: true } },
  { id: 'bf10', key: 'massLocation', label: '肿块位置', labelEn: 'Mass Location', type: 'text', required: false, group: 'bg2', order: 10, dependsOn: { fieldKey: 'mass', equals: true } },
  { id: 'bf11', key: 'calcification', label: '钙化', labelEn: 'Calcification', type: 'boolean', required: true, group: 'bg2', defaultValue: false, order: 11 },
  { id: 'bf12', key: 'calcType', label: '钙化类型', labelEn: 'Calcification Type', type: 'enum', required: false, group: 'bg2', options: [
    { value: 'benign', label: '良性', labelEn: 'Benign' },
    { value: 'suspicious', label: '可疑', labelEn: 'Suspicious' },
    { value: 'amorphous', label: '不定形', labelEn: 'Amorphous' },
    { value: 'finePleomorphic', label: '细小多形性', labelEn: 'Fine Pleomorphic' },
    { value: 'fineLinear', label: '细线/线样分支', labelEn: 'Fine Linear/Branching' },
  ], order: 12, dependsOn: { fieldKey: 'calcification', equals: true } },
  { id: 'bf13', key: 'asymmetry', label: '不对称致密', labelEn: 'Asymmetry', type: 'boolean', required: true, group: 'bg2', defaultValue: false, order: 13 },
  { id: 'bf14', key: 'architecturalDistortion', label: '结构扭曲', labelEn: 'Architectural Distortion', type: 'boolean', required: true, group: 'bg2', defaultValue: false, order: 14 },
  { id: 'bf15', key: 'biradsCategory', label: 'BI-RADS 分类', labelEn: 'BI-RADS Category', type: 'enum', required: true, group: 'bg3', options: [
    { value: '0', label: '0 - 评估不完全', labelEn: '0 - Incomplete', color: '#9ca3af' },
    { value: '1', label: '1 - 阴性', labelEn: '1 - Negative', color: '#10b981' },
    { value: '2', label: '2 - 良性发现', labelEn: '2 - Benign', color: '#10b981' },
    { value: '3', label: '3 - 可能良性', labelEn: '3 - Probably Benign', color: 'var(--color-warning-500)' },
    { value: '4', label: '4 - 可疑异常', labelEn: '4 - Suspicious', color: '#ea580c' },
    { value: '4A', label: '4A - 低度可疑', labelEn: '4A - Low Suspicion', color: '#fb923c' },
    { value: '4B', label: '4B - 中度可疑', labelEn: '4B - Moderate Suspicion', color: '#f97316' },
    { value: '4C', label: '4C - 高度可疑', labelEn: '4C - High Suspicion', color: '#ea580c' },
    { value: '5', label: '5 - 高度提示恶性', labelEn: '5 - Highly Suggestive', color: 'var(--color-error-600)' },
    { value: '6', label: '6 - 活检证实恶性', labelEn: '6 - Known Biopsy-Proven', color: '#7f1d1d' },
  ], defaultValue: '2', order: 15 },
  { id: 'bf16', key: 'recommendation', label: '建议', labelEn: 'Recommendation', type: 'text', required: true, group: 'bg4', order: 16, fillGuide: '根据 BI-RADS 分类给出后续随访或活检建议' },
  { id: 'bf17', key: 'imageUploadB', label: '关键图像', labelEn: 'Key Image', type: 'image', required: false, group: 'bg4', order: 17 },
];

export const BIRADS_TEMPLATE: StructuredTemplate = {
  id: 'birads',
  name: 'BI-RADS 乳腺影像报告',
  nameEn: 'BI-RADS Breast Imaging Report',
  modality: 'MG',
  bodyPart: '乳腺',
  version: '5.0.1',
  fields: biradsFields,
  groups: biradsGroups,
  createdAt: '2026-04-20T08:00:00Z',
  updatedAt: '2026-09-01T10:00:00Z',
  author: 'G005 乳腺组',
  score: 4.9,
  tags: ['乳腺', 'BI-RADS', '钼靶', '筛查'],
  inheritable: true,
  approved: true,
  approver: '李主任',
};

// ============================================================
// 3. PI-RADS 模板
// ============================================================
const piradsFields: StructuredFieldDefinition[] = [
  { id: 'pf1', key: 'psa', label: 'PSA(ng/mL)', labelEn: 'PSA', type: 'number', required: true, group: 'pg1', min: 0, max: 100, unit: 'ng/mL', order: 1, referenceRange: { min: 0, max: 4, unit: 'ng/mL', note: '正常 < 4' } },
  { id: 'pf2', key: 'prostateVolume', label: '前列腺体积(cc)', labelEn: 'Prostate Volume', type: 'number', required: true, group: 'pg1', min: 5, max: 200, unit: 'cc', order: 2 },
  { id: 'pf3', key: 'psad', label: 'PSAD(ng/mL/cc)', labelEn: 'PSAD', type: 'number', required: true, group: 'pg1', min: 0, max: 10, unit: 'ng/mL/cc', order: 3, formula: 'psa/prostateVolume', locked: true },
  { id: 'pf4', key: 'pzLesionCount', label: '外周带病灶数', labelEn: 'PZ Lesions', type: 'number', required: false, group: 'pg1', min: 0, max: 5, defaultValue: 0, order: 4 },
  { id: 'pf5', key: 'tzLesionCount', label: '移行带病灶数', labelEn: 'TZ Lesions', type: 'number', required: false, group: 'pg1', min: 0, max: 5, defaultValue: 0, order: 5 },
  { id: 'pf6', key: 'lesion1Zone', label: '病灶 1 区域', labelEn: 'Lesion 1 Zone', type: 'enum', required: false, group: 'pg2', options: [
    { value: 'PZ', label: '外周带 PZ', labelEn: 'Peripheral Zone' },
    { value: 'TZ', label: '移行带 TZ', labelEn: 'Transition Zone' },
    { value: 'CZ', label: '中央带 CZ', labelEn: 'Central Zone' },
    { value: 'AS', label: '前纤维肌 AS', labelEn: 'Anterior Stroma' },
  ], order: 6 },
  { id: 'pf7', key: 'lesion1T2w', label: '病灶 1 T2W 评分', labelEn: 'Lesion 1 T2W Score', type: 'scale', required: false, group: 'pg2', min: 1, max: 5, defaultValue: 3, order: 7 },
  { id: 'pf8', key: 'lesion1DWI', label: '病灶 1 DWI 评分', labelEn: 'Lesion 1 DWI Score', type: 'scale', required: false, group: 'pg2', min: 1, max: 5, defaultValue: 3, order: 8 },
  { id: 'pf9', key: 'lesion1DCE', label: '病灶 1 DCE', labelEn: 'Lesion 1 DCE', type: 'enum', required: false, group: 'pg2', options: [
    { value: 'positive', label: '阳性', labelEn: 'Positive' },
    { value: 'negative', label: '阴性', labelEn: 'Negative' },
    { value: 'NA', label: '不适用', labelEn: 'N/A' },
  ], order: 9 },
  { id: 'pf10', key: 'lesion1Size', label: '病灶 1 大小(mm)', labelEn: 'Lesion 1 Size', type: 'number', required: false, group: 'pg2', min: 0, max: 100, unit: 'mm', order: 10 },
  { id: 'pf11', key: 'lesion2Zone', label: '病灶 2 区域', labelEn: 'Lesion 2 Zone', type: 'enum', required: false, group: 'pg2', options: [
    { value: 'PZ', label: '外周带 PZ', labelEn: 'Peripheral Zone' },
    { value: 'TZ', label: '移行带 TZ', labelEn: 'Transition Zone' },
    { value: 'CZ', label: '中央带 CZ', labelEn: 'Central Zone' },
    { value: 'AS', label: '前纤维肌 AS', labelEn: 'Anterior Stroma' },
  ], order: 11 },
  { id: 'pf12', key: 'lesion2T2w', label: '病灶 2 T2W 评分', labelEn: 'Lesion 2 T2W Score', type: 'scale', required: false, group: 'pg2', min: 1, max: 5, defaultValue: 3, order: 12 },
  { id: 'pf13', key: 'lesion2DWI', label: '病灶 2 DWI 评分', labelEn: 'Lesion 2 DWI Score', type: 'scale', required: false, group: 'pg2', min: 1, max: 5, defaultValue: 3, order: 13 },
  { id: 'pf14', key: 'lesion2DCE', label: '病灶 2 DCE', labelEn: 'Lesion 2 DCE', type: 'enum', required: false, group: 'pg2', options: [
    { value: 'positive', label: '阳性', labelEn: 'Positive' },
    { value: 'negative', label: '阴性', labelEn: 'Negative' },
    { value: 'NA', label: '不适用', labelEn: 'N/A' },
  ], order: 14 },
  { id: 'pf15', key: 'lesion2Size', label: '病灶 2 大小(mm)', labelEn: 'Lesion 2 Size', type: 'number', required: false, group: 'pg2', min: 0, max: 100, unit: 'mm', order: 15 },
  { id: 'pf16', key: 'overallScore', label: '总体 PI-RADS 评分', labelEn: 'Overall PI-RADS', type: 'scale', required: true, group: 'pg3', min: 1, max: 5, defaultValue: 3, order: 16 },
  { id: 'pf17', key: 'pzScore', label: '外周带最高评分', labelEn: 'PZ Highest Score', type: 'scale', required: false, group: 'pg3', min: 1, max: 5, defaultValue: 3, order: 17 },
  { id: 'pf18', key: 'tzScore', label: '移行带最高评分', labelEn: 'TZ Highest Score', type: 'scale', required: false, group: 'pg3', min: 1, max: 5, defaultValue: 3, order: 18 },
  { id: 'pf19', key: 'piradsNotes', label: '评估说明', labelEn: 'Assessment Notes', type: 'text', required: false, group: 'pg3', order: 19 },
  { id: 'pf20', key: 'recommendationP', label: '建议', labelEn: 'Recommendation', type: 'text', required: true, group: 'pg3', order: 20, fillGuide: 'PI-RADS 1-2:常规随访;3:多参数评估;4-5:活检' },
];

const piradsGroups: StructuredFieldGroup[] = [
  { id: 'pg1', label: '基线', labelEn: 'Baseline', order: 1, collapsible: false, defaultExpanded: true },
  { id: 'pg2', label: '病灶详情', labelEn: 'Lesions', order: 2, collapsible: true, defaultExpanded: true },
  { id: 'pg3', label: '总体评估', labelEn: 'Overall', order: 3, collapsible: false, defaultExpanded: true },
];

export const PIRADS_TEMPLATE: StructuredTemplate = {
  id: 'pirads',
  name: 'PI-RADS v2.1 前列腺 MRI 评估',
  nameEn: 'PI-RADS v2.1 Prostate MRI',
  modality: 'MR',
  bodyPart: '前列腺',
  version: '2.1.5',
  fields: piradsFields,
  groups: piradsGroups,
  createdAt: '2026-03-15T08:00:00Z',
  updatedAt: '2026-09-10T10:00:00Z',
  author: 'G005 泌尿组',
  score: 4.7,
  tags: ['前列腺', 'PI-RADS', 'MR', 'mpMRI'],
  inheritable: true,
  approved: true,
  approver: '王主任',
};

// getStructuredTemplates() moved to end of file (after all template consts)
// to keep function + dependencies in same module, preventing Vite from
// splitting the function away from its template references (TDZ v3.0.6.8-3).

// ============================================================
// 4. RECIST 实例
// ============================================================
export const RECIST_LESIONS: RecistTargetLesion[] = [
  { id: 'l1', site: '右肺上叶(尖段)', longDiameterMm: 18, shortDiameterMm: 14, baselineMm: 28, previousMm: 22, sum: 18 },
  { id: 'l2', site: '右肺中叶(外侧段)', longDiameterMm: 12, shortDiameterMm: 10, baselineMm: 18, previousMm: 15, sum: 12 },
  { id: 'l3', site: '左肺下叶(背段)', longDiameterMm: 9, baselineMm: 14, previousMm: 11, sum: 9 },
  { id: 'l4', site: '纵隔淋巴结(2R)', longDiameterMm: 15, shortDiameterMm: 12, baselineMm: 22, previousMm: 18, sum: 15 },
  { id: 'l5', site: '肝右叶(S6)', longDiameterMm: 22, baselineMm: 35, previousMm: 28, sum: 22 },
];

export const RECIST_RESPONSE: RecistResponse = {
  category: 'PR',
  categoryLabel: '部分缓解',
  categoryLabelEn: 'Partial Response',
  sumOfDiameters: 76,
  baselineSum: 117,
  percentChange: -35.0,
  confirmedAt: '2026-08-20T14:00:00Z',
  confirmedBy: '陈医师',
  notes: '靶病灶长径总和较基线缩小 35%,达到部分缓解(PR)标准。建议继续当前方案 2 周期后再次评估。',
};

// ============================================================
// 5. BI-RADS 实例
// ============================================================
export const BIRADS_CATEGORY_MAP: Record<BiradsCategory, BiradsAssessment> = {
  '0': { category: '0', label: '评估不完全', labelEn: 'Incomplete', description: '需要进一步影像学评估', descriptionEn: 'Needs further imaging evaluation', recommendation: '召回补充其他影像学检查', recommendationEn: 'Recall for additional imaging', malignancyRisk: 0, color: '#9ca3af' },
  '1': { category: '1', label: '阴性', labelEn: 'Negative', description: '乳腺影像正常', descriptionEn: 'Normal breast imaging', recommendation: '常规年度筛查', recommendationEn: 'Routine annual screening', malignancyRisk: 0, color: '#10b981' },
  '2': { category: '2', label: '良性发现', labelEn: 'Benign', description: '明确的良性发现', descriptionEn: 'Definitively benign finding', recommendation: '常规年度筛查', recommendationEn: 'Routine annual screening', malignancyRisk: 0, color: '#10b981' },
  '3': { category: '3', label: '可能良性', labelEn: 'Probably Benign', description: '恶性可能性 ≤ 2%', descriptionEn: '≤ 2% malignancy risk', recommendation: '6 个月短期随访', recommendationEn: '6-month short-term follow-up', malignancyRisk: 2, color: 'var(--color-warning-500)' },
  '4': { category: '4', label: '可疑异常', labelEn: 'Suspicious', description: '恶性可能性 2-95%', descriptionEn: '2-95% malignancy risk', recommendation: '组织学活检', recommendationEn: 'Tissue biopsy', malignancyRisk: 30, color: '#ea580c' },
  '4A': { category: '4A', label: '低度可疑', labelEn: 'Low Suspicion', description: '恶性可能性 2-10%', descriptionEn: '2-10% malignancy risk', recommendation: '组织学活检', recommendationEn: 'Tissue biopsy', malignancyRisk: 5, color: '#fb923c' },
  '4B': { category: '4B', label: '中度可疑', labelEn: 'Moderate Suspicion', description: '恶性可能性 10-50%', descriptionEn: '10-50% malignancy risk', recommendation: '组织学活检', recommendationEn: 'Tissue biopsy', malignancyRisk: 25, color: '#f97316' },
  '4C': { category: '4C', label: '高度可疑', labelEn: 'High Suspicion', description: '恶性可能性 50-95%', descriptionEn: '50-95% malignancy risk', recommendation: '组织学活检', recommendationEn: 'Tissue biopsy', malignancyRisk: 70, color: '#ea580c' },
  '5': { category: '5', label: '高度提示恶性', labelEn: 'Highly Suggestive', description: '恶性可能性 ≥ 95%', descriptionEn: '≥ 95% malignancy risk', recommendation: '组织学活检与治疗', recommendationEn: 'Biopsy and treatment', malignancyRisk: 95, color: 'var(--color-error-600)' },
  '6': { category: '6', label: '活检证实恶性', labelEn: 'Known Biopsy-Proven', description: '活检已证实的恶性肿瘤', descriptionEn: 'Biopsy-proven malignancy', recommendation: '临床治疗', recommendationEn: 'Clinical treatment', malignancyRisk: 100, color: '#7f1d1d' },
};

export const BIRADS_FINDINGS: BiradsFinding[] = [
  { findingType: 'mass', shape: 'irregular', margin: 'spiculated', density: 'high', size: { x: 18, y: 15, z: 12, unit: 'mm' }, location: '外上象限', side: 'right', clockPosition: '9-10 点位' },
  { findingType: 'calcification', shape: undefined, margin: undefined, density: undefined, size: undefined, location: '外上象限(与肿块伴行)', side: 'right' },
];

// ============================================================
// 6. PI-RADS 实例
// ============================================================
export const PIRADS_ASSESSMENT: PiradsAssessment = {
  peripheralZoneScore: 4 as PiradsScore,
  transitionZoneScore: 3 as PiradsScore,
  overallScore: 4 as PiradsScore,
  overallCategory: 'High',
  prostateVolumeCc: 45,
  psad: 0.27,
  findings: [
    { lesionId: 'lsn1', zone: 'PZ', t2w: 4 as PiradsScore, dw: 5 as PiradsScore, dwi: 5 as PiradsScore, dce: 'positive', sizeMm: 14, location: '右外周带尖部' },
    { lesionId: 'lsn2', zone: 'TZ', t2w: 3 as PiradsScore, dw: 3 as PiradsScore, dwi: 3 as PiradsScore, dce: 'negative', sizeMm: 8, location: '左移行带中段' },
  ],
};

// ============================================================
// 7. 富文本编辑器 Mock
// ============================================================
export const RICH_DEFAULT_STYLE: RichEditorStyle = {
  fontFamily: 'SimSun',
  fontSize: 14,
  bold: false, italic: false, underline: false, strike: false,
  color: '#000000',
  backgroundColor: '#ffffff',
  align: 'left',
  lineHeight: 1.6,
  letterSpacing: 0,
  heading: 0,
  bullet: null,
  subscript: false, superscript: false,
  indent: 0,
  blockquote: false,
};

const BASE = import.meta.env.BASE_URL || '/';
export const RICH_IMAGES_MOCK: RichEditorImage[] = [
  { id: 'ri-1', src: `${BASE}mock-images/ct-001.png`, alt: '胸部 CT 肺窗', width: 320, height: 240, keyImage: true, dicomRef: '1.2.840.10008.5.1.4.1.1.2.1.1234.5678', uploadAt: '2026-09-15T10:30:00Z', uploadedBy: '陈医师', annotation: [{ type: 'arrow', x: 120, y: 80, color: 'var(--color-error-600)', text: '病灶' }] },
  { id: 'ri-2', src: `${BASE}mock-images/ct-002.png`, alt: '胸部 CT 纵隔窗', width: 320, height: 240, keyImage: false, dicomRef: '1.2.840.10008.5.1.4.1.1.2.1.1234.5679', uploadAt: '2026-09-15T10:31:00Z', uploadedBy: '陈医师' },
  { id: 'ri-3', src: `${BASE}mock-images/mr-001.png`, alt: 'MR T2 横断位', width: 320, height: 240, keyImage: true, dicomRef: '1.2.840.10008.5.1.4.1.1.4.1.9876.5432', uploadAt: '2026-09-15T10:35:00Z', uploadedBy: '陈医师', annotation: [{ type: 'circle', x: 150, y: 120, width: 60, height: 60, color: '#10b981' }] },
];

export const RICH_DOCUMENT_MOCK: RichEditorDocument = {
  id: 'doc-rpt-038',
  reportId: 'rpt-038',
  content: '胸部 CT 平扫 + 增强所见...',
  html: '<h2>影像所见</h2><p>双肺纹理清晰...</p><h2>诊断意见</h2><p>1. 右肺上叶...</p>',
  plainText: '胸部 CT 平扫 + 增强所见...双肺纹理清晰...',
  images: RICH_IMAGES_MOCK,
  tables: [],
  style: { fontFamily: 'SimSun', fontSize: 14, align: 'left' },
  wordCount: 248,
  charCount: 1520,
  paragraphCount: 12,
  readingTimeMin: 1.5,
  writingDurationSec: 1845,
  lastEditedAt: '2026-09-15T11:00:00Z',
  lastEditedBy: '陈医师',
  version: 7,
  undoStack: [],
  redoStack: [],
  spellCheck: { enabled: true, language: 'zh-CN', errors: [] },
  pagination: { totalPages: 2, currentPage: 1, split: false },
  fullscreen: false,
  splitPreview: false,
  autoSaveAt: '2026-09-15T11:00:00Z',
};

// ============================================================
// 8. AI 草稿 Mock
// ============================================================
export const AI_DRAFT_REQUEST: AiDraftRequest = {
  reportId: 'rpt-038',
  modality: 'CT',
  bodyPart: '胸部',
  clinicalInfo: '女性 58 岁,体检发现右肺上叶结节 1 周,无明显症状,既往无肿瘤病史。',
  templates: ['tpl-chest-ct-v2'],
  includeImages: true,
  style: 'structured',
  language: 'zh-CN',
};

export const AI_DRAFT_RESULT: AiDraftResult = {
  id: 'aidraft-038-001',
  reportId: 'rpt-038',
  stage: 'ready',
  findings: '双侧胸廓对称,双肺纹理清晰,走行自然。右肺上叶尖段见一不规则形软组织密度结节,大小约 18mm × 15mm,边界欠清,可见短毛刺征,平扫 CT 值约 32HU,增强后强化 CT 值约 78HU,强化幅度约 46HU。邻近胸膜可见牵拉凹陷征。余肺野未见明确实变、肿块及结节影。纵隔居中,纵隔及双侧肺门未见明显肿大淋巴结。双侧胸腔未见明显积液。心脏大血管形态、密度未见异常。',
  impression: '1. 右肺上叶尖段软组织密度结节,大小约 18mm × 15mm,边界欠清,伴短毛刺征及胸膜牵拉,考虑周围型肺癌可能性大,建议进一步穿刺活检明确病理。\n2. 双肺其余肺野未见明确占位。\n3. 纵隔及双肺门未见明显肿大淋巴结。',
  recommendation: '1. 建议行 CT 引导下经皮肺穿刺活检以明确病理诊断。\n2. 必要时可行 PET-CT 检查以评估全身状况。\n3. 待病理结果回报后,建议多学科会诊(MDT)制定治疗方案。',
  confidence: 0.87,
  modelVersion: 'G005-MedAI-v3.2.1',
  generatedAt: '2026-09-15T10:55:00Z',
  basedOnReports: ['rpt-031', 'rpt-022'],
  warnings: [
    'AI 草稿仅供临床参考,最终诊断须由执业医师确认。',
    '建议结合临床病史、实验室检查及其他影像学资料综合判断。',
  ],
  tokens: { input: 1280, output: 540, cost: 0.018 },
};

// ============================================================
// 9. 语音听写 Mock
// ============================================================
export const VOICE_DICTATION_MOCK: VoiceDictationSession = {
  id: 'vd-rpt-038',
  reportId: 'rpt-038',
  state: 'paused',
  lang: 'zh-CN',
  interimText: '右肺上叶可见一不规则形',
  finalText: '胸部 CT 平扫 + 增强所见:双侧胸廓对称,双肺纹理清晰,走行自然。右肺上叶尖段见一不规则形软组织密度结节,大小约十八毫米乘十五毫米。',
  segments: [
    { start: 0, end: 2.5, text: '胸部 CT 平扫 + 增强所见:', confidence: 0.98 },
    { start: 2.5, end: 8.3, text: '双侧胸廓对称,双肺纹理清晰,走行自然。', confidence: 0.95 },
    { start: 8.3, end: 15.7, text: '右肺上叶尖段见一不规则形软组织密度结节,', confidence: 0.92 },
    { start: 15.7, end: 20.1, text: '大小约十八毫米乘十五毫米。', confidence: 0.89 },
  ],
  commands: [
    { command: '换行', action: 'insert-newline', ts: 5.2 },
    { command: '删除', action: 'delete-last-sentence', ts: 12.4 },
  ],
  startedAt: '2026-09-15T10:42:00Z',
  totalDurationSec: 142,
  totalWords: 78,
  autoPunctuation: true,
  history: [
    { id: 'vdh-1', text: '右肺下叶基底段见一斑片状高密度影,边界模糊。', createdAt: '2026-09-15T10:35:00Z' },
  ],
  browser: 'webkit',
};

// ============================================================
// 10. 影像锚定 Mock
// ============================================================
export const IMAGE_ANCHORS_MOCK: ImageAnchor[] = [
  {
    id: 'ia-1', reportId: 'rpt-038', studyInstanceUID: '1.2.840.10008.5.1.4.1.1.2.1.1',
    seriesInstanceUID: '1.2.840.10008.5.1.4.1.1.2.1.1.1', sopInstanceUID: '1.2.840.10008.5.1.4.1.1.2.1.1.1.1',
    frameNumber: 87, annotation: [{ type: 'arrow', coords: [{ x: 124, y: 88 }], label: '右肺上叶结节', labelEn: 'RUL Nodule', color: 'var(--color-error-600)' }],
    keyImage: true, windowing: { center: -600, width: 1500 }, thumbnail: `${BASE}mock/thumb-ct-001.png`,
    status: 'active', createdBy: '陈医师', createdAt: '2026-09-15T10:30:00Z', pinnedBy: '陈医师', pinnedAt: '2026-09-15T10:30:00Z', usageCount: 1,
  },
  {
    id: 'ia-2', reportId: 'rpt-038', studyInstanceUID: '1.2.840.10008.5.1.4.1.1.2.1.1',
    seriesInstanceUID: '1.2.840.10008.5.1.4.1.1.2.1.1.1', sopInstanceUID: '1.2.840.10008.5.1.4.1.1.2.1.1.1.2',
    frameNumber: 88, annotation: [
      { type: 'line', coords: [{ x: 100, y: 80 }, { x: 150, y: 110 }], label: '长径 18mm', labelEn: 'Long 18mm', color: 'var(--color-primary-500)', measurement: { value: 18, unit: 'mm' } },
      { type: 'line', coords: [{ x: 115, y: 95 }, { x: 130, y: 110 }], label: '短径 15mm', labelEn: 'Short 15mm', color: '#10b981', measurement: { value: 15, unit: 'mm' } },
    ],
    keyImage: true, windowing: { center: -600, width: 1500 }, thumbnail: `${BASE}mock/thumb-ct-002.png`,
    status: 'active', createdBy: '陈医师', createdAt: '2026-09-15T10:32:00Z', usageCount: 1,
  },
];

// ============================================================
// 11. 短语库 Mock(60+)
// ============================================================
export const PHRASES_MOCK: Phrase[] = [
  { id: 'p1', content: '双肺纹理清晰,走行自然,未见明显异常密度影。', contentEn: 'Lung markings are clear with natural distribution; no obvious abnormal density.', category: 'normal', subCategory: '胸部', modality: ['CT', 'DR'], bodyPart: ['胸部'], tags: ['正常', '胸部'], favorite: true, usageCount: 1280, variables: [], isTemplate: false, authorId: 'u-001', authorName: '陈医师', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-15T10:00:00Z', pinyin: 'shuang fei wen li qing xi', pinyinInitials: 'sfwlqx' },
  { id: 'p2', content: '纵隔居中,纵隔及双侧肺门未见明显肿大淋巴结。', contentEn: 'Mediastinum is centered; no obvious enlarged lymph nodes in mediastinum or bilateral hila.', category: 'normal', subCategory: '胸部', modality: ['CT'], bodyPart: ['胸部'], tags: ['纵隔', '淋巴结', '正常'], favorite: true, usageCount: 980, variables: [], isTemplate: false, authorId: 'u-001', authorName: '陈医师', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-15T10:00:00Z' },
  { id: 'p3', content: '双侧胸腔未见明显积液征象。', contentEn: 'No obvious pleural effusion bilaterally.', category: 'normal', subCategory: '胸部', modality: ['CT', 'DR', 'US'], bodyPart: ['胸部'], tags: ['胸腔', '积液', '正常'], favorite: true, usageCount: 850, variables: [], isTemplate: false, authorId: 'u-001', authorName: '陈医师', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-15T10:00:00Z' },
  { id: 'p4', content: '右肺上叶见一不规则形软组织密度结节,大小约 {{size}},边界欠清,可见短毛刺征。', contentEn: 'An irregular soft-tissue density nodule in RUL, size ~{{size}}, with spiculation.', category: 'findingChest', subCategory: '肺结节', modality: ['CT'], bodyPart: ['胸部'], tags: ['结节', '肺'], favorite: true, usageCount: 320, variables: [{ key: 'size', label: '大小(mm)', labelEn: 'Size', defaultValue: '18mm×15mm' }], isTemplate: true, template: '右肺上叶见一不规则形软组织密度结节,大小约 {{size}},边界欠清,可见短毛刺征。', authorId: 'u-001', authorName: '陈医师', createdAt: '2026-02-15T08:00:00Z', updatedAt: '2026-09-01T10:00:00Z' },
  { id: 'p5', content: '肝脏形态、大小正常,表面光滑,实质回声均匀,肝内胆管未见扩张。', contentEn: 'Liver is normal in shape and size; uniform parenchyma echo; no intrahepatic bile duct dilation.', category: 'findingAbdomen', subCategory: '肝脏', modality: ['US', 'CT', 'MR'], bodyPart: ['腹部'], tags: ['肝脏', '正常'], favorite: true, usageCount: 720, variables: [], isTemplate: false, authorId: 'u-001', authorName: '陈医师', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-15T10:00:00Z' },
  { id: 'p6', content: '颅脑实质未见明显异常信号影,脑室、脑池、脑沟未见扩大或变窄,中线结构居中。', contentEn: 'No obvious abnormal signal in brain parenchyma; ventricles, cisterns, sulci normal; midline centered.', category: 'findingNeuro', subCategory: '颅脑', modality: ['MR', 'CT'], bodyPart: ['头颅'], tags: ['颅脑', '正常'], favorite: true, usageCount: 540, variables: [], isTemplate: false, authorId: 'u-001', authorName: '陈医师', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-15T10:00:00Z' },
  { id: 'p7', content: '患者 {{patientName}}, {{gender}}, {{age}} 岁,临床诊断 {{clinicalDx}}。', contentEn: 'Patient {{patientName}}, {{gender}}, {{age}} years old, clinical diagnosis {{clinicalDx}}.', category: 'history', subCategory: '基本信息', modality: ['ALL'], bodyPart: ['ALL'], tags: ['基本信息', '模板'], favorite: true, usageCount: 1980, variables: [
    { key: 'patientName', label: '患者姓名', labelEn: 'Patient Name', defaultValue: '张三' },
    { key: 'gender', label: '性别', labelEn: 'Gender', defaultValue: '男' },
    { key: 'age', label: '年龄', labelEn: 'Age', defaultValue: '58' },
    { key: 'clinicalDx', label: '临床诊断', labelEn: 'Clinical Dx', defaultValue: '右肺占位' },
  ], isTemplate: true, template: '患者 {{patientName}}, {{gender}}, {{age}} 岁,临床诊断 {{clinicalDx}}。', authorId: 'u-001', authorName: '陈医师', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-15T10:00:00Z' },
  { id: 'p8', content: '危急值!建议立即临床干预。', contentEn: 'CRITICAL VALUE! Immediate clinical intervention required.', category: 'critical', subCategory: '危急值', modality: ['ALL'], bodyPart: ['ALL'], tags: ['危急值', 'Critical'], favorite: false, usageCount: 12, variables: [], isTemplate: false, authorId: 'u-001', authorName: '陈医师', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-15T10:00:00Z' },
  { id: 'p9', content: '建议 3-6 个月后复查 CT,动态观察病灶变化。', contentEn: 'Recommend follow-up CT in 3-6 months for dynamic observation.', category: 'recommendation', subCategory: '复查建议', modality: ['CT', 'MR'], bodyPart: ['ALL'], tags: ['复查', '随访'], favorite: true, usageCount: 460, variables: [], isTemplate: false, authorId: 'u-001', authorName: '陈医师', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-15T10:00:00Z' },
  { id: 'p10', content: '与 {{priorDate}} 老片比较,病灶较前{{change}}。', contentEn: 'Compared with prior study on {{priorDate}}, the lesion has {{change}}.', category: 'comparison', subCategory: '比较', modality: ['ALL'], bodyPart: ['ALL'], tags: ['比较', '随访'], favorite: true, usageCount: 380, variables: [
    { key: 'priorDate', label: '老片日期', labelEn: 'Prior Date', defaultValue: '2026-06-15' },
    { key: 'change', label: '变化', labelEn: 'Change', defaultValue: '缩小' },
  ], isTemplate: true, template: '与 {{priorDate}} 老片比较,病灶较前{{change}}。', authorId: 'u-001', authorName: '陈医师', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-15T10:00:00Z' },
  { id: 'p11', content: '对比剂:碘海醇(欧乃派克)100mL,经肘静脉高压注射,流率 3.0mL/s。', contentEn: 'Contrast: Iohexol (Omnipaque) 100mL, IV bolus at 3.0mL/s via elbow vein.', category: 'technique', subCategory: '增强技术', modality: ['CT'], bodyPart: ['ALL'], tags: ['增强', '技术'], favorite: true, usageCount: 290, variables: [], isTemplate: false, authorId: 'u-001', authorName: '陈医师', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-15T10:00:00Z' },
  { id: 'p12', content: '未见急性出血、梗死或占位性病变。', contentEn: 'No acute hemorrhage, infarction or space-occupying lesion.', category: 'impression', subCategory: '综合', modality: ['CT', 'MR'], bodyPart: ['头颅'], tags: ['颅脑', '正常', '印象'], favorite: true, usageCount: 350, variables: [], isTemplate: false, authorId: 'u-001', authorName: '陈医师', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-08-15T10:00:00Z' },
];

// ============================================================
// 12. RadLex Mock
// ============================================================
export const RADLEX_TERMS_MOCK: RadLexTerm[] = [
  { id: 'rdx-1', preferredName: '磨玻璃影', preferredNameEn: 'Ground-glass opacity', synonyms: ['GGO', '磨玻璃密度影', '磨玻璃结节'], definition: '肺内模糊的密度增高影,血管纹理仍可见。', definitionEn: 'Hazy area of increased lung opacity through which vessels are still visible.', childrenIds: [], modality: ['CT'], bodyPart: ['胸部'], category: '影像所见', usageCount: 890, lastUsedAt: '2026-09-15T08:00:00Z' },
  { id: 'rdx-2', preferredName: '实性结节', preferredNameEn: 'Solid nodule', synonyms: ['实性肺结节'], definition: '完全遮盖血管纹理的肺内结节。', definitionEn: 'Nodule that completely obscures vessels.', childrenIds: [], modality: ['CT'], bodyPart: ['胸部'], category: '影像所见', usageCount: 670, lastUsedAt: '2026-09-14T10:00:00Z' },
  { id: 'rdx-3', preferredName: '毛刺征', preferredNameEn: 'Spiculation', synonyms: ['毛刺', '放射状影'], definition: '结节边缘呈放射状的细线影。', definitionEn: 'Radiating thin lines from the edge of a nodule.', childrenIds: [], modality: ['CT'], bodyPart: ['胸部'], category: '影像所见', usageCount: 540, lastUsedAt: '2026-09-15T10:30:00Z' },
  { id: 'rdx-4', preferredName: '分叶征', preferredNameEn: 'Lobulation sign', synonyms: ['分叶'], definition: '肿块边缘呈分叶状的轮廓。', definitionEn: 'Lobulated contour of a mass edge.', childrenIds: [], modality: ['CT'], bodyPart: ['胸部'], category: '影像所见', usageCount: 320, lastUsedAt: '2026-09-12T09:00:00Z' },
  { id: 'rdx-5', preferredName: '胸膜牵拉征', preferredNameEn: 'Pleural retraction', synonyms: ['胸膜凹陷征', '胸膜牵拉'], definition: '胸膜向肿块方向凹陷的征象。', definitionEn: 'Pleural indentation toward the mass.', childrenIds: [], modality: ['CT'], bodyPart: ['胸部'], category: '影像所见', usageCount: 410, lastUsedAt: '2026-09-15T10:31:00Z' },
  { id: 'rdx-6', preferredName: '空气支气管征', preferredNameEn: 'Air bronchogram', synonyms: ['支气管充气征'], definition: '实变影中可见含气支气管影。', definitionEn: 'Air-filled bronchi visible within consolidation.', childrenIds: [], modality: ['CT'], bodyPart: ['胸部'], category: '影像所见', usageCount: 230, lastUsedAt: '2026-09-10T11:00:00Z' },
  { id: 'rdx-7', preferredName: '晕轮征', preferredNameEn: 'Halo sign', synonyms: ['光晕征'], definition: '结节周围的磨玻璃影环绕。', definitionEn: 'Ground-glass opacity surrounding a nodule.', childrenIds: [], modality: ['CT'], bodyPart: ['胸部'], category: '影像所见', usageCount: 180, lastUsedAt: '2026-09-08T14:00:00Z' },
  { id: 'rdx-8', preferredName: '反晕征', preferredNameEn: 'Reverse halo sign', synonyms: ['环礁征'], definition: '中央磨玻璃影被环形实变影包围。', definitionEn: 'Central GGO surrounded by a ring of consolidation.', childrenIds: [], modality: ['CT'], bodyPart: ['胸部'], category: '影像所见', usageCount: 90, lastUsedAt: '2026-09-05T09:00:00Z' },
];

// ============================================================
// 13. 历史报告 / 相似病例 Mock
// ============================================================
export const PRIOR_REPORTS_MOCK: PriorReport[] = [
  { id: 'pr-1', patientId: 'p-038', reportId: 'rpt-022', modality: 'CT', bodyPart: '胸部', studyDate: '2026-03-15T09:00:00Z', status: '已发布', findings: '右肺上叶尖段见一不规则形软组织密度结节,大小约 12mm×10mm,边界欠清,余肺野未见明显异常。', impression: '右肺上叶微小结节,建议 3-6 个月复查。', authorName: '王医师', comparisonDelta: { days: 184, summary: '较前明显增大' } },
  { id: 'pr-2', patientId: 'p-038', reportId: 'rpt-031', modality: 'CT', bodyPart: '胸部', studyDate: '2026-06-20T10:00:00Z', status: '已发布', findings: '右肺上叶尖段见一不规则形软组织密度结节,大小约 15mm×12mm,边界欠清,可见短毛刺征,平扫 CT 值约 30HU,增强后强化 CT 值约 65HU。', impression: '右肺上叶结节较前增大,周围型肺癌待排,建议穿刺活检。', authorName: '李医师', comparisonDelta: { days: 87, summary: '病灶较前明显增大 30%,强化程度增加' } },
];

export const SIMILAR_CASES_MOCK: SimilarCase[] = [
  { id: 'sc-1', reportId: 'rpt-099', patientId: 'p-099', modality: 'CT', bodyPart: '胸部', similarityScore: 0.92, topTerms: ['右肺上叶', '不规则形结节', '毛刺征', '胸膜牵拉', '周围型肺癌'], findings: '右肺上叶尖段见一不规则形软组织密度结节,大小约 20mm×17mm,边界欠清,可见短毛刺征,平扫 CT 值约 35HU,增强后明显强化。', impression: '右肺上叶周围型肺癌(腺癌可能性大)', authorName: '王医师', studyDate: '2026-08-10T09:00:00Z' },
  { id: 'sc-2', reportId: 'rpt-102', patientId: 'p-102', modality: 'CT', bodyPart: '胸部', similarityScore: 0.88, topTerms: ['右肺上叶', '不规则形', '强化', '活检'], findings: '右肺上叶不规则结节,大小约 16mm×14mm,增强后中度强化,纵隔未见肿大淋巴结。', impression: '右肺上叶结节,周围型肺癌可能性大,建议活检。', authorName: '陈医师', studyDate: '2026-08-22T10:00:00Z' },
  { id: 'sc-3', reportId: 'rpt-105', patientId: 'p-105', modality: 'CT', bodyPart: '胸部', similarityScore: 0.85, topTerms: ['肺上叶', '结节', '毛刺'], findings: '右肺上叶尖段不规则形结节,大小 19mm×16mm,可见毛刺征及胸膜牵拉,平扫 CT 值 33HU,增强后 75HU。', impression: '右肺上叶周围型肺癌。', authorName: '李医师', studyDate: '2026-08-30T11:00:00Z' },
];

// ============================================================
// 14. 报告模板
// ============================================================
export const REPORT_TEMPLATES_MOCK: ReportTemplate[] = [
  { id: 'tpl-1', name: '胸部 CT 标准模板', nameEn: 'Chest CT Standard', category: 'CT', subCategory: '胸部', modality: 'CT', bodyPart: '胸部', version: '3.2', inheritable: true, autoApply: true, content: '<h2>胸部 CT 平扫+增强</h2><p>...</p>', variables: [], rating: 4.8, useCount: 1240, rank: 1, approved: true, approver: '张主任', approvalDate: '2026-01-15', tags: ['胸部', 'CT', '标准'], authorId: 'u-001', authorName: '陈医师', createdAt: '2025-12-01T08:00:00Z', updatedAt: '2026-08-15T10:00:00Z' },
  { id: 'tpl-2', name: '头颅 MR 标准模板', nameEn: 'Brain MR Standard', category: 'MR', subCategory: '头颅', modality: 'MR', bodyPart: '头颅', version: '2.5', inheritable: true, autoApply: true, content: '<h2>头颅 MR 平扫</h2><p>...</p>', variables: [], rating: 4.7, useCount: 980, rank: 2, approved: true, approver: '张主任', approvalDate: '2026-01-15', tags: ['头颅', 'MR'], authorId: 'u-002', authorName: '王医师', createdAt: '2025-12-01T08:00:00Z', updatedAt: '2026-08-15T10:00:00Z' },
  { id: 'tpl-3', name: '上腹部 CT 增强模板', nameEn: 'Abdomen CT Enhanced', category: 'CT', subCategory: '腹部', modality: 'CT', bodyPart: '腹部', version: '3.0', inheritable: true, autoApply: true, content: '<h2>上腹部 CT 增强</h2><p>...</p>', variables: [], rating: 4.6, useCount: 870, rank: 3, approved: true, approver: '张主任', approvalDate: '2026-01-15', tags: ['腹部', 'CT', '增强'], authorId: 'u-003', authorName: '李医师', createdAt: '2025-12-01T08:00:00Z', updatedAt: '2026-08-15T10:00:00Z' },
  { id: 'tpl-4', name: '乳腺钼靶标准模板', nameEn: 'Mammography Standard', category: 'MG', subCategory: '乳腺', modality: 'MG', bodyPart: '乳腺', version: '2.0', inheritable: true, autoApply: true, content: '<h2>乳腺钼靶</h2><p>...</p>', variables: [], rating: 4.9, useCount: 540, rank: 4, approved: true, approver: '李主任', approvalDate: '2026-02-20', tags: ['乳腺', 'MG', 'BI-RADS'], authorId: 'u-004', authorName: '赵医师', createdAt: '2025-12-01T08:00:00Z', updatedAt: '2026-08-15T10:00:00Z' },
  { id: 'tpl-5', name: '腰椎 MR 平扫模板', nameEn: 'Lumbar Spine MR', category: 'MR', subCategory: '脊柱', modality: 'MR', bodyPart: '脊柱', version: '2.3', inheritable: true, autoApply: true, content: '<h2>腰椎 MR 平扫</h2><p>...</p>', variables: [], rating: 4.5, useCount: 620, rank: 5, approved: true, approver: '张主任', approvalDate: '2026-01-15', tags: ['脊柱', 'MR'], authorId: 'u-005', authorName: '孙医师', createdAt: '2025-12-01T08:00:00Z', updatedAt: '2026-08-15T10:00:00Z' },
];

export const TEMPLATE_CATEGORIES_MOCK: TemplateCategory[] = [
  { id: 'tc-1', name: 'CT', nameEn: 'CT', childrenIds: ['tc-1-1', 'tc-1-2', 'tc-1-3'], icon: '', order: 1 },
  { id: 'tc-1-1', name: '胸部', nameEn: 'Chest', parentId: 'tc-1', childrenIds: [], icon: '', order: 1 },
  { id: 'tc-1-2', name: '腹部', nameEn: 'Abdomen', parentId: 'tc-1', childrenIds: [], icon: '', order: 2 },
  { id: 'tc-1-3', name: '头颅', nameEn: 'Head', parentId: 'tc-1', childrenIds: [], icon: '', order: 3 },
  { id: 'tc-2', name: 'MR', nameEn: 'MR', childrenIds: ['tc-2-1', 'tc-2-2'], icon: '', order: 2 },
  { id: 'tc-2-1', name: '头颅', nameEn: 'Brain', parentId: 'tc-2', childrenIds: [], icon: '', order: 1 },
  { id: 'tc-2-2', name: '脊柱', nameEn: 'Spine', parentId: 'tc-2', childrenIds: [], icon: '', order: 2 },
  { id: 'tc-3', name: 'DR/CR', nameEn: 'X-Ray', childrenIds: [], icon: '', order: 3 },
  { id: 'tc-4', name: 'MG(乳腺)', nameEn: 'Mammography', childrenIds: [], icon: '', order: 4 },
  { id: 'tc-5', name: 'US(超声)', nameEn: 'Ultrasound', childrenIds: [], icon: '', order: 5 },
];

// ============================================================
// 15. 草稿
// ============================================================
export const REPORT_DRAFTS_MOCK: ReportDraft[] = [
  { id: 'draft-1', reportId: 'rpt-038', authorId: 'u-001', authorName: '陈医师', content: '右肺上叶...', html: '<p>右肺上叶...</p>', structured: {}, wordCount: 245, version: 7, versionLabel: 'v7', createdAt: '2026-09-15T10:30:00Z', updatedAt: '2026-09-15T11:00:00Z', autoSaved: true, conflict: false, tags: ['当前'] },
  { id: 'draft-2', reportId: 'rpt-038', authorId: 'u-001', authorName: '陈医师', content: '右肺上叶尖段...', html: '<p>右肺上叶尖段...</p>', structured: {}, wordCount: 198, version: 6, versionLabel: 'v6', createdAt: '2026-09-15T10:00:00Z', updatedAt: '2026-09-15T10:25:00Z', autoSaved: true, conflict: false, tags: ['历史'] },
  { id: 'draft-3', reportId: 'rpt-038', authorId: 'u-001', authorName: '陈医师', content: '胸部 CT...', html: '<p>胸部 CT...</p>', structured: {}, wordCount: 156, version: 5, versionLabel: 'v5', createdAt: '2026-09-15T09:00:00Z', updatedAt: '2026-09-15T09:55:00Z', autoSaved: false, conflict: false, tags: ['历史'] },
];

// ============================================================
// 16. 书写度量 / 预评分
// ============================================================
export const WRITING_METRICS_MOCK: WritingMetrics = {
  reportId: 'rpt-038',
  startAt: '2026-09-15T10:30:00Z',
  durationSec: 1845,
  pauseCount: 3,
  pauseTotalSec: 95,
  longestPauseSec: 45,
  keystrokeCount: 1850,
  voiceWordsCount: 78,
  typedWordsCount: 167,
  phrasesUsed: 12,
  imagesInserted: 3,
  pagesGenerated: 2,
  speedWordsPerMin: 25.4,
  pagePerformanceMs: 280,
};

export const PRE_SUBMIT_SCORE_MOCK: PreSubmitScore = {
  reportId: 'rpt-038',
  score: 88,
  dimensions: [
    { name: '完整性', nameEn: 'Completeness', score: 92, weight: 0.25 },
    { name: '规范性', nameEn: 'Standardization', score: 90, weight: 0.20 },
    { name: '准确性', nameEn: 'Accuracy', score: 85, weight: 0.25 },
    { name: '及时性', nameEn: 'Timeliness', score: 88, weight: 0.10 },
    { name: '术语规范', nameEn: 'Terminology', score: 86, weight: 0.15 },
    { name: '危急值标注', nameEn: 'Critical Annotation', score: 80, weight: 0.05 },
  ],
  checklist: [
    { id: 'cl-1', label: '患者信息完整', labelEn: 'Patient info complete', passed: true, weight: 0.10 },
    { id: 'cl-2', label: '检查技术描述', labelEn: 'Technique described', passed: true, weight: 0.10 },
    { id: 'cl-3', label: '影像所见完整', labelEn: 'Findings complete', passed: true, weight: 0.20 },
    { id: 'cl-4', label: '诊断意见明确', labelEn: 'Impression clear', passed: true, weight: 0.20 },
    { id: 'cl-5', label: '建议合理', labelEn: 'Recommendation reasonable', passed: true, weight: 0.10 },
    { id: 'cl-6', label: '关键图像标注', labelEn: 'Key image annotated', passed: true, weight: 0.10 },
    { id: 'cl-7', label: '危急值标注', labelEn: 'Critical annotated', passed: false, weight: 0.10 },
    { id: 'cl-8', label: '术语规范', labelEn: 'Terminology', passed: true, weight: 0.10 },
  ],
  aiPreReview: { score: 86, issues: ['建议补充"胸膜牵拉征"细节描述', '"周围型肺癌"诊断应注明病理类型待定'], passed: true },
  termCheck: { checked: 156, issues: ['"肺癌"建议加注"待病理证实"'] },
  requiredFieldsFilled: true,
  criticalValuesAnnotated: false,
  passed: false,
  createdAt: '2026-09-15T11:05:00Z',
};

// ============================================================
// 17. 多模态 / 关键字高亮
// ============================================================
export const MULTI_MODALITY_MOCK: MultiModalityPanel = {
  id: 'mmp-1',
  reportId: 'rpt-038',
  modalities: [
    { modality: 'CT', studyUID: '1.2.840.10008.5.1.4.1.1.2.1.1', seriesCount: 3, thumbnail: '/mock/ct-thumb.png' },
    { modality: 'MR', studyUID: '1.2.840.10008.5.1.4.1.1.4.1.1', seriesCount: 5, thumbnail: '/mock/mr-thumb.png' },
    { modality: 'PET-CT', studyUID: '1.2.840.10008.5.1.4.1.1.128.1.1', seriesCount: 2, thumbnail: '/mock/pet-thumb.png' },
  ],
  activeModality: 'CT',
  crossFindings: [
    { id: 'cf-1', label: '右肺上叶病灶', labelEn: 'RUL Lesion', matchedAcrossModalities: ['CT', 'MR', 'PET-CT'], mergedText: '右肺上叶尖段不规则形软组织密度结节,CT 平扫约 32HU,MR T2W 呈稍高信号,DWI 明显弥散受限,PET-CT 显像示 FDG 代谢增高(SUVmax=6.8)。', confidence: 0.94 },
  ],
  syncScroll: true,
  diffHighlights: [
    { modality: 'CT', color: 'var(--color-info-600)', notes: '肺窗-600/1500 观察最佳' },
    { modality: 'MR', color: '#7c3aed', notes: 'T2W + DWI 综合评估' },
    { modality: 'PET-CT', color: 'var(--color-error-600)', notes: '代谢评估' },
  ],
};

export const KEYWORD_HIGHLIGHTS_MOCK: KeywordHighlight[] = [
  { term: '结节', termEn: 'Nodule', category: 'finding', color: 'var(--color-error-600)', bg: '#fee2e2', weight: 5 },
  { term: '毛刺征', termEn: 'Spiculation', category: 'finding', color: 'var(--color-error-600)', bg: '#fee2e2', weight: 5 },
  { term: '强化', termEn: 'Enhancement', category: 'finding', color: 'var(--color-primary-500)', bg: '#dbeafe', weight: 4 },
  { term: '胸腔积液', termEn: 'Pleural Effusion', category: 'finding', color: 'var(--color-primary-500)', bg: '#dbeafe', weight: 4 },
  { term: '淋巴结肿大', termEn: 'Lymphadenopathy', category: 'finding', color: '#ea580c', bg: '#fed7aa', weight: 5 },
  { term: '肺癌', termEn: 'Lung Cancer', category: 'diagnosis', color: 'var(--color-error-600)', bg: '#fee2e2', weight: 6 },
  { term: '建议活检', termEn: 'Biopsy Recommended', category: 'recommendation', color: 'var(--color-info-600)', bg: '#cffafe', weight: 4 },
  { term: '危急值', termEn: 'Critical Value', category: 'critical', color: 'var(--color-error-600)', bg: '#fee2e2', weight: 6 },
  { term: '主动脉', termEn: 'Aorta', category: 'anatomy', color: '#6b7280', bg: '#f3f4f6', weight: 2 },
  { term: '肺动脉', termEn: 'Pulmonary Artery', category: 'anatomy', color: '#6b7280', bg: '#f3f4f6', weight: 2 },
];

// ============================================================
// 18. 主聚合(报告 ID = rpt-038 示例)
// ============================================================
export const REPORT_WRITING_CONTEXT_MOCK: ReportWritingContext = {
  reportId: 'rpt-038',
  patientId: 'p-038',
  modality: 'CT',
  bodyPart: '胸部',
  template: RECIST_TEMPLATE,
  fields: {
    baselineDate: '2026-06-15',
    lesionCount: 5,
    measurementMethod: 'CT',
    lesion1Site: '右肺上叶(尖段)',
    lesion1Long: 18,
    lesion1Baseline: 28,
    lesion2Site: '右肺中叶(外侧段)',
    lesion2Long: 12,
    lesion2Baseline: 18,
    lesion3Site: '左肺下叶(背段)',
    lesion3Long: 9,
    lesion3Baseline: 14,
    lesion4Site: '纵隔淋巴结(2R)',
    lesion4Long: 15,
    lesion4Baseline: 22,
    lesion5Site: '肝右叶(S6)',
    lesion5Long: 22,
    lesion5Baseline: 35,
    nonTargetLesions: true,
    newLesion: false,
    sumOfDiameters: 76,
    baselineSum: 117,
    percentChange: -35.0,
    responseCategory: 'PR',
    treatmentLine: '2L',
    assessor: '陈医师',
  },
  recist: RECIST_RESPONSE,
  document: RICH_DOCUMENT_MOCK,
  aiDraft: AI_DRAFT_RESULT,
  voice: VOICE_DICTATION_MOCK,
  anchors: IMAGE_ANCHORS_MOCK,
  phrases: PHRASES_MOCK,
  priorReports: PRIOR_REPORTS_MOCK,
  similarCases: SIMILAR_CASES_MOCK,
  drafts: REPORT_DRAFTS_MOCK,
  metrics: WRITING_METRICS_MOCK,
  preSubmitScore: PRE_SUBMIT_SCORE_MOCK,
  multiModality: MULTI_MODALITY_MOCK,
  keywords: KEYWORD_HIGHLIGHTS_MOCK,
};

// ============================================================
// 20. AI 置信度映射
// ============================================================
export const AI_CONFIDENCE_MOCK: Record<string, { threshold: number; color: string; label: string }> = {
  high: { threshold: 0.85, color: '#10b981', label: '高置信度' },
  medium: { threshold: 0.65, color: 'var(--color-warning-500)', label: '中置信度' },
  low: { threshold: 0.0, color: 'var(--color-error-600)', label: '低置信度' },
};

// ============================================================
// 21. AI 模型列表
// ============================================================
export const AI_MODELS_MOCK: Array<{ id: string; name: string; version: string; accuracy: number; vendor: string }> = [
  { id: 'model-1', name: 'G005-MedAI 肺结节检测', version: 'v3.2.1', accuracy: 0.942, vendor: 'G005 AI Lab' },
  { id: 'model-2', name: 'G005-MedAI 骨折检测', version: 'v2.8.0', accuracy: 0.915, vendor: 'G005 AI Lab' },
  { id: 'model-3', name: 'G005-MedAI 脑出血检测', version: 'v4.0.2', accuracy: 0.963, vendor: 'G005 AI Lab' },
  { id: 'model-4', name: 'InferRead CT Lung', version: 'v2.5.0', accuracy: 0.926, vendor: 'InferVision' },
  { id: 'model-5', name: 'uAI Intelligent Assistant', version: 'v1.9.3', accuracy: 0.908, vendor: 'United Imaging' },
];

// ============================================================
// 22. 标注颜色映射
// ============================================================
export const ANNOTATION_COLORS_MOCK: Record<string, string> = {
  finding: 'var(--color-error-600)',
  measurement: 'var(--color-primary-500)',
  normal: '#10b981',
  critical: 'var(--color-error-500)',
  anatomy: '#8b5cf6',
  comparison: 'var(--color-warning-500)',
  question: '#ec4899',
  reference: 'var(--color-info-500)',
};

// ============================================================
// 23. 标注工具
// ============================================================
export const ANNOTATION_TOOLS_MOCK: Array<{ id: string; name: string; icon: string; description: string }> = [
  { id: 'arrow', name: '箭头标注', icon: 'arrow-forward', description: '指向病灶或关键结构' },
  { id: 'circle', name: '圆形标注', icon: 'radio-button-unchecked', description: '圈出病灶区域' },
  { id: 'rectangle', name: '矩形标注', icon: 'crop-square', description: '矩形区域标注' },
  { id: 'line', name: '测量线', icon: 'straighten', description: '长度或距离测量' },
  { id: 'angle', name: '角度测量', icon: 'angle', description: '角度测量工具' },
  { id: 'text', name: '文本标注', icon: 'text-fields', description: '自由文本注释' },
  { id: 'freehand', name: '自由绘制', icon: 'gesture', description: '手绘不规则区域' },
  { id: 'ruler', name: '比例尺', icon: 'ruler', description: '比例尺校准' },
  { id: 'magnifier', name: '放大镜', icon: 'zoom-in', description: '局部放大观察' },
  { id: 'crosshair', name: '十字定位', icon: 'my-location', description: '交叉定位参考点' },
  { id: 'erase', name: '擦除', icon: 'auto-fix-normal', description: '擦除已标注内容' },
];

// ============================================================
// 24. 自动保存历史
// ============================================================
export const AUTO_SAVE_HISTORY_MOCK: Array<{ timestamp: string; version: number; wordCount: number; changeSummary: string }> = [
  { timestamp: '2026-09-15T11:00:00Z', version: 7, wordCount: 248, changeSummary: '完善诊断意见及建议' },
  { timestamp: '2026-09-15T10:50:00Z', version: 6, wordCount: 230, changeSummary: '补充增强描述及CT值数据' },
  { timestamp: '2026-09-15T10:40:00Z', version: 5, wordCount: 198, changeSummary: '添加影像所见详细描述' },
  { timestamp: '2026-09-15T10:30:00Z', version: 4, wordCount: 156, changeSummary: '调整结节大小测量数据' },
  { timestamp: '2026-09-15T10:20:00Z', version: 3, wordCount: 142, changeSummary: '导入AI草稿并修改' },
  { timestamp: '2026-09-15T10:10:00Z', version: 2, wordCount: 120, changeSummary: '填写患者基本信息' },
  { timestamp: '2026-09-15T10:00:00Z', version: 1, wordCount: 85, changeSummary: '新建报告，插入模板' },
  { timestamp: '2026-09-14T16:30:00Z', version: 0, wordCount: 0, changeSummary: '创建草稿文档' },
  { timestamp: '2026-09-16T08:15:00Z', version: 8, wordCount: 275, changeSummary: '根据审核意见修改诊断表述' },
  { timestamp: '2026-09-16T09:00:00Z', version: 9, wordCount: 280, changeSummary: '最终审核通过并签发' },
];

// ============================================================
// 25. 身体部位字典
// ============================================================
export const BODY_PARTS_MOCK: Array<{ id: string; name: string; english: string; system: string }> = [
  { id: 'bp-1', name: '颅脑', english: 'Brain', system: '神经系统' },
  { id: 'bp-2', name: '眼眶', english: 'Orbit', system: '头颈部' },
  { id: 'bp-3', name: '鼻窦', english: 'Sinuses', system: '头颈部' },
  { id: 'bp-4', name: '颈椎', english: 'Cervical Spine', system: '脊柱' },
  { id: 'bp-5', name: '胸椎', english: 'Thoracic Spine', system: '脊柱' },
  { id: 'bp-6', name: '腰椎', english: 'Lumbar Spine', system: '脊柱' },
  { id: 'bp-7', name: '胸部', english: 'Chest', system: '呼吸系统' },
  { id: 'bp-8', name: '心脏', english: 'Heart', system: '循环系统' },
  { id: 'bp-9', name: '乳腺', english: 'Breast', system: '生殖系统' },
  { id: 'bp-10', name: '上腹部', english: 'Upper Abdomen', system: '消化系统' },
  { id: 'bp-11', name: '肝脏', english: 'Liver', system: '消化系统' },
  { id: 'bp-12', name: '胆囊', english: 'Gallbladder', system: '消化系统' },
  { id: 'bp-13', name: '胰腺', english: 'Pancreas', system: '消化系统' },
  { id: 'bp-14', name: '脾脏', english: 'Spleen', system: '免疫系统' },
  { id: 'bp-15', name: '肾脏', english: 'Kidney', system: '泌尿系统' },
  { id: 'bp-16', name: '输尿管', english: 'Ureter', system: '泌尿系统' },
  { id: 'bp-17', name: '膀胱', english: 'Bladder', system: '泌尿系统' },
  { id: 'bp-18', name: '前列腺', english: 'Prostate', system: '男性生殖' },
  { id: 'bp-19', name: '子宫', english: 'Uterus', system: '女性生殖' },
  { id: 'bp-20', name: '卵巢', english: 'Ovary', system: '女性生殖' },
  { id: 'bp-21', name: '盆腔', english: 'Pelvis', system: '骨骼肌肉' },
  { id: 'bp-22', name: '髋关节', english: 'Hip Joint', system: '骨骼肌肉' },
  { id: 'bp-23', name: '膝关节', english: 'Knee Joint', system: '骨骼肌肉' },
  { id: 'bp-24', name: '踝关节', english: 'Ankle Joint', system: '骨骼肌肉' },
  { id: 'bp-25', name: '四肢血管', english: 'Extremity Vessels', system: '循环系统' },
];

// ============================================================
// 26. C-RADS CT结肠成像模板
// ============================================================
const cRadsGroups: StructuredFieldGroup[] = [
  { id: 'crg1', label: '检查准备', labelEn: 'Preparation', order: 1, collapsible: false, defaultExpanded: true },
  { id: 'crg2', label: '息肉/病变特征', labelEn: 'Polyp Features', order: 2, collapsible: true, defaultExpanded: true },
  { id: 'crg3', label: 'C-RADS 分类', labelEn: 'C-RADS Category', order: 3, collapsible: false, defaultExpanded: true },
  { id: 'crg4', label: '建议', labelEn: 'Recommendation', order: 4, collapsible: false, defaultExpanded: true },
];

const cRadsFields: StructuredFieldDefinition[] = [
  { id: 'crf1', key: 'bowelPrep', label: '肠道准备质量', labelEn: 'Bowel Preparation', type: 'enum', required: true, group: 'crg1', options: [
    { value: 'excellent', label: '优秀', labelEn: 'Excellent' },
    { value: 'good', label: '良好', labelEn: 'Good' },
    { value: 'fair', label: '一般', labelEn: 'Fair' },
    { value: 'poor', label: '差', labelEn: 'Poor' },
  ], order: 1 },
  { id: 'crf2', key: 'distention', label: '结肠充气程度', labelEn: 'Colonic Distention', type: 'enum', required: true, group: 'crg1', options: [
    { value: 'adequate', label: '充分', labelEn: 'Adequate' },
    { value: 'suboptimal', label: '欠佳', labelEn: 'Suboptimal' },
    { value: 'collapsed', label: '塌陷', labelEn: 'Collapsed' },
  ], order: 2 },
  { id: 'crf3', key: 'polypCount', label: '息肉数量', labelEn: 'Polyp Count', type: 'number', required: true, group: 'crg2', min: 0, max: 50, defaultValue: 0, order: 3 },
  { id: 'crf4', key: 'largestPolypSize', label: '最大息肉直径(mm)', labelEn: 'Largest Polyp Size', type: 'number', required: false, group: 'crg2', min: 0, max: 100, unit: 'mm', order: 4 },
  { id: 'crf5', key: 'polyp1Size', label: '息肉 1 直径(mm)', labelEn: 'Polyp 1 Size', type: 'number', required: false, group: 'crg2', min: 0, max: 100, unit: 'mm', order: 5 },
  { id: 'crf6', key: 'polyp1Morphology', label: '息肉 1 形态', labelEn: 'Polyp 1 Morphology', type: 'enum', required: false, group: 'crg2', options: [
    { value: 'sessile', label: '无蒂', labelEn: 'Sessile' },
    { value: 'pedunculated', label: '有蒂', labelEn: 'Pedunculated' },
    { value: 'flat', label: '平坦', labelEn: 'Flat' },
  ], order: 6 },
  { id: 'crf7', key: 'polyp1Location', label: '息肉 1 位置', labelEn: 'Polyp 1 Location', type: 'enum', required: false, group: 'crg2', options: [
    { value: 'cecum', label: '盲肠', labelEn: 'Cecum' },
    { value: 'ascending', label: '升结肠', labelEn: 'Ascending' },
    { value: 'transverse', label: '横结肠', labelEn: 'Transverse' },
    { value: 'descending', label: '降结肠', labelEn: 'Descending' },
    { value: 'sigmoid', label: '乙状结肠', labelEn: 'Sigmoid' },
    { value: 'rectum', label: '直肠', labelEn: 'Rectum' },
  ], order: 7 },
  { id: 'crf8', key: 'wallThickening', label: '肠壁增厚', labelEn: 'Wall Thickening', type: 'boolean', required: true, group: 'crg2', defaultValue: false, order: 8 },
  { id: 'crf9', key: 'extracolicFindings', label: '结肠外发现', labelEn: 'Extracolic Findings', type: 'text', required: false, group: 'crg2', order: 9 },
  { id: 'crf10', key: 'cRadsCategory', label: 'C-RADS 分类', labelEn: 'C-RADS Category', type: 'enum', required: true, group: 'crg3', options: [
    { value: 'C0', label: 'C0 - 评估不充分', labelEn: 'C0 - Inadequate', color: '#9ca3af' },
    { value: 'C1', label: 'C1 - 正常/良性', labelEn: 'C1 - Normal/Benign', color: '#10b981' },
    { value: 'C2', label: 'C2 - 不确定', labelEn: 'C2 - Indeterminate', color: 'var(--color-warning-500)' },
    { value: 'C3', label: 'C3 - 可疑', labelEn: 'C3 - Suspicious', color: '#fb923c' },
    { value: 'C4', label: 'C4 - 高度可疑', labelEn: 'C4 - Highly Suspicious', color: 'var(--color-error-600)' },
  ], defaultValue: 'C1', order: 10 },
  { id: 'crf11', key: 'polyp1Segment', label: '息肉 1 肠段', labelEn: 'Polyp 1 Segment', type: 'text', required: false, group: 'crg2', order: 101 },
  { id: 'crf12', key: 'polyp2Size', label: '息肉 2 直径(mm)', labelEn: 'Polyp 2 Size', type: 'number', required: false, group: 'crg2', min: 0, max: 100, unit: 'mm', order: 102 },
  { id: 'crf13', key: 'polyp2Morphology', label: '息肉 2 形态', labelEn: 'Polyp 2 Morphology', type: 'enum', required: false, group: 'crg2', options: [
    { value: 'sessile', label: '无蒂', labelEn: 'Sessile' },
    { value: 'pedunculated', label: '有蒂', labelEn: 'Pedunculated' },
    { value: 'flat', label: '平坦', labelEn: 'Flat' },
  ], order: 103 },
  { id: 'crf14', key: 'cRadsManagement', label: 'C-RADS 管理建议', labelEn: 'C-RADS Management', type: 'text', required: true, group: 'crg4', order: 104, fillGuide: '根据C-RADS分类给出结肠镜随访或治疗建议' },
  { id: 'crf15', key: 'imageUploadCr', label: '关键图像', labelEn: 'Key Image', type: 'image', required: false, group: 'crg4', order: 105 },
];

export const C_RADS_TEMPLATE: StructuredTemplate = {
  id: 'cRads',
  name: 'C-RADS CT结肠成像',
  nameEn: 'C-RADS CT Colonography',
  modality: 'CT',
  bodyPart: '腹部',
  version: '1.0.2',
  fields: cRadsFields,
  groups: cRadsGroups,
  createdAt: '2026-05-20T08:00:00Z',
  updatedAt: '2026-09-10T10:00:00Z',
  author: 'G005 腹部组',
  score: 4.5,
  tags: ['结肠', 'C-RADS', 'CTC', '息肉'],
  inheritable: true,
  approved: true,
  approver: '赵主任',
};

// ============================================================
// 27. CAD-RADS 2.0 模板
// ============================================================
const cadRadsGroups: StructuredFieldGroup[] = [
  { id: 'cadg1', label: '患者信息', labelEn: 'Patient Info', order: 1, collapsible: false, defaultExpanded: true },
  { id: 'cadg2', label: '冠脉节段评估', labelEn: 'Segment Assessment', order: 2, collapsible: true, defaultExpanded: true },
  { id: 'cadg3', label: 'CAD-RADS 分类', labelEn: 'CAD-RADS Category', order: 3, collapsible: false, defaultExpanded: true },
  { id: 'cadg4', label: '修饰符与建议', labelEn: 'Modifier & Management', order: 4, collapsible: false, defaultExpanded: true },
];

const cadRadsFields: StructuredFieldDefinition[] = [
  { id: 'cadf1', key: 'heartRate', label: '检查心率(次/分)', labelEn: 'Heart Rate (bpm)', type: 'number', required: true, group: 'cadg1', min: 30, max: 150, unit: 'bpm', order: 1 },
  { id: 'cadf2', key: 'calciumScore', label: '冠脉钙化积分', labelEn: 'Calcium Score (Agatston)', type: 'number', required: false, group: 'cadg1', min: 0, max: 5000, defaultValue: 0, order: 2 },
  { id: 'cadf3', key: 'contrastQuality', label: '对比剂充盈质量', labelEn: 'Contrast Quality', type: 'enum', required: true, group: 'cadg1', options: [
    { value: 'excellent', label: '优秀', labelEn: 'Excellent' },
    { value: 'good', label: '良好', labelEn: 'Good' },
    { value: 'fair', label: '一般', labelEn: 'Fair' },
    { value: 'poor', label: '差', labelEn: 'Poor' },
  ], order: 3 },
  { id: 'cadf4', key: 'lmStenosis', label: '左主干(LM)狭窄%', labelEn: 'LM Stenosis %', type: 'number', required: true, group: 'cadg2', min: 0, max: 100, unit: '%', defaultValue: 0, order: 4 },
  { id: 'cadf5', key: 'ladStenosis', label: '前降支(LAD)狭窄%', labelEn: 'LAD Stenosis %', type: 'number', required: true, group: 'cadg2', min: 0, max: 100, unit: '%', defaultValue: 0, order: 5 },
  { id: 'cadf6', key: 'lcxStenosis', label: '回旋支(LCX)狭窄%', labelEn: 'LCX Stenosis %', type: 'number', required: true, group: 'cadg2', min: 0, max: 100, unit: '%', defaultValue: 0, order: 6 },
  { id: 'cadf7', key: 'rcaStenosis', label: '右冠(RCA)狭窄%', labelEn: 'RCA Stenosis %', type: 'number', required: true, group: 'cadg2', min: 0, max: 100, unit: '%', defaultValue: 0, order: 7 },
  { id: 'cadf8', key: 'plaqueComposition', label: '斑块性质', labelEn: 'Plaque Composition', type: 'multi-enum', required: true, group: 'cadg2', options: [
    { value: 'calcified', label: '钙化斑块', labelEn: 'Calcified' },
    { value: 'noncalcified', label: '非钙化斑块', labelEn: 'Non-Calcified' },
    { value: 'mixed', label: '混合斑块', labelEn: 'Mixed' },
    { value: 'lowAttenuation', label: '低衰减斑块', labelEn: 'Low Attenuation' },
  ], order: 8 },
  { id: 'cadf9', key: 'highRiskPlaque', label: '高危斑块特征', labelEn: 'High-Risk Plaque', type: 'boolean', required: true, group: 'cadg2', defaultValue: false, order: 9 },
  { id: 'cadf10', key: 'positiveRemodeling', label: '正性重构', labelEn: 'Positive Remodeling', type: 'boolean', required: false, group: 'cadg2', defaultValue: false, order: 10 },
  { id: 'cadf11', key: 'napkinRing', label: '餐巾环征', labelEn: 'Napkin-Ring Sign', type: 'boolean', required: false, group: 'cadg2', defaultValue: false, order: 11 },
  { id: 'cadf12', key: 'spottyCalcification', label: '点状钙化', labelEn: 'Spotty Calcification', type: 'boolean', required: false, group: 'cadg2', defaultValue: false, order: 12 },
  { id: 'cadf13', key: 'maxStenosis', label: '最重狭窄血管', labelEn: 'Max Stenosis Vessel', type: 'enum', required: true, group: 'cadg2', options: [
    { value: 'LM', label: '左主干', labelEn: 'LM' },
    { value: 'LAD', label: '前降支', labelEn: 'LAD' },
    { value: 'LCX', label: '回旋支', labelEn: 'LCX' },
    { value: 'RCA', label: '右冠脉', labelEn: 'RCA' },
    { value: 'none', label: '无明显狭窄', labelEn: 'None' },
  ], order: 13 },
  { id: 'cadf14', key: 'maxStenosisPercent', label: '最重狭窄程度%', labelEn: 'Max Stenosis %', type: 'number', required: true, group: 'cadg2', min: 0, max: 100, unit: '%', defaultValue: 0, order: 14 },
  { id: 'cadf15', key: 'cadRadsCategory', label: 'CAD-RADS 分类', labelEn: 'CAD-RADS Category', type: 'enum', required: true, group: 'cadg3', options: [
    { value: '0', label: 'CAD-RADS 0 - 无狭窄', labelEn: '0 - No Stenosis', color: '#10b981' },
    { value: '1', label: 'CAD-RADS 1 - 1-24%', labelEn: '1 - 1-24%', color: '#34d399' },
    { value: '2', label: 'CAD-RADS 2 - 25-49%', labelEn: '2 - 25-49%', color: 'var(--color-warning-500)' },
    { value: '3', label: 'CAD-RADS 3 - 50-69%', labelEn: '3 - 50-69%', color: '#fb923c' },
    { value: '4A', label: 'CAD-RADS 4A - 70-99% LM/LAD', labelEn: '4A - 70-99% LM/LAD', color: '#ea580c' },
    { value: '4B', label: 'CAD-RADS 4B - 70-99% 其他', labelEn: '4B - 70-99% Other', color: 'var(--color-error-600)' },
    { value: '5', label: 'CAD-RADS 5 - 100% 闭塞', labelEn: '5 - 100% Occlusion', color: '#7f1d1d' },
    { value: 'N', label: 'CAD-RADS N - 不可评估', labelEn: 'N - Non-Diagnostic', color: '#9ca3af' },
  ], defaultValue: '0', order: 15 },
  { id: 'cadf16', key: 'cadRadsModifier', label: 'CAD-RADS 修饰符', labelEn: 'CAD-RADS Modifier', type: 'multi-enum', required: false, group: 'cadg3', options: [
    { value: 'N', label: 'N - 非钙化斑块', labelEn: 'N - Non-Calcified' },
    { value: 'P', label: 'P - 混合斑块', labelEn: 'P - Mixed Plaque' },
    { value: 'G', label: 'G - 移植物', labelEn: 'G - Graft' },
    { value: 'HR', label: 'HR - 高危斑块', labelEn: 'HR - High Risk' },
  ], order: 16 },
  { id: 'cadf17', key: 'segmentsWithPlaque', label: '含斑块节段数', labelEn: 'Segments with Plaque', type: 'number', required: false, group: 'cadg2', min: 0, max: 18, order: 101 },
  { id: 'cadf18', key: 'diagonalStenosis', label: '对角支狭窄%', labelEn: 'Diagonal Stenosis %', type: 'number', required: false, group: 'cadg2', min: 0, max: 100, unit: '%', order: 102 },
  { id: 'cadf19', key: 'marginalStenosis', label: '钝缘支狭窄%', labelEn: 'Marginal Stenosis %', type: 'number', required: false, group: 'cadg2', min: 0, max: 100, unit: '%', order: 103 },
  { id: 'cadf20', key: 'pdaStenosis', label: '后降支狭窄%', labelEn: 'PDA Stenosis %', type: 'number', required: false, group: 'cadg2', min: 0, max: 100, unit: '%', order: 104 },
  { id: 'cadf21', key: 'stentPresent', label: '支架植入', labelEn: 'Stent Present', type: 'boolean', required: true, group: 'cadg2', defaultValue: false, order: 105 },
  { id: 'cadf22', key: 'bypassGraft', label: '搭桥血管', labelEn: 'Bypass Graft', type: 'boolean', required: true, group: 'cadg2', defaultValue: false, order: 106 },
  { id: 'cadf23', key: 'cadRadsManagement', label: '管理建议', labelEn: 'Management', type: 'text', required: true, group: 'cadg4', order: 107, fillGuide: '根据CAD-RADS 2.0版管理路径,结合临床症状给出建议' },
  { id: 'cadf24', key: 'imageUploadCad', label: '关键图像', labelEn: 'Key Image', type: 'image', required: false, group: 'cadg4', order: 108 },
  { id: 'cadf25', key: 'cadRadsAssessor', label: '评估医师', labelEn: 'Assessor', type: 'text', required: true, group: 'cadg4', order: 109 },
];

export const CAD_RADS_TEMPLATE: StructuredTemplate = {
  id: 'cadRads',
  name: 'CAD-RADS 2.0 冠脉CTA评估',
  nameEn: 'CAD-RADS 2.0 Coronary CTA',
  modality: 'CT',
  bodyPart: '心脏',
  version: '2.0.1',
  fields: cadRadsFields,
  groups: cadRadsGroups,
  createdAt: '2026-04-10T08:00:00Z',
  updatedAt: '2026-09-15T10:00:00Z',
  author: 'G005 心血管组',
  score: 4.8,
  tags: ['冠脉', 'CTA', 'CAD-RADS', '心脏'],
  inheritable: true,
  approved: true,
  approver: '钱主任',
};

// ============================================================
// 28. 收费代码(CPT)
// ============================================================
export const CHARGE_CODES_MOCK: ChargeItem[] = [
  { id: 'cc-1', code: '71250', system: 'cpt', description: '胸部CT平扫', descriptionEn: 'CT Chest without contrast', fee: 380, modality: ['CT'], keywords: ['胸部', 'CT', '平扫'] },
  { id: 'cc-2', code: '71260', system: 'cpt', description: '胸部CT增强扫描', descriptionEn: 'CT Chest with contrast', fee: 680, modality: ['CT'], keywords: ['胸部', 'CT', '增强'] },
  { id: 'cc-3', code: '71275', system: 'cpt', description: '胸部CTA(含肺动脉)', descriptionEn: 'CT Chest Angiography', fee: 980, modality: ['CT'], keywords: ['CTA', '肺动脉', '胸部'] },
  { id: 'cc-4', code: '74176', system: 'cpt', description: '腹部CT平扫', descriptionEn: 'CT Abdomen without contrast', fee: 420, modality: ['CT'], keywords: ['腹部', 'CT', '平扫'] },
  { id: 'cc-5', code: '74177', system: 'cpt', description: '腹部CT增强扫描', descriptionEn: 'CT Abdomen with contrast', fee: 720, modality: ['CT'], keywords: ['腹部', 'CT', '增强'] },
  { id: 'cc-6', code: '70450', system: 'cpt', description: '颅脑CT平扫', descriptionEn: 'CT Head without contrast', fee: 340, modality: ['CT'], keywords: ['颅脑', 'CT', '平扫'] },
  { id: 'cc-7', code: '70460', system: 'cpt', description: '颅脑CT增强扫描', descriptionEn: 'CT Head with contrast', fee: 640, modality: ['CT'], keywords: ['颅脑', 'CT', '增强'] },
  { id: 'cc-8', code: '72125', system: 'cpt', description: '颈椎CT平扫', descriptionEn: 'CT Cervical Spine without contrast', fee: 360, modality: ['CT'], keywords: ['颈椎', 'CT', '平扫'] },
  { id: 'cc-9', code: '72128', system: 'cpt', description: '胸椎CT平扫', descriptionEn: 'CT Thoracic Spine without contrast', fee: 360, modality: ['CT'], keywords: ['胸椎', 'CT', '平扫'] },
  { id: 'cc-10', code: '72131', system: 'cpt', description: '腰椎CT平扫', descriptionEn: 'CT Lumbar Spine without contrast', fee: 360, modality: ['CT'], keywords: ['腰椎', 'CT', '平扫'] },
  { id: 'cc-11', code: '74150', system: 'cpt', description: '上腹部CT平扫', descriptionEn: 'CT Upper Abdomen without contrast', fee: 380, modality: ['CT'], keywords: ['上腹部', 'CT', '平扫'] },
  { id: 'cc-12', code: '74160', system: 'cpt', description: '上腹部CT增强扫描', descriptionEn: 'CT Upper Abdomen with contrast', fee: 680, modality: ['CT'], keywords: ['上腹部', 'CT', '增强'] },
  { id: 'cc-13', code: '72192', system: 'cpt', description: '盆腔CT平扫', descriptionEn: 'CT Pelvis without contrast', fee: 400, modality: ['CT'], keywords: ['盆腔', 'CT', '平扫'] },
  { id: 'cc-14', code: '75574', system: 'cpt', description: '冠脉CTA(含钙化积分)', descriptionEn: 'CT Coronary Angio with Calcium Score', fee: 1280, modality: ['CT'], keywords: ['冠脉', 'CTA', '钙化积分'] },
  { id: 'cc-15', code: '75635', system: 'cpt', description: '腹主动脉CTA', descriptionEn: 'CT Angio Abdominal Aorta', fee: 1050, modality: ['CT'], keywords: ['腹主动脉', 'CTA'] },
  { id: 'cc-16', code: '73700', system: 'cpt', description: '四肢CTA', descriptionEn: 'CT Angio Extremity', fee: 980, modality: ['CT'], keywords: ['四肢', 'CTA'] },
  { id: 'cc-17', code: '77014', system: 'cpt', description: 'CT引导下穿刺定位', descriptionEn: 'CT Guidance for Biopsy', fee: 450, modality: ['CT'], keywords: ['引导', '穿刺', '定位'] },
  { id: 'cc-18', code: '70551', system: 'cpt', description: '颅脑MR平扫', descriptionEn: 'MRI Brain without contrast', fee: 620, modality: ['MR'], keywords: ['颅脑', 'MR', '平扫'] },
  { id: 'cc-19', code: '70552', system: 'cpt', description: '颅脑MR增强扫描', descriptionEn: 'MRI Brain with contrast', fee: 920, modality: ['MR'], keywords: ['颅脑', 'MR', '增强'] },
  { id: 'cc-20', code: '73721', system: 'cpt', description: '膝关节MR平扫', descriptionEn: 'MRI Knee without contrast', fee: 580, modality: ['MR'], keywords: ['膝关节', 'MR', '平扫'] },
  { id: 'cc-21', code: '73722', system: 'cpt', description: '膝关节MR增强扫描', descriptionEn: 'MRI Knee with contrast', fee: 880, modality: ['MR'], keywords: ['膝关节', 'MR', '增强'] },
  { id: 'cc-22', code: '74183', system: 'cpt', description: '腹部MR增强扫描', descriptionEn: 'MRI Abdomen with contrast', fee: 1050, modality: ['MR'], keywords: ['腹部', 'MR', '增强'] },
  { id: 'cc-23', code: '72141', system: 'cpt', description: '颈椎MR平扫', descriptionEn: 'MRI Cervical Spine without contrast', fee: 660, modality: ['MR'], keywords: ['颈椎', 'MR', '平扫'] },
  { id: 'cc-24', code: '72148', system: 'cpt', description: '腰椎MR平扫', descriptionEn: 'MRI Lumbar Spine without contrast', fee: 660, modality: ['MR'], keywords: ['腰椎', 'MR', '平扫'] },
  { id: 'cc-25', code: '72156', system: 'cpt', description: '胸椎MR平扫', descriptionEn: 'MRI Thoracic Spine without contrast', fee: 660, modality: ['MR'], keywords: ['胸椎', 'MR', '平扫'] },
  { id: 'cc-26', code: '73718', system: 'cpt', description: '下肢MR血管成像', descriptionEn: 'MR Angio Lower Extremity', fee: 1100, modality: ['MR'], keywords: ['下肢', 'MRA'] },
  { id: 'cc-27', code: '77021', system: 'cpt', description: 'MR引导下穿刺定位', descriptionEn: 'MR Guidance for Biopsy', fee: 650, modality: ['MR'], keywords: ['引导', '穿刺', '定位'] },
  { id: 'cc-28', code: '77057', system: 'cpt', description: '乳腺钼靶双侧', descriptionEn: 'Mammography Bilateral', fee: 320, modality: ['MG'], keywords: ['乳腺', '钼靶', '筛查'] },
  { id: 'cc-29', code: '77066', system: 'cpt', description: '乳腺钼靶诊断性双侧', descriptionEn: 'Diagnostic Mammography Bilateral', fee: 420, modality: ['MG'], keywords: ['乳腺', '钼靶', '诊断'] },
  { id: 'cc-30', code: '71045', system: 'cpt', description: '胸部X线正位', descriptionEn: 'X-Ray Chest 1 View', fee: 100, modality: ['DR'], keywords: ['胸部', 'X线'] },
  { id: 'cc-31', code: '71046', system: 'cpt', description: '胸部X线正侧位', descriptionEn: 'X-Ray Chest 2 Views', fee: 150, modality: ['DR'], keywords: ['胸部', 'X线'] },
  { id: 'cc-32', code: '72100', system: 'cpt', description: '腰椎X线正侧位', descriptionEn: 'X-Ray Lumbar Spine 2 Views', fee: 140, modality: ['DR'], keywords: ['腰椎', 'X线'] },
  { id: 'cc-33', code: '73560', system: 'cpt', description: '膝关节X线正侧位', descriptionEn: 'X-Ray Knee 2 Views', fee: 130, modality: ['DR'], keywords: ['膝关节', 'X线'] },
  { id: 'cc-34', code: '73080', system: 'cpt', description: '肘关节X线正侧位', descriptionEn: 'X-Ray Elbow 2 Views', fee: 110, modality: ['DR'], keywords: ['肘关节', 'X线'] },
  { id: 'cc-35', code: '72170', system: 'cpt', description: '骨盆X线正位', descriptionEn: 'X-Ray Pelvis AP', fee: 120, modality: ['DR'], keywords: ['骨盆', 'X线'] },
  { id: 'cc-36', code: '74018', system: 'cpt', description: '腹部X线正位', descriptionEn: 'X-Ray Abdomen AP', fee: 110, modality: ['DR'], keywords: ['腹部', 'X线'] },
  { id: 'cc-37', code: '76700', system: 'cpt', description: '腹部超声完整', descriptionEn: 'US Abdomen Complete', fee: 280, modality: ['US'], keywords: ['腹部', '超声'] },
  { id: 'cc-38', code: '76705', system: 'cpt', description: '腹部超声局限', descriptionEn: 'US Abdomen Limited', fee: 180, modality: ['US'], keywords: ['腹部', '超声', '局限'] },
  { id: 'cc-39', code: '76830', system: 'cpt', description: '经阴道超声', descriptionEn: 'US Transvaginal', fee: 260, modality: ['US'], keywords: ['阴道', '超声', '盆腔'] },
  { id: 'cc-40', code: '76856', system: 'cpt', description: '盆腔超声', descriptionEn: 'US Pelvis', fee: 240, modality: ['US'], keywords: ['盆腔', '超声'] },
  { id: 'cc-41', code: '93306', system: 'cpt', description: '超声心动图完整', descriptionEn: 'Echocardiography Complete', fee: 520, modality: ['US'], keywords: ['心脏', '超声', '心动图'] },
  { id: 'cc-42', code: '93975', system: 'cpt', description: '血管超声完整', descriptionEn: 'Vascular US Complete', fee: 360, modality: ['US'], keywords: ['血管', '超声'] },
  { id: 'cc-43', code: '93976', system: 'cpt', description: '血管超声局限', descriptionEn: 'Vascular US Limited', fee: 220, modality: ['US'], keywords: ['血管', '超声', '局限'] },
  { id: 'cc-44', code: '78811', system: 'cpt', description: 'PET-CT全身(局限)', descriptionEn: 'PET-CT Limited Area', fee: 3800, modality: ['PET-CT'], keywords: ['PET', '全身', '局限'] },
  { id: 'cc-45', code: '78813', system: 'cpt', description: 'PET-CT全身(全程)', descriptionEn: 'PET-CT Whole Body', fee: 5500, modality: ['PET-CT'], keywords: ['PET', '全身', '全程'] },
  { id: 'cc-46', code: '78815', system: 'cpt', description: 'PET-CT颅脑+全身', descriptionEn: 'PET-CT Brain + Whole Body', fee: 6200, modality: ['PET-CT'], keywords: ['PET', '颅脑', '全身'] },
  { id: 'cc-47', code: '78830', system: 'cpt', description: 'PET-CT心肌代谢显像', descriptionEn: 'PET-CT Myocardial Metabolism', fee: 4800, modality: ['PET-CT'], keywords: ['心肌', 'PET', '代谢'] },
  { id: 'cc-48', code: '77078', system: 'cpt', description: '骨密度测定DXA', descriptionEn: 'Bone Density DXA', fee: 200, modality: ['DXA'], keywords: ['骨密度', 'DXA'] },
  { id: 'cc-49', code: '93015', system: 'cpt', description: '运动负荷心电图', descriptionEn: 'Cardiovascular Stress Test', fee: 380, modality: ['US'], keywords: ['心脏', '负荷', '心电图'] },
  { id: 'cc-50', code: '74170', system: 'cpt', description: '下腹部CT增强扫描', descriptionEn: 'CT Lower Abdomen with contrast', fee: 680, modality: ['CT'], keywords: ['下腹部', 'CT', '增强'] },
];

// ============================================================
// 29. 协作者
// ============================================================
export const COLLABORATORS_MOCK: Collaborator[] = [
  { userId: 'u-001', name: '陈医师', role: '住院医师', status: '书写中', entered: '2026-09-15T10:30:00Z', lockedSections: ['影像所见'] },
  { userId: 'u-002', name: '王医师', role: '主治医师', status: '审核中', entered: '2026-09-16T08:00:00Z', lockedSections: ['诊断意见'] },
  { userId: 'u-003', name: '李医师', role: '副主任医师', status: '待审核', entered: '2026-09-16T09:00:00Z' },
  { userId: 'u-004', name: '赵医师', role: '主任医师', status: '已签发', entered: '2026-09-16T10:00:00Z' },
  { userId: 'u-005', name: '孙医师', role: '实习医师', status: '仅查看', entered: '2026-09-15T11:00:00Z' },
];

// ============================================================
// 30. 合规规则
// ============================================================
export const COMPLIANCE_RULES_MOCK: Array<{ id: string; category: string; description: string; severity: string }> = [
  { id: 'cr-1', category: 'patient-id', description: '患者ID必须与HIS系统一致', severity: 'error' },
  { id: 'cr-2', category: 'patient-name', description: '患者姓名必须含至少2个汉字', severity: 'error' },
  { id: 'cr-3', category: 'modality', description: '检查设备必须包含完整型号', severity: 'warning' },
  { id: 'cr-4', category: 'findings', description: '影像所见部分不得为空', severity: 'error' },
  { id: 'cr-5', category: 'impression', description: '诊断意见必须包含明确结论', severity: 'error' },
  { id: 'cr-6', category: 'recommendation', description: '建议需包含随访或治疗方案', severity: 'warning' },
  { id: 'cr-7', category: 'signature', description: '报告签发前必须完成电子签名', severity: 'error' },
  { id: 'cr-8', category: 'critical-value', description: '危急值必须标注并通知临床', severity: 'error' },
  { id: 'cr-9', category: 'template', description: '结构化报告必须选择模板', severity: 'warning' },
  { id: 'cr-10', category: 'terminology', description: '使用标准化影像术语(RSNA)', severity: 'warning' },
  { id: 'cr-11', category: 'birads', description: 'BI-RADS分类必须与描述一致', severity: 'error' },
  { id: 'cr-12', category: 'pirads', description: 'PI-RADS评分须注明序列依据', severity: 'warning' },
  { id: 'cr-13', category: 'recist', description: 'RECIST测量需标注基线日期', severity: 'warning' },
  { id: 'cr-14', category: 'dose', description: '辐射剂量必须在安全范围内', severity: 'error' },
  { id: 'cr-15', category: 'contrast', description: '对比剂使用须记录批号和剂量', severity: 'warning' },
  { id: 'cr-16', category: 'private-info', description: '报告不得包含患者联系方式', severity: 'error' },
  { id: 'cr-17', category: 'imaging', description: '关键图像必须与报告内容对应', severity: 'warning' },
  { id: 'cr-18', category: 'comparison', description: '比较性描述应注明既往检查日期', severity: 'warning' },
  { id: 'cr-19', category: 'tumor-marker', description: '肿瘤标志物须标注参考范围', severity: 'warning' },
  { id: 'cr-20', category: 'biopsy', description: '活检建议须注明穿刺路径', severity: 'warning' },
  { id: 'cr-21', category: 'follow-up', description: '随访建议须明确时间间隔', severity: 'warning' },
  { id: 'cr-22', category: 'staging', description: '肿瘤分期须注明所用标准(JACC)', severity: 'error' },
  { id: 'cr-23', category: 'laterality', description: '病灶侧别须明确标注(左/右)', severity: 'error' },
  { id: 'cr-24', category: 'units', description: '测量数据须标注单位(mm或cm)', severity: 'warning' },
  { id: 'cr-25', category: 'language', description: '报告语言应使用规范的医学术语', severity: 'warning' },
  { id: 'cr-26', category: 'multi-modality', description: '多模态融合报告须注明各模态对应关系', severity: 'warning' },
  { id: 'cr-27', category: 'ai-draft', description: 'AI草稿须明确标注"AI生成"字样', severity: 'error' },
  { id: 'cr-28', category: 'voice', description: '语音识别内容须人工校对', severity: 'warning' },
  { id: 'cr-29', category: 'amendment', description: '修订报告须保留原始记录', severity: 'error' },
  { id: 'cr-30', category: 'quality-score', description: '报告质量评分≥80方可提交', severity: 'error' },
];

// ============================================================
// 31. 危急值内置模式
// ============================================================
export const CRITICAL_PATTERNS_MOCK: CriticalPattern[] = [
  { id: 'cp-1', pattern: '主动脉直径 > 5cm', modality: ['CT', 'US'], severity: 'critical', riskLevel: 'high', label: '主动脉瘤', labelEn: 'Aortic Aneurysm' },
  { id: 'cp-2', pattern: '肺栓塞 RV/LV > 1.0', modality: ['CT'], severity: 'critical', riskLevel: 'high', label: '右心负荷增大', labelEn: 'Right Heart Strain' },
  { id: 'cp-3', pattern: '气胸 > 3cm', modality: ['CT', 'DR'], severity: 'critical', riskLevel: 'high', label: '大量气胸', labelEn: 'Large Pneumothorax' },
  { id: 'cp-4', pattern: '急性脑梗死 ASPECTS < 7', modality: ['CT', 'MR'], severity: 'critical', riskLevel: 'high', label: '大面积脑梗死', labelEn: 'Large Territory Infarct' },
  { id: 'cp-5', pattern: '颅内出血 > 30mL', modality: ['CT', 'MR'], severity: 'critical', riskLevel: 'high', label: '大量颅内出血', labelEn: 'Large ICH' },
  { id: 'cp-6', pattern: '急性主动脉夹层', modality: ['CT', 'MR'], severity: 'critical', riskLevel: 'high', label: '主动脉夹层', labelEn: 'Aortic Dissection' },
  { id: 'cp-7', pattern: '心包积液 > 2cm', modality: ['CT', 'US', 'MR'], severity: 'critical', riskLevel: 'high', label: '大量心包积液', labelEn: 'Large Pericardial Effusion' },
  { id: 'cp-8', pattern: '气腹(游离气体)', modality: ['CT', 'DR'], severity: 'critical', riskLevel: 'high', label: '消化道穿孔', labelEn: 'GI Perforation' },
  { id: 'cp-9', pattern: '肠梗阻 > 6cm', modality: ['CT', 'DR'], severity: 'critical', riskLevel: 'high', label: '急性肠梗阻', labelEn: 'Acute Bowel Obstruction' },
  { id: 'cp-10', pattern: '肺栓塞(中央型)', modality: ['CT'], severity: 'critical', riskLevel: 'high', label: '中央型肺栓塞', labelEn: 'Central PE' },
  { id: 'cp-11', pattern: '肝破裂/脾破裂', modality: ['CT', 'US'], severity: 'critical', riskLevel: 'high', label: '实质脏器破裂', labelEn: 'Solid Organ Rupture' },
  { id: 'cp-12', pattern: '异位妊娠破裂', modality: ['US', 'MR'], severity: 'critical', riskLevel: 'high', label: '异位妊娠', labelEn: 'Ectopic Pregnancy' },
  { id: 'cp-13', pattern: '卵巢扭转(无血流)', modality: ['US', 'MR'], severity: 'urgency', riskLevel: 'high', label: '卵巢扭转', labelEn: 'Ovarian Torsion' },
  { id: 'cp-14', pattern: '急性脊髓压迫', modality: ['MR', 'CT'], severity: 'critical', riskLevel: 'high', label: '脊髓压迫', labelEn: 'Spinal Cord Compression' },
  { id: 'cp-15', pattern: '纵隔气肿', modality: ['CT', 'DR'], severity: 'critical', riskLevel: 'high', label: '纵隔气肿', labelEn: 'Pneumomediastinum' },
  { id: 'cp-16', pattern: '化脓性胆管炎(急性)', modality: ['CT', 'US', 'MR'], severity: 'critical', riskLevel: 'high', label: '急性化脓性胆管炎', labelEn: 'Acute Cholangitis' },
  { id: 'cp-17', pattern: '颅内动脉瘤 > 7mm', modality: ['CTA', 'MRA'], severity: 'critical', riskLevel: 'high', label: '高危动脉瘤', labelEn: 'High-Risk Aneurysm' },
  { id: 'cp-18', pattern: '室壁瘤/心脏破裂', modality: ['CT', 'US', 'MR'], severity: 'critical', riskLevel: 'high', label: '心脏破裂', labelEn: 'Cardiac Rupture' },
  { id: 'cp-19', pattern: '脑疝(钩回疝/小脑扁桃体疝)', modality: ['CT', 'MR'], severity: 'critical', riskLevel: 'high', label: '脑疝', labelEn: 'Brain Herniation' },
  { id: 'cp-20', pattern: '急性硬膜下血肿 > 1cm', modality: ['CT', 'MR'], severity: 'critical', riskLevel: 'high', label: '急性硬膜下血肿', labelEn: 'Acute SDH' },
  { id: 'cp-21', pattern: '大面积肺不张/肺实变 > 50%', modality: ['CT', 'DR'], severity: 'urgency', riskLevel: 'medium', label: '大面积肺不张', labelEn: 'Massive Atelectasis' },
  { id: 'cp-22', pattern: '肾动脉闭塞', modality: ['CT', 'MRA'], severity: 'critical', riskLevel: 'high', label: '肾动脉栓塞', labelEn: 'Renal Artery Occlusion' },
];

// ============================================================
// 32. 危急值规则触发器
// ============================================================
export const CRITICAL_RULES_MOCK: Array<{ id: string; name: string; triggered: boolean; severity: string }> = [
  { id: 'cv-1', name: '主动脉直径 > 5cm', triggered: false, severity: 'critical' },
  { id: 'cv-2', name: '肺栓塞 RV/LV > 1.0', triggered: false, severity: 'critical' },
  { id: 'cv-3', name: '颅内出血 > 30mL', triggered: true, severity: 'critical' },
  { id: 'cv-4', name: '气胸 > 3cm', triggered: false, severity: 'critical' },
  { id: 'cv-5', name: '急性主动脉夹层', triggered: false, severity: 'critical' },
  { id: 'cv-6', name: '心包积液 > 2cm', triggered: false, severity: 'critical' },
  { id: 'cv-7', name: '气腹(游离气体)', triggered: false, severity: 'critical' },
  { id: 'cv-8', name: '肠梗阻 > 6cm', triggered: false, severity: 'critical' },
];

// ============================================================
// 33. 鉴别诊断
// ============================================================
export const DIFFERENTIAL_DX_MOCK: Array<{ condition: string; probability: number; supporting: string[]; icd10: string }> = [
  { condition: '周围型肺癌(腺癌)', probability: 0.72, supporting: ['右肺上叶不规则结节', '分叶征', '毛刺征', '胸膜牵拉'], icd10: 'C34.1' },
  { condition: '肺转移瘤', probability: 0.12, supporting: ['既往肿瘤病史', '多发结节'], icd10: 'C78.0' },
  { condition: '肺结核球', probability: 0.08, supporting: ['钙化灶', '卫星灶', '结核病史'], icd10: 'A15.2' },
  { condition: '肺错构瘤', probability: 0.05, supporting: ['爆米花样钙化', '边界清晰', '含脂肪密度'], icd10: 'D14.3' },
  { condition: '肺隐球菌病', probability: 0.03, supporting: ['免疫功能低下', '多发结节伴晕征'], icd10: 'B45.0' },
];

// ============================================================
// 34. LI-RADS v2024 模板
// ============================================================
const liRadsGroups: StructuredFieldGroup[] = [
  { id: 'lirg1', label: '临床信息', labelEn: 'Clinical Info', order: 1, collapsible: false, defaultExpanded: true },
  { id: 'lirg2', label: '主要影像特征', labelEn: 'Major Features', order: 2, collapsible: true, defaultExpanded: true },
  { id: 'lirg3', label: '辅助影像特征', labelEn: 'Ancillary Features', order: 3, collapsible: true, defaultExpanded: false },
  { id: 'lirg4', label: 'LI-RADS 分类', labelEn: 'LI-RADS Category', order: 4, collapsible: false, defaultExpanded: true },
  { id: 'lirg5', label: '管理建议', labelEn: 'Management', order: 5, collapsible: false, defaultExpanded: true },
];

const liRadsFields: StructuredFieldDefinition[] = [
  { id: 'lirf1', key: 'cirrhosis', label: '肝硬化病史', labelEn: 'Cirrhosis History', type: 'boolean', required: true, group: 'lirg1', defaultValue: false, order: 1 },
  { id: 'lirf2', key: 'hepatitisB', label: '乙肝表面抗原(HBsAg)', labelEn: 'HBsAg', type: 'enum', required: true, group: 'lirg1', options: [
    { value: 'positive', label: '阳性', labelEn: 'Positive' },
    { value: 'negative', label: '阴性', labelEn: 'Negative' },
    { value: 'unknown', label: '未知', labelEn: 'Unknown' },
  ], order: 2 },
  { id: 'lirf3', key: 'afpLevel', label: 'AFP(ng/mL)', labelEn: 'AFP Level', type: 'number', required: false, group: 'lirg1', min: 0, max: 100000, unit: 'ng/mL', order: 3 },
  { id: 'lirf4', key: 'observationCount', label: '观察病灶数量', labelEn: 'Observation Count', type: 'number', required: true, group: 'lirg2', min: 0, max: 20, defaultValue: 1, order: 4 },
  { id: 'lirf5', key: 'lesion1SizeLir', label: '病灶 1 大小(mm)', labelEn: 'Lesion 1 Size', type: 'number', required: true, group: 'lirg2', min: 0, max: 200, unit: 'mm', order: 5 },
  { id: 'lirf6', key: 'lesion1Phase', label: '病灶 1 强化方式', labelEn: 'Lesion 1 Enhancement', type: 'enum', required: true, group: 'lirg2', options: [
    { value: 'APHE', label: '动脉期非环状高强化', labelEn: 'Non-rim APHE' },
    { value: 'rimAPHE', label: '动脉期环状高强化', labelEn: 'Rim APHE' },
    { value: 'noAPHE', label: '无动脉期高强化', labelEn: 'No APHE' },
  ], order: 6 },
  { id: 'lirf7', key: 'lesion1Washout', label: '病灶 1 廓清', labelEn: 'Lesion 1 Washout', type: 'enum', required: true, group: 'lirg2', options: [
    { value: 'washout', label: '门静脉期/延迟期廓清', labelEn: 'Washout' },
    { value: 'noWashout', label: '无廓清', labelEn: 'No Washout' },
  ], order: 7 },
  { id: 'lirf8', key: 'lesion1Capsule', label: '病灶 1 假包膜', labelEn: 'Lesion 1 Capsule', type: 'enum', required: true, group: 'lirg2', options: [
    { value: 'enhancingCapsule', label: '强化包膜', labelEn: 'Enhancing Capsule' },
    { value: 'noCapsule', label: '无包膜', labelEn: 'No Capsule' },
  ], order: 8 },
  { id: 'lirf9', key: 'lesion1ThresholdGrowth', label: '病灶 1 阈值增长', labelEn: 'Lesion 1 Threshold Growth', type: 'boolean', required: true, group: 'lirg2', defaultValue: false, order: 9 },
  { id: 'lirf10', key: 'lesion1LocationLir', label: '病灶 1 肝段', labelEn: 'Lesion 1 Segment', type: 'enum', required: true, group: 'lirg2', options: [
    { value: 'S1', label: 'S1(尾叶)', labelEn: 'S1 Caudate' },
    { value: 'S2', label: 'S2', labelEn: 'S2' },
    { value: 'S3', label: 'S3', labelEn: 'S3' },
    { value: 'S4', label: 'S4', labelEn: 'S4' },
    { value: 'S5', label: 'S5', labelEn: 'S5' },
    { value: 'S6', label: 'S6', labelEn: 'S6' },
    { value: 'S7', label: 'S7', labelEn: 'S7' },
    { value: 'S8', label: 'S8', labelEn: 'S8' },
  ], order: 10 },
  { id: 'lirf11', key: 'lesion2SizeLir', label: '病灶 2 大小(mm)', labelEn: 'Lesion 2 Size', type: 'number', required: false, group: 'lirg2', min: 0, max: 200, unit: 'mm', order: 11 },
  { id: 'lirf12', key: 'lesion2Phase', label: '病灶 2 强化方式', labelEn: 'Lesion 2 Enhancement', type: 'enum', required: false, group: 'lirg2', options: [
    { value: 'APHE', label: '动脉期非环状高强化', labelEn: 'Non-rim APHE' },
    { value: 'rimAPHE', label: '动脉期环状高强化', labelEn: 'Rim APHE' },
    { value: 'noAPHE', label: '无动脉期高强化', labelEn: 'No APHE' },
  ], order: 12 },
  { id: 'lirf13', key: 'lesion2Washout', label: '病灶 2 廓清', labelEn: 'Lesion 2 Washout', type: 'enum', required: false, group: 'lirg2', options: [
    { value: 'washout', label: '门静脉期/延迟期廓清', labelEn: 'Washout' },
    { value: 'noWashout', label: '无廓清', labelEn: 'No Washout' },
  ], order: 13 },
  { id: 'lirf14', key: 'lesion2Capsule', label: '病灶 2 假包膜', labelEn: 'Lesion 2 Capsule', type: 'enum', required: false, group: 'lirg2', options: [
    { value: 'enhancingCapsule', label: '强化包膜', labelEn: 'Enhancing Capsule' },
    { value: 'noCapsule', label: '无包膜', labelEn: 'No Capsule' },
  ], order: 14 },
  { id: 'lirf15', key: 'ancillaryBenign', label: '良性辅助特征', labelEn: 'Ancillary Benign Features', type: 'multi-enum', required: false, group: 'lirg3', options: [
    { value: 'iron', label: '铁沉积(结节内)', labelEn: 'Iron' },
    { value: 'fat', label: '脂肪含量(结节内)', labelEn: 'Fat' },
    { value: 'cyst', label: '囊变', labelEn: 'Cystic Change' },
    { value: 'scar', label: '中央瘢痕', labelEn: 'Central Scar' },
  ], order: 15 },
  { id: 'lirf16', key: 'ancillaryMalignant', label: '恶性辅助特征', labelEn: 'Ancillary Malignant Features', type: 'multi-enum', required: false, group: 'lirg3', options: [
    { value: 'mosaic', label: '马赛克结构', labelEn: 'Mosaic Architecture' },
    { value: 'noduleInNodule', label: '结节中结节', labelEn: 'Nodule-in-Nodule' },
    { value: 'corona', label: '强化冠', labelEn: 'Corona Enhancement' },
    { value: 'fatMass', label: '肿块内脂肪', labelEn: 'Fat in Mass' },
    { value: 'hemorrhage', label: '出血', labelEn: 'Hemorrhage' },
  ], order: 16 },
  { id: 'lirf17', key: 'ancillaryCirrhosis', label: '肝硬化相关辅助特征', labelEn: 'Ancillary Cirrhosis Features', type: 'multi-enum', required: false, group: 'lirg3', options: [
    { value: 'portalHTN', label: '门脉高压', labelEn: 'Portal Hypertension' },
    { value: 'splenomegaly', label: '脾大', labelEn: 'Splenomegaly' },
    { value: 'ascites', label: '腹水', labelEn: 'Ascites' },
    { value: 'varices', label: '静脉曲张', labelEn: 'Varices' },
  ], order: 17 },
  { id: 'lirf18', key: 'tumorInVein', label: '血管内肿瘤(脉管瘤栓)', labelEn: 'Tumor in Vein (TIV)', type: 'boolean', required: true, group: 'lirg3', defaultValue: false, order: 18 },
  { id: 'lirf19', key: 'liRadsCategory', label: 'LI-RADS 分类', labelEn: 'LI-RADS Category', type: 'enum', required: true, group: 'lirg4', options: [
    { value: 'LR-1', label: 'LR-1 明确良性', labelEn: 'LR-1 Definitely Benign', color: '#10b981' },
    { value: 'LR-2', label: 'LR-2 可能良性', labelEn: 'LR-2 Probably Benign', color: '#34d399' },
    { value: 'LR-3', label: 'LR-3 中度可疑', labelEn: 'LR-3 Intermediate', color: 'var(--color-warning-500)' },
    { value: 'LR-4', label: 'LR-4 高度可疑', labelEn: 'LR-4 Probably HCC', color: '#fb923c' },
    { value: 'LR-5', label: 'LR-5 明确HCC', labelEn: 'LR-5 Definitely HCC', color: 'var(--color-error-600)' },
    { value: 'LR-M', label: 'LR-M 可能恶性(非HCC)', labelEn: 'LR-M Probable Malignant', color: '#7f1d1d' },
    { value: 'LR-TIV', label: 'LR-TIV 脉管瘤栓', labelEn: 'LR-TIV Tumor in Vein', color: '#991b1b' },
  ], defaultValue: 'LR-2', order: 19 },
  { id: 'lirf20', key: 'tumorMarkerDx', label: '肿瘤标志物诊断', labelEn: 'Tumor Marker Dx', type: 'enum', required: false, group: 'lirg4', options: [
    { value: 'hcc', label: 'HCC', labelEn: 'HCC' },
    { value: 'nonHcc', label: '非HCC恶性肿瘤', labelEn: 'Non-HCC Malignancy' },
    { value: 'hemangioma', label: '血管瘤', labelEn: 'Hemangioma' },
    { value: 'FNH', label: 'FNH', labelEn: 'FNH' },
    { value: 'adenoma', label: '腺瘤', labelEn: 'Adenoma' },
  ], order: 20 },
  { id: 'lirf21', key: 'lesion1Subsegment', label: '病灶 1 亚段', labelEn: 'Lesion 1 Subsegment', type: 'text', required: false, group: 'lirg2', order: 101 },
  { id: 'lirf22', key: 'lesion1Number', label: '病灶 1 编号', labelEn: 'Lesion 1 Number', type: 'text', required: false, group: 'lirg2', order: 102 },
  { id: 'lirf23', key: 'lesion2Subsegment', label: '病灶 2 亚段', labelEn: 'Lesion 2 Subsegment', type: 'text', required: false, group: 'lirg2', order: 103 },
  { id: 'lirf24', key: 'lesion2Number', label: '病灶 2 编号', labelEn: 'Lesion 2 Number', type: 'text', required: false, group: 'lirg2', order: 104 },
  { id: 'lirf25', key: 'ancillaryFeatureNotes', label: '辅助特征说明', labelEn: 'Ancillary Features Notes', type: 'text', required: false, group: 'lirg3', order: 105 },
  { id: 'lirf26', key: 'priorImagingLir', label: '既往影像日期', labelEn: 'Prior Imaging Date', type: 'date', required: false, group: 'lirg4', order: 106 },
  { id: 'lirf27', key: 'priorCategory', label: '既往LI-RADS分类', labelEn: 'Prior LI-RADS Category', type: 'enum', required: false, group: 'lirg4', options: [
    { value: 'LR-1', label: 'LR-1', labelEn: 'LR-1' },
    { value: 'LR-2', label: 'LR-2', labelEn: 'LR-2' },
    { value: 'LR-3', label: 'LR-3', labelEn: 'LR-3' },
    { value: 'LR-4', label: 'LR-4', labelEn: 'LR-4' },
    { value: 'LR-5', label: 'LR-5', labelEn: 'LR-5' },
    { value: 'LR-M', label: 'LR-M', labelEn: 'LR-M' },
  ], order: 107 },
  { id: 'lirf28', key: 'stabilityAssessment', label: '稳定性评估', labelEn: 'Stability Assessment', type: 'enum', required: false, group: 'lirg4', options: [
    { value: 'stable', label: '稳定', labelEn: 'Stable' },
    { value: 'enlarging', label: '增大', labelEn: 'Enlarging' },
    { value: 'new', label: '新发', labelEn: 'New' },
  ], order: 108 },
  { id: 'lirf29', key: 'liRadsManagement', label: '管理建议', labelEn: 'Management', type: 'text', required: true, group: 'lirg5', order: 109, fillGuide: '根据LI-RADS v2024版管理路径提供建议,包括随访/活检/切除等' },
  { id: 'lirf30', key: 'followUpMonthsLir', label: '随访间隔(月)', labelEn: 'Follow-up Months', type: 'number', required: false, group: 'lirg5', min: 1, max: 24, unit: '月', order: 110 },
  { id: 'lirf31', key: 'biopsyRecommendation', label: '活检建议', labelEn: 'Biopsy Recommendation', type: 'boolean', required: false, group: 'lirg5', defaultValue: false, order: 111 },
  { id: 'lirf32', key: 'mdtRecommended', label: '多学科会诊(MDT)', labelEn: 'MDT Recommended', type: 'boolean', required: false, group: 'lirg5', defaultValue: false, order: 112 },
  { id: 'lirf33', key: 'imageUploadLir', label: '关键图像', labelEn: 'Key Image', type: 'image', required: false, group: 'lirg5', order: 113 },
  { id: 'lirf34', key: 'liRadsAssessor', label: '评估医师', labelEn: 'Assessor', type: 'text', required: true, group: 'lirg5', order: 114 },
  { id: 'lirf35', key: 'liRadsNotes', label: '备注', labelEn: 'Notes', type: 'text', required: false, group: 'lirg5', order: 115 },
];

export const LI_RADS_TEMPLATE: StructuredTemplate = {
  id: 'liRads',
  name: 'LI-RADS v2024 肝脏影像评估',
  nameEn: 'LI-RADS v2024 Liver Imaging',
  modality: 'MR',
  bodyPart: '肝脏',
  version: '2024.1.0',
  fields: liRadsFields,
  groups: liRadsGroups,
  createdAt: '2026-06-15T08:00:00Z',
  updatedAt: '2026-09-20T10:00:00Z',
  author: 'G005 肝脏组',
  score: 4.8,
  tags: ['肝脏', 'LI-RADS', 'HCC', 'MR'],
  inheritable: true,
  approved: true,
  approver: '林主任',
};

// ============================================================
// 35. Lung-RADS 2022 模板
// ============================================================
const lungRadsGroups: StructuredFieldGroup[] = [
  { id: 'lrg1', label: '临床信息', labelEn: 'Clinical Info', order: 1, collapsible: false, defaultExpanded: true },
  { id: 'lrg2', label: '结节特征', labelEn: 'Nodule Features', order: 2, collapsible: true, defaultExpanded: true },
  { id: 'lrg3', label: 'Lung-RADS 分类', labelEn: 'Lung-RADS Category', order: 3, collapsible: false, defaultExpanded: true },
  { id: 'lrg4', label: '管理建议', labelEn: 'Management', order: 4, collapsible: false, defaultExpanded: true },
];

const lungRadsFields: StructuredFieldDefinition[] = [
  { id: 'lrf1', key: 'clinicalIndication', label: '检查指征', labelEn: 'Indication', type: 'enum', required: true, group: 'lrg1', options: [
    { value: 'screening', label: '肺癌筛查', labelEn: 'Lung Cancer Screening' },
    { value: 'followup', label: '结节随访', labelEn: 'Nodule Follow-up' },
    { value: 'incidental', label: '偶然发现', labelEn: 'Incidental Finding' },
  ], order: 1 },
  { id: 'lrf2', key: 'smokingHistory', label: '吸烟史(包年)', labelEn: 'Smoking History (pack-years)', type: 'number', required: true, group: 'lrg1', min: 0, max: 200, unit: '包年', placeholder: '例:30', order: 2 },
  { id: 'lrf3', key: 'noduleCount', label: '结节总数', labelEn: 'Total Nodule Count', type: 'number', required: true, group: 'lrg2', min: 0, max: 20, defaultValue: 1, order: 3 },
  { id: 'lrf4', key: 'nodule1Type', label: '结节 1 类型', labelEn: 'Nodule 1 Type', type: 'enum', required: true, group: 'lrg2', options: [
    { value: 'solid', label: '实性结节', labelEn: 'Solid Nodule' },
    { value: 'partSolid', label: '部分实性结节', labelEn: 'Part-Solid Nodule' },
    { value: 'ggo', label: '纯磨玻璃结节', labelEn: 'Pure GGO' },
  ], order: 4 },
  { id: 'lrf5', key: 'nodule1Size', label: '结节 1 平均直径(mm)', labelEn: 'Nodule 1 Avg Diameter', type: 'number', required: true, group: 'lrg2', min: 0, max: 100, unit: 'mm', order: 5 },
  { id: 'lrf6', key: 'nodule1Density', label: '结节 1 密度(HU)', labelEn: 'Nodule 1 Density', type: 'number', required: false, group: 'lrg2', min: -1000, max: 500, unit: 'HU', order: 6 },
  { id: 'lrf7', key: 'nodule1Margin', label: '结节 1 边缘', labelEn: 'Nodule 1 Margin', type: 'enum', required: true, group: 'lrg2', options: [
    { value: 'smooth', label: '光滑', labelEn: 'Smooth' },
    { value: 'lobulated', label: '分叶状', labelEn: 'Lobulated' },
    { value: 'spiculated', label: '毛刺状', labelEn: 'Spiculated' },
  ], order: 7 },
  { id: 'lrf8', key: 'nodule1Calcification', label: '结节 1 钙化', labelEn: 'Nodule 1 Calcification', type: 'enum', required: false, group: 'lrg2', options: [
    { value: 'none', label: '无', labelEn: 'None' },
    { value: 'benign', label: '良性钙化', labelEn: 'Benign' },
    { value: 'eccentric', label: '偏心钙化', labelEn: 'Eccentric' },
  ], order: 8 },
  { id: 'lrf9', key: 'nodule1Location', label: '结节 1 位置', labelEn: 'Nodule 1 Location', type: 'text', required: true, group: 'lrg2', placeholder: '例:右肺上叶尖段', order: 9 },
  { id: 'lrf10', key: 'nodule1Lobe', label: '结节 1 肺叶', labelEn: 'Nodule 1 Lobe', type: 'enum', required: true, group: 'lrg2', options: [
    { value: 'RUL', label: '右肺上叶', labelEn: 'RUL' },
    { value: 'RML', label: '右肺中叶', labelEn: 'RML' },
    { value: 'RLL', label: '右肺下叶', labelEn: 'RLL' },
    { value: 'LUL', label: '左肺上叶', labelEn: 'LUL' },
    { value: 'LLL', label: '左肺下叶', labelEn: 'LLL' },
  ], order: 10 },
  { id: 'lrf11', key: 'nodule2Type', label: '结节 2 类型', labelEn: 'Nodule 2 Type', type: 'enum', required: false, group: 'lrg2', options: [
    { value: 'solid', label: '实性结节', labelEn: 'Solid' },
    { value: 'partSolid', label: '部分实性结节', labelEn: 'Part-Solid' },
    { value: 'ggo', label: '纯磨玻璃结节', labelEn: 'Pure GGO' },
  ], order: 11 },
  { id: 'lrf12', key: 'nodule2Size', label: '结节 2 平均直径(mm)', labelEn: 'Nodule 2 Avg Diameter', type: 'number', required: false, group: 'lrg2', min: 0, max: 100, unit: 'mm', order: 12 },
  { id: 'lrf13', key: 'nodule2Location', label: '结节 2 位置', labelEn: 'Nodule 2 Location', type: 'text', required: false, group: 'lrg2', order: 13 },
  { id: 'lrf14', key: 'nodule2Lobe', label: '结节 2 肺叶', labelEn: 'Nodule 2 Lobe', type: 'enum', required: false, group: 'lrg2', options: [
    { value: 'RUL', label: '右肺上叶', labelEn: 'RUL' },
    { value: 'RML', label: '右肺中叶', labelEn: 'RML' },
    { value: 'RLL', label: '右肺下叶', labelEn: 'RLL' },
    { value: 'LUL', label: '左肺上叶', labelEn: 'LUL' },
    { value: 'LLL', label: '左肺下叶', labelEn: 'LLL' },
  ], order: 14 },
  { id: 'lrf15', key: 'emphysema', label: '肺气肿', labelEn: 'Emphysema', type: 'boolean', required: true, group: 'lrg2', defaultValue: false, order: 15 },
  { id: 'lrf16', key: 'pleuralThickening', label: '胸膜增厚', labelEn: 'Pleural Thickening', type: 'boolean', required: true, group: 'lrg2', defaultValue: false, order: 16 },
  { id: 'lrf17', key: 'lungRadsCategory', label: 'Lung-RADS 分类', labelEn: 'Lung-RADS Category', type: 'enum', required: true, group: 'lrg3', options: [
    { value: '0', label: '0 - 评估不完全', labelEn: '0 - Incomplete', color: '#9ca3af' },
    { value: '1', label: '1 - 阴性', labelEn: '1 - Negative', color: '#10b981' },
    { value: '2', label: '2 - 良性', labelEn: '2 - Benign', color: '#10b981' },
    { value: '3', label: '3 - 可能良性', labelEn: '3 - Probably Benign', color: 'var(--color-warning-500)' },
    { value: '4A', label: '4A - 可疑', labelEn: '4A - Suspicious', color: '#fb923c' },
    { value: '4B', label: '4B - 高度可疑', labelEn: '4B - Highly Suspicious', color: '#ea580c' },
    { value: '4X', label: '4X - 可疑进展', labelEn: '4X - Suspicious Progression', color: 'var(--color-error-600)' },
  ], defaultValue: '2', order: 17 },
  { id: 'lrf18', key: 'lungRadsModifier', label: '修饰符', labelEn: 'Modifier', type: 'enum', required: false, group: 'lrg3', options: [
    { value: 'S', label: 'S - 附加临床病史', labelEn: 'S - Additional Clinical History' },
    { value: 'C', label: 'C - 既往肺癌病史', labelEn: 'C - Prior Lung Cancer' },
  ], order: 18 },
  { id: 'lrf19', key: 'solidComponentSize', label: '实性成分最大径(mm)', labelEn: 'Solid Component Size', type: 'number', required: false, group: 'lrg3', min: 0, max: 100, unit: 'mm', order: 19 },
  { id: 'lrf20', key: 'growthAssessment', label: '生长评估', labelEn: 'Growth Assessment', type: 'enum', required: true, group: 'lrg3', options: [
    { value: 'stable', label: '稳定', labelEn: 'Stable' },
    { value: 'increase', label: '增大', labelEn: 'Increase' },
    { value: 'decrease', label: '缩小', labelEn: 'Decrease' },
    { value: 'new', label: '新发', labelEn: 'New' },
  ], defaultValue: 'stable', order: 20 },
  { id: 'lrf21', key: 'lungRadsManagement', label: '管理建议', labelEn: 'Management', type: 'text', required: true, group: 'lrg4', order: 21, fillGuide: '根据 Lung-RADS 2022 版管理路径给出建议' },
  { id: 'lrf22', key: 'followUpInterval', label: '随访间隔(月)', labelEn: 'Follow-up Interval (months)', type: 'number', required: true, group: 'lrg4', min: 1, max: 24, unit: '月', defaultValue: 12, order: 22 },
  { id: 'lrf23', key: 'biopsyRecommended', label: '建议活检', labelEn: 'Biopsy Recommended', type: 'boolean', required: true, group: 'lrg4', defaultValue: false, order: 23 },
  { id: 'lrf24', key: 'petCtRecommended', label: '建议 PET-CT', labelEn: 'PET-CT Recommended', type: 'boolean', required: true, group: 'lrg4', defaultValue: false, order: 24 },
  { id: 'lrf25', key: 'noduleCountSolid', label: '实性结节数', labelEn: 'Solid Nodule Count', type: 'number', required: false, group: 'lrg2', min: 0, max: 20, order: 101 },
  { id: 'lrf26', key: 'noduleCountPartSolid', label: '部分实性结节数', labelEn: 'Part-Solid Count', type: 'number', required: false, group: 'lrg2', min: 0, max: 20, order: 102 },
  { id: 'lrf27', key: 'noduleCountGGO', label: '磨玻璃结节数', labelEn: 'GGO Count', type: 'number', required: false, group: 'lrg2', min: 0, max: 20, order: 103 },
  { id: 'lrf28', key: 'priorNoduleSize', label: '既往结节大小(mm)', labelEn: 'Prior Nodule Size', type: 'number', required: false, group: 'lrg3', min: 0, max: 100, unit: 'mm', order: 104 },
  { id: 'lrf29', key: 'nodule1SolidSize', label: '结节 1 实性成分(mm)', labelEn: 'Nodule 1 Solid Component', type: 'number', required: false, group: 'lrg2', min: 0, max: 100, unit: 'mm', order: 105 },
  { id: 'lrf30', key: 'nodule2SolidSize', label: '结节 2 实性成分(mm)', labelEn: 'Nodule 2 Solid Component', type: 'number', required: false, group: 'lrg2', min: 0, max: 100, unit: 'mm', order: 106 },
  { id: 'lrf31', key: 'comparisonStudy', label: '对照检查日期', labelEn: 'Comparison Study Date', type: 'date', required: false, group: 'lrg3', order: 107 },
  { id: 'lrf32', key: 'doublingTime', label: '倍增时间(天)', labelEn: 'Doubling Time (days)', type: 'number', required: false, group: 'lrg3', min: 0, max: 2000, unit: '天', order: 108 },
  { id: 'lrf33', key: 'lungRadsAssessor', label: '评估医师', labelEn: 'Assessor', type: 'text', required: true, group: 'lrg4', order: 109 },
  { id: 'lrf34', key: 'lungRadsNotes', label: '备注', labelEn: 'Notes', type: 'text', required: false, group: 'lrg4', order: 110 },
  { id: 'lrf35', key: 'imageUploadLr', label: '关键图像', labelEn: 'Key Image', type: 'image', required: false, group: 'lrg4', order: 111 },
];

export const LUNG_RADS_TEMPLATE: StructuredTemplate = {
  id: 'lungRads',
  name: 'Lung-RADS 2022 肺结节筛查',
  nameEn: 'Lung-RADS 2022 Lung Cancer Screening',
  modality: 'CT',
  bodyPart: '胸部',
  version: '2022.1.0',
  fields: lungRadsFields,
  groups: lungRadsGroups,
  createdAt: '2026-06-01T08:00:00Z',
  updatedAt: '2026-09-20T10:00:00Z',
  author: 'G005 胸部组',
  score: 4.7,
  tags: ['肺结节', '筛查', 'Lung-RADS', 'CT'],
  inheritable: true,
  approved: true,
  approver: '刘主任',
};

// ============================================================
// 36. 多模态嵌入元素
// ============================================================
export const MULTIMODAL_EMBED_MOCK: Array<{ id: string; type: string; label: string; description: string }> = [
  { id: 'embed-1', type: 'dicom-viewer', label: 'DICOM 影像查看器', description: '嵌入DICOM序列,支持窗宽窗位调节和测量' },
  { id: 'embed-2', type: 'ai-overlay', label: 'AI 分析覆盖层', description: 'AI检测结果叠加显示(结节/骨折/出血等)' },
  { id: 'embed-3', type: 'mpr', label: '多平面重建(MPR)', description: '冠状位/矢状位/轴位多平面重建视图' },
  { id: 'embed-4', type: 'vrt', label: '容积重建(VRT)', description: '三维容积重建表面渲染视图' },
  { id: 'embed-5', type: 'curve', label: '时间-密度曲线(TDC)', description: '动态增强扫描时间-密度曲线分析图' },
  { id: 'embed-6', type: 'pet-fusion', label: 'PET-CT 融合图像', description: 'PET代谢图像与CT解剖图像融合显示' },
  { id: 'embed-7', type: 'cad', label: 'CAD 分析结果', description: '计算机辅助检测(CAD)分析报告' },
  { id: 'embed-8', type: 'report-pdf', label: '报告 PDF 预览', description: '当前报告PDF格式嵌入预览' },
  { id: 'embed-9', type: 'chart', label: '随访趋势图', description: '病灶大小/标志物变化趋势折线图' },
  { id: 'embed-10', type: 'reference', label: '参考图谱', description: '标准解剖图谱/影像分期参考图' },
];

// ============================================================
// 37. O-RADS MRI 模板
// ============================================================
const oRadsGroups: StructuredFieldGroup[] = [
  { id: 'org1', label: '临床信息', labelEn: 'Clinical Info', order: 1, collapsible: false, defaultExpanded: true },
  { id: 'org2', label: '病灶特征', labelEn: 'Lesion Features', order: 2, collapsible: true, defaultExpanded: true },
  { id: 'org3', label: 'O-RADS 评分', labelEn: 'O-RADS Score', order: 3, collapsible: false, defaultExpanded: true },
  { id: 'org4', label: '管理建议', labelEn: 'Management', order: 4, collapsible: false, defaultExpanded: true },
];

const oRadsFields: StructuredFieldDefinition[] = [
  { id: 'orf1', key: 'menopausalStatus', label: '绝经状态', labelEn: 'Menopausal Status', type: 'enum', required: true, group: 'org1', options: [
    { value: 'pre', label: '绝经前', labelEn: 'Premenopausal' },
    { value: 'post', label: '绝经后', labelEn: 'Postmenopausal' },
  ], order: 1 },
  { id: 'orf2', key: 'ca125', label: 'CA125(U/mL)', labelEn: 'CA125', type: 'number', required: false, group: 'org1', min: 0, max: 10000, unit: 'U/mL', order: 2 },
  { id: 'orf3', key: 'lesionLaterality', label: '病灶侧别', labelEn: 'Laterality', type: 'enum', required: true, group: 'org2', options: [
    { value: 'L', label: '左侧', labelEn: 'Left' },
    { value: 'R', label: '右侧', labelEn: 'Right' },
    { value: 'B', label: '双侧', labelEn: 'Bilateral' },
  ], order: 3 },
  { id: 'orf4', key: 'lesionSizeOr', label: '病灶最大径(mm)', labelEn: 'Lesion Size', type: 'number', required: true, group: 'org2', min: 0, max: 300, unit: 'mm', order: 4 },
  { id: 'orf5', key: 'cysticContent', label: '囊性成分', labelEn: 'Cystic Content', type: 'enum', required: true, group: 'org2', options: [
    { value: 'simple', label: '单纯囊性', labelEn: 'Simple Cyst' },
    { value: 'hemorrhagic', label: '出血性', labelEn: 'Hemorrhagic' },
    { value: 'complex', label: '复杂囊性', labelEn: 'Complex' },
  ], order: 5 },
  { id: 'orf6', key: 'solidComponent', label: '实性成分', labelEn: 'Solid Component', type: 'enum', required: true, group: 'org2', options: [
    { value: 'none', label: '无', labelEn: 'None' },
    { value: 'lessThan20', label: '实性成分 < 20%', labelEn: '< 20%' },
    { value: 'moreThan20', label: '实性成分 ≥ 20%', labelEn: '≥ 20%' },
  ], order: 6 },
  { id: 'orf7', key: 'enhancement', label: '强化特征', labelEn: 'Enhancement', type: 'enum', required: true, group: 'org2', options: [
    { value: 'none', label: '无强化', labelEn: 'None' },
    { value: 'mild', label: '轻度强化', labelEn: 'Mild' },
    { value: 'moderate', label: '中度强化', labelEn: 'Moderate' },
    { value: 'marked', label: '明显强化', labelEn: 'Marked' },
  ], order: 7 },
  { id: 'orf8', key: 'wallIrregularity', label: '囊壁不规则', labelEn: 'Wall Irregularity', type: 'boolean', required: true, group: 'org2', defaultValue: false, order: 8 },
  { id: 'orf9', key: 'septation', label: '分隔', labelEn: 'Septation', type: 'enum', required: true, group: 'org2', options: [
    { value: 'none', label: '无分隔', labelEn: 'None' },
    { value: 'thin', label: '薄分隔(<3mm)', labelEn: 'Thin (<3mm)' },
    { value: 'thick', label: '厚分隔(≥3mm)', labelEn: 'Thick (≥3mm)' },
  ], order: 9 },
  { id: 'orf10', key: 'ascites', label: '腹水', labelEn: 'Ascites', type: 'boolean', required: true, group: 'org2', defaultValue: false, order: 10 },
  { id: 'orf11', key: 'peritonealImplant', label: '腹膜种植', labelEn: 'Peritoneal Implant', type: 'boolean', required: true, group: 'org2', defaultValue: false, order: 11 },
  { id: 'orf12', key: 'oRadsScore', label: 'O-RADS 评分', labelEn: 'O-RADS Score', type: 'enum', required: true, group: 'org3', options: [
    { value: 'ORADS1', label: 'O-RADS 1 - 明确良性', labelEn: '1 - Definitely Benign', color: '#10b981' },
    { value: 'ORADS2', label: 'O-RADS 2 - 可能良性', labelEn: '2 - Probably Benign', color: '#34d399' },
    { value: 'ORADS3', label: 'O-RADS 3 - 低度风险', labelEn: '3 - Low Risk', color: 'var(--color-warning-500)' },
    { value: 'ORADS4', label: 'O-RADS 4 - 中度风险', labelEn: '4 - Intermediate Risk', color: '#fb923c' },
    { value: 'ORADS5', label: 'O-RADS 5 - 高度风险', labelEn: '5 - High Risk', color: 'var(--color-error-600)' },
  ], defaultValue: 'ORADS2', order: 12 },
  { id: 'orf13', key: 'oRadsManagement', label: '管理建议', labelEn: 'Management', type: 'text', required: true, group: 'org4', order: 13, fillGuide: '根据O-RADS评分及相关指南提出管理方案' },
  { id: 'orf14', key: 'imageUploadOr', label: '关键图像', labelEn: 'Key Image', type: 'image', required: false, group: 'org4', order: 14 },
  { id: 'orf15', key: 'oRadsAssessor', label: '评估医师', labelEn: 'Assessor', type: 'text', required: true, group: 'org4', order: 15 },
];

export const O_RADS_TEMPLATE: StructuredTemplate = {
  id: 'oRads',
  name: 'O-RADS MRI 卵巢-附件评估',
  nameEn: 'O-RADS MRI Ovarian-Adnexal',
  modality: 'MR',
  bodyPart: '盆腔',
  version: '1.0.1',
  fields: oRadsFields,
  groups: oRadsGroups,
  createdAt: '2026-05-05T08:00:00Z',
  updatedAt: '2026-09-12T10:00:00Z',
  author: 'G005 妇科组',
  score: 4.6,
  tags: ['卵巢', 'O-RADS', 'MR', '附件'],
  inheritable: true,
  approved: true,
  approver: '吴主任',
};

// ============================================================
// 38. 短语类别树
// ============================================================
export const PHRASE_CATEGORIES_MOCK: Array<{ id: string; name: string; parentId?: string; count: number }> = [
  { id: 'pc-1', name: '正常描述', count: 45 },
  { id: 'pc-1-1', name: '胸部正常', parentId: 'pc-1', count: 12 },
  { id: 'pc-1-2', name: '腹部正常', parentId: 'pc-1', count: 10 },
  { id: 'pc-1-3', name: '颅脑正常', parentId: 'pc-1', count: 8 },
  { id: 'pc-1-4', name: '脊柱正常', parentId: 'pc-1', count: 6 },
  { id: 'pc-2', name: '异常发现', count: 68 },
  { id: 'pc-2-1', name: '肺结节', parentId: 'pc-2', count: 15 },
  { id: 'pc-2-2', name: '肝脏病变', parentId: 'pc-2', count: 12 },
  { id: 'pc-2-3', name: '脑血管病', parentId: 'pc-2', count: 10 },
  { id: 'pc-2-4', name: '骨折', parentId: 'pc-2', count: 8 },
  { id: 'pc-3', name: '诊断意见', count: 30 },
  { id: 'pc-4', name: '建议/随访', count: 25 },
  { id: 'pc-5', name: '比较描述', count: 18 },
  { id: 'pc-6', name: '技术方法', count: 15 },
  { id: 'pc-7', name: '危急值', count: 8 },
];

// ============================================================
// 39. 打印布局
// ============================================================
export const PRINT_LAYOUTS_MOCK: Array<{ id: string; name: string; description: string; columns: 1|2; pageSize: string }> = [
  { id: 'pl-1', name: '标准A4单栏', description: 'A4纵向单栏排版,适合打印存档', columns: 1, pageSize: 'A4' },
  { id: 'pl-2', name: '标准A4双栏', description: 'A4纵向双栏排版,节省纸张', columns: 2, pageSize: 'A4' },
  { id: 'pl-3', name: '信纸单栏', description: 'US Letter 单栏排版', columns: 1, pageSize: 'Letter' },
  { id: 'pl-4', name: '信纸双栏', description: 'US Letter 双栏排版', columns: 2, pageSize: 'Letter' },
  { id: 'pl-5', name: 'A3宽幅', description: 'A3横向宽幅排版,适合病例讨论', columns: 2, pageSize: 'A3' },
  { id: 'pl-6', name: 'A5便携', description: 'A5小尺寸,适合移动端打印', columns: 1, pageSize: 'A5' },
  { id: 'pl-7', name: 'B5精简', description: 'B5中等尺寸,适合患者携带', columns: 1, pageSize: 'B5' },
  { id: 'pl-8', name: 'A4图文混排', description: 'A4左侧文字右侧图像布局', columns: 2, pageSize: 'A4' },
  { id: 'pl-9', name: '报告+图像', description: 'A4上文字下图,适合教学', columns: 1, pageSize: 'A4' },
  { id: 'pl-10', name: 'A4连续纸', description: '连续打印纸格式,适合批量输出', columns: 1, pageSize: 'A4' },
];

// ============================================================
// 40. 语音配置文件
// ============================================================
export const SPEAKER_PROFILES_MOCK: VoiceProfile[] = [
  { id: 'sp-1', name: '陈医师(默认)', role: '住院医师', language: 'zh-CN', active: true },
  { id: 'sp-2', name: 'Dr. Chen (English)', role: 'Resident', language: 'en-US', active: false },
  { id: 'sp-3', name: '陈医师(中英混合)', role: '住院医师', language: 'zh-EN', active: false },
];

// ============================================================
// 41. 文风指南
// ============================================================
export const STYLE_GUIDES_MOCK: Array<{ id: string; name: string; rules: string[]; isDefault: boolean }> = [
  {
    id: 'sg-1', name: '放射科标准文风', isDefault: true,
    rules: [
      '使用规范的解剖学命名(RSNA标准)',
      '测量数据使用公制单位(mm/cm)',
      '影像所见按解剖分区描述',
      '诊断意见应包含病变性质、部位、范围',
      '建议应具体明确,含时间或方案',
      '避免使用"大概""可能"等不确定用语(必要时标注置信度)',
    ],
  },
  {
    id: 'sg-2', name: '肿瘤评估文风', isDefault: false,
    rules: [
      '必须标注基线日期及测量方法',
      'RECIST 1.1靶病灶须编号逐一描述',
      '疗效评估须注明百分比变化',
      '新发病灶须单独强调标注',
      '建议含后续随访时间及方案建议',
    ],
  },
  {
    id: 'sg-3', name: '危急值报告文风', isDefault: false,
    rules: [
      '报告标题标注"危急值"字样',
      '危急值描述使用红色高亮',
      '须明确注明已电话通知临床医师及时间',
      '危急值处理建议应简洁明确',
      '记录接收医师姓名及科室',
    ],
  },
];

// ============================================================
// 42. ACR TI-RADS 模板
// ============================================================
const tiRadsGroups: StructuredFieldGroup[] = [
  { id: 'tirg1', label: '结节超声特征', labelEn: 'Nodule US Features', order: 1, collapsible: false, defaultExpanded: true },
  { id: 'tirg2', label: 'TI-RADS 评分', labelEn: 'TI-RADS Score', order: 2, collapsible: false, defaultExpanded: true },
  { id: 'tirg3', label: '管理建议', labelEn: 'Management', order: 3, collapsible: false, defaultExpanded: true },
];

const tiRadsFields: StructuredFieldDefinition[] = [
  { id: 'tirf1', key: 'noduleCountTi', label: '结节数量', labelEn: 'Nodule Count', type: 'number', required: true, group: 'tirg1', min: 0, max: 10, defaultValue: 1, order: 1 },
  { id: 'tirf2', key: 'composition', label: '成分', labelEn: 'Composition', type: 'enum', required: true, group: 'tirg1', options: [
    { value: 'cystic', label: '囊性(0分)', labelEn: 'Cystic (0 pts)' },
    { value: 'spongiform', label: '海绵状(0分)', labelEn: 'Spongiform (0 pts)' },
    { value: 'mixed', label: '囊实混合(1分)', labelEn: 'Mixed Cystic/Solid (1 pt)' },
    { value: 'solid', label: '实性(2分)', labelEn: 'Solid (2 pts)' },
  ], order: 2 },
  { id: 'tirf3', key: 'echogenicity', label: '回声', labelEn: 'Echogenicity', type: 'enum', required: true, group: 'tirg1', options: [
    { value: 'anechoic', label: '无回声(0分)', labelEn: 'Anechoic (0 pts)' },
    { value: 'hyperechoic', label: '高回声(1分)', labelEn: 'Hyperechoic (1 pt)' },
    { value: 'isoechoic', label: '等回声(1分)', labelEn: 'Isoechoic (1 pt)' },
    { value: 'hypoechoic', label: '低回声(2分)', labelEn: 'Hypoechoic (2 pts)' },
    { value: 'veryHypoechoic', label: '极低回声(3分)', labelEn: 'Very Hypoechoic (3 pts)' },
  ], order: 3 },
  { id: 'tirf4', key: 'shape', label: '形态', labelEn: 'Shape', type: 'enum', required: true, group: 'tirg1', options: [
    { value: 'wider', label: '横径>纵径(0分)', labelEn: 'Wider-than-Tall (0 pts)' },
    { value: 'taller', label: '纵径>横径(3分)', labelEn: 'Taller-than-Wide (3 pts)' },
  ], order: 4 },
  { id: 'tirf5', key: 'margin', label: '边缘', labelEn: 'Margin', type: 'enum', required: true, group: 'tirg1', options: [
    { value: 'smooth', label: '光滑(0分)', labelEn: 'Smooth (0 pts)' },
    { value: 'illDefined', label: '模糊(0分)', labelEn: 'Ill-Defined (0 pts)' },
    { value: 'lobulated', label: '分叶状(2分)', labelEn: 'Lobulated (2 pts)' },
    { value: 'irregular', label: '不规则(2分)', labelEn: 'Irregular (2 pts)' },
    { value: 'extrathyroidal', label: '甲状腺外侵犯(3分)', labelEn: 'Extrathyroidal (3 pts)' },
  ], order: 5 },
  { id: 'tirf6', key: 'echogenicFoci', label: '强回声灶', labelEn: 'Echogenic Foci', type: 'enum', required: true, group: 'tirg1', options: [
    { value: 'none', label: '无/大彗星尾(0分)', labelEn: 'None/Large Comet-tail (0 pts)' },
    { value: 'macroCalc', label: '粗钙化(1分)', labelEn: 'Macrocalcifications (1 pt)' },
    { value: 'peripheral', label: '周边钙化(2分)', labelEn: 'Peripheral (2 pts)' },
    { value: 'punctate', label: '点状强回声(3分)', labelEn: 'Punctate Foci (3 pts)' },
  ], order: 6 },
  { id: 'tirf7', key: 'nodule1SizeTi', label: '结节 1 最大径(mm)', labelEn: 'Nodule 1 Size', type: 'number', required: true, group: 'tirg1', min: 0, max: 100, unit: 'mm', order: 7 },
  { id: 'tirf8', key: 'nodule2SizeTi', label: '结节 2 最大径(mm)', labelEn: 'Nodule 2 Size', type: 'number', required: false, group: 'tirg1', min: 0, max: 100, unit: 'mm', order: 8 },
  { id: 'tirf9', key: 'nodule1LocationTi', label: '结节 1 位置', labelEn: 'Nodule 1 Location', type: 'enum', required: true, group: 'tirg1', options: [
    { value: 'isthmus', label: '峡部', labelEn: 'Isthmus' },
    { value: 'rightLobe', label: '右叶', labelEn: 'Right Lobe' },
    { value: 'leftLobe', label: '左叶', labelEn: 'Left Lobe' },
    { value: 'pyramidal', label: '锥体叶', labelEn: 'Pyramidal Lobe' },
  ], order: 9 },
  { id: 'tirf10', key: 'nodule2LocationTi', label: '结节 2 位置', labelEn: 'Nodule 2 Location', type: 'enum', required: false, group: 'tirg1', options: [
    { value: 'isthmus', label: '峡部', labelEn: 'Isthmus' },
    { value: 'rightLobe', label: '右叶', labelEn: 'Right Lobe' },
    { value: 'leftLobe', label: '左叶', labelEn: 'Left Lobe' },
    { value: 'pyramidal', label: '锥体叶', labelEn: 'Pyramidal Lobe' },
  ], order: 10 },
  { id: 'tirf11', key: 'tiRadsScore', label: 'TI-RADS 总分', labelEn: 'TI-RADS Total Score', type: 'scale', required: true, group: 'tirg2', min: 0, max: 15, defaultValue: 3, order: 11, fillGuide: '成分+回声+形态+边缘+强回声灶各项分值之和' },
  { id: 'tirf12', key: 'tiRadsCategory', label: 'TI-RADS 分类', labelEn: 'TI-RADS Category', type: 'enum', required: true, group: 'tirg2', options: [
    { value: 'TR1', label: 'TR1 - 良性(0分)', labelEn: 'TR1 - Benign (0 pts)', color: '#10b981' },
    { value: 'TR2', label: 'TR2 - 无可疑(2分)', labelEn: 'TR2 - Not Suspicious (2 pts)', color: '#34d399' },
    { value: 'TR3', label: 'TR3 - 轻度可疑(3分)', labelEn: 'TR3 - Mildly Suspicious (3 pts)', color: 'var(--color-warning-500)' },
    { value: 'TR4', label: 'TR4 - 中度可疑(4-6分)', labelEn: 'TR4 - Moderately Suspicious (4-6 pts)', color: '#fb923c' },
    { value: 'TR5', label: 'TR5 - 高度可疑(7+分)', labelEn: 'TR5 - Highly Suspicious (7+ pts)', color: 'var(--color-error-600)' },
  ], defaultValue: 'TR3', order: 12 },
  { id: 'tirf13', key: 'tiRadsManagement', label: '管理建议', labelEn: 'TI-RADS Management', type: 'text', required: true, group: 'tirg3', order: 13, fillGuide: '根据ACR TI-RADS管理路径:TR2不须FNA;TR3≥2.5cm可FNA;TR4≥1.5cm需FNA;TR5≥1.0cm需FNA' },
  { id: 'tirf14', key: 'fnaRecommended', label: '建议FNA', labelEn: 'FNA Recommended', type: 'boolean', required: true, group: 'tirg3', defaultValue: false, order: 14 },
  { id: 'tirf15', key: 'nodule1Suspicious', label: '结节 1 可疑超声特征', labelEn: 'Nodule 1 Suspicious Features', type: 'multi-enum', required: false, group: 'tirg1', options: [
    { value: 'microcalc', label: '微钙化', labelEn: 'Microcalcifications' },
    { value: 'tallerWide', label: '纵径>横径', labelEn: 'Taller-than-Wide' },
    { value: 'irregularMargin', label: '不规则边缘', labelEn: 'Irregular Margin' },
  ], order: 101 },
  { id: 'tirf16', key: 'nodule2Suspicious', label: '结节 2 可疑超声特征', labelEn: 'Nodule 2 Suspicious Features', type: 'multi-enum', required: false, group: 'tirg1', options: [
    { value: 'microcalc', label: '微钙化', labelEn: 'Microcalcifications' },
    { value: 'tallerWide', label: '纵径>横径', labelEn: 'Taller-than-Wide' },
    { value: 'irregularMargin', label: '不规则边缘', labelEn: 'Irregular Margin' },
  ], order: 102 },
  { id: 'tirf17', key: 'lymphNodeMet', label: '淋巴结转移', labelEn: 'Lymph Node Metastasis', type: 'boolean', required: true, group: 'tirg1', defaultValue: false, order: 103 },
  { id: 'tirf18', key: 'thyroidVolume', label: '甲状腺体积(cc)', labelEn: 'Thyroid Volume', type: 'number', required: false, group: 'tirg1', min: 0, max: 100, unit: 'cc', order: 104 },
  { id: 'tirf19', key: 'imageUploadTi', label: '关键图像', labelEn: 'Key Image', type: 'image', required: false, group: 'tirg3', order: 105 },
  { id: 'tirf20', key: 'tiRadsAssessor', label: '评估医师', labelEn: 'Assessor', type: 'text', required: true, group: 'tirg3', order: 106 },
];

export const TI_RADS_TEMPLATE: StructuredTemplate = {
  id: 'tiRads',
  name: 'ACR TI-RADS 甲状腺结节分类',
  nameEn: 'ACR TI-RADS Thyroid Nodule',
  modality: 'US',
  bodyPart: '甲状腺',
  version: '1.0.3',
  fields: tiRadsFields,
  groups: tiRadsGroups,
  createdAt: '2026-04-01T08:00:00Z',
  updatedAt: '2026-09-10T10:00:00Z',
  author: 'G005 超声组',
  score: 4.7,
  tags: ['甲状腺', 'TI-RADS', '超声', '结节'],
  inheritable: true,
  approved: true,
  approver: '高主任',
};

// ============================================================
// 43. TNM 分期(AJCC 8th)模板
// ============================================================
const tnmGroups: StructuredFieldGroup[] = [
  { id: 'tnmg1', label: '原发肿瘤(T)', labelEn: 'Primary Tumor (T)', order: 1, collapsible: false, defaultExpanded: true },
  { id: 'tnmg2', label: '区域淋巴结(N)', labelEn: 'Regional Nodes (N)', order: 2, collapsible: false, defaultExpanded: true },
  { id: 'tnmg3', label: '远处转移(M)', labelEn: 'Distant Metastasis (M)', order: 3, collapsible: false, defaultExpanded: true },
  { id: 'tnmg4', label: '分期汇总', labelEn: 'Stage Summary', order: 4, collapsible: false, defaultExpanded: true },
];

const tnmFields: StructuredFieldDefinition[] = [
  { id: 'tnmf1', key: 'cancerType', label: '肿瘤类型', labelEn: 'Cancer Type', type: 'enum', required: true, group: 'tnmg1', options: [
    { value: 'lung', label: '肺癌', labelEn: 'Lung Cancer' },
    { value: 'breast', label: '乳腺癌', labelEn: 'Breast Cancer' },
    { value: 'colorectal', label: '结直肠癌', labelEn: 'Colorectal Cancer' },
    { value: 'prostate', label: '前列腺癌', labelEn: 'Prostate Cancer' },
    { value: 'gastric', label: '胃癌', labelEn: 'Gastric Cancer' },
    { value: 'hepatic', label: '肝癌', labelEn: 'Hepatocellular Carcinoma' },
    { value: 'pancreatic', label: '胰腺癌', labelEn: 'Pancreatic Cancer' },
    { value: 'esophageal', label: '食管癌', labelEn: 'Esophageal Cancer' },
    { value: 'cervical', label: '宫颈癌', labelEn: 'Cervical Cancer' },
    { value: 'headNeck', label: '头颈部鳞癌', labelEn: 'Head & Neck SCC' },
  ], order: 1 },
  { id: 'tnmf2', key: 'tCategory', label: 'T 分期', labelEn: 'T Category', type: 'enum', required: true, group: 'tnmg1', options: [
    { value: 'Tx', label: 'Tx - 原发肿瘤无法评估', labelEn: 'Tx - Cannot be assessed' },
    { value: 'T0', label: 'T0 - 无原发肿瘤证据', labelEn: 'T0 - No evidence' },
    { value: 'Tis', label: 'Tis - 原位癌', labelEn: 'Tis - Carcinoma in situ' },
    { value: 'T1', label: 'T1', labelEn: 'T1' },
    { value: 'T1a', label: 'T1a', labelEn: 'T1a' },
    { value: 'T1b', label: 'T1b', labelEn: 'T1b' },
    { value: 'T1c', label: 'T1c', labelEn: 'T1c' },
    { value: 'T2', label: 'T2', labelEn: 'T2' },
    { value: 'T2a', label: 'T2a', labelEn: 'T2a' },
    { value: 'T2b', label: 'T2b', labelEn: 'T2b' },
    { value: 'T3', label: 'T3', labelEn: 'T3' },
    { value: 'T3a', label: 'T3a', labelEn: 'T3a' },
    { value: 'T3b', label: 'T3b', labelEn: 'T3b' },
    { value: 'T4', label: 'T4', labelEn: 'T4' },
    { value: 'T4a', label: 'T4a', labelEn: 'T4a' },
    { value: 'T4b', label: 'T4b', labelEn: 'T4b' },
  ], order: 2 },
  { id: 'tnmf3', key: 'tumorSize', label: '肿瘤最大径(cm)', labelEn: 'Tumor Size (cm)', type: 'number', required: true, group: 'tnmg1', min: 0, max: 50, unit: 'cm', order: 3 },
  { id: 'tnmf4', key: 'tumorDescriptor', label: 'T 分期描述', labelEn: 'T Descriptor', type: 'multi-enum', required: false, group: 'tnmg1', options: [
    { value: 'visceralPleura', label: '脏层胸膜侵犯', labelEn: 'Visceral Pleura Invasion' },
    { value: 'chestWall', label: '胸壁侵犯', labelEn: 'Chest Wall Invasion' },
    { value: 'mediastinum', label: '纵隔侵犯', labelEn: 'Mediastinal Invasion' },
    { value: 'greatVessels', label: '大血管侵犯', labelEn: 'Great Vessel Invasion' },
    { value: 'recurrentNerve', label: '喉返神经侵犯', labelEn: 'Recurrent Nerve Invasion' },
  ], order: 4 },
  { id: 'tnmf5', key: 'nCategory', label: 'N 分期', labelEn: 'N Category', type: 'enum', required: true, group: 'tnmg2', options: [
    { value: 'Nx', label: 'Nx - 区域淋巴结无法评估', labelEn: 'Nx - Cannot be assessed' },
    { value: 'N0', label: 'N0 - 无区域淋巴结转移', labelEn: 'N0 - No regional metastasis' },
    { value: 'N1', label: 'N1', labelEn: 'N1' },
    { value: 'N1a', label: 'N1a', labelEn: 'N1a' },
    { value: 'N1b', label: 'N1b', labelEn: 'N1b' },
    { value: 'N1c', label: 'N1c', labelEn: 'N1c' },
    { value: 'N2', label: 'N2', labelEn: 'N2' },
    { value: 'N2a', label: 'N2a', labelEn: 'N2a' },
    { value: 'N2b', label: 'N2b', labelEn: 'N2b' },
    { value: 'N3', label: 'N3', labelEn: 'N3' },
  ], order: 5 },
  { id: 'tnmf6', key: 'nodesExamined', label: '检出淋巴结数', labelEn: 'Nodes Examined', type: 'number', required: false, group: 'tnmg2', min: 0, max: 100, order: 6 },
  { id: 'tnmf7', key: 'nodesPositive', label: '阳性淋巴结数', labelEn: 'Nodes Positive', type: 'number', required: false, group: 'tnmg2', min: 0, max: 100, order: 7 },
  { id: 'tnmf8', key: 'largestMetastasis', label: '最大转移淋巴结径(cm)', labelEn: 'Largest Metastasis (cm)', type: 'number', required: false, group: 'tnmg2', min: 0, max: 20, unit: 'cm', order: 8 },
  { id: 'tnmf9', key: 'extranodalExtension', label: '结外侵犯', labelEn: 'Extranodal Extension', type: 'boolean', required: true, group: 'tnmg2', defaultValue: false, order: 9 },
  { id: 'tnmf10', key: 'mCategory', label: 'M 分期', labelEn: 'M Category', type: 'enum', required: true, group: 'tnmg3', options: [
    { value: 'M0', label: 'M0 - 无远处转移', labelEn: 'M0 - No distant metastasis' },
    { value: 'M1', label: 'M1 - 有远处转移', labelEn: 'M1 - Distant metastasis' },
    { value: 'M1a', label: 'M1a', labelEn: 'M1a' },
    { value: 'M1b', label: 'M1b', labelEn: 'M1b' },
    { value: 'M1c', label: 'M1c', labelEn: 'M1c' },
  ], order: 10 },
  { id: 'tnmf11', key: 'metastasisSites', label: '转移部位', labelEn: 'Metastasis Sites', type: 'multi-enum', required: false, group: 'tnmg3', options: [
    { value: 'bone', label: '骨', labelEn: 'Bone' },
    { value: 'brain', label: '脑', labelEn: 'Brain' },
    { value: 'liver', label: '肝', labelEn: 'Liver' },
    { value: 'lung', label: '肺', labelEn: 'Lung' },
    { value: 'adrenal', label: '肾上腺', labelEn: 'Adrenal' },
    { value: 'peritoneum', label: '腹膜', labelEn: 'Peritoneum' },
    { value: 'lymph', label: '远处淋巴结', labelEn: 'Distant Lymph Node' },
  ], order: 11, dependsOn: { fieldKey: 'mCategory', equals: 'M1' } },
  { id: 'tnmf12', key: 'stageGroup', label: 'AJCC 分期组', labelEn: 'Stage Group', type: 'enum', required: true, group: 'tnmg4', options: [
    { value: '0', label: '0 期', labelEn: 'Stage 0' },
    { value: 'IA1', label: 'IA1 期', labelEn: 'Stage IA1' },
    { value: 'IA2', label: 'IA2 期', labelEn: 'Stage IA2' },
    { value: 'IB', label: 'IB 期', labelEn: 'Stage IB' },
    { value: 'IIA', label: 'IIA 期', labelEn: 'Stage IIA' },
    { value: 'IIB', label: 'IIB 期', labelEn: 'Stage IIB' },
    { value: 'IIIA', label: 'IIIA 期', labelEn: 'Stage IIIA' },
    { value: 'IIIB', label: 'IIIB 期', labelEn: 'Stage IIIB' },
    { value: 'IIIC', label: 'IIIC 期', labelEn: 'Stage IIIC' },
    { value: 'IVA', label: 'IVA 期', labelEn: 'Stage IVA' },
    { value: 'IVB', label: 'IVB 期', labelEn: 'Stage IVB' },
  ], order: 12 },
  { id: 'tnmf13', key: 'edition', label: 'AJCC 版本', labelEn: 'AJCC Edition', type: 'enum', required: true, group: 'tnmg4', options: [
    { value: '8th', label: '第8版', labelEn: '8th Edition' },
    { value: '9th', label: '第9版', labelEn: '9th Edition' },
  ], defaultValue: '8th', order: 13 },
  { id: 'tnmf14', key: 'tnmNotes', label: '分期说明', labelEn: 'Staging Notes', type: 'text', required: false, group: 'tnmg4', order: 14 },
  { id: 'tnmf15', key: 'tCategoryDetail', label: 'T 分期详细', labelEn: 'T Detail', type: 'text', required: false, group: 'tnmg1', order: 101 },
  { id: 'tnmf16', key: 'nCategoryDetail', label: 'N 分期详细', labelEn: 'N Detail', type: 'text', required: false, group: 'tnmg2', order: 102 },
  { id: 'tnmf17', key: 'mCategoryDetail', label: 'M 分期详细', labelEn: 'M Detail', type: 'text', required: false, group: 'tnmg3', order: 103 },
  { id: 'tnmf18', key: 'prognosticFactors', label: '预后因素', labelEn: 'Prognostic Factors', type: 'text', required: false, group: 'tnmg4', order: 104 },
  { id: 'tnmf19', key: 'imageUploadTnm', label: '关键图像', labelEn: 'Key Image', type: 'image', required: false, group: 'tnmg4', order: 105 },
  { id: 'tnmf20', key: 'tnmAssessor', label: '分期医师', labelEn: 'Staging Physician', type: 'text', required: true, group: 'tnmg4', order: 106 },
];

export const TNM_STAGING_TEMPLATE: StructuredTemplate = {
  id: 'tnm',
  name: 'AJCC 第8版 TNM 分期',
  nameEn: 'AJCC 8th Edition TNM Staging',
  modality: 'ALL',
  bodyPart: '全身',
  version: '8.1.0',
  fields: tnmFields,
  groups: tnmGroups,
  createdAt: '2026-03-01T08:00:00Z',
  updatedAt: '2026-09-15T10:00:00Z',
  author: 'G005 肿瘤分期组',
  score: 4.9,
  tags: ['TNM', '分期', 'AJCC', '肿瘤'],
  inheritable: true,
  approved: true,
  approver: '徐主任',
};

// ============================================================
// 44. 语音命令
// ============================================================
export const VOICE_COMMANDS_MOCK: VoiceCommand[] = [
  { command: '新建报告', english: 'New Report', description: '创建新的放射报告', category: 'workflow', shortcut: 'Ctrl+N' },
  { command: '保存报告', english: 'Save Report', description: '保存当前报告', category: 'workflow', shortcut: 'Ctrl+S' },
  { command: '提交审核', english: 'Submit Review', description: '提交报告进入审核流程', category: 'workflow' },
  { command: '签发报告', english: 'Sign Report', description: '电子签名并签发报告', category: 'workflow' },
  { command: '打开模板', english: 'Open Template', description: '打开模板选择面板', category: 'navigation' },
  { command: '插入模板', english: 'Insert Template', description: '将所选模板插入到报告', category: 'editing' },
  { command: '下一字段', english: 'Next Field', description: '跳转到下一个结构化字段', category: 'navigation' },
  { command: '上一字段', english: 'Previous Field', description: '跳转到上一个结构化字段', category: 'navigation' },
  { command: '添加图像', english: 'Add Image', description: '打开图像选择对话框', category: 'editing' },
  { command: '插入短语', english: 'Insert Phrase', description: '打开短语库插入常用短语', category: 'editing' },
  { command: '撤销', english: 'Undo', description: '撤销最近一次操作', category: 'editing' },
  { command: '重做', english: 'Redo', description: '重做被撤销的操作', category: 'editing' },
  { command: '加粗', english: 'Bold', description: '切换文字加粗格式', category: 'formatting' },
  { command: '斜体', english: 'Italic', description: '切换文字斜体格式', category: 'formatting' },
  { command: '下划线', english: 'Underline', description: '切换文字下划线格式', category: 'formatting' },
  { command: '增大字号', english: 'Increase Font', description: '增大选中文字字号', category: 'formatting' },
  { command: '减小字号', english: 'Decrease Font', description: '减小选中文字字号', category: 'formatting' },
  { command: '居中', english: 'Center Align', description: '将文字居中对齐', category: 'formatting' },
  { command: '左对齐', english: 'Left Align', description: '将文字左对齐', category: 'formatting' },
  { command: '右对齐', english: 'Right Align', description: '将文字右对齐', category: 'formatting' },
  { command: '听写开始', english: 'Start Dictation', description: '开始语音听写输入', category: 'dictation' },
  { command: '听写暂停', english: 'Pause Dictation', description: '暂停语音听写', category: 'dictation' },
  { command: '听写结束', english: 'Stop Dictation', description: '结束语音听写', category: 'dictation' },
  { command: '换行', english: 'New Line', description: '在光标处插入换行', category: 'dictation' },
  { command: '删除上句', english: 'Delete Last Sentence', description: '删除最后一句听写内容', category: 'dictation' },
  { command: '添加标注', english: 'Add Annotation', description: '在图像上添加标注', category: 'editing' },
  { command: '预览报告', english: 'Preview Report', description: '预览最终报告格式', category: 'navigation' },
  { command: '查找病历', english: 'Find Patient', description: '打开查找患者对话框', category: 'workflow' },
  { command: '调取历史', english: 'Load Prior Study', description: '调取患者既往影像检查', category: 'navigation' },
  { command: '用量角器', english: 'Angle Measurement', description: '启动角度测量工具', category: 'editing' },
];

// ============================================================
// 19. 100+ 报告列表虚拟化
// ============================================================
export interface VirtualReportRow {
  id: string;
  reportId: string;
  patientId: string;
  patientName: string;
  patientGender: '男' | '女';
  patientAge: number;
  modality: string;
  bodyPart: string;
  studyDate: string;
  status: string;
  authorName: string;
  reviewerName?: string;
  priority: '普通' | '紧急' | '危重' | '会诊';
  qualityScore: number;
  wordCount: number;
  writingDurationMin: number;
  hasCritical: boolean;
  templateName: string;
  group: 'draft' | 'review' | 'sign' | 'published' | 'special';
}

const PATIENT_NAMES = ['张敏', '李华', '王芳', '赵建国', '刘洋', '陈静', '杨阳', '黄海涛', '周琳', '吴桐', '徐文博', '孙文静', '马云', '朱凤', '胡军', '林涛', '何欣怡', '高翔', '罗明月', '郑伟杰'];
const MODALITIES = ['CT', 'MR', 'DR', 'US', 'MG', 'DSA', 'PET-CT'];
const BODY_PARTS = ['胸部', '腹部', '头颅', '盆腔', '脊柱', '四肢', '心脏', '血管', '乳腺', '前列腺'];
const AUTHORS = ['陈医师', '王医师', '李医师', '赵医师', '孙医师', '周医师', '吴医师', '郑医师'];
const STATUSES = ['待分配', '已分配', '书写中', '已提交', '初审中', '初审通过', '终审中', '已审核', '签发中', '已签发', '已发布', '修订中', '已修订'];
const TEMPLATES = ['胸部 CT 标准模板', '头颅 MR 标准模板', '上腹部 CT 增强模板', '乳腺钼靶标准模板', '腰椎 MR 平扫模板', '心脏 CTA 模板', '冠脉 CTA 模板', '颅脑 MR 增强模板', '前列腺 mpMRI 模板', '肺结节低剂量 CT 模板'];
const GROUPS: VirtualReportRow['group'][] = ['draft', 'review', 'sign', 'published', 'special'];

export const VIRTUAL_REPORT_LIST: VirtualReportRow[] = Array.from({ length: 120 }, (_, i) => {
  const group = GROUPS[i % 5] ?? 'draft';
  const statusIdx = (() => {
    switch (group) {
      case 'draft': return i % 3;
      case 'review': return 3 + (i % 6);
      case 'sign': return 8 + (i % 2);
      case 'published': return 10;
      case 'special': return 11 + (i % 3);
    }
  })();
  const status = STATUSES[statusIdx] ?? '书写中';
  const studyDate = new Date(Date.now() - (i * 86400000) - Math.random() * 86400000).toISOString();
  return {
    id: `vr-${i + 1}`,
    reportId: `RP${(2026000 + i).toString()}`,
    patientId: `p-${(1000 + i).toString()}`,
    patientName: PATIENT_NAMES[i % PATIENT_NAMES.length] ?? '匿名',
    patientGender: i % 2 === 0 ? '男' : '女',
    patientAge: 18 + (i % 70),
    modality: MODALITIES[i % MODALITIES.length] ?? 'CT',
    bodyPart: BODY_PARTS[i % BODY_PARTS.length] ?? '胸部',
    studyDate,
    status,
    authorName: AUTHORS[i % AUTHORS.length] ?? '陈医师',
    reviewerName: group === 'review' || group === 'sign' ? AUTHORS[(i + 1) % AUTHORS.length] : undefined,
    priority: (['普通', '紧急', '危重', '会诊'] as const)[i % 4] ?? '普通',
    qualityScore: 60 + (i % 40),
    wordCount: 150 + (i * 7) % 400,
    writingDurationMin: 8 + (i % 60),
    hasCritical: i % 15 === 0,
    templateName: TEMPLATES[i % TEMPLATES.length] ?? '胸部 CT 标准模板',
    group,
  };
});

export const VIRTUAL_REPORT_TOTAL = VIRTUAL_REPORT_LIST.length;

// ============================================================
// 结构化模板集合(必须在所有模板定义之后,防止 Vite 代码分割把函数与依赖拆分)
// v3.0.6.8-3 TDZ 根因修复
// ============================================================
let _allStructuredTemplatesCache: StructuredTemplate[] | null = null;
export function getStructuredTemplates(): StructuredTemplate[] {
  if (!_allStructuredTemplatesCache) {
    _allStructuredTemplatesCache = [
      RECIST_TEMPLATE,
      BIRADS_TEMPLATE,
      PIRADS_TEMPLATE,
      LUNG_RADS_TEMPLATE,
      CAD_RADS_TEMPLATE,
      LI_RADS_TEMPLATE,
      TI_RADS_TEMPLATE,
      C_RADS_TEMPLATE,
      O_RADS_TEMPLATE,
      TNM_STAGING_TEMPLATE,
    ];
  }
  return _allStructuredTemplatesCache;
}
