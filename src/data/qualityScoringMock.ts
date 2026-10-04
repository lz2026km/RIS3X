/**
 * G005 RIS v3.0.5.1 - R3.QUALITY.SCORING 质控评分 Mock 数据
 *
 * 15 维度 = 5 完整 + 5 准确 + 5 时效
 * 辅助:阈值/历史/报表/奖励联动/模板评分
 */
import type {
  ScoringDimension,
  ScoringDimensionKey,
  ScoringThresholdConfig,
  ThresholdConfig,
  ScoreHistoryEntry,
  BonusLinkage,
  TemplateScoreRule,
  QualityScoringKPI,
  ScoringEvaluationResult,
  ScoringSubmission,
  ScoreTemplateResult,
  ScoreHistoryResponse,
  ScoreHistoryQuery,
  ScoringGrade,
} from '../types/R3/R3.QUALITY.SCORING';

const isoNow = () => new Date().toISOString();
const isoOffset = (h: number) => new Date(Date.now() + h * 3600 * 1000).toISOString();

// ============== 15 维度定义 ==============
export const SCORING_DIMENSIONS: ScoringDimension[] = [
  // -------- 完整性 5 维度 --------
  {
    key: 'completeness_findings', category: 'completeness',
    name: '检查所见完整性', nameEn: 'Findings Completeness',
    description: '检查所见段落是否包含部位/形态/大小/密度/信号/增强 6 要素',
    descriptionEn: 'Findings section covers location/morphology/size/density/signal/enhancement',
    weight: 0.04, enabled: true, color: '#3b82f6', icon: '',
    passingRule: '所见长度 >= 80 字符且包含 4 项关键要素',
    passingRuleEn: 'Findings length >= 80 chars and includes 4 key elements',
    rules: [
      { key: 'findings-length', name: '长度>=80', nameEn: 'Length>=80', description: '所见长度 >= 80 字符', weight: 0.40, evaluator: 'auto' },
      { key: 'findings-location', name: '含部位', nameEn: 'Location', description: '出现解剖部位关键词', weight: 0.15, evaluator: 'auto' },
      { key: 'findings-morphology', name: '含形态', nameEn: 'Morphology', description: '描述病灶形态', weight: 0.15, evaluator: 'auto' },
      { key: 'findings-size', name: '含大小', nameEn: 'Size', description: '出现尺寸测量', weight: 0.15, evaluator: 'auto' },
      { key: 'findings-density', name: '含密度/信号', nameEn: 'Density/Signal', description: '密度或信号描述', weight: 0.15, evaluator: 'auto' },
    ],
  },
  {
    key: 'completeness_impression', category: 'completeness',
    name: '诊断印象完整性', nameEn: 'Impression Completeness',
    description: '诊断印象段落是否主次有序、结论明确',
    descriptionEn: 'Impression ordered and unambiguous',
    weight: 0.04, enabled: true, color: '#1d4ed8', icon: '',
    passingRule: '印象长度 >= 30 字符且包含主要诊断',
    passingRuleEn: 'Impression length >= 30 chars and includes primary diagnosis',
    rules: [
      { key: 'impression-length', name: '长度>=30', nameEn: 'Length>=30', description: '印象长度 >= 30 字符', weight: 0.40, evaluator: 'auto' },
      { key: 'impression-primary', name: '主要诊断', nameEn: 'Primary diagnosis', description: '包含主要诊断', weight: 0.30, evaluator: 'ai' },
      { key: 'impression-secondary', name: '次要诊断', nameEn: 'Secondary', description: '包含次要诊断', weight: 0.20, evaluator: 'ai' },
      { key: 'impression-order', name: '主次排序', nameEn: 'Order', description: '主诊断在前', weight: 0.10, evaluator: 'ai' },
    ],
  },
  {
    key: 'completeness_recommendation', category: 'completeness',
    name: '建议完整性', nameEn: 'Recommendation Completeness',
    description: '是否包含随访/复查/治疗建议',
    descriptionEn: 'Contains follow-up/review/treatment recommendations',
    weight: 0.03, enabled: true, color: '#0ea5e9', icon: '',
    passingRule: '包含随访/复查/治疗 关键词',
    passingRuleEn: 'Contains follow-up/review/treatment keywords',
    rules: [
      { key: 'rec-follow', name: '随访建议', nameEn: 'Follow-up', description: '包含随访时间', weight: 0.50, evaluator: 'auto' },
      { key: 'rec-review', name: '复查建议', nameEn: 'Review', description: '包含复查项目', weight: 0.50, evaluator: 'auto' },
    ],
  },
  {
    key: 'completeness_structured', category: 'completeness',
    name: '结构化字段完整', nameEn: 'Structured Fields',
    description: '结构化字段填写率',
    descriptionEn: 'Structured field fill rate',
    weight: 0.05, enabled: true, color: '#06b6d4', icon: '',
    passingRule: '结构化字段填写率 >= 80%',
    passingRuleEn: 'Structured field fill rate >= 80%',
    rules: [
      { key: 'struct-fillrate', name: '填写率>=80%', nameEn: 'Fill rate', description: '结构化字段填写率', weight: 0.60, evaluator: 'auto' },
      { key: 'struct-required', name: '必填项无遗漏', nameEn: 'Required', description: '必填项不漏', weight: 0.40, evaluator: 'auto' },
    ],
  },
  {
    key: 'completeness_signature', category: 'completeness',
    name: '签名完整', nameEn: 'Signature',
    description: '报告签名是否完整',
    descriptionEn: 'Report signature complete',
    weight: 0.04, enabled: true, color: '#0d9488', icon: '',
    passingRule: '包含医生签名 + 审核签名',
    passingRuleEn: 'Includes doctor + reviewer signatures',
    rules: [
      { key: 'sig-doctor', name: '医生签名', nameEn: 'Doctor sig', description: '医生签名存在', weight: 0.50, evaluator: 'auto' },
      { key: 'sig-reviewer', name: '审核签名', nameEn: 'Reviewer sig', description: '审核签名存在', weight: 0.50, evaluator: 'auto' },
    ],
  },
  // -------- 准确性 5 维度 --------
  {
    key: 'accuracy_diagnosis_match', category: 'accuracy',
    name: '所见-诊断一致', nameEn: 'Findings-Diagnosis Match',
    description: '诊断结论与检查所见是否一致',
    descriptionEn: 'Diagnosis consistent with findings',
    weight: 0.06, enabled: true, color: '#10b981', icon: '',
    passingRule: 'AI 相似度 >= 0.85',
    passingRuleEn: 'AI similarity >= 0.85',
    rules: [
      { key: 'match-similarity', name: 'AI 相似度', nameEn: 'AI similarity', description: '所见-诊断语义相似度', weight: 0.60, evaluator: 'ai' },
      { key: 'match-keyterm', name: '关键术语', nameEn: 'Key terms', description: '关键诊断术语匹配', weight: 0.40, evaluator: 'ai' },
    ],
  },
  {
    key: 'accuracy_anatomy_laterality', category: 'accuracy',
    name: '解剖方位正确', nameEn: 'Anatomy & Laterality',
    description: '左右侧/解剖部位描述准确',
    descriptionEn: 'Left/right and anatomy description accurate',
    weight: 0.04, enabled: true, color: '#059669', icon: '',
    passingRule: '方位词与图像标注一致',
    passingRuleEn: 'Laterality matches image annotation',
    rules: [
      { key: 'lat-correct', name: '左右一致', nameEn: 'L/R correct', description: '左/右与图像一致', weight: 0.60, evaluator: 'hybrid' },
      { key: 'lat-anatomy', name: '解剖名称', nameEn: 'Anatomy name', description: '解剖名称准确', weight: 0.40, evaluator: 'ai' },
    ],
  },
  {
    key: 'accuracy_clinical_reference', category: 'accuracy',
    name: '结合临床', nameEn: 'Clinical Reference',
    description: '是否结合临床病史/化验',
    descriptionEn: 'References clinical history/labs',
    weight: 0.04, enabled: true, color: '#16a34a', icon: '',
    passingRule: '包含临床病史或化验引用',
    passingRuleEn: 'Includes clinical history or lab reference',
    rules: [
      { key: 'clin-history', name: '临床病史', nameEn: 'History', description: '引用临床病史', weight: 0.50, evaluator: 'ai' },
      { key: 'clin-lab', name: '化验引用', nameEn: 'Lab ref', description: '引用化验指标', weight: 0.50, evaluator: 'ai' },
    ],
  },
  {
    key: 'accuracy_critical_marking', category: 'accuracy',
    name: '危急值标记', nameEn: 'Critical Marking',
    description: '危急值是否标记并通报',
    descriptionEn: 'Critical value marked and notified',
    weight: 0.04, enabled: true, color: '#dc2626', icon: '',
    passingRule: '危急值 10 分钟内通报',
    passingRuleEn: 'Critical notified within 10 minutes',
    rules: [
      { key: 'crit-marked', name: '已标记', nameEn: 'Marked', description: '危急值已标记', weight: 0.40, evaluator: 'auto' },
      { key: 'crit-notify', name: '10min 通报', nameEn: '10min notify', description: '10 分钟内通报', weight: 0.30, evaluator: 'auto' },
      { key: 'crit-ack', name: '通报确认', nameEn: 'Notify ack', description: '通报已确认', weight: 0.30, evaluator: 'auto' },
    ],
  },
  {
    key: 'accuracy_no_contradiction', category: 'accuracy',
    name: '无逻辑矛盾', nameEn: 'No Contradiction',
    description: '全文无阴阳/前后矛盾',
    descriptionEn: 'No positive/negative or internal contradictions',
    weight: 0.02, enabled: true, color: '#ea580c', icon: '',
    passingRule: '矛盾检测器返回 0 条矛盾',
    passingRuleEn: 'Contradiction detector returns 0 contradictions',
    rules: [
      { key: 'contra-neg', name: '阴阳矛盾', nameEn: 'Pos/Neg', description: '未见…出现…', weight: 0.50, evaluator: 'ai' },
      { key: 'contra-internal', name: '内部矛盾', nameEn: 'Internal', description: '前后说法矛盾', weight: 0.50, evaluator: 'ai' },
    ],
  },
  // -------- 时效性 5 维度 --------
  {
    key: 'timeliness_tat_met', category: 'timeliness',
    name: 'TAT 达标', nameEn: 'TAT Met',
    description: '报告是否在 TAT 阈值内完成',
    descriptionEn: 'Report completed within TAT threshold',
    weight: 0.08, enabled: true, color: '#f59e0b', icon: '',
    passingRule: '危急<=30min/急诊<=2h/普通<=24h',
    passingRuleEn: 'Critical<=30min/Urgent<=2h/Routine<=24h',
    rules: [
      { key: 'tat-critical', name: '危急<=30min', nameEn: 'Critical<=30m', description: '危急 30 分钟内', weight: 0.40, evaluator: 'auto' },
      { key: 'tat-urgent', name: '急诊<=2h', nameEn: 'Urgent<=2h', description: '急诊 2 小时内', weight: 0.30, evaluator: 'auto' },
      { key: 'tat-routine', name: '普通<=24h', nameEn: 'Routine<=24h', description: '普通 24 小时内', weight: 0.30, evaluator: 'auto' },
    ],
  },
  {
    key: 'timeliness_priority_handling', category: 'timeliness',
    name: '优先级处理', nameEn: 'Priority Handling',
    description: '按优先级处理',
    descriptionEn: 'Processed by priority',
    weight: 0.04, enabled: true, color: '#d97706', icon: '',
    passingRule: 'STAT 优先于普通',
    passingRuleEn: 'STAT handled before routine',
    rules: [
      { key: 'prio-stat-first', name: 'STAT 优先', nameEn: 'STAT first', description: 'STAT 优先处理', weight: 0.60, evaluator: 'auto' },
      { key: 'prio-order', name: '优先级队列', nameEn: 'Priority queue', description: '按优先级队列', weight: 0.40, evaluator: 'auto' },
    ],
  },
  {
    key: 'timeliness_on_time_rate', category: 'timeliness',
    name: '个人按时率', nameEn: 'On-Time Rate',
    description: '医生近 30 天按时率',
    descriptionEn: 'Doctor 30-day on-time rate',
    weight: 0.04, enabled: true, color: '#b45309', icon: '',
    passingRule: '按时率 >= 90%',
    passingRuleEn: 'On-time rate >= 90%',
    rules: [
      { key: 'ot-30d', name: '30d 按时率', nameEn: '30d on-time', description: '30 天按时率', weight: 1.00, evaluator: 'auto' },
    ],
  },
  {
    key: 'timeliness_submit_within_window', category: 'timeliness',
    name: '提交及时', nameEn: 'Submit Within Window',
    description: '从书写完成到提交审核时长',
    descriptionEn: 'Time from writing to submit',
    weight: 0.02, enabled: true, color: '#ca8a04', icon: '',
    passingRule: '提交间隔 <= 15 分钟',
    passingRuleEn: 'Submit interval <= 15 minutes',
    rules: [
      { key: 'sub-interval', name: '提交间隔', nameEn: 'Submit interval', description: '提交时间间隔', weight: 1.00, evaluator: 'auto' },
    ],
  },
  {
    key: 'timeliness_sign_within_window', category: 'timeliness',
    name: '签发及时', nameEn: 'Sign Within Window',
    description: '从审核完成到签发时长',
    descriptionEn: 'Time from review complete to sign',
    weight: 0.02, enabled: true, color: '#a16207', icon: '',
    passingRule: '签发间隔 <= 30 分钟',
    passingRuleEn: 'Sign interval <= 30 minutes',
    rules: [
      { key: 'sign-interval', name: '签发间隔', nameEn: 'Sign interval', description: '签发时间间隔', weight: 1.00, evaluator: 'auto' },
    ],
  },
];

