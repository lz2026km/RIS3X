// ============================================================
// G005 放射科RIS系统 v1.0.7 - 知识库 + 统计 Mock 数据
// Phase R7（收官）
// ============================================================

// ============================================================
// 词库（1000+ 词条，分类别）
// ============================================================
export type TermCategory = 'anatomy' | 'imaging_sign' | 'disease' | 'procedure' | 'modifier' | 'measurement' | 'syndrome';

export interface TermEntry {
  id: string;
  term: string;                    // 标准术语
  pinyin: string;                  // 拼音首字母
  category: TermCategory;
  modality: string[];              // 适用设备
  bodyPart: string[];
  definition: string;              // 定义
  synonyms: string[];              // 同义词
  relatedTerms: string[];          // 相关词
  icd10?: string;                  // ICD-10 编码
  snomed?: string;                 // SNOMED CT 编码
  usageCount: number;              // 使用次数
  exampleSentence?: string;        // 例句
  abbreviation?: string;           // 缩写
}

export const TERM_CATEGORIES: { key: TermCategory; label: string; color: string; bg: string; description: string }[] = [
  { key: 'anatomy',     label: '解剖结构', color: 'var(--color-primary-500)', bg: '#dbeafe', description: '人体解剖部位、器官名称' },
  { key: 'imaging_sign', label: '影像征象', color: '#7c3aed', bg: '#ede9fe', description: '放射学征象、影像表现' },
  { key: 'disease',     label: '疾病名称', color: 'var(--color-error-600)', bg: '#fee2e2', description: '诊断名称、病理分型' },
  { key: 'procedure',   label: '检查技术', color: 'var(--color-info-600)', bg: '#cffafe', description: '检查方法、技术参数' },
  { key: 'modifier',    label: '修饰词',   color: 'var(--color-warning-500)', bg: '#fef3c7', description: '程度、位置、范围描述' },
  { key: 'measurement', label: '测量单位', color: '#10b981', bg: '#d1fae5', description: '量化指标、计量单位' },
  { key: 'syndrome',    label: '综合征',   color: '#a855f7', bg: '#f3e8ff', description: '疾病综合征、复合表现' },
];

// 模拟 1000+ 词条（实际展示关键子集 + 总数）
export const TOTAL_TERMS_COUNT = 1247;

