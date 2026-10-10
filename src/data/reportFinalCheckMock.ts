/**
 * G005 RIS v3.0.5.1 - R3.REVIEW FINAL CHECK 终核 Mock 数据
 * 80 点 (15+ 检查项 / 临床一致性 / 终评 / 双驳回 / 笔记 / 工作量 / 既往 / 多签 / 急诊 / 工作流)
 */
import type {
  FinalCheckItem,
  FinalCheckList,
  FinalCheckSummary,
  FinalCheckCategory,
  FinalCheckStatus,
  FinalCheckSeverity,
  ClinicalConsistencyCheck,
  FinalScoringRubric,
  FinalScoringResult,
  FinalReviewNote,
  FinalCheckWorkload,
  PriorReportComparison,
  FinalMultiSignatureRequest,
  EmergencyReviewRequest,
  FinalCheckWorkflowConfig,
  FinalCheckEvent,
} from '../types/R3/R3.REVIEW.FINAL';

const now = new Date();
const isoOffset = (hours: number) => new Date(now.getTime() + hours * 3600 * 1000).toISOString();

// ============= 17 个标准终核项 (R3.REVIEW.201 ~ R3.REVIEW.217) =============
const buildCheckItem = (
  code: string,
  category: FinalCheckCategory,
  title: string,
  description: string,
  status: FinalCheckStatus = 'pending',
  severity: FinalCheckSeverity = 'minor',
  weight = 5,
  maxScore = 5,
  evidence?: string,
  autoCheckable = true,
  mandatory = true,
): FinalCheckItem => ({
  id: `fci-${code}`,
  code,
  category,
  title,
  description,
  status,
  severity,
  weight,
  score: status === 'passed' ? maxScore : 0,
  maxScore,
  evidence,
  autoCheckable,
  mandatory,
});

export const FINAL_CHECK_TEMPLATES: FinalCheckItem[] = [
  buildCheckItem('FCHK-001', 'demographics', '患者人口学核对', '姓名/性别/年龄/ID/检查号与申请单一致', 'passed', 'blocker', 6, 6, '患者 黄海涛 男 58 住院号 P-100023 一致', true, true),
  buildCheckItem('FCHK-002', 'clinical-history', '临床病史一致性', '主诉/现病史/检查目的与临床诊断符合', 'passed', 'major', 5, 5, '主诉 咳嗽 1 月 与胸部 CT 检查目的符合', true, true),
  buildCheckItem('FCHK-003', 'image-quality', '影像质量评估', '图像无运动伪影/可评估序列完整', 'warning', 'major', 5, 5, '序列 5 呼吸运动伪影偏大但可评估', true, true),
  buildCheckItem('FCHK-004', 'image-consistency', '图像所见一致性', '报告描述与 PACS 影像所见一致', 'passed', 'blocker', 8, 8, '所见与图像逐项比对一致', true, true),
  buildCheckItem('FCHK-005', 'findings-completeness', '关键所见完整性', '包含部位/形态/大小/密度/边缘/周围关系 6 要素', 'warning', 'major', 7, 7, '建议补充肿块与胸膜关系', true, true),
  buildCheckItem('FCHK-006', 'diagnosis-accuracy', '诊断准确性', '诊断结论与影像所见逻辑自洽', 'passed', 'critical', 9, 9, '诊断 左肺下叶周围型肺癌 与所见一致', true, true),
  buildCheckItem('FCHK-007', 'critical-marking', '危急值标注', '危急发现按规范醒目标注', 'passed', 'blocker', 10, 10, '已按 Critical 标注', true, true),
  buildCheckItem('FCHK-008', 'laterality', '左右侧核对', '报告中左右侧描述与图像符合', 'passed', 'blocker', 8, 8, '左肺下叶 与图像一致', true, true),
  buildCheckItem('FCHK-009', 'modality-consistency', '检查方式一致性', '报告模态与申请检查方式一致', 'passed', 'minor', 4, 4, 'CT 胸部平扫+增强 与申请一致', true, true),
  buildCheckItem('FCHK-010', 'icd-coding', 'ICD-10 编码', '主诊断 ICD-10 编码有效', 'passed', 'major', 5, 5, 'C34.31 下叶支气管或肺', true, true),
  buildCheckItem('FCHK-011', 'recommendation', '建议完整性', '包含随访/进一步检查/治疗建议', 'warning', 'minor', 4, 4, '建议补充进一步检查建议', true, true),
  buildCheckItem('FCHK-012', 'prior-comparison', '既往报告对比', '与既往同部位报告进行对比描述', 'skipped', 'minor', 3, 3, '该患者无既往同部位检查', true, false),
  buildCheckItem('FCHK-013', 'signature', '签章合规', '数字签名/时间戳完整可验证', 'passed', 'critical', 6, 6, '数字证书 SM2 签名通过', true, true),
  buildCheckItem('FCHK-014', 'confidentiality', '隐私保护', '敏感字段已脱敏', 'passed', 'major', 5, 5, '姓名/ID 已脱敏', true, true),
  buildCheckItem('FCHK-015', 'terminology', '术语规范化', '使用 RadLex/ICD 标准术语', 'passed', 'minor', 3, 3, '符合 WS/T 500-2016', true, true),
  buildCheckItem('FCHK-016', 'grammar', '语法/拼写', '无错别字/语法错误', 'passed', 'minor', 2, 2, '人工复核通过', false, true),
  buildCheckItem('FCHK-017', 'quality-score', '质量评分达标', '总评分 >= 60', 'pending', 'blocker', 8, 8, undefined, true, true),
  buildCheckItem('FCHK-018', 'audit-trail', '审计链完整', '从提交到终审全链路 hash 校验通过', 'pending', 'critical', 6, 6, undefined, true, true),
];

