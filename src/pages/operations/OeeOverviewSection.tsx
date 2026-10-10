// [v3.0.6.11-104 Wave 2D] OEE 运维总览区块
// 接入 GET /oee/overview · /oee/by-modality · /oee/daily-trend · /oee/:id/downtime-analysis
import { useCallback, useEffect, useState } from 'react';
import { Select, Space, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { Activity, Clock, Gauge, ShieldCheck, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import {
  oeeApi,
  type DowntimeAnalysisDto,
  type OeeDailyTrendPoint,
  type OeeDeviceMetric,
  type OeeModalityDto,
  type OeeOverviewDto,
} from '../../services/api/oeeApi';
import { StatCard, StatCardGrid } from '../../components/common/StatCard';
import { DashboardCard } from '../../components/dashboard/DashboardCard';
import { TrendChart } from '../../components/dashboard/TrendChart';
import { DataTable } from '../../components/common/DataTable';
import { StateView } from '../../components/common/StateView';
import { t } from '../../i18n/appI18n';

const oeeColor = (v: number) => (v < 60 ? 'error' : v < 85 ? 'warning' : 'success');

export function OeeOverviewSection() {
  const [overview, setOverview] = useState<OeeOverviewDto | null>(null);
  const [byModality, setByModality] = useState<OeeModalityDto[]>([]);
  const [trend, setTrend] = useState<OeeDailyTrendPoint[]>([]);
  const [devices, setDevices] = useState<OeeDeviceMetric[]>([]);
  const [downtimeId, setDowntimeId] = useState<string | null>(null);
  const [downtime, setDowntime] = useState<DowntimeAnalysisDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [ov, mod, tr, list] = await Promise.all([
      oeeApi.getOverview(),
      oeeApi.getByModality(),
      oeeApi.getDailyTrend(30),
      oeeApi.list(),
    ]);
    if (!ov.success) {
      setError(ov.error?.message ?? t('w2d.loadFailed'));
      setLoading(false);
      return;
    }
    setOverview(ov.data ?? null);
    setByModality(mod.success ? (mod.data ?? []) : []);
    setTrend(tr.success ? (tr.data ?? []) : []);
    setDevices(list.success ? (list.data ?? []) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDowntime = useCallback(async (id: string) => {
    setDowntimeId(id);
    const res = await oeeApi.getDowntimeAnalysis(id);
    setDowntime(res.success ? res.data : null);
  }, []);

  const modalityColumns: TableColumnsType<OeeModalityDto> = [
    { title: t('w2d.modality'), dataIndex: 'modality', key: 'modality' },
    { title: t('oeeExt.deviceCount'), dataIndex: 'deviceCount', key: 'deviceCount' },
    {
      title: t('oeeExt.avgOee'),
      dataIndex: 'avgOee',
      key: 'avgOee',
      render: (v: number) => `${v}%`,
    },
    { title: t('oeeExt.availability'), dataIndex: 'avgAvailability', key: 'avgAvailability', render: (v: number) => `${v}%` },
    { title: t('oeeExt.performance'), dataIndex: 'avgPerformance', key: 'avgPerformance', render: (v: number) => `${v}%` },
    { title: t('oeeExt.quality'), dataIndex: 'avgQuality', key: 'avgQuality', render: (v: number) => `${v}%` },
    { title: t('oeeExt.bestDevice'), dataIndex: 'bestDevice', key: 'bestDevice' },
    { title: t('oeeExt.worstDevice'), dataIndex: 'worstDevice', key: 'worstDevice' },
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
    <Space direction="vertical" size={16} style={{ width: '100%', marginBottom: 16 }}>
      <StatCardGrid>
        <StatCard
          title={t('oeeExt.avgOee')}
          value={overview.avgOee}
          suffix="%"
          icon={<Gauge size={18} />}
          color={oeeColor(overview.avgOee)}
          gradient
        />
        <StatCard title={t('oeeExt.availability')} value={overview.avgAvailability} suffix="%" icon={<Clock size={18} />} color="primary" />
        <StatCard title={t('oeeExt.performance')} value={overview.avgPerformance} suffix="%" icon={<Zap size={18} />} color="info" />
        <StatCard title={t('oeeExt.quality')} value={overview.avgQuality} suffix="%" icon={<ShieldCheck size={18} />} color="success" />
        <StatCard
          title={t('oeeExt.totalDevices')}
          value={overview.totalDevices}
          icon={<Activity size={18} />}
          color="warning"
          sub={`${t('oeeExt.totalModalities')}: ${overview.totalModalities}`}
        />
      </StatCardGrid>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DashboardCard
          title={t('oeeExt.dailyTrend')}
          icon={<TrendingUp size={15} />}
          extra={overview.seeded ? <Tag color="default">{t('w2d.seeded')}</Tag> : null}
        >
          <TrendChart
            data={trend as unknown as Array<Record<string, string | number>>}
            xKey="label"
            percent
            height={220}
            series={[
              { key: 'oee', name: t('oeeExt.avgOee'), color: '#2563eb' },
              { key: 'availability', name: t('oeeExt.availability'), color: '#16a34a' },
              { key: 'performance', name: t('oeeExt.performance'), color: '#d97706' },
            ]}
          />
        </DashboardCard>

        <DashboardCard title={t('oeeExt.downtime')} icon={<TrendingDown size={15} />}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Select
              style={{ width: '100%' }}
              placeholder={t('oeeExt.selectDevice')}
              value={downtimeId ?? undefined}
              onChange={(v) => void loadDowntime(v)}
              options={devices.map((d) => ({ value: d.id, label: `${d.name} (${d.id})` }))}
            />
            {downtime ? (
              <>
                <Space wrap>
                  <Tag color="red">
                    {t('oeeExt.totalDowntime')}: {downtime.totalDowntimeMinutes} min
                  </Tag>
                  <Tag color="orange">
                    {t('oeeExt.planned')}: {downtime.plannedMinutes} min
                  </Tag>
                  <Tag color="volcano">
                    {t('oeeExt.unplanned')}: {downtime.unplannedMinutes} min
                  </Tag>
                </Space>
                <DataTable<{ reason: string; reasonZh: string; durationMinutes: number; durationHours: number; percent: number }>
                  rowKey="reason"
                  showPagination={false}
                  emptyText={t('w2d.empty')}
                  dataSource={downtime.reasons}
                  columns={[
                    { title: t('oeeExt.reason'), dataIndex: 'reasonZh', key: 'reasonZh' },
                    { title: `${t('oeeExt.duration')} (h)`, dataIndex: 'durationHours', key: 'durationHours' },
                    { title: t('w2d.percent'), dataIndex: 'percent', key: 'percent', render: (v: number) => `${v}%` },
                  ]}
                />
              </>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
                {t('oeeExt.selectDevice')}
              </div>
            )}
          </Space>
        </DashboardCard>
      </div>

      <DashboardCard title={t('oeeExt.byModality')} icon={<Gauge size={15} />}>
        <DataTable<OeeModalityDto>
          rowKey="modality"
          dataSource={byModality}
          columns={modalityColumns}
          emptyText={t('w2d.empty')}
        />
      </DashboardCard>
    </Space>
  );
}

export default OeeOverviewSection;