// 精选词条展示
export const FEATURED_TERMS: TermEntry[] = [
  // 解剖结构
  { id: 't-001', term: '右肺上叶', pinyin: 'yfsy', category: 'anatomy', modality: ['CT', 'DR'], bodyPart: ['胸部'],
    definition: '右肺上叶，右肺三叶中位于最上方的肺叶',
    synonyms: ['RUL', '右上叶'], relatedTerms: ['右肺中叶', '右肺下叶'],
    icd10: 'C34.11', usageCount: 8456, exampleSentence: '右肺上叶见一磨玻璃结节影',
    abbreviation: 'RUL' },
  { id: 't-002', term: '肝右叶', pinyin: 'gyy', category: 'anatomy', modality: ['CT', 'MR', 'US'], bodyPart: ['腹部'],
    definition: '肝脏右叶，位于右侧，占据肝脏大部分体积',
    synonyms: ['右半肝'], relatedTerms: ['肝左叶', '尾状叶'],
    usageCount: 6213, exampleSentence: '肝右叶见一类圆形低密度影' },
  { id: 't-003', term: 'L4/5 椎间盘', pinyin: 'zjp', category: 'anatomy', modality: ['MR', 'CT'], bodyPart: ['脊柱'],
    definition: '第 4 腰椎与第 5 腰椎之间的椎间盘',
    synonyms: ['腰 4/5'], relatedTerms: ['L5/S1', 'L3/4'],
    usageCount: 4123, exampleSentence: 'L4/5 椎间盘向后方突出约 5mm' },
  { id: 't-004', term: '左心室', pinyin: 'zxs', category: 'anatomy', modality: ['CT', 'MR', 'US'], bodyPart: ['心脏'],
    definition: '心脏四个腔室中最大的一个，负责将血液泵入体循环',
    synonyms: ['左室', 'LV'], relatedTerms: ['右心室', '左心房'],
    icd10: 'I51.7', usageCount: 5892, exampleSentence: '左心室壁运动弥漫性减弱' },
  // 影像征象
  { id: 't-010', term: '磨玻璃密度', pinyin: 'mbm', category: 'imaging_sign', modality: ['CT'], bodyPart: ['胸部'],
    definition: 'CT 上肺野模糊密度增高影，但支气管血管束仍可见',
    synonyms: ['GGN', '毛玻璃样'], relatedTerms: ['实性结节', '混合磨玻璃'],
    usageCount: 8932, exampleSentence: '右肺上叶见一磨玻璃密度结节' },
  { id: 't-011', term: '分叶征', pinyin: 'fyz', category: 'imaging_sign', modality: ['CT', 'DR'], bodyPart: ['胸部'],
    definition: '肿块边缘呈分叶状轮廓，提示恶性可能',
    synonyms: ['lobulated sign'], relatedTerms: ['毛刺征', '胸膜凹陷征'],
    usageCount: 4567, exampleSentence: '肿块边缘呈分叶状' },
  { id: 't-012', term: '毛刺征', pinyin: 'mcz', category: 'imaging_sign', modality: ['CT'], bodyPart: ['胸部'],
    definition: '肿块边缘向周围肺组织伸展的细短毛刺影',
    synonyms: ['spiculation'], relatedTerms: ['分叶征', '血管集束征'],
    usageCount: 3782, exampleSentence: '肿块边缘伴短毛刺' },
  { id: 't-013', term: '占位性病变', pinyin: 'zwx', category: 'imaging_sign', modality: ['CT', 'MR', 'US'], bodyPart: ['全身'],
    definition: '影像上发现的占位性异常，提示肿瘤或囊肿可能',
    synonyms: ['占位', '肿块', 'mass'], relatedTerms: ['肿块影', '占位效应'],
    usageCount: 12456, exampleSentence: '肝右叶见占位性病变' },
  // 疾病
  { id: 't-020', term: '原发性肝细胞癌', pinyin: 'HCC', category: 'disease', modality: ['CT', 'MR'], bodyPart: ['腹部'],
    definition: '起源于肝细胞的原发性恶性肿瘤',
    synonyms: ['HCC', '肝癌', '肝细胞癌'], relatedTerms: ['胆管细胞癌', '转移性肝癌'],
    icd10: 'C22.0', snomed: '109841003', usageCount: 5234,
    exampleSentence: '结合病史考虑原发性肝细胞癌可能' },
  { id: 't-021', term: '浸润性导管癌', pinyin: 'jxqd', category: 'disease', modality: ['MR', 'US'], bodyPart: ['乳腺'],
    definition: '乳腺导管上皮来源的浸润性恶性肿瘤',
    synonyms: ['IDC', '导管癌'], relatedTerms: ['原位癌', '小叶癌'],
    icd10: 'C50.9', snomed: '254837009', usageCount: 3456 },
  { id: 't-022', term: '急性脑梗死', pinyin: 'njg', category: 'disease', modality: ['CT', 'MR'], bodyPart: ['头颅'],
    definition: '脑动脉急性闭塞导致的脑组织缺血坏死',
    synonyms: ['缺血性卒中', 'stroke', '中风'], relatedTerms: ['TIA', '脑出血'],
    icd10: 'I63.9', snomed: '230690007', usageCount: 6789 },
  { id: 't-023', term: '肺栓塞', pinyin: 'fss', category: 'disease', modality: ['CT'], bodyPart: ['胸部'],
    definition: '内源性或外源性栓子堵塞肺动脉引起的疾病',
    synonyms: ['PE'], relatedTerms: ['肺梗死', '深静脉血栓'],
    icd10: 'I26.9', usageCount: 4123 },
  { id: 't-024', term: '主动脉夹层', pinyin: 'zdmjc', category: 'disease', modality: ['CT', 'MR'], bodyPart: ['胸部'],
    definition: '主动脉内膜撕裂，血液进入动脉壁形成真假腔',
    synonyms: ['AD'], relatedTerms: ['主动脉瘤', '主动脉溃疡'],
    icd10: 'I71.0', usageCount: 2345 },
  // 综合征
  { id: 't-030', term: '马凡综合征', pinyin: 'mfzhz', category: 'syndrome', modality: ['CT', 'MR'], bodyPart: ['全身'],
    definition: '常染色体显性遗传结缔组织病，累及心血管、骨骼、眼',
    synonyms: ['Marfan'], relatedTerms: ['主动脉夹层', '晶状体脱位'],
    icd10: 'Q87.4', usageCount: 856 },
  { id: 't-031', term: '布加综合征', pinyin: 'bczhz', category: 'syndrome', modality: ['CT', 'US'], bodyPart: ['腹部'],
    definition: '肝静脉流出道阻塞引起的门静脉高压',
    synonyms: ['BCS'], relatedTerms: ['肝硬化', '门静脉高压'],
    icd10: 'I82.0', usageCount: 567 },
  // 检查技术
  { id: 't-040', term: '增强扫描', pinyin: 'zqsm', category: 'procedure', modality: ['CT', 'MR'], bodyPart: ['全身'],
    definition: '经静脉注射对比剂后进行的影像扫描',
    synonyms: ['增强', 'contrast-enhanced'], relatedTerms: ['平扫', '动脉期', '静脉期', '延迟期'],
    usageCount: 12345, exampleSentence: '增强扫描示病灶呈不均匀强化' },
  { id: 't-041', term: '弥散加权成像', pinyin: 'dwi', category: 'procedure', modality: ['MR'], bodyPart: ['全身'],
    definition: '通过检测水分子布朗运动的无创成像技术',
    synonyms: ['DWI'], relatedTerms: ['ADC', '扩散张量成像'],
    usageCount: 5678, exampleSentence: 'DWI 序列示病灶明显弥散受限' },
  { id: 't-042', term: '磁共振胰胆管造影', pinyin: 'MRCP', category: 'procedure', modality: ['MR'], bodyPart: ['腹部'],
    definition: '利用重 T2 加权成像无创显示胰胆管系统',
    synonyms: ['MRCP'], relatedTerms: ['ERCP'],
    usageCount: 2345 },
  // 测量
  { id: 't-050', term: 'CT 值', pinyin: 'ctz', category: 'measurement', modality: ['CT'], bodyPart: ['全身'],
    definition: 'CT 图像上组织的 X 线衰减值，单位 HU',
    synonyms: ['HU值', 'CT number'], relatedTerms: ['Hounsfield'],
    usageCount: 9876, exampleSentence: 'CT 值约 35HU' },
  { id: 't-051', term: '表观弥散系数', pinyin: 'ADC', category: 'measurement', modality: ['MR'], bodyPart: ['全身'],
    definition: '反映组织水分子弥散能力的定量参数',
    synonyms: ['ADC值'], relatedTerms: ['DWI'],
    usageCount: 3456, exampleSentence: 'ADC 值约 0.8×10⁻³mm²/s' },
  // 修饰词
  { id: 't-060', term: '弥漫性', pinyin: 'mmx', category: 'modifier', modality: [], bodyPart: [],
    definition: '范围广泛，不限于局部',
    synonyms: ['广泛性', 'diffuse'], relatedTerms: ['局限性', '局灶性'],
    usageCount: 8765, exampleSentence: '双肺纹理弥漫性增粗' },
  { id: 't-061', term: '局限性', pinyin: 'jxx', category: 'modifier', modality: [], bodyPart: [],
    definition: '范围局限，限于局部',
    synonyms: ['局灶性', 'focal'], relatedTerms: ['弥漫性', '广泛性'],
    usageCount: 4567, exampleSentence: '肝右叶局限性低密度影' },
];

