// ============================================================
// G005 放射科RIS系统 v1.0.4 - 质量评分 Mock 数据
// Phase R4：多维评分 / 缺陷字典 / AI 初稿
// ============================================================

// ============================================================
// 评分维度
// ============================================================
export interface ScoreDimension {
  id: string;
  name: string;
  weight: number;            // 权重 0-1
  description: string;
  evaluationCriteria: string[];
  scoringRules: { score: number; condition: string }[];
  color: string;
  icon: string;
}

export const SCORE_DIMENSIONS: ScoreDimension[] = [
  {
    id: 'dim-completeness',
    name: '完整性',
    weight: 0.30,
    description: '报告内容是否完整、字段无遗漏',
    evaluationCriteria: [
      '是否包含检查所见',
      '是否包含诊断意见',
      '是否包含建议',
      '结构化字段是否填写',
      '关键发现是否描述',
    ],
    scoringRules: [
      { score: 100, condition: '所有必填字段均填写完整' },
      { score: 80, condition: '90% 字段填写' },
      { score: 60, condition: '70% 字段填写' },
      { score: 40, condition: '50% 字段填写' },
      { score: 20, condition: '< 50% 字段填写' },
    ],
    color: '#3b82f6',
    icon: '',
  },
  {
    id: 'dim-standardization',
    name: '规范性',
    weight: 0.20,
    description: '报告格式、单位、术语是否规范',
    evaluationCriteria: [
      'CT 值是否注明 HU',
      '尺寸是否使用 mm×mm 格式',
      '术语是否符合标准（WS/T 500-2016）',
      '解剖方位是否正确（左右/上下）',
      '标点符号使用正确',
    ],
    scoringRules: [
      { score: 100, condition: '完全符合规范' },
      { score: 85, condition: '1-2 处不规范' },
      { score: 70, condition: '3-5 处不规范' },
      { score: 50, condition: '6-10 处不规范' },
      { score: 30, condition: '> 10 处不规范' },
    ],
    color: '#7c3aed',
    icon: '',
  },
  {
    id: 'dim-accuracy',
    name: '准确性',
    weight: 0.25,
    description: '诊断结论与影像所见是否一致',
    evaluationCriteria: [
      '结论是否与所见一致',
      '鉴别诊断是否充分',
      '是否有逻辑矛盾（阴/阳、未见/可见）',
      '危急值是否标注',
      '是否引用临床信息',
    ],
    scoringRules: [
      { score: 100, condition: '完全准确，逻辑严密' },
      { score: 80, condition: '1 处需斟酌' },
      { score: 60, condition: '2-3 处需斟酌' },
      { score: 40, condition: '存在明显矛盾' },
      { score: 20, condition: '存在严重错误' },
    ],
    color: '#10b981',
    icon: '',
  },
  {
    id: 'dim-timeliness',
    weight: 0.15,
    name: '及时性',
    description: '报告是否在规定时间内完成',
    evaluationCriteria: [
      '门急诊 ≤ 2 小时',
      '住院 ≤ 24 小时',
      'CT 平扫 ≤ 4 小时',
      'CT 增强 ≤ 8 小时',
      'MR ≤ 24 小时',
    ],
    scoringRules: [
      { score: 100, condition: '提前完成' },
      { score: 90, condition: '按时完成' },
      { score: 70, condition: '超时 1-4 小时' },
      { score: 50, condition: '超时 4-24 小时' },
      { score: 20, condition: '超时 > 24 小时' },
    ],
    color: '#f59e0b',
    icon: '',
  },
  {
    id: 'dim-terminology',
    name: '术语规范',
    weight: 0.10,
    description: '医学术语使用是否准确规范',
    evaluationCriteria: [
      '是否使用 ICD-10 编码',
      '是否使用 SNOMED CT',
      '是否使用标准放射学术语',
      '缩写是否规范',
      '是否使用同义词/否定词',
    ],
    scoringRules: [
      { score: 100, condition: '完全使用标准术语' },
      { score: 85, condition: '少量不规范表述' },
      { score: 70, condition: '存在错别字' },
      { score: 50, condition: '存在不规范缩写' },
      { score: 30, condition: '大量不规范' },
    ],
    color: '#0891b2',
    icon: '',
  },
];

