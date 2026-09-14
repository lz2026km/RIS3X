// [v3.0.6.11-104 Wave 2D] 检查室占用扩展总览区块
// 接入 GET /occupancy/overview · /occupancy/daily-trend · /occupancy/by-shift
import { useCallback, useEffect, useState } from 'react';
import { Space, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { Activity, AlertTriangle, Clock, Layers, TrendingUp } from 'lucide-react';
import {
  occupancyApi,
  type OccupancyDailyPoint,
  type OccupancyOverviewDto,
  type ShiftStatDto,
} from '../../services/api/occupancyApi';
import { StatCard, StatCardGrid } from '../../components/common/StatCard';
import { DashboardCard } from '../../components/dashboard/DashboardCard';
import { TrendChart } from '../../components/dashboard/TrendChart';
import { DataTable } from '../../components/common/DataTable';
import { StateView } from '../../components/common/StateView';
import { t } from '../../i18n/appI18n';

const SHIFT_LABEL: Record<string, string> = {
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
  night: 'night',
};

export function RoomOccupancyExtendedSection() {
  const [overview, setOverview] = useState<OccupancyOverviewDto | null>(null);
  const [trend, setTrend] = useState<OccupancyDailyPoint[]>([]);
  const [shifts, setShifts] = useState<ShiftStatDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [ov, tr, sh] = await Promise.all([
      occupancyApi.getOverview(),
      occupancyApi.getDailyTrend(7),
      occupancyApi.getByShift(),
    ]);
    if (!ov.success) {
      setError(ov.error?.message ?? t('w2d.loadFailed'));
      setLoading(false);
      return;
    }
    setOverview(ov.data ?? null);
    setTrend(tr.success ? (tr.data ?? []) : []);
    setShifts(sh.success ? (sh.data ?? []) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shiftColumns: TableColumnsType<ShiftStatDto> = [
    {
      title: t('occExt.shift'),
      dataIndex: 'shift',
      key: 'shift',
      render: (_v: string, row) => t(`occExt.${SHIFT_LABEL[row.shift] ?? 'morning'}`),
    },
    { title: t('occExt.timeRange'), dataIndex: 'timeRange', key: 'timeRange' },
    { title: t('occExt.occupancyRate'), dataIndex: 'occupancyRate', key: 'occupancyRate', render: (v: number) => `${v}%` },
    { title: t('occExt.exams'), dataIndex: 'exams', key: 'exams' },
    { title: t('occExt.avgSessionMinutes'), dataIndex: 'avgSessionMinutes', key: 'avgSessionMinutes', render: (v: number) => `${v} min` },
  ];

  if (loading) {
    return <StateView loading skeletonRows={5} />;
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
        <StatCard title={t('occExt.totalRooms')} value={overview.totalRooms} icon={<Layers size={18} />} color="primary" />
        <StatCard
          title={t('occExt.occupancyRate')}
          value={overview.occupancyRate}
          suffix="%"
          icon={<Activity size={18} />}
          color={overview.occupancyRate > 80 ? 'error' : 'success'}
          gradient
        />
        <StatCard title={t('occExt.occupied')} value={overview.occupiedRooms} icon={<Activity size={18} />} color="info" />
        <StatCard title={t('occExt.idle')} value={overview.idleRooms} color="success" />
        <StatCard title={t('occExt.todayExams')} value={overview.todayExams} color="primary" />
        <StatCard
          title={t('occExt.overdue')}
          value={overview.overdueRooms}
          icon={<AlertTriangle size={18} />}
          color={overview.overdueRooms > 0 ? 'error' : 'success'}
        />
      </StatCardGrid>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DashboardCard
          title={t('occExt.dailyTrend')}
          icon={<TrendingUp size={15} />}
          extra={overview.seeded ? <Tag color="default">{t('w2d.seeded')}</Tag> : null}
        >
          <TrendChart
            data={trend as unknown as Array<Record<string, string | number>>}
            xKey="label"
            percent
            height={220}
            series={[
              { key: 'occupancyRate', name: t('occExt.occupancyRate'), color: '#2563eb' },
              { key: 'exams', name: t('occExt.exams'), color: '#16a34a' },
            ]}
          />
        </DashboardCard>

        <DashboardCard title={t('occExt.byShift')} icon={<Clock size={15} />}>
          <DataTable<ShiftStatDto>
            rowKey="shift"
            dataSource={shifts}
            columns={shiftColumns}
            showPagination={false}
            emptyText={t('w2d.empty')}
          />
        </DashboardCard>
      </div>
    </Space>
  );
}

export default RoomOccupancyExtendedSection;
