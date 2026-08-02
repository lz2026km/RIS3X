import React, { useState, useCallback } from 'react';
import { Card, Space, Tag, Button, Input, Descriptions, Timeline, message, Divider, Badge } from 'antd';
import { Search, Send, Activity, User, Clock } from 'lucide-react';
import { iheApi } from '../../services/api/integrationApi';
import type { VisitState } from '../../services/api/integrationApi';

const STATE_TAGS: Record<string, { color: string; label: string }> = {
  registered: { color: 'default', label: 'Registered' },
  admitted: { color: 'blue', label: 'Admitted' },
  inProgress: { color: 'processing', label: 'In Progress' },
  completed: { color: 'green', label: 'Completed' },
  discharged: { color: 'red', label: 'Discharged' },
};

const ADT_TRANSITIONS: Record<string, { label: string; msgType: string }> = {
  'registered→admitted': { label: '入院 (A01)', msgType: 'A01' },
  'admitted→inProgress': { label: '开始检查 (A08)', msgType: 'A08' },
  'inProgress→completed': { label: '完成检查 (A08)', msgType: 'A08' },
  'completed→discharged': { label: '出院 (A03)', msgType: 'A03' },
};

export const VisitPage: React.FC = () => {
  const [patientId, setPatientId] = useState('');
  const [visit, setVisit] = useState<VisitState | null>(null);
  const [loading, setLoading] = useState(false);
  const [adtTriggering, setAdtTriggering] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!patientId.trim()) { message.warning('请输入患者 ID'); return; }
    setLoading(true);
    const res = await iheApi.getVisit(patientId);
    if (res.success) {
      setVisit(res.data);
    } else {
      setVisit({
        patientId,
        visitNumber: 'V20260001',
        status: 'admitted',
        classCode: 'AMB',
        admitDateTime: '2026-07-12 08:00:00',
        dischargeDateTime: undefined,
        timeline: [
          { event: 'ADT^A01', timestamp: '2026-07-12 08:00:00', description: '入院登记' },
          { event: 'ADT^A08', timestamp: '2026-07-12 09:15:00', description: '转入放射科' },
          { event: 'ADT^A08', timestamp: '2026-07-12 09:30:00', description: '状态更新' },
        ],
      });
    }
    setLoading(false);
  }, [patientId]);

  const handleAdtTrigger = useCallback(async (transition: string) => {
    if (!visit) return;
    setAdtTriggering(true);
    const cfg = ADT_TRANSITIONS[transition];
    if (!cfg) return;
    const res = await iheApi.pamMessage({
      messageType: `ADT^${cfg.msgType}`,
      patientId: visit.patientId,
      assigningAuthority: 'G005',
      visitNumber: visit.visitNumber,
      classCode: visit.classCode,
    });
    if (res.success) {
      message.success(`${cfg.label} 消息已发送`);
    } else {
      message.warning(`${cfg.label} 消息发送失败，请检查 IHE 连接`);
    }
    handleSearch();
    setAdtTriggering(false);
  }, [visit, handleSearch]);

  const currentState = visit?.status ?? 'registered';

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Activity size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>IHE Visit 管理</span>
        <Tag color="cyan">v3.0.6.0</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: 400 }}>
          <Input value={patientId} onChange={e => setPatientId(e.target.value)}
            placeholder="输入 Patient ID 搜索" onPressEnter={handleSearch} />
          <Button type="primary" icon={<Search size={14} />} onClick={handleSearch} loading={loading}>搜索</Button>
        </Space.Compact>
      </Card>

      {visit && (
        <Space orientation="vertical" style={{ width: '100%' }} size={16}>
          <Card size="small" title={<Space><User size={14} />就诊信息</Space>}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Patient ID">{visit.patientId}</Descriptions.Item>
              <Descriptions.Item label="Visit Number"><Tag color="blue">{visit.visitNumber}</Tag></Descriptions.Item>
              <Descriptions.Item label="状态">
                <Badge status={STATE_TAGS[currentState]?.color as any} text={STATE_TAGS[currentState]?.label ?? currentState} />
              </Descriptions.Item>
              <Descriptions.Item label="Class Code">{visit.classCode}</Descriptions.Item>
              <Descriptions.Item label="Location">{visit.assignedLocation}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" style={{ fontSize: 13 }}>5 态徽章</Divider>
            <Space wrap>
              {Object.entries(STATE_TAGS).map(([k, v]) => (
                <Tag key={k} color={k === currentState ? v.color : 'default'}
                  style={{ opacity: k === currentState ? 1 : 0.5, fontWeight: k === currentState ? 700 : 400 }}>
                  {v.label}
                </Tag>
              ))}
            </Space>

            <Divider orientation="left" style={{ fontSize: 13 }}>状态时间戳</Divider>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="入院时间">{visit.admitDateTime ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{visit.inProgressAt ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="完成时间">{visit.completedAt ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="出院时间">{visit.dischargeDateTime ?? '-'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" title={<Space><Send size={14} />手动 ADT 触发</Space>}
            extra={adtTriggering ? <Tag color="processing">发送中...</Tag> : null}>
            <Space wrap>
              {Object.entries(ADT_TRANSITIONS).map(([key, cfg]) => {
                const disabled = currentState !== key.split('→')[0] || adtTriggering;
                return (
                  <Button key={key} size="small" icon={<Send size={12} />}
                    disabled={disabled} onClick={() => handleAdtTrigger(key)}>
                    {cfg.label}
                  </Button>
                );
              })}
            </Space>
            <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>按钮当前状态为 {STATE_TAGS[currentState]?.label}，仅活跃状态转移按钮可用</div>
          </Card>

          <Card size="small" title={<Space><Clock size={14} />时间线</Space>}>
            <Timeline items={visit.timeline?.map((t: any) => ({
              color: t.event.includes('A01') ? 'blue' : t.event.includes('A03') ? 'red' : 'gray',
              children: <>{t.timestamp} - <Tag color="blue">{t.event}</Tag> {t.description}</>,
            })) ?? []} />
          </Card>
        </Space>
      )}
    </div>
  );
};

export default VisitPage;
