import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Space,
  Tag,
  Button,
  message,
  Alert,
  Collapse,
  Typography,
  Descriptions,
  Badge,
} from "antd";
import { Globe, Download, Activity, Loader2, Eye, FileText } from 'lucide-react';
import { t } from '../../i18n/appI18n';
import { DataTable } from "../../components/common";

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
        message.info(t('fhirExport.loadRemoteFailed'));
      }
    } catch {
      setPreviews(prev => ({ ...prev, [file.type]: DEMO_NDJSON[file.type as keyof typeof DEMO_NDJSON] || '' }));
    }
    setLoadingPreview(prev => ({ ...prev, [file.type]: false }));
  };

  const ndjsonColumns = [
    { title: t('fhirExport.colResourceType'), dataIndex: 'type', key: 'type', render: (rt: string) => <Tag color="blue">{rt}</Tag> },
    { title: t('fhirExport.colFile'), dataIndex: 'url', key: 'url', render: (u: string) => <Typography.Text copyable style={{ fontSize: 12, fontFamily: 'monospace' }}>{u}</Typography.Text> },
    { title: t('fhirExport.colSize'), dataIndex: 'size', key: 'size', render: (s: number) => s ? `${(s / 1024).toFixed(1)} KB` : '-' },
    {
      title: t('fhirExport.colActions'), key: 'actions', render: (_: any, r: NdjsonFile) => (
        <Space>
          <Button size="small" icon={<Eye size={12} />} loading={loadingPreview[r.type]} onClick={() => handlePreview(r)}>{t('fhirExport.preview')}</Button>
          <Button size="small" icon={<Download size={12} />} href={r.url} target="_blank">{t('fhirExport.download')}</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 'var(--space-6, 24px)', background: 'var(--bg-primary)',}}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Globe size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('fhirExport.title')}</span>
        <Tag color="cyan">v3.0.6.8</Tag>
        <Badge status={status.status === 'completed' ? 'success' : status.status === 'failed' ? 'error' : 'processing'} text={status.status} />
      </Space>
      {/* [W2-C] 演示端点标注 */}
      <Alert type="info" showIcon style={{ marginBottom: 'var(--space-3, 12px)' }}
        message={t('fhirExport.demoEndpoint')}
        description={t('fhirExport.demoEndpointDesc')} />

      <Card size="small" title={<Space><Activity size={14} />{t('fhirExport.taskStatus')}</Space>}
        extra={<Space>{status.status === 'running' && <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> {t('fhirExport.polling')}</>}</Space>}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label={t('fhirExport.jobId')}><Typography.Text copyable>{status.jobId}</Typography.Text></Descriptions.Item>
          <Descriptions.Item label={t('fhirExport.status')}>
            <Tag color={status.status === 'completed' ? 'green' : status.status === 'failed' ? 'red' : 'blue'}>{status.status}</Tag>
          </Descriptions.Item>
          {status.transactionTime && <Descriptions.Item label={t('fhirExport.transactionTime')}>{status.transactionTime}</Descriptions.Item>}
          {status.startedAt && <Descriptions.Item label={t('fhirExport.startedAt')}>{status.startedAt}</Descriptions.Item>}
          {status.progress && <Descriptions.Item label={t('fhirExport.progress')}>{status.progress}</Descriptions.Item>}
        </Descriptions>
        {status.error && <Alert type="error" title={status.error} showIcon style={{ marginTop: 'var(--space-2, 8px)' }} />}
      </Card>

      {status.files && status.files.length > 0 && (
        <Card size="small" title={<Space><FileText size={14} />{t('fhirExport.outputFiles', { count: status.files.length })}</Space>} style={{ marginTop: 'var(--space-4, 16px)' }}>
          <DataTable dataSource={status.files} rowKey="url" pagination={false} columns={ndjsonColumns} scroll={{ x: 'max-content' }} />

          <Collapse style={{ marginTop: 'var(--space-3, 12px)' }} items={status.files.map(f => ({
            key: f.type,
            label: <Space><Tag color="blue">{f.type}</Tag>{t('fhirExport.ndjsonPreview')}</Space>,
            children: previews[f.type] ? (
              <pre style={{ fontSize: 11, maxHeight: 400, overflow: 'auto', background: 'var(--bg-card)', padding: 'var(--space-2, 8px)', borderRadius: 4, margin: 0 }}>
                {previews[f.type]}
              </pre>
            ) : (
              <Button size="small" icon={<Eye size={12} />} loading={loadingPreview[f.type]} onClick={() => handlePreview(f)}>{t('fhirExport.loadPreview')}</Button>
            ),
          }))} />
        </Card>
      )}
    </div>
  );
};

export default FhirBulkExportDetailPage;
