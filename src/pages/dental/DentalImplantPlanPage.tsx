// [W3-2] 种植计划: dentalApi.listImplantPlans3d 真实列表 + 新建/编辑 + 状态流转 (规划/已批准/已实施)
import { DentalPageLayout } from './DentalShared';
import { dentalApi } from '@/services/api/dentalApi';
import { Card, Tag, Button, Row, Col, Statistic, List, Modal, Form, Select, Input, InputNumber, message, Empty, Spin, Alert, Space, Popconfirm, Descriptions, Steps, Badge } from 'antd';
import { Plus, RefreshCw, CheckCircle2, Eye } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { t } from '../../i18n/appI18n';

const { TextArea } = Input;

const STATUS_META: Record<string, { color: string; labelKey: string }> = {
  planning: { color: 'default', labelKey: 'w9d.implantStatus.planning' },
  'guided-surgery': { color: 'cyan', labelKey: 'w9d.implantStatus.guidedSurgery' },
  approved: { color: 'green', labelKey: 'w9d.implantStatus.approved' },
  implementing: { color: 'blue', labelKey: 'w9d.implantStatus.implementing' },
  completed: { color: 'purple', labelKey: 'w9d.implantStatus.completed' },
  pending: { color: 'orange', labelKey: 'w9d.implantStatus.pending' },
};

const TYPE_KEYS: Record<string, string> = {
  '单颗种植': 'w9d.implantType.single', '多颗种植': 'w9d.implantType.multiple', '全口种植': 'w9d.implantType.full', '即刻种植': 'w9d.implantType.immediate',
};
const TYPE_OPTIONS = ['单颗种植', '多颗种植', '全口种植', '即刻种植'].map(item => ({ value: item, labelKey: TYPE_KEYS[item]! }));

