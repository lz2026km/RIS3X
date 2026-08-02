import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Space, Tag, Table, Descriptions, Steps, Divider, message } from 'antd';
import { Activity, Clock, ArrowRight, GitBranch } from 'lucide-react';
import { iheApi } from '../../services/api/integrationApi';
import type { VisitState } from '../../services/api/integrationApi';

const STATE_STEPS = [
  { key: 'registered', title: 'Registered', color: 'default' },
  { key: 'admitted', title: 'Admitted', color: 'blue' },
  { key: 'inProgress', title: 'In Progress', color: 'processing' },
  { key: 'completed', title: 'Completed', color: 'green' },
  { key: 'discharged', title: 'Discharged', color: 'red' },
];

const STATE_MAP: Record<string, number> = {
  registered: 0, admitted: 1, inProgress: 2, completed: 3, discharged: 4,
};

export const VisitDetailPage: React.FC = () => {
  const { patientId, visitNumber } = useParams<{ patientId: string; visitNumber: string }>();
  const [visit, setVisit] = useState<VisitState | null>(null);

  useEffect(() => {
    if (patientId && visitNumber) loadVisit();
  }, [patientId, visitNumber]);

  const loadVisit = async () => {
    if (!patientId || !visitNumber) return;
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
      message.warning('无法加载就诊数据，已使用演示数据');
    }
  };

  const currentIdx = visit ? (STATE_MAP[visit.status as keyof typeof STATE_MAP] ?? 0) : 0;

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <GitBranch size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>Visit 生命周期</span>
        <Tag color="cyan">v3.0.6.0</Tag>
        <Tag color="blue">{patientId}</Tag>
        <Tag color="purple">{visitNumber}</Tag>
      </Space>

      {visit && (
        <Space orientation="vertical" style={{ width: '100%' }} size={16}>
          <Card size="small" title={<Space><Activity size={14} />5 态状态机</Space>}>
            <Steps current={currentIdx} size="small"
              items={STATE_STEPS.map((s, i) => ({
                title: s.title,
                status: i < currentIdx ? 'finish' : i === currentIdx ? 'process' : 'wait',
                description: i === currentIdx ? '(当前)' : undefined,
              }))}
            />
            <Divider />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              {STATE_STEPS.map((s, i) => (
                <React.Fragment key={s.key}>
                  <Tag color={i <= currentIdx ? s.color : 'default'}
                    style={{ padding: '4px 12px', fontWeight: i <= currentIdx ? 600 : 400, opacity: i <= currentIdx ? 1 : 0.4 }}>
                    {s.title}
                  </Tag>
                  {i < STATE_STEPS.length - 1 && <ArrowRight size={14} style={{ color: '#d9d9d9', alignSelf: 'center' }} />}
                </React.Fragment>
              ))}
            </div>
          </Card>

          <Card size="small" title={<span><Clock size={14} style={{ marginRight: 4 }} />时间戳</span>}>
            <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="入院 (Admit)">{visit?.admitDateTime ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="开始 (In Progress)">{visit?.inProgressAt ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="完成 (Completed)">{visit?.completedAt ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="出院 (Discharge)">{visit?.dischargeDateTime ?? '-'}</Descriptions.Item>
              </Descriptions>
          </Card>

          <Card size="small" title={<span><GitBranch size={14} style={{ marginRight: 4 }} />触发的 ADT 消息</span>}>
            <Table dataSource={visit.adtMessages} rowKey="id" pagination={false}
              columns={[
                { title: 'ID', dataIndex: 'id', width: 60 },
                { title: 'Message Type', dataIndex: 'messageType', render: (t: string) => <Tag color="blue">ADT^{t}</Tag> },
                { title: 'Timestamp', dataIndex: 'timestamp' },
                { title: 'Content', dataIndex: 'content', render: (c: string) => (
                  <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#f5f5f5', padding: '2px 6px', borderRadius: 3 }}>
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
