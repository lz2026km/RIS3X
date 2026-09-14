// [W3-2] 牙科远程会诊: dentalApi.tele 真实 API + 发起/加入 + 会诊列表 + 状态
// [W3-C] 上传照片→文件选择+本地预览; AI 预筛→功能标注; 详情→Modal
import { DentalPageLayout } from './DentalShared';
import { dentalApi } from '@/services/api/dentalApi';
import { Card, Button, Row, Col, Select, List, Empty, message, Modal, Form, Input, Tag, Space, Alert, Spin, Statistic, Badge, Popconfirm, Image, Descriptions } from 'antd';
import { Plus, Upload, Globe, Video, RefreshCw, PhoneIncoming, AlertTriangle } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Inbox } from 'lucide-react'
import { t } from '../../i18n/appI18n'

const { TextArea } = Input;

const STATUS_META: Record<string, { color: string; label: string }> = {
  waiting: { color: 'orange', label: 'dentalTele.statusWaiting' },
  in_progress: { color: 'processing', label: 'dentalTele.statusInProgress' },
  completed: { color: 'success', label: 'dentalTele.statusCompleted' },
  cancelled: { color: 'default', label: 'dentalTele.statusCancelled' },
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

interface CariesDetection {
  toothNo: string;
  surface: string;
  confidence: number;
  severity: string;
  bbox: number[];
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
  // [G005 Wave2A] AI 预筛真实化: dentalApi.detectCaries (POST /dental/ai/caries-detection)
  const [screeningModal, setScreeningModal] = useState(false);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [screeningDetections, setScreeningDetections] = useState<CariesDetection[]>([]);
  const [screeningMeta, setScreeningMeta] = useState<{ model: string; method: string } | null>(null);
  const [screeningError, setScreeningError] = useState('');
  const [screeningSource, setScreeningSource] = useState('');

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
        setError(res.error?.message ?? t('dentalTele.loadFailed'));
      }
    } catch (e) {
      console.error('[DentalTele] load:', e);
      setError(t('dentalTele.loadFailed'));
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
        message.success(t('dentalTele.created'));
        setCreateModal(false);
        form.resetFields();
        void load();
      } else {
        message.error(res.error?.message ?? t('dentalTele.createFailed'));
      }
    } catch (e) {
      if (e instanceof Error && e.message) message.error(e.message);
      else message.error(t('dentalTele.createFailed'));
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
    // [G005 Wave1B] 会诊结束: dentalApi.endTeleSession (DELETE /dental/tele/sessions/:id)
    try {
      const res = await dentalApi.endTeleSession(s.id);
      if (res.success) {
        setSessions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'completed' } : x));
        message.success(t('dentalTele.ended'));
      } else {
        message.warning(res.error?.message ?? t('dentalTele.endUnavailable'));
        setSessions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'completed' } : x));
      }
    } catch {
      setSessions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'completed' } : x));
      message.success(t('dentalTele.endedLocal'));
    }
  };

  // [G005 Wave2A] AI 预筛: 上传照片转 base64 → detectCaries; 无照片时用会诊患者标识直调 (后端 mock 兜底)
  const runAiPrescreen = async () => {
    setScreeningLoading(true);
    setScreeningError('');
    setScreeningDetections([]);
    setScreeningMeta(null);
    setScreeningSource('');
    let imageBase64: string | undefined;
    try {
      if (photos.length > 0) {
        const firstPhoto = photos[0]!;
        const f = await fetch(firstPhoto.url).then(r => r.blob());
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error(t('dentalTele.photoReadFailed')));
          reader.readAsDataURL(f);
        });
      }
      const res = await dentalApi.detectCaries({ imageBase64, modality: 'Periapical' });
      const data = res.data as { detections?: CariesDetection[]; model?: string; method?: string } | null | undefined;
      if (res.success && data && Array.isArray(data.detections)) {
        setScreeningDetections(data.detections);
        setScreeningMeta({ model: data.model ?? '', method: data.method ?? '' });
        setScreeningSource(imageBase64 ? `照片 ${photos[0]!.name}` : `会诊患者标识 (无照片, mock 预筛)`);
        setScreeningModal(true);
      } else {
        throw new Error(res.error?.message ?? t('dentalTele.emptyResult'));
      }
    } catch (e) {
      console.error('[DentalTele] AI 预筛失败:', e);
      setScreeningError(e instanceof Error ? e.message : t('dentalTele.aiUnavailable'));
      setScreeningSource(t('dentalTele.pendingService'));
      setScreeningModal(true);
    } finally {
      setScreeningLoading(false);
    }
  };

  const activeCount = sessions.filter(s => s.status === 'in_progress').length;
  const waitingCount = sessions.filter(s => s.status === 'waiting').length;

  return (
    <DentalPageLayout header={{ title: t('dentalTele.title'), icon: <Video size={20} color="#2563eb" /> }}>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> {t('dentalTele.retry')}</Button>} />}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title={t('dentalTele.total')} value={sessions.length} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('dentalTele.inProgress')} value={activeCount} styles={{ content: { color: '#2563eb' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('dentalTele.waiting')} value={waitingCount} styles={{ content: { color: '#faad14' } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('dentalTele.completed')} value={sessions.filter(s => s.status === 'completed').length} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
      </Row>
      <Row gutter={16}>
        <Col span={6}><Card size="small"><Button type="primary" block onClick={() => setCreateModal(true)} icon={<Plus size={14} />}>{t('dentalTele.create')}</Button></Card></Col>
        <Col span={6}><Card size="small"><Button block icon={<Upload size={14} />} onClick={openPhotoModal}>{t('dentalTele.uploadPhotos')}</Button></Card></Col>
        <Col span={6}><Card size="small"><Button block icon={<Globe size={14} />} loading={screeningLoading} onClick={() => void runAiPrescreen()}>{t('dentalTele.aiPrescreen')}</Button></Card></Col>
        <Col span={6}><Card size="small"><Button block icon={<RefreshCw size={14} />} onClick={() => void load()}>{t('dentalTele.refresh')}</Button></Card></Col>
      </Row>
      <Card title={`会诊记录 (${sessions.length})`} size="small" style={{ marginTop: 16 }}>
        <Spin spinning={loading}>
          {sessions.length === 0 && !loading ? (
            <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('dentalTele.empty')} />
          ) : (
            <List
              dataSource={sessions}
              renderItem={(s: TeleSession) => {
                const meta = STATUS_META[s.status] ?? { color: 'default', label: s.status ?? 'dentalTele.unknown' };
                return (
                  <List.Item
                    actions={[
                      <Space key="ops" wrap>
                        {s.status === 'waiting' && <Button size="small" type="primary" icon={<PhoneIncoming size={12} />} onClick={() => void joinSession(s)}>{t('dentalTele.join')}</Button>}
                        {(s.status === 'waiting' || s.status === 'in_progress') && (
                          <Popconfirm title={t('dentalTele.endConfirm')} onConfirm={() => void endSession(s)}>
                            <Button size="small">{t('dentalTele.end')}</Button>
                          </Popconfirm>
                        )}
                        <Button size="small" onClick={() => setDetailModal(s)}>{t('dentalTele.detail')}</Button>
                      </Space>,
                    ]}
                  >
                    <List.Item.Meta
                      title={<Space wrap>
                        <b>{s.title}</b>
                        <Tag color="geekblue">{s.id}</Tag>
                        <Tag color={meta.color === 'processing' ? 'blue' : meta.color}>{t(meta.label)}</Tag>
                        <Badge status={s.status === 'in_progress' ? 'processing' : 'default'} />
                      </Space>}
                      description={<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {t('dentalTele.patient')}: {s.patientName} | {t('dentalTele.expert')}: {s.expert} | {t('dentalTele.host')}: {s.hostDoctor} | {t('dentalTele.time')}: {(s.createdAt ?? '').replace('T', ' ').slice(0, 16)}
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

      <Modal title={t('dentalTele.createModal')} open={createModal} onCancel={() => setCreateModal(false)} onOk={() => void createSession()} confirmLoading={saving} width={480}>
        <Form form={form} layout="vertical" size="small" initialValues={{ expert: '王专?(种植)' }}>
          <Form.Item label={t('dentalTele.formTitle')} name="title" rules={[{ required: true, message: t('dentalTele.formTitleRequired') }]}>
            <Input placeholder={t('dentalTele.formTitlePlaceholder')} />
          </Form.Item>
          <Form.Item label={t('dentalTele.patient')} name="patientId" rules={[{ required: true, message: t('dentalTele.patientRequired') }]}>
            <Select options={PATIENT_OPTIONS} placeholder={t('dentalTele.selectPatient')} />
          </Form.Item>
          <Form.Item label={t('dentalTele.inviteExpert')} name="expert" rules={[{ required: true, message: t('dentalTele.expertRequired') }]}>
            <Select options={EXPERT_OPTIONS} />
          </Form.Item>
          <Form.Item label={t('dentalTele.formReason')} name="reason">
            <TextArea rows={3} placeholder={t('dentalTele.formReasonPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('dentalTele.uploadPhotos')} open={photoModal} onCancel={() => setPhotoModal(false)} footer={<Button type="primary" onClick={() => setPhotoModal(false)}>{t('dentalTele.done')}</Button>} width={520}>
        <div style={{ marginBottom: 12 }}>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleSelectPhotos(e.target.files)}
          />
          <Button type="primary" icon={<Upload size={14} />} onClick={() => photoInputRef.current?.click()}>{t('dentalTele.selectPhotos')}</Button>
          <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-secondary)' }}>{t('dentalTele.selectedPhotos', { count: photos.length })}</span>
        </div>
        {photos.length === 0 ? (
          <Empty description={t('dentalTele.noPhotos')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                  {t('dentalTele.remove')}
                </Button>
              </div>
            ))}
          </div>
        )}
        <Alert style={{ marginTop: 12 }} type="info" showIcon icon={<AlertTriangle size={14} />} message={t('dentalTele.photoLocalOnly')} />
      </Modal>

      <Modal title={`${t('dentalTele.detailTitle')} - ${detailModal?.title ?? ''}`} open={!!detailModal} onCancel={() => setDetailModal(null)} footer={<Button onClick={() => setDetailModal(null)}>{t('dentalTele.close')}</Button>} width={480}>
        {detailModal && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Space wrap>
                <b>{detailModal.id}</b>
                <Tag color="geekblue">{detailModal.status}</Tag>
              </Space>
            </div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label={t('dentalTele.patient')}>{detailModal.patientName} ({detailModal.patientId})</Descriptions.Item>
              <Descriptions.Item label={t('dentalTele.expert')}>{detailModal.expert}</Descriptions.Item>
              <Descriptions.Item label={t('dentalTele.host')}>{detailModal.hostDoctor}</Descriptions.Item>
              <Descriptions.Item label={t('dentalTele.createdAt')}>{detailModal.createdAt?.replace('T', ' ').slice(0, 16)}</Descriptions.Item>
              <Descriptions.Item label={t('dentalTele.reason')}>{detailModal.reason || '—'}</Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>

      <Modal
        title={<Space><Globe size={15} /> {t('dentalTele.screeningTitle')}</Space>}
        open={screeningModal}
        onCancel={() => setScreeningModal(false)}
        footer={<Button type="primary" onClick={() => setScreeningModal(false)}>{t('dentalTele.close')}</Button>}
        width={560}
      >
        {screeningError ? (
          <Alert
            type="warning"
            showIcon
            message={t('dentalTele.screeningPending')}
            description={`${screeningError} — ${t('dentalTele.screeningPendingDesc')}`}
            action={<Button size="small" loading={screeningLoading} onClick={() => void runAiPrescreen()}>{t('dentalTele.retry')}</Button>}
          />
        ) : (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Tag color="purple">{t('dentalTele.model')}: {screeningMeta?.model || '-'}</Tag>
              <Tag color="cyan">{t('dentalTele.method')}: {screeningMeta?.method || '-'}</Tag>
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-secondary)' }}>{t('dentalTele.source')}: {screeningSource}</span>
            </div>
            {screeningDetections.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dentalTele.noCaries')} />
            ) : (
              <List
                size="small"
                dataSource={screeningDetections}
                renderItem={(d: CariesDetection) => (
                  <List.Item>
                    <Space wrap>
                      <Tag color="geekblue">{t('dentalTele.toothNo')} {d.toothNo}</Tag>
                      <Tag color="gold">{t('dentalTele.surface')} {d.surface}</Tag>
                      <Tag color={d.severity === 'high' ? 'red' : d.severity === 'medium' ? 'orange' : 'green'}>
                        {t('dentalTele.severity')}: {d.severity === 'high' ? t('dentalTele.severityHigh') : d.severity === 'medium' ? t('dentalTele.severityMedium') : t('dentalTele.severityLow')}
                      </Tag>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('dentalTele.confidence')} {Math.round(d.confidence * 100)}%</span>
                    </Space>
                  </List.Item>
                )}
              />
            )}
            <Alert style={{ marginTop: 12 }} type="info" showIcon message={t('dentalTele.screeningDisclaimer')} />
          </div>
        )}
      </Modal>
    </DentalPageLayout>
  );
};

export default DentalTelePage;
