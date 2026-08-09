import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { staffDoseRecords } from "./mockData";
import type { StaffDoseRecord } from "./types";
import ChartContainer from "../../components/charts/ChartContainer";

const STAFF_COLORS = ["#3b82f6", "#8b5cf6", "#ef4444", "#10b981", "#f59e0b", "#6366f1"];

export default function StaffDoseMonitoring() {
  const first = staffDoseRecords[0];
  if (!first) return null;

  const monthlyChartData = first.readings.map((r, idx) => ({
    month: r.month,
    ...Object.fromEntries(
      staffDoseRecords.map((s: StaffDoseRecord) => [
        s.staffName,
        s.readings[idx]?.dose ?? 0,
      ]),
    ),
  }));

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
        <AlertTriangle size={14} /> 演示数据：rdsrApi 无工作人员剂量端点（仅患者检查剂量），个人剂量计数据为本地模拟
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>监测人数</div>
          <div style={kpiVal("#1e40af")}>{staffDoseRecords.length}</div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>最高年剂量</div>
          <div
            style={kpiVal(
              Math.max(...staffDoseRecords.map((s: StaffDoseRecord) => s.annualDose)) >
                10
                ? "#dc2626"
                : "#1e40af",
            )}
          >
            {Math.max(...staffDoseRecords.map((s: StaffDoseRecord) => s.annualDose))}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>mSv</div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>平均合规率</div>
          <div style={kpiVal("#16a34a")}>
            {Math.round(
              staffDoseRecords.reduce(
                (s: number, r: StaffDoseRecord) => s + r.complianceRate,
                0,
              ) / staffDoseRecords.length,
            )}
            %
          </div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>高风险人员</div>
          <div
            style={kpiVal(
              staffDoseRecords.filter(
                (s: StaffDoseRecord) => s.complianceRate < 60,
              ).length > 0
                ? "#dc2626"
                : "#16a34a",
            )}
          >
            {staffDoseRecords.filter(
              (s: StaffDoseRecord) => s.complianceRate < 60,
            ).length}
          </div>
        </div>
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
          月度人员剂量对比
        </div>
        <ChartContainer height={220} state={monthlyChartData.length > 0 ? "ready" : "empty"} emptyDescription="暂无数据">
          <BarChart data={monthlyChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine
              y={0.5}
              stroke="#d97706"
              strokeDasharray="3 3"
              label={{
                value: "关注线",
                position: "right",
                fontSize: 12,
                fill: "#d97706",
              }}
            />
            {staffDoseRecords.map((s: StaffDoseRecord, idx: number) => (
              <Bar
                key={s.id}
                dataKey={s.staffName}
                fill={STAFF_COLORS[idx % STAFF_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ChartContainer>
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
          个人剂量监测记录
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-primary)" }}>
                {[
                  "姓名",
                  "科室",
                  "岗位",
                  "本月剂量(mSv)",
                  "年累计(mSv)",
                  "年限值(mSv)",
                  "合规率",
                  "状态",
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
              {staffDoseRecords.map((s: StaffDoseRecord, i: number) => {
                const isHighRisk = s.complianceRate < 60;
                const badgeBg = isHighRisk
                  ? "#fef2f2"
                  : s.complianceRate < 80
                    ? "#fffbeb"
                    : "#f0fdf4";
                const badgeColor = isHighRisk
                  ? "#dc2626"
                  : s.complianceRate < 80
                    ? "#d97706"
                    : "#16a34a";
                return (
                  <tr
                    key={s.id}
                    style={{ background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-primary)" }}
                  >
                    <td style={tdPrimary}>{s.staffName}</td>
                    <td style={tdSecondary}>{s.department}</td>
                    <td style={tdMuted}>{s.role}</td>
                    <td style={tdBold}>{s.monthlyDose}</td>
                    <td
                      style={{
                        ...tdSecondary,
                        color: s.annualDose > 15 ? "#dc2626" : "#334155",
                        fontWeight: 600,
                      }}
                    >
                      {s.annualDose}
                    </td>
                    <td style={tdMuted}>{s.annualLimit}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 8px",
                          background: badgeBg,
                          color: badgeColor,
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {s.complianceRate}%
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          background: isHighRisk ? "#fef2f2" : "#f0fdf4",
                          color: isHighRisk ? "#dc2626" : "#16a34a",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {isHighRisk ? "高风险" : "正常"}
                      </span>
                    </td>
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

const kpiBox: React.CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: 10,
  padding: "14px 16px",
  border: "1px solid #e2e8f0",
  textAlign: "center",
};

const kpiVal = (color: string): React.CSSProperties => ({
  fontSize: 24,
  fontWeight: 800,
  color,
  marginTop: 4,
});

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