export const buildSummary = (items: FinalCheckItem[]): FinalCheckSummary => {
  const total = items.length;
  const passed = items.filter((i) => i.status === 'passed').length;
  const failed = items.filter((i) => i.status === 'failed').length;
  const warning = items.filter((i) => i.status === 'warning').length;
  const skipped = items.filter((i) => i.status === 'skipped').length;
  const totalScore = items.reduce((a, i) => a + i.score, 0);
  const maxScore = items.reduce((a, i) => a + i.maxScore, 0);
  const percentage = maxScore === 0 ? 0 : Math.round((totalScore / maxScore) * 100);
  const grade: FinalCheckSummary['grade'] = percentage >= 90 ? 'A' : percentage >= 80 ? 'B' : percentage >= 70 ? 'C' : percentage >= 60 ? 'D' : 'F';
  const blockers = items.filter((i) => i.status === 'failed' && (i.severity === 'blocker' || i.severity === 'critical')).length;
  const mandatoryPending = items.filter((i) => i.mandatory && i.status === 'pending').length;
  return {
    total,
    passed,
    failed,
    warning,
    skipped,
    totalScore,
    maxScore,
    percentage,
    grade,
    blockers,
    mandatoryPending,
    isPublishable: blockers === 0 && mandatoryPending === 0 && percentage >= 60,
  };
};

export const FINAL_CHECK_LISTS: FinalCheckList[] = [
  {
    id: 'fcl-rt-001',
    reportId: 'RP20260615001',
    patientId: 'P-100023',
    taskId: 'rt-001',
    reviewerId: 'D001',
    reviewerName: '张明远',
    reviewerRole: 'chief',
    items: FINAL_CHECK_TEMPLATES.map((it, idx) => ({
      ...it,
      status: (idx < 11 ? 'passed' : idx < 14 ? 'warning' : idx < 15 ? 'skipped' : 'passed') as FinalCheckStatus,
      checkedBy: 'D001',
      checkedAt: isoOffset(-0.2),
    })),
    summary: buildSummary(
      FINAL_CHECK_TEMPLATES.map((it, idx) => ({
        ...it,
        status: (idx < 11 ? 'passed' : idx < 14 ? 'warning' : idx < 15 ? 'skipped' : 'passed') as FinalCheckStatus,
      })),
    ),
    status: 'in-progress',
    startedAt: isoOffset(-0.5),
    totalDurationMs: 18 * 60 * 1000,
    rubricVersion: 'v3.0.5.1',
  },
  {
    id: 'fcl-rt-002',
    reportId: 'RP20260615002',
    patientId: 'P-100024',
    taskId: 'rt-002',
    reviewerId: 'D005',
    reviewerName: '刘文博',
    reviewerRole: 'associateChief',
    items: FINAL_CHECK_TEMPLATES.map((it) => ({ ...it, status: 'passed' as FinalCheckStatus, checkedBy: 'D005', checkedAt: isoOffset(-0.3) })),
    summary: buildSummary(FINAL_CHECK_TEMPLATES.map((it) => ({ ...it, status: 'passed' as FinalCheckStatus }))),
    status: 'completed',
    startedAt: isoOffset(-0.6),
    completedAt: isoOffset(-0.1),
    totalDurationMs: 30 * 60 * 1000,
    rubricVersion: 'v3.0.5.1',
  },
  {
    id: 'fcl-rt-003',
    reportId: 'RP20260615003',
    patientId: 'P-100025',
    taskId: 'rt-003',
    reviewerId: 'D001',
    reviewerName: '张明远',
    reviewerRole: 'chief',
    items: FINAL_CHECK_TEMPLATES.map((it, idx) => ({
      ...it,
      status: (idx === 6 ? 'failed' : idx < 12 ? 'passed' : 'pending') as FinalCheckStatus,
      checkedBy: 'D001',
      checkedAt: isoOffset(-0.4),
    })),
    summary: buildSummary(
      FINAL_CHECK_TEMPLATES.map((it, idx) => ({
        ...it,
        status: (idx === 6 ? 'failed' : idx < 12 ? 'passed' : 'pending') as FinalCheckStatus,
      })),
    ),
    status: 'in-progress',
    startedAt: isoOffset(-0.4),
    totalDurationMs: 12 * 60 * 1000,
    rubricVersion: 'v3.0.5.1',
  },
];

