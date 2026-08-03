import React, { useState, useCallback } from 'react'
import { Card, Space, Select, InputNumber, Button, Typography, Tag, Divider, message, Form, Tabs } from 'antd'
import { Sparkles, Cpu, History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import RadsScoring from '../../components/ai/RadsScoring'
import { radsApi } from '../../services/api/radsApi'
import type { RadsScore, RadsHistoryEntry } from '../../services/api/radsApi'

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
  const [result, setResult] = useState<RadsScore | null>(null)
  const [history, setHistory] = useState<RadsHistoryEntry[]>([])
  const [form] = Form.useForm()

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
      let res
      if (radsType === 'lung') res = await radsApi.scoreLung(dto)
      else if (radsType === 'breast') res = await radsApi.scoreBreast({ biradsCategory: undefined })
      else if (radsType === 'prostate') res = await radsApi.scorePiRads(dto)
      else if (radsType === 'liver') res = await radsApi.scoreLiRads(dto)
      else res = await radsApi.scoreTiRads(dto)
      if (res.success) {
        setResult(res.data)
      } else {
        message.error(res.error?.message || 'Scoring failed')
      }
    } finally {
      setLoading(false)
    }
  }, [radsType, form])

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
        <Cpu size={20} color="#1677ff" />
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
    </div>
  )
}

export default AiRadsPage
