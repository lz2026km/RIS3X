// @ts-nocheck
import { Users, FileText, AlertCircle, Award } from "lucide-react";

const C = {
  primary: "#1e40af", primaryLight: "#3b82f6", primaryLighter: "#dbeafe",
  accent: "#0891b2", accentLight: "#06b6d4", white: "#ffffff", bg: "#e8e8e8",
  border: "#d1d5db", borderLight: "#e5e7eb", textDark: "#1f2937", textMid: "#4b5563",
  textLight: "#9ca3af", success: "#059669", successBg: "#d1fae5",
  warning: "#d97706", warningBg: "#fef3c7", danger: "#dc2626", dangerBg: "#fee2e2",
  info: "#2563eb", infoBg: "#dbeafe", purple: "#7c3aed", purpleBg: "#ede9fe",
};

export const StatCard = ({ label, value, subLabel, icon: Icon, color, bg }: any) => {
  const cardStyle: React.CSSProperties = {
    background: C.white, borderRadius: 8, padding: "16px 20px",
    display: "flex", alignItems: "center", gap: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: `1px solid ${C.borderLight}`,
    minWidth: 200,
  };
  const iconWrapStyle: React.CSSProperties = {
    width: 48, height: 48, borderRadius: 8, background: bg,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  return (
    <div style={cardStyle}>
      <div style={iconWrapStyle}><Icon style={{ width: 24, height: 24, color }} /></div>
      <div>
        <div style={{ fontSize: 13, color: C.textMid, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: C.textDark }}>{value}</div>
        <div style={{ fontSize: 12, color: C.textLight }}>{subLabel}</div>
      </div>
    </div>
  );
};

export const STAT_CARDS = [
  { label: "科室总人数", value: "15", subLabel: "在线 12 人", icon: Users, color: "#1e40af", bg: "#dbeafe" },
  { label: "本月报告数", value: "4,286", subLabel: "较上月 +12.5%", icon: FileText, color: "#059669", bg: "#d1fae5" },
  { label: "平均阳性率", value: "32.5%", subLabel: "较上月 +2.1%", icon: AlertCircle, color: "#d97706", bg: "#fef3c7" },
  { label: "质控评分", value: "96.8", subLabel: "优秀", icon: Award, color: "#7c3aed", bg: "#ede9fe" },
];

export default function DepartmentStats() {
  return (
    <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
      {STAT_CARDS.map((card, i) => <StatCard key={i} {...card} />)}
    </div>
  );
}
