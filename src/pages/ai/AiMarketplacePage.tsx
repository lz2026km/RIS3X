import React, { useState } from 'react'
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, message, Badge, Row, Col, Statistic } from 'antd'
import { Cpu, Rocket, StopCircle, Trash2, RefreshCw, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const { confirm } = Modal

interface AIModel {
  id: string
  name: string
  version: string
  modality: string
  description: string
  status: 'running' | 'stopped' | 'error'
  deployedAt: string
  accuracy?: number
}

const initModels: AIModel[] = [
  { id: 'md-001', name: '肺结节检测', version: '2.1.0', modality: 'CT', description: '基于深度学习的肺结节自动检测与分类', status: 'running', deployedAt: '2026-06-01T00:00:00Z', accuracy: 0.94 },
  { id: 'md-002', name: '骨折识别', version: '1.3.0', modality: 'DX', description: 'X线骨折自动识别与定位', status: 'running', deployedAt: '2026-05-15T00:00:00Z', accuracy: 0.91 },
  { id: 'md-003', name: '脑出血检测', version: '3.0.0', modality: 'CT', description: '急诊CT脑出血快速检测', status: 'stopped', deployedAt: '2026-04-20T00:00:00Z', accuracy: 0.96 },
  { id: 'md-004', name: '乳腺钼靶分析', version: '1.0.0', modality: 'MG', description: '乳腺钼靶影像AI辅助诊断', status: 'error', deployedAt: '2026-07-01T00:00:00Z', accuracy: 0.88 },
  { id: 'md-005', name: '冠脉CTA分析', version: '2.0.0', modality: 'CT', description: '冠脉CTA血管狭窄自动分析', status: 'running', deployedAt: '2026-06-10T00:00:00Z', accuracy: 0.92 },
]

const statusColors: Record<string, string> = { running: 'green', stopped: 'orange', error: 'red' }
const statusLabels: Record<string, string> = { running: '运行中', stopped: '已停止', error: '异常' }

const AiMarketplacePage: React.FC = () => {
  const { t } = useTranslation('ai')
  const [models, setModels] = useState<AIModel[]>(initModels)
  const [deployOpen, setDeployOpen] = useState(false)
  const [form] = Form.useForm()

  const handleDeploy = () => {
    form.validateFields().then(values => {
      const newModel: AIModel = {
        id: `md-${Date.now().toString(36)}`,
        name: values.name,
        version: values.version,
        modality: values.modality,
        description: values.description || '',
        status: 'running',
        deployedAt: new Date().toISOString(),
      }
      setModels(prev => [newModel, ...prev])
      setDeployOpen(false)
      form.resetFields()
      message.success('模型部署成功')
    })
  }

  const handleRemove = (id: string) => {
    confirm({ title: '确认卸载此模型？', onOk: () => { setModels(prev => prev.filter(m => m.id !== id)); message.success('模型已卸载') } })
  }

  const running = models.filter(m => m.status === 'running').length
  const avgAcc = models.filter(m => m.accuracy).reduce((s, m) => s + (m.accuracy || 0), 0) / models.filter(m => m.accuracy).length

  const columns = [
    { title: '模型名称', dataIndex: 'name', key: 'name' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '模态', dataIndex: 'modality', key: 'modality' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '准确率', dataIndex: 'accuracy', key: 'accuracy', render: (v: number) => v ? `${(v * 100).toFixed(0)}%` : '-' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
    { title: '操作', key: 'action', render: (_: unknown, r: AIModel) => <Space><Button size="small" danger icon={<Trash2 size={14} />} onClick={() => handleRemove(r.id)}>卸载</Button></Space> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Cpu size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>AI 模型市场</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="模型总数" value={models.length} prefix={<Cpu size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="运行中" value={running} valueStyle={{ color: '#52c41a' }} prefix={<Rocket size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="平均准确率" value={`${(avgAcc * 100).toFixed(1)}%`} prefix={<RefreshCw size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="异常" value={models.filter(m => m.status === 'error').length} valueStyle={{ color: '#ff4d4f' }} prefix={<StopCircle size={16} />} /></Card></Col>
      </Row>
      <Card extra={<Button type="primary" icon={<Plus size={14} />} onClick={() => setDeployOpen(true)}>部署模型</Button>}>
        <Table rowKey="id" dataSource={models} columns={columns} pagination={false} size="small" />
      </Card>
      <Modal title="部署新模型" open={deployOpen} onOk={handleDeploy} onCancel={() => setDeployOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="模型名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="version" label="版本" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="modality" label="模态" rules={[{ required: true }]}>
            <Select options={[{ value: 'CT', label: 'CT' }, { value: 'MR', label: 'MR' }, { value: 'DX', label: 'DX' }, { value: 'MG', label: 'MG' }, { value: 'US', label: 'US' }]} />
          </Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AiMarketplacePage
