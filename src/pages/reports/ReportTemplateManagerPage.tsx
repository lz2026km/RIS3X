// @deprecated [v3.0.6.11-104 Wave 5C] 已嵌入 TemplateManagementPage (/template-management 模板中心) 作为 Tab; 旧路由 /report-templates redirect 兼容。文件保留供回滚参考。
// [W3-2] 报告模板管理: templatesApi 真实 CRUD (列表/新建/编辑/删除) + 分类筛选 + 使用统计 + 智能片段
import { usePagination } from '@/hooks/usePagination';
import { templatesApi } from '@/services/api/templatesApi';
import {
  Card,
  Space,
  Tag,
  Button,
  Row,
  Col,
  Badge,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Popconfirm,
  message,
  Alert,
  Empty,
  Spin,
  Segmented,
  Progress,
} from "antd";
import { FileText, Copy, Plus, Edit3, Layout, Layers, RefreshCw, Trash2, BarChart3 } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";
import { t } from '../../i18n/appI18n';

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
  const { pageData: templatePageData, pagination: templatePagination } = usePagination(templates, 8);
  const { pageData: snippetPageData, pagination: snippetPagination } = usePagination(snippets, 5);
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
        setError(res.error?.message ?? t('reportTpl.loadFailed'));
      }
    } catch (e) {
      console.error('[TemplateMgr] load:', e);
      setError(t('reportTpl.loadFailed'));
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

  const openEdit = (tpl: Template) => {
    setEditing(tpl);
    form.setFieldsValue({
      name: tpl.name,
      category: tpl.category,
      modality: tpl.modality,
      bodyPart: tpl.bodyPart,
      body: tpl.body,
      shared: tpl.shared,
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
          message.success(t('reportTpl.updated'));
          setEditModal(false);
          void load();
        } else {
          message.error(res.error?.message ?? t('reportTpl.updateFailed'));
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
          message.success(t('reportTpl.created'));
          setEditModal(false);
          void load();
        } else {
          message.error(res.error?.message ?? t('reportTpl.createFailed'));
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
      else message.error(t('reportTpl.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleClone = async (tpl: Template) => {
    const res = await templatesApi.clone(tpl.id);
    if (res.success) {
      message.success(`已克隆为 ${(res.data as unknown as Template).name}`);
      void load();
    } else {
      message.error(res.error?.message ?? t('reportTpl.cloneFailed'));
    }
  };

  const handleDelete = async (tpl: Template) => {
    const res = await templatesApi.delete(tpl.id);
    if (res.success) {
      message.success(t('reportTpl.deleted'));
      void load();
    } else {
      message.error(res.error?.message ?? t('reportTpl.deleteFailed'));
    }
  };

  const handleSnippetSave = async () => {
    try {
      const values = await snippetForm.validateFields();
      const res = await templatesApi.createSnippet(values);
      if (res.success) {
        message.success(t('reportTpl.snippetCreated'));
        setSnippetModal(false);
        snippetForm.resetFields();
        void loadSnippets();
      } else {
        message.error(res.error?.message ?? t('reportTpl.createFailed'));
      }
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
      else message.error(t('reportTpl.createFailed'));
    }
  };

  const handleSnippetDelete = async (s: Snippet) => {
    const res = await templatesApi.deleteSnippet(s.id);
    if (res.success) {
      message.success(t('reportTpl.snippetDeleted'));
      void loadSnippets();
    } else {
      message.error(res.error?.message ?? t('reportTpl.deleteFailed'));
    }
  };

  const publishedCount = templates.filter(t => t.status === 'published').length;
  const totalUsage = templates.reduce((a, t) => a + (t.usage ?? 0), 0);
  const maxUsage = Math.max(1, ...templates.map(t => t.usage ?? 0));

  const columns = [
    { title: t('reportTpl.colName'), dataIndex: 'name', key: 'name', width: 200, render: (v: string) => <b>{v}</b> },
    { title: t('reportTpl.colCategory'), dataIndex: 'category', key: 'category', width: 90, render: (c: string) => <Tag color={c === '结构化' ? 'blue' : 'green'}>{c}</Tag> },
    { title: t('reportTpl.colModality'), dataIndex: 'modality', key: 'modality', width: 70 },
    { title: t('reportTpl.colBodyPart'), dataIndex: 'bodyPart', key: 'bodyPart', width: 90 },
    { title: t('reportTpl.colUsage'), dataIndex: 'usage', key: 'usage', width: 160, sorter: (a: Template, b: Template) => (a.usage ?? 0) - (b.usage ?? 0), render: (u: number) => <Progress percent={Math.round(((u ?? 0) / maxUsage) * 100)} size="small" format={() => `${u ?? 0}`} /> },
    { title: t('reportTpl.colVersion'), dataIndex: 'version', key: 'version', width: 70, render: (v: number) => <Tag>{'v' + (v ?? 1)}</Tag> },
    { title: t('reportTpl.colShared'), dataIndex: 'shared', key: 'shared', width: 70, render: (s: boolean) => <Badge status={s ? 'success' : 'default'} /> },
    { title: t('reportTpl.colStatus'), dataIndex: 'status', key: 'status', width: 90, render: (s: string) => <Badge status={s === 'published' ? 'success' : 'default'} text={s === 'published' ? t('reportTpl.statusPublished') : t('reportTpl.statusDraft')} /> },
    {
      title: t('reportTpl.colActions'), key: 'actions', width: 200,
      render: (_: unknown, tpl: Template) => (
        <Space size={4}>
          <Button size="small" icon={<Edit3 size={10} />} onClick={() => openEdit(tpl)}>{t('reportTpl.edit')}</Button>
          <Button size="small" icon={<Copy size={10} />} onClick={() => void handleClone(tpl)}>{t('reportTpl.clone')}</Button>
          <Popconfirm title={t('reportTpl.confirmDelete')} onConfirm={() => void handleDelete(tpl)}>
            <Button size="small" danger icon={<Trash2 size={10} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }} wrap>
        <Layout size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('reportTpl.title')}</span>
        <Tag color="cyan">v3.0.6.11-75 W3-2</Tag>
        <Tag color="blue">{t('reportTpl.snippets')}</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => { void load(); void loadSnippets(); }}>{t('reportTpl.refresh')}</Button>
      </Space>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 'var(--space-4, 16px)' }} action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('reportTpl.retry')}</Button>} />}
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('reportTpl.statTemplates')} value={templates.length} icon={<FileText size={18} />} />
        <StatCard title={t('reportTpl.statSnippets')} value={snippets.length} icon={<Layers size={18} />} />
        <StatCard title={t('reportTpl.statPublished')} value={publishedCount} color="success" />
        <StatCard title={t('reportTpl.statTotalUsage')} value={totalUsage} icon={<BarChart3 size={18} />} />
      </StatCardGrid>
      <Card
        size="small"
        extra={
          <Space wrap>
            <Segmented
              size="small"
              value={category}
              onChange={(v) => setCategory(v as string)}
              options={[{ label: t('reportTpl.all'), value: '' }, ...CATEGORY_OPTIONS]}
            />
            <Button type="primary" icon={<Plus size={12} />} onClick={openCreate}>{t('reportTpl.createTemplate')}</Button>
          </Space>
        }
        title={<Space><FileText size={14} />{t('reportTpl.cardTitle')} <Tag>{templates.length}</Tag></Space>}
      >
        <Spin spinning={loading}>
          <DataTable scroll={{ x: 'max-content' }}
            dataSource={templatePageData}
            rowKey="id"
            pagination={templatePagination}
            columns={columns}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('reportTpl.noTemplates')} /> }}
         
          />
        </Spin>
      </Card>
      <Card size="small" title={<Space><Layers size={14} />{t('reportTpl.snippets')} <Tag>{snippets.length}</Tag></Space>} style={{ marginTop: 'var(--space-4, 16px)' }} extra={<Button icon={<Plus size={12} />} onClick={() => setSnippetModal(true)}>{t('reportTpl.createSnippet')}</Button>}>
        <Spin spinning={snippetLoading}>
          <DataTable scroll={{ x: 'max-content' }}
            dataSource={snippetPageData}
            rowKey="id"
            pagination={snippetPagination}
            columns={[
              { title: t('reportTpl.colName'), dataIndex: 'name', key: 'name', width: 240, render: (v: string) => <b>{v}</b> },
              { title: t('reportTpl.colContent'), dataIndex: 'content', key: 'content', width: 320, render: (c: string) => <Typography.Paragraph ellipsis={{ rows: 1 }} style={{ margin: 0, fontSize: 12 }}>{c}</Typography.Paragraph> },
              { title: t('reportTpl.colCategory'), dataIndex: 'category', key: 'category', width: 80, render: (c: string) => <Tag color={c === '正常' ? 'green' : c === '牙科' ? 'purple' : 'orange'}>{c}</Tag> },
              { title: t('reportTpl.colShortcuts'), dataIndex: 'shortcuts', key: 'shortcuts', width: 110, render: (s: string) => <Tag color="geekblue">{s}</Tag> },
              { title: t('reportTpl.colUsage'), dataIndex: 'usage', key: 'usage', width: 80 },
              { title: t('reportTpl.colActions'), key: 'actions', width: 90, render: (_: unknown, s: Snippet) => <Popconfirm title={t('reportTpl.confirmDeleteSnippet')} onConfirm={() => void handleSnippetDelete(s)}><Button size="small" danger icon={<Trash2 size={10} />} /></Popconfirm> },
            ]}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('reportTpl.noSnippets')} /> }}
         
          />
        </Spin>
      </Card>

      <Modal
        title={editing ? `${t('reportTpl.editTitle')} - ${editing.name}` : t('reportTpl.createTitle')}
        open={editModal}
        onCancel={() => setEditModal(false)}
        onOk={() => void handleSave()}
        confirmLoading={saving}
        width={560}
      >
        <Form form={form} layout="vertical" size="small" initialValues={{ category: '结构化', modality: 'CT', shared: true }}>
          <Form.Item label={t('reportTpl.formName')} name="name" rules={[{ required: true, message: t('reportTpl.formNameRequired') }]}>
            <Input placeholder="如: CT Chest Routine" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label={t('reportTpl.colCategory')} name="category">
                <Select options={CATEGORY_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={t('reportTpl.colModality')} name="modality">
                <Select options={MODALITY_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={t('reportTpl.colBodyPart')} name="bodyPart">
                <Input placeholder="胸部 / 下颌骨" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label={t('reportTpl.formBody')} name="body" rules={[{ required: true, message: t('reportTpl.formBodyRequired') }]}>
            <TextArea rows={5} placeholder={t('reportTpl.formBodyPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('reportTpl.formShared')} name="shared" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('reportTpl.snippetModalTitle')} open={snippetModal} onCancel={() => setSnippetModal(false)} onOk={() => void handleSnippetSave()} width={480}>
        <Form form={snippetForm} layout="vertical" size="small" initialValues={{ category: '通用' }}>
          <Form.Item label={t('reportTpl.snippetName')} name="name" rules={[{ required: true, message: t('reportTpl.snippetNameRequired') }]}>
            <Input placeholder="如: 正常所见 - 胸部" />
          </Form.Item>
          <Form.Item label={t('reportTpl.colContent')} name="content" rules={[{ required: true, message: t('reportTpl.snippetContentRequired') }]}>
            <TextArea rows={3} placeholder={t('reportTpl.snippetContentPlaceholder')} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label={t('reportTpl.colCategory')} name="category">
                <Select options={['通用', '正常', '牙科', '安全'].map(c => ({ value: c, label: c }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('reportTpl.colShortcuts')} name="shortcuts">
                <Input placeholder="如: nml-chest" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </PageContainer>
  );
};
export default ReportTemplateManagerPage;
