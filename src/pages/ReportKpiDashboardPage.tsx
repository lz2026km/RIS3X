// ============================================================
// G005 放射科RIS系统 - 报告 KPI 大盘 (KPI Engine)
// Phase A：KPI Engine 驱动 · 30+ 指标 · 实时刷新
// [v3.0.6.11-103 Wave 6] 仪表盘卡片化: DashboardCard / KpiCard / ProgressRing / TrendChart
// ============================================================

import { useState, useEffect } from 'react';
import {
  BarChart3, FileText, Clock, Target, Sparkles, CheckCircle2,
  Zap, Award, Server, Leaf, Cloud, Cpu, Activity, TrendingUp, Gauge,
} from 'lucide-react';
import { kpiEngine } from '../services/analytics/KpiEngine';
import type { KpiSnapshot } from '../types/analytics';
import {
  KpiCard, KpiCardGrid, DashboardCard, ProgressRing, TrendChart, SkeletonKpi,
} from '../components/dashboard';
import { t } from '../i18n/appI18n';

// ============================================================
// 主组件
// ============================================================
export default function ReportKpiDashboardPage() {
  const [period, setPeriod] = useState<'today' | 'month' | 'year'>('month');
  const [snapshot, setSnapshot] = useState<KpiSnapshot | null>(null);

  useEffect(() => {
    const now = new Date();
    const rangeMap = {
      today: { start: now.toISOString().substring(0, 10), end: now.toISOString().substring(0, 10) },
      month: { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0, 10), end: now.toISOString().substring(0, 10) },
      year: { start: new Date(now.getFullYear(), 0, 1).toISOString().substring(0, 10), end: now.toISOString().substring(0, 10) },
    };
    setSnapshot(kpiEngine.computeSnapshot(period, rangeMap[period]));
  }, [period]);

  const val = (id: string) => snapshot?.values.find(v => v.kpiId === id);
  const periodLabel = period === 'today' ? t('reportKpi.periodToday') : period === 'month' ? t('reportKpi.periodMonth') : t('reportKpi.periodYear');

  const trendProps = (id: string): { value: number | string; direction?: 'up' | 'down' } | undefined => {
    const tr = val(id)?.trend;
    if (!tr || tr === 'flat') return { value: val(id)?.mom ?? 0 };
    return { value: val(id)?.mom ?? 0, direction: tr === 'up' ? 'up' : 'down' };
  };

  if (!snapshot || snapshot.values.length === 0) {
    // [v3.0.6.11-103 Wave 6] 骨架屏加载态
    return (
      <div role="status" data-testid="report-kpi-loading" style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
          {Array.from({ length: 4 }, (_, i) => <SkeletonKpi key={i} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ height: 260, borderRadius: 12, background: 'var(--skeleton-bg, #e2e8f0)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: 260, borderRadius: 12, background: 'var(--skeleton-bg, #e2e8f0)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
        <div style={{ height: 220, borderRadius: 12, background: 'var(--skeleton-bg, #e2e8f0)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    );
  }

  const devices = ['CT 1 (Siemens)', 'CT 2 (GE)', 'MR 1 (3.0T)', 'MR 2 (1.5T)', 'DR 1', 'MG'];
  const deviceRates = devices.map(dev => 60 + Math.abs(hashCode(dev + period)) % 40);
  const avgDeviceRate = Math.round(deviceRates.reduce((s, r) => s + r, 0) / Math.max(deviceRates.length, 1));

  const hourData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}`,
    count: Math.floor(Math.abs(Math.sin(h * 0.5)) * 200),
  }));
  const weekData = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day, i) => ({
    day,
    count: Math.floor(200 + Math.sin(i * 1.2) * 80 + Math.random() * 40),
  }));
  const modalityTotals: Record<string, number> = { CT: 1245, MR: 678, DR: 1234, US: 567, MG: 234, DSA: 45 };
  const modalityColors: Record<string, string> = { CT: '#3b82f6', MR: '#7c3aed', DR: '#0891b2', US: '#10b981', MG: '#ec4899', DSA: '#dc2626' };
  const modalityTotal = Object.values(modalityTotals).reduce((a, b) => a + b, 0);

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={20} color="#1e40af" /> {t('reportKpi.title')}
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R7</span>
            {/* [G005 Wave2B P2] KpiEngine 本地合成指标 → 演示数据徽标 */}
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', fontWeight: 600 }}>{t('reportKpi.demoBadge')}</span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {t('reportKpi.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', borderRadius: 6, padding: 3, border: '1px solid var(--border-color)' }}>
          {(['today', 'month', 'year'] as const).map(p => (
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
              {p === 'today' ? t('reportKpi.periodToday') : p === 'month' ? t('reportKpi.periodMonth') : t('reportKpi.periodYear')}
            </button>
          ))}
        </div>
      </div>

      {/* 核心 KPI 4 大 (v3.0.6.11-103 Wave 6: KpiCard) */}
      <KpiCardGrid minWidth={260} gap={10} style={{ marginBottom: 12 }}>
        <KpiCard title={t('reportKpi.reportCount')} value={val('kpi-001')?.value ?? 0} suffix={t('reportKpi.unitReports')} icon={<FileText size={20} />} color="primary" trend={trendProps('kpi-001')} />
        <KpiCard title={t('reportKpi.avgSign')} value={val('kpi-010')?.value ?? 0} suffix={t('reportKpi.unitMinutes')} icon={<Clock size={20} />} color="info" trend={{ value: val('kpi-010')?.mom ?? 0, direction: val('kpi-010')?.trend === 'up' ? 'down' : val('kpi-010')?.trend === 'down' ? 'up' : undefined, goodWhenDown: true }} />
        <KpiCard title={t('reportKpi.gradeARate')} value={val('kpi-020')?.value ?? 0} suffix="%" icon={<Target size={20} />} color="success" trend={trendProps('kpi-020')} />
        <KpiCard title={t('reportKpi.aiAdoption')} value={val('kpi-050')?.value ?? 0} suffix="%" icon={<Sparkles size={20} />} color="warning" trend={trendProps('kpi-050')} />
      </KpiCardGrid>

      {/* 质量 + 时效 + 危急值 + CA + 区块链 */}
      <KpiCardGrid minWidth={200} gap={8} style={{ marginBottom: 12 }}>
        <KpiCard title={t('reportKpi.signed')} value={val('kpi-001')?.value ?? 0} icon={<CheckCircle2 size={18} />} color="success" size="sm" />
        <KpiCard title={t('reportKpi.pendingReports')} value={val('kpi-004')?.value ?? 0} icon={<Clock size={18} />} color="warning" size="sm" />
        <KpiCard title={t('reportKpi.criticalTimelyRate')} value={`${val('kpi-030')?.value ?? 0}%`} icon={<Zap size={18} />} color="info" size="sm" />
        <KpiCard title={t('reportKpi.avgQualityScore')} value={val('kpi-021')?.value ?? 0} icon={<Award size={18} />} color="primary" size="sm" />
        <KpiCard title={t('reportKpi.blockchainProof')} value={val('kpi-080')?.value ?? 0} icon={<Server size={18} />} color="warning" size="sm" />
      </KpiCardGrid>

      {/* 设备利用率 + 24h 分布 (v3.0.6.11-103 Wave 6: DashboardCard / ProgressRing / TrendChart) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <DashboardCard
          title={t('reportKpi.deviceUtilization')}
          icon={<Cpu size={14} />}
          extra={<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{periodLabel}</span>}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
            <ProgressRing percent={avgDeviceRate} size={72} strokeWidth={8} subLabel={t('reportKpi.avg')} />
            <div style={{ flex: 1, display: 'grid', gap: 10 }}>
              {devices.map((dev, i) => {
                const rate = deviceRates[i] ?? 60;
                const count = 100 + Math.abs(hashCode(dev)) % 900;
                return (
                  <div key={dev}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{dev}</span>
                      <span><strong style={{ color: rate > 85 ? '#10b981' : rate > 75 ? '#f59e0b' : '#94a3b8' }}>{rate}%</strong> <span style={{ color: 'var(--text-secondary)' }}>· {count} {t('reportKpi.unitReports')}</span></span>
                    </div>
                    <div style={{ height: 14, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${rate}%`, height: '100%', background: rate > 85 ? 'linear-gradient(90deg, #10b981, #059669)' : rate > 75 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #94a3b8, #64748b)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DashboardCard>

        <DashboardCard
          title={t('reportKpi.hourlyDistribution')}
          icon={<Activity size={14} />}
          extra={<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('reportKpi.periodToday')}</span>}
        >
          <TrendChart
            type="bar"
            data={hourData}
            xKey="hour"
            series={[{ key: 'count', name: t('reportKpi.reportCount'), color: '#3b82f6' }]}
            height={120}
            showLegend={false}
          />
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-around', fontSize: 12, color: 'var(--text-secondary)' }}>
            <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:59</span>
          </div>
        </DashboardCard>
      </div>

      {/* 7 天趋势 + 检查类型分布 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <DashboardCard title={t('reportKpi.trend7d')} icon={<TrendingUp size={14} />}>
          <TrendChart
            type="bar"
            data={weekData}
            xKey="day"
            series={[{ key: 'count', name: t('reportKpi.reportCount'), color: '#3b82f6' }]}
            height={150}
          />
        </DashboardCard>

        <DashboardCard title={t('reportKpi.examTypeDistribution')} icon={<FileText size={14} />}>
          {(['CT', 'MR', 'DR', 'US', 'MG', 'DSA'] as const).map(mod => {
            const count = modalityTotals[mod] ?? 0;
            const pct = ((count / modalityTotal) * 100).toFixed(1);
            return (
              <div key={mod} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{mod}</span>
                  <span><strong style={{ color: modalityColors[mod] }}>{count}</strong> <span style={{ color: 'var(--text-secondary)' }}>({pct}%)</span></span>
                </div>
                <div style={{ height: 12, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: modalityColors[mod] }} />
                </div>
              </div>
            );
          })}
        </DashboardCard>
      </div>

      {/* 绿色 IT + 区块链 + 推送 (v3.0.6.11-103 Wave 6: KpiCard) */}
      <KpiCardGrid minWidth={220} gap={8}>
        <KpiCard title={t('reportKpi.paperlessRate')} value={`${val('kpi-082')?.value ?? 92}%`} sub={t('reportKpi.savePaper')} icon={<Leaf size={20} />} color="success" />
        <KpiCard title={t('reportKpi.filmFreeRate')} value={`${val('kpi-081')?.value ?? 86}%`} sub={t('reportKpi.reduceFilmWaste')} icon={<Cloud size={20} />} color="info" />
        <KpiCard title={t('reportKpi.carbonReduction')} value={`${(val('kpi-082')?.value ?? 92) * 0.013} t`} sub={t('reportKpi.monthCumulative')} icon={<Gauge size={20} />} color="success" />
      </KpiCardGrid>
    </div>
  );
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
