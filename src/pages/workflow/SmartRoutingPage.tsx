import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Tag, Space, Switch, InputNumber, Input, Modal, Form, Select, Row, Col, Statistic, Tabs, message, Tooltip } from 'antd'
import { GitBranch, Plus, Edit3, BarChart3, History, RefreshCw, User, X } from 'lucide-react'
import { smartRoutingApi, type RoutingRule, type RoutingAssignment } from '../../services/api/smartRoutingApi'

const SmartRoutingPage: React.FC = () => {
  const [rules, setRules] = useState<RoutingRule[]>([])
  const [assignments, setAssignments] = useState<RoutingAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null)
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState('rules')

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try { const res = await smartRoutingApi.getRules(); if (res.success) setRules(res.data) } catch { message.error('加载失败') } finally { setLoading(false) }
  }, [])

  const fetchAssignments = useCallback(async () => {
    try { const res = await smartRoutingApi.getAssignments(); if (res.success) setAssignments(res.data) } catch {}
  }, [])

  useEffect(() => { fetchRules(); fetchAssignments() }, [fetchRules, fetchAssignments])

  const handleSave = () => {
    form.validateFields().then(async values => {
      try {
        if (editingRule) { await smartRoutingApi.updateRule(editingRule.id, values); message.success('规则已更新') }
        else { await smartRoutingApi.createRule(values); message.success('规则已创建') }
        setEditOpen(false); fetchRules()
      } catch { message.error('保存失败') }
    })
  }

  const handleToggle = async (id: string, active: boolean) => {
    try { await smartRoutingApi.toggleRule(id, active); setRules(prev => prev.map(r => r.id === id ? { ...r, active } : r)); message.success(active ? '已启用' : '已禁用') } catch { message.error('操作失败') }
  }

  const ruleColumns = [
    { title: '规则名称', dataIndex: 'name', key: 'name', render: (n: string) => <strong>{n}</strong> },
    { title: '模态', dataIndex: 'modality', key: 'modality', render: (m: string) => <Tag color="blue">{m}</Tag> },
    { title: '部位', dataIndex: 'bodyPart', key: 'bodyPart' },
    { title: '患者状态', dataIndex: 'patientStatus', key: 'patientStatus', render: (s: string) => <Tag color={s === 'Emergency' ? 'red' : 'blue'}>{s}</Tag> },
    { title: '最大负载', dataIndex: 'maxLoad', key: 'maxLoad', render: (l: number) => `${l} 例` },
    { title: '优先级', dataIndex: 'priority', key: 'priority' },
    { title: '启用', dataIndex: 'active', key: 'active', render: (a: boolean, r: RoutingRule) => <Switch checked={a} onChange={(c) => handleToggle(r.id, c)} /> },
    { title: '操作', key: 'action', render: (_: unknown, r: RoutingRule) => <Button size="small" icon={<Edit3 size={14} />} onClick={() => { setEditingRule(r); form.setFieldsValue(r); setEditOpen(true) }}>编辑</Button> },
  ]

  const assignmentColumns = [
    { title: '检查号', dataIndex: 'studyId', key: 'studyId' },
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: '模态', dataIndex: 'modality', key: 'modality' },
    { title: '分配至', dataIndex: 'assignedTo', key: 'assignedTo', render: (d: string) => <Space><User size={14} />{d}</Space> },
    { title: '匹配规则', dataIndex: 'ruleName', key: 'ruleName', render: (n: string) => <Tag color="green">{n}</Tag> },
    { title: '分配时间', dataIndex: 'assignedAt', key: 'assignedAt' },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <GitBranch size={20} color="#1677ff" /><h1 style={{ fontSize: 20, margin: 0 }}>智能路由</h1><Tag color="blue">基于规则的分配</Tag>
      </div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="总分配" value={assignments.length} prefix={<History size={16} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="规则数" value={rules.length} prefix={<GitBranch size={16} />} /></Card></Col>
      </Row>
      <Card extra={<Space><Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditingRule(null); form.resetFields(); setEditOpen(true) }}>新建规则</Button><Button icon={<RefreshCw size={14} />} onClick={() => { fetchRules(); fetchAssignments() }}>刷新</Button></Space>}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="路由规则" key="rules"><Table dataSource={rules} columns={ruleColumns} rowKey="id" loading={loading} pagination={false} size="small" /></Tabs.TabPane>
          <Tabs.TabPane tab="分配历史" key="history"><Table dataSource={assignments} columns={assignmentColumns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} size="small" /></Tabs.TabPane>
        </Tabs>
      </Card>
      <Modal title={editingRule ? '编辑路由规则' : '新建路由规则'} open={editOpen} onOk={handleSave} onCancel={() => setEditOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="modality" label="设备类型" rules={[{ required: true }]}><Select options={[{ value: 'CT', label: 'CT' }, { value: 'MR', label: 'MR' }, { value: 'DX', label: 'DX' }, { value: 'Any', label: '任意' }]} /></Form.Item>
          <Form.Item name="bodyPart" label="部位"><Select options={[{ value: 'Chest', label: '胸部' }, { value: 'Brain', label: '头部' }, { value: 'Any', label: '任意' }]} /></Form.Item>
          <Form.Item name="patientStatus" label="患者状态"><Select options={[{ value: 'Inpatient', label: '住院' }, { value: 'Outpatient', label: '门诊' }, { value: 'Emergency', label: '急诊' }, { value: 'Any', label: '任意' }]} /></Form.Item>
          <Form.Item name="maxLoad" label="最大负载"><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="priority" label="优先级"><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SmartRoutingPage
