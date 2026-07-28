import React, { useState, useMemo } from 'react'
import { Card, Table, Tag, Badge, Select, Input, DatePicker, Space, Typography, Tooltip, Empty, Button } from 'antd'
import { Search, Shield, Download, FileJson, FileText } from 'lucide-react'
import type { AuditLogEntry, AuditCategory, AuditSeverity } from '../../types/security'
import { auditLogger } from '../../services/security'
import { MOCK_AUDIT_EVENTS } from '../../data/securityMock'

const { Title, Text } = Typography

const severityColor: Record<AuditSeverity, string> = {
  debug: 'default', info: 'blue', notice: 'cyan', warning: 'orange',
  error: 'red', critical: 'volcano', alert: 'magenta', emergency: 'purple',
}

export default function AuditLogViewer() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<AuditCategory | ''>('')
  const [severity, setSeverity] = useState<AuditSeverity | ''>('')

  const events = useMemo(() => {
    auditLogger.importEntries(MOCK_AUDIT_EVENTS)
    const filters: Parameters<typeof auditLogger.query>[0] = {}
    if (category) filters.category = category as AuditCategory
    if (severity) filters.severity = severity as AuditSeverity
    return auditLogger.query(filters)
  }, [category, severity])

  const filtered = useMemo(() => {
    if (!search) return events
    const q = search.toLowerCase()
    return events.filter(e =>
      e.actor.userName.toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q) ||
      e.target.id.toLowerCase().includes(q)
    )
  }, [events, search])

  const handleExportJson = () => {
    const blob = new Blob([auditLogger.export('json')], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `audit-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCsv = () => {
    const blob = new Blob([auditLogger.export('csv')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `audit-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const columns = [
    { title: '#', dataIndex: 'seq', key: 'seq', width: 50 },
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 150, render: (v: string) => new Date(v).toLocaleString() },
    { title: '操作人', dataIndex: 'actor', key: 'actor', width: 120, render: (a: AuditLogEntry['actor']) => <Tooltip title={`${a.role} / ${a.department ?? ''}`}>{a.userName}</Tooltip> },
    { title: '动作', dataIndex: 'action', key: 'action', width: 160, render: (v: string) => <Text code>{v}</Text> },
    { title: '目标', dataIndex: 'target', key: 'target', width: 140, render: (t: AuditLogEntry['target']) => <Tooltip title={t.name ?? ''}>{t.type}:{t.id}</Tooltip> },
    { title: '严重度', dataIndex: 'severity', key: 'severity', width: 80, render: (v: AuditSeverity) => <Tag color={severityColor[v]}>{v}</Tag> },
    { title: '风险', dataIndex: 'riskScore', key: 'riskScore', width: 60, render: (v: number) => <Badge count={v} style={{ backgroundColor: v >= 70 ? '#f5222d' : v >= 40 ? '#fa8c16' : '#52c41a', fontSize: 12 }} /> },
    { title: 'IP', dataIndex: 'source', key: 'source', width: 120, render: (s: AuditLogEntry['source']) => <Text type="secondary" style={{ fontSize: 12 }}>{s.ipAddress}</Text> },
    { title: '结果', dataIndex: 'outcome', key: 'outcome', width: 70, render: (v: string) => {
      const map: Record<string, { color: string; text: string }> = { success: { color: 'green', text: '成功' }, failure: { color: 'red', text: '失败' }, denied: { color: 'orange', text: '拒绝' }, partial: { color: 'blue', text: '部分' } }
      return <Tag color={map[v]?.color}>{map[v]?.text ?? v}</Tag>
    }},
  ]

  return (
    <Card title={<><Shield size={16} style={{ marginRight: 8 }} />审计日志查看器</>}
      extra={<Space><Button icon={<FileJson size={14} />} onClick={handleExportJson}>JSON</Button><Button icon={<FileText size={14} />} onClick={handleExportCsv}>CSV</Button></Space>}>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input prefix={<Search size={14} />} placeholder="搜索操作人/动作/目标..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 280 }} allowClear />
        <Select placeholder="分类" allowClear style={{ width: 120 }} value={category || undefined} onChange={v => setCategory(v ?? '')}>
          {(['auth', 'authorization', 'data_access', 'data_change', 'system', 'security', 'compliance', 'phi', 'admin'] as AuditCategory[]).map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
        </Select>
        <Select placeholder="严重度" allowClear style={{ width: 100 }} value={severity || undefined} onChange={v => setSeverity(v ?? '')}>
          {(['debug', 'info', 'notice', 'warning', 'error', 'critical'] as AuditSeverity[]).map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}
        </Select>
        <Text type="secondary">共 {filtered.length} 条</Text>
      </Space>
      <Table dataSource={filtered} columns={columns} rowKey="id" size="small" pagination={{ pageSize: 10, showSizeChanger: true }} locale={{ emptyText: <Empty description="无匹配日志" /> }} />
    </Card>
  )
}
