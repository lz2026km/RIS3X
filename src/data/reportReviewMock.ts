/**
 * G005 RIS v3.0.5.1 - R3.REVIEW Mock 数据
 */
import type {
  ReviewTask,
  Reviewer,
  CosignSchedule,
  SLAMetrics,
  WorkloadStat,
  ReviewKPI,
  RejectTemplate,
  ReviewComment,
  AIPreReviewResult,
  ReviewerAssignment,
  AuditChainStep,
} from '../types/R3/R3.REVIEW';

const now = new Date();
const isoOffset = (hours: number) => new Date(now.getTime() + hours * 3600 * 1000).toISOString();
const fmt = (d: Date) => d.toISOString();(stage: string, status: string) => `${stage}.${status}`;

export const REVIEW_TASKS: ReviewTask[] = [
  {
    id: 'rt-001', reportId: 'RP20260615001', patientId: 'P-100023', patientName: '黄海涛',
    gender: '男', age: 58, modality: 'CT', bodyPart: '胸部', priority: 'stat',
    stage: 'initial', status: 'pending',
    authorId: 'D002', authorName: '李慧敏', authorTitle: '副主任医师',
    submittedAt: isoOffset(-2), deadline: isoOffset(2),
    qualityScore: 88, criticalFinding: true, isOverdue: false, hoursToDeadline: 4,
    flags: ['critical', 'stat'], rectifyCount: 0, history: [],
    needsCosign: true, cosignReason: 'critical-finding',
  },
  {
    id: 'rt-002', reportId: 'RP20260615002', patientId: 'P-100024', patientName: '徐丽华',
    gender: '女', age: 45, modality: 'MR', bodyPart: '腹部', priority: 'urgent',
    stage: 'initial', status: 'in-progress',
    authorId: 'D005', authorName: '刘文博', authorTitle: '副主任医师',
    submittedAt: isoOffset(-4), deadline: isoOffset(4),
    initialReviewerId: 'D006', initialReviewerName: '赵雪琴', initialReviewAt: isoOffset(-1),
    qualityScore: 92, criticalFinding: false, isOverdue: false, hoursToDeadline: 4,
    flags: ['urgent'], rectifyCount: 0, history: [],
    needsCosign: false,
  },
  {
    id: 'rt-003', reportId: 'RP20260615003', patientId: 'P-100025', patientName: '马俊杰',
    gender: '男', age: 62, modality: 'CT', bodyPart: '腹部', priority: 'stat',
    stage: 'initial', status: 'overdue',
    authorId: 'D001', authorName: '张明远', authorTitle: '主任医师',
    submittedAt: isoOffset(-20), deadline: isoOffset(-8),
    qualityScore: 85, criticalFinding: true, isOverdue: true, hoursToDeadline: -8,
    flags: ['critical', 'overdue', 'stat'], rectifyCount: 0, history: [],
    needsCosign: true, cosignReason: 'critical-finding',
  },
  {
    id: 'rt-004', reportId: 'RP20260614004', patientId: 'P-100026', patientName: '宋建国',
    gender: '男', age: 53, modality: 'MR', bodyPart: '头颅', priority: 'routine',
    stage: 'final', status: 'pending',
    authorId: 'D003', authorName: '王建华', authorTitle: '主治医师',
    submittedAt: isoOffset(-12), deadline: isoOffset(-2),
    initialReviewerId: 'D005', initialReviewerName: '刘文博', initialReviewAt: isoOffset(-6),
    initialReviewScore: 92, initialReviewComment: '报告规范，建议关注双侧基底节区缺血灶',
    qualityScore: 90, criticalFinding: false, isOverdue: true, hoursToDeadline: -2,
    flags: ['overdue'], rectifyCount: 0, history: [],
    needsCosign: false,
  },
  {
    id: 'rt-005', reportId: 'RP20260614005', patientId: 'P-100027', patientName: '韩雪飞',
    gender: '女', age: 48, modality: 'MG', bodyPart: '胸部', priority: 'urgent',
    stage: 'final', status: 'in-progress',
    authorId: 'D002', authorName: '李慧敏', authorTitle: '副主任医师',
    submittedAt: isoOffset(-10), deadline: isoOffset(2),
    initialReviewerId: 'D006', initialReviewerName: '赵雪琴', initialReviewAt: isoOffset(-7),
    initialReviewScore: 88, initialReviewComment: '左乳外上象限钙化簇，BI-RADS 4A 类，需复核',
    finalReviewerId: 'D001', finalReviewerName: '张明远', finalReviewAt: isoOffset(-1),
    qualityScore: 88, criticalFinding: true, isOverdue: false, hoursToDeadline: 2,
    flags: ['urgent', 'critical'], rectifyCount: 0, history: [],
    needsCosign: true, cosignReason: 'critical-finding',
  },
  {
    id: 'rt-006', reportId: 'RP20260614006', patientId: 'P-100028', patientName: '高志强',
    gender: '男', age: 65, modality: 'CT', bodyPart: '头颅', priority: 'stat',
    stage: 'final', status: 'pending',
    authorId: 'D001', authorName: '张明远', authorTitle: '主任医师',
    submittedAt: isoOffset(-22), deadline: isoOffset(-12),
    initialReviewerId: 'D005', initialReviewerName: '刘文博', initialReviewAt: isoOffset(-18),
    initialReviewScore: 78, initialReviewComment: '提示急性脑梗死，请立即通报',
    qualityScore: 78, criticalFinding: true, isOverdue: true, hoursToDeadline: -12,
    flags: ['critical', 'overdue'], rectifyCount: 0, history: [],
    needsCosign: true, cosignReason: 'critical-finding',
  },
  {
    id: 'rt-007', reportId: 'RP20260613007', patientId: 'P-100029', patientName: '谢军',
    gender: '男', age: 71, modality: 'CT', bodyPart: '胸部', priority: 'routine',
    stage: 'cosign', status: 'pending',
    authorId: 'D002', authorName: '李慧敏', authorTitle: '副主任医师',
    submittedAt: isoOffset(-26), deadline: isoOffset(-2),
    initialReviewerId: 'D005', initialReviewerName: '刘文博', initialReviewAt: isoOffset(-20),
    initialReviewScore: 90, initialReviewComment: '同意',
    finalReviewerId: 'D001', finalReviewerName: '张明远', finalReviewAt: isoOffset(-12),
    finalReviewScore: 92, finalReviewComment: '同意签发',
    qualityScore: 92, criticalFinding: false, isOverdue: true, hoursToDeadline: -2,
    flags: ['cosign', 'overdue'], rectifyCount: 0, history: [],
    needsCosign: true, cosignReason: 'special-study',
  },
  {
    id: 'rt-008', reportId: 'RP20260613008', patientId: 'P-100030', patientName: '邓丽华',
    gender: '女', age: 39, modality: 'CT', bodyPart: '腹部', priority: 'routine',
    stage: 'cosign', status: 'in-progress',
    authorId: 'D003', authorName: '王建华', authorTitle: '主治医师',
    submittedAt: isoOffset(-30), deadline: isoOffset(0),
    initialReviewerId: 'D002', initialReviewerName: '李慧敏', initialReviewAt: isoOffset(-26),
    initialReviewScore: 95, initialReviewComment: '同意',
    finalReviewerId: 'D006', finalReviewerName: '赵雪琴', finalReviewAt: isoOffset(-20),
    finalReviewScore: 96, finalReviewComment: '同意签发',
    qualityScore: 96, criticalFinding: false, isOverdue: false, hoursToDeadline: 0,
    flags: ['cosign'], rectifyCount: 0, history: [],
    needsCosign: true, cosignReason: 'special-study',
  },
  {
    id: 'rt-009', reportId: 'RP20260612009', patientId: 'P-100031', patientName: '彭大海',
    gender: '男', age: 56, modality: 'MR', bodyPart: '脊柱', priority: 'routine',
    stage: 'sign', status: 'pending',
    authorId: 'D004', authorName: '陈晓东', authorTitle: '住院医师',
    submittedAt: isoOffset(-48), deadline: isoOffset(-22),
    initialReviewerId: 'D003', initialReviewerName: '王建华', initialReviewAt: isoOffset(-44),
    initialReviewScore: 88, initialReviewComment: '同意',
    finalReviewerId: 'D005', finalReviewerName: '刘文博', finalReviewAt: isoOffset(-40),
    finalReviewScore: 90, finalReviewComment: '同意签发',
    qualityScore: 90, criticalFinding: false, isOverdue: true, hoursToDeadline: -22,
    flags: ['overdue'], rectifyCount: 0, history: [],
    needsCosign: false,
  },
  {
    id: 'rt-010', reportId: 'RP20260612010', patientId: 'P-100032', patientName: '苏小梅',
    gender: '女', age: 44, modality: 'MR', bodyPart: '头颅', priority: 'urgent',
    stage: 'sign', status: 'in-progress',
    authorId: 'D005', authorName: '刘文博', authorTitle: '副主任医师',
    submittedAt: isoOffset(-32), deadline: isoOffset(-2),
    initialReviewerId: 'D002', initialReviewerName: '李慧敏', initialReviewAt: isoOffset(-28),
    initialReviewScore: 85, initialReviewComment: '建议补充 MRA 描述',
    finalReviewerId: 'D001', finalReviewerName: '张明远', finalReviewAt: isoOffset(-12),
    finalReviewScore: 88, finalReviewComment: '终审通过，同意签发',
    qualityScore: 86, criticalFinding: false, isOverdue: true, hoursToDeadline: -2,
    flags: ['urgent'], rectifyCount: 0, history: [],
    needsCosign: false,
  },
  {
    id: 'rt-011', reportId: 'RP20260610011', patientId: 'P-100033', patientName: '潘立国',
    gender: '男', age: 67, modality: 'CT', bodyPart: '腹部', priority: 'routine',
    stage: 'initial', status: 'rejected',
    authorId: 'D003', authorName: '王建华', authorTitle: '主治医师',
    submittedAt: isoOffset(-72), deadline: isoOffset(-48),
    initialReviewerId: 'D002', initialReviewerName: '李慧敏', initialReviewAt: isoOffset(-50),
    rejectReason: '描述不充分，建议补充病灶形态、密度、边缘特征及与周围脏器关系',
    rejectCategory: 'unclear-description',
    qualityScore: 60, criticalFinding: false, isOverdue: false, hoursToDeadline: 0,
    flags: ['rejected'], rectifyCount: 1, history: [],
    needsCosign: false,
  },
  {
    id: 'rt-012', reportId: 'RP20260610012', patientId: 'P-100034', patientName: '段丽君',
    gender: '女', age: 52, modality: 'MR', bodyPart: '盆腔', priority: 'routine',
    stage: 'initial', status: 'rejected',
    authorId: 'D007', authorName: '孙立人', authorTitle: '主治医师',
    submittedAt: isoOffset(-80), deadline: isoOffset(-56),
    initialReviewerId: 'D005', initialReviewerName: '刘文博', initialReviewAt: isoOffset(-58),
    rejectReason: '报告过于简单，需补充病灶大小、信号特征、分布等关键信息',
    rejectCategory: 'missing-key-finding',
    qualityScore: 55, criticalFinding: false, isOverdue: false, hoursToDeadline: 0,
    flags: ['rejected'], rectifyCount: 2, history: [],
    needsCosign: false,
  },
  {
    id: 'rt-013', reportId: 'RP20260608013', patientId: 'P-100035', patientName: '袁建辉',
    gender: '男', age: 60, modality: 'CT', bodyPart: '胸部', priority: 'routine',
    stage: 'sign', status: 'pending',
    authorId: 'D002', authorName: '李慧敏', authorTitle: '副主任医师',
    submittedAt: isoOffset(-96), deadline: isoOffset(-72),
    initialReviewerId: 'D005', initialReviewerName: '刘文博', initialReviewAt: isoOffset(-90),
    initialReviewScore: 96, initialReviewComment: '同意',
    finalReviewerId: 'D001', finalReviewerName: '张明远', finalReviewAt: isoOffset(-84),
    finalReviewScore: 95, finalReviewComment: '同意签发',
    qualityScore: 95, criticalFinding: false, isOverdue: true, hoursToDeadline: -72,
    flags: ['overdue'], rectifyCount: 0, history: [],
    needsCosign: false,
  },
  {
    id: 'rt-014', reportId: 'RP20260608014', patientId: 'P-100036', patientName: '余小红',
    gender: '女', age: 49, modality: 'US', bodyPart: '腹部', priority: 'routine',
    stage: 'cosign', status: 'pending',
    authorId: 'D003', authorName: '王建华', authorTitle: '主治医师',
    submittedAt: isoOffset(-100), deadline: isoOffset(-76),
    initialReviewerId: 'D002', initialReviewerName: '李慧敏', initialReviewAt: isoOffset(-94),
    initialReviewScore: 94, initialReviewComment: '同意',
    finalReviewerId: 'D006', finalReviewerName: '赵雪琴', finalReviewAt: isoOffset(-86),
    finalReviewScore: 92, finalReviewComment: '同意签发',
    qualityScore: 92, criticalFinding: false, isOverdue: true, hoursToDeadline: -76,
    flags: ['cosign', 'overdue'], rectifyCount: 0, history: [],
    needsCosign: true, cosignReason: 'special-study',
  },
  {
    id: 'rt-015', reportId: 'RP20260607015', patientId: 'P-100037', patientName: '邱淑芬',
    gender: '女', age: 55, modality: 'MR', bodyPart: '脊柱', priority: 'routine',
    stage: 'final', status: 'pending',
    authorId: 'D004', authorName: '陈晓东', authorTitle: '住院医师',
    submittedAt: isoOffset(-120), deadline: isoOffset(-96),
    initialReviewerId: 'D003', initialReviewerName: '王建华', initialReviewAt: isoOffset(-114),
    initialReviewScore: 90, initialReviewComment: '同意',
    qualityScore: 90, criticalFinding: false, isOverdue: true, hoursToDeadline: -96,
    flags: ['overdue'], rectifyCount: 0, history: [],
    needsCosign: false,
  },
];

