/**
 * [W-D7] 报告 QC 任务看板 (report-qc-v2)
 *
 * 数据源: reportQcV2Api →
 *   GET  /report-qc-v2/tasks?status=   任务列表 (状态过滤)
 *   POST /report-qc-v2/tasks           创建质控任务
 *   POST /report-qc-v2/tasks/:id/assign         分配质控员
 *   POST /report-qc-v2/tasks/:id/review         一级复核 (通过/退回)
 *   POST /report-qc-v2/tasks/:id/second-review  二次复核 (双人复核)
 *   POST /report-qc-v2/tasks/:id/close          关闭任务
 *   GET  /report-qc-v2/scores          评分记录
 *   GET  /report-qc-v2/dimensions      评分维度配置
 *   GET  /report-qc-v2/stats           质控统计
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Input, Modal, Select, Space, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Gauge,
  ListChecks,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react'
import { DataTable, StatCard, StatCardGrid, StateView } from '../../components/common'
import {
  reportQcV2Api,
  type QcDimensionMeta,
  type QcGrade,
  type QcScoreResult,
  type QcStatsData,
  type QcTask,
  type QcTaskStatus,
  type ReviewOpinion,
} from '../../services/api/reportQcV2Api'
import { useAuth } from '../../hooks/useAuth'
import { t } from '../../i18n/appI18n'
import { severityToAntd, toneToAntd } from '../../theme/statusTokens'

const QC_TASK_STATUS_META: Record<QcTaskStatus, { labelKey: string; color: string }> = {
  pending: { labelKey: 'w4a.qcTask.status.pending', color: toneToAntd('pending') },
  in_progress: { labelKey: 'w4a.qcTask.status.inProgress', color: toneToAntd('in_progress') },
  reviewing: { labelKey: 'w4a.qcTask.status.reviewing', color: toneToAntd('in_progress') },
  closed: { labelKey: 'w4a.qcTask.status.closed', color: toneToAntd('closed') },
}

const GRADE_COLORS: Record<QcGrade, string> = {
  A: severityToAntd('success'),
  B: severityToAntd('info'),
  C: severityToAntd('warning'),
  D: severityToAntd('critical'),
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: t('reportQcV2.status') },
  { value: 'pending', label: t('w4a.qcTask.status.pending') },
  { value: 'in_progress', label: t('w4a.qcTask.status.inProgress') },
  { value: 'reviewing', label: t('w4a.qcTask.status.reviewing') },
  { value: 'closed', label: t('w4a.qcTask.status.closed') },
]

const MODALITY_OPTIONS = ['CT', 'MR', 'DR', 'MG', 'US', 'DSA', 'PET'].map((v) => ({ value: v, label: v }))

const OPINION_OPTIONS = [
  { value: 'pass', label: t('reportQcV2.pass') },
  { value: 'return', label: t('reportQcV2.return') },
]

function fmtDate(s?: string): string {
  return s ? s.slice(0, 10) : '-'
}

function lastReviewer(task: QcTask, round: 1 | 2): string {
  const list = (task.reviews ?? []).filter((r) => r.round === round)
  return list[list.length - 1]?.reviewer ?? '-'
}

type QcActionType = 'assign' | 'review' | 'second' | 'close'

const ReportQcTaskBoardPanel: React.FC = () => {
  const { user } = useAuth()
  const defaultReviewer = user?.name ?? user?.username ?? ''

  const [tasks, setTasks] = useState<QcTask[]>([])
  const [scores, setScores] = useState<QcScoreResult[]>([])
  const [dimensions, setDimensions] = useState<QcDimensionMeta[]>([])
  const [stats, setStats] = useState<QcStatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // 创建任务
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<{ reportId: string; patientName: string; modality: string; assignee: string }>({
    reportId: '',
    patientName: '',
    modality: 'CT',
    assignee: '',
  })

  // 任务动作 (分配 / 一级复核 / 二次复核 / 关闭)
  const [action, setAction] = useState<{ type: QcActionType; task: QcTask } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [assignee, setAssignee] = useState('')
  const [assigneeName, setAssigneeName] = useState('')
  const [reviewer, setReviewer] = useState('')
  const [opinion, setOpinion] = useState<ReviewOpinion>('pass')
  const [comment, setComment] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const status = statusFilter === 'all' ? undefined : statusFilter
      const [taskRes, scoreRes, dimRes, statRes] = await Promise.all([
        reportQcV2Api.listTasks(status).catch(() => null),
        reportQcV2Api.listScores().catch(() => null),
        reportQcV2Api.getDimensions().catch(() => null),
        reportQcV2Api.getStats().catch(() => null),
      ])
      if (taskRes?.success && taskRes.data) setTasks(taskRes.data)
      else {
        setTasks([])
        setError(t('w4a.qcTask.loadFailed'))
      }
      if (scoreRes?.success && scoreRes.data) setScores(scoreRes.data)
      if (dimRes?.success && dimRes.data) setDimensions(dimRes.data)
      if (statRes?.success && statRes.data) setStats(statRes.data)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const summary = useMemo(() => {
    const withScore = tasks.filter((x) => x.totalScore !== undefined)
    const avg =
      withScore.length > 0
        ? Math.round((withScore.reduce((a, x) => a + (x.totalScore ?? 0), 0) / withScore.length) * 10) / 10
        : 0
    return {
      total: tasks.length,
      closed: tasks.filter((x) => x.status === 'closed').length,
      reviewing: tasks.filter((x) => x.status === 'reviewing').length,
      avg: stats?.avgScore ?? avg,
      passRate: stats?.passRate ?? 0,
    }
  }, [tasks, stats])

  const handleCreate = useCallback(async () => {
    if (!createForm.reportId.trim()) {
      message.warning(t('reportQcV2.enterReportId'))
      return
    }
    setCreating(true)
    try {
      const res = await reportQcV2Api.createTask({
        reportId: createForm.reportId.trim(),
        patientName: createForm.patientName.trim() || undefined,
        modality: createForm.modality || undefined,
        assignee: createForm.assignee.trim() || undefined,
      })
      if (res.success) {
        message.success(t('w9e.reportQcV2.taskCreated', { id: res.data.id }))
        setCreateOpen(false)
        setCreateForm({ reportId: '', patientName: '', modality: 'CT', assignee: '' })
        void load()
      } else {
        message.error(res.error?.message ?? t('reportQcV2.taskCreateFailed'))
      }
    } catch {
      message.error(t('reportQcV2.taskCreateFailed'))
    } finally {
      setCreating(false)
    }
  }, [createForm, load])

  const openAction = useCallback(
    (type: QcActionType, task: QcTask) => {
      setAction({ type, task })
      setAssignee(task.assignee ?? '')
      setAssigneeName(task.assigneeName ?? '')
      setReviewer(defaultReviewer)
      setOpinion('pass')
      setComment('')
    },
    [defaultReviewer],
  )

  const runAction = useCallback(async () => {
    if (!action) return
    const { type, task } = action
    setActionLoading(true)
    try {
      let res: { success: boolean; error?: { message: string } } | null = null
      if (type === 'assign') {
        if (!assignee.trim()) {
          message.warning(t('reportQcV2.assignee'))
          return
        }
        res = await reportQcV2Api.assignTask(task.id, {
          assignee: assignee.trim(),
          assigneeName: assigneeName.trim() || undefined,
        })
      } else if (type === 'review' || type === 'second') {
        if (!reviewer.trim()) {
          message.warning(t('reportQcV2.reviewer'))
          return
        }
        const payload = { reviewer: reviewer.trim(), opinion, comment: comment.trim() || undefined }
        res =
          type === 'review'
            ? await reportQcV2Api.reviewTask(task.id, payload)
            : await reportQcV2Api.secondReviewTask(task.id, payload)
      } else {
        res = await reportQcV2Api.closeTask(task.id, { comment: comment.trim() || t('reportQcV2.manualCloseComment') })
      }
      if (res?.success) {
        message.success(t('reportQcV2.opSuccess'))
        setAction(null)
        void load()
      } else {
        message.error(res?.error?.message ?? t('reportQcV2.opFailed'))
      }
    } catch {
      message.error(t('reportQcV2.opFailed'))
    } finally {
      setActionLoading(false)
    }
  }, [action, assignee, assigneeName, reviewer, opinion, comment, load])

  const taskColumns: ColumnsType<QcTask> = [
    { title: t('w4a.qcTask.thId'), dataIndex: 'id', key: 'id', width: 110, render: (v: string) => <Tag>{v}</Tag> },
    { title: t('w4a.qcTask.thReport'), dataIndex: 'reportId', key: 'reportId', width: 130 },
    { title: t('w4a.qcTask.thPatient'), dataIndex: 'patientName', key: 'patientName', width: 90 },
    { title: t('w4a.qcTask.thModality'), dataIndex: 'modality', key: 'modality', width: 70 },
    { title: t('w4a.qcTask.thAssignee'), dataIndex: 'assigneeName', key: 'assigneeName', width: 100, render: (v?: string) => v ?? '-' },
    { title: t('reportQcV2.reviewer'), key: 'reviewer', width: 100, render: (_: unknown, r: QcTask) => lastReviewer(r, 1) },
    {
      title: t('w4a.qcTask.thStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: QcTaskStatus) => {
        const m = QC_TASK_STATUS_META[s] ?? QC_TASK_STATUS_META.pending
        return <Tag color={m.color}>{t(m.labelKey)}</Tag>
      },
    },
    {
      title: t('w4a.qcTask.thScore'),
      dataIndex: 'totalScore',
      key: 'totalScore',
      width: 80,
      sorter: (a, b) => (a.totalScore ?? 0) - (b.totalScore ?? 0),
      render: (v?: number) => (v === undefined ? '-' : v),
    },
    {
      title: t('w4a.qcTask.thGrade'),
      dataIndex: 'grade',
      key: 'grade',
      width: 70,
      render: (g?: QcGrade) => (g ? <Tag color={GRADE_COLORS[g]}>{g}</Tag> : '-'),
    },
    { title: t('common.table.updatedAt'), dataIndex: 'updatedAt', key: 'updatedAt', width: 110, render: (v: string) => fmtDate(v) },
    {
      title: t('common.table.actions'),
      key: 'actions',
      width: 260,
      render: (_: unknown, r: QcTask) => (
        <Space size={4} wrap>
          {r.status !== 'closed' && (
            <Button size="small" icon={<Users size={12} />} data-testid={`qc-assign-${r.id}`} onClick={() => openAction('assign', r)}>
              {t('reportQcV2.assign')}
            </Button>
          )}
          {(r.status === 'pending' || r.status === 'in_progress') && (
            <Button size="small" type="primary" ghost icon={<CheckCircle2 size={12} />} data-testid={`qc-review-${r.id}`} onClick={() => openAction('review', r)}>
              {t('reportQcV2.firstReview')}
            </Button>
          )}
          {r.status === 'reviewing' && (
            <Button size="small" type="primary" ghost icon={<ListChecks size={12} />} data-testid={`qc-second-${r.id}`} onClick={() => openAction('second', r)}>
              {t('reportQcV2.secondReview')}
            </Button>
          )}
          {r.status !== 'closed' && (
            <Button size="small" danger data-testid={`qc-close-${r.id}`} onClick={() => openAction('close', r)}>
              {t('reportQcV2.close')}
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const scoreColumns: ColumnsType<QcScoreResult> = [
    { title: t('w4a.qcTask.thId'), dataIndex: 'id', key: 'id', width: 110, render: (v: string) => <Tag>{v}</Tag> },
    { title: t('reportQcV2.report'), dataIndex: 'reportId', key: 'reportId', width: 130 },
    { title: t('reportQcV2.modality'), dataIndex: 'modality', key: 'modality', width: 80 },
    { title: t('reportQcV2.totalScore'), dataIndex: 'totalScore', key: 'totalScore', width: 90 },
    {
      title: t('reportQcV2.grade'),
      dataIndex: 'grade',
      key: 'grade',
      width: 70,
      render: (g: QcGrade) => <Tag color={GRADE_COLORS[g]}>{g}</Tag>,
    },
    { title: t('reportQcV2.defectCount'), key: 'defectCount', width: 90, render: (_: unknown, r: QcScoreResult) => (r.defects?.length ?? 0) },
    { title: t('common.table.date'), dataIndex: 'evaluatedAt', key: 'evaluatedAt', width: 110, render: (v: string) => fmtDate(v) },
  ]

  const dimensionColumns: ColumnsType<QcDimensionMeta> = [
    {
      title: t('reportQcV2.dimension'),
      dataIndex: 'label',
      key: 'label',
      width: 110,
      render: (v: string, r: QcDimensionMeta) => (
        <Space size={6}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, display: 'inline-block' }} />
          {v}
        </Space>
      ),
    },
    { title: 'Key', dataIndex: 'key', key: 'key', width: 120 },
    { title: t('common.table.name'), dataIndex: 'labelEn', key: 'labelEn', width: 140 },
    { title: t('reportQcV2.fullScore'), dataIndex: 'max', key: 'max', width: 80 },
    {
      title: t('common.table.description'),
      key: 'subItems',
      render: (_: unknown, r: QcDimensionMeta) => (
        <Space size={4} wrap>
          {(r.subItems ?? []).map((s) => (
            <Tag key={s.key} style={{ marginRight: 0 }}>
              {s.name} ({s.max})
            </Tag>
          ))}
        </Space>
      ),
    },
  ]

  const actionTitle: string =
    action?.type === 'assign'
      ? t('reportQcV2.assign')
      : action?.type === 'review'
        ? t('w9e.reportQcV2.firstReviewRound')
        : action?.type === 'second'
          ? t('w9e.reportQcV2.secondReviewRound')
          : t('reportQcV2.close')

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4, 16px)' }}>
      <StatCardGrid columns={4} minWidth={180}>
        <StatCard title={t('w4a.qcTask.tab')} value={summary.total} icon={<ClipboardList size={18} />} color="primary" />
        <StatCard title={t('w4a.qcTask.status.closed')} value={summary.closed} icon={<CheckCircle2 size={18} />} color="success" />
        <StatCard title={t('w4a.qcTask.thScore')} value={summary.avg} precision={1} icon={<Gauge size={18} />} color="info" />
        <StatCard title={t('reportQcV2.passRate')} value={summary.passRate} suffix="%" icon={<AlertTriangle size={18} />} color="warning" />
      </StatCardGrid>

      <Space wrap>
        <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }} options={STATUS_FILTER_OPTIONS} data-testid="qc-status-filter" />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)} data-testid="qc-create-task">
          {t('common.action.create')}
        </Button>
        <Button icon={<RefreshCw size={14} />} onClick={() => void load()} loading={loading} data-testid="qc-refresh">
          {t('w4a.qcTask.refresh')}
        </Button>
        <Tag color={summary.reviewing > 0 ? 'blue' : 'default'}>{t('reportQcV2.dualReview')}: {summary.reviewing}</Tag>
      </Space>

      <Card size="small" title={<Space><ClipboardList size={14} /><span>{t('w4a.qcTask.tab')}</span></Space>}>
        <StateView loading={loading} error={error} empty={!loading && !error && tasks.length === 0} onRetry={load} minHeight={240}>
          <DataTable<QcTask>
            rowKey="id"
            columns={taskColumns}
            dataSource={tasks}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            columnConfigKey="w-d7-qc-tasks"
            scroll={{ x: 1200 }}
            exportFileName="report-qc-tasks"
          />
        </StateView>
      </Card>

      <Card size="small" title={<Space><Gauge size={14} /><span>{t('reportQcV2.scoreResult')}</span></Space>} extra={<Tag>{scores.length}</Tag>}>
        <DataTable<QcScoreResult>
          rowKey="id"
          columns={scoreColumns}
          dataSource={scores}
          pagination={{ pageSize: 5, showSizeChanger: false }}
          columnConfigKey="w-d7-qc-scores"
          exportFileName="report-qc-scores"
        />
      </Card>

      <Card size="small" title={<Space><ListChecks size={14} /><span>{t('reportQcV2.multiDimScore')}</span></Space>} extra={<Tag>{dimensions.length}</Tag>}>
        <DataTable<QcDimensionMeta>
          rowKey="key"
          columns={dimensionColumns}
          dataSource={dimensions}
          pagination={false}
          columnConfigKey="w-d7-qc-dimensions"
          exportFileName="report-qc-dimensions"
        />
      </Card>

      {/* 创建质控任务 */}
      <Modal
        title={t('common.action.create')}
        open={createOpen}
        onOk={() => void handleCreate()}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={creating}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
      >
        <div style={{ display: 'grid', gap: 'var(--space-3, 12px)' }}>
          <div>
            <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('reportQcV2.reportId')}</div>
            <Input
              value={createForm.reportId}
              onChange={(e) => setCreateForm((f) => ({ ...f, reportId: e.target.value }))}
              placeholder="RPT-2026-0001"
              data-testid="qc-create-report-id"
            />
          </div>
          <div>
            <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('reportQcV2.patient')}</div>
            <Input value={createForm.patientName} onChange={(e) => setCreateForm((f) => ({ ...f, patientName: e.target.value }))} />
          </div>
          <div>
            <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('reportQcV2.modality')}</div>
            <Select style={{ width: '100%' }} value={createForm.modality} onChange={(v) => setCreateForm((f) => ({ ...f, modality: v }))} options={MODALITY_OPTIONS} />
          </div>
          <div>
            <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('reportQcV2.assignee')}</div>
            <Input value={createForm.assignee} onChange={(e) => setCreateForm((f) => ({ ...f, assignee: e.target.value }))} placeholder="u-101" />
          </div>
        </div>
      </Modal>

      {/* 任务动作: 分配 / 一级复核 / 二次复核 / 关闭 */}
      <Modal
        title={
          <Space>
            <span>{actionTitle}</span>
            {action && <Tag>{action.task.id}</Tag>}
          </Space>
        }
        open={!!action}
        onOk={() => void runAction()}
        onCancel={() => setAction(null)}
        confirmLoading={actionLoading}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        data-testid="qc-action-modal"
      >
        {action && (
          <div style={{ display: 'grid', gap: 'var(--space-3, 12px)' }}>
            {action.type === 'assign' && (
              <>
                <div>
                  <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('reportQcV2.assignee')}</div>
                  <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="u-101" data-testid="qc-assignee-input" />
                </div>
                <div>
                  <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('reportQcV2.reviewer')}</div>
                  <Input value={assigneeName} onChange={(e) => setAssigneeName(e.target.value)} placeholder={t('reportQcV2.assignee')} />
                </div>
              </>
            )}
            {(action.type === 'review' || action.type === 'second') && (
              <>
                {action.type === 'second' && <Tag color="blue">{t('reportQcV2.dualReviewHint')}</Tag>}
                <div>
                  <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('reportQcV2.reviewer')}</div>
                  <Input value={reviewer} onChange={(e) => setReviewer(e.target.value)} data-testid="qc-reviewer-input" />
                </div>
                <div>
                  <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('reportQcV2.reviewOpinion')}</div>
                  <Select style={{ width: '100%' }} value={opinion} onChange={(v) => setOpinion(v)} options={OPINION_OPTIONS} data-testid="qc-opinion-select" />
                </div>
                <div>
                  <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('reportQcV2.reviewCommentPlaceholder')}</div>
                  <Input.TextArea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
                </div>
              </>
            )}
            {action.type === 'close' && (
              <div>
                <div style={{ marginBottom: 'var(--space-1, 4px)', fontWeight: 500 }}>{t('reportQcV2.manualCloseComment')}</div>
                <Input.TextArea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default ReportQcTaskBoardPanel
