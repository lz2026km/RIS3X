// [v3.0.6.8-63] EMR 病历模板管理 + ICD-11 编码
// [W2-A] 模板接入 templatesApi 实时数据; ICD-11 无独立词典端点 → 标注演示数据
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Space, Tag, Button, Table, Select, Input, message, Tabs, Modal, Form, List } from 'antd';
import { Plus, Edit3, Copy, FileText } from 'lucide-react';
import { templatesApi } from '../../services/api/templatesApi';

const {  } = Input;

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
  const [templates, setTemplates] = useState(EMR_TEMPLATES);
  const [templateModal, setTemplateModal] = useState<{type:'create'|'edit', data:any}|null>(null);
  const [form] = Form.useForm();
  const [diagnoses, setDiagnoses] = useState<typeof ICD11_DISEASES>([]);
  // [W2-A] templatesApi 实时加载 (失败回退静态演示数据)
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'api' | 'demo'>('demo');
  const [apiError, setApiError] = useState('');

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setApiError('');
    try {
      const res = await templatesApi.list();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const mapped = res.data.map((t: any, i: number) => ({
          id: t.id || `tpl-${i}`,
          name: t.name || '未命名模板',
          category: t.category || 'General',
          sections: String(t.body || t.name || '')
            .split(/\r?\n/)
            .map((line: string) => line.trim())
            .filter(Boolean)
            .slice(0, 6)
            .map((title: string) => ({ title, required: true })),
          usageCount: Number(t.usage ?? 0),
        }));
        if (mapped.length > 0) {
          setTemplates(mapped);
          setDataSource('api');
        }
      } else {
        setDataSource('demo');
        setApiError('templatesApi 暂不可用，当前展示内置演示模板');
      }
    } catch (e) {
      setDataSource('demo');
      setApiError(e instanceof Error ? e.message : '模板加载失败，已回退演示数据');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  useEffect(() => {
    if (searchCode) {
      setIcdResults(ICD11_DISEASES.filter(d =>
        d.code.includes(searchCode) || d.name.toLowerCase().includes(searchCode.toLowerCase())
      ));
    } else {
      setIcdResults(ICD11_DISEASES);
    }
  }, [searchCode]);

  // 打开编辑模板 Modal 并回填
  const openTemplateModal = (type: 'create'|'edit', t?: any) => {
    setTemplateModal({ type, data: t || {} });
    if (type === 'edit' && t) {
      form.setFieldsValue({
        name: t.name,
        category: t.category,
        sections: t.sections.map((s: any) => s.title).join(','),
      });
    } else {
      form.setFieldsValue({ name: '', category: 'Dental', sections: '' });
    }
  };

  // 编辑模板：Modal 保存到本地状态
  const handleSaveTemplate = () => {
    const values = form.getFieldsValue();
    if (!values.name?.trim()) { message.warning('请填写模板名称'); return; }
    const sections = String(values.sections || '').split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)
      .map(title => ({ title, required: true }));
    if (templateModal?.type === 'edit' && templateModal.data?.id) {
      setTemplates(prev => prev.map(t =>
        t.id === templateModal.data.id
          ? { ...t, name: values.name.trim(), category: values.category, sections: sections.length > 0 ? sections : t.sections }
          : t
      ));
      message.success('模板已更新');
    } else {
      const newTpl = {
        id: `tpl-${Date.now()}`,
        name: values.name.trim(),
        category: values.category || 'Dental',
        sections: sections.length > 0 ? sections : [{title:'主诉',required:true},{title:'诊断',required:true}],
        usageCount: 0,
      };
      setTemplates(prev => [...prev, newTpl]);
      message.success('模板已保存');
    }
    setTemplateModal(null);
  };

  // 复制模板
  const handleDuplicate = (t: any) => {
    setTemplates(prev => [...prev, { ...t, id: `tpl-${Date.now()}`, name: `${t.name} (副本)`, usageCount: 0 }]);
    message.success(`已复制模板: ${t.name}`);
  };

  // 添加到诊断（本地诊断列表）
  const handleAddDiagnosis = (r: any) => {
    if (diagnoses.some(d => d.code === r.code)) { message.info('该诊断已在列表中'); return; }
    setDiagnoses(prev => [...prev, r]);
    message.success(`已添加到诊断: ${r.code} ${r.name}`);
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <FileText size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>EMR 病历模板 + ICD-11 编码</span>
        <Tag color="cyan">v3.0.6.8-63</Tag>
        <Tag color={dataSource === 'api' ? 'green' : 'orange'}>
          {loading ? '加载中...' : dataSource === 'api' ? '模板: templatesApi 实时' : '模板: 演示数据'}
        </Tag>
        {apiError && <Tag color="red">{apiError}</Tag>}
      </Space>

      <Tabs activeKey={tab} onChange={setTab} type="card"
        items={[
          { key:'templates', label:'病历模板', children:
            <Card size="small" extra={<Button type="primary" icon={<Plus size={12}/>} onClick={()=>openTemplateModal('create')}>新建模板</Button>} title={`病历模板 (${templates.length})`}>
              <List dataSource={templates} renderItem={(t:any) => (
                <List.Item actions={[
                  <Button size="small" icon={<Edit3 size={12}/>} onClick={()=>openTemplateModal('edit', t)}>编辑</Button>,
                  <Button size="small" icon={<Copy size={12}/>} onClick={()=>handleDuplicate(t)}>复制</Button>,
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
              <Space>
                <Input.Search size="small" value={searchCode} onChange={e=>setSearchCode(e.target.value)} placeholder="搜索编码/名称" style={{width:250}} />
                {diagnoses.length > 0 && <Tag color="green">已添加诊断 {diagnoses.length}</Tag>}
                <Tag color="orange">演示数据 (无词典 API)</Tag>
              </Space>
            } title={`ICD-11 ${icdResults.length} 条`}>
              <Table dataSource={icdResults} rowKey="code" pagination={false}
                columns={[
                  {title:'编码',dataIndex:'code',render:(c)=><Tag color="blue">{c}</Tag>},
                  {title:'名称',dataIndex:'name'},
                  {title:'分类',dataIndex:'category',render:(c)=><Tag>{c}</Tag>},
                  {title:'操作',render:(_,r)=><Button size="small" icon={<Plus size={10}/>} onClick={()=>handleAddDiagnosis(r)}>添加到诊断</Button>},
                ]} />
              {diagnoses.length > 0 && (
                <Card size="small" style={{ marginTop: 12 }} title={`已添加的诊断 (${diagnoses.length})`}>
                  <Space wrap>
                    {diagnoses.map(d => (
                      <Tag key={d.code} color="green" closable onClose={()=>setDiagnoses(prev=>prev.filter(x=>x.code!==d.code))}>{d.code} {d.name}</Tag>
                    ))}
                  </Space>
                </Card>
              )}
            </Card>
          },
        ]}
      />
      <Modal title={templateModal?.type === 'create' ? '新建模板' : '编辑模板'} open={!!templateModal} onCancel={()=>setTemplateModal(null)} onOk={handleSaveTemplate} width={500}>
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请填写模板名称' }]}><Input /></Form.Item>
          <Form.Item name="category" label="分类"><Select options={['Dental','General','Surgery','Ortho','Pediatric'].map(c=>({value:c,label:c}))} /></Form.Item>
          <Form.Item name="sections" label="章节 (逗号分隔)"><Input placeholder="主诉,现病史,检查所见,诊断,治疗计划" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default EmrTemplatesPage;
