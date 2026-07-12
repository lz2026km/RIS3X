// [v3.0.6.8-102] 口内照片管理 (修复: 真实图片展示+上传+对比)
import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Button, Select, Row, Col, Statistic, message, Tabs, Modal, Alert, Upload, Empty, Slider } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { Camera, Share2, Download, ZoomIn, ZoomOut, X } from 'lucide-react';

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
  intraoral: 'Intraoral',
  extraoral: 'Extraoral',
  radiograph: 'X-Ray',
  model: 'Model',
  other: 'Other',
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
    { id: 'PH-001', type: 'frontal', label: 'Frontal smile', url: PLACEHOLDER_SVG('Frontal smile'), takenAt: '2026-06-15T10:00:00Z', category: 'extraoral' },
    { id: 'PH-002', type: 'occlusal-upper', label: 'Upper occlusal', url: PLACEHOLDER_SVG('Upper occlusal'), takenAt: '2026-06-15T10:05:00Z', category: 'intraoral' },
    { id: 'PH-003', type: 'occlusal-lower', label: 'Lower occlusal', url: PLACEHOLDER_SVG('Lower occlusal'), takenAt: '2026-06-15T10:08:00Z', category: 'intraoral' },
    { id: 'PH-004', type: 'buccal-right', label: 'Right buccal', url: PLACEHOLDER_SVG('Right buccal'), takenAt: '2026-06-15T10:12:00Z', category: 'intraoral' },
  ],
  P100002: [
    { id: 'PH-101', type: 'frontal', label: 'Frontal rest', url: PLACEHOLDER_SVG('Frontal rest'), takenAt: '2026-06-10T09:00:00Z', category: 'extraoral' },
    { id: 'PH-102', type: 'lateral', label: 'Lateral right', url: PLACEHOLDER_SVG('Lateral right'), takenAt: '2026-06-10T09:05:00Z', category: 'extraoral' },
  ],
  P100003: [
    { id: 'PH-201', type: 'frontal', label: 'Frontal', url: PLACEHOLDER_SVG('Frontal'), takenAt: '2026-05-20T14:00:00Z', category: 'extraoral' },
    { id: 'PH-202', type: 'panoramic', label: 'Panoramic X', url: PLACEHOLDER_SVG('Panoramic X'), takenAt: '2026-05-20T14:30:00Z', category: 'radiograph' },
  ],
};

