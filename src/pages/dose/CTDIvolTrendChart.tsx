import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import ChartContainer from "../../components/charts/ChartContainer";
import { seededUnit } from "../../utils/seededRandom";

interface CTDIvolPoint {
  date: string;
  CT1: number;
  CT2: number;
  threshold: number;
}

// [P0] 演示趋势改为确定性 seed 生成 (以日期为键), 刷新不抖动; 已有"演示数据"徽标
const CTDIVOL_TREND: CTDIvolPoint[] = ['04-25', '04-26', '04-27', '04-28', '04-29', '04-30', '05-01'].map((date) => ({
  date,
  CT1: Math.round((18 + seededUnit(`ctdi-ct1-${date}`) * 7) * 10) / 10,
  CT2: Math.round((14 + seededUnit(`ctdi-ct2-${date}`) * 6) * 10) / 10,
  threshold: 50,
}));

interface TooltipPayload {
  value: number;
}

export default function CTDIvolTrendChart() {
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: TooltipPayload[];
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: "var(--bg-card)",
            padding: 12,
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", marginBottom: 8 }}>
            {label}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            <div>
              CT-1:{" "}
              <span style={{ fontWeight: 600, color: "#3b82f6" }}>
                {payload[0]?.value} mGy
              </span>
            </div>
            <div>
              CT-2:{" "}
              <span style={{ fontWeight: 600, color: "#8b5cf6" }}>
                {payload[1]?.value} mGy
              </span>
            </div>
            <div>
              法规阈值:{" "}
              <span style={{ fontWeight: 600, color: "#dc2626" }}>
                {payload[2]?.value} mGy
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // [P0] KPI 由趋势数据计算 (原硬编码 21.5/17.2/-12%/0)
  const n = CTDIVOL_TREND.length || 1;
  const avgCT1 = CTDIVOL_TREND.reduce((s, d) => s + d.CT1, 0) / n;
  const avgCT2 = CTDIVOL_TREND.reduce((s, d) => s + d.CT2, 0) / n;
  const firstAvg = (CTDIVOL_TREND[0]!.CT1 + CTDIVOL_TREND[0]!.CT2) / 2;
  const lastAvg = (CTDIVOL_TREND[CTDIVOL_TREND.length - 1]!.CT1 + CTDIVOL_TREND[CTDIVOL_TREND.length - 1]!.CT2) / 2;
  const trendPct = firstAvg > 0 ? `${(((lastAvg - firstAvg) / firstAvg) * 100).toFixed(0)}%` : "-";
  const overThresholdDays = CTDIVOL_TREND.filter((d) => d.CT1 > d.threshold || d.CT2 > d.threshold).length;

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
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>
            CTDIvol 趋势监控
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            CT设备7日CTDIvol趋势及法规阈值
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
        <div style={{ display: "flex", gap: 12 }}>
          <LineLegend color="#3b82f6" label="CT-1" />
          <LineLegend color="#8b5cf6" label="CT-2" />
          <LineLegend color="#dc2626" label="阈值" />
        </div>
      </div>
      <ChartContainer height={240} state={CTDIVOL_TREND.length > 0 ? "ready" : "empty"} emptyDescription="暂无数据">
        <LineChart data={CTDIVOL_TREND}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} domain={[0, 60]} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="CT1"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: "#3b82f6", strokeWidth: 2, r: 3 }}
            name="CT-1"
          />
          <Line
            type="monotone"
            dataKey="CT2"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 3 }}
            name="CT-2"
          />
          <Line
            type="monotone"
            dataKey="threshold"
            stroke="#dc2626"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="法规阈值"
          />
        </LineChart>
      </ChartContainer>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 8,
          marginTop: 16,
          padding: 12,
          background: "var(--bg-primary)",
          borderRadius: 8,
        }}
      >
        <Stat color="#3b82f6" value={avgCT1.toFixed(1)} label="CT-1均值" />
        <Stat color="#8b5cf6" value={avgCT2.toFixed(1)} label="CT-2均值" />
        <Stat color={trendPct.startsWith('-') ? "#16a34a" : "#dc2626"} value={trendPct} label="较上周" />
        <Stat color="#dc2626" value={String(overThresholdDays)} label="超阈值天数" />
      </div>
    </div>
  );
}

const LineLegend = ({ color, label }: { color: string; label: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
    <div style={{ width: 10, height: 3, background: color, borderRadius: 2 }} />
    <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
  </div>
);

const Stat = ({ color, value, label }: { color: string; value: string; label: string }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
  </div>
);