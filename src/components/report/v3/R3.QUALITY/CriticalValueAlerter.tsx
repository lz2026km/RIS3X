/**
 * G005 RIS v3.0.5.1 - R3.QUALITY.211-217 CriticalValueAlerter
 * 危急值告警中心 (30 点)
 * 功能:自动危急值检测 / 多渠道通知 / 响应追踪 / 闭环 / 统计
 */
import { criticalValueService } from '../../../../services/quality/criticalValueService';
import type { CriticalEvent, CriticalStatus, CriticalLevel, NotificationChannel, CriticalKPI } from '../../../../types/R3/R3.CRITICAL';
import { SmsSender } from '../../../critical/SmsSender';
import { VoiceCallButton } from '../../../critical/VoiceCallButton';
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
import { AlertOctagon, Bell, Phone, MessageSquare, Smartphone, CheckCircle2, Clock, PhoneCall, Send, Mail, Search, RefreshCw, Activity, TrendingUp, Zap, X, Stethoscope, type LucideIcon } from 'lucide-react';
import { BellOff } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react';
import { t } from '../../../../i18n/appI18n';

const STATUS_META: Record<CriticalStatus, { color: string; label: string; bg: string; icon: React.ReactNode }> = {
  pending: { color: 'var(--color-error-600)', label: t('criticalValue.status.pending'), bg: 'var(--color-error-bg)', icon: <PhoneCall size={12} /> },
  notified: { color: 'var(--color-warning-500)', label: t('criticalValue.status.notified'), bg: 'var(--color-warning-bg)', icon: <Bell size={12} /> },
  acknowledged: { color: 'var(--color-primary-500)', label: t('criticalValue.status.acknowledged'), bg: 'var(--color-info-bg)', icon: <CheckCircle2 size={12} /> },
  resolved: { color: '#10b981', label: t('criticalValue.status.resolved'), bg: 'var(--color-success-bg)', icon: <CheckCircle2 size={12} /> },
  overdue: { color: '#7f1d1d', label: t('criticalValue.status.overdue'), bg: 'var(--color-error-bg)', icon: <Clock size={12} /> },
  escalated: { color: '#7c3aed', label: t('criticalValue.status.escalated'), bg: 'var(--color-info-bg)', icon: <TrendingUp size={12} /> },
  cancelled: { color: '#64748b', label: t('criticalValue.status.cancelled'), bg: 'var(--border-color)', icon: <X size={12} /> },
};

const LEVEL_META: Record<CriticalLevel, { color: string; label: string; bg: string }> = {
  critical: { color: '#7f1d1d', label: t('criticalValue.level.critical'), bg: 'var(--color-error-bg)' },
  urgent: { color: 'var(--color-error-600)', label: t('criticalValue.level.urgent'), bg: 'var(--color-error-bg)' },
  warning: { color: 'var(--color-warning-500)', label: t('criticalValue.level.warning'), bg: 'var(--color-warning-bg)' },
  info: { color: 'var(--color-primary-500)', label: t('criticalValue.level.info'), bg: 'var(--color-info-bg)' },
};

const CHANNEL_META: Record<NotificationChannel, { icon: LucideIcon; color: string; label: string }> = {
  phone: { icon: Phone, color: '#10b981', label: t('criticalValue.channel.phone') },
  sms: { icon: MessageSquare, color: 'var(--color-primary-500)', label: t('criticalValue.channel.sms') },
  wechat: { icon: Smartphone, color: '#10b981', label: t('criticalValue.channel.wechat') },
  inApp: { icon: Bell, color: '#7c3aed', label: t('criticalValue.channel.inApp') },
  email: { icon: Mail, color: 'var(--color-warning-500)', label: t('criticalValue.channel.email') },
  pager: { icon: Send, color: 'var(--color-error-600)', label: t('criticalValue.channel.pager') },
};

