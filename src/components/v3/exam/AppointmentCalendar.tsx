/**
 * G005 放射RIS系统 v3.0.2 - 检查预约日历
 * 对标:RIS 预约管理 / 排班
 */
import dayjs from 'dayjs'
import { Calendar, Badge, Modal, Form, Select, Input, DatePicker, TimePicker, Tag, Space, Button, Statistic, Row, Col, Card, Empty, message, Tooltip } from 'antd'
import type { Dayjs } from 'dayjs'
import { Calendar as CalIcon, Plus, Clock, MapPin, ListChecks } from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { Inbox } from 'lucide-react'

export interface Appointment {
  id: string
  patientName: string
  patientId: string
  modality: string
  bodyPart?: string
  startAt: string // ISO
  endAt: string
  deviceId: string
  deviceName: string
  room?: string
  status: 'SCHEDULED' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
  priority: 'ROUTINE' | 'URGENT' | 'STAT'
  note?: string
  /** 关联医师 */
  referringDoctor?: string
}

export interface Device {
  id: string
  name: string
  modality: string
  room?: string
  /** 每日预约容量(可叠加槽位) */
  capacity: number
  /** 工作时间 */
  workHours: { start: string; end: string }
  /** 状态 */
  state: 'IDLE' | 'BUSY' | 'MAINTENANCE'
}

const STATUS_META = {
  SCHEDULED: { color: 'blue', label: '已预约' },
  CONFIRMED: { color: 'cyan', label: '已确认' },
  CHECKED_IN: { color: 'purple', label: '已签到' },
  IN_PROGRESS: { color: 'gold', label: '检查中' },
  COMPLETED: { color: 'green', label: '已完成' },
  CANCELLED: { color: 'red', label: '已取消' },
  NO_SHOW: { color: 'magenta', label: '未到' },
} as const

const PRIORITY_META = {
  ROUTINE: { color: 'default', label: '常规' },
  URGENT: { color: 'orange', label: '加急' },
  STAT: { color: 'red', label: '急诊' },
} as const

export interface AppointmentCalendarProps {
  appointments: Appointment[]
  devices: Device[]
  onCreate?: (a: Omit<Appointment, 'id' | 'status'>) => void
  onUpdate?: (id: string, patch: Partial<Appointment>) => void
  onCancel?: (id: string) => void
}

