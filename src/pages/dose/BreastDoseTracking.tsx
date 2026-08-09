import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { breastDoseRecords } from "./mockData";
import { getAlertBadge } from "./utils";
import type { BreastDoseRecord } from "./types";

// [W3-C] 乳腺剂量: rdsrApi 无乳腺专项端点 (仅 CT), 标注「演示数据」
export default function BreastDoseTracking() {
  const totalExams = breastDoseRecords.length;
  const recalledExams = breastDoseRecords.filter(
    (r: BreastDoseRecord) => r.recallStatus !== "none",
  ).length;
  const avgAGD =
    breastDoseRecords.reduce((s: number, r: BreastDoseRecord) => s + r.agd, 0) /
    totalExams;
  const exceedCount = breastDoseRecords.filter(
    (r: BreastDoseRecord) => r.agd > r.referenceValue,
  ).length;

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
        <AlertTriangle size={14} /> 演示数据：rdsrApi 无乳腺 (MG) 剂量端点，AGD 记录为本地模拟数据
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <KpiBox label="本月检查量" value={totalExams} suffix="人次" color="#1e40af" />
        <KpiBox label="平均AGD" value={avgAGD.toFixed(1)} suffix="mGy" color="#16a34a" />
        <KpiBox
          label="召回重拍"
          value={recalledExams}
          suffix={`例 (${((recalledExams / totalExams) * 100).toFixed(1)}%)`}
          color="#d97706"
        />
        <KpiBox
          label="超标次数"
          value={exceedCount}
          suffix="次 (AGD>6mGy)"
          color={exceedCount > 0 ? "#dc2626" : "#16a34a"}
        />
      </div>

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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>
              乳腺摄影AGD剂量追踪
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              平均腺体剂量(AGD)参考值: 6 mGy（欧盟标准）
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Legend color="#1e40af" label="AGD值" />
            <Legend color="#dc2626" label="参考线(6mGy)" />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={breastDoseRecords.map((r: BreastDoseRecord) => ({
              name: r.patientName.slice(0, 3),
              agd: r.agd,
              alert: r.agd > 6,
            }))}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} domain={[0, 8]} />
            <Tooltip
              content={({ active, payload, label }: { active?: boolean; payload?: Array<{value: number}>; label?: string }) => {
                if (active && payload && payload.length) {
                  const record = breastDoseRecords.find((r: BreastDoseRecord) =>
                    r.patientName.startsWith(label ?? ""),
                  );
                  return (
                    <div
                      style={{
                        background: "var(--bg-card)",
                        padding: 10,
                        border: "1px solid #e2e8f0",
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af" }}>
                        {record?.patientName}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        AGD: {payload[0]?.value} mGy
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: (record?.agd ?? 0) > 6 ? "#dc2626" : "#16a34a",
                        }}
                      >
                        {(record?.agd ?? 0) > 6 ? "超标" : "正常"}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine y={6} stroke="#dc2626" strokeDasharray="3 3" />
            <Bar dataKey="agd" radius={[4, 4, 0, 0]} name="AGD">
              {breastDoseRecords.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.agd > 6 ? "#dc2626" : "#1e40af"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

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
          乳腺剂量检查记录
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-primary)" }}>
                {[
                  "患者姓名",
                  "年龄",
                  "检查日期",
                  "AGD(mGy)",
                  "参考值",
                  "状态",
                  "召回状态",
                  "设备",
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
              {breastDoseRecords.map((record: BreastDoseRecord, i: number) => {
                const badge = getAlertBadge(record.alertLevel);
                return (
                  <tr
                    key={record.id}
                    style={{ background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-primary)" }}
                  >
                    <td style={tdPrimary}>{record.patientName}</td>
                    <td style={tdSecondary}>{record.age}</td>
                    <td style={tdMuted}>{record.examDate}</td>
                    <td
                      style={{
                        ...tdSecondary,
                        fontWeight: 700,
                        color: record.agd > 6 ? "#dc2626" : "#16a34a",
                      }}
                    >
                      {record.agd}
                    </td>
                    <td style={tdMuted}>{record.referenceValue}</td>
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
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      {record.recallStatus === "none" ? (
                        <span style={{ fontSize: 12, color: "#16a34a" }}>无需召回</span>
                      ) : record.recallStatus === "recalled" ? (
                        <span
                          style={{
                            padding: "2px 8px",
                            background: "#fffbeb",
                            color: "#d97706",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          待重拍
                        </span>
                      ) : (
                        <span
                          style={{
                            padding: "2px 8px",
                            background: "#f0fdf4",
                            color: "#16a34a",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          已完成
                        </span>
                      )}
                    </td>
                    <td style={tdSecondary}>{record.device}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const KpiBox = ({
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

const Legend = ({ color, label }: { color: string; label: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
    <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
    <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
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