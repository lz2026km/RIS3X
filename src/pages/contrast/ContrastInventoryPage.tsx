/**
 * G005 v3.0.6.11-75 W3-1 - 造影剂库存管理页
 * deviceMgmtApi.getContrastInventory 真实数据 + 入库/出库 + 低库存/过期告警 + loading/error
 */
import dayjs from 'dayjs'
import { deviceMgmtApi, type ContrastInventory } from '../../services/api/deviceMgmtApi'
import { t } from '../../i18n/appI18n'
import {
  Card, Table, Tag, Space, Typography, Row, Col, Statistic, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Alert, Spin, Empty, message,
} from 'antd'
import { Package, Plus, MinusCircle, Archive, Search, RefreshCw, PackagePlus } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'

const { Text } = Typography

interface StockLog {
  id: string
  name: string
  action: 'in' | 'out'
  quantity: number
  operator: string
  at: string
}

const LOW_THRESHOLD = 10

const ContrastInventoryPage: React.FC = () => {
  const [inventory, setInventory] = useState<ContrastInventory[]>([])
  const [logs, setLogs] = useState<StockLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [logOpen, setLogOpen] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveForm] = Form.useForm()
  const [adjustTarget, setAdjustTarget] = useState<ContrastInventory | null>(null)
  const [adjustForm] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const normalize = (data: unknown): ContrastInventory[] => {
    if (Array.isArray(data)) return data
    if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
      return (data as { items: ContrastInventory[] }).items
    }
    return []
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await deviceMgmtApi.getContrastInventory()
      if (res.success) setInventory(normalize(res.data))
      else setError(res.error?.message ?? t('contrastInv.loadFailed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('contrastInv.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const appendLog = (name: string, action: 'in' | 'out', quantity: number) => {
    setLogs((prev) => [{ id: `LOG-${Date.now()}`, name, action, quantity, operator: '当前用户', at: new Date().toLocaleString('zh-CN', { hour12: false }) }, ...prev].slice(0, 100))
  }

  const handleAdjust = async (action: 'in' | 'out') => {
    if (!adjustTarget) return
    let values: { quantity: number }
    try {
      values = await adjustForm.validateFields()
    } catch {
      return
    }
    const delta = action === 'in' ? values.quantity : -values.quantity
    const next = Math.max(0, (adjustTarget.quantity ?? 0) + delta)
    setSubmitting(true)
    try {
      const res = await deviceMgmtApi.updateContrastInventory(adjustTarget.id, {
        quantity: next,
        batchNo: adjustTarget.batchNo,
        expiryDate: adjustTarget.expiryDate,
        location: adjustTarget.location,
      })
      if (res.success) {
        message.success(`${action === 'in' ? '入库' : '出库'}成功: ${adjustTarget.name} → 余量 ${next}`)
        appendLog(adjustTarget.name, action, values.quantity)
        setAdjustTarget(null)
        adjustForm.resetFields()
        void load()
      } else {
        message.error(res.error?.message ?? t('contrastInv.opFailed'))
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('contrastInv.opFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReceive = async () => {
    let values: { itemId: string; quantity: number; batchNo?: string; expiryDate?: dayjs.Dayjs; location?: string }
    try {
      values = await receiveForm.validateFields()
    } catch {
      return
    }
    const target = inventory.find((i) => i.id === values.itemId)
    if (!target) {
      message.error(t('contrastInv.batchNotFound'))
      return
    }
    setSubmitting(true)
    try {
      const res = await deviceMgmtApi.updateContrastInventory(target.id, {
        quantity: (target.quantity ?? 0) + values.quantity,
        batchNo: values.batchNo ?? target.batchNo,
        expiryDate: values.expiryDate?.format('YYYY-MM-DD') ?? target.expiryDate,
        location: values.location ?? target.location,
      })
      if (res.success) {
        message.success(`入库登记成功: ${target.name} +${values.quantity}`)
        appendLog(target.name, 'in', values.quantity)
        setReceiveOpen(false)
        receiveForm.resetFields()
        void load()
      } else {
        message.error(res.error?.message ?? t('contrastInv.stockInFailed'))
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('contrastInv.stockInFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = inventory.filter((i) => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return `${i.name ?? ''} ${i.batchNo ?? ''} ${i.location ?? ''}`.toLowerCase().includes(q)
  })

  const lowItems = inventory.filter((i) => (i.quantity ?? 0) <= LOW_THRESHOLD)
  const expiredItems = inventory.filter((i) => i.expiryDate && new Date(i.expiryDate).getTime() < Date.now())
  const totalQty = inventory.reduce((s, i) => s + (i.quantity ?? 0), 0)

  const columns = [
    { title: t('contrastInv.colName'), dataIndex: 'name', key: 'name', width: 180, render: (v: string) => <Space><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />{v}</Space> },
    { title: t('contrastInv.colBatchNo'), dataIndex: 'batchNo', key: 'batchNo', width: 130, render: (v?: string) => v ? <Text code>{v}</Text> : '-' },
    { title: t('contrastInv.colRemaining'), dataIndex: 'quantity', key: 'quantity', width: 100,       render: (v: number) => (
        <Tag color={v <= LOW_THRESHOLD ? 'red' : 'green'} style={{ fontWeight: 600 }}>{v} ml</Tag>
      ) },
    { title: t('contrastInv.colExpiry'), dataIndex: 'expiryDate', key: 'expiryDate', width: 110, render: (v?: string) => {
        if (!v) return '-'
        const expired = new Date(v).getTime() < Date.now()
        return <span style={{ color: expired ? '#ff4d4f' : undefined, fontSize: 12 }}>{v} {expired && <Tag color="error">{t('contrastInv.expired')}</Tag>}</span>
      } },
    { title: t('contrastInv.colLocation'), dataIndex: 'location', key: 'location', width: 110, render: (v?: string) => v ?? '-' },
    {
      title: t('contrastInv.colActions'), key: 'actions', width: 170,
      render: (_: unknown, r: ContrastInventory) => (
        <Space size={4}>
          <Button size="small" icon={<Plus size={12} />} onClick={() => { setAdjustTarget(r); adjustForm.setFieldsValue({ quantity: 1 }) }}>{t('contrastInv.in')}</Button>
          <Button size="small" danger icon={<MinusCircle size={12} />} onClick={() => { setAdjustTarget(r); adjustForm.setFieldsValue({ quantity: 1 }) }}
            disabled={(r.quantity ?? 0) <= 0}>{t('contrastInv.out')}</Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <Card size="small" style={{ marginBottom: 16, background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <Package size={20} color="#fff" />
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{t('contrastInv.title')}</div>
              <div style={{ fontSize: 12, color: '#bfdbfe' }}>{t('contrastInv.subtitle')}</div>
            </div>
          </Space>
          <Space wrap>
            <Button size="small" icon={<Archive size={12} />} onClick={() => setLogOpen(true)}>{t('contrastInv.stockLog')}</Button>
            <Button size="small" type="primary" ghost icon={<PackagePlus size={12} />} onClick={() => setReceiveOpen(true)}>{t('contrastInv.receive')}</Button>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.12)' }}>{t('contrastInv.refresh')}</Button>
          </Space>
        </div>
      </Card>

      {error && (
        <Alert type="error" showIcon message={t('contrastInv.loadFailedTitle')} description={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('contrastInv.retry')}</Button>} />
      )}

      {(lowItems.length > 0 || expiredItems.length > 0) && !error && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message={`库存告警: ${lowItems.length} 项库存不足, ${expiredItems.length} 项已过期`}
          description={`低于阈值 (≤${LOW_THRESHOLD}ml) 的批次: ${lowItems.map((i) => i.name).join('、') || '无'}`}
        />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title={t('contrastInv.statBatches')} value={inventory.length} prefix={<Package size={14} />} loading={loading} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('contrastInv.statTotalQty')} value={totalQty} suffix="ml" loading={loading} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('contrastInv.statLow')} value={lowItems.length} loading={loading} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('contrastInv.statExpired')} value={expiredItems.length} loading={loading} styles={{ content: { color: '#ff4d4f' } }} /></Card></Col>
      </Row>

      <Card
        size="small"
        title={t('contrastInv.listTitle')}
        extra={
          <Space>
            <Input
              prefix={<Search size={14} style={{ color: '#999' }} />}
              placeholder={t('contrastInv.searchPlaceholder')}
              style={{ width: 220 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{t('contrastInv.totalBatches', { n: filtered.length })}</Text>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : filtered.length === 0 ? (
          <Empty image={<AlertTriangle size={48} style={{opacity:0.4}}/>} description={error ? t('contrastInv.loadFailedShort') : t('contrastInv.empty')} />
        ) : (
          <Table rowKey="id" dataSource={filtered} columns={columns} pagination={false} size="small" scroll={{ x: 900 }} />
        )}
      </Card>

      <Modal title={`${adjustTarget ? adjustTarget.name : ''} - ${t('contrastInv.inOut')}`} open={!!adjustTarget}
        onCancel={() => setAdjustTarget(null)} footer={null} width={420}>
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message={`${t('contrastInv.currentRemaining')}: ${adjustTarget?.quantity ?? 0} ml`} />
        <Form form={adjustForm} layout="vertical" size="small">
          <Form.Item name="quantity" label={t('contrastInv.qtyLabel')} rules={[{ required: true, message: t('contrastInv.enterQty') }]}>
            <InputNumber min={1} max={9999} style={{ width: '100%' }} />
          </Form.Item>
          <Space>
            <Button type="primary" icon={<Plus size={12} />} loading={submitting} onClick={() => handleAdjust('in')}>{t('contrastInv.confirmIn')}</Button>
            <Button danger icon={<MinusCircle size={12} />} loading={submitting} onClick={() => handleAdjust('out')}>{t('contrastInv.confirmOut')}</Button>
          </Space>
        </Form>
      </Modal>

      <Modal title={t('contrastInv.receive')} open={receiveOpen} onCancel={() => setReceiveOpen(false)} onOk={handleReceive}
        okText={t('contrastInv.confirmIn')} confirmLoading={submitting} width={460}>
        <Form form={receiveForm} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item name="itemId" label={t('contrastInv.batchLabel')} rules={[{ required: true, message: t('contrastInv.selectBatch') }]}>
            <Select placeholder={t('contrastInv.selectBatchPlaceholder')} options={inventory.map((i) => ({ value: i.id, label: `${i.name}${i.batchNo ? ` (${i.batchNo})` : ''} · 余量 ${i.quantity}ml` }))} />
          </Form.Item>
          <Form.Item name="quantity" label={t('contrastInv.inQtyLabel')} initialValue={50} rules={[{ required: true, message: t('contrastInv.enterQty') }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="expiryDate" label={t('contrastInv.expiryUpdate')}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="location" label={t('contrastInv.locationUpdate')}>
                <Input placeholder={t('contrastInv.locationPlaceholder')} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal title={t('contrastInv.stockLog')} open={logOpen} onCancel={() => setLogOpen(false)} footer={null} width={560}>
        {logs.length === 0 ? (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('contrastInv.emptyLog')} />
        ) : (
          <Table scroll={{ x: 'max-content' }}
            rowKey="id" size="small" pagination={false}
            dataSource={logs}
            columns={[
              { title: t('contrastInv.colTime'), dataIndex: 'at', width: 160 },
              { title: t('contrastInv.colContrast'), dataIndex: 'name' },
              { title: t('contrastInv.colDirection'), dataIndex: 'action', width: 80, render: (v: string) => <Tag color={v === 'in' ? 'green' : 'red'}>{v === 'in' ? t('contrastInv.in') : t('contrastInv.out')}</Tag> },
              { title: t('contrastInv.colQty'), dataIndex: 'quantity', width: 100, render: (v: number, r: StockLog) => <span style={{ fontWeight: 600, color: r.action === 'in' ? '#16a34a' : '#dc2626' }}>{r.action === 'in' ? '+' : '-'}{v} ml</span> },
              { title: t('contrastInv.colOperator'), dataIndex: 'operator', width: 100 },
            ]}
         
          />
        )}
      </Modal>
    </div>
  )
}

export default ContrastInventoryPage