// ============= 临床一致性 =============
export const CLINICAL_CONSISTENCY_RESULTS: ClinicalConsistencyCheck[] = [
  {
    id: 'cc-001',
    reportId: 'RP20260615001',
    patientId: 'P-100023',
    patientName: '黄海涛',
    checkedAt: isoOffset(-0.2),
    overallScore: 0.92,
    consistencyLevel: 'good',
    dimensions: [
      { code: 'D-IMG', name: '图像-报告一致性', score: 0.95, status: 'consistent', findings: ['所见 12 项与图像一致 12 项'] },
      { code: 'D-HIS', name: 'HIS 病史一致性', score: 0.93, status: 'consistent', findings: ['主诉 1 项 符合', '检验 3 项关联'] },
      { code: 'D-PRIOR', name: '既往报告一致性', score: 0.85, status: 'minor-deviation', findings: ['与 2025-11 同部位检查存在病灶增大', '已注明' ] },
      { code: 'D-CRIT', name: '危急值一致性', score: 1.0, status: 'consistent', findings: ['危急值标注与建议一致'] },
    ],
    contradictions: [
      { field: 'history.clinicalIndication', reported: '咳嗽 1 月', expected: '咳嗽 1 月余', severity: 'minor', autoDetected: true },
    ],
    crossReference: [
      { source: 'PACS', matched: true, detail: 'Study UID 1.2.840.0.1 匹配 12/12' },
      { source: 'HIS', matched: true, detail: 'Order 100023 匹配' },
      { source: 'EHR', matched: true, detail: '既往诊断 J98.414' },
      { source: 'prior', matched: true, detail: '2025-11-02 CT 对比存在' },
      { source: 'critical', matched: true, detail: '危急值通报 1 条' },
    ],
    aiConfidence: 0.92,
  },
  {
    id: 'cc-002',
    reportId: 'RP20260615002',
    patientId: 'P-100024',
    patientName: '徐丽华',
    checkedAt: isoOffset(-0.4),
    overallScore: 0.97,
    consistencyLevel: 'excellent',
    dimensions: [
      { code: 'D-IMG', name: '图像-报告一致性', score: 0.99, status: 'consistent', findings: ['所见 8 项与图像一致 8 项'] },
      { code: 'D-HIS', name: 'HIS 病史一致性', score: 0.95, status: 'consistent', findings: ['主诉符合'] },
      { code: 'D-PRIOR', name: '既往报告一致性', score: 0.96, status: 'consistent', findings: ['无既往'] },
      { code: 'D-CRIT', name: '危急值一致性', score: 1.0, status: 'consistent', findings: [] },
    ],
    contradictions: [],
    crossReference: [
      { source: 'PACS', matched: true, detail: '匹配' },
      { source: 'HIS', matched: true, detail: '匹配' },
      { source: 'EHR', matched: true, detail: '匹配' },
      { source: 'prior', matched: true, detail: '无既往' },
      { source: 'critical', matched: true, detail: '无危急值' },
    ],
    aiConfidence: 0.97,
  },
];

