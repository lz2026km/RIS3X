import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Button,
  Tag,
  Space,
  Modal,
  Input,
  Typography,
  Row,
  Col,
  Statistic,
  message,
  Alert,
  Select,
  Progress,
  Badge,
  Empty,
} from "antd";
import {
  ShieldAlert, CheckCircle, XCircle, FileText, ClipboardCheck,
  Activity, FilePlus2,
} from 'lucide-react'
import {
  aiSecondReadApi,
  type SecondReadResult,
  type SecondReadRiskItem,
  type SecondReadStatsData,
  type SecondReadSeverity,
} from '../../services/api/aiSecondReadApi'
import { DataTable, StatCard, StatCardGrid } from "../../components/common"
import { useAuth } from '../../hooks/useAuth'
import { t } from '../../i18n/appI18n'

const { Text } = Typography
const { TextArea } = Input

const severityMap: Record<SecondReadSeverity, { color: string; labelKey: string }> = {
  high: { color: 'red', labelKey: 'secondRead.sevHigh' },
  medium: { color: 'orange', labelKey: 'secondRead.sevMedium' },
  low: { color: 'blue', labelKey: 'secondRead.sevLow' },
}

const statusMap: Record<string, { color: string; labelKey: string }> = {
  open: { color: 'default', labelKey: 'secondRead.stOpen' },
  ignored: { color: 'default', labelKey: 'secondRead.stIgnored' },
  adopted: { color: 'green', labelKey: 'secondRead.stAdopted' },
  appended: { color: 'processing', labelKey: 'secondRead.stAppended' },
}

const riskLevelColor: Record<string, string> = { low: 'var(--color-success-600)', medium: 'var(--color-warning-500)', high: 'var(--color-error-500)' }

/** 解包后端 { success, data } 包装 (兼容裸数据) */
function unwrap<T>(res: { success: boolean; data?: unknown }): T | null {
  if (!res.success) return null
  const d = res.data as { data?: T } | T | null
  if (d && typeof d === 'object' && 'data' in d && (d as { data?: unknown }).data !== undefined) {
    return (d as { data: T }).data
  }
  return d as T
}

