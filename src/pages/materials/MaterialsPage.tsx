// [v3.0.6.8-51] PR7: 眼料 (IOL 库存 + 接触镜库) 综合页面
import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Button, Select, Input, Form, Row, Col, message, Tabs, Statistic, Alert, InputNumber, Modal, Table, Switch } from 'antd';
import { Box, Eye, AlertTriangle, Calendar, Plus, Edit3, Trash2 } from 'lucide-react';
import { iolApi, contactLensApi } from '@/services/api/materialsApi';
// [G005 Wave1B] 单条 IOL 库存详情 (getIolInventoryById, GET /eye/iol/inventory/:id)
import { eyeApi } from '@/services/api/eyeApi';
// [G005 2B] 试戴患者选择: patientApi.list
import { patientApi } from '@/services/api/patientApi';
import { usePagination } from '@/hooks/usePagination';


const {  } = Input;

const IOL_TYPE_LABEL: Record<string, string> = {
  monofocal: '单焦',
  toric: '散光',
  multifocal: '多焦',
  edof: 'EDOF',
}

const IOL_STATUS_LABEL: Record<string, string> = { in_stock: '在库', reserved: '预留', implanted: '已植入', expired: '过期' }

export const MaterialsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('iol');
  // IOL
  const [iols, setIols] = useState<any[]>([]);
  const [iolModal, setIolModal] = useState<{ type: 'in' | 'out' | 'transfer' | 'adjust' | null; data: any }>({ type: null, data: {} });
  const [iolDetail, setIolDetail] = useState<{ open: boolean; data: any; loading: boolean }>({ open: false, data: null, loading: false });
  const [iolFilter, setIolFilter] = useState({ type: '', status: '' });
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [expiring, setExpiring] = useState<any[]>([]);

  // 接触镜
  const [lenses, setLenses] = useState<any[]>([]);
  const [lensModal, setLensModal] = useState<{ type: 'create' | 'update' | 'fitting' | null; data: any }>({ type: null, data: {} });
  const [lensFilter, setLensFilter] = useState({ type: '', brand: '' });

  // [G005 Wave1A P0] OK 镜设计 (POST /eye/optometry/ok-lens/design)
  const [okDesignModal, setOkDesignModal] = useState<{ open: boolean; data: any; submitting: boolean }>({ open: false, data: {}, submitting: false });
  // [G005 2B] 接触镜试戴患者列表 (写死 P000001 真实化)
  const [patientOptions, setPatientOptions] = useState<any[]>([]);

  // 加载
  const loadIols = async () => {
    try {
      const r = await iolApi.list({ pageSize: 50 });
      if (r.success) setIols(r.data);
      const ls = await iolApi.getLowStock();
      if (ls.success) setLowStock(ls.data);
      const ex = await iolApi.getExpiring(90);
      if (ex.success) setExpiring(ex.data);
    } catch (e: any) { message.error(e.message); }
  };

  const loadLenses = async () => {
    try {
      const r = await contactLensApi.list({ pageSize: 50 });
      if (r.success) setLenses(r.data);
    } catch (e: any) { message.error(e.message); }
  };

  useEffect(() => { loadIols(); loadLenses(); }, []);

  // [G005 2B] 加载患者列表供试戴选择 (patientApi.list 双形状: 裸数组 / { items, total })
  useEffect(() => {
    (async () => {
      try {
        const r = await patientApi.list({ pageSize: 50 });
        const raw = Array.isArray(r.data) ? r.data : (r.data as any)?.items ?? [];
        if (Array.isArray(raw)) {
          setPatientOptions(raw.map((p: any) => ({ value: p.id, label: `${p.name} (${p.id})` })));
        }
      } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
    })();
  }, []);

  // IOL 操作
  const handleIolInStock = async () => {
    if (!iolModal.data.barcode) { message.warning('请填写条码'); return; }
    try {
      const r = await iolApi.inStock(iolModal.data);
      if (r.success) { message.success('入库成功'); setIolModal({ type: null, data: {} }); loadIols(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleIolOutStock = async () => {
    if (!iolModal.data.id) return;
    try {
      const r = await iolApi.outStock(iolModal.data.id, { reason: iolModal.data.reason || 'implant' });
      if (r.success) { message.success('出库成功'); setIolModal({ type: null, data: {} }); loadIols(); }
    } catch (e: any) { message.error(e.message); }
  };

  // [G005 Wave1A P0] IOL 调拨 (POST /eye/iol/inventory/:id/transfer)
  const handleIolTransfer = async () => {
    if (!iolModal.data.id || !iolModal.data.toLocation) { message.warning('请填写目标库位'); return; }
    try {
      const r = await iolApi.transfer(iolModal.data.id, { fromLocation: iolModal.data.stockLocation || '', toLocation: iolModal.data.toLocation });
      if (r.success) { message.success('调拨成功'); setIolModal({ type: null, data: {} }); loadIols(); }
    } catch (e: any) { message.error(e.message); }
  };

  // [G005 Wave1A P0] IOL 库存调整 (POST /eye/iol/inventory/:id/adjust)
  const handleIolAdjust = async () => {
    if (!iolModal.data.id) return;
    const delta = Number(iolModal.data.deltaQty) || 0;
    if (delta === 0) { message.warning('请填写调整数量 (正数盘盈/负数盘亏)'); return; }
    try {
      const r = await iolApi.adjust(iolModal.data.id, { deltaQty: delta, reason: iolModal.data.adjustReason || '盘点' });
      if (r.success) { message.success('库存调整成功'); setIolModal({ type: null, data: {} }); loadIols(); }
    } catch (e: any) { message.error(e.message); }
  };

  // [G005 Wave1B] 单条 IOL 详情: eyeApi.getIolInventoryById (GET /eye/iol/inventory/:id), 失败回退行数据
  const handleIolDetail = async (row: any) => {
    setIolDetail({ open: true, data: row, loading: true });
    try {
      const r = await eyeApi.getIolInventoryById(row.id);
      if (r.success && r.data) setIolDetail({ open: true, data: r.data, loading: false });
      else setIolDetail({ open: true, data: row, loading: false });
    } catch {
      setIolDetail({ open: true, data: row, loading: false });
    }
  };

  // [G005 Wave1A P0] OK 镜设计 (POST /eye/optometry/ok-lens/design)
  const handleOkDesign = async () => {
    setOkDesignModal(prev => ({ ...prev, submitting: true }));
    try {
      const r = await contactLensApi.okLensDesign({
        patientId: okDesignModal.data.patientId,
        k1: Number(okDesignModal.data.k1) || 42,
        k2: Number(okDesignModal.data.k2) || 42,
        kAxis: Number(okDesignModal.data.kAxis) || 0,
        targetReduction: Number(okDesignModal.data.targetReduction) || 3,
        brand: okDesignModal.data.brand,
      });
      if (r.success) {
        message.success(`OK 镜设计完成: BC ${r.data.baseCurve} / 直径 ${r.data.diameter} / 反转弧 ${r.data.returnZone}`);
        setOkDesignModal({ open: false, data: {}, submitting: false });
      } else {
        message.error(r.error?.message ?? 'OK 镜设计失败');
        setOkDesignModal(prev => ({ ...prev, submitting: false }));
      }
    } catch (e: any) {
      message.error(e.message ?? 'OK 镜设计失败');
      setOkDesignModal(prev => ({ ...prev, submitting: false }));
    }
  };

  // 接触镜
  const handleLensSave = async () => {
    if (!lensModal.data.brand || !lensModal.data.bc) { message.warning('请填写品牌和基弧'); return; }
    try {
      let r;
      if (lensModal.type === 'create') r = await contactLensApi.create(lensModal.data);
      else r = await contactLensApi.update(lensModal.data.id, lensModal.data);
      if (r.success) { message.success('保存成功'); setLensModal({ type: null, data: {} }); loadLenses(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleLensDelete = async (id: string) => {
    try {
      const r = await contactLensApi.delete(id);
      if (r.success) { message.success('删除成功'); loadLenses(); }
    } catch (e: any) { message.error(e.message); }
  };

  const filteredIols = iols.filter((i: any) => {
    if (iolFilter.type && i.type !== iolFilter.type) return false;
    if (iolFilter.status && i.status !== iolFilter.status) return false;
    return true;
  });

  const filteredLenses = lenses.filter((l: any) => {
    if (lensFilter.type && l.type !== lensFilter.type) return false;
    if (lensFilter.brand && l.brand !== lensFilter.brand) return false;
    return true;
  });
  // [W3-C] 受控分页: IOL 库存表 + 接触镜表 (基于过滤结果)
  const iolPagination = usePagination(filteredIols, 10);
  const lensPagination = usePagination(filteredLenses, 10);

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Box size={20} color="#2563eb" />
        <Eye size={20} color="#52c41a" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>眼料管理 (IOL 库存 + 接触镜库)</span>
        <Tag color="cyan">PR7 (v3.0.6.8-51)</Tag>
        <Tag color="purple">B 方向</Tag>
        <Tag color="green">15 client + 15 端点</Tag>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="IOL 总数" value={iols.length} styles={{ content: {  color: '#2563eb'  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="低库存" value={lowStock.length} styles={{ content: {  color: '#faad14'  } }} prefix={<AlertTriangle size={14} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="即将过期" value={expiring.length} styles={{ content: {  color: '#ff4d4f'  } }} prefix={<Calendar size={14} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="接触镜 SKU" value={lenses.length} /></Card></Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        {/* IOL 库存 */}
        <Tabs.TabPane tab={<span><Box size={14} /> IOL 库存 (8 端点)</span>} key="iol">
          <Card
            title="人工晶体 (IOL) 库存"
            size="small"
            extra={
              <Space>
                <Select size="small" value={iolFilter.type || undefined} onChange={v => setIolFilter({ ...iolFilter, type: v })} allowClear placeholder="类型" style={{ width: 100 }} options={[
                  { value: 'monofocal', label: '单焦' },
                  { value: 'toric', label: 'Toric 散光' },
                  { value: 'multifocal', label: '多焦' },
                  { value: 'edof', label: 'EDOF 连续视程' },
                ]} />
                <Select size="small" value={iolFilter.status || undefined} onChange={v => setIolFilter({ ...iolFilter, status: v })} allowClear placeholder="状态" style={{ width: 100 }} options={[
                  { value: 'in_stock', label: '在库' },
                  { value: 'reserved', label: '预留' },
                  { value: 'implanted', label: '已植入' },
                  { value: 'expired', label: '过期' },
                ]} />
                <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setIolModal({ type: 'in', data: { type: 'monofocal' } })}>入库</Button>
              </Space>
            }
          >
            <Table
              size="small"
              dataSource={iolPagination.pageData}
              rowKey="id"
              pagination={iolPagination.pagination}
              columns={[
                { title: '条码', dataIndex: 'barcode' },
                { title: '型号', dataIndex: 'model' },
                { title: '类型', dataIndex: 'type', render: (t) => <Tag color={t === 'toric' ? 'orange' : t === 'multifocal' ? 'purple' : 'blue'}>{IOL_TYPE_LABEL[t] ?? t}</Tag> },
                { title: '度数', dataIndex: 'power', render: (p) => p + ' D' },
                { title: '散光', dataIndex: 'cylinder', render: (c) => c ? c + ' D' : '-' },
                { title: '批号', dataIndex: 'batchNumber' },
                { title: '位置', dataIndex: 'stockLocation' },
                { title: '状态', dataIndex: 'status', render: (s) => <Tag color={s === 'in_stock' ? 'green' : s === 'expired' ? 'red' : 'orange'}>{IOL_STATUS_LABEL[s] ?? s}</Tag> },
                { title: '价格', dataIndex: 'unitPrice', render: (p) => '¥' + p },
                {
                  title: '操作',
                  render: (_, i) => (
                    <Space size={0}>
                      <Button type="link" size="small" onClick={() => void handleIolDetail(i)}>详情</Button>
                      <Button type="link" size="small" onClick={() => setIolModal({ type: 'out', data: { ...i, reason: '手术植入' } })}>出库</Button>
                      <Button type="link" size="small" onClick={() => setIolModal({ type: 'transfer', data: { ...i } })}>调拨</Button>
                      <Button type="link" size="small" onClick={() => setIolModal({ type: 'adjust', data: { ...i } })}>调整</Button>
                    </Space>
                  ),
                },
              ]}
            scroll={{ x: 'max-content' }}
            />
          </Card>

          {/* 低库存告警 */}
          {lowStock.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 16 }}
              title={`低库存告警: ${lowStock.length} 项需要补货`}
              description={lowStock.map(i => `${i.model} (${i.power}D) @ ${i.stockLocation}`).join('; ')}
            />
          )}
          {expiring.length > 0 && (
            <Alert
              type="error"
              showIcon
              style={{ marginTop: 8 }}
              title={`即将过期告警: ${expiring.length} 项 90 天内到期`}
              description={expiring.map(i => `${i.model} (${i.batchNumber}) 到期: ${i.expiryDate?.slice(0, 10)}`).join('; ')}
            />
          )}
        </Tabs.TabPane>

        {/* 接触镜库 */}
        <Tabs.TabPane tab={<span><Eye size={14} /> 接触镜库 (7 端点)</span>} key="lens">
          <Card
            title="接触镜 / OK 镜 库存"
            size="small"
            extra={
              <Space>
                <Select size="small" value={lensFilter.type || undefined} onChange={v => setLensFilter({ ...lensFilter, type: v })} allowClear placeholder="类型" style={{ width: 110 }} options={[
                  { value: 'RGP', label: 'RGP 硬性' },
                  { value: 'Scleral', label: '巩膜镜' },
                  { value: 'Soft', label: '软性' },
                  { value: 'OK', label: 'OK 角膜塑形' },
                  { value: 'Hybrid', label: '混合' },
                ]} />
                <Input.Search size="small" placeholder="品牌" value={lensFilter.brand} onChange={e => setLensFilter({ ...lensFilter, brand: e.target.value })} style={{ width: 140 }} />
                <Button size="small" icon={<Edit3 size={12} />} onClick={() => setOkDesignModal({ open: true, data: {}, submitting: false })}>OK 镜设计</Button>
                <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setLensModal({ type: 'create', data: { type: 'RGP', stock: 0, trialLens: false } })}>新增</Button>
              </Space>
            }
          >
            <Table
              size="small"
              dataSource={lensPagination.pageData}
              rowKey="id"
              pagination={lensPagination.pagination}
              columns={[
                { title: '品牌', dataIndex: 'brand' },
                { title: '类型', dataIndex: 'type', render: (t) => <Tag color={t === 'OK' ? 'magenta' : t === 'RGP' ? 'blue' : 'green'}>{t}</Tag> },
                { title: '系列', dataIndex: 'series' },
                { title: 'BC', dataIndex: 'bc' },
                { title: 'DIA', dataIndex: 'dia' },
                { title: '度数', dataIndex: 'power', render: (p) => p + ' D' },
                { title: '库存', dataIndex: 'stock', render: (s) => <Tag color={s < 5 ? 'red' : 'green'}>{s}</Tag> },
                { title: '价格', dataIndex: 'unitPrice', render: (p) => '¥' + p },
                {
                  title: '操作',
                  render: (_, l) => (
                    <Space>
                      <Button type="link" size="small" icon={<Edit3 size={12} />} onClick={() => setLensModal({ type: 'update', data: { ...l } })}>编辑</Button>
                      <Button type="link" size="small" onClick={() => setLensModal({ type: 'fitting', data: { id: l.id, patientId: 'P000001' } })}>试戴</Button>
                      <Button type="link" danger size="small" icon={<Trash2 size={12} />} onClick={() => handleLensDelete(l.id)}>删</Button>
                    </Space>
                  ),
                },
              ]}
            scroll={{ x: 'max-content' }}
            />
          </Card>
        </Tabs.TabPane>
      </Tabs>

      {/* IOL 入库/出库/调拨/调整 Modal */}
      <Modal
        title={iolModal.type === 'in' ? 'IOL 入库' : iolModal.type === 'out' ? 'IOL 出库' : iolModal.type === 'transfer' ? 'IOL 调拨' : 'IOL 库存调整'}
        open={!!iolModal.type}
        onCancel={() => setIolModal({ type: null, data: {} })}
        onOk={iolModal.type === 'in' ? handleIolInStock : iolModal.type === 'out' ? handleIolOutStock : iolModal.type === 'transfer' ? handleIolTransfer : handleIolAdjust}
        width={500}
      >
        {iolModal.type === 'in' ? (
          <Form layout="vertical" size="small">
            <Row gutter={8}>
              <Col span={12}><Form.Item label="条码"><Input value={iolModal.data.barcode} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, barcode: e.target.value } })} /></Form.Item></Col>
              <Col span={12}><Form.Item label="型号"><Input value={iolModal.data.model} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, model: e.target.value } })} placeholder="SA60AT" /></Form.Item></Col>
              <Col span={12}><Form.Item label="类型"><Select value={iolModal.data.type} onChange={v => setIolModal({ ...iolModal, data: { ...iolModal.data, type: v } })} options={['monofocal','toric','multifocal','edof'].map(t => ({value:t,label:IOL_TYPE_LABEL[t] ?? t}))} /></Form.Item></Col>
              <Col span={12}><Form.Item label="度数 (D)"><InputNumber value={iolModal.data.power} onChange={v => setIolModal({ ...iolModal, data: { ...iolModal.data, power: v } })} step={0.5} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item label="散光 (D, Toric用)"><InputNumber value={iolModal.data.cylinder} onChange={v => setIolModal({ ...iolModal, data: { ...iolModal.data, cylinder: v } })} step={0.25} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item label="供应商"><Input value={iolModal.data.supplier} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, supplier: e.target.value } })} placeholder="Alcon" /></Form.Item></Col>
              <Col span={12}><Form.Item label="批号"><Input value={iolModal.data.batchNumber} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, batchNumber: e.target.value } })} /></Form.Item></Col>
              <Col span={12}><Form.Item label="库位"><Input value={iolModal.data.stockLocation} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, stockLocation: e.target.value } })} placeholder="A-01" /></Form.Item></Col>
              <Col span={12}><Form.Item label="有效期"><Input type="date" onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, expiryDate: e.target.value } })} /></Form.Item></Col>
              <Col span={12}><Form.Item label="单价 (¥)"><InputNumber value={iolModal.data.unitPrice} onChange={v => setIolModal({ ...iolModal, data: { ...iolModal.data, unitPrice: v } })} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          </Form>
        ) : iolModal.type === 'transfer' ? (
          <div>
            <Alert title={`调拨: ${iolModal.data.model} (${iolModal.data.power}D)`} type="info" showIcon style={{ marginBottom: 8 }} />
            <Form.Item label="当前库位"><Input value={iolModal.data.stockLocation} disabled /></Form.Item>
            <Form.Item label="目标库位"><Input value={iolModal.data.toLocation} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, toLocation: e.target.value } })} placeholder="如: B-03" /></Form.Item>
          </div>
        ) : iolModal.type === 'adjust' ? (
          <div>
            <Alert title={`库存调整: ${iolModal.data.model} (${iolModal.data.power}D) @ ${iolModal.data.stockLocation}`} type="info" showIcon style={{ marginBottom: 8 }} />
            <Form.Item label="调整数量 (正数盘盈 / 负数盘亏)"><InputNumber value={iolModal.data.deltaQty} onChange={v => setIolModal({ ...iolModal, data: { ...iolModal.data, deltaQty: v } })} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label="调整原因"><Input value={iolModal.data.adjustReason} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, adjustReason: e.target.value } })} placeholder="盘点 / 报损 / 校准" /></Form.Item>
          </div>
        ) : (
          <div>
            <Alert title={`出库: ${iolModal.data.model} (${iolModal.data.power}D) @ ${iolModal.data.stockLocation}`} type="info" showIcon style={{ marginBottom: 8 }} />
            <Form.Item label="出库原因"><Input value={iolModal.data.reason} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, reason: e.target.value } })} placeholder="手术植入 / 报损 / 调拨" /></Form.Item>
            <Form.Item label="患者 ID (可选)"><Input value={iolModal.data.patientId} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, patientId: e.target.value } })} placeholder="P000001" /></Form.Item>
            <Form.Item label="术者 (可选)"><Input value={iolModal.data.surgeon} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, surgeon: e.target.value } })} placeholder="D001" /></Form.Item>
          </div>
        )}
      </Modal>

      {/* [G005 Wave1B] IOL 单条详情 Modal (eyeApi.getIolInventoryById) */}
      <Modal
        title={`IOL 详情: ${iolDetail.data?.model ?? ''} (${iolDetail.data?.power ?? ''}D)`}
        open={iolDetail.open}
        onCancel={() => setIolDetail({ open: false, data: null, loading: false })}
        footer={<Button onClick={() => setIolDetail({ open: false, data: null, loading: false })}>关闭</Button>}
        width={480}
      >
        {iolDetail.loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>加载中...</div>
        ) : iolDetail.data ? (
          <Row gutter={[8, 8]}>
            {[
              ['条码', iolDetail.data.barcode],
              ['型号', iolDetail.data.model],
              ['类型', iolDetail.data.type],
              ['度数', iolDetail.data.power ? iolDetail.data.power + ' D' : '-'],
              ['散光', iolDetail.data.cylinder ? iolDetail.data.cylinder + ' D' : '-'],
              ['批号', iolDetail.data.batchNumber],
              ['库位', iolDetail.data.stockLocation],
              ['状态', iolDetail.data.status],
              ['供应商', iolDetail.data.supplier],
              ['单价', iolDetail.data.unitPrice ? '¥' + iolDetail.data.unitPrice : '-'],
              ['有效期', iolDetail.data.expiryDate ? String(iolDetail.data.expiryDate).slice(0, 10) : '-'],
              ['创建时间', iolDetail.data.createdAt ? String(iolDetail.data.createdAt).slice(0, 10) : '-'],
            ].map(([label, value]) => (
              <Col span={12} key={String(label)}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
                <div style={{ fontWeight: 600 }}>{value ?? '-'}</div>
              </Col>
            ))}
          </Row>
        ) : null}
      </Modal>

      {/* 接触镜 Modal */}
      <Modal
        title={lensModal.type === 'create' ? '新增接触镜' : lensModal.type === 'update' ? '编辑接触镜' : '接触镜试戴'}
        open={!!lensModal.type}
        onCancel={() => setLensModal({ type: null, data: {} })}
        onOk={lensModal.type === 'fitting' ? undefined : handleLensSave}
        footer={lensModal.type === 'fitting' ? null : undefined}
        width={500}
      >
        {lensModal.type === 'fitting' ? (
          <div>
            <Alert title="试戴镜片: " type="info" showIcon style={{ marginBottom: 8 }} description={`${lensModal.data.id} (${lensModal.data.brand} ${lensModal.data.series})`} />
            <Form.Item label="患者" required>
              {patientOptions.length > 0 ? (
                <Select
                  value={lensModal.data.patientId}
                  onChange={v => setLensModal({ ...lensModal, data: { ...lensModal.data, patientId: v } })}
                  options={patientOptions}
                  placeholder="选择患者"
                  showSearch
                  optionFilterProp="label"
                />
              ) : (
                <Input value={lensModal.data.patientId} onChange={e => setLensModal({ ...lensModal, data: { ...lensModal.data, patientId: e.target.value } })} />
              )}
            </Form.Item>
            <Button type="primary" block onClick={async () => {
              try {
                const r = await contactLensApi.fitting(lensModal.data.id, { patientId: lensModal.data.patientId, fittingData: { trial: true } });
                if (r.success) message.success('试戴成功: ' + r.data.result);
              } catch (e: any) { message.error(e.message); }
            }}>记录试戴</Button>
          </div>
        ) : (
          <Form layout="vertical" size="small">
            <Row gutter={8}>
              <Col span={12}><Form.Item label="品牌"><Input value={lensModal.data.brand} onChange={e => setLensModal({ ...lensModal, data: { ...lensModal.data, brand: e.target.value } })} /></Form.Item></Col>
              <Col span={12}><Form.Item label="类型"><Select value={lensModal.data.type} onChange={v => setLensModal({ ...lensModal, data: { ...lensModal.data, type: v } })} options={['RGP','Scleral','Soft','OK','Hybrid'].map(t => ({value:t,label:t}))} /></Form.Item></Col>
              <Col span={12}><Form.Item label="系列"><Input value={lensModal.data.series} onChange={e => setLensModal({ ...lensModal, data: { ...lensModal.data, series: e.target.value } })} /></Form.Item></Col>
              <Col span={12}><Form.Item label="供应商"><Input value={lensModal.data.supplier} onChange={e => setLensModal({ ...lensModal, data: { ...lensModal.data, supplier: e.target.value } })} /></Form.Item></Col>
              <Col span={8}><Form.Item label="BC (mm)"><InputNumber value={lensModal.data.bc} onChange={v => setLensModal({ ...lensModal, data: { ...lensModal.data, bc: v } })} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item label="DIA (mm)"><InputNumber value={lensModal.data.dia} onChange={v => setLensModal({ ...lensModal, data: { ...lensModal.data, dia: v } })} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item label="度数 (D)"><InputNumber value={lensModal.data.power} onChange={v => setLensModal({ ...lensModal, data: { ...lensModal.data, power: v } })} step={0.25} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item label="库存"><InputNumber value={lensModal.data.stock} onChange={v => setLensModal({ ...lensModal, data: { ...lensModal.data, stock: v } })} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item label="价格 (¥)"><InputNumber value={lensModal.data.unitPrice} onChange={v => setLensModal({ ...lensModal, data: { ...lensModal.data, unitPrice: v } })} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item label="试戴片"><Switch checked={lensModal.data.trialLens} onChange={v => setLensModal({ ...lensModal, data: { ...lensModal.data, trialLens: v } })} /></Form.Item></Col>
            </Row>
          </Form>
        )}
      </Modal>

      {/* [G005 Wave1A P0] OK 镜设计 Modal (POST /eye/optometry/ok-lens/design) */}
      <Modal
        title="OK 镜 (角膜塑形镜) 设计"
        open={okDesignModal.open}
        onCancel={() => setOkDesignModal({ open: false, data: {}, submitting: false })}
        onOk={() => void handleOkDesign()}
        okText="生成设计"
        cancelText="取消"
        confirmLoading={okDesignModal.submitting}
        width={460}
      >
        <Form layout="vertical" size="small">
          <Form.Item label="患者 ID" required><Input value={okDesignModal.data.patientId} onChange={e => setOkDesignModal({ ...okDesignModal, data: { ...okDesignModal.data, patientId: e.target.value } })} placeholder="P000001" /></Form.Item>
          <Row gutter={8}>
            <Col span={8}><Form.Item label="K1 (D)"><InputNumber value={okDesignModal.data.k1} onChange={v => setOkDesignModal({ ...okDesignModal, data: { ...okDesignModal.data, k1: v } })} defaultValue={42} step={0.25} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item label="K2 (D)"><InputNumber value={okDesignModal.data.k2} onChange={v => setOkDesignModal({ ...okDesignModal, data: { ...okDesignModal.data, k2: v } })} defaultValue={42} step={0.25} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item label="K 轴位"><InputNumber value={okDesignModal.data.kAxis} onChange={v => setOkDesignModal({ ...okDesignModal, data: { ...okDesignModal.data, kAxis: v } })} defaultValue={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={8}>
            <Col span={12}><Form.Item label="目标降幅 (D)"><InputNumber value={okDesignModal.data.targetReduction} onChange={v => setOkDesignModal({ ...okDesignModal, data: { ...okDesignModal.data, targetReduction: v } })} defaultValue={3} step={0.25} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item label="品牌"><Select value={okDesignModal.data.brand} onChange={v => setOkDesignModal({ ...okDesignModal, data: { ...okDesignModal.data, brand: v } })} allowClear options={['CRT', 'DreamLens', 'Euclid'].map(b => ({ value: b, label: b }))} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default MaterialsPage;