export const REVIEWERS: Reviewer[] = [
  {
    id: 'D001', name: '张明远', title: 'chief', titleLabel: '主任医师', department: '放射科',
    status: 'online', currentLoad: 3, maxLoad: 12, pendingCount: 2, inProgressCount: 1,
    completedToday: 6, avgReviewMinutes: 75, onTimeRate: 96.5, rejectionRate: 8.2,
    specialty: ['CT', 'MR', '胸部', '心脏'], email: 'zhang.mingyuan@hospital.cn', phone: '138****0001',
    lastActiveAt: fmt(now),
  },
  {
    id: 'D002', name: '李慧敏', title: 'associateChief', titleLabel: '副主任医师', department: '放射科',
    status: 'online', currentLoad: 5, maxLoad: 10, pendingCount: 3, inProgressCount: 2,
    completedToday: 8, avgReviewMinutes: 65, onTimeRate: 94.0, rejectionRate: 10.5,
    specialty: ['MR', 'CT', '神经'], email: 'li.huimin@hospital.cn', phone: '138****0002',
    lastActiveAt: fmt(now),
  },
  {
    id: 'D005', name: '刘文博', title: 'associateChief', titleLabel: '副主任医师', department: '放射科',
    status: 'online', currentLoad: 4, maxLoad: 10, pendingCount: 2, inProgressCount: 2,
    completedToday: 7, avgReviewMinutes: 70, onTimeRate: 92.0, rejectionRate: 12.0,
    specialty: ['CT', 'MR', '腹部'], email: 'liu.wenbo@hospital.cn', phone: '138****0005',
    lastActiveAt: fmt(now),
  },
  {
    id: 'D006', name: '赵雪琴', title: 'chief', titleLabel: '主任医师', department: '放射科',
    status: 'away', currentLoad: 2, maxLoad: 12, pendingCount: 1, inProgressCount: 1,
    completedToday: 4, avgReviewMinutes: 90, onTimeRate: 97.5, rejectionRate: 5.5,
    specialty: ['MG', 'MR', '女性'], email: 'zhao.xueqin@hospital.cn', phone: '138****0006',
    lastActiveAt: fmt(now),
  },
  {
    id: 'D003', name: '王建华', title: 'attending', titleLabel: '主治医师', department: '放射科',
    status: 'busy', currentLoad: 6, maxLoad: 8, pendingCount: 4, inProgressCount: 2,
    completedToday: 5, avgReviewMinutes: 85, onTimeRate: 88.0, rejectionRate: 14.5,
    specialty: ['CT', 'MR', '脊柱'], email: 'wang.jianhua@hospital.cn', phone: '138****0003',
    lastActiveAt: fmt(now),
  },
  {
    id: 'D004', name: '陈晓东', title: 'resident', titleLabel: '住院医师', department: '放射科',
    status: 'online', currentLoad: 5, maxLoad: 8, pendingCount: 3, inProgressCount: 2,
    completedToday: 4, avgReviewMinutes: 95, onTimeRate: 85.0, rejectionRate: 18.0,
    specialty: ['DR', 'CT'], email: 'chen.xiaodong@hospital.cn', phone: '138****0004',
    lastActiveAt: fmt(now),
  },
  {
    id: 'D007', name: '孙立人', title: 'attending', titleLabel: '主治医师', department: '放射科',
    status: 'offline', currentLoad: 0, maxLoad: 8, pendingCount: 0, inProgressCount: 0,
    completedToday: 0, avgReviewMinutes: 80, onTimeRate: 90.0, rejectionRate: 11.0,
    specialty: ['MR', 'US'], email: 'sun.liren@hospital.cn', phone: '138****0007',
    lastActiveAt: isoOffset(-4),
  },
  {
    id: 'D008', name: '钱伟', title: 'associateChief', titleLabel: '副主任医师', department: '放射科',
    status: 'online', currentLoad: 3, maxLoad: 10, pendingCount: 2, inProgressCount: 1,
    completedToday: 6, avgReviewMinutes: 72, onTimeRate: 93.0, rejectionRate: 9.5,
    specialty: ['CT', 'MR'], email: 'qian.wei@hospital.cn', phone: '138****0008',
    lastActiveAt: fmt(now),
  },
  {
    id: 'D009', name: '吴芳', title: 'chief', titleLabel: '主任医师', department: '放射科',
    status: 'online', currentLoad: 1, maxLoad: 12, pendingCount: 0, inProgressCount: 1,
    completedToday: 3, avgReviewMinutes: 100, onTimeRate: 98.0, rejectionRate: 4.0,
    specialty: ['CT', 'MR', '心脏', '血管'], email: 'wu.fang@hospital.cn', phone: '138****0009',
    lastActiveAt: fmt(now),
  },
  {
    id: 'D010', name: '郑文', title: 'associateChief', titleLabel: '副主任医师', department: '放射科',
    status: 'online', currentLoad: 4, maxLoad: 10, pendingCount: 2, inProgressCount: 2,
    completedToday: 5, avgReviewMinutes: 68, onTimeRate: 91.5, rejectionRate: 13.0,
    specialty: ['MR', 'CT', '神经'], email: 'zheng.wen@hospital.cn', phone: '138****0010',
    lastActiveAt: fmt(now),
  },
];

