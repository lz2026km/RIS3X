// [G005 W9-QC] /api/v1 质量管理专业化 MSW handlers (确定性)
// 对齐后端:
//   quality-rubric (量表/evaluate) · quality-indicators (compute/dashboard)
//   qc-pdca (actions/findings/metrics) · dual-read (sampling/agreement)
//   report-peer-review (defect-stats) · defect-library · equipment-qc
// 页面: /qc/scoring-center (QualityScoringCenterPage)
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1';

const delayMs = (min = 40, max = 120) => Math.floor(Math.random() * (max - min) + min);

// ================= 统一量表 =================

type RuleKind = 'presence' | 'absence' | 'minLength' | 'minRatio' | 'booleanTrue' | 'intervalMinutes' | 'priorityStat' | 'leftRightOk';

interface RubricRule { key: string; name: string; weight: number; kind: RuleKind; field?: string; pattern?: string; min?: number; from?: string; to?: string; max?: number; explanation?: string }
interface RubricSubItem { key: string; name: string; weight: number; rules: RubricRule[] }
interface RubricDimension { key: string; name: string; weight: number; description?: string; subItems: RubricSubItem[] }

const DIMENSIONS: RubricDimension[] = [
  {
    key: 'completeness', name: '完整性', weight: 0.34, description: '所见/印象/建议/结构化/签名 5 项',
    subItems: [
      { key: 'completeness_findings', name: '检查所见完整性', weight: 0.2, rules: [
        { key: 'findings-length', name: '长度>=80', weight: 0.4, kind: 'minLength', field: 'findings', min: 80 },
        { key: 'findings-location', name: '含部位', weight: 0.15, kind: 'presence', field: 'findings', pattern: '左|右|双侧|段|叶' },
        { key: 'findings-morphology', name: '含形态', weight: 0.15, kind: 'presence', field: 'findings', pattern: '形态|边界|分叶' },
        { key: 'findings-size', name: '含大小', weight: 0.15, kind: 'presence', field: 'findings', pattern: '\\d+(\\.\\d+)?\\s*(mm|cm)' },
        { key: 'findings-density', name: '含密度', weight: 0.15, kind: 'presence', field: 'findings', pattern: '密度|信号|强化' },
      ] },
      { key: 'completeness_impression', name: '诊断印象完整性', weight: 0.2, rules: [
        { key: 'impression-length', name: '长度>=30', weight: 0.4, kind: 'minLength', field: 'impression', min: 30 },
        { key: 'impression-primary', name: '主要诊断', weight: 0.3, kind: 'presence', field: 'impression', pattern: '考虑|诊断|符合' },
        { key: 'impression-order', name: '主次排序', weight: 0.2, kind: 'presence', field: 'impression', pattern: '1[.、)]' },
        { key: 'impression-secondary', name: '次要诊断', weight: 0.1, kind: 'presence', field: 'impression', pattern: '2[.、)]' },
      ] },
      { key: 'completeness_recommendation', name: '建议完整性', weight: 0.15, rules: [
        { key: 'rec-follow', name: '随访建议', weight: 0.5, kind: 'presence', field: 'recommendation', pattern: '随访|复查|随诊' },
        { key: 'rec-review', name: '复查建议', weight: 0.5, kind: 'presence', field: 'recommendation', pattern: '建议|治疗' },
      ] },
      { key: 'completeness_structured', name: '结构化字段完整', weight: 0.25, rules: [
        { key: 'struct-fillrate', name: '填写率>=80%', weight: 0.6, kind: 'minRatio', field: 'structuredFieldsComplete', min: 0.8 },
        { key: 'struct-required', name: '必填项无遗漏', weight: 0.4, kind: 'minRatio', field: 'structuredFieldsComplete', min: 0.8 },
      ] },
      { key: 'completeness_signature', name: '签名完整', weight: 0.2, rules: [
        { key: 'sig-doctor', name: '医生签名', weight: 0.5, kind: 'booleanTrue', field: 'signed' },
        { key: 'sig-reviewer', name: '审核签名', weight: 0.5, kind: 'booleanTrue', field: 'hasReviewerSignature' },
      ] },
    ],
  },
  {
    key: 'accuracy', name: '准确性', weight: 0.4, description: '一致/方位/临床/危急值/无矛盾 5 项',
    subItems: [
      { key: 'accuracy_diagnosis_match', name: '所见-诊断一致', weight: 0.3, rules: [
        { key: 'match-similarity', name: 'AI 相似度', weight: 0.6, kind: 'presence', field: 'diagnosis', pattern: '.{4,}' },
        { key: 'match-keyterm', name: '关键术语', weight: 0.4, kind: 'presence', field: 'findings', pattern: '考虑|提示|符合' },
      ] },
      { key: 'accuracy_anatomy_laterality', name: '解剖方位正确', weight: 0.2, rules: [
        { key: 'lat-correct', name: '左右一致', weight: 0.6, kind: 'leftRightOk' },
        { key: 'lat-anatomy', name: '解剖名称', weight: 0.4, kind: 'presence', field: 'findings', pattern: '左|右|双侧|中线' },
      ] },
      { key: 'accuracy_clinical_reference', name: '结合临床', weight: 0.2, rules: [
        { key: 'clin-history', name: '临床病史', weight: 0.5, kind: 'presence', field: 'findings', pattern: '病史|临床|主诉|既往' },
        { key: 'clin-lab', name: '化验引用', weight: 0.5, kind: 'presence', field: 'findings', pattern: '化验|指标|实验室' },
      ] },
      { key: 'accuracy_critical_marking', name: '危急值标记', weight: 0.2, rules: [
        { key: 'crit-marked', name: '已标记', weight: 0.4, kind: 'booleanTrue', field: 'criticalMarked' },
        { key: 'crit-notify', name: '10min 通报', weight: 0.3, kind: 'booleanTrue', field: 'criticalNotified' },
        { key: 'crit-ack', name: '通报确认', weight: 0.3, kind: 'booleanTrue', field: 'criticalAcked' },
      ] },
      { key: 'accuracy_no_contradiction', name: '无逻辑矛盾', weight: 0.1, rules: [
        { key: 'contra-neg', name: '阴阳矛盾', weight: 0.5, kind: 'absence', field: 'findings', pattern: '未见.{0,6}(出现|可见|发现)' },
        { key: 'contra-internal', name: '内部矛盾', weight: 0.5, kind: 'absence', field: 'findings', pattern: '矛盾|前后不符' },
      ] },
    ],
  },
  {
    key: 'timeliness', name: '时效性', weight: 0.26, description: 'TAT/优先级/按时率/提交/签发 5 项',
    subItems: [
      { key: 'timeliness_tat_met', name: 'TAT 达标', weight: 0.32, rules: [
        { key: 'tat-critical', name: '危急<=30min', weight: 0.4, kind: 'intervalMinutes', from: 'submitAt', to: 'signedAt', max: 30 },
        { key: 'tat-urgent', name: '急诊<=2h', weight: 0.3, kind: 'intervalMinutes', from: 'submitAt', to: 'signedAt', max: 120 },
        { key: 'tat-routine', name: '普通<=24h', weight: 0.3, kind: 'intervalMinutes', from: 'submitAt', to: 'signedAt', max: 1440 },
      ] },
      { key: 'timeliness_priority_handling', name: '优先级处理', weight: 0.16, rules: [
        { key: 'prio-stat-first', name: 'STAT 优先', weight: 0.6, kind: 'priorityStat' },
        { key: 'prio-order', name: '优先级队列', weight: 0.4, kind: 'booleanTrue', field: 'priorityQueue' },
      ] },
      { key: 'timeliness_on_time_rate', name: '个人按时率', weight: 0.16, rules: [
        { key: 'ot-30d', name: '30d 按时率', weight: 1, kind: 'minRatio', field: 'onTimeRate', min: 90 },
      ] },
      { key: 'timeliness_submit_within_window', name: '提交及时', weight: 0.18, rules: [
        { key: 'sub-interval', name: '提交间隔', weight: 1, kind: 'intervalMinutes', from: 'reviewStartedAt', to: 'submitAt', max: 15 },
      ] },
      { key: 'timeliness_sign_within_window', name: '签发及时', weight: 0.18, rules: [
        { key: 'sign-interval', name: '签发间隔', weight: 1, kind: 'intervalMinutes', from: 'reviewStartedAt', to: 'signedAt', max: 30 },
      ] },
    ],
  },
];

