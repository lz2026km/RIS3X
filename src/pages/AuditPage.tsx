import { useState, useEffect } from 'react'
import { auditApi, type AuditLogDto, type AuditStatsDto } from '../services/api/systemApi'
import { Card, Tag, Statistic, Row, Col, Space, Select, Button } from 'antd'
import { ProTable, type ProColumn } from '../components/data/ProTable'
import { AuditOutlined, BarChartOutlined, ReloadOutlined } from '@ant-design/icons'

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogDto[]>([])
  const [stats, setStats] = useState<AuditStatsDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [params, setParams] = useState<{ action?: string; resource?: string }>({})

  const fetchLogs = async (requestedPage?: number) => {
    const targetPage = requestedPage ?? page
    setLoading(true)
    setPage(targetPage)
    try {
      const res = await auditApi.list({ ...params, page: targetPage, pageSize: 20 })
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
    { title: '操作', dataIndex: 'action', key: 'action', width: 100, filters: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'].map((value) => ({ text: value, value })), onFilter: (value, record) => record.action === value, render: (v) => <Tag color="blue">{String(v)}</Tag> },
    { title: '资源', dataIndex: 'resource', key: 'resource', width: 200, searchable: true, sorter: (a, b) => a.resource.localeCompare(b.resource) },
    { title: '详情', dataIndex: 'details', key: 'details', ellipsis: true, render: (value) => String(value ?? '-') },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <h2 style={{ margin: 0 }}><AuditOutlined /> 审计日志</h2>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchLogs(1); fetchStats() }}>刷新</Button>
          </Row>
          {stats && (
            <Row gutter={16}>
              <Col span={6}><Statistic title="总日志数" value={stats.total} /></Col>
              <Col span={6}><Statistic title="24h 内" value={stats.last24h} prefix={<BarChartOutlined />} /></Col>
            </Row>
          )}
          <Space>
            <Select allowClear placeholder="操作类型" style={{ width: 150 }} onChange={(v) => setParams(p => ({ ...p, action: v }))} options={['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'].map(a => ({ value: a, label: a }))} />
            <Button type="primary" onClick={() => fetchLogs(1)}>查询</Button>
          </Space>
          <ProTable<AuditLogDto>
            dataSource={logs}
            columns={columns}
            rowKey="id"
            loading={loading}
            showToolbar={false}
            pagination={{ current: page, pageSize: 20, total, onChange: (nextPage) => fetchLogs(nextPage) }}
            size="small"
          />
        </Space>
      </Card>
    </div>
  )
}
