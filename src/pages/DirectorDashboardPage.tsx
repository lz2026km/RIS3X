import React, { useState, useEffect, useCallback } from 'react';
// [W3-B] 主任驾驶舱 — 接入 statsApi / biApi 真实数据 (loading/error + 演示数据回退)
import { statsApi } from '../services/api/statsApi';
import { biApi } from '../services/api/biApi';
// [v3.0.6.8-28] 主数据池 + 生成器
import { DOCTOR_MASTER, DEVICE_MASTER } from '../data/master';
import {
  DOCTOR_PERFORMANCE_PRE, EXAM_REPORT_PRE, QUALITY_SCORE_PRE, DAILY_KPI_PRE,
} from '../data/_generators';
// [v3.0.6.11-103 Wave 6] 仪表盘卡片化组件
import { KpiCard, KpiCardGrid, DashboardCard, TrendChart, ProgressRing, SkeletonKpi } from '../components/dashboard';
import { Wrench, Trophy, Coins, Gauge, FileText, AlertOctagon, CheckCircle2, DollarSign, Scan, Activity, LineChart as LineChartIcon } from 'lucide-react';

// ============================================================
// [v3.0.6.8-28] 医生数据 - 来源: DOCTOR_PERFORMANCE_PRE 当前月聚合 (top 10 by reportCount)
// ============================================================
const staticDoctors = (() => {
  const currentMonth = DOCTOR_PERFORMANCE_PRE.filter((p) => p.month === '2026-06' && (p.title === '主任医师' || p.title === '副主任医师' || p.title === '主治医师' || p.title === '住院医师'));
  const byDoctor: Record<string, { id: string; name: string; title: string; reportCount: number; defectCount: number; criticalCount: number; cosignCount: number; avgTAT: number; qcScore: number; }> = {};
  currentMonth.forEach((p) => {
    if (!byDoctor[p.doctorId]) byDoctor[p.doctorId] = { id: p.doctorId, name: p.doctorName, title: p.title, reportCount: 0, defectCount: 0, criticalCount: 0, cosignCount: 0, avgTAT: 0, qcScore: 0 };
    const d = byDoctor[p.doctorId]!;
    d.reportCount += p.reportCount;
    d.defectCount += p.defectCount;
    d.criticalCount += p.criticalValueCount;
    d.cosignCount += p.cosignCount;
    d.avgTAT += p.avgTAT;
    d.qcScore += p.qcScore;
  });
  return Object.values(byDoctor)
    .map((d) => {
      const n = currentMonth.filter((p) => p.doctorId === d.id).length || 1;
      return {
        id: d.id, name: d.name, title: d.title,
        exams: d.reportCount + d.cosignCount,
        reports: d.reportCount,
        positiveRate: Math.round(60 + (d.qcScore / n - 80) * 2),
        modifyRate: Math.round((d.defectCount / Math.max(d.reportCount, 1)) * 1000) / 10,
        formatScore: Math.round((d.qcScore / n) - 2),
        diagScore: Math.round((d.qcScore / n) + 1),
        timeScore: Math.round((d.qcScore / n) - 1),
      };
    })
    .sort((a, b) => b.reports - a.reports)
    .slice(0, 10);
})()

// ============================================================
// [v3.0.6.8-28] 设备数据 - 来源: DEVICE_MASTER 取前 8 台
// ============================================================
const staticDevices = DEVICE_MASTER.slice(0, 8).map((d) => ({
  id: d.id,
  name: d.model,
  type: d.modality === 'US' ? 'US' : d.modality,
  utilization: Math.round((100 - (d.monthlyDowntime / 720) * 100)),
  fullRate: Math.round(d.doseComplianceRate),
  faultRate: Math.round(d.defectRate * 100) / 10,
}));

// ============================================================
// [v3.0.6.8-28] 技师数据 - 来源: DOCTOR_MASTER 中 title=技师/主管技师/副主任技师
// ============================================================
const staticTechnicians = DOCTOR_MASTER.filter((d) => d.title === '技师' || d.title === '主管技师' || d.title === '副主任技师' || d.title === '技士')
  .slice(0, 6)
  .map((d) => ({
    id: d.id,
    name: d.name,
    title: d.title,
    exams: d.monthlyExamCount,
    reports: d.monthlyReportCount,
    utilization: Math.round(75 + Math.random() * 20),
  }));

// ============================================================
// [v3.0.6.8-28] 30天收入数据 - 来源: DAILY_KPI_PRE × 400 元/检查
// ============================================================
const staticDailyRevenue = DAILY_KPI_PRE.map((d, idx) => ({
  day: idx + 1,
  revenue: d.examCount * 400,
}));

