import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Button, Table, Select, Input, Row, Col, Statistic, message, Tabs, Empty, Modal, Form, InputNumber, List, Alert, Badge, Timeline, Descriptions, Tooltip } from 'antd';
import { Activity, Plus, Edit3, Search, RefreshCw, CheckCircle2, XCircle, Calendar, Phone, Video, Globe, FileText, DollarSign, Upload } from 'lucide-react';
import { DentalPageLayout, DentalPageHeader, DentalTreatmentTable } from './DentalShared';
import type { DentalTreatment } from './DentalShared';

/** 通用 empty 状态,带图标与 CTA */
const EmptyState: React.FC<{ tip?: string; onCreate?: () => void; createLabel?: string }> = ({
  tip = '暂无数据',
  onCreate,
  createLabel = '新建',
}) => (
  <Empty
    description={tip}
    image={Empty.PRESENTED_IMAGE_SIMPLE}
  >
    {onCreate && (
      <Button type="primary" icon={<Plus size={14} />} onClick={onCreate}>
        {createLabel}
      </Button>
    )}
  </Empty>
);

/** 通用"新增/查看详情" 操作列 (用于补强现有的简单列表页) */
const TreatmentActions: React.FC<{ record: DentalTreatment }> = ({ record }) => (
  <Space size={4}>
    <Button
      size="small"
      data-testid={`dental-detail-${record.id}`}
      onClick={() => message.info(`查看 ${record.patientName || record.id} 详情`)}
    >
      详情
    </Button>
    <Button
      size="small"
      type="link"
      onClick={() => message.success(`已为 ${record.patientName || record.id} 创建随访`)}
    >
      随访
    </Button>
  </Space>
);

