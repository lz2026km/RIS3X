import React, { useState, useEffect } from 'react';
import { Card, Button, Row, Col, Statistic, Space, Alert, message } from 'antd';
import { RefreshCw, Calendar } from 'lucide-react';
import { DentalPageLayout, EmptyState } from './DentalShared';

export const DentalDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshAt, setRefreshAt] = useState<Date>(new Date());
  const load = () => {
    setLoading(true);
    fetch('/api/v1/dental/stats').then(r=>r.json()).then(d=>{if(d.success) setStats(d.data); setLoading(false); setRefreshAt(new Date());}).catch(()=>setLoading(false));
  };
  useEffect(load, []);
  if (loading) {
    return (<DentalPageLayout header={{ title: '口腔运营仪表盘' }}><div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>加载中...</div></DentalPageLayout>);
  }
  if (!stats) {
    return (<DentalPageLayout header={{ title: '口腔运营仪表盘' }}><EmptyState tip="暂无统计数据" onCreate={load} createLabel="重新加载" /></DentalPageLayout>);
  }
  const topTreat = stats.topTreatments || {};
  return (
    <DentalPageLayout header={{ title: '口腔运营仪表盘', extra: (
      <Button icon={<RefreshCw size={14} />} onClick={load}>刷新</Button>
    ) }}>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="今日患者" value={stats.todayPatients} prefix={<Calendar size={14} />} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="本周" value={stats.thisWeek} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="日均" value={stats.avgPerDay} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="今日收入" prefix="¥" value={stats.revenueToday} /></Card></Col>
        <Col xs={24} md={12}><Card size="small" title="热门治疗">
          <Row gutter={8}>
            <Col span={8}><Statistic title="补" value={topTreat.Restorative || 0} /></Col>
            <Col span={8}><Statistic title="根管" value={topTreat.Endodontic || 0} /></Col>
            <Col span={8}><Statistic title="种植" value={topTreat.Implant || 0} /></Col>
          </Row>
        </Card></Col>
        <Col xs={24} md={12}><Card size="small" title="快捷入口">
          <Space wrap>
            <Button onClick={() => message.warning('功能建设中')}>种植规划</Button>
            <Button onClick={() => message.warning('功能建设中')}>正畸</Button>
            <Button onClick={() => message.warning('功能建设中')}>库存管理</Button>
            <Button onClick={() => message.warning('功能建设中')}>患者随访</Button>
          </Space>
        </Card></Col>
      </Row>
      <Alert message={`数据更新于 ${refreshAt.toLocaleTimeString('zh-CN')}`} type="success" showIcon />
    </DentalPageLayout>
  );
};

export default DentalDashboardPage;
