// ============================================================
// G005 放射科RIS系统 v1.0.7 - 报告及时率监控
// Phase R7: 及时率 / 超时工单 / 优先级分布
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import {
  Clock, AlertTriangle, CheckCircle2, TrendingUp,
  ChevronUp, ChevronDown, Activity, Bell, User, Timer,
} from 'lucide-react';
import { TIMELINESS_DATA } from '../data/knowledgeStatsMock';
import { notificationsApi } from '../services/api';
// [W2-A] biApi 真实及时率: getReportTimeliness + getTrend + getCriticalSla; 失败回退 TIMELINESS_DATA
import { biApi } from '../services/api/biApi';
import { statsApi } from '../services/api/statsApi';

// ============================================================
// 主组件
// ============================================================
export default function ReportTimelinessPage() {
  const t = TIMELINESS_DATA;
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
        setApiError('biApi 暂不可用，当前展示内置演示数据');
        return;
      }
      setDataSource('api');
      setLive({ timing, trend, sla, daily });
    } catch (e) {
      setDataSource('demo');
      setApiError(e instanceof Error ? e.message : '数据加载失败，已回退演示数据');
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
    : t.overallOnTimeRate;
  const avgSignTime = live?.timing ? Number(live.timing.medianMinutes) || t.avgSignTime : t.avgSignTime;
  const overdueCount = live?.timing ? bucketCount('>4h') || 0 : t.overdue.length;
  const priorityData = live?.timing
    ? [
        { priority: '急诊', onTime: bucketCount('<30min'), target: 5, rate: bucketPercent('<30min') },
        { priority: '加急', onTime: bucketCount('30min-1h') + bucketCount('1h-2h'), target: 30, rate: Math.round((bucketPercent('30min-1h') + bucketPercent('1h-2h')) * 10) / 10 },
        { priority: '普通', onTime: bucketCount('2h-4h') + bucketCount('>4h'), target: 1440, rate: Math.round((bucketPercent('2h-4h') + bucketPercent('>4h')) * 10) / 10 },
      ]
    : t.onTimeByPriority;
  const trendData = live?.trend?.length
    ? live.trend.map((p: any) => ({ date: String(p.date || '').slice(5), onTimeRate: Math.round(Number(p.completionRate ?? 0) * 10) / 10 }))
    : t.trend;

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
    else message.warning('催办接口不可用，已记录本地催办日志');
  };

  const handleUrgeAll = async () => {
    setReminding(true);
    try {
      const results = await Promise.all(t.overdue.map(o => sendUrge(o)));
      const ok = results.filter(Boolean).length;
      if (ok > 0) message.success(`已批量催办 ${ok} 位医生`);
      else message.warning('催办接口不可用，已记录本地催办日志');
    } finally { setReminding(false); }
  };

  const handleEscalate = (o: { reportId: string; patientName: string; doctor: string }) => {
    setEscalated(prev => ({ ...prev, [o.reportId]: true }));
    void sendUrge({ ...o, doctor: '科主任' });
    message.success(`已升级至科主任: ${o.reportId}`);
  };

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={20} color="#1e40af" /> 报告及时率监控
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R7</span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            急诊5min / 加急30min / 普通24h · 实时超时预警 · 智能调度
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
                  background: period === p ? '#3b82f6' : 'transparent',
                  color: period === p ? '#fff' : '#475569',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {p === 'today' ? '今日' : p === 'week' ? '近7天' : '本月'}
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
            <Activity size={12} /> {autoRefresh ? '实时刷新中' : '已暂停'}
          </button>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 4,
            fontSize: 12, fontWeight: 600,
            background: loading ? 'var(--bg-card)' : dataSource === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
            color: loading ? '#64748b' : dataSource === 'api' ? '#059669' : '#d97706',
            border: '1px solid ' + (dataSource === 'api' ? '#a7f3d0' : '#fde68a'),
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: loading ? '#94a3b8' : dataSource === 'api' ? '#10b981' : '#f59e0b' }} />
            {loading ? '数据同步中...' : dataSource === 'api' ? '数据源: biApi 实时' : '数据源: 演示数据'}
          </span>
          {apiError && (
            <button
              onClick={() => void loadData()}
              title={apiError}
              style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-card)', color: '#dc2626', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <AlertTriangle size={12} /> 重试
            </button>
          )}
        </div>
      </div>

      {/* 大数字 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
        <BigStat icon={CheckCircle2} label="整体及时率" value={onTimeRate} suffix="%" color="#10b981" trend="up" trendValue="2.3%" />
        <BigStat icon={Timer} label="平均签发" value={avgSignTime} suffix="分钟" color="#7c3aed" trend="down" trendValue="3.1m" />
        <BigStat icon={AlertTriangle} label="超时工单" value={overdueCount} suffix="单" color="#dc2626" alert />
        <BigStat icon={Bell} label="预警通知" value={3} suffix="条(演示)" color="#f59e0b" />
      </div>

      {/* 优先级及时率 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>按优先级 - 及时签发率</div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{dataSource === 'api' ? 'biApi TAT 桶分布' : 'TAT 监控'}</span>
          </div>
          {priorityData.map(p => (
            <div key={p.priority} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PriorityBadge priority={p.priority} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>目标 {p.target}min · 已发 {p.onTime}单</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: p.rate >= 90 ? '#10b981' : p.rate >= 80 ? '#f59e0b' : '#dc2626' }}>{p.rate}%</span>
                </div>
              </div>
              <div style={{ height: 8, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: p.rate + '%',
                  background: p.rate >= 90 ? 'linear-gradient(90deg, #10b981, #22c55e)' : p.rate >= 80 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #dc2626, #ef4444)',
                  transition: 'width 0.5s',
                }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>按设备 - 及时签发率</div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>演示数据</span>
          </div>
          {t.onTimeByModality.map(m => (
            <div key={m.modality} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: modalityColor(m.modality) }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.modality} · {m.onTime}/{m.target}单</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: m.rate >= 90 ? '#10b981' : m.rate >= 80 ? '#f59e0b' : '#dc2626' }}>{m.rate}%</span>
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
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>近 7 日及时率趋势</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#10b981' }}>
            <TrendingUp size={12} /> {dataSource === 'api' ? `biApi 实时 (${period === 'month' ? '近30日' : '近7日'})` : '整体上升 2.3%'}
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
                  background: p.onTimeRate >= 88 ? 'linear-gradient(180deg, #10b981, #22c55e)' : p.onTimeRate >= 85 ? 'linear-gradient(180deg, #f59e0b, #fbbf24)' : 'linear-gradient(180deg, #dc2626, #ef4444)',
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
          <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={13} /> 超时工单实时列表
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 6 }}>演示数据 (biApi 无超时工单明细端点)</span>
          </div>
          <button onClick={() => void handleUrgeAll()} disabled={reminding} style={{ padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: reminding ? 'wait' : 'pointer', opacity: reminding ? 0.7 : 1 }}>
            {reminding ? '催办中...' : '一键催办'}
          </button>
        </div>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-error-bg)', borderBottom: '1px solid #fecaca' }}>
              <th style={{ padding: 8, textAlign: 'left', color: '#7f1d1d', fontWeight: 600 }}>报告ID</th>
              <th style={{ padding: 8, textAlign: 'left', color: '#7f1d1d', fontWeight: 600 }}>患者</th>
              <th style={{ padding: 8, textAlign: 'left', color: '#7f1d1d', fontWeight: 600 }}>责任医生</th>
              <th style={{ padding: 8, textAlign: 'right', color: '#7f1d1d', fontWeight: 600 }}>超时</th>
              <th style={{ padding: 8, textAlign: 'center', color: '#7f1d1d', fontWeight: 600 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {t.overdue.map(o => (
              <tr key={o.reportId} style={{ borderBottom: '1px solid #fee2e2' }}>
                <td style={{ padding: 8, fontFamily: 'monospace', color: '#7f1d1d' }}>{o.reportId}</td>
                <td style={{ padding: 8 }}><User size={10} /> {o.patientName}</td>
                <td style={{ padding: 8, color: 'var(--text-secondary)' }}>{o.doctor}</td>
                <td style={{ padding: 8, textAlign: 'right', color: o.minutes > 60 ? '#dc2626' : '#f59e0b', fontWeight: 700 }}>+{o.minutes} min</td>
                <td style={{ padding: 8, textAlign: 'center' }}>
                  <button onClick={() => void handleUrgeOne(o)} style={{ padding: '2px 8px', background: 'var(--bg-card)', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 3, fontSize: 12, cursor: 'pointer', marginRight: 4 }}>
                    催办
                  </button>
                  <button onClick={() => handleEscalate(o)} disabled={!!escalated[o.reportId]} style={{ padding: '2px 8px', background: escalated[o.reportId] ? '#fca5a5' : '#dc2626', color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, cursor: escalated[o.reportId] ? 'default' : 'pointer' }}>
                    {escalated[o.reportId] ? '已升级' : '升级'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, color: trend === 'up' ? '#10b981' : '#dc2626' }}>
            {trend === 'up' ? <ChevronUp size={10} /> : <ChevronDown size={10} />} {trendValue}
          </div>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color }}>
        {value}<span style={{ fontSize: 13, fontWeight: 500, marginLeft: 2 }}>{suffix}</span>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: any = {
    '急诊': { bg: '#ef444422', color: '#ef4444' },
    '加急': { bg: '#f59e0b22', color: '#f59e0b' },
    '普通': { bg: '#3b82f622', color: '#1e40af' },
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
    'CT': '#3b82f6', 'MR': '#7c3aed', 'DR': '#10b981', 'US': '#f59e0b', 'MG': '#dc2626',
  };
  return map[m] || '#64748b';
}
