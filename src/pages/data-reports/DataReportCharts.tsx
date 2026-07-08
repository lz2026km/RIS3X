// @ts-nocheck
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";

export const COLORS = {
  primary: "#1e40af", primaryLight: "#3b82f6", secondary: "#0891b2",
  success: "#16a34a", successLight: "#dcfce7", warning: "#d97706",
  warningLight: "#fef3c7", danger: "#dc2626", dangerLight: "#fee2e2",
  bgGray: "#f1f5f9", cardWhite: "#ffffff", textDark: "#1f2937",
  textMuted: "#6b7280", border: "#e5e7eb",
  ct: "#3b82f6", mri: "#8b5cf6", dr: "#10b981", mg: "#f59e0b", dsa: "#ef4444", cr: "#3b82f6",
};

export const styles = {
  pageContainer: { minHeight: "100vh", backgroundColor: COLORS.bgGray, fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', fontSize: "14px", color: COLORS.textDark },
  header: { background: "linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)", color: "white", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" },
  headerTitle: { display: "flex", alignItems: "center", gap: "12px", fontSize: "20px", fontWeight: 600 },
  headerSubtitle: { fontSize: "12px", opacity: 0.85, marginTop: "2px" },
  headerActions: { display: "flex", gap: "12px", alignItems: "center" },
  headerBtn: { backgroundColor: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s" },
  statsContainer: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", padding: "20px 24px" },
  statCard: { backgroundColor: COLORS.cardWhite, borderRadius: "10px", padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb", position: "relative", overflow: "hidden" },
  statCardAccent: { position: "absolute", top: 0, left: 0, width: "4px", height: "100%" },
  statLabel: { fontSize: "12px", color: COLORS.textMuted, marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" },
  statValue: { fontSize: "28px", fontWeight: 700, color: COLORS.primary },
  statUnit: { fontSize: "14px", fontWeight: 400, color: COLORS.textMuted, marginLeft: "4px" },
  statChange: { fontSize: "11px", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" },
  mainContent: { padding: "0 24px 20px", display: "flex", flexDirection: "column", gap: "16px" },
  tabsContainer: { display: "flex", gap: "4px", backgroundColor: COLORS.cardWhite, padding: "6px", borderRadius: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb", flexWrap: "wrap" },
  tab: { padding: "10px 20px", borderRadius: "6px", cursor: "pointer", fontSize: "14px", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px", transition: "all 0.2s", border: "none", backgroundColor: "transparent", color: COLORS.textMuted },
  tabActive: { backgroundColor: COLORS.primary, color: "white", boxShadow: "0 2px 4px rgba(30,64,175,0.3)" },
  card: { backgroundColor: COLORS.cardWhite, borderRadius: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb", overflow: "hidden" },
  cardHeader: { padding: "14px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fafafa" },
  cardTitle: { fontSize: "15px", fontWeight: 600, color: COLORS.textDark, display: "flex", alignItems: "center", gap: "8px" },
  cardBody: { padding: "18px" },
  filterBar: { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", padding: "14px 18px", backgroundColor: "#f8fafc", borderBottom: "1px solid #e5e7eb" },
  filterGroup: { display: "flex", alignItems: "center", gap: "8px" },
  filterLabel: { fontSize: "13px", color: COLORS.textMuted },
  select: { padding: "6px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", backgroundColor: "white", cursor: "pointer", outline: "none" },
  input: { padding: "6px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", outline: "none" },
  btn: { padding: "8px 16px", borderRadius: "6px", border: "none", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s" },
  btnPrimary: { backgroundColor: COLORS.primary, color: "white" },
  btnOutline: { backgroundColor: "white", border: "1px solid #d1d5db", color: COLORS.textDark },
  btnSuccess: { backgroundColor: COLORS.success, color: "white" },
  btnWarning: { backgroundColor: COLORS.warning, color: "white" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { backgroundColor: "#f8fafc", padding: "12px 14px", textAlign: "left", fontWeight: 600, color: COLORS.textDark, borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap" },
  td: { padding: "12px 14px", borderBottom: "1px solid #e5e7eb", color: COLORS.textDark },
  statusBadge: { padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" },
  chartContainer: { height: "320px", width: "100%" },
  chartSmall: { height: "240px", width: "100%" },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" },
  grid4: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" },
  listItem: { padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "background-color 0.2s" },
  progressBar: { height: "8px", backgroundColor: "#e5e7eb", borderRadius: "4px", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: "4px", transition: "width 0.3s" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { backgroundColor: "white", borderRadius: "12px", width: "90%", maxWidth: "800px", maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
  modalHeader: { padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc" },
  modalBody: { padding: "20px" },
  pagination: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid #e5e7eb", backgroundColor: "#fafafa" },
  emptyState: { textAlign: "center", padding: "40px 20px", color: COLORS.textMuted },
};

export const StatCard = ({ icon: Icon, label, value, unit, change, changeType, color }) => (
  <div style={styles.statCard}>
    <div style={{ ...styles.statCardAccent, backgroundColor: color || COLORS.primary }} />
    <div style={styles.statLabel}><Icon size={16} />{label}</div>
    <div style={styles.statValue}>{value}<span style={styles.statUnit}>{unit}</span></div>
    {change && (
      <div style={{ ...styles.statChange, color: changeType === "up" ? COLORS.success : COLORS.danger }}>
        {changeType === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {change}
      </div>
    )}
  </div>
);

export const DeviceUsageChart = ({ data }) => {
  const total = data.reduce((sum, d) => sum + d.usage, 0);
  const avgUsage = Math.round(total / data.length);
  return (
    <div style={styles.chartSmall}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" width={50} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => [`${value}%`, "使用率"]} contentStyle={{ borderRadius: "6px", border: "1px solid #e5e7eb" }} />
          <Bar dataKey="usage" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.usage >= 80 ? COLORS.success : entry.usage >= 60 ? COLORS.warning : COLORS.danger} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const QualityScoreChart = ({ data }) => (
  <div style={styles.chartSmall}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis domain={[85, 100]} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [`${value}%`, "评分"]} contentStyle={{ borderRadius: "6px", border: "1px solid #e5e7eb" }} />
        <Bar dataKey="score" fill={COLORS.primary} radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.score >= 95 ? COLORS.success : entry.score >= 90 ? COLORS.primaryLight : COLORS.warning} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export const DoseTrendChart = ({ data }) => (
  <div style={styles.chartContainer}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
        <Tooltip contentStyle={{ borderRadius: "6px", border: "1px solid #e5e7eb" }} />
        <Legend />
        <Line yAxisId="left" type="monotone" dataKey="CT_DLP" name="CT-DLP (mGy·cm)" stroke={COLORS.ct} strokeWidth={2} dot={{ r: 4 }} />
        <Line yAxisId="right" type="monotone" dataKey="CT_Dose" name="CT有效剂量 (mSv)" stroke={COLORS.mri} strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export const ConsultationPieChart = ({ data }) => {
  const chartData = data.map((d) => ({ name: d.type, value: d.total }));
  return (
    <div style={styles.chartSmall}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={[COLORS.ct, COLORS.mri, COLORS.dr, COLORS.mg][index % 4]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: "6px", border: "1px solid #e5e7eb" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ExamVolumeChart = ({ data }) => (
  <div style={styles.chartContainer}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip contentStyle={{ borderRadius: "6px", border: "1px solid #e5e7eb" }} />
        <Legend />
        <Bar dataKey="CT" stackId="a" fill={COLORS.ct} radius={[0, 0, 0, 0]} />
        <Bar dataKey="MR" stackId="a" fill={COLORS.mri} />
        <Bar dataKey="DR" stackId="a" fill={COLORS.dr} />
        <Bar dataKey="MG" stackId="a" fill={COLORS.mg} />
        <Bar dataKey="DSA" stackId="a" fill={COLORS.dsa} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);