// ============= 终评 rubric & 结果 =============
export const FINAL_SCORING_RUBRICS: FinalScoringRubric[] = [
  {
    id: 'rubric-default',
    name: '终核标准评分 v3',
    version: 'v3.0.5.1',
    totalWeight: 100,
    dimensions: [
      { code: 'D-IMG', name: '图像-报告一致性', weight: 25, criteria: [{ code: 'C-IMG-1', description: '所见 6 要素完整', maxScore: 15 }, { code: 'C-IMG-2', description: '诊断与所见自洽', maxScore: 10 }] },
      { code: 'D-DIAG', name: '诊断准确性', weight: 25, criteria: [{ code: 'C-DIAG-1', description: '主诊断准确', maxScore: 15 }, { code: 'C-DIAG-2', description: '鉴别诊断合理', maxScore: 10 }] },
      { code: 'D-TERM', name: '术语规范性', weight: 15, criteria: [{ code: 'C-TERM-1', description: 'RadLex/ICD 标准', maxScore: 8 }, { code: 'C-TERM-2', description: '缩写规范', maxScore: 7 }] },
      { code: 'D-CRIT', name: '危急值管控', weight: 15, criteria: [{ code: 'C-CRIT-1', description: '危急值标注', maxScore: 8 }, { code: 'C-CRIT-2', description: '通报及时', maxScore: 7 }] },
      { code: 'D-FMT', name: '格式规范', weight: 10, criteria: [{ code: 'C-FMT-1', description: '模板/结构', maxScore: 5 }, { code: 'C-FMT-2', description: '语法拼写', maxScore: 5 }] },
      { code: 'D-AUDIT', name: '审计合规', weight: 10, criteria: [{ code: 'C-AUDIT-1', description: '签章完整', maxScore: 5 }, { code: 'C-AUDIT-2', description: '审计链', maxScore: 5 }] },
    ],
    gradeBands: [
      { grade: 'A', minScore: 90, maxScore: 100, color: '#10b981', label: '优秀' },
      { grade: 'B', minScore: 80, maxScore: 89, color: 'var(--color-primary-500)', label: '良好' },
      { grade: 'C', minScore: 70, maxScore: 79, color: 'var(--color-warning-500)', label: '合格' },
      { grade: 'D', minScore: 60, maxScore: 69, color: '#fb923c', label: '临界' },
      { grade: 'F', minScore: 0, maxScore: 59, color: 'var(--color-error-600)', label: '不合格' },
    ],
    passingScore: 60,
    blockingScore: 40,
    isDefault: true,
  },
];

export const FINAL_SCORING_RESULTS: FinalScoringResult[] = [
  {
    id: 'fscore-001',
    reportId: 'RP20260615001',
    taskId: 'rt-001',
    rubricId: 'rubric-default',
    rubricVersion: 'v3.0.5.1',
    reviewerId: 'D001',
    reviewerName: '张明远',
    totalScore: 92,
    percentage: 92,
    grade: 'A',
    passed: true,
    blocked: false,
    dimensionScores: [
      { code: 'D-IMG', name: '图像-报告一致性', score: 95, weight: 25, weighted: 23.75 },
      { code: 'D-DIAG', name: '诊断准确性', score: 92, weight: 25, weighted: 23.0 },
      { code: 'D-TERM', name: '术语规范性', score: 90, weight: 15, weighted: 13.5 },
      { code: 'D-CRIT', name: '危急值管控', score: 95, weight: 15, weighted: 14.25 },
      { code: 'D-FMT', name: '格式规范', score: 88, weight: 10, weighted: 8.8 },
      { code: 'D-AUDIT', name: '审计合规', score: 87, weight: 10, weighted: 8.7 },
    ],
    hardFailures: [],
    softWarnings: ['建议补充病灶与胸膜关系描述'],
    deltaFromInitial: 4,
    scoredAt: isoOffset(-0.2),
    durationMs: 18 * 60 * 1000,
  },
  {
    id: 'fscore-002',
    reportId: 'RP20260615003',
    taskId: 'rt-003',
    rubricId: 'rubric-default',
    rubricVersion: 'v3.0.5.1',
    reviewerId: 'D001',
    reviewerName: '张明远',
    totalScore: 48,
    percentage: 48,
    grade: 'F',
    passed: false,
    blocked: true,
    dimensionScores: [
      { code: 'D-IMG', name: '图像-报告一致性', score: 60, weight: 25, weighted: 15.0 },
      { code: 'D-DIAG', name: '诊断准确性', score: 55, weight: 25, weighted: 13.75 },
      { code: 'D-TERM', name: '术语规范性', score: 65, weight: 15, weighted: 9.75 },
      { code: 'D-CRIT', name: '危急值管控', score: 0, weight: 15, weighted: 0 },
      { code: 'D-FMT', name: '格式规范', score: 50, weight: 10, weighted: 5.0 },
      { code: 'D-AUDIT', name: '审计合规', score: 45, weight: 10, weighted: 4.5 },
    ],
    hardFailures: ['FCHK-007 危急值未标注', 'FCHK-017 质量评分不达标'],
    softWarnings: ['FCHK-005 所见要素不全'],
    deltaFromInitial: -32,
    scoredAt: isoOffset(-0.4),
    durationMs: 12 * 60 * 1000,
  },
];

