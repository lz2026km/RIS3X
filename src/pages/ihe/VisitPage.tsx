import React, { useState, useCallback } from 'react';
import { Card, Space, Tag, Button, Input, Descriptions, Timeline, message, Divider, Badge } from 'antd';
import { Search, Send, Activity, User, Clock } from 'lucide-react';
import { iheApi } from '../../services/api/integrationApi';
import type { VisitState } from '../../services/api/integrationApi';
import { t } from '../../i18n/appI18n';

const STATE_TAGS: Record<string, { color: string; label: string }> = {
  registered: { color: 'default', label: t('iheVisit.state.registered') },
  admitted: { color: 'blue', label: t('iheVisit.state.admitted') },
  inProgress: { color: 'processing', label: t('iheVisit.state.inProgress') },
  completed: { color: 'green', label: t('iheVisit.state.completed') },
  discharged: { color: 'red', label: t('iheVisit.state.discharged') },
};

const ADT_TRANSITIONS: Record<string, { label: string; msgType: string }> = {
  'registered→admitted': { label: t('iheVisit.transition.admitted'), msgType: 'A01' },
  'admitted→inProgress': { label: t('iheVisit.transition.inProgress'), msgType: 'A08' },
  'inProgress→completed': { label: t('iheVisit.transition.completed'), msgType: 'A08' },
  'completed→discharged': { label: t('iheVisit.transition.discharged'), msgType: 'A03' },
};

export const VisitPage: React.FC = () => {
  const [patientId, setPatientId] = useState('');
  const [visit, setVisit] = useState<VisitState | null>(null);
  const [loading, setLoading] = useState(false);
  const [adtTriggering, setAdtTriggering] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!patientId.trim()) { message.warning(t('iheVisit.enterPatientId')); return; }
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
      message.success(t('iheVisit.msgSent', { label: cfg.label }));
    } else {
      message.warning(t('iheVisit.msgFailed', { label: cfg.label }));
    }
    handleSearch();
    setAdtTriggering(false);
  }, [visit, handleSearch]);

  const currentState = visit?.status ?? 'registered';

  return (
    <div style={{ padding: 'var(--space-6, 24px)', background: 'var(--bg-primary)',}}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Activity size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('iheVisit.title')}</span>
        <Tag color="cyan">v3.0.6.0</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Space.Compact style={{ width: 400 }}>
          <Input value={patientId} onChange={e => setPatientId(e.target.value)}
            placeholder={t('iheVisit.searchPlaceholder')} onPressEnter={handleSearch} />
          <Button type="primary" icon={<Search size={14} />} onClick={handleSearch} loading={loading}>{t('iheVisit.search')}</Button>
        </Space.Compact>
      </Card>

      {visit && (
        <Space orientation="vertical" style={{ width: '100%' }} size={16}>
          <Card size="small" title={<Space><User size={14} />{t('iheVisit.info')}</Space>}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label={t('iheVisit.colPatientId')}>{visit.patientId}</Descriptions.Item>
              <Descriptions.Item label={t('iheVisit.colVisitNo')}><Tag color="blue">{visit.visitNumber}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('iheVisit.colStatus')}>
                <Badge status={STATE_TAGS[currentState]?.color as any} text={STATE_TAGS[currentState]?.label ?? currentState} />
              </Descriptions.Item>
              <Descriptions.Item label={t('iheVisit.colClassCode')}>{visit.classCode}</Descriptions.Item>
              <Descriptions.Item label={t('iheVisit.colLocation')}>{visit.assignedLocation}</Descriptions.Item>
            </Descriptions>

            <Divider titlePlacement="left" style={{ fontSize: 12 }}>{t('iheVisit.badges')}</Divider>
            <Space wrap>
              {Object.entries(STATE_TAGS).map(([k, v]) => (
                <Tag key={k} color={k === currentState ? v.color : 'default'}
                  style={{ opacity: k === currentState ? 1 : 0.5, fontWeight: k === currentState ? 700 : 400 }}>
                  {v.label}
                </Tag>
              ))}
            </Space>

            <Divider titlePlacement="left" style={{ fontSize: 12 }}>{t('iheVisit.timestamps')}</Divider>
            <Descriptions column={2} size="small">
              <Descriptions.Item label={t('iheVisit.admitTime')}>{visit.admitDateTime ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('iheVisit.startTime')}>{visit.inProgressAt ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('iheVisit.completeTime')}>{visit.completedAt ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('iheVisit.dischargeTime')}>{visit.dischargeDateTime ?? '-'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" title={<Space><Send size={14} />{t('iheVisit.manualAdt')}</Space>}
            extra={adtTriggering ? <Tag color="processing">{t('iheVisit.sending')}</Tag> : null}>
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
            <div style={{ fontSize: 11, color: '#999', marginTop: 'var(--space-2, 8px)' }}>{t('iheVisit.hint', { status: STATE_TAGS[currentState]?.label })}</div>
          </Card>

          <Card size="small" title={<Space><Clock size={14} />{t('iheVisit.timeline')}</Space>}>
            <Timeline items={visit.timeline?.map((ev: any) => ({
              color: ev.event.includes('A01') ? 'blue' : ev.event.includes('A03') ? 'red' : 'gray',
              children: <>{ev.timestamp} - <Tag color="blue">{ev.event}</Tag> {ev.description}</>,
            })) ?? []} />
          </Card>
        </Space>
      )}
    </div>
  );
};

export default VisitPage;
