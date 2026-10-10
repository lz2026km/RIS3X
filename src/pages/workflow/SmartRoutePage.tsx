import { usePagination } from '../../hooks/usePagination'
import { smartRouteApi, type SmartRouteRule, type SmartRouteAssignment, type SmartRouteStats, type DoctorRecommendation } from '../../services/api/smartRouteApi'
import {
  Card,
  Button,
  Space,
  Switch,
  InputNumber,
  Input,
  Modal,
  Form,
  Select,
  Row,
  Col,
  message,
  Tabs,
  Alert,
  Tag,
  Progress,
} from "antd";
import { DataTable, StatCard, StatCardGrid } from "../../components/common"
import { GitBranch, Edit3, BarChart3, History } from 'lucide-react'
import { RefreshCw } from 'lucide-react'
import { UserCheck, Zap } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'
import { t } from '../../i18n/appI18n'

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
  const watchStudyId = Form.useWatch('studyId', recommendForm)
  const watchPatientName = Form.useWatch('patientName', recommendForm)
  const recommendReady = !!(watchStudyId && watchPatientName)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rulesRes, historyRes, statsRes] = await Promise.all([
        smartRouteApi.getRules(), smartRouteApi.getHistory(), smartRouteApi.getStats(),
      ])
      if (!rulesRes.success) throw new Error((rulesRes.error as { message?: string })?.message || t('smartRoute.ruleLoadFailed'))
      if (!historyRes.success) throw new Error((historyRes.error as { message?: string })?.message || t('smartRoute.historyLoadFailed'))
      setRules(rulesRes.data.map(fromRuleDto))
      setHistory(historyRes.data)
      if (statsRes.success) setStats(statsRes.data)
    } catch (e) {
      setError((e as Error)?.message || t('smartRoute.loadFailed'))
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
      if (!res.success) { message.error(t('smartRoute.saveFailed')); return }
      setRules(res.data.map(fromRuleDto))
      setEditOpen(false)
      message.success(t('smartRoute.saved'))
    })
  }

  const handleToggle = async (id: string, active: boolean) => {
    const next = rules.map(r => r.id === id ? { ...r, active } : r)
    const prev = rules
    setRules(next)
    const res = await smartRouteApi.updateRules(next.map(toRuleDto))
    if (!res.success) {
      setRules(prev)
      message.error(t('smartRoute.toggleFailed'))
      return
    }
    setRules(res.data.map(fromRuleDto))
    message.success(active ? t('smartRoute.enabled') : t('smartRoute.disabled'))
  }

  const handleRecommend = async () => {
    let values: { studyId: string; patientName: string; modality: string; bodyPart: string; patientStatus: string }
    try {
      values = await recommendForm.validateFields()
    } catch {
      message.warning(t('smartRoute.fillStudyPatient'))
      return
    }
    setRecommending(true)
    try {
      const res = await smartRouteApi.recommend({ modality: values.modality, bodyPart: values.bodyPart, patientStatus: values.patientStatus })
      if (!res.success) throw new Error((res.error as { message?: string })?.message || t('smartRoute.recommendFailed'))
      setRecommendations(res.data)
      if (res.data.length === 0) message.info(t('smartRoute.noMatchingDoctor'))
    } catch (e) {
      message.error((e as Error)?.message || t('smartRoute.recommendFailed'))
    } finally {
      setRecommending(false)
    }
  }

  const handleAssign = async (doctorId?: string) => {
    const values = await recommendForm.validateFields()
    if (!values.studyId || !values.patientName) {
      message.warning(t('smartRoute.fillStudyPatient'))
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
      if (!res.success) throw new Error((res.error as { message?: string })?.message || t('smartRoute.assignFailed'))
      message.success(t('smartRoute.assignmentSuccess', { name: res.data.assignedTo, reason: res.data.reason ?? '' }))
      setRecommendations([])
      recommendForm.resetFields(['studyId', 'patientName'])
      fetchAll()
    } catch (e) {
      message.error((e as Error)?.message || t('smartRoute.assignFailed'))
    } finally {
      setAssigningId(null)
    }
  }

  const ruleColumns = [
    { title: t('smartRoute.colRuleName'), dataIndex: 'name', key: 'name' },
    { title: t('smartRoute.colModality'), dataIndex: 'modality', key: 'modality' },
    { title: t('smartRoute.colBodyPart'), dataIndex: 'bodyPart', key: 'bodyPart' },
    { title: t('smartRoute.colPatientStatus'), dataIndex: 'patientStatus', key: 'patientStatus' },
    { title: t('smartRoute.colMaxLoad'), dataIndex: 'maxLoad', key: 'maxLoad' },
    { title: t('smartRoute.colPriority'), dataIndex: 'priority', key: 'priority' },
    { title: t('smartRoute.colEnabled'), dataIndex: 'active', key: 'active', render: (v: boolean, r: RoutingRule) => <Switch checked={v} onChange={(c) => handleToggle(r.id, c)} /> },
    { title: t('smartRoute.colAction'), key: 'action', render: (_: unknown, r: RoutingRule) => <Button size="small" icon={<Edit3 size={14} />} onClick={() => handleEdit(r)}>{t('smartRoute.edit')}</Button> },
  ]

  const historyColumns = [
    { title: t('smartRoute.colAssignId'), dataIndex: 'id', key: 'id' },
    { title: t('smartRoute.colStudyId'), dataIndex: 'studyId', key: 'studyId' },
    { title: t('smartRoute.colPatient'), dataIndex: 'patientName', key: 'patientName' },
    { title: t('smartRoute.colModality'), dataIndex: 'modality', key: 'modality' },
    { title: t('smartRoute.colAssignedTo'), dataIndex: 'assignedTo', key: 'assignedTo' },
    { title: t('smartRoute.colMatchedRule'), dataIndex: 'ruleName', key: 'ruleName' },
    { title: t('smartRoute.colAssignedAt'), dataIndex: 'assignedAt', key: 'assignedAt', render: (value: string) => new Date(value).toLocaleString('zh-CN') },
  ]

  const totalAssign = stats?.total ?? history.length
  const byModality = stats?.byModality ?? {}
  const byDoctor = stats?.byDoctor ?? {}

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <GitBranch size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('smartRoute.title')}</span>
      </Space>
      {error && <Alert type="warning" showIcon message={t('smartRoute.loadFailed')} description={error} action={<Button size="small" onClick={fetchAll}><RefreshCw size={14} /> {t('smartRoute.retry')}</Button>} style={{ marginBottom: 16 }} />}
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('smartRoute.statTotalAssign')} value={totalAssign} icon={<History size={16} />} loading={loading} />
        <StatCard title={t('smartRoute.statRuleCount')} value={rules.length} icon={<GitBranch size={16} />} loading={loading} />
        {Object.entries(byModality).slice(0, 2).map(([k, v]) => (
          <StatCard key={k} title={t('smartRoute.modalityAssign', { modality: k })} value={v} suffix={t('smartRoute.unitTimes')} loading={loading} />
        ))}
      </StatCardGrid>
      <Tabs items={[
        { key: 'recommend', label: <span><UserCheck size={14} /> {t('smartRoute.tabRecommend')}</span>, children: (
          <Card>
            <Form form={recommendForm} layout="inline" initialValues={{ modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient' }} style={{ marginBottom: 16 }}>
              <Form.Item name="studyId" label={t('smartRoute.formStudyId')} rules={[{ required: true, message: t('smartRoute.required') }]}><Input placeholder={t('smartRoute.studyIdPlaceholder')} style={{ width: 180 }} /></Form.Item>
              <Form.Item name="patientName" label={t('smartRoute.formPatientName')} rules={[{ required: true, message: t('smartRoute.required') }]}><Input placeholder={t('smartRoute.patientNamePlaceholder')} style={{ width: 140 }} /></Form.Item>
              <Form.Item name="modality" label={t('smartRoute.formModality')}><Select options={[{ value: 'CT', label: 'CT' }, { value: 'MR', label: 'MR' }, { value: 'DX', label: 'DX' }]} style={{ width: 100 }} /></Form.Item>
              <Form.Item name="bodyPart" label={t('smartRoute.formBodyPart')}><Select options={[{ value: 'Chest', label: t('smartRoute.bodyPartChest') }, { value: 'Brain', label: t('smartRoute.bodyPartBrain') }, { value: 'Abdomen', label: t('smartRoute.bodyPartAbdomen') }, { value: 'Any', label: t('smartRoute.any') }]} style={{ width: 110 }} /></Form.Item>
              <Form.Item name="patientStatus" label={t('smartRoute.formPatientStatus')}><Select options={[{ value: 'Inpatient', label: t('smartRoute.statusInpatient') }, { value: 'Outpatient', label: t('smartRoute.statusOutpatient') }, { value: 'Emergency', label: t('smartRoute.statusEmergency') }, { value: 'Any', label: t('smartRoute.any') }]} style={{ width: 110 }} /></Form.Item>
              <Form.Item>
                <Button type="primary" icon={<UserCheck size={14} />} loading={recommending} disabled={!recommendReady} onClick={handleRecommend}>{t('smartRoute.getRecommendedDoctors')}</Button>
              </Form.Item>
              <Form.Item>
                <Button icon={<Zap size={14} />} disabled={recommendations.length === 0} onClick={() => handleAssign()}>{t('smartRoute.oneClickAssignTop')}</Button>
              </Form.Item>
            </Form>
            <Alert type="info" showIcon style={{ marginBottom: 16 }}
              message={t('smartRoute.routingInfo')} />
            <Row gutter={[16, 16]}>
              {recommendations.map((rec) => (
                <Col xs={24} md={12} xl={8} key={rec.doctorId}>
                  <Card
                    size="small"
                    title={
                      <Space>
                        <span style={{ fontWeight: 700 }}>{rec.name}</span>
                        <Tag color={rec.qualified ? 'blue' : 'default'}>{rec.subspecialty}</Tag>
                        {rec.qualified && <Tag color="green">{t('smartRoute.qualifiedTag')}</Tag>}
                      </Space>
                    }
                    extra={<span style={{ fontSize: 16, fontWeight: 800, color: rec.qualified ? 'var(--color-primary-600)' : '#94a3b8' }}>{t('smartRoute.scoreSuffix', { score: (rec.composite * 100).toFixed(0) })}</span>}
                    style={{ borderColor: rec.qualified ? '#93c5fd' : '#e2e8f0', height: '100%' }}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{t('smartRoute.matchScore')} <b style={{ color: 'var(--color-primary-800)' }}>{Math.round(rec.matchScore * 100)}%</b></div>
                      <Progress percent={Math.round(rec.matchScore * 100)} showInfo={false} size="small" strokeColor={rec.matchScore >= 1 ? 'var(--color-success-600)' : rec.matchScore >= 0.5 ? 'var(--color-warning-600)' : '#94a3b8'} />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{t('smartRoute.currentLoad')} <b style={{ color: 'var(--color-primary-800)' }}>{rec.currentLoad}/{rec.maxLoad}</b></div>
                      <Progress percent={Math.min(100, Math.round((rec.currentLoad / Math.max(1, rec.maxLoad)) * 100))} showInfo={false} size="small" strokeColor={rec.currentLoad < rec.maxLoad ? 'var(--color-primary-600)' : 'var(--color-error-600)'} />
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{t('smartRoute.accuracy')} <b style={{ color: 'var(--color-success-600)' }}>{t('smartRoute.accuracyScore', { score: Math.round(rec.accuracy * 100) })}</b></div>
                    <ul style={{ margin: '0 0 12px', paddingLeft: 16, fontSize: 12, color: '#64748b', lineHeight: 1.8 }}>
                      {rec.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                    <Button type="primary" block size="small" icon={<Zap size={13} />} disabled={!rec.qualified} loading={assigningId === rec.doctorId} onClick={() => handleAssign(rec.doctorId)}>{t('smartRoute.oneClickAssign')}</Button>
                  </Card>
                </Col>
              ))}
              {recommendations.length === 0 && !recommending && (
                <Col span={24}><div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>{t('smartRoute.emptyRecommend')}</div></Col>
              )}
            </Row>
          </Card>
        ) },
        { key: 'rules', label: <span><GitBranch size={14} /> {t('smartRoute.tabRules')}</span>, children: <Card><DataTable rowKey="id" dataSource={rules} columns={ruleColumns} pagination={false} loading={loading} scroll={{ x: 'max-content' }}/></Card> },
        { key: 'history', label: <span><History size={14} /> {t('smartRoute.tabHistory')}</span>, children: <Card><DataTable rowKey="id" dataSource={historyPagination.pageData} columns={historyColumns} pagination={historyPagination.pagination} loading={loading} scroll={{ x: 'max-content' }}/></Card> },
        { key: 'stats', label: <span><BarChart3 size={14} /> {t('smartRoute.tabStats')}</span>, children: <Card><StatCardGrid minWidth={200} gap={16}>{Object.entries(byDoctor).map(([k, v]) => <StatCard key={k} title={k} value={v} suffix={t('smartRoute.unitTimes')} loading={loading} />)}</StatCardGrid></Card> },
      ]} />
      <Modal title={t('smartRoute.editRuleTitle')} open={editOpen} onOk={handleSave} onCancel={() => setEditOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('smartRoute.colRuleName')}><Input /></Form.Item>
          <Form.Item name="modality" label={t('smartRoute.colModality')}><Select options={[{ value: 'CT', label: 'CT' }, { value: 'MR', label: 'MR' }, { value: 'DX', label: 'DX' }, { value: 'Any', label: t('smartRoute.any') }]} /></Form.Item>
          <Form.Item name="bodyPart" label={t('smartRoute.colBodyPart')}><Select options={[{ value: 'Chest', label: t('smartRoute.bodyPartChest') }, { value: 'Brain', label: t('smartRoute.bodyPartBrain') }, { value: 'Any', label: t('smartRoute.any') }]} /></Form.Item>
          <Form.Item name="patientStatus" label={t('smartRoute.colPatientStatus')}><Select options={[{ value: 'Inpatient', label: t('smartRoute.statusInpatient') }, { value: 'Outpatient', label: t('smartRoute.statusOutpatient') }, { value: 'Emergency', label: t('smartRoute.statusEmergency') }, { value: 'Any', label: t('smartRoute.any') }]} /></Form.Item>
          <Form.Item name="maxLoad" label={t('smartRoute.colMaxLoad')}><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="priority" label={t('smartRoute.colPriority')}><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SmartRoutePage
