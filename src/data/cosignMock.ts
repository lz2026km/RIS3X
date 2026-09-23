/**
 * G005 RIS v3.0.5.1 - Cosign 双签 Mock 数据
 * R3.REVIEW COSIGN(80 点)扩展:
 *  - 排班/急诊双签/多人签/签冲突/自动派主任/SLA 监控/历史/跳过配置/临时授权/批量签
 */
import type { Reviewer, CosignSchedule } from '../types/R3/R3.REVIEW';
import type {
  CosignRecord,
  EmergencyCosign,
  MultiSignConfig,
  SignConflict,
  SuperiorAssignRule,
  CosignSLAConfig,
  CosignSkipConfig,
  TemporaryAuth,
  BatchCosignRequest,
  CosignDashboardKPI,
  CosignCalendarEntry,
  CosignSLAMetric,
} from '../types/R3/R3.COSIGN';

const isoDaysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
const isoMinutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const isoMinutesFromNow = (m: number) => new Date(Date.now() + m * 60000).toISOString();
const isoDaysFromNow = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

export const COSIGN_CERTIFICATES = [
  { id: 'cert-001', holderId: 'D001', holderName: '张明远', certType: 'RSA-SHA256', issuer: 'CFCA', validFrom: '2024-01-01', validTo: '2027-01-01', serialNumber: 'CFCA-2024-0001', status: 'valid' },
  { id: 'cert-002', holderId: 'D006', holderName: '赵雪琴', certType: 'RSA-SHA256', issuer: 'CFCA', validFrom: '2024-03-01', validTo: '2027-03-01', serialNumber: 'CFCA-2024-0042', status: 'valid' },
  { id: 'cert-003', holderId: 'D009', holderName: '吴芳', certType: 'SM3-SM2', issuer: '国密CA', validFrom: '2025-06-01', validTo: '2028-06-01', serialNumber: 'GMCA-2025-0023', status: 'valid' },
  { id: 'cert-004', holderId: 'D002', holderName: '李慧敏', certType: 'RSA-SHA256', issuer: 'CFCA', validFrom: '2023-06-01', validTo: '2026-06-01', serialNumber: 'CFCA-2023-0156', status: 'expiring' },
  { id: 'cert-005', holderId: 'D007', holderName: '钱永康', certType: 'RSA-SHA256', issuer: 'CFCA', validFrom: '2025-01-01', validTo: '2028-01-01', serialNumber: 'CFCA-2025-0007', status: 'valid' },
];

export const COSIGN_INBOX: Array<{ id: string; reportId: string; patientName: string; modality: string; bodyPart: string; priority: string; submittedAt: string; authorName: string; reason: string; level: string; waitingHours: number }> = [
  { id: 'ci-001', reportId: 'RP20260613007', patientName: '谢军', modality: 'CT', bodyPart: '胸部', priority: 'routine', submittedAt: isoDaysAgo(1), authorName: '李慧敏', reason: 'special-study', level: 'cosign', waitingHours: 24 },
  { id: 'ci-002', reportId: 'RP20260613008', patientName: '邓丽华', modality: 'CT', bodyPart: '腹部', priority: 'routine', submittedAt: isoDaysAgo(1), authorName: '王建华', reason: 'special-study', level: 'cosign', waitingHours: 18 },
  { id: 'ci-003', reportId: 'RP20260608014', patientName: '余小红', modality: 'US', bodyPart: '腹部', priority: 'routine', submittedAt: isoDaysAgo(4), authorName: '王建华', reason: 'special-study', level: 'cosign', waitingHours: 76 },
  { id: 'ci-004', reportId: 'RP20260615001', patientName: '黄海涛', modality: 'CT', bodyPart: '胸部', priority: 'stat', submittedAt: isoDaysAgo(0), authorName: '李慧敏', reason: 'critical-finding', level: 'cosign', waitingHours: 2 },
  { id: 'ci-005', reportId: 'RP20260615002', patientName: '测试1', modality: 'CT', bodyPart: '头部', priority: 'routine', submittedAt: isoDaysAgo(0), authorName: '张明远', reason: 'special-study', level: 'cosign', waitingHours: 4 },
  { id: 'ci-006', reportId: 'RP20260614003', patientName: '测试2', modality: 'MR', bodyPart: '脊柱', priority: 'urgent', submittedAt: isoDaysAgo(1), authorName: '王建国', reason: 'critical-finding', level: 'cosign', waitingHours: 18 },
  { id: 'ci-007', reportId: 'RP20260614004', patientName: '测试3', modality: 'DR', bodyPart: '胸部', priority: 'routine', submittedAt: isoDaysAgo(1), authorName: '李梅', reason: 'special-study', level: 'cosign', waitingHours: 22 },
  { id: 'ci-008', reportId: 'RP20260613005', patientName: '测试4', modality: 'CT', bodyPart: '腹部', priority: 'urgent', submittedAt: isoDaysAgo(2), authorName: '陈丽', reason: 'critical-finding', level: 'cosign', waitingHours: 36 },
  { id: 'ci-009', reportId: 'RP20260612006', patientName: '测试5', modality: 'MR', bodyPart: '头部', priority: 'routine', submittedAt: isoDaysAgo(3), authorName: '李明远', reason: 'special-study', level: 'cosign', waitingHours: 48 },
  { id: 'ci-010', reportId: 'RP20260612007', patientName: '测试6', modality: 'CT', bodyPart: '胸部', priority: 'routine', submittedAt: isoDaysAgo(3), authorName: '张明远', reason: 'special-study', level: 'cosign', waitingHours: 50 },
];

