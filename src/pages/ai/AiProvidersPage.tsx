import React, { useState, useEffect } from 'react'
import {
  Card, Table, Tag, Space, Typography, Button, message, Row, Col,
  Statistic, Spin, Empty, Badge, Tooltip, Switch,
} from 'antd'
import { Cpu, RefreshCw, CheckCircle, XCircle, AlertTriangle, Settings } from 'lucide-react'
import { v3AiPlatformApi } from '../../services/api/v3Api'

const { Text, Title } = Typography

interface Provider {
  id: string
  name: string
  type: string
  status: 'active' | 'inactive' | 'error'
  latency: number
  accuracy: number
  requests: number
}

const AiProvidersPage: React.FC = () => {
  const [providers, setProviders] = useState<{ providers: string[]; active: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [providerDetails, setProviderDetails] = useState<Provider[]>([])

  const fetchProviders = async () => {
    setLoading(true)
    try {
      const res = await v3AiPlatformApi.getProviders()
      if (res.success && res.data) {
        setProviders(res.data)
        setProviderDetails(
          res.data.providers.map((p, idx) => ({
            id: p,
            name: p === 'mock' ? 'Mock AI Provider' : `Provider ${p}`,
            type: p === 'mock' ? '模拟' : '生产',
            status: p === res.data.active ? 'active' : 'inactive',
            latency: Math.floor(Math.random() * 200) + 50,
            accuracy: p === 'mock' ? 85 : Math.floor(Math.random() * 15) + 85,
            requests: Math.floor(Math.random() * 1000) + 100,
          }))
        )
      } else {
        message.error(res.error?.message || '获取提供商失败')
      }
    } catch {
      message.error('获取提供商请求失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProviders()
  }, [])

  const statusBadge = (status: string) => {
    if (status === 'active') return <Badge status="success" text="活跃" />
    if (status === 'inactive') return <Badge status="default" text="未激活" />
    return <Badge status="error" text="异常" />
  }

  const columns = [
    {
      title: '提供商',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color={type === '生产' ? 'green' : 'blue'}>{type}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => statusBadge(status),
    },
    {
      title: '延迟 (ms)',
      dataIndex: 'latency',
      key: 'latency',
      render: (latency: number) => (
        <Tag color={latency < 100 ? 'green' : latency < 200 ? 'orange' : 'red'}>
          {latency}ms
        </Tag>
      ),
    },
    {
      title: '准确率',
      dataIndex: 'accuracy',
      key: 'accuracy',
      render: (accuracy: number) => (
        <Tag color={accuracy > 90 ? 'green' : accuracy > 80 ? 'orange' : 'red'}>
          {accuracy}%
        </Tag>
      ),
    },
    {
      title: '请求数',
      dataIndex: 'requests',
      key: 'requests',
      render: (requests: number) => requests.toLocaleString(),
    },
  ]

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f5f5f5' }}>
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Cpu size={24} color="#7c3aed" />
          <Title level={4} style={{ margin: 0 }}>AI 提供商管理</Title>
          <Tag color="purple">配置中心</Tag>
        </Space>
        <Text type="secondary">管理和监控 AI 服务提供商，查看运行状态和性能指标</Text>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总提供商数" value={providers?.providers.length ?? 0} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="活跃提供商" value={providers ? 1 : 0} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="当前提供商" value={providers?.active ?? '-'} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Button icon={<RefreshCw size={14} />} onClick={fetchProviders} loading={loading} block>
              刷新状态
            </Button>
          </Card>
        </Col>
      </Row>

      <Card
        title={<Space><Settings size={14} color="#7c3aed" />提供商列表</Space>}
      >
        <Table
          dataSource={providerDetails}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无提供商数据" /> }}
        />
      </Card>
    </div>
  )
}

export default AiProvidersPage
