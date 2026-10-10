/**
 * G005 RIS v3.0.5.1 - R3.REVIEW INITIAL CHECK 初核清单 Mock 数据
 * 包含 20+ 检查项定义 / 模板 / 评审记录 / SLA 配置 / 自定义项 / 工作量统计
 */
import type {
  InitialCheckItem,
  InitialCheckListInstance,
  InitialCheckResult,
  InitialCheckAuditEntry,
  InitialCheckSLAConfig,
  InitialCheckCustomItem,
  InitialCheckWorkloadStats,
  InitialCheckSummary,
  InitialCheckBatchResult,
  CheckItemResultStatus,
  CheckItemCategory,
  CheckItemSeverity,
} from '../types/R3/R3.REVIEW.INITIAL';
import type { ReviewTask } from '../types/R3/R3.REVIEW';

const now = new Date();
const isoOffset = (hours: number) => new Date(now.getTime() + hours * 3600 * 1000).toISOString();
const ago = (hours: number) => isoOffset(-hours);

export const CHECK_ITEM_TEMPLATES: InitialCheckItem[] = [
  {
    id: 'ci-001', code: 'CHK-PT-NAME', category: 'completeness',
    name: '患者姓名一致性', description: '报告中患者姓名与检查申请单/HIS 信息一致',
    required: true, severity: 'error', enabledByDefault: true, userToggleable: false,
    sourceField: 'patientInfo', keywords: ['姓名', '患者'],
    isSystem: true, i18nKey: 'review.initialCheck.items.patientName',
  },
  {
    id: 'ci-002', code: 'CHK-PT-AGE', category: 'completeness',
    name: '患者年龄/性别', description: '报告中必须包含患者年龄与性别',
    required: true, severity: 'error', enabledByDefault: true, userToggleable: false,
    sourceField: 'patientInfo', keywords: ['岁', '男', '女'],
    isSystem: true, i18nKey: 'review.initialCheck.items.patientAge',
  },
  {
    id: 'ci-003', code: 'CHK-PT-ID', category: 'completeness',
    name: '患者 ID / 报告 ID', description: '报告中必须显示患者 ID 与报告编号',
    required: true, severity: 'error', enabledByDefault: true, userToggleable: false,
    sourceField: 'patientInfo', keywords: ['ID', '病历号'],
    isSystem: true, i18nKey: 'review.initialCheck.items.patientId',
  },
  {
    id: 'ci-004', code: 'CHK-STUDY-MODALITY', category: 'completeness',
    name: '检查模态与部位', description: '报告中明确检查模态(CT/MR/MG/DR/US)与检查部位',
    required: true, severity: 'error', enabledByDefault: true, userToggleable: false,
    sourceField: 'studyInfo', keywords: ['CT', 'MR', 'MG', 'DR', 'US', '胸部', '腹部', '头颅', '脊柱', '盆腔'],
    isSystem: true, i18nKey: 'review.initialCheck.items.modality',
  },
  {
    id: 'ci-005', code: 'CHK-FINDINGS-MIN-LEN', category: 'completeness',
    name: '影像所见长度', description: '影像所见不少于 30 字符,避免描述过短',
    required: true, severity: 'warning', enabledByDefault: true, userToggleable: true,
    sourceField: 'findings', minLength: 30, maxLength: 4000,
    isSystem: true, i18nKey: 'review.initialCheck.items.findingsMinLen',
  },
  {
    id: 'ci-006', code: 'CHK-IMPRESSION-PRESENT', category: 'completeness',
    name: '诊断意见存在', description: '报告必须包含诊断意见(印象)',
    required: true, severity: 'error', enabledByDefault: true, userToggleable: false,
    sourceField: 'impression', keywords: ['印象', '考虑', '诊断', '提示', '不除外'],
    isSystem: true, i18nKey: 'review.initialCheck.items.impression',
  },
  {
    id: 'ci-007', code: 'CHK-RECOMMENDATION', category: 'clinical',
    name: '随访/建议', description: '对异常发现应给出随访/复查/会诊建议',
    required: true, severity: 'warning', enabledByDefault: true, userToggleable: true,
    sourceField: 'recommendation', keywords: ['建议', '复查', '随访', '进一步', '会诊', '咨询'],
    isSystem: true, i18nKey: 'review.initialCheck.items.recommendation',
  },
  {
    id: 'ci-008', code: 'CHK-CRITICAL-MARK', category: 'safety',
    name: '危急值标记', description: '危急发现必须在报告中明确标记 ★/危急值',
    required: true, severity: 'critical', enabledByDefault: true, userToggleable: false,
    sourceField: 'findings', keywords: ['危急', '★', 'critical', '急值'],
    isSystem: true, i18nKey: 'review.initialCheck.items.criticalMark',
  },
  {
    id: 'ci-009', code: 'CHK-LATERALITY', category: 'consistency',
    name: '左右侧一致性', description: '报告中描述的左右侧与申请单/图像一致,无 L/R 混淆',
    required: true, severity: 'error', enabledByDefault: true, userToggleable: false,
    sourceField: 'findings', keywords: ['左', '右', 'L', 'R', '双侧'],
    isSystem: true, applicableModalities: ['CT', 'MR', 'MG', 'DR', 'US'],
    i18nKey: 'review.initialCheck.items.laterality',
  },
  {
    id: 'ci-010', code: 'CHK-CONSIST-IMG-FIND', category: 'consistency',
    name: '图像与所见一致性', description: '影像所见与所附图像实际发现一致(由 reviewer 目检)',
    required: true, severity: 'error', enabledByDefault: true, userToggleable: true,
    sourceField: 'findings', keywords: ['所见', '图像', '示'],
    isSystem: true, i18nKey: 'review.initialCheck.items.imgFindingMatch',
  },
  {
    id: 'ci-011', code: 'CHK-TERM-RADI', category: 'terminology',
    name: '规范放射学术语', description: '使用 RadLex/RSNA 规范术语,无口语化表达',
    required: true, severity: 'warning', enabledByDefault: true, userToggleable: true,
    sourceField: 'findings', keywords: ['密度', '信号', '强化', '占位', '结节', '肿块', '钙化'],
    isSystem: true, i18nKey: 'review.initialCheck.items.terminology',
  },
  {
    id: 'ci-012', code: 'CHK-TERM-NO-VAGUE', category: 'terminology',
    name: '无模糊术语', description: '不应出现"考虑""可能""不除外"等独立使用的模糊词(必须给出倾向)',
    required: false, severity: 'warning', enabledByDefault: true, userToggleable: true,
    sourceField: 'impression', keywords: ['倾向', '首先考虑', '可能性大', '明确'],
    isSystem: true, i18nKey: 'review.initialCheck.items.noVague',
  },
  {
    id: 'ci-013', code: 'CHK-CMP-PRIOR', category: 'consistency',
    name: '对比既往报告', description: '若存在既往报告,本次报告应与既往对照并描述变化',
    required: false, severity: 'info', enabledByDefault: true, userToggleable: true,
    sourceField: 'findings', keywords: ['对照', '既往', '比较', '本次', '同前', '新增', '较前'],
    isSystem: true, i18nKey: 'review.initialCheck.items.comparePrior',
  },
  {
    id: 'ci-014', code: 'CHK-CMP-CLINIC', category: 'consistency',
    name: '结合临床信息', description: '报告应结合临床病史/主诉,体现临床-影像一致性',
    required: true, severity: 'warning', enabledByDefault: true, userToggleable: true,
    sourceField: 'clinicalHistory', keywords: ['结合临床', '符合', '符合临床', '与病史'],
    isSystem: true, i18nKey: 'review.initialCheck.items.clinicalMatch',
  },
  {
    id: 'ci-015', code: 'CHK-FORMAT-DATE', category: 'format',
    name: '日期格式', description: '报告日期使用 YYYY-MM-DD 标准格式',
    required: false, severity: 'info', enabledByDefault: false, userToggleable: true,
    patterns: ['\\d{4}-\\d{2}-\\d{2}'],
    isSystem: true, i18nKey: 'review.initialCheck.items.dateFormat',
  },
  {
    id: 'ci-016', code: 'CHK-FORMAT-SIGN', category: 'compliance',
    name: '医生签名', description: '报告中含医生手写/电子签名',
    required: true, severity: 'error', enabledByDefault: true, userToggleable: false,
    sourceField: 'studyInfo', keywords: ['签名', '医师', '签发'],
    isSystem: true, i18nKey: 'review.initialCheck.items.signature',
  },
  {
    id: 'ci-017', code: 'CHK-RADS-BIRADS', category: 'compliance',
    name: 'BI-RADS 分类', description: '乳腺钼靶报告必须含 BI-RADS 分类(0-6)',
    required: true, severity: 'error', enabledByDefault: true, userToggleable: false,
    applicableModalities: ['MG'], sourceField: 'impression',
    patterns: ['BI-RADS\\s*[0-6]', 'BI-RADS[0-6]'],
    isSystem: true, i18nKey: 'review.initialCheck.items.birads',
  },
  {
    id: 'ci-018', code: 'CHK-RADS-LUNGRADS', category: 'compliance',
    name: 'Lung-RADS 分类', description: '胸部 CT 报告必须含 Lung-RADS 分类(胸部/肺结节场景)',
    required: false, severity: 'warning', enabledByDefault: true, userToggleable: true,
    applicableModalities: ['CT'], sourceField: 'impression',
    patterns: ['Lung-RADS\\s*[0-4][A-Z]?', 'Lung-RADS[0-4]'],
    isSystem: true, i18nKey: 'review.initialCheck.items.lungrads',
  },
  {
    id: 'ci-019', code: 'CHK-CONTRAST-USAGE', category: 'safety',
    name: '对比剂使用说明', description: '使用对比剂时应注明对比剂名称、剂量、注射方式',
    required: true, severity: 'warning', enabledByDefault: true, userToggleable: true,
    sourceField: 'findings', keywords: ['对比剂', '造影', '碘海醇', '碘佛醇', 'Gd-DTPA', '钆喷酸'],
    isSystem: true, applicableModalities: ['CT', 'MR'],
    i18nKey: 'review.initialCheck.items.contrast',
  },
  {
    id: 'ci-020', code: 'CHK-INCIDENTAL', category: 'clinical',
    name: '偶发瘤/意外发现', description: '对检查范围内的偶发瘤/意外发现应单独描述',
    required: false, severity: 'info', enabledByDefault: true, userToggleable: true,
    sourceField: 'findings', keywords: ['偶发', '意外', '附带', 'incidental'],
    isSystem: true, i18nKey: 'review.initialCheck.items.incidental',
  },
  {
    id: 'ci-021', code: 'CHK-IMAGING-MEASURE', category: 'completeness',
    name: '关键病灶测量', description: '关键病灶应给出大小测量(mm/cm)',
    required: true, severity: 'warning', enabledByDefault: true, userToggleable: true,
    sourceField: 'findings', patterns: ['\\d+\\s*(mm|cm)'],
    isSystem: true, i18nKey: 'review.initialCheck.items.measure',
  },
  {
    id: 'ci-022', code: 'CHK-COMPLIANCE-LAW', category: 'compliance',
    name: '法规声明', description: '报告末尾包含放射防护/检查同意等法规声明',
    required: false, severity: 'info', enabledByDefault: false, userToggleable: true,
    keywords: ['辐射防护', '知情同意', '电离辐射'],
    isSystem: true, i18nKey: 'review.initialCheck.items.compliance',
  },
  {
    id: 'ci-023', code: 'CHK-PATH-CONSULT', category: 'clinical',
    name: '病理/会诊建议', description: '对疑似恶性/疑难病例应建议病理活检或 MDT 会诊',
    required: false, severity: 'warning', enabledByDefault: true, userToggleable: true,
    sourceField: 'recommendation', keywords: ['病理', '活检', 'MDT', '会诊', '手术'],
    isSystem: true, i18nKey: 'review.initialCheck.items.pathConsult',
  },
  {
    id: 'ci-024', code: 'CHK-QUALITY-SCORE', category: 'compliance',
    name: '质量评分门槛', description: 'AI 预审质量评分 >= 60 才可一键通过',
    required: true, severity: 'error', enabledByDefault: true, userToggleable: false,
    isSystem: true, i18nKey: 'review.initialCheck.items.qualityScore',
  },
];