export const COSIGN_REJECT_TEMPLATES = [
  { id: 'crt-001', title: '签字异议', body: '报告与本人诊断意见不一致' },
  { id: 'crt-002', title: '诊断存疑', body: '部分诊断依据不充分' },
  { id: 'crt-003', title: '需补充检查', body: '建议补充其他检查' },
  { id: 'crt-004', title: '治疗建议调整', body: '治疗建议需调整' },
  { id: 'crt-005', title: '危急值升级', body: '建议升级为危急值' },
  { id: 'crt-006', title: '其他', body: '其他需说明问题' },
];

export const COSIGN_TIMELINE = {
  cosignWindowHours: 24,
  remindIntervalMinutes: 30,
  maxRemindCount: 5,
  expireAction: 'escalate-to-director',
};

export const COSIGN_CALENDAR: CosignSchedule[] = [
  { id: 'cc-001', date: isoDaysFromNow(0), shiftType: 'morning', reviewerId: 'D001', reviewerName: '张明远', reviewerTitle: 'chief', maxCapacity: 8, reserved: 3, startTime: '08:00', endTime: '12:00', status: 'on-duty' },
  { id: 'cc-002', date: isoDaysFromNow(0), shiftType: 'afternoon', reviewerId: 'D001', reviewerName: '张明远', reviewerTitle: 'chief', maxCapacity: 6, reserved: 2, startTime: '14:00', endTime: '18:00', status: 'scheduled' },
  { id: 'cc-003', date: isoDaysFromNow(0), shiftType: 'morning', reviewerId: 'D006', reviewerName: '赵雪琴', reviewerTitle: 'chief', maxCapacity: 8, reserved: 4, startTime: '08:00', endTime: '12:00', status: 'on-duty' },
  { id: 'cc-004', date: isoDaysFromNow(0), shiftType: 'afternoon', reviewerId: 'D009', reviewerName: '吴芳', reviewerTitle: 'chief', maxCapacity: 6, reserved: 2, startTime: '14:00', endTime: '18:00', status: 'scheduled' },
  { id: 'cc-005', date: isoDaysFromNow(0), shiftType: 'evening', reviewerId: 'D009', reviewerName: '吴芳', reviewerTitle: 'chief', maxCapacity: 4, reserved: 1, startTime: '18:00', endTime: '22:00', status: 'scheduled' },
  { id: 'cc-006', date: isoDaysFromNow(0), shiftType: 'night', reviewerId: 'D010', reviewerName: '郑文', reviewerTitle: 'associateChief', maxCapacity: 3, reserved: 0, startTime: '22:00', endTime: '08:00', status: 'scheduled' },
  { id: 'cc-007', date: isoDaysFromNow(1), shiftType: 'morning', reviewerId: 'D001', reviewerName: '张明远', reviewerTitle: 'chief', maxCapacity: 8, reserved: 0, startTime: '08:00', endTime: '12:00', status: 'scheduled' },
  { id: 'cc-008', date: isoDaysFromNow(1), shiftType: 'morning', reviewerId: 'D006', reviewerName: '赵雪琴', reviewerTitle: 'chief', maxCapacity: 8, reserved: 0, startTime: '08:00', endTime: '12:00', status: 'scheduled' },
  { id: 'cc-009', date: isoDaysFromNow(1), shiftType: 'morning', reviewerId: 'D009', reviewerName: '吴芳', reviewerTitle: 'chief', maxCapacity: 6, reserved: 0, startTime: '08:00', endTime: '12:00', status: 'scheduled' },
  { id: 'cc-010', date: isoDaysFromNow(1), shiftType: 'afternoon', reviewerId: 'D002', reviewerName: '李慧敏', reviewerTitle: 'associateChief', maxCapacity: 5, reserved: 0, startTime: '14:00', endTime: '18:00', status: 'scheduled' },
  { id: 'cc-011', date: isoDaysFromNow(2), shiftType: 'morning', reviewerId: 'D001', reviewerName: '张明远', reviewerTitle: 'chief', maxCapacity: 8, reserved: 0, startTime: '08:00', endTime: '12:00', status: 'scheduled' },
  { id: 'cc-012', date: isoDaysFromNow(2), shiftType: 'morning', reviewerId: 'D006', reviewerName: '赵雪琴', reviewerTitle: 'chief', maxCapacity: 8, reserved: 0, startTime: '08:00', endTime: '12:00', status: 'scheduled' },
  { id: 'cc-013', date: isoDaysFromNow(3), shiftType: 'morning', reviewerId: 'D009', reviewerName: '吴芳', reviewerTitle: 'chief', maxCapacity: 6, reserved: 0, startTime: '08:00', endTime: '12:00', status: 'scheduled' },
  { id: 'cc-014', date: isoDaysFromNow(4), shiftType: 'morning', reviewerId: 'D001', reviewerName: '张明远', reviewerTitle: 'chief', maxCapacity: 8, reserved: 0, startTime: '08:00', endTime: '12:00', status: 'scheduled' },
  { id: 'cc-015', date: isoDaysFromNow(5), shiftType: 'morning', reviewerId: 'D006', reviewerName: '赵雪琴', reviewerTitle: 'chief', maxCapacity: 8, reserved: 0, startTime: '08:00', endTime: '12:00', status: 'scheduled' },
  { id: 'cc-016', date: isoDaysFromNow(6), shiftType: 'morning', reviewerId: 'D009', reviewerName: '吴芳', reviewerTitle: 'chief', maxCapacity: 6, reserved: 0, startTime: '08:00', endTime: '12:00', status: 'scheduled' },
  { id: 'cc-017', date: isoDaysFromNow(7), shiftType: 'morning', reviewerId: 'D001', reviewerName: '张明远', reviewerTitle: 'chief', maxCapacity: 8, reserved: 0, startTime: '08:00', endTime: '12:00', status: 'scheduled' },
];