// 词条按分类统计
export const TERM_CATEGORY_STATS: Record<TermCategory, number> = {
  anatomy: 234,
  imaging_sign: 312,
  disease: 287,
  procedure: 156,
  modifier: 98,
  measurement: 76,
  syndrome: 84,
};

// ============================================================
// 短语库
// ============================================================
export type PhraseCategory = 'normal' | 'abnormal' | 'recommendation' | 'followup' | 'critical' | 'disclaimer';

export interface ReportPhrase {
  id: string;
  title: string;
  content: string;                // 短语正文（含占位符 {{placeholder}}）
  category: PhraseCategory;
  bodyPart: string[];
  modality: string[];
  scene: string;                  // 适用场景
  placeholders: string[];         // 占位符列表
  usageCount: number;
  rating: number;                 // 1-5 星
  tags: string[];
  author: string;
  createdAt: string;
}

export const PHRASE_CATEGORIES: { key: PhraseCategory; label: string; color: string; bg: string; description: string }[] = [
  { key: 'normal',       label: '正常描述', color: '#10b981', bg: '#d1fae5', description: '未见异常的正常报告短语' },
  { key: 'abnormal',     label: '异常描述', color: 'var(--color-error-600)', bg: '#fee2e2', description: '病变/异常所见短语' },
  { key: 'recommendation', label: '建议',     color: 'var(--color-primary-500)', bg: '#dbeafe', description: '进一步检查、治疗建议' },
  { key: 'followup',     label: '随访',     color: '#7c3aed', bg: '#ede9fe', description: '随访、复查建议' },
  { key: 'critical',     label: '危急值',   color: '#7f1d1d', bg: '#fecaca', description: '危急值通报标准用语' },
  { key: 'disclaimer',   label: '免责声明', color: '#94a3b8', bg: '#f1f5f9', description: '报告免责声明模板' },
];