// ============================================================
// 评分等级
// ============================================================
export type ScoreGrade = '甲' | '乙' | '丙' | '丁';

export interface ScoreGradeConfig {
  grade: ScoreGrade;
  minScore: number;
  maxScore: number;
  color: string;
  bg: string;
  border: string;
  description: string;
  action: string;
}

export const SCORE_GRADES: ScoreGradeConfig[] = [
  {
    grade: '甲', minScore: 90, maxScore: 100, color: '#047857', bg: '#d1fae5', border: '#6ee7b7',
    description: '优秀：报告内容完整、规范、准确，可作为模板',
    action: '推荐为优秀报告',
  },
  {
    grade: '乙', minScore: 75, maxScore: 89, color: '#1e40af', bg: '#dbeafe', border: '#93c5fd',
    description: '良好：基本规范，少量改进建议',
    action: '常规发布',
  },
  {
    grade: '丙', minScore: 60, maxScore: 74, color: '#92400e', bg: '#fef3c7', border: '#fcd34d',
    description: '合格：需修改后再发布',
    action: '退回修改',
  },
  {
    grade: '丁', minScore: 0, maxScore: 59, color: '#7f1d1d', bg: '#fee2e2', border: '#fca5a5',
    description: '不合格：存在严重错误',
    action: '必须重写',
  },
];

// ============================================================
// 缺陷分类字典
// ============================================================
export type DefectCategory = 'description' | 'terminology' | 'format' | 'logic' | 'critical' | 'completeness';

export interface DefectItem {
  id: string;
  code: string;
  name: string;
  category: DefectCategory;
  severity: 'minor' | 'major' | 'critical';
  description: string;
  examples: string[];
  solution: string;
  count: number;             // 模拟触发次数
}

