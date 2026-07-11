// ============================================================
// G005 放射科RIS系统 v1.0.5 - 危急值 + 特殊分类评估 Mock 数据
// Phase R5
// ============================================================

// ============================================================
// 危急值规则
// ============================================================
export interface CriticalValueRule {
  id: string;
  code: string;
  name: string;
  category: 'neuro' | 'cardio' | 'pulmo' | 'abdomen' | 'trauma' | 'vascular' | 'contrast';
  severity: 'high' | 'critical';
  modality: string[];
  bodyPart: string[];
  keywords: string[];           // 触发关键字
  findings: string;            // 触发所见模式
  notificationChannels: ('phone' | 'sms' | 'wechat' | 'inApp')[];
  responseDeadline: number;    // 分钟
  description: string;
  reference: string;            // 指南参考
  isActive: boolean;
}

export const CRITICAL_VALUE_RULES: CriticalValueRule[] = [
  // 神经
  { id: 'cv-001', code: 'CV-NEU-001', name: '急性脑梗死', category: 'neuro', severity: 'critical',
    modality: ['CT', 'MR'], bodyPart: ['头颅'],
    keywords: ['脑梗死', '缺血', '梗死', 'stoke'],
    findings: '颅内低密度/异常信号，符合急性脑梗死表现',
    notificationChannels: ['phone', 'inApp', 'sms'],
    responseDeadline: 10,
    description: '急性缺血性脑卒中需要在时间窗内进行溶栓/取栓治疗',
    reference: 'AHA/ASA 2018 急性缺血性卒中早期管理指南',
    isActive: true },
  { id: 'cv-002', code: 'CV-NEU-002', name: '颅内出血', category: 'neuro', severity: 'critical',
    modality: ['CT', 'MR'], bodyPart: ['头颅'],
    keywords: ['出血', '血肿', '蛛网膜下腔', '硬膜外', '硬膜下'],
    findings: '颅内高密度影/异常信号，符合脑出血表现',
    notificationChannels: ['phone', 'inApp', 'sms'],
    responseDeadline: 10,
    description: '颅内出血需紧急处理控制颅内压',
    reference: 'AHA/ASA 2015 自发性脑出血管理指南',
    isActive: true },
  { id: 'cv-003', code: 'CV-NEU-003', name: '脑疝', category: 'neuro', severity: 'critical',
    modality: ['CT'], bodyPart: ['头颅'],
    keywords: ['脑疝', '中线偏移', '环池'],
    findings: '脑组织移位，中线结构偏移 >5mm，环池消失',
    notificationChannels: ['phone', 'inApp'],
    responseDeadline: 5,
    description: '脑疝形成需立即手术减压',
    reference: '神经外科重症管理专家共识',
    isActive: true },
  { id: 'cv-004', code: 'CV-NEU-004', name: '颅内动脉瘤', category: 'vascular', severity: 'high',
    modality: ['CT', 'MR', 'DSA'], bodyPart: ['头颅'],
    keywords: ['动脉瘤', '瘤样扩张'],
    findings: '颅内血管瘤样扩张',
    notificationChannels: ['phone', 'inApp'],
    responseDeadline: 30,
    description: '未处理的动脉瘤有破裂风险',
    reference: 'AHA/ASA 2012 动脉瘤性 SAH 指南',
    isActive: true },
  // 心血管
  { id: 'cv-005', code: 'CV-CAR-001', name: '急性冠脉综合征', category: 'cardio', severity: 'critical',
    modality: ['CT'], bodyPart: ['心脏'],
    keywords: ['冠脉闭塞', '完全闭塞', '重度狭窄', '100%狭窄'],
    findings: '冠脉完全闭塞或重度狭窄（>90%）',
    notificationChannels: ['phone', 'inApp', 'sms', 'wechat'],
    responseDeadline: 10,
    description: '急性冠脉闭塞需立即 PCI 或溶栓',
    reference: 'ESC 2018 心肌血运重建指南',
    isActive: true },
  { id: 'cv-006', code: 'CV-CAR-002', name: '主动脉夹层', category: 'cardio', severity: 'critical',
    modality: ['CT'], bodyPart: ['胸部'],
    keywords: ['主动脉夹层', '内膜片', '真假腔'],
    findings: '主动脉内见内膜片及真假腔',
    notificationChannels: ['phone', 'inApp', 'sms'],
    responseDeadline: 5,
    description: '主动脉夹层死亡率高，需紧急手术',
    reference: 'ESC 2014 主动脉疾病诊断治疗指南',
    isActive: true },
  { id: 'cv-007', code: 'CV-CAR-003', name: '肺栓塞', category: 'cardio', severity: 'critical',
    modality: ['CT'], bodyPart: ['胸部'],
    keywords: ['肺栓塞', 'PE', '充盈缺损'],
    findings: '肺动脉充盈缺损',
    notificationChannels: ['phone', 'inApp', 'sms'],
    responseDeadline: 30,
    description: '大面积或高危肺栓塞需紧急溶栓',
    reference: 'ESC 2019 急性肺栓塞诊断治疗指南',
    isActive: true },
  { id: 'cv-008', code: 'CV-CAR-004', name: '心包填塞', category: 'cardio', severity: 'critical',
    modality: ['CT', 'US'], bodyPart: ['心脏'],
    keywords: ['心包填塞', '大量心包积液'],
    findings: '心包大量积液伴填塞征象',
    notificationChannels: ['phone', 'inApp'],
    responseDeadline: 10,
    description: '心包填塞需紧急穿刺引流',
    reference: 'ESC 2015 心包疾病指南',
    isActive: true },
  // 胸部
  { id: 'cv-009', code: 'CV-PUL-001', name: '气胸', category: 'pulmo', severity: 'high',
    modality: ['CT', 'DR'], bodyPart: ['胸部'],
    keywords: ['气胸', '张力性气胸'],
    findings: '胸腔内游离气体，肺组织压缩',
    notificationChannels: ['phone', 'inApp'],
    responseDeadline: 30,
    description: '大量气胸或张力性气胸需紧急胸腔闭式引流',
    reference: 'BTS 胸膜疾病指南 2010',
    isActive: true },
  { id: 'cv-010', code: 'CV-PUL-002', name: '大量胸腔积液', category: 'pulmo', severity: 'high',
    modality: ['CT', 'DR', 'US'], bodyPart: ['胸部'],
    keywords: ['大量胸腔积液', '中-大量'],
    findings: '胸腔内大量液体密度影',
    notificationChannels: ['inApp', 'sms'],
    responseDeadline: 60,
    description: '大量胸腔积液需评估是否引流',
    reference: 'BTS 胸膜疾病指南 2010',
    isActive: true },
  // 腹部
  { id: 'cv-011', code: 'CV-ABD-001', name: '消化道穿孔', category: 'abdomen', severity: 'critical',
    modality: ['CT', 'DR'], bodyPart: ['腹部'],
    keywords: ['穿孔', '膈下游离气体', '气腹'],
    findings: '膈下或腹腔内游离气体',
    notificationChannels: ['phone', 'inApp', 'sms'],
    responseDeadline: 10,
    description: '消化道穿孔需紧急手术',
    reference: 'WSES 消化道穿孔指南 2017',
    isActive: true },
  { id: 'cv-012', code: 'CV-ABD-002', name: '肝脾破裂', category: 'trauma', severity: 'critical',
    modality: ['CT'], bodyPart: ['腹部'],
    keywords: ['肝破裂', '脾破裂', '肝挫裂伤', '脾挫裂伤'],
    findings: '肝/脾内见不规则高/低密度影伴腹腔积血',
    notificationChannels: ['phone', 'inApp', 'sms'],
    responseDeadline: 10,
    description: '肝脾破裂伴活动性出血需紧急手术',
    reference: 'WSES 腹部创伤指南 2017',
    isActive: true },
  { id: 'cv-013', code: 'CV-ABD-003', name: '肠梗阻', category: 'abdomen', severity: 'high',
    modality: ['CT'], bodyPart: ['腹部'],
    keywords: ['肠梗阻', '肠管扩张', '液气平面'],
    findings: '肠管明显扩张伴液气平面',
    notificationChannels: ['inApp', 'sms'],
    responseDeadline: 60,
    description: '完全性肠梗阻需紧急处理',
    reference: 'WSES 急性肠梗阻指南',
    isActive: true },
  { id: 'cv-014', code: 'CV-ABD-004', name: '异位妊娠破裂', category: 'trauma', severity: 'critical',
    modality: ['CT', 'US'], bodyPart: ['盆腔'],
    keywords: ['异位妊娠', '宫外孕', '破裂', '盆腔积血'],
    findings: '附件区混杂密度影伴盆腔大量积血',
    notificationChannels: ['phone', 'inApp', 'sms'],
    responseDeadline: 10,
    description: '异位妊娠破裂需紧急手术',
    reference: '妇产科危急值处理规范',
    isActive: true },
  // 创伤
  { id: 'cv-015', code: 'CV-TRA-001', name: '骨折伴移位', category: 'trauma', severity: 'high',
    modality: ['CT', 'DR'], bodyPart: ['脊柱', '四肢'],
    keywords: ['骨折', '移位', '成角'],
    findings: '骨折伴明显移位或成角',
    notificationChannels: ['inApp', 'sms'],
    responseDeadline: 60,
    description: '明显移位骨折需复位固定',
    reference: '骨科急诊处理规范',
    isActive: true },
  { id: 'cv-016', code: 'CV-TRA-002', name: '脊髓压迫', category: 'trauma', severity: 'critical',
    modality: ['MR', 'CT'], bodyPart: ['脊柱'],
    keywords: ['脊髓压迫', '脊髓损伤', '椎管狭窄'],
    findings: '椎管内占位或骨折片压迫脊髓',
    notificationChannels: ['phone', 'inApp', 'sms'],
    responseDeadline: 10,
    description: '脊髓压迫需紧急手术减压',
    reference: '脊髓损伤急诊处理规范',
    isActive: true },
  // 造影剂
  { id: 'cv-017', code: 'CV-CON-001', name: '造影剂严重过敏', category: 'contrast', severity: 'critical',
    modality: ['CT', 'MR'], bodyPart: ['全身'],
    keywords: ['过敏', '休克', '喉头水肿'],
    findings: '造影剂注射后出现严重过敏反应',
    notificationChannels: ['phone', 'inApp', 'sms'],
    responseDeadline: 5,
    description: '造影剂严重过敏需立即抢救',
    reference: 'ACR 造影剂使用手册',
    isActive: true },
  { id: 'cv-018', code: 'CV-CON-002', name: '造影剂外渗', category: 'contrast', severity: 'high',
    modality: ['CT', 'MR'], bodyPart: ['全身'],
    keywords: ['外渗', '渗漏', '肿胀'],
    findings: '造影剂注射部位出现明显外渗肿胀',
    notificationChannels: ['inApp'],
    responseDeadline: 30,
    description: '大量外渗需局部处理',
    reference: 'ACR 造影剂使用手册',
    isActive: true },
];

