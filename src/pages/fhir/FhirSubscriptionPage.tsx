import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Popconfirm, Empty } from 'antd'
import { Bell, Plus, Trash, RefreshCw, Eye } from 'lucide-react'
import { fhirApi, type FhirSubscription } from '../../services/api/fhirApi'
import { usePagination } from '../../hooks/usePagination'

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
        message.warning(res.error?.message ?? 'Subscription 详情加载失败，展示列表数据')
      }
    } catch {
      message.warning('Subscription 详情加载失败，展示列表数据')
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
      message.warning('Subscription 列表加载失败，使用演示数据')
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
        message.success('Subscription 已创建')
        setModalOpen(false)
        form.resetFields()
        fetchSubscriptions()
      } else {
        message.error('创建失败')
      }
    } catch (err: any) {
      if (err?.errorFields) return
      message.error('操作失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fhirApi.deleteSubscription(id)
    if (res.success) {
      message.success('Subscription 已删除')
      fetchSubscriptions()
    } else {
      message.error('删除失败')
    }
  }

  const columns = [
    {
      title: '编号',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const colorMap: Record<string, string> = { active: 'green', inactive: 'default', error: 'red', off: 'orange' }
        return <Tag color={colorMap[s] || 'default'}>{s}</Tag>
      },
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '筛选条件',
      dataIndex: 'criteria',
      key: 'criteria',
      ellipsis: true,
      render: (c: string) => <code style={{ fontSize: 11 }}>{c}</code>,
    },
    {
      title: '通道类型',
      key: 'channelType',
      render: (_: any, r: FhirSubscription) => <Tag color="blue">{r.channel?.type}</Tag>,
    },
    {
      title: '端点',
      key: 'endpoint',
      render: (_: any, r: FhirSubscription) => r.channel?.endpoint || '-',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, r: FhirSubscription) => (
        <Space size="small">
          <Button size="small" icon={<Eye size={12} />} onClick={() => openDetail(r)}>详情</Button>
          <Popconfirm title="确认删除此 Subscription?" onConfirm={() => handleDelete(r.id!)}>
            <Button size="small" danger icon={<Trash size={12} />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Bell size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>FHIR Subscription 管理</span>
        <Tag color="blue">FHIR R4</Tag>
      </Space>

      <Card
        size="small"
        title={`Subscription 列表 (${subscriptions.length})`}
        extra={
          <Space>
            <Button icon={<RefreshCw size={14} />} onClick={fetchSubscriptions}>刷新</Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={() => { form.resetFields(); setModalOpen(true) }}>新建 Subscription</Button>
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
        title="新建 Subscription"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        confirmLoading={saving}
        width={600}
      >
        <Form form={form} layout="vertical" size="small" initialValues={{ channelType: 'rest-hook', payload: 'id-only' }}>
          <Form.Item name="reason" label="订阅原因" rules={[{ required: true }]}>
            <Input placeholder="描述此订阅的用途" />
          </Form.Item>
          <Form.Item name="criteria" label="筛选条件 (Criteria)" rules={[{ required: true }]}>
            <Input placeholder="例如: DiagnosticReport?status=final" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="channelType" label="通道类型" rules={[{ required: true }]}>
              <Select options={[
                { value: 'rest-hook', label: 'REST Hook' },
                { value: 'websocket', label: 'WebSocket' },
                { value: 'email', label: '邮件' },
                { value: 'sms', label: '短信' },
                { value: 'message', label: '消息' },
              ]} />
            </Form.Item>
            <Form.Item name="payload" label="Payload 类型">
              <Select options={[
                { value: 'id-only', label: 'ID Only' },
                { value: 'full-resource', label: 'Full Resource' },
                { value: 'none', label: '无' },
              ]} />
            </Form.Item>
          </div>
          <Form.Item name="endpoint" label="端点 URL" rules={[{ required: true }]}>
            <Input placeholder="https://example.com/hook" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Subscription 详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        width={600}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>加载详情...</div>
        ) : selectedSub ? (
          <div>
            <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 6, fontSize: 12, overflow: 'auto', maxHeight: 400 }}>
              {JSON.stringify(selectedSub, null, 2)}
            </pre>
          </div>
        ) : <Empty />}
      </Modal>
    </div>
  )
}

export default FhirSubscriptionPage