export const SCORING_THRESHOLDS: ScoringThresholdConfig[] = [
  { grade: 'A', minScore: 90, maxScore: 100, color: '#047857', bg: '#d1fae5', border: '#6ee7b7', label: 'A 级 · 优秀', labelEn: 'Grade A · Excellent', publishable: true, bonusEligible: true, description: '高分优质报告,可作为模板', descriptionEn: 'Excellent - template worthy' },
  { grade: 'B', minScore: 75, maxScore: 89, color: '#1e40af', bg: '#dbeafe', border: '#93c5fd', label: 'B 级 · 良好', labelEn: 'Grade B · Good', publishable: true, bonusEligible: true, description: '良好,常规发布', descriptionEn: 'Good - publish normal' },
  { grade: 'C', minScore: 60, maxScore: 74, color: '#92400e', bg: '#fef3c7', border: '#fcd34d', label: 'C 级 · 合格', labelEn: 'Grade C · Pass', publishable: false, bonusEligible: false, description: '合格,需修改后发布', descriptionEn: 'Pass - revise before publish' },
  { grade: 'D', minScore: 0, maxScore: 59, color: '#7f1d1d', bg: '#fee2e2', border: '#fca5a5', label: 'D 级 · 不合格', labelEn: 'Grade D · Fail', publishable: false, bonusEligible: false, description: '不合格,必须重写', descriptionEn: 'Fail - rewrite required' },
];

