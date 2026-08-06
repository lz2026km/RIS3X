/**
 * G005 v3.0.6.11-75 W3-1 - DICOM 影像共享页
 * shareApi 真实数据: 共享记录列表 + 创建共享(选检查+有效期+密码) + 链接复制 + loading/error
 */
import React, { useCallback, useEffect, useState } from 'react'
import {
  Card, Space, Tag, Button, Table, Select, Row, Col, Statistic, message, Modal, Form, Input, DatePicker, Spin, Alert, Empty, Popconfirm, Typography,
} from 'antd'
import { Share2, Send, Download, Link2, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import { shareApi, type ShareRecord, type ShareStats } from '../../services/api/shareApi'

const { Text } = Typography

const STATUS_META: Record<string, { color: string; label: string }> = {
  sent: { color: 'blue', label: '已发送' },
  received: { color: 'success', label: '已接收' },
  pending: { color: 'warning', label: '待处理' },
  expired: { color: 'default', label: '已过期' },
  failed: { color: 'error', label: '失败' },
}

const STUDY_OPTIONS = [
  { value: 'CBCT-20260725-01', label: 'ZW-36 CBCT · 张伟' },
  { value: 'CT-20260724-03', label: 'LN-Head CT · 李娜' },
  { value: 'OCT-20260723-07', label: 'WF-OCT · 王芳' },
  { value: 'MR-20260722-02', label: 'ZM-Knee MR · 赵敏' },
]

const DicomSharePage: React.FC = () => {
  const [shares, setShares] = useState<ShareRecord[]>([])
  const [stats, setStats] = useState<ShareStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [shareModal, setShareModal] = useState(false)
  const [shareForm] = Form.useForm()
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [listRes, statsRes] = await Promise.all([shareApi.list(), shareApi.getStats()])
      if (listRes.success && Array.isArray(listRes.data)) setShares(listRes.data)
      else setError(listRes.error?.message ?? '共享记录加载失败')
      if (statsRes.success && statsRes.data) setStats(statsRes.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '共享记录加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleShareOk = async () => {
    let values: { studyId: string; toDept: string; protocol: 'dicom-tls' | 'wado'; password?: string; expiresAt?: dayjs.Dayjs }
    try {
      values = await shareForm.validateFields()
    } catch {
      return
    }
    setCreating(true)
    try {
      const res = await shareApi.create({
        studyId: values.studyId,
        toDept: values.toDept,
        protocol: values.protocol,
        password: values.password,
        expiresAt: values.expiresAt?.format('YYYY-MM-DD'),
      })
      if (res.success) {
        message.success(`已创建共享: ${res.data.studyId} → ${res.data.toDept}`)
        setShareModal(false)
        shareForm.resetFields()
        void load()
      } else {
        message.error(res.error?.message ?? '创建共享失败')
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建共享失败')
    } finally {
      setCreating(false)
    }
  }

  const handleCopyLink = async (row: ShareRecord) => {
    const res = await shareApi.copyLink(row.id)
    if (res.success && res.data?.url) {
      const url = `${window.location.origin}${res.data.url}`
      try {
        await navigator.clipboard.writeText(res.data.password ? `${url}  密码: ${res.data.password}` : url)
        message.success('共享链接已复制(含有效期保护)')
      } catch {
        message.info(`共享链接: ${url}${res.data.password ? ` 密码: ${res.data.password}` : ''}`)
      }
    } else {
      message.error(res.error?.message ?? '生成链接失败')
    }
  }

  const handleDelete = async (id: string) => {
    const res = await shareApi.remove(id)
    if (res.success) {
      message.success('共享记录已删除')
      void load()
    } else {
      message.error(res.error?.message ?? '删除失败')
    }
  }

  const handleDownload = (row: ShareRecord) => {
    const blob = new Blob([JSON.stringify({ id: row.id, studyId: row.studyId, patientName: row.patientName, from: row.fromDept, to: row.toDept, status: row.status, createdAt: row.createdAt, sizeMb: row.sizeMb, expiresAt: row.expiresAt }, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${row.studyId}-share.json`
    a.click()
    URL.revokeObjectURL(url)
    message.success(`已下载共享记录: ${row.studyId}`)
  }

  const columns = [
    { title: '编号', dataIndex: 'id', key: 'id', width: 100, render: (v: string) => <Text code>{v}</Text> },
    { title: 'Study', dataIndex: 'studyId', key: 'studyId', width: 150, ellipsis: true },
    { title: '患者', dataIndex: 'patientName', key: 'patient', width: 90 },
    { title: '来源', dataIndex: 'fromDept', key: 'from', width: 90, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '去向', dataIndex: 'toDept', key: 'to', width: 110, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: '协议', dataIndex: 'protocol', key: 'protocol', width: 100, render: (v: string) => <Tag color={v === 'dicom-tls' ? 'cyan' : 'geekblue'}>{v === 'dicom-tls' ? 'DICOM TLS' : 'WADO'}</Tag> },
    { title: '大小', dataIndex: 'sizeMb', key: 'size', width: 80, render: (v: number) => `${v ?? 0}MB` },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag> },
    { title: '有效期至', dataIndex: 'expiresAt', key: 'expiresAt', width: 110, render: (v: string) => <span style={{ color: new Date(v).getTime() < Date.now() ? '#ff4d4f' : undefined, fontSize: 12 }}>{v ?? '-'}</span> },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 140 },
    {
      title: '操作', key: 'actions', width: 190,
      render: (_: unknown, row: ShareRecord) => (
        <Space size={4}>
          <Button size="small" type="primary" ghost icon={<Link2 size={12} />} onClick={() => handleCopyLink(row)}>复制链接</Button>
          <Button size="small" icon={<Download size={12} />} onClick={() => handleDownload(row)}>下载</Button>
          <Popconfirm title="删除共享记录?" onConfirm={() => handleDelete(row.id)}>
            <Button size="small" danger icon={<Trash2 size={12} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Share2 size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>DICOM 跨科室共享</span>
        <Tag color="cyan">v3.0.6.11-75</Tag>
        <Tag color="purple">DICOM TLS / WADO</Tag>
        <Button type="primary" icon={<Send size={12} />} onClick={() => setShareModal(true)}>创建共享</Button>
      </Space>

      {error && (
        <Alert type="error" showIcon message="加载失败" description={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => void load()}>重试</Button>} />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="共享总数" value={stats?.total ?? shares.length} prefix={<Share2 size={14} />} loading={loading} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="待处理" value={stats?.pendingCount ?? 0} loading={loading} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已接收" value={stats?.receivedCount ?? 0} loading={loading} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="传输总量" value={stats?.totalSizeMb ?? 0} suffix="MB" loading={loading} /></Card></Col>
      </Row>

      <Card size="small" title="传输记录" extra={<Button size="small" onClick={() => void load()}>刷新</Button>}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : shares.length === 0 ? (
          <Empty description="暂无共享记录" />
        ) : (
          <Table dataSource={shares} rowKey="id" columns={columns} pagination={{ pageSize: 10 }} size="small" scroll={{ x: 1200 }} />
        )}
      </Card>

      <Modal title="共享 DICOM 检查" open={shareModal} onCancel={() => setShareModal(false)} onOk={handleShareOk}
        okText="创建共享" confirmLoading={creating} width={480}>
        <Form form={shareForm} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item name="studyId" label="检查" rules={[{ required: true, message: '请选择检查' }]}>
            <Select options={STUDY_OPTIONS} placeholder="选择要共享的检查" />
          </Form.Item>
          <Form.Item name="toDept" label="目标科室" rules={[{ required: true, message: '请选择目标科室' }]}>
            <Select mode="multiple"
              options={['口腔科', '口腔外科', '骨科', '眼科', '耳鼻喉科', '神经内科'].map((d) => ({ value: d, label: d }))} />
          </Form.Item>
          <Form.Item name="protocol" label="传输协议" initialValue="dicom-tls" rules={[{ required: true }]}>
            <Select options={[{ value: 'dicom-tls', label: 'DICOM TLS(加密)' }, { value: 'wado', label: 'WADO(Web)' }]} />
          </Form.Item>
          <Form.Item name="expiresAt" label="有效期" initialValue={dayjs().add(30, 'day')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="password" label="访问密码(选填)">
            <Input.Password placeholder="设置密码后需密码才能访问链接" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DicomSharePage