const GRADE_BANDS = [
  { grade: 'A', min: 90, max: 100, label: 'A 级 · 优秀', labelEn: 'Grade A · Excellent', publishable: true, bonusEligible: true, color: '#047857' },
  { grade: 'B', min: 75, max: 89, label: 'B 级 · 良好', labelEn: 'Grade B · Good', publishable: true, bonusEligible: true, color: '#1e40af' },
  { grade: 'C', min: 60, max: 74, label: 'C 级 · 合格', labelEn: 'Grade C · Pass', publishable: false, bonusEligible: false, color: '#92400e' },
  { grade: 'D', min: 0, max: 59, label: 'D 级 · 不合格', labelEn: 'Grade D · Fail', publishable: false, bonusEligible: false, color: '#7f1d1d' },
];

const RUBRIC_STANDARD = '国卫办医政函〔2024〕150号 附件4（统一质控评分量表 v3）';

let rubricVersion = 3;
let rubricUpdatedAt = '2026-08-14T00:00:00.000Z';
let rubricPassThreshold = 60;
let rubricBonusThreshold = 85;
let evaluationCount = 0;

function rubricEnvelope() {
  return {
    id: 'QR-DEFAULT',
    name: '放射报告统一质控评分量表',
    nameEn: 'Radiology Report Unified QC Rubric',
    version: rubricVersion,
    standard: RUBRIC_STANDARD,
    passThreshold: rubricPassThreshold,
    bonusThreshold: rubricBonusThreshold,
    dimensions: DIMENSIONS,
    gradeBands: GRADE_BANDS,
    hardFailPatterns: ['XXX', '待补充', '占位符', '模板残留', '脏器缺如', '患者姓名不符'],
    updatedAt: rubricUpdatedAt,
    updatedBy: 'system',
  };
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

function scoreRule(r: RubricRule, sub: Record<string, unknown>): { score: number; passed: boolean; explanation: string } {
  const text = String(sub[r.field ?? ''] ?? '');
  const numVal = typeof sub[r.field ?? ''] === 'number' ? (sub[r.field ?? ''] as number) : undefined;
  const boolVal = typeof sub[r.field ?? ''] === 'boolean' ? (sub[r.field ?? ''] as boolean) : undefined;
  switch (r.kind) {
    case 'presence': {
      const passed = r.pattern ? new RegExp(r.pattern).test(text) : false;
      return { score: passed ? 100 : 0, passed, explanation: passed ? '满足' : '未满足' };
    }
    case 'absence': {
      const hit = r.pattern ? new RegExp(r.pattern).test(text) : false;
      return { score: hit ? 0 : 100, passed: !hit, explanation: hit ? '命中风险' : '无异常' };
    }
    case 'minLength': {
      const min = r.min ?? 0;
      const passed = text.length >= min;
      return { score: clamp((text.length / (min || 1)) * 100), passed, explanation: `${text.length}/${min}` };
    }
    case 'minRatio': {
      const min = r.min ?? 0;
      const v = numVal ?? 0;
      return { score: clamp((v / (min || 1)) * 100), passed: v >= min, explanation: `${v}` };
    }
    case 'booleanTrue':
      return { score: boolVal ? 100 : 0, passed: boolVal === true, explanation: boolVal ? '是' : '否' };
    case 'priorityStat': {
      const passed = String(sub.priority ?? '') === 'stat';
      return { score: passed ? 100 : 85, passed, explanation: String(sub.priority ?? 'routine') };
    }
    case 'intervalMinutes': {
      const a = Date.parse(String(sub[r.from ?? ''] ?? ''));
      const b = Date.parse(String(sub[r.to ?? ''] ?? ''));
      const minutes = Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 60000) : Infinity;
      const passed = minutes <= (r.max ?? 0);
      return { score: passed ? 100 : 0, passed, explanation: `${Number.isFinite(minutes) ? minutes + 'min' : '缺时间'}` };
    }
    case 'leftRightOk': {
      const v = boolVal ?? /左|右|双侧/.test(String(sub.findings ?? ''));
      return { score: v ? 100 : 70, passed: v, explanation: v ? '一致' : '疑似不一致' };
    }
    default:
      return { score: 90, passed: true, explanation: '默认' };
  }
}

function evaluateSubmission(sub: Record<string, unknown>) {
  const totalDimWeight = DIMENSIONS.reduce((a, d) => a + d.weight, 0) || 1;
  const dimensions = DIMENSIONS.map((dim) => {
    const subItems = dim.subItems.map((si) => {
      const totalW = si.rules.reduce((a, r) => a + r.weight, 0) || 1;
      const rules = si.rules.map((r) => {
        const { score, passed, explanation } = scoreRule(r, sub);
        return { key: r.key, name: r.name, score, weight: r.weight, passed, explanation };
      });
      const score = Math.round((rules.reduce((a, r) => a + r.score * r.weight, 0) / totalW) * 10) / 10;
      return { key: si.key, name: si.name, weight: si.weight, score, passed: rules.every((r) => r.passed), rules };
    });
    const totalSW = dim.subItems.reduce((a, s) => a + s.weight, 0) || 1;
    const score = Math.round((subItems.reduce((a, s) => a + s.score * s.weight, 0) / totalSW) * 10) / 10;
    return { key: dim.key, name: dim.name, weight: dim.weight, score, weightedScore: Math.round((score * dim.weight) / totalDimWeight * 10) / 10, subItems };
  });
  const totalScore = Math.round(dimensions.reduce((a, d) => a + d.weightedScore, 0) * 10) / 10;
  const band = GRADE_BANDS.find((b) => totalScore >= b.min && totalScore <= b.max) ?? GRADE_BANDS[GRADE_BANDS.length - 1]!;
  const text = [sub.findings, sub.impression, sub.diagnosis].join(' ');
  const hardFail = ['XXX', '待补充', '占位符', '模板残留'].filter((p) => text.includes(p));
  evaluationCount += 1;
  return {
    evaluationId: `QE-MS-${evaluationCount}`,
    rubricId: 'QR-DEFAULT',
    rubricVersion,
    reportId: sub.reportId,
    modality: sub.modality,
    totalScore,
    grade: band.grade,
    gradeLabel: band.label,
    passed: totalScore >= rubricPassThreshold && hardFail.length === 0,
    publishable: totalScore >= rubricPassThreshold && hardFail.length === 0 && band.publishable,
    bonusEligible: totalScore >= rubricBonusThreshold && hardFail.length === 0,
    hardFailTriggered: hardFail,
    dimensions,
    evaluatedAt: new Date().toISOString(),
    standard: RUBRIC_STANDARD,
  };
}

const SEED_SUBMISSION: Record<string, unknown> = {
  reportId: 'RPT-QC-DEMO',
  patientName: '示范患者',
  modality: 'CT',
  findings: '双肺纹理清晰，右肺上叶见一结节影，大小约 12mm×10mm，密度均匀，边界清楚，可见轻度强化。既往吸烟史，临床化验无异常。',
  impression: '1. 右肺上叶结节，考虑良性可能性大。 2. 纵隔未见肿大淋巴结。',
  diagnosis: '右肺上叶结节',
  recommendation: '建议 3 个月后复查胸部 CT，随诊观察。',
  structuredFieldsComplete: 0.95,
  signed: true,
  criticalMarked: true,
  priority: 'stat',
  leftRightOk: true,
  onTimeRate: 96,
  submitAt: '2026-08-10T08:00:00.000Z',
  reviewStartedAt: '2026-08-10T07:50:00.000Z',
  signedAt: '2026-08-10T08:20:00.000Z',
  hasReviewerSignature: true,
  criticalNotified: true,
  criticalAcked: true,
  priorityQueue: true,
};

