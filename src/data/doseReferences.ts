// ============================================================
// G005 放射科RIS系统 v3.0.6.11-99 Wave 10C - 剂量参考数据库
// CTDIvol/DLP 参考值 / 中国-ICRP 诊断参考水平对比 / 告警阈值
// 供剂量监控、检查方案选择与辐射安全提示
// ============================================================

// ============================================================
// 1. CT 剂量参考值（10 部位 × 成人/儿童 × 常规/增强）
// ============================================================

export type DosePatientGroup = '成人' | '儿童';
export type DoseExamType = '常规' | '增强';

export interface CtDoseReference {
  bodyPart: string;
  /** 英文部位名 */
  englishName: string;
  patientGroup: DosePatientGroup;
  examType: DoseExamType;
  /** CTDIvol (mGy) 典型值 */
  ctdiVolTypical: number;
  /** CTDIvol 推荐范围 */
  ctdiVolRange: [number, number];
  /** DLP (mGy·cm) 典型值（单期） */
  dlpTypical: number;
  /** 每期数（增强多期时累计） */
  phases: number;
  /** 单次检查累计 DLP 参考 */
  totalDlpReference: number;
  /** 有效剂量参考（mSv） */
  effectiveDose: number;
  note: string;
}

export const CT_DOSE_REFERENCES: CtDoseReference[] = [
  // ---------- 头部 ----------
  {
    bodyPart: '颅脑', englishName: 'Head', patientGroup: '成人', examType: '常规',
    ctdiVolTypical: 52, ctdiVolRange: [45, 65],
    dlpTypical: 950, phases: 1, totalDlpReference: 950, effectiveDose: 2.0,
    note: '颅底至颅顶；儿童按体重/年龄降kV降mA',
  },
  {
    bodyPart: '颅脑', englishName: 'Head', patientGroup: '儿童', examType: '常规',
    ctdiVolTypical: 30, ctdiVolRange: [25, 40],
    dlpTypical: 450, phases: 1, totalDlpReference: 450, effectiveDose: 1.0,
    note: '儿童需按年龄组调整扫描参数（ALARA原则）',
  },
  {
    bodyPart: '颅脑', englishName: 'Head', patientGroup: '成人', examType: '增强',
    ctdiVolTypical: 52, ctdiVolRange: [45, 65],
    dlpTypical: 950, phases: 2, totalDlpReference: 1900, effectiveDose: 4.0,
    note: '平扫+增强两期；总量达限值时需记录在案',
  },
  {
    bodyPart: '颅脑', englishName: 'Head', patientGroup: '儿童', examType: '增强',
    ctdiVolTypical: 30, ctdiVolRange: [25, 40],
    dlpTypical: 450, phases: 2, totalDlpReference: 900, effectiveDose: 2.0,
    note: '严格把握增强指征',
  },
  // ---------- 鼻窦/颞骨 ----------
  {
    bodyPart: '鼻窦颞骨', englishName: 'Sinuses/Temporal Bone', patientGroup: '成人', examType: '常规',
    ctdiVolTypical: 12, ctdiVolRange: [8, 20],
    dlpTypical: 200, phases: 1, totalDlpReference: 200, effectiveDose: 0.4,
    note: '颞骨HRCT骨算法CTDIvol可达40-60mGy，需严格限扫范围',
  },
  {
    bodyPart: '鼻窦颞骨', englishName: 'Sinuses/Temporal Bone', patientGroup: '儿童', examType: '常规',
    ctdiVolTypical: 8, ctdiVolRange: [5, 12],
    dlpTypical: 120, phases: 1, totalDlpReference: 120, effectiveDose: 0.2,
    note: '儿童颞骨扫描尽量减少照射野',
  },
  // ---------- 颈部 ----------
  {
    bodyPart: '颈部', englishName: 'Neck', patientGroup: '成人', examType: '常规',
    ctdiVolTypical: 12, ctdiVolRange: [8, 15],
    dlpTypical: 350, phases: 1, totalDlpReference: 350, effectiveDose: 2.0,
    note: '甲状腺在扫描野内时注意防护',
  },
  {
    bodyPart: '颈部', englishName: 'Neck', patientGroup: '成人', examType: '增强',
    ctdiVolTypical: 12, ctdiVolRange: [8, 15],
    dlpTypical: 350, phases: 2, totalDlpReference: 700, effectiveDose: 4.0,
    note: '颈部增强多为单次动静脉期',
  },
  {
    bodyPart: '颈部', englishName: 'Neck', patientGroup: '儿童', examType: '增强',
    ctdiVolTypical: 8, ctdiVolRange: [5, 10],
    dlpTypical: 180, phases: 2, totalDlpReference: 360, effectiveDose: 2.0,
    note: '儿童颈部增强严格掌握适应症',
  },
  // ---------- 胸部 ----------
  {
    bodyPart: '胸部', englishName: 'Chest', patientGroup: '成人', examType: '常规',
    ctdiVolTypical: 8, ctdiVolRange: [5, 12],
    dlpTypical: 300, phases: 1, totalDlpReference: 300, effectiveDose: 5.0,
    note: '常规胸部平扫；低剂量筛查 ≤1.5mGy（CTDIvol）',
  },
  {
    bodyPart: '胸部', englishName: 'Chest', patientGroup: '成人', examType: '增强',
    ctdiVolTypical: 10, ctdiVolRange: [6, 14],
    dlpTypical: 380, phases: 2, totalDlpReference: 760, effectiveDose: 12.0,
    note: '动脉+静脉期；CTPA单期时有效剂量约5-8mSv',
  },
  {
    bodyPart: '胸部', englishName: 'Chest', patientGroup: '儿童', examType: '常规',
    ctdiVolTypical: 4, ctdiVolRange: [2, 6],
    dlpTypical: 100, phases: 1, totalDlpReference: 100, effectiveDose: 1.7,
    note: '儿童低剂量胸片替代CT优先',
  },
  // ---------- 上腹部 ----------
  {
    bodyPart: '上腹部', englishName: 'Upper Abdomen', patientGroup: '成人', examType: '常规',
    ctdiVolTypical: 12, ctdiVolRange: [8, 16],
    dlpTypical: 450, phases: 1, totalDlpReference: 450, effectiveDose: 6.0,
    note: '肝脾胰肾常规评估',
  },
  {
    bodyPart: '上腹部', englishName: 'Upper Abdomen', patientGroup: '成人', examType: '增强',
    ctdiVolTypical: 13, ctdiVolRange: [10, 18],
    dlpTypical: 480, phases: 4, totalDlpReference: 1920, effectiveDose: 26.0,
    note: '平扫+动脉+门脉+延迟共4期（肝癌三期方案）',
  },
  {
    bodyPart: '上腹部', englishName: 'Upper Abdomen', patientGroup: '儿童', examType: '增强',
    ctdiVolTypical: 7, ctdiVolRange: [4, 10],
    dlpTypical: 200, phases: 3, totalDlpReference: 600, effectiveDose: 8.0,
    note: '儿童尽量减少期相',
  },
  // ---------- 腹盆腔 ----------
  {
    bodyPart: '腹盆腔', englishName: 'Abdomen & Pelvis', patientGroup: '成人', examType: '常规',
    ctdiVolTypical: 12, ctdiVolRange: [9, 16],
    dlpTypical: 800, phases: 1, totalDlpReference: 800, effectiveDose: 12.0,
    note: '腹部+盆腔连续扫描，DLP较高',
  },
  {
    bodyPart: '腹盆腔', englishName: 'Abdomen & Pelvis', patientGroup: '成人', examType: '增强',
    ctdiVolTypical: 13, ctdiVolRange: [10, 18],
    dlpTypical: 850, phases: 2, totalDlpReference: 1700, effectiveDose: 25.0,
    note: '动静脉两期；肿瘤分期常用',
  },
  {
    bodyPart: '腹盆腔', englishName: 'Abdomen & Pelvis', patientGroup: '儿童', examType: '常规',
    ctdiVolTypical: 6, ctdiVolRange: [4, 9],
    dlpTypical: 300, phases: 1, totalDlpReference: 300, effectiveDose: 5.0,
    note: '儿童腹盆CT严格掌握指征',
  },
  // ---------- 脊柱 ----------
  {
    bodyPart: '颈椎', englishName: 'Cervical Spine', patientGroup: '成人', examType: '常规',
    ctdiVolTypical: 22, ctdiVolRange: [18, 30],
    dlpTypical: 400, phases: 1, totalDlpReference: 400, effectiveDose: 3.0,
    note: '甲状腺位于扫描野，注意防护',
  },
  {
    bodyPart: '腰椎', englishName: 'Lumbar Spine', patientGroup: '成人', examType: '常规',
    ctdiVolTypical: 18, ctdiVolRange: [14, 25],
    dlpTypical: 500, phases: 1, totalDlpReference: 500, effectiveDose: 7.0,
    note: '腰椎CT剂量高于颈椎',
  },
  {
    bodyPart: '腰椎', englishName: 'Lumbar Spine', patientGroup: '儿童', examType: '常规',
    ctdiVolTypical: 10, ctdiVolRange: [6, 14],
    dlpTypical: 220, phases: 1, totalDlpReference: 220, effectiveDose: 3.0,
    note: '儿童脊柱侧弯畸形评估优选低剂量全脊柱拼接',
  },
  // ---------- 泌尿系 ----------
  {
    bodyPart: '泌尿系（CTU）', englishName: 'CT Urography', patientGroup: '成人', examType: '增强',
    ctdiVolTypical: 12, ctdiVolRange: [9, 16],
    dlpTypical: 450, phases: 3, totalDlpReference: 1350, effectiveDose: 18.0,
    note: '平扫+皮质期+排泄期；替代方案可减期相',
  },
  {
    bodyPart: '泌尿系（CTKUB）', englishName: 'CT KUB', patientGroup: '成人', examType: '常规',
    ctdiVolTypical: 5, ctdiVolRange: [3, 8],
    dlpTypical: 350, phases: 1, totalDlpReference: 350, effectiveDose: 5.0,
    note: '低剂量结石筛查，无需增强',
  },
  {
    bodyPart: '泌尿系（CTU）', englishName: 'CT Urography', patientGroup: '儿童', examType: '增强',
    ctdiVolTypical: 6, ctdiVolRange: [4, 9],
    dlpTypical: 150, phases: 2, totalDlpReference: 300, effectiveDose: 4.0,
    note: '儿童CTU减少期相，仅排泄期+平扫',
  },
  // ---------- 冠状动脉 ----------
  {
    bodyPart: '冠状动脉CTA', englishName: 'Coronary CTA', patientGroup: '成人', examType: '增强',
    ctdiVolTypical: 8, ctdiVolRange: [3, 15],
    dlpTypical: 250, phases: 2, totalDlpReference: 300, effectiveDose: 4.0,
    note: '前瞻性门控低剂量3-5mSv；回顾性可达10-15mSv',
  },
  {
    bodyPart: '冠状动脉钙化积分', englishName: 'CAC Scoring', patientGroup: '成人', examType: '常规',
    ctdiVolTypical: 2, ctdiVolRange: [1, 3],
    dlpTypical: 60, phases: 1, totalDlpReference: 60, effectiveDose: 0.9,
    note: '无对比剂非增强扫描',
  },
  {
    bodyPart: '冠状动脉CTA', englishName: 'Coronary CTA', patientGroup: '儿童', examType: '增强',
    ctdiVolTypical: 5, ctdiVolRange: [2, 8],
    dlpTypical: 100, phases: 2, totalDlpReference: 120, effectiveDose: 2.0,
    note: '儿童冠脉CTA（川崎病随访）需专门低剂量方案',
  },
  // ---------- 髋关节/四肢 ----------
  {
    bodyPart: '髋关节', englishName: 'Hip', patientGroup: '成人', examType: '常规',
    ctdiVolTypical: 14, ctdiVolRange: [10, 20],
    dlpTypical: 500, phases: 1, totalDlpReference: 500, effectiveDose: 3.0,
    note: '双髋扫描DLP更高',
  },
  {
    bodyPart: '四肢关节', englishName: 'Extremity Joints', patientGroup: '成人', examType: '常规',
    ctdiVolTypical: 12, ctdiVolRange: [8, 16],
    dlpTypical: 300, phases: 1, totalDlpReference: 300, effectiveDose: 0.5,
    note: '四肢远离躯干，有效剂量低',
  },
  {
    bodyPart: '四肢关节', englishName: 'Extremity Joints', patientGroup: '儿童', examType: '常规',
    ctdiVolTypical: 7, ctdiVolRange: [4, 10],
    dlpTypical: 120, phases: 1, totalDlpReference: 120, effectiveDose: 0.2,
    note: '儿童骨关节CT常可被DR/MR替代',
  },
  // ---------- 肺血管（CTPA） ----------
  {
    bodyPart: '肺栓塞CTA', englishName: 'CTPA', patientGroup: '成人', examType: '增强',
    ctdiVolTypical: 7, ctdiVolRange: [5, 10],
    dlpTypical: 250, phases: 1, totalDlpReference: 250, effectiveDose: 4.0,
    note: '单期肺动脉期；孕妇可用低剂量方案',
  },
  {
    bodyPart: '肺栓塞CTA', englishName: 'CTPA', patientGroup: '儿童', examType: '增强',
    ctdiVolTypical: 4, ctdiVolRange: [2, 6],
    dlpTypical: 80, phases: 1, totalDlpReference: 80, effectiveDose: 1.0,
    note: '儿童肺栓塞首选超声/MRI或临床决策',
  },
  // ---------- 主动脉CTA ----------
  {
    bodyPart: '主动脉CTA', englishName: 'Aorta CTA', patientGroup: '成人', examType: '增强',
    ctdiVolTypical: 13, ctdiVolRange: [10, 18],
    dlpTypical: 1000, phases: 2, totalDlpReference: 1500, effectiveDose: 22.0,
    note: '胸腹主动脉全程扫描范围大；夹层需延迟期',
  },
  {
    bodyPart: '主动脉CTA', englishName: 'Aorta CTA', patientGroup: '儿童', examType: '增强',
    ctdiVolTypical: 6, ctdiVolRange: [4, 9],
    dlpTypical: 250, phases: 2, totalDlpReference: 380, effectiveDose: 6.0,
    note: '儿童血管病变（大动脉炎）严格低剂量',
  },
];

