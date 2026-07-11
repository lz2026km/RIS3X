/**
 * G005 RIS v3.0.6.6 - 接收医师门户
 * 临床医师登录后查看分配给自己的危急值并一键闭环
 *
 * v3.0.6.12-A4: 事件源改为 store.criticalEvents (unifiedCriticalValues),
 *   通过 criticalValueAdapter 转回 R3.CRITICAL.CriticalEvent 形状.
 */

import React, { useMemo, useState } from 'react';
import { Card, Tag, Space, Empty, Row, Col, Statistic, Segmented, message } from 'antd';
import { Activity, AlertOctagon, ShieldCheck, Filter, User } from 'lucide-react';
import { list } from '../../services/mockBackend/store';
import { mapUnifiedToCriticalEvents } from '../../data/criticalValueAdapter';
import { CloseLoopAcknowledge } from '../../components/critical/CloseLoopAcknowledge';
import { OnCallIndicator } from '../../components/critical/OnCallIndicator';
import { VoiceCallButton } from '../../components/critical/VoiceCallButton';
import { SmsSender } from '../../components/critical/SmsSender';
import { useCriticalStore } from '../../store/criticalStore';
import type { CriticalEvent } from '../../types/R3/R3.CRITICAL';

const CURRENT_USER = { id: 'D-LI', name: '李天宇', title: '主治医师' };

type StatusFilter = 'open' | 'all' | 'resolved';

export const ReceiverPortalPage: React.FC = () => {
  const [filter, setFilter] = useState<StatusFilter>('open');

  const allEvents = useMemo<CriticalEvent[]>(() => {
    const unified = list<any>('criticalEvents');
    return mapUnifiedToCriticalEvents(unified);
  }, []);

  const mine = useMemo(() => {
    let list = allEvents.filter(
      (e) => e.receivingDoctorId === CURRENT_USER.id || e.acknowledgedById === CURRENT_USER.id,
    );
    if (filter === 'open') list = list.filter((e) => e.status !== 'resolved' && e.status !== 'cancelled');
    if (filter === 'resolved') list = list.filter((e) => e.status === 'resolved');
    return list;
  }, [allEvents, filter]);

  const stats = useMemo(() => {
    const open = allEvents.filter(
      (e) =>
        (e.receivingDoctorId === CURRENT_USER.id || e.acknowledgedById === CURRENT_USER.id) &&
        e.status !== 'resolved' &&
        e.status !== 'cancelled',
    );
    return {
      total: open.length,
      overdue: open.filter((e) => e.status === 'overdue').length,
      critical: open.filter((e) => e.level === 'critical').length,
      timelyRate:
        open.length === 0
          ? 100
          : Math.round((open.filter((e) => e.onTimeNotification).length / open.length) * 1000) / 10,
    };
  }, [allEvents]);

  const handleAcknowledge = async (e: CriticalEvent, note?: string) => {
    await useCriticalStore.getState().acknowledge(e.id);
    message.success(`已确认接收: ${e.patientName}`);
  };
  const handleResolve = async (e: CriticalEvent, note: string) => {
    await useCriticalStore.getState().resolve(e.id);
    message.success(`已闭环: ${e.patientName}`);
  };

  return (
    <div className="p-4 space-y-3" data-testid="receiver-portal-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User size={24} color="#3b82f6" />
          <h1 className="text-xl font-bold">接收医师门户</h1>
          <Tag color="blue">{CURRENT_USER.name} · {CURRENT_USER.title}</Tag>
        </div>
        <Space>
          <SmsSender text="短信" />
          <VoiceCallButton text="语音呼叫" />
        </Space>
      </div>

      <Row gutter={12}>
        <Col span={16}>
          <Row gutter={12} style={{ marginBottom: 12 }}>
            <Col span={6}>
              <Statistic title="未关闭" value={stats.total} prefix={<Activity size={14} />} />
            </Col>
            <Col span={6}>
              <Statistic title="危急级" value={stats.critical} valueStyle={{ color: '#dc2626' }} prefix={<AlertOctagon size={14} />} />
            </Col>
            <Col span={6}>
              <Statistic title="超时" value={stats.overdue} valueStyle={{ color: '#7f1d1d' }} />
            </Col>
            <Col span={6}>
              <Statistic title="本人按时率" value={stats.timelyRate} suffix="%" valueStyle={{ color: stats.timelyRate >= 95 ? '#10b981' : '#f59e0b' }} />
            </Col>
          </Row>

          <Card
            size="small"
            title={
              <Space>
                <Filter size={14} />
                <strong>我的事件</strong>
                <Segmented
                  value={filter}
                  onChange={(v) => setFilter(v as StatusFilter)}
                  options={[
                    { label: '未关闭', value: 'open' },
                    { label: '全部', value: 'all' },
                    { label: '已闭环', value: 'resolved' },
                  ]}
                />
              </Space>
            }
          >
            {mine.length === 0 ? (
              <Empty description="无事件" />
            ) : (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {mine.map((e) => (
                  <CloseLoopAcknowledge
                    key={e.id}
                    critical={e}
                    currentUser={CURRENT_USER}
                    onAcknowledge={(note) => handleAcknowledge(e, note)}
                    onResolve={(note) => handleResolve(e, note)}
                  />
                ))}
              </Space>
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <OnCallIndicator />
            <Card size="small" title={<Space><ShieldCheck size={14} color="#10b981" /><span>SLA 守则</span></Space>}>
              <Space direction="vertical" size={4} style={{ fontSize: 12 }}>
                <span>• 危急值 5 分钟内必须确认接收</span>
                <span>• 紧急 10 分钟内,警告 30 分钟内</span>
                <span>• 一票否决事件:30 分钟内关闭</span>
                <span>• 双审事件:两个审次都需完成</span>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default ReceiverPortalPage;