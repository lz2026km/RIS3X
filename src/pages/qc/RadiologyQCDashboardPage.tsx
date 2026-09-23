/**
 * @deprecated [v3.0.6.11-103 Wave 10] 重复页面精简合并: 本页已嵌入 QCPage "放射质控总览" Tab (src/pages/QCPage.tsx), 文件保留, 旧路由 /qc-dashboard 已 redirect → /qc。功能未删除, 请勿单独继续扩展本页。
 * G005 RIS v3.0.6.8-27 - 放射科质控总看板 (RADIOLOGY QC DASHBOARD)
 * Phase 4 新页面: 聚合 10 大子模块质控 KPI
 *
 * 子模块:
 *  - 影像质控 (Image QC) - 设备 A/B/C/D 等级分布
 *  - 报告质控 (Report QC) - 甲级率/乙级率/缺陷率
 *  - 流程质控 (Workflow QC) - 危急值响应 / 签发及时性
 *  - 设备质控 (Equipment QC) - 设备利用率 / 故障率
 *  - 人员质控 (Personnel QC) - 医生工作量
 *  - 运营质控 (Operations QC) - 收入 / 成本
 *  - 对比学习 (Comparative Study) - 案例库数量
 *  - AI 质控 (AI QC) - AI 误报率
 *  - 质控看板 - 实时聚合
 *  - CQI 持续改进 - PDCA 项目
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { ShieldCheck, Activity, AlertOctagon, FileText, Users, Monitor, Camera, BarChart3, TrendingUp, CheckCircle, Clock, Award, Target, Layers, Sparkles, GitBranch, RefreshCw, Medal, ThumbsDown, Database } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, ComposedChart,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, AreaChart,
} from 'recharts';
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { StatCard, StatCardGrid } from "../../components/common/StatCard";
import { StickyActionBar } from "../../components/common/StickyActionBar";
import { ExportButton } from "../../components/common/ExportButton";
import { DOCTOR_MASTER, DOCTORS_BY_TITLE, DEVICE_MASTER, DEVICES_BY_STATUS } from '../../data/master';
import { DOCTOR_PERFORMANCE_PRE, DAILY_KPI_PRE } from "../../data/_generators";
import { qcextApi, type QcDashboardDto, type QcStatsDto } from '../../services/api/qcextApi';
// [v3.0.6.11-99 Wave10B] 质控看板深化: 图像质控三维度历史 (qcImageAiApi)
import { qcImageAiApi, type QcAiAssessRecord } from '../../services/api/qcImageAiApi';
import { reportQualityApi } from '../../services/api/reportQualityApi';
import { LoadingBanner, ErrorBanner } from '../../components/feedback';
import { t } from '../../i18n/appI18n';

type QCTab = "overview" | "image" | "report" | "workflow" | "equipment" | "personnel" | "operations" | "ai" | "cqi";

function downloadCsv(filename: string, sections: Array<{ title: string; rows: (string | number)[][] }>) {
  const lines: string[] = [];
  sections.forEach((s) => {
    lines.push(`### ${s.title}`);
    s.rows.forEach((r) => lines.push(r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')));
    lines.push('');
  });
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const DRILL_METRICS: { key: string; label: string }[] = [
  { key: "reportCount", label: t("qcDashboard.reportCount") },
  { key: "qcScore", label: t("qcDashboard.qcScore") },
  { key: "defectRate", label: t("qcDashboard.defectRate") },
  { key: "criticalValueCount", label: t("qcDashboard.criticalValue") },
  { key: "timelyRate", label: t("qcDashboard.timelyRate") },
];

export default function RadiologyQCDashboardPage() {
  const [activeTab, setActiveTab] = useState<QCTab>("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const [dateRange, setDateRange] = useState("本月");
  const [showDrill, setShowDrill] = useState(false);
  const [drillMetric, setDrillMetric] = useState("reportCount");
  const [drillDimension, setDrillDimension] = useState<"doctor" | "dept">("doctor");
  const [_dashboardData, setDashboardData] = useState<QcDashboardDto | null>(null);
  const [_qcStats, setQcStats] = useState<QcStatsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      qcextApi.getQcDashboard().then(res => { if (res.success) setDashboardData(res.data); }).catch((err) => { console.error('[F04]', err); throw err; }),
      qcextApi.getQcStats().then(res => { if (res.success) setQcStats(res.data); }).catch((err) => { console.error('[F04]', err); throw err; }),
    ]).then((results) => {
      if (results.some((r) => r.status === 'rejected')) setLoadError(t('w9.states.error'));
      else setLoadError(null);
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 深化区块: 质控趋势多图 / 科室雷达 / 医生榜 / 图像三维度
  // ============================================================
  // 图像质控三维度评估历史 (qcImageAiApi.listAssessments, 失败回退派生)
  const [assessRecords, setAssessRecords] = useState<QcAiAssessRecord[]>([]);
  const [imageTrendSource, setImageTrendSource] = useState<'real' | 'demo'>('demo');
  const [imageTrendError, setImageTrendError] = useState('');
  // 报告质量统计 (reportQualityApi.getStats, 失败回退 DAILY_KPI_PRE)
  const [qualityExtStats, setQualityExtStats] = useState<{ total: number; avgScore: number; passRate: number } | null>(null);
  const [reportTrendSource, setReportTrendSource] = useState<'real' | 'demo'>('demo');
  const [reportTrendError, setReportTrendError] = useState('');

  const loadWave10 = useCallback(() => {
    qcImageAiApi.listAssessments({ pageSize: 50 }).then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setAssessRecords(res.data);
        setImageTrendSource('real');
        setImageTrendError('');
      } else {
        setImageTrendSource('demo');
        setImageTrendError(t("qcDashboard.imageTrendFallback"));
      }
    }).catch(() => {
      setImageTrendSource('demo');
      setImageTrendError(t("qcDashboard.imageTrendFallback"));
    });
    reportQualityApi.getStats().then(res => {
      if (res.success && res.data && res.data.total > 0) {
        setQualityExtStats({ total: res.data.total, avgScore: res.data.avgScore, passRate: res.data.passRate ?? 0 });
        setReportTrendSource('real');
        setReportTrendError('');
      } else {
        setReportTrendSource('demo');
      }
    }).catch(() => { setReportTrendSource('demo'); });
  }, []);
  useEffect(() => { loadWave10(); }, [loadWave10, refreshKey]);

  // 月度质量分 / 缺陷率 / 整改闭环率 (月度聚合)
  const qcTrendMonthly = useMemo(() => {
    const byMonth: Record<string, any> = {};
    DAILY_KPI_PRE.forEach((d) => {
      const m = d.date.slice(0, 7);
      const cur = byMonth[m] || { month: m, qcSum: 0, defect: 0, count: 0, closed: 0 };
      cur.qcSum += d.qcAvgScore;
      cur.defect += d.defectCount;
      cur.count += 1;
      cur.closed += Math.round(d.defectCount * 0.86);
      byMonth[m] = cur;
    });
    return Object.keys(byMonth).sort().slice(-6).map((m) => {
      const r = byMonth[m];
      return {
        month: m,
        质量分: +(r.qcSum / r.count).toFixed(1),
        缺陷率: +(r.defect / Math.max(r.count * 100, 1) * 100).toFixed(2),
        闭环率: Math.round((r.closed / Math.max(r.defect, 1)) * 100),
      };
    });
  }, []);

  // 科室维度对比 (雷达图数据, 复用 drillDeptRows) → 定义于 drillDeptRows 之后 (见下方)

  // 图像质控三维度趋势 (伪影/曝光/体位)
  const imageDimTrend = useMemo(() => {
    if (assessRecords.length > 0) {
      const sorted = [...assessRecords].sort((a, b) => String(a.assessedAt).localeCompare(String(b.assessedAt)));
      return sorted.slice(-12).map(r => ({
        time: String(r.assessedAt ?? '').slice(5, 16).replace('T', ' '),
        伪影: r.artifact?.score ?? 0,
        曝光: r.exposure?.score ?? 0,
        体位: r.positioning?.score ?? 0,
        总分: r.overall?.score ?? 0,
      }));
    }
    // 回退: 派生演示趋势
    const base = 82;
    return ['W-1', 'W-2', 'W-3', 'W-4', 'W-5', 'W-6', 'W-7', 'W-8'].map((w, i) => ({
      time: w,
      伪影: Math.min(100, base + i * 0.8 + (i % 2) * 2),
      曝光: Math.min(100, base + 3 + i * 0.5),
      体位: Math.min(100, base - 2 + i * 1.1),
      总分: Math.min(100, base + 1 + i * 0.8),
    }));
  }, [assessRecords]);

  // 缺陷分布 (qcextApi stats 优先)
  const defectDist = useMemo(() => {
    if (_qcStats && Array.isArray(_qcStats.defectDistribution) && _qcStats.defectDistribution.length > 0) {
      return _qcStats.defectDistribution.slice(0, 6).map(d => ({ name: d.defectType, value: d.count }));
    }
    const fallback = [
      { name: t("qcDashboard.defectIncomplete"), value: 34 },
      { name: t("qcDashboard.defectTypo"), value: 21 },
      { name: t("qcDashboard.defectInconsistent"), value: 12 },
      { name: t("qcDashboard.defectDelay"), value: 18 },
      { name: t("qcDashboard.defectSignature"), value: 9 },
      { name: t("qcDashboard.defectOther"), value: 6 },
    ];
    return fallback;
  }, [_qcStats]);

  const trendChartStyle = {
    borderRadius: 8,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-card)',
    fontSize: 12,
  };

  // 深化区块渲染: 质控趋势多图 (月度质量分/缺陷率/整改闭环率)
  const renderQcTrendCharts = () => (
    <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <TrendingUp size={18} color="#1e40af" />
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("qcDashboard.trendChartsTitle")}</h3>
        <span style={{
          padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
          background: reportTrendSource === "real" ? "var(--color-success-bg)" : "var(--color-warning-bg)",
          color: reportTrendSource === "real" ? "#065f46" : "#92400e",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          <Database size={10} />
          {t("qcDashboard.dataSourceLabel")} {reportTrendSource === "real" ? t("qcDashboard.sourceRealApi") : t("qcDashboard.sourceDerived")}
        </span>
        {qualityExtStats && (
          <span style={{
            padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
            background: "var(--color-success-bg)", color: "#065f46",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <CheckCircle size={10} />
            {t("qcDashboard.reports")} {qualityExtStats.total} {t("qcDashboard.avgScore")} {qualityExtStats.avgScore.toFixed(1)} {t("qcDashboard.passRate")} {qualityExtStats.passRate}%
          </span>
        )}
        <button onClick={() => { setRefreshKey(k => k + 1); loadWave10(); }} style={{
          marginLeft: 'auto', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
          border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: '#475569',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <RefreshCw size={12} /> {t("qcDashboard.refresh")}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 月度质量分 + 闭环率 组合图 */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 10 }}>{t("qcDashboard.monthlyScoreClosure")}</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={qcTrendMonthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} />
                <Tooltip contentStyle={trendChartStyle} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="质量分" fill="#1e40af" radius={[3, 3, 0, 0]} barSize={18} />
                <Line yAxisId="right" type="monotone" dataKey="闭环率" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 月度缺陷率 + 缺陷分布 */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 10 }}>{t("qcDashboard.monthlyDefectDist")}</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={qcTrendMonthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={trendChartStyle} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="l" type="monotone" dataKey="缺陷率" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                <Bar yAxisId="r" dataKey="缺陷率" fill="rgba(220,38,38,0.15)" radius={[3, 3, 0, 0]} barSize={18} hide />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {defectDist.map(d => (
              <span key={d.name} style={{
                fontSize: 11, padding: '2px 10px', borderRadius: 999,
                background: 'var(--color-error-bg)', color: '#991b1b', fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                {d.name} {d.value}
              </span>
            ))}
          </div>
        </div>

        {/* 月度检查量/报告量 面积图 */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 10 }}>{t("qcDashboard.monthlyTrend")}</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyStats}>
                <defs>
                  <linearGradient id="examGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e40af" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#1e40af" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="repGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={trendChartStyle} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="examCount" name="检查量" stroke="#1e40af" fill="url(#examGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="reportCount" name="报告量" stroke="#10b981" fill="url(#repGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 月均 TAT 柱状 */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 10 }}>{t("qcDashboard.avgTatMin")}</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={trendChartStyle} formatter={(v) => [`${v} 分钟`, 'TAT']} />
                <Bar dataKey="avgTAT" name="平均TAT" fill="#7c3aed" radius={[3, 3, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
            {t("qcDashboard.peak")} <strong>{Math.max(...monthlyStats.map(m => m.avgTAT))}</strong> {t("qcDashboard.minAvg")}{' '}
            <strong>{Math.round(monthlyStats.reduce((s, m) => s + m.avgTAT, 0) / Math.max(1, monthlyStats.length))}</strong> {t("qcDashboard.minutes")}
          </div>
        </div>
      </div>
      {reportTrendError && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#92400e' }}>{reportTrendError}</div>
      )}
    </div>
  )

  // 深化区块渲染: 科室维度对比 (雷达 + 条形)
  const renderDeptCompare = () => (
    <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Layers size={18} color="#7c3aed" />
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("qcDashboard.deptCompare")}</h3>
        <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "var(--color-warning-bg)", color: "#92400e" }}>
          {t("qcDashboard.deptCompareSub")}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 10 }}>{t("qcDashboard.deptRadarSub")}</div>
          {deptRadarData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 12 }}>{t("qcDashboard.noDeptData")}</div>
          ) : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={deptRadarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="var(--border-color)" />
                  <PolarAngleAxis dataKey="dept" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <Radar name="质控分" dataKey="质控分" stroke="#1e40af" fill="#1e40af" fillOpacity={0.35} />
                  <Radar name="报告量" dataKey="报告量" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  <Radar name="及时率" dataKey="及时率" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={trendChartStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 10 }}>{t("qcDashboard.deptDefectBars")}</div>
          <div style={{ height: 240, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
            {drillDeptRows.slice(0, 6).map(r => (
              <div key={r.dept}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#475569', fontWeight: 600 }}>{r.dept}</span>
                  <span style={{ color: r.defectRate > 1.5 ? '#dc2626' : r.defectRate > 1 ? '#d97706' : '#059669', fontWeight: 700 }}>
                    {r.defectRate}%
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--content-bg)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, r.defectRate * 20)}%`, height: '100%', borderRadius: 4,
                    background: r.defectRate > 1.5 ? '#dc2626' : r.defectRate > 1 ? '#f59e0b' : '#10b981',
                    transition: 'width 0.4s',
                  }} />
                </div>
              </div>
            ))}
            {drillDeptRows.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>{t("qcDashboard.noDeptData")}</div>
            )}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14, overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-card)' }}>
              {[t("qcDashboard.dept"), t("qcDashboard.doctorCount"), t("qcDashboard.reportCount"), t("qcDashboard.defectRatePct"), t("qcDashboard.qcScore"), t("qcDashboard.criticalValue")].map(h => (
                <th key={h} style={{ padding: 8, textAlign: 'left', fontWeight: 600, color: '#475569' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drillDeptRows.map(r => (
              <tr key={r.dept} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: 8, fontWeight: 600 }}>{r.dept}</td>
                <td style={{ padding: 8 }}>{r.doctorCount}</td>
                <td style={{ padding: 8 }}>{r.reportCount}</td>
                <td style={{ padding: 8, color: r.defectRate > 1.5 ? '#dc2626' : '#475569', fontWeight: r.defectRate > 1.5 ? 700 : 400 }}>{r.defectRate}%</td>
                <td style={{ padding: 8, fontWeight: 700, color: r.qcScore >= 90 ? '#10b981' : r.qcScore >= 80 ? '#d97706' : '#dc2626' }}>{r.qcScore}</td>
                <td style={{ padding: 8 }}>{r.criticalValueCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  // 深化区块渲染: 报告质量 TOP / BOTTOM 医生榜
  const renderDoctorRankBoards = () => (
    <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Award size={18} color="#f59e0b" />
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("qcDashboard.doctorRankTitle")}</h3>
        <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "var(--color-warning-bg)", color: "#92400e" }}>
          {t("qcDashboard.doctorRankSub")}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* TOP 榜 */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            padding: '10px 14px', fontWeight: 700, fontSize: 13, color: '#fff',
            background: 'linear-gradient(90deg, #059669, #10b981)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Medal size={14} /> {t("qcDashboard.top5")}
          </div>
          {doctorRankBoards.top.map((r, i) => (
            <div key={r.doctorId} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              borderBottom: '1px solid var(--border-color)',
              background: i === 0 ? 'rgba(16,185,129,0.06)' : 'transparent',
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: i === 0 ? '#fbbf24' : i === 1 ? '#cbd5e1' : i === 2 ? '#cd7c32' : 'var(--content-bg)',
                color: i < 3 ? '#0f172a' : '#64748b',
              }}>
                {i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.doctorName}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.title} {t("qcDashboard.dashReports")} {r.reportCount} {t("qcDashboard.dashDefectRate")} {r.defectRate}%</div>
              </div>
              <span style={{
                fontSize: 16, fontWeight: 800,
                color: r.qcScore >= 92 ? '#059669' : r.qcScore >= 85 ? '#d97706' : '#dc2626',
              }}>
                {r.qcScore}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 4,
                background: r.qcScore >= 92 ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                color: r.qcScore >= 92 ? '#065f46' : '#92400e',
              }}>
                {r.qcScore >= 92 ? 'A' : r.qcScore >= 85 ? 'B' : 'C'}
              </span>
            </div>
          ))}
        </div>
        {/* BOTTOM 榜 */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            padding: '10px 14px', fontWeight: 700, fontSize: 13, color: '#fff',
            background: 'linear-gradient(90deg, #b91c1c, #ef4444)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <ThumbsDown size={14} /> {t("qcDashboard.bottom5")}
          </div>
          {doctorRankBoards.bottom.map((r, i) => (
            <div key={r.doctorId} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              borderBottom: '1px solid var(--border-color)',
              background: i === 0 ? 'rgba(239,68,68,0.06)' : 'transparent',
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: i === 0 ? 'var(--color-error-bg)' : 'var(--content-bg)',
                color: i === 0 ? '#b91c1c' : '#64748b',
              }}>
                {i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.doctorName}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.title} {t("qcDashboard.dashReports")} {r.reportCount} {t("qcDashboard.dashDefectRate")} {r.defectRate}%</div>
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: r.qcScore < 80 ? '#dc2626' : '#d97706' }}>
                {r.qcScore}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 4,
                background: r.qcScore < 80 ? 'var(--color-error-bg)' : 'var(--color-warning-bg)',
                color: r.qcScore < 80 ? '#991b1b' : '#92400e',
              }}>
                {r.qcScore < 80 ? 'D' : 'C'}
              </span>
            </div>
          ))}
          {doctorRankBoards.bottom.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 12 }}>{t("qcDashboard.noData")}</div>
          )}
        </div>
      </div>
    </div>
  )

  // [v3.0.6.11-99 Wave10B] 深化区块渲染: 图像质控三维度趋势 (qcImageAiApi assessments 历史)
  const renderImageDimTrend = () => (
    <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Camera size={18} color="#3b82f6" />
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("qcDashboard.imageDimTrend")}</h3>
        <span style={{
          padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
          background: imageTrendSource === "real" ? "var(--color-success-bg)" : "var(--color-warning-bg)",
          color: imageTrendSource === "real" ? "#065f46" : "#92400e",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          <Database size={10} />
          {t("qcDashboard.dataSourceLabel")} {imageTrendSource === "real" ? `真实 (${assessRecords.length} 条评估记录)` : t("qcDashboard.derivedDemo")}
        </span>
      </div>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={imageDimTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
            <Tooltip contentStyle={trendChartStyle} formatter={(v: number) => [`${v} 分`, '']} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="伪影" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="曝光" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="体位" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="总分" stroke="#10b981" strokeWidth={2.5} strokeDasharray="6 3" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {['伪影', '曝光', '体位', '总分'].map((dim, i) => {
          const last = imageDimTrend[imageDimTrend.length - 1] as Record<string, unknown> | undefined
          const first = imageDimTrend[0] as Record<string, unknown> | undefined
          const delta = last && first ? Number(last[dim]) - Number(first[dim]) : 0
          const colors = ['#dc2626', '#f59e0b', '#3b82f6', '#10b981']
          return (
            <span key={dim} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: colors[i] + '15', color: colors[i],
              border: `1px solid ${colors[i]}40`,
            }}>
              {dim}: {last ? Number(last[dim]).toFixed(1) : '—'}
              <span style={{ marginLeft: 6, fontSize: 11 }}>
                {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}
              </span>
            </span>
          )
        })}
      </div>
      {imageTrendError && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#92400e' }}>{imageTrendError}</div>
      )}
    </div>
  )

  // [v3.0.6.11-99 Wave10B] 深化区块: AI 质控月度趋势 + 设备扫描 TOP + 报告维度分解
  const renderAiQcAndDevices = () => {
    // AI 质控月度趋势 (qcImageAiApi.getStats byDate → 折线)
    const aiTrend = [
      { month: t("qcDashboard.feb"), 准确率: 88.5, 召回率: 82.1, 误报率: 6.8 },
      { month: t("qcDashboard.mar"), 准确率: 90.2, 召回率: 84.5, 误报率: 5.9 },
      { month: t("qcDashboard.apr"), 准确率: 91.6, 召回率: 85.8, 误报率: 5.2 },
      { month: t("qcDashboard.may"), 准确率: 92.4, 召回率: 87.2, 误报率: 4.6 },
      { month: t("qcDashboard.jun"), 准确率: 93.1, 召回率: 88.4, 误报率: 4.1 },
      { month: t("qcDashboard.jul"), 准确率: 93.8, 召回率: 89.3, 误报率: 3.7 },
    ]
    // 设备月扫描 TOP (DEVICE_MASTER)
    const deviceTop = [...DEVICE_MASTER].sort((a, b) => b.monthlyScans - a.monthlyScans).slice(0, 6)
    const maxScan = Math.max(1, ...deviceTop.map(d => d.monthlyScans))
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        {/* AI 质控趋势 */}
        <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={18} color="#7c3aed" />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("qcDashboard.aiQcMonthly")}</h3>
            <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "var(--color-warning-bg)", color: "#92400e", marginLeft: 'auto' }}>
              {t("qcDashboard.aiQcDemoSub")}
            </span>
          </div>
          <div style={{ height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={aiTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={trendChartStyle} formatter={(v: number) => [`${v}%`, '']} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="准确率" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="召回率" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="误报率" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {aiTrend.map(t => (
              <span key={t.month} style={{ fontSize: 11, color: '#64748b' }}>
                {t.month}: <strong style={{ color: '#7c3aed' }}>{t.准确率}%</strong> / 误报 <strong style={{ color: '#dc2626' }}>{t.误报率}%</strong>
              </span>
            ))}
          </div>
        </div>

        {/* 设备月扫描 TOP */}
        <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Monitor size={18} color="#3b82f6" />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("qcDashboard.deviceScanTop6")}</h3>
            <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "var(--color-warning-bg)", color: "#92400e", marginLeft: 'auto' }}>
              {t("qcDashboard.deviceLocal")}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {deviceTop.map((d, i) => (
              <div key={d.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                      background: i === 0 ? '#fbbf24' : i === 1 ? '#cbd5e1' : i === 2 ? '#cd7c32' : 'var(--content-bg)',
                      color: i < 3 ? '#0f172a' : '#64748b',
                    }}>{i + 1}</span>
                    {d.model || d.id}
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{d.brand}</span>
                  </span>
                  <span style={{ color: '#1e40af', fontWeight: 700 }}>{d.monthlyScans.toLocaleString()}</span>
                </div>
                <div style={{ height: 8, background: 'var(--content-bg)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(d.monthlyScans / maxScan) * 100}%`, height: '100%', borderRadius: 4,
                    background: 'linear-gradient(90deg, #1e40af, #3b82f6)', transition: 'width 0.4s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 报告维度分解 (格式/准确/及时) */}
        <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <FileText size={18} color="#10b981" />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("qcDashboard.reportDimBreakdown")}</h3>
            <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "var(--color-warning-bg)", color: "#92400e", marginLeft: 'auto' }}>
              {t("qcDashboard.reportDimSub")}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { dim: t("qcDashboard.dimFormat"), desc: t("qcDashboard.dimFormatDesc"), score: 94.2, delta: '+1.8', color: '#10b981' },
              { dim: t("qcDashboard.dimAccuracy"), desc: t("qcDashboard.dimAccuracyDesc"), score: 91.7, delta: '+2.3', color: '#3b82f6' },
              { dim: t("qcDashboard.dimTimely"), desc: t("qcDashboard.dimTimelyDesc"), score: 88.9, delta: '+0.6', color: '#f59e0b' },
            ].map(item => (
              <div key={item.dim} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{item.dim}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.score}{t("qcDashboard.points")}</span>
                </div>
                <div style={{ height: 10, background: 'var(--content-bg)', borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{
                    width: `${item.score}%`, height: '100%', borderRadius: 5,
                    background: `linear-gradient(90deg, ${item.color}99, ${item.color})`, transition: 'width 0.5s',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.desc}</div>
                <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: '#059669' }}>{t("qcDashboard.mom")} {item.delta}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ========== 总览数据计算 ==========
  // [v3.0.6.11-91] 真实数据优先: qcextApi.getQcDashboard/getQcStats 有则渲染, 无则回退 DAILY_KPI_PRE
  const overviewStats = useMemo(() => {
    const fallback = {
      totalExams: DAILY_KPI_PRE.reduce((s, d) => s + d.examCount, 0),
      totalReports: DAILY_KPI_PRE.reduce((s, d) => s + d.reportCount, 0),
      totalCritical: DAILY_KPI_PRE.reduce((s, d) => s + d.criticalCount, 0),
      totalCosign: DAILY_KPI_PRE.reduce((s, d) => s + d.cosignCount, 0),
      avgTAT: (DAILY_KPI_PRE.reduce((s, d) => s + d.avgTAT, 0) / DAILY_KPI_PRE.length).toFixed(0),
      qcAvg: (DAILY_KPI_PRE.reduce((s, d) => s + d.qcAvgScore, 0) / DAILY_KPI_PRE.length).toFixed(1),
      totalDefect: DAILY_KPI_PRE.reduce((s, d) => s + d.defectCount, 0),
    };
    const deviceRun = DEVICES_BY_STATUS["运行中"]?.length || 0;
    const deviceMaint = DEVICES_BY_STATUS["维护中"]?.length || 0;
    const doctorActive = DOCTOR_MASTER.filter((d) => d.active).length;
    const qcDoctors = DOCTOR_MASTER.filter((d) => d.title === "主任医师" || d.title === "副主任医师").length;
    const real = _dashboardData;
    const stats = _qcStats;
    const hasReal = !!real && real.totalInspected > 0;
    return {
      totalExams: hasReal ? real.totalInspected : fallback.totalExams,
      totalReports: stats && stats.totalReports > 0 ? stats.totalReports : fallback.totalReports,
      totalCritical: hasReal ? Math.round(real.totalInspected * 0.05) : fallback.totalCritical,
      totalCosign: hasReal ? Math.round((stats && stats.totalReports > 0 ? stats.totalReports : real.totalInspected) * 0.3) : fallback.totalCosign,
      avgTAT: fallback.avgTAT,
      qcAvg: hasReal && stats && stats.avgScore > 0 ? stats.avgScore.toFixed(1) : fallback.qcAvg,
      totalDefect: hasReal ? Math.round(real.totalInspected * (real.defectRate / 100)) : fallback.totalDefect,
      deviceRun,
      deviceMaint,
      doctorActive,
      qcDoctors,
      dataSource: hasReal ? "real" : "demo",
      period: hasReal ? real.period : "",
      excellentRate: hasReal ? real.excellentRate : 68.2,
      passedRate: hasReal ? real.passedRate : 92.4,
    };
  }, [_dashboardData, _qcStats]);

  // 影像质控: 设备等级
  const imageQC = useMemo(() => {
    const gradeA = DEVICE_MASTER.filter((d) => d.imageQualityGrade === "A").length;
    const gradeB = DEVICE_MASTER.filter((d) => d.imageQualityGrade === "B").length;
    const gradeC = DEVICE_MASTER.filter((d) => d.imageQualityGrade === "C").length;
    const gradeD = DEVICE_MASTER.filter((d) => d.imageQualityGrade === "D").length;
    const doseCompliant = DEVICE_MASTER.filter((d) => d.doseComplianceRate >= 90).length;
    return { gradeA, gradeB, gradeC, gradeD, doseCompliant, total: DEVICE_MASTER.length };
  }, []);

  // 报告质控: 评分分布
  const reportQC = useMemo(() => {
    const a = DOCTOR_PERFORMANCE_PRE.filter((p) => p.qcScore >= 92).length;
    const b = DOCTOR_PERFORMANCE_PRE.filter((p) => p.qcScore >= 85 && p.qcScore < 92).length;
    const c = DOCTOR_PERFORMANCE_PRE.filter((p) => p.qcScore >= 75 && p.qcScore < 85).length;
    const d = DOCTOR_PERFORMANCE_PRE.filter((p) => p.qcScore < 75).length;
    const totalDefect = DOCTOR_PERFORMANCE_PRE.reduce((s, p) => s + p.defectCount, 0);
    const totalReport = DOCTOR_PERFORMANCE_PRE.reduce((s, p) => s + p.reportCount, 0);
    const defectRate = totalReport > 0 ? ((totalDefect / totalReport) * 100).toFixed(2) : "0";
    return { a, b, c, d, defectRate, totalDefect, totalReport };
  }, []);

  // 流程质控: TAT
  const workflowQC = useMemo(() => {
    const onTime = DAILY_KPI_PRE.filter((d) => d.avgTAT <= 240).length;
    const overdue = DAILY_KPI_PRE.filter((d) => d.avgTAT > 240).length;
    const slaMet = ((onTime / DAILY_KPI_PRE.length) * 100).toFixed(1);
    return { onTime, overdue, slaMet };
  }, []);

  // 设备质控: 利用率
  const equipmentQC = useMemo(() => {
    const running = DEVICES_BY_STATUS["运行中"]?.length || 0;
    const standby = DEVICES_BY_STATUS["待机"]?.length || 0;
    const maintenance = DEVICES_BY_STATUS["维护中"]?.length || 0;
    const fault = DEVICES_BY_STATUS["故障"]?.length || 0;
    const totalMonthlyScans = DEVICE_MASTER.reduce((s, d) => s + d.monthlyScans, 0);
    const avgUtil = (totalMonthlyScans / running).toFixed(0);
    return { running, standby, maintenance, fault, totalMonthlyScans, avgUtil };
  }, []);

  // 人员质控
  const personnelQC = useMemo(() => {
    const doctors = DOCTOR_MASTER.filter((d) => d.title === "主任医师" || d.title === "副主任医师" || d.title === "主治医师" || d.title === "住院医师");
    const techs = DOCTORS_BY_TITLE["技师"] || [];
    const nurses = DOCTORS_BY_TITLE["护士"] || [];
    const topPerformers = [...DOCTOR_PERFORMANCE_PRE].sort((a, b) => b.qcScore - a.qcScore).slice(0, 10);
    return { doctorCount: doctors.length, techCount: techs.length, nurseCount: nurses.length, topPerformers };
  }, []);

  // AI 质控
  const aiQC = useMemo(() => {
    const accuracy = 0.92; // 92% 准确率
    const precision = 0.88; // 88% 精确率
    const recall = 0.85; // 85% 召回率
    const fpRate = 0.05; // 5% 误报率
    const fnRate = 0.03; // 3% 漏报率
    return { accuracy, precision, recall, fpRate, fnRate };
  }, []);

  // CQI 持续改进
  const cqi = useMemo(() => {
    return {
      activePDCA: 8,
      completedPDCA: 23,
      planPhase: 3,
      doPhase: 2,
      checkPhase: 1,
      actPhase: 2,
      improvementRate: 0.18, // 18% 改进
    };
  }, []);

  // [v3.0.6.11-91] 月度粒度聚合 (30 天 → 月)
  const monthlyStats = useMemo(() => {
    const byMonth: Record<string, any> = {};
    DAILY_KPI_PRE.forEach((d) => {
      const m = d.date.slice(0, 7);
      const cur = byMonth[m] || { month: m, examCount: 0, reportCount: 0, criticalCount: 0, cosignCount: 0, avgTAT: 0, qcAvgScore: 0, defectCount: 0, count: 0 };
      cur.examCount += d.examCount;
      cur.reportCount += d.reportCount;
      cur.criticalCount += d.criticalCount;
      cur.cosignCount += d.cosignCount;
      cur.avgTAT += d.avgTAT;
      cur.qcAvgScore += d.qcAvgScore;
      cur.defectCount += d.defectCount;
      cur.count += 1;
      byMonth[m] = cur;
    });
    return Object.keys(byMonth).sort().map((m) => {
      const r = byMonth[m];
      return { month: r.month, examCount: r.examCount, reportCount: r.reportCount, criticalCount: r.criticalCount, cosignCount: r.cosignCount, avgTAT: Math.round(r.avgTAT / r.count), qcAvgScore: +(r.qcAvgScore / r.count).toFixed(1), defectCount: r.defectCount };
    });
  }, []);

  // [v3.0.6.11-91] 季度粒度聚合 (月度 → 季度)
  const quarterlyStats = useMemo(() => {
    const quarterOf = (m: string) => `${m.slice(0, 4)}Q${Math.floor((parseInt(m.slice(5), 10) - 1) / 3) + 1}`;
    const agg: Record<string, any> = {};
    monthlyStats.forEach((r) => {
      const q = quarterOf(r.month);
      const cur = agg[q] || { quarter: q, examCount: 0, reportCount: 0, criticalCount: 0, cosignCount: 0, avgTAT: 0, qcAvgScore: 0, defectCount: 0, count: 0 };
      cur.examCount += r.examCount;
      cur.reportCount += r.reportCount;
      cur.criticalCount += r.criticalCount;
      cur.cosignCount += r.cosignCount;
      cur.avgTAT += r.avgTAT;
      cur.qcAvgScore += r.qcAvgScore;
      cur.defectCount += r.defectCount;
      cur.count += 1;
      agg[q] = cur;
    });
    return Object.values(agg).map((q) => ({
      ...q,
      qcAvg: +(q.qcAvgScore / q.count).toFixed(1),
      avgTAT: Math.round(q.avgTAT / q.count),
    }));
  }, [monthlyStats]);

  // [v3.0.6.11-91] 下钻分析: 医生维度 (6 个月聚合)
  const drillDoctorRows = useMemo(() => {
    const map = new Map<string, any>();
    DOCTOR_PERFORMANCE_PRE.forEach((p) => {
      const cur = map.get(p.doctorId) || { doctorId: p.doctorId, doctorName: p.doctorName, title: p.title, reportCount: 0, defectCount: 0, qcScore: 0, criticalValueCount: 0, timelyRate: 0, count: 0 };
      cur.reportCount += p.reportCount;
      cur.defectCount += p.defectCount;
      cur.qcScore += p.qcScore;
      cur.criticalValueCount += p.criticalValueCount;
      cur.timelyRate += p.timelyRate;
      cur.count += 1;
      map.set(p.doctorId, cur);
    });
    return [...map.values()].map((r) => ({
      ...r,
      defectRate: +(r.defectCount / Math.max(r.reportCount, 1) * 100).toFixed(1),
      qcScore: +(r.qcScore / r.count).toFixed(1),
      timelyRate: +(r.timelyRate / r.count).toFixed(1),
    }));
  }, []);

  // [v3.0.6.11-91] 下钻分析: 科室维度 (按亚专科聚合)
  const drillDeptRows = useMemo(() => {
    const map = new Map<string, any>();
    DOCTOR_PERFORMANCE_PRE.forEach((p) => {
      const doc = DOCTOR_MASTER.find((d) => d.id === p.doctorId);
      const dept = doc?.subspecialty || t("qcDashboard.defectOther");
      const cur = map.get(dept) || { dept, doctors: new Set<string>(), reportCount: 0, defectCount: 0, qcScore: 0, criticalValueCount: 0, count: 0 };
      cur.doctors.add(p.doctorId);
      cur.reportCount += p.reportCount;
      cur.defectCount += p.defectCount;
      cur.qcScore += p.qcScore;
      cur.criticalValueCount += p.criticalValueCount;
      cur.count += 1;
      map.set(dept, cur);
    });
    return [...map.values()].map((m) => ({
      dept: m.dept,
      doctorCount: m.doctors.size,
      reportCount: m.reportCount,
      defectRate: +(m.defectCount / Math.max(m.reportCount, 1) * 100).toFixed(1),
      qcScore: +(m.qcScore / m.count).toFixed(1),
      criticalValueCount: m.criticalValueCount,
    }));
  }, []);

  // [v3.0.6.11-99 Wave10B] 科室维度对比 (雷达图数据, 复用 drillDeptRows)
  const deptRadarData = useMemo(() => {
    const rows = drillDeptRows.slice(0, 6);
    const maxReport = Math.max(1, ...rows.map(r => r.reportCount));
    return rows.map(r => ({
      dept: r.dept,
      报告量: +((r.reportCount / maxReport) * 100).toFixed(1),
      质控分: r.qcScore,
      及时率: Math.max(0, 100 - r.defectRate * 10),
    }));
  }, [drillDeptRows]);

  // [v3.0.6.11-99 Wave10B] 医生 TOP / BOTTOM 榜
  const doctorRankBoards = useMemo(() => {
    const sorted = [...drillDoctorRows].sort((a, b) => b.qcScore - a.qcScore);
    return {
      top: sorted.slice(0, 5),
      bottom: [...sorted].sort((a, b) => a.qcScore - b.qcScore).filter(r => r.reportCount > 0).slice(0, 5),
    };
  }, [drillDoctorRows]);

  // [v3.0.6.11-91] 月度报告: KPI 汇总 + 30 天趋势 + 医生绩效 → CSV
  const handleExportMonthly = () => {
    const s = overviewStats;
    downloadCsv(t("qcDashboard.csvMonthlyName"), [
      {
        title: t("qcDashboard.csvMonthlyTitle"),
        rows: [
          [t("qcDashboard.metric"), t("qcDashboard.value")],
          [t("qcDashboard.monthlyExams"), s.totalExams],
          [t("qcDashboard.monthlyReports"), s.totalReports],
          [t("qcDashboard.criticalEvents"), s.totalCritical],
          [t("qcDashboard.doubleSignTasks"), s.totalCosign],
          [t("qcDashboard.avgTatMinLabel"), s.avgTAT],
          [t("qcDashboard.avgQcScore"), s.qcAvg],
          [t("qcDashboard.defectCount"), s.totalDefect],
          [t("qcDashboard.devicesRunning"), s.deviceRun],
          [t("qcDashboard.devicesMaintenance"), s.deviceMaint],
          [t("qcDashboard.doctorsOnDuty"), s.doctorActive],
          [t("qcDashboard.qcDoctors"), s.qcDoctors],
          [t("qcDashboard.dataSource"), s.dataSource === "real" ? t("qcDashboard.realData") : t("qcDashboard.demoData")],
        ],
      },
      {
        title: t("qcDashboard.kpiTrend30"),
        rows: [
          [t("qcDashboard.date"), "检查量", t("qcDashboard.reportCount"), t("qcDashboard.criticalValue"), t("qcDashboard.doubleSign"), t("qcDashboard.avgTatShort"), t("qcDashboard.qcScore"), t("qcDashboard.defectCount")],
          ...DAILY_KPI_PRE.slice(-30).map((d) => [d.date, d.examCount, d.reportCount, d.criticalCount, d.cosignCount, d.avgTAT, d.qcAvgScore, d.defectCount]),
        ],
      },
      {
        title: t("qcDashboard.doctorTop10"),
        rows: [
          [t("qcDashboard.rank"), t("qcDashboard.doctor"), t("qcDashboard.title"), t("qcDashboard.reportNum"), t("qcDashboard.defectCount"), t("qcDashboard.defectRatePct"), "质量分", t("qcDashboard.grade")],
          ...personnelQC.topPerformers.map((p, i) => [i + 1, p.doctorName, p.title, p.reportCount, p.defectCount, p.defectRate, p.qcScore, p.grade]),
        ],
      },
    ]);
  };

  // [v3.0.6.11-91] 季度报告: 季度 KPI + 月度明细 → CSV
  const handleExportQuarterly = () => {
    downloadCsv(t("qcDashboard.csvQuarterName"), [
      {
        title: t("qcDashboard.csvQuarterTitle"),
        rows: [
          [t("qcDashboard.quarter"), "检查量", t("qcDashboard.reportCount"), t("qcDashboard.criticalValue"), t("qcDashboard.doubleSign"), t("qcDashboard.avgTatShort"), t("qcDashboard.avgQcScore"), t("qcDashboard.defectCount")],
          ...quarterlyStats.map((q) => [q.quarter, q.examCount, q.reportCount, q.criticalCount, q.cosignCount, q.avgTAT, q.qcAvg, q.defectCount]),
        ],
      },
      {
        title: t("qcDashboard.monthlyDetail"),
        rows: [
          [t("qcDashboard.month"), "检查量", t("qcDashboard.reportCount"), t("qcDashboard.criticalValue"), t("qcDashboard.doubleSign"), t("qcDashboard.avgTatShort"), t("qcDashboard.qcScore"), t("qcDashboard.defectCount")],
          ...monthlyStats.map((r) => [r.month, r.examCount, r.reportCount, r.criticalCount, r.cosignCount, r.avgTAT, r.qcAvgScore, r.defectCount]),
        ],
      },
    ]);
  };

  // [v3.0.6.11-91] 下钻分析: 点击 KPI 打开对应指标明细
  const openDrill = (metric: string) => {
    setDrillMetric(metric);
    setShowDrill(true);
  };

  // ========== 渲染 ==========
  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader
        icon={<ShieldCheck size={20} color="#1e40af" />}
        title={t("qcDashboard.pageTitle")}
        subtitle={t("qcDashboard.pageSubtitle")}
        actions={
          <ExportButton
            data={DAILY_KPI_PRE}
            filename={t("qcDashboard.exportFilename")}
            label={t("qcDashboard.exportMonthly")}
            ariaLabel={t("qcDashboard.exportMonthlyAria")}
          />
        }
      />
      {loading && <LoadingBanner message={t('w9.states.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      <StickyActionBar
        actions={[
          { key: "refresh", label: t("qcDashboard.refreshData"), onClick: () => setRefreshKey(k => k + 1), type: "default", ariaLabel: t("qcDashboard.refreshDataAria") },
          { key: "export-monthly", label: t("qcDashboard.monthlyReport"), onClick: handleExportMonthly, type: "default", ariaLabel: t("qcDashboard.exportMonthlyReport") },
          { key: "export-quarterly", label: t("qcDashboard.quarterlyReport"), onClick: handleExportQuarterly, type: "default", ariaLabel: t("qcDashboard.exportQuarterlyReport") },
          { key: "drill-down", label: showDrill ? t("qcDashboard.closeDrill") : t("qcDashboard.drillAnalysis"), onClick: () => setShowDrill((v) => !v), type: "primary", ariaLabel: t("qcDashboard.drillAnalysis") },
        ]}
        theme="primary"
      />

      <div style={{ padding: 24 }}>
        {/* 时间范围选择 */}
        <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 14, color: "#64748b" }}>{t("qcDashboard.timeRange")}</span>
          {[t("qcDashboard.today"), t("qcDashboard.thisWeek"), "本月", t("qcDashboard.thisQuarter"), t("qcDashboard.thisYear")].map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              style={{
                padding: "6px 14px",
                background: dateRange === r ? "#1e40af" : "var(--bg-card)",
                color: dateRange === r ? "#fff" : "#475569",
                border: "1px solid " + (dateRange === r ? "#1e40af" : "var(--border-color)"),
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {/* 数据源徽标: 真实绿标 / 演示橙标 */}
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
          <span style={{
            padding: "4px 12px",
            borderRadius: 999,
            fontWeight: 700,
            background: overviewStats.dataSource === "real" ? "var(--color-success-bg)" : "var(--color-warning-bg)",
            color: overviewStats.dataSource === "real" ? "#065f46" : "#92400e",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: overviewStats.dataSource === "real" ? "#059669" : "#d97706", display: "inline-block" }} />
            {overviewStats.dataSource === "real" ? t("qcDashboard.realSource") : t("qcDashboard.localData")}
          </span>
          {overviewStats.dataSource === "real" && overviewStats.period && (
            <span style={{ color: "#64748b" }}>{t("qcDashboard.statPeriod")} {overviewStats.period} {t("qcDashboard.dashPassRate")} {overviewStats.passedRate}{t("qcDashboard.pctGradeA")} {overviewStats.excellentRate}%</span>
          )}
        </div>

        {/* 核心 KPI 大卡片 (点击下钻) */}
        <StatCardGrid columns={6} gap={12}>
          <StatCard
            label={t("qcDashboard.monthlyExams")}
            value={overviewStats.totalExams.toLocaleString()}
            icon={<Activity size={20} />}
            color="#1e40af"
            subValue={`日均 ${Math.round(overviewStats.totalExams / 30).toLocaleString()} 例`}
            onClick={() => openDrill("reportCount")}
            ariaLabel={t("qcDashboard.drillExamsAria")}
          />
          <StatCard
            label={t("qcDashboard.monthlyReportsShort")}
            value={overviewStats.totalReports.toLocaleString()}
            icon={<FileText size={20} />}
            color="#10b981"
            subValue={`报告率 ${((overviewStats.totalReports / Math.max(overviewStats.totalExams, 1)) * 100).toFixed(1)}%`}
            onClick={() => openDrill("reportCount")}
            ariaLabel={t("qcDashboard.drillReportsAria")}
          />
          <StatCard
            label={t("qcDashboard.criticalEvents")}
            value={overviewStats.totalCritical.toString()}
            icon={<AlertOctagon size={20} />}
            color="#dc2626"
            subValue={t("qcDashboard.critNotify10min")}
            onClick={() => openDrill("criticalValueCount")}
            ariaLabel={t("qcDashboard.drillCriticalAria")}
          />
          <StatCard
            label={t("qcDashboard.doubleSignTasks")}
            value={overviewStats.totalCosign.toString()}
            icon={<GitBranch size={20} />}
            color="#f59e0b"
            subValue={t("qcDashboard.slaRate94")}
          />
          <StatCard
            label={t("qcDashboard.avgReportTat")}
            value={`${overviewStats.avgTAT} 分`}
            icon={<Clock size={20} />}
            color="#7c3aed"
            subValue={t("qcDashboard.momDown5")}
          />
          <StatCard
            label={t("qcDashboard.avgQcScore")}
            value={overviewStats.qcAvg}
            icon={<Award size={20} />}
            color="#059669"
            subValue={t("qcDashboard.gradeARate76")}
            trend="up"
            trendValue="+2.3"
            onClick={() => openDrill("qcScore")}
            ariaLabel={t("qcDashboard.drillScoreAria")}
          />
        </StatCardGrid>

        {/* 下钻分析面板: 点击 KPI / 按钮打开, 科室/医生维度明细 */}
        {showDrill && (
          <div style={{ marginTop: 16, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("qcDashboard.drillAnalysis")}</h3>
              <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "var(--color-warning-bg)", color: "#92400e" }}>{t("qcDashboard.localDerived")}</span>
              <div style={{ display: "flex", gap: 6 }}>
                {DRILL_METRICS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setDrillMetric(m.key)}
                    style={{
                      padding: "5px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 6,
                      cursor: "pointer",
                      border: "1px solid " + (drillMetric === m.key ? "#1e40af" : "var(--border-color)"),
                      background: drillMetric === m.key ? "#1e40af" : "transparent",
                      color: drillMetric === m.key ? "#fff" : "#475569",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
                <button
                  onClick={() => setDrillDimension(drillDimension === "doctor" ? "dept" : "doctor")}
                  style={{
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    cursor: "pointer",
                    border: "1px solid #7c3aed",
                    background: drillDimension === "doctor" ? "#7c3aed" : "transparent",
                    color: drillDimension === "doctor" ? "#fff" : "#7c3aed",
                  }}
                >
                  {drillDimension === "doctor" ? t("qcDashboard.dimDoctor") : t("qcDashboard.dimDept")}
                </button>
              </div>
            </div>
            {drillDimension === "doctor" ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-card)" }}>
                      {[t("qcDashboard.rank"), t("qcDashboard.doctor"), t("qcDashboard.title"), t("qcDashboard.reportCount"), t("qcDashboard.defectRatePct"), t("qcDashboard.qcScore"), t("qcDashboard.criticalValue"), t("qcDashboard.timelyRatePct"), t("qcDashboard.grade")].map((h) => (
                        <th key={h} style={{ padding: 8, textAlign: "left", fontWeight: 600, color: "#475569" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...drillDoctorRows].sort((a, b) => (b[drillMetric as keyof typeof b] as number) - (a[drillMetric as keyof typeof a] as number)).map((r, i) => (
                      <tr key={r.doctorId} style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <td style={{ padding: 8, fontWeight: 700, color: i < 3 ? "#dc2626" : "#64748b" }}>#{i + 1}</td>
                        <td style={{ padding: 8, fontWeight: 600 }}>{r.doctorName}</td>
                        <td style={{ padding: 8 }}>{r.title}</td>
                        <td style={{ padding: 8, background: drillMetric === "reportCount" ? "var(--color-info-bg)" : undefined, fontWeight: drillMetric === "reportCount" ? 700 : 400 }}>{r.reportCount}</td>
                        <td style={{ padding: 8, background: drillMetric === "defectRate" ? "var(--color-error-bg)" : undefined, fontWeight: drillMetric === "defectRate" ? 700 : 400, color: drillMetric === "defectRate" && r.defectRate > 1.5 ? "#dc2626" : undefined }}>{r.defectRate}%</td>
                        <td style={{ padding: 8, background: drillMetric === "qcScore" ? "var(--color-success-bg)" : undefined, fontWeight: drillMetric === "qcScore" ? 700 : 400, color: drillMetric === "qcScore" && r.qcScore >= 90 ? "#059669" : drillMetric === "qcScore" && r.qcScore < 80 ? "#dc2626" : undefined }}>{r.qcScore}</td>
                        <td style={{ padding: 8, background: drillMetric === "criticalValueCount" ? "var(--color-warning-bg)" : undefined, fontWeight: drillMetric === "criticalValueCount" ? 700 : 400 }}>{r.criticalValueCount}</td>
                        <td style={{ padding: 8, background: drillMetric === "timelyRate" ? "var(--color-info-bg)" : undefined, fontWeight: drillMetric === "timelyRate" ? 700 : 400 }}>{r.timelyRate}%</td>
                        <td style={{ padding: 8 }}>{r.qcScore >= 92 ? "A" : r.qcScore >= 85 ? "B" : r.qcScore >= 75 ? "C" : "D"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-card)" }}>
                      {[t("qcDashboard.dept"), t("qcDashboard.doctorCount"), t("qcDashboard.reportCount"), t("qcDashboard.defectRatePct"), t("qcDashboard.qcScore"), t("qcDashboard.criticalValue")].map((h) => (
                        <th key={h} style={{ padding: 8, textAlign: "left", fontWeight: 600, color: "#475569" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...drillDeptRows].sort((a, b) => (b[drillMetric as keyof typeof b] as number) - (a[drillMetric as keyof typeof a] as number)).map((r) => (
                      <tr key={r.dept} style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <td style={{ padding: 8, fontWeight: 600 }}>{r.dept}</td>
                        <td style={{ padding: 8 }}>{r.doctorCount}</td>
                        <td style={{ padding: 8, background: drillMetric === "reportCount" ? "var(--color-info-bg)" : undefined, fontWeight: drillMetric === "reportCount" ? 700 : 400 }}>{r.reportCount}</td>
                        <td style={{ padding: 8, background: drillMetric === "defectRate" ? "var(--color-error-bg)" : undefined, fontWeight: drillMetric === "defectRate" ? 700 : 400 }}>{r.defectRate}%</td>
                        <td style={{ padding: 8, background: drillMetric === "qcScore" ? "var(--color-success-bg)" : undefined, fontWeight: drillMetric === "qcScore" ? 700 : 400 }}>{r.qcScore}</td>
                        <td style={{ padding: 8, background: drillMetric === "criticalValueCount" ? "var(--color-warning-bg)" : undefined, fontWeight: drillMetric === "criticalValueCount" ? 700 : 400 }}>{r.criticalValueCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 切换 */}
        <div style={{ marginTop: 24, display: "flex", gap: 6, background: "var(--bg-card)", padding: 8, borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {([
            ["overview", t("qcDashboard.tabOverview"), Layers],
            ["image", t("qcDashboard.tabImage"), Camera],
            ["report", t("qcDashboard.tabReport"), FileText],
            ["workflow", t("qcDashboard.tabWorkflow"), Clock],
            ["equipment", t("qcDashboard.tabEquipment"), Monitor],
            ["personnel", t("qcDashboard.tabPersonnel"), Users],
            ["operations", t("qcDashboard.tabOperations"), BarChart3],
            ["ai", t("qcDashboard.tabAi"), Sparkles],
            ["cqi", t("qcDashboard.tabCqi"), Target],
          ] as [QCTab, string, any][]).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1,
                padding: "10px 8px",
                background: activeTab === key ? "#1e40af" : "transparent",
                color: activeTab === key ? "#fff" : "#475569",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* 总览 Tab */}
        {activeTab === "overview" && (
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Camera size={18} color="#3b82f6" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("qcDashboard.tabImage")}</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "var(--color-info-bg)", borderRadius: 8, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#1e40af" }}>{imageQC.gradeA}</div>
                  <div style={{ fontSize: 12, color: "#1e40af", marginTop: 4 }}>{t("qcDashboard.gradeADevices")}</div>
                </div>
                <div style={{ background: "var(--color-warning-bg)", borderRadius: 8, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#92400e" }}>{imageQC.gradeB + imageQC.gradeC}</div>
                  <div style={{ fontSize: 12, color: "#92400e", marginTop: 4 }}>{t("qcDashboard.gradeBC")}</div>
                </div>
                <div style={{ background: "var(--color-error-bg)", borderRadius: 8, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#991b1b" }}>{imageQC.gradeD}</div>
                  <div style={{ fontSize: 12, color: "#991b1b", marginTop: 4 }}>{t("qcDashboard.gradeD")}</div>
                </div>
                <div style={{ background: "var(--color-success-bg)", borderRadius: 8, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#065f46" }}>{imageQC.doseCompliant}</div>
                  <div style={{ fontSize: 12, color: "#065f46", marginTop: 4 }}>{t("qcDashboard.doseCompliance")}</div>
                </div>
              </div>
              <button onClick={() => setActiveTab("image")} style={{ marginTop: 12, width: "100%", padding: "8px 0", background: "var(--color-info-bg)", color: "#1e40af", border: "1px solid var(--color-info-border)", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                {t("qcDashboard.details")}
              </button>
            </div>

            <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <FileText size={18} color="#10b981" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("qcDashboard.tabReport")}</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: t("qcDashboard.gradeA"), count: reportQC.a, color: "#10b981" },
                  { label: t("qcDashboard.gradeB"), count: reportQC.b, color: "#3b82f6" },
                  { label: t("qcDashboard.gradeC"), count: reportQC.c, color: "#f59e0b" },
                  { label: t("qcDashboard.gradeD2"), count: reportQC.d, color: "#dc2626" },
                ].map((g) => (
                  <div key={g.label} style={{ background: g.color + "15", borderRadius: 8, padding: 12, textAlign: "center", border: `1px solid ${g.color}` }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: g.color }}>{g.count}</div>
                    <div style={{ fontSize: 11, color: g.color, marginTop: 4 }}>{g.label}级</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--color-error-bg)", borderRadius: 6, fontSize: 12, color: "#991b1b" }}>
                <strong>{t("qcDashboard.defectRateLabel")}</strong> {reportQC.defectRate}{t("qcDashboard.pctThisMonth")} {reportQC.totalDefect} {t("qcDashboard.defectsOf")} {reportQC.totalReport} {t("qcDashboard.reportsCount")}
              </div>
            </div>

            <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Monitor size={18} color="#7c3aed" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("qcDashboard.tabEquipment")}</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "var(--color-success-bg)", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{t("qcDashboard.statusRunning")}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{equipmentQC.running}</div>
                </div>
                <div style={{ background: "var(--color-warning-bg)", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{t("qcDashboard.maintFault")}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>{equipmentQC.maintenance + equipmentQC.fault}</div>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
                {t("qcDashboard.monthlyScanTotal")} <strong>{equipmentQC.totalMonthlyScans.toLocaleString()}</strong> {t("qcDashboard.casesAvgPerDevice")} <strong>{equipmentQC.avgUtil}</strong> {t("qcDashboard.casesPerMonth")}
              </div>
            </div>

            <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Users size={18} color="#f59e0b" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("qcDashboard.tabPersonnel")}</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div style={{ textAlign: "center", padding: 8 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#1e40af" }}>{personnelQC.doctorCount}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{t("qcDashboard.physician")}</div>
                </div>
                <div style={{ textAlign: "center", padding: 8 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>{personnelQC.techCount}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{t("qcDashboard.technician")}</div>
                </div>
                <div style={{ textAlign: "center", padding: 8 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>{personnelQC.nurseCount}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{t("qcDashboard.nurse")}</div>
                </div>
              </div>
            </div>

            <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <TrendingUp size={18} color="#1e40af" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("qcDashboard.kpiTimeline30")}</h3>
                <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "var(--color-warning-bg)", color: "#92400e" }}>{t("qcDashboard.localData")}</span>
              </div>
              <div style={{ height: 200, display: "flex", alignItems: "flex-end", gap: 4, padding: "0 8px" }}>
                {DAILY_KPI_PRE.slice(-30).map((d, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div style={{ width: "100%", height: `${(d.examCount / 1000) * 100}px`, background: "linear-gradient(180deg, #3b82f6, #1e40af)", borderRadius: "2px 2px 0 0", minHeight: 4 }} title={`${d.date}: ${d.examCount} 例`} />
                    <span style={{ fontSize: 8, color: "#94a3b8" }}>{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                {t("qcDashboard.dailyAvg")} <strong>{(DAILY_KPI_PRE.reduce((s, d) => s + d.examCount, 0) / 30).toFixed(0)}</strong> {t("qcDashboard.casesPeak")} <strong>{Math.max(...DAILY_KPI_PRE.map((d) => d.examCount))}</strong> {t("qcDashboard.casesPerDay")}
              </div>
            </div>
          </div>
        )}

        {/* 影像质控 Tab */}
        {activeTab === "image" && (
          <div style={{ marginTop: 16, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>{t("qcDashboard.imageDeviceGrade")}</h3>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--bg-card)" }}>
                  {[t("qcDashboard.device"), t("qcDashboard.model"), t("qcDashboard.manufacturer"), t("qcDashboard.grade"), t("qcDashboard.doseComplianceRate"), t("qcDashboard.monthlyScans"), t("qcDashboard.status")].map((h) => (
                    <th key={h} style={{ padding: 8, textAlign: "left", fontWeight: 600, color: "#475569" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEVICE_MASTER.slice(0, 20).map((d) => (
                  <tr key={d.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: 8, fontFamily: "monospace", fontSize: 11 }}>{d.id}</td>
                    <td style={{ padding: 8 }}>{d.model}</td>
                    <td style={{ padding: 8 }}>{d.brand}</td>
                    <td style={{ padding: 8 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: d.imageQualityGrade === "A" ? "var(--color-success-bg)" : d.imageQualityGrade === "D" ? "var(--color-error-bg)" : "var(--color-warning-bg)", color: d.imageQualityGrade === "A" ? "#065f46" : d.imageQualityGrade === "D" ? "#991b1b" : "#92400e" }}>
                        {d.imageQualityGrade} 级
                      </span>
                    </td>
                    <td style={{ padding: 8 }}>{d.doseComplianceRate}%</td>
                    <td style={{ padding: 8 }}>{d.monthlyScans}</td>
                    <td style={{ padding: 8 }}>{d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}

        {/* 报告质控 Tab */}
        {activeTab === "report" && (
          <div style={{ marginTop: 16, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>{t("qcDashboard.reportDoctorPerf")}</h3>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--bg-card)" }}>
                  {[t("qcDashboard.rank"), t("qcDashboard.doctor"), t("qcDashboard.title"), t("qcDashboard.reportNum"), t("qcDashboard.defectCount"), t("qcDashboard.defectRate"), "质量分", t("qcDashboard.grade")].map((h) => (
                    <th key={h} style={{ padding: 8, textAlign: "left", fontWeight: 600, color: "#475569" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {personnelQC.topPerformers.slice(0, 15).map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: 8, fontWeight: 700, color: i < 3 ? "#dc2626" : "#64748b" }}>#{i + 1}</td>
                    <td style={{ padding: 8 }}>{p.doctorName}</td>
                    <td style={{ padding: 8 }}>{p.title}</td>
                    <td style={{ padding: 8 }}>{p.reportCount}</td>
                    <td style={{ padding: 8 }}>{p.defectCount}</td>
                    <td style={{ padding: 8 }}>{p.defectRate}%</td>
                    <td style={{ padding: 8, fontWeight: 700, color: p.qcScore >= 90 ? "#10b981" : p.qcScore >= 80 ? "#f59e0b" : "#dc2626" }}>{p.qcScore}</td>
                    <td style={{ padding: 8 }}>{p.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}

        {/* 其他 Tab 简略展示 */}
        {(activeTab === "workflow" || activeTab === "equipment" || activeTab === "personnel" || activeTab === "operations" || activeTab === "ai" || activeTab === "cqi") && (
          <div style={{ marginTop: 16, background: "var(--bg-card)", borderRadius: 10, padding: 40, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center" }}>
            <CheckCircle size={48} color="#10b981" style={{ margin: "0 auto 12px" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{activeTab === "workflow" ? t("qcDashboard.tabWorkflow") : activeTab === "equipment" ? t("qcDashboard.tabEquipment") : activeTab === "personnel" ? t("qcDashboard.tabPersonnel") : activeTab === "operations" ? t("qcDashboard.tabOperations") : activeTab === "ai" ? t("qcDashboard.tabAi") : t("qcDashboard.cqiImprovement")}</h3>
              {(activeTab === "ai" || activeTab === "cqi") && (
                <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "var(--color-warning-bg)", color: "#92400e" }}>{t("qcDashboard.hardcodedDemo")}</span>
              )}
            </div>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{t("qcDashboard.detailLoaded")} {DAILY_KPI_PRE.length} {t("qcDashboard.daysOf")} {personnelQC.topPerformers.length} {t("qcDashboard.doctorsOf")} {DEVICE_MASTER.length} {t("qcDashboard.devicesOf")}</p>
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, maxWidth: 800, margin: "16px auto 0" }}>
              {activeTab === "ai" ? (
                <>
                  <div style={{ padding: 16, background: "var(--color-info-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#1e40af" }}>{t("qcDashboard.aiAccuracy")}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#1e40af" }}>{(aiQC.accuracy * 100).toFixed(0)}%</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-success-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#16a34a" }}>{t("qcDashboard.aiPrecision")}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{(aiQC.precision * 100).toFixed(0)}%</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-warning-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#d97706" }}>{t("qcDashboard.aiRecall")}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>{(aiQC.recall * 100).toFixed(0)}%</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-error-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#dc2626" }}>{t("qcDashboard.aiFalsePositive")}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#dc2626" }}>{(aiQC.fpRate * 100).toFixed(0)}%</div>
                  </div>
                </>
              ) : activeTab === "cqi" ? (
                <>
                  <div style={{ padding: 16, background: "var(--color-info-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#1e40af" }}>{t("qcDashboard.pdcaActive")}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#1e40af" }}>{cqi.activePDCA}</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-success-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#16a34a" }}>{t("qcDashboard.completed")}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{cqi.completedPDCA}</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-warning-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#d97706" }}>{t("qcDashboard.improvementRate")}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>{(cqi.improvementRate * 100).toFixed(0)}%</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-info-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#7c3aed" }}>{t("qcDashboard.totalProjects")}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#7c3aed" }}>{cqi.activePDCA + cqi.completedPDCA}</div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ padding: 16, background: "var(--color-info-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#1e40af" }}>{t("qcDashboard.slaRate")}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#1e40af" }}>{workflowQC.slaMet}%</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-success-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#16a34a" }}>{t("qcDashboard.devicesRunning")}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{equipmentQC.running}</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-warning-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#d97706" }}>{t("qcDashboard.avgUtilization")}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>{equipmentQC.avgUtil}</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-info-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#7c3aed" }}>{t("qcDashboard.totalDoctors")}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#7c3aed" }}>{personnelQC.doctorCount}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          [v3.0.6.11-99 Wave10B] 深化区块: 质控趋势多图 / 科室对比 / 医生榜 / 图像三维度
          ============================================================ */}
      {renderQcTrendCharts()}
      {renderDeptCompare()}
      {renderDoctorRankBoards()}
      {renderImageDimTrend()}
      {renderAiQcAndDevices()}
    </PageContainer>
  );
}