// ============================================================
// 2. 诊断参考水平（中国与 ICRP/IAEA 对比）
// ============================================================

export type DrlStandard = '中国（2020版）' | 'ICRP 135' | 'IAEA';

export interface DrlComparison {
  bodyPart: string;
  examType: string;
  /** 各标准 CTDIvol (mGy) */
  ctdiVol: Record<DrlStandard, number>;
  /** 各标准 DLP (mGy·cm) */
  dlp: Record<DrlStandard, number>;
  /** 中国标准说明 */
  note: string;
}

export const DRL_COMPARISONS: DrlComparison[] = [
  {
    bodyPart: '颅脑', examType: 'CT平扫',
    ctdiVol: { '中国（2020版）': 55, 'ICRP 135': 60, 'IAEA': 60 },
    dlp: { '中国（2020版）': 1050, 'ICRP 135': 1000, 'IAEA': 1000 },
    note: '中国版取自《X射线计算机断层摄影诊断参考水平》（WS/T 637-2018）成人标准',
  },
  {
    bodyPart: '颅脑', examType: 'CT增强',
    ctdiVol: { '中国（2020版）': 60, 'ICRP 135': 65, 'IAEA': 65 },
    dlp: { '中国（2020版）': 1200, 'ICRP 135': 1100, 'IAEA': 1100 },
    note: '增强每期剂量参考与平扫近似',
  },
  {
    bodyPart: '胸部', examType: 'CT平扫',
    ctdiVol: { '中国（2020版）': 12, 'ICRP 135': 10, 'IAEA': 12 },
    dlp: { '中国（2020版）': 450, 'ICRP 135': 350, 'IAEA': 400 },
    note: '中国成人胸部常规CT DRL 450 mGy·cm',
  },
  {
    bodyPart: '胸部', examType: '低剂量筛查',
    ctdiVol: { '中国（2020版）': 3, 'ICRP 135': 2, 'IAEA': 3 },
    dlp: { '中国（2020版）': 100, 'ICRP 135': 70, 'IAEA': 90 },
    note: '肺癌筛查LDCT：CTDIvol ≤3mGy 为目标',
  },
  {
    bodyPart: '上腹部', examType: 'CT平扫',
    ctdiVol: { '中国（2020版）': 15, 'ICRP 135': 15, 'IAEA': 15 },
    dlp: { '中国（2020版）': 700, 'ICRP 135': 600, 'IAEA': 650 },
    note: '单期平扫DLP参考',
  },
  {
    bodyPart: '上腹部', examType: 'CT增强',
    ctdiVol: { '中国（2020版）': 15, 'ICRP 135': 15, 'IAEA': 15 },
    dlp: { '中国（2020版）': 2100, 'ICRP 135': 1800, 'IAEA': 1900 },
    note: '按三期累计；DRL为单期值，需按期相累加评估',
  },
  {
    bodyPart: '腹盆腔', examType: 'CT平扫',
    ctdiVol: { '中国（2020版）': 15, 'ICRP 135': 14, 'IAEA': 15 },
    dlp: { '中国（2020版）': 900, 'ICRP 135': 750, 'IAEA': 800 },
    note: '腹盆连续扫描DLP明显升高',
  },
  {
    bodyPart: '腰椎', examType: 'CT平扫',
    ctdiVol: { '中国（2020版）': 25, 'ICRP 135': 20, 'IAEA': 20 },
    dlp: { '中国（2020版）': 700, 'ICRP 135': 550, 'IAEA': 600 },
    note: '腰椎CT成人DLP参考',
  },
  {
    bodyPart: '颈椎', examType: 'CT平扫',
    ctdiVol: { '中国（2020版）': 35, 'ICRP 135': 30, 'IAEA': 30 },
    dlp: { '中国（2020版）': 500, 'ICRP 135': 450, 'IAEA': 470 },
    note: '颈椎CTDIvol参考值偏高源于骨算法',
  },
  {
    bodyPart: '髋关节', examType: 'CT平扫',
    ctdiVol: { '中国（2020版）': 20, 'ICRP 135': 18, 'IAEA': 18 },
    dlp: { '中国（2020版）': 800, 'ICRP 135': 650, 'IAEA': 700 },
    note: '双髋或股骨全长扫描范围大',
  },
];

