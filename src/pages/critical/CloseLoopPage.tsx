/**
 * G005 RIS v3.0.6.6 - 闭环归档页
 * 完整呈现危急值 5+2 节点闭环,接收端操作
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Row, Col, List, Tag, Space, Button, Empty, Input, Segmented, Alert, Statistic, message,
} from 'antd';
import { Search, ShieldCheck, RefreshCw, CheckCircle2, Clock, AlertOctagon, ChevronRight, Bell } from 'lucide-react';
import { criticalValueService } from '../../services/quality/criticalValueService';
import { CloseLoopAcknowledge } from '../../components/critical/CloseLoopAcknowledge';
import type { CriticalEvent, CriticalStatus } from '../../types/R3/R3.CRITICAL';

const CURRENT_USER = { id: 'D-LIN', name: '林华', title: '住院医师' };

const STATUS_FILTERS: Array<{ label: string; value: CriticalStatus | 'all' }> = [
  { label: '全部', value: 'all' },
  { label: '待通报', value: 'pending' },
  { label: '已通报', value: 'notified' },
  { label: '已确认', value: 'acknowledged' },
  { label: '已处置', value: 'resolved' },
  { label: '已升级', value: 'escalated' },
];

export const CloseLoopPage: React.FC = () => {
  const [events, setEvents] = useState<CriticalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CriticalStatus | 'all'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const list = await criticalValueService.listEvents();
      setEvents(list);
      if (!selectedId && list.length > 0) setSelectedId(list[0]!.id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return events
      .filter((e) => (statusFilter === 'all' ? true : e.status === statusFilter))
      .filter((e) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          e.patientName.toLowerCase().includes(q) ||
          e.ruleCode.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q)
        );
      });
  }, [events, statusFilter, search]);

  const selected = useMemo(() => events.find((e) => e.id === selectedId) ?? null, [events, selectedId]);

  const stats = useMemo(() => ({
    total: events.length,
    open: events.filter((e) => e.status !== 'resolved' && e.status !== 'cancelled').length,
    overdue: events.filter((e) => e.status === 'overdue').length,
    escalated: events.filter((e) => e.status === 'escalated').length,
  }), [events]);

  const handleAcknowledge = async (note?: string) => {
    if (!selected) return;
    await criticalValueService.acknowledgeEvent(selected.id, CURRENT_USER.id, CURRENT_USER.name);
    message.success('已确认接收');
    load();
  };

  const handleStartProcessing = async (note: string) => {
    if (!selected) return;
    await criticalValueService.acknowledgeEvent(selected.id, CURRENT_USER.id, CURRENT_USER.name);
    message.success('已开始处理');
    load();
  };

  const handleResolve = async (note: string) => {
    if (!selected) return;
    await criticalValueService.resolveEvent(selected.id);
    message.success('已闭环');
    load();
  };

  const handleReject = async (reason: string) => {
    if (!selected) return;
    await criticalValueService.resolveEvent(selected.id);
    message.warning('已拒绝');
    load();
  };

  return (
    <div className="p-4 space-y-3" data-testid="close-loop-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={24} color="#10b981" />
          <h1 className="text-xl font-bold">闭环确认中心</h1>
          <Tag color="green">接收端</Tag>
          <Tag color="purple">R3.CRITICAL.501+</Tag>
        </div>
        <Button icon={<RefreshCw size={12} />} onClick={load}>刷新</Button>
      </div>

      <Row gutter={12}>
        <Col span={6}><Statistic title="事件总数" value={stats.total} prefix={<Bell size={14} />} /></Col>
        <Col span={6}><Statistic title="未关闭" value={stats.open} styles={{ content: {  color: '#f59e0b'  } }} /></Col>
        <Col span={6}><Statistic title="已超时" value={stats.overdue} styles={{ content: {  color: '#dc2626'  } }} prefix={<Clock size={14} />} /></Col>
        <Col span={6}><Statistic title="已升级" value={stats.escalated} styles={{ content: {  color: '#7c3aed'  } }} /></Col>
      </Row>

      <Row gutter={12}>
        <Col span={10}>
          <Card size="small" title="事件列表">
            <Space style={{ marginBottom: 8 }} wrap>
              <Input
                size="small"
                allowClear
                prefix={<Search size={10} />}
                placeholder="搜索患者/规则/ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 200 }}
              />
              <Segmented
                size="small"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as CriticalStatus | 'all')}
                options={STATUS_FILTERS}
              />
            </Space>
            <List
              size="small"
              loading={loading}
              dataSource={filtered}
              locale={{ emptyText: <Empty description="无事件" /> }}
              renderItem={(e) => (
                <List.Item
                  onClick={() => setSelectedId(e.id)}
                  style={{
                    cursor: 'pointer',
                    background: selectedId === e.id ? '#dbeafe' : undefined,
                    borderLeft: `3px solid ${e.status === 'pending' ? '#dc2626' : e.status === 'overdue' ? '#7f1d1d' : e.status === 'escalated' ? '#7c3aed' : 'transparent'}`,
                    padding: '8px 10px',
                  }}
                >
                  <Space orientation="vertical" size={2} style={{ flex: 1 }}>
                    <Space size={4}>
                      <Tag color={e.level === 'critical' ? 'red' : e.level === 'urgent' ? 'orange' : 'blue'}>
                        {e.ruleCode}
                      </Tag>
                      <strong>{e.patientName}</strong>
                      <Tag>{e.modality}</Tag>
                    </Space>
                    <span style={{ fontSize: 12, color: '#475569' }}>{e.ruleName}</span>
                    <Space size={4}>
                      <Tag color="default">{e.status}</Tag>
                      {e.onTimeNotification && <Tag color="green">✓ 按时</Tag>}
                    </Space>
                  </Space>
                  <ChevronRight size={12} color="#94a3b8" />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={14}>
          {selected ? (
            <CloseLoopAcknowledge
              critical={selected}
              currentUser={CURRENT_USER}
              onAcknowledge={handleAcknowledge}
              onStartProcessing={handleStartProcessing}
              onResolve={handleResolve}
              onReject={handleReject}
            />
          ) : (
            <Card>
              <Empty description="请从左侧选择危急值事件" />
            </Card>
          )}
        </Col>
      </Row>

      {stats.overdue > 0 && (
        <Alert
          type="error"
          showIcon
          title={`${stats.overdue} 起事件已超时,请优先处理`}
          icon={<AlertOctagon size={16} />}
        />
      )}
    </div>
  );
};

export default CloseLoopPage;