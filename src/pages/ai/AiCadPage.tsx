// [v3.0.6.11-54] Phase 2: AI CAD 聚合页 (肺结节/乳腺/骨折/心脏 + 统计卡片)
import React, { useCallback, useEffect, useState } from 'react'
import {
  Card, Space, Tag, Row, Col, Statistic, Tabs, Spin, Alert, Button, Progress,
} from 'antd'
import { Cpu, RefreshCw, Activity, Target, CheckCircle2, TrendingUp } from 'lucide-react'
import LungCadPage from './LungCadPage'
import BreastCadPage from './BreastCadPage'
import FractureCadPage from './FractureCadPage'
import CardiacAiPage from './CardiacAiPage'
import { aiDiagnosisApi } from '../../services/api/aiDiagnosisApi'

interface CadModuleStats {
  total: number
  highRisk: number
  statuses: { status: string; count: number }[]
}

interface AiDiagnosisAggregated {
  lungCad: CadModuleStats
  breastCad: CadModuleStats
  fractureCad: CadModuleStats
  cardiacAi: CadModuleStats
  accuracy: { overall: number; sensitivity: number; specificity: number }
}

const MODULE_META: { key: keyof AiDiagnosisAggregated; title: string; color: string }[] = [
  { key: 'lungCad', title: '肺结节检测', color: '#1677ff' },
  { key: 'breastCad', title: '乳腺 CAD', color: '#eb2f96' },
  { key: 'fractureCad', title: '骨折检测', color: '#faad14' },
  { key: 'cardiacAi', title: '心脏 AI', color: '#722ed1' },
]

const AiCadPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('lung')
  const [stats, setStats] = useState<AiDiagnosisAggregated | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await aiDiagnosisApi.getStats()
      if (res.success) setStats(res.data as unknown as AiDiagnosisAggregated)
      else setError(res.error?.message ?? '统计加载失败')
    } catch (e) {
      setError((e as Error)?.message ?? '统计加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Cpu size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>AI 辅助诊断中心</span>
        <Tag color="cyan">CAD 聚合</Tag>
        <Button
          size="small"
          icon={<RefreshCw size={12} />}
          onClick={() => void loadStats()}
          loading={loading}
        >
          刷新统计
        </Button>
      </Space>

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={error}
          action={<Button size="small" onClick={() => void loadStats()}>重试</Button>}
        />
      )}

      <Spin spinning={loading && !stats}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          {MODULE_META.map((m) => {
            const s = (stats?.[m.key] ?? undefined) as CadModuleStats | undefined
            const confirmed = s?.statuses?.find((x: { status: string; count: number }) => x.status === 'confirmed')?.count ?? 0
            return (
              <Col span={6} key={m.key}>
                <Card size="small">
                  <Statistic
                    title={<Space><Activity size={12} color={m.color} />{m.title}</Space>}
                    value={s?.total ?? '-'}
                    suffix="例"
                    styles={{ content: { color: m.color } }}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                    <Space size={8}>
                      <span><CheckCircle2 size={10} color="#52c41a" /> 已确认 {confirmed}</span>
                      <span><Target size={10} color="#ff4d4f" /> 高风险 {s?.highRisk ?? 0}</span>
                    </Space>
                  </div>
                </Card>
              </Col>
            )
          })}
        </Row>
      </Spin>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small" title="总体准确率">
            <Progress percent={stats?.accuracy?.overall ?? 0} strokeColor="#1677ff" />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="灵敏度 / 特异度">
            <Space size={16}>
              <Statistic value={stats?.accuracy?.sensitivity ?? 0} suffix="%" prefix={<TrendingUp size={12} color="#52c41a" />} />
              <Statistic value={stats?.accuracy?.specificity ?? 0} suffix="%" />
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="模型状态">
            <Space wrap>
              <Tag color="green">肺结节 v3.2.1 活跃</Tag>
              <Tag color="green">乳腺 v2.8.0 活跃</Tag>
              <Tag color="green">骨折 v1.9.4 活跃</Tag>
              <Tag color="green">心脏 v2.4.1 活跃</Tag>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card size="small">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="card"
          items={[
            { key: 'lung', label: '肺结节检测', children: <LungCadPage /> },
            { key: 'breast', label: '乳腺 CAD', children: <BreastCadPage /> },
            { key: 'fracture', label: '骨折检测', children: <FractureCadPage /> },
            { key: 'cardiac', label: '心脏 AI', children: <CardiacAiPage /> },
          ]}
        />
      </Card>
    </div>
  )
}

export default AiCadPage
