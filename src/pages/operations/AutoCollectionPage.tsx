import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Switch, Space, Row, Col, Statistic, Button, Tag, message, Modal, Form, Input, Select, Alert } from 'antd'
import { Settings, Play } from 'lucide-react'
import { autoCollectionApi, type AutoCollectionRule } from '../../services/api/autoCollectionApi'

// 数据来源说明: 后端无 auto-collection controller,
// 由 MSW handler (src/services/mockBackend/autoCollectionHandlers.ts) 提供演示数据。
const DEMO_SOURCE_NOTE = '数据来源：演示数据（MSW，后端暂无 /auto-collection 接口）'

interface AutoCollectionRuleItem {
  id: string
  name: string
  triggerType: string
  action: string
  enabled: boolean
  lastRun?: string
  nextRun?: string
  status: string
  updatedAt?: string
}

const toItem = (r: AutoCollectionRule): AutoCollectionRuleItem => ({
  id: r.id,
  name: r.name,
  triggerType: r.triggerType,
  action: r.action,
  enabled: r.enabled,
  status: r.enabled ? 'active' : 'inactive',
  updatedAt: r.updatedAt,
})

const AutoCollectionPage: React.FC = () => {
  const [rules, setRules] = useState<AutoCollectionRuleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form] = Form.useForm()

  const fetchRules = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await autoCollectionApi.listRules()
      if (!res.success) throw new Error((res.error as { message?: string })?.message || '规则加载失败')
      setRules(res.data.map(toItem))
    } catch (e) {
      setError((e as Error)?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  const handleToggle = async (id: string, checked: boolean) => {
    const prev = rules
    setRules(prev2 => prev2.map(r => r.id === id ? { ...r, enabled: checked, status: checked ? 'active' : 'inactive' } : r))
    const res = await autoCollectionApi.toggleRule(id, checked)
    if (!res.success) {
      setRules(prev)
      message.error('状态切换失败，已还原')
      return
    }
    setRules(prev2 => prev2.map(r => r.id === id ? { ...toItem(res.data), lastRun: r.lastRun, nextRun: r.nextRun } : r))
    message.success(checked ? '规则已启用' : '规则已禁用')
  }

  const handleCreate = async () => {
    const values = await form.validateFields()
    setCreating(true)
    try {
      const res = await autoCollectionApi.createRule({
        name: values.name,
        description: '',
        triggerType: values.triggerType,
        triggerConfig: { mode: values.triggerType },
        action: values.action,
        actionConfig: {},
        enabled: values.enabled !== false,
      })
      if (!res.success) throw new Error((res.error as { message?: string })?.message || '创建失败')
      setRules(prev => [toItem(res.data), ...prev])
      setCreateOpen(false)
      form.resetFields()
      message.success(`规则已创建: ${res.data.name}`)
    } catch (e) {
      message.error((e as Error)?.message || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const columns = [
    { title: '规则名', dataIndex: 'name', key: 'name' },
    { title: '触发方式', dataIndex: 'triggerType', key: 'triggerType', render: (v: string) => <Tag>{v}</Tag> },
    { title: '动作', dataIndex: 'action', key: 'action', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag> },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', render: (v?: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '启用', key: 'enabled', render: (_: unknown, r: AutoCollectionRuleItem) => <Switch checked={r.enabled} onChange={(c) => handleToggle(r.id, c)} /> },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* [G005 W1-C] 演示数据（后端待实现）: 后端无 auto-collection controller, 数据由 MSW 提供 */}
      <Alert
        type="warning"
        showIcon
        banner
        message="演示数据（后端待实现）"
        description={DEMO_SOURCE_NOTE}
        style={{ marginBottom: 16 }}
      />
      <Space style={{ marginBottom: 16 }}>
        <Settings size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>自动采集管理</span>
      </Space>
      {error && <Alert type="warning" showIcon message="加载失败" description={error} action={<Button size="small" onClick={fetchRules}>重试</Button>} style={{ marginBottom: 16 }} />}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总规则" value={rules.length} loading={loading} /></Card></Col>
        <Col span={6}><Card><Statistic title="已启用" value={rules.filter(r => r.enabled).length} styles={{ content: { color: '#52c41a' } }} loading={loading} /></Card></Col>
        <Col span={6}><Card><Statistic title="已禁用" value={rules.filter(r => !r.enabled).length} loading={loading} /></Card></Col>
      </Row>
      <Card extra={<Button type="primary" icon={<Play size={14} />} onClick={() => setCreateOpen(true)}>新建规则</Button>}>
        <Table rowKey="id" dataSource={rules} columns={columns} pagination={false} size="small" loading={loading} scroll={{ x: 'max-content' }}/>
      </Card>

      <Modal
        title="新建采集规则"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
        confirmLoading={creating}
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