export const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  appointments,
  devices,
  onCreate,
  onUpdate,
  onCancel,
}) => {
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm()
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
  const [deviceFilter, setDeviceFilter] = useState<string>('ALL')

  const filtered = useMemo(
    () => appointments.filter((a) => deviceFilter === 'ALL' || a.deviceId === deviceFilter),
    [appointments, deviceFilter]
  )

  const dayAppointments = useMemo(() => {
    const dateStr = selectedDate.format('YYYY-MM-DD')
    return filtered.filter((a) => a.startAt.startsWith(dateStr))
  }, [filtered, selectedDate])

  const dateCellRender = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD')
    const dayList = filtered.filter((a) => a.startAt.startsWith(dateStr))
    if (dayList.length === 0) return null
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid={`day-cell-${dateStr}`}>
        {dayList.slice(0, 3).map((a) => {
          const s = STATUS_META[a.status]
          return (
            <li key={a.id} style={{ fontSize: 12, marginBottom: 1 }}>
              <Badge color={s.color} text={
                <span>{dayjs(a.startAt).format('HH:mm')} {a.patientName}</span>
              } />
            </li>
          )
        })}
        {dayList.length > 3 && <li style={{ fontSize: 12, color: '#94a3b8' }}>+{dayList.length - 3} 更多</li>}
      </ul>
    )
  }

  const stats = useMemo(() => {
    return {
      total: filtered.length,
      today: filtered.filter((a) => a.startAt.startsWith(dayjs().format('YYYY-MM-DD'))).length,
      upcoming: filtered.filter((a) => new Date(a.startAt).getTime() > Date.now() && a.status === 'SCHEDULED').length,
      completed: filtered.filter((a) => a.status === 'COMPLETED').length,
    }
  }, [filtered])

  const handleCreate = (values: any) => {
    onCreate?.({
      patientName: values.patientName,
      patientId: values.patientId,
      modality: values.modality,
      bodyPart: values.bodyPart,
      startAt: values.date.hour(values.startTime.hour()).minute(values.startTime.minute()).toISOString(),
      endAt: values.date.hour(values.endTime.hour()).minute(values.endTime.minute()).toISOString(),
      deviceId: values.deviceId,
      deviceName: devices.find((d) => d.id === values.deviceId)?.name ?? '',
      priority: values.priority,
      note: values.note,
    })
    setCreateOpen(false)
    form.resetFields()
    void message.success('已创建预约')
  }

  return (
    <div data-testid="appointment-calendar">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总预约" value={stats.total} prefix={<ListChecks size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="今日" value={stats.today} prefix={<CalIcon size={14} color="#3b82f6" />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="未来待开始" value={stats.upcoming} styles={{ content: {  color: '#ca8a04'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已完成" value={stats.completed} styles={{ content: {  color: '#16a34a'  } }} />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <span>设备:</span>
          <Select
            value={deviceFilter}
            onChange={setDeviceFilter}
            style={{ width: 180 }}
            data-testid="device-filter"
            options={[
              { value: 'ALL', label: '全部设备' },
              ...devices.map((d) => ({ value: d.id, label: `${d.name} (${d.modality})` })),
            ]}
          />
        </Space>
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)} data-testid="apt-create-btn">
          新建预约
        </Button>
      </Space>

      <Row gutter={12}>
        <Col span={16}>
          <Card size="small" title="日历视图">
            <Calendar
              value={selectedDate}
              onSelect={setSelectedDate}
              onPanelChange={setSelectedDate}
              cellRender={(date, info) => (info.type === 'date' ? dateCellRender(date) : null)}
              data-testid="apt-calendar"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card
            size="small"
            title={
              <Space>
                <CalIcon size={14} />
                <span>{selectedDate.format('YYYY-MM-DD')}</span>
                <Tag>{dayAppointments.length}</Tag>
              </Space>
            }
            data-testid="apt-day-list"
          >
            {dayAppointments.length === 0 ? (
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="该日无预约" />
            ) : (
              <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                {dayAppointments
                  .sort((a, b) => a.startAt.localeCompare(b.startAt))
                  .map((a) => {
                    const s = STATUS_META[a.status]
                    const p = PRIORITY_META[a.priority]
                    return (
                      <Card
                        key={a.id}
                        size="small"
                        style={{ borderLeft: `3px solid`, borderLeftColor: s.color === 'blue' ? '#3b82f6' : s.color === 'red' ? '#dc2626' : s.color === 'green' ? '#16a34a' : '#94a3b8' }}
                        data-testid={`apt-item-${a.id}`}
                      >
                        <Space size={4} wrap>
                          <Tag color="blue">{a.modality}</Tag>
                          <Tag>{a.patientName}</Tag>
                          <Tag color={p.color}>{p.label}</Tag>
                          <Tag color={s.color}>{s.label}</Tag>
                        </Space>
                        <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                          <Clock size={10} /> {dayjs(a.startAt).format('HH:mm')} - {dayjs(a.endAt).format('HH:mm')}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                          <MapPin size={10} /> {a.deviceName} {a.room ? `(${a.room})` : ''}
                        </div>
                        <Space size={2} style={{ marginTop: 4 }}>
                          <Tooltip title="开始检查">
                            <Button
                              size="small"
                              type="text"
                              onClick={() => onUpdate?.(a.id, { status: 'IN_PROGRESS' })}
                              data-testid={`apt-start-${a.id}`}
                            >
                              开始
                            </Button>
                          </Tooltip>
                          <Tooltip title="完成">
                            <Button
                              size="small"
                              type="text"
                              onClick={() => onUpdate?.(a.id, { status: 'COMPLETED' })}
                            >
                              完成
                            </Button>
                          </Tooltip>
                          <Button
                            size="small"
                            type="text"
                            danger
                            onClick={() => onCancel?.(a.id)}
                            data-testid={`apt-cancel-${a.id}`}
                          >
                            取消
                          </Button>
                        </Space>
                      </Card>
                    )
                  })}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="新建预约"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        width={600}
        data-testid="apt-create-modal"
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="patientName" label="患者姓名" rules={[{ required: true }]}>
                <Input data-testid="apt-frm-name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="patientId" label="患者ID" rules={[{ required: true }]}>
                <Input data-testid="apt-frm-id" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="date" label="日期" rules={[{ required: true }]} initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="startTime" label="开始时间" rules={[{ required: true }]} initialValue={dayjs().hour(9).minute(0)}>
                <TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={15} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="endTime" label="结束时间" rules={[{ required: true }]} initialValue={dayjs().hour(9).minute(30)}>
                <TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={15} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="modality" label="模态" rules={[{ required: true }]}>
                <Select
                  options={['CT', 'MR', 'DR', 'US', 'MG', 'DSA'].map((m) => ({ value: m, label: m }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bodyPart" label="部位">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label="优先级" initialValue="ROUTINE">
                <Select
                  options={Object.entries(PRIORITY_META).map(([k, v]) => ({ value: k, label: v.label }))}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="deviceId" label="设备" rules={[{ required: true }]}>
                <Select
                  data-testid="apt-frm-device"
                  options={devices.map((d) => ({ value: d.id, label: `${d.name} (${d.modality}) ${d.room ? '-' + d.room : ''}` }))}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="note" label="备注">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default AppointmentCalendar
