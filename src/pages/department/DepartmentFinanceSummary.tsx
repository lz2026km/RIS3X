// @ts-nocheck
import { useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Minus, Eye, Award } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend,
} from "recharts";
import { ChartContainer } from "../../components/charts";

const C = {
  primary: "#1e40af", primaryLight: "#3b82f6", primaryLighter: "#dbeafe",
  accent: "#0891b2", white: "#ffffff", bg: "#e8e8e8", bgLight: "#f1f5f9",
  border: "#d1d5db", borderLight: "#e5e7eb", textDark: "#1f2937", textMid: "#4b5563",
  textLight: "#9ca3af", success: "#059669", successBg: "#d1fae5", warning: "#d97706",
  warningBg: "#fef3c7", danger: "#dc2626", dangerBg: "#fee2e2", info: "#2563eb",
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

const POSITIVE_RATE_DATA = [
  { name: "王建国", rate: 42, total: 145 },
  { name: "刘芳", rate: 38, total: 132 },
  { name: "陈海涛", rate: 35, total: 128 },
  { name: "黄志强", rate: 30, total: 115 },
  { name: "高峰", rate: 28, total: 108 },
];

const QUALITY_SCORE_DATA = [
  { name: "王建国", score: 96.5 },
  { name: "刘芳", score: 97.2 },
  { name: "陈海涛", score: 95.8 },
  { name: "黄志强", score: 94.5 },
  { name: "高峰", score: 96.1 },
];

const DEPT_KPI_METRICS = [
  { label: "月度收入", value: 2850000, unit: "元", trend: "up", change: 12.5, peerAvg: 2500000, target: 3000000 },
  { label: "检查量", value: 4286, unit: "例", trend: "up", change: 8.3, peerAvg: 3800, target: 4500 },
  { label: "平均周转时间", value: 4.2, unit: "小时", trend: "down", change: -5.1, peerAvg: 5.0, target: 4.0 },
  { label: "质控评分", value: 96.8, unit: "分", trend: "stable", change: 0.3, peerAvg: 94.5, target: 98 },
  { label: "患者满意度", value: 92.5, unit: "%", trend: "up", change: 2.1, peerAvg: 89, target: 95 },
  { label: "危急值及时率", value: 98.2, unit: "%", trend: "up", change: 1.5, peerAvg: 96, target: 100 },
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
  const panelBodyStyle = { padding: 16 };

  if (activeTab === "performance") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span>工作量统计 {/* [G005 Wave2B P2] PERFORMANCE_DATA 等全硬编码 → 演示数据徽标 */}<span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', fontWeight: 600 }}>演示数据</span></span>
            <div style={{ display: "flex", gap: 8 }}>
              <select style={{ padding: "4px 8px", border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12 }}><option>本周</option><option>本月</option><option>本季度</option></select>
            </div>
          </div>
          <div style={panelBodyStyle}>
              <div style={{ height: 200, marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark, marginBottom: 12 }}>个人报告数量</div>
                <ChartContainer height={170} state={PERFORMANCE_DATA.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无报告数量数据">
                  <BarChart data={PERFORMANCE_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip />
                    <Bar dataKey="written" name="书写" fill={C.primary} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="reviewed" name="审核" fill={C.accent} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            <div style={{ height: 180 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark, marginBottom: 12 }}>阳性率趋势</div>
              <ChartContainer height={144} state={POSITIVE_RATE_DATA.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无阳性率数据">
                <LineChart data={POSITIVE_RATE_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} domain={[0, 60]} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Line type="monotone" dataKey="rate" stroke={C.warning} strokeWidth={2} dot={{ fill: C.warning, r: 4 }} />
                </LineChart>
              </ChartContainer>
            </div>
          </div>
        </div>
        <div style={panelStyle}>
          <div style={panelHeaderStyle}><span>工作量排名 & 质控</span></div>
          <div style={panelBodyStyle}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark, marginBottom: 12 }}>工作量 TOP 5</div>
              {WORKLOAD_RANKING.map((r, i) => (
                <div key={r.rank} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.borderLight}`, gap: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c32" : C.borderLight, color: i < 3 ? C.white : C.textMid, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{r.rank}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{r.name}</div><div style={{ fontSize: 12, color: C.textLight }}>{r.role}</div></div>
                  <div style={{ textAlign: "right" }}><div style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>{r.written + r.reviewed}份</div><div style={{ fontSize: 12, color: C.success }}>评分 {r.score}</div></div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark, marginBottom: 12 }}>质控评分</div>
              <div style={{ height: 150 }}>
                <ChartContainer height={150} state={QUALITY_SCORE_DATA.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无质控评分数据">
                  <BarChart data={QUALITY_SCORE_DATA} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                    <XAxis type="number" domain={[90, 100]} tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={60} />
                    <Tooltip formatter={(v) => `${v}分`} />
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
          {DEPT_KPI_METRICS.map((metric, i) => (
            <div key={i} style={{ padding: 16, background: C.white, borderRadius: 8, border: `1px solid ${C.borderLight}`, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: C.textMid, fontWeight: 500 }}>{metric.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: metric.trend === "up" ? C.success : metric.trend === "down" ? C.danger : C.textMid }}>
                  {metric.trend === "up" ? <TrendingUp size={14} /> : metric.trend === "down" ? <TrendingDown size={14} /> : <Minus size={14} />}
                  {metric.change > 0 ? "+" : ""}{metric.change}%
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.textDark, marginBottom: 4 }}>
                {metric.value.toLocaleString()}<span style={{ fontSize: 14, fontWeight: 400, color: C.textMid }}> {metric.unit}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textLight }}>
                <span>目标：{metric.target.toLocaleString()}</span>
                <span>同行：{metric.peerAvg.toLocaleString()}</span>
              </div>
              <div style={{ marginTop: 8, background: C.bgLight, height: 4, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (metric.value / metric.target) * 100)}%`, height: "100%", background: metric.value >= metric.target ? C.success : metric.value >= metric.peerAvg ? C.warning : C.danger, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: 16, background: C.bgLight, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: C.textDark, margin: 0 }}>月度趋势 <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', fontWeight: 600 }}>演示数据</span></h4>
            <div style={{ display: "flex", gap: 8 }}>
              {["cards", "charts"].map((v) => (
                <button key={v} onClick={() => setKpiView(v as any)} style={{ padding: "4px 12px", background: kpiView === v ? C.primary : C.white, color: kpiView === v ? C.white : C.textMid, border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer", fontSize: 12 }}>{v === "cards" ? "概览" : "图表"}</button>
              ))}
            </div>
          </div>
          {kpiView === "charts" && (
            <ChartContainer height={260} state={KPI_TREND_DATA.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无KPI趋势数据">
              <LineChart data={KPI_TREND_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={[90, 100]} />
                <Tooltip /><Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenue" name="收入(万元)" stroke={C.primary} strokeWidth={2} dot={{ r: 4 }} />
                <Line yAxisId="left" type="monotone" dataKey="exams" name="检查量(例)" stroke={C.accent} strokeWidth={2} dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="quality" name="质控评分" stroke={C.success} strokeWidth={2} dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="satisfaction" name="满意度(%)" stroke={C.warning} strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ChartContainer>
          )}
          {kpiView === "cards" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {KPI_TREND_DATA.map((d, i) => (
                <div key={i} style={{ padding: 12, background: C.white, borderRadius: 6, textAlign: "center", border: `1px solid ${C.borderLight}` }}>
                  <div style={{ fontSize: 12, color: C.textMid, marginBottom: 4 }}>{d.month}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.primary }}>{d.revenue}w</div>
                  <div style={{ fontSize: 12, color: C.textLight }}>{d.exams}例</div>
                  <div style={{ fontSize: 12, color: C.success }}>{d.quality}分</div>
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
