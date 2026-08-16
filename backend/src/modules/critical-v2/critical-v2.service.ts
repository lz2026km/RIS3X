/**
 * G005 放射RIS系统 v3.0.6.11-101 - 危急值管理 V2 (Wave 6C, F5, 孤儿模块)
 *
 * 能力:
 *  1. 危急值规则库: 按检查类型/项目/阈值的确定性规则 (CT 脑出血、MR 急性梗死、
 *     肺栓塞等 24 条), 阈值边界语义: > 不含边界 / >= 含边界 / < 不含边界 / <= 含边界。
 *  2. 自动判定: 检查结果数值/描述 → 规则匹配 → 危急值触发 (级别/描述/建议处置)。
 *  3. 通知管理: 通知渠道 (电话/短信/消息), 通知记录 (对象/时间/状态),
 *     确认流程 (接受/拒绝/备注)。
 *  4. 统计: 触发率 / 确认及时率 / 超时率。
 *
 * 孤儿模块模式 + seed 回退: 不注册进 app.module, spec 直接注入测试;
 * DB 可用时联动 criticalValue/auditLog, 不可用时纯内存 seed 仍可用。
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'

// ================= 类型 =================

export type CriticalLevelV2 = 'critical' | 'urgent' | 'warning'
export type CompareOpV2 = '>' | '>=' | '<' | '<=' | 'contains' | 'notContains'
export type TriggerStatusV2 = 'triggered' | 'notified' | 'confirmed' | 'rejected' | 'resolved'
export type NotifyChannelV2 = 'phone' | 'sms' | 'message'
export type NotificationStatusV2 = 'sent' | 'failed' | 'accepted' | 'rejected'
export type ConfirmDecisionV2 = 'accepted' | 'rejected'

export interface CriticalRuleV2 {
  id: string
  code: string
  name: string
  category: string
  modality: string
  examType: string
  itemKey: string
  item: string
  operator: CompareOpV2
  threshold?: number
  thresholdText?: string
  unit?: string
  level: CriticalLevelV2
  description: string
  suggestion: string
  responseDeadlineMin: number
  enabled: boolean
  createdAt: string
}

export interface EvaluateItemV2 {
  key: string
  name?: string
  value: number | string
  unit?: string
}

export interface EvaluateInputV2 {
  patientId?: string
  patientName?: string
  examType?: string
  modality?: string
  items?: EvaluateItemV2[]
  description?: string
}

export interface CriticalTriggerV2 {
  id: string
  ruleId: string
  ruleCode: string
  ruleName: string
  level: CriticalLevelV2
  patientId?: string
  patientName: string
  examType?: string
  modality?: string
  matchedItem?: string
  matchedValue?: string
  matchedText: string
  description: string
  suggestion: string
  status: TriggerStatusV2
  notifiedAt?: string
  confirmedBy?: string
  confirmedAt?: string
  confirmDecision?: ConfirmDecisionV2
  confirmComment?: string
  responseMinutes?: number
  createdAt: string
}

export interface CriticalNotificationV2 {
  id: string
  triggerId: string
  channel: NotifyChannelV2
  recipientName: string
  recipientDept?: string
  recipientPhone?: string
  content: string
  status: NotificationStatusV2
  sentAt?: string
  confirmedAt?: string
  createdAt: string
}

export interface CriticalStatsV2 {
  totalEvaluations: number
  totalTriggers: number
  triggerRate: number
  confirmedCount: number
  rejectedCount: number
  onTimeConfirmRate: number
  timeoutCount: number
  timeoutRate: number
  avgResponseMinutes: number
  byLevel: { level: CriticalLevelV2; count: number }[]
  topRules: { ruleId: string; ruleCode: string; ruleName: string; count: number }[]
}

// ================= 规则库 (确定性 seed, 24 条) =================

const RULE_SEED: Omit<CriticalRuleV2, 'enabled' | 'createdAt'>[] = [
  { id: 'cvr-001', code: 'CV-R-001', name: '急性脑出血 (CT)', category: '神经', modality: 'CT', examType: '头颅CT平扫', itemKey: 'ct_value_hu', item: '脑出血灶CT值(HU)', operator: '>', threshold: 70, unit: 'HU', level: 'critical', description: '脑实质内高密度灶, CT值 > 70HU 提示急性出血', suggestion: '立即电话通知神经外科值班医生, 评估急诊开颅指征', responseDeadlineMin: 10 },
  { id: 'cvr-002', code: 'CV-R-002', name: '急性大面积脑梗死 (MR-DWI)', category: '神经', modality: 'MR', examType: '头颅MR平扫', itemKey: 'dwi_ratio', item: 'DWI信号比值', operator: '>', threshold: 1.5, unit: '', level: 'critical', description: 'DWI 高信号区信号比值 > 1.5, 提示急性脑梗死', suggestion: '立即通知神经内科, 评估静脉溶栓/血管内治疗时间窗', responseDeadlineMin: 10 },
  { id: 'cvr-003', code: 'CV-R-003', name: '肺栓塞 (CTPA)', category: '胸部', modality: 'CT', examType: '肺动脉CTA', itemKey: 'pe_index', item: '肺动脉栓塞指数(%)', operator: '>', threshold: 40, unit: '%', level: 'critical', description: '肺动脉主干/分支充盈缺损, 栓塞指数 > 40%', suggestion: '立即抗凝治疗, 请呼吸内科/心血管内科紧急会诊', responseDeadlineMin: 10 },
  { id: 'cvr-004', code: 'CV-R-004', name: '升主动脉增宽 (夹层/瘤样扩张)', category: '心血管', modality: 'CT', examType: '主动脉CTA', itemKey: 'aorta_diameter', item: '升主动脉直径(mm)', operator: '>', threshold: 50, unit: 'mm', level: 'critical', description: '升主动脉直径 > 50mm, 警惕夹层/瘤样扩张', suggestion: '立即心外科会诊, 控制血压心率', responseDeadlineMin: 5 },
  { id: 'cvr-005', code: 'CV-R-005', name: '主动脉夹层 (内膜片征)', category: '心血管', modality: 'CT', examType: '主动脉CTA', itemKey: 'intimal_flap', item: '内膜片征', operator: 'contains', thresholdText: '内膜片', level: 'critical', description: '发现内膜片/真假双腔, 主动脉夹层确诊', suggestion: '立即通知心血管外科并转急诊绿色通道', responseDeadlineMin: 5 },
  { id: 'cvr-006', code: 'CV-R-006', name: '心脏压塞 (大量心包积液)', category: '心血管', modality: 'CT', examType: '胸部CT', itemKey: 'pericardial_depth', item: '心包积液深度(mm)', operator: '>', threshold: 20, unit: 'mm', level: 'critical', description: '心包积液深度 > 20mm, 提示压塞风险', suggestion: '紧急心内科会诊, 准备心包穿刺引流', responseDeadlineMin: 10 },
  { id: 'cvr-007', code: 'CV-R-007', name: '张力性气胸', category: '胸部', modality: 'CT', examType: '胸部CT', itemKey: 'pneumo_ratio', item: '气胸肺压缩比(%)', operator: '>', threshold: 50, unit: '%', level: 'urgent', description: '气胸压缩比 > 50% 或纵隔移位, 张力性气胸可能', suggestion: '立即通知胸外科, 急诊胸腔减压排气', responseDeadlineMin: 15 },
  { id: 'cvr-008', code: 'CV-R-008', name: '膈下游离气体 (消化道穿孔)', category: '腹部', modality: 'CT', examType: '腹部CT平扫', itemKey: 'free_air', item: '游离气体', operator: 'contains', thresholdText: '膈下游离气体', level: 'critical', description: '膈下/腹腔游离气体, 消化道穿孔可能', suggestion: '立即通知普外科急诊手术评估', responseDeadlineMin: 10 },
  { id: 'cvr-009', code: 'CV-R-009', name: '肝破裂出血', category: '腹部', modality: 'CT', examType: '腹部CT平扫', itemKey: 'ascites_depth', item: '腹腔积液深度(mm)', operator: '>', threshold: 30, unit: 'mm', level: 'critical', description: '腹腔积液 > 30mm 伴肝包膜不连续, 肝破裂出血可能', suggestion: '立即急诊外科会诊, 备血补液抗休克', responseDeadlineMin: 10 },
  { id: 'cvr-010', code: 'CV-R-010', name: '脾破裂', category: '腹部', modality: 'CT', examType: '腹部CT平扫', itemKey: 'peri_splenic_hematoma', item: '脾周血肿厚度(mm)', operator: '>', threshold: 25, unit: 'mm', level: 'critical', description: '脾周血肿 > 25mm, 提示脾破裂', suggestion: '急诊外科会诊, 评估保守或手术', responseDeadlineMin: 10 },
  { id: 'cvr-011', code: 'CV-R-011', name: '中线移位 (脑疝风险)', category: '神经', modality: 'CT', examType: '头颅CT平扫', itemKey: 'midline_shift', item: '中线移位(mm)', operator: '>', threshold: 10, unit: 'mm', level: 'critical', description: '中线结构移位 > 10mm, 脑疝风险', suggestion: '立即神经外科会诊, 脱水降颅压', responseDeadlineMin: 5 },
  { id: 'cvr-012', code: 'CV-R-012', name: '硬膜外血肿', category: '神经', modality: 'CT', examType: '头颅CT平扫', itemKey: 'epidural_thickness', item: '硬膜外血肿厚度(mm)', operator: '>', threshold: 15, unit: 'mm', level: 'critical', description: '硬膜外血肿厚度 > 15mm', suggestion: '立即神经外科会诊, 急诊开颅血肿清除', responseDeadlineMin: 10 },
  { id: 'cvr-013', code: 'CV-R-013', name: '蛛网膜下腔出血 (SAH)', category: '神经', modality: 'CT', examType: '头颅CT平扫', itemKey: 'sah_sign', item: '蛛网膜下腔出血征象', operator: 'contains', thresholdText: '脑沟高密度', level: 'critical', description: '脑沟/脑池高密度, 蛛网膜下腔出血', suggestion: '立即神经外科会诊, 控制血压防再出血', responseDeadlineMin: 10 },
  { id: 'cvr-014', code: 'CV-R-014', name: '脑干出血', category: '神经', modality: 'CT', examType: '头颅CT平扫', itemKey: 'brainstem_hu', item: '脑干区CT值(HU)', operator: '>', threshold: 60, unit: 'HU', level: 'critical', description: '脑干区高密度出血灶', suggestion: '立即通知神经外科, 生命体征监测', responseDeadlineMin: 5 },
  { id: 'cvr-015', code: 'CV-R-015', name: '急性胰腺炎 (胰周渗出)', category: '腹部', modality: 'CT', examType: '腹部CT增强', itemKey: 'peri_pancreatic_count', item: '胰周渗出区域数', operator: '>=', threshold: 2, unit: '处', level: 'urgent', description: '胰周渗出/积液 ≥ 2 处, 重症胰腺炎倾向', suggestion: '通知消化内科/肝胆外科, 复查血淀粉酶', responseDeadlineMin: 30 },
  { id: 'cvr-016', code: 'CV-R-016', name: '肠系膜缺血 (肠壁积气)', category: '腹部', modality: 'CT', examType: '腹部CT增强', itemKey: 'pneumatosis', item: '肠壁积气征', operator: 'contains', thresholdText: '肠壁积气', level: 'critical', description: '肠壁积气/门静脉积气, 肠系膜缺血坏死可能', suggestion: '立即普外科会诊, 急诊手术评估', responseDeadlineMin: 10 },
  { id: 'cvr-017', code: 'CV-R-017', name: '小肠梗阻 (扩张)', category: '腹部', modality: 'CT', examType: '腹部CT平扫', itemKey: 'small_bowel_diameter', item: '小肠扩张直径(mm)', operator: '>', threshold: 40, unit: 'mm', level: 'warning', description: '小肠直径 > 40mm, 机械性肠梗阻', suggestion: '通知普外科, 禁食水胃肠减压', responseDeadlineMin: 60 },
  { id: 'cvr-018', code: 'CV-R-018', name: '胆道梗阻 (胆总管扩张)', category: '腹部', modality: 'MR', examType: 'MRCP', itemKey: 'cbd_diameter', item: '胆总管直径(mm)', operator: '>', threshold: 15, unit: 'mm', level: 'warning', description: '胆总管直径 > 15mm, 梗阻性黄疸可能', suggestion: '通知肝胆外科评估 ERCP 取石/支架', responseDeadlineMin: 60 },
  { id: 'cvr-019', code: 'CV-R-019', name: '急性胆囊炎', category: '腹部', modality: 'CT', examType: '腹部CT增强', itemKey: 'gallbladder_wall', item: '胆囊壁厚度(mm)', operator: '>', threshold: 4, unit: 'mm', level: 'warning', description: '胆囊壁 > 4mm 伴周围渗出, 急性胆囊炎', suggestion: '通知普外科, 抗感染治疗并评估手术', responseDeadlineMin: 60 },
  { id: 'cvr-020', code: 'CV-R-020', name: '大量胸腔积液', category: '胸部', modality: 'DR', examType: '胸部DR', itemKey: 'pleural_depth', item: '胸腔积液深度(mm)', operator: '>', threshold: 60, unit: 'mm', level: 'urgent', description: '胸腔积液 > 60mm, 大量积液呼吸困难风险', suggestion: '通知呼吸内科评估胸腔穿刺引流', responseDeadlineMin: 30 },
  { id: 'cvr-021', code: 'CV-R-021', name: '心源性肺水肿', category: '胸部', modality: 'DR', examType: '胸部DR', itemKey: 'batwing_sign', item: '蝶翼征', operator: 'contains', thresholdText: '蝶翼征', level: 'urgent', description: '双肺蝶翼状高密度, 心源性肺水肿', suggestion: '通知心内科, 利尿强心处理', responseDeadlineMin: 30 },
  { id: 'cvr-022', code: 'CV-R-022', name: '椎管占位 (脊髓受压)', category: '骨科', modality: 'MR', examType: '脊柱MR', itemKey: 'canal_occupancy', item: '椎管占位率(%)', operator: '>', threshold: 50, unit: '%', level: 'critical', description: '椎管占位率 > 50%, 脊髓受压', suggestion: '立即骨科/神经外科会诊, 评估减压', responseDeadlineMin: 15 },
  { id: 'cvr-023', code: 'CV-R-023', name: '纵隔气肿 (食管穿孔)', category: '胸部', modality: 'CT', examType: '胸部CT', itemKey: 'mediastinal_emphysema', item: '纵隔气肿征', operator: 'contains', thresholdText: '纵隔气肿', level: 'critical', description: '纵隔气肿, 警惕食管穿孔', suggestion: '立即胸外科会诊, 禁食评估', responseDeadlineMin: 10 },
  { id: 'cvr-024', code: 'CV-R-024', name: '腹膜后出血', category: '腹部', modality: 'CT', examType: '腹部CT增强', itemKey: 'retroperitoneal_hematoma', item: '腹膜后血肿征', operator: 'contains', thresholdText: '腹膜后血肿', level: 'critical', description: '腹膜后血肿, 出血性休克风险', suggestion: '立即介入/外科会诊, 备血', responseDeadlineMin: 10 },
]

const LEVEL_LABEL: Record<CriticalLevelV2, string> = {
  critical: '危急',
  urgent: '紧急',
  warning: '警告',
}

const CHANNEL_LABEL: Record<NotifyChannelV2, string> = {
  phone: '电话',
  sms: '短信',
  message: '站内消息',
}

// 种子触发记录 (时间锚定相对 now, 保证统计确定性)
const TRIGGER_SEED: CriticalTriggerV2[] = [
  {
    id: 'cvt-001', ruleId: 'cvr-001', ruleCode: 'CV-R-001', ruleName: '急性脑出血 (CT)', level: 'critical',
    patientId: 'RAD-P001', patientName: '张伟', examType: '头颅CT平扫', modality: 'CT',
    matchedItem: '脑出血灶CT值(HU)', matchedValue: '82 HU',
    matchedText: '脑出血灶CT值 82HU > 70HU 阈值', description: '脑实质内高密度灶, CT值 > 70HU 提示急性出血',
    suggestion: '立即电话通知神经外科值班医生, 评估急诊开颅指征',
    status: 'confirmed', confirmedBy: '王浩', confirmedAt: new Date(Date.now() - 6 * 60_000).toISOString(),
    confirmDecision: 'accepted', confirmComment: '已电话确认并通知神外值班',
    responseMinutes: 4, createdAt: new Date(Date.now() - 10 * 60_000).toISOString(), notifiedAt: new Date(Date.now() - 8 * 60_000).toISOString(),
  },
  {
    id: 'cvt-002', ruleId: 'cvr-003', ruleCode: 'CV-R-003', ruleName: '肺栓塞 (CTPA)', level: 'critical',
    patientId: 'RAD-P003', patientName: '李明', examType: '肺动脉CTA', modality: 'CT',
    matchedItem: '肺动脉栓塞指数(%)', matchedValue: '65%',
    matchedText: '肺动脉栓塞指数 65% > 40% 阈值', description: '肺动脉主干/分支充盈缺损, 栓塞指数 > 40%',
    suggestion: '立即抗凝治疗, 请呼吸内科/心血管内科紧急会诊',
    status: 'notified', notifiedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    createdAt: new Date(Date.now() - 15 * 60_000).toISOString(),
  },
  {
    id: 'cvt-003', ruleId: 'cvr-004', ruleCode: 'CV-R-004', ruleName: '升主动脉增宽 (夹层/瘤样扩张)', level: 'critical',
    patientId: 'RAD-P005', patientName: '赵敏', examType: '主动脉CTA', modality: 'CT',
    matchedItem: '升主动脉直径(mm)', matchedValue: '52 mm',
    matchedText: '升主动脉直径 52mm > 50mm 阈值', description: '升主动脉直径 > 50mm, 警惕夹层/瘤样扩张',
    suggestion: '立即心外科会诊, 控制血压心率',
    status: 'triggered', createdAt: new Date(Date.now() - 4 * 60_000).toISOString(),
  },
  {
    id: 'cvt-004', ruleId: 'cvr-015', ruleCode: 'CV-R-015', ruleName: '急性胰腺炎 (胰周渗出)', level: 'urgent',
    patientId: 'RAD-P007', patientName: '周婷', examType: '腹部CT增强', modality: 'CT',
    matchedItem: '胰周渗出区域数', matchedValue: '3 处',
    matchedText: '胰周渗出区域数 3处 ≥ 2处 阈值', description: '胰周渗出/积液 ≥ 2 处, 重症胰腺炎倾向',
    suggestion: '通知消化内科/肝胆外科, 复查血淀粉酶',
    status: 'confirmed', confirmedBy: '陈雅芝', confirmedAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    confirmDecision: 'accepted', confirmComment: '已接收, 消化内科处理中',
    responseMinutes: 15, createdAt: new Date(Date.now() - 33 * 60_000).toISOString(), notifiedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
  },
  {
    id: 'cvt-005', ruleId: 'cvr-017', ruleCode: 'CV-R-017', ruleName: '小肠梗阻 (扩张)', level: 'warning',
    patientId: 'RAD-P009', patientName: '吴强', examType: '腹部CT平扫', modality: 'CT',
    matchedItem: '小肠扩张直径(mm)', matchedValue: '45 mm',
    matchedText: '小肠扩张直径 45mm > 40mm 阈值', description: '小肠直径 > 40mm, 机械性肠梗阻',
    suggestion: '通知普外科, 禁食水胃肠减压',
    status: 'rejected', confirmedBy: '王芳', confirmedAt: new Date(Date.now() - 25 * 60_000).toISOString(),
    confirmDecision: 'rejected', confirmComment: '临床评估后判定为假阳性, 已备注',
    responseMinutes: 55, createdAt: new Date(Date.now() - 80 * 60_000).toISOString(), notifiedAt: new Date(Date.now() - 75 * 60_000).toISOString(),
  },
]

const NOTIFICATION_SEED: CriticalNotificationV2[] = [
  { id: 'cvn-001', triggerId: 'cvt-001', channel: 'phone', recipientName: '王浩', recipientDept: '神经外科', recipientPhone: '13800000001', content: '【危急值】张伟 头颅CT: 急性脑出血 CT值82HU, 请立即处理。', status: 'accepted', sentAt: new Date(Date.now() - 8 * 60_000).toISOString(), confirmedAt: new Date(Date.now() - 6 * 60_000).toISOString(), createdAt: new Date(Date.now() - 9 * 60_000).toISOString() },
  { id: 'cvn-002', triggerId: 'cvt-001', channel: 'sms', recipientName: '王浩', recipientDept: '神经外科', recipientPhone: '13800000001', content: '【危急值短信】急性脑出血, 请回复确认。', status: 'sent', sentAt: new Date(Date.now() - 7 * 60_000).toISOString(), createdAt: new Date(Date.now() - 9 * 60_000).toISOString() },
  { id: 'cvn-003', triggerId: 'cvt-002', channel: 'message', recipientName: '李芳', recipientDept: '呼吸内科', recipientPhone: '', content: '【危急值】李明 CTPA 提示肺栓塞, 栓塞指数65%, 请及时查看。', status: 'sent', sentAt: new Date(Date.now() - 12 * 60_000).toISOString(), createdAt: new Date(Date.now() - 14 * 60_000).toISOString() },
  { id: 'cvn-004', triggerId: 'cvt-003', channel: 'phone', recipientName: '陈雅芝', recipientDept: '心外科', recipientPhone: '13800000004', content: '【危急值】赵敏 主动脉CTA: 升主动脉52mm, 请立即会诊。', status: 'sent', sentAt: new Date(Date.now() - 3 * 60_000).toISOString(), createdAt: new Date(Date.now() - 4 * 60_000).toISOString() },
  { id: 'cvn-005', triggerId: 'cvt-004', channel: 'sms', recipientName: '王芳', recipientDept: '消化内科', recipientPhone: '13800000005', content: '【危急值】周婷 急性胰腺炎(胰周渗出3处), 请及时处理。', status: 'accepted', sentAt: new Date(Date.now() - 30 * 60_000).toISOString(), confirmedAt: new Date(Date.now() - 18 * 60_000).toISOString(), createdAt: new Date(Date.now() - 32 * 60_000).toISOString() },
  { id: 'cvn-006', triggerId: 'cvt-005', channel: 'message', recipientName: '吴倩', recipientDept: '普外科', recipientPhone: '', content: '【危急值】吴强 小肠梗阻(直径45mm), 请及时处理。', status: 'rejected', sentAt: new Date(Date.now() - 75 * 60_000).toISOString(), confirmedAt: new Date(Date.now() - 25 * 60_000).toISOString(), createdAt: new Date(Date.now() - 78 * 60_000).toISOString() },
]

@Injectable()
export class CriticalV2Service {
  private readonly logger = new Logger(CriticalV2Service.name)

  /** 规则库 (seed + 自定义) */
  private readonly rules: CriticalRuleV2[] = RULE_SEED.map((r) => ({ ...r, enabled: true, createdAt: '2026-08-01T00:00:00.000Z' }))

  /** 触发记录 */
  private readonly triggers: CriticalTriggerV2[] = [...TRIGGER_SEED]

  /** 通知记录 */
  private readonly notifications: CriticalNotificationV2[] = [...NOTIFICATION_SEED]

  /** 判定输入次数 (统计触发率用) */
  private evaluationCount = 0

  constructor(private readonly prisma: PrismaService) {}

  // ================= 规则库 =================

  listRules(filter?: { category?: string; modality?: string; enabled?: boolean; keyword?: string }): CriticalRuleV2[] {
    let list = [...this.rules]
    if (filter?.category) list = list.filter((r) => r.category === filter.category)
    if (filter?.modality) list = list.filter((r) => r.modality === filter.modality)
    if (filter?.enabled !== undefined) list = list.filter((r) => r.enabled === filter.enabled)
    if (filter?.keyword?.trim()) {
      const q = filter.keyword.trim().toLowerCase()
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.examType.toLowerCase().includes(q))
    }
    return list
  }

  createRule(dto: Omit<CriticalRuleV2, 'id' | 'code' | 'enabled' | 'createdAt'> & { code?: string }): CriticalRuleV2 {
    if (!dto.name?.trim()) throw new BadRequestException('规则名称不能为空')
    if (!dto.itemKey?.trim()) throw new BadRequestException('项目Key不能为空')
    if (!['>', '>=', '<', '<=', 'contains', 'notContains'].includes(dto.operator)) throw new BadRequestException('非法比较运算符')
    const rule: CriticalRuleV2 = {
      ...dto,
      id: `cvr-${Date.now().toString(36)}`,
      code: dto.code?.trim() || `CV-R-${this.rules.length + 1}`,
      enabled: true,
      createdAt: new Date().toISOString(),
    }
    this.rules.unshift(rule)
    return rule
  }

  updateRule(id: string, patch: Partial<Pick<CriticalRuleV2, 'enabled' | 'threshold' | 'thresholdText' | 'suggestion' | 'level'>>): CriticalRuleV2 {
    const rule = this.rules.find((r) => r.id === id)
    if (!rule) throw new NotFoundException(`危急值规则 ${id} 不存在`)
    Object.assign(rule, patch)
    return { ...rule }
  }

  // ================= 自动判定 =================

  /**
   * 规则匹配 (确定性): 先按检查类型/模态过滤, 再按项目数值或描述关键字比较。
   * 阈值边界语义: '>'/'<' 不含边界, '>='/'<=' 含边界。
   */
  matchRules(input: EvaluateInputV2): CriticalTriggerV2[] {
    const items = input.items ?? []
    const description = input.description ?? ''
    const hits: CriticalTriggerV2[] = []
    for (const rule of this.rules) {
      if (!rule.enabled) continue
      if (input.modality && rule.modality && rule.modality !== input.modality) continue
      if (input.examType && !this.matchesExamType(rule, input.examType)) continue
      const hit = this.matchSingleRule(rule, items, description)
      if (!hit) continue
      hits.push({
        id: `cvt-${Date.now().toString(36)}-${hits.length}`,
        ruleId: rule.id,
        ruleCode: rule.code,
        ruleName: rule.name,
        level: rule.level,
        patientId: input.patientId,
        patientName: input.patientName ?? '未知患者',
        examType: input.examType ?? rule.examType,
        modality: input.modality ?? rule.modality,
        matchedItem: hit.item,
        matchedValue: hit.value,
        matchedText: hit.text,
        description: rule.description,
        suggestion: rule.suggestion,
        status: 'triggered',
        createdAt: new Date().toISOString(),
      })
    }
    return hits
  }

  /** 纯判定, 不落库 — 供前端「自动判定预览」 */
  evaluate(input: EvaluateInputV2): { evaluatedAt: string; triggers: CriticalTriggerV2[] } {
    this.evaluationCount += 1
    return { evaluatedAt: new Date().toISOString(), triggers: this.matchRules(input) }
  }

  /** 自动判定并生成触发记录 + 自动通知 (电话/短信/消息三通道) */
  async judge(dto: EvaluateInputV2 & { recipients?: Array<{ name: string; dept?: string; phone?: string; channels?: NotifyChannelV2[] }> }): Promise<CriticalTriggerV2[]> {
    this.evaluationCount += 1
    const matched = this.matchRules(dto)
    const recipients = dto.recipients && dto.recipients.length > 0 ? dto.recipients : [{ name: '急诊值班医生', dept: '急诊科', phone: '13800000000' }]
    for (const t of matched) {
      t.id = `cvt-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 999)}`
      this.triggers.unshift(t)
      await this.notifyTrigger(t.id, {
        recipients: recipients.map((r) => ({ ...r, channels: (['phone', 'sms', 'message'] as NotifyChannelV2[]) })),
      }).catch(() => undefined)
      void this.persistCriticalValue(t)
    }
    return matched
  }

  listTriggers(filter?: { status?: string; level?: CriticalLevelV2; patientName?: string }): CriticalTriggerV2[] {
    let list = [...this.triggers]
    if (filter?.status) list = list.filter((t) => t.status === filter.status)
    if (filter?.level) list = list.filter((t) => t.level === filter.level)
    if (filter?.patientName?.trim()) list = list.filter((t) => t.patientName.includes(filter.patientName!.trim()))
    return list
  }

  getTrigger(id: string): CriticalTriggerV2 {
    const t = this.triggers.find((x) => x.id === id)
    if (!t) throw new NotFoundException(`危急值触发记录 ${id} 不存在`)
    return { ...t }
  }

  // ================= 通知管理 =================

  /** 发送通知: 电话/短信/消息, 记录对象/时间/状态 (确定性失败模拟: 电话尾号9 / 短信尾号8) */
  async notifyTrigger(
    id: string,
    dto: { recipients?: Array<{ name: string; dept?: string; phone?: string; channels?: NotifyChannelV2[] }> },
  ): Promise<CriticalNotificationV2[]> {
    const trigger = this.triggers.find((x) => x.id === id)
    if (!trigger) throw new NotFoundException(`危急值触发记录 ${id} 不存在`)
    const recipients = dto.recipients && dto.recipients.length > 0 ? dto.recipients : [{ name: '急诊值班医生', dept: '急诊科', phone: '13800000000' }]
    const created: CriticalNotificationV2[] = []
    for (const r of recipients) {
      const channels = r.channels && r.channels.length > 0 ? r.channels : (['phone', 'sms', 'message'] as NotifyChannelV2[])
      for (const channel of channels) {
        const failed = channel === 'phone' ? (r.phone ?? '').endsWith('9') : channel === 'sms' ? (r.phone ?? '').endsWith('8') : false
        const n: CriticalNotificationV2 = {
          id: `cvn-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 999)}`,
          triggerId: id,
          channel,
          recipientName: r.name,
          recipientDept: r.dept,
          recipientPhone: r.phone,
          content: `【危急值${CHANNEL_LABEL[channel]}】${trigger.patientName}(${trigger.ruleName}): ${trigger.description}。建议: ${trigger.suggestion}`,
          status: failed ? 'failed' : 'sent',
          sentAt: failed ? undefined : new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }
        this.notifications.unshift(n)
        created.push(n)
      }
    }
    if (created.some((n) => n.status === 'sent')) {
      trigger.status = 'notified'
      trigger.notifiedAt = new Date().toISOString()
    }
    await this.recordAudit('CV2_NOTIFY', id, { channels: created.map((c) => `${c.channel}:${c.status}`) })
    return created
  }

  listNotifications(triggerId?: string): CriticalNotificationV2[] {
    let list = [...this.notifications]
    if (triggerId) list = list.filter((n) => n.triggerId === triggerId)
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  /**
   * 确认流程: 接受/拒绝/备注。
   * 状态流转: sent → accepted|rejected (仅已发送可确认; failed 需重发; 不可重复确认)。
   */
  confirmNotification(
    id: string,
    dto: { decision: ConfirmDecisionV2; comment?: string; confirmedBy?: string },
  ): { notification: CriticalNotificationV2; trigger: CriticalTriggerV2 } {
    const n = this.notifications.find((x) => x.id === id)
    if (!n) throw new NotFoundException(`通知记录 ${id} 不存在`)
    if (n.status === 'accepted' || n.status === 'rejected') throw new BadRequestException(`通知已确认 (${n.status}), 不可重复操作`)
    if (n.status !== 'sent') throw new BadRequestException('仅已发送成功的通知可确认, 请重新发送')
    if (dto.decision !== 'accepted' && dto.decision !== 'rejected') throw new BadRequestException('确认决策必须为 accepted/rejected')
    n.status = dto.decision
    n.confirmedAt = new Date().toISOString()
    const trigger = this.triggers.find((x) => x.id === n.triggerId)
    if (!trigger) throw new NotFoundException(`危急值触发记录 ${n.triggerId} 不存在`)
    const createdAt = new Date(trigger.createdAt).getTime()
    const responseMinutes = Math.max(1, Math.round((Date.now() - createdAt) / 60000))
    trigger.status = dto.decision === 'accepted' ? 'confirmed' : 'rejected'
    trigger.confirmedBy = dto.confirmedBy ?? '当前用户'
    trigger.confirmedAt = new Date().toISOString()
    trigger.confirmDecision = dto.decision
    trigger.confirmComment = dto.comment?.trim()
    trigger.responseMinutes = responseMinutes
    void this.recordAudit('CV2_CONFIRM', id, { decision: dto.decision, triggerId: trigger.id, comment: dto.comment })
    return { notification: { ...n }, trigger: { ...trigger } }
  }

  resolveTrigger(id: string, comment?: string): CriticalTriggerV2 {
    const t = this.triggers.find((x) => x.id === id)
    if (!t) throw new NotFoundException(`危急值触发记录 ${id} 不存在`)
    t.status = 'resolved'
    t.confirmComment = comment?.trim() ?? t.confirmComment
    return { ...t }
  }

  // ================= 统计 =================

  stats(): CriticalStatsV2 {
    const total = this.triggers.length
    const confirmed = this.triggers.filter((t) => t.status === 'confirmed')
    const rejected = this.triggers.filter((t) => t.status === 'rejected')
    const byLevel: Record<CriticalLevelV2, number> = { critical: 0, urgent: 0, warning: 0 }
    for (const t of this.triggers) byLevel[t.level] = (byLevel[t.level] ?? 0) + 1
    // 超时: 已确认且响应超时, 或已通知未确认且超时
    const timeoutCount = this.triggers.filter((t) => {
      const rule = this.rules.find((r) => r.id === t.ruleId)
      const deadline = rule?.responseDeadlineMin ?? 30
      if (t.responseMinutes !== undefined && t.responseMinutes > deadline) return true
      if ((t.status === 'notified' || t.status === 'triggered') && Date.now() - new Date(t.createdAt).getTime() > deadline * 60000) return true
      return false
    }).length
    const onTimeConfirmed = confirmed.filter((t) => {
      const rule = this.rules.find((r) => r.id === t.ruleId)
      const deadline = rule?.responseDeadlineMin ?? 30
      return (t.responseMinutes ?? Infinity) <= deadline
    }).length
    const ruleCount = new Map<string, number>()
    for (const t of this.triggers) ruleCount.set(t.ruleId, (ruleCount.get(t.ruleId) ?? 0) + 1)
    const confirmedResponses = confirmed.filter((t) => t.responseMinutes !== undefined)
    const avgResponseMinutes = confirmedResponses.length
      ? Math.round(confirmedResponses.reduce((s, t) => s + (t.responseMinutes ?? 0), 0) / confirmedResponses.length)
      : 0
    return {
      totalEvaluations: this.evaluationCount + this.triggers.length,
      totalTriggers: total,
      triggerRate: Math.round((total / Math.max(1, this.evaluationCount + total)) * 1000) / 10,
      confirmedCount: confirmed.length,
      rejectedCount: rejected.length,
      onTimeConfirmRate: confirmed.length ? Math.round((onTimeConfirmed / confirmed.length) * 1000) / 10 : 0,
      timeoutCount,
      timeoutRate: total ? Math.round((timeoutCount / total) * 1000) / 10 : 0,
      avgResponseMinutes,
      byLevel: (Object.keys(byLevel) as CriticalLevelV2[]).map((level) => ({ level, count: byLevel[level] })),
      topRules: Array.from(ruleCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ruleId, count]) => {
          const r = this.rules.find((x) => x.id === ruleId)
          return { ruleId, ruleCode: r?.code ?? ruleId, ruleName: r?.name ?? ruleId, count }
        }),
    }
  }

  // ================= 内部 =================

  private matchesExamType(rule: CriticalRuleV2, examType: string): boolean {
    if (rule.examType === examType) return true
    if (examType.includes(rule.examType)) return true
    if (rule.examType.includes(examType)) return true
    return rule.modality ? examType.includes(rule.modality) : false
  }

  private matchSingleRule(
    rule: CriticalRuleV2,
    items: EvaluateItemV2[],
    description: string,
  ): { item?: string; value?: string; text: string } | null {
    // 数值型规则: 按项目 key/name 匹配
    if (rule.operator !== 'contains' && rule.operator !== 'notContains') {
      for (const item of items) {
        if (item.key !== rule.itemKey && (item.name ?? '') !== rule.item && !rule.item.includes(item.key) && !(item.name ?? '').includes(rule.item)) continue
        const num = Number(item.value)
        if (!Number.isFinite(num)) continue
        const ok = this.compareNum(num, rule.operator, rule.threshold ?? 0)
        if (!ok) continue
        const text = `${rule.item} ${num}${rule.unit ?? ''} ${rule.operator} ${rule.threshold}${rule.unit ?? ''} 阈值`
        return { item: rule.item, value: `${num}${rule.unit ?? ''}`, text }
      }
      return null
    }
    // 关键字规则: 项目字符串值 + 描述
    const keyword = rule.thresholdText ?? ''
    if (!keyword) return null
    for (const item of items) {
      if (typeof item.value === 'string' && item.value.includes(keyword)) {
        return { item: rule.item, value: item.value, text: `「${keyword}」关键字命中项目 ${rule.item}` }
      }
    }
    if (description.includes(keyword)) {
      return { item: rule.item, value: keyword, text: `描述含「${keyword}」关键字` }
    }
    return null
  }

  private compareNum(value: number, op: CompareOpV2, threshold: number): boolean {
    switch (op) {
      case '>': return value > threshold
      case '>=': return value >= threshold
      case '<': return value < threshold
      case '<=': return value <= threshold
      default: return false
    }
  }

  /** 联动 DB: 生成 criticalValue 记录 (DB 不可用时静默跳过, seed 回退) */
  private async persistCriticalValue(t: CriticalTriggerV2): Promise<void> {
    try {
      await this.prisma.criticalValue.create({
        data: {
          tenantId: currentTenantId(),
          patientId: t.patientId ?? null,
          examId: null,
          description: `[V2] ${t.ruleName}: ${t.matchedText}`,
          severity: (t.level === 'critical' ? 'CRITICAL' : t.level === 'urgent' ? 'URGENT' : 'HIGH') as never,
          state: 'FOUND',
          method: 'SYSTEM',
        } as never,
      })
    } catch (err) {
      this.logger.debug(`[CriticalV2] persist skipped: ${(err as Error).message}`)
    }
  }

  private async recordAudit(action: string, resourceId: string, detail: unknown): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { action, resource: 'critical-v2', resourceId, detail: detail as never, tenantId: currentTenantId() },
      })
    } catch {
      /* DB 不可用 → 仅内存 */
    }
  }
}
