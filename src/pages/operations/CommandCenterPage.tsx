// @deprecated [v3.0.6.11-104 Wave 5C] 已收敛至 OperationsCenterPage (/operations-center); 旧路由 /command-center redirect 兼容。文件保留供回滚参考。
// [v3.0.6.11-54] Phase 2: 全院运营指挥中心 (实时状态 + 事件流 + 趋势)
import { deviceApi } from '../../services/api/deviceApi';
import { notificationsApi, type NotificationDto } from '../../services/api/notificationsApi';
import { statsApi } from '../../services/api/statsApi';
import {
  Card, Space, Tag, Button, Row, Col, List, Alert, Badge,
  Progress, Spin, Empty, Typography,
} from 'antd';
import {
  Activity,
  Bell,
  TrendingUp,
  Monitor,
  CheckCircle2,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '../../i18n/appI18n';
import { StatCard, StatCardGrid } from '../../components/common';

const { Text } = Typography;

const TYPE_COLOR: Record<string, string> = {
  INFO: 'blue', WARNING: 'orange', ERROR: 'red', CRITICAL: 'volcano',
};

export const CommandCenterPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState('today');
  const [dash, setDash] = useState<any>(null);
  const [daily, setDaily] = useState<any>(null);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [notifPage, setNotifPage] = useState(1);
  const [notifTotal, setNotifTotal] = useState(0);
  const NOTIF_PAGE_SIZE = 12;
  const [deviceStats, setDeviceStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (page: number = notifPage) => {
    setLoading(true);
    setError('');
    try {
      const days = timeRange === 'today' ? 1 : timeRange === 'week' ? 7 : 30;
      const [dashRes, trendRes, notifRes, devRes] = await Promise.allSettled([
        statsApi.getDashboard(),
        statsApi.getTrend(days),
        notificationsApi.list({ page, pageSize: NOTIF_PAGE_SIZE }),
        deviceApi.getTodayStats(),
      ]);
      if (dashRes.status === 'fulfilled' && dashRes.value.success) setDash(dashRes.value.data);
      if (trendRes.status === 'fulfilled' && trendRes.value.success) setDaily(trendRes.value.data);
      if (notifRes.status === 'fulfilled' && notifRes.value.success) {
        const payload = notifRes.value.data as unknown;
        const items = Array.isArray(payload)
          ? payload as NotificationDto[]
          : ((payload as { items?: NotificationDto[] })?.items ?? []);
        setNotifications(items);
        const meta = (payload as { meta?: { total?: number }; total?: number });
        setNotifTotal(meta?.total ?? meta?.meta?.total ?? items.length);
      }
      if (devRes.status === 'fulfilled' && devRes.value.success) setDeviceStats(devRes.value.data);
      if (dashRes.status === 'fulfilled' && !dashRes.value.success) {
        setError(dashRes.value.error?.message ?? '');
      }
    } catch (e) {
      setError((e as Error)?.message ?? t('commandCenter.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [timeRange, notifPage]);

  useEffect(() => {
    void load(notifPage);
  }, [load, notifPage]);

  const trend = useMemo(() => {
    const data = Array.isArray(daily) ? daily : [];
    if (timeRange === 'today') {
      const last = data[data.length - 1];
      return [{ label: last?.date?.slice(5) ?? t('commandCenter.today'), count: last?.examCount ?? dash?.today?.exams ?? 0 }];
    }
    const bucket = timeRange === 'week' ? 1 : 5;
    const result: { label: string; count: number }[] = [];
    for (let i = 0; i < data.length; i += bucket) {
      const slice = data.slice(i, i + bucket);
      result.push({
        label: slice[0]?.date?.slice(5) ?? '',
        count: slice.reduce((s, d) => s + (d.examCount ?? 0), 0),
      });
    }
    return result;
  }, [daily, timeRange, dash]);

  const maxTrend = Math.max(1, ...trend.map((tr) => tr.count));

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)',}}>
      <Space style={{ marginBottom: 16 }}>
        <BarChart3 size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('commandCenter.title')}</span>
        <Tag color="cyan">{t('commandCenter.realtime')}</Tag>
        <Space>
          {['today', 'week', 'month'].map((tr) =>
            <Button key={tr} type={timeRange === tr ? 'primary' : 'default'} size="small" onClick={() => { setNotifPage(1); setTimeRange(tr); }}>
              {tr === 'today' ? t('commandCenter.today') : tr === 'week' ? t('commandCenter.last7') : t('commandCenter.last30')}
            </Button>)}
          <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void load(notifPage)} loading={loading}>{t('common.action.refresh')}</Button>
        </Space>
      </Space>

      {error && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message={error}
          action={<Button size="small" onClick={() => void load(notifPage)}><RefreshCw size={14} /> {t('commandCenter.retry')}</Button>} />
      )}

      <Spin spinning={loading && !dash}>
        <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
          <StatCard
            title={t('commandCenter.todayExams')}
            value={dash?.today?.exams ?? 0}
            icon={<Activity size={18} />}
            color="primary"
            sub={t('commandCenter.reportsCount', { count: dash?.today?.reports ?? 0 })}
          />
          <StatCard
            title={t('commandCenter.criticalValues')}
            value={dash?.alerts?.openCritical ?? dash?.totals?.criticalEvents ?? 0}
            icon={<Bell size={18} />}
            color="error"
            sub={t('commandCenter.unclosedCritical')}
          />
          <StatCard
            title={t('commandCenter.onlineDoctors')}
            value={dash?.alerts?.doctorsActive ?? 0}
            icon={<CheckCircle2 size={18} />}
            color="success"
            sub={t('commandCenter.activeDoctors')}
          />
          <StatCard
            title={t('commandCenter.deviceStatus')}
            value={deviceStats?.inUse ?? 0}
            suffix={`/ ${deviceStats?.total ?? 0}`}
            icon={<Monitor size={18} />}
            color="success"
            sub={<Progress percent={deviceStats?.total ? Math.round((deviceStats.inUse / deviceStats.total) * 100) : 0} size="small" strokeColor="#52c41a" />}
          />
        </StatCardGrid>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}><Card size="small" title={<Space><Bell size={14} />{t('commandCenter.recentEvents')}</Space>}>
            {notifications.length === 0 ? (
              <Empty description={t('commandCenter.noEvents')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={notifications}
                renderItem={(n) => (
                  <List.Item>
                    <Space>
                      <Badge status={(TYPE_COLOR[n.type] ?? 'default') as any} />
                      <span style={{ fontSize: 13, color: n.type === 'CRITICAL' ? '#ff4d4f' : '#666' }}>{n.title}</span>
                      {n.category && <Tag color="blue">{n.category}</Tag>}
                      <Text type="secondary" style={{ fontSize: 11 }}>{new Date(n.createdAt).toLocaleString()}</Text>
                    </Space>
                  </List.Item>
                )}
                pagination={{ current: notifPage, pageSize: NOTIF_PAGE_SIZE, total: notifTotal, onChange: setNotifPage, showSizeChanger: false }}
              />
            )}
          </Card></Col>
          <Col span={12}><Card size="small" title={<Space><TrendingUp size={14} />{t('commandCenter.examTrend')}</Space>}>
            <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: 4, paddingTop: 16 }}>
              {trend.length === 0 ? (
                <Empty description={t('commandCenter.noTrend')} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: 'auto' }} />
              ) : trend.map((tr, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{tr.count}</div>
                  <div style={{
                    width: '70%', height: `${Math.max(6, (tr.count / maxTrend) * 150)}px`,
                    background: '#2563eb', borderRadius: '4px 4px 0 0', opacity: 0.6 + i * 0.03,
                  }} />
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{tr.label}</div>
                </div>
              ))}
            </div>
          </Card></Col>
        </Row>

        <StatCardGrid minWidth={200} gap={16}>
          <StatCard title={t('commandCenter.totalExams')} value={dash?.totals?.exams ?? 0} sub={t('commandCenter.radiology')} />
          <StatCard title={t('commandCenter.registeredPatients')} value={dash?.totals?.patients ?? 0} color="primary" sub={t('commandCenter.totalPatients')} />
          <StatCard title={t('commandCenter.onlineDevices')} value={deviceStats?.inUse ?? 0} suffix={`/ ${deviceStats?.total ?? 0}`} sub={<Progress percent={deviceStats?.total ? Math.round((deviceStats.inUse / deviceStats.total) * 100) : 0} size="small" strokeColor="#52c41a" />} />
        </StatCardGrid>
      </Spin>
    </div>
  );
};
export default CommandCenterPage;
