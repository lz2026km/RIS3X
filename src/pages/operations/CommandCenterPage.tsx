// [v3.0.6.8-67] 全院运营仪表盘 (放射+口腔+系统)
import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Button, Row, Col, Statistic, Tabs, Table, List, Alert, Badge, Progress, Timeline } from 'antd';
import { Activity, Bell, AlertTriangle, TrendingUp, Users, Camera, Monitor, CheckCircle2, Clock, BarChart3 } from 'lucide-react';

export const CommandCenterPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState('today');

  useEffect(() => {
    setData({
      radiology: { exams: 142, pendingReports: 18, criticalValues: 5, avgTAT: 45, avgScore: 88.5 },
      dental: { patients: 23, treatments: 18, implants: 3, revenue: 48500 },
      system: { users: 52, onlineNow: 8, activeAlerts: 3, pendingIntegrations: 2 },
    });
  }, [timeRange]);

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <BarChart3 size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>全院运营仪表盘 (Command Center)</span>
        <Tag color="cyan">v3.0.6.8-67</Tag>
        <Space>
          {['today','week','month'].map(t => <Button key={t} type={timeRange===t?'primary':'default'} size="small" onClick={()=>setTimeRange(t)}>{t}</Button>)}
        </Space>
      </Space>

      {data && <>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}><Card size="small" title={<Space><Camera size={14}/>放射科</Space>}>
            <Row gutter={[8,8]}>
              <Col span={8}><Statistic title="检查数" value={data.radiology.exams} /></Col>
              <Col span={8}><Statistic title="待报告" value={data.radiology.pendingReports} styles={{ content: { color:'#faad14' } }} /></Col>
              <Col span={8}><Statistic title="危急值" value={data.radiology.criticalValues} styles={{ content: { color:'#ff4d4f' } }} /></Col>
              <Col span={12}><Statistic title="平均 TAT" value={data.radiology.avgTAT} suffix="min" /></Col>
              <Col span={12}><Statistic title="质控分" value={data.radiology.avgScore} suffix="/100" prefix={<CheckCircle2 size={14} />} /></Col>
            </Row>
          </Card></Col>
          <Col span={8}><Card size="small" title={<Space><Activity size={14}/>口腔科</Space>}>
            <Row gutter={[8,8]}>
              <Col span={8}><Statistic title="患者" value={data.dental.patients} /></Col>
              <Col span={8}><Statistic title="治疗" value={data.dental.treatments} /></Col>
              <Col span={8}><Statistic title="种植" value={data.dental.implants} styles={{ content: { color:'#722ed1' } }} /></Col>
              <Col span={12}><Statistic title="今日收入" prefix="¥" value={data.dental.revenue} /></Col>
              <Col span={12}><Statistic title="门诊均收" prefix="¥" value={(data.dental.revenue / data.dental.patients).toFixed(0)} /></Col>
            </Row>
          </Card></Col>
          <Col span={8}><Card size="small" title={<Space><Monitor size={14}/>系统</Space>}>
            <Row gutter={[8,8]}>
              <Col span={8}><Statistic title="用户" value={data.system.users} /></Col>
              <Col span={8}><Statistic title="在线" value={data.system.onlineNow} styles={{ content: { color:'#52c41a' } }} /></Col>
              <Col span={8}><Statistic title="告警" value={data.system.activeAlerts} styles={{ content: { color:'#ff4d4f' } }} /></Col>
              <Col span={12}><Statistic title="用户活跃率" value={(data.system.onlineNow / data.system.users * 100).toFixed(1)} suffix="%" /></Col>
              <Col span={12}><Progress percent={75} size="small" strokeColor="#52c41a" /><div style={{fontSize:11,color:'#999'}}>系统健康度</div></Col>
            </Row>
          </Card></Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}><Card size="small" title={<Space><Bell size={14}/>实时告警</Space>}>
            <List dataSource={[
              {level:'critical', msg:'36 位根尖周炎 AI 检测结果阳性, 需医生确认', time:'2 分钟前', dept:'口腔科 AI'},
              {level:'warning', msg:'CBCT 检查等待放射科审核超过 SLA (4h)', time:'15 分钟前', dept:'放射科'},
              {level:'info', msg:'HL7 连接恢复正常', time:'30 分钟前', dept:'系统'},
            ]} renderItem={(a:any)=><List.Item><Badge status={a.level as any} /><span style={{color:a.level==='critical'?'#ff4d4f':'#666',fontSize:12}}>{a.msg}</span><Tag color="blue">{a.dept}</Tag></List.Item>} />
          </Card></Col>
          <Col span={12}><Card size="small" title={<Space><TrendingUp size={14}/>今日趋势</Space>}>
            <div style={{height:150,display:'flex',alignItems:'flex-end',gap:4}}>
              {Array.from({length:8}, (_,i) => {
                const h = 30 + Math.random() * 120;
                return <div key={i} style={{flex:1,height:h,background:'#1677ff',borderRadius:'4px 4px 0 0',opacity:0.6+i*0.05}}>
                  <div style={{fontSize:9,textAlign:'center',color:'#999',marginTop:-14}}>{8+i}</div>
                </div>;
              })}
            </div>
          </Card></Col>
        </Row>
      </>}
    </div>
  );
};
export default CommandCenterPage;