// ================= 40 指标计算 =================

const INDICATOR_DEFS: Array<{ code: string; name: string; category: string; categoryKey: 'structure' | 'process' | 'outcome'; formula: string; target: string; frequency: string; responsible: string; unit: string; direction: 'higher' | 'lower'; targetValue: number }> = [
  { code: 'QI-S01', name: '大型设备年检合格率', category: '结构', categoryKey: 'structure', formula: '年检合格设备/在册设备×100%', target: '100%', frequency: '每年', responsible: '设备科', unit: '%', direction: 'higher', targetValue: 100 },
  { code: 'QI-S02', name: '设备日常质控执行率', category: '结构', categoryKey: 'structure', formula: '实际执行/应执行×100%', target: '≥98%', frequency: '每月', responsible: '技师长', unit: '%', direction: 'higher', targetValue: 98 },
  { code: 'QI-S03', name: '放射工作人员持证上岗率', category: '结构', categoryKey: 'structure', formula: '持证人数/在岗人数×100%', target: '100%', frequency: '每季度', responsible: '人事科', unit: '%', direction: 'higher', targetValue: 100 },
  { code: 'QI-P02', name: '急诊检查 30 分钟完成率', category: '过程', categoryKey: 'process', formula: '30min内完成/急诊总数×100%', target: '≥95%', frequency: '每月', responsible: '急诊技师组长', unit: '%', direction: 'higher', targetValue: 95 },
  { code: 'QI-P08', name: '图像质量甲级片率', category: '过程', categoryKey: 'process', formula: '甲级片/评价片×100%', target: '≥70%', frequency: '每月', responsible: '质控医师', unit: '%', direction: 'higher', targetValue: 70 },
  { code: 'QI-P09', name: '废片率', category: '过程', categoryKey: 'process', formula: '废片/摄片总数×100%', target: '≤2%', frequency: '每月', responsible: '技师组长', unit: '%', direction: 'lower', targetValue: 2 },
  { code: 'QI-P12', name: '危急值报告及时率', category: '过程', categoryKey: 'process', formula: '限时内报告/危急值总数×100%', target: '100%', frequency: '每月', responsible: '当班医师', unit: '%', direction: 'higher', targetValue: 100 },
  { code: 'QI-P14', name: '报告审核率（双签名率）', category: '过程', categoryKey: 'process', formula: '双签名报告/报告总数×100%', target: '100%', frequency: '每月', responsible: '审核医师', unit: '%', direction: 'higher', targetValue: 100 },
  { code: 'QI-R03', name: '漏诊率（阳性病例）', category: '结果', categoryKey: 'outcome', formula: '漏诊例数/应诊出总数×100%', target: '≤2%', frequency: '每季度', responsible: '质控医师', unit: '%', direction: 'lower', targetValue: 2 },
  { code: 'QI-R06', name: '报告质量抽检评分达标率', category: '结果', categoryKey: 'outcome', formula: '≥90分报告/抽检总数×100%', target: '≥90%', frequency: '每月', responsible: '质控小组', unit: '%', direction: 'higher', targetValue: 90 },
  { code: 'QI-R10', name: '放射事件发生率', category: '结果', categoryKey: 'outcome', formula: '放射事件发生起数', target: '0 起', frequency: '每月', responsible: '辐射防护小组', unit: '起', direction: 'lower', targetValue: 0 },
  { code: 'QI-R11', name: '对比剂严重不良反应发生率', category: '结果', categoryKey: 'outcome', formula: '严重不良反应/增强总数×10000', target: '≤1/万', frequency: '每季度', responsible: '护理组长', unit: '/万', direction: 'lower', targetValue: 1 },
];

const COMPUTABLE_CODES = new Set(['QI-P02', 'QI-P08', 'QI-P09', 'QI-P12', 'QI-P14', 'QI-R03', 'QI-R06', 'QI-R10', 'QI-R11']);

function fakeRate(code: string, targetValue: number, direction: 'higher' | 'lower') {
  const seed = [...code].reduce((a, c) => a + c.charCodeAt(0), 0);
  const jitter = ((seed % 13) - 6) / 100;
  const base = targetValue === 100 ? 99 : targetValue;
  const v = direction === 'higher' ? base * (1 + jitter) : base * (1 - jitter);
  return Math.round(Math.max(0, v) * 100) / 100;
}

interface ComputedIndicatorView {
  code: string; name: string; category: string; categoryKey: 'structure' | 'process' | 'outcome';
  formula: string; target: string; frequency: string; responsible: string;
  numerator: number; denominator: number; rate: number; unit: string;
  direction: 'higher' | 'lower'; status: 'pass' | 'warn' | 'fail' | 'nodata';
  computable: boolean; source: 'derived' | 'seed';
}

function buildComputed(_period: string): ComputedIndicatorView[] {
  const indicators = INDICATOR_DEFS.map((d) => {
    const computable = COMPUTABLE_CODES.has(d.code);
    const rate = fakeRate(d.code, d.targetValue, d.direction);
    const margin = Math.max(d.targetValue * 0.05, 0.1);
    let status: 'pass' | 'warn' | 'fail' | 'nodata';
    if (d.direction === 'higher') status = rate >= d.targetValue ? 'pass' : rate >= d.targetValue - margin ? 'warn' : 'fail';
    else status = rate <= d.targetValue ? 'pass' : rate <= d.targetValue + margin ? 'warn' : 'fail';
    const denom = computable ? 200 + (d.code.length * 7) : 100;
    return {
      code: d.code,
      name: d.name,
      category: d.category,
      categoryKey: d.categoryKey,
      formula: d.formula,
      target: d.target,
      frequency: d.frequency,
      responsible: d.responsible,
      numerator: Math.round((rate / 100) * denom),
      denominator: denom,
      rate,
      unit: d.unit,
      direction: d.direction,
      status,
      computable,
      source: computable ? ('derived' as const) : ('seed' as const),
    };
  });
  return indicators;
}

let snapshotSeq = 0;

function buildSnapshot(period: string) {
  const indicators = buildComputed(period);
  snapshotSeq += 1;
  return {
    id: `QIS-MS-${snapshotSeq}`,
    generatedAt: new Date().toISOString(),
    period,
    dateFrom: `${period}-01`,
    dateTo: `${period}-28`,
    indicatorCount: indicators.length,
    indicators,
    persisted: true,
  };
}

function buildDashboard(period: string) {
  const indicators = buildComputed(period);
  const passCount = indicators.filter((i) => i.status === 'pass').length;
  const warnCount = indicators.filter((i) => i.status === 'warn').length;
  const failCount = indicators.filter((i) => i.status === 'fail').length;
  const nodataCount = indicators.filter((i) => i.status === 'nodata').length;
  const denom = indicators.length - nodataCount;
  const keys: Array<'structure' | 'process' | 'outcome'> = ['structure', 'process', 'outcome'];
  const byCategory = keys.map((key) => {
    const list = indicators.filter((i) => i.categoryKey === key);
    const p = list.filter((i) => i.status === 'pass').length;
    return {
      categoryKey: key,
      category: key === 'structure' ? '结构' : key === 'process' ? '过程' : '结果',
      total: list.length,
      passCount: p,
      warnCount: list.filter((i) => i.status === 'warn').length,
      failCount: list.filter((i) => i.status === 'fail').length,
      nodataCount: 0,
      passRate: list.length ? Math.round((p / list.length) * 1000) / 10 : 0,
    };
  });
  return {
    source: 'seed' as const,
    generatedAt: new Date().toISOString(),
    period,
    standard: '国卫办医政函〔2024〕150号 附件4（40 项质控指标计算引擎）',
    total: indicators.length,
    computableCount: indicators.filter((i) => i.computable).length,
    passCount,
    warnCount,
    failCount,
    nodataCount,
    passRate: denom ? Math.round((passCount / denom) * 1000) / 10 : 0,
    byCategory,
    indicators,
  };
}

// ================= PDCA actions/findings/metrics =================

