import { iheApi, type IheStatus, type AffinityDomain } from '../../services/api/integrationApi'
import { Card, Tabs, Button, Space, Tag, message, Descriptions, Empty, Row, Col, Statistic, Drawer, Form, Input, Alert, Popconfirm } from 'antd'
import { Network, Activity, Users, Fingerprint, Globe, Edit3, RotateCcw, Save, RefreshCw, Send } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'
import { Inbox } from 'lucide-react'
import { t } from '../../i18n/appI18n'

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
      if (!statusRes.success) setLoadError(statusRes.error?.message ?? t('iheManager.statusLoadFailed'))
    } catch {
      setLoadError(t('iheManager.serviceLoadFailed'))
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
        message.success(t('iheManager.domainSaved'))
        setDomain(res.data)
        setDomainDrawerOpen(false)
        fetchStatus()
      } else {
        message.error(res.error?.message ?? t('iheManager.saveFailed'))
      }
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(t('iheManager.saveFailed'))
    } finally {
      setDomainSaving(false)
    }
  }

  const handleResetDomain = async () => {
    setDomainResetting(true)
    try {
      const res = await iheApi.resetAffinityDomain()
      if (res.success) {
        message.success(t('iheManager.domainReset'))
        setDomain(res.data)
        fetchStatus()
      } else {
        message.error(res.error?.message ?? t('iheManager.resetFailed'))
      }
    } catch {
      message.error(t('iheManager.resetFailed'))
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
        message.error(res.error?.message ?? t('iheManager.pixSendFailed'))
      }
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      setPixResult(null)
      message.error(t('iheManager.pixRequestFailed'))
    } finally {
      setPixSending(false)
    }
  }

  const tabItems = [
    {
      key: 'status',
      label: <Space><Activity size={14} />{t('iheManager.tabStatus')}</Space>,
      children: (
        <div>
          {loadError && <Alert type="warning" showIcon message={loadError} style={{ marginBottom: 12 }} />}
          <Card
            size="small"
            title={t('iheManager.integrationStatus')}
            extra={<Button size="small" icon={<RefreshCw size={12} />} onClick={fetchStatus} loading={loading}>{t('iheManager.refresh')}</Button>}
          >
            {status ? (
              <Row gutter={16}>
                <Col span={6}><Card><Statistic title={t('iheManager.pixRecords')} value={status.metrics.pixRecords} /></Card></Col>
                <Col span={6}><Card><Statistic title={t('iheManager.pdqCache')} value={status.metrics.pdqCache} /></Card></Col>
                <Col span={6}><Card><Statistic title={t('iheManager.pamLog')} value={status.metrics.pamLogSize} /></Card></Col>
                <Col span={6}><Card><Statistic title={t('iheManager.transactions')} value={status.transactions.length} suffix={t('iheManager.unitTypes')} /></Card></Col>
                <Col span={24} style={{ marginTop: 16 }}>
                  <Card size="small" title={t('iheManager.supportedTransactions')}>
                    <Space wrap>
                      {status.transactions.map(code => <Tag key={code} color="blue">{code}</Tag>)}
                    </Space>
                  </Card>
                </Col>
                <Col span={24} style={{ marginTop: 16 }}>
                  <Card size="small" title={t('iheManager.config')}>
                    <Tag color="cyan" style={{ fontSize: 14 }}>{status.profile}</Tag>
                  </Card>
                </Col>
              </Row>
            ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={loading ? t('iheManager.loading') : t('iheManager.noData')} />}
          </Card>
        </div>
      ),
    },
    {
      key: 'domain',
      label: <Space><Globe size={14} />{t('iheManager.tabDomain')}</Space>,
      children: (
        <Card
          size="small"
          title={t('iheManager.domainConfig')}
          extra={
            <Space>
              <Button size="small" icon={<Edit3 size={12} />} onClick={openDomainDrawer} disabled={!domain}>{t('iheManager.edit')}</Button>
              <Popconfirm title={t('iheManager.confirmReset')} onConfirm={handleResetDomain} okButtonProps={{ loading: domainResetting }}>
                <Button size="small" danger icon={<RotateCcw size={12} />}>{t('iheManager.reset')}</Button>
              </Popconfirm>
            </Space>
          }
        >
          {domain ? (
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label={t('iheManager.homeCommunityId')}>{domain.homeCommunityId}</Descriptions.Item>
              <Descriptions.Item label={t('iheManager.name')}>{domain.name}</Descriptions.Item>
              <Descriptions.Item label={t('iheManager.assigningAuthority')}>{domain.assigningAuthorityId}</Descriptions.Item>
              <Descriptions.Item label={t('iheManager.repositoryIds')}>{domain.repositoryUniqueIds?.join(', ')}</Descriptions.Item>
              <Descriptions.Item label={t('iheManager.registryEndpoint')}>{domain.registryEndpoint || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('iheManager.repositoryEndpoint')}>{domain.repositoryEndpoint || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('iheManager.pixManager')}>{domain.pixManagerEndpoint || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('iheManager.pdqSupplier')}>{domain.pdqSupplierEndpoint || '-'}</Descriptions.Item>
            </Descriptions>
          ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('iheManager.loading')} />}
        </Card>
      ),
    },
    {
      key: 'pix',
      label: <Space><Fingerprint size={14} />{t('iheManager.tabPix')}</Space>,
      children: (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card size="small" title={t('iheManager.pixCrossReference')}>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
              {t('iheManager.pixCrossReferenceDesc')}
            </p>
            <Button type="primary" onClick={() => window.location.hash = '#/ihe/pix'}>{t('iheManager.goPix')}</Button>
          </Card>
          <Card size="small" title={<Space><Send size={14} />{t('iheManager.pixNotifyTitle')}</Space>}>
            <Form form={pixForm} layout="vertical" size="small">
              <Form.Item label={t('iheManager.patientId')} name="patientId" rules={[{ required: true }]}>
                <Input placeholder="P000001" />
              </Form.Item>
              <Form.Item label={t('iheManager.assigningAuthority')} name="assigningAuthority">
                <Input placeholder="G005" />
              </Form.Item>
              <Form.Item label={t('iheManager.familyName')} name="family">
                <Input placeholder="张" />
              </Form.Item>
              <Form.Item label={t('iheManager.givenName')} name="given">
                <Input placeholder="三" />
              </Form.Item>
              <Button type="primary" icon={<Send size={12} />} loading={pixSending} onClick={handlePixNotify}>
                {t('iheManager.sendUpdate')}
              </Button>
            </Form>
            {pixResult && (
              <Descriptions column={1} size="small" bordered style={{ marginTop: 16 }}>
                <Descriptions.Item label={t('iheManager.transaction')}>{pixResult.transaction || '-'}</Descriptions.Item>
                <Descriptions.Item label="ACK">
                  <Tag color={pixResult.ack === 'AA' ? 'green' : pixResult.ack === 'AE' ? 'red' : 'orange'}>{pixResult.ack || '-'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('iheManager.messageId')}>{pixResult.messageId || '-'}</Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </div>
      ),
    },
    {
      key: 'pam',
      label: <Space><Users size={14} />{t('iheManager.tabPam')}</Space>,
      children: (
        <Card size="small" title={t('iheManager.pamTitle')}>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
            {t('iheManager.pamDesc')}
          </p>
          <Button type="primary" onClick={() => window.location.hash = '#/ihe/pam'}>{t('iheManager.goPam')}</Button>
        </Card>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Network size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('iheManager.title')}</span>
        <Tag color="cyan">PIX / PDQ / PAM</Tag>
        <Tag color="green">XDS.b</Tag>
      </Space>

      <Tabs activeKey={tab} onChange={setTab} items={tabItems} />

      <Drawer
        title={t('iheManager.editDomainConfig')}
        open={domainDrawerOpen}
        onClose={() => setDomainDrawerOpen(false)}
        width={520}
        extra={
          <Space>
            <Button icon={<Save size={14} />} type="primary" loading={domainSaving} onClick={handleSaveDomain}>
              {t('iheManager.save')}
            </Button>
          </Space>
        }
      >
        <Form form={domainForm} layout="vertical" size="small">
          <Form.Item label={t('iheManager.homeCommunityId')} name="homeCommunityId" rules={[{ required: true }]}>
            <Input placeholder="1.2.3.4.5.6.7.8.9" />
          </Form.Item>
          <Form.Item label={t('iheManager.name')} name="name" rules={[{ required: true }]}>
            <Input placeholder="G005 医疗联盟" />
          </Form.Item>
          <Form.Item label={t('iheManager.nameEn')} name="nameEn">
            <Input placeholder="G005 医疗联盟" />
          </Form.Item>
          <Form.Item label={t('iheManager.assigningAuthorityId')} name="assigningAuthorityId" rules={[{ required: true }]}>
            <Input placeholder="G005" />
          </Form.Item>
          <Form.Item label={t('iheManager.repositoryIdsComma')} name="repositoryUniqueIds" getValueFromEvent={(e) => e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)}>
            <Input placeholder="1.2.3.4.5.6.7.8.9.1" />
          </Form.Item>
          <Form.Item label={t('iheManager.registryEndpoint')} name="registryEndpoint">
            <Input placeholder="https://registry.g005.local:8443" />
          </Form.Item>
          <Form.Item label={t('iheManager.repositoryEndpoint')} name="repositoryEndpoint">
            <Input placeholder="https://repository.g005.local:8443" />
          </Form.Item>
          <Form.Item label={t('iheManager.pixManagerEndpoint')} name="pixManagerEndpoint">
            <Input placeholder="https://pix.g005.local:8443" />
          </Form.Item>
          <Form.Item label={t('iheManager.pdqSupplierEndpoint')} name="pdqSupplierEndpoint">
            <Input placeholder="https://pdq.g005.local:8443" />
          </Form.Item>
          <Form.Item label={t('iheManager.atnaEndpoint')} name="atnaEndpoint">
            <Input placeholder="https://atna.g005.local:8443" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}

export default IheManagerPage