export const COSIGN_SCHEDULES: CosignSchedule[] = [
  { id: 'cs-001', date: '2026-06-17', shiftType: 'morning', reviewerId: 'D001', reviewerName: '张明远', reviewerTitle: 'chief', maxCapacity: 8, reserved: 3, startTime: '08:00', endTime: '12:00', status: 'on-duty' },
  { id: 'cs-002', date: '2026-06-17', shiftType: 'afternoon', reviewerId: 'D001', reviewerName: '张明远', reviewerTitle: 'chief', maxCapacity: 6, reserved: 2, startTime: '14:00', endTime: '18:00', status: 'scheduled' },
  { id: 'cs-003', date: '2026-06-17', shiftType: 'morning', reviewerId: 'D006', reviewerName: '赵雪琴', reviewerTitle: 'chief', maxCapacity: 8, reserved: 4, startTime: '08:00', endTime: '12:00', status: 'on-duty' },
  { id: 'cs-004', date: '2026-06-17', shiftType: 'afternoon', reviewerId: 'D006', reviewerName: '赵雪琴', reviewerTitle: 'chief', maxCapacity: 6, reserved: 1, startTime: '14:00', endTime: '18:00', status: 'scheduled' },
  { id: 'cs-005', date: '2026-06-17', shiftType: 'morning', reviewerId: 'D009', reviewerName: '吴芳', reviewerTitle: 'chief', maxCapacity: 6, reserved: 2, startTime: '08:00', endTime: '12:00', status: 'on-duty' },
  { id: 'cs-006', date: '2026-06-17', shiftType: 'evening', reviewerId: 'D009', reviewerName: '吴芳', reviewerTitle: 'chief', maxCapacity: 4, reserved: 1, startTime: '18:00', endTime: '22:00', status: 'scheduled' },
  { id: 'cs-007', date: '2026-06-17', shiftType: 'night', reviewerId: 'D010', reviewerName: '郑文', reviewerTitle: 'associateChief', maxCapacity: 3, reserved: 0, startTime: '22:00', endTime: '08:00', status: 'scheduled' },
  { id: 'cs-008', date: '2026-06-18', shiftType: 'morning', reviewerId: 'D001', reviewerName: '张明远', reviewerTitle: 'chief', maxCapacity: 8, reserved: 0, startTime: '08:00', endTime: '12:00', status: 'scheduled' },
  { id: 'cs-009', date: '2026-06-18', shiftType: 'morning', reviewerId: 'D006', reviewerName: '赵雪琴', reviewerTitle: 'chief', maxCapacity: 8, reserved: 0, startTime: '08:00', endTime: '12:00', status: 'scheduled' },
  { id: 'cs-010', date: '2026-06-18', shiftType: 'morning', reviewerId: 'D009', reviewerName: '吴芳', reviewerTitle: 'chief', maxCapacity: 6, reserved: 0, startTime: '08:00', endTime: '12:00', status: 'scheduled' },
  { id: 'cs-011', date: '2026-06-18', shiftType: 'afternoon', reviewerId: 'D002', reviewerName: '李慧敏', reviewerTitle: 'associateChief', maxCapacity: 5, reserved: 0, startTime: '14:00', endTime: '18:00', status: 'scheduled' },
  { id: 'cs-012', date: '2026-06-18', shiftType: 'afternoon', reviewerId: 'D005', reviewerName: '刘文博', reviewerTitle: 'associateChief', maxCapacity: 5, reserved: 0, startTime: '14:00', endTime: '18:00', status: 'scheduled' },
];