type ActionStatus = 'pending' | 'in_progress' | 'done' | 'overdue';
interface PdcaAction { id: string; cycleId: string; phase: string; description: string; ownerId: string; ownerName: string; deadline: string; status: ActionStatus; createdAt: string; completedAt?: string }
interface PdcaFinding { id: string; cycleId: string; title: string; description: string; severity: string; source: string; createdAt: string }

let actions: PdcaAction[] = [
  { id: 'act-001', cycleId: 'pdca-001', phase: 'do', description: '组织 2 场全员术语规范培训', ownerId: 'u-001', ownerName: '张主任', deadline: '2026-05-30', status: 'done', createdAt: '2026-05-06', completedAt: '2026-05-28' },
  { id: 'act-002', cycleId: 'pdca-001', phase: 'act', description: '将术语规范写入科室 SOP', ownerId: 'u-001', ownerName: '张主任', deadline: '2026-06-25', status: 'done', createdAt: '2026-05-06', completedAt: '2026-06-24' },
  { id: 'act-003', cycleId: 'pdca-002', phase: 'do', description: '模板增加造影剂描述必填字段', ownerId: 'u-002', ownerName: '李医生', deadline: '2026-07-15', status: 'done', createdAt: '2026-05-06', completedAt: '2026-07-12' },
  { id: 'act-004', cycleId: 'pdca-002', phase: 'check', description: '7 月抽查覆盖率复核', ownerId: 'u-002', ownerName: '李医生', deadline: '2026-08-10', status: 'in_progress', createdAt: '2026-05-06' },
  { id: 'act-005', cycleId: 'pdca-003', phase: 'do', description: '上线电话复核提醒与超时预警', ownerId: 'u-001', ownerName: '张主任', deadline: '2026-07-20', status: 'done', createdAt: '2026-05-06', completedAt: '2026-07-18' },
  { id: 'act-006', cycleId: 'pdca-003', phase: 'check', description: '满月复核率评估', ownerId: 'u-001', ownerName: '张主任', deadline: '2026-08-05', status: 'overdue', createdAt: '2026-05-06' },
  { id: 'act-007', cycleId: 'pdca-004', phase: 'do', description: '校准 3 台 DR 自动曝光参数', ownerId: 'u-003', ownerName: '王技师', deadline: '2026-08-20', status: 'in_progress', createdAt: '2026-05-06' },
];

let findings: PdcaFinding[] = [
  { id: 'find-001', cycleId: 'pdca-001', title: '模糊表述占比偏高', description: '4-5 月 600 份报告中模糊表述占比 8.3%', severity: 'medium', source: '抽样质控', createdAt: '2026-05-06' },
  { id: 'find-002', cycleId: 'pdca-002', title: '增强报告字段缺失', description: 'CT 增强报告造影剂描述缺失率 18%', severity: 'high', source: '结构化校验', createdAt: '2026-06-10' },
  { id: 'find-003', cycleId: 'pdca-003', title: '危急值复核断点', description: '口头通知后 30 分钟未电话复核占 4%', severity: 'high', source: '流程审计', createdAt: '2026-06-20' },
];

let actionSeq = 100;

// ================= 抽查 / 双盲 =================

const SAMPLING_POOL = (() => {
  const names = ['张伟', '李秀英', '王建国', '刘敏', '陈杰', '赵敏', '孙丽', '周强'];
  const modalities = ['CT', 'MR', 'DR', 'MG'];
  const pool: Array<{ reportId: string; patientId: string; patientName: string; modality: string; yielder: 'high' | 'low' }> = [];
  for (let i = 1; i <= 60; i++) {
    pool.push({ reportId: `RPT-QC-${String(i).padStart(3, '0')}`, patientId: `P${100 + i}`, patientName: names[i % names.length]!, modality: modalities[i % modalities.length]!, yielder: i % 6 === 0 ? 'low' : 'high' });
  }
  return pool;
})();

interface SamplingItem { itemId: string; reportId: string; patientId: string; patientName: string; modality: string; yielder: 'high' | 'low'; readings: Array<{ readerSlot: 1 | 2; readerId: string; readerName: string; result: 'positive' | 'negative' | 'indeterminate'; recordedAt: string }> }
interface SamplingBatch { id: string; name: string; method: 'random' | 'low_yield' | 'stratified'; blind: boolean; targetSize: number; modality?: string; status: 'open' | 'closed'; createdBy: string; createdAt: string; items: SamplingItem[] }

let samplingBatches: SamplingBatch[] = [];
let samplingSeq = 0;

function sampleItems(method: 'random' | 'low_yield' | 'stratified', size: number, modality?: string): SamplingItem[] {
  let pool = SAMPLING_POOL.slice();
  if (modality) pool = pool.filter((p) => p.modality.toUpperCase() === modality.toUpperCase());
  const toItem = (p: (typeof SAMPLING_POOL)[number]): SamplingItem => ({ itemId: `IT-${p.reportId}`, reportId: p.reportId, patientId: p.patientId, patientName: p.patientName, modality: p.modality, yielder: p.yielder, readings: [] });
  if (method === 'low_yield') return [...pool.filter((p) => p.yielder === 'low'), ...pool.filter((p) => p.yielder === 'high')].slice(0, size).map(toItem);
  if (method === 'stratified') {
    const out: SamplingItem[] = [];
    const groups = new Map<string, typeof pool>();
    for (const p of pool) { const l = groups.get(p.modality) ?? []; l.push(p); groups.set(p.modality, l); }
    const keys = [...groups.keys()].sort();
    let idx = 0;
    while (out.length < size) {
      let added = false;
      for (const k of keys) {
        const l = groups.get(k)!;
        if (idx < l.length && out.length < size) { out.push(toItem(l[idx]!)); added = true; }
      }
      idx += 1;
      if (!added) break;
    }
    return out;
  }
  const seed = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
  return pool.sort((a, b) => seed(a.reportId) - seed(b.reportId)).slice(0, size).map(toItem);
}

function blindBatch(batch: SamplingBatch, viewerSlot?: 1 | 2) {
  return {
    id: batch.id, name: batch.name, method: batch.method, blind: batch.blind, targetSize: batch.targetSize,
    modality: batch.modality, status: batch.status, createdBy: batch.createdBy, createdAt: batch.createdAt,
    itemCount: batch.items.length,
    items: batch.items.map((i) => ({
      itemId: i.itemId, reportId: i.reportId,
      patientName: batch.blind ? '***' : i.patientName,
      modality: i.modality, yielder: i.yielder, stratum: i.modality,
      recordedCount: i.readings.length,
      readings: i.readings.map((r) => ({
        readerSlot: r.readerSlot,
        readerLabel: batch.blind ? `阅片医师${r.readerSlot === 1 ? '一' : '二'}` : r.readerName,
        result: batch.blind && r.readerSlot !== viewerSlot ? null : r.result,
        recordedAt: batch.blind ? '' : r.recordedAt,
      })),
    })),
  };
}

function computeKappa(pairs: Array<{ a: 'positive' | 'negative'; b: 'positive' | 'negative' }>) {
  const n = pairs.length;
  if (n === 0) return { evaluatedItems: 0, positiveAgreement: 0, negativeAgreement: 0, agreementRate: 0, observedAgreement: 0, expectedAgreement: 0, kappa: 0, interpretation: '无可用双读结果' };
  let bothPos = 0, bothNeg = 0, aPos = 0, bPos = 0;
  for (const { a, b } of pairs) {
    if (a === 'positive') aPos += 1;
    if (b === 'positive') bPos += 1;
    if (a === 'positive' && b === 'positive') bothPos += 1;
    if (a === 'negative' && b === 'negative') bothNeg += 1;
  }
  const po = (bothPos + bothNeg) / n;
  const pe = (aPos / n) * (bPos / n) + (1 - aPos / n) * (1 - bPos / n);
  const kappa = pe >= 1 ? 1 : Math.round(((po - pe) / (1 - pe)) * 1000) / 1000;
  const interpretation = kappa >= 0.81 ? '几乎完全一致' : kappa >= 0.61 ? '高度一致' : kappa >= 0.41 ? '中度一致' : kappa >= 0.21 ? '一般一致' : kappa >= 0 ? '轻微一致' : '低于随机';
  return { evaluatedItems: n, positiveAgreement: bothPos, negativeAgreement: bothNeg, agreementRate: Math.round(po * 1000) / 10, observedAgreement: Math.round(po * 1000) / 1000, expectedAgreement: Math.round(pe * 1000) / 1000, kappa, interpretation };
}