// ============================================================
// 3. 单次检查剂量告警阈值
// ============================================================

export type AlertLevel = 'warning' | 'error';

export interface DoseAlertThreshold {
  id: string;
  level: AlertLevel;
  /** 告警维度：DLP / CTDIvol / 有效剂量 / 年累计 */
  dimension: 'DLP' | 'CTDIvol' | '有效剂量' | '年累计';
  threshold: number;
  unit: string;
  message: string;
  action: string;
}

export const DOSE_ALERT_THRESHOLDS: DoseAlertThreshold[] = [
  {
    id: 'DAL-01', level: 'warning', dimension: 'DLP', threshold: 1000, unit: 'mGy·cm',
    message: '单次检查 DLP 超过 1000 mGy·cm（成人腹部CT水平）',
    action: '检查方案是否合理；确认多期扫描必要性',
  },
  {
    id: 'DAL-02', level: 'error', dimension: 'DLP', threshold: 2000, unit: 'mGy·cm',
    message: '单次检查 DLP 超过 2000 mGy·cm（高剂量阈值）',
    action: '暂停扫描流程，技师与医师确认扫描范围/期相；记录剂量异常事件',
  },
  {
    id: 'DAL-03', level: 'warning', dimension: 'CTDIvol', threshold: 30, unit: 'mGy',
    message: '单期 CTDIvol 超过 30 mGy（儿童剂量需更低）',
    action: '检查管电流设置；儿童按体重方案复核',
  },
  {
    id: 'DAL-04', level: 'error', dimension: 'CTDIvol', threshold: 60, unit: 'mGy',
    message: '单期 CTDIvol 超过 60 mGy（颅脑成人上限）',
    action: '立即停止扫描检查设备参数；上报质控负责人',
  },
  {
    id: 'DAL-05', level: 'warning', dimension: '有效剂量', threshold: 20, unit: 'mSv',
    message: '单次检查有效剂量超过 20 mSv（相当于增强三期腹部CT）',
    action: '评估检查获益；与医师确认是否减少期相',
  },
  {
    id: 'DAL-06', level: 'error', dimension: '有效剂量', threshold: 50, unit: 'mSv',
    message: '单次检查有效剂量超过 50 mSv（确定性效应阈值关注）',
    action: '立即上报质控委员会；开展剂量调查',
  },
  {
    id: 'DAL-07', level: 'warning', dimension: '年累计', threshold: 100, unit: 'mSv',
    message: '患者年累计有效剂量超过 100 mSv（放射职业人群限值）',
    action: '标记高风险患者；建议临床减少非必要重复检查',
  },
  {
    id: 'DAL-08', level: 'warning', dimension: '年累计', threshold: 50, unit: 'mSv',
    message: '患者年累计有效剂量超过 50 mSv',
    action: '生成剂量随访记录；通知临床医生',
  },
  {
    id: 'DAL-09', level: 'warning', dimension: 'DLP', threshold: 400, unit: 'mGy·cm',
    message: '儿童（<15岁）单次检查 DLP 超过 400 mGy·cm',
    action: '儿童专属低剂量方案复核；确认适应症',
  },
  {
    id: 'DAL-10', level: 'error', dimension: 'DLP', threshold: 700, unit: 'mGy·cm',
    message: '儿童（<15岁）单次检查 DLP 超过 700 mGy·cm',
    action: '立即上报质控；儿童高剂量需双重授权',
  },
  {
    id: 'DAL-11', level: 'warning', dimension: '有效剂量', threshold: 10, unit: 'mSv',
    message: '孕妇单次检查有效剂量超过 10 mSv（胎儿剂量关注）',
    action: '由放射科医师+产科医师联合确认适应症',
  },
  {
    id: 'DAL-12', level: 'warning', dimension: 'DLP', threshold: 300, unit: 'mGy·cm',
    message: '低剂量筛查（LDCT）DLP 超过 300 mGy·cm（筛查剂量目标）',
    action: '复核筛查扫描协议是否误用常规剂量',
  },
  {
    id: 'DAL-13', level: 'warning', dimension: 'CTDIvol', threshold: 5, unit: 'mGy',
    message: '低剂量筛查 CTDIvol 超过 5 mGy（建议 ≤3mGy）',
    action: '检查kV/mA设置，按筛查协议重新扫描',
  },
  {
    id: 'DAL-14', level: 'warning', dimension: 'DLP', threshold: 1500, unit: 'mGy·cm',
    message: '冠脉CTA DLP 超过 1500 mGy·cm（回顾性门控高剂量提示）',
    action: '确认是否可用前瞻性门控替代',
  },
  {
    id: 'DAL-15', level: 'warning', dimension: '年累计', threshold: 10, unit: 'mSv',
    message: '儿童年累计有效剂量超过 10 mSv',
    action: '建立儿童剂量档案，随访管理',
  },
];