const CURRENT_USER_ID = 'U001';
const CURRENT_USER_NAME = '张明远';

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return t('criticalValue.justNow');
  if (m < 60) return t('w9e.criticalValueAlerter.timeMinutesAgo', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('w9e.criticalValueAlerter.timeHoursAgo', { count: h });
  return t('w9e.criticalValueAlerter.timeDaysAgo', { count: Math.floor(h / 24) });
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
      message.error(t('criticalValue.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (autoRefreshSec > 0) {
      const timer = setInterval(load, autoRefreshSec * 1000);
      return () => clearInterval(timer);
    }
    return undefined;
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
      message.success(t('criticalValue.ackReceived'));
      load();
    } catch (e) {
      message.error(t('criticalValue.opFailed'));
    }
  };

  const handleResolve = async (eventId: string) => {
    try {
      await criticalValueService.resolveEvent(eventId);
      message.success(t('criticalValue.resolveArchived'));
      load();
    } catch (e) {
      message.error(t('criticalValue.opFailed'));
    }
  };

  const handleEscalate = async (eventId: string) => {
    let reason = '';
    Modal.confirm({
      title: t('criticalValue.escalateReasonTitle'),
      content: (
        <Input.TextArea
          rows={3}
          autoFocus
          onChange={(e) => { reason = e.target.value; }}
        />
      ),
      okText: t('criticalValue.escalate'),
      cancelText: t('criticalValue.cancel'),
      onOk: async () => {
        if (!reason || reason.length < 5) {
          message.warning(t('criticalValue.reasonTooShort'));
          return;
        }
        try {
          await criticalValueService.escalateEvent(eventId, 'D900', '科主任(升级)', reason);
          message.success(t('criticalValue.escalatedToDirector'));
        } catch (e) {
          message.error(t('criticalValue.opFailed'));
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
      message.warning(t('criticalValue.enterRecipient'));
      return;
    }
    if (notifyChannels.length === 0) {
      message.warning(t('criticalValue.selectChannel'));
      return;
    }
    try {
      await criticalValueService.notifyEvent(notifyModal.event.id, notifyChannels, 'D-CLN', recipient);
      message.success(t('w9e.criticalValueAlerter.notifiedChannels', { count: notifyChannels.length, recipient }));
      setNotifyModal({ open: false, event: null });
      load();
    } catch (e) {
      message.error(t('criticalValue.notifyFailed'));
    }
  };

  return (
    <div data-testid="critical-value-alerter" role="region" aria-label={t('criticalValue.centerTitle')}>
      <div
        style={{
          background: 'linear-gradient(135deg, var(--color-error-600) 0%, #7f1d1d 100%)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <AlertOctagon size={18} />
            <strong style={{ fontSize: 16 }}>{t('criticalValue.centerTitle')}</strong>
            <Tag color="purple">R3.QUALITY.211-217</Tag>
            <Tag color="cyan">{t('criticalValue.autoDetect')}</Tag>
          </Space>
          <Space>
            <Tooltip title={t('criticalValue.refresh')}>
              <Button size="small" icon={<RefreshCw size={12} />} onClick={load}>
                {t('criticalValue.refresh')}
              </Button>
            </Tooltip>
          </Space>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('criticalValue.thisMonthTotal')}</span>}
              value={kpi?.totalThisMonth ?? stats.total}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Activity size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('criticalValue.status.pending')}</span>}
              value={stats.pending}
              styles={{ content: {  color: stats.pending > 0 ? '#fca5a5' : '#fff', fontSize: 18  } }}
              prefix={<PhoneCall size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('criticalValue.status.acknowledged')}</span>}
              value={stats.acknowledged}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<CheckCircle2 size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('criticalValue.status.resolved')}</span>}
              value={stats.resolved}
              styles={{ content: {  color: '#bbf7d0', fontSize: 18  } }}
              prefix={<CheckCircle2 size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('criticalValue.onTimeRate')}</span>}
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
              title={<span style={{ color: '#fff' }}>{t('criticalValue.avgResponseMin')}</span>}
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
            <Card size="small" title={t('criticalValue.byLevel')}>
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
            <Card size="small" title={t('criticalValue.topRules')}>
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
            <Card size="small" title={t('criticalValue.doctorRanking')}>
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
                      <Tag color="blue">{d.reportedCount}{t('criticalValue.times')}</Tag>
                      <Tag color={d.onTimeRate >= 0.9 ? 'green' : 'orange'}>{Math.round(d.onTimeRate * 100)}%</Tag>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title={t('criticalValue.trend30d')}>
              <Space orientation="vertical" size={2} style={{ width: '100%' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12 }}>{t('criticalValue.dualReviewCompletion')}</span>
                  <Tag color="green">{kpi.dualReviewCompletion.toFixed(1)}%</Tag>
                </Space>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12 }}>{t('criticalValue.missedReports')}</span>
                  <Tag color={kpi.missedReports > 0 ? 'red' : 'green'}>{kpi.missedReports}</Tag>
                </Space>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12 }}>{t('criticalValue.p95Response')}</span>
                  <Tag>{kpi.p95ResponseTimeMinutes.toFixed(1)} min</Tag>
                </Space>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12 }}>{t('criticalValue.medianResponse')}</span>
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
            placeholder={t('criticalValue.searchPlaceholder')}
            style={{ width: 220 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Segmented
            value={filterLevel}
            onChange={(v) => setFilterLevel(v as CriticalLevel | 'all')}
            options={[
              { label: t('criticalValue.all'), value: 'all' },
              { label: t('criticalValue.level.critical'), value: 'critical' },
              { label: t('criticalValue.level.urgent'), value: 'urgent' },
              { label: t('criticalValue.level.warning'), value: 'warning' },
              { label: t('criticalValue.level.info'), value: 'info' },
            ]}
          />
          <Segmented
            value={filterStatus}
            onChange={(v) => setFilterStatus(v as CriticalStatus | 'all')}
            options={[
              { label: t('criticalValue.allStatus'), value: 'all' },
              { label: t('criticalValue.status.pending'), value: 'pending' },
              { label: t('criticalValue.status.notified'), value: 'notified' },
              { label: t('criticalValue.status.acknowledged'), value: 'acknowledged' },
              { label: t('criticalValue.status.resolved'), value: 'resolved' },
              { label: t('criticalValue.status.escalated'), value: 'escalated' },
            ]}
          />
        </Space>
      </Card>

      <List
        loading={loading}
        dataSource={filtered}
        locale={{ emptyText: <Empty image={<BellOff size={48} style={{opacity:0.4}}/>} description={t('criticalValue.noEvents')} /> }}
        style={{
          background: 'var(--bg-card)',
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
              aria-label={t('w9e.criticalValueAlerter.eventAria', { patient: e.patientName, rule: e.ruleName })}
              tabIndex={0}
              style={{
                cursor: 'pointer',
                padding: 10,
                borderRadius: 6,
                marginBottom: 6,
                background:
                  e.status === 'pending'
                    ? 'var(--color-error-bg)'
                    : e.status === 'overdue'
                      ? 'var(--color-error-bg)'
                      : e.status === 'escalated'
                        ? 'var(--color-info-bg)'
                        : 'transparent',
                borderLeft:
                  e.status === 'pending'
                    ? '4px solid var(--color-error-600)'
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
                      {e.gender} · {e.age}{t('criticalValue.yearsOld')} · {e.modality}/{e.bodyPart}
                    </span>
                    <Tag color={lm.color} style={{ marginLeft: 4 }}>
                      {lm.label}
                    </Tag>
                    <Tag color={sm.color}>{sm.label}</Tag>
                    {e.veto && (
                      <Tag color="red" data-testid={`veto-${e.id}`}>
                        {t('criticalValue.veto')}
                      </Tag>
                    )}
                    {e.dualReviewRequired && (
                      <Tag color="purple" data-testid={`dual-${e.id}`}>
                        {t('criticalValue.dualReview')}
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  <div>
                    <div style={{ fontSize: 12, color: '#334155' }}>
                      <strong>{e.ruleCode}</strong> · {e.ruleName}
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{e.detail}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      <Clock size={10} /> {t('criticalValue.report')} {timeAgo(e.reportedAt)} by {e.reportedByName}(
                      {e.reportedByTitle})
                      {e.receivingDoctorName && (
                        <span style={{ color: '#10b981' }}> · {t('criticalValue.receivedBy')}{e.receivingDoctorName}</span>
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
                          color: e.onTimeNotification ? '#10b981' : 'var(--color-error-600)',
                        }}
                      >
                        {t('criticalValue.response')} {e.responseTimeMinutes} {t('criticalValue.minutes')} · {e.onTimeNotification ? t('criticalValue.onTime') : t('criticalValue.overdue')}
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
                    {t('criticalValue.multiChannelNotify')}
                  </Button>
                )}
                {e.status === 'pending' || e.status === 'notified' ? (
                  <Space size={2}>
                    <span onClick={(ev) => ev.stopPropagation()}>
                      <SmsSender
                        size="small"
                        text={t('criticalValue.channel.sms')}
                        patientName={e.patientName}
                        ruleName={e.ruleName}
                        reportedBy={e.reportedByName}
                        criticalKind={e.level}
                      />
                    </span>
                    <span onClick={(ev) => ev.stopPropagation()}>
                      <VoiceCallButton
                        size="small"
                        text={t('criticalValue.voice')}
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
                    {t('criticalValue.confirm')}
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
                    {t('criticalValue.handle')}
                  </Button>
                )}
                {e.status === 'resolved' && (
                  <Tag color="green" icon={<CheckCircle2 size={10} />}>
                    {t('criticalValue.closedLoop')}
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
                    {t('criticalValue.escalate')}
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
            <AlertOctagon size={16} color="var(--color-error-600)" />
            <span>{t('criticalValue.detailTitle')}</span>
            {detailEvent && <Tag color={LEVEL_META[detailEvent.level].color}>{LEVEL_META[detailEvent.level].label}</Tag>}
          </Space>
        }
        open={!!detailEvent}
        onClose={() => setDetailEvent(null)}
        width={520}
      >
        {detailEvent && (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Card size="small" title={t('criticalValue.basicInfo')}>
              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t('criticalValue.patient')}</div>
                  <div>
                    {detailEvent.patientName}({detailEvent.gender} · {detailEvent.age}{t('criticalValue.yearsOld')})
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t('criticalValue.exam')}</div>
                  <div>
                    {detailEvent.modality} / {detailEvent.bodyPart}
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t('criticalValue.reportingDoctor')}</div>
                  <div>
                    {detailEvent.reportedByName}({detailEvent.reportedByTitle})
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t('criticalValue.reportTime')}</div>
                  <div>{new Date(detailEvent.reportedAt).toLocaleString()}</div>
                </Col>
                <Col span={24}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t('criticalValue.criticalRule')}</div>
                  <div>
                    <Tag color="red">{detailEvent.ruleCode}</Tag>
                    {detailEvent.ruleName}
                    {detailEvent.veto && <Tag color="red">{t('criticalValue.veto')}</Tag>}
                    {detailEvent.dualReviewRequired && <Tag color="purple">{t('criticalValue.needsDualReview')}</Tag>}
                  </div>
                </Col>
                <Col span={24}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{t('criticalValue.findings')}</div>
                  <div style={{ color: 'var(--color-error-600)', fontWeight: 600 }}>{detailEvent.detail}</div>
                </Col>
              </Row>
            </Card>

            <Card size="small" title={t('criticalValue.notifyAndResponse')}>
              <Timeline
                items={[
                  {
                    color: 'red',
                    children: (
                      <>
                        <strong>{t('criticalValue.reportGenerated')}</strong> {formatHM(detailEvent.reportedAt)} ·{' '}
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
                              <strong>{t('criticalValue.notifyReceivingDoctor')}</strong> {formatHM(detailEvent.receivingTime)} ·{' '}
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
                              <strong>{t('criticalValue.doctorConfirmed')}</strong> {formatHM(detailEvent.acknowledgedTime)} ·{' '}
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
                              <strong>{t('criticalValue.resolutionClosedLoop')}</strong> {formatHM(detailEvent.resolvedTime)}
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
                              <strong>{t('criticalValue.escalate')}</strong> {formatHM(detailEvent.escalatedAt)} →{' '}
                              {detailEvent.escalatedToName}
                              <div style={{ fontSize: 12, color: '#64748b' }}>
                                {t('criticalValue.reason')}{detailEvent.escalationReason}
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
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{t('criticalValue.usedChannels')}</div>
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
                          {cm.label} {a.success ? '' : ''} {formatHM(a.attemptedAt)}
                        </Tag>
                      );
                    })}
                  </Space>
                </>
              )}
            </Card>

            {detailEvent.dualReview && (
              <Card size="small" title={t('criticalValue.dualReviewRecord')}>
                <Row gutter={8}>
                  <Col span={12}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{t('criticalValue.firstReview')}</div>
                    <div>{detailEvent.dualReview.firstReviewerName ?? t('criticalValue.pendingReview')}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      {detailEvent.dualReview.firstReviewAt
                        ? formatHM(detailEvent.dualReview.firstReviewAt)
                        : '-'}
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{t('criticalValue.secondReview')}</div>
                    <div>{detailEvent.dualReview.secondReviewerName ?? t('criticalValue.pendingReview')}</div>
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
              <Card size="small" title={t('criticalValue.sop6')}>
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

            <Card size="small" title={t('criticalValue.metadata')}>
              <Space orientation="vertical" size={2} style={{ fontSize: 12 }}>
                <div>
                  <strong>{t('criticalValue.eventId')}</strong> {detailEvent.id}
                </div>
                <div>
                  <strong>{t('criticalValue.hash')}</strong> <code>{detailEvent.hash}</code>
                </div>
                <div>
                  <strong>{t('criticalValue.escalationLevel')}</strong> {detailEvent.escalationLevel}
                </div>
              </Space>
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title={t('criticalValue.multiChannelNotify')}
        open={notifyModal.open}
        onCancel={() => setNotifyModal({ open: false, event: null })}
        onOk={submitNotify}
        okText={t('criticalValue.send')}
        cancelText={t('criticalValue.cancel')}
      >
        {notifyModal.event && (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <div>
              <strong>{notifyModal.event.patientName}</strong> · {notifyModal.event.ruleName}
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>{t('criticalValue.recipientDoctor')}</div>
              <Input
                placeholder={t('criticalValue.recipientPlaceholder')}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>{t('criticalValue.notifyChannels')}</div>
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                value={notifyChannels}
                onChange={(v) => setNotifyChannels(v as NotificationChannel[])}
                options={[
                  { label: t('criticalValue.channelOption.phone'), value: 'phone' },
                  { label: t('criticalValue.channelOption.sms'), value: 'sms' },
                  { label: t('criticalValue.channelOption.wechat'), value: 'wechat' },
                  { label: t('criticalValue.channelOption.inApp'), value: 'inApp' },
                  { label: t('criticalValue.channelOption.email'), value: 'email' },
                  { label: t('criticalValue.channelOption.pager'), value: 'pager' },
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