// ============================================================
// 危急值事件
// ============================================================
export type CriticalStatus = 'pending' | 'notified' | 'acknowledged' | 'resolved' | 'overdue';

export interface CriticalEvent {
  id: string;
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  reportId: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  reportedById: string;
  reportedByName: string;
  reportedByTitle: string;
  reportedAt: string;
  receivingDoctorId?: string;
  receivingDoctorName?: string;
  receivingTime?: string;
  acknowledgedById?: string;
  acknowledgedByName?: string;
  acknowledgedTime?: string;
  resolvedTime?: string;
  status: CriticalStatus;
  channels: ('phone' | 'sms' | 'wechat' | 'inApp')[];
  detail: string;
  responseTimeMinutes?: number;
  // 10 分钟通报率统计
  onTimeNotification: boolean;  // 是否在 10 分钟内通报
}

export const CRITICAL_EVENTS: CriticalEvent[] = [
  { id: 'ce-001', ruleId: 'cv-001', ruleCode: 'CV-NEU-001', ruleName: '急性脑梗死',
    reportId: 'rpt-019', patientName: '高志远', modality: 'CT', bodyPart: '头颅',
    reportedById: 'D001', reportedByName: '张明远', reportedByTitle: '主任医师',
    reportedAt: '2026-06-02 15:30:00',
    receivingDoctorId: 'D105', receivingDoctorName: '陈雅芝（急诊神内）',
    receivingTime: '2026-06-02 15:35:00',
    acknowledgedById: 'D105', acknowledgedByName: '陈雅芝',
    acknowledgedTime: '2026-06-02 15:38:00', resolvedTime: '2026-06-02 18:00:00',
    status: 'resolved', channels: ['phone', 'inApp', 'sms'],
    detail: '左侧基底节区脑梗死（急性期），左侧大脑中动脉供血区',
    responseTimeMinutes: 5, onTimeNotification: true },
  { id: 'ce-002', ruleId: 'cv-005', ruleCode: 'CV-CAR-001', ruleName: '急性冠脉综合征',
    reportId: 'rpt-016', patientName: '罗小红', modality: 'CT', bodyPart: '心脏',
    reportedById: 'D006', reportedByName: '赵雪琴', reportedByTitle: '主任医师',
    reportedAt: '2026-06-03 13:30:00',
    receivingDoctorId: 'D201', receivingDoctorName: '王心怡（心内科）',
    receivingTime: '2026-06-03 13:36:00',
    acknowledgedById: 'D201', acknowledgedByName: '王心怡',
    acknowledgedTime: '2026-06-03 13:38:00', resolvedTime: '2026-06-03 15:30:00',
    status: 'resolved', channels: ['phone', 'inApp', 'sms', 'wechat'],
    detail: '左前降支中段重度狭窄约 90%，右冠状动脉远端狭窄约 80%',
    responseTimeMinutes: 6, onTimeNotification: true },
  { id: 'ce-003', ruleId: 'cv-012', ruleCode: 'CV-ABD-002', ruleName: '肝脾破裂',
    reportId: 'rpt-015', patientName: '马俊辉', modality: 'CT', bodyPart: '腹部',
    reportedById: 'D001', reportedByName: '张明远', reportedByTitle: '主任医师',
    reportedAt: '2026-06-04 00:30:00',
    receivingDoctorId: 'D301', receivingDoctorName: '李国华（急诊外科）',
    receivingTime: '2026-06-04 00:42:00',
    acknowledgedById: 'D301', acknowledgedByName: '李国华',
    acknowledgedTime: '2026-06-04 00:45:00', resolvedTime: '2026-06-04 03:00:00',
    status: 'resolved', channels: ['phone', 'inApp', 'sms'],
    detail: '肝右叶裂伤伴肝包膜下血肿，腹腔少量积血',
    responseTimeMinutes: 12, onTimeNotification: false },
  { id: 'ce-004', ruleId: 'cv-002', ruleCode: 'CV-NEU-002', ruleName: '颅内出血',
    reportId: 'ce-004-rel', patientName: '韩雪梅', modality: 'CT', bodyPart: '头颅',
    reportedById: 'D002', reportedByName: '李慧敏', reportedByTitle: '副主任医师',
    reportedAt: '2026-06-04 09:15:00',
    receivingDoctorId: 'D102', receivingDoctorName: '刘明（神内）',
    receivingTime: '2026-06-04 09:20:00',
    acknowledgedById: 'D102', acknowledgedByName: '刘明',
    acknowledgedTime: '2026-06-04 09:22:00',
    status: 'acknowledged', channels: ['phone', 'inApp'],
    detail: '右侧基底节区脑出血，约 12ml',
    responseTimeMinutes: 5, onTimeNotification: true },
  { id: 'ce-005', ruleId: 'cv-007', ruleCode: 'CV-CAR-003', ruleName: '肺栓塞',
    reportId: 'ce-005-rel', patientName: '孙立新', modality: 'CT', bodyPart: '胸部',
    reportedById: 'D003', reportedByName: '王建华', reportedByTitle: '主治医师',
    reportedAt: '2026-06-04 10:30:00',
    receivingDoctorId: 'D203', receivingDoctorName: '张静（呼吸科）',
    receivingTime: '2026-06-04 10:38:00',
    status: 'notified', channels: ['phone', 'inApp', 'sms'],
    detail: '双侧肺动脉多发充盈缺损，大面积肺栓塞可能',
    responseTimeMinutes: 8, onTimeNotification: true },
  { id: 'ce-006', ruleId: 'cv-011', ruleCode: 'CV-ABD-001', ruleName: '消化道穿孔',
    reportId: 'ce-006-rel', patientName: '林海生', modality: 'CT', bodyPart: '腹部',
    reportedById: 'D005', reportedByName: '刘文博', reportedByTitle: '副主任医师',
    reportedAt: '2026-06-04 11:20:00',
    status: 'pending', channels: [],
    detail: '膈下游离气体，考虑消化道穿孔',
    onTimeNotification: false },
  { id: 'ce-007', ruleId: 'cv-006', ruleCode: 'CV-CAR-002', ruleName: '主动脉夹层',
    reportId: 'ce-007-rel', patientName: '吴志强', modality: 'CT', bodyPart: '胸部',
    reportedById: 'D006', reportedByName: '赵雪琴', reportedByTitle: '主任医师',
    reportedAt: '2026-06-04 08:00:00',
    receivingDoctorId: 'D202', receivingDoctorName: '陈昊（心外科）',
    receivingTime: '2026-06-04 08:03:00',
    acknowledgedById: 'D202', acknowledgedByName: '陈昊',
    acknowledgedTime: '2026-06-04 08:05:00', resolvedTime: '2026-06-04 13:00:00',
    status: 'resolved', channels: ['phone', 'inApp', 'sms'],
    detail: 'Standford A 型主动脉夹层，内膜片累及升主动脉',
    responseTimeMinutes: 3, onTimeNotification: true },
  { id: 'ce-008', ruleId: 'cv-009', ruleCode: 'CV-PUL-001', ruleName: '气胸',
    reportId: 'ce-008-rel', patientName: '周海涛', modality: 'DR', bodyPart: '胸部',
    reportedById: 'D004', reportedByName: '陈晓燕', reportedByTitle: '住院医师',
    reportedAt: '2026-06-04 11:45:00',
    status: 'pending', channels: [],
    detail: '右侧大量气胸约 60%，肺组织压缩',
    onTimeNotification: false },
];

