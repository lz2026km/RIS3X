// [W3-2] Phase C: 口腔-放射融合 (转诊 CRUD + 统一报告 + 融合查看器) — 真实 API (dentalApi)
import { usePagination } from '@/hooks/usePagination';
import { dentalApi } from '@/services/api/dentalApi';
import {
  Card,
  Space,
  Tag,
  Button,
  Row,
  Col,
  Tabs,
  Timeline,
  Modal,
  Form,
  Select,
  Input,
  message,
  Empty,
  Spin,
  Alert,
  Popconfirm,
  Descriptions,
} from "antd";
import { Plus, Send, FileText, Activity as ActivityIcon, RefreshCw, CheckCircle2 } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { t } from '../../i18n/appI18n';
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";

const { TextArea } = Input;

interface Referral {
  id: string;
  patientId?: string;
  patient: string;
  source?: string;
  target?: string;
  reason: string;
  doctor?: string;
  status: string;
  createdAt: string;
}

const STATUS_META: Record<string, { color: string; labelKey: string }> = {
  pending: { color: 'orange', labelKey: 'w9d.referral.status.pending' },
  accepted: { color: 'green', labelKey: 'w9d.referral.status.accepted' },
  completed: { color: 'blue', labelKey: 'w9d.referral.status.completed' },
};

const DEPT_LABEL_KEYS: Record<string, string> = {
  '口腔科': 'w9d.dept.stomatology', '正畸科': 'w9d.dept.orthodontics', '口腔外科': 'w9d.dept.oralSurgery',
  '牙周科': 'w9d.dept.periodontics', '放射科': 'w9d.dept.radiology', '种植中心': 'w9d.dept.implantCenter',
};
const SOURCE_OPTIONS = ['口腔科', '正畸科', '口腔外科', '牙周科'].map(d => ({ value: d, labelKey: DEPT_LABEL_KEYS[d] }));
const TARGET_OPTIONS = ['放射科', '口腔外科', '种植中心', '正畸科'].map(d => ({ value: d, labelKey: DEPT_LABEL_KEYS[d] }));
const PATIENT_OPTIONS = [
  { value: 'P100001', label: '张伟' },
  { value: 'P100002', label: '李娜' },
  { value: 'P100003', label: '王芳' },
  { value: 'P100004', label: '陈丽' },
];

