// [v3.0.6.11-54] Phase 2: 口腔治疗中心 (治疗计划列表 + 新建治疗)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Spin,
  Tag,
  Empty,
  Popconfirm,
  Descriptions,
} from "antd";
import { Plus, RefreshCw, Stethoscope, Activity, CheckCircle2 } from 'lucide-react';
import { DentalPageLayout } from './DentalShared';
import { dentalApi } from '../../services/api/dentalApi';
import { usePagination } from '../../hooks/usePagination';
import { t } from '../../i18n/appI18n';
import { toneToAntd } from '../../theme/statusTokens';
import { DataTable, StatCard, StatCardGrid } from "../../components/common";

const STATUS_COLOR: Record<string, string> = {
  completed: toneToAntd('completed'), Completed: toneToAntd('completed'), InProgress: toneToAntd('in_progress'), in_progress: toneToAntd('in_progress'),
  planned: toneToAntd('scheduled'), Planned: toneToAntd('scheduled'), cancelled: toneToAntd('cancelled'), Cancelled: toneToAntd('cancelled'),
};

export const DentalTreatmentPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [detailItem, setDetailItem] = useState<any>(null);
  // [G005 W3-B] 详情加载态 (GET /dental/treatments/:id)
  const [detailLoading, setDetailLoading] = useState(false);
  // [G005 Wave1A P1] 治疗类型字典: dentalApi.listTreatmentTypes (GET /dental/treatments/types, 后端真实)
  const [treatmentTypes, setTreatmentTypes] = useState<any[]>([]);

  useEffect(() => {
    void dentalApi.listTreatmentTypes().then((res: any) => {
      if (res.success && Array.isArray(res.data)) setTreatmentTypes(res.data);
    }).catch(() => { /* 保留硬编码回退 */ });
  }, []);

  const typeOptions = (treatmentTypes.length > 0
    ? treatmentTypes.map((tt: any) => (typeof tt === 'string' ? { value: tt, label: tt } : { value: tt.category ?? tt.name, label: tt.name }))
    : [['Restorative', t('dentalTreatment.typeRestorative')], ['Endodontic', t('dentalTreatment.typeEndodontic')], ['Orthodontic', t('dentalTreatment.typeOrthodontic')], ['Implant', t('dentalTreatment.typeImplant')], ['Extraction', t('dentalTreatment.typeExtraction')], ['Prosthodontic', t('dentalTreatment.typeProsthodontic')]].map(([value, label]) => ({ value, label }))
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dentalApi.listTreatments({ pageSize: 100 });
      if (res.success) {
        setItems(res.data ?? []);
      } else {
        setError(res.error?.message ?? t('dentalTreatment.errLoad'));
        setItems([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? t('dentalTreatment.errLoad'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // [W3-C] 受控分页: 治疗计划列表 (数据全量, 前端切片)
  const listPagination = usePagination(items, 10);

  const stats = useMemo(() => {
    const active = items.filter((item) => {
      const s = String(item.status ?? '').toLowerCase();
      return s !== 'completed' && s !== 'cancelled';
    }).length;
    const completed = items.filter((item) => String(item.status ?? '').toLowerCase() === 'completed').length;
    const totalCost = items.reduce((s, item) => s + (item.cost ?? item.estimatedCost ?? 0), 0);
    return { total: items.length, active, completed, totalCost };
  }, [items]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = await dentalApi.createTreatment({
        patientName: values.patientName,
        patientId: values.patientId,
        toothNo: values.toothNo,
        diagnosis: values.diagnosis,
        plan: values.plan,
        type: values.type ?? 'Restorative',
        cost: values.cost ?? 0,
        status: 'planned',
      });
      if (res.success) {
        message.success(t('dentalTreatment.created'));
        setCreateOpen(false);
        form.resetFields();
        void load();
      } else {
        message.error(res.error?.message ?? t('dentalTreatment.createFailed'));
      }
    } catch {
      // 表单校验失败或取消
    } finally {
      setSubmitting(false);
    }
  };

  const handleStart = async (id: string) => {
    const res = await dentalApi.startTreatment(id);
    if (res.success) {
      message.success(t('dentalTreatment.started'));
      void load();
    } else {
      message.error(res.error?.message ?? t('dentalTreatment.opFailed'));
    }
  };

  // [G005 W3-B] 治疗详情: GET /dental/treatments/:id (dentalApi.getTreatment 真实端点)
  const handleShowDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await dentalApi.getTreatment(id);
      if (res.success && res.data) {
        setDetailItem(res.data);
      } else {
        message.warning(res.error?.message ?? t('dentalTreatment.detailFallback'));
        setDetailItem((items.find((it) => it.id === id) as any) ?? null);
      }
    } catch {
      setDetailItem((items.find((it) => it.id === id) as any) ?? null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleComplete = async (id: string) => {
    const res = await dentalApi.completeTreatment(id);
    if (res.success) {
      message.success(t('dentalTreatment.completed'));
      void load();
    } else {
      message.error(res.error?.message ?? t('dentalTreatment.opFailed'));
    }
  };

  const columns = [
    { title: t('dentalTreatment.colPatient'), dataIndex: 'patientName', key: 'patientName', width: 110 },
    { title: t('dentalTreatment.colToothNo'), dataIndex: 'toothNo', key: 'toothNo', width: 80, render: (n?: number) => n ? <Tag color="blue">#{n}</Tag> : '-' },
    { title: t('dentalTreatment.colType'), dataIndex: 'type', key: 'type', width: 110, render: (v?: string) => v ? <Tag color="purple">{v}</Tag> : '-' },
    { title: t('dentalTreatment.colDiagnosis'), dataIndex: 'diagnosis', key: 'diagnosis' },
    { title: t('dentalTreatment.colPlan'), dataIndex: 'plan', key: 'plan' },
    { title: t('dentalTreatment.colCost'), key: 'cost', width: 90, render: (_: unknown, r: any) =>
      <span>¥{r.cost ?? r.estimatedCost ?? 0}</span> },
    { title: t('dentalTreatment.colStatus'), dataIndex: 'status', key: 'status', width: 110, render: (v?: string) =>
      <Tag color={STATUS_COLOR[v ?? ''] ?? 'default'}>{v ?? '-'}</Tag> },
    { title: t('dentalTreatment.colAction'), key: 'action', width: 160, render: (_: unknown, r: any) => {
      const s = String(r.status ?? '').toLowerCase();
      return (
        <Space size={4}>
          {s === 'planned' && <Button size="small" onClick={() => void handleStart(r.id)}>{t('dentalTreatment.start')}</Button>}
          {s === 'in_progress' && (
            <Popconfirm title={t('dentalTreatment.confirmComplete')} onConfirm={() => void handleComplete(r.id)}>
              <Button size="small" type="primary" icon={<CheckCircle2 size={12} />}>{t('dentalTreatment.complete')}</Button>
            </Popconfirm>
          )}
          <Button size="small" onClick={() => void handleShowDetail(r.id)}>{t('dentalTreatment.detail')}</Button>
        </Space>
      );
    }},
  ];

  return (
    <DentalPageLayout
      header={{
        title: t('dentalTreatment.title'),
        version: 'v3.0.6.11-54',
        icon: <Stethoscope size={20} color="var(--color-primary-600)" />,
        extra: (
          <Space>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>{t('dentalTreatment.refresh')}</Button>
            <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setCreateOpen(true)}>{t('dentalTreatment.newTreatment')}</Button>
          </Space>
        ),
      }}
      alert={error ? { message: error, type: 'error' } : undefined}
    >
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('dentalTreatment.statTotal')} value={stats.total} icon={<Activity size={14} />} />
        <StatCard title={t('dentalTreatment.statActive')} value={stats.active} color="warning" />
        <StatCard title={t('dentalTreatment.statCompleted')} value={stats.completed} icon={<CheckCircle2 size={14} />} color="success" />
        <StatCard title={t('dentalTreatment.statCost')} prefix="¥" value={stats.totalCost} color="primary" />
      </StatCardGrid>

      <Card size="small">
        <Spin spinning={loading}>
          {items.length === 0 && !loading ? (
            <Empty description={t('dentalTreatment.noTreatments')} image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" icon={<Plus size={12} />} onClick={() => setCreateOpen(true)}>{t('dentalTreatment.newTreatmentPlan')}</Button>
            </Empty>
          ) : (
            <DataTable rowKey="id" dataSource={listPagination.pageData} columns={columns} pagination={listPagination.pagination} scroll={{ x: 'max-content' }}/>
          )}
        </Spin>
      </Card>

      <Modal
        title={t('dentalTreatment.newTreatmentPlan')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreate()}
        confirmLoading={submitting}
        width={520}
      >
        <Form form={form} layout="vertical" size="small">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label={t('dentalTreatment.patientName')} name="patientName" rules={[{ required: true, message: t('dentalTreatment.enterPatientName') }]}>
                <Input placeholder={t('dentalTreatment.patientName')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('dentalTreatment.patientId')} name="patientId">
                <Input placeholder={t('dentalTreatment.optional')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('dentalTreatment.toothPosition')} name="toothNo">
                <InputNumber style={{ width: '100%' }} placeholder={t('dentalTreatment.toothPlaceholder')} min={1} max={48} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('dentalTreatment.treatmentType')} name="type" initialValue="Restorative">
                <Select options={typeOptions} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={t('dentalTreatment.diagnosis')} name="diagnosis" rules={[{ required: true, message: t('dentalTreatment.enterDiagnosis') }]}>
                <Input placeholder={t('dentalTreatment.diagnosisPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={t('dentalTreatment.treatmentPlan')} name="plan">
                <Input.TextArea rows={2} placeholder={t('dentalTreatment.planPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('dentalTreatment.estimatedCost')} name="cost">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={`${t('dentalTreatment.detailTitle')} - ${detailItem?.patientName ?? ''}`}
        open={!!detailItem}
        onCancel={() => setDetailItem(null)}
        footer={<Button onClick={() => setDetailItem(null)}>{t('dentalTreatment.close')}</Button>}
        width={520}
      >
        {detailItem && (
          <Spin spinning={detailLoading}>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label={t('dentalTreatment.patient')} span={2}>{detailItem.patientName} ({detailItem.patientId || '-'})</Descriptions.Item>
            <Descriptions.Item label={t('dentalTreatment.toothPosition')}>{detailItem.toothNo ? `#${detailItem.toothNo}` : '-'}</Descriptions.Item>
            <Descriptions.Item label={t('dentalTreatment.colType')}>{detailItem.type || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('dentalTreatment.colDiagnosis')} span={2}>{detailItem.diagnosis || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('dentalTreatment.treatmentPlan')} span={2}>{detailItem.plan || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('dentalTreatment.colCost')}>¥{detailItem.cost ?? detailItem.estimatedCost ?? 0}</Descriptions.Item>
            <Descriptions.Item label={t('dentalTreatment.colStatus')}><Tag color={STATUS_COLOR[detailItem.status ?? ''] ?? 'default'}>{detailItem.status ?? '-'}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('dentalTreatment.createdAt')} span={2}>{detailItem.createdAt ? new Date(detailItem.createdAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
            <Descriptions.Item label={t('dentalTreatment.completedAt')} span={2}>{detailItem.completedAt ? new Date(detailItem.completedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
          </Descriptions>
          </Spin>
        )}
      </Modal>
    </DentalPageLayout>
  );
};

export default DentalTreatmentPage;