// ============================================================
// 危急值统计 KPI
// ============================================================
export interface CriticalValueKPI {
  totalThisMonth: number;
  pendingCount: number;
  notifiedCount: number;
  acknowledgedCount: number;
  resolvedCount: number;
  overdueCount: number;
  onTimeNotificationRate: number;    // 10 分钟通报率
  avgResponseTimeMinutes: number;
  topRules: Array<{ ruleCode: string; ruleName: string; count: number }>;
  byCategory: Record<string, number>;
  byModality: Record<string, number>;
  bySeverity: Record<string, number>;
  byDoctor: Array<{ doctorName: string; reportedCount: number; avgTime: number }>;
}

export const CRITICAL_VALUE_KPI: CriticalValueKPI = {
  totalThisMonth: 23,
  pendingCount: 2,
  notifiedCount: 1,
  acknowledgedCount: 1,
  resolvedCount: 19,
  overdueCount: 1,
  onTimeNotificationRate: 91.3,
  avgResponseTimeMinutes: 7.2,
  topRules: [
    { ruleCode: 'CV-NEU-001', ruleName: '急性脑梗死', count: 5 },
    { ruleCode: 'CV-CAR-001', ruleName: '急性冠脉综合征', count: 4 },
    { ruleCode: 'CV-PUL-001', ruleName: '气胸', count: 3 },
    { ruleCode: 'CV-ABD-001', ruleName: '消化道穿孔', count: 3 },
    { ruleCode: 'CV-ABD-002', ruleName: '肝脾破裂', count: 2 },
  ],
  byCategory: { 'neuro': 6, 'cardio': 7, 'pulmo': 4, 'abdomen': 4, 'trauma': 1, 'vascular': 1, 'contrast': 0 },
  byModality: { 'CT': 18, 'MR': 3, 'DR': 1, 'DSA': 0, 'US': 1 },
  bySeverity: { 'high': 8, 'critical': 15 },
  byDoctor: [
    { doctorName: '张明远（主任医师）', reportedCount: 6, avgTime: 5.5 },
    { doctorName: '赵雪琴（主任医师）', reportedCount: 5, avgTime: 4.2 },
    { doctorName: '李慧敏（副主任医师）', reportedCount: 4, avgTime: 6.8 },
    { doctorName: '王建华（主治医师）', reportedCount: 3, avgTime: 8.5 },
    { doctorName: '刘文博（副主任医师）', reportedCount: 3, avgTime: 9.0 },
  ],
};