const itemByCode = (code: string): InitialCheckItem | undefined =>
  CHECK_ITEM_TEMPLATES.find((c) => c.code === code);

const randomStatus = (item: InitialCheckItem): CheckItemResultStatus => {
  if (!item.enabledByDefault) return 'skipped';
  const seed = item.code.length + item.severity.length;
  const r = (seed * 7) % 10;
  if (item.severity === 'critical') {
    if (r < 1) return 'failed';
    return 'passed';
  }
  if (item.required) {
    if (r < 1) return 'failed';
    if (r < 2) return 'waived';
    return 'passed';
  }
  if (r < 1) return 'failed';
  if (r < 3) return 'pending';
  if (r < 4) return 'skipped';
  return 'passed';
};

const buildResult = (item: InitialCheckItem): InitialCheckResult => {
  const status = randomStatus(item);
  return {
    itemId: item.id,
    itemCode: item.code,
    status,
    matchedText: status === 'passed' ? item.keywords?.[0] ?? 'OK' : undefined,
    reason:
      status === 'failed'
        ? `未通过 ${item.name},请补充相关内容`
        : status === 'waived'
          ? '已豁免'
          : undefined,
    autoScore: status === 'passed' ? (item.maxScore ?? 10) : status === 'failed' ? 0 : Math.floor((item.maxScore ?? 10) * 0.5),
    overridden: false,
    checkedAt: new Date().toISOString(),
  };
};

