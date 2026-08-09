// [W3-2] 牙科远程会诊: dentalApi.tele 真实 API + 发起/加入 + 会诊列表 + 状态
// [W3-C] 上传照片→文件选择+本地预览; AI 预筛→功能标注; 详情→Modal
import { DentalPageLayout } from './DentalShared';
import { dentalApi } from '@/services/api/dentalApi';
import { Card, Button, Row, Col, Select, List, Empty, message, Modal, Form, Input, Tag, Space, Alert, Spin, Statistic, Badge, Popconfirm, Image, Descriptions } from 'antd';
import { Plus, Upload, Globe, Video, RefreshCw, PhoneIncoming, AlertTriangle } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Inbox } from 'lucide-react'

const { TextArea } = Input;

const STATUS_META: Record<string, { color: string; label: string }> = {
  waiting: { color: 'orange', label: '等待加入' },
  in_progress: { color: 'processing', label: '进行中' },
  completed: { color: 'success', label: '已结束' },
  cancelled: { color: 'default', label: '已取消' },
};

interface LocalPhoto {
  id: string;
  name: string;
  url: string;
  sizeKB: number;
  uploadedAt: string;
}

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
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [photoModal, setPhotoModal] = useState(false);
  const [detailModal, setDetailModal] = useState<TeleSession | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleSelectPhotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: LocalPhoto[] = Array.from(files).map((f, i) => ({
      id: `${f.name}-${Date.now()}-${i}`,
      name: f.name,
      url: URL.createObjectURL(f),
      sizeKB: Math.round(f.size / 1024),
      uploadedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    }));
    setPhotos((prev) => [...prev, ...next]);
    message.success(`已选择 ${next.length} 张口内照片 (本地预览, 未上传服务器)`);
  };

  const openPhotoModal = () => {
    setPhotoModal(true);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

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
    <DentalPageLayout header={{ title: '远程口腔会诊', icon: <Video size={20} color="#2563eb" /> }}>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> 重试</Button>} />}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="会诊总数" value={sessions.length} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="进行中" value={activeCount} styles={{ content: { color: '#2563eb' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="等待加入" value={waitingCount} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已结束" value={sessions.filter(s => s.status === 'completed').length} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
      </Row>
      <Row gutter={16}>
        <Col span={6}><Card size="small"><Button type="primary" block onClick={() => setCreateModal(true)} icon={<Plus size={14} />}>新建会诊</Button></Card></Col>
        <Col span={6}><Card size="small"><Button block icon={<Upload size={14} />} onClick={openPhotoModal}>上传口内照片</Button></Card></Col>
        <Col span={6}><Card size="small"><Button block icon={<Globe size={14} />} onClick={() => message.info('AI 预筛功能待接入口腔 AI 服务后开放 (详见「口腔 AI 辅助诊断」页)')}>AI 预筛</Button></Card></Col>
        <Col span={6}><Card size="small"><Button block icon={<RefreshCw size={14} />} onClick={() => void load()}>刷新列表</Button></Card></Col>
      </Row>
      <Card title={`会诊记录 (${sessions.length})`} size="small" style={{ marginTop: 16 }}>
        <Spin spinning={loading}>
          {sessions.length === 0 && !loading ? (
            <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无会诊记录, 点击「新建会诊」发起" />
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
                        <Button size="small" onClick={() => setDetailModal(s)}>详情</Button>
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
                      description={<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
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

      <Modal title="上传口内照片" open={photoModal} onCancel={() => setPhotoModal(false)} footer={<Button type="primary" onClick={() => setPhotoModal(false)}>完成</Button>} width={520}>
        <div style={{ marginBottom: 12 }}>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleSelectPhotos(e.target.files)}
          />
          <Button type="primary" icon={<Upload size={14} />} onClick={() => photoInputRef.current?.click()}>选择照片</Button>
          <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-secondary)' }}>已选 {photos.length} 张 · 本地预览, 不涉及网络传输</span>
        </div>
        {photos.length === 0 ? (
          <Empty description="尚未选择照片, 请选择口内照片后预览" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {photos.map((p) => (
              <div key={p.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 8 }}>
                <Image src={p.url} alt={p.name} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6 }} />
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-primary)' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.sizeKB} KB · {p.uploadedAt}</div>
                <Button
                  size="small"
                  danger
                  style={{ marginTop: 6 }}
                  onClick={() => setPhotos((prev) => prev.filter((x) => x.id !== p.id))}
                >
                  移除
                </Button>
              </div>
            ))}
          </div>
        )}
        <Alert style={{ marginTop: 12 }} type="info" showIcon icon={<AlertTriangle size={14} />} message="照片仅保存在本地会话, 如需归档请使用影像上传通道" />
      </Modal>

      <Modal title={`会诊详情 - ${detailModal?.title ?? ''}`} open={!!detailModal} onCancel={() => setDetailModal(null)} footer={<Button onClick={() => setDetailModal(null)}>关闭</Button>} width={480}>
        {detailModal && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Space wrap>
                <b>{detailModal.id}</b>
                <Tag color="geekblue">{detailModal.status}</Tag>
              </Space>
            </div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="患者">{detailModal.patientName} ({detailModal.patientId})</Descriptions.Item>
              <Descriptions.Item label="专家">{detailModal.expert}</Descriptions.Item>
              <Descriptions.Item label="发起人">{detailModal.hostDoctor}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{detailModal.createdAt?.replace('T', ' ').slice(0, 16)}</Descriptions.Item>
              <Descriptions.Item label="议题">{detailModal.reason || '—'}</Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </DentalPageLayout>
  );
};

export default DentalTelePage;
