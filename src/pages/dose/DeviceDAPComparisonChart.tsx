import { ShieldAlert } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import ChartContainer from "../../components/charts/ChartContainer";

interface DAPPoint {
  device: string;
  // [P0] 统一口径: 各设备当日剂量占其法规阈值的百分比 (混合单位 DLP/DAP 归一化)
  pctOfThreshold: number;
  pctAvgOfThreshold: number;
  DAP: number;
  avgDAP: number;
  threshold: number;
  unit: string;
}

interface TooltipPayload {
  payload: DAPPoint;
}

const DEVICE_DAP_DATA: DAPPoint[] = [
  { device: "CT-1", DAP: 250, avgDAP: 230, threshold: 1000, unit: "mGy·cm", pctOfThreshold: 25, pctAvgOfThreshold: 23 },
  { device: "CT-2", DAP: 280, avgDAP: 250, threshold: 1000, unit: "mGy·cm", pctOfThreshold: 28, pctAvgOfThreshold: 25 },
  { device: "DR-1", DAP: 0.15, avgDAP: 0.12, threshold: 300, unit: "mGy·m²", pctOfThreshold: 0.05, pctAvgOfThreshold: 0.04 },
  { device: "DR-2", DAP: 0.18, avgDAP: 0.14, threshold: 300, unit: "mGy·m²", pctOfThreshold: 0.06, pctAvgOfThreshold: 0.05 },
  { device: "DSA-1", DAP: 2850, avgDAP: 2650, threshold: 3000, unit: "mGy·m²", pctOfThreshold: 95, pctAvgOfThreshold: 88.3 },
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
      const data = payload[0]!.payload;
      return (
        <div
          style={{
            background: "var(--bg-card)",
            padding: 'var(--space-3, 12px)',
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary-800)", marginBottom: 'var(--space-2, 8px)' }}>
            {data.device}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            <div>
              今日: <span style={{ fontWeight: 600, color: "var(--color-primary-800)" }}>{data.DAP} {data.unit}</span>
            </div>
            <div>
              平均: <span style={{ fontWeight: 600, color: "var(--color-primary-800)" }}>{data.avgDAP} {data.unit}</span>
            </div>
            <div>
              法规阈值: <span style={{ fontWeight: 600, color: "var(--color-warning-600)" }}>{data.threshold} {data.unit}</span>
            </div>
            <div>
              占阈值: <span style={{ fontWeight: 600, color: data.pctOfThreshold > 100 ? "var(--color-error-600)" : "var(--color-success-600)" }}>{data.pctOfThreshold}%</span>
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
        background: "var(--bg-card)",
        borderRadius: 12,
        padding: 'var(--space-5, 20px)',
        border: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 'var(--space-4, 16px)',
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary-800)" }}>
            设备剂量占法规阈值对比
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            [P0] 混合单位(DLP mGy·cm / DAP mGy·m²)归一化为占阈值百分比, 口径一致可比
          </div>
        </div>
        <span
          style={{
            fontSize: 11, color: "#b45309", background: "#fef3c7",
            border: "1px solid #fcd34d", borderRadius: 10, padding: "2px 10px",
          }}
        >
          演示数据 · 未接入接口
        </span>
        <div style={{ display: "flex", gap: 'var(--space-3, 12px)' }}>
          <Legend color="var(--color-primary-500)" label="今日占阈值%" />
          <Legend color="#94a3b8" label="平均占阈值%" />
        </div>
      </div>
      <ChartContainer height={240} state={DEVICE_DAP_DATA.length > 0 ? "ready" : "empty"} emptyDescription="暂无数据">
        <BarChart data={DEVICE_DAP_DATA} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="device" tick={{ fontSize: 12, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} unit="%" domain={[0, (dataMax: number) => Math.max(110, Math.ceil(dataMax))]} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={100}
            stroke="var(--color-error-600)"
            strokeDasharray="3 3"
            label={{ value: "法规阈值(100%)", position: "right", fontSize: 12, fill: "var(--color-error-600)" }}
          />
          <Bar dataKey="pctOfThreshold" fill="var(--color-primary-500)" radius={[4, 4, 0, 0]} name="今日占阈值%">
            {DEVICE_DAP_DATA.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.pctOfThreshold > 100 ? "var(--color-error-600)" : "var(--color-primary-500)"}
              />
            ))}
          </Bar>
          <Bar dataKey="pctAvgOfThreshold" fill="#94a3b8" radius={[4, 4, 0, 0]} name="平均占阈值%" />
        </BarChart>
      </ChartContainer>
      <div
        style={{
          marginTop: 'var(--space-3, 12px)',
          padding: "10px 12px",
          background: "var(--bg-primary)",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 'var(--space-2, 8px)',
        }}
      >
        <ShieldAlert size={14} color="var(--color-warning-600)" />
        <span style={{ fontSize: 12, color: "#64748b" }}>
          法规阈值: CT DLP {"<"} 1000mGy·cm | DR DAP {"<"} 300mGy·m² | DSA DAP{" "}
          {"<"} 3000mGy·m² | MG AGD {"<"} 6mGy
        </span>
      </div>
    </div>
  );
}

const Legend = ({ color, label }: { color: string; label: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)' }}>
    <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
    <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
  </div>
);
