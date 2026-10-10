// ============================================================
// G005 放射科RIS系统 v1.0.3 - 报告审核/修订/协同 Mock 数据
// Phase R3
// ============================================================

// ============================================================
// 审核任务
// ============================================================
export type ReviewStage = 'initial' | 'final' | 'sign';
export type ReviewStatus = 'pending' | 'in-progress' | 'completed' | 'rejected' | 'overdue';

export interface ReviewTask {
  id: string;
  reportId: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  reportDoctorId: string;
  reportDoctorName: string;
  reportDoctorTitle: string;
  stage: ReviewStage;
  status: ReviewStatus;
  submittedAt: string;
  deadline: string;
  initialAuditDoctorId?: string;
  initialAuditDoctorName?: string;
  initialAuditTitle?: string;
  initialAuditStartAt?: string;
  initialAuditCompletedAt?: string;
  initialAuditSuggestion?: string;
  initialAuditScore?: number;
  finalAuditDoctorId?: string;
  finalAuditDoctorName?: string;
  finalAuditTitle?: string;
  finalAuditStartAt?: string;
  finalAuditCompletedAt?: string;
  finalAuditSuggestion?: string;
  finalAuditScore?: number;
  rejectedReason?: string;
  qualityScore?: number;
  criticalFinding: boolean;
  isOverdue: boolean;
  hoursToDeadline: number;
}

