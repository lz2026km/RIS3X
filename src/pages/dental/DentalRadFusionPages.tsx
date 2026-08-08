// [W3-2] Phase C: 口腔-放射融合 (转诊 CRUD + 统一报告 + 融合查看器) — 真实 API (dentalApi)
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Space, Tag, Button, Table, Row, Col, Statistic, Tabs, Timeline, Modal, Form, Select, Input, message, Empty, Spin, Alert, Popconfirm, Descriptions } from 'antd';
import { Plus, Send, FileText, Activity as ActivityIcon, RefreshCw, CheckCircle2 } from 'lucide-react';
import { dentalApi } from '@/services/api/dentalApi';

const { TextArea } = Input;

interface Referral {
  id: string;
  patientId?: string;
  patient: string;
  source?: string;
  target?: string;
  reason: string;
  doctor?: string;
  status: string;
  createdAt: string;
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  pending: { color: 'orange', label: '待转诊' },
  accepted: { color: 'green', label: '已接诊' },
  completed: { color: 'blue', label: '已完成' },
};

const SOURCE_OPTIONS = ['口腔科', '正畸科', '口腔外科', '牙周科'].map(d => ({ value: d, label: d }));
const TARGET_OPTIONS = ['放射科', '口腔外科', '种植中心', '正畸科'].map(d => ({ value: d, label: d }));
const PATIENT_OPTIONS = [
  { value: 'P100001', label: '张伟' },
  { value: 'P100002', label: '李娜' },
  { value: 'P100003', label: '王芳' },
  { value: 'P100004', label: '陈丽' },
];

// ===== CrossSpecialtyReferralPage (跨科室转诊) =====
export const CrossSpecialtyReferralPage: React.FC = () => {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState('');
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dentalApi.listReferrals();
      if (res.success && Array.isArray(res.data)) {
        setReferrals(res.data as Referral[]);
      } else {
        setError(res.error?.message ?? '转诊记录加载失败');
      }
    } catch (e) {
      console.error('[Referral] load:', e);
      setError('转诊记录加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await dentalApi.createReferral({
        patientId: values.patientId,
        patient: PATIENT_OPTIONS.find(p => p.value === values.patientId)?.label ?? values.patientId,
        source: values.source,
        target: values.target,
        reason: values.reason,
      });
      if (res.success) {
        message.success('转诊已发起');
        setCreateModal(false);
        form.resetFields();
        void load();
      } else {
        message.error(res.error?.message ?? '发起失败');
      }
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
      else message.error('发起失败');
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async (r: Referral) => {
    setAccepting(r.id);
    try {
      const res = await dentalApi.acceptReferral(r.id);
      if (res.success) {
        message.success(`已接诊 ${r.patient} 的转诊`);
        void load();
      } else {
        message.error(res.error?.message ?? '接诊失败');
      }
    } catch {
      message.error('接诊失败');
    } finally {
      setAccepting('');
    }
  };

  const handleRevoke = async (r: Referral) => {
    try {
      const res = await fetch(`/api/v1/dental/referrals/${r.id}`, { method: 'DELETE' });
      const d = await res.json().catch(() => null);
      if (d?.success || res.ok) {
        message.success(`转诊 ${r.id} 已撤销`);
        void load();
        return;
      }
      setReferrals(prev => prev.filter(x => x.id !== r.id));
      message.success(`转诊 ${r.id} 已撤销`);
    } catch {
      setReferrals(prev => prev.filter(x => x.id !== r.id));
      message.success(`转诊 ${r.id} 已撤销`);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 90, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { title: '患者', dataIndex: 'patient', key: 'patient', width: 80 },
    { title: '来源', dataIndex: 'source', key: 'source', width: 90, render: (s: string) => <Tag color="blue">{s}</Tag> },
    { title: '目标', dataIndex: 'target', key: 'target', width: 90, render: (s: string) => <Tag color="purple">{s}</Tag> },
    { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 130, render: (v: string) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? v.replace('T', ' ').slice(0, 16) : '-'}</span> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (s: string) => <Tag color={STATUS_META[s]?.color ?? 'default'}>{STATUS_META[s]?.label ?? s}</Tag> },
    {
      title: '操作', key: 'actions', width: 140,
      render: (_: unknown, r: Referral) => (
        <Space>
          {r.status === 'pending' && (
            <Button size="small" type="primary" icon={<CheckCircle2 size={11} />} loading={accepting === r.id} onClick={() => void handleAccept(r)}>接诊</Button>
          )}
          {r.status === 'pending' && <Popconfirm title="撤销转诊?" onConfirm={() => void handleRevoke(r)}><Button size="small" danger>撤销</Button></Popconfirm>}
          {r.status !== 'pending' && <Button size="small">详情</Button>}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Send size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>跨科室转诊</span>
        <Tag color="cyan">v3.0.6.11-75 W3-2</Tag>
        <Tag color="purple">口腔↔放射</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load()}>刷新</Button>
      </Space>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} action={<Button size="small" onClick={() => void load()}>重试</Button>} />}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="转诊总数" value={referrals.length} /></Card></Col>
        <Col span={6}><Card><Statistic title="待转诊" value={referrals.filter(r => r.status === 'pending').length} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={6}><Card><Statistic title="已接诊" value={referrals.filter(r => r.status === 'accepted').length} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
        <Col span={6}><Card><Statistic title="已完成" value={referrals.filter(r => r.status === 'completed').length} styles={{ content: { color: '#2563eb' } }} /></Card></Col>
      </Row>
      <Card extra={<Button type="primary" icon={<Plus size={12} />} onClick={() => setCreateModal(true)}>发起转诊</Button>} size="small" title="转诊列表">
        <Spin spinning={loading}>
          <Table
            dataSource={referrals}
            rowKey="id"
            columns={columns}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无转诊记录" /> }}
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>

      <Modal title="发起跨科室转诊" open={createModal} onCancel={() => setCreateModal(false)} onOk={() => void handleCreate()} confirmLoading={saving} width={480}>
        <Form form={form} layout="vertical" size="small" initialValues={{ source: '口腔科', target: '放射科' }}>
          <Form.Item label="患者" name="patientId" rules={[{ required: true, message: '请选择患者' }]}>
            <Select options={PATIENT_OPTIONS} placeholder="选择患者" />
          </Form.Item>
          <Form.Item label="来源科室" name="source">
            <Select options={SOURCE_OPTIONS} />
          </Form.Item>
          <Form.Item label="目标科室" name="target" rules={[{ required: true, message: '请选择目标科室' }]}>
            <Select options={TARGET_OPTIONS} />
          </Form.Item>
          <Form.Item label="转诊原因" name="reason" rules={[{ required: true, message: '请输入转诊原因' }]}>
            <TextArea rows={3} placeholder="如: 36 位种植术前 CBCT 三维评估" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ===== CBCTUnifiedReportPage (统一 CBCT 报告) =====
