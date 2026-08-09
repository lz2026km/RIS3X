/**
 * G005 RIS v3.0.6 - 危急值接收端门户
 * 路由 /critical-value-receiver
 * [W2-A] 接 GET /critical-ext/receiver (后端 criticalext.controller getReceiverPortal):
 * 展示待确认危急值通知, 支持 确认接收 (PATCH /criticals/:id state=ACKNOWLEDGED) 与 临床回执 (POST /criticals/:id/clinical-receipt)
 */
import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Tag, Button, Modal, Input, message, Spin, Alert, Statistic, Row, Col, Empty } from 'antd'
import { ShieldAlert, Bell, CheckCircle, FileCheck, RefreshCw, Inbox } from 'lucide-react'
import { criticalExtApi } from '../../services/api/criticalExtApi'
import { criticalApi } from '../../services/api/criticalApi'
import { invalidateApiCache } from '../../services/api/client'
import { usePagination } from '../../hooks/usePagination'

const { TextArea } = Input

interface ReceiverItem {
  id: string
  patientName?: string
  patientId?: string
  finding?: string
  severity?: string
  status?: string
  channel?: string
  triggeredAt?: string
  notifiedAt?: string
  receiverName?: string
  receiverDept?: string
  receiverPhone?: string
  content?: string
  [key: string]: unknown
}