export const REPORT_PHRASES: ReportPhrase[] = [
  { id: 'p-001', title: '胸部 CT 平扫正常所见', content: '双肺纹理清晰，肺野透亮度正常，未见明显异常密度影。气管支气管通畅，纵隔居中，纵隔窗示心脏大血管形态正常。未见肿大淋巴结。双侧胸膜未见增厚，胸腔未见积液。',
    category: 'normal', bodyPart: ['胸部'], modality: ['CT'],
    scene: '胸部 CT 平扫未见异常', placeholders: [], usageCount: 12456, rating: 5,
    tags: ['胸部', '平扫', '正常', 'CT'], author: '张明远', createdAt: '2024-03-15' },
  { id: 'p-002', title: '肺结节随访建议', content: '建议 {{timeframe}} 后低剂量 CT 复查，必要时穿刺活检明确病理。',
    category: 'followup', bodyPart: ['胸部'], modality: ['CT'],
    scene: '肺结节复查', placeholders: ['timeframe'], usageCount: 3456, rating: 4,
    tags: ['肺结节', '随访', 'Lung-RADS'], author: '李慧敏', createdAt: '2024-05-20' },
  { id: 'p-003', title: '脑梗死急性期发现', content: '危急值：脑内见符合急性脑梗死表现的低密度/异常信号影，建议立即神经内科会诊，评估静脉溶栓/机械取栓适应症。',
    category: 'critical', bodyPart: ['头颅'], modality: ['CT', 'MR'],
    scene: '急性脑卒中', placeholders: [], usageCount: 678, rating: 5,
    tags: ['危急值', '脑梗死', '卒中'], author: '张明远', createdAt: '2024-01-10' },
  { id: 'p-004', title: '冠脉重度狭窄', content: '危急值：{{artery}} 见重度狭窄约 {{percentage}}%，建议紧急心内科会诊，评估冠脉造影及 PCI 适应症。',
    category: 'critical', bodyPart: ['心脏'], modality: ['CT'],
    scene: '冠脉 CTA 重度狭窄', placeholders: ['artery', 'percentage'], usageCount: 432, rating: 5,
    tags: ['危急值', '冠脉', 'PCI'], author: '赵雪琴', createdAt: '2024-04-08' },
  { id: 'p-005', title: '肝脏占位诊断', content: '肝 {{location}} 见一 {{size}} 的 {{density}} 病灶，边界 {{boundary}}，增强扫描动脉期 {{apEnhance}}，静脉期 {{vpEnhance}}，延迟期 {{dpEnhance}}。',
    category: 'abnormal', bodyPart: ['腹部'], modality: ['CT', 'MR'],
    scene: '肝脏占位标准描述', placeholders: ['location', 'size', 'density', 'boundary', 'apEnhance', 'vpEnhance', 'dpEnhance'],
    usageCount: 2345, rating: 5,
    tags: ['肝脏', '占位', 'CT/MR'], author: '王建华', createdAt: '2024-02-28' },
  { id: 'p-006', title: '椎间盘突出', content: '{{level}} 椎间盘向 {{direction}} 突出约 {{size}}，{{compressNerve}}，相应椎管 {{canal}}。',
    category: 'abnormal', bodyPart: ['脊柱'], modality: ['MR', 'CT'],
    scene: '椎间盘突出标准描述', placeholders: ['level', 'direction', 'size', 'compressNerve', 'canal'],
    usageCount: 4123, rating: 5,
    tags: ['脊柱', '椎间盘', 'MR'], author: '陈晓燕', createdAt: '2024-06-12' },
  { id: 'p-007', title: '乳腺阴性报告', content: '双侧乳腺呈 {{density}} 型，腺体内未见明确肿块及可疑钙化，皮肤及皮下脂肪层清晰，乳头未见内陷。',
    category: 'normal', bodyPart: ['胸部'], modality: ['MG'],
    scene: '乳腺钼靶阴性', placeholders: ['density'], usageCount: 2156, rating: 4,
    tags: ['乳腺', 'BI-RADS'], author: '赵雪琴', createdAt: '2024-03-30' },
  { id: 'p-008', title: '免责声明', content: '本报告仅对本次检查负责，建议结合临床及其他检查综合判断。如有疑问请及时联系放射科。',
    category: 'disclaimer', bodyPart: [], modality: [],
    scene: '报告末尾', placeholders: [], usageCount: 18456, rating: 5,
    tags: ['通用', '免责'], author: '张明远', createdAt: '2024-01-01' },
  { id: 'p-009', title: '腹部超声正常所见', content: '肝脏大小形态正常，包膜光滑，实质回声均匀。胆囊大小正常，壁不厚，腔内未见结石影。胰腺大小正常，回声均匀。脾脏不大。双肾大小正常，集合系统无分离。',
    category: 'normal', bodyPart: ['腹部'], modality: ['US'],
    scene: '腹部超声未见异常', placeholders: [], usageCount: 8932, rating: 4,
    tags: ['腹部', '超声', '正常'], author: '刘文博', createdAt: '2024-04-22' },
  { id: 'p-010', title: '骨折描述', content: '{{bone}} 骨 {{location}} 可见 {{type}} 骨折线，{{displacement}}，{{angulation}}，周围软组织 {{softTissue}}。',
    category: 'abnormal', bodyPart: ['四肢', '脊柱'], modality: ['CT', 'DR'],
    scene: '骨折标准描述', placeholders: ['bone', 'location', 'type', 'displacement', 'angulation', 'softTissue'],
    usageCount: 1567, rating: 4,
    tags: ['骨折', 'CT', 'DR'], author: '张明远', createdAt: '2024-05-15' },
  { id: 'p-011', title: '消化道穿孔危急值', content: '危急值：膈下见游离气体，考虑消化道穿孔，建议立即外科会诊，必要时剖腹探查。',
    category: 'critical', bodyPart: ['腹部'], modality: ['CT', 'DR'],
    scene: '消化道穿孔', placeholders: [], usageCount: 234, rating: 5,
    tags: ['危急值', '穿孔', '消化道'], author: '刘文博', createdAt: '2024-03-08' },
  { id: 'p-012', title: '甲状腺结节随访', content: '建议 {{interval}} 复查甲状腺超声，必要时细针穿刺活检明确病理。如有压迫症状或结节快速增长，请及时就诊。',
    category: 'followup', bodyPart: ['颈部'], modality: ['US'],
    scene: '甲状腺结节随访', placeholders: ['interval'], usageCount: 1234, rating: 4,
    tags: ['甲状腺', 'TI-RADS', '随访'], author: '王建华', createdAt: '2024-07-05' },
];

