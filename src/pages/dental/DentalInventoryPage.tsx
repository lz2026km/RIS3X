// [v3.0.6.11-103 Wave 9] 口腔库存管理: KPI 统计 + 搜索筛选 + 真表格(分页/空态) + 新增/详情/入库出库/刷新/导出 + i18n + seed 回退
import React, { useState, useEffect, useMemo } from 'react';
import { Table, Tag, Button, Modal, Form, Input, InputNumber, Select, Descriptions, Space, Popconfirm, message } from 'antd';
import { Wallet, Package, AlertTriangle } from 'lucide-react';
import { DentalPageLayout, EmptyState } from './DentalShared';
import { dentalApi } from '@/services/api/dentalApi';
import { usePagination } from '@/hooks/usePagination';
import { t } from '../../i18n/appI18n';
import { StatCard, StatCardGrid } from '../../components/common/StatCard';
import { ActionButton } from '../../components/common/ActionButton';
import { ErrorBanner } from '../../components/feedback';

// 确定性 seed 回退 (API 不可用时展示, 与 MSW 字段对齐)
const SEED_INVENTORY: any[] = [
  { id: 'SEED-INV-001', name: 'Straumann 种植体 BLT 4.1×10mm', category: 'Implant', stock: 8, unit: 'set', minStock: 10 },
  { id: 'SEED-INV-002', name: '3M 光固化树脂 A2 (4g)', category: 'Restorative', stock: 26, unit: 'tube', minStock: 12 },
  { id: 'SEED-INV-003', name: '根管锉 ProTaper Next 套组', category: 'Endo', stock: 5, unit: 'set', minStock: 8 },
  { id: 'SEED-INV-004', name: '托槽 (金属自锁 0.022)', category: 'Ortho', stock: 120, unit: 'pcs', minStock: 50 },
  { id: 'SEED-INV-005', name: '利多卡因注射液 5ml', category: 'Anesthesia', stock: 40, unit: 'tube', minStock: 20 },
  { id: 'SEED-INV-006', name: '咬合纸 (蓝色)', category: 'Restorative', stock: 3, unit: 'box', minStock: 5 },
  { id: 'SEED-INV-007', name: '藻酸盐印模材', category: 'Restorative', stock: 18, unit: 'box', minStock: 6 },
  { id: 'SEED-INV-008', name: '牙周塞治剂', category: 'Periodontal', stock: 9, unit: 'tube', minStock: 4 },
];

const CATEGORY_OPTIONS = [
  { value: 'Implant', labelKey: 'w9d.dentalInvCat.implant' },
  { value: 'Restorative', labelKey: 'w9d.dentalInvCat.restorative' },
  { value: 'Endo', labelKey: 'w9d.dentalInvCat.endo' },
  { value: 'Ortho', labelKey: 'w9d.dentalInvCat.ortho' },
  { value: 'Anesthesia', labelKey: 'w9d.dentalInvCat.anesthesia' },
  { value: 'Periodontal', labelKey: 'w9d.dentalInvCat.periodontal' },
];

const UNIT_LABELS: Record<string, string> = { pcs: 'w9d.dentalInvUnit.pcs', tube: 'w9d.dentalInvUnit.tube', set: 'w9d.dentalInvUnit.set', box: 'w9d.dentalInvUnit.box', ml: 'w9d.dentalInvUnit.ml', g: 'w9d.dentalInvUnit.g' };
const unitLabel = (u: string) => (UNIT_LABELS[u] ? t(UNIT_LABELS[u]!) : u);

