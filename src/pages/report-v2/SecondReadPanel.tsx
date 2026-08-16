import React, { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Button, Tag, Space, Modal, Input, Typography, Row, Col, Statistic,
  message, Alert, Select, Progress, Badge, Empty,
} from 'antd'
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
import { useAuth } from '../../hooks/useAuth'

const { Text } = Typography
const { TextArea } = Input

const severityMap: Record<SecondReadSeverity, { color: string; label: string }> = {
  high: { color: 'red', label: '高危' },
  medium: { color: 'orange', label: '中危' },
  low: { color: 'blue', label: '低危' },
}

const statusMap: Record<string, { color: string; label: string }> = {
  open: { color: 'default', label: '待处理' },
  ignored: { color: 'default', label: '已忽略' },
  adopted: { color: 'green', label: '已采纳' },
  appended: { color: 'processing', label: '已加入报告' },
}

const riskLevelColor: Record<string, string> = { low: '#16a34a', medium: '#f59e0b', high: '#ef4444' }

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
      if (!r.success) setError(r.error?.message ?? '加载失败')
    } catch (e) {
      setError((e as Error)?.message ?? '网络错误')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const handleAnalyze = async () => {
    if (!form.reportId.trim()) { message.warning('请输入报告编号'); return }
    setActionLoading(true)
    try {
      const res = await aiSecondReadApi.analyze(form)
      if (res.success && unwrap<SecondReadResult>(res)) {
        message.success('AI 二次检出完成')
        setAnalyzeOpen(false)
        setForm({ reportId: '', patientName: '', modality: 'CT', findings: '', diagnosis: '', conclusion: '', recommendations: '' })
        void loadData()
      } else {
        message.error(res.error?.message ?? '检出失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '检出失败')
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
        message.success(action === 'ignore' ? '已忽略该风险项' : '已采纳该风险项')
        setResults(prev => prev.map(r => r.id === resultId ? (unwrap<SecondReadResult>(res) ?? r) : r))
        setDetail(d => d && d.id === resultId ? (unwrap<SecondReadResult>(res) ?? d) : d)
      } else {
        message.error(res.error?.message ?? '操作失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '操作失败')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAppend = async () => {
    if (!appendTarget || !appendText.trim()) { message.warning('请填写追加内容'); return }
    setActionLoading(true)
    try {
      const res = await aiSecondReadApi.appendToReport(appendTarget.id, {
        reviewer: user?.name ?? user?.id ?? '当前用户',
        appendedText: appendText,
      })
      if (res.success) {
        message.success('建议已加入报告')
        setResults(prev => prev.map(r => r.id === appendTarget.id ? (unwrap<SecondReadResult>(res) ?? r) : r))
        setAppendTarget(null)
        setAppendText('')
      } else {
        message.error(res.error?.message ?? '加入报告失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '加入报告失败')
    } finally {
      setActionLoading(false)
    }
  }

  const columns = [
    { title: '报告编号', dataIndex: 'reportId', key: 'reportId' },
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: '模态', dataIndex: 'modality', key: 'modality' },
    {
      title: '风险评分', dataIndex: 'riskScore', key: 'riskScore',
      render: (v: number, r: SecondReadResult) => (
        <Space size={8}>
          <Text strong>{v}</Text>
          <Progress percent={v} showInfo={false} strokeColor={riskLevelColor[r.riskLevel]} size="small" style={{ width: 80 }} />
          <Tag color={r.riskLevel === 'high' ? 'red' : r.riskLevel === 'medium' ? 'orange' : 'green'}>
            {r.riskLevel === 'high' ? '高风险' : r.riskLevel === 'medium' ? '中风险' : '低风险'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '风险项', dataIndex: 'riskItems', key: 'riskItems',
      render: (items: SecondReadRiskItem[]) => (
        <Space wrap>
          {items.map(i => (
            <Badge key={i.id} status={i.status === 'open' ? 'processing' : 'default'} text={i.title} />
          ))}
        </Space>
      ),
    },
    {
      title: '操作', key: 'action',
      render: (_: unknown, r: SecondReadResult) => (
        <Space>
          <Button size="small" icon={<FileText size={13} />} onClick={() => setDetail(r)}>详情</Button>
          {r.appendedText
            ? <Tag color="processing">已追加</Tag>
            : <Button size="small" type="primary" icon={<FilePlus2 size={13} />} onClick={() => { setAppendTarget(r); setAppendText('') }}>加入报告</Button>}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card
        title={<Space><ShieldAlert size={16} color="#2563eb" /><span>AI 二次检出 V2</span><Tag color="blue">定稿前复查</Tag></Space>}
        extra={<Button type="primary" icon={<ClipboardCheck size={14} />} onClick={() => setAnalyzeOpen(true)}>新建检出任务</Button>}
      >
        {error && !loading && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Statistic title="检出报告数" value={stats?.total ?? 0} prefix={<Activity size={15} />} /></Col>
          <Col span={6}><Statistic title="平均风险分" value={stats?.avgRiskScore ?? 0} suffix="/ 100" /></Col>
          <Col span={6}><Statistic title="待处理风险项" value={stats?.openRiskItems ?? 0} valueStyle={{ color: '#ef4444' }} /></Col>
          <Col span={6}><Statistic title="已加入报告" value={stats?.appendedCount ?? 0} prefix={<FilePlus2 size={15} />} /></Col>
        </Row>
        <Table
          rowKey="id" dataSource={results} columns={columns} size="small" loading={loading}
          pagination={{ pageSize: 8 }} scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* 新建检出任务 */}
      <Modal title="AI 二次检出 (定稿前复查)" open={analyzeOpen} onOk={() => void handleAnalyze()} onCancel={() => setAnalyzeOpen(false)} width={720} confirmLoading={actionLoading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space style={{ width: '100%' }}>
            <Input placeholder="报告编号 (必填)" value={form.reportId} onChange={e => setForm(p => ({ ...p, reportId: e.target.value }))} style={{ flex: 2 }} />
            <Input placeholder="患者姓名" value={form.patientName} onChange={e => setForm(p => ({ ...p, patientName: e.target.value }))} style={{ flex: 2 }} />
            <Select value={form.modality} onChange={v => setForm(p => ({ ...p, modality: v }))} style={{ width: 100 }}
              options={['CT', 'MR', 'DR', 'MG', 'US'].map(m => ({ value: m, label: m }))} />
          </Space>
          <TextArea rows={3} placeholder="影像所见" value={form.findings} onChange={e => setForm(p => ({ ...p, findings: e.target.value }))} />
          <TextArea rows={2} placeholder="诊断意见" value={form.diagnosis} onChange={e => setForm(p => ({ ...p, diagnosis: e.target.value }))} />
          <TextArea rows={2} placeholder="诊断结论" value={form.conclusion} onChange={e => setForm(p => ({ ...p, conclusion: e.target.value }))} />
          <TextArea rows={2} placeholder="随访建议" value={form.recommendations} onChange={e => setForm(p => ({ ...p, recommendations: e.target.value }))} />
          <Alert type="info" showIcon message="引擎将按确定性规则复查: 漏诊风险 / 描述缺项 / 结论不一致, 并输出 0-100 风险评分。" />
        </Space>
      </Modal>

      {/* 详情 + 风险项处理 */}
      <Modal
        title={`二次检出详情 - ${detail?.reportId ?? ''}`} open={!!detail} onCancel={() => setDetail(null)}
        footer={null} width={760}
      >
        {detail && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Row gutter={12}>
              <Col span={6}><Card size="small"><Statistic title="风险评分" value={detail.riskScore} suffix="/100" valueStyle={{ color: riskLevelColor[detail.riskLevel] }} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="风险等级" value={detail.riskLevel === 'high' ? '高' : detail.riskLevel === 'medium' ? '中' : '低'} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="文本长度" value={detail.featureStats.textLength} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="段落数" value={detail.featureStats.sectionCount} /></Card></Col>
            </Row>
            <Text type="secondary">模型版本: {detail.modelVersion} | 检出时间: {detail.createdAt.slice(0, 19).replace('T', ' ')}</Text>
            {detail.appendedText && (
              <Alert type="success" showIcon message="已追加到报告" description={detail.appendedText} />
            )}
            {detail.riskItems.length === 0 ? (
              <Empty description="未检出风险项" />
            ) : detail.riskItems.map(item => (
              <Card key={item.id} size="small"
                title={<Space>
                  <Tag color={severityMap[item.severity].color}>{severityMap[item.severity].label}</Tag>
                  <Tag color={statusMap[item.status]?.color}>{statusMap[item.status]?.label}</Tag>
                  <Text strong>{item.title}</Text>
                </Space>}
                extra={item.status === 'open' ? (
                  <Space>
                    <Button size="small" icon={<CheckCircle size={13} />} onClick={() => void handleItem(detail.id, item, 'adopt')}>采纳</Button>
                    <Button size="small" icon={<XCircle size={13} />} onClick={() => void handleItem(detail.id, item, 'ignore')}>忽略</Button>
                  </Space>
                ) : undefined}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text>{item.description}</Text>
                  <Alert type="info" showIcon message={`建议: ${item.suggestion}`} />
                  <Text type="secondary">{item.handledBy ? `处理人: ${item.handledBy} ${item.handledAt?.slice(0, 19).replace('T', ' ')}` : '待医生处理'}</Text>
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Modal>

      {/* 加入报告 */}
      <Modal
        title={`建议加入报告 - ${appendTarget?.reportId ?? ''}`} open={!!appendTarget}
        onOk={() => void handleAppend()}
        onCancel={() => { setAppendTarget(null); setAppendText('') }}
        confirmLoading={actionLoading}
      >
        <TextArea rows={4} placeholder="请输入需追加到报告的文本 (如: 建议 3 个月后复查...)" value={appendText} onChange={e => setAppendText(e.target.value)} />
      </Modal>
    </div>
  )
}

export default SecondReadPanel