// ============================================================
// [v3.0.6.8-28] 检查项目收入分布 - 来源: EXAM_REPORT_PRE 按 modality 聚合
// ============================================================
const staticExamRevenue = (() => {
  const priceMap: Record<string, number> = { CT: 400, MR: 800, DR: 80, US: 120, MG: 200, DSA: 3500 };
  const counts: Record<string, number> = {};
  EXAM_REPORT_PRE.forEach((r) => { counts[r.modality] = (counts[r.modality] || 0) + 1; });
  const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
  const labelMap: Record<string, string> = { CT: 'CT检查', MR: 'MRI检查', DR: 'X线摄影', US: '超声检查', DSA: 'DSA造影', MG: '钼靶' };
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([mod, count]) => ({
      name: labelMap[mod] || mod,
      amount: Math.round(count * (priceMap[mod] || 200)),
      percent: Math.round((count / total) * 100),
      count,
    }));
})()

// ============================================================
// 卫材成本 - 保留 (运营成本, 无主数据来源)
// ============================================================
const staticMaterialCost = {
  contrastAgent: 125600,
  film: 45600,
  syringe: 28300,
  needle: 18900,
  other: 34200,
  total: 252600,
};

// ============================================================
// [v3.0.6.8-28] 质控问题统计 - 来源: QUALITY_SCORE_PRE.defects 聚合
// ============================================================
const staticQcIssues = (() => {
  const issueTypeMap: Record<string, string> = {
    'DSC-001': '描述与结论不符',
    'DSC-002': '描述不完整',
    'FMT-001': '报告格式不规范',
    'FMT-002': '模板使用错误',
    'LOG-001': '逻辑错误',
    'TIM-001': '超时完成报告',
    'TER-001': '术语不规范',
    'IMG-001': '图像质量不达标',
    'MEAS-001': '测量错误',
  };
  const counts: Record<string, number> = {};
  QUALITY_SCORE_PRE.forEach((q) => {
    q.defects.forEach((d) => {
      const name = issueTypeMap[d] || d;
      counts[name] = (counts[name] || 0) + 1;
    });
  });
  const total = QUALITY_SCORE_PRE.length || 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count, rate: Math.round((count / total) * 1000) / 10 }));
})()

// ============================================================
// 顶部统计卡片类型
// ============================================================
interface StatCardData {
  label: string;
  value: string;
  subValue?: string;
  color?: string;
}

// ============================================================
// [W3-B] 实时数据模型 + 演示数据回退
// ============================================================
interface LiveDirectorDoctor { id: string; name: string; title: string; exams: number; reports: number; positiveRate: number; modifyRate: number; formatScore: number; diagScore: number; timeScore: number }
interface LiveDirectorDevice { id: string; name: string; type: string; utilization: number; fullRate: number; faultRate: number }
interface LiveDirectorRevenue { day: number; revenue: number }
interface LiveDirectorExamRevenue { name: string; amount: number; percent: number; count: number }
interface LiveDirectorData {
  doctors: LiveDirectorDoctor[];
  devices: LiveDirectorDevice[];
  dailyRevenue: LiveDirectorRevenue[];
  examRevenue: LiveDirectorExamRevenue[];
  todayStats: StatCardData[];
}

// 静态演示统计卡 (API 不可用时回退)
const staticTodayStats: StatCardData[] = [
  { label: '今日检查总量', value: '856', subValue: 'CT: 285 | MR: 198 | DXR: 373' },
  { label: '报告书写量', value: '782', subValue: '今日: 142 | 本周: 856 | 本月: 3248' },
  { label: '阳性检出率', value: '58.6%', subValue: '较上月 +2.3%', color: '#22c55e' },
  { label: '危急值处理率', value: '98.2%', subValue: '待处理: 2例', color: '#1e40af' },
  { label: '设备使用率', value: '77.8%', subValue: '运行中: 6/8台', color: '#f59e0b' },
  { label: '当日收入', value: '¥142,850', subValue: '较昨日 +5.2%', color: '#22c55e' },
];

// ============================================================
// Tab类型
// ============================================================
type TabType = 'workload' | 'equipment' | 'quality' | 'revenue';