export const SLA_METRICS: SLAMetrics = {
  initialReviewSLA: 4,
  finalReviewSLA: 2,
  signSLA: 1,
  cosignSLA: 1,
  escalateSLA: 0.5,
  onTimeRate: 87.5,
  overdueCount: 5,
  averageInitialMinutes: 108,
  averageFinalMinutes: 72,
  averageCosignMinutes: 30,
  p95InitialMinutes: 240,
  p95FinalMinutes: 180,
  breachByStage: { initial: 3, final: 2, cosign: 1, sign: 2 },
};

export const WORKLOAD_STATS: WorkloadStat[] = REVIEWERS.slice(0, 6).map((r, idx) => ({
  reviewerId: r.id,
  reviewerName: r.name,
  reviewerTitle: r.title,
  period: 'week',
  totalAssigned: 30 + idx * 5,
  totalCompleted: 25 + idx * 5,
  totalRejected: 3 + idx,
  totalEscalated: 1,
  averageMinutes: r.avgReviewMinutes,
  onTimeRate: r.onTimeRate,
  rejectionRate: r.rejectionRate,
  byStage: [
    { stage: 'initial', count: 12 + idx * 2, avgMinutes: 100 },
    { stage: 'final', count: 8 + idx, avgMinutes: 70 },
    { stage: 'cosign', count: 3, avgMinutes: 30 },
    { stage: 'sign', count: 2 + idx, avgMinutes: 20 },
  ],
  byModality: [
    { modality: 'CT', count: 15 + idx * 2 },
    { modality: 'MR', count: 8 + idx },
    { modality: 'DR', count: 4 },
    { modality: 'US', count: 3 },
  ],
  byPriority: [
    { priority: 'stat', count: 2 },
    { priority: 'urgent', count: 8 + idx },
    { priority: 'routine', count: 20 + idx * 3 },
  ],
  trend: Array.from({ length: 7 }, (_, i) => ({
    date: new Date(now.getTime() - (6 - i) * 86400000).toISOString().slice(0, 10),
    completed: 4 + (i % 3) + idx,
    rejected: i % 4 === 0 ? 1 : 0,
  })),
}));

