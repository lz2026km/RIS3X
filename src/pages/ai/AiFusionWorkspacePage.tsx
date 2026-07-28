// [v3.0.6.8-76] 多模态AI融合工作台
import React, { useState } from 'react';
import { Card, Space, Tag, Table, Button, Row, Col, Statistic, Tabs, Badge, Progress, List, Tooltip, Segmented, message } from 'antd';
import { Brain, Eye, Activity, Layers, BarChart3, Crosshair, FileText, Image, Share2, Download, Sparkles } from 'lucide-react';

export const AiFusionWorkspacePage: React.FC = () => {
  const [modality, setModality] = useState('cbct');
  const [studies] = useState([
    { id:'ST-001', patient:'Zhang Wei', modalities:'CBCT+OCT+Photo', fusionScore:0.94, findings:7, aiAlerts:2, status:'complete', date:'2026-06-28' },
    { id:'ST-002', patient:'Li Na', modalities:'CT+MRI', fusionScore:0.87, findings:5, aiAlerts:0, status:'pending', date:'2026-06-27' },
    { id:'ST-003', patient:'Wang Fang', modalities:'OCT+Fundus+FA', fusionScore:0.91, findings:9, aiAlerts:3, status:'complete', date:'2026-06-26' },
  ]);
  const [aiInsights] = useState([
    { id:'AI-001', type:'lesion', finding:'Periapical lesion #36', confidence:0.92, modality:'CBCT', source:'AI-Detector v3', actionable:true },
    { id:'AI-002', type:'vessel', finding:'Tortuous vessels OD', confidence:0.88, modality:'OCT-A', source:'RetinaAI v2', actionable:true },
    { id:'AI-003', type:'measurement', finding:'Crown-root ratio 0.45', confidence:0.95, modality:'CBCT', source:'OrthoAI', actionable:false },
    { id:'AI-004', type:'classification', finding:'DR Grade 2 - Moderate', confidence:0.91, modality:'Fundus', source:'RetinaAI v2', actionable:true },
  ]);
  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Brain size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>Multi-modal AI Fusion Workspace</span>
        <Tag color="cyan">v3.0.6.8-76</Tag>
        <Tag color="purple">Late Fusion</Tag>
        <Tag color="volcano">Cross-Attention</Tag>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="Fusion Studies" value={studies.length} prefix={<Layers size={14}/>} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="AI Insights" value={aiInsights.length} prefix={<Sparkles size={14}/>} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Actionable Alerts" value={aiInsights.filter(i=>i.actionable).length} valueStyle={{color:'#ff4d4f'}} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Avg Fusion Score" value={(studies.reduce((a,s)=>a+s.fusionScore,0)/studies.length*100).toFixed(0)} suffix="%" /></Card></Col>
      </Row>
      <Segmented value={modality} onChange={setModality as any}
        options={[
          {value:'cbct', label:' CBCT'},{value:'oct', label:' OCT'},{value:'fundus', label:' Fundus'},
          {value:'fusion', label:' Fusion Overlay'},
        ]} style={{marginBottom:16}} />
      <Row gutter={16} style={{marginBottom:16}}>
        <Col span={16}>
          <Card size="small" style={{height:300,display:'flex',alignItems:'center',justifyContent:'center',background:'#000',color:'#fff'}}>
            {'[ Multi-modal Fusion Canvas Area ]'}
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={<Space><BarChart3 size={14}/>AI Insights</Space>} style={{height:300}}>
            <List dataSource={aiInsights} renderItem={(item:any)=><List.Item style={{padding:'6px 0'}}><Tooltip title={`${item.source}: ${(item.confidence*100).toFixed(0)}%`}>
              <Space><Tag color={item.type==='lesion'?'red':item.type==='vessel'?'blue':item.type==='measurement'?'green':'orange'}>{item.type}</Tag>
              <span style={{fontSize:12}}>{item.finding}</span>
              {item.actionable && <Badge status="error" />}</Space></Tooltip></List.Item>} />
          </Card>
        </Col>
      </Row>
      <Card size="small" title={<Space><FileText size={14}/>Fusion Studies</Space>} extra={<Button icon={<Share2 size={12}/>} onClick={() => message.warning('功能建设中')}>Export Fusion Report</Button>}>
        <Table dataSource={studies} rowKey="id" pagination={false}
          columns={[
            {title:'Patient',dataIndex:'patient'},{title:'Modalities',dataIndex:'modalities'},
            {title:'Fusion Score',dataIndex:'fusionScore',render:(s:number)=><Progress percent={Math.round(s*100)} size="small" strokeColor={s>0.9?'#52c41a':s>0.8?'#faad14':'#ff4d4f'} />},
            {title:'Findings',dataIndex:'findings'},
            {title:'AI Alerts',dataIndex:'aiAlerts',render:(a:number)=><Badge count={a} size="small" />},
            {title:'Status',dataIndex:'status',render:(s:string)=><Badge status={s==='complete'?'success':'processing'} text={s} />},
            {title:'Date',dataIndex:'date'},
            {title:'Action',render:()=><Space><Button size="small" onClick={() => message.warning('功能建设中')}><Eye size={10}/>View</Button><Button size="small" onClick={() => message.warning('功能建设中')}><Download size={10}/>Download</Button></Space>},
          ]} />
      </Card>
    </div>
  );
};
export default AiFusionWorkspacePage;
