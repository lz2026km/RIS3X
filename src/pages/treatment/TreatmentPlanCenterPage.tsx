// [W3-2] 跨科室治疗计划中心: treatmentPlanApi 真实 CRUD + 状态流转 + 时间线
import { usePagination } from '../../hooks/usePagination';
import { treatmentPlanApi, type TreatmentPlan, type PlanStatus } from '../../services/api/treatmentPlanApi';
import {
  Card,
  Space,
  Tag,
  Button,
  Select,
  Input,
  message,
  Tabs,
  Modal,
  Form,
  Badge,
  Steps,
  Popconfirm,
  Alert,
  Empty,
  Spin,
  Descriptions,
} from "antd";
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";
import { Plus, ClipboardList, RefreshCw, PlayCircle, CheckCircle2, Trash2 } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { t } from '../../i18n/appI18n';
import { toneToAntd } from '../../theme/statusTokens';

const { TextArea } = Input;

const planStatusLabel = (s: string): string =>
  s === 'planned' ? t('treatmentPlan.status.planned')
    : s === 'in_progress' ? t('treatmentPlan.status.inProgress')
      : s === 'completed' ? t('treatmentPlan.status.completed')
        : s === 'pending' ? t('treatmentPlan.status.pending')
          : s;

const PLAN_STATUS_COLOR: Record<string, string> = {
  planned: toneToAntd('scheduled'),
  in_progress: toneToAntd('in_progress'),
  completed: toneToAntd('completed'),
  pending: toneToAntd('pending'),
};

const PLAN_TYPE_OPTIONS = ['种植', '根管治疗', '正畸-正颌', '颌面外科', '修复'].map((x) => ({ value: x, label: x }));
const DEPT_OPTIONS = ['口腔科', '放射科', '口腔外科', '正畸科', '眼科'].map((d) => ({ value: d, label: d }));
const PATIENT_OPTIONS = [
  { value: 'P100001', label: '张伟' },
  { value: 'P100002', label: '李娜' },
  { value: 'P100003', label: '王芳' },
  { value: 'P100004', label: '陈丽' },
];

const TIMELINE_STATUS_COLOR: Record<string, string> = {
  completed: toneToAntd('completed'),
  in_progress: toneToAntd('in_progress'),
  pending: toneToAntd('pending'),
};

