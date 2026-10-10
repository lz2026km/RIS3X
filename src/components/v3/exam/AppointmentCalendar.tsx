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
import { t } from '../../../i18n/appI18n'

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
  SCHEDULED: { color: 'blue', label: t('appointmentCalendar.status.scheduled') },
  CONFIRMED: { color: 'cyan', label: t('appointmentCalendar.status.confirmed') },
  CHECKED_IN: { color: 'purple', label: t('appointmentCalendar.status.checkedIn') },
  IN_PROGRESS: { color: 'gold', label: t('appointmentCalendar.status.inProgress') },
  COMPLETED: { color: 'green', label: t('appointmentCalendar.status.completed') },
  CANCELLED: { color: 'red', label: t('appointmentCalendar.status.cancelled') },
  NO_SHOW: { color: 'magenta', label: t('appointmentCalendar.status.noShow') },
} as const

const PRIORITY_META = {
  ROUTINE: { color: 'default', label: t('appointmentCalendar.priority.routine') },
  URGENT: { color: 'orange', label: t('appointmentCalendar.priority.urgent') },
  STAT: { color: 'red', label: t('appointmentCalendar.priority.stat') },
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
        {dayList.length > 3 && <li style={{ fontSize: 12, color: '#94a3b8' }}>{t('appointmentCalendar.more', { count: dayList.length - 3 })}</li>}
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
    void message.success(t('appointmentCalendar.created'))
  }

  return (
    <div data-testid="appointment-calendar">
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card>
            <Statistic title={t('appointmentCalendar.stat.total')} value={stats.total} prefix={<ListChecks size={14} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('appointmentCalendar.stat.today')} value={stats.today} prefix={<CalIcon size={14} color="var(--color-primary-500)" />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('appointmentCalendar.stat.upcoming')} value={stats.upcoming} styles={{ content: {  color: '#ca8a04'  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t('appointmentCalendar.stat.completed')} value={stats.completed} styles={{ content: {  color: 'var(--color-success-600)'  } }} />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <span>{t('appointmentCalendar.deviceLabel')}</span>
          <Select
            value={deviceFilter}
            onChange={setDeviceFilter}
            style={{ width: 180 }}
            data-testid="device-filter"
            options={[
              { value: 'ALL', label: t('appointmentCalendar.allDevices') },
              ...devices.map((d) => ({ value: d.id, label: `${d.name} (${d.modality})` })),
            ]}
          />
        </Space>
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)} data-testid="apt-create-btn">
          {t('appointmentCalendar.newAppointment')}
        </Button>
      </Space>

      <Row gutter={12}>
        <Col span={16}>
          <Card size="small" title={t('appointmentCalendar.calendarView')}>
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
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('appointmentCalendar.noAppointments')} />
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
                        style={{ borderLeft: `3px solid`, borderLeftColor: s.color === 'blue' ? 'var(--color-primary-500)' : s.color === 'red' ? 'var(--color-error-600)' : s.color === 'green' ? 'var(--color-success-600)' : '#94a3b8' }}
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
                          <Tooltip title={t('appointmentCalendar.startExam')}>
                            <Button
                              size="small"
                              type="text"
                              onClick={() => onUpdate?.(a.id, { status: 'IN_PROGRESS' })}
                              data-testid={`apt-start-${a.id}`}
                            >
                              {t('appointmentCalendar.start')}
                            </Button>
                          </Tooltip>
                          <Tooltip title={t('appointmentCalendar.complete')}>
                            <Button
                              size="small"
                              type="text"
                              onClick={() => onUpdate?.(a.id, { status: 'COMPLETED' })}
                            >
                              {t('appointmentCalendar.complete')}
                            </Button>
                          </Tooltip>
                          <Button
                            size="small"
                            type="text"
                            danger
                            onClick={() => onCancel?.(a.id)}
                            data-testid={`apt-cancel-${a.id}`}
                          >
                            {t('appointmentCalendar.cancel')}
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
        title={t('appointmentCalendar.newAppointment')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        width={600}
        data-testid="apt-create-modal"
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="patientName" label={t('appointmentCalendar.form.patientName')} rules={[{ required: true }]}>
                <Input data-testid="apt-frm-name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="patientId" label={t('appointmentCalendar.form.patientId')} rules={[{ required: true }]}>
                <Input data-testid="apt-frm-id" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="date" label={t('appointmentCalendar.form.date')} rules={[{ required: true }]} initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="startTime" label={t('appointmentCalendar.form.startTime')} rules={[{ required: true }]} initialValue={dayjs().hour(9).minute(0)}>
                <TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={15} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="endTime" label={t('appointmentCalendar.form.endTime')} rules={[{ required: true }]} initialValue={dayjs().hour(9).minute(30)}>
                <TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={15} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="modality" label={t('appointmentCalendar.form.modality')} rules={[{ required: true }]}>
                <Select
                  options={['CT', 'MR', 'DR', 'US', 'MG', 'DSA'].map((m) => ({ value: m, label: m }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bodyPart" label={t('appointmentCalendar.form.bodyPart')}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label={t('appointmentCalendar.form.priority')} initialValue="ROUTINE">
                <Select
                  options={Object.entries(PRIORITY_META).map(([k, v]) => ({ value: k, label: v.label }))}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="deviceId" label={t('appointmentCalendar.form.device')} rules={[{ required: true }]}>
                <Select
                  data-testid="apt-frm-device"
                  options={devices.map((d) => ({ value: d.id, label: `${d.name} (${d.modality}) ${d.room ? '-' + d.room : ''}` }))}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="note" label={t('appointmentCalendar.form.note')}>
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