// ============= 终审笔记 =============
export const FINAL_REVIEW_NOTES: FinalReviewNote[] = [
  {
    id: 'frn-001', taskId: 'rt-001', reportId: 'RP20260615001',
    authorId: 'D001', authorName: '张明远', authorRole: 'chief',
    content: '终核通过:整体描述规范,诊断明确,危急值标注到位。建议作者后续补充 Lung-RADS 分类以提升结构化程度。',
    type: 'directive', pinned: true, visibility: 'department', mentions: ['D002'],
    attachments: [], createdAt: isoOffset(-0.2),
  },
  {
    id: 'frn-002', taskId: 'rt-001', reportId: 'RP20260615001',
    authorId: 'D001', authorName: '张明远', authorRole: 'chief',
    content: '@李慧敏 建议下次报告增加肿块增强后 CT 值变化描述。',
    type: 'suggestion', pinned: false, visibility: 'team', mentions: ['D002'],
    attachments: [], createdAt: isoOffset(-0.18),
  },
  {
    id: 'frn-003', taskId: 'rt-003', reportId: 'RP20260615003',
    authorId: 'D001', authorName: '张明远', authorRole: 'chief',
    content: '驳回:危急值未按规范标注,已直接退回起草环节,请重新阅片后提交。',
    type: 'warning', pinned: true, visibility: 'all', mentions: ['D001'],
    attachments: [], createdAt: isoOffset(-0.4),
  },
];