// ============================================================
// KPI 大盘
// ============================================================
export interface ReportKPI {
  todayReports: number;
  monthReports: number;
  yearReports: number;
  pendingCount: number;
  signedCount: number;
  avgSignTime: number;            // 分钟
  criticalValueCount: number;
  criticalValueOnTimeRate: number;
  avgQualityScore: number;
  qualifiedRate: number;          // 甲级率
  aiUsageRate: number;
  blockchainVerified: number;
  deliverySuccessRate: number;
  electronicFilmRate: number;
  paperlessRate: number;
  carbonReduction: number;         // kg
  deviceUtilization: Array<{ device: string; rate: number; count: number }>;
  modalityDistribution: Record<string, number>;
  hourlyDistribution: number[];    // 24 小时
  weeklyTrend: number[];           // 7 天
}

export const REPORT_KPI: ReportKPI = {
  todayReports: 67,
  monthReports: 1845,
  yearReports: 21456,
  pendingCount: 12,
  signedCount: 1833,
  avgSignTime: 28,
  criticalValueCount: 23,
  criticalValueOnTimeRate: 91.3,
  avgQualityScore: 87.5,
  qualifiedRate: 50.0,
  aiUsageRate: 78.5,
  blockchainVerified: 28,
  deliverySuccessRate: 95.5,
  electronicFilmRate: 86.2,
  paperlessRate: 92.5,
  carbonReduction: 1.2,
  deviceUtilization: [
    { device: 'CT 1 (Siemens)', rate: 92.3, count: 856 },
    { device: 'CT 2 (GE)', rate: 88.1, count: 789 },
    { device: 'MR 1 (3.0T)', rate: 85.6, count: 645 },
    { device: 'MR 2 (1.5T)', rate: 78.4, count: 523 },
    { device: 'DR 1', rate: 75.2, count: 1234 },
    { device: 'MG', rate: 65.8, count: 234 },
  ],
  modalityDistribution: { 'CT': 1245, 'MR': 678, 'DR': 1234, 'US': 567, 'MG': 234, 'DSA': 45 },
  hourlyDistribution: [2, 1, 1, 0, 0, 1, 3, 12, 45, 89, 123, 156, 178, 165, 142, 128, 134, 156, 178, 145, 89, 45, 23, 12],
  weeklyTrend: [245, 267, 289, 256, 298, 312, 178],
};

