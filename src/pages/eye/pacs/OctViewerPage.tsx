import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Tag, Spin } from 'antd';
import { Activity } from 'lucide-react';
import EyeLateralityBadge from '@/components/eye/EyeLateralityBadge';
import { eyeApi } from '@/services/api/eyeApi';

const OctViewerPage: React.FC = () => {
  const [octStudy, setOctStudy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await eyeApi.getStudies({ modality: 'oct' });
        if (!cancelled && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setOctStudy(res.data[0]);
        }
      } catch { /* API may not be available */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div style={{ padding: 16, textAlign: 'center' }}><Spin tip="加载中..." /></div>;
  if (!octStudy) return <div style={{ padding: 16 }}>无 OCT 检查数据</div>;

  const etdrsData = [
    { zone: '中央 1mm', od: 268, os: 272 },
    { zone: '颞内 TI', od: 295, os: 288 },
    { zone: '鼻内 NI', od: 285, os: 290 },
    { zone: '颞外 T', od: 285, os: 280 },
    { zone: '上 S', od: 292, os: 286 },
    { zone: '鼻外 N', od: 278, os: 282 },
    { zone: '颞下 IT', od: 302, os: 296 },
    { zone: '下 I', od: 288, os: 284 },
    { zone: '鼻下 IN', od: 280, os: 278 },
  ];

  return (
    <div style={{ padding: 16, background: '#f8fafc', minHeight: 'calc(100vh - 56px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Activity className="v4-icon" style={{ width: 24, height: 24, color: '#0891b2' }} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>OCT 专用查看器</span>
        <EyeLateralityBadge eyeSide={octStudy.eyeSide} />
        <Tag color="cyan" style={{ fontSize: 12 }}>{octStudy.device}</Tag>
      </div>

      <Row gutter={12}>
        <Col span={8}>
          <Card size="small" title="OCT 影像">
            <div style={{ height: 300, background: '#000', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
              OCT 断层扫描图像区
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>
              <div>扫描模式: Macular Cube 512×128</div>
              <div>中心凹厚度: <span style={{ fontWeight: 600 }}>{etdrsData[0].od}μm</span></div>
              <div>RNFL 平均厚度: <span style={{ fontWeight: 600 }}>{octStudy.measurements.avgRnfThickness}μm</span></div>
            </div>
          </Card>
        </Col>
        <Col span={16}>
          <Card size="small" title="ETDRS 9 区厚度表">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {etdrsData.map((e) => (
                <div key={e.zone} style={{
                  padding: 8, background: '#f1f5f9', borderRadius: 6, textAlign: 'center',
                  fontSize: 12, border: etdrsData.indexOf(e) === 0 ? '2px solid #3b82f6' : 'none',
                }}>
                  <div style={{ color: '#64748b', fontSize: 12 }}>{e.zone}</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{e.od}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>μm</div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default OctViewerPage;
