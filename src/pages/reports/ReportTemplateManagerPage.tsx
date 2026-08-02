// [v3.0.6.8-74] 报告模板管理 + 智能片段系统
import React, { useState } from 'react';
import { Card, Space, Tag, Table, Button, Row, Col, Statistic, Input, Tabs, Badge, Modal, Form, Select, message, Tooltip, Typography } from 'antd';
import { FileText, Copy, Plus, Edit3, Star, Clock, Layout, Code, Layers } from 'lucide-react';

interface Template {
  id: string; name: string; category: string; modality: string; bodyPart: string; version: number; usage: number; status: string; shared: boolean;
}
interface Snippet {
  id: string; name: string; content: string; category: string; shortcuts: string; usage: number;
}

export const ReportTemplateManagerPage: React.FC = () => {
  const [templates] = useState<Template[]>([
    { id:'TPL-001', name:'CT Chest Routine', category:'Structured', modality:'CT', bodyPart:'Chest', version:3, usage:147, status:'published', shared:true },
    { id:'TPL-002', name:'CBCT Dental Implant', category:'Structured', modality:'CBCT', bodyPart:'Mandible', version:2, usage:89, status:'published', shared:true },
    { id:'TPL-003', name:'OCT Macula', category:'Free-text', modality:'OCT', bodyPart:'Retina', version:1, usage:234, status:'published', shared:true },
    { id:'TPL-004', name:'MRI Brain Tumor Follow-up', category:'Structured', modality:'MRI', bodyPart:'Brain', version:1, usage:56, status:'draft', shared:false },
  ]);
  const [snippets] = useState<Snippet[]>([
    { id:'SNP-001', name:'Normal Finding - Chest', content:'No acute cardiopulmonary abnormality.', category:'Normal', shortcuts:'nml-chest', usage:421 },
    { id:'SNP-002', name:'Implant #36 Description', content:'Crown on implant #36, satisfactory osseointegration.', category:'Dental', shortcuts:'imp-36', usage:98 },
    { id:'SNP-003', name:'Contrast Reaction Note', content:'Mild urticaria, resolved with antihistamine.', category:'Safety', shortcuts:'ctr-rxn', usage:67 },
  ]);
  const [editModal, setEditModal] = useState(false);
  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Layout size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>Report Template Manager</span>
        <Tag color="cyan">v3.0.6.8-74</Tag>
        <Tag color="blue">Smart Snippets</Tag>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="模板" value={templates.length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="片段" value={snippets.length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="已发布" value={templates.filter(t=>t.status==='published').length} styles={{ content: { color:'#52c41a' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="总使用量" value={templates.reduce((a,t)=>a+t.usage,0)} /></Card></Col>
      </Row>
      <Card size="small" extra={<Button type="primary" icon={<Plus size={12}/>}>New Template</Button>} title={<Space><FileText size={14}/>Report Templates</Space>}>
        <Table dataSource={templates} rowKey="id" pagination={false}
          columns={[
            {title:'名称',dataIndex:'name',width:200},
            {title:'类别',dataIndex:'category',render:(c:string)=><Tag color={c==='Structured'?'blue':'green'}>{c}</Tag>},
            {title:'Modality',dataIndex:'modality'},{title:'检查部位',dataIndex:'bodyPart'},
            {title:'版本',dataIndex:'version',render:(v:number)=><Tag>{'v'+v}</Tag>},
            {title:'使用量',dataIndex:'usage'},{title:'Shared',dataIndex:'shared',render:(s:boolean)=><Badge status={s?'success':'default'} />},
            {title:'状态',dataIndex:'status',render:(s:string)=><Badge status={s==='published'?'success':'default'} text={s} />},
            {title:'操作',render:()=><Space><Button size="small" icon={<Edit3 size={10}/>}>编辑</Button><Button size="small" icon={<Copy size={10}/>}>克隆</Button></Space>},
          ]} />
      </Card>
      <Card size="small" title={<Space><Layers size={14}/>Smart Snippets</Space>} style={{marginTop:16}} extra={<Button icon={<Plus size={12}/>}>New Snippet</Button>}>
        <Table dataSource={snippets} rowKey="id" pagination={false}
          columns={[
            {title:'名称',dataIndex:'name',width:240},{title:'内容',dataIndex:'content',width:300,render:(c:string)=><Typography.Paragraph ellipsis={{rows:1}} style={{margin:0,fontSize:12}}>{c}</Typography.Paragraph>},
            {title:'类别',dataIndex:'category',render:(c:string)=><Tag color={c==='Normal'?'green':c==='Dental'?'purple':'orange'}>{c}</Tag>},
            {title:'快捷键',dataIndex:'shortcuts',render:(s:string)=><Tag color="geekblue">{s}</Tag>},
            {title:'使用量',dataIndex:'usage'},
            {title:'操作',render:()=><Space><Button size="small"><Edit3 size={10}/></Button><Button size="small"><Copy size={10}/></Button></Space>},
          ]} />
      </Card>
    </div>
  );
};
export default ReportTemplateManagerPage;
