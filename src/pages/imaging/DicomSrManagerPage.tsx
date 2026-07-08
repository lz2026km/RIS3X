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
    {title:'ID',dataIndex:'id'},{title:'Study',dataIndex:'studyId'},
    {title:'Type',dataIndex:'type',render:(t:string)=><Tag color={t==='AI Finding'?'blue':'green'}>{t}</Tag>},
    {title:'Modality',dataIndex:'modality',render:(m:string)=><Tag>{m}</Tag>},
    {title:'Findings',dataIndex:'findings'},
    {title:'Status',dataIndex:'status',render:(s:string)=><Badge status={s==='final'?'success':'processing'} text={s} />},
    {title:'Author',dataIndex:'author'},{title:'Date',dataIndex:'created'},
    {title:'Action',render:(_: any, r: any)=><Space><Button size="small" onClick={() => message.info('查看SR: ' + r.id)}><Eye size={10}/>View</Button><Button size="small" onClick={() => message.success('已导出SR(模拟): ' + r.id)}><Share2 size={10}/>Export</Button></Space>},
  ];
  const aiCols = [
    {title:'ID',dataIndex:'id'},{title:'Study',dataIndex:'studyId'},
    {title:'Finding',dataIndex:'finding',width:280},
    {title:'Confidence',dataIndex:'confidence',render:(c:number)=><><Progress percent={Math.round(c*100)} size="small"/><span style={{fontSize:11,marginLeft:4}}>{(c*100).toFixed(0)}%</span></>},
    {title:'Status',dataIndex:'status',render:(s:string)=><Badge status={s==='confirmed'?'success':s==='pending'?'processing':'default'} text={s} />},
    {title:'Modality',dataIndex:'modality'},
    {title:'Action',render:(_: any, r: any)=><Space><Button size="small" onClick={() => { setAiFindings(prev => prev.map((f: any) => f.id === r.id ? {...f, status:'confirmed'} : f)); message.success('已确认: ' + r.finding); }}>Confirm</Button><Button size="small" onClick={() => { setAiFindings(prev => prev.map((f: any) => f.id === r.id ? {...f, status:'dismissed'} : f)); message.success('已忽略: ' + r.finding); }}>Dismiss</Button></Space>},
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
        <Col span={4}><Card size="small"><Statistic title="SR Docs" value={srList.length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="AI Findings" value={aiFindings.length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Confirmed" value={confirmedAI} valueStyle={{color:'#52c41a'}} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Pending" value={pendingAI} valueStyle={{color:'#faad14'}} /></Card></Col>
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