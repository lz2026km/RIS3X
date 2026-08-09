import { Baby, Info, User, AlertTriangle } from "lucide-react";
import { pediatricDoseRecords } from "./mockData";
import { getAlertBadge } from "./utils";
import type { PediatricDoseRecord } from "./types";

// [W3-C] 儿科剂量: rdsrApi 无儿科专项端点, 标注「演示数据」
export default function PediatricDoseManagement() {
  const totalPediatricExams = pediatricDoseRecords.length;
  const ageGroups = {
    "0-5岁": pediatricDoseRecords.filter((r: PediatricDoseRecord) => r.ageGroup === "0-5岁").length,
    "5-10岁": pediatricDoseRecords.filter((r: PediatricDoseRecord) => r.ageGroup === "5-10岁").length,
    "10-15岁": pediatricDoseRecords.filter((r: PediatricDoseRecord) => r.ageGroup === "10-15岁").length,
  };
  const avgReductionFactor =
    pediatricDoseRecords.reduce(
      (s: number, r: PediatricDoseRecord) => s + r.doseReductionFactor,
      0,
    ) / totalPediatricExams;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          padding: "8px 12px",
          background: "#fef3c7",
          color: "#d97706",
          borderRadius: 8,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <AlertTriangle size={14} /> 演示数据：rdsrApi 无儿童专项端点（患者记录未含年龄分组），儿童剂量记录为本地模拟
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <Stat label="儿童检查总量" value={totalPediatricExams} suffix="人次" color="#1e40af" />
        <Stat label="0-5岁" value={ageGroups["0-5岁"]} suffix="幼儿" color="#dc2626" />
        <Stat label="5-10岁" value={ageGroups["5-10岁"]} suffix="儿童" color="#d97706" />
        <Stat label="10-15岁" value={ageGroups["10-15岁"]} suffix="青少年" color="#16a34a" />
        <Stat
          label="平均折扣系数"
          value={`${(avgReductionFactor * 100).toFixed(0)}%`}
          suffix="相对成人"
          color="#1e40af"
        />
      </div>

      <ReductionFactorCards />

      <RecordsTable records={pediatricDoseRecords} />

      <div
        style={{
          padding: "12px 16px",
          background: "#eff6ff",
          borderRadius: 8,
          border: "1px solid #bfdbfe",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <Info size={14} color="#1e40af" style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: "#1e40af", lineHeight: 1.6 }}>
          <strong>儿童剂量管理要点：</strong>
          儿童患者对辐射更敏感，应根据年龄组选择适当的剂量折扣系数。
          系统会自动计算儿童患者相对于成人剂量的折扣值，确保辐射防护的最优化。
          AAPM和欧盟指南均建议对儿童CT检查实施年龄特异性剂量管理。
        </div>
      </div>
    </div>
  );
}

function ReductionFactorCards() {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        padding: 20,
        border: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#1e40af",
          marginBottom: 16,
        }}
      >
        儿童CT剂量折扣系数参考
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <ReductionCard age="0-5岁" factor="40%" formula="DLP = 成人 × 0.4" color="#dc2626" bg="#fef2f2" border="#fecaca" />
        <ReductionCard age="5-10岁" factor="60%" formula="DLP = 成人 × 0.6" color="#d97706" bg="#fffbeb" border="#fde68a" />
        <ReductionCard age="10-15岁" factor="70%" formula="DLP = 成人 × 0.7" color="#1e40af" bg="#eff6ff" border="#bfdbfe" />
        <ReductionCard age="15岁以上" factor="100%" formula="DLP = 成人 × 1.0" color="#16a34a" bg="#f0fdf4" border="#bbf7d0" icon="user" />
      </div>
    </div>
  );
}

function ReductionCard({
  age,
  factor,
  formula,
  color,
  bg,
  border,
  icon,
}: {
  age: string;
  factor: string;
  formula: string;
  color: string;
  bg: string;
  border: string;
  icon?: "user";
}) {
  return (
    <div
      style={{
        padding: 16,
        background: bg,
        borderRadius: 8,
        textAlign: "center",
        border: `1px solid ${border}`,
      }}
    >
      {icon === "user" ? (
        <User size={24} color={color} style={{ marginBottom: 8 }} />
      ) : (
        <Baby size={24} color={color} style={{ marginBottom: 8 }} />
      )}
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{age}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 4 }}>{factor}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{formula}</div>
    </div>
  );
}

function RecordsTable({ records }: { records: PediatricDoseRecord[] }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        padding: 20,
        border: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#1e40af",
          marginBottom: 16,
        }}
      >
        儿童CT检查记录
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg-primary)" }}>
              {[
                "患者姓名",
                "年龄",
                "年龄组",
                "性别",
                "检查日期",
                "设备",
                "检查项目",
                "剂量值",
                "折扣系数",
                "预警级别",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 12px",
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748b",
                    borderBottom: "2px solid #e2e8f0",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record: PediatricDoseRecord, i: number) => {
              const badge = getAlertBadge(record.alertLevel);
              const ageGroupColor =
                record.ageGroup === "0-5岁"
                  ? "#dc2626"
                  : record.ageGroup === "5-10岁"
                    ? "#d97706"
                    : "#1e40af";
              const ageGroupBg =
                record.ageGroup === "0-5岁"
                  ? "#fef2f2"
                  : record.ageGroup === "5-10岁"
                    ? "#fffbeb"
                    : "#eff6ff";
              return (
                <tr
                  key={record.id}
                  style={{ background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-primary)" }}
                >
                  <td style={tdPrimary}>{record.patientName}</td>
                  <td style={tdSecondary}>{record.age}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        background: ageGroupBg,
                        color: ageGroupColor,
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {record.ageGroup}
                    </span>
                  </td>
                  <td style={tdSecondary}>{record.gender}</td>
                  <td style={tdMuted}>{record.examDate}</td>
                  <td style={tdSecondary}>{record.device}</td>
                  <td style={tdSecondary}>{record.examItem}</td>
                  <td style={tdBold}>{record.doseValue}</td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        background: "#eff6ff",
                        color: "#1e40af",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      ×{record.doseReductionFactor.toFixed(1)}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        background: badge.bg,
                        color: badge.color,
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {badge.label}级
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const Stat = ({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: string | number;
  suffix: string;
  color: string;
}) => (
  <div
    style={{
      background: "var(--bg-card)",
      borderRadius: 10,
      padding: "14px 16px",
      border: "1px solid #e2e8f0",
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{suffix}</div>
  </div>
);

const tdPrimary: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "#1e40af",
  textAlign: "center",
};
const tdSecondary: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  color: "#334155",
  textAlign: "center",
};
const tdMuted: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  color: "#64748b",
  textAlign: "center",
};
const tdBold: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 700,
  color: "#1e40af",
  textAlign: "center",
};