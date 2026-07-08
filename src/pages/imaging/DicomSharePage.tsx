// [v3.0.6.8-68] DICOM 影像跨科室共享
import React, { useState } from 'react';
import { Card, Space, Tag, Button, Table, Select, Input, Row, Col, Statistic, message, Modal, Form } from 'antd';
import { Share2, Send, Download } from 'lucide-react';

export const DicomSharePage: React.FC = () => {
  const [shareModal, setShareModal] = useState(false);
  const [shares] = useState([
    { id: 'SHR-001', studyId: 'CBCT-20260625-01', patient: '\u5f20\u4f1f', from: '\u653e\u5c04\u79d1', to: '\u53e3\u8154\u79d1', status: 'sent', sentAt: '2026-06-25 14:30', size: '145MB' },
    { id: 'SHR-002', studyId: 'CT-20260624-03', patient: '\u674e\u5a1c', from: '\u653e\u5c04\u79d1', to: '\u53e3\u8154\u5916\u79d1', status: 'received', sentAt: '2026-06-24 10:15', size: '210MB' },
    { id: 'SHR-003', studyId: 'OCT-20260623-07', patient: '\u738b\u82b3', from: '\u653e\u5c04\u79d1', to: '\u773c\u79d1', status: 'pending', sentAt: '2026-06-23 16:00', size: '85MB' },
  ]);
  const numPending = shares.filter(s => s.status === 'pending').length;
  const numReceived = shares.filter(s => s.status === 'received').length;
  const statusColor: Record<string, string> = { sent: 'blue', received: 'green', pending: 'orange', failed: 'red' };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Share2 size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>DICOM across-dept share</span>
        <Tag color="cyan">v3.0.6.8-68</Tag>
        <Tag color="purple">DICOM TLS</Tag>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="Today" value="12" /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Pending" value={numPending} valueStyle={{color:'#faad14'}} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Done" value={numReceived} valueStyle={{color:'#52c41a'}} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Total" value="1.2" suffix="GB" /></Card></Col>
      </Row>
      <Card extra={<Button type="primary" icon={<Send size={12}/>} onClick={()=>setShareModal(true)}>Share</Button>} size="small" title="Transfer Records">
        <Table dataSource={shares} rowKey="id" pagination={false}
          columns={[
            {title:'ID',dataIndex:'id'},{title:'Study',dataIndex:'studyId'},{title:'Patient',dataIndex:'patient'},
            {title:'From',dataIndex:'from',render:(f:string)=><Tag color="blue">{f}</Tag>},
            {title:'To',dataIndex:'to',render:(t:string)=><Tag color="purple">{t}</Tag>},
            {title:'Size',dataIndex:'size'},
            {title:'Status',dataIndex:'status',render:(s:string)=><Tag color={statusColor[s] || 'default'}>{s}</Tag>},
            {title:'Time',dataIndex:'sentAt'},
            {title:'Action',render:(_:any)=><Space><Button size="small">Download</Button></Space>},
          ]} />
      </Card>
      <Modal title="Share DICOM Study" open={shareModal} onCancel={()=>setShareModal(false)} onOk={()=>{message.success('已发送共享请求(模拟)');setShareModal(false)}} width={460}>
        <Form layout="vertical" size="small">
          <Form.Item label="Study"><Select options={[{value:'CBCT-001',label:'ZW-36 CBCT'},{value:'CT-002',label:'LN-Head CT'},{value:'OCT-003',label:'WF-OCT'}]} /></Form.Item>
          <Form.Item label="Target Dept"><Select mode="multiple" options={['Oral','Oral Surgery','Ortho','Eye','ENT'].map(d=>({value:d,label:d}))} /></Form.Item>
          <Form.Item label="Protocol"><Select options={[{value:'dicom-tls',label:'DICOM TLS'},{value:'wado',label:'WADO'}]} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default DicomSharePage;
