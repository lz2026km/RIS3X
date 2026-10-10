import { usePagination } from '../../hooks/usePagination'
import {
  smartRouteApi,
  type SmartRouteRule,
  type SmartRouteAssignment,
  type DoctorQualification,
} from '../../services/api/smartRouteApi'
import {
  Card,
  Button,
  Tag,
  Space,
  Switch,
  InputNumber,
  Input,
  Modal,
  Form,
  Select,
  Row,
  Col,
  Statistic,
  Tabs,
  message,
  Alert,
  Progress,
  Popconfirm,
} from "antd";
import { GitBranch, Plus, Edit3, History, RefreshCw, User, GraduationCap, Route, Trash2 } from 'lucide-react'
import { DataTable, StatCard, StatCardGrid } from "../../components/common"
import React, { useState, useEffect, useCallback } from 'react'
import { workflowApi } from '../../services/api/workflowApi'
import { t } from '../../i18n/appI18n'
import { uniqueId } from '../../utils/uniqueId'

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
      if (!r.success) throw new Error(t('smartRouting.rulesLoadFailed'))
      if (r.success) setRules(r.data)
      if (q.success) setQualifications(q.data)
      if (h.success) setHistory(h.data)
    } catch {
      setError(t('smartRouting.dataLoadFailed'))
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
      message.error(t('smartRouting.saveFailed'))
      return false
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    const next = rules.map((r) => (r.id === id ? { ...r, enabled } : r))
    if (await saveRules(next)) message.success(enabled ? t('smartRouting.enabled') : t('smartRouting.disabled'))
  }

  const handleSaveRule = () => {
    ruleForm.validateFields().then(async (values) => {
      const next = editingRule
        ? rules.map((r) => (r.id === editingRule.id ? { ...r, ...values } : r))
        : [...rules, { id: uniqueId('rr'), ...values }]
      if (await saveRules(next)) {
        message.success(editingRule ? t('smartRouting.ruleUpdated') : t('smartRouting.ruleCreated'))
        setEditOpen(false)
      }
    })
  }

  const handleAssign = () => {
    assignForm.validateFields().then(async (values) => {
      setAssigning(true)
      try {
        const res = await smartRouteApi.assign(values)
        if (!res.success) throw new Error(t('smartRouting.assignFailed'))
        setPreview(res.data)
        setHistory((prev) => [res.data, ...prev])
        message.success(`已按 ${res.data.stage ? (stageMeta[res.data.stage]?.label ?? '') : ''} 分配至 ${res.data.assignedTo}`)
      } catch {
        message.error(t('smartRouting.assignFailed'))
      } finally {
        setAssigning(false)
      }
    })
  }

  // [G005 Wave1B] 规则行删除: 优先 workflowApi.deleteRoutingRule (DELETE /workflow/routing-rules/:id),
  // 失败则回退本地移除 (通过 smartRouteApi.updateRules 批量持久化)
  const handleDeleteRule = async (r: SmartRouteRule) => {
    let apiOk = false
    try {
      const res = await workflowApi.deleteRoutingRule(r.id)
      apiOk = res.success
      if (!apiOk) throw new Error(res.error?.message ?? t('smartRouting.deleteFailed'))
    } catch (e) {
      console.warn('[smart-route] deleteRoutingRule failed, fallback local remove:', (e as Error)?.message)
    }
    const next = rules.filter((x) => x.id !== r.id)
    const saved = await saveRules(next)
    if (saved) {
      message.success(apiOk ? `规则 "${r.name}" 已删除 (workflow/routing-rules)` : `规则 "${r.name}" 已删除 (后端不可用, 本地移除)`)
    }
  }

  const ruleColumns = [
    { title: t('smartRouting.ruleName'), dataIndex: 'name', key: 'name', render: (n: string) => <strong>{n}</strong> },
    { title: t('smartRouting.modality'), dataIndex: 'modality', key: 'modality', width: 80, render: (m: string) => <Tag color="blue">{m}</Tag> },
    { title: t('smartRouting.bodyPart'), dataIndex: 'bodyPart', key: 'bodyPart', width: 90 },
    {
      title: t('smartRouting.patientStatus'), dataIndex: 'patientStatus', key: 'patientStatus', width: 110,
      render: (s: string) => <Tag color={s === 'Emergency' ? 'red' : 'default'}>{s}</Tag>,
    },
    { title: t('smartRouting.maxLoad'), dataIndex: 'maxLoad', key: 'maxLoad', width: 90, render: (l: number) => `${l} 例` },
    { title: t('smartRouting.priority'), dataIndex: 'priority', key: 'priority', width: 80, render: (p: number) => <Tag color={p === 0 ? 'red' : 'default'}>{p}</Tag> },
    {
      title: t('smartRouting.enabledCol'), dataIndex: 'enabled', key: 'enabled', width: 80,
      render: (e: boolean, r: SmartRouteRule) => <Switch checked={e} onChange={(c) => handleToggle(r.id, c)} />,
    },
    {
      title: t('smartRouting.actions'), key: 'action', width: 160,
      render: (_: unknown, r: SmartRouteRule) => (
        <Space size={6}>
          <Button
            size="small"
            icon={<Edit3 size={14} />}
            onClick={() => {
              setEditingRule(r)
              ruleForm.setFieldsValue(r)
              setEditOpen(true)
            }}
          >
            {t('smartRouting.edit')}
          </Button>
          <Popconfirm
            title={t('smartRouting.deleteRule')}
            description={`确定删除 "${r.name}"?`}
            okText={t('smartRouting.delete')}
            cancelText={t('smartRouting.cancel')}
            onConfirm={() => void handleDeleteRule(r)}
          >
            <Button size="small" danger icon={<Trash2 size={14} />}>{t('smartRouting.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const qualColumns = [
    { title: t('smartRouting.doctor'), dataIndex: 'name', key: 'name', render: (n: string) => <Space><User size={14} />{n}</Space> },
    { title: t('smartRouting.subspecialty'), dataIndex: 'subspecialty', key: 'subspecialty', width: 110, render: (s: string) => <Tag color="purple">{s}</Tag> },
    { title: t('smartRouting.allowedModalities'), dataIndex: 'modality', key: 'modality', width: 150, render: (m: string[]) => <Space size={4}>{m.map((x) => <Tag key={x}>{x}</Tag>)}</Space> },
    { title: t('smartRouting.bodyPart'), dataIndex: 'bodyParts', key: 'bodyParts', width: 150, render: (b: string[]) => <Space size={4}>{b.map((x) => <Tag key={x}>{x}</Tag>)}</Space> },
    { title: t('smartRouting.qualification'), dataIndex: 'qualifications', key: 'qualifications', render: (q: string[]) => <Space size={4} wrap>{q.map((x) => <Tag key={x} color="green">{x}</Tag>)}</Space> },
    {
      title: t('smartRouting.currentLoad'), key: 'load', width: 180,
      render: (_: unknown, q: DoctorQualification) => (
        <Space size={8}>
          <span>{q.currentLoad}/{q.maxLoad}</span>
          <Progress percent={Math.min(100, Math.round((q.currentLoad / q.maxLoad) * 100))} size="small" style={{ width: 80 }} showInfo={false} status={q.currentLoad >= q.maxLoad ? 'exception' : 'active'} />
        </Space>
      ),
    },
    { title: t('smartRouting.priority'), dataIndex: 'priority', key: 'priority', width: 70 },
  ]

  const historyColumns = [
    { title: t('smartRouting.studyId'), dataIndex: 'studyId', key: 'studyId' },
    { title: t('smartRouting.patient'), dataIndex: 'patientName', key: 'patientName' },
    { title: t('smartRouting.modality'), dataIndex: 'modality', key: 'modality', width: 70 },
    { title: t('smartRouting.assignedTo'), dataIndex: 'assignedTo', key: 'assignedTo', width: 110 },
    { title: t('smartRouting.matchedRule'), dataIndex: 'ruleName', key: 'ruleName' },
    {
      title: t('smartRouting.routeStage'), dataIndex: 'stage', key: 'stage', width: 110,
      render: (s: string) => (s ? <Tag color={stageMeta[s]?.color ?? 'default'}>{stageMeta[s]?.label ?? s}</Tag> : '-'),
    },
    { title: t('smartRouting.qualification'), dataIndex: 'qualification', key: 'qualification', width: 100, render: (v: string) => v || '-' },
    { title: t('smartRouting.description'), dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: t('smartRouting.assignedAt'), dataIndex: 'assignedAt', key: 'assignedAt', width: 170 },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Route size={20} color="#2563eb" />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t('smartRouting.title')}</h1>
        <Tag color="blue">{t('smartRouting.tagQualificationAware')}</Tag>
        <Tag color="purple">{t('smartRouting.tagPipeline')}</Tag>
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={fetchAll}><RefreshCw size={14} /> {t('smartRouting.retry')}</Button>} />}

      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('smartRouting.statRules')} value={rules.length} icon={<GitBranch size={16} />} />
        <StatCard title={t('smartRouting.statDoctors')} value={qualifications.length} icon={<GraduationCap size={16} />} />
        <StatCard title={t('smartRouting.statAssignments')} value={history.length} icon={<History size={16} />} />
        <StatCard title={t('smartRouting.statRulePriority')} value={rules.filter((r) => r.enabled).length} suffix={t('smartRouting.suffixEnabled')} />
      </StatCardGrid>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'rules',
            label: <span><GitBranch size={14} /> {t('smartRouting.tabRules')}</span>,
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
                      {t('smartRouting.createRule')}
                    </Button>
                    <Button icon={<RefreshCw size={14} />} onClick={fetchAll} loading={loading}>{t('smartRouting.refresh')}</Button>
                  </Space>
                }
              >
                <DataTable rowKey="id" dataSource={rules} columns={ruleColumns} loading={loading} pagination={false} scroll={{ x: 'max-content' }}/>
              </Card>
            ),
          },
          {
            key: 'qualifications',
            label: <span><GraduationCap size={14} /> {t('smartRouting.tabQualifications')}</span>,
            children: <Card><DataTable rowKey="doctorId" dataSource={qualifications} columns={qualColumns} loading={loading} pagination={false} scroll={{ x: 'max-content' }}/></Card>,
          },
          {
            key: 'assign',
            label: <span><Route size={14} /> {t('smartRouting.tabAssign')}</span>,
            children: (
              <Card>
                <Form form={assignForm} layout="vertical" style={{ maxWidth: 900 }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="studyId" label={t('smartRouting.studyId')} rules={[{ required: true, message: t('smartRouting.requiredStudyId') }]}>
                        <Input placeholder="STU-2026-0001" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="patientName" label={t('smartRouting.patientName')} rules={[{ required: true, message: t('smartRouting.requiredPatientName') }]}>
                        <Input placeholder={t('smartRouting.patientNamePlaceholder')} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="patientStatus" label={t('smartRouting.patientStatus')} rules={[{ required: true }]} initialValue="Inpatient">
                        <Select options={[
                          { value: 'Inpatient', label: t('smartRouting.statusInpatient') },
                          { value: 'Outpatient', label: t('smartRouting.statusOutpatient') },
                          { value: 'Emergency', label: t('smartRouting.statusEmergency') },
                        ]} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="modality" label={t('smartRouting.modalityType')} rules={[{ required: true }]} initialValue="CT">
                        <Select options={[{ value: 'CT', label: 'CT' }, { value: 'MR', label: 'MR' }, { value: 'DX', label: 'DX' }, { value: 'US', label: 'US' }]} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="bodyPart" label={t('smartRouting.examBodyPart')} rules={[{ required: true }]} initialValue="Chest">
                        <Select options={[
                          { value: 'Chest', label: t('smartRouting.partChest') },
                          { value: 'Brain', label: t('smartRouting.partHead') },
                          { value: 'Abdomen', label: t('smartRouting.partAbdomen') },
                          { value: 'Any', label: t('smartRouting.partAny') },
                        ]} />
                      </Form.Item>
                    </Col>
                    <Col span={8} style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <Form.Item>
                        <Button type="primary" icon={<Route size={14} />} loading={assigning} onClick={handleAssign} block>
                          {t('smartRouting.simulateAssign')}
                        </Button>
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>

                {preview && (
                  <Card size="small" title={t('smartRouting.assignPreviewTitle')} style={{ marginBottom: 16, background: '#f6ffed' }}>
                    <Row gutter={16}>
                      <Col span={6}>
                        <Statistic title={t('smartRouting.assignedDoctor')} value={preview.assignedTo} styles={{ content: { fontSize: 18 } }} prefix={<User size={16} />} />
                      </Col>
                      <Col span={6}>
                        <Statistic title={t('smartRouting.matchedRule')} value={preview.ruleName} styles={{ content: { fontSize: 18 } }} />
                      </Col>
                      <Col span={6}>
                        <Statistic title={t('smartRouting.routeStage')} value={stageMeta[preview.stage ?? 'fallback']?.label ?? '-'} styles={{ content: { fontSize: 18, color: stageMeta[preview.stage ?? 'fallback']?.color } }} />
                      </Col>
                      <Col span={6}>
                        <Statistic title={t('smartRouting.matchedQualification')} value={preview.qualification ?? '-'} styles={{ content: { fontSize: 18 } }} />
                      </Col>
                    </Row>
                    <div style={{ marginTop: 12, color: '#389e0d' }}>
                      {t('smartRouting.reasonLabel')} {preview.reason} · {new Date(preview.assignedAt).toLocaleString()}
                    </div>
                  </Card>
                )}

                <h4 style={{ margin: '8px 0' }}>{t('smartRouting.assignHistory')}</h4>
                <DataTable rowKey="id" dataSource={historyPagination.pageData} columns={historyColumns} pagination={historyPagination.pagination} scroll={{ x: 'max-content' }}/>
              </Card>
            ),
          },
        ]}
      />

      <Modal title={editingRule ? t('smartRouting.editRuleTitle') : t('smartRouting.newRuleTitle')} open={editOpen} onOk={handleSaveRule} onCancel={() => setEditOpen(false)}>
        <Form form={ruleForm} layout="vertical">
          <Form.Item name="name" label={t('smartRouting.ruleName')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="modality" label={t('smartRouting.modalityType')} rules={[{ required: true }]}>
            <Select options={[
              { value: 'CT', label: 'CT' }, { value: 'MR', label: 'MR' }, { value: 'DX', label: 'DX' },
              { value: 'US', label: 'US' }, { value: 'Any', label: t('smartRouting.partAny') },
            ]} />
          </Form.Item>
          <Form.Item name="bodyPart" label={t('smartRouting.bodyPart')}>
            <Select options={[
              { value: 'Chest', label: t('smartRouting.partChest') }, { value: 'Brain', label: t('smartRouting.partHead') }, { value: 'Abdomen', label: t('smartRouting.partAbdomen') },
              { value: 'Any', label: t('smartRouting.partAny') },
            ]} />
          </Form.Item>
          <Form.Item name="patientStatus" label={t('smartRouting.patientStatus')}>
            <Select options={[
              { value: 'Inpatient', label: t('smartRouting.statusInpatient') }, { value: 'Outpatient', label: t('smartRouting.statusOutpatient') },
              { value: 'Emergency', label: t('smartRouting.statusEmergency') }, { value: 'Any', label: t('smartRouting.partAny') },
            ]} />
          </Form.Item>
          <Form.Item name="maxLoad" label={t('smartRouting.maxLoad')}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
          <Form.Item name="priority" label={t('smartRouting.priorityHint')}><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SmartRoutingPage
