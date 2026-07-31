// [v3.0.6.8-95] Phase 4: 收费/划价/医保系统
// 对标: 领健·牙医管家
import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Button, Select, Row, Col, Statistic, message, Tabs, Table, InputNumber, Modal, Form, List, Alert, Badge, Progress, Divider, Descriptions, Tooltip } from 'antd';
import { Activity, DollarSign, FileText, CheckCircle2, XCircle, Printer, Search, Calculator, Shield, TrendingUp, BarChart3 } from 'lucide-react';
import { wechatPay } from '../../services/wechatPay';

const WECHAT_METHOD_ID = 'wechat';
const DEFAULT_METHOD = WECHAT_METHOD_ID;

export const DentalBillingPage: React.FC = () => {
  const [tab, setTab] = useState('charge');
  const [catalog, setCatalog] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payMethods, setPayMethods] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState('P100001');
  const [newInvoice, setNewInvoice] = useState<any>({ patientId: 'P100001', items: [] });
  const [payModal, setPayModal] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>(DEFAULT_METHOD);

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/dental/billing/fee-catalog').then(r=>r.json()).then(d=>{if(d.success)setCatalog(d.data||[]);}).catch((err) => { console.error('[F04]', err); }),
      fetch('/api/v1/dental/billing/payment-methods').then(r=>r.json()).then(d=>{if(d.success)setPayMethods(d.data||[]);}).catch((err) => { console.error('[F04]', err); }),
      fetch(`/api/v1/dental/billing/invoices?patientId=${selectedPatient}`).then(r=>r.json()).then(d=>{if(d.success)setInvoices(d.data||[]);}).catch((err) => { console.error('[F04]', err); }),
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
            const confirm = await fetch(`/api/v1/dental/billing/invoices/${currentInvoice.id}/pay`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ paymentMethod, transactionId: res.transactionId, outTradeNo: orderNo }) });
            const d = await confirm.json();
            if (d.success) message.success(`收费成功 (${paymentMethod})`);
            setPayModal(false);
            const list = await fetch(`/api/v1/dental/billing/invoices?patientId=${selectedPatient}`).then(r=>r.json());
            if (list.success) setInvoices(list.data || []);
          },
          onFail: (err) => {
            message.error(`微信支付失败: ${err.message}`);
          },
        });
        if (!r.success) message.error(r.error?.message || '微信下单失败');
      } else {
        const r = await fetch(`/api/v1/dental/billing/invoices/${currentInvoice.id}/pay`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ paymentMethod }) });
        const d = await r.json();
        if (d.success) message.success(`收费成功 (${paymentMethod})`);
        setPayModal(false);
        const res = await fetch(`/api/v1/dental/billing/invoices?patientId=${selectedPatient}`).then(r=>r.json());
        if (res.success) setInvoices(res.data || []);
      }
    } catch (e: any) {
      message.error(`收费异常: ${e?.message || e}`);
    }
    setBusy(false);
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <DollarSign size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>收费/划价/医保</span>
        <Tag color="cyan">v3.0.6.8-95</Tag>
        <Tag color="blue">牙医管家 对标</Tag>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="今日收入" prefix="¥" value={invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+i.total,0)} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="待缴费" prefix="¥" value={totalPending} valueStyle={{color:totalPending>0?'#faad14':'#52c41a'}} /></Card></Col>
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
                  <Table dataSource={catalog.slice(0,8)} rowKey="code" size="small" pagination={false}
                    columns={[{title:'项目',dataIndex:'name',width:140},{title:'价格',dataIndex:'unitPrice',render:(v:number)=>`¥${v}`},{title:'医保',dataIndex:'insuranceType',render:(t:string)=><Tag color={t==='甲类'?'green':t==='乙类'?'blue':'red'}>{t}</Tag>},{title:'',render:(_,r:any)=><Button size="small" onClick={()=>setNewInvoice({...newInvoice,items:[...newInvoice.items,{...r,qty:1}]})}>+</Button>}]} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" title="已选项目">
                  {newInvoice.items.map((item:any,i:number)=>(
                    <div key={i} style={{padding:'4px 0',borderBottom:'1px solid #f0f0f0',display:'flex',justifyContent:'space-between'}}>
                      <span><Tag>{item.code}</Tag>{item.name}</span>
                      <Space><InputNumber size="small" value={item.qty} min={1} max={10} style={{width:60}} onChange={v=>{const items=[...newInvoice.items];items[i]={...items[i],qty:v||1};setNewInvoice({...newInvoice,items});}} />
                      <span style={{fontWeight:600}}>¥{item.unitPrice * (item.qty||1)}</span>
                      <Button size="small" type="text" danger icon={<XCircle size={10}/>} onClick={()=>setNewInvoice({...newInvoice,items:newInvoice.items.filter((_:any,j:number)=>j!==i)})} /></Space>
                    </div>
                  ))}
                  <Divider style={{margin:'8px 0'}} />
                  <div style={{display:'flex',justifyContent:'space-between',fontWeight:600}}><span>合计</span><span>¥{newInvoice.items.reduce((s:number,i:any)=>s+i.unitPrice*(i.qty||1),0)}</span></div>
                  <Button type="primary" block style={{marginTop:8}} icon={<DollarSign size={14}/>} onClick={async()=>{
                    const r=await fetch('/api/v1/dental/billing/invoices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientId:selectedPatient,items:newInvoice.items,total:newInvoice.items.reduce((s:number,i:any)=>s+i.unitPrice*(i.qty||1),0)})});
                    const d=await r.json();if(d.success){message.success('账单已创建');setNewInvoice({patientId:selectedPatient,items:[]})}
                  }}>创建账单</Button>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" title="实时医保验算">
                  <InputNumber placeholder="输入总金额" style={{width:'100%',marginBottom:8}} />
                  <Button block icon={<Calculator size={14}/>} onClick={async()=>{
                    const r = await fetch('/api/v1/dental/billing/insurance-verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientId:selectedPatient,insuranceType:'城镇职工',feeTotal:newInvoice.items.reduce((s:number,i:any)=>s+i.unitPrice*(i.qty||1),0)})});
                    const d=await r.json();if(d.success)message.info(`医保报销: ¥${d.data.insuranceCover}, 自付: ¥${d.data.selfPay}`);
                  }}>医保预核验</Button>
                  <Divider style={{margin:'8px 0'}} />
                  <div style={{fontSize:12,color:'#666'}}>
                    <div>年度医保余额: 查询中...</div>
                    <Progress percent={0} size="small" />
                    <div>补充医疗余额: 查询中...</div>
                    <Progress percent={0} size="small" strokeColor="#52c41a" />
                  </div>
                </Card>
              </Col>
            </Row>
          </>},
          {key:'invoices', label:'账单管理', children:<Table dataSource={invoices} rowKey="id" size="small" pagination={false}
            columns={[
              {title:'单号',dataIndex:'id',width:180},{title:'日期',dataIndex:'date',width:100},
              {title:'项目',dataIndex:'items',render:(items:any[])=><>{items.map((i:any)=><Tag key={i.code}>{i.name}</Tag>)}</>},
              {title:'总金额',dataIndex:'total',render:(v:number)=>`¥${v}`,width:80},
              {title:'医保报销',dataIndex:'insuranceCover',render:(v:number)=>`¥${v}`,width:80},
              {title:'自付',dataIndex:'selfPay',render:(v:number)=>`¥${v}`},
              {title:'状态',dataIndex:'status',render:(s:string)=><Badge status={s==='paid'?'success':s==='pending'?'warning':'default'} text={s} />,width:80},
              {title:'操作',render:(_,r:any)=><Space>{r.status==='pending'&&<Button size="small" type="primary" icon={<DollarSign size={10}/>} onClick={()=>{setCurrentInvoice(r);setPayModal(true);}}>收费</Button>}<Button size="small" icon={<Printer size={10}/>}>打印</Button></Space>},
            ]} />},
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
          <div style={{fontSize:36,fontWeight:700,color:'#1677ff'}}>¥{currentInvoice?.selfPay || 0}</div>
          <div style={{color:'#999',marginBottom:16}}>收现金额</div>
          <Select value={paymentMethod} onChange={setPaymentMethod} style={{width:'100%'}} options={payMethods.map((m:any)=>({value:m.id,label:m.name}))} />
        </div>
      </Modal>
    </div>
  );
};
export default DentalBillingPage;
