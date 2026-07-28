import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Modal, Form, Input, InputNumber, Select, Descriptions, Space, message, Spin } from 'antd';
import { Plus } from 'lucide-react';
import { DentalPageLayout, EmptyState } from './DentalShared';
import { dentalApi } from '@/services/api/dentalApi';

export const DentalInventoryPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [detail, setDetail] = useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await dentalApi.listInventory();
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setItems(res.data);
        }
      } catch { /* API may not be available */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);
  const lowCount = items.filter(i => i.stock < i.minStock).length;
  const unitLabels: Record<string, string> = { pcs: '件', tube: '支', set: '套', box: '盒', ml: '毫升', g: '克' };
  const onCreate = () => {
    form.validateFields().then((v) => {
      const newItem = { id: `INV-${String(items.length + 1).padStart(3, '0')}`, ...v, stock: 0 };
      setItems((prev) => [...prev, newItem]);
      setModalOpen(false);
      form.resetFields();
      message.success(`已新增库存项 ${newItem.id}`);
    }).catch(() => {});
  };
  const onAdjust = (delta: number) => {
    if (!detail) return;
    const next = items.map((it) => it.id === detail.id ? { ...it, stock: Math.max(0, it.stock + delta) } : it);
    setItems(next);
    setDetail({ ...detail, stock: detail.stock + delta });
    message.success(`${delta > 0 ? '入库' : '出库'} ${Math.abs(delta)} ${unitLabels[detail.unit] || detail.unit}`);
  };
  return (
    <DentalPageLayout header={{ title: '口腔库存管理', tags: [<Tag key="lo" color="orange">低库存 {lowCount}</Tag>], extra: (
      <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>新增库存</Button>
    ) }}>
      {items.length === 0 ? (
        <EmptyState tip="暂无库存项" onCreate={() => setModalOpen(true)} createLabel="新增库存" />
      ) : (
        <Table dataSource={items} rowKey="id" size="small" columns={[
          { title: 'ID', dataIndex: 'id', width: 100 },
          { title: '名称', dataIndex: 'name' },
          { title: '类别', dataIndex: 'category', render: (c: string) => <Tag>{c}</Tag> },
          { title: '库存', dataIndex: 'stock', render: (n: number) => <b>{n}</b> },
          { title: '单位', dataIndex: 'unit', render: (u: string) => unitLabels[u] || u },
          { title: '最低', dataIndex: 'minStock' },
          { title: '状态', render: (_, r: any) => r.stock < r.minStock ? <Tag color="red">低库存</Tag> : r.stock < r.minStock * 1.5 ? <Tag color="orange">预警</Tag> : <Tag color="green">充足</Tag> },
          { title: '操作', width: 100, render: (_, r: any) => (<Button size="small" onClick={() => setDetail(r)}>详情</Button>) },
        ]} />
      )}
      <Modal title="新增库存项" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={onCreate} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item label="名称" name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="类别" name="category">
            <Select options={[{ value: 'Implant', label: '种植' }, { value: 'Restorative', label: '修复' }, { value: 'Endo', label: '根管' }, { value: 'Ortho', label: '正畸' }, { value: 'Anesthesia', label: '麻醉' }]} />
          </Form.Item>
          <Form.Item label="最低库存" name="minStock" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="单位" name="unit">
            <Select options={Object.entries(unitLabels).map(([v, l]) => ({ value: v, label: l }))} />
          </Form.Item>
        </Form>
      </Modal>
      {detail && (
        <Modal title={`库存详情 - ${detail.name}`} open onCancel={() => setDetail(null)} footer={null}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
            <Descriptions.Item label="名称">{detail.name}</Descriptions.Item>
            <Descriptions.Item label="类别"><Tag>{detail.category}</Tag></Descriptions.Item>
            <Descriptions.Item label="当前库存"><b>{detail.stock}</b> {unitLabels[detail.unit] || detail.unit}</Descriptions.Item>
            <Descriptions.Item label="最低库存">{detail.minStock}</Descriptions.Item>
          </Descriptions>
          <Space style={{ marginTop: 12 }}>
            <Button onClick={() => onAdjust(1)}>入库 +1</Button>
            <Button danger onClick={() => onAdjust(-1)} disabled={detail.stock <= 0}>出库 -1</Button>
          </Space>
        </Modal>
      )}
    </DentalPageLayout>
  );
};

export default DentalInventoryPage;
