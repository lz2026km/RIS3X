import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Space, Typography, Button, Alert, Modal, Form, Input, Select, message, Tooltip, Popconfirm, Empty } from 'antd';
import { GitBranch, Plus, Edit3, Trash2, Copy, CheckCircle2, ArrowUpDown } from 'lucide-react';
import { approvalChainService } from '../../services/approval/ApprovalChain';
import type { ApprovalChainTemplate, ApprovalLevel, ApprovalRole } from '../../types/sign';

const { Text } = Typography;

const ROLE_OPTIONS: ApprovalRole[] = ['resident', 'attending', 'fellow', 'director', 'chief', 'admin', 'quality-officer', 'security-officer'];

const APPLIES_TO_OPTIONS: ApprovalChainTemplate['appliesTo'][] = [
  'critical-finding', 'cosign', 'release-lock', 'amend', 'routine-sign',
];

export interface ApprovalChainBuilderProps {
  onSelect?: (template: ApprovalChainTemplate) => void;
}

export const ApprovalChainBuilder: React.FC<ApprovalChainBuilderProps> = ({ onSelect }) => {
  const [templates, setTemplates] = useState<ApprovalChainTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApprovalChainTemplate | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await approvalChainService.list();
      setTemplates(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ levels: [{ role: 'attending', requiredCount: 1, slaHours: 24, canSkip: false }] });
    setModalOpen(true);
  };

  const openEdit = (t: ApprovalChainTemplate) => {
    setEditing(t);
    form.setFieldsValue(t);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      if (editing) {
        await approvalChainService.update(editing.id, vals);
        message.success('审批链已更新');
      } else {
        await approvalChainService.create(vals);
        message.success('审批链已创建');
      }
      setModalOpen(false);
      void load();
    } catch (e: any) {
      if (e.errorFields) return;
      message.error((e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    await approvalChainService.delete(id);
    message.success('已删除');
    void load();
  };

  const handleSetDefault = async (id: string) => {
    await approvalChainService.setDefault(id);
    message.success('已设为默认');
    void load();
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (n: string, r: ApprovalChainTemplate) => (
        <Space>
          <Text strong>{n}</Text>
          {r.isDefault && <Tag color="blue">默认</Tag>}
        </Space>
      ),
    },
    {
      title: '适用场景',
      dataIndex: 'appliesTo',
      key: 'appliesTo',
      render: (a: string) => <Tag>{a}</Tag>,
    },
    {
      title: '审批层级',
      key: 'levelCount',
      render: (_: unknown, r: ApprovalChainTemplate) => <Tag>{r.levels.length} 级</Tag>,
    },
    {
      title: '层级详情',
      key: 'levels',
      render: (_: unknown, r: ApprovalChainTemplate) => (
        <Space size={4}>
          {r.levels.map((l) => (
            <Tooltip key={l.levelId} title={`${l.label} (${l.role})`}>
              <Tag color="blue" style={{ cursor: 'pointer' }}>
                {l.role} {l.canSkip ? '(可跳)' : ''}
              </Tag>
            </Tooltip>
          ))}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (t: string) => new Date(t).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, r: ApprovalChainTemplate) => (
        <Space>
          {onSelect && <Button size="small" type="primary" onClick={() => onSelect(r)} icon={<CheckCircle2 size={12} />}>选用</Button>}
          <Button size="small" icon={<Edit3 size={12} />} onClick={() => openEdit(r)} />
          {!r.isDefault && <Button size="small" icon={<Copy size={12} />} onClick={() => void handleSetDefault(r.id)}>设为默认</Button>}
          <Popconfirm title="确认删除?" onConfirm={() => void handleDelete(r.id)}>
            <Button size="small" danger icon={<Trash2 size={12} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <GitBranch size={18} />
          <span>审批链管理</span>
          <Tag>{templates.length} 条</Tag>
        </Space>
      }
      extra={<Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>新建审批链</Button>}
      style={{ width: '100%' }}
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      <Table size="small" dataSource={templates} columns={columns} rowKey="id" pagination={false} locale={{ emptyText: <Empty description="暂无审批链" /> }} />

      <Modal
        title={editing ? '编辑审批链' : '新建审批链'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="appliesTo" label="适用场景" rules={[{ required: true }]}>
            <Select options={APPLIES_TO_OPTIONS.map((a) => ({ value: a, label: a }))} />
          </Form.Item>
          <Form.List name="levels">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item {...rest} name={[name, 'role']} rules={[{ required: true }]}>
                      <Select style={{ width: 120 }} options={ROLE_OPTIONS.map((r) => ({ value: r, label: r }))} placeholder="角色" />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'label']} rules={[{ required: true }]}>
                      <Input placeholder="标签" style={{ width: 100 }} />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'requiredCount']} initialValue={1}>
                      <Select style={{ width: 60 }} options={[{ value: 1, label: '1人' }, { value: 2, label: '2人' }, { value: 3, label: '3人' }]} />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'slaHours']} initialValue={24}>
                      <Select style={{ width: 72 }} options={[{ value: 1, label: '1h' }, { value: 2, label: '2h' }, { value: 4, label: '4h' }, { value: 8, label: '8h' }, { value: 24, label: '24h' }]} />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'canSkip']} valuePropName="checked">
                      <Select style={{ width: 60 }} options={[{ value: true, label: '可跳' }, { value: false, label: '必签' }]} />
                    </Form.Item>
                    <Button type="link" danger onClick={() => remove(name)} icon={<Trash2 size={14} />} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ role: 'attending', requiredCount: 1, slaHours: 24, canSkip: false })} icon={<Plus size={14} />}>
                  添加审批层级
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </Card>
  );
};

export default ApprovalChainBuilder;
