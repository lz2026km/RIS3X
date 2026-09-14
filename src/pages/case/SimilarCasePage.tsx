/**
 * G005 放射RIS系统 v3.0.6.11-62 - 相似病例检索
 * 对标 Siemens Similar Patient Search / Infinitt Enterprise Search
 * Tab1 文本检索: 报告语义 (Jaccard + 特征 + SNOMED)
 * Tab2 影像相似: 影像特征 (32-bin 强度直方图 + 统计 + 纹理 + 形态) 余弦相似检索
 * Tab3 融合检索: 文本分 + 影像分加权融合
 */
import {
  similarCaseApi,
  type SimilarCaseResult,
  type ImageSearchResult,
  type ImageSeriesItem,
  type HybridSearchResult,
} from '../../services/api'
import {
  Card, Input, Select, Button, Tag, Space, Row, Col, Typography, Progress,
  Empty, Spin, Alert, Modal, message, Descriptions, Divider, Tabs,
} from 'antd'
import { Search, Brain, Image as ImageIcon, Layers, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react'
import React, { useState, useCallback, useEffect } from 'react'
import { SearchX } from 'lucide-react'
import { t } from '../../i18n/appI18n'

const { Text, Title } = Typography
const { TextArea } = Input

const MODALITIES = ['CT', 'MR', 'DX', 'MG', 'US', 'PET-CT', 'DSA']
const BODY_PARTS = ['胸部', '颅脑', '腹部', '盆腔', '脊柱', '膝关节', '乳腺', '甲状腺', '上肢', '下肢']
const DEMO_REPORTS = ['rpt-1001', 'rpt-1002', 'rpt-1007', 'rpt-1010', 'rpt-1015', 'rpt-1023']

const modalityColors: Record<string, string> = {
  CT: 'cyan', MR: 'purple', DX: 'orange', MG: 'pink', US: 'blue', 'PET-CT': 'red', DSA: 'geekblue', DR: 'orange',
}

/** 直方图 mini 图 (纯 div, 无图表依赖) */
function MiniHistogram({ hist, height = 28 }: { hist: number[]; height?: number }) {
  const max = Math.max(...hist, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height, width: '100%' }}>
      {hist.map((v, i) => (
        <div
          key={i}
          title={`bin${i}: ${v}`}
          style={{ flex: 1, background: '#818cf8', borderRadius: 1, height: `${Math.max(2, (v / max) * 100)}%`, opacity: 0.85 }}
        />
      ))}
    </div>
  )
}

function FeatureSummaryBlock({ summary }: { summary: { mean: number; std: number; skew: number; kurtosis: number; min: number; max: number; percentiles: number[]; textureEnergy: number; highDensityRatio: number; lowDensityRatio: number; histogram: number[] } }) {
  const [p5, , p50, , p95] = summary.percentiles
  return (
    <div style={{ fontSize: 11, color: '#475569' }}>
      <MiniHistogram hist={summary.histogram} />
      <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', lineHeight: 1.8 }}>
        <span>{t('similarCase.featMean')} <Text strong>{summary.mean}</Text></span>
        <span>{t('similarCase.featStd')} <Text strong>{summary.std}</Text></span>
        <span>p50 <Text strong>{p50}</Text> (p5..p95: {p5}..{p95})</span>
        <span>{t('similarCase.featSkewKurt')} <Text strong>{summary.skew}/{summary.kurtosis}</Text></span>
        <span>{t('similarCase.featTextureEnergy')} <Text strong>{summary.textureEnergy}</Text></span>
        <span>{t('similarCase.featRange')} <Text strong>{summary.min}..{summary.max}</Text></span>
        <span>{t('similarCase.featHighDensity')} <Text strong>{(summary.highDensityRatio * 100).toFixed(1)}%</Text></span>
        <span>{t('similarCase.featLowDensity')} <Text strong>{(summary.lowDensityRatio * 100).toFixed(1)}%</Text></span>
      </div>
    </div>
  )
}

