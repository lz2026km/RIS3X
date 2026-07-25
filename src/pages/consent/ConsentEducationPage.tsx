// [v3.0.6.8-79] 知情同意/患者教育管理
import React, { useState } from 'react';
import { Card, Space, Tag, Row, Col, Table, Button, Tabs, Badge, Modal, Form, Select, DatePicker, Progress, Timeline, message, Statistic, Upload, List, Tooltip } from 'antd';
import { FileSignature, BookOpen, CheckCircle2, Clock, AlertCircle, FileText, Download, Send, Eye } from 'lucide-react';

export const ConsentEducationPage: React.FC = () => {
  const [consents, setConsents] = useState([
    { id:'C-001', patient:'Zhang Wei', type:'CT Contrast', procedure:'Chest CT w/ contrast', signedAt:'2026-06-28 09:15', status:'signed', witness:'Nurse Li' },
    { id:'C-002', patient:'Li Na', type:'Surgery', procedure:'Cataract OD', signedAt:null, status:'pending', witness:null },
    { id:'C-003', patient:'Wang Fang', type:'Anesthesia', procedure:'General anesthesia', signedAt:'2026-06-27 14:00', status:'signed', witness:'Dr. Zhang' },
    { id:'C-004', patient:'Liu Qiang', type:'Blood Transfusion', procedure:'2 units RBC', signedAt:null, status:'refused', witness:'Dr. Wang' },
  ]);
  const [materials] = useState([
    { id:'M-001', title:'About CT Scan', lang:'zh-CN', category:'Imaging', pages:4, views:142, format:'PDF' },
    { id:'M-002', title:'Cataract Surgery Prep', lang:'zh-CN', category:'Surgery', pages:6, views:89, format:'PDF + Video' },
    { id:'M-003', title:'Contrast Dye Safety', lang:'zh-CN', category:'Imaging', pages:3, views:234, format:'PDF' },
    { id:'M-004', title:'Dental Implant Aftercare', lang:'en-US', category:'Dental', pages:5, views:67, format:'PDF' },
  ]);
  const [consentModal, setConsentModal] = useState(false);
  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <FileSignature size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>Consent & Education Center</span>
        <Tag color="cyan">v3.0.6.8-79</Tag>
        <Tag color="green">e-Signature</Tag>
      </Space>
      <Row gutter={16} style={{marginBottom:16}}>
        <Col span={4}><Card size="small"><Statistic title="Pending" value={consents.filter(c=>c.status==='pending').length} valueStyle={{color:'#faad14'}} prefix={<Clock size={14}/>} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Signed" value={consents.filter(c=>c.status==='signed').length} valueStyle={{color:'#52c41a'}} prefix={<CheckCircle2 size={14}/>} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Refused" value={consents.filter(c=>c.status==='refused').length} valueStyle={{color:'#ff4d4f'}} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Materials" value={materials.length} prefix={<BookOpen size={14}/>} /></Card></Col>
      </Row>
      <Card size="small" title={<Space><FileSignature size={14}/>Patient Consents</Space>} extra={<Button type="primary" onClick={() => setConsentModal(true)}>+ New Consent</Button>}>
        <Table dataSource={consents} rowKey="id" pagination={false}
          columns={[
            {title:'Patient',dataIndex:'patient'},{title:'Type',dataIndex:'type',render:(t:string)=><Tag color="blue">{t}</Tag>},
            {title:'Procedure',dataIndex:'procedure',width:200},
            {title:'Signed',dataIndex:'signedAt',render:(s:string|null)=>s||<span style={{color:'#999'}}>—</span>},
            {title:'Witness',dataIndex:'witness',render:(w:string|null)=>w||'—'},
            {title:'Status',dataIndex:'status',render:(s:string)=><Badge status={s==='signed'?'success':s==='pending'?'processing':'error'} text={s} />},
            {title:'Action',render:(_,r:any)=><Space>{r.status==='pending' && <Button size="small" type="primary" onClick={() => { message.success('签署已发送'); setConsents(prev => prev.map(c => c.id === r.id ? {...c, status:'signed', signedAt: new Date().toISOString(), witness:'Dr. System'} : c)); }}>Sign Now</Button>}<Button size="small" icon={<Eye size={10}/>} onClick={() => message.info('查看知情同意书: ' + r.id)}>View</Button><Button size="small" icon={<Download size={10}/>} onClick={() => message.success('PDF已下载: ' + r.id)}>PDF</Button></Space>},
          ]} />
      </Card>
      <Card size="small" title={<Space><BookOpen size={14}/>Education Materials</Space>} extra={<Button icon={<Upload size={12}/>} onClick={() => message.success('上传功能已打开')}>Upload</Button>} style={{marginTop:16}}>
        <Table dataSource={materials} rowKey="id" pagination={false}
          columns={[
            {title:'Title',dataIndex:'title',width:200},{title:'Lang',dataIndex:'lang',render:(l:string)=><Tag>{l}</Tag>},
            {title:'Category',dataIndex:'category',render:(c:string)=><Tag color={c==='Imaging'?'blue':c==='Surgery'?'red':'purple'}>{c}</Tag>},
            {title:'Pages',dataIndex:'pages'},{title:'Views',dataIndex:'views'},
            {title:'Format',dataIndex:'format'},{title:'Action',render:(_,r:any)=><Space><Button size="small" onClick={() => message.info('预览: ' + r.title)}>Preview</Button><Button size="small" icon={<Send size={10}/>} onClick={() => message.success('已发送给患者: ' + r.title)}>Send to Patient</Button></Space>},
          ]} />
      </Card>
      <Modal title="New Consent" open={consentModal} onOk={() => { setConsents(prev => [...prev, { id:'C-'+Date.now(), patient:'New Patient', type:'General', procedure:'Standard procedure', signedAt:null, status:'pending', witness:null }]); setConsentModal(false); message.success('Consent created'); }} onCancel={() => setConsentModal(false)}>
        <p>New consent form will be created for patient signature.</p>
      </Modal>
    </div>
  );
};
export default ConsentEducationPage;