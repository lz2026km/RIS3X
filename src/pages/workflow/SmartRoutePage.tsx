import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Space, Switch, InputNumber, Input, Modal, Form, Select, Row, Col, Statistic, message, Tabs, Alert } from 'antd'
import { GitBranch, Edit3, BarChart3, History } from 'lucide-react'
import { smartRouteApi, type SmartRouteRule, type SmartRouteAssignment, type SmartRouteStats } from '../../services/api/smartRouteApi'

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

const toRuleDto = (r: RoutingRule): SmartRouteRule => ({
  id: r.id, name: r.name, modality: r.modality, bodyPart: r.bodyPart,
  patientStatus: r.patientStatus, maxLoad: r.maxLoad, priority: r.priority, enabled: r.active,
})

const fromRuleDto = (d: SmartRouteRule): RoutingRule => ({
  id: d.id, name: d.name, modality: d.modality, bodyPart: d.bodyPart,
  patientStatus: d.patientStatus, maxLoad: d.maxLoad, priority: d.priority, active: d.enabled,
})

const SmartRoutePage: React.FC = () => {
  const [rules, setRules] = useState<RoutingRule[]>([])
  const [history, setHistory] = useState<SmartRouteAssignment[]>([])
  const [stats, setStats] = useState<SmartRouteStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null)
  const [form] = Form.useForm()

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rulesRes, historyRes, statsRes] = await Promise.all([
        smartRouteApi.getRules(), smartRouteApi.getHistory(), smartRouteApi.getStats(),
      ])
      if (!rulesRes.success) throw new Error((rulesRes.error as { message?: string })?.message || '路由规则加载失败')
      if (!historyRes.success) throw new Error((historyRes.error as { message?: string })?.message || '分配历史加载失败')
      setRules(rulesRes.data.map(fromRuleDto))
      setHistory(historyRes.data)
      if (statsRes.success) setStats(statsRes.data)
    } catch (e) {
      setError((e as Error)?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleEdit = (rule: RoutingRule) => {
    setEditingRule(rule)
    form.setFieldsValue(rule)
    setEditOpen(true)
  }

  const handleSave = () => {
    form.validateFields().then(async values => {
      if (!editingRule) return
      const next = rules.map(r => r.id === editingRule.id ? { ...r, ...values } : r)
      const res = await smartRouteApi.updateRules(next.map(toRuleDto))
      if (!res.success) { message.error('规则更新失败'); return }
      setRules(res.data.map(fromRuleDto))
      setEditOpen(false)
      message.success('规则已更新')
    })
  }

  const handleToggle = async (id: string, active: boolean) => {
    const next = rules.map(r => r.id === id ? { ...r, active } : r)
    const prev = rules
    setRules(next)
    const res = await smartRouteApi.updateRules(next.map(toRuleDto))
    if (!res.success) {
      setRules(prev)
      message.error('状态切换失败，已还原')
      return
    }
    setRules(res.data.map(fromRuleDto))
    message.success(active ? '规则已启用' : '规则已禁用')
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
    { title: '分配时间', dataIndex: 'assignedAt', key: 'assignedAt', render: (t: string) => new Date(t).toLocaleString('zh-CN') },
  ]

  const totalAssign = stats?.total ?? history.length
  const byModality = stats?.byModality ?? {}
  const byDoctor = stats?.byDoctor ?? {}

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <GitBranch size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>智能路由</span>
      </Space>
      {error && <Alert type="warning" showIcon message="加载失败" description={error} action={<Button size="small" onClick={fetchAll}>重试</Button>} style={{ marginBottom: 16 }} />}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总分配" value={totalAssign} prefix={<History size={16} />} loading={loading} /></Card></Col>
        <Col span={6}><Card><Statistic title="规则数" value={rules.length} prefix={<GitBranch size={16} />} loading={loading} /></Card></Col>
        {Object.entries(byModality).slice(0, 2).map(([k, v]) => (
          <Col span={4} key={k}><Card><Statistic title={`${k}分配`} value={v} suffix="次" loading={loading} /></Card></Col>
        ))}
      </Row>
      <Tabs items={[
        { key: 'rules', label: <span><GitBranch size={14} /> 路由规则</span>, children: <Card><Table rowKey="id" dataSource={rules} columns={ruleColumns} pagination={false} size="small" loading={loading} /></Card> },
        { key: 'history', label: <span><History size={14} /> 分配历史</span>, children: <Card><Table rowKey="id" dataSource={history} columns={historyColumns} pagination={{ pageSize: 10 }} size="small" loading={loading} /></Card> },
        { key: 'stats', label: <span><BarChart3 size={14} /> 路由统计</span>, children: <Card><Row gutter={16}>{Object.entries(byDoctor).map(([k, v]) => <Col key={k} span={6}><Card><Statistic title={k} value={v} suffix="次" loading={loading} /></Card></Col>)}</Row></Card> },
      ]} />
      <Modal title="编辑路由规则" open={editOpen} onOk={handleSave} onCancel={() => setEditOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="规则名称"><Input /></Form.Item>
          <Form.Item name="modality" label="模态"><Select options={[{ value: 'CT', label: 'CT' }, { value: 'MR', label: 'MR' }, { value: 'DX', label: 'DX' }, { value: 'Any', label: '任意' }]} /></Form.Item>
          <Form.Item name="bodyPart" label="部位"><Select options={[{ value: 'Chest', label: '胸部' }, { value: 'Brain', label: '脑部' }, { value: 'Any', label: '任意' }]} /></Form.Item>
          <Form.Item name="patientStatus" label="患者状态"><Select options={[{ value: 'Inpatient', label: '住院' }, { value: 'Outpatient', label: '门诊' }, { value: 'Emergency', label: '急诊' }, { value: 'Any', label: '任意' }]} /></Form.Item>
          <Form.Item name="maxLoad" label="最大负载"><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="priority" label="优先级"><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SmartRoutePage
