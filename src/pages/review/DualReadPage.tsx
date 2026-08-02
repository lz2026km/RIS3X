import React, { useState } from 'react'
import { Card, Table, Button, Tag, Space, Modal, Input, Typography, Row, Col, Statistic, message, Select, Divider } from 'antd'
import { GitBranch, CheckCircle, AlertTriangle, BarChart3, UserCheck } from 'lucide-react'

const { Text, Title } = Typography
const { TextArea } = Input

interface Assignment {
  id: string
  studyId: string
  patientName: string
  patientId: string
  modality: string
  reader1Name: string
  reader2Name: string
  report1?: string
  report2?: string
  status: string
  discrepancyScore?: number
  arbitrationReport?: string
  arbitratorName?: string
}

const initAssignments: Assignment[] = [
  { id: 'da-001', studyId: 'STU001', patientName: 'Zhang San', patientId: 'P001', modality: 'CT', reader1Name: 'Dr. Wang', reader2Name: 'Dr. Li', report1: '右肺上叶见磨玻璃结节，大小约1.2cm×0.8cm，边界欠清。', report2: '右肺上叶磨玻璃密度影，建议密切随访。', status: 'both_done', discrepancyScore: 0.15 },
  { id: 'da-002', studyId: 'STU002', patientName: 'Li Si', patientId: 'P002', modality: 'MR', reader1Name: 'Dr. Wang', reader2Name: 'Dr. Zhang', report1: '左侧基底节区急性梗死灶。', report2: '左侧基底节区急性期脑梗死，建议DWI序列复查。', status: 'arbitrated', discrepancyScore: 0.05, arbitrationReport: '左侧基底节区急性脑梗死，建议临床干预。', arbitratorName: 'Dr. Chen' },
  { id: 'da-003', studyId: 'STU003', patientName: 'Wang Wu', patientId: 'P003', modality: 'DX', reader1Name: 'Dr. Li', reader2Name: 'Dr. Liu', status: 'pending' },
]

const statusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待阅片' },
  reader1_done: { color: 'processing', label: '医师一完成' },
  reader2_done: { color: 'processing', label: '医师二完成' },
  both_done: { color: 'warning', label: '双方完成' },
  arbitrated: { color: 'success', label: '已仲裁' },
}

const DualReadPage: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>(initAssignments)
  const [arbitrateOpen, setArbitrateOpen] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [arbitrateReport, setArbitrateReport] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [newAssign, setNewAssign] = useState({ studyId: '', patientName: '', patientId: '', modality: 'CT' })

  const handleArbitrate = () => {
    if (!selectedAssignment || !arbitrateReport) return
    setAssignments(prev => prev.map(a => a.id === selectedAssignment.id ? { ...a, status: 'arbitrated', arbitrationReport: arbitrateReport, arbitratorName: 'Dr. Admin', discrepancyScore: Math.round(Math.random() * 30) / 100 } : a))
    setArbitrateOpen(false)
    setArbitrateReport('')
    message.success('仲裁完成')
  }

  const handleAssign = () => {
    const doctors = ['Dr. Wang', 'Dr. Li', 'Dr. Zhang', 'Dr. Liu', 'Dr. Chen']
    const shuffled = [...doctors].sort(() => Math.random() - 0.5)
    const assignment: Assignment = {
      id: `da-${Date.now().toString(36)}`, ...newAssign,
      reader1Name: shuffled[0], reader2Name: shuffled[1],
      status: 'pending',
    }
    setAssignments(prev => [assignment, ...prev])
    setAssignOpen(false)
    setNewAssign({ studyId: '', patientName: '', patientId: '', modality: 'CT' })
    message.success('双阅分配成功')
  }

  const total = assignments.length
  const arbitrated = assignments.filter(a => a.status === 'arbitrated').length
  const avgDisc = assignments.filter(a => a.discrepancyScore != null).reduce((s, a) => s + (a.discrepancyScore || 0), 0) / assignments.filter(a => a.discrepancyScore != null).length || 0

  const columns = [
    { title: '检查号', dataIndex: 'studyId', key: 'studyId' },
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: '模态', dataIndex: 'modality', key: 'modality' },
    { title: '医师一', dataIndex: 'reader1Name', key: 'reader1Name' },
    { title: '医师二', dataIndex: 'reader2Name', key: 'reader2Name' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusMap[s]?.color}>{statusMap[s]?.label || s}</Tag> },
    { title: '不一致率', dataIndex: 'discrepancyScore', key: 'discrepancyScore', render: (v: number) => v != null ? `${(v * 100).toFixed(0)}%` : '-' },
    { title: '操作', key: 'action', render: (_: unknown, r: Assignment) => (
      <Space>
        {r.status === 'both_done' && <Button size="small" type="primary" icon={<CheckCircle size={14} />} onClick={() => { setSelectedAssignment(r); setArbitrateOpen(true) }}>仲裁</Button>}
        {r.status === 'arbitrated' && <Text type="secondary">已仲裁: {r.arbitratorName}</Text>}
      </Space>
    )},
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <GitBranch size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>双阅片工作流</span>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总分配" value={total} prefix={<GitBranch size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="已仲裁" value={arbitrated} prefix={<CheckCircle size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="平均不一致率" value={`${(avgDisc * 100).toFixed(1)}%`} prefix={<BarChart3 size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="待处理" value={assignments.filter(a => a.status === 'both_done').length} prefix={<AlertTriangle size={16} />} /></Card></Col>
      </Row>
      <Card extra={<Button type="primary" icon={<UserCheck size={14} />} onClick={() => setAssignOpen(true)}>分配双阅</Button>}>
        <Table rowKey="id" dataSource={assignments} columns={columns} pagination={false} size="small" />
      </Card>
      {selectedAssignment && (
        <Modal title={`仲裁 - ${selectedAssignment.studyId}`} open={arbitrateOpen} onOk={handleArbitrate} onCancel={() => setArbitrateOpen(false)} width={700}>
          <Row gutter={16}>
            <Col span={12}><Card size="small" title={`读一: ${selectedAssignment.reader1Name}`}><Text>{selectedAssignment.report1 || '暂无'}</Text></Card></Col>
            <Col span={12}><Card size="small" title={`读二: ${selectedAssignment.reader2Name}`}><Text>{selectedAssignment.report2 || '暂无'}</Text></Card></Col>
          </Row>
          <Divider />
          <Text strong>仲裁报告:</Text>
          <TextArea rows={4} value={arbitrateReport} onChange={e => setArbitrateReport(e.target.value)} style={{ marginTop: 8 }} />
        </Modal>
      )}
      <Modal title="分配双阅" open={assignOpen} onOk={handleAssign} onCancel={() => setAssignOpen(false)}>
        <Space orientation="vertical" style={{ width: '100%' }}>
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