export const REVIEW_KPI: ReviewKPI = {
  totalToday: 18,
  pendingInitial: 4,
  inProgressInitial: 2,
  pendingFinal: 3,
  inProgressFinal: 1,
  pendingCosign: 2,
  pendingSign: 3,
  rejected: 2,
  overdue: 5,
  completedToday: 9,
  avgInitialHours: 1.8,
  avgFinalHours: 1.2,
  avgCosignHours: 0.5,
  onTimeRate: 87.5,
  rejectionRate: 12.5,
  criticalHandledRate: 100,
  cosignPendingHours: 0.8,
};

export const REJECT_TEMPLATES: RejectTemplate[] = [
  {
    id: 'rt-tpl-001', category: 'unclear-description', title: '描述不充分',
    body: '报告描述内容过于简短，建议补充以下要素：\n- 部位\n- 形态\n- 大小\n- 密度/信号\n- 边缘\n- 周围关系',
    presetComment: '描述不充分，建议补充病灶形态、密度、边缘特征及与周围脏器关系。',
    requiredMinLength: 10, suggestedScore: 60, isSystem: true,
  },
  {
    id: 'rt-tpl-002', category: 'terminology-error', title: '术语错误',
    body: '存在术语使用不规范或错误之处',
    presetComment: '术语使用不规范，请参照 WS/T 500-2016 标准术语修正。',
    requiredMinLength: 5, suggestedScore: 65, isSystem: true,
  },
  {
    id: 'rt-tpl-003', category: 'left-right-confusion', title: '左右混淆',
    body: '报告中左右侧描述与图像所见不符',
    presetComment: '左右侧描述与图像所见不符，请核对后重新描述。',
    requiredMinLength: 8, suggestedScore: 50, isSystem: true,
  },
  {
    id: 'rt-tpl-004', category: 'missing-key-finding', title: '缺少关键所见',
    body: '报告中缺少对关键病灶的描述',
    presetComment: '报告中缺少关键所见描述，建议补充病灶大小、信号/密度特征、分布等关键信息。',
    requiredMinLength: 10, suggestedScore: 60, isSystem: true,
  },
  {
    id: 'rt-tpl-005', category: 'inconsistent-with-image', title: '与图像不符',
    body: '报告描述内容与实际影像所见不一致',
    presetComment: '报告内容与图像所见不符，请重新阅片后修正。',
    requiredMinLength: 10, suggestedScore: 45, isSystem: true,
  },
  {
    id: 'rt-tpl-006', category: 'missing-recommendation', title: '缺少建议',
    body: '报告缺少随访或进一步检查建议',
    presetComment: '建议补充随访或进一步检查建议。',
    requiredMinLength: 5, suggestedScore: 75, isSystem: true,
  },
  {
    id: 'rt-tpl-007', category: 'critical-not-marked', title: '危急值未标',
    body: '危急值未在报告中明确标识',
    presetComment: '危急值未在报告中明确标识，请按规范标注。',
    requiredMinLength: 5, suggestedScore: 30, isSystem: true,
  },
  {
    id: 'rt-tpl-008', category: 'other', title: '其他',
    body: '其他需要修改的问题',
    presetComment: '请按审核意见修改后重新提交。',
    requiredMinLength: 5, suggestedScore: 70, isSystem: true,
  },
  {
    id: 'rt-tpl-009', category: 'inconsistent-with-image', title: '数据不一致',
    body: '报告数据前后不一致',
    presetComment: '报告数据前后不一致，请核实后统一。',
    requiredMinLength: 8, suggestedScore: 55, isSystem: true,
  },
  {
    id: 'rt-tpl-010', category: 'unclear-description', title: '逻辑矛盾',
    body: '报告中存在逻辑矛盾（如阴性/阳性并存）',
    presetComment: '报告中存在逻辑矛盾，请统一结论后重新提交。',
    requiredMinLength: 10, suggestedScore: 50, isSystem: true,
  },
  {
    id: 'rt-tpl-011', category: 'terminology-error', title: '缩写不规范',
    body: '首次使用的缩写未注明全称',
    presetComment: '首次使用的缩写未注明全称，请按规范补充。',
    requiredMinLength: 8, suggestedScore: 80, isSystem: true,
  },
  {
    id: 'rt-tpl-012', category: 'unclear-description', title: '格式不规范',
    body: '报告中存在格式不规范之处',
    presetComment: '报告中存在格式不规范之处（如单位缺失、尺寸格式错误），请按规范修正。',
    requiredMinLength: 8, suggestedScore: 70, isSystem: true,
  },
];

