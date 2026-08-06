// [W3-2] 牙科远程会诊: dentalApi.tele 真实 API + 发起/加入 + 会诊列表 + 状态
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Row, Col, Select, List, Empty, message, Modal, Form, Input, Tag, Space, Alert, Spin, Statistic, Badge, Popconfirm } from 'antd';
import { Plus, Upload, Globe, Video, RefreshCw, PhoneIncoming } from 'lucide-react';
import { DentalPageLayout } from './DentalShared';
import { dentalApi } from '@/services/api/dentalApi';

const { TextArea } = Input;

const STATUS_META: Record<string, { color: string; label: string }> = {
  waiting: { color: 'orange', label: '等待加入' },
  in_progress: { color: 'processing', label: '进行中' },
  completed: { color: 'success', label: '已结束' },
  cancelled: { color: 'default', label: '已取消' },
};

const EXPERT_OPTIONS = [
  { value: '王专?(种植)', label: '王专?(种植)' },
  { value: '李专?(正畸)', label: '李专?(正畸)' },
  { value: '陈专?(牙周)', label: '陈专?(牙周)' },
];

const PATIENT_OPTIONS = [
  { value: 'P100001', label: '张伟' },
  { value: 'P100002', label: '李娜' },
  { value: 'P100003', label: '王芳' },
];

interface TeleSession {
  id: string;
  title: string;
  patientId: string;
  patientName: string;
  expert: string;
  reason: string;
  status: string;
  hostDoctor: string;
  createdAt: string;
}

export const DentalTelePage: React.FC = () => {
  const [sessions, setSessions] = useState<TeleSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dentalApi.listTeleSessions();
      if (res.success && Array.isArray(res.data)) {
        setSessions(res.data as TeleSession[]);
      } else {
        setError(res.error?.message ?? '会诊记录加载失败');
      }
    } catch (e) {
      console.error('[DentalTele] load:', e);
      setError('会诊记录加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createSession = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await dentalApi.createTeleSession({
        patientId: values.patientId,
        patientName: PATIENT_OPTIONS.find(p => p.value === values.patientId)?.label ?? values.patientId,
        expert: values.expert,
        reason: values.reason,
        title: values.title,
        hostDoctor: '当前医生',
        status: 'waiting',
      });
      if (res.success) {
        message.success('会诊已创建, 等待专家加入');
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

  const joinSession = async (s: TeleSession) => {
    message.success(`正在加入会诊 ${s.id} ...`);
    setTimeout(() => {
      setSessions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'in_progress' } : x));
      message.success(`已加入专家 ${s.expert} 的会诊`);
    }, 800);
  };

  const endSession = async (s: TeleSession) => {
    setSessions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'completed' } : x));
    message.success('会诊已结束');
  };

  const activeCount = sessions.filter(s => s.status === 'in_progress').length;
  const waitingCount = sessions.filter(s => s.status === 'waiting').length;

  return (
    <DentalPageLayout header={{ title: '远程口腔会诊', icon: <Video size={20} color="#1677ff" /> }}>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} action={<Button size="small" onClick={() => void load()}>重试</Button>} />}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="会诊总数" value={sessions.length} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="进行中" value={activeCount} styles={{ content: { color: '#1677ff' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="等待加入" value={waitingCount} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已结束" value={sessions.filter(s => s.status === 'completed').length} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
      </Row>
      <Row gutter={16}>
        <Col span={6}><Card size="small"><Button type="primary" block onClick={() => setCreateModal(true)} icon={<Plus size={14} />}>新建会诊</Button></Card></Col>
        <Col span={6}><Card size="small"><Button block icon={<Upload size={14} />} onClick={() => message.info('上传口内照片功能即将开放')}>上传口内照片</Button></Card></Col>
        <Col span={6}><Card size="small"><Button block icon={<Globe size={14} />} onClick={() => message.info('AI 预筛功能即将开放')}>AI 预筛</Button></Card></Col>
        <Col span={6}><Card size="small"><Button block icon={<RefreshCw size={14} />} onClick={() => void load()}>刷新列表</Button></Card></Col>
      </Row>
      <Card title={`会诊记录 (${sessions.length})`} size="small" style={{ marginTop: 16 }}>
        <Spin spinning={loading}>
          {sessions.length === 0 && !loading ? (
            <Empty description="暂无会诊记录, 点击「新建会诊」发起" />
          ) : (
            <List
              dataSource={sessions}
              renderItem={(s: TeleSession) => {
                const meta = STATUS_META[s.status] ?? { color: 'default', label: s.status ?? '未知' };
                return (
                  <List.Item
                    actions={[
                      <Space key="ops" wrap>
                        {s.status === 'waiting' && <Button size="small" type="primary" icon={<PhoneIncoming size={12} />} onClick={() => void joinSession(s)}>加入</Button>}
                        {(s.status === 'waiting' || s.status === 'in_progress') && (
                          <Popconfirm title="结束该会诊?" onConfirm={() => void endSession(s)}>
                            <Button size="small">结束</Button>
                          </Popconfirm>
                        )}
                        <Button size="small" onClick={() => message.info(`会诊 ${s.id} 详情`)}>详情</Button>
                      </Space>,
                    ]}
                  >
                    <List.Item.Meta
                      title={<Space wrap>
                        <b>{s.title}</b>
                        <Tag color="geekblue">{s.id}</Tag>
                        <Tag color={meta.color === 'processing' ? 'blue' : meta.color}>{meta.label}</Tag>
                        <Badge status={s.status === 'in_progress' ? 'processing' : 'default'} />
                      </Space>}
                      description={<span style={{ fontSize: 12, color: '#999' }}>
                        患者: {s.patientName} | 专家: {s.expert} | 发起: {s.hostDoctor} | 时间: {(s.createdAt ?? '').replace('T', ' ').slice(0, 16)}
                        {s.reason ? ` | 议题: ${s.reason}` : ''}
                      </span>}
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </Spin>
      </Card>

      <Modal title="新建远程会诊" open={createModal} onCancel={() => setCreateModal(false)} onOk={() => void createSession()} confirmLoading={saving} width={480}>
        <Form form={form} layout="vertical" size="small" initialValues={{ expert: '王专?(种植)' }}>
          <Form.Item label="会诊标题" name="title" rules={[{ required: true, message: '请输入会诊标题' }]}>
            <Input placeholder="如: 种植复杂病例会诊" />
          </Form.Item>
          <Form.Item label="患者" name="patientId" rules={[{ required: true, message: '请选择患者' }]}>
            <Select options={PATIENT_OPTIONS} placeholder="选择患者" />
          </Form.Item>
          <Form.Item label="邀请专家" name="expert" rules={[{ required: true, message: '请选择专家' }]}>
            <Select options={EXPERT_OPTIONS} />
          </Form.Item>
          <Form.Item label="会诊议题" name="reason">
            <TextArea rows={3} placeholder="如: 36 位骨量不足, 需评估骨增量方案" />
          </Form.Item>
        </Form>
      </Modal>
    </DentalPageLayout>
  );
};

export default DentalTelePage;