// ============================================================
// 主组件
// ============================================================
const DirectorDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('workload');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveDirectorData | null>(null);
  const [fallbackBlocks, setFallbackBlocks] = useState<string[]>([]);

  // 实时优先, 演示数据回退
  const doctors = live?.doctors?.length ? live.doctors : staticDoctors;
  const devices = live?.devices?.length ? live.devices : staticDevices;
  const technicians = staticTechnicians;
  const dailyRevenue = live?.dailyRevenue?.length ? live.dailyRevenue : staticDailyRevenue;
  const examRevenue = live?.examRevenue?.length ? live.examRevenue : staticExamRevenue;
  const qcIssues = staticQcIssues;
  const materialCost = staticMaterialCost;
  const todayStats = live?.todayStats ?? staticTodayStats;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dailyR, trendR, workloadR, kpiR, slaR, oeeR, byModR] = await Promise.allSettled([
        statsApi.getDaily(),
        statsApi.getTrend(30),
        statsApi.getWorkload(),
        biApi.getKpi(),
        biApi.getCriticalSla(),
        biApi.getDeviceOee(14),
        statsApi.getByModality(),
      ]);
      const ok = (r: PromiseSettledResult<any>): boolean => r.status === 'fulfilled' && r.value?.success === true && r.value.data != null;
      const val = (r: PromiseSettledResult<any>): any => (r.status === 'fulfilled' ? r.value?.data : null);
      const daily = ok(dailyR) ? val(dailyR) : null;
      const trend = ok(trendR) && Array.isArray(val(trendR)) ? val(trendR) : [];
      const workload = ok(workloadR) && Array.isArray(val(workloadR)) ? val(workloadR) : [];
      const kpiEnv = ok(kpiR) ? val(kpiR) : null;
      const slaEnv = ok(slaR) ? val(slaR) : null;
      const oeeEnv = ok(oeeR) ? val(oeeR) : null;
      const byMod = ok(byModR) && typeof val(byModR) === 'object' ? val(byModR) : null;
      const kpi = kpiEnv?.data ?? null;
      const sla = slaEnv?.data ?? null;
      const oeeDevices = Array.isArray(oeeEnv?.data?.devices) ? oeeEnv.data.devices : [];

      const hasAny = !!daily || trend.length > 0 || workload.length > 0 || oeeDevices.length > 0 || !!kpi || !!sla;
      if (!hasAny) {
        setLive(null);
        setFallbackBlocks(['全部区块']);
        return;
      }

      const fb: string[] = [];
      if (!daily) fb.push('今日统计卡');
      if (trend.length === 0) fb.push('每日收入趋势');
      if (workload.length === 0) fb.push('医生工作量排名');
      if (byMod == null) fb.push('检查项目收入分布');
      fb.push('技师工作量排名', '质控问题统计', '卫材成本');

      // 医生排名: stats.workload (score → 综合评分)
      const liveDoctors: LiveDirectorDoctor[] = workload.slice(0, 10).map((w: any) => {
        const reportCount = Number(w.reportCount ?? w.totalReports ?? 0);
        const examCount = Number(w.examCount ?? reportCount);
        const score = Math.min(100, Math.max(0, Number(w.score ?? w.avgQCScore ?? 0)));
        return {
          id: String(w.doctorId ?? ''),
          name: String(w.doctorName ?? '未知'),
          title: String(w.title ?? '医师'),
          exams: examCount,
          reports: reportCount,
          positiveRate: 0,
          modifyRate: 0,
          formatScore: Math.round(score),
          diagScore: Math.round(score),
          timeScore: Math.round(score),
        };
      });

      // 设备: biApi.device-oee (availability→使用率, performance→满员率)
      const liveDevices: LiveDirectorDevice[] = oeeDevices.map((d: any) => ({
        id: String(d.deviceId ?? ''),
        name: String(d.deviceName ?? ''),
        type: String(d.modality ?? ''),
        utilization: Math.round(Number(d.avgAvailability ?? 0)),
        fullRate: Math.round(Number(d.avgPerformance ?? 0)),
        faultRate: 0,
      }));

      // 每日收入: stats.trend × 400元/例 (估算)
      const liveDailyRevenue: LiveDirectorRevenue[] = trend.map((t: any, i: number) => ({
        day: i + 1,
        revenue: Number(t.examCount ?? 0) * 400,
      }));

      // 检查项目收入分布: stats.by-modality
      const priceMap: Record<string, number> = { CT: 400, MR: 800, DR: 80, US: 120, MG: 200, DSA: 3500 };
      const labelMap: Record<string, string> = { CT: 'CT检查', MR: 'MRI检查', DR: 'X线摄影', US: '超声检查', DSA: 'DSA造影', MG: '钼靶' };
      const counts: Record<string, number> = {};
      for (const [mod, v] of Object.entries(byMod ?? {})) {
        const rec = v as Record<string, unknown>;
        counts[mod] = Number(rec?.total ?? 0);
      }
      const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
      const liveExamRevenue: LiveDirectorExamRevenue[] = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([mod, count]) => ({
          name: labelMap[mod] || mod,
          amount: Math.round(count * (priceMap[mod] || 200)),
          percent: Math.round((count / total) * 100),
          count,
        }));

      // 顶部统计卡: stats.daily / bi.kpi / bi.critical-sla / bi.device-oee
      const byModality = (daily?.byModality ?? {}) as Record<string, number>;
      const modSub = Object.entries(byModality).map(([m, c]) => `${m}: ${c}`).join(' | ');
      const oeeAvg = oeeDevices.length > 0 ? Math.round(oeeDevices.reduce((s: number, d: any) => s + Number(d.avgOee ?? 0), 0) / oeeDevices.length) : 0;
      const dailyExams = Number(daily?.examCount ?? 0);
      const dailyReports = Number(daily?.reportCount ?? 0);
      const liveTodayStats: StatCardData[] = [
        { label: '今日检查总量', value: daily ? String(dailyExams) : '—', subValue: modSub || '—' },
        { label: '报告书写量', value: daily ? String(dailyReports) : '—', subValue: daily ? `待写: ${Math.max(0, dailyExams - dailyReports)} 份` : '—' },
        { label: '危急值处理率', value: sla ? `${sla.complianceRate}%` : '—', subValue: sla ? `待处理: ${(sla.overdue ?? []).length} 例` : '—', color: '#1e40af' },
        { label: '报告完成率', value: kpi ? `${kpi.completionRate}%` : '—', subValue: kpi ? `平均 ${kpi.avgReportMinutes} min` : '—', color: '#22c55e' },
        { label: '设备平均OEE', value: oeeAvg ? `${oeeAvg}%` : '—', subValue: oeeDevices.length ? `监控 ${oeeDevices.length} 台` : '—', color: '#f59e0b' },
        { label: '当日收入(估算)', value: daily ? `¥${(dailyExams * 400).toLocaleString()}` : '—', subValue: '按 400元/例 估算', color: '#22c55e' },
      ];

      setLive({ doctors: liveDoctors, devices: liveDevices, dailyRevenue: liveDailyRevenue, examRevenue: liveExamRevenue, todayStats: liveTodayStats });
      setFallbackBlocks(fb);
    } catch (e) {
      setError(e instanceof Error ? e.message : '数据加载失败，已展示演示数据');
      setLive(null);
      setFallbackBlocks(['全部区块']);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const dataAvailable = doctors.length > 0;

  // 样式定义
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: 'var(--bg-card)',
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    } as React.CSSProperties,
    header: {
      backgroundColor: 'var(--bg-card)',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      borderLeft: '4px solid #1e40af',
    } as React.CSSProperties,
    headerTitle: {
      fontSize: '24px',
      fontWeight: '600',
      color: 'var(--text-primary)',
      marginBottom: '8px',
    } as React.CSSProperties,
    headerSubtitle: {
      fontSize: '14px',
      color: 'var(--text-secondary)',
    } as React.CSSProperties,
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '16px',
      marginBottom: '24px',
    } as React.CSSProperties,
    statCard: {
      backgroundColor: 'var(--bg-card)',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      borderTop: '3px solid #1e40af',
    } as React.CSSProperties,
    statValue: {
      fontSize: '28px',
      fontWeight: '700',
      color: '#1e40af',
      marginBottom: '4px',
    } as React.CSSProperties,
    statLabel: {
      fontSize: '13px',
      color: 'var(--text-secondary)',
      marginBottom: '8px',
    } as React.CSSProperties,
    statSub: {
      fontSize: '12px',
      color: 'var(--text-secondary)',
    } as React.CSSProperties,
    tabContainer: {
      backgroundColor: 'var(--bg-card)',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden',
    } as React.CSSProperties,
    tabHeader: {
      display: 'flex',
      borderBottom: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-card)',
    } as React.CSSProperties,
    tabButton: (active: boolean) => ({
      padding: '14px 24px',
      fontSize: '14px',
      fontWeight: active ? '600' : '500',
      color: active ? '#1e40af' : '#64748b',
      backgroundColor: active ? 'var(--bg-card)' : 'transparent',
      border: 'none',
      borderBottom: active ? '2px solid #1e40af' : '2px solid transparent',
      cursor: 'pointer',
      transition: 'all 0.2s',
    } as React.CSSProperties),
    tabContent: {
      padding: '24px',
    } as React.CSSProperties,
    sectionTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: 'var(--text-primary)',
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: '1px solid var(--border-color)',
    } as React.CSSProperties,
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      fontSize: '13px',
    } as React.CSSProperties,
    th: {
      padding: '12px',
      textAlign: 'left' as const,
      backgroundColor: 'var(--bg-card)',
      color: 'var(--text-secondary)',
      fontWeight: '600',
      borderBottom: '1px solid var(--border-color)',
    } as React.CSSProperties,
    td: {
      padding: '12px',
      borderBottom: '1px solid var(--border-color)',
      color: 'var(--text-primary)',
    } as React.CSSProperties,
    badge: (color: string) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 10px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: color,
      color: '#ffffff',
    } as React.CSSProperties),
    chartContainer: {
      display: 'flex',
      gap: '8px',
      alignItems: 'flex-end',
      height: '200px',
      padding: '16px 0',
    } as React.CSSProperties,
    chartBar: (height: number, color: string) => ({
      flex: 1,
      height: `${height}%`,
      backgroundColor: color,
      borderRadius: '4px 4px 0 0',
      transition: 'height 0.3s ease',
      position: 'relative' as const,
    } as React.CSSProperties),
    lineChart: {
      width: '100%',
      height: '200px',
      position: 'relative' as const,
    } as React.CSSProperties,
    pieChartContainer: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '16px',
    } as React.CSSProperties,
    pieItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 16px',
      backgroundColor: 'var(--bg-card)',
      borderRadius: '8px',
      minWidth: '180px',
    } as React.CSSProperties,
    pieColor: (color: string) => ({
      width: '16px',
      height: '16px',
      borderRadius: '4px',
      backgroundColor: color,
    } as React.CSSProperties),
    scoreContainer: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '12px',
      marginTop: '8px',
    } as React.CSSProperties,
    scoreItem: (color: string) => ({
      padding: '8px',
      backgroundColor: color + '15',
      borderRadius: '6px',
      textAlign: 'center' as const,
      border: `1px solid ${color}30`,
    } as React.CSSProperties),
    grid2Col: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '24px',
    } as React.CSSProperties,
    progressBar: {
      height: '8px',
      backgroundColor: '#e2e8f0',
      borderRadius: '4px',
      overflow: 'hidden',
      marginTop: '6px',
    } as React.CSSProperties,
    progressFill: (width: string, color: string) => ({
      height: '100%',
      width: width,
      backgroundColor: color,
      borderRadius: '4px',
    } as React.CSSProperties),
  };

  // 颜色
  const colors = ['#1e40af', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const utilizationColor = (rate: number) => {
    if (rate > 85) return '#22c55e';
    if (rate > 70) return '#eab308';
    return '#ef4444';
  };

  // 排名奖励
  const getRankBadge = (rank: number) => {
    if (rank === 1) return { emoji: '🥇', text: '金牌', bg: '#f59e0b22', color: '#92400e' };
    if (rank === 2) return { emoji: '🥈', text: '银牌', bg: 'var(--bg-deep)', color: 'var(--text-secondary)' };
    if (rank === 3) return { emoji: '🥉', text: '铜牌', bg: '#f9731622', color: '#9a3412' };
    return null;
  };

  // 渲染Tab1: 工作量排名
  const renderWorkloadTab = () => (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* [v3.0.6.11-103 Wave 6] DashboardCard 卡片化 */}
      <DashboardCard title="医生工作量排名" icon={<Trophy size={14} />} bodyPadding={0}>
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '50px' }}>排名</th>
              <th style={styles.th}>姓名</th>
              <th style={styles.th}>职称</th>
              <th style={styles.th}>检查数</th>
              <th style={styles.th}>报告数</th>
              <th style={styles.th}>阳性率</th>
              <th style={styles.th}>修改率</th>
              <th style={styles.th}>综合评分</th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((doc, idx) => {
              const rank = getRankBadge(idx + 1);
              const totalScore = (doc.formatScore + doc.diagScore + doc.timeScore) / 3;
              return (
                <tr key={doc.id}>
                  <td style={styles.td}>
                    {rank ? (
                      <span style={styles.badge(rank.bg)}>
                        <span>{rank.emoji}</span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{idx + 1}</span>
                    )}
                  </td>
                  <td style={{ ...styles.td, fontWeight: '600', color: rank ? '#92400e' : 'var(--text-primary)' }}>
                    {doc.name}
                  </td>
                  <td style={styles.td}>{doc.title}</td>
                  <td style={styles.td}>{doc.exams}</td>
                  <td style={styles.td}>{doc.reports}</td>
                  <td style={{ ...styles.td, color: doc.positiveRate > 60 ? '#22c55e' : '#64748b' }}>
                    {doc.positiveRate > 0 ? `${doc.positiveRate}%` : '—'}
                  </td>
                  <td style={{ ...styles.td, color: doc.modifyRate > 5 ? '#ef4444' : '#64748b' }}>
                    {doc.modifyRate > 0 ? `${doc.modifyRate}%` : '—'}
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      padding: '4px 8px',
                      backgroundColor: totalScore > 92 ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                      color: totalScore > 92 ? '#166534' : '#92400e',
                      borderRadius: '4px',
                      fontWeight: '600',
                    }}>
                      {totalScore.toFixed(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </DashboardCard>

      <DashboardCard title="技师工作量排名" icon={<Wrench size={14} />} bodyPadding={0}>
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '50px' }}>排名</th>
              <th style={styles.th}>姓名</th>
              <th style={styles.th}>职称</th>
              <th style={styles.th}>检查数</th>
              <th style={styles.th}>报告数</th>
              <th style={styles.th}>设备使用率</th>
            </tr>
          </thead>
          <tbody>
            {technicians.map((tech, idx) => {
              const rank = getRankBadge(idx + 1);
              return (
                <tr key={tech.id}>
                  <td style={styles.td}>
                    {rank ? (
                      <span style={styles.badge(rank.bg)}>{rank.emoji}</span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{idx + 1}</span>
                    )}
                  </td>
                  <td style={{ ...styles.td, fontWeight: '600', color: rank ? '#92400e' : 'var(--text-primary)' }}>
                    {tech.name}
                  </td>
                  <td style={styles.td}>{tech.title}</td>
                  <td style={styles.td}>{tech.exams}</td>
                  <td style={styles.td}>{tech.reports}</td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ ...styles.progressBar, width: '100px' }}>
                        <div style={styles.progressFill(`${tech.utilization}%`, utilizationColor(tech.utilization))} />
                      </div>
                      <span style={{ color: utilizationColor(tech.utilization), fontWeight: '600' }}>
                        {tech.utilization}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </DashboardCard>
    </div>
  );

  // 渲染Tab2: 设备效率看板
  const renderEquipmentTab = () => (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* [v3.0.6.11-103 Wave 6] 设备使用率 → TrendChart 柱状 + ProgressRing 平均 */}
      <DashboardCard
        title="设备使用率柱状图"
        icon={<Gauge size={14} />}
        extra={
          devices.length > 0 ? (
            <ProgressRing
              percent={Math.round(devices.reduce((s: number, d: any) => s + Number(d.utilization ?? 0), 0) / devices.length)}
              size={56}
              strokeWidth={6}
              subLabel="平均"
            />
          ) : undefined
        }
      >
        <TrendChart
          type="bar"
          data={devices.map((d) => ({
            name: d.name.length > 8 ? d.name.substring(0, 7) + '..' : d.name,
            value: d.utilization,
          }))}
          xKey="name"
          series={[{ key: 'value', name: '使用率', color: '#3b82f6' }]}
          height={220}
          percent
        />
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ width: '12px', height: '12px', backgroundColor: '#22c55e', borderRadius: '2px' }}></span>
            优良 (&gt;85%)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ width: '12px', height: '12px', backgroundColor: '#eab308', borderRadius: '2px' }}></span>
            正常 (70-85%)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ width: '12px', height: '12px', backgroundColor: '#ef4444', borderRadius: '2px' }}></span>
            偏低 (&lt;70%)
          </span>
        </div>
      </DashboardCard>

      <div style={styles.grid2Col}>
        <DashboardCard title="设备预约满员率排名" icon={<CheckCircle2 size={14} />} bodyPadding={0}>
          <div style={{ overflowX: "auto" }}><table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>设备</th>
                <th style={styles.th}>满员率</th>
                <th style={styles.th}>状态</th>
              </tr>
            </thead>
            <tbody>
              {[...devices].sort((a, b) => b.fullRate - a.fullRate).map((device) => (
                <tr key={device.id}>
                  <td style={styles.td}>{device.name}</td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ ...styles.progressBar, width: '100px' }}>
                        <div style={styles.progressFill(`${device.fullRate}%`, '#1e40af')} />
                      </div>
                      <span style={{ fontWeight: '600' }}>{device.fullRate}%</span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      backgroundColor: device.fullRate > 85 ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                      color: device.fullRate > 85 ? '#166534' : '#92400e',
                    }}>
                      {device.fullRate > 85 ? '繁忙' : '可预约'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </DashboardCard>

        <DashboardCard title="设备故障率统计" icon={<AlertOctagon size={14} />} bodyPadding={0}>
          <div style={{ overflowX: "auto" }}><table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>设备</th>
                <th style={styles.th}>故障率</th>
                <th style={styles.th}>风险等级</th>
              </tr>
            </thead>
            <tbody>
              {[...devices].sort((a, b) => b.faultRate - a.faultRate).map((device) => (
                <tr key={device.id}>
                  <td style={styles.td}>{device.name}</td>
                  <td style={styles.td}>
                    <span style={{ fontWeight: '600', color: device.faultRate > 2 ? '#ef4444' : '#64748b' }}>
                      {device.faultRate > 0 ? `${device.faultRate}%` : '—'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      backgroundColor: device.faultRate > 2 ? 'var(--color-error-bg)' : device.faultRate > 1 ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
                      color: device.faultRate > 2 ? '#991b1b' : device.faultRate > 1 ? '#92400e' : '#166534',
                    }}>
                      {device.faultRate > 2 ? '高' : device.faultRate > 1 ? '中' : '低'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </DashboardCard>
      </div>
    </div>
  );

  // 渲染Tab3: 质控评分榜
  const renderQualityTab = () => (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* [v3.0.6.11-103 Wave 6] DashboardCard 卡片化 */}
      <DashboardCard title="医生报告质量评分排名" icon={<Trophy size={14} />} bodyPadding={0}>
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '50px' }}>排名</th>
              <th style={styles.th}>姓名</th>
              <th style={styles.th}>综合评分</th>
              <th style={styles.th}>格式规范</th>
              <th style={styles.th}>诊断准确</th>
              <th style={styles.th}>时效性</th>
              <th style={styles.th}>三维评分</th>
            </tr>
          </thead>
          <tbody>
            {doctors
              .map(d => ({
                ...d,
                totalScore: (d.formatScore + d.diagScore + d.timeScore) / 3
              }))
              .sort((a, b) => b.totalScore - a.totalScore)
              .map((doc, idx) => {
                const rank = getRankBadge(idx + 1);
                return (
                  <tr key={doc.id}>
                    <td style={styles.td}>
                      {rank ? (
                        <span style={styles.badge(rank.bg)}>{rank.emoji}</span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{idx + 1}</span>
                      )}
                    </td>
                    <td style={{ ...styles.td, fontWeight: '600', color: rank ? '#92400e' : 'var(--text-primary)' }}>
                      {doc.name}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        padding: '4px 12px',
                        backgroundColor: doc.totalScore > 92 ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                        color: doc.totalScore > 92 ? '#166534' : '#92400e',
                        borderRadius: '4px',
                        fontWeight: '700',
                        fontSize: '14px',
                      }}>
                        {doc.totalScore.toFixed(1)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.scoreItem('#3b82f6')}>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e40af' }}>{doc.formatScore}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>分</div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.scoreItem('#10b981')}>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#059669' }}>{doc.diagScore}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>分</div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.scoreItem('#f59e0b')}>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#d97706' }}>{doc.timeScore}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>分</div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <div style={{ width: '6px', height: '24px', backgroundColor: '#3b82f6', borderRadius: '2px' }} />
                        <div style={{ width: '6px', height: '24px', backgroundColor: '#10b981', borderRadius: '2px' }} />
                        <div style={{ width: '6px', height: '24px', backgroundColor: '#f59e0b', borderRadius: '2px' }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table></div>
      </DashboardCard>

      <DashboardCard title="质控问题统计（本月）" icon={<AlertOctagon size={14} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {qcIssues.map((issue) => (
            <div key={issue.type} style={{
              padding: '16px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              textAlign: 'center' as const,
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e40af' }}>{issue.count}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{issue.type}</div>
              <div style={{
                marginTop: '8px',
                padding: '2px 8px',
                backgroundColor: issue.rate > 3 ? 'var(--color-error-bg)' : 'var(--color-warning-bg)',
                color: issue.rate > 3 ? '#991b1b' : '#92400e',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600',
              }}>
                {issue.rate}%
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );

  // 渲染Tab4: 收入与成本
  const renderRevenueTab = () => {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {/* [v3.0.6.11-103 Wave 6] 每日收入折线图 → TrendChart */}
        <DashboardCard title="每日收入折线图（近30天 · 按 400元/例 估算）" icon={<LineChartIcon size={14} />}>
          <TrendChart
            type="line"
            data={dailyRevenue.map(d => ({ day: `D${d.day}`, revenue: d.revenue }))}
            xKey="day"
            series={[{ key: 'revenue', name: '收入', color: '#1e40af' }]}
            height={200}
            yTickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`}
          />
        </DashboardCard>

        <div style={styles.grid2Col}>
          <DashboardCard title="检查项目收入分布" icon={<Coins size={14} />}>
            <div style={styles.pieChartContainer}>
              {examRevenue.map((item, idx) => (
                <div key={item.name} style={styles.pieItem}>
                  <div style={styles.pieColor(colors[idx])} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{item.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>¥{(item.amount / 10000).toFixed(0)}万 ({item.percent}%)</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '16px', textAlign: 'center' as const, fontSize: '14px', color: 'var(--text-secondary)' }}>
              总收入: <span style={{ fontWeight: '700', color: '#1e40af' }}>¥{(examRevenue.reduce((a, b) => a + b.amount, 0) / 10000).toFixed(0)}万元</span>
            </div>
          </DashboardCard>

          <DashboardCard title="卫材成本统计" icon={<DollarSign size={14} />}>
            <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>造影剂</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>¥{materialCost.contrastAgent.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>胶片</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>¥{materialCost.film.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>注射器</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>¥{materialCost.syringe.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>针头</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>¥{materialCost.needle.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>其他耗材</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>¥{materialCost.other.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#1e40af', borderRadius: '6px', marginTop: '4px' }}>
                  <span style={{ fontWeight: '600', color: '#ffffff' }}>总计成本</span>
                  <span style={{ fontWeight: '700', color: '#ffffff' }}>¥{materialCost.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </DashboardCard>
        </div>
      </div>
    );
  };

  if (loading) {
    // [v3.0.6.11-103 Wave 6] 骨架屏加载态
    return (
      <div role="status" data-testid="director-loading" style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          {Array.from({ length: 6 }, (_, i) => <SkeletonKpi key={i} testId={`director-kpi-skeleton-${i}`} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ height: 280, borderRadius: 12, background: 'var(--skeleton-bg, #e2e8f0)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: 280, borderRadius: 12, background: 'var(--skeleton-bg, #e2e8f0)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
    );
  }
  if (!dataAvailable) {
    return (
      <div data-testid="director-empty" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>暂无主任驾驶舱数据</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>请等待今日检查量与审核数据汇总后刷新</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 头部 */}
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={styles.headerTitle}>主任综合管理驾驶舱</div>
            <div style={styles.headerSubtitle}>
              汉东省人民医院 · 放射科 | 数据更新时间: {new Date().toLocaleString('zh-CN')}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {live && (
              <span style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'var(--color-success-bg)', color: '#166534' }}>
                statsApi / biApi 实时
              </span>
            )}
            {!live && (
              <span style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'var(--color-warning-bg)', color: '#92400e' }}>
                演示数据
              </span>
            )}
            <button
              onClick={() => void load()}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: '#1e40af', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              🔄 刷新
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--color-error-bg)', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '10px 16px', fontSize: 13, marginBottom: 16 }}>
          {error}
          <button onClick={() => void load()} style={{ marginLeft: 12, padding: '3px 10px', borderRadius: 4, border: '1px solid #b91c1c', background: 'transparent', color: '#b91c1c', cursor: 'pointer', fontSize: 12 }}>重试</button>
        </div>
      )}
      {fallbackBlocks.length > 0 && (
        <div style={{ background: 'var(--color-warning-bg)', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, padding: '10px 16px', fontSize: 12, marginBottom: 16 }}>
          以下区块为演示数据: {fallbackBlocks.join(' / ')}
        </div>
      )}

      {/* 顶部 KPI 卡行 (v3.0.6.11-103 Wave 6: KpiCard 卡片化) */}
      <KpiCardGrid minWidth={230} style={{ marginBottom: 24 }}>
        {todayStats.map((stat, idx) => {
          const color = stat.color === '#22c55e' ? 'success' : stat.color === '#f59e0b' ? 'warning' : stat.color === '#1e40af' ? 'primary' : 'primary';
          const icons = [<Scan size={20} key="i" />, <FileText size={20} key="i" />, <AlertOctagon size={20} key="i" />, <CheckCircle2 size={20} key="i" />, <Gauge size={20} key="i" />, <DollarSign size={20} key="i" />];
          return (
            <KpiCard
              key={idx}
              title={stat.label}
              value={stat.value}
              icon={icons[idx] ?? <Activity size={20} />}
              color={color}
              sub={stat.subValue}
              testId={`director-kpi-${idx}`}
            />
          );
        })}
      </KpiCardGrid>

      {/* Tab容器 */}
      <div style={styles.tabContainer}>
        <div style={styles.tabHeader}>
          <button
            style={styles.tabButton(activeTab === 'workload')}
            onClick={() => setActiveTab('workload')}
          >
            📊 工作量排名
          </button>
          <button
            style={styles.tabButton(activeTab === 'equipment')}
            onClick={() => setActiveTab('equipment')}
          >
            🔧 设备效率看板
          </button>
          <button
            style={styles.tabButton(activeTab === 'quality')}
            onClick={() => setActiveTab('quality')}
          >
            🏆 质控评分榜
          </button>
          <button
            style={styles.tabButton(activeTab === 'revenue')}
            onClick={() => setActiveTab('revenue')}
          >
            💰 收入与成本
          </button>
        </div>
        <div style={styles.tabContent}>
          {activeTab === 'workload' && renderWorkloadTab()}
          {activeTab === 'equipment' && renderEquipmentTab()}
          {activeTab === 'quality' && renderQualityTab()}
          {activeTab === 'revenue' && renderRevenueTab()}
        </div>
      </div>
    </div>
  );
};

export default DirectorDashboardPage;
