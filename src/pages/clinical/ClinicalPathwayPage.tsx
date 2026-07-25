// [v3.0.6.8-70] 临床路径管理
import React, { useState } from 'react';
import { Card, Space, Tag, Table, Button, Row, Col, Statistic, Progress, Steps, Badge, Tooltip, Modal, Form, Input, Select, message, Timeline } from 'antd';
import { Route, CheckCircle2, Clock, Users, Activity, Play, PauseCircle } from 'lucide-react';

interface Pathway {
  id: string; name: string; dept: string; phase: string; progress: number; status: string; patients: number;
}
interface PatientPathway {
  id: string; patient: string; pathway: string; step: number; totalSteps: number; status: string; enteredAt: string; variance: string | null;
}

export const ClinicalPathwayPage: React.FC = () => {
  const [detail, setDetail] = useState<PatientPathway | null>(null);
  const [pathways] = useState<Pathway[]>([
    { id:'PW-01', name:'Cataract surgery clinical pathway', dept:'Ophthalmology', phase:'Pre-op eval', progress:60, status:'active', patients:12 },
    { id:'PW-02', name:'CBCT-guided implant placement', dept:'Oral Surgery', phase:'Implant placement', progress:85, status:'active', patients:8 },
    { id:'PW-03', name:'Stroke imaging fast track', dept:'Radiology', phase:'Image acquisition', progress:40, status:'active', patients:5 },
    { id:'PW-04', name:'Orthodontic treatment plan', dept:'Orthodontics', phase:'Diagnostic records', progress:25, status:'paused', patients:15 },
  ]);
  const [patients] = useState<PatientPathway[]>([
    { id:'PP-001', patient:'Zhang Wei', pathway:'Cataract - OD', step:3, totalSteps:8, status:'on-track', enteredAt:'2026-06-20', variance:null },
    { id:'PP-002', patient:'Li Na', pathway:'Implant #36', step:5, totalSteps:7, status:'on-track', enteredAt:'2026-06-18', variance:null },
    { id:'PP-003', patient:'Wang Fang', pathway:'Cataract - OS', step:2, totalSteps:8, status:'delayed', enteredAt:'2026-06-22', variance:'Lab pending >24h' },
    { id:'PP-004', patient:'Liu Qiang', pathway:'CBCT Stroke', step:2, totalSteps:4, status:'on-track', enteredAt:'2026-06-28', variance:null },
  ]);

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Route size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>Clinical Pathway Management</span>
        <Tag color="cyan">v3.0.6.8-70</Tag>
        <Tag color="green" icon={<Activity size={10}/>}>CP-based care</Tag>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="Active Pathways" value={pathways.filter(p=>p.status==='active').length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Patients in CP" value={patients.length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="On Track" value={patients.filter(p=>p.status==='on-track').length} valueStyle={{color:'#52c41a'}} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Delayed" value={patients.filter(p=>p.status==='delayed').length} valueStyle={{color:'#ff4d4f'}} /></Card></Col>
      </Row>
      <Card size="small" title="Defined Pathways" style={{ marginBottom: 16 }}>
        <Table dataSource={pathways} rowKey="id" pagination={false}
          columns={[
            {title:'Name',dataIndex:'name'},{title:'Dept',dataIndex:'dept'},
            {title:'Current Phase',dataIndex:'phase'},
            {title:'Progress',dataIndex:'progress',render:(p:number)=><Progress percent={p} size="small" />},
            {title:'Patients',dataIndex:'patients'},
            {title:'Status',dataIndex:'status',render:(s:string)=><Badge status={s==='active'?'processing':'default'} text={s} />},
            {title:'Action',render:()=><Space><Button size="small" icon={<Play size={10}/>} onClick={() => message.success('路径已激活')}>Activate</Button><Button size="small" icon={<PauseCircle size={10}/>} onClick={() => message.success('路径已暂停')}>Pause</Button></Space>},
          ]} />
      </Card>
      <Card extra={<Button type="primary" onClick={() => message.success('患者登记已提交')}>+ Enroll Patient</Button>} size="small" title="Patient Pathway Tracking">
        <Table dataSource={patients} rowKey="id" pagination={false}
          columns={[
            {title:'Patient',dataIndex:'patient'},{title:'Pathway',dataIndex:'pathway'},
            {title:'Step',render:(_,r:PatientPathway)=><Tag>{r.step}/{r.totalSteps}</Tag>},
            {title:'Status',dataIndex:'status',render:(s:string)=><Badge status={s==='on-track'?'success':s==='delayed'?'error':'default'} text={s} />},
            {title:'Entered',dataIndex:'enteredAt'},
            {title:'Variance',dataIndex:'variance',render:(v:string|null)=><span style={{color:v?'#ff4d4f':'#52c41a',fontSize:12}}>{v || 'None'}</span>},
            {title:'Action',render:(_,r:PatientPathway)=><Button size="small" onClick={()=>setDetail(r)}>View Steps</Button>},
          ]} />
      </Card>
      <Modal title={`Pathway Detail - ${detail?.patient}`} open={!!detail} onCancel={()=>setDetail(null)} footer={null} width={480}>
        {detail && <Timeline items={Array.from({length:detail.totalSteps},(_,i)=>({children:<><b>Step {i+1}</b><Tag color={i+1<=detail.step?'green':'default'}>{i+1<=detail.step?'Done':'Pending'}</Tag></>,dot:i+1<=detail.step?<CheckCircle2 size={14} color="#52c41a"/>:<Clock size={14}/>}))} />}
      </Modal>
    </div>
  );
};
export default ClinicalPathwayPage;