function agreement(batchId?: string) {
  const batches = batchId ? samplingBatches.filter((b) => b.id === batchId) : samplingBatches;
  const pairs: Array<{ a: 'positive' | 'negative'; b: 'positive' | 'negative' }> = [];
  for (const batch of batches) {
    for (const item of batch.items) {
      const r1 = item.readings.find((r) => r.readerSlot === 1);
      const r2 = item.readings.find((r) => r.readerSlot === 2);
      if (!r1 || !r2 || r1.result === 'indeterminate' || r2.result === 'indeterminate') continue;
      pairs.push({ a: r1.result, b: r2.result });
    }
  }
  return computeKappa(pairs);
}

// ================= 缺陷库 =================

const DEFECT_CATEGORIES = [
  { id: 'dc-01', code: 'STRUCT', name: '结构完整性', nameEn: 'Structural completeness', description: '报告要素/所见/印象/签名等结构性缺陷' },
  { id: 'dc-02', code: 'TERM', name: '术语规范', nameEn: 'Terminology', description: '术语、方位、测量、RADS 分类等规范性缺陷' },
  { id: 'dc-03', code: 'ACCUR', name: '描述准确性', nameEn: 'Accuracy', description: '所见与印象矛盾、漏报、误诊等准确性缺陷' },
  { id: 'dc-04', code: 'TIMELY', name: '时效缺陷', nameEn: 'Timeliness', description: 'TAT 超时、签发延迟等时效性缺陷' },
  { id: 'dc-05', code: 'IMAGE', name: '图像质量', nameEn: 'Image quality', description: '伪影、曝光、剂量、体位等图像缺陷' },
  { id: 'dc-06', code: 'PROC', name: '流程与安全', nameEn: 'Process & safety', description: '危急值、对比剂、知情同意、辐射安全等' },
];

const DEFECT_ITEMS = [
  { id: 'di-01', code: 'ST-01', categoryCode: 'STRUCT', name: '报告五要素缺失', severity: 'high', description: '患者信息/检查项目/技术参数/影像所见/诊断印象不全' },
  { id: 'di-02', code: 'ST-02', categoryCode: 'STRUCT', name: '诊断印象未分层', severity: 'medium', description: '未按主要诊断/次要发现/随访建议分层' },
  { id: 'di-03', code: 'ST-03', categoryCode: 'STRUCT', name: '未对比既往', severity: 'medium', description: '有既往影像但未说明变化' },
  { id: 'di-04', code: 'ST-04', categoryCode: 'STRUCT', name: '缺审核签名', severity: 'high', description: '报告无双签或审核签名缺失' },
  { id: 'di-05', code: 'ST-05', categoryCode: 'STRUCT', name: '模板残留/占位符', severity: 'high', description: 'XXX/待补充/示例等残留文本' },
  { id: 'di-06', code: 'TM-01', categoryCode: 'TERM', name: '模糊表述', severity: 'medium', description: '使用非规范表述' },
  { id: 'di-07', code: 'TM-02', categoryCode: 'TERM', name: '左右方位错误', severity: 'critical', description: '左右/前后方位与图像不一致' },
  { id: 'di-08', code: 'TM-03', categoryCode: 'TERM', name: '测量不规范', severity: 'medium', description: '病灶未测量或未标注单位' },
  { id: 'di-09', code: 'TM-04', categoryCode: 'TERM', name: 'RADS 分级缺失', severity: 'medium', description: '肺结节/乳腺/前列腺未用相应 RADS 分级' },
  { id: 'di-10', code: 'AC-01', categoryCode: 'ACCUR', name: '所见与印象矛盾', severity: 'critical', description: '印象段结论无征象支持或前后矛盾' },
  { id: 'di-11', code: 'AC-02', categoryCode: 'ACCUR', name: '阴性结果漏报', severity: 'medium', description: '常规结构阴性描述缺失' },
  { id: 'di-12', code: 'AC-03', categoryCode: 'ACCUR', name: '结论不明确', severity: 'medium', description: '未给出明确诊断或鉴别建议' },
  { id: 'di-13', code: 'AC-04', categoryCode: 'ACCUR', name: '漏诊', severity: 'critical', description: '复核发现阳性病灶未报告' },
  { id: 'di-14', code: 'AC-05', categoryCode: 'ACCUR', name: '误诊', severity: 'critical', description: '诊断与病理/手术/随访不符' },
  { id: 'di-15', code: 'TI-01', categoryCode: 'TIMELY', name: '急诊报告超时', severity: 'high', description: '急诊报告未在 2 小时内出具' },
  { id: 'di-16', code: 'TI-02', categoryCode: 'TIMELY', name: '平诊报告超时', severity: 'medium', description: '平诊报告未在 24 小时内出具' },
  { id: 'di-17', code: 'TI-03', categoryCode: 'TIMELY', name: '提交/签发延迟', severity: 'low', description: '书写完成到提交或签发的间隔超标' },
  { id: 'di-18', code: 'IM-01', categoryCode: 'IMAGE', name: '运动/呼吸伪影', severity: 'medium', description: '影响诊断的伪影' },
  { id: 'di-19', code: 'IM-02', categoryCode: 'IMAGE', name: '曝光不足/过度', severity: 'medium', description: '图像噪声或过曝影响评估' },
  { id: 'di-20', code: 'IM-03', categoryCode: 'IMAGE', name: '扫描范围不足', severity: 'high', description: '目标部位未完整覆盖' },
  { id: 'di-21', code: 'IM-04', categoryCode: 'IMAGE', name: '废片/重拍', severity: 'medium', description: '因图像质量需重拍' },
  { id: 'di-22', code: 'PR-01', categoryCode: 'PROC', name: '危急值未及时通报', severity: 'critical', description: '危急值未在 10 分钟内通报' },
  { id: 'di-23', code: 'PR-02', categoryCode: 'PROC', name: '对比剂外渗/不良反应', severity: 'high', description: '增强检查对比剂外渗或严重不良反应' },
  { id: 'di-24', code: 'PR-03', categoryCode: 'PROC', name: '知情同意缺失', severity: 'high', description: '增强检查未签署知情同意书' },
];

const SEVERITIES = ['low', 'medium', 'high', 'critical'];

// ================= 设备质控 =================

