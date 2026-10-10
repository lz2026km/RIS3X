import { useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend,
} from "recharts";
import { ChartContainer } from "../../components/charts";
import { t } from "../../i18n/appI18n";

const C = {
  primary: "var(--color-primary-800)", primaryLight: "var(--color-primary-500)", primaryLighter: "#dbeafe",
  accent: "var(--color-info-600)", white: "#ffffff", bg: "#e8e8e8", bgLight: "#f1f5f9",
  border: "#d1d5db", borderLight: "var(--border-color, #e5e7eb)", textDark: "#1f2937", textMid: "#4b5563",
  textLight: "#9ca3af", success: "#059669", successBg: "#d1fae5", warning: "var(--color-warning-600)",
  warningBg: "#fef3c7", danger: "var(--color-error-600)", dangerBg: "#fee2e2", info: "var(--color-primary-600)",
  infoBg: "#dbeafe", purple: "#7c3aed", purpleBg: "#ede9fe",
};

const PERFORMANCE_DATA = [
  { staffId: "S003", name: "王建国", written: 145, reviewed: 98, positive: 42, quality: 96.5, overtime: 3 },
  { staffId: "S004", name: "刘芳", written: 132, reviewed: 85, positive: 38, quality: 97.2, overtime: 5 },
  { staffId: "S005", name: "陈海涛", written: 128, reviewed: 76, positive: 35, quality: 95.8, overtime: 2 },
  { staffId: "S011", name: "黄志强", written: 115, reviewed: 92, positive: 30, quality: 94.5, overtime: 4 },
  { staffId: "S015", name: "高峰", written: 108, reviewed: 68, positive: 28, quality: 96.1, overtime: 1 },
];

const WORKLOAD_RANKING = [
  { rank: 1, name: "王建国", role: "医师", written: 145, reviewed: 98, score: 98.5 },
  { rank: 2, name: "刘芳", role: "医师", written: 132, reviewed: 85, score: 97.2 },
  { rank: 3, name: "陈海涛", role: "医师", written: 128, reviewed: 76, score: 96.8 },
  { rank: 4, name: "黄志强", role: "医师", written: 115, reviewed: 92, score: 95.5 },
  { rank: 5, name: "高峰", role: "医师", written: 108, reviewed: 68, score: 95.1 },
];

// 阳性率 = 阳性数 / 报告数 × 100 (此前误把阳性计数当百分比)
const POSITIVE_RATE_DATA = PERFORMANCE_DATA.map((p) => ({
  name: p.name,
  rate: p.written > 0 ? +((p.positive / p.written) * 100).toFixed(1) : 0,
  total: p.written,
}));

const QUALITY_SCORE_DATA = [
  { name: "王建国", score: 96.5 },
  { name: "刘芳", score: 97.2 },
  { name: "陈海涛", score: 95.8 },
  { name: "黄志强", score: 94.5 },
  { name: "高峰", score: 96.1 },
];

const DEPT_KPI_METRICS = [
  { label: t("deptFinance.metric.revenue"), value: 2850000, unit: t("deptFinance.unit.yuan"), trend: "up", change: 12.5, peerAvg: 2500000, target: 3000000 },
  { label: t("deptFinance.metric.examVolume"), value: 4286, unit: t("deptFinance.unit.case"), trend: "up", change: 8.3, peerAvg: 3800, target: 4500 },
  { label: t("deptFinance.metric.turnaround"), value: 4.2, unit: t("deptFinance.unit.hour"), trend: "down", change: -5.1, peerAvg: 5.0, target: 4.0 },
  { label: t("deptFinance.metric.qualityScore"), value: 96.8, unit: t("deptFinance.unit.point"), trend: "stable", change: 0.3, peerAvg: 94.5, target: 98 },
  { label: t("deptFinance.metric.satisfaction"), value: 92.5, unit: "%", trend: "up", change: 2.1, peerAvg: 89, target: 95 },
  { label: t("deptFinance.metric.criticalRate"), value: 98.2, unit: "%", trend: "up", change: 1.5, peerAvg: 96, target: 100 },
];

