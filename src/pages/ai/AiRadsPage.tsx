import React, { useState, useCallback, useEffect } from 'react'
import { Card, Space, Select, InputNumber, Button, Typography, Tag, Divider, message, Form, Tabs, Table, Tooltip } from 'antd'
import { Sparkles, Cpu, History, FileText } from 'lucide-react'
import { t } from '../../i18n/appI18n'
import RadsScoring from '../../components/ai/RadsScoring'
import { radsApi } from '../../services/api/radsApi'
import type { RadsScore, RadsHistoryEntry, RadsRules, RadsRule } from '../../services/api/radsApi'
import { scoreRadsLocally } from '../../services/radsLocalScore'
import type { RadsType as LocalRadsType } from '../../services/radsLocalScore'
import { RADS_RULES } from '../../data/radsRules'
import type { RadsSystem } from '../../data/radsRules'

const { Text, Title } = Typography

// v3.0.6.11-60: 多 RADS 扩展 — Lung/BI/PI/LI/TI 五大分级 Tab
type RadsType = 'lung' | 'breast' | 'prostate' | 'liver' | 'thyroid'

const radsTabs: { key: RadsType; label: string }[] = [
  { key: 'lung', label: t('aiRads.tab.lung') },
  { key: 'breast', label: t('aiRads.tab.breast') },
  { key: 'prostate', label: t('aiRads.tab.prostate') },
  { key: 'liver', label: t('aiRads.tab.liver') },
  { key: 'thyroid', label: t('aiRads.tab.thyroid') },
]

// [v3.0.6.11-99 W10C] 本地规则回退: RADS 规则词典 (radsRules.ts) → 后端规则表结构
const radsTypeToSystem: Record<RadsType, RadsSystem> = {
  lung: 'Lung-RADS',
  breast: 'BI-RADS',
  prostate: 'PI-RADS',
  liver: 'LI-RADS',
  thyroid: 'TI-RADS',
}

const localRadsRules = (): RadsRules[] =>
  radsTabs.map((tab) => {
    const rules = RADS_RULES.filter((r) => r.category === radsTypeToSystem[tab.key])
    return {
      type: tab.key,
      name: tab.label,
      levels: rules.map((r) => ({
        level: r.score,
        category: r.category,
        description: r.title,
        criteria: r.description,
        recommendations: r.management,
      })),
    }
  })

interface FieldDef {
  name: string
  label: string
  type: 'number' | 'boolean' | 'select'
  options?: { value: string | boolean; label: string }[]
  min?: number
  max?: number
  defaultValue?: unknown
}