const EQUIPMENT_ITEMS = [
  { id: 'CT-D-01', modality: 'CT', frequency: 'daily', name: '水模 CT 值 (中心)', standard: 'AAPM TG-66', threshold: { op: 'range', limit: -7, limit2: 7, unit: 'HU' }, method: '水模等中心 ROI' },
  { id: 'CT-D-02', modality: 'CT', frequency: 'daily', name: '噪声 (SD)', standard: 'AAPM TG-66', threshold: { op: 'lte', limit: 6, unit: 'HU' }, method: '水模均质区 SD' },
  { id: 'CT-W-01', modality: 'CT', frequency: 'weekly', name: '层厚偏差', standard: '±1 mm', threshold: { op: 'lte', limit: 1, unit: 'mm' }, method: '金属珠模体' },
  { id: 'CT-M-01', modality: 'CT', frequency: 'monthly', name: 'CT 值线性', standard: '±5 HU', threshold: { op: 'lte', limit: 5, unit: 'HU' }, method: '多材质模体' },
  { id: 'DR-D-01', modality: 'DR', frequency: 'daily', name: '管电压偏差', standard: '±5%', threshold: { op: 'lte', limit: 5, unit: '%' }, method: '非侵入 kVp 表' },
  { id: 'DR-W-01', modality: 'DR', frequency: 'weekly', name: '高对比分辨力', standard: '≥ 2.5 lp/mm', threshold: { op: 'gte', limit: 2.5, unit: 'lp/mm' }, method: '线对卡' },
  { id: 'DR-M-01', modality: 'DR', frequency: 'monthly', name: '探测器坏点', standard: '≤ 0.1%', threshold: { op: 'lte', limit: 0.1, unit: '%' }, method: '平场坏点统计' },
  { id: 'MR-D-01', modality: 'MRI', frequency: 'daily', name: '中心频率漂移', standard: '≤ ±5 ppm', threshold: { op: 'lte', limit: 5, unit: 'ppm' }, method: '系统中心频率' },
  { id: 'MR-D-02', modality: 'MRI', frequency: 'daily', name: 'SNR (信噪比)', standard: '≥ 基线 90%', threshold: { op: 'gte', limit: 90, unit: '%' }, method: 'ACR 模体' },
  { id: 'MR-W-01', modality: 'MRI', frequency: 'weekly', name: '图像均匀性', standard: '≥ 87.5%', threshold: { op: 'gte', limit: 87.5, unit: '%' }, method: 'ACR 模体 PIU' },
  { id: 'MR-M-01', modality: 'MRI', frequency: 'monthly', name: '层厚准确度', standard: '≤ ±0.7 mm', threshold: { op: 'lte', limit: 0.7, unit: 'mm' }, method: '斜面模体' },
  { id: 'MG-D-01', modality: 'MG', frequency: 'daily', name: '管电压偏差', standard: '±2%', threshold: { op: 'lte', limit: 2, unit: '%' }, method: '非侵入 kVp 表' },
  { id: 'MG-W-01', modality: 'MG', frequency: 'weekly', name: '平均腺体剂量 (AGD)', standard: '≤ 3 mGy', threshold: { op: 'lte', limit: 3, unit: 'mGy' }, method: '标准乳腺模体' },
  { id: 'MG-W-02', modality: 'MG', frequency: 'weekly', name: '高对比分辨力', standard: '≥ 10 lp/mm', threshold: { op: 'gte', limit: 10, unit: 'lp/mm' }, method: '线对卡' },
  { id: 'MG-M-01', modality: 'MG', frequency: 'monthly', name: '自动曝光控制', standard: '偏差 ≤ 10%', threshold: { op: 'lte', limit: 10, unit: '%' }, method: 'AEC 模体' },
];

const EQUIPMENT_DEVICES = [
  { id: 'DEV-CT-01', name: 'CT-1 (GE Revolution)', modality: 'CT' },
  { id: 'DEV-CT-02', name: 'CT-2 (Siemens SOMATOM)', modality: 'CT' },
  { id: 'DEV-DR-01', name: 'DR-1 (Philips DigitalDiagnost)', modality: 'DR' },
  { id: 'DEV-MR-01', name: 'MRI-1 (Siemens MAGNETOM)', modality: 'MRI' },
  { id: 'DEV-MG-01', name: 'MG-1 (Hologic Selenia)', modality: 'MG' },
];

interface EquipmentRecord { id: string; deviceId: string; deviceName: string; modality: string; frequency: string; testItemId: string; testItemName: string; value: number; unit: string; passed: boolean; deviation: number; testedAt: string; testerId: string; testerName: string; note?: string }

function thresholdPass(op: string, limit: number, limit2: number | undefined, value: number) {
  if (op === 'lte') return value <= limit;
  if (op === 'gte') return value >= limit;
  const lo = Math.min(limit, limit2 ?? limit);
  const hi = Math.max(limit, limit2 ?? limit);
  return value >= lo && value <= hi;
}

function seedEquipmentRecords(): EquipmentRecord[] {
  const out: EquipmentRecord[] = [];
  const days = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'];
  let seq = 0;
  for (const dev of EQUIPMENT_DEVICES) {
    const items = EQUIPMENT_ITEMS.filter((i) => i.modality === dev.modality);
    for (const item of items) {
      for (const day of days) {
        seq += 1;
        const h = seq * 7 + item.id.length;
        const center = item.threshold.op === 'gte' ? item.threshold.limit * 1.05 : item.threshold.limit * 0.85;
        const jitter = ((h % 100) / 100 - 0.5) * Math.abs(item.threshold.limit || 1) * 0.4;
        let value = Math.round(Math.max(0, center + jitter) * 100) / 100;
        if (h % 17 === 0) value = Math.round((item.threshold.op === 'gte' ? item.threshold.limit * 0.6 : item.threshold.limit * 1.8) * 100) / 100;
        const passed = thresholdPass(item.threshold.op, item.threshold.limit, item.threshold.limit2, value);
        out.push({ id: `EQC-${seq}`, deviceId: dev.id, deviceName: dev.name, modality: dev.modality, frequency: item.frequency, testItemId: item.id, testItemName: item.name, value, unit: item.threshold.unit, passed, deviation: 0, testedAt: `${day}T08:1${seq % 10}:00.000Z`, testerId: 'u-tech-01', testerName: '王技师', note: passed ? undefined : '超出阈值, 已通知医学物理师复核' });
      }
    }
  }
  return out;
}

let equipmentRecords = seedEquipmentRecords();
let equipmentSeq = equipmentRecords.length + 100;

function thresholdText(t: { op: string; limit: number; limit2?: number; unit: string }) {
  if (t.op === 'lte') return `≤ ${t.limit} ${t.unit}`;
  if (t.op === 'gte') return `≥ ${t.limit} ${t.unit}`;
  return `${t.limit} ~ ${t.limit2 ?? t.limit} ${t.unit}`;
}

// ================= handlers =================