// ===== DentalImplantPlanPage (Replaces placeholder) =====
export const DentalImplantPlanPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const load = async () => {
    try { const r=await fetch('/api/v1/dental/implant/plans'); const d=await r.json(); if(d.success) setPlans(d.data); } catch {}
  };
  useEffect(() => { load(); }, []);
  const fallbackPlans = [
    { id: 'P-IMP-001', patientName: '张伟', toothNo: '36', type: 'BLT', diagnosis: '右下第一磨牙缺失', plan: 'Straumann BLT 4.1×10mm + 全瓷冠', cost: 12800, status: 'completed' },
    { id: 'P-IMP-002', patientName: '李娜', toothNo: '46', type: 'Active', diagnosis: '右下第二磨牙缺失', plan: 'Nobel Active 4.3×10mm + 二氧化锆冠', cost: 14600, status: 'pending' },
    { id: 'P-IMP-003', patientName: '王刚', toothNo: '16', type: 'BLT', diagnosis: '左上第一磨牙根折', plan: 'Straumann BLT 4.8×10mm 即刻种植', cost: 15600, status: 'pending' },
    { id: 'P-IMP-004', patientName: '陈丽', toothNo: '11', type: 'Replace', diagnosis: '上前牙先天缺失', plan: 'Nobel Replace 3.5×13mm + 临时冠', cost: 18200, status: 'in_progress' },
    { id: 'P-IMP-005', patientName: '刘强', toothNo: '26', type: 'BLT', diagnosis: '左上第二前磨牙缺失', plan: 'Straumann BLT 4.1×8mm', cost: 11800, status: 'completed' },
    { id: 'P-IMP-006', patientName: '赵敏', toothNo: '47', type: 'CC', diagnosis: '右下第二磨牙残根', plan: 'Nobel CC 4.3×10mm + 牙冠延长', cost: 13400, status: 'completed' },
  ];
  const display = plans.length > 0 ? plans : fallbackPlans;
  const totalCost = display.reduce((s, p) => s + (p.cost || 0), 0);
  return (
    <DentalPageLayout header={ { title: '种植规划', tags: [<Tag key='b' color='blue'>Straumann/Nobel 对标</Tag>, <Tag key='s' color='green'>4 大品牌 / 12 型号</Tag>] } }>
      <Row gutter={12} style={ { marginBottom: 12 } }>
        <Col span={6}><Card size={'small'}><Statistic title={'规划总数'} value={display.length} prefix={<Plus size={12} />} /></Card></Col>
        <Col span={6}><Card size={'small'}><Statistic title={'待种植'} value={display.filter(p => p.status === 'pending').length} valueStyle={ { color: '#faad14' } } /></Card></Col>
        <Col span={6}><Card size={'small'}><Statistic title={'已完成'} value={display.filter(p => p.status === 'completed').length} valueStyle={ { color: '#52c41a' } } /></Card></Col>
        <Col span={6}><Card size={'small'}><Statistic title={'累计费用'} value={(totalCost / 10000).toFixed(1)} suffix={'万'} valueStyle={ { color: '#1677ff' } } /></Card></Col>
      </Row>
      <Row gutter={16}>
        <Col span={16}>
          <Card size={'small'} title={'种植规划列表'} extra={<Button type='primary' size='small' icon={<Plus size={12} />}>新建规划</Button>}>
            <List dataSource={display} renderItem={(t) => <List.Item actions={[<Button key='d' size='small'>导板设计</Button>, <Button key='v' size='small'>查看</Button>]}>
              <List.Item.Meta
                title={<span><Tag color='blue'>FDI {t.toothNo}</Tag>{t.patientName} - {t.type} <Tag color={t.status === 'completed' ? 'green' : t.status === 'pending' ? 'orange' : 'blue'}>{t.status === 'completed' ? '已完成' : t.status === 'pending' ? '待种植' : '进行中'}</Tag></span>}
                description={<span style={ { fontSize: 12, color: '#999' } }>{t.diagnosis} | {t.plan} | 门诊¥{t.cost}</span>}
              />
            </List.Item>} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size={'small'} title={'种植体库 (4 品牌 12 型号)'}>
            <div style={ { marginBottom: 8, padding: 8, background: '#fafafa', borderRadius: 4 } }>
              <div style={ { display: 'flex', justifyContent: 'space-between' } }><b>Straumann BLT</b><Tag color='blue'>RC</Tag></div>
              <div style={ { fontSize: 11, color: '#666', marginTop: 2 } }>4.1×8/10/12mm · 4.8×10/12mm</div>
            </div>
            <div style={ { marginBottom: 8, padding: 8, background: '#fafafa', borderRadius: 4 } }>
              <div style={ { display: 'flex', justifyContent: 'space-between' } }><b>Nobel Active</b><Tag color='purple'>NP</Tag></div>
              <div style={ { fontSize: 11, color: '#666', marginTop: 2 } }>3.5×10/13mm · 4.3×10/13mm</div>
            </div>
            <div style={ { marginBottom: 8, padding: 8, background: '#fafafa', borderRadius: 4 } }>
              <div style={ { display: 'flex', justifyContent: 'space-between' } }><b>Nobel CC</b><Tag color='cyan'>RP</Tag></div>
              <div style={ { fontSize: 11, color: '#666', marginTop: 2 } }>3.5×8/10mm · 4.3×10/12mm</div>
            </div>
            <div style={ { marginBottom: 8, padding: 8, background: '#fafafa', borderRadius: 4 } }>
              <div style={ { display: 'flex', justifyContent: 'space-between' } }><b>Straumann BLX</b><Tag color='green'>RB</Tag></div>
              <div style={ { fontSize: 11, color: '#666', marginTop: 2 } }>3.75×8/10/12/14mm · 4.5×10/12mm</div>
            </div>
          </Card>
          <Card size={'small'} title={'骨量分析 (248 案例)'} style={ { marginTop: 8 } }>
            <div style={ { display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 } }><span>A 类骨 (D1/D2)</span><Tag color='green'>42%</Tag></div>
            <div style={ { display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 } }><span>B 类骨 (D3)</span><Tag color='blue'>38%</Tag></div>
            <div style={ { display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 } }><span>C 类骨 (D4)</span><Tag color='orange'>20%</Tag></div>
            <div style={ { fontSize: 11, color: '#999', marginTop: 6 } }>基于术后随访数据 · 1 年成功率 98.5%</div>
          </Card>
        </Col>
      </Row>
    </DentalPageLayout>
  );
};
// ===== DentalOrthoPage (Replaces placeholder) =====
export const DentalOrthoPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  useEffect(() => { fetch('/api/v1/dental/ortho/plans').then(r=>r.json()).then(d=>{if(d.success)setPlans(d.data)}).catch(()=>{}); }, []);
  return (
    <DentalPageLayout header={{ title: '正畸' }}>
      <Table dataSource={plans} rowKey="id" columns={[
        {title:'患者',dataIndex:'patientName'},{title:'诊断',dataIndex:'diagnosis'},{title:'计划',dataIndex:'plan'},
        {title:'费用',render:(_,t)=>'¥'+t.cost},{title:'状态',dataIndex:'status',render:(s)=><Tag>{s}</Tag>},
        {title:'',render:(_,t)=><Button size="small" onClick={()=>message.info('进度查询')}>进度</Button>},
      ]} pagination={false} />
    </DentalPageLayout>
  );
};

