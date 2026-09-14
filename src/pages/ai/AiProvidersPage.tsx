import { v3AiPlatformApi } from '../../services/api/v3Api'
import { t } from '../../i18n/appI18n'
import { Card, Table, Tag, Space, Typography, Button, message, Row, Col, Statistic, Empty, Badge } from 'antd'
import { Cpu, RefreshCw, Settings } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { Inbox } from 'lucide-react'

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
          res.data.providers.map((p, _idx) => ({
            id: p,
            name: `Provider ${p}`,
            type: '生产',
            status: p === res.data.active ? 'active' : 'inactive',
            latency: 0,
            accuracy: 0,
            requests: 0,
          }))
        )
      } else {
        message.error(res.error?.message || t('aiProviders.fetchFailed'))
      }
    } catch (err) { console.error('[AiProviders] fetchProviders failed:', err); message.error(t('aiProviders.fetchRequestFailed')) } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProviders()
  }, [])

  const statusBadge = (status: string) => {
    if (status === 'active') return <Badge status="success" text={t('aiProviders.active')} />
    if (status === 'inactive') return <Badge status="default" text={t('aiProviders.inactive')} />
    return <Badge status="error" text={t('aiProviders.error')} />
  }

  const columns = [
    {
      title: t('aiProviders.colProvider'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: t('aiProviders.colType'),
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color={type === '生产' ? 'green' : 'blue'}>{type}</Tag>,
    },
    {
      title: t('aiProviders.colStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => statusBadge(status),
    },
    {
      title: t('aiProviders.colLatency'),
      dataIndex: 'latency',
      key: 'latency',
      render: (latency: number) => (
        <Tag color={latency < 100 ? 'green' : latency < 200 ? 'orange' : 'red'}>
          {latency}ms
        </Tag>
      ),
    },
    {
      title: t('aiProviders.colAccuracy'),
      dataIndex: 'accuracy',
      key: 'accuracy',
      render: (accuracy: number) => (
        <Tag color={accuracy > 90 ? 'green' : accuracy > 80 ? 'orange' : 'red'}>
          {accuracy}%
        </Tag>
      ),
    },
    {
      title: t('aiProviders.colRequests'),
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
          <Title level={4} style={{ margin: 0 }}>{t('aiProviders.title')}</Title>
          <Tag color="purple">{t('aiProviders.tagConfig')}</Tag>
        </Space>
        <Text type="secondary">{t('aiProviders.subtitle')}</Text>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title={t('aiProviders.totalProviders')} value={providers?.providers.length ?? 0} styles={{ content: {  color: '#2563eb'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('aiProviders.activeProviders')} value={providers ? 1 : 0} styles={{ content: {  color: '#52c41a'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('aiProviders.currentProvider')} value={providers?.active ?? '-'} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Button icon={<RefreshCw size={14} />} onClick={fetchProviders} loading={loading} block>
              {t('aiProviders.refresh')}
            </Button>
          </Card>
        </Col>
      </Row>

      <Card
        title={<Space><Settings size={14} color="#7c3aed" />{t('aiProviders.list')}</Space>}
      >
        <Table
          dataSource={providerDetails}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('aiProviders.empty')} /> }}
        scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  )
}

export default AiProvidersPage