export const COSIGN_AUDIT_LOG = [
  { id: 'cal-001', reportId: 'RP20260615001', action: 'start-cosign', actor: 'system', actorId: 'sys', timestamp: isoDaysAgo(0), hash: 'cal001', detail: '触发双签：危急值' },
  { id: 'cal-002', reportId: 'RP20260613007', action: 'complete-cosign', actor: '张明远', actorId: 'D001', timestamp: isoDaysAgo(1), hash: 'cal002', detail: '完成双签，签名值：mock-sig-001' },
  { id: 'cal-003', reportId: 'RP20260613008', action: 'cosign-reject', actor: '赵雪琴', actorId: 'D006', timestamp: isoDaysAgo(1), hash: 'cal003', detail: '拒绝双签，原因：需补充意见' },
];

export const COSIGN_KPI = {
  totalThisMonth: 18,
  pendingCount: 4,
  completedCount: 12,
  rejectedCount: 2,
  avgResponseMinutes: 35,
  p95ResponseMinutes: 120,
  onTimeRate: 88.0,
  reminderSentCount: 8,
  escalateCount: 1,
  certificateValidCount: 4,
  certificateExpiringCount: 1,
};

// ============ v3.0.5.1 R3.REVIEW COSIGN 扩展 ============

export const COSIGN_RECORDS: CosignRecord[] = [
  {
    id: 'cr-001',
    reportId: 'RP20260615001',
    taskId: 'tk-001',
    patientName: '黄海涛',
    modality: 'CT',
    bodyPart: '胸部',
    triggerReason: 'critical-finding',
    priority: 'stat',
    status: 'in-progress',
    authorId: 'D003',
    authorName: '李慧敏',
    authorTitle: 'attending',
    cosignerId: 'D001',
    cosignerName: '张明远',
    cosignerTitle: 'chief',
    certificateId: 'cert-001',
    certificateSerial: 'CFCA-2024-0001',
    scheduledAt: isoMinutesAgo(120),
    startedAt: isoMinutesAgo(118),
    slaMinutes: 15,
    elapsedMinutes: 118,
    remainMinutes: -103,
    history: [
      { id: 'h-001', step: 'trigger', actorId: 'sys', actorName: 'system', action: '触发双签', detail: '危急值自动触发', timestamp: isoMinutesAgo(120) },
      { id: 'h-002', step: 'assign', actorId: 'sys', actorName: 'system', action: '分配主任', detail: '张明远(主任)', timestamp: isoMinutesAgo(120) },
      { id: 'h-003', step: 'notify', actorId: 'sys', actorName: 'system', action: '通知', detail: 'SMS+APP', timestamp: isoMinutesAgo(120) },
      { id: 'h-004', step: 'start', actorId: 'D001', actorName: '张明远', action: '开始签', timestamp: isoMinutesAgo(118) },
    ],
  },
  {
    id: 'cr-002',
    reportId: 'RP20260613007',
    taskId: 'tk-002',
    patientName: '谢军',
    modality: 'CT',
    bodyPart: '胸部',
    triggerReason: 'special-study',
    priority: 'routine',
    status: 'signed',
    authorId: 'D002',
    authorName: '李慧敏',
    authorTitle: 'attending',
    cosignerId: 'D001',
    cosignerName: '张明远',
    cosignerTitle: 'chief',
    certificateId: 'cert-001',
    certificateSerial: 'CFCA-2024-0001',
    scheduledAt: isoDaysAgo(1),
    startedAt: isoMinutesAgo(60 * 22),
    signedAt: isoMinutesAgo(60 * 21),
    slaMinutes: 240,
    elapsedMinutes: 60,
    remainMinutes: 180,
    signatureValue: 'mock-sig-001',
    history: [
      { id: 'h-101', step: 'trigger', actorId: 'sys', actorName: 'system', action: '触发双签', detail: '特殊检查', timestamp: isoDaysAgo(1) },
      { id: 'h-102', step: 'assign', actorId: 'sys', actorName: 'system', action: '分配', detail: '张明远', timestamp: isoDaysAgo(1) },
      { id: 'h-103', step: 'start', actorId: 'D001', actorName: '张明远', action: '开始签', timestamp: isoMinutesAgo(60 * 22) },
      { id: 'h-104', step: 'sign', actorId: 'D001', actorName: '张明远', action: '完成签', timestamp: isoMinutesAgo(60 * 21), hash: 'sig-h-104' },
    ],
  },
  {
    id: 'cr-003',
    reportId: 'RP20260613008',
    taskId: 'tk-003',
    patientName: '邓丽华',
    modality: 'CT',
    bodyPart: '腹部',
    triggerReason: 'special-study',
    priority: 'routine',
    status: 'rejected',
    authorId: 'D004',
    authorName: '王建华',
    authorTitle: 'attending',
    cosignerId: 'D006',
    cosignerName: '赵雪琴',
    cosignerTitle: 'chief',
    certificateId: 'cert-002',
    certificateSerial: 'CFCA-2024-0042',
    scheduledAt: isoDaysAgo(1),
    startedAt: isoMinutesAgo(60 * 20),
    signedAt: isoMinutesAgo(60 * 19),
    slaMinutes: 240,
    elapsedMinutes: 60,
    remainMinutes: 180,
    rejectReason: '诊断依据不充分,需补充意见',
    history: [
      { id: 'h-201', step: 'trigger', actorId: 'sys', actorName: 'system', action: '触发双签', timestamp: isoDaysAgo(1) },
      { id: 'h-202', step: 'reject', actorId: 'D006', actorName: '赵雪琴', action: '拒绝', detail: '诊断存疑', timestamp: isoMinutesAgo(60 * 19) },
    ],
  },
  {
    id: 'cr-004',
    reportId: 'RP20260608014',
    taskId: 'tk-004',
    patientName: '余小红',
    modality: 'US',
    bodyPart: '腹部',
    triggerReason: 'special-study',
    priority: 'urgent',
    status: 'pending',
    authorId: 'D004',
    authorName: '王建华',
    authorTitle: 'attending',
    cosignerId: 'D009',
    cosignerName: '吴芳',
    cosignerTitle: 'chief',
    certificateId: 'cert-003',
    certificateSerial: 'GMCA-2025-0023',
    scheduledAt: isoDaysAgo(4),
    slaMinutes: 60,
    elapsedMinutes: 5760,
    remainMinutes: -5700,
    history: [
      { id: 'h-301', step: 'trigger', actorId: 'sys', actorName: 'system', action: '触发双签', timestamp: isoDaysAgo(4) },
      { id: 'h-302', step: 'remind', actorId: 'sys', actorName: 'system', action: '提醒', detail: '第5次', timestamp: isoMinutesAgo(120) },
    ],
  },
  {
    id: 'cr-005',
    reportId: 'RP20260615008',
    taskId: 'tk-005',
    patientName: '张子涵',
    modality: 'MR',
    bodyPart: '头颅',
    triggerReason: 'quality-flag',
    priority: 'urgent',
    status: 'scheduled',
    authorId: 'D005',
    authorName: '钱永康',
    authorTitle: 'associateChief',
    cosignerId: 'D002',
    cosignerName: '李慧敏',
    cosignerTitle: 'associateChief',
    certificateId: 'cert-004',
    certificateSerial: 'CFCA-2023-0156',
    scheduledAt: isoMinutesFromNow(30),
    slaMinutes: 60,
    elapsedMinutes: 0,
    remainMinutes: 60,
    history: [
      { id: 'h-401', step: 'trigger', actorId: 'sys', actorName: 'system', action: '质量告警触发', timestamp: isoMinutesAgo(5) },
      { id: 'h-402', step: 'schedule', actorId: 'sys', actorName: 'system', action: '排班', detail: '李慧敏', timestamp: isoMinutesAgo(5) },
    ],
  },
];

