import { useState, useEffect } from 'react'
import { auditApi, type AuditLogDto, type AuditStatsDto } from '../services/api/systemApi'
import { Card, Table, Tag, Statistic, Row, Col, Space, DatePicker, Select, Button, message } from 'antd'
import { AuditOutlined, BarChartOutlined, ReloadOutlined } from '@ant-design/icons'

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogDto[]>([])
  const [stats, setStats] = useState<AuditStatsDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [params, setParams] = useState<{ action?: string; resource?: string }>({})

  const fetchLogs = async (p?: number) => {
    setLoading(true)
    const res = await auditApi.list({ ...params, page: p ?? page, pageSize: 20 })
    if (res.success && res.data) {
      setLogs(res.data.items)
      setTotal(res.data.total)
    }
    setLoading(false)
  }

  const fetchStats = async () => {
    const res = await auditApi.stats()
    if (res.success) setStats(res.data)
  }

  useEffect(() => { fetchLogs(1); fetchStats() }, [])

  const columns = [
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: '用户', dataIndex: 'userId', key: 'userId', width: 120 },
    { title: '操作', dataIndex: 'action', key: 'action', width: 100, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '资源', dataIndex: 'resource', key: 'resource', width: 200 },
    { title: '详情', dataIndex: 'details', key: 'details', ellipsis: true },
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
          <Table dataSource={logs} columns={columns} rowKey="id" loading={loading} pagination={{ current: page, pageSize: 20, total, onChange: (p) => { setPage(p); fetchLogs(p) } }} size="small" />
        </Space>
      </Card>
    </div>
  )
}