export const REVIEW_COMMENTS: ReviewComment[] = [
  {
    id: 'cmt-001', taskId: 'rt-001', reportId: 'RP20260615001',
    authorId: 'D006', authorName: '赵雪琴', authorColor: 'var(--color-error-600)',
    content: '左肺下叶肿块的强化特征建议补充"不均匀强化"的具体描述。',
    fieldRef: 'findings', position: { x: 120, y: 280 },
    resolved: false, mentions: ['D002'], createdAt: isoOffset(-1),
  },
  {
    id: 'cmt-002', taskId: 'rt-001', reportId: 'RP20260615001',
    authorId: 'D006', authorName: '赵雪琴', authorColor: 'var(--color-error-600)',
    content: '@李慧敏 这里建议增加"与周围血管关系"的描述。',
    fieldRef: 'findings', position: { x: 220, y: 320 },
    resolved: false, parentId: 'cmt-001', mentions: ['D002'], createdAt: isoOffset(-1.5),
  },
  {
    id: 'cmt-003', taskId: 'rt-001', reportId: 'RP20260615001',
    authorId: 'D002', authorName: '李慧敏', authorColor: '#7c3aed',
    content: '已修改，补充了与肺门血管的关系描述。',
    fieldRef: 'findings', position: { x: 280, y: 360 },
    resolved: true, resolvedAt: isoOffset(-0.5), resolvedBy: 'D006',
    mentions: ['D006'], createdAt: isoOffset(-1.2),
  },
  {
    id: 'cmt-004', taskId: 'rt-005', reportId: 'RP20260614005',
    authorId: 'D001', authorName: '张明远', authorColor: 'var(--color-info-600)',
    content: 'BI-RADS 5 类建议明确具体可疑征象的个数和大小。',
    fieldRef: 'impression', position: { x: 350, y: 420 },
    resolved: false, mentions: ['D006'], createdAt: isoOffset(-2),
  },
  {
    id: 'cmt-005', taskId: 'rt-002', reportId: 'RP20260615002',
    authorId: 'D005', authorName: '刘文博', authorColor: '#10b981',
    content: '肝脏多发结节需明确数量，建议逐个测量大小。',
    fieldRef: 'findings', position: { x: 180, y: 240 },
    resolved: false, mentions: ['D006'], createdAt: isoOffset(-3),
  },
];

