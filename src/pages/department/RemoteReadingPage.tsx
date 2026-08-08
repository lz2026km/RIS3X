/**
 * G005 v3.0.6.11-75 W3-1 - 远程阅片页
 * remoteReadingApi 会话列表 + 分配检查 + 状态流转 + loading/error
 */
import React, { useCallback, useEffect, useState } from 'react'
import {
  Card, Table, Tag, Space, Typography, Row, Col, Statistic, Button, Tabs, Select,
  Modal, Form, Input, Alert, Spin, Empty, Tooltip, message,
} from 'antd'
import { Globe, Send, CheckCircle, Clock, UserPlus, PlayCircle, Undo2 } from 'lucide-react'
import { remoteReadingApi, type RemoteReadingSession, type RemoteReadingStats } from '../../services/api/remoteReadingApi'
import { examApi } from '../../services/api/examApi'
import type { ExamDto } from '../../types/dto'

const { Text } = Typography

const STATUS_META: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待分配' },
  in_progress: { color: 'processing', label: '阅片中' },
  completed: { color: 'success', label: '已完成' },
  returned: { color: 'error', label: '已退回' },
}

const PRIORITY_META: Record<string, { color: string; label: string }> = {
  routine: { color: 'blue', label: '常规' },
  urgent: { color: 'orange', label: '紧急' },
  stat: { color: 'red', label: '加急' },
}