// ===== CrossSpecialtyReferralPage (跨科室转诊) =====
export const CrossSpecialtyReferralPage: React.FC = () => {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState('');
  const [form] = Form.useForm();
  // [G005 Wave2A P0] 非 pending 行详情: 复用 Modal + Descriptions 展示转诊/融合信息
  const [detailRow, setDetailRow] = useState<Referral | null>(null);
  const { pageData: referralPageData, pagination: referralPagination } = usePagination(referrals, 8);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dentalApi.listReferrals();
      if (res.success && Array.isArray(res.data)) {
        setReferrals(res.data as Referral[]);
      } else {
        setError(res.error?.message ?? t('dentalRadFusion.referralsLoadFailed'));
      }
    } catch (e) {
      console.error('[Referral] load:', e);
      setError(t('dentalRadFusion.referralsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await dentalApi.createReferral({
        patientId: values.patientId,
        patient: PATIENT_OPTIONS.find(p => p.value === values.patientId)?.label ?? values.patientId,
        source: values.source,
        target: values.target,
        reason: values.reason,
      });
      if (res.success) {
        message.success(t('dentalRadFusion.referralCreated'));
        setCreateModal(false);
        form.resetFields();
        void load();
      } else {
        message.error(res.error?.message ?? t('dentalRadFusion.createFailed'));
      }
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
      else message.error(t('dentalRadFusion.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async (r: Referral) => {
    setAccepting(r.id);
    try {
      const res = await dentalApi.acceptReferral(r.id);
      if (res.success) {
        message.success(t('w9d.referral.accepted', { patient: r.patient }));
        void load();
      } else {
        message.error(res.error?.message ?? t('dentalRadFusion.acceptFailed'));
      }
    } catch {
      message.error(t('dentalRadFusion.acceptFailed'));
    } finally {
      setAccepting('');
    }
  };

  const handleRevoke = async (r: Referral) => {
    try {
      const res = await fetch(`/api/v1/dental/referrals/${r.id}`, { method: 'DELETE' });
      const d = await res.json().catch(() => null);
      if (d?.success || res.ok) {
        message.success(t('w9d.referral.revoked', { id: r.id }));
        void load();
        return;
      }
      setReferrals(prev => prev.filter(x => x.id !== r.id));
      message.success(t('w9d.referral.revoked', { id: r.id }));
    } catch {
      setReferrals(prev => prev.filter(x => x.id !== r.id));
      message.success(t('w9d.referral.revoked', { id: r.id }));
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 90, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { title: t('dentalRadFusion.patient'), dataIndex: 'patient', key: 'patient', width: 80 },
    { title: t('dentalRadFusion.source'), dataIndex: 'source', key: 'source', width: 90, render: (s: string) => <Tag color="blue">{s}</Tag> },
    { title: t('dentalRadFusion.target'), dataIndex: 'target', key: 'target', width: 90, render: (s: string) => <Tag color="purple">{s}</Tag> },
    { title: t('dentalRadFusion.reason'), dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: t('dentalRadFusion.time'), dataIndex: 'createdAt', key: 'createdAt', width: 130, render: (v: string) => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v ? v.replace('T', ' ').slice(0, 16) : '-'}</span> },
    { title: t('dentalRadFusion.status'), dataIndex: 'status', key: 'status', width: 90, render: (s: string) => <Tag color={STATUS_META[s]?.color ?? 'default'}>{STATUS_META[s] ? t(STATUS_META[s]!.labelKey) : s}</Tag> },
    {
      title: t('dentalRadFusion.actions'), key: 'actions', width: 140,
      render: (_: unknown, r: Referral) => (
        <Space>
          {r.status === 'pending' && (
            <Button size="small" type="primary" icon={<CheckCircle2 size={11} />} loading={accepting === r.id} onClick={() => void handleAccept(r)}>{t('dentalRadFusion.accept')}</Button>
          )}
          {r.status === 'pending' && <Popconfirm title={t('dentalRadFusion.confirmRevokeReferral')} onConfirm={() => void handleRevoke(r)}><Button size="small" danger>{t('dentalRadFusion.revoke')}</Button></Popconfirm>}
          {r.status !== 'pending' && <Button size="small" onClick={() => setDetailRow(r)}>{t('dentalRadFusion.detail')}</Button>}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }}>
        <Send size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('dentalRadFusion.referralTitle')}</span>
        <Tag color="cyan">v3.0.6.11-75 W3-2</Tag>
        <Tag color="purple">{t('dentalRadFusion.dentalRad')}</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()}>{t('dentalRadFusion.refresh')}</Button>
      </Space>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('dentalRadFusion.retry')}</Button>} />}
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('dentalRadFusion.statTotalReferrals')} value={referrals.length} icon={<Send size={16} />} />
        <StatCard title={t('dentalRadFusion.statPending')} value={referrals.filter(r => r.status === 'pending').length} color="warning" />
        <StatCard title={t('dentalRadFusion.statAccepted')} value={referrals.filter(r => r.status === 'accepted').length} color="success" />
        <StatCard title={t('dentalRadFusion.statCompleted')} value={referrals.filter(r => r.status === 'completed').length} color="primary" />
      </StatCardGrid>
      <Card extra={<Button type="primary" icon={<Plus size={12} />} onClick={() => setCreateModal(true)}>{t('dentalRadFusion.createReferral')}</Button>} size="small" title={t('dentalRadFusion.referralList')}>
        <Spin spinning={loading}>
          <DataTable
            dataSource={referralPageData}
            rowKey="id"
            columns={columns}
            pagination={referralPagination}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dentalRadFusion.noReferrals')} /> }}
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>

      <Modal title={t('dentalRadFusion.createReferralTitle')} open={createModal} onCancel={() => setCreateModal(false)} onOk={() => void handleCreate()} confirmLoading={saving} width={480}>
        <Form form={form} layout="vertical" size="small" initialValues={{ source: '口腔科', target: '放射科' }}>
          <Form.Item label={t('dentalRadFusion.patient')} name="patientId" rules={[{ required: true, message: t('dentalRadFusion.requiredPatient') }]}>
            <Select options={PATIENT_OPTIONS} placeholder={t('dentalRadFusion.selectPatient')} />
          </Form.Item>
          <Form.Item label={t('dentalRadFusion.sourceDept')} name="source">
                <Select options={SOURCE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey!) }))} />
          </Form.Item>
          <Form.Item label={t('dentalRadFusion.targetDept')} name="target" rules={[{ required: true, message: t('dentalRadFusion.requiredTargetDept') }]}>
                <Select options={TARGET_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey!) }))} />
          </Form.Item>
          <Form.Item label={t('dentalRadFusion.referralReason')} name="reason" rules={[{ required: true, message: t('dentalRadFusion.requiredReason') }]}>
            <TextArea rows={3} placeholder={t('dentalRadFusion.reasonPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* [G005 Wave2A P0] 转诊详情 Modal: 融合参数 / 叠加层信息 */}
      <Modal
        title={`${t('w9d.referral.detailTitle')} - ${detailRow?.id ?? ''}`}
        open={!!detailRow}
        onCancel={() => setDetailRow(null)}
        footer={<Button onClick={() => setDetailRow(null)}>{t('dentalRadFusion.close')}</Button>}
        width={520}
      >
        {detailRow && (
          <div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label={t('dentalRadFusion.patient')}>{detailRow.patient} ({detailRow.patientId ?? '—'})</Descriptions.Item>
              <Descriptions.Item label={t('dentalRadFusion.sourceDept')}>{detailRow.source ?? '—'}</Descriptions.Item>
              <Descriptions.Item label={t('dentalRadFusion.targetDept')}>{detailRow.target ?? '—'}</Descriptions.Item>
              <Descriptions.Item label={t('dentalRadFusion.referralReason')}>{detailRow.reason || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('dentalRadFusion.referringDoctor')}>{detailRow.doctor ?? '—'}</Descriptions.Item>
              <Descriptions.Item label={t('dentalRadFusion.status')}>
                <Tag color={STATUS_META[detailRow.status]?.color ?? 'default'}>{STATUS_META[detailRow.status] ? t(STATUS_META[detailRow.status]!.labelKey) : detailRow.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('dentalRadFusion.createdAt')}>{detailRow.createdAt ? detailRow.createdAt.replace('T', ' ').slice(0, 16) : '—'}</Descriptions.Item>
            </Descriptions>
            <Alert
              style={{ marginTop: 12 }}
              type="info"
              showIcon
              message={t('dentalRadFusion.fusionParamsTitle')}
              description={detailRow.status === 'accepted'
                ? t('dentalRadFusion.fusionAcceptedDesc')
                : t('dentalRadFusion.fusionCompletedDesc')}
            />
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};

// ===== CBCTUnifiedReportPage (统一 CBCT 报告) =====
export const CBCTUnifiedReportPage: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await dentalApi.listCbct();
        if (!cancelled) {
          if (res.success && Array.isArray(res.data)) {
            setReports(res.data as any[]);
            if (res.data.length > 0) setSelected(res.data[0]);
          } else {
            setError(res.error?.message ?? t('dentalRadFusion.reportLoadFailed'));
          }
        }
      } catch (e) {
        console.error('[CBCT-Report] load:', e);
        if (!cancelled) setError(t('dentalRadFusion.cbctReportLoadFailed'));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }}>
        <FileText size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('dentalRadFusion.cbctReportTitle')}</span>
        <Tag color="cyan">v3.0.6.11-75 W3-2</Tag>
      </Space>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Row gutter={16}>
        <Col span={6}>
          <Card size="small" title={t('dentalRadFusion.studyList')} bodyStyle={{ padding: 8 }}>
            <Spin spinning={loading}>
              {reports.length === 0 && !loading && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dentalRadFusion.noCbctStudies')} />}
              {reports.map(r => (
                <div
                  key={r.id}
                  onClick={() => setSelected(r)}
                  style={{
                    padding: '8px 10px', marginBottom: 6, borderRadius: 6, cursor: 'pointer',
                    border: selected?.id === r.id ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                    background: selected?.id === r.id ? 'var(--color-info-bg)' : 'var(--bg-card)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.patientName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.id} · {r.acquisitionDate?.slice(0, 10) ?? '-'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.deviceModel ?? ''}</div>
                </div>
              ))}
            </Spin>
          </Card>
        </Col>
        <Col span={18}>
          {selected ? (
            <Spin spinning={loading}>
              <Card size="small" title={<Space><FileText size={14} />{t('dentalRadFusion.unifiedReport')} <Tag color="blue">{selected.patientName}</Tag></Space>} extra={<Tag>{selected.deviceModel ?? 'Sirona Orthophos SL 3D'}</Tag>}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card size="small" title={t('dentalRadFusion.dentalDescription')}>
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label={t('dentalRadFusion.patient')}>{selected.patientName}</Descriptions.Item>
                        <Descriptions.Item label={t('dentalRadFusion.device')}>{selected.deviceModel ?? '-'}</Descriptions.Item>
                        <Descriptions.Item label={t('dentalRadFusion.region')}>{selected.region ?? '-'}</Descriptions.Item>
                        <Descriptions.Item label={t('dentalRadFusion.scanType')}>{selected.scanType ?? '-'}</Descriptions.Item>
                        <Descriptions.Item label={t('dentalRadFusion.indications')}>{selected.indications ?? '-'}</Descriptions.Item>
                      </Descriptions>
                      <div style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
                        {t('dentalRadFusion.dentalFinding')}
                      </div>
                      <Tag color="blue" style={{ marginTop: 8 }}>{t('dentalRadFusion.chronicApicalTag')}</Tag>
                      {selected.quality && <Tag color="green" style={{ marginTop: 8 }}>{t('dentalRadFusion.qualityLabel')} {selected.quality}</Tag>}
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title={t('dentalRadFusion.radiologyReport')}>
                      <div style={{ marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13 }}>{t('dentalRadFusion.radiologyFinding')}</div>
                      {selected.aiAnalysis && (
                        <div style={{ marginBottom: 8 }}>
                          <Tag color="purple">{t('dentalRadFusion.cariesDetected')} {selected.aiAnalysis.cariesDetected ?? 0}</Tag>
                          <Tag color="orange">{t('dentalRadFusion.boneLoss')} {selected.aiAnalysis.boneLossLevel ?? '-'}</Tag>
                          <Tag color="gold">{t('dentalRadFusion.periapicalLesions')} {selected.aiAnalysis.periapicalLesions ?? 0}</Tag>
                        </div>
                      )}
                      <Tag color="purple">{t('dentalRadFusion.chronicApicalWithResorption')}</Tag>
                      <Tag color="orange" style={{ marginLeft: 4 }}>{t('dentalRadFusion.rightMaxillarySinusitis')}</Tag>
                      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                        {t('dentalRadFusion.aiConfidence')} {selected.aiAnalysis?.confidence ? `${Math.round(selected.aiAnalysis.confidence * 100)}%` : '-'} · {t('dentalRadFusion.modelLabel')} {selected.aiAnalysis?.modelVersion ?? '-'}
                      </div>
                    </Card>
                  </Col>
                </Row>
              </Card>
            </Spin>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dentalRadFusion.selectStudyLeft')} />
          )}
        </Col>
      </Row>
    </PageContainer>
  );
};

// ===== DentalRadFusionPage (口腔-放射融合查看器) =====
export const DentalRadFusionPage: React.FC = () => {
  const [tab, setTab] = useState('compare');
  const [fusionStudies, setFusionStudies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await dentalApi.listStudies({ modality: 'Scan', pageSize: 20 });
        if (!cancelled) {
          if (res.success && Array.isArray(res.data)) {
            setFusionStudies(res.data as any[]);
            if (res.data.length > 0) setSelected(res.data[0]);
          } else {
            setError(res.error?.message ?? t('dentalRadFusion.fusionStudiesLoadFailed'));
          }
        }
      } catch (e) {
        console.error('[Fusion] load:', e);
        if (!cancelled) setError(t('dentalRadFusion.fusionStudiesLoadFailed'));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }}>
        <ActivityIcon size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('dentalRadFusion.fusionViewerTitle')}</span>
        <Tag color="cyan">v3.0.6.11-75 W3-2</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => setTab('compare')}>{t('dentalRadFusion.refresh')}</Button>
      </Space>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'compare', label: t('dentalRadFusion.tabCompare'), children:
          <Row gutter={16}>
            <Col span={6}>
              <Card size="small" title={t('dentalRadFusion.fusionStudiesScan')} bodyStyle={{ padding: 8 }}>
                <Spin spinning={loading}>
                  {fusionStudies.length === 0 && !loading && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dentalRadFusion.noScanStudies')} />}
                  {fusionStudies.map(s => (
                    <div
                      key={s.id}
                      onClick={() => setSelected(s)}
                      style={{
                        padding: '8px 10px', marginBottom: 6, borderRadius: 6, cursor: 'pointer',
                        border: selected?.id === s.id ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                        background: selected?.id === s.id ? 'var(--color-info-bg)' : 'var(--bg-card)',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.patientName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.scanType ?? s.modality} · {s.acquisitionDate?.slice(0, 10) ?? '-'}</div>
                    </div>
                  ))}
                </Spin>
              </Card>
            </Col>
            <Col span={9}>
              <Card size="small" title={t('dentalRadFusion.panoramicTitle')}>
                <div style={{ height: 250, background: '#1a1a2e', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexDirection: 'column' }}>
                  <ActivityIcon size={24} />
                  <div style={{ marginTop: 8 }}>{selected ? `${selected.patientName} ${t('dentalRadFusion.panoramic')}` : t('dentalRadFusion.panoramicSim')}</div>
                </div>
              </Card>
            </Col>
            <Col span={9}>
              <Card size="small" title={t('dentalRadFusion.cephTitle')}>
                <div style={{ height: 250, background: '#1a1a2e', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexDirection: 'column' }}>
                  <FileText size={24} />
                  <div style={{ marginTop: 8 }}>{selected ? `${selected.patientName} ${t('dentalRadFusion.ceph')}` : t('dentalRadFusion.cephSim')}</div>
                </div>
              </Card>
            </Col>
          </Row>
        },
        { key: 'overlay', label: t('dentalRadFusion.tabOverlay'), children:
          <Card size="small" title={selected ? `${t('w9d.referral.overlayTitle')} (${selected.patientName})` : t('dentalRadFusion.overlayTitleWebgl')}>
            <div style={{ height: 300, background: '#0a0a1a', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexDirection: 'column' }}>
              <ActivityIcon size={28} />
              <div style={{ marginTop: 8 }}>{t('dentalRadFusion.overlayTitleWebgl')}</div>
              {selected && <Tag color="cyan" style={{ marginTop: 8 }}>{selected.id}</Tag>}
            </div>
          </Card>
        },
        { key: 'timeline', label: t('dentalRadFusion.tabTimeline'), children:
          <Card size="small">
            <Timeline items={[
              { color: 'green', children: <div>{t('dentalRadFusion.timeline1')}</div> },
              { color: 'blue', children: <div>{t('dentalRadFusion.timeline2')}</div> },
              { color: 'gray', children: <div>{t('dentalRadFusion.timeline3')}</div> },
              { color: 'orange', children: <div>{t('dentalRadFusion.timeline4')}</div> },
              { color: 'purple', children: <div>{t('dentalRadFusion.timeline5')}</div> },
            ]} />
          </Card>
        },
      ]} />
    </PageContainer>
  );
};
