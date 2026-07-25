// [v3.0.6.8-63] EMR 病历模板管理 + ICD-11 编码
import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Button, Table, Select, Input, Row, Col, Statistic, message, Tabs, Empty, Modal, Form, List, Alert, Badge, Descriptions, Tooltip } from 'antd';
import { Activity, Plus, Edit3, Copy, Search, BookOpen, Code, FileText, Save } from 'lucide-react';

const { TextArea } = Input;

// ICD-11 mock data
const ICD11_DISEASES = [
  { code: '5A10', name: 'Type 2 diabetes mellitus', category: 'Endocrine' },
  { code: '9B70.0', name: 'Hypertensive disorders', category: 'Cardiovascular' },
  { code: 'BA00', name: 'Ischemic heart disease', category: 'Cardiovascular' },
  { code: '8B60', name: 'Chronic obstructive pulmonary disease', category: 'Respiratory' },
  { code: '2F30', name: 'Malignant neoplasm of bronchus or lung', category: 'Oncology' },
  { code: '8A02', name: 'Pneumonia', category: 'Respiratory' },
  { code: '7B10', name: 'Peptic ulcer', category: 'Gastroenterology' },
  { code: 'DA00', name: 'Caries of enamel', category: 'Dental' },
  { code: 'DA01', name: 'Dentine caries', category: 'Dental' },
  { code: 'DA02.0', name: 'Pulpitis', category: 'Dental' },
  { code: 'DA06.0', name: 'Periapical abscess without sinus', category: 'Dental' },
  { code: 'DA0A', name: 'Periodontitis', category: 'Dental' },
];

const EMR_TEMPLATES = [
  { id: 'tpl-1', name: '常规口腔检查', category: 'Dental', sections: [{title:'主诉',required:true},{title:'现病史',required:true},{title:'检查所见',required:true},{title:'诊断',required:true},{title:'治疗计划',required:true}], usageCount: 128 },
  { id: 'tpl-2', name: '根管治疗记录', category: 'Dental', sections: [{title:'牙位',required:true},{title:'诊断',required:true},{title:'根管数目',required:true},{title:'根管长度',required:true},{title:'充填材料',required:false}], usageCount: 85 },
  { id: 'tpl-3', name: '种植评估', category: 'Dental', sections: [{title:'缺牙区情况',required:true},{title:'骨量评估',required:true},{title:'种植体选择',required:true},{title:'手术方案',required:true}], usageCount: 42 },
];

export const EmrTemplatesPage: React.FC = () => {
  const [tab, setTab] = useState('templates');
  const [searchCode, setSearchCode] = useState('');
  const [icdResults, setIcdResults] = useState(ICD11_DISEASES);
  const [templates] = useState(EMR_TEMPLATES);
  const [templateModal, setTemplateModal] = useState<{type:'create'|'edit', data:any}|null>(null);

  useEffect(() => {
    if (searchCode) {
      setIcdResults(ICD11_DISEASES.filter(d =>
        d.code.includes(searchCode) || d.name.toLowerCase().includes(searchCode.toLowerCase())
      ));
    } else {
      setIcdResults(ICD11_DISEASES);
    }
  }, [searchCode]);

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <FileText size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>EMR 病历模板 + ICD-11 编码</span>
        <Tag color="cyan">v3.0.6.8-63</Tag>
      </Space>

      <Tabs activeKey={tab} onChange={setTab} type="card"
        items={[
          { key:'templates', label:'病历模板', children:
            <Card size="small" extra={<Button type="primary" icon={<Plus size={12}/>} onClick={()=>setTemplateModal({type:'create',data:{}})}>新建模板</Button>} title={`病历模板 (${templates.length})`}>
              <List dataSource={templates} renderItem={(t:any) => (
                <List.Item actions={[
                  <Button size="small" icon={<Edit3 size={12}/>}>编辑</Button>,
                  <Button size="small" icon={<Copy size={12}/>}>复制</Button>,
                ]}>
                  <List.Item.Meta
                    title={<Space><Tag color="blue">{t.category}</Tag>{t.name}<Tag>使用 {t.usageCount} 次</Tag></Space>}
                    description={<span style={{fontSize:12,color:'#666'}}>{t.sections.map((s:any)=><Tag key={s.title} color={s.required?'red':'default'} style={{margin:2}}>{s.title}</Tag>)}</span>}
                  />
                </List.Item>
              )} />
            </Card>
          },
          { key:'icd11', label:'ICD-11 编码', children:
            <Card size="small" extra={
              <Input.Search size="small" value={searchCode} onChange={e=>setSearchCode(e.target.value)} placeholder="搜索编码/名称" style={{width:250}} />
            } title={`ICD-11 ${icdResults.length} 条`}>
              <Table dataSource={icdResults} rowKey="code" pagination={false}
                columns={[
                  {title:'编码',dataIndex:'code',render:(c)=><Tag color="blue">{c}</Tag>},
                  {title:'名称',dataIndex:'name'},
                  {title:'分类',dataIndex:'category',render:(c)=><Tag>{c}</Tag>},
                  {title:'操作',render:(_,r)=><Button size="small" icon={<Plus size={10}/>}>添加到诊断</Button>},
                ]} />
            </Card>
          },
        ]}
      />
      <Modal title={templateModal?.type === 'create' ? '新建模板' : '编辑模板'} open={!!templateModal} onCancel={()=>setTemplateModal(null)} onOk={()=>{message.success('模板已保存');setTemplateModal(null)}} width={500}>
        <Form layout="vertical" size="small">
          <Form.Item label="模板名称"><Input /></Form.Item>
          <Form.Item label="分类"><Select options={['Dental','General','Surgery','Ortho','Pediatric'].map(c=>({value:c,label:c}))} /></Form.Item>
          <Form.Item label="章节 (逗号分隔)"><Input placeholder="主诉,现病史,检查所见,诊断,治疗计划" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default EmrTemplatesPage;
