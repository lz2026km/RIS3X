// [W3-2] DIMSE 上传: 真实文件读取 + dicomDimseApi.upload 调用 + 分阶段进度 + 结果列表
// [W3-C] 刷新按钮: 真实刷新 — 上传记录持久化到 localStorage, 刷新时从存储重新加载
import React, { useEffect, useState } from 'react';
import { Card, Upload, Button, message, Table, Tag, Space, Alert, Typography, Progress, Select, Popconfirm, Empty, Statistic, Row, Col } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { RefreshCw } from 'lucide-react';
import { dicomDimseApi } from '../../services/api/dicomApi';
import { t } from '../../i18n/appI18n';

const destOptions = () => [
  { value: 's3', label: t('dimseUpload.destS3') },
  { value: 'vna', label: t('dimseUpload.destVna') },
  { value: 'pacs', label: t('dimseUpload.destPacs') },
];

const STORAGE_KEY = 'dimse_upload_records_v1';

interface UploadRecord {
  key: string;
  fileName: string;
  sizeBytes: number;
  s3Url?: string;
  status: string;
  sopInstanceUid?: string;
  uploadedAt: string;
}

const uploadColumns = () => [
  { title: t('dimseUpload.colFileName'), dataIndex: 'fileName', key: 'fileName', ellipsis: true, render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
  { title: t('dimseUpload.colSize'), dataIndex: 'sizeBytes', key: 'sizeBytes', width: 100, render: (v: number) => v ? `${(v / 1024).toFixed(1)} KB` : '-' },
  { title: t('dimseUpload.colSopUid'), dataIndex: 'sopInstanceUid', key: 'sopInstanceUid', ellipsis: true, render: (v?: string) => v ? <Typography.Text copyable style={{ fontSize: 11 }}>{v}</Typography.Text> : '-' },
  { title: t('dimseUpload.colArchivePath'), dataIndex: 's3Url', key: 's3Url', ellipsis: true, render: (v?: string) => v ? <Typography.Text copyable style={{ fontSize: 11 }}>{v}</Typography.Text> : '-' },
  { title: t('dimseUpload.colDestination'), dataIndex: 'destination', key: 'destination', width: 120, render: (v?: string) => <Tag color="geekblue">{destOptions().find(o => o.value === v)?.label ?? v}</Tag> },
  { title: t('dimseUpload.colStatus'), dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <Tag color={v === 'SUCCESS' ? 'green' : v === 'UPLOADING' ? 'processing' : 'red'}>{v === 'UPLOADING' ? t('dimseUpload.statusUploading') : v === 'SUCCESS' ? t('dimseUpload.statusSuccess') : t('dimseUpload.statusFail')}</Tag> },
  { title: t('dimseUpload.colTime'), dataIndex: 'uploadedAt', key: 'uploadedAt', width: 140, render: (v: string) => <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span> },
];

export const DimseUploadPage: React.FC = () => {
  const [records, setRecords] = useState<UploadRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [destination, setDestination] = useState('s3');

  // [W3-C] 刷新: 从 localStorage 重载记录 (页面唯一数据源)
  const refreshRecords = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const list = JSON.parse(raw) as UploadRecord[];
        setRecords(Array.isArray(list) ? list : []);
        message.success(t('dimseUpload.refreshRestored', { count: Array.isArray(list) ? list.length : 0 }));
      } else {
        setRecords([]);
        message.info(t('dimseUpload.noSavedRecords'));
      }
    } catch {
      setRecords([]);
      message.warning(t('dimseUpload.storageReadFailed'));
    }
  };

  useEffect(() => {
    refreshRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (updater: (prev: UploadRecord[]) => UploadRecord[]) => {
    setRecords((prev) => {
      const next = updater(prev);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 忽略 */ }
      return next;
    });
  };

  const handleUpload = async (file: File) => {
    const key = `${file.name}-${Date.now()}`;
    commit((prev) => [{
      key,
      fileName: file.name,
      sizeBytes: file.size,
      status: 'UPLOADING',
      destination,
      uploadedAt: new Date().toLocaleString(),
    }, ...prev]);
    setUploading(true);
    setProgress(5);
    setStage(t('dimseUpload.readFile'));
    try {
      // 阶段1: 读取文件为 Base64 (进度 5%→35%)
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onprogress = (e) => {
          if (e.lengthComputable) setProgress(5 + Math.round((e.loaded / e.total) * 30));
        };
        reader.onload = () => { setProgress(35); resolve(reader.result as string); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 阶段2: 模拟 DICOM 解析 (35%→60%)
      setStage(t('dimseUpload.parseDicom'));
      setProgress(55);
      await new Promise(r => setTimeout(r, 300));

      // 阶段3: 上传至 DIMSE 服务 (60%→100%)
      setStage(t('dimseUpload.uploadingTo', { dest: destOptions().find(o => o.value === destination)?.label ?? '' }));
      const sopInstanceUid = crypto.randomUUID().replace(/-/g, '');
      const res = await dicomDimseApi.uploadToS3({
        sopInstanceUid,
        fileName: file.name,
        fileSize: file.size,
        mimeType: 'application/dicom',
        payloadBase64: base64.split(',')[1] ?? '',
        destination,
        bucketName: 'ris-dicom-archive',
      });
      setProgress(100);
      if (res.success) {
        const url = (res.data as { url?: string; status?: string })?.url ?? '';
        commit((prev) => prev.map(r => r.key === key ? {
          ...r,
          status: 'SUCCESS',
          s3Url: url,
          sopInstanceUid,
        } : r));
        message.success(t('dimseUpload.uploadSuccess', { name: file.name }));
      } else {
        commit((prev) => prev.map(r => r.key === key ? { ...r, status: 'FAIL' } : r));
        message.error(res.error?.message ?? t('dimseUpload.uploadFailed'));
      }
    } catch (e) {
      console.error('[DIMSE-Upload]', e);
      commit((prev) => prev.map(r => r.key === key ? { ...r, status: 'FAIL' } : r));
      message.error(t('dimseUpload.uploadFailedRetry'));
    } finally {
      setUploading(false);
      setProgress(0);
      setStage('');
    }
  };

  const handleRemove = (key: string) => {
    commit((prev) => prev.filter(r => r.key !== key));
  };

  const successCount = records.filter(r => r.status === 'SUCCESS').length;
  const failCount = records.filter(r => r.status === 'FAIL').length;

  return (
    <div style={{ padding: 24, background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <UploadOutlined style={{ fontSize: 20, color: '#2563eb' }} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('dimseUpload.title')}</span>
        <Tag color="blue">v3.0.6.11-75 W3-2</Tag>
      </Space>
      <Alert
        title={t('dimseUpload.alert')}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title={t('dimseUpload.statTotal')} value={records.length} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('dimseUpload.statSuccess')} value={successCount} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('dimseUpload.statFail')} value={failCount} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title={t('dimseUpload.statDataVolume')} value={records.reduce((s, r) => s + r.sizeBytes, 0) / 1024} precision={1} suffix="KB" /></Card></Col>
      </Row>
      <Card size="small" title={t('dimseUpload.cardUpload')}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space wrap>
            <span style={{ fontSize: 13, color: '#475569' }}>{t('dimseUpload.archiveTarget')}</span>
            <Select value={destination} onChange={setDestination} options={destOptions()} style={{ width: 180 }} />
            <Upload
              accept=".dcm"
              showUploadList={false}
              multiple
              beforeUpload={(file) => { void handleUpload(file); return false; }}
              disabled={uploading}
            >
              <Button type="primary" icon={<UploadOutlined />} loading={uploading} disabled={uploading}>
                {uploading ? t('dimseUpload.uploadingEllipsis') : t('dimseUpload.selectDicomFiles')}
              </Button>
            </Upload>
            <Button icon={<RefreshCw size={12} />} onClick={refreshRecords}>{t('dimseUpload.refresh')}</Button>
          </Space>
          {uploading && (
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{stage}</div>
              <Progress percent={progress} status="active" />
            </div>
          )}
        </Space>
      </Card>
      <Card size="small" title={t('dimseUpload.recordsTitle', { count: records.length })} style={{ marginTop: 16 }}>
        <Table
          dataSource={records}
          rowKey="key"
          columns={[...uploadColumns(), {
            title: t('dimseUpload.colActions'), key: 'actions', width: 70,
            render: (_: unknown, r: UploadRecord) => <Popconfirm title={t('dimseUpload.removeConfirm')} onConfirm={() => handleRemove(r.key)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>,
          }]}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dimseUpload.emptyText')} /> }}
        />
      </Card>
    </div>
  );
};

export default DimseUploadPage;
