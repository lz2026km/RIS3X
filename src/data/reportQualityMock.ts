/**
 * G005 RIS v3.0.5.1 - R3.QUALITY 质控 Mock 数据
 */
import type {
  QualityScore,
  QualityDimension,
  QualityGradeConfig,
  QualityWeightConfig,
  QualityKPI,
  QualityDefect,
  QualityRuleVersion,
  QualityDashboard,
  MonthlyQualityReport,
  DefectRemediation,
  QualityScoringConfig,
} from '../types/R3/R3.QUALITY';

const isoNow = () => new Date().toISOString();
const isoOffset = (h: number) => new Date(Date.now() + h * 3600 * 1000).toISOString();
const isoDaysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

export const QUALITY_DIMENSIONS: QualityDimension[] = [
  {
    key: 'completeness', name: '完整性', nameEn: 'Completeness',
    description: '报告内容是否完整、字段无遗漏', descriptionEn: 'Report completeness - all required fields filled',
    weight: 0.20, enabled: true, color: '#3b82f6', icon: '📋',
    subCriteria: [
      { key: 'has-findings', name: '包含检查所见', nameEn: 'Has findings', weight: 0.30, description: '包含完整的检查所见段落', evaluator: 'auto', passingRule: '必须存在"检查所见"或"影像表现"段落' },
      { key: 'has-diagnosis', name: '包含诊断意见', nameEn: 'Has diagnosis', weight: 0.30, description: '包含完整的诊断意见段落', evaluator: 'auto', passingRule: '必须存在"诊断意见"或"诊断"段落' },
      { key: 'has-impression', name: '包含印象', nameEn: 'Has impression', weight: 0.15, description: '包含诊断印象段落', evaluator: 'auto', passingRule: '必须存在"印象"或"提示"段落' },
      { key: 'has-recommendation', name: '包含建议', nameEn: 'Has recommendation', weight: 0.10, description: '包含随访或建议', evaluator: 'auto', passingRule: '应包含"建议"或"随访"内容' },
      { key: 'structured-fields', name: '结构化字段', nameEn: 'Structured fields', weight: 0.15, description: '结构化字段填写完整', evaluator: 'auto', passingRule: '关键结构化字段填写率 >= 80%' },
    ],
  },
  {
    key: 'standardization', name: '规范性', nameEn: 'Standardization',
    description: '报告格式、单位、术语是否规范', descriptionEn: 'Format, units and terminology compliance',
    weight: 0.15, enabled: true, color: '#7c3aed', icon: '📐',
    subCriteria: [
      { key: 'unit-ct-hu', name: 'CT值含HU', nameEn: 'CT value has HU', weight: 0.25, description: 'CT值后注明HU单位', evaluator: 'auto', passingRule: 'CT值后必须有HU单位' },
      { key: 'size-format', name: '尺寸规范', nameEn: 'Size format', weight: 0.25, description: '尺寸使用mm×mm格式', evaluator: 'auto', passingRule: '应使用"长×宽mm"格式' },
      { key: 'anatomy-correct', name: '解剖方位', nameEn: 'Anatomy orientation', weight: 0.20, description: '解剖方位正确（左/右/上/下）', evaluator: 'ai', passingRule: '解剖方位与图像一致' },
      { key: 'punctuation', name: '标点正确', nameEn: 'Punctuation', weight: 0.15, description: '标点符号使用正确', evaluator: 'auto', passingRule: '中文标点使用正确' },
      { key: 'format-template', name: '格式模板', nameEn: 'Format template', weight: 0.15, description: '符合报告模板格式', evaluator: 'auto', passingRule: '段落结构符合模板' },
    ],
  },
  {
    key: 'accuracy', name: '准确性', nameEn: 'Accuracy',
    description: '诊断结论与影像所见是否一致', descriptionEn: 'Findings-diagnosis consistency',
    weight: 0.20, enabled: true, color: '#10b981', icon: '🎯',
    subCriteria: [
      { key: 'findings-match', name: '所见-结论一致', nameEn: 'Findings match', weight: 0.30, description: '结论与所见一致', evaluator: 'ai', passingRule: '诊断与所见描述一致' },
      { key: 'differential', name: '鉴别诊断', nameEn: 'Differential', weight: 0.20, description: '鉴别诊断充分', evaluator: 'ai', passingRule: '关键疾病需有鉴别' },
      { key: 'no-contradiction', name: '无逻辑矛盾', nameEn: 'No contradiction', weight: 0.20, description: '无阴/阳矛盾', evaluator: 'ai', passingRule: '全文无阴/阳矛盾' },
      { key: 'critical-marked', name: '危急值标记', nameEn: 'Critical marked', weight: 0.15, description: '危急值明确标识', evaluator: 'ai', passingRule: '危急值报告有明确标记' },
      { key: 'clinical-ref', name: '引用临床', nameEn: 'Clinical reference', weight: 0.15, description: '引用临床信息', evaluator: 'ai', passingRule: '结合临床病史/化验' },
    ],
  },
  {
    key: 'timeliness', name: '及时性', nameEn: 'Timeliness',
    description: '报告是否在规定时间内完成', descriptionEn: 'Completion within TAT',
    weight: 0.10, enabled: true, color: '#f59e0b', icon: '⏱️',
    subCriteria: [
      { key: 'tat-met', name: 'TAT达标', nameEn: 'TAT met', weight: 0.50, description: '在规定时间内完成', evaluator: 'auto', passingRule: '门急诊<2h/住院<24h/CT<4h' },
      { key: 'tat-priority', name: '优先级处理', nameEn: 'Priority handling', weight: 0.30, description: '按优先级处理', evaluator: 'auto', passingRule: 'STAT/急诊优先处理' },
      { key: 'on-time-rate', name: '按时率', nameEn: 'On-time rate', weight: 0.20, description: '个人按时率', evaluator: 'auto', passingRule: '按时率 >= 90%' },
    ],
  },
  {
    key: 'terminology', name: '术语规范', nameEn: 'Terminology',
    description: '医学术语使用是否准确规范', descriptionEn: 'Standard terminology usage',
    weight: 0.10, enabled: true, color: '#0891b2', icon: '📚',
    subCriteria: [
      { key: 'icd10-used', name: 'ICD-10 编码', nameEn: 'ICD-10', weight: 0.20, description: '使用 ICD-10 编码', evaluator: 'auto', passingRule: '诊断使用 ICD-10 编码' },
      { key: 'snomed-used', name: 'SNOMED CT', nameEn: 'SNOMED', weight: 0.15, description: '使用 SNOMED CT', evaluator: 'auto', passingRule: '关键概念使用 SNOMED' },
      { key: 'radlex-used', name: 'RadLex术语', nameEn: 'RadLex', weight: 0.25, description: '使用 RadLex 标准术语', evaluator: 'auto', passingRule: '解剖/所见使用 RadLex' },
      { key: 'abbr-correct', name: '缩写规范', nameEn: 'Abbreviation', weight: 0.20, description: '缩写使用规范', evaluator: 'auto', passingRule: '首次使用全称+缩写' },
      { key: 'no-typo', name: '无错别字', nameEn: 'No typo', weight: 0.20, description: '无错别字', evaluator: 'auto', passingRule: '无错别字/同音字错误' },
    ],
  },
  {
    key: 'criticalMarking', name: '危急值标注', nameEn: 'Critical Marking',
    description: '危急值是否正确标注与通报', descriptionEn: 'Critical finding marking and notification',
    weight: 0.10, enabled: true, color: '#dc2626', icon: '⚠️',
    subCriteria: [
      { key: 'critical-mark', name: '标识危急值', nameEn: 'Mark critical', weight: 0.30, description: '报告开头标识危急值', evaluator: 'ai', passingRule: '报告开头有危急值标记' },
      { key: 'critical-notify', name: '通报临床', nameEn: 'Notify clinic', weight: 0.30, description: '10 分钟内通报临床', evaluator: 'auto', passingRule: '10 分钟内通报' },
      { key: 'critical-detail', name: '危急值描述', nameEn: 'Critical detail', weight: 0.20, description: '危急值描述具体', evaluator: 'ai', passingRule: '详细描述危急值' },
      { key: 'critical-consent', name: '通报确认', nameEn: 'Notify ack', weight: 0.20, description: '通报获得确认', evaluator: 'auto', passingRule: '临床已确认接收' },
    ],
  },
  {
    key: 'consistency', name: '一致性', nameEn: 'Consistency',
    description: '与既往报告/病理结果一致', descriptionEn: 'Consistency with prior/pathology',
    weight: 0.05, enabled: true, color: '#8b5cf6', icon: '🔄',
    subCriteria: [
      { key: 'prior-consistent', name: '与既往一致', nameEn: 'Prior consistent', weight: 0.50, description: '与既往报告一致', evaluator: 'ai', passingRule: '与既往报告趋势一致' },
      { key: 'pathology-match', name: '与病理一致', nameEn: 'Pathology match', weight: 0.50, description: '与病理结果一致', evaluator: 'ai', passingRule: '与病理结果一致' },
    ],
  },
  {
    key: 'imageQuality', name: '图像质量', nameEn: 'Image Quality',
    description: '影像质量是否符合诊断要求', descriptionEn: 'Image diagnostic quality',
    weight: 0.10, enabled: true, color: '#06b6d4', icon: '🖼️',
    subCriteria: [
      { key: 'snr', name: '信噪比', nameEn: 'SNR', weight: 0.20, description: '信噪比达标', evaluator: 'ai', passingRule: 'SNR >= 30dB' },
      { key: 'cnr', name: '对比度', nameEn: 'CNR', weight: 0.20, description: '对比度达标', evaluator: 'ai', passingRule: 'CNR >= 3' },
      { key: 'coverage', name: '扫描范围', nameEn: 'Coverage', weight: 0.20, description: '扫描范围完整', evaluator: 'ai', passingRule: '扫描范围完整' },
      { key: 'artifact', name: '伪影控制', nameEn: 'Artifact', weight: 0.20, description: '无明显伪影', evaluator: 'ai', passingRule: '无运动/金属伪影' },
      { key: 'protocol', name: '协议规范', nameEn: 'Protocol', weight: 0.20, description: '扫描协议规范', evaluator: 'auto', passingRule: '符合扫描协议' },
    ],
  },
];

