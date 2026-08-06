import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Tag, Space, Modal, Input, Typography, Row, Col, Statistic, message, Select, Divider, Alert } from 'antd'
import { GitBranch, CheckCircle, AlertTriangle, BarChart3, UserCheck, PenLine, RefreshCw } from 'lucide-react'
import { dualReadApi, type DualReadAssignment } from '../../services/api/dualReadApi'
import { useAuth } from '../../hooks/useAuth'

const { Text } = Typography
const { TextArea } = Input

const statusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待阅片' },
  reader1_done: { color: 'processing', label: '医师一完成' },
  reader2_done: { color: 'processing', label: '医师二完成' },
  both_done: { color: 'warning', label: '双方完成' },
  arbitrated: { color: 'success', label: '已仲裁' },
}

const DualReadPage: React.FC = () => {
  const { user } = useAuth()
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

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await dualReadApi.listAssignments()
      if (res.success && Array.isArray(res.data)) {
        setAssignments(res.data)
      } else {
        setError(res.error?.message ?? '双阅列表加载失败')
      }
    } catch (e) {
      setError((e as Error)?.message ?? '网络错误')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleArbitrate = async () => {
    if (!selectedAssignment || !arbitrateReport.trim()) {
      message.warning('请填写仲裁报告')
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
        message.success('仲裁完成')
      } else {
        message.error(res.error?.message ?? '仲裁失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '仲裁失败')
    } finally {
      setActionLoading(false)
      setArbitrateOpen(false)
      setArbitrateReport('')
    }
  }

  const handleAssign = async () => {
    if (!newAssign.studyId || !newAssign.patientName || !newAssign.patientId) {
      message.warning('请填写检查号/患者姓名/患者ID')
      return
    }
    setActionLoading(true)
    try {
      const res = await dualReadApi.createAssignment(newAssign)
      if (res.success && res.data) {
        setAssignments(prev => [res.data as DualReadAssignment, ...prev])
        message.success('双阅分配成功')
      } else {
        message.error(res.error?.message ?? '分配失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '分配失败')
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
      message.warning('请填写阅片报告')
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
        message.success('阅片结果已提交')
      } else {
        message.error(res.error?.message ?? '提交失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '提交失败')
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

  const columns = [
    { title: '检查号', dataIndex: 'studyId', key: 'studyId' },
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: '模态', dataIndex: 'modality', key: 'modality' },
    { title: '医师一', dataIndex: 'reader1Name', key: 'reader1Name' },
    { title: '医师二', dataIndex: 'reader2Name', key: 'reader2Name' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusMap[s]?.color}>{statusMap[s]?.label || s}</Tag> },
    { title: '不一致率', dataIndex: 'discrepancyScore', key: 'discrepancyScore', render: (v: number) => v != null ? `${(v * 100).toFixed(0)}%` : '-' },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: DualReadAssignment) => (
        <Space>
          {r.status !== 'arbitrated' && !r.report1 && <Button size="small" icon={<PenLine size={14} />} onClick={() => openSubmit(r, 1)}>读一提交</Button>}
          {r.status !== 'arbitrated' && !r.report2 && <Button size="small" icon={<PenLine size={14} />} onClick={() => openSubmit(r, 2)}>读二提交</Button>}
          {r.status === 'both_done' && <Button size="small" type="primary" icon={<CheckCircle size={14} />} onClick={() => { setSelectedAssignment(r); setArbitrateOpen(true) }}>仲裁</Button>}
          {r.status === 'arbitrated' && <Text type="secondary">已仲裁: {r.arbitratorName}</Text>}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <GitBranch size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>双阅片工作流</span>
        <Tag color="blue">真实 API 数据</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadData()} loading={loading}>刷新</Button>
      </Space>
      {error && !loading && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总分配" value={total} prefix={<GitBranch size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="已仲裁" value={arbitrated} prefix={<CheckCircle size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="平均不一致率" value={`${(avgDisc * 100).toFixed(1)}%`} prefix={<BarChart3 size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="待处理" value={assignments.filter(a => a.status === 'both_done').length} prefix={<AlertTriangle size={16} />} /></Card></Col>
      </Row>
      <Card extra={<Button type="primary" icon={<UserCheck size={14} />} loading={actionLoading} onClick={() => setAssignOpen(true)}>分配双阅</Button>}>
        <Table rowKey="id" dataSource={assignments} columns={columns} pagination={false} size="small" loading={loading} />
      </Card>
      {selectedAssignment && (
        <Modal title={`仲裁 - ${selectedAssignment.studyId}`} open={arbitrateOpen} onOk={() => void handleArbitrate()} onCancel={() => setArbitrateOpen(false)} width={700} confirmLoading={actionLoading}>
          <Row gutter={16}>
            <Col span={12}><Card size="small" title={`读一: ${selectedAssignment.reader1Name}`}><Text>{selectedAssignment.report1 || '暂无'}</Text></Card></Col>
            <Col span={12}><Card size="small" title={`读二: ${selectedAssignment.reader2Name}`}><Text>{selectedAssignment.report2 || '暂无'}</Text></Card></Col>
          </Row>
          <Divider />
          <Text strong>仲裁报告:</Text>
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
        <TextArea rows={6} value={submitReport} onChange={e => setSubmitReport(e.target.value)} placeholder="请输入阅片所见及诊断意见" />
      </Modal>
      <Modal title="分配双阅" open={assignOpen} onOk={() => void handleAssign()} onCancel={() => setAssignOpen(false)} confirmLoading={actionLoading}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder="检查号" value={newAssign.studyId} onChange={e => setNewAssign(prev => ({ ...prev, studyId: e.target.value }))} />
          <Input placeholder="患者姓名" value={newAssign.patientName} onChange={e => setNewAssign(prev => ({ ...prev, patientName: e.target.value }))} />
          <Input placeholder="患者ID" value={newAssign.patientId} onChange={e => setNewAssign(prev => ({ ...prev, patientId: e.target.value }))} />
          <Select value={newAssign.modality} onChange={v => setNewAssign(prev => ({ ...prev, modality: v }))} options={[{ value: 'CT', label: 'CT' }, { value: 'MR', label: 'MR' }, { value: 'DX', label: 'DX' }]} />
        </Space>
      </Modal>
    </div>
  )
}

export default DualReadPage
