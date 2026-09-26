// [v3.0.6.8-54] 口腔影像列表页
// [v3.0.6.8-81] 修复: 复用 shared constants
import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { Card, Space, Tag, Button, Select, Row, Col, Statistic, message, List, Input, Badge, Modal, Form, DatePicker, Popconfirm, Table } from 'antd';
import { Activity, Eye, RefreshCw, Plus, Edit3, Trash2, GitCompareArrows } from 'lucide-react';
import { dentalApi } from '../../services/api/dentalApi';
import { ErrorBanner } from '../../components/feedback';
import { MODALITY_LABELS, MODALITY_COLORS } from '../../data/dental/constants';
import { t } from '../../i18n/appI18n';

const QUALITY_LABELS: Record<string, string> = { Diagnostic: 'dentalStudies.qualityDiagnostic', Acceptable: 'dentalStudies.qualityAcceptable', Suboptimal: 'dentalStudies.qualitySuboptimal', Reject: 'dentalStudies.qualityReject' };
const STATUS_LABELS: Record<string, string> = { acquired: 'dentalStudies.statusAcquired', reviewed: 'dentalStudies.statusReviewed', reported: 'dentalStudies.statusReported', archived: 'dentalStudies.statusArchived' };

export const DentalStudiesPage: React.FC = () => {
  const [studies, setStudies] = useState<any[]>([]);
  const [filter, setFilter] = useState({ modality: '', patientName: '' });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // [G005 Wave1A P1] 影像登记: dentalApi.createStudy / updateStudy / deleteStudy (后端真实)
  const [regOpen, setRegOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [regForm] = Form.useForm();
  // [G005 Wave1A P1] 影像对比: dentalApi.compareStudies (选中 2 个 → 并排表格 Modal)
  const [cmpA, setCmpA] = useState<string | undefined>();
  const [cmpB, setCmpB] = useState<string | undefined>();
  const [cmpOpen, setCmpOpen] = useState(false);
  const [cmpResult, setCmpResult] = useState<any>(null);
  const [cmpLoading, setCmpLoading] = useState(false);

  const handleCompare = async () => {
    if (!cmpA || !cmpB || cmpA === cmpB) {
      message.warning(t('dentalStudies.selectTwo'));
      return;
    }
    setCmpLoading(true);
    try {
      const res = await dentalApi.compareStudies(cmpA, cmpB);
      if (res.success) {
        setCmpResult(res.data);
        setCmpOpen(true);
      } else {
        message.error(res.error?.message ?? t('dentalStudies.compareFailed'));
      }
    } catch (e: any) {
      message.error(e?.message ?? t('dentalStudies.compareFailed'));
    } finally {
      setCmpLoading(false);
    }
  };

  const studyOptions = studies.map(s => ({ value: s.id, label: `${s.patientName} · ${s.modality} · ${s.id}` }));
  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // [W2-C] 接 dentalApi.getStudies 真实列表 (MSW dentalHandlers 演示数据)
      const params: any = { pageSize: '50' };
      if (filter.modality) params.modality = filter.modality;
      const r = await dentalApi.listStudies(params);
      if (r.success) setStudies(r.data ?? []);
      else setLoadError(t('w9.states.error'));
    } catch { setLoadError(t('w9.states.error')); message.error(t('dentalStudies.loadFailed')); }
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

  const openCreate = () => {
    setEditing(null);
    regForm.resetFields();
    setRegOpen(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    regForm.setFieldsValue({
      patientId: s.patientId,
      patientName: s.patientName,
      modality: s.modality,
      region: s.region,
      deviceModel: s.deviceModel,
      // [G005 Wave2B P2] antd v6 DatePicker 需 dayjs 实例, 字符串会触发 getUDayjs().isValid 崩溃
      studyDate: s.acquisitionDate ? dayjs(s.acquisitionDate.slice(0, 10)) : undefined,
      status: s.status,
    });
    setRegOpen(true);
  };

  const handleSaveStudy = async () => {
    let values: any = {};
    try { values = await regForm.validateFields(); } catch { return; }
    setSaving(true);
    try {
      const payload = {
        patientId: values.patientId,
        patientName: values.patientName ?? '',
        modality: values.modality,
        region: values.region ?? '',
        deviceModel: values.deviceModel ?? '',
        acquisitionDate: values.studyDate,
        studyDate: values.studyDate,
        status: values.status ?? 'acquired',
        indications: values.indications ?? '',
      };
      const res = editing
        ? await dentalApi.updateStudy(editing.id, payload)
        : await dentalApi.createStudy(payload);
      if (res.success) {
        message.success(editing ? t('dentalStudies.updated') : t('dentalStudies.registered'));
        setRegOpen(false);
        await load();
      } else {
        message.error(res.error?.message ?? (editing ? t('dentalStudies.updateFailed') : t('dentalStudies.registerFailed')));
      }
    } catch (e: any) {
      message.error(e?.message ?? (editing ? t('dentalStudies.updateFailed') : t('dentalStudies.registerFailed')));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudy = async (s: any) => {
    try {
      const res = await dentalApi.deleteStudy(s.id);
      if (res.success) {
        message.success(t('w9d.dentalStudies.deleted', { id: s.id }));
        await load();
      } else {
        message.error(res.error?.message ?? t('dentalStudies.deleteFailed'));
      }
    } catch (e: any) {
      message.error(e?.message ?? t('dentalStudies.deleteFailed'));
    }
  };

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Activity size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('dentalStudies.title')}</span>
        <Tag color="cyan">v3.0.6.8-54</Tag>
        <Tag color="purple">{t('dentalStudies.benchmark')}</Tag>
      </Space>
      {loadError && <ErrorBanner message={loadError} onRetry={() => void load()} retryLabel={t('w9.states.retry')} />}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title={t('dentalStudies.statAll')} value={stats.total} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="CBCT" value={stats.cbct} styles={{ content: {  color: '#722ed1'  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('dentalStudies.statPanoramic')} value={stats.panoramic} styles={{ content: {  color: '#2563eb'  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('dentalStudies.statPeriapical')} value={stats.periapical} styles={{ content: {  color: '#52c41a'  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('dentalStudies.statScan')} value={stats.scan} styles={{ content: {  color: '#13c2c2'  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title={t('dentalStudies.statToday')} value={studies.filter(s => s.acquisitionDate === new Date().toISOString().slice(0,10)).length} /></Card></Col>
      </Row>
      <Card size="small" style={{ marginBottom: 12 }} title={<Space size={8}><GitCompareArrows size={14} />{t('dentalStudies.compareTitle')}</Space>}>
        <Space wrap>
          <Select size="small" style={{ width: 220 }} placeholder={t('dentalStudies.imageA')} value={cmpA} onChange={setCmpA} options={studyOptions} showSearch optionFilterProp="label" />
          <Select size="small" style={{ width: 220 }} placeholder={t('dentalStudies.imageB')} value={cmpB} onChange={setCmpB} options={studyOptions} showSearch optionFilterProp="label" />
          <Button size="small" type="primary" icon={<GitCompareArrows size={12} />} loading={cmpLoading} onClick={() => void handleCompare()}>{t('dentalStudies.compare')}</Button>
        </Space>
      </Card>
      <Card
        size="small"
        title={`${t('dentalStudies.listTitle')} (${filtered.length})`}
        extra={
          <Space>
            <Select size="small" value={filter.modality || undefined} onChange={v => setFilter({ ...filter, modality: v })} allowClear placeholder={t('dentalStudies.modality')} style={{ width: 120 }}
              options={[
                { value: 'CBCT', label: 'CBCT' },
                { value: 'Panoramic', label: t('dentalStudies.modPanoramic') },
                { value: 'Periapical', label: t('dentalStudies.modPeriapical') },
                { value: 'Scan', label: t('dentalStudies.modScan') },
                { value: 'Bitewing', label: t('dentalStudies.modBitewing') },
              ]}
            />
            <Input.Search size="small" value={filter.patientName} onChange={e => setFilter({ ...filter, patientName: e.target.value })} placeholder={t('dentalStudies.patientName')} style={{ width: 160 }} />
            <Button icon={<Plus size={12} />} type="primary" onClick={openCreate}>{t('dentalStudies.register')}</Button>
            <Button icon={<RefreshCw size={12} />} onClick={load} loading={loading}>{t('dentalStudies.refresh')}</Button>
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
                <Button key="v" type="link" size="small" icon={<Eye size={12} />} onClick={() => window.open(`/dental/viewer?studyId=${s.id}&modality=${s.modality}`, '_blank')}>{t('dentalStudies.view')}</Button>,
                <Button key="e" type="link" size="small" icon={<Edit3 size={12} />} onClick={() => openEdit(s)}>{t('dentalStudies.edit')}</Button>,
                <Popconfirm key="d" title={t('dentalStudies.confirmDelete')} onConfirm={() => void handleDeleteStudy(s)}>
                  <Button type="link" size="small" danger icon={<Trash2 size={12} />}>{t('dentalStudies.delete')}</Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <div style={{
                    width: 60, height: 50, borderRadius: 4,
                    background: s.thumbnail || '#f0f0f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-secondary)', fontSize: 10,
                  }}>
                    {s.modality === 'CBCT' ? '3D' : s.modality === 'Panoramic' ? t('dentalStudies.modPanoramic') : s.modality === 'Scan' ? '3D' : '2D'}
                  </div>
                }
                title={
                  <Space>
                    <Tag color={MODALITY_COLORS[s.modality]}>{MODALITY_LABELS[s.modality] || s.modality}</Tag>
                    <span style={{ fontWeight: 600 }}>{s.patientName}</span>
                    {s.aiAnalysis?.cariesDetected > 0 && <Badge count={s.aiAnalysis.cariesDetected}><Tag color="red">{t('dentalStudies.caries')}</Tag></Badge>}
                  </Space>
                }
                description={
                  <Space style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    <span>{s.deviceModel}</span>
                    <span>|</span>
                    <span>{s.fieldOfView}</span>
                    <span>|</span>
                    <span>{s.acquisitionDate}</span>
                    <span>{s.segments && <Tag color="purple" style={{ fontSize: 10 }}>{s.segments.length} {t('dentalStudies.segments')}</Tag>}</span>
                    <Tag color={s.quality === 'Diagnostic' ? 'green' : s.quality === 'Acceptable' ? 'blue' : 'orange'} style={{ fontSize: 10 }}>{t(QUALITY_LABELS[s.quality] ?? s.quality)}</Tag>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
      <Modal
        title={editing ? `${t('dentalStudies.editTitle')} - ${editing.id}` : t('dentalStudies.register')}
        open={regOpen}
        onCancel={() => setRegOpen(false)}
        onOk={() => void handleSaveStudy()}
        confirmLoading={saving}
        width={480}
      >
        <Form form={regForm} layout="vertical" size="small" style={{ marginTop: 8 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label={t('dentalStudies.patientId')} name="patientId" rules={[{ required: true, message: t('dentalStudies.patientIdRequired') }]}>
                <Input placeholder={t('w9d.dentalStudies.patientIdPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('dentalStudies.patientName')} name="patientName">
                <Input placeholder={t('dentalStudies.optional')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('dentalStudies.modality')} name="modality" rules={[{ required: true, message: t('dentalStudies.modalityRequired') }]}>
                <Select options={[
                  { value: 'CBCT', label: 'CBCT' },
                  { value: 'Panoramic', label: t('dentalStudies.modPanoramic') },
                  { value: 'Periapical', label: t('dentalStudies.modPeriapical') },
                  { value: 'Scan', label: t('dentalStudies.modScan') },
                  { value: 'Bitewing', label: t('dentalStudies.modBitewing') },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('dentalStudies.studyDate')} name="studyDate" rules={[{ required: true, message: t('dentalStudies.dateRequired') }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('dentalStudies.region')} name="region">
                <Input placeholder={t('dentalStudies.regionPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('dentalStudies.deviceModel')} name="deviceModel">
                <Input placeholder={t('w9d.dentalStudies.deviceModelPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={t('dentalStudies.indications')} name="indications">
                <Input placeholder={t('dentalStudies.indicationsPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('dentalStudies.status')} name="status">
                <Select options={['acquired', 'reviewed', 'reported', 'archived'].map(v => ({ value: v, label: t(STATUS_LABELS[v] ?? v) }))} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      <Modal
        title={`${t('dentalStudies.compareTitle')}: ${cmpResult?.idA ?? ''} vs ${cmpResult?.idB ?? ''}`}
        open={cmpOpen}
        onCancel={() => setCmpOpen(false)}
        footer={<Button onClick={() => setCmpOpen(false)}>{t('dentalStudies.close')}</Button>}
        width={640}
      >
        {cmpResult && (
          <>
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={8}><Card size="small"><Statistic title={t('dentalStudies.imageA')} value={cmpResult.modalityA} /></Card></Col>
              <Col span={8}><Card size="small"><Statistic title={t('dentalStudies.imageB')} value={cmpResult.modalityB} /></Card></Col>
              {/* [G005 Wave2B P2] MSW compare 返回 {studyA, studyB, differences} 无 differenceScore → 由差异条目数派生兜底 */}
              <Col span={8}><Card size="small"><Statistic title={t('dentalStudies.difference')} value={String(cmpResult.differenceScore ?? (Array.isArray(cmpResult.differences) ? cmpResult.differences.length : 0))} /></Card></Col>
            </Row>
            <Table
              size="small"
              rowKey="k"
              pagination={false}
              scroll={{ x: 'max-content' }}
              dataSource={[
                { k: '1', label: t('dentalStudies.samePatient'), a: String(cmpResult.samePatient ?? '-'), b: String(cmpResult.samePatient ?? '-') },
                { k: '2', label: t('dentalStudies.acquiredAt'), a: cmpResult.diff?.acquiredA?.slice(0, 10) ?? '-', b: cmpResult.diff?.acquiredB?.slice(0, 10) ?? '-' },
                // [v3.0.6.11-98 Wave3B P2] 差异数组完整渲染 (后端 compare 返回 differences: string[])
                ...(Array.isArray(cmpResult.differences)
                  ? cmpResult.differences.map((d: unknown, i: number) => ({
                      k: `diff-${i}`,
                      label: `${t('dentalStudies.difference')} ${i + 1}`,
                      a: '—',
                      b: String(d),
                    }))
                  : []),
              ]}
              columns={[
                { title: t('dentalStudies.colItem'), dataIndex: 'label', width: 100 },
                { title: `${t('dentalStudies.imageA')} (${cmpResult.idA})`, dataIndex: 'a' },
                { title: `${t('dentalStudies.imageB')} (${cmpResult.idB})`, dataIndex: 'b' },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
};
export default DentalStudiesPage;
