/**
 * G005 放射RIS系统 v3.0.5.1 - 多通道送达
 * R3.DIST 组 D:多通道推送(微信/短信/钉钉/邮件/站内/DICOM/纸质/云盘/胶片)
 * 25 升级点
 */
import { DELIVERY_CHANNELS_CONFIG, DELIVERY_TASKS_MOCK, DELIVERY_QUEUE_MOCK } from '@data/reportDistributionMock';
import { sendMultiChannel, retryDeliveryTask, cancelDeliveryTask } from '@services/distribution/distributionService';
import type { DeliveryChannel, DeliveryChannelConfig, DeliveryTask, DeliveryStatus } from '@/types/R3/R3.DIST';
import { DELIVERY_STATUS_COLORS as STATUS_COLORS } from '@utils/statusColors';
import { Card, Space, Button, Tag, Tooltip, message, Modal, Form, Select, Switch, Empty, Statistic, Row, Col, Divider, Alert, List, Progress, Input, InputNumber } from 'antd';
import { DataTable } from '../../../common';
import { Send, MessageSquare, Smartphone, Mail, Bell, Database, Printer, Cloud, Film, CheckCircle2, XCircle, Loader2, RefreshCw, Settings, Eye, Filter, Layers, Inbox, Activity, Clock } from 'lucide-react';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { t } from '../../../../i18n/appI18n';

interface Props {
  reportId?: string;
  patientId?: string;
  onSend?: (taskIds: string[]) => void;
}

const CHANNEL_ICON_MAP: Record<DeliveryChannel, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  wechat: MessageSquare, sms: Smartphone, dingtalk: Bell, email: Mail,
  inApp: Inbox, dicom: Database, paper: Printer, cloud: Cloud, film: Film,
};



const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: t('reportDist.status.pending'), queued: t('reportDist.status.queued'), sending: t('reportDist.status.sending'), sent: t('reportDist.status.sent'),
  delivered: t('reportDist.status.delivered'), read: t('reportDist.status.read'), failed: t('reportDist.status.failed'), cancelled: t('reportDist.status.cancelled'), expired: t('reportDist.status.expired'),
};

