// [W3-2] 眼压测量: eyeApi 记录 CRUD + IOP 分类 (正常/偏高/高) + 24h 趋势
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, InputNumber, Select, Tag, Button, message, Table, Alert, Popconfirm, Empty, Spin, Space, Statistic, Progress } from 'antd';
import { Droplets, Save, Trash2, RefreshCw, TrendingUp, Activity } from 'lucide-react';
import EyeLateralityBadge from '@/components/eye/EyeLateralityBadge';
import IopCurveChart from '@/components/eye/IopCurveChart';
import { eyeApi } from '@/services/api/eyeApi';
import { usePagination } from '@/hooks/usePagination';

const DEVICE_OPTIONS = [
  { value: 'nct', label: 'NCT 非接触' },
  { value: 'goldmann', label: 'Goldmann 压平' },
  { value: 'icare', label: 'iCare 反弹' },
  { value: 'tonopen', label: 'Tonopen 手持' },
];

const DEVICE_LABEL: Record<string, string> = {
  nct: 'NCT 非接触',
  goldmann: 'Goldmann 压平',
  icare: 'iCare 反弹',
  tonopen: 'Tonopen 手持',
};

const classify = (v: number) => {
  if (v >= 25) return { label: '高眼压', color: 'error' as const, level: 2 };
  if (v > 21) return { label: '偏高', color: 'warning' as const, level: 1 };
  return { label: '正常', color: 'success' as const, level: 0 };
};

const PATIENT_OPTIONS = [
  { value: 'p-1001', label: '李明' },
  { value: 'p-1002', label: '王芳' },
  { value: 'p-1003', label: '赵刚' },
];

interface IopRecord {
  id: string;
  patientId: string;
  patientName: string;
  od: number;
  os: number;
  device: string;
  timestamp: string;
}

