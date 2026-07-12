import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Alert } from 'antd';
import { Calendar } from 'lucide-react';
import { DentalPageLayout } from './DentalShared';

export const DentalWorkspacePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 300); return () => clearTimeout(t); }, []);
  return (
    <DentalPageLayout header={{ title: '口腔工作台' }}>
      <Row gutter={16}>
        <Col span={6}><Card hoverable><Statistic title="今日检查" value={12} prefix={<Calendar size={14}/>} /></Card></Col>
        <Col span={6}><Card hoverable><Statistic title="待报告" value={3} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col span={6}><Card hoverable><Statistic title="待治疗" value={5} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col span={6}><Card hoverable><Statistic title="已完成" value={8} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>
      {!loading && <Alert style={{ marginTop: 16 }} message="工作台已就绪" type="success" showIcon />}
    </DentalPageLayout>
  );
};

export default DentalWorkspacePage;