export const INITIAL_THRESHOLD_CONFIG: ThresholdConfig = {
  id: 'threshold-default',
  criticalMaxMinutes: 30,
  emergencyMaxHours: 2,
  routineMaxHours: 24,
  inpatientMaxHours: 12,
  publishBlockThreshold: 60,
  bonusThreshold: 85,
  hardFailCodes: ['critical-not-marked', 'left-right-confusion', 'critical-not-notify'],
  updatedAt: isoOffset(-72),
  updatedBy: 'D001',
  version: 5,
};

const buildScore = (overrides: Partial<ScoreHistoryEntry>): ScoreHistoryEntry => ({
  id: 'sh-' + Math.random().toString(36).slice(2, 9),
  scoreId: 'qs-' + Math.random().toString(36).slice(2, 9),
  reportId: 'rpt-' + Math.random().toString(36).slice(2, 9).toUpperCase(),
  patientName: '患者' + Math.floor(Math.random() * 1000),
  modality: 'CT',
  doctorId: 'D00' + Math.floor(Math.random() * 9),
  doctorName: '医生',
  department: '放射科',
  categoryScores: { completeness: 90, accuracy: 92, timeliness: 88 },
  totalScore: 90,
  grade: 'A',
  evaluatedBy: 'AI',
  evaluatedAt: isoNow(),
  trigger: 'submit',
  ...overrides,
});

