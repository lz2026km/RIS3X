// ============================================================
// G005 放射科RIS系统 v1.0.1 - 关键字纠错规则库
// Phase R1：解剖方位、阴/阳、否定词、标点、格式、病灶关键词
// ============================================================

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface KeywordRule {
  id: string;
  severity: IssueSeverity;
  message: string;
  suggestion: string;
}

export interface KeywordCheckResult {
  ruleId: string;
  matched: string;
  position: number;
}

export interface KeywordIssue {
  id: string;
  ruleId: string;
  severity: IssueSeverity;
  category: 'anatomy' | 'logic' | 'punctuation' | 'format' | 'completeness' | 'critical';
  message: string;
  suggestion: string;
  matched: string;
  position: number;
}

// ============================================================
// 1. 解剖方位成对规则
// ============================================================
export interface AnatomyPairRule extends KeywordRule {
  left: string;
  right: string;
  leftLabel: string;
  rightLabel: string;
}

export const ANATOMY_PAIR_RULES: AnatomyPairRule[] = [
  {
    id: 'left-right',
    severity: 'warning',
    left: '左侧', right: '右侧',
    leftLabel: '左侧', rightLabel: '右侧',
    message: '同一报告中同时出现"左侧"和"右侧"，请确认是否指向同一解剖结构',
    suggestion: '建议明确左右对应的解剖部位，如"左肺"和"右肺"分别描述',
  },
  {
    id: 'up-down',
    severity: 'info',
    left: '上叶', right: '下叶',
    leftLabel: '上叶', rightLabel: '下叶',
    message: '同一报告中同时出现"上叶"和"下叶"（肺），请确认是否同一患者',
    suggestion: '建议明确每个肺叶的具体描述',
  },
  {
    id: 'anterior-posterior',
    severity: 'info',
    left: '前壁', right: '后壁',
    leftLabel: '前壁', rightLabel: '后壁',
    message: '报告中同时出现"前壁"和"后壁"（心/胃），请确认描述准确性',
    suggestion: '建议分段描述每个壁的情况',
  },
  {
    id: 'inner-outer',
    severity: 'info',
    left: '内', right: '外',
    leftLabel: '内', rightLabel: '外',
    message: '报告中同时出现"内"和"外"方位词，注意描述准确性',
    suggestion: '建议明确内/外对应关系',
  },
];

// ============================================================
// 2. 阴/阳/见/未见矛盾规则
// ============================================================
export interface PosNegRule extends KeywordRule {
  negative: string;
  positive: string;
  negativeLabel: string;
  positiveLabel: string;
}

export const POS_NEG_WORD_RULES: PosNegRule[] = [
  {
    id: 'jian-weijian',
    severity: 'error',
    negative: '未见', positive: '可见',
    negativeLabel: '未见', positiveLabel: '可见',
    message: '"未见"与"可见"在同一报告中矛盾',
    suggestion: '请仔细检查描述，统一使用一种表达方式',
  },
  {
    id: 'pozhen-fou',
    severity: 'error',
    negative: '阴性', positive: '阳性',
    negativeLabel: '阴性', positiveLabel: '阳性',
    message: '"阴性"与"阳性"在同一报告中矛盾',
    suggestion: '请检查阳性/阴性判断，避免结论冲突',
  },
  {
    id: 'zhengchang-yichang',
    severity: 'error',
    negative: '正常', positive: '异常',
    negativeLabel: '正常', positiveLabel: '异常',
    message: '"正常"与"异常"在同一段落中矛盾',
    suggestion: '请检查描述，统一结论',
  },
  {
    id: 'mingxian-bumingxian',
    severity: 'warning',
    negative: '不明确', positive: '明确',
    negativeLabel: '不明确', positiveLabel: '明确',
    message: '"明确"与"不明确"在同一报告中矛盾',
    suggestion: '请使用一致的明确性判断',
  },
  {
    id: 'you-wu',
    severity: 'warning',
    negative: '无', positive: '有',
    negativeLabel: '无', positiveLabel: '有',
    message: '"有"与"无"在同一描述中矛盾',
    suggestion: '请仔细检查，统一表达',
  },
];