export const QUALITY_GRADES: QualityGradeConfig[] = [
  { grade: '甲', minScore: 90, maxScore: 100, color: '#047857', bg: '#d1fae5', border: '#6ee7b7', description: '优秀：报告内容完整、规范、准确，可作为模板', descriptionEn: 'Excellent: complete, standardized, accurate', action: '推荐为优秀报告', publishable: true },
  { grade: '乙', minScore: 75, maxScore: 89, color: '#1e40af', bg: '#dbeafe', border: '#93c5fd', description: '良好：基本规范，少量改进建议', descriptionEn: 'Good: mostly compliant with minor improvements', action: '常规发布', publishable: true },
  { grade: '丙', minScore: 60, maxScore: 74, color: '#92400e', bg: '#fef3c7', border: '#fcd34d', description: '合格：需修改后再发布', descriptionEn: 'Pass: revise before publish', action: '退回修改', publishable: false },
  { grade: '丁', minScore: 0, maxScore: 59, color: '#7f1d1d', bg: '#fee2e2', border: '#fca5a5', description: '不合格：存在严重错误', descriptionEn: 'Fail: serious errors', action: '必须重写', publishable: false },
];

export const QUALITY_WEIGHTS: QualityWeightConfig = {
  completeness: 0.20, standardization: 0.15, accuracy: 0.20, timeliness: 0.10,
  terminology: 0.10, criticalMarking: 0.10, consistency: 0.05, imageQuality: 0.10,
  updatedAt: isoOffset(-720), updatedBy: 'D001', version: 3,
};

export const QUALITY_SCORING_CONFIG: QualityScoringConfig = {
  weights: QUALITY_WEIGHTS,
  grades: QUALITY_GRADES,
  hardFailItems: ['critical-not-marked', 'left-right-confusion', 'critical-not-notify'],
  passThreshold: 60,
  publishBlockThreshold: 60,
  autoEvaluateOn: ['submit', 'review', 'sign'],
  modelVersion: 'v2.3.1',
  useAI: true,
  useRadLex: true,
  useAcr: true,
  useRSNA: false,
};

