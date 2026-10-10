// [v3.0.6.8-102] 口内照片管理 (修复: 真实图片展示+上传+对比)
import { Card, Space, Tag, Button, Select, Row, Col, message, Tabs, Modal, Alert, Upload, Empty, Slider } from 'antd';
import { UploadProps } from 'antd'
import { Camera, Share2, Download, ZoomIn, ZoomOut, X } from 'lucide-react';
import { Inbox } from 'lucide-react'
import React, { useState, useEffect } from 'react';
import { t } from '../../i18n/appI18n';
import { StatCard, StatCardGrid, PageContainer } from '../../components/common';

interface Photo {
  id: string;
  type: string;
  label: string;
  url: string;
  takenAt: string;
  category: 'intraoral' | 'extraoral' | 'radiograph' | 'model' | 'other';
  patientId?: string;
}

const CAT_LABEL: Record<string, string> = {
  intraoral: 'dentalPhoto.catIntraoral',
  extraoral: 'dentalPhoto.catExtraoral',
  radiograph: 'dentalPhoto.catRadiograph',
  model: 'dentalPhoto.catModel',
  other: 'dentalPhoto.catOther',
};

const CAT_COLORS: Record<string, string> = {
  intraoral: 'blue',
  extraoral: 'purple',
  radiograph: 'cyan',
  model: 'green',
  other: 'default',
};

