/**
 * G005 放射RIS系统 v3.0.6.11-60 - 相似病例检索
 * 对标 Siemens Similar Patient Search / Infinitt Enterprise Search
 * 输入报告文本/报告 + 模态/部位 → 返回 Top 10 相似病例 (Jaccard + 特征 + SNOMED)
 */
import React, { useState, useCallback } from 'react'
import {
  Card, Input, Select, Button, Tag, Space, Row, Col, Typography, Progress,
  Empty, Spin, Alert, Modal, message, Descriptions, Divider,
} from 'antd'
import { Search, Brain, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react'
import { similarCaseApi, type SimilarCaseResult } from '../../services/api'

const { Text, Title } = Typography
const { TextArea } = Input

const MODALITIES = ['CT', 'MR', 'DX', 'MG', 'US', 'PET-CT', 'DSA']
const BODY_PARTS = ['胸部', '颅脑', '腹部', '盆腔', '脊柱', '膝关节', '乳腺', '甲状腺', '上肢', '下肢']
const DEMO_REPORTS = ['rpt-1001', 'rpt-1002', 'rpt-1007', 'rpt-1010', 'rpt-1015', 'rpt-1023']

const modalityColors: Record<string, string> = {
  CT: 'cyan', MR: 'purple', DX: 'orange', MG: 'pink', US: 'blue', 'PET-CT': 'red', DSA: 'geekblue',
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
      message.warning('请输入报告文本或选择报告')
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
        setError('检索服务返回异常')
      }
    } catch {
      setError('相似病例检索失败,请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [reportText, reportId, modality, bodyPart])

  const handleFeedback = useCallback(async (c: SimilarCaseResult, useful: boolean) => {
    const sourceReportId = reportId ?? 'text-input'
    setFeedbackMap((m) => ({ ...m, [c.reportId]: useful ? 'useful' : 'useless' }))
    try {
      const res = await similarCaseApi.feedback({ reportId: sourceReportId, targetReportId: c.reportId, useful })
      message.success(res.success ? '感谢反馈' : '反馈提交失败')
    } catch {
      message.error('反馈提交失败')
    }
  }, [reportId])

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Brain size={22} color="#7c3aed" />
        <div>
          <Title level={4} style={{ margin: 0 }}>相似病例检索</Title>
          <Text type="secondary">基于报告语义相似度 + 检查特征 (Jaccard / 模态 / 部位 / SNOMED) — 对标 Siemens Similar Patient Search</Text>
        </div>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space wrap>
            <Select
              placeholder="选报告 (演示)" allowClear style={{ width: 200 }}
              value={reportId}
              onChange={(v) => { setReportId(v); if (v) setReportText('') }}
              options={DEMO_REPORTS.map((r) => ({ label: r, value: r }))}
            />
            <Select
              placeholder="模态" allowClear style={{ width: 120 }}
              value={modality} onChange={setModality}
              options={MODALITIES.map((m) => ({ label: m, value: m }))}
            />
            <Select
              placeholder="部位" allowClear style={{ width: 130 }}
              value={bodyPart} onChange={setBodyPart}
              options={BODY_PARTS.map((b) => ({ label: b, value: b }))}
            />
            <Button type="primary" icon={<Search size={14} />} loading={loading} onClick={handleSearch}>
              检索相似病例
            </Button>
          </Space>
          <TextArea
            rows={4}
            placeholder="粘贴/输入报告文本,例如: 右肺上叶见磨玻璃密度结节,大小约 8mm,边界清晰,考虑早期肺腺癌可能…"
            value={reportText}
            onChange={(e) => { setReportText(e.target.value); if (e.target.value) setReportId(undefined) }}
          />
        </Space>
      </Card>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" indicator={<Loader2 className="animate-spin" style={{ fontSize: 28 }} />} />
          <div style={{ marginTop: 12 }}><Text type="secondary">正在检索相似病例…</Text></div>
        </div>
      ) : results.length === 0 ? (
        searched ? <Empty description="未找到相似病例,请调整报告文本或筛选条件" style={{ padding: 40 }} /> : <Empty description="输入报告文本后开始检索" style={{ padding: 40 }} />
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">共返回 <Text strong>{results.length}</Text> 个相似病例,按综合评分排序 (文本 50% + 特征 30% + SNOMED 20%)</Text>
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
                      <Tag color="default">{c.gender}{c.age}岁</Tag>
                      {c.source === 'demo' && <Tag color="gold" style={{ fontSize: 10 }}>演示库</Tag>}
                    </Space>
                  }
                  extra={<Text type="secondary" style={{ fontSize: 11 }}>{c.studyDate}</Text>}
                  actions={[
                    <Button key="f1" type="text" size="small" icon={<ThumbsUp size={13} />}
                      disabled={feedbackMap[c.reportId] === 'useless'}
                      onClick={(e) => { e.stopPropagation(); handleFeedback(c, true) }}>
                      有用
                    </Button>,
                    <Button key="f2" type="text" size="small" icon={<ThumbsDown size={13} />}
                      disabled={feedbackMap[c.reportId] === 'useful'}
                      onClick={(e) => { e.stopPropagation(); handleFeedback(c, false) }}>
                      无用
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
                    文本 {Math.round(c.textScore * 100)}% · 特征 {Math.round(c.featureScore * 100)}% · SNOMED {Math.round(c.snomedScore * 100)}%
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </>
      )}

      <Modal
        open={!!detail}
        title={detail ? `相似病例详情 ${detail.reportId}` : ''}
        footer={null}
        width={720}
        onCancel={() => setDetail(null)}
      >
        {detail && (
          <div>
            <Descriptions size="small" column={3} bordered>
              <Descriptions.Item label="模态">{detail.modality}</Descriptions.Item>
              <Descriptions.Item label="部位">{detail.bodyPart}</Descriptions.Item>
              <Descriptions.Item label="性别/年龄">{detail.gender} / {detail.age}岁</Descriptions.Item>
              <Descriptions.Item label="检查日期">{detail.studyDate}</Descriptions.Item>
              <Descriptions.Item label="相似度">
                <Tag color="blue">{detail.similarity}%</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="匹配关键词">
                {detail.keywords.map((k) => <Tag key={k} color="gold" style={{ marginBottom: 2 }}>{k}</Tag>)}
              </Descriptions.Item>
            </Descriptions>
            <Divider>影像所见</Divider>
            <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{highlight(detail.findings, detail.keywords)}</p>
            <Divider>诊断意见</Divider>
            <p style={{ lineHeight: 1.8 }}>{highlight(detail.impression, detail.keywords)}</p>
            {detail.conclusion && (
              <>
                <Divider>结论</Divider>
                <p style={{ lineHeight: 1.8 }}><Tag color="purple">{detail.conclusion}</Tag></p>
              </>
            )}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>报告已匿名化处理,不包含患者姓名及身份信息</Text>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default SimilarCasePage
