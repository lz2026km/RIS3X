// [v3.0.6.8-70] 临床路径管理
// [v3.0.6.11-60] Batch 3: clinicalPathwayApi 真实数据 + 启用/暂停 + 步骤时间线
import React, { useCallback, useEffect, useState } from 'react';
import { Card, Space, Tag, Table, Button, Row, Col, Statistic, Progress, Steps, Badge, Modal, Form, Input, message, Timeline, Spin, Alert, Empty } from 'antd';
import { Route, CheckCircle2, Clock, Users, Activity, Play, PauseCircle, RefreshCw, Plus, Eye } from 'lucide-react';
import { clinicalPathwayApi, type ClinicalPathway, type PathwayPatient, type PathwayStats } from '../../services/api/clinicalPathwayApi';

export const ClinicalPathwayPage: React.FC = () => {
  const [detail, setDetail] = useState<PathwayPatient | null>(null);
  const [pathways, setPathways] = useState<ClinicalPathway[]>([]);
  const [patients, setPatients] = useState<PathwayPatient[]>([]);
  const [stats, setStats] = useState<PathwayStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrollModal, setEnrollModal] = useState(false);
  const [enrollForm] = Form.useForm();

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
      else setError(pwRes.error?.message ?? '路径加载失败');
      if (ptRes.success && Array.isArray(ptRes.data)) setPatients(ptRes.data);
      if (statsRes.success && statsRes.data) setStats(statsRes.data as PathwayStats);
    } catch {
      setError('临床路径数据加载失败');
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
      message.success(status === 'active' ? '路径已启用' : '路径已暂停');
      void load();
    } else {
      message.error(res.error?.message ?? '操作失败');
    }
  };

  const enrollPatient = async () => {
    const values = await enrollForm.validateFields();
    const res = await clinicalPathwayApi.enrollPatient({
      patientName: values.patientName,
      pathwayName: values.pathwayName,
    });
    if (res.success) {
      message.success('患者已登记进入路径');
      setEnrollModal(false);
      enrollForm.resetFields();
      void load();
    } else {
      message.error(res.error?.message ?? '登记失败');
    }
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Route size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>临床路径管理</span>
        <Tag color="cyan">v3.0.6.11-60</Tag>
        <Tag color="green" icon={<Activity size={10} />}>基于临床路径的护理</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()} loading={loading}>刷新</Button>
      </Space>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void load()}>重试</Button>} />}

      <Spin spinning={loading}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} md={4}><Card size="small"><Statistic title="启用路径" value={stats?.active ?? pathways.filter((p) => p.status === 'active').length} prefix={<Play size={14} color="#52c41a" />} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="暂停路径" value={stats?.paused ?? pathways.filter((p) => p.status === 'paused').length} prefix={<PauseCircle size={14} color="#faad14" />} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="路径内患者" value={stats?.totalPatients ?? patients.length} prefix={<Users size={14} />} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="按计划" value={stats?.onTrack ?? 0} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="已延迟" value={stats?.delayed ?? 0} styles={{ content: { color: '#ff4d4f' } }} /></Card></Col>
          <Col xs={12} md={4}><Card size="small"><Statistic title="路径数" value={pathways.length} prefix={<Route size={14} />} /></Card></Col>
        </Row>
      </Spin>

      <Card size="small" title="路径定义" style={{ marginBottom: 16 }}>
        <Table
          dataSource={pathways}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '科室', dataIndex: 'dept', render: (d: string) => <Tag>{d}</Tag> },
            { title: '当前阶段', dataIndex: 'phase' },
            { title: '进度', dataIndex: 'progress', render: (p: number) => <Progress percent={p} size="small" /> },
            { title: '患者数', dataIndex: 'patients' },
            { title: '版本', dataIndex: 'version', render: (v: string) => <Tag color="default">{v}</Tag> },
            { title: '状态', dataIndex: 'status', render: (s: string) => <Badge status={s === 'active' ? 'processing' : s === 'paused' ? 'warning' : 'default'} text={s === 'active' ? '启用中' : s === 'paused' ? '已暂停' : s} /> },
            {
              title: '操作',
              render: (_, r: ClinicalPathway) => (
                <Space>
                  {r.status !== 'active' && <Button size="small" type="primary" icon={<Play size={10} />} onClick={() => void togglePathway(r, 'active')}>启用</Button>}
                  {r.status === 'active' && <Button size="small" icon={<PauseCircle size={10} />} onClick={() => void togglePathway(r, 'paused')}>暂停</Button>}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card
        extra={<Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => setEnrollModal(true)}>登记患者</Button>}
        size="small"
        title="患者路径追踪"
      >
        <Table
          dataSource={patients}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无路径内患者" /> }}
          columns={[
            { title: '患者', dataIndex: 'patient' },
            { title: '路径', dataIndex: 'pathway' },
            { title: '步骤', render: (_, r: PathwayPatient) => <Tag color="blue">{r.step}/{r.totalSteps}</Tag> },
            {
              title: '进度',
              render: (_, r: PathwayPatient) => <Progress percent={Math.round((r.step / Math.max(1, r.totalSteps)) * 100)} size="small" />,
            },
            { title: '状态', dataIndex: 'status', render: (s: string) => <Badge status={s === 'on-track' ? 'success' : s === 'delayed' ? 'error' : 'default'} text={s === 'on-track' ? '按计划' : s === 'delayed' ? '延迟' : s} /> },
            { title: '录入时间', dataIndex: 'enteredAt' },
            { title: '偏差', dataIndex: 'variance', render: (v: string | null) => <span style={{ color: v ? '#ff4d4f' : '#52c41a', fontSize: 12 }}>{v || '无'}</span> },
            { title: '操作', render: (_, r: PathwayPatient) => <Button size="small" icon={<Eye size={12} />} onClick={() => setDetail(r)}>查看步骤</Button> },
          ]}
        />
      </Card>

      <Modal title={`路径详情 - ${detail?.patient ?? ''}`} open={!!detail} onCancel={() => setDetail(null)} footer={null} width={480}>
        {detail && (
          <>
            <Space style={{ marginBottom: 12 }}>
              <Tag color="blue">{detail.pathway}</Tag>
              <Badge status={detail.status === 'on-track' ? 'success' : 'error'} text={detail.status === 'on-track' ? '按计划' : '延迟'} />
            </Space>
            <Steps
              current={detail.step - 1}
              direction="vertical"
              size="small"
              items={(detail.steps ?? Array.from({ length: detail.totalSteps }, (_, i) => `步骤 ${i + 1}`)).map((s: string, i: number) => ({
                title: s,
                status: i < detail.step - 1 ? 'finish' : i === detail.step - 1 ? 'process' : 'wait',
                icon: i < detail.step ? <CheckCircle2 size={14} color="#52c41a" /> : <Clock size={14} />,
                description: i < detail.step ? '已完成' : '待处理',
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

      <Modal title="登记患者入径" open={enrollModal} onOk={() => void enrollPatient()} onCancel={() => setEnrollModal(false)} okText="登记">
        <Form form={enrollForm} layout="vertical">
          <Form.Item name="patientName" label="患者姓名" rules={[{ required: true, message: '请输入患者姓名' }]}>
            <Input placeholder="请输入患者姓名" />
          </Form.Item>
          <Form.Item name="pathwayName" label="临床路径" rules={[{ required: true, message: '请选择路径' }]}>
            <Input placeholder="如：白内障手术临床路径" list="pathway-options" />
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