export const SCORE_HISTORY: ScoreHistoryEntry[] = [
  buildScore({ id: 'sh-001', scoreId: 'qs-001', reportId: 'rpt-013', patientName: '黄海涛', modality: 'CT', doctorId: 'D002', doctorName: '李慧敏', department: '放射科-CT室', categoryScores: { completeness: 92, accuracy: 95, timeliness: 100 }, totalScore: 95, grade: 'A', evaluatedBy: 'AI+人工', evaluatedAt: isoOffset(-2), trigger: 'review' }),
  buildScore({ id: 'sh-002', scoreId: 'qs-002', reportId: 'rpt-021', patientName: '谢军', modality: 'CT', doctorId: 'D002', doctorName: '李慧敏', department: '放射科-CT室', categoryScores: { completeness: 96, accuracy: 97, timeliness: 95 }, totalScore: 96, grade: 'A', evaluatedBy: 'AI+人工', evaluatedAt: isoOffset(-120), trigger: 'sign' }),
  buildScore({ id: 'sh-003', scoreId: 'qs-003', reportId: 'rpt-022', patientName: '邓丽华', modality: 'CT', doctorId: 'D003', doctorName: '王建华', department: '放射科-CT室', categoryScores: { completeness: 90, accuracy: 92, timeliness: 88 }, totalScore: 90, grade: 'A', evaluatedBy: 'AI', evaluatedAt: isoOffset(-110), trigger: 'submit' }),
  buildScore({ id: 'sh-004', scoreId: 'qs-004', reportId: 'rpt-023', patientName: '彭大海', modality: 'MR', doctorId: 'D004', doctorName: '陈晓东', department: '放射科-MR室', categoryScores: { completeness: 88, accuracy: 90, timeliness: 85 }, totalScore: 88, grade: 'B', evaluatedBy: 'AI', evaluatedAt: isoOffset(-130), trigger: 'review' }),
  buildScore({ id: 'sh-005', scoreId: 'qs-005', reportId: 'rpt-048', patientName: '武志强', modality: 'CT', doctorId: 'D004', doctorName: '陈晓东', department: '放射科-CT室', categoryScores: { completeness: 60, accuracy: 65, timeliness: 55 }, totalScore: 60, grade: 'C', evaluatedBy: 'AI', evaluatedAt: isoOffset(-220), trigger: 'manual' }),
  buildScore({ id: 'sh-006', scoreId: 'qs-006', reportId: 'rpt-049', patientName: '段丽君', modality: 'MR', doctorId: 'D007', doctorName: '孙立人', department: '放射科-MR室', categoryScores: { completeness: 85, accuracy: 88, timeliness: 80 }, totalScore: 84, grade: 'B', evaluatedBy: 'AI', evaluatedAt: isoOffset(-160), trigger: 'review' }),
  buildScore({ id: 'sh-007', scoreId: 'qs-007', reportId: 'rpt-050', patientName: '汪明轩', modality: 'CT', doctorId: 'D002', doctorName: '李慧敏', department: '放射科-CT室', categoryScores: { completeness: 94, accuracy: 96, timeliness: 92 }, totalScore: 94, grade: 'A', evaluatedBy: 'AI+人工', evaluatedAt: isoOffset(-180), trigger: 'sign' }),
  buildScore({ id: 'sh-008', scoreId: 'qs-008', reportId: 'rpt-051', patientName: '黄河山', modality: 'MR', doctorId: 'D005', doctorName: '周明远', department: '放射科-MR室', categoryScores: { completeness: 78, accuracy: 80, timeliness: 76 }, totalScore: 78, grade: 'B', evaluatedBy: 'AI', evaluatedAt: isoOffset(-240), trigger: 'review' }),
  buildScore({ id: 'sh-009', scoreId: 'qs-009', reportId: 'rpt-052', patientName: '林雪芳', modality: 'CT', doctorId: 'D006', doctorName: '吴海涛', department: '放射科-CT室', categoryScores: { completeness: 50, accuracy: 55, timeliness: 60 }, totalScore: 55, grade: 'D', evaluatedBy: 'AI', evaluatedAt: isoOffset(-300), trigger: 'submit', notes: '一票否决:危急值未标' }),
  buildScore({ id: 'sh-010', scoreId: 'qs-010', reportId: 'rpt-053', patientName: '韩冬梅', modality: 'MR', doctorId: 'D003', doctorName: '王建华', department: '放射科-MR室', categoryScores: { completeness: 91, accuracy: 89, timeliness: 93 }, totalScore: 91, grade: 'A', evaluatedBy: 'AI+人工', evaluatedAt: isoOffset(-360), trigger: 'sign' }),
];

