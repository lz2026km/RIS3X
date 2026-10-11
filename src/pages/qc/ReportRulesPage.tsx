/**
 * G005 RIS v3.0.6.11-101 Wave 6A F11 - 报告质控规则引擎 (/report-v2/rules)
 * 规则列表 + 违规结果表格 + 一键修正建议 + 自定义规则编辑器 + 规则集绑定
 * 数据源: reportRulesApi (后端 /report-rules 或演示回退, 响应带 source 徽标)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ShieldCheck,
  Plus,
  Play,
  Pencil,
  Trash2,
  Save,
  Wand2,
  FileCheck2,
  Database,
  AlertTriangle,
  AlertOctagon,
  BarChart3,
  BookOpen,
  History,
  Info,
  ScrollText,
} from 'lucide-react'
import {
  Button,
  Tag,
  Space,
  Alert,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Empty,
  Card,
  Tabs,
  Tooltip,
  Checkbox,
  Drawer,
  InputNumber,
} from "antd";
import type { ColumnsType } from 'antd/es/table'
import { PageContainer } from '../../components/common/PageContainer'
import { PageHeader } from '../../components/common/PageHeader'
import { ErrorBanner } from '../../components/feedback'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'
import { TrendChart } from '../../components/dashboard/TrendChart'
import { t } from '../../i18n/appI18n'
import { severityToAntd } from '../../theme/statusTokens'
import {
  reportRulesApi,
  RULE_TYPE_LABELS,
  RULE_SEVERITY_LABELS,
  RULE_FIELD_LABELS,
  type QualityRule,
  type RuleSet,
  type RuleViolation,
  type RuleViolationRecord,
  type RuleStats,
  type RuleType,
  type RuleSeverity,
  type RuleField,
  type RuleOperator,
  type EvaluateResult,
  type RwsEvaluation,
  type RwsFailure,
  type RwsReportInput,
  type RwsRuleList,
  type RwsRuleMeta,
  type ReviewTier,
  type AuthorSeniority,
  type CaseSeverity,
  type ReviewTierRule,
  type ReviewTierInput,
  type ReviewTierResolution,
  REVIEW_TIERS,
  AUTHOR_SENIORITIES,
  CASE_SEVERITIES,
} from '../../services/api/reportRulesApi'

const SEVERITY_COLORS: Record<string, string> = { error: severityToAntd('critical'), warning: severityToAntd('warning'), info: severityToAntd('info') }
const TYPE_COLORS: Record<string, string> = {
  missing_field: 'magenta',
  terminology: 'purple',
  unit: 'cyan',
  length_range: 'geekblue',
  numeric_reasonability: 'volcano',
  duplicate: 'gold',
}

const TYPE_OPTIONS = Object.entries(RULE_TYPE_LABELS).map(([value, label]) => ({ value, label }))
const SEVERITY_OPTIONS = Object.entries(RULE_SEVERITY_LABELS).map(([value, label]) => ({ value, label }))
const FIELD_OPTIONS = Object.entries(RULE_FIELD_LABELS).map(([value, label]) => ({ value, label }))
const OPERATOR_OPTIONS = [
  { value: 'empty', labelKey: 'reportRules.op.empty' },
  { value: 'not_empty', labelKey: 'reportRules.op.not_empty' },
  { value: 'contains', labelKey: 'reportRules.op.contains' },
  { value: 'not_contains', labelKey: 'reportRules.op.not_contains' },
  { value: 'regex', labelKey: 'reportRules.op.regex' },
  { value: 'length_lt', labelKey: 'reportRules.op.length_lt' },
  { value: 'length_gte', labelKey: 'reportRules.op.length_gte' },
  { value: 'numeric_over', labelKey: 'reportRules.op.numeric_over' },
  { value: 'dup_count', labelKey: 'reportRules.op.dup_count' },
]
const EXAM_TYPE_OPTIONS = [
  { value: 'CT', label: 'CT' },
  { value: 'MRI', label: 'MRI' },
  { value: 'MR', label: 'MR' },
  { value: 'DR', label: 'DR' },
  { value: 'X-ray', label: 'X-ray' },
]

// [G005 W4A] 分级审核规则
const TIER_LABEL_KEYS: Record<ReviewTier, string> = {
  none: 'w4a.tier.none',
  initial: 'w4a.tier.initial',
  final: 'w4a.tier.final',
  'dual-sign': 'w4a.tier.dualSign',
  'dual-read': 'w4a.tier.dualRead',
}
const TIER_COLORS: Record<ReviewTier, string> = { none: 'default', initial: 'blue', final: 'geekblue', 'dual-sign': 'purple', 'dual-read': 'magenta' }
const SENIORITY_LABEL_KEYS: Record<AuthorSeniority, string> = {
  resident: 'w4a.seniority.resident',
  attending: 'w4a.seniority.attending',
  senior: 'w4a.seniority.senior',
  chief: 'w4a.seniority.chief',
}
const CASE_SEVERITY_LABEL_KEYS: Record<CaseSeverity, string> = {
  low: 'w4a.severity.low',
  normal: 'w4a.severity.normal',
  high: 'w4a.severity.high',
  critical: 'w4a.severity.critical',
}
const TIER_OPTIONS = REVIEW_TIERS.map((v) => ({ value: v, label: t(TIER_LABEL_KEYS[v]) }))
const SENIORITY_OPTIONS = AUTHOR_SENIORITIES.map((v) => ({ value: v, label: t(SENIORITY_LABEL_KEYS[v]) }))
const CASE_SEVERITY_OPTIONS = CASE_SEVERITIES.map((v) => ({ value: v, label: t(CASE_SEVERITY_LABEL_KEYS[v]) }))
const MODALITY_OPTIONS = ['CT', 'MR', 'MRI', 'DR', 'MG', 'US'].map((v) => ({ value: v, label: v }))

function tierWhenSummary(rule: ReviewTierRule): string {
  const w = rule.when
  const parts: string[] = []
  if (w.modalities?.length) parts.push(`${t('w4a.tiers.fldModalities')}: ${w.modalities.join('/')}`)
  if (w.radsCategoryGte !== undefined) parts.push(`${t('w4a.tiers.fldRadsGte')}${w.radsCategoryGte}`)
  if (w.severities?.length) parts.push(`${t('w4a.tiers.fldSeverities')}: ${w.severities.map((s) => t(CASE_SEVERITY_LABEL_KEYS[s])).join('/')}`)
  if (w.isCritical !== undefined) parts.push(`${t('w4a.tiers.fldCritical')}: ${w.isCritical ? '' : ''}`)
  if (w.authorSeniorityIn?.length) parts.push(`${t('w4a.tiers.fldSeniority')}: ${w.authorSeniorityIn.map((s) => t(SENIORITY_LABEL_KEYS[s])).join('/')}`)
  return parts.length > 0 ? parts.join(' · ') : '-'
}

const fmtDate = (s?: string) => (s ? s.slice(0, 10) : '-')

interface ReportFields {
  findings: string
  diagnosis: string
  impression: string
  conclusion: string
  recommendations: string
}

const DEMO_REPORT: ReportFields = {
  findings: '双肺纹理清晰。右肺上叶见大小约 5 结节影, 边缘光滑。左肺下叶见少量条索影。',
  diagnosis: '右肺上叶结节, 性质待定。',
  impression: '右肺上叶结节, 建议随访。',
  conclusion: '右肺上叶结节, 考虑良性可能, 建议定期复查。',
  recommendations: '',
}

const FIELD_KEYS: Array<keyof ReportFields> = ['findings', 'diagnosis', 'impression', 'conclusion', 'recommendations']
const fieldLabel = (key: keyof ReportFields) => t(`reportRules.field.${key}`)

// [G005 W-D6] RWS 演示报告 (国标书写规范 RQI-RWS-03): 按检查类型分组, 合规/违规混合
interface RwsDemoReport {
  reportId: string
  examType: string
  input: RwsReportInput
}

const RWS_COMPLIANT_BASE: RwsReportInput = {
  patientName: '张建国',
  patientId: 'P-1001',
  orderPatientName: '张建国',
  orderPatientId: 'P-1001',
  bodyPart: '胸部',
  reportedBodyPart: '胸部',
  reportedSide: '双侧',
  examSide: '双侧',
  clinicalHistory: '咳嗽 2 周',
  findings: '双肺纹理清晰。右肺上叶见大小约 5mm 结节影, 边缘光滑。',
  impression: '右肺上叶小结节。',
  conclusion: '右肺上叶小结节, 考虑良性可能, 建议定期复查。',
  recommendations: '建议 6 个月后复查胸部 CT。',
  signedBy: '李慧敏',
  radiologistSignature: '李慧敏',
  hasRadiologistSignature: true,
}

const RWS_DEMO_REPORTS: RwsDemoReport[] = [
  { reportId: 'RPT-RWS-CT-01', examType: 'CT', input: { ...RWS_COMPLIANT_BASE } },
  {
    reportId: 'RPT-RWS-CT-02',
    examType: 'CT',
    input: {
      ...RWS_COMPLIANT_BASE,
      patientId: 'P-1002',
      signedBy: undefined,
      radiologistSignature: undefined,
      hasRadiologistSignature: false,
      conclusion: '右肺上叶小结节。{{请补充结论}}',
    },
  },
  {
    reportId: 'RPT-RWS-MR-01',
    examType: 'MR',
    input: {
      ...RWS_COMPLIANT_BASE,
      patientName: '李慧敏',
      patientId: 'P-2001',
      orderPatientName: '李慧敏',
      orderPatientId: 'P-2001',
      bodyPart: '颅脑',
      reportedBodyPart: '颅脑',
      findings: '双侧大脑半球对称, 脑实质内未见明显异常信号。',
      impression: '颅脑 MRI 未见明显异常。',
      conclusion: '颅脑 MRI 未见明显异常。',
      recommendations: '无。',
      signedBy: '王建华',
      radiologistSignature: '王建华',
      hasRadiologistSignature: true,
    },
  },
  {
    reportId: 'RPT-RWS-MR-02',
    examType: 'MR',
    input: {
      ...RWS_COMPLIANT_BASE,
      patientName: '王建华',
      patientId: 'P-2002',
      orderPatientName: '王建华',
      orderPatientId: 'P-2002',
      bodyPart: '膝关节',
      reportedBodyPart: '膝关节',
      reportedSide: '左',
      examSide: '左',
      findings: '左膝关节半月板前角见线状高信号, 前交叉韧带连续性好。',
      impression: '左膝关节半月板 I 度损伤。',
      conclusion: '左膝关节半月板 I 度损伤, 建议关节科随访。',
      recommendations: '建议 3 个月后复查。',
      signedBy: '赵星辰',
      radiologistSignature: '赵星辰',
      hasRadiologistSignature: true,
    },
  },
  {
    reportId: 'RPT-RWS-DR-01',
    examType: 'DR',
    input: {
      ...RWS_COMPLIANT_BASE,
      patientName: '赵星辰',
      patientId: 'P-3001',
      orderPatientName: '赵星辰',
      orderPatientId: 'P-3001',
      bodyPart: '腹部',
      reportedBodyPart: '胸部',
      findings: '双肺未见明显实质性病变。',
      impression: '心肺未见明显异常。',
      conclusion: '心肺未见明显异常。',
      recommendations: '无。',
      signedBy: '孙雅琴',
      radiologistSignature: '孙雅琴',
      hasRadiologistSignature: true,
    },
  },
  {
    reportId: 'RPT-RWS-DR-02',
    examType: 'DR',
    input: {
      ...RWS_COMPLIANT_BASE,
      patientName: '孙雅琴',
      patientId: 'P-3002',
      orderPatientName: '陈立新',
      orderPatientId: 'P-3002',
      findings: '双肺纹理清晰, 心影大小正常。',
      impression: '心肺未见明显异常。',
      conclusion: '心肺未见明显异常。',
      recommendations: '无。',
      signedBy: '陈立新',
      radiologistSignature: '陈立新',
      hasRadiologistSignature: true,
    },
  },
  {
    reportId: 'RPT-RWS-US-01',
    examType: 'US',
    input: {
      ...RWS_COMPLIANT_BASE,
      patientName: '陈立新',
      patientId: 'P-4001',
      orderPatientName: '陈立新',
      orderPatientId: 'P-4001',
      bodyPart: '腹部超声',
      reportedBodyPart: '腹部超声',
      findings: '肝脏大小形态正常, 胆囊壁不厚, 胆囊内未见明确结石回声。',
      impression: '肝胆超声未见明显异常。',
      conclusion: '肝胆超声未见明显异常。',
      recommendations: '无。',
      signedBy: '周敏',
      radiologistSignature: '周敏',
      hasRadiologistSignature: true,
    },
  },
  {
    reportId: 'RPT-RWS-US-02',
    examType: 'US',
    input: {
      ...RWS_COMPLIANT_BASE,
      patientName: '周敏',
      patientId: 'P-4002',
      orderPatientName: '周敏',
      orderPatientId: 'P-4002',
      bodyPart: '甲状腺超声',
      reportedBodyPart: '甲状腺超声',
      findings: '甲状腺右叶见一低回声结节, 大小约 12mm, 边界清。',
      impression: '甲状腺右叶结节, TI-RADS 3 类。',
      conclusion: '甲状腺右叶结节, TI-RADS 3 类。待补充描述。',
      recommendations: '建议 6 个月后复查甲状腺超声。',
      signedBy: '刘芳',
      radiologistSignature: '刘芳',
      hasRadiologistSignature: true,
    },
  },
]

export default function ReportRulesPage() {
  const [rules, setRules] = useState<QualityRule[]>([])
  const [rulesets, setRulesets] = useState<RuleSet[]>([])
  const [stats, setStats] = useState<RuleStats | null>(null)
  const [source, setSource] = useState<'database' | 'demo' | 'offline'>('demo')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // 评估工作台
  const [fields, setFields] = useState<ReportFields>({ ...DEMO_REPORT })
  const [examType, setExamType] = useState<string>('CT')
  const [rulesetId, setRulesetId] = useState<string>('rs-ct-chest')
  const [evaluating, setEvaluating] = useState(false)
  const [result, setResult] = useState<EvaluateResult | null>(null)

  // 规则编辑器
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<QualityRule | null>(null)
  const [ruleForm] = Form.useForm()

  // 规则集绑定抽屉
  const [bindOpen, setBindOpen] = useState(false)
  const [bindSet, setBindSet] = useState<RuleSet | null>(null)
  const [boundIds, setBoundIds] = useState<string[]>([])

  // 修正建议抽屉
  const [fixOpen, setFixOpen] = useState(false)
  const [fixedFields, setFixedFields] = useState<ReportFields | null>(null)

  // [G005 W4A] 分级审核规则
  const [tiers, setTiers] = useState<ReviewTierRule[]>([])
  const [tierLoading, setTierLoading] = useState(false)
  const [tierEditorOpen, setTierEditorOpen] = useState(false)
  const [editingTier, setEditingTier] = useState<ReviewTierRule | null>(null)
  const [tierForm] = Form.useForm()
  const [resolveInput, setResolveInput] = useState<ReviewTierInput>({
    modality: 'CT',
    radsCategory: 3,
    severity: 'normal',
    isCritical: false,
    authorSeniority: 'attending',
  })
  const [resolveResult, setResolveResult] = useState<ReviewTierResolution | null>(null)
  const [resolving, setResolving] = useState(false)

  // [G005 W-D6] RWS 规则引擎 (国标报告书写规范 RQI-RWS-03)
  const [rwsReportId, setRwsReportId] = useState<string>(RWS_DEMO_REPORTS[0]?.reportId ?? '')
  const [signedBy, setSignedBy] = useState<string>(RWS_COMPLIANT_BASE.signedBy ?? '')
  const [rwsResult, setRwsResult] = useState<RwsEvaluation | null>(null)
  const [rwsRules, setRwsRules] = useState<RwsRuleList | null>(null)
  const [rwsHistory, setRwsHistory] = useState<RuleViolationRecord[]>([])
  const [rwsRateRows, setRwsRateRows] = useState<Array<{ name: string; rate: number; target: number }>>([])
  const [rwsRunning, setRwsRunning] = useState(false)
  const [rateRunning, setRateRunning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const [rulesRes, setsRes, statsRes] = await Promise.all([
      reportRulesApi.listRules(examType === 'ALL' ? undefined : examType).catch(() => null),
      reportRulesApi.listRulesets().catch(() => null),
      reportRulesApi.getStats().catch(() => null),
    ])
    if (rulesRes?.success && rulesRes.data?.data) {
      setRules(rulesRes.data.data)
      setSource(rulesRes.data.source)
    } else {
      setSource('offline')
      setRules([])
      setLoadError(t('w9.states.error'))
      message.warning(t('reportRules.loadFailed'))
    }
    if (setsRes?.success && setsRes.data?.data) setRulesets(setsRes.data.data)
    if (statsRes?.success && statsRes.data?.data) setStats(statsRes.data.data)
    setLoading(false)
  }, [examType])

  useEffect(() => {
    void load()
  }, [load])

  // [G005 W4A] 分级审核规则加载
  const loadTiers = useCallback(async () => {
    setTierLoading(true)
    const res = await reportRulesApi.listReviewTiers().catch(() => null)
    if (res?.success && res.data?.data) setTiers(res.data.data)
    else setTiers([])
    setTierLoading(false)
  }, [])

  useEffect(() => {
    void loadTiers()
  }, [loadTiers])

  const openTierCreate = () => {
    setEditingTier(null)
    tierForm.resetFields()
    tierForm.setFieldsValue({ tier: 'final', priority: 50, enabled: true, whenIsCritical: undefined })
    setTierEditorOpen(true)
  }

  const openTierEdit = (rule: ReviewTierRule) => {
    setEditingTier(rule)
    tierForm.setFieldsValue({
      name: rule.name,
      code: rule.code,
      tier: rule.tier,
      priority: rule.priority,
      enabled: rule.enabled,
      description: rule.description,
      reason: rule.reason,
      modalities: rule.when.modalities,
      radsCategoryGte: rule.when.radsCategoryGte,
      severities: rule.when.severities,
      whenIsCritical: rule.when.isCritical,
      authorSeniorityIn: rule.when.authorSeniorityIn,
    })
    setTierEditorOpen(true)
  }

  const saveTier = async () => {
    const values = await tierForm.validateFields().catch(() => null)
    if (!values) return
    const when: ReviewTierRule['when'] = {}
    if (values.modalities?.length) when.modalities = values.modalities
    if (values.radsCategoryGte !== undefined && values.radsCategoryGte !== null) when.radsCategoryGte = Number(values.radsCategoryGte)
    if (values.severities?.length) when.severities = values.severities
    if (values.whenIsCritical !== undefined) when.isCritical = Boolean(values.whenIsCritical)
    if (values.authorSeniorityIn?.length) when.authorSeniorityIn = values.authorSeniorityIn
    const payload = {
      name: values.name as string,
      code: values.code as string | undefined,
      tier: values.tier as ReviewTier,
      priority: values.priority as number | undefined,
      enabled: values.enabled as boolean | undefined,
      description: values.description as string | undefined,
      reason: values.reason as string | undefined,
      when,
    }
    if (editingTier) {
      const res = await reportRulesApi.updateReviewTier(editingTier.id, payload).catch(() => null)
      if (res?.success) message.success(t('w4a.tiers.updated'))
      else message.error(res?.error?.message ?? t('w4a.tiers.opFailed'))
    } else {
      const res = await reportRulesApi.createReviewTier(payload).catch(() => null)
      if (res?.success) message.success(t('w4a.tiers.created'))
      else message.error(res?.error?.message ?? t('w4a.tiers.opFailed'))
    }
    setTierEditorOpen(false)
    void loadTiers()
  }

  const toggleTier = async (rule: ReviewTierRule, enabled: boolean) => {
    const res = await reportRulesApi.updateReviewTier(rule.id, { enabled }).catch(() => null)
    if (res?.success) message.success(enabled ? t('w4a.tiers.updated') : t('w4a.tiers.updated'))
    else message.error(t('w4a.tiers.opFailed'))
    void loadTiers()
  }

  const removeTier = async (rule: ReviewTierRule) => {
    const res = await reportRulesApi.deleteReviewTier(rule.id).catch(() => null)
    if (res?.success) message.success(t('w4a.tiers.deleted'))
    else message.error(res?.error?.message ?? t('w4a.tiers.deleteDenied'))
    void loadTiers()
  }

  const runResolve = async () => {
    setResolving(true)
    const res = await reportRulesApi.resolveReviewTier(resolveInput).catch(() => null)
    if (res?.success && res.data) setResolveResult(res.data)
    else message.error(t('w4a.tiers.resolveFailed'))
    setResolving(false)
  }

  const runEvaluate = async () => {
    setEvaluating(true)
    const res = await reportRulesApi
      .evaluate({
        reportId: 'RPT-V2-RULES',
        examType,
        rulesetId,
        ...fields,
      })
      .catch(() => null)
    setEvaluating(false)
    if (res?.success && res.data) {
      setResult(res.data)
      message.success(t('reportRules.evalDone', { count: res.data.violations.length, score: res.data.score }))
    } else {
      message.error(t('reportRules.evalFailed'))
    }
  }

  // [G005 W-D6] 国标 RWS 规则清单 + 评估历史加载
  const loadRwsAssets = useCallback(async () => {
    const [rulesRes, historyRes] = await Promise.all([
      reportRulesApi.getNationalRwsRules().catch(() => null),
      reportRulesApi.listHistory().catch(() => null),
    ])
    if (rulesRes?.success && rulesRes.data) setRwsRules(rulesRes.data)
    if (historyRes?.success && historyRes.data?.data) setRwsHistory(historyRes.data.data)
  }, [])

  useEffect(() => {
    void loadRwsAssets()
  }, [loadRwsAssets])

  // [G005 W-D6] 选择演示报告 → 回填报告文本与签名
  const selectRwsReport = (reportId: string) => {
    setRwsReportId(reportId)
    const demo = RWS_DEMO_REPORTS.find((r) => r.reportId === reportId)
    setRwsResult(null)
    if (!demo) return
    setFields({
      findings: demo.input.findings ?? '',
      diagnosis: demo.input.diagnosis ?? '',
      impression: demo.input.impression ?? '',
      conclusion: demo.input.conclusion ?? '',
      recommendations: demo.input.recommendations ?? '',
    })
    setSignedBy(demo.input.signedBy ?? '')
  }

  // [G005 W-D6] 一键评估: 规则违规 (POST /report-rules/evaluate) + RWS 书写规范评分 (POST /report-rules/evaluate-rws)
  const runRwsEvaluate = async () => {
    const demo = RWS_DEMO_REPORTS.find((r) => r.reportId === rwsReportId) ?? RWS_DEMO_REPORTS[0]
    if (!demo) return
    setRwsRunning(true)
    const [ruleRes, rwsRes] = await Promise.all([
      reportRulesApi
        .evaluate({ reportId: demo.reportId, examType: demo.examType, rulesetId, ...fields })
        .catch(() => null),
      reportRulesApi
        .evaluateRws({
          ...demo.input,
          reportId: demo.reportId,
          examType: demo.examType,
          findings: fields.findings,
          diagnosis: fields.diagnosis,
          impression: fields.impression,
          conclusion: fields.conclusion,
          recommendations: fields.recommendations,
          signedBy: signedBy.trim() || undefined,
          hasRadiologistSignature: Boolean(signedBy.trim()),
        })
        .catch(() => null),
    ])
    if (ruleRes?.success && ruleRes.data) setResult(ruleRes.data)
    if (rwsRes?.success && rwsRes.data) {
      setRwsResult(rwsRes.data)
      message.success(t('reportRules.evalDone', { count: rwsRes.data.failures?.length ?? 0, score: rwsRes.data.rate }))
    } else if (!ruleRes?.success) {
      message.error(t('reportRules.evalFailed'))
    }
    setRwsRunning(false)
    void loadRwsAssets()
  }

  // [G005 W-D6] 分检查类型批量计算书写规范率 (POST /report-rules/rws-rate) → 规范率图表
  const runRwsRate = async () => {
    setRateRunning(true)
    const groups = new Map<string, RwsReportInput[]>()
    for (const r of RWS_DEMO_REPORTS) {
      const list = groups.get(r.examType) ?? []
      list.push({ ...r.input, reportId: r.reportId, examType: r.examType })
      groups.set(r.examType, list)
    }
    const rows: Array<{ name: string; rate: number; target: number }> = []
    for (const [name, reports] of groups) {
      const res = await reportRulesApi.computeRwsRate(reports).catch(() => null)
      rows.push({
        name,
        rate: res?.success && res.data ? Number(res.data.rate ?? 0) : 0,
        target: res?.success && res.data ? Number(res.data.target ?? 98) : 98,
      })
    }
    setRwsRateRows(rows)
    setRateRunning(false)
  }

  const openCreate = () => {
    setEditing(null)
    ruleForm.resetFields()
    ruleForm.setFieldsValue({ severity: 'warning', type: 'terminology', field: 'conclusion', operator: 'contains', enabled: true, examTypes: [] })
    setEditorOpen(true)
  }

  const openEdit = (rule: QualityRule) => {
    setEditing(rule)
    ruleForm.setFieldsValue({
      name: rule.name,
      code: rule.code,
      type: rule.type,
      severity: rule.severity,
      description: rule.description,
      field: rule.condition.field,
      operator: rule.condition.operator,
      value: String(rule.condition.value),
      whenField: rule.condition.when?.field,
      whenOperator: rule.condition.when?.operator,
      whenValue: rule.condition.when ? String(rule.condition.when.value) : undefined,
      suggestion: rule.suggestion,
      enabled: rule.enabled,
      examTypes: rule.examTypes,
    })
    setEditorOpen(true)
  }

  const saveRule = async () => {
    const values = await ruleForm.validateFields()
    const condition = {
      field: values.field as RuleField,
      operator: values.operator as RuleOperator,
      value: /^\d+(\.\d+)?$/.test(String(values.value)) ? Number(values.value) : String(values.value),
      ...(values.whenField && values.whenOperator
        ? {
            when: {
              field: values.whenField as RuleField,
              operator: values.whenOperator as RuleOperator,
              value: /^\d+(\.\d+)?$/.test(String(values.whenValue ?? '')) ? Number(values.whenValue) : String(values.whenValue ?? ''),
            },
          }
        : {}),
    }
    const payload = {
      name: values.name,
      code: values.code,
      type: values.type as RuleType,
      severity: values.severity as RuleSeverity,
      description: values.description,
      condition,
      suggestion: values.suggestion,
      examTypes: values.examTypes ?? [],
    }
    if (editing) {
      const res = await reportRulesApi.updateRule(editing.id, payload).catch(() => null)
      if (res?.success) message.success(t('reportRules.ruleUpdated'))
      else message.error(t('reportRules.updateFailed'))
    } else {
      const res = await reportRulesApi.createRule(payload).catch(() => null)
      if (res?.success) message.success(t('reportRules.ruleCreated', { code: res.data.code }))
      else message.error(t('reportRules.createFailed'))
    }
    setEditorOpen(false)
    void load()
  }

  const toggleRule = async (rule: QualityRule, enabled: boolean) => {
    const res = await reportRulesApi.updateRule(rule.id, { enabled }).catch(() => null)
    if (res?.success) message.success(t('reportRules.ruleToggled', { code: rule.code, action: enabled ? t('reportRules.enabled') : t('reportRules.disabled') }))
    else message.error(t('reportRules.opFailed'))
    void load()
  }

  const removeRule = async (rule: QualityRule) => {
    const res = await reportRulesApi.deleteRule(rule.id).catch(() => null)
    if (res?.success) message.success(t('reportRules.ruleDeleted'))
    else message.error(t('reportRules.builtInDeleteDenied'))
    void load()
  }

  const openBind = (rs: RuleSet) => {
    setBindSet(rs)
    setBoundIds([...rs.ruleIds])
    setBindOpen(true)
  }

  const saveBind = async () => {
    if (!bindSet) return
    const res = await reportRulesApi.updateRuleset(bindSet.id, { ruleIds: boundIds }).catch(() => null)
    if (res?.success) message.success(t('reportRules.setBound', { name: bindSet.name, count: boundIds.length }))
    else message.error(t('reportRules.bindFailed'))
    setBindOpen(false)
    void load()
  }

  // 一键修正建议: 按违规逐条生成修正稿 (确定性规则驱动)
  const buildFixes = (fieldsNow: ReportFields, violations: RuleViolation[]): ReportFields => {
    const next: ReportFields = { ...fieldsNow }
    for (const v of violations) {
      if (v.severity !== 'error' && v.severity !== 'warning') continue
      if (v.field === 'fullText') continue
      const key = v.field as keyof ReportFields
      if (!(key in next)) continue
      const raw = next[key] ?? ''
      if (v.ruleCode === 'RR-MISSING-01' && raw.trim() === '') {
        next[key] = '双肺未见明显实质性病变, 建议定期随访。'
      } else if (v.ruleCode === 'RR-MISSING-02' && raw.trim() === '') {
        next[key] = '双侧胸廓对称。肺野内未见明显实变影及结节影, 双肺纹理清晰。'
      } else if (v.ruleCode === 'RR-MISSING-03' && raw.trim() === '') {
        next[key] = '双肺未见明显异常。'
      } else if (v.ruleCode === 'RR-MISSING-04' && raw.trim() === '') {
        next[key] = '建议 3-6 个月后复查, 观察病灶变化。'
      } else if (v.ruleCode === 'RR-SIDE-01' && v.snippet && v.snippet !== '(空)' && !raw.includes('右肺') && !raw.includes('左肺')) {
        next[key] = raw.replace(v.snippet, `右${v.snippet}`)
      } else if (v.ruleCode === 'RR-NUM-01' && v.snippet) {
        next[key] = raw.replace(v.snippet, '5mm')
      } else if (v.ruleCode === 'RR-UNIT-01' && v.snippet) {
        next[key] = raw.replace(v.snippet, `${v.snippet.replace(/\s+/g, '')}mm`)
      } else if (v.ruleCode === 'RR-TERM-03' && v.snippet) {
        next[key] = raw.replace(v.snippet, '肺癌')
      }
    }
    return next
  }

  const applyFixes = () => {
    if (!result) return
    const fixed = buildFixes(fields, result.violations)
    setFixedFields(fixed)
    setFixOpen(true)
  }

  const acceptFixes = () => {
    if (fixedFields) setFields(fixedFields)
    setFixOpen(false)
    message.success(t('reportRules.fixesApplied'))
  }

  const severityCount = (sev: RuleSeverity) => (result?.violations ?? []).filter((v) => v.severity === sev).length

  const ruleColumns: ColumnsType<QualityRule> = [
    { title: t('reportRules.thCode'), dataIndex: 'code', width: 130, render: (code: string) => <Tag>{code}</Tag> },
    { title: t('reportRules.thName'), dataIndex: 'name', width: 180 },
    {
      title: t('reportRules.thType'),
      dataIndex: 'type',
      width: 120,
      render: (t: RuleType) => <Tag color={TYPE_COLORS[t]}>{RULE_TYPE_LABELS[t]}</Tag>,
    },
    {
      title: t('reportRules.thSeverity'),
      dataIndex: 'severity',
      width: 90,
      render: (s: RuleSeverity) => <Tag color={SEVERITY_COLORS[s]}>{RULE_SEVERITY_LABELS[s]}</Tag>,
    },
    {
      title: t('reportRules.thCondition'),
      key: 'condition',
      render: (_, r) => (
        <span>
          {RULE_FIELD_LABELS[r.condition.field]} · {r.condition.operator}
          {r.condition.when ? t('reportRules.whenPrefix') : ''}
        </span>
      ),
    },
    {
      title: t('reportRules.thEnabled'),
      dataIndex: 'enabled',
      width: 80,
      render: (enabled: boolean, r) => <Switch size="small" checked={enabled} onChange={(v) => void toggleRule(r, v)} />,
    },
    {
      title: t('reportRules.thActions'),
      key: 'action',
      width: 120,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title={t('reportRules.edit')}>
            <Button aria-label="编辑" size="small" type="text" icon={<Pencil size={14} />} onClick={() => openEdit(r)} />
          </Tooltip>
          {!r.builtIn && (
            <Tooltip title={t('reportRules.deleteCustom')}>
              <Button aria-label="删除" size="small" type="text" danger icon={<Trash2 size={14} />} onClick={() => void removeRule(r)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  const violationColumns: ColumnsType<RuleViolation> = [
    { title: t('reportRules.thSeverity'), dataIndex: 'severity', width: 80, render: (s: RuleSeverity) => <Tag color={SEVERITY_COLORS[s]}>{RULE_SEVERITY_LABELS[s]}</Tag> },
    { title: t('reportRules.thRule'), dataIndex: 'ruleName', width: 180 },
    {
      title: t('reportRules.thPosition'),
      dataIndex: 'field',
      width: 100,
      render: (f: string) => (RULE_FIELD_LABELS[f as keyof typeof RULE_FIELD_LABELS] ?? f) + ' @' + t('reportRules.positionAt'),
    },
    {
      title: t('reportRules.thSnippet'),
      dataIndex: 'snippet',
      width: 200,
      ellipsis: true,
      render: (s: string) => (s === '(空)' ? <Tag>{t('reportRules.emptyField')}</Tag> : <code>{s}</code>),
    },
    { title: t('reportRules.thSuggestion'), dataIndex: 'suggestion', ellipsis: true },
  ]

  const rulesetColumns: ColumnsType<RuleSet> = [
    { title: t('reportRules.thRuleset'), dataIndex: 'name', width: 180 },
    {
      title: t('reportRules.thExamTypes'),
      dataIndex: 'examTypes',
      width: 180,
      render: (types: string[]) => (types.length === 0 ? <Tag>{t('reportRules.all')}</Tag> : types.map((t) => <Tag key={t}>{t}</Tag>)),
    },
    { title: t('reportRules.thBoundRules'), dataIndex: 'ruleIds', width: 90, render: (ids: string[]) => <Tag color="geekblue">{t('reportRules.boundCount', { count: ids.length })}</Tag> },
    { title: t('reportRules.thUpdatedAt'), dataIndex: 'updatedAt', width: 120, render: fmtDate },
    {
      title: t('reportRules.thActions'),
      key: 'action',
      width: 140,
      render: (_, rs) => (
        <Space size={4}>
          <Button size="small" icon={<Save size={13} />} onClick={() => openBind(rs)}>
            {t('reportRules.bindRules')}
          </Button>
        </Space>
      ),
    },
  ]

  const tierColumns: ColumnsType<ReviewTierRule> = [
    { title: t('w4a.tiers.thCode'), dataIndex: 'code', width: 130, render: (code: string) => <Tag>{code}</Tag> },
    { title: t('w4a.tiers.thName'), dataIndex: 'name', width: 180 },
    { title: t('w4a.tiers.thTier'), dataIndex: 'tier', width: 100, render: (tier: ReviewTier) => <Tag color={TIER_COLORS[tier]}>{t(TIER_LABEL_KEYS[tier])}</Tag> },
    { title: t('w4a.tiers.thPriority'), dataIndex: 'priority', width: 80, sorter: (a, b) => a.priority - b.priority },
    { title: t('w4a.tiers.thWhen'), key: 'when', ellipsis: true, render: (_, r) => <span style={{ fontSize: 12 }}>{tierWhenSummary(r)}</span> },
    { title: t('w4a.tiers.thEnabled'), dataIndex: 'enabled', width: 80, render: (enabled: boolean, r) => <Switch size="small" checked={enabled} onChange={(v) => void toggleTier(r, v)} /> },
    {
      title: t('w4a.tiers.thActions'),
      key: 'action',
      width: 120,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title={t('w4a.tiers.edit')}>
            <Button aria-label="编辑" size="small" type="text" icon={<Pencil size={14} />} onClick={() => openTierEdit(r)} />
          </Tooltip>
          <Tooltip title={t('w4a.tiers.delete')}>
            <Button aria-label="删除" size="small" type="text" danger icon={<Trash2 size={14} />} onClick={() => void removeTier(r)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  // [G005 W-D6] RWS 国标规则行 (后端 data / MSW rules 双形态兼容)
  const rwsRuleRows = useMemo<RwsRuleMeta[]>(() => {
    if (!rwsRules) return []
    const legacy = (rwsRules as unknown as { rules?: RwsRuleMeta[] }).rules
    return rwsRules.data ?? legacy ?? []
  }, [rwsRules])

  const rwsFailureColumns: ColumnsType<RwsFailure> = [
    { title: t('reportRules.thCode'), dataIndex: 'code', width: 220, render: (code: string) => <Tag color={SEVERITY_COLORS.error}>{code}</Tag> },
    { title: t('reportRules.thName'), dataIndex: 'name', width: 200 },
    {
      title: t('reportRules.thSeverity'),
      dataIndex: 'severity',
      width: 90,
      render: (s: RuleSeverity) => <Tag color={SEVERITY_COLORS[s]}>{RULE_SEVERITY_LABELS[s]}</Tag>,
    },
    { title: t('reportRules.thCondition'), key: 'condition', ellipsis: true, render: (_, r) => r.condition || '-' },
    { title: t('reportRules.thSuggestion'), dataIndex: 'suggestion', ellipsis: true },
  ]

  const rwsRuleColumns: ColumnsType<RwsRuleMeta> = [
    { title: t('reportRules.thCode'), dataIndex: 'code', width: 200, render: (code: string) => <Tag>{code}</Tag> },
    { title: t('reportRules.thName'), dataIndex: 'name', width: 220 },
    { title: t('reportRules.thType'), dataIndex: 'type', width: 170, render: (v: string) => <Tag color="geekblue">{v}</Tag> },
    {
      title: t('reportRules.thSeverity'),
      dataIndex: 'severity',
      width: 90,
      render: (s: RuleSeverity) => <Tag color={SEVERITY_COLORS[s]}>{RULE_SEVERITY_LABELS[s]}</Tag>,
    },
    { title: t('reportRules.thCondition'), key: 'condition', ellipsis: true, render: (_, r) => r.conditionLabel || r.condition || '-' },
    { title: t('reportRules.thSuggestion'), dataIndex: 'suggestion', ellipsis: true },
  ]

  const rwsHistoryColumns: ColumnsType<RuleViolationRecord> = [
    { title: t('w13Sec.cp.col.id'), dataIndex: 'id', width: 120, render: (v: string) => <Tag>{v}</Tag> },
    { title: t('signAmend.colReport'), dataIndex: 'reportId', width: 150, render: (v: string) => <span style={{ fontSize: 12 }}>{v ?? '-'}</span> },
    { title: t('reportRules.thCode'), dataIndex: 'ruleCode', width: 150 },
    { title: t('reportRules.thRule'), dataIndex: 'ruleName', ellipsis: true },
    {
      title: t('reportRules.thSeverity'),
      dataIndex: 'severity',
      width: 90,
      render: (s: RuleSeverity) => <Tag color={SEVERITY_COLORS[s]}>{RULE_SEVERITY_LABELS[s]}</Tag>,
    },
    { title: t('reportRules.thPosition'), dataIndex: 'field', width: 110 },
    {
      title: t('reportRules.thUpdatedAt'), dataIndex: 'evaluatedAt', width: 160,
      render: (v: string) => <span style={{ fontSize: 12 }}>{v ? v.slice(0, 19).replace('T', ' ') : '-'}</span>,
    },
  ]

  const statsCards = useMemo(() => {
    const s = stats
    return [
      { label: t('reportRules.kpiTotal'), value: s?.totalRules ?? rules.length, icon: <ShieldCheck size={18} />, color: 'var(--color-primary-500)' },
      { label: t('reportRules.kpiBuiltIn'), value: s?.builtInRules ?? 0, icon: <FileCheck2 size={18} />, color: '#10b981' },
      { label: t('reportRules.kpiCustom'), value: s?.customRules ?? 0, icon: <Plus size={18} />, color: '#8b5cf6' },
      { label: t('reportRules.kpiViolations'), value: s?.totalViolations ?? 0, icon: <AlertTriangle size={18} />, color: 'var(--color-warning-500)' },
    ]
  }, [stats, rules.length])

  const evaluationText = useMemo(() => {
    if (!result) return ''
    const es = severityCount('error')
    const ws = severityCount('warning')
    const infos = severityCount('info')
    return t('reportRules.evalSummary', { score: result.score, error: es, warning: ws, info: infos })
  }, [result, severityCount])

  return (
    <PageContainer>
      <PageHeader
        title={t('reportRules.title')}
        subtitle={t('reportRules.subtitle')}
        icon={<ShieldCheck size={22} />}
        variant="flex"
        actions={
          <Space>
            <Tag color={source === 'database' ? 'green' : source === 'demo' ? 'blue' : 'red'} icon={<Database size={12} />}>
              {source === 'database' ? t('common.api.database') : source === 'demo' ? t('common.api.demoSeed') : t('common.api.offline')}
            </Tag>
            <Button icon={<Plus size={14} />} type="primary" onClick={openCreate}>
              {t('reportRules.newRule')}
            </Button>
          </Space>
        }
      />

      {loadError && <ErrorBanner message={loadError} onRetry={() => void load()} retryLabel={t('w9.states.retry')} />}

      <StatCardGrid gap={12}>
        {statsCards.map((s, i) => (
          <StatCard key={i} title={s.label} value={s.value} icon={s.icon} color={s.color} />
        ))}
      </StatCardGrid>

      <Tabs
        defaultActiveKey="rules"
        items={[
          {
            key: 'rules',
            label: t('reportRules.tabRules'),
            children: (
              <Card size="small" title={t('reportRules.rulesTitle', { count: rules.length, type: examType })} extra={<Select value={examType} style={{ width: 140 }} options={[{ value: 'ALL', label: t('reportRules.allTypes') }, ...EXAM_TYPE_OPTIONS]} onChange={(v) => setExamType(v)} />}>
                <DataTable rowKey="id" loading={loading} columns={ruleColumns} dataSource={rules} pagination={{ pageSize: 10 }} scroll={{ x: 900 }} />
              </Card>
            ),
          },
          {
            key: 'evaluate',
            label: t('reportRules.tabEvaluate'),
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Card size="small">
                  <Space wrap>
                    <Select style={{ width: 140 }} value={examType} options={[{ value: 'ALL', label: t('reportRules.allTypes') }, ...EXAM_TYPE_OPTIONS]} onChange={setExamType} />
                    <Select
                      style={{ width: 220 }}
                      value={rulesetId}
                      onChange={setRulesetId}
                      options={rulesets.map((rs) => ({ value: rs.id, label: `${rs.name} (${t('reportRules.boundCount', { count: rs.ruleIds.length })})` }))}
                    />
                    <Button type="primary" icon={<Play size={14} />} loading={evaluating} onClick={() => void runEvaluate()}>
                      {t('reportRules.runEvaluate')}
                    </Button>
                    <Tooltip title={t('reportRules.fixHint')}>
                      <Button icon={<Wand2 size={14} />} disabled={!result || result.violations.length === 0} onClick={applyFixes}>
                        {t('reportRules.oneClickFix')}
                      </Button>
                    </Tooltip>
                    {result && (
                      <Tag color={result.score >= 90 ? 'green' : result.score >= 60 ? 'orange' : 'red'}>
                        {evaluationText}
                      </Tag>
                    )}
                  </Space>
                </Card>
                <Card size="small" title={t('reportRules.reportText')}>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {FIELD_KEYS.map((key) => (
                      <div key={key}>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 'var(--space-1, 4px)' }}>
                          {fieldLabel(key)}
                          {fields[key].trim() === '' && <Tag color="red" style={{ marginLeft: 'var(--space-2, 8px)' }}>{t('reportRules.missing')}</Tag>}
                        </div>
                        <Input.TextArea
                          rows={key === 'findings' ? 4 : 2}
                          value={fields[key]}
                          onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </Space>
                </Card>
                <Card size="small" title={t('reportRules.violationResult', { count: result?.violations.length ?? 0 })}>
                  {result && result.violations.length > 0 ? (
                    <DataTable rowKey={(v) => v.ruleId} columns={violationColumns} dataSource={result.violations} pagination={{ pageSize: 8 }} scroll={{ x: 800 }} />
                  ) : (
                    <Empty description={result ? t('reportRules.compliant') : t('reportRules.runFirst')} />
                  )}
                </Card>
              </Space>
            ),
          },
          {
            // [G005 W-D6] RWS 规则引擎 (国标报告书写规范 RQI-RWS-03)
            key: 'rws',
            label: `${t('qc.standards')} (RWS)`,
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Card
                  size="small"
                  title={<span><Play size={14} /> {t('reportRules.tabEvaluate')} · RWS</span>}
                  data-testid="rws-evaluate-panel"
                >
                  <Space wrap style={{ marginBottom: 'var(--space-3, 12px)' }}>
                    <Select
                      style={{ width: 240 }}
                      value={rwsReportId}
                      onChange={(v) => selectRwsReport(v)}
                      options={RWS_DEMO_REPORTS.map((r) => ({ value: r.reportId, label: `${r.reportId} · ${r.examType}` }))}
                    />
                    <Input
                      style={{ width: 180 }}
                      value={signedBy}
                      onChange={(e) => setSignedBy(e.target.value)}
                      placeholder={t('w8Report.sig.signedBy')}
                    />
                    <Button type="primary" icon={<Play size={14} />} loading={rwsRunning} onClick={() => void runRwsEvaluate()}>
                      {t('reportRules.runEvaluate')}
                    </Button>
                    {result && (
                      <Tag color={result.score >= 90 ? 'green' : result.score >= 60 ? 'orange' : 'red'}>
                        {t('reportRules.evalSummary', { score: result.score, error: severityCount('error'), warning: severityCount('warning'), info: severityCount('info') })}
                      </Tag>
                    )}
                    {rwsResult && (
                      <Tag color={rwsResult.compliant ? severityToAntd('success') : severityToAntd('critical')}>
                        RWS {rwsResult.rate}% · {rwsResult.numerator}/{rwsResult.denominator}
                      </Tag>
                    )}
                  </Space>
                  {result && result.violations.length > 0 && (
                    <DataTable
                      rowKey={(v) => `${v.ruleId}-${v.field}-${v.position}`}
                      columns={violationColumns}
                      dataSource={result.violations}
                      pagination={{ pageSize: 5 }}
                      scroll={{ x: 800 }}
                      showExport={false}
                    />
                  )}
                  {rwsResult && (
                    <div style={{ marginTop: 'var(--space-3, 12px)' }}>
                      <Alert
                        type={rwsResult.compliant ? 'success' : 'warning'}
                        showIcon
                        message={
                          rwsResult.compliant
                            ? t('reportRules.compliant')
                            : t('reportRules.violationResult', { count: rwsResult.failures?.length ?? 0 })
                        }
                        description={
                          <div style={{ fontSize: 12 }}>
                            <div>
                              {rwsResult.rateExplanation || t('rqi2024.passRate')}: {rwsResult.rate}% · {t('rqi2024.target')} {rwsResult.target ?? 98}%
                            </div>
                            {rwsResult.standard && <div>{rwsResult.standard}</div>}
                          </div>
                        }
                      />
                      {(rwsResult.failures ?? []).length > 0 && (
                        <div style={{ marginTop: 'var(--space-3, 12px)' }}>
                          <DataTable<RwsFailure>
                            rowKey="code"
                            columns={rwsFailureColumns}
                            dataSource={rwsResult.failures}
                            pagination={{ pageSize: 5 }}
                            scroll={{ x: 800 }}
                            showExport={false}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {(!result || result.violations.length === 0) && !rwsResult && (
                    <Empty description={t('reportRules.runFirst')} />
                  )}
                </Card>

                <Card
                  size="small"
                  title={<span><BarChart3 size={14} /> {t('rqi2024.passRate')} · RWS</span>}
                  extra={
                    <Button size="small" icon={<Play size={12} />} loading={rateRunning} onClick={() => void runRwsRate()}>
                      {t('reportRules.runEvaluate')}
                    </Button>
                  }
                  data-testid="rws-rate-chart"
                >
                  <TrendChart
                    type="bar"
                    data={rwsRateRows}
                    xKey="name"
                    series={[
                      { key: 'rate', name: t('rqi2024.passRate'), color: 'var(--color-primary-600)' },
                      { key: 'target', name: t('rqi2024.target'), color: 'var(--color-warning-500)' },
                    ]}
                    percent
                    height={240}
                    testId="rws-rate-chart"
                  />
                </Card>

                <Card
                  size="small"
                  title={<span><BookOpen size={14} /> {t('termLibrary.nationalStandard')} · RWS</span>}
                  extra={
                    <Space size={4}>
                      <Tag color="blue">{rwsRuleRows.length}</Tag>
                      {rwsRules?.target !== undefined && <Tag color="green">{t('rqi2024.target')} {rwsRules.target}%</Tag>}
                    </Space>
                  }
                  data-testid="rws-national-rules"
                >
                  <DataTable<RwsRuleMeta>
                    rowKey="code"
                    columns={rwsRuleColumns}
                    dataSource={rwsRuleRows}
                    pagination={{ pageSize: 8 }}
                    scroll={{ x: 900 }}
                    showExport={false}
                    emptyText={t('w9.states.empty')}
                  />
                  {rwsRules?.rateFormula && (
                    <div style={{ marginTop: 'var(--space-2, 8px)', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {rwsRules.rateFormula}
                    </div>
                  )}
                </Card>

                <Card
                  size="small"
                  title={<span><History size={14} /> {t('report.history')}</span>}
                  extra={<Tag color="blue">{rwsHistory.length}</Tag>}
                  data-testid="rws-history"
                >
                  <DataTable<RuleViolationRecord>
                    rowKey="id"
                    columns={rwsHistoryColumns}
                    dataSource={rwsHistory}
                    pagination={{ pageSize: 8 }}
                    scroll={{ x: 900 }}
                    showExport={false}
                    emptyText={t('w9.states.empty')}
                  />
                </Card>
              </Space>
            ),
          },
          {
            key: 'rulesets',
            label: t('reportRules.tabRulesets'),
            children: (
              <Card size="small" title={t('reportRules.rulesetsTitle', { count: rulesets.length })}>
                <DataTable rowKey="id" columns={rulesetColumns} dataSource={rulesets} pagination={false} />
              </Card>
            ),
          },
          {
            key: 'reviewTiers',
            label: t('w4a.tiers.tab'),
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Card
                  size="small"
                  title={t('w4a.tiers.listTitle', { count: tiers.length })}
                  extra={<Button type="primary" size="small" icon={<Plus size={14} />} onClick={openTierCreate}>{t('w4a.tiers.newRule')}</Button>}
                >
                  <DataTable rowKey="id" loading={tierLoading} columns={tierColumns} dataSource={tiers} pagination={{ pageSize: 10 }} scroll={{ x: 900 }} />
                </Card>

                <Card size="small" title={t('w4a.tiers.resolveTitle')}>
                  <Space wrap style={{ marginBottom: 'var(--space-3, 12px)' }}>
                    <Select
                      style={{ width: 110 }}
                      value={resolveInput.modality}
                      placeholder={t('w4a.tiers.fldModality')}
                      options={MODALITY_OPTIONS}
                      onChange={(v) => setResolveInput((p) => ({ ...p, modality: v }))}
                      allowClear
                    />
                    <InputNumber
                      style={{ width: 150 }}
                      min={0}
                      max={5}
                      value={resolveInput.radsCategory}
                      placeholder={t('w4a.tiers.fldRadsCategory')}
                      onChange={(v) => setResolveInput((p) => ({ ...p, radsCategory: v ?? undefined }))}
                      addonBefore="RADS≥"
                    />
                    <Select
                      style={{ width: 130 }}
                      value={resolveInput.severity}
                      placeholder={t('w4a.tiers.fldSeverity')}
                      options={CASE_SEVERITY_OPTIONS}
                      onChange={(v) => setResolveInput((p) => ({ ...p, severity: v as CaseSeverity }))}
                      allowClear
                    />
                    <Select
                      style={{ width: 150 }}
                      value={resolveInput.authorSeniority}
                      placeholder={t('w4a.tiers.fldAuthorSeniority')}
                      options={SENIORITY_OPTIONS}
                      onChange={(v) => setResolveInput((p) => ({ ...p, authorSeniority: v as AuthorSeniority }))}
                      allowClear
                    />
                    <Checkbox
                      checked={Boolean(resolveInput.isCritical)}
                      onChange={(e) => setResolveInput((p) => ({ ...p, isCritical: e.target.checked }))}
                    >
                      {t('w4a.tiers.fldCritical')}
                    </Checkbox>
                    <Button type="primary" icon={<Play size={14} />} loading={resolving} onClick={() => void runResolve()}>{t('w4a.tiers.resolve')}</Button>
                  </Space>

                  {resolveResult && (
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      <Space wrap>
                        <span>{t('w4a.tiers.requiredTier')}:</span>
                        <Tag color={TIER_COLORS[resolveResult.requiredTier]} style={{ fontSize: 14 }}>{t(TIER_LABEL_KEYS[resolveResult.requiredTier])}</Tag>
                        {resolveResult.critical && <Tag color="red">{t('w4a.tiers.critical')}</Tag>}
                      </Space>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t('w4a.tiers.steps')}</div>
                        <DataTable
                          rowKey="order"
                          pagination={false}
                          dataSource={resolveResult.steps}
                          columns={[
                            { title: t('w4a.tiers.stepOrder'), dataIndex: 'order', width: 60 },
                            { title: t('w4a.tiers.stepLabel'), dataIndex: 'label', width: 100 },
                            { title: t('w4a.tiers.stepRole'), dataIndex: 'role', width: 140 },
                            { title: t('w4a.tiers.stepReason'), dataIndex: 'reason' },
                          ]}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t('w4a.tiers.matched')}</div>
                        {resolveResult.matchedRules.length === 0 ? (
                          <span style={{ fontSize: 12, color: '#999' }}>{t('w4a.tiers.noMatched')}</span>
                        ) : (
                          <Space wrap>
                            {resolveResult.matchedRules.map((m) => (
                              <Tag key={m.ruleId} color={TIER_COLORS[m.tier]}>{m.code} · {m.name}</Tag>
                            ))}
                          </Space>
                        )}
                      </div>
                    </Space>
                  )}
                </Card>
              </Space>
            ),
          },
        ]}
      />

      {/* 自定义规则编辑器 */}
      <Modal
        title={editing ? t('reportRules.editRule', { code: editing.code }) : t('reportRules.createRule')}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={() => void saveRule()}
        width={720}
        destroyOnClose
      >
        <Form form={ruleForm} layout="vertical">
          <Space size={12} style={{ width: '100%' }} wrap>
            <Form.Item name="name" label={t('reportRules.fldName')} rules={[{ required: true }]} style={{ width: 300 }}>
              <Input placeholder={t('reportRules.fldNamePlaceholder')} />
            </Form.Item>
            <Form.Item name="code" label={t('reportRules.fldCode')} style={{ width: 160 }}>
              <Input placeholder="RR-CUSTOM-x" />
            </Form.Item>
            <Form.Item name="type" label={t('reportRules.fldType')} rules={[{ required: true }]} style={{ width: 160 }}>
              <Select options={TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item name="severity" label={t('reportRules.fldSeverity')} rules={[{ required: true }]} style={{ width: 130 }}>
              <Select options={SEVERITY_OPTIONS} />
            </Form.Item>
          </Space>
          <Form.Item name="description" label={t('reportRules.fldDescription')}>
            <Input.TextArea rows={1} />
          </Form.Item>
          <Space size={12} wrap>
            <Form.Item name="field" label={t('reportRules.fldField')} rules={[{ required: true }]} style={{ width: 150 }}>
              <Select options={FIELD_OPTIONS} />
            </Form.Item>
            <Form.Item name="operator" label={t('reportRules.fldOperator')} rules={[{ required: true }]} style={{ width: 220 }}>
              <Select options={OPERATOR_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))} />
            </Form.Item>
            <Form.Item name="value" label={t('reportRules.fldValue')} rules={[{ required: true }]} style={{ width: 200 }}>
              <Input placeholder={t('reportRules.fldValuePlaceholder')} />
            </Form.Item>
          </Space>
          <Space size={12} wrap>
            <Form.Item name="whenField" label={t('reportRules.fldWhenField')} style={{ width: 170 }}>
              <Select allowClear options={FIELD_OPTIONS} />
            </Form.Item>
            <Form.Item name="whenOperator" label={t('reportRules.fldWhenOperator')} style={{ width: 180 }}>
              <Select allowClear options={OPERATOR_OPTIONS.filter((o) => ['contains', 'not_contains', 'empty', 'not_empty'].includes(o.value)).map((o) => ({ value: o.value, label: t(o.labelKey) }))} />
            </Form.Item>
            <Form.Item name="whenValue" label={t('reportRules.fldWhenValue')} style={{ width: 200 }}>
              <Input placeholder={t('reportRules.fldWhenValuePlaceholder')} />
            </Form.Item>
          </Space>
          <Form.Item name="suggestion" label={t('reportRules.fldSuggestion')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="examTypes" label={t('reportRules.fldExamTypes')}>
            <Select mode="multiple" allowClear options={EXAM_TYPE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* [G005 W4A] 分级审核规则编辑器 */}
      <Modal
        title={editingTier ? `${t('w4a.tiers.edit')} ${editingTier.code}` : t('w4a.tiers.newRule')}
        open={tierEditorOpen}
        onCancel={() => setTierEditorOpen(false)}
        onOk={() => void saveTier()}
        okText={t('w4a.tiers.save')}
        cancelText={t('w4a.tiers.cancel')}
        width={960}
        destroyOnClose
      >
        <Form form={tierForm} layout="vertical">
          <Space size={12} wrap>
            <Form.Item name="name" label={t('w4a.tiers.fldName')} rules={[{ required: true }]} style={{ width: 280 }}>
              <Input />
            </Form.Item>
            <Form.Item name="code" label={t('w4a.tiers.fldCode')} style={{ width: 160 }}>
              <Input placeholder="RT-CUSTOM-x" />
            </Form.Item>
            <Form.Item name="tier" label={t('w4a.tiers.fldTier')} rules={[{ required: true }]} style={{ width: 140 }}>
              <Select options={TIER_OPTIONS} />
            </Form.Item>
            <Form.Item name="priority" label={t('w4a.tiers.fldPriority')} style={{ width: 120 }}>
              <InputNumber min={0} max={1000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="enabled" label={t('w4a.tiers.enabled')} valuePropName="checked" style={{ width: 90 }}>
              <Switch />
            </Form.Item>
          </Space>
          <Form.Item name="description" label={t('w4a.tiers.fldDescription')}>
            <Input.TextArea rows={1} />
          </Form.Item>
          <Space size={12} wrap>
            <Form.Item name="modalities" label={t('w4a.tiers.fldModalities')} style={{ width: 240 }}>
              <Select mode="multiple" allowClear options={MODALITY_OPTIONS} />
            </Form.Item>
            <Form.Item name="radsCategoryGte" label={t('w4a.tiers.fldRadsGte')} style={{ width: 160 }}>
              <InputNumber min={0} max={5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="severities" label={t('w4a.tiers.fldSeverities')} style={{ width: 220 }}>
              <Select mode="multiple" allowClear options={CASE_SEVERITY_OPTIONS} />
            </Form.Item>
          </Space>
          <Space size={12} wrap>
            <Form.Item name="whenIsCritical" label={t('w4a.tiers.fldCritical')} style={{ width: 160 }}>
              <Select allowClear options={[{ value: true, label: t('w4a.severity.critical') }, { value: false, label: t('w4a.tiers.allTypes') }]} />
            </Form.Item>
            <Form.Item name="authorSeniorityIn" label={t('w4a.tiers.fldSeniority')} style={{ width: 260 }}>
              <Select mode="multiple" allowClear options={SENIORITY_OPTIONS} />
            </Form.Item>
          </Space>
          <Form.Item name="reason" label={t('w4a.tiers.fldReason')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* 规则集绑定抽屉 */}
      <Drawer title={t('reportRules.bindTitle', { name: bindSet?.name ?? '' })} width={420} open={bindOpen} onClose={() => setBindOpen(false)} extra={<Button type="primary" onClick={() => void saveBind()}>{t('reportRules.saveBind')}</Button>}>
        <Checkbox.Group
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
          value={boundIds}
          onChange={(vals) => setBoundIds(vals as string[])}
          options={rules.map((r) => ({
            value: r.id,
            label: `${r.code} · ${r.name} (${RULE_SEVERITY_LABELS[r.severity]})`,
          }))}
        />
        <div style={{ marginTop: 'var(--space-3, 12px)', fontSize: 12, color: '#999' }}>{t('reportRules.selectedCount', { count: boundIds.length, total: rules.length })}</div>
      </Drawer>

      {/* 一键修正建议抽屉 */}
      <Drawer title={t('reportRules.fixTitle')} width={560} open={fixOpen} onClose={() => setFixOpen(false)} extra={<Button type="primary" icon={<FileCheck2 size={14} />} onClick={acceptFixes}>{t('reportRules.applyToReport')}</Button>}>
        {fixedFields && (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            {FIELD_KEYS.map((key) => (
              <div key={key}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 'var(--space-1, 4px)' }}>
                  {fieldLabel(key)}
                  {fixedFields[key] !== fields[key] && <Tag color="green" style={{ marginLeft: 6 }}>{t('reportRules.fixed')}</Tag>}
                </div>
                <Input.TextArea rows={2} value={fixedFields[key]} onChange={(e) => setFixedFields((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))} />
              </div>
            ))}
            <div style={{ fontSize: 12, color: '#999' }}>
              {t('reportRules.fixRulesDesc')}
            </div>
          </Space>
        )}
      </Drawer>

      {/* 违规统计小标 */}
      {result && result.violations.length > 0 && (
        <div style={{ marginTop: 'var(--space-2, 8px)', fontSize: 12, color: '#666', display: 'flex', gap: 'var(--space-3, 12px)', alignItems: 'center' }}>
          <ScrollText size={14} /> {t('reportRules.evalThisRun')}: <AlertOctagon size={12} color="var(--color-error-500)" /> {severityCount('error')} {t('reportRules.errorUnit')} ·
          <AlertTriangle size={12} color="var(--color-warning-500)" /> {severityCount('warning')} {t('reportRules.warningUnit')} ·
          <Info size={12} color="var(--color-primary-500)" /> {severityCount('info')} {t('reportRules.infoUnit')}
        </div>
      )}
    </PageContainer>
  )
}

import { DataTable } from "../../components/common";