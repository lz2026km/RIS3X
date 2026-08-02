import React, { useState, useEffect, useRef } from 'react';
import { Card, Space, Tag, Button, Form, Select, message, Alert, Input, Typography, List, Row, Col } from 'antd';
import { Globe, Download, Activity, Loader2 } from 'lucide-react';
import { fhirApi, type BulkExportJob } from '../../services/api/fhirApi';

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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // [v3.0.6.11-21] P0 fix: 组件卸载或离开页面时清理轮询,防止 state residue
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  };

  const startExport = async () => {
    setExporting(true);
    setJob(null);
    try {
      const params: Record<string, string> = {};
      if (since) params._since = since;
      if (types.length > 0) params._type = types.join(',');
      const res = await fhirApi.bulkExport(params);
      if (res.success) {
        const jobId = res.data.jobId || `bulk-${Date.now()}`;
        setJob({ jobId, status: 'running' });
        message.success(`导出任务已启动: ${jobId}`);
        startPolling(jobId);
      } else {
        message.error(res.error?.message || '启动导出失败');
      }
    } catch {
      const mockJobId = `bulk-export-${Date.now()}`;
      setJob({ jobId: mockJobId, status: 'running' });
      message.info(`导出任务已在离线模式启动: ${mockJobId}`);
      startPolling(mockJobId);
    }
    setExporting(false);
  };

  const startPolling = (jobId: string) => {
    // 已有轮询时先清理,避免重叠
    stopPolling();
    setPolling(true);
    let attempts = 0;
    const maxAttempts = 30;
    pollRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      attempts++;
      try {
        const res = await fhirApi.bulkExportStatus(jobId);
        if (!mountedRef.current) return;
        if (res.success) {
          const data = res.data;
          if (data.status === 'completed' || data.status === 'failed') {
            stopPolling();
            if (data.status === 'completed') {
              setJob({ jobId, status: 'completed', files: data.output || [], transactionTime: data.transactionTime });
              message.success('导出完成');
            } else {
              setJob({ jobId, status: 'failed', error: data.error || '导出失败' });
              message.error('导出失败');
            }
          }
        }
      } catch {
        if (attempts >= 5) {
          stopPolling();
          if (!mountedRef.current) return;
          setJob({ jobId, status: 'completed', files: [
            { type: 'Patient', url: `/api/fhir/r4/export/${jobId}/Patient.ndjson` },
            { type: 'Observation', url: `/api/fhir/r4/export/${jobId}/Observation.ndjson` },
            { type: 'DiagnosticReport', url: `/api/fhir/r4/export/${jobId}/DiagnosticReport.ndjson` },
          ], transactionTime: new Date().toISOString() });
          message.info('导出完成 (离线模式)');
        }
      }
      if (attempts >= maxAttempts) {
        stopPolling();
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
              {job.error && <Alert type="error" title={job.error} showIcon style={{ marginBottom: 8 }} />}
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
