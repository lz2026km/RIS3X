// [W3-2] 视力检查: eyeApi 记录 CRUD + 视力表 (Snellen) 录入 + 历史记录
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Tag, Table, Button, Space, Select, message, Alert, Spin, Empty, Segmented, Popconfirm } from 'antd';
import { Eye, Save, History, RefreshCw, Trash2 } from 'lucide-react';
import EyeLateralityBadge from '@/components/eye/EyeLateralityBadge';
import VisionAcuityInput from '@/components/eye/VisionAcuityInput';
import { toAllNotations, visionGrade } from '@/services/eye/visionConverter';
import { eyeApi } from '@/services/api/eyeApi';

interface VisionRecord {
  id: string;
  patientId: string;
  patientName: string;
  odUcva: number;
  odBcva: number;
  odPhva?: number;
  osUcva: number;
  osBcva: number;
  osPhva?: number;
  notation: string;
  distance: string;
  examiner?: string;
  createdAt: string;
}

const PATIENT_OPTIONS = [
  { value: 'p-1001', label: '李明' },
  { value: 'p-1003', label: '赵刚' },
  { value: 'p-1002', label: '王芳' },
];

const VisionExamPage: React.FC = () => {
  const [va, setVa] = useState({ odUcva: 0.5, odBcva: 1.0, odPhva: 0.8, osUcva: 0.4, osBcva: 0.8, osPhva: 0.7 });
  const [records, setRecords] = useState<VisionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [patient, setPatient] = useState('p-1001');
  const [patientName, setPatientName] = useState('李明');
  const [distance, setDistance] = useState('far');
  const [notation, setNotation] = useState('decimal');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await eyeApi.listVisionRecords({ patientId: patient });
      if (res.success && Array.isArray(res.data)) {
        setRecords(res.data as VisionRecord[]);
      } else {
        setError(res.error?.message ?? '记录加载失败');
      }
    } catch (e) {
      console.error('[VisionExam] load:', e);
      setError('视力记录加载失败');
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
      const res = await eyeApi.createVisionRecord({
        patientId: patient,
        patientName,
        odUcva: va.odUcva,
        odBcva: va.odBcva,
        odPhva: va.odPhva,
        osUcva: va.osUcva,
        osBcva: va.osBcva,
        osPhva: va.osPhva,
        notation,
        distance,
      });
      if (res.success) {
        message.success('视力记录已保存');
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
      const res = await eyeApi.deleteVisionRecord(id);
      if (res.success) {
        message.success('视力记录已删除');
      } else {
        message.warning(res.error?.message ?? '删除接口不可用，已本地移除');
      }
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch {
      setRecords(prev => prev.filter(r => r.id !== id));
      message.success('视力记录已删除（本地）');
    }
  };

  const data = [
    { key: 'ucva', label: '裸眼', od: va.odUcva, os: va.osUcva },
    { key: 'bcva', label: '矫正', od: va.odBcva, os: va.osBcva },
    { key: 'phva', label: '小孔', od: va.odPhva ?? 0, os: va.osPhva ?? 0 },
  ];

  const columns = [
    { title: '', dataIndex: 'label', key: 'label', width: 60, render: (v: string) => <b>{v}</b> },
    { title: '右眼 OD', dataIndex: 'od', key: 'od', width: 80, render: (v: number) => <span style={{ fontWeight: 600 }}>{v || '-'}</span> },
    { title: '左眼 OS', dataIndex: 'os', key: 'os', width: 80, render: (v: number) => <span style={{ fontWeight: 600 }}>{v || '-'}</span> },
    { title: 'Snellen OD', dataIndex: 'od', key: 'snellenOd', width: 100, render: (v: number) => v ? String(toAllNotations(v).snellen) : '-' },
    { title: 'Snellen OS', dataIndex: 'os', key: 'snellenOs', width: 100, render: (v: number) => v ? String(toAllNotations(v).snellen) : '-' },
    { title: '5分 OD', dataIndex: 'od', key: 'fiveOd', width: 60, render: (v: number) => v ? toAllNotations(v).five : '-' },
    { title: '5分 OS', dataIndex: 'os', key: 'fiveOs', width: 60, render: (v: number) => v ? toAllNotations(v).five : '-' },
    { title: 'LogMAR OD', dataIndex: 'od', key: 'logmarOd', width: 80, render: (v: number) => v ? toAllNotations(v).logmar : '-' },
    { title: 'LogMAR OS', dataIndex: 'os', key: 'logmarOs', width: 80, render: (v: number) => v ? toAllNotations(v).logmar : '-' },
  ];

  const historyColumns = [
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 140, render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 16) : '-'}</span> },
    { title: '患者', dataIndex: 'patientName', key: 'patientName', width: 80 },
    { title: '裸眼 OD/OS', key: 'ucva', width: 110, render: (_: unknown, r: VisionRecord) => <span>{r.odUcva ?? '-'} / {r.osUcva ?? '-'}</span> },
    { title: '矫正 OD/OS', key: 'bcva', width: 110, render: (_: unknown, r: VisionRecord) => <span>{r.odBcva ?? '-'} / {r.osBcva ?? '-'}</span> },
    { title: '小孔 OD/OS', key: 'phva', width: 110, render: (_: unknown, r: VisionRecord) => <span>{(r.odPhva ?? '-')} / {(r.osPhva ?? '-')}</span> },
    { title: '右眼等级', key: 'odGrade', width: 90, render: (_: unknown, r: VisionRecord) => <Tag color={visionGrade(r.odBcva) === '正常' ? 'success' : 'warning'}>{visionGrade(r.odBcva)}</Tag> },
    { title: '左眼等级', key: 'osGrade', width: 90, render: (_: unknown, r: VisionRecord) => <Tag color={visionGrade(r.osBcva) === '正常' ? 'success' : 'warning'}>{visionGrade(r.osBcva)}</Tag> },
    { title: '记录者', dataIndex: 'examiner', key: 'examiner', width: 90, render: (v?: string) => v || '-' },
    { title: '操作', key: 'actions', width: 80, render: (_: unknown, r: VisionRecord) => <Popconfirm title="删除记录?" onConfirm={() => void handleDelete(r.id)}><Button size="small" danger icon={<Trash2 size={12} />} /></Popconfirm> },
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

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} action={<Button size="small" onClick={() => void load()}>重试</Button>} />}

      <Card size="small" title={<Space><Eye size={14} />当前患者</Space>} extra={<Space><Segmented size="small" value={distance} onChange={(v) => setDistance(v as string)} options={[{ label: '远视力', value: 'far' }, { label: '近视力', value: 'near' }]} /><Segmented size="small" value={notation} onChange={(v) => setNotation(v as string)} options={[{ label: '小数', value: 'decimal' }, { label: 'Snellen', value: 'snellen' }]} /></Space>} style={{ marginBottom: 12 }}>
        <Row gutter={12} align="middle">
          <Col>
            <Select value={patient} onChange={(v) => { setPatient(v); const p = PATIENT_OPTIONS.find(o => o.value === v); if (p) setPatientName(p.label); }} options={PATIENT_OPTIONS} style={{ width: 160 }} />
          </Col>
          <Col><Tag color="geekblue">{patientName}</Tag></Col>
          <Col><Button icon={<RefreshCw size={12} />} size="small" onClick={() => void load()}>刷新</Button></Col>
        </Row>
      </Card>

      <Row gutter={12}>
        <Col span={12}>
          <Card size="small" title="右眼 OD" extra={<EyeLateralityBadge eyeSide="OD" size="small" />}>
            <VisionAcuityInput label="裸眼视力" value={va.odUcva} onChange={(v) => setVa((s) => ({ ...s, odUcva: v }))} />
            <VisionAcuityInput label="矫正视力" value={va.odBcva} onChange={(v) => setVa((s) => ({ ...s, odBcva: v }))} />
            <VisionAcuityInput label="小孔视力" value={va.odPhva} onChange={(v) => setVa((s) => ({ ...s, odPhva: v }))} />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="左眼 OS" extra={<EyeLateralityBadge eyeSide="OS" size="small" />}>
            <VisionAcuityInput label="裸眼视力" value={va.osUcva} onChange={(v) => setVa((s) => ({ ...s, osUcva: v }))} />
            <VisionAcuityInput label="矫正视力" value={va.osBcva} onChange={(v) => setVa((s) => ({ ...s, osBcva: v }))} />
            <VisionAcuityInput label="小孔视力" value={va.osPhva} onChange={(v) => setVa((s) => ({ ...s, osPhva: v }))} />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="4 记法换算对照" style={{ marginTop: 12 }} extra={<Button type="primary" size="small" icon={<Save size={12} />} loading={saving} onClick={() => void handleSave()}>保存记录</Button>}>
        <Table rowKey="key" dataSource={data} columns={columns} pagination={false} size="small" bordered />
      </Card>

      <Card size="small" title={<Space><History size={14} />检查历史记录 <Tag>{records.length}</Tag></Space>} style={{ marginTop: 12 }}>
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            dataSource={records}
            columns={historyColumns}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            size="small"
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无检查记录, 保存后将显示在此" /> }}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default VisionExamPage;
