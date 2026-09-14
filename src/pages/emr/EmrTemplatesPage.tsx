// @deprecated [v3.0.6.11-104 Wave 5C] 已嵌入 TemplateManagementPage (/template-management 模板中心) 作为 Tab; 旧路由 /emr-templates redirect 兼容。文件保留供回滚参考。
// [v3.0.6.8-63] EMR 病历模板管理 + ICD-11 编码
// [W2-A] 模板接入 templatesApi 实时数据; ICD-11 无独立词典端点 → 标注演示数据
// [v3.0.6.11-103 Wave 9] KPI 统计 + 刷新按钮 + i18n
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Space, Tag, Button, Table, Select, Input, message, Tabs, Modal, Form, List } from 'antd';
import { Plus, Edit3, Copy, FileText } from 'lucide-react';
import { templatesApi } from '../../services/api/templatesApi';
import { t } from '../../i18n/appI18n';
import { StatCard, StatCardGrid } from '../../components/common/StatCard';
import { ActionButton } from '../../components/common/ActionButton';

const {  } = Input;

// ICD-11 mock data
const ICD11_DISEASES = [
  { code: '5A10', name: '2 型糖尿病', category: '内分泌' },
  { code: '9B70.0', name: '高血压疾病', category: '心血管' },
  { code: 'BA00', name: '缺血性心脏病', category: '心血管' },
  { code: '8B60', name: '慢性阻塞性肺疾病', category: '呼吸系统' },
  { code: '2F30', name: '支气管或肺恶性肿瘤', category: '肿瘤' },
  { code: '8A02', name: '肺炎', category: '呼吸系统' },
  { code: '7B10', name: '消化性溃疡', category: '消化' },
  { code: 'DA00', name: '牙釉质龋', category: '口腔' },
  { code: 'DA01', name: '牙本质龋', category: '口腔' },
  { code: 'DA02.0', name: '牙髓炎', category: '口腔' },
  { code: 'DA06.0', name: '根尖周脓肿（无窦道）', category: '口腔' },
  { code: 'DA0A', name: '牙周炎', category: '口腔' },
];

