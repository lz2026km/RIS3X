import React, { useState } from 'react'
import { Card, Table, Switch, Space, Typography, Row, Col, Statistic, Button, Tag, message, Modal, Form, Input, Select } from 'antd'
import { Settings, Play } from 'lucide-react'

const {  } = Typography

interface AutoCollectionRuleItem {
  id: string
  name: string
  triggerType: string
  action: string
  enabled: boolean
  lastRun?: string
  nextRun?: string
  status: string
}

const mockRules: AutoCollectionRuleItem[] = [
  { id: 'ac-001', name: 'DICOM 自动归档', triggerType: 'event', action: 'archive', enabled: true, lastRun: '2026-07-28T10:00:00Z', nextRun: '2026-07-28T11:00:00Z', status: 'active' },
  { id: 'ac-002', name: '危急值自动通知', triggerType: 'event', action: 'notify', enabled: true, lastRun: '2026-07-28T09:30:00Z', status: 'active' },
  { id: 'ac-003', name: '每日质量报告', triggerType: 'schedule', action: 'report', enabled: false, lastRun: '2026-07-27T08:00:00Z', status: 'inactive' },
]

const AutoCollectionPage: React.FC = () => {
  const [rules, setRules] = useState(mockRules)
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm()

  const handleToggle = (id: string, checked: boolean) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: checked, status: checked ? 'active' : 'inactive' } : r))
    message.success(checked ? '规则已启用' : '规则已禁用')
  }

  // 新建规则：本地添加（后端无 /auto-collection mock 端点时保证可用）
  const handleCreate = async () => {
    const values = await form.validateFields()
    const now = new Date().toISOString()
    const rule: AutoCollectionRuleItem = {
      id: `ac-${Date.now()}`,
      name: values.name,
      triggerType: values.triggerType,
      action: values.action,
      enabled: values.enabled !== false,
      lastRun: undefined,
      nextRun: values.triggerType === 'schedule' ? now : undefined,
      status: values.enabled !== false ? 'active' : 'inactive',
    }
    setRules(prev => [...prev, rule])
    setCreateOpen(false)
    form.resetFields()
    message.success(`规则已创建: ${rule.name}`)
  }

  const columns = [
    { title: '规则名', dataIndex: 'name', key: 'name' },
    { title: '触发方式', dataIndex: 'triggerType', key: 'triggerType', render: (v: string) => <Tag>{v}</Tag> },
    { title: '动作', dataIndex: 'action', key: 'action', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag> },
    { title: '上次执行', dataIndex: 'lastRun', key: 'lastRun', render: (v?: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '启用', key: 'enabled', render: (_: unknown, r: AutoCollectionRuleItem) => <Switch checked={r.enabled} onChange={(c) => handleToggle(r.id, c)} /> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Settings size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>自动采集管理</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总规则" value={rules.length} /></Card></Col>
        <Col span={6}><Card><Statistic title="已启用" value={rules.filter(r => r.enabled).length} styles={{ content: {  color: '#52c41a'  } }} /></Card></Col>
        <Col span={6}><Card><Statistic title="已禁用" value={rules.filter(r => !r.enabled).length} /></Card></Col>
      </Row>
      <Card extra={<Button type="primary" icon={<Play size={14} />} onClick={() => setCreateOpen(true)}>新建规则</Button>}>
        <Table rowKey="id" dataSource={rules} columns={columns} pagination={false} size="small" />
      </Card>

      <Modal
        title="新建采集规则"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
        width={480}
      >
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 12 }} initialValues={{ triggerType: 'event', action: 'archive', enabled: true }}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="如：DICOM 自动归档" />
          </Form.Item>
          <Form.Item name="triggerType" label="触发方式" rules={[{ required: true }]}>
            <Select options={[
              { value: 'event', label: '事件触发 (event)' },
              { value: 'schedule', label: '定时触发 (schedule)' },
              { value: 'threshold', label: '阈值触发 (threshold)' },
            ]} />
          </Form.Item>
          <Form.Item name="action" label="动作" rules={[{ required: true }]}>
            <Select options={[
              { value: 'archive', label: '自动归档 (archive)' },
              { value: 'notify', label: '通知 (notify)' },
              { value: 'report', label: '生成报告 (report)' },
              { value: 'transfer', label: '转储 (transfer)' },
            ]} />
          </Form.Item>
          <Form.Item name="enabled" label="创建后立即启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AutoCollectionPage