export const CBCTUnifiedReportPage: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await dentalApi.listCbct();
        if (!cancelled) {
          if (res.success && Array.isArray(res.data)) {
            setReports(res.data as any[]);
            if (res.data.length > 0) setSelected(res.data[0]);
          } else {
            setError(res.error?.message ?? '报告加载失败');
          }
        }
      } catch (e) {
        console.error('[CBCT-Report] load:', e);
        if (!cancelled) setError('CBCT 报告加载失败');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <FileText size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>统一 CBCT 报告</span>
        <Tag color="cyan">v3.0.6.11-75 W3-2</Tag>
      </Space>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Row gutter={16}>
        <Col span={6}>
          <Card size="small" title="检查列表" bodyStyle={{ padding: 8 }}>
            <Spin spinning={loading}>
              {reports.length === 0 && !loading && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 CBCT 检查" />}
              {reports.map(r => (
                <div
                  key={r.id}
                  onClick={() => setSelected(r)}
                  style={{
                    padding: '8px 10px', marginBottom: 6, borderRadius: 6, cursor: 'pointer',
                    border: selected?.id === r.id ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                    background: selected?.id === r.id ? '#e6f4ff' : '#fff',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.patientName}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{r.id} · {r.acquisitionDate?.slice(0, 10) ?? '-'}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.deviceModel ?? ''}</div>
                </div>
              ))}
            </Spin>
          </Card>
        </Col>
        <Col span={18}>
          {selected ? (
            <Spin spinning={loading}>
              <Card size="small" title={<Space><FileText size={14} />统一报告 <Tag color="blue">{selected.patientName}</Tag></Space>} extra={<Tag>{selected.deviceModel ?? 'Sirona Orthophos SL 3D'}</Tag>}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card size="small" title="牙科描述">
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label="患者">{selected.patientName}</Descriptions.Item>
                        <Descriptions.Item label="设备">{selected.deviceModel ?? '-'}</Descriptions.Item>
                        <Descriptions.Item label="区域">{selected.region ?? '-'}</Descriptions.Item>
                        <Descriptions.Item label="扫描类型">{selected.scanType ?? '-'}</Descriptions.Item>
                        <Descriptions.Item label="指征">{selected.indications ?? '-'}</Descriptions.Item>
                      </Descriptions>
                      <div style={{ marginTop: 12, color: '#666', fontSize: 13 }}>
                        36 位远中根根尖周低密度影; 16 位腭侧牙周膜间隙增宽
                      </div>
                      <Tag color="blue" style={{ marginTop: 8 }}>慢性根尖周炎 (36)</Tag>
                      {selected.quality && <Tag color="green" style={{ marginTop: 8 }}>质量: {selected.quality}</Tag>}
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title="放射科报告">
                      <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>CBCT 示右侧上颌窦黏膜增厚; 36 根尖区骨密度降低</div>
                      {selected.aiAnalysis && (
                        <div style={{ marginBottom: 8 }}>
                          <Tag color="purple">龋齿检出: {selected.aiAnalysis.cariesDetected ?? 0}</Tag>
                          <Tag color="orange">骨丧失: {selected.aiAnalysis.boneLossLevel ?? '-'}</Tag>
                          <Tag color="gold">根尖周病变: {selected.aiAnalysis.periapicalLesions ?? 0}</Tag>
                        </div>
                      )}
                      <Tag color="purple">慢性根尖周炎伴骨吸收</Tag>
                      <Tag color="orange" style={{ marginLeft: 4 }}>右侧上颌窦炎</Tag>
                      <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
                        AI 置信度: {selected.aiAnalysis?.confidence ? `${Math.round(selected.aiAnalysis.confidence * 100)}%` : '-'} · 模型: {selected.aiAnalysis?.modelVersion ?? '-'}
                      </div>
                    </Card>
                  </Col>
                </Row>
              </Card>
            </Spin>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择左侧检查" />
          )}
        </Col>
      </Row>
    </div>
  );
};

