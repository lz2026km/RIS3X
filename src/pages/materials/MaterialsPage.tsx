// [v3.0.6.8-51] PR7: 眼料 (IOL 库存 + 接触镜库) 综合页面
import React, { useState, useEffect } from 'react';
import {
  Card,
  Space,
  Tag,
  Button,
  Select,
  Input,
  Form,
  Row,
  Col,
  message,
  Tabs,
  Alert,
  InputNumber,
  Modal,
  Switch,
} from "antd";
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";
import { Box, Eye, AlertTriangle, Calendar, Plus, Edit3, Trash2 } from 'lucide-react';
import { iolApi, contactLensApi } from '@/services/api/materialsApi';
// [G005 Wave1B] 单条 IOL 库存详情 (getIolInventoryById, GET /eye/iol/inventory/:id)
import { eyeApi } from '@/services/api/eyeApi';
// [G005 2B] 试戴患者选择: patientApi.list
import { patientApi } from '@/services/api/patientApi';
import { usePagination } from '@/hooks/usePagination';
import { t } from '../../i18n/appI18n';


const {  } = Input;

const IOL_TYPE_LABEL: Record<string, string> = {
  monofocal: t('materialsPage.typeMonofocal'),
  toric: t('materialsPage.typeAstigmatism'),
  multifocal: t('materialsPage.typeMultifocal'),
  edof: 'EDOF',
}

const IOL_STATUS_LABEL: Record<string, string> = { in_stock: t('materialsPage.statusInStock'), reserved: t('materialsPage.statusReserved'), implanted: t('materialsPage.statusImplanted'), expired: t('materialsPage.statusExpired') }