const FIELDS: Record<Exclude<RadsType, 'breast'>, FieldDef[]> = {
  lung: [
    { name: 'noduleSizeMm', label: t('aiRads.f.noduleSize'), type: 'number', min: 1, max: 50, defaultValue: 8 },
    { name: 'spiculatedMargin', label: t('aiRads.f.spiculatedMargin'), type: 'boolean', options: [{ value: true, label: t('aiRads.opt.yes') }, { value: false, label: t('aiRads.opt.no') }], defaultValue: false },
    { name: 'solidComponent', label: t('aiRads.f.solidComponent'), type: 'boolean', options: [{ value: true, label: t('aiRads.opt.yes') }, { value: false, label: t('aiRads.opt.no') }], defaultValue: true },
  ],
  prostate: [
    { name: 'lesionZone', label: t('aiRads.f.lesionZone'), type: 'select', options: [{ value: 'PZ', label: t('aiRads.opt.pz') }, { value: 'TZ', label: t('aiRads.opt.tz') }, { value: 'AFS', label: t('aiRads.opt.afs') }], defaultValue: 'PZ' },
    { name: 'lesionSizeMm', label: t('aiRads.f.lesionSize'), type: 'number', min: 1, max: 50, defaultValue: 12 },
    { name: 'dwiSignal', label: t('aiRads.f.dwiSignal'), type: 'select', options: [{ value: 'low', label: t('aiRads.opt.lowSignal') }, { value: 'mild', label: t('aiRads.opt.mildIncrease') }, { value: 'high', label: t('aiRads.opt.markedIncrease') }], defaultValue: 'high' },
    { name: 't2Signal', label: t('aiRads.f.t2Signal'), type: 'select', options: [{ value: 'low', label: t('aiRads.opt.lowSignal') }, { value: 'mild', label: t('aiRads.opt.mediumSignal') }, { value: 'high', label: t('aiRads.opt.highSignal') }], defaultValue: 'low' },
    { name: 'adcValue', label: t('aiRads.f.adcValue'), type: 'number', min: 0, max: 3000, defaultValue: 900 },
  ],
  liver: [
    { name: 'sizeMm', label: t('aiRads.f.lesionSize'), type: 'number', min: 1, max: 100, defaultValue: 22 },
    { name: 'arterialPhaseEnhancement', label: t('aiRads.f.arterialEnhancement'), type: 'select', options: [
      { value: 'nonrim', label: t('aiRads.opt.nonrim') }, { value: 'rim', label: t('aiRads.opt.rim') }, { value: 'none', label: t('aiRads.opt.none') }, { value: 'nodule-in-nodule', label: t('aiRads.opt.noduleInNodule') }, { value: 'corona', label: t('aiRads.opt.corona') }], defaultValue: 'nonrim' },
    { name: 'washout', label: t('aiRads.f.washout'), type: 'select', options: [{ value: 'yes', label: t('aiRads.opt.present') }, { value: 'no', label: t('aiRads.opt.absent') }], defaultValue: 'yes' },
    { name: 'enhancingCapsule', label: t('aiRads.f.enhancingCapsule'), type: 'select', options: [{ value: 'yes', label: t('aiRads.opt.present') }, { value: 'no', label: t('aiRads.opt.absent') }], defaultValue: 'yes' },
    { name: 'thresholdGrowth', label: t('aiRads.f.thresholdGrowth'), type: 'select', options: [{ value: 'yes', label: t('aiRads.opt.present') }, { value: 'no', label: t('aiRads.opt.absent') }], defaultValue: 'no' },
    { name: 'tumorInVein', label: t('aiRads.f.tumorInVein'), type: 'select', options: [{ value: 'yes', label: t('aiRads.opt.present') }, { value: 'no', label: t('aiRads.opt.absent') }], defaultValue: 'no' },
  ],
  thyroid: [
    { name: 'composition', label: t('aiRads.f.composition'), type: 'select', options: [{ value: 'cystic', label: t('aiRads.opt.cystic') }, { value: 'spongiform', label: t('aiRads.opt.spongiform') }, { value: 'mixed', label: t('aiRads.opt.mixedCysticSolid') }, { value: 'solid', label: t('aiRads.opt.solid') }], defaultValue: 'solid' },
    { name: 'echogenicity', label: t('aiRads.f.echogenicity'), type: 'select', options: [{ value: 'anechoic', label: t('aiRads.opt.anechoic') }, { value: 'hyper', label: t('aiRads.opt.hyper') }, { value: 'iso', label: t('aiRads.opt.iso') }, { value: 'hypo', label: t('aiRads.opt.hypo') }], defaultValue: 'hypo' },
    { name: 'shape', label: t('aiRads.f.shape'), type: 'select', options: [{ value: 'wider-than-tall', label: t('aiRads.opt.widerThanTall') }, { value: 'taller-than-wide', label: t('aiRads.opt.tallerThanWide') }], defaultValue: 'taller-than-wide' },
    { name: 'margins', label: t('aiRads.f.margins'), type: 'select', options: [{ value: 'smooth', label: t('aiRads.opt.smooth') }, { value: 'ill-defined', label: t('aiRads.opt.illDefined') }, { value: 'lobulated', label: t('aiRads.opt.lobulated') }, { value: 'irregular', label: t('aiRads.opt.irregular') }, { value: 'extrathyroidal', label: t('aiRads.opt.extrathyroidal') }], defaultValue: 'irregular' },
    { name: 'echogenicFoci', label: t('aiRads.f.echogenicFoci'), type: 'select', options: [{ value: 'none', label: t('aiRads.opt.absent') }, { value: 'comet', label: t('aiRads.opt.comet') }, { value: 'macrocalc', label: t('aiRads.opt.macrocalc') }, { value: 'rim', label: t('aiRads.opt.rimCalc') }, { value: 'punctate', label: t('aiRads.opt.punctate') }], defaultValue: 'punctate' },
  ],
}