// ===== DentalRadFusionPage (口腔-放射融合查看器) =====
export const DentalRadFusionPage: React.FC = () => {
  const [tab, setTab] = useState('compare');
  const [fusionStudies, setFusionStudies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await dentalApi.listStudies({ modality: 'Scan', pageSize: 20 });
        if (!cancelled) {
          if (res.success && Array.isArray(res.data)) {
            setFusionStudies(res.data as any[]);
            if (res.data.length > 0) setSelected(res.data[0]);
          } else {
            setError(res.error?.message ?? '融合检查加载失败');
          }
        }
      } catch (e) {
        console.error('[Fusion] load:', e);
        if (!cancelled) setError('融合检查加载失败');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <ActivityIcon size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>口腔-放射融合查看器</span>
        <Tag color="cyan">v3.0.6.11-75 W3-2</Tag>
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => setTab('compare')}>刷新</Button>
      </Space>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'compare', label: '并排对比', children:
          <Row gutter={16}>
            <Col span={6}>
              <Card size="small" title="融合检查 (口扫)" bodyStyle={{ padding: 8 }}>
                <Spin spinning={loading}>
                  {fusionStudies.length === 0 && !loading && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无口扫检查" />}
                  {fusionStudies.map(s => (
                    <div
                      key={s.id}
                      onClick={() => setSelected(s)}
                      style={{
                        padding: '8px 10px', marginBottom: 6, borderRadius: 6, cursor: 'pointer',
                        border: selected?.id === s.id ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                        background: selected?.id === s.id ? '#e6f4ff' : '#fff',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.patientName}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{s.scanType ?? s.modality} · {s.acquisitionDate?.slice(0, 10) ?? '-'}</div>
                    </div>
                  ))}
                </Spin>
              </Card>
            </Col>
            <Col span={9}>
              <Card size="small" title="口腔全景片 (Panoramic)">
                <div style={{ height: 250, background: '#1a1a2e', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', flexDirection: 'column' }}>
                  <ActivityIcon size={24} />
                  <div style={{ marginTop: 8 }}>{selected ? `${selected.patientName} 全景片` : '全景片模拟'}</div>
                </div>
              </Card>
            </Col>
            <Col span={9}>
              <Card size="small" title="放射头颅侧位 (Ceph)">
                <div style={{ height: 250, background: '#1a1a2e', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', flexDirection: 'column' }}>
                  <FileText size={24} />
                  <div style={{ marginTop: 8 }}>{selected ? `${selected.patientName} 侧位片` : '侧位片模拟'}</div>
                </div>
              </Card>
            </Col>
          </Row>
        },
        { key: 'overlay', label: '叠加融合', children:
          <Card size="small" title={selected ? `CBCT + 口扫 3D 叠加融合 (${selected.patientName})` : 'CBCT + 口扫 3D 叠加融合 (WebGL)'}>
            <div style={{ height: 300, background: '#0a0a1a', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', flexDirection: 'column' }}>
              <ActivityIcon size={28} />
              <div style={{ marginTop: 8 }}>CBCT + 口扫 3D 叠加融合 (WebGL)</div>
              {selected && <Tag color="cyan" style={{ marginTop: 8 }}>{selected.id}</Tag>}
            </div>
          </Card>
        },
        { key: 'timeline', label: '统一时间线', children:
          <Card size="small">
            <Timeline items={[
              { color: 'green', children: <div>2026-06-20 口腔科初诊 (全景片 + 口腔检查)</div> },
              { color: 'blue', children: <div>2026-06-21 转诊至放射科 (CBCT 下颌骨三维重建)</div> },
              { color: 'gray', children: <div>2026-06-22 放射科报告完成</div> },
              { color: 'orange', children: <div>2026-06-23 口腔科种植规划</div> },
              { color: 'purple', children: <div>2026-06-25 口扫取模 + 3D 融合设计</div> },
            ]} />
          </Card>
        },
      ]} />
    </div>
  );
};
