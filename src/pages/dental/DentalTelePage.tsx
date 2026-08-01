import React, { useState, useEffect } from 'react';
import { Card, Button, Row, Col, Select, List, Empty, message } from 'antd';
import { Plus, Upload, Globe, Video } from 'lucide-react';
import { DentalPageLayout } from './DentalShared';

export const DentalTelePage: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const load = async () => { try { const r=await fetch('/api/v1/dental/tele/sessions'); const d=await r.json(); if(d.success) setSessions(d.data||[]); } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); } };
  useEffect(() => { load(); }, []);
  const createSession = async () => {
    const r=await fetch('/api/v1/dental/tele/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"patientId":"P100000"}'});
    const d=await r.json(); if(d.success){message.success('会诊创建成功');load();}
  };
  return (
    <DentalPageLayout header={{ title: '远程口腔会诊', icon: <Video size={20} color="#1677ff"/> }}>
      <Row gutter={16}>
        <Col span={6}><Card size="small"><Button type="primary" block onClick={createSession} icon={<Plus size={14}/>}>新建会诊</Button></Card></Col>
        <Col span={6}><Card size="small"><Button block icon={<Upload size={14}/>} disabled>上传口内照片</Button></Card></Col>
        <Col span={6}><Card size="small"><Button block icon={<Globe size={14}/>} disabled>AI 预筛</Button></Card></Col>
        <Col span={6}><Select size="large" placeholder="选择专家" style={{width:'100%'}} options={[{value:'exp-1',label:'王专?(种植)'},{value:'exp-2',label:'李专?(正畸)'}]} /></Col>
      </Row>
      <Card title={`会诊记录 (${sessions.length})`} size="small" style={{marginTop:16}}>
        {sessions.length===0? <Empty description="暂无会诊记录" /> :
          <List dataSource={sessions} renderItem={(s:any)=><List.Item>{s.patientName||'-'} - {s.status||'active'}</List.Item>} />}
      </Card>
    </DentalPageLayout>
  );
};

export default DentalTelePage;
