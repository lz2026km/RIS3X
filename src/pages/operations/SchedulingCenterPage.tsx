// [v3.0.6.11-54] Phase 2: 全院资源排程中心 (日历 + 排班列表 + 新建预约)
import dayjs from 'dayjs';
import { appointmentApi, type AppointmentDto } from '../../services/api/appointmentApi';
import { deviceApi } from '../../services/api/deviceApi';
import {
  Card,
  Space,
  Tag,
  Button,
  Calendar,
  Col,
  Row,
  Select,
  Badge,
  Modal,
  Form,
  DatePicker,
  message,
  Alert,
  Spin,
  Empty,
} from "antd";
import type { Dayjs } from 'dayjs';
import { CalendarDays, Clock, Monitor, Users, Plus, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '../../i18n/appI18n';
import { DataTable, StatCard, StatCardGrid } from "../../components/common";
import { PageContainer } from "../../components/common";

const STATE_COLOR: Record<string, string> = {
  SCHEDULED: 'blue', CONFIRMED: 'cyan', CHECKED_IN: 'geekblue', IN_PROGRESS: 'orange',
  COMPLETED: 'green', CANCELLED: 'red', NO_SHOW: 'default',
};

const STATE_LABEL: Record<string, string> = {
  SCHEDULED: t('sch.state.scheduled'), CONFIRMED: t('sch.state.confirmed'), CHECKED_IN: t('sch.state.checkedIn'), IN_PROGRESS: t('sch.state.inProgress'),
  COMPLETED: t('sch.state.completed'), CANCELLED: t('sch.state.cancelled'), NO_SHOW: t('sch.state.noShow'),
};

const PRIORITY_LABEL: Record<string, string> = {
  STAT: t('sch.priority.stat'), URGENT: t('sch.priority.urgent'), ROUTINE: t('sch.priority.routine'),
};

function getAptDate(a: AppointmentDto): string {
  return (a.startAt ?? (a as any).examDate ?? '').slice(0, 10);
}

function getAptTime(a: AppointmentDto): string {
  if (a.startAt) return a.startAt.slice(11, 16);
  return String((a as any).examTime ?? '');
}

export const SchedulingCenterPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [appointments, setAppointments] = useState<AppointmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deviceStats, setDeviceStats] = useState<{ total?: number; inUse?: number; maintenance?: number }>({});
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [aptRes, devRes] = await Promise.allSettled([
        appointmentApi.list({ take: 200 }),
        deviceApi.getTodayStats(),
      ]);
      if (aptRes.status === 'fulfilled' && aptRes.value.success) {
        setAppointments(aptRes.value.data ?? []);
      } else {
        setAppointments([]);
        if (aptRes.status === 'fulfilled') setError(aptRes.value.error?.message ?? '');
      }
      if (devRes.status === 'fulfilled' && devRes.value.success) {
        const d = devRes.value.data as any;
        setDeviceStats({ total: d.total ?? d.totalDevices, inUse: d.inUse, maintenance: d.maintenance });
      }
    } catch (e) {
      setError((e as Error)?.message ?? t('sch.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dayKey = selectedDate.format('YYYY-MM-DD');
  const dayAppointments = useMemo(
    () => appointments.filter((a) => getAptDate(a) === dayKey),
    [appointments, dayKey],
  );
  const todayCount = useMemo(
    () => appointments.filter((a) => getAptDate(a) === dayjs().format('YYYY-MM-DD')).length,
    [appointments],
  );
  const activeCount = useMemo(
    () => appointments.filter((a) => ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(a.state)).length,
    [appointments],
  );

  const stats = useMemo(() => {
    const byState: Record<string, number> = {};
    for (const a of appointments) byState[a.state] = (byState[a.state] ?? 0) + 1;
    return { total: appointments.length, byState };
  }, [appointments]);

  const dateCellRender = (date: Dayjs) => {
    const key = date.format('YYYY-MM-DD');
    const list = appointments.filter((a) => getAptDate(a) === key).slice(0, 4);
    if (list.length === 0) return null;
    return (
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 11 }}>
        {list.map((a) => (
          <li key={a.id} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Badge status={(STATE_COLOR[a.state] ?? 'default') as any} text={`${getAptTime(a)} ${a.patientName} ${a.modality ?? ''}`} />
          </li>
        ))}
        {list.length < appointments.filter((x) => getAptDate(x) === key).length && <li style={{ color: 'var(--text-secondary)' }}>…</li>}
      </ul>
    );
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        patientName: values.patientName,
        patientId: values.patientId ?? `P${Date.now()}`,
        modality: values.modality,
        bodyPart: values.bodyPart,
        startAt: dayjs(values.datetime).format('YYYY-MM-DDTHH:mm:ss'),
        endAt: dayjs(values.datetime).add(30, 'minute').format('YYYY-MM-DDTHH:mm:ss'),
        deviceId: values.deviceId ?? 'DEV-AUTO',
        deviceName: values.deviceId ?? t('sch.autoDevice'),
        room: values.room,
        priority: values.priority ?? 'ROUTINE',
        note: values.note,
        referringDoctor: values.referringDoctor,
        createdById: 'current-user',
      };
      const res = await appointmentApi.create(payload as any);
      if (res.success) {
        message.success(t('sch.createSuccess'));
        setBookingOpen(false);
        form.resetFields();
        void load();
      } else {
        message.error(res.error?.message ?? t('sch.createFailed'));
      }
    } catch {
      // validateFields 失败或用户取消
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: t('sch.colTime'), key: 'time', width: 90, render: (_: unknown, r: AppointmentDto) => getAptTime(r) },
    { title: t('sch.colPatient'), dataIndex: 'patientName', key: 'patientName', width: 110 },
    { title: t('sch.colItem'), key: 'item', width: 130, render: (_: unknown, r: AppointmentDto) => r.bodyPart ?? r.modality },
    { title: t('sch.colDevice'), dataIndex: 'deviceName', key: 'deviceName', width: 150 },
    { title: t('sch.colPriority'), dataIndex: 'priority', key: 'priority', width: 90, render: (v: string) =>
      <Tag color={v === 'STAT' ? 'red' : v === 'URGENT' ? 'orange' : 'blue'}>{PRIORITY_LABEL[v] ?? v}</Tag> },
    { title: t('sch.colStatus'), dataIndex: 'state', key: 'state', width: 100, render: (v: string) =>
      <Badge status={(STATE_COLOR[v] ?? 'default') as any} text={STATE_LABEL[v] ?? v} /> },
  ];

  return (
    <PageContainer maxWidth="full" padding="var(--space-6, 24px)" style={{ background: 'var(--bg-card)' }}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <CalendarDays size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('sch.title')}</span>
        <Tag color="green">{t('sch.realtimeOccupancy')}</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>{t('sch.refresh')}</Button>
      </Space>

      {error && (
        <Alert type="error" showIcon style={{ marginBottom: 'var(--space-4, 16px)' }} message={error}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('sch.retry')}</Button>} />
      )}

      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('sch.totalAppointments')} value={stats.total} icon={<Clock size={14} />} />
        <StatCard title={t('sch.todayAppointments')} value={todayCount} color="primary" />
        <StatCard title={t('sch.state.inProgress')} value={activeCount} color="warning" />
        <StatCard title={t('sch.onlineDevices')} value={deviceStats.inUse ?? '-'} suffix={`/ ${deviceStats.total ?? '-'}`} icon={<Monitor size={14} />} color="success" />
      </StatCardGrid>

      <Row gutter={16}>
        <Col span={10}>
          <Card size="small" title={<Space><Users size={14} />{t('sch.calendarTitle')}</Space>}>
            <Spin spinning={loading}>
              <Calendar
                fullCellRender={(date) => (
                  <div style={{ padding: 'var(--space-1, 4px)', cursor: 'pointer' }} onClick={() => setSelectedDate(date)}>
                    <div style={{ fontSize: 12, color: date.isSame(selectedDate, 'day') ? 'var(--color-primary-600)' : 'inherit' }}>{date.date()}</div>
                    {dateCellRender(date)}
                  </div>
                )}
                value={selectedDate}
                onSelect={setSelectedDate}
              />
            </Spin>
          </Card>
        </Col>
        <Col span={14}>
          <Card
            size="small"
            title={<Space><Clock size={14} />{selectedDate.format('YYYY-MM-DD')} {t('sch.appointmentList')} ({dayAppointments.length})</Space>}
            extra={<Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setBookingOpen(true)}>{t('sch.newAppointment')}</Button>}
          >
            {dayAppointments.length === 0 && !loading ? (
              <Empty description={t('sch.noAppointments')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <DataTable rowKey="id" dataSource={dayAppointments} columns={columns} pagination={false} scroll={{ x: 'max-content' }}/>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={t('sch.newAppointment')}
        open={bookingOpen}
        onCancel={() => setBookingOpen(false)}
        onOk={() => void handleCreate()}
        confirmLoading={submitting}
        width={560}
      >
        <Form form={form} layout="vertical" size="small">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label={t('sch.patientName')} name="patientName" rules={[{ required: true, message: t('sch.patientNameRequired') }]}>
                <Select showSearch placeholder={t('sch.selectPatient')} options={['张伟', '李娜', '王芳', '赵敏', '陈杰', '刘洋'].map(n => ({ value: n, label: n }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('sch.colItem')} name="bodyPart">
                <Select placeholder={t('sch.selectItem')} options={['胸部CT平扫', '头颅MRI增强', '腹部CT增强', '颈椎DR', '口腔CBCT', '乳腺钼靶'].map(n => ({ value: n, label: n }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('sch.modality')} name="modality" initialValue="CT">
                <Select options={['CT', 'MR', 'DR', 'CBCT', 'MG', 'PET-CT'].map(m => ({ value: m, label: m }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('sch.appointmentTime')} name="datetime" rules={[{ required: true, message: t('sch.timeRequired') }]}>
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('sch.colPriority')} name="priority" initialValue="ROUTINE">
                <Select options={['ROUTINE', 'URGENT', 'STAT'].map(p => ({ value: p, label: PRIORITY_LABEL[p] ?? p }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('sch.roomNote')} name="note">
                <Select allowClear placeholder={t('sch.selectRoom')} options={['CT 检查室 1', 'CT 检查室 2', 'MR 检查室 1', 'DR 检查室 1', 'CBCT 检查室'].map(n => ({ value: n, label: n }))} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </PageContainer>
  );
};
export default SchedulingCenterPage;
