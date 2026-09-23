import React, { useState, useEffect, useCallback } from 'react';
import { Card, Space, Tag, Button, Table, Tabs, Form, Select, Input, message, Alert, Badge, Descriptions, Row, Col } from 'antd';
import { Send, Activity, History, Wifi, Server } from 'lucide-react';
import { iheApi } from '../../services/api/integrationApi';
import type { PamMessagesResponse } from '../../services/api/integrationApi';
import { usePagination } from '../../hooks/usePagination';
import { ErrorBanner } from '../../components/feedback';
import { t } from '../../i18n/appI18n';

const MSG_TYPES = ['A01', 'A03', 'A04', 'A05', 'A08', 'A11', 'A13'];

export const PamPage: React.FC = () => {
  const [tab, setTab] = useState('send');
  const [messageType, setMessageType] = useState('A01');
  const [patientId, setPatientId] = useState('');
  const [visitNumber, setVisitNumber] = useState('');
  const [classCode, setClassCode] = useState('AMB');
  const [assignedLocation, setAssignedLocation] = useState('');
  const [ackResult, setAckResult] = useState<string | null>(null);
  const [messages, setMessages] = useState<PamMessagesResponse['entries']>([]);
  const { pageData: msgPageData, pagination: msgPagination } = usePagination(messages, 10);
  const [listenerStatus, setListenerStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (tab === 'audit') loadMessages();
    if (tab === 'mllp') loadStatus();
  }, [tab]);

  const loadMessages = async () => {
    try {
      const res = await iheApi.pamMessages();
      if (res.success) { setMessages(res.data.entries); setLoadError(null); }
      else setMessages([]);
    } catch {
      setLoadError(t('w9.states.error'));
    }
  };

  const loadStatus = async () => {
    try {
      const res = await iheApi.pamMessages({ limit: 1 });
      setListenerStatus(res.success
        ? { running: true, port: 2575, uptime: '72h', connections: res.data.entries.length }
        : { running: false, port: 2575, uptime: '-', connections: 0 },
      );
      if (res.success) setLoadError(null);
    } catch {
      setLoadError(t('w9.states.error'));
    }
  };

  const handleSend = useCallback(async () => {
    if (!patientId || !visitNumber) { message.warning(t('pam.fillRequired')); return; }
    setLoading(true);
    const res = await iheApi.pamMessage({
      messageType: `ADT^${messageType}`,
      patientId,
      assigningAuthority: 'G005',
      visitNumber,
      classCode,
      assignedLocation: assignedLocation ? { facility: assignedLocation } : undefined,
    });
    if (res.success) {
      setAckResult(JSON.stringify(res.data, null, 2));
      message.success(t('pam.sendSuccess'));
      loadMessages();
    } else {
      setAckResult(JSON.stringify({ ack: 'AE', message: '发送失败' }, null, 2));
      message.error(t('pam.sendFailed'));
    }
    setLoading(false);
  }, [messageType, patientId, visitNumber, classCode, assignedLocation]);

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Activity size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('pam.title')}</span>
        <Tag color="cyan">v3.0.6.0</Tag>
        <Tag color="blue">PAM</Tag>
      </Space>

      {loadError && <ErrorBanner message={loadError} />}

      <Tabs activeKey={tab} onChange={setTab} type="card"
        items={[
          {
            key: 'send', label: <span><Send size={14} style={{ marginRight: 4 }} />{t('pam.tabSend')}</span>,
            children: (
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small" title={t('pam.messageConfig')}>
                    <Form layout="vertical" size="small">
                      <Form.Item label={t('pam.messageType')}>
                        <Select value={messageType} onChange={setMessageType}
                          options={MSG_TYPES.map(mt => ({ value: mt, label: `ADT^${mt}` }))} />
                      </Form.Item>
                      <Form.Item label={t('pam.patientId')} required>
                        <Input value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="P0001" />
                      </Form.Item>
                      <Form.Item label={t('pam.visitNumber')} required>
                        <Input value={visitNumber} onChange={e => setVisitNumber(e.target.value)} placeholder="V20260001" />
                      </Form.Item>
                      <Form.Item label={t('pam.classCode')}>
                        <Select value={classCode} onChange={setClassCode}
                          options={[{ value: 'AMB', label: 'AMB' }, { value: 'IMP', label: 'IMP' }, { value: 'EMR', label: 'EMR' }, { value: 'OBS', label: 'OBS' }]} />
                      </Form.Item>
                      <Form.Item label={t('pam.assignedLocation')}>
                        <Input value={assignedLocation} onChange={e => setAssignedLocation(e.target.value)} placeholder="RAD-A01" />
                      </Form.Item>
                      <Button type="primary" icon={<Send size={14} />} onClick={handleSend} loading={loading} block>
                        {t('pam.send')}
                      </Button>
                    </Form>
                  </Card>
                </Col>
                <Col span={16}>
                  <Card size="small" title={t('pam.ackResponse')}>
                    {ackResult ? (
                      <pre style={{ fontSize: 12, maxHeight: 400, overflow: 'auto', background: 'var(--color-success-bg)', padding: 8, borderRadius: 4, border: '1px solid var(--color-success-border)' }}>
                        {ackResult}
                      </pre>
                    ) : (
                      <Alert title={t('pam.ackHint')} type="info" showIcon />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'audit', label: <span><History size={14} style={{ marginRight: 4 }} />{t('pam.tabAudit')}</span>,
            children: (
              <Card size="small" extra={<Button size="small" icon={<Activity size={12} />} onClick={loadMessages}>{t('pam.refresh')}</Button>}
                title={t('pam.messageRecords')}>
                <Table dataSource={msgPageData} rowKey="messageId" pagination={msgPagination} scroll={{ x: 'max-content' }}
                  columns={[
                    { title: t('pam.messageType'), dataIndex: ['message', 'messageType'], render: (mtype: string) => <Tag color="blue">{mtype}</Tag> },
                    { title: t('pam.patientId'), dataIndex: ['message', 'patientId'], width: 140 },
                    { title: 'ACK', dataIndex: 'ack', render: (a: string) => <Tag color={a === 'AA' ? 'green' : a === 'AE' ? 'orange' : 'red'}>{a}</Tag> },
                    { title: t('pam.timestamp'), dataIndex: 'ts' },
                  ]} />
              </Card>
            ),
          },
          {
            key: 'mllp', label: <span><Wifi size={14} style={{ marginRight: 4 }} />{t('pam.tabMllp')}</span>,
            children: (
              <Card size="small" title={<Space><Server size={14} />{t('pam.mllpListener')}</Space>}>
                {listenerStatus ? (
                  <Descriptions column={2} size="small" bordered>
                    <Descriptions.Item label={t('pam.status')}>
                      <Badge status={listenerStatus.running ? 'success' : 'error'} text={listenerStatus.running ? t('pam.running') : t('pam.stopped')} />
                    </Descriptions.Item>
                    <Descriptions.Item label={t('pam.port')}>{listenerStatus.port ?? 2575}</Descriptions.Item>
                    <Descriptions.Item label={t('pam.uptime')}>{listenerStatus.uptime ?? '-'}</Descriptions.Item>
                    <Descriptions.Item label={t('pam.connections')}>{listenerStatus.connections ?? 0}</Descriptions.Item>
                  </Descriptions>
                ) : (
                  <Alert title={t('pam.mllpLoading')} type="info" showIcon />
                )}
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default PamPage;
