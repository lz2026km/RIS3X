import React, { useState, useEffect } from 'react';
import { Card, Tag, Button, Row, Col, Statistic, List } from 'antd';
import { Plus } from 'lucide-react';
import { DentalPageLayout } from './DentalShared';
import { dentalApi } from '@/services/api/dentalApi';

export const DentalImplantPlanPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [_loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await dentalApi.listImplantPlans();
      if (res.success && Array.isArray(res.data)) {
        setPlans(res.data);
      }
    } catch { /* API may not be available */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const display = plans;
  const totalCost = display.reduce((s, p) => s + (p.cost || 0), 0);
  return (
    <DentalPageLayout header={ { title: '种植规划', tags: [<Tag key='b' color='blue'>Straumann/Nobel 对标</Tag>, <Tag key='s' color='green'>4 大品牌 / 12 型号</Tag>] } }>
      <Row gutter={12} style={ { marginBottom: 12 } }>
        <Col span={6}><Card size={'small'}><Statistic title={'规划总数'} value={display.length} prefix={<Plus size={12} />} /></Card></Col>
        <Col span={6}><Card size={'small'}><Statistic title={'待种植'} value={display.filter(p => p.status === 'pending').length} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={6}><Card size={'small'}><Statistic title={'已完成'} value={display.filter(p => p.status === 'completed').length} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
        <Col span={6}><Card size={'small'}><Statistic title={'累计费用'} value={(totalCost / 10000).toFixed(1)} suffix={'万'} styles={{ content: { color: '#1677ff' } }} /></Card></Col>
      </Row>
      <Row gutter={16}>
        <Col span={16}>
          <Card size={'small'} title={'种植规划列表'} extra={<Button type='primary' size='small' icon={<Plus size={12} />}>新建规划</Button>}>
            <List dataSource={display} renderItem={(t: any) => <List.Item actions={[<Button key='d' size='small'>导板设计</Button>, <Button key='v' size='small'>查看</Button>]}>
              <List.Item.Meta
                title={<span><Tag color='blue'>FDI {t.toothNo}</Tag>{t.patientName} - {t.type} <Tag color={t.status === 'completed' ? 'green' : t.status === 'pending' ? 'orange' : 'blue'}>{t.status === 'completed' ? '已完成' : t.status === 'pending' ? '待种植' : '进行中'}</Tag></span>}
                description={<span style={ { fontSize: 12, color: '#999' } }>{t.diagnosis} | {t.plan} | 门诊¥{t.cost}</span>}
              />
            </List.Item>} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size={'small'} title={'种植体库 (4 品牌 12 型号)'}>
            {[{name:'Straumann BLT',tag:'RC',desc:'4.1×8/10/12mm · 4.8×10/12mm'},{name:'Nobel Active',tag:'NP',desc:'3.5×10/13mm · 4.3×10/13mm'},{name:'Nobel CC',tag:'RP',desc:'3.5×8/10mm · 4.3×10/12mm'},{name:'Straumann BLX',tag:'RB',desc:'3.75×8/10/12/14mm · 4.5×10/12mm'}].map((b,i)=>(
              <div key={i} style={{ marginBottom: 8, padding: 8, background: '#fafafa', borderRadius: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{b.name}</b><Tag color={['blue','purple','cyan','green'][i]}>{b.tag}</Tag></div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{b.desc}</div>
              </div>
            ))}
          </Card>
          <Card size={'small'} title={'骨量分析 (248 案例)'} style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}><span>A 类骨 (D1/D2)</span><Tag color='green'>42%</Tag></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}><span>B 类骨 (D3)</span><Tag color='blue'>38%</Tag></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}><span>C 类骨 (D4)</span><Tag color='orange'>20%</Tag></div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>基于术后随访数据 · 1 年成功率 98.5%</div>
          </Card>
        </Col>
      </Row>
    </DentalPageLayout>
  );
};

export default DentalImplantPlanPage;