export const COSIGN_EMERGENCY: EmergencyCosign[] = [
  {
    id: 'em-001',
    recordId: 'cr-001',
    reportId: 'RP20260615001',
    patientName: '黄海涛',
    modality: 'CT',
    bodyPart: '胸部',
    criticalLevel: 'critical',
    triggeredAt: isoMinutesAgo(120),
    requiredResponseSeconds: 60,
    smsSent: true,
    emailSent: true,
    phoneCalled: false,
    appPushed: true,
    firstResponseAt: isoMinutesAgo(118),
    firstResponseBy: '张明远',
    responseSeconds: 120,
    resolvedBy: 'signed',
  },
  {
    id: 'em-002',
    recordId: 'cr-006',
    reportId: 'RP20260615006',
    patientName: '陈昊',
    modality: 'CT',
    bodyPart: '头颅',
    criticalLevel: 'critical',
    triggeredAt: isoMinutesAgo(3),
    requiredResponseSeconds: 60,
    smsSent: true,
    emailSent: true,
    phoneCalled: true,
    appPushed: true,
  },
  {
    id: 'em-003',
    recordId: 'cr-101',
    reportId: 'RP20260615003',
    patientName: '测试1',
    modality: 'CT',
    bodyPart: '头部',
    criticalLevel: 'critical',
    triggeredAt: isoDaysAgo(0),
    requiredResponseSeconds: 600,
    smsSent: true,
    emailSent: true,
    phoneCalled: true,
    appPushed: true,
  },
  {
    id: 'em-004',
    recordId: 'cr-102',
    reportId: 'RP20260615004',
    patientName: '测试2',
    modality: 'MR',
    bodyPart: '脊柱',
    criticalLevel: 'critical',
    triggeredAt: isoDaysAgo(0),
    requiredResponseSeconds: 900,
    smsSent: true,
    emailSent: true,
    phoneCalled: false,
    appPushed: true,
  },
  {
    id: 'em-005',
    recordId: 'cr-103',
    reportId: 'RP20260614005',
    patientName: '测试3',
    modality: 'CT',
    bodyPart: '胸部',
    criticalLevel: 'critical',
    triggeredAt: isoDaysAgo(1),
    requiredResponseSeconds: 1200,
    smsSent: true,
    emailSent: true,
    phoneCalled: true,
    appPushed: true,
  },
];

export const COSIGN_MULTI_SIGN: MultiSignConfig[] = [
  {
    id: 'ms-001',
    reportId: 'RP20260615002',
    requiredSignerCount: 3,
    signers: [
      { order: 1, signerId: 'D001', signerName: '张明远', signerTitle: 'chief', required: true, signed: true, signedAt: isoMinutesAgo(60), certificateId: 'cert-001', notifyChannel: ['app', 'sms'] },
      { order: 2, signerId: 'D006', signerName: '赵雪琴', signerTitle: 'chief', required: true, signed: true, signedAt: isoMinutesAgo(45), certificateId: 'cert-002', notifyChannel: ['app'] },
      { order: 3, signerId: 'D009', signerName: '吴芳', signerTitle: 'chief', required: true, signed: false, notifyChannel: ['app', 'sms', 'email'] },
    ],
    currentSignedCount: 2,
    status: 'partial',
    parallelAllowed: false,
    windowHours: 24,
    startedAt: isoMinutesAgo(60),
  },
];