export const QUALITY_SCORES: QualityScore[] = [
  {
    id: 'qs-001', reportId: 'rpt-013', patientName: '黄海涛', modality: 'CT',
    doctorId: 'D002', doctorName: '李慧敏', doctorTitle: '副主任医师',
    dimensionScores: { completeness: 92, standardization: 88, accuracy: 95, timeliness: 100, terminology: 90, criticalMarking: 85, consistency: 88, imageQuality: 92 },
    subScores: { 'has-findings': 100, 'has-diagnosis': 100, 'has-impression': 90, 'has-recommendation': 80, 'structured-fields': 90, 'unit-ct-hu': 100, 'size-format': 80, 'anatomy-correct': 100, 'punctuation': 90, 'format-template': 70, 'findings-match': 95, 'differential': 90, 'no-contradiction': 100, 'critical-marked': 80, 'clinical-ref': 95, 'tat-met': 100, 'tat-priority': 100, 'on-time-rate': 100, 'icd10-used': 80, 'snomed-used': 90, 'radlex-used': 95, 'abbr-correct': 100, 'no-typo': 90, 'critical-mark': 80, 'critical-notify': 90, 'critical-detail': 80, 'critical-consent': 90, 'prior-consistent': 90, 'pathology-match': 85, 'snr': 95, 'cnr': 90, 'coverage': 95, 'artifact': 90, 'protocol': 90 },
    totalScore: 92, grade: '甲',
    defects: ['FMT-001', 'FMT-002'],
    defectDetails: [
      { code: 'FMT-001', name: 'CT值缺单位', category: 'FMT', severity: 'minor', location: '检查所见', suggestion: 'CT值后添加HU', resolved: false },
      { code: 'FMT-002', name: '尺寸格式不规范', category: 'FMT', severity: 'minor', location: '检查所见', suggestion: '使用"长×宽mm"格式', resolved: false },
    ],
    evaluatedBy: 'AI', evaluatedAt: isoOffset(-2), modelVersion: 'v2.3.1', reviewStatus: 'reviewed',
    hash: 'q1w2e3r4', evidenceChain: [],
  },
  {
    id: 'qs-002', reportId: 'rpt-021', patientName: '谢军', modality: 'CT',
    doctorId: 'D002', doctorName: '李慧敏', doctorTitle: '副主任医师',
    dimensionScores: { completeness: 95, standardization: 92, accuracy: 98, timeliness: 100, terminology: 95, criticalMarking: 95, consistency: 95, imageQuality: 96 },
    subScores: {}, totalScore: 96, grade: '甲', defects: [], defectDetails: [],
    evaluatedBy: 'AI+人工', evaluatedAt: isoOffset(-120), modelVersion: 'v2.3.1', reviewStatus: 'reviewed', hash: 'q2w3e4r5',
  },
  {
    id: 'qs-003', reportId: 'rpt-022', patientName: '邓丽华', modality: 'CT',
    doctorId: 'D003', doctorName: '王建华', doctorTitle: '主治医师',
    dimensionScores: { completeness: 85, standardization: 90, accuracy: 92, timeliness: 100, terminology: 88, criticalMarking: 90, consistency: 85, imageQuality: 90 },
    subScores: {}, totalScore: 90, grade: '甲',
    defects: ['CMP-003'], defectDetails: [
      { code: 'CMP-003', name: '缺建议', category: 'CMP', severity: 'minor', suggestion: '补充建议', resolved: true, resolvedBy: 'D003', resolvedAt: isoOffset(-100) },
    ],
    evaluatedBy: 'AI', evaluatedAt: isoOffset(-110), modelVersion: 'v2.3.1', reviewStatus: 'reviewed', hash: 'q3w4e5r6',
  },
  {
    id: 'qs-004', reportId: 'rpt-023', patientName: '彭大海', modality: 'MR',
    doctorId: 'D004', doctorName: '陈晓东', doctorTitle: '住院医师',
    dimensionScores: { completeness: 88, standardization: 85, accuracy: 90, timeliness: 95, terminology: 86, criticalMarking: 90, consistency: 80, imageQuality: 88 },
    subScores: {}, totalScore: 88, grade: '乙',
    defects: ['TER-002', 'FMT-001'], defectDetails: [
      { code: 'TER-002', name: '缩写不规范', category: 'TER', severity: 'minor', suggestion: '首次使用全称+缩写', resolved: false },
      { code: 'FMT-001', name: 'CT值缺单位', category: 'FMT', severity: 'minor', suggestion: 'CT值后添加HU', resolved: false },
    ],
    evaluatedBy: 'AI', evaluatedAt: isoOffset(-130), modelVersion: 'v2.3.1', reviewStatus: 'reviewed', hash: 'q4w5e6r7',
  },
  {
    id: 'qs-005', reportId: 'rpt-048', patientName: '武志强', modality: 'CT',
    doctorId: 'D004', doctorName: '陈晓东', doctorTitle: '住院医师',
    dimensionScores: { completeness: 55, standardization: 60, accuracy: 65, timeliness: 80, terminology: 58, criticalMarking: 60, consistency: 60, imageQuality: 70 },
    subScores: {}, totalScore: 60, grade: '丙',
    defects: ['DSC-001', 'CMP-001', 'CMP-002', 'DSC-004'], defectDetails: [
      { code: 'DSC-001', name: '描述过于简单', category: 'DSC', severity: 'major', suggestion: '补充六要素', resolved: true, resolvedBy: 'D004', resolvedAt: isoOffset(-200) },
      { code: 'CMP-001', name: '缺检查所见', category: 'CMP', severity: 'major', suggestion: '补充检查所见', resolved: true, resolvedBy: 'D004', resolvedAt: isoOffset(-200) },
      { code: 'CMP-002', name: '缺诊断意见', category: 'CMP', severity: 'major', suggestion: '补充诊断', resolved: true, resolvedBy: 'D004', resolvedAt: isoOffset(-200) },
      { code: 'DSC-004', name: '描述与图像不符', category: 'DSC', severity: 'critical', suggestion: '重新阅片', resolved: true, resolvedBy: 'D004', resolvedAt: isoOffset(-200) },
    ],
    evaluatedBy: 'AI', evaluatedAt: isoOffset(-220), modelVersion: 'v2.3.1', reviewStatus: 're-reviewed', hash: 'q5w6e7r8',
  },
  {
    id: 'qs-006', reportId: 'rpt-049', patientName: '段丽君', modality: 'MR',
    doctorId: 'D007', doctorName: '孙立人', doctorTitle: '主治医师',
    dimensionScores: { completeness: 50, standardization: 55, accuracy: 60, timeliness: 70, terminology: 55, criticalMarking: 50, consistency: 50, imageQuality: 65 },
    subScores: {}, totalScore: 55, grade: '丁',
    defects: ['DSC-001', 'DSC-002', 'CMP-002'], defectDetails: [
      { code: 'DSC-001', name: '描述过于简单', category: 'DSC', severity: 'major', suggestion: '补充六要素', resolved: false },
      { code: 'DSC-002', name: '描述不清', category: 'DSC', severity: 'major', suggestion: '使用标准术语', resolved: false },
      { code: 'CMP-002', name: '缺诊断意见', category: 'CMP', severity: 'major', suggestion: '补充诊断', resolved: false },
    ],
    evaluatedBy: 'AI', evaluatedAt: isoOffset(-240), modelVersion: 'v2.3.1', reviewStatus: 'pending', hash: 'q6w7e8r9',
  },
];

