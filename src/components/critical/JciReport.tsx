/**
 * G005 RIS v3.0.6.6 - JCI 危急值 KPI 报表组件
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Statistic, Tag, Space, Progress, Button, Table, Empty, Alert } from 'antd';
import { TrendingUp, Target, CheckCircle2, Clock, FileDown, Activity, AlertTriangle, Download } from 'lucide-react';
import { jciReporter } from '../../services/critical/reporting/JciReporter';
import type { JciKpiSnapshot } from '../../services/critical/reporting/JciReporter';

function delta(curr: number, prev: number): { value: number; positive: boolean } {
  if (prev === 0) return { value: 0, positive: true };
  const v = ((curr - prev) / prev) * 100;
  return { value: Math.round(v * 10) / 10, positive: v >= 0 };
}

export interface JciReportProps {
  months?: number;
  onDownload?: (data: { filename: string; mime: string; data: string }) => void;
}

export const JciReport: React.FC<JciReportProps> = ({ months = 6, onDownload }) => {
  const [snapshots, setSnapshots] = useState<JciKpiSnapshot[]>([]);

  useEffect(() => {
    setSnapshots(jciReporter.trend(months));
  }, [months]);

  const curr = snapshots[snapshots.length - 1];
  const prev = snapshots[snapshots.length - 2];

  const targets = useMemo(() => curr?.targets ?? { notifyWithinTarget: 95, closeWithinTarget: 90, dualReviewCompletion: 95 }, [curr]);

  const handleDownload = () => {
    const file = jciReporter.exportCsv(snapshots);
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
      data-testid="jci-report"
      title={
        <Space>
          <Target size={16} color="#7c3aed" />
          <strong>JCI 危急值周转 KPI</strong>
          <Tag color="purple">月度</Tag>
        </Space>
      }
      extra={
        <Button size="small" icon={<Download size={12} />} onClick={handleDownload}>
          导出 CSV
        </Button>
      }
    >
      <Row gutter={12}>
        <Col span={6}>
          <Statistic
            title={`通知及时率 (≥${targets.notifyWithinTarget}%)`}
            value={curr.notifyWithinTarget}
            suffix="%"
            styles={{ content: {  fontSize: 22, color: curr.notifyWithinTarget >= targets.notifyWithinTarget ? '#10b981' : '#dc2626'  } }}
            prefix={curr.notifyWithinTarget >= targets.notifyWithinTarget ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          />
          {prev && (
            <Tag color={delta(curr.notifyWithinTarget, prev.notifyWithinTarget).positive ? 'green' : 'red'} style={{ marginTop: 4 }}>
              <TrendingUp size={10} /> {delta(curr.notifyWithinTarget, prev.notifyWithinTarget).value}%
            </Tag>
          )}
        </Col>
        <Col span={6}>
          <Statistic
            title={`关闭及时率 (≤60min, 目标 ${targets.closeWithinTarget}%)`}
            value={curr.closeWithinTarget}
            suffix="%"
            styles={{ content: {  fontSize: 22, color: curr.closeWithinTarget >= targets.closeWithinTarget ? '#10b981' : '#dc2626'  } }}
            prefix={<Clock size={14} />}
          />
          {prev && (
            <Tag color={delta(curr.closeWithinTarget, prev.closeWithinTarget).positive ? 'green' : 'red'} style={{ marginTop: 4 }}>
              <TrendingUp size={10} /> {delta(curr.closeWithinTarget, prev.closeWithinTarget).value}%
            </Tag>
          )}
        </Col>
        <Col span={6}>
          <Statistic
            title={`双审完成率 (≥${targets.dualReviewCompletion}%)`}
            value={curr.dualReviewCompletion}
            suffix="%"
            styles={{ content: {  fontSize: 22, color: curr.dualReviewCompletion >= targets.dualReviewCompletion ? '#10b981' : '#dc2626'  } }}
            prefix={<CheckCircle2 size={14} />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="中位通知时长"
            value={curr.medianNotifyMinutes}
            suffix="min"
            styles={{ content: {  fontSize: 22  } }}
            prefix={<Activity size={14} />}
          />
          <Tag style={{ marginTop: 4 }}>P95 = {curr.p95NotifyMinutes} min</Tag>
        </Col>
      </Row>

      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col span={12}>
          <Card size="small" type="inner" title="趋势 (近 6 月)">
            {snapshots.length === 0 ? <Empty /> : (
              <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                {snapshots.map((s) => (
                  <div key={s.month}>
                    <Space style={{ width: '100%', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>{s.month}</span>
                      <Tag color="purple">{s.totalEvents} 起</Tag>
                    </Space>
                    <Progress
                      percent={s.notifyWithinTarget}
                      size="small"
                      strokeColor={s.notifyWithinTarget >= 95 ? '#10b981' : '#f59e0b'}
                      format={(p) => `通知 ${p}%`}
                    />
                    <Progress
                      percent={s.closeWithinTarget}
                      size="small"
                      strokeColor={s.closeWithinTarget >= 90 ? '#10b981' : '#f59e0b'}
                      format={(p) => `关闭 ${p}%`}
                    />
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" type="inner" title="明细分项">
            <Table
              size="small"
              rowKey="month"
              dataSource={snapshots}
              pagination={false}
              columns={[
                { title: '月', dataIndex: 'month', width: 90 },
                { title: '总数', dataIndex: 'totalEvents', width: 60 },
                { title: '通知%', dataIndex: 'notifyWithinTarget', width: 70, render: (v: number) => <Tag color={v >= 95 ? 'green' : 'orange'}>{v}</Tag> },
                { title: '关闭%', dataIndex: 'closeWithinTarget', width: 70, render: (v: number) => <Tag color={v >= 90 ? 'green' : 'orange'}>{v}</Tag> },
                { title: 'P95', dataIndex: 'p95NotifyMinutes', width: 70, render: (v: number) => `${v}m` },
                { title: '漏报', dataIndex: 'missedReports', width: 60, render: (v: number) => <Tag color={v > 0 ? 'red' : 'green'}>{v}</Tag> },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {curr.missedReports > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          title={`本月漏报 ${curr.missedReports} 起,请核查 PACS SR 解析与字典匹配`}
        />
      )}
    </Card>
  );
};

export default JciReport;