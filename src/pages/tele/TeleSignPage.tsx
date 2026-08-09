import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, Table, Button, Tag, Space, Modal, Input, Typography, message, Alert, Form } from 'antd'
import { FileSignature, CheckCircle, XCircle, Pen, Eye, Plus } from 'lucide-react'
import { teleSignApi, type TeleSignSession } from '../../services/api/teleSignApi'

const { Text } = Typography
const { TextArea } = Input

const TeleSignPage: React.FC = () => {
  const [sessions, setSessions] = useState<TeleSignSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signOpen, setSignOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<TeleSignSession | null>(null)
  const [comment, setComment] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  // [W1-B] 发起签署会话: teleSignApi.createSession (POST /tele-sign/session)
  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createForm] = Form.useForm()

  const handleCreateSession = async () => {
    try {
      const values = await createForm.validateFields()
      setCreateSaving(true)
      const res = await teleSignApi.createSession({
        reportId: values.reportId,
        reportTitle: values.reportTitle,
        patientName: values.patientName,
        signerId: values.signerId,
        signerName: values.signerName,
      })
      if (res.success) {
        message.success(`签署会话已发起: ${res.data.id}`)
        setCreateOpen(false)
        createForm.resetFields()
        void fetchSessions()
      } else {
        message.error((res.error as { message?: string })?.message || '发起失败')
      }
    } catch (e: any) {
      if (e?.errorFields) return
      message.error((e as Error)?.message || '发起失败')
    } finally {
      setCreateSaving(false)
    }
  }

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await teleSignApi.listSessions()
      if (!res.success) throw new Error((res.error as { message?: string })?.message || '签署会话加载失败')
      setSessions(res.data)
    } catch (e) {
      setError((e as Error)?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

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

  const handleApprove = async () => {
    if (!selectedSession) return
    const canvas = canvasRef.current
    const signatureData = canvas ? canvas.toDataURL() : ''
    const res = await teleSignApi.approve(selectedSession.id, signatureData, comment || undefined)
    if (!res.success) {
      message.error((res.error as { message?: string })?.message || '远程批准失败')
      return
    }
    setSessions(prev => prev.map(s => s.id === selectedSession.id ? { ...s, ...res.data } : s))
    setSignOpen(false)
    setComment('')
    message.success('远程批准成功')
  }

  const handleReject = async () => {
    if (!selectedSession || !comment) { message.warning('请输入拒绝原因'); return }
    const res = await teleSignApi.reject(selectedSession.id, comment)
    if (!res.success) {
      message.error((res.error as { message?: string })?.message || '拒绝失败')
      return
    }
    setSessions(prev => prev.map(s => s.id === selectedSession.id ? { ...s, ...res.data } : s))
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
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (t: string) => new Date(t).toLocaleString('zh-CN') },
    { title: '操作', key: 'action', render: (_: unknown, r: TeleSignSession) => (
      <Space>
        <Button size="small" icon={<Eye size={14} />} onClick={() => { setSelectedSession(r); setPreviewOpen(true) }}>预览</Button>
        {r.status === 'pending' && <Button size="small" type="primary" icon={<Pen size={14} />} onClick={() => { setSelectedSession(r); setSignOpen(true) }}>签署</Button>}
      </Space>
    )},
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <FileSignature size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>远程双签</span>
        <Button type="primary" size="small" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>发起签署会话</Button>
      </Space>
      {error && <Alert type="warning" showIcon message="加载失败" description={error} action={<Button size="small" onClick={fetchSessions}>重试</Button>} style={{ marginBottom: 16 }} />}
      <Card>
        <Table rowKey="id" dataSource={sessions} columns={columns} pagination={false} size="small" loading={loading} scroll={{ x: 'max-content' }}/>
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

      {/* [W1-B] 发起签署会话: POST /tele-sign/session */}
      <Modal title="发起签署会话 (POST /tele-sign/session)" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => void handleCreateSession()} confirmLoading={createSaving} width={480}>
        <Form form={createForm} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item label="报告ID" name="reportId" rules={[{ required: true, message: '请输入报告ID' }]}>
            <Input placeholder="如 R20260718-001" />
          </Form.Item>
          <Form.Item label="报告标题" name="reportTitle" rules={[{ required: true, message: '请输入报告标题' }]}>
            <Input placeholder="胸部CT平扫报告" />
          </Form.Item>
          <Form.Item label="患者姓名" name="patientName" rules={[{ required: true, message: '请输入患者姓名' }]}>
            <Input placeholder="患者姓名" />
          </Form.Item>
          <Form.Item label="签署人ID" name="signerId" rules={[{ required: true, message: '请输入签署人ID' }]}>
            <Input placeholder="如 D002" />
          </Form.Item>
          <Form.Item label="签署人姓名" name="signerName" rules={[{ required: true, message: '请输入签署人姓名' }]}>
            <Input placeholder="签署医师姓名" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default TeleSignPage
