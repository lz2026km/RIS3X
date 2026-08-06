import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, message, Row, Col, Statistic } from 'antd'
import { Cpu, Rocket, StopCircle, Trash2, RefreshCw, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { aiMarketplaceApi, type AiModel } from '../../services/api/aiMarketplaceApi'

const { confirm } = Modal

const statusColors: Record<string, string> = { running: 'green', stopped: 'orange', error: 'red' }
const statusLabels: Record<string, string> = { running: '运行中', stopped: '已停止', error: '异常' }

const AiMarketplacePage: React.FC = () => {
  const {  } = useTranslation('ai')
  const [models, setModels] = useState<AiModel[]>([])
  const [loading, setLoading] = useState(false)
  const [deployOpen, setDeployOpen] = useState(false)
  const [form] = Form.useForm()

  const fetchModels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await aiMarketplaceApi.listModels()
      if (res.success && Array.isArray(res.data)) {
        setModels(res.data)
      }
    } catch (err) { console.error('[AiMarketplace] fetchModels failed:', err); message.warning('模型列表加载失败') } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  const handleDeploy = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      const res = await aiMarketplaceApi.deployModel({
        name: values.name,
        version: values.version,
        modality: values.modality,
        description: values.description,
      })
      if (res.success) {
        setModels(prev => [res.data, ...prev])
        setDeployOpen(false)
        form.resetFields()
        message.success('模型部署成功')
      } else {
        message.error(res.error?.message || '部署失败')
      }
    } catch (err: any) {
      if (err?.errorFields) return
      message.error('部署请求失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = (id: string) => {
    confirm({
      title: '确认卸载此模型？',
      onOk: async () => {
        try {
          const res = await aiMarketplaceApi.removeModel(id)
          if (res.success) {
            setModels(prev => prev.filter(m => m.id !== id))
            message.success('模型已卸载')
          } else {
            message.error(res.error?.message || '卸载失败')
          }
        } catch (err) { console.error('[AiMarketplace] removeModel failed:', err); message.error('卸载请求失败') }
      }
    })
  }

  const running = models.filter(m => m.status === 'running').length
  const avgAcc = models.filter(m => m.accuracy).reduce((s, m) => s + (m.accuracy || 0), 0) / (models.filter(m => m.accuracy).length || 1)

  const columns = [
    { title: '模型名称', dataIndex: 'name', key: 'name' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '模态', dataIndex: 'modality', key: 'modality' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '准确率', dataIndex: 'accuracy', key: 'accuracy', render: (v: number) => v ? `${(v * 100).toFixed(0)}%` : '-' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
    { title: '操作', key: 'action', render: (_: unknown, r: AiModel) => <Space><Button size="small" danger icon={<Trash2 size={14} />} onClick={() => handleRemove(r.id)}>卸载</Button></Space> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Cpu size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>AI 模型市场</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="模型总数" value={models.length} prefix={<Cpu size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="运行中" value={running} styles={{ content: {  color: '#52c41a'  } }} prefix={<Rocket size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="平均准确率" value={`${(avgAcc * 100).toFixed(1)}%`} prefix={<RefreshCw size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="异常" value={models.filter(m => m.status === 'error').length} styles={{ content: {  color: '#ff4d4f'  } }} prefix={<StopCircle size={16} />} /></Card></Col>
      </Row>
      <Card
        extra={<Button type="primary" icon={<Plus size={14} />} onClick={() => setDeployOpen(true)}>部署模型</Button>}
        loading={loading}
      >
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