const buildList = (task: ReviewTask, reviewerId: string, reviewerName: string): InitialCheckListInstance => {
  const items = CHECK_ITEM_TEMPLATES.filter((i) => !i.applicableModalities || i.applicableModalities.includes(task.modality));
  const results: Record<string, InitialCheckResult> = {};
  items.forEach((it) => {
    results[it.id] = buildResult(it);
  });
  const allRequired = items.filter((i) => i.required);
  const passed = allRequired.filter((i) => results[i.id]?.status === 'passed').length;
  const totalPassed = items.filter((i) => results[i.id]?.status === 'passed').length;
  const requiredPassRate = allRequired.length > 0 ? passed / allRequired.length : 1;
  const passRate = items.length > 0 ? totalPassed / items.length : 1;
  const requiredAllPassed = requiredPassRate >= 1;
  const slaDeadline = task.deadline;
  const slaRemainingMinutes = Math.floor((new Date(slaDeadline).getTime() - now.getTime()) / 60000);
  return {
    id: 'icl-' + task.id,
    reportId: task.reportId,
    taskId: task.id,
    items,
    results,
    overallStatus: requiredAllPassed ? 'ready-to-approve' : 'in-progress',
    requiredAllPassed,
    requiredPassRate,
    passRate,
    autoScore: Math.round(passRate * 100),
    reviewerId,
    reviewerName,
    reviewerTitle: '副主任医师',
    slaDeadline,
    slaRemainingMinutes,
    isOverdue: slaRemainingMinutes < 0,
    slaWarnMinutes: 30,
    createdAt: ago(2),
    updatedAt: ago(0.5),
  };
};

