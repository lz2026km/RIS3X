// ============================================================
// G005 放射科RIS系统 v3.0.6.11-99 Wave 10C - 对比剂方案库
// 碘对比剂 12 方案 / 钆对比剂 8 方案 / 过敏反应分级处理
// ============================================================

export type ContrastType = '碘' | '钆' | '钡' | '超声微泡';

export interface ContrastAgent {
  id: string;
  name: string;
  type: ContrastType;
  /** 商品名/通用名 */
  genericName: string;
  /** 浓度 */
  concentration: string;
  /** 渗透压类型 */
  osmolality: '高渗' | '低渗' | '等渗' | '—';
  /** 适应证 */
  indications: string;
  /** 注意事项 */
  precautions: string;
}

export const CONTRAST_AGENTS: ContrastAgent[] = [
  {
    id: 'CA-01', name: '碘海醇（欧乃派克）', genericName: 'Iohexol', type: '碘',
    concentration: '300/350mgI/mL', osmolality: '低渗',
    indications: 'CT增强、血管造影、尿路造影',
    precautions: '肾功能不全（eGFR<30）禁用；甲亢危象禁用',
  },
  {
    id: 'CA-02', name: '碘帕醇（碘必乐）', genericName: 'Iopamidol', type: '碘',
    concentration: '300/370mgI/mL', osmolality: '低渗',
    indications: 'CT增强、冠脉造影、椎管造影',
    precautions: '肝肾功能不全者慎用',
  },
  {
    id: 'CA-03', name: '碘普罗胺（优维显）', genericName: 'Iopromide', type: '碘',
    concentration: '300/370mgI/mL', osmolality: '低渗',
    indications: 'CT增强（含冠脉CTA）、DSA',
    precautions: '嗜铬细胞瘤患者注意血压波动',
  },
  {
    id: 'CA-04', name: '碘佛醇（安射力）', genericName: 'Ioversol', type: '碘',
    concentration: '320/350mgI/mL', osmolality: '低渗',
    indications: 'CT增强、血管造影',
    precautions: '心衰患者限制容量',
  },
  {
    id: 'CA-05', name: '碘克沙醇（威视派克）', genericName: 'Iodixanol', type: '碘',
    concentration: '270/320mgI/mL', osmolality: '等渗',
    indications: '高危患者（肾功能不全、糖尿病肾病）CT增强',
    precautions: '等渗对肾损伤较小，费用较高',
  },
  {
    id: 'CA-06', name: '钆喷酸葡胺（马根维显）', genericName: 'Gadopentetate Dimeglumine', type: '钆',
    concentration: '0.5mmol/mL', osmolality: '高渗',
    indications: '颅脑、脊柱、全身MR增强',
    precautions: '线性钆剂：严重肾功能不全禁用（NSF风险）',
  },
  {
    id: 'CA-07', name: '钆特酸葡胺（多它灵）', genericName: 'Gadoterate Meglumine', type: '钆',
    concentration: '0.5mmol/mL', osmolality: '等渗',
    indications: 'MR增强各部位（大环类，稳定性好）',
    precautions: 'NSF风险低；仍按肾功能评估',
  },
  {
    id: 'CA-08', name: '钆布醇（加乐显）', genericName: 'Gadobutrol', type: '钆',
    concentration: '1.0mmol/mL', osmolality: '等渗',
    indications: '中枢神经、血管MRA（高浓度）',
    precautions: '高浓度可减半注射量',
  },
  {
    id: 'CA-09', name: '钆塞酸二钠（普美显）', genericName: 'Gadoxetic Acid', type: '钆',
    concentration: '0.25mmol/mL', osmolality: '高渗',
    indications: '肝脏MR（动脉期+20分钟肝胆期）',
    precautions: '肝胆期延迟20分钟扫描',
  },
  {
    id: 'CA-10', name: '硫酸钡混悬液', genericName: 'Barium Sulfate', type: '钡',
    concentration: '100-250%W/V', osmolality: '—',
    indications: '消化道造影（食管、胃、小肠、结肠）',
    precautions: '消化道穿孔禁用（改用碘水）；肠梗阻慎用',
  },
  {
    id: 'CA-11', name: '碘水对比剂（口服）', genericName: 'Water-soluble (Oral)', type: '碘',
    concentration: '稀释至1-2%', osmolality: '低渗',
    indications: '腹部CT胃肠道充盈、消化道穿孔者替代钡剂',
    precautions: '口服总量500-1000mL，分次服入',
  },
  {
    id: 'CA-12', name: '六氟化硫微泡（声诺维）', genericName: 'Sulfur Hexafluoride', type: '超声微泡',
    concentration: '8μL/mL混悬', osmolality: '—',
    indications: '超声造影（肝脏、心腔、血管）',
    precautions: '右向左分流严重者禁用',
  },
];

