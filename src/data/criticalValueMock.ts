/**
 * G005 RIS v3.0.5.1 - R3.CRITICAL 危急值 Mock 数据 (参考/种子数据)
 *
 * v3.0.6.12-A4: 事件 (CRITICAL_EVENTS / CRITICAL_EVENTS_FULL) 已迁出,
 *   改由 src/data/unifiedCriticalValues.ts 的 GENERATED_CRITICAL_VALUES
 *   通过 src/services/mockBackend/store.ts 的 criticalEvents collection 提供.
 *   本文件仅保留规则 / 级别 / 升级规则 / KPI 等参考常量, 作为 store 种子,
 *   并供 NhqmReporter / JciReporter / criticalValueService 等直接引用.
 */
import type {
  CriticalRule,
  CriticalLevelConfig,
  CriticalKPI,
  CriticalEscalationRule,
} from '../types/R3/R3.CRITICAL';

const isoOffset = (h: number) => new Date(Date.now() + h * 3600 * 1000).toISOString();

export const CRITICAL_LEVELS: CriticalLevelConfig[] = [
  { level: 'critical', label: '危急', labelEn: 'Critical', color: '#7f1d1d', bg: '#fee2e2', border: '#fca5a5', defaultChannels: ['phone', 'sms', 'inApp'], responseDeadline: 5, description: '需立即处理（5分钟内）', priority: 1 },
  { level: 'urgent', label: '紧急', labelEn: 'Urgent', color: 'var(--color-error-600)', bg: '#fef2f2', border: '#f87171', defaultChannels: ['phone', 'inApp', 'sms'], responseDeadline: 10, description: '需紧急处理（10分钟内）', priority: 2 },
  { level: 'warning', label: '警告', labelEn: 'Warning', color: 'var(--color-warning-500)', bg: '#fef3c7', border: '#fcd34d', defaultChannels: ['inApp', 'sms'], responseDeadline: 30, description: '需关注（30分钟内）', priority: 3 },
  { level: 'info', label: '提示', labelEn: 'Info', color: 'var(--color-primary-500)', bg: '#dbeafe', border: '#93c5fd', defaultChannels: ['inApp'], responseDeadline: 60, description: '需关注（1小时内）', priority: 4 },
];

