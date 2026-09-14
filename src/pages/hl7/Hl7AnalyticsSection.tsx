// [v3.0.6.11-104 Wave 2D] HL7 接口监控分析区块
// 接入 GET /hl7/overview · /hl7/error-analysis · /hl7/throughput · /hl7/message-types
import { useCallback, useEffect, useState } from 'react';
import { Space, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { Activity, AlertTriangle, BarChart3, Inbox, ShieldCheck, TrendingUp } from 'lucide-react';
import {
  hl7Api,
  type Hl7ErrorAnalysisDto,
  type Hl7MessageTypeDto,
  type Hl7OverviewDto,
  type Hl7ThroughputPoint,
} from '../../services/api/integrationApi';
import { StatCard, StatCardGrid } from '../../components/common/StatCard';
import { DashboardCard } from '../../components/dashboard/DashboardCard';
import { TrendChart } from '../../components/dashboard/TrendChart';
import { DataTable } from '../../components/common/DataTable';
import { StateView } from '../../components/common/StateView';
import { t } from '../../i18n/appI18n';

export function Hl7AnalyticsSection() {
  const [overview, setOverview] = useState<Hl7OverviewDto | null>(null);
  const [errors, setErrors] = useState<Hl7ErrorAnalysisDto | null>(null);
  const [throughput, setThroughput] = useState<Hl7ThroughputPoint[]>([]);
  const [messageTypes, setMessageTypes] = useState<Hl7MessageTypeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [ov, err, tp, mt] = await Promise.all([
      hl7Api.getOverview(),
      hl7Api.getErrorAnalysis(),
      hl7Api.getThroughput(30),
      hl7Api.getMessageTypes(),
    ]);
    if (!ov.success) {
      setError(ov.error?.message ?? t('w2d.loadFailed'));
      setLoading(false);
      return;
    }
    setOverview(ov.data ?? null);
    setErrors(err.success ? (err.data ?? null) : null);
    setThroughput(tp.success ? (tp.data ?? []) : []);
    setMessageTypes(mt.success ? (mt.data ?? []) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const typeColumns: TableColumnsType<Hl7MessageTypeDto> = [
    { title: t('hl7Ext.messageType'), dataIndex: 'messageType', key: 'messageType' },
    { title: t('hl7Ext.direction'), dataIndex: 'direction', key: 'direction' },
    { title: t('w2d.count'), dataIndex: 'count', key: 'count' },
    { title: t('w2d.percent'), dataIndex: 'percent', key: 'percent', render: (v: number) => `${v}%` },
    { title: t('hl7Ext.avgBytes'), dataIndex: 'avgBytes', key: 'avgBytes' },
  ];

  const errorTypeColumns: TableColumnsType<{ errorType: string; count: number; percent: number }> = [
    { title: t('hl7Ext.errorType'), dataIndex: 'errorType', key: 'errorType' },
    { title: t('w2d.count'), dataIndex: 'count', key: 'count' },
    { title: t('w2d.percent'), dataIndex: 'percent', key: 'percent', render: (v: number) => `${v}%` },
  ];

  if (loading) {
    return <StateView loading skeletonRows={6} />;
  }
  if (error) {
    return <StateView error={error} onRetry={() => void load()} />;
  }
  if (!overview) {
    return <StateView empty emptyDescription={t('w2d.empty')} />;
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <StatCardGrid>
        <StatCard
          title={t('hl7Ext.totalMessages')}
          value={overview.totalMessages}
          icon={<Inbox size={18} />}
          color="primary"
          gradient
          sub={`${t('hl7Ext.todayMessages')}: ${overview.todayMessages}`}
        />
        <StatCard title={t('hl7Ext.inbound')} value={overview.inboundCount} color="info" />
        <StatCard title={t('hl7Ext.outbound')} value={overview.outboundCount} color="success" />
        <StatCard
          title={t('hl7Ext.successRate')}
          value={overview.successRate}
          suffix="%"
          icon={<ShieldCheck size={18} />}
          color={overview.successRate >= 95 ? 'success' : 'warning'}
        />
        <StatCard
          title={t('hl7Ext.failed')}
          value={overview.failedCount}
          icon={<AlertTriangle size={18} />}
          color={overview.failedCount > 0 ? 'error' : 'success'}
        />
      </StatCardGrid>

      <DashboardCard
        title={t('hl7Ext.throughput')}
        icon={<TrendingUp size={15} />}
        extra={overview.seeded ? <Tag color="default">{t('w2d.seeded')}</Tag> : null}
      >
        <TrendChart
          data={throughput as unknown as Array<Record<string, string | number>>}
          xKey="label"
          type="bar"
          percent
          height={240}
          series={[
            { key: 'success', name: t('hl7Ext.success'), color: '#16a34a' },
            { key: 'failed', name: t('hl7Ext.failed'), color: '#dc2626' },
          ]}
        />
      </DashboardCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DashboardCard title={t('hl7Ext.messageTypes')} icon={<BarChart3 size={15} />}>
          <DataTable<Hl7MessageTypeDto>
            rowKey="messageType"
            dataSource={messageTypes}
            columns={typeColumns}
            showPagination={false}
            emptyText={t('w2d.empty')}
          />
        </DashboardCard>

        <DashboardCard title={t('hl7Ext.errorAnalysis')} icon={<Activity size={15} />}>
          <DataTable<{ errorType: string; count: number; percent: number }>
            rowKey="errorType"
            dataSource={errors?.byErrorType ?? []}
            columns={errorTypeColumns}
            showPagination={false}
            emptyText={t('w2d.empty')}
          />
        </DashboardCard>
      </div>

      {errors && errors.recentErrors.length > 0 && (
        <DashboardCard title={t('hl7Ext.recentErrors')} icon={<AlertTriangle size={15} />}>
          <DataTable<{ id: string; messageType: string; ackStatus: string; createdAt: string }>
            rowKey="id"
            dataSource={errors.recentErrors}
            columns={[
              { title: t('hl7Ext.messageType'), dataIndex: 'messageType', key: 'messageType' },
              { title: 'ACK', dataIndex: 'ackStatus', key: 'ackStatus' },
              { title: t('w2d.time'), dataIndex: 'createdAt', key: 'createdAt' },
            ]}
            emptyText={t('w2d.empty')}
          />
        </DashboardCard>
      )}
    </Space>
  );
}

export default Hl7AnalyticsSection;