// 模拟审核任务池
export const REVIEW_TASKS: ReviewTask[] = [
  // 待初审 (3)
  { id: 'rv-001', reportId: 'RP20260604013', patientName: '黄海涛', modality: 'CT', bodyPart: '胸部',
    reportDoctorId: 'D002', reportDoctorName: '李慧敏', reportDoctorTitle: '副主任医师',
    stage: 'initial', status: 'pending', submittedAt: '2026-06-04 10:00:00', deadline: '2026-06-04 22:00:00',
    qualityScore: 88, criticalFinding: false, isOverdue: false, hoursToDeadline: 12 },
  { id: 'rv-002', reportId: 'RP20260604014', patientName: '徐丽华', modality: 'US', bodyPart: '颈部',
    reportDoctorId: 'D005', reportDoctorName: '刘文博', reportDoctorTitle: '副主任医师',
    stage: 'initial', status: 'pending', submittedAt: '2026-06-04 10:15:00', deadline: '2026-06-04 22:00:00',
    qualityScore: 92, criticalFinding: false, isOverdue: false, hoursToDeadline: 12 },
  { id: 'rv-003', reportId: 'RP20260603015', patientName: '马俊辉', modality: 'CT', bodyPart: '腹部',
    reportDoctorId: 'D001', reportDoctorName: '张明远', reportDoctorTitle: '主任医师',
    stage: 'initial', status: 'pending', submittedAt: '2026-06-04 00:30:00', deadline: '2026-06-04 10:00:00',
    qualityScore: 85, criticalFinding: true, isOverdue: true, hoursToDeadline: -8 },

  // 初审中 (3)
  { id: 'rv-004', reportId: 'RP20260603017', patientName: '宋建军', modality: 'MR', bodyPart: '腹部',
    reportDoctorId: 'D003', reportDoctorName: '王建华', reportDoctorTitle: '主治医师',
    stage: 'initial', status: 'in-progress', submittedAt: '2026-06-03 10:00:00', deadline: '2026-06-04 10:00:00',
    initialAuditDoctorId: 'D005', initialAuditDoctorName: '刘文博', initialAuditTitle: '副主任医师',
    initialAuditStartAt: '2026-06-04 08:00:00', qualityScore: 90, criticalFinding: false, isOverdue: false, hoursToDeadline: 2 },
  { id: 'rv-005', reportId: 'RP20260603018', patientName: '韩雪梅', modality: 'MG', bodyPart: '胸部',
    reportDoctorId: 'D002', reportDoctorName: '李慧敏', reportDoctorTitle: '副主任医师',
    stage: 'initial', status: 'in-progress', submittedAt: '2026-06-03 09:00:00', deadline: '2026-06-04 09:00:00',
    initialAuditDoctorId: 'D006', initialAuditDoctorName: '赵雪琴', initialAuditTitle: '主任医师',
    initialAuditStartAt: '2026-06-04 08:30:00', qualityScore: 92, criticalFinding: true, isOverdue: false, hoursToDeadline: 1 },
  { id: 'rv-006', reportId: 'RP20260602019', patientName: '高志远', modality: 'CT', bodyPart: '头颅',
    reportDoctorId: 'D001', reportDoctorName: '张明远', reportDoctorTitle: '主任医师',
    stage: 'initial', status: 'in-progress', submittedAt: '2026-06-02 15:00:00', deadline: '2026-06-03 18:00:00',
    initialAuditDoctorId: 'D005', initialAuditDoctorName: '刘文博', initialAuditTitle: '副主任医师',
    initialAuditStartAt: '2026-06-02 17:00:00', qualityScore: 95, criticalFinding: true, isOverdue: true, hoursToDeadline: -24 },

  // 待终审 (3) - 初审已完成
  { id: 'rv-007', reportId: 'RP20260602021', patientName: '谢军', modality: 'CT', bodyPart: '胸部',
    reportDoctorId: 'D002', reportDoctorName: '李慧敏', reportDoctorTitle: '副主任医师',
    stage: 'final', status: 'pending', submittedAt: '2026-06-02 09:00:00', deadline: '2026-06-03 09:00:00',
    initialAuditDoctorId: 'D005', initialAuditDoctorName: '刘文博', initialAuditTitle: '副主任医师',
    initialAuditCompletedAt: '2026-06-02 13:00:00', initialAuditSuggestion: '报告规范，建议补充RECIST评估表。', initialAuditScore: 90,
    qualityScore: 92, criticalFinding: false, isOverdue: true, hoursToDeadline: -32 },
  { id: 'rv-008', reportId: 'RP20260602022', patientName: '邓丽娟', modality: 'CT', bodyPart: '腹部',
    reportDoctorId: 'D003', reportDoctorName: '王建华', reportDoctorTitle: '主治医师',
    stage: 'final', status: 'pending', submittedAt: '2026-06-02 14:00:00', deadline: '2026-06-03 14:00:00',
    initialAuditDoctorId: 'D002', initialAuditDoctorName: '李慧敏', initialAuditTitle: '副主任医师',
    initialAuditCompletedAt: '2026-06-02 17:00:00', initialAuditSuggestion: '同意签发。', initialAuditScore: 95,
    qualityScore: 88, criticalFinding: false, isOverdue: true, hoursToDeadline: -30 },
  { id: 'rv-009', reportId: 'RP20260602023', patientName: '彭大伟', modality: 'MR', bodyPart: '脊柱',
    reportDoctorId: 'D004', reportDoctorName: '陈晓燕', reportDoctorTitle: '住院医师',
    stage: 'final', status: 'pending', submittedAt: '2026-06-01 10:00:00', deadline: '2026-06-02 10:00:00',
    initialAuditDoctorId: 'D003', initialAuditDoctorName: '王建华', initialAuditTitle: '主治医师',
    initialAuditCompletedAt: '2026-06-01 14:00:00', initialAuditSuggestion: '同意签发。', initialAuditScore: 92,
    qualityScore: 90, criticalFinding: false, isOverdue: true, hoursToDeadline: -56 },

  // 终审中 (2)
  { id: 'rv-010', reportId: 'RP20260602024', patientName: '苏小英', modality: 'MR', bodyPart: '头颅',
    reportDoctorId: 'D005', reportDoctorName: '刘文博', reportDoctorTitle: '副主任医师',
    stage: 'final', status: 'in-progress', submittedAt: '2026-06-02 08:00:00', deadline: '2026-06-03 08:00:00',
    initialAuditDoctorId: 'D002', initialAuditDoctorName: '李慧敏', initialAuditTitle: '副主任医师',
    initialAuditCompletedAt: '2026-06-02 12:00:00', initialAuditSuggestion: '建议补充MRA描述。', initialAuditScore: 85,
    finalAuditDoctorId: 'D001', finalAuditDoctorName: '张明远', finalAuditTitle: '主任医师',
    finalAuditStartAt: '2026-06-02 16:00:00', qualityScore: 85, criticalFinding: false, isOverdue: true, hoursToDeadline: -8 },
  { id: 'rv-011', reportId: 'RP20260601025', patientName: '潘立新', modality: 'CT', bodyPart: '腹部',
    reportDoctorId: 'D003', reportDoctorName: '王建华', reportDoctorTitle: '主治医师',
    stage: 'final', status: 'in-progress', submittedAt: '2026-06-01 14:00:00', deadline: '2026-06-02 14:00:00',
    initialAuditDoctorId: 'D002', initialAuditDoctorName: '李慧敏', initialAuditTitle: '副主任医师',
    initialAuditCompletedAt: '2026-06-01 17:00:00', initialAuditSuggestion: '同意终审。', initialAuditScore: 95,
    finalAuditDoctorId: 'D006', finalAuditDoctorName: '赵雪琴', finalAuditTitle: '主任医师',
    finalAuditStartAt: '2026-06-02 09:00:00', qualityScore: 90, criticalFinding: false, isOverdue: false, hoursToDeadline: 5 },

  // 待签发 (3) - 双审已完成
  { id: 'rv-012', reportId: 'RP20260601027', patientName: '袁建华', modality: 'CT', bodyPart: '胸部',
    reportDoctorId: 'D002', reportDoctorName: '李慧敏', reportDoctorTitle: '副主任医师',
    stage: 'sign', status: 'pending', submittedAt: '2026-06-01 09:00:00', deadline: '2026-06-02 09:00:00',
    initialAuditDoctorId: 'D005', initialAuditDoctorName: '刘文博', initialAuditTitle: '副主任医师',
    initialAuditCompletedAt: '2026-06-01 12:00:00', initialAuditSuggestion: '同意。', initialAuditScore: 96,
    finalAuditDoctorId: 'D001', finalAuditDoctorName: '张明远', finalAuditTitle: '主任医师',
    finalAuditCompletedAt: '2026-06-01 14:00:00', finalAuditSuggestion: '终审通过，同意签发。', finalAuditScore: 95,
    qualityScore: 95, criticalFinding: false, isOverdue: true, hoursToDeadline: -50 },
  { id: 'rv-013', reportId: 'RP20260601028', patientName: '余小红', modality: 'US', bodyPart: '腹部',
    reportDoctorId: 'D003', reportDoctorName: '王建华', reportDoctorTitle: '主治医师',
    stage: 'sign', status: 'pending', submittedAt: '2026-06-01 10:00:00', deadline: '2026-06-02 10:00:00',
    initialAuditDoctorId: 'D002', initialAuditDoctorName: '李慧敏', initialAuditTitle: '副主任医师',
    initialAuditCompletedAt: '2026-06-01 13:00:00', initialAuditSuggestion: '同意。', initialAuditScore: 94,
    finalAuditDoctorId: 'D006', finalAuditDoctorName: '赵雪琴', finalAuditTitle: '主任医师',
    finalAuditCompletedAt: '2026-06-01 15:00:00', finalAuditSuggestion: '同意签发。', finalAuditScore: 92,
    qualityScore: 92, criticalFinding: false, isOverdue: true, hoursToDeadline: -48 },
  { id: 'rv-014', reportId: 'RP20260531030', patientName: '邱淑芬', modality: 'MR', bodyPart: '脊柱',
    reportDoctorId: 'D004', reportDoctorName: '陈晓燕', reportDoctorTitle: '住院医师',
    stage: 'sign', status: 'pending', submittedAt: '2026-05-31 14:00:00', deadline: '2026-06-01 14:00:00',
    initialAuditDoctorId: 'D003', initialAuditDoctorName: '王建华', initialAuditTitle: '主治医师',
    initialAuditCompletedAt: '2026-05-31 17:00:00', initialAuditSuggestion: '同意。', initialAuditScore: 90,
    finalAuditDoctorId: 'D005', finalAuditDoctorName: '刘文博', finalAuditTitle: '副主任医师',
    finalAuditCompletedAt: '2026-05-31 18:00:00', finalAuditSuggestion: '同意签发。', finalAuditScore: 88,
    qualityScore: 88, criticalFinding: false, isOverdue: true, hoursToDeadline: -56 },

  // 驳回 (2)
  { id: 'rv-015', reportId: 'RP20260514048', patientName: '武志远', modality: 'CT', bodyPart: '胸部',
    reportDoctorId: 'D004', reportDoctorName: '陈晓燕', reportDoctorTitle: '住院医师',
    stage: 'initial', status: 'rejected', submittedAt: '2026-05-14 09:00:00', deadline: '2026-05-15 09:00:00',
    initialAuditDoctorId: 'D003', initialAuditDoctorName: '王建华', initialAuditTitle: '主治医师',
    initialAuditCompletedAt: '2026-05-14 12:00:00',
    rejectedReason: '描述不充分，建议补充病灶形态、密度、边缘特征及与胸膜关系。',
    qualityScore: 60, criticalFinding: false, isOverdue: false, hoursToDeadline: 0 },
  { id: 'rv-016', reportId: 'RP20260513049', patientName: '段丽娟', modality: 'MR', bodyPart: '腹部',
    reportDoctorId: 'D007', reportDoctorName: '孙立军', reportDoctorTitle: '主治医师',
    stage: 'initial', status: 'rejected', submittedAt: '2026-05-13 10:00:00', deadline: '2026-05-14 10:00:00',
    initialAuditDoctorId: 'D005', initialAuditDoctorName: '刘文博', initialAuditTitle: '副主任医师',
    initialAuditCompletedAt: '2026-05-13 13:00:00',
    rejectedReason: '报告过于简单，需补充病灶大小、信号特征、分布等关键信息。',
    qualityScore: 55, criticalFinding: false, isOverdue: false, hoursToDeadline: 0 },
];

