import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Table, Button, Row, Col, Statistic, Badge, message } from 'antd';
import { Server, Globe, Activity, RefreshCw, ArrowLeftRight } from 'lucide-react';
import { iheApi } from '../../services/api/integrationApi';
import type { IheStatus } from '../../services/api/integrationApi';

export const IheIntegrationPage: React.FC = () => {
  const [status, setStatus] = useState<IheStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    const res = await iheApi.getStatus();
    if (res.success) setStatus(res.data);
    else message.error('获取 IHE 状态失败');
    setLoading(false);
  };

  useEffect(() => { fetchStatus(); }, []);

  const domain = status?.affinityDomain;
  const pixCount = status?.metrics.pixRecords ?? 0;
  const pdqCount = status?.metrics.pdqCache ?? 0;
  const transactions = status?.transactions ?? [];

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Globe size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>IHE Integration Engine</span>
        <Tag color="cyan">v3.0.6.8-75</Tag>
        {transactions.map((t) => (
          <Tag key={t} color="blue">{t}</Tag>
        ))}
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="事务数" value={transactions.length} prefix={<Activity size={14}/>} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="PIX Records" value={pixCount} prefix={<Activity size={14}/>} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="PDQ Cache" value={pdqCount} prefix={<Activity size={14}/>} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="PAM Log" value={status?.metrics.pamLogSize ?? 0} prefix={<Activity size={14}/>} /></Card></Col>
      </Row>
      <Card size="small" title="Affinity Domain" style={{marginBottom:16}} extra={<Button icon={<RefreshCw size={12}/>} onClick={fetchStatus} loading={loading}>刷新</Button>}>
        {domain ? (
          <Row gutter={16}>
            <Col span={8}><Statistic title="名称" value={domain.name} styles={{ content: { fontSize:14 } }} /></Col>
            <Col span={8}><Statistic title="Home Community ID" value={domain.homeCommunityId} styles={{ content: { fontSize:12, fontFamily:'monospace' } }} /></Col>
            <Col span={8}><Statistic title="Assigning Authority" value={domain.assigningAuthorityId} styles={{ content: { fontSize:12, fontFamily:'monospace' } }} /></Col>
          </Row>
        ) : (
          <Tag color="default">暂无数据</Tag>
        )}
      </Card>
      <Card size="small" title={<Space><ArrowLeftRight size={14}/>支持的 IHE 事务</Space>}>
        <Table dataSource={transactions.map((t, i) => ({ key: i, transaction: t }))} rowKey="key" pagination={false}
          columns={[
            { title: '事务', dataIndex: 'transaction', render: (t: string) => <Tag color="blue">{t}</Tag> },
          ]} />
      </Card>
    </div>
  );
};
export default IheIntegrationPage;
