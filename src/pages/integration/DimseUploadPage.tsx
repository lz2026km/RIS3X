import React, { useState } from 'react';
import { Card, Upload, Button, message, Table, Tag, Space, Alert, Typography } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { dicomDimseApi } from '../../services/api/dicomApi';

const UPLOAD_COLUMNS = [
  { title: 'File Name', dataIndex: 'fileName', key: 'fileName' },
  { title: 'Size', dataIndex: 'sizeBytes', key: 'sizeBytes', render: (v: number) => v ? `${(v / 1024).toFixed(1)} KB` : '-' },
  { title: 'S3 URL', dataIndex: 's3Url', key: 's3Url', ellipsis: true, render: (v: string) => v ? <Typography.Text copyable style={{ fontSize: 12 }}>{v}</Typography.Text> : '-' },
  { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'SUCCESS' ? 'green' : 'red'}>{v}</Tag> },
];

export const DimseUploadPage: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const body = {
        sopInstanceUid: crypto.randomUUID(),
        bucketName: undefined,
        endpoint: undefined,
        accessKey: undefined,
        secretKey: undefined,
        region: undefined,
      };
      const res = await dicomDimseApi.uploadToS3(body);
      if (res.success) {
        setRecords(prev => [...prev, { fileName: file.name, sizeBytes: file.size, s3Url: res.data?.message || '', status: res.data?.status || 'SUCCESS' }]);
        message.success('S3 upload successful');
      } else {
        setRecords(prev => [...prev, { fileName: file.name, sizeBytes: file.size, s3Url: '', status: 'FAIL' }]);
        message.error(res.error?.message || 'Upload failed');
      }
    } catch {
      setRecords(prev => [...prev, { fileName: file.name, sizeBytes: file.size, s3Url: '', status: 'FAIL' }]);
      message.error('Upload failed');
    }
    setUploading(false);
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <UploadOutlined style={{ fontSize: 20, color: '#1677ff' }} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>DICOM S3 归档上传</span>
        <Tag color="blue">v3.0</Tag>
      </Space>
      <Alert
        title="上传 DICOM 文件至 S3 兼容对象存储，支持标准 .dcm 格式文件"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Card size="small" title="文件上传">
        <Upload
          accept=".dcm"
          showUploadList={false}
          beforeUpload={(file) => { handleUpload(file); return false; }}
          disabled={uploading}
        >
          <Button icon={<UploadOutlined />} loading={uploading} disabled={uploading}>
            上传到 S3
          </Button>
        </Upload>
      </Card>
      <Card size="small" title="上传记录" style={{ marginTop: 16 }}>
        <Table
          dataSource={records}
          rowKey={(r, i) => `${r.fileName}-${i}`}
          columns={UPLOAD_COLUMNS}
          pagination={false}
          locale={{ emptyText: '暂无上传记录' }}
        />
      </Card>
    </div>
  );
};

export default DimseUploadPage;