export const TreatmentPlanCenterPage: React.FC = () => {
  const [tab, setTab] = useState('plans');
  const [createModal, setCreateModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const { pageData: planPageData, pagination: planPagination } = usePagination(plans, 10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<TreatmentPlan | null>(null);
  const [form] = Form.useForm();
  // [W1-B] 详情抽屉: getTimeline (GET /treatment-plans/:id/timeline) + 编辑 (PATCH /treatment-plans/:id)
  type TimelineItem = NonNullable<TreatmentPlan['timeline']>[number];
  const [detailTimeline, setDetailTimeline] = useState<TimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm] = Form.useForm();

  const openDetail = useCallback(async (plan: TreatmentPlan) => {
    setDetail(plan);
    setDetailModal(true);
    setDetailTimeline(plan.timeline ?? []);
    setTimelineLoading(true);
    try {
      const res = await treatmentPlanApi.getTimeline(plan.id);
      if (res.success && Array.isArray(res.data)) setDetailTimeline((res.data as TimelineItem[] | null) ?? []);
    } catch { /* 时间线不可用沿用列表内数据 */ }
    setTimelineLoading(false);
  }, []);

  const handleUpdate = async () => {
    if (!detail) return;
    try {
      const values = await editForm.validateFields();
      setEditSaving(true);
      const res = await treatmentPlanApi.update(detail.id, {
        type: values.type,
        department: (values.departments ?? []).join('→'),
        startDate: values.startDate,
        desc: values.desc,
        outcome: values.outcome ?? '',
      });
      if (res.success) {
        message.success(t('treatmentPlan.updated'));
        setEditModal(false);
        void load();
        const updated = res.data as TreatmentPlan;
        setDetail(updated);
        setDetailTimeline(updated.timeline ?? detailTimeline);
      } else {
        message.error(res.error?.message ?? t('treatmentPlan.updateFailed'));
      }
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
      else message.error(t('treatmentPlan.updateFailed'));
    } finally {
      setEditSaving(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await treatmentPlanApi.list();
      if (res.success && Array.isArray(res.data)) {
        setPlans(res.data as TreatmentPlan[]);
      } else {
        setError(res.error?.message ?? t('treatmentPlan.loadFailed'));
      }
    } catch (e) {
      console.error('[TreatmentPlan] load:', e);
      setError(t('treatmentPlan.loadFailedRetry'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await treatmentPlanApi.create({
        patientId: values.patientId,
        patient: PATIENT_OPTIONS.find(p => p.value === values.patientId)?.label ?? values.patientId,
        type: values.type,
        department: (values.departments ?? []).join('→'),
        startDate: values.startDate,
        desc: values.desc,
        outcome: values.outcome ?? '',
        status: 'planned',
      });
      if (res.success) {
        message.success(t('treatmentPlan.created'));
        setCreateModal(false);
        form.resetFields();
        void load();
      } else {
        message.error(res.error?.message ?? t('treatmentPlan.createFailed'));
      }
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
      else message.error(t('treatmentPlan.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (plan: TreatmentPlan, status: PlanStatus) => {
    setTransitioning(plan.id);
    try {
      const res = await treatmentPlanApi.transition(plan.id, status);
      if (res.success) {
        message.success(`${planStatusLabel(status)}`);
        void load();
        if (detail?.id === plan.id) setDetail(res.data as TreatmentPlan);
      } else {
        message.error(res.error?.message ?? t('treatmentPlan.transitionFailed'));
      }
    } catch {
      message.error(t('treatmentPlan.transitionFailed'));
    } finally {
      setTransitioning('');
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await treatmentPlanApi.remove(id);
      if (res.success) {
        message.success(t('treatmentPlan.deleted'));
        void load();
      } else {
        message.error(res.error?.message ?? t('treatmentPlan.deleteFailed'));
      }
    } catch {
      message.error(t('treatmentPlan.deleteFailed'));
    } finally {
      setDeletingId('');
    }
  };

  const stats = {
    total: plans.length,
    active: plans.filter(p => p.status === 'in_progress').length,
    completed: plans.filter(p => p.status === 'completed').length,
    planned: plans.filter(p => p.status === 'planned').length,
  };

  const columns = [
    { title: t('treatmentPlan.colNo'), dataIndex: 'id', key: 'id', width: 90, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { title: t('treatmentPlan.colPatient'), dataIndex: 'patient', key: 'patient', width: 80 },
    { title: t('treatmentPlan.colType'), dataIndex: 'type', key: 'type', width: 100, render: (tv: string) => <Tag color={tv === '种植' ? 'blue' : tv === '根管治疗' ? 'green' : 'purple'}>{tv}</Tag> },
    { title: t('treatmentPlan.colDept'), dataIndex: 'department', key: 'department', width: 180, render: (d: string) => <Tag color="orange">{d}</Tag> },
    { title: t('treatmentPlan.colProgress'), dataIndex: 'progress', key: 'progress', width: 100, render: (p: number) => <><Badge status={p >= 1 ? 'success' : 'processing'} />{Math.round((p ?? 0) * 100)}%</> },
    { title: t('treatmentPlan.colStatus'), dataIndex: 'status', key: 'status', width: 90, render: (s: string) => <Tag color={PLAN_STATUS_COLOR[s] ?? 'default'}>{planStatusLabel(s)}</Tag> },
    { title: t('treatmentPlan.colDesc'), dataIndex: 'desc', key: 'desc', ellipsis: true },
    { title: t('treatmentPlan.colStart'), dataIndex: 'startDate', key: 'startDate', width: 100 },
    {
      title: t('treatmentPlan.colActions'), key: 'actions', width: 220,
      render: (_: unknown, r: TreatmentPlan) => (
        <Space size={4}>
          <Button size="small" onClick={() => { void openDetail(r); }}>{t('treatmentPlan.detailBtn')}</Button>
          {r.status === 'planned' && <Button size="small" type="primary" icon={<PlayCircle size={11} />} loading={transitioning === r.id} onClick={() => void handleTransition(r, 'in_progress')}>{t('treatmentPlan.startBtn')}</Button>}
          {r.status === 'in_progress' && <Button size="small" type="primary" icon={<CheckCircle2 size={11} />} loading={transitioning === r.id} onClick={() => void handleTransition(r, 'completed')}>{t('treatmentPlan.completeBtn')}</Button>}
          {r.status === 'completed' && <Button size="small" loading={transitioning === r.id} onClick={() => void handleTransition(r, 'in_progress')}>{t('treatmentPlan.restartBtn')}</Button>}
          <Popconfirm title={t('treatmentPlan.confirmDelete')} onConfirm={() => void handleDelete(r.id)}>
            <Button aria-label="删除" size="small" danger icon={<Trash2 size={11} />} loading={deletingId === r.id} disabled={deletingId === r.id} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const nextStatus = detail?.status === 'planned' ? 'in_progress' : detail?.status === 'in_progress' ? 'completed' : null;

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <ClipboardList size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('treatmentPlan.pageTitle')}</span>
        <Tag color="cyan">v3.0.6.11-75 W3-2</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()}>{t('treatmentPlan.refresh')}</Button>
      </Space>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 'var(--space-4, 16px)' }} action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('treatmentPlan.retry')}</Button>} />}
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('treatmentPlan.statTotal')} value={stats.total} />
        <StatCard title={t('treatmentPlan.statPlanned')} value={stats.planned} color="warning" />
        <StatCard title={t('treatmentPlan.statActive')} value={stats.active} color="primary" />
        <StatCard title={t('treatmentPlan.statCompleted')} value={stats.completed} color="success" />
      </StatCardGrid>
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'plans', label: t('treatmentPlan.tabPlans'), children:
          <Card extra={<Space><Button type="primary" icon={<Plus size={12} />} onClick={() => setCreateModal(true)}>{t('treatmentPlan.newPlan')}</Button><Button icon={<RefreshCw size={12} />} onClick={() => void load()}>{t('treatmentPlan.refresh')}</Button></Space>} size="small" title={`${plans.length} ${t('treatmentPlan.itemsUnit')}`}>
            <Spin spinning={loading}>
              <DataTable
                dataSource={planPageData}
                rowKey="id"
                pagination={planPagination}
                columns={columns}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('treatmentPlan.emptyPlans')} /> }}
              scroll={{ x: 'max-content' }}
              />
            </Spin>
          </Card>
        },
        { key: 'timeline', label: t('treatmentPlan.tabTimeline'), children:
          <Card size="small" title={t('treatmentPlan.timelineSelectHint')} >
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('treatmentPlan.timelineEmptyHint')} />
          </Card>
        },
      ]} />

      <Modal
        title={t('treatmentPlan.newPlanTitle')}
        open={createModal}
        onCancel={() => setCreateModal(false)}
        onOk={() => void handleCreate()}
        confirmLoading={saving}
        width={520}
      >
        <Form form={form} layout="vertical" size="small" initialValues={{ type: '种植', departments: ['口腔科', '放射科'] }}>
          <Form.Item label={t('treatmentPlan.patientLabel')} name="patientId" rules={[{ required: true, message: t('treatmentPlan.selectPatient') }]}>
            <Select options={PATIENT_OPTIONS} placeholder={t('treatmentPlan.selectPatientPh')} />
          </Form.Item>
          <Form.Item label={t('treatmentPlan.typeLabel')} name="type" rules={[{ required: true, message: t('treatmentPlan.selectType') }]}>
            <Select options={PLAN_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item label={t('treatmentPlan.deptLabel')} name="departments" rules={[{ required: true, message: t('treatmentPlan.selectDept') }]}>
            <Select mode="multiple" options={DEPT_OPTIONS} />
          </Form.Item>
          <Form.Item label={t('treatmentPlan.startDateLabel')} name="startDate">
            <Input type="date" />
          </Form.Item>
          <Form.Item label={t('treatmentPlan.descLabel')} name="desc" rules={[{ required: true, message: t('treatmentPlan.descRequired') }]}>
            <TextArea rows={3} placeholder={t('treatmentPlan.descPh')} />
          </Form.Item>
          <Form.Item label={t('treatmentPlan.outcomeLabel')} name="outcome">
            <TextArea rows={2} placeholder={t('treatmentPlan.outcomePh')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`${t('treatmentPlan.detailTitle')} - ${detail?.id ?? ''}`} open={detailModal} onCancel={() => setDetailModal(false)} footer={
        detail ? (
          <>
            <Button onClick={() => { editForm.setFieldsValue({
              type: detail.type,
              departments: detail.department ? detail.department.split('→') : [],
              startDate: detail.startDate,
              desc: detail.desc,
              outcome: detail.outcome ?? '',
            }); setEditModal(true); }}>{t('treatmentPlan.editBtn')}</Button>
            {nextStatus ? (
              <Button type="primary" loading={transitioning === detail.id} onClick={() => void handleTransition(detail, nextStatus)}>
                {nextStatus === 'in_progress' ? t('treatmentPlan.startExecute') : t('treatmentPlan.markComplete')}
              </Button>
            ) : null}
          </>
        ) : null
      } width={640}>
        {detail && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 'var(--space-4, 16px)' }}>
              <Descriptions.Item label={t('treatmentPlan.patientLabel')}>{detail.patient}</Descriptions.Item>
              <Descriptions.Item label={t('treatmentPlan.colType')}><Tag color="blue">{detail.type}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('treatmentPlan.colDept')} span={2}><Tag color="orange">{detail.department}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('treatmentPlan.startDateLabel')}>{detail.startDate}</Descriptions.Item>
              <Descriptions.Item label={t('treatmentPlan.colStatus')}><Tag color={PLAN_STATUS_COLOR[detail.status] ?? 'default'}>{planStatusLabel(detail.status)}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('treatmentPlan.descLabel')} span={2}>{detail.desc}</Descriptions.Item>
              <Descriptions.Item label={t('treatmentPlan.outcomeLabel')} span={2}>{detail.outcome || '-'}</Descriptions.Item>
            </Descriptions>
            <Card size="small" title={<Space>{t('treatmentPlan.timelineTitle')} <Tag color="blue">GET /treatment-plans/:id/timeline</Tag></Space>} extra={timelineLoading ? <Spin size="small" /> : null}>
              {detailTimeline.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('treatmentPlan.timelineEmpty')} />
              ) : (
                <Steps
                  current={detailTimeline.filter(s => s.status === 'completed').length}
                  orientation="vertical"
                  items={detailTimeline.map(s => ({
                    title: <Space>{s.step}<Tag color={TIMELINE_STATUS_COLOR[s.status] ?? 'default'}>{planStatusLabel(s.status)}</Tag></Space>,
                    description: s.date,
                  }))}
                />
              )}
            </Card>
          </>
        )}
      </Modal>

      {/* [W1-B] 编辑计划: PATCH /treatment-plans/:id */}
      <Modal title={`${t('treatmentPlan.editTitle')} - ${detail?.id ?? ''}`} open={editModal} onCancel={() => setEditModal(false)} onOk={() => void handleUpdate()} confirmLoading={editSaving} width={520}>
        <Form form={editForm} layout="vertical" size="small">
          <Form.Item label={t('treatmentPlan.typeLabel')} name="type" rules={[{ required: true, message: t('treatmentPlan.selectType') }]}>
            <Select options={PLAN_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item label={t('treatmentPlan.deptLabel')} name="departments" rules={[{ required: true, message: t('treatmentPlan.selectDept') }]}>
            <Select mode="multiple" options={DEPT_OPTIONS} />
          </Form.Item>
          <Form.Item label={t('treatmentPlan.startDateLabel')} name="startDate">
            <Input type="date" />
          </Form.Item>
          <Form.Item label={t('treatmentPlan.descLabel')} name="desc" rules={[{ required: true, message: t('treatmentPlan.descRequired') }]}>
            <TextArea rows={3} placeholder={t('treatmentPlan.descPh')} />
          </Form.Item>
          <Form.Item label={t('treatmentPlan.outcomeLabel')} name="outcome">
            <TextArea rows={2} placeholder={t('treatmentPlan.outcomePh')} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};
export default TreatmentPlanCenterPage;