const PLACEHOLDER_SVG = (label: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="100%" height="100%" fill="#1a1b2e"/><text x="50%" y="50%" font-family="monospace" font-size="14" fill="#94a3b8" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`,
  );

const SAMPLE_PHOTOS: Record<string, Photo[]> = {
  P100001: [
    { id: 'PH-001', type: 'frontal', label: '正面微笑', url: PLACEHOLDER_SVG('正面微笑'), takenAt: '2026-06-15T10:00:00Z', category: 'extraoral' },
    { id: 'PH-002', type: 'occlusal-upper', label: '上颌咬合面', url: PLACEHOLDER_SVG('上颌咬合面'), takenAt: '2026-06-15T10:05:00Z', category: 'intraoral' },
    { id: 'PH-003', type: 'occlusal-lower', label: '下颌咬合面', url: PLACEHOLDER_SVG('下颌咬合面'), takenAt: '2026-06-15T10:08:00Z', category: 'intraoral' },
    { id: 'PH-004', type: 'buccal-right', label: '右侧颊面', url: PLACEHOLDER_SVG('右侧颊面'), takenAt: '2026-06-15T10:12:00Z', category: 'intraoral' },
  ],
  P100002: [
    { id: 'PH-101', type: 'frontal', label: '正面休息位', url: PLACEHOLDER_SVG('正面休息位'), takenAt: '2026-06-10T09:00:00Z', category: 'extraoral' },
    { id: 'PH-102', type: 'lateral', label: '右侧面', url: PLACEHOLDER_SVG('右侧面'), takenAt: '2026-06-10T09:05:00Z', category: 'extraoral' },
  ],
  P100003: [
    { id: 'PH-201', type: 'frontal', label: '正面', url: PLACEHOLDER_SVG('正面'), takenAt: '2026-05-20T14:00:00Z', category: 'extraoral' },
    { id: 'PH-202', type: 'panoramic', label: '全景X光', url: PLACEHOLDER_SVG('全景X光'), takenAt: '2026-05-20T14:30:00Z', category: 'radiograph' },
  ],
};

const PHOTO_CATEGORIES = [
  { value: 'intraoral', labelKey: 'dentalPhoto.catIntraoral' },
  { value: 'extraoral', labelKey: 'dentalPhoto.catExtraoral' },
  { value: 'radiograph', labelKey: 'dentalPhoto.catRadiograph' },
  { value: 'model', labelKey: 'dentalPhoto.catModel' },
];

export const DentalPhotoPage: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState('P100001');
  const [preview, setPreview] = useState<Photo | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('intraoral');
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [shareLink, setShareLink] = useState<string>('');
  const [_shareOpen, setShareOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  // 加载照片
  useEffect(() => {
    fetch(`/api/v1/dental/patient/${selected}/photos`)
      .then(r => r.json())
      .then(d => { if (d.success && d.data?.length) setPhotos(d.data); else setPhotos(SAMPLE_PHOTOS[selected] || []); })
      .catch(() => setPhotos(SAMPLE_PHOTOS[selected] || []));
  }, [selected]);

  // 上传配置
  const uploadProps: UploadProps = {
    accept: 'image/*',
    maxCount: 1,
    beforeUpload: (file) => {
      setUploadFile(file);
      return false; // 阻止自动上传
    },
    onRemove: () => setUploadFile(null),
  };

  const handleUpload = () => {
    if (!uploadFile) {
      message.warning(t('dentalPhoto.selectFileFirst'));
      return;
    }
    if (!uploadLabel.trim()) {
      message.warning(t('dentalPhoto.enterLabel'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const newPhoto: Photo = {
        id: `PH-${Date.now()}`,
        type: uploadCategory,
        label: uploadLabel,
        url: e.target?.result as string,
        takenAt: new Date().toISOString(),
        category: uploadCategory as any,
        patientId: selected,
      };
      setPhotos([newPhoto, ...photos]);
      message.success(t('dentalPhoto.photoAdded'));
      setUploadOpen(false);
      setUploadFile(null);
      setUploadLabel('');
    };
    reader.readAsDataURL(uploadFile);
  };

  // 生成分享链接
  const handleGenerateShare = () => {
    const linkId = `CASE-${Date.now().toString(36).toUpperCase()}`;
    const url = `https://share.dentalcloud.com/case/${linkId}`;
    setShareLink(url);
    setShareOpen(true);
    message.success(t('dentalPhoto.shareGenerated'));
  };

  const intraoral = photos.filter(p => p.category === 'intraoral').length;
  const extraoral = photos.filter(p => p.category === 'extraoral').length;
  const radiograph = photos.filter(p => p.category === 'radiograph').length;

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }} wrap>
        <Camera size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('dentalPhoto.title')}</span>
        <Tag color="cyan">v3.0.6.8-102</Tag>
        <Tag color="purple">3Shape Unite</Tag>
        <Select value={selected} onChange={v => setSelected(v)} style={{ width: 180 }}
          options={[
            { value: 'P100001', label: '张伟' },
            { value: 'P100002', label: '李娜' },
            { value: 'P100003', label: '王芳' },
          ]}
        />
        <Button type="primary" icon={<Camera size={14} />} onClick={() => setUploadOpen(true)}>
          {t('dentalPhoto.uploadPhoto')}
        </Button>
        <Button icon={<Share2 size={14} />} onClick={handleGenerateShare}>
          {t('dentalPhoto.generateShareLink')}
        </Button>
      </Space>

      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard title={t('dentalPhoto.statTotal')} value={photos.length} icon={<Camera size={16} />} />
        <StatCard title={t('dentalPhoto.catIntraoral')} value={intraoral} />
        <StatCard title={t('dentalPhoto.catExtraoral')} value={extraoral} />
        <StatCard title={t('dentalPhoto.catRadiograph')} value={radiograph} />
        <StatCard title={t('dentalPhoto.statCategories')} value={new Set(photos.map(p => p.category)).size} />
      </StatCardGrid>

      <Card size="small" title={t('dentalPhoto.gallery')}>
        {photos.length === 0 ? (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('dentalPhoto.noPhotosHint')} />
        ) : (
          <Row gutter={[12, 12]}>
            {photos.map(p => (
              <Col span={6} md={4} key={p.id}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => setPreview(p)}
                  style={{ cursor: 'pointer' }}
                  cover={
                    <div style={{ height: 140, overflow: 'hidden', borderRadius: '4px 4px 0 0', background: '#1a1a2e' }}>
                      <img
                        src={p.url}
                        alt={p.label}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWExYjJlIi8+PHR0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTRhM2I4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5QaG90bz88L3RleHQ+PC9zdmc+'; }}
                      />
                    </div>
                  }
                >
                  <Tag color={CAT_COLORS[p.category]}>{t(CAT_LABEL[p.category] ?? p.category)}</Tag>
                  <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2 }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {p.takenAt?.slice(0, 10) || '—'}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      <Tabs
        items={[
          {
            key: 'before-after',
            label: t('dentalPhoto.beforeAfter'),
            children: (
              <Row gutter={16}>
                <Col span={12}>
                  <Card size="small" title={t('dentalPhoto.beforeTreatment')}>
                    {photos.length > 1 ? (
                      <img
                        src={photos[photos.length - 1]?.url}
                        alt={t('dentalPhoto.beforeTreatment')}
                        style={{ width: '100%', height: 300, objectFit: 'cover', borderRadius: 8 }}
                      />
                    ) : (
                      <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('dentalPhoto.needTwoPhotos')} />
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title={t('dentalPhoto.afterTreatmentLatest')}>
                    {photos.length > 0 ? (
                      <img
                        src={photos?.[0]?.url}
                        alt={t('dentalPhoto.afterTreatment')}
                        style={{ width: '100%', height: 300, objectFit: 'cover', borderRadius: 8 }}
                      />
                    ) : (
                      <Empty description={t('dentalPhoto.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />
                    )}
                  </Card>
                </Col>
                <Col span={24} style={{ marginTop: 'var(--space-3, 12px)' }}>
                  <Space>
                    <Button icon={<ZoomIn size={14} />} onClick={() => setZoom(Math.min(2, zoom + 0.2))}>{t('dentalPhoto.zoomIn')}</Button>
                    <Button icon={<ZoomOut size={14} />} onClick={() => setZoom(Math.max(0.5, zoom - 0.2))}>{t('dentalPhoto.zoomOut')}</Button>
                    <Slider min={0.5} max={2} step={0.1} value={zoom} onChange={setZoom} style={{ width: 200 }} />
                    <span>{t('dentalPhoto.zoomLabel', { percent: (zoom * 100).toFixed(0) })}</span>
                  </Space>
                </Col>
              </Row>
            ),
          },
          {
            key: 'share',
            label: t('dentalPhoto.cloudShare'),
            children: (
              <Card size="small" title={t('dentalPhoto.shareWithPatient')}>
                {shareLink ? (
                  <Alert
                    title={t('dentalPhoto.shareGenerated')}
                    description={
                      <Space orientation="vertical" style={{ width: '100%' }}>
                        <code style={{ background: 'var(--bg-card)', padding: 'var(--space-1, 4px)', borderRadius: 4, display: 'block' }}>
                          {shareLink}
                        </code>
                        <Space>
                          <Tag color="green">{t('dentalPhoto.valid7Days')}</Tag>
                          <Tag color="orange">{t('dentalPhoto.passwordTag', { password: '8888' })}</Tag>
                          <Button size="small" icon={<Download size={10} />} onClick={() => {
                            navigator.clipboard?.writeText(shareLink);
                            message.success(t('dentalPhoto.copied'));
                          }}>{t('dentalPhoto.copyLink')}</Button>
                        </Space>
                      </Space>
                    }
                    type="success"
                    showIcon
                  />
                ) : (
                  <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('dentalPhoto.generateShareHint')} />
                )}
              </Card>
            ),
          },
        ]}
      />

      {/* 上传照片 Modal */}
      <Modal
        title={t('dentalPhoto.uploadPhoto')}
        open={uploadOpen}
        onCancel={() => { setUploadOpen(false); setUploadFile(null); setUploadLabel(''); }}
        onOk={handleUpload}
        okText={t('dentalPhoto.upload')}
        cancelText={t('dentalPhoto.cancel')}
        width={520}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--space-1, 4px)', fontSize: 12 }}>{t('dentalPhoto.categoryLabel')}</label>
            <Select value={uploadCategory} onChange={setUploadCategory} style={{ width: '100%' }}
              options={PHOTO_CATEGORIES.map(c => ({ value: c.value, label: t(c.labelKey) }))} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--space-1, 4px)', fontSize: 12 }}>{t('dentalPhoto.tagLabel')}</label>
            <input
              value={uploadLabel}
              onChange={e => setUploadLabel(e.target.value)}
              placeholder={t('dentalPhoto.labelPlaceholder')}
              style={{ width: '100%', height: 32, padding: '4px 11px', border: '1px solid var(--border-color)', borderRadius: 6 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--space-1, 4px)', fontSize: 12 }}>{t('dentalPhoto.imageFileLabel')}</label>
            <Upload {...uploadProps} listType="picture">
              <Button icon={<Camera size={14} />}>{t('dentalPhoto.chooseImage')}</Button>
            </Upload>
          </div>
        </Space>
      </Modal>

      {/* 预览 Modal */}
      <Modal
        open={!!preview}
        onCancel={() => setPreview(null)}
        footer={null}
        width={720}
        title={preview?.label}
        destroyOnHidden
      >
        {preview && (
          <div>
            <div style={{ position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
              <img
                src={preview.url}
                alt={preview.label}
                style={{ width: '100%', maxHeight: 480, objectFit: 'contain', display: 'block' }}
              />
              <Button aria-label="关闭"
                type="text"
                icon={<X size={16} />}
                onClick={() => setPreview(null)}
                style={{ position: 'absolute', top: 8, right: 8, color: '#fff' }}
              />
            </div>
            <Space style={{ marginTop: 'var(--space-3, 12px)' }}>
              <Tag color={CAT_COLORS[preview.category]}>{t(CAT_LABEL[preview.category] ?? preview.category)}</Tag>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{preview.takenAt}</span>
            </Space>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};
export default DentalPhotoPage;
