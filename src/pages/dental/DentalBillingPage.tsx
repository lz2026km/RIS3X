// [v3.0.6.8-95] Phase 4: 收费/划价/医保系统
// 对标: 领健·牙医管家
import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Button, Select, Row, Col, Statistic, message, Tabs, Table, InputNumber, Modal, List, Badge, Progress, Divider, Form, Input } from 'antd';
import { DollarSign, FileText, XCircle, Printer, Calculator, Plus } from 'lucide-react';
import { wechatPay } from '../../services/wechatPay';
// [G005 Wave1B] 发票列表: dentalApi.listInvoices (GET /dental/invoices), 失败回退 billing 端点
import { dentalApi } from '../../services/api/dentalApi';
import { usePagination } from '../../hooks/usePagination';

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
          items: inv.items ?? [{ code: inv.invoiceNumber ?? inv.id, name: '口腔诊疗' }],
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
        try {
          const d = await fetch(`/api/v1/dental/billing/invoices?patientId=${selectedPatient}`).then(r => r.json());
          if (d.success) { setInvoices(d.data || []); return; }
        } catch { /* keep empty */ }
        setBackendDown(true);
      }
    }
  };

  const loadCatalog = async () => {
    try {
      const res = await dentalApi.getFeeCatalog();
      const list = unwrapList(res);
      if (Array.isArray(list) && list.length > 0) { setCatalog(list); return; }
      throw new Error('fee-catalog 空/不可用');
    } catch {
      try {
        const d = await fetch('/api/v1/dental/billing/fee-catalog').then(r => r.json());
        if (d.success) setCatalog(d.data || []);
      } catch (err) { console.error('[F04]', err); }
      setBackendDown(true);
    }
  };

  const loadPayMethods = async () => {
    try {
      const res = await dentalApi.getPaymentMethods();
      const list = unwrapList(res);
      if (Array.isArray(list) && list.length > 0) { setPayMethods(list); return; }
      throw new Error('payment-methods 空/不可用');
    } catch {
      try {
        const d = await fetch('/api/v1/dental/billing/payment-methods').then(r => r.json());
        if (d.success) setPayMethods(d.data || []);
      } catch (err) { console.error('[F04]', err); }
      setBackendDown(true);
    }
  };

  useEffect(() => {
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
            // [G005 Wave1A P0] dentalApi 优先, 失败回退 MSW/dev 端点
            try {
              const pres = await dentalApi.payBillingInvoice(currentInvoice.id, { paymentMethod, transactionId: res.transactionId, outTradeNo: orderNo });
              if (pres.success) { message.success(`收费成功 (${paymentMethod})`); }
              else { setBackendDown(true); message.warning(`收费接口不可用: ${pres.error?.message ?? '未知错误'}`); }
            } catch {
              setBackendDown(true);
              const confirm = await fetch(`/api/v1/dental/billing/invoices/${currentInvoice.id}/pay`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ paymentMethod, transactionId: res.transactionId, outTradeNo: orderNo }) });
              const d = await confirm.json();
              if (d.success) message.success(`收费成功 (${paymentMethod})`);
            }
            setPayModal(false);
            await loadInvoices();
          },
          onFail: (err) => {
            message.error(`微信支付失败: ${err.message}`);
          },
        });
        if (!r.success) message.error(r.error?.message || '微信下单失败');
      } else {
        // [G005 Wave1A P0] dentalApi 优先, 失败回退 MSW/dev 端点
        try {
          const pres = await dentalApi.payBillingInvoice(currentInvoice.id, { paymentMethod });
          if (pres.success) { message.success(`收费成功 (${paymentMethod})`); }
          else { setBackendDown(true); message.warning(`收费接口不可用: ${pres.error?.message ?? '未知错误'}`); }
        } catch {
          setBackendDown(true);
          const r = await fetch(`/api/v1/dental/billing/invoices/${currentInvoice.id}/pay`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ paymentMethod }) });
          const d = await r.json();
          if (d.success) message.success(`收费成功 (${paymentMethod})`);
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
        message.success(`发票已创建: ${res.data?.[0]?.invoiceNumber ?? ''}`);
        setInvoiceModal({ open: false, saving: false });
        invoiceForm.resetFields();
        await loadInvoices();
      } else {
        message.error(res.error?.message ?? '开票失败');
        setInvoiceModal(prev => ({ ...prev, saving: false }));
      }
    } catch (e: any) {
      message.error(e?.message ?? '开票失败');
      setInvoiceModal(prev => ({ ...prev, saving: false }));
    }
  };

  const handlePrint = (invoice: any) => {
    const rows = (invoice.items || []).map((i: any) => `<tr><td>${i.name}</td><td style="text-align:right">${i.qty || 1}</td><td style="text-align:right">¥${i.unitPrice ?? 0}</td><td style="text-align:right">¥${((i.unitPrice ?? 0) * (i.qty || 1)).toFixed(2)}</td></tr>`).join('');
    const win = window.open('', '_blank', 'width=640,height=480');
    if (!win) { message.warning('浏览器拦截了打印窗口，请允许弹出窗口'); return; }
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
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <DollarSign size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>收费/划价/医保</span>
        <Tag color="cyan">v3.0.6.8-95</Tag>
        <Tag color="blue">牙医管家 对标</Tag>
        {/* [G005 Wave1A P0] /dental/billing/* 已接真实后端 (收费字典/支付方式/账单), 失败回退 dev 端点 */}
        {backendDown ? (
          <Tag color="orange">离线回退 (后端不可用)</Tag>
        ) : (
          <Tag color="green">真实后端 /dental/billing/*</Tag>
        )}
        <Button size="small" type="primary" icon={<DollarSign size={14} />} onClick={() => { invoiceForm.resetFields(); setInvoiceModal({ open: true, saving: false }); }}>开票</Button>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="今日收入" prefix="¥" value={invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+i.total,0)} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="待缴费" prefix="¥" value={totalPending} styles={{ content: { color:totalPending>0?'#faad14':'#52c41a' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="医保支出" prefix="¥" value={invoices.reduce((s,i)=>s+i.insuranceCover,0)} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="回款率" value={(totalPaid/(totalPaid+totalPending+1)*100).toFixed(0)} suffix="%" /></Card></Col>
        <Col span={4}>
          <Select value={selectedPatient} onChange={v => setSelectedPatient(v)} style={{ width: '100%' }}
            options={[{value:'P100001',label:'张伟'},{value:'P100002',label:'李娜'},{value:'P100003',label:'王芳'}]} />
        </Col>
      </Row>
      <Card size="small" title={<Space><FileText size={14}/>患者账单</Space>}>
        <Tabs activeKey={tab} onChange={setTab} items={[
          {key:'charge', label:'划价收费', children:<>
            <Row gutter={12}>
              <Col span={8}>
                <Card size="small" title="费用项目选择">
                  <Select showSearch placeholder="搜索项目..." style={{width:'100%',marginBottom:8}} options={catalog.map((c:any)=>({value:c.code,label:`${c.name} ¥${c.unitPrice}`}))} />
                  <Table dataSource={pagedCatalog} rowKey="code" size="small" pagination={catalogPagination} scroll={{ x: 'max-content' }}
                    columns={[{title:'项目',dataIndex:'name',width:140},{title:'价格',dataIndex:'unitPrice',render:(v:number)=>`¥${v}`},{title:'医保',dataIndex:'insuranceType',render:(t:string)=><Tag color={t==='甲类'?'green':t==='乙类'?'blue':'red'}>{t}</Tag>},{title:'',render:(_,r:any)=><Button size="small" icon={<Plus size={14}/>} onClick={()=>setNewInvoice({...newInvoice,items:[...newInvoice.items,{...r,qty:1}]})} aria-label="添加项目" />}]} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" title="已选项目">
                  {newInvoice.items.map((item:any,i:number)=>(
                    <div key={i} style={{padding:'4px 0',borderBottom:'1px solid var(--border-color)',display:'flex',justifyContent:'space-between'}}>
                      <span><Tag>{item.code}</Tag>{item.name}</span>
                      <Space><InputNumber size="small" value={item.qty} min={1} max={10} style={{width:60}} onChange={v=>{const items=[...newInvoice.items];items[i]={...items[i],qty:v||1};setNewInvoice({...newInvoice,items});}} />
                      <span style={{fontWeight:600}}>¥{item.unitPrice * (item.qty||1)}</span>
                      <Button size="small" type="text" danger icon={<XCircle size={10}/>} onClick={()=>setNewInvoice({...newInvoice,items:newInvoice.items.filter((_:any,j:number)=>j!==i)})} /></Space>
                    </div>
                  ))}
                  <Divider style={{margin:'8px 0'}} />
                  <div style={{display:'flex',justifyContent:'space-between',fontWeight:600}}><span>合计</span><span>¥{newInvoice.items.reduce((s:number,i:any)=>s+i.unitPrice*(i.qty||1),0)}</span></div>
                  <Button type="primary" block style={{marginTop:8}} icon={<DollarSign size={14}/>} onClick={async()=>{
                    try {
                      // [G005 Wave1A P0] dentalApi 优先, 失败回退 MSW/dev 端点
                      try {
                        const pres = await dentalApi.createBillingInvoice({ patientId: selectedPatient, items: newInvoice.items, total: newInvoice.items.reduce((s: number, i: any) => s + i.unitPrice * (i.qty || 1), 0) });
                        if (pres.success) { message.success('账单已创建'); setNewInvoice({ patientId: selectedPatient, items: [] }); return; }
                        throw new Error(pres.error?.message ?? '创建失败');
                      } catch {
                        setBackendDown(true);
                        const r = await fetch('/api/v1/dental/billing/invoices', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ patientId: selectedPatient, items: newInvoice.items, total: newInvoice.items.reduce((s: number, i: any) => s + i.unitPrice * (i.qty || 1), 0) }) });
                        const d = await r.json();
                        if (d.success) { message.success('账单已创建'); setNewInvoice({ patientId: selectedPatient, items: [] }); }
                      }
                    } catch { message.error('账单创建失败'); }
                  }}>创建账单</Button>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" title="实时医保验算">
                  <InputNumber placeholder="输入总金额" style={{width:'100%',marginBottom:8}} />
                  <Button block icon={<Calculator size={14}/>} onClick={async()=>{
                    try {
                      // [G005 Wave1A P0] dentalApi 优先, 失败回退 MSW/dev 端点
                      try {
                        const pres = await dentalApi.verifyInsurance({ patientId: selectedPatient, insuranceType: '城镇职工', feeTotal: newInvoice.items.reduce((s: number, i: any) => s + i.unitPrice * (i.qty || 1), 0) });
                        if (pres.success) message.info(`医保报销: ¥${pres.data.insuranceCover}, 自付: ¥${pres.data.selfPay}`);
                        else throw new Error(pres.error?.message ?? '验算失败');
                      } catch {
                        setBackendDown(true);
                        const r = await fetch('/api/v1/dental/billing/insurance-verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientId:selectedPatient,insuranceType:'城镇职工',feeTotal:newInvoice.items.reduce((s:number,i:any)=>s+i.unitPrice*(i.qty||1),0)})});
                        const d=await r.json();if(d.success)message.info(`医保报销: ¥${d.data.insuranceCover}, 自付: ¥${d.data.selfPay}`);
                      }
                    } catch { message.error('医保预核验失败'); }
                  }}>医保预核验</Button>
                  <Divider style={{margin:'8px 0'}} />
                  <div style={{fontSize:12,color:'var(--text-secondary)'}}>
                    <div>年度医保余额: 查询中...</div>
                    <Progress percent={0} size="small" />
                    <div>补充医疗余额: 查询中...</div>
                    <Progress percent={0} size="small" strokeColor="#52c41a" />
                  </div>
                </Card>
              </Col>
            </Row>
          </>},
          {key:'invoices', label:'账单管理', children:<Table dataSource={pagedInvoices} rowKey="id" size="small" pagination={invoicesPagination}
            columns={[
              {title:'单号',dataIndex:'id',width:180},{title:'日期',dataIndex:'date',width:100},
              {title:'项目',dataIndex:'items',render:(items:any[])=><>{items.map((i:any)=><Tag key={i.code}>{i.name}</Tag>)}</>},
              {title:'总金额',dataIndex:'total',render:(v:number)=>`¥${v}`,width:80},
              {title:'医保报销',dataIndex:'insuranceCover',render:(v:number)=>`¥${v}`,width:80},
              {title:'自付',dataIndex:'selfPay',render:(v:number)=>`¥${v}`},
              {title:'状态',dataIndex:'status',render:(s:string)=><Badge status={s==='paid'?'success':s==='pending'?'warning':'default'} text={{ paid:'已支付', pending:'待支付' }[s] ?? s} />,width:80},
              {title:'操作',render:(_,r:any)=><Space>{r.status==='pending'&&<Button size="small" type="primary" icon={<DollarSign size={10}/>} onClick={()=>{setCurrentInvoice(r);setPayModal(true);}}>收费</Button>}<Button size="small" icon={<Printer size={10}/>} onClick={() => handlePrint(r)}>打印</Button></Space>},
            ]} 
          scroll={{ x: 'max-content' }}/>},
          {key:'reports', label:'经营报表', children:<Row gutter={12}>
            <Col span={8}><Card size="small" title="财务概览"><Statistic title="月营收" prefix="¥" value={invoices.reduce((s,i)=>s+i.total,0)} /><Statistic title="待收" prefix="¥" value={totalPending} style={{marginTop:12}} /><Statistic title="已收" prefix="¥" value={totalPaid} style={{marginTop:12}} /><Progress percent={totalPaid/(totalPaid+totalPending+1)*100} size="small" strokeColor="#52c41a" /></Card></Col>
            <Col span={8}><Card size="small" title="运营数据"><Statistic title="账单数" value={invoices.length} /><Statistic title="已付比例" value={invoices.length>0?((invoices.filter(i=>i.status==='paid').length/invoices.length)*100).toFixed(0):'0'} suffix="%" style={{marginTop:12}} /></Card></Col>
            <Col span={8}><Card size="small" title="费用明细"><List size="small" dataSource={catalog.slice(0,3)} renderItem={(d:any)=><List.Item><span>{d.name}</span><Tag>¥{d.unitPrice}</Tag></List.Item>} /></Card></Col>
          </Row>},
        ]} />
      </Card>
      <Modal title={`收费 - ${currentInvoice?.id}`} open={payModal} onCancel={()=>{setPayModal(false); setPaymentMethod(DEFAULT_METHOD);}} onOk={handlePay} width={400}
        okText={`确认收费 ¥${currentInvoice?.selfPay || 0}`}>
        <div style={{textAlign:'center',padding:16}}>
          <div style={{fontSize:28,fontWeight:700,color:'#2563eb'}}>¥{currentInvoice?.selfPay || 0}</div>
          <div style={{color:'var(--text-secondary)',marginBottom:16}}>收现金额</div>
          <Select value={paymentMethod} onChange={setPaymentMethod} style={{width:'100%'}} options={payMethods.map((m:any)=>({value:m.id,label:m.name}))} />
        </div>
      </Modal>
      <Modal title="开票 (dentalApi.createInvoice)" open={invoiceModal.open} onCancel={() => setInvoiceModal({ open: false, saving: false })} onOk={() => void handleCreateInvoice()} confirmLoading={invoiceModal.saving} width={440}>
        <Form form={invoiceForm} layout="vertical" size="small" style={{ marginTop: 8 }} initialValues={{ patientId: selectedPatient, itemCode: 'DENTAL-001', quantity: 1 }}>
          <Form.Item label="患者" name="patientId" rules={[{ required: true, message: '请选择患者' }]}>
            <Select options={[{ value: 'P100001', label: '张伟' }, { value: 'P100002', label: '李娜' }, { value: 'P100003', label: '王芳' }]} />
          </Form.Item>
          <Form.Item label="项目名称" name="itemName" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="如: 全瓷冠修复" />
          </Form.Item>
          <Form.Item label="项目编码" name="itemCode">
            <Input placeholder="如: DENTAL-001" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="金额 (¥)" name="amount" rules={[{ required: true, message: '请输入金额' }]}>
                <InputNumber style={{ width: '100%' }} min={0.01} precision={2} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="数量" name="quantity">
                <InputNumber style={{ width: '100%' }} min={1} max={99} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};
export default DentalBillingPage;