// ============================================================
// 修订版本
// ============================================================
export interface ReportRevision {
  id: string;
  reportId: string;
  versionNumber: number;       // v1, v2, v3...
  versionLabel: string;        // v1.0, v1.1, v2.0
  authorId: string;
  authorName: string;
  authorTitle: string;
  action: 'initial' | 'revise' | 'addendum' | 'recall';
  reason: string;              // 修订原因
  changes: RevisionChange[];   // 变更详情
  findings: string;
  diagnosis: string;
  impression: string;
  createdAt: string;
  publishedAt?: string;
  patientNotified: boolean;
}

export interface RevisionChange {
  field: 'findings' | 'diagnosis' | 'impression' | 'recommendation' | 'critical';
  before: string;
  after: string;
  changeType: 'modified' | 'added' | 'deleted';
}

// ============================================================
// 修订链 Mock（针对 rpt-043 已修订报告）
// ============================================================
export const REPORT_REVISIONS: ReportRevision[] = [
  {
    id: 'rev-043-v1', reportId: 'rpt-043', versionNumber: 1, versionLabel: 'v1.0',
    authorId: 'D002', authorName: '李慧敏', authorTitle: '副主任医师',
    action: 'initial', reason: '初次发布',
    changes: [],
    findings: '右肺下叶肿块，大小约3.5cm×3.0cm，伴纵隔多发肿大淋巴结。',
    diagnosis: '右肺下叶周围型肺癌。',
    impression: '右肺下叶周围型肺癌伴纵隔淋巴结转移。',
    createdAt: '2026-05-26 09:00:00', publishedAt: '2026-05-26 15:00:00', patientNotified: true,
  },
  {
    id: 'rev-043-v2', reportId: 'rpt-043', versionNumber: 2, versionLabel: 'v1.1',
    authorId: 'D002', authorName: '李慧敏', authorTitle: '副主任医师',
    action: 'addendum', reason: '病理结果回报（腺癌），补充病理诊断',
    changes: [
      { field: 'diagnosis', before: '右肺下叶周围型肺癌。', after: '右肺下叶周围型肺癌，病理证实为腺癌。', changeType: 'modified' },
      { field: 'impression', before: '右肺下叶周围型肺癌伴纵隔淋巴结转移。', after: '右肺下叶腺癌伴纵隔淋巴结转移。', changeType: 'modified' },
      { field: 'recommendation', before: '', after: '建议肿瘤科会诊，制定化疗方案。', changeType: 'added' },
    ],
    findings: '右肺下叶肿块，大小约3.5cm×3.0cm，伴纵隔多发肿大淋巴结。',
    diagnosis: '右肺下叶周围型肺癌，病理证实为腺癌。',
    impression: '右肺下叶腺癌伴纵隔淋巴结转移。',
    createdAt: '2026-05-28 10:00:00', publishedAt: '2026-05-28 11:00:00', patientNotified: true,
  },
];