// ============================================================
// 医生工作量
// ============================================================
export interface DoctorWorkload {
  doctorId: string;
  doctorName: string;
  doctorTitle: string;
  totalReports: number;
  avgPerDay: number;
  avgSignTime: number;
  qualityScore: number;
  approvedRate: number;
  rejectRate: number;
  criticalValueHandled: number;
  consultingHours: number;
  ranking: number;
  trend: 'up' | 'down' | 'flat';
  trendValue: number;
  byModality: Record<string, number>;
}

export const DOCTOR_WORKLOADS: DoctorWorkload[] = [
  { doctorId: 'D001', doctorName: '张明远', doctorTitle: '主任医师', totalReports: 345, avgPerDay: 11.5, avgSignTime: 18,
    qualityScore: 94.5, approvedRate: 98.2, rejectRate: 1.8, criticalValueHandled: 8, consultingHours: 12, ranking: 1, trend: 'up', trendValue: 8.5,
    byModality: { CT: 180, MR: 95, DR: 50, US: 15, MG: 5 } },
  { doctorId: 'D006', doctorName: '赵雪琴', doctorTitle: '主任医师', totalReports: 312, avgPerDay: 10.4, avgSignTime: 22,
    qualityScore: 93.8, approvedRate: 97.4, rejectRate: 2.6, criticalValueHandled: 5, consultingHours: 18, ranking: 2, trend: 'up', trendValue: 5.2,
    byModality: { CT: 145, MR: 88, MG: 56, US: 15, DR: 8 } },
  { doctorId: 'D002', doctorName: '李慧敏', doctorTitle: '副主任医师', totalReports: 289, avgPerDay: 9.6, avgSignTime: 25,
    qualityScore: 92.1, approvedRate: 96.8, rejectRate: 3.2, criticalValueHandled: 6, consultingHours: 22, ranking: 3, trend: 'flat', trendValue: 0.5,
    byModality: { CT: 145, MR: 78, DR: 45, US: 12, MG: 9 } },
  { doctorId: 'D005', doctorName: '刘文博', doctorTitle: '副主任医师', totalReports: 245, avgPerDay: 8.2, avgSignTime: 28,
    qualityScore: 90.5, approvedRate: 95.2, rejectRate: 4.8, criticalValueHandled: 7, consultingHours: 15, ranking: 4, trend: 'up', trendValue: 3.4,
    byModality: { CT: 110, MR: 65, DR: 50, US: 15, MG: 5 } },
  { doctorId: 'D003', doctorName: '王建华', doctorTitle: '主治医师', totalReports: 198, avgPerDay: 6.6, avgSignTime: 35,
    qualityScore: 88.3, approvedRate: 92.5, rejectRate: 7.5, criticalValueHandled: 3, consultingHours: 8, ranking: 5, trend: 'down', trendValue: -2.1,
    byModality: { CT: 78, MR: 45, US: 35, DR: 30, MG: 10 } },
  { doctorId: 'D004', doctorName: '陈晓燕', doctorTitle: '住院医师', totalReports: 145, avgPerDay: 4.8, avgSignTime: 42,
    qualityScore: 86.7, approvedRate: 89.5, rejectRate: 10.5, criticalValueHandled: 2, consultingHours: 5, ranking: 6, trend: 'up', trendValue: 12.5,
    byModality: { CT: 45, MR: 30, US: 35, DR: 25, MG: 10 } },
];