export const MultiChannelSender: React.FC<Props> = ({ reportId, patientId, onSend }) => {
  const [channels, setChannels] = useState<DeliveryChannelConfig[]>(DELIVERY_CHANNELS_CONFIG);
  const [selectedChannels, setSelectedChannels] = useState<DeliveryChannel[]>(['wechat', 'inApp']);
  const [recipients, _setRecipients] = useState<{ [key in DeliveryChannel]?: string }>({
    wechat: 'wx_doctor_li',
    sms: '13800138001',
    dingtalk: 'ding_li',
    email: 'li.dr@hospital.com',
    inApp: 'inapp-001',
  });
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [tasks, setTasks] = useState<DeliveryTask[]>(DELIVERY_TASKS_MOCK);
  const [filterChannel, setFilterChannel] = useState<DeliveryChannel | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<DeliveryStatus | 'all'>('all');
  const [showConfig, setShowConfig] = useState(false);
  const [template, setTemplate] = useState('standard-v1');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');

  const sendProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (sendProgressRef.current !== null) clearInterval(sendProgressRef.current);
    if (hideModalTimerRef.current !== null) clearTimeout(hideModalTimerRef.current);
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterChannel !== 'all' && task.channel !== filterChannel) return false;
      if (filterStatus !== 'all' && task.status !== filterStatus) return false;
      if (reportId && task.reportId !== reportId) return false;
      return true;
    });
  }, [tasks, filterChannel, filterStatus, reportId]);

  const queue = DELIVERY_QUEUE_MOCK;

  const toggleChannel = (c: DeliveryChannel) => {
    setSelectedChannels((arr) => arr.includes(c) ? arr.filter((x) => x !== c) : [...arr, c]);
  };

  const handleSend = useCallback(async () => {
    if (selectedChannels.length === 0) {
      message.warning(t('reportDist.msg.selectChannel'));
      return;
    }
    if (!reportId || !patientId) {
      message.warning(t('reportDist.msg.selectReportPatient'));
      return;
    }
    setSending(true);
    setSendProgress(0);
    setShowSendModal(true);

    // 模拟进度
    const stopProgress = () => {
      if (sendProgressRef.current !== null) {
        clearInterval(sendProgressRef.current);
        sendProgressRef.current = null;
      }
    };
    sendProgressRef.current = setInterval(() => {
      setSendProgress((p) => {
        if (p >= 100) {
          stopProgress();
          return 100;
        }
        return p + 12;
      });
    }, 200);

    try {
      const result = await sendMultiChannel({
        reportId, patientId,
        channels: selectedChannels,
        recipients: selectedChannels.map((c) => recipients[c] ?? '').filter(Boolean),
      });
      stopProgress();
      setSendProgress(100);

      const newTasks: DeliveryTask[] = selectedChannels.map((c, i) => ({
        id: result.taskIds[i] ?? `dt-${Date.now()}-${i}`,
        reportId, patientId, patientName: '患者',
        channel: c, recipient: recipients[c] ?? '',
        template, subject: '报告通知', body: '报告已发布',
        attachments: [],
        status: 'sent', priority, retryCount: 0, maxRetries: 3,
        durationMs: 1500 + i * 200, cost: 0.02, traceId: `t-${Date.now()}`,
        ackReceived: false, metadata: {},
      }));
      setTasks((prev) => [...newTasks, ...prev]);
      message.success(t('reportDist.msg.sentToChannels', { count: result.sent }));
      onSend?.(result.taskIds);
      if (hideModalTimerRef.current !== null) clearTimeout(hideModalTimerRef.current);
      hideModalTimerRef.current = setTimeout(() => setShowSendModal(false), 1000);
    } catch (e) {
      stopProgress();
      message.error(t('reportDist.msg.sendFailed', { message: (e as Error).message }));
    } finally {
      setSending(false);
    }
  }, [reportId, patientId, selectedChannels, recipients, template, priority, onSend]);

  const handleRetry = useCallback(async (taskId: string) => {
    const r = await retryDeliveryTask(taskId);
    if (r.success) {
      setTasks((arr) => arr.map((tk) => tk.id === taskId ? { ...tk, status: r.newStatus, retryCount: tk.retryCount + 1, scheduledAt: r.retriedAt } : tk));
      message.success(t('reportDist.msg.retried'));
    }
  }, []);

  const handleCancel = useCallback(async (taskId: string) => {
    Modal.confirm({
      title: t('reportDist.confirmCancelTitle'),
      content: t('reportDist.confirmCancelContent'),
      onOk: async () => {
        const r = await cancelDeliveryTask(taskId, '用户取消');
        if (r.success) {
          setTasks((arr) => arr.map((tk) => tk.id === taskId ? { ...tk, status: 'cancelled' } : tk));
          message.success(t('reportDist.msg.cancelled'));
        }
      },
    });
  }, []);

  // [v3.0.6.11-98 Wave3B P1] 队列行详情 Modal: 任务详情字段展示
  const [detailTask, setDetailTask] = useState<DeliveryTask | null>(null);

  // [G005] 通道编辑 Modal: 本地保存 displayName/host/port/限流/重试
  const [editChannel, setEditChannel] = useState<DeliveryChannelConfig | null>(null);
  const [editChannelForm] = Form.useForm<{ displayName: string; host?: string; port?: number; rateLimitPerMin: number; maxRetries: number }>();

  const openEditChannel = useCallback((c: DeliveryChannelConfig) => {
    setEditChannel(c);
    editChannelForm.setFieldsValue({
      displayName: c.displayName,
      host: c.host,
      port: c.port,
      rateLimitPerMin: c.rateLimitPerMin,
      maxRetries: c.retryPolicy.maxRetries,
    });
  }, [editChannelForm]);

  const handleSaveChannel = useCallback(async () => {
    if (!editChannel) return;
    const v = await editChannelForm.validateFields();
    setChannels((arr) => arr.map((x) => x.channel === editChannel.channel
      ? { ...x, displayName: v.displayName, host: v.host, port: v.port, rateLimitPerMin: v.rateLimitPerMin, retryPolicy: { ...x.retryPolicy, maxRetries: v.maxRetries } }
      : x));
    message.success(t('w1Buttons.channel.saved', { name: v.displayName }));
    setEditChannel(null);
  }, [editChannel, editChannelForm]);

  const columns = [
    { title: t('reportDist.col.channel'), dataIndex: 'channel', key: 'channel', width: 100, render: (c: DeliveryChannel) => {
      const Icon = CHANNEL_ICON_MAP[c];
      const cfg = channels.find((x) => x.channel === c);
      return (
        <Space size={4}>
          {Icon && <Icon className="w-3 h-3" style={{ color: cfg?.color }} />}
          <span style={{ color: cfg?.color }}>{cfg?.displayName}</span>
        </Space>
      );
    } },
    { title: t('reportDist.col.recipient'), dataIndex: 'recipient', key: 'recipient', ellipsis: true, width: 180 },
    { title: t('reportDist.col.status'), dataIndex: 'status', key: 'status', width: 110, render: (s: DeliveryStatus) => <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</Tag> },
    { title: t('reportDist.col.priority'), dataIndex: 'priority', key: 'priority', width: 80, render: (p: string) => <Tag color={p === 'urgent' ? 'red' : p === 'high' ? 'orange' : 'default'}>{p}</Tag> },
    { title: t('reportDist.col.retry'), dataIndex: 'retryCount', key: 'retryCount', width: 60, render: (n: number, r: DeliveryTask) => <span>{n}/{r.maxRetries}</span> },
    { title: t('reportDist.col.duration'), dataIndex: 'durationMs', key: 'durationMs', width: 80, render: (n: number) => `${(n / 1000).toFixed(1)}s` },
    { title: t('reportDist.col.cost'), dataIndex: 'cost', key: 'cost', width: 80, render: (n: number) => `¥${n.toFixed(3)}` },
    { title: t('reportDist.col.time'), dataIndex: 'sentAt', key: 'sentAt', width: 140, render: (s: string) => s ? new Date(s).toLocaleTimeString() : '-' },
    { title: t('reportDist.col.action'), key: 'action', width: 140, render: (_: any, r: DeliveryTask) => (
      <Space size={4}>
        {r.status === 'failed' && <Button size="small" type="primary" icon={<RefreshCw className="w-3 h-3" />} onClick={() => handleRetry(r.id)}>{t('reportDist.retry')}</Button>}
        {(r.status === 'pending' || r.status === 'queued' || r.status === 'sending') && <Button size="small" danger icon={<XCircle className="w-3 h-3" />} onClick={() => handleCancel(r.id)}>{t('reportDist.cancel')}</Button>}
        <Button size="small" icon={<Eye className="w-3 h-3" />} onClick={() => setDetailTask(r)}>{t('reportDist.detail')}</Button>
      </Space>
    ) },
  ];

  return (
    <div className="space-y-3">
      {/* 队列状态 */}
      <Row gutter={8}>
        <Col span={4}><Card size="small"><Statistic title={t('reportDist.queue.pending')} value={queue.pending} prefix={<Clock className="w-3 h-3" style={{ color: 'var(--color-warning-500)' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('reportDist.queue.sending')} value={queue.sending} prefix={<Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--color-primary-500)' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('reportDist.queue.delivered')} value={queue.delivered} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('reportDist.queue.failed')} value={queue.failed} prefix={<XCircle className="w-3 h-3" style={{ color: 'var(--color-error-600)' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('reportDist.queue.today')} value={queue.totalToday} prefix={<Activity className="w-3 h-3" style={{ color: '#7c3aed' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('reportDist.queue.successRate')} value={queue.successRate * 100} suffix="%" precision={1} styles={{ content: {  fontSize: 18, color: '#10b981'  } }} /></Card></Col>
      </Row>

      {/* 通道选择 + 发送按钮 */}
      <Card size="small" title={<Space><Layers className="w-4 h-4" /><span>{t('reportDist.title')}</span><Tag color="orange" style={{ fontSize: 10 }}>{t('reportDist.demoTag')}</Tag></Space>} className="shadow-sm"
        extra={
          <Space>
            <Button size="small" icon={<Settings className="w-3 h-3" />} onClick={() => setShowConfig(true)}>{t('reportDist.channelConfig')}</Button>
            <Button size="small" type="primary" icon={<Send className="w-3 h-3" />} onClick={() => setShowSendModal(true)} disabled={!reportId}>{t('reportDist.sendNow')}</Button>
          </Space>
        }>
        <div className="grid grid-cols-3 md:grid-cols-9 gap-2">
          {channels.map((c) => {
            const Icon = CHANNEL_ICON_MAP[c.channel];
            const selected = selectedChannels.includes(c.channel);
            return (
              <Tooltip key={c.channel} title={c.description}>
                <div
                  onClick={() => c.enabled && toggleChannel(c.channel)}
                  className={`p-2 border-2 rounded cursor-pointer transition ${selected ? 'border-blue-500' : 'border-slate-200 hover:border-slate-300'} ${!c.enabled ? 'opacity-40' : ''}`}
                  style={{ background: selected ? c.bg : 'white' }}
                >
                  <div className="flex flex-col items-center gap-1">
                    {Icon && <Icon className="w-5 h-5" style={{ color: c.color }} />}
                    <div className="text-xs font-semibold" style={{ color: c.color }}>{c.displayName}</div>
                    <div className="text-[10px] text-slate-500">
                      {c.enabled ? `${c.rateLimitPerMin}/min` : t('reportDist.disabled')}
                    </div>
                  </div>
                </div>
              </Tooltip>
            );
          })}
        </div>
        <Divider className="my-3" />
        <Row gutter={8}>
          <Col span={6}><div className="text-xs text-slate-500">{t('reportDist.selectedChannels', { count: selectedChannels.length })}</div></Col>
          <Col span={6}><Tag color="purple">{t('reportDist.templateLabel')} {template}</Tag></Col>
          <Col span={6}><Tag color={priority === 'urgent' ? 'red' : priority === 'high' ? 'orange' : 'blue'}>{t('reportDist.priorityLabel')} {priority}</Tag></Col>
          <Col span={6} className="text-right">
            <Space>
              <span className="text-xs text-slate-500">{t('reportDist.recipientLabel')}</span>
              <Select size="small" value="李医生" style={{ width: 120 }} options={[{ value: '李医生', label: '李医生(主诊)' }, { value: '王护士', label: '王护士' }, { value: '张主任', label: '张主任' }]} />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 任务列表 */}
      <Card size="small" title={<Space><Filter className="w-4 h-4" /><span>{t('reportDist.tasksTitle')}</span></Space>} className="shadow-sm"
        extra={
          <Space>
            <Select size="small" value={filterChannel} onChange={setFilterChannel} style={{ width: 110 }} options={[{ value: 'all', label: t('reportDist.allChannels') }, ...channels.map((c) => ({ value: c.channel, label: c.displayName }))]} />
            <Select size="small" value={filterStatus} onChange={setFilterStatus} style={{ width: 110 }} options={[{ value: 'all', label: t('reportDist.allStatuses') }, ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))]} />
          </Space>
        }>
        {filteredTasks.length > 0 ? (
          <DataTable
            rowKey="id"
            columns={columns}
            dataSource={filteredTasks.slice(0, 30)}
            pagination={{ pageSize: 10, size: 'small' }}
            scroll={{ x: 800 }}
          />
        ) : (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('reportDist.noTasks')} />
        )}
      </Card>

      {/* 发送 Modal */}
      <Modal
        title={<Space><Send className="w-4 h-4 text-blue-500" /><span>{t('reportDist.sendConfirmTitle')}</span></Space>}
        open={showSendModal}
        onCancel={() => !sending && setShowSendModal(false)}
        footer={null}
      >
        {sending || sendProgress === 100 ? (
          <div className="py-6 space-y-3 text-center">
            <Loader2 className={`w-12 h-12 mx-auto ${sending ? 'animate-spin' : ''} text-blue-500`} />
            <Progress percent={sendProgress} status={sendProgress === 100 ? 'success' : 'active'} />
            <div className="text-sm text-slate-600">{sendProgress === 100 ? t('reportDist.sendComplete') : t('reportDist.sendingDownstream')}</div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold mb-2">{t('reportDist.targetChannels', { count: selectedChannels.length })}</div>
              <div className="flex flex-wrap gap-1">
                {selectedChannels.map((c) => {
                  const cfg = channels.find((x) => x.channel === c);
                  const Icon = CHANNEL_ICON_MAP[c];
                  return (
                    <Tag key={c} color="blue" icon={Icon ? <Icon className="w-3 h-3" /> : undefined}>
                      {cfg?.displayName} · {recipients[c]}
                    </Tag>
                  );
                })}
              </div>
            </div>
            <Divider className="my-2" />
            <Form layout="vertical">
              <Form.Item label={t('reportDist.templateLabel')}>
                <Select size="small" value={template} onChange={setTemplate} options={[
                  { value: 'standard-v1', label: t('reportDist.template.standard') },
                  { value: 'critical-v2', label: t('reportDist.template.critical') },
                  { value: 'patient-v1', label: t('reportDist.template.patient') },
                ]} />
              </Form.Item>
              <Form.Item label={t('reportDist.priorityLabel')}>
                <Select size="small" value={priority} onChange={setPriority} options={[
                  { value: 'low', label: t('reportDist.priority.low') }, { value: 'normal', label: t('reportDist.priority.normal') }, { value: 'high', label: t('reportDist.priority.high') }, { value: 'urgent', label: t('reportDist.priority.urgent') },
                ]} />
              </Form.Item>
            </Form>
            <Divider className="my-2" />
            <Alert type="info" title={t('reportDist.estimate', { cost: (selectedChannels.length * 0.02).toFixed(3), duration: (selectedChannels.length * 0.5).toFixed(1) })} />
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowSendModal(false)}>{t('reportDist.cancel')}</Button>
              <Button type="primary" icon={<Send className="w-3 h-3" />} onClick={handleSend}>{t('reportDist.confirmSend')}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 通道配置 Modal */}
      <Modal
        title={<Space><Settings className="w-4 h-4" /><span>{t('reportDist.channelConfig')}</span></Space>}
        open={showConfig}
        onCancel={() => setShowConfig(false)}
        footer={null}
        width={720}
      >
        <List
          dataSource={channels}
          renderItem={(c) => {
            const Icon = CHANNEL_ICON_MAP[c.channel];
            return (
              <List.Item
                actions={[
                  <Switch key="enabled" size="small" checked={c.enabled} onChange={(v) => setChannels((arr) => arr.map((x) => x.channel === c.channel ? { ...x, enabled: v } : x))} />,
                  <Button key="edit" size="small" icon={<Settings className="w-3 h-3" />} onClick={() => openEditChannel(c)}>{t('reportDist.edit')}</Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={Icon ? <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: c.bg }}><Icon className="w-5 h-5" style={{ color: c.color }} /></div> : null}
                  title={<Space><span className="font-semibold">{c.displayName}</span><Tag>{c.template}</Tag>{c.credentialConfigured ? <Tag color="green" icon={<CheckCircle2 className="w-3 h-3" />}>{t('reportDist.configured')}</Tag> : <Tag color="red">{t('reportDist.notConfigured')}</Tag>}</Space>}
                  description={
                    <div className="text-xs text-slate-500 space-y-1">
                      <div>{c.host ?? 'mock'}:{c.port ?? '-'}</div>
                      <div>{t('reportDist.retry')} {c.retryPolicy.maxRetries} {t('reportDist.timesUnit')} · {c.retryPolicy.backoffStrategy === 'exponential' ? t('reportDist.backoff.exponential') : t('reportDist.backoff.fixed')} · {t('reportDist.rateLimit')} {c.rateLimitPerMin}/min</div>
                      <div>{t('reportDist.supports')} {c.supportedFormats.join(', ')}</div>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Modal>
      {/* [G005] 通道编辑 Modal */}
      <Modal
        title={<Space><Settings className="w-4 h-4" /><span>{t('w1Buttons.channel.title')}{editChannel ? ` · ${editChannel.displayName}` : ''}</span></Space>}
        open={editChannel !== null}
        onCancel={() => setEditChannel(null)}
        footer={null}
        width={560}
      >
        <Form form={editChannelForm} layout="vertical" size="small">
          <Form.Item name="displayName" label={t('w1Buttons.channel.name')} rules={[{ required: true, message: t('w1Buttons.channel.nameRequired') }]}>
            <Input />
          </Form.Item>
          <Row gutter={8}>
            <Col span={14}>
              <Form.Item name="host" label={t('w1Buttons.channel.host')}>
                <Input placeholder="mock / https://..." />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="port" label={t('w1Buttons.channel.port')}>
                <InputNumber min={0} max={65535} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="rateLimitPerMin" label={t('w1Buttons.channel.rateLimit')}>
                <InputNumber min={1} max={100000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxRetries" label={t('w1Buttons.channel.maxRetries')}>
                <InputNumber min={0} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditChannel(null)}>{t('w1Buttons.channel.cancel')}</Button>
            <Button type="primary" onClick={() => void handleSaveChannel()}>{t('w1Buttons.channel.save')}</Button>
          </div>
        </Form>
      </Modal>
      {/* [v3.0.6.11-98 Wave3B P1] 任务详情 Modal */}
      <Modal
        title={<Space><Eye className="w-4 h-4 text-blue-500" /><span>{t('reportDist.taskDetailTitle')}</span></Space>}
        open={detailTask !== null}
        onCancel={() => setDetailTask(null)}
        footer={<Button onClick={() => setDetailTask(null)}>{t('reportDist.close')}</Button>}
        width={720}
      >
        {detailTask && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                [t('reportDist.field.taskId'), detailTask.id],
                [t('reportDist.field.reportId'), detailTask.reportId],
                [t('reportDist.field.patient'), `${detailTask.patientName} (${detailTask.patientId})`],
                [t('reportDist.field.channel'), channels.find((x) => x.channel === detailTask.channel)?.displayName ?? detailTask.channel],
                [t('reportDist.field.recipient'), detailTask.recipientName ? `${detailTask.recipientName} (${detailTask.recipient})` : detailTask.recipient],
                [t('reportDist.field.status'), STATUS_LABELS[detailTask.status]],
                [t('reportDist.field.priority'), detailTask.priority],
                [t('reportDist.field.template'), detailTask.template],
                [t('reportDist.field.subject'), detailTask.subject],
                [t('reportDist.field.retry'), `${detailTask.retryCount}/${detailTask.maxRetries}`],
                [t('reportDist.field.duration'), `${(detailTask.durationMs / 1000).toFixed(1)}s`],
                [t('reportDist.field.cost'), `¥${detailTask.cost.toFixed(3)}`],
                ['Trace ID', detailTask.traceId],
                ['ACK', detailTask.ackReceived ? `${t('reportDist.ackConfirmed')}${detailTask.ackCode ? ` (${detailTask.ackCode})` : ''}` : t('reportDist.ackUnconfirmed')],
                [t('reportDist.field.scheduledAt'), detailTask.scheduledAt ? new Date(detailTask.scheduledAt).toLocaleString('zh-CN') : '-'],
                [t('reportDist.field.sentAt'), detailTask.sentAt ? new Date(detailTask.sentAt).toLocaleString('zh-CN') : '-'],
              ].map(([k, v]) => (
                <div key={k} className="p-2 bg-slate-50 rounded">
                  <div className="text-slate-500 mb-1">{k}</div>
                  <div className="text-slate-700 break-all">{v}</div>
                </div>
              ))}
            </div>
            <div className="p-2 bg-slate-50 rounded text-xs">
              <div className="text-slate-500 mb-1">{t('reportDist.field.body')}</div>
              <div className="text-slate-700 whitespace-pre-wrap">{detailTask.body || '-'}</div>
            </div>
            {detailTask.attachments.length > 0 && (
              <div className="p-2 bg-slate-50 rounded text-xs">
                <div className="text-slate-500 mb-1">{t('reportDist.field.attachments', { count: detailTask.attachments.length })}</div>
                {detailTask.attachments.map((at) => (
                  <div key={at.url} className="text-slate-700">{at.name} · {at.format} · {(at.size / 1024).toFixed(1)} KB</div>
                ))}
              </div>
            )}
            {detailTask.errorMessage && (
              <Alert type="error" showIcon message={t('reportDist.field.error', { code: detailTask.errorCode ?? '' })} description={detailTask.errorMessage} />
            )}
            {Object.keys(detailTask.metadata).length > 0 && (
              <div className="p-2 bg-slate-50 rounded text-xs">
                <div className="text-slate-500 mb-1">{t('reportDist.field.metadata')}</div>
                <div className="text-slate-700 break-all">{JSON.stringify(detailTask.metadata)}</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MultiChannelSender;
