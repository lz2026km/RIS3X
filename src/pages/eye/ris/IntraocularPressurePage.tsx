import React, { useState, useEffect } from 'react';
import { Card, Row, Col, InputNumber, Select, Tag, Button, Spin } from 'antd';
import { Eye, Droplets } from 'lucide-react';
import EyeLateralityBadge from '@/components/eye/EyeLateralityBadge';
import IopCurveChart from '@/components/eye/IopCurveChart';
import { eyeApi } from '@/services/api/eyeApi';

const DEVICE_OPTIONS = [
  { value: 'nct', label: 'NCT 非接触' },
  { value: 'goldmann', label: 'Goldmann 压平' },
  { value: 'icare', label: 'iCare 反弹' },
];

const IntraocularPressurePage: React.FC = () => {
  const [iop, setIop] = useState({ od: 18, os: 19 });
  const [device, setDevice] = useState('nct');
  const [iopRecords, setIopRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await eyeApi.getIopRecords();
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setIopRecords(res.data);
        }
      } catch { /* API may not be available */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: 16, background: '#f8fafc', minHeight: 'calc(100vh - 56px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Droplets className="v4-icon" style={{ width: 24, height: 24, color: '#0891b2' }} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>眼压测量 (IOP)</span>
        <EyeLateralityBadge eyeSide="OD" />
        <EyeLateralityBadge eyeSide="OS" />
        <Tag color="blue">NCT / Goldmann / iCare</Tag>
        <Tag color="orange">24h 曲线</Tag>
      </div>

      <Row gutter={12}>
        <Col span={8}>
          <Card size="small" title="当前测量">
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>右眼 OD (mmHg)</div>
              <InputNumber value={iop.od} onChange={(v) => setIop((s) => ({ ...s, od: v ?? 18 }))} min={0} max={80} style={{ width: 120 }} />
              <Tag color={iop.od > 21 ? 'error' : 'success'} style={{ marginLeft: 8, fontSize: 12 }}>{iop.od > 21 ? '高眼压' : '正常'}</Tag>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>左眼 OS (mmHg)</div>
              <InputNumber value={iop.os} onChange={(v) => setIop((s) => ({ ...s, os: v ?? 19 }))} min={0} max={80} style={{ width: 120 }} />
              <Tag color={iop.os > 21 ? 'error' : 'success'} style={{ marginLeft: 8, fontSize: 12 }}>{iop.os > 21 ? '高眼压' : '正常'}</Tag>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>测量方式</div>
              <Select value={device} onChange={setDevice} options={DEVICE_OPTIONS} style={{ width: 140 }} />
            </div>
            <Button type="primary" size="small">记录当前测量</Button>
          </Card>
        </Col>
        <Col span={16}>
          <Card size="small" title="24h 眼压曲线">
            <IopCurveChart records={iopRecords} patientId="p-1001" />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default IntraocularPressurePage;
