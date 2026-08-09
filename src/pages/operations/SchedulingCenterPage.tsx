// [v3.0.6.11-54] Phase 2: 全院资源排程中心 (日历 + 排班列表 + 新建预约)
import dayjs from 'dayjs';
import { appointmentApi, type AppointmentDto } from '../../services/api/appointmentApi';
import { deviceApi } from '../../services/api/deviceApi';
import {
  Card, Space, Tag, Button, Table, Calendar, Col, Row, Select, Statistic,
  Badge, Modal, Form, DatePicker, message, Alert, Spin, Empty,
} from 'antd';
import type { Dayjs } from 'dayjs';
import { CalendarDays, Clock, Monitor, Users, Plus, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

const STATE_COLOR: Record<string, string> = {
  SCHEDULED: 'blue', CONFIRMED: 'cyan', CHECKED_IN: 'geekblue', IN_PROGRESS: 'orange',
  COMPLETED: 'green', CANCELLED: 'red', NO_SHOW: 'default',
};

const STATE_LABEL: Record<string, string> = {
  SCHEDULED: '已预约', CONFIRMED: '已确认', CHECKED_IN: '已签到', IN_PROGRESS: '进行中',
  COMPLETED: '已完成', CANCELLED: '已取消', NO_SHOW: '未到场',
};

const PRIORITY_LABEL: Record<string, string> = {
  STAT: '紧急', URGENT: '加急', ROUTINE: '常规',
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
      setError((e as Error)?.message ?? '加载失败');
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
        deviceName: values.deviceId ?? '自动排程设备',
        room: values.room,
        priority: values.priority ?? 'ROUTINE',
        note: values.note,
        referringDoctor: values.referringDoctor,
        createdById: 'current-user',
      };
      const res = await appointmentApi.create(payload as any);
      if (res.success) {
        message.success('预约创建成功');
        setBookingOpen(false);
        form.resetFields();
        void load();
      } else {
        message.error(res.error?.message ?? '创建失败');
      }
    } catch {
      // validateFields 失败或用户取消
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: '时间', key: 'time', width: 90, render: (_: unknown, r: AppointmentDto) => getAptTime(r) },
    { title: '患者', dataIndex: 'patientName', key: 'patientName', width: 110 },
    { title: '检查项目', key: 'item', width: 130, render: (_: unknown, r: AppointmentDto) => r.bodyPart ?? r.modality },
    { title: '设备', dataIndex: 'deviceName', key: 'deviceName', width: 150 },
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 90, render: (v: string) =>
      <Tag color={v === 'STAT' ? 'red' : v === 'URGENT' ? 'orange' : 'blue'}>{PRIORITY_LABEL[v] ?? v}</Tag> },
    { title: '状态', dataIndex: 'state', key: 'state', width: 100, render: (v: string) =>
      <Badge status={(STATE_COLOR[v] ?? 'default') as any} text={STATE_LABEL[v] ?? v} /> },
  ];

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <CalendarDays size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>全院资源排程中心</span>
        <Tag color="green">实时占用</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>刷新</Button>
      </Space>

      {error && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message={error}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> 重试</Button>} />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="预约总数" value={stats.total} prefix={<Clock size={14} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="今日预约" value={todayCount} styles={{ content: { color: '#2563eb' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="进行中" value={activeCount} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="在线设备" value={deviceStats.inUse ?? '-'} suffix={`/ ${deviceStats.total ?? '-'}`} prefix={<Monitor size={14} />} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
      </Row>

      <Row gutter={16}>
        <Col span={10}>
          <Card size="small" title={<Space><Users size={14} />排班日历</Space>}>
            <Spin spinning={loading}>
              <Calendar
                fullCellRender={(date) => (
                  <div style={{ padding: 4, cursor: 'pointer' }} onClick={() => setSelectedDate(date)}>
                    <div style={{ fontSize: 12, color: date.isSame(selectedDate, 'day') ? '#2563eb' : 'inherit' }}>{date.date()}</div>
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
            title={<Space><Clock size={14} />{selectedDate.format('YYYY-MM-DD')} 预约列表 ({dayAppointments.length})</Space>}
            extra={<Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setBookingOpen(true)}>新建预约</Button>}
          >
            {dayAppointments.length === 0 && !loading ? (
              <Empty description="当天暂无预约" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table rowKey="id" size="small" dataSource={dayAppointments} columns={columns} pagination={false} scroll={{ x: 'max-content' }}/>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="新建预约"
        open={bookingOpen}
        onCancel={() => setBookingOpen(false)}
        onOk={() => void handleCreate()}
        confirmLoading={submitting}
        width={520}
      >
        <Form form={form} layout="vertical" size="small">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="患者姓名" name="patientName" rules={[{ required: true, message: '请输入患者姓名' }]}>
                <Select showSearch placeholder="选择或输入患者" options={['张伟', '李娜', '王芳', '赵敏', '陈杰', '刘洋'].map(n => ({ value: n, label: n }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="检查项目" name="bodyPart">
                <Select placeholder="选择项目" options={['胸部CT平扫', '头颅MRI增强', '腹部CT增强', '颈椎DR', '口腔CBCT', '乳腺钼靶'].map(n => ({ value: n, label: n }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="模态" name="modality" initialValue="CT">
                <Select options={['CT', 'MR', 'DR', 'CBCT', 'MG', 'PET-CT'].map(m => ({ value: m, label: m }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="预约时间" name="datetime" rules={[{ required: true, message: '请选择时间' }]}>
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="优先级" name="priority" initialValue="ROUTINE">
                <Select options={['ROUTINE', 'URGENT', 'STAT'].map(p => ({ value: p, label: PRIORITY_LABEL[p] ?? p }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="诊室/备注" name="note">
                <Select allowClear placeholder="选择诊室" options={['CT 检查室 1', 'CT 检查室 2', 'MR 检查室 1', 'DR 检查室 1', 'CBCT 检查室'].map(n => ({ value: n, label: n }))} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};
export default SchedulingCenterPage;