// ============================================================
// 3. 否定词列表（需配合"明显/明确"等修饰词使用）
// ============================================================
export const NEGATION_WORDS = ['未见', '无', '未发现', '没有', '不存在', '不显示'];

// ============================================================
// 4. 标点符号规则
// ============================================================
export interface PunctuationRule extends KeywordRule {
  pattern: RegExp;
}

export const PUNCTUATION_RULES: PunctuationRule[] = [
  {
    id: 'english-comma',
    severity: 'info',
    pattern: /[a-zA-Z],[a-zA-Z]/g,
    message: '报告中出现英文逗号","',
    suggestion: '中文报告中应使用中文逗号"，"',
  },
  {
    id: 'english-period',
    severity: 'info',
    pattern: /[a-zA-Z]\.[a-zA-Z\s]/g,
    message: '报告中可能存在英文句号"."',
    suggestion: '中文报告中应使用中文句号"。"',
  },
  {
    id: 'english-colon',
    severity: 'info',
    pattern: /[a-zA-Z]:[a-zA-Z]/g,
    message: '报告中可能存在英文冒号":"',
    suggestion: '中文报告中应使用中文冒号"："',
  },
  {
    id: 'multiple-exclamation',
    severity: 'warning',
    pattern: /!!|！！/g,
    message: '报告中存在连续感叹号"!!"或"！！"',
    suggestion: '医疗报告中应避免使用感叹号，保持客观',
  },
  {
    id: 'multiple-question',
    severity: 'warning',
    pattern: /\?\?|？？/g,
    message: '报告中存在连续问号"??/？？"',
    suggestion: '医疗报告应使用明确判断，避免问号',
  },
  {
    id: 'half-width-bracket',
    severity: 'info',
    pattern: /\([0-9]+cm|[0-9]+mm\)/g,
    message: '报告中使用半角括号包裹单位',
    suggestion: '建议使用全角括号"（）"',
  },
];

// ============================================================
// 5. 标准格式规则
// ============================================================
export interface FormatRule extends KeywordRule {
  pattern: RegExp;
  standardForm?: string;
}

export const STANDARD_FORMAT_RULES: FormatRule[] = [
  {
    id: 'ct-value-format',
    severity: 'info',
    pattern: /CT\s*值\s*\d+/g,
    message: 'CT 值写法不规范',
    standardForm: 'CT值约 25HU',
    suggestion: '建议标准写法：CT值约 25HU',
  },
  {
    id: 'size-format',
    severity: 'info',
    pattern: /\d+\s*[*x×]\s*\d+\s*(mm|cm)(?!\s*[*x×])/g,
    message: '病灶尺寸应使用"长×宽"或"长×宽×高"格式',
    standardForm: '大小约 12mm×10mm',
    suggestion: '建议：大小约 12mm×10mm 或 12mm×10mm×8mm',
  },
  {
    id: 'temperature-format',
    severity: 'warning',
    pattern: /体温\s*\d+\s*度/g,
    message: '体温写法不规范',
    standardForm: '体温 38.5℃',
    suggestion: '建议标准写法：体温 38.5℃',
  },
  {
    id: 'hounsfield-unit',
    severity: 'info',
    pattern: /CT\s*值\s*\d+(?!\s*HU)/g,
    message: 'CT 值缺少 HU 单位',
    standardForm: 'CT值约 25HU',
    suggestion: 'CT 值应注明 HU 单位',
  },
  {
    id: 'weight-format',
    severity: 'info',
    pattern: /体重\s*\d+\s*kg(?![\u4e00-\u9fa5])/g,
    message: '体重写法不完整',
    suggestion: '建议：体重 65kg',
  },
];

// ============================================================
// 6. 病灶关键词（按 modality + bodyPart 分类）
// ============================================================
export interface LesionKeyword {
  keyword: string;
  bodyParts: string[];
  severity: IssueSeverity;
  message: string;
  suggestion: string;
}

