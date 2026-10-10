import { teleSignApi, type TeleSignSession } from '../../services/api/teleSignApi'
import {
  Card,
  Button,
  Tag,
  Space,
  Modal,
  Input,
  Typography,
  message,
  Alert,
  Form,
} from "antd";
import { FileSignature, CheckCircle, XCircle, Pen, Eye, Plus } from 'lucide-react'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { usePagination } from '../../hooks/usePagination'
import { t } from '../../i18n/appI18n'
import { PageContainer } from "../../components/common";

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
  const [signSaving, setSignSaving] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  // [W1-B] 发起签署会话: teleSignApi.createSession (POST /tele-sign/session)
  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createForm] = Form.useForm()
  const { pageData: pagedSessions, pagination: sessionsPagination } = usePagination(sessions)

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
        message.error((res.error as { message?: string })?.message || t('teleSign.createFail'))
      }
    } catch (e: any) {
      if (e?.errorFields) return
      message.error((e as Error)?.message || t('teleSign.createFail'))
    } finally {
      setCreateSaving(false)
    }
  }

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await teleSignApi.listSessions()
      if (!res.success) throw new Error((res.error as { message?: string })?.message || t('teleSign.sessionLoadFail'))
      setSessions(res.data)
    } catch (e) {
      setError((e as Error)?.message || t('teleSign.loadFail'))
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
    setSignSaving(true)
    try {
      const canvas = canvasRef.current
      const signatureData = canvas ? canvas.toDataURL() : ''
      const res = await teleSignApi.approve(selectedSession.id, signatureData, comment || undefined)
      if (!res.success) {
        message.error((res.error as { message?: string })?.message || t('teleSign.approveFail'))
        return
      }
      setSessions(prev => prev.map(s => s.id === selectedSession.id ? { ...s, ...res.data } : s))
      setSignOpen(false)
      setComment('')
      message.success(t('teleSign.approveSuccess'))
    } finally {
      setSignSaving(false)
    }
  }

  const handleReject = async () => {
    if (!selectedSession || !comment) { message.warning(t('teleSign.rejectReason')); return }
    setSignSaving(true)
    try {
      const res = await teleSignApi.reject(selectedSession.id, comment)
      if (!res.success) {
        message.error((res.error as { message?: string })?.message || t('teleSign.rejectFail'))
        return
      }
      setSessions(prev => prev.map(s => s.id === selectedSession.id ? { ...s, ...res.data } : s))
      setSignOpen(false)
      setComment('')
      message.success(t('teleSign.rejected'))
    } finally {
      setSignSaving(false)
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const columns = [
    { title: t('teleSign.col.reportId'), dataIndex: 'reportId', key: 'reportId' },
    { title: t('teleSign.col.reportTitle'), dataIndex: 'reportTitle', key: 'reportTitle' },
    { title: t('teleSign.col.patient'), dataIndex: 'patientName', key: 'patientName' },
    { title: t('teleSign.col.signer'), dataIndex: 'signerName', key: 'signerName' },
    { title: t('teleSign.col.status'), dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'approved' ? 'green' : s === 'rejected' ? 'red' : 'orange'}>{s === 'approved' ? t('teleSign.status.approved') : s === 'rejected' ? t('teleSign.status.rejected') : t('teleSign.status.pending')}</Tag> },
    { title: t('teleSign.col.createdAt'), dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: t('teleSign.col.action'), key: 'action', render: (_: unknown, r: TeleSignSession) => (
      <Space>
        <Button size="small" icon={<Eye size={14} />} onClick={() => { setSelectedSession(r); setPreviewOpen(true) }}>{t('teleSign.preview')}</Button>
        {r.status === 'pending' && <Button size="small" type="primary" icon={<Pen size={14} />} onClick={() => { setSelectedSession(r); setSignOpen(true) }}>{t('teleSign.sign')}</Button>}
      </Space>
    )},
  ]

  return (
    <PageContainer maxWidth="full" padding="var(--space-6, 24px)">
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <FileSignature size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('teleSign.title')}</span>
        <Button type="primary" size="small" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>{t('teleSign.createSession')}</Button>
      </Space>
      {error && <Alert type="warning" showIcon message={t('teleSign.loadFail')} description={error} action={<Button size="small" onClick={fetchSessions}><RefreshCw size={14} /> {t('teleSign.retry')}</Button>} style={{ marginBottom: 'var(--space-4, 16px)' }} />}
      <Card>
        <DataTable rowKey="id" dataSource={pagedSessions} columns={columns} pagination={sessionsPagination} loading={loading} scroll={{ x: 'max-content' }}/>
      </Card>
      <Modal title={t('teleSign.signReport')} open={signOpen} onCancel={() => setSignOpen(false)} width={560} footer={
        <Space>
          <Button onClick={clearCanvas}>{t('teleSign.clearSignature')}</Button>
          <Button icon={<XCircle size={14} />} danger loading={signSaving} disabled={signSaving} onClick={handleReject}>{t('teleSign.reject')}</Button>
          <Button type="primary" icon={<CheckCircle size={14} />} loading={signSaving} disabled={signSaving} onClick={handleApprove}>{t('teleSign.approve')}</Button>
        </Space>
      }>
        <Card size="small" title={selectedSession?.reportTitle} style={{ marginBottom: 'var(--space-4, 16px)' }}>
          <Text>{t('teleSign.patientStrong')} {selectedSession?.patientName}</Text><br />
          <Text>{t('teleSign.signerStrong')} {selectedSession?.signerName}</Text>
        </Card>
        <Text strong>{t('teleSign.signatureBoard')}</Text>
        <div style={{ border: '1px solid #d9d9d9', borderRadius: 4, marginTop: 'var(--space-2, 8px)', marginBottom: 'var(--space-4, 16px)' }}>
          <canvas ref={canvasRef} width={500} height={150} style={{ width: '100%', height: 150, cursor: 'crosshair' }} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} />
        </div>
        <TextArea placeholder={t('teleSign.remarkPlaceholder')} rows={2} value={comment} onChange={e => setComment(e.target.value)} />
      </Modal>
      <Modal title={`报告预览 - ${selectedSession?.reportTitle}`} open={previewOpen} onCancel={() => setPreviewOpen(false)} width={560}>
        <Card>
          <Text strong>{t('teleSign.col.reportId')}: </Text><Text>{selectedSession?.reportId}</Text><br />
          <Text strong>{t('teleSign.col.patient')}: </Text><Text>{selectedSession?.patientName}</Text><br />
          <Text strong>{t('teleSign.col.signer')}: </Text><Text>{selectedSession?.signerName}</Text><br />
          <Text strong>{t('teleSign.col.status')}: </Text><Tag color={selectedSession?.status === 'approved' ? 'green' : selectedSession?.status === 'rejected' ? 'red' : 'orange'}>{selectedSession?.status === 'approved' ? t('teleSign.status.approved') : selectedSession?.status === 'rejected' ? t('teleSign.status.rejected') : t('teleSign.status.pending')}</Tag><br />
          {selectedSession?.comment && <><Text strong>{t('teleSign.remarkStrong')} </Text><Text>{selectedSession.comment}</Text></>}
          {selectedSession?.signatureData && <div style={{ marginTop: 'var(--space-4, 16px)' }}><Text strong>{t('teleSign.signatureStrong')}</Text><img src={selectedSession.signatureData} alt="signature" loading="lazy" decoding="async" style={{ maxWidth: 200, border: '1px solid #eee', marginTop: 'var(--space-2, 8px)' }} /></div>}
        </Card>
      </Modal>

      {/* [W1-B] 发起签署会话: POST /tele-sign/session */}
      <Modal title={t('teleSign.createSessionTitle')} open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => void handleCreateSession()} confirmLoading={createSaving} width={420}>
        <Form form={createForm} layout="vertical" size="small" style={{ marginTop: 'var(--space-3, 12px)' }}>
          <Form.Item label={t('teleSign.col.reportId')} name="reportId" rules={[{ required: true, message: t('teleSign.validate.reportId') }]}>
            <Input placeholder={t('teleSign.ph.reportId')} />
          </Form.Item>
          <Form.Item label={t('teleSign.col.reportTitle')} name="reportTitle" rules={[{ required: true, message: t('teleSign.validate.reportTitle') }]}>
            <Input placeholder={t('teleSign.ph.reportTitle')} />
          </Form.Item>
          <Form.Item label={t('teleSign.form.patientName')} name="patientName" rules={[{ required: true, message: t('teleSign.validate.patientName') }]}>
            <Input placeholder={t('teleSign.ph.patientName')} />
          </Form.Item>
          <Form.Item label={t('teleSign.form.signerId')} name="signerId" rules={[{ required: true, message: t('teleSign.validate.signerId') }]}>
            <Input placeholder={t('teleSign.ph.signerId')} />
          </Form.Item>
          <Form.Item label={t('teleSign.form.signerName')} name="signerName" rules={[{ required: true, message: t('teleSign.validate.signerName') }]}>
            <Input placeholder={t('teleSign.ph.signerName')} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  )
}

export default TeleSignPage

import { DataTable } from "../../components/common";