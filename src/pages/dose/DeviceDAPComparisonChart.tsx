import { ShieldAlert } from "lucide-react";
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

interface DAPPoint {
  device: string;
  DAP: number;
  avgDAP: number;
  threshold: number;
}

interface TooltipPayload {
  payload: DAPPoint;
}

const DEVICE_DAP_DATA: DAPPoint[] = [
  { device: "CT-1", DAP: 250, avgDAP: 230, threshold: 1000 },
  { device: "CT-2", DAP: 280, avgDAP: 250, threshold: 1000 },
  { device: "DR-1", DAP: 0.15, avgDAP: 0.12, threshold: 300 },
  { device: "DR-2", DAP: 0.18, avgDAP: 0.14, threshold: 300 },
  { device: "DSA-1", DAP: 2850, avgDAP: 2650, threshold: 3000 },
];

export default function DeviceDAPComparisonChart() {
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: TooltipPayload[];
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div
          style={{
            background: "#fff",
            padding: 12,
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", marginBottom: 8 }}>
            {data.device}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            <div>
              今日DAP:{" "}
              <span style={{ fontWeight: 600, color: "#1e40af" }}>{data.DAP}</span>
            </div>
            <div>
              平均DAP:{" "}
              <span style={{ fontWeight: 600, color: "#1e40af" }}>{data.avgDAP}</span>
            </div>
            <div>
              法规阈值:{" "}
              <span style={{ fontWeight: 600, color: "#d97706" }}>{data.threshold}</span>
            </div>
            <div>
              占比:{" "}
              <span
                style={{
                  fontWeight: 600,
                  color: data.DAP > data.threshold ? "#dc2626" : "#16a34a",
                }}
              >
                {Math.round((data.DAP / data.threshold) * 100)}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
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
            设备DAP对比分析
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            今日DAP vs 法规阈值 vs 设备平均值
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Legend color="#3b82f6" label="今日DAP" />
          <Legend color="#94a3b8" label="平均DAP" />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={DEVICE_DAP_DATA} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="device" tick={{ fontSize: 12, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={3000}
            stroke="#dc2626"
            strokeDasharray="3 3"
            label={{ value: "DSA阈值", position: "right", fontSize: 12, fill: "#dc2626" }}
          />
          <ReferenceLine
            y={1000}
            stroke="#f59e0b"
            strokeDasharray="3 3"
            label={{ value: "CT阈值", position: "right", fontSize: 12, fill: "#f59e0b" }}
          />
          <Bar dataKey="DAP" fill="#3b82f6" radius={[4, 4, 0, 0]} name="今日DAP">
            {DEVICE_DAP_DATA.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.DAP > entry.threshold ? "#dc2626" : "#3b82f6"}
              />
            ))}
          </Bar>
          <Bar dataKey="avgDAP" fill="#94a3b8" radius={[4, 4, 0, 0]} name="平均DAP" />
        </BarChart>
      </ResponsiveContainer>
      <div
        style={{
          marginTop: 12,
          padding: "10px 12px",
          background: "#f8fafc",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <ShieldAlert size={14} color="#d97706" />
        <span style={{ fontSize: 12, color: "#64748b" }}>
          法规阈值: CT DLP {"<"} 1000mGy·cm | DR DAP {"<"} 300mGy·m² | DSA DAP{" "}
          {"<"} 3000mGy·m² | MG AGD {"<"} 6mGy
        </span>
      </div>
    </div>
  );
}

const Legend = ({ color, label }: { color: string; label: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
    <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
    <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
  </div>
);