import React, { useState, useMemo } from 'react'
import { Card, Table, Tag, Badge, Statistic, Row, Col, Select, DatePicker, Space, Typography, Tooltip, Empty } from 'antd'
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock, Search, Filter } from 'lucide-react'
import type { AuditLogEntry, AuditCategory, AuditSeverity } from '../../types/security'
import { auditLogger } from '../../services/security'
import { MOCK_AUDIT_EVENTS } from '../../data/securityMock'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const categoryColors: Record<AuditCategory, string> = {
  auth: 'blue', authorization: 'purple', data_access: 'cyan',
  data_change: 'orange', system: 'geekblue', security: 'red',
  compliance: 'green', phi: 'volcano', admin: 'magenta',
}

const severityColor: Record<AuditSeverity, string> = {
  debug: 'default', info: 'blue', notice: 'cyan', warning: 'orange',
  error: 'red', critical: 'volcano', alert: 'magenta', emergency: 'purple',
}

export default function SecurityAuditPage() {
  const [category, setCategory] = useState<AuditCategory | ''>('')
  const [severity, setSeverity] = useState<AuditSeverity | ''>('')
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)

  const events = useMemo(() => {
    auditLogger.importEntries(MOCK_AUDIT_EVENTS)
    const filters: Parameters<typeof auditLogger.query>[0] = {}
    if (category) filters.category = category as AuditCategory
    if (severity) filters.severity = severity as AuditSeverity
    if (dateRange) { filters.startDate = dateRange[0]; filters.endDate = dateRange[1] }
    return auditLogger.query(filters)
  }, [category, severity, dateRange])

  const stats = auditLogger.stats()

  const columns = [
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 160, render: (v: string) => new Date(v).toLocaleString() },
    { title: '分类', dataIndex: 'category', key: 'category', width: 100, render: (v: AuditCategory) => <Tag color={categoryColors[v]}>{v}</Tag> },
    { title: '严重度', dataIndex: 'severity', key: 'severity', width: 90, render: (v: AuditSeverity) => <Tag color={severityColor[v]}>{v}</Tag> },
    { title: '操作人', dataIndex: 'actor', key: 'actor', width: 120, render: (a: AuditLogEntry['actor']) => `${a.userName} (${a.role})` },
    { title: '动作', dataIndex: 'action', key: 'action', width: 160 },
    { title: '目标', dataIndex: 'target', key: 'target', width: 180, render: (t: AuditLogEntry['target']) => `${t.type}:${t.id}` },
    { title: '结果', dataIndex: 'outcome', key: 'outcome', width: 80, render: (v: string) => v === 'success' ? <CheckCircle size={14} color="green" /> : v === 'failure' ? <XCircle size={14} color="red" /> : <AlertTriangle size={14} color="orange" /> },
    { title: '风险分', dataIndex: 'riskScore', key: 'riskScore', width: 80, render: (v: number) => <Badge count={v} style={{ backgroundColor: v >= 70 ? '#f5222d' : v >= 40 ? '#fa8c16' : '#52c41a' }} /> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}><Shield style={{ marginRight: 8 }} />安全审计总览</Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title="总事件" value={stats.total} prefix={<Clock />} /></Card></Col>
        <Col span={6}><Card><Statistic title="分类" value={Object.keys(stats.byCategory).length} prefix={<Filter />} /></Card></Col>
        <Col span={6}><Card><Statistic title="平均风险" value={stats.avgRiskScore} suffix="/100" prefix={<Search />} /></Card></Col>
        <Col span={6}><Card><Statistic title="严重事件" value={stats.bySeverity.critical ?? 0} prefix={<AlertTriangle color="red" />} /></Card></Col>
      </Row>
      <Card title="审计日志筛选" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select placeholder="分类" allowClear style={{ width: 140 }} value={category || undefined} onChange={v => setCategory(v ?? '')}>
            {Object.keys(categoryColors).map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
          </Select>
          <Select placeholder="严重度" allowClear style={{ width: 120 }} value={severity || undefined} onChange={v => setSeverity(v ?? '')}>
            {Object.keys(severityColor).map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}
          </Select>
          <RangePicker onChange={(_, dateStrings) => setDateRange(dateStrings[0] && dateStrings[1] ? [dateStrings[0], dateStrings[1]] : null)} />
        </Space>
      </Card>
      <Card>
        <Table dataSource={events} columns={columns} rowKey="id" size="small" pagination={{ pageSize: 10, showSizeChanger: true }} locale={{ emptyText: <Empty description="无匹配审计事件" /> }} />
      </Card>
    </div>
  )
}
