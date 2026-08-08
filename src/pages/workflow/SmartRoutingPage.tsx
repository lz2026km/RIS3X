import React, { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Button, Tag, Space, Switch, InputNumber, Input, Modal, Form, Select,
  Row, Col, Statistic, Tabs, message, Alert, Progress,
} from 'antd'
import { GitBranch, Plus, Edit3, History, RefreshCw, User, GraduationCap, Route } from 'lucide-react'
import {
  smartRouteApi,
  type SmartRouteRule,
  type SmartRouteAssignment,
  type DoctorQualification,
} from '../../services/api/smartRouteApi'
import { usePagination } from '../../hooks/usePagination'

const stageMeta: Record<string, { label: string; color: string }> = {
  qualification: { label: '资质匹配', color: 'blue' },
  'load-balance': { label: '负载均衡', color: 'green' },
  priority: { label: '优先级兜底', color: 'orange' },
  fallback: { label: '兜底', color: 'red' },
}

const SmartRoutingPage: React.FC = () => {
  const [rules, setRules] = useState<SmartRouteRule[]>([])
  const [qualifications, setQualifications] = useState<DoctorQualification[]>([])
  const [history, setHistory] = useState<SmartRouteAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('rules')
  const [editOpen, setEditOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<SmartRouteRule | null>(null)
  const [assignForm] = Form.useForm()
  const [ruleForm] = Form.useForm()
  const [assigning, setAssigning] = useState(false)
  const [preview, setPreview] = useState<SmartRouteAssignment | null>(null)
  // [W3-C] 受控分页: 分配历史表
  const historyPagination = usePagination(history, 10)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [r, q, h] = await Promise.all([smartRouteApi.getRules(), smartRouteApi.getQualifications(), smartRouteApi.getHistory()])
      if (!r.success) throw new Error('规则加载失败')
      if (r.success) setRules(r.data)
      if (q.success) setQualifications(q.data)
      if (h.success) setHistory(h.data)
    } catch {
      setError('数据加载失败,请检查网络后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const saveRules = async (next: SmartRouteRule[]) => {
    try {
      const res = await smartRouteApi.updateRules(next)
      if (!res.success) throw new Error()
      setRules(res.data)
      return true
    } catch {
      message.error('保存失败')
      return false
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    const next = rules.map((r) => (r.id === id ? { ...r, enabled } : r))
    if (await saveRules(next)) message.success(enabled ? '已启用' : '已禁用')
  }

  const handleSaveRule = () => {
    ruleForm.validateFields().then(async (values) => {
      const next = editingRule
        ? rules.map((r) => (r.id === editingRule.id ? { ...r, ...values } : r))
        : [...rules, { id: `rr-${Date.now().toString().slice(-6)}`, ...values }]
      if (await saveRules(next)) {
        message.success(editingRule ? '规则已更新' : '规则已创建')
        setEditOpen(false)
      }
    })
  }

  const handleAssign = () => {
    assignForm.validateFields().then(async (values) => {
      setAssigning(true)
      try {
        const res = await smartRouteApi.assign(values)
        if (!res.success) throw new Error('分配失败')
        setPreview(res.data)
        setHistory((prev) => [res.data, ...prev])
        message.success(`已按 ${res.data.stage ? (stageMeta[res.data.stage]?.label ?? '') : ''} 分配至 ${res.data.assignedTo}`)
      } catch {
        message.error('分配失败')
      } finally {
        setAssigning(false)
      }
    })
  }

  const ruleColumns = [
    { title: '规则名称', dataIndex: 'name', key: 'name', render: (n: string) => <strong>{n}</strong> },
    { title: '模态', dataIndex: 'modality', key: 'modality', width: 80, render: (m: string) => <Tag color="blue">{m}</Tag> },
    { title: '部位', dataIndex: 'bodyPart', key: 'bodyPart', width: 90 },
    {
      title: '患者状态', dataIndex: 'patientStatus', key: 'patientStatus', width: 110,
      render: (s: string) => <Tag color={s === 'Emergency' ? 'red' : 'default'}>{s}</Tag>,
    },
    { title: '最大负载', dataIndex: 'maxLoad', key: 'maxLoad', width: 90, render: (l: number) => `${l} 例` },
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80, render: (p: number) => <Tag color={p === 0 ? 'red' : 'default'}>{p}</Tag> },
    {
      title: '启用', dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (e: boolean, r: SmartRouteRule) => <Switch checked={e} onChange={(c) => handleToggle(r.id, c)} />,
    },
    {
      title: '操作', key: 'action', width: 90,
      render: (_: unknown, r: SmartRouteRule) => (
        <Button
          size="small"
          icon={<Edit3 size={14} />}
          onClick={() => {
            setEditingRule(r)
            ruleForm.setFieldsValue(r)
            setEditOpen(true)
          }}
        >
          编辑
        </Button>
      ),
    },
  ]

  const qualColumns = [
    { title: '医生', dataIndex: 'name', key: 'name', render: (n: string) => <Space><User size={14} />{n}</Space> },
    { title: '亚专科', dataIndex: 'subspecialty', key: 'subspecialty', width: 110, render: (s: string) => <Tag color="purple">{s}</Tag> },
    { title: '可接诊设备', dataIndex: 'modality', key: 'modality', width: 150, render: (m: string[]) => <Space size={4}>{m.map((x) => <Tag key={x}>{x}</Tag>)}</Space> },
    { title: '部位', dataIndex: 'bodyParts', key: 'bodyParts', width: 150, render: (b: string[]) => <Space size={4}>{b.map((x) => <Tag key={x}>{x}</Tag>)}</Space> },
    { title: '资质', dataIndex: 'qualifications', key: 'qualifications', render: (q: string[]) => <Space size={4} wrap>{q.map((x) => <Tag key={x} color="green">{x}</Tag>)}</Space> },
    {
      title: '当前负载', key: 'load', width: 180,
      render: (_: unknown, q: DoctorQualification) => (
        <Space size={8}>
          <span>{q.currentLoad}/{q.maxLoad}</span>
          <Progress percent={Math.min(100, Math.round((q.currentLoad / q.maxLoad) * 100))} size="small" style={{ width: 80 }} showInfo={false} status={q.currentLoad >= q.maxLoad ? 'exception' : 'active'} />
        </Space>
      ),
    },
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 70 },
  ]

  const historyColumns = [
    { title: '检查号', dataIndex: 'studyId', key: 'studyId' },
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: '模态', dataIndex: 'modality', key: 'modality', width: 70 },
    { title: '分配至', dataIndex: 'assignedTo', key: 'assignedTo', width: 110 },
    { title: '匹配规则', dataIndex: 'ruleName', key: 'ruleName' },
    {
      title: '路由阶段', dataIndex: 'stage', key: 'stage', width: 110,
      render: (s: string) => (s ? <Tag color={stageMeta[s]?.color ?? 'default'}>{stageMeta[s]?.label ?? s}</Tag> : '-'),
    },
    { title: '资质', dataIndex: 'qualification', key: 'qualification', width: 100, render: (v: string) => v || '-' },
    { title: '说明', dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: '分配时间', dataIndex: 'assignedAt', key: 'assignedAt', width: 170 },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Route size={20} color="#2563eb" />
        <h1 style={{ fontSize: 20, margin: 0 }}>智能路由</h1>
        <Tag color="blue">资质感知路由</Tag>
        <Tag color="purple">资质匹配 → 负载均衡 → 优先级</Tag>
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={fetchAll}>重试</Button>} />}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="路由规则" value={rules.length} prefix={<GitBranch size={16} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="资质医生" value={qualifications.length} prefix={<GraduationCap size={16} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="累计分配" value={history.length} prefix={<History size={16} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="规则优先级" value={rules.filter((r) => r.enabled).length} suffix="/ 启用" /></Card></Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'rules',
            label: <span><GitBranch size={14} /> 路由规则</span>,
            children: (
              <Card
                extra={
                  <Space>
                    <Button
                      type="primary"
                      icon={<Plus size={14} />}
                      onClick={() => {
                        setEditingRule(null)
                        ruleForm.resetFields()
                        setEditOpen(true)
                      }}
                    >
                      新建规则
                    </Button>
                    <Button icon={<RefreshCw size={14} />} onClick={fetchAll} loading={loading}>刷新</Button>
                  </Space>
                }
              >
                <Table rowKey="id" dataSource={rules} columns={ruleColumns} loading={loading} pagination={false} size="small" scroll={{ x: 'max-content' }}/>
              </Card>
            ),
          },
          {
            key: 'qualifications',
            label: <span><GraduationCap size={14} /> 医生资质</span>,
            children: <Card><Table rowKey="doctorId" dataSource={qualifications} columns={qualColumns} loading={loading} pagination={false} size="small" scroll={{ x: 'max-content' }}/></Card>,
          },
          {
            key: 'assign',
            label: <span><Route size={14} /> 分配预览</span>,
            children: (
              <Card>
                <Form form={assignForm} layout="vertical" style={{ maxWidth: 900 }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="studyId" label="检查号" rules={[{ required: true, message: '请输入检查号' }]}>
                        <Input placeholder="STU-2026-0001" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="patientName" label="患者姓名" rules={[{ required: true, message: '请输入患者姓名' }]}>
                        <Input placeholder="张三" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="patientStatus" label="患者状态" rules={[{ required: true }]} initialValue="Inpatient">
                        <Select options={[
                          { value: 'Inpatient', label: '住院' },
                          { value: 'Outpatient', label: '门诊' },
                          { value: 'Emergency', label: '急诊' },
                        ]} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="modality" label="设备类型" rules={[{ required: true }]} initialValue="CT">
                        <Select options={[{ value: 'CT', label: 'CT' }, { value: 'MR', label: 'MR' }, { value: 'DX', label: 'DX' }, { value: 'US', label: 'US' }]} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="bodyPart" label="检查部位" rules={[{ required: true }]} initialValue="Chest">
                        <Select options={[
                          { value: 'Chest', label: '胸部' },
                          { value: 'Brain', label: '头部' },
                          { value: 'Abdomen', label: '腹部' },
                          { value: 'Any', label: '任意' },
                        ]} />
                      </Form.Item>
                    </Col>
                    <Col span={8} style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <Form.Item>
                        <Button type="primary" icon={<Route size={14} />} loading={assigning} onClick={handleAssign} block>
                          模拟分配
                        </Button>
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>

                {preview && (
                  <Card size="small" title="分配结果预览" style={{ marginBottom: 16, background: '#f6ffed' }}>
                    <Row gutter={16}>
                      <Col span={6}>
                        <Statistic title="分配医生" value={preview.assignedTo} styles={{ content: { fontSize: 18 } }} prefix={<User size={16} />} />
                      </Col>
                      <Col span={6}>
                        <Statistic title="匹配规则" value={preview.ruleName} styles={{ content: { fontSize: 18 } }} />
                      </Col>
                      <Col span={6}>
                        <Statistic title="路由阶段" value={stageMeta[preview.stage ?? 'fallback']?.label ?? '-'} styles={{ content: { fontSize: 18, color: stageMeta[preview.stage ?? 'fallback']?.color } }} />
                      </Col>
                      <Col span={6}>
                        <Statistic title="匹配资质" value={preview.qualification ?? '-'} styles={{ content: { fontSize: 18 } }} />
                      </Col>
                    </Row>
                    <div style={{ marginTop: 12, color: '#389e0d' }}>
                      说明: {preview.reason} · {new Date(preview.assignedAt).toLocaleString()}
                    </div>
                  </Card>
                )}

                <h4 style={{ margin: '8px 0' }}>分配历史</h4>
                <Table rowKey="id" dataSource={historyPagination.pageData} columns={historyColumns} pagination={historyPagination.pagination} size="small" scroll={{ x: 'max-content' }}/>
              </Card>
            ),
          },
        ]}
      />

      <Modal title={editingRule ? '编辑路由规则' : '新建路由规则'} open={editOpen} onOk={handleSaveRule} onCancel={() => setEditOpen(false)}>
        <Form form={ruleForm} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="modality" label="设备类型" rules={[{ required: true }]}>
            <Select options={[
              { value: 'CT', label: 'CT' }, { value: 'MR', label: 'MR' }, { value: 'DX', label: 'DX' },
              { value: 'US', label: 'US' }, { value: 'Any', label: '任意' },
            ]} />
          </Form.Item>
          <Form.Item name="bodyPart" label="部位">
            <Select options={[
              { value: 'Chest', label: '胸部' }, { value: 'Brain', label: '头部' }, { value: 'Abdomen', label: '腹部' },
              { value: 'Any', label: '任意' },
            ]} />
          </Form.Item>
          <Form.Item name="patientStatus" label="患者状态">
            <Select options={[
              { value: 'Inpatient', label: '住院' }, { value: 'Outpatient', label: '门诊' },
              { value: 'Emergency', label: '急诊' }, { value: 'Any', label: '任意' },
            ]} />
          </Form.Item>
          <Form.Item name="maxLoad" label="最大负载"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
          <Form.Item name="priority" label="优先级(越小越优先)"><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SmartRoutingPage