export const DentalImplantPlanPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dentalApi.listImplantPlans3d();
      if (res.success && Array.isArray(res.data)) {
        setPlans(res.data as any[]);
      } else {
        setError(res.error?.message ?? t('dentalImplantPlan.errLoad'));
      }
    } catch (e) {
      console.error('[ImplantPlan] load:', e);
      setError(t('dentalImplantPlan.errLoad'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await dentalApi.createImplantPlan3d({
        patientId: values.patientId,
        patientName: values.patientName,
        toothNo: values.toothNo,
        type: values.type,
        diagnosis: values.diagnosis ?? '',
        plan: values.plan ?? '',
        cost: values.cost ?? 0,
        status: 'planning',
      });
      if (res.success) {
        message.success(t('dentalImplantPlan.created'));
        setCreateModal(false);
        form.resetFields();
        void load();
      } else {
        message.error(res.error?.message ?? t('dentalImplantPlan.createFailed'));
      }
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
      else message.error(t('dentalImplantPlan.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async (plan: any) => {
    const res = await dentalApi.validateImplantPlan(plan.id);
    if (res.success) {
      message.success(res.data?.valid ? t('dentalImplantPlan.validatePass') : t('dentalImplantPlan.validateFail'));
    } else {
      message.error(res.error?.message ?? t('dentalImplantPlan.errValidate'));
    }
  };

  const handleApprove = async (plan: any) => {
    const res = await dentalApi.approveImplantPlan(plan.id);
    if (res.success) {
      message.success(t('dentalImplantPlan.approved'));
      void load();
    } else {
      message.error(res.error?.message ?? t('dentalImplantPlan.errApprove'));
    }
  };

  const display = plans;
  const totalCost = display.reduce((s, p) => s + (p.cost || 0), 0);

  return (
    <DentalPageLayout header={{ title: t('dentalImplantPlan.title'), tags: [<Tag key='b' color='blue'>{t('dentalImplantPlan.tagBenchmark')}</Tag>, <Tag key='s' color='green'>{t('dentalImplantPlan.tagBrands')}</Tag>] }}>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('dentalImplantPlan.retry')}</Button>} />}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}><Card size="small"><Statistic title={t('dentalImplantPlan.statTotal')} value={display.length} prefix={<Plus size={12} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('dentalImplantPlan.statPending')} value={display.filter(p => p.status === 'pending' || p.status === 'planning').length} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('dentalImplantPlan.statApproved')} value={display.filter(p => p.status === 'approved' || p.status === 'implementing').length} styles={{ content: { color: '#2563eb' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('dentalImplantPlan.statCost')} value={(totalCost / 10000).toFixed(1)} suffix="万" styles={{ content: { color: '#52c41a' } }} /></Card></Col>
      </Row>
      <Row gutter={16}>
        <Col span={16}>
          <Card
            size="small"
            title={<Space>{t('dentalImplantPlan.planList')} <Badge count={display.length} size="small" /></Space>}
            extra={<Space><Button size="small" icon={<RefreshCw size={11} />} onClick={() => void load()} /><Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setCreateModal(true)}>{t('dentalImplantPlan.newPlan')}</Button></Space>}
          >
            <Spin spinning={loading}>
              <List
                dataSource={display}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dentalImplantPlan.noPlans')} /> }}
                renderItem={(item: any) => {
                  const meta = (STATUS_META[item.status] ?? { color: 'default', label: item.status ?? t('dentalImplantPlan.unknown') }) as { color: string; label?: string; labelKey?: string };
                  return (
                    <List.Item
                      actions={[
                        <Button key='v' size="small" icon={<Eye size={12} />} onClick={() => { setDetail(item); setDetailModal(true); }}>{t('dentalImplantPlan.view')}</Button>,
                        (item.status === 'planning' || item.status === 'pending') && (
                          <Button key='a' size="small" type="primary" icon={<CheckCircle2 size={12} />} onClick={() => void handleValidate(item)}>{t('dentalImplantPlan.validate')}</Button>
                        ),
                        item.status === 'planning' && (
                          <Popconfirm key='p' title={t('dentalImplantPlan.confirmApprove')} onConfirm={() => void handleApprove(item)}>
                            <Button size="small" type="primary" ghost icon={<CheckCircle2 size={12} />}>{t('dentalImplantPlan.approve')}</Button>
                          </Popconfirm>
                        ),
                      ].filter(Boolean)}
                    >
                      <List.Item.Meta
                        title={<span><Tag color='blue'>FDI {item.toothNo}</Tag>{item.patientName} - {item.type} <Tag color={meta.color}>{meta.labelKey ? t(meta.labelKey) : meta.label}</Tag></span>}
                        description={<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.diagnosis || '-'} | {item.plan || '-'} | {t('dentalImplantPlan.outpatientFee')}{item.cost ?? 0} | {item.entryPoint ? `植入位点 (${item.entryPoint.x}, ${item.entryPoint.y}, ${item.entryPoint.z})` : ''}</span>}
                      />
                    </List.Item>
                  );
                }}
              />
            </Spin>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={t('dentalImplantPlan.implantLibrary')}>
            {[{ name: 'Straumann BLT', tag: 'RC', desc: '4.1×8/10/12mm · 4.8×10/12mm' }, { name: 'Nobel Active', tag: 'NP', desc: '3.5×10/13mm · 4.3×10/13mm' }, { name: 'Nobel CC', tag: 'RP', desc: '3.5×8/10mm · 4.3×10/12mm' }, { name: 'Straumann BLX', tag: 'RB', desc: '3.75×8/10/12/14mm · 4.5×10/12mm' }].map((b, i) => (
              <div key={i} style={{ marginBottom: 8, padding: 8, background: 'var(--bg-card)', borderRadius: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{b.name}</b><Tag color={['blue', 'purple', 'cyan', 'green'][i]}>{b.tag}</Tag></div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{b.desc}</div>
              </div>
            ))}
          </Card>
          <Card size="small" title={t('dentalImplantPlan.boneAnalysis')} style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}><span>{t('dentalImplantPlan.boneTypeA')}</span><Tag color='green'>42%</Tag></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}><span>{t('dentalImplantPlan.boneTypeB')}</span><Tag color='blue'>38%</Tag></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}><span>{t('dentalImplantPlan.boneTypeC')}</span><Tag color='orange'>20%</Tag></div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>{t('dentalImplantPlan.boneNote')}</div>
          </Card>
        </Col>
      </Row>

      <Modal title={t('dentalImplantPlan.newPlanModal')} open={createModal} onCancel={() => setCreateModal(false)} onOk={() => void handleCreate()} confirmLoading={saving} width={480}>
        <Form form={form} layout="vertical" size="small" initialValues={{ type: '单颗种植', toothNo: 36 }}>
          <Form.Item label={t('dentalImplantPlan.patientName')} name="patientName" rules={[{ required: true, message: t('dentalImplantPlan.enterPatientName') }]}>
            <Input placeholder={t('dentalImplantPlan.patientName')} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label={t('dentalImplantPlan.toothNoFdi')} name="toothNo" rules={[{ required: true, message: t('dentalImplantPlan.enterToothNo') }]}>
                <InputNumber min={1} max={48} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('dentalImplantPlan.treatmentType')} name="type">
                <Select options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label={t('dentalImplantPlan.diagnosis')} name="diagnosis">
            <Input placeholder={t('dentalImplantPlan.diagnosisPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('dentalImplantPlan.plan')} name="plan">
            <TextArea rows={2} placeholder={t('dentalImplantPlan.planPlaceholder')} />
          </Form.Item>
          <Form.Item label={t('dentalImplantPlan.cost')} name="cost">
            <InputNumber min={0} step={100} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`${t('dentalImplantPlan.detailTitle')} - ${detail?.id ?? ''}`} open={detailModal} onCancel={() => setDetailModal(false)} footer={null} width={560}>
        {detail && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('dentalImplantPlan.patient')}>{detail.patientName}</Descriptions.Item>
              <Descriptions.Item label={t('dentalImplantPlan.toothPosition')}><Tag color="blue">FDI {detail.toothNo}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('dentalImplantPlan.type')}>{detail.type}</Descriptions.Item>
              <Descriptions.Item label={t('dentalImplantPlan.status')}><Tag color={STATUS_META[detail.status]?.color ?? 'default'}>{STATUS_META[detail.status] ? t(STATUS_META[detail.status]!.labelKey) : detail.status}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('dentalImplantPlan.diagnosis')} span={2}>{detail.diagnosis || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('dentalImplantPlan.plan')} span={2}>{detail.plan || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('dentalImplantPlan.cost')}>¥{detail.cost ?? 0}</Descriptions.Item>
              <Descriptions.Item label={t('dentalImplantPlan.distanceToNerve')}>{detail.distanceToNerve ?? '-'} mm</Descriptions.Item>
            </Descriptions>
            <Steps
              size="small"
              current={detail.status === 'planning' ? 0 : detail.status === 'approved' ? 1 : detail.status === 'implementing' ? 2 : 3}
              items={[{ title: t('dentalImplantPlan.stepPlanning') }, { title: t('dentalImplantPlan.stepApproved') }, { title: t('dentalImplantPlan.stepImplementing') }, { title: t('dentalImplantPlan.stepCompleted') }]}
            />
          </>
        )}
      </Modal>
    </DentalPageLayout>
  );
};

export default DentalImplantPlanPage;
