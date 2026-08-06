// [v3.0.6.8-59] Phase C: 口腔-放射融合 (转诊 + 统一报告 + 融合查看器)
import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Button, Table, Row, Col, Statistic, Tabs, Timeline } from 'antd';
import { Plus, Send, FileText, Activity as ActivityIcon } from 'lucide-react';
import { dentalApi } from '@/services/api/dentalApi';

// ===== CrossSpecialtyReferralPage (跨科室转诊) =====
export const CrossSpecialtyReferralPage: React.FC = () => {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await dentalApi.listReferrals();
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setReferrals(res.data);
        }
      } catch { /* API may not be available */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div style={{padding:24,background:'#f5f5f5',minHeight:'100vh'}}>
      <Space style={{marginBottom:16}}><Send size={20} color="#1677ff"/><span style={{fontSize:18,fontWeight:600}}>跨科室转诊</span><Tag color="cyan">v59</Tag><Tag color="purple">口腔↔放射</Tag></Space>
      <Row gutter={16} style={{marginBottom:16}}>
        <Col span={4}><Card><Statistic title="待转诊" value={referrals.filter(r=>r.status==='pending').length} styles={{ content: { color:'#faad14' } }}/></Card></Col>
        <Col span={4}><Card><Statistic title="已接诊" value={referrals.filter(r=>r.status==='accepted').length} styles={{ content: { color:'#52c41a' } }}/></Card></Col>
      </Row>
      <Card extra={<Button type="primary" icon={<Plus size={12}/>}>发起转诊</Button>} size="small" title="转诊列表">
        <Table dataSource={referrals} rowKey="id" columns={[
          {title:'ID',dataIndex:'id'},{title:'患者',dataIndex:'patient'},
          {title:'来源',dataIndex:'source',render:(s)=><Tag color="blue">{s}</Tag>},
          {title:'目标',dataIndex:'target',render:(s)=><Tag color="purple">{s}</Tag>},
          {title:'原因',dataIndex:'reason'},{title:'时间',dataIndex:'createdAt'},
          {title:'状态',dataIndex:'status',render:(s)=><Tag color={s==='accepted'?'green':'orange'}>{s}</Tag>},
          {title:'操作',render:(_,r)=><Space>{r.status==='pending' && <Button size="small" type="primary">接诊</Button>}<Button size="small">详情</Button></Space>}
        ]} pagination={false} />
      </Card>
    </div>
  );
};

// ===== CBCTUnifiedReportPage (统一 CBCT 报告) =====
export const CBCTUnifiedReportPage: React.FC = () => {
  return (
    <div style={{padding:24,background:'#f5f5f5',minHeight:'100vh'}}>
      <Space style={{marginBottom:16}}><FileText size={20} color="#1677ff"/><span style={{fontSize:18,fontWeight:600}}>统一 CBCT 报告</span><Tag color="cyan">v59</Tag></Space>
      <Row gutter={16}>
        <Col span={12}><Card size="small" title="牙科描述">
          <div>患者: 张伟 | 设备: Sirona Orthophos SL 3D</div>
          <div style={{marginTop:8,color:'#666'}}>36 位远中根根尖周低密度影; 16 位腭侧牙周膜间隙增宽</div>
          <Tag color="blue" style={{marginTop:8}}>慢性根尖周炎 (36)</Tag>
        </Card></Col>
        <Col span={12}><Card size="small" title="放射科报告">
          <div>CBCT 示右侧上颌窦黏膜增厚; 36 根尖区骨密度降低</div>
          <Tag color="purple" style={{marginTop:8}}>慢性根尖周炎伴骨吸收</Tag>
          <Tag color="orange" style={{marginTop:8}}>右侧上颌窦炎</Tag>
        </Card></Col>
      </Row>
    </div>
  );
};

// ===== DentalRadFusionPage (口腔-放射融合查看器) =====
export const DentalRadFusionPage: React.FC = () => {
  const [tab, setTab] = useState('compare');
  return (
    <div style={{padding:24,background:'#f5f5f5',minHeight:'100vh'}}>
      <Space style={{marginBottom:16}}><ActivityIcon size={20} color="#1677ff"/><span style={{fontSize:18,fontWeight:600}}>口腔-放射融合查看器</span><Tag color="cyan">v59</Tag></Space>
      <Tabs activeKey={tab} onChange={setTab}
        items={[
          {key:'compare', label:'并排对比', children:
            <Row gutter={16}>
              <Col span={12}><Card size="small" title="口腔全景片"><div style={{height:250,background:'#1a1a2e',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#666'}}>全景片模拟</div></Card></Col>
              <Col span={12}><Card size="small" title="放射头颅侧位"><div style={{height:250,background:'#1a1a2e',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#666'}}>侧位片模拟</div></Card></Col>
            </Row>
          },
          {key:'overlay', label:'叠加融合', children:
            <Card size="small"><div style={{height:300,background:'#0a0a1a',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',color:'#666'}}>CBCT + 口扫 3D 叠加融合 (WebGL)</div></Card>
          },
          {key:'timeline', label:'统一时间线', children:
            <Timeline items={[
              {color:'green',children:<div>2026-06-20 口腔科初诊 (全景片 + 口腔检查)</div>},
              {color:'blue',children:<div>2026-06-21 转诊至放射科 (CBCT 下颌骨三维重建)</div>},
              {color:'gray',children:<div>2026-06-22 放射科报告完成</div>},
              {color:'orange',children:<div>2026-06-23 口腔科种植规划</div>},
            ]} />
          },
        ]}
      />
    </div>
  );
};
