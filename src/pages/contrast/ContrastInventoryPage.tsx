/**
 * G005 v3.0.6.11-75 W3-1 - 造影剂库存管理页
 * deviceMgmtApi.getContrastInventory 真实数据 + 入库/出库 + 低库存/过期告警 + loading/error
 */
import React, { useCallback, useEffect, useState } from 'react'
import {
  Card, Table, Tag, Space, Typography, Row, Col, Statistic, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Alert, Spin, Empty, message,
} from 'antd'
import { Package, Plus, MinusCircle, Archive, Search, RefreshCw, PackagePlus } from 'lucide-react'
import dayjs from 'dayjs'
import { deviceMgmtApi, type ContrastInventory } from '../../services/api/deviceMgmtApi'

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
      else setError(res.error?.message ?? '库存数据加载失败')
    } catch (e) {
      setError(e instanceof Error ? e.message : '库存数据加载失败')
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
        message.error(res.error?.message ?? '操作失败')
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败')
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
      message.error('未找到对比剂批次')
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
        message.error(res.error?.message ?? '入库失败')
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '入库失败')
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
    { title: '名称', dataIndex: 'name', key: 'name', width: 180, render: (v: string) => <Space><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />{v}</Space> },
    { title: '批次号', dataIndex: 'batchNo', key: 'batchNo', width: 130, render: (v?: string) => v ? <Text code>{v}</Text> : '-' },
    { title: '余量', dataIndex: 'quantity', key: 'quantity', width: 100,       render: (v: number) => (
        <Tag color={v <= LOW_THRESHOLD ? 'red' : 'green'} style={{ fontWeight: 600 }}>{v} ml</Tag>
      ) },
    { title: '有效期', dataIndex: 'expiryDate', key: 'expiryDate', width: 110, render: (v?: string) => {
        if (!v) return '-'
        const expired = new Date(v).getTime() < Date.now()
        return <span style={{ color: expired ? '#ff4d4f' : undefined, fontSize: 12 }}>{v} {expired && <Tag color="error">已过期</Tag>}</span>
      } },
    { title: '存放位置', dataIndex: 'location', key: 'location', width: 110, render: (v?: string) => v ?? '-' },
    {
      title: '操作', key: 'actions', width: 170,
      render: (_: unknown, r: ContrastInventory) => (
        <Space size={4}>
          <Button size="small" icon={<Plus size={12} />} onClick={() => { setAdjustTarget(r); adjustForm.setFieldsValue({ quantity: 1 }) }}>入库</Button>
          <Button size="small" danger icon={<MinusCircle size={12} />} onClick={() => { setAdjustTarget(r); adjustForm.setFieldsValue({ quantity: 1 }) }}
            disabled={(r.quantity ?? 0) <= 0}>出库</Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>
      <Card size="small" style={{ marginBottom: 16, background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <Package size={20} color="#fff" />
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>造影剂库存管理</div>
              <div style={{ fontSize: 12, color: '#bfdbfe' }}>device-mgmt/contrast/inventory · 实时库存</div>
            </div>
          </Space>
          <Space wrap>
            <Button size="small" icon={<Archive size={12} />} onClick={() => setLogOpen(true)}>出入库记录</Button>
            <Button size="small" type="primary" ghost icon={<PackagePlus size={12} />} onClick={() => setReceiveOpen(true)}>入库登记</Button>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.12)' }}>刷新</Button>
          </Space>
        </div>
      </Card>

      {error && (
        <Alert type="error" showIcon message="库存加载失败" description={error} style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => void load()}>重试</Button>} />
      )}

      {(lowItems.length > 0 || expiredItems.length > 0) && !error && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message={`库存告警: ${lowItems.length} 项库存不足, ${expiredItems.length} 项已过期`}
          description={`低于阈值 (≤${LOW_THRESHOLD}ml) 的批次: ${lowItems.map((i) => i.name).join('、') || '无'}`}
        />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="库存批次" value={inventory.length} prefix={<Package size={14} />} loading={loading} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="总余量" value={totalQty} suffix="ml" loading={loading} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="低库存" value={lowItems.length} loading={loading} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已过期" value={expiredItems.length} loading={loading} styles={{ content: { color: '#ff4d4f' } }} /></Card></Col>
      </Row>

      <Card
        size="small"
        title="库存列表"
        extra={
          <Space>
            <Input
              prefix={<Search size={14} style={{ color: '#999' }} />}
              placeholder="搜索名称/批次/位置"
              style={{ width: 220 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
            <Text type="secondary" style={{ fontSize: 12 }}>共 {filtered.length} 批次</Text>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : filtered.length === 0 ? (
          <Empty description={error ? '加载失败' : '暂无库存数据'} />
        ) : (
          <Table rowKey="id" dataSource={filtered} columns={columns} pagination={false} size="small" scroll={{ x: 900 }} />
        )}
      </Card>

      <Modal title={`${adjustTarget ? adjustTarget.name : ''} - 入库/出库`} open={!!adjustTarget}
        onCancel={() => setAdjustTarget(null)} footer={null} width={420}>
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message={`当前余量: ${adjustTarget?.quantity ?? 0} ml`} />
        <Form form={adjustForm} layout="vertical" size="small">
          <Form.Item name="quantity" label="数量 (ml)" rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber min={1} max={9999} style={{ width: '100%' }} />
          </Form.Item>
          <Space>
            <Button type="primary" icon={<Plus size={12} />} loading={submitting} onClick={() => handleAdjust('in')}>确认入库</Button>
            <Button danger icon={<MinusCircle size={12} />} loading={submitting} onClick={() => handleAdjust('out')}>确认出库</Button>
          </Space>
        </Form>
      </Modal>

      <Modal title="入库登记" open={receiveOpen} onCancel={() => setReceiveOpen(false)} onOk={handleReceive}
        okText="确认入库" confirmLoading={submitting} width={460}>
        <Form form={receiveForm} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item name="itemId" label="对比剂批次" rules={[{ required: true, message: '请选择批次' }]}>
            <Select placeholder="选择入库批次" options={inventory.map((i) => ({ value: i.id, label: `${i.name}${i.batchNo ? ` (${i.batchNo})` : ''} · 余量 ${i.quantity}ml` }))} />
          </Form.Item>
          <Form.Item name="quantity" label="入库数量 (ml)" initialValue={50} rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="expiryDate" label="有效期(更新)">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="location" label="存放位置(更新)">
                <Input placeholder="如: 药房 B-3" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal title="出入库记录" open={logOpen} onCancel={() => setLogOpen(false)} footer={null} width={560}>
        {logs.length === 0 ? (
          <Empty description="暂无出入库操作记录" />
        ) : (
          <Table
            rowKey="id" size="small" pagination={false}
            dataSource={logs}
            columns={[
              { title: '时间', dataIndex: 'at', width: 160 },
              { title: '对比剂', dataIndex: 'name' },
              { title: '方向', dataIndex: 'action', width: 80, render: (v: string) => <Tag color={v === 'in' ? 'green' : 'red'}>{v === 'in' ? '入库' : '出库'}</Tag> },
              { title: '数量', dataIndex: 'quantity', width: 100, render: (v: number, r: StockLog) => <span style={{ fontWeight: 600, color: r.action === 'in' ? '#16a34a' : '#dc2626' }}>{r.action === 'in' ? '+' : '-'}{v} ml</span> },
              { title: '操作人', dataIndex: 'operator', width: 100 },
            ]}
          scroll={{ x: 'max-content' }}
          />
        )}
      </Modal>
    </div>
  )
}

export default ContrastInventoryPage