// ============================================================
// 诊断符合率
// ============================================================
export interface DiagnosisAccuracy {
  period: string;                   // 期间
  totalReports: number;
  pathConfirmed: number;            // 病理证实数
  clinicalConfirmed: number;        // 临床证实数
  imagingFollowupConfirmed: number; // 影像随访证实数
  totalConfirmed: number;            // 总证实
  accuracyRate: number;              // 总符合率
  sensitivity: number;               // 灵敏度
  specificity: number;               // 特异度
  positivePredictiveValue: number;   // 阳性预测值
  negativePredictiveValue: number;   // 阴性预测值
  byModality: Array<{ modality: string; accuracy: number; count: number }>;
  byDisease: Array<{ disease: string; accuracy: number; count: number }>;
}

export const DIAGNOSIS_ACCURACY_DATA: DiagnosisAccuracy = {
  period: '2026-06',
  totalReports: 1845,
  pathConfirmed: 234,
  clinicalConfirmed: 456,
  imagingFollowupConfirmed: 789,
  totalConfirmed: 1479,
  accuracyRate: 96.2,
  sensitivity: 92.5,
  specificity: 97.8,
  positivePredictiveValue: 94.3,
  negativePredictiveValue: 97.1,
  byModality: [
    { modality: 'CT', accuracy: 96.8, count: 856 },
    { modality: 'MR', accuracy: 97.5, count: 432 },
    { modality: 'DR', accuracy: 95.2, count: 312 },
    { modality: 'US', accuracy: 94.8, count: 178 },
    { modality: 'MG', accuracy: 97.2, count: 67 },
  ],
  byDisease: [
    { disease: '原发性肝癌', accuracy: 96.5, count: 78 },
    { disease: '肺癌', accuracy: 95.2, count: 145 },
    { disease: '乳腺癌', accuracy: 98.3, count: 67 },
    { disease: '脑梗死', accuracy: 98.9, count: 89 },
    { disease: '骨折', accuracy: 99.5, count: 234 },
    { disease: '主动脉夹层', accuracy: 100.0, count: 12 },
  ],
};

// ============================================================
// 报告及时率
// ============================================================
export interface TimelinessData {
  overallOnTimeRate: number;
  avgSignTime: number;              // 分钟
  onTimeByPriority: Array<{ priority: string; onTime: number; target: number; rate: number }>;
  onTimeByModality: Array<{ modality: string; onTime: number; target: number; rate: number }>;
  trend: Array<{ date: string; onTimeRate: number }>;
  overdue: Array<{ reportId: string; patientName: string; doctor: string; minutes: number }>;
}

