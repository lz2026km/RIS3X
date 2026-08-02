// [v3.0.6.8-73] 术语服务器/数据字典
import React, { useState } from 'react';
import { Card, Space, Tag, Table, Button, Row, Col, Statistic, Input, Tree, Tabs, Badge } from 'antd';
import { BookOpen, Search, Globe, Code, Hash, Layers, BookMarked } from 'lucide-react';

export const TerminologyServerPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results] = useState([
    { code:'D0140', system:'SNOMED-CT', display:'Periapical radiolucency', conceptId:'122750008', semanticTag:'finding', active:true },
    { code:'K08.8', system:'ICD-11', display:'Disorder of tooth development', conceptId:'', semanticTag:'diagnosis', active:true },
    { code:'245-6', system:'LOINC', display:'CT Abdomen WO contrast', conceptId:'', semanticTag:'procedure', active:true },
    { code:'RID110', system:'RIDICOM', display:'CBCT Mandible 3D', conceptId:'', semanticTag:'imaging', active:true },
    { code:'F44B0', system:'ICD-11', display:'Cataract unspecified', conceptId:'', semanticTag:'diagnosis', active:true },
  ]);
  const mappings = [
    { source:'SNOMED:122750008', target:'ICD-11:D0140', mapType:'equivalent', status:'active' },
    { source:'LOINC:245-6', target:'RIDICOM:RID110', mapType:'broader', status:'active' },
    { source:'ICD-11:K08.8', target:'SNOMED:267890001', mapType:'equivalent', status:'active' },
  ];

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <BookOpen size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>Terminology Server</span>
        <Tag color="cyan">v3.0.6.8-73</Tag>
        <Tag color="blue">SNOMED-CT</Tag>
        <Tag color="volcano">ICD-11</Tag>
        <Tag color="green">LOINC</Tag>
        <Tag color="purple">RIDICOM</Tag>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="Total Concepts" value="24,582" prefix={<Code size={14}/>} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Mappings" value={mappings.length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Systems" value="4" /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Active Mappings" value={mappings.filter(m=>m.status==='active').length} styles={{ content: { color:'#52c41a' } }} /></Card></Col>
      </Row>
      <Card size="small" title={<Space><Search size={14}/>Concept Search</Space>}>
        <Input.Search value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by code, term, or concept ID..." style={{maxWidth:500,marginBottom:16}} />
        <Table dataSource={results} rowKey="code" pagination={false}
          columns={[
            {title:'Code',dataIndex:'code'},{title:'System',dataIndex:'system',render:(s:string)=><Tag color={s==='SNOMED-CT'?'blue':s==='ICD-11'?'volcano':s==='LOINC'?'green':'purple'}>{s}</Tag>},
            {title:'Display',dataIndex:'display',width:240},
            {title:'Concept ID',dataIndex:'conceptId'},
            {title:'Semantic Tag',dataIndex:'semanticTag',render:(t:string)=><Tag>{t}</Tag>},
            {title:'Status',dataIndex:'active',render:(a:boolean)=><Badge status={a?'success':'default'} text={a?'Active':'Inactive'} />},
          ]} />
      </Card>
      <Card size="small" title={<Space><Layers size={14}/>Cross-System Mappings</Space>} style={{marginTop:16}}>
        <Table dataSource={mappings} rowKey={(r:any)=>r.source+r.target} pagination={false}
          columns={[
            {title:'Source',dataIndex:'source',render:(s:string)=><Tag color="blue">{s}</Tag>},
            {title:'Target',dataIndex:'target',render:(t:string)=><Tag color="volcano">{t}</Tag>},
            {title:'Map Type',dataIndex:'mapType',render:(m:string)=><Tag color={m==='equivalent'?'green':'orange'}>{m}</Tag>},
            {title:'Status',dataIndex:'status',render:(s:string)=><Badge status={s==='active'?'success':'default'} text={s} />},
          ]} />
      </Card>
    </div>
  );
};
export default TerminologyServerPage;
