/**
 * G005 放射RIS系统 v3.0.5.1 - R3.AMEND 修订 类型定义
 * A5-REPORT 模块 / 100 点
 *
 * 覆盖:
 *  - 修订入口 + 启动 (.001 ~ .020)
 *  - 修订编辑 + 提交 (.021 ~ .045)
 *  - 补充流程 (.046 ~ .065)
 *  - 修订追溯 + KPI (.066 ~ .085)
 *  - 特殊修订场景 (.086 ~ .100)
 */

export type AmendAction =
  | 'start'
  | 'edit'
  | 'approve'
  | 'reject'
  | 'cosign'
  | 'complete'
  | 'abandon'
  | 'publish'
  | 'rollback'
  | 'supplement';

export type AmendReasonCategory =
  | 'description-unclear'
  | 'terminology-error'
  | 'left-right-confused'
  | 'missing-key-finding'
  | 'image-mismatch'
  | 'missing-recommendation'
  | 'critical-not-marked'
  | 'other';

export const AMEND_REASON_CATEGORIES: { id: AmendReasonCategory; label: string; color: string }[] = [
  { id: 'description-unclear', label: '描述不清', color: '#f59e0b' },
  { id: 'terminology-error', label: '术语错误', color: '#ef4444' },
  { id: 'left-right-confused', label: '左右混淆', color: '#dc2626' },
  { id: 'missing-key-finding', label: '缺关键所见', color: '#7c2d12' },
  { id: 'image-mismatch', label: '与图不符', color: '#b91c1c' },
  { id: 'missing-recommendation', label: '缺建议', color: '#a16207' },
  { id: 'critical-not-marked', label: '危急值未标', color: '#991b1b' },
  { id: 'other', label: '其他', color: '#6b7280' },
];

export type SupplementType =
  | 'pathology'
  | 'comparison-prior'
  | 'follow-up'
  | 'addendum'
  | 'consultation'
  | 'lab-result';

export const SUPPLEMENT_TYPES: { id: SupplementType; label: string; icon: string }[] = [
  { id: 'pathology', label: '病理回报', icon: '🔬' },
  { id: 'comparison-prior', label: '对比片', icon: '🖼️' },
  { id: 'follow-up', label: '随访结果', icon: '🔄' },
  { id: 'addendum', label: '补充说明', icon: '📝' },
  { id: 'consultation', label: '会诊意见见', icon: '👥' },
  { id: 'lab-result', label: '实验室结果', icon: '🧪' },
];

export const AMEND_COUNT_LIMIT = 3;
export const AMEND_TIMEOUT_HOURS = 24;
export const AMEND_MIN_REASON_LENGTH = 10;
export const SUPPLEMENT_MIN_NOTE_LENGTH = 20;
export const SUPPLEMENT_COUNT_LIMIT = 3;

export interface RevisionEntry {
  id: string;
  reportId: string;
  version: number;
  action: AmendAction;
  reason: string;
  reasonCategory?: AmendReasonCategory;
  authorId: string;
  authorName: string;
  authorTitle: string;
  createdAt: string;
  diff?: VersionDiff;
  preSnapshot?: ReportSnapshot;
  postSnapshot?: ReportSnapshot;
  approvalId?: string;
  cosignId?: string;
  reSignedAt?: string;
  reSignCertificateSerial?: string;
  parentVersion?: number;
}

export interface ReportSnapshot {
  version: number;
  examFindings: string;
  diagnosis: string;
  impression: string;
  recommendations?: string;
  qualityScore: number;
  signedAt?: string;
  signatureValue?: string;
  certificateSerial?: string;
  capturedAt: string;
}

export interface VersionDiff {
  id: string;
  fromVersion: number;
  toVersion: number;
  fields: FieldDiff[];
  totalChanges: number;
  addedChars: number;
  removedChars: number;
  computedAt: string;
}

