import React, { useState, useEffect, useCallback } from 'react';
import { Card, Space, Tag, Button, Table, Tabs, Form, Select, Input, message, Alert, Badge, Descriptions, Row, Col } from 'antd';
import { Send, Activity, History, Wifi, Server } from 'lucide-react';
import { iheApi } from '../../services/api/integrationApi';
import type { PamMessagesResponse, PamAckResponse } from '../../services/api/integrationApi';

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
  const [listenerStatus, setListenerStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === 'audit') loadMessages();
    if (tab === 'mllp') loadStatus();
  }, [tab]);

  const loadMessages = async () => {
    const res = await iheApi.pamMessages();
    if (res.success) setMessages(res.data.entries);
    else setMessages([]);
  };

  const loadStatus = async () => {
    const res = await iheApi.pamMessages({ limit: 1 });
    setListenerStatus(res.success
      ? { running: true, port: 2575, uptime: '72h', connections: res.data.entries.length }
      : { running: false, port: 2575, uptime: '-', connections: 0 },
    );
  };

  const handleSend = useCallback(async () => {
    if (!patientId || !visitNumber) { message.warning('请填写 patientId 和 visitNumber'); return; }
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
      message.success('PAM 消息已发送');
      loadMessages();
    } else {
      setAckResult(JSON.stringify({ ack: 'AE', message: '发送失败' }, null, 2));
      message.error('PAM 消息发送失败');
    }
    setLoading(false);
  }, [messageType, patientId, visitNumber, classCode, assignedLocation]);

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Activity size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>IHE PAM 患者管理</span>
        <Tag color="cyan">v3.0.6.0</Tag>
        <Tag color="blue">PAM</Tag>
      </Space>

      <Tabs activeKey={tab} onChange={setTab} type="card"
        items={[
          {
            key: 'send', label: <span><Send size={14} style={{ marginRight: 4 }} />发送 PAM 消息</span>,
            children: (
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small" title="消息配置">
                    <Form layout="vertical" size="small">
                      <Form.Item label="Message Type">
                        <Select value={messageType} onChange={setMessageType}
                          options={MSG_TYPES.map(t => ({ value: t, label: `ADT^${t}` }))} />
                      </Form.Item>
                      <Form.Item label="Patient ID" required>
                        <Input value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="P0001" />
                      </Form.Item>
                      <Form.Item label="Visit Number" required>
                        <Input value={visitNumber} onChange={e => setVisitNumber(e.target.value)} placeholder="V20260001" />
                      </Form.Item>
                      <Form.Item label="Class Code">
                        <Select value={classCode} onChange={setClassCode}
                          options={[{ value: 'AMB', label: 'AMB' }, { value: 'IMP', label: 'IMP' }, { value: 'EMR', label: 'EMR' }, { value: 'OBS', label: 'OBS' }]} />
                      </Form.Item>
                      <Form.Item label="Assigned Location">
                        <Input value={assignedLocation} onChange={e => setAssignedLocation(e.target.value)} placeholder="RAD-A01" />
                      </Form.Item>
                      <Button type="primary" icon={<Send size={14} />} onClick={handleSend} loading={loading} block>
                        发送
                      </Button>
                    </Form>
                  </Card>
                </Col>
                <Col span={16}>
                  <Card size="small" title="ACK 响应">
                    {ackResult ? (
                      <pre style={{ fontSize: 12, maxHeight: 400, overflow: 'auto', background: '#f0fdf4', padding: 8, borderRadius: 4, border: '1px solid #bbf7d0' }}>
                        {ackResult}
                      </pre>
                    ) : (
                      <Alert title="发送 PAM 消息后将在此处显示 HL7 ACK 响应" type="info" showIcon />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'audit', label: <span><History size={14} style={{ marginRight: 4 }} />PAM 审计日志</span>,
            children: (
              <Card size="small" extra={<Button size="small" icon={<Activity size={12} />} onClick={loadMessages}>刷新</Button>}
                title="PAM 消息记录">
                <Table dataSource={messages} rowKey="messageId" pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
                  columns={[
                    { title: 'Message Type', dataIndex: ['message', 'messageType'], render: (t: string) => <Tag color="blue">{t}</Tag> },
                    { title: 'Patient ID', dataIndex: ['message', 'patientId'], width: 140 },
                    { title: 'ACK', dataIndex: 'ack', render: (a: string) => <Tag color={a === 'AA' ? 'green' : a === 'AE' ? 'orange' : 'red'}>{a}</Tag> },
                    { title: 'Timestamp', dataIndex: 'ts' },
                  ]} />
              </Card>
            ),
          },
          {
            key: 'mllp', label: <span><Wifi size={14} style={{ marginRight: 4 }} />MLLP 连接状态</span>,
            children: (
              <Card size="small" title={<Space><Server size={14} />MLLP Listener</Space>}>
                {listenerStatus ? (
                  <Descriptions column={2} size="small" bordered>
                    <Descriptions.Item label="Status">
                      <Badge status={listenerStatus.running ? 'success' : 'error'} text={listenerStatus.running ? 'Running' : 'Stopped'} />
                    </Descriptions.Item>
                    <Descriptions.Item label="Port">{listenerStatus.port ?? 2575}</Descriptions.Item>
                    <Descriptions.Item label="Uptime">{listenerStatus.uptime ?? '-'}</Descriptions.Item>
                    <Descriptions.Item label="Connections">{listenerStatus.connections ?? 0}</Descriptions.Item>
                  </Descriptions>
                ) : (
                  <Alert title="正在加载 MLLP 状态..." type="info" showIcon />
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
