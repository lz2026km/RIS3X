/**
 * G005 RIS v3.0.6.11-101 Wave 3C - AI 增强工作台
 * 三面板: 多器官自动检出 (置信度条 + 体积 + 一键生成报告段落) /
 *         报告草稿评分 (总分 + 维度条形 + 改进建议) /
 *         智能挂片 (推荐布局卡片 + 应用按钮 + 应用记录)
 * 后端: /api/ai-v2/* (real 模式); dev mock 模式下无 MSW handler 时回退展示空态
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Button,
  Select,
  Input,
  Tag,
  Space,
  Typography,
  message,
  Progress,
  Statistic,
  Divider,
  List,
  Empty,
  Alert,
  Tooltip,
} from "antd";
import {
  Brain, ScanSearch, FileText, ClipboardCopy, Gauge, Wand2, LayoutGrid, Check, History, Sparkles, Activity, CircleDot,
} from 'lucide-react'
import {
  aiV2Api,
  type OrganDetectionResult,
  type DraftScoreResult,
  type HangingRecommendation,
  type HangingApplication,
} from '../../services/api/aiV2Api'
import { t } from '../../i18n/appI18n'
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common"

const { Text, Title } = Typography
const { TextArea } = Input

const MODALITIES = ['CT', 'MR', 'DR', 'US', 'MG', 'NM']
const BODY_PARTS = [
  { value: 'CHEST', label: 'aiEnhanced.bodyChest' },
  { value: 'ABDOMEN', label: 'aiEnhanced.bodyAbdomen' },
  { value: 'HEAD', label: 'aiEnhanced.bodyHead' },
  { value: 'NECK', label: 'aiEnhanced.bodyNeck' },
  { value: 'SPINE', label: 'aiEnhanced.bodySpine' },
  { value: 'KNEE', label: 'aiEnhanced.bodyKnee' },
  { value: 'CARDIAC', label: 'aiEnhanced.bodyCardiac' },
  { value: 'PELVIS', label: 'aiEnhanced.bodyPelvis' },
]

const GRADE_COLORS: Record<string, string> = { 优: 'green', 良: 'blue', 中: 'orange', 差: 'red' }
const LEVEL_COLORS: Record<string, string> = { error: 'red', warning: 'orange', info: 'blue' }
const LEVEL_LABELS: Record<string, string> = { error: 'aiEnhanced.levelError', warning: 'aiEnhanced.levelWarning', info: 'aiEnhanced.levelInfo' }

function scoreColor(score: number): string {
  if (score >= 90) return '#52c41a'
  if (score >= 75) return 'var(--color-primary-600)'
  if (score >= 60) return '#faad14'
  return '#ff4d4f'
}

const SAMPLE_DRAFT_GOOD = [
  '【检查技术】CT 胸部平扫+增强扫描, 层厚 5mm, 重建间隔 5mm。',
  '【影像所见】双肺纹理清晰, 未见明确异常密度影; 右上肺可见结节大小约 12mm×9mm, 边缘光整, 无明显分叶及毛刺; 纵隔内未见明显肿大淋巴结; 双侧胸腔未见积液。',
  '【诊断意见】右上肺结节, 建议 3 个月后低剂量 CT 随访复查。',
].join('\n')

const SAMPLE_DRAFT_BAD = '胸部扫描看着还可以, 肺上好像有点东西, 大小大概 12, 感觉差不多, 建议随访'

const SAMPLE_SERIES = '肺窗, 纵隔窗, 冠状位, 矢状位'

// ── 面板 1: 多器官自动检出 ───────────────────────────────────────────────────

const OrganDetectionPanel: React.FC = () => {
  const [studyId, setStudyId] = useState('LS20260718-001')
  const [modality, setModality] = useState('CT')
  const [bodyPart, setBodyPart] = useState('CHEST')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<OrganDetectionResult | null>(null)
  const [paragraph, setParagraph] = useState('')
  const [paragraphLoading, setParagraphLoading] = useState(false)
  const [paragraphCopied, setParagraphCopied] = useState(false)

  const handleAnalyze = useCallback(async () => {
    if (!studyId.trim()) { message.warning(t('aiEnhanced.studyIdRequired')); return }
    setLoading(true)
    setResult(null)
    setParagraph('')
    try {
      const res = await aiV2Api.analyzeOrgans({ studyId: studyId.trim(), modality, bodyPart })
      if (res.success && res.data) {
        setResult(res.data)
        message.success(t('w9d.aiEnhanced.organsDetected', { count: res.data.organsDetected }))
      } else {
        message.error(res.error?.message || t('aiEnhanced.detectFailed'))
      }
    } catch (err) {
      console.error('[AiV2] analyze organs failed:', err)
      message.error(t('aiEnhanced.detectRequestFailed'))
    } finally {
      setLoading(false)
    }
  }, [studyId, modality, bodyPart])

  const handleParagraph = useCallback(async () => {
    if (!result) return
    setParagraphLoading(true)
    try {
      const res = await aiV2Api.generateParagraph(result.id)
      if (res.success && res.data) {
        setParagraph(res.data.paragraph)
        message.success(t('aiEnhanced.paragraphGenerated'))
      } else {
        message.error(res.error?.message || t('aiEnhanced.paragraphFailed'))
      }
    } catch (err) {
      console.error('[AiV2] paragraph failed:', err)
      message.error(t('aiEnhanced.paragraphFailed'))
    } finally {
      setParagraphLoading(false)
    }
  }, [result])

  const handleCopy = useCallback(async () => {
    if (!paragraph) return
    try {
      await navigator.clipboard.writeText(paragraph)
      setParagraphCopied(true)
      message.success(t('aiEnhanced.copied'))
      window.setTimeout(() => setParagraphCopied(false), 1500)
    } catch {
      message.warning(t('aiEnhanced.copyFailed'))
    }
  }, [paragraph])

  const detected = useMemo(() => (result?.organs ?? []).filter((o) => o.status === 'detected'), [result])

  return (
    <Card
      title={<Space><ScanSearch size={16} color="var(--color-primary-600)" />{t('aiEnhanced.organDetectTitle')}</Space>}
      extra={<Tag color="blue">{t('aiEnhanced.organDetectTag')}</Tag>}
    >
      <Space wrap style={{ marginBottom: 12 }}>
        <Input
          value={studyId}
          onChange={(e) => setStudyId(e.target.value)}
          placeholder={t('aiEnhanced.studyIdPlaceholder')}
          style={{ width: 190 }}
        />
        <Select value={modality} onChange={setModality} options={MODALITIES.map((m) => ({ value: m, label: m }))} style={{ width: 90 }} />
        <Select
          value={bodyPart}
          onChange={setBodyPart}
          options={BODY_PARTS.map((b) => ({ value: b.value, label: t(b.label) }))}
          style={{ width: 110 }}
        />
        <Button type="primary" icon={<ScanSearch size={14} />} onClick={handleAnalyze} loading={loading}>
          {loading ? t('aiEnhanced.analyzing') : t('aiEnhanced.autoDetect')}
        </Button>
      </Space>

      {!result && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary">{t('aiEnhanced.organDetectHint')}</Text>
          }
        />
      )}

      {result && (
        <>
          <StatCardGrid minWidth={200} gap={12} style={{ marginBottom: 12 }}>
            <StatCard title={t('aiEnhanced.organsDetected')} value={result.organsDetected} suffix={`/ ${result.organs.length}`} color="primary" icon={<Activity size={18} />} />
            <StatCard title={t('aiEnhanced.avgConfidence')} value={Math.round(result.avgConfidence * 100)} suffix="%" color="info" icon={<Gauge size={18} />} />
            <StatCard title={t('aiEnhanced.primaryOrgan')} value={result.primaryOrgan ? result.organs.find((o) => o.code === result.primaryOrgan)?.label ?? '-' : '-'} color="primary" />
          </StatCardGrid>

          <List
            size="small"
            dataSource={result.organs}
            renderItem={(organ) => (
              <List.Item
                actions={[
                  <Tag key="status" color={organ.status === 'detected' ? 'green' : 'default'}>
                    {organ.status === 'detected' ? t('aiEnhanced.detected') : t('aiEnhanced.lowConfidence')}
                  </Tag>,
                ]}
              >
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Space>
                      <CircleDot size={14} color={organ.status === 'detected' ? 'var(--color-primary-600)' : '#bfbfbf'} />
                      <Text strong>{organ.label}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {t('aiEnhanced.volumeApprox')} {organ.volumeMl}mL · {t('aiEnhanced.coverage')} {organ.slices} {t('aiEnhanced.slices')}
                      </Text>
                    </Space>
                    <Text strong style={{ color: scoreColor(organ.confidence * 100) }}>
                      {(organ.confidence * 100).toFixed(1)}%
                    </Text>
                  </div>
                  <Progress
                    percent={Math.round(organ.confidence * 100)}
                    showInfo={false}
                    strokeColor={scoreColor(organ.confidence * 100)}
                    size="small"
                  />
                  <Tooltip title={t('w9d.aiEnhanced.bboxTooltip', { x: organ.bbox.x, y: organ.bbox.y, w: organ.bbox.width, h: organ.bbox.height })}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{organ.featureNote}</Text>
                  </Tooltip>
                </div>
              </List.Item>
            )}
          />

          <Divider style={{ margin: '12px 0' }} />
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('aiEnhanced.detectDisclaimer')}</Text>
            <Button
              type="primary"
              ghost
              icon={<Wand2 size={14} />}
              loading={paragraphLoading}
              disabled={detected.length === 0}
              onClick={handleParagraph}
            >
              {t('aiEnhanced.generateParagraph')}
            </Button>
          </Space>

          {paragraph && (
            <Alert
              style={{ marginTop: 12 }}
              type="success"
              showIcon
              message={
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text style={{ whiteSpace: 'pre-wrap' }}>{paragraph}</Text>
                  <Space>
                    <Button size="small" icon={<ClipboardCopy size={13} />} onClick={handleCopy}>
                      {paragraphCopied ? t('aiEnhanced.copiedShort') : t('aiEnhanced.copy')}
                    </Button>
                  </Space>
                </Space>
              }
            />
          )}
        </>
      )}
    </Card>
  )
}

// ── 面板 2: 报告草稿评分 ─────────────────────────────────────────────────────

const DraftScorePanel: React.FC = () => {
  const [draftText, setDraftText] = useState('')
  const [modality, setModality] = useState('CT')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DraftScoreResult | null>(null)

  const handleScore = useCallback(async () => {
    if (!draftText.trim()) { message.warning(t('aiEnhanced.draftRequired')); return }
    setLoading(true)
    try {
      const res = await aiV2Api.scoreDraft({ draftText, modality })
      if (res.success && res.data) {
        setResult(res.data)
        message.success(t('w9d.aiEnhanced.scoreDone', { score: res.data.score, grade: res.data.grade }))
      } else {
        message.error(res.error?.message || t('aiEnhanced.scoreFailed'))
      }
    } catch (err) {
      console.error('[AiV2] draft score failed:', err)
      message.error(t('aiEnhanced.scoreRequestFailed'))
    } finally {
      setLoading(false)
    }
  }, [draftText, modality])

  const fillSample = useCallback((sample: string) => {
    setDraftText(sample)
    setResult(null)
  }, [])

  return (
    <Card
      title={<Space><Gauge size={16} color="var(--color-primary-600)" />{t('aiEnhanced.draftScoreTitle')}</Space>}
      extra={<Tag color="blue">{t('aiEnhanced.draftScoreTag')}</Tag>}
    >
      <Space wrap style={{ marginBottom: 8 }}>
        <Select value={modality} onChange={setModality} options={MODALITIES.map((m) => ({ value: m, label: m }))} style={{ width: 90 }} />
        <Button size="small" onClick={() => fillSample(SAMPLE_DRAFT_GOOD)}>{t('aiEnhanced.fillGoodSample')}</Button>
        <Button size="small" onClick={() => fillSample(SAMPLE_DRAFT_BAD)}>{t('aiEnhanced.fillBadSample')}</Button>
      </Space>
      <TextArea
        value={draftText}
        onChange={(e) => setDraftText(e.target.value)}
        rows={8}
        placeholder={t('aiEnhanced.draftPlaceholder')}
        style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}
      />
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>{draftText.length} {t('aiEnhanced.chars')}</Text>
        <Button type="primary" icon={<Gauge size={14} />} onClick={handleScore} loading={loading} disabled={!draftText.trim()}>
          {loading ? t('aiEnhanced.scoring') : t('aiEnhanced.startScore')}
        </Button>
      </Space>

      {result && (
        <>
          <Divider />
          <Row gutter={16} align="middle">
            <Col span={10}>
              <Statistic
                title={t('aiEnhanced.overallScore')}
                value={result.score}
                suffix="/ 100"
                styles={{ content: { color: scoreColor(result.score), fontSize: 30 } }}
              />
              <Tag color={GRADE_COLORS[result.grade] ?? 'default'} style={{ marginTop: 8 }}>{t('aiEnhanced.grade')}: {result.grade}</Tag>
            </Col>
            <Col span={14}>
              <Progress percent={result.score} strokeColor={scoreColor(result.score)} showInfo={false} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('aiEnhanced.statsPrefix')} {result.stats.charCount} {t('aiEnhanced.chars')} · {result.stats.sectionCount}/3 {t('aiEnhanced.sections')} · {result.stats.numericCount} {t('aiEnhanced.numericValues')}
              </Text>
            </Col>
          </Row>

          <Divider titlePlacement="left" plain style={{ margin: '12px 0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('aiEnhanced.dimensionScore')}</Text>
          </Divider>
          {result.dimensions.map((d) => (
            <div key={d.key} style={{ marginBottom: 8 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12 }}>{d.label}</Text>
                <Space size={4}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('aiEnhanced.weight')} {(d.weight * 100).toFixed(0)}%</Text>
                  <Text strong style={{ color: scoreColor(d.score), fontSize: 12 }}>{d.score}</Text>
                </Space>
              </Space>
              <Progress percent={d.score} strokeColor={scoreColor(d.score)} showInfo={false} size="small" />
            </div>
          ))}

          <Divider titlePlacement="left" plain style={{ margin: '12px 0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('aiEnhanced.suggestions')} ({result.suggestions.length})</Text>
          </Divider>
          {result.suggestions.length === 0 ? (
            <Alert type="success" showIcon message={t('aiEnhanced.draftGood')} />
          ) : (
            <List
              size="small"
              dataSource={result.suggestions}
              renderItem={(s) => (
                <List.Item style={{ alignItems: 'flex-start' }}>
                  <Space align="start" size={8}>
                    <Tag color={LEVEL_COLORS[s.level] ?? 'blue'} style={{ marginTop: 2 }}>{t(LEVEL_LABELS[s.level] ?? s.level)}</Tag>
                    <Text style={{ fontSize: 12 }}>{s.message}</Text>
                  </Space>
                </List.Item>
              )}
            />
          )}
        </>
      )}
    </Card>
  )
}

// ── 面板 3: 智能挂片 ─────────────────────────────────────────────────────────

const HangingPanel: React.FC = () => {
  const [examId, setExamId] = useState('EX-20260718-001')
  const [modality, setModality] = useState('CT')
  const [bodyPart, setBodyPart] = useState('CHEST')
  const [seriesText, setSeriesText] = useState(SAMPLE_SERIES)
  const [doctorId, setDoctorId] = useState('')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [recommendation, setRecommendation] = useState<HangingRecommendation | null>(null)
  const [applications, setApplications] = useState<HangingApplication[]>([])

  const loadApplications = useCallback(async () => {
    try {
      const res = await aiV2Api.listHangingApplications()
      if (res.success && Array.isArray(res.data)) setApplications(res.data)
    } catch (err) {
      console.error('[AiV2] applications failed:', err)
    }
  }, [])

  useEffect(() => {
    void loadApplications()
  }, [loadApplications])

  const handleRecommend = useCallback(async () => {
    setLoading(true)
    try {
      const series = seriesText
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((description) => ({ description }))
      const res = await aiV2Api.recommendHanging({
        examId: examId.trim() || undefined,
        modality,
        bodyPart,
        series: series.length > 0 ? series : undefined,
        doctorId: doctorId.trim() || undefined,
      })
      if (res.success && res.data) {
        setRecommendation(res.data)
        message.success(t('w9d.aiEnhanced.recommendedLayout', { name: res.data.name }))
      } else {
        message.error(res.error?.message || t('aiEnhanced.recommendFailed'))
      }
    } catch (err) {
      console.error('[AiV2] recommend failed:', err)
      message.error(t('aiEnhanced.recommendRequestFailed'))
    } finally {
      setLoading(false)
    }
  }, [examId, modality, bodyPart, seriesText, doctorId])

  const handleApply = useCallback(async () => {
    if (!recommendation) return
    setApplying(true)
    try {
      const res = await aiV2Api.applyHanging({
        examId: examId.trim() || recommendation.layoutId,
        layoutId: recommendation.layoutId,
        appliedBy: doctorId.trim() || 'D1001',
      })
      if (res.success && res.data) {
        message.success(t('w9d.aiEnhanced.layoutApplied', { name: res.data.layoutName, rows: res.data.rows, cols: res.data.cols }))
        setRecommendation(null)
        await loadApplications()
      } else {
        message.error(res.error?.message || t('aiEnhanced.applyFailed'))
      }
    } catch (err) {
      console.error('[AiV2] apply failed:', err)
      message.error(t('aiEnhanced.applyRequestFailed'))
    } finally {
      setApplying(false)
    }
  }, [recommendation, examId, doctorId, loadApplications])

  return (
    <Card
      title={<Space><LayoutGrid size={16} color="var(--color-primary-600)" />{t('aiEnhanced.hangingTitle')}</Space>}
      extra={<Tag color="blue">{t('aiEnhanced.hangingTag')}</Tag>}
    >
      <Space wrap style={{ marginBottom: 8 }}>
        <Input value={examId} onChange={(e) => setExamId(e.target.value)} placeholder={t('aiEnhanced.examId')} style={{ width: 160 }} />
        <Select value={modality} onChange={setModality} options={MODALITIES.map((m) => ({ value: m, label: m }))} style={{ width: 90 }} />
        <Select value={bodyPart} onChange={setBodyPart} options={BODY_PARTS.map((b) => ({ value: b.value, label: t(b.label) }))} style={{ width: 110 }} />
        <Input
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
          placeholder={t('aiEnhanced.doctorIdPlaceholder')}
          style={{ width: 170 }}
        />
      </Space>
      <Input
        value={seriesText}
        onChange={(e) => setSeriesText(e.target.value)}
        placeholder={t('aiEnhanced.seriesPlaceholder')}
        style={{ marginBottom: 8 }}
      />
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<Sparkles size={14} />} onClick={handleRecommend} loading={loading}>
          {loading ? t('aiEnhanced.recommending') : t('aiEnhanced.recommendLayout')}
        </Button>
      </Space>

      {recommendation && (
        <>
          <Divider />
          <Card size="small" type="inner" title={
            <Space>
              <Text strong>{recommendation.name}</Text>
              <Tag color={recommendation.source === 'history' ? 'purple' : 'blue'}>
                {recommendation.source === 'history' ? t('aiEnhanced.historyPreference') : t('aiEnhanced.ruleMatch')}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>{recommendation.rows}×{recommendation.cols} · {t('aiEnhanced.score')} {recommendation.score}</Text>
            </Space>
          }>
            <div
              data-testid="ai-v2-hanging-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${recommendation.cols}, 1fr)`,
                gap: 6,
                marginBottom: 10,
              }}
            >
              {recommendation.cells.map((cell) => (
                <div
                  key={cell.index}
                  style={{
                    border: '1px dashed var(--color-primary-600)',
                    background: '#e8f1ff',
                    borderRadius: 6,
                    height: 52,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: 'var(--color-primary-600)',
                    overflow: 'hidden',
                  }}
                >
                  <Text style={{ fontSize: 12 }}>{cell.label}</Text>
                  {cell.windowWidth != null && cell.windowCenter != null && (
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      W{cell.windowWidth}/C{cell.windowCenter}
                    </Text>
                  )}
                </div>
              ))}
            </div>

            <List
              size="small"
              dataSource={recommendation.reasons}
              renderItem={(r) => (
                <List.Item style={{ padding: '2px 0', borderBottom: 'none' }}>
                  <Text style={{ fontSize: 12 }}>· {r}</Text>
                </List.Item>
              )}
            />

            {recommendation.alternatives.length > 0 && (
              <Space wrap style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('aiEnhanced.alternatives')}</Text>
                {recommendation.alternatives.map((alt) => (
                  <Tag key={alt.layoutId} style={{ fontSize: 12 }}>{alt.name}</Tag>
                ))}
              </Space>
            )}

            <Divider style={{ margin: '12px 0' }} />
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                type="primary"
                icon={<Check size={14} />}
                loading={applying}
                onClick={handleApply}
              >
                {t('aiEnhanced.applyLayout')}
              </Button>
            </Space>
          </Card>
        </>
      )}

      <Divider titlePlacement="left" plain style={{ margin: '16px 0 8px' }}>
        <Space size={6}><History size={13} color="var(--color-primary-600)" /><Text type="secondary" style={{ fontSize: 12 }}>{t('aiEnhanced.applyHistory')}</Text></Space>
      </Divider>
      <DataTable<HangingApplication>
        rowKey="id"
        dataSource={applications}
        pagination={{ pageSize: 5, showSizeChanger: false }}
        columns={[
          { title: t('aiEnhanced.examId'), dataIndex: 'examId', width: 160 },
          { title: t('aiEnhanced.layout'), dataIndex: 'layoutName', ellipsis: true },
          { title: t('aiEnhanced.grid'), dataIndex: 'layoutId', width: 80, render: (_, r) => <Tag>{r.rows}×{r.cols}</Tag> },
          { title: t('aiEnhanced.appliedBy'), dataIndex: 'appliedBy', width: 100 },
          { title: t('aiEnhanced.time'), dataIndex: 'appliedAt', width: 180, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
        ]}
      />
    </Card>
  )
}

// ── 页面 ─────────────────────────────────────────────────────────────────────

const AiEnhancedPage: React.FC = () => {
  return (
    <PageContainer padding={24}>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap align="center" style={{ marginBottom: 8 }}>
          <Brain size={26} color="var(--color-primary-600)" />
          <Title level={4} style={{ margin: 0 }}>{t('aiEnhanced.title')}</Title>
          <Tag color="blue">v3.0.6.11-101 Wave 3C</Tag>
          <Tag color="green">{t('aiEnhanced.tagOrgan')}</Tag>
          <Tag color="green">{t('aiEnhanced.tagDraft')}</Tag>
          <Tag color="green">{t('aiEnhanced.tagHanging')}</Tag>
        </Space>
        <Text type="secondary">
          {t('aiEnhanced.pageDescription')}
        </Text>
      </Card>

      <Row gutter={16}>
        <Col xs={24} xl={12} style={{ marginBottom: 16 }}>
          <OrganDetectionPanel />
        </Col>
        <Col xs={24} xl={12} style={{ marginBottom: 16 }}>
          <DraftScorePanel />
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} xl={16}>
          <HangingPanel />
        </Col>
        <Col xs={24} xl={8}>
          <Card title={<Space><Activity size={16} color="var(--color-primary-600)" />{t('aiEnhanced.workbenchNotes')}</Space>} size="small">
            <List
              size="small"
              split={false}
              dataSource={[
                t('aiEnhanced.note1'),
                t('aiEnhanced.note2'),
                t('aiEnhanced.note3'),
                t('aiEnhanced.note4'),
                t('aiEnhanced.note5'),
              ]}
              renderItem={(item) => (
                <List.Item style={{ borderBottom: 'none', padding: '4px 0' }}>
                  <Text style={{ fontSize: 12 }}>· {item}</Text>
                </List.Item>
              )}
            />
            <Divider style={{ margin: '8px 0' }} />
            <Space size={6}>
              <FileText size={13} color="var(--color-primary-600)" />
              <Text type="secondary" style={{ fontSize: 12 }}>{t('aiEnhanced.endpoint')}: /api/ai-v2/* (organ-detection / draft-score / smart-hanging)</Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  )
}

export default AiEnhancedPage