export const COSIGN_CONFLICTS: SignConflict[] = [
  {
    id: 'cf-001',
    reportId: 'RP20260613005',
    recordId: 'cr-prev-001',
    conflictType: 'duplicate-signature',
    detectedAt: isoMinutesAgo(45),
    detectedBy: 'system',
    parties: [
      { partyId: 'D001', partyName: '张明远', partyTitle: 'chief', role: 'cosigner', involved: true },
      { partyId: 'D001', partyName: '张明远', partyTitle: 'chief', role: 'cosigner', involved: true, statement: '系统重复触发' },
    ],
    description: '同一主任在 5 分钟内被分配两次,疑似重复触发',
    resolution: 'reassign-cosigner',
    resolvedAt: isoMinutesAgo(30),
    resolvedById: 'sys',
    resolvedByName: '系统自动',
    status: 'resolved',
  },
  {
    id: 'cf-002',
    reportId: 'RP20260614003',
    recordId: 'cr-prev-002',
    conflictType: 'expired-cert',
    detectedAt: isoMinutesAgo(20),
    detectedBy: 'audit-scan',
    parties: [
      { partyId: 'D002', partyName: '李慧敏', partyTitle: 'associateChief', role: 'cosigner', involved: true },
    ],
    description: '李慧敏证书将于 7 天内到期,需更新',
    status: 'open',
  },
  {
    id: 'cf-003',
    reportId: 'RP20260612008',
    recordId: 'cr-prev-003',
    conflictType: 'overlapping-cosigner',
    detectedAt: isoMinutesAgo(10),
    detectedBy: 'manual',
    parties: [
      { partyId: 'D006', partyName: '赵雪琴', partyTitle: 'chief', role: 'cosigner', involved: true },
      { partyId: 'D009', partyName: '吴芳', partyTitle: 'chief', role: 'cosigner', involved: true },
    ],
    description: '两位主任被分配到同一报告,需选择其一',
    status: 'investigating',
  },
];

export const COSIGN_SUPERIOR_RULES: SuperiorAssignRule[] = [
  {
    id: 'sar-001',
    name: '危急值优先',
    enabled: true,
    scope: { priorities: ['stat'], modalities: ['CT', 'MR'] },
    criteria: {
      minTitle: 'chief',
      excludeSamePerson: true,
      excludeRecentAuthors: true,
      preferOnline: true,
      preferLowestWorkload: true,
      requireValidCert: true,
    },
    fallbackStrategy: 'dean',
    notifyChannels: ['app', 'sms'],
    createdAt: '2026-01-15',
    updatedAt: '2026-06-10',
  },
  {
    id: 'sar-002',
    name: '常规轮询',
    enabled: true,
    scope: { priorities: ['routine'] },
    criteria: {
      minTitle: 'associateChief',
      excludeSamePerson: true,
      excludeRecentAuthors: false,
      preferOnline: true,
      preferLowestWorkload: false,
      requireValidCert: true,
    },
    fallbackStrategy: 'round-robin',
    notifyChannels: ['app'],
    createdAt: '2026-02-01',
    updatedAt: '2026-05-20',
  },
  {
    id: 'sar-003',
    name: '特殊检查直派主任',
    enabled: true,
    scope: { modalities: ['CT', 'MR'], bodyParts: ['胸部', '头颅'] },
    criteria: {
      minTitle: 'chief',
      excludeSamePerson: true,
      excludeRecentAuthors: true,
      preferOnline: true,
      preferLowestWorkload: true,
      requireValidCert: true,
    },
    fallbackStrategy: 'next-rank',
    notifyChannels: ['app', 'sms', 'email'],
    createdAt: '2026-03-10',
    updatedAt: '2026-06-15',
  },
];

export const COSIGN_SLA_CONFIG: CosignSLAConfig = {
  id: 'sla-cosign-001',
  stage: 'cosign',
  defaultMinutes: 240,
  byPriority: { stat: 15, urgent: 60, routine: 240, scheduled: 1440 },
  byModality: { CT: 60, MR: 90, US: 30, MG: 30, XR: 30, NM: 60 },
  byReason: {
    'critical-finding': 15,
    'stat-emergency': 15,
    'special-study': 240,
    'director-required': 60,
    'quality-flag': 120,
    'manual-escalation': 60,
    'rectify-after-reject': 240,
  },
  warnMinutes: 30,
  breachAction: 'escalate',
  remindIntervalMinutes: 10,
  maxRemindCount: 5,
  escalateToRole: 'director',
  updatedAt: '2026-06-15',
  updatedBy: 'admin',
};

export const COSIGN_SLA_METRICS: CosignSLAMetric[] = [
  { recordId: 'cr-001', reportId: 'RP20260615001', cosignerId: 'D001', cosignerName: '张明远', triggerReason: 'critical-finding', priority: 'stat', slaMinutes: 15, elapsedMinutes: 118, status: 'breached', breachByMinutes: 103, remainingMinutes: -103, reminderSentCount: 5, lastReminderAt: isoMinutesAgo(10) },
  { recordId: 'cr-004', reportId: 'RP20260608014', cosignerId: 'D009', cosignerName: '吴芳', triggerReason: 'special-study', priority: 'urgent', slaMinutes: 60, elapsedMinutes: 5760, status: 'breached', breachByMinutes: 5700, remainingMinutes: -5700, reminderSentCount: 5, lastReminderAt: isoMinutesAgo(60) },
  { recordId: 'cr-005', reportId: 'RP20260615008', cosignerId: 'D002', cosignerName: '李慧敏', triggerReason: 'quality-flag', priority: 'urgent', slaMinutes: 60, elapsedMinutes: 5, status: 'on-track', breachByMinutes: 0, remainingMinutes: 55 },
  { recordId: 'cr-002', reportId: 'RP20260613007', cosignerId: 'D001', cosignerName: '张明远', triggerReason: 'special-study', priority: 'routine', slaMinutes: 240, elapsedMinutes: 60, status: 'on-track', breachByMinutes: 0, remainingMinutes: 180 },
];

