/**
 * G005 v3.0.6.11-75 W3-1 - 远程阅片页
 * remoteReadingApi 会话列表 + 分配检查 + 状态流转 + loading/error
 */
import { examApi } from '../../services/api/examApi'
import { remoteReadingApi, type RemoteReadingSession, type RemoteReadingStats } from '../../services/api/remoteReadingApi'
import type { ExamDto } from '../../types/dto'
import {
  Card,
  Tag,
  Space,
  Typography,
  Button,
  Tabs,
  Select,
  Modal,
  Form,
  Input,
  Alert,
  Spin,
  Empty,
  Tooltip,
  message,
} from "antd";
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common"
import { Globe, Send, CheckCircle, Clock, UserPlus, PlayCircle, Undo2 } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { t } from '../../i18n/appI18n'

const { Text } = Typography

const STATUS_META: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: 'remoteReading.statusPending' },
  in_progress: { color: 'processing', label: 'remoteReading.statusInProgress' },
  completed: { color: 'success', label: 'remoteReading.statusCompleted' },
  returned: { color: 'error', label: 'remoteReading.statusReturned' },
}

const PRIORITY_META: Record<string, { color: string; label: string }> = {
  routine: { color: 'blue', label: 'remoteReading.priorityRoutine' },
  urgent: { color: 'orange', label: 'remoteReading.priorityUrgent' },
  stat: { color: 'red', label: 'remoteReading.priorityStat' },
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
        setError(listRes.error?.message ?? t('remoteReading.listLoadFailed'))
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
      setError(e instanceof Error ? e.message : t('remoteReading.dataLoadFailed'))
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
        message.success(t('w9e.remoteReading.assignedTask', { id: values.studyId }))
        setAssignOpen(false)
        assignForm.resetFields()
        setStatusFilter('all')
        await load()
      } else {
        message.error(res.error?.message ?? t('remoteReading.assignFailed'))
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('remoteReading.assignFailed'))
    } finally {
      setAssignLoading(false)
    }
  }

  const handleStart = async (row: RemoteReadingSession) => {
    const res = await remoteReadingApi.startReading(row.id)
    if (res.success) {
      message.success(t('w9e.remoteReading.startedReading', { id: row.studyId }))
      void load()
    } else {
      message.error(res.error?.message ?? t('remoteReading.operationFailed'))
    }
  }

  const handleComplete = async () => {
    if (!completeTarget) return
    const res = await remoteReadingApi.completeReading(completeTarget.id, reportText)
    if (res.success) {
      message.success(t('remoteReading.completedArchived'))
      setCompleteTarget(null)
      setReportText('')
      void load()
    } else {
      message.error(res.error?.message ?? t('remoteReading.submitFailed'))
    }
  }

  const handleReturn = async (row: RemoteReadingSession) => {
    let reason = ''
    Modal.confirm({
      title: t('remoteReading.returnTitle'),
      content: (
        <Input.TextArea
          rows={3}
          placeholder={t('remoteReading.returnPlaceholder')}
          onChange={(e) => { reason = e.target.value }}
        />
      ),
      okText: t('remoteReading.confirmReturn'),
      cancelText: t('remoteReading.cancel'),
      onOk: async () => {
        const res = await remoteReadingApi.returnReading(row.id, reason)
        if (res.success) {
          message.success(t('remoteReading.returned'))
          void load()
        } else {
          message.error(res.error?.message ?? t('remoteReading.returnFailed'))
        }
      },
    })
  }

  const columns = [
    { title: t('remoteReading.colStudyId'), dataIndex: 'studyId', key: 'studyId', width: 140, render: (v: string) => <Text code>{v}</Text> },
    { title: t('remoteReading.colPatient'), dataIndex: 'patientName', key: 'patientName', width: 100 },
    { title: t('remoteReading.colModality'), dataIndex: 'modality', key: 'modality', width: 70, render: (v: string) => <Tag>{v}</Tag> },
    { title: t('remoteReading.colReferring'), dataIndex: 'referringDoctor', key: 'referring', width: 100 },
    { title: t('remoteReading.colReading'), dataIndex: 'readingDoctor', key: 'reading', width: 100, render: (v: string, r: RemoteReadingSession) => v ? <Space direction="vertical" size={0}><span>{v}</span><Text type="secondary" style={{ fontSize: 11 }}>{r.readingDoctorDept}</Text></Space> : '-' },
    { title: t('remoteReading.colPriority'), dataIndex: 'priority', key: 'priority', width: 80, render: (v: string) => <Tag color={PRIORITY_META[v]?.color}>{t(PRIORITY_META[v]?.label ?? v)}</Tag> },
    { title: t('remoteReading.colStatus'), dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={STATUS_META[v]?.color}>{t(STATUS_META[v]?.label ?? v)}</Tag> },
    { title: t('remoteReading.colRequestedAt'), dataIndex: 'requestedAt', key: 'requestedAt', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: t('remoteReading.colCompletedAt'), dataIndex: 'completedAt', key: 'completedAt', width: 160, render: (v?: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    {
      title: t('remoteReading.colActions'), key: 'actions', width: 190,
      render: (_: unknown, r: RemoteReadingSession) => (
        <Space size={4}>
          {r.status === 'pending' && (
            <Button size="small" icon={<PlayCircle size={12} />} onClick={() => handleStart(r)}>{t('remoteReading.start')}</Button>
          )}
          {r.status === 'in_progress' && (
            <Button size="small" type="primary" icon={<CheckCircle size={12} />} onClick={() => setCompleteTarget(r)}>{t('remoteReading.complete')}</Button>
          )}
          {(r.status === 'pending' || r.status === 'in_progress') && (
            <Button size="small" danger icon={<Undo2 size={12} />} onClick={() => handleReturn(r)}>{t('remoteReading.returnBtn')}</Button>
          )}
          {r.status === 'returned' && r.comment && (
            <Tooltip title={r.comment}><Tag color="orange">{t('remoteReading.reason')}:{r.comment.slice(0, 10)}...</Tag></Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }} wrap>
        <Globe size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('remoteReading.title')}</span>
        <Tag color="cyan">v3.0.6.11-75</Tag>
        <Tag color="geekblue">{t('remoteReading.crossCampus')}</Tag>
        <Button type="primary" icon={<UserPlus size={14} />} onClick={openAssign} style={{ marginLeft: 'auto' }}>{t('remoteReading.assignExam')}</Button>
      </Space>

      {error && (
        <Alert type="error" showIcon message={t('remoteReading.loadFailed')} description={error} style={{ marginBottom: 'var(--space-4, 16px)' }}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('remoteReading.retry')}</Button>} />
      )}

      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('remoteReading.statTotal')} value={stats?.totalSessions ?? sessions.length} icon={<Globe size={16} />} loading={loading} />
        <StatCard title={t('remoteReading.statusPending')} value={stats?.pendingCount ?? 0} icon={<Clock size={16} />} loading={loading} />
        <StatCard title={t('remoteReading.statusCompleted')} value={stats?.completedCount ?? 0} icon={<CheckCircle size={16} />} color="success" loading={loading} />
        <StatCard title={t('remoteReading.statAvgDuration')} value={stats?.avgCompletionHours ?? 0} suffix="h" icon={<Send size={16} />} loading={loading} />
      </StatCardGrid>

      <Card
        size="small"
        title={
          <Tabs
            activeKey={statusFilter}
            onChange={(v) => { setStatusFilter(v); setSessionPage(1) }}
            items={[
              { key: 'all', label: t('remoteReading.tabAll') },
              { key: 'pending', label: t('remoteReading.statusPending') },
              { key: 'in_progress', label: t('remoteReading.statusInProgress') },
              { key: 'completed', label: t('remoteReading.statusCompleted') },
              { key: 'returned', label: t('remoteReading.statusReturned') },
            ]}
          />
        }
        extra={<Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()}>{t('remoteReading.refresh')}</Button>}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-12, 48px)' }}><Spin size="large" /></div>
        ) : sessions.length === 0 ? (
          <Empty image={<AlertTriangle size={48} style={{opacity:0.4}}/>} description={error ? t('remoteReading.loadFailed') : t('remoteReading.empty')} />
        ) : (
          <DataTable rowKey="id" dataSource={sessions} columns={columns} pagination={{ current: sessionPage, pageSize: 10, total: sessions.length, onChange: setSessionPage, showSizeChanger: false, showTotal: (total) => t('remoteReading.totalCount', { total }) }} scroll={{ x: 'max-content' }}/>
        )}
      </Card>

      <Modal title={t('remoteReading.assignTitle')} open={assignOpen} onCancel={() => setAssignOpen(false)} onOk={handleAssign}
        okText={t('remoteReading.assign')} confirmLoading={assignLoading} width={480}>
        <Form form={assignForm} layout="vertical" size="small" style={{ marginTop: 'var(--space-3, 12px)' }}>
          <Form.Item name="studyId" label={t('remoteReading.examPending')} rules={[{ required: true, message: t('remoteReading.selectExam') }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t('remoteReading.selectExamPlaceholder')}
              options={examOptions}
              loading={assignLoading}
              notFoundContent={assignLoading ? <Spin size="small" /> : t('remoteReading.noAssignableExam')}
            />
          </Form.Item>
          <Form.Item name="readingDoctorId" label={t('remoteReading.colReading')} rules={[{ required: true, message: t('remoteReading.selectReadingDoctor') }]}>
            <Select
              placeholder={t('remoteReading.selectReadingDoctor')}
              options={['王医生', '李医生', '张医生'].map((d) => ({ value: d, label: d }))}
            />
          </Form.Item>
          <Form.Item name="priority" label={t('remoteReading.colPriority')} initialValue="routine" rules={[{ required: true }]}>
            <Select options={[{ value: 'routine', label: t('remoteReading.priorityRoutine') }, { value: 'urgent', label: t('remoteReading.priorityUrgent') }, { value: 'stat', label: t('remoteReading.priorityStat') }]} />
          </Form.Item>
          <Form.Item name="comment" label={t('remoteReading.comment')}>
            <Input.TextArea rows={2} placeholder={t('remoteReading.commentPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`${t('remoteReading.completeTitle')} - ${completeTarget?.studyId ?? ''}`} open={!!completeTarget}
        onCancel={() => { setCompleteTarget(null); setReportText('') }}
        onOk={handleComplete} okText={t('remoteReading.submitReport')} width={560}>
        <div style={{ marginBottom: 'var(--space-2, 8px)' }}>
          <Text type="secondary">{t('remoteReading.colPatient')}: {completeTarget?.patientName} · {t('remoteReading.colModality')}: {completeTarget?.modality}</Text>
        </div>
        <Input.TextArea rows={6} placeholder={t('remoteReading.reportPlaceholder')} value={reportText} onChange={(e) => setReportText(e.target.value)} />
      </Modal>
    </PageContainer>
  )
}

export default RemoteReadingPage
