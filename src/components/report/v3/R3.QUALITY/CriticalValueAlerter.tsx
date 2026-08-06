/**
 * G005 RIS v3.0.5.1 - R3.QUALITY.211-217 CriticalValueAlerter
 * 危急值告警中心 (30 点)
 * 功能:自动危急值检测 / 多渠道通知 / 响应追踪 / 闭环 / 统计
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  List,
  Button,
  Empty,
  message,
  Tooltip,
  Modal,
  Input,
  Select,
  Segmented,
  Progress,
  Badge,
  Drawer,
  Timeline,
  Divider,
} from 'antd';
import { AlertOctagon, Bell, Phone, MessageSquare, Smartphone, CheckCircle2, Clock, PhoneCall, Send, Mail, Search, RefreshCw, Activity, TrendingUp, Zap, X, Stethoscope } from 'lucide-react';
import { criticalValueService } from '../../../../services/quality/criticalValueService';
import { SmsSender } from '../../../critical/SmsSender';
import { VoiceCallButton } from '../../../critical/VoiceCallButton';
import type { CriticalEvent, CriticalStatus, CriticalLevel, NotificationChannel, CriticalKPI } from '../../../../types/R3/R3.CRITICAL';

const STATUS_META: Record<CriticalStatus, { color: string; label: string; bg: string; icon: React.ReactNode }> = {
  pending: { color: '#dc2626', label: '待通报', bg: '#fee2e2', icon: <PhoneCall size={12} /> },
  notified: { color: '#f59e0b', label: '已通报', bg: '#fef3c7', icon: <Bell size={12} /> },
  acknowledged: { color: '#3b82f6', label: '已确认', bg: '#dbeafe', icon: <CheckCircle2 size={12} /> },
  resolved: { color: '#10b981', label: '已处置', bg: '#d1fae5', icon: <CheckCircle2 size={12} /> },
  overdue: { color: '#7f1d1d', label: '已超时', bg: '#fecaca', icon: <Clock size={12} /> },
  escalated: { color: '#7c3aed', label: '已升级', bg: '#ede9fe', icon: <TrendingUp size={12} /> },
  cancelled: { color: '#64748b', label: '已取消', bg: '#e2e8f0', icon: <X size={12} /> },
};

const LEVEL_META: Record<CriticalLevel, { color: string; label: string; bg: string }> = {
  critical: { color: '#7f1d1d', label: '危急', bg: '#fee2e2' },
  urgent: { color: '#dc2626', label: '紧急', bg: '#fef2f2' },
  warning: { color: '#f59e0b', label: '警告', bg: '#fef3c7' },
  info: { color: '#3b82f6', label: '提示', bg: '#dbeafe' },
};

const CHANNEL_META: Record<NotificationChannel, { icon: React.ComponentType<{ size?: number; color?: string }>; color: string; label: string }> = {
  phone: { icon: Phone, color: '#10b981', label: '电话' },
  sms: { icon: MessageSquare, color: '#3b82f6', label: '短信' },
  wechat: { icon: Smartphone, color: '#10b981', label: '微信' },
  inApp: { icon: Bell, color: '#7c3aed', label: '应用内' },
  email: { icon: Mail, color: '#f59e0b', label: '邮件' },
  pager: { icon: Send, color: '#dc2626', label: '传呼' },
};

const CURRENT_USER_ID = 'U001';
const CURRENT_USER_NAME = '张明远';

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

function formatHM(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export interface CriticalValueAlerterProps {
  level?: CriticalLevel;
  status?: CriticalStatus;
  limit?: number;
  onEventClick?: (e: CriticalEvent) => void;
  showStatistics?: boolean;
  showDetail?: boolean;
  autoRefreshSec?: number;
}

export const CriticalValueAlerter: React.FC<CriticalValueAlerterProps> = ({
  level,
  status,
  limit = 50,
  onEventClick,
  showStatistics = true,
  showDetail = true,
  autoRefreshSec = 0,
}) => {
  const [events, setEvents] = useState<CriticalEvent[]>([]);
  const [kpi, setKpi] = useState<CriticalKPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<CriticalLevel | 'all'>(level ?? 'all');
  const [filterStatus, setFilterStatus] = useState<CriticalStatus | 'all'>(status ?? 'all');
  const [search, setSearch] = useState('');
  const [detailEvent, setDetailEvent] = useState<CriticalEvent | null>(null);
  const [notifyModal, setNotifyModal] = useState<{ open: boolean; event: CriticalEvent | null }>({ open: false, event: null });
  const [notifyChannels, setNotifyChannels] = useState<NotificationChannel[]>(['phone', 'inApp']);
  const [recipient, setRecipient] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [list, k] = await Promise.all([criticalValueService.listEvents(), criticalValueService.getKPI()]);
      setEvents(list);
      setKpi(k);
    } catch (e) {
      message.error('加载危急值事件失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (autoRefreshSec > 0) {
      const t = setInterval(load, autoRefreshSec * 1000);
      return () => clearInterval(t);
    }
  }, [autoRefreshSec]);

  const filtered = useMemo(() => {
    return events
      .filter((e) => (filterLevel === 'all' ? true : e.level === filterLevel))
      .filter((e) => (filterStatus === 'all' ? true : e.status === filterStatus))
      .filter((e) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          e.patientName.toLowerCase().includes(q) ||
          e.ruleName.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          e.detail.toLowerCase().includes(q)
        );
      })
      .slice(0, limit);
  }, [events, filterLevel, filterStatus, search, limit]);

  const stats = useMemo(
    () => ({
      total: events.length,
      pending: events.filter((e) => e.status === 'pending').length,
      notified: events.filter((e) => e.status === 'notified').length,
      acknowledged: events.filter((e) => e.status === 'acknowledged').length,
      resolved: events.filter((e) => e.status === 'resolved').length,
      overdue: events.filter((e) => e.status === 'overdue').length,
      onTimeRate:
        events.length > 0
          ? ((events.filter((e) => e.onTimeNotification).length / events.length) * 100).toFixed(1)
          : '100',
    }),
    [events],
  );

  const handleAcknowledge = async (eventId: string) => {
    try {
      await criticalValueService.acknowledgeEvent(eventId, CURRENT_USER_ID, CURRENT_USER_NAME);
      message.success('已确认接收');
      load();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleResolve = async (eventId: string) => {
    try {
      await criticalValueService.resolveEvent(eventId);
      message.success('已处置归档');
      load();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleEscalate = async (eventId: string) => {
    let reason = '';
    Modal.confirm({
      title: '请输入升级原因(至少 5 字符)',
      content: (
        <Input.TextArea
          rows={3}
          autoFocus
          onChange={(e) => { reason = e.target.value; }}
        />
      ),
      okText: '升级',
      cancelText: '取消',
      onOk: async () => {
        if (!reason || reason.length < 5) {
          message.warning('升级原因过短');
          return;
        }
        try {
          await criticalValueService.escalateEvent(eventId, 'D900', '科主任(升级)', reason);
          message.success('已升级至科主任');
        } catch (e) {
          message.error('操作失败');
        }
      },
    });
  };

  const openNotify = (event: CriticalEvent) => {
    setNotifyModal({ open: true, event });
    setNotifyChannels(['phone', 'inApp']);
    setRecipient('');
  };

  const submitNotify = async () => {
    if (!notifyModal.event) return;
    if (!recipient.trim()) {
      message.warning('请填写接收医生');
      return;
    }
    if (notifyChannels.length === 0) {
      message.warning('请至少选择一种通知渠道');
      return;
    }
    try {
      await criticalValueService.notifyEvent(notifyModal.event.id, notifyChannels, 'D-CLN', recipient);
      message.success(`已通过 ${notifyChannels.length} 个渠道通知 ${recipient}`);
      setNotifyModal({ open: false, event: null });
      load();
    } catch (e) {
      message.error('通知失败');
    }
  };

  return (
    <div data-testid="critical-value-alerter" role="region" aria-label="危急值告警中心">
      <div
        style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <AlertOctagon size={18} />
            <strong style={{ fontSize: 16 }}>危急值告警中心</strong>
            <Tag color="purple">R3.QUALITY.211-217</Tag>
            <Tag color="cyan">自动检测</Tag>
          </Space>
          <Space>
            <Tooltip title="刷新">
              <Button size="small" icon={<RefreshCw size={12} />} onClick={load}>
                刷新
              </Button>
            </Tooltip>
          </Space>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>本月总数</span>}
              value={kpi?.totalThisMonth ?? stats.total}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Activity size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>待通报</span>}
              value={stats.pending}
              styles={{ content: {  color: stats.pending > 0 ? '#fca5a5' : '#fff', fontSize: 18  } }}
              prefix={<PhoneCall size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>已确认</span>}
              value={stats.acknowledged}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<CheckCircle2 size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>已处置</span>}
              value={stats.resolved}
              styles={{ content: {  color: '#bbf7d0', fontSize: 18  } }}
              prefix={<CheckCircle2 size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>通报按时率</span>}
              value={(kpi?.onTimeNotificationRate ?? parseFloat(stats.onTimeRate)).toFixed(1)}
              suffix="%"
              styles={{ content: { 
                color: (kpi?.onTimeNotificationRate ?? parseFloat(stats.onTimeRate)) >= 90 ? '#bbf7d0' : '#fca5a5',
                fontSize: 18,
               } }}
              prefix={<Zap size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>平均响应(min)</span>}
              value={kpi?.avgResponseTimeMinutes?.toFixed(1) ?? '-'}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Clock size={14} />}
            />
          </Col>
        </Row>
      </div>

      {showStatistics && kpi && (
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={6}>
            <Card size="small" title="按分级分布">
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                {(Object.keys(kpi.byLevel) as CriticalLevel[]).map((lv) => {
                  const v = kpi.byLevel[lv] ?? 0;
                  const total = Object.values(kpi.byLevel).reduce((a, b) => a + b, 0) || 1;
                  const pct = Math.round((v / total) * 100);
                  return (
                    <div key={lv}>
                      <Space style={{ width: '100%', justifyContent: 'space-between', fontSize: 12 }}>
                        <span>
                          <Badge color={LEVEL_META[lv].color} /> {LEVEL_META[lv].label}
                        </span>
                        <span>
                          {v} ({pct}%)
                        </span>
                      </Space>
                      <Progress percent={pct} showInfo={false} strokeColor={LEVEL_META[lv].color} size="small" />
                    </div>
                  );
                })}
              </Space>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title="TOP 危急值规则">
              <List
                size="small"
                dataSource={kpi.topRules.slice(0, 5)}
                renderItem={(r) => (
                  <List.Item style={{ padding: '4px 0' }}>
                    <Space>
                      <Tag color="red">{r.ruleCode}</Tag>
                      <span style={{ fontSize: 12 }}>{r.ruleName}</span>
                    </Space>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{r.count}</span>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title="医生响应排行">
              <List
                size="small"
                dataSource={kpi.byDoctor.slice(0, 5)}
                renderItem={(d) => (
                  <List.Item style={{ padding: '4px 0' }}>
                    <Space>
                      <Stethoscope size={12} color="#7c3aed" />
                      <span style={{ fontSize: 12 }}>{d.doctorName}</span>
                    </Space>
                    <Space size={4}>
                      <Tag color="blue">{d.reportedCount}次</Tag>
                      <Tag color={d.onTimeRate >= 0.9 ? 'green' : 'orange'}>{Math.round(d.onTimeRate * 100)}%</Tag>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title="30 天趋势">
              <Space orientation="vertical" size={2} style={{ width: '100%' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12 }}>双审完成率</span>
                  <Tag color="green">{kpi.dualReviewCompletion.toFixed(1)}%</Tag>
                </Space>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12 }}>漏报</span>
                  <Tag color={kpi.missedReports > 0 ? 'red' : 'green'}>{kpi.missedReports}</Tag>
                </Space>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12 }}>P95 响应</span>
                  <Tag>{kpi.p95ResponseTimeMinutes.toFixed(1)} min</Tag>
                </Space>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12 }}>中位响应</span>
                  <Tag color="blue">{kpi.medianResponseTimeMinutes.toFixed(1)} min</Tag>
                </Space>
              </Space>
            </Card>
          </Col>
        </Row>
      )}

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input
            allowClear
            prefix={<Search size={12} />}
            placeholder="搜索患者/规则/ID"
            style={{ width: 220 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Segmented
            value={filterLevel}
            onChange={(v) => setFilterLevel(v as CriticalLevel | 'all')}
            options={[
              { label: '全部', value: 'all' },
              { label: '危急', value: 'critical' },
              { label: '紧急', value: 'urgent' },
              { label: '警告', value: 'warning' },
              { label: '提示', value: 'info' },
            ]}
          />
          <Segmented
            value={filterStatus}
            onChange={(v) => setFilterStatus(v as CriticalStatus | 'all')}
            options={[
              { label: '全部状态', value: 'all' },
              { label: '待通报', value: 'pending' },
              { label: '已通报', value: 'notified' },
              { label: '已确认', value: 'acknowledged' },
              { label: '已处置', value: 'resolved' },
              { label: '已升级', value: 'escalated' },
            ]}
          />
        </Space>
      </Card>

      <List
        loading={loading}
        dataSource={filtered}
        locale={{ emptyText: <Empty description="无危急值事件" /> }}
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 4,
          maxHeight: 600,
          overflowY: 'auto',
        }}
        renderItem={(e) => {
          const sm = STATUS_META[e.status];
          const lm = LEVEL_META[e.level];
          return (
            <List.Item
              key={e.id}
              onClick={() => {
                if (showDetail) setDetailEvent(e);
                onEventClick?.(e);
              }}
              data-testid={`critical-event-${e.id}`}
              role="button"
              aria-label={`危急值事件 ${e.patientName} ${e.ruleName}`}
              tabIndex={0}
              style={{
                cursor: 'pointer',
                padding: 10,
                borderRadius: 6,
                marginBottom: 6,
                background:
                  e.status === 'pending'
                    ? '#fef2f2'
                    : e.status === 'overdue'
                      ? '#fee2e2'
                      : e.status === 'escalated'
                        ? '#f5f3ff'
                        : 'transparent',
                borderLeft:
                  e.status === 'pending'
                    ? '4px solid #dc2626'
                    : e.status === 'overdue'
                      ? '4px solid #7f1d1d'
                      : e.status === 'escalated'
                        ? '4px solid #7c3aed'
                        : '4px solid transparent',
              }}
            >
              <List.Item.Meta
                avatar={
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      background: sm.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AlertOctagon size={20} color={sm.color} />
                  </div>
                }
                title={
                  <Space wrap>
                    <strong>{e.patientName}</strong>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      {e.gender} · {e.age}岁 · {e.modality}/{e.bodyPart}
                    </span>
                    <Tag color={lm.color} style={{ marginLeft: 4 }}>
                      {lm.label}
                    </Tag>
                    <Tag color={sm.color}>{sm.label}</Tag>
                    {e.veto && (
                      <Tag color="red" data-testid={`veto-${e.id}`}>
                        一票否决
                      </Tag>
                    )}
                    {e.dualReviewRequired && (
                      <Tag color="purple" data-testid={`dual-${e.id}`}>
                        双审
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  <div>
                    <div style={{ fontSize: 12, color: '#334155' }}>
                      <strong>{e.ruleCode}</strong> · {e.ruleName}
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>📋 {e.detail}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      <Clock size={10} /> 报告 {timeAgo(e.reportedAt)} by {e.reportedByName}(
                      {e.reportedByTitle})
                      {e.receivingDoctorName && (
                        <span style={{ color: '#10b981' }}> · 接收:{e.receivingDoctorName}</span>
                      )}
                    </div>
                    {e.channels.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <Space size={4} wrap>
                          {e.channels.map((ch) => {
                            const cm = CHANNEL_META[ch];
                            const Icon = cm.icon;
                            return (
                              <Tag
                                key={ch}
                                color="default"
                                style={{ fontSize: 12 }}
                                icon={<Icon size={10} color={cm.color} />}
                              >
                                {cm.label}
                              </Tag>
                            );
                          })}
                        </Space>
                      </div>
                    )}
                    {e.responseTimeMinutes !== undefined && (
                      <div
                        style={{
                          fontSize: 12,
                          marginTop: 4,
                          color: e.onTimeNotification ? '#10b981' : '#dc2626',
                        }}
                      >
                        响应 {e.responseTimeMinutes} 分钟 · {e.onTimeNotification ? '✓ 按时' : '⚠ 超时'}
                      </div>
                    )}
                  </div>
                }
              />
              <Space orientation="vertical" size={2} align="end">
                {e.status === 'pending' && (
                  <Button
                    size="small"
                    type="primary"
                    icon={<Send size={10} />}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      openNotify(e);
                    }}
                  >
                    多渠道通知
                  </Button>
                )}
                {e.status === 'pending' || e.status === 'notified' ? (
                  <Space size={2}>
                    <span onClick={(ev) => ev.stopPropagation()}>
                      <SmsSender
                        size="small"
                        text="短信"
                        patientName={e.patientName}
                        ruleName={e.ruleName}
                        reportedBy={e.reportedByName}
                        criticalKind={e.level}
                      />
                    </span>
                    <span onClick={(ev) => ev.stopPropagation()}>
                      <VoiceCallButton
                        size="small"
                        text="语音"
                        patientName={e.patientName}
                        ruleName={e.ruleName}
                        modality={e.modality}
                        bodyPart={e.bodyPart}
                      />
                    </span>
                  </Space>
                ) : null}
                {e.status === 'notified' && (
                  <Button
                    size="small"
                    type="primary"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleAcknowledge(e.id);
                    }}
                  >
                    确认
                  </Button>
                )}
                {e.status === 'acknowledged' && (
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckCircle2 size={10} />}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleResolve(e.id);
                    }}
                  >
                    处理
                  </Button>
                )}
                {e.status === 'resolved' && (
                  <Tag color="green" icon={<CheckCircle2 size={10} />}>
                    已闭环
                  </Tag>
                )}
                {(e.status === 'pending' || e.status === 'notified' || e.status === 'acknowledged') && (
                  <Button
                    size="small"
                    danger
                    icon={<TrendingUp size={10} />}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleEscalate(e.id);
                    }}
                  >
                    升级
                  </Button>
                )}
              </Space>
            </List.Item>
          );
        }}
      />

      <Drawer
        title={
          <Space>
            <AlertOctagon size={16} color="#dc2626" />
            <span>危急值详情</span>
            {detailEvent && <Tag color={LEVEL_META[detailEvent.level].color}>{LEVEL_META[detailEvent.level].label}</Tag>}
          </Space>
        }
        open={!!detailEvent}
        onClose={() => setDetailEvent(null)}
        width={520}
      >
        {detailEvent && (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Card size="small" title="基本信息">
              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>患者</div>
                  <div>
                    {detailEvent.patientName}({detailEvent.gender} · {detailEvent.age}岁)
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>检查</div>
                  <div>
                    {detailEvent.modality} / {detailEvent.bodyPart}
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>报告医生</div>
                  <div>
                    {detailEvent.reportedByName}({detailEvent.reportedByTitle})
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>报告时间</div>
                  <div>{new Date(detailEvent.reportedAt).toLocaleString()}</div>
                </Col>
                <Col span={24}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>危急值规则</div>
                  <div>
                    <Tag color="red">{detailEvent.ruleCode}</Tag>
                    {detailEvent.ruleName}
                    {detailEvent.veto && <Tag color="red">一票否决</Tag>}
                    {detailEvent.dualReviewRequired && <Tag color="purple">需双审</Tag>}
                  </div>
                </Col>
                <Col span={24}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>危急值所见</div>
                  <div style={{ color: '#dc2626', fontWeight: 600 }}>{detailEvent.detail}</div>
                </Col>
              </Row>
            </Card>

            <Card size="small" title="通知与响应">
              <Timeline
                items={[
                  {
                    color: 'red',
                    children: (
                      <>
                        <strong>报告生成</strong> {formatHM(detailEvent.reportedAt)} ·{' '}
                        {detailEvent.reportedByName}
                      </>
                    ),
                  },
                  ...(detailEvent.receivingTime
                    ? [
                        {
                          color: 'orange',
                          children: (
                            <>
                              <strong>通报接收医生</strong> {formatHM(detailEvent.receivingTime)} ·{' '}
                              {detailEvent.receivingDoctorName}
                            </>
                          ),
                        },
                      ]
                    : []),
                  ...(detailEvent.acknowledgedTime
                    ? [
                        {
                          color: 'blue',
                          children: (
                            <>
                              <strong>医生确认</strong> {formatHM(detailEvent.acknowledgedTime)} ·{' '}
                              {detailEvent.acknowledgedByName}
                              {detailEvent.responseTimeMinutes !== undefined && (
                                <Tag
                                  color={detailEvent.onTimeNotification ? 'green' : 'red'}
                                  style={{ marginLeft: 8 }}
                                >
                                  {detailEvent.responseTimeMinutes}min
                                </Tag>
                              )}
                            </>
                          ),
                        },
                      ]
                    : []),
                  ...(detailEvent.resolvedTime
                    ? [
                        {
                          color: 'green',
                          children: (
                            <>
                              <strong>处置闭环</strong> {formatHM(detailEvent.resolvedTime)}
                            </>
                          ),
                        },
                      ]
                    : []),
                  ...(detailEvent.escalatedAt
                    ? [
                        {
                          color: 'purple',
                          children: (
                            <>
                              <strong>升级</strong> {formatHM(detailEvent.escalatedAt)} →{' '}
                              {detailEvent.escalatedToName}
                              <div style={{ fontSize: 12, color: '#64748b' }}>
                                原因:{detailEvent.escalationReason}
                              </div>
                            </>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
              {detailEvent.channels.length > 0 && (
                <>
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>已使用通知渠道</div>
                  <Space wrap>
                    {detailEvent.channelAttempts.map((a, i) => {
                      const cm = CHANNEL_META[a.channel];
                      const Icon = cm.icon;
                      return (
                        <Tag
                          key={i}
                          color={a.success ? 'green' : 'red'}
                          icon={<Icon size={10} color={cm.color} />}
                        >
                          {cm.label} {a.success ? '✓' : '✗'} {formatHM(a.attemptedAt)}
                        </Tag>
                      );
                    })}
                  </Space>
                </>
              )}
            </Card>

            {detailEvent.dualReview && (
              <Card size="small" title="双审记录">
                <Row gutter={8}>
                  <Col span={12}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>第一审</div>
                    <div>{detailEvent.dualReview.firstReviewerName ?? '待审'}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      {detailEvent.dualReview.firstReviewAt
                        ? formatHM(detailEvent.dualReview.firstReviewAt)
                        : '-'}
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>第二审</div>
                    <div>{detailEvent.dualReview.secondReviewerName ?? '待审'}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      {detailEvent.dualReview.secondReviewAt
                        ? formatHM(detailEvent.dualReview.secondReviewAt)
                        : '-'}
                    </div>
                  </Col>
                </Row>
              </Card>
            )}

            {detailEvent.sop && detailEvent.sop.length > 0 && (
              <Card size="small" title="SOP 6 步闭环">
                <Timeline
                  items={detailEvent.sop.map((s) => ({
                    color: s.completed ? 'green' : 'gray',
                    children: (
                      <>
                        <strong>
                          {s.step}. {s.title}
                        </strong>{' '}
                        <span style={{ fontSize: 12, color: '#64748b' }}>({s.deadlineMinutes}min)</span>
                        <div style={{ fontSize: 12, color: '#475569' }}>{s.description}</div>
                      </>
                    ),
                  }))}
                />
              </Card>
            )}

            <Card size="small" title="元数据">
              <Space orientation="vertical" size={2} style={{ fontSize: 12 }}>
                <div>
                  <strong>Event ID:</strong> {detailEvent.id}
                </div>
                <div>
                  <strong>Hash:</strong> <code>{detailEvent.hash}</code>
                </div>
                <div>
                  <strong>Escalation Level:</strong> {detailEvent.escalationLevel}
                </div>
              </Space>
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title="多渠道通知"
        open={notifyModal.open}
        onCancel={() => setNotifyModal({ open: false, event: null })}
        onOk={submitNotify}
        okText="发送"
        cancelText="取消"
      >
        {notifyModal.event && (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <div>
              <strong>{notifyModal.event.patientName}</strong> · {notifyModal.event.ruleName}
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>接收医生</div>
              <Input
                placeholder="如:陈雅芝(急诊神内)"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>通知渠道(可多选)</div>
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                value={notifyChannels}
                onChange={(v) => setNotifyChannels(v as NotificationChannel[])}
                options={[
                  { label: '☎ 电话', value: 'phone' },
                  { label: '✉ 短信', value: 'sms' },
                  { label: '💬 微信', value: 'wechat' },
                  { label: '🔔 应用内', value: 'inApp' },
                  { label: '📧 邮件', value: 'email' },
                  { label: '📟 传呼', value: 'pager' },
                ]}
              />
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default CriticalValueAlerter;
