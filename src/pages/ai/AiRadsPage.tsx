import React, { useState, useCallback } from 'react'
import { Card, Space, Select, InputNumber, Switch, Button, Typography, Tag, Divider, message } from 'antd'
import { Sparkles, Cpu, History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import RadsScoring from '../../components/ai/RadsScoring'
import { radsApi } from '../../services/api/radsApi'
import type { RadsScore, RadsHistoryEntry } from '../../services/api/radsApi'

const { Text, Title } = Typography

type RadsType = 'lung' | 'breast' | 'prostate'

const radsOptions: { value: RadsType; label: string }[] = [
  { value: 'lung', label: 'Lung-RADS' },
  { value: 'breast', label: 'BI-RADS' },
  { value: 'prostate', label: 'PI-RADS' },
]

const AiRadsPage: React.FC = () => {
  const { t } = useTranslation('rads')
  const [radsType, setRadsType] = useState<RadsType>('lung')
  const [patientId, setPatientId] = useState('P2024001')
  const [noduleSize, setNoduleSize] = useState(8)
  const [spiculated, setSpiculated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RadsScore | null>(null)
  const [history, setHistory] = useState<RadsHistoryEntry[]>([])

  const handleScore = useCallback(async () => {
    setLoading(true)
    try {
      let res
      if (radsType === 'lung') {
        res = await radsApi.scoreLung({ noduleSizeMm: noduleSize, spiculatedMargin: spiculated })
      } else if (radsType === 'breast') {
        res = await radsApi.scoreBreast({ biradsCategory: undefined })
      } else {
        res = await radsApi.scoreProstate({})
      }
      if (res.success) {
        setResult(res.data)
      } else {
        message.error(res.error?.message || 'Scoring failed')
      }
    } finally {
      setLoading(false)
    }
  }, [radsType, noduleSize, spiculated])

  const handleLoadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await radsApi.getHistory(patientId)
      if (res.success) {
        setHistory(res.data)
      } else {
        message.error(res.error?.message || 'Failed to load history')
      }
    } finally {
      setLoading(false)
    }
  }, [patientId])

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Cpu size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>AI 阅片助手 V3 — RADS 自动评分</span>
        <Tag color="blue">Lung-RADS / BI-RADS / PI-RADS</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <div>
            <Text strong>{t('scoreType')}: </Text>
            <Select
              value={radsType}
              onChange={setRadsType}
              options={radsOptions}
              style={{ width: 160 }}
            />
          </div>
          <Divider orientation="vertical" />
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
          {radsType === 'lung' && (
            <>
              <Divider orientation="vertical" />
              <div>
                <Text strong>{t('noduleSize')} (mm): </Text>
                <InputNumber min={1} max={50} value={noduleSize} onChange={(v) => setNoduleSize(v ?? 8)} style={{ width: 80 }} />
              </div>
              <div>
                <Text strong>{t('spiculatedMargin')}: </Text>
                <Switch checked={spiculated} onChange={setSpiculated} />
              </div>
            </>
          )}
        </Space>
      </Card>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<Sparkles size={14} />} onClick={handleScore} loading={loading}>
          {t('startScoring')}
        </Button>
        <Button icon={<History size={14} />} onClick={handleLoadHistory} loading={loading}>
          {t('loadHistory')}
        </Button>
      </Space>

      <RadsScoring result={result} history={history} loading={loading} />
    </div>
  )
}

export default AiRadsPage