export const TIMELINESS_DATA: TimelinessData = {
  overallOnTimeRate: 87.5,
  avgSignTime: 28,
  onTimeByPriority: [
    { priority: '急诊', onTime: 8, target: 5, rate: 95.2 },
    { priority: '加急', onTime: 45, target: 30, rate: 92.1 },
    { priority: '普通', onTime: 1567, target: 1440, rate: 86.8 },
  ],
  onTimeByModality: [
    { modality: 'CT', onTime: 1089, target: 1245, rate: 87.5 },
    { modality: 'MR', onTime: 612, target: 678, rate: 90.3 },
    { modality: 'DR', onTime: 1023, target: 1234, rate: 82.9 },
    { modality: 'US', onTime: 489, target: 567, rate: 86.2 },
  ],
  trend: [
    { date: '06-01', onTimeRate: 85.2 },
    { date: '06-02', onTimeRate: 86.1 },
    { date: '06-03', onTimeRate: 87.5 },
    { date: '06-04', onTimeRate: 88.2 },
    { date: '06-05', onTimeRate: 87.9 },
    { date: '06-06', onTimeRate: 89.1 },
    { date: '06-07', onTimeRate: 87.5 },
  ],
  overdue: [
    { reportId: 'rpt-008', patientName: '吴美丽', doctor: '李慧敏', minutes: 12 },
    { reportId: 'rpt-049', patientName: '段丽娟', doctor: '孙立军', minutes: 245 },
    { reportId: 'rpt-039', patientName: '余小红', doctor: '王建华', minutes: 48 },
  ],
};

export default {
  TOTAL_TERMS_COUNT,
  FEATURED_TERMS,
  TERM_CATEGORIES,
  TERM_CATEGORY_STATS,
  REPORT_PHRASES,
  PHRASE_CATEGORIES,
  REPORT_KPI,
  DOCTOR_WORKLOADS,
  DIAGNOSIS_ACCURACY_DATA,
  TIMELINESS_DATA,
};

// [v3.0.6.8-27] 扩充 DOCTOR_WORKLOADS 6→40, DIAGNOSIS_ACCURACY_DATA 加 6 个时期
import { DOCTOR_MASTER } from './master/doctorMasterMock';

export const DOCTOR_WORKLOADS_FULL: Array<DoctorWorkload | Record<string, unknown>> = [
  ...DOCTOR_WORKLOADS,
  ...DOCTOR_MASTER
    .filter((d) => d.title !== '技师' && d.title !== '护士')
    .slice(0, 34) // 已有 6 + 新 34 = 40
    .map((d) => ({
      doctorId: d.id,
      doctorName: d.name,
      title: d.title,
      department: d.subspecialty,
      monthlyReportCount: d.monthlyReportCount,
      monthlyCriticalCount: d.monthlyCriticalValueCount,
      avgReportTime: Math.round(120 + (Math.random() * 60)),
      defectRate: parseFloat(d.defectRate as unknown as string),
      onTimeRate: parseFloat(d.timelyRate as unknown as string),
      qualityScore: d.annualQCScore,
      cosignCount: d.monthlyCosignCount,
      trend: Math.random() > 0.5 ? 'up' : 'stable' as const,
    })),
];

// 扩充 DIAGNOSIS_ACCURACY_DATA 多期数据
export const DIAGNOSIS_ACCURACY_HISTORY = [
  DIAGNOSIS_ACCURACY_DATA,
  {
    ...DIAGNOSIS_ACCURACY_DATA,
    period: '2026-05',
    totalReports: 1820,
    sensitivity: 94.2,
    specificity: 96.8,
    ppv: 92.5,
    npv: 97.8,
    pathMatch: 91.3,
  },
  {
    ...DIAGNOSIS_ACCURACY_DATA,
    period: '2026-04',
    totalReports: 1756,
    sensitivity: 93.8,
    specificity: 96.5,
    ppv: 92.1,
    npv: 97.5,
    pathMatch: 90.8,
  },
  {
    ...DIAGNOSIS_ACCURACY_DATA,
    period: '2026-03',
    totalReports: 1645,
    sensitivity: 93.2,
    specificity: 96.1,
    ppv: 91.7,
    npv: 97.2,
    pathMatch: 90.2,
  },
  {
    ...DIAGNOSIS_ACCURACY_DATA,
    period: '2026-02',
    totalReports: 1392,
    sensitivity: 92.8,
    specificity: 95.8,
    ppv: 91.3,
    npv: 96.9,
    pathMatch: 89.7,
  },
  {
    ...DIAGNOSIS_ACCURACY_DATA,
    period: '2026-01',
    totalReports: 1456,
    sensitivity: 92.5,
    specificity: 95.6,
    ppv: 91.0,
    npv: 96.7,
    pathMatch: 89.3,
  },
];