export const COSIGN_SKIP_CONFIG: CosignSkipConfig = {
  id: 'skip-001',
  enabled: true,
  conditions: [
    { id: 'sc-001', reason: 'chief-signed-by-resident', description: '住院代签(教学)', enabled: true, matchRules: { authorTitle: ['resident'], priority: ['routine'] }, requiresComment: true },
    { id: 'sc-002', reason: 'verified-by-ai', description: 'AI 已验证', enabled: true, matchRules: { minQualityScore: 95 }, requiresComment: false },
    { id: 'sc-003', reason: 'training-case', description: '教学案例', enabled: true, matchRules: { modality: ['XR', 'US'] }, requiresComment: true },
    { id: 'sc-004', reason: 'legacy-migration', description: '历史迁移', enabled: true, matchRules: { priority: ['routine'] }, requiresComment: true },
    { id: 'sc-005', reason: 'director-authorized', description: '主任特批', enabled: true, matchRules: {}, requiresComment: true },
  ],
  requiresAuthorization: true,
  authorizedRoles: ['director'],
  auditLevel: 'enhanced',
  updatedAt: '2026-06-12',
  updatedBy: 'admin',
};

export const COSIGN_TEMP_AUTHS: TemporaryAuth[] = [
  {
    id: 'ta-001',
    granteeId: 'D002',
    granteeName: '李慧敏',
    granteeTitle: 'associateChief',
    granterId: 'D001',
    granterName: '张明远',
    scope: 'modality-cosign',
    scopeDetail: { modality: 'CT', startAt: isoMinutesAgo(30), endAt: isoMinutesFromNow(120) },
    reason: '张主任出差,代签 CT 类',
    status: 'active',
    usedCount: 4,
    createdAt: isoMinutesAgo(30),
  },
  {
    id: 'ta-002',
    granteeId: 'D009',
    granteeName: '吴芳',
    granteeTitle: 'chief',
    granterId: 'D007',
    granterName: '钱永康',
    scope: 'department-cosign',
    scopeDetail: { departmentId: 'DEPT-CT', startAt: isoDaysAgo(1), endAt: isoMinutesFromNow(60 * 24 * 2) },
    reason: '急诊双签代班',
    status: 'active',
    usedCount: 12,
    createdAt: isoDaysAgo(1),
  },
  {
    id: 'ta-003',
    granteeId: 'D006',
    granteeName: '赵雪琴',
    granteeTitle: 'chief',
    granterId: 'D001',
    granterName: '张明远',
    scope: 'shift-window',
    scopeDetail: { startAt: isoDaysAgo(2), endAt: isoDaysAgo(1) },
    reason: '夜间班代签',
    status: 'expired',
    usedCount: 3,
    createdAt: isoDaysAgo(2),
    revokedAt: isoDaysAgo(1),
    revokedBy: 'sys',
    revokeReason: '授权到期',
  },
];

export const COSIGN_BATCH_REQUESTS: BatchCosignRequest[] = [
  {
    id: 'bc-001',
    reportIds: ['RP20260612001', 'RP20260612002', 'RP20260612003', 'RP20260612004'],
    cosignerId: 'D001',
    cosignerName: '张明远',
    decision: 'approve',
    comment: '批量通过',
    requireCertCheck: true,
    startedAt: isoMinutesAgo(15),
    completedAt: isoMinutesAgo(10),
    totalCount: 4,
    successCount: 4,
    failCount: 0,
    skipCount: 0,
    results: [
      { recordId: 'cr-b01', reportId: 'RP20260612001', status: 'approved', signedAt: isoMinutesAgo(14), signatureValue: 'mock-batch-sig-001' },
      { recordId: 'cr-b02', reportId: 'RP20260612002', status: 'approved', signedAt: isoMinutesAgo(13), signatureValue: 'mock-batch-sig-002' },
      { recordId: 'cr-b03', reportId: 'RP20260612003', status: 'approved', signedAt: isoMinutesAgo(12), signatureValue: 'mock-batch-sig-003' },
      { recordId: 'cr-b04', reportId: 'RP20260612004', status: 'approved', signedAt: isoMinutesAgo(11), signatureValue: 'mock-batch-sig-004' },
    ],
  },
  {
    id: 'bc-002',
    reportIds: ['RP20260613001', 'RP20260613002'],
    cosignerId: 'D006',
    cosignerName: '赵雪琴',
    decision: 'approve',
    requireCertCheck: false,
    startedAt: isoMinutesAgo(60),
    totalCount: 2,
    successCount: 0,
    failCount: 0,
    skipCount: 2,
    results: [
      { recordId: 'cr-b05', reportId: 'RP20260613001', status: 'skipped', reason: '证书无效' },
      { recordId: 'cr-b06', reportId: 'RP20260613002', status: 'skipped', reason: '证书无效' },
    ],
  },
];

export const COSIGN_DASHBOARD_KPI: CosignDashboardKPI = {
  totalScheduled: 17,
  totalTriggered: 18,
  totalSigned: 12,
  totalRejected: 2,
  totalExpired: 1,
  totalSkipped: 3,
  avgResponseMinutes: 35,
  p95ResponseMinutes: 120,
  onTimeRate: 88.0,
  conflictCount: 3,
  conflictResolvedCount: 1,
  tempAuthActive: 2,
  batchCount: 2,
  byReason: {
    'critical-finding': 4,
    'stat-emergency': 2,
    'special-study': 7,
    'director-required': 3,
    'quality-flag': 1,
    'manual-escalation': 1,
    'rectify-after-reject': 0,
  },
  byPriority: { stat: 4, urgent: 3, routine: 9, scheduled: 2 },
  byCosigner: [
    { cosignerId: 'D001', cosignerName: '张明远', count: 8, avgMinutes: 28 },
    { cosignerId: 'D006', cosignerName: '赵雪琴', count: 5, avgMinutes: 45 },
    { cosignerId: 'D009', cosignerName: '吴芳', count: 3, avgMinutes: 60 },
    { cosignerId: 'D002', cosignerName: '李慧敏', count: 2, avgMinutes: 20 },
  ],
};

