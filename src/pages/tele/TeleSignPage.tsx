import React, { useState, useRef } from 'react'
import { Card, Table, Button, Tag, Space, Modal, Input, Typography, message } from 'antd'
import { FileSignature, CheckCircle, XCircle, Pen, Eye } from 'lucide-react'

const { Text, Title } = Typography
const { TextArea } = Input

interface SignSession {
  id: string
  reportId: string
  reportTitle: string
  patientName: string
  signerName: string
  status: 'pending' | 'approved' | 'rejected'
  signatureData?: string
  comment?: string
  createdAt: string
}

const initSessions: SignSession[] = [
  { id: 'ts-001', reportId: 'RPT001', reportTitle: 'Chest CT Report', patientName: 'Zhang San', signerName: 'Dr. Wang', status: 'pending', createdAt: '2026-07-11T10:00:00Z' },
  { id: 'ts-002', reportId: 'RPT002', reportTitle: 'Brain MRI Report', patientName: 'Li Si', signerName: 'Dr. Li', status: 'approved', signatureData: 'data:image/png;base64,sig', createdAt: '2026-07-10T14:00:00Z' },
  { id: 'ts-003', reportId: 'RPT003', reportTitle: 'Chest X-Ray Report', patientName: 'Wang Wu', signerName: 'Dr. Zhang', status: 'rejected', comment: '需要补充影像学描述', createdAt: '2026-07-09T09:00:00Z' },
]

const TeleSignPage: React.FC = () => {
  const [sessions, setSessions] = useState<SignSession[]>(initSessions)
  const [signOpen, setSignOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<SignSession | null>(null)
  const [comment, setComment] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    setIsDrawing(true)
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  const stopDrawing = () => setIsDrawing(false)

  const handleApprove = () => {
    if (!selectedSession) return
    const canvas = canvasRef.current
    const signatureData = canvas ? canvas.toDataURL() : ''
    setSessions(prev => prev.map(s => s.id === selectedSession.id ? { ...s, status: 'approved', signatureData, comment } : s))
    setSignOpen(false)
    setComment('')
    message.success('远程批准成功')
  }

  const handleReject = () => {
    if (!selectedSession || !comment) { message.warning('请输入拒绝原因'); return }
    setSessions(prev => prev.map(s => s.id === selectedSession.id ? { ...s, status: 'rejected', comment } : s))
    setSignOpen(false)
    setComment('')
    message.success('已拒绝')
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const columns = [
    { title: '报告ID', dataIndex: 'reportId', key: 'reportId' },
    { title: '报告标题', dataIndex: 'reportTitle', key: 'reportTitle' },
    { title: '患者', dataIndex: 'patientName', key: 'patientName' },
    { title: '签署人', dataIndex: 'signerName', key: 'signerName' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'approved' ? 'green' : s === 'rejected' ? 'red' : 'orange'}>{s === 'approved' ? '已批准' : s === 'rejected' ? '已拒绝' : '待签署'}</Tag> },
    { title: '操作', key: 'action', render: (_: unknown, r: SignSession) => (
      <Space>
        <Button size="small" icon={<Eye size={14} />} onClick={() => { setSelectedSession(r); setPreviewOpen(true) }}>预览</Button>
        {r.status === 'pending' && <Button size="small" type="primary" icon={<Pen size={14} />} onClick={() => { setSelectedSession(r); setSignOpen(true) }}>签署</Button>}
      </Space>
    )},
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <FileSignature size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>远程双签</span>
      </Space>
      <Card>
        <Table rowKey="id" dataSource={sessions} columns={columns} pagination={false} size="small" />
      </Card>
      <Modal title="签署报告" open={signOpen} onCancel={() => setSignOpen(false)} width={600} footer={
        <Space>
          <Button onClick={clearCanvas}>清除签名</Button>
          <Button icon={<XCircle size={14} />} danger onClick={handleReject}>拒绝</Button>
          <Button type="primary" icon={<CheckCircle size={14} />} onClick={handleApprove}>批准签署</Button>
        </Space>
      }>
        <Card size="small" title={selectedSession?.reportTitle} style={{ marginBottom: 16 }}>
          <Text>患者: {selectedSession?.patientName}</Text><br />
          <Text>签署人: {selectedSession?.signerName}</Text>
        </Card>
        <Text strong>签名板:</Text>
        <div style={{ border: '1px solid #d9d9d9', borderRadius: 4, marginTop: 8, marginBottom: 16 }}>
          <canvas ref={canvasRef} width={500} height={150} style={{ width: '100%', height: 150, cursor: 'crosshair' }} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} />
        </div>
        <TextArea placeholder="备注（选填）" rows={2} value={comment} onChange={e => setComment(e.target.value)} />
      </Modal>
      <Modal title={`报告预览 - ${selectedSession?.reportTitle}`} open={previewOpen} onCancel={() => setPreviewOpen(false)} width={600}>
        <Card>
          <Text strong>报告ID: </Text><Text>{selectedSession?.reportId}</Text><br />
          <Text strong>患者: </Text><Text>{selectedSession?.patientName}</Text><br />
          <Text strong>签署人: </Text><Text>{selectedSession?.signerName}</Text><br />
          <Text strong>状态: </Text><Tag color={selectedSession?.status === 'approved' ? 'green' : selectedSession?.status === 'rejected' ? 'red' : 'orange'}>{selectedSession?.status === 'approved' ? '已批准' : selectedSession?.status === 'rejected' ? '已拒绝' : '待签署'}</Tag><br />
          {selectedSession?.comment && <><Text strong>备注: </Text><Text>{selectedSession.comment}</Text></>}
          {selectedSession?.signatureData && <div style={{ marginTop: 16 }}><Text strong>签名:</Text><img src={selectedSession.signatureData} alt="signature" loading="lazy" decoding="async" style={{ maxWidth: 200, border: '1px solid #eee', marginTop: 8 }} /></div>}
        </Card>
      </Modal>
    </div>
  )
}

export default TeleSignPage
