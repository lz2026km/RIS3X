// [v3.0.6.8-71] 审计合规中心
import React, { useState } from 'react';
import { Card, Space, Tag, Table, Button, Row, Col, Statistic, Badge, Modal, Form, Select, Input, DatePicker, message, Timeline, Alert, Progress } from 'antd';
import { Shield, FileSearch, UserCheck, Clock, AlertTriangle, CheckCircle2, Download, Filter, Eye, Search } from 'lucide-react';

export const AuditCompliancePage: React.FC = () => {
  const [detailModal, setDetailModal] = useState<any>(null);
  const [auditLogs] = useState([
    { id:'AUD-001', user:'Dr. Wang', action:'VIEW_STUDY', target:'CBCT-20260628-01', ip:'192.168.1.101', timestamp:'2026-06-28 09:15:23', result:'allowed', reason:'Clinical care' },
    { id:'AUD-002', user:'Nurse Li', action:'EXPORT_IMAGE', target:'CT-20260627-03', ip:'192.168.1.102', timestamp:'2026-06-28 09:32:17', result:'denied', reason:'No export permission' },
    { id:'AUD-003', user:'Dr. Zhang', action:'MODIFY_REPORT', target:'RPT-20260626-05', ip:'192.168.1.103', timestamp:'2026-06-28 10:05:44', result:'allowed', reason:'Report revision' },
    { id:'AUD-004', user:'Admin Liu', action:'USER_ROLE_CHANGE', target:'user: nurse_zhao', ip:'192.168.1.200', timestamp:'2026-06-28 11:20:00', result:'allowed', reason:'Role upgrade' },
    { id:'AUD-005', user:'Ext-API', action:'API_ACCESS', target:'/api/patients/search', ip:'10.0.0.55', timestamp:'2026-06-28 12:00:12', result:'denied', reason:'Rate limit exceeded' },
  ]);
  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Shield size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>Audit & Compliance Center</span>
        <Tag color="cyan">v3.0.6.8-71</Tag>
        <Tag color="red" icon={<AlertTriangle size={10}/>}>HIPAA</Tag>
        <Tag color="orange">Grade 3 Class A</Tag>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="Today Events" value={auditLogs.length} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Denied" value={auditLogs.filter(l=>l.result==='denied').length} valueStyle={{color:'#ff4d4f'}} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Data Exports" value="7" /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Breach Score" value="98" suffix="/100" /><Progress percent={98} size="small" strokeColor="#52c41a" /></Card></Col>
      </Row>
      <Card size="small" title={<Space><FileSearch size={14}/>Audit Trail</Space>} extra={<Space><Button icon={<Filter size={12}/>} onClick={() => message.warning('功能建设中')}>Filter</Button><Button icon={<Download size={12}/>} onClick={() => message.warning('功能建设中')}>Export</Button></Space>}>
        <Table dataSource={auditLogs} rowKey="id" pagination={false}
          columns={[
            {title:'ID',dataIndex:'id'},{title:'User',dataIndex:'user'},
            {title:'Action',dataIndex:'action',render:(a:string)=><Tag color={a.startsWith('VIEW')?'blue':a.startsWith('EXPORT')?'orange':a.startsWith('MODIFY')?'purple':a.startsWith('USER')?'cyan':'default'}>{a}</Tag>},
            {title:'Target',dataIndex:'target'},{title:'IP',dataIndex:'ip'},
            {title:'Time',dataIndex:'timestamp'},
            {title:'Result',dataIndex:'result',render:(r:string)=><Badge status={r==='allowed'?'success':'error'} text={r} />},
            {title:'Action',render:(_,r:any)=><Button size="small" onClick={()=>setDetailModal(r)}><Eye size={10}/></Button>},
          ]} />
      </Card>
      <Modal title="Audit Detail" open={!!detailModal} onCancel={()=>setDetailModal(null)} footer={null} width={500}>
        {detailModal && <div><Timeline items={[
          {key:'evt-id', content:<><b>Event ID</b><br/>{detailModal.id}</>},
          {key:'evt-user', content:<><b>User</b><br/>{detailModal.user} @ {detailModal.ip}</>},
          {key:'evt-action', content:<><b>Action</b><br/>{detailModal.action} on {detailModal.target}</>},
          {key:'evt-time', content:<><b>Timestamp</b><br/>{detailModal.timestamp}</>},
          {key:'evt-result', content:<><b>Result: </b><Tag color={detailModal.result==='allowed'?'green':'red'}>{detailModal.result}</Tag><br/><i>{detailModal.reason}</i></>},
        ]} /></div>}
      </Modal>
    </div>
  );
};
export default AuditCompliancePage;