const CATEGORY_LABELS: Record<string, string> = {
  Dental: '口腔',
  General: '综合',
  Surgery: '外科',
  Ortho: '骨科',
  Pediatric: '儿科',
};

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
  const openTemplateModal = (type: 'create'|'edit', tpl?: any) => {
    setTemplateModal({ type, data: tpl || {} });
    if (type === 'edit' && tpl) {
      form.setFieldsValue({
        name: tpl.name,
        category: tpl.category,
        sections: tpl.sections.map((s: any) => s.title).join(','),
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
  const handleDuplicate = (tpl: any) => {
    setTemplates(prev => [...prev, { ...tpl, id: `tpl-${Date.now()}`, name: `${tpl.name} (副本)`, usageCount: 0 }]);
    message.success(`已复制模板: ${tpl.name}`);
  };

  // 添加到诊断（本地诊断列表）
  const handleAddDiagnosis = (r: any) => {
    if (diagnoses.some(d => d.code === r.code)) { message.info('该诊断已在列表中'); return; }
    setDiagnoses(prev => [...prev, r]);
    message.success(`已添加到诊断: ${r.code} ${r.name}`);
  };

  const dentalTplCount = templates.filter((tpl: any) => tpl.category === 'Dental').length;

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <FileText size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('w9.emrTpl.title')}</span>
        <Tag color="cyan">v3.0.6.11-103</Tag>
        <Tag color={dataSource === 'api' ? 'green' : 'orange'}>
          {loading ? t('w9.emrTpl.loading') : dataSource === 'api' ? t('w9.emrTpl.apiTag') : t('w9.emrTpl.demoTag')}
        </Tag>
        {apiError && <Tag color="red">{apiError}</Tag>}
        <ActionButton action="refresh" size="compact" loading={loading} onClick={() => void loadTemplates()}>
          {t('w9.common.refresh')}
        </ActionButton>
      </Space>

      <StatCardGrid style={{ marginBottom: 16 }}>
        <StatCard title={t('w9.emrTpl.statsTemplates')} value={templates.length} icon={<FileText size={18} />} color="primary" />
        <StatCard title={t('w9.emrTpl.statsDental')} value={dentalTplCount} icon={<FileText size={18} />} color="warning" />
        <StatCard title={t('w9.emrTpl.statsIcd')} value={icdResults.length} icon={<Plus size={18} />} color="info" />
        <StatCard title={t('w9.emrTpl.statsDiagnoses')} value={diagnoses.length} icon={<Edit3 size={18} />} color="success" />
      </StatCardGrid>

      <Tabs activeKey={tab} onChange={setTab} type="card"
        items={[
          { key:'templates', label:t('w9.emrTpl.tabTemplates'), children:
            <Card size="small" extra={<Button type="primary" icon={<Plus size={12}/>} onClick={()=>openTemplateModal('create')}>{t('w9.emrTpl.create')}</Button>} title={`${t('w9.emrTpl.tabTemplates')} (${templates.length})`}>
              <List dataSource={templates} renderItem={(tpl:any) => (
                <List.Item actions={[
                  <Button size="small" icon={<Edit3 size={12}/>} onClick={()=>openTemplateModal('edit', tpl)}>{t('w9.emrTpl.edit')}</Button>,
                  <Button size="small" icon={<Copy size={12}/>} onClick={()=>handleDuplicate(tpl)}>{t('w9.emrTpl.duplicate')}</Button>,
                ]}>
                  <List.Item.Meta
                    title={<Space><Tag color="blue">{CATEGORY_LABELS[tpl.category] ?? tpl.category}</Tag>{tpl.name}<Tag>{t('w9.emrTpl.usage')} {tpl.usageCount}</Tag></Space>}
                    description={<span style={{fontSize:12,color:'#666'}}>{tpl.sections.map((s:any)=><Tag key={s.title} color={s.required?'red':'default'} style={{margin:2}}>{s.title}</Tag>)}</span>}
                  />
                </List.Item>
              )} />
            </Card>
          },
          { key:'icd11', label:t('w9.emrTpl.tabIcd'), children:
            <Card size="small" extra={
              <Space>
                <Input.Search size="small" value={searchCode} onChange={e=>setSearchCode(e.target.value)} placeholder={t('w9.emrTpl.searchIcd')} style={{width:250}} />
                {diagnoses.length > 0 && <Tag color="green">{t('w9.emrTpl.statsDiagnoses')} {diagnoses.length}</Tag>}
                <Tag color="orange">{t('w9.emrTpl.demoTag')}</Tag>
              </Space>
            } title={`${t('w9.emrTpl.tabIcd')} ${icdResults.length}`}>
              <Table dataSource={icdResults} rowKey="code" pagination={false}
                columns={[
                  {title:'编码',dataIndex:'code',render:(c)=><Tag color="blue">{c}</Tag>},
                  {title:'名称',dataIndex:'name'},
                  {title:t('w9.emrTpl.category'),dataIndex:'category',render:(c)=><Tag>{c}</Tag>},
                  {title:t('w9.common.actions'),render:(_,r)=><Button size="small" icon={<Plus size={10}/>} onClick={()=>handleAddDiagnosis(r)}>{t('w9.emrTpl.addDiagnosis')}</Button>},
                ]} scroll={{ x: 'max-content' }} />
              {diagnoses.length > 0 && (
                <Card size="small" style={{ marginTop: 12 }} title={`${t('w9.emrTpl.statsDiagnoses')} (${diagnoses.length})`}>
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
      <Modal title={templateModal?.type === 'create' ? t('w9.emrTpl.create') : t('w9.emrTpl.edit')} open={!!templateModal} onCancel={()=>setTemplateModal(null)} onOk={handleSaveTemplate} width={500}>
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item name="name" label={t('w9.emrTpl.templateName')} rules={[{ required: true, message: t('w9.emrTpl.templateName') }]}><Input /></Form.Item>
          <Form.Item name="category" label={t('w9.emrTpl.category')}><Select options={['Dental','General','Surgery','Ortho','Pediatric'].map(c=>({value:c,label:CATEGORY_LABELS[c] ?? c}))} /></Form.Item>
          <Form.Item name="sections" label={t('w9.emrTpl.sections')}><Input placeholder="主诉,现病史,检查所见,诊断,治疗计划" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default EmrTemplatesPage;
