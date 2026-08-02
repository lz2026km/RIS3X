// [v3.0.6.8-69] 全院资源排程中心
import React, { useState } from 'react';
import { Card, Space, Tag, Button, Table, Calendar, Col, Row, Select, Statistic, Badge, Tooltip, Modal, Form, message, List, Progress } from 'antd';
import { CalendarDays, Clock, Monitor, Syringe, Stethoscope, Users } from 'lucide-react';

export const SchedulingCenterPage: React.FC = () => {
  const [date, setDate] = useState('2026-06-28');
  const [booking, setBooking] = useState(false);
  const [resources] = useState([
    { id: 'CBCT-01', name: 'CBCT 1号机', type: '设备', dept: '放射科', usage: 85, status: 'online', bookings: ['09:00-10:00','13:00-14:00'] },
    { id: 'OP-01', name: '口腔手术室 1', type: '诊室', dept: '口腔外科', usage: 60, status: 'available', bookings: ['10:00-12:00'] },
    { id: 'OCT-01', name: 'OCT 设备', type: '设备', dept: '眼科', usage: 45, status: 'online', bookings: [] },
    { id: 'XRAY-01', name: 'DR 1号机', type: '设备', dept: '放射科', usage: 92, status: 'online', bookings: ['08:00-12:00','13:00-17:00'] },
  ]);

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <CalendarDays size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>全院资源排程中心</span>
        <Tag color="cyan">v3.0.6.8-69</Tag>
        <Tag color="green">实时占用</Tag>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="设备总数" value={12} /></Card></Col>
        <Col span={6}><Card><Statistic title="在线" value={10} styles={{ content: { color:'#52c41a' } }} /></Card></Col>
        <Col span={6}><Card><Statistic title="今日预约" value={48} /></Card></Col>
        <Col span={6}><Card><Statistic title="平均利用率" value={71} suffix="%" /><Progress percent={71} size="small" /></Card></Col>
      </Row>
      <Card extra={<Button type="primary" onClick={()=>setBooking(true)}>+ 预约资源</Button>}
            size="small" title={<Space><Clock size={14}/>资源占用表 ({date})</Space>}>
        <Table dataSource={resources} rowKey="id" pagination={false}
          columns={[
            {title:'资源',dataIndex:'name'},{title:'类型',dataIndex:'type',render:(t)=><Tag>{t}</Tag>},
            {title:'科室',dataIndex:'dept',render:(d)=><Tag color="purple">{d}</Tag>},
            {title:'状态',dataIndex:'status',render:(s)=><Badge status={s==='online'?'success':'default'} text={s} />},
            {title:'利用率',dataIndex:'usage',render:(u)=><Progress percent={u} size="small" strokeColor={u>80?'#ff4d4f':u>60?'#faad14':'#52c41a'} />},
            {title:'占用时段',dataIndex:'bookings',render:(b:any)=><Space size={2}>{b.map((t:string,i:number)=><Tag key={i}>{t}</Tag>)}</Space>},
            {title:'操作',render:()=><Space><Button size="small">占用</Button><Button size="small" type="primary">预约</Button></Space>},
          ]} />
      </Card>
      <Modal title="预约资源" open={booking} onCancel={()=>setBooking(false)} onOk={()=>{message.success('资源预约已提交');setBooking(false)}} width={450}>
        <Form layout="vertical" size="small">
          <Form.Item label="资源"><Select placeholder="选择资源" options={resources.map(r=>({value:r.id,label:r.name}))} /></Form.Item>
          <Form.Item label="科室"><Select options={['放射科','口腔科','口腔外科','眼科','正畸科'].map(d=>({value:d,label:d}))} /></Form.Item>
          <Form.Item label="时段"><Select options={Array.from({length:8},(_,i)=>{const h=i+8;return {value:`${h}:00-${h+1}:00`,label:`${h}:00-${h+1}:00`}})} /></Form.Item>
          <Form.Item label="患者"><Select placeholder="选择患者" options={[{value:'P01',label:'张伟 (M/35)'},{value:'P02',label:'李娜 (F/28)'}]} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default SchedulingCenterPage;