const KPI_TREND_DATA = [
  { month: "2026-01", revenue: 2450, exams: 3850, quality: 95.2, satisfaction: 90.1 },
  { month: "2026-02", revenue: 2320, exams: 3620, quality: 95.8, satisfaction: 90.5 },
  { month: "2026-03", revenue: 2680, exams: 4050, quality: 96.3, satisfaction: 91.2 },
  { month: "2026-04", revenue: 2750, exams: 4180, quality: 96.5, satisfaction: 91.8 },
  { month: "2026-05", revenue: 2850, exams: 4286, quality: 96.8, satisfaction: 92.5 },
];

export default function DepartmentFinanceSummary({ activeTab }: { activeTab: string }) {
  const [kpiView, setKpiView] = useState<"cards" | "charts">("cards");

  const panelStyle = { background: C.white, borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: `1px solid ${C.borderLight}`, overflow: "hidden" };
  const panelHeaderStyle = { padding: "12px 16px", borderBottom: `1px solid ${C.borderLight}`, fontSize: 14, fontWeight: 600, color: C.textDark, display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-primary)" };
  const panelBodyStyle = { padding: 'var(--space-4, 16px)' };

  if (activeTab === "performance") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)' }}>
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>{t("deptFinance.workloadStats")} {/* [G005 Wave2B P2] PERFORMANCE_DATA 等全硬编码 → 演示数据徽标 */}<span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-warning-bg, #fffbeb)', color: 'var(--color-warning-600)', border: '1px solid var(--color-warning-300, #fcd34d)', fontWeight: 600 }}>{t("deptFinance.demoData")}</span></span>
            <div style={{ display: "flex", gap: 'var(--space-2, 8px)' }}>
              <select style={{ padding: "4px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }}><option>{t("deptFinance.thisWeek")}</option><option>{t("deptFinance.thisMonth")}</option><option>{t("deptFinance.thisQuarter")}</option></select>
            </div>
          </div>
          <div style={panelBodyStyle}>
              <div style={{ marginBottom: 'var(--space-6, 24px)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark, marginBottom: 'var(--space-3, 12px)' }}>{t("deptFinance.personalReportCount")}</div>
                <ChartContainer type="bar" state={PERFORMANCE_DATA.length === 0 ? 'empty' : 'ready'} emptyDescription={t("deptFinance.noReportCountData")}>
                  <BarChart data={PERFORMANCE_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip />
                    <Bar dataKey="written" name={t("deptFinance.written")} fill={C.primary} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="reviewed" name={t("deptFinance.reviewed")} fill={C.accent} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark, marginBottom: 'var(--space-3, 12px)' }}>{t("deptFinance.positiveRateTrend")}</div>
              <ChartContainer type="line" state={POSITIVE_RATE_DATA.length === 0 ? 'empty' : 'ready'} emptyDescription={t("deptFinance.noPositiveRateData")}>
                <LineChart data={POSITIVE_RATE_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Line type="monotone" dataKey="rate" stroke={C.warning} strokeWidth={2} dot={{ fill: C.warning, r: 4 }} />
                </LineChart>
              </ChartContainer>
            </div>
          </div>
        </div>
        <div style={panelStyle}>
          <div style={panelHeaderStyle}><span>{t("deptFinance.workloadRankingQc")}</span></div>
          <div style={panelBodyStyle}>
            <div style={{ marginBottom: 'var(--space-6, 24px)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark, marginBottom: 'var(--space-3, 12px)' }}>{t("deptFinance.workloadTop5")}</div>
              {WORKLOAD_RANKING.map((r, i) => (
                <div key={r.rank} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.borderLight}`, gap: 'var(--space-3, 12px)' }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: i === 0 ? "var(--color-warning-400)" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c32" : C.borderLight, color: i < 3 ? C.white : C.textMid, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{r.rank}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 500, color: C.textDark }}>{r.name}</div><div style={{ fontSize: 12, color: C.textLight }}>{r.role}</div></div>
                  <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, fontWeight: 600, color: C.primary }}>{t("deptFinance.portions", { count: r.written + r.reviewed })}</div><div style={{ fontSize: 12, color: C.success }}>{t("deptFinance.score", { score: r.score })}</div></div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark, marginBottom: 'var(--space-3, 12px)' }}>{t("deptFinance.qualityScore")}</div>
              <div>
                <ChartContainer type="bar" state={QUALITY_SCORE_DATA.length === 0 ? 'empty' : 'ready'} emptyDescription={t("deptFinance.noQualityScoreData")}>
                  <BarChart data={QUALITY_SCORE_DATA} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                    <XAxis type="number" domain={[90, 100]} tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={60} />
                    <Tooltip formatter={(v) => t('w9e.deptFinance.scoreUnit', { value: v })} />
                    <Bar dataKey="score" fill={C.success} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "kpi") {
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-5, 20px)' }}>
          {DEPT_KPI_METRICS.map((metric, i) => (
            <div key={i} style={{ padding: 'var(--space-4, 16px)', background: C.white, borderRadius: 8, border: `1px solid ${C.borderLight}`, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 'var(--space-2, 8px)' }}>
                <div style={{ fontSize: 12, color: C.textMid, fontWeight: 500 }}>{metric.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)', fontSize: 12, color: metric.trend === "up" ? C.success : metric.trend === "down" ? C.danger : C.textMid }}>
                  {metric.trend === "up" ? <TrendingUp size={14} /> : metric.trend === "down" ? <TrendingDown size={14} /> : <Minus size={14} />}
                  {metric.change > 0 ? "+" : ""}{metric.change}%
                </div>
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, color: C.textDark, marginBottom: 'var(--space-1, 4px)' }}>
                {metric.value.toLocaleString()}<span style={{ fontSize: 14, fontWeight: 400, color: C.textMid }}> {metric.unit}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textLight }}>
                <span>{t("deptFinance.target", { value: metric.target.toLocaleString() })}</span>
                <span>{t("deptFinance.peer", { value: metric.peerAvg.toLocaleString() })}</span>
              </div>
              <div style={{ marginTop: 'var(--space-2, 8px)', background: C.bgLight, height: 4, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (metric.value / metric.target) * 100)}%`, height: "100%", background: metric.value >= metric.target ? C.success : metric.value >= metric.peerAvg ? C.warning : C.danger, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: 'var(--space-4, 16px)', background: C.bgLight, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 'var(--space-5, 20px)' }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 'var(--space-4, 16px)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: C.textDark, margin: 0 }}>{t("deptFinance.kpiMonthlyTrend")} <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-warning-bg, #fffbeb)', color: 'var(--color-warning-600)', border: '1px solid var(--color-warning-300, #fcd34d)', fontWeight: 600 }}>{t("deptFinance.demoData")}</span></h4>
            <div style={{ display: "flex", gap: 'var(--space-2, 8px)' }}>
              {["cards", "charts"].map((v) => (
                <button key={v} onClick={() => setKpiView(v as any)} style={{ padding: "4px 12px", background: kpiView === v ? C.primary : C.white, color: kpiView === v ? C.white : C.textMid, border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer", fontSize: 12 }}>{v === "cards" ? t("deptFinance.overview") : t("deptFinance.charts")}</button>
              ))}
            </div>
          </div>
          {kpiView === "charts" && (
            <ChartContainer height={260} state={KPI_TREND_DATA.length === 0 ? 'empty' : 'ready'} emptyDescription={t("deptFinance.noKpiTrendData")}>
              <LineChart data={KPI_TREND_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={[90, 100]} />
                <Tooltip /><Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenue" name={t("deptFinance.revenue10k")} stroke={C.primary} strokeWidth={2} dot={{ r: 4 }} />
                <Line yAxisId="left" type="monotone" dataKey="exams" name={t("deptFinance.examVolume")} stroke={C.accent} strokeWidth={2} dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="quality" name={t("deptFinance.qualityScoreName")} stroke={C.success} strokeWidth={2} dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="satisfaction" name={t("deptFinance.satisfactionPct")} stroke={C.warning} strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ChartContainer>
          )}
          {kpiView === "cards" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 'var(--space-3, 12px)' }}>
              {KPI_TREND_DATA.map((d, i) => (
                <div key={i} style={{ padding: 'var(--space-3, 12px)', background: C.white, borderRadius: 6, textAlign: "center", border: `1px solid ${C.borderLight}` }}>
                  <div style={{ fontSize: 12, color: C.textMid, marginBottom: 'var(--space-1, 4px)' }}>{d.month}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.primary }}>{d.revenue}w</div>
                  <div style={{ fontSize: 12, color: C.textLight }}>{t("deptFinance.unitCases", { value: d.exams })}</div>
                  <div style={{ fontSize: 12, color: C.success }}>{t("deptFinance.unitScore", { value: d.quality })}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