const AiRadsPage: React.FC = () => {
  const [radsType, setRadsType] = useState<RadsType>('lung')
  const [patientId, setPatientId] = useState('P2024001')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<(RadsScore & { source?: 'api' | 'local' }) | null>(null)
  const [history, setHistory] = useState<RadsHistoryEntry[]>([])
  const [rules, setRules] = useState<RadsRules[]>([])
  const [rulesSource, setRulesSource] = useState<'api' | 'local'>('api')
  const [form] = Form.useForm()

  // [v3.0.6.11-99 G-20] 评分规则表 (后端 /rules, 失败回退本地 radsRules 词典)
  useEffect(() => {
    radsApi.getRules().then((res) => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setRules(res.data)
        setRulesSource('api')
      } else {
        setRules(localRadsRules())
        setRulesSource('local')
      }
    }).catch(() => {
      setRules(localRadsRules())
      setRulesSource('local')
    })
  }, [])

  const handleTypeChange = useCallback((key: string) => {
    const next = key as RadsType
    setRadsType(next)
    setResult(null)
    if (next !== 'breast') {
      form.setFieldsValue(Object.fromEntries(FIELDS[next].map((f) => [f.name, f.defaultValue])))
    }
  }, [form])

  const handleScore = useCallback(async () => {
    let dto: Record<string, unknown> = {}
    if (radsType !== 'breast') {
      const valid = await form.validateFields().catch(() => null)
      if (!valid) return
      dto = valid as Record<string, unknown>
    }
    setLoading(true)
    try {
      // [v3.0.6.11-99 G-20] 评分后端化: 统一 /score 确定性评分, 失败回退本地规则 + 标注
      const res = await radsApi.score({ type: radsType, findings: dto })
      if (res.success && res.data) {
        setResult({ ...res.data, source: 'api' })
      } else {
        const local = scoreRadsLocally(radsType as LocalRadsType, dto)
        setResult({ ...local, source: 'local' })
        message.warning(t('w9d.aiRads.backendFallback', { msg: res.error?.message ?? t('w9d.sidebar.unknownError') }))
      }
    } catch {
      const local = scoreRadsLocally(radsType as LocalRadsType, dto)
      setResult({ ...local, source: 'local' })
      message.warning(t('aiRads.localFallback'))
    } finally {
      setLoading(false)
    }
  }, [radsType, form])

  // [v3.0.6.11-99 G-20] 评分结果 → 报告段落 (复用 insertHtml 通道: report-insert-html 事件)
  const handleInsertToReport = useCallback(() => {
    if (!result) return
    const esc = (v: unknown): string =>
      String(v ?? '').replace(/[<>&"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch)
    const sourceTag = result.source === 'local' ? `(${t('aiRads.localTag')})` : `(${t('aiRads.backendTag')})`
    const findingsHtml = (result.findings ?? [])
      .map((f) => `<li>${esc(f)}</li>`)
      .join('')
    const html = [
      `<h3>${t('aiRads.insertTitleHtml')}</h3>`,
      `<p><strong>${esc(result.category)}</strong> ${esc(sourceTag)}</p>`,
      `<p>${t('w9d.aiRads.gradeLabel')}: <strong>${esc(result.score)}</strong> · ${esc(result.description)}</p>`,
      findingsHtml ? `<ul>${findingsHtml}</ul>` : '',
      `<p><strong>${t('w9d.aiRads.recommendLabel')}</strong>: ${esc(result.recommendations)}</p>`,
    ].join('\n')
    window.dispatchEvent(new CustomEvent('report-insert-html', { detail: { html } }))
    try { window.localStorage.setItem('ris_rads_pending_insert', html) } catch { /* 忽略 */ }
    message.success(t('aiRads.insertSuccess'))
  }, [result])

  const handleLoadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await radsApi.getHistory(patientId)
      if (res.success) {
        setHistory(res.data)
      } else {
        message.error(res.error?.message || t('aiRads.historyFail'))
      }
    } finally {
      setLoading(false)
    }
  }, [patientId])

  const renderFields = (tabKey: RadsType) => {
    if (tabKey === 'breast') {
      return (
        <div style={{ padding: 12, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8 }}>
          <Text>{t('aiRads.biradsHint')}</Text>
        </div>
      )
    }
    const fields = FIELDS[tabKey]
    return (
      <Space size="middle" wrap>
        {fields.map((f) => {
          if (f.type === 'number') {
            return (
              <Form.Item key={f.name} name={f.name} label={f.label} style={{ marginBottom: 8 }}>
                <InputNumber min={f.min} max={f.max} style={{ width: 140 }} />
              </Form.Item>
            )
          }
          return (
            <Form.Item key={f.name} name={f.name} label={f.label} style={{ marginBottom: 8 }}>
              <Select style={{ width: 150 }} options={f.options} />
            </Form.Item>
          )
        })}
      </Space>
    )
  }

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Cpu size={20} color="#2563eb" />
        <Title level={4} style={{ margin: 0 }}>{t('aiRads.title')}</Title>
        <Tag color="blue">Lung / BI / PI / LI / TI-RADS</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <div>
            <Text strong>{t('aiRads.patientId')}: </Text>
            <Select
              value={patientId}
              onChange={setPatientId}
              options={[
                { value: 'P2024001', label: 'P2024001' },
                { value: 'P2024002', label: 'P2024002' },
                { value: 'P2024003', label: 'P2024003' },
              ]}
              style={{ width: 140 }}
            />
          </div>
          <Divider orientation="vertical" />
          <Button type="primary" icon={<Sparkles size={14} />} onClick={() => handleScore()} loading={loading}>
            {t('aiRads.startScoring')}
          </Button>
          <Button icon={<History size={14} />} onClick={() => handleLoadHistory()} loading={loading}>
            {t('aiRads.loadHistory')}
          </Button>
          <Tooltip title={t('aiRads.insertTooltip')}>
            <Button icon={<FileText size={14} />} disabled={!result} onClick={() => handleInsertToReport()}>
              {t('aiRads.insertToReport')}
            </Button>
          </Tooltip>
          <Tag color={result?.source === 'local' ? 'orange' : 'green'}>
            {result ? (result.source === 'local' ? t('aiRads.localTag') : t('aiRads.backendTag')) : (rulesSource === 'api' ? t('aiRads.ruleSourceBackend') : t('aiRads.ruleSourceLocal'))}
          </Tag>
        </Space>

        <Tabs
          activeKey={radsType}
          onChange={handleTypeChange}
          items={radsTabs.map((tab) => ({
            key: tab.key,
            label: tab.label,
            children: (
              <Form
                form={form}
                layout="vertical"
                style={{ marginTop: 8 }}
                initialValues={
                  tab.key !== 'breast'
                    ? Object.fromEntries(FIELDS[tab.key].map((f) => [f.name, f.defaultValue]))
                    : {}
                }
              >
                {renderFields(tab.key)}
              </Form>
            ),
          }))}
        />
      </Card>

      <RadsScoring result={result} history={history} loading={loading} />

      {/* [v3.0.6.11-99 G-20] 评分规则表 (后端 /rules, criteria/level 映射) */}
      {(() => {
        const group = rules.find((r) => r.type === radsType)
        if (!group) return null
        return (
          <Card
            size="small"
            title={t('w9d.aiRads.rulesTableTitle', { group: group.name, source: rulesSource === 'api' ? t('w9d.aiRads.backendRules') : t('w9d.aiRads.builtinRules') })}
            style={{ marginTop: 16 }}
          >
            <Table<RadsRule>
              rowKey="level"
              size="small"
              dataSource={group.levels}
              pagination={false}
              columns={[
                { title: t('aiRads.col.level'), dataIndex: 'level', width: 80, render: (v) => <Tag color="blue">{v}</Tag> },
                { title: t('aiRads.col.description'), dataIndex: 'description', width: 130 },
                { title: t('aiRads.col.criteria'), dataIndex: 'criteria' },
                { title: t('aiRads.col.recommendations'), dataIndex: 'recommendations' },
              ]}
            />
          </Card>
        )
      })()}
    </div>
  )
}

export default AiRadsPage