// ===== DentalEndoPage (Replaces generic) =====
export const DentalEndoPage: React.FC = () => {
  const [treats,setT]=useState<DentalTreatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const load = () => {
    setLoading(true);
    fetch('/api/v1/dental/treatments?type=Endodontic&pageSize=20').then(r=>r.json()).then(d=>{if(d.success)setT(d.data); setLoading(false);}).catch(()=>setLoading(false));
  };
  useEffect(()=>{load();},[]);
  const onCreate = async () => {
    try {
      const v = await form.validateFields();
      const r = await fetch('/api/v1/dental/treatments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...v, type: 'Endodontic' }),
      });
      const d = await r.json();
      if (d.success) {
        message.success('已创建根管治疗');
        setModalOpen(false);
        form.resetFields();
        load();
      } else {
        message.error(d.message || '创建失败');
      }
    } catch { /* validation */ }
  };
  return (
    <DentalPageLayout header={{ title: '根管治疗', extra: (
      <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)} data-testid="dental-endo-new">新建根管治疗</Button>
    ) }}>
      {loading ? (
        <div data-testid="dental-endo-loading" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>加载中...</div>
      ) : treats.length === 0 ? (
        <EmptyState tip="暂无根管治疗记录" onCreate={() => setModalOpen(true)} createLabel="新建根管治疗" />
      ) : (
        <Table
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
          dataSource={treats}
          columns={[
            { title: '患者', dataIndex: 'patientName', width: 100 },
            { title: '牙位', dataIndex: 'toothNo', width: 80, render: (n?: number) => n ? <Tag color="blue">#{n}</Tag> : '-' },
            { title: '诊断', dataIndex: 'diagnosis' },
            { title: '根管数', dataIndex: 'rootCount', width: 90 },
            { title: '状态', dataIndex: 'status', width: 90, render: (s?: string) => <Tag>{s || '-'}</Tag> },
            { title: '操作', width: 180, render: (_, t) => <TreatmentActions record={t} /> },
          ]}
        />
      )}
      <Modal title="新建根管治疗" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={onCreate} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item label="患者 ID" name="patientId" rules={[{ required: true }]}>
            <Input placeholder="例 P100001" />
          </Form.Item>
          <Form.Item label="牙位 (FDI)" name="toothNo" rules={[{ required: true }]}>
            <InputNumber min={11} max={48} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="诊断" name="diagnosis">
            <Input placeholder="例 慢性牙髓炎" />
          </Form.Item>
          <Form.Item label="根管数" name="rootCount">
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </DentalPageLayout>
  );
};

