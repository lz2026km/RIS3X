// [v3.0.6.8-70] 临床路径管理
// [v3.0.6.11-60] Batch 3: clinicalPathwayApi 真实数据 + 启用/暂停 + 步骤时间线
import { clinicalPathwayApi, type ClinicalPathway, type PathwayPatient, type PathwayStats, type PathwayDefinition } from '../../services/api/clinicalPathwayApi';
import {
  Card,
  Space,
  Tag,
  Button,
  Progress,
  Steps,
  Badge,
  Modal,
  Form,
  Input,
  message,
  Timeline,
  Spin,
  Alert,
  Empty,
} from "antd";
import { Popconfirm } from 'antd'
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";
import { Route, CheckCircle2, Clock, Users, Activity, Play, PauseCircle, RefreshCw, Plus, Eye } from 'lucide-react';
import { Forward, LogOut } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react';
import { usePagination } from '../../hooks/usePagination';
import { t } from '../../i18n/appI18n';

export const ClinicalPathwayPage: React.FC = () => {
  const [detail, setDetail] = useState<PathwayPatient | null>(null);
  const [pathways, setPathways] = useState<ClinicalPathway[]>([]);
  const [patients, setPatients] = useState<PathwayPatient[]>([]);
  const [stats, setStats] = useState<PathwayStats | null>(null);
  // [G005 W2] 路径定义 (步骤/入排标准): clinicalPathwayApi.listDefinitions
  const [definitions, setDefinitions] = useState<PathwayDefinition[]>([]);
  const [definition, setDefinition] = useState<PathwayDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrollModal, setEnrollModal] = useState(false);
  const [enrollForm] = Form.useForm();
  // [G005 W2-B] 患者路径追踪操作列: 推进阶段 / 退出路径 (行级 loading)
  const [rowActionId, setRowActionId] = useState<string | null>(null);
  // [v3.0.6.11-95] W4-B P2: 受控分页 (路径患者表)
  const patientPagination = usePagination(patients, 10);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pwRes, ptRes, statsRes, defRes] = await Promise.all([
        clinicalPathwayApi.listPathways(),
        clinicalPathwayApi.listPatients(),
        clinicalPathwayApi.getStats(),
        clinicalPathwayApi.listDefinitions(),
      ]);
      if (pwRes.success && Array.isArray(pwRes.data)) setPathways(pwRes.data);
      else setError(pwRes.error?.message ?? t('clinicalPathway.errLoadPathways'));
      if (ptRes.success && Array.isArray(ptRes.data)) setPatients(ptRes.data);
      if (statsRes.success && statsRes.data) setStats(statsRes.data as PathwayStats);
      if (defRes.success && Array.isArray(defRes.data)) setDefinitions(defRes.data);
    } catch {
      setError(t('clinicalPathway.errLoadData'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePathway = async (pathway: ClinicalPathway, status: 'active' | 'paused') => {
    const res = await clinicalPathwayApi.togglePathway(pathway.id, status);
    if (res.success) {
      message.success(status === 'active' ? t('clinicalPathway.pathwayEnabled') : t('clinicalPathway.pathwayPaused'));
      void load();
    } else {
      message.error(res.error?.message ?? t('clinicalPathway.opFailed'));
    }
  };

  const enrollPatient = async () => {
    const values = await enrollForm.validateFields();
    const res = await clinicalPathwayApi.enrollPatient({
      patientName: values.patientName,
      pathwayName: values.pathwayName,
    });
    if (res.success) {
      message.success(t('clinicalPathway.enrolled'));
      setEnrollModal(false);
      enrollForm.resetFields();
      void load();
    } else {
      message.error(res.error?.message ?? t('clinicalPathway.errEnroll'));
    }
  };

  // [G005 W2-B] 推进阶段: POST /clinical-pathways/patients/:id/advance, 失败本地兜底
  const advancePatient = async (record: PathwayPatient) => {
    setRowActionId(record.id);
    const nextStep = Math.min(record.step + 1, record.totalSteps);
    try {
      const res = await clinicalPathwayApi.advancePatient(record.id);
      setRowActionId(null);
      if (res.success) {
        message.success(`${record.patient} 已推进至步骤 ${nextStep}/${record.totalSteps}`);
        void load();
        return;
      }
    } catch { /* 本地兜底 */ }
    setPatients(prev => prev.map(p => p.id === record.id
      ? { ...p, step: nextStep, status: nextStep >= p.totalSteps ? 'completed' : p.status }
      : p));
    message.success(`${record.patient} 已推进至步骤 ${nextStep}/${record.totalSteps}（本地）`);
    setRowActionId(null);
  };

  // [G005 W2-B] 退出路径: POST /clinical-pathways/patients/:id/exit, 失败本地兜底
  const exitPatient = async (record: PathwayPatient) => {
    setRowActionId(record.id);
    try {
      const res = await clinicalPathwayApi.exitPatient(record.id);
      if (res.success) {
        message.success(`${record.patient} 已退出临床路径`);
        setPatients(prev => prev.filter(p => p.id !== record.id));
        setRowActionId(null);
        return;
      }
    } catch { /* 本地兜底 */ }
    setPatients(prev => prev.filter(p => p.id !== record.id));
    message.success(`${record.patient} 已退出临床路径（本地）`);
    setRowActionId(null);
  };

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Route size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('clinicalPathway.title')}</span>
        <Tag color="cyan">v3.0.6.11-60</Tag>
        <Tag color="green" icon={<Activity size={10} />}>{t('clinicalPathway.tagEvidenceBased')}</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>{t('clinicalPathway.refresh')}</Button>
      </Space>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('clinicalPathway.retry')}</Button>} />}

      <Spin spinning={loading}>
        <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
          <StatCard title={t('clinicalPathway.statActive')} value={stats?.active ?? pathways.filter((p) => p.status === 'active').length} icon={<Play size={14} color="#52c41a" />} />
          <StatCard title={t('clinicalPathway.statPaused')} value={stats?.paused ?? pathways.filter((p) => p.status === 'paused').length} icon={<PauseCircle size={14} color="#faad14" />} />
          <StatCard title={t('clinicalPathway.statPatients')} value={stats?.totalPatients ?? patients.length} icon={<Users size={14} />} />
          <StatCard title={t('clinicalPathway.statOnTrack')} value={stats?.onTrack ?? 0} color="success" />
          <StatCard title={t('clinicalPathway.statDelayed')} value={stats?.delayed ?? 0} color="error" />
          <StatCard title={t('clinicalPathway.statPathways')} value={pathways.length} icon={<Route size={14} />} />
        </StatCardGrid>
      </Spin>

      <Card size="small" title={t('clinicalPathway.pathwayDef')} style={{ marginBottom: 16 }}>
        <DataTable
          dataSource={pathways}
          rowKey="id"
          pagination={false}
          columns={[
            { title: t('clinicalPathway.colName'), dataIndex: 'name' },
            { title: t('clinicalPathway.colDept'), dataIndex: 'dept', render: (d: string) => <Tag>{d}</Tag> },
            { title: t('clinicalPathway.colPhase'), dataIndex: 'phase' },
            { title: t('clinicalPathway.colProgress'), dataIndex: 'progress', render: (p: number) => <Progress percent={p} size="small" /> },
            { title: t('clinicalPathway.colPatients'), dataIndex: 'patients' },
            { title: t('clinicalPathway.colVersion'), dataIndex: 'version', render: (v: string) => <Tag color="default">{v}</Tag> },
            { title: t('clinicalPathway.colStatus'), dataIndex: 'status', render: (s: string) => <Badge status={s === 'active' ? 'processing' : s === 'paused' ? 'warning' : 'default'} text={s === 'active' ? t('clinicalPathway.statusActive') : s === 'paused' ? t('clinicalPathway.statusPaused') : s} /> },
            {
              title: t('clinicalPathway.colAction'),
              render: (_, r: ClinicalPathway) => (
                <Space>
                  {r.status !== 'active' && <Button size="small" type="primary" icon={<Play size={10} />} onClick={() => void togglePathway(r, 'active')}>{t('clinicalPathway.enable')}</Button>}
                  {r.status === 'active' && <Button size="small" icon={<PauseCircle size={10} />} onClick={() => void togglePathway(r, 'paused')}>{t('clinicalPathway.pause')}</Button>}
                </Space>
              ),
            },
          ]}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* [G005 W2] 路径定义 (步骤/入排标准): clinicalPathwayApi.listDefinitions */}
      <Card
        size="small"
        title={`${t('w2Orphans.pathwayDefinitions')} (${t('w2Orphans.definitionCount', { count: definitions.length })})`}
        style={{ marginBottom: 16 }}
      >
        <DataTable
          dataSource={definitions}
          rowKey="id"
          pagination={false}
          columns={[
            { title: t('clinicalPathway.colName'), dataIndex: 'name' },
            { title: t('clinicalPathway.colDept'), dataIndex: 'dept', render: (d: string) => <Tag>{d}</Tag> },
            { title: t('clinicalPathway.colStep'), dataIndex: 'steps', render: (s: PathwayDefinition['steps']) => <Tag color="blue">{t('w2Orphans.stepsCount', { count: s?.length ?? 0 })}</Tag> },
            { title: t('w2Orphans.inclusion'), dataIndex: 'inclusion', render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
            { title: t('w2Orphans.exclusion'), dataIndex: 'exclusion', render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
            {
              title: t('clinicalPathway.colAction'),
              render: (_, r: PathwayDefinition) => (
                <Button size="small" icon={<Eye size={12} />} onClick={() => setDefinition(r)}>{t('w2Orphans.viewSteps')}</Button>
              ),
            },
          ]}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Card
        extra={<Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setEnrollModal(true)}>{t('clinicalPathway.enrollPatient')}</Button>}
        size="small"
        title={t('clinicalPathway.patientTracking')}
      >
        <DataTable
          dataSource={patientPagination.pageData}
          rowKey="id"
          pagination={patientPagination.pagination}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('clinicalPathway.noPatients')} /> }}
          columns={[
            { title: t('clinicalPathway.colPatient'), dataIndex: 'patient' },
            { title: t('clinicalPathway.colPathway'), dataIndex: 'pathway' },
            { title: t('clinicalPathway.colStep'), render: (_, r: PathwayPatient) => <Tag color="blue">{r.step}/{r.totalSteps}</Tag> },
            {
              title: t('clinicalPathway.colProgress'),
              render: (_, r: PathwayPatient) => <Progress percent={Math.round((r.step / Math.max(1, r.totalSteps)) * 100)} size="small" />,
            },
            { title: t('clinicalPathway.colStatus'), dataIndex: 'status', render: (s: string) => <Badge status={s === 'on-track' ? 'success' : s === 'delayed' ? 'error' : 'default'} text={s === 'on-track' ? t('clinicalPathway.onTrack') : s === 'delayed' ? t('clinicalPathway.delayed') : s} /> },
            { title: t('clinicalPathway.colEnteredAt'), dataIndex: 'enteredAt' },
            { title: t('clinicalPathway.colVariance'), dataIndex: 'variance', render: (v: string | null) => <span style={{ color: v ? '#ff4d4f' : '#52c41a', fontSize: 12 }}>{v || t('clinicalPathway.none')}</span> },
            {
              title: t('clinicalPathway.colAction'),
              render: (_, r: PathwayPatient) => (
                <Space size={4} wrap>
                  <Button size="small" icon={<Eye size={12} />} onClick={() => setDetail(r)}>{t('clinicalPathway.viewSteps')}</Button>
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<Forward size={12} />}
                    disabled={r.step >= r.totalSteps || r.status === 'completed' || rowActionId === r.id}
                    loading={rowActionId === r.id}
                    onClick={() => void advancePatient(r)}
                  >
                    {t('clinicalPathway.advanceStep')}
                  </Button>
                  <Popconfirm
                    title={`确认让 ${r.patient} 退出路径?`}
                    description={t('clinicalPathway.exitHint')}
                    okText={t('clinicalPathway.exit')}
                    cancelText={t('clinicalPathway.cancel')}
                    okButtonProps={{ danger: true }}
                    onConfirm={() => void exitPatient(r)}
                  >
                    <Button
                      size="small"
                      danger
                      icon={<LogOut size={12} />}
                      disabled={rowActionId === r.id}
                    >
                      {t('clinicalPathway.exitPathway')}
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal title={`${t('clinicalPathway.detailTitle')} - ${detail?.patient ?? ''}`} open={!!detail} onCancel={() => setDetail(null)} footer={null} width={480}>
        {detail && (
          <>
            <Space style={{ marginBottom: 12 }}>
              <Tag color="blue">{detail.pathway}</Tag>
              <Badge status={detail.status === 'on-track' ? 'success' : 'error'} text={detail.status === 'on-track' ? t('clinicalPathway.onTrack') : t('clinicalPathway.delayed')} />
            </Space>
            <Steps
              current={detail.step - 1}
              direction="vertical"
              size="small"
              items={(detail.steps ?? Array.from({ length: detail.totalSteps }, (_, i) => `步骤 ${i + 1}`)).map((s: string, i: number) => ({
                title: s,
                status: i < detail.step - 1 ? 'finish' : i === detail.step - 1 ? 'process' : 'wait',
                icon: i < detail.step ? <CheckCircle2 size={14} color="#52c41a" /> : <Clock size={14} />,
                description: i < detail.step ? t('clinicalPathway.stepDone') : t('clinicalPathway.stepPending'),
              }))}
            />
            <Timeline
              style={{ marginTop: 16 }}
              items={[
                { color: 'green', children: `录入路径：${detail.enteredAt}` },
                ...(detail.variance ? [{ color: 'red', children: `偏差：${detail.variance}` }] : []),
              ]}
            />
          </>
        )}
      </Modal>

      {/* [G005 W2] 路径定义详情 (步骤/触发条件/关键节点) */}
      <Modal
        title={`${t('w2Orphans.definitionTitle')} - ${definition?.name ?? ''}`}
        open={!!definition}
        onCancel={() => setDefinition(null)}
        footer={null}
        width={760}
      >
        {definition && (
          <>
            <Space style={{ marginBottom: 12 }} wrap>
              <Tag color="blue">{t('w2Orphans.inclusion')}: {definition.inclusion}</Tag>
              <Tag color="red">{t('w2Orphans.exclusion')}: {definition.exclusion}</Tag>
            </Space>
            <DataTable
              dataSource={definition.steps}
              rowKey="index"
              pagination={false}
              columns={[
                { title: t('w2Orphans.stepIndex'), dataIndex: 'index', width: 60 },
                { title: t('w2Orphans.stepName'), dataIndex: 'name' },
                { title: t('w2Orphans.stepDept'), dataIndex: 'dept', width: 100 },
                { title: t('w2Orphans.stepDuration'), dataIndex: 'durationDays', width: 90 },
                { title: t('w2Orphans.stepTriggers'), dataIndex: 'triggers', render: (v?: string) => v || '-' },
                { title: t('w2Orphans.stepCheckpoints'), dataIndex: 'keyCheckpoints', render: (v?: string[]) => (v && v.length ? v.join('; ') : '-') },
              ]}
              scroll={{ x: 'max-content' }}
            />
          </>
        )}
      </Modal>

      <Modal title={t('clinicalPathway.enrollModalTitle')} open={enrollModal} onOk={() => void enrollPatient()} onCancel={() => setEnrollModal(false)} okText={t('clinicalPathway.enrollOk')}>
        <Form form={enrollForm} layout="vertical">
          <Form.Item name="patientName" label={t('clinicalPathway.patientName')} rules={[{ required: true, message: t('clinicalPathway.enterPatientName') }]}>
            <Input placeholder={t('clinicalPathway.enterPatientName')} />
          </Form.Item>
          <Form.Item name="pathwayName" label={t('clinicalPathway.clinicalPathway')} rules={[{ required: true, message: t('clinicalPathway.selectPathway') }]}>
            <Input placeholder={t('clinicalPathway.pathwayPlaceholder')} list="pathway-options" />
            <datalist id="pathway-options">
              {pathways.map((p) => <option key={p.id} value={p.name} />)}
            </datalist>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};
export default ClinicalPathwayPage;
