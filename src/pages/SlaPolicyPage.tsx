import { useState, useMemo } from 'react';
import { Clock, Plus, Search, ToggleLeft, ToggleRight, Trash2, Edit3 } from 'lucide-react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Tag, message, Popconfirm, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface SLAPolicy {
  id: string;
  name: string;
  modality: string;
  priority: string;
  targetMinutes: number;
  warningMinutes: number;
  escalationMinutes: number;
  active: boolean;
}

const SEED: SLAPolicy[] = [
  { id: '1', name: 'CT危急', modality: 'CT', priority: 'critical', targetMinutes: 30, warningMinutes: 20, escalationMinutes: 45, active: true },
  { id: '2', name: 'CT紧急', modality: 'CT', priority: 'urgent', targetMinutes: 90, warningMinutes: 60, escalationMinutes: 120, active: true },
  { id: '3', name: 'CT常规', modality: 'CT', priority: 'normal', targetMinutes: 240, warningMinutes: 180, escalationMinutes: 360, active: false },
  { id: '4', name: 'MR危急', modality: 'MR', priority: 'critical', targetMinutes: 45, warningMinutes: 30, escalationMinutes: 60, active: true },
  { id: '5', name: 'MR紧急', modality: 'MR', priority: 'urgent', targetMinutes: 180, warningMinutes: 120, escalationMinutes: 240, active: true },
  { id: '6', name: 'DR危急', modality: 'DR', priority: 'critical', targetMinutes: 15, warningMinutes: 10, escalationMinutes: 20, active: true },
  { id: '7', name: 'DR常规', modality: 'DR', priority: 'normal', targetMinutes: 120, warningMinutes: 90, escalationMinutes: 180, active: false },
];

const MODALITIES = ['CT', 'MR', 'DR', 'US', 'DSA', 'MG', 'PET-CT'];
const PRIORITIES = [
  { value: 'critical', label: '危急', color: '#ef4444' },
  { value: 'urgent', label: '紧急', color: '#f59e0b' },
  { value: 'normal', label: '常规', color: '#3b82f6' },
];

export default function SlaPolicyPage() {
  const [policies, setPolicies] = useState<SLAPolicy[]>(SEED);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SLAPolicy | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return policies;
    const q = search.toLowerCase();
    return policies.filter(p => p.name.toLowerCase().includes(q) || p.modality.toLowerCase().includes(q) || p.priority.toLowerCase().includes(q));
  }, [policies, search]);

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      await fetch('/api/v1/sla/policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policies: values }),
      });
    } catch { /* local only */ }
    setSaving(false);
  };

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: SLAPolicy) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    if (editing) {
      setPolicies(prev => prev.map(p => p.id === editing.id ? { ...p, ...values } : p));
      message.success('策略已更新');
    } else {
      const newPolicy: SLAPolicy = { id: `sla-${Date.now()}`, ...values, active: true };
      setPolicies(prev => [...prev, newPolicy]);
      message.success('策略已创建');
    }
    setModalOpen(false);
    handleSave(policies);
  };

  const toggleActive = (id: string) => {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
    message.success('状态已切换');
  };

  const handleDelete = (id: string) => {
    setPolicies(prev => prev.filter(p => p.id !== id));
    message.success('策略已删除');
  };

  const columns: ColumnsType<SLAPolicy> = [
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
            <Button size="small" danger icon={<Trash2 size={12} />}>删除</Button>
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
          <Button type="primary" icon={<Plus size={14} />} onClick={openAdd}>新增策略</Button>
        </div>
        <Table columns={columns} dataSource={filtered} rowKey="id" pagination={false} size="middle" />
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Button type="primary" loading={saving} onClick={() => handleSave(policies)} icon={<Clock size={14} />}>保存全部</Button>
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
