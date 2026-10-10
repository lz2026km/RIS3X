/**
 * G005 v3.0.6.11-75 W3-1 - AI 辅助助手页
 * 输入临床描述 → 生成报告草稿(所见/结论) → 复制到报告; 历史记录; loading/error
 */
import { aiDraftApi, type AiReportDraft, type ReportDraftStyle } from '../services/api/aiDraftApi'
import { EmptyState } from '../components/common/EmptyState'
import {
  Card, Form, Input, Select, Segmented, Button, Space, Typography, Tag, Spin,
  Alert, message, List, Empty, Progress, Divider, Row, Col, Tooltip,
} from 'antd'
import { StatCard, StatCardGrid } from '../components/common'
import { Sparkles, Copy, Check, History, RefreshCw, FileText, ClipboardPaste, BrainCircuit } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { Inbox } from 'lucide-react'
import { t } from '../i18n/appI18n'
import { uniqueId } from '../utils/uniqueId'

const { Text, Paragraph } = Typography

const MODALITY_OPTIONS = [
  { label: 'CT', value: 'CT' },
  { label: 'MR', value: 'MR' },
  { label: 'DR', value: 'DR' },
  { label: 'US', value: 'US' },
  { label: 'MG', value: 'MG' },
  { label: 'DSA', value: 'DSA' },
]