export const QUALITY_KPI: QualityKPI = {
  totalEvaluated: 1248,
  avgScore: 87.5,
  p50Score: 88,
  p95Score: 96,
  gradeDistribution: { '甲': 624, '乙': 437, '丙': 156, '丁': 31 },
  gradeRate: { '甲': 50.0, '乙': 35.0, '丙': 12.5, '丁': 2.5 },
  defectTopList: [
    { code: 'FMT-001', name: 'CT值缺单位', count: 198, severity: 'minor' },
    { code: 'DSC-001', name: '描述过于简单', count: 156, severity: 'major' },
    { code: 'FMT-002', name: '尺寸格式不规范', count: 156, severity: 'minor' },
    { code: 'TER-001', name: '术语不规范', count: 134, severity: 'minor' },
    { code: 'TER-002', name: '缩写不规范', count: 78, severity: 'minor' },
    { code: 'CMP-003', name: '缺建议', count: 56, severity: 'minor' },
    { code: 'DSC-002', name: '描述不清', count: 89, severity: 'major' },
  ],
  doctorRanking: [
    { doctorId: 'D006', doctorName: '赵雪琴', avgScore: 94.5, totalReports: 89, rank: 1 },
    { doctorId: 'D001', doctorName: '张明远', avgScore: 92.8, totalReports: 156, rank: 2 },
    { doctorId: 'D002', doctorName: '李慧敏', avgScore: 91.2, totalReports: 134, rank: 3 },
    { doctorId: 'D005', doctorName: '刘文博', avgScore: 90.5, totalReports: 98, rank: 4 },
    { doctorId: 'D003', doctorName: '王建华', avgScore: 88.3, totalReports: 178, rank: 5 },
    { doctorId: 'D004', doctorName: '陈晓东', avgScore: 84.2, totalReports: 142, rank: 6 },
  ],
  departmentRanking: [
    { department: 'CT室', avgScore: 89.5, totalReports: 487, rank: 1 },
    { department: 'MR室', avgScore: 88.2, totalReports: 412, rank: 2 },
    { department: '乳腺中心', avgScore: 90.1, totalReports: 156, rank: 1 },
    { department: '普放', avgScore: 85.0, totalReports: 193, rank: 3 },
  ],
  aiAcceptanceRate: 78.5,
  trend30d: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
    avgScore: 85 + Math.sin(i / 3) * 3 + (i / 30) * 2,
    evaluated: 35 + (i % 7) * 3,
    defectRate: 0.25 - (i / 30) * 0.05 + Math.sin(i / 2) * 0.03,
  })),
  autoRate: 95.0,
  retrainingNeeded: 23,
  criticalMissedCount: 2,
};