export const REPORT_REVISIONS_044: ReportRevision[] = [
  {
    id: 'rev-044-v1', reportId: 'rpt-044', versionNumber: 1, versionLabel: 'v1.0',
    authorId: 'D006', authorName: '赵雪琴', authorTitle: '主任医师',
    action: 'initial', reason: '初次发布',
    changes: [],
    findings: '左乳外上象限见一不规则肿块，大小约2.5cm×2.0cm，T1WI低信号，T2WI高信号，DWI明显弥散受限。',
    diagnosis: '左乳肿块，BI-RADS 5类。',
    impression: '左乳恶性征象肿块，BI-RADS 5类。',
    createdAt: '2026-05-25 10:00:00', publishedAt: '2026-05-25 16:00:00', patientNotified: true,
  },
  {
    id: 'rev-044-v2', reportId: 'rpt-044', versionNumber: 2, versionLabel: 'v1.1',
    authorId: 'D006', authorName: '赵雪琴', authorTitle: '主任医师',
    action: 'revise', reason: '补充免疫组化结果',
    changes: [
      { field: 'impression', before: '左乳恶性征象肿块，BI-RADS 5类。', after: '左乳恶性征象肿块，BI-RADS 5类，ER/PR阳性，HER2阴性，建议新辅助化疗。', changeType: 'modified' },
    ],
    findings: '左乳外上象限见一不规则肿块，大小约2.5cm×2.0cm，T1WI低信号，T2WI高信号，DWI明显弥散受限。',
    diagnosis: '左乳浸润性导管癌（ER/PR阳性，HER2阴性）。',
    impression: '左乳浸润性导管癌，BI-RADS 5类，ER/PR阳性，HER2阴性，建议新辅助化疗。',
    createdAt: '2026-05-27 14:00:00', publishedAt: '2026-05-27 15:00:00', patientNotified: true,
  },
];

