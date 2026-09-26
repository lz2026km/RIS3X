import { usePagination } from '../../hooks/usePagination'
import { dicomSrApi, type DicomSrTemplate } from '../../services/api/dicomApi'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, message, Popconfirm, Empty, Descriptions } from 'antd'
import { FileText, Plus, Edit, Trash, RefreshCw, Eye } from 'lucide-react'
import { Inbox } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'
import { t } from '../../i18n/appI18n'

export const DicomSrTemplatePage: React.FC = () => {
  const [templates, setTemplates] = useState<DicomSrTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<DicomSrTemplate | null>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<DicomSrTemplate | null>(null)
  // [W3-C] 受控分页: SR 模板列表
  const listPagination = usePagination(templates, 10)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await dicomSrApi.getTemplates()
      if (res.success && res.data) {
        setTemplates(res.data)
      }
    } catch {
      message.warning(t('srTpl.loadFailed'))
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
        message.success(t('srTpl.updated'))
      } else {
        setTemplates(prev => [...prev, newTemplate])
        message.success(t('srTpl.created'))
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
    message.success(t('srTpl.deleted'))
  }

  const columns = [
    {
      title: t('srTpl.colId'),
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <code style={{ fontSize: 12 }}>{id}</code>,
    },
    { title: t('srTpl.colLabel'), dataIndex: 'label', key: 'label' },
    { title: t('srTpl.colLabelEn'), dataIndex: 'labelEn', key: 'labelEn' },
    {
      title: 'TID',
      dataIndex: 'tid',
      key: 'tid',
      render: (tid: string) => <Tag color="purple">{tid}</Tag>,
    },
    { title: t('srTpl.colDescription'), dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: t('srTpl.colAction'),
      key: 'action',
      width: 180,
      render: (_: any, r: DicomSrTemplate) => (
        <Space size="small">
          <Button size="small" icon={<Eye size={12} />} onClick={() => { setSelectedTemplate(r); setDetailOpen(true) }}>{t('srTpl.detail')}</Button>
          <Button size="small" icon={<Edit size={12} />} onClick={() => handleEdit(r)}>{t('srTpl.edit')}</Button>
          <Popconfirm title={t('srTpl.deleteConfirm')} onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<Trash size={12} />}>{t('srTpl.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <FileText size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('srTpl.title')}</span>
        <Tag color="cyan">{t('srTpl.structuredReport')}</Tag>
      </Space>

      <Card
        size="small"
        title={t('w9d.srTpl.listTitle', { count: templates.length })}
        extra={
          <Space>
            <Button icon={<RefreshCw size={14} />} onClick={fetchTemplates}>{t('srTpl.refresh')}</Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={handleCreate}>{t('srTpl.newTemplate')}</Button>
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
        title={editingTemplate ? t('srTpl.editTemplate') : t('srTpl.newTemplate')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={600}
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item name="label" label={t('srTpl.colLabel')} rules={[{ required: true }]}>
            <Input placeholder={t('srTpl.labelPlaceholder')} />
          </Form.Item>
          <Form.Item name="labelEn" label={t('srTpl.colLabelEn')} rules={[{ required: true }]}>
            <Input placeholder={t('srTpl.labelEnPlaceholder')} />
          </Form.Item>
          <Form.Item name="tid" label={t('srTpl.tidLabel')} rules={[{ required: true }]}>
            <Input placeholder="TID 1500" />
          </Form.Item>
          <Form.Item name="description" label={t('srTpl.colDescription')}>
            <Input.TextArea rows={3} placeholder={t('srTpl.descriptionPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('srTpl.detailTitle')}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>{t('srTpl.close')}</Button>}
        width={500}
      >
        {selectedTemplate ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label={t('srTpl.colId')}>{selectedTemplate.id}</Descriptions.Item>
            <Descriptions.Item label={t('srTpl.cnName')}>{selectedTemplate.label}</Descriptions.Item>
            <Descriptions.Item label={t('srTpl.colLabelEn')}>{selectedTemplate.labelEn}</Descriptions.Item>
            <Descriptions.Item label="TID">{selectedTemplate.tid}</Descriptions.Item>
            <Descriptions.Item label={t('srTpl.colDescription')}>{selectedTemplate.description}</Descriptions.Item>
          </Descriptions>
        ) : <Empty description={t('srTpl.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />}
      </Modal>
    </div>
  )
}

export default DicomSrTemplatePage
