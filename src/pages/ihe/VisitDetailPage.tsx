import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Space, Tag, Table, Descriptions, Steps, Divider, message } from 'antd';
import { Activity, Clock, ArrowRight, GitBranch } from 'lucide-react';
import { iheApi } from '../../services/api/integrationApi';
import type { VisitState } from '../../services/api/integrationApi';
import { LoadingBanner, ErrorBanner, AppEmpty } from '../../components/feedback';
import { t } from '../../i18n/appI18n';

const STATE_STEPS = [
  { key: 'registered', titleKey: 'visitDetail.state.registered', color: 'default' },
  { key: 'admitted', titleKey: 'visitDetail.state.admitted', color: 'blue' },
  { key: 'inProgress', titleKey: 'visitDetail.state.inProgress', color: 'processing' },
  { key: 'completed', titleKey: 'visitDetail.state.completed', color: 'green' },
  { key: 'discharged', titleKey: 'visitDetail.state.discharged', color: 'red' },
];

const STATE_MAP: Record<string, number> = {
  registered: 0, admitted: 1, inProgress: 2, completed: 3, discharged: 4,
};

export const VisitDetailPage: React.FC = () => {
  const { patientId, visitNumber } = useParams<{ patientId: string; visitNumber: string }>();
  const [visit, setVisit] = useState<VisitState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (patientId && visitNumber) loadVisit();
  }, [patientId, visitNumber]);

  const loadVisit = async () => {
    if (!patientId || !visitNumber) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await iheApi.getVisitDetail(patientId, visitNumber);
      if (res.success) {
        setVisit(res.data);
      } else {
        setVisit({
          patientId,
          visitNumber,
          status: 'inProgress',
          classCode: 'AMB',
          admitDateTime: '2026-07-12 08:00:00',
          adtMessages: [
            { id: '1', messageType: 'A01', timestamp: '2026-07-12 08:00:00', content: 'MSH|^~\\&|...' },
            { id: '2', messageType: 'A08', timestamp: '2026-07-12 09:15:00', content: 'MSH|^~\\&|...' },
            { id: '3', messageType: 'A08', timestamp: '2026-07-12 09:30:00', content: 'MSH|^~\\&|...' },
          ],
        });
        setLoadError(t('w9.states.error'));
        message.warning(t('visitDetail.loadFailedDemo'));
      }
    } catch {
      setLoadError(t('w9.states.error'));
    } finally {
      setLoading(false);
    }
  };

  const currentIdx = visit ? (STATE_MAP[visit.status as keyof typeof STATE_MAP] ?? 0) : 0;

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <GitBranch size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('visitDetail.title')}</span>
        <Tag color="cyan">v3.0.6.0</Tag>
        <Tag color="blue">{patientId}</Tag>
        <Tag color="purple">{visitNumber}</Tag>
      </Space>

      {loading && <LoadingBanner message={t('w9.states.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {!visit && !loading && !loadError && <AppEmpty variant="no-data" />}

      {visit && (
        <Space orientation="vertical" style={{ width: '100%' }} size={16}>
          <Card size="small" title={<Space><Activity size={14} />{t('visitDetail.stateMachine')}</Space>}>
            <Steps current={currentIdx} size="small"
              items={STATE_STEPS.map((s, i) => ({
                title: t(s.titleKey),
                status: i < currentIdx ? 'finish' : i === currentIdx ? 'process' : 'wait',
                description: i === currentIdx ? t('visitDetail.current') : undefined,
              }))}
            />
            <Divider />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              {STATE_STEPS.map((s, i) => (
                <React.Fragment key={s.key}>
                  <Tag color={i <= currentIdx ? s.color : 'default'}
                    style={{ padding: '4px 12px', fontWeight: i <= currentIdx ? 600 : 400, opacity: i <= currentIdx ? 1 : 0.4 }}>
                    {t(s.titleKey)}
                  </Tag>
                  {i < STATE_STEPS.length - 1 && <ArrowRight size={14} style={{ color: '#d9d9d9', alignSelf: 'center' }} />}
                </React.Fragment>
              ))}
            </div>
          </Card>

          <Card size="small" title={<span><Clock size={14} style={{ marginRight: 4 }} />{t('visitDetail.timestamps')}</span>}>
            <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label={t('visitDetail.admit')}>{visit?.admitDateTime ?? '-'}</Descriptions.Item>
                <Descriptions.Item label={t('visitDetail.inProgress')}>{visit?.inProgressAt ?? '-'}</Descriptions.Item>
                <Descriptions.Item label={t('visitDetail.completed')}>{visit?.completedAt ?? '-'}</Descriptions.Item>
                <Descriptions.Item label={t('visitDetail.discharge')}>{visit?.dischargeDateTime ?? '-'}</Descriptions.Item>
              </Descriptions>
          </Card>

          <Card size="small" title={<span><GitBranch size={14} style={{ marginRight: 4 }} />{t('visitDetail.adtMessages')}</span>}>
            <Table dataSource={visit.adtMessages} rowKey="id" pagination={false} scroll={{ x: 'max-content' }}
              columns={[
                { title: t('visitDetail.col.id'), dataIndex: 'id', width: 60 },
                { title: t('visitDetail.col.messageType'), dataIndex: 'messageType', render: (mt: string) => <Tag color="blue">ADT^{mt}</Tag> },
                { title: t('visitDetail.col.timestamp'), dataIndex: 'timestamp' },
                { title: t('visitDetail.col.content'), dataIndex: 'content', render: (c: string) => (
                  <span style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--bg-card)', padding: '2px 6px', borderRadius: 3 }}>
                    {c.slice(0, 50)}{c.length > 50 ? '...' : ''}
                  </span>
                )},
              ]} />
          </Card>
        </Space>
      )}
    </div>
  );
};

export default VisitDetailPage;