// ============================================================
// 4. 单次检查剂量告警（检查方案层面）— 分部位剂量卡
// ============================================================

export interface DoseCard {
  bodyPart: string;
  modality: 'CT' | 'DR' | 'MG' | 'DSA';
  /** 常规单次有效剂量（mSv） */
  typicalEffectiveDose: number;
  /** 剂量当量描述（X线片等价比较） */
  xrayEquivalence: string;
  level: '低剂量（<1mSv）' | '中等剂量（1-10mSv）' | '较高剂量（10-30mSv）' | '高剂量（>30mSv）';
  notes: string;
}

export const DOSE_CARDS: DoseCard[] = [
  { bodyPart: '胸部X线（DR正位）', modality: 'DR', typicalEffectiveDose: 0.02, xrayEquivalence: '约等于0.4次乘飞机（8h）', level: '低剂量（<1mSv）', notes: '极低剂量，可重复' },
  { bodyPart: '四肢X线', modality: 'DR', typicalEffectiveDose: 0.001, xrayEquivalence: '约等于1天自然本底', level: '低剂量（<1mSv）', notes: '剂量可忽略' },
  { bodyPart: '腰椎DR正侧位', modality: 'DR', typicalEffectiveDose: 1.5, xrayEquivalence: '约75次胸部X线', level: '中等剂量（1-10mSv）', notes: '腰椎X线是DR中剂量较高部位' },
  { bodyPart: '乳腺钼靶（双位双乳）', modality: 'MG', typicalEffectiveDose: 0.4, xrayEquivalence: '约20次胸部X线', level: '低剂量（<1mSv）', notes: 'AGD ≤3mGy/张' },
  { bodyPart: '头颅CT', modality: 'CT', typicalEffectiveDose: 2.0, xrayEquivalence: '约100次胸部X线', level: '中等剂量（1-10mSv）', notes: '相当于数年自然本底' },
  { bodyPart: '胸部CT平扫', modality: 'CT', typicalEffectiveDose: 5.0, xrayEquivalence: '约250次胸部X线', level: '中等剂量（1-10mSv）', notes: '常规胸部CT' },
  { bodyPart: '腹部CT平扫', modality: 'CT', typicalEffectiveDose: 6.0, xrayEquivalence: '约300次胸部X线', level: '中等剂量（1-10mSv）', notes: '腹部实质器官高敏感' },
  { bodyPart: '腹盆CT增强', modality: 'CT', typicalEffectiveDose: 25.0, xrayEquivalence: '约1250次胸部X线', level: '较高剂量（10-30mSv）', notes: '多期扫描叠加' },
  { bodyPart: '冠脉CTA（前瞻性）', modality: 'CT', typicalEffectiveDose: 4.0, xrayEquivalence: '约200次胸部X线', level: '中等剂量（1-10mSv）', notes: '低剂量门控技术' },
  { bodyPart: '冠脉CTA（回顾性）', modality: 'CT', typicalEffectiveDose: 12.0, xrayEquivalence: '约600次胸部X线', level: '较高剂量（10-30mSv）', notes: '尽量使用前瞻性方案' },
  { bodyPart: 'DSA脑血管造影', modality: 'DSA', typicalEffectiveDose: 8.0, xrayEquivalence: '约400次胸部X线', level: '中等剂量（1-10mSv）', notes: '透视时间相关' },
  { bodyPart: '胸腹主动脉CTA', modality: 'CT', typicalEffectiveDose: 22.0, xrayEquivalence: '约1100次胸部X线', level: '较高剂量（10-30mSv）', notes: '扫描范围大' },
];

