import React, { useState, useCallback, useEffect } from 'react'
import { Card, Space, Select, InputNumber, Button, Typography, Tag, Divider, message, Form, Tabs, Table, Tooltip } from 'antd'
import { Sparkles, Cpu, History, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  { key: 'lung', label: 'Lung-RADS (肺)' },
  { key: 'breast', label: 'BI-RADS (乳腺)' },
  { key: 'prostate', label: 'PI-RADS (前列腺)' },
  { key: 'liver', label: 'LI-RADS (肝脏)' },
  { key: 'thyroid', label: 'TI-RADS (甲状腺)' },
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
    { name: 'noduleSizeMm', label: '结节大小 (mm)', type: 'number', min: 1, max: 50, defaultValue: 8 },
    { name: 'spiculatedMargin', label: '毛刺状边缘', type: 'boolean', options: [{ value: true, label: '是' }, { value: false, label: '否' }], defaultValue: false },
    { name: 'solidComponent', label: '实性成分', type: 'boolean', options: [{ value: true, label: '是' }, { value: false, label: '否' }], defaultValue: true },
  ],
  prostate: [
    { name: 'lesionZone', label: '病灶分区', type: 'select', options: [{ value: 'PZ', label: '外周带 PZ' }, { value: 'TZ', label: '移行带 TZ' }, { value: 'AFS', label: '前纤维肌基质区 AFS' }], defaultValue: 'PZ' },
    { name: 'lesionSizeMm', label: '病灶大小 (mm)', type: 'number', min: 1, max: 50, defaultValue: 12 },
    { name: 'dwiSignal', label: 'DWI 信号', type: 'select', options: [{ value: 'low', label: '低信号' }, { value: 'mild', label: '轻度增高' }, { value: 'high', label: '明显增高' }], defaultValue: 'high' },
    { name: 't2Signal', label: 'T2WI 信号', type: 'select', options: [{ value: 'low', label: '低信号' }, { value: 'mild', label: '中等信号' }, { value: 'high', label: '高信号' }], defaultValue: 'low' },
    { name: 'adcValue', label: 'ADC 值 (μm²/s)', type: 'number', min: 0, max: 3000, defaultValue: 900 },
  ],
  liver: [
    { name: 'sizeMm', label: '病灶大小 (mm)', type: 'number', min: 1, max: 100, defaultValue: 22 },
    { name: 'arterialPhaseEnhancement', label: '动脉期强化', type: 'select', options: [
      { value: 'nonrim', label: '非环状强化' }, { value: 'rim', label: '环状强化' }, { value: 'none', label: '无强化' }, { value: 'nodule-in-nodule', label: '结节内结节' }, { value: 'corona', label: '冠状强化' }], defaultValue: 'nonrim' },
    { name: 'washout', label: '廓清', type: 'select', options: [{ value: 'yes', label: '有' }, { value: 'no', label: '无' }], defaultValue: 'yes' },
    { name: 'enhancingCapsule', label: '增强假包膜', type: 'select', options: [{ value: 'yes', label: '有' }, { value: 'no', label: '无' }], defaultValue: 'yes' },
    { name: 'thresholdGrowth', label: '阈值增长', type: 'select', options: [{ value: 'yes', label: '有' }, { value: 'no', label: '无' }], defaultValue: 'no' },
    { name: 'tumorInVein', label: '静脉内肿瘤', type: 'select', options: [{ value: 'yes', label: '有' }, { value: 'no', label: '无' }], defaultValue: 'no' },
  ],
  thyroid: [
    { name: 'composition', label: '成分', type: 'select', options: [{ value: 'cystic', label: '囊性' }, { value: 'spongiform', label: '海绵状' }, { value: 'mixed', label: '混合囊实性' }, { value: 'solid', label: '实性' }], defaultValue: 'solid' },
    { name: 'echogenicity', label: '回声', type: 'select', options: [{ value: 'anechoic', label: '无回声' }, { value: 'hyper', label: '高回声' }, { value: 'iso', label: '等回声' }, { value: 'hypo', label: '低回声' }], defaultValue: 'hypo' },
    { name: 'shape', label: '形态', type: 'select', options: [{ value: 'wider-than-tall', label: '横径大于纵径' }, { value: 'taller-than-wide', label: '纵径大于横径' }], defaultValue: 'taller-than-wide' },
    { name: 'margins', label: '边缘', type: 'select', options: [{ value: 'smooth', label: '光滑' }, { value: 'ill-defined', label: '边界不清' }, { value: 'lobulated', label: '分叶状' }, { value: 'irregular', label: '不规则' }, { value: 'extrathyroidal', label: '甲状腺外侵犯' }], defaultValue: 'irregular' },
    { name: 'echogenicFoci', label: '钙化灶', type: 'select', options: [{ value: 'none', label: '无' }, { value: 'comet', label: '彗星尾' }, { value: 'macrocalc', label: '粗大钙化' }, { value: 'rim', label: '周边钙化' }, { value: 'punctate', label: '点状微小钙化' }], defaultValue: 'punctate' },
  ],
}