export default function ReceiverPortalPage() {
  const [items, setItems] = useState<ReceiverItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [receiptItem, setReceiptItem] = useState<ReceiverItem | null>(null)
  const [receiptDoctor, setReceiptDoctor] = useState('')
  const [receiptComment, setReceiptComment] = useState('')
  const [acting, setActing] = useState(false)

  const loadData = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    return criticalExtApi.getReceiverPortal()
      .then((res) => {
        if (res.success) {
          const list = Array.isArray(res.data)
            ? (res.data as unknown[])
            : ((res.data as { items?: unknown[] } | null)?.items ?? [])
          setItems(list as ReceiverItem[])
          setLoadError(null)
        } else {
          setItems([])
          setLoadError(res.error?.message ?? '加载失败')
        }
      })
      .catch((err: Error) => {
        setItems([])
        setLoadError(err?.message ?? '网络错误')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    criticalExtApi.getReceiverPortal()
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          const list = Array.isArray(res.data)
            ? (res.data as unknown[])
            : ((res.data as { items?: unknown[] } | null)?.items ?? [])
          setItems(list as ReceiverItem[])
        } else {
          setLoadError(res.error?.message ?? '加载失败')
        }
      })
      .catch((err: Error) => { if (!cancelled) setLoadError(err?.message ?? '网络错误') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const refresh = async () => {
    await invalidateApiCache('/critical-ext/receiver')
    await loadData()
  }

  // 确认接收 → PATCH /criticals/:id state=ACKNOWLEDGED
  const handleAcknowledge = async (item: ReceiverItem) => {
    const id = item.id ?? item.criticalId
    if (!id) return
    setActing(true)
    try {
      const res = await criticalApi.acknowledge(String(id))
      if (res.success) {
        message.success(`已确认接收: ${item.patientName ?? id}`)
        await refresh()
      } else {
        message.error(res.error?.message ?? '确认失败')
      }
    } catch (err) {
      message.error((err as Error)?.message ?? '确认失败')
    }
    setActing(false)
  }

  // 临床回执 → POST /criticals/:id/clinical-receipt
  const openReceipt = (item: ReceiverItem) => {
    setReceiptItem(item)
    setReceiptDoctor('')
    setReceiptComment('')
  }

  const handleConfirmReceipt = async () => {
    const item = receiptItem
    const id = item?.id ?? item?.criticalId
    if (!id) return
    if (!receiptDoctor.trim()) { message.warning('请输入确认医生姓名'); return }
    setActing(true)
    try {
      const res = await criticalApi.clinicalReceipt(String(id), { confirmedBy: receiptDoctor.trim(), comment: receiptComment.trim() })
      if (res.success) {
        message.success('临床回执已提交')
        setReceiptItem(null)
        await refresh()
      } else {
        message.error(res.error?.message ?? '回执失败')
      }
    } catch (err) {
      message.error((err as Error)?.message ?? '回执失败')
    }
    setActing(false)
  }

  const columns = [
    {
      title: '患者',
      dataIndex: 'patientName',
      key: 'patientName',
      render: (v: string, r: ReceiverItem) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v ?? '未知患者'}</div>
          {r.patientId && <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.patientId}</div>}
        </div>
      ),
    },
    {
      title: '危急发现',
      dataIndex: 'finding',
      key: 'finding',
      render: (v: string) => (v ? <span style={{ fontWeight: 600, color: '#dc2626' }}>{v}</span> : '-'),
    },
    {
      title: '严重度',
      dataIndex: 'severity',
      key: 'severity',
      render: (v: string) => (
        <Tag color={String(v ?? '').includes('CRITICAL') || v === '危及生命' ? 'red' : String(v ?? '').includes('URGENT') || v === '危急' ? 'orange' : 'gold'}>{v ?? '-'}</Tag>
      ),
    },
    {
      title: '接收人',
      key: 'receiver',
      render: (_: unknown, r: ReceiverItem) => (
        <div>
          <div style={{ fontSize: 13 }}>{r.receiverName ?? '-'}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.receiverDept ?? ''}{r.receiverPhone ? ` · ${r.receiverPhone}` : ''}</div>
        </div>
      ),
    },
    {
      title: '触发时间',
      dataIndex: 'triggeredAt',
      key: 'triggeredAt',
      render: (v: string, r: ReceiverItem) => String(v ?? r.notifiedAt ?? r.createdAt ?? '-').replace('T', ' ').slice(0, 19),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => {
        const st = String(v ?? 'PENDING').toUpperCase()
        return <Tag color={st === 'PENDING' ? 'red' : st === 'ACKNOWLEDGED' ? 'blue' : st === 'RECEIPTED' ? 'green' : 'default'}>{v ?? 'PENDING'}</Tag>
      },
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, r: ReceiverItem) => {
        const st = String(r.status ?? 'PENDING').toUpperCase()
        return (
          <div style={{ display: 'flex', gap: 6 }}>
            {st !== 'ACKNOWLEDGED' && st !== 'RECEIPTED' && st !== 'RESOLVED' && (
              <Button size="small" type="primary" icon={<CheckCircle size={12} />} loading={acting} onClick={() => void handleAcknowledge(r)}>确认接收</Button>
            )}
            {(st === 'ACKNOWLEDGED' || st === 'RECEIPTED') && (
              <Button size="small" type="primary" icon={<FileCheck size={12} />} loading={acting} onClick={() => openReceipt(r)}>临床回执</Button>
            )}
            {st === 'RESOLVED' || st === 'CLOSED_LOOP' ? <Tag color="green">已完成</Tag> : null}
          </div>
        )
      },
    },
  ]

  const pendingCount = items.filter((i) => String(i.status ?? 'PENDING').toUpperCase() === 'PENDING').length
  // [W3-C] 受控分页: 危急值通知列表
  const listPagination = usePagination(items, 10)

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={22} style={{ color: '#dc2626' }} />
          <h1 style={{ fontSize: 20, margin: 0 }}>危急值接收端门户</h1>
          <Tag color="red">临床接收</Tag>
        </div>
        <Button icon={<RefreshCw size={14} />} onClick={() => void refresh()} loading={loading}>刷新</Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small"><Statistic title="待确认通知" value={pendingCount} valueStyle={{ color: '#dc2626' }} prefix={<Bell size={14} />} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="今日通知" value={items.length} prefix={<ShieldAlert size={14} />} /></Card>
        </Col>
        <Col span={12}>
          <Card size="small">
            <div style={{ fontSize: 12, color: '#64748b' }}>
              接收端门户数据来源: GET /critical-ext/receiver (后端 criticalValueNotification status=PENDING),确认接收与临床回执直接写入危急值记录。
            </div>
          </Card>
        </Col>
      </Row>

      {loadError && <Alert type="error" showIcon message={loadError} style={{ marginBottom: 16 }} />}

      <Card title="待接收危急值列表">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : items.length === 0 ? (
          <Empty description={loadError ? '加载失败' : '暂无待接收的危急值通知'} image={<Inbox size={48} color="#94a3b8" />} />
        ) : (
          <Table dataSource={listPagination.pageData} columns={columns} rowKey={(r) => String(r.id ?? r.criticalId ?? '')} size="small" pagination={listPagination.pagination} scroll={{ x: 'max-content' }}/>
        )}
      </Card>

      {/* 临床回执 Modal */}
      <Modal
        title="临床回执"
        open={!!receiptItem}
        onOk={() => void handleConfirmReceipt()}
        onCancel={() => setReceiptItem(null)}
        confirmLoading={acting}
        okText="提交回执"
        cancelText="取消"
      >
        {receiptItem && (
          <div>
            <div style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--color-error-bg)', borderRadius: 8, border: '1px solid var(--color-error-border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{receiptItem.patientName ?? '未知患者'} · {receiptItem.finding ?? '危急值'}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{receiptItem.id ?? ''}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>确认医生 *</div>
              <Input value={receiptDoctor} onChange={(e) => setReceiptDoctor(e.target.value)} placeholder="请输入确认医生姓名" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>临床意见/备注</div>
              <TextArea rows={3} value={receiptComment} onChange={(e) => setReceiptComment(e.target.value)} placeholder="请输入临床处理意见" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