export const AI_PRE_REVIEW_RESULTS: AIPreReviewResult[] = [
  {
    id: 'ai-001', reportId: 'RP20260615001',
    suggestedScore: 88, confidence: 0.92,
    defects: [
      { code: 'DSC-001', name: '描述过于简单', severity: 'major', position: '检查所见-胸部', suggestion: '补充肿块强化方式、坏死区域、钙化等关键信息' },
      { code: 'FMT-001', name: 'CT值缺单位', severity: 'minor', position: '检查所见', suggestion: 'CT值后添加"HU"' },
    ],
    suggestions: [
      '建议补充肿块与胸膜关系',
      '建议明确淋巴结分区',
      '建议使用 Lung-RADS 分类',
    ],
    riskLevel: 'high',
    consistencyScore: 0.90,
    completenessScore: 0.85,
    terminologyScore: 0.95,
    criticalFindingDetected: true,
    generatedAt: isoOffset(-2),
    modelVersion: 'v2.3.1',
  },
  {
    id: 'ai-002', reportId: 'RP20260615002',
    suggestedScore: 92, confidence: 0.95,
    defects: [],
    suggestions: ['建议补充肝脏结节数量与具体定位'],
    riskLevel: 'low',
    consistencyScore: 0.95,
    completenessScore: 0.92,
    terminologyScore: 0.98,
    criticalFindingDetected: false,
    generatedAt: isoOffset(-4),
    modelVersion: 'v2.3.1',
  },
];

export const REVIEWER_ASSIGNMENTS: ReviewerAssignment[] = [
  { id: 'ra-001', taskId: 'rt-001', reviewerId: 'D006', reviewerName: '赵雪琴', assignedBy: 'system', assignedAt: isoOffset(-2), strategy: 'auto-workload' },
  { id: 'ra-002', taskId: 'rt-002', reviewerId: 'D005', reviewerName: '刘文博', assignedBy: 'D001', assignedAt: isoOffset(-4), strategy: 'manual' },
  { id: 'ra-003', taskId: 'rt-005', reviewerId: 'D001', reviewerName: '张明远', assignedBy: 'D006', assignedAt: isoOffset(-7), strategy: 'manual', note: 'critical-finding 升级' },
];

export const AUDIT_CHAINS: AuditChainStep[][] = [
  [
    { id: 'ac-001-1', step: 'submit', actorId: 'D002', actorName: '李慧敏', action: '报告提交', timestamp: isoOffset(-2), hash: 'a1b2c3d4', prevHash: '00000000' },
    { id: 'ac-001-2', step: 'initial', actorId: 'D006', actorName: '赵雪琴', action: '启动初审', timestamp: isoOffset(-1), hash: 'b2c3d4e5', prevHash: 'a1b2c3d4' },
  ],
  [
    { id: 'ac-002-1', step: 'submit', actorId: 'D005', actorName: '刘文博', action: '报告提交', timestamp: isoOffset(-4), hash: 'c3d4e5f6', prevHash: '00000000' },
    { id: 'ac-002-2', step: 'initial', actorId: 'D005', actorName: '刘文博', action: '启动初审', timestamp: isoOffset(-3), hash: 'd4e5f6g7', prevHash: 'c3d4e5f6' },
    { id: 'ac-002-3', step: 'final', actorId: 'D001', actorName: '张明远', action: '启动终审', timestamp: isoOffset(-1), hash: 'e5f6g7h8', prevHash: 'd4e5f6g7' },
  ],
];

