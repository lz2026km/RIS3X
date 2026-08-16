/**
 * G005 RIS v3.0.6.11-101 Wave 3C - AI 增强工作台
 * 三面板: 多器官自动检出 (置信度条 + 体积 + 一键生成报告段落) /
 *         报告草稿评分 (总分 + 维度条形 + 改进建议) /
 *         智能挂片 (推荐布局卡片 + 应用按钮 + 应用记录)
 * 后端: /api/ai-v2/* (real 模式); dev mock 模式下无 MSW handler 时回退展示空态
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card, Row, Col, Button, Select, Input, Tag, Space, Typography, message, Progress, Statistic,
  Divider, List, Empty, Alert, Table, Tooltip,
} from 'antd'
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

const { Text, Title } = Typography
const { TextArea } = Input

const MODALITIES = ['CT', 'MR', 'DR', 'US', 'MG', 'NM']
const BODY_PARTS = [
  { value: 'CHEST', label: '胸部' },
  { value: 'ABDOMEN', label: '腹部' },
  { value: 'HEAD', label: '头颅' },
  { value: 'NECK', label: '颈部' },
  { value: 'SPINE', label: '脊柱' },
  { value: 'KNEE', label: '膝关节' },
  { value: 'CARDIAC', label: '心脏' },
  { value: 'PELVIS', label: '盆腔' },
]

const GRADE_COLORS: Record<string, string> = { 优: 'green', 良: 'blue', 中: 'orange', 差: 'red' }
const LEVEL_COLORS: Record<string, string> = { error: 'red', warning: 'orange', info: 'blue' }
const LEVEL_LABELS: Record<string, string> = { error: '错误', warning: '警告', info: '提示' }

function scoreColor(score: number): string {
  if (score >= 90) return '#52c41a'
  if (score >= 75) return '#2563eb'
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
    if (!studyId.trim()) { message.warning('请输入检查号'); return }
    setLoading(true)
    setResult(null)
    setParagraph('')
    try {
      const res = await aiV2Api.analyzeOrgans({ studyId: studyId.trim(), modality, bodyPart })
      if (res.success && res.data) {
        setResult(res.data)
        message.success(`检出 ${res.data.organsDetected} 个器官`)
      } else {
        message.error(res.error?.message || '检出失败')
      }
    } catch (err) {
      console.error('[AiV2] analyze organs failed:', err)
      message.error('检出请求失败')
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
        message.success('报告段落已生成')
      } else {
        message.error(res.error?.message || '段落生成失败')
      }
    } catch (err) {
      console.error('[AiV2] paragraph failed:', err)
      message.error('段落生成失败')
    } finally {
      setParagraphLoading(false)
    }
  }, [result])

  const handleCopy = useCallback(async () => {
    if (!paragraph) return
    try {
      await navigator.clipboard.writeText(paragraph)
      setParagraphCopied(true)
      message.success('已复制到剪贴板')
      window.setTimeout(() => setParagraphCopied(false), 1500)
    } catch {
      message.warning('复制失败, 请手动选择复制')
    }
  }, [paragraph])

  const detected = useMemo(() => (result?.organs ?? []).filter((o) => o.status === 'detected'), [result])

  return (
    <Card
      title={<Space><ScanSearch size={16} color="#2563eb" />多器官自动检出</Space>}
      extra={<Tag color="blue">器官 8 类 · 灰度特征推理</Tag>}
    >
      <Space wrap style={{ marginBottom: 12 }}>
        <Input
          value={studyId}
          onChange={(e) => setStudyId(e.target.value)}
          placeholder="检查号 studyId"
          style={{ width: 190 }}
        />
        <Select value={modality} onChange={setModality} options={MODALITIES.map((m) => ({ value: m, label: m }))} style={{ width: 90 }} />
        <Select
          value={bodyPart}
          onChange={setBodyPart}
          options={BODY_PARTS.map((b) => ({ value: b.value, label: b.label }))}
          style={{ width: 110 }}
        />
        <Button type="primary" icon={<ScanSearch size={14} />} onClick={handleAnalyze} loading={loading}>
          {loading ? '分析中...' : '自动检出'}
        </Button>
      </Space>

      {!result && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary">输入检查号并选择部位, 模拟 AI 多器官检出 (确定性灰度统计特征推理, 非随机)</Text>
          }
        />
      )}

      {result && (
        <>
          <Row gutter={12} style={{ marginBottom: 12 }}>
            <Col span={8}>
              <Statistic title="检出器官" value={result.organsDetected} suffix={`/ ${result.organs.length}`} />
            </Col>
            <Col span={8}>
              <Statistic title="平均置信度" value={Math.round(result.avgConfidence * 100)} suffix="%" />
            </Col>
            <Col span={8}>
              <Statistic title="主要器官" value={result.primaryOrgan ? result.organs.find((o) => o.code === result.primaryOrgan)?.label ?? '-' : '-'} />
            </Col>
          </Row>

          <List
            size="small"
            dataSource={result.organs}
            renderItem={(organ) => (
              <List.Item
                actions={[
                  <Tag key="status" color={organ.status === 'detected' ? 'green' : 'default'}>
                    {organ.status === 'detected' ? '已检出' : '低置信'}
                  </Tag>,
                ]}
              >
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Space>
                      <CircleDot size={14} color={organ.status === 'detected' ? '#2563eb' : '#bfbfbf'} />
                      <Text strong>{organ.label}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        体积约 {organ.volumeMl}mL · 覆盖 {organ.slices} 层
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
                  <Tooltip title={`边界框 x=${organ.bbox.x} y=${organ.bbox.y} ${organ.bbox.width}×${organ.bbox.height}`}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{organ.featureNote}</Text>
                  </Tooltip>
                </div>
              </List.Item>
            )}
          />

          <Divider style={{ margin: '12px 0' }} />
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>AI 检出结果仅供医师参考, 请结合原始图像复核</Text>
            <Button
              type="primary"
              ghost
              icon={<Wand2 size={14} />}
              loading={paragraphLoading}
              disabled={detected.length === 0}
              onClick={handleParagraph}
            >
              一键生成报告段落
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
                      {paragraphCopied ? '已复制' : '复制'}
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
    if (!draftText.trim()) { message.warning('请输入报告草稿'); return }
    setLoading(true)
    try {
      const res = await aiV2Api.scoreDraft({ draftText, modality })
      if (res.success && res.data) {
        setResult(res.data)
        message.success(`评分完成: ${res.data.score} 分 (${res.data.grade})`)
      } else {
        message.error(res.error?.message || '评分失败')
      }
    } catch (err) {
      console.error('[AiV2] draft score failed:', err)
      message.error('评分请求失败')
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
      title={<Space><Gauge size={16} color="#2563eb" />报告草稿评分</Space>}
      extra={<Tag color="blue">0-100 分 · 确定性规则</Tag>}
    >
      <Space wrap style={{ marginBottom: 8 }}>
        <Select value={modality} onChange={setModality} options={MODALITIES.map((m) => ({ value: m, label: m }))} style={{ width: 90 }} />
        <Button size="small" onClick={() => fillSample(SAMPLE_DRAFT_GOOD)}>填入规范示例</Button>
        <Button size="small" onClick={() => fillSample(SAMPLE_DRAFT_BAD)}>填入反例</Button>
      </Space>
      <TextArea
        value={draftText}
        onChange={(e) => setDraftText(e.target.value)}
        rows={8}
        placeholder="粘贴报告草稿: 按 检查技术/影像所见/诊断意见 分段..."
        style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}
      />
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>{draftText.length} 字符</Text>
        <Button type="primary" icon={<Gauge size={14} />} onClick={handleScore} loading={loading} disabled={!draftText.trim()}>
          {loading ? '评分中...' : '开始评分'}
        </Button>
      </Space>

      {result && (
        <>
          <Divider />
          <Row gutter={16} align="middle">
            <Col span={10}>
              <Statistic
                title="综合评分"
                value={result.score}
                suffix="/ 100"
                styles={{ content: { color: scoreColor(result.score), fontSize: 30 } }}
              />
              <Tag color={GRADE_COLORS[result.grade] ?? 'default'} style={{ marginTop: 8 }}>等级: {result.grade}</Tag>
            </Col>
            <Col span={14}>
              <Progress percent={result.score} strokeColor={scoreColor(result.score)} showInfo={false} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                共 {result.stats.charCount} 字 · {result.stats.sectionCount}/3 个结构段 · {result.stats.numericCount} 个数值
              </Text>
            </Col>
          </Row>

          <Divider titlePlacement="left" plain style={{ margin: '12px 0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>维度评分</Text>
          </Divider>
          {result.dimensions.map((d) => (
            <div key={d.key} style={{ marginBottom: 8 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13 }}>{d.label}</Text>
                <Space size={4}>
                  <Text type="secondary" style={{ fontSize: 12 }}>权重 {(d.weight * 100).toFixed(0)}%</Text>
                  <Text strong style={{ color: scoreColor(d.score), fontSize: 13 }}>{d.score}</Text>
                </Space>
              </Space>
              <Progress percent={d.score} strokeColor={scoreColor(d.score)} showInfo={false} size="small" />
            </div>
          ))}

          <Divider titlePlacement="left" plain style={{ margin: '12px 0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>改进建议 ({result.suggestions.length})</Text>
          </Divider>
          {result.suggestions.length === 0 ? (
            <Alert type="success" showIcon message="草稿质量良好, 无需改进" />
          ) : (
            <List
              size="small"
              dataSource={result.suggestions}
              renderItem={(s) => (
                <List.Item style={{ alignItems: 'flex-start' }}>
                  <Space align="start" size={8}>
                    <Tag color={LEVEL_COLORS[s.level] ?? 'blue'} style={{ marginTop: 2 }}>{LEVEL_LABELS[s.level] ?? s.level}</Tag>
                    <Text style={{ fontSize: 13 }}>{s.message}</Text>
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
        message.success(`推荐布局: ${res.data.name}`)
      } else {
        message.error(res.error?.message || '推荐失败')
      }
    } catch (err) {
      console.error('[AiV2] recommend failed:', err)
      message.error('推荐请求失败')
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
        message.success(`已应用布局「${res.data.layoutName}」(${res.data.rows}×${res.data.cols})`)
        setRecommendation(null)
        await loadApplications()
      } else {
        message.error(res.error?.message || '应用失败')
      }
    } catch (err) {
      console.error('[AiV2] apply failed:', err)
      message.error('应用请求失败')
    } finally {
      setApplying(false)
    }
  }, [recommendation, examId, doctorId, loadApplications])

  return (
    <Card
      title={<Space><LayoutGrid size={16} color="#2563eb" />智能挂片协议</Space>}
      extra={<Tag color="blue">规则表 · 历史偏好</Tag>}
    >
      <Space wrap style={{ marginBottom: 8 }}>
        <Input value={examId} onChange={(e) => setExamId(e.target.value)} placeholder="检查号" style={{ width: 160 }} />
        <Select value={modality} onChange={setModality} options={MODALITIES.map((m) => ({ value: m, label: m }))} style={{ width: 90 }} />
        <Select value={bodyPart} onChange={setBodyPart} options={BODY_PARTS.map((b) => ({ value: b.value, label: b.label }))} style={{ width: 110 }} />
        <Input
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
          placeholder="医生 ID (历史偏好, 可选)"
          style={{ width: 170 }}
        />
      </Space>
      <Input
        value={seriesText}
        onChange={(e) => setSeriesText(e.target.value)}
        placeholder="序列描述, 逗号分隔 (如: 肺窗, 纵隔窗)"
        style={{ marginBottom: 8 }}
      />
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<Sparkles size={14} />} onClick={handleRecommend} loading={loading}>
          {loading ? '推荐中...' : '推荐布局'}
        </Button>
      </Space>

      {recommendation && (
        <>
          <Divider />
          <Card size="small" type="inner" title={
            <Space>
              <Text strong>{recommendation.name}</Text>
              <Tag color={recommendation.source === 'history' ? 'purple' : 'blue'}>
                {recommendation.source === 'history' ? '历史偏好' : '规则匹配'}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>{recommendation.rows}×{recommendation.cols} · 得分 {recommendation.score}</Text>
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
                    border: '1px dashed #2563eb',
                    background: '#e8f1ff',
                    borderRadius: 6,
                    height: 52,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: '#2563eb',
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
                <Text type="secondary" style={{ fontSize: 12 }}>备选布局:</Text>
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
                应用此布局
              </Button>
            </Space>
          </Card>
        </>
      )}

      <Divider titlePlacement="left" plain style={{ margin: '16px 0 8px' }}>
        <Space size={6}><History size={13} color="#2563eb" /><Text type="secondary" style={{ fontSize: 12 }}>布局应用记录</Text></Space>
      </Divider>
      <Table<HangingApplication>
        size="small"
        rowKey="id"
        dataSource={applications}
        pagination={{ pageSize: 5, showSizeChanger: false }}
        columns={[
          { title: '检查号', dataIndex: 'examId', width: 160 },
          { title: '布局', dataIndex: 'layoutName', ellipsis: true },
          { title: '网格', dataIndex: 'layoutId', width: 80, render: (_, r) => <Tag>{r.rows}×{r.cols}</Tag> },
          { title: '应用人', dataIndex: 'appliedBy', width: 100 },
          { title: '时间', dataIndex: 'appliedAt', width: 180, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
        ]}
      />
    </Card>
  )
}

// ── 页面 ─────────────────────────────────────────────────────────────────────

const AiEnhancedPage: React.FC = () => {
  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f5f5f5' }}>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap align="center" style={{ marginBottom: 8 }}>
          <Brain size={26} color="#2563eb" />
          <Title level={4} style={{ margin: 0 }}>AI 增强工作台</Title>
          <Tag color="blue">v3.0.6.11-101 Wave 3C</Tag>
          <Tag color="green">多器官检出</Tag>
          <Tag color="green">草稿评分</Tag>
          <Tag color="green">智能挂片</Tag>
        </Space>
        <Text type="secondary">
          多器官自动检出 (8 类器官, 灰度统计特征确定性推理) + 报告草稿质量评分 (0-100 分 + 改进建议) + 智能挂片协议 (规则表 + 医生历史偏好)
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
          <Card title={<Space><Activity size={16} color="#2563eb" />工作台说明</Space>} size="small">
            <List
              size="small"
              split={false}
              dataSource={[
                '检出基于灰度统计特征 (均值/标准差 → HU 窗拟合 + 对比度拟合), 同一输入恒定输出, 无随机',
                '草稿评分四维度: 长度 15% / 结构 25% / 术语 30% / 数值单位 30%',
                '挂片规则: CT 胸→肺窗+纵隔窗 2×2, MR 头→T1/T2/FLAIR 2×3, 未知类型兜底 1×1',
                '医生对同部位应用过的布局将在下次推荐时优先 (历史偏好)',
                '孤儿模块: 无数据库依赖, 应用记录内存存储 + seed 回退',
              ]}
              renderItem={(item) => (
                <List.Item style={{ borderBottom: 'none', padding: '4px 0' }}>
                  <Text style={{ fontSize: 12 }}>· {item}</Text>
                </List.Item>
              )}
            />
            <Divider style={{ margin: '8px 0' }} />
            <Space size={6}>
              <FileText size={13} color="#2563eb" />
              <Text type="secondary" style={{ fontSize: 12 }}>端点: /api/ai-v2/* (organ-detection / draft-score / smart-hanging)</Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default AiEnhancedPage
