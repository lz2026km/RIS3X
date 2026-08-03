// [v3.0.6.11-60] Batch 3: 正畸管理 (dentalApi 真实数据 + 新建病例 Modal + 治疗阶段)
import React, { useCallback, useEffect, useState } from 'react';
import { Table, Tag, Button, message, Space, Alert, Spin, Modal, Form, Input, InputNumber, Steps, Descriptions, Empty, Progress } from 'antd';
import { Plus, RefreshCw, Smile, Eye, PlayCircle, CheckCircle2 } from 'lucide-react';
import { DentalPageLayout } from './DentalShared';
import { dentalApi } from '../../services/api/dentalApi';

interface OrthoPlan {
  id: string;
  patientName?: string;
  diagnosis?: string;
  plan?: string;
  cost?: number;
  status?: string;
  toothNo?: number;
}

const STAGE_NAMES = ['初诊评估', '诊断记录', '矫治设计', '矫治器佩戴', '主动矫治', '精细调整', '保持期'];

export const DentalOrthoPage: React.FC = () => {
  const [plans, setPlans] = useState<OrthoPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<OrthoPlan | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/dental/ortho/plans');
      const d = await res.json();
      if (d.success && Array.isArray(d.data)) {
        setPlans(d.data);
        if (!d.data.length) message.info('暂无正畸病例，可点击"新建病例"创建');
      } else {
        setError('正畸病例加载失败');
      }
    } catch (err) {
      console.error('[F04]', err);
      setError('网络错误，正畸病例加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createPlan = async () => {
    const values = await form.validateFields();
    const res = await dentalApi.createTreatment({
      type: 'Orthodontic',
      patientName: values.patientName,
      diagnosis: values.diagnosis,
      plan: values.plan ?? '正畸治疗计划',
      cost: values.cost ?? 0,
      status: 'Planned',
    });
    if (res.success) {
      message.success('正畸病例已创建');
      setModalOpen(false);
      form.resetFields();
      void load();
    } else {
      message.error(res.error?.message ?? '创建失败');
    }
  };

  const updateStage = async (plan: OrthoPlan, stage: string) => {
    const res = await dentalApi.updateTreatment(plan.id, { status: stage });
    if (res.success) { message.success(`已更新为「${stage}」`); void load(); }
    else message.error(res.error?.message ?? '更新失败');
  };

  const stageIndex = (status?: string) => {
    const idx = STAGE_NAMES.indexOf(status ?? '');
    return idx >= 0 ? idx : 0;
  };

  const statusColor = (s?: string) => {
    if (!s) return 'default';
    const map: Record<string, string> = { Planned: 'blue', Active: 'processing', InProgress: 'processing', Completed: 'green', 已完成: 'green', 主动矫治: 'processing', 保持期: 'purple' };
    return map[s] ?? 'default';
  };

  return (
    <DentalPageLayout
      header={{
        title: '正畸管理',
        icon: <Smile size={20} color="#eb2f96" />,
        tags: [<Tag color="cyan" key="v">v3.0.6.11-60</Tag>],
        extra: (
          <Space>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>刷新</Button>
            <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setModalOpen(true)}>新建病例</Button>
          </Space>
        ),
      }}
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} action={<Button size="small" onClick={() => void load()}>重试</Button>} />}

      <Spin spinning={loading}>
        {plans.length === 0 && !error ? (
          <div style={{ background: '#fff', borderRadius: 8, padding: 40 }}>
            <Empty description="暂无正畸病例">
              <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>新建病例</Button>
            </Empty>
          </div>
        ) : (
          <Table
            dataSource={plans}
            rowKey="id"
            columns={[
              { title: '患者', dataIndex: 'patientName' },
              { title: '牙位', dataIndex: 'toothNo', render: (n?: number) => n ? <Tag color="blue">#{n}</Tag> : '-' },
              { title: '诊断', dataIndex: 'diagnosis' },
              { title: '计划', dataIndex: 'plan' },
              { title: '费用', render: (_, t: OrthoPlan) => '¥' + (t.cost ?? 0) },
              { title: '状态', dataIndex: 'status', render: (s: string) => <Tag color={statusColor(s)}>{s || 'Planned'}</Tag> },
              {
                title: '治疗阶段',
                dataIndex: 'status',
                render: (s: string) => (
                  <Progress
                    percent={Math.min(100, Math.round(((stageIndex(s) + 1) / STAGE_NAMES.length) * 100))}
                    size="small"
                    format={() => STAGE_NAMES[stageIndex(s)]}
                  />
                ),
              },
              {
                title: '操作',
                render: (_, t: OrthoPlan) => (
                  <Space size={4}>
                    <Button size="small" icon={<Eye size={12} />} onClick={() => setDetail(t)}>阶段</Button>
                    <Button size="small" icon={<PlayCircle size={12} />} onClick={() => void updateStage(t, 'Active')}>启动</Button>
                    <Button size="small" icon={<CheckCircle2 size={12} />} onClick={() => void updateStage(t, 'Completed')}>完成</Button>
                  </Space>
                ),
              },
            ]}
            pagination={false}
            size="small"
          />
        )}
      </Spin>

      <Modal
        title="新建正畸病例"
        open={modalOpen}
        onOk={() => void createPlan()}
        onCancel={() => setModalOpen(false)}
        okText="创建"
      >
        <Form form={form} layout="vertical" initialValues={{ cost: 0 }}>
          <Form.Item name="patientName" label="患者姓名" rules={[{ required: true, message: '请输入患者姓名' }]}>
            <Input placeholder="请输入患者姓名" />
          </Form.Item>
          <Form.Item name="diagnosis" label="诊断" rules={[{ required: true, message: '请输入诊断' }]}>
            <Input placeholder="如：安氏 II 类 1 分类错颌" />
          </Form.Item>
          <Form.Item name="plan" label="治疗计划">
            <Input placeholder="如：固定矫治 + 拔牙设计" />
          </Form.Item>
          <Form.Item name="toothNo" label="涉及牙位">
            <InputNumber style={{ width: '100%' }} placeholder="如 16" />
          </Form.Item>
          <Form.Item name="cost" label="预估费用 (元)">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`治疗阶段 - ${detail?.patientName ?? ''}`}
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={520}
      >
        {detail && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="诊断">{detail.diagnosis}</Descriptions.Item>
              <Descriptions.Item label="计划">{detail.plan}</Descriptions.Item>
              <Descriptions.Item label="费用">¥{detail.cost ?? 0}</Descriptions.Item>
              <Descriptions.Item label="当前状态"><Tag color={statusColor(detail.status)}>{detail.status || 'Planned'}</Tag></Descriptions.Item>
            </Descriptions>
            <Steps
              current={stageIndex(detail.status)}
              direction="vertical"
              size="small"
              items={STAGE_NAMES.map((name, i) => ({
                title: name,
                status: i < stageIndex(detail.status) ? 'finish' : i === stageIndex(detail.status) ? 'process' : 'wait',
                description: i === stageIndex(detail.status) ? '当前阶段' : undefined,
              }))}
            />
            <Space style={{ marginTop: 16 }}>
              <Button onClick={() => void updateStage(detail, STAGE_NAMES[Math.min(stageIndex(detail.status) + 1, STAGE_NAMES.length - 1)]!)}>进入下一阶段</Button>
              <Button onClick={() => void updateStage(detail, '保持期')}>进入保持期</Button>
            </Space>
          </>
        )}
      </Modal>
    </DentalPageLayout>
  );
};

export default DentalOrthoPage;
