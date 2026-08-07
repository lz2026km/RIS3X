// [v3.0.6.11-79 W1-C] 合规文档库: 列表/筛选/搜索 + 新建/编辑/发布/归档/删除 + 详情
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Drawer, Form, Input, Modal,
  Popconfirm, Row, Select, Space, Spin, Statistic, Table, Tag, Typography, message,
} from 'antd';
import { Search, FilePlus2, RefreshCw, FileText, ScrollText, Send, Archive, Eye, Pencil, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import {
  complianceDocsApi,
  type ComplianceDocDto,
  type CreateComplianceDocInput,
} from '../../services/api/complianceDocsApi';
import { invalidateApiCacheByPrefix } from '../../services/api/client';

const { TextArea } = Input;

const STATUS_META: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'orange', label: '草稿' },
  CURRENT: { color: 'green', label: '现行' },
  ARCHIVED: { color: 'default', label: '已归档' },
};

const TYPE_OPTIONS = ['SOP', 'POLICY', 'REPORT', 'GUIDELINE', 'OTHER'].map((v) => ({ value: v, label: v }));

const DEFAULT_CATEGORIES = ['法规文档', '管理制度', '测评报告', '应急预案', '操作规范', '其他'];

const fmt = (v?: string | null) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-');

export const ComplianceDocsPage: React.FC = () => {
  const [docs, setDocs] = useState<ComplianceDocDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ComplianceDocDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const [detail, setDetail] = useState<ComplianceDocDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await complianceDocsApi.list({ category, status, search: search || undefined });
      if (res.success && Array.isArray(res.data)) {
        setDocs(res.data);
      } else {
        setDocs([]);
        setError(res.error?.message ?? '加载失败');
      }
    } catch (e) {
      setError((e as Error)?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, [category, status, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const fromDocs = Array.from(new Set(docs.map((d) => d.category).filter(Boolean)));
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromDocs]));
  }, [docs]);

  const counts = useMemo(() => ({
    total: docs.length,
    current: docs.filter((d) => d.status === 'CURRENT').length,
    draft: docs.filter((d) => d.status === 'DRAFT').length,
    archived: docs.filter((d) => d.status === 'ARCHIVED').length,
  }), [docs]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ type: 'SOP', version: '1.0', status: 'DRAFT' });
    setModalOpen(true);
  };

  const openEdit = (doc: ComplianceDocDto) => {
    setEditing(doc);
    form.setFieldsValue({
      title: doc.title,
      category: doc.category,
      type: doc.type,
      version: doc.version,
      content: doc.content ?? '',
      status: doc.status,
      author: doc.author ?? undefined,
      approvedBy: doc.approvedBy ?? undefined,
      effectiveDate: doc.effectiveDate ? dayjs(doc.effectiveDate) : undefined,
    });
    setModalOpen(true);
  };

  const reloadAfterMutation = async () => {
    await invalidateApiCacheByPrefix('/compliance-docs');
    void load();
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    const payload: CreateComplianceDocInput = {
      title: values.title,
      category: values.category,
      type: values.type ?? 'SOP',
      version: values.version ?? '1.0',
      content: values.content ?? '',
      status: values.status ?? 'DRAFT',
      author: values.author,
      approvedBy: values.approvedBy,
      effectiveDate: values.effectiveDate ? values.effectiveDate.toISOString() : undefined,
    };
    setSaving(true);
    try {
      const res = editing
        ? await complianceDocsApi.update(editing.id, payload)
        : await complianceDocsApi.create(payload);
      if (!res.success) {
        message.error(res.error?.message ?? '保存失败');
        return;
      }
      message.success(editing ? '文档已更新' : '文档已创建');
      setModalOpen(false);
      await reloadAfterMutation();
    } catch (e) {
      message.error((e as Error)?.message ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (doc: ComplianceDocDto) => {
    const res = await complianceDocsApi.publish(doc.id);
    if (!res.success) { message.error(res.error?.message ?? '发布失败'); return; }
    message.success(`《${doc.title}》已发布`);
    await reloadAfterMutation();
  };

  const handleArchive = async (doc: ComplianceDocDto) => {
    const res = await complianceDocsApi.archive(doc.id);
    if (!res.success) { message.error(res.error?.message ?? '归档失败'); return; }
    message.success(`《${doc.title}》已归档`);
    await reloadAfterMutation();
  };

  const handleDelete = async (doc: ComplianceDocDto) => {
    const res = await complianceDocsApi.delete(doc.id);
    if (!res.success) { message.error(res.error?.message ?? '删除失败'); return; }
    message.success(`《${doc.title}》已删除`);
    await reloadAfterMutation();
  };

  const handleView = async (doc: ComplianceDocDto) => {
    const res = await complianceDocsApi.getById(doc.id);
    setDetail(res.success && res.data ? res.data : doc);
  };

  const columns = [
    {
      title: '标题', dataIndex: 'title', key: 'title', ellipsis: true,
      render: (v: string, r: ComplianceDocDto) => (
        <Space size={6}>
          <FileText size={14} color="#1677ff" />
          <a onClick={() => void handleView(r)}>{v}</a>
          <Tag color="blue" style={{ fontSize: 11 }}>{r.type}</Tag>
        </Space>
      ),
    },
    { title: '分类', dataIndex: 'category', key: 'category', width: 130 },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => <Tag color={STATUS_META[s]?.color ?? 'default'}>{STATUS_META[s]?.label ?? s}</Tag>,
    },
    {
      title: '生效日期', dataIndex: 'effectiveDate', key: 'effectiveDate', width: 130,
      render: (v?: string | null) => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 150,
      render: (v: string) => fmt(v),
    },
    {
      title: '操作', key: 'actions', width: 260,
      render: (_: unknown, r: ComplianceDocDto) => (
        <Space size={4} wrap>
          <Button size="small" icon={<Eye size={12} />} onClick={() => void handleView(r)}>查看</Button>
          {r.status !== 'ARCHIVED' && (
            <Button size="small" icon={<Pencil size={12} />} onClick={() => openEdit(r)}>编辑</Button>
          )}
          {r.status === 'DRAFT' && (
            <Button size="small" type="primary" ghost icon={<Send size={12} />} onClick={() => void handlePublish(r)}>发布</Button>
          )}
          {r.status === 'CURRENT' && (
            <Button size="small" icon={<Archive size={12} />} onClick={() => void handleArchive(r)}>归档</Button>
          )}
          <Popconfirm
            title={`确认删除《${r.title}》？`}
            description="删除后不可恢复"
            onConfirm={() => void handleDelete(r)}
          >
            <Button size="small" danger icon={<Trash2 size={12} />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} align="center">
        <ScrollText size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>合规文档库</span>
        <Tag color="green">DRAFT → CURRENT → ARCHIVED</Tag>
      </Space>

      {error && (
        <Alert
          type="error" showIcon style={{ marginBottom: 16 }} message={error}
          action={<Button size="small" onClick={() => void load()}>重试</Button>}
        />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="文档总数" value={counts.total} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="现行" value={counts.current} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="草稿" value={counts.draft} styles={{ content: { color: '#fa8c16' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已归档" value={counts.archived} styles={{ content: { color: '#8c8c8c' } }} /></Card></Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            allowClear placeholder="分类筛选" style={{ width: 150 }}
            value={category} onChange={setCategory}
            options={categories.map((c) => ({ value: c, label: c }))}
          />
          <Select
            allowClear placeholder="状态筛选" style={{ width: 120 }}
            value={status} onChange={setStatus}
            options={Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))}
          />
          <Input
            allowClear placeholder="搜索标题/分类/内容" style={{ width: 240 }}
            prefix={<Search size={14} color="#999" />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onPressEnter={() => setSearch(searchInput.trim())}
          />
          <Button icon={<Search size={14} />} onClick={() => setSearch(searchInput.trim())}>搜索</Button>
          <Button icon={<RefreshCw size={14} />} onClick={() => { setSearchInput(''); setSearch(''); setCategory(undefined); setStatus(undefined); }}>重置</Button>
          <Button type="primary" icon={<FilePlus2 size={14} />} onClick={openCreate}>新建文档</Button>
        </Space>
      </Card>

      <Card>
        <Spin spinning={loading}>
          <Table
            rowKey="id" columns={columns} dataSource={docs}
            pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
          />
        </Spin>
      </Card>

      <Modal
        title={editing ? `编辑文档 - ${editing.title}` : '新建合规文档'}
        open={modalOpen}
        onOk={() => void handleSave()}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
                <Input placeholder="文档标题" maxLength={200} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
                <Select
                  showSearch placeholder="选择或输入分类"
                  options={categories.map((c) => ({ value: c, label: c }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="type" label="类型">
                <Select options={TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="version" label="版本">
                <Input placeholder="如 1.0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态">
                <Select options={Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="author" label="编写人">
                <Input placeholder="编写人" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="approvedBy" label="批准人">
                <Input placeholder="批准人" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="effectiveDate" label="生效日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入文档内容' }]}>
                <TextArea rows={8} placeholder="文档正文内容" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title={detail ? detail.title : '文档详情'}
        open={!!detail}
        onClose={() => setDetail(null)}
        width={560}
      >
        {detail && (
          <>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="分类">{detail.category}</Descriptions.Item>
              <Descriptions.Item label="类型">{detail.type}</Descriptions.Item>
              <Descriptions.Item label="版本">{detail.version}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_META[detail.status]?.color ?? 'default'}>{STATUS_META[detail.status]?.label ?? detail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="编写人">{detail.author ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="批准人">{detail.approvedBy ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="生效日期">{detail.effectiveDate ? dayjs(detail.effectiveDate).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{fmt(detail.updatedAt)}</Descriptions.Item>
              <Descriptions.Item label="发布时间">{fmt(detail.publishedAt)}</Descriptions.Item>
              <Descriptions.Item label="归档时间">{fmt(detail.archivedAt)}</Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5} style={{ marginTop: 16 }}>文档内容</Typography.Title>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#fafafa', padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 1.7 }}>
              {detail.content || '（无内容）'}
            </pre>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default ComplianceDocsPage;
