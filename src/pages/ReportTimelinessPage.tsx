// ============================================================
// G005 放射科RIS系统 v1.0.7 - 报告及时率监控
// Phase R7: 及时率 / 超时工单 / 优先级分布
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { message, Typography } from 'antd';
import {
  Clock, AlertTriangle, CheckCircle2, TrendingUp,
  ChevronUp, ChevronDown, Activity, Bell, User, Timer,
} from 'lucide-react';
import { TIMELINESS_DATA } from '../data/knowledgeStatsMock';
import { notificationsApi } from '../services/api';
// [W2-A] biApi 真实及时率: getReportTimeliness + getTrend + getCriticalSla; 失败回退 TIMELINESS_DATA
import { biApi } from '../services/api/biApi';
import { statsApi } from '../services/api/statsApi';
import { t } from '../i18n/appI18n';
// [v3.0.6.11-105 Wave 2C] 国标指标联动: RQI-RRC-02 急诊报告 2h 完成率
import { RqiIndicatorLink } from '../components/qc/RqiIndicatorLink';
import { DataTable } from '../components/common';

// ============================================================
// 主组件
// ============================================================
export default function ReportTimelinessPage() {
  const data = TIMELINESS_DATA;
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [escalated, setEscalated] = useState<Record<string, boolean>>({});
  const [reminding, setReminding] = useState(false);
  // [W2-A] biApi 实时状态
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'api' | 'demo'>('demo');
  const [apiError, setApiError] = useState('');
  const [live, setLive] = useState<{ timing: any; trend: any[]; sla: any; daily: any } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setApiError('');
    try {
      const days = period === 'month' ? 30 : 7;
      const [tR, trendR, slaR, dailyR] = await Promise.allSettled([
        biApi.getReportTimeliness(),
        biApi.getTrend(days),
        biApi.getCriticalSla(),
        statsApi.getDaily(),
      ]);
      const fulfilled = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null);
      const tRes = fulfilled(tR);
      const trendRes = fulfilled(trendR);
      const slaRes = fulfilled(slaR);
      const dailyRes = fulfilled(dailyR);
      const timing = tRes?.success ? (tRes.data as any)?.data ?? null : null;
      const trend = trendRes?.success ? (trendRes.data as any)?.data ?? [] : [];
      const sla = slaRes?.success ? (slaRes.data as any)?.data ?? null : null;
      const daily = dailyRes?.success ? (dailyRes.data as any) ?? null : null;
      if (!timing && trend.length === 0 && !sla && !daily) {
        setDataSource('demo');
        setApiError(t('timeliness.apiUnavailable'));
        return;
      }
      setDataSource('api');
      setLive({ timing, trend, sla, daily });
    } catch (e) {
      setDataSource('demo');
      setApiError(e instanceof Error ? e.message : t('timeliness.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { void loadData(); }, [loadData]);

  // [W2-A] 派生: 及时率 / 平均签发 / 超时数 / 优先级分布 / 7日趋势
  const bucketCount = (b: string) => Number(live?.timing?.buckets?.find((x: any) => x.bucket === b)?.count ?? 0);
  const bucketPercent = (b: string) => Number(live?.timing?.buckets?.find((x: any) => x.bucket === b)?.percent ?? 0);
  const onTimeRate = live?.timing
    ? Math.round((['<30min', '30min-1h', '1h-2h'].reduce((s, b) => s + bucketPercent(b), 0)) * 10) / 10
    : data.overallOnTimeRate;
  const avgSignTime = live?.timing ? Number(live.timing.medianMinutes) || data.avgSignTime : data.avgSignTime;
  const overdueCount = live?.timing ? bucketCount('>4h') || 0 : data.overdue.length;
  const priorityData = live?.timing
    ? [
        { priority: '急诊', onTime: bucketCount('<30min'), target: 5, rate: bucketPercent('<30min') },
        { priority: '加急', onTime: bucketCount('30min-1h') + bucketCount('1h-2h'), target: 30, rate: Math.round((bucketPercent('30min-1h') + bucketPercent('1h-2h')) * 10) / 10 },
        { priority: '普通', onTime: bucketCount('2h-4h') + bucketCount('>4h'), target: 1440, rate: Math.round((bucketPercent('2h-4h') + bucketPercent('>4h')) * 10) / 10 },
      ]
    : data.onTimeByPriority;
  const trendData = live?.trend?.length
    ? live.trend.map((p: any) => ({ date: String(p.date || '').slice(5), onTimeRate: Math.round(Number(p.completionRate ?? 0) * 10) / 10 }))
    : data.trend;

  const currentUserId = (() => {
    try {
      const stored = JSON.parse(localStorage.getItem('ris_current_user') ?? 'null') as { id?: string } | null;
      return stored?.id ?? 'current';
    } catch { return 'current'; }
  })();

  const sendUrge = async (o: { reportId: string; patientName: string; doctor: string }) => {
    try {
      await notificationsApi.create({
        userId: o.doctor || currentUserId,
        type: 'TASK',
        severity: 'WARN',
        title: `报告超时催办 - ${o.reportId}`,
        content: `患者 ${o.patientName} 的报告 ${o.reportId} 已超时, 请尽快完成签发。`,
        link: `/reports/${o.reportId}`,
        targetId: o.reportId,
      });
      return true;
    } catch { return false; }
  };

  const handleUrgeOne = async (o: { reportId: string; patientName: string; doctor: string }) => {
    const ok = await sendUrge(o);
    if (ok) message.success(`已催办 ${o.doctor}: ${o.reportId}`);
      else message.warning(t('timeliness.urgeUnavailable'));
  };

  const handleUrgeAll = async () => {
    setReminding(true);
    try {
      const results = await Promise.all(data.overdue.map(o => sendUrge(o)));
      const ok = results.filter(Boolean).length;
      if (ok > 0) message.success(`已批量催办 ${ok} 位医生`);
    else message.warning(t('timeliness.urgeUnavailable'));
    } finally { setReminding(false); }
  };

  const handleEscalate = (o: { reportId: string; patientName: string; doctor: string }) => {
    setEscalated(prev => ({ ...prev, [o.reportId]: true }));
    void sendUrge({ ...o, doctor: t('timeliness.deptDirector') });
    message.success(`已升级至科主任: ${o.reportId}`);
  };

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={20} color="var(--color-primary-800)" /> {t('timeliness.title')}
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R7</span>
          </Typography.Title>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {t('timeliness.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', borderRadius: 6, padding: 3, border: '1px solid var(--border-color)' }}>
            {(['today', 'week', 'month'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '4px 10px', border: 'none', borderRadius: 4,
                  background: period === p ? 'var(--color-primary-500)' : 'transparent',
                  color: period === p ? '#fff' : '#475569',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {p === 'today' ? t('timeliness.today') : p === 'week' ? t('timeliness.last7') : t('timeliness.thisMonth')}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: autoRefresh ? '#10b981' : 'var(--bg-card)',
              color: autoRefresh ? '#fff' : '#475569',
              border: '1px solid ' + (autoRefresh ? '#10b981' : '#cbd5e1'),
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Activity size={12} /> {autoRefresh ? t('timeliness.autoRefreshing') : t('timeliness.paused')}
          </button>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 4,
            fontSize: 12, fontWeight: 600,
            background: loading ? 'var(--bg-card)' : dataSource === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
            color: loading ? '#64748b' : dataSource === 'api' ? '#059669' : 'var(--color-warning-600)',
            border: '1px solid ' + (dataSource === 'api' ? '#a7f3d0' : '#fde68a'),
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: loading ? '#94a3b8' : dataSource === 'api' ? '#10b981' : 'var(--color-warning-500)' }} />
            {loading ? t('timeliness.syncing') : dataSource === 'api' ? t('timeliness.dataSourceApi') : t('timeliness.dataSourceDemo')}
          </span>
          {apiError && (
            <button
              onClick={() => void loadData()}
              title={apiError}
              style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-card)', color: 'var(--color-error-600)', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <AlertTriangle size={12} /> {t('timeliness.retry')}
            </button>
          )}
        </div>
      </div>

      {/* [v3.0.6.11-105 Wave 2C] 国标指标联动: RQI-RRC-02 急诊报告 2h 完成率 */}
      <RqiIndicatorLink code="RQI-RRC-02" />

      {/* 大数字 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
        <BigStat icon={CheckCircle2} label={t('timeliness.overallOnTimeRate')} value={onTimeRate} suffix="%" color="#10b981" trend="up" trendValue="2.3%" />
        <BigStat icon={Timer} label={t('timeliness.avgSignTime')} value={avgSignTime} suffix={t('timeliness.unitMinutes')} color="#7c3aed" trend="down" trendValue="3.1m" />
        <BigStat icon={AlertTriangle} label={t('timeliness.overdueTickets')} value={overdueCount} suffix={t('timeliness.unitTickets')} color="var(--color-error-600)" alert />
        <BigStat icon={Bell} label={t('timeliness.alertNotifications')} value={3} suffix={t('timeliness.unitDemoTickets')} color="var(--color-warning-500)" />
      </div>

      {/* 优先级及时率 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)' }}>{t('timeliness.byPriority')}</div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{dataSource === 'api' ? t('timeliness.apiBuckets') : t('timeliness.tatMonitor')}</span>
          </div>
          {priorityData.map(p => (
            <div key={p.priority} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PriorityBadge priority={p.priority} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('timeliness.priorityTarget', { target: p.target, onTime: p.onTime })}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: p.rate >= 90 ? '#10b981' : p.rate >= 80 ? 'var(--color-warning-500)' : 'var(--color-error-600)' }}>{p.rate}%</span>
                </div>
              </div>
              <div style={{ height: 8, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: p.rate + '%',
                  background: p.rate >= 90 ? 'linear-gradient(90deg, #10b981, var(--color-success-500))' : p.rate >= 80 ? 'linear-gradient(90deg, var(--color-warning-500), var(--color-warning-400))' : 'linear-gradient(90deg, var(--color-error-600), var(--color-error-500))',
                  transition: 'width 0.5s',
                }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)' }}>{t('timeliness.byModality')}</div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('timeliness.demoData')}</span>
          </div>
          {data.onTimeByModality.map(m => (
            <div key={m.modality} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: modalityColor(m.modality) }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('timeliness.modalityTarget', { modality: m.modality, onTime: m.onTime, target: m.target })}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: m.rate >= 90 ? '#10b981' : m.rate >= 80 ? 'var(--color-warning-500)' : 'var(--color-error-600)' }}>{m.rate}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-card)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: m.rate + '%',
                  background: modalityColor(m.modality),
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7日趋势 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)' }}>{t('timeliness.trend7d')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#10b981' }}>
            <TrendingUp size={12} /> {dataSource === 'api' ? `biApi 实时 (${period === 'month' ? '近30日' : '近7日'})` : t('timeliness.overallUp')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 140, gap: 6, padding: '0 8px' }}>
          {trendData.map(p => {
            const maxRate = 95;
            const h = Math.min(100, (p.onTimeRate / maxRate) * 100);
            return (
              <div key={p.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>{p.onTimeRate}%</div>
                <div style={{
                  width: '70%',
                  height: h + '%',
                  background: p.onTimeRate >= 88 ? 'linear-gradient(180deg, #10b981, var(--color-success-500))' : p.onTimeRate >= 85 ? 'linear-gradient(180deg, var(--color-warning-500), var(--color-warning-400))' : 'linear-gradient(180deg, var(--color-error-600), var(--color-error-500))',
                  borderRadius: '4px 4px 0 0',
                  transition: 'all 0.3s',
                }} />
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.date}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 超时工单 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-error-600)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={13} /> {t('timeliness.overdueList')}
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 6 }}>{t('timeliness.overdueDemoNote')}</span>
          </div>
          <button onClick={() => void handleUrgeAll()} disabled={reminding} style={{ padding: '4px 10px', background: 'var(--color-error-600)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: reminding ? 'wait' : 'pointer', opacity: reminding ? 0.7 : 1 }}>
            {reminding ? t('timeliness.urging') : t('timeliness.urgeAll')}
          </button>
        </div>
        <DataTable
          rowKey="reportId"
          dataSource={data.overdue}
          columns={[
            { title: t('timeliness.colReportId'), dataIndex: 'reportId', key: 'reportId', render: (v: string) => <span style={{ fontFamily: 'monospace', color: '#7f1d1d' }}>{v}</span> },
            { title: t('timeliness.colPatient'), dataIndex: 'patientName', key: 'patientName', render: (v: string) => <span><User size={10} /> {v}</span> },
            { title: t('timeliness.colDoctor'), dataIndex: 'doctor', key: 'doctor', render: (v: string) => <span style={{ color: 'var(--text-secondary)' }}>{v}</span> },
            { title: t('timeliness.colOverdue'), dataIndex: 'minutes', key: 'minutes', align: 'right', render: (v: number) => <span style={{ color: v > 60 ? 'var(--color-error-600)' : 'var(--color-warning-500)', fontWeight: 700 }}>+{v} min</span> },
            {
              title: t('timeliness.colActions'),
              key: 'actions',
              align: 'center',
              render: (_v, o) => (
                <>
                  <button onClick={() => void handleUrgeOne(o)} style={{ padding: '2px 8px', background: 'var(--bg-card)', border: '1px solid var(--color-error-600)', color: 'var(--color-error-600)', borderRadius: 3, fontSize: 12, cursor: 'pointer', marginRight: 4 }}>
                    {t('timeliness.urge')}
                  </button>
                  <button onClick={() => handleEscalate(o)} disabled={!!escalated[o.reportId]} style={{ padding: '2px 8px', background: escalated[o.reportId] ? '#fca5a5' : 'var(--color-error-600)', color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, cursor: escalated[o.reportId] ? 'default' : 'pointer' }}>
                    {escalated[o.reportId] ? t('timeliness.escalated') : t('timeliness.escalate')}
                  </button>
                </>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

// ============================================================
// 辅助组件
// ============================================================
function BigStat({ icon: Icon, label, value, suffix, color, trend, trendValue, alert }: any) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 14, border: '1px solid ' + (alert ? '#fecaca' : '#e2e8f0') }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 12 }}>
          <Icon size={12} /> {label}
        </div>
        {trend && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, color: trend === 'up' ? '#10b981' : 'var(--color-error-600)' }}>
            {trend === 'up' ? <ChevronUp size={10} /> : <ChevronDown size={10} />} {trendValue}
          </div>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color }}>
        {value}<span style={{ fontSize: 12, fontWeight: 500, marginLeft: 2 }}>{suffix}</span>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: any = {
    '急诊': { bg: '#ef444422', color: 'var(--color-error-500)' },
    '加急': { bg: '#f59e0b22', color: 'var(--color-warning-500)' },
    '普通': { bg: '#3b82f622', color: 'var(--color-primary-800)' },
  };
  const s = map[priority] || { bg: 'var(--bg-deep)', color: 'var(--text-secondary)' };
  return (
    <span style={{ padding: '2px 6px', background: s.bg, color: s.color, borderRadius: 3, fontSize: 12, fontWeight: 700 }}>
      {priority}
    </span>
  );
}

function modalityColor(m: string) {
  const map: any = {
    'CT': 'var(--color-primary-500)', 'MR': '#7c3aed', 'DR': '#10b981', 'US': 'var(--color-warning-500)', 'MG': 'var(--color-error-600)',
  };
  return map[m] || '#64748b';
}
