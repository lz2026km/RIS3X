import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Button,
  Tag,
  Space,
  Modal,
  Input,
  Row,
  Col,
  message,
  Alert,
  Select,
  Rate,
  Progress,
  Tooltip,
  Divider,
} from "antd";
import {
  Star, UserCheck, ClipboardCheck, RefreshCw, PlusCircle,
  FileText,
} from 'lucide-react'
import {
  reportPeerReviewApi,
  type PeerReviewTask,
  type PeerReviewStats,
  type PeerReviewDefectItem,
  type PeerScores,
} from '../../services/api/reportPeerReviewApi'
import { useAuth } from '../../hooks/useAuth'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'
import { AppText } from '../../components/common/AppText'
import { VirtualTable } from '../../components/common/VirtualTable'
import { t } from '../../i18n/appI18n'

const { TextArea } = Input

const statusMap: Record<string, { color: string; labelKey: string }> = {
  pending: { color: 'processing', labelKey: 'peerReview.stPending' },
  reviewed: { color: 'success', labelKey: 'peerReview.stReviewed' },
  overdue: { color: 'red', labelKey: 'peerReview.stOverdue' },
}

const dimensionMeta: Array<{ key: keyof PeerScores; labelKey: string }> = [
  { key: 'accuracy', labelKey: 'peerReview.dimAccuracy' },
  { key: 'completeness', labelKey: 'peerReview.dimCompleteness' },
  { key: 'normativity', labelKey: 'peerReview.dimNormativity' },
]

const DEPARTMENTS = ['放射科', '心内科', '神经外科', '胸外科', '呼吸内科', '骨科', '肿瘤科']

/** 解包后端 { success, data } 包装 (兼容裸数据) */
function unwrap<T>(res: { success: boolean; data?: unknown }): T | null {
  if (!res.success) return null
  const d = res.data as { data?: T } | T | null
  if (d && typeof d === 'object' && 'data' in d && (d as { data?: unknown }).data !== undefined) {
    return (d as { data: T }).data
  }
  return d as T
}

