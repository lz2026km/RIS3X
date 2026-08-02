// [v3.0.6.8-80] 患者安全与质量指标看板
import React, { useState } from 'react';
import { Card, Space, Tag, Row, Col, Statistic, Progress, Table, Badge, List, Timeline, Alert, Segmented, Gauge } from 'antd';
import { Shield, AlertTriangle, Activity, TrendingUp, TrendingDown, Heart, CheckCircle2, Clock, Users, Stethoscope } from 'lucide-react';

export const PatientSafetyDashboardPage: React.FC = () => {
  const [range, setRange] = useState('today');
  const [indicators] = useState([
    { id:'PSI-01', name:'Patient Falls', value:2, target:0, status:'amber', trend:'up', rate:'0.05%' },
    { id:'PSI-02', name:'HAIs - Central Line', value:0, target:0, status:'green', trend:'flat', rate:'0.00%' },
    { id:'PSI-03', name:'Medication Errors', value:1, target:0, status:'green', trend:'down', rate:'0.02%' },
    { id:'PSI-04', name:'Surgical Site Infection', value:0, target:0, status:'green', trend:'flat', rate:'0.00%' },
    { id:'PSI-05', name:'Pressure Ulcers', value:3, target:2, status:'amber', trend:'up', rate:'0.07%' },
    { id:'PSI-06', name:'Wrong-Site Surgery', value:0, target:0, status:'green', trend:'flat', rate:'0.00%' },
  ]);
  const [incidents] = useState([
    { id:'INC-001', time:'10:23', type:'Patient Fall', patient:'R-102 Wang XX', severity:'moderate', ward:'Internal Med', status:'investigating' },
    { id:'INC-002', time:'09:15', type:'Med Near-miss', patient:'R-205 Li XX', severity:'low', ward:'Oncology', status:'closed' },
    { id:'INC-003', time:'08:30', type:'Pressure Ulcer Stage II', patient:'R-310 Zhang XX', severity:'moderate', ward:'ICU', status:'open' },
    { id:'INC-004', time:'07:45', type:'Lab Specimen Error', patient:'R-412 Chen XX', severity:'low', ward:'Surgery', status:'closed' },
  ]);
  const [alerts] = useState([
    { id:'AL-001', level:'critical', msg:'Ventilator alarm - R-105', time:'1m ago' },
    { id:'AL-002', level:'warning', msg:'Lab critical value - K+ 6.8 R-208', time:'5m ago' },
    { id:'AL-003', level:'info', msg:'Isolation precaution - R-310', time:'15m ago' },
  ]);
  const statusColor: Record<string,string> = { green:'#52c41a', amber:'#faad14', red:'#ff4d4f' };
  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Shield size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>Patient Safety & Quality Dashboard</span>
        <Tag color="cyan">v3.0.6.8-80</Tag>
        <Tag color="red" icon={<AlertTriangle size={10}/>}>Real-time</Tag>
        <Segmented value={range} onChange={setRange as any} options={[{value:'today',label:'Today'},{value:'week',label:'Week'},{value:'month',label:'Month'}]} />
      </Space>
      <Row gutter={16} style={{marginBottom:16}}>
        <Col span={4}><Card size="small"><Statistic title="Safety Score" value={94} suffix="/100" prefix={<Shield size={14}/>} styles={{ content: { color:'#52c41a' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Open Incidents" value={incidents.filter(i=>i.status==='open'||i.status==='investigating').length} styles={{ content: { color:'#faad14' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Closed Today" value={incidents.filter(i=>i.status==='closed').length} styles={{ content: { color:'#52c41a' } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Critical Alerts" value={alerts.filter(a=>a.level==='critical').length} styles={{ content: { color:'#ff4d4f' } }} /></Card></Col>
      </Row>
      <Row gutter={16} style={{marginBottom:16}}>
        <Col span={16}>
          <Card size="small" title={<Space><Activity size={14}/>Quality Indicators</Space>}>
            <Row gutter={[12,12]}>
              {indicators.map(i=>(
                <Col span={8} key={i.id}>
                  <Card size="small" style={{borderLeft:`4px solid ${statusColor[i.status]}`}}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{i.name}</div>
                    <Space>
                      <span style={{fontSize:24,fontWeight:700,color:statusColor[i.status]}}>{i.value}</span>
                      <Tag color={i.status==='green'?'success':i.status==='amber'?'warning':'error'}>{i.rate}</Tag>
                      {i.trend==='up'?<TrendingUp size={12} color="#ff4d4f"/>:i.trend==='down'?<TrendingDown size={12} color="#52c41a"/>:<span style={{color:'#999'}}>→</span>}
                    </Space>
                    <Progress percent={Math.min(100, i.value / Math.max(i.target, 1) * 100)} size="small" showInfo={false} strokeColor={statusColor[i.status]} />
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={<Space><AlertTriangle size={14}/>Live Alerts</Space>}>
            <List dataSource={alerts} renderItem={(a:any)=><List.Item style={{padding:'8px 0'}}>
              <Space>
                <Badge status={a.level==='critical'?'error':a.level==='warning'?'warning':'processing'} />
                <span style={{fontSize:13}}>{a.msg}</span>
                <span style={{fontSize:11,color:'#999',marginLeft:'auto'}}>{a.time}</span>
              </Space>
            </List.Item>} />
          </Card>
        </Col>
      </Row>
      <Card size="small" title={<Space><Heart size={14}/>Recent Safety Incidents</Space>}>
        <Table dataSource={incidents} rowKey="id" pagination={false}
          columns={[
            {title:'Time',dataIndex:'time',width:80},
            {title:'Type',dataIndex:'type'},
            {title:'Patient',dataIndex:'patient'},
            {title:'Severity',dataIndex:'severity',render:(s:string)=><Tag color={s==='critical'?'red':s==='moderate'?'orange':'blue'}>{s}</Tag>},
            {title:'Ward',dataIndex:'ward'},
            {title:'Status',dataIndex:'status',render:(s:string)=><Badge status={s==='open'?'error':s==='investigating'?'warning':'success'} text={s} />},
          ]} />
      </Card>
    </div>
  );
};
export default PatientSafetyDashboardPage;