export const DEFECT_LIBRARY: DefectItem[] = [
  // 描述问题
  { id: 'd-001', code: 'DSC-001', name: '描述过于简单', category: 'description', severity: 'major',
    description: '报告描述内容过于简短，缺乏必要细节',
    examples: ['仅"未见明显异常"无具体描述', '仅描述大小无形态/密度/边缘'],
    solution: '按"部位+形态+大小+密度+边缘+周围关系"六要素补全',
    count: 156 },
  { id: 'd-002', code: 'DSC-002', name: '描述不清', category: 'description', severity: 'major',
    description: '描述语句不通顺或专业术语不准确',
    examples: ['"中间有个黑的东西"', '"好像有问题"'],
    solution: '使用标准放射学术语重写',
    count: 89 },
  { id: 'd-003', code: 'DSC-003', name: '描述重复', category: 'description', severity: 'minor',
    description: '同一概念在报告中重复描述',
    examples: ['左右肺分别描述时内容雷同'],
    solution: '整合为统一描述或分维度描述',
    count: 67 },
  { id: 'd-004', code: 'DSC-004', name: '描述与图像不符', category: 'description', severity: 'critical',
    description: '描述内容与实际影像所见不一致',
    examples: ['报告说左肺但图像显示右肺', '数量描述错误'],
    solution: '重新阅片后重写',
    count: 23 },
  // 术语问题
  { id: 'd-010', code: 'TER-001', name: '术语不规范', category: 'terminology', severity: 'minor',
    description: '使用非标准或过时的术语',
    examples: ['"占位性病变"应改为"占位"', '"阴影"应改为"密度影"'],
    solution: '参照 WS/T 500-2016《卫生信息数据集》',
    count: 134 },
  { id: 'd-011', code: 'TER-002', name: '缩写不规范', category: 'terminology', severity: 'minor',
    description: '使用非标准缩写或首次使用未注明',
    examples: ['直接写"GGN"未说明', '使用"双肺纹"等不规范缩写'],
    solution: '首次使用全称 + 缩写',
    count: 78 },
  { id: 'd-012', code: 'TER-003', name: '错别字', category: 'terminology', severity: 'major',
    description: '存在错别字或同音字错误',
    examples: ['"纵隔"写成"纵膈"', '"密度"写成"密率"'],
    solution: '校对全文修正',
    count: 45 },
  // 格式问题
  { id: 'd-020', code: 'FMT-001', name: 'CT值缺单位', category: 'format', severity: 'minor',
    description: 'CT 值未注明 HU 单位',
    examples: ['"CT值约 25"应注明"CT值约 25HU"'],
    solution: '在 CT 值后添加"HU"',
    count: 198 },
  { id: 'd-021', code: 'FMT-002', name: '尺寸格式不规范', category: 'format', severity: 'minor',
    description: '尺寸未使用 mm×mm 格式',
    examples: ['"12*10mm"应使用"12mm×10mm"'],
    solution: '使用统一格式"长×宽"或"长×宽×高"',
    count: 156 },
  { id: 'd-022', code: 'FMT-003', name: '中英文标点混用', category: 'format', severity: 'minor',
    description: '中文报告中混入英文标点',
    examples: ['中英文逗号混用', '英文句号结尾'],
    solution: '全文使用中文标点',
    count: 89 },
  // 逻辑问题
  { id: 'd-030', code: 'LOG-001', name: '阴/阳矛盾', category: 'logic', severity: 'critical',
    description: '同一报告中阴性和阳性描述同时出现',
    examples: ['同时出现"未见"和"可见"'],
    solution: '统一结论，重新核对影像',
    count: 12 },
  { id: 'd-031', code: 'LOG-002', name: '左右混淆', category: 'logic', severity: 'critical',
    description: '左右侧描述与图像不符',
    examples: ['描述"右肺"但图像为左肺'],
    solution: '核对图像重新阅片',
    count: 8 },
  { id: 'd-032', code: 'LOG-033', name: '否定词歧义', category: 'logic', severity: 'major',
    description: '"未见"等否定词未配合修饰词',
    examples: ['单独使用"未见异常"过于绝对'],
    solution: '改为"未见明显异常"等修饰性表达',
    count: 67 },
  // 危急值
  { id: 'd-040', code: 'CRI-001', name: '危急值未标识', category: 'critical', severity: 'critical',
    description: '危急值报告未明确标识',
    examples: ['未在开头标注"危急值"'],
    solution: '在报告开头加"危急值"标识',
    count: 5 },
  { id: 'd-041', code: 'CRI-002', name: '危急值未通报', category: 'critical', severity: 'critical',
    description: '危急值未及时通知临床',
    examples: ['未在 10 分钟内通报'],
    solution: '立即电话/短信通知临床并记录',
    count: 3 },
  // 完整性
  { id: 'd-050', code: 'CMP-001', name: '缺检查所见', category: 'completeness', severity: 'major',
    description: '缺少"检查所见"段落',
    examples: ['仅有诊断意见没有所见'],
    solution: '补充检查所见段落',
    count: 34 },
  { id: 'd-051', code: 'CMP-002', name: '缺诊断意见', category: 'completeness', severity: 'major',
    description: '缺少"诊断意见"段落',
    examples: ['仅有检查所见没有诊断'],
    solution: '补充诊断意见段落',
    count: 28 },
  { id: 'd-052', code: 'CMP-003', name: '缺建议', category: 'completeness', severity: 'minor',
    description: '缺少"建议"段落',
    examples: ['未给出随访或进一步检查建议'],
    solution: '根据情况补充建议',
    count: 56 },
];

// ============================================================
// 评分历史（模拟）
// ============================================================
export interface QualityScoreRecord {
  id: string;
  reportId: string;
  patientName: string;
  modality: string;
  doctorId: string;
  doctorName: string;
  doctorTitle: string;
  dimensionScores: Record<string, number>;
  totalScore: number;
  grade: ScoreGrade;
  defects: string[];        // DefectItem.code 列表
  evaluatedBy: string;       // AI / 人工
  evaluatedAt: string;
  reviewStatus: 'pending' | 'reviewed' | 're-reviewed';
}

