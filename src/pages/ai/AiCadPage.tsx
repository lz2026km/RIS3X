// [v3.0.6.11-54] Phase 2: AI CAD 聚合页 (肺结节/乳腺/骨折/心脏 + 统计卡片)
// [v3.0.6.11-75] W1-2: 接入真实 cadApi (POST /ai/cad/detect, GET /ai/cad/result/:instanceId)
// [v3.0.6.11-80] W2-A: 准确率分析 Tab (POST /ai-diagnosis/accuracy 各模型 + GET /ai-diagnosis/trend 30 天趋势)
import LungCadPage from './LungCadPage'
import BreastCadPage from './BreastCadPage'
import FractureCadPage from './FractureCadPage'
import CardiacAiPage from './CardiacAiPage'
import { aiDiagnosisApi, type AiDiagnosisAccuracyResult, type AiDiagnosisTrendPoint } from '../../services/api/aiDiagnosisApi'
import { cadApi } from '../../services/api/cadApi'
import { CadResult } from '../../services/api/cadApi'
import {
  Card, Space, Tag, Row, Col, Statistic, Tabs, Spin, Alert, Button, Progress,
  Input, Table, Empty,
} from 'antd'
import {
  Cpu,
  RefreshCw,
  Activity,
  Target,
  CheckCircle2,
  TrendingUp,
  ScanSearch,
  Crosshair,
  BarChart3,
  Gauge,
} from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const SAMPLE_INSTANCES = ['inst-2000', 'inst-2001', 'inst-2002', 'inst-2003']

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
  { key: 'lungCad', title: '肺结节检测', color: '#2563eb' },
  { key: 'breastCad', title: '乳腺 CAD', color: '#eb2f96' },
  { key: 'fractureCad', title: '骨折检测', color: '#faad14' },
  { key: 'cardiacAi', title: '心脏 AI', color: '#722ed1' },
]

// [W2-A] 各模型准确率查询: 复用 POST /ai-diagnosis/accuracy, 按 modality 过滤
const MODEL_ACCURACY_QUERY: { key: string; title: string; modality: string; color: string }[] = [
  { key: 'lung', title: '肺结节', modality: 'CT', color: '#2563eb' },
  { key: 'breast', title: '乳腺', modality: 'MG', color: '#eb2f96' },
  { key: 'fracture', title: '骨折', modality: 'DR', color: '#faad14' },
  { key: 'cardiac', title: '心脏', modality: 'MR', color: '#722ed1' },
]