const REVIEWER_IDS = [
  { id: 'D001', name: '张明远', title: '主任医师' },
  { id: 'D002', name: '李慧敏', title: '副主任医师' },
  { id: 'D003', name: '王建华', title: '主治医师' },
  { id: 'D004', name: '陈晓东', title: '住院医师' },
  { id: 'D005', name: '刘文博', title: '副主任医师' },
  { id: 'D006', name: '赵雪琴', title: '主治医师' },
] as const;

const sampleTasks: Pick<ReviewTask, 'id' | 'reportId' | 'modality' | 'priority' | 'deadline' | 'criticalFinding'>[] = [
  { id: 'rt-001', reportId: 'RP20260615001', modality: 'CT', priority: 'stat', deadline: isoOffset(2), criticalFinding: true },
  { id: 'rt-002', reportId: 'RP20260615002', modality: 'MR', priority: 'urgent', deadline: isoOffset(4), criticalFinding: false },
  { id: 'rt-003', reportId: 'RP20260615003', modality: 'CT', priority: 'stat', deadline: isoOffset(-1), criticalFinding: true },
  { id: 'rt-006', reportId: 'RP20260614006', modality: 'CT', priority: 'stat', deadline: isoOffset(-2), criticalFinding: true },
  { id: 'rt-013', reportId: 'RP20260611013', modality: 'MG', priority: 'urgent', deadline: isoOffset(1), criticalFinding: true },
  { id: 'rt-014', reportId: 'RP20260610014', modality: 'CT', priority: 'routine', deadline: isoOffset(8), criticalFinding: false },
  { id: 'rt-015', reportId: 'RP20260609015', modality: 'MR', priority: 'urgent', deadline: isoOffset(3), criticalFinding: false },
  { id: 'rt-016', reportId: 'RP20260608016', modality: 'DR', priority: 'routine', deadline: isoOffset(12), criticalFinding: false },
  { id: 'rt-017', reportId: 'RP20260607017', modality: 'US', priority: 'routine', deadline: isoOffset(20), criticalFinding: false },
  { id: 'rt-018', reportId: 'RP20260606018', modality: 'CT', priority: 'stat', deadline: isoOffset(0.5), criticalFinding: true },
];

