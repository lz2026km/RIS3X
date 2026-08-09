import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { rdsrApi, type CumulativeDose } from "../../services/api/rdsrApi";
import { cumulativeDoseData } from "./mockData";
import type { CumulativeDosePoint } from "./types";

export default function CumulativeDoseTracker({ patientId = "RAD-P001" }: { patientId?: string }) {
  const [data, setData] = useState<CumulativeDosePoint[]>(cumulativeDoseData);
  const [patientInfo, setPatientInfo] = useState<{ name: string; id: string }>({ name: "张志刚", id: patientId });
  const [source, setSource] = useState<"api" | "demo">("demo");

  // [W2-C] 接 rdsrApi.getPatientCumulative 患者累计剂量, 失败时回退演示数据
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await rdsrApi.getPatientCumulative(patientId);
        if (!cancelled && res.success && res.data) {
          const d = res.data as CumulativeDose;
          setPatientInfo({ name: d.patientName, id: d.patientId });
          if (d.monthlyTrend && d.monthlyTrend.length > 0) {
            let acc = 0;
            const points = d.monthlyTrend.map(t => {
              acc += t.totalDlp;
              return { date: t.month, cumulativeDLP: acc, examCount: d.totalExams, threshold: d.annualLimit };
            });
            setData(points);
            setSource("api");
          }
        }
      } catch { /* 回退演示数据 */ }
    })();
    return () => { cancelled = true; };
  }, [patientId]);

  const lastPoint = data[data.length - 1] as CumulativeDosePoint;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          患者累计剂量时间线 - {patientInfo.name} ({patientInfo.id})
          <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>
            {source === "api" ? "· 数据源: /rdsr/patients/cumulative" : "· 演示数据"}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <ReferenceLine
              y={5000}
              stroke="#dc2626"
              strokeDasharray="5 5"
              label={{
                value: "年度阈值",
                position: "right",
                fontSize: 12,
                fill: "#dc2626",
              }}
            />
            <Area
              type="monotone"
              dataKey="cumulativeDLP"
              stroke="#1e40af"
              fill="#3b82f6"
              fillOpacity={0.15}
              strokeWidth={2}
              name="累计DLP"
            />
            <Area
              type="monotone"
              dataKey="threshold"
              stroke="#d97706"
              fill="#f59e0b"
              fillOpacity={0.05}
              strokeWidth={1.5}
              strokeDasharray="3 3"
              name="阶段阈值"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div style={statBox}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1e40af" }}>
            {lastPoint.cumulativeDLP}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>当前累计DLP</div>
        </div>
        <div style={statBox}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>
            {lastPoint.examCount}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>累计检查次数</div>
        </div>
        <div style={statBox}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#d97706" }}>
            {Math.round(lastPoint.cumulativeDLP / lastPoint.examCount)}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>次均剂量</div>
        </div>
        <div style={statBox}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: lastPoint.cumulativeDLP > 4000 ? "#dc2626" : "#16a34a",
            }}
          >
            {lastPoint.cumulativeDLP > 4000 ? "接近阈值" : "安全"}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>状态</div>
        </div>
      </div>
      <div
        style={{
          padding: "12px 16px",
          background: lastPoint.cumulativeDLP > 4000 ? "#fffbeb" : "#f0fdf4",
          borderRadius: 8,
          border: `1px solid ${lastPoint.cumulativeDLP > 4000 ? "#fde68a" : "#bbf7d0"}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: lastPoint.cumulativeDLP > 4000 ? "#d97706" : "#16a34a",
        }}
      >
        {lastPoint.cumulativeDLP > 4000 ? (
          <AlertTriangle size={14} />
        ) : (
          <CheckCircle size={14} />
        )}
        {lastPoint.cumulativeDLP > 4000
          ? "该患者累计剂量接近年度阈值（5000 mGy·cm），建议关注后续检查必要性"
          : "该患者累计剂量在安全范围内"}
      </div>
    </div>
  );
}

const statBox: React.CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: 10,
  padding: 16,
  border: "1px solid #e2e8f0",
  textAlign: "center",
};