export const QUALITY_SCORE_HISTORY: QualityScoreRecord[] = [
  {
    id: 'qs-001', reportId: 'rpt-013', patientName: '黄海涛', modality: 'CT',
    doctorId: 'D002', doctorName: '李慧敏', doctorTitle: '副主任医师',
    dimensionScores: { 'dim-completeness': 92, 'dim-standardization': 88, 'dim-accuracy': 95, 'dim-timeliness': 100, 'dim-terminology': 90 },
    totalScore: 92, grade: '甲', defects: ['FMT-001', 'FMT-002'],
    evaluatedBy: 'AI', evaluatedAt: '2026-06-04 10:15:00', reviewStatus: 'reviewed',
  },
  {
    id: 'qs-002', reportId: 'rpt-021', patientName: '谢军', modality: 'CT',
    doctorId: 'D002', doctorName: '李慧敏', doctorTitle: '副主任医师',
    dimensionScores: { 'dim-completeness': 95, 'dim-standardization': 92, 'dim-accuracy': 98, 'dim-timeliness': 100, 'dim-terminology': 95 },
    totalScore: 96, grade: '甲', defects: [],
    evaluatedBy: '人工', evaluatedAt: '2026-06-02 14:30:00', reviewStatus: 'reviewed',
  },
  {
    id: 'qs-003', reportId: 'rpt-022', patientName: '邓丽娟', modality: 'CT',
    doctorId: 'D003', doctorName: '王建华', doctorTitle: '主治医师',
    dimensionScores: { 'dim-completeness': 85, 'dim-standardization': 90, 'dim-accuracy': 92, 'dim-timeliness': 100, 'dim-terminology': 88 },
    totalScore: 90, grade: '甲', defects: ['CMP-003'],
    evaluatedBy: 'AI', evaluatedAt: '2026-06-02 18:00:00', reviewStatus: 'reviewed',
  },
  {
    id: 'qs-004', reportId: 'rpt-023', patientName: '彭大伟', modality: 'MR',
    doctorId: 'D004', doctorName: '陈晓燕', doctorTitle: '住院医师',
    dimensionScores: { 'dim-completeness': 88, 'dim-standardization': 85, 'dim-accuracy': 90, 'dim-timeliness': 95, 'dim-terminology': 86 },
    totalScore: 88, grade: '乙', defects: ['TER-002', 'FMT-001'],
    evaluatedBy: 'AI', evaluatedAt: '2026-06-01 14:30:00', reviewStatus: 'reviewed',
  },
  {
    id: 'qs-005', reportId: 'rpt-048', patientName: '武志远', modality: 'CT',
    doctorId: 'D004', doctorName: '陈晓燕', doctorTitle: '住院医师',
    dimensionScores: { 'dim-completeness': 55, 'dim-standardization': 60, 'dim-accuracy': 65, 'dim-timeliness': 80, 'dim-terminology': 58 },
    totalScore: 60, grade: '丙', defects: ['DSC-001', 'CMP-001', 'CMP-002', 'DSC-004'],
    evaluatedBy: 'AI', evaluatedAt: '2026-05-14 12:00:00', reviewStatus: 're-reviewed',
  },
  {
    id: 'qs-006', reportId: 'rpt-049', patientName: '段丽娟', modality: 'MR',
    doctorId: 'D007', doctorName: '孙立军', doctorTitle: '主治医师',
    dimensionScores: { 'dim-completeness': 50, 'dim-standardization': 55, 'dim-accuracy': 60, 'dim-timeliness': 70, 'dim-terminology': 55 },
    totalScore: 55, grade: '丁', defects: ['DSC-001', 'DSC-002', 'CMP-002'],
    evaluatedBy: 'AI', evaluatedAt: '2026-05-13 13:30:00', reviewStatus: 're-reviewed',
  },
];