// ============================================================
// 协同 Mock 数据
// ============================================================
export interface CollabUser {
  id: string;
  name: string;
  title: string;
  color: string;
  avatar: string;
  status: 'online' | 'away' | 'offline';
  currentPage?: string;
  cursorPos?: { x: number; y: number };
  selectionRange?: { start: number; end: number };
}

export interface CollabComment {
  id: string;
  reportId: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  content: string;
  fieldRef?: string;          // 关联的字段
  selectionRef?: string;     // 关联的选区
  position: { x: number; y: number };
  resolved: boolean;
  parentId?: string;         // 回复的父评论
  mentions: string[];         // @ 提及用户
  createdAt: string;
}

export interface CollabActivity {
  id: string;
  reportId: string;
  userId: string;
  userName: string;
  action: 'join' | 'leave' | 'edit' | 'comment' | 'select' | 'mention' | 'save';
  detail: string;
  timestamp: string;
}

// 在线协同用户
export const COLLAB_USERS: CollabUser[] = [
  { id: 'D001', name: '张明远', title: '主任医师', color: 'var(--color-error-600)', avatar: '张', status: 'online', currentPage: '/report-write-v2/rpt-013', cursorPos: { x: 320, y: 240 } },
  { id: 'D002', name: '李慧敏', title: '副主任医师', color: '#7c3aed', avatar: '李', status: 'online', currentPage: '/report-write-v2/rpt-013', cursorPos: { x: 480, y: 320 } },
  { id: 'D005', name: '刘文博', title: '副主任医师', color: 'var(--color-info-600)', avatar: '刘', status: 'online', currentPage: '/report-write-v2/rpt-018', cursorPos: { x: 180, y: 160 } },
  { id: 'D006', name: '赵雪琴', title: '主任医师', color: '#10b981', avatar: '赵', status: 'away', currentPage: '/report-write-v2/rpt-018' },
  { id: 'D003', name: '王建华', title: '主治医师', color: 'var(--color-warning-500)', avatar: '王', status: 'offline' },
  { id: 'D004', name: '陈晓燕', title: '住院医师', color: '#a855f7', avatar: '陈', status: 'online', currentPage: '/report-write-v2/rpt-009' },
];