// ============================================================
// 1. 碘对比剂 CT 增强方案（12 项）
// ============================================================

export interface IodineProtocol {
  id: string;
  name: string;
  bodyPart: string;
  /** 对比剂选择建议 */
  agent: string;
  /** 浓度建议 */
  concentration: string;
  /** 总量（mL，按体重） */
  volume: string;
  /** 注射流速 */
  flowRate: string;
  /** 延迟时间（各期） */
  delay: string[];
  /** 触发方式 */
  trigger: string;
  /** 生理盐水冲刷 */
  salineFlush: string;
  /** 扫描时长建议 */
  scanTime: string;
  /** 注意事项 */
  notes: string;
}

export const IODINE_PROTOCOLS: IodineProtocol[] = [
  {
    id: 'IP-01',
    name: '颅脑CT增强',
    bodyPart: '颅脑',
    agent: '碘帕醇/碘海醇（低渗）',
    concentration: '300-370mgI/mL',
    volume: '60-80mL（1.0-1.3mL/kg）',
    flowRate: '2.5-3.0mL/s',
    delay: ['增强后即刻扫描', '脑膜强化延迟5-8分钟'],
    trigger: '固定延迟',
    salineFlush: '20mL生理盐水',
    scanTime: '5-8s',
    notes: '疑脑膜炎加延迟扫描观察脑膜强化',
  },
  {
    id: 'IP-02',
    name: '颈部CT增强',
    bodyPart: '颈部',
    agent: '碘帕醇/碘普罗胺',
    concentration: '300-350mgI/mL',
    volume: '60-80mL（1.0-1.3mL/kg）',
    flowRate: '2.5-3.0mL/s',
    delay: ['注药后30s（动静脉期单期）'],
    trigger: '固定延迟',
    salineFlush: '20mL生理盐水',
    scanTime: '8-10s',
    notes: '嘱患者勿吞咽',
  },
  {
    id: 'IP-03',
    name: '胸部CT增强',
    bodyPart: '胸部',
    agent: '碘帕醇/碘普罗胺',
    concentration: '350-370mgI/mL',
    volume: '80-100mL（1.2-1.5mL/kg）',
    flowRate: '3.0-3.5mL/s',
    delay: ['动脉期25-30s', '静脉期55-70s'],
    trigger: '智能触发（升主动脉阈值100HU）',
    salineFlush: '30mL生理盐水',
    scanTime: '10-12s（每期）',
    notes: '纵隔病变优选双期',
  },
  {
    id: 'IP-04',
    name: '肺栓塞CTA（CTPA）',
    bodyPart: '肺动脉',
    agent: '碘帕醇/碘克沙醇（高危）',
    concentration: '350-370mgI/mL',
    volume: '60-80mL',
    flowRate: '4.0-5.0mL/s（高流速）',
    delay: ['触发后扫描（肺动脉干阈值60-80HU）'],
    trigger: '智能触发+双流注射',
    salineFlush: '20-30mL生理盐水',
    scanTime: '8-10s',
    notes: '屏气8s以上；右心对比剂淤滞可影响判断',
  },
  {
    id: 'IP-05',
    name: '冠脉CTA',
    bodyPart: '冠状动脉',
    agent: '碘普罗胺/碘佛醇（高浓度）',
    concentration: '370-400mgI/mL',
    volume: '60-80mL',
    flowRate: '4.5-5.5mL/s',
    delay: ['触发后延迟4-6s扫描（升主动脉触发）'],
    trigger: '智能触发（升主动脉阈值100-120HU）',
    salineFlush: '40mL生理盐水',
    scanTime: '4-8s（门控）',
    notes: '心率控制≤65bpm；硝酸甘油0.4mg舌下',
  },
  {
    id: 'IP-06',
    name: '上腹部CT增强（三期）',
    bodyPart: '上腹部',
    agent: '碘帕醇/碘普罗胺/碘克沙醇（高危）',
    concentration: '350-370mgI/mL',
    volume: '80-120mL（1.2-1.5mL/kg，≤120mL）',
    flowRate: '3.0-4.0mL/s',
    delay: ['动脉期25-30s（触发）', '门脉期60-70s', '延迟期180s'],
    trigger: '智能触发（腹主动脉阈值100HU）',
    salineFlush: '30mL生理盐水',
    scanTime: '10-15s（每期）',
    notes: '肝癌评估必须平扫+三期；饮水800-1000mL',
  },
  {
    id: 'IP-07',
    name: '胰腺CT增强（双期）',
    bodyPart: '胰腺',
    agent: '碘帕醇/碘普罗胺',
    concentration: '350-370mgI/mL',
    volume: '90-110mL（1.3-1.5mL/kg）',
    flowRate: '3.0-4.0mL/s',
    delay: ['胰腺实质期40s', '门脉期65s'],
    trigger: '智能触发',
    salineFlush: '30mL生理盐水',
    scanTime: '10-15s（每期）',
    notes: '胰腺癌双期增强（实质期+门脉期）为优选',
  },
  {
    id: 'IP-08',
    name: '泌尿系CTU',
    bodyPart: '泌尿系统',
    agent: '碘帕醇/碘海醇',
    concentration: '350mgI/mL',
    volume: '100-120mL（1.5mL/kg）',
    flowRate: '3.0mL/s',
    delay: ['皮质期35-40s', '排泄期8-12分钟'],
    trigger: '固定延迟',
    salineFlush: '30mL生理盐水',
    scanTime: '10-15s（每期）',
    notes: '排泄期前翻转身体促进输尿管充盈',
  },
  {
    id: 'IP-09',
    name: '腹主动脉CTA',
    bodyPart: '腹主动脉',
    agent: '碘帕醇/碘普罗胺',
    concentration: '350-370mgI/mL',
    volume: '90-110mL',
    flowRate: '3.5-4.5mL/s',
    delay: ['触发后扫描（动脉期）', '疑夹层加延迟期60-70s'],
    trigger: '智能触发（腹主动脉阈值100HU）',
    salineFlush: '30mL生理盐水',
    scanTime: '15-20s（全程）',
    notes: '夹层需真腔假腔延迟双期评估',
  },
  {
    id: 'IP-10',
    name: '下肢动脉CTA',
    bodyPart: '下肢动脉',
    agent: '碘帕醇/碘普罗胺',
    concentration: '350mgI/mL',
    volume: '100-120mL',
    flowRate: '4.0mL/s',
    delay: ['智能触发（腹主动脉下段）或固定延迟25-30s'],
    trigger: '智能触发',
    salineFlush: '40mL生理盐水（双筒）',
    scanTime: '25-35s（分站扫描）',
    notes: '分站扫描避免静脉污染；扫描方向头→足',
  },
  {
    id: 'IP-11',
    name: '头颈联合CTA',
    bodyPart: '头颈动脉',
    agent: '碘帕醇/碘普罗胺',
    concentration: '350-370mgI/mL',
    volume: '60-70mL',
    flowRate: '4.0-4.5mL/s',
    delay: ['触发后扫描（颈总动脉阈值80-100HU）'],
    trigger: '智能触发',
    salineFlush: '30mL生理盐水',
    scanTime: '12-15s',
    notes: '头颈动脉一次成像；缺血性卒中评估',
  },
  {
    id: 'IP-12',
    name: '儿科CT增强（按体重）',
    bodyPart: '按部位',
    agent: '碘克沙醇/碘帕醇（低渗等渗优先）',
    concentration: '300-320mgI/mL（≤3岁）或350mgI/mL',
    volume: '1.5-2.0mL/kg（上限按部位）',
    flowRate: '1.0-2.5mL/s（按留置针）',
    delay: ['按部位参考成人方案缩短2-4s'],
    trigger: '固定延迟为主（小体重）',
    salineFlush: '按体重（≤10mL）',
    scanTime: '短扫描时间（儿童屏气能力）',
    notes: '严格按体重与年龄调整；对比剂预热至37℃',
  },
];

