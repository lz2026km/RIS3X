// @deprecated [v3.0.6.11-104 Wave 5C] 已嵌入 ReviewCenterPage (/review-center 综合审核枢纽) 作为 Tab; 旧路由 /dual-read redirect 兼容。文件保留供回滚参考。
import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Tag, Space, Modal, Input, Typography, Row, Col, message, Select, Divider, Alert, Tooltip } from 'antd'
import { GitBranch, CheckCircle, AlertTriangle, BarChart3, UserCheck, PenLine, RefreshCw, FileText, ExternalLink } from 'lucide-react'
import { StatCard, StatCardGrid, PageContainer } from '../../components/common'
import { dualReadApi, type DualReadAssignment, type DualReadReportLink } from '../../services/api/dualReadApi'
import { useAuth } from '../../hooks/useAuth'
import { usePagination } from '../../hooks/usePagination'
import { useNavigate } from 'react-router-dom'
import { t } from '../../i18n/appI18n'

const { Text } = Typography
const { TextArea } = Input

const statusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待阅片' },
  reader1_done: { color: 'processing', label: '医师一完成' },
  reader2_done: { color: 'processing', label: '医师二完成' },
  both_done: { color: 'warning', label: '双方完成' },
  arbitrated: { color: 'success', label: '已仲裁' },
  completed: { color: 'success', label: '已完成(报告已生成)' },
}

/** [G-21 Wave3C] 双阅结论文本 (仲裁报告优先, 否则合并双方) */
function conclusionOf(a: DualReadAssignment): string {
  if (a.arbitrationReport?.trim()) return a.arbitrationReport.trim()
  const parts: string[] = []
  if (a.report1?.trim()) parts.push(`读一(${a.reader1Name}): ${a.report1.trim()}`)
  if (a.report2?.trim()) parts.push(`读二(${a.reader2Name}): ${a.report2.trim()}`)
  return parts.join('\n')
}

const DualReadPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [assignments, setAssignments] = useState<DualReadAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [arbitrateOpen, setArbitrateOpen] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<DualReadAssignment | null>(null)
  const [arbitrateReport, setArbitrateReport] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [newAssign, setNewAssign] = useState({ studyId: '', patientName: '', patientId: '', modality: 'CT' })
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitTarget, setSubmitTarget] = useState<{ assignment: DualReadAssignment; readerNumber: 1 | 2 } | null>(null)
  const [submitReport, setSubmitReport] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  // [G-21 Wave3C] 关联报告链接 (id → link)
  const [reportLinks, setReportLinks] = useState<Record<string, DualReadReportLink | null>>({})
  const [conclusionOpen, setConclusionOpen] = useState(false)
  const [conclusionTarget, setConclusionTarget] = useState<DualReadAssignment | null>(null)
  // [v3.0.6.11-95] W4-B P2: 受控分页 (双阅分配表)
  const assignPagination = usePagination(assignments, 10)

  // [v3.0.6.11-103 Wave 2A] 差异统计端点: GET /dual-read/discrepancy (失败静默回退本地派生)
  const [discStats, setDiscStats] = useState<{ totalAssignments: number; pendingCount: number; bothDoneCount: number; arbitratedCount: number; avgDiscrepancy: number } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await dualReadApi.listAssignments()
      if (res.success && Array.isArray(res.data)) {
        setAssignments(res.data)
      } else {
        setError(res.error?.message ?? t('dualRead.listLoadFailed'))
      }
    } catch (e) {
      setError((e as Error)?.message ?? t('dualRead.networkError'))
    } finally {
      setLoading(false)
    }
  }, [])

  // [v3.0.6.11-103 Wave 2A] 加载差异统计 (getDiscrepancyStats), 失败静默
  useEffect(() => {
    void dualReadApi.getDiscrepancyStats().then((res) => {
      if (res.success && res.data) setDiscStats(res.data)
    }).catch(() => { /* 静默回退本地派生 */ })
  }, [])

  // [G-21 Wave3C] 行内展示关联报告链接
  const loadReportLinks = useCallback(async (list: DualReadAssignment[]) => {
    const links: Record<string, DualReadReportLink | null> = {}
    await Promise.all(
      list.map(async (a) => {
        try {
          const res = await dualReadApi.getReportLink(a.id)
          links[a.id] = res.success && res.data?.linked && res.data.report ? res.data.report : null
        } catch {
          links[a.id] = null
        }
      }),
    )
    setReportLinks(links)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (assignments.length > 0) void loadReportLinks(assignments)
  }, [assignments, loadReportLinks])

  // [G-21 Wave3C] 双阅完成 → 自动生成/关联报告 → 跳转报告书写
  const handleComplete = async (assignment: DualReadAssignment) => {
    setActionLoading(true)
    try {
      const res = await dualReadApi.complete(assignment.id)
      if (res.success && res.data) {
        const updated = res.data.assignment
        setAssignments(prev => prev.map(a => a.id === assignment.id ? updated : a))
        const link = res.data.report
        if (link) setReportLinks(prev => ({ ...prev, [assignment.id]: link }))
        message.success(res.data.created ? `报告已自动创建 (${link?.reportId})` : t('dualRead.linkedExistingReport'))
        if (link?.examId) {
          navigate(`/reports/v3-write?examId=${encodeURIComponent(link.examId)}`)
        } else if (link?.reportId) {
          navigate(`/reports/v3-write?examId=${encodeURIComponent(link.reportId)}`)
        }
      } else {
        message.error(res.error?.message ?? t('dualRead.completeFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('dualRead.completeFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleArbitrate = async () => {
    if (!selectedAssignment || !arbitrateReport.trim()) {
      message.warning(t('dualRead.arbitrateReportRequired'))
      return
    }
    setActionLoading(true)
    try {
      const res = await dualReadApi.arbitrate(selectedAssignment.id, {
        arbitratorId: user?.id ?? 'admin',
        arbitratorName: user?.name ?? '管理员',
        report: arbitrateReport,
      })
      if (res.success && res.data) {
        setAssignments(prev => prev.map(a => a.id === selectedAssignment.id ? res.data as DualReadAssignment : a))
        message.success(t('dualRead.arbitrateDone'))
      } else {
        message.error(res.error?.message ?? t('dualRead.arbitrateFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('dualRead.arbitrateFailed'))
    } finally {
      setActionLoading(false)
      setArbitrateOpen(false)
      setArbitrateReport('')
    }
  }

  const handleAssign = async () => {
    if (!newAssign.studyId || !newAssign.patientName || !newAssign.patientId) {
      message.warning(t('dualRead.fillAssignFields'))
      return
    }
    setActionLoading(true)
    try {
      const res = await dualReadApi.createAssignment(newAssign)
      if (res.success && res.data) {
        setAssignments(prev => [res.data as DualReadAssignment, ...prev])
        message.success(t('dualRead.assignSuccess'))
      } else {
        message.error(res.error?.message ?? t('dualRead.assignFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('dualRead.assignFailed'))
    } finally {
      setActionLoading(false)
      setAssignOpen(false)
      setNewAssign({ studyId: '', patientName: '', patientId: '', modality: 'CT' })
    }
  }

  const openSubmit = (assignment: DualReadAssignment, readerNumber: 1 | 2) => {
    setSubmitTarget({ assignment, readerNumber })
    setSubmitReport(readerNumber === 1 ? assignment.report1 ?? '' : assignment.report2 ?? '')
    setSubmitOpen(true)
  }

  const handleSubmitReader = async () => {
    if (!submitTarget || !submitReport.trim()) {
      message.warning(t('dualRead.fillReaderReport'))
      return
    }
    setActionLoading(true)
    try {
      const res = await dualReadApi.submitReader(submitTarget.assignment.id, {
        readerNumber: submitTarget.readerNumber,
        report: submitReport,
      })
      if (res.success && res.data) {
        setAssignments(prev => prev.map(a => a.id === submitTarget.assignment.id ? res.data as DualReadAssignment : a))
        message.success(t('dualRead.submitSuccess'))
      } else {
        message.error(res.error?.message ?? t('dualRead.submitFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('dualRead.submitFailed'))
    } finally {
      setActionLoading(false)
      setSubmitOpen(false)
      setSubmitReport('')
      setSubmitTarget(null)
    }
  }

  const total = assignments.length
  const arbitrated = assignments.filter(a => a.status === 'arbitrated').length
  const scored = assignments.filter(a => a.discrepancyScore != null)
  const avgDisc = scored.length ? scored.reduce((s, a) => s + (a.discrepancyScore ?? 0), 0) / scored.length : 0
  // [v3.0.6.11-103 Wave 2A] 差异统计: 端点优先, 本地派生兜底
  const discAvg = discStats ? discStats.avgDiscrepancy : avgDisc
  const discTotal = discStats ? discStats.totalAssignments : total
  const discArbitrated = discStats ? discStats.arbitratedCount : arbitrated

  const columns = [
    { title: t('dualRead.colStudyId'), dataIndex: 'studyId', key: 'studyId' },
    { title: t('dualRead.colPatient'), dataIndex: 'patientName', key: 'patientName' },
    { title: t('dualRead.colModality'), dataIndex: 'modality', key: 'modality' },
    { title: t('dualRead.colReader1'), dataIndex: 'reader1Name', key: 'reader1Name' },
    { title: t('dualRead.colReader2'), dataIndex: 'reader2Name', key: 'reader2Name' },
    { title: t('dualRead.colStatus'), dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusMap[s]?.color}>{statusMap[s]?.label || s}</Tag> },
    { title: t('dualRead.colDiscrepancy'), dataIndex: 'discrepancyScore', key: 'discrepancyScore', render: (v: number) => v != null ? `${(v * 100).toFixed(0)}%` : '-' },
    // [G-21 Wave3C] 双阅结论展示 (仲裁报告优先, 可点击查看全文)
    {
      title: t('dualRead.colConclusion'),
      key: 'conclusion',
      render: (_: unknown, r: DualReadAssignment) => {
        const text = conclusionOf(r)
        if (!text) return <Text type="secondary">{t('dualRead.notSubmitted')}</Text>
        return (
          <Tooltip title={text}>
            <Button size="small" type="link" icon={<FileText size={12} />} onClick={() => { setConclusionTarget(r); setConclusionOpen(true) }}>
              {text.length > 18 ? `${text.slice(0, 18)}...` : text}
            </Button>
          </Tooltip>
        )
      },
    },
    {
      title: t('dualRead.colActions'),
      key: 'action',
      render: (_: unknown, r: DualReadAssignment) => {
        const link = reportLinks[r.id]
        return (
          <Space>
            {r.status !== 'arbitrated' && r.status !== 'completed' && !r.report1 && <Button size="small" icon={<PenLine size={14} />} onClick={() => openSubmit(r, 1)}>{t('dualRead.submitReader1')}</Button>}
            {r.status !== 'arbitrated' && r.status !== 'completed' && !r.report2 && <Button size="small" icon={<PenLine size={14} />} onClick={() => openSubmit(r, 2)}>{t('dualRead.submitReader2')}</Button>}
            {r.status === 'both_done' && <Button size="small" type="primary" icon={<CheckCircle size={14} />} onClick={() => { setSelectedAssignment(r); setArbitrateOpen(true) }}>{t('dualRead.arbitrate')}</Button>}
            {(r.status === 'both_done' || r.status === 'arbitrated') && (
              <Button size="small" type="primary" icon={<FileText size={14} />} loading={actionLoading} onClick={() => void handleComplete(r)}>{t('dualRead.completeAndGenerate')}</Button>
            )}
            {r.status === 'arbitrated' && !r.arbitrationReport && <Text type="secondary">{t('dualRead.arbitratorPrefix')}: {r.arbitratorName}</Text>}
            {link && (
              <Button size="small" icon={<ExternalLink size={14} />} onClick={() => navigate(link.examId ? `/reports/v3-write?examId=${encodeURIComponent(link.examId)}` : `/reports/v3-write?examId=${encodeURIComponent(link.reportId)}`)}>
                {t('dualRead.linkedReport')}
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }}>
        <GitBranch size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('dualRead.title')}</span>
        <Tag color="blue">{t('dualRead.realApiData')}</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadData()} loading={loading}>{t('dualRead.refresh')}</Button>
      </Space>
      {error && !loading && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('dualRead.totalAssignments')} value={discTotal} icon={<GitBranch size={16} />} />
        <StatCard title={t('dualRead.arbitrated')} value={discArbitrated} icon={<CheckCircle size={16} />} />
        <StatCard title={t('dualRead.avgDiscrepancy')} value={`${(discAvg * 100).toFixed(1)}%`} icon={<BarChart3 size={16} />} />
        <StatCard title={t('dualRead.pending')} value={assignments.filter(a => a.status === 'both_done').length} icon={<AlertTriangle size={16} />} />
      </StatCardGrid>
      <Card extra={<Button type="primary" icon={<UserCheck size={14} />} loading={actionLoading} onClick={() => setAssignOpen(true)}>{t('dualRead.assignDualRead')}</Button>}>
        <Table rowKey="id" dataSource={assignPagination.pageData} columns={columns} pagination={assignPagination.pagination} size="small" loading={loading} scroll={{ x: 'max-content' }}/>
      </Card>
      {selectedAssignment && (
        <Modal title={`仲裁 - ${selectedAssignment.studyId}`} open={arbitrateOpen} onOk={() => void handleArbitrate()} onCancel={() => setArbitrateOpen(false)} width={700} confirmLoading={actionLoading}>
          <Row gutter={16}>
            <Col span={12}><Card size="small" title={`读一: ${selectedAssignment.reader1Name}`}><Text>{selectedAssignment.report1 || t('dualRead.none')}</Text></Card></Col>
            <Col span={12}><Card size="small" title={`读二: ${selectedAssignment.reader2Name}`}><Text>{selectedAssignment.report2 || t('dualRead.none')}</Text></Card></Col>
          </Row>
          <Divider />
          <Text strong>{t('dualRead.arbitrationReport')}:</Text>
          <TextArea rows={4} value={arbitrateReport} onChange={e => setArbitrateReport(e.target.value)} style={{ marginTop: 8 }} />
        </Modal>
      )}
      <Modal
        title={`${submitTarget?.readerNumber === 1 ? `读一(${submitTarget?.assignment.reader1Name})` : `读二(${submitTarget?.assignment.reader2Name})`} - ${submitTarget?.assignment.studyId ?? ''} 阅片报告`}
        open={submitOpen}
        onOk={() => void handleSubmitReader()}
        onCancel={() => { setSubmitOpen(false); setSubmitTarget(null) }}
        confirmLoading={actionLoading}
      >
        <TextArea rows={6} value={submitReport} onChange={e => setSubmitReport(e.target.value)} placeholder={t('dualRead.readerFindingsPlaceholder')} />
      </Modal>
      <Modal title={t('dualRead.assignModal')} open={assignOpen} onOk={() => void handleAssign()} onCancel={() => setAssignOpen(false)} confirmLoading={actionLoading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder={t('dualRead.studyIdPlaceholder')} value={newAssign.studyId} onChange={e => setNewAssign(prev => ({ ...prev, studyId: e.target.value }))} />
          <Input placeholder={t('dualRead.patientNamePlaceholder')} value={newAssign.patientName} onChange={e => setNewAssign(prev => ({ ...prev, patientName: e.target.value }))} />
          <Input placeholder={t('dualRead.patientIdPlaceholder')} value={newAssign.patientId} onChange={e => setNewAssign(prev => ({ ...prev, patientId: e.target.value }))} />
          <Select value={newAssign.modality} onChange={v => setNewAssign(prev => ({ ...prev, modality: v }))} options={[{ value: 'CT', label: 'CT' }, { value: 'MR', label: 'MR' }, { value: 'DX', label: 'DX' }]} />
        </Space>
      </Modal>
      {/* [G-21 Wave3C] 双阅结论全文 */}
      <Modal
        title={`双阅结论 - ${conclusionTarget?.studyId ?? ''} ${conclusionTarget?.patientName ?? ''}`}
        open={conclusionOpen}
        onCancel={() => { setConclusionOpen(false); setConclusionTarget(null) }}
        footer={null}
        width={640}
      >
        {conclusionTarget && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Card size="small" title={`读一: ${conclusionTarget.reader1Name}`}><Text style={{ whiteSpace: 'pre-wrap' }}>{conclusionTarget.report1 || t('dualRead.none')}</Text></Card>
            <Card size="small" title={`读二: ${conclusionTarget.reader2Name}`}><Text style={{ whiteSpace: 'pre-wrap' }}>{conclusionTarget.report2 || t('dualRead.none')}</Text></Card>
            {conclusionTarget.arbitrationReport && <Card size="small" title={`仲裁 (${conclusionTarget.arbitratorName})`}><Text style={{ whiteSpace: 'pre-wrap' }}>{conclusionTarget.arbitrationReport}</Text></Card>}
            <Divider style={{ margin: '4px 0' }} />
            <Alert type="info" showIcon message={t('dualRead.conclusionAlert')} description={<Text style={{ whiteSpace: 'pre-wrap' }}>{conclusionOf(conclusionTarget)}</Text>} />
          </Space>
        )}
      </Modal>
    </PageContainer>
  )
}

export default DualReadPage