// ============================================================
// 5. 导出与工具函数
// ============================================================

export const DOSE_REFERENCES = {
  ctDose: CT_DOSE_REFERENCES,
  drl: DRL_COMPARISONS,
  alerts: DOSE_ALERT_THRESHOLDS,
  cards: DOSE_CARDS,
};

/** 查询某部位某人群某类型的CT剂量参考 */
export function getCtDoseReference(
  bodyPart: string,
  patientGroup: DosePatientGroup,
  examType: DoseExamType,
): CtDoseReference[] {
  return CT_DOSE_REFERENCES.filter(
    (d) =>
      d.bodyPart.includes(bodyPart) &&
      d.patientGroup === patientGroup &&
      d.examType === examType,
  );
}

/** 计算增强多期累计 DLP 与有效剂量 */
export function calcEnhancedTotal(reference: CtDoseReference): {
  totalDlp: number;
  totalEffectiveDose: number;
} {
  return {
    totalDlp: reference.dlpTypical * reference.phases,
    totalEffectiveDose: reference.effectiveDose * reference.phases,
  };
}

/** 检查单次 DLP 是否触发告警 */
export function checkDoseAlerts(
  dlp: number,
  ctdiVol: number,
  patientGroup: DosePatientGroup = '成人',
): DoseAlertThreshold[] {
  return DOSE_ALERT_THRESHOLDS.filter((a) => {
    if (a.dimension === 'DLP') {
      const limit = patientGroup === '儿童' && dlp > 0 ? Math.min(a.threshold, 400) : a.threshold;
      return dlp >= limit;
    }
    if (a.dimension === 'CTDIvol') {
      return ctdiVol >= a.threshold;
    }
    if (a.dimension === '有效剂量') {
      return dlp * 0.014 >= a.threshold;
    }
    return false;
  });
}

/** 检索诊断参考水平 */
export function findDrl(bodyPart: string, examType?: string): DrlComparison[] {
  return DRL_COMPARISONS.filter(
    (d) => d.bodyPart.includes(bodyPart) && (examType ? d.examType === examType : true),
  );
}
