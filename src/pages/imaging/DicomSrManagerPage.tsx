// [v3.0.6.8-72] DICOM SR管理 + AI发现管理器
import React, { useState } from 'react';
import { Card, Space, Tag, Table, Button, Row, Col, Statistic, Tabs, Badge, Progress, message } from 'antd';
import { FileText, Brain, Eye, Share2, Clock } from 'lucide-react';

export const DicomSrManagerPage: React.FC = () => {
  const [srList] = useState([
    { id:'SR-001', studyId:'CBCT-0628-01', type:'Measurement', modality:'CBCT', findings:12, status:'final', created:'2026-06-28', author:'Dr. Wang' },
    { id:'SR-002', studyId:'CT-0627-03', type:'AI Finding', modality:'CT', findings:5, status:'preliminary', created:'2026-06-27', author:'AI-Insight v2' },
    { id:'SR-003', studyId:'OCT-0626-07', type:'Segmentation', modality:'OCT', findings:8, status:'final', created:'2026-06-26', author:'Dr. Li' },
  ]);
  const [aiFindings, setAiFindings] = useState([
    { id:'AI-001', studyId:'CBCT-0628-01', finding:'Periapical radiolucency #36', confidence:0.92, status:'confirmed', modality:'CBCT' },
    { id:'AI-002', studyId:'CBCT-0628-01', finding:'Impacted #38 - mesioangular', confidence:0.88, status:'pending', modality:'CBCT' },
    { id:'AI-003', studyId:'OCT-0626-07', finding:'Drusen > 5 on OD', confidence:0.95, status:'confirmed', modality:'OCT' },
    { id:'AI-004', studyId:'CT-0625-02', finding:'Nodule RLL 8mm', confidence:0.79, status:'dismissed', modality:'CT' },
  ]);
  const pendingAI = aiFindings.filter(f => f.status === 'pending').length;
  const confirmedAI = aiFindings.filter(f => f.status === 'confirmed').length;

  const srCols = [
    {title:'编号',dataIndex:'id'},{title:'Study',dataIndex:'studyId'},
    {title:'类型',dataIndex:'type',render:(t:string)=><Tag color={t==='AI Finding'?'blue':'green'}>{t}</Tag>},
    {title:'Modality',dataIndex:'modality',render:(m:string)=><Tag>{m}</Tag>},
    {title:'所见',dataIndex:'findings'},
    {title:'状态',dataIndex:'status',render:(s:string)=><Badge status={s==='final'?'success':'processing'} text={s} />},
    {title:'作者',dataIndex:'author'},{title:'日期',dataIndex:'created'},
    {title:'操作',render:(_: any, r: any)=><Space><Button size="small" disabled><Eye size={10}/>查看</Button><Button size="small" disabled><Share2 size={10}/>导出</Button></Space>},
  ];
  const aiCols = [
    {title:'编号',dataIndex:'id'},{title:'Study',dataIndex:'studyId'},
    {title:'所见',dataIndex:'finding',width:280},
    {title:'置信度',dataIndex:'confidence',render:(c:number)=><><Progress percent={Math.round(c*100)} size="small"/><span style={{fontSize:11,marginLeft:4}}>{(c*100).toFixed(0)}%</span></>},
    {title:'状态',dataIndex:'status',render:(s:string)=><Badge status={s==='confirmed'?'success':s==='pending'?'processing':'default'} text={s} />},
    {title:'Modality',dataIndex:'modality'},
    {title:'操作',render:(_: any, r: any)=><Space><Button size="small" onClick={() => { setAiFindings(prev => prev.map((f: any) => f.id === r.id ? {...f, status:'confirmed'} : f)); message.success('已确认: ' + r.finding); }}>确认</Button><Button size="small" onClick={() => { setAiFindings(prev => prev.map((f: any) => f.id === r.id ? {...f, status:'dismissed'} : f)); message.success('已忽略: ' + r.finding); }}>忽略</Button></Space>},
  ];

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <FileText size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>DICOM SR and AI Findings Manager</span>
        <Tag color="cyan">v3.0.6.8-72</Tag>
        <Tag color="purple">TID 1500</Tag>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="SR 文档" value={srList.length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="AI 发现" value={aiFindings.length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="已确认" value={confirmedAI} styles={{ content: { color:'#52c41a' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="待处理" value={pendingAI} styles={{ content: { color:'#faad14' } }} /></Card></Col>
      </Row>
      <Card size="small">
        <Tabs items={[
          {key:'sr', label:'SR Documents', children:<Table dataSource={srList} rowKey="id" pagination={false} columns={srCols} />},
          {key:'ai', label:'AI Findings', children:<Table dataSource={aiFindings} rowKey="id" pagination={false} columns={aiCols} />},
        ]} />
      </Card>
    </div>
  );
};
export default DicomSrManagerPage;