// 协同评论
export const COLLAB_COMMENTS: CollabComment[] = [
  {
    id: 'cmt-001', reportId: 'rpt-013', authorId: 'D001', authorName: '张明远', authorColor: 'var(--color-error-600)',
    content: '右肺下叶肿块的强化特征建议补充"不均匀强化"的具体描述。',
    fieldRef: 'findings', selectionRef: '增强扫描示不均匀强化',
    position: { x: 120, y: 280 }, resolved: false,
    mentions: ['D002'], createdAt: '2026-06-04 10:30:00',
  },
  {
    id: 'cmt-002', reportId: 'rpt-013', authorId: 'D001', authorName: '张明远', authorColor: 'var(--color-error-600)',
    content: '@李慧敏 这里建议增加"与周围血管关系"的描述',
    fieldRef: 'findings',
    position: { x: 220, y: 320 }, resolved: false,
    parentId: 'cmt-001', mentions: ['D002'], createdAt: '2026-06-04 10:32:00',
  },
  {
    id: 'cmt-003', reportId: 'rpt-013', authorId: 'D002', authorName: '李慧敏', authorColor: '#7c3aed',
    content: '已修改，补充了与肺门血管的关系描述。',
    fieldRef: 'findings',
    position: { x: 280, y: 360 }, resolved: true,
    mentions: ['D001'], createdAt: '2026-06-04 10:35:00',
  },
  {
    id: 'cmt-004', reportId: 'rpt-018', authorId: 'D005', authorName: '刘文博', authorColor: 'var(--color-info-600)',
    content: 'BI-RADS 5 类建议明确具体可疑征象的个数。',
    fieldRef: 'impression',
    position: { x: 350, y: 420 }, resolved: false,
    mentions: ['D006'], createdAt: '2026-06-04 10:45:00',
  },
];

// 协同活动
export const COLLAB_ACTIVITIES: CollabActivity[] = [
  { id: 'act-001', reportId: 'rpt-013', userId: 'D001', userName: '张明远', action: 'join', detail: '加入协同编辑', timestamp: '2026-06-04 10:25:00' },
  { id: 'act-002', reportId: 'rpt-013', userId: 'D002', userName: '李慧敏', action: 'edit', detail: '编辑"检查所见"段', timestamp: '2026-06-04 10:27:00' },
  { id: 'act-003', reportId: 'rpt-013', userId: 'D001', userName: '张明远', action: 'comment', detail: '添加评论', timestamp: '2026-06-04 10:30:00' },
  { id: 'act-004', reportId: 'rpt-013', userId: 'D001', userName: '张明远', action: 'mention', detail: '@李慧敏 提醒查看', timestamp: '2026-06-04 10:32:00' },
  { id: 'act-005', reportId: 'rpt-013', userId: 'D002', userName: '李慧敏', action: 'edit', detail: '补充"血管关系"描述', timestamp: '2026-06-04 10:35:00' },
  { id: 'act-006', reportId: 'rpt-018', userId: 'D005', userName: '刘文博', action: 'join', detail: '加入协同编辑', timestamp: '2026-06-04 10:40:00' },
  { id: 'act-007', reportId: 'rpt-018', userId: 'D006', userName: '赵雪琴', action: 'select', detail: '选中"BI-RADS 5类"段落', timestamp: '2026-06-04 10:42:00' },
  { id: 'act-008', reportId: 'rpt-018', userId: 'D005', userName: '刘文博', action: 'comment', detail: '添加评论', timestamp: '2026-06-04 10:45:00' },
  { id: 'act-009', reportId: 'rpt-013', userId: 'D002', userName: '李慧敏', action: 'save', detail: '保存草稿', timestamp: '2026-06-04 10:50:00' },
];

// ============================================================
// 审核统计
// ============================================================
export interface ReviewKPI {
  totalToday: number;
  pendingInitial: number;
  inProgressInitial: number;
  pendingFinal: number;
  inProgressFinal: number;
  pendingSign: number;
  rejected: number;
  overdue: number;
  completedToday: number;
  avgInitialAuditHours: number;
  avgFinalAuditHours: number;
  onTimeRate: number;
  rejectionRate: number;
}

export const REVIEW_KPI: ReviewKPI = {
  totalToday: 16,
  pendingInitial: 3,
  inProgressInitial: 3,
  pendingFinal: 3,
  inProgressFinal: 2,
  pendingSign: 3,
  rejected: 2,
  overdue: 6,
  completedToday: 8,
  avgInitialAuditHours: 1.8,
  avgFinalAuditHours: 1.2,
  onTimeRate: 87.5,
  rejectionRate: 12.5,
};

export default {
  REVIEW_TASKS,
  REPORT_REVISIONS,
  REPORT_REVISIONS_044,
  COLLAB_USERS,
  COLLAB_COMMENTS,
  COLLAB_ACTIVITIES,
  REVIEW_KPI,
};