/** [Wave 7C F9] 报告互评面板: 任务分配 + 评分表单 + 统计 */
const PeerReviewPanel: React.FC = () => {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<PeerReviewTask[]>([])
  const [stats, setStats] = useState<PeerReviewStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignForm, setAssignForm] = useState({ reportId: '', patientName: '', modality: 'CT', department: '放射科', reviewerId: '' })
  const [scoreTarget, setScoreTarget] = useState<PeerReviewTask | null>(null)
  const [scores, setScores] = useState<PeerScores>({ accuracy: 4, completeness: 4, normativity: 4 })
  const [comment, setComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  // [G005 W4A] 任务关联缺陷
  const [defectTask, setDefectTask] = useState<PeerReviewTask | null>(null)
  const [defects, setDefects] = useState<PeerReviewDefectItem[]>([])
  const [defectLoading, setDefectLoading] = useState(false)
  const [defectCodes, setDefectCodes] = useState<string[]>([])
  const [defectSaving, setDefectSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [r, s] = await Promise.all([
        reportPeerReviewApi.listTasks(statusFilter),
        reportPeerReviewApi.getStats(),
      ])
      setTasks(unwrap<PeerReviewTask[]>(r) ?? [])
      setStats(unwrap<PeerReviewStats>(s) ?? null)
      if (!r.success) setError(r.error?.message ?? t('peerReview.loadFailed'))
    } catch (e) {
      setError((e as Error)?.message ?? t('peerReview.networkError'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { void loadData() }, [loadData])

  const handleAssign = async () => {
    if (!assignForm.reportId.trim()) { message.warning(t('peerReview.enterReportId')); return }
    setActionLoading(true)
    try {
      const res = await reportPeerReviewApi.assign({
        reportId: assignForm.reportId,
        patientName: assignForm.patientName || undefined,
        modality: assignForm.modality,
        department: assignForm.department,
        reviewerId: assignForm.reviewerId || undefined,
      })
      if (res.success && unwrap<PeerReviewTask>(res)) {
        const task = unwrap<PeerReviewTask>(res)!
        message.success(task.autoAssigned
          ? `${t('peerReview.autoAssigned')} → ${task.reviewerName}`
          : `${t('peerReview.assignedTo')} → ${task.reviewerName}`)
        setAssignOpen(false)
        setAssignForm({ reportId: '', patientName: '', modality: 'CT', department: '放射科', reviewerId: '' })
        void loadData()
      } else {
        message.error(res.error?.message ?? t('peerReview.assignFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('peerReview.assignFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  const openScore = (task: PeerReviewTask) => {
    setScoreTarget(task)
    setScores(task.scores ?? { accuracy: 4, completeness: 4, normativity: 4 })
    setComment(task.comment ?? '')
  }

  // [G005 W4A] 查看/添加关联缺陷
  const openDefects = async (task: PeerReviewTask) => {
    setDefectTask(task)
    setDefectCodes(task.defectCodes ?? [])
    setDefects([])
    setDefectLoading(true)
    try {
      const res = await reportPeerReviewApi.listTaskDefects(task.id)
      if (res.success && res.data) setDefects(res.data)
    } catch {
      message.error(t('w4a.peer.defectLoadFailed'))
    } finally {
      setDefectLoading(false)
    }
  }

  const handleAddDefects = async () => {
    if (!defectTask || defectCodes.length === 0) return
    setDefectSaving(true)
    try {
      const res = await reportPeerReviewApi.addTaskDefects(defectTask.id, defectCodes)
      if (res.success) {
        message.success(t('w4a.peer.defectAdded'))
        setDefectCodes([])
        const refreshed = await reportPeerReviewApi.listTaskDefects(defectTask.id).catch(() => null)
        if (refreshed?.success && refreshed.data) setDefects(refreshed.data)
        void loadData()
      } else {
        message.error(res.error?.message ?? t('w4a.peer.defectAddFailed'))
      }
    } catch {
      message.error(t('w4a.peer.defectAddFailed'))
    } finally {
      setDefectSaving(false)
    }
  }

  const handleScore = async () => {
    if (!scoreTarget) return
    setActionLoading(true)
    try {
      const res = await reportPeerReviewApi.score(scoreTarget.id, {
        scores,
        comment: comment || undefined,
        reviewerId: user?.id,
      })
      if (res.success && unwrap<PeerReviewTask>(res)) {
        message.success(t('peerReview.scoreSubmitted'))
        setScoreTarget(null)
        void loadData()
      } else {
        message.error(res.error?.message ?? t('peerReview.scoreFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('peerReview.scoreFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  const overallOf = (t: PeerReviewTask): number => {
    if (!t.scores) return 0
    return Math.round(((t.scores.accuracy + t.scores.completeness + t.scores.normativity) / 3) * 10) / 10
  }

  const columns = [
    { title: t('peerReview.colReportId'), dataIndex: 'reportId', key: 'reportId' },
    { title: t('peerReview.colPatient'), dataIndex: 'patientName', key: 'patientName' },
    { title: t('peerReview.colModality'), dataIndex: 'modality', key: 'modality', width: 70 },
    { title: t('peerReview.colDepartment'), dataIndex: 'department', key: 'department' },
    {
      title: t('peerReview.colReviewer'), dataIndex: 'reviewerName', key: 'reviewerName',
      render: (v: string, task: PeerReviewTask) => (
        <Space size={4}>
          <UserCheck size={13} color={task.autoAssigned ? 'var(--color-primary-600)' : 'var(--color-warning-500)'} />
          {v}
          {task.autoAssigned ? <Tag color="blue" style={{ marginInlineEnd: 0 }}>{t('peerReview.auto')}</Tag> : <Tag color="orange" style={{ marginInlineEnd: 0 }}>{t('peerReview.manual')}</Tag>}
        </Space>
      ),
    },
    {
      title: t('peerReview.colStatus'), dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={statusMap[s]?.color}>{statusMap[s] ? t(statusMap[s]!.labelKey) : s}</Tag>,
    },
    {
      title: t('peerReview.colScore'), dataIndex: 'scores', key: 'scores',
      render: (_: unknown, task: PeerReviewTask) => task.scores ? (
        <Tooltip title={`${t('peerReview.dimAccuracy')} ${task.scores.accuracy} / ${t('peerReview.dimCompleteness')} ${task.scores.completeness} / ${t('peerReview.dimNormativity')} ${task.scores.normativity}`}>
          <Space size={6}>
            <Star size={13} color="var(--color-warning-500)" fill="var(--color-warning-500)" />
            <AppText weight={600}>{overallOf(task)}</AppText>
            <Rate disabled value={Math.round(overallOf(task))} count={5} style={{ fontSize: 11 }} />
          </Space>
        </Tooltip>
      ) : <AppText color="secondary">-</AppText>,
    },
    {
      title: t('peerReview.colDueAt'), dataIndex: 'dueAt', key: 'dueAt',
      render: (v: string) => v.slice(0, 10),
    },
    {
      title: t('peerReview.colActions'), key: 'action',
      render: (_: unknown, task: PeerReviewTask) => (
        <Space>
          {task.status !== 'reviewed'
            ? <Button size="small" type="primary" icon={<ClipboardCheck size={13} />} onClick={() => openScore(task)}>{t('peerReview.score')}</Button>
            : <Button size="small" onClick={() => openScore(task)}>{t('peerReview.viewEdit')}</Button>}
          <Button size="small" icon={<FileText size={13} />} onClick={() => void openDefects(task)}>{t('w4a.peer.defects')}</Button>
        </Space>
      ),
    },
  ]

  const distSum = stats?.scoreDistribution.reduce((a, s) => a + s.count, 0) ?? 0

  return (
    <div>
      <Card
        title={<Space><Star size={16} color="var(--color-primary-600)" /><span>{t('peerReview.title')}</span><Tag color="blue">{t('peerReview.tag')}</Tag></Space>}
        extra={<Button type="primary" icon={<PlusCircle size={14} />} onClick={() => setAssignOpen(true)}>{t('peerReview.assignTask')}</Button>}
      >
        {error && !loading && <Alert type="error" showIcon message={error} style={{ marginBottom: 'var(--space-3, 12px)' }} />}
        <StatCardGrid minWidth={170} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
          <StatCard title={t('peerReview.statTotal')} value={stats?.total ?? 0} icon={<FileText size={16} />} color="primary" />
          <StatCard title={t('peerReview.stPending')} value={stats?.pendingCount ?? 0} color="info" />
          <StatCard title={t('peerReview.stReviewed')} value={stats?.reviewedCount ?? 0} color="success" />
          <StatCard title={t('peerReview.stOverdue')} value={stats?.overdueCount ?? 0} color="error" />
          <StatCard title={t('peerReview.statCompletionRate')} value={stats?.completionRate ?? 0} suffix="%" color="primary" />
          <StatCard title={t('peerReview.statAvgScore')} value={stats?.avgScores.overall ?? 0} suffix="/ 5" color="warning" />
        </StatCardGrid>
        <Row gutter={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
          {dimensionMeta.map(dm => (
            <Col span={4} key={dm.key}>
              <Card size="small" title={`${t(dm.labelKey)}${t('peerReview.avgSuffix')}`}>
                <Space>
                  <Rate disabled value={Math.round(stats?.avgScores[dm.key] ?? 0)} count={5} style={{ fontSize: 12 }} />
                  <AppText weight={600}>{(stats?.avgScores[dm.key] ?? 0).toFixed(1)}</AppText>
                </Space>
              </Card>
            </Col>
          ))}
          <Col span={12}>
            <Card size="small" title={t('peerReview.distribution')}>
              <Space size={4} split={<Divider type="vertical" style={{ margin: 0 }} />}>
                {(stats?.scoreDistribution ?? []).map(d => (
                  <Tooltip key={d.score} title={`${d.score} ${t('peerReview.points')}: ${d.count} ${t('peerReview.copies')}`}>
                    <Space direction="vertical" size={0} align="center">
                      <AppText weight={600}>{d.count}</AppText>
                      <Progress percent={distSum > 0 ? Math.round((d.count / distSum) * 100) : 0} showInfo={false} size="small" strokeColor="var(--color-warning-500)" style={{ width: 42 }} />
                      <AppText color="secondary" size="xs">{d.score} {t('peerReview.points')}</AppText>
                    </Space>
                  </Tooltip>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>
        <Space style={{ marginBottom: 'var(--space-3, 12px)' }}>
          <AppText>{t('peerReview.statusLabel')}: </AppText>
          <Select allowClear placeholder={t('peerReview.all')} style={{ width: 120 }} value={statusFilter}
            onChange={v => setStatusFilter(v)}
            options={[
              { value: 'pending', label: t('peerReview.stPending') },
              { value: 'reviewed', label: t('peerReview.stReviewed') },
              { value: 'overdue', label: t('peerReview.stOverdue') },
            ]} />
          <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadData()} loading={loading}>{t('peerReview.refresh')}</Button>
        </Space>
        <VirtualTable<PeerReviewTask>
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          height={440}
          pageSize={8}
          width={980}
          loading={loading}
        />
      </Card>

      {/* 分配任务 */}
      <Modal title={t('peerReview.assignTask')} open={assignOpen} onOk={() => void handleAssign()} onCancel={() => setAssignOpen(false)} confirmLoading={actionLoading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder={t('peerReview.reportIdRequired')} value={assignForm.reportId} onChange={e => setAssignForm(p => ({ ...p, reportId: e.target.value }))} />
          <Space style={{ width: '100%' }}>
            <Input placeholder={t('peerReview.patientName')} value={assignForm.patientName} onChange={e => setAssignForm(p => ({ ...p, patientName: e.target.value }))} style={{ flex: 2 }} />
            <Select value={assignForm.modality} onChange={v => setAssignForm(p => ({ ...p, modality: v }))} style={{ width: 90 }}
              options={['CT', 'MR', 'DR', 'MG', 'US'].map(m => ({ value: m, label: m }))} />
          </Space>
          <Select value={assignForm.department} onChange={v => setAssignForm(p => ({ ...p, department: v }))}
            options={DEPARTMENTS.map(d => ({ value: d, label: d }))} />
          <Input placeholder={t('peerReview.reviewerIdPlaceholder')} value={assignForm.reviewerId}
            onChange={e => setAssignForm(p => ({ ...p, reviewerId: e.target.value }))} />
          <Alert type="info" showIcon message={t('peerReview.assignAlert')} />
        </Space>
      </Modal>

      {/* 评分表单 */}
      <Modal
        title={`${t('peerReview.title')} - ${scoreTarget?.reportId ?? ''} (${t('peerReview.colReviewer')}: ${scoreTarget?.reviewerName ?? ''})`}
        open={!!scoreTarget}
        onOk={() => void handleScore()}
        onCancel={() => setScoreTarget(null)}
        confirmLoading={actionLoading}
      >
        {scoreTarget && (
          <Space direction="vertical" style={{ width: '100%' }}>
            {dimensionMeta.map(dm => (
              <div key={dm.key}>
                <AppText weight={600}>{t(dm.labelKey)}</AppText>
                <Rate value={scores[dm.key]} count={5}
                  onChange={v => setScores(p => ({ ...p, [dm.key]: v }))}
                  style={{ marginLeft: 'var(--space-3, 12px)' }} />
                <AppText color="secondary" style={{ marginLeft: 'var(--space-2, 8px)' }}>{scores[dm.key]} / 5</AppText>
              </div>
            ))}
            <TextArea rows={4} placeholder={t('peerReview.commentPlaceholder')} value={comment} onChange={e => setComment(e.target.value)} />
            <Alert type="warning" showIcon message={t('peerReview.scoreAlert')} />
          </Space>
        )}
      </Modal>

      {/* [G005 W4A] 关联缺陷 */}
      <Modal
        title={`${t('w4a.peer.defectsTitle')} - ${defectTask?.reportId ?? ''}`}
        open={!!defectTask}
        onCancel={() => setDefectTask(null)}
        footer={<Button onClick={() => setDefectTask(null)}>{t('w4a.peer.close')}</Button>}
        width={720}
      >
        {defectTask && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space style={{ width: '100%' }}>
              <Select
                mode="tags"
                style={{ flex: 1 }}
                placeholder={t('w4a.peer.defectCodesPlaceholder')}
                value={defectCodes}
                onChange={(v) => setDefectCodes(v)}
                tokenSeparators={[',', ' ', '，']}
                notFoundContent={null}
              />
              <Button type="primary" loading={defectSaving} onClick={() => void handleAddDefects()}>{t('w4a.peer.addDefect')}</Button>
            </Space>
            <DataTable<PeerReviewDefectItem>
              rowKey="id"
              loading={defectLoading}
              dataSource={defects}
              pagination={false}
              locale={{ emptyText: t('w4a.peer.defectEmpty') }}
              columns={[
                { title: t('w4a.peer.defectCode'), dataIndex: 'code', key: 'code', width: 100, render: (v: string) => <Tag>{v}</Tag> },
                { title: t('w4a.peer.defectName'), dataIndex: 'name', key: 'name' },
                { title: t('w4a.peer.defectSeverity'), dataIndex: 'severity', key: 'severity', width: 90, render: (v: string) => <Tag color={v === 'critical' ? 'red' : v === 'high' ? 'orange' : v === 'medium' ? 'blue' : 'default'}>{v}</Tag> },
              ]}
            />
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default PeerReviewPanel

import { DataTable } from "../../components/common";