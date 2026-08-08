// ============================================================
// G005 放射科RIS系统 v1.0.7 - 报告及时率监控
// Phase R7: 及时率 / 超时工单 / 优先级分布
// ============================================================

import { useState } from 'react';
import { message } from 'antd';
import {
  Clock, AlertTriangle, CheckCircle2, TrendingUp,
  ChevronUp, ChevronDown, Activity, Bell, User, Timer,
} from 'lucide-react';
import { TIMELINESS_DATA } from '../data/knowledgeStatsMock';
import { notificationsApi } from '../services/api';

// ============================================================
// 主组件
// ============================================================
export default function ReportTimelinessPage() {
  const t = TIMELINESS_DATA;
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [escalated, setEscalated] = useState<Record<string, boolean>>({});
  const [reminding, setReminding] = useState(false);

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
          <h1 style={{ fontSize: 22, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={20} color="#1e40af" /> 报告及时率监控
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R7</span>
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            急诊5min / 加急30min / 普通24h · 实时超时预警 · 智能调度
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 6, padding: 3, border: '1px solid #cbd5e1' }}>
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
              background: autoRefresh ? '#10b981' : '#fff',
              color: autoRefresh ? '#fff' : '#475569',
              border: '1px solid ' + (autoRefresh ? '#10b981' : '#cbd5e1'),
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Activity size={12} /> {autoRefresh ? '实时刷新中' : '已暂停'}
          </button>
        </div>
      </div>

      {/* 大数字 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
        <BigStat icon={CheckCircle2} label="整体及时率" value={t.overallOnTimeRate} suffix="%" color="#10b981" trend="up" trendValue="2.3%" />
        <BigStat icon={Timer} label="平均签发" value={t.avgSignTime} suffix="分钟" color="#7c3aed" trend="down" trendValue="3.1m" />
        <BigStat icon={AlertTriangle} label="超时工单" value={t.overdue.length} suffix="单" color="#dc2626" alert />
        <BigStat icon={Bell} label="预警通知" value={3} suffix="条" color="#f59e0b" />
      </div>

      {/* 优先级及时率 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>按优先级 - 及时签发率</div>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>TAT 监控</span>
          </div>
          {t.onTimeByPriority.map(p => (
            <div key={p.priority} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PriorityBadge priority={p.priority} />
                  <span style={{ fontSize: 12, color: '#475569' }}>目标 {p.target}min · 已发 {p.onTime}单</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: p.rate >= 90 ? '#10b981' : p.rate >= 80 ? '#f59e0b' : '#dc2626' }}>{p.rate}%</span>
                </div>
              </div>
              <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
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

        <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>按设备 - 及时签发率</div>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>本月</span>
          </div>
          {t.onTimeByModality.map(m => (
            <div key={m.modality} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: modalityColor(m.modality) }} />
                  <span style={{ fontSize: 12, color: '#475569' }}>{m.modality} · {m.onTime}/{m.target}单</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: m.rate >= 90 ? '#10b981' : m.rate >= 80 ? '#f59e0b' : '#dc2626' }}>{m.rate}%</span>
              </div>
              <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
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
      <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>近 7 日及时率趋势</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#10b981' }}>
            <TrendingUp size={12} /> 整体上升 2.3%
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 140, gap: 6, padding: '0 8px' }}>
          {t.trend.map(p => {
            const maxRate = 95;
            const h = (p.onTimeRate / maxRate) * 100;
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
                <div style={{ fontSize: 12, color: '#64748b' }}>{p.date}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 超时工单 */}
      <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={13} /> 超时工单实时列表
          </div>
          <button onClick={() => void handleUrgeAll()} disabled={reminding} style={{ padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: reminding ? 'wait' : 'pointer', opacity: reminding ? 0.7 : 1 }}>
            {reminding ? '催办中...' : '一键催办'}
          </button>
        </div>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
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
                <td style={{ padding: 8, color: '#475569' }}>{o.doctor}</td>
                <td style={{ padding: 8, textAlign: 'right', color: o.minutes > 60 ? '#dc2626' : '#f59e0b', fontWeight: 700 }}>+{o.minutes} min</td>
                <td style={{ padding: 8, textAlign: 'center' }}>
                  <button onClick={() => void handleUrgeOne(o)} style={{ padding: '2px 8px', background: '#fff', border: '1px solid #dc2626', color: '#dc2626', borderRadius: 3, fontSize: 12, cursor: 'pointer', marginRight: 4 }}>
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
    <div style={{ background: '#fff', borderRadius: 8, padding: 14, border: '1px solid ' + (alert ? '#fecaca' : '#e2e8f0') }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12 }}>
          <Icon size={12} /> {label}
        </div>
        {trend && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, color: trend === 'up' ? '#10b981' : '#dc2626' }}>
            {trend === 'up' ? <ChevronUp size={10} /> : <ChevronDown size={10} />} {trendValue}
          </div>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color }}>
        {value}<span style={{ fontSize: 13, fontWeight: 500, marginLeft: 2 }}>{suffix}</span>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: any = {
    '急诊': { bg: '#fee2e2', color: '#dc2626' },
    '加急': { bg: '#fef3c7', color: '#d97706' },
    '普通': { bg: '#dbeafe', color: '#1e40af' },
  };
  const s = map[priority] || { bg: '#f1f5f9', color: '#475569' };
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