export const COSIGN_CALENDAR_V2: CosignCalendarEntry[] = COSIGN_CALENDAR.map((s) => ({
  id: s.id,
  date: s.date,
  shiftType: s.shiftType,
  reviewerId: s.reviewerId,
  reviewerName: s.reviewerName,
  reviewerTitle: s.reviewerTitle,
  startTime: s.startTime,
  endTime: s.endTime,
  maxCapacity: s.maxCapacity,
  reserved: s.reserved,
  status: s.status,
  specialties: s.reviewerTitle === 'chief' ? ['胸部', '腹部'] : ['超声'],
}));

export const COSIGN_REVIEWERS: Reviewer[] = [
  { id: 'D001', name: '张明远', title: 'chief', titleLabel: '主任医师', department: '放射科', status: 'online', currentLoad: 8, maxLoad: 15, pendingCount: 3, inProgressCount: 2, completedToday: 5, avgReviewMinutes: 25, onTimeRate: 0.95, rejectionRate: 0.05, specialty: ['胸部CT', '腹部CT'] },
  { id: 'D006', name: '赵雪琴', title: 'chief', titleLabel: '主任医师', department: '放射科', status: 'online', currentLoad: 6, maxLoad: 15, pendingCount: 2, inProgressCount: 1, completedToday: 4, avgReviewMinutes: 30, onTimeRate: 0.92, rejectionRate: 0.06, specialty: ['MRI', '头颅'] },
  { id: 'D009', name: '吴芳', title: 'chief', titleLabel: '主任医师', department: '放射科', status: 'busy', currentLoad: 10, maxLoad: 15, pendingCount: 4, inProgressCount: 3, completedToday: 3, avgReviewMinutes: 40, onTimeRate: 0.85, rejectionRate: 0.08, specialty: ['超声', '妇产'] },
  { id: 'D002', name: '李慧敏', title: 'associateChief', titleLabel: '副主任医师', department: '放射科', status: 'online', currentLoad: 4, maxLoad: 12, pendingCount: 1, inProgressCount: 1, completedToday: 6, avgReviewMinutes: 22, onTimeRate: 0.93, rejectionRate: 0.04, specialty: ['CT'] },
  { id: 'D007', name: '钱永康', title: 'chief', titleLabel: '主任医师', department: '放射科', status: 'away', currentLoad: 5, maxLoad: 15, pendingCount: 2, inProgressCount: 0, completedToday: 2, avgReviewMinutes: 28, onTimeRate: 0.90, rejectionRate: 0.05, specialty: ['心血管CT'] },
];

export default {
  COSIGN_CERTIFICATES,
  COSIGN_INBOX,
  COSIGN_REJECT_TEMPLATES,
  COSIGN_TIMELINE,
  COSIGN_CALENDAR,
  COSIGN_AUDIT_LOG,
  COSIGN_KPI,
  COSIGN_RECORDS,
  COSIGN_EMERGENCY,
  COSIGN_MULTI_SIGN,
  COSIGN_CONFLICTS,
  COSIGN_SUPERIOR_RULES,
  COSIGN_SLA_CONFIG,
  COSIGN_SLA_METRICS,
  COSIGN_SKIP_CONFIG,
  COSIGN_TEMP_AUTHS,
  COSIGN_BATCH_REQUESTS,
  COSIGN_DASHBOARD_KPI,
  COSIGN_CALENDAR_V2,
  COSIGN_REVIEWERS,
};

// [v3.0.6.8-27] 三甲级双签数据扩充
// 收件箱 10→80, 排班 17→120, 证书 5→50, 审计 3→30, SLA 4→30
import { DOCTOR_MASTER } from './master/doctorMasterMock';
import { PATIENT_MASTER } from './master/patientMasterMock';

// 简化的 seed 工具 (let 必须在函数前声明, 避免 TDZ)
let _genSeed = 0xC0519;
function _rand(): number { _genSeed = (_genSeed * 1103515245 + 12345) & 0x7fffffff; return _genSeed / 0x7fffffff; }
function _randInt(min: number, max: number): number { return Math.floor(_rand() * (max - min + 1)) + min; }
function _pick<T>(arr: T[]): T { return arr[Math.floor(_rand() * arr.length)]!; }

// 扩充 COSIGN_INBOX 10→80
const _EXTRA_INBOX = Array.from({ length: 70 }, (_, i) => {
  const p = _pick(PATIENT_MASTER);
  const doc = _pick(DOCTOR_MASTER.filter((d) => d.title === '住院医师' || d.title === '主治医师'));
  const csigner = _pick(DOCTOR_MASTER.filter((d) => d.title === '副主任医师' || d.title === '主任医师'));
  const dayAgo = _randInt(0, 7);
  const priority = p.priority;
  const sla = priority === '急诊' ? 30 : priority === '加急' ? 60 : 240;
  const submittedAt = new Date(Date.now() - dayAgo * 86400000 - _randInt(0, 18) * 3600000).toISOString();
  const elapsed = Math.floor((Date.now() - new Date(submittedAt).getTime()) / 60000);
  const overdue = elapsed > sla;
  return {
    id: `csign-gen-${String(i + 1).padStart(4, '0')}`,
    reportId: `rpt-gen-${_randInt(100000, 999999)}`,
    patientId: p.id,
    patientName: p.name,
    modality: p.modality,
    bodyPart: p.bodyPart,
    priority: priority as '急诊' | '加急' | '普通' | '体检',
    trigger: _pick(['junior_author', 'critical_value', 'special_exam', 'vip_patient', 'complex_case']) as 'junior_author' | 'critical_value' | 'special_exam' | 'vip_patient' | 'complex_case',
    submitterId: doc.id,
    submitterName: doc.name,
    reviewerId: csigner.id,
    reviewerName: csigner.name,
    submittedAt,
    deadline: new Date(new Date(submittedAt).getTime() + sla * 60000).toISOString(),
    sla,
    status: overdue ? _pick(['pending', 'reminded']) as 'pending' | 'reminded' : 'pending' as 'pending',
    overdue,
    elapsedMin: elapsed,
    reminderCount: _randInt(0, 3),
    complexity: _pick(['low', 'medium', 'high', 'critical']) as 'low' | 'medium' | 'high' | 'critical',
  };
});
export const COSIGN_INBOX_FULL = [...COSIGN_INBOX, ..._EXTRA_INBOX];

