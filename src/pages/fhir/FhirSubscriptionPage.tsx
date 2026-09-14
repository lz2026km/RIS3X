import { usePagination } from '../../hooks/usePagination'
import { t } from '../../i18n/appI18n'
import { fhirApi, type FhirSubscription } from '../../services/api/fhirApi'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Popconfirm, Empty } from 'antd'
import { Bell, Plus, Trash, RefreshCw, Eye } from 'lucide-react'
import { Inbox } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'

export const FhirSubscriptionPage: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<FhirSubscription[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedSub, setSelectedSub] = useState<FhirSubscription | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  // [W3-C] 受控分页: Subscription 列表
  const listPagination = usePagination(subscriptions, 10)

  const openDetail = async (sub: FhirSubscription) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setSelectedSub(sub)
    try {
      const res = await fhirApi.getSubscription(sub.id!)
      if (res.success && res.data) {
        setSelectedSub(res.data)
      } else {
        message.warning(res.error?.message ?? t('fhirSub.detailLoadFail'))
      }
    } catch {
      message.warning(t('fhirSub.detailLoadFail'))
    }
    setDetailLoading(false)
  }

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fhirApi.searchSubscription()
      if (res.success && res.data) {
        setSubscriptions(Array.isArray(res.data) ? res.data : [])
      }
    } catch {
      message.warning(t('fhirSub.listLoadFail'))
      setSubscriptions([
        { id: 'sub1', resourceType: 'Subscription', status: 'active', reason: '监控新检查报告', criteria: 'DiagnosticReport?status=final', channel: { type: 'rest-hook', endpoint: 'https://example.com/hook', payload: 'id-only' } },
        { id: 'sub2', resourceType: 'Subscription', status: 'inactive', reason: '患者变更通知', criteria: 'Patient?name=张', channel: { type: 'websocket', payload: 'full-resource' } },
      ])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchSubscriptions() }, [fetchSubscriptions])

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const body: Partial<FhirSubscription> = {
        resourceType: 'Subscription',
        status: 'active',
        reason: values.reason,
        criteria: values.criteria,
        channel: {
          type: values.channelType || 'rest-hook',
          endpoint: values.endpoint,
          payload: values.payload || 'id-only',
        },
      }
      const res = await fhirApi.createSubscription(body)
      if (res.success) {
        message.success(t('fhirSub.createSuccess'))
        setModalOpen(false)
        form.resetFields()
        fetchSubscriptions()
      } else {
        message.error(t('fhirSub.createFail'))
      }
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(t('fhirSub.opFail'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fhirApi.deleteSubscription(id)
    if (res.success) {
      message.success(t('fhirSub.deleteSuccess'))
      fetchSubscriptions()
    } else {
      message.error(t('fhirSub.deleteFail'))
    }
  }

  const columns = [
    {
      title: t('fhirSub.col.id'),
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id}</span>,
    },
    {
      title: t('fhirSub.col.status'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const colorMap: Record<string, string> = { active: 'green', inactive: 'default', error: 'red', off: 'orange' }
        return <Tag color={colorMap[s] || 'default'}>{s}</Tag>
      },
    },
    {
      title: t('fhirSub.col.reason'),
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: t('fhirSub.col.criteria'),
      dataIndex: 'criteria',
      key: 'criteria',
      ellipsis: true,
      render: (c: string) => <code style={{ fontSize: 11 }}>{c}</code>,
    },
    {
      title: t('fhirSub.col.channelType'),
      key: 'channelType',
      render: (_: any, r: FhirSubscription) => <Tag color="blue">{r.channel?.type}</Tag>,
    },
    {
      title: t('fhirSub.col.endpoint'),
      key: 'endpoint',
      render: (_: any, r: FhirSubscription) => r.channel?.endpoint || '-',
      ellipsis: true,
    },
    {
      title: t('fhirSub.col.action'),
      key: 'action',
      width: 150,
      render: (_: any, r: FhirSubscription) => (
        <Space size="small">
          <Button size="small" icon={<Eye size={12} />} onClick={() => openDetail(r)}>{t('fhirSub.detail')}</Button>
          <Popconfirm title={t('fhirSub.confirmDelete')} onConfirm={() => handleDelete(r.id!)}>
            <Button size="small" danger icon={<Trash size={12} />}>{t('fhirSub.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Bell size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('fhirSub.title')}</span>
        <Tag color="blue">FHIR R4</Tag>
      </Space>

      <Card
        size="small"
        title={t('fhirSub.listTitle', { count: subscriptions.length })}
        extra={
          <Space>
            <Button icon={<RefreshCw size={14} />} onClick={fetchSubscriptions}>{t('fhirSub.refresh')}</Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={() => { form.resetFields(); setModalOpen(true) }}>{t('fhirSub.create')}</Button>
          </Space>
        }
      >
        <Table
          dataSource={listPagination.pageData}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={listPagination.pagination}
          size="small"
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={t('fhirSub.createTitle')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        confirmLoading={saving}
        width={600}
      >
        <Form form={form} layout="vertical" size="small" initialValues={{ channelType: 'rest-hook', payload: 'id-only' }}>
          <Form.Item name="reason" label={t('fhirSub.reasonLabel')} rules={[{ required: true }]}>
            <Input placeholder={t('fhirSub.reasonPlaceholder')} />
          </Form.Item>
          <Form.Item name="criteria" label={t('fhirSub.criteriaLabel')} rules={[{ required: true }]}>
            <Input placeholder={t('fhirSub.criteriaPlaceholder')} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="channelType" label={t('fhirSub.col.channelType')} rules={[{ required: true }]}>
              <Select options={[
                { value: 'rest-hook', label: t('fhirSub.channelRestHook') },
                { value: 'websocket', label: 'WebSocket' },
                { value: 'email', label: t('fhirSub.channelEmail') },
                { value: 'sms', label: t('fhirSub.channelSms') },
                { value: 'message', label: t('fhirSub.channelMessage') },
              ]} />
            </Form.Item>
            <Form.Item name="payload" label={t('fhirSub.payloadLabel')}>
              <Select options={[
                { value: 'id-only', label: t('fhirSub.payloadIdOnly') },
                { value: 'full-resource', label: t('fhirSub.payloadFull') },
                { value: 'none', label: t('fhirSub.payloadNone') },
              ]} />
            </Form.Item>
          </div>
          <Form.Item name="endpoint" label={t('fhirSub.endpointLabel')} rules={[{ required: true }]}>
            <Input placeholder="https://example.com/hook" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('fhirSub.detailTitle')}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>{t('fhirSub.close')}</Button>}
        width={600}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>{t('fhirSub.loadingDetail')}</div>
        ) : selectedSub ? (
          <div>
            <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 6, fontSize: 12, overflow: 'auto', maxHeight: 400 }}>
              {JSON.stringify(selectedSub, null, 2)}
            </pre>
          </div>
        ) : <Empty description={t('fhirSub.empty')} image={<Inbox size={48} style={{opacity:0.4}}/>} />}
      </Modal>
    </div>
  )
}

export default FhirSubscriptionPage
