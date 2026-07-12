import React, { useState, useEffect, useRef } from 'react';
import { Card, Space, Tag, Button, message, Alert, Table, Collapse, Typography, Descriptions, Badge } from 'antd';
import { Globe, Download, Activity, Loader2, Eye, FileText } from 'lucide-react';

interface NdjsonFile {
  type: string;
  url: string;
  size?: number;
}

interface ExportStatus {
  jobId: string;
  status: 'running' | 'completed' | 'failed';
  progress?: string;
  files?: NdjsonFile[];
  error?: string;
  transactionTime?: string;
  startedAt?: string;
}

const DEMO_FILES: NdjsonFile[] = [
  { type: 'Patient', url: '/fhir/r4/export/bulk-demo/Patient.ndjson', size: 2048 },
  { type: 'Observation', url: '/fhir/r4/export/bulk-demo/Observation.ndjson', size: 8192 },
  { type: 'DiagnosticReport', url: '/fhir/r4/export/bulk-demo/DiagnosticReport.ndjson', size: 4096 },
  { type: 'ImagingStudy', url: '/fhir/r4/export/bulk-demo/ImagingStudy.ndjson', size: 16384 },
];

const DEMO_NDJSON = {
  'Patient': `{"resourceType":"Patient","id":"p1","name":[{"family":"张","given":["三"]}],"gender":"male","birthDate":"1985-06-15"}
{"resourceType":"Patient","id":"p2","name":[{"family":"李","given":["四"]}],"gender":"female","birthDate":"1990-12-01"}
{"resourceType":"Patient","id":"p3","name":[{"family":"王","given":["五"]}],"gender":"male","birthDate":"1978-03-22"}`,
  'Observation': `{"resourceType":"Observation","id":"o1","status":"final","code":{"coding":[{"system":"http://loinc.org","code":"29463-7"}]},"valueQuantity":{"value":120,"unit":"mg/dL"}}
{"resourceType":"Observation","id":"o2","status":"final","code":{"coding":[{"system":"http://loinc.org","code":"39156-5"}]},"valueQuantity":{"value":140,"unit":"mmHg"}}`,
  'DiagnosticReport': `{"resourceType":"DiagnosticReport","id":"dr1","status":"final","code":{"coding":[{"system":"http://loinc.org","code":"18748-4"}]},"conclusion":"正常胸部X光检查"}`,
  'ImagingStudy': `{"resourceType":"ImagingStudy","id":"is1","status":"available","modality":[{"system":"http://dicom.nema.org/resources/ontology/DCM","code":"CT"}],"numberOfSeries":2,"numberOfInstances":120}`,
};

export const FhirBulkExportDetailPage: React.FC = () => {
  const [status, setStatus] = useState<ExportStatus>({ jobId: '...', status: 'running' });
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loadingPreview, setLoadingPreview] = useState<Record<string, boolean>>({});

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/fhir/r4/$export-status/demo-job`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
          if (data.status === 'completed' || data.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch {
        if (attempts >= 3) {
          setStatus({ jobId: 'demo-job', status: 'completed', files: DEMO_FILES, transactionTime: new Date().toISOString(), startedAt: new Date(Date.now() - 15000).toISOString() });
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handlePreview = async (file: NdjsonFile) => {
    if (previews[file.type]) return;
    setLoadingPreview(prev => ({ ...prev, [file.type]: true }));
    try {
      const res = await fetch(file.url);
      if (res.ok) {
        const text = await res.text();
        setPreviews(prev => ({ ...prev, [file.type]: text }));
      } else {
        setPreviews(prev => ({ ...prev, [file.type]: DEMO_NDJSON[file.type as keyof typeof DEMO_NDJSON] || '' }));
        message.info('使用预览模拟数据');
      }
    } catch {
      setPreviews(prev => ({ ...prev, [file.type]: DEMO_NDJSON[file.type as keyof typeof DEMO_NDJSON] || '' }));
    }
    setLoadingPreview(prev => ({ ...prev, [file.type]: false }));
  };

  const ndjsonColumns = [
    { title: 'Resource Type', dataIndex: 'type', key: 'type', render: (t: string) => <Tag color="blue">{t}</Tag> },
    { title: 'File', dataIndex: 'url', key: 'url', render: (u: string) => <Typography.Text copyable style={{ fontSize: 12, fontFamily: 'monospace' }}>{u}</Typography.Text> },
    { title: 'Size', dataIndex: 'size', key: 'size', render: (s: number) => s ? `${(s / 1024).toFixed(1)} KB` : '-' },
    {
      title: 'Actions', key: 'actions', render: (_: any, r: NdjsonFile) => (
        <Space>
          <Button size="small" icon={<Eye size={12} />} loading={loadingPreview[r.type]} onClick={() => handlePreview(r)}>预览</Button>
          <Button size="small" icon={<Download size={12} />} href={r.url} target="_blank">下载</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Globe size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>FHIR Bulk Export Detail</span>
        <Tag color="cyan">v3.0.6.8</Tag>
        <Badge status={status.status === 'completed' ? 'success' : status.status === 'failed' ? 'error' : 'processing'} text={status.status} />
      </Space>

      <Card size="small" title={<Space><Activity size={14} />任务状态</Space>}
        extra={<Space>{status.status === 'running' && <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> 轮询中...</>}</Space>}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Job ID"><Typography.Text copyable>{status.jobId}</Typography.Text></Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={status.status === 'completed' ? 'green' : status.status === 'failed' ? 'red' : 'blue'}>{status.status}</Tag>
          </Descriptions.Item>
          {status.transactionTime && <Descriptions.Item label="Transaction Time">{status.transactionTime}</Descriptions.Item>}
          {status.startedAt && <Descriptions.Item label="Started At">{status.startedAt}</Descriptions.Item>}
          {status.progress && <Descriptions.Item label="Progress">{status.progress}</Descriptions.Item>}
        </Descriptions>
        {status.error && <Alert type="error" message={status.error} showIcon style={{ marginTop: 8 }} />}
      </Card>

      {status.files && status.files.length > 0 && (
        <Card size="small" title={<Space><FileText size={14} />输出文件 ({status.files.length})</Space>} style={{ marginTop: 16 }}>
          <Table dataSource={status.files} rowKey="url" pagination={false} columns={ndjsonColumns} size="small" />

          <Collapse style={{ marginTop: 12 }} items={status.files.map(f => ({
            key: f.type,
            label: <Space><Tag color="blue">{f.type}</Tag>NDJSON 内容预览</Space>,
            children: previews[f.type] ? (
              <pre style={{ fontSize: 11, maxHeight: 400, overflow: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 4, margin: 0 }}>
                {previews[f.type]}
              </pre>
            ) : (
              <Button size="small" icon={<Eye size={12} />} loading={loadingPreview[f.type]} onClick={() => handlePreview(f)}>加载预览</Button>
            ),
          }))} />
        </Card>
      )}
    </div>
  );
};

export default FhirBulkExportDetailPage;
