import React, { useState } from 'react'
import { Card, Table, Button, Space, Switch, InputNumber, Input, Modal, Form, Select, Row, Col, Statistic, message, Tabs } from 'antd'
import { GitBranch, Edit3, BarChart3, History } from 'lucide-react'

interface RoutingRule {
  id: string
  name: string
  modality: string
  bodyPart: string
  patientStatus: string
  maxLoad: number
  priority: number
  active: boolean
}

interface Assignment {
  id: string
  studyId: string
  patientName: string
  modality: string
  assignedTo: string
  ruleName: string
  assignedAt: string
}

const initRules: RoutingRule[] = [
  { id: 'rr-001', name: 'CT Chest - Senior', modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient', maxLoad: 10, priority: 1, active: true },
  { id: 'rr-002', name: 'MR Brain - Specialist', modality: 'MR', bodyPart: 'Brain', patientStatus: 'Any', maxLoad: 8, priority: 2, active: true },
  { id: 'rr-003', name: 'DX Routine', modality: 'DX', bodyPart: 'Any', patientStatus: 'Outpatient', maxLoad: 20, priority: 3, active: true },
  { id: 'rr-004', name: 'CT Emergency', modality: 'CT', bodyPart: 'Any', patientStatus: 'Emergency', maxLoad: 5, priority: 0, active: true },
]

const initHistory: Assignment[] = [
  { id: 'as-001', studyId: 'STU001', patientName: 'Zhang San', modality: 'CT', assignedTo: 'Dr. Wang', ruleName: 'CT Chest - Senior', assignedAt: '2026-07-10T08:30:00Z' },
  { id: 'as-002', studyId: 'STU002', patientName: 'Li Si', modality: 'MR', assignedTo: 'Dr. Li', ruleName: 'MR Brain - Specialist', assignedAt: '2026-07-10T09:00:00Z' },
]

const SmartRoutePage: React.FC = () => {
  const [rules, setRules] = useState<RoutingRule[]>(initRules)
  const [history, _setHistory] = useState<Assignment[]>(initHistory)
  const [editOpen, setEditOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null)
  const [form] = Form.useForm()

  const handleEdit = (rule: RoutingRule) => {
    setEditingRule(rule)
    form.setFieldsValue(rule)
    setEditOpen(true)
  }

  const handleSave = () => {
    form.validateFields().then(values => {
      setRules(prev => prev.map(r => r.id === editingRule?.id ? { ...r, ...values } : r))
      setEditOpen(false)
      message.success('规则已更新')
    })
  }

  const handleToggle = (id: string, active: boolean) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, active } : r))
  }

  const stats = {
    total: history.length,
    byModality: history.reduce((acc: Record<string, number>, h) => { acc[h.modality] = (acc[h.modality] || 0) + 1; return acc }, {}),
    byDoctor: history.reduce((acc: Record<string, number>, h) => { acc[h.assignedTo] = (acc[h.assignedTo] || 0) + 1; return acc }, {}),
  }

  const ruleColumns = [
    { title: '规则名称', dataIndex: 'name', key: 'name' },
    { title: '模态', dataIndex: 'modality', key: 'modality' },
    { title: '部位', dataIndex: 'bodyPart', key: 'bodyPart' },
    { title: '患者状态', dataIndex: 'patientStatus', key: 'patientStatus' },
    { title: '最大负载', dataIndex: 'maxLoad', key: 'maxLoad' },
    { title: '优先级', dataIndex: 'priority', key: 'priority' },
    { title: '启用', dataIndex: 'active', key: 'active', render: (v: boolean, r: RoutingRule) => <Switch checked={v} onChange={(c) => handleToggle(r.id, c)} /> },
    { title: '操作', key: 'action', render: (_: unknown, r: RoutingRule) => <Button size="small" icon={<Edit3 size={14} />} onClick={() => handleEdit(r)}>编辑</Button> },
  ]

  const historyColumns = [
    { title: '分配ID', dataIndex: 'id', key: 'id' },
    { title: '检查号', dataIndex: 'studyId', key: 'studyId' },
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: '模态', dataIndex: 'modality', key: 'modality' },
    { title: '分配至', dataIndex: 'assignedTo', key: 'assignedTo' },
    { title: '匹配规则', dataIndex: 'ruleName', key: 'ruleName' },
    { title: '分配时间', dataIndex: 'assignedAt', key: 'assignedAt' },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <GitBranch size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>智能路由</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总分配" value={stats.total} prefix={<History size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="规则数" value={rules.length} prefix={<GitBranch size={16} />} /></Card></Col>
        {Object.entries(stats.byModality).map(([k, v]) => (
          <Col span={4} key={k}><Card><Statistic title={`${k}分配`} value={v} suffix="次" /></Card></Col>
        ))}
      </Row>
      <Tabs items={[
        { key: 'rules', label: <span><GitBranch size={14} /> 路由规则</span>, children: <Card><Table rowKey="id" dataSource={rules} columns={ruleColumns} pagination={false} size="small" /></Card> },
        { key: 'history', label: <span><History size={14} /> 分配历史</span>, children: <Card><Table rowKey="id" dataSource={history} columns={historyColumns} pagination={false} size="small" /></Card> },
        { key: 'stats', label: <span><BarChart3 size={14} /> 路由统计</span>, children: <Card><Row gutter={16}>{Object.entries(stats.byDoctor).map(([k, v]) => <Col key={k} span={6}><Card><Statistic title={k} value={v} suffix="次" /></Card></Col>)}</Row></Card> },
      ]} />
      <Modal title="编辑路由规则" open={editOpen} onOk={handleSave} onCancel={() => setEditOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="规则名称"><Input /></Form.Item>
          <Form.Item name="modality" label="模态"><Select options={[{ value: 'CT', label: 'CT' }, { value: 'MR', label: 'MR' }, { value: 'DX', label: 'DX' }, { value: 'Any', label: '任意' }]} /></Form.Item>
          <Form.Item name="bodyPart" label="部位"><Select options={[{ value: 'Chest', label: 'Chest' }, { value: 'Brain', label: 'Brain' }, { value: 'Any', label: '任意' }]} /></Form.Item>
          <Form.Item name="patientStatus" label="患者状态"><Select options={[{ value: 'Inpatient', label: '住院' }, { value: 'Outpatient', label: '门诊' }, { value: 'Emergency', label: '急诊' }, { value: 'Any', label: '任意' }]} /></Form.Item>
          <Form.Item name="maxLoad" label="最大负载"><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="priority" label="优先级"><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SmartRoutePage