const reviewerFor = (idx: number) => REVIEWER_IDS[idx % REVIEWER_IDS.length]!;

export const INITIAL_CHECK_LISTS: InitialCheckListInstance[] = sampleTasks.map((t, i) => {
  const rev = reviewerFor(i);
  return buildList(t as ReviewTask, rev.id, rev.name);
});

export const INITIAL_CHECK_AUDIT: InitialCheckAuditEntry[] = [
  {
    id: 'auc-001', listId: INITIAL_CHECK_LISTS[0]?.id ?? '', reportId: 'RP20260615001',
    action: 'created', actorId: 'D006', actorName: '赵雪琴', detail: '创建初核清单',
    timestamp: ago(2),
  },
  {
    id: 'auc-002', listId: INITIAL_CHECK_LISTS[0]?.id ?? '', reportId: 'RP20260615001',
    action: 'item-overridden', actorId: 'D006', actorName: '赵雪琴', itemId: 'ci-005',
    detail: '将 CHK-FINDINGS-MIN-LEN 标记为已通过', timestamp: ago(1.5),
  },
  {
    id: 'auc-003', listId: INITIAL_CHECK_LISTS[0]?.id ?? '', reportId: 'RP20260615001',
    action: 'batch-validated', actorId: 'D006', actorName: '赵雪琴', detail: '批量校验 20 项,18 通过,2 失败',
    timestamp: ago(1),
  },
  {
    id: 'auc-004', listId: INITIAL_CHECK_LISTS[1]?.id ?? '', reportId: 'RP20260615002',
    action: 'approved', actorId: 'D005', actorName: '刘文博', detail: '一键通过', timestamp: ago(0.5),
  },
  {
    id: 'auc-005', listId: INITIAL_CHECK_LISTS[2]?.id ?? '', reportId: 'RP20260615003',
    action: 'sla-breached', actorId: 'system', actorName: '系统', detail: 'SLA 超时 1 小时,自动升级至主任医师',
    timestamp: ago(0.2),
  },
  {
    id: 'auc-006', listId: INITIAL_CHECK_LISTS[4]?.id ?? '', reportId: 'RP20260611013',
    action: 'custom-item-added', actorId: 'D002', actorName: '李慧敏', itemId: 'ci-cus-001',
    detail: '新增自定义项:BI-RADS 5 类须明确可疑征象', timestamp: ago(3),
  },
];

export const INITIAL_CHECK_SLA_CONFIG: InitialCheckSLAConfig = {
  id: 'sla-cfg-001',
  stage: 'initial',
  defaultMinutes: 240,
  byPriority: { stat: 60, critical: 90, urgent: 180, routine: 480 },
  byModality: { CT: 180, MR: 240, MG: 240, DR: 120, US: 240 },
  warnMinutes: 30,
  autoEscalateOnBreach: true,
  escalateToRole: 'associateChief',
  escalateAfterMinutes: 30,
  updatedAt: ago(24),
  updatedBy: 'D001',
};

