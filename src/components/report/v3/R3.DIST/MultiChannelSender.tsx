/**
 * G005 放射RIS系统 v3.0.5.1 - 多通道送达
 * R3.DIST 组 D:多通道推送(微信/短信/钉钉/邮件/站内/DICOM/纸质/云盘/胶片)
 * 25 升级点
 */
import { DELIVERY_CHANNELS_CONFIG, DELIVERY_TASKS_MOCK, DELIVERY_QUEUE_MOCK } from '@data/reportDistributionMock';
import { sendMultiChannel, retryDeliveryTask, cancelDeliveryTask } from '@services/distribution/distributionService';
import type { DeliveryChannel, DeliveryChannelConfig, DeliveryTask, DeliveryStatus } from '@types/R3/R3.DIST';
import { DELIVERY_STATUS_COLORS as STATUS_COLORS } from '@utils/statusColors';
import { Card, Space, Button, Tag, Tooltip, message, Modal, Form, Select, Switch, Table, Empty, Statistic, Row, Col, Divider, Alert, List, Progress } from 'antd';
import { Send, MessageSquare, Smartphone, Mail, Bell, Database, Printer, Cloud, Film, CheckCircle2, XCircle, Loader2, RefreshCw, Settings, Eye, Filter, Layers, Inbox, Activity, Clock } from 'lucide-react';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

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
  pending: '待发送', queued: '队列中', sending: '发送中', sent: '已发送',
  delivered: '已送达', read: '已阅读', failed: '失败', cancelled: '已取消', expired: '已过期',
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
    return tasks.filter((t) => {
      if (filterChannel !== 'all' && t.channel !== filterChannel) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (reportId && t.reportId !== reportId) return false;
      return true;
    });
  }, [tasks, filterChannel, filterStatus, reportId]);

  const queue = DELIVERY_QUEUE_MOCK;

  const toggleChannel = (c: DeliveryChannel) => {
    setSelectedChannels((arr) => arr.includes(c) ? arr.filter((x) => x !== c) : [...arr, c]);
  };

  const handleSend = useCallback(async () => {
    if (selectedChannels.length === 0) {
      message.warning('请选择至少一个通道');
      return;
    }
    if (!reportId || !patientId) {
      message.warning('请先选择报告和患者');
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
      setTasks((t) => [...newTasks, ...t]);
      message.success(`已发送到 ${result.sent} 个通道`);
      onSend?.(result.taskIds);
      if (hideModalTimerRef.current !== null) clearTimeout(hideModalTimerRef.current);
      hideModalTimerRef.current = setTimeout(() => setShowSendModal(false), 1000);
    } catch (e) {
      stopProgress();
      message.error(`发送失败: ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  }, [reportId, patientId, selectedChannels, recipients, template, priority, onSend]);

  const handleRetry = useCallback(async (taskId: string) => {
    const r = await retryDeliveryTask(taskId);
    if (r.success) {
      setTasks((arr) => arr.map((t) => t.id === taskId ? { ...t, status: r.newStatus, retryCount: t.retryCount + 1, scheduledAt: r.retriedAt } : t));
      message.success('已重试');
    }
  }, []);

  const handleCancel = useCallback(async (taskId: string) => {
    Modal.confirm({
      title: '确认取消',
      content: '取消后该任务将不会发送',
      onOk: async () => {
        const r = await cancelDeliveryTask(taskId, '用户取消');
        if (r.success) {
          setTasks((arr) => arr.map((t) => t.id === taskId ? { ...t, status: 'cancelled' } : t));
          message.success('已取消');
        }
      },
    });
  }, []);

  const columns = [
    { title: '通道', dataIndex: 'channel', key: 'channel', width: 100, render: (c: DeliveryChannel) => {
      const Icon = CHANNEL_ICON_MAP[c];
      const cfg = channels.find((x) => x.channel === c);
      return (
        <Space size={4}>
          {Icon && <Icon className="w-3 h-3" style={{ color: cfg?.color }} />}
          <span style={{ color: cfg?.color }}>{cfg?.displayName}</span>
        </Space>
      );
    } },
    { title: '收件人', dataIndex: 'recipient', key: 'recipient', ellipsis: true, width: 180 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 110, render: (s: DeliveryStatus) => <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</Tag> },
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80, render: (p: string) => <Tag color={p === 'urgent' ? 'red' : p === 'high' ? 'orange' : 'default'}>{p}</Tag> },
    { title: '重试', dataIndex: 'retryCount', key: 'retryCount', width: 60, render: (n: number, r: DeliveryTask) => <span>{n}/{r.maxRetries}</span> },
    { title: '耗时', dataIndex: 'durationMs', key: 'durationMs', width: 80, render: (n: number) => `${(n / 1000).toFixed(1)}s` },
    { title: '费用', dataIndex: 'cost', key: 'cost', width: 80, render: (n: number) => `¥${n.toFixed(3)}` },
    { title: '时间', dataIndex: 'sentAt', key: 'sentAt', width: 140, render: (s: string) => s ? new Date(s).toLocaleTimeString() : '-' },
    { title: '操作', key: 'action', width: 140, render: (_: any, r: DeliveryTask) => (
      <Space size={4}>
        {r.status === 'failed' && <Button size="small" type="primary" icon={<RefreshCw className="w-3 h-3" />} onClick={() => handleRetry(r.id)}>重试</Button>}
        {(r.status === 'pending' || r.status === 'queued' || r.status === 'sending') && <Button size="small" danger icon={<XCircle className="w-3 h-3" />} onClick={() => handleCancel(r.id)}>取消</Button>}
        <Button size="small" icon={<Eye className="w-3 h-3" />}>详情</Button>
      </Space>
    ) },
  ];

  return (
    <div className="space-y-3">
      {/* 队列状态 */}
      <Row gutter={8}>
        <Col span={4}><Card size="small"><Statistic title="待发送" value={queue.pending} prefix={<Clock className="w-3 h-3" style={{ color: '#f59e0b' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="发送中" value={queue.sending} prefix={<Loader2 className="w-3 h-3 animate-spin" style={{ color: '#3b82f6' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="已送达" value={queue.delivered} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="失败" value={queue.failed} prefix={<XCircle className="w-3 h-3" style={{ color: '#dc2626' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="今日" value={queue.totalToday} prefix={<Activity className="w-3 h-3" style={{ color: '#7c3aed' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="成功率" value={queue.successRate * 100} suffix="%" precision={1} styles={{ content: {  fontSize: 18, color: '#10b981'  } }} /></Card></Col>
      </Row>

      {/* 通道选择 + 发送按钮 */}
      <Card size="small" title={<Space><Layers className="w-4 h-4" /><span>多通道送达</span><Tag color="orange" style={{ fontSize: 10 }}>演示数据 (TASKS/QUEUE)</Tag></Space>} className="shadow-sm"
        extra={
          <Space>
            <Button size="small" icon={<Settings className="w-3 h-3" />} onClick={() => setShowConfig(true)}>通道配置</Button>
            <Button size="small" type="primary" icon={<Send className="w-3 h-3" />} onClick={() => setShowSendModal(true)} disabled={!reportId}>立即发送</Button>
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
                      {c.enabled ? `${c.rateLimitPerMin}/min` : '已禁用'}
                    </div>
                  </div>
                </div>
              </Tooltip>
            );
          })}
        </div>
        <Divider className="my-3" />
        <Row gutter={8}>
          <Col span={6}><div className="text-xs text-slate-500">已选 {selectedChannels.length} 个通道</div></Col>
          <Col span={6}><Tag color="purple">模板: {template}</Tag></Col>
          <Col span={6}><Tag color={priority === 'urgent' ? 'red' : priority === 'high' ? 'orange' : 'blue'}>优先级: {priority}</Tag></Col>
          <Col span={6} className="text-right">
            <Space>
              <span className="text-xs text-slate-500">收件人:</span>
              <Select size="small" value="李医生" style={{ width: 120 }} options={[{ value: '李医生', label: '李医生(主诊)' }, { value: '王护士', label: '王护士' }, { value: '张主任', label: '张主任' }]} />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 任务列表 */}
      <Card size="small" title={<Space><Filter className="w-4 h-4" /><span>推送任务</span></Space>} className="shadow-sm"
        extra={
          <Space>
            <Select size="small" value={filterChannel} onChange={setFilterChannel} style={{ width: 110 }} options={[{ value: 'all', label: '全部通道' }, ...channels.map((c) => ({ value: c.channel, label: c.displayName }))]} />
            <Select size="small" value={filterStatus} onChange={setFilterStatus} style={{ width: 110 }} options={[{ value: 'all', label: '全部状态' }, ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))]} />
          </Space>
        }>
        {filteredTasks.length > 0 ? (
          <Table
            size="small"
            rowKey="id"
            columns={columns}
            dataSource={filteredTasks.slice(0, 30)}
            pagination={{ pageSize: 10, size: 'small' }}
            scroll={{ x: 800 }}
          />
        ) : (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无任务" />
        )}
      </Card>

      {/* 发送 Modal */}
      <Modal
        title={<Space><Send className="w-4 h-4 text-blue-500" /><span>多通道发送确认</span></Space>}
        open={showSendModal}
        onCancel={() => !sending && setShowSendModal(false)}
        footer={null}
      >
        {sending || sendProgress === 100 ? (
          <div className="py-6 space-y-3 text-center">
            <Loader2 className={`w-12 h-12 mx-auto ${sending ? 'animate-spin' : ''} text-blue-500`} />
            <Progress percent={sendProgress} status={sendProgress === 100 ? 'success' : 'active'} />
            <div className="text-sm text-slate-600">{sendProgress === 100 ? '发送完成!' : '正在发送到下游...'}</div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold mb-2">目标通道 ({selectedChannels.length})</div>
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
              <Form.Item label="模板">
                <Select size="small" value={template} onChange={setTemplate} options={[
                  { value: 'standard-v1', label: '标准 v1' },
                  { value: 'critical-v2', label: '危急值 v2' },
                  { value: 'patient-v1', label: '患者 v1' },
                ]} />
              </Form.Item>
              <Form.Item label="优先级">
                <Select size="small" value={priority} onChange={setPriority} options={[
                  { value: 'low', label: '低' }, { value: 'normal', label: '普通' }, { value: 'high', label: '高' }, { value: 'urgent', label: '紧急' },
                ]} />
              </Form.Item>
            </Form>
            <Divider className="my-2" />
            <Alert type="info" title={`预计费用: ¥${(selectedChannels.length * 0.02).toFixed(3)} | 预计耗时: ${(selectedChannels.length * 0.5).toFixed(1)}s`} />
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowSendModal(false)}>取消</Button>
              <Button type="primary" icon={<Send className="w-3 h-3" />} onClick={handleSend}>确认发送</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 通道配置 Modal */}
      <Modal
        title={<Space><Settings className="w-4 h-4" /><span>通道配置</span></Space>}
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
                  <Button key="edit" size="small" icon={<Settings className="w-3 h-3" />}>编辑</Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={Icon ? <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: c.bg }}><Icon className="w-5 h-5" style={{ color: c.color }} /></div> : null}
                  title={<Space><span className="font-semibold">{c.displayName}</span><Tag>{c.template}</Tag>{c.credentialConfigured ? <Tag color="green" icon={<CheckCircle2 className="w-3 h-3" />}>已配置</Tag> : <Tag color="red">未配置</Tag>}</Space>}
                  description={
                    <div className="text-xs text-slate-500 space-y-1">
                      <div>📡 {c.host ?? 'mock'}:{c.port ?? '-'}</div>
                      <div>🔁 重试 {c.retryPolicy.maxRetries} 次 · {c.retryPolicy.backoffStrategy === 'exponential' ? '指数退避' : '固定'} · 限流 {c.rateLimitPerMin}/min</div>
                      <div>📋 支持: {c.supportedFormats.join(', ')}</div>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Modal>
    </div>
  );
};

export default MultiChannelSender;
