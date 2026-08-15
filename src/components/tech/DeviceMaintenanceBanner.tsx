/**
 * G005 v3.0.6.11-100 Wave 1B - 设备维护提醒横幅
 * 数据源: GET /devices/maintenance-due (剩余小时数, 周期默认 2000h)
 * 红/黄/绿状态 + 记录维护按钮 (POST /devices/:id/maintenance-log)
 */
import { Button, Form, Input, InputNumber, message, Modal, Radio, Spin } from 'antd'
import { AlertTriangle, CheckCircle2, RefreshCw, Wrench, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { deviceApi } from '../../services/api/deviceApi'

export interface DeviceMaintenanceBannerProps {
  deviceId?: string
  deviceName?: string
}

interface MaintenanceItem {
  deviceId: string
  deviceName: string
  usedHours: number
  remainingHours: number
  cycleHours: number
  status: string
  lastMaintenance: string | null
}

const STATUS_META: Record<string, { label: string; color: string; icon: ReactNode }> = {
  overdue: { label: '已超期', color: '#dc2626', icon: <XCircle size={14} /> },
  warning: { label: '即将到期', color: '#d97706', icon: <AlertTriangle size={14} /> },
  ok: { label: '状态正常', color: '#059669', icon: <CheckCircle2 size={14} /> },
  maintenance: { label: '维护中', color: '#2563eb', icon: <Wrench size={14} /> },
}

export default function DeviceMaintenanceBanner({ deviceId, deviceName }: DeviceMaintenanceBannerProps) {
  const [item, setItem] = useState<MaintenanceItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    if (!deviceId) return
    setLoading(true)
    try {
      const res = await deviceApi.getMaintenanceDue()
      if (res.success && Array.isArray((res.data as { items?: unknown[] } | null)?.items)) {
        const found = (res.data as { items: Array<{
          deviceId: string; code: string; name: string; usedHours: number; remainingHours: number;
          cycleHours: number; status: string; lastMaintenance: string | null
        }> }).items.find((d) => d.deviceId === deviceId)
        if (found) {
          setItem({ ...found, deviceId: found.deviceId, deviceName: found.name })
        } else {
          setItem(null)
        }
      }
    } catch {
      setItem(null)
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    void load()
  }, [load])

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => null)
    if (!values || !deviceId) return
    setSubmitting(true)
    try {
      const res = await deviceApi.logMaintenance(deviceId, {
        type: values.type,
        hoursUsed: Number(values.hoursUsed ?? 0),
        note: values.note ?? '',
      })
      if (res.success) {
        message.success(`设备 ${item?.deviceName ?? deviceName ?? ''} 维护已记录`)
        setModalOpen(false)
        form.resetFields()
        void load()
      } else {
        message.error(res.error?.message ?? '维护记录失败')
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '维护记录失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ marginBottom: 12 }}><Spin size="small" /> <span style={{ fontSize: 12, color: '#94a3b8' }}>维护信息加载中...</span></div>
  }
  if (!item) return null

  const meta = STATUS_META[item.status] ?? STATUS_META.ok!
  const warn = item.status === 'overdue' || item.status === 'warning'

  return (
    <>
      <div
        style={{
          marginBottom: 12,
          padding: '10px 14px',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          border: `1px solid ${warn ? meta.color : 'var(--border-color)'}`,
          background: warn ? (item.status === 'overdue' ? '#fef2f2' : '#fffbeb') : '#f0fdf4',
        }}
      >
        <span style={{ color: meta.color, display: 'inline-flex' }}>{meta.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
          设备 {item.deviceName ?? deviceName ?? ''}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>
          该设备距下次维护还剩 {item.remainingHours} 小时
        </span>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          ({meta.label} · 已用 {item.usedHours}h / 周期 {item.cycleHours}h · 上次维护 {item.lastMaintenance ? new Date(item.lastMaintenance).toLocaleDateString('zh-CN') : '未记录'})
        </span>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()}>刷新</Button>
        <Button size="small" type="primary" ghost icon={<Wrench size={12} />} onClick={() => setModalOpen(true)}>记录维护</Button>
      </div>

      <Modal
        title={`记录维护 - ${item.deviceName ?? deviceName ?? ''}`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSubmit()}
        okText={submitting ? '提交中...' : '提交'}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ type: 'preventive', hoursUsed: item.usedHours }}>
          <Form.Item name="type" label="维护类型" rules={[{ required: true }]}>
            <Radio.Group optionType="button" buttonStyle="solid" options={[
              { label: '预防性维护', value: 'preventive' },
              { label: '故障维修', value: 'corrective' },
            ]} />
          </Form.Item>
          <Form.Item name="hoursUsed" label="累计使用时长 (小时)" tooltip="本次维护时设备的累计使用小时数">
            <InputNumber min={0} max={100000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" label="维护说明">
            <Input.TextArea rows={2} maxLength={200} placeholder="如: 更换球管 / 季度保养 / 球管报警" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