export interface FieldDiff {
  field: 'examFindings' | 'diagnosis' | 'impression' | 'recommendations';
  before: string;
  after: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

export interface DiffHunk {
  type: 'equal' | 'insert' | 'delete';
  text: string;
}

export type AmendApprovalStatus = 'pending' | 'approved' | 'rejected' | 'auto-approved';

export interface AmendApproval {
  id: string;
  revisionId: string;
  reportId: string;
  reason: string;
  requesterId: string;
  requesterName: string;
  approverId?: string;
  approverName?: string;
  approverTitle?: string;
  approvedAt?: string;
  rejectedReason?: string;
  status: AmendApprovalStatus;
  isAutoApprove: boolean;
  createdAt: string;
}

export interface AmendmentChainNode {
  id: string;
  version: number;
  authorName: string;
  authorTitle: string;
  action: AmendAction;
  reason: string;
  createdAt: string;
  isCurrent: boolean;
  hasCoSign: boolean;
  hasApproval: boolean;
}

export interface AmendmentChecklist {
  reasonRecorded: boolean;
  preSnapshotCaptured: boolean;
  fieldLimitsRespected: boolean;
  qualityScoreRecomputed: boolean;
  approvalObtained: boolean;
  notificationSent: boolean;
}

export const AMEND_CHECKLIST_ITEMS: { key: keyof AmendmentChecklist; label: string }[] = [
  { key: 'reasonRecorded', label: '修订原因已记录 (≥10 字符)' },
  { key: 'preSnapshotCaptured', label: '修订前快照已保存' },
  { key: 'fieldLimitsRespected', label: '不可改字段已锁定（姓名/ID）' },
  { key: 'qualityScoreRecomputed', label: '质量分已重新计算' },
  { key: 'approvalObtained', label: '修订审批通过' },
  { key: 'notificationSent', label: '相关方通知已发送' },
];

export interface SupplementAttachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface SupplementEntry {
  id: string;
  reportId: string;
  type: SupplementType;
  note: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  attachments: SupplementAttachment[];
  isCriticalLateMark: boolean;
  isMissedDx: boolean;
  reSignedAt?: string;
  publishedAt?: string;
}

export interface AmendmentKPI {
  period: 'today' | 'week' | 'month';
  totalAmendments: number;
  totalSupplements: number;
  avgAmendmentDurationHours: number;
  amendmentRate: number;
  reasonsBreakdown: Record<AmendReasonCategory, number>;
}

export interface AmendmentCompliance {
  reportId: string;
  allSnapshotsRetained: boolean;
  signaturesPreserved: boolean;
  auditChainIntact: boolean;
  reasonCompliant: boolean;
  approvedWhenRequired: boolean;
}

export type PathologyIcdOCode = {
  morphology: string;
  topography: string;
  behavior: 'benign' | 'uncertain' | 'malignant';
};

export type DisclaimerType =
  | 'late-amend'
  | 'missed-dx'
  | 'critical-late'
  | 'amend-after-publish'
  | 'cosign-amend'
  | 'patient-visible';

export const DISCLAIMER_TYPES: { id: DisclaimerType; label: string; template: string }[] = [
  {
    id: 'late-amend',
    label: '延迟修订',
    template: '本修订因临床补充信息于发布后 {hours} 小时追加，已通知相关临床科室。',
  },
  {
    id: 'missed-dx',
    label: '漏诊修订',
    template: '本次修订为漏诊修正，已按危急值流程通知申请医师与科主任。',
  },
  {
    id: 'critical-late',
    label: '危急值补登',
    template: '本次修订为危急值补登，已完成科主任审批与双签。',
  },
  {
    id: 'amend-after-publish',
    label: '发布后修订',
    template: '原报告已于 {publishedAt} 发布，本次修订保留原签名并附加修订版本。',
  },
  {
    id: 'cosign-amend',
    label: '双签修订',
    template: '本次修订由原作者与科主任双签确认。',
  },
  {
    id: 'patient-visible',
    label: '患者可见',
    template: '修订内容已同步至患者端，医师已通过 {channel} 通知患者。',
  },
];