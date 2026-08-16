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
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PageContainer } from '../../components/common/PageContainer'
import { PageHeader } from '../../components/common/PageHeader'
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

  const load = useCallback(async () => {
    setLoading(true)
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
      message.warning(t('reportRules.loadFailed'))
    }
    if (setsRes?.success && setsRes.data?.data) setRulesets(setsRes.data.data)
    if (statsRes?.success && statsRes.data?.data) setStats(statsRes.data.data)
    setLoading(false)
  }, [examType])

  useEffect(() => {
    void load()
  }, [load])

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