export const DentalInventoryPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fromSeed, setFromSeed] = useState(false);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [detail, setDetail] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const loadInventory = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await dentalApi.listInventory();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setItems(res.data);
        setFromSeed(false);
      } else {
        setItems(SEED_INVENTORY);
        setFromSeed(true);
        if (!res.success) setLoadError(t('w9.states.error'));
      }
    } catch (err) {
      console.error('[F04]', err);
      setItems(SEED_INVENTORY);
      setFromSeed(true);
      setLoadError(t('w9.states.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInventory();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      (i.name || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q) ||
      String(i.id || '').toLowerCase().includes(q),
    );
  }, [items, search]);

  // [G005 Wave2B P2] 库存列表受控分页 (usePagination, pageSize 10)
  const { pageData, pagination } = usePagination(filtered, 10);

  const lowCount = items.filter(i => i.stock < i.minStock).length;
  const warnCount = items.filter(i => i.stock >= i.minStock && i.stock < i.minStock * 1.5).length;
  const healthyCount = items.filter(i => i.stock >= i.minStock * 1.5).length;
  const totalStock = items.reduce((s, i) => s + (Number(i.stock) || 0), 0);

  const onCreate = async () => {
    let values: any;
    try {
      values = await form.validateFields();
    } catch (err) {
      console.error('[F04]', err);
      return;
    }
    setCreating(true);
    try {
      const res = await dentalApi.addInventoryItem({ ...values, stock: 0 });
      if (res.success) {
        setModalOpen(false);
        form.resetFields();
        message.success(t('w9.dentalInv.created'));
        await loadInventory();
      } else {
        message.error(t('w9d.dentalInv.createFailed', { msg: res.error?.message || t('w9d.sidebar.unknownError') }));
      }
    } catch (err) {
      console.error('[F04]', err);
      message.error(t('w9d.dentalInv.createRetry'));
    } finally {
      setCreating(false);
    }
  };

  // [G005 Wave2A P1] 入库/出库 → updateInventoryItem 真实落库, 失败回退本地 state
  const onAdjust = async (delta: number) => {
    if (!detail) return;
    const nextStock = Math.max(0, detail.stock + delta);
    const applyLocal = () => {
      const next = items.map((it) => it.id === detail.id ? { ...it, stock: nextStock } : it);
      setItems(next);
      setDetail({ ...detail, stock: nextStock });
    };
    applyLocal();
    message.success(`${delta > 0 ? t('w9.dentalInv.inbound') : t('w9.dentalInv.outbound')}`);
    try {
      const res = await dentalApi.updateInventoryItem(detail.id, { stock: nextStock });
      if (res.success && res.data) {
        setItems(prev => prev.map((it) => it.id === detail.id ? { ...it, stock: nextStock } : it));
      } else {
        console.warn('[F04] 库存落库失败, 已保留本地变更:', res.error?.message);
      }
    } catch (err) {
      console.warn('[F04] 库存落库失败, 已保留本地变更:', err);
    }
  };

  const onExport = () => {
    if (filtered.length === 0) return;
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['id', 'name', 'category', 'stock', 'unit', 'minStock'];
    const lines = [header.join(','), ...filtered.map((r) => [r.id, r.name, r.category, r.stock, r.unit, r.minStock].map(esc).join(','))];
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dental-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(t('w9.common.exportSuccess'));
  };

  const onDelete = (item: any) => {
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    message.success(t('w9.common.deleteSuccess'));
  };

  return (
    <DentalPageLayout
      header={{
        title: t('w9.dentalInv.title'),
        version: 'v3.0.6.11-103',
        tags: [
          fromSeed && <Tag key="src" color="orange">{t('w9.common.apiFallback')}</Tag>,
          <Tag key="lo" color="orange">{t('w9.dentalInv.lowCount')} {lowCount}</Tag>,
        ],
        extra: (
          <Space wrap>
            <ActionButton action="refresh" size="compact" loading={loading} onClick={() => void loadInventory()}>
              {t('w9.common.refresh')}
            </ActionButton>
            <ActionButton action="export" size="compact" disabled={filtered.length === 0} onClick={onExport}>
              {t('w9.common.export')}
            </ActionButton>
            <ActionButton action="create" size="compact" onClick={() => setModalOpen(true)}>
              {t('w9.dentalInv.create')}
            </ActionButton>
          </Space>
        ),
      }}
    >
      {loadError && <ErrorBanner message={loadError} onRetry={() => void loadInventory()} retryLabel={t('w9.states.retry')} />}
      <StatCardGrid style={{ marginBottom: 16 }}>
        <StatCard title={t('w9.common.statsStockTotal')} value={items.length} icon={<Package size={18} />} color="primary" />
        <StatCard title={t('w9.common.statsLowStock')} value={lowCount} icon={<AlertTriangle size={18} />} color="error" />
        <StatCard title={t('w9.common.statsWarningStock')} value={warnCount} icon={<AlertTriangle size={18} />} color="warning" />
        <StatCard title={t('w9.dentalInv.totalStock')} value={totalStock.toLocaleString('zh-CN')} suffix={t('w9.common.statsStockTotal')} icon={<Wallet size={18} />} color="success" />
      </StatCardGrid>

      <Space style={{ marginBottom: 12 }} wrap>
        <Input
          size="small"
          allowClear
          style={{ width: 240 }}
          placeholder={t('w9.common.filterPatient')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Tag color={fromSeed ? 'orange' : 'green'} style={{ marginInlineEnd: 0 }}>
          {filtered.length} / {items.length} · {t('w9.common.statsHealthyStock')} {healthyCount}
        </Tag>
      </Space>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>{t('w9.common.loading')}</div>
      ) : filtered.length === 0 ? (
        <EmptyState tip={t('w9.dentalInv.empty')} onCreate={() => setModalOpen(true)} createLabel={t('w9.dentalInv.create')} />
      ) : (
        <Table dataSource={pageData} rowKey="id" size="small" pagination={pagination} columns={[
          { title: 'ID', dataIndex: 'id', width: 110 },
          { title: t('w9.dentalInv.name'), dataIndex: 'name' },
          { title: t('w9.dentalInv.category'), dataIndex: 'category', render: (c: string) => <Tag>{c}</Tag> },
          { title: t('w9.dentalInv.stock'), dataIndex: 'stock', render: (n: number) => <b>{n}</b> },
          { title: t('w9.dentalInv.unit'), dataIndex: 'unit', render: (u: string) => unitLabel(u) },
          { title: t('w9.dentalInv.minStock'), dataIndex: 'minStock' },
          {
            title: t('w9.common.status'),
            render: (_, r: any) => r.stock < r.minStock
              ? <Tag color="red">{t('w9.common.lowStockTag')}</Tag>
              : r.stock < r.minStock * 1.5
                ? <Tag color="orange">{t('w9.common.warningTag')}</Tag>
                : <Tag color="green">{t('w9.common.enoughTag')}</Tag>,
          },
          {
            title: t('w9.common.actions'),
            width: 160,
            render: (_, r: any) => (
              <Space size={4}>
                <Button size="small" onClick={() => setDetail(r)}>{t('w9.dentalInv.detail')}</Button>
                <Popconfirm title={t('w9.common.deleteConfirm')} onConfirm={() => onDelete(r)}>
                  <ActionButton action="delete" size="compact">{t('w9.common.delete')}</ActionButton>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
          scroll={{ x: 'max-content' }} />
      )}

      <Modal title={t('w9.dentalInv.create')} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={onCreate} confirmLoading={creating} okText={t('w9.common.create')}>
        <Form form={form} layout="vertical">
          <Form.Item label={t('w9.dentalInv.name')} name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label={t('w9.dentalInv.category')} name="category">
              <Select options={CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))} />
          </Form.Item>
          <Form.Item label={t('w9.dentalInv.minStock')} name="minStock" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label={t('w9.dentalInv.unit')} name="unit">
              <Select options={Object.entries(UNIT_LABELS).map(([v, l]) => ({ value: v, label: t(l) }))} />
          </Form.Item>
        </Form>
      </Modal>
      {detail && (
        <Modal title={`${t('w9.dentalInv.detail')} - ${detail.name}`} open onCancel={() => setDetail(null)} footer={null}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
            <Descriptions.Item label={t('w9.dentalInv.name')}>{detail.name}</Descriptions.Item>
            <Descriptions.Item label={t('w9.dentalInv.category')}><Tag>{detail.category}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('w9.dentalInv.stock')}><b>{detail.stock}</b> {unitLabel(detail.unit)}</Descriptions.Item>
            <Descriptions.Item label={t('w9.dentalInv.minStock')}>{detail.minStock}</Descriptions.Item>
          </Descriptions>
          <Space style={{ marginTop: 12 }}>
            <Button onClick={() => onAdjust(1)}>{t('w9.dentalInv.inbound')}</Button>
            <Button danger onClick={() => onAdjust(-1)} disabled={detail.stock <= 0}>{t('w9.dentalInv.outbound')}</Button>
          </Space>
        </Modal>
      )}
    </DentalPageLayout>
  );
};

export default DentalInventoryPage;
