// [v3.0.6.11-54] Phase 2: 口腔治疗中心 (治疗计划列表 + 新建治疗)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Row, Col, Card, Statistic, Button, Space, Modal, Form, Input, Select,
  InputNumber, message, Spin, Tag, Table, Empty, Popconfirm, Descriptions,
} from 'antd';
import { Plus, RefreshCw, Stethoscope, Activity, CheckCircle2 } from 'lucide-react';
import { DentalPageLayout } from './DentalShared';
import { dentalApi } from '../../services/api/dentalApi';
import { usePagination } from '../../hooks/usePagination';

const STATUS_COLOR: Record<string, string> = {
  completed: 'green', Completed: 'green', InProgress: 'orange', in_progress: 'orange',
  planned: 'blue', Planned: 'blue', cancelled: 'red', Cancelled: 'red',
};

export const DentalTreatmentPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [detailItem, setDetailItem] = useState<any>(null);
  // [G005 Wave1A P1] 治疗类型字典: dentalApi.listTreatmentTypes (GET /dental/treatments/types, 后端真实)
  const [treatmentTypes, setTreatmentTypes] = useState<any[]>([]);

  useEffect(() => {
    void dentalApi.listTreatmentTypes().then((res: any) => {
      if (res.success && Array.isArray(res.data)) setTreatmentTypes(res.data);
    }).catch(() => { /* 保留硬编码回退 */ });
  }, []);

  const typeOptions = (treatmentTypes.length > 0
    ? treatmentTypes.map((t: any) => (typeof t === 'string' ? { value: t, label: t } : { value: t.category ?? t.name, label: t.name }))
    : [['Restorative', '修复性'], ['Endodontic', '根管'], ['Orthodontic', '正畸'], ['Implant', '种植'], ['Extraction', '拔除'], ['Prosthodontic', '修复冠桥']].map(([value, label]) => ({ value, label }))
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dentalApi.listTreatments({ pageSize: 100 });
      if (res.success) {
        setItems(res.data ?? []);
      } else {
        setError(res.error?.message ?? '加载失败');
        setItems([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? '加载失败');
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
    const active = items.filter((t) => {
      const s = String(t.status ?? '').toLowerCase();
      return s !== 'completed' && s !== 'cancelled';
    }).length;
    const completed = items.filter((t) => String(t.status ?? '').toLowerCase() === 'completed').length;
    const totalCost = items.reduce((s, t) => s + (t.cost ?? t.estimatedCost ?? 0), 0);
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
        message.success('治疗计划已创建');
        setCreateOpen(false);
        form.resetFields();
        void load();
      } else {
        message.error(res.error?.message ?? '创建失败');
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
      message.success('已开始治疗');
      void load();
    } else {
      message.error(res.error?.message ?? '操作失败');
    }
  };

  const handleComplete = async (id: string) => {
    const res = await dentalApi.completeTreatment(id);
    if (res.success) {
      message.success('治疗已完成');
      void load();
    } else {
      message.error(res.error?.message ?? '操作失败');
    }
  };

  const columns = [
    { title: '患者', dataIndex: 'patientName', key: 'patientName', width: 110 },
    { title: '牙位', dataIndex: 'toothNo', key: 'toothNo', width: 80, render: (n?: number) => n ? <Tag color="blue">#{n}</Tag> : '-' },
    { title: '类型', dataIndex: 'type', key: 'type', width: 110, render: (v?: string) => v ? <Tag color="purple">{v}</Tag> : '-' },
    { title: '诊断', dataIndex: 'diagnosis', key: 'diagnosis' },
    { title: '计划', dataIndex: 'plan', key: 'plan' },
    { title: '费用', key: 'cost', width: 90, render: (_: unknown, r: any) =>
      <span>¥{r.cost ?? r.estimatedCost ?? 0}</span> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 110, render: (v?: string) =>
      <Tag color={STATUS_COLOR[v ?? ''] ?? 'default'}>{v ?? '-'}</Tag> },
    { title: '操作', key: 'action', width: 160, render: (_: unknown, r: any) => {
      const s = String(r.status ?? '').toLowerCase();
      return (
        <Space size={4}>
          {s === 'planned' && <Button size="small" onClick={() => void handleStart(r.id)}>开始</Button>}
          {s === 'in_progress' && (
            <Popconfirm title="确认完成该治疗?" onConfirm={() => void handleComplete(r.id)}>
              <Button size="small" type="primary" icon={<CheckCircle2 size={12} />}>完成</Button>
            </Popconfirm>
          )}
          <Button size="small" onClick={() => setDetailItem(r)}>详情</Button>
        </Space>
      );
    }},
  ];

  return (
    <DentalPageLayout
      header={{
        title: '口腔治疗中心',
        version: 'v3.0.6.11-54',
        icon: <Stethoscope size={20} color="#2563eb" />,
        extra: (
          <Space>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>刷新</Button>
            <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setCreateOpen(true)}>新建治疗</Button>
          </Space>
        ),
      }}
      alert={error ? { message: error, type: 'error' } : undefined}
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="治疗计划总数" value={stats.total} prefix={<Activity size={14} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="进行中" value={stats.active} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已完成" value={stats.completed} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="费用合计" prefix="¥" value={stats.totalCost} styles={{ content: { color: '#2563eb' } }} /></Card></Col>
      </Row>

      <Card size="small">
        <Spin spinning={loading}>
          {items.length === 0 && !loading ? (
            <Empty description="暂无治疗计划" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" icon={<Plus size={12} />} onClick={() => setCreateOpen(true)}>新建治疗计划</Button>
            </Empty>
          ) : (
            <Table rowKey="id" size="small" dataSource={listPagination.pageData} columns={columns} pagination={listPagination.pagination} scroll={{ x: 'max-content' }}/>
          )}
        </Spin>
      </Card>

      <Modal
        title="新建治疗计划"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreate()}
        confirmLoading={submitting}
        width={520}
      >
        <Form form={form} layout="vertical" size="small">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="患者姓名" name="patientName" rules={[{ required: true, message: '请输入患者姓名' }]}>
                <Input placeholder="患者姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="患者 ID" name="patientId">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="牙位" name="toothNo">
                <InputNumber style={{ width: '100%' }} placeholder="如 36" min={1} max={48} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="治疗类型" name="type" initialValue="Restorative">
                <Select options={typeOptions} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="诊断" name="diagnosis" rules={[{ required: true, message: '请输入诊断' }]}>
                <Input placeholder="如 深龋 / 根尖周炎" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="治疗方案" name="plan">
                <Input.TextArea rows={2} placeholder="治疗方案描述" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="预估费用 (¥)" name="cost">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={`治疗详情 - ${detailItem?.patientName ?? ''}`}
        open={!!detailItem}
        onCancel={() => setDetailItem(null)}
        footer={<Button onClick={() => setDetailItem(null)}>关闭</Button>}
        width={520}
      >
        {detailItem && (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="患者" span={2}>{detailItem.patientName} ({detailItem.patientId || '-'})</Descriptions.Item>
            <Descriptions.Item label="牙位">{detailItem.toothNo ? `#${detailItem.toothNo}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="类型">{detailItem.type || '-'}</Descriptions.Item>
            <Descriptions.Item label="诊断" span={2}>{detailItem.diagnosis || '-'}</Descriptions.Item>
            <Descriptions.Item label="治疗方案" span={2}>{detailItem.plan || '-'}</Descriptions.Item>
            <Descriptions.Item label="费用">¥{detailItem.cost ?? detailItem.estimatedCost ?? 0}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={STATUS_COLOR[detailItem.status ?? ''] ?? 'default'}>{detailItem.status ?? '-'}</Tag></Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>{detailItem.createdAt ? new Date(detailItem.createdAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
            <Descriptions.Item label="完成时间" span={2}>{detailItem.completedAt ? new Date(detailItem.completedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </DentalPageLayout>
  );
};

export default DentalTreatmentPage;