function highlight(text: string, keywords: string[]): React.ReactNode {
  if (!text || keywords.length === 0) return text
  const sorted = [...keywords].sort((a, b) => b.length - a.length)
  const parts = text.split(new RegExp(`(${sorted.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'))
  return parts.map((p, i) =>
    keywords.some((k) => p.toLowerCase() === k.toLowerCase())
      ? <mark key={i} style={{ background: '#fef08a', padding: '0 2px', borderRadius: 2 }}>{p}</mark>
      : <span key={i}>{p}</span>,
  )
}

/** Tab2: 影像相似检索 */
function ImageSearchTab() {
  const [seriesList, setSeriesList] = useState<ImageSeriesItem[]>([])
  const [selected, setSelected] = useState<string | undefined>()
  const [results, setResults] = useState<ImageSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [detail, setDetail] = useState<ImageSearchResult | null>(null)

  useEffect(() => {
    similarCaseApi.listImageSeries().then((res) => {
      if (res.success && Array.isArray(res.data)) setSeriesList(res.data)
    }).catch(() => { /* 列表加载失败不阻塞 */ })
  }, [])

  const handleSearch = useCallback(async () => {
    if (!selected) {
      message.warning(t('similarCase.selectExam'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await similarCaseApi.imageSearch({ seriesUID: selected, limit: 10 })
      if (res.success && Array.isArray(res.data)) {
        setResults(res.data)
        setSearched(true)
      } else setError(t('similarCase.imageSearchError'))
    } catch {
      setError(t('similarCase.imageSearchFailed'))
    } finally {
      setLoading(false)
    }
  }, [selected])

  return (
    <div>
      <Card style={{ marginBottom: 16 }} size="small">
        <Space wrap>
          <Select
            placeholder={t('similarCase.selectExamPh')} showSearch allowClear style={{ width: 380 }}
            value={selected}
            onChange={setSelected}
            options={seriesList.map((s) => ({
              label: `${s.modality} · ${s.bodyPart} · ${s.source === 'real' ? t('similarCase.realSample') : t('similarCase.demoShort')} (${s.seriesUid.slice(-10)})`,
              value: s.seriesUid,
            }))}
          />
          <Button type="primary" icon={<Search size={14} />} loading={loading} onClick={handleSearch}>
            {t('similarCase.searchSimilarImages')}
          </Button>
        </Space>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('similarCase.imageSearchNote')}
          </Text>
        </div>
      </Card>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" indicator={<Loader2 className="animate-spin" style={{ fontSize: 28 }} />} />
          <div style={{ marginTop: 12 }}><Text type="secondary">{t('similarCase.extractingFeatures')}</Text></div>
        </div>
      ) : results.length === 0 ? (
        searched ? <Empty image={<SearchX size={56} style={{opacity:0.4}}/>} description={t('similarCase.noSimilarImages')} style={{ padding: 40 }} /> : <Empty image={<SearchX size={56} style={{opacity:0.4}}/>} description={t('similarCase.selectExamToStart')} style={{ padding: 40 }} />
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">{t('similarCase.returnedPrefix')} <Text strong>{results.length}</Text> {t('similarCase.similarSeriesSuffix')}</Text>
          </div>
          <Row gutter={[16, 16]}>
            {results.map((r, idx) => (
              <Col key={r.seriesUid} xs={24} sm={12} lg={8}>
                <Card
                  hoverable size="small"
                  onClick={() => setDetail(r)}
                  title={
                    <Space size={8}>
                      <Text strong>#{idx + 1}</Text>
                      <Tag color={modalityColors[r.modality] ?? 'default'}>{r.modality}</Tag>
                      <Tag>{r.bodyPart}</Tag>
                      {r.source === 'demo' && <Tag color="gold" style={{ fontSize: 10 }}>{t('similarCase.demoFeatureLib')}</Tag>}
                      {r.source === 'real' && <Tag color="green" style={{ fontSize: 10 }}>{t('similarCase.realSample')}</Tag>}
                    </Space>
                  }
                  extra={<Text type="secondary" style={{ fontSize: 10 }}>{r.seriesUid.slice(-10)}</Text>}
                >
                  <Progress
                    percent={r.similarity}
                    size="small"
                    strokeColor={r.similarity >= 70 ? '#16a34a' : r.similarity >= 40 ? '#f59e0b' : '#94a3b8'}
                    format={(p) => <Text strong style={{ color: '#334155' }}>{p}%</Text>}
                  />
                  <div style={{ marginTop: 8 }}>
                    <MiniHistogram hist={r.featureSummary.histogram} height={24} />
                  </div>
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {t('similarCase.featureCosine')} {r.featureScore.toFixed(0)}% · {t('similarCase.modalityPart')} {r.matchScore.toFixed(0)}% · {t('similarCase.featMean')} {r.featureSummary.mean} · p50 {r.featureSummary.percentiles[2]}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </>
      )}

      <Modal
        open={!!detail}
        title={detail ? `${t('similarCase.imageDetail')} ${detail.modality} · ${detail.bodyPart} (${t('similarCase.descrSimilarity')} ${detail.similarity}%)` : ''}
        footer={null}
        width={640}
        onCancel={() => setDetail(null)}
      >
        {detail && (
          <div>
            <Descriptions size="small" column={3} bordered>
              <Descriptions.Item label={t('similarCase.descrModality')}><Tag color={modalityColors[detail.modality] ?? 'default'}>{detail.modality}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('similarCase.descrBodyPart')}><Tag>{detail.bodyPart}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('similarCase.descrInstanceCount')}>{detail.instanceCount}</Descriptions.Item>
              <Descriptions.Item label={t('similarCase.descrSimilarity')}><Tag color="blue">{detail.similarity}%</Tag></Descriptions.Item>
              <Descriptions.Item label={t('similarCase.descrFeatureCosine')}><Text strong>{detail.featureScore.toFixed(1)}%</Text></Descriptions.Item>
              <Descriptions.Item label={t('similarCase.descrModalityPartMatch')}><Text strong>{detail.matchScore.toFixed(1)}%</Text></Descriptions.Item>
              <Descriptions.Item label={t('similarCase.descrSeries')} span={3}><Text copyable style={{ fontSize: 11 }}>{detail.seriesUid}</Text></Descriptions.Item>
            </Descriptions>
            <Divider>{t('similarCase.featureSummary')}</Divider>
            <FeatureSummaryBlock summary={detail.featureSummary} />
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('similarCase.anonymizedNote')}</Text>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/** Tab3: 融合检索 */
function HybridSearchTab() {
  const [reportText, setReportText] = useState('')
  const [reportId, setReportId] = useState<string | undefined>()
  const [seriesList, setSeriesList] = useState<ImageSeriesItem[]>([])
  const [selected, setSelected] = useState<string | undefined>()
  const [results, setResults] = useState<HybridSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [detail, setDetail] = useState<HybridSearchResult | null>(null)

  useEffect(() => {
    similarCaseApi.listImageSeries().then((res) => {
      if (res.success && Array.isArray(res.data)) setSeriesList(res.data)
    }).catch(() => { /* 忽略 */ })
  }, [])

  const handleSearch = useCallback(async () => {
    if (!reportText.trim() && !reportId && !selected) {
      message.warning(t('similarCase.hybridInputRequired'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await similarCaseApi.hybridSearch({
        reportId,
        reportText: reportText.trim() || undefined,
        seriesUID: selected,
        limit: 10,
      })
      if (res.success && Array.isArray(res.data)) {
        setResults(res.data)
        setSearched(true)
      } else setError(t('similarCase.hybridSearchError'))
    } catch {
      setError(t('similarCase.hybridSearchFailed'))
    } finally {
      setLoading(false)
    }
  }, [reportText, reportId, selected])

  return (
    <div>
      <Card style={{ marginBottom: 16 }} size="small">
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Space wrap>
            <Select
              placeholder={t('similarCase.selectReportDemo')} allowClear style={{ width: 200 }}
              value={reportId}
              onChange={(v) => { setReportId(v); if (v) setReportText('') }}
              options={DEMO_REPORTS.map((r) => ({ label: r, value: r }))}
            />
            <Select
              placeholder={t('similarCase.selectExamOptional')} showSearch allowClear style={{ width: 360 }}
              value={selected}
              onChange={setSelected}
              options={seriesList.map((s) => ({
                label: `${s.modality} · ${s.bodyPart} (${s.seriesUid.slice(-10)})`,
                value: s.seriesUid,
              }))}
            />
            <Button type="primary" icon={<Layers size={14} />} loading={loading} onClick={handleSearch}>
              {t('similarCase.hybridSearch')}
            </Button>
          </Space>
          <TextArea
            rows={3}
            placeholder={t('similarCase.hybridPlaceholder')}
            value={reportText}
            onChange={(e) => { setReportText(e.target.value); if (e.target.value) setReportId(undefined) }}
          />
        </Space>
      </Card>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" indicator={<Loader2 className="animate-spin" style={{ fontSize: 28 }} />} />
          <div style={{ marginTop: 12 }}><Text type="secondary">{t('similarCase.hybridSearching')}</Text></div>
        </div>
      ) : results.length === 0 ? (
        searched ? <Empty image={<SearchX size={56} style={{opacity:0.4}}/>} description={t('similarCase.noMatchAdjust')} style={{ padding: 40 }} /> : <Empty image={<SearchX size={56} style={{opacity:0.4}}/>} description={t('similarCase.hybridStartHint')} style={{ padding: 40 }} />
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">{t('similarCase.returnedPrefix')} <Text strong>{results.length}</Text> {t('similarCase.returnedSuffix2')}</Text>
          </div>
          <Row gutter={[16, 16]}>
            {results.map((r, idx) => (
              <Col key={r.id} xs={24} sm={12} lg={8}>
                <Card
                  hoverable size="small"
                  onClick={() => setDetail(r)}
                  title={
                    <Space size={8}>
                      <Text strong>#{idx + 1}</Text>
                      <Tag color={modalityColors[r.modality] ?? 'default'}>{r.modality}</Tag>
                      <Tag>{r.bodyPart}</Tag>
                      {r.source === 'demo' && <Tag color="gold" style={{ fontSize: 10 }}>{t('similarCase.demoLib')}</Tag>}
                      {r.source === 'real' && <Tag color="green" style={{ fontSize: 10 }}>{t('similarCase.realSample')}</Tag>}
                    </Space>
                  }
                >
                  <Progress
                    percent={r.similarity}
                    size="small"
                    strokeColor={r.similarity >= 70 ? '#16a34a' : r.similarity >= 40 ? '#f59e0b' : '#94a3b8'}
                    format={(p) => <Text strong style={{ color: '#334155' }}>{p}%</Text>}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#334155', lineHeight: 1.6, minHeight: 38 }}>
                    {r.impression || `${r.modality} ${r.bodyPart} ${t('similarCase.imageSeriesSuffix')}`}
                  </div>
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 12 }}>
                    <span>{t('similarCase.textScore')} <Text strong>{r.textScore !== null ? `${Math.round(r.textScore * 100)}%` : '—'}</Text></span>
                    <span>{t('similarCase.imageScore')} <Text strong>{r.imageScore !== null ? `${Math.round(r.imageScore * 100)}%` : '—'}</Text></span>
                    {r.featureSummary && <span>{t('similarCase.featMean')} {r.featureSummary.mean}</span>}
                  </div>
                  {r.featureSummary && (
                    <div style={{ marginTop: 6 }}>
                      <MiniHistogram hist={r.featureSummary.histogram} height={18} />
                    </div>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </>
      )}

      <Modal
        open={!!detail}
        title={detail ? `${t('similarCase.hybridDetail')} ${detail.reportId} (${t('similarCase.descrSimilarity')} ${detail.similarity}%)` : ''}
        footer={null}
        width={680}
        onCancel={() => setDetail(null)}
      >
        {detail && (
          <div>
            <Descriptions size="small" column={3} bordered>
              <Descriptions.Item label={t('similarCase.descrModality')}>{detail.modality}</Descriptions.Item>
              <Descriptions.Item label={t('similarCase.descrBodyPart')}>{detail.bodyPart}</Descriptions.Item>
              <Descriptions.Item label={t('similarCase.descrSimilarity')}><Tag color="blue">{detail.similarity}%</Tag></Descriptions.Item>
              <Descriptions.Item label={t('similarCase.textScore')}>{detail.textScore !== null ? `${Math.round(detail.textScore * 100)}%` : '—'}</Descriptions.Item>
              <Descriptions.Item label={t('similarCase.imageScore')}>{detail.imageScore !== null ? `${Math.round(detail.imageScore * 100)}%` : '—'}</Descriptions.Item>
              <Descriptions.Item label={t('similarCase.descrDataSource')}>{detail.source === 'real' ? t('similarCase.descrRealSample') : detail.source === 'demo' ? t('similarCase.descrDemoLib') : 'DB'}</Descriptions.Item>
            </Descriptions>
            {detail.findings && (
              <>
                <Divider>{t('similarCase.findingsDivider')}</Divider>
                <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{highlight(detail.findings, detail.keywords ?? [])}</p>
              </>
            )}
            {detail.impression && (
              <>
                <Divider>{t('similarCase.impressionDivider')}</Divider>
                <p style={{ lineHeight: 1.8 }}>{highlight(detail.impression, detail.keywords ?? [])}</p>
              </>
            )}
            {detail.featureSummary && (
              <>
                <Divider>{t('similarCase.featureSummary')}</Divider>
                <FeatureSummaryBlock summary={detail.featureSummary} />
              </>
            )}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('similarCase.anonymizedNote2')}</Text>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

const SimilarCasePage: React.FC = () => {
  const [reportText, setReportText] = useState('')
  const [reportId, setReportId] = useState<string | undefined>()
  const [modality, setModality] = useState<string | undefined>()
  const [bodyPart, setBodyPart] = useState<string | undefined>()
  const [results, setResults] = useState<SimilarCaseResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [detail, setDetail] = useState<SimilarCaseResult | null>(null)
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'useful' | 'useless'>>({})

  const handleSearch = useCallback(async () => {
    if (!reportText.trim() && !reportId) {
      message.warning(t('similarCase.reportRequired'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = reportId
        ? await similarCaseApi.searchByReport(reportId)
        : await similarCaseApi.search({
            reportText: reportText.trim(),
            modality,
            bodyPart,
            limit: 10,
          })
      if (res.success && Array.isArray(res.data)) {
        setResults(res.data)
        setSearched(true)
      } else {
        setError(t('similarCase.searchServiceError'))
      }
    } catch {
      setError(t('similarCase.similarSearchFailed'))
    } finally {
      setLoading(false)
    }
  }, [reportText, reportId, modality, bodyPart])

  const handleFeedback = useCallback(async (c: SimilarCaseResult, useful: boolean) => {
    const sourceReportId = reportId ?? 'text-input'
    setFeedbackMap((m) => ({ ...m, [c.reportId]: useful ? 'useful' : 'useless' }))
    try {
      const res = await similarCaseApi.feedback({ reportId: sourceReportId, targetReportId: c.reportId, useful })
      message.success(res.success ? t('similarCase.thanksFeedback') : t('similarCase.feedbackFailed'))
    } catch {
      message.error(t('similarCase.feedbackFailed'))
    }
  }, [reportId])

  const textSearchTab = (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space wrap>
            <Select
              placeholder={t('similarCase.selectReportDemo')} allowClear style={{ width: 200 }}
              value={reportId}
              onChange={(v) => { setReportId(v); if (v) setReportText('') }}
              options={DEMO_REPORTS.map((r) => ({ label: r, value: r }))}
            />
            <Select
              placeholder={t('similarCase.modalityPh')} allowClear style={{ width: 120 }}
              value={modality} onChange={setModality}
              options={MODALITIES.map((m) => ({ label: m, value: m }))}
            />
            <Select
              placeholder={t('similarCase.bodyPartPh')} allowClear style={{ width: 130 }}
              value={bodyPart} onChange={setBodyPart}
              options={BODY_PARTS.map((b) => ({ label: b, value: b }))}
            />
            <Button type="primary" icon={<Search size={14} />} loading={loading} onClick={handleSearch}>
              {t('similarCase.searchSimilarCases')}
            </Button>
          </Space>
          <TextArea
            rows={4}
            placeholder={t('similarCase.reportPlaceholder')}
            value={reportText}
            onChange={(e) => { setReportText(e.target.value); if (e.target.value) setReportId(undefined) }}
          />
        </Space>
      </Card>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" indicator={<Loader2 className="animate-spin" style={{ fontSize: 28 }} />} />
          <div style={{ marginTop: 12 }}><Text type="secondary">{t('similarCase.searchingSimilar')}</Text></div>
        </div>
      ) : results.length === 0 ? (
        searched ? <Empty image={<SearchX size={56} style={{opacity:0.4}}/>} description={t('similarCase.noSimilarCases')} style={{ padding: 40 }} /> : <Empty image={<SearchX size={56} style={{opacity:0.4}}/>} description={t('similarCase.inputToStart')} style={{ padding: 40 }} />
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">{t('similarCase.returnedPrefix')} <Text strong>{results.length}</Text> {t('similarCase.returnedCases')}</Text>
          </div>
          <Row gutter={[16, 16]}>
            {results.map((c, idx) => (
              <Col key={c.id} xs={24} sm={12} lg={8}>
                <Card
                  hoverable
                  onClick={() => setDetail(c)}
                  style={{ height: '100%' }}
                  title={
                    <Space size={8}>
                      <Text strong>#{idx + 1}</Text>
                      <Tag color={modalityColors[c.modality] ?? 'default'}>{c.modality}</Tag>
                      <Tag>{c.bodyPart}</Tag>
                      <Tag color="default">{c.gender}{c.age}{t('similarCase.ageUnit')}</Tag>
                      {c.source === 'demo' && <Tag color="gold" style={{ fontSize: 10 }}>{t('similarCase.demoLib')}</Tag>}
                    </Space>
                  }
                  extra={<Text type="secondary" style={{ fontSize: 11 }}>{c.studyDate}</Text>}
                  actions={[
                    <Button key="f1" type="text" size="small" icon={<ThumbsUp size={13} />}
                      disabled={feedbackMap[c.reportId] === 'useless'}
                      onClick={(e) => { e.stopPropagation(); handleFeedback(c, true) }}>
                      {t('similarCase.useful')}
                    </Button>,
                    <Button key="f2" type="text" size="small" icon={<ThumbsDown size={13} />}
                      disabled={feedbackMap[c.reportId] === 'useful'}
                      onClick={(e) => { e.stopPropagation(); handleFeedback(c, false) }}>
                      {t('similarCase.useless')}
                    </Button>,
                  ]}
                >
                  <Progress
                    percent={c.similarity}
                    size="small"
                    strokeColor={c.similarity >= 70 ? '#16a34a' : c.similarity >= 40 ? '#f59e0b' : '#94a3b8'}
                    format={(p) => <Text strong style={{ color: '#334155' }}>{p}%</Text>}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#334155', lineHeight: 1.7, minHeight: 54 }}>
                    {highlight(c.impression || c.conclusion, c.keywords)}
                  </div>
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {t('similarCase.textLabel')} {Math.round(c.textScore * 100)}% · {t('similarCase.featureLabel')} {Math.round(c.featureScore * 100)}% · SNOMED {Math.round(c.snomedScore * 100)}%
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </>
      )}

      <Modal
        open={!!detail}
        title={detail ? `${t('similarCase.similarCaseDetail')} ${detail.reportId}` : ''}
        footer={null}
        width={720}
        onCancel={() => setDetail(null)}
      >
        {detail && (
          <div>
            <Descriptions size="small" column={3} bordered>
              <Descriptions.Item label={t('similarCase.descrModality')}>{detail.modality}</Descriptions.Item>
              <Descriptions.Item label={t('similarCase.descrBodyPart')}>{detail.bodyPart}</Descriptions.Item>
              <Descriptions.Item label={t('similarCase.descrGenderAge')}>{detail.gender} / {detail.age}{t('similarCase.ageUnit')}</Descriptions.Item>
              <Descriptions.Item label={t('similarCase.descrExamDate')}>{detail.studyDate}</Descriptions.Item>
              <Descriptions.Item label={t('similarCase.descrSimilarity')}>
                <Tag color="blue">{detail.similarity}%</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('similarCase.descrMatchKeywords')}>
                {detail.keywords.map((k) => <Tag key={k} color="gold" style={{ marginBottom: 2 }}>{k}</Tag>)}
              </Descriptions.Item>
            </Descriptions>
            <Divider>{t('similarCase.findingsDivider')}</Divider>
            <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{highlight(detail.findings, detail.keywords)}</p>
            <Divider>{t('similarCase.impressionDivider')}</Divider>
            <p style={{ lineHeight: 1.8 }}>{highlight(detail.impression, detail.keywords)}</p>
            {detail.conclusion && (
              <>
                <Divider>{t('similarCase.conclusionDivider')}</Divider>
                <p style={{ lineHeight: 1.8 }}><Tag color="purple">{detail.conclusion}</Tag></p>
              </>
            )}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('similarCase.reportAnonymized')}</Text>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Brain size={22} color="#7c3aed" />
        <div>
          <Title level={4} style={{ margin: 0 }}>{t('similarCase.pageTitle')}</Title>
          <Text type="secondary">
            {t('similarCase.pageSubtitle')}
          </Text>
        </div>
      </Space>

      <Tabs
        defaultActiveKey="text"
        items={[
          { key: 'text', label: <Space size={6}><Search size={14} />{t('similarCase.tabText')}</Space>, children: textSearchTab },
          { key: 'image', label: <Space size={6}><ImageIcon size={14} />{t('similarCase.tabImage')}</Space>, children: <ImageSearchTab /> },
          { key: 'hybrid', label: <Space size={6}><Layers size={14} />{t('similarCase.tabHybrid')}</Space>, children: <HybridSearchTab /> },
        ]}
      />
    </div>
  )
}

export default SimilarCasePage