// ============================================================
// 2. 钆对比剂 MR 增强方案（8 项）
// ============================================================

export interface GadoliniumProtocol {
  id: string;
  name: string;
  bodyPart: string;
  agent: string;
  /** 剂量（mmol/kg） */
  dose: string;
  flowRate: string;
  /** 扫描时机 */
  timing: string[];
  /** 特殊序列 */
  specialSequences: string;
  notes: string;
}

export const GADOLINIUM_PROTOCOLS: GadoliniumProtocol[] = [
  {
    id: 'GP-01',
    name: '颅脑MR增强（常规）',
    bodyPart: '颅脑',
    agent: '钆特酸葡胺（大环类首选）/钆喷酸葡胺',
    dose: '0.1mmol/kg（0.2mL/kg）',
    flowRate: '2.0mL/s',
    timing: ['注药后即刻T1横轴位', '注药后5分钟延迟T1三平面'],
    specialSequences: 'T1增强+脂肪抑制（颅外病变）',
    notes: '疑脑膜病变加延迟增强；剂量减半仅限特定序列',
  },
  {
    id: 'GP-02',
    name: '垂体动态增强',
    bodyPart: '鞍区',
    agent: '钆特酸葡胺',
    dose: '0.1mmol/kg（0.2mL/kg）',
    flowRate: '2.0-2.5mL/s（团注）',
    timing: ['注药同时启动动态采集（每20-30s一期×6）', '注药后5分钟延迟'],
    specialSequences: '冠状位动态T1 3mm薄层',
    notes: '动态期观察微腺瘤早期强化延迟',
  },
  {
    id: 'GP-03',
    name: '乳腺MR动态增强（DCE）',
    bodyPart: '乳腺',
    agent: '钆特酸葡胺/钆布醇',
    dose: '0.1mmol/kg（0.2mL/kg）',
    flowRate: '2.0mL/s',
    timing: ['增强前T1基线', '注药后连续5期（每期90s）'],
    specialSequences: 'DCE多期+时间信号曲线',
    notes: '避开月经期前扫描；曲线分型（Ⅰ持续/Ⅱ平台/Ⅲ流出）',
  },
  {
    id: 'GP-04',
    name: '肝脏MR增强（多期）',
    bodyPart: '肝脏',
    agent: '钆塞酸二钠（普美显）或钆特酸葡胺',
    dose: '普美显0.025mmol/kg（0.1mL/kg）；钆特酸0.1mmol/kg',
    flowRate: '1.0-2.0mL/s',
    timing: ['动脉期（触发）', '门脉期60-70s', '延迟期180s', '肝胆期20分钟（肝特异性）'],
    specialSequences: '动脉期多时相（3次采集）',
    notes: '普美显剂量为常规钆剂1/4',
  },
  {
    id: 'GP-05',
    name: '心脏MR（灌注+LGE）',
    bodyPart: '心脏',
    agent: '钆特酸葡胺/钆布醇',
    dose: '首过灌注0.05-0.1mmol/kg + LGE累计0.1-0.2mmol/kg',
    flowRate: '3.0-4.0mL/s（灌注），2.0mL/s（LGE）',
    timing: ['灌注：注药同期采集', 'LGE：注药后10分钟', '存活心肌评估再延迟'],
    specialSequences: '首过灌注+相位敏感反转恢复（PSIR）',
    notes: '负荷灌注需监护；两次给药总量≤0.3mmol/kg',
  },
  {
    id: 'GP-06',
    name: '前列腺MR（DCE）',
    bodyPart: '前列腺',
    agent: '钆特酸葡胺（大环类）',
    dose: '0.1mmol/kg（0.2mL/kg）',
    flowRate: '2.0-2.5mL/s',
    timing: ['动态多期（分辨率≥4s/期，持续2分钟）'],
    specialSequences: 'DCE与T2/DWI融合判读（PI-RADS）',
    notes: 'DCE用于DWI=3时辅助定级',
  },
  {
    id: 'GP-07',
    name: '儿童MR增强',
    bodyPart: '按部位',
    agent: '钆特酸葡胺（大环类唯一推荐）',
    dose: '0.1mmol/kg（0.2mL/kg，上限20mL）',
    flowRate: '按留置针（0.5-1.5mL/s）',
    timing: ['按部位序列设计'],
    specialSequences: '—',
    notes: '儿童禁用线性钆剂；反复增强累积记录',
  },
  {
    id: 'GP-08',
    name: '关节直接造影（MR关节造影）',
    bodyPart: '关节（肩/髋）',
    agent: '钆稀释液（0.0025mmol/mL）+生理盐水/利多卡因',
    dose: '10-15mL（关节腔内注射）',
    flowRate: '关节腔注射',
    timing: ['注射后30分钟内扫描（T1脂肪抑制）'],
    specialSequences: 'T1-FS三平面',
    notes: '透视/超声引导穿刺；碘剂过敏者可用钆剂替代透视',
  },
];

