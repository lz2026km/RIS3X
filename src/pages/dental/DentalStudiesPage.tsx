// [v3.0.6.8-54] 口腔影像列表页
// [v3.0.6.8-81] 修复: 复用 shared constants
import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Button, Select, Row, Col, Statistic, message, List, Input, Badge } from 'antd';
import { Activity, Eye, RefreshCw } from 'lucide-react';
import { MODALITY_LABELS, MODALITY_COLORS } from '../../data/dental/constants';

export const DentalStudiesPage: React.FC = () => {
  const [studies, setStudies] = useState<any[]>([]);
  const [filter, setFilter] = useState({ modality: '', patientName: '' });
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.modality) params.set('modality', filter.modality);
      if (filter.patientName) params.set('patientName', filter.patientName);
      params.set('pageSize', '50');
      const r = await fetch(`/api/v1/dental/studies?${params}`);
      const d = await r.json();
      if (d.success) setStudies(d.data || []);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = studies.filter(s => {
    if (filter.modality && s.modality !== filter.modality) return false;
    if (filter.patientName && !s.patientName?.includes(filter.patientName)) return false;
    return true;
  });

  const stats = {
    total: studies.length,
    cbct: studies.filter(s => s.modality === 'CBCT').length,
    panoramic: studies.filter(s => s.modality === 'Panoramic').length,
    periapical: studies.filter(s => s.modality === 'Periapical').length,
    scan: studies.filter(s => s.modality === 'Scan').length,
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Activity size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>口腔影像中心</span>
        <Tag color="cyan">v3.0.6.8-54</Tag>
        <Tag color="purple">3Shape/Sirona 对标</Tag>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="全部" value={stats.total} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="CBCT" value={stats.cbct} styles={{ content: {  color: '#722ed1'  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="全景片" value={stats.panoramic} styles={{ content: {  color: '#1677ff'  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="根尖片" value={stats.periapical} styles={{ content: {  color: '#52c41a'  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="口扫" value={stats.scan} styles={{ content: {  color: '#13c2c2'  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="今日" value={studies.filter(s => s.acquisitionDate === new Date().toISOString().slice(0,10)).length} /></Card></Col>
      </Row>
      <Card
        size="small"
        title={`影像列表 (${filtered.length})`}
        extra={
          <Space>
            <Select size="small" value={filter.modality || undefined} onChange={v => setFilter({ ...filter, modality: v })} allowClear placeholder="模态" style={{ width: 120 }}
              options={[
                { value: 'CBCT', label: 'CBCT' },
                { value: 'Panoramic', label: '全景片' },
                { value: 'Periapical', label: '根尖片' },
                { value: 'Scan', label: '口扫' },
                { value: 'Bitewing', label: '咬合翼片' },
              ]}
            />
            <Input.Search size="small" value={filter.patientName} onChange={e => setFilter({ ...filter, patientName: e.target.value })} placeholder="患者姓名" style={{ width: 160 }} />
            <Button icon={<RefreshCw size={12} />} onClick={load} loading={loading}>刷新</Button>
          </Space>
        }
      >
        <List
          size="small"
          loading={loading}
          dataSource={filtered}
          renderItem={(s: any) => (
            <List.Item
              actions={[
                <Button key="v" type="link" size="small" icon={<Eye size={12} />} onClick={() => window.open(`/dental/viewer?studyId=${s.id}&modality=${s.modality}`, '_blank')}>查看</Button>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <div style={{
                    width: 60, height: 50, borderRadius: 4,
                    background: s.thumbnail || '#f0f0f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#999', fontSize: 10,
                  }}>
                    {s.modality === 'CBCT' ? '3D' : s.modality === 'Panoramic' ? '全景' : s.modality === 'Scan' ? '3D' : '2D'}
                  </div>
                }
                title={
                  <Space>
                    <Tag color={MODALITY_COLORS[s.modality]}>{MODALITY_LABELS[s.modality] || s.modality}</Tag>
                    <span style={{ fontWeight: 600 }}>{s.patientName}</span>
                    {s.aiAnalysis?.cariesDetected > 0 && <Badge count={s.aiAnalysis.cariesDetected}><Tag color="red">龋齿</Tag></Badge>}
                  </Space>
                }
                description={
                  <Space style={{ fontSize: 11, color: '#999' }}>
                    <span>{s.deviceModel}</span>
                    <span>|</span>
                    <span>{s.fieldOfView}</span>
                    <span>|</span>
                    <span>{s.acquisitionDate}</span>
                    <span>{s.segments && <Tag color="purple" style={{ fontSize: 10 }}>{s.segments.length} 段</Tag>}</span>
                    <Tag color={s.quality === 'Diagnostic' ? 'green' : s.quality === 'Acceptable' ? 'blue' : 'orange'} style={{ fontSize: 10 }}>{s.quality}</Tag>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};
export default DentalStudiesPage;
