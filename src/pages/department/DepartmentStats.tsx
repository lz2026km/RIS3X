import { Users, FileText, AlertCircle, Award } from "lucide-react";
import { StatCard as CommonStatCard } from "../../components/common/StatCard";

// [UI-4] 统一使用公共 StatCard (保留 label/value/subLabel/icon/color/bg 用法)
export const StatCard = ({ label, value, subLabel, icon: Icon, color, bg }: any) => (
  <CommonStatCard
    title={label}
    value={value}
    sub={subLabel}
    icon={Icon ? <Icon style={{ width: 24, height: 24 }} /> : undefined}
    color={color}
    iconBg={bg}
    style={{ minWidth: 200 }}
  />
);

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
