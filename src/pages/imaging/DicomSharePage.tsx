// [v3.0.6.8-68] DICOM 影像跨科室共享
import React, { useState } from 'react';
import { Card, Space, Tag, Button, Table, Select, Row, Col, Statistic, message, Modal, Form } from 'antd';
import { Share2, Send, Download } from 'lucide-react';

export const DicomSharePage: React.FC = () => {
  const [shareModal, setShareModal] = useState(false);
  const [shareForm] = Form.useForm();
  const [shares, setShares] = useState([
    { id: 'SHR-001', studyId: 'CBCT-20260625-01', patient: '\u5f20\u4f1f', from: '\u653e\u5c04\u79d1', to: '\u53e3\u8154\u79d1', status: 'sent', sentAt: '2026-06-25 14:30', size: '145MB' },
    { id: 'SHR-002', studyId: 'CT-20260624-03', patient: '\u674e\u5a1c', from: '\u653e\u5c04\u79d1', to: '\u53e3\u8154\u5916\u79d1', status: 'received', sentAt: '2026-06-24 10:15', size: '210MB' },
    { id: 'SHR-003', studyId: 'OCT-20260623-07', patient: '\u738b\u82b3', from: '\u653e\u5c04\u79d1', to: '\u773c\u79d1', status: 'pending', sentAt: '2026-06-23 16:00', size: '85MB' },
  ]);
  const numPending = shares.filter(s => s.status === 'pending').length;
  const numReceived = shares.filter(s => s.status === 'received').length;
  const statusColor: Record<string, string> = { sent: 'blue', received: 'green', pending: 'orange', failed: 'red' };

  // 行内下载：有 URL 直接打开，否则生成 JSON blob 下载
  const handleDownload = (row: any) => {
    if (row.url) {
      window.open(row.url, '_blank');
      return;
    }
    const blob = new Blob([JSON.stringify({ id: row.id, studyId: row.studyId, patient: row.patient, from: row.from, to: row.to, status: row.status, sentAt: row.sentAt, size: row.size }, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${row.studyId}-share.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`已下载共享记录: ${row.studyId}`);
  };

  // 共享请求：本地记录 + 提示（无后端 share 端点时保证可用）
  const handleShareOk = async () => {
    let values: any = {};
    try { values = await shareForm.validateFields(); } catch { return; }
    const studyPatient: Record<string, string> = { 'CBCT-001': '\u5f20\u4f1f', 'CT-002': '\u674e\u5a1c', 'OCT-003': '\u738b\u82b3' };
    const record = {
      id: `SHR-${String(Date.now()).slice(-4)}`,
      studyId: values.study || 'UNKNOWN',
      patient: studyPatient[values.study] || '\u672a\u77e5',
      from: '\u653e\u5c04\u79d1',
      to: Array.isArray(values.departments) ? values.departments.join(',') : (values.departments || ''),
      protocol: values.protocol || 'dicom-tls',
      status: 'pending',
      sentAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      size: '-',
    };
    setShares(prev => [record, ...prev]);
    setShareModal(false);
    shareForm.resetFields();
    message.success(`已发送共享请求: ${record.studyId} → ${record.to}`);
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Share2 size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>DICOM 跨科室共享</span>
        <Tag color="cyan">v3.0.6.8-68</Tag>
        <Tag color="purple">DICOM TLS</Tag>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="今日" value="12" /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="待处理" value={numPending} styles={{ content: { color:'#faad14' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="已完成" value={numReceived} styles={{ content: { color:'#52c41a' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="总量" value="1.2" suffix="GB" /></Card></Col>
      </Row>
      <Card extra={<Button type="primary" icon={<Send size={12}/>} onClick={()=>setShareModal(true)}>分享</Button>} size="small" title="传输记录">
        <Table dataSource={shares} rowKey="id" pagination={false}
          columns={[
            {title:'编号',dataIndex:'id'},{title:'Study',dataIndex:'studyId'},{title:'患者',dataIndex:'patient'},
            {title:'来源',dataIndex:'from',render:(f:string)=><Tag color="blue">{f}</Tag>},
            {title:'去向',dataIndex:'to',render:(t:string)=><Tag color="purple">{t}</Tag>},
            {title:'大小',dataIndex:'size'},
            {title:'状态',dataIndex:'status',render:(s:string)=><Tag color={statusColor[s] || 'default'}>{s}</Tag>},
            {title:'时间',dataIndex:'sentAt'},
            {title:'操作',render:(_:any, row:any)=><Space><Button size="small" icon={<Download size={12}/>} onClick={()=>handleDownload(row)}>下载</Button></Space>},
          ]} />
      </Card>
      <Modal title="共享 DICOM 检查" open={shareModal} onCancel={()=>setShareModal(false)} onOk={handleShareOk} okText="发送共享请求" width={460}>
        <Form form={shareForm} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item name="study" label="Study" rules={[{ required: true, message: '请选择检查' }]}><Select options={[{value:'CBCT-001',label:'ZW-36 CBCT'},{value:'CT-002',label:'LN-Head CT'},{value:'OCT-003',label:'WF-OCT'}]} /></Form.Item>
          <Form.Item name="departments" label="目标科室" rules={[{ required: true, message: '请选择目标科室' }]}><Select mode="multiple" options={['Oral','Oral Surgery','Ortho','Eye','ENT'].map(d=>({value:d,label:d}))} /></Form.Item>
          <Form.Item name="protocol" label="协议" initialValue="dicom-tls"><Select options={[{value:'dicom-tls',label:'DICOM TLS'},{value:'wado',label:'WADO'}]} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default DicomSharePage;
