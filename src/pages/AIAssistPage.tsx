/**
 * G005 v3.0.6.11-75 W3-1 - AI 辅助助手页
 * 输入临床描述 → 生成报告草稿(所见/结论) → 复制到报告; 历史记录; loading/error
 */
import { aiDraftApi, type AiReportDraft, type ReportDraftStyle } from '../services/api/aiDraftApi'
import {
  Card, Form, Input, Select, Segmented, Button, Space, Typography, Tag, Spin,
  Alert, message, List, Empty, Progress, Divider, Row, Col, Statistic, Tooltip,
} from 'antd'
import { Sparkles, Copy, Check, History, RefreshCw, FileText, ClipboardPaste, BrainCircuit } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { Inbox } from 'lucide-react'

const { Text, Paragraph } = Typography

const MODALITY_OPTIONS = [
  { label: 'CT', value: 'CT' },
  { label: 'MR', value: 'MR' },
  { label: 'DR', value: 'DR' },
  { label: 'US', value: 'US' },
  { label: 'MG', value: 'MG' },
  { label: 'DSA', value: 'DSA' },
]

const BODYPART_OPTIONS = ['头部', '胸部', '腹部', '盆腔', '脊柱', '四肢关节', '乳腺', '颈部', '血管'].map((b) => ({ label: b, value: b }))

interface HistoryItem {
  id: string
  reportId: string
  style: ReportDraftStyle
  createdAt: string
  modality: string
  bodyPart: string
}