const IntraocularPressurePage: React.FC = () => {
  const [iop, setIop] = useState({ od: 18, os: 19 });
  const [device, setDevice] = useState('nct');
  const [patient, setPatient] = useState('p-1001');
  const [patientName, setPatientName] = useState('李明');
  const [iopRecords, setIopRecords] = useState<IopRecord[]>([]);
  const { pageData: iopPageData, pagination: iopPagination } = usePagination(iopRecords, 8);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await eyeApi.listIopRecords({ patientId: patient });
      if (res.success && Array.isArray(res.data)) {
        setIopRecords(res.data as IopRecord[]);
      } else {
        setError(res.error?.message ?? '眼压记录加载失败');
      }
    } catch (e) {
      console.error('[IOP] load:', e);
      setError('眼压记录加载失败, 请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [patient]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await eyeApi.createIopRecord({ patientId: patient, patientName, od: iop.od, os: iop.os, device });
      if (res.success) {
        message.success('眼压记录已保存');
        void load();
      } else {
        message.error(res.error?.message ?? '保存失败');
      }
    } catch {
      message.error('保存失败, 请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await eyeApi.deleteIopRecord(id);
      if (res.success) {
        message.success('记录已删除');
        setIopRecords(prev => prev.filter(r => r.id !== id));
      } else {
        message.error(res.error?.message ?? '删除失败');
      }
    } catch {
      message.error('删除失败');
    }
  };

  const chartRecords = iopRecords.map(r => ({ od: r.od, os: r.os, device: r.device as 'nct' | 'goldmann' | 'icare' | 'diaton' | 'tonopen', timestamp: r.timestamp }));

  const odClass = classify(iop.od);
  const osClass = classify(iop.os);
  const latest = iopRecords[0];
  const avgOd = iopRecords.length ? Math.round(iopRecords.reduce((s, r) => s + r.od, 0) / iopRecords.length) : 0;
  const avgOs = iopRecords.length ? Math.round(iopRecords.reduce((s, r) => s + r.os, 0) / iopRecords.length) : 0;

  const columns = [
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 150, render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 16) : '-'}</span> },
    { title: '患者', dataIndex: 'patientName', key: 'patientName', width: 80 },
    { title: '右眼 OD', dataIndex: 'od', key: 'od', width: 90, render: (v: number) => { const c = classify(v); return <Space size={4}><b>{v}</b><Tag color={c.color} style={{ margin: 0, fontSize: 11 }}>{c.label}</Tag></Space>; } },
    { title: '左眼 OS', dataIndex: 'os', key: 'os', width: 90, render: (v: number) => { const c = classify(v); return <Space size={4}><b>{v}</b><Tag color={c.color} style={{ margin: 0, fontSize: 11 }}>{c.label}</Tag></Space>; } },
    { title: '测量方式', dataIndex: 'device', key: 'device', width: 130, render: (v: string) => DEVICE_LABEL[v] ?? v },
    { title: '操作', key: 'actions', width: 70, render: (_: unknown, r: IopRecord) => <Popconfirm title="删除该记录?" onConfirm={() => void handleDelete(r.id)}><Button size="small" danger icon={<Trash2 size={12} />} /></Popconfirm> },
  ];

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

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} action={<Button size="small" onClick={() => void load()}>重试</Button>} />}

      <Row gutter={12}>
        <Col span={8}>
          <Card
            size="small"
            title="当前测量"
            extra={<Space><Select size="small" value={patient} onChange={(v) => { setPatient(v); const p = PATIENT_OPTIONS.find(o => o.value === v); if (p) setPatientName(p.label); }} options={PATIENT_OPTIONS} style={{ width: 100 }} /><Button size="small" icon={<RefreshCw size={11} />} onClick={() => void load()} /></Space>}
          >
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>右眼 OD (mmHg)</div>
              <InputNumber value={iop.od} onChange={(v) => setIop((s) => ({ ...s, od: v ?? 18 }))} min={0} max={80} style={{ width: 120 }} />
              <Tag color={odClass.color} style={{ marginLeft: 8, fontSize: 12 }}>{odClass.label}</Tag>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>左眼 OS (mmHg)</div>
              <InputNumber value={iop.os} onChange={(v) => setIop((s) => ({ ...s, os: v ?? 19 }))} min={0} max={80} style={{ width: 120 }} />
              <Tag color={osClass.color} style={{ marginLeft: 8, fontSize: 12 }}>{osClass.label}</Tag>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>测量方式</div>
              <Select value={device} onChange={setDevice} options={DEVICE_OPTIONS} style={{ width: 160 }} />
            </div>
            <div style={{ marginBottom: 12, fontSize: 12, color: '#475569' }}>
              患者: <Tag color="geekblue">{patientName}</Tag>
              {latest && <div style={{ marginTop: 4 }}>最新: OD {latest.od} / OS {latest.os} mmHg</div>}
            </div>
            <Button type="primary" icon={<Save size={12} />} loading={saving} onClick={() => void handleSave()}>记录当前测量</Button>
          </Card>
          <Card size="small" title={<Space><TrendingUp size={14} />均值统计</Space>} style={{ marginTop: 12 }}>
            <Row gutter={8}>
              <Col span={12}><Statistic title="OD 均值" value={avgOd} suffix="mmHg" valueStyle={{ fontSize: 18, color: classify(avgOd).color }} /></Col>
              <Col span={12}><Statistic title="OS 均值" value={avgOs} suffix="mmHg" valueStyle={{ fontSize: 18, color: classify(avgOs).color }} /></Col>
            </Row>
            <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
              <Progress percent={Math.min(100, Math.round((avgOd / 30) * 100))} size="small" strokeColor={classify(avgOd).color} format={() => `OD 峰值占比`} />
              <Progress percent={Math.min(100, Math.round((avgOs / 30) * 100))} size="small" strokeColor={classify(avgOs).color} format={() => `OS 峰值占比`} />
            </div>
          </Card>
        </Col>
        <Col span={16}>
          <Card size="small" title={<Space><Activity size={14} />24h 眼压曲线 <Tag>{patientName}</Tag></Space>} extra={<span style={{ fontSize: 12, color: '#94a3b8' }}>21mmHg 参考线</span>}>
            <IopCurveChart records={chartRecords} patientId={patientName} />
          </Card>
        </Col>
      </Row>

      <Card size="small" title={`测量记录 (${iopRecords.length})`} style={{ marginTop: 12 }}>
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            dataSource={iopPageData}
            columns={columns}
            pagination={iopPagination}
            size="small"
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无测量记录" /> }}
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default IntraocularPressurePage;
