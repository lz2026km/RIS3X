/**
 * @deprecated [v3.0.6.11-104 Wave 5B] 危急值多入口收敛: 本页面已内嵌为 `/critical-value` 的 "统计大屏" Tab (含 W2D 统计扩展)。
 * 旧路由 `/critical-value-stats` 保留 redirect → `/critical-value?tab=stats`。请勿新增直接引用。
 */
// ============================================================
// G005 放射科RIS系统 v1.0.5 - 危急值统计大屏
// Phase R5：10 分钟通报率 + 按病种/科室/医生分桶 + 闭环可视化
// ============================================================

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertOctagon, CheckCircle2, Activity, Bell,
  BarChart3, Zap, AlertCircle, Stethoscope,
  Tag, Award,
  ListOrdered, Layers, ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  CRITICAL_EVENTS,
  CRITICAL_VALUE_KPI,
  type CriticalStatus,
} from '../data/criticalValueAssessmentMock';
import { criticalApi, type CriticalStatsDto } from '../services/api/criticalApi';
import { criticalStatsApi, type NotificationCompletionStats } from '../services/api/criticalStatsApi';
import CriticalValueStatsExtended from './critical/CriticalValueStatsExtended';

// ============================================================
// 状态配置
// ============================================================
const STATUS_CONFIG: Record<CriticalStatus, { label: string; color: string; bg: string; border: string; icon: any }> = {
  pending:      { label: '待通报', color: '#ef4444', bg: '#ef444422', border: '#fca5a5', icon: AlertCircle },
  notified:     { label: '已通报', color: '#f59e0b', bg: '#f59e0b22', border: '#fcd34d', icon: Bell },
  acknowledged: { label: '已接收', color: '#0891b2', bg: '#06b6d422', border: '#67e8f9', icon: CheckCircle2 },
  resolved:     { label: '已处理', color: '#10b981', bg: '#22c55e22', border: '#6ee7b7', icon: CheckCircle2 },
  overdue:      { label: '已超时', color: '#7f1d1d', bg: '#ef444422', border: '#f87171', icon: AlertOctagon },
};

