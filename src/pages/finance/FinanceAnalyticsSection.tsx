// [v3.0.6.11-104 Wave 2D] 财务看板扩展区块
// 接入 GET /finance/overview · /finance/daily-trend · /finance/by-modality · /finance/accounts-receivable
import { useCallback, useEffect, useState } from 'react';
import { Space, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { AlertTriangle, CreditCard, DollarSign, TrendingUp, Wallet } from 'lucide-react';
import {
  financeApi,
  type AccountsReceivableDto,
  type ArAgingBucket,
  type ArTopReceivable,
  type FinanceDailyTrendDto,
  type FinanceModalityDto,
  type FinanceOverviewDto,
} from '../../services/api/financeApi';
import { StatCard, StatCardGrid } from '../../components/common/StatCard';
import { DashboardCard } from '../../components/dashboard/DashboardCard';
import { TrendChart } from '../../components/dashboard/TrendChart';
import { DataTable } from '../../components/common/DataTable';
import { StateView } from '../../components/common/StateView';
import { t } from '../../i18n/appI18n';

const money = (v: number) => `¥${Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function FinanceAnalyticsSection() {
  const [overview, setOverview] = useState<FinanceOverviewDto | null>(null);
  const [trend, setTrend] = useState<FinanceDailyTrendDto | null>(null);
  const [byModality, setByModality] = useState<FinanceModalityDto | null>(null);
  const [ar, setAr] = useState<AccountsReceivableDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [ov, tr, mod, recv] = await Promise.all([
      financeApi.getOverview(),
      financeApi.getDailyTrend(30),
      financeApi.getByModality(),
      financeApi.getAccountsReceivable(),
    ]);
    if (!ov.success) {
      setError(ov.error?.message ?? t('w2d.loadFailed'));
      setLoading(false);
      return;
    }
    setOverview(ov.data ?? null);
    setTrend(tr.success ? (tr.data ?? null) : null);
    setByModality(mod.success ? (mod.data ?? null) : null);
    setAr(recv.success ? (recv.data ?? null) : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const modalityColumns: TableColumnsType<{ modality: string; amount: number; count: number; percent: number }> = [
    { title: t('w2d.modality'), dataIndex: 'modality', key: 'modality' },
    { title: t('finExt.amount'), dataIndex: 'amount', key: 'amount', render: (v: number) => money(v) },
    { title: t('w2d.count'), dataIndex: 'count', key: 'count' },
    { title: t('w2d.percent'), dataIndex: 'percent', key: 'percent', render: (v: number) => `${v}%` },
  ];

  const agingColumns: TableColumnsType<ArAgingBucket> = [
    { title: t('finExt.bucket'), dataIndex: 'label', key: 'label' },
    { title: t('finExt.amount'), dataIndex: 'amount', key: 'amount', render: (v: number) => money(v) },
    { title: t('w2d.count'), dataIndex: 'count', key: 'count' },
  ];

  const topColumns: TableColumnsType<ArTopReceivable> = [
    { title: t('finExt.invoiceNumber'), dataIndex: 'invoiceNumber', key: 'invoiceNumber' },
    { title: t('w2d.patient'), dataIndex: 'patientId', key: 'patientId' },
    { title: t('finExt.amount'), dataIndex: 'amount', key: 'amount', render: (v: number) => money(v) },
    { title: t('w2d.status'), dataIndex: 'status', key: 'status' },
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

  const trendItems = trend?.items ?? [];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <StatCardGrid>
        <StatCard title={t('finExt.income')} value={money(overview.income)} icon={<TrendingUp size={18} />} color="success" gradient />
        <StatCard title={t('finExt.cost')} value={money(overview.cost)} icon={<Wallet size={18} />} color="warning" />
        <StatCard title={t('finExt.profit')} value={money(overview.profit)} icon={<DollarSign size={18} />} color="primary" />
        <StatCard
          title={t('finExt.receivable')}
          value={money(overview.receivable)}
          icon={<CreditCard size={18} />}
          color="error"
          trend={overview.incomeChangePercent !== undefined ? { value: overview.incomeChangePercent, direction: overview.incomeChangePercent >= 0 ? 'up' : 'down' } : undefined}
        />
        <StatCard title={t('finExt.invoiceCount')} value={overview.invoiceCount} color="info" sub={`${t('finExt.paidCount')}: ${overview.paidCount} · ${t('finExt.unpaidCount')}: ${overview.unpaidCount}`} />
      </StatCardGrid>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DashboardCard title={t('finExt.dailyTrend')} icon={<TrendingUp size={15} />}>
          <TrendChart
            data={trendItems as unknown as Array<Record<string, string | number>>}
            xKey="date"
            height={220}
            series={[
              { key: 'income', name: t('finExt.income'), color: 'var(--color-success-600)' },
              { key: 'receivable', name: t('finExt.receivable'), color: 'var(--color-warning-600)' },
            ]}
          />
        </DashboardCard>

        <DashboardCard title={t('finExt.byModality')} icon={<DollarSign size={15} />}>
          <DataTable<{ modality: string; amount: number; count: number; percent: number }>
            rowKey="modality"
            dataSource={byModality?.items ?? []}
            columns={modalityColumns}
            showPagination={false}
            emptyText={t('w2d.empty')}
          />
        </DashboardCard>
      </div>

      <DashboardCard title={t('finExt.ar')} icon={<AlertTriangle size={15} />} extra={ar ? <Tag color={ar.totalReceivable > 0 ? 'error' : 'success'}>{t('finExt.totalReceivable')}: {money(ar.totalReceivable)}</Tag> : null}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <DataTable<ArAgingBucket>
            rowKey="label"
            dataSource={ar?.aging ?? []}
            columns={agingColumns}
            showPagination={false}
            emptyText={t('w2d.empty')}
          />
          <DataTable<ArTopReceivable>
            rowKey="id"
            dataSource={ar?.topReceivables ?? []}
            columns={topColumns}
            showPagination={false}
            emptyText={t('w2d.empty')}
          />
        </div>
      </DashboardCard>
    </Space>
  );
}

export default FinanceAnalyticsSection;
