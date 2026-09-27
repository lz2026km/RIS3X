/**
 * [G005 W9-QC] 统一量表默认数据 — 由前端 15 维度 (5 完整 + 5 准确 + 5 时效) 迁移而来。
 * 单一加权模型: 3 维度 (完整性/准确性/时效性) → 15 子项 → 判定规则。
 * 口径对齐国卫办医政函〔2024〕150 号 附件4。
 */
import type { QualityRubric, RubricDimension } from './quality-rubric.types'

export const RUBRIC_STANDARD = '国卫办医政函〔2024〕150号 附件4（统一质控评分量表 v3）'

export const DEFAULT_GRADE_BANDS = [
  { grade: 'A', min: 90, max: 100, label: 'A 级 · 优秀', labelEn: 'Grade A · Excellent', publishable: true, bonusEligible: true, color: '#047857' },
  { grade: 'B', min: 75, max: 89, label: 'B 级 · 良好', labelEn: 'Grade B · Good', publishable: true, bonusEligible: true, color: '#1e40af' },
  { grade: 'C', min: 60, max: 74, label: 'C 级 · 合格', labelEn: 'Grade C · Pass', publishable: false, bonusEligible: false, color: '#92400e' },
  { grade: 'D', min: 0, max: 59, label: 'D 级 · 不合格', labelEn: 'Grade D · Fail', publishable: false, bonusEligible: false, color: '#7f1d1d' },
]

