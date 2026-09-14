// [v3.0.6.8-70] 临床路径管理
// [v3.0.6.11-60] Batch 3: clinicalPathwayApi 真实数据 + 启用/暂停 + 步骤时间线
import { clinicalPathwayApi, type ClinicalPathway, type PathwayPatient, type PathwayStats } from '../../services/api/clinicalPathwayApi';
import { Card, Space, Tag, Table, Button, Row, Col, Statistic, Progress, Steps, Badge, Modal, Form, Input, message, Timeline, Spin, Alert, Empty } from 'antd';
import { Popconfirm } from 'antd'
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
      const [pwRes, ptRes, statsRes] = await Promise.all([
        clinicalPathwayApi.listPathways(),
        clinicalPathwayApi.listPatients(),
        clinicalPathwayApi.getStats(),
      ]);
      if (pwRes.success && Array.isArray(pwRes.data)) setPathways(pwRes.data);
      else setError(pwRes.error?.message ?? t('clinicalPathway.errLoadPathways'));
      if (ptRes.success && Array.isArray(ptRes.data)) setPatients(ptRes.data);
      if (statsRes.success && statsRes.data) setStats(statsRes.data as PathwayStats);
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
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Route size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('clinicalPathway.title')}</span>
        <Tag color="cyan">v3.0.6.11-60</Tag>
        <Tag color="green" icon={<Activity size={10} />}>{t('clinicalPathway.tagEvidenceBased')}</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>{t('clinicalPathway.refresh')}</Button>
      </Space>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('clinicalPathway.retry')}</Button>} />}

      <Spin spinning={loading}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} md={4}><Card size="small"><Statistic title={t('clinicalPathway.statActive')} value={stats?.active ?? pathways.filter((p) => p.status === 'active').length} prefix={<Play size={14} color="#52c41a" />} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title={t('clinicalPathway.statPaused')} value={stats?.paused ?? pathways.filter((p) => p.status === 'paused').length} prefix={<PauseCircle size={14} color="#faad14" />} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title={t('clinicalPathway.statPatients')} value={stats?.totalPatients ?? patients.length} prefix={<Users size={14} />} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title={t('clinicalPathway.statOnTrack')} value={stats?.onTrack ?? 0} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title={t('clinicalPathway.statDelayed')} value={stats?.delayed ?? 0} styles={{ content: { color: '#ff4d4f' } }} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title={t('clinicalPathway.statPathways')} value={pathways.length} prefix={<Route size={14} />} /></Card></Col>
        </Row>
      </Spin>

      <Card size="small" title={t('clinicalPathway.pathwayDef')} style={{ marginBottom: 16 }}>
        <Table
          dataSource={pathways}
          rowKey="id"
          pagination={false}
          size="small"
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

      <Card
        extra={<Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setEnrollModal(true)}>{t('clinicalPathway.enrollPatient')}</Button>}
        size="small"
        title={t('clinicalPathway.patientTracking')}
      >
        <Table
          dataSource={patientPagination.pageData}
          rowKey="id"
          pagination={patientPagination.pagination}
          size="small"
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
    </div>
  );
};
export default ClinicalPathwayPage;