export default {
  REVIEW_TASKS,
  REVIEWERS,
  COSIGN_SCHEDULES,
  SLA_METRICS,
  WORKLOAD_STATS,
  REVIEW_KPI,
  REJECT_TEMPLATES,
  REVIEW_COMMENTS,
  AI_PRE_REVIEW_RESULTS,
  REVIEWER_ASSIGNMENTS,
  AUDIT_CHAINS,
};

// [v3.0.6.8-27] 三甲级审核数据扩充 - REVIEW_TASKS 15→100+, REVIEWERS 10→40+
import { DOCTOR_MASTER, DOCTORS_BY_TITLE } from './master/doctorMasterMock';
import { PATIENT_MASTER } from './master/patientMasterMock';
import { seedRandom, randInt, pick } from './_generators/medicalDataGen';

seedRandom(0xAB0101);
const _STAGES = ['initial', 'final', 'cosign', 'sign'] as const;
const _STAGE_LABELS = { initial: '初核', final: '终核', cosign: '双签', sign: '签发' };
const _PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const _TASK_STATUSES = ['pending', 'in_progress', 'completed', 'overdue', 'rejected'] as const;

// 扩充 REVIEW_TASKS 15→115
const _EXTRA_REVIEW_TASKS = Array.from({ length: 100 }, (_, i) => {
  const p = pick(PATIENT_MASTER);
  const reviewer = pick(DOCTORS_BY_TITLE['副主任医师'].concat(DOCTORS_BY_TITLE['主任医师']));
  const reportDoctor = pick(DOCTORS_BY_TITLE['主治医师'].concat(DOCTORS_BY_TITLE['住院医师']));
  const stage = pick([..._STAGES]);
  const dayAgo = randInt(0, 14);
  const status = pick([..._TASK_STATUSES]) as 'pending' | 'in_progress' | 'completed' | 'overdue' | 'rejected';
  const submittedAt = new Date(Date.now() - dayAgo * 86400000 - randInt(0, 18) * 3600000).toISOString();
  return {
    id: `rt-gen-${String(i + 1).padStart(4, '0')}`,
    reportId: `rpt-gen-${randInt(100000, 999999)}`,
    patientId: p.id,
    patientName: p.name,
    patientAge: p.age,
    modality: p.modality,
    bodyPart: p.bodyPart,
    stage: stage as 'initial' | 'final' | 'cosign' | 'sign',
    stageLabel: _STAGE_LABELS[stage],
    reportDoctorId: reportDoctor.id,
    reportDoctorName: reportDoctor.name,
    reportDoctorTitle: reportDoctor.title,
    reviewerId: reviewer.id,
    reviewerName: reviewer.name,
    reviewerTitle: reviewer.title,
    submittedAt,
    deadline: new Date(new Date(submittedAt).getTime() + (p.priority === '急诊' ? 30 : 240) * 60000).toISOString(),
    priority: pick([..._PRIORITIES]) as 'low' | 'medium' | 'high' | 'urgent',
    status,
    completedAt: status === 'completed' ? new Date(new Date(submittedAt).getTime() + randInt(15, 240) * 60000).toISOString() : null,
    slaMet: status === 'completed' ? Math.random() > 0.15 : false,
    defectCount: randInt(0, 3),
    findings: '检查所见内容...',
    hasAI: Math.random() > 0.3,
  };
});
export const REVIEW_TASKS_FULL = [...REVIEW_TASKS, ..._EXTRA_REVIEW_TASKS];

// 扩充 REVIEWERS 10→40
const _EXTRA_REVIEWERS = DOCTOR_MASTER
  .filter((d) => d.title === '副主任医师' || d.title === '主任医师')
  .map((d, _i) => ({
    id: d.id,
    name: d.name,
    title: d.title,
    department: d.subspecialty,
    specialty: d.subspecialty,
    level: d.title === '主任医师' ? 'chief' as const : 'associate_chief' as const,
    active: d.active,
    caseload: d.monthlyReportCount,
    avgReviewTime: randInt(5, 30),
    qualityScore: d.annualQCScore,
    certification: d.certifications[0] || 'CFCA',
    onTimeRate: parseFloat(d.timelyRate as unknown as string),
    email: `${d.id.toLowerCase()}@hospital.com`,
    phone: `138${randInt(10000000, 99999999)}`,
  }));
export const REVIEWERS_FULL = [...REVIEWERS, ..._EXTRA_REVIEWERS];