const AiRadsPage: React.FC = () => {
  const { t } = useTranslation('rads')
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
        message.warning(`后端评分不可用, 已按本地规则回退: ${res.error?.message ?? '未知错误'}`)
      }
    } catch {
      const local = scoreRadsLocally(radsType as LocalRadsType, dto)
      setResult({ ...local, source: 'local' })
      message.warning('后端评分不可用, 已按本地规则回退')
    } finally {
      setLoading(false)
    }
  }, [radsType, form])

  // [v3.0.6.11-99 G-20] 评分结果 → 报告段落 (复用 insertHtml 通道: report-insert-html 事件)
  const handleInsertToReport = useCallback(() => {
    if (!result) return
    const esc = (v: unknown): string =>
      String(v ?? '').replace(/[<>&"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch)
    const sourceTag = result.source === 'local' ? '(本地规则回退)' : '(后端规则)'
    const findingsHtml = (result.findings ?? [])
      .map((f) => `<li>${esc(f)}</li>`)
      .join('')
    const html = [
      '<h3>AI 影像辅助分级</h3>',
      `<p><strong>${esc(result.category)}</strong> ${esc(sourceTag)}</p>`,
      `<p>分级: <strong>${esc(result.score)}</strong> · ${esc(result.description)}</p>`,
      findingsHtml ? `<ul>${findingsHtml}</ul>` : '',
      `<p><strong>建议</strong>: ${esc(result.recommendations)}</p>`,
    ].join('\n')
    window.dispatchEvent(new CustomEvent('report-insert-html', { detail: { html } }))
    try { window.localStorage.setItem('ris_rads_pending_insert', html) } catch { /* 忽略 */ }
    message.success('RADS 评分段落已发送至报告编辑器')
  }, [result])

  const handleLoadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await radsApi.getHistory(patientId)
      if (res.success) {
        setHistory(res.data)
      } else {
        message.error(res.error?.message || '历史记录加载失败')
      }
    } finally {
      setLoading(false)
    }
  }, [patientId])

  const renderFields = (tabKey: RadsType) => {
    if (tabKey === 'breast') {
      return (
        <div style={{ padding: 12, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8 }}>
          <Text>BI-RADS 乳腺分级: 选择特征后提交, 系统按特征自动分级 (支持直接指定 biradsCategory)</Text>
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
        <Title level={4} style={{ margin: 0 }}>AI 阅片助手 V3 — 多 RADS 自动评分</Title>
        <Tag color="blue">Lung / BI / PI / LI / TI-RADS</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <div>
            <Text strong>{t('patientId')}: </Text>
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
            {t('startScoring')}
          </Button>
          <Button icon={<History size={14} />} onClick={() => handleLoadHistory()} loading={loading}>
            {t('loadHistory')}
          </Button>
          <Tooltip title="评分结果生成报告段落, 经 insertHtml 通道插入书写页编辑器">
            <Button icon={<FileText size={14} />} disabled={!result} onClick={() => handleInsertToReport()}>
              插入报告
            </Button>
          </Tooltip>
          <Tag color={result?.source === 'local' ? 'orange' : 'green'}>
            {result ? (result.source === 'local' ? '本地规则回退' : '后端规则') : (rulesSource === 'api' ? '规则来源: 后端' : '规则来源: 本地')}
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
            title={`${group.name} 评分规则表 (${rulesSource === 'api' ? '后端规则' : '内置规则'})`}
            style={{ marginTop: 16 }}
          >
            <Table<RadsRule>
              rowKey="level"
              size="small"
              dataSource={group.levels}
              pagination={false}
              columns={[
                { title: '级别', dataIndex: 'level', width: 80, render: (v) => <Tag color="blue">{v}</Tag> },
                { title: '描述', dataIndex: 'description', width: 130 },
                { title: '判定标准 (criteria)', dataIndex: 'criteria' },
                { title: '建议', dataIndex: 'recommendations' },
              ]}
            />
          </Card>
        )
      })()}
    </div>
  )
}

export default AiRadsPage
