import { usePagination } from '../../hooks/usePagination'
import { smartRouteApi, type SmartRouteRule, type SmartRouteAssignment, type SmartRouteStats, type DoctorRecommendation } from '../../services/api/smartRouteApi'
import { Card, Table, Button, Space, Switch, InputNumber, Input, Modal, Form, Select, Row, Col, Statistic, message, Tabs, Alert, Tag, Progress } from 'antd'
import { GitBranch, Edit3, BarChart3, History } from 'lucide-react'
import { RefreshCw } from 'lucide-react'
import { UserCheck, Zap } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'

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
  // [W3-C] 受控分页: 分配历史表 (规则表数据少, 不分页)
  const historyPagination = usePagination(history, 10);
  // 推荐分配面板
  const [recommendForm] = Form.useForm()
  const [recommendations, setRecommendations] = useState<DoctorRecommendation[]>([])
  const [recommending, setRecommending] = useState(false)
  const [assigningId, setAssigningId] = useState<string | null>(null)

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

  const handleRecommend = async () => {
    const values = await recommendForm.validateFields()
    setRecommending(true)
    try {
      const res = await smartRouteApi.recommend({ modality: values.modality, bodyPart: values.bodyPart, patientStatus: values.patientStatus })
      if (!res.success) throw new Error((res.error as { message?: string })?.message || '推荐失败')
      setRecommendations(res.data)
      if (res.data.length === 0) message.info('无匹配医生资质')
    } catch (e) {
      message.error((e as Error)?.message || '推荐失败')
    } finally {
      setRecommending(false)
    }
  }

  const handleAssign = async (doctorId?: string) => {
    const values = await recommendForm.validateFields()
    if (!values.studyId || !values.patientName) {
      message.warning('请填写检查号与患者姓名')
      return
    }
    setAssigningId(doctorId ?? null)
    try {
      const res = await smartRouteApi.assign({
        studyId: values.studyId,
        patientName: values.patientName,
        modality: values.modality,
        bodyPart: values.bodyPart,
        patientStatus: values.patientStatus,
        doctorId,
      })
      if (!res.success) throw new Error((res.error as { message?: string })?.message || '分配失败')
      message.success(`已分配至 ${res.data.assignedTo}：${res.data.reason ?? ''}`)
      setRecommendations([])
      recommendForm.resetFields(['studyId', 'patientName'])
      fetchAll()
    } catch (e) {
      message.error((e as Error)?.message || '分配失败')
    } finally {
      setAssigningId(null)
    }
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
        <GitBranch size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>智能路由</span>
      </Space>
      {error && <Alert type="warning" showIcon message="加载失败" description={error} action={<Button size="small" onClick={fetchAll}><RefreshCw size={14} /> 重试</Button>} style={{ marginBottom: 16 }} />}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总分配" value={totalAssign} prefix={<History size={16} />} loading={loading} /></Card></Col>
        <Col span={6}><Card><Statistic title="规则数" value={rules.length} prefix={<GitBranch size={16} />} loading={loading} /></Card></Col>
        {Object.entries(byModality).slice(0, 2).map(([k, v]) => (
          <Col span={4} key={k}><Card><Statistic title={`${k}分配`} value={v} suffix="次" loading={loading} /></Card></Col>
        ))}
      </Row>
      <Tabs items={[
        { key: 'recommend', label: <span><UserCheck size={14} /> 推荐分配</span>, children: (
          <Card>
            <Form form={recommendForm} layout="inline" initialValues={{ modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient' }} style={{ marginBottom: 16 }}>
              <Form.Item name="studyId" label="检查号" rules={[{ required: true, message: '必填' }]}><Input placeholder="如 STU-20260809-001" style={{ width: 180 }} /></Form.Item>
              <Form.Item name="patientName" label="患者姓名" rules={[{ required: true, message: '必填' }]}><Input placeholder="患者姓名" style={{ width: 140 }} /></Form.Item>
              <Form.Item name="modality" label="模态"><Select options={[{ value: 'CT', label: 'CT' }, { value: 'MR', label: 'MR' }, { value: 'DX', label: 'DX' }]} style={{ width: 100 }} /></Form.Item>
              <Form.Item name="bodyPart" label="部位"><Select options={[{ value: 'Chest', label: '胸部' }, { value: 'Brain', label: '脑部' }, { value: 'Abdomen', label: '腹部' }, { value: 'Any', label: '任意' }]} style={{ width: 110 }} /></Form.Item>
              <Form.Item name="patientStatus" label="患者状态"><Select options={[{ value: 'Inpatient', label: '住院' }, { value: 'Outpatient', label: '门诊' }, { value: 'Emergency', label: '急诊' }, { value: 'Any', label: '任意' }]} style={{ width: 110 }} /></Form.Item>
              <Form.Item>
                <Button type="primary" icon={<UserCheck size={14} />} loading={recommending} onClick={handleRecommend}>获取推荐医生</Button>
              </Form.Item>
              <Form.Item>
                <Button icon={<Zap size={14} />} disabled={recommendations.length === 0} onClick={() => handleAssign()}>一键分配(推荐Top1)</Button>
              </Form.Item>
            </Form>
            <Alert type="info" showIcon style={{ marginBottom: 16 }}
              message="资质感知路由：按 模态/亚专科 → 医生资质匹配度 + 当日负载 + 历史报告准确率 综合打分推荐，点击医生卡片可指定分配。" />
            <Row gutter={[16, 16]}>
              {recommendations.map((rec) => (
                <Col xs={24} md={12} xl={8} key={rec.doctorId}>
                  <Card
                    size="small"
                    title={
                      <Space>
                        <span style={{ fontWeight: 700 }}>{rec.name}</span>
                        <Tag color={rec.qualified ? 'blue' : 'default'}>{rec.subspecialty}</Tag>
                        {rec.qualified && <Tag color="green">可接诊</Tag>}
                      </Space>
                    }
                    extra={<span style={{ fontSize: 16, fontWeight: 800, color: rec.qualified ? '#2563eb' : '#94a3b8' }}>{(rec.composite * 100).toFixed(0)}分</span>}
                    style={{ borderColor: rec.qualified ? '#93c5fd' : '#e2e8f0', height: '100%' }}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>资质匹配度 <b style={{ color: '#1e40af' }}>{Math.round(rec.matchScore * 100)}%</b></div>
                      <Progress percent={Math.round(rec.matchScore * 100)} showInfo={false} size="small" strokeColor={rec.matchScore >= 1 ? '#16a34a' : rec.matchScore >= 0.5 ? '#d97706' : '#94a3b8'} />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>当前负载 <b style={{ color: '#1e40af' }}>{rec.currentLoad}/{rec.maxLoad}</b></div>
                      <Progress percent={Math.min(100, Math.round((rec.currentLoad / Math.max(1, rec.maxLoad)) * 100))} showInfo={false} size="small" strokeColor={rec.currentLoad < rec.maxLoad ? '#2563eb' : '#dc2626'} />
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>历史准确率 <b style={{ color: '#16a34a' }}>{Math.round(rec.accuracy * 100)}分</b></div>
                    <ul style={{ margin: '0 0 12px', paddingLeft: 16, fontSize: 12, color: '#64748b', lineHeight: 1.8 }}>
                      {rec.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                    <Button type="primary" block size="small" icon={<Zap size={13} />} disabled={!rec.qualified} loading={assigningId === rec.doctorId} onClick={() => handleAssign(rec.doctorId)}>一键分配</Button>
                  </Card>
                </Col>
              ))}
              {recommendations.length === 0 && !recommending && (
                <Col span={24}><div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>填写检查信息后获取资质感知推荐医生列表</div></Col>
              )}
            </Row>
          </Card>
        ) },
        { key: 'rules', label: <span><GitBranch size={14} /> 路由规则</span>, children: <Card><Table rowKey="id" dataSource={rules} columns={ruleColumns} pagination={false} size="small" loading={loading} scroll={{ x: 'max-content' }}/></Card> },
        { key: 'history', label: <span><History size={14} /> 分配历史</span>, children: <Card><Table rowKey="id" dataSource={historyPagination.pageData} columns={historyColumns} pagination={historyPagination.pagination} size="small" loading={loading} scroll={{ x: 'max-content' }}/></Card> },
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