// ============= 终核工作量 =============
export const FINAL_CHECK_WORKLOAD: FinalCheckWorkload[] = [
  {
    reviewerId: 'D001', reviewerName: '张明远', reviewerTitle: 'chief', reviewerStatus: 'online', date: '2026-06-17',
    totalFinalChecks: 18, passedFirstTime: 14, rejectedCount: 4, rejectedToInitial: 2, rejectedToDraft: 2,
    averageDurationMin: 18, medianDurationMin: 15, p95DurationMin: 32, onTimeRate: 96.5, blockerRate: 4.5, averageScore: 88.2,
    byModality: [
      { modality: 'CT', count: 10, avgScore: 90 },
      { modality: 'MR', count: 5, avgScore: 87 },
      { modality: 'DR', count: 2, avgScore: 85 },
      { modality: 'US', count: 1, avgScore: 80 },
    ],
    byPriority: [
      { priority: 'stat', count: 4, avgScore: 92 },
      { priority: 'urgent', count: 6, avgScore: 89 },
      { priority: 'routine', count: 8, avgScore: 85 },
    ],
    hourlyDistribution: Array.from({ length: 12 }, (_, i) => ({ hour: 8 + i, count: i < 2 ? 0 : Math.max(0, 3 - Math.abs(i - 4)) })),
    trend: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(now.getTime() - (6 - i) * 86400000).toISOString().slice(0, 10),
      count: 12 + (i % 3) * 2, avgScore: 84 + i, rejected: i % 4 === 3 ? 2 : 0,
    })),
  },
  {
    reviewerId: 'D002', reviewerName: '李慧敏', reviewerTitle: 'associateChief', reviewerStatus: 'online', date: '2026-06-17',
    totalFinalChecks: 15, passedFirstTime: 12, rejectedCount: 3, rejectedToInitial: 2, rejectedToDraft: 1,
    averageDurationMin: 16, medianDurationMin: 14, p95DurationMin: 28, onTimeRate: 94.0, blockerRate: 6.0, averageScore: 86.5,
    byModality: [
      { modality: 'CT', count: 8, avgScore: 88 },
      { modality: 'MR', count: 5, avgScore: 85 },
      { modality: 'US', count: 2, avgScore: 80 },
    ],
    byPriority: [
      { priority: 'stat', count: 3, avgScore: 90 },
      { priority: 'urgent', count: 5, avgScore: 87 },
      { priority: 'routine', count: 7, avgScore: 84 },
    ],
    hourlyDistribution: Array.from({ length: 12 }, (_, i) => ({ hour: 8 + i, count: Math.max(0, 2 - Math.abs(i - 5)) })),
    trend: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(now.getTime() - (6 - i) * 86400000).toISOString().slice(0, 10),
      count: 10 + (i % 3), avgScore: 83 + i, rejected: i % 4 === 2 ? 1 : 0,
    })),
  },
  {
    reviewerId: 'D006', reviewerName: '赵雪琴', reviewerTitle: 'chief', reviewerStatus: 'away', date: '2026-06-17',
    totalFinalChecks: 12, passedFirstTime: 11, rejectedCount: 1, rejectedToInitial: 1, rejectedToDraft: 0,
    averageDurationMin: 22, medianDurationMin: 20, p95DurationMin: 38, onTimeRate: 97.5, blockerRate: 2.0, averageScore: 92.0,
    byModality: [
      { modality: 'CT', count: 6, avgScore: 93 },
      { modality: 'MR', count: 4, avgScore: 91 },
      { modality: 'MG', count: 2, avgScore: 92 },
    ],
    byPriority: [
      { priority: 'stat', count: 2, avgScore: 95 },
      { priority: 'urgent', count: 4, avgScore: 92 },
      { priority: 'routine', count: 6, avgScore: 90 },
    ],
    hourlyDistribution: Array.from({ length: 12 }, (_, i) => ({ hour: 8 + i, count: Math.max(0, 1 + (i % 4 === 0 ? 1 : 0) - Math.abs(i - 3)) })),
    trend: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(now.getTime() - (6 - i) * 86400000).toISOString().slice(0, 10),
      count: 8 + i, avgScore: 90 + (i % 2), rejected: 0,
    })),
  },
];

// ============= 既往报告对比 =============
export const PRIOR_REPORT_COMPARISONS: PriorReportComparison[] = [
  {
    id: 'prc-001',
    reportId: 'RP20260615001',
    currentReportId: 'RP20260615001',
    priorReportId: 'RP20251102015',
    priorStudyDate: '2025-11-02',
    daysSince: 226,
    modalityMatch: true,
    bodyPartMatch: true,
    findings: [
      { field: 'leftLowerLobe.mass.size', currentValue: '3.2 x 2.8 cm', priorValue: '2.1 x 1.9 cm', change: 'enlarged', significance: 'major', detail: '体积增大约 60%' },
      { field: 'leftLowerLobe.mass.density', currentValue: '不均匀强化', priorValue: '轻度强化', change: 'changed', significance: 'major' },
      { field: 'mediastinalLymphNode', currentValue: '肿大 1.5cm', priorValue: '正常', change: 'new', significance: 'critical', detail: '新增纵隔淋巴结肿大' },
    ],
    overallChange: 'worsened',
    aiSummary: '与 2025-11-02 旧片对比,左肺下叶肿块明显增大,强化方式改变,新见纵隔淋巴结肿大,提示疾病进展,建议多学科会诊。',
    recommendedAction: '建议结合临床启动 MDT 会诊,补充 PET-CT 检查。',
    comparedAt: isoOffset(-0.1),
  },
  {
    id: 'prc-002',
    reportId: 'RP20260615002',
    currentReportId: 'RP20260615002',
    priorReportId: 'RP20251010008',
    priorStudyDate: '2025-10-10',
    daysSince: 249,
    modalityMatch: true,
    bodyPartMatch: true,
    findings: [
      { field: 'liver.nodule', currentValue: '多发小结节', priorValue: '多发小结节', change: 'stable', significance: 'minor' },
    ],
    overallChange: 'stable',
    aiSummary: '肝内多发小结节,与 2025-10 旧片对比未见明显变化,继续随访。',
    comparedAt: isoOffset(-0.3),
  },
];

