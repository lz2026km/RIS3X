import { Monitor, AlertTriangle, Clock, FileText } from "lucide-react";
import type { DeviceDoseData } from "./types";

interface Props {
  device: DeviceDoseData;
  onShowHistory: () => void;
}

export default function DeviceDoseCard({ device: d, onShowHistory }: Props) {
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
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "#eff6ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Monitor size={18} color="#3b82f6" />
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#1e40af",
              }}
            >
              {d.device}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: d.status === "warning" ? "#d97706" : "#16a34a",
                  }}
                />
                {d.status === "warning" ? "警告" : "正常"}
              </span>
            </div>
          </div>
        </div>
        {d.alertCount > 0 && (
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
            <AlertTriangle size={12} /> {d.alertCount}起预警
          </span>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Metric label="今日DLP" value={d.todayDLP} unit="mGy·cm" />
        <Metric label="今日CTDI" value={d.todayCTDI} unit="mGy" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <MicroStat label="检查人数" value={d.examCount} />
        <MicroStat label="利用率" value={`${d.utilizationRate}%`} />
        <MicroStat label="平均CTDI" value={d.avgCTDI} />
      </div>

      <div
        style={{
          marginBottom: 12,
          padding: 10,
          background: "#f8fafc",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 12, color: "#64748b" }}>CTDI范围</span>
          <span style={{ fontSize: 12, color: "#1e40af", fontWeight: 600 }}>
            {d.avgCTDI} - {d.maxCTDI} mGy
          </span>
        </div>
        <div
          style={{
            height: 4,
            background: "#e2e8f0",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${(d.maxCTDI / 60) * 100}%`,
              background: d.maxCTDI > 50 ? "#dc2626" : "#3b82f6",
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onShowHistory} style={cardBtn("#eff6ff", "#2563eb")}>
          <Clock size={13} /> 历史
        </button>
        <button
          onClick={() =>
            window.open(`/api/device/${d.device}/qc-report`, "_blank")
          }
          style={cardBtn("#f8fafc", "#334155")}
        >
          <FileText size={13} /> QC报告
        </button>
      </div>
    </div>
  );
}

const Metric = ({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) => (
  <div
    style={{
      background: "#f8fafc",
      borderRadius: 8,
      padding: 12,
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: "#1e40af" }}>{value}</div>
    <div style={{ fontSize: 12, color: "#94a3b8" }}>{unit}</div>
  </div>
);

const MicroStat = ({ label, value }: { label: string; value: string | number }) => (
  <div
    style={{
      textAlign: "center",
      padding: 8,
      background: "#f8fafc",
      borderRadius: 6,
    }}
  >
    <div style={{ fontSize: 14, fontWeight: 700, color: "#1e40af" }}>{value}</div>
    <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
  </div>
);

const cardBtn = (bg: string, color: string): React.CSSProperties => ({
  flex: 1,
  padding: 8,
  background: bg,
  color,
  border: "none",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
});