// ============================================================
// AI 初稿模板（基于临床病史自动生成）
// ============================================================
export interface AIDraftTemplate {
  id: string;
  scenario: string;        // 临床场景
  modality: string;
  bodyPart: string;
  clinicalHistory: string;
  generatedFindings: string;
  generatedDiagnosis: string;
  generatedImpression: string;
  confidence: number;       // AI 置信度 0-1
  sources: string[];        // 参考来源
}

export const AI_DRAFT_TEMPLATES: AIDraftTemplate[] = [
  {
    id: 'aid-001',
    scenario: '胸部 CT 平扫筛查',
    modality: 'CT', bodyPart: '胸部',
    clinicalHistory: '55 岁男性，年度体检，无明显症状。',
    generatedFindings: '双肺纹理清晰，肺野透亮度正常，未见明显异常密度影。气管支气管通畅，纵隔居中，纵隔窗示心脏大血管形态正常，未见肿大淋巴结。双侧胸膜未见增厚，胸腔未见积液。',
    generatedDiagnosis: '胸部 CT 平扫未见明显异常。',
    generatedImpression: '胸部 CT 平扫未见明显异常。建议年度随访。',
    confidence: 0.95,
    sources: ['AI 模型 v2.3', '卫健委指南 2024', '相关文献 12 篇'],
  },
  {
    id: 'aid-002',
    scenario: '肺结节筛查',
    modality: 'CT', bodyPart: '胸部',
    clinicalHistory: '62 岁女性，体检发现右肺结节 1 周。',
    generatedFindings: '右肺上叶后段见一磨玻璃密度结节影，边界欠清，大小约 8mm×7mm，密度不均，未见明显钙化。余肺野清晰，未见异常密度影。纵隔未见肿大淋巴结。',
    generatedDiagnosis: '右肺上叶磨玻璃结节，性质待定，建议 Lung-RADS 评估。',
    generatedImpression: '右肺上叶磨玻璃结节（Lung-RADS 3-4A 类可能），建议 3 个月后低剂量 CT 复查，必要时穿刺活检明确病理。',
    confidence: 0.88,
    sources: ['AI 模型 v2.3', 'Lung-RADS 2.0', 'Fleischner Society 指南'],
  },
  {
    id: 'aid-003',
    scenario: '肝脏占位评估',
    modality: 'CT', bodyPart: '腹部',
    clinicalHistory: '58 岁男性，肝硬化随访。',
    generatedFindings: '肝体积缩小，表面凹凸不平，呈结节状改变，提示肝硬化。肝右叶见一类圆形稍低密度影，大小约 2.5cm×2.2cm，边界欠清，三期增强扫描示"快进快出"强化方式。门脉主干直径约 14mm，脾大，腹水少量。',
    generatedDiagnosis: '1. 肝硬化；2. 肝右叶占位，原发性肝细胞癌可能。',
    generatedImpression: '肝硬化背景下肝右叶占位，考虑 HCC 可能性大（LI-RADS 5 类）。建议 MRI 增强 + DWI 进一步评估。',
    confidence: 0.92,
    sources: ['AI 模型 v2.3', 'LI-RADS v2018', 'AASLD 指南'],
  },
  {
    id: 'aid-004',
    scenario: '脑梗死急诊',
    modality: 'CT', bodyPart: '头颅',
    clinicalHistory: '70 岁男性，突发右侧肢体无力 3 小时。',
    generatedFindings: '左侧基底节区见片状低密度影，边界欠清，CT 值约 22HU。脑室系统无扩大、变形、移位。中线结构居中。颅骨骨质完整。',
    generatedDiagnosis: '左侧基底节区脑梗死（急性期可能）。',
    generatedImpression: '左侧基底节区低密度灶，符合急性脑梗死表现。危急值，建议立即神经内科会诊，评估静脉溶栓 / 机械取栓适应症。',
    confidence: 0.93,
    sources: ['AI 模型 v2.3', 'ESO 急性缺血性卒中指南 2021', 'AHA/ASA 指南'],
  },
  {
    id: 'aid-005',
    scenario: '腰椎间盘突出评估',
    modality: 'MR', bodyPart: '脊柱',
    clinicalHistory: '45 岁男性，腰腿痛 3 个月。',
    generatedFindings: 'L4/5 椎间盘向后方突出约 5mm，压迫硬膜囊及左侧神经根，相应椎管狭窄。L5/S1 椎间盘轻度膨出，未见明显神经根受压。',
    generatedDiagnosis: 'L4/5 椎间盘突出（左后型），L5/S1 椎间盘膨出。',
    generatedImpression: 'L4/5 椎间盘突出伴左神经根受压。保守治疗无效时建议骨科会诊评估手术指征。',
    confidence: 0.90,
    sources: ['AI 模型 v2.3', '北美脊柱外科协会指南'],
  },
  {
    id: 'aid-006',
    scenario: '乳腺钼靶筛查',
    modality: 'MG', bodyPart: '胸部',
    clinicalHistory: '48 岁女性，乳腺癌筛查。',
    generatedFindings: '双侧乳腺呈混合型致密腺体，腺体内未见明确肿块影，未见可疑钙化。皮肤及皮下脂肪层清晰，乳头未见内陷。',
    generatedDiagnosis: '双乳钼靶 BI-RADS 1 类（阴性）。',
    generatedImpression: '双乳钼靶 BI-RADS 1 类。建议年度筛查。',
    confidence: 0.94,
    sources: ['AI 模型 v2.3', 'BI-RADS 第 5 版', 'ACR 指南'],
  },
];

