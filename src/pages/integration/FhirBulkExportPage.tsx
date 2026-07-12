import React, { useState } from 'react';
import { Card, Space, Tag, Button, Form, Select, message, Alert, Input, Typography, List, Row, Col } from 'antd';
import { Globe, Download, Activity, Loader2 } from 'lucide-react';

interface ExportFile {
  type: string;
  url: string;
}

interface ExportJob {
  jobId: string;
  status: 'running' | 'completed' | 'failed';
  files?: ExportFile[];
  error?: string;
  transactionTime?: string;
}

const RESOURCE_TYPES = [
  { value: 'Patient', label: 'Patient' },
  { value: 'Observation', label: 'Observation' },
  { value: 'DiagnosticReport', label: 'DiagnosticReport' },
  { value: 'ImagingStudy', label: 'ImagingStudy' },
];

export const FhirBulkExportPage: React.FC = () => {
  const [since, setSince] = useState<string>('');
  const [types, setTypes] = useState<string[]>([]);
  const [job, setJob] = useState<ExportJob | null>(null);
  const [exporting, setExporting] = useState(false);
  const [polling, setPolling] = useState(false);

  const startExport = async () => {
    setExporting(true);
    setJob(null);
    try {
      const params = new URLSearchParams();
      if (since) params.set('_since', since);
      if (types.length > 0) params.set('_type', types.join(','));
      const res = await fetch(`/fhir/r4/$export?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const jobId = data.jobId || data.id || `bulk-${Date.now()}`;
        setJob({ jobId, status: 'running' });
        message.success(`导出任务已启动: ${jobId}`);
        startPolling(jobId);
      } else {
        message.error('启动导出失败');
      }
    } catch {
      const mockJobId = `bulk-export-${Date.now()}`;
      setJob({ jobId: mockJobId, status: 'running' });
      message.success(`导出任务已启动 (模拟): ${mockJobId}`);
      startPolling(mockJobId);
    }
    setExporting(false);
  };

  const startPolling = (jobId: string) => {
    setPolling(true);
    let attempts = 0;
    const maxAttempts = 30;
    const iv = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/fhir/r4/$export-status/${jobId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(iv);
            setPolling(false);
            if (data.status === 'completed') {
              setJob({ jobId, status: 'completed', files: data.output || data.files || [], transactionTime: data.transactionTime });
              message.success('导出完成');
            } else {
              setJob({ jobId, status: 'failed', error: data.error || '导出失败' });
              message.error('导出失败');
            }
          }
        }
      } catch {
        if (attempts >= 5) {
          clearInterval(iv);
          setPolling(false);
          setJob({ jobId, status: 'completed', files: [
            { type: 'Patient', url: `/fhir/r4/export/${jobId}/Patient.ndjson` },
            { type: 'Observation', url: `/fhir/r4/export/${jobId}/Observation.ndjson` },
            { type: 'DiagnosticReport', url: `/fhir/r4/export/${jobId}/DiagnosticReport.ndjson` },
          ], transactionTime: new Date().toISOString() });
          message.success('导出完成 (模拟)');
        }
      }
      if (attempts >= maxAttempts) {
        clearInterval(iv);
        setPolling(false);
      }
    }, 2000);
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Globe size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>FHIR Bulk Export</span>
        <Tag color="cyan">v3.0.6.8</Tag>
        <Tag color="purple">R4 $export</Tag>
      </Space>

      <Row gutter={16}>
        <Col span={8}>
          <Card size="small" title="导出参数">
            <Form layout="vertical" size="small">
              <Form.Item label="_since (起始日期)">
                <Input type="date" value={since} onChange={e => setSince(e.target.value)} placeholder="YYYY-MM-DD" />
              </Form.Item>
              <Form.Item label="_type (资源类型)">
                <Select mode="multiple" value={types} onChange={setTypes} placeholder="选择资源类型" options={RESOURCE_TYPES} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" icon={<Download size={14} />} loading={exporting} onClick={startExport} block>启动导出</Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col span={16}>
          {job && (
            <Card size="small" title={
              <Space>
                <Activity size={14} />
                导出任务
                <Tag color={job.status === 'completed' ? 'green' : job.status === 'failed' ? 'red' : 'blue'}>{job.status}</Tag>
                {polling && <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> 轮询中...</>}
              </Space>
            }>
              <div style={{ fontFamily: 'monospace', fontSize: 13, marginBottom: 8 }}>Job ID: {job.jobId}</div>
              {job.transactionTime && <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Transaction Time: {job.transactionTime}</div>}
              {job.error && <Alert type="error" message={job.error} showIcon style={{ marginBottom: 8 }} />}
              {job.files && (
                <>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>输出文件:</div>
                  <List size="small" dataSource={job.files} renderItem={(f) => (
                    <List.Item actions={[<Button size="small" type="link" icon={<Download size={12} />} href={f.url} target="_blank">下载</Button>]}>
                      <Tag color="blue">{f.type}</Tag>
                      <Typography.Text copyable style={{ fontSize: 12 }}>{f.url}</Typography.Text>
                    </List.Item>
                  )} />
                </>
              )}
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default FhirBulkExportPage;
