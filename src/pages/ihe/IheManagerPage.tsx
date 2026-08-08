import React, { useState, useEffect, useCallback } from 'react'
import { Card, Tabs, Button, Space, Tag, message, Descriptions, Empty, Row, Col, Statistic, Drawer, Form, Input, Alert, Popconfirm } from 'antd'
import { Network, Activity, Users, Fingerprint, Globe, Edit3, RotateCcw, Save, RefreshCw, Send } from 'lucide-react'
import { iheApi, type IheStatus, type AffinityDomain } from '../../services/api/integrationApi'

export const IheManagerPage: React.FC = () => {
  const [tab, setTab] = useState('status')
  const [status, setStatus] = useState<IheStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [domain, setDomain] = useState<AffinityDomain | null>(null)

  const [domainDrawerOpen, setDomainDrawerOpen] = useState(false)
  const [domainSaving, setDomainSaving] = useState(false)
  const [domainResetting, setDomainResetting] = useState(false)
  const [domainForm] = Form.useForm<AffinityDomain>()

  const [pixForm] = Form.useForm()
  const [pixSending, setPixSending] = useState(false)
  const [pixResult, setPixResult] = useState<{ transaction?: string; ack?: string; messageId?: string } | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [statusRes, domainRes] = await Promise.all([
        iheApi.getStatus(),
        iheApi.getAffinityDomain(),
      ])
      if (statusRes.success && statusRes.data) setStatus(statusRes.data)
      if (domainRes.success && domainRes.data) setDomain(domainRes.data)
      if (!statusRes.success) setLoadError(statusRes.error?.message ?? '状态加载失败')
    } catch {
      setLoadError('IHE 服务状态加载失败，当前展示演示数据')
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

  const openDomainDrawer = () => {
    if (domain) domainForm.setFieldsValue(domain)
    setDomainDrawerOpen(true)
  }

  const handleSaveDomain = async () => {
    try {
      const values = await domainForm.validateFields()
      setDomainSaving(true)
      const res = await iheApi.setAffinityDomain(values)
      if (res.success) {
        message.success('Affinity Domain 配置已保存')
        setDomain(res.data)
        setDomainDrawerOpen(false)
        fetchStatus()
      } else {
        message.error(res.error?.message ?? '保存失败')
      }
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error('保存失败')
    } finally {
      setDomainSaving(false)
    }
  }

  const handleResetDomain = async () => {
    setDomainResetting(true)
    try {
      const res = await iheApi.resetAffinityDomain()
      if (res.success) {
        message.success('Affinity Domain 已重置为默认')
        setDomain(res.data)
        fetchStatus()
      } else {
        message.error(res.error?.message ?? '重置失败')
      }
    } catch {
      message.error('重置失败')
    } finally {
      setDomainResetting(false)
    }
  }

  const handlePixNotify = async () => {
    try {
      const values = await pixForm.validateFields()
      setPixSending(true)
      const res = await iheApi.pixUpdateNotification({
        patientId: values.patientId,
        assigningAuthority: values.assigningAuthority || 'G005',
        identifiers: values.identifiers?.length
          ? values.identifiers
          : [{ domain: values.assigningAuthority || 'G005', value: values.patientId, assigningAuthority: values.assigningAuthority || 'G005' }],
        name: { family: values.family || '未知', given: [values.given || '未知'] },
        birthDate: '',
        gender: 'U',
      })
      if (res.success) {
        setPixResult(res.data)
        message.success(`PIX 更新通知已发送 (${res.data?.ack ?? '-'})`)
      } else {
        setPixResult(null)
        message.error(res.error?.message ?? 'PIX 通知发送失败')
      }
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      setPixResult(null)
      message.error('PIX 通知请求失败')
    } finally {
      setPixSending(false)
    }
  }

  const tabItems = [
    {
      key: 'status',
      label: <Space><Activity size={14} />IHE 状态</Space>,
      children: (
        <div>
          {loadError && <Alert type="warning" showIcon message={loadError} style={{ marginBottom: 12 }} />}
          <Card
            size="small"
            title="集成状态"
            extra={<Button size="small" icon={<RefreshCw size={12} />} onClick={fetchStatus} loading={loading}>刷新</Button>}
          >
            {status ? (
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
            ) : <Empty description={loading ? "加载中..." : "暂无数据"} />}
          </Card>
        </div>
      ),
    },
    {
      key: 'domain',
      label: <Space><Globe size={14} />Affinity Domain</Space>,
      children: (
        <Card
          size="small"
          title="Affinity Domain 配置"
          extra={
            <Space>
              <Button size="small" icon={<Edit3 size={12} />} onClick={openDomainDrawer} disabled={!domain}>编辑</Button>
              <Popconfirm title="确认重置为默认配置？" onConfirm={handleResetDomain} okButtonProps={{ loading: domainResetting }}>
                <Button size="small" danger icon={<RotateCcw size={12} />}>重置</Button>
              </Popconfirm>
            </Space>
          }
        >
          {domain ? (
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
          ) : <Empty description="加载中..." />}
        </Card>
      ),
    },
    {
      key: 'pix',
      label: <Space><Fingerprint size={14} />PIX 管理</Space>,
      children: (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card size="small" title="PIX 患者身份交叉引用">
            <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
              跳转到 PIX 管理页面进行 Patient ID 跨域映射管理。
            </p>
            <Button type="primary" onClick={() => window.location.hash = '#/ihe/pix'}>前往 PIX 管理</Button>
          </Card>
          <Card size="small" title={<Space><Send size={14} />PIX 更新通知 (ITI-10)</Space>}>
            <Form form={pixForm} layout="vertical" size="small">
              <Form.Item label="患者 ID" name="patientId" rules={[{ required: true }]}>
                <Input placeholder="P000001" />
              </Form.Item>
              <Form.Item label="Assigning Authority" name="assigningAuthority">
                <Input placeholder="G005" />
              </Form.Item>
              <Form.Item label="姓名 (姓氏)" name="family">
                <Input placeholder="张" />
              </Form.Item>
              <Form.Item label="姓名 (名字)" name="given">
                <Input placeholder="三" />
              </Form.Item>
              <Button type="primary" icon={<Send size={12} />} loading={pixSending} onClick={handlePixNotify}>
                发送更新通知
              </Button>
            </Form>
            {pixResult && (
              <Descriptions column={1} size="small" bordered style={{ marginTop: 16 }}>
                <Descriptions.Item label="Transaction">{pixResult.transaction || '-'}</Descriptions.Item>
                <Descriptions.Item label="ACK">
                  <Tag color={pixResult.ack === 'AA' ? 'green' : pixResult.ack === 'AE' ? 'red' : 'orange'}>{pixResult.ack || '-'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Message ID">{pixResult.messageId || '-'}</Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </div>
      ),
    },
    {
      key: 'pam',
      label: <Space><Users size={14} />PAM 管理</Space>,
      children: (
        <Card size="small" title="患者管理 (PAM)">
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
      <Space style={{ marginBottom: 16 }} wrap>
        <Network size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>IHE 集成管理</span>
        <Tag color="cyan">PIX / PDQ / PAM</Tag>
        <Tag color="green">XDS.b</Tag>
      </Space>

      <Tabs activeKey={tab} onChange={setTab} items={tabItems} />

      <Drawer
        title="编辑 Affinity Domain 配置"
        open={domainDrawerOpen}
        onClose={() => setDomainDrawerOpen(false)}
        width={520}
        extra={
          <Space>
            <Button icon={<Save size={14} />} type="primary" loading={domainSaving} onClick={handleSaveDomain}>
              保存
            </Button>
          </Space>
        }
      >
        <Form form={domainForm} layout="vertical" size="small">
          <Form.Item label="Home Community ID" name="homeCommunityId" rules={[{ required: true }]}>
            <Input placeholder="1.2.3.4.5.6.7.8.9" />
          </Form.Item>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="G005 医疗联盟" />
          </Form.Item>
          <Form.Item label="名称 (英文)" name="nameEn">
            <Input placeholder="G005 Medical Alliance" />
          </Form.Item>
          <Form.Item label="Assigning Authority ID" name="assigningAuthorityId" rules={[{ required: true }]}>
            <Input placeholder="G005" />
          </Form.Item>
          <Form.Item label="Repository Unique IDs (逗号分隔)" name="repositoryUniqueIds" getValueFromEvent={(e) => e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)}>
            <Input placeholder="1.2.3.4.5.6.7.8.9.1" />
          </Form.Item>
          <Form.Item label="Registry Endpoint" name="registryEndpoint">
            <Input placeholder="https://registry.g005.local:8443" />
          </Form.Item>
          <Form.Item label="Repository Endpoint" name="repositoryEndpoint">
            <Input placeholder="https://repository.g005.local:8443" />
          </Form.Item>
          <Form.Item label="PIX Manager Endpoint" name="pixManagerEndpoint">
            <Input placeholder="https://pix.g005.local:8443" />
          </Form.Item>
          <Form.Item label="PDQ Supplier Endpoint" name="pdqSupplierEndpoint">
            <Input placeholder="https://pdq.g005.local:8443" />
          </Form.Item>
          <Form.Item label="ATNA Endpoint" name="atnaEndpoint">
            <Input placeholder="https://atna.g005.local:8443" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}

export default IheManagerPage