// 扩充 COSIGN_CALENDAR 17→120 (30 天 × 4 班)
const _EXTRA_CALENDAR = Array.from({ length: 103 }, (_, i) => {
  const reviewer = _pick(DOCTOR_MASTER.filter((d) => d.title === '副主任医师' || d.title === '主任医师'));
  const day = i % 30;
  const shift = ['morning', 'afternoon', 'evening', 'night'][i % 4]!;
  const date = new Date(Date.now() - day * 86400000);
  return {
    id: `cal-gen-${String(i + 1).padStart(4, '0')}`,
    reviewerId: reviewer.id,
    reviewerName: reviewer.name,
    date: date.toISOString().split('T')[0]!,
    shift: shift as 'morning' | 'afternoon' | 'evening' | 'night',
    shiftLabel: { morning: '上午', afternoon: '下午', evening: '傍晚', night: '夜班' }[shift]!,
    startTime: { morning: '08:00', afternoon: '14:00', evening: '18:00', night: '22:00' }[shift]!,
    endTime: { morning: '12:00', afternoon: '18:00', evening: '22:00', night: '08:00' }[shift]!,
    expectedCount: _randInt(8, 25),
    completedCount: _randInt(0, 25),
    status: _pick(['scheduled', 'in_progress', 'completed', 'cancelled']) as 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
    substituteReviewerId: _rand() < 0.1 ? _pick(DOCTOR_MASTER).id : null,
  };
});
export const COSIGN_CALENDAR_FULL = [...COSIGN_CALENDAR, ..._EXTRA_CALENDAR];

// 扩充 COSIGN_CERTIFICATES 5→50
const _EXTRA_CERTS = Array.from({ length: 45 }, (_, i) => {
  const doc = DOCTOR_MASTER[4 + i % 71]!;
  const year = 2020 + _randInt(0, 6);
  return {
    id: `cert-gen-${String(i + 1).padStart(3, '0')}`,
    doctorId: doc.id,
    doctorName: doc.name,
    certificateNo: `CFCA-${_randInt(100000, 999999).toString(36).toUpperCase()}-${year}`,
    issuer: _pick(['CFCA', '国密CA', '上海CA', '北京CA']) as 'CFCA' | '国密CA' | '上海CA' | '北京CA',
    issueDate: `${year}-${String(_randInt(1, 12)).padStart(2, '0')}-${String(_randInt(1, 28)).padStart(2, '0')}`,
    expiryDate: `${year + 5}-${String(_randInt(1, 12)).padStart(2, '0')}-${String(_randInt(1, 28)).padStart(2, '0')}`,
    status: _pick(['active', 'active', 'active', 'expiring_soon', 'expired']) as 'active' | 'expiring_soon' | 'expired',
    usageCount: _randInt(0, 800),
    lastUsedAt: new Date(Date.now() - _randInt(0, 30) * 86400000).toISOString(),
  };
});
export const COSIGN_CERTIFICATES_FULL = [...COSIGN_CERTIFICATES, ..._EXTRA_CERTS];

// 扩充 COSIGN_AUDIT_LOG 3→30
const _EXTRA_AUDIT = Array.from({ length: 27 }, (_, i) => {
  const doc = _pick(DOCTOR_MASTER);
  return {
    id: `audit-gen-${String(i + 1).padStart(3, '0')}`,
    action: _pick(['sign', 'reject', 'request', 'remind', 'transfer', 'approve']) as 'sign' | 'reject' | 'request' | 'remind' | 'transfer' | 'approve',
    operatorId: doc.id,
    operatorName: doc.name,
    targetId: `rpt-gen-${_randInt(100000, 999999)}`,
    targetType: 'report' as const,
    timestamp: new Date(Date.now() - _randInt(0, 30) * 86400000 - _randInt(0, 23) * 3600000).toISOString(),
    ipAddress: `192.168.1.${_randInt(1, 255)}`,
    geoLocation: '汉东省人民医院',
    blockchainTx: `0x${_randInt(0, 0xFFFFFFFF).toString(16)}${_randInt(0, 0xFFFFFFFF).toString(16)}`,
  };
});
export const COSIGN_AUDIT_LOG_FULL = [...COSIGN_AUDIT_LOG, ..._EXTRA_AUDIT];

// 扩充 COSIGN_SLA_METRICS 4→30 (按 reviewer)
const _EXTRA_SLA = Array.from({ length: 26 }, (_, i) => {
  const doc = _pick(DOCTOR_MASTER);
  return {
    id: `sla-gen-${String(i + 1).padStart(3, '0')}`,
    reviewerId: doc.id,
    reviewerName: doc.name,
    period: '2026-06',
    totalReceived: _randInt(50, 300),
    totalSigned: _randInt(40, 280),
    totalRejected: _randInt(1, 15),
    onTimeCount: _randInt(40, 270),
    overdueCount: _randInt(0, 20),
    avgSignTime: _randInt(15, 180),
    p95SignTime: _randInt(60, 240),
    onTimeRate: _randInt(85, 99),
  };
});
export const COSIGN_SLA_METRICS_FULL = [...COSIGN_SLA_METRICS, ..._EXTRA_SLA];