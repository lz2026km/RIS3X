// [W3-2] 报告模板管理: templatesApi 真实 CRUD (列表/新建/编辑/删除) + 分类筛选 + 使用统计 + 智能片段
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Space, Tag, Table, Button, Row, Col, Statistic, Badge, Typography, Modal, Form, Input, Select, Switch, Popconfirm, message, Alert, Empty, Spin, Segmented, Progress } from 'antd';
import { FileText, Copy, Plus, Edit3, Layout, Layers, RefreshCw, Trash2, BarChart3 } from 'lucide-react';
import { templatesApi } from '@/services/api/templatesApi';

const { TextArea } = Input;

interface Template {
  id: string;
  name: string;
  category: string;
  modality: string;
  bodyPart: string;
  body?: string;
  version: number;
  usage: number;
  status: string;
  shared: boolean;
  createdAt?: string;
}

interface Snippet {
  id: string;
  name: string;
  content: string;
  category: string;
  shortcuts: string;
  usage: number;
}

const CATEGORY_OPTIONS = ['结构化', '自由文本', '分段式'].map(c => ({ value: c, label: c }));
const MODALITY_OPTIONS = ['CT', 'MR', 'OCT', 'CBCT', 'X-ray', 'US'].map(m => ({ value: m, label: m }));