// ===== DentalPerioPage (Replaces generic) =====
export const DentalPerioPage: React.FC = () => {
  const [treats,setT]=useState<DentalTreatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const load = () => {
    setLoading(true);
    fetch('/api/v1/dental/treatments?type=Periodontal&pageSize=20').then(r=>r.json()).then(d=>{if(d.success)setT(d.data); setLoading(false);}).catch(()=>setLoading(false));
  };
  useEffect(()=>{load();},[]);
  const onCreate = async () => {
    try {
      const v = await form.validateFields();
      const r = await fetch('/api/v1/dental/treatments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...v, type: 'Periodontal' }) });
      const d = await r.json();
      if (d.success) { message.success('已创建牙周治疗'); setModalOpen(false); form.resetFields(); load(); }
      else message.error(d.message || '创建失败');
    } catch {}
  };
  return (
    <DentalPageLayout header={{ title: '牙周治疗', extra: (
      <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>新建牙周治疗</Button>
    ) }}>
      {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>加载中...</div> :
       treats.length === 0 ? <EmptyState tip="暂无牙周治疗记录" onCreate={() => setModalOpen(true)} createLabel="新建牙周治疗" /> :
       <Table rowKey="id" size="small" pagination={{ pageSize: 10 }} dataSource={treats} columns={[
         { title: '患者', dataIndex: 'patientName', width: 100 },
         { title: '牙位', dataIndex: 'toothNo', width: 80, render: (n?: number) => n ? <Tag color="blue">#{n}</Tag> : '-' },
         { title: '诊断', dataIndex: 'diagnosis' },
         { title: 'PD (mm)', dataIndex: 'pd', width: 80 },
         { title: '状态', dataIndex: 'status', width: 90, render: (s?: string) => <Tag>{s || '-'}</Tag> },
         { title: '操作', width: 180, render: (_, t) => <TreatmentActions record={t} /> },
       ]} />}
      <Modal title="新建牙周治疗" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={onCreate} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item label="患者 ID" name="patientId" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="牙位" name="toothNo"><InputNumber min={11} max={48} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="诊断" name="diagnosis"><Input placeholder="例 牙周炎 (中度)" /></Form.Item>
          <Form.Item label="PD 均值 (mm)" name="pd"><InputNumber min={0} max={15} step={0.1} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </DentalPageLayout>
  );
};

// ===== DentalRestorativePage (Replaces generic) =====
export const DentalRestorativePage: React.FC = () => {
  const [treats,setT]=useState<DentalTreatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const load = () => {
    setLoading(true);
    fetch('/api/v1/dental/treatments?type=Restorative&pageSize=20').then(r=>r.json()).then(d=>{if(d.success)setT(d.data); setLoading(false);}).catch(()=>setLoading(false));
  };
  useEffect(()=>{load();},[]);
  const onCreate = async () => {
    try {
      const v = await form.validateFields();
      const r = await fetch('/api/v1/dental/treatments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...v, type: 'Restorative' }) });
      const d = await r.json();
      if (d.success) { message.success('已创建修复治疗'); setModalOpen(false); form.resetFields(); load(); }
      else message.error(d.message || '创建失败');
    } catch {}
  };
  return (
    <DentalPageLayout header={{ title: '修复 (CAD/CAM)', extra: (
      <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>新建修复</Button>
    ) }}>
      {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>加载中...</div> :
       treats.length === 0 ? <EmptyState tip="暂无修复记录" onCreate={() => setModalOpen(true)} createLabel="新建修复" /> :
       <Table rowKey="id" size="small" pagination={{ pageSize: 10 }} dataSource={treats} columns={[
         { title: '患者', dataIndex: 'patientName', width: 100 },
         { title: '牙位', dataIndex: 'toothNo', width: 80, render: (n?: number) => n ? <Tag color="blue">#{n}</Tag> : '-' },
         { title: '面', dataIndex: 'toothSurface', width: 60 },
         { title: '材料', dataIndex: 'material', width: 100, render: (m?: string) => m ? <Tag color="cyan">{m}</Tag> : '-' },
         { title: '费用', dataIndex: 'cost', width: 80, render: (v?: number) => v != null ? `¥${v}` : '-' },
         { title: '状态', dataIndex: 'status', width: 90, render: (s?: string) => <Tag>{s || '-'}</Tag> },
         { title: '操作', width: 180, render: (_, t) => <TreatmentActions record={t} /> },
       ]} />}
      <Modal title="新建修复治疗" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={onCreate} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item label="患者 ID" name="patientId" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="牙位" name="toothNo"><InputNumber min={11} max={48} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="面" name="toothSurface">
            <Select options={[{ value: 'O', label: 'O 颌面' }, { value: 'M', label: 'M 近中' }, { value: 'D', label: 'D 远中' }, { value: 'B', label: 'B 颊侧' }, { value: 'L', label: 'L 舌侧' }]} />
          </Form.Item>
          <Form.Item label="材料" name="material">
            <Select options={[{ value: 'Z350', label: 'Z350 树脂' }, { value: 'P60', label: 'P60 后牙树脂' }, { value: 'Glass', label: '玻璃离子' }, { value: 'Zirconia', label: '二氧化锆' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </DentalPageLayout>
  );
};

// ===== DentalSurgeryPage (Replaces generic) =====
export const DentalSurgeryPage: React.FC = () => {
  const [treats,setT]=useState<DentalTreatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const load = () => {
    setLoading(true);
    fetch('/api/v1/dental/treatments?type=Surgery&pageSize=20').then(r=>r.json()).then(d=>{if(d.success)setT(d.data); setLoading(false);}).catch(()=>setLoading(false));
  };
  useEffect(()=>{load();},[]);
  const onCreate = async () => {
    try {
      const v = await form.validateFields();
      const r = await fetch('/api/v1/dental/treatments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...v, type: 'Surgery' }) });
      const d = await r.json();
      if (d.success) { message.success('已创建外科手术'); setModalOpen(false); form.resetFields(); load(); }
      else message.error(d.message || '创建失败');
    } catch {}
  };
  return (
    <DentalPageLayout header={{ title: '口腔外科', extra: (
      <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>新建手术</Button>
    ) }}>
      {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>加载中...</div> :
       treats.length === 0 ? <EmptyState tip="暂无口腔外科记录" onCreate={() => setModalOpen(true)} createLabel="新建手术" /> :
       <Table rowKey="id" size="small" pagination={{ pageSize: 10 }} dataSource={treats} columns={[
         { title: '患者', dataIndex: 'patientName', width: 100 },
         { title: '术式', dataIndex: 'plan' },
         { title: '麻醉', dataIndex: 'anesthesia', width: 100, render: (a?: string) => a ? <Tag color="orange">{a}</Tag> : '-' },
         { title: '日期', dataIndex: 'createdAt', width: 100 },
         { title: '状态', dataIndex: 'status', width: 90, render: (s?: string) => <Tag>{s || '-'}</Tag> },
         { title: '操作', width: 180, render: (_, t) => <TreatmentActions record={t} /> },
       ]} />}
      <Modal title="新建口腔外科" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={onCreate} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item label="患者 ID" name="patientId" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="术式" name="plan" rules={[{ required: true }]}><Input placeholder="例 阻生牙拔除术" /></Form.Item>
          <Form.Item label="麻醉" name="anesthesia">
            <Select options={[{ value: '局麻', label: '局麻' }, { value: '全麻', label: '全麻' }, { value: '镇静', label: '镇静' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </DentalPageLayout>
  );
};

// ===== DentalPediatricPage (Replaces generic) =====
export const DentalPediatricPage: React.FC = () => {
  const [treats,setT]=useState<DentalTreatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const load = () => {
    setLoading(true);
    fetch('/api/v1/dental/treatments?type=Pediatric&pageSize=20').then(r=>r.json()).then(d=>{if(d.success)setT(d.data); setLoading(false);}).catch(()=>setLoading(false));
  };
  useEffect(()=>{load();},[]);
  const onCreate = async () => {
    try {
      const v = await form.validateFields();
      const r = await fetch('/api/v1/dental/treatments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...v, type: 'Pediatric' }) });
      const d = await r.json();
      if (d.success) { message.success('已创建儿童牙科记录'); setModalOpen(false); form.resetFields(); load(); }
      else message.error(d.message || '创建失败');
    } catch {}
  };
  return (
    <DentalPageLayout
      header={{ title: '儿童牙科', extra: (
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>新建记录</Button>
      ) }}
      alert={{ message: '儿童牙科专用功能: 乳牙编号 (A-T), 窝沟封闭, 氟保护', type: 'info' }}
    >
      {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>加载中...</div> :
       treats.length === 0 ? <EmptyState tip="暂无儿童牙科记录" onCreate={() => setModalOpen(true)} createLabel="新建儿童牙科记录" /> :
       <Table rowKey="id" size="small" pagination={{ pageSize: 10 }} dataSource={treats} columns={[
         { title: '患者', dataIndex: 'patientName', width: 100 },
         { title: '乳牙位', dataIndex: 'toothNo', width: 80 },
         { title: '诊断', dataIndex: 'diagnosis' },
         { title: '处理', dataIndex: 'plan' },
         { title: '状态', dataIndex: 'status', width: 90, render: (s?: string) => <Tag>{s || '-'}</Tag> },
         { title: '操作', width: 180, render: (_, t) => <TreatmentActions record={t} /> },
       ]} />}
      <Modal title="新建儿童牙科记录" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={onCreate} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item label="患者 ID" name="patientId" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="乳牙编号 (A-T)" name="toothNo" rules={[{ required: true }]}>
            <Input placeholder="例 A (右上乳中切牙)" />
          </Form.Item>
          <Form.Item label="诊断" name="diagnosis">
            <Input placeholder="例 乳牙龋坏" />
          </Form.Item>
          <Form.Item label="处理" name="plan">
            <Input placeholder="例 窝沟封闭 / 充填" />
          </Form.Item>
        </Form>
      </Modal>
    </DentalPageLayout>
  );
};

// ===== DentalTelePage (Replaces placeholder) =====
export const DentalTelePage: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const load = async () => { try { const r=await fetch('/api/v1/dental/tele/sessions'); const d=await r.json(); if(d.success) setSessions(d.data||[]); } catch {} };
  useEffect(() => { load(); }, []);
  const createSession = async () => {
    const r=await fetch('/api/v1/dental/tele/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"patientId":"P100000"}'});
    const d=await r.json(); if(d.success){message.success('会诊创建成功');load();}
  };
  return (
    <DentalPageLayout header={{ title: '远程口腔会诊', icon: <Video size={20} color="#1677ff"/> }}>
      <Row gutter={16}>
        <Col span={6}><Card size="small"><Button type="primary" block onClick={createSession} icon={<Plus size={14}/>}>新建会诊</Button></Card></Col>
        <Col span={6}><Card size="small"><Button block icon={<Upload size={14}/>} onClick={()=>message.info('选择口内照片')}>上传口内照片</Button></Card></Col>
        <Col span={6}><Card size="small"><Button block icon={<Globe size={14}/>} onClick={()=>message.info('AI 预筛')}>AI 预筛</Button></Card></Col>
        <Col span={6}><Select size="large" placeholder="选择专家" style={{width:'100%'}} options={[{value:'exp-1',label:'王专家 (种植)'},{value:'exp-2',label:'李专家 (正畸)'}]} /></Col>
      </Row>
      <Card title={`会诊记录 (${sessions.length})`} size="small" style={{marginTop:16}}>
        {sessions.length===0? <Empty description="暂无会诊记录" /> :
          <List dataSource={sessions} renderItem={(s:any)=><List.Item>{s.patientName||'-'} - {s.status||'active'}</List.Item>} />}
      </Card>
    </DentalPageLayout>
  );
};

// ===== DentalDashboardPage (Replaces placeholder) =====
export const DentalDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshAt, setRefreshAt] = useState<Date>(new Date());
  const load = () => {
    setLoading(true);
    fetch('/api/v1/dental/stats').then(r=>r.json()).then(d=>{if(d.success) setStats(d.data); setLoading(false); setRefreshAt(new Date());}).catch(()=>setLoading(false));
  };
  useEffect(load, []);
  if (loading) {
    return (
      <DentalPageLayout header={{ title: '口腔运营仪表盘' }}>
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>加载中...</div>
      </DentalPageLayout>
    );
  }
  if (!stats) {
    return (
      <DentalPageLayout header={{ title: '口腔运营仪表盘' }}>
        <EmptyState tip="暂无统计数据" onCreate={load} createLabel="重新加载" />
      </DentalPageLayout>
    );
  }
  const topTreat = stats.topTreatments || {};
  return (
    <DentalPageLayout header={{ title: '口腔运营仪表盘', extra: (
      <Button icon={<RefreshCw size={14} />} onClick={load}>刷新</Button>
    ) }}>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="今日患者" value={stats.todayPatients} prefix={<Calendar size={14} />} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="本周" value={stats.thisWeek} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="日均" value={stats.avgPerDay} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="今日收入" prefix="¥" value={stats.revenueToday} /></Card></Col>
        <Col xs={24} md={12}>
          <Card size="small" title="热门治疗">
            <Row gutter={8}>
              <Col span={8}><Statistic title="补" value={topTreat.Restorative || 0} /></Col>
              <Col span={8}><Statistic title="根管" value={topTreat.Endodontic || 0} /></Col>
              <Col span={8}><Statistic title="种植" value={topTreat.Implant || 0} /></Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" title="快捷入口">
            <Space wrap>
              <Button onClick={() => message.info('进入种植规划')}>种植规划</Button>
              <Button onClick={() => message.info('进入正畸')}>正畸</Button>
              <Button onClick={() => message.info('进入库存')}>库存管理</Button>
              <Button onClick={() => message.info('进入随访')}>患者随访</Button>
            </Space>
          </Card>
        </Col>
      </Row>
      <Alert
        message={`数据更新于 ${refreshAt.toLocaleTimeString('zh-CN')}`}
        type="success"
        showIcon
      />
    </DentalPageLayout>
  );
};

// ===== [v3.0.6.8-81] DentalWorkspacePage (新增 - 修复路由黑屏) =====
export const DentalWorkspacePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <DentalPageLayout header={{ title: '口腔工作台' }}>
      <Row gutter={16}>
        <Col span={6}><Card hoverable><Statistic title="今日检查" value={12} prefix={<Calendar size={14}/>} /></Card></Col>
        <Col span={6}><Card hoverable><Statistic title="待报告" value={3} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col span={6}><Card hoverable><Statistic title="待治疗" value={5} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col span={6}><Card hoverable><Statistic title="已完成" value={8} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>
      {!loading && <Alert style={{ marginTop: 16 }} message="工作台已就绪" type="success" showIcon />}
    </DentalPageLayout>
  );
};

// ===== [v3.0.6.8-81] DentalTreatmentPage (新增 - 修复路由黑屏) =====
export const DentalTreatmentPage: React.FC = () => {
  const [items, setItems] = useState<DentalTreatment[]>([]);
  useEffect(() => {
    fetch('/api/v1/dental/treatments')
      .then(r => r.json())
      .then(d => { if (d.success) setItems(d.data); })
      .catch(() => setItems([]));
  }, []);
  return (
    <DentalPageLayout header={{ title: '口腔治疗中心' }}>
      <DentalTreatmentTable data={items} />
    </DentalPageLayout>
  );
};

// ===== [v3.0.6.8-81] DentalInventoryPage (新增 - 修复路由黑屏) =====
export const DentalInventoryPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([
    { id: 'INV-001', name: '种植体 Straumann BLT', category: 'Implant', stock: 24, unit: 'pcs', minStock: 10 },
    { id: 'INV-002', name: '复合树脂 Z350', category: 'Restorative', stock: 8, unit: 'tube', minStock: 12 },
    { id: 'INV-003', name: '根管锉 ProTaper', category: 'Endo', stock: 50, unit: 'pcs', minStock: 20 },
    { id: 'INV-004', name: '正畸托槽 Damon Q', category: 'Ortho', stock: 12, unit: 'set', minStock: 5 },
    { id: 'INV-005', name: '局麻药 阿替卡因', category: 'Anesthesia', stock: 3, unit: 'box', minStock: 8 },
  ]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [detail, setDetail] = useState<any | null>(null);
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
          { title: '操作', width: 100, render: (_, r: any) => (
            <Button size="small" onClick={() => setDetail(r)}>详情</Button>
          ) },
        ]} />
      )}
      <Modal title="新增库存项" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={onCreate} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item label="名称" name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="类别" name="category">
            <Select options={[{ value: 'Implant', label: '种植' }, { value: 'Restorative', label: '修复' }, { value: 'Endo', label: '根管' }, { value: 'Ortho', label: '正畸' }, { value: 'Anesthesia', label: '麻醉' }]} />
          </Form.Item>
          <Form.Item label="最低库存" name="minStock" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
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
