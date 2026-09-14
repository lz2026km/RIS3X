// [v3.0.6.11-60] Batch 3: 正畸管理 (dentalApi 真实数据 + 新建病例 Modal + 治疗阶段)
// [G005 Wave1B] 裸 fetch → dentalApi.listOrthoPlans (后端 /dental/ortho/plans 真实实现)
import { dentalApi } from '../../services/api/dentalApi';
import { t } from '../../i18n/appI18n';
import { DentalPageLayout } from './DentalShared';
import { Table, Tag, Button, message, Space, Alert, Spin, Modal, Form, Input, InputNumber, Steps, Descriptions, Empty, Progress } from 'antd';
import { Plus, RefreshCw, Smile, Eye, PlayCircle, CheckCircle2, FolderOpen } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

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
const STATUS_LABELS: Record<string, string> = { Planned: '计划中', Active: '进行中', InProgress: '进行中', Completed: '已完成' };

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
      const res = await dentalApi.listOrthoPlans();
      if (res.success && Array.isArray(res.data)) {
        setPlans(res.data);
        if (!res.data.length) message.info(t('dentalOrtho.noCasesHint'));
      } else {
        setError(t('dentalOrtho.loadFailed'));
      }
    } catch (err) {
      console.error('[F04]', err);
      setError(t('dentalOrtho.networkError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createPlan = async () => {
    const values = await form.validateFields();
    // [G005 W3-B] 新建正畸病例: POST /dental/ortho/plans (createOrthoPlan), 失败回退 createTreatment
    const res = await dentalApi.createOrthoPlan({
      patientName: values.patientName,
      patientId: values.patientId,
      diagnosis: values.diagnosis,
      plan: values.plan ?? '正畸治疗计划',
      cost: values.cost ?? 0,
      toothNo: values.toothNo,
      status: 'Planned',
    }).catch(() => null);
    if (res && res.success) {
      message.success('正畸病例已创建');
      setModalOpen(false);
      form.resetFields();
      void load();
      return;
    }
    const fb = await dentalApi.createTreatment({
      type: 'Orthodontic',
      patientName: values.patientName,
      diagnosis: values.diagnosis,
      plan: values.plan ?? '正畸治疗计划',
      cost: values.cost ?? 0,
      status: 'Planned',
    });
    if (fb.success) {
      message.success(`${t('w3b.orthoCreate')} (fallback)`);
      setModalOpen(false);
      form.resetFields();
      void load();
    } else {
      message.error(fb.error?.message ?? t('dentalOrtho.createFailed'));
    }
  };

  // [G005 W3-B] 正畸详情: GET /dental/ortho/plans/:id (getOrthoPlan)
  const openDetail = async (plan: OrthoPlan) => {
    try {
      const res = await dentalApi.getOrthoPlan(plan.id);
      if (res.success && res.data) {
        setDetail({ ...plan, ...res.data });
      } else {
        setDetail(plan);
      }
    } catch {
      setDetail(plan);
    }
  };

  const updateStage = async (plan: OrthoPlan, stage: string) => {
    const res = await dentalApi.updateTreatment(plan.id, { status: stage });
    if (res.success) { message.success(`已更新为「${stage}」`); void load(); }
    else message.error(res.error?.message ?? t('dentalOrtho.updateFailed'));
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
        title: t('dentalOrtho.title'),
        icon: <Smile size={20} color="#eb2f96" />,
        tags: [<Tag color="cyan" key="v">v3.0.6.11-60</Tag>, <Tag color="green" key="real">{t('dentalOrtho.realBackend')}</Tag>],
        extra: (
          <Space>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>{t('dentalOrtho.refresh')}</Button>
            <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setModalOpen(true)}>{t('dentalOrtho.newCase')}</Button>
          </Space>
        ),
      }}
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('dentalOrtho.retry')}</Button>} />}

      <Spin spinning={loading}>
        {plans.length === 0 && !error ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 40 }}>
            <Empty image={<FolderOpen size={48} style={{opacity:0.4}}/>} description={t('dentalOrtho.empty')}>
              <Button type="primary" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>{t('dentalOrtho.newCase')}</Button>
            </Empty>
          </div>
        ) : (
          <Table
            dataSource={plans}
            rowKey="id"
            columns={[
              { title: t('dentalOrtho.patient'), dataIndex: 'patientName' },
              { title: t('dentalOrtho.toothNo'), dataIndex: 'toothNo', render: (n?: number) => n ? <Tag color="blue">#{n}</Tag> : '-' },
              { title: t('dentalOrtho.diagnosis'), dataIndex: 'diagnosis' },
              { title: t('dentalOrtho.plan'), dataIndex: 'plan' },
              { title: t('dentalOrtho.cost'), render: (_, row: OrthoPlan) => '¥' + (row.cost ?? 0) },
              { title: t('dentalOrtho.status'), dataIndex: 'status', render: (s: string) => <Tag color={statusColor(s)}>{STATUS_LABELS[s] ?? (s || t('dentalOrtho.statusPlanned'))}</Tag> },
              {
                title: t('dentalOrtho.stage'),
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
                title: t('dentalOrtho.actions'),
                render: (_, row: OrthoPlan) => (
                  <Space size={4}>
                    <Button size="small" icon={<Eye size={12} />} onClick={() => void openDetail(row)}>{t('dentalOrtho.stageBtn')}</Button>
                    <Button size="small" icon={<PlayCircle size={12} />} onClick={() => void updateStage(row, 'Active')}>{t('dentalOrtho.start')}</Button>
                    <Button size="small" icon={<CheckCircle2 size={12} />} onClick={() => void updateStage(row, 'Completed')}>{t('dentalOrtho.complete')}</Button>
                  </Space>
                ),
              },
            ]}
            pagination={false}
            size="small"
          scroll={{ x: 'max-content' }}
          />
        )}
      </Spin>

      <Modal
        title={t('dentalOrtho.newCaseTitle')}
        open={modalOpen}
        onOk={() => void createPlan()}
        onCancel={() => setModalOpen(false)}
        okText={t('dentalOrtho.create')}
      >
        <Form form={form} layout="vertical" initialValues={{ cost: 0 }}>
          <Form.Item name="patientName" label={t('dentalOrtho.patientName')} rules={[{ required: true, message: t('dentalOrtho.patientNameRequired') }]}>
            <Input placeholder={t('dentalOrtho.patientNameRequired')} />
          </Form.Item>
          <Form.Item name="patientId" label={t('dentalOrtho.patientId')}>
            <Input placeholder={t('dentalOrtho.optional')} />
          </Form.Item>
          <Form.Item name="diagnosis" label={t('dentalOrtho.diagnosis')} rules={[{ required: true, message: t('dentalOrtho.diagnosisRequired') }]}>
            <Input placeholder={t('dentalOrtho.diagnosisPlaceholder')} />
          </Form.Item>
          <Form.Item name="plan" label={t('dentalOrtho.treatmentPlan')}>
            <Input placeholder={t('dentalOrtho.planPlaceholder')} />
          </Form.Item>
          <Form.Item name="toothNo" label={t('dentalOrtho.toothNoLabel')}>
            <InputNumber style={{ width: '100%' }} placeholder={t('dentalOrtho.toothNoPlaceholder')} />
          </Form.Item>
          <Form.Item name="cost" label={t('dentalOrtho.costLabel')}>
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
              <Descriptions.Item label={t('dentalOrtho.diagnosis')}>{detail.diagnosis}</Descriptions.Item>
              <Descriptions.Item label={t('dentalOrtho.plan')}>{detail.plan}</Descriptions.Item>
              <Descriptions.Item label={t('dentalOrtho.cost')}>¥{detail.cost ?? 0}</Descriptions.Item>
              <Descriptions.Item label={t('dentalOrtho.currentStatus')}><Tag color={statusColor(detail.status)}>{STATUS_LABELS[detail.status ?? ''] ?? (detail.status || t('dentalOrtho.statusPlanned'))}</Tag></Descriptions.Item>
            </Descriptions>
            <Steps
              current={stageIndex(detail.status)}
              direction="vertical"
              size="small"
              items={STAGE_NAMES.map((name, i) => ({
                title: name,
                status: i < stageIndex(detail.status) ? 'finish' : i === stageIndex(detail.status) ? 'process' : 'wait',
                description: i === stageIndex(detail.status) ? t('dentalOrtho.currentStage') : undefined,
              }))}
            />
            <Space style={{ marginTop: 16 }}>
              <Button onClick={() => void updateStage(detail, STAGE_NAMES[Math.min(stageIndex(detail.status) + 1, STAGE_NAMES.length - 1)]!)}>{t('dentalOrtho.nextStage')}</Button>
              <Button onClick={() => void updateStage(detail, '保持期')}>{t('dentalOrtho.enterRetention')}</Button>
            </Space>
          </>
        )}
      </Modal>
    </DentalPageLayout>
  );
};

export default DentalOrthoPage;