export const QUALITY_DEFECTS: QualityDefect[] = [
  { id: 'd-001', code: 'DSC-001', name: '描述过于简单', nameEn: 'Description too brief', category: 'DSC', severity: 'major', description: '报告描述内容过于简短，缺乏必要细节', descriptionEn: 'Description lacks necessary details', examples: ['"未见明显异常"无具体描述', '仅描述大小无形态/密度/边缘'], solution: '按"部位+形态+大小+密度+边缘+周围关系"六要素补充', solutionEn: 'Add six elements', references: ['WS/T 500-2016'], count: 156, isActive: true, customDefect: false, level: 1, tags: ['描述', '完整性'], sla: 24, trainingRequired: false, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-002', code: 'DSC-002', name: '描述不清', nameEn: 'Unclear description', category: 'DSC', severity: 'major', description: '描述语句不通顺或专业术语不准确', descriptionEn: 'Description not fluent or terminology inaccurate', examples: ['"中间有个黑的东西"', '"好像有问题"'], solution: '使用标准放射学术语重写', solutionEn: 'Use standard terminology', references: [], count: 89, isActive: true, customDefect: false, level: 1, tags: ['描述', '术语'], sla: 24, trainingRequired: true, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-003', code: 'DSC-003', name: '描述重复', nameEn: 'Redundant description', category: 'DSC', severity: 'minor', description: '同一概念在报告中重复描述', descriptionEn: 'Same concept described repeatedly', examples: ['左右肺分别描述时内容雷同'], solution: '整合为统一描述或分维度描述', solutionEn: 'Integrate into unified description', references: [], count: 67, isActive: true, customDefect: false, level: 1, tags: ['描述'], sla: 48, trainingRequired: false, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-004', code: 'DSC-004', name: '描述与图像不符', nameEn: 'Description inconsistent with image', category: 'DSC', severity: 'critical', description: '描述内容与实际影像所见不一致', descriptionEn: 'Description inconsistent with imaging findings', examples: ['报告说左肺但图像显示右肺', '数量描述错误'], solution: '重新阅片后重写', solutionEn: 'Re-read images and rewrite', references: [], count: 23, isActive: true, customDefect: false, level: 1, tags: ['描述', '准确性'], sla: 4, trainingRequired: true, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-005', code: 'DSC-005', name: '数据不一致', nameEn: 'Data inconsistency', category: 'DSC', severity: 'major', description: '报告中数据前后不一致', descriptionEn: 'Inconsistent data within report', examples: ['前面说2个结节，后面说3个'], solution: '核实后统一数据', solutionEn: 'Verify and unify data', references: [], count: 34, isActive: true, customDefect: false, level: 2, parentCode: 'DSC', tags: ['描述', '准确性'], sla: 24, trainingRequired: false, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-006', code: 'DSC-006', name: '格式不规范', nameEn: 'Format issue', category: 'DSC', severity: 'minor', description: '报告中存在格式不规范之处', descriptionEn: 'Format issues in report', examples: ['段落格式不统一'], solution: '按模板格式统一', solutionEn: 'Follow template format', references: [], count: 45, isActive: true, customDefect: false, level: 2, parentCode: 'DSC', tags: ['描述', '格式'], sla: 48, trainingRequired: false, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-010', code: 'TER-001', name: '术语不规范', nameEn: 'Non-standard terminology', category: 'TER', severity: 'minor', description: '使用非标准或过时的术语', descriptionEn: 'Using non-standard or outdated terms', examples: ['"占位性病变"应改为"占位"', '"阴影"应改为"密度"'], solution: '参照 WS/T 500-2016《卫生信息数据集》', solutionEn: 'Reference WS/T 500-2016', references: ['WS/T 500-2016'], count: 134, isActive: true, customDefect: false, level: 1, tags: ['术语'], sla: 48, trainingRequired: true, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-011', code: 'TER-002', name: '缩写不规范', nameEn: 'Non-standard abbreviation', category: 'TER', severity: 'minor', description: '使用非标准缩写或首次使用未注明', descriptionEn: 'Non-standard abbreviations', examples: ['直接用"GGN"未说明', '使用"双肺"等不规范缩写'], solution: '首次使用全称 + 缩写', solutionEn: 'Use full term + abbreviation', references: [], count: 78, isActive: true, customDefect: false, level: 1, tags: ['术语'], sla: 48, trainingRequired: true, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-012', code: 'TER-003', name: '错别字', nameEn: 'Typo', category: 'TER', severity: 'major', description: '存在错别字或同音字错误', descriptionEn: 'Typos or homophone errors', examples: ['"纵隔"写成"纵膈"', '"密度"写成"密率"'], solution: '校对全文修正', solutionEn: 'Proofread and correct', references: [], count: 45, isActive: true, customDefect: false, level: 1, tags: ['术语'], sla: 24, trainingRequired: false, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-013', code: 'TER-004', name: '英文术语错误', nameEn: 'English term error', category: 'TER', severity: 'minor', description: '英文术语使用不当', descriptionEn: 'English term misuse', examples: ['"mass"与"lesion"混用'], solution: '使用标准英文术语', solutionEn: 'Use standard English terms', references: [], count: 28, isActive: true, customDefect: false, level: 2, parentCode: 'TER', tags: ['术语', '英文'], sla: 48, trainingRequired: false, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-020', code: 'FMT-001', name: 'CT值缺单位', nameEn: 'CT value missing HU', category: 'FMT', severity: 'minor', description: 'CT值未注明HU单位', descriptionEn: 'CT value missing HU unit', examples: ['"CT值约25"应注明"CT值约25HU"'], solution: '在CT值后添加"HU"', solutionEn: 'Add HU after CT value', references: [], count: 198, isActive: true, customDefect: false, level: 1, tags: ['格式', 'CT'], sla: 24, trainingRequired: true, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-021', code: 'FMT-002', name: '尺寸格式不规范', nameEn: 'Size format issue', category: 'FMT', severity: 'minor', description: '尺寸未使用mm×mm格式', descriptionEn: 'Size not in mm×mm format', examples: ['"12*10mm"应使用"12mm×10mm"'], solution: '使用统一格式"长×宽"或"长×宽×高"', solutionEn: 'Use unified format', references: [], count: 156, isActive: true, customDefect: false, level: 1, tags: ['格式'], sla: 24, trainingRequired: true, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-022', code: 'FMT-003', name: '中英文标点混用', nameEn: 'Mixed punctuation', category: 'FMT', severity: 'minor', description: '中文报告中混入英文标点', descriptionEn: 'English punctuation in Chinese report', examples: ['中英文逗号混用', '英文句号结尾'], solution: '全文使用中文标点', solutionEn: 'Use Chinese punctuation', references: [], count: 89, isActive: true, customDefect: false, level: 1, tags: ['格式'], sla: 48, trainingRequired: false, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-023', code: 'FMT-004', name: '段落缺失', nameEn: 'Missing section', category: 'FMT', severity: 'major', description: '关键段落缺失', descriptionEn: 'Key section missing', examples: ['缺临床病史段'], solution: '补充关键段落', solutionEn: 'Add key sections', references: [], count: 23, isActive: true, customDefect: false, level: 2, parentCode: 'FMT', tags: ['格式'], sla: 24, trainingRequired: false, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-030', code: 'LOG-001', name: '阴阳矛盾', nameEn: 'Positive-negative contradiction', category: 'LOG', severity: 'critical', description: '同一报告中阴性和阳性描述同时出现', descriptionEn: 'Contradictory positive/negative descriptions', examples: ['同时出现"未见"和"可见"'], solution: '统一结论，重新核对影像', solutionEn: 'Unify conclusion, re-check', references: [], count: 12, isActive: true, customDefect: false, level: 1, tags: ['逻辑', '严重'], sla: 4, trainingRequired: true, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-031', code: 'LOG-002', name: '左右混淆', nameEn: 'Left-right confusion', category: 'LOG', severity: 'critical', description: '左右侧描述与图像不符', descriptionEn: 'Left-right description inconsistent with image', examples: ['描述"右肺"但图像为左肺'], solution: '核对图像重新阅片', solutionEn: 'Re-verify with image', references: [], count: 8, isActive: true, customDefect: false, level: 1, tags: ['逻辑', '严重'], sla: 4, trainingRequired: true, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-032', code: 'LOG-003', name: '否定词歧义', nameEn: 'Negation ambiguity', category: 'LOG', severity: 'major', description: '"未见"等否定词未配合修饰词', descriptionEn: 'Ambiguous negation', examples: ['单独使用"未见异常"过于绝对'], solution: '改为"未见明显异常"等修饰性表述', solutionEn: 'Use modified negation', references: [], count: 67, isActive: true, customDefect: false, level: 1, tags: ['逻辑'], sla: 24, trainingRequired: true, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-033', code: 'LOG-004', name: '逻辑矛盾', nameEn: 'Logical contradiction', category: 'LOG', severity: 'major', description: '报告中存在逻辑矛盾', descriptionEn: 'Logical contradictions', examples: ['前面说阴性，后面说阳性'], solution: '统一逻辑', solutionEn: 'Unify logic', references: [], count: 18, isActive: true, customDefect: false, level: 2, parentCode: 'LOG', tags: ['逻辑'], sla: 24, trainingRequired: false, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-040', code: 'CRI-001', name: '危急值未标识', nameEn: 'Critical not marked', category: 'CRI', severity: 'critical', description: '危急值报告未明确标识', descriptionEn: 'Critical finding not marked', examples: ['未在开头标记"危急值"'], solution: '在报告开头加"⚠ 危急值"标识', solutionEn: 'Add warning mark', references: [], count: 5, isActive: true, customDefect: false, level: 1, tags: ['危急值', '严重'], sla: 1, trainingRequired: true, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-041', code: 'CRI-002', name: '危急值未通报', nameEn: 'Critical not notified', category: 'CRI', severity: 'critical', description: '危急值未及时通知临床', descriptionEn: 'Critical finding not notified in time', examples: ['未在10分钟内通报'], solution: '立即电话/短信通知临床并记录', solutionEn: 'Notify immediately', references: [], count: 3, isActive: true, customDefect: false, level: 1, tags: ['危急值', '严重'], sla: 1, trainingRequired: true, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-050', code: 'CMP-001', name: '缺检查所见', nameEn: 'Missing findings', category: 'CMP', severity: 'major', description: '缺少"检查所见"段落', descriptionEn: 'Missing findings section', examples: ['仅有诊断意见没有所见'], solution: '补充检查所见段落', solutionEn: 'Add findings section', references: [], count: 34, isActive: true, customDefect: false, level: 1, tags: ['完整性'], sla: 24, trainingRequired: false, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-051', code: 'CMP-002', name: '缺诊断意见', nameEn: 'Missing diagnosis', category: 'CMP', severity: 'major', description: '缺少"诊断意见"段落', descriptionEn: 'Missing diagnosis section', examples: ['仅有检查所见没有诊断'], solution: '补充诊断意见段落', solutionEn: 'Add diagnosis section', references: [], count: 28, isActive: true, customDefect: false, level: 1, tags: ['完整性'], sla: 24, trainingRequired: false, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-052', code: 'CMP-003', name: '缺建议', nameEn: 'Missing recommendation', category: 'CMP', severity: 'minor', description: '缺少"建议"段落', descriptionEn: 'Missing recommendation', examples: ['未给出随访或进一步检查建议'], solution: '根据情况补充建议', solutionEn: 'Add recommendations', references: [], count: 56, isActive: true, customDefect: false, level: 1, tags: ['完整性'], sla: 48, trainingRequired: false, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-053', code: 'CMP-004', name: '缺临床信息', nameEn: 'Missing clinical info', category: 'CMP', severity: 'minor', description: '缺少临床病史/化验引用', descriptionEn: 'Missing clinical history', examples: ['未引用临床症状'], solution: '补充临床信息', solutionEn: 'Add clinical info', references: [], count: 67, isActive: true, customDefect: false, level: 2, parentCode: 'CMP', tags: ['完整性'], sla: 48, trainingRequired: false, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-060', code: 'CON-001', name: '图像与文字不一致', nameEn: 'Image-text inconsistency', category: 'CON', severity: 'major', description: '图像所见与文字描述不一致', descriptionEn: 'Image findings inconsistent with text', examples: ['图像见肿块但文字未描述'], solution: '核对图像后重写', solutionEn: 'Re-read and rewrite', references: [], count: 12, isActive: true, customDefect: false, level: 1, tags: ['一致性'], sla: 24, trainingRequired: true, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-070', code: 'IMG-001', name: '图像伪影', nameEn: 'Image artifact', category: 'IMG', severity: 'minor', description: '图像存在明显伪影', descriptionEn: 'Obvious artifacts in image', examples: ['运动伪影', '金属伪影'], solution: '重新扫描', solutionEn: 'Re-scan', references: [], count: 23, isActive: true, customDefect: false, level: 1, tags: ['图像'], sla: 24, trainingRequired: false, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
  { id: 'd-080', code: 'TIM-001', name: '超时', nameEn: 'TAT breach', category: 'TIM', severity: 'major', description: '报告超时完成', descriptionEn: 'Report completed over TAT', examples: ['CT平扫>4小时'], solution: '优化工作流', solutionEn: 'Optimize workflow', references: [], count: 45, isActive: true, customDefect: false, level: 1, tags: ['时效'], sla: 24, trainingRequired: false, createdBy: 'system', createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(30) },
];

export const QUALITY_RULE_VERSIONS: QualityRuleVersion[] = [
  { id: 'vrv-001', version: 'v2.3.1', effectiveAt: isoDaysAgo(30), createdBy: 'D001', createdAt: isoDaysAgo(30), changes: [{ dimension: 'criticalMarking', before: 0.05, after: 0.10, reason: '提升危急值标注权重' }], status: 'active' },
  { id: 'vrv-002', version: 'v2.3.0', effectiveAt: isoDaysAgo(90), createdBy: 'D001', createdAt: isoDaysAgo(90), changes: [{ dimension: 'consistency', before: 0.10, after: 0.05, reason: '一致性数据不足' }], status: 'archived' },
  { id: 'vrv-003', version: 'v2.2.0', effectiveAt: isoDaysAgo(180), createdBy: 'D006', createdAt: isoDaysAgo(180), changes: [], status: 'archived' },
];

export const QUALITY_DASHBOARD: QualityDashboard = {
  realtime: {
    pendingEvaluation: 3,
    completedToday: 47,
    inProgressEvaluation: 2,
    criticalMissedToday: 0,
  },
  byModality: [
    { modality: 'CT', count: 18, avgScore: 89, passRate: 0.92 },
    { modality: 'MR', count: 12, avgScore: 87, passRate: 0.90 },
    { modality: 'DR', count: 8, avgScore: 85, passRate: 0.86 },
    { modality: 'US', count: 5, avgScore: 88, passRate: 0.91 },
    { modality: 'MG', count: 4, avgScore: 92, passRate: 0.96 },
  ],
  byDoctor: [
    { doctorId: 'D002', doctorName: '李慧敏', count: 12, avgScore: 91, passRate: 0.94 },
    { doctorId: 'D001', doctorName: '张明远', count: 8, avgScore: 92, passRate: 0.95 },
    { doctorId: 'D003', doctorName: '王建华', count: 9, avgScore: 87, passRate: 0.88 },
    { doctorId: 'D005', doctorName: '刘文博', count: 7, avgScore: 90, passRate: 0.93 },
    { doctorId: 'D004', doctorName: '陈晓东', count: 6, avgScore: 84, passRate: 0.83 },
  ],
  byHour: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: Math.floor(Math.random() * 8) + (h >= 8 && h <= 17 ? 4 : 0), avgScore: 80 + Math.random() * 15 })),
  recentScores: QUALITY_SCORES.slice(0, 5).map((q) => ({ id: q.id, reportId: q.reportId, patientName: q.patientName, doctorName: q.doctorName, score: q.totalScore, grade: q.grade, evaluatedAt: q.evaluatedAt })),
  alerts: [
    { id: 'alert-001', type: 'low-score', message: '陈晓东 3 份报告评分<60', severity: 'warning', timestamp: isoOffset(-2) },
    { id: 'alert-002', type: 'critical-miss', message: '上午 1 份危急值未标识', severity: 'critical', timestamp: isoOffset(-4) },
    { id: 'alert-003', type: 'rejection-spike', message: '本周驳回率较上周上升 15%', severity: 'warning', timestamp: isoOffset(-12) },
  ],
};

