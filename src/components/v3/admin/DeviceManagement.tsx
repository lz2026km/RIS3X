/**
 * G005 放射RIS系统 v3.0.2 - 系统配置 / 设备管理
 */
import { Card, Tag, Space, Button, Modal, Form, Input, Select, Statistic, Row, Col, message, Empty, Switch } from 'antd'
import { DataTable } from '../../common'
import { Cpu, Wifi, WifiOff, Settings, Plus, Edit, Trash2, Power, Activity, MapPin } from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { Inbox } from 'lucide-react'
import { t } from '../../../i18n/appI18n'

export type DeviceModality = 'CT' | 'MR' | 'DR' | 'US' | 'MG' | 'DSA' | 'PETCT'
export type DeviceState = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'BUSY' | 'IDLE'

export interface DeviceAccount {
  id: string
  name: string
  modality: DeviceModality
  manufacturer: string
  model: string
  serial: string
  /** 设备 AE Title (DICOM) */
  aeTitle: string
  /** IP/Port */
  ip: string
  port: number
  room?: string
  state: DeviceState
  /** 当前检查的患者 */
  currentExam?: string
  /** 总检查数 */
  totalExams: number
  /** 今日检查数 */
  todayExams: number
  /** 上次维护 */
  lastMaintenance: string
  /** 启用 */
  enabled: boolean
}

const STATE_META: Record<DeviceState, { color: string; label: string; icon: React.ReactNode }> = {
  ONLINE: { color: 'green', label: t('w9e.deviceManagement.stateOnline'), icon: <Wifi size={12} /> },
  OFFLINE: { color: 'default', label: t('w9e.deviceManagement.stateOffline'), icon: <WifiOff size={12} /> },
  MAINTENANCE: { color: 'orange', label: t('w9e.deviceManagement.stateMaintenance'), icon: <Settings size={12} /> },
  BUSY: { color: 'red', label: t('w9e.deviceManagement.stateBusy'), icon: <Activity size={12} /> },
  IDLE: { color: 'cyan', label: t('w9e.deviceManagement.stateIdle'), icon: <Power size={12} /> },
}

export interface DeviceManagementProps {
  devices: DeviceAccount[]
  onCreate?: (d: Omit<DeviceAccount, 'id' | 'totalExams' | 'todayExams'>) => void
  onUpdate?: (id: string, patch: Partial<DeviceAccount>) => void
  onDelete?: (id: string) => void
  onToggle?: (id: string, enabled: boolean) => void
}

