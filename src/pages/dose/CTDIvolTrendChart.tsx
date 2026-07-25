import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CTDIvolPoint {
  date: string;
  CT1: number;
  CT2: number;
  threshold: number;
}

const CTDIVOL_TREND: CTDIvolPoint[] = [
  { date: "04-25", CT1: 22.5, CT2: 18.2, threshold: 50 },
  { date: "04-26", CT1: 21.8, CT2: 17.5, threshold: 50 },
  { date: "04-27", CT1: 24.2, CT2: 19.8, threshold: 50 },
  { date: "04-28", CT1: 20.5, CT2: 16.8, threshold: 50 },
  { date: "04-29", CT1: 18.9, CT2: 15.2, threshold: 50 },
  { date: "04-30", CT1: 23.1, CT2: 18.9, threshold: 50 },
  { date: "05-01", CT1: 19.5, CT2: 14.8, threshold: 50 },
];

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
            background: "#fff",
            padding: 12,
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f", marginBottom: 8 }}>
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
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f" }}>
            CTDIvol 趋势监控
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            CT设备7日CTDIvol趋势及法规阈值
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <LineLegend color="#3b82f6" label="CT-1" />
          <LineLegend color="#8b5cf6" label="CT-2" />
          <LineLegend color="#dc2626" label="阈值" />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
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
      </ResponsiveContainer>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 8,
          marginTop: 16,
          padding: 12,
          background: "#f8fafc",
          borderRadius: 8,
        }}
      >
        <Stat color="#3b82f6" value="21.5" label="CT-1均值" />
        <Stat color="#8b5cf6" value="17.2" label="CT-2均值" />
        <Stat color="#16a34a" value="-12%" label="较上周" />
        <Stat color="#dc2626" value="0" label="超阈值天数" />
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