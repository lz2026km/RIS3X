// [W3-2] 跨科室治疗计划中心: treatmentPlanApi 真实 CRUD + 状态流转 + 时间线
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Space, Tag, Button, Table, Select, Input, Row, Col, Statistic, message, Tabs, Modal, Form, Badge, Steps, Popconfirm, Alert, Empty, Spin, Descriptions } from 'antd';
import { Plus, ClipboardList, RefreshCw, PlayCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { treatmentPlanApi, type TreatmentPlan, type PlanStatus } from '../../services/api/treatmentPlanApi';
import { usePagination } from '../../hooks/usePagination';

const { TextArea } = Input;

const PLAN_STATUS_LABEL: Record<string, string> = {
  planned: '已计划',
  in_progress: '进行中',
  completed: '已完成',
  pending: '待处理',
};

const PLAN_STATUS_COLOR: Record<string, string> = {
  planned: 'default',
  in_progress: 'blue',
  completed: 'green',
  pending: 'orange',
};

const PLAN_TYPE_OPTIONS = ['种植', '根管治疗', '正畸-正颌', '颌面外科', '修复'].map(t => ({ value: t, label: t }));
const DEPT_OPTIONS = ['口腔科', '放射科', '口腔外科', '正畸科', '眼科'].map(d => ({ value: d, label: d }));
const PATIENT_OPTIONS = [
  { value: 'P100001', label: '张伟' },
  { value: 'P100002', label: '李娜' },
  { value: 'P100003', label: '王芳' },
  { value: 'P100004', label: '陈丽' },
];

const TIMELINE_STATUS: Record<string, { color: string; label: string }> = {
  completed: { color: 'green', label: '已完成' },
  in_progress: { color: 'blue', label: '进行中' },
  pending: { color: 'default', label: '待处理' },
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
        message.success('治疗计划已更新');
        setEditModal(false);
        void load();
        const updated = res.data as TreatmentPlan;
        setDetail(updated);
        setDetailTimeline(updated.timeline ?? detailTimeline);
      } else {
        message.error(res.error?.message ?? '更新失败');
      }
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
      else message.error('更新失败');
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
        setError(res.error?.message ?? '治疗计划加载失败');
      }
    } catch (e) {
      console.error('[TreatmentPlan] load:', e);
      setError('治疗计划加载失败, 请稍后重试');
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
        message.success('治疗计划已创建');
        setCreateModal(false);
        form.resetFields();
        void load();
      } else {
        message.error(res.error?.message ?? '创建失败');
      }
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
      else message.error('创建失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (plan: TreatmentPlan, status: PlanStatus) => {
    setTransitioning(plan.id);
    try {
      const res = await treatmentPlanApi.transition(plan.id, status);
      if (res.success) {
        message.success(`已流转为「${PLAN_STATUS_LABEL[status]}」`);
        void load();
        if (detail?.id === plan.id) setDetail(res.data as TreatmentPlan);
      } else {
        message.error(res.error?.message ?? '状态流转失败');
      }
    } catch {
      message.error('状态流转失败');
    } finally {
      setTransitioning('');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await treatmentPlanApi.remove(id);
      if (res.success) {
        message.success('计划已删除');
        void load();
      } else {
        message.error(res.error?.message ?? '删除失败');
      }
    } catch {
      message.error('删除失败');
    }
  };

  const stats = {
    total: plans.length,
    active: plans.filter(p => p.status === 'in_progress').length,
    completed: plans.filter(p => p.status === 'completed').length,
    planned: plans.filter(p => p.status === 'planned').length,
  };

  const columns = [
    { title: '编号', dataIndex: 'id', key: 'id', width: 90, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { title: '患者', dataIndex: 'patient', key: 'patient', width: 80 },
    { title: '类型', dataIndex: 'type', key: 'type', width: 100, render: (t: string) => <Tag color={t === '种植' ? 'blue' : t === '根管治疗' ? 'green' : 'purple'}>{t}</Tag> },
    { title: '涉及科室', dataIndex: 'department', key: 'department', width: 180, render: (d: string) => <Tag color="orange">{d}</Tag> },
    { title: '进展', dataIndex: 'progress', key: 'progress', width: 100, render: (p: number) => <><Badge status={p >= 1 ? 'success' : 'processing'} />{Math.round((p ?? 0) * 100)}%</> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (s: string) => <Tag color={PLAN_STATUS_COLOR[s] ?? 'default'}>{PLAN_STATUS_LABEL[s] ?? s}</Tag> },
    { title: '描述', dataIndex: 'desc', key: 'desc', ellipsis: true },
    { title: '开始', dataIndex: 'startDate', key: 'startDate', width: 100 },
    {
      title: '操作', key: 'actions', width: 220,
      render: (_: unknown, r: TreatmentPlan) => (
        <Space size={4}>
          <Button size="small" onClick={() => { void openDetail(r); }}>详情</Button>
          {r.status === 'planned' && <Button size="small" type="primary" icon={<PlayCircle size={11} />} loading={transitioning === r.id} onClick={() => void handleTransition(r, 'in_progress')}>开始</Button>}
          {r.status === 'in_progress' && <Button size="small" type="primary" icon={<CheckCircle2 size={11} />} loading={transitioning === r.id} onClick={() => void handleTransition(r, 'completed')}>完成</Button>}
          {r.status === 'completed' && <Button size="small" loading={transitioning === r.id} onClick={() => void handleTransition(r, 'in_progress')}>重启</Button>}
          <Popconfirm title="删除该计划?" onConfirm={() => void handleDelete(r.id)}>
            <Button size="small" danger icon={<Trash2 size={11} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const nextStatus = detail?.status === 'planned' ? 'in_progress' : detail?.status === 'in_progress' ? 'completed' : null;

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <ClipboardList size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>跨科室治疗计划中心</span>
        <Tag color="cyan">v3.0.6.11-75 W3-2</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()}>刷新</Button>
      </Space>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void load()}>重试</Button>} />}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总计划" value={stats.total} /></Card></Col>
        <Col span={6}><Card><Statistic title="已计划" value={stats.planned} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={6}><Card><Statistic title="执行中" value={stats.active} styles={{ content: { color: '#2563eb' } }} /></Card></Col>
        <Col span={6}><Card><Statistic title="已完成" value={stats.completed} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
      </Row>
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'plans', label: '治疗计划', children:
          <Card extra={<Space><Button type="primary" icon={<Plus size={12} />} onClick={() => setCreateModal(true)}>新建治疗计划</Button><Button icon={<RefreshCw size={12} />} onClick={() => void load()}>刷新</Button></Space>} size="small" title={`${plans.length} 项`}>
            <Spin spinning={loading}>
              <Table
                dataSource={planPageData}
                rowKey="id"
                pagination={planPagination}
                columns={columns}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无治疗计划, 点击新建创建" /> }}
              scroll={{ x: 'max-content' }}
              />
            </Spin>
          </Card>
        },
        { key: 'timeline', label: '项目时间线', children:
          <Card size="small" title="选择左侧列表中的计划查看时间线 (点击「详情」)" >
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请在「治疗计划」页签点击计划详情查看时间线" />
          </Card>
        },
      ]} />

      <Modal
        title="新建跨科室治疗计划"
        open={createModal}
        onCancel={() => setCreateModal(false)}
        onOk={() => void handleCreate()}
        confirmLoading={saving}
        width={520}
      >
        <Form form={form} layout="vertical" size="small" initialValues={{ type: '种植', departments: ['口腔科', '放射科'] }}>
          <Form.Item label="患者" name="patientId" rules={[{ required: true, message: '请选择患者' }]}>
            <Select options={PATIENT_OPTIONS} placeholder="选择患者" />
          </Form.Item>
          <Form.Item label="治疗类型" name="type" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={PLAN_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item label="涉及科室" name="departments" rules={[{ required: true, message: '请选择科室' }]}>
            <Select mode="multiple" options={DEPT_OPTIONS} />
          </Form.Item>
          <Form.Item label="开始日期" name="startDate">
            <Input type="date" />
          </Form.Item>
          <Form.Item label="描述" name="desc" rules={[{ required: true, message: '请输入计划概述' }]}>
            <TextArea rows={3} placeholder="治疗计划概述" />
          </Form.Item>
          <Form.Item label="预期结果" name="outcome">
            <TextArea rows={2} placeholder="预期治疗结果 (可选)" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`计划详情 - ${detail?.id ?? ''}`} open={detailModal} onCancel={() => setDetailModal(false)} footer={
        detail ? (
          <>
            <Button onClick={() => { editForm.setFieldsValue({
              type: detail.type,
              departments: detail.department ? detail.department.split('→') : [],
              startDate: detail.startDate,
              desc: detail.desc,
              outcome: detail.outcome ?? '',
            }); setEditModal(true); }}>编辑</Button>
            {nextStatus ? (
              <Button type="primary" loading={transitioning === detail.id} onClick={() => void handleTransition(detail, nextStatus)}>
                {nextStatus === 'in_progress' ? '开始执行' : '标记完成'}
              </Button>
            ) : null}
          </>
        ) : null
      } width={640}>
        {detail && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="患者">{detail.patient}</Descriptions.Item>
              <Descriptions.Item label="类型"><Tag color="blue">{detail.type}</Tag></Descriptions.Item>
              <Descriptions.Item label="涉及科室" span={2}><Tag color="orange">{detail.department}</Tag></Descriptions.Item>
              <Descriptions.Item label="开始日期">{detail.startDate}</Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={PLAN_STATUS_COLOR[detail.status] ?? 'default'}>{PLAN_STATUS_LABEL[detail.status] ?? detail.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{detail.desc}</Descriptions.Item>
              <Descriptions.Item label="结果" span={2}>{detail.outcome || '-'}</Descriptions.Item>
            </Descriptions>
            <Card size="small" title={<Space>治疗时间线 <Tag color="blue">GET /treatment-plans/:id/timeline</Tag></Space>} extra={timelineLoading ? <Spin size="small" /> : null}>
              {detailTimeline.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无时间线数据" />
              ) : (
                <Steps
                  current={detailTimeline.filter(s => s.status === 'completed').length}
                  orientation="vertical"
                  items={detailTimeline.map(s => ({
                    title: <Space>{s.step}<Tag color={TIMELINE_STATUS[s.status]?.color ?? 'default'}>{TIMELINE_STATUS[s.status]?.label ?? s.status}</Tag></Space>,
                    description: s.date,
                  }))}
                />
              )}
            </Card>
          </>
        )}
      </Modal>

      {/* [W1-B] 编辑计划: PATCH /treatment-plans/:id */}
      <Modal title={`编辑治疗计划 - ${detail?.id ?? ''}`} open={editModal} onCancel={() => setEditModal(false)} onOk={() => void handleUpdate()} confirmLoading={editSaving} width={520}>
        <Form form={editForm} layout="vertical" size="small">
          <Form.Item label="治疗类型" name="type" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={PLAN_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item label="涉及科室" name="departments" rules={[{ required: true, message: '请选择科室' }]}>
            <Select mode="multiple" options={DEPT_OPTIONS} />
          </Form.Item>
          <Form.Item label="开始日期" name="startDate">
            <Input type="date" />
          </Form.Item>
          <Form.Item label="描述" name="desc" rules={[{ required: true, message: '请输入计划概述' }]}>
            <TextArea rows={3} placeholder="治疗计划概述" />
          </Form.Item>
          <Form.Item label="预期结果" name="outcome">
            <TextArea rows={2} placeholder="预期治疗结果 (可选)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default TreatmentPlanCenterPage;
