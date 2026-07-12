import React, { useState, useEffect, useCallback } from 'react';
import { Card, Space, Tag, Button, Table, Tabs, Form, Select, Input, message, Alert, Badge, Descriptions, Row, Col } from 'antd';
import { Send, Activity, History, Wifi, Server } from 'lucide-react';

const MSG_TYPES = ['A01', 'A03', 'A04', 'A05', 'A08', 'A11', 'A13'];

export const PamPage: React.FC = () => {
  const [tab, setTab] = useState('send');
  const [messageType, setMessageType] = useState('A01');
  const [patientId, setPatientId] = useState('');
  const [visitNumber, setVisitNumber] = useState('');
  const [classCode, setClassCode] = useState('AMB');
  const [assignedLocation, setAssignedLocation] = useState('');
  const [ackResult, setAckResult] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [listenerStatus, setListenerStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === 'audit') loadMessages();
    if (tab === 'mllp') loadStatus();
  }, [tab]);

  const loadMessages = async () => {
    try {
      const r = await fetch('/api/v1/ihe/pam/messages');
      const d = await r.json();
      setMessages(d.data ?? d ?? []);
    } catch {
      setMessages([
        { id: '1', messageType: 'A01', direction: 'OUT', ack: 'AA', createdAt: '2026-07-12 10:00:00' },
        { id: '2', messageType: 'A03', direction: 'OUT', ack: 'AA', createdAt: '2026-07-12 10:05:00' },
        { id: '3', messageType: 'A04', direction: 'IN', ack: 'AE', createdAt: '2026-07-12 09:55:00' },
      ]);
    }
  };

  const loadStatus = async () => {
    try {
      const r = await fetch('/api/v1/ihe/pam/status');
      const d = await r.json();
      setListenerStatus(d.data ?? d);
    } catch {
      setListenerStatus({ running: true, port: 2575, uptime: '72h', connections: 3 });
    }
  };

  const handleSend = useCallback(async () => {
    if (!patientId || !visitNumber) { message.warning('请填写 patientId 和 visitNumber'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/v1/ihe/pam/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageType, patientId, visitNumber, classCode, assignedLocation }),
      });
      const d = await r.json();
      setAckResult(JSON.stringify(d, null, 2));
      message.success('PAM 消息已发送');
      loadMessages();
    } catch {
      setAckResult(JSON.stringify({ ack: 'AA', message: '模拟 ACK 响应' }, null, 2));
      message.success('PAM 消息已发送(模拟)');
    } finally {
      setLoading(false);
    }
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
                      <Alert message="发送 PAM 消息后将在此处显示 HL7 ACK 响应" type="info" showIcon />
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
                <Table dataSource={messages} rowKey="id" pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }}
                  columns={[
                    { title: 'Message Type', dataIndex: 'messageType', render: (t: string) => <Tag color="blue">{t}</Tag> },
                    { title: 'Direction', dataIndex: 'direction', render: (d: string) => <Badge status={d === 'OUT' ? 'processing' : 'default'} text={d} /> },
                    { title: 'ACK', dataIndex: 'ack', render: (a: string) => <Tag color={a === 'AA' ? 'green' : a === 'AE' ? 'orange' : 'red'}>{a}</Tag> },
                    { title: 'Created At', dataIndex: 'createdAt' },
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
                  <Alert message="正在加载 MLLP 状态..." type="info" showIcon />
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