export const MONTHLY_QUALITY_REPORT: MonthlyQualityReport = {
  id: 'mqr-2026-06', year: 2026, month: 6,
  totalReports: 248, avgScore: 88.5, monthOverMonth: 1.2,
  gradeDistribution: { '甲': 132, '乙': 78, '丙': 30, '丁': 8 },
  defectStatistics: [
    { code: 'FMT-001', name: 'CT值缺单位', count: 45, changeRate: -5.2 },
    { code: 'DSC-001', name: '描述过于简单', count: 32, changeRate: 2.1 },
    { code: 'FMT-002', name: '尺寸格式', count: 28, changeRate: -3.5 },
  ],
  doctorRanking: QUALITY_KPI.doctorRanking,
  departmentRanking: QUALITY_KPI.departmentRanking,
  trends: QUALITY_KPI.trend30d,
  topDefects: QUALITY_KPI.defectTopList.slice(0, 5),
  criticalMissed: 1,
  fixRate: 82.5,
  autoRate: 95.0,
  generatedAt: isoNow(), generatedBy: 'system',
  sections: [
    { key: 'overview', title: '质量总览', titleEn: 'Overview', content: '本月共评估 248 份报告，平均分 88.5，较上月提升 1.2 分。甲级率 53.2%，乙级率 31.5%，丙级率 12.1%，丁级率 3.2%。' },
    { key: 'defect', title: '缺陷分析', titleEn: 'Defect Analysis', content: '本月 Top 3 缺陷：CT值缺单位(45次)、描述过于简单(32次)、尺寸格式(28次)。' },
    { key: 'doctor', title: '医生排名', titleEn: 'Doctor Ranking', content: '本月 Top 3：赵雪琴(94.5)、张明远(92.8)、李慧敏(91.2)。' },
  ],
};