// ============= 多签 =============
export const FINAL_MULTI_SIGNATURE_REQUESTS: FinalMultiSignatureRequest[] = [
  {
    id: 'fms-001',
    taskId: 'rt-001',
    reportId: 'RP20260615001',
    requestedBy: 'D001',
    requestedByName: '张明远',
    requestedAt: isoOffset(-0.3),
    slots: [
      { id: 'fms-001-s1', order: 1, role: 'attending', required: true, signerId: 'D001', signerName: '张明远', signedAt: isoOffset(-0.25), status: 'signed', certificateId: 'cert-001' },
      { id: 'fms-001-s2', order: 2, role: 'chief', required: true, signerId: 'D009', signerName: '吴芳', signedAt: isoOffset(-0.2), status: 'signed', certificateId: 'cert-002' },
      { id: 'fms-001-s3', order: 3, role: 'director', required: true, signerId: 'D-DIR', status: 'pending' },
    ],
    reason: '危急值 + 主任签发规则触发',
    trigger: 'critical',
    parallel: false,
    expiresAt: isoOffset(24),
    status: 'in-progress',
    auditId: 'audit-fms-001',
  },
  {
    id: 'fms-002',
    taskId: 'rt-005',
    reportId: 'RP20260614005',
    requestedBy: 'D001',
    requestedByName: '张明远',
    requestedAt: isoOffset(-0.5),
    slots: [
      { id: 'fms-002-s1', order: 1, role: 'attending', required: true, signerId: 'D001', signerName: '张明远', signedAt: isoOffset(-0.4), status: 'signed' },
      { id: 'fms-002-s2', order: 2, role: 'chief', required: true, signerId: 'D006', signerName: '赵雪琴', signedAt: isoOffset(-0.3), status: 'signed' },
      { id: 'fms-002-s3', order: 3, role: 'witness', required: false, status: 'pending' },
    ],
    reason: 'BI-RADS 5 类特殊会诊',
    trigger: 'special',
    parallel: false,
    expiresAt: isoOffset(20),
    status: 'completed',
    completedAt: isoOffset(-0.2),
    certificateId: 'cert-fms-002',
  },
];

// ============= 急诊通道 =============
export const EMERGENCY_REVIEW_REQUESTS: EmergencyReviewRequest[] = [
  {
    id: 'emr-001',
    taskId: 'rt-001',
    reportId: 'RP20260615001',
    patientId: 'P-100023',
    patientName: '黄海涛',
    trigger: 'critical-finding',
    severity: 'critical',
    description: '危急值:左肺下叶肿块伴纵隔淋巴结肿大,需立即终核',
    triggeredBy: 'ai-detector',
    triggeredByName: 'AI 危急值识别',
    triggeredAt: isoOffset(-0.4),
    channels: ['sms', 'phone', 'in-app'],
    targets: [
      { reviewerId: 'D001', reviewerName: '张明远', role: 'chief', notifiedAt: isoOffset(-0.4), acknowledgedAt: isoOffset(-0.35), responseTimeMs: 5 * 60 * 1000 },
      { reviewerId: 'D009', reviewerName: '吴芳', role: 'chief', notifiedAt: isoOffset(-0.4), acknowledgedAt: isoOffset(-0.3), responseTimeMs: 10 * 60 * 1000 },
    ],
    slaMinutes: 15,
    status: 'in-review',
    auditId: 'audit-emr-001',
  },
  {
    id: 'emr-002',
    taskId: 'rt-006',
    reportId: 'RP20260614006',
    patientId: 'P-100028',
    patientName: '高志强',
    trigger: 'er-request',
    severity: 'life-threatening',
    description: '急诊科请求:急性脑梗死报告需立即终核',
    triggeredBy: 'D-ER',
    triggeredByName: '急诊科 王医生',
    triggeredAt: isoOffset(-22),
    channels: ['phone', 'sms', 'in-app', 'pager'],
    targets: [
      { reviewerId: 'D001', reviewerName: '张明远', role: 'chief', notifiedAt: isoOffset(-22), acknowledgedAt: isoOffset(-22), responseTimeMs: 3 * 60 * 1000 },
    ],
    slaMinutes: 5,
    status: 'completed',
    completedAt: isoOffset(-12),
    auditId: 'audit-emr-002',
  },
];