export const INITIAL_CHECK_CUSTOM_ITEMS: InitialCheckCustomItem[] = [
  {
    id: 'cus-001', reviewerId: 'D002', reviewerName: '李慧敏', scope: 'department',
    item: {
      ...(itemByCode('CHK-RADS-BIRADS') ?? CHECK_ITEM_TEMPLATES[0]!),
      id: 'ci-cus-001',
      code: 'CUS-BIRADS5-DETAIL',
      name: 'BI-RADS 5 类可疑征象明确',
      description: 'BI-RADS 5 类报告必须明确可疑征象(形态/边缘/数量/大小)',
      required: true, severity: 'warning',
      sourceField: 'impression', patterns: ['BI-RADS\\s*5'],
    },
    usedCount: 12, createdAt: ago(72), updatedAt: ago(3),
  },
  {
    id: 'cus-002', reviewerId: 'D005', reviewerName: '刘文博', scope: 'private',
    item: {
      ...(itemByCode('CHK-CRITICAL-MARK') ?? CHECK_ITEM_TEMPLATES[0]!),
      id: 'ci-cus-002',
      code: 'CUS-CRITICAL-CONTACT',
      name: '危急值电话通知记录',
      description: '危急值报告须有电话通知临床医生记录',
      required: true, severity: 'critical',
      keywords: ['电话通知', '已通知', '通知临床'],
    },
    usedCount: 28, createdAt: ago(120), updatedAt: ago(10),
  },
  {
    id: 'cus-003', reviewerId: 'D001', reviewerName: '张明远', scope: 'global',
    item: {
      ...(itemByCode('CHK-IMAGING-MEASURE') ?? CHECK_ITEM_TEMPLATES[0]!),
      id: 'ci-cus-003',
      code: 'CUS-MEASURE-2D',
      name: '二维测量横纵径',
      description: '关键病灶须同时提供横断面 + 纵断面测量',
      required: false, severity: 'info',
      patterns: ['\\d+\\s*(mm|cm)\\s*[xX×]\\s*\\d+\\s*(mm|cm)'],
    },
    usedCount: 47, createdAt: ago(240), updatedAt: ago(48),
  },
];

export const INITIAL_CHECK_WORKLOAD: InitialCheckWorkloadStats[] = REVIEWER_IDS.map((r, i) => ({
  reviewerId: r.id,
  reviewerName: r.name,
  reviewerTitle: r.title as InitialCheckWorkloadStats['reviewerTitle'],
  completedToday: 6 + i * 2,
  inProgress: 2 + (i % 3),
  pending: 1 + (i % 4),
  onTimeRate: 0.86 + (i % 3) * 0.03,
  avgMinutes: 28 + i * 4,
  oneClickPassRate: 0.62 + (i % 3) * 0.05,
  overdue: i % 4 === 0 ? 1 : 0,
  criticalHandled: i % 2,
}));

export const INITIAL_CHECK_SUMMARY: InitialCheckSummary = {
  total: 84,
  pending: 18,
  inProgress: 24,
  approvedToday: 32,
  rejectedToday: 6,
  overdue: 4,
  requiredPassRate: 0.91,
  oneClickPassRate: 0.68,
  avgMinutes: 34,
  criticalRatio: 0.18,
  byModality: [
    { modality: 'CT', count: 38 },
    { modality: 'MR', count: 22 },
    { modality: 'MG', count: 9 },
    { modality: 'DR', count: 8 },
    { modality: 'US', count: 7 },
  ],
  byPriority: [
    { priority: 'stat', count: 12 },
    { priority: 'critical', count: 4 },
    { priority: 'urgent', count: 18 },
    { priority: 'routine', count: 50 },
  ],
  reviewerBreakdown: INITIAL_CHECK_WORKLOAD,
  slaMetrics: {
    initialReviewSLA: 240,
    finalReviewSLA: 120,
    signSLA: 60,
    cosignSLA: 90,
    escalateSLA: 60,
    onTimeRate: 0.89,
    overdueCount: 4,
    averageInitialMinutes: 34,
    averageFinalMinutes: 18,
    averageCosignMinutes: 12,
    p95InitialMinutes: 78,
    p95FinalMinutes: 42,
    breachByStage: { initial: 4, final: 0, cosign: 0, sign: 0 },
  },
  slaBreachByReviewer: REVIEWER_IDS.map((r, i) => ({
    reviewerId: r.id,
    reviewerName: r.name,
    breachCount: i % 3,
  })),
  trend: Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10),
    approved: 20 + Math.floor(Math.sin(i / 2) * 6) + i,
    rejected: 3 + Math.floor(Math.cos(i / 3) * 2),
    passRate: 0.85 + Math.sin(i / 4) * 0.05,
  })),
};

