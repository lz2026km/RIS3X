import React, { useState, useEffect, useCallback } from 'react'
import { Card, Tabs, Button, Space, Tag, message, Descriptions, Empty, Row, Col, Statistic } from 'antd'
import { Network, Activity, Users, Fingerprint, Globe } from 'lucide-react'
import { iheApi, type IheStatus, type AffinityDomain } from '../../services/api/integrationApi'

export const IheManagerPage: React.FC = () => {
  const [tab, setTab] = useState('status')
  const [status, setStatus] = useState<IheStatus | null>(null)
  const [_loading, setLoading] = useState(false)
  const [domain, setDomain] = useState<AffinityDomain | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const [statusRes, domainRes] = await Promise.all([
        iheApi.getStatus(),
        iheApi.getAffinityDomain(),
      ])
      if (statusRes.success && statusRes.data) setStatus(statusRes.data)
      if (domainRes.success && domainRes.data) setDomain(domainRes.data)
    } catch {
      message.warning('IHE 服务状态加载失败，使用演示数据')
      setStatus({
        profile: 'XDS.b / PIX / PDQ / PAM',
        affinityDomain: {
          homeCommunityId: '1.2.3.4.5.6.7.8.9',
          name: 'G005 医疗联盟',
          repositoryUniqueIds: ['1.2.3.4.5.6.7.8.9.1'],
          assigningAuthorityId: 'G005',
        },
        metrics: { pixRecords: 12345, pdqCache: 892, pamLogSize: 567 },
        transactions: ['ITI-8', 'ITI-9', 'ITI-21', 'ITI-31', 'ITI-41', 'ITI-43', 'ITI-44'],
      })
      setDomain({
        homeCommunityId: '1.2.3.4.5.6.7.8.9',
        name: 'G005 医疗联盟',
        nameEn: 'G005 Medical Alliance',
        repositoryUniqueIds: ['1.2.3.4.5.6.7.8.9.1'],
        assigningAuthorityId: 'G005',
        registryEndpoint: 'https://registry.g005.local:8443',
        repositoryEndpoint: 'https://repository.g005.local:8443',
        pixManagerEndpoint: 'https://pix.g005.local:8443',
        pdqSupplierEndpoint: 'https://pdq.g005.local:8443',
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const tabItems = [
    {
      key: 'status',
      label: <Space><Activity size={14} />IHE 状态</Space>,
      children: status ? (
        <Row gutter={16}>
          <Col span={6}><Card><Statistic title="PIX 记录数" value={status.metrics.pixRecords} /></Card></Col>
          <Col span={6}><Card><Statistic title="PDQ 缓存" value={status.metrics.pdqCache} /></Card></Col>
          <Col span={6}><Card><Statistic title="PAM 日志" value={status.metrics.pamLogSize} /></Card></Col>
          <Col span={6}><Card><Statistic title="交易" value={status.transactions.length} suffix="种" /></Card></Col>
          <Col span={24} style={{ marginTop: 16 }}>
            <Card size="small" title="支持的 IHE 事务">
              <Space wrap>
                {status.transactions.map(t => <Tag key={t} color="blue">{t}</Tag>)}
              </Space>
            </Card>
          </Col>
          <Col span={24} style={{ marginTop: 16 }}>
            <Card size="small" title="配置">
              <Tag color="cyan" style={{ fontSize: 14 }}>{status.profile}</Tag>
            </Card>
          </Col>
        </Row>
      ) : <Empty description="加载中..." />
    },
    {
      key: 'domain',
      label: <Space><Globe size={14} />Affinity Domain</Space>,
      children: domain ? (
        <Card size="small" title="Affinity Domain 配置">
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Home Community ID">{domain.homeCommunityId}</Descriptions.Item>
            <Descriptions.Item label="名称">{domain.name}</Descriptions.Item>
            <Descriptions.Item label="Assigning Authority">{domain.assigningAuthorityId}</Descriptions.Item>
            <Descriptions.Item label="Repository IDs">{domain.repositoryUniqueIds?.join(', ')}</Descriptions.Item>
            <Descriptions.Item label="Registry Endpoint">{domain.registryEndpoint || '-'}</Descriptions.Item>
            <Descriptions.Item label="Repository Endpoint">{domain.repositoryEndpoint || '-'}</Descriptions.Item>
            <Descriptions.Item label="PIX Manager">{domain.pixManagerEndpoint || '-'}</Descriptions.Item>
            <Descriptions.Item label="PDQ Supplier">{domain.pdqSupplierEndpoint || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>
      ) : <Empty description="加载中..." />
    },
    {
      key: 'pix',
      label: <Space><Fingerprint size={14} />PIX 管理</Space>,
      children: (
        <Card size="small" title="PIX Patient Identity Cross-reference">
          <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
            跳转到 PIX 管理页面进行 Patient ID 跨域映射管理。
          </p>
          <Button type="primary" onClick={() => window.location.hash = '#/ihe/pix'}>前往 PIX 管理</Button>
        </Card>
      ),
    },
    {
      key: 'pam',
      label: <Space><Users size={14} />PAM 管理</Space>,
      children: (
        <Card size="small" title="Patient Administration Management">
          <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
            跳转到 PAM 管理页面进行患者就诊信息管理。
          </p>
          <Button type="primary" onClick={() => window.location.hash = '#/ihe/pam'}>前往 PAM 管理</Button>
        </Card>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Network size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>IHE 集成管理</span>
        <Tag color="cyan">PIX / PDQ / PAM</Tag>
        <Tag color="green">XDS.b</Tag>
      </Space>

      <Tabs activeKey={tab} onChange={setTab} items={tabItems} />
    </div>
  )
}

export default IheManagerPage