// ============================================================
// 3. 对比剂过敏反应分级处理流程（4 级）
// ============================================================

export type AllergyGrade = 1 | 2 | 3 | 4;

export interface AllergyTreatment {
  grade: AllergyGrade;
  name: string;
  /** 发生时间 */
  onset: string;
  /** 临床表现 */
  symptoms: string[];
  /** 处理措施 */
  treatment: string[];
  /** 用药方案 */
  medication: string;
  /** 是否需住院 */
  hospitalization: string;
}

export const CONTRAST_ALLERGY_TREATMENT: AllergyTreatment[] = [
  {
    grade: 1,
    name: '轻度反应',
    onset: '注药后5-30分钟（多为即刻）',
    symptoms: ['轻度荨麻疹/瘙痒', '局限性红斑', '恶心呕吐', '打喷嚏/鼻塞'],
    treatment: [
      '立即停止注射（如仍在注射）',
      '保持静脉通路通畅',
      '观察生命体征30分钟',
      '症状缓解后记录并报告',
    ],
    medication: '苯海拉明25-50mg口服或肌注（必要时）；观察为主',
    hospitalization: '一般无需住院，观察至症状缓解',
  },
  {
    grade: 2,
    name: '中度反应',
    onset: '注药后数分钟内',
    symptoms: ['弥漫性荨麻疹', '面部/喉头轻度水肿', '支气管痉挛（喘鸣）', '心动过速或过缓', '血压轻度下降'],
    treatment: [
      '停止注射，保持呼吸道通畅',
      '高流量吸氧（6-10L/min）',
      '面罩通气必要时',
      '建立第二条静脉通路',
      '持续监护（血压/心率/血氧）',
    ],
    medication: '肾上腺素0.3-0.5mg（1:1000）肌注，可重复；异丙嗪25mg肌注；β2激动剂吸入（沙丁胺醇）',
    hospitalization: '观察6-12小时，症状缓解后可离院；有喉头水肿倾向者收入院',
  },
  {
    grade: 3,
    name: '重度反应',
    onset: '注药后即刻至数分钟',
    symptoms: ['严重喉头水肿', '严重支气管痉挛/呼吸窘迫', '低血压（收缩压<80mmHg）', '意识模糊', '严重心动过缓/心动过速'],
    treatment: [
      '立即呼叫急救团队（999/急诊）',
      '头低脚高位（Trendelenburg位）',
      '高流量吸氧+必要时气管插管',
      '快速补液（晶体液1000-2000mL）',
      '转运至抢救室',
    ],
    medication: '肾上腺素0.5mg（1:1000）肌注即刻；必要时静脉泵入；激素甲泼尼龙125-250mg iv；氨茶碱必要时',
    hospitalization: '必须住院观察治疗',
  },
  {
    grade: 4,
    name: '过敏性休克/心跳呼吸骤停',
    onset: '注药后即刻',
    symptoms: ['血压测不出', '意识丧失', '呼吸停止', '心跳骤停', '紫绀'],
    treatment: [
      '启动心肺复苏（CPR）流程',
      '立即呼叫急诊抢救',
      '肾上腺素1mg（1:10000）静推，每3-5分钟重复',
      '气管插管/机械通气',
      '持续心肺复苏直至抢救团队到达',
    ],
    medication: '肾上腺素为一线药物；抗组胺药和激素为二线；大剂量晶体液快速补液',
    hospitalization: '收入ICU监护治疗',
  },
];