// [W2-A] 准确率分析: getAccuracy (总/各模型) + getTrend (30 天趋势)
const AccuracyPanel: React.FC = () => {
  const [overall, setOverall] = useState<AiDiagnosisAccuracyResult | null>(null)
  const [byModel, setByModel] = useState<Record<string, AiDiagnosisAccuracyResult>>({})
  const [trend, setTrend] = useState<AiDiagnosisTrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [overallRes, trendRes, ...modelRes] = await Promise.all([
        aiDiagnosisApi.getAccuracy(),
        aiDiagnosisApi.getTrend(),
        ...MODEL_ACCURACY_QUERY.map((m) => aiDiagnosisApi.getAccuracy({ modality: m.modality })),
      ])
      const failed: string[] = []
      if (overallRes.success && overallRes.data) setOverall(overallRes.data)
      else failed.push(overallRes.error?.message ?? '总体准确率加载失败')
      if (trendRes.success && Array.isArray(trendRes.data)) setTrend(trendRes.data)
      else failed.push(trendRes.error?.message ?? '趋势加载失败')
      const next: Record<string, AiDiagnosisAccuracyResult> = {}
      modelRes.forEach((res, i) => {
        const m = MODEL_ACCURACY_QUERY[i]
        if (!m) return
        if (res.success && res.data) next[m.key] = res.data
        else failed.push(`${m.title}: ${res.error?.message ?? '加载失败'}`)
      })
      setByModel(next)
      const firstError = failed.find(Boolean)
      if (firstError) setError(firstError)
    } catch (e) {
      setError((e as Error)?.message ?? '准确率加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const fmt = (v: number | undefined | null) => (v === undefined || v === null ? '-' : `${v.toFixed(1)}%`)
  const totalCases = overall?.totalCases ?? 0

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12 }}>
        <Gauge size={16} color="#2563eb" />
        <span style={{ fontWeight: 600 }}>准确率分析 (POST /ai-diagnosis/accuracy + GET /ai-diagnosis/trend)</span>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>
          刷新
        </Button>
      </Space>

      {error && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} message={error}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> 重试</Button>} />
      )}

      <Spin spinning={loading && !overall && trend.length === 0}>
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={<Space><Target size={12} color="#2563eb" />总体准确率</Space>}
                value={overall?.accuracy ?? '-'} suffix="%" precision={overall ? 1 : 0}
                styles={{ content: { color: '#2563eb' } }}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                样本 {totalCases ? `${totalCases} 例` : '-'} · AI 阳性 {overall?.aiPositive ?? '-'}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title="灵敏度 / 特异度">
              <Space size={16}>
                <Statistic value={overall?.sensitivity ?? '-'} suffix="%" />
                <Statistic value={overall?.specificity ?? '-'} suffix="%" />
              </Space>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title="阳性预测值 PPV">
              <Statistic value={overall?.ppv ?? '-'} suffix="%" />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title="阴性预测值 NPV">
              <Statistic value={overall?.npv ?? '-'} suffix="%" />
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 12 }}>
          {MODEL_ACCURACY_QUERY.map((m) => {
            const acc = byModel[m.key]
            return (
              <Col span={6} key={m.key}>
                <Card size="small" loading={loading && !acc}>
                  <Statistic
                    title={<Space><Activity size={12} color={m.color} />{m.title} ({m.modality})</Space>}
                    value={acc ? acc.accuracy : '-'} suffix="%" precision={acc ? 1 : 0}
                    styles={{ content: { color: m.color } }}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                    灵敏度 {acc ? fmt(acc.sensitivity) : '-'} · 特异度 {acc ? fmt(acc.specificity) : '-'}
                    <div>样本 {acc?.totalCases ?? '-'} 例</div>
                  </div>
                </Card>
              </Col>
            )
          })}
        </Row>

        <Card size="small" title="准确率 30 天趋势 (GET /ai-diagnosis/trend)">
          {trend.length === 0 && !loading ? (
            <Empty description="暂无趋势数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[50, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number | string) => [`${v}%`]} />
                <Legend iconSize={10} />
                <Line type="monotone" dataKey="accuracy" name="准确率" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="sensitivity" name="灵敏度" stroke="#52c41a" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="specificity" name="特异度" stroke="#faad14" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </Spin>
    </div>
  )
}

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
        <Cpu size={20} color="#2563eb" />
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
          action={<Button size="small" onClick={() => void loadStats()}><RefreshCw size={14} /> 重试</Button>}
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
            <Progress percent={stats?.accuracy?.overall ?? 0} strokeColor="#2563eb" />
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
            { key: 'detect', label: '实时检测', children: <CadDetectPanel /> },
            { key: 'lung', label: '肺结节检测', children: <LungCadPage /> },
            { key: 'breast', label: '乳腺 CAD', children: <BreastCadPage /> },
            { key: 'fracture', label: '骨折检测', children: <FractureCadPage /> },
            { key: 'cardiac', label: '心脏 AI', children: <CardiacAiPage /> },
            { key: 'accuracy', label: <Space><BarChart3 size={14} />准确率分析</Space>, children: <AccuracyPanel /> },
          ]}
        />
      </Card>
    </div>
  )
}

