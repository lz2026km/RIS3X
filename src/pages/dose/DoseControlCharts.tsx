import { AlertTriangle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { controlChartData } from "./mockData";
import type { ControlChartPoint } from "./types";

export default function DoseControlCharts() {
  const outOfControl = controlChartData.filter(
    (p: ControlChartPoint) =>
      p.mean > p.ucl || p.mean < p.lcl || p.range > p.rangeUcl,
  );

  const first = controlChartData[0];
  const last = controlChartData[controlChartData.length - 1];
  const meanShift =
    first && last
      ? (last.mean - first.mean >= 0 ? "+" : "") +
        (last.mean - first.mean).toFixed(1)
      : "-";

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
        <AlertTriangle size={14} /> 演示数据：控制图需按日历史明细计算 UCL/LCL，rdsrApi 仅提供聚合趋势，暂以本地模拟数据呈现
      </div>
      <div
        style={{
          background: "#fff",
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
              X-bar 控制图（CTDIvol均值）
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              7日CTDIvol均值监控 · UCL: 32 · LCL: 12 · CL: 22
            </div>
          </div>
          {outOfControl.length > 0 && (
            <span
              style={{
                padding: "4px 10px",
                background: "#fef2f2",
                color: "#dc2626",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <AlertTriangle size={12} /> {outOfControl.length}个失控点
            </span>
          )}
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={controlChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} domain={[0, 40]} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine
              y={22}
              stroke="#16a34a"
              strokeDasharray="5 5"
              label={{ value: "CL(22)", position: "left", fontSize: 12, fill: "#16a34a" }}
            />
            <ReferenceLine
              y={32}
              stroke="#dc2626"
              strokeDasharray="5 5"
              label={{
                value: "UCL(32)",
                position: "center",
                fontSize: 12,
                fill: "#dc2626",
              }}
            />
            <ReferenceLine
              y={12}
              stroke="#d97706"
              strokeDasharray="5 5"
              label={{
                value: "LCL(12)",
                position: "right",
                fontSize: 12,
                fill: "#d97706",
              }}
            />
            <Line
              type="monotone"
              dataKey="mean"
              stroke="#1e40af"
              strokeWidth={2}
              dot={{ fill: "#1e40af", r: 4 }}
              name="均值"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          background: "#fff",
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
          R 控制图（极差监控）
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={controlChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} domain={[0, 20]} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <ReferenceLine
              y={15}
              stroke="#dc2626"
              strokeDasharray="5 5"
              label={{
                value: "UCL(15)",
                position: "right",
                fontSize: 12,
                fill: "#dc2626",
              }}
            />
            <Line
              type="monotone"
              dataKey="range"
              stroke="#d97706"
              strokeWidth={2}
              dot={{ fill: "#d97706", r: 4 }}
              name="极差"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>均值偏移</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1e40af", marginTop: 4 }}>
            {meanShift}
          </div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>过程能力Cp</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#16a34a", marginTop: 4 }}>
            1.25
          </div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>失控点数</div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: outOfControl.length > 0 ? "#dc2626" : "#16a34a",
              marginTop: 4,
            }}
          >
            {outOfControl.length}
          </div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>过程状态</div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: outOfControl.length > 0 ? "#dc2626" : "#16a34a",
              marginTop: 4,
            }}
          >
            {outOfControl.length > 0 ? "失控" : "受控"}
          </div>
        </div>
      </div>

      {outOfControl.length > 0 && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fef2f2",
            borderRadius: 8,
            border: "1px solid #fecaca",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <AlertTriangle
            size={14}
            color="#dc2626"
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <div style={{ fontSize: 12, color: "#dc2626" }}>
            <strong>SPC失控告警：</strong>检测到 {outOfControl.length}{" "}
            个数据点超出控制限。 建议检查设备校准状态、扫描参数设置，并在剂量优化后重新评估过程能力。
          </div>
        </div>
      )}
    </div>
  );
}

const kpiBox: React.CSSProperties = {
  background: "#fff",
  borderRadius: 10,
  padding: 12,
  border: "1px solid #e2e8f0",
  textAlign: "center",
};