export const BONUS_LINKAGES: BonusLinkage[] = [
  { id: 'bl-001', type: 'priority-distribution', name: '优先分发', nameEn: 'Priority Distribution', description: 'A 级报告自动触发优先分发到临床科室', descriptionEn: 'Grade A reports trigger priority distribution', thresholdScore: 90, active: true, enabled: true, benefits: ['5 分钟内送达临床', 'IM+短信双通道', '主任优先看到'], beneficiariesCount: 12, triggeredCount: 248, lastTriggeredAt: isoOffset(-3) },
  { id: 'bl-002', type: 'template-promotion', name: '模板晋升', nameEn: 'Template Promotion', description: '连续 10 份 A 级报告自动晋升为标准模板', descriptionEn: '10 consecutive A-grade reports auto-promoted to template', thresholdScore: 92, active: true, enabled: true, benefits: ['入库标准模板', '推荐给同科室医生', '作者署名'], beneficiariesCount: 4, triggeredCount: 18, lastTriggeredAt: isoOffset(-72) },
  { id: 'bl-003', type: 'kpi-bonus', name: 'KPI 加分', nameEn: 'KPI Bonus', description: 'B+ 级报告月度占比 > 80% 触发绩效加分', descriptionEn: '>80% B+ reports trigger KPI bonus', thresholdScore: 85, active: true, enabled: true, benefits: ['月度 KPI +5 分', '年终评优加分', '晋升参考'], beneficiariesCount: 8, triggeredCount: 96, lastTriggeredAt: isoOffset(-12) },
  { id: 'bl-004', type: 'peer-review-shortcut', name: '同行评议加速', nameEn: 'Peer Review Shortcut', description: 'A 级报告同行评议次数 -1', descriptionEn: 'A-grade reports -1 peer review', thresholdScore: 90, active: false, enabled: true, benefits: ['节省评议时间', '快速发布'], beneficiariesCount: 0, triggeredCount: 32 },
  { id: 'bl-005', type: 'publish-fast-track', name: '发布快通道', nameEn: 'Publish Fast-Track', description: 'A 级报告自动跳过二次审核', descriptionEn: 'A-grade reports auto-skip secondary review', thresholdScore: 92, active: true, enabled: true, benefits: ['直接发布', '节省 30 分钟'], beneficiariesCount: 10, triggeredCount: 156, lastTriggeredAt: isoOffset(-6) },
];

export const TEMPLATE_SCORE_RULES: TemplateScoreRule[] = [
  { templateId: 'tpl-ct-chest-001', templateName: '胸部 CT 标准模板', modality: 'CT', bodyPart: '胸部', baseScore: 85, passingScore: 75, published: true,
    bonusRules: [
      { dimension: 'completeness_findings', bonus: 5, description: '包含肺窗/纵隔窗描述' },
      { dimension: 'accuracy_anatomy_laterality', bonus: 3, description: '标注肺叶' },
    ],
    penaltyRules: [
      { dimension: 'completeness_recommendation', penalty: 10, description: '未给复查建议' },
      { dimension: 'accuracy_no_contradiction', penalty: 20, description: '存在矛盾描述' },
    ],
  },
  { templateId: 'tpl-mr-brain-002', templateName: '头颅 MR 标准模板', modality: 'MR', bodyPart: '头颅', baseScore: 88, passingScore: 78, published: true,
    bonusRules: [
      { dimension: 'accuracy_diagnosis_match', bonus: 5, description: '包含 ADC 值' },
      { dimension: 'accuracy_clinical_reference', bonus: 3, description: '结合临床' },
    ],
    penaltyRules: [
      { dimension: 'timeliness_tat_met', penalty: 8, description: '超过 2h 未完成' },
    ],
  },
  { templateId: 'tpl-ct-abdomen-003', templateName: '腹部 CT 标准模板', modality: 'CT', bodyPart: '腹部', baseScore: 86, passingScore: 76, published: true,
    bonusRules: [
      { dimension: 'completeness_structured', bonus: 4, description: '结构化字段填写完整' },
    ],
    penaltyRules: [
      { dimension: 'completeness_signature', penalty: 5, description: '缺少审核签名' },
    ],
  },
  { templateId: 'tpl-mr-spine-004', templateName: '脊柱 MR 标准模板', modality: 'MR', bodyPart: '脊柱', baseScore: 84, passingScore: 74, published: false,
    bonusRules: [
      { dimension: 'completeness_findings', bonus: 4, description: '包含椎体/间盘描述' },
    ],
    penaltyRules: [
      { dimension: 'accuracy_no_contradiction', penalty: 15, description: '存在矛盾' },
    ],
  },
  { templateId: 'tpl-ct-head-005', templateName: '头颅 CT 标准模板', modality: 'CT', bodyPart: '头颅', baseScore: 87, passingScore: 77, published: true,
    bonusRules: [
      { dimension: 'accuracy_critical_marking', bonus: 6, description: '危急值标记' },
    ],
    penaltyRules: [
      { dimension: 'timeliness_submit_within_window', penalty: 5, description: '提交超时' },
    ],
  },
];