const RemoteReadingPage: React.FC = () => {
  const [sessions, setSessions] = useState<RemoteReadingSession[]>([])
  const [stats, setStats] = useState<RemoteReadingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignForm] = Form.useForm()
  const [examOptions, setExamOptions] = useState<Array<{ value: string; label: string; patient: string }>>([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [completeTarget, setCompleteTarget] = useState<RemoteReadingSession | null>(null)
  const [reportText, setReportText] = useState('')
  // [W2-C] 受控分页
  const [sessionPage, setSessionPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [listRes, statsRes] = await Promise.all([
        remoteReadingApi.listSessions(statusFilter === 'all' ? undefined : { status: statusFilter }),
        remoteReadingApi.getStats(),
      ])
      if (!listRes.success) {
        setError(listRes.error?.message ?? '会话列表加载失败')
        setSessions([])
      } else {
        setSessions(Array.isArray(listRes.data) ? listRes.data : [])
      }
      if (statsRes.success && statsRes.data) setStats(statsRes.data)
      else if (listRes.success) {
        const list = Array.isArray(listRes.data) ? listRes.data : []
        setStats({
          totalSessions: list.length,
          pendingCount: list.filter((s) => s.status === 'pending').length,
          completedCount: list.filter((s) => s.status === 'completed').length,
          avgCompletionHours: 0,
          priorityDistribution: [],
          doctorWorkload: [],
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '远程阅片数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { void load() }, [load])

  const loadExams = async () => {
    setAssignLoading(true)
    try {
      const res = await examApi.list({ pageSize: 50 })
      const list: ExamDto[] = Array.isArray(res.data) ? res.data : ((res.data as { items?: ExamDto[] }).items ?? [])
      setExamOptions(
        list
          .filter((e) => e.status === '已登记' || e.status === '已报到' || e.status === '待检查' || e.status === 'SCHEDULED' || e.status === 'ARRIVED' || e.status === 'IN_PROGRESS')
          .slice(0, 30)
          .map((e) => ({
            value: String(e.id),
            label: `${e.id} · ${e.patientName ?? ''} · ${e.modality ?? ''}`,
            patient: e.patientName ?? '',
          })),
      )
    } catch {
      setExamOptions([])
    } finally {
      setAssignLoading(false)
    }
  }

  const openAssign = () => {
    setAssignOpen(true)
    void loadExams()
  }

  const handleAssign = async () => {
    let values: { studyId: string; readingDoctorId: string; priority: 'routine' | 'urgent' | 'stat'; comment?: string }
    try {
      values = await assignForm.validateFields()
    } catch {
      return
    }
    setAssignLoading(true)
    try {
      const res = await remoteReadingApi.createSession(values)
      if (res.success) {
        message.success(`已分配远程阅片任务: ${values.studyId}`)
        setAssignOpen(false)
        assignForm.resetFields()
        setStatusFilter('all')
        await load()
      } else {
        message.error(res.error?.message ?? '分配失败')
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '分配失败')
    } finally {
      setAssignLoading(false)
    }
  }

  const handleStart = async (row: RemoteReadingSession) => {
    const res = await remoteReadingApi.startReading(row.id)
    if (res.success) {
      message.success(`已开始阅片: ${row.studyId}`)
      void load()
    } else {
      message.error(res.error?.message ?? '操作失败')
    }
  }

  const handleComplete = async () => {
    if (!completeTarget) return
    const res = await remoteReadingApi.completeReading(completeTarget.id, reportText)
    if (res.success) {
      message.success('阅片完成,报告已归档')
      setCompleteTarget(null)
      setReportText('')
      void load()
    } else {
      message.error(res.error?.message ?? '提交失败')
    }
  }

  const handleReturn = async (row: RemoteReadingSession) => {
    let reason = ''
    Modal.confirm({
      title: '退回远程阅片任务',
      content: (
        <Input.TextArea
          rows={3}
          placeholder="请输入退回原因(如图像不全、扫描序列缺失等)"
          onChange={(e) => { reason = e.target.value }}
        />
      ),
      okText: '确认退回',
      cancelText: '取消',
      onOk: async () => {
        const res = await remoteReadingApi.returnReading(row.id, reason)
        if (res.success) {
          message.success('任务已退回')
          void load()
        } else {
          message.error(res.error?.message ?? '退回失败')
        }
      },
    })
  }

  const columns = [
    { title: '检查号', dataIndex: 'studyId', key: 'studyId', width: 140, render: (v: string) => <Text code>{v}</Text> },
    { title: '患者', dataIndex: 'patientName', key: 'patientName', width: 100 },
    { title: '模态', dataIndex: 'modality', key: 'modality', width: 70, render: (v: string) => <Tag>{v}</Tag> },
    { title: '申请医生', dataIndex: 'referringDoctor', key: 'referring', width: 100 },
    { title: '阅片医生', dataIndex: 'readingDoctor', key: 'reading', width: 100, render: (v: string, r: RemoteReadingSession) => v ? <Space direction="vertical" size={0}><span>{v}</span><Text type="secondary" style={{ fontSize: 11 }}>{r.readingDoctorDept}</Text></Space> : '-' },
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80, render: (v: string) => <Tag color={PRIORITY_META[v]?.color}>{PRIORITY_META[v]?.label ?? v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag> },
    { title: '申请时间', dataIndex: 'requestedAt', key: 'requestedAt', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: '完成时间', dataIndex: 'completedAt', key: 'completedAt', width: 160, render: (v?: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    {
      title: '操作', key: 'actions', width: 190,
      render: (_: unknown, r: RemoteReadingSession) => (
        <Space size={4}>
          {r.status === 'pending' && (
            <Button size="small" icon={<PlayCircle size={12} />} onClick={() => handleStart(r)}>开始</Button>
          )}
          {r.status === 'in_progress' && (
            <Button size="small" type="primary" icon={<CheckCircle size={12} />} onClick={() => setCompleteTarget(r)}>完成</Button>
          )}
          {(r.status === 'pending' || r.status === 'in_progress') && (
            <Button size="small" danger icon={<Undo2 size={12} />} onClick={() => handleReturn(r)}>退回</Button>
          )}
          {r.status === 'returned' && r.comment && (
            <Tooltip title={r.comment}><Tag color="orange">原因:{r.comment.slice(0, 10)}...</Tag></Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Globe size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>远程阅片</span>
        <Tag color="cyan">v3.0.6.11-75</Tag>
        <Tag color="geekblue">跨院区协作</Tag>
        <Button type="primary" icon={<UserPlus size={14} />} onClick={openAssign} style={{ marginLeft: 'auto' }}>分配检查</Button>
      </Space>

      {error && (
        <Alert type="error" showIcon message="加载失败" description={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => void load()}>重试</Button>} />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="总会诊" value={stats?.totalSessions ?? sessions.length} prefix={<Globe size={16} />} loading={loading} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="待分配" value={stats?.pendingCount ?? 0} prefix={<Clock size={16} />} loading={loading} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已完成" value={stats?.completedCount ?? 0} prefix={<CheckCircle size={16} />} loading={loading} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="平均完成时长" value={stats?.avgCompletionHours ?? 0} suffix="h" prefix={<Send size={16} />} loading={loading} /></Card></Col>
      </Row>

      <Card
        size="small"
        title={
          <Tabs
            activeKey={statusFilter}
            onChange={(v) => { setStatusFilter(v); setSessionPage(1) }}
            items={[
              { key: 'all', label: '全部' },
              { key: 'pending', label: '待分配' },
              { key: 'in_progress', label: '阅片中' },
              { key: 'completed', label: '已完成' },
              { key: 'returned', label: '已退回' },
            ]}
          />
        }
        extra={<Button size="small" onClick={() => void load()}>刷新</Button>}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : sessions.length === 0 ? (
          <Empty description={error ? '加载失败' : '暂无远程阅片任务'} />
        ) : (
          <Table rowKey="id" dataSource={sessions} columns={columns} pagination={{ current: sessionPage, pageSize: 10, total: sessions.length, onChange: setSessionPage, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }} size="small" />
        )}
      </Card>

      <Modal title="分配远程阅片任务" open={assignOpen} onCancel={() => setAssignOpen(false)} onOk={handleAssign}
        okText="分配" confirmLoading={assignLoading} width={480}>
        <Form form={assignForm} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item name="studyId" label="检查(待分配)" rules={[{ required: true, message: '请选择检查' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择待阅片检查"
              options={examOptions}
              loading={assignLoading}
              notFoundContent={assignLoading ? <Spin size="small" /> : '无可分配检查(需为待检状态)'}
            />
          </Form.Item>
          <Form.Item name="readingDoctorId" label="阅片医生" rules={[{ required: true, message: '请选择阅片医生' }]}>
            <Select
              placeholder="选择阅片医生"
              options={['王医生', '李医生', '张医生'].map((d) => ({ value: d, label: d }))}
            />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="routine" rules={[{ required: true }]}>
            <Select options={[{ value: 'routine', label: '常规' }, { value: 'urgent', label: '紧急' }, { value: 'stat', label: '加急' }]} />
          </Form.Item>
          <Form.Item name="comment" label="备注">
            <Input.TextArea rows={2} placeholder="附加说明(选填)" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`完成阅片 - ${completeTarget?.studyId ?? ''}`} open={!!completeTarget}
        onCancel={() => { setCompleteTarget(null); setReportText('') }}
        onOk={handleComplete} okText="提交报告" width={560}>
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">患者: {completeTarget?.patientName} · 模态: {completeTarget?.modality}</Text>
        </div>
        <Input.TextArea rows={6} placeholder="输入阅片所见与诊断结论..." value={reportText} onChange={(e) => setReportText(e.target.value)} />
      </Modal>
    </div>
  )
}

export default RemoteReadingPage