export const DeviceManagement: React.FC<DeviceManagementProps> = ({ devices, onCreate, onUpdate, onDelete, onToggle }) => {
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<DeviceAccount | null>(null)
  const [form] = Form.useForm()

  const stats = useMemo(() => {
    return {
      total: devices.length,
      online: devices.filter((d) => d.state === 'ONLINE' || d.state === 'IDLE' || d.state === 'BUSY').length,
      busy: devices.filter((d) => d.state === 'BUSY').length,
      offline: devices.filter((d) => d.state === 'OFFLINE' || d.state === 'MAINTENANCE').length,
    }
  }, [devices])

  return (
    <div data-testid="device-management">
      <Row gutter={12} style={{ marginBottom: 'var(--space-3, 12px)' }}>
        <Col span={6}>
          <Card>
            <Statistic title={t('w9e.deviceManagement.statTotal')} value={stats.total} prefix={<Cpu size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('w9e.deviceManagement.statOnline')} value={stats.online} styles={{ content: {  color: 'var(--color-success-600)'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('w9e.deviceManagement.statBusy')} value={stats.busy} styles={{ content: {  color: 'var(--color-error-600)'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('w9e.deviceManagement.statOfflineMaint')} value={stats.offline} styles={{ content: {  color: '#94a3b8'  } }} />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 'var(--space-3, 12px)', width: '100%', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); form.resetFields(); setModal(true) }} data-testid="device-create-btn">
          {t('w9e.deviceManagement.createDevice')}
        </Button>
      </Space>

      <DataTable
        dataSource={devices}
        rowKey="id"
        pagination={false}
        data-testid="device-table"
        columns={[
          { title: t('w9e.deviceManagement.colName'), dataIndex: 'name', width: 140 },
          {
            title: t('w9e.deviceManagement.colModality'), dataIndex: 'modality', width: 80,
            render: (m: DeviceModality) => <Tag color="blue">{m}</Tag>,
          },
          { title: t('w9e.deviceManagement.colManufacturer'), dataIndex: 'manufacturer', width: 100 },
          { title: t('w9e.deviceManagement.colModel'), dataIndex: 'model', width: 100 },
          { title: 'AE Title', dataIndex: 'aeTitle', width: 90, render: (v) => <code>{v}</code> },
          { title: 'IP/Port', dataIndex: 'ip', width: 130, render: (v, d: DeviceAccount) => `${v}:${d.port}` },
          {
            title: t('w9e.deviceManagement.colRoom'), dataIndex: 'room', width: 80, render: (v) => v ? <span><MapPin size={10} /> {v}</span> : '-',
          },
          {
            title: t('w9e.deviceManagement.colState'), dataIndex: 'state', width: 90,
            render: (s: DeviceState) => {
              const m = STATE_META[s]
              return <Tag color={m.color} icon={m.icon}>{m.label}</Tag>
            },
          },
          { title: t('w9e.deviceManagement.colTodayTotal'), dataIndex: 'todayExams', width: 100, render: (v, d: DeviceAccount) => `${v}/${d.totalExams}` },
          {
            title: t('w9e.deviceManagement.colEnabled'), dataIndex: 'enabled', width: 80,
            render: (e: boolean, d: DeviceAccount) => (
              <Switch
                size="small"
                checked={e}
                onChange={(v) => onToggle?.(d.id, v)}
                data-testid={`device-toggle-${d.id}`}
              />
            ),
          },
          {
            title: t('w9e.deviceManagement.colActions'), dataIndex: 'id', width: 120,
            render: (id: string) => {
              const d = devices.find((x) => x.id === id)!
              return (
                <Space size={2}>
                  <Button aria-label="编辑"
                    size="small"
                    type="text"
                    icon={<Edit size={12} />}
                    onClick={() => {
                      setEditing(d)
                      form.setFieldsValue(d)
                      setModal(true)
                    }}
                    data-testid={`device-edit-${id}`}
                  />
                  <Button aria-label="删除" size="small" type="text" danger icon={<Trash2 size={12} />} onClick={() => onDelete?.(id)} />
                </Space>
              )
            },
          },
        ]}
        scroll={{ x: 1300 }}
        locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('w9e.deviceManagement.noDevices')} /> }}
      />

      <Modal
        title={editing ? t('w9e.deviceManagement.editDevice') : t('w9e.deviceManagement.createDevice')}
        open={modal}
        onCancel={() => { setModal(false); setEditing(null) }}
        onOk={() => {
          form.submit()
        }}
        width={720}
        data-testid="device-form-modal"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            if (editing) {
              onUpdate?.(editing.id, values)
              void message.success(t('w9e.deviceManagement.updated'))
            } else {
              onCreate?.({ ...values, state: 'OFFLINE' as DeviceState, enabled: values.enabled ?? true, lastMaintenance: new Date().toISOString().slice(0, 10) })
              void message.success(t('w9e.deviceManagement.created'))
            }
            setModal(false)
            setEditing(null)
            form.resetFields()
          }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="name" label={t('w9e.deviceManagement.formName')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="modality" label={t('w9e.deviceManagement.formModality')} rules={[{ required: true }]}>
                <Select
                  options={['CT', 'MR', 'DR', 'US', 'MG', 'DSA', 'PETCT'].map((m) => ({ value: m, label: m }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="manufacturer" label={t('w9e.deviceManagement.formManufacturer')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="model" label={t('w9e.deviceManagement.formModel')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="serial" label={t('w9e.deviceManagement.formSerial')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="aeTitle" label="DICOM AE Title" rules={[{ required: true, max: 16 }]}>
                <Input maxLength={16} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ip" label={t('w9e.deviceManagement.formIp')} rules={[{ required: true }]}>
                <Input placeholder="192.168.1.10" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="port" label={t('w9e.deviceManagement.formPort')} rules={[{ required: true }]} initialValue={104}>
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="room" label={t('w9e.deviceManagement.formRoom')}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="enabled" label={t('w9e.deviceManagement.formEnabled')} valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default DeviceManagement