export const SCORING_KPI: QualityScoringKPI = {
  totalEvaluated: 1248,
  avgTotal: 88.6,
  avgByCategory: { completeness: 90.2, accuracy: 89.5, timeliness: 86.1 },
  gradeDistribution: { A: 542, B: 478, C: 168, D: 60 },
  publishableRate: 81.7,
  bonusEligibleRate: 41.3,
  hardFailRate: 4.8,
  dimensionPassRate: {
    completeness_findings: 92, completeness_impression: 88, completeness_recommendation: 75,
    completeness_structured: 82, completeness_signature: 95,
    accuracy_diagnosis_match: 87, accuracy_anatomy_laterality: 90,
    accuracy_clinical_reference: 78, accuracy_critical_marking: 84,
    accuracy_no_contradiction: 91,
    timeliness_tat_met: 81, timeliness_priority_handling: 88,
    timeliness_on_time_rate: 86, timeliness_submit_within_window: 92,
    timeliness_sign_within_window: 89,
  },
  trend30d: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
    avgScore: 85 + Math.round(Math.random() * 8),
    evaluated: 30 + Math.floor(Math.random() * 20),
    gradeA: 12 + Math.floor(Math.random() * 8),
  })),
  doctorRanking: [
    { doctorId: 'D002', doctorName: '李慧敏', avgScore: 94.2, bonusCount: 28, rank: 1 },
    { doctorId: 'D003', doctorName: '王建华', avgScore: 91.5, bonusCount: 22, rank: 2 },
    { doctorId: 'D005', doctorName: '周明远', avgScore: 89.3, bonusCount: 18, rank: 3 },
    { doctorId: 'D004', doctorName: '陈晓东', avgScore: 87.8, bonusCount: 14, rank: 4 },
    { doctorId: 'D007', doctorName: '孙立人', avgScore: 86.4, bonusCount: 12, rank: 5 },
  ],
  templateRanking: [
    { templateId: 'tpl-ct-head-005', templateName: '头颅 CT 标准模板', avgScore: 91.2, usageCount: 188, rank: 1 },
    { templateId: 'tpl-mr-brain-002', templateName: '头颅 MR 标准模板', avgScore: 90.8, usageCount: 156, rank: 2 },
    { templateId: 'tpl-ct-chest-001', templateName: '胸部 CT 标准模板', avgScore: 89.4, usageCount: 224, rank: 3 },
    { templateId: 'tpl-ct-abdomen-003', templateName: '腹部 CT 标准模板', avgScore: 88.2, usageCount: 142, rank: 4 },
    { templateId: 'tpl-mr-spine-004', templateName: '脊柱 MR 标准模板', avgScore: 86.5, usageCount: 78, rank: 5 },
  ],
};

// ============== 评分计算 ==============
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const round = (v: number) => Math.round(v * 10) / 10;

const computeDimensionFromRules = (
  dim: ScoringDimension,
  submission: ScoringSubmission,
  _threshold: ThresholdConfig,
): { score: number; evidence: ScoringEvaluationResult['evidence']; issues: string[] } => {
  const evidence: ScoringEvaluationResult['evidence'] = [];
  const issues: string[] = [];
  let totalWeighted = 0;
  let totalWeight = 0;
  for (const rule of dim.rules) {
    let ruleScore = 100;
    let explanation = '';
    switch (rule.key) {
      case 'findings-length':
        ruleScore = submission.findings.length >= 80 ? 100 : (submission.findings.length / 80) * 100;
        explanation = `所见长度 ${submission.findings.length} 字符`;
        break;
      case 'findings-location':
      case 'findings-morphology':
      case 'findings-size':
      case 'findings-density':
        ruleScore = Math.random() > 0.2 ? 95 : 75;
        explanation = ruleScore >= 90 ? '要素已包含' : '要素不完整';
        if (ruleScore < 90) issues.push(`${rule.name}缺失`);
        break;
      case 'impression-length':
        ruleScore = submission.impression.length >= 30 ? 100 : (submission.impression.length / 30) * 100;
        explanation = `印象长度 ${submission.impression.length}`;
        break;
      case 'impression-primary':
      case 'impression-secondary':
      case 'impression-order':
        ruleScore = submission.impression.length > 20 ? 92 : 70;
        explanation = '印象结构良好';
        break;
      case 'rec-follow':
        ruleScore = /随访|复查|随诊/.test(submission.recommendation) ? 100 : 40;
        explanation = ruleScore === 100 ? '随访建议已包含' : '缺少随访建议';
        if (ruleScore < 100) issues.push('缺少随访建议');
        break;
      case 'rec-review':
        ruleScore = /复查|建议/.test(submission.recommendation) ? 100 : 50;
        explanation = ruleScore === 100 ? '复查建议已包含' : '缺少复查建议';
        break;
      case 'struct-fillrate':
        ruleScore = clamp(submission.structuredFieldsComplete * 100, 0, 100);
        explanation = `结构化字段填写率 ${(submission.structuredFieldsComplete * 100).toFixed(0)}%`;
        if (submission.structuredFieldsComplete < 0.8) issues.push('结构化字段不足');
        break;
      case 'struct-required':
        ruleScore = submission.structuredFieldsComplete >= 0.8 ? 100 : 70;
        explanation = '必填项检查';
        break;
      case 'sig-doctor':
        ruleScore = submission.signed ? 100 : 0;
        explanation = submission.signed ? '医生签名存在' : '缺少医生签名';
        if (!submission.signed) issues.push('缺医生签名');
        break;
      case 'sig-reviewer':
        ruleScore = Math.random() > 0.1 ? 95 : 60;
        explanation = '审核签名检查';
        break;
      case 'match-similarity':
        ruleScore = submission.diagnosis.length > 5 && submission.findings.length > 30 ? 92 : 60;
        explanation = 'AI 相似度 0.92';
        break;
      case 'match-keyterm':
        ruleScore = submission.diagnosis.length > 5 ? 90 : 65;
        explanation = '关键术语匹配';
        break;
      case 'lat-correct':
        ruleScore = /(左|右|双侧)/.test(submission.findings) ? 95 : 60;
        explanation = '左右侧标注';
        if (ruleScore < 90) issues.push('左右标注可能错误');
        break;
      case 'lat-anatomy':
        ruleScore = submission.findings.length > 30 ? 90 : 70;
        explanation = '解剖名称';
        break;
      case 'clin-history':
        ruleScore = /(病史|临床|主诉)/.test(submission.findings) ? 95 : 70;
        explanation = '临床病史引用';
        break;
      case 'clin-lab':
        ruleScore = /(化验|指标|数值)/.test(submission.findings) ? 90 : 65;
        explanation = '化验引用';
        break;
      case 'crit-marked':
        ruleScore = submission.criticalMarked ? 100 : 0;
        explanation = submission.criticalMarked ? '危急值已标记' : '危急值未标记';
        if (!submission.criticalMarked && /危急|紧急/.test(submission.findings)) issues.push('危急值未标');
        break;
      case 'crit-notify':
        ruleScore = submission.criticalMarked ? 95 : 80;
        explanation = '10 分钟内通报';
        break;
      case 'crit-ack':
        ruleScore = submission.criticalMarked ? 90 : 75;
        explanation = '通报确认';
        break;
      case 'contra-neg':
        ruleScore = /未见.*?(出现|可见|发现)/.test(submission.findings) ? 30 : 100;
        explanation = ruleScore < 50 ? '检测到矛盾' : '无矛盾';
        if (ruleScore < 50) issues.push('阴阳矛盾');
        break;
      case 'contra-internal':
        ruleScore = 95;
        explanation = '内部一致性';
        break;
      case 'tat-critical':
      case 'tat-urgent':
      case 'tat-routine': {
        const submit = new Date(submission.submitAt).getTime();
        const signed = new Date(submission.signedAt).getTime();
        const hours = (signed - submit) / 3600000;
        if (submission.priority === 'stat') ruleScore = hours <= 0.5 ? 100 : 40;
        else if (submission.priority === 'urgent') ruleScore = hours <= 2 ? 100 : 60;
        else ruleScore = hours <= 24 ? 100 : 50;
        explanation = `耗时 ${hours.toFixed(1)} 小时`;
        if (ruleScore < 60) issues.push('TAT 超时');
        break;
      }
      case 'prio-stat-first':
        ruleScore = submission.priority === 'stat' ? 100 : 85;
        explanation = '优先级处理';
        break;
      case 'prio-order':
        ruleScore = 92;
        explanation = '优先级队列';
        break;
      case 'ot-30d':
        ruleScore = 86 + Math.random() * 8;
        explanation = `30 天按时率 ${Math.round(ruleScore)}%`;
        break;
      case 'sub-interval': {
        const submit = new Date(submission.submitAt).getTime();
        const reviewStart = new Date(submission.reviewStartedAt).getTime();
        const minutes = (submit - reviewStart) / 60000;
        ruleScore = minutes <= 15 ? 100 : 70;
        explanation = `提交间隔 ${Math.round(minutes)} 分钟`;
        break;
      }
      case 'sign-interval': {
        const review = new Date(submission.reviewStartedAt).getTime();
        const signed = new Date(submission.signedAt).getTime();
        const minutes = (signed - review) / 60000;
        ruleScore = minutes <= 30 ? 100 : 65;
        explanation = `签发间隔 ${Math.round(minutes)} 分钟`;
        break;
      }
      default:
        ruleScore = 90;
        explanation = '默认评分';
    }
    totalWeighted += ruleScore * rule.weight;
    totalWeight += rule.weight;
    evidence.push({ dimension: dim.key, rule: rule.key, score: Math.round(ruleScore), explanation });
  }
  const score = totalWeight > 0 ? clamp(totalWeighted / totalWeight, 0, 100) : 0;
  return { score: round(score), evidence, issues };
};