export const CRITICAL_RULES: CriticalRule[] = [
  { id: 'cv-001', code: 'CV-NEU-001', name: '急性脑梗死', nameEn: 'Acute ischemic stroke', category: 'neuro', level: 'critical', modality: ['CT', 'MR'], bodyPart: ['头颅'], keywords: ['脑梗塞', '缺血', '梗死', 'stoke'], findings: '颅内低密度/异常信号，符合急性脑梗死表现', channels: ['phone', 'inApp', 'sms'], responseDeadline: 10, escalateDeadline: 30, description: '急性缺血性脑卒中需要在时间窗内进行溶栓/取栓治疗', reference: 'AHA/ASA 2018', isActive: true, customRule: false, triggerCount: 5, hitRate: 0.95, lastTriggeredAt: isoOffset(-72), veto: true, dualReviewRequired: true },
  { id: 'cv-002', code: 'CV-NEU-002', name: '颅内出血', nameEn: 'Intracranial hemorrhage', category: 'neuro', level: 'critical', modality: ['CT', 'MR'], bodyPart: ['头颅'], keywords: ['出血', '血肿', '蛛网膜下腔', '硬膜下', '硬膜外'], findings: '颅内高密度影/异常信号，符合脑出血表现', channels: ['phone', 'inApp', 'sms'], responseDeadline: 10, escalateDeadline: 30, description: '颅内出血需紧急处理控制颅内压', reference: 'AHA/ASA 2015', isActive: true, customRule: false, triggerCount: 3, hitRate: 0.92, lastTriggeredAt: isoOffset(-48), veto: true, dualReviewRequired: true },
  { id: 'cv-003', code: 'CV-NEU-003', name: '脑疝', nameEn: 'Brain herniation', category: 'neuro', level: 'critical', modality: ['CT'], bodyPart: ['头颅'], keywords: ['脑疝', '中线偏移', '环池'], findings: '脑组织移位，中线结构偏移>5mm，环池消失', channels: ['phone', 'inApp'], responseDeadline: 5, description: '脑疝形成需立即手术减压', reference: '神经外科重症管理专家共识', isActive: true, customRule: false, triggerCount: 1, hitRate: 1.0, lastTriggeredAt: isoOffset(-240), veto: true, dualReviewRequired: true },
  { id: 'cv-004', code: 'CV-NEU-004', name: '颅内动脉瘤', nameEn: 'Intracranial aneurysm', category: 'vascular', level: 'urgent', modality: ['CT', 'MR', 'DSA'], bodyPart: ['头颅'], keywords: ['动脉瘤', '瘤样扩张'], findings: '颅内血管瘤样扩张', channels: ['phone', 'inApp'], responseDeadline: 30, description: '未处理的动脉瘤有破裂风险', reference: 'AHA/ASA 2012', isActive: true, customRule: false, triggerCount: 2, hitRate: 0.88, veto: false, dualReviewRequired: false },
  { id: 'cv-005', code: 'CV-CAR-001', name: '急性冠脉综合征', nameEn: 'Acute coronary syndrome', category: 'cardio', level: 'critical', modality: ['CT'], bodyPart: ['心脏'], keywords: ['冠脉闭塞', '完全闭塞', '重度狭窄', '100%狭窄'], findings: '冠脉完全闭塞或重度狭窄（>90%）', channels: ['phone', 'inApp', 'sms', 'wechat'], responseDeadline: 10, description: '急性冠脉闭塞需立即 PCI 或溶栓', reference: 'ESC 2018', isActive: true, customRule: false, triggerCount: 4, hitRate: 0.94, veto: true, dualReviewRequired: true },
  { id: 'cv-006', code: 'CV-CAR-002', name: '主动脉夹层', nameEn: 'Aortic dissection', category: 'cardio', level: 'critical', modality: ['CT'], bodyPart: ['胸部'], keywords: ['主动脉夹层', '内膜片', '真假腔'], findings: '主动脉内见内膜片及真假腔', channels: ['phone', 'inApp', 'sms'], responseDeadline: 5, description: '主动脉夹层死亡率高，需紧急手术', reference: 'ESC 2014', isActive: true, customRule: false, triggerCount: 1, hitRate: 1.0, lastTriggeredAt: isoOffset(-480), veto: true, dualReviewRequired: true },
  { id: 'cv-007', code: 'CV-CAR-003', name: '肺栓塞', nameEn: 'Pulmonary embolism', category: 'cardio', level: 'critical', modality: ['CT'], bodyPart: ['胸部'], keywords: ['肺栓塞', 'PE', '充盈缺损'], findings: '肺动脉充盈缺损', channels: ['phone', 'inApp', 'sms'], responseDeadline: 30, description: '大面积或高危肺栓塞需紧急溶栓', reference: 'ESC 2019', isActive: true, customRule: false, triggerCount: 3, hitRate: 0.90, veto: true, dualReviewRequired: true },
  { id: 'cv-008', code: 'CV-CAR-004', name: '心包填塞', nameEn: 'Cardiac tamponade', category: 'cardio', level: 'critical', modality: ['CT', 'US'], bodyPart: ['心脏'], keywords: ['心包填塞', '大量心包积液'], findings: '心包大量积液伴填塞征象', channels: ['phone', 'inApp'], responseDeadline: 10, description: '心包填塞需紧急穿刺引流', reference: 'ESC 2015', isActive: true, customRule: false, triggerCount: 1, hitRate: 0.85, veto: true, dualReviewRequired: true },
  { id: 'cv-009', code: 'CV-PUL-001', name: '气胸', nameEn: 'Pneumothorax', category: 'pulmo', level: 'urgent', modality: ['CT', 'DR'], bodyPart: ['胸部'], keywords: ['气胸', '张力性气胸'], findings: '胸腔内游离气体，肺组织压缩', channels: ['phone', 'inApp'], responseDeadline: 30, description: '大量气胸或张力性气胸需紧急胸腔闭式引流', reference: 'BTS 2010', isActive: true, customRule: false, triggerCount: 3, hitRate: 0.92, veto: false, dualReviewRequired: false },
  { id: 'cv-010', code: 'CV-PUL-002', name: '大量胸腔积液', nameEn: 'Large pleural effusion', category: 'pulmo', level: 'urgent', modality: ['CT', 'DR', 'US'], bodyPart: ['胸部'], keywords: ['大量胸腔积液'], findings: '胸腔内大量液体密度影', channels: ['inApp', 'sms'], responseDeadline: 60, description: '大量胸腔积液需评估是否引流', reference: 'BTS 2010', isActive: true, customRule: false, triggerCount: 2, hitRate: 0.88, veto: false, dualReviewRequired: false },
  { id: 'cv-011', code: 'CV-ABD-001', name: '消化道穿孔', nameEn: 'GI perforation', category: 'abdomen', level: 'critical', modality: ['CT', 'DR'], bodyPart: ['腹部'], keywords: ['穿孔', '膈下游离气体', '气腹'], findings: '膈下或腹腔内游离气体', channels: ['phone', 'inApp', 'sms'], responseDeadline: 10, description: '消化道穿孔需紧急手术', reference: 'WSES 2017', isActive: true, customRule: false, triggerCount: 3, hitRate: 0.93, veto: true, dualReviewRequired: true },
  { id: 'cv-012', code: 'CV-ABD-002', name: '肝脾破裂', nameEn: 'Hepatic/splenic rupture', category: 'trauma', level: 'critical', modality: ['CT'], bodyPart: ['腹部'], keywords: ['肝破裂', '脾破裂', '肝挫裂伤', '脾挫裂伤'], findings: '肝/脾内见不规则高/低密度影伴腹腔积血', channels: ['phone', 'inApp', 'sms'], responseDeadline: 10, description: '肝脾破裂伴活动性出血需紧急手术', reference: 'WSES 2017', isActive: true, customRule: false, triggerCount: 2, hitRate: 0.95, veto: true, dualReviewRequired: true },
  { id: 'cv-013', code: 'CV-ABD-003', name: '肠梗阻', nameEn: 'Bowel obstruction', category: 'abdomen', level: 'urgent', modality: ['CT'], bodyPart: ['腹部'], keywords: ['肠梗阻', '肠管扩张', '液气平面'], findings: '肠管明显扩张伴液气平面', channels: ['inApp', 'sms'], responseDeadline: 60, description: '完全性肠梗阻需紧急处理', reference: 'WSES', isActive: true, customRule: false, triggerCount: 1, hitRate: 0.87, veto: false, dualReviewRequired: false },
  { id: 'cv-014', code: 'CV-OBG-001', name: '异位妊娠破裂', nameEn: 'Ectopic pregnancy rupture', category: 'obstetric', level: 'critical', modality: ['CT', 'US'], bodyPart: ['盆腔'], keywords: ['异位妊娠', '宫外孕', '破裂', '盆腔积血'], findings: '附件区混杂密度影伴盆腔大量积血', channels: ['phone', 'inApp', 'sms'], responseDeadline: 10, description: '异位妊娠破裂需紧急手术', reference: '妇产科危急值处理规范', isActive: true, customRule: false, triggerCount: 1, hitRate: 0.96, veto: true, dualReviewRequired: true },
  { id: 'cv-015', code: 'CV-TRA-001', name: '骨折伴移位', nameEn: 'Displaced fracture', category: 'trauma', level: 'urgent', modality: ['CT', 'DR'], bodyPart: ['脊柱', '四肢'], keywords: ['骨折', '移位', '成角'], findings: '骨折伴明显移位或成角', channels: ['inApp', 'sms'], responseDeadline: 60, description: '明显移位骨折需复位固定', reference: '骨科急诊处理规范', isActive: true, customRule: false, triggerCount: 5, hitRate: 0.85, veto: false, dualReviewRequired: false },
  { id: 'cv-016', code: 'CV-TRA-002', name: '脊髓压迫', nameEn: 'Spinal cord compression', category: 'trauma', level: 'critical', modality: ['MR', 'CT'], bodyPart: ['脊柱'], keywords: ['脊髓压迫', '脊髓损伤', '椎管狭窄'], findings: '椎管内占位或骨折片压迫脊髓', channels: ['phone', 'inApp', 'sms'], responseDeadline: 10, description: '脊髓压迫需紧急手术减压', reference: '脊髓损伤急诊处理规范', isActive: true, customRule: false, triggerCount: 1, hitRate: 0.92, veto: true, dualReviewRequired: true },
  { id: 'cv-017', code: 'CV-CON-001', name: '造影剂严重过敏', nameEn: 'Severe contrast reaction', category: 'contrast', level: 'critical', modality: ['CT', 'MR'], bodyPart: ['全身'], keywords: ['过敏', '休克', '喉头水肿'], findings: '造影剂注射后出现严重过敏反应', channels: ['phone', 'inApp', 'sms'], responseDeadline: 5, description: '造影剂严重过敏需立即抢救', reference: 'ACR Manual', isActive: true, customRule: false, triggerCount: 0, hitRate: 1.0, veto: true, dualReviewRequired: false },
  { id: 'cv-018', code: 'CV-CON-002', name: '造影剂外渗', nameEn: 'Contrast extravasation', category: 'contrast', level: 'urgent', modality: ['CT', 'MR'], bodyPart: ['全身'], keywords: ['外渗', '渗漏', '肿胀'], findings: '造影剂注射部位出现明显外渗肿胀', channels: ['inApp'], responseDeadline: 30, description: '大量外渗需局部处理', reference: 'ACR Manual', isActive: true, customRule: false, triggerCount: 2, hitRate: 0.90, veto: false, dualReviewRequired: false },
  { id: 'cv-019', code: 'CV-PED-001', name: '儿童气道异物', nameEn: 'Pediatric airway foreign body', category: 'pediatric', level: 'critical', modality: ['CT', 'DR'], bodyPart: ['胸部'], keywords: ['气道异物', '支气管异物'], findings: '气道内见异物影', channels: ['phone', 'inApp', 'sms'], responseDeadline: 5, description: '儿童气道异物需立即取出', reference: '儿科急诊处理规范', isActive: true, customRule: false, triggerCount: 1, hitRate: 0.96, veto: true, dualReviewRequired: true },
  { id: 'cv-020', code: 'CV-OTH-001', name: '睾丸扭转', nameEn: 'Testicular torsion', category: 'other', level: 'critical', modality: ['US'], bodyPart: ['盆腔'], keywords: ['睾丸扭转'], findings: '睾丸血流减少/消失', channels: ['phone', 'inApp', 'sms'], responseDeadline: 5, description: '睾丸扭转需立即手术复位', reference: '泌尿外科急诊', isActive: true, customRule: false, triggerCount: 1, hitRate: 0.93, veto: true, dualReviewRequired: false },
];