export const ReportTemplateManagerPage: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [snippetLoading, setSnippetLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [snippetModal, setSnippetModal] = useState(false);
  const [form] = Form.useForm();
  const [snippetForm] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await templatesApi.list({ category: category || undefined });
      if (res.success && Array.isArray(res.data)) {
        setTemplates(res.data as unknown as Template[]);
      } else {
        setError(res.error?.message ?? '模板加载失败');
      }
    } catch (e) {
      console.error('[TemplateMgr] load:', e);
      setError('模板加载失败');
    } finally {
      setLoading(false);
    }
  }, [category]);

  const loadSnippets = useCallback(async () => {
    setSnippetLoading(true);
    try {
      const res = await templatesApi.listSnippets();
      if (res.success && Array.isArray(res.data)) setSnippets(res.data as Snippet[]);
    } catch {
      /* snippets 加载失败不阻塞 */
    } finally {
      setSnippetLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadSnippets();
  }, [load, loadSnippets]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setEditModal(true);
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    form.setFieldsValue({
      name: t.name,
      category: t.category,
      modality: t.modality,
      bodyPart: t.bodyPart,
      body: t.body,
      shared: t.shared,
    });
    setEditModal(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editing) {
        const res = await templatesApi.update(editing.id, {
          name: values.name,
          category: values.category,
          modality: values.modality,
          bodyPart: values.bodyPart,
          body: values.body,
          shared: values.shared,
        });
        if (res.success) {
          message.success('模板已更新');
          setEditModal(false);
          void load();
        } else {
          message.error(res.error?.message ?? '更新失败');
        }
      } else {
        const res = await templatesApi.create({
          name: values.name,
          category: values.category,
          modality: values.modality,
          bodyPart: values.bodyPart,
          body: values.body,
          shared: values.shared,
          createdById: 'u-admin',
        });
        if (res.success) {
          message.success('模板已创建');
          setEditModal(false);
          void load();
        } else {
          message.error(res.error?.message ?? '创建失败');
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
      else message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleClone = async (t: Template) => {
    const res = await templatesApi.clone(t.id);
    if (res.success) {
      message.success(`已克隆为 ${(res.data as unknown as Template).name}`);
      void load();
    } else {
      message.error(res.error?.message ?? '克隆失败');
    }
  };

  const handleDelete = async (t: Template) => {
    const res = await templatesApi.delete(t.id);
    if (res.success) {
      message.success('模板已删除');
      void load();
    } else {
      message.error(res.error?.message ?? '删除失败');
    }
  };

  const handleSnippetSave = async () => {
    try {
      const values = await snippetForm.validateFields();
      const res = await templatesApi.createSnippet(values);
      if (res.success) {
        message.success('片段已创建');
        setSnippetModal(false);
        snippetForm.resetFields();
        void loadSnippets();
      } else {
        message.error(res.error?.message ?? '创建失败');
      }
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
      else message.error('创建失败');
    }
  };

  const handleSnippetDelete = async (s: Snippet) => {
    const res = await templatesApi.deleteSnippet(s.id);
    if (res.success) {
      message.success('片段已删除');
      void loadSnippets();
    } else {
      message.error(res.error?.message ?? '删除失败');
    }
  };

  const publishedCount = templates.filter(t => t.status === 'published').length;
  const totalUsage = templates.reduce((a, t) => a + (t.usage ?? 0), 0);
  const maxUsage = Math.max(1, ...templates.map(t => t.usage ?? 0));

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 200, render: (v: string) => <b>{v}</b> },
    { title: '类别', dataIndex: 'category', key: 'category', width: 90, render: (c: string) => <Tag color={c === '结构化' ? 'blue' : 'green'}>{c}</Tag> },
    { title: '设备', dataIndex: 'modality', key: 'modality', width: 70 },
    { title: '检查部位', dataIndex: 'bodyPart', key: 'bodyPart', width: 90 },
    { title: '使用量', dataIndex: 'usage', key: 'usage', width: 160, sorter: (a: Template, b: Template) => (a.usage ?? 0) - (b.usage ?? 0), render: (u: number) => <Progress percent={Math.round(((u ?? 0) / maxUsage) * 100)} size="small" format={() => `${u ?? 0}`} /> },
    { title: '版本', dataIndex: 'version', key: 'version', width: 70, render: (v: number) => <Tag>{'v' + (v ?? 1)}</Tag> },
    { title: '共享', dataIndex: 'shared', key: 'shared', width: 70, render: (s: boolean) => <Badge status={s ? 'success' : 'default'} /> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (s: string) => <Badge status={s === 'published' ? 'success' : 'default'} text={s === 'published' ? '已发布' : '草稿'} /> },
    {
      title: '操作', key: 'actions', width: 200,
      render: (_: unknown, t: Template) => (
        <Space size={4}>
          <Button size="small" icon={<Edit3 size={10} />} onClick={() => openEdit(t)}>编辑</Button>
          <Button size="small" icon={<Copy size={10} />} onClick={() => void handleClone(t)}>克隆</Button>
          <Popconfirm title="删除该模板?" onConfirm={() => void handleDelete(t)}>
            <Button size="small" danger icon={<Trash2 size={10} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Layout size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>报告模板管理</span>
        <Tag color="cyan">v3.0.6.11-75 W3-2</Tag>
        <Tag color="blue">智能片段</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => { void load(); void loadSnippets(); }}>刷新</Button>
      </Space>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void load()}>重试</Button>} />}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="模板" value={templates.length} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="片段" value={snippets.length} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已发布" value={publishedCount} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="总使用量" value={totalUsage} prefix={<BarChart3 size={14} />} /></Card></Col>
      </Row>
      <Card
        size="small"
        extra={
          <Space wrap>
            <Segmented
              size="small"
              value={category}
              onChange={(v) => setCategory(v as string)}
              options={[{ label: '全部', value: '' }, ...CATEGORY_OPTIONS]}
            />
            <Button type="primary" icon={<Plus size={12} />} onClick={openCreate}>新建模板</Button>
          </Space>
        }
        title={<Space><FileText size={14} />报告模板 <Tag>{templates.length}</Tag></Space>}
      >
        <Spin spinning={loading}>
          <Table
            dataSource={templates}
            rowKey="id"
            pagination={{ pageSize: 8, showSizeChanger: false }}
            columns={columns}
            size="small"
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无模板, 点击新建模板创建" /> }}
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>
      <Card size="small" title={<Space><Layers size={14} />智能片段 <Tag>{snippets.length}</Tag></Space>} style={{ marginTop: 16 }} extra={<Button icon={<Plus size={12} />} onClick={() => setSnippetModal(true)}>新建片段</Button>}>
        <Spin spinning={snippetLoading}>
          <Table
            dataSource={snippets}
            rowKey="id"
            pagination={{ pageSize: 5, showSizeChanger: false }}
            size="small"
            columns={[
              { title: '名称', dataIndex: 'name', key: 'name', width: 240, render: (v: string) => <b>{v}</b> },
              { title: '内容', dataIndex: 'content', key: 'content', width: 320, render: (c: string) => <Typography.Paragraph ellipsis={{ rows: 1 }} style={{ margin: 0, fontSize: 12 }}>{c}</Typography.Paragraph> },
              { title: '类别', dataIndex: 'category', key: 'category', width: 80, render: (c: string) => <Tag color={c === '正常' ? 'green' : c === '牙科' ? 'purple' : 'orange'}>{c}</Tag> },
              { title: '快捷键', dataIndex: 'shortcuts', key: 'shortcuts', width: 110, render: (s: string) => <Tag color="geekblue">{s}</Tag> },
              { title: '使用量', dataIndex: 'usage', key: 'usage', width: 80 },
              { title: '操作', key: 'actions', width: 90, render: (_: unknown, s: Snippet) => <Popconfirm title="删除该片段?" onConfirm={() => void handleSnippetDelete(s)}><Button size="small" danger icon={<Trash2 size={10} />} /></Popconfirm> },
            ]}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无智能片段" /> }}
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>

      <Modal
        title={editing ? `编辑模板 - ${editing.name}` : '新建报告模板'}
        open={editModal}
        onCancel={() => setEditModal(false)}
        onOk={() => void handleSave()}
        confirmLoading={saving}
        width={560}
      >
        <Form form={form} layout="vertical" size="small" initialValues={{ category: '结构化', modality: 'CT', shared: true }}>
          <Form.Item label="模板名称" name="name" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="如: CT Chest Routine" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="类别" name="category">
                <Select options={CATEGORY_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="设备" name="modality">
                <Select options={MODALITY_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="检查部位" name="bodyPart">
                <Input placeholder="胸部 / 下颌骨" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="模板内容" name="body" rules={[{ required: true, message: '请输入模板内容' }]}>
            <TextArea rows={5} placeholder="影像所见：...&#10;诊断意见：..." />
          </Form.Item>
          <Form.Item label="全院共享" name="shared" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="新建智能片段" open={snippetModal} onCancel={() => setSnippetModal(false)} onOk={() => void handleSnippetSave()} width={480}>
        <Form form={snippetForm} layout="vertical" size="small" initialValues={{ category: '通用' }}>
          <Form.Item label="片段名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如: 正常所见 - 胸部" />
          </Form.Item>
          <Form.Item label="内容" name="content" rules={[{ required: true, message: '请输入内容' }]}>
            <TextArea rows={3} placeholder="片段文本内容" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="类别" name="category">
                <Select options={['通用', '正常', '牙科', '安全'].map(c => ({ value: c, label: c }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="快捷键" name="shortcuts">
                <Input placeholder="如: nml-chest" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};
export default ReportTemplateManagerPage;