export const LESION_KEYWORDS_BY_MODALITY: Record<string, LesionKeyword[]> = {
  'CT': [
    { keyword: '肺', bodyParts: ['胸部'], severity: 'warning', message: '胸部CT报告应包含"肺"的描述', suggestion: '请描述双肺野情况' },
    { keyword: '纵隔', bodyParts: ['胸部'], severity: 'warning', message: '胸部CT报告应包含"纵隔"的描述', suggestion: '请描述纵隔窗所见' },
    { keyword: '胸膜', bodyParts: ['胸部'], severity: 'info', message: '建议描述胸膜情况', suggestion: '请补充胸膜增厚/胸腔积液等' },
    { keyword: '肝', bodyParts: ['腹部'], severity: 'warning', message: '腹部CT报告应包含"肝"的描述', suggestion: '请描述肝脏大小、密度' },
    { keyword: '胆囊', bodyParts: ['腹部'], severity: 'info', message: '建议描述胆囊', suggestion: '请描述胆囊大小、壁、结石' },
    { keyword: '胰', bodyParts: ['腹部'], severity: 'info', message: '建议描述胰腺', suggestion: '请描述胰腺大小、密度、胰管' },
    { keyword: '脾', bodyParts: ['腹部'], severity: 'info', message: '建议描述脾脏', suggestion: '请描述脾脏大小、密度' },
    { keyword: '肾', bodyParts: ['腹部'], severity: 'info', message: '建议描述双肾', suggestion: '请描述双肾大小、结石、积水' },
  ],
  'MR': [
    { keyword: '脑实质', bodyParts: ['头颅'], severity: 'warning', message: '头颅MR报告应描述脑实质', suggestion: '请描述各脑叶信号情况' },
    { keyword: '脑室', bodyParts: ['头颅'], severity: 'warning', message: '头颅MR报告应描述脑室系统', suggestion: '请描述脑室大小、对称性' },
    { keyword: '中线', bodyParts: ['头颅'], severity: 'info', message: '建议描述中线结构', suggestion: '请注明中线结构是否居中' },
    { keyword: '椎间盘', bodyParts: ['脊柱'], severity: 'warning', message: '脊柱MR报告应描述椎间盘', suggestion: '请描述椎间盘信号、突出情况' },
    { keyword: '椎体', bodyParts: ['脊柱'], severity: 'info', message: '建议描述椎体', suggestion: '请描述椎体信号、形态' },
  ],
  'DR': [
    { keyword: '肺', bodyParts: ['胸部'], severity: 'warning', message: '胸部DR应包含"肺"野描述', suggestion: '请描述双肺野透亮度' },
    { keyword: '心影', bodyParts: ['胸部'], severity: 'warning', message: '胸部DR应描述心影', suggestion: '请描述心影大小、形态' },
    { keyword: '膈', bodyParts: ['胸部'], severity: 'info', message: '建议描述膈肌', suggestion: '请描述膈面、肋膈角' },
  ],
  'MG': [
    { keyword: '腺体', bodyParts: ['胸部'], severity: 'warning', message: '乳腺钼靶应描述腺体类型', suggestion: '请注明致密型/混合型/脂肪型' },
    { keyword: '钙化', bodyParts: ['胸部'], severity: 'info', message: '建议描述钙化情况', suggestion: '如有钙化，请注明大小/形态/分布' },
    { keyword: '肿块', bodyParts: ['胸部'], severity: 'info', message: '建议描述肿块', suggestion: '如发现肿块，请描述大小/形态/边缘' },
  ],
  'US': [
    { keyword: '大小', bodyParts: ['腹部'], severity: 'warning', message: '超声报告应包含器官大小', suggestion: '请注明器官大小' },
    { keyword: '回声', bodyParts: ['腹部'], severity: 'warning', message: '超声报告应描述回声', suggestion: '请描述回声强度' },
  ],
};

// 默认导出（兼容旧 import）
export default {
  ANATOMY_PAIR_RULES,
  POS_NEG_WORD_RULES,
  NEGATION_WORDS,
  PUNCTUATION_RULES,
  STANDARD_FORMAT_RULES,
  LESION_KEYWORDS_BY_MODALITY,
};
