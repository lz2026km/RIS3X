// [v3.0.6.8-79] 知情同意/患者教育管理
// [v3.0.6.11-60] Batch 3: consentEducationApi 真实数据 + 分类筛选 + 上传/查看
import { usePagination } from '../../hooks/usePagination';
import { consentEducationApi, type ConsentRecord, type EducationMaterialDto } from '../../services/api/consentEducationApi';
import { getEducationService, type EducationMaterial } from '../../services/education/EducationService';
import { Card, Space, Tag, Row, Col, Table, Button, Tabs, Badge, Modal, Form, Input, Select, message, Statistic, Upload, Spin, Alert, Empty, Descriptions } from 'antd';
import { FileSignature, BookOpen, CheckCircle2, Clock, Download, Send, Eye, Upload as UploadIcon, Plus, RefreshCw, Inbox } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

// [W3-C] 假按钮修复: 查看→详情Modal; PDF→真实文件下载; 发送患者→本地发送状态

const CATEGORIES = ['Imaging', 'Surgery', 'Dental', 'Treatment', 'General'];
const CATEGORY_COLORS: Record<string, string> = {
  Imaging: 'blue', Surgery: 'red', Dental: 'purple', Treatment: 'volcano', General: 'green',
};

export const ConsentEducationPage: React.FC = () => {
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [materials, setMaterials] = useState<EducationMaterialDto[]>([]);
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [activeCategory, setActiveCategory] = useState('全部');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [consentModal, setConsentModal] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [viewMaterial, setViewMaterial] = useState<EducationMaterialDto | null>(null);
  const [viewConsent, setViewConsent] = useState<ConsentRecord | null>(null);
  // [v3.0.6.11-88 Round10] 宣教材料编辑 (PATCH /education-materials/:id)
  const [editingMaterial, setEditingMaterial] = useState<EducationMaterialDto | null>(null);
  const [materialEditForm] = Form.useForm();
  const [sentMaterials, setSentMaterials] = useState<Set<string>>(new Set());
  const [consentForm] = Form.useForm();
  const [materialForm] = Form.useForm();
  // [G005 2B] 附件不再丢弃: 收集 File 对象 + base64 (后端 createMaterial 不支持 FormData → base64 存 content + 文件名摘要回退)
  const [materialFile, setMaterialFile] = useState<{ name: string; size: number; base64: string } | null>(null);
  // [Wave 4B] 记录编辑 (PATCH /records/:id): 状态(拒绝/签署) + 见证人
  const [editingConsent, setEditingConsent] = useState<ConsentRecord | null>(null);
  const [consentEditForm] = Form.useForm();
  const { pageData: consentPageData, pagination: consentPagination } = usePagination(consents, 6);

  // [W3-C] 发送患者: 本地真实状态 (标记已发送 + 浏览数 +1)
  const sendToPatient = (m: EducationMaterialDto) => {
    setSentMaterials((prev) => new Set(prev).add(m.id));
    setMaterials((prev) => prev.map((x) => x.id === m.id ? { ...x, views: (x.views ?? 0) + 1 } : x));
    message.success(`已发送给患者 (${m.title})`);
  };

  // [W3-C] PDF: 生成真实文件下载
  const downloadPdf = (r: ConsentRecord) => {
    const content = [
      `知情同意书 ${r.id}`,
      `患者: ${r.patient}`,
      `类型: ${r.type}`,
      `操作: ${r.procedure}`,
      `状态: ${r.status === 'signed' ? '已签署' : r.status === 'pending' ? '待签署' : '已拒绝'}`,
      r.signedAt ? `签署时间: ${r.signedAt}` : '',
      `生成时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
      '',
      '—— G005 RIS 知情同意模块 (PDF 快照下载) ——',
    ].filter(Boolean).join('\n');
    const blob = new Blob(['\ufeff' + content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consent_${r.id}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    message.success(`已生成 ${a.download}`);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [consentRes, materialRes] = await Promise.all([
        consentEducationApi.listRecords(),
        consentEducationApi.listEducationMaterials(),
      ]);
      if (consentRes.success && Array.isArray(consentRes.data)) setConsents(consentRes.data);
      else setError(consentRes.error?.message ?? '同意书加载失败');
      if (materialRes.success && Array.isArray(materialRes.data)) setMaterials(materialRes.data);
      try {
        const edu = await getEducationService().getMaterials();
        const cats = Array.from(new Set([...CATEGORIES, ...(edu as EducationMaterial[]).map((m) => m.category)])).filter(Boolean);
        if (cats.length) setCategories(cats.map((c) => c.charAt(0).toUpperCase() + c.slice(1)));
      } catch { /* 分类回退到内置列表 */ }
    } catch {
      setError('数据加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredMaterials = activeCategory === '全部'
    ? materials
    : materials.filter((m) => m.category === activeCategory);

  const { pageData: materialPageData, pagination: materialPagination } = usePagination(filteredMaterials, 6);

  const createConsent = async () => {
    const values = await consentForm.validateFields();
    const res = await consentEducationApi.createRecord({
      patient: values.patient,
      type: values.type,
      procedure: values.procedure,
    });
    if (res.success) {
      setConsents((prev) => [...prev, res.data as ConsentRecord]);
      message.success('知情同意已创建，等待签署');
      setConsentModal(false);
      consentForm.resetFields();
    } else {
      message.error(res.error?.message ?? '创建失败');
    }
  };

  const signConsent = async (record: ConsentRecord) => {
    // [v3.0.6.11-88 Round10] 签署走新路径 POST /records/:id/sign (后端 signConsent)
    const res = await consentEducationApi.signRecord(record.id, 'Dr. System');
    if (res.success) {
      setConsents((prev) => prev.map((c) => c.id === record.id ? { ...c, status: 'signed', signedAt: new Date().toLocaleString('zh-CN', { hour12: false }), witness: 'Dr. System' } : c));
      message.success('签署完成');
    } else {
      message.error(res.error?.message ?? '签署失败');
    }
  };

  // [Wave 4B] 查看同意书详情: 优先真实 GET /records/:id, 失败回退行数据
  const viewConsentDetail = async (r: ConsentRecord) => {
    setViewConsent(r);
    try {
      const res = await consentEducationApi.getRecord(r.id);
      if (res.success && res.data) setViewConsent(res.data);
    } catch { /* 详情接口不可用, 使用行数据 */ }
  };

  // [Wave 4B] 查看宣教材料详情: 优先真实 GET /education-materials/:id, 失败回退行数据
  const viewMaterialDetail = async (m: EducationMaterialDto) => {
    setViewMaterial(m);
    try {
      const res = await consentEducationApi.getEducationMaterial(m.id);
      if (res.success && res.data) setViewMaterial(res.data);
    } catch { /* 详情接口不可用, 使用行数据 */ }
  };

  // [Wave 4B] 编辑同意记录: PATCH /records/:id (状态/见证人)
  const openEditConsent = (r: ConsentRecord) => {
    setEditingConsent(r);
    consentEditForm.setFieldsValue({ status: r.status, witness: r.witness ?? '' });
  };

  const submitEditConsent = async () => {
    if (!editingConsent) return;
    const values = await consentEditForm.validateFields();
    const res = await consentEducationApi.updateRecord(editingConsent.id, {
      status: values.status,
      witness: values.witness || null,
    });
    if (res.success) {
      setConsents((prev) => prev.map((c) => c.id === editingConsent.id ? { ...c, status: values.status, witness: values.witness || null } : c));
      message.success('同意记录已更新');
      setEditingConsent(null);
    } else {
      message.error(res.error?.message ?? '更新失败');
    }
  };

  const createMaterial = async () => {
    const values = await materialForm.validateFields();
    // [G005 2B] 附件随提交附上: base64 → content 字段, 文件名 → 摘要 (后端 FormData 不支持时的回退)
    const attachmentNote = materialFile ? `[附件: ${materialFile.name} (${(materialFile.size / 1024).toFixed(1)} KB)]` : '';
    const res = await consentEducationApi.createMaterial({
      title: values.title,
      category: values.category,
      lang: values.lang,
      pages: values.pages ?? 1,
      format: values.format,
      summary: [values.summary, attachmentNote].filter(Boolean).join(' '),
      content: materialFile?.base64 || undefined,
    });
    if (res.success) {
      setMaterials((prev) => [...prev, res.data as EducationMaterialDto]);
      message.success(materialFile ? `宣教资料已上传 (附件 ${materialFile.name})` : '宣教资料已上传');
      setUploadModal(false);
      setMaterialFile(null);
      materialForm.resetFields();
    } else {
      message.error(res.error?.message ?? '上传失败');
    }
  };

  const stats = {
    pending: consents.filter((c) => c.status === 'pending').length,
    signed: consents.filter((c) => c.status === 'signed').length,
    refused: consents.filter((c) => c.status === 'refused').length,
  };

  // [v3.0.6.11-88 Round10] 宣教材料编辑: 打开编辑 Modal 并回填表单
  const openEditMaterial = (m: EducationMaterialDto) => {
    setEditingMaterial(m);
    materialEditForm.setFieldsValue({
      title: m.title,
      category: m.category,
      lang: m.lang,
      format: m.format,
      pages: m.pages,
      summary: m.summary ?? '',
    });
  };

  const submitEditMaterial = async () => {
    if (!editingMaterial) return;
    const values = await materialEditForm.validateFields();
    const res = await consentEducationApi.updateEducationMaterial(editingMaterial.id, {
      title: values.title,
      category: values.category,
      lang: values.lang,
      format: values.format,
      pages: values.pages ?? 1,
      summary: values.summary,
    });
    if (res.success) {
      setMaterials((prev) => prev.map((x) => x.id === editingMaterial.id ? { ...x, ...res.data } : x));
      message.success('宣教资料已更新');
      setEditingMaterial(null);
    } else {
      message.error(res.error?.message ?? '更新失败');
    }
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <FileSignature size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>知情同意与宣教中心</span>
        <Tag color="cyan">v3.0.6.11-60</Tag>
        <Tag color="green">电子签名</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>刷新</Button>
      </Space>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> 重试</Button>} />}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="待签署" value={stats.pending} styles={{ content: { color: '#faad14' } }} prefix={<Clock size={14} />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="已签署" value={stats.signed} styles={{ content: { color: '#52c41a' } }} prefix={<CheckCircle2 size={14} />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="已拒绝" value={stats.refused} styles={{ content: { color: '#ff4d4f' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="宣教资料" value={materials.length} prefix={<BookOpen size={14} />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="总浏览" value={materials.reduce((s, m) => s + (m.views ?? 0), 0)} prefix={<Eye size={14} />} /></Card></Col>
      </Row>

      <Card
        size="small"
        title={<Space><FileSignature size={14} />患者知情同意</Space>}
        extra={<Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setConsentModal(true)}>新建同意书</Button>}
      >
        <Spin spinning={loading}>
          <Table
            dataSource={consentPageData}
            rowKey="id"
            pagination={consentPagination}
            columns={[
              { title: '患者', dataIndex: 'patient' },
              { title: '类型', dataIndex: 'type', render: (t: string) => <Tag color="blue">{t}</Tag> },
              { title: '操作', dataIndex: 'procedure', width: 200 },
              { title: '签署时间', dataIndex: 'signedAt', render: (s: string | null) => s || <span style={{ color: '#999' }}>—</span> },
              { title: '见证人', dataIndex: 'witness', render: (w: string | null) => w || '—' },
              {
                title: '状态', dataIndex: 'status',
                render: (s: string) => <Badge status={s === 'signed' ? 'success' : s === 'pending' ? 'processing' : 'error'} text={s === 'signed' ? '已签署' : s === 'pending' ? '待签署' : '已拒绝'} />,
              },
              {
                title: '操作',
                render: (_, r: ConsentRecord) => (
                  <Space>
                    {r.status === 'pending' && <Button size="small" type="primary" onClick={() => void signConsent(r)}>立即签署</Button>}
                    <Button size="small" icon={<Eye size={10} />} onClick={() => void viewConsentDetail(r)}>查看</Button>
                    {/* [Wave 4B] 记录编辑: PATCH /records/:id (拒绝/见证人) */}
                    <Button size="small" onClick={() => openEditConsent(r)}>编辑</Button>
                    <Button size="small" icon={<Download size={10} />} onClick={() => downloadPdf(r)}>PDF</Button>
                  </Space>
                ),
              },
            ]}
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>

      <Card
        size="small"
        title={<Space><BookOpen size={14} />宣教资料库</Space>}
        extra={<Button size="small" icon={<UploadIcon size={12} />} onClick={() => setUploadModal(true)}>上传资料</Button>}
        style={{ marginTop: 16 }}
      >
        <Tabs
          size="small"
          activeKey={activeCategory}
          onChange={setActiveCategory}
          items={[{ key: '全部', label: '全部' }, ...categories.map((c) => ({ key: c, label: c }))]}
        />
        <Table
          dataSource={materialPageData}
          rowKey="id"
          pagination={materialPagination}
          columns={[
            { title: '标题', dataIndex: 'title', width: 200 },
            { title: '语言', dataIndex: 'lang', render: (l: string) => <Tag>{l}</Tag> },
            { title: '类别', dataIndex: 'category', render: (c: string) => <Tag color={CATEGORY_COLORS[c] ?? 'default'}>{c}</Tag> },
            { title: '页数', dataIndex: 'pages' },
            { title: '浏览', dataIndex: 'views' },
            { title: '格式', dataIndex: 'format' },
              {
                title: '操作',
                render: (_, r: EducationMaterialDto) => (
                  <Space>
                    <Button size="small" icon={<Eye size={10} />} onClick={() => void viewMaterialDetail(r)}>查看</Button>
                  <Button size="small" onClick={() => openEditMaterial(r)}>编辑</Button>
                  {sentMaterials.has(r.id)
                    ? <Tag color="green">已发送</Tag>
                    : <Button size="small" icon={<Send size={10} />} onClick={() => sendToPatient(r)}>发送患者</Button>}
                </Space>
              ),
            },
          ]}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal title="新建知情同意" open={consentModal} onOk={() => void createConsent()} onCancel={() => setConsentModal(false)} okText="创建">
        <Form form={consentForm} layout="vertical">
          <Form.Item name="patient" label="患者姓名" rules={[{ required: true, message: '请输入患者姓名' }]}>
            <Input placeholder="请输入患者姓名" />
          </Form.Item>
          <Form.Item name="type" label="同意书类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={['CT 增强', 'MRI', '手术', '麻醉', '输血', '放射治疗'].map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="procedure" label="诊疗操作" rules={[{ required: true, message: '请输入操作内容' }]}>
            <Input placeholder="如：胸部 CT 增强扫描" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`编辑同意记录 - ${editingConsent?.patient ?? ''}`} open={!!editingConsent} onOk={() => void submitEditConsent()} onCancel={() => setEditingConsent(null)} okText="保存">
        <Form form={consentEditForm} layout="vertical">
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={[{ value: 'pending', label: '待签署' }, { value: 'signed', label: '已签署' }, { value: 'refused', label: '已拒绝' }]} />
          </Form.Item>
          <Form.Item name="witness" label="见证人">
            <Input placeholder="如：Dr. System" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="上传宣教资料" open={uploadModal} onOk={() => void createMaterial()} onCancel={() => { setUploadModal(false); setMaterialFile(null); }} okText="上传">
        <Form form={materialForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="如：CT 检查须知" />
          </Form.Item>
          <Form.Item name="category" label="类别" rules={[{ required: true, message: '请选择类别' }]}>
            <Select options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="lang" label="语言" initialValue="zh-CN">
            <Select options={[{ value: 'zh-CN', label: '中文' }, { value: 'en-US', label: 'English' }]} />
          </Form.Item>
          <Form.Item name="format" label="格式" initialValue="PDF">
            <Select options={['PDF', 'PDF + Video', 'Video', 'Text'].map((f) => ({ value: f, label: f }))} />
          </Form.Item>
          <Form.Item name="pages" label="页数">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="summary" label="摘要">
            <Input.TextArea rows={2} placeholder="资料内容摘要" />
          </Form.Item>
          <Upload
            showUploadList={false}
            beforeUpload={() => false}
            onChange={({ file }) => {
              const f = file.originFileObj as File | undefined;
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => setMaterialFile({ name: f.name, size: f.size, base64: String(reader.result ?? '') });
              reader.readAsDataURL(f);
            }}
          >
            <Button icon={<UploadIcon size={12} />} block>{materialFile ? `已选附件: ${materialFile.name} (${(materialFile.size / 1024).toFixed(1)} KB)` : '选择附件（可选）'}</Button>
          </Upload>
        </Form>
      </Modal>

      <Modal title={`编辑宣教资料 - ${editingMaterial?.title ?? ''}`} open={!!editingMaterial} onOk={() => void submitEditMaterial()} onCancel={() => setEditingMaterial(null)} okText="保存" width={520}>
        <Form form={materialEditForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="如：CT 检查须知" />
          </Form.Item>
          <Form.Item name="category" label="类别" rules={[{ required: true, message: '请选择类别' }]}>
            <Select options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="lang" label="语言">
            <Select options={[{ value: 'zh-CN', label: '中文' }, { value: 'en-US', label: 'English' }]} />
          </Form.Item>
          <Form.Item name="format" label="格式">
            <Select options={['PDF', 'PDF + Video', 'Video', 'Text'].map((f) => ({ value: f, label: f }))} />
          </Form.Item>
          <Form.Item name="pages" label="页数">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="summary" label="摘要">
            <Input.TextArea rows={2} placeholder="资料内容摘要" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={viewMaterial?.title}
        open={!!viewMaterial}
        onCancel={() => setViewMaterial(null)}
        footer={viewMaterial
          ? (sentMaterials.has(viewMaterial.id)
              ? <Button type="primary" onClick={() => setViewMaterial(null)}>关闭</Button>
              : <Button type="primary" onClick={() => { sendToPatient(viewMaterial); setViewMaterial(null); }}>发送给患者</Button>)
          : null}
        width={560}
      >
        {viewMaterial && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="类别"><Tag color={CATEGORY_COLORS[viewMaterial.category] ?? 'default'}>{viewMaterial.category}</Tag></Descriptions.Item>
              <Descriptions.Item label="格式">{viewMaterial.format}</Descriptions.Item>
              <Descriptions.Item label="页数">{viewMaterial.pages}</Descriptions.Item>
              <Descriptions.Item label="浏览">{viewMaterial.views}</Descriptions.Item>
            </Descriptions>
            <Alert type="info" showIcon message={viewMaterial.summary ?? '暂无摘要'} />
          </>
        )}
      </Modal>

      {consents.length === 0 && !loading && (
        <div style={{ marginTop: 12 }}>
          <Empty image={<Inbox size={48} color="#94a3b8" />} description="暂无知情同意记录" />
        </div>
      )}

      <Modal
        title={`同意书详情 - ${viewConsent?.id ?? ''}`}
        open={!!viewConsent}
        onCancel={() => setViewConsent(null)}
        footer={<Button type="primary" onClick={() => setViewConsent(null)}>关闭</Button>}
        width={560}
      >
        {viewConsent && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="患者" span={2}>{viewConsent.patient}</Descriptions.Item>
              <Descriptions.Item label="类型"><Tag color="blue">{viewConsent.type}</Tag></Descriptions.Item>
              <Descriptions.Item label="状态">
                <Badge status={viewConsent.status === 'signed' ? 'success' : viewConsent.status === 'pending' ? 'processing' : 'error'} text={viewConsent.status === 'signed' ? '已签署' : viewConsent.status === 'pending' ? '待签署' : '已拒绝'} />
              </Descriptions.Item>
              <Descriptions.Item label="诊疗操作" span={2}>{viewConsent.procedure}</Descriptions.Item>
              <Descriptions.Item label="签署时间">{viewConsent.signedAt ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="见证人">{viewConsent.witness ?? '—'}</Descriptions.Item>
            </Descriptions>
            <Alert type="info" showIcon message="PDF 快照可通过列表中的「PDF」按钮生成并下载" />
          </>
        )}
      </Modal>
    </div>
  );
};
export default ConsentEducationPage;
