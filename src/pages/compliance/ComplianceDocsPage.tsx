// [v3.0.6.11-79 W1-C] 合规文档库: 列表/筛选/搜索 + 新建/编辑/发布/归档/删除 + 详情
import dayjs from 'dayjs';
import { usePagination } from '../../hooks/usePagination';
import { invalidateApiCacheByPrefix } from '../../services/api/client';
import {
  complianceDocsApi,
  type ComplianceDocDto,
  type ComplianceDocReport,
  type CreateComplianceDocInput,
} from '../../services/api/complianceDocsApi';
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Drawer, Form, Input, Modal,
  Popconfirm, Row, Select, Space, Spin, Statistic, Table, Tag, Typography, message,
} from 'antd';
import { Search, FilePlus2, RefreshCw, FileText, ScrollText, Send, Archive, Eye, Pencil, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '../../i18n/appI18n';

const { TextArea } = Input;

const STATUS_META: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'orange', label: t('complianceDocs.statusDraft') },
  CURRENT: { color: 'green', label: t('complianceDocs.statusCurrent') },
  ARCHIVED: { color: 'default', label: t('complianceDocs.statusArchived') },
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

  // [G005 W2] 合规文档报告 (GET /compliance-docs/report)
  const [report, setReport] = useState<ComplianceDocReport | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const { pageData: docsPageData, pagination: docsPagination } = usePagination(docs, 10);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await complianceDocsApi.list({ category, status, search: search || undefined });
      if (res.success && Array.isArray(res.data)) {
        setDocs(res.data);
      } else {
        setDocs([]);
        setError(res.error?.message ?? t('complianceDocs.loadFailed'));
      }
    } catch (e) {
      setError((e as Error)?.message ?? t('complianceDocs.loadFailed'));
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

  // [G005 W2] 生成合规报告 (complianceDocsApi.getReport)
  const openReport = async () => {
    setReportOpen(true);
    setReportLoading(true);
    try {
      const res = await complianceDocsApi.getReport();
      if (res.success && res.data) setReport(res.data);
      else message.error(res.error?.message ?? t('w2Orphans.loadFailed'));
    } catch {
      message.error(t('w2Orphans.loadFailed'));
    } finally {
      setReportLoading(false);
    }
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
        message.error(res.error?.message ?? t('complianceDocs.saveFailed'));
        return;
      }
      message.success(editing ? t('complianceDocs.updated') : t('complianceDocs.created'));
      setModalOpen(false);
      await reloadAfterMutation();
    } catch (e) {
      message.error((e as Error)?.message ?? t('complianceDocs.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (doc: ComplianceDocDto) => {
    const res = await complianceDocsApi.publish(doc.id);
    if (!res.success) { message.error(res.error?.message ?? t('complianceDocs.publishFailed')); return; }
    message.success(`《${doc.title}》${t('complianceDocs.publishedSuffix')}`);
    await reloadAfterMutation();
  };

  const handleArchive = async (doc: ComplianceDocDto) => {
    const res = await complianceDocsApi.archive(doc.id);
    if (!res.success) { message.error(res.error?.message ?? t('complianceDocs.archiveFailed')); return; }
    message.success(`《${doc.title}》${t('complianceDocs.archivedSuffix')}`);
    await reloadAfterMutation();
  };

  const handleDelete = async (doc: ComplianceDocDto) => {
    const res = await complianceDocsApi.delete(doc.id);
    if (!res.success) { message.error(res.error?.message ?? t('complianceDocs.deleteFailed')); return; }
    message.success(`《${doc.title}》${t('complianceDocs.deletedSuffix')}`);
    await reloadAfterMutation();
  };

  const handleView = async (doc: ComplianceDocDto) => {
    const res = await complianceDocsApi.getById(doc.id);
    setDetail(res.success && res.data ? res.data : doc);
  };

  const columns = [
    {
      title: t('complianceDocs.colTitle'), dataIndex: 'title', key: 'title', ellipsis: true,
      render: (v: string, r: ComplianceDocDto) => (
        <Space size={6}>
          <FileText size={14} color="#2563eb" />
          <a onClick={() => void handleView(r)}>{v}</a>
          <Tag color="blue" style={{ fontSize: 11 }}>{r.type}</Tag>
        </Space>
      ),
    },
    { title: t('complianceDocs.colCategory'), dataIndex: 'category', key: 'category', width: 130 },
    { title: t('complianceDocs.colVersion'), dataIndex: 'version', key: 'version', width: 80 },
    {
      title: t('complianceDocs.colStatus'), dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => <Tag color={STATUS_META[s]?.color ?? 'default'}>{STATUS_META[s]?.label ?? s}</Tag>,
    },
    {
      title: t('complianceDocs.colEffectiveDate'), dataIndex: 'effectiveDate', key: 'effectiveDate', width: 130,
      render: (v?: string | null) => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
    },
    {
      title: t('complianceDocs.colUpdatedAt'), dataIndex: 'updatedAt', key: 'updatedAt', width: 150,
      render: (v: string) => fmt(v),
    },
    {
      title: t('complianceDocs.colActions'), key: 'actions', width: 260,
      render: (_: unknown, r: ComplianceDocDto) => (
        <Space size={4} wrap>
          <Button size="small" icon={<Eye size={12} />} onClick={() => void handleView(r)}>{t('complianceDocs.view')}</Button>
          {r.status !== 'ARCHIVED' && (
            <Button size="small" icon={<Pencil size={12} />} onClick={() => openEdit(r)}>{t('complianceDocs.edit')}</Button>
          )}
          {r.status === 'DRAFT' && (
            <Button size="small" type="primary" ghost icon={<Send size={12} />} onClick={() => void handlePublish(r)}>{t('complianceDocs.publish')}</Button>
          )}
          {r.status === 'CURRENT' && (
            <Button size="small" icon={<Archive size={12} />} onClick={() => void handleArchive(r)}>{t('complianceDocs.archive')}</Button>
          )}
          <Popconfirm
            title={`${t('complianceDocs.confirmDeletePrefix')}《${r.title}》？`}
            description={t('complianceDocs.deleteIrreversible')}
            onConfirm={() => void handleDelete(r)}
          >
            <Button size="small" danger icon={<Trash2 size={12} />}>{t('complianceDocs.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} align="center">
        <ScrollText size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('complianceDocs.title')}</span>
        <Tag color="green">{t('complianceDocs.statusFlow')}</Tag>
      </Space>

      {error && (
        <Alert
          type="error" showIcon style={{ marginBottom: 16 }} message={error}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('complianceDocs.retry')}</Button>}
        />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title={t('complianceDocs.statTotal')} value={counts.total} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('complianceDocs.statusCurrent')} value={counts.current} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('complianceDocs.statusDraft')} value={counts.draft} styles={{ content: { color: '#fa8c16' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('complianceDocs.statusArchived')} value={counts.archived} styles={{ content: { color: '#8c8c8c' } }} /></Card></Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            allowClear placeholder={t('complianceDocs.categoryFilter')} style={{ width: 150 }}
            value={category} onChange={setCategory}
            options={categories.map((c) => ({ value: c, label: c }))}
          />
          <Select
            allowClear placeholder={t('complianceDocs.statusFilter')} style={{ width: 120 }}
            value={status} onChange={setStatus}
            options={Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))}
          />
          <Input
            allowClear placeholder={t('complianceDocs.searchPlaceholder')} style={{ width: 240 }}
            prefix={<Search size={14} color="#999" />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onPressEnter={() => setSearch(searchInput.trim())}
          />
          <Button icon={<Search size={14} />} onClick={() => setSearch(searchInput.trim())}>{t('complianceDocs.search')}</Button>
          <Button icon={<RefreshCw size={14} />} onClick={() => { setSearchInput(''); setSearch(''); setCategory(undefined); setStatus(undefined); }}>{t('complianceDocs.reset')}</Button>
          <Button type="primary" icon={<FilePlus2 size={14} />} onClick={openCreate}>{t('complianceDocs.newDoc')}</Button>
          <Button icon={<FileText size={14} />} onClick={() => void openReport()}>{t('w2Orphans.generateReport')}</Button>
        </Space>
      </Card>

      <Card>
        <Spin spinning={loading}>
          <Table
            rowKey="id" columns={columns} dataSource={docsPageData}
            pagination={docsPagination}
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>

      <Modal
        title={editing ? `${t('complianceDocs.editDocTitle')} - ${editing.title}` : t('complianceDocs.newDocTitle')}
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
              <Form.Item name="title" label={t('complianceDocs.colTitle')} rules={[{ required: true, message: t('complianceDocs.titleRequired') }]}>
                <Input placeholder={t('complianceDocs.titlePlaceholder')} maxLength={200} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label={t('complianceDocs.colCategory')} rules={[{ required: true, message: t('complianceDocs.categoryRequired') }]}>
                <Select
                  showSearch placeholder={t('complianceDocs.categoryPlaceholder')}
                  options={categories.map((c) => ({ value: c, label: c }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="type" label={t('complianceDocs.type')}>
                <Select options={TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="version" label={t('complianceDocs.colVersion')}>
                <Input placeholder={t('complianceDocs.versionPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label={t('complianceDocs.colStatus')}>
                <Select options={Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="author" label={t('complianceDocs.author')}>
                <Input placeholder={t('complianceDocs.author')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="approvedBy" label={t('complianceDocs.approvedBy')}>
                <Input placeholder={t('complianceDocs.approvedBy')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="effectiveDate" label={t('complianceDocs.colEffectiveDate')}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="content" label={t('complianceDocs.content')} rules={[{ required: true, message: t('complianceDocs.contentRequired') }]}>
                <TextArea rows={8} placeholder={t('complianceDocs.contentPlaceholder')} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title={detail ? detail.title : t('complianceDocs.docDetail')}
        open={!!detail}
        onClose={() => setDetail(null)}
        width={560}
      >
        {detail && (
          <>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label={t('complianceDocs.colCategory')}>{detail.category}</Descriptions.Item>
              <Descriptions.Item label={t('complianceDocs.type')}>{detail.type}</Descriptions.Item>
              <Descriptions.Item label={t('complianceDocs.colVersion')}>{detail.version}</Descriptions.Item>
              <Descriptions.Item label={t('complianceDocs.colStatus')}>
                <Tag color={STATUS_META[detail.status]?.color ?? 'default'}>{STATUS_META[detail.status]?.label ?? detail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('complianceDocs.author')}>{detail.author ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('complianceDocs.approvedBy')}>{detail.approvedBy ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('complianceDocs.colEffectiveDate')}>{detail.effectiveDate ? dayjs(detail.effectiveDate).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
              <Descriptions.Item label={t('complianceDocs.colUpdatedAt')}>{fmt(detail.updatedAt)}</Descriptions.Item>
              <Descriptions.Item label={t('complianceDocs.publishedAt')}>{fmt(detail.publishedAt)}</Descriptions.Item>
              <Descriptions.Item label={t('complianceDocs.archivedAt')}>{fmt(detail.archivedAt)}</Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5} style={{ marginTop: 16 }}>{t('complianceDocs.docContent')}</Typography.Title>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--bg-card)', padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 1.7 }}>
              {detail.content || t('complianceDocs.noContent')}
            </pre>
          </>
        )}
      </Drawer>

      {/* [G005 W2] 合规报告 (GET /compliance-docs/report) */}
      <Modal
        title={t('w2Orphans.complianceReport')}
        open={reportOpen}
        onCancel={() => setReportOpen(false)}
        footer={null}
        width={640}
      >
        <Spin spinning={reportLoading}>
          {report && (
            <>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label={t('w2Orphans.generatedAt')}>{fmt(report.generatedAt)}</Descriptions.Item>
                <Descriptions.Item label={t('w2Orphans.systemName')}>{report.systemName}</Descriptions.Item>
                <Descriptions.Item label={t('w2Orphans.standard')}>{report.complianceStandard}</Descriptions.Item>
              </Descriptions>
              <Typography.Title level={5} style={{ marginTop: 16 }}>{t('w2Orphans.summary')}</Typography.Title>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--bg-card)', padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 1.7 }}>
                {JSON.stringify(report.summary, null, 2)}
              </pre>
              {report.checklist && report.checklist.length > 0 && (
                <>
                  <Typography.Title level={5} style={{ marginTop: 16 }}>{t('w2Orphans.checklist')}</Typography.Title>
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    {report.checklist.map((c) => (
                      <div key={c.item} style={{ fontSize: 13 }}>
                        <Tag color={c.status === '通过' ? 'green' : 'red'}>{c.status}</Tag>
                        {c.item} — {c.detail}
                      </div>
                    ))}
                  </Space>
                </>
              )}
            </>
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default ComplianceDocsPage;
