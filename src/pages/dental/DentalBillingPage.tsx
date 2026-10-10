// [v3.0.6.8-95] Phase 4: 收费/划价/医保系统
// 对标: 领健·牙医管家
// [G005 Wave1B] 收敛 7 处裸 fetch 双通道 → 仅走 dentalApi (后端 /dental/billing/* 真实), 失败走现有回退标注
import React, { useState, useEffect } from 'react';
import {
  Card,
  Space,
  Tag,
  Button,
  Select,
  Row,
  Col,
  Statistic,
  message,
  Tabs,
  InputNumber,
  Modal,
  List,
  Badge,
  Progress,
  Divider,
  Form,
  Input,
} from "antd";
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";
import { DollarSign, FileText, XCircle, Printer, Calculator, Plus } from 'lucide-react';
import { wechatPay } from '../../services/wechatPay';
import { dentalApi } from '../../services/api/dentalApi';
import { ErrorBanner } from '../../components/feedback';
import { usePagination } from '../../hooks/usePagination';
import { t } from '../../i18n/appI18n';

const WECHAT_METHOD_ID = 'wechat';
const DEFAULT_METHOD = WECHAT_METHOD_ID;

export const DentalBillingPage: React.FC = () => {
  const [tab, setTab] = useState('charge');
  const [catalog, setCatalog] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payMethods, setPayMethods] = useState<any[]>([]);
  const [_busy, setBusy] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState('P100001');
  const [newInvoice, setNewInvoice] = useState<any>({ patientId: 'P100001', items: [] });
  const [payModal, setPayModal] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>(DEFAULT_METHOD);
  // [G005 Wave1A P1] 开票: dentalApi.createInvoice (POST /dental/invoices, 后端真实)
  const [invoiceModal, setInvoiceModal] = useState<{ open: boolean; saving: boolean }>({ open: false, saving: false });
  const [invoiceForm] = Form.useForm();
  // [G005 2B] 受控分页: 费用项目目录 / 账单列表
  // [G005 Wave1A P0] 后端可用性标注: 失败时回退 MSW/dev 端点并展示标记
  const [backendDown, setBackendDown] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { pageData: pagedCatalog, pagination: catalogPagination } = usePagination(catalog, 8);
  const { pageData: pagedInvoices, pagination: invoicesPagination } = usePagination(invoices, 10);

  // [G005 Wave1A P0] 兼容两种信封: 后端 { data:[...] } 与 { success, data:[...] }
  const unwrapList = (res: any): any[] | null => {
    if (!res) return null;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray((res.data as any)?.data)) return (res.data as any).data;
    if (Array.isArray(res)) return res;
    return null;
  };

  const loadInvoices = async () => {
    try {
      const res = await dentalApi.listInvoices();
      const list = unwrapList(res);
      if (Array.isArray(list) && list.length > 0) {
        setInvoices(list.map((inv: any) => ({
          id: inv.id ?? inv.invoiceNumber,
          date: String(inv.date ?? inv.createdAt ?? '').slice(0, 10),
          items: inv.items ?? [{ code: inv.invoiceNumber ?? inv.id, name: t('dentalBilling.defaultItem') }],
          total: Number(inv.totalAmount ?? inv.total ?? 0),
          insuranceCover: Number(inv.insuranceCover ?? 0),
          selfPay: Number(inv.selfPay ?? inv.totalAmount ?? inv.total ?? 0),
          status: inv.status === 'UNPAID' || inv.status === 'PENDING' ? 'pending' : 'paid',
        })));
        return;
      }
      throw new Error('listInvoices 空/不可用');
    } catch {
      try {
        const res = await dentalApi.listBillingInvoices(selectedPatient);
        const list = unwrapList(res);
        if (Array.isArray(list) && list.length > 0) {
          setInvoices(list);
          return;
        }
        throw new Error('listBillingInvoices 空/不可用');
      } catch {
        setBackendDown(true);
        setLoadError(t('w9.states.error'));
      }
    }
  };

  const loadCatalog = async () => {
    try {
      const res = await dentalApi.getFeeCatalog();
      const list = unwrapList(res);
      if (Array.isArray(list) && list.length > 0) { setCatalog(list); return; }
      throw new Error('fee-catalog 空/不可用');
    } catch (err) {
      console.error('[F04]', err);
      setBackendDown(true);
      setLoadError(t('w9.states.error'));
    }
  };

  const loadPayMethods = async () => {
    try {
      const res = await dentalApi.getPaymentMethods();
      const list = unwrapList(res);
      if (Array.isArray(list) && list.length > 0) { setPayMethods(list); return; }
      throw new Error('payment-methods 空/不可用');
    } catch (err) {
      console.error('[F04]', err);
      setBackendDown(true);
      setLoadError(t('w9.states.error'));
    }
  };

  useEffect(() => {
    setLoadError(null);
    Promise.all([
      loadCatalog(),
      loadPayMethods(),
      loadInvoices(),
    ]);
  }, [selectedPatient]);

  const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.selfPay, 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.selfPay, 0);

  const handlePay = async () => {
    if (!currentInvoice) return;
    setBusy(true);
    try {
      if (paymentMethod === WECHAT_METHOD_ID) {
        const orderNo = `INV-${currentInvoice.id}-${Date.now()}`;
        const r = await wechatPay.jsapiPay({
          outTradeNo: orderNo,
          totalFee: Math.round((currentInvoice.selfPay || 0) * 100),
          body: `口腔收费 - ${currentInvoice.id}`,
          openId: currentInvoice.patientId || selectedPatient,
          patientId: currentInvoice.patientId || selectedPatient,
          onSuccess: async (res) => {
            // [G005 Wave1B] 仅走 dentalApi (后端真实), 失败标注回退
            try {
              const pres = await dentalApi.payBillingInvoice(currentInvoice.id, { paymentMethod, transactionId: res.transactionId, outTradeNo: orderNo });
              if (pres.success) { message.success(`${t('dentalBilling.chargeSuccess')} (${paymentMethod})`); }
              else { setBackendDown(true); message.warning(`${t('dentalBilling.chargeUnavailable')}: ${pres.error?.message ?? t('dentalBilling.unknownError')}`); }
            } catch {
              setBackendDown(true);
              message.warning(t('dentalBilling.chargeUnavailable'));
            }
            setPayModal(false);
            await loadInvoices();
          },
          onFail: (err) => {
            message.error(`微信支付失败: ${err.message}`);
          },
        });
        if (!r.success) message.error(r.error?.message || t('dentalBilling.wechatOrderFailed'));
      } else {
        // [G005 Wave1B] 仅走 dentalApi (后端真实), 失败标注回退
        try {
          const pres = await dentalApi.payBillingInvoice(currentInvoice.id, { paymentMethod });
          if (pres.success) { message.success(`${t('dentalBilling.chargeSuccess')} (${paymentMethod})`); }
          else { setBackendDown(true); message.warning(`${t('dentalBilling.chargeUnavailable')}: ${pres.error?.message ?? t('dentalBilling.unknownError')}`); }
        } catch {
          setBackendDown(true);
          message.warning(t('dentalBilling.chargeUnavailable'));
        }
        setPayModal(false);
        await loadInvoices();
      }
    } catch (e: any) {
      message.error(`收费异常: ${e?.message || e}`);
    }
    setBusy(false);
  };

  // [G005 Wave1A P1] 开票: dentalApi.createInvoice (POST /dental/invoices, 后端真实)
  const handleCreateInvoice = async () => {
    let values: any = {};
    try { values = await invoiceForm.validateFields(); } catch { return; }
    setInvoiceModal(prev => ({ ...prev, saving: true }));
    try {
      const res = await dentalApi.createInvoice({
        patientId: values.patientId,
        items: [{
          code: values.itemCode || 'GEN',
          name: values.itemName,
          amount: values.amount,
          quantity: values.quantity || 1,
        }],
        insuranceClaim: false,
      });
      if (res.success) {
        message.success(`${t('dentalBilling.invoiceCreated')}: ${res.data?.[0]?.invoiceNumber ?? ''}`);
        setInvoiceModal({ open: false, saving: false });
        invoiceForm.resetFields();
        await loadInvoices();
      } else {
        message.error(res.error?.message ?? t('dentalBilling.invoiceCreateFailed'));
        setInvoiceModal(prev => ({ ...prev, saving: false }));
      }
    } catch (e: any) {
      message.error(e?.message ?? t('dentalBilling.invoiceCreateFailed'));
      setInvoiceModal(prev => ({ ...prev, saving: false }));
    }
  };

  const handlePrint = (invoice: any) => {
    const rows = (invoice.items || []).map((i: any) => `<tr><td>${i.name}</td><td style="text-align:right">${i.qty || 1}</td><td style="text-align:right">¥${i.unitPrice ?? 0}</td><td style="text-align:right">¥${((i.unitPrice ?? 0) * (i.qty || 1)).toFixed(2)}</td></tr>`).join('');
    const win = window.open('', '_blank', 'width=640,height=480');
    if (!win) { message.warning(t('dentalBilling.popupBlocked')); return; }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>发票打印 - ${invoice.id}</title>
      <style>body{font-family:SimSun,serif;color:#000;padding:24px}h2{margin:0 0 16px}.meta{font-size:13px;line-height:1.8}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #333;padding:6px 8px;font-size:13px}th{background:#eee}@media print{body{margin:0}}</style></head>
      <body><h2>口腔门诊收费单</h2>
      <div class="meta">单号: ${invoice.id} &nbsp; 日期: ${invoice.date || ''}<br/>患者: ${invoice.patientId || ''} &nbsp; 状态: ${invoice.status === 'paid' ? '已支付' : '待支付'}</div>
      <table><thead><tr><th>项目</th><th>数量</th><th>单价</th><th>小计</th></tr></thead><tbody>${rows || '<tr><td colspan="4">无明细</td></tr>'}</tbody></table>
      <div style="margin-top:16px;font-size:14px">总金额: ¥${invoice.total ?? 0} &nbsp; 医保报销: ¥${invoice.insuranceCover ?? 0} &nbsp; 自付: ¥${invoice.selfPay ?? 0}</div>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
    message.success(`已发送打印任务: ${invoice.id}`);
  };

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <DollarSign size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('dentalBilling.title')}</span>
        <Tag color="cyan">v3.0.6.8-95</Tag>
        <Tag color="blue">{t('dentalBilling.benchmark')}</Tag>
        {/* [G005 Wave1A P0] /dental/billing/* 已接真实后端 (收费字典/支付方式/账单), 失败回退 dev 端点 */}
        {backendDown ? (
          <Tag color="orange">{t('dentalBilling.offlineFallback')}</Tag>
        ) : (
          <Tag color="green">{t('dentalBilling.realBackend')}</Tag>
        )}
        <Button size="small" type="primary" icon={<DollarSign size={14} />} onClick={() => { invoiceForm.resetFields(); setInvoiceModal({ open: true, saving: false }); }}>{t('dentalBilling.createInvoice')}</Button>
      </Space>
      {loadError && <ErrorBanner message={loadError} onRetry={() => { void loadCatalog(); void loadPayMethods(); void loadInvoices(); }} retryLabel={t('w9.states.retry')} />}
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('dentalBilling.todayIncome')} prefix="¥" value={invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+i.total,0)} icon={<DollarSign size={16} />} />
        <StatCard title={t('dentalBilling.pendingPayment')} prefix="¥" value={totalPending} color={totalPending>0?'warning':'success'} />
        <StatCard title={t('dentalBilling.insuranceExpense')} prefix="¥" value={invoices.reduce((s,i)=>s+i.insuranceCover,0)} />
        <StatCard title={t('dentalBilling.collectionRate')} value={(totalPaid/(totalPaid+totalPending+1)*100).toFixed(0)} suffix="%" />
      </StatCardGrid>
      <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Select value={selectedPatient} onChange={v => setSelectedPatient(v)} style={{ width: 200 }}
          options={[{value:'P100001',label:'张伟'},{value:'P100002',label:'李娜'},{value:'P100003',label:'王芳'}]} />
      </div>
      <Card size="small" title={<Space><FileText size={14}/>{t('dentalBilling.patientBill')}</Space>}>
        <Tabs activeKey={tab} onChange={setTab} items={[
          {key:'charge', label:t('dentalBilling.tabCharge'), children:<>
            <Row gutter={12}>
              <Col span={8}>
                <Card size="small" title={t('dentalBilling.feeItemSelect')}>
                  <Select showSearch placeholder={t('dentalBilling.searchItemPlaceholder')} style={{width:'100%',marginBottom:'var(--space-2, 8px)'}} options={catalog.map((c:any)=>({value:c.code,label:`${c.name} ¥${c.unitPrice}`}))} />
                  <DataTable dataSource={pagedCatalog} rowKey="code" pagination={catalogPagination} scroll={{ x: 'max-content' }}
                    columns={[{title:t('dentalBilling.colItem'),dataIndex:'name',width:140},{title:t('dentalBilling.colPrice'),dataIndex:'unitPrice',render:(v:number)=>`¥${v}`},{title:t('dentalBilling.colInsurance'),dataIndex:'insuranceType',render:(v:string)=><Tag color={v==='甲类'?'green':v==='乙类'?'blue':'red'}>{v}</Tag>},{title:'',render:(_,r:any)=><Button size="small" icon={<Plus size={14}/>} onClick={()=>setNewInvoice({...newInvoice,items:[...newInvoice.items,{...r,qty:1}]})} aria-label={t('dentalBilling.addItem')} />}]} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" title={t('dentalBilling.selectedItems')}>
                  {newInvoice.items.map((item:any,i:number)=>(
                    <div key={i} style={{padding:'4px 0',borderBottom:'1px solid var(--border-color)',display:'flex',justifyContent:'space-between'}}>
                      <span><Tag>{item.code}</Tag>{item.name}</span>
                      <Space><InputNumber size="small" value={item.qty} min={1} max={10} style={{width:60}} onChange={v=>{const items=[...newInvoice.items];items[i]={...items[i],qty:v||1};setNewInvoice({...newInvoice,items});}} />
                      <span style={{fontWeight:600}}>¥{item.unitPrice * (item.qty||1)}</span>
                      <Button aria-label="关闭" size="small" type="text" danger icon={<XCircle size={10}/>} onClick={()=>setNewInvoice({...newInvoice,items:newInvoice.items.filter((_:any,j:number)=>j!==i)})} /></Space>
                    </div>
                  ))}
                  <Divider style={{margin:'8px 0'}} />
                  <div style={{display:'flex',justifyContent:'space-between',fontWeight:600}}><span>{t('dentalBilling.total')}</span><span>¥{newInvoice.items.reduce((s:number,i:any)=>s+i.unitPrice*(i.qty||1),0)}</span></div>
                  <Button type="primary" block style={{marginTop:'var(--space-2, 8px)'}} icon={<DollarSign size={14}/>} onClick={async()=>{
                    try {
                      // [G005 Wave1B] 仅走 dentalApi (后端真实), 失败标注回退
                      const pres = await dentalApi.createBillingInvoice({ patientId: selectedPatient, items: newInvoice.items, total: newInvoice.items.reduce((s: number, i: any) => s + i.unitPrice * (i.qty || 1), 0) });
                      if (pres.success) { message.success(t('dentalBilling.billCreated')); setNewInvoice({ patientId: selectedPatient, items: [] }); return; }
                      setBackendDown(true);
                      message.error(pres.error?.message ?? t('dentalBilling.createFailed'));
                    } catch { message.error(t('dentalBilling.billCreateFailed')); }
                  }}>{t('dentalBilling.createBill')}</Button>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" title={t('dentalBilling.realtimeInsurance')}>
                  <InputNumber placeholder={t('dentalBilling.enterTotalAmount')} style={{width:'100%',marginBottom:'var(--space-2, 8px)'}} />
                  <Button block icon={<Calculator size={14}/>} onClick={async()=>{
                    try {
                      // [G005 Wave1B] 仅走 dentalApi (后端真实), 失败标注回退
                      const pres = await dentalApi.verifyInsurance({ patientId: selectedPatient, insuranceType: '城镇职工', feeTotal: newInvoice.items.reduce((s: number, i: any) => s + i.unitPrice * (i.qty || 1), 0) });
                      if (pres.success) message.info(`${t('dentalBilling.insuranceReimburse')}: ¥${pres.data.insuranceCover}, ${t('dentalBilling.selfPay')}: ¥${pres.data.selfPay}`);
                      else { setBackendDown(true); message.error(pres.error?.message ?? t('dentalBilling.verifyFailed')); }
                    } catch { message.error(t('dentalBilling.insuranceVerifyFailed')); }
                  }}>{t('dentalBilling.insurancePreVerify')}</Button>
                  <Divider style={{margin:'8px 0'}} />
                  <div style={{fontSize:12,color:'var(--text-secondary)'}}>
                    <div>{t('dentalBilling.annualInsuranceBalance')}: {t('dentalBilling.querying')}</div>
                    <Progress percent={0} size="small" />
                    <div>{t('dentalBilling.supplementaryBalance')}: {t('dentalBilling.querying')}</div>
                    <Progress percent={0} size="small" strokeColor="#52c41a" />
                  </div>
                </Card>
              </Col>
            </Row>
          </>},
          {key:'invoices', label:t('dentalBilling.tabInvoices'), children:<DataTable dataSource={pagedInvoices} rowKey="id" pagination={invoicesPagination}
            columns={[
              {title:t('dentalBilling.colInvoiceNo'),dataIndex:'id',width:180},{title:t('dentalBilling.colDate'),dataIndex:'date',width:100},
              {title:t('dentalBilling.colItem'),dataIndex:'items',render:(items:any[])=><>{items.map((i:any)=><Tag key={i.code}>{i.name}</Tag>)}</>},
              {title:t('dentalBilling.colTotal'),dataIndex:'total',render:(v:number)=>`¥${v}`,width:80},
              {title:t('dentalBilling.colInsuranceCover'),dataIndex:'insuranceCover',render:(v:number)=>`¥${v}`,width:80},
              {title:t('dentalBilling.colSelfPay'),dataIndex:'selfPay',render:(v:number)=>`¥${v}`},
              {title:t('dentalBilling.colStatus'),dataIndex:'status',render:(s:string)=><Badge status={s==='paid'?'success':s==='pending'?'warning':'default'} text={{ paid:t('dentalBilling.paid'), pending:t('dentalBilling.unpaid') }[s] ?? s} />,width:80},
              {title:t('dentalBilling.colActions'),render:(_,r:any)=><Space>{r.status==='pending'&&<Button size="small" type="primary" icon={<DollarSign size={10}/>} onClick={()=>{setCurrentInvoice(r);setPayModal(true);}}>{t('dentalBilling.charge')}</Button>}<Button size="small" icon={<Printer size={10}/>} onClick={() => handlePrint(r)}>{t('dentalBilling.print')}</Button></Space>},
            ]} 
          scroll={{ x: 'max-content' }}/>},
          {key:'reports', label:t('dentalBilling.tabReports'), children:<Row gutter={12}>
            <Col span={8}><Card size="small" title={t('dentalBilling.financeOverview')}><Statistic title={t('dentalBilling.monthlyRevenue')} prefix="¥" value={invoices.reduce((s,i)=>s+i.total,0)} /><Statistic title={t('dentalBilling.receivable')} prefix="¥" value={totalPending} style={{marginTop:'var(--space-3, 12px)'}} /><Statistic title={t('dentalBilling.received')} prefix="¥" value={totalPaid} style={{marginTop:'var(--space-3, 12px)'}} /><Progress percent={totalPaid/(totalPaid+totalPending+1)*100} size="small" strokeColor="#52c41a" /></Card></Col>
            <Col span={8}><Card size="small" title={t('dentalBilling.operationData')}><Statistic title={t('dentalBilling.billCount')} value={invoices.length} /><Statistic title={t('dentalBilling.paidRatio')} value={invoices.length>0?((invoices.filter(i=>i.status==='paid').length/invoices.length)*100).toFixed(0):'0'} suffix="%" style={{marginTop:'var(--space-3, 12px)'}} /></Card></Col>
            <Col span={8}><Card size="small" title={t('dentalBilling.feeDetail')}><List size="small" dataSource={catalog.slice(0,3)} renderItem={(d:any)=><List.Item><span>{d.name}</span><Tag>¥{d.unitPrice}</Tag></List.Item>} /></Card></Col>
          </Row>},
        ]} />
      </Card>
      <Modal title={`${t('dentalBilling.charge')} - ${currentInvoice?.id}`} open={payModal} onCancel={()=>{setPayModal(false); setPaymentMethod(DEFAULT_METHOD);}} onOk={handlePay} width={400}
        okText={`${t('dentalBilling.confirmCharge')} ¥${currentInvoice?.selfPay || 0}`}>
        <div style={{textAlign:'center',padding:'var(--space-4, 16px)'}}>
          <div style={{fontSize:30,fontWeight:700,color:'var(--color-primary-600)'}}>¥{currentInvoice?.selfPay || 0}</div>
          <div style={{color:'var(--text-secondary)',marginBottom:'var(--space-4, 16px)'}}>{t('dentalBilling.cashAmount')}</div>
          <Select value={paymentMethod} onChange={setPaymentMethod} style={{width:'100%'}} options={payMethods.map((m:any)=>({value:m.id,label:m.name}))} />
        </div>
      </Modal>
      <Modal title={t('dentalBilling.createInvoiceTitle')} open={invoiceModal.open} onCancel={() => setInvoiceModal({ open: false, saving: false })} onOk={() => void handleCreateInvoice()} confirmLoading={invoiceModal.saving} width={440}>
        <Form form={invoiceForm} layout="vertical" size="small" style={{ marginTop: 'var(--space-2, 8px)' }} initialValues={{ patientId: selectedPatient, itemCode: 'DENTAL-001', quantity: 1 }}>
          <Form.Item label={t('dentalBilling.patient')} name="patientId" rules={[{ required: true, message: t('dentalBilling.selectPatientRequired') }]}>
            <Select options={[{ value: 'P100001', label: '张伟' }, { value: 'P100002', label: '李娜' }, { value: 'P100003', label: '王芳' }]} />
          </Form.Item>
          <Form.Item label={t('dentalBilling.itemName')} name="itemName" rules={[{ required: true, message: t('dentalBilling.itemNameRequired') }]}>
            <Input placeholder={t('dentalBilling.itemNamePlaceholder')} />
          </Form.Item>
          <Form.Item label={t('dentalBilling.itemCode')} name="itemCode">
            <Input placeholder={t('dentalBilling.itemCodePlaceholder')} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label={t('dentalBilling.amount')} name="amount" rules={[{ required: true, message: t('dentalBilling.amountRequired') }]}>
                <InputNumber style={{ width: '100%' }} min={0.01} precision={2} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('dentalBilling.quantity')} name="quantity">
                <InputNumber style={{ width: '100%' }} min={1} max={99} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </PageContainer>
  );
};
export default DentalBillingPage;