// ============================================================
// 质量统计 KPI
// ============================================================
export interface QualityKPI {
  totalEvaluated: number;
  avgScore: number;
  gradeDistribution: Record<ScoreGrade, number>;
  gradeRate: Record<ScoreGrade, number>;
  defectTopList: Array<{ code: string; name: string; count: number }>;
  doctorRanking: Array<{ doctorName: string; avgScore: number; totalReports: number }>;
  aiAcceptanceRate: number;
  retrainingNeeded: number;
}

export const QUALITY_KPI: QualityKPI = {
  totalEvaluated: 1248,
  avgScore: 87.5,
  gradeDistribution: { '甲': 624, '乙': 437, '丙': 156, '丁': 31 },
  gradeRate: { '甲': 50.0, '乙': 35.0, '丙': 12.5, '丁': 2.5 },
  defectTopList: [
    { code: 'FMT-001', name: 'CT值缺单位', count: 198 },
    { code: 'DSC-001', name: '描述过于简单', count: 156 },
    { code: 'FMT-002', name: '尺寸格式不规范', count: 156 },
    { code: 'TER-001', name: '术语不规范', count: 134 },
    { code: 'TER-002', name: '缩写不规范', count: 78 },
  ],
  doctorRanking: [
    { doctorName: '赵雪琴（主任医师）', avgScore: 94.5, totalReports: 89 },
    { doctorName: '张明远（主任医师）', avgScore: 92.8, totalReports: 156 },
    { doctorName: '李慧敏（副主任医师）', avgScore: 91.2, totalReports: 134 },
    { doctorName: '刘文博（副主任医师）', avgScore: 90.5, totalReports: 98 },
    { doctorName: '王建华（主治医师）', avgScore: 88.3, totalReports: 178 },
  ],
  aiAcceptanceRate: 78.5,
  retrainingNeeded: 23,
};

export default {
  SCORE_DIMENSIONS,
  SCORE_GRADES,
  DEFECT_LIBRARY,
  QUALITY_SCORE_HISTORY,
  AI_DRAFT_TEMPLATES,
  QUALITY_KPI,
};

// [v3.0.6.8-27] 扩充评分历史 6→150+ 条, 缺陷库 19→60+


import { QUALITY_SCORE_PRE } from './_generators';

// 扩充 QUALITY_SCORE_HISTORY 6→150+ (用预生成数据)
export const QUALITY_SCORE_HISTORY_FULL = QUALITY_SCORE_PRE.length > 0
  ? (QUALITY_SCORE_PRE as unknown as typeof QUALITY_SCORE_HISTORY)
  : QUALITY_SCORE_HISTORY;