// ============================================================
// 4. 注射前筛查与风险告知
// ============================================================

export interface ContrastScreeningItem {
  id: string;
  item: string;
  type: '询问' | '检查' | '告知';
  detail: string;
  action: string;
}

export const CONTRAST_SCREENING_ITEMS: ContrastScreeningItem[] = [
  { id: 'CS-01', item: '过敏史询问', type: '询问', detail: '既往碘/钆对比剂过敏史、药物/食物过敏史（海鲜、乳胶）', action: '有中重度过敏史者预防用药或选择替代检查' },
  { id: 'CS-02', item: '肾功能评估', type: '检查', detail: 'eGFR：碘剂<30禁用；30-45慎用；钆剂大环类<30慎用、线性禁用', action: '高危者48小时内检测血肌酐' },
  { id: 'CS-03', item: '甲状腺功能', type: '询问', detail: '甲亢病史、Graves病、甲状腺结节', action: '活动性甲亢禁用碘对比剂' },
  { id: 'CS-04', item: '哮喘史', type: '询问', detail: '严重支气管哮喘者反应风险增高', action: '预防用药：泼尼松+苯海拉明' },
  { id: 'CS-05', item: '妊娠哺乳状态', type: '询问', detail: '孕妇权衡获益；哺乳期24-48小时暂停哺乳（碘剂）', action: '记录知情同意；与产科共同决策' },
  { id: 'CS-06', item: '二甲双胍使用', type: '询问', detail: '糖尿病服用二甲双胍者', action: 'eGFR<30时停药48小时；常规者扫描后48小时再服' },
  { id: 'CS-07', item: '多发性骨髓瘤', type: '询问', detail: '免疫球蛋白异常者（含万珂治疗）', action: '充分水化；必要时等渗剂' },
  { id: 'CS-08', item: '心衰/容量负荷', type: '询问', detail: 'NYHA III-IV级心衰、肺水肿史', action: '控制总量，减慢流速，监护' },
  { id: 'CS-09', item: '知情同意签署', type: '告知', detail: '对比剂种类、剂量、风险（过敏/肾损伤）及替代方案', action: '签署《对比剂使用知情同意书》' },
  { id: 'CS-10', item: '注射前准备', type: '检查', detail: '空腹4小时（防呕吐误吸）、预留静脉通路（20G以上）、排空膀胱', action: '备齐急救药品及设备（肾上腺素、氧气、除颤仪）' },
];

// ============================================================
// 导出与工具函数
// ============================================================

export const CONTRAST_PROTOCOLS = {
  agents: CONTRAST_AGENTS,
  iodine: IODINE_PROTOCOLS,
  gadolinium: GADOLINIUM_PROTOCOLS,
  allergy: CONTRAST_ALLERGY_TREATMENT,
  screening: CONTRAST_SCREENING_ITEMS,
};

/** 按部位查找碘对比剂方案 */
export function findIodineProtocol(bodyPart: string): IodineProtocol[] {
  return IODINE_PROTOCOLS.filter((p) => p.bodyPart.includes(bodyPart));
}

/** 按过敏分级获取处理流程 */
export function getAllergyByGrade(grade: AllergyGrade): AllergyTreatment | undefined {
  return CONTRAST_ALLERGY_TREATMENT.find((a) => a.grade === grade);
}

/** 检索对比剂（名称/适应证） */
export function searchContrastAgents(query: string, type?: ContrastType): ContrastAgent[] {
  const q = query.trim().toLowerCase();
  return CONTRAST_AGENTS.filter((a) => {
    const hit =
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.genericName.toLowerCase().includes(q) ||
      a.indications.toLowerCase().includes(q);
    return hit && (type ? a.type === type : true);
  });
}