// [G005 Wave5] 接触镜类型中文化 (RGP/Scleral/Soft/OK/Hybrid)
const LENS_TYPE_LABEL: Record<string, string> = {
  RGP: t('materialsPage.lensTypeRgp'),
  Scleral: t('materialsPage.lensTypeScleral'),
  Soft: t('materialsPage.lensTypeSoft'),
  OK: t('materialsPage.lensTypeOk'),
  Hybrid: t('materialsPage.lensTypeHybrid'),
}

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
    if (!iolModal.data.barcode) { message.warning(t('materialsPage.msgBarcodeRequired')); return; }
    try {
      const r = await iolApi.inStock(iolModal.data);
      if (r.success) { message.success(t('materialsPage.msgInStockSuccess')); setIolModal({ type: null, data: {} }); loadIols(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleIolOutStock = async () => {
    if (!iolModal.data.id) return;
    try {
      const r = await iolApi.outStock(iolModal.data.id, { reason: iolModal.data.reason || 'implant' });
      if (r.success) { message.success(t('materialsPage.msgOutStockSuccess')); setIolModal({ type: null, data: {} }); loadIols(); }
    } catch (e: any) { message.error(e.message); }
  };

  // [G005 Wave1A P0] IOL 调拨 (POST /eye/iol/inventory/:id/transfer)
  const handleIolTransfer = async () => {
    if (!iolModal.data.id || !iolModal.data.toLocation) { message.warning(t('materialsPage.msgTargetLocationRequired')); return; }
    try {
      const r = await iolApi.transfer(iolModal.data.id, { fromLocation: iolModal.data.stockLocation || '', toLocation: iolModal.data.toLocation });
      if (r.success) { message.success(t('materialsPage.msgTransferSuccess')); setIolModal({ type: null, data: {} }); loadIols(); }
    } catch (e: any) { message.error(e.message); }
  };

  // [G005 Wave1A P0] IOL 库存调整 (POST /eye/iol/inventory/:id/adjust)
  const handleIolAdjust = async () => {
    if (!iolModal.data.id) return;
    const delta = Number(iolModal.data.deltaQty) || 0;
    if (delta === 0) { message.warning(t('materialsPage.msgAdjustQtyRequired')); return; }
    try {
      const r = await iolApi.adjust(iolModal.data.id, { deltaQty: delta, reason: iolModal.data.adjustReason || '盘点' });
      if (r.success) { message.success(t('materialsPage.msgAdjustSuccess')); setIolModal({ type: null, data: {} }); loadIols(); }
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
        message.error(r.error?.message ?? t('materialsPage.msgOkDesignFail'));
        setOkDesignModal(prev => ({ ...prev, submitting: false }));
      }
    } catch (e: any) {
      message.error(e.message ?? t('materialsPage.msgOkDesignFail'));
      setOkDesignModal(prev => ({ ...prev, submitting: false }));
    }
  };

  // 接触镜
  const handleLensSave = async () => {
    if (!lensModal.data.brand || !lensModal.data.bc) { message.warning(t('materialsPage.msgBrandBcRequired')); return; }
    try {
      let r;
      if (lensModal.type === 'create') r = await contactLensApi.create(lensModal.data);
      else r = await contactLensApi.update(lensModal.data.id, lensModal.data);
      if (r.success) { message.success(t('materialsPage.msgSaveSuccess')); setLensModal({ type: null, data: {} }); loadLenses(); }
    } catch (e: any) { message.error(e.message); }
  };

  const handleLensDelete = async (id: string) => {
    try {
      const r = await contactLensApi.delete(id);
      if (r.success) { message.success(t('materialsPage.msgDeleteSuccess')); loadLenses(); }
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
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }}>
        <Box size={20} color="#2563eb" />
        <Eye size={20} color="#52c41a" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('materialsPage.title')}</span>
        <Tag color="cyan">PR7 (v3.0.6.8-51)</Tag>
        <Tag color="purple">{t('materialsPage.directionB')}</Tag>
        <Tag color="green">{t('materialsPage.clientsEndpoints')}</Tag>
      </Space>

      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('materialsPage.iolTotal')} value={iols.length} color="primary" />
        <StatCard title={t('materialsPage.lowStock')} value={lowStock.length} icon={<AlertTriangle size={14} />} color="warning" />
        <StatCard title={t('materialsPage.expiringSoon')} value={expiring.length} icon={<Calendar size={14} />} color="error" />
        <StatCard title={t('materialsPage.lensSku')} value={lenses.length} />
      </StatCardGrid>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        {/* IOL 库存 */}
        <Tabs.TabPane tab={<span><Box size={14} /> {t('materialsPage.iolTab')}</span>} key="iol">
          <Card
            title={t('materialsPage.iolCard')}
            size="small"
            extra={
              <Space>
                <Select size="small" value={iolFilter.type || undefined} onChange={v => setIolFilter({ ...iolFilter, type: v })} allowClear placeholder={t('materialsPage.type')} style={{ width: 100 }} options={[
                  { value: 'monofocal', label: t('materialsPage.typeMonofocal') },
                  { value: 'toric', label: t('materialsPage.typeToricOption') },
                  { value: 'multifocal', label: t('materialsPage.typeMultifocal') },
                  { value: 'edof', label: t('materialsPage.typeEdofOption') },
                ]} />
                <Select size="small" value={iolFilter.status || undefined} onChange={v => setIolFilter({ ...iolFilter, status: v })} allowClear placeholder={t('materialsPage.status')} style={{ width: 100 }} options={[
                  { value: 'in_stock', label: t('materialsPage.statusInStock') },
                  { value: 'reserved', label: t('materialsPage.statusReserved') },
                  { value: 'implanted', label: t('materialsPage.statusImplanted') },
                  { value: 'expired', label: t('materialsPage.statusExpired') },
                ]} />
                <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setIolModal({ type: 'in', data: { type: 'monofocal' } })}>{t('materialsPage.inStock')}</Button>
              </Space>
            }
          >
            <DataTable
              dataSource={iolPagination.pageData}
              rowKey="id"
              pagination={iolPagination.pagination}
              columns={[
                { title: t('materialsPage.barcode'), dataIndex: 'barcode' },
                { title: t('materialsPage.model'), dataIndex: 'model' },
                { title: t('materialsPage.type'), dataIndex: 'type', render: (ty) => <Tag color={ty === 'toric' ? 'orange' : ty === 'multifocal' ? 'purple' : 'blue'}>{IOL_TYPE_LABEL[ty] ?? ty}</Tag> },
                { title: t('materialsPage.power'), dataIndex: 'power', render: (p) => p + ' D' },
                { title: t('materialsPage.cylinder'), dataIndex: 'cylinder', render: (c) => c ? c + ' D' : '-' },
                { title: t('materialsPage.batchNumber'), dataIndex: 'batchNumber' },
                { title: t('materialsPage.location'), dataIndex: 'stockLocation' },
                { title: t('materialsPage.status'), dataIndex: 'status', render: (s) => <Tag color={s === 'in_stock' ? 'green' : s === 'expired' ? 'red' : 'orange'}>{IOL_STATUS_LABEL[s] ?? s}</Tag> },
                { title: t('materialsPage.price'), dataIndex: 'unitPrice', render: (p) => '¥' + p },
                {
                  title: t('materialsPage.actions'),
                  render: (_, i) => (
                    <Space size={0}>
                      <Button type="link" size="small" onClick={() => void handleIolDetail(i)}>{t('materialsPage.detail')}</Button>
                      <Button type="link" size="small" onClick={() => setIolModal({ type: 'out', data: { ...i, reason: '手术植入' } })}>{t('materialsPage.outStock')}</Button>
                      <Button type="link" size="small" onClick={() => setIolModal({ type: 'transfer', data: { ...i } })}>{t('materialsPage.transfer')}</Button>
                      <Button type="link" size="small" onClick={() => setIolModal({ type: 'adjust', data: { ...i } })}>{t('materialsPage.adjust')}</Button>
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
        <Tabs.TabPane tab={<span><Eye size={14} /> {t('materialsPage.lensTab')}</span>} key="lens">
          <Card
            title={t('materialsPage.lensCard')}
            size="small"
            extra={
              <Space>
                <Select size="small" value={lensFilter.type || undefined} onChange={v => setLensFilter({ ...lensFilter, type: v })} allowClear placeholder={t('materialsPage.type')} style={{ width: 110 }} options={[
                  { value: 'RGP', label: t('materialsPage.lensTypeRgpOption') },
                  { value: 'Scleral', label: t('materialsPage.lensTypeScleral') },
                  { value: 'Soft', label: t('materialsPage.lensTypeSoftOption') },
                  { value: 'OK', label: t('materialsPage.lensTypeOkOption') },
                  { value: 'Hybrid', label: t('materialsPage.lensTypeHybridOption') },
                ]} />
                <Input.Search size="small" placeholder={t('materialsPage.brand')} value={lensFilter.brand} onChange={e => setLensFilter({ ...lensFilter, brand: e.target.value })} style={{ width: 140 }} />
                <Button size="small" icon={<Edit3 size={12} />} onClick={() => setOkDesignModal({ open: true, data: {}, submitting: false })}>{t('materialsPage.okDesign')}</Button>
                <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setLensModal({ type: 'create', data: { type: 'RGP', stock: 0, trialLens: false } })}>{t('materialsPage.add')}</Button>
              </Space>
            }
          >
            <DataTable
              dataSource={lensPagination.pageData}
              rowKey="id"
              pagination={lensPagination.pagination}
              columns={[
                { title: t('materialsPage.brand'), dataIndex: 'brand' },
                { title: t('materialsPage.type'), dataIndex: 'type', render: (ty) => <Tag color={ty === 'OK' ? 'magenta' : ty === 'RGP' ? 'blue' : 'green'}>{LENS_TYPE_LABEL[ty] ?? ty}</Tag> },
                { title: t('materialsPage.series'), dataIndex: 'series' },
                { title: 'BC', dataIndex: 'bc' },
                { title: 'DIA', dataIndex: 'dia' },
                { title: t('materialsPage.power'), dataIndex: 'power', render: (p) => p + ' D' },
                { title: t('materialsPage.stock'), dataIndex: 'stock', render: (s) => <Tag color={s < 5 ? 'red' : 'green'}>{s}</Tag> },
                { title: t('materialsPage.price'), dataIndex: 'unitPrice', render: (p) => '¥' + p },
                {
                  title: t('materialsPage.actions'),
                  render: (_, l) => (
                    <Space>
                      <Button type="link" size="small" icon={<Edit3 size={12} />} onClick={() => setLensModal({ type: 'update', data: { ...l } })}>{t('materialsPage.edit')}</Button>
                      <Button type="link" size="small" onClick={() => setLensModal({ type: 'fitting', data: { id: l.id, patientId: patientOptions[0]?.value ?? '' } })}>{t('materialsPage.fitting')}</Button>
                      <Button type="link" danger size="small" icon={<Trash2 size={12} />} onClick={() => handleLensDelete(l.id)}>{t('materialsPage.delete')}</Button>
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
        title={iolModal.type === 'in' ? t('materialsPage.iolInStock') : iolModal.type === 'out' ? t('materialsPage.iolOutStock') : iolModal.type === 'transfer' ? t('materialsPage.iolTransfer') : t('materialsPage.iolAdjust')}
        open={!!iolModal.type}
        onCancel={() => setIolModal({ type: null, data: {} })}
        onOk={iolModal.type === 'in' ? handleIolInStock : iolModal.type === 'out' ? handleIolOutStock : iolModal.type === 'transfer' ? handleIolTransfer : handleIolAdjust}
        width={500}
      >
        {iolModal.type === 'in' ? (
          <Form layout="vertical" size="small">
            <Row gutter={8}>
              <Col span={12}><Form.Item label={t('materialsPage.barcode')}><Input value={iolModal.data.barcode} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, barcode: e.target.value } })} /></Form.Item></Col>
              <Col span={12}><Form.Item label={t('materialsPage.model')}><Input value={iolModal.data.model} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, model: e.target.value } })} placeholder="SA60AT" /></Form.Item></Col>
              <Col span={12}><Form.Item label={t('materialsPage.type')}><Select value={iolModal.data.type} onChange={v => setIolModal({ ...iolModal, data: { ...iolModal.data, type: v } })} options={['monofocal','toric','multifocal','edof'].map(ty => ({value:ty,label:IOL_TYPE_LABEL[ty] ?? ty}))} /></Form.Item></Col>
              <Col span={12}><Form.Item label={t('materialsPage.powerD')}><InputNumber value={iolModal.data.power} onChange={v => setIolModal({ ...iolModal, data: { ...iolModal.data, power: v } })} step={0.5} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item label={t('materialsPage.cylinderD')}><InputNumber value={iolModal.data.cylinder} onChange={v => setIolModal({ ...iolModal, data: { ...iolModal.data, cylinder: v } })} step={0.25} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item label={t('materialsPage.supplier')}><Input value={iolModal.data.supplier} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, supplier: e.target.value } })} placeholder="Alcon" /></Form.Item></Col>
              <Col span={12}><Form.Item label={t('materialsPage.batchNumber')}><Input value={iolModal.data.batchNumber} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, batchNumber: e.target.value } })} /></Form.Item></Col>
              <Col span={12}><Form.Item label={t('materialsPage.stockLocation')}><Input value={iolModal.data.stockLocation} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, stockLocation: e.target.value } })} placeholder="A-01" /></Form.Item></Col>
              <Col span={12}><Form.Item label={t('materialsPage.expiryDate')}><Input type="date" onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, expiryDate: e.target.value } })} /></Form.Item></Col>
              <Col span={12}><Form.Item label={t('materialsPage.unitPrice')}><InputNumber value={iolModal.data.unitPrice} onChange={v => setIolModal({ ...iolModal, data: { ...iolModal.data, unitPrice: v } })} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          </Form>
        ) : iolModal.type === 'transfer' ? (
          <div>
            <Alert title={`调拨: ${iolModal.data.model} (${iolModal.data.power}D)`} type="info" showIcon style={{ marginBottom: 8 }} />
            <Form.Item label={t('materialsPage.currentLocation')}><Input value={iolModal.data.stockLocation} disabled /></Form.Item>
            <Form.Item label={t('materialsPage.targetLocation')}><Input value={iolModal.data.toLocation} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, toLocation: e.target.value } })} placeholder={t('materialsPage.targetLocationPlaceholder')} /></Form.Item>
          </div>
        ) : iolModal.type === 'adjust' ? (
          <div>
            <Alert title={`库存调整: ${iolModal.data.model} (${iolModal.data.power}D) @ ${iolModal.data.stockLocation}`} type="info" showIcon style={{ marginBottom: 8 }} />
            <Form.Item label={t('materialsPage.adjustQty')}><InputNumber value={iolModal.data.deltaQty} onChange={v => setIolModal({ ...iolModal, data: { ...iolModal.data, deltaQty: v } })} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={t('materialsPage.adjustReason')}><Input value={iolModal.data.adjustReason} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, adjustReason: e.target.value } })} placeholder={t('materialsPage.adjustReasonPlaceholder')} /></Form.Item>
          </div>
        ) : (
          <div>
            <Alert title={`出库: ${iolModal.data.model} (${iolModal.data.power}D) @ ${iolModal.data.stockLocation}`} type="info" showIcon style={{ marginBottom: 8 }} />
            <Form.Item label={t('materialsPage.outReason')}><Input value={iolModal.data.reason} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, reason: e.target.value } })} placeholder={t('materialsPage.outReasonPlaceholder')} /></Form.Item>
            <Form.Item label={t('materialsPage.patientIdOptional')}><Input value={iolModal.data.patientId} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, patientId: e.target.value } })} placeholder="P000001" /></Form.Item>
            <Form.Item label={t('materialsPage.surgeonOptional')}><Input value={iolModal.data.surgeon} onChange={e => setIolModal({ ...iolModal, data: { ...iolModal.data, surgeon: e.target.value } })} placeholder="D001" /></Form.Item>
          </div>
        )}
      </Modal>

      {/* [G005 Wave1B] IOL 单条详情 Modal (eyeApi.getIolInventoryById) */}
      <Modal
        title={`IOL 详情: ${iolDetail.data?.model ?? ''} (${iolDetail.data?.power ?? ''}D)`}
        open={iolDetail.open}
        onCancel={() => setIolDetail({ open: false, data: null, loading: false })}
        footer={<Button onClick={() => setIolDetail({ open: false, data: null, loading: false })}>{t('materialsPage.close')}</Button>}
        width={480}
      >
        {iolDetail.loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>{t('materialsPage.loading')}</div>
        ) : iolDetail.data ? (
          <Row gutter={[8, 8]}>
            {[
              [t('materialsPage.barcode'), iolDetail.data.barcode],
              [t('materialsPage.model'), iolDetail.data.model],
              [t('materialsPage.type'), iolDetail.data.type],
              [t('materialsPage.power'), iolDetail.data.power ? iolDetail.data.power + ' D' : '-'],
              [t('materialsPage.cylinder'), iolDetail.data.cylinder ? iolDetail.data.cylinder + ' D' : '-'],
              [t('materialsPage.batchNumber'), iolDetail.data.batchNumber],
              [t('materialsPage.stockLocation'), iolDetail.data.stockLocation],
              [t('materialsPage.status'), iolDetail.data.status],
              [t('materialsPage.supplier'), iolDetail.data.supplier],
              [t('materialsPage.unitPricePlain'), iolDetail.data.unitPrice ? '¥' + iolDetail.data.unitPrice : '-'],
              [t('materialsPage.expiryDate'), iolDetail.data.expiryDate ? String(iolDetail.data.expiryDate).slice(0, 10) : '-'],
              [t('materialsPage.createdAt'), iolDetail.data.createdAt ? String(iolDetail.data.createdAt).slice(0, 10) : '-'],
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
        title={lensModal.type === 'create' ? t('materialsPage.newLens') : lensModal.type === 'update' ? t('materialsPage.editLens') : t('materialsPage.lensFitting')}
        open={!!lensModal.type}
        onCancel={() => setLensModal({ type: null, data: {} })}
        onOk={lensModal.type === 'fitting' ? undefined : handleLensSave}
        footer={lensModal.type === 'fitting' ? null : undefined}
        width={500}
      >
        {lensModal.type === 'fitting' ? (
          <div>
            <Alert title={t('materialsPage.fittingLens')} type="info" showIcon style={{ marginBottom: 8 }} description={`${lensModal.data.id} (${lensModal.data.brand} ${lensModal.data.series})`} />
            <Form.Item label={t('materialsPage.patient')} required>
              {patientOptions.length > 0 ? (
                <Select
                  value={lensModal.data.patientId}
                  onChange={v => setLensModal({ ...lensModal, data: { ...lensModal.data, patientId: v } })}
                  options={patientOptions}
                  placeholder={t('materialsPage.selectPatient')}
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
            }}>{t('materialsPage.recordFitting')}</Button>
          </div>
        ) : (
          <Form layout="vertical" size="small">
            <Row gutter={8}>
              <Col span={12}><Form.Item label={t('materialsPage.brand')}><Input value={lensModal.data.brand} onChange={e => setLensModal({ ...lensModal, data: { ...lensModal.data, brand: e.target.value } })} /></Form.Item></Col>
              <Col span={12}><Form.Item label={t('materialsPage.type')}><Select value={lensModal.data.type} onChange={v => setLensModal({ ...lensModal, data: { ...lensModal.data, type: v } })} options={['RGP','Scleral','Soft','OK','Hybrid'].map(ty => ({value:ty,label:LENS_TYPE_LABEL[ty] ?? ty}))} /></Form.Item></Col>
              <Col span={12}><Form.Item label={t('materialsPage.series')}><Input value={lensModal.data.series} onChange={e => setLensModal({ ...lensModal, data: { ...lensModal.data, series: e.target.value } })} /></Form.Item></Col>
              <Col span={12}><Form.Item label={t('materialsPage.supplier')}><Input value={lensModal.data.supplier} onChange={e => setLensModal({ ...lensModal, data: { ...lensModal.data, supplier: e.target.value } })} /></Form.Item></Col>
              <Col span={8}><Form.Item label="BC (mm)"><InputNumber value={lensModal.data.bc} onChange={v => setLensModal({ ...lensModal, data: { ...lensModal.data, bc: v } })} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item label="DIA (mm)"><InputNumber value={lensModal.data.dia} onChange={v => setLensModal({ ...lensModal, data: { ...lensModal.data, dia: v } })} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item label={t('materialsPage.powerD')}><InputNumber value={lensModal.data.power} onChange={v => setLensModal({ ...lensModal, data: { ...lensModal.data, power: v } })} step={0.25} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item label={t('materialsPage.stock')}><InputNumber value={lensModal.data.stock} onChange={v => setLensModal({ ...lensModal, data: { ...lensModal.data, stock: v } })} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item label={t('materialsPage.priceYuan')}><InputNumber value={lensModal.data.unitPrice} onChange={v => setLensModal({ ...lensModal, data: { ...lensModal.data, unitPrice: v } })} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item label={t('materialsPage.trialLens')}><Switch checked={lensModal.data.trialLens} onChange={v => setLensModal({ ...lensModal, data: { ...lensModal.data, trialLens: v } })} /></Form.Item></Col>
            </Row>
          </Form>
        )}
      </Modal>

      {/* [G005 Wave1A P0] OK 镜设计 Modal (POST /eye/optometry/ok-lens/design) */}
      <Modal
        title={t('materialsPage.okDesignTitle')}
        open={okDesignModal.open}
        onCancel={() => setOkDesignModal({ open: false, data: {}, submitting: false })}
        onOk={() => void handleOkDesign()}
        okText={t('materialsPage.generateDesign')}
        cancelText={t('materialsPage.cancel')}
        confirmLoading={okDesignModal.submitting}
        width={460}
      >
        <Form layout="vertical" size="small">
          <Form.Item label={t('materialsPage.patientId')} required><Input value={okDesignModal.data.patientId} onChange={e => setOkDesignModal({ ...okDesignModal, data: { ...okDesignModal.data, patientId: e.target.value } })} placeholder="P000001" /></Form.Item>
          <Row gutter={8}>
            <Col span={8}><Form.Item label="K1 (D)"><InputNumber value={okDesignModal.data.k1} onChange={v => setOkDesignModal({ ...okDesignModal, data: { ...okDesignModal.data, k1: v } })} defaultValue={42} step={0.25} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item label="K2 (D)"><InputNumber value={okDesignModal.data.k2} onChange={v => setOkDesignModal({ ...okDesignModal, data: { ...okDesignModal.data, k2: v } })} defaultValue={42} step={0.25} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item label={t('materialsPage.kAxis')}><InputNumber value={okDesignModal.data.kAxis} onChange={v => setOkDesignModal({ ...okDesignModal, data: { ...okDesignModal.data, kAxis: v } })} defaultValue={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={8}>
            <Col span={12}><Form.Item label={t('materialsPage.targetReduction')}><InputNumber value={okDesignModal.data.targetReduction} onChange={v => setOkDesignModal({ ...okDesignModal, data: { ...okDesignModal.data, targetReduction: v } })} defaultValue={3} step={0.25} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item label={t('materialsPage.brand')}><Select value={okDesignModal.data.brand} onChange={v => setOkDesignModal({ ...okDesignModal, data: { ...okDesignModal.data, brand: v } })} allowClear options={['CRT', 'DreamLens', 'Euclid'].map(b => ({ value: b, label: b }))} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default MaterialsPage;
