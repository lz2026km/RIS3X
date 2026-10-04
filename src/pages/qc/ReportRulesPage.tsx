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
  Info,
  ScrollText,
} from 'lucide-react'
import {
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Table,
  Switch,
  message,
  Empty,
  Card,
  Tabs,
  Tooltip,
  Checkbox,
  Drawer,
  InputNumber,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PageContainer } from '../../components/common/PageContainer'
import { PageHeader } from '../../components/common/PageHeader'
import { ErrorBanner } from '../../components/feedback'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'
import { t } from '../../i18n/appI18n'
import {
  reportRulesApi,
  RULE_TYPE_LABELS,
  RULE_SEVERITY_LABELS,
  RULE_FIELD_LABELS,
  type QualityRule,
  type RuleSet,
  type RuleViolation,
  type RuleStats,
  type RuleType,
  type RuleSeverity,
  type RuleField,
  type RuleOperator,
  type EvaluateResult,
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

const SEVERITY_COLORS: Record<string, string> = { error: 'red', warning: 'orange', info: 'blue' }
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
            <Button size="small" type="text" icon={<Pencil size={14} />} onClick={() => openEdit(r)} />
          </Tooltip>
          {!r.builtIn && (
            <Tooltip title={t('reportRules.deleteCustom')}>
              <Button size="small" type="text" danger icon={<Trash2 size={14} />} onClick={() => void removeRule(r)} />
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
            <Button size="small" type="text" icon={<Pencil size={14} />} onClick={() => openTierEdit(r)} />
          </Tooltip>
          <Tooltip title={t('w4a.tiers.delete')}>
            <Button size="small" type="text" danger icon={<Trash2 size={14} />} onClick={() => void removeTier(r)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  const statsCards = useMemo(() => {
    const s = stats
    return [
      { label: t('reportRules.kpiTotal'), value: s?.totalRules ?? rules.length, icon: <ShieldCheck size={18} />, color: '#3b82f6' },
      { label: t('reportRules.kpiBuiltIn'), value: s?.builtInRules ?? 0, icon: <FileCheck2 size={18} />, color: '#10b981' },
      { label: t('reportRules.kpiCustom'), value: s?.customRules ?? 0, icon: <Plus size={18} />, color: '#8b5cf6' },
      { label: t('reportRules.kpiViolations'), value: s?.totalViolations ?? 0, icon: <AlertTriangle size={18} />, color: '#f59e0b' },
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
                <Table rowKey="id" size="small" loading={loading} columns={ruleColumns} dataSource={rules} pagination={{ pageSize: 10 }} scroll={{ x: 900 }} />
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
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                          {fieldLabel(key)}
                          {fields[key].trim() === '' && <Tag color="red" style={{ marginLeft: 8 }}>{t('reportRules.missing')}</Tag>}
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
                    <Table rowKey={(v) => v.ruleId} size="small" columns={violationColumns} dataSource={result.violations} pagination={{ pageSize: 8 }} scroll={{ x: 800 }} />
                  ) : (
                    <Empty description={result ? t('reportRules.compliant') : t('reportRules.runFirst')} />
                  )}
                </Card>
              </Space>
            ),
          },
          {
            key: 'rulesets',
            label: t('reportRules.tabRulesets'),
            children: (
              <Card size="small" title={t('reportRules.rulesetsTitle', { count: rulesets.length })}>
                <Table rowKey="id" size="small" columns={rulesetColumns} dataSource={rulesets} pagination={false} />
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
                  <Table rowKey="id" size="small" loading={tierLoading} columns={tierColumns} dataSource={tiers} pagination={{ pageSize: 10 }} scroll={{ x: 900 }} />
                </Card>

                <Card size="small" title={t('w4a.tiers.resolveTitle')}>
                  <Space wrap style={{ marginBottom: 12 }}>
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
                        <Table
                          rowKey="order"
                          size="small"
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
        width={760}
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
        <div style={{ marginTop: 12, fontSize: 12, color: '#999' }}>{t('reportRules.selectedCount', { count: boundIds.length, total: rules.length })}</div>
      </Drawer>

      {/* 一键修正建议抽屉 */}
      <Drawer title={t('reportRules.fixTitle')} width={520} open={fixOpen} onClose={() => setFixOpen(false)} extra={<Button type="primary" icon={<FileCheck2 size={14} />} onClick={acceptFixes}>{t('reportRules.applyToReport')}</Button>}>
        {fixedFields && (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            {FIELD_KEYS.map((key) => (
              <div key={key}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
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
        <div style={{ marginTop: 8, fontSize: 12, color: '#666', display: 'flex', gap: 12, alignItems: 'center' }}>
          <ScrollText size={14} /> {t('reportRules.evalThisRun')}: <AlertOctagon size={12} color="#ef4444" /> {severityCount('error')} {t('reportRules.errorUnit')} ·
          <AlertTriangle size={12} color="#f59e0b" /> {severityCount('warning')} {t('reportRules.warningUnit')} ·
          <Info size={12} color="#3b82f6" /> {severityCount('info')} {t('reportRules.infoUnit')}
        </div>
      )}
    </PageContainer>
  )
}
