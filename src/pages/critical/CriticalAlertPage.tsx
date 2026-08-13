// [v3.0.6.11-54] Phase 2: 危急值告警 (真实列表 + 级别筛选 + 处理闭环)
import {
  criticalAlertApi, type CriticalAlert, type CriticalAlertStats,
} from '../../services/api/criticalAlertApi'
import {
  Card, Table, Button, Tag, Space, Typography, Row, Col, Statistic, message,
  Modal, Input, Select, Alert, Spin, Badge, Empty, Progress,
} from 'antd'
import { AlertTriangle, CheckCircle, Bell, ArrowUp, RefreshCw, Clock } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

const { Text } = Typography
const { TextArea } = Input

const severityColor: Record<string, string> = { info: 'blue', warning: 'orange', critical: 'red', emergency: 'volcano' }
const statusColor: Record<string, string> = { active: 'red', acknowledged: 'orange', resolved: 'green', escalated: 'purple' }
const severityLabel: Record<string, string> = { info: '提示', warning: '警告', critical: '危急', emergency: '紧急' }
const statusLabel: Record<string, string> = { active: '活动中', acknowledged: '已确认', resolved: '已解决', escalated: '已升级' }
const typeLabel: Record<string, string> = {
  critical_value: '危急值', unexpected_finding: '意外发现', technical_issue: '技术问题', protocol_deviation: '协议偏离',
}