export const CRITICAL_ESCALATION_RULES: CriticalEscalationRule[] = [
  { id: 'es-001', triggerAfterMinutes: 5, fromLevel: 'critical', toRole: 'chief', toRoleLabel: '科主任', channels: ['phone', 'sms'], messageTemplate: '危急值超时未通报，请立即处理', enabled: true, priority: 1 },
  { id: 'es-002', triggerAfterMinutes: 15, fromLevel: 'critical', toRole: 'medicalAffairs', toRoleLabel: '医务处', channels: ['phone', 'email'], messageTemplate: '危急值严重超时，请协调处理', enabled: true, priority: 2 },
  { id: 'es-003', triggerAfterMinutes: 15, fromLevel: 'urgent', toRole: 'chief', toRoleLabel: '科主任', channels: ['sms', 'inApp'], messageTemplate: '紧急值超时未通报', enabled: true, priority: 3 },
  { id: 'es-004', triggerAfterMinutes: 30, fromLevel: 'urgent', toRole: 'medicalAffairs', toRoleLabel: '医务处', channels: ['sms', 'email'], messageTemplate: '紧急值严重超时', enabled: true, priority: 4 },
  { id: 'es-005', triggerAfterMinutes: 60, fromLevel: 'warning', toRole: 'associateChief', toRoleLabel: '副主任', channels: ['inApp'], messageTemplate: '警告值超时', enabled: false, priority: 5 },
];

