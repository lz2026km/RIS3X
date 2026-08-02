import React, { useState, useCallback } from 'react'
import {
  Card, Input, Button, Space, Tag, Typography, message, Row, Col,
  Statistic, Spin, Divider, Empty, Rate, Tooltip, Progress,
} from 'antd'
import { Shield, CheckCircle, AlertTriangle, FileText, Clipboard, Brain, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react'
import { v3AiPlatformApi } from '../../services/api/v3Api'

const { Text, Title } = Typography
const { TextArea } = Input

interface ReviewItem {
  category: string
  severity: 'error' | 'warning' | 'info'
  message: string
  suggestion: string
}

interface ReviewResult {
  overallScore: number
  issues: ReviewItem[]
  suggestions: string[]
  summary: string
}

const AiReviewPage: React.FC = () => {
  const [reportText, setReportText] = useState('')
  const [findings, setFindings] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ReviewResult | null>(null)

  const handleReview = useCallback(async () => {
    if (!reportText.trim()) { message.warning('请输入报告文本'); return }
    setLoading(true)
    try {
      const res = await v3AiPlatformApi.review({ reportId: 'manual', content: reportText })
      if (res.success && res.data) {
        setResult(res.data)
        message.success('AI 审核完成')
      } else {
        message.error(res.error?.message || '审核失败')
      }
    } catch (err) { console.error('[AiReview] review failed:', err); message.error('审核请求失败') } finally {
      setLoading(false)
    }
  }, [reportText])

  const severityColor = (s: string) => {
    if (s === 'error') return 'red'
    if (s === 'warning') return 'orange'
    return 'blue'
  }

  const severityLabel = (s: string) => {
    if (s === 'error') return '错误'
    if (s === 'warning') return '警告'
    return '提示'
  }

  const scoreColor = (score: number) => {
    if (score >= 90) return '#52c41a'
    if (score >= 70) return '#faad14'
    return '#ff4d4f'
  }

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f5f5f5' }}>
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Shield size={24} color="#1677ff" />
          <Title level={4} style={{ margin: 0 }}>AI 报告审核</Title>
          <Tag color="blue">质量控制</Tag>
        </Space>
        <Text type="secondary">自动检测报告中的语法错误、术语不一致、逻辑矛盾等问题，提供修改建议</Text>
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          <Card
            title={<Space><FileText size={14} color="#1677ff" />报告文本</Space>}
            extra={
              <Button type="primary" icon={<Shield size={14} />} onClick={handleReview} loading={loading} disabled={!reportText.trim()}>
                {loading ? '审核中...' : '开始审核'}
              </Button>
            }
          >
            <TextArea
              value={reportText}
              onChange={e => setReportText(e.target.value)}
              rows={12}
              placeholder="输入放射科报告文本进行 AI 审核..."
              style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{reportText.length} 字符</Text>
              {reportText && (
                <Button size="small" onClick={() => { setReportText(''); setResult(null) }}>
                  清空
                </Button>
              )}
            </div>
          </Card>
        </Col>

        <Col span={12}>
          {loading ? (
            <Card style={{ textAlign: 'center', padding: 60 }}>
              <Spin size="large" />
              <div style={{ marginTop: 12, color: '#1677ff', fontWeight: 600 }}>AI 正在审核报告...</div>
            </Card>
          ) : result ? (
            <>
              <Card title={<Space><Brain size={16} color="#1677ff" />审核结果</Space>} style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="综合评分"
                      value={result.overallScore}
                      suffix="/ 100"
                      styles={{ content: {  color: scoreColor(result.overallScore), fontSize: 28  } }}
                    />
                    <Progress
                      percent={result.overallScore}
                      strokeColor={scoreColor(result.overallScore)}
                      style={{ marginTop: 8 }}
                      showInfo={false}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic title="问题数" value={result.issues.length} styles={{ content: {  color: result.issues.length > 0 ? '#ff4d4f' : '#52c41a'  } }} />
                    <Statistic title="建议数" value={result.suggestions.length} style={{ marginTop: 8 }} />
                  </Col>
                </Row>
                <Divider />
                <Text strong>审核摘要：</Text>
                <Text style={{ display: 'block', marginTop: 8 }}>{result.summary}</Text>
              </Card>

              {result.issues.length > 0 && (
                <Card title={<Space><AlertTriangle size={14} color="#faad14" />发现的问题</Space>} size="small" style={{ marginBottom: 16 }}>
                  {result.issues.map((issue, idx) => (
                    <div key={idx} style={{ padding: '8px 0', borderBottom: idx < result.issues.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <Space>
                        <Tag color={severityColor(issue.severity)}>{severityLabel(issue.severity)}</Tag>
                        <Tag>{issue.category}</Tag>
                      </Space>
                      <div style={{ marginTop: 4, fontSize: 13 }}>{issue.message}</div>
                      <div style={{ marginTop: 2, fontSize: 12, color: '#52c41a' }}>建议：{issue.suggestion}</div>
                    </div>
                  ))}
                </Card>
              )}

              {result.suggestions.length > 0 && (
                <Card title={<Space><ThumbsUp size={14} color="#52c41a" />改进建议</Space>} size="small">
                  {result.suggestions.map((s, idx) => (
                    <div key={idx} style={{ padding: '6px 0', fontSize: 13 }}>
                      <CheckCircle size={12} color="#52c41a" style={{ marginRight: 6 }} />
                      {s}
                    </div>
                  ))}
                </Card>
              )}
            </>
          ) : (
            <Card style={{ textAlign: 'center', padding: 60 }}>
              <Empty description="输入报告文本后点击开始审核" />
            </Card>
          )}
        </Col>
      </Row>
    </div>
  )
}

export default AiReviewPage