const CriticalAlertPage: React.FC = () => {
  const [alerts, setAlerts] = useState<CriticalAlert[]>([])
  const [stats, setStats] = useState<CriticalAlertStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>()
  const [statusFilter, setStatusFilter] = useState<string>()
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<CriticalAlert | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // [W2-C] 受控分页
  const [alertPage, setAlertPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [listRes, statsRes] = await Promise.allSettled([
        criticalAlertApi.listAlerts({ severity: severityFilter, status: statusFilter }),
        criticalAlertApi.getStats(),
      ])
      if (listRes.status === 'fulfilled' && listRes.value.success) {
        setAlerts(listRes.value.data ?? [])
      } else {
        setAlerts([])
        if (listRes.status === 'fulfilled') setError(listRes.value.error?.message ?? '')
      }
      if (statsRes.status === 'fulfilled' && statsRes.value.success) setStats(statsRes.value.data)
    } catch (e) {
      setError((e as Error)?.message ?? '加载失败')
    } finally {
      setLoading(false)
    }
  }, [severityFilter, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const pendingCount = useMemo(() => alerts.filter((a) => a.status === 'active').length, [alerts])

  const refresh = () => { void load() }

  const handleAcknowledge = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await criticalAlertApi.acknowledge(selected.id, { comment: comment || undefined })
      if (res.success) {
        message.success('已确认')
        setDetailOpen(false)
        setComment('')
        refresh()
      } else {
        message.error(res.error?.message ?? '确认失败')
      }
    } catch {
      message.error('确认失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResolve = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await criticalAlertApi.resolve(selected.id, { resolution: '已处理完毕' })
      if (res.success) {
        message.success('已解决')
        setDetailOpen(false)
        setComment('')
        refresh()
      } else {
        message.error(res.error?.message ?? '操作失败')
      }
    } catch {
      message.error('操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEscalate = async (item: CriticalAlert) => {
    try {
      const res = await criticalAlertApi.escalate(item.id, '值班主任医师')
      if (res.success) {
        message.success('已上报')
        refresh()
      } else {
        message.error(res.error?.message ?? '上报失败')
      }
    } catch {
      message.error('上报失败')
    }
  }

  const columns = [
    { title: '患者', dataIndex: 'patientName', key: 'patientName', width: 110 },
    { title: '告警类型', dataIndex: 'alertType', key: 'alertType', width: 110, render: (v: string) => <Tag>{typeLabel[v] ?? v}</Tag> },
    { title: '严重度', dataIndex: 'severity', key: 'severity', width: 100, render: (v: string) => <Tag color={severityColor[v]}>{severityLabel[v] ?? v}</Tag> },
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '模态', dataIndex: 'modality', key: 'modality', width: 70 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 110, render: (v: string) => <Tag color={statusColor[v]}>{statusLabel[v] ?? v}</Tag> },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => new Date(v).toLocaleString() },
    { title: '操作', key: 'action', width: 160, render: (_: unknown, r: CriticalAlert) => (
      <Space size={4}>
        <Button size="small" type="primary" icon={<CheckCircle size={12} />}
          disabled={r.status !== 'active' && r.status !== 'acknowledged'}
          onClick={() => { setSelected(r); setDetailOpen(true) }}>处理</Button>
        {r.status === 'active' && (
          <Button size="small" icon={<ArrowUp size={12} />} onClick={() => void handleEscalate(r)}>上报</Button>
        )}
      </Space>
    )},
  ]

  const severityDist = stats?.severityDistribution ?? []
  const maxSev = Math.max(1, ...severityDist.map((s) => s.count))

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <AlertTriangle size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>危急值告警</span>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={refresh} loading={loading}>刷新</Button>
      </Space>

      {error && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message={error}
          action={<Button size="small" onClick={refresh}><RefreshCw size={14} /> 重试</Button>} />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总告警" value={stats?.totalAlerts ?? alerts.length} prefix={<Bell size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="待处理" value={stats?.activeCount ?? pendingCount} styles={{ content: { color: '#ff4d4f' } }} /></Card></Col>
        <Col span={6}><Card><Statistic title="已确认" value={stats?.acknowledgedCount ?? 0} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={6}><Card>
          <Statistic title="平均响应" value={stats?.avgResponseTimeMinutes ?? 0} suffix="min" prefix={<Clock size={14} />} />
        </Card></Col>
      </Row>

      {severityDist.length > 0 && (
        <Card size="small" title="级别分布" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            {severityDist.map((s) => (
              <Col span={6} key={s.severity}>
                <Space style={{ marginBottom: 4 }}>
                  <Tag color={severityColor[s.severity]}>{severityLabel[s.severity] ?? s.severity}</Tag>
                  <span>{s.count}</span>
                </Space>
                <Progress percent={Math.round((s.count / maxSev) * 100)} showInfo={false}
                  strokeColor={{ from: '#faad14', to: '#ff4d4f' }} size="small" />
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Card
        size="small"
        title="告警列表"
        extra={
          <Space>
            <Select
              size="small" allowClear placeholder="级别筛选" style={{ width: 130 }}
              value={severityFilter} onChange={(v) => { setSeverityFilter(v); setAlertPage(1) }}
              options={['info', 'warning', 'critical', 'emergency'].map((s) => ({ value: s, label: s }))}
            />
            <Select
              size="small" allowClear placeholder="状态筛选" style={{ width: 130 }}
              value={statusFilter} onChange={(v) => { setStatusFilter(v); setAlertPage(1) }}
              options={['active', 'acknowledged', 'resolved', 'escalated'].map((s) => ({ value: s, label: s }))}
            />
          </Space>
        }
      >
        <Spin spinning={loading}>
          {alerts.length === 0 && !loading ? (
            <Empty description="暂无告警" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Table rowKey="id" dataSource={alerts} columns={columns} pagination={{ current: alertPage, pageSize: 10, total: alerts.length, onChange: setAlertPage, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }} size="small" scroll={{ x: 'max-content' }}/>
          )}
        </Spin>
      </Card>

      <Modal
        title="处理告警"
        open={detailOpen}
        onOk={() => void handleAcknowledge()}
        onCancel={() => setDetailOpen(false)}
        confirmLoading={submitting}
        width={620}
        footer={selected ? [
          <Button key="cancel" onClick={() => setDetailOpen(false)}>取消</Button>,
          <Button key="resolve" type="default" loading={submitting} onClick={() => void handleResolve()}>标记已解决</Button>,
          <Button key="ack" type="primary" loading={submitting} onClick={() => void handleAcknowledge()}>确认处理</Button>,
        ] : null}
      >
        {selected && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space>
                  <Text strong>{selected.patientName}</Text>
                  <Tag color={severityColor[selected.severity]}>{severityLabel[selected.severity] ?? selected.severity}</Tag>
                  <Tag>{typeLabel[selected.alertType] ?? selected.alertType}</Tag>
                  <Badge status={(statusColor[selected.status] as any)} text={statusLabel[selected.status] ?? selected.status} />
                </Space>
                <Text strong>标题: {selected.title}</Text>
                <Text type="secondary">描述: {selected.description}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>检查: {selected.studyId} · 模态 {selected.modality} · 触发时间 {new Date(selected.createdAt).toLocaleString()}</Text>
              </Space>
            </Card>
            <TextArea placeholder="处理备注（可选）" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </>
        )}
      </Modal>
    </div>
  )
}

export default CriticalAlertPage
