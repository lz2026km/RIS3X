// [W3-2] 视力检查: eyeApi 记录 CRUD + 视力表 (Snellen) 录入 + 历史记录
import EyeLateralityBadge from '@/components/eye/EyeLateralityBadge';
import { t } from '../../../i18n/appI18n';
import VisionAcuityInput from '@/components/eye/VisionAcuityInput';
import { usePagination } from '@/hooks/usePagination';
import { eyeApi } from '@/services/api/eyeApi';
import { toAllNotations, visionGrade } from '@/services/eye/visionConverter';
import { Card, Row, Col, Tag, Table, Button, Space, Select, message, Alert, Spin, Empty, Segmented, Popconfirm } from 'antd';
import { Eye, Save, History, RefreshCw, Trash2 } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

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
  const { pageData: recordPageData, pagination: recordPagination } = usePagination(records, 8);
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
        setError(res.error?.message ?? t('visionExam.loadFailRecord'));
      }
    } catch (e) {
      console.error('[VisionExam] load:', e);
      setError(t('visionExam.loadFail'));
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
        message.success(t('visionExam.saveSuccess'));
        void load();
      } else {
        message.error(res.error?.message ?? t('visionExam.saveFail'));
      }
    } catch {
      message.error(t('visionExam.saveFailRetry'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await eyeApi.deleteVisionRecord(id);
      if (res.success) {
        message.success(t('visionExam.deleteSuccess'));
      } else {
        message.warning(res.error?.message ?? t('visionExam.deleteUnavailable'));
      }
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch {
      setRecords(prev => prev.filter(r => r.id !== id));
      message.success(t('visionExam.deleteLocal'));
    }
  };

  const data = [
    { key: 'ucva', label: t('visionExam.data.ucva'), od: va.odUcva, os: va.osUcva },
    { key: 'bcva', label: t('visionExam.data.bcva'), od: va.odBcva, os: va.osBcva },
    { key: 'phva', label: t('visionExam.data.phva'), od: va.odPhva ?? 0, os: va.osPhva ?? 0 },
  ];

  const columns = [
    { title: '', dataIndex: 'label', key: 'label', width: 60, render: (v: string) => <b>{v}</b> },
    { title: t('visionExam.col.rightEye'), dataIndex: 'od', key: 'od', width: 80, render: (v: number) => <span style={{ fontWeight: 600 }}>{v || '-'}</span> },
    { title: t('visionExam.col.leftEye'), dataIndex: 'os', key: 'os', width: 80, render: (v: number) => <span style={{ fontWeight: 600 }}>{v || '-'}</span> },
    { title: 'Snellen OD', dataIndex: 'od', key: 'snellenOd', width: 100, render: (v: number) => v ? String(toAllNotations(v).snellen) : '-' },
    { title: 'Snellen OS', dataIndex: 'os', key: 'snellenOs', width: 100, render: (v: number) => v ? String(toAllNotations(v).snellen) : '-' },
    { title: '5分 OD', dataIndex: 'od', key: 'fiveOd', width: 60, render: (v: number) => v ? toAllNotations(v).five : '-' },
    { title: '5分 OS', dataIndex: 'os', key: 'fiveOs', width: 60, render: (v: number) => v ? toAllNotations(v).five : '-' },
    { title: 'LogMAR OD', dataIndex: 'od', key: 'logmarOd', width: 80, render: (v: number) => v ? toAllNotations(v).logmar : '-' },
    { title: 'LogMAR OS', dataIndex: 'os', key: 'logmarOs', width: 80, render: (v: number) => v ? toAllNotations(v).logmar : '-' },
  ];

  const historyColumns = [
    { title: t('visionExam.col.time'), dataIndex: 'createdAt', key: 'createdAt', width: 140, render: (v: string) => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v ? v.replace('T', ' ').slice(0, 16) : '-'}</span> },
    { title: t('visionExam.col.patient'), dataIndex: 'patientName', key: 'patientName', width: 80 },
    { title: t('visionExam.col.ucvaOs'), key: 'ucva', width: 110, render: (_: unknown, r: VisionRecord) => <span>{r.odUcva ?? '-'} / {r.osUcva ?? '-'}</span> },
    { title: t('visionExam.col.bcvaOs'), key: 'bcva', width: 110, render: (_: unknown, r: VisionRecord) => <span>{r.odBcva ?? '-'} / {r.osBcva ?? '-'}</span> },
    { title: t('visionExam.col.phvaOs'), key: 'phva', width: 110, render: (_: unknown, r: VisionRecord) => <span>{(r.odPhva ?? '-')} / {(r.osPhva ?? '-')}</span> },
    { title: t('visionExam.col.odGrade'), key: 'odGrade', width: 90, render: (_: unknown, r: VisionRecord) => <Tag color={visionGrade(r.odBcva) === '正常' ? 'success' : 'warning'}>{visionGrade(r.odBcva)}</Tag> },
    { title: t('visionExam.col.osGrade'), key: 'osGrade', width: 90, render: (_: unknown, r: VisionRecord) => <Tag color={visionGrade(r.osBcva) === '正常' ? 'success' : 'warning'}>{visionGrade(r.osBcva)}</Tag> },
    { title: t('visionExam.col.examiner'), dataIndex: 'examiner', key: 'examiner', width: 90, render: (v?: string) => v || '-' },
    { title: t('visionExam.col.actions'), key: 'actions', width: 80, render: (_: unknown, r: VisionRecord) => <Popconfirm title={t('visionExam.confirmDelete')} onConfirm={() => void handleDelete(r.id)}><Button size="small" danger icon={<Trash2 size={12} />} /></Popconfirm> },
  ];

  return (
    <div style={{ padding: 16, background: 'var(--bg-card)', minHeight: 'calc(100vh - 56px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Eye className="v4-icon" style={{ width: 24, height: 24, color: '#2563eb' }} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('visionExam.title')}</span>
        <EyeLateralityBadge eyeSide="OD" />
        <EyeLateralityBadge eyeSide="OS" />
        <Tag color="blue">{t('visionExam.tagUcvaBcvaPhva')}</Tag>
        <Tag color="cyan">{t('visionExam.tagNotations')}</Tag>
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('visionExam.retry')}</Button>} />}

      <Card size="small" title={<Space><Eye size={14} />{t('visionExam.currentPatient')}</Space>} extra={<Space><Segmented size="small" value={distance} onChange={(v) => setDistance(v as string)} options={[{ label: t('visionExam.farVision'), value: 'far' }, { label: t('visionExam.nearVision'), value: 'near' }]} /><Segmented size="small" value={notation} onChange={(v) => setNotation(v as string)} options={[{ label: t('visionExam.decimal'), value: 'decimal' }, { label: 'Snellen', value: 'snellen' }]} /></Space>} style={{ marginBottom: 12 }}>
        <Row gutter={12} align="middle">
          <Col>
            <Select value={patient} onChange={(v) => { setPatient(v); const p = PATIENT_OPTIONS.find(o => o.value === v); if (p) setPatientName(p.label); }} options={PATIENT_OPTIONS} style={{ width: 160 }} />
          </Col>
          <Col><Tag color="geekblue">{patientName}</Tag></Col>
          <Col><Button icon={<RefreshCw size={12} />} size="small" onClick={() => void load()}>{t('visionExam.refresh')}</Button></Col>
        </Row>
      </Card>

      <Row gutter={12}>
        <Col span={12}>
          <Card size="small" title={t('visionExam.col.rightEye')} extra={<EyeLateralityBadge eyeSide="OD" size="small" />}>
            <VisionAcuityInput label={t('visionExam.ucvaVision')} value={va.odUcva} onChange={(v) => setVa((s) => ({ ...s, odUcva: v }))} />
            <VisionAcuityInput label={t('visionExam.bcvaVision')} value={va.odBcva} onChange={(v) => setVa((s) => ({ ...s, odBcva: v }))} />
            <VisionAcuityInput label={t('visionExam.phvaVision')} value={va.odPhva} onChange={(v) => setVa((s) => ({ ...s, odPhva: v }))} />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title={t('visionExam.col.leftEye')} extra={<EyeLateralityBadge eyeSide="OS" size="small" />}>
            <VisionAcuityInput label={t('visionExam.ucvaVision')} value={va.osUcva} onChange={(v) => setVa((s) => ({ ...s, osUcva: v }))} />
            <VisionAcuityInput label={t('visionExam.bcvaVision')} value={va.osBcva} onChange={(v) => setVa((s) => ({ ...s, osBcva: v }))} />
            <VisionAcuityInput label={t('visionExam.phvaVision')} value={va.osPhva} onChange={(v) => setVa((s) => ({ ...s, osPhva: v }))} />
          </Card>
        </Col>
      </Row>

      <Card size="small" title={t('visionExam.conversion')} style={{ marginTop: 12 }} extra={<Button type="primary" size="small" icon={<Save size={12} />} loading={saving} onClick={() => void handleSave()}>{t('visionExam.saveRecord')}</Button>}>
        <Table rowKey="key" dataSource={data} columns={columns} pagination={false} size="small" bordered scroll={{ x: 'max-content' }}/>
      </Card>

      <Card size="small" title={<Space><History size={14} />{t('visionExam.historyTitle')} <Tag>{records.length}</Tag></Space>} style={{ marginTop: 12 }}>
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            dataSource={recordPageData}
            columns={historyColumns}
            pagination={recordPagination}
            size="small"
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('visionExam.emptyHistory')} /> }}
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default VisionExamPage;
