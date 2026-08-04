import { useState, useEffect } from 'react'
import { auditApi, type AuditLogDto, type AuditStatsDto } from '../services/api/systemApi'
import { Card, Tag, Statistic, Row, Col, Space, Select, Button, Tabs, Descriptions, Tooltip, message } from 'antd'
import { ProTable, type ProColumn } from '../components/data/ProTable'
import { AuditOutlined, BarChartOutlined, ReloadOutlined, DownloadOutlined, FilterOutlined, UserOutlined } from '@ant-design/icons'

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogDto[]>([])
  const [stats, setStats] = useState<AuditStatsDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [params, setParams] = useState<{ action?: string; resource?: string; userId?: string }>({})

  const fetchLogs = async (requestedPage?: number) => {
    const targetPage = requestedPage ?? page
    setLoading(true)
    setPage(targetPage)
    try {
      const res = await auditApi.list({ ...params, page: targetPage, pageSize: 10 })
      if (res.success && res.data) {
        setLogs(res.data.items)
        setTotal(res.data.total)
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    const res = await auditApi.stats()
    if (res.success) setStats(res.data)
  }

  useEffect(() => { fetchLogs(1); fetchStats() }, [])

  const columns: ProColumn<AuditLogDto>[] = [
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 180, sorter: (a, b) => a.createdAt.localeCompare(b.createdAt), defaultSortOrder: 'descend', render: (v) => new Date(String(v)).toLocaleString('zh-CN') },
    { title: '用户', dataIndex: 'userId', key: 'userId', width: 120, searchable: true, sorter: (a, b) => String(a.userId).localeCompare(String(b.userId)) },
    { title: '操作', dataIndex: 'action', key: 'action', width: 100, filters: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'PRINT'].map((value) => ({ text: value, value })), onFilter: (value, record) => record.action === value, render: (v) => {
      const colorMap: Record<string, string> = { CREATE: 'green', UPDATE: 'blue', DELETE: 'red', LOGIN: 'cyan', LOGOUT: 'default', EXPORT: 'orange', PRINT: 'purple' }
      return <Tag color={colorMap[String(v)] ?? 'default'}>{String(v)}</Tag>
    }},
    { title: '资源', dataIndex: 'resource', key: 'resource', width: 200, searchable: true, sorter: (a, b) => a.resource.localeCompare(b.resource) },
    { title: 'IP地址', dataIndex: 'ip', key: 'ip', width: 130, render: (v) => <Tooltip title={String(v ?? '-')}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(v ?? '-')}</span></Tooltip> },
    { title: '详情', dataIndex: 'details', key: 'details', ellipsis: true, render: (value) => String(value ?? '-') },
  ]

  const handleExport = async () => {
    setLoading(true)
    try {
      const blob = await auditApi.exportCsv({ ...params, startDate: undefined, endDate: undefined })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      message.success(`审计日志已导出 (${logs.length}+ 条)`)
    } catch (e) {
      message.error((e as Error)?.message || '导出失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <h2 style={{ margin: 0 }}><AuditOutlined /> 审计日志</h2>
            <Space>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>导出</Button>
              <Button icon={<ReloadOutlined />} onClick={() => { fetchLogs(1); fetchStats() }}>刷新</Button>
            </Space>
          </Row>
          <Tabs items={[
            {
              key: 'overview',
              label: <span><BarChartOutlined /> 统计概览</span>,
              children: stats ? (
                <Row gutter={16}>
                  <Col span={6}><Card size="small"><Statistic title="总日志数" value={stats.total} prefix={<AuditOutlined />} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="24h 内" value={stats.last24h} prefix={<BarChartOutlined />} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="活跃用户" value="-" prefix={<UserOutlined />} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="安全事件" value="0" styles={{ content: {  color: '#52c41a'  } }} /></Card></Col>
                </Row>
              ) : <Card size="small"><Statistic title="加载中..." value="-" /></Card>,
            },
            {
              key: 'logs',
              label: <span><FilterOutlined /> 日志列表</span>,
              children: (
                <>
                  <Space style={{ marginBottom: 16 }}>
                    <Select allowClear placeholder="操作类型" style={{ width: 150 }} onChange={(v) => setParams((p) => ({ ...p, action: v }))} options={['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'PRINT'].map((a) => ({ value: a, label: a }))} />
                    <Select allowClear placeholder="资源类型" style={{ width: 150 }} onChange={(v) => setParams((p) => ({ ...p, resource: v }))} options={['patient', 'report', 'user', 'exam', 'dicom'].map((r) => ({ value: r, label: r }))} />
                    <Button type="primary" onClick={() => fetchLogs(1)}>查询</Button>
                  </Space>
                  <ProTable<AuditLogDto>
                    dataSource={logs}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    showToolbar={false}
                    pagination={{ current: page, pageSize: 10, total, showTotal: (t) => `共 ${t} 条`, onChange: (nextPage) => fetchLogs(nextPage) }}
                    size="small"
                  />
                </>
              ),
            },
            {
              key: 'policy',
              label: <span><AuditOutlined /> 审计策略</span>,
              children: (
                <Card size="small">
                  <Descriptions bordered column={2}>
                    <Descriptions.Item label="日志保留期">365 天</Descriptions.Item>
                    <Descriptions.Item label="归档策略">自动归档到冷存储</Descriptions.Item>
                    <Descriptions.Item label="实时告警">异常登录检测</Descriptions.Item>
                    <Descriptions.Item label="日志加密">AES-256 加密存储</Descriptions.Item>
                  </Descriptions>
                </Card>
              ),
            },
          ]} />
        </Space>
      </Card>
    </div>
  )
}
