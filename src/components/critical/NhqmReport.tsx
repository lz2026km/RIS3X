/**
 * G005 RIS v3.0.6.6 - NHQM 国家医疗质量改进目标报表
 * 危急值 15 类目录编码上报
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Tag, Space, Row, Col, Statistic, Table, Progress, Button, Alert, Empty } from 'antd';
import { FileCheck2, Download, Flag, Activity, AlertOctagon, ListTree } from 'lucide-react';
import { nhqmReporter } from '../../services/critical/reporting/NhqmReporter';
import type { NhqmReportSnapshot } from '../../services/critical/reporting/NhqmReporter';

export interface NhqmReportProps {
  quarters?: number;
  onDownload?: (file: { filename: string; mime: string; data: string }) => void;
}

export const NhqmReport: React.FC<NhqmReportProps> = ({ quarters = 4, onDownload }) => {
  const [snapshots, setSnapshots] = useState<NhqmReportSnapshot[]>([]);

  useEffect(() => {
    setSnapshots(nhqmReporter.trend(quarters));
  }, [quarters]);

  const curr = snapshots[snapshots.length - 1];
  const total = useMemo(() => curr?.entries.reduce((a, b) => a + b.eventCount, 0) ?? 0, [curr]);

  const handleDownload = () => {
    if (!curr) return;
    const file = nhqmReporter.exportXml(curr);
    if (onDownload) onDownload(file);
    else {
      const blob = new Blob([file.data], { type: file.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (!curr) return <Empty />;

  return (
    <Card
      size="small"
      data-testid="nhqm-report"
      title={
        <Space>
          <Flag size={16} color="#dc2626" />
          <strong>NHQM 危急值上报报表</strong>
          <Tag color="red">{curr.quarter}</Tag>
          <Tag color="purple">15 类目录</Tag>
        </Space>
      }
      extra={
        <Button size="small" icon={<Download size={12} />} onClick={handleDownload}>
          导出 XML
        </Button>
      }
    >
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Statistic
            title="本季事件总数"
            value={total}
            prefix={<Activity size={14} />}
            styles={{ content: {  fontSize: 22  } }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="上报准备度"
            value={curr.readinessScore}
            suffix="%"
            styles={{ content: {  fontSize: 22, color: curr.readinessScore >= 90 ? '#10b981' : '#f59e0b'  } }}
            prefix={<FileCheck2 size={14} />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="覆盖目录"
            value={curr.entries.filter((e) => e.eventCount > 0).length}
            suffix={`/ ${curr.entries.length}`}
            styles={{ content: {  fontSize: 22  } }}
            prefix={<ListTree size={14} />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="缺项"
            value={curr.missingFields.length}
            styles={{ content: {  fontSize: 22, color: curr.missingFields.length === 0 ? '#10b981' : '#dc2626'  } }}
            prefix={<AlertOctagon size={14} />}
          />
        </Col>
      </Row>

      {curr.missingFields.length > 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={`缺项: ${curr.missingFields.join(', ')}`} />
      )}

      <Table
        size="small"
        rowKey="catalogCode"
        dataSource={curr.entries}
        pagination={false}
        columns={[
          { title: 'NHQM 编码', dataIndex: 'catalogCode', width: 130, render: (v: string) => <Tag color="purple">{v}</Tag> },
          { title: '类别', dataIndex: 'categoryName', width: 100 },
          { title: '事件数', dataIndex: 'eventCount', width: 80 },
          {
            title: '通知及时率',
            dataIndex: 'timelyNotificationRate',
            width: 140,
            render: (v: number) => (
              <Progress
                percent={v}
                size="small"
                strokeColor={v >= 95 ? '#10b981' : v >= 80 ? '#f59e0b' : '#dc2626'}
                format={(p) => `${p}%`}
              />
            ),
          },
          {
            title: '关闭率',
            dataIndex: 'closeLoopRate',
            width: 140,
            render: (v: number) => (
              <Progress
                percent={v}
                size="small"
                strokeColor={v >= 90 ? '#10b981' : v >= 75 ? '#f59e0b' : '#dc2626'}
                format={(p) => `${p}%`}
              />
            ),
          },
        ]}
      />
    </Card>
  );
};

export default NhqmReport;