// ============= 工作流配置 =============
export const FINAL_CHECK_WORKFLOW_CONFIGS: FinalCheckWorkflowConfig[] = [
  {
    id: 'cfg-default',
    name: '标准终核流程 v3',
    version: 'v3.0.5.1',
    isDefault: true,
    enabled: true,
    description: '默认终核流程,覆盖初终审 + 危急值 + 多签 + 急诊 + 双驳回路径',
    stages: [
      { id: 's-1', code: 'OPEN', name: '打开终核面板', order: 1, required: true, skippable: false, rolesAllowed: ['attending', 'associateChief', 'chief', 'director'], slaMinutes: 2, exitCriteria: ['加载检查项模板', '加载既往对比'] },
      { id: 's-2', code: 'AUTO', name: '自动检查', order: 2, required: true, skippable: false, rolesAllowed: ['attending', 'associateChief', 'chief', 'director'], slaMinutes: 1, exitCriteria: ['AI 预审完成', '一致性检查完成'] },
      { id: 's-3', code: 'MANUAL', name: '人工复核', order: 3, required: true, skippable: false, rolesAllowed: ['associateChief', 'chief', 'director'], slaMinutes: 15, exitCriteria: ['15+ 项全部确认'] },
      { id: 's-4', code: 'SCORE', name: '终评', order: 4, required: true, skippable: false, rolesAllowed: ['associateChief', 'chief', 'director'], slaMinutes: 3, exitCriteria: ['总分 >= 60', '无 blocker'] },
      { id: 's-5', code: 'SIG', name: '多签', order: 5, required: false, skippable: true, rolesAllowed: ['chief', 'director'], slaMinutes: 30, exitCriteria: ['所有 required slot 签完'] },
      { id: 's-6', code: 'CLOSE', name: '完成', order: 6, required: true, skippable: false, rolesAllowed: ['associateChief', 'chief', 'director'], slaMinutes: 1, exitCriteria: ['状态 -> reviewed/signing'] },
    ],
    rejectTargets: ['initial', 'direct-to-draft', 'previous-stage'],
    multiSignatureRequired: true,
    emergencyChannelEnabled: true,
    defaultRubricId: 'rubric-default',
    passingThreshold: 60,
    blockingThreshold: 40,
    autoEscalateOnBlocker: true,
    notifyOnReject: true,
    preserveAuditChain: true,
    updatedAt: isoOffset(-72),
    updatedBy: 'D001',
  },
];

// ============= 事件流 =============
export const FINAL_CHECK_EVENTS: FinalCheckEvent[] = [
  { id: 'fce-001', taskId: 'rt-001', reportId: 'RP20260615001', type: 'started', actorId: 'D001', actorName: '张明远', payload: { stage: 'OPEN' }, timestamp: isoOffset(-0.5) },
  { id: 'fce-002', taskId: 'rt-001', reportId: 'RP20260615001', type: 'item-checked', actorId: 'D001', actorName: '张明远', payload: { code: 'FCHK-001', status: 'passed' }, timestamp: isoOffset(-0.45) },
  { id: 'fce-003', taskId: 'rt-001', reportId: 'RP20260615001', type: 'item-failed', actorId: 'auto', actorName: 'system', payload: { code: 'FCHK-005', severity: 'major' }, timestamp: isoOffset(-0.4) },
  { id: 'fce-004', taskId: 'rt-001', reportId: 'RP20260615001', type: 'completed', actorId: 'D001', actorName: '张明远', payload: { score: 92, grade: 'A' }, timestamp: isoOffset(-0.2) },
  { id: 'fce-005', taskId: 'rt-003', reportId: 'RP20260615003', type: 'rejected-draft', actorId: 'D001', actorName: '张明远', payload: { reason: '危急值未标注', target: 'direct-to-draft' }, timestamp: isoOffset(-0.4) },
];

export default {
  FINAL_CHECK_TEMPLATES,
  FINAL_CHECK_LISTS,
  CLINICAL_CONSISTENCY_RESULTS,
  FINAL_SCORING_RUBRICS,
  FINAL_SCORING_RESULTS,
  FINAL_REVIEW_NOTES,
  FINAL_CHECK_WORKLOAD,
  PRIOR_REPORT_COMPARISONS,
  FINAL_MULTI_SIGNATURE_REQUESTS,
  EMERGENCY_REVIEW_REQUESTS,
  FINAL_CHECK_WORKFLOW_CONFIGS,
  FINAL_CHECK_EVENTS,
};
