/**
 * G005 v3.0.6.11-75 W3-1 - DICOM 影像共享页
 * shareApi 真实数据: 共享记录列表 + 创建共享(选检查+有效期+密码) + 链接复制 + loading/error
 */
import dayjs from 'dayjs'
import { shareApi, type ShareRecord, type ShareStats } from '../../services/api/shareApi'
import {
  Card, Space, Tag, Button, Select, message, Modal, Form, Input, DatePicker, Spin, Alert, Popconfirm, Descriptions,
} from 'antd'
import { Share2, Send, Download, Link2, Trash2, Eye } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { PageHeader } from '../../components/common/PageHeader'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'
import { EmptyState } from '../../components/common/EmptyState'
import { AppText } from '../../components/common/AppText'
import { VirtualTable } from '../../components/common/VirtualTable'
import { t } from '../../i18n/appI18n'
import { PageContainer } from '../../components/common'

const STATUS_META: Record<string, { color: string; label: string }> = {
  sent: { color: 'blue', label: 'sent' },
  received: { color: 'success', label: 'received' },
  pending: { color: 'warning', label: 'pending' },
  expired: { color: 'default', label: 'expired' },
  failed: { color: 'error', label: 'failed' },
}

const shareStatusLabel = (s: string): string => {
  switch (s) {
    case 'sent': return t('dicomShare.status.sent')
    case 'received': return t('dicomShare.status.received')
    case 'pending': return t('dicomShare.status.pending')
    case 'expired': return t('dicomShare.status.expired')
    case 'failed': return t('dicomShare.status.failed')
    default: return s
  }
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
  // [W1-B] 详情: shareApi.get (GET /dicom-share/shares/:id)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailShare, setDetailShare] = useState<ShareRecord | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const handleViewDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailShare(null)
    try {
      const res = await shareApi.get(id)
      if (res.success && res.data) setDetailShare(res.data)
      else message.error(res.error?.message ?? t('dicomShare.detailLoadFailed'))
    } catch {
      message.error(t('dicomShare.detailLoadFailed'))
    } finally {
      setDetailLoading(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [listRes, statsRes] = await Promise.all([shareApi.list(), shareApi.getStats()])
      if (listRes.success && Array.isArray(listRes.data)) setShares(listRes.data)
      else setError(listRes.error?.message ?? t('dicomShare.recordsLoadFailed'))
      if (statsRes.success && statsRes.data) setStats(statsRes.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dicomShare.recordsLoadFailed'))
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
        message.error(res.error?.message ?? t('dicomShare.createFailed'))
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('dicomShare.createFailed'))
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
        message.success(t('dicomShare.linkCopied'))
      } catch {
        message.info(`共享链接: ${url}${res.data.password ? ` 密码: ${res.data.password}` : ''}`)
      }
    } else {
      message.error(res.error?.message ?? t('dicomShare.genLinkFailed'))
    }
  }

  const handleDelete = async (id: string) => {
    const res = await shareApi.remove(id)
    if (res.success) {
      message.success(t('dicomShare.recordDeleted'))
      void load()
    } else {
      message.error(res.error?.message ?? t('dicomShare.deleteFailed'))
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
    { title: t('dicomShare.colNo'), dataIndex: 'id', key: 'id', width: 100, render: (v: string) => <AppText size="xs" as="span" style={{ fontFamily: 'monospace' }}>{v}</AppText> },
    { title: t('dicomShare.colStudy'), dataIndex: 'studyId', key: 'studyId', width: 150, ellipsis: true },
    { title: t('dicomShare.colPatient'), dataIndex: 'patientName', key: 'patient', width: 90 },
    { title: t('dicomShare.colFrom'), dataIndex: 'fromDept', key: 'from', width: 90, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: t('dicomShare.colTo'), dataIndex: 'toDept', key: 'to', width: 110, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: t('dicomShare.colProtocol'), dataIndex: 'protocol', key: 'protocol', width: 100, render: (v: string) => <Tag color={v === 'dicom-tls' ? 'cyan' : 'geekblue'}>{v === 'dicom-tls' ? 'DICOM TLS' : 'WADO'}</Tag> },
    { title: t('dicomShare.colSize'), dataIndex: 'sizeMb', key: 'size', width: 80, render: (v: number) => `${v ?? 0}MB` },
    { title: t('dicomShare.colStatus'), dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={STATUS_META[v]?.color}>{shareStatusLabel(v)}</Tag> },
    { title: t('dicomShare.colExpiresAt'), dataIndex: 'expiresAt', key: 'expiresAt', width: 110, render: (v: string) => <span style={{ color: new Date(v).getTime() < Date.now() ? '#ff4d4f' : undefined, fontSize: 12 }}>{v ?? '-'}</span> },
    { title: t('dicomShare.colCreatedAt'), dataIndex: 'createdAt', key: 'createdAt', width: 140 },
    {
      title: t('dicomShare.colActions'), key: 'actions', width: 190,
      render: (_: unknown, row: ShareRecord) => (
        <Space size={4}>
          <Button size="small" icon={<Eye size={12} />} onClick={() => void handleViewDetail(row.id)}>{t('dicomShare.detailBtn')}</Button>
          <Button size="small" type="primary" ghost icon={<Link2 size={12} />} onClick={() => handleCopyLink(row)}>{t('dicomShare.copyLink')}</Button>
          <Button size="small" icon={<Download size={12} />} onClick={() => handleDownload(row)}>{t('dicomShare.download')}</Button>
          <Popconfirm title={t('dicomShare.deleteConfirm')} onConfirm={() => handleDelete(row.id)}>
            <Button size="small" danger icon={<Trash2 size={12} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <PageContainer padding={24}>
      <PageHeader
        icon={<Share2 size={20} color="var(--color-primary-600)" />}
        title={t('dicomShare.pageTitle')}
        subtitle={t('dicomShare.pageSubtitle')}
        actions={
          <>
            <Tag color="cyan">v3.0.6.11-75</Tag>
            <Button type="primary" icon={<Send size={12} />} onClick={() => setShareModal(true)}>{t('dicomShare.createShare')}</Button>
          </>
        }
      />

      {error && (
        <Alert type="error" showIcon message={t('dicomShare.loadFailed')} description={error} style={{ marginBottom: 'var(--space-4, 16px)' }}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('dicomShare.retry')}</Button>} />
      )}

      <StatCardGrid minWidth={180} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('dicomShare.statTotal')} value={stats?.total ?? shares.length} icon={<Share2 size={16} />} color="primary" loading={loading} />
        <StatCard title={t('dicomShare.statPending')} value={stats?.pendingCount ?? 0} icon={<Eye size={16} />} color="warning" loading={loading} />
        <StatCard title={t('dicomShare.statReceived')} value={stats?.receivedCount ?? 0} icon={<Download size={16} />} color="success" loading={loading} />
        <StatCard title={t('dicomShare.statTotalSize')} value={stats?.totalSizeMb ?? 0} suffix="MB" icon={<Link2 size={16} />} color="info" loading={loading} />
      </StatCardGrid>

      <Card size="small" title={t('dicomShare.transferRecords')} extra={<Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()}>{t('dicomShare.refresh')}</Button>}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-12, 48px)' }}><Spin size="large" /></div>
        ) : (
          <VirtualTable<ShareRecord>
            columns={columns}
            dataSource={shares}
            rowKey="id"
            height={460}
            pageSize={10}
            width={1200}
            emptyText={<EmptyState description={t('dicomShare.noRecords')} />}
          />
        )}
      </Card>

      <Modal title={t('dicomShare.shareModalTitle')} open={shareModal} onCancel={() => setShareModal(false)} onOk={handleShareOk}
        okText={t('dicomShare.createShare')} confirmLoading={creating} width={480}>
        <Form form={shareForm} layout="vertical" size="small" style={{ marginTop: 'var(--space-3, 12px)' }}>
          <Form.Item name="studyId" label={t('dicomShare.colStudy')} rules={[{ required: true, message: t('dicomShare.selectStudyRequired') }]}>
            <Select options={STUDY_OPTIONS} placeholder={t('dicomShare.selectStudyPlaceholder')} />
          </Form.Item>
          <Form.Item name="toDept" label={t('dicomShare.targetDept')} rules={[{ required: true, message: t('dicomShare.selectDeptRequired') }]}>
            <Select mode="multiple"
              options={['口腔科', '口腔外科', '骨科', '眼科', '耳鼻喉科', '神经内科'].map((d) => ({ value: d, label: d }))} />
          </Form.Item>
          <Form.Item name="protocol" label={t('dicomShare.protocolLabel')} initialValue="dicom-tls" rules={[{ required: true }]}>
            <Select options={[{ value: 'dicom-tls', label: t('dicomShare.protocolTls') }, { value: 'wado', label: t('dicomShare.protocolWado') }]} />
          </Form.Item>
          <Form.Item name="expiresAt" label={t('dicomShare.validity')} initialValue={dayjs().add(30, 'day')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="password" label={t('dicomShare.passwordLabel')}>
            <Input.Password placeholder={t('dicomShare.passwordPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* [W1-B] 共享详情: GET /dicom-share/shares/:id */}
      <Modal title={`${t('dicomShare.detailTitle')} - ${detailShare?.id ?? ''}`} open={detailOpen} onCancel={() => setDetailOpen(false)} footer={<Button onClick={() => setDetailOpen(false)}>{t('dicomShare.close')}</Button>} width={560}>
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-10, 40px)' }}><Spin size="large" /></div>
        ) : detailShare ? (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label={t('dicomShare.colNo')} span={2}><AppText size="xs" as="span" style={{ fontFamily: 'monospace' }}>{detailShare.id}</AppText></Descriptions.Item>
            <Descriptions.Item label={t('dicomShare.colStudy')}>{detailShare.studyId}</Descriptions.Item>
            <Descriptions.Item label={t('dicomShare.colPatient')}>{detailShare.patientName}</Descriptions.Item>
            <Descriptions.Item label={t('dicomShare.fromDept')}>{detailShare.fromDept}</Descriptions.Item>
            <Descriptions.Item label={t('dicomShare.targetDept')}>{detailShare.toDept}</Descriptions.Item>
            <Descriptions.Item label={t('dicomShare.colProtocol')}><Tag color={detailShare.protocol === 'dicom-tls' ? 'cyan' : 'geekblue'}>{detailShare.protocol === 'dicom-tls' ? 'DICOM TLS' : 'WADO'}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('dicomShare.colStatus')}><Tag color={STATUS_META[detailShare.status]?.color}>{shareStatusLabel(detailShare.status)}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('dicomShare.colSize')}>{detailShare.sizeMb ?? 0} MB</Descriptions.Item>
            <Descriptions.Item label={t('dicomShare.colExpiresAt')}>{detailShare.expiresAt ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('dicomShare.accessPassword')}>{detailShare.password ? <AppText size="xs" as="span" style={{ fontFamily: 'monospace' }}>{detailShare.password}</AppText> : '-'}</Descriptions.Item>
            <Descriptions.Item label={t('dicomShare.link')} span={2}>{detailShare.url ? <AppText size="xs" as="span" style={{ cursor: 'pointer' }}>{detailShare.url}</AppText> : '-'}</Descriptions.Item>
            <Descriptions.Item label={t('dicomShare.colCreatedAt')} span={2}>{detailShare.createdAt}</Descriptions.Item>
          </Descriptions>
        ) : (
          <EmptyState description={t('dicomShare.noDetail')} />
        )}
      </Modal>
    </PageContainer>
  )
}

export default DicomSharePage