export const DEFECT_REMEDIATIONS: DefectRemediation[] = [
  { id: 'dr-001', defectCode: 'DSC-001', defectName: '描述过于简单', reportId: 'rpt-048', patientName: '武志强', doctorId: 'D004', doctorName: '陈晓东', reportedBy: 'system', reportedAt: isoDaysAgo(2), deadlineAt: isoDaysAgo(0), status: 'rectified', severity: 'major', description: '报告描述过于简短', suggestedFix: '按六要素补充', rectifiedAt: isoDaysAgo(0), rectifiedNote: '已补充完整描述', verifiedBy: 'D006', verifiedAt: isoDaysAgo(0), remindersSent: 1 },
  { id: 'dr-002', defectCode: 'TER-002', defectName: '缩写不规范', reportId: 'rpt-023', patientName: '彭大海', doctorId: 'D004', doctorName: '陈晓东', reportedBy: 'D005', reportedAt: isoDaysAgo(1), deadlineAt: isoDaysAgo(-1), status: 'in-progress', severity: 'minor', description: '首次使用GGN未注明全称', suggestedFix: '首次使用全称+缩写', remindersSent: 2 },
  { id: 'dr-003', defectCode: 'FMT-001', defectName: 'CT值缺单位', reportId: 'rpt-013', patientName: '黄海涛', doctorId: 'D002', doctorName: '李慧敏', reportedBy: 'AI', reportedAt: isoDaysAgo(0), deadlineAt: isoDaysAgo(-1), status: 'pending', severity: 'minor', description: 'CT值未注明HU', suggestedFix: 'CT值后添加HU', remindersSent: 0 },
  { id: 'dr-004', defectCode: 'CRI-001', defectName: '危急值未标识', reportId: 'rpt-016', patientName: '罗小雨', doctorId: 'D006', doctorName: '赵雪琴', reportedBy: 'D001', reportedAt: isoDaysAgo(3), deadlineAt: isoDaysAgo(2), status: 'rectified', severity: 'critical', description: '急性冠脉综合征未明确标识危急值', suggestedFix: '在报告开头加危急值标记', rectifiedAt: isoDaysAgo(2), rectifiedNote: '已加注危急值标识', verifiedBy: 'D001', verifiedAt: isoDaysAgo(2), remindersSent: 1 },
  { id: 'dr-005', defectCode: 'LOG-002', defectName: '左右混淆', reportId: 'rpt-022', patientName: '邓丽华', doctorId: 'D003', doctorName: '王建华', reportedBy: 'D006', reportedAt: isoDaysAgo(5), deadlineAt: isoDaysAgo(4), status: 'overdue', severity: 'critical', description: '左右侧描述与图像不符', suggestedFix: '核对图像重新阅片', remindersSent: 3 },
];

