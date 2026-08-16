import React, { useState, useEffect, useCallback } from 'react'
import {
  Card, Button, Tag, Space, Modal, Input, Row, Col,
  message, Alert, Select, Rate, Progress, Tooltip, Divider,
} from 'antd'
import {
  Star, UserCheck, ClipboardCheck, RefreshCw, PlusCircle,
  FileText,
} from 'lucide-react'
import {
  reportPeerReviewApi,
  type PeerReviewTask,
  type PeerReviewStats,
  type PeerScores,
} from '../../services/api/reportPeerReviewApi'
import { useAuth } from '../../hooks/useAuth'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'
import { AppText } from '../../components/common/AppText'
import { VirtualTable } from '../../components/common/VirtualTable'

const { TextArea } = Input

const statusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'processing', label: '待评' },
  reviewed: { color: 'success', label: '已评' },
  overdue: { color: 'red', label: '超时' },
}

const dimensionMeta: Array<{ key: keyof PeerScores; label: string }> = [
  { key: 'accuracy', label: '准确性' },
  { key: 'completeness', label: '完整性' },
  { key: 'normativity', label: '规范性' },
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
      if (!r.success) setError(r.error?.message ?? '加载失败')
    } catch (e) {
      setError((e as Error)?.message ?? '网络错误')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { void loadData() }, [loadData])

  const handleAssign = async () => {
    if (!assignForm.reportId.trim()) { message.warning('请输入报告编号'); return }
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
          ? `已按科室确定性分配 → ${task.reviewerName}`
          : `已指定评审人 → ${task.reviewerName}`)
        setAssignOpen(false)
        setAssignForm({ reportId: '', patientName: '', modality: 'CT', department: '放射科', reviewerId: '' })
        void loadData()
      } else {
        message.error(res.error?.message ?? '分配失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '分配失败')
    } finally {
      setActionLoading(false)
    }
  }

  const openScore = (task: PeerReviewTask) => {
    setScoreTarget(task)
    setScores(task.scores ?? { accuracy: 4, completeness: 4, normativity: 4 })
    setComment(task.comment ?? '')
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
        message.success('评分已提交')
        setScoreTarget(null)
        void loadData()
      } else {
        message.error(res.error?.message ?? '评分失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '评分失败')
    } finally {
      setActionLoading(false)
    }
  }

  const overallOf = (t: PeerReviewTask): number => {
    if (!t.scores) return 0
    return Math.round(((t.scores.accuracy + t.scores.completeness + t.scores.normativity) / 3) * 10) / 10
  }

  const columns = [
    { title: '报告编号', dataIndex: 'reportId', key: 'reportId' },
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: '模态', dataIndex: 'modality', key: 'modality', width: 70 },
    { title: '科室', dataIndex: 'department', key: 'department' },
    {
      title: '评审人', dataIndex: 'reviewerName', key: 'reviewerName',
      render: (v: string, t: PeerReviewTask) => (
        <Space size={4}>
          <UserCheck size={13} color={t.autoAssigned ? '#2563eb' : '#f59e0b'} />
          {v}
          {t.autoAssigned ? <Tag color="blue" style={{ marginInlineEnd: 0 }}>自动</Tag> : <Tag color="orange" style={{ marginInlineEnd: 0 }}>指定</Tag>}
        </Space>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={statusMap[s]?.color}>{statusMap[s]?.label ?? s}</Tag>,
    },
    {
      title: '得分', dataIndex: 'scores', key: 'scores',
      render: (_: unknown, t: PeerReviewTask) => t.scores ? (
        <Tooltip title={`准确性 ${t.scores.accuracy} / 完整性 ${t.scores.completeness} / 规范性 ${t.scores.normativity}`}>
          <Space size={6}>
            <Star size={13} color="#f59e0b" fill="#f59e0b" />
            <AppText weight={600}>{overallOf(t)}</AppText>
            <Rate disabled value={Math.round(overallOf(t))} count={5} style={{ fontSize: 11 }} />
          </Space>
        </Tooltip>
      ) : <AppText color="secondary">-</AppText>,
    },
    {
      title: '截止时间', dataIndex: 'dueAt', key: 'dueAt',
      render: (v: string) => v.slice(0, 10),
    },
    {
      title: '操作', key: 'action',
      render: (_: unknown, t: PeerReviewTask) => (
        <Space>
          {t.status !== 'reviewed'
            ? <Button size="small" type="primary" icon={<ClipboardCheck size={13} />} onClick={() => openScore(t)}>评分</Button>
            : <Button size="small" onClick={() => openScore(t)}>查看/修改</Button>}
        </Space>
      ),
    },
  ]

  const distSum = stats?.scoreDistribution.reduce((a, s) => a + s.count, 0) ?? 0

  return (
    <div>
      <Card
        title={<Space><Star size={16} color="#2563eb" /><span>报告互评</span><Tag color="blue">三维度 5 分制</Tag></Space>}
        extra={<Button type="primary" icon={<PlusCircle size={14} />} onClick={() => setAssignOpen(true)}>分配互评任务</Button>}
      >
        {error && !loading && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
        <StatCardGrid minWidth={170} gap={16} style={{ marginBottom: 16 }}>
          <StatCard title="任务总数" value={stats?.total ?? 0} icon={<FileText size={16} />} color="primary" />
          <StatCard title="待评" value={stats?.pendingCount ?? 0} color="info" />
          <StatCard title="已评" value={stats?.reviewedCount ?? 0} color="success" />
          <StatCard title="超时" value={stats?.overdueCount ?? 0} color="error" />
          <StatCard title="完成率" value={stats?.completionRate ?? 0} suffix="%" color="primary" />
          <StatCard title="综合平均分" value={stats?.avgScores.overall ?? 0} suffix="/ 5" color="warning" />
        </StatCardGrid>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          {dimensionMeta.map(dm => (
            <Col span={4} key={dm.key}>
              <Card size="small" title={`${dm.label}平均`}>
                <Space>
                  <Rate disabled value={Math.round(stats?.avgScores[dm.key] ?? 0)} count={5} style={{ fontSize: 13 }} />
                  <AppText weight={600}>{(stats?.avgScores[dm.key] ?? 0).toFixed(1)}</AppText>
                </Space>
              </Card>
            </Col>
          ))}
          <Col span={12}>
            <Card size="small" title="评分分布 (综合)">
              <Space size={4} split={<Divider type="vertical" style={{ margin: 0 }} />}>
                {(stats?.scoreDistribution ?? []).map(d => (
                  <Tooltip key={d.score} title={`${d.score} 分: ${d.count} 份`}>
                    <Space direction="vertical" size={0} align="center">
                      <AppText weight={600}>{d.count}</AppText>
                      <Progress percent={distSum > 0 ? Math.round((d.count / distSum) * 100) : 0} showInfo={false} size="small" strokeColor="#f59e0b" style={{ width: 42 }} />
                      <AppText color="secondary" size="xs">{d.score} 分</AppText>
                    </Space>
                  </Tooltip>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>
        <Space style={{ marginBottom: 12 }}>
          <AppText>状态: </AppText>
          <Select allowClear placeholder="全部" style={{ width: 120 }} value={statusFilter}
            onChange={v => setStatusFilter(v)}
            options={[
              { value: 'pending', label: '待评' },
              { value: 'reviewed', label: '已评' },
              { value: 'overdue', label: '超时' },
            ]} />
          <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadData()} loading={loading}>刷新</Button>
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
      <Modal title="分配互评任务" open={assignOpen} onOk={() => void handleAssign()} onCancel={() => setAssignOpen(false)} confirmLoading={actionLoading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder="报告编号 (必填)" value={assignForm.reportId} onChange={e => setAssignForm(p => ({ ...p, reportId: e.target.value }))} />
          <Space style={{ width: '100%' }}>
            <Input placeholder="患者姓名" value={assignForm.patientName} onChange={e => setAssignForm(p => ({ ...p, patientName: e.target.value }))} style={{ flex: 2 }} />
            <Select value={assignForm.modality} onChange={v => setAssignForm(p => ({ ...p, modality: v }))} style={{ width: 90 }}
              options={['CT', 'MR', 'DR', 'MG', 'US'].map(m => ({ value: m, label: m }))} />
          </Space>
          <Select value={assignForm.department} onChange={v => setAssignForm(p => ({ ...p, department: v }))}
            options={DEPARTMENTS.map(d => ({ value: d, label: d }))} />
          <Input placeholder="指定评审人 ID (选填, 留空则按科室确定性自动分配)" value={assignForm.reviewerId}
            onChange={e => setAssignForm(p => ({ ...p, reviewerId: e.target.value }))} />
          <Alert type="info" showIcon message="自动分配: 同一 (报告编号 + 科室) 恒分配同一评审人; 留空为自动, 填评审人 ID 为指定。" />
        </Space>
      </Modal>

      {/* 评分表单 */}
      <Modal
        title={`报告互评 - ${scoreTarget?.reportId ?? ''} (评审人: ${scoreTarget?.reviewerName ?? ''})`}
        open={!!scoreTarget}
        onOk={() => void handleScore()}
        onCancel={() => setScoreTarget(null)}
        confirmLoading={actionLoading}
      >
        {scoreTarget && (
          <Space direction="vertical" style={{ width: '100%' }}>
            {dimensionMeta.map(dm => (
              <div key={dm.key}>
                <AppText weight={600}>{dm.label}</AppText>
                <Rate value={scores[dm.key]} count={5}
                  onChange={v => setScores(p => ({ ...p, [dm.key]: v }))}
                  style={{ marginLeft: 12 }} />
                <AppText color="secondary" style={{ marginLeft: 8 }}>{scores[dm.key]} / 5</AppText>
              </div>
            ))}
            <TextArea rows={4} placeholder="评语 (选填)" value={comment} onChange={e => setComment(e.target.value)} />
            <Alert type="warning" showIcon message="评分须为 1-5 整数 (后端校验), 提交后任务状态置为已评。" />
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default PeerReviewPanel
