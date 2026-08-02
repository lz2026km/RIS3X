import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, message, Popconfirm, Empty, Descriptions } from 'antd'
import { FileText, Plus, Edit, Trash, RefreshCw, Eye } from 'lucide-react'
import { dicomSrApi, type DicomSrTemplate } from '../../services/api/dicomApi'

export const DicomSrTemplatePage: React.FC = () => {
  const [templates, setTemplates] = useState<DicomSrTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<DicomSrTemplate | null>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<DicomSrTemplate | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await dicomSrApi.getTemplates()
      if (res.success && res.data) {
        setTemplates(res.data)
      }
    } catch {
      message.warning('模板列表加载失败')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const handleCreate = () => {
    setEditingTemplate(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (template: DicomSrTemplate) => {
    setEditingTemplate(template)
    form.setFieldsValue({
      label: template.label,
      labelEn: template.labelEn,
      description: template.description,
      tid: template.tid,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const newTemplate: DicomSrTemplate = {
        id: editingTemplate?.id || `tid${Date.now()}`,
        label: values.label,
        labelEn: values.labelEn,
        description: values.description,
        tid: values.tid,
      }
      if (editingTemplate) {
        setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? newTemplate : t))
        message.success('模板已更新')
      } else {
        setTemplates(prev => [...prev, newTemplate])
        message.success('模板已创建')
      }
      setModalOpen(false)
    } catch (err: any) {
      if (err?.errorFields) return
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id))
    message.success('模板已删除')
  }

  const columns = [
    {
      title: '编号',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <code style={{ fontSize: 12 }}>{id}</code>,
    },
    { title: '名称 (中文)', dataIndex: 'label', key: 'label' },
    { title: '名称 (English)', dataIndex: 'labelEn', key: 'labelEn' },
    {
      title: 'TID',
      dataIndex: 'tid',
      key: 'tid',
      render: (tid: string) => <Tag color="purple">{tid}</Tag>,
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, r: DicomSrTemplate) => (
        <Space size="small">
          <Button size="small" icon={<Eye size={12} />} onClick={() => { setSelectedTemplate(r); setDetailOpen(true) }}>详情</Button>
          <Button size="small" icon={<Edit size={12} />} onClick={() => handleEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除此模板?" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<Trash size={12} />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <FileText size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>DICOM SR 模板管理</span>
        <Tag color="cyan">Structured Report</Tag>
      </Space>

      <Card
        size="small"
        title={`SR 模板列表 (${templates.length})`}
        extra={
          <Space>
            <Button icon={<RefreshCw size={14} />} onClick={fetchTemplates}>刷新</Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={handleCreate}>新建模板</Button>
          </Space>
        }
      >
        <Table
          dataSource={templates}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>

      <Modal
        title={editingTemplate ? '编辑模板' : '新建模板'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={600}
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item name="label" label="名称 (中文)" rules={[{ required: true }]}>
            <Input placeholder="结构化测量报告" />
          </Form.Item>
          <Form.Item name="labelEn" label="Name (English)" rules={[{ required: true }]}>
            <Input placeholder="Measurement Report" />
          </Form.Item>
          <Form.Item name="tid" label="TID 模板标识" rules={[{ required: true }]}>
            <Input placeholder="TID 1500" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="模板用途说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="模板详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        width={500}
      >
        {selectedTemplate ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="编号">{selectedTemplate.id}</Descriptions.Item>
            <Descriptions.Item label="中文名称">{selectedTemplate.label}</Descriptions.Item>
            <Descriptions.Item label="English Name">{selectedTemplate.labelEn}</Descriptions.Item>
            <Descriptions.Item label="TID">{selectedTemplate.tid}</Descriptions.Item>
            <Descriptions.Item label="描述">{selectedTemplate.description}</Descriptions.Item>
          </Descriptions>
        ) : <Empty />}
      </Modal>
    </div>
  )
}

export default DicomSrTemplatePage