export const CRITICAL_KPI: CriticalKPI = {
  totalThisMonth: 23,
  pendingCount: 2,
  notifiedCount: 1,
  acknowledgedCount: 2,
  resolvedCount: 18,
  overdueCount: 1,
  onTimeNotificationRate: 91.3,
  avgResponseTimeMinutes: 7.2,
  medianResponseTimeMinutes: 6.0,
  p95ResponseTimeMinutes: 14.0,
  topRules: [
    { ruleCode: 'CV-NEU-001', ruleName: '急性脑梗死', count: 5, rate: 0.95 },
    { ruleCode: 'CV-CAR-001', ruleName: '急性冠脉综合征', count: 4, rate: 0.94 },
    { ruleCode: 'CV-PUL-001', ruleName: '气胸', count: 3, rate: 0.92 },
    { ruleCode: 'CV-ABD-001', ruleName: '消化道穿孔', count: 3, rate: 0.93 },
    { ruleCode: 'CV-ABD-002', ruleName: '肝脾破裂', count: 2, rate: 0.95 },
  ],
  byCategory: { 'neuro': 6, 'cardio': 7, 'pulmo': 4, 'abdomen': 4, 'trauma': 1, 'vascular': 0, 'contrast': 0, 'obstetric': 1, 'pediatric': 0, 'other': 0 },
  byModality: { 'CT': 16, 'MR': 3, 'DR': 2, 'DSA': 0, 'US': 2 },
  byLevel: { 'critical': 17, 'urgent': 5, 'warning': 1, 'info': 0 },
  byStatus: { 'pending': 2, 'notified': 1, 'acknowledged': 2, 'resolved': 18, 'overdue': 0, 'escalated': 0, 'cancelled': 0 },
  byDoctor: [
    { doctorId: 'D001', doctorName: '张明远', reportedCount: 6, avgTime: 5.5, onTimeRate: 1.0 },
    { doctorId: 'D006', doctorName: '赵雪琴', reportedCount: 5, avgTime: 4.2, onTimeRate: 1.0 },
    { doctorId: 'D002', doctorName: '李慧敏', reportedCount: 4, avgTime: 6.8, onTimeRate: 0.95 },
    { doctorId: 'D003', doctorName: '王建华', reportedCount: 3, avgTime: 8.5, onTimeRate: 0.85 },
    { doctorId: 'D005', doctorName: '刘文博', reportedCount: 3, avgTime: 9.0, onTimeRate: 0.83 },
  ],
  trend30d: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
    count: Math.floor(Math.random() * 3) + (i < 10 ? 1 : 0),
    resolvedCount: Math.floor(Math.random() * 3),
    onTimeRate: 0.85 + Math.random() * 0.15,
  })),
  missedReports: 0,
  dualReviewCompletion: 96.0,
};

export default {
  CRITICAL_LEVELS,
  CRITICAL_RULES,
  CRITICAL_ESCALATION_RULES,
  CRITICAL_KPI,
};