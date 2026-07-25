// [v3.0.6.8-65] 跨科室治疗计划中心
import React, { useState } from 'react';
import { Card, Space, Tag, Button, Table, Select, Input, Row, Col, Statistic, message, Tabs, Empty, Modal, Form, List, Alert, Badge, Steps, Timeline, Descriptions, Tooltip, Rate } from 'antd';
import { Activity, Plus, Send, FileText, Calendar, User, CheckCircle2, Clock, AlertTriangle, ClipboardList } from 'lucide-react';

const { TextArea } = Input;

export const TreatmentPlanCenterPage: React.FC = () => {
  const [tab, setTab] = useState('plans');
  const [createModal, setCreateModal] = useState(false);
  const [plans] = useState([
    { id: 'PLAN-001', patient: '张伟', type: '种植', status: 'in_progress', progress: 0.6, department: '口腔科→放射科', startDate: '2026-06-20', desc: '36 位种植体植入 (Straumann BLT 4.1×10mm)', outcome: '待 CBCT 复核' },
    { id: 'PLAN-002', patient: '李娜', type: '根管治疗', status: 'completed', progress: 1.0, department: '口腔科', startDate: '2026-06-15', desc: '16 位根管治疗 (根管预备 + 充填)', outcome: '已完成, 建议全冠修复' },
    { id: 'PLAN-003', patient: '王芳', type: '正畸-正颌', status: 'planned', progress: 0.2, department: '口腔科→放射科→口腔外科', startDate: '2026-07-01', desc: '下颌前突正畸-正颌联合治疗', outcome: '头影测量分析中' },
  ]);
  const [timelineData] = useState<Record<string, any[]>>({
    'PLAN-001': [
      { step: '口腔科初诊', date: '2026-06-20', status: 'completed' },
      { step: '转诊放射科 CBCT', date: '2026-06-21', status: 'completed' },
      { step: '种植规划 (导板设计)', date: '2026-06-22', status: 'in_progress' },
      { step: '手术日', date: '2026-06-28', status: 'pending' },
      { step: '术后复查 CBCT', date: '2026-07-05', status: 'pending' },
    ],
  });

  const stats = { total: plans.length, active: plans.filter(p => p.status === 'in_progress').length, completed: plans.filter(p => p.status === 'completed').length };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <ClipboardList size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>跨科室治疗计划中心</span>
        <Tag color="cyan">v3.0.6.8-65</Tag>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card><Statistic title="总计划" value={stats.total} /></Card></Col>
        <Col span={4}><Card><Statistic title="执行中" value={stats.active} valueStyle={{color:'#1677ff'}} /></Card></Col>
        <Col span={4}><Card><Statistic title="已完成" value={stats.completed} valueStyle={{color:'#52c41a'}} /></Card></Col>
      </Row>
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key:'plans', label:'治疗计划', children:
          <Card extra={<Button type="primary" icon={<Plus size={12}/>} onClick={()=>setCreateModal(true)}>新建治疗计划</Button>} size="small" title={`${plans.length} 项`}>
            <Table dataSource={plans} rowKey="id" pagination={false}
              columns={[
                {title:'ID',dataIndex:'id'},{title:'患者',dataIndex:'patient'},
                {title:'类型',dataIndex:'type',render:(t)=><Tag color={t==='种植'?'blue':t==='根管治疗'?'green':'purple'}>{t}</Tag>},
                {title:'涉及科室',dataIndex:'department',render:(d)=><Tag color="orange">{d}</Tag>},
                {title:'进展',dataIndex:'progress',render:(p)=><><Badge status={p===1?'success':'processing'} />{Math.round(p*100)}%</>},
                {title:'状态',dataIndex:'status',render:(s)=><Tag color={s==='completed'?'green':s==='in_progress'?'blue':'default'}>{s}</Tag>},
                {title:'描述',dataIndex:'desc',ellipsis:true},
                {title:'开始',dataIndex:'startDate'},
              ]} />
          </Card>
        },
        { key:'timeline', label:'项目时间线', children:
          <Card size="small" title="PLAN-001: 种植修复时间线">
            <Steps current={2} direction="vertical" items={timelineData['PLAN-001'].map(s => ({
              title: <Space>{s.step}<Tag color={s.status==='completed'?'green':s.status==='in_progress'?'blue':'default'}>{s.status}</Tag></Space>,
              description: s.date,
            }))} />
          </Card>
        },
      ]} />
      <Modal title="新建跨科室治疗计划" open={createModal} onCancel={()=>setCreateModal(false)} onOk={()=>{message.success('治疗计划已创建');setCreateModal(false)}} width={500}>
        <Form layout="vertical" size="small">
          <Form.Item label="患者"><Select options={[{value:'P001',label:'张伟'},{value:'P002',label:'李娜'},{value:'P003',label:'王芳'}]} /></Form.Item>
          <Form.Item label="治疗类型"><Select options={['种植','根管治疗','正畸-正颌','颌面外科','修复'].map(t=>({value:t,label:t}))} /></Form.Item>
          <Form.Item label="涉及科室"><Select mode="multiple" options={['口腔科','放射科','口腔外科','正畸科'].map(d=>({value:d,label:d}))} /></Form.Item>
          <Form.Item label="描述"><TextArea rows={3} placeholder="治疗计划概述" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default TreatmentPlanCenterPage;
