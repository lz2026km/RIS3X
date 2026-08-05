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
    { id:'TPL-001', name:'CT Chest Routine', category:'结构化', modality:'CT', bodyPart:'胸部', version:3, usage:147, status:'已发布', shared:true },
    { id:'TPL-002', name:'CBCT Dental Implant', category:'结构化', modality:'CBCT', bodyPart:'下颌骨', version:2, usage:89, status:'已发布', shared:true },
    { id:'TPL-003', name:'OCT Macula', category:'自由文本', modality:'OCT', bodyPart:'视网膜', version:1, usage:234, status:'已发布', shared:true },
    { id:'TPL-004', name:'MRI Brain Tumor Follow-up', category:'结构化', modality:'MRI', bodyPart:'脑部', version:1, usage:56, status:'草稿', shared:false },
  ]);
  const [snippets] = useState<Snippet[]>([
    { id:'SNP-001', name:'正常所见 - 胸部', content:'无急性心肺异常。', category:'正常', shortcuts:'nml-chest', usage:421 },
    { id:'SNP-002', name:'植入体 #36 描述', content:'植入体 #36 牙冠，骨结合良好。', category:'牙科', shortcuts:'imp-36', usage:98 },
    { id:'SNP-003', name:'对比剂反应记录', content:'轻度荨麻疹，抗组胺治疗后缓解。', category:'安全', shortcuts:'ctr-rxn', usage:67 },
  ]);
  const [editModal, setEditModal] = useState(false);
  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Layout size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>报告模板管理</span>
        <Tag color="cyan">v3.0.6.8-74</Tag>
        <Tag color="blue">智能片段</Tag>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="模板" value={templates.length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="片段" value={snippets.length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="已发布" value={templates.filter(t=>t.status==='published').length} styles={{ content: { color:'#52c41a' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="总使用量" value={templates.reduce((a,t)=>a+t.usage,0)} /></Card></Col>
      </Row>
      <Card size="small" extra={<Button type="primary" icon={<Plus size={12}/>}>新建模板</Button>} title={<Space><FileText size={14}/>报告模板</Space>}>
        <Table dataSource={templates} rowKey="id" pagination={false}
          columns={[
            {title:'名称',dataIndex:'name',width:200},
            {title:'类别',dataIndex:'category',render:(c:string)=><Tag color={c==='结构化'?'blue':'green'}>{c}</Tag>},
            {title:'设备',dataIndex:'modality'},{title:'检查部位',dataIndex:'bodyPart'},
            {title:'版本',dataIndex:'version',render:(v:number)=><Tag>{'v'+v}</Tag>},
            {title:'使用量',dataIndex:'usage'},{title:'共享',dataIndex:'shared',render:(s:boolean)=><Badge status={s?'success':'default'} />},
            {title:'状态',dataIndex:'status',render:(s:string)=><Badge status={s==='已发布'?'success':'default'} text={s} />},
            {title:'操作',render:()=><Space><Button size="small" icon={<Edit3 size={10}/>}>编辑</Button><Button size="small" icon={<Copy size={10}/>}>克隆</Button></Space>},
          ]} />
      </Card>
      <Card size="small" title={<Space><Layers size={14}/>智能片段</Space>} style={{marginTop:16}} extra={<Button icon={<Plus size={12}/>}>新建片段</Button>}>
        <Table dataSource={snippets} rowKey="id" pagination={false}
          columns={[
            {title:'名称',dataIndex:'name',width:240},{title:'内容',dataIndex:'content',width:300,render:(c:string)=><Typography.Paragraph ellipsis={{rows:1}} style={{margin:0,fontSize:12}}>{c}</Typography.Paragraph>},
            {title:'类别',dataIndex:'category',render:(c:string)=><Tag color={c==='正常'?'green':c==='牙科'?'purple':'orange'}>{c}</Tag>},
            {title:'快捷键',dataIndex:'shortcuts',render:(s:string)=><Tag color="geekblue">{s}</Tag>},
            {title:'使用量',dataIndex:'usage'},
            {title:'操作',render:()=><Space><Button size="small"><Edit3 size={10}/></Button><Button size="small"><Copy size={10}/></Button></Space>},
          ]} />
      </Card>
    </div>
  );
};
export default ReportTemplateManagerPage;
