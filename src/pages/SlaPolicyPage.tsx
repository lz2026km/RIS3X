import { useState, useMemo, useEffect } from 'react';
import { Clock, Plus, Search, ToggleLeft, ToggleRight, Trash2, Edit3 } from 'lucide-react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Tag, message, Popconfirm, Space, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { workflowApi } from '../services/api/workflowApi';
import type { SLAPolicyDto } from '../services/api/workflowApi';

const MODALITIES = ['CT', 'MR', 'DR', 'US', 'DSA', 'MG', 'PET-CT'];
const PRIORITIES = [
  { value: 'critical', label: '危急', color: '#ef4444' },
  { value: 'urgent', label: '紧急', color: '#f59e0b' },
  { value: 'normal', label: '常规', color: '#3b82f6' },
];

export default function SlaPolicyPage() {
  const [policies, setPolicies] = useState<SLAPolicyDto[]>([]);
  const [loading, setLoading] = useState(false);
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
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return policies;
    const q = search.toLowerCase();
    return policies.filter(p => p.name.toLowerCase().includes(q) || p.modality.toLowerCase().includes(q) || p.priority.toLowerCase().includes(q));
  }, [policies, search]);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      for (const p of policies) {
        await workflowApi.updateSlaPolicy(p.id, p);
      }
      message.success('全部策略已保存');
    } catch {
      message.error('保存失败');
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
          message.success('策略已更新');
        } else {
          message.error(res.error?.message ?? '更新失败');
        }
      } else {
        const res = await workflowApi.createSlaPolicy({ ...values, active: true });
        if (res.success) {
          setPolicies(prev => [...prev, res.data as SLAPolicyDto]);
          message.success('策略已创建');
        } else {
          message.error(res.error?.message ?? '创建失败');
        }
      }
      setModalOpen(false);
    } catch {
      message.error('操作失败');
    }
  };

  const toggleActive = async (id: string) => {
    const p = policies.find(x => x.id === id);
    if (!p) return;
    const res = await workflowApi.updateSlaPolicy(id, { active: !p.active });
    if (res.success) {
      setPolicies(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
      message.success('状态已切换');
    } else {
      message.error(res.error?.message ?? '切换失败');
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await workflowApi.deleteSlaPolicy(id);
      if (res.success) {
        setPolicies(prev => prev.filter(p => p.id !== id));
        message.success('策略已删除');
      } else {
        message.error(res.error?.message ?? '删除失败');
      }
    } catch {
      message.error('删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const columns: ColumnsType<SLAPolicyDto> = [
    { title: '策略名称', dataIndex: 'name', key: 'name', width: 160 },
    {
      title: '设备类型', dataIndex: 'modality', key: 'modality', width: 100,
      render: (m: string) => <Tag color="blue">{m}</Tag>,
    },
    {
      title: '优先级', dataIndex: 'priority', key: 'priority', width: 100,
      render: (p: string) => {
        const pr = PRIORITIES.find(x => x.value === p);
        return <Tag color={pr?.color}>{pr?.label}</Tag>;
      },
    },
    { title: '目标(分钟)', dataIndex: 'targetMinutes', key: 'targetMinutes', width: 110 },
    { title: '预警(分钟)', dataIndex: 'warningMinutes', key: 'warningMinutes', width: 110 },
    { title: '升级(分钟)', dataIndex: 'escalationMinutes', key: 'escalationMinutes', width: 110 },
    {
      title: '状态', dataIndex: 'active', key: 'active', width: 90,
      render: (a: boolean) => <Tag icon={a ? <ToggleRight size={12} /> : <ToggleLeft size={12} />} color={a ? 'green' : 'default'}>{a ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 160,
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<Edit3 size={12} />} onClick={() => openEdit(record)}>编辑</Button>
          <Button size="small" icon={record.active ? <ToggleLeft size={12} /> : <ToggleRight size={12} />} onClick={() => toggleActive(record.id)}>{record.active ? '停用' : '启用'}</Button>
          <Popconfirm title="确定删除该策略?" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button size="small" danger icon={<Trash2 size={12} />} loading={deletingId === record.id}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }} data-testid="sla-policy-page">
      <header style={{ background: 'linear-gradient(135deg,#dc2626 0%,#f59e0b 100%)', color: '#fff', padding: '14px 24px', borderRadius: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={20} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>SLA 策略配置</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>设备类型 × 优先级 × 时效阈值 · 共 {policies.length} 条策略</div>
          </div>
        </div>
      </header>
      <div style={{ background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Input placeholder="搜索策略名称/设备/优先级..." prefix={<Search size={14} />} value={search} onChange={e => setSearch(e.target.value)} style={{ width: 300 }} allowClear />
          <Button type="primary" icon={<Plus size={14} />} onClick={openAdd} disabled={loading}>新增策略</Button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <Table columns={columns} dataSource={filtered} rowKey="id" pagination={false} size="middle" scroll={{ x: 'max-content' }}/>
        )}
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Button type="primary" loading={saving} onClick={handleSaveAll} icon={<Clock size={14} />}>保存全部</Button>
        </div>
      </div>
      <Modal title={editing ? '编辑策略' : '新增策略'} open={modalOpen} onOk={handleOk} onCancel={() => setModalOpen(false)} width={520}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="策略名称" rules={[{ required: true, message: '请输入策略名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="modality" label="设备类型" rules={[{ required: true, message: '请选择设备类型' }]}>
            <Select options={MODALITIES.map(m => ({ value: m, label: m }))} />
          </Form.Item>
          <Form.Item name="priority" label="优先级" rules={[{ required: true, message: '请选择优先级' }]}>
            <Select options={PRIORITIES.map(p => ({ value: p.value, label: p.label }))} />
          </Form.Item>
          <Form.Item name="targetMinutes" label="目标完成时间(分钟)" rules={[{ required: true, message: '请输入目标分钟数' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="warningMinutes" label="预警时间(分钟)" rules={[{ required: true, message: '请输入预警分钟数' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="escalationMinutes" label="升级时间(分钟)">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