const BODYPART_OPTIONS = [
  { value: '头部', label: t('aiAssist.body.head') },
  { value: '胸部', label: t('aiAssist.body.chest') },
  { value: '腹部', label: t('aiAssist.body.abdomen') },
  { value: '盆腔', label: t('aiAssist.body.pelvis') },
  { value: '脊柱', label: t('aiAssist.body.spine') },
  { value: '四肢关节', label: t('aiAssist.body.joint') },
  { value: '乳腺', label: t('aiAssist.body.breast') },
  { value: '颈部', label: t('aiAssist.body.neck') },
  { value: '血管', label: t('aiAssist.body.vessel') },
]

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
      else setError(res.error?.message ?? t('aiAssist.loadDraftFail'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('aiAssist.loadDraftFail'))
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
    const reportId = uniqueId('RP')
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
        setError(res.error?.message ?? t('aiAssist.generateFail'))
        return
      }
      setDraft(res.data)
      setHistory((prev) => [{ id: res.data.id, reportId, style: values.style, createdAt: res.data.createdAt, modality: values.modality, bodyPart: values.bodyPart }, ...prev].slice(0, 20))
      message.success(t('aiAssist.generated'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('aiAssist.generateFailNet'))
    } finally {
      setGenerating(false)
    }
  }

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      message.success(t('aiAssist.copied'))
      setTimeout(() => setCopied(null), 1500)
    } catch {
      message.error(t('aiAssist.copyFail'))
    }
  }

  const handleAccept = async () => {
    if (!draft) return
    try {
      const res = await aiDraftApi.acceptDraft(draft.id)
      if (res.success) {
        message.success(t('aiAssist.acceptSuccess'))
      } else {
        message.error(res.error?.message ?? t('aiAssist.acceptFail'))
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('aiAssist.acceptFail'))
    }
  }

  const allText = draft ? draft.sections.map((s) => `【${s.heading}】\n${s.content}`).join('\n\n') : ''

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)',}}>
      <Space style={{ marginBottom: 16 }}>
        <Sparkles size={20} color="#7c3aed" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('aiAssist.title')}</span>
        <Tag color="purple">v3.0.6.11-75</Tag>
        <Tag icon={<BrainCircuit size={12} />} color="blue">deepseek-v3.0</Tag>
      </Space>

      {error && (
        <Alert
          type="error"
          showIcon
          message={t('aiAssist.opFail')}
          description={error}
          style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => setError('')}>{t('aiAssist.close')}</Button>}
        />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={9}>
          <Card size="small" title={t('aiAssist.clinicalInput')} extra={<Tag color="geekblue">{t('aiAssist.genDraftTag')}</Tag>} style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical" size="small" initialValues={{ modality: 'CT', bodyPart: '胸部', style: 'standard' }}>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="modality" label={t('aiAssist.form.modality')} rules={[{ required: true }]}>
                    <Select options={MODALITY_OPTIONS} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="bodyPart" label={t('aiAssist.form.bodyPart')} rules={[{ required: true }]}>
                    <Select options={BODYPART_OPTIONS} showSearch />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="clinicalInfo" label={t('aiAssist.form.clinicalInfo')} rules={[{ required: true, message: t('aiAssist.validate.clinicalInfo') }]}>
                <Input.TextArea rows={3} placeholder={t('aiAssist.ph.clinicalInfo')} />
              </Form.Item>
              <Form.Item name="findings" label={t('aiAssist.form.findings')}>
                <Input.TextArea rows={3} placeholder={t('aiAssist.ph.findings')} />
              </Form.Item>
              <Form.Item name="style" label={t('aiAssist.form.style')}>
                <Segmented
                  options={[
                    { label: t('aiAssist.style.concise'), value: 'concise' },
                    { label: t('aiAssist.style.standard'), value: 'standard' },
                    { label: t('aiAssist.style.detailed'), value: 'detailed' },
                  ]}
                />
              </Form.Item>
              <Button type="primary" block icon={<Sparkles size={14} />} onClick={handleGenerate} loading={generating}>
                {generating ? t('aiAssist.generating') : t('aiAssist.generateBtn')}
              </Button>
            </Form>
          </Card>

          <Card
            size="small"
            title={<Space><History size={14} color="#2563eb" />{t('aiAssist.historyTitle')}</Space>}
            style={{ marginBottom: 16 }}
          >
            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /></div>
            ) : history.length === 0 ? (
              <EmptyState description={t('aiAssist.emptyHistory')} />
            ) : (
              <List
                size="small"
                dataSource={history}
                renderItem={(item) => (
                  <List.Item
                    actions={[<Button key="view" size="small" type="link" onClick={() => loadDraft(item.reportId)}>{t('aiAssist.view')}</Button>]}
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
            title={<Space><FileText size={14} color="#2563eb" />{t('aiAssist.draftTitle')}</Space>}
            extra={draft && (
              <Space size={4}>
                <Tooltip title={t('aiAssist.copyAll')}>
                  <Button size="small" icon={copied === 'all' ? <Check size={12} /> : <Copy size={12} />} onClick={() => copyText(allText, 'all')} />
                </Tooltip>
                <Tooltip title={t('aiAssist.acceptDraft')}>
                  <Button size="small" type="primary" icon={<ClipboardPaste size={12} />} onClick={handleAccept}>{t('aiAssist.acceptDraft')}</Button>
                </Tooltip>
              </Space>
            )}
          >
            {generating ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: 12, color: '#8b5cf6' }}>{t('aiAssist.analyzing')}</div>
              </div>
            ) : !draft ? (
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('aiAssist.emptyDraft')} />
            ) : (
              <>
                <StatCardGrid minWidth={140} gap={12} style={{ marginBottom: 12 }}>
                  <StatCard size="sm" title={t('aiAssist.stat.confidence')} value={Math.round((draft.confidence ?? 0) * 100)} suffix="%" color="#7c3aed" />
                  <StatCard size="sm" title={t('aiAssist.stat.modelVersion')} value={draft.modelVersion || '-'} />
                  <StatCard size="sm" title={t('aiAssist.stat.status')} value={draft.status} color={draft.status === 'ACCEPTED' ? 'success' : 'warning'} />
                </StatCardGrid>
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
                        {copied === s.heading ? t('aiAssist.copiedShort') : t('aiAssist.copy')}
                      </Button>
                    </div>
                    <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{s.content}</Paragraph>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('aiAssist.generateTime')} {new Date(draft.createdAt).toLocaleString('zh-CN')}</Text>
                  <Space>
                    <Button size="small" icon={<RefreshCw size={12} />} onClick={handleGenerate} loading={generating}>{t('aiAssist.regenerate')}</Button>
                    <Button size="small" type="primary" icon={<ClipboardPaste size={12} />} onClick={() => copyText(allText, 'all')}>{t('aiAssist.copyAllToReport')}</Button>
                  </Space>
                </div>
              </>
            )}
          </Card>
          {draft && draft.sections.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Card size="small" title={<Space><Sparkles size={13} color="#f59e0b" />{t('aiAssist.sectionConfidence')}</Space>}>
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