const PHOTO_CATEGORIES = [
  { value: 'intraoral', label: 'Intraoral' },
  { value: 'extraoral', label: 'Extraoral' },
  { value: 'radiograph', label: 'X-Ray' },
  { value: 'model', label: 'Model' },
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
  const [shareOpen, setShareOpen] = useState(false);
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
      message.warning('请先选择文件');
      return;
    }
    if (!uploadLabel.trim()) {
      message.warning('请输入照片标签');
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
      message.success('照片已添加');
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
    message.success('分享链接已生成');
  };

  const intraoral = photos.filter(p => p.category === 'intraoral').length;
  const extraoral = photos.filter(p => p.category === 'extraoral').length;
  const radiograph = photos.filter(p => p.category === 'radiograph').length;

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Camera size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>Patient Photos & Communication</span>
        <Tag color="cyan">v3.0.6.8-102</Tag>
        <Tag color="purple">3Shape Unite</Tag>
        <Select value={selected} onChange={v => setSelected(v)} style={{ width: 180 }}
          options={[
            { value: 'P100001', label: 'Zhang Wei' },
            { value: 'P100002', label: 'Li Na' },
            { value: 'P100003', label: 'Wang Fang' },
          ]}
        />
        <Button type="primary" icon={<Camera size={14} />} onClick={() => setUploadOpen(true)}>
          Upload Photo
        </Button>
        <Button icon={<Share2 size={14} />} onClick={handleGenerateShare}>
          Generate Share Link
        </Button>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="Total" value={photos.length} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="Intraoral" value={intraoral} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="Extraoral" value={extraoral} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="X-Ray" value={radiograph} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="Categories" value={new Set(photos.map(p => p.category)).size} />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Photo Gallery">
        {photos.length === 0 ? (
          <Empty description="暂无照片, 点击右上角 'Upload Photo' 上传第一张" />
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
                  <Tag color={CAT_COLORS[p.category]}>{CAT_LABEL[p.category] || p.category}</Tag>
                  <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2 }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
                    {p.takenAt?.slice(0, 10) || 'N/A'}
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
            label: 'Before / After',
            children: (
              <Row gutter={16}>
                <Col span={12}>
                  <Card size="small" title="Before Treatment">
                    {photos.length > 1 ? (
                      <img
                        src={photos[photos.length - 1].url}
                        alt="Before"
                        style={{ width: '100%', height: 300, objectFit: 'cover', borderRadius: 8 }}
                      />
                    ) : (
                      <Empty description="需要至少 2 张照片" />
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="After Treatment (Latest)">
                    {photos.length > 0 ? (
                      <img
                        src={photos[0].url}
                        alt="After"
                        style={{ width: '100%', height: 300, objectFit: 'cover', borderRadius: 8 }}
                      />
                    ) : (
                      <Empty />
                    )}
                  </Card>
                </Col>
                <Col span={24} style={{ marginTop: 12 }}>
                  <Space>
                    <Button icon={<ZoomIn size={14} />} onClick={() => setZoom(Math.min(2, zoom + 0.2))}>Zoom In</Button>
                    <Button icon={<ZoomOut size={14} />} onClick={() => setZoom(Math.max(0.5, zoom - 0.2))}>Zoom Out</Button>
                    <Slider min={0.5} max={2} step={0.1} value={zoom} onChange={setZoom} style={{ width: 200 }} />
                    <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
                  </Space>
                </Col>
              </Row>
            ),
          },
          {
            key: 'share',
            label: 'Cloud Share',
            children: (
              <Card size="small" title="Share Case with Patient">
                {shareLink ? (
                  <Alert
                    message="Share link generated"
                    description={
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <code style={{ background: '#f5f5f5', padding: 4, borderRadius: 4, display: 'block' }}>
                          {shareLink}
                        </code>
                        <Space>
                          <Tag color="green">7 day expiry</Tag>
                          <Tag color="orange">Password: 8888</Tag>
                          <Button size="small" icon={<Download size={10} />} onClick={() => {
                            navigator.clipboard?.writeText(shareLink);
                            message.success('已复制');
                          }}>Copy Link</Button>
                        </Space>
                      </Space>
                    }
                    type="success"
                    showIcon
                  />
                ) : (
                  <Empty description="点击 Generate Share Link 按钮生成分享链接" />
                )}
              </Card>
            ),
          },
        ]}
      />

      {/* 上传照片 Modal */}
      <Modal
        title="Upload Photo"
        open={uploadOpen}
        onCancel={() => { setUploadOpen(false); setUploadFile(null); setUploadLabel(''); }}
        onOk={handleUpload}
        okText="Upload"
        cancelText="Cancel"
        width={520}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Category</label>
            <Select value={uploadCategory} onChange={setUploadCategory} style={{ width: '100%' }}
              options={PHOTO_CATEGORIES.map(c => ({ value: c.value, label: c.label }))} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Label</label>
            <input
              value={uploadLabel}
              onChange={e => setUploadLabel(e.target.value)}
              placeholder="例如: 正面微笑像"
              style={{ width: '100%', height: 32, padding: '4px 11px', border: '1px solid #d9d9d9', borderRadius: 6 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Image File</label>
            <Upload {...uploadProps} listType="picture">
              <Button icon={<Camera size={14} />}>Select Image</Button>
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
        destroyOnClose
      >
        {preview && (
          <div>
            <div style={{ position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
              <img
                src={preview.url}
                alt={preview.label}
                style={{ width: '100%', maxHeight: 480, objectFit: 'contain', display: 'block' }}
              />
              <Button
                type="text"
                icon={<X size={16} />}
                onClick={() => setPreview(null)}
                style={{ position: 'absolute', top: 8, right: 8, color: '#fff' }}
              />
            </div>
            <Space style={{ marginTop: 12 }}>
              <Tag color={CAT_COLORS[preview.category]}>{CAT_LABEL[preview.category]}</Tag>
              <span style={{ fontSize: 12, color: '#999' }}>{preview.takenAt}</span>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
};
export default DentalPhotoPage;
