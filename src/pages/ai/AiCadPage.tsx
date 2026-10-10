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
import { EmptyState } from '../../components/common/EmptyState'
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common"
import AiCaseLibrarySection from './AiCaseLibrarySection'
import {
  Space,
  Tag,
  Row,
  Col,
  Statistic,
  Tabs,
  Spin,
  Alert,
  Button,
  Progress,
  Card,
  Input,
} from "antd";
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
  BookOpen,
} from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { ChartContainer, chartDefaults } from '../../components/charts'
import { t } from '../../i18n/appI18n'

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
  { key: 'lungCad', title: 'aiCad.lungNoduleDetect', color: 'var(--color-primary-600)' },
  { key: 'breastCad', title: 'aiCad.breastCad', color: '#eb2f96' },
  { key: 'fractureCad', title: 'aiCad.fractureDetect', color: '#faad14' },
  { key: 'cardiacAi', title: 'aiCad.cardiacAi', color: '#722ed1' },
]

// [W2-A] 各模型准确率查询: 复用 POST /ai-diagnosis/accuracy, 按 modality 过滤
const MODEL_ACCURACY_QUERY: { key: string; title: string; modality: string; color: string }[] = [
  { key: 'lung', title: 'aiCad.lungNodule', modality: 'CT', color: 'var(--color-primary-600)' },
  { key: 'breast', title: 'aiCad.breast', modality: 'MG', color: '#eb2f96' },
  { key: 'fracture', title: 'aiCad.fracture', modality: 'DR', color: '#faad14' },
  { key: 'cardiac', title: 'aiCad.cardiac', modality: 'MR', color: '#722ed1' },
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
      else failed.push(overallRes.error?.message ?? t('aiCad.overallLoadFailed'))
      if (trendRes.success && Array.isArray(trendRes.data)) setTrend(trendRes.data)
      else failed.push(trendRes.error?.message ?? t('aiCad.trendLoadFailed'))
      const next: Record<string, AiDiagnosisAccuracyResult> = {}
      modelRes.forEach((res, i) => {
        const m = MODEL_ACCURACY_QUERY[i]
        if (!m) return
        if (res.success && res.data) next[m.key] = res.data
        else failed.push(`${t(m.title)}: ${res.error?.message ?? t('aiCad.loadFailed')}`)
      })
      setByModel(next)
      const firstError = failed.find(Boolean)
      if (firstError) setError(firstError)
    } catch (e) {
      setError((e as Error)?.message ?? t('aiCad.accuracyLoadFailed'))
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
    <div style={{ padding: 'var(--space-4, 16px)' }}>
      <Space style={{ marginBottom: 'var(--space-3, 12px)' }}>
        <Gauge size={16} color="var(--color-primary-600)" />
        <span style={{ fontWeight: 600 }}>{t('aiCad.accuracyTitle')}</span>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>
          {t('aiCad.refresh')}
        </Button>
      </Space>

      {error && (
        <Alert type="error" showIcon style={{ marginBottom: 'var(--space-3, 12px)' }} message={error}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('aiCad.retry')}</Button>} />
      )}

      <Spin spinning={loading && !overall && trend.length === 0}>
        <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-3, 12px)' }}>
          <StatCard
            title={t('aiCad.overallAccuracy')}
            value={overall?.accuracy ?? '-'}
            suffix="%"
            precision={overall ? 1 : 0}
            color="primary"
            icon={<Target size={18} />}
            sub={`${t('aiCad.sample')} ${totalCases ? `${totalCases} ${t('aiCad.cases')}` : '-'} · ${t('aiCad.aiPositive')} ${overall?.aiPositive ?? '-'}`}
          />
          <StatCard title={t('aiCad.sensitivity')} value={overall?.sensitivity ?? '-'} suffix="%" />
          <StatCard title={t('aiCad.specificity')} value={overall?.specificity ?? '-'} suffix="%" />
          <StatCard title={t('aiCad.ppv')} value={overall?.ppv ?? '-'} suffix="%" />
          <StatCard title={t('aiCad.npv')} value={overall?.npv ?? '-'} suffix="%" />
        </StatCardGrid>

        <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-3, 12px)' }}>
          {MODEL_ACCURACY_QUERY.map((m) => {
            const acc = byModel[m.key]
            return (
              <StatCard
                key={m.key}
                title={`${t(m.title)} (${m.modality})`}
                value={acc ? acc.accuracy : '-'}
                suffix="%"
                precision={acc ? 1 : 0}
                color={m.color}
                icon={<Activity size={18} />}
                loading={loading && !acc}
                sub={<>
                  {t('aiCad.sensitivity')} {acc ? fmt(acc.sensitivity) : '-'} · {t('aiCad.specificity')} {acc ? fmt(acc.specificity) : '-'}
                  <div>{t('aiCad.sample')} {acc?.totalCases ?? '-'} {t('aiCad.cases')}</div>
                </>}
              />
            )
          })}
        </StatCardGrid>

        <Card type="inner" size="small" title={t('aiCad.trendTitle')}>
          {trend.length === 0 && !loading ? (
            <EmptyState description={t('aiCad.noTrend')} />
          ) : (
            <ChartContainer type="line" height={280}>
              <LineChart data={trend} margin={chartDefaults.margin}>
                <CartesianGrid {...chartDefaults.grid} />
                <XAxis dataKey="date" {...chartDefaults.axis} />
                <YAxis domain={[50, 100]} {...chartDefaults.axis} />
                <Tooltip {...chartDefaults.tooltip} formatter={(v: number | string) => [`${v}%`]} />
                <Legend iconSize={10} />
                <Line type="monotone" dataKey="accuracy" name={t('aiCad.accuracy')} stroke="var(--color-primary-600)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="sensitivity" name={t('aiCad.sensitivity')} stroke="#52c41a" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="specificity" name={t('aiCad.specificity')} stroke="#faad14" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ChartContainer>
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
      else setError(res.error?.message ?? t('aiCad.statsLoadFailed'))
    } catch (e) {
      setError((e as Error)?.message ?? t('aiCad.statsLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Cpu size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('aiCad.title')}</span>
        <Tag color="cyan">{t('aiCad.cadAggregation')}</Tag>
        <Button
          size="small"
          icon={<RefreshCw size={12} />}
          onClick={() => void loadStats()}
          loading={loading}
        >
          {t('aiCad.refreshStats')}
        </Button>
      </Space>

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 'var(--space-4, 16px)' }}
          message={error}
          action={<Button size="small" onClick={() => void loadStats()}><RefreshCw size={14} /> {t('aiCad.retry')}</Button>}
        />
      )}

      <Spin spinning={loading && !stats}>
        <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
          {MODULE_META.map((m) => {
            const s = (stats?.[m.key] ?? undefined) as CadModuleStats | undefined
            const confirmed = s?.statuses?.find((x: { status: string; count: number }) => x.status === 'confirmed')?.count ?? 0
            return (
              <StatCard
                key={m.key}
                title={t(m.title)}
                value={s?.total ?? '-'}
                suffix={t('aiCad.cases')}
                color={m.color}
                icon={<Activity size={18} />}
                sub={<Space size={8}>
                  <span><CheckCircle2 size={10} color="#52c41a" /> {t('aiCad.confirmed')} {confirmed}</span>
                  <span><Target size={10} color="#ff4d4f" /> {t('aiCad.highRisk')} {s?.highRisk ?? 0}</span>
                </Space>}
              />
            )
          })}
        </StatCardGrid>
      </Spin>

      <Row gutter={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Col span={8}>
          <Card size="small" title={t('aiCad.overallAccuracy')}>
            <Progress percent={stats?.accuracy?.overall ?? 0} strokeColor="var(--color-primary-600)" />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={t('aiCad.sensitivitySpecificity')}>
            <Space size={16}>
              <Statistic value={stats?.accuracy?.sensitivity ?? 0} suffix="%" prefix={<TrendingUp size={12} color="#52c41a" />} />
              <Statistic value={stats?.accuracy?.specificity ?? 0} suffix="%" />
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={t('aiCad.modelStatus')}>
            <Space wrap>
              <Tag color="green">{t('aiCad.lungNodule')} v3.2.1 {t('aiCad.active')}</Tag>
              <Tag color="green">{t('aiCad.breast')} v2.8.0 {t('aiCad.active')}</Tag>
              <Tag color="green">{t('aiCad.fracture')} v1.9.4 {t('aiCad.active')}</Tag>
              <Tag color="green">{t('aiCad.cardiac')} v2.4.1 {t('aiCad.active')}</Tag>
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
            { key: 'detect', label: t('aiCad.tabDetect'), children: <CadDetectPanel /> },
            { key: 'lung', label: t('aiCad.lungNoduleDetect'), children: <LungCadPage /> },
            { key: 'breast', label: t('aiCad.breastCad'), children: <BreastCadPage /> },
            { key: 'fracture', label: t('aiCad.fractureDetect'), children: <FractureCadPage /> },
            { key: 'cardiac', label: t('aiCad.cardiacAi'), children: <CardiacAiPage /> },
            { key: 'accuracy', label: <Space><BarChart3 size={14} />{t('aiCad.accuracyTitle')}</Space>, children: <AccuracyPanel /> },
            { key: 'cases', label: <Space><BookOpen size={14} />{t('aiCad.caseLibrary')}</Space>, children: <AiCaseLibrarySection /> },
          ]}
        />
      </Card>
    </PageContainer>
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
      setError(t('aiCad.selectInstance'))
      return
    }
    setDetecting(true)
    setError('')
    try {
      const res = await cadApi.detect(target)
      if (!res.success) {
        setError(res.error?.message ?? t('aiCad.detectFailed'))
        return
      }
      setCurrent(res.data)
      setHistory((prev) => {
        const next = [res.data, ...prev.filter((h) => h.instanceId !== res.data.instanceId)]
        return next.slice(0, 10)
      })
    } catch (e) {
      setError((e as Error)?.message ?? t('aiCad.detectFailed'))
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
        setError(res.error?.message ?? t('aiCad.resultQueryFailed'))
        return
      }
      setDetail(res.data)
    } catch (e) {
      setError((e as Error)?.message ?? t('aiCad.resultQueryFailed'))
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const findingColumns = [
    { title: t('aiCad.colType'), dataIndex: 'type', key: 'type', render: (v: string) => <Tag color={v === 'nodule' ? 'blue' : 'orange'}>{v === 'nodule' ? t('aiCad.nodule') : t('aiCad.calcification')}</Tag> },
    { title: t('aiCad.colCoordinates'), key: 'pos', render: (_: unknown, f: { x: number; y: number }) => `(${f.x}, ${f.y})` },
    { title: t('aiCad.colWidthHeight'), key: 'wh', render: (_: unknown, f: { width: number; height: number }) => `${f.width} x ${f.height}` },
    { title: t('aiCad.colDiameter'), dataIndex: 'size', key: 'size' },
    { title: t('aiCad.colConfidence'), dataIndex: 'confidence', key: 'confidence', render: (v: number) => <span style={{ color: v >= 0.85 ? '#52c41a' : v >= 0.7 ? '#faad14' : '#ff4d4f', fontWeight: 600 }}>{(v * 100).toFixed(1)}%</span> },
  ]

  return (
    <div style={{ padding: 'var(--space-4, 16px)' }}>
      <Card type="inner" size="small" title={<Space><ScanSearch size={16} color="var(--color-primary-600)" />{t('aiCad.detectTitle')}</Space>}>
        <Space wrap style={{ marginBottom: 'var(--space-3, 12px)' }}>
          <Input
            placeholder={t('aiCad.instancePlaceholder')}
            value={instanceId}
            onChange={(e) => setInstanceId(e.target.value)}
            onPressEnter={() => void runDetect(instanceId)}
            style={{ width: 360 }}
            allowClear
          />
          <Button type="primary" icon={<Crosshair size={14} />} loading={detecting} onClick={() => void runDetect(instanceId)}>
            {t('aiCad.startDetect')}
          </Button>
          <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>{t('aiCad.examples')}</span>
          {SAMPLE_INSTANCES.map((s) => (
            <Button key={s} size="small" onClick={() => { setInstanceId(s); void runDetect(s) }}>{s}</Button>
          ))}
        </Space>
        {error && (
          <Alert type="error" showIcon style={{ marginBottom: 'var(--space-3, 12px)' }} message={error} action={<Button size="small" onClick={() => setError('')}>{t('aiCad.close')}</Button>} />
        )}

        {current && (
          <Card size="small" type="inner" title={`${t('aiCad.detectResult')} - ${current.instanceId}`} style={{ marginBottom: 'var(--space-4, 16px)' }}
            extra={<Space>{current.simulated && <Tag color="gold">{t('aiCad.simulatedFallback')}</Tag>}<Tag color="green">{current.findings.length} {t('aiCad.lesions')}</Tag></Space>}>
            <Row gutter={16} style={{ marginBottom: 'var(--space-3, 12px)' }}>
              <Col span={8}><Statistic title={t('aiCad.detectedLesions')} value={current.findings.length} suffix={t('aiCad.unitLesion')} /></Col>
              <Col span={8}><Statistic title={t('aiCad.maxConfidence')} value={current.findings.length ? Math.max(...current.findings.map(f => f.confidence)) * 100 : 0} precision={1} suffix="%" /></Col>
              <Col span={8}><Statistic title={t('aiCad.detectTime')} value={current.detectedAt.slice(0, 19).replace('T', ' ')} /></Col>
            </Row>
            <DataTable scroll={{ x: 'max-content' }} rowKey={(f) => `${f.x}-${f.y}`} dataSource={current.findings} columns={findingColumns} pagination={false}/>
            {current.heatmapUrl && (
              <div style={{ marginTop: 'var(--space-2, 8px)', fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                {t('aiCad.heatmap')}: <code>{current.heatmapUrl}</code>
              </div>
            )}
          </Card>
        )}

        <h4 style={{ margin: '8px 0 12px', fontSize: 14, fontWeight: 600 }}>{t('aiCad.sessionHistory')}</h4>
        {history.length === 0 && !detecting ? (
          <EmptyState description={t('aiCad.noDetect')} />
        ) : (
          <DataTable scroll={{ x: 'max-content' }}
            rowKey="instanceId"
            loading={detecting && history.length === 0}
            dataSource={history}
            pagination={false}
            columns={[
              { title: t('aiCad.colInstanceId'), dataIndex: 'instanceId', key: 'instanceId' },
              { title: t('aiCad.colFindingCount'), dataIndex: 'findings', key: 'findingsCount', render: (f: CadResult['findings']) => f.length },
              { title: t('aiCad.detectTime'), dataIndex: 'detectedAt', key: 'detectedAt', render: (v: string) => v.slice(0, 19).replace('T', ' ') },
              {
                title: t('aiCad.colActions'),
                key: 'action',
                render: (_: unknown, r: CadResult) => (
                  <Button size="small" type="link" loading={loadingDetail} onClick={() => void viewDetail(r.instanceId)}>{t('aiCad.viewDetail')}</Button>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Card type="inner" size="small" title={t('aiCad.detail')} style={{ marginTop: 'var(--space-4, 16px)' }}>
        <Spin spinning={loadingDetail}>
          {detail ? (
            <>
              <Space style={{ marginBottom: 'var(--space-3, 12px)' }}>
                <Tag color="blue">{detail.instanceId}</Tag>
                <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{t('aiCad.detectedAt')} {detail.detectedAt.slice(0, 19).replace('T', ' ')}</span>
                {detail.simulated && <Tag color="gold">{t('aiCad.simulatedFallback')}</Tag>}
              </Space>
              <DataTable scroll={{ x: 'max-content' }} rowKey={(f) => `${f.x}-${f.y}`} dataSource={detail.findings} columns={findingColumns} pagination={false}/>
            </>
          ) : (
            <EmptyState description={t('aiCad.detailHint')} />
          )}
        </Spin>
      </Card>
    </div>
  )
}

export default AiCadPage