export const w9QcHandlers = [
  // -------- 统一量表 --------
  http.get(`${API}/quality/rubric`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: rubricEnvelope() });
  }),

  http.put(`${API}/quality/rubric`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.passThreshold === 'number') rubricPassThreshold = body.passThreshold;
    if (typeof body.bonusThreshold === 'number') rubricBonusThreshold = body.bonusThreshold;
    rubricVersion += 1;
    rubricUpdatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: rubricEnvelope() });
  }),

  http.post(`${API}/quality/rubric/reset`, async () => {
    await delay(delayMs());
    rubricVersion += 1;
    rubricPassThreshold = 60;
    rubricBonusThreshold = 85;
    rubricUpdatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: rubricEnvelope() });
  }),

  http.get(`${API}/quality/rubric/grade-bands`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: GRADE_BANDS });
  }),

  http.get(`${API}/quality/rubric/stats`, async () => {
    await delay(delayMs());
    const subItemCount = DIMENSIONS.reduce((a, d) => a + d.subItems.length, 0);
    const ruleCount = DIMENSIONS.reduce((a, d) => a + d.subItems.reduce((s, i) => s + i.rules.length, 0), 0);
    return HttpResponse.json({
      success: true,
      data: { rubricId: 'QR-DEFAULT', version: rubricVersion, dimensionCount: DIMENSIONS.length, subItemCount, ruleCount, evaluations: evaluationCount, standard: RUBRIC_STANDARD },
    });
  }),

  http.post(`${API}/quality/rubric/evaluate`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as { reportId?: string; submission?: Record<string, unknown> };
    const submission = body.submission ?? { ...SEED_SUBMISSION, reportId: body.reportId ?? 'RPT-QC-DEMO' };
    return HttpResponse.json({ success: true, data: evaluateSubmission(submission) });
  }),

  // -------- 40 指标计算引擎 --------
  http.get(`${API}/quality-indicators/compute`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const period = url.searchParams.get('period') ?? '2026-08';
    const snapshot = buildSnapshot(period);
    return HttpResponse.json({ source: 'seed', ...snapshot });
  }),

  http.get(`${API}/quality-indicators/dashboard`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const period = url.searchParams.get('period') ?? '2026-08';
    return HttpResponse.json({ success: true, data: buildDashboard(period) });
  }),

  http.get(`${API}/quality-indicators/snapshots`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: [buildSnapshot('2026-08')] });
  }),

  // -------- PDCA actions / findings / metrics --------
  http.get(`${API}/qc-pdca/cycles/:id/actions`, async ({ params }) => {
    await delay(delayMs());
    return HttpResponse.json(actions.filter((a) => a.cycleId === params.id).map((a) => ({ ...a })));
  }),

  http.post(`${API}/qc-pdca/cycles/:id/actions`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as { description?: string; phase?: string; ownerId?: string; deadline?: string };
    if (!body.description?.trim()) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'description 不能为空' } }, { status: 400 });
    actionSeq += 1;
    const ownerName = body.ownerId === 'u-002' ? '李医生' : body.ownerId === 'u-003' ? '王技师' : '张主任';
    const action: PdcaAction = { id: `act-${actionSeq}`, cycleId: String(params.id), phase: body.phase ?? 'plan', description: body.description.trim(), ownerId: body.ownerId ?? 'u-001', ownerName, deadline: body.deadline ?? '2026-09-13', status: 'pending', createdAt: new Date().toISOString() };
    actions.push(action);
    return HttpResponse.json(action, { status: 201 });
  }),

  http.patch(`${API}/qc-pdca/actions/:actionId`, async ({ params, request }) => {
    await delay(delayMs());
    const action = actions.find((a) => a.id === params.actionId);
    if (!action) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '整改措施不存在' } }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.description === 'string') action.description = body.description;
    if (typeof body.phase === 'string') action.phase = body.phase;
    if (typeof body.deadline === 'string') action.deadline = body.deadline;
    if (typeof body.status === 'string') { action.status = body.status as ActionStatus; if (body.status === 'done') action.completedAt = new Date().toISOString(); }
    return HttpResponse.json(action);
  }),

  http.delete(`${API}/qc-pdca/actions/:actionId`, async ({ params }) => {
    await delay(delayMs());
    const idx = actions.findIndex((a) => a.id === params.actionId);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '整改措施不存在' } }, { status: 404 });
    actions.splice(idx, 1);
    return HttpResponse.json({ id: params.actionId, deleted: true });
  }),

  http.post(`${API}/qc-pdca/actions/:actionId/complete`, async ({ params }) => {
    await delay(delayMs());
    const action = actions.find((a) => a.id === params.actionId);
    if (!action) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '整改措施不存在' } }, { status: 404 });
    if (action.status === 'done') return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '已完成' } }, { status: 400 });
    action.status = 'done';
    action.completedAt = new Date().toISOString();
    return HttpResponse.json(action);
  }),

  http.get(`${API}/qc-pdca/cycles/:id/findings`, async ({ params }) => {
    await delay(delayMs());
    return HttpResponse.json(findings.filter((f) => f.cycleId === params.id).map((f) => ({ ...f })));
  }),

  http.post(`${API}/qc-pdca/cycles/:id/findings`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as { title?: string; description?: string; severity?: string; source?: string };
    if (!body.title?.trim()) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'title 不能为空' } }, { status: 400 });
    const finding: PdcaFinding = { id: `find-${Date.now()}`, cycleId: String(params.id), title: body.title.trim(), description: body.description ?? '', severity: body.severity ?? 'medium', source: body.source ?? '质控发现', createdAt: new Date().toISOString() };
    findings.push(finding);
    return HttpResponse.json(finding, { status: 201 });
  }),

  http.get(`${API}/qc-pdca/metrics`, async () => {
    await delay(delayMs());
    const done = actions.filter((a) => a.status === 'done').length;
    const overdue = actions.filter((a) => a.status === 'overdue').length;
    const byStatus: Record<string, number> = { pending: 0, in_progress: 0, done: 0, overdue: 0 };
    const ownerMap = new Map<string, { ownerId: string; ownerName: string; total: number; done: number; overdue: number }>();
    for (const a of actions) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
      const e = ownerMap.get(a.ownerId) ?? { ownerId: a.ownerId, ownerName: a.ownerName, total: 0, done: 0, overdue: 0 };
      e.total += 1;
      if (a.status === 'done') e.done += 1;
      if (a.status === 'overdue') e.overdue += 1;
      ownerMap.set(a.ownerId, e);
    }
    return HttpResponse.json({
      source: 'demo',
      generatedAt: new Date().toISOString(),
      data: { cycleCount: 6, actionCount: actions.length, actionDone: done, actionOverdue: overdue, actionCompletionRate: actions.length ? Math.round((done / actions.length) * 1000) / 10 : 0, findingCount: findings.length, byOwner: [...ownerMap.values()], byActionStatus: byStatus, defectCount: 12, linkedDefectCount: 6 },
    });
  }),

  // -------- 抽查 / 双盲 / 一致性 --------
  http.get(`${API}/dual-read/sampling/batches`, async () => {
    await delay(delayMs());
    return HttpResponse.json(samplingBatches.map((b) => blindBatch(b)));
  }),

  http.post(`${API}/dual-read/sampling/batches`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as { name?: string; method?: 'random' | 'low_yield' | 'stratified'; size?: number; modality?: string; blind?: boolean; createdBy?: string };
    const method = body.method ?? 'random';
    const size = Math.max(1, Math.min(100, body.size ?? 20));
    samplingSeq += 1;
    const batch: SamplingBatch = {
      id: `SB-${samplingSeq}`,
      name: body.name ?? `QC 抽查批次 ${samplingSeq}`,
      method,
      blind: body.blind !== false,
      targetSize: size,
      modality: body.modality,
      status: 'open',
      createdBy: body.createdBy ?? '质控组',
      createdAt: new Date().toISOString(),
      items: sampleItems(method, size, body.modality),
    };
    samplingBatches.unshift(batch);
    return HttpResponse.json(blindBatch(batch), { status: 201 });
  }),

  http.get(`${API}/dual-read/sampling/stats`, async () => {
    await delay(delayMs());
    let itemCount = 0;
    let recordedPairs = 0;
    const byModalityMap = new Map<string, { items: number; recordedPairs: number }>();
    for (const batch of samplingBatches) {
      for (const item of batch.items) {
        itemCount += 1;
        const entry = byModalityMap.get(item.modality) ?? { items: 0, recordedPairs: 0 };
        entry.items += 1;
        const r1 = item.readings.find((r) => r.readerSlot === 1);
        const r2 = item.readings.find((r) => r.readerSlot === 2);
        if (r1 && r2 && r1.result !== 'indeterminate' && r2.result !== 'indeterminate') { recordedPairs += 1; entry.recordedPairs += 1; }
        byModalityMap.set(item.modality, entry);
      }
    }
    return HttpResponse.json({
      success: true,
      data: {
        batchCount: samplingBatches.length,
        openBatchCount: samplingBatches.filter((b) => b.status === 'open').length,
        itemCount,
        recordedPairs,
        pendingItems: itemCount - recordedPairs,
        agreement: agreement(),
        byModality: [...byModalityMap.entries()].map(([modality, v]) => ({ modality, ...v })).sort((a, b) => a.modality.localeCompare(b.modality)),
      },
    });
  }),

  http.get(`${API}/dual-read/agreement`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    return HttpResponse.json({ success: true, data: agreement(url.searchParams.get('batchId') ?? undefined) });
  }),

  http.get(`${API}/dual-read/sampling/batches/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const batch = samplingBatches.find((b) => b.id === params.id);
    if (!batch) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '批次不存在' } }, { status: 404 });
    const url = new URL(request.url);
    if (url.searchParams.get('unblind') === 'true') {
      const cloned = { ...batch, blind: false, items: batch.items.map((i) => ({ ...i, readings: i.readings.map((r) => ({ ...r })) })) };
      return HttpResponse.json(blindBatch(cloned));
    }
    return HttpResponse.json(blindBatch(batch));
  }),

  http.post(`${API}/dual-read/sampling/batches/:id/items/:itemId/record`, async ({ params, request }) => {
    await delay(delayMs());
    const batch = samplingBatches.find((b) => b.id === params.id);
    if (!batch) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '批次不存在' } }, { status: 404 });
    if (batch.status === 'closed') return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '批次已关闭' } }, { status: 400 });
    const item = batch.items.find((i) => i.itemId === params.itemId || i.reportId === params.itemId);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '条目不存在' } }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { readerSlot: 1 | 2; readerId: string; readerName: string; result: 'positive' | 'negative' | 'indeterminate' };
    const existing = item.readings.find((r) => r.readerSlot === body.readerSlot);
    if (existing) { existing.readerId = body.readerId; existing.readerName = body.readerName; existing.result = body.result; existing.recordedAt = new Date().toISOString(); }
    else item.readings.push({ readerSlot: body.readerSlot, readerId: body.readerId, readerName: body.readerName, result: body.result, recordedAt: new Date().toISOString() });
    return HttpResponse.json(blindBatch(batch, body.readerSlot));
  }),

  http.post(`${API}/dual-read/sampling/batches/:id/close`, async ({ params }) => {
    await delay(delayMs());
    const batch = samplingBatches.find((b) => b.id === params.id);
    if (!batch) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '批次不存在' } }, { status: 404 });
    batch.status = 'closed';
    return HttpResponse.json(blindBatch(batch));
  }),

  // -------- 互评缺陷 / 缺陷库 --------
  http.get(`${API}/report-peer-review/defect-stats`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        totalLinks: 8,
        byCode: [{ code: 'AC-01', count: 3 }, { code: 'ST-01', count: 2 }, { code: 'TM-01', count: 2 }, { code: 'ST-03', count: 1 }],
        byCategory: [{ categoryCode: 'ACCUR', count: 3 }, { categoryCode: 'STRUCT', count: 3 }, { categoryCode: 'TERM', count: 2 }],
        bySeverity: [{ severity: 'critical', count: 3 }, { severity: 'high', count: 2 }, { severity: 'medium', count: 3 }],
      },
    });
  }),

  http.get(`${API}/defect-library/categories`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: DEFECT_CATEGORIES });
  }),

  http.get(`${API}/defect-library/aggregation`, async () => {
    await delay(delayMs());
    return HttpResponse.json({
      success: true,
      data: {
        total: DEFECT_ITEMS.length,
        byCategory: DEFECT_CATEGORIES.map((c) => ({ categoryCode: c.code, categoryName: c.name, count: DEFECT_ITEMS.filter((i) => i.categoryCode === c.code).length })),
        bySeverity: SEVERITIES.map((severity) => ({ severity, count: DEFECT_ITEMS.filter((i) => i.severity === severity).length })),
        byCategorySeverity: DEFECT_CATEGORIES.flatMap((c) => SEVERITIES.map((severity) => ({ categoryCode: c.code, severity, count: DEFECT_ITEMS.filter((i) => i.categoryCode === c.code && i.severity === severity).length }))).filter((x) => x.count > 0),
      },
    });
  }),

  http.get(`${API}/defect-library/items`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const categoryCode = url.searchParams.get('categoryCode');
    const severity = url.searchParams.get('severity');
    const keyword = url.searchParams.get('keyword')?.toLowerCase();
    let items = DEFECT_ITEMS.slice();
    if (categoryCode) items = items.filter((i) => i.categoryCode === categoryCode);
    if (severity) items = items.filter((i) => i.severity === severity);
    if (keyword) items = items.filter((i) => i.code.toLowerCase().includes(keyword) || i.name.toLowerCase().includes(keyword) || i.description.toLowerCase().includes(keyword));
    return HttpResponse.json({ success: true, data: items });
  }),

  // -------- 设备质控 --------
  http.get(`${API}/equipment-qc/items`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const modality = url.searchParams.get('modality');
    const frequency = url.searchParams.get('frequency');
    let items = EQUIPMENT_ITEMS.slice();
    if (modality) items = items.filter((i) => i.modality === modality);
    if (frequency) items = items.filter((i) => i.frequency === frequency);
    return HttpResponse.json({ success: true, data: items });
  }),

  http.get(`${API}/equipment-qc/schedule`, async () => {
    await delay(delayMs());
    const entries: unknown[] = [];
    for (const modality of ['CT', 'DR', 'MRI', 'MG']) {
      for (const frequency of ['daily', 'weekly', 'monthly']) {
        const items = EQUIPMENT_ITEMS.filter((i) => i.modality === modality && i.frequency === frequency);
        if (!items.length) continue;
        entries.push({ modality, frequency, itemCount: items.length, deviceCount: EQUIPMENT_DEVICES.filter((d) => d.modality === modality).length, items: items.map((i) => ({ id: i.id, name: i.name, standard: i.standard, threshold: thresholdText(i.threshold) })) });
      }
    }
    return HttpResponse.json({ success: true, data: entries });
  }),

  http.get(`${API}/equipment-qc/records`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const deviceId = url.searchParams.get('deviceId');
    const modality = url.searchParams.get('modality');
    const frequency = url.searchParams.get('frequency');
    const onlyFailed = url.searchParams.get('onlyFailed') === 'true';
    let rows = equipmentRecords.slice();
    if (deviceId) rows = rows.filter((r) => r.deviceId === deviceId);
    if (modality) rows = rows.filter((r) => r.modality === modality);
    if (frequency) rows = rows.filter((r) => r.frequency === frequency);
    if (onlyFailed) rows = rows.filter((r) => !r.passed);
    return HttpResponse.json({ success: true, data: rows });
  }),

  http.post(`${API}/equipment-qc/records`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json().catch(() => ({}))) as { deviceId?: string; deviceName?: string; modality?: string; testItemId?: string; value?: number; testerName?: string; note?: string };
    const item = EQUIPMENT_ITEMS.find((i) => i.id === body.testItemId);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '检测项不存在' } }, { status: 404 });
    if (body.modality && body.modality !== item.modality) return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '模态不符' } }, { status: 400 });
    equipmentSeq += 1;
    const value = body.value ?? 0;
    const passed = thresholdPass(item.threshold.op, item.threshold.limit, item.threshold.limit2, value);
    const record: EquipmentRecord = { id: `EQC-${equipmentSeq}`, deviceId: body.deviceId ?? 'DEV-UNKNOWN', deviceName: body.deviceName ?? EQUIPMENT_DEVICES.find((d) => d.id === body.deviceId)?.name ?? body.deviceId ?? '未知设备', modality: item.modality, frequency: item.frequency, testItemId: item.id, testItemName: item.name, value, unit: item.threshold.unit, passed, deviation: 0, testedAt: new Date().toISOString(), testerId: 'u-tech-01', testerName: body.testerName ?? '王技师', note: body.note ?? (passed ? undefined : '超出阈值, 需复核') };
    equipmentRecords.unshift(record);
    return HttpResponse.json(record, { status: 201 });
  }),

  http.get(`${API}/equipment-qc/stats`, async () => {
    await delay(delayMs());
    const total = equipmentRecords.length;
    const passed = equipmentRecords.filter((r) => r.passed).length;
    const failed = total - passed;
    const byModality = ['CT', 'DR', 'MRI', 'MG'].map((modality) => {
      const sub = equipmentRecords.filter((r) => r.modality === modality);
      const p = sub.filter((r) => r.passed).length;
      return { modality, total: sub.length, passed: p, failed: sub.length - p, passRate: sub.length ? Math.round((p / sub.length) * 1000) / 10 : 0 };
    });
    const byFrequency = ['daily', 'weekly', 'monthly'].map((frequency) => {
      const sub = equipmentRecords.filter((r) => r.frequency === frequency);
      const p = sub.filter((r) => r.passed).length;
      return { frequency, total: sub.length, passed: p, failed: sub.length - p, passRate: sub.length ? Math.round((p / sub.length) * 1000) / 10 : 0 };
    });
    return HttpResponse.json({ success: true, data: { total, passed, failed, passRate: total ? Math.round((passed / total) * 1000) / 10 : 0, byModality, byFrequency, recentFailureCount: failed } });
  }),

  http.get(`${API}/equipment-qc/failures`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: equipmentRecords.filter((r) => !r.passed) });
  }),

  http.get(`${API}/equipment-qc/items/:id`, async ({ params }) => {
    await delay(delayMs());
    const item = EQUIPMENT_ITEMS.find((i) => i.id === params.id);
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '检测项不存在' } }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),
];
