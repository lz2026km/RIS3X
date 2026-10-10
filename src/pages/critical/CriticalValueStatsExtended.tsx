// [v3.0.6.11-104 Wave 2D] 危急值统计扩展区块
// 接入 GET /criticals/overview · /criticals/daily-trend · /criticals/by-department · /criticals/:id/timeline
import { useCallback, useEffect, useState } from 'react';
import { Select, Space, Steps, Tag, Timeline } from 'antd';
import type { TableColumnsType } from 'antd';
import { AlertOctagon, Building2, Clock, GitBranch, TrendingUp, Zap } from 'lucide-react';
import {
  criticalStatsApi,
  type CriticalDailyTrendDto,
  type CriticalDepartmentStat,
  type CriticalOverviewDto,
  type CriticalTimelineDto,
} from '../../services/api/criticalStatsApi';
import { criticalApi, type CriticalValueDto } from '../../services/api/criticalApi';
import { StatCard, StatCardGrid } from '../../components/common/StatCard';
import { DashboardCard } from '../../components/dashboard/DashboardCard';
import { TrendChart } from '../../components/dashboard/TrendChart';
import { DataTable } from '../../components/common/DataTable';
import { StateView } from '../../components/common/StateView';
import { t } from '../../i18n/appI18n';

export function CriticalValueStatsExtended() {
  const [overview, setOverview] = useState<CriticalOverviewDto | null>(null);
  const [trend, setTrend] = useState<CriticalDailyTrendDto | null>(null);
  const [departments, setDepartments] = useState<CriticalDepartmentStat[]>([]);
  const [criticals, setCriticals] = useState<CriticalValueDto[]>([]);
  const [timelineId, setTimelineId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<CriticalTimelineDto | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [ov, tr, dept, list] = await Promise.all([
      criticalStatsApi.getOverview(),
      criticalStatsApi.getDailyTrend(30),
      criticalStatsApi.getByDepartment(),
      criticalApi.list({ take: 50 }),
    ]);
    if (!ov.success) {
      setError(ov.error?.message ?? t('w2d.loadFailed'));
      setLoading(false);
      return;
    }
    setOverview(ov.data ?? null);
    setTrend(tr.success ? (tr.data ?? null) : null);
    setDepartments(dept.success ? (dept.data?.items ?? []) : []);
    setCriticals(list.success ? (list.data?.items ?? []) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadTimeline = useCallback(async (id: string) => {
    setTimelineId(id);
    setTimelineLoading(true);
    setTimelineError(null);
    const res = await criticalStatsApi.getTimeline(id);
    if (res.success) setTimeline(res.data ?? null);
    else setTimelineError(res.error?.message ?? t('w2d.loadFailed'));
    setTimelineLoading(false);
  }, []);

  const deptColumns: TableColumnsType<CriticalDepartmentStat> = [
    { title: t('w2d.department'), dataIndex: 'department', key: 'department' },
    { title: t('critExt.total'), dataIndex: 'total', key: 'total' },
    { title: t('critExt.success'), dataIndex: 'success', key: 'success' },
    { title: t('critExt.pending'), dataIndex: 'pending', key: 'pending' },
    { title: t('critExt.escalated'), dataIndex: 'escalated', key: 'escalated' },
    { title: t('critExt.successRate'), dataIndex: 'successRate', key: 'successRate', render: (v: number) => `${v}%` },
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
    <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 16 }}>
      <StatCardGrid>
        <StatCard title={t('critExt.total')} value={overview.total} icon={<AlertOctagon size={18} />} color="error" gradient />
        <StatCard title={t('critExt.today')} value={overview.todayCount} color="warning" />
        <StatCard title={t('critExt.unhandled')} value={overview.unhandled} icon={<Zap size={18} />} color={overview.unhandled > 0 ? 'error' : 'success'} />
        <StatCard title={t('critExt.timeout')} value={overview.timeoutCount} icon={<Clock size={18} />} color={overview.timeoutCount > 0 ? 'error' : 'success'} />
        <StatCard title={t('critExt.avgResponse')} value={overview.avgResponseMin} suffix="min" color="info" />
        <StatCard title={t('critExt.avgClose')} value={overview.avgCloseMin} suffix="min" color="success" />
      </StatCardGrid>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DashboardCard title={t('critExt.dailyTrend')} icon={<TrendingUp size={15} />}>
          <TrendChart
            data={(trend?.items ?? []) as unknown as Array<Record<string, string | number>>}
            xKey="date"
            height={220}
            series={[
              { key: 'found', name: t('critExt.found'), color: 'var(--color-error-600)' },
              { key: 'closed', name: t('critExt.closed'), color: 'var(--color-success-600)' },
            ]}
          />
        </DashboardCard>

        <DashboardCard title={t('critExt.byDepartment')} icon={<Building2 size={15} />}>
          <DataTable<CriticalDepartmentStat>
            rowKey="department"
            dataSource={departments}
            columns={deptColumns}
            emptyText={t('w2d.empty')}
          />
        </DashboardCard>
      </div>

      <DashboardCard title={t('critExt.timeline')} icon={<GitBranch size={15} />}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Select
            style={{ width: 360 }}
            placeholder={t('critExt.selectCritical')}
            value={timelineId ?? undefined}
            onChange={(v) => void loadTimeline(v)}
            options={criticals.map((c) => ({ value: c.id, label: `${c.patientName} · ${c.finding}` }))}
          />
          <StateView loading={timelineLoading} error={timelineError} empty={!timeline} emptyDescription={t('critExt.selectCritical')} onRetry={() => timelineId && void loadTimeline(timelineId)}>
            {timeline && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Steps
                  size="small"
                  current={Object.values(timeline.steps).filter(Boolean).length - 1}
                  items={[
                    { title: t('critExt.stepFound') },
                    { title: t('critExt.stepNotified') },
                    { title: t('critExt.stepVoice') },
                    { title: t('critExt.stepAck') },
                    { title: t('critExt.stepReceipt') },
                    { title: t('critExt.stepClosed') },
                  ]}
                />
                {timeline.events.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t('w2d.empty')}</div>
                ) : (
                  <Timeline
                    items={timeline.events.map((e) => ({
                      color: 'red',
                      children: (
                        <div>
                          <Space>
                            <Tag color="red">{e.type}</Tag>
                            <span style={{ fontWeight: 600 }}>{e.label}</span>
                          </Space>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {e.timestamp}
                            {e.actor ? ` · ${e.actor}` : ''}
                          </div>
                          {e.note && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.note}</div>}
                        </div>
                      ),
                    }))}
                  />
                )}
              </Space>
            )}
          </StateView>
        </Space>
      </DashboardCard>
    </Space>
  );
}

export default CriticalValueStatsExtended;
