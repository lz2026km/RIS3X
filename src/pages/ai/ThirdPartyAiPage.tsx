import React, { useState } from 'react'
import { Card, Table, Button, Tag, Space, Row, Col, Statistic, Modal, Form, Input, Select, message, Badge, Switch } from 'antd'
import { Plug, Trash2, Plus, CheckCircle, Shield, Zap } from 'lucide-react'

interface ThirdPartyAiProvider {
  id: string
  name: string
  type: string
  endpoint: string
  status: 'connected' | 'disconnected' | 'error'
  apiKey?: string
  model: string
  lastSync: string
  requestCount: number
  avgLatency: number
  accuracy: number
  enabled: boolean
}

const mockProviders: ThirdPartyAiProvider[] = [
  { id: 'tp-001', name: 'Google Cloud Vision AI', type: 'cloud', endpoint: 'https://vision.googleapis.com/v1', status: 'connected', model: 'chest-xray-v3', lastSync: '2026-07-28T10:00:00Z', requestCount: 1250, avgLatency: 120, accuracy: 0.94, enabled: true },
  { id: 'tp-002', name: 'Microsoft Azure Health', type: 'cloud', endpoint: 'https://api.health.azure.com/v1', status: 'connected', model: 'radiology-cad-v2', lastSync: '2026-07-28T09:30:00Z', requestCount: 890, avgLatency: 150, accuracy: 0.91, enabled: true },
  { id: 'tp-003', name: 'AWS HealthImaging', type: 'cloud', endpoint: 'https://runtime.healthimaging.amazonaws.com', status: 'disconnected', model: 'mri-analysis-v1', lastSync: '2026-07-27T18:00:00Z', requestCount: 0, avgLatency: 0, accuracy: 0, enabled: false },
  { id: 'tp-004', name: '本地部署模型', type: 'on-premise', endpoint: 'http://192.168.1.100:8080/api/v1', status: 'connected', model: 'custom-ct-cad-v1', lastSync: '2026-07-28T10:15:00Z', requestCount: 3200, avgLatency: 85, accuracy: 0.89, enabled: true },
  { id: 'tp-005', name: 'Baidu Medical AI', type: 'cloud', endpoint: 'https://ai.baidu.com/medical/v1', status: 'error', model: 'lung-nodule-v2', lastSync: '2026-07-26T12:00:00Z', requestCount: 150, avgLatency: 0, accuracy: 0.87, enabled: false },
]

const statusLabel: Record<string, string> = { connected: '已连接', disconnected: '已断开', error: '异常' }
const typeColor: Record<string, string> = { cloud: 'blue', on_premise: 'purple' }
const typeLabel: Record<string, string> = { cloud: '云端', on_premise: '本地' }

const ThirdPartyAiPage: React.FC = () => {
  const [providers, setProviders] = useState(mockProviders)
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<ThirdPartyAiProvider | null>(null)
  const [form] = Form.useForm()

  const connected = providers.filter(p => p.status === 'connected').length
  const totalRequests = providers.reduce((s, p) => s + p.requestCount, 0)
  const avgAccuracy = providers.filter(p => p.accuracy > 0).reduce((s, p) => s + p.accuracy, 0) / (providers.filter(p => p.accuracy > 0).length || 1)

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', render: (v: string) => <Space><Plug size={14} color="#1677ff" />{v}</Space> },
    { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag color={typeColor[v]}>{typeLabel[v] || v}</Tag> },
    { title: '模型', dataIndex: 'model', key: 'model' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Badge status={v === 'connected' ? 'success' : v === 'error' ? 'error' : 'default'} text={statusLabel[v]} /> },
    { title: '准确率', dataIndex: 'accuracy', key: 'accuracy', render: (v: number) => v > 0 ? `${(v * 100).toFixed(0)}%` : '-' },
    { title: '请求量', dataIndex: 'requestCount', key: 'requestCount' },
    { title: '延迟', dataIndex: 'avgLatency', key: 'avgLatency', render: (v: number) => v > 0 ? `${v}ms` : '-' },
    { title: '启用', dataIndex: 'enabled', key: 'enabled', render: (v: boolean) => <Switch size="small" checked={v} onChange={(checked) => {
      setProviders(prev => prev.map(p => p.id === selected?.id ? { ...p, enabled: checked } : p))
    }} /> },
    { title: '操作', key: 'action', render: (_: unknown, r: ThirdPartyAiProvider) => (
      <Space>
        <Button size="small" type="primary" onClick={() => { setSelected(r) }}>详情</Button>
        <Button size="small" danger icon={<Trash2 size={14} />} onClick={() => {
          setProviders(prev => prev.filter(p => p.id !== r.id))
          message.success('已移除')
        }}>移除</Button>
      </Space>
    )},
  ]

  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      const newProvider: ThirdPartyAiProvider = {
        id: `tp-${Date.now()}`,
        name: values.name,
        type: values.type,
        endpoint: values.endpoint,
        status: 'connected',
        model: values.model,
        lastSync: new Date().toISOString(),
        requestCount: 0,
        avgLatency: 0,
        accuracy: 0,
        enabled: true,
      }
      setProviders(prev => [newProvider, ...prev])
      setAddOpen(false)
      form.resetFields()
      message.success('已添加')
    } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
  }

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Plug size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>第三方 AI 集成</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="提供商总数" value={providers.length} prefix={<Plug size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="已连接" value={connected} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircle size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="总请求量" value={totalRequests} prefix={<Zap size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="平均准确率" value={`${(avgAccuracy * 100).toFixed(1)}%`} prefix={<Shield size={16} />} /></Card></Col>
      </Row>
      <Card
        extra={<Button type="primary" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>添加提供商</Button>}
      >
        <Table rowKey="id" dataSource={providers} columns={columns} pagination={false} size="small" />
      </Card>
      <Modal title="添加第三方 AI 提供商" open={addOpen} onOk={handleAdd} onCancel={() => setAddOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={[{ value: 'cloud', label: '云端' }, { value: 'on_premise', label: '本地' }]} />
          </Form.Item>
          <Form.Item name="endpoint" label="端点" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="model" label="模型名称" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ThirdPartyAiPage