// ============================================================
// 主组件
// ============================================================
export default function CriticalValueStatsPage() {
  const navigate = useNavigate();
  const kpi = CRITICAL_VALUE_KPI;
  const events = CRITICAL_EVENTS;

  // [G005-P0] 顶部 KPI 接后端 /criticals/stats + /criticals/stats/notification (代替恒 0)
  const [liveStats, setLiveStats] = useState<CriticalStatsDto | null>(null);
  const [liveNotif, setLiveNotif] = useState<NotificationCompletionStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [statsRes, notifRes] = await Promise.all([
          criticalApi.getStats(),
          criticalStatsApi.getNotificationStats(),
        ]);
        if (cancelled) return;
        if (statsRes.success && statsRes.data) setLiveStats(statsRes.data);
        if (notifRes.success && notifRes.data) setLiveNotif(notifRes.data);
      } catch {
        // 后端不可用时回退 mock
      }
    })();
    return () => { cancelled = true };
  }, []);

  const totalThisMonth = liveStats?.total ?? kpi.totalThisMonth;
  const resolvedCount = liveStats?.resolved ?? kpi.resolvedCount;
  const onTimeRate = liveNotif ? Number(liveNotif.completionRate ?? 0) : kpi.onTimeNotificationRate;
  const avgResponseTimeMinutes = liveNotif ? Number(liveNotif.avgNotificationTime ?? 0) : kpi.avgResponseTimeMinutes;
  const overdueCount = liveStats ? liveStats.escalated : events.filter(e => !e.onTimeNotification && e.status === 'resolved').length;
  const onTimeCount = liveStats ? Math.max(0, liveStats.total - liveStats.escalated) : events.filter(e => e.onTimeNotification).length;

  // 按病种分桶
  const byCategory = useMemo(() => {
    return Object.entries(kpi.byCategory).map(([cat, count]) => ({
      category: cat,
      label: { neuro: '神经', cardio: '心血管', pulmo: '胸部', abdomen: '腹部', trauma: '创伤', vascular: '血管', contrast: '造影剂' }[cat] || cat,
      count,
      color: { neuro: '#7c3aed', cardio: '#dc2626', pulmo: '#0891b2', abdomen: '#f59e0b', trauma: '#7f1d1d', vascular: '#3b82f6', contrast: '#a855f7' }[cat] || '#94a3b8',
    }));
  }, [kpi]);

  // 按设备分桶
  const byModality = useMemo(() => {
    const total = Object.values(kpi.byModality).reduce((a, b) => a + b, 0);
    return Object.entries(kpi.byModality).map(([mod, count]) => ({
      modality: mod,
      count,
      rate: ((count / total) * 100).toFixed(1),
    }));
  }, [kpi]);

  // 按医生排行
  const byDoctor = kpi.byDoctor;

  // 最近事件
  const recentEvents = [...events].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={20} color="#7c2d12" /> 危急值统计大屏
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R5</span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            10 分钟通报率 · 按病种/设备/医生分桶 · 闭环可视化
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('/critical-value-rule')}
            style={{
              padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 6,
              background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
            }}
          >
            规则配置
          </button>
          <button
            onClick={() => navigate('/critical-value')}
            style={{
              padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 6,
              background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
            }}
          >
            返回危急值
          </button>
        </div>
      </div>

      <CriticalValueStatsExtended />

      {/* 大字 KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
        <BigKpi icon={AlertOctagon} label={liveStats ? '危急值总数' : '本月危急值'} value={totalThisMonth} color="#dc2626" />
        <BigKpi icon={Zap} label="10分钟通报率" value={`${onTimeRate}%`} color={onTimeRate >= 90 ? '#10b981' : '#f59e0b'} trend={onTimeRate >= 90 ? 'up' : 'down'} trendValue="3.2%" />
        <BigKpi icon={Activity} label="平均响应时间" value={`${avgResponseTimeMinutes}m`} color="#7c3aed" trend="down" trendValue="1.5m" />
        <BigKpi icon={CheckCircle2} label="已闭环" value={resolvedCount} color="#10b981" trend="up" trendValue="12%" />
        <BigKpi icon={AlertCircle} label="未超时/超时" value={`${onTimeCount}/${overdueCount}`} color="#f59e0b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {/* 按病种分桶 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag size={13} /> 按病种分桶（7 类别）
          </div>
          {byCategory.map(c => {
            const maxCount = Math.max(...byCategory.map(x => x.count));
            const pct = (c.count / maxCount) * 100;
            return (
              <div key={c.category} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{c.label}</span>
                  <span style={{ color: c.color, fontWeight: 700 }}>{c.count} 例</span>
                </div>
                <div style={{ height: 16, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    background: c.color,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* 按设备分桶 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={13} /> 按检查设备分桶
          </div>
          {byModality.map(m => {
            const total = byModality.reduce((s, x) => s + x.count, 0);
            const pct = (m.count / total) * 100;
            return (
              <div key={m.modality} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{m.modality}</span>
                  <span><strong>{m.count}</strong> <span style={{ color: 'var(--text-secondary)' }}>({m.rate}%)</span></span>
                </div>
                <div style={{ height: 14, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    background: 'linear-gradient(90deg, #3b82f6, #7c3aed)',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {/* Top 5 规则 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ListOrdered size={13} /> Top 5 危急值规则（本月）
          </div>
          {kpi.topRules.map((r, i) => {
            const maxCount = kpi.topRules[0]?.count ?? 0;
            return (
              <div key={r.ruleCode} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: i === 0 ? 'var(--color-warning-bg)' : 'var(--bg-card)',
                    color: i === 0 ? '#92400e' : '#475569',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.ruleName}</span>
                      <span style={{ color: '#dc2626', fontWeight: 700 }}>{r.count}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.ruleCode}</div>
                    <div style={{ marginTop: 3, height: 4, background: 'var(--bg-card)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${(r.count / maxCount) * 100}%`, height: '100%', background: '#dc2626' }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 医生排行 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Stethoscope size={13} /> 报告医生排行
          </div>
          {byDoctor.map((d, i) => (
            <div key={d.doctorName} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: i < byDoctor.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: i === 0 ? 'var(--color-warning-bg)' : i === 1 ? 'var(--bg-card)' : i === 2 ? 'var(--color-warning-bg)' : 'var(--bg-card)',
                color: i === 0 ? '#92400e' : i === 1 ? '#475569' : i === 2 ? '#7c2d12' : '#475569',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
              }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{d.doctorName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {d.reportedCount} 例 · 平均 {d.avgTime}m 响应
                </div>
              </div>
              {i === 0 && <Award size={14} color="#f59e0b" />}
            </div>
          ))}
        </div>
      </div>

      {/* 最近事件 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={13} /> 最近危急值事件（{events.length} 条）
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {recentEvents.map(e => {
            const sConf = STATUS_CONFIG[e.status];
            const SIcon = sConf.icon;
            return (
              <div key={e.id} style={{
                padding: 10, marginBottom: 6, background: 'var(--bg-card)', borderRadius: 6,
                borderLeft: `3px solid ${sConf.color}`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: sConf.color, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <SIcon size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{e.ruleName}</span>
                    <span style={{
                      fontSize: 12, padding: '1px 4px', borderRadius: 2,
                      background: sConf.bg, color: sConf.color, fontWeight: 700,
                    }}>{sConf.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.ruleCode}</span>
                    {e.onTimeNotification ? (
                      <span style={{ fontSize: 12, padding: '1px 4px', background: 'var(--color-success-bg)', color: '#047857', borderRadius: 2, fontWeight: 700 }}>✓ 及时</span>
                    ) : (
                      <span style={{ fontSize: 12, padding: '1px 4px', background: 'var(--color-error-bg)', color: '#b91c1c', borderRadius: 2, fontWeight: 700 }}>超时</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {e.patientName} · {e.modality} {e.bodyPart} · 报告人 {e.reportedByName}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{e.detail}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.reportedAt}</div>
                  {e.responseTimeMinutes !== undefined && (
                    <div style={{
                      fontSize: 12, fontWeight: 700, color: e.responseTimeMinutes <= 10 ? '#10b981' : '#dc2626',
                    }}>{e.responseTimeMinutes}m</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 大字 KPI
// ============================================================
const BigKpi: React.FC<{ icon: any; label: string; value: number | string; color: string; trend?: 'up' | 'down'; trendValue?: string }> = ({ icon: Icon, label, value, color, trend, trendValue }) => (
  <div style={{
    background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${color}15`, color: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      {trend && trendValue && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, color: trend === 'up' ? '#10b981' : '#dc2626' }}>
          {trend === 'up' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          <span style={{ fontWeight: 600 }}>{trendValue}</span>
        </div>
      )}
    </div>
    <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
  </div>
);