export const DEFAULT_DIMENSIONS: RubricDimension[] = [
  {
    key: 'completeness',
    name: '完整性',
    nameEn: 'Completeness',
    weight: 0.34,
    description: '检查所见/诊断印象/建议/结构化字段/签名 5 项完整',
    subItems: [
      {
        key: 'completeness_findings',
        name: '检查所见完整性',
        nameEn: 'Findings Completeness',
        weight: 0.2,
        rules: [
          { key: 'findings-length', name: '长度>=80', weight: 0.4, kind: 'minLength', field: 'findings', min: 80, explanation: '所见长度' },
          { key: 'findings-location', name: '含部位', weight: 0.15, kind: 'presence', field: 'findings', pattern: '左|右|双侧|段|叶|区|部', explanation: '解剖部位' },
          { key: 'findings-morphology', name: '含形态', weight: 0.15, kind: 'presence', field: 'findings', pattern: '形态|边界|边缘|分叶|毛刺|规则', explanation: '病灶形态' },
          { key: 'findings-size', name: '含大小', weight: 0.15, kind: 'presence', field: 'findings', pattern: '\\d+(\\.\\d+)?\\s*(mm|cm|毫米|厘米)', explanation: '尺寸测量' },
          { key: 'findings-density', name: '含密度/信号', weight: 0.15, kind: 'presence', field: 'findings', pattern: '密度|信号|CT值|强化|回声', explanation: '密度/信号' },
        ],
      },
      {
        key: 'completeness_impression',
        name: '诊断印象完整性',
        nameEn: 'Impression Completeness',
        weight: 0.2,
        rules: [
          { key: 'impression-length', name: '长度>=30', weight: 0.4, kind: 'minLength', field: 'impression', min: 30, explanation: '印象长度' },
          { key: 'impression-primary', name: '主要诊断', weight: 0.3, kind: 'presence', field: 'impression', pattern: '考虑|诊断|符合|提示|结论', explanation: '主要诊断' },
          { key: 'impression-order', name: '主次排序', weight: 0.2, kind: 'presence', field: 'impression', pattern: '1[.、)]|①|首要', explanation: '主次排序' },
          { key: 'impression-secondary', name: '次要诊断', weight: 0.1, kind: 'presence', field: 'impression', pattern: '2[.、)]|②|其次', explanation: '次要诊断' },
        ],
      },
      {
        key: 'completeness_recommendation',
        name: '建议完整性',
        nameEn: 'Recommendation Completeness',
        weight: 0.15,
        rules: [
          { key: 'rec-follow', name: '随访建议', weight: 0.5, kind: 'presence', field: 'recommendation', pattern: '随访|复查|随诊|复诊', explanation: '随访建议' },
          { key: 'rec-review', name: '复查建议', weight: 0.5, kind: 'presence', field: 'recommendation', pattern: '建议|治疗|处理|进一步', explanation: '处理/复查建议' },
        ],
      },
      {
        key: 'completeness_structured',
        name: '结构化字段完整',
        nameEn: 'Structured Fields',
        weight: 0.25,
        rules: [
          { key: 'struct-fillrate', name: '填写率>=80%', weight: 0.6, kind: 'minRatio', field: 'structuredFieldsComplete', min: 0.8, explanation: '结构化字段填写率' },
          { key: 'struct-required', name: '必填项无遗漏', weight: 0.4, kind: 'minRatio', field: 'structuredFieldsComplete', min: 0.8, explanation: '必填项完整性' },
        ],
      },
      {
        key: 'completeness_signature',
        name: '签名完整',
        nameEn: 'Signature',
        weight: 0.2,
        rules: [
          { key: 'sig-doctor', name: '医生签名', weight: 0.5, kind: 'booleanTrue', field: 'signed', explanation: '医生签名' },
          { key: 'sig-reviewer', name: '审核签名', weight: 0.5, kind: 'booleanTrue', field: 'hasReviewerSignature', explanation: '审核签名' },
        ],
      },
    ],
  },
  {
    key: 'accuracy',
    name: '准确性',
    nameEn: 'Accuracy',
    weight: 0.4,
    description: '所见-诊断一致/解剖方位/结合临床/危急值标记/无逻辑矛盾 5 项',
    subItems: [
      {
        key: 'accuracy_diagnosis_match',
        name: '所见-诊断一致',
        nameEn: 'Findings-Diagnosis Match',
        weight: 0.3,
        rules: [
          { key: 'match-similarity', name: 'AI 相似度', weight: 0.6, kind: 'presence', field: 'diagnosis', pattern: '.{4,}', explanation: '诊断结论非空' },
          { key: 'match-keyterm', name: '关键术语', weight: 0.4, kind: 'presence', field: 'findings', pattern: '考虑|提示|符合|待排', explanation: '关键术语匹配' },
        ],
      },
      {
        key: 'accuracy_anatomy_laterality',
        name: '解剖方位正确',
        nameEn: 'Anatomy & Laterality',
        weight: 0.2,
        rules: [
          { key: 'lat-correct', name: '左右一致', weight: 0.6, kind: 'leftRightOk', explanation: '左右方位一致' },
          { key: 'lat-anatomy', name: '解剖名称', weight: 0.4, kind: 'presence', field: 'findings', pattern: '左|右|双侧|中线|纵隔', explanation: '解剖名称' },
        ],
      },
      {
        key: 'accuracy_clinical_reference',
        name: '结合临床',
        nameEn: 'Clinical Reference',
        weight: 0.2,
        rules: [
          { key: 'clin-history', name: '临床病史', weight: 0.5, kind: 'presence', field: 'findings', pattern: '病史|临床|主诉|既往|术后', explanation: '临床病史引用' },
          { key: 'clin-lab', name: '化验引用', weight: 0.5, kind: 'presence', field: 'findings', pattern: '化验|指标|实验室|肿瘤标志物', explanation: '化验引用' },
        ],
      },
      {
        key: 'accuracy_critical_marking',
        name: '危急值标记',
        nameEn: 'Critical Marking',
        weight: 0.2,
        rules: [
          { key: 'crit-marked', name: '已标记', weight: 0.4, kind: 'booleanTrue', field: 'criticalMarked', explanation: '危急值已标记' },
          { key: 'crit-notify', name: '10min 通报', weight: 0.3, kind: 'booleanTrue', field: 'criticalNotified', explanation: '10 分钟内通报' },
          { key: 'crit-ack', name: '通报确认', weight: 0.3, kind: 'booleanTrue', field: 'criticalAcked', explanation: '通报已确认' },
        ],
      },
      {
        key: 'accuracy_no_contradiction',
        name: '无逻辑矛盾',
        nameEn: 'No Contradiction',
        weight: 0.1,
        rules: [
          { key: 'contra-neg', name: '阴阳矛盾', weight: 0.5, kind: 'absence', field: 'findings', pattern: '未见.{0,6}(出现|可见|发现)', explanation: '无阴阳矛盾' },
          { key: 'contra-internal', name: '内部矛盾', weight: 0.5, kind: 'absence', field: 'findings', pattern: '矛盾|前后不符|与所示不符', explanation: '内部一致' },
        ],
      },
    ],
  },
  {
    key: 'timeliness',
    name: '时效性',
    nameEn: 'Timeliness',
    weight: 0.26,
    description: 'TAT 达标/优先级处理/个人按时率/提交及时/签发及时 5 项',
    subItems: [
      {
        key: 'timeliness_tat_met',
        name: 'TAT 达标',
        nameEn: 'TAT Met',
        weight: 0.32,
        rules: [
          { key: 'tat-critical', name: '危急<=30min', weight: 0.4, kind: 'intervalMinutes', from: 'submitAt', to: 'signedAt', max: 30, explanation: '危急 TAT' },
          { key: 'tat-urgent', name: '急诊<=2h', weight: 0.3, kind: 'intervalMinutes', from: 'submitAt', to: 'signedAt', max: 120, explanation: '急诊 TAT' },
          { key: 'tat-routine', name: '普通<=24h', weight: 0.3, kind: 'intervalMinutes', from: 'submitAt', to: 'signedAt', max: 1440, explanation: '普通 TAT' },
        ],
      },
      {
        key: 'timeliness_priority_handling',
        name: '优先级处理',
        nameEn: 'Priority Handling',
        weight: 0.16,
        rules: [
          { key: 'prio-stat-first', name: 'STAT 优先', weight: 0.6, kind: 'priorityStat', explanation: 'STAT 优先处理' },
          { key: 'prio-order', name: '优先级队列', weight: 0.4, kind: 'booleanTrue', field: 'priorityQueue', explanation: '按优先级队列' },
        ],
      },
      {
        key: 'timeliness_on_time_rate',
        name: '个人按时率',
        nameEn: 'On-Time Rate',
        weight: 0.16,
        rules: [
          { key: 'ot-30d', name: '30d 按时率', weight: 1, kind: 'minRatio', field: 'onTimeRate', min: 90, explanation: '30 天按时率' },
        ],
      },
      {
        key: 'timeliness_submit_within_window',
        name: '提交及时',
        nameEn: 'Submit Within Window',
        weight: 0.18,
        rules: [
          { key: 'sub-interval', name: '提交间隔', weight: 1, kind: 'intervalMinutes', from: 'reviewStartedAt', to: 'submitAt', max: 15, explanation: '提交时间间隔' },
        ],
      },
      {
        key: 'timeliness_sign_within_window',
        name: '签发及时',
        nameEn: 'Sign Within Window',
        weight: 0.18,
        rules: [
          { key: 'sign-interval', name: '签发间隔', weight: 1, kind: 'intervalMinutes', from: 'reviewStartedAt', to: 'signedAt', max: 30, explanation: '签发时间间隔' },
        ],
      },
    ],
  },
]

export function buildDefaultRubric(): QualityRubric {
  return {
    id: 'QR-DEFAULT',
    name: '放射报告统一质控评分量表',
    nameEn: 'Radiology Report Unified QC Rubric',
    version: 3,
    standard: RUBRIC_STANDARD,
    passThreshold: 60,
    bonusThreshold: 85,
    dimensions: DEFAULT_DIMENSIONS.map((d) => ({
      ...d,
      subItems: d.subItems.map((s) => ({ ...s, rules: s.rules.map((r) => ({ ...r })) })),
    })),
    gradeBands: DEFAULT_GRADE_BANDS.map((b) => ({ ...b })),
    hardFailPatterns: ['XXX', '待补充', '占位符', '模板残留', '脏器缺如', '患者姓名不符'],
    updatedAt: '2026-08-14T00:00:00.000Z',
    updatedBy: 'system',
  }
}