// [v3.0.6.11-75] 真实 CAD 检测: 选 DICOM 实例 -> cadApi.detect -> 病灶坐标/置信度
const CadDetectPanel: React.FC = () => {
  const [instanceId, setInstanceId] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState('')
  const [current, setCurrent] = useState<CadResult | null>(null)
  const [history, setHistory] = useState<CadResult[]>([])
  const [detail, setDetail] = useState<CadResult | null>(null)

  const runDetect = useCallback(async (id: string) => {
    const target = id.trim()
    if (!target) {
      setError('请先选择或输入 DICOM 实例 ID')
      return
    }
    setDetecting(true)
    setError('')
    try {
      const res = await cadApi.detect(target)
      if (!res.success) {
        setError(res.error?.message ?? '检测失败')
        return
      }
      setCurrent(res.data)
      setHistory((prev) => {
        const next = [res.data, ...prev.filter((h) => h.instanceId !== res.data.instanceId)]
        return next.slice(0, 10)
      })
    } catch (e) {
      setError((e as Error)?.message ?? '检测失败')
    } finally {
      setDetecting(false)
    }
  }, [])

  const viewDetail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    setError('')
    try {
      const res = await cadApi.getResult(id)
      if (!res.success) {
        setError(res.error?.message ?? '结果查询失败')
        return
      }
      setDetail(res.data)
    } catch (e) {
      setError((e as Error)?.message ?? '结果查询失败')
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const findingColumns = [
    { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag color={v === 'nodule' ? 'blue' : 'orange'}>{v === 'nodule' ? '结节' : '钙化'}</Tag> },
    { title: '坐标 (x, y)', key: 'pos', render: (_: unknown, f: { x: number; y: number }) => `(${f.x}, ${f.y})` },
    { title: '宽 x 高', key: 'wh', render: (_: unknown, f: { width: number; height: number }) => `${f.width} x ${f.height}` },
    { title: '直径 (mm)', dataIndex: 'size', key: 'size' },
    { title: '置信度', dataIndex: 'confidence', key: 'confidence', render: (v: number) => <span style={{ color: v >= 0.85 ? '#52c41a' : v >= 0.7 ? '#faad14' : '#ff4d4f', fontWeight: 600 }}>{(v * 100).toFixed(1)}%</span> },
  ]

  return (
    <div style={{ padding: 16 }}>
      <Card size="small" title={<Space><ScanSearch size={16} color="#2563eb" />CAD 实时检测</Space>}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            placeholder="输入 DICOM 实例 ID (SOP 实例 UID)"
            value={instanceId}
            onChange={(e) => setInstanceId(e.target.value)}
            onPressEnter={() => void runDetect(instanceId)}
            style={{ width: 360 }}
            allowClear
          />
          <Button type="primary" icon={<Crosshair size={14} />} loading={detecting} onClick={() => void runDetect(instanceId)}>
            开始检测
          </Button>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>示例:</span>
          {SAMPLE_INSTANCES.map((s) => (
            <Button key={s} size="small" onClick={() => { setInstanceId(s); void runDetect(s) }}>{s}</Button>
          ))}
        </Space>
        {error && (
          <Alert type="error" showIcon style={{ marginBottom: 12 }} message={error} action={<Button size="small" onClick={() => setError('')}>关闭</Button>} />
        )}

        {current && (
          <Card size="small" type="inner" title={`检测结果 - ${current.instanceId}`} style={{ marginBottom: 16 }}
            extra={<Space>{current.simulated && <Tag color="gold">模拟回退</Tag>}<Tag color="green">{current.findings.length} 个病灶</Tag></Space>}>
            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col span={8}><Statistic title="检出病灶" value={current.findings.length} suffix="个" /></Col>
              <Col span={8}><Statistic title="最高置信度" value={current.findings.length ? Math.max(...current.findings.map(f => f.confidence)) * 100 : 0} precision={1} suffix="%" /></Col>
              <Col span={8}><Statistic title="检测时间" value={current.detectedAt.slice(0, 19).replace('T', ' ')} /></Col>
            </Row>
            <Table scroll={{ x: 'max-content' }} rowKey={(f) => `${f.x}-${f.y}`} size="small" dataSource={current.findings} columns={findingColumns} pagination={false}/>
            {current.heatmapUrl && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                热力图: <code>{current.heatmapUrl}</code>
              </div>
            )}
          </Card>
        )}

        <h4 style={{ margin: '8px 0 12px', fontSize: 14, fontWeight: 600 }}>本会话检测记录</h4>
        {history.length === 0 && !detecting ? (
          <Empty description="尚未执行检测" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table scroll={{ x: 'max-content' }}
            rowKey="instanceId"
            size="small"
            loading={detecting && history.length === 0}
            dataSource={history}
            pagination={false}
            columns={[
              { title: '实例 ID', dataIndex: 'instanceId', key: 'instanceId' },
              { title: '病灶数', dataIndex: 'findings', key: 'findingsCount', render: (f: CadResult['findings']) => f.length },
              { title: '检测时间', dataIndex: 'detectedAt', key: 'detectedAt', render: (v: string) => v.slice(0, 19).replace('T', ' ') },
              {
                title: '操作',
                key: 'action',
                render: (_: unknown, r: CadResult) => (
                  <Button size="small" type="link" loading={loadingDetail} onClick={() => void viewDetail(r.instanceId)}>查看详情</Button>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Card size="small" title="详情 (GET /ai/cad/result/:instanceId)" style={{ marginTop: 16 }}>
        <Spin spinning={loadingDetail}>
          {detail ? (
            <>
              <Space style={{ marginBottom: 12 }}>
                <Tag color="blue">{detail.instanceId}</Tag>
                <span style={{ fontSize: 12, color: '#64748b' }}>检测于 {detail.detectedAt.slice(0, 19).replace('T', ' ')}</span>
                {detail.simulated && <Tag color="gold">模拟回退</Tag>}
              </Space>
              <Table scroll={{ x: 'max-content' }} rowKey={(f) => `${f.x}-${f.y}`} size="small" dataSource={detail.findings} columns={findingColumns} pagination={false}/>
            </>
          ) : (
            <Empty description="点击上方记录的“查看详情”加载真实结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Spin>
      </Card>
    </div>
  )
}

export default AiCadPage