export const INITIAL_CHECK_BATCH_RESULT: InitialCheckBatchResult = {
  total: 5,
  approved: 4,
  rejected: 1,
  skipped: 0,
  details: [
    { listId: 'icl-rt-002', reportId: 'RP20260615002', status: 'approved' },
    { listId: 'icl-rt-014', reportId: 'RP20260610014', status: 'approved' },
    { listId: 'icl-rt-015', reportId: 'RP20260609015', status: 'approved' },
    { listId: 'icl-rt-016', reportId: 'RP20260608016', status: 'approved' },
    { listId: 'icl-rt-017', reportId: 'RP20260607017', status: 'rejected', reason: '必填项 CHK-IMAGING-MEASURE 未通过' },
  ],
  startedAt: ago(0.05),
  completedAt: ago(0.04),
};

export const CATEGORY_META: Record<CheckItemCategory, { label: string; color: string; bg: string }> = {
  completeness: { label: '完整性', color: 'var(--color-primary-500)', bg: '#dbeafe' },
  terminology: { label: '术语', color: '#7c3aed', bg: '#ede9fe' },
  consistency: { label: '一致性', color: 'var(--color-info-600)', bg: '#cffafe' },
  clinical: { label: '临床', color: '#10b981', bg: '#d1fae5' },
  safety: { label: '安全', color: 'var(--color-error-600)', bg: '#fee2e2' },
  compliance: { label: '合规', color: '#7c2d12', bg: '#fed7aa' },
  format: { label: '格式', color: '#64748b', bg: '#e2e8f0' },
};

export const SEVERITY_META: Record<CheckItemSeverity, { label: string; color: string; bg: string; icon: string }> = {
  info: { label: '提示', color: 'var(--color-primary-500)', bg: '#dbeafe', icon: 'info' },
  warning: { label: '警告', color: 'var(--color-warning-500)', bg: '#fef3c7', icon: 'alert-triangle' },
  error: { label: '错误', color: 'var(--color-error-600)', bg: '#fee2e2', icon: 'x-circle' },
  critical: { label: '严重', color: '#7f1d1d', bg: '#fecaca', icon: 'siren' },
};

export const RESULT_META: Record<CheckItemResultStatus, { label: string; color: string; bg: string }> = {
  pending: { label: '待检', color: '#64748b', bg: '#e2e8f0' },
  passed: { label: '通过', color: '#10b981', bg: '#d1fae5' },
  failed: { label: '未通过', color: 'var(--color-error-600)', bg: '#fee2e2' },
  waived: { label: '已豁免', color: '#7c3aed', bg: '#ede9fe' },
  skipped: { label: '已跳过', color: '#94a3b8', bg: '#f1f5f9' },
};

export default {
  CHECK_ITEM_TEMPLATES,
  INITIAL_CHECK_LISTS,
  INITIAL_CHECK_AUDIT,
  INITIAL_CHECK_SLA_CONFIG,
  INITIAL_CHECK_CUSTOM_ITEMS,
  INITIAL_CHECK_WORKLOAD,
  INITIAL_CHECK_SUMMARY,
  INITIAL_CHECK_BATCH_RESULT,
  CATEGORY_META,
  SEVERITY_META,
  RESULT_META,
};