const AIAssistPage: React.FC = () => {
  const [form] = Form.useForm()
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState<AiReportDraft | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(false)

  const loadDraft = useCallback(async (reportId: string) => {
    setLoadingHistory(true)
    setError('')
    try {
      const res = await aiDraftApi.getReportDraft(reportId)
      if (res.success) setDraft(res.data)
      else setError(res.error?.message ?? '历史草稿加载失败')
    } catch (e) {
      setError(e instanceof Error ? e.message : '历史草稿加载失败')
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    if (history.length > 0) return
    setLoadingHistory(true)
    aiDraftApi.getReportDraft('RP20260718012')
      .then((res) => {
        if (res.success && res.data) {
          setDraft(res.data)
          setHistory((prev) => prev.some((h) => h.reportId === res.data.reportId)
            ? prev
            : [{ id: res.data.id, reportId: res.data.reportId, style: res.data.style as ReportDraftStyle, createdAt: res.data.createdAt, modality: 'CT', bodyPart: '胸部' }, ...prev])
        }
      })
      .catch(() => { /* 历史不可用时不阻塞页面 */ })
      .finally(() => setLoadingHistory(false))
  }, [history.length])

  const handleGenerate = async () => {
    let values: { modality: string; bodyPart: string; clinicalInfo?: string; findings?: string; style: ReportDraftStyle }
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    setGenerating(true)
    setError('')
    const reportId = `RP${Date.now()}`
    try {
      const res = await aiDraftApi.generateReportDraft({
        reportId,
        modality: values.modality,
        bodyPart: values.bodyPart,
        clinicalInfo: values.clinicalInfo,
        findings: values.findings,
        style: values.style,
      })
      if (!res.success) {
        setError(res.error?.message ?? '生成失败,请稍后重试')
        return
      }
      setDraft(res.data)
      setHistory((prev) => [{ id: res.data.id, reportId, style: values.style, createdAt: res.data.createdAt, modality: values.modality, bodyPart: values.bodyPart }, ...prev].slice(0, 20))
      message.success('AI 草稿已生成')
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败,请检查网络后重试')
    } finally {
      setGenerating(false)
    }
  }

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      message.success('已复制到剪贴板')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      message.error('复制失败,请手动选择文本')
    }
  }

  const handleAccept = async () => {
    if (!draft) return
    try {
      const res = await aiDraftApi.acceptDraft(draft.id)
      if (res.success) {
        message.success('草稿已接受,可粘贴到报告编辑器中')
      } else {
        message.error(res.error?.message ?? '接受失败')
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '接受失败')
    }
  }

  const allText = draft ? draft.sections.map((s) => `【${s.heading}】\n${s.content}`).join('\n\n') : ''

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Sparkles size={20} color="#7c3aed" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>AI 辅助助手</span>
        <Tag color="purple">v3.0.6.11-75</Tag>
        <Tag icon={<BrainCircuit size={12} />} color="blue">deepseek-v3.0</Tag>
      </Space>

      {error && (
        <Alert
          type="error"
          showIcon
          message="操作失败"
          description={error}
          style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => setError('')}>关闭</Button>}
        />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={9}>
          <Card size="small" title="临床描述输入" extra={<Tag color="geekblue">生成式草稿</Tag>} style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical" size="small" initialValues={{ modality: 'CT', bodyPart: '胸部', style: 'standard' }}>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="modality" label="模态" rules={[{ required: true }]}>
                    <Select options={MODALITY_OPTIONS} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="bodyPart" label="检查部位" rules={[{ required: true }]}>
                    <Select options={BODYPART_OPTIONS} showSearch />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="clinicalInfo" label="临床信息" rules={[{ required: true, message: '请输入临床描述' }]}>
                <Input.TextArea rows={3} placeholder="例: 男性 65 岁,咳嗽 2 周,低热,否认吸烟史,CT 示右肺上叶磨玻璃结节。" />
              </Form.Item>
              <Form.Item name="findings" label="影像所见关键词">
                <Input.TextArea rows={3} placeholder="例: 右肺上叶磨玻璃结节,边界清晰,约 8mm;余肺野清晰。" />
              </Form.Item>
              <Form.Item name="style" label="书写风格">
                <Segmented
                  options={[
                    { label: '简洁', value: 'concise' },
                    { label: '标准', value: 'standard' },
                    { label: '详细', value: 'detailed' },
                  ]}
                />
              </Form.Item>
              <Button type="primary" block icon={<Sparkles size={14} />} onClick={handleGenerate} loading={generating}>
                {generating ? 'AI 生成中...' : '生成建议草稿'}
              </Button>
            </Form>
          </Card>

          <Card
            size="small"
            title={<Space><History size={14} color="#2563eb" />历史记录</Space>}
            style={{ marginBottom: 16 }}
          >
            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /></div>
            ) : history.length === 0 ? (
              <Empty description="暂无历史记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={history}
                renderItem={(item) => (
                  <List.Item
                    actions={[<Button key="view" size="small" type="link" onClick={() => loadDraft(item.reportId)}>查看</Button>]}
                  >
                    <List.Item.Meta
                      title={<Space><Tag color="blue">{item.modality}</Tag><Text>{item.bodyPart}</Text><Tag>{item.style}</Tag></Space>}
                      description={<Text type="secondary" style={{ fontSize: 12 }}>{new Date(item.createdAt).toLocaleString('zh-CN')}</Text>}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          <Card
            size="small"
            title={<Space><FileText size={14} color="#2563eb" />AI 生成草稿</Space>}
            extra={draft && (
              <Space size={4}>
                <Tooltip title="复制全文">
                  <Button size="small" icon={copied === 'all' ? <Check size={12} /> : <Copy size={12} />} onClick={() => copyText(allText, 'all')} />
                </Tooltip>
                <Tooltip title="接受草稿">
                  <Button size="small" type="primary" icon={<ClipboardPaste size={12} />} onClick={handleAccept}>接受草稿</Button>
                </Tooltip>
              </Space>
            )}
          >
            {generating ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: 12, color: '#8b5cf6' }}>AI 正在分析临床描述并生成草稿...</div>
              </div>
            ) : !draft ? (
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="输入临床描述后点击「生成建议草稿」" />
            ) : (
              <>
                <Row gutter={16} style={{ marginBottom: 12 }}>
                  <Col span={8}>
                    <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
                      <Statistic title="整体置信度" value={Math.round((draft.confidence ?? 0) * 100)} suffix="%" valueStyle={{ color: '#7c3aed', fontSize: 20 }} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
                      <Statistic title="模型版本" value={draft.modelVersion || '-'} valueStyle={{ fontSize: 14 }} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
                      <Statistic title="状态" value={draft.status} valueStyle={{ fontSize: 14, color: draft.status === 'ACCEPTED' ? '#52c41a' : '#faad14' }} />
                    </Card>
                  </Col>
                </Row>
                <Divider style={{ margin: '8px 0' }} />
                {draft.sections.map((s) => (
                  <div key={s.heading} style={{ marginBottom: 12, border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, background: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text strong style={{ color: '#1e40af' }}>{s.heading}</Text>
                      <Button
                        size="small"
                        type="link"
                        icon={copied === s.heading ? <Check size={12} color="#52c41a" /> : <Copy size={12} />}
                        onClick={() => copyText(s.content, s.heading)}
                      >
                        {copied === s.heading ? '已复制' : '复制'}
                      </Button>
                    </div>
                    <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{s.content}</Paragraph>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>生成时间: {new Date(draft.createdAt).toLocaleString('zh-CN')}</Text>
                  <Space>
                    <Button size="small" icon={<RefreshCw size={12} />} onClick={handleGenerate} loading={generating}>重新生成</Button>
                    <Button size="small" type="primary" icon={<ClipboardPaste size={12} />} onClick={() => copyText(allText, 'all')}>复制全文到报告</Button>
                  </Space>
                </div>
              </>
            )}
          </Card>
          {draft && draft.sections.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Card size="small" title={<Space><Sparkles size={13} color="#f59e0b" />段落置信度</Space>}>
                <Row gutter={[12, 8]}>
                  {draft.sections.map((s) => (
                    <Col span={12} key={s.heading}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 12, width: 90 }}>{s.heading}</Text>
                        <Progress percent={Math.round((draft.confidence ?? 0.8) * 100)} size="small" style={{ flex: 1, margin: 0 }} strokeColor="#7c3aed" />
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card>
            </div>
          )}
        </Col>
      </Row>
    </div>
  )
}

export default AIAssistPage