export const evaluateScoring = (
  submission: ScoringSubmission,
  threshold: ThresholdConfig = INITIAL_THRESHOLD_CONFIG,
): ScoringEvaluationResult => {
  const start = Date.now();
  const dimensionScores: Record<ScoringDimensionKey, number> = {} as Record<ScoringDimensionKey, number>;
  const categorySums: Record<'completeness' | 'accuracy' | 'timeliness', { score: number; weight: number }> = {
    completeness: { score: 0, weight: 0 },
    accuracy: { score: 0, weight: 0 },
    timeliness: { score: 0, weight: 0 },
  };
  const allEvidence: ScoringEvaluationResult['evidence'] = [];
  const allIssues: string[] = [];
  const hardFailTriggered: string[] = [];
  for (const dim of SCORING_DIMENSIONS) {
    if (!dim.enabled) {
      dimensionScores[dim.key] = 0;
      continue;
    }
    const { score, evidence, issues } = computeDimensionFromRules(dim, submission, threshold);
    dimensionScores[dim.key] = score;
    categorySums[dim.category].score += score * dim.weight;
    categorySums[dim.category].weight += dim.weight;
    allEvidence.push(...evidence);
    allIssues.push(...issues);
  }
  const categoryScores: Record<'completeness' | 'accuracy' | 'timeliness', number> = {
    completeness: categorySums.completeness.weight > 0 ? round(categorySums.completeness.score / categorySums.completeness.weight) : 0,
    accuracy: categorySums.accuracy.weight > 0 ? round(categorySums.accuracy.score / categorySums.accuracy.weight) : 0,
    timeliness: categorySums.timeliness.weight > 0 ? round(categorySums.timeliness.score / categorySums.timeliness.weight) : 0,
  };
  const totalWeight = SCORING_DIMENSIONS.reduce((a, d) => a + d.weight, 0);
  const weightedTotal = SCORING_DIMENSIONS.reduce((a, d) => a + dimensionScores[d.key] * d.weight, 0) / totalWeight;
  const totalScore = Math.round(weightedTotal * 10) / 10;
  const grade: ScoringGrade = totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 60 ? 'C' : 'D';
  const passed = totalScore >= threshold.publishBlockThreshold;
  const publishable = passed && grade !== 'D';
  const bonusEligible = totalScore >= threshold.bonusThreshold;
  if (!submission.criticalMarked && /危急|紧急|致命/.test(submission.findings)) {
    hardFailTriggered.push('critical-not-marked');
  }
  if (allIssues.some((i) => i.includes('矛盾'))) hardFailTriggered.push('left-right-confusion');
  if (hardFailTriggered.length === 0 && allIssues.some((i) => i.includes('矛盾'))) {
    hardFailTriggered.push('contradiction-detected');
  }
  return {
    scoreId: 'qs-' + Date.now(),
    reportId: submission.reportId,
    dimensionScores,
    categoryScores,
    weightedTotal: Math.round(weightedTotal * 10) / 10,
    totalScore,
    grade,
    passed,
    publishable,
    bonusEligible,
    hardFailTriggered,
    evaluatedAt: isoNow(),
    modelVersion: 'scoring-v3.0.5.1',
    evaluator: 'auto',
    evidence: allEvidence.slice(0, 30),
    durationMs: Date.now() - start,
  };
};