/** [Wave 7C F14] AI 二次检出 V2 面板: 定稿前 AI 复查 + 风险项处理 */
const SecondReadPanel: React.FC = () => {
  const { user } = useAuth()
  const [results, setResults] = useState<SecondReadResult[]>([])
  const [stats, setStats] = useState<SecondReadStatsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analyzeOpen, setAnalyzeOpen] = useState(false)
  const [form, setForm] = useState({ reportId: '', patientName: '', modality: 'CT', findings: '', diagnosis: '', conclusion: '', recommendations: '' })
  const [appendTarget, setAppendTarget] = useState<SecondReadResult | null>(null)
  const [appendText, setAppendText] = useState('')
  const [detail, setDetail] = useState<SecondReadResult | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [r, s] = await Promise.all([aiSecondReadApi.listResults(), aiSecondReadApi.getStats()])
      const list = unwrap<SecondReadResult[]>(r) ?? []
      setResults(list)
      setStats(unwrap<SecondReadStatsData>(s) ?? null)
      if (!r.success) setError(r.error?.message ?? t('secondRead.loadFailed'))
    } catch (e) {
      setError((e as Error)?.message ?? t('secondRead.networkError'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const handleAnalyze = async () => {
    if (!form.reportId.trim()) { message.warning(t('secondRead.enterReportId')); return }
    setActionLoading(true)
    try {
      const res = await aiSecondReadApi.analyze(form)
      if (res.success && unwrap<SecondReadResult>(res)) {
        message.success(t('secondRead.analyzeDone'))
        setAnalyzeOpen(false)
        setForm({ reportId: '', patientName: '', modality: 'CT', findings: '', diagnosis: '', conclusion: '', recommendations: '' })
        void loadData()
      } else {
        message.error(res.error?.message ?? t('secondRead.analyzeFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('secondRead.analyzeFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleItem = async (resultId: string, item: SecondReadRiskItem, action: 'ignore' | 'adopt') => {
    setActionLoading(true)
    try {
      const reviewer = user?.name ?? user?.id ?? '当前用户'
      const res = action === 'ignore'
        ? await aiSecondReadApi.ignoreRiskItem(resultId, item.id, reviewer)
        : await aiSecondReadApi.adoptRiskItem(resultId, item.id, reviewer)
      if (res.success) {
        message.success(action === 'ignore' ? t('secondRead.ignoredMsg') : t('secondRead.adoptedMsg'))
        setResults(prev => prev.map(r => r.id === resultId ? (unwrap<SecondReadResult>(res) ?? r) : r))
        setDetail(d => d && d.id === resultId ? (unwrap<SecondReadResult>(res) ?? d) : d)
      } else {
        message.error(res.error?.message ?? t('secondRead.opFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('secondRead.opFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleAppend = async () => {
    if (!appendTarget || !appendText.trim()) { message.warning(t('secondRead.enterAppendText')); return }
    setActionLoading(true)
    try {
      const res = await aiSecondReadApi.appendToReport(appendTarget.id, {
        reviewer: user?.name ?? user?.id ?? t('secondRead.currentUser'),
        appendedText: appendText,
      })
      if (res.success) {
        message.success(t('secondRead.appendDone'))
        setResults(prev => prev.map(r => r.id === appendTarget.id ? (unwrap<SecondReadResult>(res) ?? r) : r))
        setAppendTarget(null)
        setAppendText('')
      } else {
        message.error(res.error?.message ?? t('secondRead.appendFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('secondRead.appendFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    { title: t('secondRead.colReportId'), dataIndex: 'reportId', key: 'reportId' },
    { title: t('secondRead.colPatient'), dataIndex: 'patientName', key: 'patientName' },
    { title: t('secondRead.colModality'), dataIndex: 'modality', key: 'modality' },
    {
      title: t('secondRead.colRiskScore'), dataIndex: 'riskScore', key: 'riskScore',
      render: (v: number, r: SecondReadResult) => (
        <Space size={8}>
          <Text strong>{v}</Text>
          <Progress percent={v} showInfo={false} strokeColor={riskLevelColor[r.riskLevel]} size="small" style={{ width: 80 }} />
          <Tag color={r.riskLevel === 'high' ? 'red' : r.riskLevel === 'medium' ? 'orange' : 'green'}>
            {r.riskLevel === 'high' ? t('secondRead.riskHigh') : r.riskLevel === 'medium' ? t('secondRead.riskMedium') : t('secondRead.riskLow')}
          </Tag>
        </Space>
      ),
    },
    {
      title: t('secondRead.colRiskItems'), dataIndex: 'riskItems', key: 'riskItems',
      render: (items: SecondReadRiskItem[]) => (
        <Space wrap>
          {items.map(i => (
            <Badge key={i.id} status={i.status === 'open' ? 'processing' : 'default'} text={i.title} />
          ))}
        </Space>
      ),
    },
    {
      title: t('secondRead.colActions'), key: 'action',
      render: (_: unknown, r: SecondReadResult) => (
        <Space>
          <Button size="small" icon={<FileText size={13} />} onClick={() => setDetail(r)}>{t('secondRead.detail')}</Button>
          {r.appendedText
            ? <Tag color="processing">{t('secondRead.appended')}</Tag>
            : <Button size="small" type="primary" icon={<FilePlus2 size={13} />} onClick={() => { setAppendTarget(r); setAppendText('') }}>{t('secondRead.appendToReport')}</Button>}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card
        title={<Space><ShieldAlert size={16} color="var(--color-primary-600)" /><span>{t('secondRead.title')}</span><Tag color="blue">{t('secondRead.tag')}</Tag></Space>}
        extra={<Button type="primary" icon={<ClipboardCheck size={14} />} onClick={() => setAnalyzeOpen(true)}>{t('secondRead.newTask')}</Button>}
      >
        {error && !loading && <Alert type="error" showIcon message={error} style={{ marginBottom: 'var(--space-3, 12px)' }} />}
        <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
          <StatCard title={t('secondRead.statTotal')} value={stats?.total ?? 0} icon={<Activity size={15} />} />
          <StatCard title={t('secondRead.statAvgRisk')} value={stats?.avgRiskScore ?? 0} suffix="/ 100" />
          <StatCard title={t('secondRead.statOpenRisk')} value={stats?.openRiskItems ?? 0} color="error" />
          <StatCard title={t('secondRead.statAppended')} value={stats?.appendedCount ?? 0} icon={<FilePlus2 size={15} />} />
        </StatCardGrid>
        <DataTable
          rowKey="id" dataSource={results} columns={columns} loading={loading}
          pagination={{ pageSize: 8 }} scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* 新建检出任务 */}
      <Modal title={t('secondRead.analyzeTitle')} open={analyzeOpen} onOk={() => void handleAnalyze()} onCancel={() => setAnalyzeOpen(false)} width={720} confirmLoading={actionLoading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space style={{ width: '100%' }}>
            <Input placeholder={t('secondRead.reportIdRequired')} value={form.reportId} onChange={e => setForm(p => ({ ...p, reportId: e.target.value }))} style={{ flex: 2 }} />
            <Input placeholder={t('secondRead.patientName')} value={form.patientName} onChange={e => setForm(p => ({ ...p, patientName: e.target.value }))} style={{ flex: 2 }} />
            <Select value={form.modality} onChange={v => setForm(p => ({ ...p, modality: v }))} style={{ width: 100 }}
              options={['CT', 'MR', 'DR', 'MG', 'US'].map(m => ({ value: m, label: m }))} />
          </Space>
          <TextArea rows={3} placeholder={t('secondRead.findings')} value={form.findings} onChange={e => setForm(p => ({ ...p, findings: e.target.value }))} />
          <TextArea rows={2} placeholder={t('secondRead.diagnosis')} value={form.diagnosis} onChange={e => setForm(p => ({ ...p, diagnosis: e.target.value }))} />
          <TextArea rows={2} placeholder={t('secondRead.conclusion')} value={form.conclusion} onChange={e => setForm(p => ({ ...p, conclusion: e.target.value }))} />
          <TextArea rows={2} placeholder={t('secondRead.recommendations')} value={form.recommendations} onChange={e => setForm(p => ({ ...p, recommendations: e.target.value }))} />
          <Alert type="info" showIcon message={t('secondRead.analyzeAlert')} />
        </Space>
      </Modal>

      {/* 详情 + 风险项处理 */}
      <Modal
        title={`${t('secondRead.detailTitle')} - ${detail?.reportId ?? ''}`} open={!!detail} onCancel={() => setDetail(null)}
        footer={null} width={760}
      >
        {detail && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Row gutter={12}>
              <Col span={6}><Card size="small"><Statistic title={t('secondRead.colRiskScore')} value={detail.riskScore} suffix="/100" valueStyle={{ color: riskLevelColor[detail.riskLevel] }} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title={t('secondRead.riskLevel')} value={detail.riskLevel === 'high' ? t('secondRead.levelHigh') : detail.riskLevel === 'medium' ? t('secondRead.levelMedium') : t('secondRead.levelLow')} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title={t('secondRead.textLength')} value={detail.featureStats.textLength} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title={t('secondRead.sectionCount')} value={detail.featureStats.sectionCount} /></Card></Col>
            </Row>
            <Text type="secondary">{t('secondRead.modelVersion')}: {detail.modelVersion} | {t('secondRead.detectedAt')}: {detail.createdAt.slice(0, 19).replace('T', ' ')}</Text>
            {detail.appendedText && (
              <Alert type="success" showIcon message={t('secondRead.appendedToReport')} description={detail.appendedText} />
            )}
            {detail.riskItems.length === 0 ? (
              <Empty description={t('secondRead.noRiskItems')} />
            ) : detail.riskItems.map(item => (
              <Card key={item.id} size="small"
                title={<Space>
                  <Tag color={severityMap[item.severity].color}>{t(severityMap[item.severity].labelKey)}</Tag>
                  <Tag color={statusMap[item.status]?.color}>{statusMap[item.status] ? t(statusMap[item.status]!.labelKey) : item.status}</Tag>
                  <Text strong>{item.title}</Text>
                </Space>}
                extra={item.status === 'open' ? (
                  <Space>
                    <Button size="small" icon={<CheckCircle size={13} />} onClick={() => void handleItem(detail.id, item, 'adopt')}>{t('secondRead.adopt')}</Button>
                    <Button size="small" icon={<XCircle size={13} />} onClick={() => void handleItem(detail.id, item, 'ignore')}>{t('secondRead.ignore')}</Button>
                  </Space>
                ) : undefined}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text>{item.description}</Text>
                  <Alert type="info" showIcon message={`${t('secondRead.suggestion')}: ${item.suggestion}`} />
                  <Text type="secondary">{item.handledBy ? `${t('secondRead.handledBy')}: ${item.handledBy} ${item.handledAt?.slice(0, 19).replace('T', ' ')}` : t('secondRead.pendingDoctor')}</Text>
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Modal>

      {/* 加入报告 */}
      <Modal
        title={`${t('secondRead.appendTitle')} - ${appendTarget?.reportId ?? ''}`} open={!!appendTarget}
        onOk={() => void handleAppend()}
        onCancel={() => { setAppendTarget(null); setAppendText('') }}
        confirmLoading={actionLoading}
      >
        <TextArea rows={4} placeholder={t('secondRead.appendPlaceholder')} value={appendText} onChange={e => setAppendText(e.target.value)} />
      </Modal>
    </div>
  )
}

export default SecondReadPanel