// ============================================================
// 特殊分类评估 - 8 大系统
// ============================================================
export interface SpecialAssessmentItem {
  id: string;
  systemName: string;
  fullName: string;
  modality: string;
  bodyPart: string;
  category: string;        // BI-RADS / Lung-RADS / PI-RADS / CAD-RADS / TI-RADS / RECIST / 骨龄 / 心脏 CTA
  grades: { value: string; label: string; description: string; color: string; action: string }[];
  evaluationItems: { key: string; label: string; type: 'select' | 'number' | 'boolean'; options?: string[] }[];
  description: string;
  reference: string;
}

export const SPECIAL_ASSESSMENTS: SpecialAssessmentItem[] = [
  // BI-RADS 乳腺
  { id: 'sa-birads', systemName: 'BI-RADS', fullName: '乳腺影像报告与数据系统',
    modality: 'MG', bodyPart: '胸部', category: 'BI-RADS',
    grades: [
      { value: '0', label: '0 类 - 评估不完整', description: '需要进一步影像评估', color: '#94a3b8', action: '召回补充检查' },
      { value: '1', label: '1 类 - 阴性', description: '双乳对称，无肿块、无结构扭曲、无可疑钙化', color: '#10b981', action: '常规筛查' },
      { value: '2', label: '2 类 - 良性', description: '明确良性发现', color: '#10b981', action: '常规筛查' },
      { value: '3', label: '3 类 - 可能良性', description: '恶性可能性 ≤ 2%', color: '#f59e0b', action: '6 个月短期随访' },
      { value: '4A', label: '4A 类 - 低度可疑', description: '恶性可能性 2-10%', color: '#f97316', action: '组织活检' },
      { value: '4B', label: '4B 类 - 中度可疑', description: '恶性可能性 10-50%', color: '#ea580c', action: '组织活检' },
      { value: '4C', label: '4C 类 - 高度可疑', description: '恶性可能性 50-95%', color: '#dc2626', action: '组织活检' },
      { value: '5', label: '5 类 - 高度提示恶性', description: '恶性可能性 ≥ 95%', color: '#b91c1c', action: '组织活检 + 治疗' },
      { value: '6', label: '6 类 - 已证实恶性', description: '活检已证实的恶性肿瘤', color: '#7f1d1d', action: '临床治疗' },
    ],
    evaluationItems: [
      { key: 'breast_density', label: '腺体密度', type: 'select', options: ['A - 脂肪型', 'B - 散在纤维腺体型', 'C - 不均匀致密型', 'D - 极度致密型'] },
      { key: 'mass', label: '肿块', type: 'select', options: ['无', '有'] },
      { key: 'mass_size', label: '肿块最大径 (mm)', type: 'number' },
      { key: 'mass_shape', label: '肿块形态', type: 'select', options: ['圆形', '卵圆形', '不规则形'] },
      { key: 'mass_margin', label: '肿块边缘', type: 'select', options: ['清晰', '遮蔽', '微小分叶', '模糊', '毛刺'] },
      { key: 'calcification', label: '钙化', type: 'select', options: ['无', '典型良性', '可疑'] },
      { key: 'calc_type', label: '钙化形态', type: 'select', options: ['无定形', '粗糙不均质', '细小多形性', '细线/分支状'] },
    ],
    description: '美国放射学会乳腺影像报告与数据系统，用于规范乳腺影像报告',
    reference: 'ACR BI-RADS Atlas 第 5 版',
  },
  // Lung-RADS 肺结节
  { id: 'sa-lungrads', systemName: 'Lung-RADS', fullName: '肺成像报告与数据系统',
    modality: 'CT', bodyPart: '胸部', category: 'Lung-RADS',
    grades: [
      { value: '1', label: '1 类 - 阴性', description: '无结节；完全良性结节', color: '#10b981', action: '继续年度筛查' },
      { value: '2', label: '2 类 - 良性', description: '结节有典型良性钙化/脂肪', color: '#10b981', action: '继续年度筛查' },
      { value: '3', label: '3 类 - 可能良性', description: '实性结节 <6mm；部分实性 <6mm；GGN ≥6mm 且新发', color: '#f59e0b', action: '6 个月低剂量 CT 复查' },
      { value: '4A', label: '4A 类 - 可疑', description: '实性 6-8mm；部分实性 6-8mm；GGN ≥6mm', color: '#f97316', action: '3 个月 CT 复查' },
      { value: '4B', label: '4B 类 - 高度可疑', description: '实性 8-15mm；部分实性 8-15mm', color: '#ea580c', action: '3 个月 CT 复查 / PET-CT' },
      { value: '4X', label: '4X 类 - 高危', description: '具有额外特征或影像发现使可疑性增加', color: '#dc2626', action: '组织活检 / 切除' },
    ],
    evaluationItems: [
      { key: 'nodule_type', label: '结节类型', type: 'select', options: ['实性', '部分实性', '纯磨玻璃 (GGN)'] },
      { key: 'nodule_size', label: '结节最大径 (mm)', type: 'number' },
      { key: 'spiculation', label: '毛刺征', type: 'boolean' },
      { key: 'pleural_retraction', label: '胸膜凹陷征', type: 'boolean' },
      { key: 'upper_lobe', label: '位于上叶', type: 'boolean' },
    ],
    description: '美国放射学会肺成像报告与数据系统，用于规范低剂量 CT 肺结节报告',
    reference: 'ACR Lung-RADS 2.0',
  },
  // PI-RADS 前列腺
  { id: 'sa-pirads', systemName: 'PI-RADS', fullName: '前列腺成像报告与数据系统',
    modality: 'MR', bodyPart: '盆腔', category: 'PI-RADS',
    grades: [
      { value: '1', label: '1 类 - 极低风险', description: '正常外周带', color: '#10b981', action: '常规筛查' },
      { value: '2', label: '2 类 - 低风险', description: '低信号线状/楔形', color: '#10b981', action: '常规筛查' },
      { value: '3', label: '3 类 - 中等风险', description: '信号不均匀或界限不清', color: '#f59e0b', action: '短期 MRI 随访' },
      { value: '4', label: '4 类 - 高风险', description: 'DWI 局灶高信号', color: '#dc2626', action: '穿刺活检' },
      { value: '5', label: '5 类 - 极高风险', description: '病灶信号同 4 但更大', color: '#b91c1c', action: '穿刺活检' },
    ],
    evaluationItems: [
      { key: 'pz_focal', label: '外周带局灶信号', type: 'boolean' },
      { key: 'tz_focal', label: '移行带局灶信号', type: 'boolean' },
      { key: 'dwi_score', label: 'DWI 评分', type: 'select', options: ['1 - 正常', '2 - 模糊', '3 - 局灶高信号（轻度）', '4 - 局灶高信号（明显）', '5 - 局灶高信号（极明显）'] },
      { key: 'psa_level', label: 'PSA (ng/mL)', type: 'number' },
    ],
    description: '前列腺多参数 MRI 报告系统，用于前列腺癌检测',
    reference: 'ACR PI-RADS v2.1',
  },
  // CAD-RADS 冠脉
  { id: 'sa-cadrads', systemName: 'CAD-RADS', fullName: '冠脉报告与数据系统',
    modality: 'CT', bodyPart: '心脏', category: 'CAD-RADS',
    grades: [
      { value: '0', label: '0 类 - 不完整', description: '图像质量不足以评估', color: '#94a3b8', action: '重新检查' },
      { value: '1', label: '1 类 - 正常', description: '无狭窄 ≥ 25%', color: '#10b981', action: '常规随访' },
      { value: '2', label: '2 类 - 轻度斑块', description: '狭窄 1-24%', color: '#10b981', action: '预防性治疗' },
      { value: '3', label: '3 类 - 中度狭窄', description: '狭窄 25-49%', color: '#f59e0b', action: '优化药物治疗' },
      { value: '4A', label: '4A 类 - 重度狭窄', description: '狭窄 50-69% 或左主干 ≤ 50%', color: '#dc2626', action: '功能性检查 + 考虑血运重建' },
      { value: '4B', label: '4B 类 - 重度狭窄', description: '狭窄 70-99%', color: '#dc2626', action: '血运重建评估' },
      { value: '5', label: '5 类 - 完全闭塞', description: '100% 闭塞', color: '#7f1d1d', action: '紧急血运重建' },
    ],
    evaluationItems: [
      { key: 'lm_stenosis', label: '左主干狭窄', type: 'select', options: ['无', '<25%', '25-49%', '50-69%', '70-99%', '100%'] },
      { key: 'lad_stenosis', label: '前降支狭窄', type: 'select', options: ['无', '<25%', '25-49%', '50-69%', '70-99%', '100%'] },
      { key: 'lcx_stenosis', label: '回旋支狭窄', type: 'select', options: ['无', '<25%', '25-49%', '50-69%', '70-99%', '100%'] },
      { key: 'rca_stenosis', label: '右冠脉狭窄', type: 'select', options: ['无', '<25%', '25-49%', '50-69%', '70-99%', '100%'] },
      { key: 'plaque', label: '斑块类型', type: 'select', options: ['无', '钙化', '非钙化', '混合'] },
    ],
    description: '冠脉 CTA 报告系统，用于规范冠脉狭窄评估',
    reference: 'SCCT CAD-RADS 2.0',
  },
  // TI-RADS 甲状腺
  { id: 'sa-tirads', systemName: 'TI-RADS', fullName: '甲状腺成像报告与数据系统',
    modality: 'US', bodyPart: '颈部', category: 'TI-RADS',
    grades: [
      { value: '1', label: '1 类 - 正常', description: '正常甲状腺实质', color: '#10b981', action: '常规随访' },
      { value: '2', label: '2 类 - 良性', description: '纯囊性或海绵样结节', color: '#10b981', action: '常规随访' },
      { value: '3', label: '3 类 - 低度可疑', description: '等回声/高回声实性结节', color: '#f59e0b', action: '3 年随访' },
      { value: '4A', label: '4A 类 - 中度可疑', description: '低回声实性结节', color: '#f97316', action: '1 年随访' },
      { value: '4B', label: '4B 类 - 中高度可疑', description: '极低回声结节', color: '#ea580c', action: '6 个月随访' },
      { value: '4C', label: '4C 类 - 高度可疑', description: '可疑超声特征', color: '#dc2626', action: '活检' },
      { value: '5', label: '5 类 - 高度提示恶性', description: '典型恶性征象', color: '#b91c1c', action: '活检' },
    ],
    evaluationItems: [
      { key: 'composition', label: '成分', type: 'select', options: ['囊性', '海绵样', '囊实混合', '实性'] },
      { key: 'echogenicity', label: '回声', type: 'select', options: ['无回声', '高回声', '等回声', '低回声', '极低回声'] },
      { key: 'shape', label: '形态', type: 'select', options: ['纵横比 <1', '纵横比 >1'] },
      { key: 'margin', label: '边缘', type: 'select', options: ['光整', '分叶', '毛刺', '不规则'] },
      { key: 'calcification', label: '钙化', type: 'select', options: ['无', '大钙化', '周边钙化', '点状钙化'] },
    ],
    description: 'ACR 甲状腺成像报告与数据系统',
    reference: 'ACR TI-RADS 2017',
  },
  // RECIST 1.1 实体瘤疗效
  { id: 'sa-recist', systemName: 'RECIST 1.1', fullName: '实体瘤疗效评价标准',
    modality: 'CT', bodyPart: '全身', category: 'RECIST',
    grades: [
      { value: 'CR', label: 'CR 完全缓解', description: '所有靶病灶消失', color: '#10b981', action: '维持治疗' },
      { value: 'PR', label: 'PR 部分缓解', description: '靶病灶长径之和缩小 ≥ 30%', color: '#84cc16', action: '继续治疗' },
      { value: 'SD', label: 'SD 疾病稳定', description: '未达 PR/PD 标准', color: '#f59e0b', action: '继续观察' },
      { value: 'PD', label: 'PD 疾病进展', description: '靶病灶长径之和增加 ≥ 20% 或出现新病灶', color: '#dc2626', action: '调整治疗方案' },
    ],
    evaluationItems: [
      { key: 'target_lesion_count', label: '靶病灶数量', type: 'number' },
      { key: 'sum_baseline', label: '基线长径之和 (mm)', type: 'number' },
      { key: 'sum_current', label: '当前长径之和 (mm)', type: 'number' },
      { key: 'new_lesion', label: '新发病灶', type: 'boolean' },
    ],
    description: '实体瘤疗效评价标准 1.1，用于肿瘤治疗反应评估',
    reference: 'Eisenhauer et al. RECIST 1.1, Eur J Cancer 2009',
  },
  // 骨龄
  { id: 'sa-boneage', systemName: '骨龄评估', fullName: 'TW3 / 中华 05 法骨龄',
    modality: 'DR', bodyPart: '全身', category: '骨龄',
    grades: [
      { value: 'normal', label: '正常', description: '骨龄与实际年龄相符（差值 <1 岁）', color: '#10b981', action: '常规记录' },
      { value: 'advanced', label: '提前', description: '骨龄 > 实际年龄 1 岁以上', color: '#f59e0b', action: '临床评估' },
      { value: 'delayed', label: '延迟', description: '骨龄 < 实际年龄 1 岁以上', color: '#f59e0b', action: '临床评估' },
    ],
    evaluationItems: [
      { key: 'chronological_age', label: '实际年龄 (岁)', type: 'number' },
      { key: 'bone_age_tw3', label: '骨龄 TW3 法 (岁)', type: 'number' },
      { key: 'bone_age_cn05', label: '骨龄 中华 05 法 (岁)', type: 'number' },
    ],
    description: 'TW3-RUS 法（欧美）和中华 05 法（中国）的骨龄评估',
    reference: 'TW3 (Tanner-Whitehouse 3rd), 中华 05 法',
  },
  // 心脏 CTA
  { id: 'sa-cardiac', systemName: '心脏 CTA', fullName: '冠状动脉 CT 血管成像评估',
    modality: 'CT', bodyPart: '心脏', category: '心脏CTA',
    grades: [
      { value: 'excellent', label: '优秀', description: '图像质量优，冠脉全程清晰', color: '#10b981', action: '诊断可靠' },
      { value: 'good', label: '良好', description: '图像质量良，主要节段可评估', color: '#84cc16', action: '诊断基本可靠' },
      { value: 'adequate', label: '可评估', description: '部分节段可评估，少数受限', color: '#f59e0b', action: '结合其他检查' },
      { value: 'limited', label: '受限', description: '图像质量差，多节段无法评估', color: '#dc2626', action: '建议其他检查' },
    ],
    evaluationItems: [
      { key: 'hr', label: '心率 (bpm)', type: 'number' },
      { key: 'rhythm', label: '心律', type: 'select', options: ['窦性', '房颤', '其他心律失常'] },
      { key: 'calcium_score', label: '钙化积分 (Agatston)', type: 'number' },
      { key: 'image_quality', label: '图像质量', type: 'select', options: ['优秀', '良好', '可评估', '受限'] },
    ],
    description: '心脏 CTA 影像质量与诊断评估',
    reference: 'SCCT 心脏 CTA 评估指南',
  },
];

export default {
  CRITICAL_VALUE_RULES,
  CRITICAL_EVENTS,
  CRITICAL_VALUE_KPI,
  SPECIAL_ASSESSMENTS,
};
