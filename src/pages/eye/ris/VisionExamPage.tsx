import React, { useState } from 'react';
import { Card, Row, Col, Tag, InputNumber, Select, Table } from 'antd';
import { Eye } from 'lucide-react';
import EyeLateralityBadge from '@/components/eye/EyeLateralityBadge';
import VisionAcuityInput from '@/components/eye/VisionAcuityInput';
import { toAllNotations } from '@/services/eye/visionConverter';

const VisionExamPage: React.FC = () => {
  const [va, setVa] = useState({ odUcva: 0.5, odBcva: 1.0, osUcva: 0.4, osBcva: 0.8 });

  const columns = [
    { title: '', dataIndex: 'label', key: 'label', width: 60 },
    { title: '右眼 OD', dataIndex: 'od', key: 'od', width: 80,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: '左眼 OS', dataIndex: 'os', key: 'os', width: 80,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Snellen OD', dataIndex: 'snellenOd', key: 'snellenOd', width: 100,
      render: (v: number) => { const n = toAllNotations(v); return String(n.snellen); } },
    { title: 'Snellen OS', dataIndex: 'snellenOs', key: 'snellenOs', width: 100,
      render: (v: number) => { const n = toAllNotations(v); return String(n.snellen); } },
    { title: '5分 OD', dataIndex: 'fiveOd', key: 'fiveOd', width: 60,
      render: (v: number) => { const n = toAllNotations(v); return n.five; } },
    { title: '5分 OS', dataIndex: 'fiveOs', key: 'fiveOs', width: 60,
      render: (v: number) => { const n = toAllNotations(v); return n.five; } },
    { title: 'LogMAR OD', dataIndex: 'logmarOd', key: 'logmarOd', width: 80,
      render: (v: number) => { const n = toAllNotations(v); return n.logmar; } },
    { title: 'LogMAR OS', dataIndex: 'logmarOs', key: 'logmarOs', width: 80,
      render: (v: number) => { const n = toAllNotations(v); return n.logmar; } },
  ];

  const data = [
    { key: 'ucva', label: '裸眼', od: va.odUcva, os: va.osUcva, snellenOd: va.odUcva, snellenOs: va.osUcva, fiveOd: va.odUcva, fiveOs: va.osUcva, logmarOd: va.odUcva, logmarOs: va.osUcva },
    { key: 'bcva', label: '矫正', od: va.odBcva, os: va.osBcva, snellenOd: va.odBcva, snellenOs: va.osBcva, fiveOd: va.odBcva, fiveOs: va.osBcva, logmarOd: va.odBcva, logmarOs: va.osBcva },
  ];

  return (
    <div style={{ padding: 16, background: '#f8fafc', minHeight: 'calc(100vh - 56px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Eye className="v4-icon" style={{ width: 24, height: 24, color: '#1677ff' }} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>视力检查</span>
        <EyeLateralityBadge eyeSide="OD" />
        <EyeLateralityBadge eyeSide="OS" />
        <Tag color="blue">裸眼 / 矫正 / 小孔</Tag>
        <Tag color="cyan">Snellen / 小数 / 5分 / LogMAR</Tag>
      </div>

      <Row gutter={12}>
        <Col span={12}>
          <Card size="small" title="右眼 OD">
            <VisionAcuityInput label="裸眼视力" value={va.odUcva} onChange={(v) => setVa((s) => ({ ...s, odUcva: v }))} />
            <VisionAcuityInput label="矫正视力" value={va.odBcva} onChange={(v) => setVa((s) => ({ ...s, odBcva: v }))} />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="左眼 OS">
            <VisionAcuityInput label="裸眼视力" value={va.osUcva} onChange={(v) => setVa((s) => ({ ...s, osUcva: v }))} />
            <VisionAcuityInput label="矫正视力" value={va.osBcva} onChange={(v) => setVa((s) => ({ ...s, osBcva: v }))} />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="4 记法换算对照" style={{ marginTop: 12 }}>
        <Table rowKey="key" dataSource={data} columns={columns} pagination={false} size="small" bordered />
      </Card>
    </div>
  );
};

export default VisionExamPage;
