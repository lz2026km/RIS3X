import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Modal, Form, Input, InputNumber, message } from 'antd';
import { Plus as PlusIcon } from 'lucide-react';
import { DentalPageLayout, EmptyState, TreatmentActions } from './DentalShared';
import type { DentalTreatment } from './DentalShared';

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
      const r = await fetch('/api/v1/dental/treatments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...v, type: 'Endodontic' }) });
      const d = await r.json();
      if (d.success) { message.success('已创建根管治?); setModalOpen(false); form.resetFields(); load(); }
      else message.error(d.message || '创建失败');
    } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
  };
  return (
    <DentalPageLayout header={{ title: '根管治疗', extra: (
      <Button type="primary" icon={<PlusIcon size={14} />} onClick={() => setModalOpen(true)}>新建根管治疗</Button>
    ) }}>
      {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>加载?..</div> :
       treats.length === 0 ? <EmptyState tip="暂无根管治疗记录" onCreate={() => setModalOpen(true)} createLabel="新建根管治疗" /> :
       <Table rowKey="id" size="small" pagination={{ pageSize: 10 }} dataSource={treats} columns={[
         { title: '患者, dataIndex: 'patientName', width: 100 },
         { title: '牙位', dataIndex: 'toothNo', width: 80, render: (n?: number) => n ? <Tag color="blue">#{n}</Tag> : '-' },
         { title: '诊断', dataIndex: 'diagnosis' },
         { title: '根管?, dataIndex: 'rootCount', width: 90 },
         { title: '状?, dataIndex: 'status', width: 90, render: (s?: string) => <Tag>{s || '-'}</Tag> },
         { title: '操作', width: 180, render: (_, t) => <TreatmentActions record={t} /> },
       ]} />}
      <Modal title="新建根管治疗" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={onCreate} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item label="患者ID" name="patientId" rules={[{ required: true }]}><Input placeholder="?P100001" /></Form.Item>
          <Form.Item label="牙位 (FDI)" name="toothNo" rules={[{ required: true }]}><InputNumber min={11} max={48} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="诊断" name="diagnosis"><Input placeholder="?慢性牙髓炎" /></Form.Item>
          <Form.Item label="根管? name="rootCount"><InputNumber min={1} max={5} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </DentalPageLayout>
  );
};

export default DentalEndoPage;
