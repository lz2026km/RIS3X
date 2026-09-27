import {
  iheApi,
  xdsApi,
  type IheStatus,
  type AffinityDomain,
  type XdsDocumentEntry,
} from '../../services/api/integrationApi'
import { Card, Tabs, Button, Space, Tag, message, Descriptions, Empty, Row, Col, Statistic, Drawer, Form, Input, Alert, Popconfirm, Table, Select } from 'antd'
import { Network, Activity, Users, Fingerprint, Globe, Edit3, RotateCcw, Save, RefreshCw, Send, Search, UploadCloud, Database, Download } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'
import { Inbox } from 'lucide-react'
import { t } from '../../i18n/appI18n'

const toB64 = (s: string): string => {
  try { return btoa(unescape(encodeURIComponent(s))) } catch { return s }
}

interface RetrievedPreview { content?: string; status: string; error?: string }

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

  // [G005 W10-Interop] XDS.b / XCA / XDR 状态
  const [xdsForm] = Form.useForm()
  const [xdsDocs, setXdsDocs] = useState<XdsDocumentEntry[]>([])
  const [xdsLoading, setXdsLoading] = useState(false)
  const [xdsSelected, setXdsSelected] = useState<string[]>([])
  const [xdsRetrieved, setXdsRetrieved] = useState<Record<string, RetrievedPreview>>({})
  const [xdsStats, setXdsStats] = useState<{ total: number; bytes: number; byCommunity: Array<{ homeCommunityId: string; count: number }> } | null>(null)

  const [xcaScope, setXcaScope] = useState<string>('ALL')
  const [xcaCommunities, setXcaCommunities] = useState<Array<{ homeCommunityId: string; count: number }>>([])
  const [xcaDocs, setXcaDocs] = useState<XdsDocumentEntry[]>([])
  const [xcaLoading, setXcaLoading] = useState(false)

  const [xdrForm] = Form.useForm()
  const [xdrLoading, setXdrLoading] = useState(false)

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

  // ── [G005 W10-Interop] XDS.b / XCA / XDR handlers ──
  const loadXdsStats = useCallback(async () => {
    try {
      const res = await xdsApi.stats()
      if (res.success) setXdsStats(res.data.stats)
    } catch { /* 非阻塞 */ }
  }, [])

  useEffect(() => { loadXdsStats() }, [loadXdsStats])

  const handleXdsQuery = async () => {
    try {
      const v = await xdsForm.validateFields(['patientId']).catch(() => null)
      if (v === null) return
      setXdsLoading(true)
      const res = await xdsApi.query({ patientId: xdsForm.getFieldValue('patientId') || undefined })
      if (res.success) {
        setXdsDocs(res.data.documents)
        setXdsRetrieved({})
        setXdsSelected([])
        await loadXdsStats()
      } else message.error(res.error?.message ?? t('w10Interop.xds.queryFailed'))
    } catch {
      message.error(t('w10Interop.xds.queryFailed'))
    } finally {
      setXdsLoading(false)
    }
  }

  const handleXdsProvide = async () => {
    try {
      const v = await xdsForm.validateFields().catch(() => null)
      if (v === null) return
      setXdsLoading(true)
      const content: string | undefined = v.content ? toB64(v.content) : undefined
      const res = await xdsApi.provide({
        patientId: v.patientId,
        repositoryUniqueId: v.repositoryUniqueId || undefined,
        homeCommunityId: v.homeCommunityId || undefined,
        documents: [{
          title: v.docTitle || 'XDS 文档',
          classCode: v.classCode || 'RAD',
          formatCode: v.formatCode || 'urn:ihe:rad:1',
          mimeType: v.mimeType || 'application/pdf',
          authorPerson: v.authorPerson || undefined,
          content,
        }],
      })
      if (res.success) {
        message.success(t('w10Interop.xds.provided', { count: res.data.documentIds.length }))
        await handleXdsQuery()
      } else message.error(res.error?.message ?? t('w10Interop.xds.provideFailed'))
    } catch {
      message.error(t('w10Interop.xds.provideFailed'))
    } finally {
      setXdsLoading(false)
    }
  }

  const handleXdsRetrieve = async () => {
    const targets = xdsDocs.filter((d) => xdsSelected.includes(d.uniqueId))
    if (targets.length === 0) return
    try {
      setXdsLoading(true)
      const res = await xdsApi.retrieve(targets.map((d) => ({ repositoryUniqueId: d.repositoryUniqueId, documentUniqueId: d.uniqueId })))
      if (res.success) {
        const map: Record<string, RetrievedPreview> = { ...xdsRetrieved }
        for (const r of res.data.results) {
          map[r.documentUniqueId] = { content: r.content, status: r.status, error: r.error }
        }
        setXdsRetrieved(map)
        message.success(t('w10Interop.xds.retrieved', { count: res.data.successCount, failed: res.data.failureCount }))
      } else message.error(res.error?.message ?? t('w10Interop.xds.retrieveFailed'))
    } catch {
      message.error(t('w10Interop.xds.retrieveFailed'))
    } finally {
      setXdsLoading(false)
    }
  }

  const handleXcaQuery = async () => {
    try {
      setXcaLoading(true)
      const res = await xdsApi.crossGatewayQuery({ homeCommunityId: xcaScope, limit: 100 })
      if (res.success) {
        setXcaDocs(res.data.documents)
        setXcaCommunities(res.data.communities)
        message.success(t('w10Interop.xca.queryDone', { count: res.data.total, communities: res.data.communities.length }))
      } else message.error(res.error?.message ?? t('w10Interop.xca.queryFailed'))
    } catch {
      message.error(t('w10Interop.xca.queryFailed'))
    } finally {
      setXcaLoading(false)
    }
  }

  const handleXcaRetrieve = async () => {
    const targets = xcaDocs.filter((d) => xdsRetrieved[d.uniqueId] === undefined)
    const list = targets.length > 0 ? targets : xcaDocs
    if (list.length === 0) return
    try {
      setXcaLoading(true)
      const res = await xdsApi.crossGatewayRetrieve(xcaScope, list.map((d) => ({ repositoryUniqueId: d.repositoryUniqueId, documentUniqueId: d.uniqueId })))
      if (res.success) {
        const map: Record<string, RetrievedPreview> = { ...xdsRetrieved }
        for (const r of res.data.results) map[r.documentUniqueId] = { content: r.content, status: r.status, error: r.error }
        setXdsRetrieved(map)
        message.success(t('w10Interop.xca.retrieveDone', { count: res.data.successCount, failed: res.data.failureCount }))
      } else message.error(res.error?.message ?? t('w10Interop.xca.retrieveFailed'))
    } catch {
      message.error(t('w10Interop.xca.retrieveFailed'))
    } finally {
      setXcaLoading(false)
    }
  }

  const handleXdrProvide = async () => {
    try {
      const v = await xdrForm.validateFields().catch(() => null)
      if (v === null) return
      setXdrLoading(true)
      const res = await xdsApi.provideDirect({
        patientId: v.patientId,
        homeCommunityId: v.homeCommunityId || undefined,
        documents: [{
          title: v.docTitle || 'XDR 直传文档',
          content: v.content ? toB64(v.content) : undefined,
        }],
      })
      if (res.success) {
        message.success(t('w10Interop.xdr.sent', { count: res.data.documentIds.length, repo: res.data.repositoryUniqueId }))
        await loadXdsStats()
      } else message.error(res.error?.message ?? t('w10Interop.xdr.failed'))
    } catch {
      message.error(t('w10Interop.xdr.failed'))
    } finally {
      setXdrLoading(false)
    }
  }

  const xdsColumns = [
    { title: t('w10Interop.xds.uniqueId'), dataIndex: 'uniqueId', key: 'uniqueId', width: 220, ellipsis: true },
    { title: t('w10Interop.xds.docTitle'), dataIndex: 'title', key: 'title' },
    { title: t('w10Interop.xds.classCode'), dataIndex: 'classCode', key: 'classCode', width: 80 },
    { title: t('w10Interop.xds.formatCode'), dataIndex: 'formatCode', key: 'formatCode', width: 130 },
    { title: t('w10Interop.xds.community'), dataIndex: 'homeCommunityId', key: 'homeCommunityId', width: 220, ellipsis: true },
    { title: t('w10Interop.xds.size'), dataIndex: 'size', key: 'size', width: 90 },
    { title: t('w10Interop.xds.creationTime'), dataIndex: 'creationTime', key: 'creationTime', width: 170, render: (v: string) => (v ? new Date(v).toLocaleString() : '-') },
    {
      title: t('w10Interop.xds.status'), dataIndex: 'availabilityStatus', key: 'availabilityStatus', width: 110,
      render: (v: string) => <Tag color={v === 'APPROVED' ? 'green' : 'orange'}>{v}</Tag>,
    },
  ]

  const retrievedPreview = Object.entries(xdsRetrieved).length > 0 ? (
    <Card size="small" title={t('w10Interop.xds.contentPreview')} style={{ marginTop: 12 }}>
      <Descriptions column={1} size="small" bordered>
        {Object.entries(xdsRetrieved).map(([uid, r]) => (
          <Descriptions.Item key={uid} label={uid}>
            {r.status === 'SUCCESS'
              ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{r.content ? (() => { try { return atob(r.content) } catch { return r.content } })() : '-'}</pre>
              : <Tag color="red">{r.error ?? 'FAILURE'}</Tag>}
          </Descriptions.Item>
        ))}
      </Descriptions>
    </Card>
  ) : null

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
    {
      key: 'xds',
      label: <Space><Database size={14} />{t('w10Interop.ihe.tabXds')}</Space>,
      children: (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}>
          <Card size="small" title={t('w10Interop.xds.provide')}>
            <Form form={xdsForm} name="iheXdsForm" layout="vertical" size="small">
              <Form.Item label={t('w10Interop.xds.patientId')} name="patientId" rules={[{ required: true, message: t('w10Interop.xds.requiredPatient') }]}>
                <Input placeholder="P000023" />
              </Form.Item>
              <Form.Item label={t('w10Interop.xds.docTitle')} name="docTitle">
                <Input placeholder="胸部 CT 报告" />
              </Form.Item>
              <Form.Item label={t('w10Interop.xds.classCode')} name="classCode">
                <Input placeholder="RAD" />
              </Form.Item>
              <Form.Item label={t('w10Interop.xds.formatCode')} name="formatCode">
                <Input placeholder="urn:ihe:rad:1" />
              </Form.Item>
              <Form.Item label={t('w10Interop.xds.mimeType')} name="mimeType">
                <Input placeholder="application/pdf" />
              </Form.Item>
              <Form.Item label={t('w10Interop.xds.repository')} name="repositoryUniqueId">
                <Input placeholder="1.2.840.113556.1.8000.2554.1.100" />
              </Form.Item>
              <Form.Item label={t('w10Interop.xds.community')} name="homeCommunityId">
                <Input placeholder="urn:oid:1.2.840.113556.1.8000.2554.1" />
              </Form.Item>
              <Form.Item label={t('w10Interop.xds.author')} name="authorPerson">
                <Input placeholder="王建华^主任医师" />
              </Form.Item>
              <Form.Item label={t('w10Interop.xds.content')} name="content">
                <Input.TextArea rows={3} placeholder="文档文本内容" />
              </Form.Item>
              <Space>
                <Button type="primary" icon={<UploadCloud size={12} />} loading={xdsLoading} onClick={handleXdsProvide}>{t('w10Interop.xds.provideBtn')}</Button>
                <Button icon={<Search size={12} />} loading={xdsLoading} onClick={handleXdsQuery}>{t('w10Interop.xds.queryBtn')}</Button>
              </Space>
            </Form>
          </Card>
          <div>
            {xdsStats && (
              <Card size="small" title={t('w10Interop.xds.stats')} style={{ marginBottom: 12 }}>
                <Space wrap>
                  <Tag color="blue">{t('w10Interop.stat.total')}: {xdsStats.total}</Tag>
                  <Tag color="purple">bytes: {xdsStats.bytes}</Tag>
                  {xdsStats.byCommunity.map((c) => (
                    <Tag key={c.homeCommunityId} color="cyan">{c.homeCommunityId}: {c.count}</Tag>
                  ))}
                </Space>
              </Card>
            )}
            <Card
              size="small"
              title={<Space>{t('w10Interop.xds.documents')}<Tag>{xdsDocs.length}</Tag></Space>}
              extra={<Button size="small" icon={<Download size={12} />} disabled={xdsSelected.length === 0} loading={xdsLoading} onClick={handleXdsRetrieve}>{t('w10Interop.xds.retrieveBtn')}</Button>}
            >
              <Table<XdsDocumentEntry>
                rowKey="uniqueId"
                size="small"
                loading={xdsLoading}
                dataSource={xdsDocs}
                columns={xdsColumns}
                pagination={{ pageSize: 8, size: 'small' }}
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: <Empty image={<Inbox size={40} style={{ opacity: 0.4 }} />} description={t('w10Interop.xds.noDocs')} /> }}
                rowSelection={{
                  selectedRowKeys: xdsSelected,
                  onChange: (keys) => setXdsSelected(keys.map((k) => String(k))),
                }}
              />
              {retrievedPreview}
            </Card>
          </div>
        </div>
      ),
    },
    {
      key: 'xca',
      label: <Space><Globe size={14} />{t('w10Interop.ihe.tabXca')}</Space>,
      children: (
        <div>
          <Card size="small" style={{ marginBottom: 12 }}>
            <Space wrap>
              <span>{t('w10Interop.xca.homeCommunity')}:</span>
              <Select value={xcaScope} onChange={setXcaScope} style={{ width: 320 }}
                options={[
                  { value: 'ALL', label: t('w10Interop.xca.scopeAll') },
                  { value: 'urn:oid:1.2.840.113556.1.8000.2554.1', label: 'urn:oid:1.2.840.113556.1.8000.2554.1' },
                  { value: 'urn:oid:1.2.840.113556.1.8000.2554.2', label: 'urn:oid:1.2.840.113556.1.8000.2554.2' },
                ]} />
              <Button type="primary" icon={<Search size={12} />} loading={xcaLoading} onClick={handleXcaQuery}>{t('w10Interop.xca.queryBtn')}</Button>
              <Button icon={<Download size={12} />} loading={xcaLoading} disabled={xcaDocs.length === 0} onClick={handleXcaRetrieve}>{t('w10Interop.xca.retrieveBtn')}</Button>
            </Space>
            {xcaCommunities.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Space wrap>
                  <span>{t('w10Interop.xca.communities')}:</span>
                  {xcaCommunities.map((c) => <Tag key={c.homeCommunityId} color="geekblue">{c.homeCommunityId}: {c.count}</Tag>)}
                </Space>
              </div>
            )}
          </Card>
          <Card size="small" title={<Space>{t('w10Interop.xca.documents')}<Tag>{xcaDocs.length}</Tag></Space>}>
            <Table<XdsDocumentEntry>
              rowKey="uniqueId"
              size="small"
              loading={xcaLoading}
              dataSource={xcaDocs}
              columns={xdsColumns}
              pagination={{ pageSize: 8, size: 'small' }}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: <Empty image={<Inbox size={40} style={{ opacity: 0.4 }} />} description={t('w10Interop.xds.noDocs')} /> }}
            />
            {retrievedPreview}
          </Card>
        </div>
      ),
    },
    {
      key: 'xdr',
      label: <Space><Send size={14} />{t('w10Interop.ihe.tabXdr')}</Space>,
      children: (
        <Card size="small" title={t('w10Interop.xdr.provideBtn')}>
          <Form form={xdrForm} name="iheXdrForm" layout="vertical" size="small" style={{ maxWidth: 480 }}>
            <Form.Item label={t('w10Interop.xds.patientId')} name="patientId" rules={[{ required: true, message: t('w10Interop.xds.requiredPatient') }]}>
              <Input placeholder="P000023" />
            </Form.Item>
            <Form.Item label={t('w10Interop.xdr.targetCommunity')} name="homeCommunityId">
              <Select allowClear placeholder="urn:oid:..." options={[
                { value: 'urn:oid:1.2.840.113556.1.8000.2554.1', label: '本社区 (2554.1)' },
                { value: 'urn:oid:1.2.840.113556.1.8000.2554.2', label: '外院社区 (2554.2)' },
              ]} />
            </Form.Item>
            <Form.Item label={t('w10Interop.xds.docTitle')} name="docTitle">
              <Input placeholder="XDR 直传文档" />
            </Form.Item>
            <Form.Item label={t('w10Interop.xds.content')} name="content">
              <Input.TextArea rows={3} placeholder="文档文本内容" />
            </Form.Item>
            <Button type="primary" icon={<Send size={12} />} loading={xdrLoading} onClick={handleXdrProvide}>{t('w10Interop.xdr.provideBtn')}</Button>
          </Form>
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
