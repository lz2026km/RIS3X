import { v3AiPlatformApi } from '../../services/api/v3Api'
import { Card, Input, Button, Space, Tag, Typography, message, Row, Col, Statistic, Spin, Divider, Empty, Progress } from 'antd'
import { Shield, CheckCircle, AlertTriangle, FileText, Brain, ThumbsUp } from 'lucide-react'
import React, { useState, useCallback } from 'react'
import { Inbox } from 'lucide-react'
import { t } from '../../i18n/appI18n'
import { PageContainer } from '../../components/common'

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
    if (!reportText.trim()) { message.warning(t('aiReviewPage.enterText')); return }
    setLoading(true)
    try {
      const res = await v3AiPlatformApi.review({
        reportText,
        findings: findings.trim() || reportText,
        conclusion: conclusion.trim() || reportText,
      })
      if (res.success && res.data) {
        const d = res.data as any
        setResult({
          overallScore: d.overallScore ?? 0,
          issues: (Array.isArray(d.issues) ? d.issues : []).map((i: any) => ({
            category: i.severity === 'error' ? t('aiReviewPage.severityError') : i.severity === 'warning' ? t('aiReviewPage.severityWarning') : t('aiReviewPage.severityInfo'),
            severity: i.severity ?? 'info',
            message: i.message ?? '',
            suggestion: i.suggestion ?? '',
          })),
          suggestions: Array.isArray(d.suggestions) ? d.suggestions : [],
          summary: d.summary ?? '',
        })
        message.success(t('aiReviewPage.reviewDone'))
      } else {
        message.error(res.error?.message || t('aiReviewPage.reviewFailed'))
      }
    } catch (err) { console.error('[AiReview] review failed:', err); message.error(t('aiReviewPage.requestFailed')) } finally {
      setLoading(false)
    }
  }, [reportText, findings, conclusion])

  const severityColor = (s: string) => {
    if (s === 'error') return 'red'
    if (s === 'warning') return 'orange'
    return 'blue'
  }

  const severityLabel = (s: string) => {
    if (s === 'error') return t('aiReviewPage.severityError')
    if (s === 'warning') return t('aiReviewPage.severityWarning')
    return t('aiReviewPage.severityInfo')
  }

  const scoreColor = (score: number) => {
    if (score >= 90) return '#52c41a'
    if (score >= 70) return '#faad14'
    return '#ff4d4f'
  }

  return (
    <PageContainer padding={24}>
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Shield size={24} color="#2563eb" />
          <Title level={4} style={{ margin: 0 }}>{t('aiReviewPage.title')}</Title>
          <Tag color="blue">{t('aiReviewPage.qualityControl')}</Tag>
        </Space>
        <Text type="secondary">{t('aiReviewPage.description')}</Text>
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          <Card
            title={<Space><FileText size={14} color="#2563eb" />{t('aiReviewPage.reportText')}</Space>}
            extra={
              <Button type="primary" icon={<Shield size={14} />} onClick={handleReview} loading={loading} disabled={!reportText.trim()}>
                {loading ? t('aiReviewPage.reviewing') : t('aiReviewPage.startReview')}
              </Button>
            }
          >
            <TextArea
              value={reportText}
              onChange={e => setReportText(e.target.value)}
              rows={12}
              placeholder={t('aiReviewPage.placeholder')}
              style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}
            />
            {/* [G005 W1-Controls P1-9] 检查所见 / 诊断意见 (独立输入, 参与 AI 审核) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <Text strong style={{ fontSize: 12 }}>{t('w1Controls.aiReview.findings')}</Text>
                <TextArea
                  value={findings}
                  onChange={e => setFindings(e.target.value)}
                  rows={4}
                  placeholder={t('w1Controls.aiReview.findingsPlaceholder')}
                  style={{ marginTop: 4, fontSize: 12 }}
                />
              </div>
              <div>
                <Text strong style={{ fontSize: 12 }}>{t('w1Controls.aiReview.conclusion')}</Text>
                <TextArea
                  value={conclusion}
                  onChange={e => setConclusion(e.target.value)}
                  rows={4}
                  placeholder={t('w1Controls.aiReview.conclusionPlaceholder')}
                  style={{ marginTop: 4, fontSize: 12 }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{reportText.length} {t('aiReviewPage.charsUnit')}</Text>
              {reportText && (
                <Button size="small" onClick={() => { setReportText(''); setFindings(''); setConclusion(''); setResult(null) }}>
                  {t('aiReviewPage.clear')}
                </Button>
              )}
            </div>
          </Card>
        </Col>

        <Col span={12}>
          {loading ? (
            <Card style={{ textAlign: 'center', padding: 60 }}>
              <Spin size="large" />
              <div style={{ marginTop: 12, color: '#2563eb', fontWeight: 600 }}>{t('aiReviewPage.reviewingReport')}</div>
            </Card>
          ) : result ? (
            <>
              <Card title={<Space><Brain size={16} color="#2563eb" />{t('aiReviewPage.result')}</Space>} style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title={t('aiReviewPage.overallScore')}
                      value={result.overallScore}
                      suffix="/ 100"
                      styles={{ content: {  color: scoreColor(result.overallScore), fontSize: 30  } }}
                    />
                    <Progress
                      percent={result.overallScore}
                      strokeColor={scoreColor(result.overallScore)}
                      style={{ marginTop: 8 }}
                      showInfo={false}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic title={t('aiReviewPage.issueCount')} value={result.issues.length} styles={{ content: {  color: result.issues.length > 0 ? '#ff4d4f' : '#52c41a'  } }} />
                    <Statistic title={t('aiReviewPage.suggestionCount')} value={result.suggestions.length} style={{ marginTop: 8 }} />
                  </Col>
                </Row>
                <Divider />
                <Text strong>{t('aiReviewPage.summary')}</Text>
                <Text style={{ display: 'block', marginTop: 8 }}>{result.summary}</Text>
              </Card>

              {result.issues.length > 0 && (
                <Card title={<Space><AlertTriangle size={14} color="#faad14" />{t('aiReviewPage.foundIssues')}</Space>} size="small" style={{ marginBottom: 16 }}>
                  {result.issues.map((issue, idx) => (
                    <div key={idx} style={{ padding: '8px 0', borderBottom: idx < result.issues.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <Space>
                        <Tag color={severityColor(issue.severity)}>{severityLabel(issue.severity)}</Tag>
                        <Tag>{issue.category}</Tag>
                      </Space>
                      <div style={{ marginTop: 4, fontSize: 12 }}>{issue.message}</div>
                      <div style={{ marginTop: 2, fontSize: 12, color: '#52c41a' }}>{t('aiReviewPage.suggestion')}：{issue.suggestion}</div>
                    </div>
                  ))}
                </Card>
              )}

              {result.suggestions.length > 0 && (
                <Card title={<Space><ThumbsUp size={14} color="#52c41a" />{t('aiReviewPage.improvements')}</Space>} size="small">
                  {result.suggestions.map((s, idx) => (
                    <div key={idx} style={{ padding: '6px 0', fontSize: 12 }}>
                      <CheckCircle size={12} color="#52c41a" style={{ marginRight: 6 }} />
                      {s}
                    </div>
                  ))}
                </Card>
              )}
            </>
          ) : (
            <Card style={{ textAlign: 'center', padding: 60 }}>
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('aiReviewPage.emptyHint')} />
            </Card>
          )}
        </Col>
      </Row>
    </PageContainer>
  )
}

export default AiReviewPage