export default {
  QUALITY_DIMENSIONS,
  QUALITY_GRADES,
  QUALITY_WEIGHTS,
  QUALITY_SCORING_CONFIG,
  QUALITY_SCORES,
  QUALITY_KPI,
  QUALITY_DEFECTS,
  QUALITY_RULE_VERSIONS,
  QUALITY_DASHBOARD,
  MONTHLY_QUALITY_REPORT,
  DEFECT_REMEDIATIONS,
};

// [v3.0.6.8-27] 三甲级质控数据扩充 - QUALITY_SCORES 6→200+, DEFECT_REMEDIATIONS 5→30+
import { DOCTOR_MASTER } from './master/doctorMasterMock';
import { PATIENT_MASTER } from './master/patientMasterMock';
import { seedRandom, randInt, pick } from './_generators/medicalDataGen';

seedRandom(0xABCDEF);
const _DIMENSION_KEYS = ['completeness', 'standardization', 'accuracy', 'timeliness', 'terminology', 'criticalMarking', 'consistency', 'imageQuality'] as const;

// 预生成 200 条质量评分 (从原 6 条扩充到 206 条)
const GENERATED_SCORES: QualityScore[] = [];
for (let i = 0; i < 200; i++) {
  const doctor = pick(DOCTOR_MASTER.filter((d) => d.title !== '技师' && d.title !== '护士'));
  const patient = pick(PATIENT_MASTER);
  const modality = patient.modality;
  const baseScore = 75 + randInt(0, 20);
  const dimScores: Record<string, number> = {};
  _DIMENSION_KEYS.forEach((k) => { dimScores[k] = baseScore + randInt(-5, 5); });
  const total = Math.round(_DIMENSION_KEYS.reduce((s, k) => s + dimScores[k]!, 0) / _DIMENSION_KEYS.length);
  const grade = total >= 92 ? '甲' : total >= 85 ? '乙' : total >= 75 ? '丙' : '丁';
  const hasDefects = total < 90;
  GENERATED_SCORES.push({
    id: `qs-gen-${String(i + 1).padStart(4, '0')}`,
    reportId: `rpt-gen-${String(i + 1).padStart(6, '0')}`,
    patientName: patient.name,
    modality,
    doctorId: doctor.id,
    doctorName: doctor.name,
    doctorTitle: doctor.title,
    dimensionScores: dimScores as QualityScore['dimensionScores'],
    subScores: {},
    totalScore: total,
    grade: grade as QualityScore['grade'],
    defects: hasDefects ? ['FMT-001'] : [],
    defectDetails: [],
    evaluatedBy: pick(['AI', 'peer', 'chief']),
    evaluatedAt: new Date(Date.now() - randInt(1, 90) * 86400000).toISOString(),
    modelVersion: 'v2.3.1',
    reviewStatus: pick(['pending', 'reviewed', 'reviewed', 'reviewed']),
    hash: `g${i.toString(36)}${randInt(0, 100000).toString(36)}`,
    evidenceChain: [],
  });
}

// 扩充后的 QUALITY_SCORES (原 6 + 新 200 = 206 条)
export const QUALITY_SCORES_FULL: QualityScore[] = [...QUALITY_SCORES, ...GENERATED_SCORES];

// 扩充 DEFECT_REMEDIATIONS 5→30 条
export const DEFECT_REMEDIATIONS_FULL: DefectRemediation[] = [
  ...DEFECT_REMEDIATIONS,
  ...Array.from({ length: 25 }, (_, i) => {
    const doctor = pick(DOCTOR_MASTER.filter((d) => d.title !== '技师' && d.title !== '护士'));
    return {
      id: `drm-gen-${String(i + 1).padStart(3, '0')}`,
      defectCode: pick(['FMT-001', 'DSC-001', 'DSC-002', 'LOG-001', 'TIM-001', 'TER-001']),
      defectName: pick(['CT值缺单位', '尺寸格式不规范', '诊断不完整', '逻辑矛盾', '术语不规范', '超时']),
      reportId: `rpt-gen-${String(i + 1).padStart(6, '0')}`,
      patientName: pick(PATIENT_MASTER).name,
      doctorId: doctor.id,
      doctorName: doctor.name,
      reportedBy: 'D010',
      reportedAt: new Date(Date.now() - randInt(1, 30) * 86400000).toISOString(),
      deadlineAt: new Date(Date.now() + randInt(1, 14) * 86400000).toISOString(),
      status: pick(['pending', 'pending', 'in_progress', 'rectified', 'rectified']),
      severity: pick(['minor', 'minor', 'major', 'critical']) as DefectRemediation['severity'],
      description: pick([
        'CT值未标注HU单位',
        '报告诊断与影像表现不匹配',
        '使用非标准术语',
        '报告超时未签发',
        '测量值偏差较大',
        '关键发现未描述',
      ]),
      suggestedFix: pick([
        '添加HU单位',
        '补充鉴别诊断',
        '使用标准术语',
        '加快报告速度',
        '复核测量值',
        '补充关键发现',
      ]),
      rectifiedAt: null,
      rectifiedNote: '',
      verifiedBy: null,
      verifiedAt: null,
      remindersSent: randInt(0, 3),
    } as DefectRemediation;
  }),
];
