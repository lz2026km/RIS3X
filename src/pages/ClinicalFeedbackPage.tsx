/**
 * G005 放射RIS系统 v3.0.6.11-104 Wave 3C - 临床反馈闭环页面
 * 覆盖后端 clinical-feedback.controller 全部端点:
 *   POST /clinical-feedback                     临床医生提交报告异议/补充/更正
 *   GET  /clinical-feedback                     列表 (状态/报告/科室/类型筛选 + 分页)
 *   GET  /clinical-feedback/:id                 详情
 *   POST /clinical-feedback/:id/respond         放射科回应 (SUBMITTED → RESPONDED)
 *   POST /clinical-feedback/:id/resolve         关闭 (RESPONDED → RESOLVED, 可关联 amendId)
 *   POST /clinical-feedback/:id/reject          驳回 (SUBMITTED/RESPONDED → REJECTED)
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { t as appT } from '../i18n/appI18n'
import {
  Card, Table, Space, Tag, Button, Modal, Form, Input, Select, message, Badge,
  Descriptions, Alert, Row, Col, Statistic, Empty,
} from 'antd'
import { MessageSquare, Plus, RefreshCw, Send, CheckCircle2, XCircle, Eye } from 'lucide-react'
import {
  clinicalFeedbackApi,
  type ClinicalFeedback,
  type FeedbackType,
  type FeedbackStatus,
  type FeedbackListFilter,
} from '../services/api/clinicalFeedbackApi'

const TYPE_OPTIONS: FeedbackType[] = ['objection', 'supplement', 'correction']
const STATUS_OPTIONS: FeedbackStatus[] = ['SUBMITTED', 'RESPONDED', 'RESOLVED', 'REJECTED']

const STATUS_BADGE: Record<FeedbackStatus, 'processing' | 'warning' | 'success' | 'error'> = {
  SUBMITTED: 'processing',
  RESPONDED: 'warning',
  RESOLVED: 'success',
  REJECTED: 'error',
}

type ActionMode = 'respond' | 'resolve' | 'reject'

export default function ClinicalFeedbackPage() {
  const { t } = useTranslation('v3consentFeedback')
  const [items, setItems] = useState<ClinicalFeedback[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<FeedbackListFilter>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [actionTarget, setActionTarget] = useState<{ mode: ActionMode; record: ClinicalFeedback } | null>(null)
  const [detail, setDetail] = useState<ClinicalFeedback | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createForm] = Form.useForm()
  const [actionForm] = Form.useForm()

  const statusText: Record<FeedbackStatus, string> = {
    SUBMITTED: t('feedback.statusSubmitted', '已提交'),
    RESPONDED: t('feedback.statusResponded', '已回应'),
    RESOLVED: t('feedback.statusResolved', '已关闭'),
    REJECTED: t('feedback.statusRejected', '已驳回'),
  }
  const typeText: Record<FeedbackType, string> = {
    objection: t('feedback.typeObjection', '异议'),
    supplement: t('feedback.typeSupplement', '补充'),
    correction: t('feedback.typeCorrection', '更正'),
  }

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await clinicalFeedbackApi.list({ ...filters, page, pageSize })
      if (res.success && res.data) {
        setItems(res.data.items ?? [])
        setTotal(res.data.total ?? 0)
      } else {
        setError(res.error?.message ?? t('feedback.failed', '操作失败'))
      }
    } catch {
      setError(t('feedback.failed', '操作失败'))
    }
    setLoading(false)
  }, [filters, page, pageSize, t])

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  const handleCreate = async () => {
    const values = await createForm.validateFields()
    setSubmitting(true)
    try {
      const res = await clinicalFeedbackApi.create({
        reportId: values.reportId,
        patientId: values.patientId || undefined,
        patientName: values.patientName || undefined,
        examId: values.examId || undefined,
        type: values.type,
        content: values.content,
        submittedBy: values.submittedBy,
        department: values.department,
      })
      if (res.success) {
        message.success(t('feedback.submitSuccess', '反馈已提交'))
        setCreateOpen(false)
        createForm.resetFields()
        setPage(1)
        void fetchList()
      } else {
        message.error(res.error?.message ?? t('feedback.failed', '操作失败'))
      }
    } catch (e) {
      message.error((e as Error)?.message || t('feedback.failed', '操作失败'))
    }
    setSubmitting(false)
  }

  const openAction = (mode: ActionMode, record: ClinicalFeedback) => {
    setActionTarget({ mode, record })
    actionForm.setFieldsValue({
      content: '',
      responder: '当前用户',
      department: '放射科',
      resolver: '当前用户',
      reason: '',
      amendId: '',
    })
  }

  const handleAction = async () => {
    if (!actionTarget) return
    const { mode, record } = actionTarget
    const values = await actionForm.validateFields()
    setSubmitting(true)
    try {
      const res = mode === 'respond'
        ? await clinicalFeedbackApi.respond(record.id, { content: values.content, responder: values.responder, department: values.department || undefined })
        : mode === 'resolve'
          ? await clinicalFeedbackApi.resolve(record.id, { content: values.content || undefined, resolver: values.resolver, amendId: values.amendId || undefined })
          : await clinicalFeedbackApi.reject(record.id, { reason: values.reason, resolver: values.resolver })
      if (res.success) {
        message.success(
          mode === 'respond'
            ? t('feedback.respondSuccess', '回应已发送')
            : mode === 'resolve'
              ? t('feedback.resolveSuccess', '反馈已关闭')
              : t('feedback.rejectSuccess', '反馈已驳回'),
        )
        setActionTarget(null)
        actionForm.resetFields()
        void fetchList()
      } else {
        message.error(res.error?.message ?? t('feedback.failed', '操作失败'))
      }
    } catch (e) {
      message.error((e as Error)?.message || t('feedback.failed', '操作失败'))
    }
    setSubmitting(false)
  }

  const stats = {
    submitted: items.filter((f) => f.status === 'SUBMITTED').length,
    responded: items.filter((f) => f.status === 'RESPONDED').length,
    resolved: items.filter((f) => f.status === 'RESOLVED').length,
    rejected: items.filter((f) => f.status === 'REJECTED').length,
  }

  return (
    <div style={{ padding: 24 }}>
      <Alert
        type="info"
        showIcon
        banner
        message={t('feedback.title', '临床反馈闭环')}
        description={t('feedback.subtitle', '临床医生对报告提异议/补充/更正 → 放射科回应 → 关闭')}
        style={{ marginBottom: 16 }}
      />
      <Space style={{ marginBottom: 16 }}>
        <MessageSquare size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('feedback.title', '临床反馈闭环')}</span>
        <Tag color="geekblue">v3.0.6.11-104</Tag>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title={statusText.SUBMITTED} value={stats.submitted} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={statusText.RESPONDED} value={stats.responded} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={statusText.RESOLVED} value={stats.resolved} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={statusText.REJECTED} value={stats.rejected} styles={{ content: { color: '#ff4d4f' } }} /></Card></Col>
      </Row>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void fetchList()}>{t('feedback.refresh', '刷新')}</Button>} />}

      <Card
        size="small"
        title={<Space><MessageSquare size={14} />{t('feedback.title', '临床反馈闭环')}</Space>}
        extra={<Space>
          <Select
            size="small"
            allowClear
            placeholder={t('feedback.filterStatus', '状态')}
            style={{ width: 130 }}
            onChange={(v: string | undefined) => { setFilters((p) => ({ ...p, status: v })); setPage(1) }}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: statusText[s] }))}
          />
          <Input
            size="small"
            allowClear
            placeholder={t('feedback.filterDepartment', '科室')}
            style={{ width: 140 }}
            onChange={(e) => { setFilters((p) => ({ ...p, department: e.target.value || undefined })); setPage(1) }}
          />
          <Input
            size="small"
            allowClear
            placeholder={t('feedback.filterReportId', '报告ID')}
            style={{ width: 160 }}
            onChange={(e) => { setFilters((p) => ({ ...p, reportId: e.target.value || undefined })); setPage(1) }}
          />
          <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void fetchList()}>{t('feedback.refresh', '刷新')}</Button>
          <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setCreateOpen(true)}>{t('feedback.submit', '提交反馈')}</Button>
        </Space>}
      >
        <Table<ClinicalFeedback>
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={items}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('feedback.empty', '暂无临床反馈')} /> }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (n) => `${t('feedback.total', '共')} ${n} ${t('feedback.items', '条')}`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 150, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
            { title: t('feedback.reportId', '报告ID'), dataIndex: 'reportId', width: 150 },
            {
              title: t('feedback.patientName', '患者姓名'),
              width: 130,
              render: (_, r) => <Space direction="vertical" size={0}><b>{r.patientName ?? '-'}</b><span style={{ fontSize: 11, color: '#999' }}>{r.patientId ?? '-'}</span></Space>,
            },
            { title: t('feedback.type', '反馈类型'), dataIndex: 'type', width: 100, render: (v: FeedbackType) => <Tag color={v === 'objection' ? 'volcano' : v === 'supplement' ? 'blue' : 'purple'}>{typeText[v] ?? v}</Tag> },
            { title: t('feedback.content', '反馈内容'), dataIndex: 'content', ellipsis: true, render: (v: string) => <span title={v}>{v}</span> },
            { title: t('feedback.submittedBy', '提交人'), dataIndex: 'submittedBy', width: 110 },
            { title: t('feedback.department', '科室'), dataIndex: 'department', width: 110 },
            { title: t('feedback.status', '状态'), dataIndex: 'status', width: 100, render: (v: FeedbackStatus) => <Badge status={STATUS_BADGE[v] ?? 'default'} text={statusText[v] ?? v} /> },
            { title: t('feedback.createdAt', '提交时间'), dataIndex: 'createdAt', width: 160, render: (v: string) => (v ? new Date(v).toLocaleString('zh-CN') : '-') },
            {
              title: t('feedback.actions', '操作'),
              width: 210,
              render: (_, r) => (
                <Space size={4}>
                  <Button size="small" type="link" icon={<Eye size={12} />} onClick={() => setDetail(r)}>{t('feedback.detail', '详情')}</Button>
                  {r.status === 'SUBMITTED' && (
                    <Button size="small" type="primary" ghost icon={<Send size={12} />} onClick={() => openAction('respond', r)}>{t('feedback.respond', '回应')}</Button>
                  )}
                  {r.status === 'RESPONDED' && (
                    <Button size="small" type="primary" ghost icon={<CheckCircle2 size={12} />} onClick={() => openAction('resolve', r)}>{t('feedback.resolve', '关闭')}</Button>
                  )}
                  {(r.status === 'SUBMITTED' || r.status === 'RESPONDED') && (
                    <Button size="small" danger icon={<XCircle size={12} />} onClick={() => openAction('reject', r)}>{t('feedback.reject', '驳回')}</Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* 提交反馈 */}
      <Modal
        title={t('feedback.newFeedback', '提交临床反馈')}
        open={createOpen}
        onOk={() => void handleCreate()}
        onCancel={() => setCreateOpen(false)}
        okText={t('feedback.submit', '提交反馈')}
        confirmLoading={submitting}
        width={640}
      >
        <Form form={createForm} layout="vertical" initialValues={{ type: 'objection', department: '临床科室', submittedBy: '当前用户' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="reportId" label={t('feedback.reportId', '报告ID')} rules={[{ required: true, message: t('feedback.reportRequired', '请填写报告ID') }]}>
                <Input placeholder={appT('feedback.ph.reportId')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="examId" label={t('feedback.examId', '检查号')}>
                <Input placeholder={appT('feedback.ph.examId')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="patientId" label={t('feedback.patientId', '患者ID')}>
                <Input placeholder={appT('feedback.ph.patientId')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="patientName" label={t('feedback.patientName', '患者姓名')}>
                <Input placeholder={appT('feedback.ph.patientName')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label={t('feedback.type', '反馈类型')} rules={[{ required: true }]}>
                <Select options={TYPE_OPTIONS.map((v) => ({ value: v, label: typeText[v] }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="submittedBy" label={t('feedback.submittedBy', '提交人')} rules={[{ required: true, message: t('feedback.submittedByRequired', '请填写提交人') }]}>
                <Input placeholder={appT('feedback.ph.submittedBy')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department" label={t('feedback.department', '科室')} rules={[{ required: true, message: t('feedback.departmentRequired', '请填写科室') }]}>
                <Input placeholder={appT('feedback.ph.department')} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="content" label={t('feedback.content', '反馈内容')} rules={[{ required: true, message: t('feedback.contentRequired', '请填写反馈内容') }]}>
            <Input.TextArea rows={4} placeholder={appT('feedback.ph.content')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 回应 / 关闭 / 驳回 */}
      <Modal
        title={actionTarget ? `${actionTarget.mode === 'respond' ? t('feedback.respond', '回应') : actionTarget.mode === 'resolve' ? t('feedback.resolve', '关闭反馈') : t('feedback.reject', '驳回')} - ${actionTarget.record.id}` : ''}
        open={!!actionTarget}
        onOk={() => void handleAction()}
        onCancel={() => setActionTarget(null)}
        okText={t('feedback.confirm', '确定')}
        okButtonProps={{ danger: actionTarget?.mode === 'reject' }}
        confirmLoading={submitting}
        width={560}
      >
        <Form form={actionForm} layout="vertical">
          {actionTarget?.mode === 'respond' && (
            <>
              <Form.Item name="content" label={t('feedback.response', '放射科回应')} rules={[{ required: true, message: t('feedback.contentRequired', '请填写反馈内容') }]}>
                <Input.TextArea rows={3} placeholder={appT('feedback.ph.responseContent')} />
              </Form.Item>
              <Form.Item name="responder" label={t('feedback.responder', '处理人')} rules={[{ required: true, message: t('feedback.responderRequired', '请填写处理人') }]}>
                <Input placeholder={appT('feedback.ph.responder')} />
              </Form.Item>
              <Form.Item name="department" label={t('feedback.department', '科室')}>
                <Input placeholder={appT('feedback.ph.radiology')} />
              </Form.Item>
            </>
          )}
          {actionTarget?.mode === 'resolve' && (
            <>
              <Form.Item name="content" label={t('feedback.resolveContent', '关闭说明')}>
                <Input.TextArea rows={3} placeholder={appT('feedback.ph.resolveContent')} />
              </Form.Item>
              <Form.Item name="amendId" label={t('feedback.amendId', '报告修订ID (amendId, 可选)')}>
                <Input placeholder={appT('feedback.ph.amendId')} />
              </Form.Item>
              <Form.Item name="resolver" label={t('feedback.resolver', '处理人')} rules={[{ required: true, message: t('feedback.responderRequired', '请填写处理人') }]}>
                <Input placeholder={appT('feedback.ph.responder')} />
              </Form.Item>
            </>
          )}
          {actionTarget?.mode === 'reject' && (
            <>
              <Form.Item name="reason" label={t('feedback.rejectReason', '驳回原因')} rules={[{ required: true, message: t('feedback.contentRequired', '请填写反馈内容') }]}>
                <Input.TextArea rows={3} placeholder={appT('feedback.ph.rejectReason')} />
              </Form.Item>
              <Form.Item name="resolver" label={t('feedback.resolver', '处理人')} rules={[{ required: true, message: t('feedback.responderRequired', '请填写处理人') }]}>
                <Input placeholder={appT('feedback.ph.responder')} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* 详情 */}
      <Modal
        title={`${t('feedback.detail', '反馈详情')} - ${detail?.id ?? ''}`}
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={<Button type="primary" onClick={() => setDetail(null)}>{t('feedback.confirm', '确定')}</Button>}
        width={620}
      >
        {detail && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label={t('feedback.reportId', '报告ID')}>{detail.reportId}</Descriptions.Item>
              <Descriptions.Item label={t('feedback.examId', '检查号')}>{detail.examId ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('feedback.patientName', '患者姓名')}>{detail.patientName ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('feedback.patientId', '患者ID')}>{detail.patientId ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('feedback.type', '反馈类型')}><Tag>{typeText[detail.type] ?? detail.type}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('feedback.status', '状态')}><Badge status={STATUS_BADGE[detail.status] ?? 'default'} text={statusText[detail.status] ?? detail.status} /></Descriptions.Item>
              <Descriptions.Item label={t('feedback.submittedBy', '提交人')}>{detail.submittedBy}</Descriptions.Item>
              <Descriptions.Item label={t('feedback.department', '科室')}>{detail.department}</Descriptions.Item>
              <Descriptions.Item label={t('feedback.content', '反馈内容')} span={2}>{detail.content}</Descriptions.Item>
              <Descriptions.Item label={t('feedback.createdAt', '提交时间')} span={2}>{new Date(detail.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
            </Descriptions>
            {detail.response && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={`${t('feedback.response', '放射科回应')} - ${detail.response.responder}`}
                description={<Space direction="vertical" size={2}><span>{detail.response.content}</span><span style={{ fontSize: 11, color: '#999' }}>{new Date(detail.response.respondedAt).toLocaleString('zh-CN')}</span></Space>}
              />
            )}
            {detail.resolution && (
              <Alert
                type={detail.status === 'REJECTED' ? 'error' : 'success'}
                showIcon
                message={`${detail.status === 'REJECTED' ? t('feedback.reject', '驳回') : t('feedback.resolve', '关闭')} - ${detail.resolution.resolver}`}
                description={<Space direction="vertical" size={2}>
                  {detail.resolution.content && <span>{detail.resolution.content}</span>}
                  {detail.resolution.amendId && <span>{t('feedback.amendId', '报告修订ID')}: {detail.resolution.amendId}</span>}
                  <span style={{ fontSize: 11, color: '#999' }}>{new Date(detail.resolution.resolvedAt).toLocaleString('zh-CN')}</span>
                </Space>}
              />
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
