import { useState, useMemo, useEffect } from 'react';
import { Clock, Search, ToggleLeft, ToggleRight, Trash2, Edit3 } from 'lucide-react';
import { Button, Modal, Form, Input, InputNumber, Select, Tag, message, Popconfirm, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { workflowApi } from '../services/api/workflowApi';
import type { SLAPolicyDto } from '../services/api/workflowApi';
import { usePagination } from '../hooks/usePagination';
import { DataTable } from '../components/common/DataTable';
import { ActionButton } from '../components/common/ActionButton';
import { ErrorBanner } from '../components/feedback';
import { t } from '../i18n/appI18n';

const MODALITIES = ['CT', 'MR', 'DR', 'US', 'DSA', 'MG', 'PET-CT'];
const PRIORITIES = [
  { value: 'critical', label: t('sla.priority.critical'), color: '#ef4444' },
  { value: 'urgent', label: t('sla.priority.urgent'), color: '#f59e0b' },
  { value: 'normal', label: t('sla.priority.normal'), color: '#3b82f6' },
];

export default function SlaPolicyPage() {
  const [policies, setPolicies] = useState<SLAPolicyDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SLAPolicyDto | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const res = await workflowApi.listSlaPolicies();
      if (res.success && Array.isArray(res.data)) {
        setPolicies(res.data as SLAPolicyDto[]);
        setLoadError(null);
      } else {
        setLoadError(t('w9.states.error'));
      }
    } catch {
      setLoadError(t('w9.states.error'));
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return policies;
    const q = search.toLowerCase();
    return policies.filter(p => p.name.toLowerCase().includes(q) || p.modality.toLowerCase().includes(q) || p.priority.toLowerCase().includes(q));
  }, [policies, search]);
  const { pageData: pagedPolicies, pagination: policiesPagination } = usePagination(filtered);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      for (const p of policies) {
        await workflowApi.updateSlaPolicy(p.id, p);
      }
      message.success(t('sla.saveAllSuccess'));
    } catch {
      message.error(t('sla.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: SLAPolicyDto) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        const res = await workflowApi.updateSlaPolicy(editing.id, values);
        if (res.success) {
          setPolicies(prev => prev.map(p => p.id === editing.id ? { ...p, ...values } as SLAPolicyDto : p));
          message.success(t('sla.updated'));
        } else {
          message.error(res.error?.message ?? t('sla.updateFailed'));
        }
      } else {
        const res = await workflowApi.createSlaPolicy({ ...values, active: true });
        if (res.success) {
          setPolicies(prev => [...prev, res.data as SLAPolicyDto]);
          message.success(t('sla.created'));
        } else {
          message.error(res.error?.message ?? t('sla.createFailed'));
        }
      }
      setModalOpen(false);
    } catch {
      message.error(t('sla.opFailed'));
    }
  };

  const toggleActive = async (id: string) => {
    const p = policies.find(x => x.id === id);
    if (!p) return;
    const res = await workflowApi.updateSlaPolicy(id, { active: !p.active });
    if (res.success) {
      setPolicies(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
      message.success(t('sla.toggled'));
    } else {
      message.error(res.error?.message ?? t('sla.toggleFailed'));
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await workflowApi.deleteSlaPolicy(id);
      if (res.success) {
        setPolicies(prev => prev.filter(p => p.id !== id));
        message.success(t('sla.deleted'));
      } else {
        message.error(res.error?.message ?? t('sla.deleteFailed'));
      }
    } catch {
      message.error(t('sla.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const columns: ColumnsType<SLAPolicyDto> = [
    { title: t('sla.colName'), dataIndex: 'name', key: 'name', width: 160 },
    {
      title: t('sla.colModality'), dataIndex: 'modality', key: 'modality', width: 100,
      render: (m: string) => <Tag color="blue">{m}</Tag>,
    },
    {
      title: t('sla.colPriority'), dataIndex: 'priority', key: 'priority', width: 100,
      render: (p: string) => {
        const pr = PRIORITIES.find(x => x.value === p);
        return <Tag color={pr?.color}>{pr?.label}</Tag>;
      },
    },
    { title: t('sla.colTarget'), dataIndex: 'targetMinutes', key: 'targetMinutes', width: 110 },
    { title: t('sla.colWarning'), dataIndex: 'warningMinutes', key: 'warningMinutes', width: 110 },
    { title: t('sla.colEscalation'), dataIndex: 'escalationMinutes', key: 'escalationMinutes', width: 110 },
    {
      title: t('sla.colStatus'), dataIndex: 'active', key: 'active', width: 90,
      render: (a: boolean) => <Tag icon={a ? <ToggleRight size={12} /> : <ToggleLeft size={12} />} color={a ? 'green' : 'default'}>{a ? t('sla.enabled') : t('sla.disabled')}</Tag>,
    },
    {
      title: t('sla.colAction'), key: 'action', width: 160,
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<Edit3 size={12} />} onClick={() => openEdit(record)}>{t('sla.edit')}</Button>
          <Button size="small" icon={record.active ? <ToggleLeft size={12} /> : <ToggleRight size={12} />} onClick={() => toggleActive(record.id)}>{record.active ? t('sla.disabled') : t('sla.enabled')}</Button>
          <Popconfirm title={t('sla.deleteConfirm')} onConfirm={() => handleDelete(record.id)} okText={t('sla.ok')} cancelText={t('sla.cancel')}>
            <Button size="small" danger icon={<Trash2 size={12} />} loading={deletingId === record.id}>{t('sla.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }} data-testid="sla-policy-page">
      <header style={{ background: 'linear-gradient(135deg,#dc2626 0%,#f59e0b 100%)', color: '#fff', padding: '14px 24px', borderRadius: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={20} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{t('sla.title')}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{t('sla.subtitle', { count: policies.length })}</div>
          </div>
        </div>
      </header>
      <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Input placeholder={t('sla.searchPlaceholder')} prefix={<Search size={14} />} value={search} onChange={e => setSearch(e.target.value)} style={{ width: 300 }} allowClear />
          <ActionButton action="create" onClick={openAdd} disabled={loading}>{t('sla.addPolicy')}</ActionButton>
        </div>
        {loadError && !loading && <ErrorBanner message={loadError} />}
        <DataTable columns={columns} dataSource={pagedPolicies} rowKey="id" pagination={policiesPagination} loading={loading} emptyText={t('w9.states.empty')} scroll={{ x: 'max-content' }}/>
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Button type="primary" loading={saving} onClick={handleSaveAll} icon={<Clock size={14} />}>{t('sla.saveAll')}</Button>
        </div>
      </div>
      <Modal title={editing ? t('sla.editPolicy') : t('sla.newPolicy')} open={modalOpen} onOk={handleOk} onCancel={() => setModalOpen(false)} width={520}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('sla.colName')} rules={[{ required: true, message: t('sla.nameRequired') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="modality" label={t('sla.colModality')} rules={[{ required: true, message: t('sla.modalityRequired') }]}>
            <Select options={MODALITIES.map(m => ({ value: m, label: m }))} />
          </Form.Item>
          <Form.Item name="priority" label={t('sla.colPriority')} rules={[{ required: true, message: t('sla.priorityRequired') }]}>
            <Select options={PRIORITIES.map(p => ({ value: p.value, label: p.label }))} />
          </Form.Item>
          <Form.Item name="targetMinutes" label={t('sla.targetLabel')} rules={[{ required: true, message: t('sla.targetRequired') }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="warningMinutes" label={t('sla.warningLabel')} rules={[{ required: true, message: t('sla.warningRequired') }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="escalationMinutes" label={t('sla.escalationLabel')}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