export const computeTemplateScore = (
  templateId: string,
  submission: ScoringSubmission,
): ScoreTemplateResult => {
  const template = TEMPLATE_SCORE_RULES.find((t) => t.templateId === templateId);
  if (!template) {
    return {
      templateId,
      templateName: '未知模板',
      baseScore: 80,
      bonusApplied: 0,
      penaltyApplied: 0,
      finalScore: 80,
      passingScore: 60,
      passed: true,
      details: [],
    };
  }
  const evaluation = evaluateScoring(submission);
  let bonusApplied = 0;
  let penaltyApplied = 0;
  const details = template.bonusRules.concat(template.penaltyRules.map((r) => ({ ...r, bonus: -r.penalty, penalty: r.penalty }))).map((rule) => {
    const dimScore = evaluation.dimensionScores[rule.dimension] ?? 0;
    if (rule.bonus > 0 && dimScore >= 85) bonusApplied += rule.bonus;
    if (rule.bonus < 0 && dimScore < 70) penaltyApplied += Math.abs(rule.bonus);
    return { dimension: rule.dimension, base: dimScore, bonus: rule.bonus > 0 && dimScore >= 85 ? rule.bonus : 0, penalty: rule.bonus < 0 && dimScore < 70 ? Math.abs(rule.bonus) : 0, final: dimScore };
  });
  const finalScore = clamp(Math.round((template.baseScore + bonusApplied - penaltyApplied) * 10) / 10, 0, 100);
  return {
    templateId,
    templateName: template.templateName,
    baseScore: template.baseScore,
    bonusApplied,
    penaltyApplied,
    finalScore,
    passingScore: template.passingScore,
    passed: finalScore >= template.passingScore,
    details,
  };
};

export const getScoreHistory = (query: ScoreHistoryQuery = {}): ScoreHistoryResponse => {
  let list = SCORE_HISTORY.slice();
  if (query.doctorId) list = list.filter((s) => s.doctorId === query.doctorId);
  if (query.department) list = list.filter((s) => s.department === query.department);
  if (query.modality) list = list.filter((s) => s.modality === query.modality);
  if (query.grade) list = list.filter((s) => s.grade === query.grade);
  if (query.trigger) list = list.filter((s) => s.trigger === query.trigger);
  if (query.dateFrom) list = list.filter((s) => s.evaluatedAt >= query.dateFrom!);
  if (query.dateTo) list = list.filter((s) => s.evaluatedAt <= query.dateTo!);
  list.sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt));
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  const start = (page - 1) * pageSize;
  return {
    items: list.slice(start, start + pageSize),
    total: list.length,
    page,
    pageSize,
    totalPages: Math.ceil(list.length / pageSize),
  };
};

export const SAMPLE_SUBMISSIONS: ScoringSubmission[] = [
  {
    id: 'sub-001', reportId: 'rpt-013', patientName: '黄海涛', modality: 'CT', bodyPart: '胸部',
    doctorId: 'D002', doctorName: '李慧敏', doctorTitle: '副主任医师', department: '放射科-CT室',
    findings: '双肺纹理清晰,右肺上叶见一结节影,大小约 12mm×10mm,密度均匀,边界清楚,增强扫描可见轻度强化。纵隔窗未见肿大淋巴结。',
    impression: '1. 右肺上叶结节,考虑良性可能性大,建议 3 个月复查胸部 CT。 2. 纵隔未见异常。',
    diagnosis: '右肺上叶结节(R91.001)',
    recommendation: '建议 3 个月后复查胸部 CT 平扫+增强,对比变化。',
    criticalMarked: false, structuredFieldsComplete: 0.92, signed: true,
    submitAt: isoOffset(-2), reviewStartedAt: isoOffset(-2.1), signedAt: isoOffset(-1.9),
    priority: 'routine', templateId: 'tpl-ct-chest-001',
  },
  {
    id: 'sub-002', reportId: 'rpt-021', patientName: '谢军', modality: 'CT', bodyPart: '头颅',
    doctorId: 'D002', doctorName: '李慧敏', doctorTitle: '副主任医师', department: '放射科-CT室',
    findings: '颅骨骨质完整,脑实质未见明显异常密度影,脑室系统未见扩大,脑中线结构居中。',
    impression: '头颅 CT 平扫未见明显异常。',
    diagnosis: '头颅 CT 未见明显异常',
    recommendation: '无需特殊处理,如有症状门诊随诊。',
    criticalMarked: false, structuredFieldsComplete: 0.88, signed: true,
    submitAt: isoOffset(-120), reviewStartedAt: isoOffset(-120.2), signedAt: isoOffset(-119.5),
    priority: 'routine', templateId: 'tpl-ct-head-005',
  },
];